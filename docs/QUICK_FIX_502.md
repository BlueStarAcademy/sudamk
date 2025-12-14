# 502 에러 빠른 해결 가이드

## 즉시 확인할 것

### 1. Railway 로그 확인 (가장 중요!)

```
Railway 대시보드 → 서비스 선택 → Deployments → 최근 배포 → View Logs
```

**확인할 내용:**
- 빌드가 성공했는지?
- "Server listening on port..." 메시지가 있는지?
- 에러 메시지가 있는지?

### 2. 환경 변수 확인

Railway → Variables 탭에서 확인:

**백엔드 필수:**
- `DATABASE_URL` ✅
- `JWT_SECRET` ✅ (최소 32자)
- `NODE_ENV=production` ✅

**프론트엔드 필수:**
- `NEXT_PUBLIC_API_URL` ✅

### 3. 서비스 재시작

```
Railway → 서비스 → Deployments → 최근 배포 → Redeploy
```

## 자주 발생하는 문제

### 문제 1: 서버가 시작되지 않음

**로그 확인:** "Server listening" 메시지 없음

**해결:**
1. Start Command 확인: `cd apps/api && pnpm start`
2. 빌드 확인: `apps/api/dist` 폴더 존재 확인

### 문제 2: 환경 변수 누락

**로그 확인:** "Environment validation failed"

**해결:**
- Railway → Variables → 필수 환경 변수 모두 설정

### 문제 3: 데이터베이스 연결 실패

**로그 확인:** "Can't reach database server"

**해결:**
1. PostgreSQL 서비스가 실행 중인지 확인
2. `DATABASE_URL` 확인 및 재설정

### 문제 4: 포트 문제

**해결:**
- 코드에서 `process.env.PORT` 사용 확인 (이미 설정됨 ✅)

## 빠른 체크리스트

- [ ] Railway 로그 확인
- [ ] 환경 변수 확인
- [ ] 빌드 성공 확인
- [ ] 서버 시작 메시지 확인
- [ ] 서비스 재시작

## 헬스체크 테스트

서버가 실행 중인지 확인:

```bash
curl https://your-backend-domain.railway.app/health
```

정상 응답:
```json
{"status":"ok","timestamp":"...","uptime":123.45}
```

## 상세 가이드

더 자세한 내용은 [502 에러 해결 가이드](./TROUBLESHOOTING_502.md)를 참고하세요.

