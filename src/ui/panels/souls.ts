/*
 * 집자소 — 모은 자혼을 성어로 새기고 장착하는 화면.
 *
 * 판 밖의 화면이라 엔진을 건드리지 않는다. 규칙은 core/soul-archive.ts 와
 * core/custom-idioms.ts 가 쥐고, 여기는 그 규칙을 눌러 보이게만 한다.
 *
 * 화면을 셋으로 가른 이유: 자혼(재료) → 새김대(만드는 자리) → 내 성어(고르는
 * 자리)가 왼쪽에서 오른쪽으로 흐른다. 재료를 보며 만들고, 만들며 무엇을
 * 장착할지 고르는 한 흐름이라 세 곳을 오갈 일이 없다.
 */
import {
  CUSTOM_IDIOM_EQUIP_LIMIT,
  CUSTOM_IDIOM_LENGTH,
  customIdiomOdds,
  customIdiomReading,
  isValidCustomIdiomChars,
  starSumOf,
  uniqueCharCount
} from "../../core/custom-idioms";
import type { CustomIdiom } from "../../core/custom-idioms";
import {
  createCustomIdiom,
  discardCustomIdiom,
  equipCustomIdiom,
  isEquipped,
  missingSouls,
  soulCost,
  soulsHeld,
  unequipCustomIdiom,
  writeCustomIdiomMeaning,
  type SoulArchive
} from "../../core/soul-archive";
import { defaultNotationForRegion } from "../../core/notation";
import { learningInfoForNotation } from "../../core/learning";
import { ctx, must } from "../app-context";
import { showToast } from "../hud";
import { onSoulArchiveChange, soulArchive, updateSoulArchive } from "../souls";

/**
 * 이 글자의 훈·독.
 *
 * 집자소는 판 밖의 화면이라 굴러가는 엔진이 없을 수도 있다. 그래서 표기는
 * 사람이 고른 축(설정) → 지역 기본 순으로 정한다. 자혼을 모으는 동안 그 글자를
 * 읽을 수 있어야 "오늘 만난 글자"가 내일의 재료로 남는다 — 글자만 덩그러니
 * 있으면 모으기가 수집이지 학습이 아니다.
 */
function readingOf(char: string): { short: string; label: string } {
  const notation = ctx.selectedNotation ?? defaultNotationForRegion(ctx.selectedRegion);
  const info = learningInfoForNotation(notation, char);
  return { short: info.short, label: info.readingLabel };
}

/** 새김대에 올려 둔 글자들. 화면에만 사는 상태라 저장하지 않는다. */
let draft: string[] = [];

let bound = false;

function dialog(): HTMLDialogElement {
  return must<HTMLDialogElement>("#soul-dialog");
}

/** 새김대가 이미 쓰고 있는 그 글자의 수 — 남은 자혼을 셀 때 뺀다. */
function draftUsage(char: string): number {
  return draft.filter((entry) => entry === char).length;
}

function remaining(archive: SoulArchive, char: string): number {
  return soulsHeld(archive, char) - draftUsage(char);
}

function renderHoldings(archive: SoulArchive): void {
  const grid = must<HTMLDivElement>("#soul-grid");
  const empty = must<HTMLParagraphElement>("#soul-holdings-empty");
  const entries = Object.entries(archive.souls)
    .filter(([, count]) => count > 0)
    // 많이 지닌 것부터, 같은 수면 글자 순서로. 같은 자리에 같은 글자가 오래
    // 머물러야 눈이 자리를 외운다.
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  must<HTMLElement>("#soul-holdings-count").textContent = String(
    entries.reduce((sum, [, count]) => sum + count, 0)
  );
  empty.hidden = entries.length > 0;
  grid.replaceChildren(
    ...entries.map(([char, count]) => {
      const left = remaining(archive, char);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "soul-chip";
      button.dataset.soulChar = char;
      button.setAttribute("role", "listitem");
      button.disabled = left <= 0 || draft.length >= CUSTOM_IDIOM_LENGTH;
      const reading = readingOf(char);
      button.setAttribute("aria-label", `${char} ${reading.short} · 자혼 ${count}개 — 새김대에 올리기`);
      button.innerHTML = `<b>${char}</b><small>${reading.short}</small><em>${left}<i>/${count}</i></em>`;
      return button;
    })
  );
}

