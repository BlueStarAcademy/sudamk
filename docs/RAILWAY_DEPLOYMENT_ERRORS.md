# Railway 배포 오류 해결 가이드

이 문서는 Railway 배포 시 발생하는 일반적인 오류와 해결 방법을 정리한 것입니다.

## 🔍 오류 진단 방법

### 1. Railway 로그 확인

**가장 중요한 첫 단계**: Railway 대시보드에서 로그를 확인하세요.

1. Railway 대시보드 접속
2. 서비스 선택 (Frontend, Backend, KataGo)
3. "Deployments" 탭 → 최근 배포 선택
4. "View Logs" 클릭
5. 빨간색 에러 메시지 확인

### 2. 로그에서 확인할 주요 내용

- ✅ 빌드가 성공했는지?
- ✅ "Server listening on port..." 메시지가 있는지?
- ✅ 환경 변수 관련 에러가 있는지?
- ✅ 데이터베이스 연결 에러가 있는지?
- ✅ 모듈을 찾을 수 없다는 에러가 있는지?

## 🚨 Frontend 배포 오류

### 오류 1: 빌드 실패 - 모듈을 찾을 수 없음

**증상:**
```
Error: Cannot find module 'xxx'
Module not found: Can't resolve 'xxx'
```

**해결 방법:**

1. **의존성 재설치 확인**
   - `pnpm-lock.yaml` 파일이 있는지 확인
   - 빌드 로그에서 `pnpm install`이 성공했는지 확인

2. **Dockerfile 확인**
   - `Dockerfile.web`이 올바른 경로의 파일을 복사하는지 확인
   - workspace 패키지가 모두 복사되는지 확인

3. **로컬 빌드 테스트**
   ```bash
   pnpm install
   pnpm --filter @sudam/web build
   ```

### 오류 2: 환경 변수 누락

**증상:**
```
Error: NEXT_PUBLIC_API_URL is not defined
```

**해결 방법:**

1. Railway 대시보드 → Frontend 서비스 → "Variables" 탭
2. 다음 환경 변수 추가:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
   NODE_ENV=production
   ```
3. **중요**: `NEXT_PUBLIC_API_URL`은 백엔드의 공개 도메인 URL이어야 합니다
   - 프로토콜(`https://`) 포함
   - 백엔드 서비스의 "Settings" → "Networking" → "Public Domain"에서 확인

### 오류 3: API 연결 실패

**증상:**
```
Failed to fetch /trpc/xxx
Network error
```

**해결 방법:**

1. `NEXT_PUBLIC_API_URL`이 올바른지 확인
2. 백엔드 서비스가 실행 중인지 확인
3. CORS 설정 확인 (백엔드)
4. 네트워크 연결 확인

### 오류 4: 빌드 타임아웃

**증상:**
```
Build timeout
```

**해결 방법:**

1. 빌드 시간 단축:
   - `.next` 폴더를 `.dockerignore`에 추가하지 않기
   - 불필요한 의존성 제거
2. Railway 플랜 업그레이드 고려

## 🔧 Backend 배포 오류

### 오류 1: 환경 변수 누락 - JWT_SECRET

**증상:**
```
Error: JWT_SECRET is required
Environment validation failed
```

**해결 방법:**

1. JWT_SECRET 생성:
   ```bash
   # 스크립트 사용
   pnpm generate:jwt-secret
   
   # 또는 직접 생성
   openssl rand -base64 32
   ```

2. Railway 대시보드 → Backend 서비스 → "Variables" 탭
3. 다음 환경 변수 추가:
   ```
   JWT_SECRET=<생성한 32자 이상의 문자열>
   ```

### 오류 2: 데이터베이스 연결 실패

**증상:**
```
Can't reach database server
Prisma Client initialization error
ECONNREFUSED
```

**해결 방법:**

1. **DATABASE_URL 확인**
   - Railway PostgreSQL 서비스 → "Variables" → `DATABASE_URL` 복사
   - Backend 서비스 → "Variables" → `DATABASE_URL` 설정

2. **PostgreSQL 서비스 상태 확인**
   - PostgreSQL 서비스가 실행 중인지 확인
   - Railway 대시보드에서 서비스 상태 확인

3. **마이그레이션 실행**
   ```bash
   # Railway CLI 사용
   railway run --service sudam-api pnpm --filter @sudam/database exec prisma migrate deploy
   ```

### 오류 3: Prisma 클라이언트 생성 실패

**증상:**
```
Prisma Client is not generated
@prisma/client did not initialize
```

**해결 방법:**

1. **빌드 명령에 Prisma 생성 추가**
   - `apps/api/railway.json` 확인:
   ```json
   {
     "build": {
       "buildCommand": "pnpm install && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/api build"
     }
   }
   ```

2. **또는 Dockerfile 확인**
   - `Dockerfile.api`에 Prisma generate 단계가 있는지 확인

### 오류 4: 포트 오류

