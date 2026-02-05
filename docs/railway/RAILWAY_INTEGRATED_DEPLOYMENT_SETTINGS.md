# Railway 통합 배포 설정 가이드

## 개요
프론트엔드와 백엔드를 하나의 서비스로 통합 배포하는 설정입니다.

---

## 1. Railway Dashboard 설정

### 1.1 서비스 구조
- **Backend 서비스**: 프론트엔드와 백엔드 통합 서비스
- **KataGo 서비스**: 별도 서비스 (선택사항)

### 1.2 Backend 서비스 설정

#### Settings → Build

1. **Builder**
   - 선택: `DOCKERFILE`

2. **Dockerfile Path**
   - 입력: `Dockerfile.backend`
   - ⚠️ 정확히 `Dockerfile.backend` 입력 (대소문자 구분)

3. **Build Command**
   - 비워두기 (Dockerfile의 빌드 단계 사용)

#### Settings → Deploy

1. **Start Command**
   - 입력: `npm run start-server`
   - 또는 비워두기 (Dockerfile의 CMD 사용)

2. **Restart Policy**
   - 선택: `NEVER` 또는 `ON_FAILURE`
   - ⚠️ `ON_FAILURE`로 설정 시 재시도 횟수: `10` (또는 원하는 값)

3. **Healthcheck**
   - **Path**: `/api/health`
   - **Timeout**: `60` (초)
   - **Interval**: `60` (초)

4. **Serverless**
   - 토글: `OFF` (꺼짐)

#### Settings → Variables (환경 변수)

**필수 환경 변수:**

```bash
# 데이터베이스
DATABASE_URL=postgresql://user:password@host:port/database

# 프론트엔드 서빙 활성화 (통합 배포)
ENABLE_FRONTEND_SERVING=true

# 포트 (Railway가 자동 설정하지만 명시 가능)
PORT=4000

# CORS 설정 (프론트엔드 URL)
FRONTEND_URL=https://your-service.up.railway.app

# KataGo API (별도 서비스 사용 시)
KATAGO_API_URL=https://your-katago-service.up.railway.app/api/katago/analyze

# GnuGo API (AI봇 대전에서 사용)
GNUGO_API_URL=https://your-gnugo-service.up.railway.app/api/gnugo/move

# Railway 환경 감지
RAILWAY_ENVIRONMENT=true
```

**선택적 환경 변수:**

```bash
# 이메일 인증 (선택)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 카카오 로그인 (선택)
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
KAKAO_REDIRECT_URI=https://your-service.up.railway.app/api/auth/kakao/callback

```

---

## 2. Railway CLI로 설정하기

### 2.1 환경 변수 설정

```bash
# Railway 로그인
railway login

# 프로젝트 선택
railway link

# Backend 서비스 선택
railway service

# 환경 변수 설정
railway variables set ENABLE_FRONTEND_SERVING=true
railway variables set RAILWAY_ENVIRONMENT=true
railway variables set FRONTEND_URL=https://your-service.up.railway.app

# KataGo API URL 설정 (별도 서비스 사용 시)
railway variables set KATAGO_API_URL=https://your-katago-service.up.railway.app/api/katago/analyze

# GnuGo API URL 설정 (AI봇 대전에서 사용)
railway variables set GNUGO_API_URL=https://your-gnugo-service.up.railway.app/api/gnugo/move
```

### 2.2 railway.json 설정

프로젝트 루트에 `railway.json` 파일 생성 (또는 기존 파일 수정):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.backend"
  },
  "deploy": {
    "startCommand": "npm run start-server",
    "restartPolicyType": "ON_FAILURE",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 60,
    "healthcheckInterval": 60
  }
}
```

---

## 3. 배포 확인

### 3.1 배포 로그 확인

Railway Dashboard → Deployments → 최신 배포 → Logs

**확인할 로그:**
```
[Server] Starting server...
[Server] Server listening on port 4000
[Server] Health check endpoint is available at /api/health
[Server] Frontend serving is enabled
```

### 3.2 헬스체크 확인

```bash
curl https://your-service.up.railway.app/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "listening": true,
  "ready": true,
  "database": "connected",
  "pid": 1
}
```

### 3.3 프론트엔드 접속 확인

브라우저에서 접속:
```
https://your-service.up.railway.app
```

---

## 4. 문제 해결

### 4.1 헬스체크 실패

**증상:**
- 배포는 성공하지만 헬스체크 실패
- 서비스가 계속 재시작됨

**해결:**
1. Settings → Deploy → Healthcheck Path 확인: `/api/health`
2. Settings → Deploy → Healthcheck Timeout 확인: `60`
3. 서버 로그에서 `/api/health` 엔드포인트가 정상 작동하는지 확인

### 4.2 프론트엔드가 표시되지 않음

**증상:**
- 백엔드 API는 작동하지만 프론트엔드가 표시되지 않음

**해결:**
1. 환경 변수 확인: `ENABLE_FRONTEND_SERVING=true`
2. 서버 로그 확인: `[Server] Frontend serving is enabled`
3. `dist` 디렉토리가 빌드되었는지 확인 (배포 로그에서 확인)

### 4.3 빌드 실패

**증상:**
- Vite 빌드 실패
- 메모리 부족 오류

**해결:**
1. Dockerfile에서 `NODE_OPTIONS="--max-old-space-size=4096"` 확인
2. Railway 리소스 확인 (메모리 할당량)
3. 빌드 로그에서 구체적인 오류 메시지 확인

---

## 5. 설정 체크리스트

배포 전 확인사항:

- [ ] `Dockerfile.backend`가 프론트엔드 빌드를 포함하는지 확인
- [ ] Settings → Build → Dockerfile Path: `Dockerfile.backend`
- [ ] Settings → Deploy → Start Command: `npm run start-server` (또는 비워두기)
- [ ] Settings → Deploy → Healthcheck Path: `/api/health`
- [ ] Settings → Deploy → Healthcheck Timeout: `60`
- [ ] Settings → Deploy → Restart Policy: `NEVER` 또는 `ON_FAILURE`
- [ ] Settings → Variables → `ENABLE_FRONTEND_SERVING=true`
- [ ] Settings → Variables → `DATABASE_URL` 설정됨
- [ ] Settings → Variables → `FRONTEND_URL` 설정됨 (선택사항)
- [ ] Settings → Variables → `RAILWAY_ENVIRONMENT=true` (선택사항)
- [ ] 배포 후 `/api/health` 엔드포인트 테스트
- [ ] 배포 후 프론트엔드 접속 테스트

---

## 6. 통합 배포 vs 분리 배포

### 통합 배포 (현재 설정)
- ✅ 하나의 서비스로 관리
- ✅ CORS 설정 간단
- ✅ 배포 간단
- ❌ 프론트엔드와 백엔드가 함께 재시작됨

### 분리 배포
- ✅ 프론트엔드와 백엔드 독립적 배포
- ✅ 스케일링 유연성
- ❌ 두 개의 서비스 관리 필요
- ❌ CORS 설정 필요

---

## 7. 추가 리소스

- [Railway 공식 문서](https://docs.railway.app)
- [Dockerfile 최적화 가이드](./RAILWAY_DOCKERFILE_SETUP.md)
- [환경 변수 가이드](./RAILWAY_ENV_VARIABLES_GUIDE.md)

