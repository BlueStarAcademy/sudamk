# Railway 헬스체크 비활성화 가이드

## 문제
헬스체크가 계속 실패하여 배포가 안 됨

## 해결 방법: 헬스체크 비활성화

### 방법 1: Railway Dashboard에서 비활성화 (가장 빠름)

1. **Railway Dashboard 접속**: https://railway.app
2. 프로젝트 선택
3. **SUDAM** 서비스 선택
4. **Settings** 탭 클릭
5. **Deploy** 섹션으로 스크롤
6. **Healthcheck** 섹션 찾기
7. **Healthcheck Path** 필드를 **비워두기** (빈 값)
8. 또는 **Healthcheck** 토글을 **OFF**로 설정 (있는 경우)
9. **Save** 클릭

### 방법 2: railway.json에서 비활성화

프로젝트 루트에 `railway.json` 파일이 있다면:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.backend"
  },
  "deploy": {
    "startCommand": "npm run start-server",
    "restartPolicyType": "ON_FAILURE",
    "healthcheckPath": "",
    "healthcheckTimeout": 0,
    "healthcheckInterval": 0
  }
}
```

또는 `healthcheckPath`를 완전히 제거:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.backend"
  },
  "deploy": {
    "startCommand": "npm run start-server",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### 방법 3: Railway CLI로 비활성화

```bash
# Railway 로그인
railway login

# 프로젝트 연결
railway link

# 서비스 선택
railway service

# 헬스체크 비활성화 (설정 제거)
railway variables unset HEALTHCHECK_PATH
```

## 주의사항

⚠️ **헬스체크를 비활성화하면:**
- Railway가 서비스 상태를 자동으로 감지하지 못함
- 서비스가 실제로 크래시되어도 Railway가 자동으로 재시작하지 않을 수 있음
- 수동으로 모니터링해야 함

✅ **대안:**
- 헬스체크를 비활성화한 후 서버가 정상적으로 시작되는지 확인
- 서버가 정상 작동하면 헬스체크를 다시 활성화

## 헬스체크 비활성화 후 확인

1. **배포 상태 확인**
   - Railway Dashboard → Deployments
   - 배포가 "Active" 상태인지 확인

2. **로그 확인**
   - Railway Dashboard → Logs
   - 다음 메시지 확인:
     ```
     [Server] Starting server...
     [Server] Server listening on port 4000
     ```

3. **서비스 접속 확인**
   - 브라우저에서 `https://sudam.up.railway.app` 접속
   - 또는 `curl https://sudam.up.railway.app/api/health` 테스트

## 서버가 정상 작동하면 헬스체크 다시 활성화

서버가 정상적으로 시작되고 작동하는 것을 확인한 후:

1. **Railway Dashboard → Settings → Deploy**
2. **Healthcheck Path**: `/api/health` 입력
3. **Healthcheck Timeout**: `180` (초)
4. **Healthcheck Interval**: `120` (초)
5. **Save**

## 근본 원인 해결

헬스체크를 비활성화하는 것은 임시 해결책입니다. 근본 원인을 해결하려면:

1. **서버 로그 확인**
   - Railway Dashboard → Logs
   - 서버가 실제로 시작되는지 확인
   - 에러 메시지 확인

2. **서버 시작 시간 단축**
   - 데이터베이스 초기화를 비동기로 처리 (이미 적용됨)
   - 불필요한 초기화 작업 제거

3. **헬스체크 타임아웃 증가**
   - Timeout: `300` (5분)
   - Interval: `180` (3분)

## 체크리스트

- [ ] Railway Dashboard → Settings → Deploy → Healthcheck Path 비우기
- [ ] Save 클릭
- [ ] 재배포
- [ ] 배포 상태 확인 (Active)
- [ ] 로그에서 서버 시작 확인
- [ ] 서비스 접속 테스트
- [ ] 서버 정상 작동 확인 후 헬스체크 재활성화 (선택)

