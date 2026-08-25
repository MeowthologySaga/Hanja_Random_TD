/**
 * S00 실물 3D 서재 (실험 — `?menu3d=1` 로만 켜짐).
 *
 * 레퍼런스 목업(두꺼운 고서 + 책에 매달린 조작물)을 기준으로:
 *   - 책: 가죽 표지 + 층진 페이지 블록 + 굽은 펼침면 + 모서리 금장 + 책등
 *   - 먹 고리: 별도 스프라이트가 아니라 페이지 텍스처에 구워 조명을 받는다
 *   - 자령: 고리 위 기립 빌보드
 *   - 조작 버튼(서갈피·지역 인장·출정 걸쇠·요약 띠)은 DOM 그대로 두되,
 *     책 위 3D 앵커에 매 프레임 재투영해 "책에 붙어 있는" 것처럼 움직인다.
 *     히트 영역·텍스트·포커스는 전부 DOM — 코덱스 S00 계약 유지.
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

/** DOM 버튼을 붙일 책 위 3D 앵커. 중립 카메라 대비 투영 편차만 적용한다. */
const DOM_ANCHORS: ReadonlyArray<{ selector: string; at: Vector3 }> = [
  { selector: ".s00-modes .s00-mode:nth-of-type(1)", at: new Vector3(-4.12, 0.1, -1.78) },
  { selector: ".s00-modes .s00-mode:nth-of-type(2)", at: new Vector3(-3.68, 0.1, -0.33) },
  { selector: ".s00-regions .s00-region:nth-of-type(1)", at: new Vector3(-1.14, 0.1, 2.70) },
  { selector: ".s00-regions .s00-region:nth-of-type(2)", at: new Vector3(-0.35, 0.1, 2.70) },
  { selector: ".s00-regions .s00-region:nth-of-type(3)", at: new Vector3(0.44, 0.1, 2.70) },
  { selector: ".s00-start", at: new Vector3(2.85, 0.1, 2.81) },
  { selector: ".s00-summary", at: new Vector3(1.81, 0.1, 1.97) },
  { selector: ".s00-custom", at: new Vector3(-3.24, 0.1, 2.73) }
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
  // 고서 판면: 여백 테두리 + 세로 괘선. 비어 있으면 종이가 아니라 판때기로 읽힌다.
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
  // 오래된 인장 자국
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

  const scene = new Scene();
  const camera = new PerspectiveCamera(33, 1280 / 720, 0.1, 60);
  const CAMERA_HOME = new Vector3(0, 6.35, 8.05);
  camera.position.copy(CAMERA_HOME);
  camera.lookAt(0, 0.15, 0.15);

  // ── 조명: 목업처럼 우상단 따뜻한 키 + 좌측 보조 + 잉걸 ──
  scene.add(new AmbientLight(0x9a8365, 0.75));
  const key = new SpotLight(0xffe0b0, 300, 34, Math.PI / 3.4, 0.5, 1.85);
  key.position.set(4.6, 9.2, 4.4);
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

  // ── 책상: 판자 이음이 있는 옻칠 나무 ──
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
  scene.add(desk);

  // ── 책 ──
  const book = new Group();
  const leather = leatherTexture();

  // 표지: 페이지보다 넓게 삐져나온 두꺼운 가죽 판
  const cover = new Mesh(
    new BoxGeometry(10.4, 0.22, 5.9),
    new MeshStandardMaterial({ map: leather, roughness: 0.58, metalness: 0.14 })
  );
  cover.position.y = -0.58;
  book.add(cover);

  // 모서리 금장 4개
  const cornerMaterial = new MeshStandardMaterial({ color: 0xb08a45, roughness: 0.35, metalness: 0.75 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const corner = new Mesh(new BoxGeometry(0.62, 0.3, 0.62), cornerMaterial);
    corner.position.set(sx * 4.95, -0.55, sz * 2.7);
    book.add(corner);
  }

  // 책등(중앙 융기)
  const spine = new Mesh(
    new CylinderGeometry(0.34, 0.34, 5.8, 18, 1, false, 0, Math.PI),
    new MeshStandardMaterial({ map: leather, roughness: 0.6 })
  );
  spine.rotation.x = Math.PI / 2;
  spine.rotation.y = Math.PI / 2;
  spine.position.set(0, -0.52, 0);
  book.add(spine);

  // 페이지 블록: 옆면이 종이 결로 보이는 층
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
    book.add(block);
  }

  // 펼침면: 낡은 종이 텍스처 + (로드 후) 먹 고리를 직접 굽는다
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
    book.add(page);
  }
  book.rotation.y = -0.012;
  scene.add(book);

  // 먹 고리를 페이지 텍스처에 굽는다 — 조명·원근을 페이지와 함께 받는다.
  const ringImages = SPIRIT_SLOTS.map((slot) => {
    const image = new Image();
    image.src = MENU_ASSET(slot.ring);
    return image;
  });
  const bakeRings = (): void => {
    for (let index = 0; index < SPIRIT_SLOTS.length; index += 1) {
      const slot = SPIRIT_SLOTS[index] as SpiritSlot;
      const image = ringImages[index] as HTMLImageElement;
      if (!image.complete || image.naturalWidth === 0) continue;
      const sideName = slot.x < 0 ? "left" : "right";
      const context = pageCanvases[sideName].getContext("2d");
      if (!context) continue;
      const pageCenterX = sideName === "left" ? -2.3 : 2.3;
      const u = (slot.x - pageCenterX + PAGE_W / 2) / PAGE_W;
      const v = (slot.z + PAGE_D / 2) / PAGE_D;
      const radiusPx = (1.05 / PAGE_W) * 1024;
      context.globalAlpha = 0.94;
      context.drawImage(image, u * 1024 - radiusPx, v * 1024 - radiusPx * 0.92, radiusPx * 2, radiusPx * 1.84);
      context.globalAlpha = 1;
      pageTextures[sideName].needsUpdate = true;
    }
  };
  let ringsPending = ringImages.length;
  ringImages.forEach((image) => {
    image.onload = () => {
      ringsPending -= 1;
      if (ringsPending === 0) bakeRings();
    };
    image.onerror = () => {
      ringsPending -= 1;
    };
  });

  // ── 책상 소품: 벼루·붓·두루마리 ──
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
    spirit.position.set(slot.x, 0.82 + slot.dy, slot.z);
    sprites.push(spirit);
    scene.add(spirit);
  }

  // ── DOM 버튼 재투영: 중립 카메라 대비 편차만 translate 로 얹는다 ──
  const projected = new Vector3();
  const domAnchors = DOM_ANCHORS
    .map(({ selector, at }) => {
      const element = host.querySelector<HTMLElement>(selector);
      if (!element) return null;
      // 기준값은 첫 프레임에서 실제 카메라로 채운다(아래 tick 참조).
      // 하드코딩하면 카메라를 조정할 때마다 버튼이 화면 밖으로 튄다.
      return { element, at, baseX: Number.NaN, baseY: Number.NaN };
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
    if (!reduced) {
      camera.position.x += (pointerX * 1.15 - camera.position.x) * 0.055;
      camera.position.y += (CAMERA_HOME.y - pointerY * 0.6 - camera.position.y) * 0.055;
      camera.lookAt(0, 0.15, 0.15);
      for (let index = 0; index < sprites.length; index += 1) {
        const sprite = sprites[index] as Sprite;
        const slot = SPIRIT_SLOTS[index] as SpiritSlot;
        sprite.position.y = 0.82 + slot.dy + Math.sin(elapsed * 1.3 + index * 1.6) * 0.05;
      }
      for (const anchor of domAnchors) {
        projected.copy(anchor.at).project(camera);
        const x = (projected.x * 0.5 + 0.5) * 1280;
        const y = (-projected.y * 0.5 + 0.5) * 720;
        if (Number.isNaN(anchor.baseX)) {
          anchor.baseX = x;
          anchor.baseY = y;
          continue;
        }
        // 편차는 시차 연출용이므로 과도하게 튀지 않도록 제한한다.
        const dx = Math.max(-26, Math.min(26, x - anchor.baseX));
        const dy = Math.max(-18, Math.min(18, y - anchor.baseY));
        anchor.element.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
      }
    }
    renderer.render(scene, camera);
  };
  tick();

  return {
    dispose(): void {
      window.cancelAnimationFrame(frame);
      if (!reduced) host.removeEventListener("pointermove", onPointer);
      for (const anchor of domAnchors) anchor.element.style.translate = "";
      renderer.dispose();
      canvas.remove();
    }
  };
}
