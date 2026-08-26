/// <reference types="vite/client" />

/**
 * 빌드마다 새로 박히는 아이디. 서비스 워커 캐시 버전 키로만 쓴다.
 * 값은 `vite.config.ts` 의 `define` 이 채운다.
 */
declare const __BUILD_ID__: string;
