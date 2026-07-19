import type { AnimationData, LiveGameSession } from '../../types/index.js';

export type MissileFlightAnimationData = Extract<AnimationData, { type: 'missile' | 'hidden_missile' }>;

/** 네트워크·틱 지터를 흡수하는 연출 종료 grace (ms) */
export const ITEM_PHASE_PRESENTATION_GRACE_MS = 150;

export function isMissileFlightAnimationType(
    anim: AnimationData | { type?: string } | null | undefined,
): anim is MissileFlightAnimationData {
    return anim?.type === 'missile' || anim?.type === 'hidden_missile';
}

export function isScanAnimationType(
    anim: AnimationData | { type?: string } | null | undefined,
): anim is Extract<AnimationData, { type: 'scan' }> {
    return anim?.type === 'scan';
}

/** 미사일·스캔 비행/스캔 연출 — `playing`이면 잔존 시 hard-clear 대상 */
export function isTransientItemFlightOrScanAnimation(
    anim: { type?: string } | null | undefined,
): boolean {
    return isMissileFlightAnimationType(anim) || isScanAnimationType(anim);
}

/** `playing` 복귀 시 슬림 패킷으로 animation 필드가 생략되면 클라에 잔존할 수 있는 연출 */
export function isItemPhaseTransientAnimationType(anim: { type?: string } | null | undefined): boolean {
    if (!anim) return false;
    return (
        isMissileFlightAnimationType(anim) ||
        isScanAnimationType(anim) ||
        anim.type === 'hidden_reveal' ||
        anim.type === 'hidden' ||
        anim.type === 'ai_thinking'
    );
}

export function wasItemPhaseAnimatingStatus(status: string | undefined): boolean {
    return (
        status === 'missile_animating' ||
        status === 'scanning_animating' ||
        status === 'hidden_reveal_animating'
    );
}

type TimedAnim = { type?: string; startTime?: number; duration?: number } | null | undefined;

/** startTime+duration(+grace) 기준 시계가 아직 유효한지 */
export function isTimedAnimationClockActive(
    anim: TimedAnim,
    nowMs: number = Date.now(),
    graceMs: number = ITEM_PHASE_PRESENTATION_GRACE_MS,
): boolean {
    if (!anim || typeof anim.startTime !== 'number' || !Number.isFinite(anim.startTime)) return false;
    if (typeof anim.duration !== 'number' || !Number.isFinite(anim.duration) || anim.duration <= 0) {
        return false;
    }
    return anim.startTime + anim.duration + Math.max(0, graceMs) > nowMs;
}

/**
 * 슬림 `playing` 패킷 병합 시 아직 재생 중인 AI 히든·히든 공개 연출을 지우지 않게 한다.
 * 미사일/스캔은 여기서 true가 되지 않는다(playing이면 hard-clear).
 */
export function isItemPhasePresentationStillActive(
    game: Pick<LiveGameSession, 'animation' | 'revealAnimationEndTime'> & {
        aiHiddenItemAnimationEndTime?: number;
    },
    nowMs: number = Date.now(),
): boolean {
    const anim = game.animation as TimedAnim;
    if (!anim?.type) return false;
    if (anim.type === 'ai_thinking') {
        const end = game.aiHiddenItemAnimationEndTime;
        if (typeof end === 'number' && Number.isFinite(end) && end > nowMs) return true;
        return isTimedAnimationClockActive(anim, nowMs);
    }
    if (anim.type === 'hidden_reveal') {
        const end = game.revealAnimationEndTime;
        if (typeof end === 'number' && Number.isFinite(end) && end > nowMs) return true;
        return isTimedAnimationClockActive(anim, nowMs);
    }
    return false;
}

/**
 * PVE 클라 AI 트리거용: status가 playing이어도 시계상 재생 중인 연출이면 차단.
 * - missile / hidden_missile / scan: startTime+duration
 * - ai_thinking: endTime 또는 startTime+duration
 * - hidden_reveal: status 가드로 막으므로 여기선 false (만료 leftover만 무시)
 */
export function isItemPhaseAiBlockingPresentationActive(
    game: Pick<LiveGameSession, 'animation' | 'revealAnimationEndTime'> & {
        aiHiddenItemAnimationEndTime?: number;
    },
    nowMs: number = Date.now(),
): boolean {
    const anim = game.animation as TimedAnim;
    if (!anim?.type) return false;
    if (isTransientItemFlightOrScanAnimation(anim)) {
        return isTimedAnimationClockActive(anim, nowMs);
    }
    if (anim.type === 'ai_thinking') {
        const end = game.aiHiddenItemAnimationEndTime;
        if (typeof end === 'number' && Number.isFinite(end) && end > nowMs) return true;
        return isTimedAnimationClockActive(anim, nowMs);
    }
    return false;
}

/** `playing` 세션에 남은 미사일/스캔 연출을 제거 (병합·HTTP sync 재유입 방지) */
export function stripStaleFlightOrScanAnimationIfPlaying<T extends Pick<LiveGameSession, 'gameStatus' | 'animation'>>(
    session: T,
): T {
    if (session.gameStatus !== 'playing') return session;
    if (!isTransientItemFlightOrScanAnimation(session.animation as { type?: string } | null | undefined)) {
        return session;
    }
    return { ...session, animation: null };
}

export function snapshotScanAnimation(game: LiveGameSession): {
    type: 'scan';
    playerId: string;
    startTime: number;
    duration: number;
    success?: boolean;
    towerResumeScanning?: boolean;
} | null {
    const anim = game.animation;
    if (!isScanAnimationType(anim)) return null;
    const scan = anim as {
        type: 'scan';
        playerId: string;
        startTime: number;
        duration: number;
        success?: boolean;
        towerResumeScanning?: boolean;
    };
    return scan;
}
