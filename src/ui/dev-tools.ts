/*
 * 개발자 디버그 패널 (DEV-TOOLS).
 *
 * "개발하느라 바빠서 사자성어 발동을 영상으로 처음 봤다" — 성어 발동·8성
 * 개안·보스전 같은 장면을 몇 초 안에 재현하는 개발자 도구다. 기존 개발자
 * 모드(백틱 5회, shell.dataset.devMode === "1")가 켜진 동안에만 우하단 「開」
 * 버튼과 패널이 존재하고, 모드를 끄면 즉시 소멸한다(프로덕션 빌드에도
 * 실리지만 이 제스처 뒤에만 존재 — 사용자 의도).
 *
 * 조작은 전부 엔진의 공개 표면으로만 한다: engine.state 직접 변형(공개
 * 객체), setIdiomTarget()·resolveIdiomFormations() 같은 공개 메서드, 그리고
 * ctx 렌더 키 초기화. 선례는 e2e 힌트 스펙(__HANJA_CTX_QA__)과 데모 영상
 * 제작 스크립트(.codex_tmp/demo/record-s4dev.mjs)다 — 성어 4자를 지급해
 * 한 줄에 3자를 세우고 마지막 1자를 보관고에 두는 레시피를 그대로 옮겼다.
 * core/game.ts 는 한 줄도 만지지 않는다.
 */
import { GWICHEON_MIN_STAR, gwicheonChargeSeconds } from "../core/abilities";
import { casualNaturalStar } from "../core/casual";
import { BOARD_FORMATIONS, CELLS_PER_FORMATION, MAX_ENEMIES } from "../core/content";
import { type GameEngine } from "../core/game";
import { WUXING_ORDER } from "../core/hanzi";
import { type CasualStar, type HanziDefinition, type Tower, type Wuxing } from "../core/types";
import { EMPTY_SOUL_ARCHIVE, gainSoul, soulsHeld } from "../core/soul-archive";
import { ctx, must, shell } from "./app-context";
import { refreshSoulBadge } from "./panels/souls";
import { setSoulArchive, soulArchive, updateSoulArchive } from "./souls";
import { handleAction } from "./hud";

/*
 * createTower 는 런타임에는 늘 있던 공개 표면이지만 TS 표면에서는 private 다.
 * record-s4dev.mjs 가 JS 에서 그대로 부르던 것을 타입만 좁혀 부른다 —
 * 코어 수정 없이 검증된 레시피를 재사용하기 위한 유일한 통로다.
 */
interface EngineBackstage {
  createTower(definition: HanziDefinition, cell: number): Tower;
}

function backstage(engine: GameEngine): EngineBackstage {
  return engine as unknown as EngineBackstage;
}

/** 디버그 스폰 적 id 는 엔진의 일련번호와 절대 겹치지 않는 대역을 쓴다. */
const DEV_ENEMY_ID_BASE = 1_000_000;

let devEnemySerial = 0;

/** 성어 4자를 세울 줄 — 첫 개방 진의 두 번째 가로줄(영상 레시피와 동일). */
const IDIOM_STAGE_ROW = 1;

const TOTAL_CELLS = BOARD_FORMATIONS.length * CELLS_PER_FORMATION;

/** 웨이브 전환 감시 토큰 — 나중 요청이 이전 감시를 대체한다. */
let waveWatchToken = 0;

function ok(message: string): void {
  handleAction({ ok: true, message: `[개발] ${message}` });
}

function fail(message: string): void {
  handleAction({ ok: false, message: `[개발] ${message}` });
}

function runActive(): boolean {
  const phase = ctx.engine.state.phase;
  if (phase === "prep" || phase === "combat") return true;
  fail("진행 중인 수비전이 없습니다 — 출정 후 사용하세요");
  return false;
}

