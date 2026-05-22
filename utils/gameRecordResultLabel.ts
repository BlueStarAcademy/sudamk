import { Player, WinReason } from '../types/index.js';
import type { GameRecord } from '../types/index.js';

export type GameRecordResultChip = {
    text: string;
    chip: string;
};

const WIN_CHIP = 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/35';
const LOSS_CHIP = 'bg-rose-500/20 text-rose-200 ring-rose-400/35';
const DRAW_CHIP = 'bg-slate-500/25 text-slate-200 ring-slate-400/30';
const NEUTRAL_CHIP = 'bg-sky-500/20 text-sky-200 ring-sky-400/35';

function formatMarginPoints(margin: number): string {
    const rounded = Math.round(margin * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function computeScoreMarginFromRecord(record: GameRecord): number | undefined {
    if (record.gameResult.scoreMargin != null && Number.isFinite(record.gameResult.scoreMargin)) {
        return record.gameResult.scoreMargin;
    }
    const { blackScore, whiteScore } = record.gameResult;
    if (!Number.isFinite(blackScore) || !Number.isFinite(whiteScore)) return undefined;
    const diff = Math.abs(blackScore - whiteScore);
    return diff > 0 ? Math.round(diff * 10) / 10 : undefined;
}

function outcomeSuffix(
    winReason: WinReason | undefined,
    margin: number | undefined,
    iWon: boolean,
): string {
    switch (winReason) {
        case 'resign':
        case 'disconnect':
            return iWon ? '기권승' : '기권패';
        case 'timeout':
            return iWon ? '시간승' : '시간패';
        case 'score': {
            const m = margin != null && margin > 0 ? formatMarginPoints(margin) : null;
            if (m) return iWon ? `${m}집승` : `${m}집패`;
            return iWon ? '집승' : '집패';
        }
        case 'capture_limit':
            return iWon ? '따내기승' : '따내기패';
        default:
            return iWon ? '승' : '패';
    }
}

/**
 * 저장 기보 목록·카드용 결과 문구 (내 색 기준 승패 + 종료 유형).
 * 구 기록(winReason 없음)은 점수 차이로 계가 승패를 추정한다.
 */
export function formatGameRecordResultLabel(record: GameRecord): GameRecordResultChip {
    const isDraw = record.gameResult.winner === Player.None;
    if (isDraw) return { text: '무승부', chip: DRAW_CHIP };

    const margin = computeScoreMarginFromRecord(record);
    let winReason = record.gameResult.winReason;

    const my = record.myColor;
    if (my === Player.Black || my === Player.White) {
        const iWon = record.gameResult.winner === my;
        if (!winReason && margin != null && margin > 0) {
            winReason = 'score';
        }
        return {
            text: outcomeSuffix(winReason, margin, iWon),
            chip: iWon ? WIN_CHIP : LOSS_CHIP,
        };
    }

    if (record.gameResult.winner === Player.Black) {
        return { text: '흑 승', chip: NEUTRAL_CHIP };
    }
    return { text: '백 승', chip: NEUTRAL_CHIP };
}
