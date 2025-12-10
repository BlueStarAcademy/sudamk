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

**방법 A: railway.json 파일 사용 (권장)**

1. 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택 → 저장소: `BlueStarAcademy/sudamk` 선택
3. 서비스 이름: `frontend` (또는 원하는 이름)
4. Railway가 자동으로 `railway.json.frontend` 파일을 인식합니다
   - 만약 인식되지 않으면, 서비스 생성 후 `railway.json.frontend` 파일을 `railway.json`으로 이름 변경하거나
   - Settings → Deploy → Source에서 "railway.json" 선택
5. Settings → Variables:
   ```
   VITE_API_URL=https://your-backend-service.railway.app
   VITE_WS_URL=wss://your-backend-service.railway.app
   ```
   (백엔드 서비스 URL은 백엔드 배포 후 설정)

**방법 B: Railway UI에서 직접 설정 (Dockerfile 자동 변경 문제 해결)**

⚠️ **중요**: Railway가 여러 서비스에서 같은 저장소를 사용할 때, 자동으로 `Dockerfile.backend`를 선택하는 문제가 발생할 수 있습니다. 다음 단계를 따라 명시적으로 설정하세요:

1. 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택 → 저장소: `BlueStarAcademy/sudamk` 선택
3. 서비스 이름: `frontend` (또는 원하는 이름)
4. **Settings → Build 섹션으로 이동:**
   - **Builder**: `DOCKERFILE` 선택
   - **Dockerfile Path**: `Dockerfile.frontend` 입력 (반드시 명시적으로 입력)
   - **저장** 클릭
5. **Settings → Deploy 섹션:**
   - **Start Command**: 비워두기 (Dockerfile의 CMD 사용)
   - 또는 `serve -s dist -l $PORT` (Dockerfile과 동일하게)
6. **Settings → Variables:**
   ```
   VITE_API_URL=https://your-backend-service.railway.app
   VITE_WS_URL=wss://your-backend-service.railway.app
   ```
   (백엔드 서비스 URL은 백엔드 배포 후 설정)

**Dockerfile이 자동으로 변경되는 문제 해결 방법:**

1. **Railway Dashboard에서 명시적으로 설정:**
   - Frontend 서비스 선택 → **Settings** → **Build** 섹션
   - **Dockerfile Path** 필드에 `Dockerfile.frontend` 입력
   - **저장** 클릭
   - 재배포 확인

2. **railway.json 파일 사용 (권장):**
   - 각 서비스별로 올바른 `railway.json` 파일이 사용되도록 확인
   - Frontend 서비스: `railway.json.frontend` 파일이 인식되도록 설정
   - 또는 서비스별로 별도의 브랜치/디렉토리 사용

3. **서비스별로 별도 저장소 사용 (최후의 수단):**
   - 각 서비스를 별도의 Git 저장소로 분리
   - 각 저장소에 해당하는 Dockerfile만 포함

#### 3단계: Backend 서비스 배포

1. 같은 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택 → 같은 저장소 `BlueStarAcademy/sudamk` 선택
3. 서비스 이름: `backend` (또는 원하는 이름)
4. **Settings → Build 섹션으로 이동:**
   - **Builder**: `DOCKERFILE` 선택
   - **Dockerfile Path**: `Dockerfile.backend` 입력 (반드시 명시적으로 입력)
   - **저장** 클릭
5. **Settings → Deploy 섹션:**
   - **Start Command**: 비워두기 (Dockerfile의 CMD 사용)
   - 또는 `node node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json server/server.ts`
6. Settings → Variables:
   ```
   ENABLE_FRONTEND_SERVING=false
   KATAGO_API_URL=https://your-katago-service.railway.app
   DATABASE_URL=<your-database-url>
   PORT=4000
   ```
   (기존 환경 변수들도 모두 설정)

#### 4단계: KataGo 서비스 배포

1. 같은 프로젝트 내에서 "New Service" 클릭
2. "GitHub Repo" 선택 → 같은 저장소 `BlueStarAcademy/sudamk` 선택
3. 서비스 이름: `katago` (또는 원하는 이름)
4. **Settings → Build 섹션으로 이동:**
   - **Builder**: `DOCKERFILE` 선택
   - **Dockerfile Path**: `Dockerfile.katago` 입력 (반드시 명시적으로 입력)
   - **저장** 클릭
