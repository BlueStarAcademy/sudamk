# Railway 수동 재배포 방법

## 문제
KataGo만 재배포되고 Frontend/Backend는 재배포되지 않음

## 해결 방법

### 방법 1: 설정 변경으로 재배포 트리거 (권장)

각 서비스의 Settings에서 아무 설정이나 변경하고 Save하면 재배포가 시작됩니다.

**Frontend 서비스:**
1. Railway 대시보드 → **SUDAM Frontend** 서비스
2. **Settings** 탭
3. **Build Command** 필드 확인/수정:
   ```
   corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/web build
   ```
4. **Root Directory**: `.` 확인
5. **Start Command**: `cd apps/web && pnpm start` 확인
6. **Save** 클릭 (재배포 시작)

**Backend 서비스:**
1. Railway 대시보드 → **SUDAM Backend** 서비스
2. **Settings** 탭
3. **Build Command** 필드 확인/수정:
   ```
   corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/api build
   ```
4. **Root Directory**: `.` 확인
5. **Start Command**: `cd apps/api && node dist/index.js` 확인
6. **Save** 클릭 (재배포 시작)

### 방법 2: Deployments 탭에서 수동 재배포

1. Railway 대시보드 → 각 서비스
2. **Deployments** 탭
3. **Redeploy** 버튼 클릭 (있는 경우)
4. 또는 **Settings** → **Deploy** → **Redeploy** 버튼

### 방법 3: Git 커밋으로 재배포 트리거

빈 커밋을 만들어서 푸시하면 재배포가 시작됩니다:

```bash
git commit --allow-empty -m "Trigger redeploy"
git push origin develop
```

## 확인

재배포가 시작되면:
- Deployments 탭에서 새로운 배포가 시작되는지 확인
- Build Logs에서 `pnpm install`이 실행되는지 확인
- `npm i` 대신 `pnpm install`이 실행되어야 합니다

