# API 레퍼런스

SUDAM v2 API의 상세 레퍼런스입니다.

## Base URL

```
https://api.sudam.com/trpc
```

## 인증

대부분의 API는 인증이 필요합니다. JWT 토큰을 Authorization 헤더에 포함하세요:

```
Authorization: Bearer <token>
```

## tRPC 엔드포인트

### User Router

#### `user.register`
새 사용자를 등록합니다.

**Input:**
```typescript
{
  username: string;
  password: string;
  nickname: string;
  email?: string;
}
```

**Output:**
```typescript
{
  user: User;
  token: string;
}
```

#### `user.login`
사용자 로그인

**Input:**
```typescript
{
  username: string;
  password: string;
}
```

**Output:**
```typescript
{
  user: User;
  token: string;
}
```

#### `user.me` (Protected)
현재 사용자 정보 조회

**Output:**
```typescript
{
  id: string;
  nickname: string;
  username?: string;
  email?: string;
  isAdmin: boolean;
  strategyLevel: number;
  playfulLevel: number;
  gold: string;
  diamonds: string;
  // ... 기타 필드
}
```

#### `user.updateProfile` (Protected)
프로필 업데이트

**Input:**
```typescript
{
  nickname?: string;
  email?: string;
}
```

### Game Router

#### `game.create` (Protected)
새 게임 생성

**Input:**
```typescript
{
  mode: string; // 게임 모드 (아래 참조)
  boardSize?: number; // 보드 크기 (기본: 19, Omok/Ttamok: 15)
  player2Id?: string; // 상대방 ID (선택사항)
  settings?: Record<string, any>; // 모드별 설정 (아래 참조)
}
```

**지원되는 게임 모드:**

1. **standard** / **클래식 바둑** - 일반적인 클래식 바둑
   - 설정: 없음

2. **capture** / **따내기 바둑** - 정해진 개수의 돌을 먼저 따내는 사람이 승리
   - 설정: `{ targetCaptures?: number }` (기본: 10)

3. **speed** / **스피드 바둑** - 피셔 방식 시간 제한
   - 설정: `{ initialTime?: number, timeIncrement?: number }` (기본: 5분, 5초)

4. **base** / **베이스 바둑** - 비밀 베이스 돌 배치
   - 설정: `{ baseStonesPerPlayer?: number }` (기본: 3)

5. **hidden** / **히든 바둑** - 상대에게 보이지 않는 히든 돌
   - 설정: `{ maxHiddenStones?: number, revealOnCapture?: boolean }` (기본: 5, true)

6. **missile** / **미사일 바둑** - 미사일로 돌 이동
   - 설정: `{ initialMissiles?: number, missileCooldown?: number }` (기본: 3, 5)

7. **mix** / **믹스룰 바둑** - 여러 규칙 조합
   - 설정: `{ enableCapture?: boolean, enableSpeed?: boolean, enableBase?: boolean, enableHidden?: boolean, enableMissile?: boolean, ... }`

8. **dice** / **주사위 바둑** - 주사위 결과만큼 돌 놓기
   - 설정: `{ maxDiceValue?: number }` (기본: 6)

9. **omok** / **오목** - 5개 연속 승리
   - 설정: 없음 (보드 크기: 15x15)

10. **ttamok** / **따목** - 오목 변형 (따내기 포함)
    - 설정: `{ targetCaptures?: number }` (기본: 5)

11. **thief** / **도둑과 경찰** - 역할 기반 추적 게임
    - 설정: `{ thiefMovesPerTurn?: number, policeMovesPerTurn?: number, captureDistance?: number }` (기본: 2, 1, 1)

12. **alkkagi** / **알까기** - 돌 튕기기 게임
    - 설정: `{ targetCaptures?: number }` (기본: 10)

13. **curling** / **바둑 컬링** - 목표 지점에 가까이 놓기
    - 설정: `{ targetScore?: number, rounds?: number }` (기본: 10, 5)

