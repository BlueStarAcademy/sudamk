/**
 * 길드 전쟁 — 미사일 바둑 전용 하단 컨트롤.
 * 도전의 탑 21층+ 미사일 UI(이미지 버튼·배치)와 동일한 형태이며, 탑 전용 로직·파일과 분리됨.
 */
import React from 'react';
import { GameProps, Player, Point, AppSettings } from '../../types.js';
import Button from '../Button.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import { MoveConfirmFooterSlot } from './MoveConfirmFooterSlot.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonGridClass,
    arenaPostGamePanelShellClass,
} from './arenaPostGameButtonStyles.js';
import {
    arenaGameRoomControlsDividerClass,
    arenaGameRoomIngameBottomBarShellClass,
    arenaGameRoomIngameInnerItemSurfaceClass,
    arenaGameRoomIngameInnerNeutralSurfaceClass,
    pveIngameFooterReservedHeightClass,
} from './arenaGameRoomStyles.js';
import IngameMobileFooterAd from './IngameMobileFooterAd.js';

interface GuildWarMissileTowerControlsProps extends Pick<GameProps, 'session' | 'onAction'> {
    showResultModal?: boolean;
    allowPostGameFooterActions?: boolean;
    setShowResultModal?: (show: boolean) => void;
    setConfirmModalType?: (type: 'resign' | null) => void;
    isMoveInFlight?: boolean;
    isBoardLocked?: boolean;
    isMobile?: boolean;
    showMoveConfirmFooter?: boolean;
    pendingMove?: Point | null;
    onConfirmMove?: () => void;
    onMobileConfirmToggle?: (checked: boolean) => void;
    settings?: AppSettings;
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
        ? 'h-10 w-10 shrink-0 rounded-md sm:h-10 sm:w-10 md:h-10 md:w-10'
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

const GuildWarMissileTowerControls: React.FC<GuildWarMissileTowerControlsProps> = ({
    session,
    onAction,
    showResultModal = false,
    allowPostGameFooterActions = true,
    setShowResultModal,
    setConfirmModalType,
    isMoveInFlight = false,
    isBoardLocked = false,
    isMobile = false,
    showMoveConfirmFooter = false,
    pendingMove = null,
    onConfirmMove,
    onMobileConfirmToggle,
    settings: settingsProp,
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

    const handleForfeit = () => {
        if (gameStatus === 'scoring') return;
        setConfirmModalType?.('resign');
    };

    const handleUseMissile = () => {
        if (missileDisabled) return;
        onAction({ type: 'START_MISSILE_SELECTION', payload: { gameId: session.id } });
    };

    if (gameStatus === 'ended' || gameStatus === 'no_contest') {
        const blockPostGameFooter = allowPostGameFooterActions === false;
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
                        disabled={blockPostGameFooter && !!showResultModal}
                    >
                        결과 보기
                    </Button>
                    <Button
                        bare
                        onClick={handleExit}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}
                        disabled={blockPostGameFooter}
                    >
                        대기실로
                    </Button>
                    </div>
                </div>
                <IngameMobileFooterAd isMobile={!!isMobile} />
            </footer>
        );
    }

    const colClass = isMobile ? 'flex flex-col items-center gap-1 shrink-0' : 'flex flex-col items-center gap-1.5';
    const lbl = isMobile ? 'text-[10px]' : 'text-[12px]';

    const guildMoveConfirmCenter =
        showMoveConfirmFooter && onConfirmMove && onMobileConfirmToggle && settingsProp ? (
            <MoveConfirmFooterSlot
                layout="online"
                compact={isMobile}
                withCenterPanel
                pendingMove={pendingMove ?? null}
                mobileConfirm={settingsProp.features.mobileConfirm}
                onConfirmMove={onConfirmMove}
                onMobileConfirmToggle={onMobileConfirmToggle}
            />
        ) : null;

    return (
		<footer
			className={`responsive-controls flex-shrink-0 w-full ${arenaGameRoomIngameBottomBarShellClass} ${
				isMobile
					? 'flex min-h-[104px] w-full min-w-0 flex-col items-stretch gap-0.5 p-1'
					: 'flex min-h-[124px] flex-row items-stretch gap-6 p-2 min-[1025px]:gap-7 min-[1025px]:py-1.5 min-[1025px]:px-2.5'
			}`}
		>
            {isMobile ? (
                <>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-row items-stretch gap-1.5">
					<div className={`flex min-w-0 flex-1 flex-col justify-center px-1 py-2 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}>
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
                                <div className={colClass}>
                                    <ImageButton src="/images/button/giveup.png" alt="기권" onClick={handleForfeit} disabled={gameStatus === 'scoring'} title={gameStatus === 'scoring' ? '계가 집계 중에는 기권할 수 없습니다.' : '기권하기'} compact={isMobile} />
                                    <span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>기권</span>
                                </div>
                            </ArenaControlStrip>
                        </div>
                    </div>
                    {guildMoveConfirmCenter ? (
                        <>
                            <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
                            <div className="flex shrink-0 flex-col justify-center px-0.5 py-1">{guildMoveConfirmCenter}</div>
                        </>
                    ) : null}
                    <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
							<div className={`flex min-w-0 flex-1 flex-col justify-center px-1 py-2 ${arenaGameRoomIngameInnerItemSurfaceClass}`}>
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
                    </div>
                    <IngameMobileFooterAd isMobile={!!isMobile} />
                </>
            ) : (
                <>
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
					>
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                            <div className={colClass}>
                                <ImageButton src="/images/button/giveup.png" alt="기권" onClick={handleForfeit} disabled={gameStatus === 'scoring'} title={gameStatus === 'scoring' ? '계가 집계 중에는 기권할 수 없습니다.' : '기권하기'} compact={isMobile} />
                                <span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>기권</span>
                            </div>
                        </ArenaControlStrip>
                    </div>
                    {guildMoveConfirmCenter ? (
                        <>
                            <div className="w-px shrink-0 self-stretch bg-stone-600/50" aria-hidden />
                            <div className="flex shrink-0 flex-col items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1">
                                {guildMoveConfirmCenter}
                            </div>
                        </>
                    ) : null}
                    <div className="w-px shrink-0 self-stretch bg-stone-600/50" aria-hidden />
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}
					>
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6 min-[1025px]:gap-7">
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
