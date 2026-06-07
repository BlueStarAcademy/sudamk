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

export function formatGameRecordInfoDate(timestamp: number): string {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours24 = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours24 < 12 ? '오전' : '오후';
    const hours12 = hours24 % 12 || 12;
    const minStr = String(minutes).padStart(2, '0');
    return `${year}. ${month}. ${day}. ${ampm} ${hours12}:${minStr}`;
}

export type GameRecordInfoResult = {
    userStoneColor: 'black' | 'white' | null;
    text: string;
};

function outcomeSuffixSpaced(
    winReason: WinReason | undefined,
    margin: number | undefined,
    iWon: boolean,
): string {
    switch (winReason) {
        case 'resign':
        case 'disconnect':
            return iWon ? '기권 승' : '기권 패';
        case 'timeout':
            return iWon ? '시간 승' : '시간 패';
        case 'score': {
            const m = margin != null && margin > 0 ? formatMarginPoints(margin) : null;
            if (m) return iWon ? `${m}집 승` : `${m}집 패`;
            return iWon ? '집 승' : '집 패';
        }
        case 'capture_limit':
            return iWon ? '따내기 승' : '따내기 패';
        default:
            return iWon ? '승' : '패';
    }
}

/** 기보 대국 정보 패널용 결과 (유저 착색 돌 + 유저 기준 승패 문구) */
export function formatGameRecordInfoResult(record: GameRecord): GameRecordInfoResult {
    const isDraw = record.gameResult.winner === Player.None;
    if (isDraw) return { userStoneColor: null, text: '무승부' };

    const margin = computeScoreMarginFromRecord(record);
    let winReason = record.gameResult.winReason;
    const my = record.myColor;

    if (my === Player.Black || my === Player.White) {
        const iWon = record.gameResult.winner === my;
        if (!winReason && margin != null && margin > 0) {
            winReason = 'score';
        }
        return {
            userStoneColor: my === Player.Black ? 'black' : 'white',
            text: outcomeSuffixSpaced(winReason, margin, iWon),
        };
    }

    const winnerStone = record.gameResult.winner === Player.Black ? 'black' : 'white';
    const label = formatGameRecordResultLabel(record).text;
    return { userStoneColor: winnerStone, text: label };
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
