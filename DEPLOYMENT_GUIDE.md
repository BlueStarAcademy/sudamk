# SUDAM v2 Railway 배포 가이드

## 📋 목차

1. [사전 준비](#사전-준비)
2. [Railway 프로젝트 설정](#railway-프로젝트-설정)
3. [서비스 배포](#서비스-배포)
4. [환경 변수 설정](#환경-변수-설정)
5. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
6. [배포 확인](#배포-확인)
7. [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 1. GitHub 저장소 준비

```bash
# 로컬에서 GitHub 저장소에 푸시
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Railway 계정 생성

1. [Railway](https://railway.app) 접속
2. GitHub 계정으로 로그인
3. 이메일 인증 완료

---

## Railway 프로젝트 설정

### 1. 새 프로젝트 생성

1. Railway 대시보드에서 **"New Project"** 클릭
2. **"Deploy from GitHub repo"** 선택
3. GitHub 저장소 선택
4. 프로젝트 이름: `sudam-v2` (또는 원하는 이름)

### 2. PostgreSQL 데이터베이스 추가

1. 프로젝트에서 **"New"** → **"Database"** → **"Add PostgreSQL"** 클릭
2. 생성 완료 후 **"Variables"** 탭에서 `DATABASE_URL` 복사
   - 형식: `postgresql://postgres:password@host:port/railway`

---

## 서비스 배포

### 1. Next.js 앱 배포

#### 방법 A: Railway UI 사용

1. 프로젝트에서 **"New"** → **"GitHub Repo"** 선택
2. 같은 저장소 선택
3. 설정:
   - **Root Directory**: `app`
   - **Build Command**: (자동 감지)
   - **Start Command**: `node app/server.js`
4. **"Deploy"** 클릭

#### 방법 B: railway.json 사용 (권장)

Railway가 자동으로 `app/railway.json`을 감지합니다.

**환경 변수 설정** (아래 섹션 참조)

### 2. KataGo 서비스 배포

1. 프로젝트에서 **"New"** → **"GitHub Repo"** 선택
2. 같은 저장소 선택
3. 설정:
   - **Root Directory**: `apps/katago`
   - **Dockerfile Path**: `Dockerfile.katago` (프로젝트 루트)
   - **Port**: `4001`
4. **"Deploy"** 클릭

### 3. GNU Go 서비스 배포

1. 프로젝트에서 **"New"** → **"GitHub Repo"** 선택
2. 같은 저장소 선택
3. 설정:
   - **Root Directory**: `apps/gnugo`
   - **Dockerfile Path**: `Dockerfile.gnugo` (프로젝트 루트)
   - **Port**: `4002`
4. **"Deploy"** 클릭

---

## 환경 변수 설정

### Next.js 앱 환경 변수

각 서비스의 **"Variables"** 탭에서 설정:

```bash
# 필수 변수
DATABASE_URL=postgresql://postgres:password@host:port/railway
JWT_SECRET=your-random-secret-key-min-32-characters
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-app.railway.app

# 외부 서비스 URL (배포 후 업데이트 필요)
KATAGO_API_URL=https://katago-service.railway.app
GNUGO_API_URL=https://gnugo-service.railway.app

# 선택사항
REDIS_URL=redis://... (Redis 사용 시)
ALLOWED_ORIGINS=https://your-app.railway.app
```

**JWT_SECRET 생성 방법:**
```bash
# Node.js로 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 또는 온라인 생성기 사용
```

### KataGo 서비스 환경 변수

```bash
PORT=4001
ALLOWED_ORIGINS=https://your-app.railway.app
```

### GNU Go 서비스 환경 변수

```bash
PORT=4002
ALLOWED_ORIGINS=https://your-app.railway.app
GNUGO_LEVEL=5  # 레벨 범위: 1-10 (1=가장 쉬움, 10=가장 어려움, 기본값=5)
GNUGO_POOL_SIZE=5
```

**레벨 설정:**
- **최소 레벨**: 1 (가장 쉬움)
- **최대 레벨**: 10 (가장 어려움, GNU Go 기본 지원 범위)
- **기본 레벨**: 5
- 레벨은 1-10 범위 내에서만 유효하며, 범위를 벗어난 값은 에러를 반환합니다.

### 환경 변수 업데이트 순서

1. **먼저 Next.js 앱 배포** (DATABASE_URL, JWT_SECRET만 설정)
2. **KataGo/GNU Go 서비스 배포**
3. **서비스 URL 확인** (각 서비스의 "Settings" → "Networking" → "Public Domain")
4. **Next.js 앱 환경 변수 업데이트**:
   - `KATAGO_API_URL`
   - `GNUGO_API_URL`
   - `NEXT_PUBLIC_API_URL`
5. **Next.js 앱 재배포** (환경 변수 변경 시 자동 재배포)

---

## 데이터베이스 마이그레이션

### 방법 1: Railway CLI 사용 (권장)

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# Next.js 앱 서비스 선택
railway service

# 마이그레이션 실행
railway run pnpm db:generate
railway run pnpm db:migrate
```

### 방법 2: Railway UI 사용

1. Next.js 앱 서비스 선택
2. **"Deployments"** 탭 → 최신 배포 선택
3. **"View Logs"** → 터미널 열기
4. 다음 명령 실행:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

### 방법 3: 로컬에서 실행 (개발용)

```bash
# 환경 변수 설정
export DATABASE_URL="postgresql://postgres:password@host:port/railway"

# 마이그레이션 실행
pnpm db:generate
pnpm db:migrate
```

---

## 배포 확인

### 1. 서비스 상태 확인

각 서비스의 **"Deployments"** 탭에서:
- ✅ 배포 상태: "Active"
- ✅ 헬스체크: "Healthy"

### 2. 헬스체크 엔드포인트 확인

```bash
# Next.js 앱
curl https://your-app.railway.app/api/health

# KataGo 서비스
curl https://katago-service.railway.app/api/health

# GNU Go 서비스
curl https://gnugo-service.railway.app/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-19T...",
  "uptime": 123,
  "services": {
    "database": "ok",
    "katago": "ok",
    "gnugo": "ok"
  }
}
```

### 3. 애플리케이션 접속

1. Next.js 앱의 **"Settings"** → **"Networking"** → **"Public Domain"** 확인
2. 브라우저에서 접속: `https://your-app.railway.app`
3. 회원가입/로그인 테스트

---

## 트러블슈팅

### 문제 1: 데이터베이스 연결 오류

**증상:**
```
Error: Can't reach database server
```

**해결 방법:**
1. `DATABASE_URL` 확인 (Railway PostgreSQL 서비스의 Variables 탭)
2. PostgreSQL 서비스가 실행 중인지 확인
3. 연결 풀 크기 확인 (최대 50)

### 문제 2: KataGo/GNU Go 서비스 연결 오류

**증상:**
```
KataGo service error: Failed to fetch
```

**해결 방법:**
1. 서비스 URL 확인:
   - KataGo: `KATAGO_API_URL`
   - GNU Go: `GNUGO_API_URL`
2. CORS 설정 확인: `ALLOWED_ORIGINS`
3. 서비스 로그 확인: 각 서비스의 "Logs" 탭

### 문제 3: 빌드 실패

**증상:**
```
Build failed: Error building Docker image
```

**해결 방법:**
1. Dockerfile 경로 확인:
   - Next.js: `app/Dockerfile`
   - KataGo: `Dockerfile.katago` (루트)
   - GNU Go: `Dockerfile.gnugo` (루트)
2. 빌드 로그 확인: "Deployments" → "View Logs"
3. 의존성 확인: `package.json` 파일 확인

### 문제 4: 메모리 부족

**증상:**
```
Out of memory error
```

**해결 방법:**
1. Railway 대시보드에서 서비스 선택
2. **"Settings"** → **"Resources"** → 메모리 증가
3. 권장 메모리:
   - Next.js: 최소 1GB
   - KataGo: 최소 2GB
   - GNU Go: 최소 512MB

### 문제 5: 포트 충돌

**증상:**
```
Port already in use
```

**해결 방법:**
1. Railway가 자동으로 포트 할당 (PORT 환경 변수 확인)
2. 각 서비스의 포트 확인:
   - Next.js: 3000
   - KataGo: 4001
   - GNU Go: 4002

---

## 스케일링 설정

### 1000명 동시 사용자 지원

#### 1. 인스턴스 수 증가

각 서비스의 **"Settings"** → **"Scaling"**:
- **Next.js 앱**: 2-3개 인스턴스
- **KataGo**: 2-3개 인스턴스
- **GNU Go**: 2-3개 인스턴스

#### 2. 리소스 할당

**"Settings"** → **"Resources"**:
- **Next.js 앱**: 
  - CPU: 2 vCPU
  - Memory: 2GB
- **KataGo**: 
  - CPU: 2 vCPU
  - Memory: 4GB (모델 로딩)
- **GNU Go**: 
  - CPU: 1 vCPU
  - Memory: 1GB

#### 3. 데이터베이스 최적화

PostgreSQL 서비스:
- 연결 풀 크기: 50 (자동 설정됨)
- 인스턴스: 표준 플랜 이상

---

## 모니터링

### Railway 대시보드

각 서비스의 **"Metrics"** 탭에서 확인:
- CPU 사용률
- 메모리 사용률
- 네트워크 트래픽
- 요청 수

### 로그 확인

**"Logs"** 탭에서 실시간 로그 확인:
- 애플리케이션 로그
- 에러 로그
- 빌드 로그

### 알림 설정

**"Settings"** → **"Notifications"**:
- 배포 실패 알림
- 서비스 다운 알림
- 리소스 초과 알림

---

## 비용 예상

### 월 예상 비용 (1000명 동시 사용자 기준)

| 서비스 | 인스턴스 | 메모리 | 예상 비용 |
|--------|---------|--------|----------|
| Next.js 앱 | 2-3개 | 2GB | $20-30 |
| PostgreSQL | 1개 | 표준 | $20-30 |
| KataGo | 2-3개 | 4GB | $30-40 |
| GNU Go | 2-3개 | 1GB | $15-20 |
| **총계** | | | **$85-120/월** |

*실제 비용은 사용량에 따라 달라질 수 있습니다.*

---

## 추가 최적화

### Redis 캐싱 활성화

1. Railway에서 **"New"** → **"Database"** → **"Add Redis"** 선택
2. `REDIS_URL` 환경 변수 설정
3. 자동으로 캐싱 활성화됨

### CDN 설정

Railway는 자동으로 CDN을 제공합니다. 추가 설정 불필요.

### 백업 설정

PostgreSQL 서비스:
1. **"Settings"** → **"Backups"**
2. 자동 백업 활성화
3. 백업 주기 설정

---

## 빠른 참조

### 주요 명령어

```bash
# Railway CLI 로그인
railway login

# 프로젝트 연결
railway link

# 서비스 선택
railway service

# 환경 변수 확인
railway variables

# 로그 확인
railway logs

# 마이그레이션 실행
railway run pnpm db:migrate
```

### 주요 URL

- Railway 대시보드: https://railway.app
- 프로젝트: https://railway.app/project/{project-id}
- 서비스: https://railway.app/service/{service-id}

---

## 지원

문제가 발생하면:
1. 이 가이드의 [트러블슈팅](#트러블슈팅) 섹션 확인
2. Railway 문서: https://docs.railway.app
3. 로그 확인: 각 서비스의 "Logs" 탭

---

**마지막 업데이트**: 2024-12-19

