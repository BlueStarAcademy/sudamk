# Railway 환경 변수 설정 가이드

Railway에서 환경 변수를 설정하는 방법을 단계별로 설명합니다.

## 환경 변수 설정 위치

1. Railway 대시보드에서 **서비스 선택**
2. **Settings** 탭 클릭
3. **Variables** 섹션으로 스크롤 (또는 왼쪽 메뉴에서 **Variables** 클릭)

## 환경 변수 추가 방법

### 방법 1: UI에서 직접 추가

1. **Variables** 섹션에서 **New Variable** 또는 **+ Add Variable** 버튼 클릭
2. **Name (Key)** 필드에 변수 이름 입력
3. **Value** 필드에 변수 값 입력
4. **Add** 또는 **Save** 버튼 클릭

### 방법 2: 일괄 추가 (Railway CLI 사용)

```bash
# Frontend 서비스 환경 변수 설정
railway variables set VITE_API_URL=https://your-backend.railway.app --service frontend
railway variables set VITE_WS_URL=wss://your-backend.railway.app --service frontend

# Backend 서비스 환경 변수 설정
railway variables set ENABLE_FRONTEND_SERVING=false --service backend
railway variables set KATAGO_API_URL=https://your-katago.railway.app --service backend

# KataGo 서비스 환경 변수 설정
railway variables set PORT=4001 --service katago
railway variables set KATAGO_PATH=/app/katago/katago --service katago
# ... (나머지 변수들)
```

## 서비스 간 연결 설정 (단계별)

### Step 1: 각 서비스의 공개 URL 확인

**Backend 서비스:**
1. Backend 서비스 선택
2. **Settings** → **Networking**
3. **Generate Domain** 클릭
4. 생성된 URL 복사 (예: `https://backend-xxxx.up.railway.app`)

**KataGo 서비스:**
1. KataGo 서비스 선택
2. **Settings** → **Networking**
3. **Generate Domain** 클릭
4. 생성된 URL 복사 (예: `https://katago-xxxx.up.railway.app`)

### Step 2: Frontend 환경 변수 설정

**Frontend 서비스 선택** → **Settings** → **Variables**

| Name | Value | 설명 |
|------|-------|------|
| `VITE_API_URL` | `https://backend-xxxx.up.railway.app` | Backend 서비스의 공개 URL |
| `VITE_WS_URL` | `wss://backend-xxxx.up.railway.app` | Backend 서비스의 WebSocket URL (HTTPS이므로 wss://) |

**주의:**
- `VITE_WS_URL`은 `wss://`로 시작해야 합니다 (HTTPS 환경)
- URL 끝에 슬래시(`/`)를 붙이지 마세요

### Step 3: Backend 환경 변수 설정

**Backend 서비스 선택** → **Settings** → **Variables**

| Name | Value | 설명 |
|------|-------|------|
| `ENABLE_FRONTEND_SERVING` | `false` | 프론트엔드 서빙 비활성화 |
| `KATAGO_API_URL` | `https://katago-xxxx.up.railway.app` | KataGo 서비스의 공개 URL |
| `DATABASE_URL` | (기존 값 유지) | 데이터베이스 URL |
| `PORT` | `4000` | 서버 포트 |

### Step 4: KataGo 환경 변수 설정

**KataGo 서비스 선택** → **Settings** → **Variables**

| Name | Value |
|------|-------|
| `PORT` | `4001` |
| `KATAGO_PATH` | `/app/katago/katago` |
| `KATAGO_MODEL_PATH` | `/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz` |
| `KATAGO_HOME_PATH` | `/app/server/katago_home` |
| `KATAGO_NUM_ANALYSIS_THREADS` | `4` |
| `KATAGO_NUM_SEARCH_THREADS` | `8` |
| `KATAGO_MAX_VISITS` | `1000` |
| `KATAGO_NN_MAX_BATCH_SIZE` | `16` |

## 환경 변수 설정 순서

**권장 순서:**

1. **KataGo 서비스 먼저 배포 및 URL 확인**
2. **Backend 서비스 배포 및 URL 확인**
   - KataGo URL을 `KATAGO_API_URL`에 설정
3. **Frontend 서비스 배포**
   - Backend URL을 `VITE_API_URL`과 `VITE_WS_URL`에 설정

## 환경 변수 확인 방법

각 서비스의 **Variables** 섹션에서:
- ✅ 설정된 변수 목록 확인
- ✅ 변수 값이 올바른지 확인
- ✅ 필수 변수가 모두 설정되었는지 확인

## 문제 해결

### 환경 변수가 적용되지 않는 경우

1. **서비스 재배포 확인**: Railway는 환경 변수 변경 시 자동 재배포하지만, 수동으로 재배포할 수도 있습니다
2. **변수 이름 확인**: 대소문자 정확히 입력했는지 확인
3. **값 확인**: URL에 프로토콜(`https://`, `wss://`)이 포함되어 있는지 확인
4. **로그 확인**: 서비스의 **Deployments** → **View Logs**에서 환경 변수 로드 여부 확인

### WebSocket 연결 실패

- `VITE_WS_URL`이 `wss://`로 시작하는지 확인 (HTTPS 환경)
- Backend 서비스가 정상 실행 중인지 확인
- Backend의 CORS 설정 확인

## 참고사항

- 환경 변수는 즉시 적용되며, 서비스가 자동으로 재배포됩니다
- 민감한 정보(비밀번호, API 키 등)는 Railway의 **Secrets** 기능을 사용하는 것이 좋습니다
- 환경 변수는 서비스별로 독립적으로 관리됩니다

