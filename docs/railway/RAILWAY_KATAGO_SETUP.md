# Railway KataGo 설정 가이드

## 🎯 목표
Railway 배포 환경에서 KataGo CPU-only 버전을 사용하여 계가 기능을 정상 작동시키기

## 📋 준비해야 할 사항

### 1️⃣ KataGo CPU-only Binary 다운로드

Railway는 Linux 환경이므로 **Linux용 CPU-only binary**가 필요합니다.

#### 다운로드 방법:

**옵션 A: 수동 다운로드 (권장)**
1. KataGo 릴리즈 페이지에서 Linux CPU-only 버전 다운로드:
   - https://github.com/lightvector/katago/releases
   - 예: `katago-v1.16.4-eigen-linux-x64.zip` (eigen = CPU-only 버전)

2. 다운로드한 파일을 압축 해제
3. `katago` 실행 파일을 프로젝트의 `katago/` 폴더에 복사
4. 실행 권한 부여: `chmod +x katago/katago`

**옵션 B: Railway 시작 시 자동 다운로드 (구현 필요)**
- 서버 시작 시 스크립트로 자동 다운로드하도록 구현

### 2️⃣ 모델 파일 자동 다운로드 설정

Railway의 ephemeral 파일 시스템 때문에 모델 파일도 시작 시 다운로드해야 합니다.

**현재 모델 파일:**
- 네트워크는 시간이 지나며 교체되므로, 특정 파일명(`...s9853922560...`)에 고정하면 403/404가 발생할 수 있습니다.
- KataGo Training 공식 네트워크 목록: `https://katagotraining.org/networks/`
- 모델 다운로드 URL 형식: `https://media.katagotraining.org/uploaded/networks/models/kata1/<network>.bin.gz`

**구현 방법:**
- 서버 시작 시 모델 파일이 없으면 자동 다운로드 (이미 구현되어 있음)
- Railway Start Command에 다운로드 스크립트 포함

**권장 환경 변수(중요)**:
```
KATAGO_MODEL_URL=https://media.katagotraining.org/uploaded/networks/models/kata1/<latest-network>.bin.gz
```
`KATAGO_MODEL_URL`을 지정하면 모델 다운로드가 안정화되고, 계가 시 `ownershipMap`(영토 네모 표시)이 항상 제공됩니다.

### 3️⃣ Railway 환경 변수 설정

Railway Dashboard에서 다음 환경 변수를 설정해야 합니다:

```
KATAGO_PATH=/app/katago/katago
KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
KATAGO_HOME_PATH=/app/server/katago_home
```

추가 권장:
```
KATAGO_MODEL_URL=https://media.katagotraining.org/uploaded/networks/models/kata1/<latest-network>.bin.gz
```

또는 프로젝트 루트 기준:
```
KATAGO_PATH=/app/katago/katago
KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
```

### 4️⃣ Railway Start Command 설정

Railway Dashboard → Service → Settings → Start Command:

```bash
npm run start-server
```

또는 KataGo를 미리 다운로드하려면:

```bash
# KataGo binary 다운로드 (없는 경우)
if [ ! -f "/app/katago/katago" ]; then
  echo "Downloading KataGo CPU-only binary..."
  curl -L -o /tmp/katago.zip https://github.com/lightvector/katago/releases/download/v1.16.4/katago-v1.16.4-eigen-linux-x64.zip
  unzip -q /tmp/katago.zip -d /tmp/katago
  mkdir -p /app/katago
  # 압축 해제된 폴더 구조에 따라 경로 조정 필요
  find /tmp/katago -name "katago" -type f -exec cp {} /app/katago/katago \;
  chmod +x /app/katago/katago
  rm -rf /tmp/katago /tmp/katago.zip
fi

# 서버 시작
npm run start-server
```

### 5️⃣ 코드 수정 사항

#### A. `server/kataGoService.ts` 수정
- Railway 환경 감지 로직 개선
- Linux 경로 우선순위 조정
- CPU-only binary 사용 확인

#### B. 모델 파일 다운로드 로직 개선
- 이미 구현되어 있지만, Railway 환경에서 더 안정적으로 작동하도록 개선

#### C. 경로 설정 개선
- Railway 환경에서는 `/app/katago/katago` 경로 우선 사용
- 환경 변수로 오버라이드 가능

## 🔧 구현 단계

### Step 1: KataGo Linux CPU-only Binary 준비
1. 로컬에서 Linux binary 다운로드
2. 프로젝트에 포함할지, 아니면 시작 시 다운로드할지 결정

### Step 2: 코드 수정
- `server/kataGoService.ts`에서 Railway 환경 감지 및 경로 설정 개선
- 모델 파일 다운로드 로직 Railway 최적화

### Step 3: Railway 설정
- 환경 변수 설정
- Start Command 설정 (필요한 경우)

### Step 4: 테스트
- Railway에 배포 후 KataGo 정상 작동 확인

## ⚠️ 주의사항

1. **GPU 버전 사용 불가**: Railway는 GPU를 지원하지 않으므로 반드시 CPU-only 버전 사용
2. **파일 시스템**: Railway의 파일 시스템은 ephemeral이므로 시작 시 항상 파일 확인/다운로드 필요
3. **실행 권한**: Linux binary는 실행 권한이 있어야 함 (`chmod +x`)
4. **라이브러리 의존성**: CPU-only 버전은 OpenCL/CUDA 없이도 작동해야 함

## 📝 체크리스트

- [ ] KataGo Linux CPU-only binary 다운로드
- [ ] 프로젝트에 포함 또는 시작 시 다운로드 스크립트 작성
- [ ] `server/kataGoService.ts` Railway 경로 설정 수정
- [ ] Railway 환경 변수 설정
- [ ] Railway Start Command 설정 (필요한 경우)
- [ ] 배포 후 테스트

