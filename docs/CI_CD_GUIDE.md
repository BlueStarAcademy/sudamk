# CI/CD 가이드

이 문서는 SUDAM v2 프로젝트의 CI/CD 파이프라인 설정과 사용 방법을 설명합니다.

## GitHub Actions 워크플로우

### 1. CI 워크플로우 (`.github/workflows/ci.yml`)

모든 PR과 main/develop 브랜치에 푸시될 때 자동으로 실행됩니다.

**작업:**
- **Lint**: 코드 스타일 검사
- **Type Check**: TypeScript 타입 검사
- **Test**: 모든 테스트 실행 (PostgreSQL 서비스 포함)
- **Build**: 프로젝트 빌드

**트리거:**
- `push` to `main` or `develop`
- `pull_request` to `main` or `develop`

### 2. Deploy 워크플로우 (`.github/workflows/deploy.yml`)

main 브랜치에 푸시될 때 프로덕션 배포를 실행합니다.

**작업:**
- 프로젝트 빌드
- Railway에 배포 (Backend & Frontend)

**트리거:**
- `push` to `main`
- `workflow_dispatch` (수동 실행)

### 3. Test Coverage 워크플로우 (`.github/workflows/test-coverage.yml`)

테스트 커버리지 리포트를 생성하고 Codecov에 업로드합니다.

**작업:**
- 테스트 실행 (커버리지 포함)
- Codecov에 커버리지 리포트 업로드

**트리거:**
- `push` to `main` or `develop`
- `pull_request` to `main` or `develop`
- 매주 월요일 (스케줄)

## 환경 변수 설정

GitHub 저장소의 Settings > Secrets에서 다음 환경 변수를 설정해야 합니다:

### 필수 환경 변수

- `DATABASE_URL`: 테스트 데이터베이스 URL (CI용)
- `RAILWAY_TOKEN`: Railway 배포 토큰 (배포용)

### 선택적 환경 변수

- `CODECOV_TOKEN`: Codecov 토큰 (커버리지 리포트용)

## 로컬에서 CI 테스트

CI 파이프라인을 로컬에서 테스트하려면:

```bash
# Docker로 PostgreSQL 실행
docker run -d \
  --name postgres-test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sudam_test \
  -p 5432:5432 \
  postgres:15

# 환경 변수 설정
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sudam_test
export NODE_ENV=test

# CI 단계 실행
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:push
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

## 배포 프로세스

### 자동 배포

1. `main` 브랜치에 푸시
2. CI 테스트 통과
3. Deploy 워크플로우 자동 실행
4. Railway에 배포

### 수동 배포

GitHub Actions에서 Deploy 워크플로우를 수동으로 실행할 수 있습니다.

## PR 체크리스트

PR을 생성할 때 다음을 확인하세요:

- [ ] 모든 테스트 통과
- [ ] Lint 오류 없음
- [ ] TypeScript 타입 오류 없음
- [ ] 빌드 성공
- [ ] 문서 업데이트 (필요시)

## 문제 해결

### CI 실패 시

1. 로컬에서 동일한 명령어 실행
2. 에러 로그 확인
3. 문제 해결 후 다시 푸시

### 배포 실패 시

1. Deploy 워크플로우 로그 확인
2. Railway 대시보드에서 상태 확인
3. 환경 변수 확인

## 참고 자료

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Railway 문서](https://docs.railway.app/)
- [Codecov 문서](https://docs.codecov.com/)

