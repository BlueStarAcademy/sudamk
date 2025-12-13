# 다른 PC에서 작업 이어서 하기

## 1. Git에서 최신 코드 가져오기

### 처음 클론하는 경우
```bash
# 저장소 클론
git clone https://github.com/BlueStarAcademy/sudamk.git
cd SUDAMR

# develop 브랜치로 전환
git checkout develop
```

### 이미 클론되어 있는 경우
```bash
# 현재 브랜치 확인
git branch

# develop 브랜치로 전환 (없으면 생성)
git checkout develop

# 원격 저장소에서 최신 코드 가져오기
git pull origin develop
```

### 로컬 변경사항이 있는 경우
```bash
# 변경사항 임시 저장
git stash push -m "로컬 변경사항 임시 저장"

# 최신 코드 가져오기
git pull origin develop

# 필요시 변경사항 복원
git stash pop
```

## 2. 프로젝트 설정

### 의존성 설치
```bash
# 루트 디렉토리에서 실행
pnpm install
```

### 환경 변수 설정
프로젝트 루트에 `.env` 파일 생성:

```env
# 개발 환경
NODE_ENV=development

# Backend 포트
PORT=4000

# PostgreSQL 데이터베이스 연결 문자열
DATABASE_URL="postgresql://postgres:password@localhost:5432/sudam_dev?schema=public"

# JWT 시크릿 (최소 32자)
JWT_SECRET="your-local-development-secret-key-min-32-chars"

# CORS 허용 오리진
ALLOWED_ORIGINS="http://localhost:3000"

# Frontend API URL
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### 데이터베이스 설정
```bash
# PostgreSQL 데이터베이스 생성
psql -U postgres
CREATE DATABASE sudam_dev;
\q

# Prisma 마이그레이션
pnpm db:generate
pnpm db:migrate
```

## 3. 현재 오류 상황 파악하기

### 배포 오류 확인 방법

**Railway 대시보드에서:**
1. Railway 프로젝트 접속
2. 각 서비스(Frontend, Backend, KataGo)의 "Deployments" 탭 확인
3. 최신 배포의 로그 확인
4. 빌드 실패 원인 파악

**GitHub에서:**
1. 저장소의 "Actions" 탭 확인 (CI/CD가 설정된 경우)
2. 최근 커밋 내역 확인
3. `docs/ISSUES.md` 파일 확인 (있는 경우)

### 로컬에서 빌드 테스트

```bash
# Backend 빌드 테스트
pnpm --filter @sudam/api build

# Frontend 빌드 테스트
pnpm --filter @sudam/web build

# 전체 빌드 테스트
pnpm build
```

### 로컬에서 실행 테스트

```bash
# Backend 실행
pnpm --filter @sudam/api dev

# Frontend 실행 (다른 터미널에서)
pnpm --filter @sudam/web dev
```

## 4. 작업 이어서 하기

### 진행 상황 확인
```bash
# 진행 상황 문서 확인
cat docs/PROGRESS.md

# 최근 커밋 내역 확인
git log --oneline -20

# 최근 변경사항 확인
git diff HEAD~5
```

### 현재 이슈 파악

**문서 확인:**
- `docs/ISSUES.md` - 알려진 이슈 목록
- `docs/DAILY_LOG.md` - 최근 작업 로그
- `README.md` - 프로젝트 개요

**코드 확인:**
```bash
# 최근 수정된 파일 확인
git log --name-status -10

# 특정 파일의 변경 이력 확인
git log --follow -- <파일경로>
```

### 작업 시작 전 체크리스트

- [ ] `git pull`로 최신 코드 받기
- [ ] `pnpm install`로 의존성 설치
- [ ] `.env` 파일 설정 확인
- [ ] 데이터베이스 연결 확인
- [ ] 로컬 빌드 테스트
- [ ] 진행 상황 문서 확인
- [ ] 현재 이슈 파악

## 5. 오류 해결 가이드

### Frontend 오류

**일반적인 오류:**
- 모듈을 찾을 수 없음 → `pnpm install` 재실행
- 타입 오류 → `pnpm type-check` 실행하여 확인
- 빌드 실패 → `pnpm --filter @sudam/web build` 로컬에서 테스트

**Railway 배포 오류:**
- Dockerfile 확인: `Dockerfile.web`
- Railway 설정 확인:
  - Root Directory: `.` (프로젝트 루트)
  - Builder: `DOCKERFILE`
  - Dockerfile Path: `Dockerfile.web`
  - Start Command: `pnpm start` (apps/web 디렉토리에서)

### Backend 오류

**일반적인 오류:**
- 데이터베이스 연결 실패 → `DATABASE_URL` 확인
- Prisma 오류 → `pnpm db:generate` 재실행
- 포트 충돌 → `PORT` 환경 변수 변경

**Railway 배포 오류:**
- Dockerfile 확인: `Dockerfile.api`
- Railway 설정 확인:
  - Root Directory: `.` (프로젝트 루트)
  - Builder: `DOCKERFILE`
  - Dockerfile Path: `Dockerfile.api`
  - Start Command: `node dist/index.js` (apps/api 디렉토리에서)

### KataGo 오류

**일반적인 오류:**
- KataGo 바이너리 다운로드 실패 → Dockerfile의 다운로드 URL 확인
- 포트 충돌 → `PORT` 환경 변수 확인 (기본값: 4001)

**Railway 배포 오류:**
- Dockerfile 확인: `Dockerfile.katago`
- Railway 설정 확인:
  - Root Directory: `.` (프로젝트 루트)
  - Builder: `DOCKERFILE`
  - Dockerfile Path: `Dockerfile.katago`
  - Start Command: (Dockerfile의 CMD 사용)

## 6. 작업 후 커밋 및 푸시

### 변경사항 확인
```bash
# 변경된 파일 확인
git status

