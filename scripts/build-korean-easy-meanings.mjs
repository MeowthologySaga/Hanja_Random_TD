import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEX_PATH = path.join(ROOT, "src", "data", "cheonjamun-jaryeong-dex-v1.json");
const LEARNING_PATH = path.join(ROOT, "src", "data", "learning-readings.json");
const OVERRIDES_PATH = path.join(ROOT, "src", "data", "korean-easy-meaning-overrides.json");
const OUTPUT_PATH = path.join(ROOT, "src", "data", "korean-easy-meanings.json");
const SOURCE_URL = "https://krdict.korean.go.kr/download/downloadPopup";
const SOURCE_ARCHIVE_SHA256 = "7CF41E62A2A36158A8BE2B6D2F84C086221E9B29D4345C44E5497EEBF21C8C40";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const krdictDir = argument("krdict-dir");
const debugChars = new Set([...(argument("debug-chars") ?? "")]);
const reportOnly = process.argv.includes("--report-only");
if (!krdictDir || !path.isAbsolute(krdictDir)) {
  throw new Error("Use --krdict-dir=<absolute extracted Korean Basic Dictionary JSON directory>.");
}

const dex = JSON.parse(fs.readFileSync(DEX_PATH, "utf8"));
const learning = JSON.parse(fs.readFileSync(LEARNING_PATH, "utf8"));
const overridesData = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
const overrides = overridesData.entries ?? {};

const IRREGULAR_LEMMAS = Object.freeze({
  "가까울": ["가깝다"],
  "가벼울": ["가볍다"],
  "고울": ["곱다"],
  "괴로울": ["괴롭다"],
  "누를": ["누렇다"],
  "더울": ["덥다"],
  "두려울": ["두렵다"],
  "무거울": ["무겁다"],
  "부끄럼": ["부끄러움"],
  "아름다울": ["아름답다"],
  "어려울": ["어렵다"],
  "외로울": ["외롭다"],
  "즐거울": ["즐겁다"],
  "차가울": ["차갑다"]
});

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it",
  "of", "on", "or", "the", "to", "with"
]);

function addCandidate(target, lemma, weight, kind) {
  const normalized = lemma.trim();
  if (!normalized) return;
  const previous = target.candidates.get(normalized);
  if (!previous || previous.weight < weight) target.candidates.set(normalized, { lemma: normalized, weight, kind });
}

function stripFinalRieul(value) {
  const chars = [...value];
  const last = chars.at(-1);
  if (!last) return undefined;
  const codePoint = last.codePointAt(0);
  if (codePoint < 0xac00 || codePoint > 0xd7a3) return undefined;
  const offset = codePoint - 0xac00;
  if (offset % 28 !== 8) return undefined;
  chars[chars.length - 1] = String.fromCodePoint(codePoint - 8);
  return chars.join("");
}

function bieupIrregularLemma(value) {
  if (!value.endsWith("울") || value.length < 2) return undefined;
  const prefix = [...value.slice(0, -1)];
  const last = prefix.at(-1);
  if (!last) return undefined;
  const codePoint = last.codePointAt(0);
  if (codePoint < 0xac00 || codePoint > 0xd7a3) return undefined;
  const offset = codePoint - 0xac00;
  if (offset % 28 !== 0) return undefined;
  prefix[prefix.length - 1] = String.fromCodePoint(codePoint + 17);
  return `${prefix.join("")}다`;
}

function candidateLemmas(meaning) {
  const target = { candidates: new Map() };
  addCandidate(target, meaning, 55, "exact");
  for (const part of meaning.split(/[·,/]/u)) addCandidate(target, part, 48, "split");
  if (meaning.endsWith("할")) addCandidate(target, `${meaning.slice(0, -1)}하다`, 52, "hada");
  if (meaning.endsWith("될")) addCandidate(target, `${meaning.slice(0, -1)}되다`, 52, "doeda");
  if (meaning.endsWith("을")) addCandidate(target, `${meaning.slice(0, -1)}다`, 50, "eul");
  const stripped = stripFinalRieul(meaning);
  if (stripped) addCandidate(target, `${stripped}다`, 58, "rieul");
  addCandidate(target, `${meaning}다`, 58, "stem");
  const bieup = bieupIrregularLemma(meaning);
  if (bieup) addCandidate(target, bieup, 49, "bieup");
  for (const irregular of IRREGULAR_LEMMAS[meaning] ?? []) addCandidate(target, irregular, 58, "irregular");
  return [...target.candidates.values()];
}

function featureValues(node) {
  if (!node?.feat) return [];
  return Array.isArray(node.feat) ? node.feat : [node.feat];
}

function feature(node, att) {
  return featureValues(node).find((entry) => entry?.att === att)?.val;
}

function senses(entry) {
  if (!entry?.Sense) return [];
  return Array.isArray(entry.Sense) ? entry.Sense : [entry.Sense];
}

function equivalents(sense) {
  if (!sense?.Equivalent) return [];
  return Array.isArray(sense.Equivalent) ? sense.Equivalent : [sense.Equivalent];
}

function examples(sense) {
  if (!sense?.SenseExample) return [];
  return Array.isArray(sense.SenseExample) ? sense.SenseExample : [sense.SenseExample];
}

function englishText(sense) {
  const english = equivalents(sense).find((equivalent) => feature(equivalent, "language") === "영어");
  if (!english) return "";
  return `${feature(english, "lemma") ?? ""} ${feature(english, "definition") ?? ""}`.trim();
}

function englishTokens(value) {
  return new Set(value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .split(/\s+/u)
    .map((token) => token.replace(/(ing|ed|es|s)$/u, ""))
    .filter((token) => token.length > 1 && !ENGLISH_STOP_WORDS.has(token)));
}

