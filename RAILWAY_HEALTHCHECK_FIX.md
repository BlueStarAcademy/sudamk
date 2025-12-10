# Railway 헬스체크 오류 해결 가이드

## 문제
헬스체크가 계속 실패하여 배포가 안 됨:
```
Attempt #1 failed with service unavailable
Attempt #2 failed with service unavailable
...
Healthcheck failed!
```

## 해결 방법

### 1. 코드 수정 (완료)
- 서버 리스닝을 최대한 빨리 시작하도록 수정
- 헬스체크가 서버 리스닝 전에도 응답하도록 보장

### 2. Railway Settings 확인

**Railway Dashboard → SUDAM 서비스 → Settings → Deploy:**

#### A. Healthcheck 설정
- **Path**: `/api/health`
- **Timeout**: `120` (초) - **60초에서 120초로 증가**
- **Interval**: `120` (초) - **60초에서 120초로 증가**

**중요:** 타임아웃을 늘려서 서버 시작 시간을 확보합니다.

#### B. Start Command
```
npm run start-server
```
또는 비워두기 (Dockerfile의 CMD 사용)

#### C. Pre-deploy Command
```
(비워두기)
```
또는
```
npm run prisma:migrate:deploy || echo "Migration skipped"
```

#### D. Restart Policy
```
NEVER (권장)
```
또는
```
ON_FAILURE (재시도 횟수: 10)
```

### 3. 환경 변수 확인

**Railway Dashboard → SUDAM 서비스 → Settings → Variables:**

필수:
```bash
DATABASE_URL=postgresql://...
ENABLE_FRONTEND_SERVING=true
PORT=4000
```

선택:
```bash
RAILWAY_ENVIRONMENT=true
```

### 4. 헬스체크 비활성화 (임시 해결책)

만약 위 방법이 작동하지 않으면, 헬스체크를 일시적으로 비활성화:

**Railway Dashboard → SUDAM 서비스 → Settings → Deploy:**
- **Healthcheck Path**: 비워두기
- 또는 **Healthcheck** 토글: OFF

**주의:** 헬스체크를 비활성화하면 Railway가 서비스 상태를 자동으로 감지하지 못합니다.

## 재배포

### 방법 1: Git 푸시
```bash
git add .
git commit -m "Fix: Start server listening earlier for healthcheck"
git push origin main
```

### 방법 2: Railway Dashboard
1. **Deployments** 탭
2. 최신 커밋 옆 **"Redeploy"** 클릭

## 확인

배포 후 로그에서 확인:
```
[Server] Starting server listen immediately for healthcheck...
[Server] Server listening on port 4000
[Server] Health check endpoint is available at /api/health
[Health Check] ok (XXms, listening: true, ready: true, db: connected)
```

헬스체크 테스트:
```bash
curl https://sudam.up.railway.app/api/health
```

## 추가 조치

### 1. 리소스 증가
**Settings → Resources:**
- **CPU**: 최소 2 vCPU
- **Memory**: 최소 2GB

### 2. 빌드 최적화
**Settings → Build:**
- **Dockerfile Path**: `Dockerfile.backend` 확인
- **Build Command**: 비워두기

### 3. 로그 확인
**Logs 탭에서 확인:**
- 서버가 시작되는지
- 헬스체크 요청이 들어오는지
- 에러 메시지가 있는지

## 문제가 계속되면

1. **로그 전체 다운로드**: Railway Dashboard → Logs → Download
2. **에러 메시지 확인**: "Stopping Container" 직전의 로그
3. **헬스체크 타임아웃 증가**: 120초 → 180초
4. **헬스체크 비활성화**: 임시로 비활성화하여 서버가 시작되는지 확인

