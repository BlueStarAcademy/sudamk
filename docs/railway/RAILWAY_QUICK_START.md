# Railway 빠른 배포 가이드

## Dockerfile Path 설정 방법

Railway UI에서 Dockerfile Path 입력칸을 찾지 못하는 경우, 다음 방법을 사용하세요:

### ✅ 가장 쉬운 방법: Settings → Deploy → Source

1. 서비스 생성 후 **Settings** 탭 클릭
2. **Deploy** 섹션으로 스크롤
3. **Source** 섹션 찾기
4. **Dockerfile** 선택 또는 **Custom** 선택 후 `Dockerfile.frontend` 입력

### ✅ 또는: Settings → Build

1. **Settings** → **Build** 탭
2. **Dockerfile Path** 필드에 입력:
   - Frontend: `Dockerfile.frontend`
   - Backend: `Dockerfile.backend`  
   - KataGo: `Dockerfile.katago`

### ✅ 또는: Start Command에 직접 지정

Railway가 자동으로 Dockerfile을 감지하지 못하는 경우:

1. **Settings** → **Deploy**
2. **Start Command**에 입력:
   ```
   docker build -f Dockerfile.frontend -t app . && docker run app npm run start-frontend
   ```
   (하지만 이 방법은 복잡하므로 권장하지 않음)

## 추천: railway.json 파일 사용

각 서비스별로 `railway.json` 파일을 사용하는 것이 가장 확실합니다:

### Frontend 서비스

1. 서비스 생성 후 **Settings** → **Deploy** → **Source**
2. **railway.json** 선택
3. Railway가 `railway.json.frontend` 파일을 자동으로 인식하도록 설정
   - 또는 프로젝트 루트에 `railway.json` 파일이 있으면 자동 인식

### 문제 해결

**Dockerfile Path 입력칸이 보이지 않는 경우:**

1. **Settings** → **Build** 탭 확인
2. **Settings** → **Deploy** → **Source** 확인  
3. **Settings** → **General** 확인
4. Railway UI가 업데이트되었을 수 있으므로, **railway.json 파일 사용을 권장**

## 실제 배포 단계 (간단 버전)

### 1. Frontend 서비스

1. New Service → GitHub Repo → `BlueStarAcademy/sudamk` 선택
2. 서비스 이름: `frontend`
3. **Settings** → **Deploy**:
   - Start Command: `npm run start-frontend`
   - Source: **Dockerfile** 선택 또는 **Custom** 선택
   - Dockerfile Path: `Dockerfile.frontend` 입력
4. **Settings** → **Variables**:
   - `VITE_API_URL` (백엔드 URL - 나중에 설정)
   - `VITE_WS_URL` (백엔드 WebSocket URL - 나중에 설정)

### 2. Backend 서비스

1. New Service → 같은 저장소 선택
2. 서비스 이름: `backend`
3. **Settings** → **Deploy**:
   - Start Command: `npm run start-server`
   - Dockerfile Path: `Dockerfile.backend`
4. **Settings** → **Variables**:
   - `ENABLE_FRONTEND_SERVING=false`
   - `KATAGO_API_URL` (카타고 URL - 나중에 설정)
   - 기존 환경 변수들 복사

### 3. KataGo 서비스

1. New Service → 같은 저장소 선택
2. 서비스 이름: `katago`
3. **Settings** → **Deploy**:
   - Start Command: `npm run start-katago`
   - Dockerfile Path: `Dockerfile.katago`
4. **Settings** → **Variables**: 카타고 관련 변수들 설정

## 핵심 포인트

- Railway UI에서 Dockerfile Path를 찾을 수 없으면 **Settings → Build** 또는 **Settings → Deploy → Source** 확인
- 가장 확실한 방법: **railway.json 파일 사용**
- 각 서비스는 같은 GitHub 저장소를 사용하되, 다른 Dockerfile을 사용

