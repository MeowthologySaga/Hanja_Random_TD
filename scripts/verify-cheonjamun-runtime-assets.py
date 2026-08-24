#!/usr/bin/env python3
"""Verify the 1,000-image Cheonjamun runtime sprite set and its manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path.cwd().resolve()
DEFAULT_RUNTIME_DIR = ROOT / "public" / "assets" / "jaryeongs" / "cheonjamun-runtime-v1"
DEFAULT_DATA = ROOT / "src" / "data" / "cheonjamun-runtime-jaryeongs.json"


def native_path(path: Path) -> str:
    resolved = str(path.resolve())
    if os.name == "nt" and not resolved.startswith("\\\\?\\"):
        return "\\\\?\\" + resolved
    return resolved


def read_json(path: Path) -> Any:
    with open(native_path(path), "r", encoding="utf-8") as stream:
        return json.load(stream)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(native_path(path), "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def resolve(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir", type=Path, default=DEFAULT_RUNTIME_DIR)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--manifest", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    runtime_dir = resolve(args.runtime_dir)
    data_path = resolve(args.data)
    manifest_path = resolve(args.manifest) if args.manifest else runtime_dir / "manifest.json"
    data = read_json(data_path)
    manifest = read_json(manifest_path)

    errors: list[str] = []
    if data.get("total") != 1000 or data.get("approved") != 0:
        errors.append("runtime data must preserve total=1000 and approved=0")
    if manifest.get("files") != 1000 or manifest.get("approved") != 0:
        errors.append("manifest must preserve files=1000 and approved=0")
    if data.get("qualityRevision") != 2 or manifest.get("qualityRevision") != 2:
        errors.append("runtime data and manifest must both use qualityRevision=2")

    data_entries = data.get("entries", [])
    manifest_entries = manifest.get("entries", [])
    data_by_id = {entry.get("id"): entry for entry in data_entries}
    if len(data_entries) != 1000 or len(data_by_id) != 1000:
        errors.append("runtime data must contain 1,000 unique ids")
    if len(manifest_entries) != 1000 or len({entry.get("id") for entry in manifest_entries}) != 1000:
        errors.append("manifest must contain 1,000 unique ids")

    routes: Counter[str] = Counter()
    gates: Counter[str] = Counter()
    smallest_margin = 256
    checked = 0
    for entry in manifest_entries:
        sprite_id = str(entry.get("id", ""))
        runtime_entry = data_by_id.get(sprite_id)
        if runtime_entry is None:
            errors.append(f"{sprite_id}: missing runtime data entry")
            continue
        if runtime_entry.get("runtimeSourceRoute") != entry.get("sourceRoute"):
            errors.append(f"{sprite_id}: source route mismatch")
        if runtime_entry.get("runtimeQualityGate") != entry.get("qualityGate"):
            errors.append(f"{sprite_id}: quality gate mismatch")
        if float(entry.get("scale", 2.0)) > 1.0:
            errors.append(f"{sprite_id}: forbidden upscale {entry.get('scale')}")

        asset_path = runtime_dir / f"{sprite_id}.png"
        if not asset_path.is_file():
            errors.append(f"{sprite_id}: missing PNG")
            continue
        if sha256(asset_path) != entry.get("sha256"):
            errors.append(f"{sprite_id}: SHA-256 mismatch")
            continue

        with Image.open(native_path(asset_path)) as image:
            if image.format != "PNG" or image.size != (256, 256) or image.mode != "RGBA":
                errors.append(f"{sprite_id}: expected 256x256 RGBA PNG, got {image.format} {image.size} {image.mode}")
                continue
            bbox = image.getchannel("A").getbbox()
            if bbox is None:
                errors.append(f"{sprite_id}: empty alpha")
                continue
            left, top, right, bottom = bbox
            margin = min(left, top, 256 - right, 256 - bottom)
            smallest_margin = min(smallest_margin, margin)
            if margin < 10:
                errors.append(f"{sprite_id}: unsafe canvas margin {margin}px")

        routes[str(entry.get("sourceRoute"))] += 1
        gates[str(entry.get("qualityGate"))] += 1
        checked += 1

    png_count = len(list(runtime_dir.glob("kr-*.png")))
    if png_count != 1000:
        errors.append(f"runtime directory contains {png_count} kr-*.png files instead of 1,000")

    summary = {
        "checked": checked,
        "pngCount": png_count,
        "routes": dict(sorted(routes.items())),
        "qualityGates": dict(sorted(gates.items())),
        "smallestCanvasMargin": smallest_margin,
        "errors": errors,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
