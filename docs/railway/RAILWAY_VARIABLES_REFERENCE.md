# Railway 환경 변수 참고 가이드

프로젝트 삭제 후 재배포 시 필요한 모든 환경 변수 목록입니다.

## 📋 서비스별 환경 변수

### 1. **Frontend 서비스** (SUDAM frontend)

#### 필수 환경 변수
```
VITE_API_URL=https://your-backend-service.railway.app
VITE_WS_URL=wss://your-backend-service.railway.app
```

**설명:**
- `VITE_API_URL`: Backend 서비스의 공개 URL (HTTPS)
- `VITE_WS_URL`: Backend 서비스의 WebSocket URL (WSS)
- ⚠️ **중요**: Backend 서비스 배포 후 URL을 확인하고 설정해야 합니다.

---

### 2. **Backend 서비스** (SUDAM backend)

#### 필수 환경 변수
```
NODE_ENV=production
PORT=4000
ENABLE_FRONTEND_SERVING=false
DATABASE_URL=postgresql://postgres:PASSWORD@postgres-production-xxxx.up.railway.app:5432/railway
KATAGO_API_URL=https://your-katago-service.railway.app/api/katago/analyze
GNUGO_API_URL=https://your-gnugo-service.railway.app/api/gnugo/move
FRONTEND_URL=https://your-frontend-service.railway.app
```

#### 선택적 환경 변수 (기능별)

**이메일 서비스 (AWS SES)**
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
EMAIL_FROM=noreply@yourdomain.com
```

**이메일 서비스 (SMTP - 개발/대안)**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**카카오 로그인**
```
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
KAKAO_REDIRECT_URI=https://your-frontend-service.railway.app/auth/kakao/callback
```

**설명:**
- `ENABLE_FRONTEND_SERVING=false`: 프론트엔드 서빙 비활성화 (별도 서비스로 분리)
- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 URL (Railway Postgres 서비스에서 복사)
- `KATAGO_API_URL`: KataGo 서비스의 공개 URL (KataGo 서비스 배포 후 설정)
- `FRONTEND_URL`: 프론트엔드 서비스 URL (이메일 링크용)

---

### 3. **KataGo 서비스** (katago)

#### 필수 환경 변수
```
PORT=4001
KATAGO_PATH=/app/katago/katago
KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
KATAGO_HOME_PATH=/app/server/katago_home
KATAGO_NUM_ANALYSIS_THREADS=4
KATAGO_NUM_SEARCH_THREADS=8
KATAGO_MAX_VISITS=1000
KATAGO_NN_MAX_BATCH_SIZE=16

# 계가 전용 한도 (선택) — 설정 시 계가 시에만 적용, 분석 시간 8~12초대 목표
KATAGO_SCORING_MAX_VISITS=300
KATAGO_SCORING_MAX_TIME_SEC=10
```

**설명:**
- KataGo AI 엔진 실행에 필요한 설정들
- 모델 파일 경로와 성능 튜닝 파라미터
- `KATAGO_SCORING_*`: 계가 시에만 적용. 적용 후 몇 판으로 승자·점수 일치 여부 확인 권장 ([계가 성능 옵션](../troubleshooting/SCORING_PERFORMANCE_OPTIONS.md) 참고)

---

### 4. **PostgreSQL 서비스** (Postgres)

Railway가 자동으로 제공하는 환경 변수:
- `DATABASE_URL` 또는 `POSTGRES_URL`: 데이터베이스 연결 URL
- `POSTGRES_PRIVATE_URL`: 내부 네트워크용 URL (더 빠름)

**Backend 서비스에서 사용:**
- Backend 서비스의 Variables에 `DATABASE_URL`을 설정
- PostgreSQL 서비스의 Variables에서 URL 복사

---

## 🚀 배포 순서 및 설정 방법

### 1단계: PostgreSQL 데이터베이스 생성
1. Railway 프로젝트에서 "New" → "Database" → "Add PostgreSQL"
2. PostgreSQL 서비스의 **Variables** 탭에서 `DATABASE_URL` 복사
3. 이 URL을 나중에 Backend 서비스에 설정

### 2단계: KataGo 서비스 배포
1. "New Service" → "GitHub Repo" → 저장소 선택
2. 서비스 이름: `katago`
3. **Settings → Build:**
   - Builder: `DOCKERFILE`
   - Dockerfile Path: `Dockerfile.katago` (명시적으로 입력)
4. **Settings → Variables:** 위의 KataGo 환경 변수 모두 추가
5. **Settings → Networking:** Generate Domain 클릭하여 URL 확인
6. 생성된 URL을 메모장에 저장 (예: `https://katago-production-xxxx.up.railway.app`)

