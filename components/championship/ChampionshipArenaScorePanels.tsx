import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatChampionshipPanelScoreDisplay, type ChampionshipPanelScoreKind } from '../../utils/championshipLiveScores.js';

/** 챔피언십 인게임 — 흑/백 점수·계가까지 패널 (PVE·PVP 공통, 불투명 배경) */

export function championshipScoreBoxClass(isWhite: boolean): string {
    return isWhite
        ? 'border-2 border-slate-500 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-950 shadow-lg'
        : 'border-2 border-zinc-600 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-white shadow-lg';
}

export function championshipScoreBoxLabelClass(isWhite: boolean): string {
    return isWhite ? 'text-slate-700' : 'text-zinc-300';
}

export const championshipScoringCountdownBoxClass =
    'flex shrink-0 flex-col items-center justify-center rounded-lg border-2 border-amber-500/80 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-center shadow-lg';

export const championshipMobileScoringCountdownBoxClass =
    'flex w-[36%] shrink-0 flex-col items-center justify-center rounded-md border-2 border-amber-500/80 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-1 py-0.5 text-center shadow-lg';

export function championshipMobileScoreCellClass(isWhite: boolean): string {
    return isWhite
        ? 'border-2 border-slate-500 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-950 shadow-md'
        : 'border-2 border-zinc-600 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-white shadow-md';
}

export const ChampionshipDesktopScoreBox: React.FC<{
    isWhite: boolean;
    score: number | null;
    scoreKind?: ChampionshipPanelScoreKind | null;
}> = ({ isWhite, score, scoreKind = null }) => {
    const { t } = useTranslation(['tournament', 'championshipVersus']);
    return (
        <div
            className={`flex w-[4.8rem] shrink-0 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center ${championshipScoreBoxClass(isWhite)}`}
        >
            <span className={`text-[10px] font-bold leading-none ${championshipScoreBoxLabelClass(isWhite)}`}>{t('arena.score')}</span>
            <span className="mt-1 text-xl font-black leading-none tabular-nums">
                {formatChampionshipPanelScoreDisplay(score, scoreKind)}
            </span>
        </div>
    );
};

export const ChampionshipDesktopScoringCountdownBox: React.FC<{
    remaining: number | null;
    max: number;
}> = ({ remaining, max }) => {
    const { t } = useTranslation(['tournament', 'championshipVersus']);
    return (
        <div className={`w-36 ${championshipScoringCountdownBoxClass}`}>
            <div className="text-[11px] font-bold tracking-wide text-amber-100">{t('championship.scoringUntil')}</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                {remaining ?? '-'}/{max}
            </div>
        </div>
    );
};

export const ChampionshipMobileScoreCell: React.FC<{
    isWhite: boolean;
    score: number | null;
    scoreKind?: ChampionshipPanelScoreKind | null;
    colorLabel: string;
    side: 'left' | 'right';
}> = ({ isWhite, score, scoreKind = null, colorLabel, side }) => {
    const { t } = useTranslation(['tournament', 'championshipVersus']);
    const labelColor = championshipScoreBoxLabelClass(isWhite);
    const scoreText = formatChampionshipPanelScoreDisplay(score, scoreKind);
    return (
        <div
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 ${championshipMobileScoreCellClass(isWhite)} ${
                side === 'right' ? 'flex-row-reverse' : ''
            }`}
        >
            <span className={`max-w-[4.5rem] text-center text-[8px] font-bold leading-tight tracking-wide ${labelColor}`}>
                {colorLabel ? t('arena.colorScore', { color: colorLabel }) : t('arena.score')}
            </span>
            <span className="text-base font-black leading-none tabular-nums">{scoreText}</span>
        </div>
    );
};

export const ChampionshipMobileScoringCountdownCell: React.FC<{
    remaining: number;
    max: number;
}> = ({ remaining, max }) => {
    const { t } = useTranslation(['tournament', 'championshipVersus']);
    return (
        <div className={championshipMobileScoringCountdownBoxClass}>
            <div className="text-[9px] font-bold tracking-wide text-amber-100">{t('championship.scoringUntil')}</div>
            <div className="text-base font-black tabular-nums leading-none text-white">
                {remaining}/{max}
            </div>
        </div>
    );
};
