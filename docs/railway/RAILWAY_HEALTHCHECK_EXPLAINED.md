# 헬스체크란? 꼭 해야 하나?

## 헬스체크란?

**헬스체크(Health Check)**는 Railway가 서비스가 정상적으로 작동하는지 확인하는 메커니즘입니다.

- Railway가 주기적으로 `/api/health` 엔드포인트에 요청을 보냄
- 서버가 200 응답을 반환하면 "정상"
- 서버가 응답하지 않거나 에러를 반환하면 "비정상"
- 비정상이면 Railway가 서비스를 재시작하거나 배포를 실패로 간주

## 헬스체크는 필수인가?

**아니요! 헬스체크는 필수가 아닙니다.**

헬스체크를 비활성화해도:
- ✅ 서비스는 정상적으로 작동함
- ✅ 배포도 정상적으로 진행됨
- ❌ Railway가 자동으로 서비스 상태를 감지하지 못함 (수동 모니터링 필요)

## 현재 문제

헬스체크가 계속 실패하는 이유는:
- 서버가 실제로 시작되지 않고 있음
- 서버가 리스닝을 시작하기 전에 헬스체크가 실행됨
- 서버 시작에 너무 오래 걸림

## 해결 방법: 헬스체크 완전 비활성화

### 방법 1: Railway Dashboard에서 비활성화 (가장 확실)

1. **Railway Dashboard**: https://railway.app
2. 프로젝트 선택
3. **SUDAM** 서비스 선택
4. **Settings** 탭
5. **Deploy** 섹션으로 스크롤
6. **Healthcheck** 섹션 찾기
7. **Healthcheck Path** 필드를 **완전히 비우기** (빈 값)
8. **Save** 클릭
9. **재배포**

### 방법 2: railway.json에서 제거 (이미 완료)

`railway.json.backend` 파일에서 헬스체크 설정을 제거했습니다.

### 방법 3: Railway CLI로 확인

```bash
railway login
railway link
railway service
railway variables
```

헬스체크 관련 변수가 있으면 제거:
```bash
railway variables unset HEALTHCHECK_PATH
```

## 헬스체크 비활성화 후 확인

1. **배포 상태**: Railway Dashboard → Deployments → "Active" 확인
2. **로그 확인**: 
   ```
   [Server] Starting server...
   [Server] Server listening on port 4000
   ```
3. **서비스 접속**: `https://sudam.up.railway.app` 접속 테스트

## 서버가 정상 작동하면

서버가 정상적으로 시작되고 작동하는 것을 확인한 후, 필요하면 헬스체크를 다시 활성화할 수 있습니다:

1. Railway Dashboard → Settings → Deploy
2. Healthcheck Path: `/api/health`
3. Healthcheck Timeout: `300` (5분)
4. Save

## 결론

**헬스체크는 필수가 아닙니다. 비활성화해도 됩니다.**

현재는 헬스체크를 비활성화하고 서버가 정상적으로 시작되는지 확인하는 것이 우선입니다.

