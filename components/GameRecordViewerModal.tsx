import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GameRecord, Player, Point } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import SgfViewer, { parseSgf, buildBoardFromMoves, applySgfMoveToBoard, type SgfMove } from './SgfViewer.js';
import GameRecordReplayNav from './gameRecord/GameRecordReplayNav.js';
import { formatGameRecordResultLabel } from '../utils/gameRecordResultLabel.js';

interface GameRecordViewerModalProps {
    record: GameRecord;
    onClose: () => void;
    isTopmost?: boolean;
}

const INGAME_BOARD_PX = 840;
const SIDEBAR_WIDTH_PX = 280;
const MODAL_PADDING_PX = 48;

const modeLabel = (mode: string) => {
    const s = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    if (s) return s.name;
    const p = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
    return p ? p.name : mode;
};

const defaultBoardRotatedForRecord = (record: GameRecord): boolean => record.myColor === Player.White;

const GameRecordViewerModal: React.FC<GameRecordViewerModalProps> = ({ record, onClose, isTopmost }) => {
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [isBoardRotated, setIsBoardRotated] = useState(() => defaultBoardRotatedForRecord(record));
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [reviewMoves, setReviewMoves] = useState<SgfMove[]>([]);

    const parsedSgf = useMemo(() => parseSgf(record.sgfContent), [record.sgfContent]);

    useEffect(() => {
        setCurrentMoveIndex(0);
        setIsBoardRotated(defaultBoardRotatedForRecord(record));
        setIsReviewMode(false);
        setReviewMoves([]);
    }, [record.id, record.myColor]);

    useEffect(() => {
        setReviewMoves([]);
    }, [currentMoveIndex]);

    const totalMoves = parsedSgf?.moves.length ?? 0;
    const canGoBack = currentMoveIndex > 0;
    const canGoForward = currentMoveIndex < totalMoves;

    const goTo = useCallback((index: number) => {
        setCurrentMoveIndex(Math.max(0, Math.min(index, totalMoves)));
    }, [totalMoves]);

    const handleFirst = () => goTo(0);
    const handleLast = () => goTo(totalMoves);
    const handlePrevious = () => {
        if (canGoBack) goTo(currentMoveIndex - 1);
    };
    const handleNext = () => {
        if (canGoForward) goTo(currentMoveIndex + 1);
    };
    const handleBack5 = () => goTo(currentMoveIndex - 5);
    const handleForward5 = () => goTo(currentMoveIndex + 5);

    const nextReviewPlayer = useMemo((): Player => {
        if (!parsedSgf) return Player.Black;
        if (currentMoveIndex === 0 && reviewMoves.length === 0) return Player.Black;
        const allMoves = [...parsedSgf.moves.slice(0, currentMoveIndex), ...reviewMoves];
        const last = allMoves[allMoves.length - 1];
        return last.player === Player.Black ? Player.White : Player.Black;
    }, [parsedSgf, currentMoveIndex, reviewMoves]);

    const handleIntersectionClick = useCallback(
        (point: Point) => {
            if (!isReviewMode || !parsedSgf) return;
            const board = buildBoardFromMoves(parsedSgf.boardSize, parsedSgf.moves, currentMoveIndex);
            for (const m of reviewMoves) {
                applySgfMoveToBoard(board, m, parsedSgf.boardSize);
            }
            if (board[point.y][point.x] !== Player.None) return;
            setReviewMoves((prev) => [...prev, { player: nextReviewPlayer, x: point.x, y: point.y }]);
        },
        [isReviewMode, parsedSgf, currentMoveIndex, reviewMoves, nextReviewPlayer],
    );

    const clearReviewMoves = () => setReviewMoves([]);

    const scoreDetails = record.gameResult.scoreDetails;

    const resultLabel = formatGameRecordResultLabel(record).text;

    const myColorLabel =
        record.myColor === Player.Black ? '흑' : record.myColor === Player.White ? '백' : null;

    const modalWidth = INGAME_BOARD_PX + SIDEBAR_WIDTH_PX + MODAL_PADDING_PX;
    const modalHeight = INGAME_BOARD_PX + 160 + MODAL_PADDING_PX;

    const infoRow = (label: string, value: React.ReactNode) => (
        <div className="border-b border-white/[0.06] border-dashed pb-2.5 last:border-0 last:pb-0">
            <dt className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-sm font-semibold text-amber-50/95">{value}</dd>
        </div>
    );

    return (
        <DraggableWindow
            title={`기보 — ${record.opponent.nickname}`}
            onClose={onClose}
            initialWidth={modalWidth}
            initialHeight={modalHeight}
            windowId="gameRecordViewer"
            isTopmost={isTopmost}
            headerShowTitle
            mobileViewportFit
            mobileLockViewportHeight
            bodyNoScroll
            hideFooter
            skipIngameBoardFrameSizeCap
            viewportPortal
            pcViewportMaxWidthCss="min(calc(100vw - 12px), 1200px)"
            pcViewportMaxHeightCss="calc(100dvh - 10px)"
            mobileViewportMaxHeightCss="calc(100dvh - 10px)"
            mobileViewportDvhBottomGapPx={6}
            bodyPaddingClassName="p-2 sm:p-3"
        >
            <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row lg:gap-3">
                {/* 바둑판 + 재생 컨트롤 */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center">
                    <div
                        className="relative w-full max-w-full shrink-0"
                        style={{
                            width: INGAME_BOARD_PX,
                            maxWidth: 'min(840px, calc(100dvh - 220px), calc(100vw - 300px))',
                            aspectRatio: '1 / 1',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setIsBoardRotated((prev) => !prev)}
                            className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-zinc-950/90 text-amber-100 shadow-lg backdrop-blur-sm transition hover:border-amber-300/50 hover:bg-zinc-900/95 sm:h-10 sm:w-10"
                            title={isBoardRotated ? '흑의 입장으로 보기' : '백의 입장으로 보기'}
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
                        <SgfViewer
                            timeElapsed={0}
                            fileIndex={null}
                            showLastMoveOnly={false}
                            sgfContent={record.sgfContent}
                            isRotated={isBoardRotated}
                            replayMoveCount={currentMoveIndex}
                            boardSizePx={INGAME_BOARD_PX}
                            interactive={isReviewMode}
                            onIntersectionClick={handleIntersectionClick}
                            reviewMoves={reviewMoves}
                        />
                    </div>

                    <div className="mt-2 flex w-full max-w-[840px] flex-col items-center gap-2">
                        <GameRecordReplayNav
                            onFirst={handleFirst}
                            onBack5={handleBack5}
                            onBack1={handlePrevious}
                            onForward1={handleNext}
                            onForward5={handleForward5}
                            onLast={handleLast}
                            canGoBack={canGoBack}
                            canGoForward={canGoForward}
                        />
                        <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1">
                            <p className="text-sm font-medium tabular-nums text-slate-400">
                                수순 <span className="text-amber-200/95">{currentMoveIndex}</span>
                                <span className="text-slate-600"> / </span>
                                {totalMoves}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsReviewMode((v) => !v);
                                        if (isReviewMode) setReviewMoves([]);
                                    }}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                        isReviewMode
                                            ? 'border-sky-400/50 bg-sky-950/70 text-sky-100 ring-1 ring-sky-400/30'
                                            : 'border-amber-400/35 bg-zinc-900/80 text-amber-100/95 hover:border-amber-400/55 hover:bg-zinc-800/90'
                                    }`}
                                >
                                    놓아보기 {isReviewMode ? '끄기' : '켜기'}
                                </button>
                                {reviewMoves.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearReviewMoves}
                                        className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-black/55"
                                    >
                                        검토 수 지우기
                                    </button>
                                )}
                            </div>
                        </div>
                        {isReviewMode && (
                            <p className="w-full px-1 text-center text-[11px] text-sky-300/80 sm:text-xs">
                                빈 교차점을 눌러 {nextReviewPlayer === Player.Black ? '흑' : '백'} 돌을 놓아 변화를 검토할 수 있습니다.
                            </p>
                        )}
                    </div>
                </div>

                {/* 대국 정보 — 바둑판 우측 세로 */}
                <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-[260px] xl:w-[280px]">
                    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black p-4 shadow-[0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.06]">
                        <h3 className="mb-3 border-b border-amber-500/20 pb-2 text-xs font-bold uppercase tracking-widest text-amber-200/85">
                            대국 정보
                        </h3>
                        <dl className="space-y-2.5">
                            {infoRow('상대', record.opponent.nickname)}
                            {myColorLabel && infoRow('내 색', myColorLabel)}
                            {infoRow('모드', modeLabel(record.mode))}
                            {infoRow('일시', new Date(record.date).toLocaleString('ko-KR'))}
                            {infoRow('결과', <span className="text-amber-200">{resultLabel}</span>)}
                        </dl>
                    </div>

                    {scoreDetails ? (
                        <div className="rounded-2xl border border-sky-500/15 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-4 shadow-[0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.06]">
                            <h3 className="mb-3 border-b border-sky-500/25 pb-2 text-xs font-bold uppercase tracking-widest text-sky-200/85">
                                점수 상세
                            </h3>
                            <div className="space-y-3 text-xs text-slate-400">
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
                        <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/25 p-4 text-center text-xs text-slate-500 ring-1 ring-inset ring-white/[0.04]">
                            점수 상세 없음
                        </div>
                    )}
                </aside>
            </div>
        </DraggableWindow>
    );
};

export default GameRecordViewerModal;
