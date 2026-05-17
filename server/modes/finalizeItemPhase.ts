import * as types from '../../types/index.js';
import { pauseGameTimer, resumeGameTimer, shouldEnforceTimeControl } from './shared.js';
import { isFischerStyleTimeControl } from '../../shared/utils/gameTimeControl.js';
import { mixGoClearHiddenItemPhaseTimers } from '../../shared/utils/mixGoRules.js';
import {
    applyMissileFlightBoardFromAnimation,
    snapshotMissileFlightAnimation,
    type MissileFlightAnimationSnapshot,
} from './missileBoardUtils.js';
import {
    isMissileFlightAnimationType,
    isScanAnimationType,
    snapshotScanAnimation,
} from '../../shared/utils/itemPhaseAnimationTypes.js';
import { useTowerStyleHiddenRevealAnimatingResolution } from './hiddenRevealPolicy.js';
import { runTowerStyleHiddenRevealAnimatingIfDue } from './towerStyleHiddenRevealAnimating.js';

export type ItemPhaseKind = 'missile' | 'scan' | 'hidden_reveal' | 'hidden_selecting';

export type FinalizeItemPhaseOptions = {
    skipBoardRelocation?: boolean;
    animationStartTime?: number;
    cleanupOnly?: boolean;
    reason?: string;
    /** hidden_selecting 타임아웃: 어떤 선택 페이즈였는지 */
    selectingStatus?: 'hidden_placing' | 'scanning';
    /** scan: 타워 연속 스캔 — playing 대신 scanning 유지 */
    resumeScanningSelection?: boolean;
    /** scan: 애니 없이 deadline만 만료된 정리 */
    scanDeadlineCleanup?: boolean;
};

export function resumePlayingTimerAfterItemPhase(
    game: types.LiveGameSession,
    now: number,
    playerWhoMoved: types.Player,
): void {
    if (resumeGameTimer(game, now, playerWhoMoved)) {
        return;
    }
    if (game.pausedTurnTimeLeft !== undefined) {
        if (playerWhoMoved === types.Player.Black) {
            game.blackTimeLeft = game.pausedTurnTimeLeft;
        } else {
            game.whiteTimeLeft = game.pausedTurnTimeLeft;
        }
    }
    if (game.settings.timeLimit > 0 && shouldEnforceTimeControl(game)) {
        const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const timeLeft = game[currentPlayerTimeKey] ?? 0;
        if (timeLeft > 0) {
            game.turnDeadline = now + timeLeft * 1000;
            game.turnStartTime = now;
        } else {
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
        }
    } else {
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }
    game.pausedTurnTimeLeft = undefined;
    game.itemUseDeadline = undefined;
}

export function clearItemPhasePresentationFields(
    game: types.LiveGameSession,
    options?: { clearRevealClock?: boolean },
): void {
    game.animation = null;
    if (options?.clearRevealClock) {
        game.revealAnimationEndTime = undefined;
    }
}

export function markItemPhaseStateChanged(game: types.LiveGameSession): void {
    (game as any)._itemPhaseStateChanged = true;
}

function markMissileAnimationProcessed(game: types.LiveGameSession, animationStartTime?: number): void {
    if (animationStartTime == null || !Number.isFinite(animationStartTime)) return;
    (game as any).lastProcessedMissileAnimationTime = animationStartTime;
}

function wasMissileAnimationAlreadyProcessed(game: types.LiveGameSession, animationStartTime: number): boolean {
    return (game as any).lastProcessedMissileAnimationTime === animationStartTime;
}

function resolvePlayerEnumFromUserId(game: types.LiveGameSession, userId: string): types.Player {
    if (userId === game.blackPlayerId) return types.Player.Black;
    if (userId === game.whitePlayerId) return types.Player.White;
    return game.currentPlayer;
}

