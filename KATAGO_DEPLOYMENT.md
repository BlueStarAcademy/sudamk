# KataGo 배포 설정 가이드

## KataGo 서비스 개요

KataGo는 바둑 AI 엔진으로, 별도의 서비스로 배포됩니다. Backend 서비스에서 HTTP API를 통해 KataGo 서비스에 접근합니다.

## Railway 배포 설정

### 1. KataGo 서비스 생성

1. Railway 대시보드 → 프로젝트 선택
2. "+ New" → "GitHub Repo" 선택
3. 같은 저장소 선택
4. 서비스 이름: `KataGo` 또는 `sudam-katago`

### 2. 빌더 설정

**방법 1: Dockerfile 사용 (권장)**

프로젝트 루트에 `Dockerfile.katago` 파일이 있습니다.

1. **Settings** → **Build** 탭
2. **Builder**: "Dockerfile" 선택 (자동 감지될 수 있음)
3. **Dockerfile Path**: `Dockerfile.katago` 입력
   - 또는 Railway가 자동으로 감지할 수도 있습니다

**방법 2: railway.json 사용**

프로젝트에 `apps/katago/railway.json` 파일이 있습니다.

1. **Settings** → **Source** 탭
2. **Root Directory**: `/` (프로젝트 루트) 또는 `/apps/katago`
3. Railway가 `railway.json` 파일을 자동으로 인식합니다

**방법 3: Nixpacks 사용 (Dockerfile이 없는 경우)**

1. **Settings** → **Build** 탭
2. **Builder**: "Nixpacks" 선택
3. **Build Command** 수동 설정:
   ```
   npm install
   ```
4. **Start Command**:
   ```
   npm run start-katago
   ```

### 3. 환경 변수 설정

KataGo 서비스에 필요한 환경 변수:

```env
NODE_ENV=production
PORT=4001
KATAGO_PATH=/app/katago/katago
KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
KATAGO_HOME_PATH=/app/katago_home
KATAGO_NUM_ANALYSIS_THREADS=2
KATAGO_NUM_SEARCH_THREADS=4
KATAGO_MAX_VISITS=1000
ALLOWED_ORIGINS=<Backend 서비스 URL>
```

**설명**:
- `PORT`: KataGo 서버 포트 (기본: 4001)
- `KATAGO_PATH`: KataGo 바이너리 경로 (Dockerfile에서 설정)
- `KATAGO_MODEL_PATH`: KataGo 모델 파일 경로 (Dockerfile에서 다운로드)
- `KATAGO_HOME_PATH`: KataGo 홈 디렉토리
- `KATAGO_NUM_ANALYSIS_THREADS`: 분석 스레드 수
- `KATAGO_NUM_SEARCH_THREADS`: 검색 스레드 수
- `KATAGO_MAX_VISITS`: 최대 방문 수
- `ALLOWED_ORIGINS`: Backend 서비스 URL (CORS 설정)

### 4. Backend 서비스 환경 변수 추가

Backend 서비스에서 KataGo 서비스에 접근하려면:

```env
KATAGO_API_URL=<KataGo 서비스 URL>
```

**KataGo 서비스 URL 찾기**:
- KataGo 서비스 → Settings → Networking → Public Domain
- 예: `https://katago.up.railway.app`

### 5. Health Check 설정

Railway에서 자동으로 Health Check를 수행합니다:

- **Health Check Path**: `/api/health`
- **Timeout**: 60초
- **Interval**: 60초

## Dockerfile

프로젝트 루트에 `Dockerfile.katago` 파일이 있습니다. 이 파일은:
- KataGo Linux 바이너리 다운로드
- KataGo 모델 파일 다운로드
- Node.js 서버 설정
- 필요한 의존성 설치

Railway에서 Dockerfile 빌더를 사용하면 자동으로 이 파일을 사용합니다.

### Dockerfile 내용 요약:

