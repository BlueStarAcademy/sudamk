/**
 * 길드 전쟁 — 히든 바둑 전용 하단 컨트롤.
 * 도전의 탑 21층+ 히든·스캔 UI와 동일한 형태이며, 탑 전용 파일과 분리됨.
 */
import React, { useMemo } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonGridClass,
    arenaPostGamePanelShellClass,
} from './arenaPostGameButtonStyles.js';
import {
    arenaGameRoomIngameBottomBarShellClass,
    arenaGameRoomIngameInnerItemSurfaceClass,
    arenaGameRoomIngameInnerNeutralSurfaceClass,
    pveIngameFooterReservedHeightClass,
} from './arenaGameRoomStyles.js';

interface GuildWarHiddenTowerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    setShowResultModal?: (show: boolean) => void;
    setConfirmModalType?: (type: 'resign' | null) => void;
    isMoveInFlight?: boolean;
    isBoardLocked?: boolean;
    isMobile?: boolean;
}

interface ImageButtonProps {
    src: string;
    alt: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    count?: number;
    compact?: boolean;
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, count, compact = false }) => {
    const sizeClass = compact
        ? 'h-16 w-16 shrink-0 rounded-xl sm:h-[4.25rem] sm:w-[4.25rem] md:h-[4.5rem] md:w-[4.5rem]'
        : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16';
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            title={title}
            className={`relative ${sizeClass} border-2 border-amber-400 transition-transform duration-200 ease-out overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-900 ${disabled ? 'opacity-40 cursor-not-allowed border-gray-700' : 'hover:scale-105 active:scale-95 shadow-lg'}`}
        >
            <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain pointer-events-none p-1.5" />
            {count !== undefined && (
                <div
                    className={`absolute -bottom-0.5 -right-0.5 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-purple-900 ${
                        count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'
                    }`}
                >
                    {count}
                </div>
            )}
        </button>
    );
};

