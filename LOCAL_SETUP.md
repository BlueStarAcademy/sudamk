# 로컬 개발 환경 설정 가이드

## 사전 요구사항

### 1. 필수 소프트웨어 설치

- **Node.js**: 20.0.0 이상
- **pnpm**: 8.10.0 이상
- **PostgreSQL**: 14 이상

#### Node.js 설치 확인
```bash
node --version  # v20.0.0 이상
```

#### pnpm 설치
```bash
# npm을 통해 설치
npm install -g pnpm@8.10.0

# 또는 corepack 사용 (Node.js 16.13+)
corepack enable
corepack prepare pnpm@8.10.0 --activate

# 버전 확인
pnpm --version  # 8.10.0 이상
```

#### PostgreSQL 설치

**Windows:**
- [PostgreSQL 공식 사이트](https://www.postgresql.org/download/windows/)에서 설치
- 또는 [PostgreSQL Installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) 사용

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 프로젝트 설정

### 1. 저장소 클론 (처음만)

```bash
git clone <repository-url>
cd SUDAMR
git checkout develop
```

### 2. 의존성 설치

```bash
# 루트 디렉토리에서 실행
pnpm install
```

### 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하세요:

```bash
# .env 파일 생성 (Windows PowerShell)
New-Item -Path .env -ItemType File

# 또는 텍스트 에디터로 직접 생성
```

`.env` 파일 내용:

```env
# 개발 환경
NODE_ENV=development

# Backend 포트
PORT=4000

# PostgreSQL 데이터베이스 연결 문자열
# 로컬 PostgreSQL 예시:
DATABASE_URL="postgresql://postgres:password@localhost:5432/sudam_dev?schema=public"

# JWT 시크릿 (개발 환경에서는 선택사항, 하지만 설정 권장)
# 최소 32자 이상의 랜덤 문자열
JWT_SECRET="your-local-development-secret-key-min-32-chars"

# CORS 허용 오리진 (선택사항, 기본값: *)
ALLOWED_ORIGINS="http://localhost:3000"

# Frontend API URL (Next.js에서 사용)
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

**DATABASE_URL 형식:**
```
postgresql://[사용자명]:[비밀번호]@[호스트]:[포트]/[데이터베이스명]?schema=public
```

**로컬 PostgreSQL 기본 설정:**
- 사용자명: `postgres`
- 비밀번호: 설치 시 설정한 비밀번호
- 호스트: `localhost`
- 포트: `5432`
- 데이터베이스명: `sudam_dev` (아직 생성 안 됨)

### 4. PostgreSQL 데이터베이스 생성

```bash
# PostgreSQL에 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE sudam_dev;

# 종료
\q
```

**Windows에서 psql이 PATH에 없는 경우:**
- PostgreSQL 설치 경로의 `bin` 폴더를 PATH에 추가
- 예: `C:\Program Files\PostgreSQL\14\bin`

### 5. Prisma 마이그레이션

```bash
# Prisma 클라이언트 생성
pnpm db:generate

# 데이터베이스 마이그레이션 실행
pnpm db:migrate

# 또는 스키마를 데이터베이스에 직접 푸시 (개발용)
pnpm db:push
```

**참고:**
- `db:migrate`: 마이그레이션 파일을 생성하고 적용 (프로덕션 권장)
- `db:push`: 스키마를 직접 데이터베이스에 푸시 (개발용, 빠름)

## 로컬 실행

### 방법 1: 모든 서비스 동시 실행 (권장)

```bash
# 루트 디렉토리에서
pnpm dev
```

이 명령은 Turbo를 사용하여 Frontend와 Backend를 동시에 실행합니다.

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

### 방법 2: 개별 서비스 실행

#### Backend만 실행
```bash
# 루트 디렉토리에서
pnpm --filter @sudam/api dev

# 또는 apps/api 디렉토리에서
cd apps/api
pnpm dev
```

#### Frontend만 실행
```bash
# 루트 디렉토리에서
pnpm --filter @sudam/web dev

# 또는 apps/web 디렉토리에서
cd apps/web
pnpm dev
```

## 개발 도구

### Prisma Studio (데이터베이스 GUI)

```bash
pnpm db:studio
```

브라우저에서 http://localhost:5555 가 자동으로 열립니다.

### 타입 체크

```bash
# 모든 패키지 타입 체크
pnpm type-check

# 특정 패키지만
pnpm --filter @sudam/api type-check
pnpm --filter @sudam/web type-check
```

### 린트

```bash
# 모든 패키지 린트
pnpm lint

# 특정 패키지만
pnpm --filter @sudam/api lint
pnpm --filter @sudam/web lint
```

## 문제 해결

### 1. 포트가 이미 사용 중인 경우

**Backend 포트 (4000) 변경:**
```env
# .env 파일
PORT=4001
```

**Frontend 포트 (3000) 변경:**
```bash
# apps/web 디렉토리에서
pnpm dev -- -p 3001
```

### 2. 데이터베이스 연결 실패

**확인 사항:**
- PostgreSQL 서비스가 실행 중인지 확인
- `DATABASE_URL`이 올바른지 확인
- 데이터베이스가 생성되었는지 확인
- 사용자 권한이 올바른지 확인

**PostgreSQL 서비스 상태 확인:**
```bash
# Windows
Get-Service postgresql*

# macOS/Linux
brew services list  # macOS
sudo systemctl status postgresql  # Linux
```

### 3. Prisma 클라이언트 생성 실패

```bash
# 캐시 삭제 후 재생성
rm -rf node_modules/.prisma
pnpm db:generate
```

### 4. 의존성 설치 문제

```bash
# node_modules 및 lock 파일 삭제 후 재설치
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm pnpm-lock.yaml
pnpm install
```

### 5. Turbo 캐시 문제

```bash
# Turbo 캐시 삭제
pnpm clean
rm -rf .turbo
```

## 환경 변수 참조

### Backend 환경 변수

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
| `NODE_ENV` | ❌ | `development` | 환경 모드 |
| `PORT` | ❌ | `4000` | 서버 포트 |
| `DATABASE_URL` | ✅ | - | PostgreSQL 연결 문자열 |
| `JWT_SECRET` | ⚠️ | - | JWT 시크릿 (프로덕션 필수) |
| `ALLOWED_ORIGINS` | ❌ | `*` | CORS 허용 오리진 |

### Frontend 환경 변수

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
| `NODE_ENV` | ❌ | `development` | 환경 모드 |
| `NEXT_PUBLIC_API_URL` | ✅ | - | Backend API URL |

**참고:** `NEXT_PUBLIC_` 접두사가 붙은 변수만 클라이언트에서 접근 가능합니다.

## 다음 단계

로컬 환경이 정상적으로 실행되면:

1. **회원가입/로그인 테스트**
   - http://localhost:3000 접속
   - 회원가입 후 로그인

2. **게임 생성 및 플레이 테스트**
   - 로비에서 게임 생성
   - 게임 플레이 기능 테스트

3. **개발 시작**
   - `docs/PROGRESS.md`에서 현재 진행 상황 확인
   - 작업할 항목 선택 후 개발 시작

## 추가 리소스

- [프로젝트 구조](./docs/ARCHITECTURE_ANALYSIS.md)
- [진행 상황](./docs/PROGRESS.md)
- [배포 가이드](./QUICK_DEPLOY.md)

