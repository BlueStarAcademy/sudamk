# Railway + Sentry 오류 모니터링

Sudam 서버는 `@sentry/node`로 프로덕션 예외를 Sentry에 보냅니다. Cursor Automation이 **Issue created** 시 fix-forward로 `main`에 푸시하면 Railway가 재배포합니다.

## Railway Variables (서비스에 설정)

| 변수 | 필수 | 설명 |
|------|------|------|
| `SENTRY_DSN` | 예 | Sentry 프로젝트 DSN |
| `SENTRY_ENVIRONMENT` | 권장 | `production` (미설정 시 Railway 환경명/`NODE_ENV`) |
| `SENTRY_RELEASE` | 선택 | 미설정 시 `RAILWAY_GIT_COMMIT_SHA` |
| `SENTRY_SMOKE_SECRET` | 선택 | 설정 시에만 `GET /api/admin/sentry-smoke` + 헤더 `x-sentry-smoke-secret` 로 의도적 500 테스트 |

## Auto Deploy

`main` 푸시 → 해당 서비스 Auto Deploy가 켜져 있어야 합니다. 자세한 설정은 [RAILWAY_AUTO_DEPLOY_FIX.md](./RAILWAY_AUTO_DEPLOY_FIX.md) 참고.

## 정책

- **롤백 금지**: 오류 시 이전 배포로 되돌리지 않고 코드 수정 후 새 커밋 배포 (fix-forward).
- Health (`/api/health`, `/`) 관련 이벤트는 Sentry로 보내지 않습니다.