```dockerfile
# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install build dependencies
RUN apk add --no-cache python3 make g++ wget unzip

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build-deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

FROM build-deps AS build
COPY package.json package-lock.json ./
COPY server ./server
COPY shared ./shared
COPY types ./types
COPY tsconfig.base.json ./

# Download KataGo binary and model
RUN mkdir -p /app/katago && \
    cd /tmp && \
    wget https://github.com/lightvector/KataGo/releases/download/v1.16.4/katago-v1.16.4-eigenavx2-linux-x64.zip -O katago.zip && \
    unzip -q katago.zip && \
    find . -name "katago" -type f -exec cp {} /app/katago/katago \; && \
    chmod +x /app/katago/katago && \
    cd /app/katago && \
    wget https://media.katagotraining.org/uploaded/models/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz

FROM base AS runner
WORKDIR /app
ENV PORT=4001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/types ./types
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/katago ./katago

EXPOSE 4001

CMD ["npm", "run", "start-katago"]
```

## railway.json 설정 (Nixpacks 사용 시)

프로젝트 루트 또는 KataGo 서비스 디렉토리에 `railway.json` 파일 생성:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm run start-katago",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 60,
    "healthcheckInterval": 60
  }
}
```

## 배포 체크리스트

### KataGo 서비스
- [ ] 서비스 생성 완료
- [ ] Builder 설정 (Dockerfile 또는 Nixpacks)
- [ ] 환경 변수 설정 완료
- [ ] Health Check 경로 설정 (`/api/health`)
- [ ] 배포 성공 확인

### Backend 서비스
- [ ] `KATAGO_API_URL` 환경 변수 설정
- [ ] KataGo 서비스 URL 연결 확인

## 확인 방법

### 1. KataGo 서비스 Health Check

```bash
curl https://your-katago.railway.app/api/health
```

**예상 응답**:
```json
{
  "status": "ok",
  "service": "katago",
  "katagoRunning": true,
  "timestamp": "..."
}
```

### 2. KataGo 상태 확인

```bash
curl https://your-katago.railway.app/api/katago/status
```

### 3. Backend에서 KataGo 연결 테스트

Backend 서비스 로그에서 KataGo 연결 상태 확인

## 트러블슈팅

### KataGo 초기화 실패

**문제**: KataGo가 시작되지 않음
- **해결**: 
  1. 환경 변수 확인 (`KATAGO_PATH`, `KATAGO_MODEL_PATH`)
  2. 로그에서 에러 메시지 확인
  3. KataGo 바이너리 및 모델 파일 다운로드 확인

### Backend에서 KataGo 연결 실패

**문제**: Backend가 KataGo 서비스에 연결할 수 없음
- **해결**:
  1. `KATAGO_API_URL` 환경 변수 확인
  2. CORS 설정 확인 (`ALLOWED_ORIGINS`)
  3. 네트워크 연결 확인

### Health Check 실패

**문제**: Health Check가 실패함
- **해결**:
  1. `/api/health` 엔드포인트가 정상 작동하는지 확인
  2. Timeout 설정 확인 (KataGo 초기화에 시간이 걸릴 수 있음)
  3. 서비스가 실행 중인지 확인

## 리소스 요구사항

KataGo는 CPU 집약적 작업을 수행하므로:

- **권장 CPU**: 2 코어 이상
- **권장 메모리**: 2GB 이상
- **디스크**: KataGo 모델 파일 (~500MB)

Railway에서 적절한 리소스를 할당하세요.

## 참고사항

- KataGo 초기화에는 시간이 걸릴 수 있습니다 (1-2분)
- Health Check는 서버가 시작되었는지만 확인하므로, KataGo 초기화 중에도 통과할 수 있습니다
- KataGo는 선택적 서비스입니다. 없어도 게임은 작동하지만, AI 분석 기능은 사용할 수 없습니다

---

**마지막 업데이트**: 2024-12-19

