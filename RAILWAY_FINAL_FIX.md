# Railway 빌드 문제 최종 해결 방법

## 문제
- Nixpacks가 `npm i`를 실행하여 `workspace:*` 프로토콜을 인식하지 못함
- Root Directory가 `apps/web`로 설정되어 있어서 루트의 설정을 찾지 못함

## 해결 방법

### 각 서비스의 Root Directory를 프로젝트 루트(`.`)로 설정

**Frontend 서비스:**
1. Railway 대시보드 → SUDAM Frontend 서비스
2. Settings → Root Directory
3. 값을 `.` (프로젝트 루트)로 설정
4. Builder는 "Nixpacks"로 설정
5. Start Command: `cd apps/web && pnpm start`

**Backend 서비스:**
1. Railway 대시보드 → SUDAM Backend 서비스
2. Settings → Root Directory
3. 값을 `.` (프로젝트 루트)로 설정
4. Builder는 "Nixpacks"로 설정
5. Start Command: `cd apps/api && node dist/index.js`

## 이유

- 이 프로젝트는 pnpm workspace를 사용하는 monorepo입니다
- 루트의 `package.json`에 workspace 설정이 있습니다
- 루트의 `.nixpacks.toml` 파일이 pnpm을 올바르게 설정합니다
- Root Directory를 루트로 설정하면 `.nixpacks.toml`이 올바르게 인식됩니다

