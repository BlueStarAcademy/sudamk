# 통합 테스트 요약

## 완료된 테스트

### 1. 사용자 통합 테스트 (`user.test.ts`)
- ✅ 사용자 생성 테스트
- ✅ 중복 닉네임 방지 테스트
- ✅ 사용자 조회 테스트 (ID, 닉네임)
- ✅ 사용자 업데이트 테스트
- ✅ 사용자와 Credentials 연동 테스트

### 2. 게임 통합 테스트 (`game.test.ts`)
- ✅ 게임 생성 테스트
- ✅ 게임 상태 관리 테스트
- ✅ 게임 액션 테스트 (수 두기, 패스)
- ✅ 활성 게임 조회 테스트

## 테스트 실행 방법

### 전체 테스트 실행
```bash
pnpm test
```

### 통합 테스트만 실행
```bash
pnpm test:integration
```

### API 테스트만 실행
```bash
cd apps/api
pnpm test
```

### 테스트 커버리지 확인
```bash
cd apps/api
pnpm test:coverage
```

## 테스트 환경 설정

테스트를 실행하기 전에 다음 환경 변수를 설정하세요:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sudam_test
```

또는 테스트 전용 데이터베이스:

```env
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/sudam_test
```

## 완료된 테스트 (추가)

### 3. tRPC 라우터 통합 테스트
- ✅ User Router 테스트 (`trpc-user.test.ts`)
  - 회원가입 테스트
  - 로그인 테스트
  - 사용자 정보 조회 테스트
  - 프로필 업데이트 테스트
- ✅ Game Router 테스트 (`trpc-game.test.ts`)
  - 게임 생성 테스트
  - 게임 조회 테스트
  - 활성 게임 목록 테스트
- ✅ Game Action Router 테스트 (`trpc-game-action.test.ts`)
  - 수 두기 테스트
  - 패스 테스트
  - 기권 테스트

## 완료된 테스트 (추가)

### 4. WebSocket 통신 테스트 (`websocket.test.ts`)
- ✅ WebSocket 연결 테스트 (인증 없음, 인증 있음)
- ✅ 메시지 처리 테스트 (ping/pong, subscribe/unsubscribe)
- ✅ 게임 브로드캐스트 테스트
- ✅ 사용자 브로드캐스트 테스트
- ✅ 연결 정리 테스트

## 완료된 테스트 (추가)

### 5. E2E 테스트
- ✅ 게임 플레이 전체 플로우 (`game-flow.test.ts`)
  - 게임 생성부터 종료까지 전체 플로우
  - 수 두기, 패스, 기권 플로우
  - 잘못된 수 방지 테스트
- ✅ 사용자 등록/로그인 플로우 (`game-flow.test.ts`)
  - 회원가입 → 로그인 → 인증된 요청 플로우
- ✅ 인벤토리 관리 플로우 (`inventory-flow.test.ts`)
  - 인벤토리 조회
  - 상점에서 아이템 구매 플로우

## 향후 추가할 테스트

### 백엔드
- [ ] 성능 테스트
- [ ] 부하 테스트
- [ ] 인증/인가 테스트
- [ ] 에러 핸들링 테스트
- [ ] 캐싱 동작 테스트
- [ ] 트랜잭션 테스트

### 프론트엔드
- [ ] 컴포넌트 렌더링 테스트
- [ ] 상태 관리 테스트 (Zustand)
- [ ] API 호출 테스트
- [ ] 라우팅 테스트

### E2E
- [ ] 사용자 등록/로그인 플로우
- [ ] 게임 생성 및 플레이 플로우
- [ ] 인벤토리 관리 플로우
- [ ] 길드 기능 플로우

