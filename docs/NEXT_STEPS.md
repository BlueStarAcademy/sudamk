# 다음 단계 가이드

## 현재 상태

**Phase 2**: 55% 완료

### 완료된 작업
- ✅ Fastify 서버 설정
- ✅ tRPC 라우터 (User, Game, Inventory, Guild, GameAction)
- ✅ Repository 패턴 (User, Game, Inventory, Guild)
- ✅ 인증 시스템 (JWT)
- ✅ WebSocket 서버
- ✅ Standard 게임 모드 기본 구조
- ✅ Go 규칙 구현 (processMove)
- ✅ 게임 상태 관리
- ✅ 배경 작업 시스템 (게임 루프)

## 다음 우선순위 작업

### 1. 게임 모드 완성 (높은 우선순위)
- [ ] Standard 모드 완전 구현
  - 시간 제한 처리
  - 패스/기권 처리 개선
  - 게임 종료 조건 체크
- [ ] 나머지 게임 모드 구현
  - Capture, Speed, Base, Hidden, Missile 등

### 2. 프론트엔드 기본 구조 (중간 우선순위)
- [ ] Next.js 앱 기본 설정
- [ ] tRPC 클라이언트 설정
- [ ] 인증 플로우 구현
- [ ] 기본 레이아웃 및 라우팅

### 3. 데이터베이스 마이그레이션 준비 (중간 우선순위)
- [ ] 마이그레이션 스크립트 완성
- [ ] 데이터 검증 도구 개선
- [ ] 백업/복원 프로세스 문서화

### 4. 배경 작업 완성 (낮은 우선순위)
- [ ] 액션 포인트 재생성
- [ ] 퀘스트 진행 업데이트
- [ ] 토너먼트 시뮬레이션
- [ ] 랭킹 계산

## 작업 재개 시 체크리스트

1. `git pull origin develop` - 최신 코드 받기
2. `docs/PROGRESS.md` 확인 - 현재 진행 상황
3. `docs/NEXT_STEPS.md` 확인 - 다음 작업 목록
4. 필요한 패키지 설치: `pnpm install`
5. 개발 서버 실행: `pnpm dev` (각 앱별로)

## 개발 환경 설정

### 백엔드 실행
```bash
cd apps/api
pnpm dev
```

### 프론트엔드 실행
```bash
cd apps/web
pnpm dev
```

### 데이터베이스 작업
```bash
# Prisma 클라이언트 생성
pnpm db:generate

# 마이그레이션
pnpm db:migrate

# Prisma Studio
pnpm db:studio
```

## 알려진 이슈

- Standard 모드의 시간 제한 처리가 아직 완전하지 않음
- 게임 종료 조건 체크가 기본적인 수준
- 프론트엔드가 아직 구현되지 않음

## 참고사항

- 모든 게임 모드는 `apps/api/src/game/modes/` 디렉토리에 구현
- tRPC 라우터는 `apps/api/src/trpc/routers/` 디렉토리에 구현
- 공유 게임 로직은 `packages/game-logic/` 패키지에 구현

