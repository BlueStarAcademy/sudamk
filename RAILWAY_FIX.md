# Railway 배포 문제 해결 가이드

## 문제: "Could not find root directory: app"

Railway UI에서 Root Directory를 `app`으로 설정하면 발생하는 문제입니다.

## 해결 방법

### 방법 1: Railway UI에서 Root Directory 설정 변경 (권장)

1. Railway 대시보드에서 **SUDAM** 서비스 선택
2. **Settings** 탭 클릭
3. **Root Directory** 필드를 **비워두거나** `.` (프로젝트 루트)로 설정
4. **Dockerfile Path** 확인: `app/Dockerfile` (또는 자동 감지)
5. 저장 후 재배포

### 방법 2: railway.json 확인

프로젝트 루트의 `railway.json` 파일이 올바른지 확인:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "app/Dockerfile"
  },
  "deploy": {
    "startCommand": "node app/server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 60,
    "healthcheckInterval": 60
  }
}
```

### 방법 3: Railway CLI 사용

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 서비스 선택
railway service

# 배포 설정 확인
railway variables
```

## 확인 사항

1. **프로젝트 구조**: 프로젝트 루트에 `app/` 디렉토리가 있어야 함
2. **Dockerfile 위치**: `app/Dockerfile`이 존재해야 함
3. **railway.json 위치**: 프로젝트 루트에 있어야 함
4. **Git 저장소**: 변경사항이 GitHub에 푸시되어 있어야 함

## 배포 후 확인

배포가 성공하면:
- 서비스 상태가 "Online"으로 표시됨
- `/api/health` 엔드포인트가 응답함
- 로그에 에러가 없어야 함

