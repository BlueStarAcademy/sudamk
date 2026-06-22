import type { AnimationData, LiveGameSession } from '../../types/index.js';

export type MissileFlightAnimationData = Extract<AnimationData, { type: 'missile' | 'hidden_missile' }>;

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

/** 슬림 `playing` 패킷 병합 시 아직 재생 중인 AI 히든·히든 공개 연출을 지우지 않게 한다 */
export function isItemPhasePresentationStillActive(
    game: Pick<LiveGameSession, 'animation' | 'revealAnimationEndTime'> & {
        aiHiddenItemAnimationEndTime?: number;
    },
    nowMs: number = Date.now(),
): boolean {
    const anim = game.animation as { type?: string; startTime?: number; duration?: number } | null | undefined;
    if (!anim?.type) return false;
    if (anim.type === 'ai_thinking') {
        const end = game.aiHiddenItemAnimationEndTime;
        if (typeof end === 'number' && Number.isFinite(end) && end > nowMs) return true;
        if (typeof anim.startTime === 'number' && typeof anim.duration === 'number') {
            return anim.startTime + anim.duration > nowMs;
        }
        return false;
    }
    if (anim.type === 'hidden_reveal') {
        const end = game.revealAnimationEndTime;
        if (typeof end === 'number' && Number.isFinite(end) && end > nowMs) return true;
        if (typeof anim.startTime === 'number' && typeof anim.duration === 'number') {
            return anim.startTime + anim.duration > nowMs;
        }
        return false;
    }
    return false;
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
