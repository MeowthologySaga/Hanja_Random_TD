import { existsSync, readFileSync } from "node:fs";
import { CHEONJAMUN_JARYEONG_META, CHEONJAMUN_JARYEONG_ROSTER, CHEONJAMUN_SUPPLEMENTAL_CHARACTERS } from "../src/core/cheonjamun-roster";
import { getCatalog } from "../src/core/hanzi";
import { JARYEONG_VISUALS, jaryeongVisualFor } from "../src/core/jaryeongs";
import { RADICAL_DATA_META } from "../src/core/radicals";
import { idiomsForRegion } from "../src/core/idioms";
import { CHEONJAMUN_PHRASES } from "../src/data/cheonjamun-phrases";
import type { RegionCode, Wuxing } from "../src/core/types";

interface RuntimeEntry {
  c: string;
  s: number;
  e: Wuxing;
  a: "D" | "C";
  p: string[];
  r: number;
}

interface RuntimeFile {
  v: string;
  region: RegionCode;
  chars: RuntimeEntry[];
}

interface ManifestRegion {
  scope: number;
  stats: {
    characters: number;
    stageCounts: Record<string, number>;
    wuxingCounts: Record<Wuxing, number>;
    craftable: number;
    directAcquire: number;
    needsReview: number;
  };
  runtimeFile: string;
}

interface Manifest {
  regions: Record<RegionCode, ManifestRegion>;
  criticalRegression: Record<string, { stage: number; parents: string[]; wuxing?: Wuxing }>;
}

const root = new URL("../handoff_source/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8")) as Manifest;
const regions: readonly RegionCode[] = ["KR", "JP", "CN"];
const wuxing: readonly Wuxing[] = ["木", "火", "土", "金", "水"];
const errors: string[] = [];
const report: Record<string, unknown> = {};

