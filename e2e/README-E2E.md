# E2E 테스트

## 개요

| 스펙 | 설명 |
|------|------|
| `smoke.spec.ts` | 앱 로드 |
| `pc-ui-scale.spec.ts` | PC UI 스케일 셸 |
| `pvp-two-clients.spec.ts` | 두 브라우저 컨텍스트 동시 로드 (smoke) |
| `pvp-lobby.spec.ts` | PVP 전략/놀이 경기장 진입 |
| `pvp-challenge-ui.spec.ts` | **UI-only** 유저 목록 대국 신청 → 수락 → 게임 진입 |
| `pvp-two-clients-match.spec.ts` | API 친선 대국 → 양쪽 게임 진입 → 상호 패스 → 계가 UI |
| `pvp-playful-match.spec.ts` | 오목·주사위바둑 PVP (API 협상 + UI 진입) |
| `pvp-hidden-reveal.spec.ts` | 히든바둑 PVP — 히든돌 → 상호 패스 → `hidden_final_reveal` UI |
| `pvp-scan-missile.spec.ts` | 믹스 PVP — 스캔 miss / 미사일 발사 후 게임 지속 |
| `pvp-reveal-opponent-hidden.spec.ts` | 히든 PVP — 상대 히든돌 공개(`REVEAL_OPPONENT_HIDDEN`) 후 게임 지속 |
| `pvp-ranked-match.spec.ts` | 랭킹전 PVP — API 매칭·수락 → 게임 진입 |
| `ai-and-pve-games.spec.ts` | 싱글플레이, 도전의 탑, AI 대결 |
| `kataserver-ai.spec.ts` | KataServer AI 응답 |

## 실행

```bash
npm run script:ensure-e2e-test-account   # 계정·AP·activeGame 리셋 (globalSetup에서도 실행)
npm run test:e2e                         # 30 tests (Playwright가 npm run start 기동 또는 5173 재사용)
```

## 테스트 계정

| 계정 | 용도 |
|------|------|
| **푸른별** / `1217` | 기본 E2E (`user-test-1`) |
| **노란별** / `1217` | 두 클라이언트 PVP (`user-test-2`) |

환경 변수: `E2E_USERNAME`, `E2E_USERNAME_2`, `E2E_PASSWORD`

`cleanupAllE2eAccountsActiveGamesViaApi`가 각 테스트 전후에 active 게임 기권·**AP 보충**(`/api/e2e/refill-accounts` 또는 DB fallback)을 수행합니다.

## API 헬퍼 (`e2e-api.helpers.ts`)

- `startStandardPvpGameViaApi` / `startHiddenPvpGameViaApi` / `startMixItemPvpGameViaApi`
- `startOmokPvpGameViaApi` / `startDicePvpGameViaApi`
- `startRankedPvpGameViaApi` / `respondRankedMatchViaApi`
- `startScanningViaApi`, `scanBoardViaApi`, `startMissileSelectionViaApi`, `launchMissileViaApi`
- `confirmColorStartViaApi`, `passTurnViaApi`
- `placeHiddenStoneForEitherPlayerViaApi`, `revealOpponentHiddenViaApi`
- `waitForE2eBackendReady`, `refillE2eAccountsViaApi`

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

> **참고:** 페어 4인 E2E는 E2E 계정이 2개뿐이라 통합 테스트로 검증합니다. 랭킹 API 헬퍼(`startRankedPvpGameViaApi`)는 `server.ts` 변경 후 **API 서버(4000) 재시작**이 필요합니다.

클라이언트 merge·챌린지 submit은 `server/__tests__/unit/clientGameMergePolicy.test.ts`, `pvpChallengeSubmit.test.ts`를 참고하세요.
