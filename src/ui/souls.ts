/*
 * 묵편 보관소의 화면 쪽 창구.
 *
 * 규칙은 core/soul-archive.ts 가 전부 쥐고 있다. 여기는 그 장부를 한 벌만
 * 들고 있다가 바뀔 때마다 localStorage 에 적고, 보고 있는 화면들에게 알린다.
 *
 * 저장은 바뀔 때마다 즉시 한다. 판이 끝날 때 몰아 적으면 창을 닫아 버린
 * 사람의 오늘치 수확이 통째로 사라진다 — 판을 넘어 남는 첫 물건이라
 * 그 실패는 유난히 아프다. 실측 크기가 작아(성어 15구 + 글자 수백 자라도
 * 수 KB) 매번 적어도 부담이 없다.
 */
import {
  EMPTY_SOUL_ARCHIVE,
  gainSoul,
  loadSoulArchive,
  writeSoulArchive,
  type SoulArchive
} from "../core/soul-archive";

let archive: SoulArchive | null = null;
const listeners = new Set<(next: SoulArchive) => void>();

export function soulArchive(): SoulArchive {
  if (!archive) {
    try {
      archive = loadSoulArchive();
    } catch {
      archive = EMPTY_SOUL_ARCHIVE;
    }
  }
  return archive;
}

/** 장부를 갈아 끼운다. 같은 장부면 알리지 않는다(무의미한 다시 그리기 방지). */
export function setSoulArchive(next: SoulArchive): void {
  if (next === soulArchive()) return;
  archive = next;
  writeSoulArchive(next);
  for (const listener of listeners) listener(next);
}

/** 규칙 함수 하나를 장부에 적용한다. `setSoulArchive(fn(soulArchive()))` 의 준말. */
export function updateSoulArchive(change: (current: SoulArchive) => SoulArchive): void {
  setSoulArchive(change(soulArchive()));
}

export function onSoulArchiveChange(listener: (next: SoulArchive) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 봉인한 야생 자령이 남긴 혼 하나를 거둔다. */
export function collectSoul(char: string): void {
  updateSoulArchive((current) => gainSoul(current, char));
}

/** 시험·QA 용 — 들고 있던 장부를 잊고 저장소에서 다시 읽는다. */
export function resetSoulArchiveCache(): void {
  archive = null;
}
