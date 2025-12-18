# 🚀 빠른 배포 가이드 (5분)

## 1단계: GitHub에 푸시

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## 2단계: Railway 프로젝트 생성

1. [Railway](https://railway.app) 접속 → GitHub로 로그인
2. **"New Project"** → **"Deploy from GitHub repo"**
3. 저장소 선택

## 3단계: PostgreSQL 추가

1. 프로젝트에서 **"New"** → **"Database"** → **"Add PostgreSQL"**
2. `DATABASE_URL` 복사

## 4단계: Next.js 앱 배포

1. **"New"** → **"GitHub Repo"** → 같은 저장소 선택
2. **Root Directory**: `app`
3. 환경 변수 추가:
   ```
   DATABASE_URL=<복사한 URL>
   JWT_SECRET=<랜덤 32자 이상 문자열>
   NODE_ENV=production
   ```
4. 배포 시작

## 5단계: KataGo 서비스 배포

1. **"New"** → **"GitHub Repo"** → 같은 저장소
2. **Root Directory**: `apps/katago`
3. **Dockerfile Path**: `Dockerfile.katago`
4. 배포 시작

## 6단계: GNU Go 서비스 배포

1. **"New"** → **"GitHub Repo"** → 같은 저장소
2. **Root Directory**: `apps/gnugo`
3. **Dockerfile Path**: `Dockerfile.gnugo`
4. 배포 시작

## 7단계: 환경 변수 업데이트

각 서비스의 **"Settings"** → **"Networking"** → **"Public Domain"** 확인 후:

### Next.js 앱 환경 변수 추가:
```
KATAGO_API_URL=https://katago-service.railway.app
GNUGO_API_URL=https://gnugo-service.railway.app
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

## 8단계: 데이터베이스 마이그레이션

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인 및 연결
railway login
railway link

# 마이그레이션 실행
railway run pnpm db:generate
railway run pnpm db:migrate
```

## 9단계: 확인

1. Next.js 앱 URL 접속
2. `/api/health` 엔드포인트 확인
3. 회원가입/로그인 테스트

---

**자세한 가이드는 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 참조**
