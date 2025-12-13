# KataGo 빠른 배포 가이드

## 5분 안에 KataGo 배포하기

### 1단계: KataGo 서비스 생성 (1분)

1. Railway 대시보드 → 프로젝트 선택
2. "+ New" → "GitHub Repo" 선택
3. 같은 저장소 선택
4. 서비스 이름: `KataGo`

### 2단계: 빌더 설정 (1분)

**옵션 A: Dockerfile 사용 (권장)**

1. **Settings** → **Build** 탭
2. Builder가 "Dockerfile"로 자동 감지되면:
   - **Dockerfile Path**: `Dockerfile.katago` 입력
3. 자동 감지되지 않으면:
   - Builder 드롭다운에서 "Dockerfile" 선택
   - Dockerfile Path: `Dockerfile.katago`

**옵션 B: railway.json 사용**

1. **Settings** → **Source** 탭
2. Root Directory 확인: `/` (프로젝트 루트)
3. Railway가 `apps/katago/railway.json` 또는 루트의 `railway.json`을 자동 인식

### 3단계: 환경 변수 설정 (2분)

**Settings** → **Variables** 탭에서 추가:

```env
NODE_ENV=production
PORT=4001
KATAGO_PATH=/app/katago/katago
KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
KATAGO_HOME_PATH=/app/katago_home
KATAGO_NUM_ANALYSIS_THREADS=2
KATAGO_NUM_SEARCH_THREADS=4
KATAGO_MAX_VISITS=1000
ALLOWED_ORIGINS=<Backend 서비스 URL>
```

**참고**: Dockerfile을 사용하면 `KATAGO_PATH`와 `KATAGO_MODEL_PATH`는 자동으로 설정됩니다.

### 4단계: Backend 서비스에 KataGo URL 추가 (1분)

**Backend 서비스** → **Settings** → **Variables**:

```env
KATAGO_API_URL=<KataGo 서비스 URL>
```

**KataGo 서비스 URL 찾기**:
- KataGo 서비스 → Settings → Networking → Public Domain
- 예: `https://katago.up.railway.app`

### 5단계: 배포 확인

1. KataGo 서비스 배포 시작 (자동)
2. Health Check 확인:
   ```
   https://your-katago.railway.app/api/health
   ```
3. Backend 서비스에서 KataGo 연결 테스트

## 확인

- **KataGo Health**: `https://your-katago.railway.app/api/health`
- **KataGo Status**: `https://your-katago.railway.app/api/katago/status`

## 자동 배포

✅ **Git에 푸시하면 자동 배포됩니다!**

- `develop` 또는 `main` 브랜치에 푸시하면 자동으로 배포 시작
- Railway 대시보드에서 배포 상태 확인

## 문제 발생 시

자세한 가이드는 [`KATAGO_DEPLOYMENT.md`](./KATAGO_DEPLOYMENT.md)를 참고하세요.

---

**총 소요 시간**: 약 5분 (초기 설정)  
**이후**: Git 푸시만 하면 자동 배포! 🚀

