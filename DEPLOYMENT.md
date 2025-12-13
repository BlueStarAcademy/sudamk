# 배포 가이드 (Deployment Guide)

## Railway 배포 설정

### 1. 프로젝트 구조

이 프로젝트는 Monorepo 구조로 되어 있으며, Railway에서 두 개의 서비스를 배포해야 합니다:

- **Backend (API)**: `apps/api`
- **Frontend (Web)**: `apps/web`

### 2. Railway 프로젝트 설정

#### 2.1 프로젝트 생성

1. Railway 대시보드에서 새 프로젝트 생성
2. GitHub 저장소 연결
3. 두 개의 서비스 생성:
   - `sudam-api` (Backend)
   - `sudam-web` (Frontend)

#### 2.2 Backend 서비스 설정

**서비스 이름**: `sudam-api`

**설정**:
- Root Directory: `/` (프로젝트 루트)
- Build Command: `pnpm install && pnpm --filter @sudam/api build`
- Start Command: `cd apps/api && node dist/index.js`
- Port: Railway가 자동 할당 (환경 변수 `PORT` 사용)

**환경 변수**:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=<Railway PostgreSQL 연결 문자열>
JWT_SECRET=<랜덤 시크릿 키>
NEXT_PUBLIC_API_URL=<Frontend 서비스 URL>
```

#### 2.3 Frontend 서비스 설정

**서비스 이름**: `sudam-web`

**설정**:
- Root Directory: `/` (프로젝트 루트)
- Build Command: `pnpm install && pnpm --filter @sudam/web build`
- Start Command: `cd apps/web && pnpm start`
- Port: Railway가 자동 할당

**환경 변수**:
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=<Backend 서비스 URL>
```

### 3. 데이터베이스 설정

#### 3.1 PostgreSQL 생성

1. Railway 대시보드에서 PostgreSQL 서비스 추가
2. 연결 문자열을 `DATABASE_URL`로 복사

#### 3.2 마이그레이션 실행

Backend 서비스의 Deploy Script에 추가:

```bash
# Deploy Script (Railway Settings > Deploy)
cd apps/api && pnpm db:generate && pnpm db:migrate:deploy
```

또는 수동으로 실행:

```bash
# Railway CLI 사용
railway run --service sudam-api pnpm db:generate
railway run --service sudam-api pnpm db:migrate:deploy
```

### 4. 환경 변수 설정

#### Backend 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NODE_ENV` | 환경 모드 | `production` |
| `PORT` | 서버 포트 | `4000` |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://...` |
| `JWT_SECRET` | JWT 토큰 시크릿 | `your-secret-key-here` |
| `NEXT_PUBLIC_API_URL` | Frontend URL (선택) | `https://sudam-web.railway.app` |

#### Frontend 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NODE_ENV` | 환경 모드 | `production` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://sudam-api.railway.app` |

### 5. 배포 프로세스

#### 5.1 초기 배포

1. **데이터베이스 생성**
   - Railway에서 PostgreSQL 서비스 추가
   - 연결 문자열 복사

2. **Backend 배포**
   - GitHub 저장소 연결
   - `develop` 브랜치 선택 (또는 `main`)
   - 환경 변수 설정
   - Deploy Script에 마이그레이션 명령 추가
   - 배포 시작

3. **Frontend 배포**
   - GitHub 저장소 연결
   - `develop` 브랜치 선택
   - 환경 변수 설정 (Backend URL 포함)
   - 배포 시작

#### 5.2 업데이트 배포

1. 코드 변경사항을 `develop` 브랜치에 푸시
2. Railway가 자동으로 감지하여 재배포
3. 필요시 수동으로 재배포 가능

### 6. Health Check 설정

#### Backend Health Check

Railway는 자동으로 `/health` 엔드포인트를 확인합니다.

**Health Check 경로**: `/health`

**응답 예시**:
```json
{
  "status": "ok",
  "timestamp": "2024-12-19T...",
  "uptime": 1234.56,
  "memory": { ... }
}
```

#### Frontend Health Check

Next.js는 기본적으로 루트 경로(`/`)를 Health Check로 사용합니다.

### 7. 도메인 설정 (선택)

1. Railway 대시보드에서 서비스 선택
2. Settings > Domains
3. Custom Domain 추가 또는 Railway 제공 도메인 사용

### 8. 모니터링 및 로그

#### 로그 확인

Railway 대시보드에서:
- 각 서비스의 "Logs" 탭에서 실시간 로그 확인
- 에러 로그 필터링 가능

#### 메트릭 확인

- CPU 사용률
- 메모리 사용률
- 네트워크 트래픽
- 요청 수

### 9. 트러블슈팅

#### 일반적인 문제

1. **빌드 실패**
   - 로그에서 에러 확인
   - 의존성 설치 문제 확인
   - Node.js 버전 확인 (>= 20.0.0)

2. **데이터베이스 연결 실패**
   - `DATABASE_URL` 확인
   - PostgreSQL 서비스가 실행 중인지 확인
   - 방화벽 설정 확인

3. **환경 변수 누락**
   - 모든 필수 환경 변수 설정 확인
   - 변수명 오타 확인

4. **포트 충돌**
   - Railway가 자동으로 포트 할당
   - `PORT` 환경 변수는 Railway가 설정

#### 로그 확인 명령어

```bash
# Railway CLI 사용
railway logs --service sudam-api
railway logs --service sudam-web
```

### 10. 배포 체크리스트

배포 전 확인사항:

- [ ] 모든 환경 변수 설정 완료
- [ ] 데이터베이스 마이그레이션 완료
- [ ] Backend Health Check 통과
- [ ] Frontend가 Backend에 연결 가능
- [ ] 로그에 에러 없음
- [ ] 테스트 계정으로 로그인 가능
- [ ] 게임 생성 및 플레이 가능

### 11. 롤백

문제 발생 시:

1. Railway 대시보드에서 이전 배포 선택
2. "Redeploy" 클릭
3. 또는 Git에서 이전 커밋으로 되돌리고 재배포

### 12. 추가 리소스

- [Railway 문서](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
- 프로젝트 이슈: `docs/ISSUES.md`

---

**마지막 업데이트**: 2024-12-19

