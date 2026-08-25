/**
 * S00 실물 3D 서재 (실험 — `?menu3d=1` 로만 켜짐).
 *
 * 레퍼런스 목업(두꺼운 고서 + 책에 매달린 조작물)을 기준으로:
 *   - 책: 가죽 표지 + 층진 페이지 블록 + 굽은 펼침면 + 모서리 금장 + 책등
 *   - 먹 고리: 페이지 텍스처에 구워 조명을 받는다
 *   - 자령: 고리 위 기립 빌보드
 *   - 조작물은 스크린 스프라이트가 아니라 **책에 붙은 실제 지오메트리**다:
 *       서갈피 = 페이지 블록 사이에서 삐져나온 가죽 판(Box)
 *       지역 인장 = 표지 앞턱에 걸쳐 매달린 밀랍 원판(Plane, 기울임)
 *       출정 걸쇠 = 표지 우앞 모서리의 금속 잠금판(Box)
 *       요약 띠 = 오른 페이지에 눕힌 종이 띠, 맞춤 쪽지 = 책상 위 종이
 *     각 면에는 승인된 버튼 PNG 를 그림 영역만 crop 해 입힌다.
 *   - DOM 버튼은 텍스트·히트·포커스만 남기고 모델 위에 재투영된다.
 *     hover/selected/disabled 는 DOM 상태가 3D 머티리얼 스킨을 갈아끼운다.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Clock,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer
} from "three";

const MENU_ASSET = (relative: string): string => `${import.meta.env.BASE_URL}assets/ui/main-menu-b/${relative}`;

interface SpiritSlot {
  readonly ring: string;
  readonly spirit: string;
  readonly x: number;
  readonly z: number;
  readonly dy: number;
}

const SPIRIT_SLOTS: readonly SpiritSlot[] = [
  { ring: "rings/summon-ring-wood-v1.png", spirit: "jaryeongs/menu-wood-orchid-frame-v1.png", x: -1.5, z: -0.85, dy: 0 },
  { ring: "rings/summon-ring-earth-v1.png", spirit: "jaryeongs/menu-earth-pottery-frame-v1.png", x: 1.55, z: -0.88, dy: -0.09 },
  { ring: "rings/summon-ring-water-v1.png", spirit: "jaryeongs/menu-water-ice-frame-v1.png", x: -2.35, z: 0.62, dy: -0.11 },
  { ring: "rings/summon-ring-fire-v1.png", spirit: "jaryeongs/menu-fire-fox-frame-v1.png", x: 0.2, z: 0.66, dy: 0 },
  { ring: "rings/summon-ring-metal-v1.png", spirit: "jaryeongs/menu-metal-mirror-frame-v1.png", x: 2.5, z: 0.6, dy: -0.04 }
];

/**
 * 버튼 PNG 의 그림 영역(알파 bbox). 캔버스 여백까지 면에 늘리면 아트가
 * 작게 뜨므로, repeat/offset 으로 그림만 잘라 면을 가득 채운다.
 * 값은 제작 파이프라인에서 실측한 것이다.
 */
interface ArtCrop {
  readonly w: number;
  readonly h: number;
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
}