**Output:**
```typescript
{
  id: string;
  status: string;
  mode: string;
}
```

#### `game.getById` (Protected)
게임 ID로 조회

**Input:**
```typescript
{
  gameId: string;
}
```

#### `game.getActive` (Protected)
활성 게임 목록 조회

### Game Action Router

#### `gameAction.makeMove` (Protected)
수 두기

**Input:**
```typescript
{
  gameId: string;
  x: number;
  y: number;
}
```

#### `gameAction.pass` (Protected)
패스

**Input:**
```typescript
{
  gameId: string;
}
```

#### `gameAction.resign` (Protected)
기권

**Input:**
```typescript
{
  gameId: string;
}
```

### Inventory Router

#### `inventory.getMyInventory` (Protected)
내 인벤토리 조회

#### `inventory.getMyEquipment` (Protected)
내 장비 조회

#### `inventory.equip` (Protected)
아이템 장착

**Input:**
```typescript
{
  inventoryId: string;
  slot: string;
}
```

#### `inventory.unequip` (Protected)
아이템 해제

**Input:**
```typescript
{
  slot: string;
}
```

### Shop Router

#### `shop.getItems`
상점 아이템 목록 조회

#### `shop.purchase` (Protected)
아이템 구매

**Input:**
```typescript
{
  itemId: string;
}
```

### Quest Router

#### `quest.getAvailable`
사용 가능한 퀘스트 목록

#### `quest.accept` (Protected)
퀘스트 수락

**Input:**
```typescript
{
  questId: string;
}
```

#### `quest.complete` (Protected)
퀘스트 완료

**Input:**
```typescript
{
  questId: string;
}
```

### Guild Router

#### `guild.getMyGuild` (Protected)
내 길드 정보 조회

#### `guild.create` (Protected)
길드 생성

**Input:**
```typescript
{
  name: string;
  description?: string;
}
```

#### `guild.join` (Protected)
길드 가입

**Input:**
```typescript
{
  guildId: string;
}
```

### Admin Router

#### `admin.getStats` (Admin)
시스템 통계 조회

#### `admin.getUsers` (Admin)
사용자 목록 조회

## WebSocket API

### 연결

```
ws://api.sudam.com/ws
```

인증이 필요한 경우 헤더에 토큰 포함:
```
Authorization: Bearer <token>
```

### 메시지 타입

#### 클라이언트 → 서버

**ping**
```json
{
  "type": "ping"
}
```

**subscribe_game**
```json
{
  "type": "subscribe_game",
  "gameId": "game-id"
}
```

**unsubscribe_game**
```json
{
  "type": "unsubscribe_game",
  "gameId": "game-id"
}
```

#### 서버 → 클라이언트

**pong**
```json
{
  "type": "pong"
}
```

**GAME_UPDATE**
```json
{
  "type": "GAME_UPDATE",
  "payload": {
    "gameId": {
      "id": "game-id",
      "status": "active",
      "data": { ... }
    }
  }
}
```

**GAME_END**
```json
{
  "type": "GAME_END",
  "payload": {
    "gameId": "game-id",
    "winner": "user-id",
    "reason": "both_players_passed"
  }
}
```

## 에러 코드

- `BAD_REQUEST` (400) - 잘못된 요청
- `UNAUTHORIZED` (401) - 인증 필요
- `FORBIDDEN` (403) - 권한 없음
- `NOT_FOUND` (404) - 리소스를 찾을 수 없음
- `CONFLICT` (409) - 충돌 (예: 중복 닉네임)
- `INTERNAL_SERVER_ERROR` (500) - 서버 오류

## Rate Limiting

현재는 Rate Limiting이 구현되지 않았습니다. 향후 추가 예정입니다.

## 버전 관리

API 버전은 URL에 포함되지 않습니다. tRPC는 타입 안전성을 통해 호환성을 보장합니다.

