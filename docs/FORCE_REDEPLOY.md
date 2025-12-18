# Railway 강제 재배포 방법

## 문제
GitHub에 푸시했지만 Railway가 자동 배포를 시작하지 않는 경우

## 해결 방법

### 방법 1: Railway 대시보드에서 수동 재배포 (가장 확실한 방법)

#### Frontend 서비스

1. **Railway 대시보드 접속**
2. **SUDAM Frontend** 서비스 선택
3. **Deployments** 탭 클릭
4. 최신 배포를 클릭하여 상세 보기
5. **Redeploy** 버튼 클릭 (우측 상단 또는 하단)
6. 또는 **Settings** → **Deploy** 탭 → **Redeploy** 버튼

#### Backend 서비스

1. **SUDAM Backend** 서비스 선택
2. **Deployments** 탭 클릭
3. **Redeploy** 버튼 클릭

#### KataGo 서비스

1. **KataGo** 서비스 선택
2. **Deployments** 탭 클릭
3. **Redeploy** 버튼 클릭

### 방법 2: Settings에서 설정 저장으로 재배포 트리거

각 서비스의 Settings에서 아무 설정이나 수정하고 Save하면 재배포가 시작됩니다.

#### Frontend

1. **SUDAM Frontend** → **Settings**
2. **Deploy** 섹션
3. **Start Command** 확인: `cd apps/web && pnpm start`
4. 아무 문자나 추가/삭제하거나 그대로 **Save** 클릭

#### Backend

1. **SUDAM Backend** → **Settings**
2. **Deploy** 섹션
3. **Start Command** 확인: `cd apps/api && node dist/index.js`
4. **Save** 클릭

### 방법 3: Railway CLI 사용

```bash
# Railway CLI 설치 (처음인 경우)
npm install -g @railway/cli

# Railway 로그인
railway login

# 프로젝트 연결
railway link

# 서비스별 재배포
railway up --service sudam-frontend
railway up --service sudam-backend
railway up --service katago
```

### 방법 4: GitHub Actions 사용 (있다면)

GitHub Actions가 설정되어 있다면:
1. GitHub 저장소 → **Actions** 탭
2. **Deploy** 워크플로우 선택
3. **Run workflow** 버튼 클릭

## 왜 자동 배포가 안 되는가?

### 가능한 원인

1. **Webhook 지연**
   - GitHub Webhook이 Railway에 전달되는 데 시간이 걸릴 수 있음
   - 보통 1-2분 내에 전달됨

2. **Railway 서비스 문제**
   - Railway 측의 일시적인 문제일 수 있음
   - 수동 재배포로 우회 가능

3. **브랜치 불일치**
   - Railway가 `main` 브랜치를 감시하고 있는데 `develop`에 푸시한 경우
   - Settings에서 브랜치 확인 필요

4. **서비스 비활성화**
   - 서비스가 일시 중지되어 있을 수 있음
   - 서비스 상태 확인

## 확인 체크리스트

- [ ] Railway 대시보드에서 서비스 상태 확인
- [ ] Settings → Source → Branch가 `develop`인지 확인
- [ ] Deployments 탭에서 최신 배포 시간 확인
- [ ] 수동으로 Redeploy 버튼 클릭
- [ ] 로그에서 에러 메시지 확인

## 추천 절차

1. **먼저 수동 재배포 시도** (가장 빠름)
2. **Settings에서 Save** (재배포 트리거)
3. **Railway CLI 사용** (고급 사용자)
4. **Railway 지원팀 문의** (여전히 안 되는 경우)

## 참고

- 수동 재배포는 즉시 작동합니다
- 빌드 시간은 2-5분 정도 소요됩니다
- 재배포 중에도 기존 서비스는 계속 실행됩니다

---

**가장 빠른 해결책**: Railway 대시보드에서 **Deployments** → **Redeploy** 버튼 클릭!

