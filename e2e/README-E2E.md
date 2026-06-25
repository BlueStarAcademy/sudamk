# E2E 테스트

## 개요

| 스펙 | 태그 | 설명 |
|------|------|------|
| `smoke.spec.ts` | `@smoke` | 앱 로드 |
| `pc-ui-scale.spec.ts` | `@full` | PC UI 스케일 셸 |
| `pvp-two-clients.spec.ts` | `@full` | 두 브라우저 컨텍스트 동시 로드 |
| `pvp-lobby.spec.ts` | `@smoke` | PVP 전략/놀이 경기장 진입 |
| `pvp-challenge-ui.spec.ts` | `@smoke` | **UI-only** 유저 목록 대국 신청 → 수락 → 게임 진입 |
| `pvp-two-clients-match.spec.ts` | `@smoke` | API 친선 대국 → 양쪽 게임 진입 → 상호 패스 → 계가 UI |
| `pvp-playful-match.spec.ts` | `@full` | 오목·주사위바둑 PVP (API 협상 + UI 진입) |
| `pvp-hidden-reveal.spec.ts` | `@full` | 히든바둑 PVP — 히든돌 → 상호 패스 → `hidden_final_reveal` UI |
| `pvp-scan-missile.spec.ts` | `@full` | 믹스 PVP — 스캔 miss/hit / 미사일 + GameControls UI |
| `pvp-reveal-opponent-hidden.spec.ts` | `@full` | 히든 PVP — 상대 히든돌 공개 후 게임 지속 |
| `pvp-ranked-match.spec.ts` | `@full` | 랭킹전 PVP — API 매칭(우선)·UI fallback |
| `pvp-ranked-ui.spec.ts` | `@full` `@ranked-ui` | 랭킹전 **UI-only** — Join queue → Accept → 게임 진입 |
| `pvp-disconnect-rejoin.spec.ts` | `@full` | PVP 끊김 → DisconnectionModal → 재접속 복귀 |
| `ai-and-pve-games.spec.ts` | `@full` | 싱글플레이, 도전의 탑, AI 대결 |
| `kataserver-ai.spec.ts` | `@full` | KataServer AI 응답 |

## 실행

```bash
npm run script:ensure-e2e-test-account   # 계정·AP·activeGame 리셋 (globalSetup에서도 실행)
npm run test:e2e                         # 전체 (~32 tests, workers:1, ~25분)
npm run test:e2e:smoke                   # PR smoke (~6 tests, ~5분 목표)
```

### CI

| 이벤트 | E2E |
|--------|-----|
| **Pull request** | `npm run test:e2e:smoke` (`@smoke`만) |
| **push → main** | 전체 Playwright suite |
| 실패 시 | `playwright-report/` 아티팩트 업로드 |

### Stale API 서버 (`reuseExistingServer`)

로컬에서 `playwright.config.ts`의 `reuseExistingServer: true`로 이미 떠 있는 API(4000)를 재사용하면 **새 `/api/e2e/*` 라우트가 404**일 수 있습니다. `waitForE2eBackendReady`가 `/api/e2e/ranked-proposal-for-user`를 probe해 **404 시 콘솔 경고**를 냅니다. 랭킹·refill 헬퍼 오류 시 **`npm run start` 재시작**하세요.

## 테스트 계정

| 계정 | 용도 |
|------|------|
| **푸른별** / `1217` | 기본 E2E (`user-test-1`) |
| **노란별** / `1217` | 두 클라이언트 PVP (`user-test-2`) |

환경 변수: `E2E_USERNAME`, `E2E_USERNAME_2`, `E2E_PASSWORD`

`cleanupAllE2eAccountsActiveGamesViaApi`가 각 테스트 전후에 active 게임 기권·**AP 보충**(`/api/e2e/refill-accounts` 또는 DB fallback)을 수행합니다.

## API 헬퍼 (`e2e-api.helpers.ts`)

| 헬퍼 | 설명 |
|------|------|
| `startStandardPvpGameViaApi` / `startHiddenPvpGameViaApi` / `startMixItemPvpGameViaApi` | PVP 대국 생성 |
| `startOmokPvpGameViaApi` / `startDicePvpGameViaApi` | 놀이 PVP |
| `startRankedPvpGameViaApi` / `fetchRankedProposalForUserViaApi` | 랭킹 매칭 |
| `startScanningViaApi`, `scanBoardViaApi`, … | 아이템 |
| `waitForE2eBackendReady` | health + E2E route probe |
| `refillE2eAccountsViaApi` | AP·activeGame 리셋 |

## UI 헬퍼 (`two-client.helpers.ts`)

| 헬퍼 | 설명 |
|------|------|
| `loginPage`, `enterStrategicPvpLobby`, `waitForPvpLobbyOpponent` | 로그인·로비 |
| `dismissOtherDeviceLoginIfNeeded` | 다른 기기 로그인 모달 |
| `startRankedMatchingFromLobby`, `acceptRankedMatchModal` | 랭킹 UI |
| `expectBoardVisible`, `expectMixItemControlButtons` | 인게임 UI assert |
| `ensurePvpGamePlaying` | nigiri 자동시작 레이스 완화 (API·UI 확인) |
| `loginPage(..., { preserveActiveGame: true })` | 재접속 E2E — active 게임 dismiss 생략 |
| `expectDisconnectionModal` / `expectDisconnectionModalHidden` | 끊김 모달 |

## E2E가 하지 않는 것 (integration·수동 QA)

| 영역 | 대안 |
|------|------|
| 페어 4인 full E2E | `pvpPairFourHuman.test.ts` (계정 2개 한계) |
| 길드전·페어 AI | integration + 수동 QA |
| 전략 모드 전 매트릭스 (Capture/Speed/Castle/Chess…) | `pvpStrategic.test.ts` 대표 시나리오 |
| 기권·타임아웃 UI | integration (`RESIGN_GAME`, time limit) |
| 모바일 viewport | `pc-ui-scale.spec.ts` (375px smoke optional) |

## 통합 테스트 (서버)

PVP 규칙·아이템·협상은 `server/__tests__/integration/pvpStrategic.test.ts`, `pvpPlayful.test.ts`에서 검증합니다.

| 통합/단위 | 내용 |
|-----------|------|
| `pvpStrategic.test.ts` | 패스·기권·히든·스캔·미사일·`REVEAL_OPPONENT_HIDDEN`·`hidden_final_reveal` |
| `pvpPlayful.test.ts` | 오목·주사위 PVP |
| `pvpPairFourHuman.test.ts` | 페어 4인 착수 순환·패스 |
| `pvpRankedMatch.test.ts` | 랭킹전 매칭·수락 |
| `pvpChallengeSubmit.test.ts` | 챌린지 submit 유틸 |
| `pvpMutualDisconnect.test.ts` / `pvpDisconnectReconnect.test.ts` | 끊김·재접속 |

클라이언트 merge·챌린지 submit은 `server/__tests__/unit/clientGameMergePolicy.test.ts`, `pvpChallengeSubmit.test.ts`를 참고하세요.
