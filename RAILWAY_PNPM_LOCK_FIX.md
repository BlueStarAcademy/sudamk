# Railway pnpm-lock.yaml 문제 해결

## 문제
`pnpm-lock.yaml` 파일이 없어서 `--frozen-lockfile` 옵션으로 설치할 수 없음

## 해결 방법

### 방법 1: Build Command에서 --frozen-lockfile 제거 (빠른 해결)

Railway 대시보드에서 Build Command를 수정:

**Frontend:**
```
corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/web build
```

**Backend:**
```
corepack enable && corepack prepare pnpm@8.10.0 --activate && pnpm install && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/api build
```

변경 사항: `pnpm install --frozen-lockfile` → `pnpm install`

### 방법 2: pnpm-lock.yaml 파일 생성 (권장)

로컬에서 `pnpm install`을 실행하여 `pnpm-lock.yaml` 파일을 생성한 후 Git에 커밋:

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "Add pnpm-lock.yaml"
git push origin develop
```

그러면 `--frozen-lockfile` 옵션을 사용할 수 있습니다.

## 참고

- `--frozen-lockfile`은 CI/CD 환경에서 의존성 버전을 고정하기 위해 사용됩니다
- `pnpm-lock.yaml`이 없으면 `pnpm install`만 사용해도 됩니다
- 방법 1이 더 빠르지만, 방법 2가 더 안전합니다

