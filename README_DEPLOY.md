# SUDAM v2 배포 가이드

## 빠른 시작

### 1. Railway에 배포하기

1. **Railway 계정 생성 및 프로젝트 생성**
   - [Railway](https://railway.app)에 로그인
   - 새 프로젝트 생성
   - GitHub 저장소 연결

2. **PostgreSQL 데이터베이스 추가**
   - 프로젝트에 PostgreSQL 서비스 추가
   - 연결 문자열 복사

3. **Backend 서비스 배포**
   - 새 서비스 추가 (GitHub 저장소 선택)
   - 서비스 이름: `sudam-api`
   - 환경 변수 설정:
     ```
     NODE_ENV=production
     DATABASE_URL=<PostgreSQL 연결 문자열>
     JWT_SECRET=<랜덤 시크릿 키>
     ```
   - 배포 시작

4. **Frontend 서비스 배포**
   - 새 서비스 추가 (같은 GitHub 저장소)
   - 서비스 이름: `sudam-web`
   - 환경 변수 설정:
     ```
     NODE_ENV=production
     NEXT_PUBLIC_API_URL=<Backend 서비스 URL>
     ```
   - 배포 시작

5. **데이터베이스 마이그레이션**
   - Backend 서비스의 Deploy Script에 추가:
     ```bash
     pnpm db:generate && pnpm db:migrate:deploy
     ```
   - 또는 Railway CLI 사용:
     ```bash
     railway run --service sudam-api pnpm db:generate
     railway run --service sudam-api pnpm db:migrate:deploy
     ```

### 2. 상세 가이드

자세한 배포 가이드는 다음 문서를 참고하세요:

- **배포 가이드**: [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- **배포 체크리스트**: [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)

### 3. 환경 변수

필수 환경 변수는 [`DEPLOYMENT.md`](./DEPLOYMENT.md#4-환경-변수-설정)를 참고하세요.

### 4. 문제 해결

배포 중 문제가 발생하면:

1. **로그 확인**: Railway 대시보드에서 서비스 로그 확인
2. **체크리스트 확인**: [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) 참고
3. **문서 확인**: [`DEPLOYMENT.md`](./DEPLOYMENT.md#9-트러블슈팅)의 트러블슈팅 섹션

---

**마지막 업데이트**: 2024-12-19

