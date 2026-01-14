# 백엔드 서버 상태 확인 가이드

## 현재 상황 분석

로그를 보면 서버는 정상적으로 실행되고 있습니다:
- ✅ 서버가 포트 4000에서 리스닝 중
- ✅ 데이터베이스 연결 성공
- ✅ Keep-alive 메시지 정상 출력
- ✅ 메모리 사용량 정상 범위

하지만 Railway에서 크래시로 표시되는 경우:

## 가능한 원인

### 1. 헬스체크 실패
Railway의 헬스체크가 실패하고 있을 수 있습니다.

**확인 방법:**
1. Railway 대시보드 → Backend 서비스 → **Settings** → **Healthcheck**
2. 헬스체크 설정 확인:
   - **Path**: `/api/health`
   - **Port**: `4000` (또는 Railway가 자동 설정한 PORT)
   - **Timeout**: 최소 10초 이상

**해결 방법:**
- 헬스체크 경로가 올바른지 확인
- 헬스체크 타임아웃을 늘림 (10-30초)
- 헬스체크를 비활성화하고 수동으로 모니터링

### 2. 요청 타임아웃
요청이 너무 오래 걸려서 타임아웃될 수 있습니다.

**확인 방법:**
브라우저에서 직접 테스트:
```
https://your-backend.railway.app/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...,
  "listening": true,
  "ready": true,
  "database": "connected"
}
```

### 3. CORS 문제
프론트엔드에서 백엔드로의 요청이 CORS로 차단될 수 있습니다.

**확인 방법:**
브라우저 개발자 도구 → Network 탭에서 요청 확인

**해결 방법:**
백엔드 서비스의 `FRONTEND_URL` 환경 변수 확인:
```
FRONTEND_URL=https://your-frontend.railway.app
```

### 4. Railway 헬스체크 설정 문제

**Railway 헬스체크 비활성화 (권장):**
1. Backend 서비스 → **Settings** → **Healthcheck**
2. **Disable Healthcheck** 클릭
3. 서버가 계속 실행되도록 함

**또는 헬스체크 경로 변경:**
- Path: `/` (루트 경로)
- 또는 `/api/health` (현재 설정)

## 즉시 확인 사항

1. **백엔드 서비스 상태 확인:**
   - Railway 대시보드에서 Backend 서비스 상태 확인
   - "Deployments" 탭에서 최신 배포 상태 확인

2. **헬스체크 직접 테스트:**
   ```
   curl https://your-backend.railway.app/api/health
   ```
   또는 브라우저에서 접속

3. **로그 확인:**
   - Railway 대시보드 → Backend 서비스 → **Logs** 탭
   - 최근 에러 메시지 확인

4. **환경 변수 확인:**
   - Backend 서비스 → **Variables** 탭
   - `FRONTEND_URL` 설정 확인
   - `PORT` 설정 확인 (기본값: 4000)

## 문제 해결 체크리스트

- [ ] Railway 헬스체크 설정 확인
- [ ] `/api/health` 엔드포인트 직접 테스트
- [ ] CORS 설정 확인 (`FRONTEND_URL` 환경 변수)
- [ ] Railway 로그에서 에러 메시지 확인
- [ ] 서비스 재시작 (Deployments → Redeploy)

## 추가 디버깅

서버가 실제로 응답하는지 확인:
```bash
# 헬스체크 테스트
curl -v https://your-backend.railway.app/api/health

# 루트 경로 테스트
curl -v https://your-backend.railway.app/
```

응답이 없거나 타임아웃되면:
- Railway 네트워크 설정 확인
- 포트 설정 확인
- 서비스 재시작

