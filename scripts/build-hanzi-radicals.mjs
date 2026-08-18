import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const irgSourcesPath = process.argv[2] ? resolve(process.argv[2]) : "";

if (!irgSourcesPath) {
  throw new Error("Usage: node scripts/build-hanzi-radicals.mjs <Unihan_IRGSources.txt>");
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

const sourceBuffer = await readFile(irgSourcesPath);
const sourceText = sourceBuffer.toString("utf8");
const radicals = new Map();

for (const line of sourceText.split(/\r?\n/u)) {
  if (!line || line.startsWith("#")) continue;
  const [code, field, rawValue] = line.split("\t");
  if (!code || field !== "kRSUnicode" || !rawValue) continue;
  const char = String.fromCodePoint(Number.parseInt(code.slice(2), 16));
  if (!catalogChars.has(char)) continue;
  const firstValue = rawValue.split(/\s+/u)[0] ?? "";
  const match = firstValue.match(/^(\d{1,3})'*\./u);
  const radical = match ? Number.parseInt(match[1], 10) : 0;
  if (radical >= 1 && radical <= 214) radicals.set(char, radical);
}

const sortedChars = [...catalogChars].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
const chars = {};
for (const char of sortedChars) {
  const radical = radicals.get(char);
  if (radical) chars[char] = radical;
}

const output = {
  version: "17.0.0",
  source: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip#Unihan_IRGSources.txt",
  sha256: createHash("sha256").update(sourceBuffer).digest("hex").toUpperCase(),
  catalogCharacters: catalogChars.size,
  coveredCharacters: Object.keys(chars).length,
  chars
};

const outputPath = resolve(projectRoot, "src/data/hanzi-radicals.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Generated ${output.coveredCharacters}/${output.catalogCharacters} radical entries at ${outputPath}`);
