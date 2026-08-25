/**
 * S00 실물 3D 서재 (실험 — `?menu3d=1` 로만 켜짐).
 *
 * 책상과 펼친 책을 실제 지오메트리로 만들고, 자령은 그 위에 서 있는
 * 빌보드 스프라이트로 세운다. 조작 버튼·텍스트는 전부 기존 DOM 레이어가
 * 담당하므로(코덱스 S00 계약) 이 장면은 순수 배경이며 포인터 이벤트를 받지 않는다.
 *
 * 화가가 그린 2D 배경과의 솔직한 차이:
 *   + 책 모서리·페이지 곡률이 카메라를 따라 진짜 원근으로 움직인다
 *   + 조명이 실시간이라 페이지가 빛을 받는다
 *   - 소품 밀도는 그림보다 빈약하다 (모델러 없이 만든 절차 지오메트리)
 */
import {
  AmbientLight,
  CanvasTexture,
  Clock,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  Scene,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer
} from "three";

interface SpiritSlot {
  readonly ring: string;
  readonly spirit: string;
  /** 책 표면 좌표 (x: -3.2~3.2, z: -1.6~1.6) */
  readonly x: number;
  readonly z: number;
  /** 프레임 PNG 하단 투명 여백 보정 */
  readonly dy: number;
}

const MENU_ASSET = (relative: string): string => `${import.meta.env.BASE_URL}assets/ui/main-menu-b/${relative}`;

/** S00_LAYOUT showcase 좌표를 책 평면 좌표로 손매핑한 값. */
const SPIRIT_SLOTS: readonly SpiritSlot[] = [
  { ring: "rings/summon-ring-wood-v1.png", spirit: "jaryeongs/menu-wood-orchid-frame-v1.png", x: -1.55, z: -0.82, dy: 0 },
  { ring: "rings/summon-ring-earth-v1.png", spirit: "jaryeongs/menu-earth-pottery-frame-v1.png", x: 1.5, z: -0.86, dy: -0.09 },
  { ring: "rings/summon-ring-water-v1.png", spirit: "jaryeongs/menu-water-ice-frame-v1.png", x: -2.15, z: 0.66, dy: -0.11 },
  { ring: "rings/summon-ring-fire-v1.png", spirit: "jaryeongs/menu-fire-fox-frame-v1.png", x: 0.25, z: 0.7, dy: 0 },
  { ring: "rings/summon-ring-metal-v1.png", spirit: "jaryeongs/menu-metal-mirror-frame-v1.png", x: 2.35, z: 0.64, dy: -0.04 }
];

