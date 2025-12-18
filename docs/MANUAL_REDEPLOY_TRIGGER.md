# Railway 수동 재배포 트리거 방법

## 문제
Git에 푸시했지만 Railway가 자동으로 재배포를 감지하지 못하는 경우

## 해결 방법

### 방법 1: 빈 커밋으로 재배포 트리거 (가장 간단)

```bash
git commit --allow-empty -m "Trigger Railway redeploy"
git push origin develop
```

이렇게 하면 Railway가 변경사항을 감지하여 자동으로 재배포를 시작합니다.

### 방법 2: Railway 대시보드에서 수동 재배포

1. **Railway 대시보드 접속**
2. **각 서비스 선택** (Frontend, Backend, KataGo)
3. **Deployments 탭** 클릭
4. **Redeploy** 버튼 클릭 (있는 경우)
5. 또는 **Settings** → **Deploy** → **Redeploy** 버튼

### 방법 3: Settings 변경으로 재배포 트리거

각 서비스의 Settings에서 아무 설정이나 변경하고 Save하면 재배포가 시작됩니다.

**Frontend 서비스:**
1. Railway 대시보드 → **SUDAM Frontend** 서비스
2. **Settings** 탭
3. **Root Directory** 확인/수정: `.`
4. **Save** 클릭 (재배포 시작)

**Backend 서비스:**
1. Railway 대시보드 → **SUDAM Backend** 서비스
2. **Settings** 탭
3. **Root Directory** 확인/수정: `.`
4. **Save** 클릭 (재배포 시작)

## 자동 배포가 작동하지 않는 경우 확인사항

### 1. 브랜치 설정 확인

Railway에서 각 서비스의 브랜치가 `develop`으로 설정되어 있는지 확인:

1. 서비스 → **Settings** → **Source** 탭
2. **Branch** 설정이 `develop`인지 확인
3. `main`으로 되어 있다면 `develop`으로 변경

### 2. GitHub Webhook 확인

1. GitHub 저장소 → **Settings** → **Webhooks**
2. Railway Webhook이 있는지 확인
3. 최근 배송(Deliveries)이 성공했는지 확인

### 3. 서비스 연결 확인

1. Railway 대시보드 → 서비스 선택
2. **Settings** → **Source** 탭
3. GitHub 저장소가 연결되어 있는지 확인
4. 연결되지 않았다면 **Connect GitHub Repo** 클릭

## 빠른 체크리스트

- [ ] Git에 푸시 완료
- [ ] Railway에서 브랜치가 `develop`으로 설정됨
- [ ] GitHub Webhook이 정상 작동 중
- [ ] 서비스가 GitHub 저장소에 연결됨
- [ ] 빈 커밋으로 재배포 트리거 시도

## 참고

- Railway는 기본적으로 `main` 또는 `master` 브랜치를 감지합니다
- `develop` 브랜치를 사용하려면 각 서비스의 Settings에서 브랜치를 변경해야 합니다
- 빈 커밋 방법이 가장 빠르고 확실합니다

---

**마지막 업데이트**: 2024-12-19

