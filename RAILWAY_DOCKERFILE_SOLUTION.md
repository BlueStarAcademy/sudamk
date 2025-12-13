# Railway Dockerfile 사용 방법

## 문제
Nixpacks가 GitHub에서 nixpkgs를 다운로드할 때 504 Gateway Timeout 오류가 계속 발생

## 해결 방법: Dockerfile 사용

Nixpacks 대신 Dockerfile을 사용하면 네트워크 타임아웃 문제를 피할 수 있습니다.

### Frontend 서비스 설정

1. Railway 대시보드 → **SUDAM Frontend** 서비스
2. **Settings** 탭 → **Build** 섹션
3. **Builder** 드롭다운에서 **Dockerfile** 선택
4. **Dockerfile Path** 필드에 입력: `Dockerfile.web`
5. **Root Directory**: `.` (프로젝트 루트)
6. **Deploy** 섹션 → **Start Command**: (비워두거나 Dockerfile의 CMD 사용)
7. **Save** 클릭

### Backend 서비스 설정

1. Railway 대시보드 → **SUDAM Backend** 서비스
2. **Settings** 탭 → **Build** 섹션
3. **Builder** 드롭다운에서 **Dockerfile** 선택
4. **Dockerfile Path** 필드에 입력: `Dockerfile.api`
5. **Root Directory**: `.` (프로젝트 루트)
6. **Deploy** 섹션 → **Start Command**: (비워두거나 Dockerfile의 CMD 사용)
7. **Save** 클릭

## 장점

- Nixpacks의 네트워크 타임아웃 문제를 피할 수 있음
- 빌드 과정을 완전히 제어할 수 있음
- pnpm을 직접 사용하여 workspace 의존성 문제 해결
- 더 빠르고 안정적인 빌드

## 참고

- `Dockerfile.web`과 `Dockerfile.api` 파일이 프로젝트 루트에 생성되었습니다
- Dockerfile은 pnpm을 직접 사용하여 의존성을 설치합니다
- `--frozen-lockfile` 옵션을 시도하지만, 실패하면 일반 `pnpm install`을 사용합니다

