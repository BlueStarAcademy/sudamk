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

/**
 * 따내기 점수가 `pendingCapture` 연출 끝에야 반영되는 경로(히든 공개 애니 등)에서도 즉시 종료되도록 공통 처리.
 */
export async function tryEndGameWhenCaptureTargetReached(game: LiveGameSession, scorer: Player): Promise<boolean> {
    if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') return false;
    // 도전의 탑 21~100층은 자동계가 전용 모드다.
    // 이 구간에서 capture_limit이 발동하면 안 되므로, autoScoringTurns가 설정된 탑 경기는 모두 제외한다.
    if (
        game.gameCategory === GameCategory.Tower &&
        typeof (game.settings as any)?.autoScoringTurns === 'number' &&
        (game.settings as any).autoScoringTurns > 0
    ) {
        return false;
    }
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

