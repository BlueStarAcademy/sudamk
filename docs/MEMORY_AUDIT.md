# 앱 메모리 점검 결과

앱 전체를 점검하여 불필요하게 저장되어 메모리(및 스토리지)를 차지하는 부분을 정리한 문서입니다.

---

## 수정 완료 항목

### 1. 서버: `volatileState.gameChats` 무한 증가

- **문제**: 게임이 DB에서 삭제될 때 `volatileState.gameChats[gameId]`를 제거하지 않아, 종료/삭제된 게임 채팅이 메모리에 계속 쌓임.
- **수정**: 다음 위치에서 `db.deleteGame` 호출 직후 `delete volatileState.gameChats[gameId]` 추가.
  - `server/server.ts`: AI 접속 끊김 삭제, 양쪽 끊김 삭제, 빈 대국실 GC
  - `server/actions/adminActions.ts`: 관리자 강제 삭제
  - `server/actions/socialActions.ts`: 비상탈출/접속 끊김 삭제, 양쪽 나감 GC

### 2. 클라이언트: `sessionStorage` 게임 상태 미삭제

- **문제**: `gameState_${gameId}` 키로 대국 중 상태를 저장하지만, 게임 삭제(GAME_DELETED) 시 제거하지 않아 sessionStorage가 계속 증가.
- **수정**: `hooks/useApp.ts`의 GAME_DELETED 처리 시 `sessionStorage.removeItem('gameState_' + deletedGameId)` 호출.

### 3. 클라이언트: 게임별 쓰로틀 Ref 미정리

- **문제**: `lastGameUpdateTimeRef`, `lastGameUpdateMoveCountRef`에 gameId별로 값이 쌓이는데, GAME_DELETED 시 해당 gameId 키를 삭제하지 않아 메모리 증가.
- **수정**: GAME_DELETED 처리 시 `delete lastGameUpdateTimeRef.current[deletedGameId]`, `delete lastGameUpdateMoveCountRef.current[deletedGameId]` 추가.

---

## 이미 적절히 관리되는 항목

- **서버 gameCache / userCache**: TTL·상한 개수 적용, `cleanupExpiredCache()` 주기 호출.
- **서버 userStatuses**: 접속 끊긴 유저 중 대국 참가자가 아니면 주기적으로 제거(STALE_USER_STATUS_CLEANUP).
- **서버 negotiations**: `cleanupExpiredNegotiations`로 만료된 협상 제거.
- **서버 pendingMutualDisconnectByUser**: 재접속 시 한 번 전달 후 해당 유저 키 삭제.
- **클라이언트 pendingDungeon**: 토너먼트 아레나에서 사용 후 `sessionStorage.removeItem` 호출.

---

## 참고(개선 권장·모니터링)

- **sessionStorage `currentUser`**: 로그인 유저 전체 객체(inventory, equipment, mail 등) 저장. 탭/세션 단위라 크기가 극단적이지 않으면 큰 문제는 아니나, 필요 시 최소 필드만 저장하도록 줄이는 것을 고려할 수 있음.
- **localStorage `draggableWindowPositions`**: 창별 위치 저장. 창 ID 개수만큼만 키가 생기므로 보통은 유한. 오래된/삭제된 창 ID 정리는 필요 시 추가 가능.
- **클라이언트 usersMap**: 온라인 유저·협상 상대 등으로 병합되어 세션 동안 증가. 로그아웃 시 `setUsersMap({})`로 비움. USER_LIST 수신 시 교체되므로 과도하게 커지지 않도록 모니터링하면 됨.
- **rankingCache**: 15분 TTL, 단일 객체로 유지되어 크기 제한적.

---

## 요약

- **수정한 부분**: 서버 `gameChats` 삭제 시 정리, 클라이언트 GAME_DELETED 시 sessionStorage `gameState_*` 제거 및 게임별 쓰로틀 Ref 정리.
- **이미 잘 관리되는 부분**: 서버 캐시·userStatuses·negotiations·pendingMutualDisconnect, 클라이언트 pendingDungeon 등.
- **추가로 보고 싶다면**: currentUser 저장 크기, usersMap 크기, draggableWindowPositions 키 수를 주기적으로 확인하면 좋음.
