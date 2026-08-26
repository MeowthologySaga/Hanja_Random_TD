/*
 * 엔진 이벤트를 화면 연출로 옮기는 다리.
 */
import { CASUAL_STAR_COLORS } from "../core/casual";
import { BOARD_CELLS } from "../core/content";
import { ELEMENT_STYLES, STAGE_COLORS } from "../core/hanzi";
import { type GameEvent, type Point } from "../core/types";
import {
  clampStarLevel,
  IDIOM_SEAL_SIZE,
  idiomCompletionSealImage,
  STAR_RING_SIZE,
  starAscentRingImage
} from "./polish-sprites";
import { bossBanner, ctx, lastAbilityFxByTower, reducedMotion, sound } from "./app-context";
import {
  abilityBurstPool,
  abilityBursts,
  floaterPool,
  floaters,
  idiomRipples,
  projectilePool,
  projectiles,
  pushPooled,
  pushRasterBurst,
  ringPool,
  rings,
  takeAbilityBurst,
  takeFloater,
  takeProjectile,
  takeRing
} from "./battle/fx";
import {
  firstSealCelebration,
  showToast,
  showTowerAbilityPopup,
  showWaveBanner
} from "./hud";
import { showIdiomBrokenResult, showIdiomResult } from "./panels/idiom";

