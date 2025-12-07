# Railway 배포 문제 해결 가이드

배포가 전혀 안되는 경우 다음 순서대로 확인하세요.

## 1단계: Railway 대시보드 기본 확인

### 1.1 프로젝트 및 서비스 확인
1. **Railway 대시보드** 접속: https://railway.app/dashboard
2. 프로젝트가 생성되어 있는지 확인
3. 다음 서비스들이 있는지 확인:
   - **Backend** 서비스
   - **Frontend** 서비스 (선택사항)
   - **KataGo** 서비스 (선택사항)
   - **PostgreSQL** 데이터베이스

### 1.2 서비스 상태 확인
각 서비스의 **Deployments** 탭에서:
- 최근 배포가 있는지 확인
- 배포 상태가 무엇인지 확인:
  - ✅ **Success**: 배포 성공
  - ⏳ **Building**: 빌드 중
  - ❌ **Failed**: 배포 실패
  - ⚠️ **Deploying**: 배포 중

### 1.3 배포 실패 시 로그 확인
1. 실패한 배포 클릭
2. **Logs** 탭 확인
3. 에러 메시지 확인:
   - 빌드 에러
   - 환경 변수 누락
   - 포트 충돌
   - Dockerfile 경로 오류

## 2단계: Git 저장소 연결 확인

### 2.1 Railway와 GitHub 연결 확인
1. **Railway 프로젝트** → **Settings** → **Service Source**
2. GitHub 저장소가 연결되어 있는지 확인
3. 브랜치가 `main`인지 확인
4. 저장소 URL이 올바른지 확인: `https://github.com/BlueStarAcademy/sudamk`

### 2.2 로컬 Git 상태 확인
```powershell
# 현재 브랜치 확인
git branch

# 원격 저장소 확인
git remote -v

# 최근 커밋 확인
git log --oneline -5

# 푸시 상태 확인
git status
```

### 2.3 GitHub에 푸시 확인
1. **GitHub 저장소** 접속: https://github.com/BlueStarAcademy/sudamk
2. 최근 커밋이 있는지 확인
3. `main` 브랜치에 최신 코드가 있는지 확인

## 3단계: Railway 서비스 설정 확인

### 3.1 Backend 서비스 설정
1. **Backend 서비스** → **Settings**
2. 다음 항목 확인:
   - **Root Directory**: 비워두기 (프로젝트 루트 사용)
   - **Dockerfile Path**: `Dockerfile.backend` (또는 자동 감지)
   - **Start Command**: `npm run start-server` (자동 설정됨)

### 3.2 Frontend 서비스 설정 (있는 경우)
1. **Frontend 서비스** → **Settings**
2. 다음 항목 확인:
   - **Root Directory**: 비워두기
   - **Dockerfile Path**: `Dockerfile.frontend`
   - **Start Command**: `npm run start-frontend`

### 3.3 KataGo 서비스 설정 (있는 경우)
1. **KataGo 서비스** → **Settings**
2. 다음 항목 확인:
   - **Root Directory**: 비워두기
   - **Dockerfile Path**: `Dockerfile.katago`
   - **Start Command**: `npm run start-katago`

## 4단계: 환경 변수 확인

### 4.1 Backend 서비스 환경 변수
**Backend 서비스** → **Variables**에서 확인:
- `DATABASE_URL` 또는 `RAILWAY_SERVICE_POSTGRES_URL` (PostgreSQL 연결)
- `PORT=4000` (선택사항, 기본값 사용 가능)
- `NODE_ENV=production` (선택사항)
- `KATAGO_API_URL` (KataGo 서비스 URL, 예: `https://katago-production.up.railway.app/api/katago/analyze`)

### 4.2 Frontend 서비스 환경 변수 (있는 경우)
**Frontend 서비스** → **Variables**에서 확인:
- `VITE_API_URL` (Backend 서비스 URL, 예: `https://backend-production.up.railway.app`)
- `VITE_WS_URL` (WebSocket URL, 예: `wss://backend-production.up.railway.app`)

### 4.3 KataGo 서비스 환경 변수 (있는 경우)
**KataGo 서비스** → **Variables**에서 확인:
- `PORT=4001` (선택사항)
- `ALLOWED_ORIGINS` (Backend 서비스 URL, 선택사항)

