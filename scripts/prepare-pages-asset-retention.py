#!/usr/bin/env python3
"""Carry recent GitHub Pages asset generations into a new dist tree.

GitHub Pages may cache HTML for several minutes while a fresh deployment replaces the
publish branch. Vite HTML points at content-hashed assets, so deleting the previous
assets immediately can make a still-cached HTML document boot into a 404. This tool
retains only recent hashed asset generations, keeping that transition safe without
letting the publish branch grow without bound.
"""
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath

MANIFEST_NAME = ".hava81-asset-retention.json"
RETENTION_MINUTES = 30
MAX_GENERATIONS = 32


def parse_time(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError(f"timestamp must include a timezone: {value}")
    return parsed.astimezone(timezone.utc)


def iso_time(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_asset_path(value: str) -> str:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or len(path.parts) < 2 or path.parts[0] != "assets":
        raise ValueError(f"unsafe retained asset path: {value}")
    return path.as_posix()


def list_assets(root: Path) -> list[str]:
    assets = root / "assets"
    if not assets.is_dir():
        raise FileNotFoundError(f"missing assets directory: {assets}")
    files = sorted(f"assets/{path.relative_to(assets).as_posix()}" for path in assets.rglob("*") if path.is_file())
    source_maps = [path for path in files if path.endswith(".map")]
    if source_maps:
        raise ValueError(f"source maps must not be retained for Pages: {source_maps[0]}")
    return files


def load_previous_generations(previous: Path, previous_published_at: datetime) -> list[dict[str, object]]:
    manifest = previous / MANIFEST_NAME
    if not manifest.is_file():
        files = list_assets(previous) if (previous / "assets").is_dir() else []
        return [{"publishedAt": iso_time(previous_published_at), "files": files}] if files else []

    payload = json.loads(manifest.read_text(encoding="utf-8"))
    generations = payload.get("generations")
    if not isinstance(generations, list):
        raise ValueError("retention manifest generations must be a list")

    normalized: list[dict[str, object]] = []
    for generation in generations:
        if not isinstance(generation, dict):
            raise ValueError("retention manifest generation must be an object")
        published_at = generation.get("publishedAt")
        files = generation.get("files")
        if not isinstance(published_at, str) or not isinstance(files, list):
            raise ValueError("retention manifest generation is missing publishedAt/files")
        parse_time(published_at)
        normalized.append(
            {
                "publishedAt": iso_time(parse_time(published_at)),
                "files": sorted({safe_asset_path(file) for file in files if isinstance(file, str)}),
            }
        )
    return normalized


def retain_assets(dist: Path, previous: Path, now: datetime, previous_published_at: datetime) -> dict[str, object]:
    current_files = list_assets(dist)
    cutoff = now - timedelta(minutes=RETENTION_MINUTES)
    previous_generations = load_previous_generations(previous, previous_published_at)

    recent_previous = [
        generation
        for generation in previous_generations
        if parse_time(str(generation["publishedAt"])) >= cutoff
    ]
    recent_previous.sort(key=lambda generation: parse_time(str(generation["publishedAt"])), reverse=True)
    recent_previous = recent_previous[: MAX_GENERATIONS - 1]

    current_set = set(current_files)
    copied = 0
    missing = 0
    retained_previous: list[dict[str, object]] = []
    for generation in recent_previous:
        available_files: list[str] = []
        for relative in generation["files"]:  # type: ignore[index]
            relative = safe_asset_path(str(relative))
            if relative.endswith(".map"):
                raise ValueError(f"source maps must not be retained for Pages: {relative}")
            if relative in current_set:
                available_files.append(relative)
                continue
            source = previous / relative
            if not source.is_file():
                missing += 1
                continue
            target = dist / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            copied += 1
            available_files.append(relative)
        if available_files:
            retained_previous.append(
                {"publishedAt": generation["publishedAt"], "files": sorted(set(available_files))}
            )

    generations: list[dict[str, object]] = [
        {"publishedAt": iso_time(now), "files": current_files},
        *retained_previous,
    ]
    payload: dict[str, object] = {
        "schemaVersion": 1,
        "retentionMinutes": RETENTION_MINUTES,
        "generatedAt": iso_time(now),
        "generations": generations,
    }
    (dist / MANIFEST_NAME).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"[pages-retention] current={len(current_files)} previous_generations={len(retained_previous)} "
        f"copied={copied} missing={missing}"
    )
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dist", type=Path)
    parser.add_argument("previous", type=Path)
    parser.add_argument("--previous-published-at", required=True)
    parser.add_argument("--now")
    args = parser.parse_args()

    now = parse_time(args.now) if args.now else datetime.now(timezone.utc)
    previous_published_at = parse_time(args.previous_published_at)
    retain_assets(args.dist, args.previous, now, previous_published_at)


if __name__ == "__main__":
    main()
