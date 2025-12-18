# Railway 배포 문제 해결

## 현재 문제
Railway에서 "Could not find root directory: app" 에러 발생

## 해결 방법

### 1. Railway UI 설정 변경 (필수)

Railway 대시보드에서:

1. **SUDAM** 서비스 선택
2. **Settings** 탭 클릭
3. **Root Directory** 필드를 **비워두기** (빈 값)
   - 또는 `.` (점 하나)로 설정
   - **절대 `app`으로 설정하지 마세요!**
4. **Dockerfile Path**: `app/Dockerfile` (자동 감지되거나 수동 설정)
5. **Save** 클릭
6. **Deployments** 탭에서 **"Redeploy"** 클릭

### 2. 프로젝트 구조 확인

프로젝트 루트 구조:
```
프로젝트 루트/
├── railway.json          ← Railway 설정 파일
├── package.json          ← 루트 package.json
├── pnpm-workspace.yaml   ← pnpm workspace 설정
├── app/                  ← Next.js 앱 디렉토리
│   ├── Dockerfile        ← Dockerfile 위치
│   ├── package.json
│   └── src/
├── packages/             ← 공유 패키지
│   ├── database/
│   ├── game-logic/
│   └── shared/
└── apps/                 ← 다른 앱들
    ├── katago/
    └── gnugo/
```

### 3. railway.json 확인

프로젝트 루트의 `railway.json`:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "app/Dockerfile"
  },
  "deploy": {
    "startCommand": "node app/server.js"
  }
}
```

### 4. Dockerfile 경로

Dockerfile은 `app/Dockerfile`에 있으며, 프로젝트 루트를 기준으로 빌드합니다.

## 배포 후 확인

1. **로그 확인**: Deployments → View Logs
2. **헬스체크**: `https://your-app.railway.app/api/health`
3. **서비스 상태**: "Online"으로 표시되어야 함

## 추가 문제 해결

### 빌드 실패 시

1. **로그 확인**: 어떤 단계에서 실패했는지 확인
2. **의존성 문제**: `pnpm-lock.yaml`이 최신인지 확인
3. **빌드 명령**: Dockerfile의 빌드 단계 확인

### 서비스 시작 실패 시

1. **startCommand 확인**: `node app/server.js`가 올바른지 확인
2. **포트 확인**: `PORT` 환경 변수가 설정되어 있는지 확인
3. **의존성 확인**: 필요한 패키지가 모두 설치되었는지 확인

