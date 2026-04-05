/**
 * 길드 전쟁 — 미사일 바둑 전용 하단 컨트롤.
 * 도전의 탑 21층+ 미사일 UI(이미지 버튼·배치)와 동일한 형태이며, 탑 전용 로직·파일과 분리됨.
 */
import React from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonGridClass,
    arenaPostGamePanelShellClass,
} from './arenaPostGameButtonStyles.js';

interface GuildWarMissileTowerControlsProps extends Pick<GameProps, 'session' | 'onAction'> {
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
        : 'h-[4.25rem] w-[4.25rem] md:h-24 md:w-24 rounded-xl';
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

const GuildWarMissileTowerControls: React.FC<GuildWarMissileTowerControlsProps> = ({
    session,
    onAction,
    setShowResultModal,
    setConfirmModalType,
    isMoveInFlight = false,
    isBoardLocked = false,
    isMobile = false,
}) => {
    const gameStatus = session.gameStatus;
    const isMyTurn = session.currentPlayer === Player.Black;
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;
    const missileMaxCount = (session.settings as { missileCount?: number })?.missileCount ?? 3;
    const missilesLeft = session.missiles_p1 ?? missileMaxCount;
    const missileDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !isMyTurn ||
        gameStatus !== 'playing' ||
        missilesLeft <= 0;

    const handleForfeit = () => setConfirmModalType?.('resign');

    const handleUseMissile = () => {
        if (missileDisabled) return;
        onAction({ type: 'START_MISSILE_SELECTION', payload: { gameId: session.id } });
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
            <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col items-stretch justify-center gap-2 w-full min-h-[164px]">
                <div className={arenaPostGamePanelShellClass}>
                    <div className={arenaPostGameButtonGridClass}>
                    <Button
                        bare
                        onClick={handleShowResults}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('result', !!isMobile, 'strip')}
                    >
                        결과 보기
                    </Button>
                    <Button
                        bare
                        onClick={handleExit}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('danger', !!isMobile, 'strip')}
                    >
                        나가기
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
            className={`responsive-controls flex-shrink-0 bg-stone-800/70 backdrop-blur-sm rounded-xl w-full min-h-[164px] border border-stone-700/50 ${
                isMobile ? 'flex w-full min-w-0 flex-row items-stretch gap-3 p-2' : 'flex flex-row items-stretch gap-5 p-3'
            }`}
        >
            {isMobile ? (
                <>
                    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-stone-600/40 bg-black/20 px-2 py-2">
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
                    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-amber-900/35 bg-amber-950/15 px-2 py-2">
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
                                <div className={colClass}>
                                    <ImageButton
                                        src="/images/button/missile.png"
                                        alt="미사일"
                                        onClick={handleUseMissile}
                                        disabled={missileDisabled}
                                        title="미사일 발사"
                                        count={missilesLeft}
                                        compact={isMobile}
                                    />
                                    <span className={`${lbl} font-semibold whitespace-nowrap ${missileDisabled ? 'text-gray-500' : 'text-amber-100'}`}>미사일</span>
                                </div>
                            </ArenaControlStrip>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-stone-600/40 bg-black/10 px-2 py-2">
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6">
                            <div className={colClass}>
                                <ImageButton src="/images/button/giveup.png" alt="기권" onClick={handleForfeit} title="기권하기" compact={isMobile} />
                                <span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>기권</span>
                            </div>
                        </ArenaControlStrip>
                    </div>
                    <div className="w-px shrink-0 self-stretch bg-stone-600/50" />
                    <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-amber-900/35 bg-amber-950/10 px-2 py-2">
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6">
                            <div className={colClass}>
                                <ImageButton
                                    src="/images/button/missile.png"
                                    alt="미사일"
                                    onClick={handleUseMissile}
                                    disabled={missileDisabled}
                                    title="미사일 발사"
                                    count={missilesLeft}
                                    compact={isMobile}
                                />
                                <span className={`${lbl} font-semibold whitespace-nowrap ${missileDisabled ? 'text-gray-500' : 'text-amber-100'}`}>미사일</span>
                            </div>
                        </ArenaControlStrip>
                    </div>
                </>
            )}
        </footer>
    );
};

export default GuildWarMissileTowerControls;
