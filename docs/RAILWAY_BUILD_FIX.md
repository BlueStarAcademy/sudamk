# Railway 빌드 실패 해결 가이드

## 문제 증상

Railway에서 SUDAM 서버 빌드가 실패하고, 에러 로그에 다음과 같은 내용이 나타남:

```
Using Detected Dockerfile
...
pnpm install
packages/database
packages/game-logic
Next.js build
```

하지만 현재 프로젝트는:
- `npm` 사용 (pnpm 아님)
- Express 기반 서버 (Next.js 아님)
- 단일 레포 구조 (monorepo 아님)

## 원인

Railway가 잘못된 Dockerfile을 자동 감지하고 있습니다. `railway.json.backend` 파일에 올바른 Dockerfile 경로가 설정되어 있지만, Railway 서비스 설정에서 Dockerfile 경로가 올바르게 적용되지 않았을 수 있습니다.

## 해결 방법

### 방법 1: Railway 대시보드에서 Dockerfile 경로 명시 (권장)

1. Railway 대시보드 접속
2. SUDAM 서비스 (Backend 서비스) 선택
3. **Settings** 탭 클릭
4. **Build** 섹션으로 스크롤
5. **Builder** 확인:
   - `DOCKERFILE` 선택되어 있어야 함
6. **Dockerfile Path** 필드 확인:
   - 정확히 `Dockerfile.backend` 입력 (대소문자 구분)
   - 공백 없이 입력
7. **Save** 클릭
8. 새 배포 트리거:
   - **Deployments** 탭 → **Deploy** 버튼
   - 또는 Git에 새로운 커밋 푸시

### 방법 2: railway.json 파일 확인

프로젝트 루트에 `railway.json` 파일이 있는지 확인:

```bash
# 프로젝트 루트에서
ls -la railway.json
```

만약 `railway.json` 파일이 있다면:
- 내용 확인
- `railway.json.backend`의 내용과 비교
- 필요시 `railway.json.backend`의 내용으로 덮어쓰기

또는:
- `railway.json` 파일 삭제
- Railway가 각 서비스별 `railway.json.*` 파일을 사용하도록 함

### 방법 3: 서비스별 railway.json 파일 배치

각 서비스에 해당하는 `railway.json` 파일을 프로젝트 루트에 복사:

**Backend 서비스:**
```bash
cp railway.json.backend railway.json
git add railway.json
git commit -m "fix: Set correct Dockerfile path for backend service"
git push
```

**주의:** 이 방법을 사용하면 다른 서비스(KataGo, GnuGo)에서 문제가 발생할 수 있으므로, 방법 1(대시보드에서 직접 설정)을 권장합니다.

## 확인 사항

### Dockerfile 파일 목록

현재 프로젝트에는 다음 Dockerfile들이 있습니다:

- `Dockerfile.backend` - Backend 서비스용 (Express + Vite 빌드)
- `Dockerfile.frontend` - Frontend 서비스용 (별도 서비스인 경우)
- `Dockerfile.katago` - KataGo 서비스용
- `Dockerfile.gnugo` - GnuGo 서비스용

### railway.json.backend 내용

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.backend"
  },
  "deploy": {
    "startCommand": "npm run start-server",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## 추가 문제 해결

### 빌드 캐시 클리어

Railway 대시보드에서:
1. **Settings** → **Build** 탭
2. **Clear Build Cache** 옵션 확인 (있는 경우)
3. 재배포

### 서비스 재생성

위 방법들이 작동하지 않으면:
1. 기존 서비스 삭제 (데이터 백업 확인)
2. 새 서비스 생성
3. **Settings** → **Build**에서 Dockerfile 경로 명시
4. 환경 변수 재설정

## 참고

- Railway는 기본적으로 루트 디렉토리의 `Dockerfile` 파일을 자동 감지합니다
- 여러 Dockerfile이 있는 경우 명시적으로 경로를 지정해야 합니다
- `railway.json` 파일이 있으면 Railway가 이를 읽지만, 대시보드 설정이 우선순위가 높을 수 있습니다

