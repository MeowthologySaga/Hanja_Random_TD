/*
 * 자혼 보관소 — 판을 넘어 남는 첫 장부.
 *
 * 화면의 이름: 재료는 **자혼(字魂)**, 그것으로 성어를 새기는 곳은
 * **집자소(集字所)** 다. 집자(集字)는 흩어진 글자를 모아 새 글을 짓는 실제
 * 서예 용어라, 넉 자를 모아 한 구를 만드는 이 행위를 그대로 가리킨다.
 * 코드의 soul/archive 는 그 영어 껍데기이고, 저장 키
 * (hanja-td:soul-archive-v1)는 사람이 모은 것을 잃지 않으려 그대로 둔다.
 *
 * 이 게임에는 여태 메타 진행이 없었다. 판이 끝나면 모든 것이 사라졌고, 그게
 * 미덕이었다. 자혼은 그 규칙을 처음으로 깨는 물건이라 자리를 좁게 잡는다.
 *
 *  · 남는 것은 **자혼(글자)** 과 **내가 새긴 성어** 둘뿐이다. 엽전도 자령도
 *    진도 판과 함께 사라진다 — 세기를 이월하지 않으니 판의 긴장이 안 무뎌진다.
 *  · 자혼은 능력이 아니라 **재료**다. 지녔다고 세지지 않고, 넷을 새겨 성어로
 *    만들어 장착해야 힘이 된다.
 *  · 장착 상한 15구. 만드는 데는 상한이 없다 — 모으는 재미와 고르는 재미를
 *    갈라 둔다.
 *
 * 이 모듈은 난수를 모른다. 굴림값은 부르는 쪽이 넘긴다(custom-idioms.ts 참조).
 */
import {
  CUSTOM_IDIOM_EQUIP_LIMIT,
  CUSTOM_IDIOM_LENGTH,
  customIdiomReading,
  isValidCustomIdiomChars,
  rollCustomIdiomBonus
} from "./custom-idioms";
import type { CustomIdiom } from "./custom-idioms";
import type { RegionCode } from "./types";

/** 보관소 키. 런 저장본과 달리 판이 끝나도 지우지 않는다. */
export const SOUL_ARCHIVE_STORAGE_KEY = "hanja-td:soul-archive-v1";

/**
 * 보관소 형식 판. 뜻이 달라지는 변경마다 올린다. 판이 다른 보관소는 버린다 —
 * 다만 런 저장본과 달리 이건 사람이 오래 모은 것이라, 버리기 전에 되도록
 * 읽어 낼 수 있는 데까지 읽는다(아래 parseSoulArchive 의 관대한 읽기).
 */
export const SOUL_ARCHIVE_VERSION = 1;

export interface SoulArchive {
  readonly version: number;
  /** 한자 → 지닌 자혼 수. 0 이 된 글자는 남기지 않는다. */
  readonly souls: Readonly<Record<string, number>>;
  /** 새긴 커스텀 성어. 만든 순서대로 쌓인다. */
  readonly idioms: readonly CustomIdiom[];
  /** 장착한 성어 id. 최대 CUSTOM_IDIOM_EQUIP_LIMIT 구. */
  readonly equipped: readonly string[];
}

