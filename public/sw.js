/*
 * 천자진 서비스 워커 (R11).
 *
 * 첫 방문에 15MB 짜리 S00 텍스처를 받고 나면 두 번째 방문부터는 네트워크를
 * 한 번도 타지 않게 하는 것이 목적이다. 로딩 막이 두 번 뜨지 않아야 한다.
 *
 * 계약
 *   · 버전 키는 등록 URL 의 `?v=` 다(= 빌드 아이디). 새 빌드를 올리면 등록
 *     URL 이 바뀌어 브라우저가 워커 갱신을 감지하고, activate 에서 옛 캐시를
 *     통째로 지운다.
 *   · GitHub Pages 하위 경로(base "./")에서 돌아야 하므로 절대 경로를 쓰지
 *     않는다. 범위는 워커가 놓인 디렉터리다.
 *   · 문서(navigate)는 network-first — 새 배포를 놓치지 않기 위해서다.
 *   · `/assets/` 는 cache-first + 백그라운드 갱신(stale-while-revalidate).
 *     내용 해시가 박힌 번들은 불변이라 갱신 요청조차 보내지 않는다.
 *   · Range 요청(오디오 탐색)은 손대지 않고 네트워크로 흘려보낸다.
 *     부분 응답(206)을 캐시에 넣으면 다음 재생이 잘린 음원을 집는다.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `hanja-td-${VERSION}`;
/** 워커가 놓인 디렉터리. 하위 경로 배포에서도 이 값 하나로 판단한다. */
const SCOPE_PATH = new URL("./", self.location.href).pathname;

/** 내용 해시가 박힌 번들(`index-a1B2c3D4.js`). 같은 이름이면 같은 내용이다. */
const IMMUTABLE = /-[A-Za-z0-9_-]{8,}\.(?:js|css|map)$/;

self.addEventListener("install", (event) => {
  // 번들 이름은 빌드마다 바뀌므로 미리 담을 수 있는 것은 문서뿐이다.
  // 나머지는 실제로 쓰이는 순간 runtime 캐시에 쌓인다.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["./"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))))
      .then(() => self.clients.claim())
  );
});

/** 응답을 캐시에 넣어도 되는지. 부분·오류·불투명 응답은 넣지 않는다. */
function isStorable(response) {
  return Boolean(response) && response.status === 200 && response.type === "basic";
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // 해시 박힌 번들은 이름이 곧 내용이므로 다시 물어볼 이유가 없다.
    if (!IMMUTABLE.test(new URL(request.url).pathname)) revalidateInBackground(cache, request);
    return cached;
  }
  const response = await fetch(request);
  if (isStorable(response)) await cache.put(request, response.clone());
  return response;
}

/** 캐시본을 먼저 돌려준 뒤 조용히 최신본으로 갈아 끼운다. 실패는 무시한다. */
function revalidateInBackground(cache, request) {
  fetch(request)
    .then((response) => (isStorable(response) ? cache.put(request, response) : undefined))
    .catch(() => undefined);
}

/**
 * 문서는 network-first. 새 배포를 바로 집기 위해서다.
 * 캐시 키는 `?seed=` 같은 질의를 떼고 항상 "./" 로 정규화한다 — 시드마다
 * 별개 항목이 쌓이면 캐시가 무의미하게 부푼다.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isStorable(response)) await cache.put("./", response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match("./");
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  // 오디오 탐색이 쓰는 Range 요청은 통과. 206 을 캐시에 담으면 안 된다.
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const relative = url.pathname.slice(SCOPE_PATH.length);
  if (!relative.startsWith("assets/")) return;
  event.respondWith(staleWhileRevalidate(request));
});