## 5단계: 배포 트리거 확인

### 5.1 자동 배포 활성화 확인
1. **Railway 프로젝트** → **Settings** → **Deployments**
2. **Auto Deploy**가 활성화되어 있는지 확인
3. **Branch**가 `main`인지 확인

### 5.2 수동 배포 시도
1. **Backend 서비스** → **Deployments**
2. **Deploy** 또는 **Redeploy** 버튼 클릭
3. 배포 로그 확인

## 6단계: 로그 확인

### 6.1 빌드 로그 확인
1. **Backend 서비스** → **Deployments** → 최근 배포 클릭
2. **Logs** 탭에서 빌드 과정 확인:
   - Docker 빌드 시작
   - 의존성 설치
   - Prisma 클라이언트 생성
   - Vite 빌드 (Frontend)
   - 이미지 빌드 완료

### 6.2 런타임 로그 확인
1. **Backend 서비스** → **Logs** 탭
2. 서버 시작 메시지 확인:
   - `[Server] Server listening on port 4000`
   - `[Server] Health check endpoint is available at /api/health`
   - `[DB] Database initialized successfully`

### 6.3 에러 로그 확인
다음 에러가 있는지 확인:
- `Cannot find module`: 모듈 누락
- `DATABASE_URL is not set`: 환경 변수 누락
- `Port already in use`: 포트 충돌
- `Build failed`: 빌드 실패

## 7단계: 일반적인 문제 해결

### 문제 1: 배포가 시작되지 않음
**원인**: Git 저장소 연결 문제 또는 자동 배포 비활성화
**해결**:
1. Railway → Settings → Service Source 확인
2. GitHub 저장소 재연결
3. 수동 배포 시도

### 문제 2: 빌드 실패
**원인**: Dockerfile 경로 오류 또는 빌드 에러
**해결**:
1. Settings → Dockerfile Path 확인
2. 빌드 로그에서 에러 메시지 확인
3. Dockerfile이 올바른 위치에 있는지 확인

### 문제 3: 서비스가 시작되지 않음
**원인**: 환경 변수 누락 또는 포트 충돌
**해결**:
1. Variables에서 필수 환경 변수 확인
2. 로그에서 에러 메시지 확인
3. Start Command 확인

### 문제 4: 헬스체크 실패
**원인**: 서버가 리스닝을 시작하지 않음
**해결**:
1. 로그에서 `Server listening on port` 메시지 확인
2. 헬스체크 엔드포인트 `/api/health` 확인
3. 서버 시작 로직 확인

## 8단계: 빠른 진단 명령어

로컬에서 확인할 수 있는 명령어:

```powershell
# Git 상태 확인
git status
git log --oneline -5

# 원격 저장소 확인
git remote -v

# 최신 커밋 푸시
git push origin main

# Railway CLI로 상태 확인 (설치된 경우)
railway status
railway logs
```

## 9단계: 지원 정보 수집

문제가 계속되면 다음 정보를 수집하세요:

1. **Railway 대시보드 스크린샷**:
   - 서비스 목록
   - 배포 상태
   - 에러 로그

2. **Git 상태**:
   ```powershell
   git status
   git log --oneline -10
   ```

3. **환경 변수 목록** (민감 정보 제외):
   - Backend 서비스 Variables 스크린샷

4. **에러 로그**:
   - 빌드 로그
   - 런타임 로그

## 체크리스트 요약

배포 문제 해결을 위해 다음을 확인하세요:

- [ ] Railway 대시보드에서 서비스가 있는지 확인
- [ ] 최근 배포가 있는지 확인
- [ ] 배포 상태 (Success/Failed/Building) 확인
- [ ] Git 저장소가 Railway에 연결되어 있는지 확인
- [ ] GitHub에 최신 코드가 푸시되어 있는지 확인
- [ ] Dockerfile Path가 올바른지 확인
- [ ] 필수 환경 변수가 설정되어 있는지 확인
- [ ] 빌드 로그에서 에러가 있는지 확인
- [ ] 런타임 로그에서 서버가 시작되는지 확인
- [ ] 헬스체크가 통과하는지 확인

## 다음 단계

위 체크리스트를 확인한 후, 구체적인 에러 메시지나 문제 상황을 알려주시면 더 정확한 해결책을 제시할 수 있습니다.

