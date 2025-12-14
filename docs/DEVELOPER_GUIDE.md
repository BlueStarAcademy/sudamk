# 개발자 가이드

SUDAM v2 프로젝트 개발을 위한 가이드입니다.

## 시작하기

### 필수 요구사항

- Node.js 20+
- pnpm 8.10.0+
- PostgreSQL 15+

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/sudam-v2.git
cd sudam-v2

# 의존성 설치
pnpm install

# Prisma 클라이언트 생성
pnpm db:generate

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집
```

### 개발 서버 실행

```bash
# 백엔드와 프론트엔드 동시 실행
pnpm dev

# 또는 개별 실행
cd apps/api && pnpm dev
cd apps/web && pnpm dev
```

## 프로젝트 구조

### Monorepo 구조

```
sudam-v2/
├── apps/
│   ├── api/              # 백엔드 (Fastify + tRPC)
│   └── web/              # 프론트엔드 (Next.js)
├── packages/
│   ├── shared/           # 공유 타입
│   ├── database/         # Prisma 클라이언트
│   └── game-logic/       # 게임 로직
└── scripts/               # 유틸리티 스크립트
```

### 코드 구조

#### 백엔드 (`apps/api/src`)

- `auth/` - 인증 관련 (JWT, 비밀번호 해싱)
- `background/` - 백그라운드 작업 (게임 루프, 액션 포인트)
- `game/` - 게임 로직 및 상태 관리
- `plugins/` - Fastify 플러그인
- `repositories/` - 데이터베이스 레이어
- `trpc/` - tRPC 라우터 및 설정
- `utils/` - 유틸리티 함수
- `websocket/` - WebSocket 서버

#### 프론트엔드 (`apps/web/src`)

- `app/` - Next.js App Router 페이지
- `components/` - React 컴포넌트
- `hooks/` - 커스텀 훅
- `lib/` - 라이브러리 설정 (tRPC, 인증)
- `providers/` - React 컨텍스트 프로바이더
- `stores/` - Zustand 스토어

## 개발 워크플로우

### 브랜치 전략

- `main` - 프로덕션 브랜치
- `develop` - 개발 브랜치
- `feature/*` - 기능 개발 브랜치
- `fix/*` - 버그 수정 브랜치

### 커밋 메시지 형식

```
[Phase X] [카테고리] 작업 내용

- 구체적인 변경 사항
- 해결한 문제
```

카테고리: `setup`, `backend`, `frontend`, `database`, `game`, `fix`, `docs`, `test`

### PR 프로세스

1. 기능 브랜치 생성
2. 개발 및 테스트
3. PR 생성 (템플릿 사용)
4. 코드 리뷰
5. CI 통과 확인
6. 머지

## 코딩 스타일

### TypeScript

- 엄격 모드 사용
- 타입 명시 (any 지양)
- 인터페이스 우선 사용

### 네이밍

- 파일: kebab-case (`user-repository.ts`)
- 클래스: PascalCase (`UserRepository`)
- 함수/변수: camelCase (`getUserById`)
- 상수: UPPER_SNAKE_CASE (`MAX_RETRIES`)

### 에러 처리

- tRPC 에러는 `AppError` 사용
- 예상 가능한 에러는 적절한 에러 코드 사용
- 예상치 못한 에러는 로깅 후 내부 서버 에러로 처리

## 테스트 작성

### 단위 테스트

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should do something', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### 통합 테스트

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '@sudam/database';

describe('Integration Test', () => {
  beforeAll(async () => {
    // Setup
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should test integration', async () => {
    // Test
  });
});
```

## 게임 모드 개발

### 게임 모드 구조

게임 모드는 `apps/api/src/game/modes/` 디렉토리에 구현됩니다.

각 게임 모드는 다음 메서드를 구현해야 합니다:

```typescript
export class MyGameMode {
  // 게임 초기화
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize?: number,
    ...settings: any[]
  ): MyGameData;

  // 수 두기
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number },
    ...options: any[]
  ): Promise<{ success: boolean; error?: string }>;

  // 패스
  static async handlePass(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; error?: string }>;

  // 기권
  static async handleResign(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean }>;
}
```

### 새 게임 모드 추가하기

1. **게임 모드 파일 생성**
   ```bash
   # apps/api/src/game/modes/my-mode.ts 생성
   ```

2. **게임 모드 구현**
   - `initializeGame`: 게임 초기 상태 설정
   - `processMove`: 수 두기 로직
   - `handlePass`: 패스 처리
   - `handleResign`: 기권 처리

3. **인덱스 파일에 추가**
   ```typescript
   // apps/api/src/game/modes/index.ts
   export { MyGameMode, type MyGameData } from './my-mode.js';
   ```

4. **라우터에 통합**
   - `apps/api/src/trpc/routers/game.router.ts`: 게임 생성 로직 추가
   - `apps/api/src/trpc/routers/game-action.router.ts`: 게임 액션 처리 추가

5. **게임 로직 패키지에 모드 정의 추가**
   ```typescript
   // packages/game-logic/src/game-modes.ts
   export enum GameMode {
     // ...
     MyMode = '내 게임 모드',
   }
   ```

6. **테스트 작성**
   ```typescript
   // apps/api/src/__tests__/integration/game-modes.test.ts
   describe('MyMode', () => {
     it('should initialize correctly', () => {
       // 테스트
     });
   });
   ```

### 게임 모드 예시

기존 게임 모드들을 참고하세요:
- `standard.ts` - 기본 바둑 모드
- `capture.ts` - 따내기 바둑 모드
- `speed.ts` - 스피드 바둑 모드
- `omok.ts` - 오목 모드

## 데이터베이스 작업

### 마이그레이션

```bash
# 마이그레이션 생성
pnpm db:migrate

# 스키마 푸시 (개발 환경)
pnpm db:push

# Prisma Studio 실행
pnpm db:studio
```

### 스키마 변경

1. `packages/database/schema.prisma` 수정
2. 마이그레이션 생성: `pnpm db:migrate`
3. Prisma 클라이언트 재생성: `pnpm db:generate`

## 디버깅

### 백엔드

- 로그는 Pino를 통해 출력
- 개발 환경에서는 상세 로그 활성화
- 에러는 `ctx.logger`를 통해 로깅

### 프론트엔드

- React DevTools 사용
- 브라우저 콘솔 확인
- Next.js 개발 모드 에러 메시지 확인

## 성능 최적화

### 데이터베이스

- 인덱스 활용
- N+1 문제 방지
- 배치 쿼리 사용

### 프론트엔드

- React.memo 사용
- useMemo, useCallback 활용
- 코드 스플리팅

## 배포

### 로컬 빌드 테스트

```bash
pnpm build
```

### 프로덕션 배포

1. `main` 브랜치에 푸시
2. CI/CD 파이프라인 자동 실행
3. Railway에 자동 배포

## 문제 해결

### 일반적인 문제

**Prisma 클라이언트 오류**
```bash
pnpm db:generate
```

**의존성 문제**
```bash
pnpm install
```

**타입 오류**
```bash
pnpm type-check
```

## 추가 리소스

- [Prisma 문서](https://www.prisma.io/docs)
- [tRPC 문서](https://trpc.io/docs)
- [Next.js 문서](https://nextjs.org/docs)
- [Fastify 문서](https://www.fastify.io/docs)

