import React, { useEffect, useState } from 'react';
import { GameMode, LiveGameSession, ServerAction, User, GameStatus } from '../../types.js';
import KomiBiddingPanel from '../KomiBiddingPanel.js';
import { BaseColorRouletteContent } from '../BaseColorRouletteModal.js';

const BASE_PLACEMENT_TIME_LIMIT_SEC = 30;

const BASE_FOOTER_PHASES: readonly GameStatus[] = [
    'base_placement',
    'komi_bidding',
    'komi_bid_reveal',
    'base_color_roulette',
    'base_komi_result',
    'base_game_start_confirmation',
];

export function sessionUsesBaseBottomStrip(session: LiveGameSession): boolean {
    return (
        session.mode === GameMode.Base ||
        (session.mode === GameMode.Mix && Boolean(session.settings.mixedModes?.includes(GameMode.Base)))
    );
}

export function isBaseGameFooterPhase(session: LiveGameSession): boolean {
    return sessionUsesBaseBottomStrip(session) && BASE_FOOTER_PHASES.includes(session.gameStatus);
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
    const myPlacements =
        viewerUserId === player1.id
            ? session.baseStones_p1?.length ?? 0
            : viewerUserId === player2.id
              ? session.baseStones_p2?.length ?? 0
              : null;

    if (myPlacements === null) return null;

    const isDonePlacing = myPlacements >= baseStoneCount;
    const showPlacementTools = true;
    const canRandomFill = showPlacementTools && myPlacements < baseStoneCount;
    const canResetOrUndo = showPlacementTools && myPlacements > 0;

    const btnBase = `rounded-md border px-1.5 py-1.5 text-center font-bold transition-colors ${
        isSinglePlayer
            ? 'border-amber-500/50 bg-amber-900/40 text-amber-50 hover:bg-amber-800/45'
            : 'border-cyan-400/45 bg-cyan-950/50 text-cyan-50 hover:bg-cyan-900/45'
    } ${isMobile ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight sm:text-[11px]'}`;

    const placementCompleteLabel = isDonePlacing ? '배치 완료' : '배치 완료(자동)';

    return (
        <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center justify-center gap-1">
            {canRandomFill && (
                <button
                    type="button"
                    onClick={() => onAction({ type: 'PLACE_REMAINING_BASE_STONES_RANDOMLY', payload: { gameId } })}
                    className={`${btnBase} min-w-0 max-w-[44%] shrink sm:max-w-none`}
                    title="남은 돌 무작위 배치"
                >
                    무작위 배치
                </button>
            )}
            {canResetOrUndo && (
                <>
                    <button
                        type="button"
                        onClick={() => onAction({ type: 'RESET_MY_BASE_STONE_PLACEMENTS', payload: { gameId } })}
                        className={`${btnBase} shrink-0 px-1.5`}
                    >
                        재배치
                    </button>
                    <button
                        type="button"
                        onClick={() => onAction({ type: 'UNDO_LAST_BASE_STONE_PLACEMENT', payload: { gameId } })}
                        className={`${btnBase} shrink-0 px-1.5`}
                    >
                        취소
                    </button>
                </>
            )}
            <button
                type="button"
                disabled
                className={`${btnBase} shrink-0 cursor-not-allowed opacity-60`}
                title="남은 베이스돌을 모두 놓으면 자동으로 다음 단계로 진행됩니다."
            >
                {placementCompleteLabel}
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

    if (gameStatus === 'komi_bidding') {
        return (
            <div className="flex w-full min-w-0 flex-col gap-1">
                <KomiBiddingPanel session={session} currentUser={currentUser} onAction={onAction as (a: ServerAction) => void} layout="inline" />
            </div>
        );
    }

    if (gameStatus === 'komi_bid_reveal') {
        return (
            <div className="w-full min-w-0 px-1 py-1 text-center text-[11px] leading-snug text-stone-500 sm:text-xs">
                덤 설정 결과는 화면 중앙 모달에서 확인하세요.
            </div>
        );
    }

    if (gameStatus === 'base_color_roulette') {
        return (
            <div className="flex w-full min-w-0 max-h-[min(48vh,380px)] flex-col gap-0 overflow-y-auto">
                <BaseColorRouletteContent session={session} />
            </div>
        );
    }

    if (gameStatus === 'base_komi_result' || gameStatus === 'base_game_start_confirmation') {
        return (
            <div className="w-full min-w-0 px-1 py-1 text-center text-[11px] leading-snug text-stone-500 sm:text-xs">
                흑·백·덤 확정과 대국 시작은 화면 중앙 모달에서 진행합니다.
            </div>
        );
    }

    const baseStoneCount = session.settings.baseStones ?? 4;
    const { player1, player2 } = session;
    const viewerUserId = currentUser.id;
    const myPlacements =
        viewerUserId === player1.id
            ? session.baseStones_p1?.length ?? 0
            : viewerUserId === player2.id
              ? session.baseStones_p2?.length ?? 0
              : null;

    const [basePlacementSecondsLeft, setBasePlacementSecondsLeft] = useState(0);
    useEffect(() => {
        if (!session.basePlacementDeadline) {
            setBasePlacementSecondsLeft(0);
            return;
        }
        const tick = () => {
            setBasePlacementSecondsLeft(Math.max(0, Math.ceil((session.basePlacementDeadline! - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [session.basePlacementDeadline]);

    const isDonePlacing = myPlacements !== null && myPlacements >= baseStoneCount;
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

    const isAdventureVsAi = session.gameCategory === 'adventure' && session.isAiGame;

    let primaryLine: string;
    if (myPlacements === null) {
        primaryLine = '베이스돌 배치 단계입니다.';
    } else if (isDonePlacing) {
        primaryLine = '배치 완료 · 상대 배치 대기 중…';
    } else {
        const hint = isAdventureVsAi ? '베이스돌을 바둑판에 놓으세요' : '상대에게 보이지 않게 베이스돌을 바둑판에 놓으세요';
        const parts = [hint, `배치 ${myPlacements}/${baseStoneCount}`];
        if (hasDeadline && secLeft !== null && session.gameCategory !== 'adventure') {
            parts.push(`남은 시간 ${secLeft}초`);
        }
        primaryLine = parts.join(' · ');
    }

    const showPlacementTools = myPlacements !== null;
    const canRandomFill = showPlacementTools && myPlacements! < baseStoneCount;
    const canResetOrUndo = showPlacementTools && myPlacements! > 0;

    const btnBase = `rounded-lg border px-2 py-2 text-center text-[10px] font-bold transition-colors sm:text-xs ${
        isSinglePlayer
            ? 'border-amber-500/50 bg-amber-900/40 text-amber-50 hover:bg-amber-800/45'
            : 'border-cyan-400/45 bg-cyan-950/50 text-cyan-50 hover:bg-cyan-900/45'
    }`;

    const placementCompleteLabel = isDonePlacing ? '배치 완료' : '배치 완료 (자동 진행)';
    const placementCompleteTitle = isDonePlacing
        ? '상대가 배치를 끝내면 다음 단계로 넘어갑니다.'
        : `남은 돌 ${Math.max(0, baseStoneCount - (myPlacements ?? 0))}개를 모두 놓으면 자동으로 진행됩니다.`;

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
                {canRandomFill && (
                    <button
                        type="button"
                        onClick={() => onAction({ type: 'PLACE_REMAINING_BASE_STONES_RANDOMLY', payload: { gameId } })}
                        className={`${btnBase} min-w-[6rem] flex-1 sm:min-w-0`}
                    >
                        남은 돌 무작위 배치
                    </button>
                )}
                {canResetOrUndo && (
                    <>
                        <button
                            type="button"
                            onClick={() => onAction({ type: 'RESET_MY_BASE_STONE_PLACEMENTS', payload: { gameId } })}
                            className={`${btnBase} min-w-[3.5rem] flex-1 sm:flex-none`}
                        >
                            재배치
                        </button>
                        <button
                            type="button"
                            onClick={() => onAction({ type: 'UNDO_LAST_BASE_STONE_PLACEMENT', payload: { gameId } })}
                            className={`${btnBase} min-w-[3.5rem] flex-1 sm:flex-none`}
                        >
                            마지막 취소
                        </button>
                    </>
                )}
                <button
                    type="button"
                    disabled
                    className={`${btnBase} min-w-[5rem] flex-1 cursor-not-allowed opacity-60`}
                    title={placementCompleteTitle}
                >
                    {placementCompleteLabel}
                </button>
            </div>
        </div>
    );
};

export default BaseGameFooterPanel;
