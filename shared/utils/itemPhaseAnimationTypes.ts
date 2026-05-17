import type { LiveGameSession } from '../../types/index.js';

export function isMissileFlightAnimationType(anim: { type?: string } | null | undefined): boolean {
    return anim?.type === 'missile' || anim?.type === 'hidden_missile';
}

export function isScanAnimationType(anim: { type?: string } | null | undefined): boolean {
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
