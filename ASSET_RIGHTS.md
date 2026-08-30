# 프로젝트 전용 에셋 이용 경계

`public/assets`의 자령 스프라이트, 적 스프라이트, 지도·UI 그래픽 등 프로젝트 전용 에셋은 이 저장소의 게임 실행과 검토를 위해 포함되어 있습니다.

`public/assets/audio`의 BGM·효과음은 저장소 소유자가 승인한 Suno 작업공간에서 이 프로젝트 전용 프롬프트로 생성했습니다. 생성 프롬프트와 Suno 원본 ID는 `src/data/audio-manifest.json`에, 변환·검사 결과는 `public/assets/audio/audio-qc.json`에 보존합니다. 사용 범위는 생성 당시 해당 Suno 계정에 적용되는 이용 조건을 따릅니다.

저장소 소유자가 별도의 라이선스를 명시하지 않는 한, 해당 프로젝트 전용 에셋의 재배포·재판매·타 프로젝트 전용은 허가되지 않습니다.

한자 읽기·부수·획순 데이터 등 제3자 자료의 출처와 라이선스는 `THIRD_PARTY_NOTICES.md`를 따릅니다. 특히 `public/data/hanzi-stroke-medians-v1.json`은 Arphic Public License를 상속한 자료이므로, 배포본에는 해당 라이선스 고지가 함께 가야 합니다. 이 파일은 선택 항목(획순 안내, 기본 꺼짐)을 켠 사람에게만 내려갑니다.
