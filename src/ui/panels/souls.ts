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
  EMPTY_SOUL_ARCHIVE,
  createCustomIdiom,
  discardCustomIdiom,
  equipCustomIdiom,
  gainSoul,
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
import { ctx, must, shell } from "../app-context";
import { showToast } from "../hud";
import { onSoulArchiveChange, setSoulArchive, soulArchive, updateSoulArchive } from "../souls";

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

/** 지금 열려 있는 갈피. 창을 닫았다 열어도 하던 자리로 돌아온다. */
let activeTab: "forge" | "equip" | "dev" = "forge";

/** 방금 새긴 성어의 id — 장착 갈피에서 한 번 도드라지게 한다. */
let freshIdiomId: string | null = null;

/** 「내 성어」 정렬 축. */
let shelfSort: "equipped" | "recent" | "axis" = "equipped";

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
      // 「지금 못 누른다」(새김대가 참)와 「재료가 없다」(남은 0)를 흐림으로 가른다.
      button.className = left <= 0 ? "soul-chip is-empty" : "soul-chip";
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
  // 갓 새긴 구는 한 번 도드라진다 — 장착 갈피로 넘어가도 어느 것이 새 것인지 안다.
  if (idiom.id === freshIdiomId) card.classList.add("is-fresh");
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
  /*
   * 정렬 축 셋.
   *  · 장착 먼저 — 판에 서는 것이 먼저 보여야 한다(기본).
   *  · 새긴 순서 — 방금 만든 것을 찾을 때.
   *  · 능력 종류 — 같은 축을 몰아 보고 무엇을 뺄지 고를 때.
   * 어느 축이든 마지막 갈림은 새긴 순서다 — 순서가 흔들리면 카드 자리가
   * 매번 바뀌어 손이 자리를 못 외운다.
   */
  const ordered = [...archive.idioms].sort((left, right) => {
    if (shelfSort === "equipped") {
      const gap = Number(isEquipped(archive, right.id)) - Number(isEquipped(archive, left.id));
      if (gap !== 0) return gap;
    }
    if (shelfSort === "axis") {
      const gap = left.bonus.kind.localeCompare(right.bonus.kind);
      if (gap !== 0) return gap;
    }
    return right.createdAt - left.createdAt;
  });
  list.replaceChildren(...ordered.map((idiom) => idiomCard(archive, idiom)));
}

/**
 * 갈피를 바꾼다.
 *
 * 집자소의 일은 둘이다 — 만드는 일과 고르는 일. 한 화면에 세 칸으로 밀어
 * 넣었을 때는 어느 쪽도 제 폭을 못 가졌다(재료 격자에 훈음이 안 들어가고,
 * 성어 카드가 한 줄에 하나씩만 섰다). 갈피로 가르면 각자 넓어진다.
 */
function setTab(tab: "forge" | "equip" | "dev"): void {
  activeTab = tab;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-soul-tab]")) {
    const active = button.dataset.soulTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const view of document.querySelectorAll<HTMLElement>("[data-soul-view]")) {
    view.hidden = view.dataset.soulView !== tab;
  }
}

/** 디버그 갈피는 개발자 모드(백틱 5회)에서만 선다. */
function syncDevTab(): void {
  const tab = document.querySelector<HTMLButtonElement>('[data-soul-tab="dev"]');
  if (!tab) return;
  const enabled = shell.dataset.devMode === "1";
  tab.hidden = !enabled;
  // 켜 놓고 보다가 껐을 때 그 갈피에 갇히지 않게 되돌린다.
  if (!enabled && activeTab === "dev") setTab("forge");
}

function renderTabs(archive: SoulArchive): void {
  const held = Object.values(archive.souls).reduce((sum, count) => sum + count, 0);
  must<HTMLElement>("#soul-tab-forge-note").textContent = `자혼 ${held}`;
  must<HTMLElement>("#soul-tab-equip-note").textContent =
    `${archive.equipped.length} / ${CUSTOM_IDIOM_EQUIP_LIMIT}`;
  syncDevTab();
}

