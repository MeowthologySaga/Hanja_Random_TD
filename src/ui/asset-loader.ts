/**
 * 에셋 프리로더 (R11).
 *
 * 문제: 스프라이트 로더들이 모듈 평가 시점에 한꺼번에 `new Image()` 를 날리는
 * 바람에, **지금 화면에 보여야 하는** S00 서재 텍스처가 전투용 60여 장 뒤로
 * 밀렸다. 12Mbps 실측에서 s00-3d 텍스처 8장(11.2MB)은 15초가 지나도 도착하지
 * 못했고, 그 동안 메인 메뉴는 절차 재질(민 종이·무지 버튼)로 서 있었다.
 *
 * 해법은 우선순위 두 단계다.
 *   P1 — 타이틀 화면이 "완성된 모습"으로 뜨는 데 필요한 것. 부팅 로딩 막이
 *        이게 끝날 때까지 화면을 가린다.
 *   P2 — 전투 진입에 필요한 것. 타이틀이 뜬 직후 뒤에서 받는다. 출정 클릭이
 *        빨랐다면 핵심분만 잠깐 기다린다.
 *
 * 받아 둔 이미지는 `preloadedImage()` 로 각 로더가 그대로 집어 간다. 이미
 * `decode()` 까지 끝난 원본이므로 교체 프레임(절차 폴백 → 실물)이 생기지 않는다.
 *
 * 이 모듈은 순수 전달층이다. 좌표·전투 수치·진행 규칙에 손대지 않는다.
 */

/** 동시 요청 상한. 우선순위 목록의 앞쪽이 실제로 먼저 도착하게 묶어 둔다. */
const CONCURRENCY = 6;

/**
 * 부팅 막을 강제로 걷는 조건.
 *
 * 벽시계 상한을 쓰면 느리기만 한 회선(3Mbps 실측)에서 막이 절반쯤 받은 채로
 * 걷혀, 없애려던 "덜 그려진 메뉴"가 그대로 나온다. 그래서 **막힘**만 본다.
 * 바이트가 계속 들어오는 한 기다리고, 그 흐름이 끊긴 지 오래면 포기한다.
 */
export const BOOT_GATE_STALL_MS = 12_000;
/** 그래도 영원히 붙잡지는 않는다. 최후의 벽. */
export const BOOT_GATE_CEILING_MS = 120_000;
/** 출정 클릭이 P2 핵심분보다 빨랐을 때 기다려 주는 상한. */
export const BATTLE_GATE_CAP_MS = 1_500;

export type S00Mode = "3d" | "2d";

export interface PreloadProgress {
  /** 끝난 파일 수 + 받는 중인 파일들의 진행 비율. 정수가 아니다. */
  readonly done: number;
  readonly total: number;
}

// ── 매니페스트 ────────────────────────────────────────────────────
// 경로는 `import.meta.env.BASE_URL` 기준 상대다. 순서 = 우선순위.

/** S00 3D 서재. 한 장이라도 빠지면 그 면만 절차 재질로 남아 눈에 띈다. */
const P1_S00_3D: readonly string[] = [
  "assets/ui/s00-3d/book-page-left-v1.png",
  "assets/ui/s00-3d/book-page-right-v1.png",
  "assets/ui/s00-3d/book-cover-leather-v1.png",
  "assets/ui/s00-3d/desk-wood-v1.png",
  "assets/ui/s00-3d/study-backdrop-v1.png",
  "assets/ui/s00-3d/book-spine-v1.png",
  "assets/ui/s00-3d/book-page-edge-v1.png",
  "assets/ui/s00-3d/desk-props-atlas-v1.png",
  "assets/ui/main-menu-b/rings/summon-ring-wood-v1.png",
  "assets/ui/main-menu-b/rings/summon-ring-earth-v1.png",
  "assets/ui/main-menu-b/rings/summon-ring-water-v1.png",
  "assets/ui/main-menu-b/rings/summon-ring-fire-v1.png",
  "assets/ui/main-menu-b/rings/summon-ring-metal-v1.png",
  "assets/ui/main-menu-b/jaryeongs/menu-wood-orchid-frame-v1.png",
  "assets/ui/main-menu-b/jaryeongs/menu-earth-pottery-frame-v1.png",
  "assets/ui/main-menu-b/jaryeongs/menu-water-ice-frame-v1.png",
  "assets/ui/main-menu-b/jaryeongs/menu-fire-fox-frame-v1.png",
  "assets/ui/main-menu-b/jaryeongs/menu-metal-mirror-frame-v1.png",
  // 3D 조작물의 기본 상태 스킨. hover·pressed 는 실제로 가리키기 전에는
  // 보이지 않으므로 P2 로 미룬다.
  "assets/ui/main-menu-b/ui/mode-bookmark-default-v1.png",
  "assets/ui/main-menu-b/ui/mode-bookmark-selected-v1.png",
  "assets/ui/main-menu-b/ui/region-seal-default-v1.png",
  "assets/ui/main-menu-b/ui/region-seal-selected-kr-v1.png",
  "assets/ui/main-menu-b/ui/start-clasp-default-v1.png",
  "assets/ui/main-menu-b/ui/selection-summary-strip-v1.png",
  "assets/ui/main-menu-b/ui/custom-note-default-v1.png"
];

