import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Wuxing = "木" | "火" | "土" | "金" | "水";

interface SourceCharacter {
  c: string;
  s: number;
  e: Wuxing;
  a: string;
  p: string[];
  r: number;
}

interface SourceData {
  chars: SourceCharacter[];
}

interface ManifestEntry {
  id: string;
  hanja: string;
  reading: string;
  meaning?: string;
  wuxing: Wuxing;
  sourceType: string;
  sourceStage: number;
  sourceParents: string[];
  sourceReadingFlag?: number;
  sourceIndex?: number;
  sheetPath?: string;
  qc: string;
}

interface BatchManifest {
  namespace: string;
  batchId: string;
  processedLayout?: Layout;
  layout?: Layout;
  entries: ManifestEntry[];
}

interface Layout {
  rows: number;
  cols: number;
  frameSize: number;
  sheetSize: number;
}

export interface GeneratedEntry {
  id: string;
  hanja: string;
  reading: string;
  meaning: string;
  wuxing: Wuxing;
  qc: "pass";
  sourceBatch: string;
  sourceIndex: number;
  sourceType: string;
  sourceStage: number;
  sourceParents: string[];
}

interface GeneratedData {
  version: string;
  namespace: "CN_3500";
  sourceBatch?: string;
  sourceBatches?: string[];
  layout: Layout;
  entries: GeneratedEntry[];
}

interface PlannedAsset {
  source: string;
  destination: string;
  sha256: string;
  entry: GeneratedEntry;
  copy: boolean;
}

const EXPECTED_LAYOUT: Layout = { rows: 2, cols: 2, frameSize: 320, sheetSize: 640 };