/** phase 가 조건에 닿는 순간 한 번 실행한다. 런이 끝나거나 교체되면 그만둔다. */
function whenPhase(engine: GameEngine, phase: "prep" | "combat", action: () => void): void {
  const token = ++waveWatchToken;
  const tick = (): void => {
    if (token !== waveWatchToken || ctx.engine !== engine) return;
    const current = engine.state.phase;
    if (current === phase) {
      action();
      return;
    }
    if (current === "victory" || current === "defeat" || current === "title") return;
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

/* ── 성어 연출 ─────────────────────────────────────────────── */

/**
 * 줄을 막는 자령을 다른 빈 칸으로 민다. 개방 칸이 다 찼으면 보관고로 내린다.
 * (record-s4dev 는 같은 진 안에서만 밀었지만, 진이 가득한 경우까지 덮는다)
 */
function relocateBlocker(blocker: Tower, reserved: ReadonlySet<number>): void {
  const engine = ctx.engine;
  const occupied = new Set(engine.state.towers.map((tower) => tower.cell));
  for (let cell = 0; cell < TOTAL_CELLS; cell += 1) {
    if (reserved.has(cell) || occupied.has(cell) || !engine.isCellUnlocked(cell)) continue;
    blocker.cell = cell;
    return;
  }
  engine.state.towers = engine.state.towers.filter((tower) => tower.id !== blocker.id);
  blocker.cell = -1;
  engine.state.inventoryTowers.push(blocker);
}

function discover(char: string): void {
  if (!ctx.engine.state.discoveredChars.includes(char)) ctx.engine.state.discoveredChars.push(char);
}

/** cell 에 이 글자의 자령을 세운다 — 이미 서 있으면 재사용, 보관고에 있으면 꺼내 배치. */
function placeCharAt(definition: HanziDefinition, cell: number, reserved: ReadonlySet<number>): Tower {
  const engine = ctx.engine;
  const state = engine.state;
  const here = state.towers.find((tower) => tower.cell === cell);
  if (here && here.char === definition.char) return here;
  if (here) relocateBlocker(here, reserved);
  const stored = state.inventoryTowers.find((tower) => tower.char === definition.char && !tower.locked);
  if (stored) {
    state.inventoryTowers = state.inventoryTowers.filter((tower) => tower.id !== stored.id);
    stored.cell = cell;
    state.towers.push(stored);
    return stored;
  }
  const tower = backstage(engine).createTower(definition, cell);
  state.towers.push(tower);
  discover(definition.char);
  return tower;
}

/**
 * [성어 발동 보기] / [끝까지 자동].
 *
 * 추적 성어의 4자를 지급해 첫 개방 진의 한 줄에 3자를 세우고, 마지막 1자는
 * 보관고에 둔다 — "마지막 글자만 놓으면 발동" 상태(데모 영상 레시피).
 * placeAll 이면 4자째까지 세우고 resolveIdiomFormations() 로 즉시 발동한다.
 */
function stageIdiom(idiomId: string, placeAll: boolean): void {
  if (!runActive()) return;
  const engine = ctx.engine;
  const state = engine.state;
  const idiom = engine.allIdioms().find((candidate) => candidate.id === idiomId);
  if (!idiom) {
    fail("성어를 찾을 수 없습니다 — 목록을 다시 여세요");
    return;
  }
  if (state.idiomSeals.some((seal) => seal.idiomId === idiom.id)) {
    fail(`${idiom.reading}은 이미 이 런에서 발동했습니다`);
    return;
  }
  const formationIndex = state.unlockedFormations[0];
  if (formationIndex === undefined) {
    fail("열린 오행진이 없습니다 — 기본 소환 1회로 진을 먼저 여세요");
    return;
  }
  engine.setIdiomTarget(idiom.id);
  const startCell = formationIndex * CELLS_PER_FORMATION;
  const cells = [0, 1, 2, 3].map((column) => startCell + IDIOM_STAGE_ROW * 4 + column);
  const reserved = new Set(cells);
  const chars = [...idiom.chars];
  const definitions: HanziDefinition[] = [];
  for (const char of chars) {
    const definition = engine.catalog.definitions.get(char);
    if (!definition) {
      fail(`${char} — 이 지역에 자령 정의가 없어 재현할 수 없습니다`);
      return;
    }
    definitions.push(definition);
  }
  try {
    const placedCount = placeAll ? 4 : 3;
    for (let index = 0; index < placedCount; index += 1) {
      placeCharAt(definitions[index], cells[index], reserved);
    }
    if (placeAll) {
      const activated = engine.resolveIdiomFormations();
      if (activated === 0 && !engine.isIdiomSealActive(idiom.id)) {
        fail(`${idiom.chars} 줄은 섰지만 성어가 발동하지 않았습니다 — 줄 배치를 확인하세요`);
        return;
      }
      // 발동 알림(자동 봉인 · lastMessage)은 엔진이 이미 남겼다 — 덮지 않는다.
      handleAction({ ok: true, message: state.lastMessage });
    } else {
      const lastChar = chars[3];
      const lastDefinition = definitions[3];
      let vault = state.inventoryTowers.find((tower) => tower.char === lastChar);
      if (!vault) {
        vault = backstage(engine).createTower(lastDefinition, -1);
        state.inventoryTowers.push(vault);
        discover(lastChar);
      }
      state.selectedTowerId = vault.id;
      state.lastMessage = `[개발] ${idiom.chars} 3자 배치 · 마지막 ${lastChar} 보관고 — 놓으면 발동합니다`;
      handleAction({ ok: true, message: state.lastMessage });
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

/* ── 자원 ──────────────────────────────────────────────────── */

function grantGold(amount: number): void {
  if (!runActive()) return;
  ctx.engine.state.gold += amount;
  ok(`엽전 +${amount}`);
}

function grantEssence(scope: Wuxing | "all"): void {
  if (!runActive()) return;
  const state = ctx.engine.state;
  const targets: readonly Wuxing[] = scope === "all" ? WUXING_ORDER : [scope];
  for (const wuxing of targets) {
    state.elementEssence[wuxing] += 10;
    state.elementEssenceGenerated[wuxing] += 10;
  }
  ok(scope === "all" ? "오행 문기 전부 +10" : `${scope} 문기 +10`);
}

/* ── 묵편 지급 ─────────────────────────────────────────────── */

/**
 * 묵편을 장부에 바로 넣는다.
 *
 * 보관소는 판 밖에 사는 장부라 런이 없어도 손댈 수 있다 — 집자소를 열어
 * 보려고 매번 우두머리를 열 번 잡을 수는 없다.
 */
function grantShard(raw: string): void {
  const char = [...raw.trim()][0] ?? "";
  if (!char) {
    fail("지급할 한자 1자를 적으세요");
    return;
  }
  updateSoulArchive((archive) => gainSoul(archive, char));
  refreshSoulBadge();
  ok(`${char} 묵편 +1 · 지닌 ${soulsHeld(soulArchive(), char)}개`);
}

/** 이 판(또는 KR)의 소환 풀에서 여덟 자를 골라 세 개씩. 새김대를 채울 만큼이다. */
function grantRandomShards(): void {
  const pool = ctx.engine.summonDefinitions();
  if (pool.length === 0) {
    fail("소환 풀이 비어 있습니다");
    return;
  }
  const chars: string[] = [];
  for (let index = 0; index < 8 && index < pool.length; index += 1) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick && !chars.includes(pick.char)) chars.push(pick.char);
  }
  updateSoulArchive((archive) => chars.reduce((next, char) => gainSoul(next, char, 3), archive));
  refreshSoulBadge();
  ok(`묵편 ${chars.join("")} 각 3개`);
}

function clearShardArchive(): void {
  setSoulArchive(EMPTY_SOUL_ARCHIVE);
  refreshSoulBadge();
  ok("집자소 보관소를 비웠습니다");
}

/* ── 자령 지급 ─────────────────────────────────────────────── */

function grantTowerByDefinition(definition: HanziDefinition, note: string): void {
  const engine = ctx.engine;
  try {
    const tower = backstage(engine).createTower(definition, -1);
    engine.state.inventoryTowers.push(tower);
    engine.state.selectedTowerId = tower.id;
    discover(definition.char);
    ok(`${definition.char} 자령 보관고 지급${note}`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function grantChar(raw: string): void {
  if (!runActive()) return;
  const char = raw.trim();
  if ([...char].length !== 1) {
    fail("한자 1자를 입력하세요");
    return;
  }
  const definition = ctx.engine.catalog.definitions.get(char);
  if (!definition) {
    fail(`${char} — 이 지역 로스터에 없는 한자입니다`);
    return;
  }
  grantTowerByDefinition(definition, "");
}

function grantRandomByStar(star: number): void {
  if (!runActive()) return;
  const engine = ctx.engine;
  const casual = engine.state.mode === "casual";
  const candidates = [...engine.catalog.definitions.values()].filter((definition) =>
    casual ? casualNaturalStar(definition.char) === star : definition.stage === star
  );
  if (candidates.length === 0) {
    fail(`${star}★ 자령이 이 지역 로스터에 없습니다`);
    return;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  grantTowerByDefinition(pick, ` (${star}★ 무작위)`);
}

/* ── 웨이브 ────────────────────────────────────────────────── */

/**
 * 교전 중이면 남은 적·스폰을 접어 이번 웨이브를 끝내고, 준비로 돌아오는 즉시
 * 다음 웨이브를 연다. 준비 중이면 준비 시간만 0 으로 접는다.
 * targetWave 를 주면 그 웨이브가 다음으로 오도록 state.wave 를 당긴다.
 */
function jumpWave(targetWave: number | null): void {
  if (!runActive()) return;
  const engine = ctx.engine;
  const state = engine.state;
  if (state.summonCount === 0) {
    fail("첫 소환 전에는 시간이 멈춰 있습니다 — 소환 1회 뒤에 쓰세요");
    return;
  }
  if (targetWave !== null && targetWave > state.maxWaves) {
    fail(`이미 마지막 장입니다 (웨이브 ${state.wave}/${state.maxWaves})`);
    return;
  }
  const label = targetWave === null ? "다음 웨이브" : `${targetWave}웨이브(보스)`;
  if (state.phase === "prep") {
    if (targetWave !== null) state.wave = targetWave - 1;
    state.prepRemaining = 0;
    ok(`${label} 즉시 시작`);
    return;
  }
  // combat: 남은 적을 접고(보상 없음) 스폰을 완료 처리해 finishWave 를 부른다.
  const plan = engine.getCurrentPlan();
  const removedBoss = state.enemies.some((enemy) => enemy.boss);
  state.enemies = [];
  if (plan) state.spawned = plan.count;
  if (removedBoss || plan?.boss) state.bossDefeated = true;
  if (targetWave !== null) state.wave = targetWave - 1;
  whenPhase(engine, "prep", () => {
    engine.state.prepRemaining = 0;
  });
  ok(`이번 웨이브를 접고 ${label}로 넘어갑니다`);
}

function nextBossWave(): number {
  const state = ctx.engine.state;
  return Math.floor(state.wave / 10) * 10 + 10;
}

function annihilateEnemies(): void {
  if (!runActive()) return;
  const state = ctx.engine.state;
  if (state.enemies.length === 0) {
    fail("전장에 적이 없습니다");
    return;
  }
  const count = state.enemies.length;
  const removedBoss = state.enemies.some((enemy) => enemy.boss);
  state.enemies = [];
  if (removedBoss) state.bossDefeated = true;
  ok(`적 ${count}체 제거 (보상 없음)${removedBoss ? " · 보스 처치 처리" : ""}`);
}

function fillEnemyCap(): void {
  if (!runActive()) return;
  const engine = ctx.engine;
  const state = engine.state;
  if (state.phase !== "combat") {
    fail("교전 중에만 적을 채울 수 있습니다 — 먼저 웨이브를 시작하세요");
    return;
  }
  const plan = engine.getCurrentPlan();
  if (!plan) {
    fail("현재 웨이브 계획을 읽을 수 없습니다");
    return;
  }
  const target = Math.floor(MAX_ENEMIES * 0.9);
  const need = target - state.enemies.length;
  if (need <= 0) {
    fail(`이미 한계의 90% 이상입니다 (${state.enemies.length}/${MAX_ENEMIES})`);
    return;
  }
  for (let index = 0; index < need; index += 1) {
    state.enemies.push({
      id: DEV_ENEMY_ID_BASE + devEnemySerial++,
      wave: state.wave,
      char: "天",
      hp: plan.hp,
      maxHp: plan.hp,
      speed: plan.speed * 0.9,
      progress: (index / need) % 1,
      reward: 0,
      boss: false,
      archetype: "swarm",
      weakness: plan.weakness,
      armor: 0,
      regenPerSecond: 0,
      slowFactor: 1,
      slowUntil: 0,
      stunnedUntil: 0,
      poisonDps: 0,
      poisonUntil: 0,
      flash: 0
    });
  }
  ok(`적 ${need}체 스폰 — ${state.enemies.length}/${MAX_ENEMIES} (90% 경고 연출)`);
}

/* ── 8성 체험 ──────────────────────────────────────────────── */

function makePolaris(): void {
  if (!runActive()) return;
  const engine = ctx.engine;
  if (engine.state.mode !== "casual") {
    fail("별승급 진법(캐주얼)에서만 별이 있습니다");
    return;
  }
  const tower = engine.selectedTower();
  if (!tower) {
    fail("자령을 먼저 선택하세요 (전장 클릭 또는 자령 지급)");
    return;
  }
  tower.casualStar = 8 as CasualStar;
  const onBoard = tower.cell >= 0;
  ok(`${tower.char} 8★ 극성 — ${onBoard ? "개안 오라 발동" : "전장에 배치하면 개안 오라가 흐릅니다"}`);
}

function completeGwicheon(): void {
  if (!runActive()) return;
  const engine = ctx.engine;
  if (engine.state.mode !== "casual") {
    fail("귀천은 별승급 진법(캐주얼) 전용입니다");
    return;
  }
  const eligible = engine.state.towers.filter(
    (tower) => (tower.casualStar ?? tower.naturalStar ?? 1) >= GWICHEON_MIN_STAR
  );
  if (eligible.length === 0) {
    fail(`전장에 ${GWICHEON_MIN_STAR}★ 이상 자령이 없습니다 — 8★ 버튼이나 지급을 먼저 쓰세요`);
    return;
  }
  for (const tower of eligible) {
    tower.ascendCharge = gwicheonChargeSeconds(tower.casualStar ?? tower.naturalStar ?? GWICHEON_MIN_STAR);
  }
  const note = engine.state.phase === "combat" ? "다음 전투 틱에 발동" : "교전이 시작되면 즉시 발동";
  ok(`귀천 충전 완료 · ${eligible.length}기 — ${note}`);
}

/* ── 패널 DOM ──────────────────────────────────────────────── */

const PANEL_HTML = `
<button id="dev-tools-button" class="dev-tools-toggle" type="button" title="디버그 패널 (개발자 모드 전용)" aria-haspopup="true" aria-expanded="false">開</button>
<section id="dev-tools-panel" class="dev-tools-panel" hidden aria-label="개발자 디버그 패널">
  <header id="dev-tools-header" class="dev-tools-header" title="끌어서 이동">
    <b>디버그 도구</b>
    <button id="dev-tools-fold" type="button" title="접기/펼치기" aria-label="접기">▾</button>
    <button id="dev-tools-close" type="button" title="닫기" aria-label="닫기">×</button>
  </header>
  <div id="dev-tools-body" class="dev-tools-body">
    <fieldset class="dev-tools-group">
      <legend>성어 연출</legend>
      <select id="dev-idiom-select" aria-label="재현할 성어"></select>
      <div class="dev-tools-row">
        <button id="dev-idiom-stage" type="button" title="4자 지급 — 3자는 줄에, 마지막 1자는 보관고에">성어 발동 보기 (3+1)</button>
        <button id="dev-idiom-full" type="button" title="4자째까지 배치해 발동 연출을 즉시 본다">끝까지 자동</button>
      </div>
    </fieldset>
    <fieldset class="dev-tools-group">
      <legend>자원</legend>
      <div class="dev-tools-row">
        <button id="dev-gold-100" type="button">엽전 +100</button>
        <button id="dev-gold-1000" type="button">엽전 +1000</button>
      </div>
      <div class="dev-tools-row">
        <select id="dev-essence-element" aria-label="문기 오행">
          <option value="all">오행 전부</option>
          ${WUXING_ORDER.map((wuxing) => `<option value="${wuxing}">${wuxing}</option>`).join("")}
        </select>
        <button id="dev-essence-grant" type="button">문기 +10</button>
      </div>
    </fieldset>
    <fieldset class="dev-tools-group">
      <legend>자령 지급</legend>
      <div class="dev-tools-row">
        <input id="dev-grant-char" type="text" maxlength="2" placeholder="漢" aria-label="지급할 한자 1자" />
        <button id="dev-grant-char-button" type="button">지급</button>
      </div>
      <div class="dev-tools-row">
        <select id="dev-grant-star" aria-label="무작위 지급 별">
          ${[1, 2, 3, 4, 5, 6, 7, 8].map((star) => `<option value="${star}"${star === 8 ? " selected" : ""}>${star}★</option>`).join("")}
        </select>
        <button id="dev-grant-star-button" type="button">무작위 지급</button>
      </div>
    </fieldset>
    <fieldset class="dev-tools-group">
      <legend>묵편 지급</legend>
      <!--
        묵편은 우두머리를 봉인해야 나온다. 집자소를 손보려면 판을 10웨이브씩
        굴려야 하므로, 여기서 바로 채운다. 보관소는 판 밖의 장부라 런이
        없어도 지급된다 — 제목 화면에서도 눌린다.
      -->
      <div class="dev-tools-row">
        <input id="dev-shard-char" type="text" maxlength="2" placeholder="天" aria-label="지급할 묵편 한자 1자" />
        <button id="dev-shard-grant" type="button" data-testid="dev-shard-grant">묵편 +1</button>
      </div>
      <div class="dev-tools-row">
        <button id="dev-shard-random" type="button" data-testid="dev-shard-random">무작위 8자 ×3</button>
        <button id="dev-shard-clear" type="button" data-testid="dev-shard-clear">보관소 비우기</button>
      </div>
    </fieldset>
    <fieldset class="dev-tools-group">
      <legend>웨이브</legend>
      <div class="dev-tools-row">
        <button id="dev-wave-next" type="button">다음 웨이브 즉시</button>
        <button id="dev-wave-boss" type="button">보스 웨이브 점프</button>
      </div>
      <div class="dev-tools-row">
        <button id="dev-wave-clear" type="button" title="보상 없이 제거">적 전멸</button>
        <button id="dev-enemy-fill" type="button" title="적 수를 한계 90%까지 채워 경고 연출을 본다">적 한계 90%</button>
      </div>
    </fieldset>
    <fieldset class="dev-tools-group">
      <legend>8성 체험</legend>
      <div class="dev-tools-row">
        <button id="dev-star8" type="button" title="선택(또는 방금 지급한) 자령을 8★로">선택 자령 8★</button>
        <button id="dev-gwicheon" type="button" title="전장의 6★+ 자령 귀천 게이지를 가득 채운다">귀천 충전 완료</button>
      </div>
    </fieldset>
  </div>
</section>`;

function devModeOn(): boolean {
  return shell.dataset.devMode === "1";
}

function refreshIdiomSelect(select: HTMLSelectElement): void {
  const engine = ctx.engine;
  const target = engine.currentIdiomTarget();
  select.innerHTML = engine
    .idioms()
    .map((idiom) => {
      const sealed = engine.state.idiomSeals.some((seal) => seal.idiomId === idiom.id);
      const selected = idiom.id === target?.id ? " selected" : "";
      return `<option value="${idiom.id}"${selected}${sealed ? " disabled" : ""}>${idiom.chars} · ${idiom.reading}${sealed ? " (발동됨)" : ""}</option>`;
    })
    .join("");
}

/** main.ts 가 원래 순서대로 부르는 배선 묶음. */
export function wireDevTools1(): void {
  /*
   * 리소스 타이밍 버퍼 상향 — QA·e2e 계약 보호.
   *
   * smoke 스펙은 performance.getEntriesByType("resource") 로 "자령·투사체
   * 스프라이트가 실제로 요청됐는가"를 검증한다. 이 게임은 dev 서버 기준
   * 정확히 기본 버퍼(250) 언저리까지 리소스를 청하므로, 모듈이 두엇만
   * 늘어도(이 파일 + CSS 절) 뒤쪽 항목이 조용히 버려져 검증이 무너진다.
   * 부팅 초입(프리로드 전)에 한 번 넉넉히 올려 둔다.
   */
  performance.setResourceTimingBufferSize(4096);
  shell.insertAdjacentHTML("beforeend", PANEL_HTML);
  const toggle = must<HTMLButtonElement>("#dev-tools-button");
  const panel = must<HTMLElement>("#dev-tools-panel");
  const header = must<HTMLElement>("#dev-tools-header");
  const body = must<HTMLElement>("#dev-tools-body");
  const fold = must<HTMLButtonElement>("#dev-tools-fold");
  const idiomSelect = must<HTMLSelectElement>("#dev-idiom-select");
  const charInput = must<HTMLInputElement>("#dev-grant-char");

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) refreshIdiomSelect(idiomSelect);
  };

  toggle.addEventListener("click", () => {
    if (!devModeOn()) return;
    setOpen(panel.hidden === true);
  });
  must<HTMLButtonElement>("#dev-tools-close").addEventListener("click", () => setOpen(false));
  fold.addEventListener("click", () => {
    const folded = !body.hidden;
    body.hidden = folded;
    panel.classList.toggle("is-folded", folded);
    fold.textContent = folded ? "▸" : "▾";
  });

  // 개발자 모드가 꺼지면 즉시 소멸 — CSS 가 표시를 걷고, 여기서 상태도 접는다.
  new MutationObserver(() => {
    if (!devModeOn()) setOpen(false);
  }).observe(shell, { attributes: true, attributeFilter: ["data-dev-mode"] });

  // 패널 안 키 입력이 전역 단축키(1·Q·Space…)·백틱 게이트로 새지 않게 막는다.
  panel.addEventListener("keydown", (event) => event.stopPropagation());

  // 간단 드래그 — 고정 무대(1280x720) 좌표계로 환산해 끌어 옮긴다.
  let drag: { pointerId: number; startX: number; startY: number; left: number; top: number; scale: number } | null = null;
  header.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    const scale = shell.getBoundingClientRect().width / Math.max(1, shell.offsetWidth);
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: panel.offsetLeft, top: panel.offsetTop, scale };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const left = drag.left + (event.clientX - drag.startX) / drag.scale;
    const top = drag.top + (event.clientY - drag.startY) / drag.scale;
    panel.style.left = `${Math.max(0, Math.min(shell.offsetWidth - panel.offsetWidth, left))}px`;
    panel.style.top = `${Math.max(0, Math.min(shell.offsetHeight - header.offsetHeight, top))}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  });
  const endDrag = (event: PointerEvent): void => {
    if (drag && event.pointerId === drag.pointerId) drag = null;
  };
  header.addEventListener("pointerup", endDrag);
  header.addEventListener("pointercancel", endDrag);

  // ── 기능 배선 ──
  const stage = (placeAll: boolean): void => {
    const id = idiomSelect.value || ctx.engine.currentIdiomTarget()?.id || "";
    stageIdiom(id, placeAll);
    refreshIdiomSelect(idiomSelect);
  };
  must<HTMLButtonElement>("#dev-idiom-stage").addEventListener("click", () => stage(false));
  must<HTMLButtonElement>("#dev-idiom-full").addEventListener("click", () => stage(true));
  must<HTMLButtonElement>("#dev-gold-100").addEventListener("click", () => grantGold(100));
  must<HTMLButtonElement>("#dev-gold-1000").addEventListener("click", () => grantGold(1000));
  must<HTMLButtonElement>("#dev-essence-grant").addEventListener("click", () => {
    const value = must<HTMLSelectElement>("#dev-essence-element").value;
    grantEssence(value === "all" ? "all" : (value as Wuxing));
  });
  must<HTMLButtonElement>("#dev-grant-char-button").addEventListener("click", () => grantChar(charInput.value));
  const shardInput = must<HTMLInputElement>("#dev-shard-char");
  must<HTMLButtonElement>("#dev-shard-grant").addEventListener("click", () => grantShard(shardInput.value));
  must<HTMLButtonElement>("#dev-shard-random").addEventListener("click", grantRandomShards);
  must<HTMLButtonElement>("#dev-shard-clear").addEventListener("click", clearShardArchive);
  charInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") grantChar(charInput.value);
  });
  must<HTMLButtonElement>("#dev-grant-star-button").addEventListener("click", () => {
    grantRandomByStar(Number(must<HTMLSelectElement>("#dev-grant-star").value));
  });
  must<HTMLButtonElement>("#dev-wave-next").addEventListener("click", () => jumpWave(null));
  must<HTMLButtonElement>("#dev-wave-boss").addEventListener("click", () => jumpWave(nextBossWave()));
  must<HTMLButtonElement>("#dev-wave-clear").addEventListener("click", annihilateEnemies);
  must<HTMLButtonElement>("#dev-enemy-fill").addEventListener("click", fillEnemyCap);
  must<HTMLButtonElement>("#dev-star8").addEventListener("click", makePolaris);
  must<HTMLButtonElement>("#dev-gwicheon").addEventListener("click", completeGwicheon);
}