function renderSlots(): void {
  const slots = must<HTMLDivElement>("#soul-slots");
  slots.replaceChildren(
    ...Array.from({ length: CUSTOM_IDIOM_LENGTH }, (_, index) => {
      const char = draft[index];
      const button = document.createElement("button");
      button.type = "button";
      button.className = char ? "soul-slot is-filled" : "soul-slot";
      button.dataset.soulSlot = String(index);
      button.disabled = !char;
      const reading = char ? readingOf(char) : null;
      button.setAttribute(
        "aria-label",
        char ? `${index + 1}번째 자리 ${char} ${reading?.short ?? ""} — 내리기` : `${index + 1}번째 빈 자리`
      );
      button.innerHTML = char ? `<b>${char}</b><small>${reading?.short ?? ""}</small>` : "";
      return button;
    })
  );

  const chars = draft.join("");
  const reading = must<HTMLElement>("#soul-reading");
  // 음은 규칙이 정한다. 넉 자가 다 차기 전에도 이어 붙여 보여 줘서, 무엇을
  // 올리면 어떤 소리가 되는지 고르는 동안 알 수 있게 한다.
  reading.textContent = chars ? customIdiomReading(chars) : "····";
  reading.classList.toggle("is-ready", draft.length === CUSTOM_IDIOM_LENGTH);
}

function renderOdds(): void {
  const box = must<HTMLDivElement>("#soul-odds");
  const chars = draft.join("");
  const provisional = draft.length < CUSTOM_IDIOM_LENGTH;
  /*
   * 넉 자가 차기 전에는 이 조합의 값을 셈할 수 없다(중복·획수 보정이 넷을 다
   * 봐야 정해진다). 그래서 서로 다른 넉 자를 기준으로 삼은 값을 눌러서 보여
   * 주고, 아래 안내로 "아직 기준값"임을 밝힌다 — 한 글자만 올린 상태의 값을
   * 그대로 적으면 중복 보정이 걸린 낮은 수를 이 조합의 값으로 오해한다.
   */
  const odds = customIdiomOdds(provisional ? "天地玄黃" : chars);

  box.dataset.provisional = provisional ? "1" : "0";
  must<HTMLElement>("#soul-odds-hint").textContent = provisional
    ? "서로 다른 넉 자를 기준으로 한 값입니다. 넷을 다 올리면 이 조합의 값으로 바뀝니다."
    : "이 조합의 값입니다. 축은 이 확률로 하나만 뽑힙니다.";
  box.replaceChildren(
    ...odds.map((entry) => {
      const row = document.createElement("div");
      row.className = "soul-odds-row";
      // 문장은 한 번만 적고(왼쪽), 범위와 천장은 값만 짧게 적는다 — 같은 말이
      // 한 줄에 세 번 되풀이되면 정작 다른 수가 안 보인다.
      row.innerHTML = `<span class="soul-odds-chance">${(entry.chance * 100).toFixed(0)}%</span>`
        + `<span class="soul-odds-range">${entry.name}</span>`
        + `<span class="soul-odds-peak">${entry.minShort}~${entry.maxShort}<i>최고 ${entry.peakShort}</i></span>`;
      row.title = `${entry.minLabel} ~ ${entry.maxLabel} · 이 축의 최고 ${entry.peakLabel}`;
      return row;
    })
  );
}

