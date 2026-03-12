# 경기 정보 저장 구조

## 전략바둑 / 놀이바둑 / 싱글플레이 / 도전의 탑

이 모드들의 **경기(게임) 정보**는 유저별 JSON이 아니라 **게임 테이블(DB)** 에 한 건씩 저장됩니다.

| 구분 | 저장 위치 | 비고 |
|------|-----------|------|
| 전략바둑·놀이바둑 (PVP) | `Game` 테이블 (Prisma) | `gameCategory` 없음 또는 `normal`, `getAllActiveGames()`로 조회 |
| 싱글플레이 | 동일 `Game` 테이블 | `gameCategory === 'singleplayer'` 또는 `isSinglePlayer === true` |
| 도전의 탑 | 동일 `Game` 테이블 | `gameCategory === 'tower'` |

- **진행 중인 경기**: `getLiveGame(id)`, `getAllActiveGames()` / `getAllActiveGamesChunked()` 로 조회.
- **종료된 경기**: 게임 상태가 `ended` / `no_contest` 등이면 DB에 그대로 두거나, 별도 정책에 따라 보관/삭제.
- 유저 엔티티에는 “현재 진행 중인 게임 ID”만 있고, 대국 내용·라운드 등은 게임 행 한 건에 모두 포함됩니다.

---

## 챔피언십 (동네바둑리그 / 전국바둑대회 / 월드챔피언십)

챔피언십은 **유저별 필드**에 경기장별로 **경기 JSON 전체**가 들어갑니다.

| 필드 | 설명 |
|------|------|
| `lastNeighborhoodTournament` | 동네바둑리그 최근 경기 상태 (라운드·대진·결과 등) |
| `lastNationalTournament` | 전국바둑대회 최근 경기 상태 |
| `lastWorldTournament` | 월드챔피언십 최근 경기 상태 |

- **메모리**: `volatileState.activeTournaments[userId]` 에도 동일 내용 보관 (접속 중일 때).
- **다음날 0시(KST)**:  
  - 매일 0시 스케줄에서 **모든 유저**에 대해 위 세 필드를 `null`로 초기화하고,  
  - `volatileState.activeTournaments` 도 비워서, **챔피언십 경기 정보가 다음날 0시에 깔끔하게 정리**되도록 되어 있습니다.
- 보상 수령 시에도 해당 경기장 필드는 `null`로 만들어 두어, 불필요한 JSON이 계속 쌓이지 않습니다.

정리: **전략/놀이/싱글/탑**은 게임 테이블 행 단위, **챔피언십**은 유저의 `last*Tournament` + 0시 일괄 정리 구조입니다.
