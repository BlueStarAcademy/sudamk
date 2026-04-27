import type { LiveGameSession } from '../../types/index.js';
import { Player } from '../../types/index.js';
import { GameCategory, GameMode } from '../../types/enums.js';
import * as summaryService from '../summaryService.js';

export const NO_CAPTURE_TARGET = 999;

export function getCaptureTarget(game: LiveGameSession, player: Player): number | undefined {
    const effective = game.effectiveCaptureTargets;
    if (effective && typeof effective[player] === 'number') {
        const target = Number(effective[player]);
        if (!Number.isFinite(target) || target <= 0 || target === NO_CAPTURE_TARGET) return undefined;
        return target;
    }

    const baseTarget = game.settings?.captureTarget;
    if (typeof baseTarget !== 'number') return undefined;
    if (!Number.isFinite(baseTarget) || baseTarget <= 0 || baseTarget === NO_CAPTURE_TARGET) return undefined;
    return baseTarget;
}

export function hasCaptureTarget(game: LiveGameSession, player: Player): boolean {
    const target = getCaptureTarget(game, player);
    return typeof target === 'number' && target !== NO_CAPTURE_TARGET;
}

function isCaptureTargetEndEnabled(game: LiveGameSession): boolean {
    // 도전의 탑 21~100층은 자동계가 전용 모드다.
    // 이 구간에서 capture_limit이 발동하면 안 되므로, autoScoringTurns가 설정된 탑 경기는 모두 제외한다.
    if (
        game.gameCategory === GameCategory.Tower &&
        typeof (game.settings as any)?.autoScoringTurns === 'number' &&
        (game.settings as any).autoScoringTurns > 0
    ) {
        return false;
    }

    const mixedModes = ((game.settings as any)?.mixedModes ?? []) as GameMode[];
    const hasCaptureInMix = game.mode === GameMode.Mix && Array.isArray(mixedModes) && mixedModes.includes(GameMode.Capture);
    return (
        game.mode === GameMode.Capture ||
        hasCaptureInMix ||
        // 길드전/모험/탑은 모드 전환 과정에서 stale target이 남을 수 있어도 capture 모드일 때만 발동.
        ((game.gameCategory === GameCategory.Tower || game.gameCategory === GameCategory.Adventure) &&
            (game.mode === GameMode.Capture || hasCaptureInMix))
    );
}

export function getCaptureTargetWinner(game: LiveGameSession, preferredScorer?: Player): Player | null {
    if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') return null;
    if (!isCaptureTargetEndEnabled(game)) return null;

    const candidates =
        preferredScorer === Player.Black || preferredScorer === Player.White
            ? [preferredScorer, preferredScorer === Player.Black ? Player.White : Player.Black]
            : [Player.Black, Player.White];

    for (const player of candidates) {
        const target = getCaptureTarget(game, player);
        if (target !== undefined && target !== NO_CAPTURE_TARGET && (game.captures[player] ?? 0) >= target) {
            return player;
        }
    }

    return null;
}

/**
 * 따내기 점수가 `pendingCapture` 연출 끝에야 반영되는 경로(히든 공개 애니 등)에서도 즉시 종료되도록 공통 처리.
 */
export async function tryEndGameWhenCaptureTargetReached(game: LiveGameSession, scorer: Player): Promise<boolean> {
    const winner = getCaptureTargetWinner(game, scorer);
    if (winner !== null) {
        await summaryService.endGame(game, winner, 'capture_limit');
        return true;
    }
    return false;
}

