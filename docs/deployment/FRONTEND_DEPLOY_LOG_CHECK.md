# Frontend Deploy Logs 확인 가이드

## 정상적인 Deploy Logs

Frontend 서비스는 정적 파일을 serve하는 서비스이므로, Deploy Logs가 짧게 나오는 것이 정상입니다.

### 예상되는 Deploy Logs:
```
Starting Container
Starting frontend server on port 8080
INFO Accepting connections at http://localhost:8080
```

이 로그는 다음을 의미합니다:
- ✅ 컨테이너가 정상적으로 시작됨
- ✅ 서버가 포트 8080에서 실행 중
- ✅ 연결을 받을 준비가 완료됨

## 확인해야 할 사항

### 1. Build Logs 확인 (중요!)

**Deploy Logs**가 아닌 **Build Logs** 탭에서 빌드 과정을 확인해야 합니다:

1. Frontend 서비스 선택
2. **"Build Logs"** 탭 클릭
3. 다음 내용들이 보여야 합니다:
   ```
   === Building frontend ===
   npm ci
   npm run build:client
   ✓ built in Xs
   dist/ 폴더 생성 확인
   ```

### 2. 빌드 성공 확인

Build Logs에서 다음을 확인:
- ✅ `npm ci` 성공
- ✅ `npm run build:client` 성공
- ✅ `dist/` 폴더가 생성됨
- ✅ 빌드 오류 없음

### 3. 서비스 접속 테스트

1. Frontend 서비스 → **Settings** → **Networking**
2. **Public Domain** 또는 생성된 URL 확인
3. 브라우저에서 해당 URL 접속
4. 정상적으로 React 앱이 표시되는지 확인

### 4. 환경 변수 확인

Frontend 서비스의 **Variables** 탭에서:
- ✅ `VITE_API_URL` 설정됨 (Backend URL)
- ✅ `VITE_WS_URL` 설정됨 (Backend WebSocket URL)

## 문제가 있는 경우

### Deploy Logs에 오류가 있는 경우

다음과 같은 오류가 보이면 문제가 있습니다:
- ❌ `Cannot find module`
- ❌ `ENOENT: no such file or directory`
- ❌ `dist/ folder not found`
- ❌ `Port already in use`

### 빌드 실패가 있는 경우

Build Logs에서 다음 오류 확인:
- ❌ `npm ci` 실패
- ❌ `npm run build:client` 실패
- ❌ `mozjpeg` 빌드 오류 (이미 수정됨)
- ❌ Vite 빌드 오류

## 정상 작동 확인 방법

### 방법 1: 브라우저 접속
1. Frontend 서비스 URL 접속
2. React 앱이 정상적으로 로드되는지 확인
3. 브라우저 개발자 도구 → Console에서 오류 확인

### 방법 2: API 연결 확인
1. 브라우저 개발자 도구 → Network 탭
2. Backend API 요청이 정상적으로 전송되는지 확인
3. `VITE_API_URL`로 설정된 Backend 서비스에 요청이 가는지 확인

### 방법 3: Railway Metrics 확인
1. Frontend 서비스 → **Metrics** 탭
2. 요청 수, 응답 시간 등 확인
3. 정상적인 트래픽이 있는지 확인

## 요약

- ✅ **Deploy Logs가 짧은 것은 정상입니다** (정적 파일 서버)
- ✅ **Build Logs에서 빌드 성공 확인**
- ✅ **서비스 URL 접속하여 실제 작동 확인**
- ✅ **환경 변수 설정 확인**

Deploy Logs만으로는 부족하므로, 반드시 **Build Logs**와 **실제 서비스 접속**을 확인하세요!

