/*
 * 획순 자형을 뽑는다 — 「한 획씩 따라 쓰기」 선택 항목의 자료.
 *
 * 이 게임에는 획 **수**만 있었다(Unihan kTotalStrokes). 획이 어디서 시작해
 * 어디로 가는지는 없어서, Make Me A Hanzi 의 `graphics.txt` 에서 가져온다.
 *
 * 처음에는 **중앙선만** 가져다 바탕체 글자 위에 얹었다. 그런데 자형이 다른
 * 글꼴이라 안내선이 먹에서 평균 2.55px 떠 있었고, 획마다 밀어 붙여도 讀·德
 * 처럼 자형 자체가 다른 글자는 남았다. 그래서 **윤곽선까지** 가져와 빈 한자를
 * 그 글꼴로 그린다 — 같은 자료에서 글자와 안내선이 함께 나오니 자로 잰 듯
 * 맞는다(사용자 결정, 세 방식 대조판 확인).
 *
 * 두 가지로 무게를 줄인다.
 *
 *  · **명단 밖은 버린다.** 9천 자 가운데 우리 명단 4,306자만 남긴다.
 *  · **상대 좌표로 다시 적는다.** 원본은 절대 좌표에 공백까지 들어간
 *    `"M 323 706 Q 325 699 328 694"` 꼴이라 숫자마다 세 자리를 쓴다. 상대
 *    좌표로 바꾸고 공백을 걷으면 숫자가 한두 자리로 준다. 좌표는 4단위로
 *    반올림하는데, 자형 상자 1024 를 174px 로 그리므로 4단위 = 0.68px 다.
 *
 * 결과: 원본 30.8MB → 8.3MB(gzip 2.4MB). 그냥 잘라 내기만 했을 때의 절반이다.
 *
 * 쓰는 법:
 *   npm run generate:glyphs -- <graphics.txt 경로>
 *
 * 원본은 저장소에 담지 않는다(30.8MB). 받는 곳과 SHA-256 은
 * THIRD_PARTY_NOTICES.md 에 박아 두었고, 이 스크립트가 받은 파일의 해시를
 * 검사해 다른 판본이 조용히 섞이는 것을 막는다.
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** 2026-08-30 에 받은 makemeahanzi/master 판본. */
const EXPECTED_SHA256 = "a28c478b5178e98f67f510b2d52fde08a69dc664654ef43498253b9b764d46ee";

/** 좌표 반올림 단위. 자형 상자 1024 → 화면 174px 이라 4단위가 0.68px. */
const QUANTUM = 4;

const sourcePath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!sourcePath) {
  throw new Error("사용법: npm run generate:glyphs -- <graphics.txt 경로>");
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

// ── 경로를 상대 좌표로 다시 적기 ────────────────────────────────────
const TOKEN = /[MmLlQqCcZz]|-?\d+(?:\.\d+)?/gu;
const ARITY = { M: 2, L: 2, Q: 4, C: 6 };
const RELATIVE = { M: "m", L: "l", Q: "q", C: "c" };

const snap = (value) => Math.round(Number(value) / QUANTUM) * QUANTUM;

/**
 * 절대 좌표 SVG 경로 → 상대 좌표·공백 없는 경로.
 *
 * 첫 명령이 소문자 `m` 이어도 현재 점이 원점이라 절대와 같다(SVG 규격).
 * 그래서 통째로 상대로 바꿔도 그리는 결과가 달라지지 않는다.
 *
 * **주의.** `q dx1 dy1 dx dy` 에서 제어점과 끝점은 **둘 다 현재 점 기준**이다.
 * 제어점을 원점 삼아 끝점을 이어 재면 안 된다 — 처음에 그렇게 적었다가 빈
 * 한자가 조각조각 부서졌다. `c` 도 세 점 모두 현재 점 기준으로 같다.
 */
function compactPath(path) {
  const tokens = path.match(TOKEN) ?? [];
  const out = [];
  let index = 0;
  let command = "";
  let cursorX = 0;
  let cursorY = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/u.test(token)) {
      command = token.toUpperCase();
      index += 1;
      if (command === "Z") {
        out.push("z");
        continue;
      }
    }
    const arity = ARITY[command] ?? 0;
    if (arity === 0) {
      index += 1;
      continue;
    }
    const values = tokens.slice(index, index + arity).map(snap);
    index += arity;
    const parts = [];
    for (let k = 0; k < arity; k += 2) {
      parts.push(values[k] - cursorX, values[k + 1] - cursorY);
    }
    cursorX = values[arity - 2];
    cursorY = values[arity - 1];
    out.push(RELATIVE[command] + parts.join(","));
  }
  return out.join("");
}

/** 중앙선도 같은 셈으로 — 점렬을 상대 좌표 한 줄로 편다. */
function compactMedian(median) {
  const flat = [];
  let previousX = 0;
  let previousY = 0;
  for (const [x, y] of median) {
    const sx = snap(x);
    const sy = snap(y);
    flat.push(sx - previousX, sy - previousY);
    previousX = sx;
    previousY = sy;
  }
  return flat;
}

const strokes = {};
const medians = {};
let mismatched = 0;

for (const line of source.toString("utf8").split(/\r?\n/u)) {
  if (!line) continue;
  const record = JSON.parse(line);
  const char = record.character;
  if (!roster.has(char) || !Array.isArray(record.medians) || !Array.isArray(record.strokes)) continue;
  if (record.strokes.length !== record.medians.length) {
    mismatched += 1;
    continue;
  }
  strokes[char] = record.strokes.map(compactPath);
  medians[char] = record.medians.map(compactMedian);
}

const covered = Object.keys(medians).length;
const payload = {
  schema: "hanzi-stroke-glyphs-v1",
  scope: "KR 천자문 1000 + JP/CN 보충 명단",
  source: "https://github.com/skishore/makemeahanzi/blob/master/graphics.txt",
  sourceSha256: EXPECTED_SHA256,
  license: "Arphic Public License — THIRD_PARTY_NOTICES.md 참고",
  note: "좌표계 x 0..1024, y -124..900(위가 큼) · 4단위 반올림 · 상대 좌표",
  quantum: QUANTUM,
  roster: roster.size,
  covered,
  strokes,
  medians
};

const outPath = resolve("public/data/hanzi-stroke-glyphs-v1.json");
const text = JSON.stringify(payload);
writeFileSync(outPath, text);

console.log(`명단 ${roster.size}자 가운데 ${covered}자 (${((covered / roster.size) * 100).toFixed(1)}%)`);
if (mismatched > 0) console.log(`윤곽선과 중앙선 개수가 어긋나 버린 글자 ${mismatched}자`);
console.log(`${outPath} · ${(text.length / 1024 / 1024).toFixed(2)}MB · gzip ${(gzipSync(Buffer.from(text), { level: 9 }).length / 1024 / 1024).toFixed(2)}MB`);
