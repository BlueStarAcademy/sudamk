import React, { useState, useMemo } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { GameProps, Player, Point, AppSettings } from '../../types.js';
import Button from '../Button.js';
import ConfirmModal from '../ConfirmModal.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import {
    countTowerLobbyInventoryQty,
    TOWER_ITEM_TURN_ADD_NAMES,
    TOWER_ITEM_MISSILE_NAMES,
    TOWER_ITEM_HIDDEN_NAMES,
    TOWER_ITEM_SCAN_NAMES,
    TOWER_ITEM_REFRESH_NAMES,
} from '../../utils/towerLobbyInventory.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';
import { getTowerSessionFloor, isTowerHumanWinnerFromSession } from '../../utils/towerPreGameDisplay.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import { MoveConfirmFooterSlot } from './MoveConfirmFooterSlot.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonGridClass,
    arenaPostGamePanelShellClass,
    formatArenaRetryLabel,
    formatTowerNextFooterLabel,
} from './arenaPostGameButtonStyles.js';
import {
    arenaGameRoomControlsDividerClass,
    arenaGameRoomIngameBottomBarShellClass,
    arenaGameRoomIngameInnerItemSurfaceClass,
    arenaGameRoomIngameInnerNeutralSurfaceClass,
    pveIngameFooterReservedHeightClass,
} from './arenaGameRoomStyles.js';
import BaseGameFooterPanel, { BasePlacementControlStrip, isBaseGameFooterPhase } from './BaseGameFooterPanel.js';
import PurchaseQuantityModal from '../PurchaseQuantityModal.js';
import { buildTowerShopPurchasableItem } from '../../shared/constants/towerShopItems.js';
import { pairPetKataPhaseFromTotalPly, pairPetKataPliesRemainingInCurrentPhase } from '../../shared/constants/pairArena.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { getPairPetDefinition } from '../../shared/constants/petLobby.js';
import { resolvePveSeatColors } from '../../utils/pveSeatColors.js';

