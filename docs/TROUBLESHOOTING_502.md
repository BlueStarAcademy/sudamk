# 502 에러 해결 가이드

배포된 사이트에서 502 Bad Gateway 에러가 발생하는 경우의 해결 방법입니다.

## 502 에러 원인

502 에러는 보통 다음 중 하나입니다:
1. 서버가 시작되지 않음
2. 서버가 크래시됨
3. 포트 설정 문제
4. 빌드 실패
5. 환경 변수 누락
6. 데이터베이스 연결 실패

## 해결 방법

### 1단계: Railway 로그 확인

1. Railway 대시보드 접속
2. 서비스 선택 (백엔드 또는 프론트엔드)
3. "Deployments" 탭 클릭
4. 최근 배포 선택
5. "View Logs" 클릭

**확인할 내용:**
- 빌드가 성공했는지
- 서버가 시작되었는지
- 에러 메시지가 있는지

### 2단계: 일반적인 문제 해결

#### 문제 1: 서버가 시작되지 않음

**증상:** 로그에 "Server listening" 메시지가 없음

**해결:**
1. Start Command 확인:
   - 백엔드: `cd apps/api && pnpm start`
   - 프론트엔드: `cd apps/web && pnpm start`

2. 빌드 아티팩트 확인:
   - 백엔드: `apps/api/dist` 폴더가 생성되었는지
   - 프론트엔드: `apps/web/.next` 폴더가 생성되었는지

#### 문제 2: 포트 설정 문제

**증상:** "EADDRINUSE" 또는 포트 관련 에러

**해결:**
1. Railway는 자동으로 `PORT` 환경 변수를 설정합니다
2. 코드에서 `process.env.PORT`를 사용하는지 확인:

```typescript
// apps/api/src/index.ts
const port = env.PORT || 4000;
await server.listen({ port, host: '0.0.0.0' });
```

3. 하드코딩된 포트가 있다면 제거

#### 문제 3: 환경 변수 누락

**증상:** "Environment validation failed" 또는 관련 에러

**해결:**
1. Railway → Variables 탭 확인
2. 필수 환경 변수 설정:
   - 백엔드: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`
   - 프론트엔드: `NEXT_PUBLIC_API_URL`, `NODE_ENV`

#### 문제 4: 데이터베이스 연결 실패

**증상:** "Can't reach database server" 또는 Prisma 에러

**해결:**
1. `DATABASE_URL` 확인:
   - Railway PostgreSQL 서비스 → Variables → `DATABASE_URL` 복사
   - 백엔드 서비스 → Variables → `DATABASE_URL` 설정

2. 데이터베이스가 실행 중인지 확인:
   - Railway PostgreSQL 서비스 상태 확인

3. 마이그레이션 실행:
   ```bash
   railway run pnpm db:migrate
   ```

#### 문제 5: 빌드 실패

**증상:** 로그에 빌드 에러 메시지

**해결:**
1. 로컬에서 빌드 테스트:
   ```bash
   pnpm build
   ```

2. 빌드 명령어 확인:
   - Railway → Settings → Build Command 확인

3. 의존성 문제:
   - `package.json` 확인
   - `pnpm-lock.yaml` 확인

#### 문제 6: 메모리 부족

**증상:** "Out of memory" 또는 프로세스가 종료됨

**해결:**
1. Railway 플랜 확인 (무료 플랜은 제한적)
2. 메모리 사용량 확인:
   - Railway → Metrics 탭
3. 필요시 Railway Pro 플랜으로 업그레이드

### 3단계: 서버 재시작

1. Railway 대시보드 → 서비스 선택
2. "Deployments" 탭
3. 최근 배포 선택
4. "Redeploy" 클릭

또는:

1. Settings → "Restart Service" 클릭

### 4단계: 헬스체크 확인

서버가 시작된 후 헬스체크 엔드포인트 확인:

```bash
curl https://your-backend-domain.railway.app/health
```

예상 응답:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.45
}
```

## 단계별 진단 체크리스트

### 백엔드 502 에러

- [ ] Railway 로그 확인
- [ ] 빌드 성공 여부 확인
- [ ] 서버 시작 메시지 확인
- [ ] 환경 변수 확인 (`DATABASE_URL`, `JWT_SECRET`)
- [ ] 포트 설정 확인 (`process.env.PORT` 사용)
- [ ] 데이터베이스 연결 확인
- [ ] 헬스체크 엔드포인트 테스트

### 프론트엔드 502 에러

- [ ] Railway 로그 확인
- [ ] 빌드 성공 여부 확인
- [ ] Next.js 빌드 완료 확인
- [ ] 환경 변수 확인 (`NEXT_PUBLIC_API_URL`)
- [ ] 백엔드 서버가 실행 중인지 확인
- [ ] CORS 설정 확인

## 자주 발생하는 에러 메시지

### "Cannot find module"

**원인:** 의존성 설치 실패 또는 빌드 문제

**해결:**
```bash
# 로컬에서 확인
pnpm install
pnpm build
```

### "Prisma Client not generated"

**원인:** Prisma 클라이언트 생성 실패

**해결:**
1. Build Command에 `pnpm db:generate` 포함 확인
2. Railway → Settings → Build Command:
   ```
   pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
   ```

### "Environment validation failed"

**원인:** 필수 환경 변수 누락

**해결:**
1. Railway → Variables 확인
2. 필수 환경 변수 모두 설정

### "ECONNREFUSED" (데이터베이스)

**원인:** 데이터베이스 연결 실패

**해결:**
1. `DATABASE_URL` 확인
2. PostgreSQL 서비스가 실행 중인지 확인
3. 네트워크 설정 확인

## Railway 로그 확인 팁

### 유용한 로그 명령어

Railway CLI 사용:
```bash
railway logs --service backend
railway logs --service frontend
```

### 로그에서 확인할 내용

1. **빌드 단계:**
   - "Installing dependencies"
   - "Building..."
   - "Build completed"

2. **실행 단계:**
   - "Server listening on port..."
   - "Game loop started"
   - "Action point regeneration started"

3. **에러 메시지:**
   - 빨간색 에러 메시지
   - 스택 트레이스
   - 환경 변수 관련 에러

## 빠른 해결 체크리스트

502 에러 발생 시:

1. ✅ Railway 로그 확인 (가장 중요!)
2. ✅ 환경 변수 확인
3. ✅ 빌드 성공 여부 확인
4. ✅ 서버 시작 메시지 확인
5. ✅ 헬스체크 엔드포인트 테스트
6. ✅ 서비스 재시작

## 추가 도움

문제가 지속되면:

1. Railway 로그 전체 복사
2. 에러 메시지 스크린샷
3. 환경 변수 설정 (민감 정보 제외)
4. GitHub Issues에 리포트

## 참고 문서

- [Railway 배포 가이드](./RAILWAY_DEPLOYMENT.md)
- [배포 체크리스트](./DEPLOYMENT_CHECKLIST.md)
- [배포 단계별 가이드](./DEPLOYMENT_STEPS.md)

