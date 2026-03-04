# SUDAM 자동 테스트

## 실행 방법

- **전체 테스트**: `npm run test` (Vitest run once)
- **단위 테스트**: `npm run test:unit`
- **통합 테스트**: `npm run test:integration`
- **E2E 테스트**: `npm run test:e2e` (첫 실행 전 `npx playwright install` 필요)
- **CI 전체**: `npm run test:ci` (unit → integration → e2e 순서)

## 디렉터리 구조

- `server/__tests__/unit/` – 서버 단위 테스트 (핸들러, 매칭 로직 등)
- `server/__tests__/integration/` – HTTP + createApp 통합 테스트 (supertest)
- `e2e/` – Playwright E2E (브라우저, 두 클라이언트 시나리오)

## 실패 시 확인 사항

1. **단위/통합**
   - `VITEST=true`로 실행 중인지 확인 (서버가 listen하지 않도록 함)
   - DB 의존 테스트는 mock 사용; 실제 DB 필요 시 `DATABASE_URL` 설정
2. **통합 테스트**
   - `createApp(serverRef, dbInitializedRef, { testMode: true })` 사용
   - 서버 전체를 올리지 않고 Express 앱만 생성해 요청
3. **E2E**
   - 로컬: `npx playwright install` 후 `npm run test:e2e`
   - `webServer`가 켜져 있으면 클라이언트+서버를 자동 기동 (playwright.config.ts)
   - CI에서는 빌드 후 `serve -s dist`로 정적 서버 기동

## 버그 재현 테스트 운영 규칙

- **새 버그 수정 시**: 재현 시나리오를 해당 레이어 테스트로 추가한 뒤 수정
  - 순수 로직/상태 전이 → `server/__tests__/unit/`
  - API/액션 응답·상태 → `server/__tests__/integration/`
  - 브라우저/두 클라이언트 흐름 → `e2e/`
- **회귀 방지**: PR에서 `npm run test:unit` 및 `npm run test:integration` 통과 필수
- **PVP/협상/매칭**: `negotiationFlow.test.ts`, `rankedMatching.test.ts`에 시나리오 추가 권장

## PVP 테스트 작성 시 참고

- 협상: `handleNegotiationAction` + mock `db`, `socket` (unit)
- 랭크 매칭: `tryMatchPlayers` + mock `db`, `gameModes`, `socket` (unit)
- WS 이벤트 계약: `wsContract.test.ts`에 payload 필수 필드·필터링 검증
- E2E 두 클라이언트: `e2e/pvp-two-clients.spec.ts`에 브라우저 컨텍스트 2개로 동시 로드·동작 검증