const CROPS: Record<string, ArtCrop> = {
  "ui/mode-bookmark-default-v1.png": { w: 840, h: 264, l: 35, t: 9, r: 16, b: 39 },
  "ui/mode-bookmark-hover-v1.png": { w: 840, h: 264, l: 35, t: 9, r: 16, b: 39 },
  "ui/mode-bookmark-selected-v1.png": { w: 840, h: 264, l: 4, t: 15, r: 4, b: 15 },
  "ui/region-seal-default-v1.png": { w: 396, h: 378, l: 48, t: 5, r: 71, b: 12 },
  "ui/region-seal-hover-v1.png": { w: 396, h: 378, l: 48, t: 5, r: 71, b: 12 },
  "ui/region-seal-selected-kr-v1.png": { w: 396, h: 378, l: 80, t: 6, r: 38, b: 16 },
  "ui/region-seal-selected-ea-v1.png": { w: 396, h: 378, l: 48, t: 5, r: 71, b: 12 },
  "ui/region-seal-disabled-v1.png": { w: 396, h: 378, l: 48, t: 5, r: 71, b: 12 },
  "ui/start-clasp-default-v1.png": { w: 840, h: 354, l: 9, t: 3, r: 10, b: 3 },
  "ui/start-clasp-hover-v1.png": { w: 840, h: 354, l: 9, t: 3, r: 10, b: 3 },
  "ui/start-clasp-pressed-v1.png": { w: 840, h: 354, l: 9, t: 3, r: 10, b: 3 },
  "ui/selection-summary-strip-v1.png": { w: 990, h: 162, l: 296, t: 38, r: 304, b: 37 },
  "ui/custom-note-disabled-v1.png": { w: 444, h: 252, l: 12, t: 10, r: 6, b: 19 }
};

/** DOM 버튼을 붙일 3D 앵커(모델 면 중심). 중립 카메라 대비 편차만 적용한다. */
const DOM_ANCHORS: ReadonlyArray<{ selector: string; at: Vector3 }> = [
  { selector: ".s00-modes .s00-mode:nth-of-type(1)", at: new Vector3(-5.05, -0.02, -1.45) },
  { selector: ".s00-modes .s00-mode:nth-of-type(2)", at: new Vector3(-5.05, -0.24, -0.05) },
  { selector: ".s00-regions .s00-region:nth-of-type(1)", at: new Vector3(-1.2, -0.14, 2.86) },
  { selector: ".s00-regions .s00-region:nth-of-type(2)", at: new Vector3(-0.28, -0.18, 2.9) },
  { selector: ".s00-regions .s00-region:nth-of-type(3)", at: new Vector3(0.64, -0.18, 2.9) },
  { selector: ".s00-start", at: new Vector3(4.0, -0.32, 2.5) },
  { selector: ".s00-summary", at: new Vector3(1.85, 0.5, 1.85) },
  { selector: ".s00-custom", at: new Vector3(-3.55, -0.66, 2.9) }
];