function consumeHiddenSelectingTimeoutItem(
    game: types.LiveGameSession,
    timedOutPlayerEnum: types.Player,
    selectingStatus: 'hidden_placing' | 'scanning',
): void {
    const timedOutIsBlack = timedOutPlayerEnum === types.Player.Black;
    if (selectingStatus === 'hidden_placing') {
        const hiddenInvKey = timedOutIsBlack ? 'hidden_stones_p1' : 'hidden_stones_p2';
        const usedKey = timedOutIsBlack ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
        const currentHidden = game[hiddenInvKey] ?? game.settings.hiddenStoneCount ?? 0;
        if (currentHidden > 0) {
            game[hiddenInvKey] = currentHidden - 1;
            game[usedKey] = (game[usedKey] || 0) + 1;
        }
    } else {
        const scanKey = timedOutIsBlack ? 'scans_p1' : 'scans_p2';
        const currentScans = game[scanKey] ?? 0;
        if (currentScans > 0) {
            game[scanKey] = currentScans - 1;
        }
    }
}

export function finalizeMissileItemPhase(
    game: types.LiveGameSession,
    now: number,
    options: FinalizeItemPhaseOptions = {},
): boolean {
    if (game.gameStatus !== 'missile_animating' && game.gameStatus !== 'playing') {
        return false;
    }

    const playerWhoMoved = game.currentPlayer;
    const animSnapshot = snapshotMissileFlightAnimation(game);
    const animationStartTime = options.animationStartTime ?? animSnapshot?.startTime;

    if (
        animationStartTime != null &&
        wasMissileAnimationAlreadyProcessed(game, animationStartTime) &&
        game.gameStatus === 'missile_animating'
    ) {
        clearItemPhasePresentationFields(game);
        game.gameStatus = 'playing';
        markItemPhaseStateChanged(game);
        return true;
    }

    if (options.cleanupOnly || !animSnapshot) {
        if (animationStartTime != null) {
            markMissileAnimationProcessed(game, animationStartTime);
        }
        clearItemPhasePresentationFields(game);
        game.gameStatus = 'playing';
        resumePlayingTimerAfterItemPhase(game, now, playerWhoMoved);
        markItemPhaseStateChanged(game);
        return true;
    }

    if (animationStartTime != null) {
        markMissileAnimationProcessed(game, animationStartTime);
    }

    applyMissileFlightBoardFromAnimation(game, animSnapshot, playerWhoMoved, {
        skipBoardRelocation: options.skipBoardRelocation,
    });

    clearItemPhasePresentationFields(game);
    game.gameStatus = 'playing';
    resumePlayingTimerAfterItemPhase(game, now, playerWhoMoved);
    markItemPhaseStateChanged(game);
    return true;
}

export function finalizeScanItemPhase(
    game: types.LiveGameSession,
    now: number,
    options: FinalizeItemPhaseOptions = {},
): boolean {
    if (game.gameStatus !== 'scanning_animating' && !(options.scanDeadlineCleanup && game.gameStatus === 'scanning_animating')) {
        return false;
    }

    const anim = snapshotScanAnimation(game);
    const scanEnded =
        options.scanDeadlineCleanup ||
        !anim ||
        now >= anim.startTime + anim.duration;

    if (!scanEnded) {
        return false;
    }

    if (anim && options.resumeScanningSelection && anim.towerResumeScanning && anim.success) {
        clearItemPhasePresentationFields(game);
        game.gameStatus = 'scanning';
        pauseGameTimer(game, now, 30000);
        markItemPhaseStateChanged(game);
        return true;
    }

    if (anim) {
        game.currentPlayer = resolvePlayerEnumFromUserId(game, anim.playerId);
    }

    clearItemPhasePresentationFields(game);
    game.gameStatus = 'playing';
    game.itemUseDeadline = undefined;
    game.pausedTurnTimeLeft = undefined;
    const cur = game.currentPlayer;
    if (cur !== types.Player.None) {
        resumePlayingTimerAfterItemPhase(game, now, cur);
    }
    markItemPhaseStateChanged(game);
    return true;
}

