import type { LiveGameSession } from '../../types/index.js';

/** `boardState`가 정사각 격자면 변의 길이, 아니면 undefined */
export function getSquareBoardSideFromBoardState(boardState: unknown): number | undefined {
    if (!Array.isArray(boardState) || boardState.length < 2) return undefined;
    const n = boardState.length;
    if (n > 25) return undefined;
    for (let i = 0; i < n; i++) {
        const row = (boardState as unknown[])[i];
        if (!Array.isArray(row) || row.length !== n) return undefined;
    }
    return n;
}

/**
 * 모험·길드전·탑·로비 AI 등에서 `settings.boardSize`(또는 adventureBoardSize)와
 * 실제 `boardState` 변이 어긋나면 KataServer에 잘못된 boardXSize가 전달되어 Illegal move가 난다.
 * 실제 판을 우선해 settings·adventureBoardSize를 맞추고, 구판 기준 Kata 선포석 캐시는 제거한다.
 */
export function reconcileStrategicAiBoardSizeWithGroundTruth(game: LiveGameSession): void {
    const g = game as Record<string, unknown>;
    const fromState = getSquareBoardSideFromBoardState(game.boardState);
    const settingsRaw = Number(game.settings?.boardSize);
    const advRaw = Number(g.adventureBoardSize);

    let target: number;
    if (fromState != null) {
        target = fromState;
        if (Number.isFinite(settingsRaw) && Math.floor(settingsRaw) !== fromState) {
            console.warn(
                `[reconcileStrategicAiBoardSize] game=${game.id} settings.boardSize=${settingsRaw} != boardState ${fromState}; using boardState`,
            );
        }
    } else if (Number.isFinite(settingsRaw) && settingsRaw >= 2 && settingsRaw <= 25) {
        target = Math.floor(settingsRaw);
    } else if (Number.isFinite(advRaw) && advRaw >= 2 && advRaw <= 25) {
        target = Math.floor(advRaw);
    } else {
        target = 19;
    }

    (game as any).settings = { ...game.settings, boardSize: target };
    if (g.adventureBoardSize != null && Number.isFinite(Number(g.adventureBoardSize))) {
        g.adventureBoardSize = target;
    }

    const snap = g.kataStrategicOpeningBoardState;
    const snapN = getSquareBoardSideFromBoardState(snap);
    // 실제 판이 정사각으로 확보된 경우에만 스냅과 비교한다.
    // (탑·WS 병합 직후 boardState가 비었거나 행 길이가 어긋난 한 틱에 target=19로 스냅만 지우면 Kata 포석 접두가 통째로 사라짐)
    if (fromState != null && snapN != null && snapN !== fromState) {
        console.warn(
            `[reconcileStrategicAiBoardSize] Clearing stale kataStrategicOpeningBoardState (snap=${snapN}, board=${fromState}) game=${game.id}`,
        );
        g.kataStrategicOpeningBoardState = undefined;
        g.kataCaptureSetupMoves = undefined;
        if (String(g.gameCategory ?? '') === 'tower') {
            g.kataTowerOpeningBoardBackup = undefined;
        }
    } else if (fromState == null && snapN != null && snapN !== target) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(
                `[reconcileStrategicAiBoardSize] keep opening snapshot (no square boardState yet) game=${game.id} snap=${snapN} inferredTarget=${target}`,
            );
        }
    }
    const setup = g.kataCaptureSetupMoves as Array<{ x: number; y: number }> | undefined;
    if (
        fromState != null &&
        Array.isArray(setup) &&
        setup.some((m) => m && Number.isInteger(m.x) && Number.isInteger(m.y) && (m.x >= target || m.y >= target))
    ) {
        console.warn(`[reconcileStrategicAiBoardSize] Clearing kataCaptureSetupMoves out of range for board ${target} game=${game.id}`);
        g.kataCaptureSetupMoves = undefined;
    }
}
