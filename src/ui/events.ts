/*
 * 엔진 이벤트를 화면 연출로 옮기는 다리.
 */
import { CASUAL_STAR_COLORS } from "../core/casual";
import { BOARD_CELLS, bossTimeLimitForWave, waveClearNotice } from "../core/content";
import { ELEMENT_STYLES, STAGE_COLORS } from "../core/hanzi";
import { learningInfoForNotation } from "../core/learning";
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
  dressWaveBanner,
  firstSealCelebration,
  showToast,
  showTowerAbilityPopup,
  showWaveBanner
} from "./hud";
import { showIdiomBrokenResult, showIdiomResult } from "./panels/idiom";
import { collectSoul } from "./souls";
import { noteWaveChar } from "./run-trace";
import { waveSoundDurationMs } from "./audio";
import { readingUtterance, speakReading } from "./tts";
import { noteEnemyHit } from "./battle/enemy-health";

/** 지금 기다리고 있는 웨이브 읽기 — 새 웨이브가 열리거나 판이 끝나면 거둔다. */
let waveReadingTimer = 0;

/**
 * 기다리던 읽기를 거둔다 (v042, 반박이 잡았다).
 *
 * 취소 자리가 「다음 웨이브 이벤트」 하나뿐이면 타이머가 **판 경계를 넘어 산다** —
 * 웨이브가 열리고 3초 안에 지거나 메뉴로 나가면, 끝난 판의 글자를 종료 화면 위에서
 * 읽는다. 판을 여닫는 자리마다 거둔다.
 */
export function cancelWaveReading(): void {
  if (waveReadingTimer === 0) return;
  clearTimeout(waveReadingTimer);
  waveReadingTimer = 0;
}

/**
 * 이번 웨이브의 글자를 **소리로도** 준다 (v042).
 *
 * 읽기 소리가 붙어 있던 자리는 저장소를 통틀어 **한 곳**이었다(부적 완성). 그 한
 * 자리는 부적 모드 ON + 부적 탭 열기 + 획 다 긋기 + [완성] 누르기까지 사람 손 대여섯
 * 번이 드는 **조건부** 통로다. 저절로 닿는 통로가 하나도 없었다.
 *
 * 웨이브 글자를 고른 까닭은 빈도다 — 판당 **97.17회**(서로 다른 글자 90.83자), 중앙
 * 간격 **22.8초**. `speakReading` 은 말하기 전에 `synthesis.cancel()` 을 부르므로
 * 간격이 곧 소음과 도움을 가르는데, 이 자리는 300표본에서 3초 안에 겹치는 것이 0건이다.
 *
 * **소환 공개와 성어 발동에는 안 붙인다.** 소환 카드는 판당 311장에 카드 사이 중앙
 * 간격 0.3초라 막당 마지막 한 장 빼고 전부 잘린다 — 「읽어 준다」가 아니라 「말을
 * 자른다」가 된다. 성어는 판당 0.67회로 값이 안 나오는 데다, 이벤트의 읽기가 표기 축을
 * 모르는 고정 한국어 독음이라 일본 음훈 판에서 한글을 일본어 목소리로 읽는다.
 *
 * 무엇을 읽을지는 이미 배너가 쓴 그 값을 그대로 쓴다 — 코어(learningInfoForNotation)가
 * 만든 한 곳에서 나오므로 화면과 소리가 갈라지지 않는다.
 */
function speakWaveReading(char: string, reading: string, boss: boolean): void {
  cancelWaveReading();
  if (!ctx.readingVoice || !char || !reading) return;
  const notation = ctx.engine.state.notation;
  const utterance = readingUtterance(char, notation, reading);
  if (!utterance) return;
  waveReadingTimer = window.setTimeout(() => {
    waveReadingTimer = 0;
    /*
     * 기다리는 사이에 판이 바뀔 수 있다 — 껐거나, 졌거나, 메뉴로 나갔거나.
     * 말하기 직전에 다시 본다. 3.6초는 그런 일이 실제로 일어나는 길이다.
     */
    if (!ctx.readingVoice) return;
    if (ctx.engine.state.phase !== "prep" && ctx.engine.state.phase !== "combat") return;
    speakReading(utterance, {
      // 중국어 목소리가 없는 기기에서는 적힌 대로(병음) 읽는 편이 침묵보다 낫다.
      fallbackText: reading,
      onStart: () => sound.duckForSpeech(true),
      onEnd: () => sound.duckForSpeech(false)
    });
  }, waveSoundDurationMs(boss));
}

