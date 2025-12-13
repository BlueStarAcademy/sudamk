# Railway 네트워크 타임아웃 문제 해결

## 문제
Nixpacks가 GitHub에서 nixpkgs를 다운로드할 때 504 Gateway Timeout 오류 발생

## 해결 방법

### 방법 1: 재시도 (권장)
504 오류는 일시적인 네트워크 문제일 가능성이 높습니다. Railway 대시보드에서:
1. 각 서비스의 **Deployments** 탭
2. 실패한 배포에서 **Redeploy** 버튼 클릭
3. 또는 Settings에서 아무 설정이나 변경하고 Save

### 방법 2: Railway 대시보드에서 수동 재배포
1. Railway 대시보드 → 각 서비스
2. **Settings** 탭
3. Build Command 확인 후 **Save** 클릭 (재배포 시작)

### 방법 3: 잠시 대기 후 재시도
네트워크 문제가 해결될 때까지 몇 분 대기한 후 재배포

## 참고
- 504 Gateway Timeout은 GitHub 서버의 일시적인 문제일 수 있습니다
- Nixpacks는 빌드 시 GitHub에서 nixpkgs를 다운로드합니다
- 대부분의 경우 재시도하면 해결됩니다

## 확인
재배포 후 Build Logs에서:
- `nix-env` 명령이 성공적으로 실행되는지 확인
- `pnpm install`이 실행되는지 확인

