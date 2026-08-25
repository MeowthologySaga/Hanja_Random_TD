#!/usr/bin/env python3
"""Build crisp single-frame runtime sprites for all 1,000 Cheonjamun entries.

Revision 1 normalized already-processed 128 px preview frames into 256 px runtime
images. Most newly generated creatures therefore went through a destructive
downscale followed by a 2-3x upscale. Revision 2 resolves each generated target
back to its preserved 2x2 raw sheet and performs one high-quality resample.

Production originals and QC states remain untouched. The output is still a
playable preview with approved=0; this script repairs resolution, not approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import statistics
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator

import numpy as np
from PIL import Image, ImageFilter

try:
    from scipy import ndimage
except ImportError:  # pragma: no cover - the fallback still builds, less selectively.
    ndimage = None


# On Windows, Unicode argv values may be decoded through the active console code
# page. Run from the project root and derive all default paths from GetCurrentDirectoryW.
ROOT = Path.cwd().resolve()
DEFAULT_CATALOG_PATH = (
    ROOT
    / "reports"
    / "sprite-production"
    / "20260824-cheonjamun-image-catalog-v1"
    / "cheonjamun-hanja-huneum-wuxing-image-catalog.json"
)
DEFAULT_OUTPUT_DIR = ROOT / "public" / "assets" / "jaryeongs" / "cheonjamun-runtime-v1"
DEFAULT_OUTPUT_DATA = ROOT / "src" / "data" / "cheonjamun-runtime-jaryeongs.json"
DEFAULT_HUNEUM_OVERRIDES = ROOT / "src" / "data" / "korean-huneum-overrides.json"
PRODUCTION_ROOT = ROOT / "asset-production" / "jaryeongs"
VALID_ELEMENTS = {"木", "火", "土", "金", "水"}
QUADRANTS = {
    "TL": (0, 0),
    "TR": (1, 0),
    "BL": (0, 1),
    "BR": (1, 1),
}
OUTPUT_SIZE = 256
CONTENT_LIMIT = 232
QUALITY_REVISION = 2
DESPILL_DEPTH = 2.0


def native_path(path: Path) -> str:
    resolved = str(path.resolve())
    if os.name == "nt" and not resolved.startswith("\\\\?\\"):
        return "\\\\?\\" + resolved
    return resolved


def read_json(path: Path) -> Any:
    with open(native_path(path), "r", encoding="utf-8") as stream:
        return json.load(stream)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with open(native_path(temporary), "w", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    os.replace(native_path(temporary), native_path(path))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(native_path(path), "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def iter_objects(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from iter_objects(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from iter_objects(nested)


@lru_cache(maxsize=1)
def manifest_paths_by_batch() -> dict[str, Path]:
    paths: dict[str, Path] = {}
    if not PRODUCTION_ROOT.is_dir():
        return paths
    for manifest_path in PRODUCTION_ROOT.glob("*/manifest.json"):
        batch_id = manifest_path.parent.name
        try:
            payload = read_json(manifest_path)
            declared = payload.get("batchId") if isinstance(payload, dict) else None
            if isinstance(declared, str) and declared:
                batch_id = declared
        except (OSError, json.JSONDecodeError):
            continue
        paths.setdefault(batch_id, manifest_path)
    return paths


@lru_cache(maxsize=None)
def records_for_batch(batch_id: str) -> tuple[Path | None, dict[str, dict[str, Any]]]:
    manifest_path = manifest_paths_by_batch().get(batch_id)
    if manifest_path is None:
        direct = PRODUCTION_ROOT / batch_id / "manifest.json"
        if direct.is_file():
            manifest_path = direct
    if manifest_path is None or not manifest_path.is_file():
        return None, {}

    records: dict[str, dict[str, Any]] = {}
    payload = read_json(manifest_path)
    for candidate in iter_objects(payload):
        sprite_id = candidate.get("id")
        raw_path = candidate.get("rawPath")
        if not isinstance(sprite_id, str) or not isinstance(raw_path, str):
            continue
        previous = records.get(sprite_id)
        candidate_score = int(isinstance(candidate.get("frameQc"), dict)) + int(isinstance(candidate.get("position"), str))
        previous_score = -1 if previous is None else int(isinstance(previous.get("frameQc"), dict)) + int(isinstance(previous.get("position"), str))
        if candidate_score >= previous_score:
            records[sprite_id] = candidate
    return manifest_path, records


def resolve_raw_source(entry: dict[str, Any]) -> tuple[Path, str] | None:
    batch_id = str(entry.get("batchId", ""))
    manifest_path, records = records_for_batch(batch_id)
    record = records.get(str(entry["id"]))
    if manifest_path is None or record is None:
        return None
    raw_value = str(record.get("rawPath", ""))
    candidates = [manifest_path.parent / raw_value, ROOT / raw_value]
    for candidate in candidates:
        if os.path.isfile(native_path(candidate)):
            position = str(record.get("position") or entry.get("imagePosition") or "FULL")
            return candidate, position
    return None


def crop_quadrant(image: Image.Image, position: str) -> Image.Image:
    if position not in QUADRANTS:
        return image.copy()
    column, row = QUADRANTS[position]
    cell_width = image.width // 2
    cell_height = image.height // 2
    return image.crop(
        (
            column * cell_width,
            row * cell_height,
            (column + 1) * cell_width,
            (row + 1) * cell_height,
        )
    )


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8, copy=True)
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    distance = np.sqrt((rgb[:, :, 0] - 255.0) ** 2 + rgb[:, :, 1] ** 2 + (rgb[:, :, 2] - 255.0) ** 2)
    hard_key = (distance < 100.0) & (alpha > 0)
    rgba[hard_key, 3] = 0

    # Follow the processor's edge-connected near-magenta removal without its
    # per-pixel Python flood fill. Interior pink/purple details are preserved.
    if ndimage is not None:
        candidate = (distance < 150.0) & (alpha > 0)
        seeds = np.zeros(candidate.shape, dtype=bool)
        seeds[0, :] = candidate[0, :]
        seeds[-1, :] = candidate[-1, :]
        seeds[:, 0] |= candidate[:, 0]
        seeds[:, -1] |= candidate[:, -1]
        connected_background = ndimage.binary_propagation(seeds, mask=candidate)
        rgba[connected_background, 3] = 0

    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def despill_magenta_edges(image: Image.Image) -> Image.Image:
    """Convert magenta mixed into antialiased boundary pixels back to alpha.

    Generated source sheets are flattened over #ff00ff.  A binary chroma key
    clears the background but leaves a purple fringe where foreground pixels
    were antialiased against that background.  Applying color-to-alpha only in
    a narrow inner boundary preserves intentional interior purple details.
    """
    if ndimage is None:
        return image

    rgba = np.array(image.convert("RGBA"), dtype=np.uint8, copy=True)
    alpha = rgba[:, :, 3].astype(np.float32) / 255.0
    opaque = alpha > 0.0
    if not opaque.any():
        return image

    boundary_distance = ndimage.distance_transform_edt(opaque)
    rgb = rgba[:, :, :3].astype(np.float32) / 255.0
    spill = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]
    edge_mask = opaque & (boundary_distance <= DESPILL_DEPTH) & (spill > 0.08)
    if not edge_mask.any():
        return image

    color_alpha = np.maximum.reduce(
        (1.0 - rgb[:, :, 0], rgb[:, :, 1], 1.0 - rgb[:, :, 2])
    )
    color_alpha = np.clip(color_alpha, 0.0, 1.0)
    safe_alpha = np.maximum(color_alpha, 1.0 / 255.0)
    key = np.array([1.0, 0.0, 1.0], dtype=np.float32)
    corrected = (rgb - (1.0 - safe_alpha[:, :, None]) * key) / safe_alpha[:, :, None]
    corrected = np.clip(corrected, 0.0, 1.0)

    rgb[edge_mask] = corrected[edge_mask]
    alpha[edge_mask] *= color_alpha[edge_mask]
    rgba[:, :, :3] = np.rint(rgb * 255.0).astype(np.uint8)
    rgba[:, :, 3] = np.rint(alpha * 255.0).astype(np.uint8)
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def keep_largest_component(image: Image.Image) -> tuple[Image.Image, int]:
    alpha = np.array(image.getchannel("A"), dtype=np.uint8)
    mask = alpha > 0
    if not mask.any() or ndimage is None:
        return image, 1 if mask.any() else 0
    labels, count = ndimage.label(mask)
    if count <= 1:
        return image, int(count)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    meaningful = int(np.count_nonzero(sizes >= 24))
    largest = int(sizes.argmax())
    kept = labels == largest
    rgba = np.array(image, dtype=np.uint8, copy=True)
    rgba[~kept] = 0
    return Image.fromarray(rgba, "RGBA"), meaningful


def open_catalog_source(entry: dict[str, Any]) -> Path:
    relative = Path(str(entry["imagePath"]).replace("/", str(Path("/"))))
    source = ROOT / relative
    if not os.path.isfile(native_path(source)):
        raise FileNotFoundError(f"Missing catalog source for {entry['id']}: {source}")
    return source


def source_frame(entry: dict[str, Any]) -> tuple[Image.Image, dict[str, Any]]:
    source_kind = str(entry["sourceKind"])
    direct_raw = resolve_raw_source(entry) if source_kind == "sprite" else None
    if direct_raw is not None:
        source, position = direct_raw
        route = "direct-raw"
    else:
        source = open_catalog_source(entry)
        position = str(entry.get("imagePosition", "FULL"))
        route = "catalog-frame" if source_kind in {"sheet-crop", "raw-crop"} else "processed-fallback"

    with Image.open(native_path(source)) as opened:
        opened.seek(0)
        frame = crop_quadrant(opened.convert("RGBA"), position)
    frame = remove_magenta(frame)
    frame, component_count = keep_largest_component(frame)
    frame = despill_magenta_edges(frame)
    bbox = frame.getchannel("A").getbbox()
    if bbox:
        frame = frame.crop(bbox)
    return frame, {
        "sourceRoute": route,
        "componentCount": component_count,
        "batchId": str(entry.get("batchId", "")),
    }


def normalize_frame(entry: dict[str, Any]) -> tuple[Image.Image, dict[str, Any]]:
    frame, quality = source_frame(entry)
    source_width, source_height = frame.size
    output = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
    scale = 0.0
    output_width = output_height = 0
    if source_width > 0 and source_height > 0:
        # Never enlarge source pixels.  The v1 path first shrank many generated
        # sprites to 128 px and then enlarged them here, which was the visible
        # quality regression this revision is designed to remove.
        scale = min(CONTENT_LIMIT / source_width, CONTENT_LIMIT / source_height, 1.0)
        output_width = max(1, round(source_width * scale))
        output_height = max(1, round(source_height * scale))
        if (output_width, output_height) != frame.size:
            frame = frame.resize((output_width, output_height), Image.Resampling.LANCZOS)
        if scale < 1.0:
            frame = frame.filter(ImageFilter.UnsharpMask(radius=0.65, percent=90, threshold=2))
        output.alpha_composite(frame, ((OUTPUT_SIZE - output_width) // 2, (OUTPUT_SIZE - output_height) // 2))

    quality.update(
        {
            "sourceContentSize": [source_width, source_height],
            "outputContentSize": [output_width, output_height],
            "scale": round(scale, 4),
            "qualityGate": "PASS_NATIVE_OR_DOWNSCALED" if scale <= 1.05 else "FALLBACK_UPSCALED",
        }
    )
    return output, quality


def percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * ratio))]


def build_summary(qualities: list[dict[str, Any]]) -> dict[str, Any]:
    routes = Counter(str(item["sourceRoute"]) for item in qualities)
    gates = Counter(str(item["qualityGate"]) for item in qualities)
    source_long_edges = [float(max(item["sourceContentSize"])) for item in qualities]
    scales = [float(item["scale"]) for item in qualities]
    fallback_ids = [str(item["id"]) for item in qualities if item["sourceRoute"] == "processed-fallback"]
    upscaled_ids = [str(item["id"]) for item in qualities if item["qualityGate"] == "FALLBACK_UPSCALED"]
    return {
        "qualityRevision": QUALITY_REVISION,
        "policy": "preserved-raw-first-single-resample",
        "outputSize": OUTPUT_SIZE,
        "contentLimit": CONTENT_LIMIT,
        "routes": dict(sorted(routes.items())),
        "qualityGates": dict(sorted(gates.items())),
        "sourceLongEdge": {
            "p10": round(percentile(source_long_edges, 0.1), 2),
            "median": round(statistics.median(source_long_edges), 2),
            "p90": round(percentile(source_long_edges, 0.9), 2),
        },
        "scale": {
            "p10": round(percentile(scales, 0.1), 4),
            "median": round(statistics.median(scales), 4),
            "p90": round(percentile(scales, 0.9), 4),
        },
        "processedFallbackCount": len(fallback_ids),
        "processedFallbackIds": fallback_ids,
        "upscaledCount": len(upscaled_ids),
        "upscaledIds": upscaled_ids,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--data-output", type=Path, default=DEFAULT_OUTPUT_DATA)
    parser.add_argument("--manifest-output", type=Path)
    parser.add_argument("--quality-report", type=Path)
    parser.add_argument("--audit-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    catalog_path = args.catalog if args.catalog.is_absolute() else ROOT / args.catalog
    output_dir = args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir
    data_output = args.data_output if args.data_output.is_absolute() else ROOT / args.data_output
    manifest_output = args.manifest_output or output_dir / "manifest.json"
    if not manifest_output.is_absolute():
        manifest_output = ROOT / manifest_output
    quality_report = args.quality_report
    if quality_report is not None and not quality_report.is_absolute():
        quality_report = ROOT / quality_report

    catalog = read_json(catalog_path)
    huneum_overrides = read_json(DEFAULT_HUNEUM_OVERRIDES)
    entries = catalog.get("entries")
    if not isinstance(entries, list) or len(entries) != 1000:
        raise RuntimeError(f"Expected 1,000 catalog entries, received {len(entries or [])}.")

    if not args.audit_only:
        output_dir.mkdir(parents=True, exist_ok=True)
    seen_ids: set[str] = set()
    seen_hanja: set[str] = set()
    runtime_entries: list[dict[str, Any]] = []
    manifest_files: list[dict[str, Any]] = []
    qualities: list[dict[str, Any]] = []

    for entry in entries:
        sprite_id = str(entry["id"])
        hanja = str(entry["hanja"])
        wuxing = str(entry["wuxing"])
        if sprite_id in seen_ids or hanja in seen_hanja:
            raise RuntimeError(f"Duplicate runtime identity: {sprite_id} / {hanja}")
        if wuxing not in VALID_ELEMENTS:
            raise RuntimeError(f"Invalid element for {sprite_id}: {wuxing}")
        seen_ids.add(sprite_id)
        seen_hanja.add(hanja)
        huneum = str(huneum_overrides.get(hanja, entry["huneum"]))
        meaning = huneum.rsplit(" ", 1)[0] if hanja in huneum_overrides else str(entry["meaningKo"])

        normalized, quality = normalize_frame(entry)
        quality = {"id": sprite_id, "hanja": hanja, **quality}
        qualities.append(quality)
        output_name = f"{sprite_id}.png"
        output_path = output_dir / output_name
        asset_path = f"assets/jaryeongs/cheonjamun-runtime-v1/{output_name}"
        digest = "AUDIT_ONLY"
        if not args.audit_only:
            normalized.save(native_path(output_path), format="PNG", compress_level=6)
            digest = sha256(output_path)

        runtime_entries.append(
            {
                "id": sprite_id,
                "hanja": hanja,
                "huneum": huneum,
                "meaning": meaning,
                "wuxing": wuxing,
                "sequence": int(entry["sequence"]),
                "assetPath": asset_path,
                "frameLayout": "single",
                "sourceKind": str(entry["sourceKind"]),
                "structureGate": str(entry["structureGate"]),
                "qc": str(entry["qc"]),
                "integrationStatus": "playable-preview",
                "runtimeQualityRevision": QUALITY_REVISION,
                "runtimeSourceRoute": str(quality["sourceRoute"]),
                "runtimeQualityGate": str(quality["qualityGate"]),
            }
        )
        manifest_files.append(
            {
                "id": sprite_id,
                "hanja": hanja,
                "path": asset_path,
                "sha256": digest,
                "sourceRoute": quality["sourceRoute"],
                "sourceContentSize": quality["sourceContentSize"],
                "outputContentSize": quality["outputContentSize"],
                "scale": quality["scale"],
                "qualityGate": quality["qualityGate"],
            }
        )

    summary = build_summary(qualities)
    runtime_data = {
        "schema": "cheonjamun-runtime-jaryeongs-v1",
        "scope": "KR_1000",
        "total": len(runtime_entries),
        "approved": 0,
        "integrationPolicy": "playable-preview-with-source-qc-preserved",
        "qualityRevision": QUALITY_REVISION,
        "qualityPolicy": "preserved-raw-first-single-resample",
        "qualitySummary": summary,
        "entries": runtime_entries,
    }
    manifest_data = {
        "schema": "cheonjamun-runtime-sprite-manifest-v1",
        "scope": "KR_1000",
        "files": len(manifest_files),
        "approved": 0,
        "integrationStatus": "playable-preview",
        "qualityRevision": QUALITY_REVISION,
        "qualityPolicy": "preserved-raw-first-single-resample",
        "qualitySummary": summary,
        "entries": manifest_files,
    }

    if not args.audit_only:
        write_json(data_output, runtime_data)
        write_json(manifest_output, manifest_data)
    if quality_report is not None:
        write_json(quality_report, {"summary": summary, "entries": qualities})
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
