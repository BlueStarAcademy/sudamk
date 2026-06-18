import React, { useEffect, useState } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { GameMode, LiveGameSession, ServerAction, User, GameStatus } from '../../types.js';
import BaseStoneColorChoicePanel from '../BaseStoneColorChoicePanel.js';
import BaseSameColorPointsBidPanel from '../BaseSameColorPointsBidPanel.js';
import { getEffectivePairLobbyOwnerId } from '../../shared/utils/effectivePairLobbyOwnerId.js';
import { modeIncludesBaseCaptureMix } from '../../shared/utils/liveSessionArenaKind.js';
import BaseCaptureMixBidFooterStrip from './BaseCaptureMixBidFooterStrip.js';

const BASE_PLACEMENT_TIME_LIMIT_SEC = 30;

const BASE_FOOTER_PHASES: readonly GameStatus[] = [
    'base_placement',
    'base_stone_color_choice',
    'base_same_color_points_bid',
    'base_game_start_confirmation',
];

export function sessionUsesBaseBottomStrip(session: LiveGameSession): boolean {
    return (
        session.mode === GameMode.Base ||
        (session.mode === GameMode.Mix && Boolean(session.settings.mixedModes?.includes(GameMode.Base)))
    );
}

export function isBaseGameFooterPhase(session: LiveGameSession): boolean {
    if (!sessionUsesBaseBottomStrip(session)) return false;
    if (BASE_FOOTER_PHASES.includes(session.gameStatus)) return true;
    return modeIncludesBaseCaptureMix(session.mode, session.settings) && session.gameStatus === 'capture_bidding';
}

interface BaseGameFooterPanelProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    isMobile: boolean;
    isSinglePlayer?: boolean;
    /** 베이스 배치: 상단 버튼 패널에 액션을 올릴 때 타·문구·버튼 행 생략 */
    hideBasePlacementActions?: boolean;
}

/** 경기장 푸터 기권 자리에 넣는 베이스 배치 액션(높이 기권 버튼 열과 맞춤) */
export const BasePlacementControlStrip: React.FC<{
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    isMobile: boolean;
    isSinglePlayer?: boolean;
}> = ({ session, currentUser, onAction, isMobile, isSinglePlayer = false }) => {
    const { id: gameId } = session;
    const baseStoneCount = session.settings.baseStones ?? 4;
    const { player1, player2 } = session;
    const viewerUserId = currentUser.id;
    const pairLobbyOwnerId = getEffectivePairLobbyOwnerId(session);
    const isPairHostPlacement = Boolean(pairLobbyOwnerId && viewerUserId === pairLobbyOwnerId);
    const n1s = session.baseStones_p1?.length ?? 0;
    const n2s = session.baseStones_p2?.length ?? 0;
    const myPlacements = pairLobbyOwnerId
        ? isPairHostPlacement
            ? n1s < baseStoneCount
                ? n1s
                : n2s
            : null
        : viewerUserId === player1.id
          ? n1s
          : viewerUserId === player2.id
            ? n2s
            : null;

    if (myPlacements === null) return null;

    const stripBasePlacementComplete = pairLobbyOwnerId
        ? n1s >= baseStoneCount && n2s >= baseStoneCount
        : myPlacements >= baseStoneCount;
    const myReady = pairLobbyOwnerId
        ? Boolean(session.basePlacementReady?.[player1.id] && session.basePlacementReady?.[player2.id])
        : Boolean(session.basePlacementReady?.[viewerUserId]);
    const showPlacementTools = true;
    const canRandomFill =
        showPlacementTools &&
        (pairLobbyOwnerId ? n1s < baseStoneCount || n2s < baseStoneCount : myPlacements < baseStoneCount);
    const canResetPlacement = showPlacementTools && (pairLobbyOwnerId ? n1s + n2s > 0 : myPlacements > 0);

    const btnBase = `rounded-lg border text-center font-bold transition-colors ${
        isSinglePlayer
            ? 'border-amber-500/50 bg-amber-900/40 text-amber-50 hover:bg-amber-800/45'
            : 'border-cyan-400/45 bg-cyan-950/50 text-cyan-50 hover:bg-cyan-900/45'
    } ${isMobile ? 'min-h-[2rem] px-2 py-1.5 text-[10px] leading-tight' : 'min-h-[2.15rem] px-2 py-1.5 text-[11px] sm:text-xs'}`;

    return (
        <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-stretch justify-center gap-1.5 gap-y-2">
            <button
                type="button"
                disabled={!canRandomFill}
                onClick={() =>
                    canRandomFill && onAction({ type: 'PLACE_REMAINING_BASE_STONES_RANDOMLY', payload: { gameId } })
                }
                className={`${btnBase} min-w-0 flex-1 basis-[42%] sm:basis-auto sm:min-w-[7rem] ${
                    !canRandomFill ? 'cursor-not-allowed opacity-55' : ''
                }`}
                title={canRandomFill ? t('baseFooter.randomPlaceTitle') : t('baseFooter.randomPlaceDisabled')}
            >
                랜덤 배치
            </button>
            <button
                type="button"
                disabled={!canResetPlacement}
                onClick={() =>
                    canResetPlacement && onAction({ type: 'RESET_MY_BASE_STONE_PLACEMENTS', payload: { gameId } })
                }
                className={`${btnBase} min-w-[3.75rem] flex-1 sm:flex-none ${
                    !canResetPlacement ? 'cursor-not-allowed opacity-55' : ''
                }`}
                title={canResetPlacement ? t('baseFooter.resetTitle') : t('baseFooter.resetDisabled')}
            >
                재배치
            </button>
            <button
                type="button"
                disabled={!stripBasePlacementComplete || myReady}
                onClick={() =>
                    stripBasePlacementComplete &&
                    !myReady &&
                    onAction({ type: 'CONFIRM_BASE_PLACEMENT_COMPLETE', payload: { gameId } })
                }
                className={`${btnBase} min-w-[5.5rem] flex-1 sm:min-w-[6.5rem] ${
                    !stripBasePlacementComplete || myReady ? 'cursor-not-allowed opacity-55' : ''
                } ${stripBasePlacementComplete && !myReady ? (isSinglePlayer ? 'animate-base-complete-border-amber' : 'animate-base-complete-border-cyan') : ''}`}
                title={
                    myReady
                        ? t('baseFooter.waitingOpponent')
                        : stripBasePlacementComplete
                          ? t('baseFooter.confirmNextStep')
                          : t('baseFooter.placeAllFirst')
                }
            >
                {myReady ? t('baseFooter.confirmed') : t('baseFooter.confirmComplete')}
            </button>
        </div>
    );
};

