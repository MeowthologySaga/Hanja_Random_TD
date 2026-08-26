# v0.33 Suno 게임 오디오 설계·통합 기록

> v0.34에서 메인 메뉴용 `Moonlit Codex`가 추가되었다. 연결·QC 세부값은 `v034-main-menu-audio.md`를 따른다.

## 목표표

| key | type | use | Suno mode | target file | normalize | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `early` | zone BGM | 1–30W | Advanced Instrumental v5.5 | `dawn-formation-loop.mp3` | `I=-20:TP=-1.5:LRA=11` | 94 BPM, 여명·수묵 전장 |
| `mid` | zone BGM | 31–60W | Advanced Instrumental v5.5 | `five-elements-march-loop.mp3` | `I=-20:TP=-1.5:LRA=11` | 108 BPM, 오행 순환 |
| `late` | zone BGM | 61–99W | Advanced Instrumental v5.5 | `inkstorm-siege-loop.mp3` | `I=-20:TP=-1.5:LRA=11` | 118 BPM, 먹폭풍 공성 |
| `boss` | boss BGM | 10–90W 보스 | Advanced Instrumental v5.5 | `seal-guardian-boss-loop.mp3` | `I=-20:TP=-1.5:LRA=11` | 126 BPM, 2:39 장편 대봉인 수호자 |
| `final` | boss BGM | 100W 최종전 | Advanced Instrumental v5.5 | `heavenly-seal-final-loop.mp3` | `I=-20:TP=-1.5:LRA=11` | 132 BPM, 천자문 대봉인 |
| `ui-confirm` | UI SFX | 실행·설정 확인 | Sounds One-Shot v5.5 | `ui-confirm.mp3` | peak `-1 dBFS` | 나무 인장·옥 종 |
| `summon` | progression SFX | 자령 소환 | Sounds One-Shot v5.5 | `jaryeong-summon.mp3` | peak `-1 dBFS` | 부적·북·종 |
| `fusion-strategy` | progression SFX | 전략 합성 | Sounds One-Shot v5.5 | `strategy-fusion.mp3` | peak `-1 dBFS` | 세 인장 결합 |
| `fusion-casual` | progression SFX | 캐주얼 3체 조합 | Sounds One-Shot v5.5 | `casual-fusion.mp3` | peak `-1 dBFS` | 밝은 3음 상승 |
| `concentration` | progression SFX | 농축 | Sounds One-Shot v5.5 | `concentration.mp3` | peak `-1 dBFS` | 응집·금속 인장 |
| `upgrade` | progression SFX | 공용·오행·특성 강화 | Sounds One-Shot v5.5 | `tower-upgrade.mp3` | peak `-1 dBFS` | 2음 옥 종 |
| `dismantle` | progression SFX | 분해 | Sounds One-Shot v5.5 | `spirit-dismantle.mp3` | peak `-1 dBFS` | 종이·모래 환원 |
| `goal-complete` | progression SFX | 목표·성어 완성 | Sounds One-Shot v5.5 | `goal-complete.mp3` | peak `-1 dBFS` | 네 석종·의식 징 |
| `wave-start` | combat SFX | 일반 웨이브 시작 | Sounds One-Shot v5.5 | `wave-start.mp3` | peak `-1 dBFS` | 북·딱따기 |
| `boss-warning` | combat SFX | 보스 경고 | Sounds One-Shot v5.5 | `boss-warning.mp3` | peak `-1 dBFS` | 대북·청동 징 |
| `victory` | result SFX | 100W 승리 | Sounds One-Shot v5.5 | `victory.mp3` | peak `-1 dBFS` | 가야금·의식 종결 |
| `defeat` | result SFX | 패배 | Sounds One-Shot v5.5 | `defeat.mp3` | peak `-1 dBFS` | 낮은 징·거문고 하강 |

## 런타임 원칙

- 첫 사용자 조작 전에는 재생하지 않는다.
- 구간 BGM과 보스 BGM은 3초 크로스페이드한다.
- 보스 음악은 진입 8초 뒤 시작해 빨리 처치한 보스의 잦은 교체를 막고, 보스 종료 뒤 5초 유예 후 구간곡으로 돌아간다.
- SFX는 키별 1–3개 오디오 풀과 최소 재생 간격을 사용한다. 10연 소환과 연속 강화가 기존 재생을 잘라 먹지 않게 하되 동시 폭주도 제한한다.
- 매 타격·능력은 파일 SFX를 추가하지 않고 기존 Web Audio 합성음을 유지하며, 최소 간격을 각각 95ms·90ms로 늘리고 음량을 낮춘다.
- BGM·효과음 음량과 개별 음소거, 전체 음소거를 `localStorage`에 저장한다.

## 제작·검증 기록

- Suno 작업공간 `김길우-한자td`에서 BGM 6회·SFX 12회, 후보 36개를 생성하고 17개를 채택했다. 일반 보스곡 첫 후보는 23초로 반복 피로가 커서 제외하고 2분 39초 장편 후보를 다시 생성해 채택했다.
- 세션 전 2,350크레딧에서 완료 후 2,266크레딧으로 84크레딧을 사용했다.
- 다운로드 원본은 `.codex_tmp/suno-audio-v033/raw`에 안정적인 이름으로 보존하며 Git에는 포함하지 않는다.
- 선정 자산의 제목·파일·전체 영문 프롬프트·Suno 모드·원본 ID·실제 길이·용도는 `src/data/audio-manifest.json`, 재측정 음량·바이트·SHA-256은 `public/assets/audio/audio-qc.json`에 기록한다.
