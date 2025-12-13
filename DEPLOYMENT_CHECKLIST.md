# 배포 체크리스트 (Deployment Checklist)

## 배포 전 확인사항

### 1. 코드 준비
- [ ] 모든 변경사항이 `develop` 브랜치에 커밋됨
- [ ] 테스트 완료 (로컬에서 정상 작동 확인)
- [ ] 린트 오류 없음
- [ ] 타입 오류 없음

### 2. 환경 변수 설정

#### Backend 서비스
- [ ] `NODE_ENV=production`
- [ ] `PORT=4000` (또는 Railway 자동 할당)
- [ ] `DATABASE_URL` (Railway PostgreSQL 연결 문자열)
- [ ] `JWT_SECRET` (강력한 랜덤 문자열, 최소 32자)
- [ ] `NEXT_PUBLIC_API_URL` (Frontend URL, 선택사항)

#### Frontend 서비스
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_API_URL` (Backend 서비스 URL)

### 3. 데이터베이스 설정
- [ ] PostgreSQL 서비스 생성 완료
- [ ] `DATABASE_URL` 환경 변수 설정 완료
- [ ] 마이그레이션 스크립트 준비
- [ ] 초기 데이터 필요 시 백업 준비

### 4. Railway 설정

#### Backend 서비스
- [ ] 서비스 이름: `sudam-api`
- [ ] GitHub 저장소 연결
- [ ] 브랜치: `develop` (또는 `main`)
- [ ] Root Directory: `/` (프로젝트 루트)
- [ ] Build Command: `pnpm install && pnpm --filter @sudam/api build`
- [ ] Start Command: `cd apps/api && node dist/index.js`
- [ ] Health Check: `/health` (자동)

#### Frontend 서비스
- [ ] 서비스 이름: `sudam-web`
- [ ] GitHub 저장소 연결
- [ ] 브랜치: `develop` (또는 `main`)
- [ ] Root Directory: `/` (프로젝트 루트)
- [ ] Build Command: `pnpm install && pnpm --filter @sudam/web build`
- [ ] Start Command: `cd apps/web && pnpm start`
- [ ] Health Check: `/` (자동)

### 5. 배포 프로세스

#### 초기 배포
1. [ ] PostgreSQL 서비스 생성 및 연결 문자열 복사
2. [ ] Backend 서비스 생성 및 환경 변수 설정
3. [ ] Backend 배포 시작
4. [ ] Backend Health Check 통과 확인 (`/health`)
5. [ ] 데이터베이스 마이그레이션 실행
6. [ ] Frontend 서비스 생성 및 환경 변수 설정
7. [ ] Frontend 배포 시작
8. [ ] Frontend Health Check 통과 확인

### 6. 배포 후 검증

#### Backend 검증
- [ ] Health Check 엔드포인트 응답 확인
- [ ] 로그에 에러 없음
- [ ] 데이터베이스 연결 정상
- [ ] API 엔드포인트 접근 가능

#### Frontend 검증
- [ ] 페이지 로드 정상
- [ ] Backend API 연결 정상
- [ ] 로그인/회원가입 기능 작동
- [ ] 게임 생성 및 플레이 가능

#### 통합 검증
- [ ] 사용자 등록 가능
- [ ] 로그인 가능
- [ ] 게임 생성 가능
- [ ] 게임 플레이 가능
- [ ] WebSocket 연결 정상 (실시간 업데이트)

### 7. 모니터링 설정
- [ ] 로그 확인 경로 파악
- [ ] 메트릭 확인 경로 파악
- [ ] 알림 설정 (선택사항)

### 8. 롤백 계획
- [ ] 이전 배포 버전 확인 방법 파악
- [ ] 롤백 절차 문서화

## 문제 발생 시

### 일반적인 문제 해결

1. **빌드 실패**
   - 로그에서 에러 확인
   - 의존성 문제 확인
   - Node.js 버전 확인 (>= 20.0.0)

2. **데이터베이스 연결 실패**
   - `DATABASE_URL` 확인
   - PostgreSQL 서비스 상태 확인

3. **환경 변수 누락**
   - 모든 필수 변수 확인
   - 변수명 오타 확인

4. **포트 충돌**
   - Railway가 자동 할당하므로 문제 없어야 함

## 빠른 참조

### Railway CLI 명령어

```bash
# 로그 확인
railway logs --service sudam-api
railway logs --service sudam-web

# 환경 변수 설정
railway variables set DATABASE_URL=... --service sudam-api

# 마이그레이션 실행
railway run --service sudam-api pnpm db:generate
railway run --service sudam-api pnpm db:migrate:deploy
```

### Health Check URL

- Backend: `https://your-backend.railway.app/health`
- Frontend: `https://your-frontend.railway.app/`

---

**마지막 업데이트**: 2024-12-19

