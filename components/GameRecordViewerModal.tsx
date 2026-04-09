import React, { useState, useMemo, useEffect } from 'react';
import { GameRecord, Player } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import SgfViewer from './SgfViewer.js';

interface GameRecordViewerModalProps {
    record: GameRecord;
    onClose: () => void;
    isTopmost?: boolean;
}

const modeLabel = (mode: string) => {
    const s = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    if (s) return s.name;
    const p = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
    return p ? p.name : mode;
};

const GameRecordViewerModal: React.FC<GameRecordViewerModalProps> = ({ record, onClose, isTopmost }) => {
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [isBoardRotated, setIsBoardRotated] = useState(false);

    useEffect(() => {
        setCurrentMoveIndex(0);
        setIsBoardRotated(false);
    }, [record.id]);

    const totalMoves = useMemo(() => {
        const m = record.sgfContent.match(/;[BW]\[[a-s]{2}\]/g);
        return m ? m.length : 0;
    }, [record.sgfContent]);
    const canGoBack = currentMoveIndex > 0;
    const canGoForward = currentMoveIndex < totalMoves;

    const handlePrevious = () => {
        if (canGoBack) setCurrentMoveIndex((prev) => prev - 1);
    };

    const handleNext = () => {
        if (canGoForward) setCurrentMoveIndex((prev) => prev + 1);
    };

    const handleFirst = () => setCurrentMoveIndex(0);
    const handleLast = () => setCurrentMoveIndex(totalMoves);

    const scoreDetails = record.gameResult.scoreDetails;

    const resultLabel =
        record.gameResult.winner === Player.Black
            ? '흑 승'
            : record.gameResult.winner === Player.White
              ? '백 승'
              : '무승부';

    const navBtn =
        'rounded-lg border border-amber-400/35 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-amber-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-amber-400/55 hover:bg-zinc-800/90 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-zinc-900/80';

    return (
        <DraggableWindow
            title={`기보 — ${record.opponent.nickname}`}
            onClose={onClose}
            initialWidth={1000}
            initialHeight={760}
            windowId="gameRecordViewer"
            isTopmost={isTopmost}
            headerShowTitle
            pcViewportMaxHeightCss="min(92vh, 880px)"
        >
            <div className="w-full space-y-5 px-4 pb-5 pt-1 sm:px-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.06] sm:p-5">
                        <h3 className="mb-3 border-b border-amber-500/20 pb-2 text-xs font-bold uppercase tracking-widest text-amber-200/85">
                            대국 정보
                        </h3>
                        <dl className="space-y-2.5 text-sm">
                            <div className="flex justify-between gap-3 border-b border-white/[0.06] border-dashed pb-2">
                                <dt className="text-slate-500">상대</dt>
                                <dd className="font-semibold text-amber-50/95">{record.opponent.nickname}</dd>
                            </div>
                            <div className="flex justify-between gap-3 border-b border-white/[0.06] border-dashed pb-2">
                                <dt className="text-slate-500">모드</dt>
                                <dd className="text-slate-200">{modeLabel(record.mode)}</dd>
                            </div>
                            <div className="flex justify-between gap-3 border-b border-white/[0.06] border-dashed pb-2">
                                <dt className="text-slate-500">일시</dt>
                                <dd className="tabular-nums text-slate-300">{new Date(record.date).toLocaleString('ko-KR')}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-slate-500">결과</dt>
                                <dd className="font-semibold text-amber-200">{resultLabel}</dd>
                            </div>
                        </dl>
                    </div>

                    {scoreDetails ? (
                        <div className="rounded-2xl border border-sky-500/15 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.06] sm:p-5">
                            <h3 className="mb-3 border-b border-sky-500/25 pb-2 text-xs font-bold uppercase tracking-widest text-sky-200/85">
                                점수 상세
                            </h3>
                            <div className="max-h-[200px] space-y-3 overflow-y-auto pr-1 text-xs text-slate-400 sm:max-h-none sm:overflow-visible">
                                <div>
                                    <div className="mb-1 font-semibold text-sky-200/90">흑 {record.gameResult.blackScore}점</div>
                                    {scoreDetails.black.timeBonus > 0 && (
                                        <div className="text-amber-200/90">시간 보너스 +{scoreDetails.black.timeBonus}</div>
                                    )}
                                    {scoreDetails.black.baseStoneBonus > 0 && (
                                        <div className="text-sky-300/90">베이스 보너스 +{scoreDetails.black.baseStoneBonus}</div>
                                    )}
                                    {scoreDetails.black.hiddenStoneBonus > 0 && (
                                        <div className="text-violet-300/90">히든 보너스 +{scoreDetails.black.hiddenStoneBonus}</div>
                                    )}
                                    {scoreDetails.black.itemBonus > 0 && (
                                        <div className="text-emerald-300/90">아이템 보너스 +{scoreDetails.black.itemBonus}</div>
                                    )}
                                </div>
                                <div className="border-t border-white/10 pt-2">
                                    <div className="mb-1 font-semibold text-amber-200/90">백 {record.gameResult.whiteScore}점</div>
                                    {scoreDetails.white.timeBonus > 0 && (
                                        <div className="text-amber-200/90">시간 보너스 +{scoreDetails.white.timeBonus}</div>
                                    )}
                                    {scoreDetails.white.baseStoneBonus > 0 && (
                                        <div className="text-sky-300/90">베이스 보너스 +{scoreDetails.white.baseStoneBonus}</div>
                                    )}
                                    {scoreDetails.white.hiddenStoneBonus > 0 && (
                                        <div className="text-violet-300/90">히든 보너스 +{scoreDetails.white.hiddenStoneBonus}</div>
                                    )}
                                    {scoreDetails.white.itemBonus > 0 && (
                                        <div className="text-emerald-300/90">아이템 보너스 +{scoreDetails.white.itemBonus}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/25 p-6 text-center text-sm text-slate-500 ring-1 ring-inset ring-white/[0.04]">
                            이 기록에는 점수 상세 항목이 없습니다.
                        </div>
                    )}
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-black/80 to-zinc-950 p-3 shadow-[0_20px_56px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/[0.06] sm:p-4">
                    <button
                        type="button"
                        onClick={() => setIsBoardRotated((prev) => !prev)}
                        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-zinc-950/90 text-amber-100 shadow-lg backdrop-blur-sm transition hover:border-amber-300/50 hover:bg-zinc-900/95"
                        title="바둑판 180° 회전"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{ transform: isBoardRotated ? 'rotate(180deg)' : 'none' }}
                            aria-hidden
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>
                    <div className="min-h-[360px] rounded-xl bg-zinc-950/90 p-2 sm:min-h-[400px] sm:p-4">
                        <SgfViewer
                            timeElapsed={0}
                            fileIndex={null}
                            showLastMoveOnly={false}
                            sgfContent={record.sgfContent}
                            isRotated={isBoardRotated}
                            replayMoveCount={currentMoveIndex}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 ring-1 ring-inset ring-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-medium tabular-nums text-slate-400">
                        수순 <span className="text-amber-200/95">{currentMoveIndex}</span>
                        <span className="text-slate-600"> / </span>
                        {totalMoves}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={navBtn} onClick={handleFirst} disabled={!canGoBack}>
                            처음
                        </button>
                        <button type="button" className={navBtn} onClick={handlePrevious} disabled={!canGoBack}>
                            이전
                        </button>
                        <button type="button" className={navBtn} onClick={handleNext} disabled={!canGoForward}>
                            다음
                        </button>
                        <button type="button" className={navBtn} onClick={handleLast} disabled={!canGoForward}>
                            마지막
                        </button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GameRecordViewerModal;
