# SUDAM v2 - Next.js 풀스택 앱

Next.js 14+ App Router를 사용한 풀스택 바둑 게임 플랫폼입니다.

## 주요 특징

- ✅ **관리자 기능 완전 지원**: 절대적인 관리자 권한 체계 (`adminProcedure`)
- ✅ **게임 세션 격리**: 각 게임은 고유한 `gameId`로 독립적으로 관리됨
- ✅ **모든 게임 모드 지원**: 기본 구조 완성 (추가 모드들은 점진적으로 구현)
- ✅ **tRPC 타입 안전성**: End-to-end 타입 안전 API
- ✅ **확장 가능한 아키텍처**: 1000명 동시 사용자 지원 준비

## 프로젝트 구조

```
app/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   │   └── trpc/     # tRPC 엔드포인트
│   │   └── ...           # 페이지들
│   ├── server/           # 서버 로직
│   │   ├── trpc/         # tRPC 설정 및 라우터
│   │   ├── game/         # 게임 로직
│   │   ├── repositories/ # 데이터베이스 레포지토리
│   │   └── auth/         # 인증 로직
│   ├── components/       # React 컴포넌트
│   ├── lib/              # 유틸리티
│   └── stores/           # Zustand 스토어
├── package.json
├── Dockerfile            # Railway 배포용
└── railway.json          # Railway 설정
```

## 개발

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm --filter @sudam/app dev

# 빌드
pnpm --filter @sudam/app build

# 프로덕션 실행
pnpm --filter @sudam/app start
```

## 환경 변수

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key-min-32-chars
NODE_ENV=production
KATAGO_API_URL=https://your-katago-service-url
GNUGO_API_URL=https://your-gnugo-service-url
```

## 배포

Railway에서 `app/Dockerfile`을 사용하여 배포합니다.

## 게임 세션 격리

각 게임은 고유한 `gameId`로 완전히 독립적으로 관리됩니다:
- 각 유저의 AI봇 게임은 서로 간섭하지 않음
- 동시에 여러 게임을 진행해도 문제없음
- 게임 상태는 데이터베이스에 저장되어 격리 보장

## 관리자 기능

`adminProcedure`를 사용하여 절대적인 관리자 권한을 제공합니다:
- 유저 관리 (조회, 수정, 삭제)
- 게임 관리 (조회, 종료)
- 시스템 통계 조회

## 게임 모드

현재 구현된 모드:
- Standard (클래식 바둑)

추가 예정 모드:
- Base, Capture, Speed, Dice, Hidden, Missile, Mix, Omok, Thief, Ttamok, Alkkagi, Curling

각 모드의 특수 기능은 `app/src/server/game/modes/`에서 구현됩니다.

