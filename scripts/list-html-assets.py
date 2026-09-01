#!/usr/bin/env python3
"""List same-origin Vite asset paths referenced by a generated HTML shell."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.assets: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        candidate = values.get("src") if tag == "script" else values.get("href") if tag == "link" else None
        if not candidate:
            return
        parsed = urlsplit(candidate)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/assets/"):
            return
        path = PurePosixPath(parsed.path)
        if ".." in path.parts or len(path.parts) < 3:
            raise ValueError(f"unsafe generated asset path: {candidate}")
        self.assets.add(path.as_posix())


def list_html_assets(html: str) -> list[str]:
    parser = AssetParser()
    parser.feed(html)
    parser.close()
    return sorted(parser.assets)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("html", type=Path)
    args = parser.parse_args()
    assets = list_html_assets(args.html.read_text(encoding="utf-8"))
    if not assets:
        raise SystemExit(f"no /assets/ script/link references found in {args.html}")
    print("\n".join(assets))


if __name__ == "__main__":
    main()
