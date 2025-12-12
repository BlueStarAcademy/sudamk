# 다른 PC에서 작업 이어서 하기

## 빠른 시작 가이드

### 1. 저장소 클론/풀

```bash
# 처음 클론하는 경우
git clone https://github.com/BlueStarAcademy/sudamk.git
cd sudamk
git checkout develop

# 이미 클론되어 있는 경우
git pull origin develop
```

### 2. 의존성 설치

```bash
# 루트에서
pnpm install

# 또는 각 패키지별로
cd apps/api && pnpm install
cd ../web && pnpm install
cd ../../packages/database && pnpm install
```

### 3. 환경 변수 설정

`.env` 파일을 생성하거나 기존 환경 변수를 설정합니다:

```env
# .env 파일 예시
DATABASE_URL=postgresql://...
OLD_DATABASE_URL=postgresql://...  # 마이그레이션용
NEXT_PUBLIC_API_URL=http://localhost:4000
JWT_SECRET=your-secret-key
```

### 4. 현재 진행 상황 확인

```bash
# 진행 상황 문서 확인
cat docs/PROGRESS.md
cat docs/DAILY_LOG.md

# 최근 커밋 확인
git log --oneline -10
```

## Cursor AI에서 작업 이어서 하기

### 방법 1: 간단한 요청

```
깃에서 풀해와서 진행 중이던 작업을 이어서 해줘
```

또는

```
최신 코드를 풀하고 다음 작업을 진행해줘
```

### 방법 2: 구체적인 요청

```
1. 깃에서 최신 코드를 풀해줘
2. 현재 진행 상황을 확인해줘
3. 다음 단계 작업을 진행해줘
```

### 방법 3: 특정 작업 요청

```
깃 풀하고 [특정 작업]을 진행해줘
예: 깃 풀하고 에러 바운더리를 구현해줘
```

## 작업 이어서 하기 체크리스트

### 필수 단계

- [ ] Git에서 최신 코드 pull
- [ ] 의존성 설치 (`pnpm install`)
- [ ] 환경 변수 설정 확인
- [ ] 진행 상황 문서 확인 (`docs/PROGRESS.md`)

### 선택 단계

- [ ] 데이터베이스 마이그레이션 실행 (필요한 경우)
- [ ] 개발 서버 실행 테스트
- [ ] 최근 변경사항 확인

## 현재 프로젝트 상태

### 진행률

- **Phase 1**: 완료 (100%)
- **Phase 2**: 진행 중 (75%)
- **Phase 3**: 진행 중 (85%)
- **Phase 4**: 진행 중 (30%)
- **Phase 5**: 시작 전 (0%)

### 다음 우선순위 작업

1. 에러 바운더리 구현 (프론트엔드)
2. 나머지 게임 모드 구현 (백엔드)
3. 통합 테스트 준비 (Phase 5)

### 주요 파일 위치

- **진행 상황**: `docs/PROGRESS.md`
- **일일 로그**: `docs/DAILY_LOG.md`
- **이슈 추적**: `docs/ISSUES.md`
- **마이그레이션 가이드**: `docs/MIGRATION_GUIDE.md`

## 개발 서버 실행

### 백엔드 (API)

```bash
cd apps/api
pnpm dev
```

### 프론트엔드 (Web)

```bash
cd apps/web
pnpm dev
```

### 전체 실행 (Turborepo)

```bash
# 루트에서
pnpm dev
```

## 문제 해결

### 의존성 오류

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

### 타입 오류

```bash
# 타입 생성
pnpm db:generate
```

### 데이터베이스 연결 오류

- `.env` 파일의 `DATABASE_URL` 확인
- 데이터베이스 서버가 실행 중인지 확인
- 네트워크 연결 확인

## Git 워크플로우

### 기본 브랜치

- `develop`: 개발 브랜치 (기본 작업 브랜치)
- `main`: 프로덕션 브랜치

### 커밋 규칙

```
[Phase X] [frontend/backend] 작업 내용

예:
[Phase 3] [frontend] 에러 바운더리 구현
[Phase 2] [backend] 게임 모드 추가
```

### 푸시 전 확인

```bash
# 변경사항 확인
git status

# 커밋 전 lint 체크
pnpm lint

# 커밋 및 푸시
git add .
git commit -m "[Phase X] 작업 내용"
git push origin develop
```

## 유용한 명령어

```bash
# 진행 상황 확인
cat docs/PROGRESS.md | grep "진행률"

# 최근 작업 확인
git log --oneline -20

# 변경된 파일 확인
git diff HEAD~1

# 특정 파일의 변경 이력
git log --follow -- docs/PROGRESS.md
```

## Cursor AI와의 협업 팁

1. **명확한 요청**: "깃 풀하고 다음 작업 진행해줘"처럼 명확하게 요청
2. **컨텍스트 제공**: 특정 파일이나 기능에 대해 작업할 때 경로나 이름 명시
3. **단계별 확인**: 큰 작업은 단계별로 확인하며 진행
4. **문서 업데이트**: 작업 완료 후 `PROGRESS.md` 업데이트 요청

## 다음 작업 시작하기

다른 PC에서 작업을 시작할 때는 다음과 같이 요청하세요:

```
깃에서 풀해와서 진행 중이던 작업을 이어서 해줘
```

또는

```
최신 코드를 풀하고 docs/PROGRESS.md를 확인한 다음 다음 작업을 진행해줘
```

AI가 자동으로:
1. Git pull 실행
2. 진행 상황 확인
3. 다음 우선순위 작업 파악
4. 작업 진행