5. **Settings → Deploy 섹션:**
   - **Start Command**: 비워두기 (Dockerfile의 CMD 사용)
   - 또는 `node node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json server/katagoServer.ts`
6. Settings → Variables:
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

**1단계: 각 서비스의 공개 URL 확인**

각 서비스의 Settings에서 공개 URL을 생성하고 확인합니다:

**Backend 서비스 URL 확인:**
1. Backend 서비스 선택
2. **Settings** 탭 클릭
3. **Networking** 섹션으로 스크롤
4. **Generate Domain** 버튼 클릭 (또는 **Public Domain** 섹션)
5. 생성된 URL 복사 (예: `https://backend-production-xxxx.up.railway.app`)
6. 이 URL을 메모장에 저장

**KataGo 서비스 URL 확인:**
1. KataGo 서비스 선택
2. **Settings** → **Networking**
3. **Generate Domain** 버튼 클릭
4. 생성된 URL 복사 (예: `https://katago-production-xxxx.up.railway.app`)
5. 이 URL을 메모장에 저장

**Frontend 서비스 URL 확인:**
1. Frontend 서비스 선택
2. **Settings** → **Networking**
3. **Generate Domain** 버튼 클릭
4. 생성된 URL 복사 (예: `https://frontend-production-xxxx.up.railway.app`)

**2단계: 환경 변수 설정 방법**

**Frontend 서비스 환경 변수 설정:**

1. Frontend 서비스 선택
2. **Settings** 탭 클릭
3. **Variables** 섹션으로 스크롤 (또는 **Environment Variables** 탭)
4. **New Variable** 또는 **+ Add Variable** 버튼 클릭
5. 다음 변수들을 추가:

   **변수 1:**
   - **Name (Key)**: `VITE_API_URL`
   - **Value**: Backend 서비스의 URL (예: `https://backend-production-xxxx.up.railway.app`)
   - **Add** 또는 **Save** 클릭

   **변수 2:**
   - **Name (Key)**: `VITE_WS_URL`
   - **Value**: Backend 서비스의 WebSocket URL
     - HTTP인 경우: `ws://backend-production-xxxx.up.railway.app`
     - HTTPS인 경우: `wss://backend-production-xxxx.up.railway.app`
     - (Railway는 기본적으로 HTTPS이므로 `wss://` 사용)
   - **Add** 또는 **Save** 클릭

**Backend 서비스 환경 변수 설정:**

1. Backend 서비스 선택
2. **Settings** → **Variables**
3. **New Variable** 클릭
4. 다음 변수 추가:

   **변수 1:**
   - **Name**: `ENABLE_FRONTEND_SERVING`
   - **Value**: `false`
   - **Add** 클릭

   **변수 2:**
   - **Name**: `KATAGO_API_URL`
   - **Value**: KataGo 서비스의 URL (예: `https://katago-production-xxxx.up.railway.app`)
   - **Add** 클릭

**변수 3 (중요):**
   - **Name**: `DATABASE_URL`
   - **Value**: PostgreSQL 데이터베이스 연결 URL
   - **⚠️ 중요**: DATABASE_URL은 반드시 `postgresql://` 또는 `postgres://`로 시작해야 합니다!
   - **⚠️ 절대 하지 말아야 할 것**: Postgres 서비스의 Variables에서 `DATABASE_URL`을 직접 수정하지 마세요! Postgres 서비스의 Variables는 Railway가 자동으로 관리합니다.
   - **설정 방법**:
     1. **Postgres 서비스의 Variables는 건드리지 마세요!**
     2. **Backend 서비스** → **Variables** 탭으로 이동
     3. `DATABASE_URL` 변수 찾기 (없으면 "+ New Variable" 클릭)
     4. **내부 네트워크 URL 사용 (권장)**:
        - Value: `postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway`
        - PASSWORD는 Postgres 서비스의 Variables에서 `POSTGRES_PASSWORD` 또는 `PGPASSWORD` 확인
        - 호스트는 반드시 `postgres.railway.internal` 사용
     5. **또는 Variable Reference 사용**:
        - "+ New Variable" → "Add Variable Reference" 클릭
        - Postgres 서비스 선택 → `DATABASE_URL` 선택
        - Railway가 자동으로 연결해주지만, 내부 네트워크를 사용하려면 직접 설정하는 것이 더 확실합니다
     6. **Save** 클릭
   - **Add** 클릭

