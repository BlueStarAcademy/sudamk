# 다음 단계 가이드

이 문서는 GnuGo 통합 완료 후 해야 할 일들을 정리한 가이드입니다.

## ✅ 완료된 작업

1. **GnuGo 서버 구현** (`server/gnugoServer.ts`)
2. **GnuGo 서비스 구현** (`server/gnugoService.ts`)
3. **GnuGo Dockerfile** (`Dockerfile.gnugo`)
4. **Railway 설정** (`railway.json.gnugo`)
5. **AI 플레이어 통합** (`server/goAiBot.ts` - GnuGo 메인, goAiBot fallback)

---

## 📋 다음 단계

### 1. 로컬 테스트 (선택사항)

로컬 환경에서 GnuGo가 제대로 작동하는지 확인합니다.

```bash
# GnuGo 서버 시작 (별도 터미널)
npm run start-gnugo

# 또는 직접 실행
PORT=4002 node node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json server/gnugoServer.ts
```

**확인 사항:**
- GnuGo 서버가 정상적으로 시작되는지
- `/api/health` 엔드포인트가 정상 응답하는지
- `/api/gnugo/status` 엔드포인트가 GnuGo 상태를 반환하는지

---

### 2. Railway 배포 준비

#### 2.1 Git 커밋 및 푸시

```bash
# 변경사항 확인
git status

# 변경사항 커밋
git add .
git commit -m "feat: GnuGo 서버 및 AI 통합 구현"

# 원격 저장소에 푸시
git push origin main
```

#### 2.2 Railway 프로젝트 구조 확인

Railway에 다음 4개의 서비스를 배포해야 합니다:

1. **SUDAM (Backend + Frontend 통합)**
   - Dockerfile: `Dockerfile.backend`
   - Railway config: `railway.json.backend` (또는 `railway.json.root.backend`)
   - Port: `4000` (Railway가 자동 할당)

2. **KataGo 서비스**
   - Dockerfile: `Dockerfile.katago`
   - Railway config: `railway.json.katago`
   - Port: `4001`

3. **GnuGo 서비스** ⭐ (새로 추가)
   - Dockerfile: `Dockerfile.gnugo`
   - Railway config: `railway.json.gnugo`
   - Port: `4002`

4. **PostgreSQL 데이터베이스**
   - Railway에서 제공하는 PostgreSQL 서비스
   - 또는 외부 PostgreSQL (Supabase 등)

---

### 3. Railway 배포 단계

#### 3.1 PostgreSQL 데이터베이스 설정

1. Railway 대시보드 → 프로젝트 → "New" → "Database" → "Add PostgreSQL"
2. 생성된 PostgreSQL 서비스의 "Variables" 탭에서 `DATABASE_URL` 복사
3. 이 URL을 Backend 서비스의 환경 변수로 설정

#### 3.2 Backend 서비스 (SUDAM) 배포

1. Railway 대시보드 → "New" → "GitHub Repo" (또는 "Empty Service")
2. 저장소 연결
3. **Settings → Build:**
   - Builder: `DOCKERFILE`
   - Dockerfile Path: `Dockerfile.backend`
4. **Settings → Deploy:**
   - Start Command: `npm run start-server` (또는 Dockerfile CMD 사용)
   - Restart Policy: `ON_FAILURE`
5. **Settings → Variables:**
   - 환경 변수 설정 (아래 참고)

#### 3.3 KataGo 서비스 배포

1. Railway 대시보드 → "New" → "GitHub Repo"
2. 같은 저장소 선택
3. **Settings → Build:**
   - Builder: `DOCKERFILE`
   - Dockerfile Path: `Dockerfile.katago`
4. **Settings → Deploy:**
   - Start Command: `node node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json server/katagoServer.ts`
5. **Settings → Variables:**
   - `PORT=4001`

#### 3.4 GnuGo 서비스 배포 ⭐ (새로 추가)

1. Railway 대시보드 → "New" → "GitHub Repo"
2. 같은 저장소 선택
3. **Settings → Build:**
   - Builder: `DOCKERFILE`
   - Dockerfile Path: `Dockerfile.gnugo`
4. **Settings → Deploy:**
   - Start Command: `node node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json server/gnugoServer.ts`
5. **Settings → Variables:**
   - `PORT=4002`
   - `GNUGO_LEVEL=10` (선택사항, 기본값: 10)

---

### 4. 환경 변수 설정

#### 4.1 Backend 서비스 (SUDAM) 환경 변수

**필수:**
```bash
DATABASE_URL=postgresql://postgres:password@postgres.railway.internal:5432/railway
NODE_ENV=production
ENABLE_FRONTEND_SERVING=true
FRONTEND_URL=https://your-backend-service.railway.app
KATAGO_API_URL=https://your-katago-service.railway.app
GNUGO_API_URL=https://your-gnugo-service.railway.app
```

**선택사항:**
```bash
# 이메일 서비스
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
EMAIL_FROM=noreply@yourdomain.com

# 또는 SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 카카오 로그인
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
KAKAO_REDIRECT_URI=https://your-backend-service.railway.app/api/auth/kakao/callback
```