function fail(message: string): never {
  throw new Error(message);
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertLayout(layout: Layout | undefined): void {
  if (!layout) fail("Manifest is missing processedLayout/layout");
  for (const key of Object.keys(EXPECTED_LAYOUT) as Array<keyof Layout>) {
    if (layout[key] !== EXPECTED_LAYOUT[key]) {
      fail(`Invalid layout ${key}: expected ${EXPECTED_LAYOUT[key]}, got ${layout[key]}`);
    }
  }
}

export function expectedAssetId(hanja: string): string {
  const glyphs = [...hanja];
  if (glyphs.length !== 1) fail(`Expected one Unicode character, got ${JSON.stringify(hanja)}`);
  return `cn-${glyphs[0].codePointAt(0)!.toString(16)}`;
}

export function splitLearningReading(value: string): { reading: string; meaning: string } {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { reading: "", meaning: "" };
  if (tokens.length === 1) return { reading: tokens[0], meaning: tokens[0] };
  return { reading: tokens.at(-1)!, meaning: tokens.slice(0, -1).join("·") };
}

function validateEntry(entry: ManifestEntry, source: SourceCharacter, batchId: string): GeneratedEntry {
  const expectedId = expectedAssetId(entry.hanja);
  if (entry.id !== expectedId) fail(`${entry.hanja}: id mismatch (${entry.id} != ${expectedId})`);
  if (source.e !== entry.wuxing) fail(`${entry.hanja}: wuxing mismatch (${entry.wuxing} != ${source.e})`);
  if (source.a !== entry.sourceType) fail(`${entry.hanja}: sourceType mismatch (${entry.sourceType} != ${source.a})`);
  if (source.s !== entry.sourceStage) fail(`${entry.hanja}: sourceStage mismatch (${entry.sourceStage} != ${source.s})`);
  if (!sameArray(source.p, entry.sourceParents)) fail(`${entry.hanja}: sourceParents mismatch`);
  if (entry.sourceReadingFlag !== undefined && entry.sourceReadingFlag !== source.r) {
    fail(`${entry.hanja}: sourceReadingFlag mismatch (${entry.sourceReadingFlag} != ${source.r})`);
  }
  const learning = splitLearningReading(entry.reading);
  return {
    id: entry.id,
    hanja: entry.hanja,
    reading: learning.reading,
    meaning: entry.meaning?.trim() || learning.meaning,
    wuxing: entry.wuxing,
    qc: "pass",
    sourceBatch: batchId,
    sourceIndex: entry.sourceIndex ?? -1,
    sourceType: entry.sourceType,
    sourceStage: entry.sourceStage,
    sourceParents: [...entry.sourceParents]
  };
}

export function validatePassEntries(
  manifest: BatchManifest,
  sourceData: SourceData
): GeneratedEntry[] {
  if (manifest.namespace !== "CN_3500") fail(`Unsupported namespace: ${manifest.namespace}`);
  if (!manifest.batchId?.trim()) fail("Manifest is missing batchId");
  if (!Array.isArray(manifest.entries)) fail("Manifest entries must be an array");
  assertLayout(manifest.processedLayout ?? manifest.layout);

  const sourceByChar = new Map(sourceData.chars.map((entry, index) => [entry.c, { ...entry, sourceIndex: index }]));
  const passEntries = manifest.entries.filter((entry) => entry.qc === "pass");
  if (passEntries.length === 0) fail("Manifest has no QC-passed entries");

  const seenIds = new Set<string>();
  const seenCharacters = new Set<string>();
  return passEntries.map((entry) => {
    if (seenIds.has(entry.id)) fail(`Duplicate manifest id: ${entry.id}`);
    if (seenCharacters.has(entry.hanja)) fail(`Duplicate manifest hanja: ${entry.hanja}`);
    seenIds.add(entry.id);
    seenCharacters.add(entry.hanja);
    const source = sourceByChar.get(entry.hanja);
    if (!source) fail(`${entry.hanja}: missing from CN_3500 source`);
    const validated = validateEntry(entry, source, manifest.batchId);
    validated.sourceIndex = source.sourceIndex;
    return validated;
  });
}

export function mergeGeneratedData(current: GeneratedData, additions: GeneratedEntry[]): GeneratedData {
  const byId = new Map(current.entries.map((entry) => [entry.id, entry]));
  const idByCharacter = new Map(current.entries.map((entry) => [entry.hanja, entry.id]));
  for (const addition of additions) {
    const characterOwner = idByCharacter.get(addition.hanja);
    if (characterOwner && characterOwner !== addition.id) {
      fail(`${addition.hanja}: existing generated id conflict (${characterOwner} != ${addition.id})`);
    }
    const existing = byId.get(addition.id);
    if (existing && (existing.hanja !== addition.hanja || existing.wuxing !== addition.wuxing)) {
      fail(`${addition.id}: existing generated entry conflicts with manifest`);
    }
    byId.set(addition.id, { ...existing, ...addition });
    idByCharacter.set(addition.hanja, addition.id);
  }

  const legacyBatches = current.sourceBatch ? [current.sourceBatch] : [];
  const sourceBatches = [...new Set([...(current.sourceBatches ?? legacyBatches), ...additions.map((entry) => entry.sourceBatch)])];
  return {
    version: "1.1.0",
    namespace: "CN_3500",
    sourceBatches,
    layout: { ...EXPECTED_LAYOUT },
    entries: [...byId.values()].sort((left, right) => left.sourceIndex - right.sourceIndex)
  };
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function pngDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const buffer = await readFile(filePath);
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature) {
    fail(`Not a PNG: ${filePath}`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function existingSha(filePath: string): Promise<string | null> {
  try {
    await stat(filePath);
    return sha256(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function parseArgs(argv: string[]): { manifestPath: string; dryRun: boolean; replace: boolean } {
  let manifestPath = "";
  let dryRun = false;
  let replace = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") manifestPath = argv[++index] ?? "";
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--replace") replace = true;
    else fail(`Unknown argument: ${arg}`);
  }
  if (!manifestPath) fail("Usage: tsx scripts/integrate-generated-jaryeongs.ts --manifest <path> [--dry-run] [--replace]");
  return { manifestPath, dryRun, replace };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(root, args.manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const sourcePath = path.join(root, "handoff_source", "data", "CN_3500.prelim.runtime.json");
  const dataPath = path.join(root, "src", "data", "cn3500-generated-jaryeongs.json");
  const assetRoot = path.join(root, "public", "assets", "jaryeongs");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BatchManifest;
  const sourceData = JSON.parse(await readFile(sourcePath, "utf8")) as SourceData;
  const current = JSON.parse(await readFile(dataPath, "utf8")) as GeneratedData;
  const sourceByCharacter = new Map(sourceData.chars.map((entry, index) => [entry.c, { ...entry, sourceIndex: index }]));
  current.entries = current.entries.map((entry) => {
    const source = sourceByCharacter.get(entry.hanja);
    if (!source) fail(`${entry.hanja}: existing generated entry is missing from CN_3500 source`);
    return {
      ...entry,
      sourceBatch: entry.sourceBatch ?? current.sourceBatch ?? "legacy",
      sourceIndex: entry.sourceIndex ?? source.sourceIndex,
      sourceType: entry.sourceType ?? source.a,
      sourceStage: entry.sourceStage ?? source.s,
      sourceParents: entry.sourceParents ?? [...source.p]
    };
  });
  const additions = validatePassEntries(manifest, sourceData);
  const manifestById = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  const plan: PlannedAsset[] = [];

  for (const addition of additions) {
    const manifestEntry = manifestById.get(addition.id)!;
    if (!manifestEntry.sheetPath) fail(`${addition.hanja}: QC pass entry is missing sheetPath`);
    const source = path.resolve(manifestDir, manifestEntry.sheetPath);
    if (!isWithin(manifestDir, source)) fail(`${addition.hanja}: sheetPath escapes manifest directory`);
    const dimensions = await pngDimensions(source);
    if (dimensions.width !== 640 || dimensions.height !== 640) {
      fail(`${addition.hanja}: expected 640x640 PNG, got ${dimensions.width}x${dimensions.height}`);
    }
    const sourceHash = await sha256(source);
    const destination = path.join(assetRoot, addition.id, "sheet-transparent.png");
    const destinationHash = await existingSha(destination);
    if (destinationHash && destinationHash !== sourceHash && !args.replace) {
      fail(`${addition.id}: destination differs; rerun with --replace only after explicit review`);
    }
    plan.push({ source, destination, sha256: sourceHash, entry: addition, copy: destinationHash !== sourceHash });
  }

  const merged = mergeGeneratedData(current, additions);
  if (!args.dryRun) {
    for (const asset of plan) {
      if (!asset.copy) continue;
      await mkdir(path.dirname(asset.destination), { recursive: true });
      await copyFile(asset.source, asset.destination);
    }
    const temporaryDataPath = `${dataPath}.tmp`;
    await writeFile(temporaryDataPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    await rename(temporaryDataPath, dataPath);
  }

  console.log(JSON.stringify({
    batchId: manifest.batchId,
    dryRun: args.dryRun,
    passed: additions.length,
    copied: plan.filter((asset) => asset.copy).length,
    idempotent: plan.filter((asset) => !asset.copy).length,
    totalGenerated: merged.entries.length,
    assets: plan.map((asset) => ({ id: asset.entry.id, sha256: asset.sha256, copy: asset.copy }))
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