export function processEvent(event: GameEvent): void {
  sound.handle(event);
  switch (event.type) {
    case "shot":
      pushPooled(projectiles, projectilePool, takeProjectile(event), 48);
      break;
    case "damage":
      /*
       * 피해는 **글자로 띄우지 않는다.**
       *
       * 예전에는 「약점 48」 같은 수치가 타격마다 튀어 올랐다. 눈에 띄는 타격만
       * 고른다는 뜻이었는데, 웨이브 약점 오행에 맞춰 짓는 것이 정석이라 사실상
       * 모든 타격이 그 조건에 걸려 48개짜리 풀이 늘 꽉 찼다 — 화면이 숫자 벽이
       * 됐다("데미지 문구 너무 눈 아파서" — 사용자).
       *
       * 대신 그 적의 체력바에 자국을 남긴다. 앞 띠는 곧바로 줄고 뒤 띠가 잠깐
       * 머물렀다 따라 내려오므로, 얼마나 깎였는지가 그 간격으로 읽힌다
       * (battle/enemy-health.ts).
       */
      noteEnemyHit(event.enemyId);
      break;
    case "kill":
      pushPooled(floaters, floaterPool, takeFloater(event.at, "+" + String(event.reward), "#ffd86d", 0.72, false), 48);
      // 처치 순간에 먹이 튀는 고리를 남겨 "정리됐다"가 화면에서 읽히게 한다.
      pushPooled(rings, ringPool, takeRing(event.at, "#241d16", 0.42), 32);
      break;
    case "soul":
      // 자혼은 판이 끝나도 남는 유일한 수확이다. 우두머리의 혼은 크게,
      // 야생의 혼은 작게 띄워 "드물게 떨어지는 것"이 화면에서도 드물게 보이게 한다.
      collectSoul(event.char);
      pushPooled(rings, ringPool, takeRing(event.at, "#c9a8ff", event.boss ? 1.1 : 0.6), 32);
      pushPooled(
        floaters,
        floaterPool,
        takeFloater(event.at, `${event.char} 자혼`, "#c9a8ff", event.boss ? 1.15 : 0.8, event.boss),
        48
      );
      // 자혼은 판이 끝나도 남는 유일한 수확이다 — 그 글자를 읽어 주고 넘긴다(v042).
      if (event.boss) {
        const soulReading = learningInfoForNotation(ctx.engine.state.notation, event.char).short;
        showToast(`${event.char} ${soulReading} 자혼을 얻었습니다 — 자혼 넷을 모으면 나만의 성어를 새깁니다`);
      }
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
        // 재발동은 첫 발동보다 가볍게 — 파문·인장·대형 플래시 없이 발광과 스택 복귀만.
        ctx.idiomRenderKey = "";
        showIdiomResult(event.reading, event.meaning, event.bonus, event.color, true);
        showToast(`『${event.reading}』 재발동 — 줄이 다시 섰습니다`);
        break;
      }
      for (const point of points) pushPooled(rings, ringPool, takeRing(point, event.color, 1.05), 32);
      // 코덱스 봉인 인장(래스터) + 네 칸 파문 + 4자 플래시를 함께 띄운다.
      pushRasterBurst(idiomCompletionSealImage(), center, IDIOM_SEAL_SIZE);
      // 발동한 네 칸에서 1→4 순서로 성어 색 파문이 퍼지고, 그 위에 4자가 크게 뜬다.
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
      ctx.idiomFlash = { chars: event.chars, reading: event.reading, meaning: event.meaning, color: event.color, at: center, age: 0, duration: reducedMotion ? 0.6 : 1.2 };
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
      /*
       * 우두머리 배너는 **초 수를 말한다** (v041). 여태 "⚠ 우두머리 10 · 약점 水 ⚠"
       * 라고만 하고 제한시간이 있다는 사실 자체를 알리지 않았다.
       */
      const bossLimit = event.boss ? bossTimeLimitForWave(event.wave) : null;
      /*
       * 이 웨이브의 **글자를 읽어 준다** (v042).
       *
       * 한 웨이브는 한 글자이고 그 글자가 적의 몸에 찍혀 나온다 — 100웨이브면 화면
       * 한가운데서 100글자를 만나는 셈이라 부적(≤100장)보다도 큰 학습 통로다. 그런데
       * 여태 그 글자를 **읽어 주는 자리가 한 곳도 없었다**(적 몸통의 12px 글자뿐).
       * 배너는 폭이 잡혀 있지 않고 웨이브가 열리는 순간에만 서므로, 읽기를 실을 수
       * 있는 유일한 자리다.
       *
       * 읽기 문자열은 코어(learningInfoForNotation)가 만든 것을 그대로 쓴다 —
       * 표기 축(한국 훈음·일본 음훈·한어병음)이 화면마다 갈리지 않게.
       */
      const waveReading = event.char ? learningInfoForNotation(ctx.engine.state.notation, event.char).short : "";
      const waveGlyph = event.char ? `${event.char} ${waveReading} · ` : "";
      bossBanner.textContent = event.boss
        ? "⚠ 우두머리 " + String(event.wave) + " · " + waveGlyph + "약점 " + event.weakness + (bossLimit === null ? "" : " · 제한 " + String(bossLimit) + "초") + " ⚠"
        : "웨이브 " + String(event.wave) + " · " + waveGlyph + "약점 " + event.weakness;
      dressWaveBanner(event.boss ? "boss" : "plain");
      showWaveBanner();
      speakWaveReading(event.char, waveReading, event.boss);
      // [v042] 판이 끝날 때 되짚을 수 있게 이 글자를 적어 둔다 — 여태 그냥 증발했다.
      noteWaveChar(event.char, event.wave);
      break;
    case "waveCleared":
      /*
       * 「막았다」를 전장이 말한다 (v042).
       *
       * 여태 이 순간에 화면이 하는 일은 맨 아래 12px 한 줄이 바뀌는 것뿐이었다.
       * 실측하면 한 웨이브에 처치 신호가 평균 27번(1장 6.5번) 뜨므로 마지막 한
       * 마리는 그 27번째와 구별되지 않고, 준비 시간을 되찾은 웨이브가 85%인데
       * 그 85번이 전부 조용했다.
       *
       * 배너를 빌린 까닭은 자리다. 이 순간과 다음 웨이브 배너 사이에는 준비 시간이
       * 통째로 놓여 있어(빨리 시작을 눌러도 애니메이션이 서로를 취소한다) 겹치지
       * 않는다. 문장은 코어가 만든다 — 화면은 자리에만 놓는다.
       */
      bossBanner.textContent = waveClearNotice(event.wave, event.reward, event.interest, event.boss, event.bossSpare);
      dressWaveBanner("clear");
      showWaveBanner();
      break;
    case "phase":
      break;
  }
}
