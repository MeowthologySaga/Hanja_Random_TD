#!/usr/bin/env python3
"""CN 자령 스프라이트 납품 묶음을 검사한다 (v040 · 요청서 v11).

코덱스가 보내기 전에, 그리고 우리가 받은 뒤에 같은 자로 잰다. 통과 못 하면
`scripts/integrate-generated-jaryeongs.ts` 에 넣지 않는다.

사용:
  python scripts/verify-cn-sprite-batch.py --manifest handoff/to-claude/<batch>/manifest.json
  python scripts/verify-cn-sprite-batch.py --manifest ... --report qc-report.json

검사 항목(글자마다):
  size        시트가 정확히 640×640 RGBA (PNG). 옆에 같은 이름의 .webp 가 있어야 한다(런타임은 webp 를 읽는다).
  magenta     알파 > 0 인 픽셀 가운데 자홍(#ff00ff 계열) 잔여 0 — 지난 감사에서 품질불량 55자의 원인.
  frames      네 칸(TL 대기·TR 대기 변주·BL 기술·BR 여분) 모두 그림이 있다.
  margin      칸마다 불투명 영역이 칸 가장자리에서 8px 이상 떨어져 있다(잘림 방지).
  coverage    칸마다 불투명 비율 8~55% — 너무 작으면 전장 48px 에서 사라지고, 너무 크면 잘린 것이다.
  consistency 네 칸의 불투명 영역 높이가 TL 기준 ±25% 안 — 같은 크리처가 같은 크기로 서 있어야 한다.
  identity    manifest 의 id 가 hanja 코드포인트와 맞고(cn-XXXX), 로스터의 오행·단계·유형과 맞다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path.cwd().resolve()
SHEET = 640
FRAME = 320
MARGIN = 8
COVERAGE = (0.08, 0.55)
HEIGHT_TOLERANCE = 0.25
QUADRANTS = {"TL": (0, 0), "TR": (1, 0), "BL": (0, 1), "BR": (1, 1)}


def native_path(path: Path) -> str:
    resolved = str(path.resolve())
    if os.name == "nt" and not resolved.startswith("\\\\?\\"):
        return "\\\\?\\" + resolved
    return resolved


def read_json(path: Path):
    with open(native_path(path), "r", encoding="utf-8") as stream:
        return json.load(stream)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(native_path(path), "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def magenta_count(rgba: np.ndarray) -> int:
    red, green, blue, alpha = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]
    mask = (alpha > 0) & (red > 200) & (blue > 200) & (green < 80)
    return int(mask.sum())


def quadrant_stats(rgba: np.ndarray, column: int, row: int) -> dict:
    frame = rgba[row * FRAME:(row + 1) * FRAME, column * FRAME:(column + 1) * FRAME]
    opaque = frame[..., 3] > 20
    count = int(opaque.sum())
    if count == 0:
        return {"empty": True, "coverage": 0.0, "bbox": None, "height": 0, "margin": None}
    ys, xs = np.where(opaque)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    margin = min(bbox[0], bbox[1], FRAME - 1 - bbox[2], FRAME - 1 - bbox[3])
    return {
        "empty": False,
        "coverage": round(count / (FRAME * FRAME), 4),
        "bbox": bbox,
        "height": bbox[3] - bbox[1] + 1,
        "margin": int(margin),
    }


def check_entry(entry: dict, manifest_dir: Path, roster: dict) -> dict:
    problems: list[str] = []
    hanja = entry.get("hanja", "")
    glyphs = list(hanja)
    if len(glyphs) != 1:
        problems.append(f"hanja 가 한 글자가 아니다: {hanja!r}")
    else:
        expected = f"cn-{ord(glyphs[0]):x}"
        if entry.get("id") != expected:
            problems.append(f"id 불일치 {entry.get('id')} != {expected}")
    source = roster.get(hanja)
    if source is None:
        problems.append("CN_3500 로스터에 없는 글자")
    else:
        if entry.get("wuxing") != source["e"]:
            problems.append(f"오행 불일치 {entry.get('wuxing')} != {source['e']}")
        if entry.get("sourceStage") != source["s"]:
            problems.append(f"단계 불일치 {entry.get('sourceStage')} != {source['s']}")
        if entry.get("sourceType") != source["a"]:
            problems.append(f"유형 불일치 {entry.get('sourceType')} != {source['a']}")
        if list(entry.get("sourceParents", [])) != list(source["p"]):
            problems.append("부모 불일치")

    result = {"id": entry.get("id"), "hanja": hanja, "problems": problems}
    sheet_path = entry.get("sheetPath")
    if not sheet_path:
        problems.append("sheetPath 없음")
        return result
    png = manifest_dir / sheet_path
    if not png.exists():
        problems.append(f"시트 없음: {sheet_path}")
        return result
    webp = png.with_suffix(".webp")
    if not webp.exists():
        problems.append("같은 이름의 .webp 가 없다 — 런타임은 webp 를 읽는다")

    with Image.open(native_path(png)) as opened:
        if opened.size != (SHEET, SHEET):
            problems.append(f"크기 {opened.size[0]}×{opened.size[1]} (기대 640×640)")
            return result
        rgba = np.array(opened.convert("RGBA"))
    magenta = magenta_count(rgba)
    if magenta > 0:
        problems.append(f"자홍 잔여 {magenta}px")
    stats = {name: quadrant_stats(rgba, column, row) for name, (column, row) in QUADRANTS.items()}
    reference = stats["TL"]["height"]
    for name, stat in stats.items():
        if stat["empty"]:
            problems.append(f"{name} 칸이 비었다")
            continue
        if stat["margin"] < MARGIN:
            problems.append(f"{name} 칸 가장자리 여백 {stat['margin']}px < {MARGIN}")
        if not (COVERAGE[0] <= stat["coverage"] <= COVERAGE[1]):
            problems.append(f"{name} 칸 불투명 비율 {stat['coverage']:.0%} (허용 {COVERAGE[0]:.0%}~{COVERAGE[1]:.0%})")
        if reference and abs(stat["height"] - reference) > reference * HEIGHT_TOLERANCE:
            problems.append(f"{name} 칸 높이 {stat['height']} 이 TL {reference} 과 ±25% 밖")
    if webp.exists():
        with Image.open(native_path(webp)) as opened_webp:
            if opened_webp.size != (SHEET, SHEET):
                problems.append("webp 크기가 640×640 이 아니다")
            if opened_webp.mode not in ("RGBA", "LA", "P"):
                problems.append(f"webp 에 알파가 없다 (mode {opened_webp.mode})")
    result.update({
        "magenta": magenta,
        "quadrants": stats,
        "sha256Png": sha256(png),
        "sha256Webp": sha256(webp) if webp.exists() else None,
    })
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--roster", type=Path, default=ROOT / "handoff_source" / "data" / "CN_3500.prelim.runtime.json")
    args = parser.parse_args()

    manifest_path = args.manifest if args.manifest.is_absolute() else ROOT / args.manifest
    manifest = read_json(manifest_path)
    roster = {entry["c"]: entry for entry in read_json(args.roster)["chars"]}
    if manifest.get("namespace") != "CN_3500":
        sys.exit(f"namespace 가 CN_3500 이 아니다: {manifest.get('namespace')}")
    layout = manifest.get("processedLayout") or manifest.get("layout") or {}
    if (layout.get("rows"), layout.get("cols"), layout.get("frameSize"), layout.get("sheetSize")) != (2, 2, FRAME, SHEET):
        sys.exit(f"layout 이 2×2·320·640 이 아니다: {layout}")

    results = []
    seen: set[str] = set()
    for entry in manifest.get("entries", []):
        if entry.get("qc") != "pass":
            continue
        if entry.get("id") in seen:
            results.append({"id": entry.get("id"), "hanja": entry.get("hanja"), "problems": ["id 중복"]})
            continue
        seen.add(entry.get("id"))
        results.append(check_entry(entry, manifest_path.parent, roster))

    failed = [item for item in results if item["problems"]]
    summary = {
        "batchId": manifest.get("batchId"),
        "checked": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "failures": [{"id": item["id"], "hanja": item["hanja"], "problems": item["problems"]} for item in failed],
    }
    if args.report:
        report_path = args.report if args.report.is_absolute() else ROOT / args.report
        with open(native_path(report_path), "w", encoding="utf-8") as stream:
            json.dump({"summary": summary, "results": results}, stream, ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
