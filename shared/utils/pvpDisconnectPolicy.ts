/**
 * PVP 전략 대국: 마지막 소켓 끊김 후 `disconnectionState` 가 유지되는 동안 재접속(로그인·`/api/game/rejoin`) 허용 시간.
 * `server/server.ts`(재접속 시 해제), `server/gameModes.ts`(시간패)와 반드시 동일한 값이어야 한다.
 *
 * AI 대국은 이 플래그를 쓰지 않는다. 재입장 시 `server/server.ts` 의 `/api/game/rejoin` 이
 * `settings.kataSessionResumeSeq` 를 올려 Kata 세션 태그를 갱신한다(`goAiBot` 주석 참고).
 * 클라이언트는 `useApp` WebSocket 재연결 후 동일 `gameId` 로 `GAME_UPDATE` 를 받는다.
 */
export const PVP_DISCONNECT_REJOIN_GRACE_MS = 90_000;

/** WS가 잠깐 끊겼다 재연결되는 경우(탭 전환·네트워크 순간 끊김) 즉시 접속 끊김으로 처리하지 않기 위한 유예 */
export const PVP_WS_DISCONNECT_GRACE_MS = 5_000;