/** 낡은 종이 얼룩·섬유·가장자리 그을림을 절차적으로 그린다. */
function paintAgedPaper(context: CanvasRenderingContext2D, size: number, seed: number): void {
  context.fillStyle = "#e9dcbd";
  context.fillRect(0, 0, size, size);
  const random = (index: number): number => ((Math.sin(seed * 91.7 + index * 47.9) * 43758.5453) % 1 + 1) % 1;
  for (let blot = 0; blot < 34; blot += 1) {
    const x = random(blot * 3) * size;
    const y = random(blot * 3 + 1) * size;
    const radius = 26 + random(blot * 3 + 2) * 130;
    const gradient = context.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, `rgba(128, 96, 48, ${0.045 + random(blot) * 0.05})`);
    gradient.addColorStop(1, "rgba(128, 96, 48, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = "rgba(110, 84, 44, 0.05)";
  for (let fiber = 0; fiber < 90; fiber += 1) {
    context.lineWidth = 0.6 + random(fiber) * 0.8;
    context.beginPath();
    const y = random(fiber * 2) * size;
    context.moveTo(0, y);
    context.bezierCurveTo(size * 0.3, y + random(fiber * 2 + 1) * 24 - 12, size * 0.7, y - random(fiber) * 24 + 12, size, y + random(fiber * 3) * 16 - 8);
    context.stroke();
  }
  context.strokeStyle = "rgba(96, 70, 34, 0.28)";
  context.lineWidth = 3;
  context.strokeRect(size * 0.075, size * 0.075, size * 0.85, size * 0.85);
  context.lineWidth = 1;
  context.strokeStyle = "rgba(96, 70, 34, 0.14)";
  for (let column = 1; column < 9; column += 1) {
    const x = size * 0.075 + (size * 0.85 * column) / 9;
    context.beginPath();
    context.moveTo(x, size * 0.075);
    context.lineTo(x, size * 0.925);
    context.stroke();
  }
  context.strokeStyle = "rgba(150, 52, 38, 0.16)";
  context.lineWidth = 5;
  context.strokeRect(size * 0.74, size * 0.11, size * 0.13, size * 0.13);

  const edgeX = context.createLinearGradient(0, 0, size, 0);
  edgeX.addColorStop(0, "rgba(96, 68, 32, 0.22)");
  edgeX.addColorStop(0.09, "rgba(96, 68, 32, 0)");
  edgeX.addColorStop(0.91, "rgba(96, 68, 32, 0)");
  edgeX.addColorStop(1, "rgba(96, 68, 32, 0.22)");
  context.fillStyle = edgeX;
  context.fillRect(0, 0, size, size);
  const edgeY = context.createLinearGradient(0, 0, 0, size);
  edgeY.addColorStop(0, "rgba(96, 68, 32, 0.2)");
  edgeY.addColorStop(0.08, "rgba(96, 68, 32, 0)");
  edgeY.addColorStop(0.92, "rgba(96, 68, 32, 0)");
  edgeY.addColorStop(1, "rgba(96, 68, 32, 0.24)");
  context.fillStyle = edgeY;
  context.fillRect(0, 0, size, size);
}

/** 페이지 옆면: 눌린 종이 결. */
function pageEdgeTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#d3c39a";
    context.fillRect(0, 0, 256, 64);
    for (let line = 0; line < 64; line += 2) {
      context.fillStyle = line % 6 === 0 ? "rgba(96, 74, 40, 0.35)" : "rgba(120, 98, 58, 0.18)";
      context.fillRect(0, line, 256, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** 어두운 가죽: 결 + 테두리 각인. */
function leatherTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#2a1a0e";
    context.fillRect(0, 0, 512, 512);
    for (let grain = 0; grain < 2600; grain += 1) {
      const x = (grain * 97) % 512;
      const y = (grain * 57 + (grain % 13) * 31) % 512;
      context.fillStyle = grain % 3 ? "rgba(58, 38, 20, 0.5)" : "rgba(16, 9, 4, 0.55)";
      context.fillRect(x, y, 2, 1);
    }
    context.strokeStyle = "rgba(150, 108, 52, 0.35)";
    context.lineWidth = 6;
    context.strokeRect(14, 14, 484, 484);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface Menu3dHandle {
  dispose(): void;
}

export function startMenu3d(host: HTMLElement): Menu3dHandle {
  const canvas = document.createElement("canvas");
  canvas.className = "s00-3d";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(33, 1280 / 720, 0.1, 60);
  const CAMERA_HOME = new Vector3(0, 7.1, 9.55);
  camera.position.copy(CAMERA_HOME);
  camera.lookAt(0, 0.05, 0.25);

  // ── 조명 ──
  scene.add(new AmbientLight(0x9a8365, 0.75));
  const key = new SpotLight(0xffe0b0, 300, 34, Math.PI / 3.4, 0.5, 1.85);
  key.position.set(4.6, 9.2, 4.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new SpotLight(0xc09a68, 90, 30, Math.PI / 3, 0.7, 2);
  fill.position.set(-6, 6.5, 3);
  scene.add(fill);
  const ember = new PointLight(0xff9040, 20, 12, 2);
  ember.position.set(-4.2, 1.1, 2.9);
  scene.add(ember);

  // ── 뒷벽 ──
  const wallCanvas = document.createElement("canvas");
  wallCanvas.width = 8;
  wallCanvas.height = 256;
  const wallContext = wallCanvas.getContext("2d");
  if (wallContext) {
    const gradient = wallContext.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#0d0805");
    gradient.addColorStop(0.55, "#20130a");
    gradient.addColorStop(1, "#39230f");
    wallContext.fillStyle = gradient;
    wallContext.fillRect(0, 0, 8, 256);
  }
  const wallTexture = new CanvasTexture(wallCanvas);
  wallTexture.colorSpace = SRGBColorSpace;
  const wall = new Mesh(new PlaneGeometry(64, 28), new MeshStandardMaterial({ map: wallTexture, roughness: 1 }));
  wall.position.set(0, 8, -12);
  scene.add(wall);

  // ── 책상 ──
  const deskCanvas = document.createElement("canvas");
  deskCanvas.width = 1024;
  deskCanvas.height = 1024;
  const deskContext = deskCanvas.getContext("2d");
  if (deskContext) {
    deskContext.fillStyle = "#20150c";
    deskContext.fillRect(0, 0, 1024, 1024);
    for (let plank = 0; plank < 6; plank += 1) {
      const y = plank * 172;
      deskContext.fillStyle = plank % 2 ? "#241809" : "#1b1108";
      deskContext.fillRect(0, y, 1024, 168);
      deskContext.fillStyle = "rgba(0, 0, 0, 0.7)";
      deskContext.fillRect(0, y + 168, 1024, 5);
      for (let streak = 0; streak < 34; streak += 1) {
        deskContext.strokeStyle = `rgba(${60 + (streak % 4) * 12}, ${40 + (streak % 3) * 8}, 20, 0.28)`;
        deskContext.lineWidth = 1 + (streak % 3);
        deskContext.beginPath();
        deskContext.moveTo(0, y + 8 + streak * 5);
        deskContext.bezierCurveTo(300, y + 4 + streak * 5, 700, y + 12 + streak * 5, 1024, y + 6 + streak * 5);
        deskContext.stroke();
      }
    }
  }
  const deskTexture = new CanvasTexture(deskCanvas);
  deskTexture.colorSpace = SRGBColorSpace;
  const desk = new Mesh(new PlaneGeometry(34, 22), new MeshStandardMaterial({ map: deskTexture, roughness: 0.72, metalness: 0.12 }));
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.72;
  desk.receiveShadow = true;
  scene.add(desk);

  // ── 책 ──
  const book = new Group();
  const leather = leatherTexture();

  const cover = new Mesh(
    new BoxGeometry(10.4, 0.22, 5.9),
    new MeshStandardMaterial({ map: leather, roughness: 0.58, metalness: 0.14 })
  );
  cover.position.y = -0.58;
  cover.receiveShadow = true;
  book.add(cover);

  const cornerMaterial = new MeshStandardMaterial({ color: 0xb08a45, roughness: 0.35, metalness: 0.75 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const corner = new Mesh(new BoxGeometry(0.62, 0.3, 0.62), cornerMaterial);
    corner.position.set(sx * 4.95, -0.55, sz * 2.7);
    book.add(corner);
  }

  const spine = new Mesh(
    new CylinderGeometry(0.34, 0.34, 5.8, 18, 1, false, 0, Math.PI),
    new MeshStandardMaterial({ map: leather, roughness: 0.6 })
  );
  spine.rotation.x = Math.PI / 2;
  spine.rotation.y = Math.PI / 2;
  spine.position.set(0, -0.52, 0);
  book.add(spine);

  const edge = pageEdgeTexture();
  const edgeMaterial = new MeshStandardMaterial({ map: edge, roughness: 0.9 });
  const blockTopMaterial = new MeshStandardMaterial({ color: 0xdccfa8, roughness: 0.95 });
  for (const side of [-1, 1] as const) {
    const block = new Mesh(
      new BoxGeometry(4.55, 0.62, 5.15),
      [edgeMaterial, edgeMaterial, blockTopMaterial, edgeMaterial, edgeMaterial, edgeMaterial]
    );
    block.position.set(side * 2.32, -0.26, 0);
    block.rotation.z = side * -0.015;
    block.receiveShadow = true;
    book.add(block);
  }

  const loader = new TextureLoader();
  const pageCanvases: Record<"left" | "right", HTMLCanvasElement> = {
    left: document.createElement("canvas"),
    right: document.createElement("canvas")
  };
  const pageTextures = {} as Record<"left" | "right", CanvasTexture>;
  (["left", "right"] as const).forEach((sideName, sideIndex) => {
    const pageCanvas = pageCanvases[sideName];
    pageCanvas.width = 1024;
    pageCanvas.height = 1024;
    const context = pageCanvas.getContext("2d");
    if (context) paintAgedPaper(context, 1024, sideIndex + 1);
    const texture = new CanvasTexture(pageCanvas);
    texture.colorSpace = SRGBColorSpace;
    pageTextures[sideName] = texture;
  });

  const PAGE_W = 4.5;
  const PAGE_D = 5.05;
  function curvedPage(towardCenter: 1 | -1): PlaneGeometry {
    const geometry = new PlaneGeometry(PAGE_W, PAGE_D, 28, 10);
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const inner = towardCenter === 1 ? (x + PAGE_W / 2) / PAGE_W : (PAGE_W / 2 - x) / PAGE_W;
      const outer = 1 - inner;
      position.setZ(index, Math.sin(inner * Math.PI * 0.5) * 0.2 + Math.sin(inner * Math.PI) * 0.05 + Math.pow(outer, 3) * 0.1);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  for (const side of [-1, 1] as const) {
    const page = new Mesh(
      curvedPage(side === -1 ? 1 : -1),
      new MeshStandardMaterial({ map: pageTextures[side === -1 ? "left" : "right"], roughness: 0.95 })
    );
    page.rotation.x = -Math.PI / 2;
    page.rotation.z = side * -0.015;
    page.position.set(side * 2.3, 0.08, 0);
    page.receiveShadow = true;
    book.add(page);
  }
  book.rotation.y = -0.012;
  scene.add(book);

  // ── 먹 고리: 페이지 위 0.02 띄운 평면. UV 굽기는 페이지 곡률·회전과
  // 어긋나기 쉬워 폐기했다. MeshStandard 라 조명은 그대로 받는다. ──
  for (const slot of SPIRIT_SLOTS) {
    const ringTexture = loader.load(MENU_ASSET(slot.ring));
    ringTexture.colorSpace = SRGBColorSpace;
    const ring = new Mesh(
      new PlaneGeometry(2.0, 1.84),
      new MeshStandardMaterial({ map: ringTexture, transparent: true, roughness: 1 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(slot.x, 0.45, slot.z);
    scene.add(ring);
  }

  // ── 책상 소품 ──
  const props = new Group();
  const inkstone = new Mesh(
    new CylinderGeometry(0.62, 0.72, 0.2, 24),
    new MeshStandardMaterial({ color: 0x17120d, roughness: 0.4, metalness: 0.2 })
  );
  inkstone.position.set(-6.7, -0.6, 2.4);
  props.add(inkstone);
  const inkPool = new Mesh(
    new CylinderGeometry(0.44, 0.44, 0.04, 24),
    new MeshStandardMaterial({ color: 0x05060a, roughness: 0.12, metalness: 0.4 })
  );
  inkPool.position.set(-6.7, -0.49, 2.4);
  props.add(inkPool);
  const brush = new Mesh(
    new CylinderGeometry(0.055, 0.075, 2.3, 10),
    new MeshStandardMaterial({ color: 0x6b4022, roughness: 0.6 })
  );
  brush.rotation.z = Math.PI / 2.25;
  brush.rotation.y = 0.4;
  brush.position.set(-6.1, -0.56, 3.4);
  props.add(brush);
  const scroll = new Mesh(
    new CylinderGeometry(0.34, 0.34, 3.1, 16),
    new MeshStandardMaterial({ map: pageTextures.left, roughness: 0.9 })
  );
  scroll.rotation.z = Math.PI / 2;
  scroll.rotation.y = -0.35;
  scroll.position.set(6.9, -0.42, 1.4);
  props.add(scroll);
  const scrollKnob = new MeshStandardMaterial({ color: 0x3a2410, roughness: 0.5 });
  for (const end of [-1, 1] as const) {
    const knob = new Mesh(new CylinderGeometry(0.4, 0.4, 0.14, 16), scrollKnob);
    knob.rotation.z = Math.PI / 2;
    knob.rotation.y = -0.35;
    knob.position.set(6.9 + end * 1.5, -0.42, 1.4 + end * -0.55);
    props.add(knob);
  }
  scene.add(props);

  // ── 자령 빌보드 ──
  const sprites: Sprite[] = [];
  for (const slot of SPIRIT_SLOTS) {
    const texture = loader.load(MENU_ASSET(slot.spirit));
    texture.colorSpace = SRGBColorSpace;
    const spirit = new Sprite(new SpriteMaterial({ map: texture, transparent: true }));
    spirit.scale.set(1.72, 1.58, 1);
    spirit.position.set(slot.x, 1.0 + slot.dy, slot.z);
    sprites.push(spirit);
    scene.add(spirit);
  }

  // ══════════════════════════════════════════════════════════════
  //  조작물 — 책에 붙은 실제 모델
  // ══════════════════════════════════════════════════════════════

  /** 그림 영역만 면을 채우도록 crop 된 텍스처. */
  function croppedTexture(file: string): Texture {
    const texture = loader.load(MENU_ASSET(file));
    texture.colorSpace = SRGBColorSpace;
    const crop = CROPS[file];
    if (crop) {
      const contentW = (crop.w - crop.l - crop.r) / crop.w;
      const contentH = (crop.h - crop.t - crop.b) / crop.h;
      texture.repeat.set(contentW, contentH);
      texture.offset.set(crop.l / crop.w, crop.b / crop.h);
    }
    return texture;
  }

  interface ControlBinding {
    readonly element: HTMLElement;
    readonly material: MeshStandardMaterial;
    readonly skins: Record<string, Texture>;
    /** DOM 상태에서 스킨 키를 고른다. */
    readonly pick: (element: HTMLElement, hovered: boolean) => string;
  }

  const controls: ControlBinding[] = [];
  const registerControl = (
    selector: string,
    material: MeshStandardMaterial,
    skins: Record<string, Texture>,
    pick: ControlBinding["pick"]
  ): void => {
    const element = host.querySelector<HTMLElement>(selector);
    if (!element) return;
    let hovered = false;
    const binding: ControlBinding = { element, material, skins, pick };
    element.addEventListener("pointerenter", () => {
      hovered = true;
      material.map = skins[pick(element, hovered)] ?? material.map;
      material.needsUpdate = true;
    });
    element.addEventListener("pointerleave", () => {
      hovered = false;
      material.map = skins[pick(element, hovered)] ?? material.map;
      material.needsUpdate = true;
    });
    controls.push(binding);
  };

  const bookmarkSkins = {
    default: croppedTexture("ui/mode-bookmark-default-v1.png"),
    hover: croppedTexture("ui/mode-bookmark-hover-v1.png"),
    selected: croppedTexture("ui/mode-bookmark-selected-v1.png")
  };
  const bookmarkSide = new MeshStandardMaterial({ map: leather, roughness: 0.62 });
  // 서갈피: 왼쪽 페이지 블록 층 사이에서 삐져나온 가죽 판.
  // 위 갈피는 위층(-0.10), 아래 갈피는 아래층(-0.30)에 끼워 층이 읽히게 한다.
  const bookmarkSpecs = [
    { selector: ".s00-modes .s00-mode:nth-of-type(1)", y: -0.1, z: -1.45, yaw: 0.16 },
    { selector: ".s00-modes .s00-mode:nth-of-type(2)", y: -0.3, z: -0.05, yaw: 0.05 }
  ];
  for (const spec of bookmarkSpecs) {
    const material = new MeshStandardMaterial({ map: bookmarkSkins.default, transparent: true, roughness: 0.7 });
    const mesh = new Mesh(
      new BoxGeometry(2.75, 0.07, 0.95),
      [bookmarkSide, bookmarkSide, material, bookmarkSide, bookmarkSide, bookmarkSide]
    );
    mesh.position.set(-5.05, spec.y, spec.z);
    mesh.rotation.y = spec.yaw;
    mesh.rotation.z = 0.045;
    mesh.castShadow = true;
    scene.add(mesh);
    registerControl(spec.selector, material, bookmarkSkins, (element, hovered) =>
      element.classList.contains("is-selected") ? "selected" : hovered ? "hover" : "default");
  }

  const sealSkins = {
    default: croppedTexture("ui/region-seal-default-v1.png"),
    hover: croppedTexture("ui/region-seal-hover-v1.png"),
    "selected-kr": croppedTexture("ui/region-seal-selected-kr-v1.png"),
    "selected-ea": croppedTexture("ui/region-seal-selected-ea-v1.png"),
    disabled: croppedTexture("ui/region-seal-disabled-v1.png")
  };
  // 지역 인장: 표지 앞턱에 걸쳐 앞으로 기운 밀랍 원판. 아트에 리본이
  // 포함돼 있어 판이 표지 아래로 늘어진다.
  const sealSpecs = [
    { selector: ".s00-regions .s00-region:nth-of-type(1)", x: -1.2, region: "KR" },
    { selector: ".s00-regions .s00-region:nth-of-type(2)", x: -0.28, region: "JP" },
    { selector: ".s00-regions .s00-region:nth-of-type(3)", x: 0.64, region: "CN" }
  ];
  for (const spec of sealSpecs) {
    const material = new MeshStandardMaterial({ map: sealSkins.default, transparent: true, roughness: 0.55 });
    const mesh = new Mesh(new PlaneGeometry(0.92, 1.2), material);
    mesh.position.set(spec.x, -0.18, 2.86);
    mesh.rotation.x = -0.52;
    mesh.castShadow = true;
    scene.add(mesh);
    registerControl(spec.selector, material, sealSkins, (element, hovered) => {
      if ((element as HTMLButtonElement).disabled) return "disabled";
      if (element.classList.contains("is-selected")) return spec.region === "KR" ? "selected-kr" : "selected-ea";
      return hovered ? "hover" : "default";
    });
  }

  const claspSkins = {
    default: croppedTexture("ui/start-clasp-default-v1.png"),
    hover: croppedTexture("ui/start-clasp-hover-v1.png"),
    pressed: croppedTexture("ui/start-clasp-pressed-v1.png")
  };
  // 출정 걸쇠: 표지 우앞 모서리를 물고 있는 금속 잠금판. 앞턱 너머로 돌출.
  const claspMaterial = new MeshStandardMaterial({ map: claspSkins.default, transparent: true, roughness: 0.55, metalness: 0 });
  const claspSide = new MeshStandardMaterial({ color: 0x4a3416, roughness: 0.4, metalness: 0.6 });
  const clasp = new Mesh(
    new BoxGeometry(2.25, 0.14, 1.4),
    [claspSide, claspSide, claspMaterial, claspSide, claspSide, claspSide]
  );
  clasp.position.set(4.0, -0.4, 2.5);
  clasp.rotation.y = -0.14;
  clasp.rotation.x = 0.06;
  clasp.castShadow = true;
  scene.add(clasp);
  registerControl(".s00-start", claspMaterial, claspSkins, (_element, hovered) => (hovered ? "hover" : "default"));
  const startElement = host.querySelector<HTMLElement>(".s00-start");
  startElement?.addEventListener("pointerdown", () => {
    claspMaterial.map = claspSkins.pressed;
    claspMaterial.needsUpdate = true;
  });
  startElement?.addEventListener("pointerup", () => {
    claspMaterial.map = claspSkins.hover;
    claspMaterial.needsUpdate = true;
  });

  // 요약 띠: 오른 페이지 위에 눕힌 종이 띠.
  const summaryTexture = croppedTexture("ui/selection-summary-strip-v1.png");
  const summaryStrip = new Mesh(
    new PlaneGeometry(2.35, 0.56),
    new MeshStandardMaterial({ map: summaryTexture, transparent: true, roughness: 0.9 })
  );
  summaryStrip.rotation.x = -Math.PI / 2 + 0.04;
  summaryStrip.position.set(1.85, 0.46, 1.85);
  scene.add(summaryStrip);

  // 맞춤 쪽지: 책상 위 종이.
  const noteTexture = croppedTexture("ui/custom-note-disabled-v1.png");
  const note = new Mesh(
    new PlaneGeometry(1.55, 0.9),
    new MeshStandardMaterial({ map: noteTexture, transparent: true, roughness: 0.95 })
  );
  note.rotation.x = -Math.PI / 2;
  note.rotation.z = 0.14;
  note.position.set(-3.55, -0.7, 2.9);
  scene.add(note);

  // ── DOM 재투영: 3D 모드에서는 스크린 레이아웃을 버리고, 요소 중심이
  // 항상 모델 앵커의 투영점에 오도록 절대 배치한다. dispose 때 원복. ──
  const projected = new Vector3();
  const domAnchors = DOM_ANCHORS
    .map(({ selector, at }) => {
      const element = host.querySelector<HTMLElement>(selector);
      if (!element) return null;
      return {
        element,
        at,
        width: element.offsetWidth,
        height: element.offsetHeight,
        originalLeft: element.style.left,
        originalTop: element.style.top
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pointerX = 0;
  let pointerY = 0;
  const onPointer = (event: PointerEvent): void => {
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  if (!reduced) host.addEventListener("pointermove", onPointer);

  const clock = new Clock();
  let frame = 0;
  const tick = (): void => {
    frame = window.requestAnimationFrame(tick);
    const elapsed = clock.getElapsedTime();

    // DOM 상태(선택·비활성)가 바뀌면 모델 스킨도 따라간다.
    for (const control of controls) {
      const wanted = control.skins[control.pick(control.element, false)];
      if (wanted && control.material.map !== wanted && !control.element.matches(":hover")) {
        control.material.map = wanted;
        control.material.needsUpdate = true;
      }
    }

    if (!reduced) {
      camera.position.x += (pointerX * 1.15 - camera.position.x) * 0.055;
      camera.position.y += (CAMERA_HOME.y - pointerY * 0.6 - camera.position.y) * 0.055;
      camera.lookAt(0, 0.05, 0.25);
      for (let index = 0; index < sprites.length; index += 1) {
        const sprite = sprites[index] as Sprite;
        const slot = SPIRIT_SLOTS[index] as SpiritSlot;
        sprite.position.y = 1.0 + slot.dy + Math.sin(elapsed * 1.3 + index * 1.6) * 0.05;
      }
    }

    for (const anchor of domAnchors) {
      projected.copy(anchor.at).project(camera);
      const x = (projected.x * 0.5 + 0.5) * 1280;
      const y = (-projected.y * 0.5 + 0.5) * 720;
      anchor.element.style.left = `${(x - anchor.width / 2).toFixed(1)}px`;
      anchor.element.style.top = `${(y - anchor.height / 2).toFixed(1)}px`;
    }

    renderer.render(scene, camera);
  };
  tick();

  return {
    dispose(): void {
      window.cancelAnimationFrame(frame);
      if (!reduced) host.removeEventListener("pointermove", onPointer);
      for (const anchor of domAnchors) {
        anchor.element.style.left = anchor.originalLeft;
        anchor.element.style.top = anchor.originalTop;
      }
      renderer.dispose();
      canvas.remove();
    }
  };
}
