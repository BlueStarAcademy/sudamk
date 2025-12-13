# Railway Start Command 문제 해결

## 현재 상황
- Nixpacks가 start command를 찾지 못함
- `.nixpacks.toml`의 `[start]` 섹션이 인식되지 않음

## 해결 방법 (2가지)

### 방법 1: Railway 대시보드에서 직접 설정 (권장)

**Frontend 서비스:**
1. Railway 대시보드 → SUDAM Frontend 서비스
2. Settings → Deploy 섹션
3. Start Command 입력: `cd apps/web && pnpm start`
4. Save

**Backend 서비스:**
1. Railway 대시보드 → SUDAM Backend 서비스
2. Settings → Deploy 섹션
3. Start Command 입력: `cd apps/api && node dist/index.js`
4. Save

### 방법 2: Root Directory 변경

각 서비스의 Root Directory를 변경하여 서비스별 `.nixpacks.toml` 사용:

**Frontend:**
- Root Directory: `apps/web`
- 그러면 `apps/web/.nixpacks.toml`이 사용됨

**Backend:**
- Root Directory: `apps/api`
- 그러면 `apps/api/.nixpacks.toml`이 사용됨

## 참고
- `package.json`에 `start` 스크립트가 있어도 Nixpacks가 인식하지 못할 수 있음
- Railway 대시보드에서 직접 설정하는 것이 가장 확실함