const BaseGameFooterPanel: React.FC<BaseGameFooterPanelProps> = ({
    session,
    currentUser,
    onAction,
    isMobile,
    isSinglePlayer = false,
    hideBasePlacementActions = false,
}) => {
    const { gameStatus, id: gameId } = session;
    /** 싱글·PVP 인간 대국은 동일한 베이스 전 플로우 UI(앰버 톤); 로비 AI전만 기존 시안 톤 유지 */
    const unifiedBasePrePlayChrome = isSinglePlayer || !session.isAiGame;

    const [basePlacementSecondsLeft, setBasePlacementSecondsLeft] = useState(0);
    useEffect(() => {
        if (gameStatus !== 'base_placement' || !session.basePlacementDeadline) {
            setBasePlacementSecondsLeft(0);
            return;
        }
        const tick = () => {
            setBasePlacementSecondsLeft(Math.max(0, Math.ceil((session.basePlacementDeadline! - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [gameStatus, session.basePlacementDeadline]);

    if (modeIncludesBaseCaptureMix(session.mode, session.settings) && gameStatus === 'capture_bidding') {
        return (
            <div className="flex w-full min-w-0 flex-col gap-1">
                <BaseCaptureMixBidFooterStrip
                    session={session}
                    currentUser={currentUser}
                    onAction={onAction}
                    isMobile={isMobile}
                />
            </div>
        );
    }

    if (gameStatus === 'base_stone_color_choice') {
        return (
            <div className="flex w-full min-w-0 flex-col gap-1">
                <BaseStoneColorChoicePanel
                    session={session}
                    currentUser={currentUser}
                    onAction={onAction as (a: ServerAction) => void}
                    layout="inline"
                    isSinglePlayer={unifiedBasePrePlayChrome}
                />
            </div>
        );
    }

    if (gameStatus === 'base_same_color_points_bid') {
        return (
            <div className="flex w-full min-w-0 flex-col gap-1">
                <BaseSameColorPointsBidPanel
                    session={session}
                    currentUser={currentUser}
                    onAction={onAction as (a: ServerAction) => void}
                    layout="inline"
                    isSinglePlayer={unifiedBasePrePlayChrome}
                />
            </div>
        );
    }

    if (gameStatus === 'base_game_start_confirmation') {
        return (
            <div className="w-full min-w-0 px-1 py-1 text-center text-[11px] leading-snug text-stone-500 sm:text-xs">
                흑·백·덤 확정과 대국 시작은 화면 중앙 모달에서 진행합니다.
            </div>
        );
    }

    const baseStoneCount = session.settings.baseStones ?? 4;
    const { player1, player2 } = session;
    const viewerUserId = currentUser.id;
    const pairLobbyOwnerId = getEffectivePairLobbyOwnerId(session);
    const isPairHostPlacement = Boolean(pairLobbyOwnerId && viewerUserId === pairLobbyOwnerId);
    const n1c = session.baseStones_p1?.length ?? 0;
    const n2c = session.baseStones_p2?.length ?? 0;
    const myPlacements = pairLobbyOwnerId
        ? isPairHostPlacement
            ? n1c < baseStoneCount
                ? n1c
                : n2c
            : null
        : viewerUserId === player1.id
          ? n1c
          : viewerUserId === player2.id
            ? n2c
            : null;

    const hasDeadline = Boolean(session.basePlacementDeadline);
    const secLeft = hasDeadline ? basePlacementSecondsLeft : null;
    const barPct =
        hasDeadline && secLeft !== null
            ? Math.min(100, Math.max(0, (secLeft / BASE_PLACEMENT_TIME_LIMIT_SEC) * 100))
            : null;

    if (hideBasePlacementActions) {
        return (
            <div className={`flex w-full min-w-0 flex-col gap-1 ${isMobile ? 'px-0.5' : 'px-1'}`}>
                {barPct !== null && (
                    <div
                        className={`relative w-full flex-shrink-0 overflow-hidden rounded-full border-2 ${
                            isSinglePlayer ? 'border-black/20 bg-stone-900/70' : 'border-white/25 bg-slate-800/80'
                        } ${isMobile ? 'h-1.5' : 'h-1.5 sm:h-2'}`}
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                            style={{ width: `${barPct}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                )}
            </div>
        );
    }

    if (pairLobbyOwnerId && !isPairHostPlacement) {
        return (
            <div className={`flex w-full min-w-0 flex-col gap-2 ${isMobile ? 'px-0.5' : 'px-1'}`}>
                <p className="text-center text-[11px] font-semibold text-sky-200/95 sm:text-xs">{t('baseFooter.hostPlacesBoth')}</p>
                {barPct !== null && (
                    <div
                        className={`relative w-full flex-shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-slate-800/80 ${
                            isMobile ? 'h-1.5' : 'h-2'
                        }`}
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                            style={{ width: `${barPct}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                )}
            </div>
        );
    }

    const isAdventureVsAi = session.gameCategory === 'adventure' && session.isAiGame;

    const footerBasePlacementComplete = pairLobbyOwnerId
        ? n1c >= baseStoneCount && n2c >= baseStoneCount
        : myPlacements !== null && myPlacements >= baseStoneCount;
    const myReady = pairLobbyOwnerId
        ? Boolean(session.basePlacementReady?.[player1.id] && session.basePlacementReady?.[player2.id])
        : Boolean(viewerUserId && session.basePlacementReady?.[viewerUserId]);

    let primaryLine: string;
    if (myPlacements === null && !pairLobbyOwnerId) {
        primaryLine = t('baseFooter.basePlacementPhase');
    } else if (pairLobbyOwnerId && isPairHostPlacement && !footerBasePlacementComplete) {
        const side = n1c < baseStoneCount ? player1.nickname : player2.nickname;
        const cur = n1c < baseStoneCount ? n1c : n2c;
        const parts = [
            t('baseFooter.hostPlacementSide', { side }),
            t('turn.baseStonesRemaining', { remaining: Math.max(0, baseStoneCount - cur), total: baseStoneCount }),
        ];
        if (hasDeadline && secLeft !== null && session.gameCategory !== 'adventure') parts.push(t('baseFooter.timeRemainingSec', { sec: secLeft }));
        primaryLine = parts.join(' · ');
    } else if (footerBasePlacementComplete && !myReady) {
        primaryLine = t('baseFooter.confirmPlacementFull', { total: baseStoneCount });
    } else if (footerBasePlacementComplete && myReady) {
        primaryLine = pairLobbyOwnerId
            ? t('baseFooter.proceedingNext', { total: baseStoneCount })
            : t('baseFooter.waitingOpponentShort', { total: baseStoneCount });
    } else {
        const hint = isAdventureVsAi ? t('baseFooter.placeVisibleAdventure') : t('baseFooter.placeHidden');
        const remain = Math.max(0, baseStoneCount - (myPlacements ?? 0));
        const parts = [hint, t('turn.baseStonesRemaining', { remaining: remain, total: baseStoneCount })];
        if (hasDeadline && secLeft !== null && session.gameCategory !== 'adventure') {
            parts.push(t('baseFooter.timeRemainingSec', { sec: secLeft }));
        }
        primaryLine = parts.join(' · ');
    }

    const showPlacementTools = pairLobbyOwnerId ? isPairHostPlacement : myPlacements !== null;
    const canRandomFill = showPlacementTools && (pairLobbyOwnerId ? (n1c < baseStoneCount || n2c < baseStoneCount) : (myPlacements ?? 0) < baseStoneCount);
    const canResetPlacement = showPlacementTools && (pairLobbyOwnerId ? n1c + n2c > 0 : (myPlacements ?? 0) > 0);

    const btnBase = `rounded-lg border text-center font-bold transition-colors ${
        isSinglePlayer
            ? 'border-amber-500/50 bg-amber-900/40 text-amber-50 hover:bg-amber-800/45'
            : 'border-cyan-400/45 bg-cyan-950/50 text-cyan-50 hover:bg-cyan-900/45'
    } ${isMobile ? 'min-h-[2.05rem] px-2 py-1.5 text-[10px]' : 'min-h-[2.25rem] px-2.5 py-2 text-[11px] sm:text-xs'}`;

    return (
        <div className={`flex w-full min-w-0 flex-col gap-2 ${isMobile ? 'px-0.5' : 'px-1'}`}>
            <p
                className={`text-center font-bold tracking-wide text-stone-100 ${
                    isMobile ? 'text-[clamp(0.62rem,1.7vmin,0.72rem)]' : 'text-[clamp(0.72rem,1.8vmin,0.82rem)]'
                }`}
            >
                {primaryLine}
            </p>
            {barPct !== null && (
                <div
                    className={`relative w-full flex-shrink-0 overflow-hidden rounded-full border-2 ${
                        isSinglePlayer ? 'border-black/20 bg-stone-900/70' : 'border-white/25 bg-slate-800/80'
                    } ${isMobile ? 'h-1.5' : 'h-2'}`}
                >
                    <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                        style={{ width: `${barPct}%`, transition: 'width 0.35s linear' }}
                    />
                </div>
            )}
            <div className="flex w-full flex-wrap items-stretch justify-center gap-1.5 gap-y-2">
                <button
                    type="button"
                    disabled={!canRandomFill}
                    onClick={() =>
                        canRandomFill && onAction({ type: 'PLACE_REMAINING_BASE_STONES_RANDOMLY', payload: { gameId } })
                    }
                    className={`${btnBase} min-w-0 flex-1 basis-[44%] sm:min-w-[7.5rem] ${
                        !canRandomFill ? 'cursor-not-allowed opacity-55' : ''
                    }`}
                    title={canRandomFill ? t('baseFooter.randomPlaceTitle') : t('baseFooter.randomPlaceDisabled')}
                >
                    랜덤 배치
                </button>
                <button
                    type="button"
                    disabled={!canResetPlacement}
                    onClick={() =>
                        canResetPlacement && onAction({ type: 'RESET_MY_BASE_STONE_PLACEMENTS', payload: { gameId } })
                    }
                    className={`${btnBase} min-w-[4rem] flex-1 sm:flex-none ${
                        !canResetPlacement ? 'cursor-not-allowed opacity-55' : ''
                    }`}
                    title={canResetPlacement ? t('baseFooter.resetTitle') : t('baseFooter.resetDisabled')}
                >
                    재배치
                </button>
                <button
                    type="button"
                    disabled={!footerBasePlacementComplete || myReady}
                    onClick={() =>
                        footerBasePlacementComplete &&
                        !myReady &&
                        onAction({ type: 'CONFIRM_BASE_PLACEMENT_COMPLETE', payload: { gameId } })
                    }
                    className={`${btnBase} min-w-[5.5rem] flex-1 sm:min-w-[6.5rem] ${
                        !footerBasePlacementComplete || myReady ? 'cursor-not-allowed opacity-55' : ''
                    } ${footerBasePlacementComplete && !myReady ? (isSinglePlayer ? 'animate-base-complete-border-amber' : 'animate-base-complete-border-cyan') : ''}`}
                    title={
                        myReady
                            ? t('baseFooter.waitingOpponent')
                            : footerBasePlacementComplete
                              ? t('baseFooter.confirmNextStep')
                              : t('baseFooter.placeAllFirst')
                    }
                >
                    {myReady ? t('baseFooter.confirmed') : t('baseFooter.confirmComplete')}
                </button>
            </div>
        </div>
    );
};

export default BaseGameFooterPanel;
