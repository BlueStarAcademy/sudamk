# Railway Builder 변경 방법 (자동 감지된 경우)

## 문제 상황

Railway에서 Builder가 "Dockerfile"로 "Automatically Detected"되어 있고, 드롭다운 메뉴가 없는 경우입니다.

## 해결 방법

### 방법 1: Source 설정에서 변경 (권장)

1. **Railway 대시보드** → 서비스 선택 (SUDAM Frontend)
2. **Settings** → **Source** 탭 (왼쪽 사이드바)
3. **"Disconnect"** 클릭 (GitHub 저장소 연결 해제)
4. **"Connect GitHub Repo"** 클릭
5. 저장소 다시 선택
6. **중요**: 연결할 때 Railway가 자동으로 감지하는데, 이때 `railway.json` 파일이 있으면 Nixpacks로 감지됩니다

### 방법 2: Config-as-code 사용

1. **Settings** → **Config-as-code** 탭
2. **"Enable Config-as-code"** 활성화
3. `railway.json` 파일이 자동으로 인식됩니다

### 방법 3: 프로젝트 루트에 railway.json 추가

현재 `apps/web/railway.json`이 있지만, Railway가 루트에서 찾을 수도 있습니다.

**옵션 A**: 루트에 `railway.json` 파일 생성 (Frontend용)

**옵션 B**: Source 설정에서 Root Directory를 `apps/web`로 설정

### 방법 4: Source 재연결 (가장 확실한 방법)

1. **Settings** → **Source**
2. **"Disconnect"** 클릭
3. 잠시 기다린 후 **"Connect GitHub Repo"** 클릭
4. 같은 저장소 선택
5. **Root Directory**를 확인:
   - Frontend: `/` (프로젝트 루트) 또는 `/apps/web`
   - Backend: `/` (프로젝트 루트) 또는 `/apps/api`
6. 연결하면 `railway.json` 파일을 찾아서 Nixpacks로 설정됩니다

## 확인 사항

### railway.json 파일 위치 확인

현재 파일 위치:
- Frontend: `apps/web/railway.json` ✅
- Backend: `apps/api/railway.json` ✅

### Root Directory 설정

Railway에서:
- **Root Directory**가 프로젝트 루트(`/`)로 설정되어 있으면 → `apps/web/railway.json`을 찾아야 함
- **Root Directory**가 `apps/web`로 설정되어 있으면 → `railway.json`을 찾아야 함

## 추천 해결 순서

1. **Settings** → **Source** 확인
2. **Root Directory** 확인
3. Root Directory가 `/`이면 → `apps/web/railway.json`이 인식되어야 함
4. 인식되지 않으면 → Source를 Disconnect 후 다시 Connect
5. 여전히 안 되면 → Config-as-code 활성화

## 임시 해결책: Dockerfile 생성 (비권장)

만약 위 방법이 모두 실패하면, 임시로 Dockerfile을 생성할 수도 있지만, Nixpacks를 사용하는 것이 더 좋습니다.

---

**가장 확실한 방법**: Source를 Disconnect 후 다시 Connect하면 Railway가 `railway.json` 파일을 다시 스캔하여 Nixpacks로 설정합니다.

