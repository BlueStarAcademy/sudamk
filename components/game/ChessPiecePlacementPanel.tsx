import React, { useEffect, useMemo, useState } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { useI18nLanguage } from '../../shared/i18n/useI18nLanguage.js';
import type { ChessPieceType, LiveGameSession, ServerAction, User } from '../../types.js';
import { Player } from '../../types/enums.js';
import {
    CHESS_SETUP_PIECE_LIMITS,
    computeChessSetupDraftScore,
    countChessSetupDraftByType,
    getChessSetupBudgetFromSettings,
} from '../../shared/utils/chessGoPlacement.js';
import { sessionUsesChessGo } from '../../shared/utils/chessGoRules.js';
import ChessSetupPieceStonePreview, {
    getChessPieceCaptureValue,
    getInitialRemainingMoves,
} from './ChessSetupPieceStonePreview.js';
import { isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import {
    isPairChessSetupWaitingGuest,
    resolvePairChessSetupDraftKey,
} from '../../shared/utils/pairChessSetup.js';

const PANEL_SHELL_DESKTOP =
    'pointer-events-auto absolute left-1/2 top-1.5 z-40 w-[min(99%,46rem)] -translate-x-1/2 overflow-hidden rounded-[1.35rem] ' +
    'border border-amber-500/30 bg-[#0a0d14]/96 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_28px_60px_-20px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.09)] ' +
    'ring-1 ring-amber-400/15 backdrop-blur-xl sm:top-2';

const PANEL_SHELL_MOBILE =
    'pointer-events-auto relative z-40 w-full overflow-hidden rounded-xl ' +
    'border border-amber-500/30 bg-[#0a0d14]/96 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_12px_24px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.09)] ' +
    'ring-1 ring-amber-400/15 backdrop-blur-xl';

const PANEL_GLOW =
    'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(251,191,36,0.22),transparent_58%),radial-gradient(ellipse_60%_45%_at_100%_100%,rgba(45,212,191,0.08),transparent_50%)]';

const ACTION_BTN_BASE =
    'group relative overflow-hidden rounded-xl border font-bold tracking-wide transition-all duration-200 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-10px_rgba(0,0,0,0.75)] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-white/20 before:via-white/5 before:to-transparent before:opacity-90 ' +
    'after:pointer-events-none after:absolute after:inset-x-3 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/35 after:to-transparent ' +
    'hover:-translate-y-px hover:brightness-110 active:translate-y-px active:brightness-95 disabled:pointer-events-none disabled:opacity-40 disabled:grayscale disabled:shadow-none disabled:hover:translate-y-0';

const PIECE_ROW_MOBILE =
    'flex w-full min-w-0 flex-nowrap items-stretch gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-0.5 py-0.5 ' +
    'snap-x snap-mandatory touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] ' +
    '[scrollbar-color:rgba(251,191,36,0.45)_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/45';

interface ChessPiecePlacementPanelProps {
    session: LiveGameSession;
    currentUser: User;
    myPlayerEnum: Player;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    selectedPieceType: Exclude<ChessPieceType, 'king'> | null;
    onSelectPieceType: (type: Exclude<ChessPieceType, 'king'> | null) => void;
    isMobile?: boolean;
}

const ChessPiecePlacementPanel: React.FC<ChessPiecePlacementPanelProps> = ({
    session,
    currentUser,
    myPlayerEnum,
    onAction,
    selectedPieceType,
    onSelectPieceType,
    isMobile = false,
}) => {
    const { i18n } = useI18nLanguage('game');
    const pieceOptions = useMemo(
        (): { type: Exclude<ChessPieceType, 'king'>; label: string }[] => [
            { type: 'pawn', label: tx('game:chessPlacement.pawn') },
            { type: 'rook', label: tx('game:chessPlacement.rook') },
            { type: 'knight', label: tx('game:chessPlacement.knight') },
            { type: 'bishop', label: tx('game:chessPlacement.bishop') },
            { type: 'queen', label: tx('game:chessPlacement.queen') },
        ],
        [i18n.language],
    );
    const { id: gameId, settings, player1, player2, isAiGame, blackPlayerId, whitePlayerId } = session;
    const budget = getChessSetupBudgetFromSettings(
        settings.boardSize ?? 13,
        settings.chessPieceTotalScore,
        Boolean((session as { isRanked?: boolean }).isRanked),
    );
    const userId = currentUser.id;
    const isPairChess = isPairClassicGame(settings, session.mode);
    const pairSetupDraftKey = isPairChess ? resolvePairChessSetupDraftKey(session, userId) : userId;
    const isWaitingGuest = isPairChess && isPairChessSetupWaitingGuest(session, userId);
    const myDraft =
        pairSetupDraftKey != null ? (session.chessPiecePlacementDraft?.[pairSetupDraftKey] ?? []) : [];
    const usedScore = computeChessSetupDraftScore(myDraft);
    const counts = countChessSetupDraftByType(myDraft);
    const myReady = pairSetupDraftKey != null && Boolean(session.chessPiecePlacementReady?.[pairSetupDraftKey]);
    const opponentDraftKey =
        pairSetupDraftKey != null && blackPlayerId && whitePlayerId
            ? pairSetupDraftKey === blackPlayerId
                ? whitePlayerId
                : blackPlayerId
            : userId === player1.id
              ? player2.id
              : player1.id;
    const opponentReady = Boolean(session.chessPiecePlacementReady?.[opponentDraftKey]);
    const scoreRatio = budget > 0 ? Math.min(1, usedScore / budget) : 0;

    const [secondsLeft, setSecondsLeft] = useState(0);
    useEffect(() => {
        if (isAiGame || !session.chessPiecePlacementDeadline) {
            setSecondsLeft(0);
            return;
        }
        const tick = () => {
            setSecondsLeft(Math.max(0, Math.ceil((session.chessPiecePlacementDeadline! - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [isAiGame, session.chessPiecePlacementDeadline]);

    const stoneColor =
        myPlayerEnum === Player.Black || myPlayerEnum === Player.White ? myPlayerEnum : Player.Black;

    const actionBtnSize = isMobile ? 'min-h-[1.85rem] rounded-lg px-2 py-1 text-[10px]' : 'min-h-[3.1rem] px-4 py-2.5 text-sm';
    const panelShell = isMobile ? PANEL_SHELL_MOBILE : PANEL_SHELL_DESKTOP;

    const pieceButtons = useMemo(
        () =>
            pieceOptions.map(({ type, label }) => {
                const used = counts[type] ?? 0;
                const limit = CHESS_SETUP_PIECE_LIMITS[type];
                const cost = getChessPieceCaptureValue(type);
                const moves = getInitialRemainingMoves(type);
                const atLimit = used >= limit;
                const cantAfford = usedScore + cost > budget;
                const disabled = myReady || atLimit || cantAfford;
                const selected = selectedPieceType === type;
                return (
                    <button
                        key={type}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelectPieceType(selected ? null : type)}
                        title={tx('game:chessPlacement.pieceTitle', { label, moves, cost })}
                        className={[
                            'group relative flex flex-col items-center overflow-hidden border transition-all duration-200',
                            isMobile
                                ? 'snap-start w-[4.25rem] min-w-[4.25rem] shrink-0 rounded-lg px-1 py-1'
                                : 'rounded-2xl px-2 py-2 sm:px-2.5 sm:py-2.5 min-w-[5.5rem]',
                            selected
                                ? 'border-amber-300/70 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.28),transparent_55%),linear-gradient(165deg,#2a2218_0%,#12151c_55%,#07090f_100%)] shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_0_28px_-6px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] ring-2 ring-amber-400/50'
                                : 'border-white/[0.08] bg-[linear-gradient(165deg,rgba(30,35,48,0.95)_0%,rgba(12,14,20,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_24px_-14px_rgba(0,0,0,0.8)] hover:border-amber-500/25 hover:bg-[linear-gradient(165deg,rgba(38,44,58,0.98)_0%,rgba(14,16,24,0.99)_100%)]',
                            disabled
                                ? 'cursor-not-allowed opacity-40 grayscale'
                                : isMobile
                                  ? 'active:scale-[0.97]'
                                  : 'hover:-translate-y-0.5 active:translate-y-0',
                        ].join(' ')}
                    >
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/[0.07] to-transparent" />
                        {selected && (
                            <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-amber-200/20" />
                        )}
                        <ChessSetupPieceStonePreview
                            pieceType={type}
                            stoneColor={stoneColor}
                            size={isMobile ? 32 : 54}
                            selected={selected}
                        />
                        <span
                            className={`relative font-bold tracking-wide text-amber-50/95 ${isMobile ? 'mt-0.5 text-[9px] leading-tight' : 'mt-1 text-xs'}`}
                        >
                            {label}{' '}
                            <span className="font-extrabold text-amber-200">
                                {used}/{limit}
                            </span>
                        </span>
                        <span
                            className={`relative font-semibold tabular-nums text-slate-300 ${
                                isMobile
                                    ? 'mt-px text-[8px] leading-none'
                                    : 'mt-0.5 rounded-full border border-white/10 bg-black/35 px-1.5 py-px text-[9px]'
                            }`}
                        >
                            {tx('game:chessPlacement.pieceStat', { moves, cost })}
                        </span>
                    </button>
                );
            }),
        [
            budget,
            counts,
            myReady,
            onSelectPieceType,
            pieceOptions,
            selectedPieceType,
            stoneColor,
            usedScore,
            isMobile,
        ],
    );

    if (!sessionUsesChessGo(session) || session.gameStatus !== 'chess_piece_placement') {
        return null;
    }

    if (isWaitingGuest) {
        return (
            <div className={panelShell}>
                <div className={PANEL_GLOW} aria-hidden />
                <div className={`relative text-center ${isMobile ? 'px-3 py-2' : 'px-5 py-4'}`}>
                    <p className={`font-semibold text-sky-200/95 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        {tx('game:chessPlacement.hostPlacing')}
                    </p>
                    <p className={`text-stone-400 ${isMobile ? 'mt-0.5 text-[10px]' : 'mt-1.5 text-xs'}`}>
                        {tx('game:chessPlacement.hostPlacingHint')}
                    </p>
                </div>
            </div>
        );
    }

    if (pairSetupDraftKey == null) {
        return null;
    }

    const statusPills = !isAiGame && (
        <div
            className={`flex flex-wrap items-center ${
                isMobile ? 'mt-1 justify-between gap-1 text-[9px]' : 'justify-between gap-2 text-xs'
            }`}
        >
            {session.chessPiecePlacementDeadline ? (
                <span
                    className={`inline-flex items-center font-semibold text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                        isMobile
                            ? 'gap-1 rounded-full border border-amber-500/30 bg-[linear-gradient(135deg,rgba(69,26,3,0.85),rgba(24,16,8,0.95))] px-1.5 py-px'
                            : 'gap-1.5 rounded-full border border-amber-500/30 bg-[linear-gradient(135deg,rgba(69,26,3,0.85),rgba(24,16,8,0.95))] px-3 py-1'
                    }`}
                >
                    <span className={`relative flex ${isMobile ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70 opacity-60" />
                        <span className={`relative inline-flex rounded-full bg-amber-400 ${isMobile ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} />
                    </span>
                    <span className="tabular-nums">{tx('game:chessPlacement.secondsLeft', { sec: secondsLeft })}</span>
                </span>
            ) : (
                <span />
            )}
            <span
                className={[
                    'rounded-full border font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                    isMobile ? 'px-1.5 py-px' : 'px-3 py-1',
                    opponentReady
                        ? 'border-emerald-400/35 bg-emerald-950/50 text-emerald-200'
                        : 'border-slate-600/40 bg-slate-900/60 text-slate-400',
                ].join(' ')}
            >
                {opponentReady ? tx('game:chessPlacement.opponentReady') : tx('game:chessPlacement.opponentPlacing')}
            </span>
        </div>
    );

    const actionButtons = (
        <div className={`grid grid-cols-3 ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-2.5'}`}>
            <button
                type="button"
                disabled={myReady}
                className={`${ACTION_BTN_BASE} ${actionBtnSize} border-slate-500/35 bg-[linear-gradient(165deg,#334155_0%,#1e293b_48%,#0f172a_100%)] text-slate-100`}
                onClick={() => !myReady && onAction({ type: 'FILL_CHESS_SETUP_RANDOMLY', payload: { gameId } })}
            >
                <span className="relative z-[1]">{tx('game:chessPlacement.randomPlace')}</span>
            </button>
            <button
                type="button"
                disabled={myReady || myDraft.length === 0}
                className={`${ACTION_BTN_BASE} ${actionBtnSize} border-rose-500/30 bg-[linear-gradient(165deg,#7f1d1d_0%,#450a0a_52%,#1c0505_100%)] text-rose-50`}
                onClick={() => !myReady && onAction({ type: 'RESET_CHESS_SETUP_PLACEMENT', payload: { gameId } })}
            >
                <span className="relative z-[1]">{tx('game:chessPlacement.reset')}</span>
            </button>
            <button
                type="button"
                disabled={myReady}
                className={`${ACTION_BTN_BASE} ${actionBtnSize} border-emerald-400/45 bg-[linear-gradient(165deg,#047857_0%,#065f46_45%,#022c22_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_22px_-6px_rgba(52,211,153,0.35)]`}
                onClick={() => !myReady && onAction({ type: 'CONFIRM_CHESS_SETUP_PLACEMENT', payload: { gameId } })}
            >
                <span className="relative z-[1] flex items-center justify-center gap-1">
                    <span className={`leading-none ${isMobile ? 'text-xs' : 'text-base'}`}>✓</span>
                    {tx('game:chessPlacement.complete')}
                </span>
            </button>
        </div>
    );

    if (isMobile) {
        return (
            <div className={panelShell}>
                <div className={PANEL_GLOW} aria-hidden />
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
                <div className="relative px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-[10px] text-amber-200">
                            ♚
                        </span>
                        <h3 className="min-w-0 truncate bg-gradient-to-r from-amber-100 via-amber-50 to-teal-100 bg-clip-text text-[12px] font-extrabold tracking-tight text-transparent">
                            {tx('game:chessPlacement.title')}
                        </h3>
                        <div className="ml-auto flex items-center gap-1 rounded-md border border-amber-400/35 bg-[linear-gradient(145deg,#1a1510_0%,#0c0e14_45%,#050608_100%)] px-1.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <span className="whitespace-nowrap text-[8px] font-bold tracking-wide text-amber-200/85">
                                {tx('game:chessPlacement.totalScore')}
                            </span>
                            <span className="text-sm font-black leading-none tabular-nums text-amber-50">{usedScore}</span>
                            <span className="text-[10px] font-medium leading-none text-slate-500">/</span>
                            <span className="text-[11px] font-extrabold leading-none tabular-nums text-teal-100/90">
                                {budget}
                            </span>
                        </div>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-inset ring-white/10">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-teal-400 transition-[width] duration-300 ease-out"
                            style={{ width: `${scoreRatio * 100}%` }}
                        />
                    </div>
                    {statusPills}
                    {myReady && (
                        <p className="mt-1 truncate text-[9px] font-medium leading-tight text-emerald-200/90">
                            {isAiGame
                                ? tx('game:chessPlacement.completeStarting')
                                : tx('game:chessPlacement.completeWaiting')}
                        </p>
                    )}
                    <div className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/25 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className={PIECE_ROW_MOBILE}>{pieceButtons}</div>
                    </div>
                    <div className="mt-1.5">{actionButtons}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={panelShell}>
            <div className={PANEL_GLOW} aria-hidden />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />

            <div className="relative px-5 py-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-xs text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                                ♚
                            </span>
                            <h3 className="bg-gradient-to-r from-amber-100 via-amber-50 to-teal-100 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
                                {tx('game:chessPlacement.title')}
                            </h3>
                        </div>
                        {!myReady && (
                            <p className="mt-1.5 max-w-[14rem] text-xs font-medium leading-snug text-teal-100/90 sm:max-w-none">
                                {tx('game:chessPlacement.hint')}
                            </p>
                        )}
                        {myReady && (
                            <p className="mt-1.5 max-w-[14rem] text-xs font-medium leading-snug text-emerald-200/90 sm:max-w-none">
                                {isAiGame
                                    ? tx('game:chessPlacement.completeStarting')
                                    : tx('game:chessPlacement.completeWaiting')}
                            </p>
                        )}
                    </div>

                    <div className="relative min-w-[10rem] overflow-hidden rounded-2xl border border-amber-400/35 bg-[linear-gradient(145deg,#1a1510_0%,#0c0e14_45%,#050608_100%)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_28px_-12px_rgba(0,0,0,0.85),0_0_24px_-8px_rgba(251,191,36,0.25)] ring-1 ring-amber-300/15">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(251,191,36,0.18),transparent_55%)]" />
                        <div className="relative text-center">
                            <span className="text-xs font-bold tracking-wide text-amber-200/85">
                                {tx('game:chessPlacement.totalScore')}
                            </span>
                        </div>
                        <div className="relative mt-1 flex items-end justify-center gap-1.5 tabular-nums">
                            <span className="text-3xl font-black leading-none text-amber-50">{usedScore}</span>
                            <span className="pb-0.5 text-base font-medium text-slate-500">/</span>
                            <span className="pb-0.5 text-xl font-extrabold text-teal-100/90">{budget}</span>
                        </div>
                        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-inset ring-white/10">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-teal-400 shadow-[0_0_10px_rgba(251,191,36,0.45)] transition-[width] duration-300 ease-out"
                                style={{ width: `${scoreRatio * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {!isAiGame && <div className="mb-3">{statusPills}</div>}

                <div className="mb-3 rounded-2xl border border-white/[0.06] bg-black/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-3">
                    <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-2.5">{pieceButtons}</div>
                </div>

                {actionButtons}
            </div>

            <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/20 to-transparent" />
        </div>
    );
};

export default ChessPiecePlacementPanel;
