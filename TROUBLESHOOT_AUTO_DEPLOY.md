# 자동 배포 문제 해결 가이드

## 자동 배포가 작동하지 않는 경우

### 1. Railway 서비스가 생성되지 않았을 수 있습니다

**확인 방법**:
- Railway 대시보드에 접속
- 프로젝트가 있는지 확인
- 서비스(Backend, Frontend)가 있는지 확인

**해결 방법**:
- 아직 Railway에 배포하지 않았다면, 먼저 초기 배포를 진행해야 합니다
- [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md)를 따라 초기 배포를 진행하세요

### 2. GitHub 저장소가 Railway에 연결되지 않았을 수 있습니다

**확인 방법**:
1. Railway 대시보드 → 프로젝트 선택
2. 서비스 선택 → "Settings" → "Source" 탭
3. GitHub 저장소가 연결되어 있는지 확인

**해결 방법**:
- 연결되지 않았다면:
  1. "Connect GitHub Repo" 클릭
  2. 저장소 선택 및 연결
  3. 브랜치 선택 (`develop` 또는 `main`)

### 3. 브랜치 설정이 잘못되었을 수 있습니다

**확인 방법**:
- 서비스 → "Settings" → "Source" → "Branch"
- 현재 설정된 브랜치 확인

**해결 방법**:
- 푸시한 브랜치와 Railway 설정 브랜치가 일치해야 합니다
- 예: `develop` 브랜치에 푸시했다면 Railway도 `develop` 브랜치로 설정

### 4. Webhook이 제대로 설정되지 않았을 수 있습니다

**확인 방법**:
1. GitHub 저장소 → "Settings" → "Webhooks"
2. Railway Webhook이 있는지 확인
3. 최근 배송(Deliveries) 확인

**해결 방법**:
- Webhook이 없다면:
  1. Railway에서 서비스를 다시 연결
  2. 또는 수동으로 Webhook 추가

### 5. Railway 서비스가 비활성화되었을 수 있습니다

**확인 방법**:
- Railway 대시보드에서 서비스 상태 확인
- 서비스가 일시 중지되었는지 확인

**해결 방법**:
- 서비스를 재시작하거나 활성화

## 단계별 확인 체크리스트

### ✅ 1단계: Railway 프로젝트 확인
- [ ] Railway 계정에 로그인됨
- [ ] 프로젝트가 생성됨
- [ ] Backend 서비스(`sudam-api`)가 있음
- [ ] Frontend 서비스(`sudam-web`)가 있음

### ✅ 2단계: GitHub 연결 확인
- [ ] 각 서비스의 "Settings" → "Source"에서 GitHub 저장소 연결됨
- [ ] 올바른 저장소가 연결됨
- [ ] 브랜치가 올바르게 설정됨 (`develop` 또는 `main`)

### ✅ 3단계: Webhook 확인
- [ ] GitHub 저장소 → Settings → Webhooks에서 Railway Webhook 존재
- [ ] 최근 배송(Deliveries)이 성공적으로 전송됨

### ✅ 4단계: 수동 배포 테스트
- [ ] Railway 대시보드에서 "Redeploy" 버튼 클릭
- [ ] 수동 배포가 작동하는지 확인
- [ ] 수동 배포가 작동하면 자동 배포도 작동해야 함

## 빠른 해결 방법

### 방법 1: 서비스 재연결

1. Railway 대시보드 → 서비스 선택
2. "Settings" → "Source"
3. "Disconnect" 클릭
4. "Connect GitHub Repo" 클릭
5. 저장소 다시 선택
6. 브랜치 선택 (`develop`)

### 방법 2: 수동 배포로 테스트

1. Railway 대시보드 → 서비스 선택
2. "Deployments" 탭
3. "Redeploy" 버튼 클릭
4. 배포가 성공하면 자동 배포도 작동해야 함

### 방법 3: Webhook 재설정

1. GitHub 저장소 → Settings → Webhooks
2. Railway Webhook 삭제
3. Railway에서 서비스를 다시 연결하면 Webhook이 자동 생성됨

## 자동 배포가 작동하는 조건

✅ **다음 조건이 모두 충족되어야 합니다:**

1. Railway에 서비스가 생성되어 있음
2. GitHub 저장소가 Railway에 연결되어 있음
3. 올바른 브랜치가 설정되어 있음
4. Webhook이 정상적으로 작동함
5. 서비스가 활성화되어 있음

## 여전히 작동하지 않는다면

1. **Railway 로그 확인**
   - 서비스 → "Logs" 탭
   - 에러 메시지 확인

2. **GitHub Webhook 로그 확인**
   - GitHub → Settings → Webhooks
   - 최근 배송(Deliveries) 확인
   - 실패한 요청이 있다면 에러 확인

3. **Railway 지원팀 문의**
   - Railway Discord 또는 지원팀에 문의

## 예상 시나리오

### 시나리오 1: 아직 Railway에 배포하지 않음
→ **해결**: [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md)를 따라 초기 배포 진행

### 시나리오 2: 서비스는 있지만 GitHub 연결 안 됨
→ **해결**: 서비스 Settings → Source에서 GitHub 저장소 연결

### 시나리오 3: 브랜치 불일치
→ **해결**: Railway Settings에서 브랜치를 `develop`으로 변경

### 시나리오 4: Webhook 문제
→ **해결**: 서비스를 재연결하여 Webhook 재설정

---

**팁**: 수동 배포가 작동한다면 자동 배포도 작동해야 합니다. 수동 배포부터 확인해보세요!