const GuildWarHiddenTowerControls: React.FC<GuildWarHiddenTowerControlsProps> = ({
    session,
    onAction,
    currentUser,
    setShowResultModal,
    setConfirmModalType,
    isMoveInFlight = false,
    isBoardLocked = false,
    isMobile = false,
}) => {
    const gameStatus = session.gameStatus;
    const isMyTurn = session.currentPlayer === Player.Black;
    const myPlayerEnum = currentUser.id === session.blackPlayerId ? Player.Black : Player.White;
    const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
    const lastMove = session.moveHistory?.length ? session.moveHistory[session.moveHistory.length - 1] : null;
    const lastMoveWasBlack = !!(lastMove && lastMove.player === Player.Black);
    const allowScanAfterMyMove = gameStatus === 'playing' && lastMoveWasBlack && !isMyTurn;
    const canStartScanTurn = isMyTurn || allowScanAfterMyMove;
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;

    const uid = currentUser?.id;
    const canScan = useMemo(() => {
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;
        const scannedAiInitialByMe = !!uid && !!(session as any).scannedAiInitialHiddenByUser?.[uid];
        const aiInitial = (session as any).aiInitialHiddenStone as { x: number; y: number } | undefined;
        const aiPre = (session as any).aiInitialHiddenStoneIsPrePlaced;
        if (aiInitial && !aiPre) {
            const { x, y } = aiInitial;
            if (y >= 0 && y < board.length && x >= 0 && x < board[y].length && board[y][x] === opponentPlayerEnum) {
                const perm = session.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y);
                if (!perm && !scannedAiInitialByMe) return true;
            }
        }
        if (!session.hiddenMoves || !session.moveHistory) return false;
        const myRevealed = uid ? session.revealedHiddenMoves?.[uid] : undefined;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const idx = parseInt(moveIndexStr, 10);
            if (myRevealed?.includes(idx)) return false;
            const move = session.moveHistory![idx];
            if (!move || move.player !== opponentPlayerEnum || move.x < 0 || move.y < 0) return false;
            const { x, y } = move;
            if (y < 0 || y >= board.length || x < 0 || x >= board[y].length || board[y][x] !== opponentPlayerEnum) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [
        session.hiddenMoves,
        session.moveHistory,
        session.permanentlyRevealedStones,
        session.boardState,
        session.revealedHiddenMoves,
        (session as any).aiInitialHiddenStone,
        (session as any).aiInitialHiddenStoneIsPrePlaced,
        (session as any).scannedAiInitialHiddenByUser,
        opponentPlayerEnum,
        uid,
    ]);

    const hiddenMaxCount = (session.settings as { hiddenStoneCount?: number })?.hiddenStoneCount ?? 3;
    const scanMaxCount = (session.settings as { scanCount?: number })?.scanCount ?? 2;
    const hiddenLeft = session.hidden_stones_p1 ?? hiddenMaxCount;
    const scansLeft = session.scans_p1 ?? scanMaxCount;

    const hiddenDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !isMyTurn ||
        gameStatus !== 'playing' ||
        hiddenLeft <= 0;

    const scanDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !canStartScanTurn ||
        gameStatus !== 'playing' ||
        scansLeft <= 0 ||
        !canScan;

    const handleForfeit = () => setConfirmModalType?.('resign');

    const handleUseHidden = () => {
        if (hiddenDisabled) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_HIDDEN_PLACEMENT',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const handleUseScan = () => {
        if (scanDisabled) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_SCANNING',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    if (gameStatus === 'ended' || gameStatus === 'no_contest') {
        const handleShowResults = () => setShowResultModal?.(true);
        const handleExit = async () => {
            sessionStorage.setItem('postGameRedirect', '#/guildwar');
            try {
                await onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
            } catch {
                /* still navigate */
            }
            replaceAppHash('#/guildwar');
        };

        return (
            <footer
                className={`responsive-controls flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-2 p-2 ${pveIngameFooterReservedHeightClass(!!isMobile)} ${arenaGameRoomIngameBottomBarShellClass}`}
            >
                <div className={arenaPostGamePanelShellClass}>
                    <div className={arenaPostGameButtonGridClass}>
                    <Button
                        bare
                        onClick={handleShowResults}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}
                    >
                        결과 보기
                    </Button>
                    <Button
                        bare
                        onClick={handleExit}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}
                    >
                        대기실로
                    </Button>
                    </div>
                </div>
            </footer>
        );
    }

    const colClass = isMobile ? 'flex flex-col items-center gap-1 shrink-0' : 'flex flex-col items-center gap-1.5';
    const lbl = isMobile ? 'text-[10px]' : 'text-[12px]';

    return (
		<footer
			className={`responsive-controls flex-shrink-0 w-full ${arenaGameRoomIngameBottomBarShellClass} ${
				isMobile
					? 'flex h-[164px] w-full min-w-0 flex-row items-stretch gap-3 p-2'
					: 'flex min-h-[124px] flex-row items-stretch gap-6 p-2 min-[1025px]:gap-7 min-[1025px]:py-1.5 min-[1025px]:px-2.5'
			}`}
		>
            {isMobile ? (
                <>
					<div className={`flex min-w-0 flex-1 flex-col justify-center px-1 py-2 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}>
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
                                <div className={colClass}>
                                    <ImageButton src="/images/button/giveup.png" alt="기권" onClick={handleForfeit} title="기권하기" compact={isMobile} />
                                    <span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>기권</span>
                                </div>
                            </ArenaControlStrip>
                        </div>
                    </div>
                    <div className="w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-stone-600/20 via-stone-500/50 to-stone-600/20" aria-hidden />
							<div className={`flex min-w-0 flex-1 flex-col justify-center px-1 py-2 ${arenaGameRoomIngameInnerItemSurfaceClass}`}>
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
                                <div className={colClass}>
                                    <ImageButton
                                        src="/images/button/hidden.png"
                                        alt="히든"
                                        onClick={handleUseHidden}
                                        disabled={hiddenDisabled}
                                        title="히든 스톤 배치"
                                        count={hiddenLeft}
                                        compact={isMobile}
                                    />
                                    <span className={`${lbl} font-semibold whitespace-nowrap ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>히든</span>
                                </div>
                                <div className={colClass}>
                                    <ImageButton
                                        src="/images/button/scan.png"
                                        alt="스캔"
                                        onClick={handleUseScan}
                                        disabled={scanDisabled}
                                        title="스캔"
                                        count={scansLeft}
                                        compact={isMobile}
                                    />
                                    <span className={`${lbl} font-semibold whitespace-nowrap ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>스캔</span>
                                </div>
                            </ArenaControlStrip>
                        </div>
                    </div>
                </>
            ) : (
                <>
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
					>
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                            <div className={colClass}>
                                <ImageButton src="/images/button/giveup.png" alt="기권" onClick={handleForfeit} title="기권하기" compact={isMobile} />
                                <span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>기권</span>
                            </div>
                        </ArenaControlStrip>
                    </div>
                    <div className="w-px shrink-0 self-stretch bg-stone-600/50" />
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}
					>
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6 min-[1025px]:gap-7">
                            <div className={colClass}>
                                <ImageButton
                                    src="/images/button/hidden.png"
                                    alt="히든"
                                    onClick={handleUseHidden}
                                    disabled={hiddenDisabled}
                                    title="히든 스톤 배치"
                                    count={hiddenLeft}
                                    compact={isMobile}
                                />
                                <span className={`${lbl} font-semibold whitespace-nowrap ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>히든</span>
                            </div>
                            <div className={colClass}>
                                <ImageButton
                                    src="/images/button/scan.png"
                                    alt="스캔"
                                    onClick={handleUseScan}
                                    disabled={scanDisabled}
                                    title="스캔"
                                    count={scansLeft}
                                    compact={isMobile}
                                />
                                <span className={`${lbl} font-semibold whitespace-nowrap ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>스캔</span>
                            </div>
                        </ArenaControlStrip>
                    </div>
                </>
            )}
        </footer>
    );
};

export default GuildWarHiddenTowerControls;