/**
 * 2D 폴백(`?menu3d=0` 또는 WebGL 실패)에서만 쓰는 배경 4장.
 *
 * 3D 가 기본인데도 이 4.8MB 가 늘 내려오고 있었다(`<img>` 는 `display:none`
 * 이어도 받는다). 지금은 2D 로 갈 때만 `src` 를 붙인다.
 */
const P1_S00_2D: readonly string[] = [
  "assets/ui/s00-layers-v1/S00-bg-desk-v2.png",
  "assets/ui/s00-layers-v1/S00-bg-book-v2.png",
  "assets/ui/s00-layers-v1/S00-fg-props-v2.png",
  "assets/ui/main-menu-b/background/S00-living-codex-empty-1280x720-v1.png"
];

/** 두 모드 공통 DOM 스킨(CSS 배경). */
const P1_COMMON: readonly string[] = [
  "assets/ui/main-menu-b/ui/title-plaque-v1.png",
  "assets/ui/main-menu-b/ui/utility-medallion-default-v1.png"
];

const WUXING_SLUGS = ["wood", "fire", "earth", "metal", "water"] as const;
const PLATE_SLUGS = ["water", "metal", "earth", "wood", "fire"] as const;
const NAMEPLATE_FORMS = ["wide", "glyph"] as const;
const NAMEPLATE_STATES = ["default", "selected", "material"] as const;
const INK_PATH_FILES: readonly string[] = [
  "ink-path-straight-h-v1.png",
  "ink-path-straight-v-v1.png",
  "ink-path-cross-v1.png",
  "ink-path-corner-rd-v1.png",
  "ink-path-corner-dl-v1.png",
  "ink-path-corner-lu-v1.png",
  "ink-path-corner-ur-v1.png",
  "ink-path-portal-r-v1.png",
  "ink-path-portal-d-v1.png",
  "ink-path-portal-l-v1.png",
  "ink-path-portal-u-v1.png",
  "ink-path-arrow-r-v1.png",
  "ink-path-arrow-d-v1.png",
  "ink-path-arrow-l-v1.png",
  "ink-path-arrow-u-v1.png"
];

/** 출정 직후 첫 2초에 실제로 그려지는 것들. 출정 게이트가 이것만 본다. */
const P2_BATTLE: readonly string[] = [
  "assets/map/hanji-ink-field/hanji-paper-base.png",
  "assets/enemies/p0-v1/enemy-ghost-procession-idle-2frame-v1.png",
  "assets/enemies/p0-v1/enemy-hundred-demons-idle-2frame-v1.png",
  "assets/enemies/p0-v1/enemy-gale-hungry-ghost-idle-2frame-v1.png",
  "assets/enemies/p0-v1/enemy-armored-jiangshi-idle-2frame-v1.png",
  "assets/enemies/p0-v1/enemy-regenerating-yokai-idle-2frame-v1.png",
  "assets/enemies/p0-v1/enemy-seal-breaker-boss-idle-2frame-v1.png",
  ...PLATE_SLUGS.flatMap((slug) => [
    `assets/ui/formations/v1/formation-altar-${slug}-open-546-v1.png`,
    `assets/ui/formations/v1/formation-altar-${slug}-locked-546-v1.png`
  ]),
  ...NAMEPLATE_FORMS.flatMap((form) =>
    NAMEPLATE_STATES.map((state) => `assets/ui/p0-v1/nameplates/jaryeong-nameplate-${form}-${state}-v1.png`)),
  ...WUXING_SLUGS.flatMap((slug) => [
    `assets/ui/p0-v1/cell-sockets/cell-socket-${slug}-empty-114-v1.png`,
    `assets/ui/p0-v1/cell-sockets/cell-socket-${slug}-occupied-114-v1.png`
  ]),
  ...INK_PATH_FILES.map((file) => `assets/ui/path/${file}`),
  ...WUXING_SLUGS.map((slug) => `assets/fx/element-projectiles/${slug}.png`),
  ...WUXING_SLUGS.map((slug) => `assets/fx/aoe-modular-v1/aoe-${slug}-v1.png`),
  "assets/ui/polish-v1/seals/exit-seal-waiting-84-v1.png",
  "assets/ui/polish-v1/seals/exit-seal-spawning-84-v1.png",
  "assets/ui/polish-v1/fx/idiom-completion-seal-600-v1.png"
];

