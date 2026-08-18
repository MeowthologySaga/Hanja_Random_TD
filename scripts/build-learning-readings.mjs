import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const unihanPath = process.argv[2] ? resolve(process.argv[2]) : "";
const libhangulPath = process.argv[3] ? resolve(process.argv[3]) : "";

if (!unihanPath || !libhangulPath) {
  throw new Error("Usage: node scripts/build-learning-readings.mjs <Unihan_Readings.txt> <libhangul hanja.txt>");
}

const runtimeFiles = [
  "handoff_source/data/KR_1000.prelim.runtime.json",
  "handoff_source/data/JP_2136.prelim.runtime.json",
  "handoff_source/data/CN_3500.prelim.runtime.json"
];

const catalogChars = new Set();
for (const relativePath of runtimeFiles) {
  const runtime = JSON.parse(await readFile(resolve(projectRoot, relativePath), "utf8"));
  for (const entry of runtime.chars) catalogChars.add(entry.c);
}

const sourceBuffer = await readFile(unihanPath);
const sourceText = sourceBuffer.toString("utf8");
const readings = new Map();
const acceptedFields = new Set(["kDefinition", "kHangul", "kJapanese", "kMandarin"]);

for (const line of sourceText.split(/\r?\n/u)) {
  if (!line || line.startsWith("#")) continue;
  const [code, field, rawValue] = line.split("\t");
  if (!code || !field || !rawValue || !acceptedFields.has(field)) continue;
  const char = String.fromCodePoint(Number.parseInt(code.slice(2), 16));
  if (!catalogChars.has(char)) continue;
  const entry = readings.get(char) ?? {};
  if (field === "kHangul") {
    entry.h = [...new Set(rawValue.split(/\s+/u).map((value) => value.replace(/:[0-9A-Z]+$/u, "")))].join(" ");
  } else if (field === "kJapanese") {
    const tokens = rawValue.split(/\s+/u).filter(Boolean);
    entry.jo = tokens.filter((value) => /[\u30A0-\u30FF]/u.test(value)).join(" ");
    entry.jk = tokens.filter((value) => !/[\u30A0-\u30FF]/u.test(value)).join(" ");
  } else if (field === "kMandarin") {
    entry.m = rawValue.split(/\s+/u).slice(0, 3).join(" ");
  } else {
    entry.d = rawValue.replace(/\s+/gu, " ").slice(0, 160);
  }
  readings.set(char, entry);
}

const libhangulBuffer = await readFile(libhangulPath);
const libhangulText = libhangulBuffer.toString("utf8");
let koreanHuneumCount = 0;
for (const line of libhangulText.split(/\r?\n/u)) {
  if (!line || line.startsWith("#")) continue;
  const firstSeparator = line.indexOf(":");
  const secondSeparator = line.indexOf(":", firstSeparator + 1);
  if (firstSeparator < 0 || secondSeparator < 0) continue;
  const reading = line.slice(0, firstSeparator);
  const char = line.slice(firstSeparator + 1, secondSeparator);
  if ([...reading].length !== 1 || [...char].length !== 1 || !catalogChars.has(char)) continue;
  const gloss = line.slice(secondSeparator + 1).replace(/:$/u, "").split(",")[0]?.trim() ?? "";
  if (!gloss) continue;
  const entry = readings.get(char) ?? {};
  if (!entry.kh) {
    entry.kh = gloss.split(/\s+/u).at(-1) === reading ? gloss : `${gloss} ${reading}`;
    koreanHuneumCount += 1;
  }
  readings.set(char, entry);
}

const sortedChars = [...catalogChars].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
const chars = {};
for (const char of sortedChars) {
  const entry = readings.get(char);
  if (entry) chars[char] = entry;
}

const output = {
  version: "17.0.0",
  source: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip",
  sha256: createHash("sha256").update(sourceBuffer).digest("hex").toUpperCase(),
  koreanSource: "https://github.com/libhangul/libhangul/blob/a34aef73378c0992316861bbf13fc914ee7577d9/data/hanja/hanja.txt",
  koreanSha256: createHash("sha256").update(libhangulBuffer).digest("hex").toUpperCase(),
  catalogCharacters: catalogChars.size,
  coveredCharacters: Object.keys(chars).length,
  koreanHuneumCharacters: koreanHuneumCount,
  chars
};

const outputPath = resolve(projectRoot, "src/data/learning-readings.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Generated ${output.coveredCharacters}/${output.catalogCharacters} learning entries at ${outputPath}`);
