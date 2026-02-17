# 백엔드 서버 상태 확인 가이드

## "서버에 연결할 수 없습니다" / Failed to fetch 발생 시

프론트(https://sudam.up.railway.app)에서 로그인 시 위 메시지가 나오면, **브라우저가 API 서버에 연결하지 못한** 상태입니다.

### 1단계: API가 살아 있는지 확인

브라우저 새 탭에서 아래 주소를 열어보세요.

- **https://sudam-api-production.up.railway.app/api/health**

- **응답이 보이면** (JSON 등): API는 동작 중입니다. CORS/설정 문제일 수 있으므로 3단계로.
- **연결 실패/타임아웃이면**: API 서비스가 중단되었거나 URL이 바뀌었습니다. 2단계로.

### 2단계: Railway 대시보드에서 API 서비스 확인

1. **Railway 대시보드** → **SUDAM-API** (백엔드) 서비스 선택
2. **Deployments** 탭: 최근 배포가 성공(초록)인지 확인
3. **Logs** 탭: 크래시·에러 메시지 확인
4. **Variables** 탭: `DATABASE_URL`, `FRONTEND_URL` 등 필수 변수 설정 여부 확인
5. 문제가 있으면 **Redeploy** 실행

배포 후 Railway가 새 URL을 부여했을 수 있습니다. **Settings → Domains**에서 현재 공개 URL을 확인하고, 프론트엔드 서비스의 `VITE_API_URL`, `VITE_WS_URL`이 이 URL과 일치하는지 확인한 뒤, 필요하면 값 수정 후 **프론트엔드 재배포**하세요.

### 3단계: CORS / FRONTEND_URL

백엔드 서비스 Variables에 다음이 설정되어 있는지 확인합니다.

- `FRONTEND_URL=https://sudam.up.railway.app`

설정 후 변경 사항 반영을 위해 백엔드 **Redeploy**가 필요할 수 있습니다.

---

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

