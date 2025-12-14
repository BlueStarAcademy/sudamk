# Railway 배포 가이드

SUDAM v2 프로젝트를 Railway에 배포하는 상세 가이드입니다.

## 사전 준비사항

1. Railway 계정 생성: https://railway.app
2. GitHub 저장소 준비
3. PostgreSQL 데이터베이스 준비 (Railway에서 제공 가능)

## 배포 단계

### 1. Railway 프로젝트 생성

1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. GitHub 저장소 선택 및 연결
4. 브랜치 선택 (기본: `main`)

### 2. 데이터베이스 설정

1. Railway 프로젝트에서 "New" → "Database" → "Add PostgreSQL" 클릭
2. 데이터베이스가 생성되면 "Variables" 탭에서 `DATABASE_URL` 확인
3. 이 URL을 백엔드 서비스의 환경 변수로 설정

### 3. 백엔드 서비스 배포

#### 3.1 서비스 생성

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택
3. 서비스 이름: `backend` 또는 `api`

#### 3.2 빌드 설정

Railway는 `railway.json` 파일을 자동으로 인식합니다. 프로젝트 루트에 이미 설정되어 있습니다.

**수동 설정이 필요한 경우:**
- Root Directory: (비워두기 - 루트에서 빌드)
- Build Command: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm build`
- Start Command: `cd apps/api && pnpm start`

#### 3.3 환경 변수 설정

Railway 대시보드의 "Variables" 탭에서 다음 환경 변수 설정:

**필수:**
```env
DATABASE_URL=postgresql://... (Railway PostgreSQL에서 자동 생성됨)
JWT_SECRET=your-secret-key-minimum-32-characters-long
NODE_ENV=production
PORT=4000 (Railway가 자동 설정하므로 선택사항)
```

**선택사항:**
```env
ALLOWED_ORIGINS=https://your-frontend-domain.com
RAILWAY_ENVIRONMENT=production
```

#### 3.4 배포 확인

1. "Deployments" 탭에서 배포 상태 확인
2. 배포 완료 후 "Settings" → "Generate Domain"으로 공개 도메인 생성
3. 헬스체크: `https://your-backend-domain.railway.app/health`

### 4. 프론트엔드 서비스 배포

#### 4.1 서비스 생성

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택
3. 서비스 이름: `frontend` 또는 `web`

#### 4.2 빌드 설정

**수동 설정:**
- Root Directory: (비워두기)
- Build Command: `pnpm install --frozen-lockfile && cd apps/web && pnpm build`
- Start Command: `cd apps/web && pnpm start`

#### 4.3 환경 변수 설정

**필수:**
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
```

**선택사항:**
```env
NODE_ENV=production
```

**주의사항:**
- `NEXT_PUBLIC_API_URL`은 백엔드 API의 공개 도메인으로 설정해야 합니다
- 프로토콜(`https://`)을 포함해야 합니다
- 프론트엔드 빌드 시 이 값이 번들에 포함되므로, 배포 후 변경하려면 재빌드가 필요합니다

#### 4.4 배포 확인

1. 배포 완료 후 공개 도메인 생성
2. 프론트엔드 접속 확인

### 5. 자동 배포 설정

#### 5.1 GitHub Actions 사용 (권장)

`.github/workflows/deploy.yml` 파일이 이미 설정되어 있습니다.

**설정 방법:**
1. Railway에서 "Settings" → "Generate Railway Token" 클릭
2. 토큰 복사
3. GitHub 저장소 → "Settings" → "Secrets and variables" → "Actions"
4. 새 시크릿 추가: `RAILWAY_TOKEN` = (복사한 토큰)

이제 `main` 브랜치에 푸시하면 자동으로 배포됩니다.

#### 5.2 Railway 자동 배포

Railway는 기본적으로 GitHub 푸시 시 자동 배포됩니다.

**설정 확인:**
- "Settings" → "Source" → "Auto Deploy" 활성화 확인

## 배포 후 확인사항

### 백엔드 확인

1. **헬스체크**
   ```bash
   curl https://your-backend-domain.railway.app/health
   ```
   응답 예시:
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

### 프론트엔드 확인

1. 프론트엔드 도메인 접속
2. 브라우저 개발자 도구에서 네트워크 오류 확인
3. API 연결 확인

## 트러블슈팅

### 빌드 실패

**문제:** `pnpm: command not found`
- **해결:** Railway는 자동으로 pnpm을 설치합니다. `railway.json`이 올바른지 확인하세요.

**문제:** Prisma 클라이언트 생성 실패
- **해결:** `DATABASE_URL`이 올바르게 설정되었는지 확인하세요.

### 런타임 오류

**문제:** 환경 변수 누락
- **해결:** Railway "Variables" 탭에서 모든 필수 환경 변수가 설정되었는지 확인하세요.

**문제:** 데이터베이스 연결 실패
- **해결:** 
  1. `DATABASE_URL`이 올바른지 확인
  2. Railway PostgreSQL 서비스가 실행 중인지 확인
  3. 데이터베이스 마이그레이션 실행: `pnpm db:migrate` (로컬에서)

### 포트 오류

Railway는 자동으로 `PORT` 환경 변수를 설정합니다. 코드에서 `process.env.PORT`를 사용하는지 확인하세요.

## 모니터링

### Railway 대시보드

- **Metrics**: CPU, 메모리 사용량 확인
- **Logs**: 실시간 로그 확인
- **Deployments**: 배포 이력 확인

### 헬스체크 설정

Railway는 자동으로 `/health` 엔드포인트를 헬스체크로 사용합니다.

**수동 설정:**
- "Settings" → "Healthcheck Path": `/health`

## 비용 최적화

1. **서비스 일시 중지**: 사용하지 않을 때 서비스 일시 중지
2. **리소스 제한**: 필요에 따라 메모리/CPU 제한 설정
3. **데이터베이스 최적화**: 사용하지 않는 데이터 정리

## 보안 체크리스트

- [ ] `JWT_SECRET`이 충분히 길고 복잡한지 확인 (최소 32자)
- [ ] `DATABASE_URL`이 안전하게 저장되었는지 확인
- [ ] CORS 설정이 올바른 도메인만 허용하는지 확인
- [ ] 프로덕션 환경에서 디버그 로그가 비활성화되었는지 확인

## 롤백

배포 문제 발생 시:

1. Railway 대시보드 → "Deployments"
2. 이전 성공한 배포 선택
3. "Redeploy" 클릭

또는 GitHub에서 이전 커밋으로 롤백 후 재배포.

## 추가 리소스

- [Railway 공식 문서](https://docs.railway.app)
- [배포 단계별 가이드](./DEPLOYMENT_STEPS.md) - 단계별 상세 가이드
- [프로젝트 배포 체크리스트](./DEPLOYMENT_CHECKLIST.md)
- [프로덕션 README](./PRODUCTION_README.md)

