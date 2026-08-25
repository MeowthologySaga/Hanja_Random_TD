# 인계 기록

한 줄씩 추가합니다. 최신이 위.

| 날짜 | 방향 | 내용 |
|---|---|---|
| 2026-08-26 | Claude | 4건: P00·S13 역방향 명암 교정, 3D 고리 z-fight 점멸 제거(depthWrite/renderOrder), 소환 카드 가시성(오행 색점·NEW 뱃지 정리), 빠른 시작 클릭 삼킴 수정(topbar pointer-events) + 엽전 팝 피드백 |
| 2026-08-26 | Claude | 가독 대공사: 패널 텍스트 71%가 12px 미만(실측 census)이던 것을 토큰+오펜더 직접 상향으로 재분포(6~9.5px 471→소수 장식만). 행높이 보정, overflow 스캔 후 6건 정리, 온보딩 칩 종이화 |
| 2026-08-26 | Claude | 별승급 전 지역 지원: Unihan 17.0.0 kTotalStrokes 보충 3,560자 생성 + casual 폴백 + core 게이트 제거(선점 고지). 런 시드는 개발자 모드(` 5연타)로 이동. S00 대비 실측 검수 6곳 교정 |
| 2026-08-26 | Codex → Claude | `to-claude/p0-ui-components-pack-v1/` 전달. v3 P0 1-3~1-8의 빈 8탭 레일 381×89, 대칭 상태 띠 333×43, 자령 명패 3상태×2형, 자원 아이콘 4종, 조작 픽토그램 3종, 오행 셀 소켓 5×빈/점유 10종 등 런타임 PNG 25장. 9-slice·상태 우선순위·최악 훈음·강조 OFF·8탭 구조·오류 fallback 명세와 프롬프트/처리/QC/체크섬 포함. visible magenta 0, 최종 QC PASS. Codex는 게임 코드를 수정하지 않음. |
| 2026-08-25 | Claude | S13 맞춤 진법 구현(범위→P00 위임·표기·규칙, 기존 설정 API 연결), 우상단 메달리온 정원 비율 복원, 3D 화질 패스(셸 스케일 픽셀비 + 전 텍스처 이방성) |
| 2026-08-25 | Claude(루프) | 출정 걸쇠를 책 앞단면 판으로 재배치(프레임 잘림 해소), 맞춤 진법 쪽지를 눌리는 조작물로(hover/pressed 스킨 + 준비 중 응답) |
| 2026-08-26 | Codex → Claude | `to-claude/s00-3d-texture-pack-v1/` 전달. `?menu3d=1`용 무문자 RGB 텍스처 8종(페이지 좌·우 1K, 표지 1K, 페이지 단면 512×128, 책상 1K, 저초점 뒷벽 2048×768, 책등 512, 소품 2×2 아틀라스 1K), material/UV/fallback/좌표/완료 판정 명세와 ImageGen 원본·프롬프트·체크섬 포함. 먹 고리는 페이지에 미포함이며 기존 5좌표 baking 유지. 최종 QC PASS. Codex는 게임 코드를 수정하지 않음. |
| 2026-08-26 | Codex → Claude | `to-claude/s00-layered-bg-pack-v1/` 전달. S00 2.5D용 1280×720 책상 RGB + 책·다섯 고리 RGBA + 하단 전경 RGBA 3레이어, 시차 -8/0/+16/+24, 고정 고리 중심·reduced-motion·fallback·완료 판정 포함. ImageGen 책 생성본의 위치 변화는 런타임에서 배제하고 승인 RGB+생성 실루엣으로 좌표를 보존. 최종 QC PASS. Codex는 게임 코드를 수정하지 않음. |
| 2026-08-25 | Claude(루프) | 3D 서재를 기본 메인 메뉴로 승격 (?menu3d=0 폴백, WebGL 실패 시 자동 2D). 사용자 지적 반영 |
| 2026-08-25 | Codex → Claude | `to-claude/urgent-p0-enemy-altar-pack-v1/` 전달. v3 P0의 적 전용 6아키타입(512×256 2프레임 시트)과 오행진 제단 木/火/土/金/水 × 개방/잠김 10종(546→182px), 고정 십자 좌표 S02 합성 프리뷰·상태/트리거/오류 fallback 구현 명세 포함. 런타임 16종 + 보조 프레임 12종, 최종 QC PASS(오류 0; provenance 원본의 alpha 1 자홍 픽셀은 런타임에서 제거). Codex는 게임 코드를 수정하지 않음. 8탭 레일 이하 v3 나머지 요청은 계속 유효. |
| 2026-08-25 | Codex → Claude | 사용자 승인 B안 `to-claude/main-menu-b-living-codex-pack-v1/` 전달. 무문자 소환 서책 배경과 버튼·지역 인장·출정·P00 등 독립 PNG 41종, S00/P00 좌표·상태·트리거·데이터·반응형·접근성 구현 명세, 1280×720 프리뷰 포함. 배경과 모든 클릭부를 분리했고 최종 QC PASS(체크섬 77, 실패·경고 0). Codex는 게임 코드를 수정하지 않음. |
| 2026-08-25 | Codex → Claude | `to-claude/aoe-modular-fx-pack-v1/` 전달. 길쭉한 2.39:1 광역 띠를 오행별 256×256 정사각 모듈 5종으로 교체하고, 기본 1개/경로 확장 3개 합집합 규칙·중복 피해 방지·1280×720 비교 보드 포함. 검증 PASS. 실제 코드 적용은 사용자 별도 구현 지시 전 보류. |
| 2026-08-25 | Claude | S00 3D 정식 모델링: 가죽 표지·페이지 블록·굽은 펼침면·책등·모서리 금장·소품, 먹 고리를 페이지에 baking, DOM 조작물을 3D 앵커에 재투영 |
| 2026-08-25 | Claude → Codex | `to-codex/request-s00-3d-textures-v1.md` — 3D 서재 텍스처 8장(또는 .glb 대안) 요청. 좌표 계약 포함 |
| 2026-08-25 | Claude | S00 2.5D 리그 구현(포인터 시차·기립 자령 빌보드·reduced-motion 대응). 에셋 bbox 실측 정합 |
| 2026-08-25 | Claude → Codex | `to-codex/request-s00-layered-bg-v1.md` — 새 목업 장면의 무문자 3-레이어 배경 요청 |
| 2026-08-25 | Claude | 수신·구현: `main-menu-b-living-codex-pack-v1` — S00/P00 을 B안으로 교체. 41개 PNG 설치, 독립 button+skin 레이어, P00 pending 흐름, 캐주얼 JP/CN 사유. [선점 유지] `src/main.ts` 템플릿·`src/ui-skin.css` |
| 2026-08-25 | Claude | 오행진 해금 발견성: 해금 가능 시 상점 버튼 금색 펄스 + 전장 이름표 `해금 가능!` + 최초 1회 안내 토스트 |
| 2026-08-25 | Claude | 수신·적용: `aoe-modular-fx-pack-v1`. 비균등 1.48R×0.62R 폐기, 정사각 D×D + 결정적 ±8° 회전. 사용자 피드백 반영: 그림 1.6R 축소 + 판정 R 붓선 테두리 + 생성 스케일-인 + 피격 불티. [선점] `src/ui/combat-fx-*` |
| 2026-08-25 | Claude | 잘림 스윕(5 에이전트) 반영: `max(10px,1em)` 확대 버그 제거, 농축·목표·자령 탭 국소 교정, 농축 수치 정수화, 액션 라벨 축약 |
| 2026-08-25 | Claude → Codex | `to-codex/asset-request-v3-full.md` — 시각 전량 + 수노 사운드 13종 마스터 목록. status-strip/nav-rail 재제작 사유 포함 |
| 2026-08-25 | Claude | 탭 재편(10→8 한 줄, 도감→헤더, 기록→상시 티커), 강화 탭 세로 재배치, 탭 아이콘 잘림·구운 인장 수정, 합성 스프라이트 복구. e2e 갱신, 테스트 240/240 |
| 2026-08-25 | Claude → Codex | **긴급** `to-codex/asset-request-v2-urgent.md`. 내일 공모전 마감. 최우선 3건: 적 전용 스프라이트 6장 · 오행진 제단 판 10장 · 10탭용 하단 레일 |
| 2026-08-25 | Claude | `hanji-ui-pack-v1` 적용 완료: 한지·먹 전면 전환, 아이콘 10종, 먹길 15종으로 `drawTrack` 재작성, 한지 조각 5종. 테스트 240/240 · 빌드 통과 |
| 2026-08-25 | Claude | 수신 확인: `hanji-ui-pack-v1`. 기능 아이콘 10종을 `public/assets/ui/icons/`로 통합(어두운 선화라 금박 반전 틴트 적용). [선점] `src/ui-skin.css`, `src/main.ts` draw*, `public/assets/ui/**` |
| 2026-08-25 | Codex → Claude | `to-claude/hanji-ui-pack-v1/` 전달. 승인된 한지·먹 UI 10화면, 통합 도감, 먹길 모듈, 독립 PNG 50종, 화면·상태·9-slice·데이터 명세 포함. 검증 PASS. 이번 전달은 검토 전용이며 게임 UI 구현 권한은 아직 없음. |
| 2026-08-25 | 코덱스 → 클로드 | 1차 UI 시안 반려를 반영해 오행 십자 진형 고정 및 상용 게임형 HUD 재설계 사전 제약 회신을 `to-claude/request.md`로 요청. UI 구현은 승인 뒤로 보류. |
| 2026-08-25 | Claude → Codex | `to-codex/asset-request-v1.md` 발행. P0~P3 총 152장 요청. 최우선은 적 전용 스프라이트 18장 + 탭 아이콘 20장 |
| 2026-08-25 | Claude | 동양풍 전환: 먹지·흑단·금박·단청 팔레트, 창호 문살, 도감 서책화, 첫 실행 코치마크, 적 위협 표식. 테스트 240/240 · 빌드 통과 |
| 2026-08-25 | Claude → Codex | `to-codex/ui-redesign-constraints-v1.md` 회신. 십자 좌표·히트영역·상태·880/400 통합 위험 8건·자산 슬롯 26개·최악 데이터 길이 |
| 2026-08-25 | Claude | [선점] `src/styles.css`, `src/main.ts` draw* 함수군, `index.html` — 브랜치 `claude/uiux-overhaul-v1` |
| 2026-08-25 | Claude | UI 초벌: `src/ui-skin.css` 신설(토큰+표면), `drawBoard`/`drawSpiritTowerLabel` 재작성. 테스트 240/240 통과 |
| 2026-08-25 | - | 인계 폴더 개설 (클로드) |
