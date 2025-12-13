# Railway Root Directory 설정으로 문제 해결

## 문제
Nixpacks가 루트에서 빌드할 때 start command를 찾지 못함

## 해결 방법: Root Directory 변경

각 서비스의 Root Directory를 해당 서비스 디렉토리로 변경하면, 서비스별 `.nixpacks.toml` 파일이 사용됩니다.

### 1. Frontend 서비스 설정

1. Railway 대시보드 → **SUDAM Frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **Root Directory** 필드를 찾아서 다음으로 변경:
   ```
   apps/web
   ```
4. **Save** 버튼 클릭

이렇게 하면 `apps/web/.nixpacks.toml` 파일이 사용되며, start command가 `pnpm start`로 설정됩니다.

### 2. Backend 서비스 설정

1. Railway 대시보드 → **SUDAM Backend** 서비스 선택
2. **Settings** 탭 클릭
3. **Root Directory** 필드를 찾아서 다음으로 변경:
   ```
   apps/api
   ```
4. **Save** 버튼 클릭

이렇게 하면 `apps/api/.nixpacks.toml` 파일이 사용되며, start command가 `node dist/index.js`로 설정됩니다.

## 확인

Root Directory를 변경하면 Railway가 자동으로 재배포를 시작합니다. 배포 로그에서:
- `apps/web/.nixpacks.toml` 또는 `apps/api/.nixpacks.toml` 파일이 사용되는지 확인
- Start command가 올바르게 실행되는지 확인

## 참고

- Root Directory를 변경하면 해당 디렉토리를 기준으로 빌드가 진행됩니다
- 각 서비스의 `.nixpacks.toml` 파일이 올바르게 인식됩니다
- `package.json`의 `start` 스크립트도 올바르게 인식됩니다