export function renderSoulArchive(): void {
  if (!dialog().open) return;
  const archive = soulArchive();
  renderHoldings(archive);
  renderSlots();
  renderOdds();
  renderForge(archive);
  renderShelf(archive);
  renderTabs(archive);
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

/**
 * 새김 연출 — 인장이 찍히고 새 성어의 음이 떠오른다.
 *
 * 자혼 넷은 되돌릴 수 없이 사라진다. 그 무게에 견주면 토스트 한 줄은 너무
 * 가볍다 — 무엇이 태워졌고 무엇이 남았는지 한 박자 머물러 보여 준다.
 * 차분한 화면·동작 줄이기에서는 움직임 없이 글자만 남는다(CSS 게이트).
 */
function playForgeFx(idiom: CustomIdiom): void {
  const fx = must<HTMLElement>("#soul-forge-fx");
  must<HTMLElement>("#soul-forge-fx-chars").textContent = [...idiom.chars].join(" ");
  must<HTMLElement>("#soul-forge-fx-reading").textContent = idiom.reading;
  fx.hidden = false;
  // 재생 중에 또 새기면 애니메이션이 이어붙지 않도록 한 번 되감는다.
  fx.classList.remove("is-playing");
  void fx.offsetWidth;
  fx.classList.add("is-playing");
  window.setTimeout(() => {
    fx.classList.remove("is-playing");
    fx.hidden = true;
  }, 1_400);
}

function forge(): void {
  const chars = draft.join("");
  const meaning = must<HTMLInputElement>("#soul-meaning-input").value;
  /*
   * 굴림은 여기서 난수를 만들어 넘긴다. 규칙 모듈이 난수를 모르게 두면
   * 시험이 값을 직접 정할 수 있고, 그래서 확률표와 실제 굴림이 어긋나지
   * 않는다는 것을 시험으로 못박을 수 있다.
   */
  const result = createCustomIdiom(soulArchive(), {
    chars,
    meaning,
    axisRoll: Math.random(),
    valueRoll: Math.random(),
    id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    now: Date.now()
  });
  setSoulArchive(result.archive);
  if (result.idiom) {
    freshIdiomId = result.idiom.id;
    playForgeFx(result.idiom);
  }
  showToast(result.message);
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

/* ── 디버그 갈피 ──────────────────────────────────────────────
   개발자 모드(백틱 5회)에서만 선다. 보관소는 판 밖의 장부라 런이 없어도
   손댈 수 있다 — 집자소를 열어 보려고 매번 우두머리를 열 번 잡을 수는 없다.
   ────────────────────────────────────────────────────────── */

/** 이 판(또는 지역)에서 뽑을 수 있는 글자들. 런이 없으면 지역 기본 풀을 쓴다. */
function devPool(): readonly string[] {
  const pool = ctx.engine.summonDefinitions();
  if (pool.length > 0) return pool.map((definition) => definition.char);
  return [...ctx.engine.catalog.activePool].map((definition) => definition.char);
}

function devGrant(): void {
  const char = [...must<HTMLInputElement>("#soul-dev-char").value.trim()][0] ?? "";
  const amount = Math.max(1, Math.min(99, Number(must<HTMLInputElement>("#soul-dev-amount").value) || 1));
  if (!char) {
    showToast("지급할 한자 1자를 적으세요");
    return;
  }
  updateSoulArchive((archive) => gainSoul(archive, char, amount));
  refreshSoulBadge();
  showToast(`${char} 자혼 +${amount}`);
}

function devRandom(): void {
  const pool = devPool();
  if (pool.length === 0) {
    showToast("소환 풀이 비어 있습니다");
    return;
  }
  const chars: string[] = [];
  while (chars.length < 8 && chars.length < pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick && !chars.includes(pick)) chars.push(pick);
  }
  updateSoulArchive((archive) => chars.reduce((next, char) => gainSoul(next, char, 3), archive));
  refreshSoulBadge();
  showToast(`자혼 ${chars.join("")} 각 3개`);
}

function devPoolGrant(): void {
  const chars = devPool().slice(0, 40);
  if (chars.length === 0) {
    showToast("소환 풀이 비어 있습니다");
    return;
  }
  updateSoulArchive((archive) => chars.reduce((next, char) => gainSoul(next, char, 2), archive));
  refreshSoulBadge();
  showToast(`앞 ${chars.length}자 각 2개`);
}

/** 지닌 자혼에서 넷을 골라 바로 한 구 새긴다. 연출도 그대로 탄다. */
function devForge(): void {
  const archive = soulArchive();
  const available: string[] = [];
  for (const [char, count] of Object.entries(archive.souls)) {
    for (let index = 0; index < count; index += 1) available.push(char);
  }
  if (available.length < CUSTOM_IDIOM_LENGTH) {
    showToast("자혼이 넷 이상 있어야 합니다");
    return;
  }
  const picked: string[] = [];
  const pool = [...available];
  while (picked.length < CUSTOM_IDIOM_LENGTH) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  const result = createCustomIdiom(archive, {
    chars: picked.join(""),
    meaning: "",
    axisRoll: Math.random(),
    valueRoll: Math.random(),
    id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    now: Date.now()
  });
  setSoulArchive(result.archive);
  if (result.idiom) {
    freshIdiomId = result.idiom.id;
    playForgeFx(result.idiom);
  }
  showToast(result.message);
  refreshSoulBadge();
}

/** 빈 자리가 차는 데까지 장착한다. */
function devEquipAll(): void {
  updateSoulArchive((archive) =>
    archive.idioms.reduce((next, idiom) => equipCustomIdiom(next, idiom.id), archive)
  );
  showToast("빈 자리까지 장착했습니다");
}

function devClearIdioms(): void {
  updateSoulArchive((archive) => ({ ...archive, idioms: [], equipped: [] }));
  showToast("새긴 성어를 비웠습니다");
}

function devClearAll(): void {
  setSoulArchive(EMPTY_SOUL_ARCHIVE);
  refreshSoulBadge();
  showToast("보관소를 전부 비웠습니다");
}

export function bindSoulArchive(): void {
  if (bound) return;
  bound = true;

  const box = dialog();
  box.addEventListener("click", handleClick);
  must<HTMLButtonElement>("#soul-close").addEventListener("click", () => box.close());
  must<HTMLButtonElement>("#soul-forge-button").addEventListener("click", forge);

  for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-soul-tab]")) {
    tab.addEventListener("click", () => {
      setTab(tab.dataset.soulTab as "forge" | "equip" | "dev");
      renderSoulArchive();
    });
  }
  must<HTMLSelectElement>("#soul-sort").addEventListener("change", (event) => {
    shelfSort = (event.target as HTMLSelectElement).value as typeof shelfSort;
    renderSoulArchive();
  });

  must<HTMLButtonElement>("#soul-dev-grant").addEventListener("click", devGrant);
  must<HTMLButtonElement>("#soul-dev-random").addEventListener("click", devRandom);
  must<HTMLButtonElement>("#soul-dev-pool").addEventListener("click", devPoolGrant);
  must<HTMLButtonElement>("#soul-dev-forge").addEventListener("click", devForge);
  must<HTMLButtonElement>("#soul-dev-equip-all").addEventListener("click", devEquipAll);
  must<HTMLButtonElement>("#soul-dev-clear-idioms").addEventListener("click", devClearIdioms);
  must<HTMLButtonElement>("#soul-dev-clear").addEventListener("click", devClearAll);

  /*
   * 개발자 모드는 창 밖(백틱 5회)에서 켜진다. 창이 열려 있는 동안 켜도
   * 갈피가 그 자리에서 서야 하므로, 같은 키를 여기서도 듣고 다시 그린다.
   */
  window.addEventListener("keydown", (event) => {
    if (event.code === "Backquote" && dialog().open) window.setTimeout(syncDevTab, 0);
  });
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
