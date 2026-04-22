import type { LiveGameSession } from '../../types/index.js';
import { Player } from '../../types/index.js';
import { GameCategory, GameMode } from '../../types/enums.js';
import * as summaryService from '../summaryService.js';

export const NO_CAPTURE_TARGET = 999;

export function getCaptureTarget(game: LiveGameSession, player: Player): number | undefined {
    const effective = game.effectiveCaptureTargets;
    if (effective && typeof effective[player] === 'number') {
        return effective[player]!;
    }

    const baseTarget = game.settings?.captureTarget;
    return typeof baseTarget === 'number' ? baseTarget : undefined;
}

export function hasCaptureTarget(game: LiveGameSession, player: Player): boolean {
    const target = getCaptureTarget(game, player);
    return typeof target === 'number' && target !== NO_CAPTURE_TARGET;
}

/**
 * 따내기 점수가 `pendingCapture` 연출 끝에야 반영되는 경로(히든 공개 애니 등)에서도 즉시 종료되도록 공통 처리.
 */
export async function tryEndGameWhenCaptureTargetReached(game: LiveGameSession, scorer: Player): Promise<boolean> {
    if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') return false;
    const captureScoringContext =
        game.mode === GameMode.Capture ||
        game.isSinglePlayer ||
        game.gameCategory === GameCategory.Tower ||
        game.gameCategory === GameCategory.Adventure;
    if (!captureScoringContext) return false;
    const target = getCaptureTarget(game, scorer);
    if (target === undefined || target === NO_CAPTURE_TARGET) return false;
    if ((game.captures[scorer] ?? 0) >= target) {
        await summaryService.endGame(game, scorer, 'capture_limit');
        return true;
    }
    return false;
}