5. 기존 환경 변수들도 확인:
   - `PORT=4000`
   - 기타 필요한 환경 변수들 (JWT_SECRET, EMAIL 설정 등)

**KataGo 서비스 환경 변수 설정:**

1. KataGo 서비스 선택
2. **Settings** → **Variables**
3. 다음 변수들을 추가:

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

   각 변수를 하나씩 추가:
   - **Name**: `PORT`, **Value**: `4001` → **Add**
   - **Name**: `KATAGO_PATH`, **Value**: `/app/katago/katago` → **Add**
   - (나머지 변수들도 동일하게 추가)

**3단계: 환경 변수 설정 확인**

각 서비스의 **Variables** 섹션에서 다음을 확인:
- ✅ Frontend: `VITE_API_URL`, `VITE_WS_URL` 설정됨
- ✅ Backend: `ENABLE_FRONTEND_SERVING=false`, `KATAGO_API_URL` 설정됨
- ✅ KataGo: 모든 KataGo 관련 변수 설정됨

**4단계: 자동 재배포**

Railway는 환경 변수를 변경하면 자동으로 서비스를 재배포합니다.
- 각 서비스의 **Deployments** 탭에서 배포 상태 확인
- 배포가 완료되면 각 서비스가 새로운 환경 변수로 실행됩니다

**참고:**
- 환경 변수는 대소문자를 구분합니다 (정확히 입력)
- URL에는 프로토콜(`https://` 또는 `wss://`)을 포함해야 합니다
- WebSocket URL은 HTTP는 `ws://`, HTTPS는 `wss://`를 사용합니다

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

### DATABASE_URL 오류 (프로토콜 누락)

**에러 메시지:**
```
error: Error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`.
```

**해결 방법:**

1. **Railway에서 DATABASE_URL 확인:**
   - Backend 서비스 → **Settings** → **Variables**
   - `DATABASE_URL` 변수가 있는지 확인
   - 값이 `postgresql://` 또는 `postgres://`로 시작하는지 확인

2. **DATABASE_URL이 없거나 잘못된 경우:**
   - Railway 프로젝트에서 **PostgreSQL 서비스** 선택
   - **Variables** 탭에서 `DATABASE_URL` 또는 `POSTGRES_URL` 복사
   - Backend 서비스의 **Variables**에 `DATABASE_URL`로 붙여넣기
   - **⚠️ 중요**: 전체 URL을 복사해야 합니다 (프로토콜 포함)
     - ✅ 올바른 형식: `postgresql://postgres:PASSWORD@HOST:PORT/DATABASE`
     - ❌ 잘못된 형식: `postgres-production-xxx.up.railway.app:5432/railway`

3. **Railway 자동 연결 사용:**
   - Postgres 서비스를 Backend 서비스와 같은 프로젝트에 배포
   - Railway가 자동으로 `DATABASE_URL` 환경 변수를 제공
   - Backend 서비스의 Variables에서 확인