function assert(condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

for (const region of regions) {
  const expected = manifest.regions[region];
  const runtime = JSON.parse(readFileSync(new URL(expected.runtimeFile, root), "utf8")) as RuntimeFile;
  const chars = runtime.chars;
  const unique = new Set(chars.map((entry) => entry.c));
  const stageCounts: Record<string, number> = {};
  const wuxingCounts = Object.fromEntries(wuxing.map((element) => [element, 0])) as Record<Wuxing, number>;
  let craftable = 0;
  let directAcquire = 0;
  let needsReview = 0;
  for (const entry of chars) {
    stageCounts[String(entry.s)] = (stageCounts[String(entry.s)] ?? 0) + 1;
    if (wuxing.includes(entry.e)) wuxingCounts[entry.e] += 1;
    else errors.push(region + ":" + entry.c + " has invalid wuxing " + String(entry.e));
    if (entry.a === "C") {
      craftable += 1;
      assert(entry.p.length >= 2, region + ":" + entry.c + " craft recipe has fewer than two parents");
      assert(entry.s >= 2 && entry.s <= 5, region + ":" + entry.c + " has invalid craft stage");
    } else {
      directAcquire += 1;
      assert(entry.s === 1, region + ":" + entry.c + " direct character is not stage 1");
      assert(entry.p.length === 0, region + ":" + entry.c + " direct character has parents");
    }
    if (entry.r === 1) needsReview += 1;
  }
  assert(runtime.region === region, region + " runtime region mismatch");
  assert(chars.length === expected.scope, region + " scope mismatch");
  assert(unique.size === chars.length, region + " contains duplicate character rows");
  assert(chars.length === expected.stats.characters, region + " manifest character count mismatch");
  assert(craftable === expected.stats.craftable, region + " craftable count mismatch");
  assert(directAcquire === expected.stats.directAcquire, region + " direct count mismatch");
  assert(needsReview === expected.stats.needsReview, region + " review count mismatch");
  for (const [stage, count] of Object.entries(expected.stats.stageCounts)) {
    assert((stageCounts[stage] ?? 0) === count, region + " stage " + stage + " count mismatch");
  }
  for (const element of wuxing) {
    assert(wuxingCounts[element] === expected.stats.wuxingCounts[element], region + " wuxing " + element + " count mismatch");
  }
  const catalog = getCatalog(region);
  const supplementalCount = region === "KR" ? CHEONJAMUN_SUPPLEMENTAL_CHARACTERS.length : 0;
  assert(catalog.definitions.size === expected.scope + supplementalCount, region + " catalog size mismatch");
  assert(catalog.activePool.length >= 12 && catalog.activePool.length <= 150, region + " active pool out of recommended range");
  const abilityComboKeys = new Set<string>();
  for (const definition of catalog.definitions.values()) {
    const loadout = definition.combat.abilities;
    assert(Boolean(loadout.element?.id && loadout.role?.id && loadout.graph?.id), region + ":" + definition.char + " missing core ability axis");
    assert(loadout.tuning.signatureEvery >= 3, region + ":" + definition.char + " invalid signature cadence");
    if (definition.acquisition === "craft") assert(Boolean(loadout.lineage), region + ":" + definition.char + " missing lineage ability");
    abilityComboKeys.add(loadout.comboKey);
  }
  report[region] = {
    characters: catalog.definitions.size,
    baselineCharacters: chars.length,
    recipes: craftable,
    direct: directAcquire,
    needsReview,
    activePool: catalog.activePool.length,
    goals: catalog.goalOrder,
    abilityCombos: abilityComboKeys.size
  };
}

const cn = getCatalog("CN");
const liu = cn.definitions.get("刘");
const liuWater = cn.definitions.get("浏");
assert(liu?.stage === 2 && JSON.stringify(liu.parents) === JSON.stringify(["文", "刀"]), "CN:刘 regression failed");
assert(liuWater?.stage === 3 && liuWater.wuxing === "水" && JSON.stringify(liuWater.parents) === JSON.stringify(["水", "刘"]), "CN:浏 regression failed");
assert(manifest.criticalRegression["CN:刘"]?.stage === 2, "manifest CN:刘 regression missing");
assert(manifest.criticalRegression["CN:浏"]?.wuxing === "水", "manifest CN:浏 wuxing regression missing");

assert(RADICAL_DATA_META.coveredCharacters === RADICAL_DATA_META.catalogCharacters, "Unihan radical coverage is incomplete");
assert(CHEONJAMUN_JARYEONG_META.entries === 50, "Thousand Character Classic Jaryeong roster must contain 50 entries");
assert(CHEONJAMUN_JARYEONG_META.semanticOverrides === 18, "semantic Wuxing override count changed");
assert(CHEONJAMUN_JARYEONG_META.supplementalCharacters === 1, "supplemental character count changed");
assert(CHEONJAMUN_JARYEONG_META.sourceEdgeWarnings === 7, "source-edge warning count changed");
assert(JARYEONG_VISUALS.length === 80, "combined Jaryeong visual catalog must contain 80 entries");
assert(new Set(JARYEONG_VISUALS.map((visual) => visual.id)).size === JARYEONG_VISUALS.length, "Jaryeong visual ids are duplicated");
assert(new Set(JARYEONG_VISUALS.map((visual) => visual.hanja)).size === JARYEONG_VISUALS.length, "Jaryeong visual Hanja are duplicated");
for (const visual of JARYEONG_VISUALS) {
  const spriteUrl = new URL(`../public/assets/jaryeongs/${visual.id}/sheet-transparent.png`, import.meta.url);
  assert(existsSync(spriteUrl), `missing existing Jaryeong sprite: ${visual.id}`);
}
const krCatalog = getCatalog("KR");
const krIdiomCatalog = idiomsForRegion("KR");
const krCorpus = (JSON.parse(readFileSync(new URL(manifest.regions.KR.runtimeFile, root), "utf8")) as RuntimeFile).chars.map((entry) => entry.c).join("");
assert(CHEONJAMUN_PHRASES.length === 100, "Cheonjamun phrase catalog must contain 100 clauses");
assert(CHEONJAMUN_PHRASES.every((phrase) => phrase.reading.length === 4 && phrase.meaning.length > 0), "Cheonjamun phrase reading or meaning is incomplete");
assert(CHEONJAMUN_PHRASES.map((phrase) => phrase.chars).join("") === krCorpus.slice(0, 400), "Cheonjamun phrases do not match the first 400 source characters");
assert(krIdiomCatalog.length === 104, "KR idiom catalog must contain 4 common idioms and 100 Cheonjamun clauses");
for (const idiom of krIdiomCatalog) {
  assert([...idiom.chars].length === 4, `invalid four-character idiom: ${idiom.id}`);
  for (const char of idiom.chars) assert(krCatalog.definitions.has(char), `KR idiom character is outside the catalog: ${idiom.id}:${char}`);
}
for (const entry of CHEONJAMUN_JARYEONG_ROSTER) {
  assert(krCatalog.definitions.get(entry.hanja)?.wuxing === entry.wuxing, `semantic Wuxing overlay failed: ${entry.hanja}`);
  assert(jaryeongVisualFor(entry.hanja, entry.wuxing).id === entry.id, `exact Jaryeong mapping failed: ${entry.hanja}`);
}
report.visuals = { jaryeongs: JARYEONG_VISUALS.length, radicals: RADICAL_DATA_META.coveredCharacters, idioms: krIdiomCatalog.length, cheonjamunPhrases: CHEONJAMUN_PHRASES.length };

process.stdout.write(JSON.stringify({ ok: errors.length === 0, regions: report, errors }, null, 2) + "\n");
if (errors.length > 0) process.exitCode = 1;
