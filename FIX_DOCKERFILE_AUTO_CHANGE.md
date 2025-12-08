# Railway Dockerfile 자동 변경 문제 해결

## 문제
Railway에서 Frontend 서비스를 배포할 때, Dockerfile이 자동으로 `Dockerfile.backend`로 변경되는 문제가 발생합니다.

## 원인
Railway가 여러 서비스에서 같은 Git 저장소를 사용할 때, 루트의 `railway.json` 파일을 기본으로 사용하거나 자동으로 Dockerfile을 감지하는 과정에서 `Dockerfile.backend`를 우선적으로 선택하는 경우가 있습니다.

## 해결 방법

### 방법 1: Railway Dashboard에서 명시적으로 설정 (권장)

1. **Railway Dashboard 접속**
   - https://railway.app 접속
   - 프로젝트 선택

2. **Frontend 서비스 선택**
   - 왼쪽 사이드바에서 `frontend` 서비스 클릭

3. **Settings → Build 섹션으로 이동**
   - 상단 메뉴에서 **Settings** 탭 클릭
   - **Build** 섹션으로 스크롤

4. **Dockerfile Path 명시적으로 설정**
   - **Builder**: `DOCKERFILE` 선택 (이미 선택되어 있을 수 있음)
   - **Dockerfile Path** 필드에 `Dockerfile.frontend` 입력
   - ⚠️ **중요**: 반드시 정확히 `Dockerfile.frontend` 입력 (대소문자 구분)
   - **저장** 또는 **Update** 버튼 클릭

5. **Deploy 섹션 확인**
   - **Settings** → **Deploy** 섹션으로 이동
   - **Start Command** 필드 확인:
     - 비워두기 (Dockerfile의 CMD 사용) - 권장
     - 또는 `serve -s dist -l $PORT` (Dockerfile과 동일하게)

6. **재배포 확인**
   - **Deployments** 탭으로 이동
   - 최신 배포가 `Dockerfile.frontend`를 사용하는지 확인
   - 배포 로그에서 다음 메시지 확인:
     ```
     Using Detected Dockerfile
     context: ...
     internal
     load build definition from Dockerfile.frontend
     ```

### 방법 2: railway.json 파일 사용

1. **프로젝트 루트에서 확인**
   - `railway.json.frontend` 파일이 존재하는지 확인
   - 파일 내용 확인:
     ```json
     {
       "$schema": "https://railway.app/railway.schema.json",
       "build": {
         "builder": "DOCKERFILE",
         "dockerfilePath": "Dockerfile.frontend"
       }
     }
     ```

2. **Railway Dashboard에서 설정**
   - Frontend 서비스 → **Settings** → **Deploy**
   - **Source** 섹션에서 `railway.json` 선택
   - Railway가 `railway.json.frontend` 파일을 인식하도록 설정

3. **또는 파일 이름 변경 (임시 해결책)**
   - Git 저장소에서 `railway.json.frontend`를 `railway.json`으로 복사
   - Frontend 서비스 전용 브랜치 생성
   - 해당 브랜치에 `railway.json` 파일 커밋

### 방법 3: 서비스별로 별도 설정 확인

각 서비스의 Settings → Build에서 Dockerfile Path 확인:

- **Frontend 서비스**: `Dockerfile.frontend`
- **Backend 서비스**: `Dockerfile.backend`
- **KataGo 서비스**: `Dockerfile.katago`

## 확인 방법

### 배포 로그에서 확인

1. Railway Dashboard → Frontend 서비스 → **Deployments** 탭
2. 최신 배포 클릭 → **View Logs**
3. 로그에서 다음 메시지 확인:
   ```
   Using Detected Dockerfile
   load build definition from Dockerfile.frontend  ← 이 부분 확인
   ```

### 빌드 단계에서 확인

배포 로그의 빌드 단계에서:
- ✅ 올바른 경우: `FROM docker.io/library/node:20-alpine AS builder` (Dockerfile.frontend)
- ❌ 잘못된 경우: `FROM node:20-alpine AS deps` (Dockerfile.backend)

## 추가 팁

1. **환경 변수 확인**
   - Frontend 서비스는 `VITE_API_URL`, `VITE_WS_URL`만 필요
   - `DATABASE_URL`, `KATAGO_API_URL` 등은 필요 없음

2. **배포 후 확인**
   - Frontend 서비스 URL 접속
   - 404 에러가 아닌 정상적인 React 앱이 표시되어야 함
   - 브라우저 개발자 도구 → Network 탭에서 API 요청 확인

3. **문제가 계속 발생하는 경우**
   - Frontend 서비스를 삭제하고 다시 생성
   - 생성 시 즉시 Settings → Build에서 Dockerfile Path 설정
   - 또는 서비스별로 별도의 Git 저장소 사용 고려

## 예방 방법

1. **서비스 생성 시 즉시 설정**
   - 새 서비스를 생성할 때 즉시 Settings → Build에서 Dockerfile Path 설정
   - 자동 감지에 의존하지 않기

2. **railway.json 파일 명시**
   - 각 서비스별로 올바른 `railway.json.*` 파일 사용
   - Railway Dashboard에서 Source 설정 확인

3. **정기적인 확인**
   - 배포 후 로그에서 사용된 Dockerfile 확인
   - 잘못된 Dockerfile이 사용되면 즉시 수정

