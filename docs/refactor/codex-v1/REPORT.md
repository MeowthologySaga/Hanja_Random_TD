# Codex 리팩터 v1 검증 보고서

- 작성일: 2026-08-27
- 대상: 캐주얼 3체 승급 구현 분리
- 기준 커밋: `83710954ece61002a70a39a2d5b8743afb95dd17`
- 격리 브랜치: `codex/refactor-casual-fusion-v1`
- 시작 체크포인트: `checkpoint/codex-refactor-v1-start`

## 안전 경계

- 제출본과 메인 작업 트리 `C:\Users\user\Documents\ChatGPT\한자 td`는 수정하지 않았다.
- 작업은 `C:\Users\user\Documents\ChatGPT\한자 td-codex-refactor-v1`에서만 수행했다.
- `dist/client`를 생성하거나 덮어쓰지 않았다. 빌드는 `%TEMP%`의 독립 폴더만 사용했다.
- 푸시와 배포는 수행하지 않았다.
- 게임 규칙, 밸런스 수치, UI 문구, GameEngine 공개 메서드 이름과 시그니처는 바꾸지 않았다.

## 변경 내용

- `src/core/game.ts`에서 캐주얼 3체 승급 구현을 제거하고 얇은 위임 메서드만 남겼다.
- `src/core/casual-fusion.ts`에 결과 풀, 보호 판정, 견적, 수동 승급, 자동 승급 계획과 실행을 모았다.
- 새 모듈은 `GameEngine` 전체를 받지 않는다. 상태, RNG, 자령 생성, 이벤트 방출 등 필요한 기능만 `CasualFusionContext`의 좁은 콜백으로 전달한다.
- `runSummonPool`은 값 복사가 아니라 getter로 읽는다. 한 호출 도중 목표 상태가 바뀌어도 원래 엔진처럼 최신 풀을 조회한다.
- 결과 추첨 뒤 `createTower`가 다시 RNG를 쓰는 기존 순서를 보존했다.

## 검증 결과

| 게이트 | 기준 | 리팩터 후 | 판정 |
|---|---:|---:|---|
| `npx tsc --noEmit` | 통과 | 통과 | PASS |
| `npx vitest run --dir tests` | 23파일·242테스트 통과 | 23파일·242테스트 통과 | PASS |
| 캐주얼 시뮬레이션 45회 | SHA-256 `3AA23B99...E45E62F` | 동일 | PASS |
| 표준 시뮬레이션 135회 | SHA-256 `F61C9FE6...828E8FB` | 동일 | PASS |
| 임시 Vite 빌드 | 통과·1,737파일 | 통과·1,737파일 | PASS |
| CSS | SHA-256 `999CA583...955815` | 동일 | PASS |
| 전체 Playwright E2E | 28/29 | 28/29 | 기준과 동일 |

시뮬레이션 JSON은 파일 바이트와 SHA-256이 모두 일치한다. 비교 파일은 `evidence/baseline`과 `evidence/post`에 보관했다.

빌드는 코드 모듈이 103개에서 104개로 분리되어 JS 번들 해시가 바뀌는 것이 정상이다. 정적 파일 수는 1,737개로 같고, 동일 경로 정적 에셋 중 바뀐 것은 새 JS 파일명을 참조하는 `index.html`뿐이다. CSS는 해시까지 동일하다. 메인 JS는 3,106,260바이트에서 3,106,804바이트로 544바이트 증가했고, `menu3d` JS는 547,443바이트로 동일하다.

## 기준부터 존재한 E2E 실패

리팩터 전후 모두 `e2e/tutorial.spec.ts:117` 한 건이 같은 이유로 실패한다.

- 4단계 승급 뒤 열린 `F01 formation-unlock-dialog`가 닫히지 않은 상태에서
- 5단계의 `[data-panel-tab="shop"]` 클릭을 가로막고
- 120초 타임아웃이 발생한다.

이 문제는 기준 커밋에서 재현된 기존 문제이며 캐주얼 승급 추출로 악화되지 않았다. 이번 커밋에는 튜토리얼이나 팝업 수정을 섞지 않았다.

## 다음 단계

사자성어/봉인 묶음과 전투 루프는 이번 변경에 포함하지 않는다. 이 커밋이 별도로 검토된 뒤 다음 추출을 새 체크포인트에서 시작한다.
