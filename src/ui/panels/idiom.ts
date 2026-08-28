/*
 * 사자성어 패널과 발동 배지.
 */
import { idiomById, IDIOM_ORDER_SEALS, type IdiomDefinition } from "../../core/idioms";
import { learningInfoForNotation, type LearningInfo } from "../../core/learning";
import { idiomReadingInfoForNotation } from "../../core/notation";
import { notationBadgeText, notationShortHtml } from "../notation-substitute";
import type { IdiomSeal } from "../../core/types";
import { ctx, idiomResult, idiomTab, must, toast } from "../app-context";
import { escapeHtml } from "../format";
import { showToast } from "../hud";

export function resetIdiomResult(): void {
  idiomResult.classList.remove("is-active");
  idiomResult.style.removeProperty("--idiom-result-color");
  must<HTMLElement>("#idiom-result-glyph").textContent = "四";
  must<HTMLElement>("#idiom-result-name").textContent = "한 줄에 네 글자를 순서대로";
  must<HTMLElement>("#idiom-result-meaning").textContent = "배치된 자령을 자동으로 판정합니다.";
  must<HTMLElement>("#idiom-result-bonus").textContent = "자동 판정";
}

export function showIdiomResult(reading: string, meaning: string, bonus: string, color: string, rejoined = false): void {
  idiomResult.style.setProperty("--idiom-result-color", color);
  must<HTMLElement>("#idiom-result-glyph").textContent = "四";
  must<HTMLElement>("#idiom-result-name").textContent = reading + (rejoined ? " 재발동" : " 자동 발동");
  must<HTMLElement>("#idiom-result-meaning").textContent = meaning;
  must<HTMLElement>("#idiom-result-bonus").textContent = bonus;
  idiomResult.classList.remove("is-active");
  void idiomResult.offsetWidth;
  idiomResult.classList.add("is-active");
  idiomTab.classList.remove("has-update");
  void idiomTab.offsetWidth;
  idiomTab.classList.add("has-update");
}

/** 줄이 흩어졌을 때의 성어 카드 — 금박을 걷고 회갈로 내린다. */
export function showIdiomBrokenResult(reading: string, bonus: string): void {
  idiomResult.style.setProperty("--idiom-result-color", "#9d8f78");
  must<HTMLElement>("#idiom-result-glyph").textContent = "四";
  must<HTMLElement>("#idiom-result-name").textContent = reading + " 발동 해제";
  must<HTMLElement>("#idiom-result-meaning").textContent = "네 자령이 줄을 벗어났습니다. 다시 세우면 재발동합니다.";
  must<HTMLElement>("#idiom-result-bonus").textContent = bonus + " 중단";
  idiomResult.classList.remove("is-active");
  void idiomResult.offsetWidth;
  idiomResult.classList.add("is-active");
}

/*
 * 1회성 성어 코치 — 스펙 6라운드 E1.
 *
 * 발동 규칙은 지금까지 성어 탭 안 10px 한 줄에만 있었고, 재료가 손에 들어온
 * 순간에는 아무 말도 없었다. 추적 중인 성어의 글자를 둘 이상 갖게 된 최초의
 * 순간에 한 번만 규칙을 말하고, 자세한 건 성어 목표 탭에 있다고 가리킨다.
 */
const IDIOM_HINT_STORAGE_KEY = "hanja-td:idiom-hint-v1";

let idiomHintHandled = false;

