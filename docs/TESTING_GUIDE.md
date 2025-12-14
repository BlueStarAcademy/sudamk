# 테스트 가이드

이 문서는 SUDAM v2 프로젝트의 테스트 전략과 실행 방법을 설명합니다.

## 테스트 전략

### 1. 단위 테스트 (Unit Tests)
- 개별 함수/메서드 테스트
- Repository 레이어 테스트
- 유틸리티 함수 테스트

### 2. 통합 테스트 (Integration Tests)
- API 엔드포인트 테스트
- 데이터베이스 통합 테스트
- tRPC 라우터 테스트

### 3. E2E 테스트 (End-to-End Tests)
- 전체 사용자 플로우 테스트
- 게임 플레이 시나리오 테스트

## 테스트 실행

### 백엔드 테스트
```bash
cd apps/api
pnpm test
```

### 프론트엔드 테스트
```bash
cd apps/web
pnpm test
```

### 전체 테스트
```bash
pnpm test
```

## 테스트 커버리지

```bash
pnpm test:coverage
```

## 게임 모드 테스트

### 구현된 게임 모드 테스트

다음 게임 모드들이 통합 테스트로 커버됩니다:

1. **Standard** - 클래식 바둑
2. **Capture** - 따내기 바둑 (목표 따내기 승리)
3. **Speed** - 스피드 바둑 (시간 제한)
4. **Base** - 베이스 바둑 (베이스 돌 배치)
5. **Hidden** - 히든 바둑 (보이지 않는 돌)
6. **Missile** - 미사일 바둑 (돌 이동)
7. **Mix** - 믹스룰 바둑 (여러 규칙 조합)
8. **Dice** - 주사위 바둑 (주사위 결과만큼 이동)
9. **Omok** - 오목 (5개 연속 승리)
10. **Ttamok** - 따목 (오목 변형)
11. **Thief** - 도둑과 경찰 (추적 게임)
12. **Alkkagi** - 알까기 (돌 튕기기)
13. **Curling** - 바둑 컬링 (목표 지점 게임)

### 게임 모드 테스트 실행

```bash
cd apps/api
pnpm test game-modes
```

## 테스트 작성 가이드

### 백엔드 테스트 예시

```typescript
import { describe, it, expect } from 'vitest';
import { userRepository } from '../repositories/user.repository';

describe('UserRepository', () => {
  it('should create a user', async () => {
    const user = await userRepository.create({
      id: 'test-id',
      nickname: 'testuser',
    });
    
    expect(user.nickname).toBe('testuser');
  });
});
```

### 게임 모드 테스트 예시

```typescript
import { describe, it, expect } from 'vitest';
import { CaptureGameMode } from '../game/modes/index.js';

describe('CaptureGameMode', () => {
  it('should initialize with target captures', () => {
    const gameData = CaptureGameMode.initializeGame('player1', 'player2', 19, 10);
    expect(gameData.settings.targetCaptures).toBe(10);
  });
});
```

### 프론트엔드 테스트 예시

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameModeCard } from '../components/game/game-mode-card';

describe('GameModeCard', () => {
  it('should render game mode name', () => {
    render(<GameModeCard config={mockConfig} />);
    expect(screen.getByText('클래식 바둑')).toBeInTheDocument();
  });
});
```

## 테스트 데이터베이스

통합 테스트는 별도의 테스트 데이터베이스를 사용합니다:

```env
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/sudam_test
```

## CI/CD 통합

모든 PR은 테스트를 통과해야 합니다. GitHub Actions에서 자동으로 테스트가 실행됩니다.

