# Railway Dockerfile 경로 설정 가이드

Railway에서 Dockerfile 경로를 설정하는 방법은 여러 가지가 있습니다.

## 방법 1: railway.json 파일 사용 (가장 쉬움) ✅

각 서비스별로 `railway.json` 파일을 사용하면 Railway가 자동으로 Dockerfile 경로를 인식합니다.

### Frontend 서비스

1. 서비스 생성 후, 프로젝트 루트에 `railway.json` 파일이 있는지 확인
2. 없으면 `railway.json.frontend` 파일의 내용을 복사하여 `railway.json`으로 저장
3. Railway가 자동으로 인식합니다

**또는 Git에 푸시:**
- `railway.json.frontend` 파일을 각 서비스의 루트 디렉토리에 `railway.json`으로 배치
- Railway는 저장소의 `railway.json` 파일을 자동으로 읽습니다

### Backend 서비스

- `railway.json.backend` → `railway.json`으로 복사

### KataGo 서비스

- `railway.json.katago` → `railway.json`으로 복사

## 방법 2: Railway UI에서 직접 설정

### 최신 Railway UI (2024)

1. **서비스 선택** → **Settings** 탭
2. **Deploy** 섹션으로 스크롤
3. **Build Settings** 또는 **Build** 섹션 찾기
4. **Dockerfile Path** 또는 **Dockerfile** 필드에 입력:
   - Frontend: `Dockerfile.frontend`
   - Backend: `Dockerfile.backend`
   - KataGo: `Dockerfile.katago`

### UI에서 찾을 수 없는 경우

1. **Settings** → **Build** 탭 확인
2. **Settings** → **Deploy** → **Source** 섹션 확인
3. **Settings** → **General** → **Build Command** 섹션 확인

## 방법 3: 환경 변수 사용

Railway는 환경 변수를 통해 Dockerfile 경로를 지정할 수 있습니다:

1. **Settings** → **Variables**
2. 새 변수 추가:
   - Key: `DOCKERFILE_PATH`
   - Value: `Dockerfile.frontend` (또는 `Dockerfile.backend`, `Dockerfile.katago`)

## 방법 4: 서비스별 디렉토리 구조 사용

각 서비스를 별도 디렉토리로 분리하는 방법:

```
project/
├── frontend/
│   ├── Dockerfile
│   ├── railway.json
│   └── ...
├── backend/
│   ├── Dockerfile
│   ├── railway.json
│   └── ...
└── katago/
    ├── Dockerfile
    ├── railway.json
    └── ...
```

이 경우 Railway에서 각 서비스의 루트 디렉토리를 지정하면 됩니다.

## 추천 방법

**가장 간단한 방법:**
1. 각 서비스 생성 시 같은 저장소를 연결
2. Railway가 자동으로 `railway.json` 파일을 찾도록 함
3. 각 서비스별로 `railway.json.frontend`, `railway.json.backend`, `railway.json.katago`를 Git에 푸시
4. Railway 서비스 설정에서 "Source"를 해당 `railway.json` 파일로 지정

**또는:**
- 각 서비스의 루트에 `railway.json` 파일을 배치 (서비스별로 다른 파일명 사용 불가)
- Railway는 프로젝트 루트의 `railway.json`만 인식하므로, 서비스별로 다른 설정이 필요하면 환경 변수나 UI 설정 사용

## 문제 해결

### Dockerfile Path 입력칸이 보이지 않는 경우

1. **Railway UI 업데이트 확인**: Railway는 UI를 자주 업데이트합니다
2. **Settings → Build 섹션 확인**: 최신 UI에서는 "Build" 섹션에 있을 수 있습니다
3. **railway.json 파일 사용**: UI에서 찾을 수 없으면 `railway.json` 파일을 사용하는 것이 가장 확실합니다
4. **Railway 지원팀 문의**: 문제가 지속되면 Railway 지원팀에 문의하세요

### railway.json 파일이 인식되지 않는 경우

1. 파일이 프로젝트 루트에 있는지 확인
2. 파일 이름이 정확히 `railway.json`인지 확인 (대소문자 구분)
3. JSON 형식이 올바른지 확인
4. Git에 푸시되었는지 확인