/**
 * 첫 2초에는 안 나오지만 곧 필요한 것들. 출정 게이트는 이걸 기다리지 않는다.
 * 집중 프레임 두 장은 5.9MB 라 전투 핵심분 뒤로 확실히 밀어 둔다.
 */
const P2_LATE: readonly string[] = [
  "assets/ui/main-menu-b/ui/mode-bookmark-hover-v1.png",
  "assets/ui/main-menu-b/ui/region-seal-hover-v1.png",
  "assets/ui/main-menu-b/ui/region-seal-selected-ea-v1.png",
  "assets/ui/main-menu-b/ui/region-seal-disabled-v1.png",
  "assets/ui/main-menu-b/ui/start-clasp-hover-v1.png",
  "assets/ui/main-menu-b/ui/start-clasp-pressed-v1.png",
  "assets/ui/main-menu-b/ui/custom-note-hover-v1.png",
  "assets/ui/main-menu-b/ui/custom-note-pressed-v1.png",
  "assets/ui/v4/focus-frames/focus-frame-forge-v1.png",
  "assets/ui/v4/focus-frames/focus-frame-workshop-v1.png"
];

// ── 캐시 ──────────────────────────────────────────────────────────

interface CacheEntry {
  image: HTMLImageElement | null;
  ready: boolean;
  failed: boolean;
}

const cache = new Map<string, CacheEntry>();

export function assetUrl(relative: string): string {
  return `${import.meta.env.BASE_URL}${relative}`;
}

/**
 * 프리로드가 끝난 이미지. 각 스프라이트 로더가 `new Image()` 대신 이걸 쓰면
 * 절차 폴백을 한 프레임도 그리지 않고 바로 실물로 시작한다.
 * 아직 안 왔거나 실패했으면 `null` — 호출부는 기존 경로를 그대로 탄다.
 */
export function preloadedImage(url: string): HTMLImageElement | null {
  const entry = cache.get(url);
  if (!entry?.ready || !entry.image) return null;
  return entry.image.naturalWidth > 0 ? entry.image : null;
}

/**
 * 스트리밍으로 받을 경로.
 *
 * `fetch()` 로 받은 Blob 은 브라우저의 이미지 캐시와 **공유되지 않는다**. 같은
 * 파일을 CSS 배경이나 스프라이트 로더가 따로 `<img>` 로 부르면 두 번 내려온다
 * (실측 13.3MB 중복). 그래서 오직 3D 텍스처로만 쓰여 아무도 `<img>` 로 부르지
 * 않는 것들만 스트리밍한다 — 마침 이 셋이 P1 15.1MB 중 13.3MB 라, 진행 막대의
 * 촘촘함은 그대로 얻으면서 중복은 0 이 된다.
 */
const STREAM_PREFIXES: readonly string[] = [
  "assets/ui/s00-3d/",
  "assets/ui/main-menu-b/rings/",
  "assets/ui/main-menu-b/jaryeongs/"
];