/** 페이지에 살짝 굽은 단면을 준다. 중앙 접합부로 갈수록 솟는다. */
function curvedPage(width: number, depth: number, towardCenter: 1 | -1): PlaneGeometry {
  const geometry = new PlaneGeometry(width, depth, 24, 8);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const inner = towardCenter === 1 ? (x + width / 2) / width : (width / 2 - x) / width;
    position.setZ(index, Math.sin(inner * Math.PI * 0.5) * 0.16 + Math.sin(inner * Math.PI) * 0.05);
  }
  geometry.computeVertexNormals();
  return geometry;
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

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1280 / 720, 0.1, 60);
  camera.position.set(0, 6.1, 7.6);
  camera.lookAt(0, 0.4, -0.2);

  // ── 조명: 위 왼쪽의 따뜻한 서재 등불 ──
  scene.add(new AmbientLight(0x8a7355, 0.85));
  const lamp = new SpotLight(0xffd9a0, 260, 30, Math.PI / 3.6, 0.55, 1.9);
  lamp.position.set(-3.4, 8.4, 3.2);
  scene.add(lamp);
  const ember = new PointLight(0xff9a4a, 26, 14, 2);
  ember.position.set(3.6, 1.4, 2.6);
  scene.add(ember);

  // 책상 너머가 검은 허공으로 비면 무대가 아니라 버그로 읽힌다.
  const wallCanvas = document.createElement("canvas");
  wallCanvas.width = 8;
  wallCanvas.height = 256;
  const wallContext = wallCanvas.getContext("2d");
  if (wallContext) {
    const gradient = wallContext.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#100a06");
    gradient.addColorStop(0.55, "#241609");
    gradient.addColorStop(1, "#3a2410");
    wallContext.fillStyle = gradient;
    wallContext.fillRect(0, 0, 8, 256);
  }
  const wallTexture = new CanvasTexture(wallCanvas);
  wallTexture.colorSpace = SRGBColorSpace;
  const wall = new Mesh(
    new PlaneGeometry(60, 26),
    new MeshStandardMaterial({ map: wallTexture, roughness: 1 })
  );
  wall.position.set(0, 8, -11);
  scene.add(wall);

  const loader = new TextureLoader();
  const paperTexture = loader.load(`${import.meta.env.BASE_URL}assets/map/hanji-ink-field/hanji-paper-base.png`);
  paperTexture.colorSpace = SRGBColorSpace;
  paperTexture.wrapS = RepeatWrapping;
  paperTexture.wrapT = RepeatWrapping;
  paperTexture.repeat.set(0.62, 0.5);

  // ── 책상: 어두운 옻칠 나무 (절차 결) ──
  const deskCanvas = document.createElement("canvas");
  deskCanvas.width = 512;
  deskCanvas.height = 512;
  const deskContext = deskCanvas.getContext("2d");
  if (deskContext) {
    deskContext.fillStyle = "#241a10";
    deskContext.fillRect(0, 0, 512, 512);
    for (let strip = 0; strip < 26; strip += 1) {
      deskContext.fillStyle = strip % 2 ? "rgba(58, 40, 22, 0.30)" : "rgba(16, 11, 6, 0.34)";
      deskContext.fillRect(0, strip * 20, 512, 9 + (strip * 7) % 6);
    }
  }
  const deskTexture = new CanvasTexture(deskCanvas);
  deskTexture.colorSpace = SRGBColorSpace;
  const desk = new Mesh(
    new PlaneGeometry(30, 20),
    new MeshStandardMaterial({ map: deskTexture, roughness: 0.82, metalness: 0.08 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.42;
  scene.add(desk);

  // ── 책: 표지 + 페이지 더미 + 굽은 펼침면 ──
  const book = new Group();
  const coverMaterial = new MeshStandardMaterial({ color: 0x2c1c10, roughness: 0.6, metalness: 0.12 });
  const cover = new Mesh(new PlaneGeometry(8.6, 4.6), coverMaterial);
  cover.rotation.x = -Math.PI / 2;
  cover.position.y = -0.4;
  book.add(cover);

  const stackMaterial = new MeshStandardMaterial({ color: 0xcbb88f, roughness: 0.9 });
  for (const side of [-1, 1] as const) {
    const stack = new Mesh(new PlaneGeometry(4.05, 4.3), stackMaterial);
    stack.rotation.x = -Math.PI / 2;
    stack.position.set(side * 2.06, -0.2, 0);
    book.add(stack);
  }

  const pageMaterial = new MeshStandardMaterial({ map: paperTexture, roughness: 0.94, color: 0xe8ddc2 });
  for (const side of [-1, 1] as const) {
    const page = new Mesh(curvedPage(4.1, 4.4, side === -1 ? 1 : -1), pageMaterial);
    page.rotation.x = -Math.PI / 2;
    page.position.set(side * 2.05, -0.06, 0);
    book.add(page);
  }
  scene.add(book);

  // ── 먹 고리(책에 눕힘) + 자령(기립 빌보드) ──
  const sprites: Sprite[] = [];
  for (const slot of SPIRIT_SLOTS) {
    const ringTexture = loader.load(MENU_ASSET(slot.ring));
    ringTexture.colorSpace = SRGBColorSpace;
    const ring = new Mesh(
      new PlaneGeometry(1.7, 1.55),
      new MeshStandardMaterial({ map: ringTexture, transparent: true, roughness: 1 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(slot.x, 0.16, slot.z);
    scene.add(ring);

    const spiritTexture = loader.load(MENU_ASSET(slot.spirit));
    spiritTexture.colorSpace = SRGBColorSpace;
    const spirit = new Sprite(new SpriteMaterial({ map: spiritTexture, transparent: true }));
    spirit.scale.set(1.55, 1.42, 1);
    spirit.position.set(slot.x, 0.68 + slot.dy, slot.z);
    sprites.push(spirit);
    scene.add(spirit);
  }

  // ── 카메라 시차 + 자령 숨쉬기 ──
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
    if (!reduced) {
      camera.position.x += (pointerX * 1.05 - camera.position.x) * 0.05;
      camera.position.y += (6.1 - pointerY * 0.55 - camera.position.y) * 0.05;
      camera.lookAt(0, 0.4, -0.2);
      for (let index = 0; index < sprites.length; index += 1) {
        const sprite = sprites[index] as Sprite;
        sprite.position.y = 0.68 + (SPIRIT_SLOTS[index]?.dy ?? 0) + Math.sin(elapsed * 1.35 + index * 1.6) * 0.055;
      }
    }
    renderer.render(scene, camera);
  };
  tick();

  return {
    dispose(): void {
      window.cancelAnimationFrame(frame);
      if (!reduced) host.removeEventListener("pointermove", onPointer);
      renderer.dispose();
      canvas.remove();
    }
  };
}
