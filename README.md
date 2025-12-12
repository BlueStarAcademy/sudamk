# SUDAM v2 - 바둑 게임 플랫폼 재작성 프로젝트

## 프로젝트 개요

기존 SUDAM 앱의 모든 기능을 유지하면서 최신 기술 스택으로 재작성하여 안정성, 성능, 유지보수성을 크게 개선하는 프로젝트입니다.

## 기술 스택

### Backend
- **Fastify** - 고성능 HTTP 서버
- **tRPC** - End-to-end 타입 안전 API
- **Prisma** - 데이터베이스 ORM
- **PostgreSQL** - 데이터베이스
- **WebSocket (ws)** - 실시간 통신

### Frontend
- **Next.js 14+** - React 프레임워크 (App Router)
- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Zustand** - 상태 관리
- **Tailwind CSS** - 스타일링

## 프로젝트 구조

```
sudam-v2/
├── apps/
│   ├── web/              # Next.js 프론트엔드
│   └── api/              # Fastify 백엔드
├── packages/
│   ├── shared/           # 공유 타입 및 유틸리티
│   ├── database/         # Prisma 스키마 및 클라이언트
│   └── game-logic/       # 게임 로직 (클라이언트/서버 공유)
├── prisma/               # 데이터베이스 스키마
├── scripts/              # 마이그레이션 및 유틸리티 스크립트
└── docs/                 # 문서
```

## 진행 상황

자세한 진행 상황은 [docs/PROGRESS.md](./docs/PROGRESS.md)를 참고하세요.

## 작업 로그

일일 작업 로그는 [docs/DAILY_LOG.md](./docs/DAILY_LOG.md)를 참고하세요.

## 이슈 추적

발견된 이슈와 버그는 [docs/ISSUES.md](./docs/ISSUES.md)를 참고하세요.

## 개발 가이드

### 작업 재개 (다른 PC에서)

1. 저장소 클론/업데이트
   ```bash
   git pull origin develop
   ```

2. 진행 상황 확인
   - `docs/PROGRESS.md` - 현재 Phase 및 진행률
   - `docs/DAILY_LOG.md` - 최근 작업 내용
   - `docs/ISSUES.md` - 알려진 이슈

3. 작업 재개
   - 현재 Phase의 TODO 리스트 확인
   - 필요한 의존성 설치
   - 작업 시작

### 커밋 메시지 형식

```
[Phase X] [카테고리] 작업 내용

- 구체적인 변경 사항
- 해결한 문제
```

카테고리: `setup`, `backend`, `frontend`, `database`, `game`, `fix`, `docs`

### 작업 세션 체크리스트

**작업 시작 시:**
- [ ] `git pull`로 최신 코드 받기
- [ ] 진행 상황 문서 확인
- [ ] 현재 작업 항목 확인

**작업 종료 시:**
- [ ] 모든 변경사항 커밋
- [ ] `docs/DAILY_LOG.md` 업데이트
- [ ] `docs/PROGRESS.md` 업데이트 (필요시)
- [ ] `git push` 실행

## 라이선스

(기존 프로젝트와 동일)