export function processEvent(event: GameEvent): void {
  sound.handle(event);
  switch (event.type) {
    case "shot":
      pushPooled(projectiles, projectilePool, takeProjectile(event), 48);
      break;
    case "damage":
      if (event.critical || event.weakness || event.amount >= 50) {
        const prefix = event.critical ? "치명 " : event.weakness ? "약점 " : "";
        pushPooled(floaters, floaterPool, takeFloater(event.at, prefix + String(Math.round(event.amount)), event.critical ? "#ffe06e" : event.weakness ? "#8ff5c6" : "#f6f0ff", 0.64, event.critical), 48);
      }
      break;
    case "kill":
      pushPooled(floaters, floaterPool, takeFloater(event.at, "+" + String(event.reward), "#ffd86d", 0.72, false), 48);
      // 처치 순간에 먹이 튀는 고리를 남겨 "정리됐다"가 화면에서 읽히게 한다.
      pushPooled(rings, ringPool, takeRing(event.at, "#241d16", 0.42), 32);
      break;
    case "interest":
      showToast("은행 이자 +" + String(event.amount) + "엽전");
      break;
    case "summon":
      if (!event.stored) pushPooled(rings, ringPool, takeRing(event.at, ELEMENT_STYLES[event.tower.wuxing].color, 0.52), 32);
      if (event.helpful && !event.stored) {
        const label = event.helpfulReason === "both" ? "목표·성어 +1" : event.helpfulReason === "idiom" ? "성어 +1" : "목표 +1";
        pushPooled(floaters, floaterPool, takeFloater(event.at, label, event.helpfulReason === "idiom" ? "#c9a8ff" : "#ffd979", 0.68, false), 48);
      }
      break;
    case "concentrate":
      if (event.tower.cell >= 0) {
        const at = BOARD_CELLS[event.tower.cell] as Point;
        pushPooled(rings, ringPool, takeRing(at, ELEMENT_STYLES[event.tower.wuxing].color, 0.9), 32);
        pushPooled(floaters, floaterPool, takeFloater(at, `濃 ${event.level}/3`, ELEMENT_STYLES[event.tower.wuxing].color, 1.05, true), 48);
      }
      break;
    case "evolve":
      pushPooled(rings, ringPool, takeRing(event.at, STAGE_COLORS[event.tower.stage], 0.9), 32);
      pushPooled(floaters, floaterPool, takeFloater(event.at, event.parents.join("+") + "→" + event.tower.char, STAGE_COLORS[event.tower.stage], 1.05, true), 48);
      break;
    case "casualFuse": {
      const color = CASUAL_STAR_COLORS[event.toStar];
      pushPooled(rings, ringPool, takeRing(event.at, color, 1.05), 32);
      pushPooled(floaters, floaterPool, takeFloater(event.at, `${event.fromStar}★×3→${event.toStar}★`, color, 1.15, true), 48);
      // 고리는 "결과" 별 등급으로 고른다. 소모한 자령 등급이 아니다.
      pushRasterBurst(starAscentRingImage(clampStarLevel(event.toStar)), event.at, STAR_RING_SIZE);
      break;
    }
    case "ability": {
      const towerGap = ctx.engine.state.elapsed - (lastAbilityFxByTower.get(event.towerId) ?? -10);
      const globalGap = ctx.engine.state.elapsed - ctx.lastGlobalAbilityFxAt;
      if (!event.persistent && towerGap >= 0.75 && globalGap >= 0.12) {
        pushPooled(abilityBursts, abilityBurstPool, takeAbilityBurst(event), 12);
        lastAbilityFxByTower.set(event.towerId, ctx.engine.state.elapsed);
        ctx.lastGlobalAbilityFxAt = ctx.engine.state.elapsed;
      }
      // 기록 탭 철거 후 능력 발동의 유일한 상시 표면 — 타워 위 말풍선.
      showTowerAbilityPopup(event.towerId, event.glyph, event.name, event.color);
      break;
    }
    case "goal":
      showToast(event.char + " 봉인 목표 완성 · +" + String(event.reward) + "엽전");
      break;
    case "idiom": {
      const points = event.cells.map((cell) => BOARD_CELLS[cell] as Point);
      const center = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }), { x: 0, y: 0 });
      if (event.rejoined) {
        // 재발동은 첫 봉인보다 가볍게 — 파문·인장·대형 플래시 없이 발광과 스택 복귀만.
        ctx.idiomRenderKey = "";
        showIdiomResult(event.reading, event.meaning, event.bonus, event.color, true);
        showToast(`『${event.reading}』 재발동 — 줄이 다시 섰습니다`);
        break;
      }
      for (const point of points) pushPooled(rings, ringPool, takeRing(point, event.color, 1.05), 32);
      // 코덱스 봉인 인장(래스터) + 네 칸 파문 + 4자 플래시를 함께 띄운다.
      pushRasterBurst(idiomCompletionSealImage(), center, IDIOM_SEAL_SIZE);
      // 봉인된 네 칸에서 1→4 순서로 성어 색 파문이 퍼지고, 그 위에 4자가 크게 뜬다.
      idiomRipples.length = 0;
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index] as Point;
        idiomRipples.push({
          at: point,
          color: event.color,
          age: 0,
          delay: reducedMotion ? 0 : index * 0.09,
          duration: reducedMotion ? 0.34 : 0.66
        });
      }
      // 대형 플래시가 `이심전심 · 봉인` 을 이미 크게 말한다. 같은 자리에 뜨던
      // `이심전심 자동 봉인!` 플로터까지 겹치면 배너·플래시·플로터가 한 문장을
      // 세 번 반복해 정작 어느 칸이 봉인됐는지가 안 보인다.
      ctx.idiomFlash = { chars: event.chars, reading: event.reading, color: event.color, at: center, age: 0, duration: reducedMotion ? 0.6 : 1.2 };
      showIdiomResult(event.reading, event.meaning, event.bonus, event.color);
      ctx.idiomRenderKey = "";
      if (ctx.engine.state.idiomSeals.length === 1) firstSealCelebration(event.reading);
      break;
    }
    case "idiomBroken": {
      // 유지형 규칙의 반대편. 발광·스택은 활성 목록을 보고 알아서 꺼지므로
      // 여기서는 "왜 꺼졌는지"만 말한다.
      showToast(`『${event.reading}』 발동 해제 — 줄이 흩어졌습니다`);
      showIdiomBrokenResult(event.reading, event.bonus);
      ctx.idiomRenderKey = "";
      break;
    }
    case "wave":
      bossBanner.textContent = event.boss
        ? "⚠ 우두머리 " + String(event.wave) + " · 약점 " + event.weakness + " ⚠"
        : "웨이브 " + String(event.wave) + " · 약점 " + event.weakness;
      bossBanner.classList.toggle("boss-banner--boss", event.boss);
      bossBanner.classList.remove("boss-banner--idiom");
      showWaveBanner();
      break;
    case "phase":
      break;
  }
}
