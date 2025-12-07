# Railway 배포 가이드 - 3개 서비스 분리

이 가이드는 프론트엔드, 백엔드, 카타고를 각각 별도의 Railway 서비스로 배포하는 방법을 설명합니다.

## 사전 준비

1. Railway 계정이 필요합니다 (https://railway.app)
2. Railway CLI가 설치되어 있어야 합니다 (선택사항)
3. Git 저장소가 연결되어 있어야 합니다

## 배포 방법

### 방법 1: Railway 웹 대시보드 사용 (권장)

#### 1단계: 프로젝트 생성

1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택 (또는 "Empty Project" 선택 후 수동 설정)

#### 2단계: Frontend 서비스 배포

1. 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택 (또는 "Empty Service")
3. 서비스 이름: `frontend` (또는 원하는 이름)
4. Settings → Build & Deploy:
   - Build Command: (자동 감지)
   - Start Command: `npm run start-frontend`
   - Dockerfile Path: `Dockerfile.frontend`
5. Settings → Variables:
   ```
   VITE_API_URL=https://your-backend-service.railway.app
   VITE_WS_URL=wss://your-backend-service.railway.app
   ```
   (백엔드 서비스 URL은 백엔드 배포 후 설정)

#### 3단계: Backend 서비스 배포

1. 같은 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택
3. 서비스 이름: `backend` (또는 원하는 이름)
4. Settings → Build & Deploy:
   - Build Command: (자동 감지)
   - Start Command: `npm run start-server`
   - Dockerfile Path: `Dockerfile.backend`
5. Settings → Variables:
   ```
   ENABLE_FRONTEND_SERVING=false
   KATAGO_API_URL=https://your-katago-service.railway.app
   DATABASE_URL=<your-database-url>
   PORT=4000
   ```
   (기존 환경 변수들도 모두 설정)

#### 4단계: KataGo 서비스 배포

1. 같은 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택
3. 서비스 이름: `katago` (또는 원하는 이름)
4. Settings → Build & Deploy:
   - Build Command: (자동 감지)
   - Start Command: `npm run start-katago`
   - Dockerfile Path: `Dockerfile.katago`
5. Settings → Variables:
   ```
   PORT=4001
   KATAGO_PATH=/app/katago/katago
   KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
   KATAGO_HOME_PATH=/app/server/katago_home
   KATAGO_NUM_ANALYSIS_THREADS=4
   KATAGO_NUM_SEARCH_THREADS=8
   KATAGO_MAX_VISITS=1000
   KATAGO_NN_MAX_BATCH_SIZE=16
   ```

#### 5단계: 서비스 간 연결 설정

1. 각 서비스의 공개 URL 확인:
   - Backend: Settings → Networking → Generate Domain
   - KataGo: Settings → Networking → Generate Domain
   - Frontend: Settings → Networking → Generate Domain

2. 환경 변수 업데이트:
   - Frontend의 `VITE_API_URL`과 `VITE_WS_URL`을 Backend URL로 설정
   - Backend의 `KATAGO_API_URL`을 KataGo URL로 설정

3. 각 서비스 재배포 (환경 변수 변경 후 자동 재배포)

### 방법 2: Railway CLI 사용

```bash
# Railway CLI 로그인
railway login

# 프로젝트 초기화 (처음 한 번만)
railway init

# Frontend 서비스 배포
railway link --service frontend
railway up --dockerfile Dockerfile.frontend

# Backend 서비스 배포
railway link --service backend
railway up --dockerfile Dockerfile.backend

# KataGo 서비스 배포
railway link --service katago
railway up --dockerfile Dockerfile.katago
```

## 환경 변수 체크리스트

### Frontend Service
- [ ] `VITE_API_URL` - Backend 서비스의 공개 URL
- [ ] `VITE_WS_URL` - Backend 서비스의 WebSocket URL (wss://)

### Backend Service
- [ ] `ENABLE_FRONTEND_SERVING=false` - 프론트엔드 서빙 비활성화
- [ ] `KATAGO_API_URL` - KataGo 서비스의 공개 URL
- [ ] `DATABASE_URL` - PostgreSQL 데이터베이스 URL
- [ ] 기존 환경 변수들 (JWT_SECRET, EMAIL 설정 등)

### KataGo Service
- [ ] `PORT=4001`
- [ ] `KATAGO_PATH=/app/katago/katago`
- [ ] `KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz`
- [ ] `KATAGO_HOME_PATH=/app/server/katago_home`
- [ ] `KATAGO_NUM_ANALYSIS_THREADS=4`
- [ ] `KATAGO_NUM_SEARCH_THREADS=8`
- [ ] `KATAGO_MAX_VISITS=1000`
- [ ] `KATAGO_NN_MAX_BATCH_SIZE=16`

## 배포 순서 권장사항

1. **KataGo 서비스 먼저 배포** (가장 독립적)
2. **Backend 서비스 배포** (KataGo URL 필요)
3. **Frontend 서비스 배포** (Backend URL 필요)

## 헬스체크 확인

각 서비스가 정상 작동하는지 확인:

- Frontend: `https://your-frontend.railway.app/`
- Backend: `https://your-backend.railway.app/api/health`
- KataGo: `https://your-katago.railway.app/api/health`

## 문제 해결

### Frontend가 Backend에 연결되지 않는 경우
- `VITE_API_URL`과 `VITE_WS_URL`이 올바른지 확인
- CORS 설정 확인 (Backend의 `corsOptions`)

### Backend가 KataGo에 연결되지 않는 경우
- `KATAGO_API_URL`이 올바른지 확인
- KataGo 서비스가 정상 실행 중인지 확인 (`/api/health`)

### 빌드 실패
- 각 서비스의 Dockerfile 경로가 올바른지 확인
- 빌드 로그 확인 (Railway 대시보드 → Deployments → View Logs)

## 참고사항

- Railway는 같은 프로젝트 내 서비스 간 내부 네트워크를 제공합니다
- 내부 네트워크를 사용하려면 서비스 이름을 사용할 수 있습니다 (예: `http://backend:4000`)
- 하지만 공개 URL을 사용하는 것이 더 안정적입니다

