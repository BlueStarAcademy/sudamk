# SUDAMR 프로젝트 설정 및 배포 가이드

## 📋 프로젝트 개요

이 프로젝트는 KataGo AI를 활용한 바둑 게임 애플리케이션입니다.
- **프론트엔드**: React + Vite
- **백엔드**: Express + TypeScript
- **데이터베이스**: PostgreSQL (Prisma ORM)
- **배포**: Railway

## 🚀 로컬 개발 환경 설정

### 1. 사전 요구사항

- Node.js 20.x 이상
- PostgreSQL (로컬 또는 원격)

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 필수: 데이터베이스 연결 URL
# 로컬 PostgreSQL 사용 시:
DATABASE_URL="postgresql://username:password@localhost:5432/dbname?schema=public"

# 또는 Railway/Supabase PostgreSQL 사용 시:
# DATABASE_URL="postgresql://postgres:password@host:5432/postgres?schema=public"

# 선택적: 서버 포트 (기본값: 4000)
PORT=4000

# 선택적: 프론트엔드 URL
FRONTEND_URL=http://localhost:5173
```

### 4. Prisma 클라이언트 생성

```bash
npm run prisma:generate
```

### 5. 데이터베이스 마이그레이션 (로컬 DB가 있는 경우)

```bash
# 개발 환경용 (스키마 변경 시)
npm run prisma:migrate:dev

# 또는 프로덕션용 (기존 마이그레이션 적용)
npm run prisma:migrate:deploy
```

### 6. 로컬 실행

```bash
npm start
```

이 명령어는 다음을 실행합니다:
- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:4000`

## 🚂 Railway 배포 가이드

### 1단계: Railway 프로젝트 생성

1. [Railway](https://railway.app) 접속 및 로그인
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. 이 저장소(`BlueStarAcademy/sudamk`) 연결

### 2단계: PostgreSQL 데이터베이스 추가

1. Railway 프로젝트에서 "New" → "Database" → "Add PostgreSQL"
2. 생성된 PostgreSQL 서비스의 "Variables" 탭에서 `DATABASE_URL` 복사
   - 형식: `postgresql://postgres:password@postgres-production-xxxx.up.railway.app:5432/railway`

### 3단계: Backend 서비스 배포

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소(`BlueStarAcademy/sudamk`) 선택
3. **중요**: Root Directory는 `/` (프로젝트 루트)
4. Railway가 자동으로 `Dockerfile.backend` 감지
5. 서비스 이름을 "backend"로 설정 (선택적)

#### 환경 변수 설정

Backend 서비스의 "Variables" 탭에서 다음 변수들을 설정:

**필수 변수:**
```
DATABASE_URL=<2단계에서 복사한 PostgreSQL URL>
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend.railway.app
```

**선택적 변수:**
```
# KataGo API (별도 서비스로 배포하는 경우)
KATAGO_API_URL=https://katago-api.railway.app/api/katago/analyze

# GnuGo API (AI봇 대전에서 사용)
GNUGO_API_URL=https://gnugo-api.railway.app/api/gnugo/move

# 이메일 서비스 (AWS SES)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
EMAIL_FROM=noreply@yourdomain.com

# 카카오 로그인
KAKAO_CLIENT_ID=your-client-id
KAKAO_CLIENT_SECRET=your-secret
KAKAO_REDIRECT_URI=https://your-app.railway.app/auth/kakao/callback
```

### 4단계: Prisma 마이그레이션 실행

Backend 서비스가 배포된 후:

1. Backend 서비스 → "Deploy Logs" 또는 "Deploy" 탭
2. "Run Command" 클릭
3. 다음 명령어 실행:
   ```bash
   npm run deploy:full
   ```
   
   또는 개별 실행:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate:deploy
   ```

### 5단계: Frontend 서비스 배포

#### 옵션 A: Railway에 배포 (권장)

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택
3. Root Directory: `/`
4. Dockerfile: `Dockerfile.frontend` 사용
5. 서비스 이름을 "frontend"로 설정

**환경 변수 설정:**
```
NODE_ENV=production
```

**빌드 시 환경 변수 (Build Variables):**
```
VITE_API_URL=https://your-backend.railway.app
VITE_BACKEND_URL=https://your-backend.railway.app
VITE_WS_URL=wss://your-backend.railway.app
VITE_BACKEND_WS_URL=wss://your-backend.railway.app
```

#### 옵션 B: Vercel에 배포

1. [Vercel](https://vercel.com) 접속
2. "New Project" → GitHub 저장소 선택
3. 빌드 설정:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 환경 변수:
   ```
   VITE_API_URL=https://your-backend.railway.app
   VITE_BACKEND_URL=https://your-backend.railway.app
   ```

### 6단계: KataGo 서비스 배포 (선택적)

KataGo를 별도 서비스로 배포하려면:

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택
3. Root Directory: `/`
4. Dockerfile: `Dockerfile.katago` 사용
5. 서비스 이름을 "katago"로 설정

Backend 서비스의 환경 변수에 추가:
```
KATAGO_API_URL=https://katago.railway.app/api/analyze
```

### 7단계: 도메인 설정 및 테스트

1. 각 서비스의 "Settings" → "Domains"에서 커스텀 도메인 설정 (선택적)
2. Backend Health Check:
   ```bash
   curl https://your-backend.railway.app/api/health
   ```
3. 브라우저에서 Frontend URL 접속
4. 회원가입/로그인 테스트
5. 실시간 기능 테스트

## 🔧 문제 해결

### 데이터베이스 연결 오류

- `DATABASE_URL` 형식 확인
- Supabase의 경우 SSL 모드 추가: `?sslmode=require`
- Railway PostgreSQL의 경우 내부 네트워크 사용: `postgres.railway.internal:5432`

### 빌드 실패

- Railway 로그 확인
- Node.js 버전 확인 (20.x 필요)
- 의존성 설치 오류 확인
- Prisma 클라이언트 생성 확인

### 배포 후 404 오류

- Frontend의 경우: `nginx.conf` 확인
- API 엔드포인트: CORS 설정 확인
- 환경 변수 `FRONTEND_URL` 확인

### Prisma 마이그레이션 오류

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 재시도
npm run prisma:migrate:deploy

# 데이터 손실 허용 (주의!)
npm run prisma:db:push
```

## 📚 추가 리소스

- 상세 배포 가이드: `README_DEPLOY.md`
- 환경 변수 설정: `deploy.env.example`
- Railway 설정 파일:
  - `railway.json.backend` - Backend 서비스
  - `railway.json.frontend` - Frontend 서비스
  - `railway.json.katago` - KataGo 서비스

## 🎯 다음 단계

1. ✅ GitHub 저장소 클론 완료
2. ✅ 의존성 설치 완료
3. ✅ Prisma 클라이언트 생성 완료
4. ⏳ `.env.local`에 실제 `DATABASE_URL` 설정 필요
5. ⏳ 로컬 데이터베이스 설정 또는 Railway PostgreSQL 연결
6. ⏳ 로컬 실행 테스트 (`npm start`)
7. ⏳ Railway 배포

## 📝 참고사항

- 로컬 개발 시 PostgreSQL이 없으면 Railway의 PostgreSQL을 사용할 수 있습니다
- Railway는 무료 티어를 제공하지만, 사용량에 따라 제한이 있을 수 있습니다