function shouldStream(relative: string): boolean {
  return STREAM_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

/** `<img src>` 한 장을 디코딩까지 마친다. 브라우저 이미지 캐시를 그대로 쓴다. */
function loadViaImage(url: string, entry: CacheEntry): Promise<void> {
  const image = entry.image ?? new Image();
  entry.image = image;
  image.decoding = "async";
  if (!image.src) image.src = url;
  const settle = (): void => {
    if (image.naturalWidth > 0) entry.ready = true;
    else entry.failed = true;
  };
  return image
    .decode()
    .then(settle)
    .catch(() => new Promise<void>((resolve) => {
      if (image.complete) {
        settle();
        resolve();
        return;
      }
      image.addEventListener("load", () => { settle(); resolve(); }, { once: true });
      image.addEventListener("error", () => { entry.failed = true; resolve(); }, { once: true });
    }));
}

/**
 * 한 장을 받아 디코딩까지 끝낸다.
 *
 * `<img>` 는 진행 이벤트를 주지 않는다. s00-3d 텍스처는 한 장이 1.9MB 라
 * 파일 수만 세면 막대가 9초 동안 0% 에 멈춰 있다. 그래서 `STREAM_PREFIXES`
 * 에 해당하는 것만 본문을 스트림으로 읽어 `Content-Length` 대비 비율을
 * 흘려보내고, 다 받은 Blob 을 이미지로 넘긴다. 스트림이 없거나 실패하면
 * 예전처럼 `<img src>` 한 방으로 되돌아간다.
 */
async function fetchOne(url: string, stream: boolean, onFraction: (fraction: number) => void): Promise<void> {
  const existing = cache.get(url);
  if (existing?.ready || existing?.failed) {
    onFraction(1);
    return;
  }
  const entry: CacheEntry = existing ?? { image: null, ready: false, failed: false };
  cache.set(url, entry);

  if (!stream) {
    await loadViaImage(url, entry);
    onFraction(1);
    return;
  }

  let objectUrl: string | null = null;
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    const body = response.body;
    if (body && declared > 0) {
      const reader = body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value as BlobPart);
        received += value.byteLength;
        onFraction(Math.min(0.99, received / declared));
      }
      objectUrl = URL.createObjectURL(new Blob(chunks, { type: response.headers.get("content-type") ?? "image/png" }));
    } else {
      objectUrl = URL.createObjectURL(await response.blob());
    }
  } catch {
    // 네트워크·CORS·스트림 문제 — 이미지 태그 경로로 내려간다.
    objectUrl = null;
  }

  const image = new Image();
  entry.image = image;
  image.decoding = "async";
  if (objectUrl) {
    image.src = objectUrl;
    try {
      await image.decode();
      entry.ready = image.naturalWidth > 0;
      entry.failed = !entry.ready;
    } catch {
      entry.failed = true;
    }
    // 객체 URL 은 회수하지 않는다. 디코딩된 비트맵이 메모리 압박으로 버려지면
    // 이미지가 자기 `src` 를 다시 읽는데, 그때 회수된 URL 은 깨진 그림이 된다.
    if (entry.failed) {
      entry.image = null;
      await loadViaImage(url, entry);
    }
  } else {
    await loadViaImage(url, entry);
  }
  onFraction(1);
}

/**
 * 목록 순서를 유지한 채 `CONCURRENCY` 개씩 흘려보낸다.
 * 진행률은 "끝난 파일 수 + 받는 중인 파일들의 진행 비율"이라 막대가 멈추지 않는다.
 */
async function run(paths: readonly string[], onProgress?: (progress: PreloadProgress) => void): Promise<void> {
  const total = paths.length;
  const fractions = new Float64Array(total);
  let next = 0;
  const report = (): void => {
    if (!onProgress) return;
    let sum = 0;
    for (let index = 0; index < total; index += 1) sum += fractions[index] as number;
    onProgress({ done: sum, total });
  };
  report();
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      const path = paths[index];
      if (path === undefined) return;
      await fetchOne(assetUrl(path), shouldStream(path), (fraction) => {
        fractions[index] = fraction;
        report();
      });
      fractions[index] = 1;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
}

// ── P1 부팅 게이트 ────────────────────────────────────────────────

export function p1Manifest(mode: S00Mode): readonly string[] {
  return mode === "3d" ? [...P1_S00_3D, ...P1_COMMON] : [...P1_S00_2D, ...P1_COMMON];
}

/**
 * 부팅 게이트. 글꼴(FOUT)과 P1 이미지를 함께 기다린다.
 *
 * 포기 조건은 "느림"이 아니라 "막힘"이다. 진행이 `BOOT_GATE_STALL_MS` 동안
 * 한 톨도 없으면(끊긴 회선·죽은 서버) 막을 걷고 그때부터는 예전처럼 도착하는
 * 대로 교체한다. 진행이 있는 한 `BOOT_GATE_CEILING_MS` 까지 기다린다.
 */
export function preloadP1(mode: S00Mode, onProgress?: (progress: PreloadProgress) => void): Promise<void> {
  const fonts = document.fonts?.ready ?? Promise.resolve();
  let lastProgressAt = Date.now();
  const work = Promise.all([
    run(p1Manifest(mode), (progress) => {
      lastProgressAt = Date.now();
      onProgress?.(progress);
    }),
    fonts.catch(() => undefined)
  ]).then(() => undefined);

  const startedAt = Date.now();
  const watchdog = new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      const stalled = Date.now() - lastProgressAt > BOOT_GATE_STALL_MS;
      const expired = Date.now() - startedAt > BOOT_GATE_CEILING_MS;
      if (!stalled && !expired) return;
      window.clearInterval(timer);
      console.warn(`[asset-loader] 1차 프리로드를 중단하고 진행한다 (${stalled ? "진행 정지" : "상한 초과"}).`);
      resolve();
    }, 1_000);
    void work.then(() => window.clearInterval(timer));
  });

  return Promise.race([work, watchdog]);
}

