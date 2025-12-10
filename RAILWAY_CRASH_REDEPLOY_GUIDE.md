# Railway 크래시 후 재배포 가이드

## 현재 상황
- 서비스가 "Crashed 9 hours ago" 상태
- 삭제 없이 재배포 가능

## 즉시 확인할 사항

### 1. 로그 확인 (가장 중요!)

**Railway Dashboard → SUDAM 서비스 → Logs 탭:**

확인할 내용:
- 마지막 에러 메시지
- "Stopping Container" 직전의 로그
- 헬스체크 실패 메시지
- 데이터베이스 연결 오류
- 메모리 부족 오류

### 2. Settings → Deploy 확인

**Railway Dashboard → SUDAM → Settings → Deploy:**

#### A. Start Command
```
✅ npm run start-server
```
또는 비워두기 (Dockerfile의 CMD 사용)

#### B. Pre-deploy Command
```
✅ 비워두기 (권장)
```
또는
```
npm run prisma:migrate:deploy || echo "Migration skipped"
```

#### C. Healthcheck
- **Path**: `/api/health`
- **Timeout**: `60` (초)
- **Interval**: `60` (초)

#### D. Restart Policy
```
✅ NEVER (권장)
또는
ON_FAILURE (재시도 횟수: 10)
```

### 3. Settings → Variables 확인

**필수 환경 변수:**
```bash
DATABASE_URL=postgresql://...
ENABLE_FRONTEND_SERVING=true
PORT=4000
```

## 재배포 방법

### 방법 1: 새로운 커밋 푸시 (가장 간단)

```bash
# 변경사항 커밋
git add .
git commit -m "Fix: Update Dockerfile for integrated deployment"
git push origin main
```

Railway가 자동으로 배포를 시작합니다.

### 방법 2: Railway Dashboard에서 수동 재배포

1. **Railway Dashboard → SUDAM 서비스**
2. **Deployments** 탭 클릭
3. 최신 커밋 찾기
4. **"Redeploy"** 또는 **"Deploy"** 버튼 클릭

### 방법 3: Settings 저장으로 재배포

1. **Railway Dashboard → SUDAM → Settings**
2. 아무 설정이나 수정 (예: Start Command에 공백 추가 후 제거)
3. **Save** 클릭
4. 자동으로 재배포 시작됨

### 방법 4: Railway CLI로 재배포

```bash
# Railway 로그인
railway login

# 프로젝트 연결
railway link

# 서비스 선택
railway service

# 재배포
railway up
```

## 일반적인 크래시 원인 및 해결

### 1. 헬스체크 실패

**증상:**
- 서버는 시작되지만 헬스체크 실패
- "Healthcheck failed!" 메시지

**해결:**
- Settings → Deploy → Healthcheck Path: `/api/health` 확인
- Settings → Deploy → Healthcheck Timeout: `60` 확인

### 2. 데이터베이스 연결 실패

**증상:**
- "Can't reach database server" 오류
- Prisma 연결 실패

**해결:**
- Settings → Variables → `DATABASE_URL` 확인
- Postgres 서비스가 Online 상태인지 확인

### 3. 메모리 부족

**증상:**
- "Out of memory" 오류
- 컨테이너가 즉시 종료

**해결:**
- Settings → Resources → Memory 증가
- 최소 2GB 이상 권장

### 4. 빌드 실패

**증상:**
- 빌드 단계에서 실패
- Vite 빌드 오류

**해결:**
- Settings → Build → Dockerfile Path: `Dockerfile.backend` 확인
- 로그에서 구체적인 빌드 오류 확인

## 재배포 후 확인

### 1. 배포 상태 확인

**Railway Dashboard → Deployments:**
- 배포가 "Active" 상태인지 확인
- 빌드가 성공했는지 확인

### 2. 로그 확인

**Railway Dashboard → Logs:**
```
[Server] Starting server...
[Server] Server listening on port 4000
[Server] Health check endpoint is available at /api/health
[Server] Frontend serving is enabled
```

### 3. 헬스체크 테스트

```bash
curl https://sudam.up.railway.app/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "listening": true,
  "ready": true
}
```

### 4. 프론트엔드 접속

브라우저에서:
```
https://sudam.up.railway.app
```

## 문제가 계속되면

1. **로그 전체 확인**: Railway Dashboard → Logs → 전체 로그 다운로드
2. **Settings 전체 확인**: 위의 모든 설정 항목 재확인
3. **환경 변수 확인**: Settings → Variables → 모든 필수 변수 확인
4. **리소스 확인**: Settings → Resources → CPU/Memory 충분한지 확인

## 체크리스트

재배포 전:
- [ ] 로그에서 크래시 원인 확인
- [ ] Settings → Deploy → Start Command 확인
- [ ] Settings → Deploy → Healthcheck Path 확인
- [ ] Settings → Variables → `DATABASE_URL` 확인
- [ ] Settings → Variables → `ENABLE_FRONTEND_SERVING=true` 확인
- [ ] Postgres 서비스가 Online 상태인지 확인

재배포 후:
- [ ] 배포가 "Active" 상태인지 확인
- [ ] 로그에서 서버 시작 메시지 확인
- [ ] 헬스체크 엔드포인트 테스트
- [ ] 프론트엔드 접속 테스트

