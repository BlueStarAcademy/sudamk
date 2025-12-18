# Railway 배포 빠른 수정 가이드

## 문제
"Could not find root directory: app" 에러

## 즉시 해결 방법

### Railway UI에서 설정 변경

1. **Railway 대시보드** 접속
2. **SUDAM** 서비스 선택
3. **Settings** 탭 클릭
4. **Root Directory** 필드를 **완전히 비우기** (빈 값)
5. **Save** 클릭
6. **Deployments** 탭 → **"Redeploy"** 클릭

### 중요 사항

- ❌ **Root Directory를 `app`으로 설정하지 마세요!**
- ✅ **Root Directory를 비워두거나 `.`로 설정하세요**
- ✅ **Dockerfile Path는 `app/Dockerfile`로 유지**

## 변경사항 확인

프로젝트 루트에 다음 파일들이 있어야 합니다:
- ✅ `railway.json` (프로젝트 루트)
- ✅ `app/Dockerfile`
- ✅ `package.json` (프로젝트 루트)
- ✅ `pnpm-workspace.yaml`

## 배포 후 확인

1. **로그 확인**: Deployments → View Logs
2. **상태 확인**: "Online"으로 표시되어야 함
3. **헬스체크**: `https://your-app.railway.app/api/health`

## 여전히 실패하는 경우

1. **로그 확인**: 어떤 단계에서 실패했는지 확인
2. **GitHub 푸시 확인**: 최신 코드가 푸시되었는지 확인
3. **환경 변수 확인**: `DATABASE_URL`, `JWT_SECRET` 등 필수 변수 설정

