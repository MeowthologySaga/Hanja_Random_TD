# Codex 리팩터 v1 롤백 절차

이 작업은 제출본과 분리된 브랜치에서만 이루어졌다. 아직 병합·푸시·배포하지 않았다면 메인 제출본에는 롤백할 변경 자체가 없다.

## 현재 리팩터를 잠시 제외해 실행하기

격리 작업 트리가 깨끗한 상태에서 시작 체크포인트를 detached HEAD로 연다.

```powershell
git -C "C:\Users\user\Documents\ChatGPT\한자 td-codex-refactor-v1" switch --detach checkpoint/codex-refactor-v1-start
```

리팩터 브랜치로 돌아올 때:

```powershell
git -C "C:\Users\user\Documents\ChatGPT\한자 td-codex-refactor-v1" switch codex/refactor-casual-fusion-v1
```

## 나중에 병합한 뒤 되돌리기

완료 커밋에는 `checkpoint/codex-refactor-v1-casual-fusion` 태그를 붙인다. 병합 또는 체리픽 후 문제가 발견되면 히스토리를 지우지 말고 역커밋한다.

```powershell
git revert checkpoint/codex-refactor-v1-casual-fusion
```

충돌이 나면 자동으로 밀어붙이지 말고 중단한다.

```powershell
git revert --abort
```

## 금지 사항

- 제출 브랜치에서 `git reset --hard`를 실행하지 않는다.
- `dist/client`를 이 리팩터 검증용으로 빌드하지 않는다.
- 검증 전 메인 직접 푸시나 Pages 배포를 하지 않는다.
- 기존 사용자 변경을 stash로 숨기거나 덮어쓰지 않는다.
