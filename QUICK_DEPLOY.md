# 빠른 배포 가이드 (Quick Deploy Guide)

## 5분 안에 배포하기

### 1단계: Railway 프로젝트 생성 (1분)

1. [railway.app](https://railway.app) 접속 및 로그인
2. "New Project" → "Deploy from GitHub repo"
3. GitHub 저장소 선택 및 연결

### 2단계: 데이터베이스 추가 (1분)

1. 프로젝트에서 "+ New" → "Database" → "Add PostgreSQL"
2. 생성 후 "Variables" 탭에서 `DATABASE_URL` 복사

### 3단계: Backend 배포 (2분)

1. "+ New" → "GitHub Repo" → 같은 저장소 선택
2. 서비스 이름: `sudam-api`
3. 환경 변수 추가:
   ```
   NODE_ENV=production
   DATABASE_URL=<복사한 DATABASE_URL>
   JWT_SECRET=<랜덤 32자 이상 문자열>
   ```
4. 배포 시작 (자동)

### 4단계: Frontend 배포 (1분)

1. "+ New" → "GitHub Repo" → 같은 저장소 선택
2. 서비스 이름: `sudam-web`
3. 환경 변수 추가:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=<Backend 서비스 URL>
   ```
   - Backend URL은 Backend 서비스의 "Settings" → "Networking"에서 확인
4. 배포 시작 (자동)

### 5단계: 마이그레이션 실행 (1분)

Backend 서비스가 배포된 후:

**Railway CLI 사용**:
```bash
railway run --service sudam-api pnpm --filter @sudam/database exec prisma migrate deploy
```

**또는 Deploy Script에 추가**:
Backend 서비스 → Settings → Deploy → Deploy Script:
```bash
pnpm --filter @sudam/database exec prisma generate
pnpm --filter @sudam/database exec prisma migrate deploy
```

## 확인

- Backend: `https://your-backend.railway.app/health`
- Frontend: `https://your-frontend.railway.app`

## 자동 배포

✅ **Railway는 GitHub 저장소와 연결하면 자동 배포됩니다!**

- `develop` 또는 `main` 브랜치에 푸시하면 자동으로 배포 시작
- Railway 대시보드에서 배포 상태 확인 가능
- 자세한 내용은 [`AUTO_DEPLOY.md`](./AUTO_DEPLOY.md) 참고

## 문제 발생 시

자세한 가이드는 [`RAILWAY_SETUP.md`](./RAILWAY_SETUP.md)를 참고하세요.

---

**총 소요 시간**: 약 5분 (초기 설정)  
**이후**: Git 푸시만 하면 자동 배포! 🚀

