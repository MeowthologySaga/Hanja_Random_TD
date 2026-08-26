import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const learningPath = path.join(root, "src", "data", "learning-readings.json");
const overridesPath = path.join(root, "src", "data", "korean-huneum-overrides.json");
const runtimePath = path.join(root, "src", "data", "cheonjamun-runtime-jaryeongs.json");
const dexPath = path.join(root, "src", "data", "cheonjamun-jaryeong-dex-v1.json");
const shouldWrite = process.argv.includes("--write");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const learning = readJson(learningPath);
const overrides = readJson(overridesPath);
const runtime = readJson(runtimePath);
const dex = readJson(dexPath);

function canonicalHuneum(char) {
  const value = overrides[char] ?? learning.chars?.[char]?.kh ?? "";
  if (!/^[가-힣]+(?: [가-힣]+){1,3}$/u.test(value)) {
    throw new Error(`${char}: 학습용 훈음 형식이 아닙니다: ${value || "(비어 있음)"}`);
  }
  if (/[\p{Script=Han}A-Za-z0-9]/u.test(value) || /(同字|俗字|本字|略字|異體|譌字)/u.test(value)) {
    throw new Error(`${char}: 사전 편찬용 표기가 남아 있습니다: ${value}`);
  }
  return value;
}

function meaningFromHuneum(huneum) {
  return huneum.trim().split(/\s+/u).slice(0, -1).join(" ");
}

if (runtime.schema !== "cheonjamun-runtime-jaryeongs-v1" || runtime.entries?.length !== 1000) {
  throw new Error("Expected 1,000 Cheonjamun runtime entries.");
}
if (dex.schema !== "cheonjamun-jaryeong-dex-v1" || dex.entries?.length !== 1000) {
  throw new Error("Expected 1,000 Cheonjamun dex entries.");
}

let runtimeChanges = 0;
for (const entry of runtime.entries) {
  const huneum = canonicalHuneum(entry.hanja);
  const meaning = meaningFromHuneum(huneum);
  if (entry.huneum !== huneum || entry.meaning !== meaning) runtimeChanges += 1;
  entry.huneum = huneum;
  entry.meaning = meaning;
}

const runtimeByHanja = new Map(runtime.entries.map((entry) => [entry.hanja, entry]));
let dexChanges = 0;
for (const entry of dex.entries) {
  const runtimeEntry = runtimeByHanja.get(entry.hanja);
  if (!runtimeEntry) throw new Error(`${entry.hanja}: 런타임 자령 항목이 없습니다.`);
  const oldHuneum = entry.huneum;
  const oldMeaning = entry.meaning;
  const huneum = runtimeEntry.huneum;
  const meaning = runtimeEntry.meaning;
  if (oldHuneum !== huneum || oldMeaning !== meaning) dexChanges += 1;
  entry.huneum = huneum;
  entry.meaning = meaning;
  if (oldMeaning && oldMeaning !== meaning) {
    for (const key of ["dexText", "appearance"]) {
      if (typeof entry[key] === "string") entry[key] = entry[key].replaceAll(oldMeaning, meaning);
    }
  }
}

const uniqueRuntimeHanja = new Set(runtime.entries.map((entry) => entry.hanja));
const uniqueDexHanja = new Set(dex.entries.map((entry) => entry.hanja));
if (uniqueRuntimeHanja.size !== 1000 || uniqueDexHanja.size !== 1000) {
  throw new Error("Cheonjamun huneum audit requires 1,000 unique runtime and dex glyphs.");
}

if (shouldWrite) {
  writeJson(runtimePath, runtime);
  writeJson(dexPath, dex);
} else if (runtimeChanges > 0 || dexChanges > 0) {
  throw new Error(`훈음 동기화가 필요합니다: runtime ${runtimeChanges}, dex ${dexChanges}`);
}

process.stdout.write(`${JSON.stringify({
  scope: "KR_1000",
  audited: 1000,
  malformed: 0,
  editorialGlosses: 0,
  runtimeChanges,
  dexChanges,
  mode: shouldWrite ? "write" : "check"
}, null, 2)}\n`);