function forgeNote(archive: SoulArchive): string {
  if (draft.length < CUSTOM_IDIOM_LENGTH) {
    return `자혼 ${CUSTOM_IDIOM_LENGTH - draft.length}개를 더 올려 주세요.`;
  }
  const chars = draft.join("");
  const missing = missingSouls(archive, chars);
  if (missing.length > 0) return `자혼이 모자랍니다 — ${missing.join(" ")}`;
  const unique = uniqueCharCount(chars);
  const stars = starSumOf(chars);
  const duplicate = unique < CUSTOM_IDIOM_LENGTH ? ` · 같은 글자 ${CUSTOM_IDIOM_LENGTH - unique + 1}겹이라 능력이 약해집니다` : "";
  // 「별 합」은 획수에서 나온 등급의 합이다(4~32). 이름을 「획수」로 적으면
  // 실제 획수와 다른 수라 사람이 세어 보고 어긋난다.
  return `자혼 ${[...soulCost(chars)].map(([char, need]) => `${char}×${need}`).join(" ")}를 태웁니다`
    + ` · 별 합 ${stars}/32 — 높을수록 능력이 세집니다${duplicate}`;
}

function renderForge(archive: SoulArchive): void {
  const button = must<HTMLButtonElement>("#soul-forge-button");
  const chars = draft.join("");
  const ready = isValidCustomIdiomChars(chars) && missingSouls(archive, chars).length === 0;

  must<HTMLParagraphElement>("#soul-forge-note").textContent = forgeNote(archive);
  button.disabled = !ready;
}

function idiomCard(archive: SoulArchive, idiom: CustomIdiom): HTMLElement {
  const equipped = isEquipped(archive, idiom.id);
  const card = document.createElement("article");
  card.className = equipped ? "soul-card is-equipped" : "soul-card";
  card.dataset.soulIdiom = idiom.id;

  const full = archive.equipped.length >= CUSTOM_IDIOM_EQUIP_LIMIT;
  card.innerHTML = `
    <p class="soul-card-chars">${[...idiom.chars].map((char) => `<b>${char}</b>`).join("")}</p>
    <p class="soul-card-reading">${idiom.reading}</p>
    <p class="soul-card-meaning">${idiom.meaning || "<i>뜻을 적지 않았습니다</i>"}</p>
    <p class="soul-card-bonus">${idiom.bonus.label}</p>
    <div class="soul-card-actions">
      <button type="button" data-soul-equip="${idiom.id}"${!equipped && full ? " disabled" : ""}>${equipped ? "해제" : "장착"}</button>
      <button type="button" data-soul-meaning="${idiom.id}">뜻 쓰기</button>
      <button type="button" class="soul-card-discard" data-soul-discard="${idiom.id}">버리기</button>
    </div>`;
  return card;
}

function renderShelf(archive: SoulArchive): void {
  const list = must<HTMLDivElement>("#soul-list");
  const empty = must<HTMLParagraphElement>("#soul-list-empty");

  must<HTMLElement>("#soul-equip-count").textContent =
    `${archive.equipped.length}/${CUSTOM_IDIOM_EQUIP_LIMIT}`;
  empty.hidden = archive.idioms.length > 0;
  // 장착한 구를 위로 올린다 — 판에 서는 것이 먼저 보여야 한다.
  const ordered = [...archive.idioms].sort((left, right) => {
    const gap = Number(isEquipped(archive, right.id)) - Number(isEquipped(archive, left.id));
    return gap !== 0 ? gap : right.createdAt - left.createdAt;
  });
  list.replaceChildren(...ordered.map((idiom) => idiomCard(archive, idiom)));
}

export function renderSoulArchive(): void {
  if (!dialog().open) return;
  const archive = soulArchive();
  renderHoldings(archive);
  renderSlots();
  renderOdds();
  renderForge(archive);
  renderShelf(archive);
}

/** 제목 화면의 자혼 배지 — 지닌 자혼이 있을 때만 선다. */
export function refreshSoulBadge(): void {
  const badge = document.getElementById("s00-souls-badge");
  if (!badge) return;
  const archive = soulArchive();
  const total = Object.values(archive.souls).reduce((sum, count) => sum + count, 0);
  badge.textContent = String(total);
  badge.hidden = total <= 0;
}

