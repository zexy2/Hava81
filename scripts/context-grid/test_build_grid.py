"""Tests for the pure parts of build_grid.py: regridding, merging and the document shape.

They use small synthetic arrays and need only NumPy; downloading and NetCDF decoding are
kept in separate functions that the tests do not touch.
"""

from __future__ import annotations

import json
import math
import unittest
from datetime import datetime, timedelta, timezone

import numpy as np

import build_grid as bg


class RegridTests(unittest.TestCase):
    def test_block_mean_ignores_nan_and_keeps_empty_cells_empty(self) -> None:
        # Source: 0.125° cells over 40.0–40.5°N × 28.0–28.5°E, 4×4 cells → target 0.25° (2×2).
        src_lat = np.array([40.0625, 40.1875, 40.3125, 40.4375])
        src_lon = np.array([28.0625, 28.1875, 28.3125, 28.4375])
        values = np.array(
            [
                [[1.0, 3.0, np.nan, np.nan], [5.0, 7.0, np.nan, np.nan], [2.0, 2.0, 8.0, np.nan], [2.0, 2.0, np.nan, np.nan]],
            ]
        )
        target = bg.Grid(lat0=40.125, lon0=28.125, step=0.25, rows=2, cols=2)

        out = bg.regrid(values, src_lat, src_lon, target)

        self.assertEqual(out.shape, (1, 2, 2))
        self.assertAlmostEqual(out[0, 0, 0], 4.0)  # mean of 1, 3, 5, 7
        self.assertTrue(math.isnan(out[0, 0, 1]))  # all NaN (land for a sea field)
        self.assertAlmostEqual(out[0, 1, 0], 2.0)
        self.assertAlmostEqual(out[0, 1, 1], 8.0)  # one valid value is enough

    def test_descending_latitude_is_handled(self) -> None:
        src_lat = np.array([40.375, 40.125])
        src_lon = np.array([28.125])
        values = np.array([[[9.0], [1.0]]])
        target = bg.Grid(lat0=40.125, lon0=28.125, step=0.25, rows=2, cols=1)

        out = bg.regrid(values, src_lat, src_lon, target)

        self.assertAlmostEqual(out[0, 0, 0], 1.0)
        self.assertAlmostEqual(out[0, 1, 0], 9.0)

    def test_merge_prefers_any_valid_value(self) -> None:
        a = np.array([[[np.nan, 1.0]]])
        b = np.array([[[2.0, np.nan]]])
        merged = bg.merge_valid([a, b])
        self.assertEqual(merged.tolist(), [[[2.0, 1.0]]])
        both = bg.merge_valid([np.array([[[4.0]]]), np.array([[[6.0]]])])
        self.assertAlmostEqual(both[0, 0, 0], 5.0)


class TimeAxisTests(unittest.TestCase):
    def test_align_to_hours_picks_matching_steps_and_fills_gaps(self) -> None:
        base = datetime(2026, 10, 30, tzinfo=timezone.utc)
        src_times = [base + timedelta(hours=h) for h in (0, 1, 3)]
        values = np.arange(3, dtype=float).reshape(3, 1, 1)
        hours = [base + timedelta(hours=h) for h in range(4)]

        out = bg.align_to_hours(values, src_times, hours)

        self.assertEqual(out[0, 0, 0], 0.0)
        self.assertEqual(out[1, 0, 0], 1.0)
        self.assertTrue(math.isnan(out[2, 0, 0]))
        self.assertEqual(out[3, 0, 0], 2.0)


class DocumentTests(unittest.TestCase):
    def test_document_matches_the_api_contract(self) -> None:
        grid = bg.Grid(lat0=40.0, lon0=28.0, step=0.25, rows=2, cols=3)
        base = datetime(2026, 10, 30, tzinfo=timezone.utc)
        hours = [base + timedelta(hours=h) for h in range(2)]
        dust = np.full((2, 2, 3), 10.04)
        dust[0, 0, 0] = np.nan
        fields = {name: np.full((2, 2, 3), np.nan) for name in bg.FIELDS}
        fields['dust'] = dust

        document = bg.build_document(
            grid,
            hours,
            fields,
            sources=[{'name': 'CAMS European air quality forecast', 'licence': 'CC BY 4.0'}],
            generated_at=base,
        )
        text = json.dumps(document, allow_nan=False)
        parsed = json.loads(text)

        self.assertEqual(parsed['version'], 1)
        self.assertEqual(parsed['grid'], {'lat0': 40.0, 'lon0': 28.0, 'step': 0.25, 'rows': 2, 'cols': 3})
        self.assertEqual(parsed['times'], ['2026-10-30T00:00:00Z', '2026-10-30T01:00:00Z'])
        self.assertEqual(sorted(parsed['fields']), sorted(bg.FIELDS))
        for values in parsed['fields'].values():
            self.assertEqual(len(values), 2 * 2 * 3)
        # Hour-major, then row (south first), then column; NaN becomes null; two decimals.
        self.assertIsNone(parsed['fields']['dust'][0])
        self.assertEqual(parsed['fields']['dust'][1], 10.04)
        self.assertTrue(all(v is None for v in parsed['fields']['waveHeight']))
        self.assertEqual(parsed['units']['dust'], 'µg/m³')
        self.assertEqual(parsed['units']['seaSurfaceTemperature'], '°C')

    def test_turkey_grid_covers_the_country_and_its_seas(self) -> None:
        grid = bg.TURKEY_GRID
        north = grid.lat0 + (grid.rows - 1) * grid.step
        east = grid.lon0 + (grid.cols - 1) * grid.step
        self.assertLessEqual(grid.lat0, 35.8)  # Hatay's southern tip
        self.assertGreaterEqual(north, 42.1)  # Sinop
        self.assertLessEqual(grid.lon0, 25.7)  # Gökçeada
        self.assertGreaterEqual(east, 44.8)  # Iğdır


if __name__ == '__main__':
    unittest.main()
