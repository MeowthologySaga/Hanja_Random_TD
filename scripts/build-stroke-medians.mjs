/*
 * 획순 중앙선을 뽑는다 — 「한 획씩 따라 쓰기」 선택 항목의 자료.
 *
 * 이 게임에는 획 **수**만 있었다(Unihan kTotalStrokes). 획을 하나씩 짚어
 * 주려면 획이 지나는 길이 있어야 하는데, 그건 Unihan 에 없다.
 *
 * 그래서 Make Me A Hanzi 의 `graphics.txt` 에서 **중앙선(median)** 만 가져온다.
 * 그 파일에는 획의 윤곽선(strokes)과 중앙선(medians)이 함께 들어 있는데,
 * 따라 쓰기에 필요한 건 「이 획이 어디서 시작해 어디로 가는가」뿐이라 윤곽선은
 * 버린다. 30.8MB 가운데 우리 명단 몫의 중앙선만 남기면 한 자리 수 MB 로 준다.
 *
 * 좌표는 원본 그대로 두되(가로 0..1024, 세로 -124..900, **위로 갈수록 큼**)
 * 정수로 반올림한다. 화면에 올릴 때 뒤집는 일은 쓰는 쪽이 한다 —
 * 여기서 뒤집어 두면 원본과 대조할 때 값이 안 맞아 헷갈린다.
 *
 * 쓰는 법:
 *   npm run generate:medians -- <graphics.txt 경로>
 *
 * 원본은 저장소에 담지 않는다(30.8MB). 받는 곳과 SHA-256 은
 * THIRD_PARTY_NOTICES.md 에 박아 두었고, 이 스크립트가 받은 파일의 해시를
 * 검사해 다른 판본이 조용히 섞이는 것을 막는다.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** 2026-08-30 에 받은 makemeahanzi/master 판본. */
const EXPECTED_SHA256 = "a28c478b5178e98f67f510b2d52fde08a69dc664654ef43498253b9b764d46ee";

const sourcePath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!sourcePath) {
  throw new Error("사용법: npm run generate:medians -- <graphics.txt 경로>");
}

const source = readFileSync(sourcePath);
const actualHash = createHash("sha256").update(source).digest("hex");
if (actualHash !== EXPECTED_SHA256) {
  throw new Error(
    `graphics.txt SHA-256 불일치\n  받음: ${actualHash}\n  기대: ${EXPECTED_SHA256}\n` +
      "판본이 바뀌었다면 THIRD_PARTY_NOTICES.md 와 이 상수를 함께 고쳐라."
  );
}

// ── 우리 명단 모으기 ────────────────────────────────────────────────
const roster = new Set();

const runtime = JSON.parse(readFileSync(resolve("src/data/cheonjamun-runtime-jaryeongs.json"), "utf8"));
for (const entry of runtime.entries) roster.add(entry.hanja);

const supplement = JSON.parse(readFileSync(resolve("src/data/hanzi-strokes-supplement.json"), "utf8"));
for (const char of Object.keys(supplement.strokes)) roster.add(char);

const strokeCounts = new Map(Object.entries(supplement.strokes));
const cheonjamun = JSON.parse(readFileSync(resolve("src/data/cheonjamun-strokes.json"), "utf8"));
for (const bin of cheonjamun.bins ?? []) {
  for (const [char, count] of Object.entries(bin.strokes ?? {})) strokeCounts.set(char, count);
}

// ── 중앙선 추리기 ───────────────────────────────────────────────────
const medians = {};
let mismatched = 0;

for (const line of source.toString("utf8").split(/\r?\n/u)) {
  if (!line) continue;
  const record = JSON.parse(line);
  const char = record.character;
  if (!roster.has(char) || !Array.isArray(record.medians)) continue;

  /*
   * 획 수가 Unihan 과 어긋나는 글자가 있다. 자형이 다른 판본에서 온
   * 그림이라 그렇다 — 버리지 않고 세어만 둔다. 따라 쓰기는 그림이 가진
   * 획 수를 그대로 따르는 편이 화면과 안 어긋난다.
   */
  const known = strokeCounts.get(char);
  if (known !== undefined && known !== record.medians.length) mismatched += 1;

  medians[char] = record.medians.map((stroke) => stroke.map(([x, y]) => [Math.round(x), Math.round(y)]));
}

const covered = Object.keys(medians).length;
const output = {
  schema: "hanzi-stroke-medians-v1",
  scope: "KR 천자문 1000 + JP/CN 보충 명단",
  source: "https://github.com/skishore/makemeahanzi/blob/master/graphics.txt",
  sourceSha256: EXPECTED_SHA256,
  license: "Arphic Public License — THIRD_PARTY_NOTICES.md 참고",
  note: "원본 좌표계 그대로: x 0..1024, y -124..900(위로 갈수록 큼)",
  roster: roster.size,
  covered,
  medians
};

const outPath = resolve("public/data/hanzi-stroke-medians-v1.json");
writeFileSync(outPath, JSON.stringify(output));
const bytes = readFileSync(outPath).length;

console.log(`명단 ${roster.size}자 가운데 ${covered}자 (${((covered / roster.size) * 100).toFixed(1)}%)`);
console.log(`획 수가 Unihan 과 어긋나는 글자 ${mismatched}자 — 그림 쪽 획 수를 따른다`);
console.log(`${outPath} · ${(bytes / 1024 / 1024).toFixed(2)}MB`);
