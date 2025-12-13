# Railway Build Command 직접 설정 방법

## 문제
Nixpacks가 `.nixpacks.toml` 파일을 인식하지 못하여 `npm i`를 실행하고 있습니다.

## 해결 방법: Build Command를 직접 설정

Railway 대시보드에서 Build Command를 직접 설정하여 pnpm을 강제로 사용합니다.

### Frontend 서비스

1. Railway 대시보드 → **SUDAM Frontend** 서비스
2. **Settings** 탭 → **Build** 섹션
3. **Build Command** 필드에 다음 입력:
   ```
   corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/web build
   ```
4. **Root Directory**: `.` (프로젝트 루트)
5. **Builder**: Nixpacks
6. **Start Command**: `cd apps/web && pnpm start`
7. **Save**

### Backend 서비스

1. Railway 대시보드 → **SUDAM Backend** 서비스
2. **Settings** 탭 → **Build** 섹션
3. **Build Command** 필드에 다음 입력:
   ```
   corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/api build
   ```
4. **Root Directory**: `.` (프로젝트 루트)
5. **Builder**: Nixpacks
6. **Start Command**: `cd apps/api && node dist/index.js`
7. **Save**

## 참고

- Build Command를 직접 설정하면 Nixpacks의 자동 감지를 우회합니다
- `corepack enable`로 pnpm을 활성화합니다
- `pnpm install --frozen-lockfile`로 의존성을 설치합니다
- 각 서비스별로 필요한 빌드만 실행합니다

