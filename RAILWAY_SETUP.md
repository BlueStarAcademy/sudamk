# Railway 배포 설정 가이드

## 빠른 시작

### 1. Railway 프로젝트 생성

1. [Railway](https://railway.app)에 로그인
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. GitHub 저장소 연결 및 선택

### 2. PostgreSQL 데이터베이스 추가

1. 프로젝트에서 "+ New" 클릭
2. "Database" → "Add PostgreSQL" 선택
3. 생성 후 "Variables" 탭에서 `DATABASE_URL` 복사

### 3. Backend 서비스 배포

1. 프로젝트에서 "+ New" 클릭
2. "GitHub Repo" 선택
3. 같은 저장소 선택
4. 서비스 이름: `sudam-api`

**설정**:
- **Root Directory**: `/` (프로젝트 루트)
- **Build Command**: (자동 감지 또는 railway.json 사용)
- **Start Command**: `cd apps/api && node dist/index.js`

**환경 변수 설정**:
```
NODE_ENV=production
PORT=4000
DATABASE_URL=<PostgreSQL 연결 문자열>
JWT_SECRET=<최소 32자 랜덤 문자열>
```

**예시 JWT_SECRET 생성**:
```bash
# Linux/Mac
openssl rand -base64 32

# 또는 온라인 생성기 사용
```

### 4. Frontend 서비스 배포

1. 프로젝트에서 "+ New" 클릭
2. "GitHub Repo" 선택
3. 같은 저장소 선택
4. 서비스 이름: `sudam-web`

**설정**:
- **Root Directory**: `/` (프로젝트 루트)
- **Build Command**: (자동 감지 또는 railway.json 사용)
- **Start Command**: `cd apps/web && pnpm start`

**환경 변수 설정**:
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=<Backend 서비스 URL>
```

**Backend URL 찾기**:
- Backend 서비스의 "Settings" → "Networking" → "Public Domain" 확인
- 또는 Railway가 자동 생성한 URL 사용

### 5. 데이터베이스 마이그레이션

Backend 서비스가 배포된 후:

**방법 1: Railway CLI 사용**
```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 선택
railway link

# 마이그레이션 실행
railway run --service sudam-api pnpm --filter @sudam/database exec prisma migrate deploy
```

**방법 2: Deploy Script 사용**
- Backend 서비스의 "Settings" → "Deploy" → "Deploy Script"에 추가:
```bash
pnpm --filter @sudam/database exec prisma generate
pnpm --filter @sudam/database exec prisma migrate deploy
```

### 6. 서비스 연결 확인

1. **Backend Health Check**
   - Backend 서비스 URL + `/health` 접속
   - 예: `https://sudam-api.railway.app/health`
   - 응답: `{"status":"ok",...}` 확인

2. **Frontend 확인**
   - Frontend 서비스 URL 접속
   - 예: `https://sudam-web.railway.app`
   - 페이지 로드 확인

3. **통합 테스트**
   - Frontend에서 회원가입/로그인 테스트
   - 게임 생성 및 플레이 테스트

## 환경 변수 참조

### Backend 필수 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NODE_ENV` | 환경 모드 | `production` |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://...` |
| `JWT_SECRET` | JWT 토큰 시크릿 (최소 32자) | `your-secret-key-here` |

### Backend 선택 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `PORT` | 서버 포트 | `4000` (Railway 자동 할당) |
| `ALLOWED_ORIGINS` | 허용된 CORS 오리진 | `*` |

### Frontend 필수 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NODE_ENV` | 환경 모드 | `production` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://sudam-api.railway.app` |

## 트러블슈팅

### 빌드 실패

**문제**: `pnpm: command not found`
- **해결**: Railway가 자동으로 pnpm을 설치하지만, `.nixpacks.toml` 또는 `railway.json`에서 명시적으로 설정

**문제**: `Prisma client not generated`
- **해결**: 빌드 명령에 `pnpm --filter @sudam/database exec prisma generate` 추가

### 데이터베이스 연결 실패

**문제**: `Can't reach database server`
- **해결**: 
  1. PostgreSQL 서비스가 실행 중인지 확인
  2. `DATABASE_URL` 환경 변수 확인
  3. Railway 내부 네트워크에서 연결되는지 확인

### 포트 오류

**문제**: `Port already in use`
- **해결**: Railway가 자동으로 포트를 할당하므로 `PORT` 환경 변수는 설정하지 않거나 Railway가 설정한 값 사용

### 환경 변수 누락

**문제**: `JWT_SECRET is required`
- **해결**: Backend 서비스의 환경 변수에 `JWT_SECRET` 추가 (최소 32자)

## 모니터링

### 로그 확인

1. Railway 대시보드에서 서비스 선택
2. "Logs" 탭 클릭
3. 실시간 로그 확인

### 메트릭 확인

1. 서비스의 "Metrics" 탭 확인
2. CPU, 메모리, 네트워크 사용량 모니터링

## 업데이트 배포

1. 코드 변경사항을 `develop` 브랜치에 푸시
2. Railway가 자동으로 감지하여 재배포
3. 또는 수동으로 "Redeploy" 클릭

## 롤백

1. 서비스의 "Deployments" 탭 확인
2. 이전 배포 선택
3. "Redeploy" 클릭

---

**마지막 업데이트**: 2024-12-19