function overlapScore(leftValue, rightValue) {
  const left = englishTokens(leftValue);
  const right = englishTokens(rightValue);
  let score = 0;
  for (const token of left) if (right.has(token)) score += token.length >= 6 ? 10 : 6;
  return score;
}

function firstExample(sense) {
  const values = examples(sense)
    .flatMap((example) => featureValues(example).filter((item) => item.att === "example").map((item) => item.val))
    .filter((value) => typeof value === "string" && value.length >= 3 && value.length <= 72);
  return values.find((value) => /[.!?。]$/u.test(value)) ?? values[0];
}

const supplementalTargets = ["烈"].map((hanja) => {
  const huneum = learning.chars[hanja]?.kh ?? "뜻 정보 미수록";
  return {
    hanja,
    huneum,
    meaning: huneum.split(/\s+/u).slice(0, -1).join(" ")
  };
});

const targets = [...dex.entries, ...supplementalTargets].map((entry) => ({
  ...entry,
  english: learning.chars[entry.hanja]?.d ?? "",
  candidates: candidateLemmas(entry.meaning)
}));
const targetsByLemma = new Map();
for (const target of targets) {
  for (const candidate of target.candidates) {
    const group = targetsByLemma.get(candidate.lemma) ?? [];
    group.push({ target, candidate });
    targetsByLemma.set(candidate.lemma, group);
  }
}

const matches = new Map(targets.map((target) => [target.hanja, []]));
const files = fs.readdirSync(krdictDir)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));

for (const fileName of files) {
  const parsed = JSON.parse(fs.readFileSync(path.join(krdictDir, fileName), "utf8"));
  const entries = parsed?.LexicalResource?.Lexicon?.LexicalEntry ?? [];
  for (const [entryOrder, lexicalEntry] of entries.entries()) {
    const lemma = feature(lexicalEntry.Lemma, "writtenForm");
    const interested = targetsByLemma.get(lemma);
    if (!interested) continue;
    const partOfSpeech = feature(lexicalEntry, "partOfSpeech") ?? "";
    for (const [senseOrder, sense] of senses(lexicalEntry).entries()) {
      const definition = feature(sense, "definition");
      if (!definition) continue;
      const english = englishText(sense);
      for (const { target, candidate } of interested) {
        const semanticScore = overlapScore(target.english, english);
        let score = candidate.weight + semanticScore;
        if (/(할|될|을|릴|킬|길|볼|갈|울)$/u.test(target.meaning) && /동사|형용사/u.test(partOfSpeech)) score += 5;
        score -= senseOrder * 12;
        matches.get(target.hanja).push({
          score,
          lemma,
          definition,
          example: firstExample(sense),
          sourceId: `${feature(lexicalEntry, "id") ?? lexicalEntry.val ?? "?"}:${feature(sense, "id") ?? sense.val ?? "?"}`,
          partOfSpeech,
          english,
          semanticScore,
          fileOrder: Number.parseInt(fileName, 10),
          entryOrder,
          senseOrder
        });
      }
    }
  }
}

const resolved = [];
const unresolved = [];
for (const target of targets) {
  const override = overrides[target.hanja];
  if (override) {
    const explanation = typeof override === "string"
      ? {
        plainMeaning: override.replace(/[.]$/u, ""),
        short: override,
        body: override
      }
      : override;
    resolved.push({
      hanja: target.hanja,
      huneum: target.huneum,
      meaning: target.meaning,
      ...explanation,
      source: "curated"
    });
    continue;
  }
  const candidates = matches.get(target.hanja)
    .sort((left, right) => right.score - left.score
      || left.fileOrder - right.fileOrder
      || left.entryOrder - right.entryOrder
      || left.senseOrder - right.senseOrder);
  const best = candidates[0];
  if (!best) {
    unresolved.push({
      hanja: target.hanja,
      huneum: target.huneum,
      meaning: target.meaning,
      english: target.english
    });
    continue;
  }
  resolved.push({
    hanja: target.hanja,
    huneum: target.huneum,
    meaning: target.meaning,
    plainMeaning: best.definition.replace(/[.]$/u, ""),
    short: best.definition,
    body: best.definition,
    ...(best.example ? { example: best.example } : {}),
    source: "krdict",
    sourceId: best.sourceId,
    matchedLemma: best.lemma,
    matchScore: best.score,
    semanticScore: best.semanticScore
  });
}

const output = {
  schema: "korean-easy-meanings-v1",
  edition: "2026-08-25",
  source: {
    name: "국립국어원 한국어기초사전",
    release: "2026-08-19",
    url: SOURCE_URL,
    archiveSha256: SOURCE_ARCHIVE_SHA256
  },
  total: resolved.length,
  unresolved,
  entries: resolved
};

const unknownOverrides = Object.keys(overrides).filter((char) => !targets.some((target) => target.hanja === char));
if (unknownOverrides.length > 0) throw new Error(`Unknown Korean easy-meaning overrides: ${unknownOverrides.join(", ")}`);

if (!reportOnly) fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
const debugMatches = Object.fromEntries([...debugChars].map((char) => [
  char,
  (matches.get(char) ?? [])
    .sort((left, right) => right.score - left.score
      || left.fileOrder - right.fileOrder
      || left.entryOrder - right.entryOrder
      || left.senseOrder - right.senseOrder)
    .slice(0, 12)
]));
process.stdout.write(`${JSON.stringify({
  totalTargets: targets.length,
  resolved: resolved.length,
  unresolved: unresolved.length,
  unresolvedEntries: unresolved,
  ...(debugChars.size > 0 ? { debugMatches } : {})
}, null, 2)}\n`);