export function finalizeHiddenSelectingItemPhase(
    game: types.LiveGameSession,
    now: number,
    options: FinalizeItemPhaseOptions = {},
): boolean {
    const selectingStatus = options.selectingStatus;
    if (!selectingStatus || !['hidden_placing', 'scanning'].includes(selectingStatus)) {
        return false;
    }
    if (game.gameStatus !== selectingStatus) {
        return false;
    }

    const timedOutPlayerEnum = game.currentPlayer;
    const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;

    game.foulInfo = {
        message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`,
        expiry: now + 4000,
    };
    game.gameStatus = 'playing';
    game.currentPlayer = timedOutPlayerEnum;
    consumeHiddenSelectingTimeoutItem(game, timedOutPlayerEnum, selectingStatus);
    resumePlayingTimerAfterItemPhase(game, now, timedOutPlayerEnum);
    markItemPhaseStateChanged(game);
    return true;
}

export function finalizeHiddenSelectingUnstick(
    game: types.LiveGameSession,
    now: number,
): boolean {
    if (game.gameStatus !== 'hidden_placing' && game.gameStatus !== 'scanning') {
        return false;
    }
    game.gameStatus = 'playing';
    mixGoClearHiddenItemPhaseTimers(game);
    markItemPhaseStateChanged(game);
    return true;
}

/**
 * hidden_reveal_animating 종료 — tower-style 경로는 기존 정산 로직에 위임, PVP 레거시는 false 반환.
 */
export async function tryFinalizeHiddenRevealItemPhase(
    game: types.LiveGameSession,
    now: number,
): Promise<boolean> {
    if (game.gameStatus !== 'hidden_reveal_animating') {
        return false;
    }
    if (!game.revealAnimationEndTime) {
        game.revealAnimationEndTime = now;
    }
    if (now < game.revealAnimationEndTime) {
        return false;
    }

    if (useTowerStyleHiddenRevealAnimatingResolution(game)) {
        const handled = await runTowerStyleHiddenRevealAnimatingIfDue(game, now, {
            logPrefix: 'finalizeItemPhase:hidden_reveal',
        });
        if (handled) {
            markItemPhaseStateChanged(game);
        }
        return handled;
    }

    return false;
}

/** stuck / no-cap 히든 공개 연출만 정리(보드 정산은 호출측) */
export function finalizeHiddenRevealPresentationCleanup(
    game: types.LiveGameSession,
    now: number,
    playerForTimer: types.Player,
): void {
    clearItemPhasePresentationFields(game, { clearRevealClock: true });
    game.gameStatus = 'playing';
    game.pendingCapture = null;
    (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;
    if (game.pausedTurnTimeLeft !== undefined) {
        const timeKey = playerForTimer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        game[timeKey] = game.pausedTurnTimeLeft;
    }
    if (shouldEnforceTimeControl(game) && game.settings?.timeLimit > 0 && game.pausedTurnTimeLeft !== undefined) {
        const timeKey = playerForTimer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const isFischer = isFischerStyleTimeControl(game as any);
        const byoyomiTime = game.settings.byoyomiTime ?? 0;
        const isNextInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
        if (isNextInByoyomi && byoyomiTime > 0) {
            game.turnDeadline = now + byoyomiTime * 1000;
        } else {
            game.turnDeadline = now + (game[timeKey] ?? 0) * 1000;
        }
        game.turnStartTime = now;
    } else {
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }
    game.pausedTurnTimeLeft = undefined;
    markItemPhaseStateChanged(game);
}

export function finalizeItemPhase(
    game: types.LiveGameSession,
    kind: ItemPhaseKind,
    now: number,
    options: FinalizeItemPhaseOptions = {},
): boolean | Promise<boolean> {
    switch (kind) {
        case 'missile':
            return finalizeMissileItemPhase(game, now, options);
        case 'scan':
            return finalizeScanItemPhase(game, now, options);
        case 'hidden_selecting':
            return finalizeHiddenSelectingItemPhase(game, now, options);
        case 'hidden_reveal':
            return tryFinalizeHiddenRevealItemPhase(game, now);
        default:
            return false;
    }
}

export function tryFinalizeMissileFlightFromAnimationState(
    game: types.LiveGameSession,
    now: number,
    options: Omit<FinalizeItemPhaseOptions, 'animationStartTime'> & {
        animationStartTime: number;
        skipBoardRelocation?: boolean;
    },
): boolean {
    if (game.gameStatus !== 'missile_animating') return false;
    const anim = game.animation;
    if (!isMissileFlightAnimationType(anim)) {
        return finalizeItemPhase(game, 'missile', now, { ...options, cleanupOnly: true }) as boolean;
    }
    return finalizeItemPhase(game, 'missile', now, {
        ...options,
        animationStartTime: options.animationStartTime,
    }) as boolean;
}

export type { MissileFlightAnimationSnapshot };
