#!/usr/bin/env python3
"""Build the Copernicus context grid for Hava81.

Downloads the Türkiye window of
  * the CAMS European air quality forecast (ensemble; dust, grass and olive pollen),
    licence CC BY 4.0, from the Atmosphere Data Store, and
  * the Copernicus Marine Mediterranean and Black Sea analysis-forecasts (waves and sea
    surface temperature), Copernicus Marine licence (free, any purpose, with credit),
regrids everything to one 0.25° grid and writes a compact JSON document the API reads
(apps/api/src/providers/copernicus/context-grid.ts).

Credentials come from the environment and are never printed:
  CAMS_ADS_API_KEY, COPERNICUS_MARINE_USERNAME, COPERNICUS_MARINE_PASSWORD.
A source that fails contributes nulls; the job only fails when both do.

Usage: build_grid.py OUTPUT.json [--hours 48]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np

FIELDS = (
    'dust',
    'grassPollen',
    'olivePollen',
    'waveHeight',
    'waveDirection',
    'wavePeriod',
    'seaSurfaceTemperature',
)
UNITS = {
    'dust': 'µg/m³',
    'grassPollen': 'grains/m³',
    'olivePollen': 'grains/m³',
    'waveHeight': 'm',
    'waveDirection': '°',
    'wavePeriod': 's',
    'seaSurfaceTemperature': '°C',
}


@dataclass(frozen=True)
class Grid:
    """Cell centres at lat0 + row·step, lon0 + col·step; row 0 is the southern edge."""

    lat0: float
    lon0: float
    step: float
    rows: int
    cols: int

    def lats(self) -> np.ndarray:
        return self.lat0 + np.arange(self.rows) * self.step

    def lons(self) -> np.ndarray:
        return self.lon0 + np.arange(self.cols) * self.step


# 35.5–42.5°N, 25.5–45.0°E: mainland, Thrace, Gökçeada and the surrounding seas.
TURKEY_GRID = Grid(lat0=35.5, lon0=25.5, step=0.25, rows=29, cols=79)
BBOX = (42.75, 25.25, 35.25, 45.25)  # north, west, south, east, half a cell beyond centres

ADS_URL = 'https://ads.atmosphere.copernicus.eu/api'
CAMS_DATASET = 'cams-europe-air-quality-forecasts'
CAMS_VARIABLES = {'dust': 'dust', 'grassPollen': 'grass_pollen', 'olivePollen': 'olive_pollen'}
# NetCDF variable names differ from the request names; try each, then report what the file had.
CAMS_NETCDF_NAMES = {
    'dust': ('dust',),
    'grassPollen': ('grass_pollen', 'gpg_conc', 'gpg'),
    'olivePollen': ('olive_pollen', 'opg_conc', 'opg'),
}

MARINE = (
    # (dataset id, {source variable: field}, DOI)
    ('cmems_mod_med_wav_anfc_4.2km_PT1H-i', {'VHM0': 'waveHeight', 'VMDR': 'waveDirection', 'VTM10': 'wavePeriod'}, '10.48670/mds-00373'),
    ('cmems_mod_med_phy-tem_anfc_4.2km-2D_PT1H-m', {'thetao': 'seaSurfaceTemperature'}, '10.48670/mds-00359'),
    ('cmems_mod_blk_wav_anfc_2.5km_PT1H-i', {'VHM0': 'waveHeight', 'VMDR': 'waveDirection', 'VTM10': 'wavePeriod'}, '10.48670/mds-00360'),
    ('cmems_mod_blk_phy-temp_anfc_2.5km_PT1H-m', {'thetao': 'seaSurfaceTemperature'}, '10.48670/mds-00355'),
)


# ── Pure helpers (unit-tested) ──────────────────────────────────────────────────────────


def regrid(values: np.ndarray, src_lat: np.ndarray, src_lon: np.ndarray, target: Grid) -> np.ndarray:
    """Mean of the finite source cells whose centre falls in each target cell.

    `values` is (time, lat, lon). Target cells with no finite source value stay NaN, so a
    sea-only field leaves land empty and the other way round.
    """
    src_lat = np.asarray(src_lat, dtype=float)
    src_lon = np.asarray(src_lon, dtype=float)
    rows = np.rint((src_lat - target.lat0) / target.step).astype(int)
    cols = np.rint((src_lon - target.lon0) / target.step).astype(int)
    out = np.full((values.shape[0], target.rows, target.cols), np.nan)
    sums = np.zeros_like(out)
    counts = np.zeros_like(out)
    lat_ok = (rows >= 0) & (rows < target.rows)
    lon_ok = (cols >= 0) & (cols < target.cols)
    for i in np.nonzero(lat_ok)[0]:
        for j in np.nonzero(lon_ok)[0]:
            cell = values[:, i, j]
            finite = np.isfinite(cell)
            sums[finite, rows[i], cols[j]] += cell[finite]
            counts[finite, rows[i], cols[j]] += 1
    filled = counts > 0
    out[filled] = sums[filled] / counts[filled]
    return out


def merge_valid(arrays: Sequence[np.ndarray]) -> np.ndarray:
    """Cell-wise mean of the finite values; NaN where none is finite (Mediterranean + Black Sea)."""
    stack = np.stack(arrays)
    finite = np.isfinite(stack)
    counts = finite.sum(axis=0)
    sums = np.where(finite, stack, 0.0).sum(axis=0)
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(counts > 0, sums / np.maximum(counts, 1), np.nan)


def align_to_hours(values: np.ndarray, src_times: Sequence[datetime], hours: Sequence[datetime]) -> np.ndarray:
    """Pick the source step for each target hour; NaN where the source has no such step."""
    index = {t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t.astimezone(timezone.utc): k for k, t in enumerate(src_times)}
    out = np.full((len(hours),) + values.shape[1:], np.nan)
    for k, hour in enumerate(hours):
        source = index.get(hour)
        if source is not None:
            out[k] = values[source]
    return out


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _flatten(values: np.ndarray) -> list[float | None]:
    return [None if not math.isfinite(v) else round(float(v), 2) for v in values.reshape(-1)]


def build_document(
    grid: Grid,
    hours: Sequence[datetime],
    fields: dict[str, np.ndarray],
    sources: list[dict[str, Any]],
    generated_at: datetime,
) -> dict[str, Any]:
    """The JSON document: hour-major, then row (south first), then column; NaN → null."""
    shape = (len(hours), grid.rows, grid.cols)
    out_fields = {}
    for name in FIELDS:
        values = fields.get(name)
        if values is None or values.shape != shape:
            values = np.full(shape, np.nan)
        out_fields[name] = _flatten(values)
    return {
        'version': 1,
        'generatedAt': _iso(generated_at),
        'grid': {'lat0': grid.lat0, 'lon0': grid.lon0, 'step': grid.step, 'rows': grid.rows, 'cols': grid.cols},
        'times': [_iso(t) for t in hours],
        'fields': out_fields,
        'units': dict(UNITS),
        'sources': sources,
    }


# ── Downloads (need network and credentials) ───────────────────────────────────────────


def _request(url: str, *, method: str = 'GET', body: dict | None = None, headers: dict | None = None, timeout: int = 60) -> Any:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers={'Accept': 'application/json', **(headers or {})})
    if data is not None:
        request.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def _decode_times(raw: Any, run: datetime | None = None) -> list[datetime]:
    """Absolute datetimes, lead-time durations from `run`, or lead hours as numbers."""
    values = np.asarray(raw)
    if np.issubdtype(values.dtype, np.datetime64):
        seconds = values.astype('datetime64[s]').astype('int64')
        return [datetime.fromtimestamp(int(t), tz=timezone.utc) for t in seconds]
    if run is None:
        raise ValueError('lead times need the forecast run')
    if np.issubdtype(values.dtype, np.timedelta64):
        seconds = values.astype('timedelta64[s]').astype('int64')
        return [run + timedelta(seconds=int(t)) for t in seconds]
    return [run + timedelta(hours=float(t)) for t in values]


def fetch_cams(hours: list[datetime], workdir: Path) -> tuple[dict[str, np.ndarray], dict[str, Any] | None]:
    """CAMS European ensemble forecast from the latest 00 UTC run that covers `hours`."""
    key = os.environ.get('CAMS_ADS_API_KEY', '').strip()
    if not key:
        print('cams: CAMS_ADS_API_KEY is not set; skipping', file=sys.stderr)
        return {}, None
    import xarray as xr

    headers = {'PRIVATE-TOKEN': key}
    today = hours[0].replace(hour=0)
    for run in (today, today - timedelta(days=1)):
        lead_end = int((hours[-1] - run).total_seconds() // 3600)
        if lead_end > 96:
            continue
        body = {
            'inputs': {
                'variable': list(CAMS_VARIABLES.values()),
                'model': ['ensemble'],
                'level': ['0'],
                'date': [f'{run:%Y-%m-%d}/{run:%Y-%m-%d}'],
                'type': ['forecast'],
                'time': ['00:00'],
                'leadtime_hour': [str(h) for h in range(0, lead_end + 1)],
                'data_format': 'netcdf_zip',
                'area': list(BBOX),
            }
        }
        try:
            job = _request(f'{ADS_URL}/retrieve/v1/processes/{CAMS_DATASET}/execution', method='POST', body=body, headers=headers)
            job_id = job['jobID']
            deadline = time.time() + 1500
            while True:
                status = _request(f'{ADS_URL}/retrieve/v1/jobs/{job_id}', headers=headers)
                state = status.get('status')
                if state == 'successful':
                    break
                if state in ('failed', 'rejected', 'dismissed', 'deleted') or time.time() > deadline:
                    raise RuntimeError(f'job {state}')
                time.sleep(10)
            results = _request(f'{ADS_URL}/retrieve/v1/jobs/{job_id}/results', headers=headers)
            href = results['asset']['value']['href']
            archive = workdir / 'cams.zip'
            with urllib.request.urlopen(urllib.request.Request(href, headers=headers), timeout=600) as response:
                archive.write_bytes(response.read())
        except (urllib.error.URLError, KeyError, RuntimeError, TimeoutError) as error:
            print(f'cams: run {run:%Y-%m-%d} unavailable ({type(error).__name__}: {error})', file=sys.stderr)
            continue

        fields: dict[str, np.ndarray] = {}
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(workdir / 'cams')
        for path in sorted((workdir / 'cams').glob('*.nc')):
            with xr.open_dataset(path) as ds:
                lat = ds['latitude'].values
                lon = ds['longitude'].values
                lon = np.where(lon > 180, lon - 360, lon)
                time_name = next(name for name in ('valid_time', 'time', 'step') if name in ds.coords or name in ds.dims)
                steps = _decode_times(ds[time_name].values, run)
                for field, candidates in CAMS_NETCDF_NAMES.items():
                    var = next((name for name in candidates if name in ds.data_vars), None)
                    if var is None:
                        continue
                    data = ds[var].squeeze(drop=True).transpose(..., 'latitude', 'longitude').values.astype(float)
                    on_grid = regrid(data, lat, lon, TURKEY_GRID)
                    fields[field] = align_to_hours(on_grid, steps, hours)
                missing = [field for field in CAMS_NETCDF_NAMES if field not in fields]
                if missing:
                    print(f'cams: {path.name} lacks {missing}; variables={list(ds.data_vars)}', file=sys.stderr)
        if fields:
            return fields, {
                'name': 'CAMS European air quality forecast (ensemble)',
                'licence': 'CC BY 4.0',
                'run': _iso(run),
            }
    return {}, None


def fetch_marine(hours: list[datetime], workdir: Path) -> tuple[dict[str, np.ndarray], dict[str, Any] | None]:
    """Copernicus Marine Mediterranean and Black Sea waves and sea surface temperature."""
    user = os.environ.get('COPERNICUS_MARINE_USERNAME', '').strip()
    password = os.environ.get('COPERNICUS_MARINE_PASSWORD', '').strip()
    if not user or not password:
        print('marine: Copernicus Marine credentials are not set; skipping', file=sys.stderr)
        return {}, None
    import copernicusmarine
    import xarray as xr

    north, west, south, east = BBOX
    collected: dict[str, list[np.ndarray]] = {}
    dois: list[str] = []
    for dataset_id, variables, doi in MARINE:
        try:
            path = copernicusmarine.subset(
                dataset_id=dataset_id,
                variables=list(variables),
                minimum_longitude=west,
                maximum_longitude=east,
                minimum_latitude=south,
                maximum_latitude=north,
                start_datetime=_iso(hours[0]),
                end_datetime=_iso(hours[-1]),
                minimum_depth=0,
                maximum_depth=1.1,
                username=user,
                password=password,
                output_directory=str(workdir),
                output_filename=f'{dataset_id}.nc',
                overwrite=True,
                disable_progress_bar=True,
            )
        except Exception as error:  # noqa: BLE001 - the toolbox raises many types; one dataset may fail alone
            print(f'marine: {dataset_id} unavailable ({type(error).__name__})', file=sys.stderr)
            continue
        file = Path(getattr(path, 'file_path', None) or workdir / f'{dataset_id}.nc')
        with xr.open_dataset(file) as ds:
            lat = ds['latitude'].values
            lon = ds['longitude'].values
            steps = _decode_times(ds['time'].values)
            for source, field in variables.items():
                if source not in ds:
                    continue
                data = ds[source]
                if 'depth' in data.dims:
                    data = data.isel(depth=0)
                if 'elevation' in data.dims:
                    data = data.isel(elevation=-1)
                values = data.transpose('time', 'latitude', 'longitude').values.astype(float)
                collected.setdefault(field, []).append(align_to_hours(regrid(values, lat, lon, TURKEY_GRID), steps, hours))
        dois.append(doi)
    if not collected:
        return {}, None
    fields = {field: merge_valid(parts) for field, parts in collected.items()}
    return fields, {
        'name': 'E.U. Copernicus Marine Service',
        'licence': 'Copernicus Marine licence',
        'dois': dois,
        'run': _iso(datetime.now(timezone.utc)),
    }


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('output', type=Path)
    parser.add_argument('--hours', type=int, default=48)
    args = parser.parse_args(list(argv) if argv is not None else None)

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hours = [now + timedelta(hours=h) for h in range(args.hours)]
    with tempfile.TemporaryDirectory(prefix='hava81-grid-') as tmp:
        workdir = Path(tmp)
        cams, cams_source = fetch_cams(hours, workdir)
        marine, marine_source = fetch_marine(hours, workdir)
    sources = [s for s in (cams_source, marine_source) if s]
    if not sources:
        print('context-grid: no source succeeded; not publishing', file=sys.stderr)
        return 1

    fields = {**cams, **marine}
    document = build_document(TURKEY_GRID, hours, fields, sources, generated_at=datetime.now(timezone.utc))
    text = json.dumps(document, separators=(',', ':'), allow_nan=False, ensure_ascii=False)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding='utf-8')
    filled = {name: sum(v is not None for v in document['fields'][name]) for name in FIELDS}
    print(f'context-grid: wrote {args.output} ({len(text) / 1024:.0f} KiB); sources={[s["name"] for s in sources]}; filled={filled}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