#### 4.2 KataGo 서비스 환경 변수

```bash
PORT=4001
```

#### 4.3 GnuGo 서비스 환경 변수 ⭐ (새로 추가)

```bash
PORT=4002
GNUGO_LEVEL=10  # 선택사항 (1-10, 기본값: 10)
```

**참고:** GnuGo는 Alpine Linux의 패키지 관리자로 설치되므로 추가 경로 설정이 필요 없습니다.

---

### 5. 서비스 간 연결 확인

배포 후 각 서비스의 공개 URL을 확인하고, 환경 변수를 업데이트합니다.

1. **Backend 서비스 URL 확인:**
   - Railway 대시보드 → Backend 서비스 → Settings → Domains
   - 예: `https://sudam-backend-production.up.railway.app`

2. **KataGo 서비스 URL 확인:**
   - Railway 대시보드 → KataGo 서비스 → Settings → Domains
   - 예: `https://katago-production.up.railway.app`

3. **GnuGo 서비스 URL 확인:** ⭐
   - Railway 대시보드 → GnuGo 서비스 → Settings → Domains
   - 예: `https://gnugo-production.up.railway.app`

4. **Backend 서비스 환경 변수 업데이트:**
   - `KATAGO_API_URL` → KataGo 서비스 URL
   - `GNUGO_API_URL` → GnuGo 서비스 URL
   - `FRONTEND_URL` → Backend 서비스 URL (프론트엔드가 백엔드와 통합되어 있는 경우)

---

### 6. 배포 후 테스트

#### 6.1 Health Check

각 서비스의 health 엔드포인트를 확인합니다:

- **Backend**: `https://your-backend-service.railway.app/api/health`
- **KataGo**: `https://your-katago-service.railway.app/api/health`
- **GnuGo**: `https://your-gnugo-service.railway.app/api/health` ⭐

#### 6.2 GnuGo 상태 확인

```bash
# GnuGo 서비스 상태 확인
curl https://your-gnugo-service.railway.app/api/gnugo/status

# 예상 응답:
# {
#   "status": "running",
#   "processRunning": true,
#   "isStarting": false,
#   "config": {
#     "GNUGO_PATH": "gnugo",
#     "GNUGO_LEVEL": "10",
#     "PORT": 4002
#   }
# }
```

#### 6.3 게임 플레이 테스트

1. 게임 시작
2. AI 대전 모드 선택
3. AI가 수를 두는지 확인
4. 로그에서 GnuGo 사용 여부 확인 (Backend 서비스 로그)

**예상 로그:**
```
[GnuGo] Successfully generated move: (10, 10)
```

또는 (fallback 시):
```
[GoAiBot] Falling back to goAiBot: GnuGo not available
```

---

### 7. 문제 해결

#### GnuGo가 작동하지 않는 경우

1. **GnuGo 서비스 로그 확인:**
   - Railway 대시보드 → GnuGo 서비스 → Deployments → 최신 배포 → Logs

2. **일반적인 문제:**
   - GnuGo가 설치되지 않음 → Dockerfile 확인
   - 포트 충돌 → 환경 변수 `PORT` 확인
   - 프로세스 시작 실패 → 로그에서 오류 메시지 확인

3. **Fallback 동작 확인:**
   - GnuGo가 실패하면 자동으로 goAiBot으로 fallback됩니다.
   - Backend 로그에서 fallback 메시지 확인

#### Backend가 GnuGo에 연결하지 못하는 경우

1. **환경 변수 확인:**
   - `GNUGO_API_URL`이 올바르게 설정되었는지 확인
   - URL 형식: `https://your-gnugo-service.railway.app`

2. **네트워크 확인:**
   - Railway 내부 네트워크에서도 작동해야 하지만, 공개 URL 사용 권장

3. **CORS 확인:**
   - GnuGo 서버의 CORS 설정 확인 (`server/gnugoServer.ts`)

---

## 📚 참고 문서

- [Railway 배포 가이드](./railway/RAILWAY_SETUP.md)
- [환경 변수 설정 가이드](./railway/RAILWAY_VARIABLES_REFERENCE.md)
- [Railway 통합 배포 설정](./railway/RAILWAY_INTEGRATED_DEPLOYMENT_SETTINGS.md)
- [배포 체크리스트](./railway/RAILWAY_DEPLOYMENT_CHECKLIST.md)

---

## 🎯 요약

1. ✅ Git 커밋 및 푸시
2. ✅ Railway에 4개 서비스 배포 (SUDAM, KataGo, GnuGo, PostgreSQL)
3. ✅ 환경 변수 설정 (특히 `GNUGO_API_URL`)
4. ✅ 서비스 간 URL 연결 확인
5. ✅ Health check 및 테스트
6. ✅ 게임 플레이 테스트

**주의사항:**
- GnuGo 서비스는 새로 추가된 서비스이므로 별도로 배포해야 합니다.
- Backend 서비스의 `GNUGO_API_URL` 환경 변수를 반드시 설정해야 합니다.
- GnuGo가 실패하면 자동으로 goAiBot으로 fallback되므로, 게임은 계속 진행됩니다.

