# Railway Start Command 설정 가이드

## 문제
Nixpacks 빌드 후 "No start command could be found" 에러가 발생합니다.

## 해결 방법

Railway 대시보드에서 각 서비스의 Start Command를 직접 설정해야 합니다.

### 1. Frontend 서비스 (SUDAM Frontend)

1. Railway 대시보드에서 **SUDAM Frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **Deploy** 섹션으로 스크롤
4. **Start Command** 필드에 다음 명령어 입력:
   ```
   cd apps/web && pnpm start
   ```
5. **Save** 버튼 클릭

### 2. Backend 서비스 (SUDAM Backend)

1. Railway 대시보드에서 **SUDAM Backend** 서비스 선택
2. **Settings** 탭 클릭
3. **Deploy** 섹션으로 스크롤
4. **Start Command** 필드에 다음 명령어 입력:
   ```
   cd apps/api && node dist/index.js
   ```
5. **Save** 버튼 클릭

## 참고

- Start Command를 설정하면 Railway가 자동으로 재배포를 시작합니다.
- 설정 후 배포 로그에서 start command가 올바르게 실행되는지 확인하세요.
- `.nixpacks.toml` 파일의 `[start]` 섹션은 Railway가 Nixpacks를 사용할 때 인식하지 못할 수 있습니다.

