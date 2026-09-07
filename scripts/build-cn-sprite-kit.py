#!/usr/bin/env python3
"""CN 3,500 자령 스프라이트 생성 키트를 짓는다 (v040).

두 모드.

  build     로스터·표기·감사 자료를 합쳐 글자별 매니페스트와 브리프 작성용 입력 묶음을 낸다.
  assemble  브리프 작성·검증이 끝난 출력 묶음을 매니페스트에 합치고, 이미지 모델에 바로
            넣을 prompts.jsonl 을 낸다.

입력(모두 저장소 안의 정본):
  handoff_source/data/CN_3500.prelim.runtime.json   글자·오행·단계·유형·부모
  src/data/unified-readings.json                     한어병음·한국 훈음(사전/파생/대체)
  src/data/cn3500-generated-jaryeongs.json           이미 있는 CN 스프라이트(빼는 대상)
  handoff_source/data/KR_1000.prelim.runtime.json    KR 오행(같은 글자의 KR 그림 재사용 판단)
  src/data/korean-easy-meanings.json                 쉬운 뜻(KR 1,000자만)
  docs/design/v037-illustration-audit.json           KR 그림 감사 메모(통과/걸림)
  src/core/hanzi.ts                                  CN 활성 풀(우선순위 P0)

출력: handoff/to-codex/cn3500-sprite-kit-v1/
  manifest.json            글자별 전체 필드(브리프는 assemble 뒤에 채워진다)
  chunks/input/chunk-NN.json   브리프 작성자용 입력(120자씩)
  chunks/output/chunk-NN.json  브리프 작성·검증 결과(작성자가 쓴다)
  prompts.jsonl            assemble 뒤 — 글자당 한 줄, 이미지 모델 입력 프롬프트
  SUMMARY.md               수량 요약

Windows 콘솔 인코딩 때문에 경로는 모두 저장소 루트 기준 상대 경로로 고정한다.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path.cwd().resolve()
KIT_DIR = ROOT / "handoff" / "to-codex" / "cn3500-sprite-kit-v1"
CHUNK_SIZE = 120
PRIORITY_ORDER = ["P0", "P1", "P2", "P3"]
WUXING_ORDER = ["木", "火", "土", "金", "水"]
WUXING_PALETTE = {
    "木": "초록·연두 잎빛(나무·풀·잎·덩굴 소재)",
    "火": "주홍·불꽃빛(불·잉걸·용암·연기 소재)",
    "土": "흙빛·황토·돌빛(흙·바위·도자·모래 소재)",
    "金": "은빛·금빛 금속(쇠·칼날·톱니·종 소재)",
    "水": "파랑·물빛(물·얼음·구름·안개 소재)",
}


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


def asset_id(hanja: str) -> str:
    glyphs = list(hanja)
    if len(glyphs) != 1:
        raise ValueError(f"한 글자가 아니다: {hanja!r}")
    return f"cn-{ord(glyphs[0]):x}"


def split_reading(reading: str) -> tuple[str, str]:
    """'장정 정' → ('장정', '정'). 한 토큰이면 훈=음."""
    tokens = reading.strip().split()
    if not tokens:
        return "", ""
    if len(tokens) == 1:
        return tokens[0], tokens[0]
    return " ".join(tokens[:-1]), tokens[-1]


def active_pool_cn() -> list[str]:
    source = (ROOT / "src" / "core" / "hanzi.ts").read_text(encoding="utf-8")
    match = re.search(r"CN:\s*\[([^\]]*)\]", source)
    if not match:
        raise RuntimeError("hanzi.ts 에서 CN 활성 풀을 못 찾았다")
    return re.findall(r'"([^"]+)"', match.group(1))


def build() -> None:
    cn = read_json(ROOT / "handoff_source" / "data" / "CN_3500.prelim.runtime.json")["chars"]
    kr = read_json(ROOT / "handoff_source" / "data" / "KR_1000.prelim.runtime.json")["chars"]
    readings = read_json(ROOT / "src" / "data" / "unified-readings.json")["entries"]
    generated = read_json(ROOT / "src" / "data" / "cn3500-generated-jaryeongs.json")["entries"]
    easy = read_json(ROOT / "src" / "data" / "korean-easy-meanings.json")["entries"]
    audit = read_json(ROOT / "docs" / "design" / "v037-illustration-audit.json")
    pool = active_pool_cn()

    kr_by_char = {entry["c"]: entry for entry in kr}
    easy_by_char = {entry["hanja"]: entry for entry in easy}
    audit_by_char = {entry["hanja"]: entry for entry in audit}
    generated_chars = {entry["hanja"] for entry in generated}
    pool_set = set(pool)

    entries = []
    for index, source in enumerate(cn):
        hanja = source["c"]
        if hanja in generated_chars:
            continue
        reading = readings[hanja]
        kr_reading = reading["kr"]
        cn_reading = reading["cn"]
        kind = "substitute" if "substitute" in kr_reading else "derived" if kr_reading.get("derived") else "authentic"
        if kind == "substitute":
            hun, eum = "", ""
            gloss = kr_reading.get("sourceMeaning", "")
            gloss_language = "en"
        else:
            hun, eum = split_reading(kr_reading["reading"])
            gloss = hun
            gloss_language = "ko"

        kr_source = kr_by_char.get(hanja)
        kr_audit = audit_by_char.get(hanja)
        kr_sprite = None
        reuse_kr = False
        if kr_source is not None:
            verdicts = list(kr_audit["final"]) if kr_audit else []
            same = kr_source["e"] == source["e"]
            reuse_kr = same and not verdicts and kr_audit is not None
            kr_sprite = {
                "file": f"public/assets/jaryeongs/cheonjamun-runtime-v1/kr-{ord(hanja):x}.webp",
                "wuxing": kr_source["e"],
                "sameWuxing": same,
                "audit": "pass" if kr_audit and not verdicts else "·".join(verdicts) if verdicts else "unknown",
                "note": (kr_audit or {}).get("note", ""),
                "verify": (kr_audit or {}).get("verify", ""),
            }

        easy_entry = easy_by_char.get(hanja)
        if hanja in pool_set:
            priority, reason = "P0", "CN 활성 소환 풀 — 지금 판에 나온다"
        elif source["a"] == "D":
            priority, reason = "P1", "직접 획득(1단계) — 활성 풀을 넓히면 곧바로 소환된다"
        elif source["s"] == 2:
            priority, reason = "P2", "2단계 조합 — 첫 합성에서 만난다"
        else:
            priority, reason = "P3", f"{source['s']}단계 조합 — 후반에 만난다"

        entries.append({
            "id": asset_id(hanja),
            "hanja": hanja,
            "codepoint": f"U+{ord(hanja):04X}",
            "sourceIndex": index,
            "cn": {
                "pinyin": cn_reading.get("pinyin", []),
                "simplified": cn_reading.get("simplified"),
                "traditional": cn_reading.get("traditional"),
            },
            "kr": {
                "reading": kr_reading["reading"],
                "kind": kind,
                "derivedFrom": kr_reading.get("derivedFrom"),
                "hun": hun,
                "eum": eum,
                "sourceMeaningEn": kr_reading.get("sourceMeaning") if kind == "substitute" else None,
            },
            "gloss": gloss,
            "glossLanguage": gloss_language,
            "easy": None if easy_entry is None else {
                "meaning": easy_entry.get("meaning"),
                "plain": easy_entry.get("plainMeaning") or easy_entry.get("short"),
            },
            "wuxing": source["e"],
            "stage": source["s"],
            "type": source["a"],
            "parents": list(source["p"]),
            "readingFlag": source["r"],
            "priority": priority,
            "priorityReason": reason,
            "krSprite": kr_sprite,
            "reuseKr": reuse_kr,
            "homonyms": [],
            "brief": None,
        })

    # 같은 훈을 가진 글자끼리는 서로 다른 장면이어야 한다 — 도감에서 같은 그림이 둘 뜨면 구분이 안 된다.
    by_hun: dict[str, list[str]] = defaultdict(list)
    for entry in entries:
        if entry["glossLanguage"] == "ko" and entry["gloss"]:
            by_hun[entry["gloss"]].append(entry["hanja"])
    for entry in entries:
        siblings = [other for other in by_hun.get(entry["gloss"], []) if other != entry["hanja"]]
        entry["homonyms"] = siblings

    order = {priority: rank for rank, priority in enumerate(PRIORITY_ORDER)}
    wux = {w: rank for rank, w in enumerate(WUXING_ORDER)}
    entries.sort(key=lambda e: (order[e["priority"]], wux[e["wuxing"]], ord(e["hanja"])))

    chunks = [entries[i:i + CHUNK_SIZE] for i in range(0, len(entries), CHUNK_SIZE)]
    for number, chunk in enumerate(chunks, start=1):
        rows = []
        for entry in chunk:
            hom = [
                {"hanja": h, "reading": next(e["kr"]["reading"] for e in entries if e["hanja"] == h)}
                for h in entry["homonyms"]
            ]
            rows.append({
                "id": entry["id"],
                "hanja": entry["hanja"],
                "pinyin": entry["cn"]["pinyin"],
                "krReading": entry["kr"]["reading"],
                "readingKind": entry["kr"]["kind"],
                "gloss": entry["gloss"],
                "glossLanguage": entry["glossLanguage"],
                "easyPlain": None if entry["easy"] is None else entry["easy"]["plain"],
                "wuxing": entry["wuxing"],
                "palette": WUXING_PALETTE[entry["wuxing"]],
                "stage": entry["stage"],
                "priority": entry["priority"],
                "homonyms": hom,
                "krPictureNote": None if entry["krSprite"] is None else {
                    "audit": entry["krSprite"]["audit"],
                    "note": entry["krSprite"]["note"],
                    "sameWuxing": entry["krSprite"]["sameWuxing"],
                },
            })
        write_json(KIT_DIR / "chunks" / "input" / f"chunk-{number:02d}.json", {
            "chunk": number,
            "count": len(rows),
            "rows": rows,
        })
        entry_ids = {e["id"] for e in chunk}
        for entry in entries:
            if entry["id"] in entry_ids:
                entry["chunk"] = number

    manifest = {
        "schema": "cn3500-sprite-kit-v1",
        "namespace": "CN_3500",
        "count": len(entries),
        "chunkSize": CHUNK_SIZE,
        "chunks": len(chunks),
        "deliveryLayout": {"rows": 2, "cols": 2, "frameSize": 320, "sheetSize": 640},
        "entries": entries,
    }
    write_json(KIT_DIR / "manifest.json", manifest)
    write_summary(entries, len(chunks))
    print(json.dumps({
        "entries": len(entries),
        "chunks": len(chunks),
        "priority": dict(Counter(e["priority"] for e in entries)),
        "readingKind": dict(Counter(e["kr"]["kind"] for e in entries)),
        "reuseKr": sum(1 for e in entries if e["reuseKr"]),
        "krOverlap": sum(1 for e in entries if e["krSprite"] is not None),
        "homonymGroups": sum(1 for v in by_hun.values() if len(v) > 1),
    }, ensure_ascii=False))


def write_summary(entries, chunk_count: int) -> None:
    lines = ["# CN 3,500 스프라이트 키트 — 수량", ""]
    lines.append(f"- 생성 대상: **{len(entries)}자** (3,500 − 이미 있는 26)")
    lines.append(f"- 브리프 묶음: {chunk_count}개 × ≤{CHUNK_SIZE}자")
    lines.append("")
    lines.append("| 우선순위 | 글자 수 | 뜻 |")
    lines.append("|---|---:|---|")
    reasons = {}
    for entry in entries:
        reasons.setdefault(entry["priority"], entry["priorityReason"])
    for priority in PRIORITY_ORDER:
        count = sum(1 for e in entries if e["priority"] == priority)
        lines.append(f"| {priority} | {count} | {reasons.get(priority, '')} |")
    lines.append("")
    lines.append("| 오행 | 글자 수 |")
    lines.append("|---|---:|")
    for w in WUXING_ORDER:
        lines.append(f"| {w} | {sum(1 for e in entries if e['wuxing'] == w)} |")
    lines.append("")
    kinds = Counter(e["kr"]["kind"] for e in entries)
    lines.append("| 한국 훈음 출처 | 글자 수 | 브리프에서의 처리 |")
    lines.append("|---|---:|---|")
    lines.append(f"| authentic(사전) | {kinds['authentic']} | 훈을 그대로 장면으로 |")
    lines.append(f"| derived(정자 승계) | {kinds['derived']} | 정자의 훈을 그대로 장면으로 — 도감에는 파생 표시 |")
    lines.append(f"| substitute(영어 뜻) | {kinds['substitute']} | 작성자가 한국어 뜻(glossKo)을 지어 넣고, 도감에는 대체 배지 |")
    lines.append("")
    reuse = sum(1 for e in entries if e["reuseKr"])
    overlap = sum(1 for e in entries if e["krSprite"] is not None)
    lines.append(f"- KR 1,000자와 겹치는 글자 {overlap}자, 그중 오행이 같고 감사 통과라 **KR 그림을 그대로 쓸 수 있는** 글자 {reuse}자(`reuseKr`). 이 {reuse}자를 재사용하면 새로 그릴 글자는 {len(entries) - reuse}자다 — 사용자 결정.")
    (KIT_DIR / "SUMMARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


PROMPT_STYLE = (
    "Single fantasy creature sprite for a hanja tower-defense game, "
    "same art style as the existing set: chunky cartoon creature, bold dark outline (2-3 px at 320 px), "
    "flat cel shading with one soft highlight, front view slightly from above, "
    "creature centered and filling about 70% of the frame, feet on an invisible ground, no drop shadow, "
    "no text, no letters, no hanja glyphs, no UI, no frame border. "
    "Background: solid pure magenta #FF00FF for chroma keying."
)
PROMPT_NEGATIVE = (
    "no realistic rendering, no anime human figure, no thin light outlines, no multiple creatures, "
    "no scenery or landscape, no written characters, no watermark, no gradient background, no shadow on the ground"
)
WUXING_STYLE_EN = {
    "木": "Wood element: green and leaf-green body made of wood, leaves, vines or grass",
    "火": "Fire element: vermilion and flame-orange body made of fire, embers, lava or smoke",
    "土": "Earth element: ochre and stone-brown body made of soil, rock, clay or sand",
    "金": "Metal element: silver and gold body made of metal, blades, gears or bells",
    "水": "Water element: blue and aqua body made of water, ice, cloud or mist",
}


def assemble() -> None:
    manifest_path = KIT_DIR / "manifest.json"
    manifest = read_json(manifest_path)
    by_id = {entry["id"]: entry for entry in manifest["entries"]}
    output_dir = KIT_DIR / "chunks" / "output"
    filled = 0
    problems = []
    # 작성자는 묶음을 조각으로 나눠 쓰고(chunk-NN.partK.json), 남은 글자는 따로 묶여
    # 다시 돌아간다(todo-NNN.json). 그래서 파일 이름에 매이지 않고 폴더 전체를 id 로 합친다.
    for path in sorted(output_dir.glob("*.json")):
        try:
            data = read_json(path)
        except json.JSONDecodeError as error:
            problems.append(f"{path.name}: JSON 깨짐 — {error}")
            continue
        for brief in data.get("briefs", []):
            entry = by_id.get(brief.get("id"))
            if entry is None:
                problems.append(f"{path.name}: 모르는 id {brief.get('id')}")
                continue
            if brief.get("hanja") != entry["hanja"]:
                problems.append(f"{path.name}: {brief.get('id')} 글자 불일치 {brief.get('hanja')} != {entry['hanja']}")
                continue
            if not brief.get("sceneEn"):
                problems.append(f"{path.name}: {brief.get('id')} sceneEn 없음")
                continue
            previous = entry.get("brief") or {}
            merged = {
                key: brief.get(key)
                for key in ("glossKo", "subject", "scene", "mustShow", "mustNot", "sceneEn", "verified", "verifierNote")
            }
            # 검증자가 verified 를 세운 뒤에 작성 파일이 다시 읽히더라도 검증 표시를 잃지 않는다.
            if previous.get("verified") and not merged.get("verified"):
                merged["verified"] = True
                merged["verifierNote"] = merged.get("verifierNote") or previous.get("verifierNote")
            entry["brief"] = merged
            filled += 1
    missing_chunks = sorted({entry.get("chunk") for entry in manifest["entries"] if not entry.get("brief")})
    write_json(manifest_path, manifest)

    prompts_path = KIT_DIR / "prompts.jsonl"
    with prompts_path.open("w", encoding="utf-8", newline="\n") as handle:
        for entry in manifest["entries"]:
            brief = entry.get("brief")
            if not brief or not brief.get("sceneEn"):
                continue
            gloss = brief.get("glossKo") or entry["gloss"]
            prompt = " ".join([
                PROMPT_STYLE,
                WUXING_STYLE_EN[entry["wuxing"]] + ".",
                f"Subject: {brief.get('subject', '')}.",
                f"Scene: {brief['sceneEn']}",
                f"Must show: {brief.get('mustShow', '')}." if brief.get("mustShow") else "",
                f"Avoid: {brief.get('mustNot', '')}." if brief.get("mustNot") else "",
                "Output a 2x2 sprite sheet, 640x640, four 320x320 frames of the SAME creature: "
                "top-left idle stance, top-right idle variant (breathing/blink, same pose), "
                "bottom-left attack or ability pose, bottom-right attack follow-through. "
                "Same size, same position, same colors in every frame.",
                PROMPT_NEGATIVE + ".",
            ]).replace("  ", " ").strip()
            handle.write(json.dumps({
                "id": entry["id"],
                "hanja": entry["hanja"],
                "gloss": gloss,
                "krReading": entry["kr"]["reading"],
                "readingKind": entry["kr"]["kind"],
                "wuxing": entry["wuxing"],
                "priority": entry["priority"],
                "reuseKr": entry["reuseKr"],
                "sceneKo": brief.get("scene"),
                "prompt": prompt,
            }, ensure_ascii=False) + "\n")

    summary = {
        "filled": filled,
        "total": manifest["count"],
        "missingChunks": missing_chunks,
        "problems": problems[:20],
        "problemCount": len(problems),
        "unverified": sum(1 for e in manifest["entries"] if e.get("brief") and not e["brief"].get("verified")),
    }
    print(json.dumps(summary, ensure_ascii=False))
    if problems:
        sys.exit(1)


TODO_SIZE = 60


def todo(size: int) -> None:
    """브리프가 아직 없는 글자를 작은 묶음으로 다시 낸다.

    한 묶음 120자는 작성자 하나가 감당하기엔 길어서, 도중에 끊기면 그 묶음이 통째로
    빈다. 남은 글자만 60자씩 다시 묶어 돌리면 끊겨도 잃는 것이 한 묶음뿐이다.
    """
    manifest_path = KIT_DIR / "manifest.json"
    manifest = read_json(manifest_path)
    have = set()
    output_dir = KIT_DIR / "chunks" / "output"
    for path in sorted(output_dir.glob("*.json")):
        try:
            data = read_json(path)
        except json.JSONDecodeError:
            continue
        for brief in data.get("briefs", []):
            if brief.get("sceneEn"):
                have.add(brief.get("id"))

    by_id = {entry["id"]: entry for entry in manifest["entries"]}
    remaining = [entry for entry in manifest["entries"] if entry["id"] not in have]
    todo_dir = KIT_DIR / "chunks" / "todo"
    if todo_dir.exists():
        for stale in todo_dir.glob("*.json"):
            stale.unlink()
    batches = [remaining[i:i + size] for i in range(0, len(remaining), size)]
    for number, batch in enumerate(batches, start=1):
        rows = []
        for entry in batch:
            rows.append({
                "id": entry["id"],
                "hanja": entry["hanja"],
                "pinyin": entry["cn"]["pinyin"],
                "krReading": entry["kr"]["reading"],
                "readingKind": entry["kr"]["kind"],
                "gloss": entry["gloss"],
                "glossLanguage": entry["glossLanguage"],
                "easyPlain": None if entry["easy"] is None else entry["easy"]["plain"],
                "wuxing": entry["wuxing"],
                "palette": WUXING_PALETTE[entry["wuxing"]],
                "stage": entry["stage"],
                "priority": entry["priority"],
                "homonyms": [
                    {"hanja": h, "reading": by_id[asset_id(h)]["kr"]["reading"] if asset_id(h) in by_id else ""}
                    for h in entry["homonyms"]
                ],
                "krPictureNote": None if entry["krSprite"] is None else {
                    "audit": entry["krSprite"]["audit"],
                    "note": entry["krSprite"]["note"],
                    "sameWuxing": entry["krSprite"]["sameWuxing"],
                },
            })
        write_json(todo_dir / f"todo-{number:03d}.json", {"todo": number, "count": len(rows), "rows": rows})
    print(json.dumps({
        "written": len(have),
        "remaining": len(remaining),
        "batches": len(batches),
        "size": size,
        "byPriority": dict(Counter(e["priority"] for e in remaining)),
    }, ensure_ascii=False))


# 브리프에서 기계로 잡을 수 있는 냄새. 사람 눈 검증(반박 검증자)을 대신하지는 못하고,
# 검증이 놓친 것을 뒤에서 한 번 더 훑는 자다.
GLYPH_WORDS = re.compile(r"(hanja|kanji|chinese character|letter|letters|glyph|glyphs|word|words|text|caption|label|inscription|writing)", re.I)
ETYMOLOGY_WORDS = re.compile(r"어원|부수|자형|글자 모양|획으로|부품")


def lint() -> None:
    """쓰인 브리프를 훑어 되풀이되는 실패 유형을 센다."""
    manifest = read_json(KIT_DIR / "manifest.json")
    briefs = {}
    output_dir = KIT_DIR / "chunks" / "output"
    for path in sorted(output_dir.glob("*.json")):
        try:
            data = read_json(path)
        except json.JSONDecodeError as error:
            print(f"JSON 깨짐: {path.name} — {error}")
            continue
        for brief in data.get("briefs", []):
            if brief.get("id"):
                briefs[brief["id"]] = brief

    by_id = {entry["id"]: entry for entry in manifest["entries"]}
    findings = defaultdict(list)
    seen_scene: dict[str, str] = {}
    for asset, brief in briefs.items():
        entry = by_id.get(asset)
        label = f"{brief.get('hanja')}({asset})"
        for field in ("glossKo", "subject", "scene", "mustShow", "sceneEn"):
            if not (brief.get(field) or "").strip():
                findings["빈 필드"].append(f"{label} {field}")
        scene_en = brief.get("sceneEn") or ""
        if GLYPH_WORDS.search(scene_en):
            findings["sceneEn 에 글자·문자 지시"].append(f"{label} {GLYPH_WORDS.search(scene_en).group(0)}")
        if ETYMOLOGY_WORDS.search((brief.get("scene") or "") + (brief.get("mustShow") or "")):
            findings["어원·부품 언급"].append(label)
        if not brief.get("verified"):
            findings["검증 안 됨"].append(label)
        key = (scene_en or "").strip().lower()
        if key and key in seen_scene:
            findings["같은 장면 중복"].append(f"{label} = {seen_scene[key]}")
        elif key:
            seen_scene[key] = label
        if entry is not None:
            for sibling in entry["homonyms"]:
                other = briefs.get(asset_id(sibling))
                if other and (other.get("mustShow") or "").strip() == (brief.get("mustShow") or "").strip():
                    findings["같은 훈 글자와 단서가 같다"].append(f"{label} = {sibling}")

    print(json.dumps({
        "briefs": len(briefs),
        "of": manifest["count"],
        "findings": {key: len(value) for key, value in sorted(findings.items())},
    }, ensure_ascii=False))
    for key, value in sorted(findings.items()):
        if key == "검증 안 됨":
            continue
        for item in value[:12]:
            print(f"  [{key}] {item}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["build", "todo", "assemble", "lint"], nargs="?", default="build")
    parser.add_argument("--size", type=int, default=TODO_SIZE)
    args = parser.parse_args()
    if args.mode == "build":
        build()
    elif args.mode == "todo":
        todo(args.size)
    elif args.mode == "lint":
        lint()
    else:
        assemble()


if __name__ == "__main__":
    main()