### 3단계: Backend 서비스 배포
1. "New Service" → "GitHub Repo" → 같은 저장소 선택
2. 서비스 이름: `backend` 또는 `SUDAM backend`
3. **Settings → Build:**
   - Builder: `DOCKERFILE`
   - Dockerfile Path: `Dockerfile.backend` (명시적으로 입력)
4. **Settings → Variables:**
   - 필수 변수들 추가:
     - `NODE_ENV=production`
     - `PORT=4000`
     - `ENABLE_FRONTEND_SERVING=false`
     - `DATABASE_URL` (PostgreSQL 서비스에서 복사)
     - `KATAGO_API_URL` (KataGo 서비스 URL)
     - `FRONTEND_URL` (나중에 Frontend URL로 업데이트)
   - 선택적 변수들 추가 (이메일, 카카오 로그인 등)
5. **Settings → Networking:** Generate Domain 클릭하여 URL 확인
6. 생성된 URL을 메모장에 저장 (예: `https://backend-production-xxxx.up.railway.app`)

### 4단계: Frontend 서비스 배포
1. "New Service" → "GitHub Repo" → 같은 저장소 선택
2. 서비스 이름: `frontend` 또는 `SUDAM frontend`
3. **Settings → Build:**
   - Builder: `DOCKERFILE`
   - Dockerfile Path: `Dockerfile.frontend` (명시적으로 입력) ⚠️ **중요**
4. **Settings → Variables:**
   - `VITE_API_URL` (Backend 서비스 URL)
   - `VITE_WS_URL` (Backend 서비스 WebSocket URL, `wss://` 사용)
5. **Settings → Networking:** Generate Domain 클릭하여 URL 확인
6. Frontend URL을 Backend 서비스의 `FRONTEND_URL`에 업데이트

### 5단계: 환경 변수 업데이트
1. Frontend 서비스 URL 확인 후
2. Backend 서비스 → Variables → `FRONTEND_URL` 업데이트
3. Backend 서비스 → Variables → `KAKAO_REDIRECT_URI` 업데이트 (카카오 로그인 사용 시)

---

## ⚠️ 중요 사항

### Dockerfile Path 설정
각 서비스 생성 시 **반드시** Settings → Build에서 Dockerfile Path를 명시적으로 입력:
- Frontend: `Dockerfile.frontend`
- Backend: `Dockerfile.backend`
- KataGo: `Dockerfile.katago`

### DATABASE_URL 형식
- ✅ 올바른 형식: `postgresql://postgres:PASSWORD@HOST:PORT/DATABASE`
- ❌ 잘못된 형식: `postgres-production-xxx.up.railway.app:5432/railway` (프로토콜 누락)

### URL 프로토콜
- HTTP API: `https://`
- WebSocket: `wss://` (HTTPS 환경)
- Railway는 기본적으로 HTTPS를 사용하므로 `wss://` 사용

### 환경 변수 대소문자
- 환경 변수 이름은 대소문자를 구분합니다
- 정확히 위의 형식대로 입력하세요

---

## 📝 체크리스트

### Frontend 서비스
- [ ] Dockerfile Path: `Dockerfile.frontend` 설정
- [ ] `VITE_API_URL` 설정 (Backend URL)
- [ ] `VITE_WS_URL` 설정 (Backend WebSocket URL, `wss://`)

### Backend 서비스
- [ ] Dockerfile Path: `Dockerfile.backend` 설정
- [ ] `ENABLE_FRONTEND_SERVING=false` 설정
- [ ] `DATABASE_URL` 설정 (PostgreSQL URL)
- [ ] `KATAGO_API_URL` 설정 (KataGo URL)
- [ ] `FRONTEND_URL` 설정 (Frontend URL)
- [ ] `PORT=4000` 설정
- [ ] 기타 선택적 변수들 (이메일, 카카오 등)

### KataGo 서비스
- [ ] Dockerfile Path: `Dockerfile.katago` 설정
- [ ] 모든 KataGo 관련 환경 변수 설정
- [ ] `PORT=4001` 설정

### PostgreSQL 서비스
- [ ] 서비스 생성 완료
- [ ] `DATABASE_URL` 확인 및 복사

---

## 🔍 문제 해결

### Dockerfile이 자동으로 변경되는 경우
1. 각 서비스의 Settings → Build로 이동
2. Dockerfile Path를 명시적으로 입력
3. 저장 후 재배포 확인

### 환경 변수가 적용되지 않는 경우
1. Variables 탭에서 변수 이름과 값 확인
2. 대소문자 정확히 입력했는지 확인
3. 저장 후 자동 재배포 확인

### 서비스 간 연결이 안 되는 경우
1. 각 서비스의 공개 URL이 생성되었는지 확인
2. URL에 프로토콜(`https://`, `wss://`) 포함 확인
3. CORS 설정 확인 (Backend)