// ── P2 배경 프리로드 ──────────────────────────────────────────────

let battleReady: Promise<void> | null = null;
let battleProgress: PreloadProgress = { done: 0, total: P2_BATTLE.length };

/** 출정 버튼의 소형 인디케이터가 읽는 값. */
export function battleAssetProgress(): PreloadProgress {
  return battleProgress;
}

/** 타이틀이 뜬 직후 호출한다. 전투 핵심분 → 나중분 순으로 받는다. */
export function startP2(onProgress?: (progress: PreloadProgress) => void): Promise<void> {
  if (battleReady) return battleReady;
  battleReady = run(P2_BATTLE, (progress) => {
    battleProgress = progress;
    onProgress?.(progress);
  });
  void battleReady.then(() => {
    // 나중분은 유휴 시간에만 흘린다. 진행률에는 포함하지 않는다.
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 400));
    idle(() => void run(P2_LATE));
  });
  return battleReady;
}

export function isBattleAssetsReady(): boolean {
  return P2_BATTLE.every((path) => preloadedImage(assetUrl(path)) !== null || cache.get(assetUrl(path))?.failed === true);
}

/** 출정 게이트. 아직이면 `BATTLE_GATE_CAP_MS` 까지만 기다린다. */
export function whenBattleAssetsReady(): Promise<void> {
  if (isBattleAssetsReady()) return Promise.resolve();
  const pending = battleReady ?? startP2();
  return Promise.race([
    pending,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, BATTLE_GATE_CAP_MS);
    })
  ]);
}

export function battleAssetCount(): number {
  return P2_BATTLE.length;
}

// ── 부팅 로딩 막 ──────────────────────────────────────────────────
// 마크업과 스타일은 `index.html` 인라인이다(번들보다 먼저 떠야 한다).
// 여기서는 진행률을 채우고 막을 걷는 일만 한다.

declare global {
  interface Window {
    /** `index.html` 인라인 안전장치의 타이머. 번들이 붙으면 여기서 거둔다. */
    __hanjaBootSafety?: number;
  }
}

/**
 * 인라인 안전장치를 넘겨받는다.
 *
 * 그 타이머는 "번들이 아예 안 왔다"를 위한 것이지 "느리다"를 위한 것이 아니다.
 * 번들이 실행된 시점부터는 프리로더가 막의 수명을 책임진다.
 */
export function takeOverBootScreen(): void {
  if (window.__hanjaBootSafety === undefined) return;
  window.clearTimeout(window.__hanjaBootSafety);
  window.__hanjaBootSafety = undefined;
}

export function updateBootProgress({ done, total }: PreloadProgress): void {
  const bar = document.getElementById("boot-bar");
  const percent = document.getElementById("boot-percent");
  if (!bar && !percent) return;
  const ratio = total === 0 ? 1 : Math.min(1, done / total);
  if (bar) bar.style.width = `${(ratio * 100).toFixed(1)}%`;
  if (percent) percent.textContent = `${Math.round(ratio * 100)}%  ·  ${Math.floor(done)} / ${total}`;
}

/** 페이드가 끝나면 DOM 에서 걷어낸다 — 투명한 막이 클릭을 먹지 않게. */
export function dismissBootScreen(): void {
  const layer = document.getElementById("boot-loader");
  if (!layer) return;
  layer.classList.add("is-done");
  layer.setAttribute("aria-hidden", "true");
  window.setTimeout(() => layer.remove(), 460);
}

// ── 서비스 워커 ───────────────────────────────────────────────────

/**
 * 두 번째 방문부터 15MB 를 다시 받지 않게 하는 오프라인 캐시.
 *
 * 등록 경로·범위를 전부 상대로 두어 GitHub Pages 하위 경로(base "./")에서도
 * 그대로 동작한다. 개발 서버에서는 켜지 않고, 예전에 남은 워커가 있으면
 * 오히려 낡은 번들을 물려 줄 수 있으므로 지운다.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
    return;
  }
  const scope = new URL("./", document.baseURI);
  const script = new URL(`sw.js?v=${__BUILD_ID__}`, scope);
  void navigator.serviceWorker.register(script.href, { scope: scope.href }).catch((error: unknown) => {
    console.warn("[sw] 등록 실패, 네트워크로 계속한다:", error instanceof Error ? error.message : error);
  });
}
