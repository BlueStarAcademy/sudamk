# 배포 단계별 가이드

SUDAM v2 프로젝트를 프로덕션에 배포하는 단계별 가이드입니다.

## 배포 전 준비

### 1. 로컬에서 최종 확인

```bash
# 1. 빠른 배포 준비 상태 확인
pnpm check:deployment

# 2. 상세 배포 준비 확인
pnpm prepare:production

# 3. 테스트 포함 확인 (권장)
pnpm prepare:production:test

# 4. 빌드 테스트
pnpm build

# 5. 로컬에서 실행 테스트
pnpm dev
```

### 2. Git 상태 확인

```bash
# 변경사항 확인
git status

# 커밋 및 푸시 (필요시)
git add .
git commit -m "[deploy] 프로덕션 배포 준비 완료"
git push origin develop
```

## Railway 배포

### 1. Railway 프로젝트 생성

1. [Railway 대시보드](https://railway.app) 접속
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. GitHub 저장소 선택 및 연결
5. 브랜치 선택: `main` 또는 `develop`

### 2. 데이터베이스 설정

1. Railway 프로젝트에서 "New" → "Database" → "Add PostgreSQL" 클릭
2. 데이터베이스 생성 완료 대기
3. "Variables" 탭에서 `DATABASE_URL` 확인 및 복사

### 3. 백엔드 서비스 배포

#### 3.1 서비스 생성

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택
3. 서비스 이름: `backend` 또는 `api`

#### 3.2 환경 변수 설정

Railway 대시보드의 "Variables" 탭에서 설정:

```env
DATABASE_URL=postgresql://... (Railway PostgreSQL에서 자동 생성)
JWT_SECRET=your-secret-key-minimum-32-characters-long
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.railway.app
```

**주의사항:**
- `JWT_SECRET`은 최소 32자 이상이어야 합니다
- `ALLOWED_ORIGINS`는 프론트엔드 도메인을 포함해야 합니다

#### 3.3 빌드 설정 확인

`railway.json` 파일이 자동으로 인식됩니다. 수동 설정이 필요한 경우:

- **Root Directory**: (비워두기)
- **Build Command**: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm build`
- **Start Command**: `cd apps/api && pnpm start`

#### 3.4 배포 실행

1. "Deployments" 탭에서 배포 상태 확인
2. 배포 완료 대기 (보통 3-5분)
3. "Settings" → "Generate Domain"으로 공개 도메인 생성
4. 백엔드 도메인 기록 (예: `https://api-production.up.railway.app`)

### 4. 프론트엔드 서비스 배포

#### 4.1 서비스 생성

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택
3. 서비스 이름: `frontend` 또는 `web`

#### 4.2 환경 변수 설정

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
NODE_ENV=production
```

**중요:** `NEXT_PUBLIC_API_URL`은 백엔드의 공개 도메인으로 설정해야 합니다.

#### 4.3 빌드 설정

- **Root Directory**: (비워두기)
- **Build Command**: `pnpm install --frozen-lockfile && cd apps/web && pnpm build`
- **Start Command**: `cd apps/web && pnpm start`

#### 4.4 배포 실행

1. 배포 완료 대기
2. 공개 도메인 생성
3. 프론트엔드 도메인 기록

### 5. 데이터베이스 마이그레이션

배포 후 데이터베이스 마이그레이션 실행:

```bash
# 로컬에서 실행 (DATABASE_URL을 프로덕션 URL로 설정)
export DATABASE_URL="postgresql://..."
pnpm db:migrate

# 또는 Railway CLI 사용
railway run pnpm db:migrate
```

## 배포 후 검증

### 1. 자동 검증 스크립트 실행

```bash
# 배포 후 검증 (API URL 지정)
pnpm verify:deployment https://your-backend-domain.railway.app

# 또는 환경 변수로 설정
export API_URL=https://your-backend-domain.railway.app
pnpm verify:deployment
```

### 2. 수동 확인

#### 백엔드 확인

1. **헬스체크**
   ```bash
   curl https://your-backend-domain.railway.app/health
   ```
   예상 응답:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-12-20T...",
     "uptime": 123.45,
     "memory": {...}
   }
   ```

2. **API 엔드포인트**
   ```bash
   curl https://your-backend-domain.railway.app/api
   ```

3. **로그 확인**
   - Railway 대시보드 → "Deployments" → 배포 선택 → "View Logs"

#### 프론트엔드 확인

1. 프론트엔드 도메인 접속
2. 브라우저 개발자 도구에서 네트워크 오류 확인
3. API 연결 확인 (Network 탭에서 `/trpc` 요청 확인)

### 3. 기능 테스트

- [ ] 사용자 등록
- [ ] 로그인
- [ ] 게임 생성
- [ ] 게임 플레이
- [ ] WebSocket 연결
- [ ] 인벤토리 기능
- [ ] 길드 기능

## 자동 배포 설정

### GitHub Actions 사용

1. Railway에서 "Settings" → "Generate Railway Token" 클릭
2. 토큰 복사
3. GitHub 저장소 → "Settings" → "Secrets and variables" → "Actions"
4. 새 시크릿 추가: `RAILWAY_TOKEN` = (복사한 토큰)

이제 `main` 브랜치에 푸시하면 자동으로 배포됩니다.

### Railway 자동 배포

Railway는 기본적으로 GitHub 푸시 시 자동 배포됩니다.

**설정 확인:**
- "Settings" → "Source" → "Auto Deploy" 활성화 확인

## 롤백

배포 문제 발생 시:

1. Railway 대시보드 → "Deployments"
2. 이전 성공한 배포 선택
3. "Redeploy" 클릭

또는 GitHub에서 이전 커밋으로 롤백 후 재배포.

## 모니터링

### Railway 대시보드

- **Metrics**: CPU, 메모리 사용량
- **Logs**: 실시간 로그
- **Deployments**: 배포 이력

### 헬스체크

Railway는 자동으로 `/health` 엔드포인트를 헬스체크로 사용합니다.

## 트러블슈팅

### 빌드 실패

**문제:** `pnpm: command not found`
- **해결:** Railway는 자동으로 pnpm을 설치합니다. `railway.json` 확인

**문제:** Prisma 클라이언트 생성 실패
- **해결:** `DATABASE_URL` 확인 및 `pnpm db:generate` 실행

### 런타임 오류

**문제:** 환경 변수 누락
- **해결:** Railway "Variables" 탭에서 모든 필수 환경 변수 확인

**문제:** 데이터베이스 연결 실패
- **해결:** 
  1. `DATABASE_URL` 확인
  2. Railway PostgreSQL 서비스 실행 확인
  3. 마이그레이션 실행: `pnpm db:migrate`

### CORS 오류

**문제:** 프론트엔드에서 API 호출 실패
- **해결:** 
  1. 백엔드 `ALLOWED_ORIGINS`에 프론트엔드 도메인 추가
  2. 프론트엔드 `NEXT_PUBLIC_API_URL` 확인

## 다음 단계

배포 완료 후:

1. 사용자 피드백 수집
2. 성능 모니터링
3. 에러 로그 모니터링
4. 정기적인 백업 확인
5. 보안 업데이트 적용

## 참고 문서

- [Railway 배포 가이드](./RAILWAY_DEPLOYMENT.md)
- [배포 체크리스트](./DEPLOYMENT_CHECKLIST.md)
- [프로덕션 README](./PRODUCTION_README.md)

