# Railway 빌드 실패 긴급 해결 방법

## 현재 문제
- Nixpacks가 `.nixpacks.toml`을 인식하지 못함
- `npm i`가 실행되어 `workspace:*` 프로토콜 오류 발생
- 빌드 실패 경고가 계속 증가

## 즉시 해결 방법

### 1. Frontend 서비스 설정

Railway 대시보드에서:

1. **SUDAM Frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **Build** 섹션으로 스크롤
4. **Build Command** 필드를 찾아서 **다음 명령어로 교체**:
   ```
   corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/web build
   ```
5. **Root Directory** 확인: `.` (프로젝트 루트)
6. **Builder** 확인: **Nixpacks**
7. **Deploy** 섹션으로 스크롤
8. **Start Command** 확인: `cd apps/web && pnpm start`
9. **Save** 버튼 클릭 (재배포 시작)

### 2. Backend 서비스 설정

Railway 대시보드에서:

1. **SUDAM Backend** 서비스 선택
2. **Settings** 탭 클릭
3. **Build** 섹션으로 스크롤
4. **Build Command** 필드를 찾아서 **다음 명령어로 교체**:
   ```
   corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/api build
   ```
5. **Root Directory** 확인: `.` (프로젝트 루트)
6. **Builder** 확인: **Nixpacks**
7. **Deploy** 섹션으로 스크롤
8. **Start Command** 확인: `cd apps/api && node dist/index.js`
9. **Save** 버튼 클릭 (재배포 시작)

## 중요 사항

- **Build Command를 직접 설정**하면 Nixpacks의 자동 감지를 우회합니다
- `corepack enable`로 pnpm을 강제로 활성화합니다
- `pnpm install --frozen-lockfile`로 의존성을 설치합니다
- Save를 클릭하면 **자동으로 재배포가 시작**됩니다

## 확인

재배포가 시작되면:
1. **Deployments** 탭에서 새 배포 확인
2. **Build Logs**에서 `pnpm install`이 실행되는지 확인
3. `npm i` 대신 `pnpm install`이 실행되어야 합니다

## 실패한 배포 정리

실패한 배포는 자동으로 정리되거나, Railway 대시보드에서 수동으로 삭제할 수 있습니다. 하지만 빌드가 성공하면 경고가 자동으로 사라집니다.

