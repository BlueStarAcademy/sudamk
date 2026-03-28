/**
 * 길드 전쟁 — 히든 바둑 전용 하단 컨트롤.
 * 도전의 탑 21층+ 히든·스캔 UI와 동일한 형태이며, 탑 전용 파일과 분리됨.
 */
import React, { useMemo } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';

interface GuildWarHiddenTowerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    setShowResultModal?: (show: boolean) => void;
    setConfirmModalType?: (type: 'resign' | null) => void;
    isMoveInFlight?: boolean;
    isBoardLocked?: boolean;
}

interface ImageButtonProps {
    src: string;
    alt: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    count?: number;
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, count }) => {
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            title={title}
            className={`relative w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 border-amber-400 transition-transform duration-200 ease-out overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-900 ${disabled ? 'opacity-40 cursor-not-allowed border-gray-700' : 'hover:scale-105 active:scale-95 shadow-lg'}`}
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

    const canScan = useMemo(() => {
        if (!session.hiddenMoves || !session.moveHistory) return false;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const move = session.moveHistory![parseInt(moveIndexStr, 10)];
            if (!move || move.player !== opponentPlayerEnum || move.x < 0 || move.y < 0) return false;
            const { x, y } = move;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [session.hiddenMoves, session.moveHistory, session.permanentlyRevealedStones, opponentPlayerEnum]);

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
            <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col items-stretch justify-center gap-2 w-full min-h-[148px]">
                <div className="bg-gray-900/70 border border-stone-700 rounded-xl px-4 py-3 flex flex-wrap items-center justify-center gap-3">
                    <Button
                        onClick={handleShowResults}
                        colorScheme="none"
                        className="justify-center !py-1.5 !px-4 !text-sm rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 whitespace-nowrap"
                    >
                        결과 보기
                    </Button>
                    <Button
                        onClick={handleExit}
                        colorScheme="none"
                        className="justify-center !py-1.5 !px-4 !text-sm rounded-xl border border-red-400/50 bg-gradient-to-r from-red-500/90 via-red-600/90 to-rose-600/90 text-white shadow-[0_12px_32px_-18px_rgba(239,68,68,0.85)] hover:from-red-400 hover:to-rose-500 whitespace-nowrap"
                    >
                        나가기
                    </Button>
                </div>
            </footer>
        );
    }

    return (
        <footer className="responsive-controls flex-shrink-0 bg-stone-800/70 backdrop-blur-sm rounded-xl p-3 flex items-stretch justify-between gap-4 w-full min-h-[148px] border border-stone-700/50">
            <div className="flex-1 flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-1">
                    <ImageButton src="/images/button/giveup.png" alt="기권" onClick={handleForfeit} title="기권하기" />
                    <span className="text-[11px] font-semibold text-red-300">기권</span>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-1">
                    <ImageButton
                        src="/images/button/hidden.png"
                        alt="히든"
                        onClick={handleUseHidden}
                        disabled={hiddenDisabled}
                        title="히든 스톤 배치"
                        count={hiddenLeft}
                    />
                    <span className={`text-[11px] font-semibold ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>히든</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <ImageButton
                        src="/images/button/scan.png"
                        alt="스캔"
                        onClick={handleUseScan}
                        disabled={scanDisabled}
                        title="스캔"
                        count={scansLeft}
                    />
                    <span className={`text-[11px] font-semibold ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>스캔</span>
                </div>
            </div>
        </footer>
    );
};

export default GuildWarHiddenTowerControls;