4. **내부 네트워크 사용 (권장):**
   - Railway 내부 네트워크를 사용하면 더 빠르고 안정적입니다
   - 형식: `postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway`
   - **설정 방법:**
     
     **방법 A: Railway Dashboard에서 직접 설정 (가장 확실)**
     
     1. Railway Dashboard → **Postgres** 서비스 선택
     2. **Variables** 탭으로 이동
     3. `DATABASE_URL` 또는 `POSTGRES_PRIVATE_URL` 변수 찾기
     4. 값이 `postgres.railway.internal`을 포함하는지 확인
        - ✅ 올바른 형식: `postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway`
        - ❌ 잘못된 형식: `postgresql://postgres:PASSWORD@postgres-production-xxx.up.railway.app:5432/railway`
     5. 만약 외부 URL(`.up.railway.app`)을 사용 중이라면:
        - Backend 서비스 → **Variables** 탭으로 이동
        - `DATABASE_URL` 변수 찾기
        - **Edit** 클릭
        - 호스트 부분을 `postgres.railway.internal`로 변경
        - 예: `postgres-production-xxx.up.railway.app` → `postgres.railway.internal`
        - **Save** 클릭
     6. Railway가 자동으로 재배포합니다
     
     **방법 B: Railway CLI 사용**
     
     ```powershell
     # Railway CLI로 로그인 (필요시)
     railway login
     
     # 프로젝트 연결
     railway link
     
     # Backend 서비스 선택
     railway service
     # 목록에서 backend 서비스 선택
     
     # 현재 DATABASE_URL 확인
     railway variables | findstr DATABASE_URL
     
     # 내부 네트워크로 변경 (비밀번호는 실제 값으로 교체)
     railway variables --set "DATABASE_URL=postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway"
     ```
     
     **방법 C: Postgres 서비스의 Variables 사용**
     
     - Postgres 서비스의 Variables에서 `POSTGRES_PRIVATE_URL` 또는 내부 네트워크 URL 복사
     - Backend 서비스의 Variables에 `DATABASE_URL`로 설정
     
   - **확인 방법:**
     - 서버 재시작 후 로그에서 다음 메시지 확인:
       ```
       [Prisma] Converted Railway public URL to internal network: postgresql://postgres:****@postgres.railway.internal:5432/railway
       ```
     - 또는 경고 메시지가 사라졌는지 확인:
       ```
       [Server Startup] WARNING: DATABASE_URL is not using Railway internal network.
       ```
       이 메시지가 더 이상 나타나지 않으면 성공입니다.

### Frontend가 Backend에 연결되지 않는 경우
- `VITE_API_URL`과 `VITE_WS_URL`이 올바른지 확인
- CORS 설정 확인 (Backend의 `corsOptions`)

### Backend가 KataGo에 연결되지 않는 경우
- `KATAGO_API_URL`이 올바른지 확인
- KataGo 서비스가 정상 실행 중인지 확인 (`/api/health`)

### 빌드 실패
- 각 서비스의 Dockerfile 경로가 올바른지 확인
- 빌드 로그 확인 (Railway 대시보드 → Deployments → View Logs)

### 헬스체크 실패 문제

**증상:**
```
Healthcheck failed!
1/1 replicas never became healthy!
```

**원인:**
- 서버가 시작되는 데 시간이 오래 걸림
- 헬스체크 경로가 잘못 설정됨
- 서버가 실제로 시작되지 않음

**해결 방법:**

**방법 1: 헬스체크 경로 변경**
1. Backend 서비스 → **Settings** → **Health**
2. **Health Check Path**를 `/`로 변경
3. 재배포

**방법 2: 헬스체크 비활성화 (임시)**
1. Backend 서비스 → **Settings** → **Health**
2. **Health Check Path**를 비워두기
3. 재배포

**방법 3: 헬스체크 타임아웃 증가**
1. Backend 서비스 → **Settings** → **Health**
2. **Health Check Timeout**을 더 길게 설정 (예: 10분)
3. 재배포

**방법 4: 서버 로그 확인**
- Backend 서비스 → **Logs** 탭에서 서버 시작 메시지 확인
- 다음 메시지가 보이면 서버는 정상:
  ```
  [Server] Server listening on port 4000
  [Server] Server is ready and accepting connections
  ```
- 서버가 정상이면 헬스체크 설정 문제일 수 있으므로 방법 1-3 시도

### 로그인 실패 문제

**증상:**
- 로그인 시도 시 에러 발생
- "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" 에러

**원인:**
- Frontend가 Backend API를 찾지 못함
- `VITE_API_URL` 환경 변수가 설정되지 않음

**해결 방법:**
1. Frontend 서비스 → **Variables** 탭
2. `VITE_API_URL` 확인:
   - 없으면 추가: `https://your-backend-service.railway.app`
   - 있으면 Backend 서비스 URL이 올바른지 확인
3. Frontend 서비스 재배포
4. 브라우저 캐시 삭제 후 다시 시도

## 참고사항

- Railway는 같은 프로젝트 내 서비스 간 내부 네트워크를 제공합니다
- 내부 네트워크를 사용하려면 서비스 이름을 사용할 수 있습니다 (예: `http://backend:4000`)
- 하지만 공개 URL을 사용하는 것이 더 안정적입니다