function idiomHintAlreadySeen(): boolean {
  try {
    return window.localStorage.getItem(IDIOM_HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markIdiomHintSeen(): void {
  try {
    window.localStorage.setItem(IDIOM_HINT_STORAGE_KEY, "1");
  } catch {
    // 저장이 막혀 있어도 이번 판 안내는 정상 동작한다.
  }
}

/**
 * 성어·목표 탭을 세 번 맥동시켜 "더 볼 곳"을 짚는다.
 *
 * 트랙 B 통합 후 성어 목표는 목표 서책(#goal-tab)이 담당한다 — 상태를 보는
 * 성어 탭과 목표를 고르는 서책 탭을 함께 맥동시킨다.
 */
function pulseIdiomGoalTab(): void {
  const tabs = [idiomTab, document.querySelector<HTMLButtonElement>("#goal-tab")];
  for (const tab of tabs) {
    if (!tab) continue;
    tab.classList.remove("is-hint-pulsing");
    void tab.offsetWidth;
    tab.classList.add("is-hint-pulsing");
    window.setTimeout(() => tab.classList.remove("is-hint-pulsing"), 2600);
  }
}

function maybeShowIdiomHint(target: IdiomDefinition | undefined): void {
  if (idiomHintHandled || !target) return;
  if (ctx.engine.idiomProgress(target.id).owned < 2) return;
  idiomHintHandled = true;
  if (idiomHintAlreadySeen()) return;
  markIdiomHintSeen();
  showToast(`${target.chars} 재료가 모이고 있어요 — 같은 진의 한 줄(가로·세로·대각선)에 ①→④ 순서로 놓으면 발동! (역순도 가능)`);
  // 두 줄짜리 안내라 평소 자리(bottom 45px)에서는 지도·강조 버튼과 겹친다.
  toast.classList.add("toast--idiom-hint");
  window.setTimeout(() => toast.classList.remove("toast--idiom-hint"), 2000);
  pulseIdiomGoalTab();
}

export function renderIdiomHud(): void {
  const target = ctx.engine.currentIdiomTarget();
  const ownedSignature = ctx.engine.state.towers.map((tower) => tower.char).sort().join("");
  // R18: 기록(id)과 활성 여부가 함께 열쇠에 들어가야 해제·재발동이 즉시 반영된다.
  const sealSignature = ctx.engine.state.idiomSeals.map((seal) => `${seal.idiomId}:${seal.active ? "on" : "off"}`).join(",");
  /*
   * [2차 감사] 열쇠에 표기 축이 빠져 있었다. 이 HUD 는 성어의 읽기와 자령
   * 훈음을 그리는데(idiomReadingInfoForNotation · notationBadgeText), 표기를
   * 바꿔도 봉인 상태·목표·보유 글자가 그대로면 열쇠가 같아 옛 읽기가 남았다.
   * 발동 중 성어 스택(renderActiveIdioms)은 이미 넣고 있었다 — 같은 줄에 세운다.
   */
  const key = sealSignature + "|" + (target?.id ?? "done") + "|" + ownedSignature + "|" + ctx.engine.state.notation;
  if (key === ctx.idiomRenderKey) return;
  ctx.idiomRenderKey = key;
  maybeShowIdiomHint(target);
  /*
   * 분모를 걷었다. 「0 / 5」의 5는 상한이 아니라 이 판 명단의 크기였는데,
   * 사람은 그것을 "다섯 구까지만 된다"로 읽었다. 성어에는 상한이 없다.
   * 게다가 장착한 커스텀만큼 명단이 길어지므로 분모는 판마다 달라져
   * 기준으로도 쓸모가 없다.
   *
   * 카운트는 "이 런에서 봉인해 본" 달성 기록이다. 지금 몇 구가 살아 있는지는
   * 아래 상태 줄이 따로 말한다.
   */
  must<HTMLElement>("#idiom-count").textContent = String(ctx.engine.state.idiomSeals.length) + "구";
  must<HTMLElement>("#idiom-tab-count").textContent = String(ctx.engine.state.idiomSeals.length);
  renderIdiomSealStatus();
  const hud = must<HTMLElement>("#idiom-hud");
  if (!target) {
    const activeCount = ctx.engine.activeIdiomSeals().length;
    hud.classList.add("idiom-hud--complete");
    must<HTMLElement>("#idiom-glyphs").innerHTML = ctx.engine.idioms().map((idiom) => `<i class="${ctx.engine.isIdiomSealActive(idiom.id) ? "is-owned" : ""}" style="--idiom:${idiom.color}">四</i>`).join("");
    must<HTMLElement>("#idiom-name").textContent = "사자성어 전서 완성";
    must<HTMLElement>("#idiom-meaning").textContent = "각 성구의 보너스는 네 자령이 그 줄을 지키는 동안만 발동합니다.";
    must<HTMLElement>("#idiom-bonus").textContent = `발동 중 ${activeCount} / ${ctx.engine.idioms().length}구`;
    must<HTMLElement>("#idiom-hint").textContent = activeCount === ctx.engine.idioms().length ? "四句成陣 · 모든 성어 발동 중" : "흩어진 줄을 다시 세우면 재발동합니다";
    return;
  }
  hud.classList.remove("idiom-hud--complete");
  const counts = new Map<string, number>();
  for (const tower of ctx.engine.state.towers) counts.set(tower.char, (counts.get(tower.char) ?? 0) + 1);
  const used = new Map<string, number>();
  const glyphs = [...target.chars].map((char, index) => {
    const occurrence = (used.get(char) ?? 0) + 1;
    used.set(char, occurrence);
    const owned = (counts.get(char) ?? 0) >= occurrence;
    // 트랙 N: "N번째 글자" 만으로는 전장 명패의 ①②③④ 인장과 이어지지 않았다.
    return `<i class="${owned ? "is-owned" : ""}" style="--idiom:${target.color}" title="${IDIOM_ORDER_SEALS[index] ?? String(index + 1)} 성어의 ${index + 1}번째 글자 — 전장에서 이 글자를 가진 자령에 같은 인장이 붙습니다">${char}</i>`;
  }).join("");
  must<HTMLElement>("#idiom-glyphs").innerHTML = glyphs;
  const targetReading = idiomReadingInfoForNotation(target, ctx.engine.state.notation, ctx.engine.state.region);
  const targetMark = notationBadgeText(targetReading);
  must<HTMLElement>("#idiom-name").textContent = `${targetReading.reading}${targetMark ? ` (${targetMark})` : ""}`;
  must<HTMLElement>("#idiom-meaning").textContent = target.meaning;
  must<HTMLElement>("#idiom-bonus").textContent = target.bonus.label;
  must<HTMLElement>("#idiom-bonus").style.setProperty("--idiom", target.color);
  const missingCraft = [...new Set(target.chars)]
    .map((char) => ctx.engine.catalog.definitions.get(char))
    .find((definition) => definition?.acquisition === "craft" && (counts.get(definition.char) ?? 0) === 0);
  must<HTMLElement>("#idiom-hint").textContent = missingCraft
    ? "먼저 " + missingCraft.char + " = " + missingCraft.parents.join("+") + " 조합"
    // 한 줄에 담기는 길이라야 말줄임 없이 보인다. "배치"는 화살표가 대신한다.
    // 트랙 N: 숫자 대신 인장 글리프를 써 전장 표시와 같은 말로 가리킨다.
    : `한 줄에 ${IDIOM_ORDER_SEALS[0]}→${IDIOM_ORDER_SEALS[3]} 순서 → 자동 발동`;
}

/**
 * 성어 탭 봉인 상태 줄 — R18.
 *
 * 유지형 규칙에서는 "봉인했다"와 "지금 효과가 산다"가 다른 말이 됐다. 탭 위쪽
 * 카운트는 달성 기록을 세므로, 한 번이라도 봉인한 성구마다 지금 상태를 한 줄로
 * 덧붙인다. 금박은 발동 중, 회갈은 기록만 남고 줄이 흩어진 상태다.
 */
function renderIdiomSealStatus(): void {
  const status = must<HTMLElement>("#idiom-seal-status");
  const seals = ctx.engine.state.idiomSeals;
  status.hidden = seals.length === 0;
  if (seals.length === 0) {
    status.innerHTML = "";
    return;
  }
  status.innerHTML = seals
    .map((seal) => {
      const idiom = idiomById(ctx.engine.state.region, seal.idiomId);
      if (!idiom) return "";
      const label = seal.active ? "발동 중" : "발동 이력 · 지금은 흩어짐";
      return `<div class="idiom-seal-row ${seal.active ? "is-live" : "is-scattered"}" style="--idiom:${idiom.color}"><b>${escapeHtml(idiom.chars)}</b><span>${notationShortHtml(idiomSealReading(idiom), ctx.engine.state.notation, "idiom")}</span><em>${escapeHtml(shortIdiomBonusLabel(idiom.bonus.label))}</em><mark>${label}</mark></div>`;
    })
    .join("");
}

/** `모든 자령 사거리 +12` → `사거리 +12`. 12px 배지 한 줄에 담기게 주어를 턴다. */
function shortIdiomBonusLabel(label: string): string {
  return label.replace(/^모든 자령 /, "").replace(/^모든 적 /, "적 ").replace(/^합성할 때마다 /, "합성 ");
}

/*
 * ── 트랙 K (gripe #11-2·3) ────────────────────────────────────────────
 *
 * 좌상단 발동 칩은 한자 4자만 보여 줬다. 한자 학습자가 읽을 수 없는 표찰이라
 * 독음을 병기하고, 효과 문구는 "景行維賢 적 이동 속도 -…" 처럼 수치가 잘렸다.
 * 요약은 허용하되 수치는 절대 자르지 않는다 — 설명부와 수치를 따로 조판해
 * 수치 토막에만 flex-shrink: 0 을 준다(줄이 모자라면 수치가 다음 줄로 내려간다).
 * 전문(뜻풀이·참여 자령 4자)은 호버 팝오버가 맡는다 — 전장 자령 학습 카드와
 * 같은 시각 언어다.
 */

/** `적 이동 속도 -10%` → { text: "적 이동 속도", value: "-10%" }. 수치가 없으면 value 는 빈 문자열. */
function splitIdiomBonus(label: string): { text: string; value: string } {
  const match = /^(.*?)\s*([+-]?\d+(?:\.\d+)?\s*%?)$/u.exec(label);
  if (!match) return { text: label, value: "" };
  return { text: (match[1] ?? "").trim(), value: (match[2] ?? "").replace(/\s+/gu, "") };
}

/**
 * 성어 읽기 + 합산 판정 — 성어 표기가 나오는 모든 자리가 이 한 줄을 거친다.
 * 짧은/긴 읽기가 같으므로 배지 조판 함수에 그대로 넘길 수 있게 맞춰 둔다.
 */
function idiomSealReading(idiom: IdiomDefinition): { short: string; reading: string } & ReturnType<typeof idiomReadingInfoForNotation> {
  const info = idiomReadingInfoForNotation(idiom, ctx.engine.state.notation, ctx.engine.state.region);
  return { ...info, short: info.reading };
}

/** 봉인된 네 칸에 실제로 선 자령 — 없으면 성어 글자로 대신 채운다(해제 직전 한 프레임). */
function sealParticipants(idiom: IdiomDefinition, seal: IdiomSeal): Array<{ char: string; info: LearningInfo }> {
  const chars = [...idiom.chars];
  const notation = ctx.engine.state.notation;
  const placed = seal.cells
    .map((cell) => ctx.engine.state.towers.find((tower) => tower.cell === cell)?.char)
    .filter((char): char is string => Boolean(char));
  const source = placed.length === chars.length ? placed : chars;
  return source.map((char) => ({ char, info: learningInfoForNotation(notation, char) }));
}

/** 터치·키보드용 축약본 — 팝오버와 같은 내용을 한 줄로 접는다. */
function activeIdiomTitle(idiom: IdiomDefinition, seal: IdiomSeal, reading: string): string {
  const parts = sealParticipants(idiom, seal)
    .map((part) => {
      const mark = notationBadgeText(part.info);
      return `${part.char}(${part.info.short}${mark ? ` · ${mark}` : ""})`;
    })
    .join(" · ");
  return `${idiom.chars} ${reading} — ${idiom.meaning} · 발동 효과 ${idiom.bonus.label} · 참여 자령 ${parts} — 눌러서 발동 칸으로 이동`;
}

/** 호버 팝오버 — 한자 4자 · 독음 · 뜻풀이 · 발동 효과 · 참여 자령 4자. */
function activeIdiomPopHtml(idiom: IdiomDefinition, seal: IdiomSeal, reading: string): string {
  const notation = ctx.engine.state.notation;
  const participants = sealParticipants(idiom, seal)
    .map((part) => `<span class="aip-jar"><b>${escapeHtml(part.char)}</b><em>${notationShortHtml(part.info, notation)}</em></span>`)
    .join("");
  return `<span class="active-idiom-pop" aria-hidden="true">`
    + `<span class="aip-head"><b class="aip-chars">${escapeHtml(idiom.chars)}</b><strong class="aip-reading">${escapeHtml(reading)}</strong></span>`
    + `<em class="aip-meaning">${escapeHtml(idiom.meaning)}</em>`
    + `<span class="aip-line"></span>`
    + `<span class="aip-row"><i>발동 효과</i><b>${escapeHtml(idiom.bonus.label)}</b></span>`
    + `<span class="aip-row aip-row--jars"><i>참여 자령</i><span class="aip-jars">${participants}</span></span>`
    + `<span class="aip-line"></span>`
    + `<span class="aip-foot">눌러서 발동 칸으로 이동 · 줄이 흩어지면 해제</span>`
    + `</span>`;
}

export function renderActiveIdioms(): void {
  // R18: 스택은 "지금 발동 중"만 센다. 흩어진 봉인은 기록으로만 남아 성어 탭에 보인다.
  const seals = ctx.engine.activeIdiomSeals();
  // 팝오버가 참여 자령 4자를 읽으므로 칸·표기가 바뀌면 다시 그려야 한다.
  const key = seals.map((seal) => `${seal.idiomId}@${seal.cells.join("-")}`).join(",") + "|" + ctx.engine.state.notation;
  if (key === ctx.activeIdiomsRenderKey) return;
  ctx.activeIdiomsRenderKey = key;
  const stack = must<HTMLElement>("#active-idioms");
  // 성어 목표는 다섯이라 그 이상은 생길 수 없지만, 전장을 덮지 않도록 못을 박는다.
  const visible = seals.slice(0, 5);
  stack.innerHTML = visible
    .map((seal) => {
      const idiom = idiomById(ctx.engine.state.region, seal.idiomId);
      if (!idiom) return "";
      const bonus = splitIdiomBonus(shortIdiomBonusLabel(idiom.bonus.label));
      const readingInfo = idiomSealReading(idiom);
      const reading = readingInfo.reading;
      const readingMark = notationBadgeText(readingInfo);
      const value = bonus.value ? `<strong class="active-idiom-value">${escapeHtml(bonus.value)}</strong>` : "";
      return `<button type="button" class="active-idiom" data-active-idiom="${escapeHtml(seal.idiomId)}" style="--idiom:${idiom.color}" title="${escapeHtml(activeIdiomTitle(idiom, seal, reading))}" aria-label="${escapeHtml(reading)}${readingMark ? ` (${escapeHtml(readingMark)})` : ""} 발동 · ${escapeHtml(idiom.meaning)} · ${escapeHtml(idiom.bonus.label)} · 눌러서 해당 네 칸으로 이동">`
        + `<b class="active-idiom-chars">${escapeHtml(idiom.chars)}</b>`
        + `<i class="active-idiom-reading">${notationShortHtml(readingInfo, ctx.engine.state.notation, "idiom")}</i>`
        + `<span class="active-idiom-effect"><em>${escapeHtml(bonus.text)}</em>${value}</span>`
        + activeIdiomPopHtml(idiom, seal, reading)
        + `</button>`;
    })
    .join("");
  stack.classList.toggle("is-empty", visible.length === 0);
}