export const EMPTY_SOUL_ARCHIVE: SoulArchive = Object.freeze({
  version: SOUL_ARCHIVE_VERSION,
  souls: Object.freeze({}),
  idioms: Object.freeze([]),
  equipped: Object.freeze([])
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIdiom(raw: unknown): CustomIdiom | null {
  if (!isRecord(raw)) return null;
  const { id, chars, reading, meaning, bonus, createdAt } = raw;
  if (typeof id !== "string" || !id) return null;
  if (typeof chars !== "string" || !isValidCustomIdiomChars(chars)) return null;
  if (typeof reading !== "string" || typeof meaning !== "string") return null;
  if (!isRecord(bonus)) return null;
  const { kind, value, label } = bonus;
  if (typeof kind !== "string" || typeof value !== "number" || !Number.isFinite(value)) return null;
  if (typeof label !== "string") return null;
  return {
    id,
    chars,
    reading,
    meaning,
    bonus: { kind: kind as CustomIdiom["bonus"]["kind"], value, label },
    createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : 0
  };
}

/**
 * 저장된 글을 보관소로 읽는다.
 *
 * 한 조각이 상해도 나머지는 살린다 — 사람이 여러 판에 걸쳐 모은 것이라
 * "전부 아니면 전무"로 버리면 잃는 게 너무 크다.
 */
export function parseSoulArchive(raw: string | null): SoulArchive {
  if (!raw) return EMPTY_SOUL_ARCHIVE;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_SOUL_ARCHIVE;
  }
  if (!isRecord(parsed)) return EMPTY_SOUL_ARCHIVE;

  const souls: Record<string, number> = {};
  if (isRecord(parsed.souls)) {
    for (const [char, count] of Object.entries(parsed.souls)) {
      if ([...char].length !== 1) continue;
      if (typeof count !== "number" || !Number.isFinite(count)) continue;
      const held = Math.max(0, Math.floor(count));
      if (held > 0) souls[char] = held;
    }
  }

  const idioms: CustomIdiom[] = [];
  const seen = new Set<string>();
  if (Array.isArray(parsed.idioms)) {
    for (const entry of parsed.idioms) {
      const idiom = parseIdiom(entry);
      if (!idiom || seen.has(idiom.id)) continue;
      seen.add(idiom.id);
      idioms.push(idiom);
    }
  }

  const equipped: string[] = [];
  if (Array.isArray(parsed.equipped)) {
    for (const entry of parsed.equipped) {
      if (typeof entry !== "string" || !seen.has(entry) || equipped.includes(entry)) continue;
      if (equipped.length >= CUSTOM_IDIOM_EQUIP_LIMIT) break;
      equipped.push(entry);
    }
  }

  return { version: SOUL_ARCHIVE_VERSION, souls, idioms, equipped };
}

export function serializeSoulArchive(archive: SoulArchive): string {
  return JSON.stringify(archive);
}

/** 지닌 자혼 수. */
export function soulsHeld(archive: SoulArchive, char: string): number {
  return archive.souls[char] ?? 0;
}

/** 자혼을 하나 더 얻는다. 우두머리 처치와 야생 자령의 드물게 떨어지는 몫. */
export function gainSoul(archive: SoulArchive, char: string, amount = 1): SoulArchive {
  if ([...char].length !== 1 || amount <= 0) return archive;
  return { ...archive, souls: { ...archive.souls, [char]: soulsHeld(archive, char) + Math.floor(amount) } };
}

/** 네 글자를 새기는 데 필요한 자혼 수. 같은 글자를 두 번 쓰면 두 개가 든다. */
export function soulCost(chars: string): Map<string, number> {
  const cost = new Map<string, number>();
  for (const char of chars) cost.set(char, (cost.get(char) ?? 0) + 1);
  return cost;
}

/** 지금 이 넷을 새길 수 있는가. 모자란 글자를 함께 돌려준다. */
export function missingSouls(archive: SoulArchive, chars: string): readonly string[] {
  const missing: string[] = [];
  for (const [char, need] of soulCost(chars)) {
    if (soulsHeld(archive, char) < need) missing.push(char);
  }
  return missing;
}

function spendSouls(archive: SoulArchive, chars: string): SoulArchive {
  const souls = { ...archive.souls };
  for (const [char, need] of soulCost(chars)) {
    const left = (souls[char] ?? 0) - need;
    if (left > 0) souls[char] = left;
    else delete souls[char];
  }
  return { ...archive, souls };
}

export interface CreateCustomIdiomResult {
  readonly ok: boolean;
  readonly archive: SoulArchive;
  readonly idiom: CustomIdiom | null;
  readonly message: string;
}

export interface CreateCustomIdiomInput {
  readonly chars: string;
  readonly meaning: string;
  /** 축 선택 굴림(0~1). */
  readonly axisRoll: number;
  /** 값 굴림(0~1). */
  readonly valueRoll: number;
  readonly region?: RegionCode;
  readonly id?: string;
  readonly now?: number;
}

/**
 * 자혼 넷을 새겨 성어 한 구를 만든다.
 *
 * 음은 한자 음을 그대로 이어 붙여 규칙이 정한다 — 사람은 **뜻만** 쓴다.
 * 내 마음대로 음을 지어 붙이면 그건 더 이상 한자 학습이 아니다.
 */
export function createCustomIdiom(archive: SoulArchive, input: CreateCustomIdiomInput): CreateCustomIdiomResult {
  const { chars, meaning, axisRoll, valueRoll, region = "KR", now = 0 } = input;
  if (!isValidCustomIdiomChars(chars)) {
    return { ok: false, archive, idiom: null, message: `자혼 ${CUSTOM_IDIOM_LENGTH}개를 골라 주세요.` };
  }
  const missing = missingSouls(archive, chars);
  if (missing.length > 0) {
    return { ok: false, archive, idiom: null, message: `자혼이 모자랍니다 — ${missing.join(" ")}` };
  }
  const idiom: CustomIdiom = {
    id: input.id ?? `custom-${chars}-${now}`,
    chars,
    reading: customIdiomReading(chars, region),
    meaning: meaning.trim(),
    bonus: rollCustomIdiomBonus(chars, axisRoll, valueRoll),
    createdAt: now
  };
  const spent = spendSouls(archive, chars);
  return {
    ok: true,
    archive: { ...spent, idioms: [...spent.idioms, idiom] },
    idiom,
    message: `${idiom.reading}을 새겼습니다.`
  };
}

/**
 * 이미 새긴 성어의 능력을 다시 굴린다.
 *
 * 자혼을 되돌려 받지 않는다 — 다시 굴리는 값은 부적에 한자를 써서 얻는다.
 * (뽑기 재굴림과 같은 매커니즘을 그대로 쓴다.)
 */
export function rerollCustomIdiom(
  archive: SoulArchive,
  id: string,
  axisRoll: number,
  valueRoll: number
): SoulArchive {
  const index = archive.idioms.findIndex((idiom) => idiom.id === id);
  if (index < 0) return archive;
  const target = archive.idioms[index];
  const idioms = [...archive.idioms];
  idioms[index] = { ...target, bonus: rollCustomIdiomBonus(target.chars, axisRoll, valueRoll) };
  return { ...archive, idioms };
}

/** 뜻만 고쳐 쓴다. 음과 능력은 손대지 않는다. */
export function writeCustomIdiomMeaning(archive: SoulArchive, id: string, meaning: string): SoulArchive {
  const index = archive.idioms.findIndex((idiom) => idiom.id === id);
  if (index < 0) return archive;
  const idioms = [...archive.idioms];
  idioms[index] = { ...idioms[index], meaning: meaning.trim() };
  return { ...archive, idioms };
}

export function isEquipped(archive: SoulArchive, id: string): boolean {
  return archive.equipped.includes(id);
}

/** 장착. 상한을 넘으면 아무 일도 없다 — 무엇을 뺄지는 사람이 고른다. */
export function equipCustomIdiom(archive: SoulArchive, id: string): SoulArchive {
  if (isEquipped(archive, id)) return archive;
  if (!archive.idioms.some((idiom) => idiom.id === id)) return archive;
  if (archive.equipped.length >= CUSTOM_IDIOM_EQUIP_LIMIT) return archive;
  return { ...archive, equipped: [...archive.equipped, id] };
}

export function unequipCustomIdiom(archive: SoulArchive, id: string): SoulArchive {
  if (!isEquipped(archive, id)) return archive;
  return { ...archive, equipped: archive.equipped.filter((entry) => entry !== id) };
}

/** 새긴 성어를 버린다. 자혼은 돌아오지 않는다. */
export function discardCustomIdiom(archive: SoulArchive, id: string): SoulArchive {
  if (!archive.idioms.some((idiom) => idiom.id === id)) return archive;
  return {
    ...archive,
    idioms: archive.idioms.filter((idiom) => idiom.id !== id),
    equipped: archive.equipped.filter((entry) => entry !== id)
  };
}

/** 장착한 성어를 만든 순서가 아니라 장착한 차례로 돌려준다. */
export function equippedCustomIdioms(archive: SoulArchive): readonly CustomIdiom[] {
  const byId = new Map(archive.idioms.map((idiom) => [idiom.id, idiom]));
  const list: CustomIdiom[] = [];
  for (const id of archive.equipped) {
    const idiom = byId.get(id);
    if (idiom) list.push(idiom);
  }
  return list;
}

interface ReadableStorage {
  getItem(key: string): string | null;
}

interface WritableStorage {
  setItem(key: string, value: string): void;
}

export function loadSoulArchive(storage: ReadableStorage = window.localStorage): SoulArchive {
  try {
    return parseSoulArchive(storage.getItem(SOUL_ARCHIVE_STORAGE_KEY));
  } catch {
    return EMPTY_SOUL_ARCHIVE;
  }
}

export function writeSoulArchive(archive: SoulArchive, storage: WritableStorage = window.localStorage): boolean {
  try {
    storage.setItem(SOUL_ARCHIVE_STORAGE_KEY, serializeSoulArchive(archive));
    return true;
  } catch {
    // 저장이 막혀도 판은 굴러가야 한다. 이번 판의 자혼만 잃는다.
    return false;
  }
}
