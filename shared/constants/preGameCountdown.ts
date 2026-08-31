/** PVP 경기 전 흑·백 확인·입찰 등 자동 진행까지의 준비 시간 */
export const PRE_GAME_PVP_COUNTDOWN_MS = 60_000;
export const PRE_GAME_PVP_COUNTDOWN_SECONDS = 60;

export function preGamePvpDeadlineAt(now: number): number {
    return now + PRE_GAME_PVP_COUNTDOWN_MS;
}

/** 서버가 `revealEndTime` 등을 설정할 때 시작 시각도 함께 기록 (UI 진행률·총 시간 계산용) */
export function stampPreGamePvpCountdownStart(
    session: { preGameCountdownStartAt?: number; nigiriStartTime?: number },
    now: number,
): void {
    session.preGameCountdownStartAt = now;
}

/** PVP 준비 카운트다운 마감 시각을 설정하고 시작 시각을 함께 기록 */
export function assignPreGamePvpCountdownDeadline(
    session: { preGameCountdownStartAt?: number; nigiriStartTime?: number },
    now: number,
    enabled = true,
): number | undefined {
    if (!enabled) return undefined;
    stampPreGamePvpCountdownStart(session, now);
    return preGamePvpDeadlineAt(now);
}

type PreGameCountdownSessionSlice = {
    revealEndTime?: number;
    captureBidDeadline?: number;
    basePlacementDeadline?: number;
    komiBiddingDeadline?: number;
    baseColorChoiceDeadline?: number;
    preGameCountdownStartAt?: number;
    nigiriStartTime?: number;
};

/** 세션에 기록된 시작·마감 시각으로 준비 카운트다운 총 길이(초) */
export function preGameCountdownDurationSeconds(session: PreGameCountdownSessionSlice): number {
    const end =
        session.revealEndTime ??
        session.captureBidDeadline ??
        session.basePlacementDeadline ??
        session.komiBiddingDeadline ??
        session.baseColorChoiceDeadline;
    const start = session.preGameCountdownStartAt ?? session.nigiriStartTime;
    if (end != null && start != null && end > start) {
        return Math.max(1, Math.round((end - start) / 1000));
    }
    return PRE_GAME_PVP_COUNTDOWN_SECONDS;
}

/** 클라이언트: 마감 시각이 있으면 남은 시간과 설정값 중 큰 값을 총 길이로 사용 */
export function resolvePreGameCountdownTotalSeconds(
    deadline: number | null | undefined,
    configuredSeconds: number = PRE_GAME_PVP_COUNTDOWN_SECONDS,
): number {
    if (deadline != null && Number.isFinite(deadline)) {
        const remainingSec = Math.ceil((deadline - Date.now()) / 1000);
        return Math.max(configuredSeconds, remainingSec);
    }
    return configuredSeconds;
}
