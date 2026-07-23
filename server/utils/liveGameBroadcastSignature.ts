import type { LiveGameSession } from '../../shared/types/index.js';
import { Player } from '../../shared/types/enums.js';

/**
 * 메인 루프 GAME_UPDATE 변경 감지용 경량 시그니처.
 * status가 그대로인데 턴·아이템·자리·애니만 바뀌는 PVP 갱신이 방송에서 빠지지 않도록
 * currentPlayer / pair turn / stonesToPlace / item phase / animation 키를 포함한다.
 */
export function computeLiveGameBroadcastSignature(g: LiveGameSession | null | undefined): string {
    if (!g?.id) return '';
    const rev = g.serverRevision ?? 0;
    const moves = g.moveHistory?.length ?? 0;
    const status = g.gameStatus ?? '';
    const synced = g.lastSyncedAt ?? 0;
    const turn = g.turnDeadline ?? 0;
    const currentPlayer = g.currentPlayer ?? '';
    const alkkagiTurn = g.alkkagiTurnDeadline ?? 0;
    const curlingTurn = g.curlingTurnDeadline ?? 0;
    const winner = g.winner ?? '';
    const blackTime = g.blackTimeLeft ?? 0;
    const whiteTime = g.whiteTimeLeft ?? 0;
    const blackByo = g.blackByoyomiPeriodsLeft ?? 0;
    const whiteByo = g.whiteByoyomiPeriodsLeft ?? 0;
    const capB = g.captures?.[Player.Black] ?? 0;
    const capW = g.captures?.[Player.White] ?? 0;
    const pairTurnIndex = g.settings?.pairGame?.currentTurnIndex ?? '';
    const stonesToPlace = g.stonesToPlace ?? '';
    const stonesPlacedThisTurn = Array.isArray(g.stonesPlacedThisTurn) ? g.stonesPlacedThisTurn.length : '';
    const round = g.round ?? g.alkkagiRound ?? g.curlingRound ?? '';
    const itemUseDeadline = g.itemUseDeadline ?? 0;
    const itemPhaseActingPlayer = g.itemPhaseActingPlayer ?? '';
    const animType = g.animation?.type ?? '';
    const animStart =
        g.animation && typeof (g.animation as { startTime?: number }).startTime === 'number'
            ? (g.animation as { startTime: number }).startTime
            : 0;
    const revealEnd = g.revealAnimationEndTime ?? 0;
    const adventureDeadline = g.adventureEncounterDeadlineMs ?? 0;
    const adventureFrozen = g.adventureEncounterFrozenHumanMsRemaining ?? 0;
    return [
        g.id,
        rev,
        moves,
        status,
        synced,
        turn,
        currentPlayer,
        alkkagiTurn,
        curlingTurn,
        winner,
        blackTime,
        whiteTime,
        blackByo,
        whiteByo,
        capB,
        capW,
        pairTurnIndex,
        stonesToPlace,
        stonesPlacedThisTurn,
        round,
        itemUseDeadline,
        itemPhaseActingPlayer,
        animType,
        animStart,
        revealEnd,
        adventureDeadline,
        adventureFrozen,
    ].join('\t');
}
