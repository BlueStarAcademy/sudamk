# 프론트엔드가 로드되지 않는 문제 해결

## 문제
- 서버는 실행 중 (JSON 응답이 나옴)
- 하지만 프론트엔드가 표시되지 않음
- `{"service": "backend", "status":"running", ...}` 만 보임

## 원인
`ENABLE_FRONTEND_SERVING` 환경 변수가 설정되지 않아서 프론트엔드 서빙이 비활성화되어 있습니다.

## 해결 방법

### 방법 1: Railway Dashboard에서 환경 변수 설정 (가장 빠름)

1. **Railway Dashboard 접속**: https://railway.app
2. 프로젝트 선택
3. **SUDAM** 서비스 선택
4. **Settings** 탭 클릭
5. **Variables** 섹션으로 스크롤
6. **New Variable** 클릭
7. 다음 입력:
   - **Name**: `ENABLE_FRONTEND_SERVING`
   - **Value**: `true`
8. **Add** 클릭
9. **Save** 클릭 (자동 저장될 수도 있음)
10. **재배포** (자동 재배포될 수도 있음)

### 방법 2: Railway CLI로 설정

```bash
railway login
railway link
railway service
railway variables set ENABLE_FRONTEND_SERVING=true
```

### 방법 3: 코드에서 기본값 변경 (대안)

서버 코드를 수정하여 기본값을 `true`로 변경할 수도 있습니다.

## 확인

환경 변수 설정 후:

1. **재배포 확인**
   - Railway Dashboard → Deployments
   - 최신 배포가 "Active" 상태인지 확인

2. **로그 확인**
   - Railway Dashboard → Logs
   - 다음 메시지 확인:
     ```
     [Server] Frontend serving is enabled
     [Server] dist directory found with X files/directories
     ```

3. **프론트엔드 접속 확인**
   - 브라우저에서 `https://sudam.up.railway.app` 접속
   - 프론트엔드 UI가 표시되는지 확인

## 추가 확인 사항

### 필수 환경 변수 확인

Railway Dashboard → Settings → Variables에서 다음 변수들이 설정되어 있는지 확인:

```bash
ENABLE_FRONTEND_SERVING=true
DATABASE_URL=postgresql://...
PORT=4000
```

### 로그에서 확인할 메시지

프론트엔드 서빙이 활성화되면:
```
[Server] Frontend serving is enabled
[Server] dist directory found with X files/directories
```

프론트엔드 서빙이 비활성화되어 있으면:
```
[Server] Frontend serving is disabled. Frontend should be served by a separate service.
```

## 문제가 계속되면

1. **dist 디렉토리 확인**
   - Dockerfile에서 `dist` 디렉토리가 복사되는지 확인
   - 빌드 로그에서 "Frontend build complete" 메시지 확인

2. **서버 로그 확인**
   - Railway Dashboard → Logs
   - 에러 메시지 확인
   - "dist directory not found" 메시지 확인

3. **환경 변수 재확인**
   - Railway Dashboard → Settings → Variables
   - `ENABLE_FRONTEND_SERVING=true` 정확히 입력되었는지 확인
   - 대소문자 구분 확인