**증상:**
```
EADDRINUSE: address already in use
Port 4000 is already in use
```

**해결 방법:**

1. Railway는 자동으로 `PORT` 환경 변수를 설정합니다
2. 코드에서 `process.env.PORT`를 사용하는지 확인:
   ```typescript
   // apps/api/src/index.ts
   const port = env.PORT || 4000;
   await server.listen({ port, host: '0.0.0.0' });
   ```

3. **중요**: 하드코딩된 포트 번호 제거

### 오류 5: 서버가 시작되지 않음

**증상:**
- 로그에 "Server listening" 메시지 없음
- 502 Bad Gateway 에러

**해결 방법:**

1. **Start Command 확인**
   - Railway Settings → Deploy → Start Command
   - 올바른 명령: `cd apps/api && node dist/index.js`

2. **빌드 아티팩트 확인**
   - 빌드 로그에서 `apps/api/dist` 폴더 생성 확인
   - `dist/index.js` 파일이 있는지 확인

3. **환경 변수 확인**
   - 필수 환경 변수 모두 설정되었는지 확인
   - `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`

## 🤖 KataGo 배포 오류

### 오류 1: KataGo 바이너리 다운로드 실패

**증상:**
```
ERROR: KataGo binary download failed
Failed to download kataago.zip
```

**해결 방법:**

1. **네트워크 타임아웃 증가**
   - `Dockerfile.katago`에서 다운로드 타임아웃 확인
   - Railway 빌드 환경의 네트워크 문제일 수 있음

2. **수동 다운로드 후 복사**
   - 로컬에서 다운로드
   - Git LFS 또는 다른 방법으로 저장소에 포함

### 오류 2: 모델 파일 다운로드 실패

**증상:**
```
WARNING: KataGo model download failed
```

**해결 방법:**

1. 모델 파일은 선택사항일 수 있습니다
2. 로그에서 계속 진행되는지 확인
3. 필요시 수동으로 모델 파일 추가

### 오류 3: 포트 충돌

**증상:**
```
Port 4001 is already in use
```

**해결 방법:**

1. Railway Settings → Variables → `PORT` 확인
2. 기본값 4001이 다른 서비스와 충돌하는지 확인
3. 필요시 다른 포트 사용 (예: 4002)

## 📋 배포 전 체크리스트

### Frontend

- [ ] `railway.json` 또는 `.nixpacks.toml` 설정 확인
- [ ] `Dockerfile.web` 확인
- [ ] `NEXT_PUBLIC_API_URL` 환경 변수 설정
- [ ] 로컬 빌드 테스트: `pnpm --filter @sudam/web build`
- [ ] 백엔드 서비스 URL 확인

### Backend

- [ ] `railway.json` 또는 `.nixpacks.toml` 설정 확인
- [ ] `Dockerfile.api` 확인
- [ ] `DATABASE_URL` 환경 변수 설정 (PostgreSQL)
- [ ] `JWT_SECRET` 환경 변수 설정 (최소 32자)
- [ ] `NODE_ENV=production` 설정
- [ ] 로컬 빌드 테스트: `pnpm --filter @sudam/api build`
- [ ] Prisma 클라이언트 생성 테스트

### KataGo

- [ ] `railway.json` 확인
- [ ] `Dockerfile.katago` 확인
- [ ] 포트 설정 확인 (기본: 4001)
- [ ] 빌드 시간이 충분한지 확인 (모델 다운로드 시간)

## 🛠️ 일반적인 해결 절차

### 1단계: 로그 확인
```
Railway 대시보드 → 서비스 → Deployments → View Logs
```

### 2단계: 로컬 빌드 테스트
```bash
# 전체 의존성 설치
pnpm install

# Backend 빌드 테스트
pnpm --filter @sudam/api build

# Frontend 빌드 테스트
pnpm --filter @sudam/web build
```

### 3단계: 환경 변수 확인
```
Railway 대시보드 → 서비스 → Variables 탭
모든 필수 환경 변수 확인
```

### 4단계: 설정 파일 확인
- `railway.json` (서비스별)
- `Dockerfile.*` 파일들
- `.nixpacks.toml` 파일들

### 5단계: 재배포
```
Railway 대시보드 → 서비스 → Deployments → Redeploy
```

## 📚 관련 문서

- [빠른 배포 가이드](../QUICK_DEPLOY.md)
- [Railway 설정 가이드](../RAILWAY_SETUP.md)
- [배포 체크리스트](../DEPLOYMENT_CHECKLIST.md)
- [트러블슈팅 가이드](../TROUBLESHOOT_AUTO_DEPLOY.md)

## 💡 도움이 필요하신가요?

1. **Railway 로그를 복사**하여 공유해주세요
2. **구체적인 에러 메시지**를 알려주세요
3. **어떤 서비스**(Frontend/Backend/KataGo)인지 알려주세요

이 정보를 바탕으로 더 구체적인 해결 방법을 제시할 수 있습니다.

---

**마지막 업데이트**: 2024-12-19