# 변경 내용 확인
git diff
```

### 커밋
```bash
# 변경사항 스테이징
git add .

# 커밋 (의미있는 메시지 작성)
git commit -m "[카테고리] 작업 내용

- 구체적인 변경 사항
- 해결한 문제"

# 푸시
git push origin develop
```

### 커밋 메시지 형식
```
[카테고리] 작업 내용

- 구체적인 변경 사항
- 해결한 문제
```

**카테고리:** `fix`, `feat`, `docs`, `refactor`, `backend`, `frontend`, `deploy`

## 7. 빠른 참조

### 자주 사용하는 명령어

```bash
# 최신 코드 가져오기
git pull origin develop

# 의존성 설치
pnpm install

# 전체 개발 서버 실행
pnpm dev

# Backend만 실행
pnpm --filter @sudam/api dev

# Frontend만 실행
pnpm --filter @sudam/web dev

# 빌드 테스트
pnpm build

# 타입 체크
pnpm type-check

# Prisma Studio (데이터베이스 GUI)
pnpm db:studio
```

### 중요한 파일 위치

- **프로젝트 루트 설정:**
  - `package.json` - 루트 패키지 설정
  - `pnpm-workspace.yaml` - pnpm 워크스페이스 설정
  - `turbo.json` - Turbo 빌드 설정
  - `.env` - 환경 변수 (로컬)

- **Frontend:**
  - `apps/web/` - Next.js 앱
  - `apps/web/package.json` - Frontend 의존성
  - `Dockerfile.web` - Frontend Dockerfile

- **Backend:**
  - `apps/api/` - Fastify + tRPC API
  - `apps/api/package.json` - Backend 의존성
  - `Dockerfile.api` - Backend Dockerfile

- **KataGo:**
  - `apps/katago/` - KataGo 서비스
  - `Dockerfile.katago` - KataGo Dockerfile

- **데이터베이스:**
  - `packages/database/` - Prisma 스키마 및 클라이언트
  - `packages/database/schema.prisma` - 데이터베이스 스키마

- **문서:**
  - `docs/PROGRESS.md` - 진행 상황
  - `docs/DAILY_LOG.md` - 작업 로그
  - `LOCAL_SETUP.md` - 로컬 실행 가이드
  - `QUICK_DEPLOY.md` - 배포 가이드

## 8. 문제 해결

### Git 관련 문제

**충돌 발생 시:**
```bash
# 충돌 파일 확인
git status

# 충돌 해결 후
git add <해결한 파일>
git commit -m "충돌 해결"
```

**브랜치 문제:**
```bash
# 현재 브랜치 확인
git branch

# develop 브랜치로 전환
git checkout develop

# 원격 브랜치 정보 업데이트
git fetch origin
```

### 의존성 문제

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm pnpm-lock.yaml
pnpm install
```

### 빌드 문제

```bash
# Turbo 캐시 삭제
rm -rf .turbo

# 빌드 재시도
pnpm build
```

## 9. AI에게 요청하는 방법

다른 PC에서 작업을 이어서 할 때 AI에게 다음과 같이 요청하세요:

### 기본 요청
```
다른 PC에서 작업을 이어서 하려고 해요. 깃에서 최신 코드를 가져왔고, 의존성도 설치했어요. 
현재 프론트엔드/백엔드/카타고 배포 오류가 있는데, 이어서 작업하고 싶어요.
```

### 구체적인 요청
```
다른 PC에서 작업을 이어서 하려고 해요.
1. 깃에서 최신 코드를 가져왔어요 (git pull origin develop)
2. 의존성 설치했어요 (pnpm install)
3. Railway에서 배포 오류가 발생하고 있어요
   - Frontend: [오류 내용]
   - Backend: [오류 내용]
   - KataGo: [오류 내용]
4. 이 오류들을 해결하고 싶어요.
```

### 진행 상황 확인 요청
```
현재 프로젝트의 진행 상황을 알려주세요.
- docs/PROGRESS.md 확인
- 최근 커밋 내역 확인
- 현재 이슈 파악
```

### 특정 오류 해결 요청
```
Railway 배포 로그를 보니 [오류 메시지]가 발생하고 있어요.
이 오류를 해결해주세요.
```

## 10. 체크리스트

### 작업 시작 전
- [ ] Git에서 최신 코드 가져오기
- [ ] 의존성 설치 (`pnpm install`)
- [ ] 환경 변수 설정 (`.env` 파일)
- [ ] 데이터베이스 설정 및 마이그레이션
- [ ] 로컬 빌드 테스트
- [ ] 진행 상황 문서 확인
- [ ] 현재 이슈 파악

### 작업 중
- [ ] 변경사항을 자주 커밋
- [ ] 의미있는 커밋 메시지 작성
- [ ] 로컬에서 테스트 후 커밋

### 작업 완료 후
- [ ] 모든 변경사항 커밋
- [ ] `docs/DAILY_LOG.md` 업데이트 (있는 경우)
- [ ] `docs/PROGRESS.md` 업데이트 (필요시)
- [ ] Git에 푸시
- [ ] Railway 배포 상태 확인

---

**마지막 업데이트:** 2024-12-19

