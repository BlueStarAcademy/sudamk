# Railway 배포 오류 진단 및 해결 요약

## 🎯 빠른 시작

다른 PC에서 작업을 이어서 하실 때, Railway 배포 오류가 발생하면 다음 단계를 따르세요:

### 1️⃣ 즉시 확인할 것

#### Railway 로그 확인 (가장 중요!)

1. Railway 대시보드 접속
2. 각 서비스 선택 (Frontend, Backend, KataGo)
3. "Deployments" 탭 → 최근 배포 선택
4. "View Logs" 클릭
5. 빨간색 에러 메시지 확인

**확인할 내용:**
- ✅ 빌드가 성공했는지?
- ✅ "Server listening on port..." 메시지가 있는지?
- ✅ 환경 변수 관련 에러가 있는지?
- ✅ 모듈을 찾을 수 없다는 에러가 있는지?

### 2️⃣ 서비스별 체크리스트

#### Frontend (sudam-web)

**필수 환경 변수:**
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
NODE_ENV=production
```

**확인 사항:**
- [ ] `NEXT_PUBLIC_API_URL`이 백엔드의 공개 도메인 URL인가? (프로토콜 포함)
- [ ] 빌드가 성공했는가?
- [ ] 백엔드 서비스가 실행 중인가?

#### Backend (sudam-api)

**필수 환경 변수:**
```
DATABASE_URL=postgresql://... (PostgreSQL 연결 문자열)
JWT_SECRET=<최소 32자 이상의 랜덤 문자열>
NODE_ENV=production
```

**확인 사항:**
- [ ] `DATABASE_URL`이 설정되어 있는가? (PostgreSQL 서비스에서 복사)
- [ ] `JWT_SECRET`이 최소 32자 이상인가?
- [ ] Prisma 클라이언트가 생성되었는가? (빌드 로그 확인)
- [ ] 데이터베이스 마이그레이션이 실행되었는가?

**JWT_SECRET 생성 방법:**
```bash
# 프로젝트 루트에서
pnpm generate:jwt-secret

# 또는
openssl rand -base64 32
```

#### KataGo (sudam-katago)

**확인 사항:**
- [ ] Dockerfile이 올바르게 설정되어 있는가?
- [ ] 빌드 시간이 충분한가? (모델 다운로드 시간)
- [ ] 포트가 충돌하지 않는가? (기본: 4001)

### 3️⃣ 로컬 빌드 테스트

배포 전 로컬에서 빌드가 성공하는지 확인:

```bash
# 전체 의존성 설치
pnpm install

# Backend 빌드 테스트
pnpm --filter @sudam/api build

# Frontend 빌드 테스트
pnpm --filter @sudam/web build
```

로컬에서 빌드가 실패하면, 배포도 실패할 가능성이 높습니다.

### 4️⃣ 일반적인 오류와 해결 방법

#### "Cannot find module" / "Module not found"

**해결:**
- `pnpm install` 재실행
- `pnpm-lock.yaml` 파일 확인
- 의존성 설치 로그 확인

#### "JWT_SECRET is required"

**해결:**
- Backend 서비스 → Variables → `JWT_SECRET` 추가 (최소 32자)
- JWT_SECRET 생성: `pnpm generate:jwt-secret`

#### "Can't reach database server" / "ECONNREFUSED"

**해결:**
1. PostgreSQL 서비스가 실행 중인지 확인
2. PostgreSQL 서비스 → Variables → `DATABASE_URL` 복사
3. Backend 서비스 → Variables → `DATABASE_URL` 설정

#### "Prisma Client is not generated"

**해결:**
- 빌드 로그에서 `prisma generate`가 실행되었는지 확인
- `apps/api/railway.json`의 buildCommand에 포함되어 있는지 확인

#### "NEXT_PUBLIC_API_URL is not defined"

**해결:**
- Frontend 서비스 → Variables → `NEXT_PUBLIC_API_URL` 추가
- 백엔드의 공개 도메인 URL 사용 (프로토콜 포함)

#### 502 Bad Gateway

**해결:**
- 로그에서 서버가 시작되었는지 확인
- Start Command가 올바른지 확인
- 환경 변수가 모두 설정되었는지 확인

### 5️⃣ 단계별 해결 절차

```
1. Railway 로그 확인
   ↓
2. 에러 메시지 파악
   ↓
3. 환경 변수 확인
   ↓
4. 로컬 빌드 테스트
   ↓
5. 설정 파일 확인 (railway.json, Dockerfile)
   ↓
6. 수정 후 재배포
```

## 📚 상세 가이드

더 자세한 내용은 다음 문서를 참고하세요:

- **[Railway 배포 오류 해결 가이드](./RAILWAY_DEPLOYMENT_ERRORS.md)** - 모든 오류와 해결 방법
- **[빠른 배포 가이드](../QUICK_DEPLOY.md)** - 초기 배포 절차
- **[Railway 설정 가이드](../RAILWAY_SETUP.md)** - 상세 설정 방법
- **[배포 체크리스트](../DEPLOYMENT_CHECKLIST.md)** - 배포 전 확인사항

## 💡 도움이 필요하신가요?

구체적인 오류 해결을 위해 다음 정보를 제공해주세요:

1. **어떤 서비스**에서 오류가 발생했나요? (Frontend/Backend/KataGo)
2. **에러 메시지**를 복사해서 알려주세요
3. **Railway 로그**의 관련 부분을 공유해주세요

이 정보를 바탕으로 더 구체적인 해결 방법을 제시할 수 있습니다.

---

**마지막 업데이트**: 2024-12-19

