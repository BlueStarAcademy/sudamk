import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import i18n from '../shared/i18n/config.js';
import { useLocalizedGameMode } from '../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import { GameRecord, Player, Point } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/gameModes.js';
import SgfViewer, { parseSgf, buildBoardFromMoves, applySgfMoveToBoard, type SgfMove } from '../SgfViewer.js';
import GameRecordReplayNav from './GameRecordReplayNav.js';
import { formatGameRecordResultLabel } from '../../utils/gameRecordResultLabel.js';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';

export interface GameRecordViewerPanelProps {
    record: GameRecord;
    /** DraggableWindow 전체화면 vs 기보 목록 우측 인라인 */
    variant?: 'modal' | 'inline';
    /** modal 레이아웃에서 부모 너비에 맞춰 판 크기 조절 (모바일 전체 뷰어) */
    fitContainer?: boolean;
    /** fitContainer 모바일 전체 뷰어: 상단 닫기 */
    onClose?: () => void;
}

const MODAL_BOARD_PX = 840;

const modeLabel = (mode: string) => {
    const s = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    if (s) return s.name;
    const p = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
    return p ? p.name : mode;
};

const defaultBoardRotatedForRecord = (record: GameRecord): boolean => record.myColor === Player.White;

type ScoreSideDetails = NonNullable<GameRecord['gameResult']['scoreDetails']>['black'];

function formatScoreDetailsOneLine(record: GameRecord): string {
    const { blackScore, whiteScore, scoreDetails } = record.gameResult;
    if (!scoreDetails) {
        return i18n.t('common:scoreDetailsLine', { blackLine: i18n.t('common:scoreLine', { label: i18n.t('common:black'), score: blackScore }), whiteLine: i18n.t('common:scoreLine', { label: i18n.t('common:white'), score: whiteScore }) });
    }
    const sideLine = (label: string, total: number, side: ScoreSideDetails) => {
        const parts = [`${label} ${total}`];
        if (side.timeBonus > 0) parts.push(i18n.t('common:timeBonus', { bonus: side.timeBonus }));
        if (side.baseStoneBonus > 0) parts.push(i18n.t('common:baseBonus', { bonus: side.baseStoneBonus }));
        if (side.hiddenStoneBonus > 0) parts.push(i18n.t('common:hiddenBonus', { bonus: side.hiddenStoneBonus }));
        if (side.itemBonus > 0) parts.push(i18n.t('common:itemBonus', { bonus: side.itemBonus }));
        return parts.join(' ');
    };
    return i18n.t('common:scoreDetailsLine', { blackLine: sideLine(i18n.t('common:black'), blackScore, scoreDetails.black), whiteLine: sideLine(i18n.t('common:white'), whiteScore, scoreDetails.white) });
}