interface TowerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    allowPostGameFooterActions?: boolean;
    showResultModal?: boolean;
    setShowResultModal?: (show: boolean) => void;
    setConfirmModalType?: (type: 'resign' | null) => void;
    isMoveInFlight?: boolean;
    isBoardLocked?: boolean;
    isMobile?: boolean;
    /** Game.tsx에서 gameControlsProps 일괄 전달 시 무시 */
    onLeaveOrResign?: () => void;
    /** Game.tsx gameControlsProps 일괄 전달 시 무시 */
    strategicPetHintFooterBubble?: { message: string; visible: boolean } | null;
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
    maxCount?: number;
    compact?: boolean;
    imageBottomOverlay?: string;
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, count, maxCount, compact = false, imageBottomOverlay }) => {
    const sizeClass = compact
        ? 'h-12 w-12 shrink-0 rounded-lg sm:h-12 sm:w-12 md:h-12 md:w-12'
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
            {imageBottomOverlay ? (
                <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-center bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent pb-0.5 pt-2.5 font-bold leading-none tracking-wide text-sky-100 ring-1 ring-inset ring-sky-400/25 ${
                        compact ? 'text-[7px]' : 'text-[8px] min-[1025px]:text-[9px]'
                    }`}
                    aria-hidden
                >
                    {imageBottomOverlay}
                </span>
            ) : null}
            {count !== undefined && (
				<div className={`absolute -bottom-0.5 -right-0.5 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-purple-900 ${
                    count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'
                }`}>
                    {count}
                </div>
            )}
        </button>
    );
};

const TowerControls: React.FC<TowerControlsProps> = ({
    session,
    onAction,
    currentUser,
    allowPostGameFooterActions = true,
    showResultModal = false,
    setShowResultModal,
    setConfirmModalType,
    isMoveInFlight = false,
    isBoardLocked = false,
    isMobile = false,
    strategicPetHintFooterBubble = null,
    showMoveConfirmFooter = false,
    pendingMove = null,
    onConfirmMove,
    onMobileConfirmToggle,
    settings: settingsProp,
}) => {
    const { t } = useTranslation(['common', 'game']);
    const [refreshConfirmModal, setRefreshConfirmModal] = useState(false);
    const [passConfirmModal, setPassConfirmModal] = useState(false);
    const [turnAddConfirmModal, setTurnAddConfirmModal] = useState(false);
    const [towerPurchasingItemId, setTowerPurchasingItemId] = useState<string | null>(null);
    const [petHintBusy, setPetHintBusy] = useState(false);

    const openTowerItemShop = (itemId: string) => {
        if (!currentUser) return;
        setTowerPurchasingItemId(itemId);
    };

    const towerPurchasingItem = useMemo(() => {
        if (!towerPurchasingItemId || !currentUser) return null;
        return buildTowerShopPurchasableItem(currentUser, towerPurchasingItemId);
    }, [towerPurchasingItemId, currentUser]);
    const myUserId = currentUser?.id;
    const floor = getTowerSessionFloor(session);
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;
    const { myPlayerEnum, opponentPlayerEnum } = resolvePveSeatColors(session as any, myUserId);
    const isMyTurn = myPlayerEnum !== Player.None && session.currentPlayer === myPlayerEnum;
    const stage = TOWER_STAGES.find(s => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === floor;
    });

    // 훅은 early return 이전에 항상 호출 (React 규칙: 훅 개수/순서 일정 유지)
    const showMissileAndHiddenForHook = floor >= 21;
    const scanCountSettingForHook = showMissileAndHiddenForHook ? ((session.settings as any)?.scanCount ?? (stage?.scanCount ?? 0)) : 0;
    /** 대기실과 동일: 배지 숫자는 항상 가방(인벤) 수. 사용 가능은 세션 잔여와 함께 판단 */
    const inventory = currentUser?.inventory || [];
    const getItemCount = (namesOrIds: readonly string[]): number => countTowerLobbyInventoryQty(inventory, namesOrIds);
    const scanInventoryCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_SCAN_NAMES) : 0;
    const sessionScansLeft =
        myPlayerEnum === Player.White
            ? ((session as any).scans_p2 as number | undefined) ?? ((session as any).scans_p1 as number | undefined)
            : ((session as any).scans_p1 as number | undefined) ?? ((session as any).scans_p2 as number | undefined);
    /** 인벤 또는 세션 중 하나라도 있으면 스캔 시도 가능(경기 중 구매 직후 세션만 늦게 오는 경우) */
    const hasScanStock = scanInventoryCount > 0 || (sessionScansLeft ?? 0) > 0;
    const canScan = React.useMemo(() => {
        if (!showMissileAndHiddenForHook || !hasScanStock) return false;
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;
        /** 백(봇) 히든: 수순·hiddenMoves로 확정된 칸은 클라 병합/연출 타이밍에 board가 빈칸(None)으로만 올 수 있어 White만 허용하면 스캔 버튼이 꺼진다. 흑이 있는 칸은 제외. */
        const cellIsTowerOpponentHiddenSurface = (x: number, y: number): boolean => {
            const c = board[y]?.[x];
            return c === opponentPlayerEnum || c === Player.None;
        };
        const uid = currentUser?.id;
        const scannedAiInitialByMe =
            !!uid && !!(session as any).scannedAiInitialHiddenByUser?.[uid as string];
        const aiInitialHiddenStone = (session as any).aiInitialHiddenStone;
        const aiHiddenIsPrePlaced = (session as any).aiInitialHiddenStoneIsPrePlaced;
        if (aiInitialHiddenStone && !aiHiddenIsPrePlaced) {
            const { x, y } = aiInitialHiddenStone;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (inBounds && cellIsTowerOpponentHiddenSurface(x, y)) {
                const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
                if (!isPermanentlyRevealed && !scannedAiInitialByMe) return true;
            }
        }
        if (!session.hiddenMoves || !session.moveHistory) return false;
        const myRevealed = uid ? session.revealedHiddenMoves?.[uid] : undefined;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const moveIndex = parseInt(moveIndexStr, 10);
            if (myRevealed?.includes(moveIndex)) return false;
            const move = session.moveHistory![moveIndex];
            if (!move || move.player !== opponentPlayerEnum) return false;
            const { x, y } = move;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (!inBounds || !cellIsTowerOpponentHiddenSurface(x, y)) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [
        showMissileAndHiddenForHook,
        hasScanStock,
        session.boardState,
        session.hiddenMoves,
        session.moveHistory,
        session.permanentlyRevealedStones,
        session.revealedHiddenMoves,
        myUserId,
        opponentPlayerEnum,
        (session as any).aiInitialHiddenStone,
        (session as any).aiInitialHiddenStoneIsPrePlaced,
        (session as any).scannedAiInitialHiddenByUser,
    ]);

    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const isWinner = isTowerHumanWinnerFromSession(session);
        const nextFloor = floor < 100 ? floor + 1 : null;
        const nextStageForEnded = nextFloor
            ? TOWER_STAGES.find(s => {
                  const stageFloor = parseInt(s.id.replace('tower-', ''));
                  return stageFloor === nextFloor;
              })
            : null;
        const userTowerFloor = currentUser.towerFloor ?? 0;
        const userMonthlyTowerFloor = Number(currentUser.monthlyTowerFloor ?? 0) || 0;
        // 진행(다음 층): towerFloor. 재도전 ⚡0: 이번 달 클리어(monthly)
        const progressClearedFloor = Math.max(userTowerFloor, userMonthlyTowerFloor, isWinner ? floor : 0);
        const monthlyClearedFloor = Math.max(userMonthlyTowerFloor, isWinner ? floor : 0);
        const isFloorClearedForProgress = floor <= progressClearedFloor;
        const isFloorClearedThisMonth = floor <= monthlyClearedFloor;
        // TowerSummaryModal과 동일: 승리했거나 현재 층을 이미 클리어한 적 있으면 다음 층 진행 가능
        const canTryNext = !!nextStageForEnded && (isWinner || isFloorClearedForProgress);

        const baseRetryApCost = stage?.actionPointCost ?? 0;
        const baseNextFloorApCost = nextStageForEnded?.actionPointCost ?? 0;
        const inferredRetryApCost = isFloorClearedThisMonth || isWinner ? 0 : baseRetryApCost;
        // 이번 달 이미 클리어한 층은 재도전 무료(⚡0). 미클리어 층은 승리 시에만 행동력 차감.
        const effectiveRetryApCost =
            inferredRetryApCost === 0
                ? 0
                : session.towerStartActionPointCost === 0
                  ? 0
                  : typeof session.towerStartActionPointCost === 'number'
                    ? session.towerStartActionPointCost
                    : inferredRetryApCost;
        const isNextFloorAlreadyClearedThisMonth = nextFloor != null && monthlyClearedFloor >= nextFloor;
        const effectiveNextFloorApCost = isNextFloorAlreadyClearedThisMonth ? 0 : baseNextFloorApCost;

        const handleShowResults = () => {
            if (setShowResultModal) {
                setShowResultModal(true);
            }
        };

        const blockPostGameFooter = allowPostGameFooterActions === false;

        const handleRetry = async () => {
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor } });
                const gameId = (result as any)?.gameId;
                if (gameId) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[TowerControls] Failed to retry floor:', error);
                window.alert(tx('game:pveControls.retryFailed'));
            }
        };
        
        const handleNextFloor = async () => {
            if (!canTryNext || !nextFloor) return;
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor: nextFloor } });
                const gameId = (result as any)?.gameId;
                if (gameId) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[TowerControls] Failed to start next floor:', error);
                window.alert(tx('game:pveControls.nextStageFailed'));
            }
        };
        
        const handleExitToLobby = async () => {
            // 도전의 탑에서는 서버 액션을 시도하되, 성공/실패와 관계없이 로비로 이동
            sessionStorage.setItem('postGameRedirect', '#/tower');
            try {
                await onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
            } catch (error) {
                // 에러가 발생해도 로비로 이동 (도전의 탑 게임이 이미 종료되었거나 없는 경우 등)
                console.log('[TowerControls] LEAVE_AI_GAME failed, moving to lobby anyway:', error);
            }
            // 서버 응답을 기다리지 않고 바로 이동 (히스토리에서 경기장 항목 제거)
            replaceAppHash('#/tower');
        };

        return (
            <footer
                className={`responsive-controls flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-2 p-2 ${pveIngameFooterReservedHeightClass(isMobile)} ${arenaGameRoomIngameBottomBarShellClass}`}
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
                        onClick={handleNextFloor}
                        colorScheme="none"
                        className={`${arenaPostGameButtonClass('neutral', !!isMobile, 'strip')} min-w-0 truncate`}
                        disabled={blockPostGameFooter || !canTryNext}
                    >
                        {formatTowerNextFooterLabel(nextFloor, canTryNext, effectiveNextFloorApCost)}
                    </Button>
                    <Button
                        bare
                        onClick={handleRetry}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}
                        disabled={blockPostGameFooter}
                    >
                        {formatArenaRetryLabel(effectiveRetryApCost)}
                    </Button>
                    <Button
                        bare
                        onClick={handleExitToLobby}
                        colorScheme="none"
                        className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}
                        disabled={blockPostGameFooter}
                    >
                        대기실로
                    </Button>
                    </div>
                </div>
            </footer>
        );
    }

    /** 도전의 탑에서도 베이스/믹스(베이스 포함) 사전 단계는 전용 하단 스트립을 사용한다. */
    if (isBaseGameFooterPhase(session) && currentUser) {
        const showBasePlacementStrip = session.gameStatus === 'base_placement';
        return (
            <footer
                className={`${arenaGameRoomIngameBottomBarShellClass} flex w-full flex-shrink-0 flex-col items-stretch justify-center ${pveIngameFooterReservedHeightClass(isMobile)}`}
            >
                <div className="flex w-full min-w-0 flex-col gap-0.5 py-0.5">
                    {showBasePlacementStrip ? (
                        <div className="flex w-full min-w-0 min-h-[2.35rem] flex-row items-center justify-center px-1 min-[1025px]:min-h-[2.1rem] min-[1025px]:px-1.5">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-w-0" gapClass="gap-1 min-[1025px]:gap-2">
                                <BasePlacementControlStrip
                                    session={session}
                                    currentUser={currentUser}
                                    onAction={onAction}
                                    isMobile={isMobile}
                                    isSinglePlayer
                                />
                            </ArenaControlStrip>
                        </div>
                    ) : null}
                    <BaseGameFooterPanel
                        session={session}
                        currentUser={currentUser}
                        onAction={onAction}
                        isMobile={isMobile}
                        isSinglePlayer
                        hideBasePlacementActions={showBasePlacementStrip}
                    />
                </div>
            </footer>
        );
    }
    
    const handleRefreshConfirm = () => {
        setRefreshConfirmModal(false);
        onAction({ type: 'TOWER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
    };

    const handleForfeit = () => {
        if (session.gameStatus === 'scoring') return;
        setConfirmModalType?.('resign');
    };

    const handlePassClick = () => {
        if (!passAllowed) return;
        setPassConfirmModal(true);
    };

    const handlePassConfirm = () => {
        setPassConfirmModal(false);
        const gameStatus = session.gameStatus;
        if (gameStatus !== 'playing') return;
        const currentPassCount = (session.passCount || 0) + 1;
        if (currentPassCount >= 2) {
            const scoringBoardSnapshot = Array.isArray(session.boardState)
                ? session.boardState.map((row: number[]) => [...row])
                : [];
            const scoringMoveHistorySnapshot = Array.isArray(session.moveHistory)
                ? session.moveHistory.map((move: any) => ({ ...move }))
                : [];
            const scoringSettingsSnapshot = session.settings
                ? { ...session.settings }
                : undefined;
            onAction({
                type: 'REQUEST_SCORING',
                payload: {
                    gameId: session.id,
                    boardState: scoringBoardSnapshot,
                    moveHistory: scoringMoveHistorySnapshot,
                    settings: scoringSettingsSnapshot,
                },
            } as any);
        } else {
            onAction({
                type: 'TOWER_CLIENT_MOVE',
                payload: {
                    gameId: session.id,
                    x: -1,
                    y: -1,
                    newBoardState: session.boardState,
                    capturedStones: [],
                    newKoInfo: session.koInfo,
                    isPass: true
                }
            } as any);
        }
    };

    const gameStatus = session.gameStatus;
    /** 스캔은 내 차례에만 사용 가능 */
    const canStartScanTurn = isMyTurn;
    const showTurnAdd = floor <= 20; // 1~20층에서만 턴 추가 아이템 표시
    // 도전의 탑 전체(1~100층)에서 통과 비활성: 1~20층 따내기 턴 제한, 21층+ 자동 계가
    const passAllowed = false;

    // 턴 추가 아이템 (1~20층, 제한 없음) - 로비·가방과 동기화
    const turnAddCount = showTurnAdd ? getItemCount(TOWER_ITEM_TURN_ADD_NAMES) : 0;
    /** 경기 중이면 0개일 때도 눌러 상점 열기 (사용 확인은 보유 있을 때만) */
    const turnAddButtonDisabled = gameStatus !== 'playing';

    const handleTurnAddClick = () => {
        if (gameStatus !== 'playing') return;
        if (turnAddCount <= 0) {
            openTowerItemShop('턴 추가');
            return;
        }
        setTurnAddConfirmModal(true);
    };

    const handleTurnAddConfirm = () => {
        setTurnAddConfirmModal(false);
        if (session.gameStatus !== 'playing') return;
        onAction({ type: 'TOWER_ADD_TURNS', payload: { gameId: session.id } });
    };

    // 미사일 (21층+): 배지는 인벤 수; 사용 가능은 인벤 또는 세션 잔여(경기 중 구매 직후 동기 지연 대비)
    const missileCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_MISSILE_NAMES) : 0;
    const missileMaxCount = (stage as { missileCount?: number } | undefined)?.missileCount ?? (session.settings as { missileCount?: number })?.missileCount ?? 2;
    const myMissilesLeftFromSession =
        myPlayerEnum === Player.White
            ? ((session as any).missiles_p2 as number | undefined) ?? (session.missiles_p1 ?? 0)
            : (session.missiles_p1 ?? 0) ?? ((session as any).missiles_p2 as number | undefined) ?? 0;
    const hasMissileStock = missileCount > 0 || myMissilesLeftFromSession > 0;
    /** 재고 0이면 경기 중에는 버튼을 막지 않고 탭 시 상점 (턴 추가와 동일) */
    const missileButtonDisabled =
        gameStatus !== 'playing' ||
        (hasMissileStock && (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn));
    
    const handleUseMissile = () => {
        if (gameStatus !== 'playing') return;
        if (missileCount <= 0) {
            openTowerItemShop('미사일');
            return;
        }
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_MISSILE_SELECTION',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };
    
    const hiddenCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_HIDDEN_NAMES) : 0;
    const hiddenMaxCount =
        (stage as { hiddenStoneCount?: number } | undefined)?.hiddenStoneCount ??
        (session.settings as { hiddenStoneCount?: number })?.hiddenStoneCount ??
        2;
    const myHiddenLeftFromSession =
        myPlayerEnum === Player.White
            ? ((session as any).hidden_stones_p2 as number | undefined) ?? ((session as any).hidden_stones_p1 ?? 0)
            : ((session as any).hidden_stones_p1 ?? 0) ?? ((session as any).hidden_stones_p2 as number | undefined) ?? 0;
    const hasHiddenStock = hiddenCount > 0 || myHiddenLeftFromSession > 0;
    const hiddenButtonDisabled =
        gameStatus !== 'playing' ||
        (hasHiddenStock && (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn));
    
    const handleUseHidden = () => {
        if (gameStatus !== 'playing') return;
        if (hiddenCount <= 0) {
            openTowerItemShop('히든');
            return;
        }
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_HIDDEN_PLACEMENT',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const scanButtonDisabled =
        gameStatus !== 'playing' ||
        (hasScanStock &&
            (isMoveInFlight ||
                isBoardLocked ||
                hasPendingRevealResolution ||
                !canStartScanTurn ||
                !canScan));

    const handleUseScan = () => {
        if (gameStatus !== 'playing') return;
        if (scanInventoryCount <= 0) {
            openTowerItemShop('스캔');
            return;
        }
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !canStartScanTurn || !canScan) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_SCANNING',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const refreshCount = getItemCount(TOWER_ITEM_REFRESH_NAMES);
    const refreshMaxCount = 5;
    const canUseRefresh = (session.moveHistory?.length ?? 0) === 0 && session.gameStatus === 'playing';
    const refreshButtonDisabled = gameStatus !== 'playing' || (refreshCount > 0 && !canUseRefresh);

    const handleRefresh = () => {
        if (gameStatus !== 'playing') return;
        if (refreshCount <= 0) {
            openTowerItemShop('배치변경');
            return;
        }
        if (!canUseRefresh) return;
        setRefreshConfirmModal(true);
    };

	const colClass = isMobile ? 'flex flex-col items-center gap-1 shrink-0' : 'flex flex-col items-center gap-1.5';
	const lbl = isMobile ? 'text-[10px]' : 'text-[12px]';
    const petRow = currentUser ? getEquippedPairPetInventoryRow(currentUser) : null;
    const petHintBoardSize = session.settings.boardSize || 19;
    const petHintTotalPly = (session.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length + 1;
    const petHintPhase = pairPetKataPhaseFromTotalPly(petHintBoardSize, petHintTotalPly);
    const { remaining: petHintPhasePlyRemaining } = pairPetKataPliesRemainingInCurrentPhase(petHintBoardSize, petHintTotalPly);
    const petHintUsed = ((session.settings as { strategicPetHintByUserId?: Record<string, Partial<Record<string, boolean>>> })
        .strategicPetHintByUserId?.[currentUser.id] ?? {}) as Record<string, boolean>;
    const petHintPhaseLabel = petHintPhase === 'opening' ? tx('game:controls.phaseOpening') : petHintPhase === 'midgame' ? tx('game:controls.phaseMidgame') : tx('game:controls.phaseEndgame');
    const petHintCountdownLabel =
        petHintPhasePlyRemaining == null ? tx('game:controls.phaseEndgame') : t('controls.phaseMovesLeft', { phase: petHintPhaseLabel, count: petHintPhasePlyRemaining });
    const petHintCanAttempt =
        gameStatus === 'playing' &&
        isMyTurn &&
        !!petRow &&
        !petHintUsed[petHintPhase] &&
        !isMoveInFlight &&
        !isBoardLocked &&
        !hasPendingRevealResolution;
    let petHintTitleBody = t('controls.petHintPhaseOnce', { phase: petHintPhaseLabel });
    if (!petRow) {
        petHintTitleBody = t('controls.petHintEquipPet');
    } else if (gameStatus !== 'playing') {
        petHintTitleBody = t('controls.petHintDuringGame');
    } else if (!isMyTurn) {
        petHintTitleBody = t('controls.petHintMyTurnOnly');
    } else if (petHintUsed[petHintPhase]) {
        petHintTitleBody = t('controls.petHintPhaseUsed', { phase: petHintPhaseLabel });
    }
    const petHintTitle =
        petHintPhasePlyRemaining != null
            ? t('controls.petHintPhaseRemaining', { phase: petHintPhaseLabel, count: petHintPhasePlyRemaining, body: petHintTitleBody })
            : `${petHintPhaseLabel} — ${petHintTitleBody}`;
    const petHintImg = petRow
        ? ((petRow as { image?: string }).image ??
              (petRow.templateId ? getPairPetDefinition(petRow.templateId)?.image : null) ??
              '/images/button/hidden.webp')
        : null;
    const showPetHintBubble = Boolean(strategicPetHintFooterBubble?.visible && strategicPetHintFooterBubble?.message);
    const petHintSlot = (
        <div className={`relative ${colClass}`}>
            {showPetHintBubble && strategicPetHintFooterBubble?.message ? (
                <div
                    className="pointer-events-none absolute bottom-full left-0 z-[81] mb-2"
                    role="status"
                    aria-live="polite"
                >
                    <div className="relative rounded-xl border border-white/20 bg-black px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.75)] ring-1 ring-white/10 sm:px-4 sm:py-3">
                        <p className="whitespace-nowrap text-sm font-semibold leading-none text-white sm:text-base">
                            {strategicPetHintFooterBubble.message}
                        </p>
                        <div
                            className={`absolute top-full -mt-px h-0 w-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-black ${isMobile ? 'left-5' : 'left-7 min-[1025px]:left-7'}`}
                            aria-hidden
                        />
                    </div>
                </div>
            ) : null}
            {petRow && petHintImg ? (
                <ImageButton
                    src={petHintImg}
                    alt={t("controls.petHintAria", { label: petHintCountdownLabel })}
                    onClick={() => {
                        if (!petHintCanAttempt || petHintBusy) return;
                        setPetHintBusy(true);
                        void Promise.resolve(onAction({ type: 'REQUEST_STRATEGIC_PET_HINT', payload: { gameId: session.id } })).finally(() =>
                            setPetHintBusy(false),
                        );
                    }}
                    disabled={!petHintCanAttempt || petHintBusy}
                    title={petHintTitle}
                    compact={isMobile}
                    imageBottomOverlay={t("controls.hint")}
                />
            ) : (
                <button
                    type="button"
                    disabled
                    className={`relative flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-500/55 bg-slate-950/55 ${
                        isMobile ? 'h-12 w-12 shrink-0 rounded-lg' : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16'
                    }`}
                    title={petHintTitle}
                    aria-label={t("controls.petHintAriaNoPet", { label: petHintCountdownLabel })}
                />
            )}
            <span className={`${lbl} font-semibold whitespace-nowrap ${petHintCanAttempt ? 'text-sky-100' : 'text-gray-500'}`}>
                {petHintCountdownLabel}
            </span>
        </div>
    );

    const dockMoveConfirmTower = showMoveConfirmFooter && onConfirmMove && onMobileConfirmToggle && settingsProp;
    const moveConfirmCenterTower = dockMoveConfirmTower ? (
        <MoveConfirmFooterSlot
            layout="pve"
            compact={isMobile}
            withCenterPanel
            pendingMove={pendingMove ?? null}
            mobileConfirm={settingsProp.features.mobileConfirm}
            onConfirmMove={onConfirmMove}
            onMobileConfirmToggle={onMobileConfirmToggle}
        />
    ) : null;

    const hasFooterItemColumn = showTurnAdd || showMissileAndHiddenForHook;

	const coreActionsTower = (
		<>
			<div className={colClass}>
				<ImageButton
					src="/images/button/giveup.webp"
					alt={t("controls.resignAlt")}
					onClick={handleForfeit}
					disabled={gameStatus === 'scoring'}
					title={gameStatus === 'scoring' ? t('controls.cannotResignDuringScoring') : t('controls.resignTitle')}
					compact={isMobile}
				/>
				<span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>{t("controls.resign")}</span>
			</div>
			{passAllowed && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/pass.webp"
						alt={t("controls.passLabel")}
						onClick={handlePassClick}
						disabled={!isMyTurn || gameStatus !== 'playing'}
						title={t('controls.passTitle')}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${!isMyTurn || gameStatus !== 'playing' ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.passLabel")}</span>
				</div>
			)}
			<div className={colClass}>
				<ImageButton
					src="/images/button/reflesh.webp"
					alt={t("placementRefresh.title")}
					onClick={handleRefresh}
					disabled={refreshButtonDisabled}
					title={refreshCount > 0 ? t('placementRefresh.towerRefreshActive') : t('placementRefresh.towerShopHint')}
					count={refreshCount}
					maxCount={refreshMaxCount}
					compact={isMobile}
				/>
				<span className={`${lbl} font-semibold whitespace-nowrap ${refreshButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("placementRefresh.title")}</span>
			</div>
		</>
	);

	const coreZone = (
		<>
			{coreActionsTower}
            {petHintSlot}
		</>
	);

	const itemZone = (
		<>
			{showTurnAdd && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/addturn.webp"
						alt={t("placementRefresh.turnAddTitle")}
						onClick={handleTurnAddClick}
						disabled={turnAddButtonDisabled}
						title={turnAddCount > 0 ? t('placementRefresh.turnAddActive') : t('placementRefresh.towerShopHint')}
						count={turnAddCount}
						compact={isMobile}
					/>
					<span
						className={`${lbl} font-semibold whitespace-nowrap ${turnAddButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}
					>
						턴 추가
					</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/missile.webp"
						alt={t("controls.missile")}
						onClick={handleUseMissile}
						disabled={missileButtonDisabled}
						title={missileCount > 0 ? t('controls.missileLaunchTitle') : t('placementRefresh.towerShopHint')}
						count={missileCount}
						maxCount={missileMaxCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${missileButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.missile")}</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/hidden.webp"
						alt={t("controls.hidden")}
						onClick={handleUseHidden}
						disabled={hiddenButtonDisabled}
						title={hiddenCount > 0 ? t('controls.hiddenPlaceTitle') : t('placementRefresh.towerShopHint')}
						count={hiddenCount}
						maxCount={hiddenMaxCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${hiddenButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.hidden")}</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/scan.webp"
						alt={t("controls.scan")}
						onClick={handleUseScan}
						disabled={scanButtonDisabled}
						title={scanInventoryCount > 0 ? t('controls.scan') : t('placementRefresh.towerShopHint')}
						count={scanInventoryCount}
						maxCount={scanCountSettingForHook}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${scanButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.scan")}</span>
				</div>
			)}
		</>
	);

	const towerPurchasePortal =
		towerPurchasingItem &&
		currentUser &&
		createPortal(
			<PurchaseQuantityModal
				item={towerPurchasingItem}
				currentUser={currentUser}
				ignoreInventorySlotLimit
				onClose={() => setTowerPurchasingItemId(null)}
				onConfirm={async (itemId, quantity) => {
					await onAction({
						type: 'BUY_TOWER_ITEM',
						payload: { itemId, quantity, gameId: session.id },
					} as any);
				}}
			/>,
			document.body
		);

	return (
		<>
		{towerPurchasePortal}
		<footer
			className={`responsive-controls flex-shrink-0 w-full ${arenaGameRoomIngameBottomBarShellClass} ${
				isMobile
					? 'flex min-h-[124px] w-full min-w-0 flex-row items-stretch gap-1.5 p-1'
					: 'flex min-h-[124px] flex-row items-stretch gap-6 p-2 min-[1025px]:gap-7 min-[1025px]:py-1.5 min-[1025px]:px-2.5'
			}`}
		>
			{isMobile ? (
				<>
					<div className={`flex min-w-0 flex-1 flex-col justify-center px-0.5 py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}>
						<div className="flex min-h-0 w-full flex-1 items-center justify-center">
							{moveConfirmCenterTower && !hasFooterItemColumn ? (
								<div className="grid w-full min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1">
									<div className="flex min-w-0 justify-end">
										<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
											{coreActionsTower}
										</ArenaControlStrip>
									</div>
									<div className="flex shrink-0 justify-center px-0.5">{moveConfirmCenterTower}</div>
									<div className="flex min-w-0 justify-start">
										<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
											{petHintSlot}
										</ArenaControlStrip>
									</div>
								</div>
							) : (
								<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
									{coreZone}
								</ArenaControlStrip>
							)}
						</div>
					</div>
					{hasFooterItemColumn && (
						<>
							<div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
							{moveConfirmCenterTower ? (
								<>
									<div className="flex shrink-0 flex-col justify-center px-0.5 py-0.5">{moveConfirmCenterTower}</div>
									<div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
								</>
							) : null}
							<div className={`flex min-w-0 flex-1 flex-col justify-center px-0.5 py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}>
								<div className="flex min-h-0 w-full flex-1 items-center justify-center">
									<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
										{itemZone}
									</ArenaControlStrip>
								</div>
							</div>
						</>
					)}
				</>
			) : hasFooterItemColumn ? (
				<>
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
					>
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
							{coreZone}
						</ArenaControlStrip>
					</div>
					{moveConfirmCenterTower ? (
						<>
							<div className="w-px shrink-0 self-stretch bg-stone-600/50" aria-hidden />
							<div className="flex shrink-0 flex-col items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1">
								{moveConfirmCenterTower}
							</div>
						</>
					) : null}
					<div className="w-px shrink-0 self-stretch bg-stone-600/50" aria-hidden />
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}
					>
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6 min-[1025px]:gap-7">
							{itemZone}
						</ArenaControlStrip>
					</div>
				</>
			) : (
				<div
					className={`flex w-full min-w-0 items-center justify-center px-1.5 py-2 min-[1025px]:px-3 min-[1025px]:py-1.5 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
				>
					{moveConfirmCenterTower ? (
						<div className="grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-x-3 min-[1025px]:gap-x-6">
							<div className="flex min-w-0 justify-end">
								<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
									{coreActionsTower}
								</ArenaControlStrip>
							</div>
							<div className="flex shrink-0 justify-center">{moveConfirmCenterTower}</div>
							<div className="flex min-w-0 justify-start">
								<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
									{petHintSlot}
								</ArenaControlStrip>
							</div>
						</div>
					) : (
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
							{coreZone}
						</ArenaControlStrip>
					)}
				</div>
			)}
        </footer>
            {refreshConfirmModal && (
                <ConfirmModal
                    title={t('placementRefresh.towerRefreshTitle')}
                    message={t('placementRefresh.towerRefreshMessage')}
                    onConfirm={handleRefreshConfirm}
                    onCancel={() => setRefreshConfirmModal(false)}
                    confirmText={t("common:actions.confirm")}
                    cancelText={t("common:actions.cancel")}
                    confirmColorScheme="red"
                    isTopmost={true}
                    windowId="tower-refresh-confirm-modal"
                />
            )}
            {passConfirmModal && (
                <ConfirmModal
                    title={t('placementRefresh.passConfirmTitle')}
                    message={(session.passCount || 0) >= 1
                        ? t('placementRefresh.passConfirmBoth')
                        : t('placementRefresh.passConfirmSingle')}
                    onConfirm={handlePassConfirm}
                    onCancel={() => setPassConfirmModal(false)}
                    confirmText={t("controls.passLabel")}
                    cancelText={t("common:actions.cancel")}
                    confirmColorScheme="accent"
                    isTopmost={true}
                    windowId="tower-pass-confirm-modal"
                />
            )}
            {turnAddConfirmModal && (
                <ConfirmModal
                    title={t('placementRefresh.turnAddTitle')}
                    message={t('placementRefresh.turnAddMessage')}
                    onConfirm={handleTurnAddConfirm}
                    onCancel={() => setTurnAddConfirmModal(false)}
                    confirmText={t("placementRefresh.useItem")}
                    cancelText={t("common:actions.cancel")}
                    confirmColorScheme="accent"
                    isTopmost={true}
                    windowId="tower-turn-add-confirm-modal"
                />
            )}
    </>
    );
};

export default TowerControls;