function forge(): void {
  const chars = draft.join("");
  const meaning = must<HTMLInputElement>("#soul-meaning-input").value;
  let message = "";
  updateSoulArchive((archive) => {
    /*
     * 굴림은 여기서 난수를 만들어 넘긴다. 규칙 모듈이 난수를 모르게 두면
     * 시험이 값을 직접 정할 수 있고, 그래서 확률표와 실제 굴림이 어긋나지
     * 않는다는 것을 시험으로 못박을 수 있다.
     */
    const result = createCustomIdiom(archive, {
      chars,
      meaning,
      axisRoll: Math.random(),
      valueRoll: Math.random(),
      id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      now: Date.now()
    });
    message = result.message;
    return result.archive;
  });
  showToast(message);
  draft = [];
  must<HTMLInputElement>("#soul-meaning-input").value = "";
  renderSoulArchive();
  refreshSoulBadge();
}

function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const chip = target.closest<HTMLElement>("[data-soul-char]");
  if (chip?.dataset.soulChar) {
    if (draft.length >= CUSTOM_IDIOM_LENGTH) return;
    if (remaining(soulArchive(), chip.dataset.soulChar) <= 0) return;
    draft.push(chip.dataset.soulChar);
    renderSoulArchive();
    return;
  }

  const slot = target.closest<HTMLElement>("[data-soul-slot]");
  if (slot?.dataset.soulSlot) {
    draft.splice(Number(slot.dataset.soulSlot), 1);
    renderSoulArchive();
    return;
  }

  const equip = target.closest<HTMLElement>("[data-soul-equip]")?.dataset.soulEquip;
  if (equip) {
    updateSoulArchive((archive) =>
      isEquipped(archive, equip) ? unequipCustomIdiom(archive, equip) : equipCustomIdiom(archive, equip)
    );
    renderSoulArchive();
    return;
  }

  const write = target.closest<HTMLElement>("[data-soul-meaning]")?.dataset.soulMeaning;
  if (write) {
    const current = soulArchive().idioms.find((idiom) => idiom.id === write);
    const next = window.prompt("이 성어의 뜻을 적어 주세요. 음은 한자 음 그대로 붙습니다.", current?.meaning ?? "");
    if (next !== null) {
      updateSoulArchive((archive) => writeCustomIdiomMeaning(archive, write, next.slice(0, 40)));
      renderSoulArchive();
    }
    return;
  }

  const discard = target.closest<HTMLElement>("[data-soul-discard]")?.dataset.soulDiscard;
  if (discard) {
    const idiom = soulArchive().idioms.find((entry) => entry.id === discard);
    // 되돌릴 수 없는 일이라 한 번 묻는다. 태운 자혼은 돌아오지 않는다.
    if (!window.confirm(`${idiom?.reading ?? "이 성어"}을 버릴까요? 태운 자혼은 돌아오지 않습니다.`)) return;
    updateSoulArchive((archive) => discardCustomIdiom(archive, discard));
    renderSoulArchive();
  }
}

export function openSoulArchive(): void {
  bindSoulArchive();
  const box = dialog();
  if (!box.open) box.showModal();
  renderSoulArchive();
}

export function bindSoulArchive(): void {
  if (bound) return;
  bound = true;

  const box = dialog();
  box.addEventListener("click", handleClick);
  must<HTMLButtonElement>("#soul-close").addEventListener("click", () => box.close());
  must<HTMLButtonElement>("#soul-forge-button").addEventListener("click", forge);
  // 새김대를 비운 채 닫으면 다음에 열었을 때 남은 글자에 놀라지 않는다.
  box.addEventListener("close", () => {
    draft = [];
    must<HTMLInputElement>("#soul-meaning-input").value = "";
  });
  onSoulArchiveChange(() => {
    refreshSoulBadge();
    renderSoulArchive();
  });
}
