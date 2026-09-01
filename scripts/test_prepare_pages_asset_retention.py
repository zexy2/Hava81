#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).with_name("prepare-pages-asset-retention.py")
SPEC = importlib.util.spec_from_file_location("pages_retention", SCRIPT)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class PagesAssetRetentionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.dist = root / "dist"
        self.previous = root / "previous"
        (self.dist / "assets").mkdir(parents=True)
        (self.previous / "assets").mkdir(parents=True)
        (self.dist / "assets/current.js").write_text("current", encoding="utf-8")
        self.now = datetime(2026, 9, 1, 13, 0, tzinfo=timezone.utc)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write_previous_manifest(self, generations: list[dict[str, object]]) -> None:
        (self.previous / module.MANIFEST_NAME).write_text(
            json.dumps({"schemaVersion": 1, "generations": generations}), encoding="utf-8"
        )

    def test_retains_recent_previous_generation_and_records_current(self) -> None:
        (self.previous / "assets/previous.js").write_text("previous", encoding="utf-8")
        self.write_previous_manifest(
            [{"publishedAt": "2026-09-01T12:45:00Z", "files": ["assets/previous.js"]}]
        )
        payload = module.retain_assets(self.dist, self.previous, self.now, self.now)
        self.assertEqual((self.dist / "assets/previous.js").read_text(), "previous")
        self.assertEqual(payload["generations"][0]["files"], ["assets/current.js"])
        self.assertEqual(len(payload["generations"]), 2)

    def test_drops_generation_older_than_retention_window(self) -> None:
        (self.previous / "assets/old.js").write_text("old", encoding="utf-8")
        self.write_previous_manifest(
            [{"publishedAt": "2026-09-01T12:29:59Z", "files": ["assets/old.js"]}]
        )
        payload = module.retain_assets(self.dist, self.previous, self.now, self.now)
        self.assertFalse((self.dist / "assets/old.js").exists())
        self.assertEqual(len(payload["generations"]), 1)

    def test_bootstraps_from_existing_assets_when_manifest_is_absent(self) -> None:
        (self.previous / "assets/bootstrap.css").write_text("legacy", encoding="utf-8")
        prior_time = datetime(2026, 9, 1, 12, 50, tzinfo=timezone.utc)
        payload = module.retain_assets(self.dist, self.previous, self.now, prior_time)
        self.assertTrue((self.dist / "assets/bootstrap.css").is_file())
        self.assertEqual(len(payload["generations"]), 2)

    def test_drops_missing_files_from_written_generations(self) -> None:
        self.write_previous_manifest(
            [{"publishedAt": "2026-09-01T12:55:00Z", "files": ["assets/missing.js"]}]
        )
        payload = module.retain_assets(self.dist, self.previous, self.now, self.now)
        self.assertEqual(len(payload["generations"]), 1)

    def test_rejects_retained_source_maps(self) -> None:
        (self.previous / "assets/leak.js.map").write_text("{}", encoding="utf-8")
        self.write_previous_manifest(
            [{"publishedAt": "2026-09-01T12:55:00Z", "files": ["assets/leak.js.map"]}]
        )
        with self.assertRaisesRegex(ValueError, "source maps must not be retained"):
            module.retain_assets(self.dist, self.previous, self.now, self.now)

    def test_rejects_manifest_path_escape(self) -> None:
        self.write_previous_manifest(
            [{"publishedAt": "2026-09-01T12:55:00Z", "files": ["assets/../secret"]}]
        )
        with self.assertRaisesRegex(ValueError, "unsafe retained asset path"):
            module.retain_assets(self.dist, self.previous, self.now, self.now)


if __name__ == "__main__":
    unittest.main()
