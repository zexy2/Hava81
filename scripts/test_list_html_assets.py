#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("list-html-assets.py")
SPEC = importlib.util.spec_from_file_location("list_html_assets", SCRIPT)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class ListHtmlAssetsTests(unittest.TestCase):
    def test_lists_unique_local_script_and_link_assets(self) -> None:
        html = '''
        <link rel="stylesheet" href="/assets/index-abc.css">
        <link rel="modulepreload" href="/assets/chunk-123.js?build=1">
        <script type="module" src="/assets/index-xyz.js"></script>
        <script src="https://example.com/assets/external.js"></script>
        <img src="/assets/not-a-boot-reference.png">
        <script type="module" src="/assets/index-xyz.js"></script>
        '''
        self.assertEqual(
            module.list_html_assets(html),
            ["/assets/chunk-123.js", "/assets/index-abc.css", "/assets/index-xyz.js"],
        )

    def test_ignores_non_asset_and_relative_references(self) -> None:
        html = '<link href="/manifest.json"><script src="assets/relative.js"></script>'
        self.assertEqual(module.list_html_assets(html), [])

    def test_rejects_path_traversal(self) -> None:
        with self.assertRaisesRegex(ValueError, "unsafe generated asset path"):
            module.list_html_assets('<script src="/assets/../secret.js"></script>')


if __name__ == "__main__":
    unittest.main()