const GameRecordViewerPanel: React.FC<GameRecordViewerPanelProps> = ({
    record,
    variant = 'modal',
    fitContainer = false,
    onClose,
}) => {
    const { t } = useTranslation(['profile', 'common']);
    const localizedGameMode = useLocalizedGameMode();
    const isInline = variant === 'inline';
    const useResponsiveBoard = isInline || (variant === 'modal' && fitContainer);
    const boardAreaRef = useRef<HTMLDivElement>(null);
    const [boardPx, setBoardPx] = useState(isInline ? 360 : MODAL_BOARD_PX);

    const ROTATE_BTN_RESERVE = 44;

    const parsedSgf = useMemo(() => parseSgf(record.sgfContent), [record.sgfContent]);
    const totalMoves = parsedSgf?.moves.length ?? 0;

    const [currentMoveIndex, setCurrentMoveIndex] = useState(() => parseSgf(record.sgfContent)?.moves.length ?? 0);
    const [isBoardRotated, setIsBoardRotated] = useState(() => defaultBoardRotatedForRecord(record));
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [showMoveNumbers, setShowMoveNumbers] = useState(false);
    const [reviewMoves, setReviewMoves] = useState<SgfMove[]>([]);

    useEffect(() => {
        setCurrentMoveIndex(totalMoves);
        setIsBoardRotated(defaultBoardRotatedForRecord(record));
        setIsReviewMode(false);
        setShowMoveNumbers(false);
        setReviewMoves([]);
    }, [record.id, record.myColor, totalMoves]);

    useEffect(() => {
        setReviewMoves([]);
    }, [currentMoveIndex]);

    const isMobileFullViewer = fitContainer && !isInline && Boolean(onClose);

    useEffect(() => {
        if (!useResponsiveBoard || !boardAreaRef.current) return;
        const el = boardAreaRef.current;
        const ro = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            const rotateReserve = isInline && !isMobileFullViewer ? ROTATE_BTN_RESERVE : 0;
            const byWidth = width - rotateReserve;
            const side =
                fitContainer && !isInline
                    ? byWidth
                    : Math.min(byWidth, height > 0 ? height : byWidth);
            if (side > 0) setBoardPx(Math.max(isInline ? 200 : 160, Math.floor(side)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [useResponsiveBoard, isInline, fitContainer, isMobileFullViewer, record.id]);

    const canGoBack = currentMoveIndex > 0;
    const canGoForward = currentMoveIndex < totalMoves;

    const goTo = useCallback(
        (index: number) => {
            setCurrentMoveIndex(Math.max(0, Math.min(index, totalMoves)));
        },
        [totalMoves],
    );

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
    const myColorLabel = record.myColor === Player.Black ? t('common:black') : record.myColor === Player.White ? t('common:white') : null;

    const infoRow = (label: string, value: React.ReactNode) => (
        <div className="border-b border-dashed border-white/[0.06] pb-2 last:border-0 last:pb-0">
            <dt className={`mb-0.5 font-medium uppercase tracking-wide text-slate-500 ${isInline ? 'text-[10px]' : 'text-[11px]'}`}>
                {label}
            </dt>
            <dd className={`font-semibold text-amber-50/95 ${isInline ? 'text-xs' : 'text-sm'}`}>{value}</dd>
        </div>
    );

    const rotateButton = (
        <button
            type="button"
            onClick={() => setIsBoardRotated((prev) => !prev)}
            className={`flex shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-zinc-950/90 text-amber-100 shadow-lg backdrop-blur-sm transition hover:border-amber-300/50 hover:bg-zinc-900/95 ${
                isInline ? 'h-8 w-8' : 'h-9 w-9'
            }`}
            title={isBoardRotated ? t('common:rotateToBlack') : t('common:rotateToWhite')}
            aria-label={isBoardRotated ? t('common:rotateToBlack') : t('common:rotateToWhite')}
        >
            <svg
                className={isInline ? 'h-4 w-4' : 'h-5 w-5'}
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
    );

    const boardCanvas = (
        <div
            className={`relative shrink-0 ${isInline || fitContainer ? '' : 'min-w-0 flex-1'}`}
            style={
                useResponsiveBoard
                    ? { width: boardPx, height: boardPx }
                    : {
                          width: MODAL_BOARD_PX,
                          maxWidth: 'min(840px, calc(100dvh - 220px), calc(100vw - 300px))',
                          aspectRatio: '1 / 1',
                      }
            }
        >
            <SgfViewer
                timeElapsed={0}
                fileIndex={null}
                showLastMoveOnly={false}
                sgfContent={record.sgfContent}
                isRotated={isBoardRotated}
                replayMoveCount={currentMoveIndex}
                boardSizePx={useResponsiveBoard ? boardPx : MODAL_BOARD_PX}
                showMoveNumbers={showMoveNumbers}
                interactive={isReviewMode}
                onIntersectionClick={handleIntersectionClick}
                onHalfBoardNavBack={handlePrevious}
                onHalfBoardNavForward={handleNext}
                reviewMoves={reviewMoves}
            />
        </div>
    );

    const boardBlock = isMobileFullViewer ? (
        <div className="flex w-full shrink-0 justify-center">{boardCanvas}</div>
    ) : (
        <div className={`flex shrink-0 items-start ${isInline ? 'gap-2' : 'w-full gap-2.5'}`}>
            {boardCanvas}
            {rotateButton}
        </div>
    );

    const reviewButtons = (
        <div className="flex shrink-0 items-center gap-1.5">
            <button
                type="button"
                onClick={() => setShowMoveNumbers((v) => !v)}
                className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-semibold transition sm:px-3.5 sm:py-2 ${
                    showMoveNumbers
                        ? 'border-violet-400/50 bg-violet-950/70 text-violet-100 ring-1 ring-violet-400/30'
                        : 'border-amber-400/35 bg-zinc-900/80 text-amber-100/95 hover:border-amber-400/55 hover:bg-zinc-800/90'
                }`}
            >
                수순
            </button>
            <button
                type="button"
                onClick={() => {
                    setIsReviewMode((v) => !v);
                    if (isReviewMode) setReviewMoves([]);
                }}
                className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-semibold transition sm:px-3.5 sm:py-2 ${
                    isReviewMode
                        ? 'border-sky-400/50 bg-sky-950/70 text-sky-100 ring-1 ring-sky-400/30'
                        : 'border-amber-400/35 bg-zinc-900/80 text-amber-100/95 hover:border-amber-400/55 hover:bg-zinc-800/90'
                }`}
            >
                {isReviewMode ? t('common:originalGame') : t('gameRecords.tryPlacement')}
            </button>
            {reviewMoves.length > 0 && (
                <button
                    type="button"
                    onClick={clearReviewMoves}
                    className="whitespace-nowrap rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-black/55"
                >
                    검토 수 지우기
                </button>
            )}
        </div>
    );

    const moveCountLabel = (
        <p className={`shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-400 ${isInline ? 'text-sm sm:text-base' : 'text-base'}`}>
            {t('gameRecords.movesLabel')} <span className="text-amber-200">{currentMoveIndex}</span>
            <span className="text-slate-600"> / </span>
            {totalMoves}
        </p>
    );

    const controlsBlock = isInline ? (
        <div className="flex w-full shrink-0 flex-col gap-1.5">
            <div className="flex w-full items-center gap-1.5">
                {moveCountLabel}
                <div className="flex min-w-0 flex-1 items-center justify-center">
                    <GameRecordReplayNav
                        onFirst={handleFirst}
                        onBack5={handleBack5}
                        onBack1={handlePrevious}
                        onForward1={handleNext}
                        onForward5={handleForward5}
                        onLast={handleLast}
                        canGoBack={canGoBack}
                        canGoForward={canGoForward}
                        compact
                    />
                </div>
                {reviewButtons}
            </div>
        </div>
    ) : (
        <div className={`flex w-full flex-col items-center gap-2 max-w-[840px]`}>
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
                {moveCountLabel}
                {reviewButtons}
            </div>
        </div>
    );

    const infoAside = (
        <>
            <div
                className={`rounded-xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black shadow-[0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.06] ${
                    isInline ? 'p-2.5' : 'rounded-2xl p-4'
                }`}
            >
                <h3
                    className={`mb-2 border-b border-amber-500/20 pb-1.5 font-bold uppercase tracking-widest text-amber-200/85 ${
                        isInline ? 'text-[10px]' : 'text-xs'
                    }`}
                >
                    대국 정보
                </h3>
                <dl className="space-y-2">
                    {infoRow(t('common:opponent'), record.opponent.nickname)}
                    {myColorLabel && infoRow(t('common:myColor'), myColorLabel)}
                    {infoRow(t('game:gameRecord.mode'), localizedGameMode(record.mode as any) || record.mode)}
                    {infoRow(t('game:gameRecord.date'), new Date(record.date).toLocaleString('ko-KR'))}
                    {infoRow(t('game:gameRecord.result'), <span className="text-amber-200">{resultLabel}</span>)}
                </dl>
            </div>

            {scoreDetails ? (
                <div
                    className={`rounded-xl border border-sky-500/15 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black shadow-[0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.06] ${
                        isInline ? 'p-2.5' : 'rounded-2xl p-4'
                    }`}
                >
                    <h3
                        className={`mb-2 border-b border-sky-500/25 pb-1.5 font-bold uppercase tracking-widest text-sky-200/85 ${
                            isInline ? 'text-[10px]' : 'text-xs'
                        }`}
                    >
                        점수 상세
                    </h3>
                    <div className="space-y-2 text-[11px] text-slate-400">
                        <div>
                            <div className="mb-0.5 font-semibold text-sky-200/90">{t('gameRecords.blackScoreLine', { score: record.gameResult.blackScore })}</div>
                            {scoreDetails.black.timeBonus > 0 && (
                                <div className="text-amber-200/90">{t('gameRecords.timeBonusLong', { bonus: scoreDetails.black.timeBonus })}</div>
                            )}
                            {scoreDetails.black.baseStoneBonus > 0 && (
                                <div className="text-sky-300/90">{t('gameRecords.baseBonusLong', { bonus: scoreDetails.black.baseStoneBonus })}</div>
                            )}
                            {scoreDetails.black.hiddenStoneBonus > 0 && (
                                <div className="text-violet-300/90">{t('gameRecords.hiddenBonusLong', { bonus: scoreDetails.black.hiddenStoneBonus })}</div>
                            )}
                            {scoreDetails.black.itemBonus > 0 && (
                                <div className="text-emerald-300/90">{t('gameRecords.itemBonusLong', { bonus: scoreDetails.black.itemBonus })}</div>
                            )}
                        </div>
                        <div className="border-t border-white/10 pt-1.5">
                            <div className="mb-0.5 font-semibold text-amber-200/90">{t('gameRecords.whiteScoreLine', { score: record.gameResult.whiteScore })}</div>
                            {scoreDetails.white.timeBonus > 0 && (
                                <div className="text-amber-200/90">{t('gameRecords.timeBonusLong', { bonus: scoreDetails.white.timeBonus })}</div>
                            )}
                            {scoreDetails.white.baseStoneBonus > 0 && (
                                <div className="text-sky-300/90">{t('gameRecords.baseBonusLong', { bonus: scoreDetails.white.baseStoneBonus })}</div>
                            )}
                            {scoreDetails.white.hiddenStoneBonus > 0 && (
                                <div className="text-violet-300/90">{t('gameRecords.hiddenBonusLong', { bonus: scoreDetails.white.hiddenStoneBonus })}</div>
                            )}
                            {scoreDetails.white.itemBonus > 0 && (
                                <div className="text-emerald-300/90">{t('gameRecords.itemBonusLong', { bonus: scoreDetails.white.itemBonus })}</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-[4rem] items-center justify-center rounded-xl border border-dashed border-white/12 bg-black/25 p-3 text-center text-[11px] text-slate-500 ring-1 ring-inset ring-white/[0.04]">
                    점수 상세 없음
                </div>
            )}
        </>
    );

    if (isInline) {
        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-1 sm:p-2">
                <div
                    ref={boardAreaRef}
                    className="flex min-h-0 flex-1 items-center justify-center"
                >
                    {boardBlock}
                </div>
                {controlsBlock}
            </div>
        );
    }

    if (isMobileFullViewer) {
        const scoreLine = formatScoreDetailsOneLine(record);
        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="shrink-0 px-1 pb-1.5 pt-0.5">
                    <p
                        className="mb-1.5 overflow-x-auto whitespace-nowrap text-[10px] leading-snug text-slate-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        title={scoreLine}
                    >
                        {scoreLine}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                        {rotateButton}
                        <button
                            type="button"
                            onClick={onClose}
                            className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS}
                            aria-label={t('actions.close', { ns: 'common' })}
                        >
                            닫기
                        </button>
                    </div>
                </div>
                <div ref={boardAreaRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex min-h-0 flex-1 items-center justify-center">{boardBlock}</div>
                    <div className="mt-1 w-full shrink-0 pb-1">{controlsBlock}</div>
                </div>
            </div>
        );
    }

    return (
        <div ref={boardAreaRef} className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto lg:flex-row lg:gap-3">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center">
                {boardBlock}
                <div className="mt-2 w-full">{controlsBlock}</div>
            </div>
            <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-[260px] xl:w-[280px]">{infoAside}</aside>
        </div>
    );
};

export default GameRecordViewerPanel;
