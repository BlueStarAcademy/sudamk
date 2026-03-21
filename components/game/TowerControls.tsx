import React, { useState, useMemo } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import ConfirmModal from '../ConfirmModal.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { shouldUseClientSideAi } from '../../services/wasmGnuGo.js';
import { replaceAppHash } from '../../utils/appUtils.js';

interface TowerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    showResultModal?: boolean;
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
    maxCount?: number;
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, count, maxCount }) => {
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
				<div className={`absolute -bottom-0.5 -right-0.5 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-purple-900 ${
                    count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'
                }`}>
                    {count}
                </div>
            )}
        </button>
    );
};

const TowerControls: React.FC<TowerControlsProps> = ({ session, onAction, currentUser, showResultModal, setShowResultModal, setConfirmModalType, isMoveInFlight = false, isBoardLocked = false }) => {
    const [refreshConfirmModal, setRefreshConfirmModal] = useState(false);
    const [passConfirmModal, setPassConfirmModal] = useState(false);
    const [turnAddConfirmModal, setTurnAddConfirmModal] = useState(false);
    const floor = session.towerFloor ?? 1;
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;
    const stage = TOWER_STAGES.find(s => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === floor;
    });

    // 훅은 early return 이전에 항상 호출 (React 규칙: 훅 개수/순서 일정 유지)
    const showMissileAndHiddenForHook = floor >= 21;
    const scanCountSettingForHook = showMissileAndHiddenForHook ? ((session.settings as any)?.scanCount ?? (stage?.scanCount ?? 0)) : 0;
    const myScansLeftForHook = (session as any).scans_p1 ?? scanCountSettingForHook;
    const canScan = React.useMemo(() => {
        if (!showMissileAndHiddenForHook || myScansLeftForHook <= 0) return false;
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;
        const aiInitialHiddenStone = (session as any).aiInitialHiddenStone;
        const aiHiddenIsPrePlaced = (session as any).aiInitialHiddenStoneIsPrePlaced;
        if (aiInitialHiddenStone && !aiHiddenIsPrePlaced) {
            const { x, y } = aiInitialHiddenStone;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (inBounds && board[y][x] === Player.White) {
                const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
                if (!isPermanentlyRevealed) return true;
            }
        }
        if (!session.hiddenMoves || !session.moveHistory) return false;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const move = session.moveHistory![parseInt(moveIndexStr, 10)];
            if (!move || move.player !== Player.White) return false;
            const { x, y } = move;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (!inBounds || board[y][x] !== Player.White) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [showMissileAndHiddenForHook, myScansLeftForHook, session.boardState, session.hiddenMoves, session.moveHistory, session.permanentlyRevealedStones, (session as any).aiInitialHiddenStone, (session as any).aiInitialHiddenStoneIsPrePlaced]);

    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const isWinner = session.winner === Player.Black;
        const nextFloor = floor < 100 ? floor + 1 : null;
        // 클리어 직후 towerFloor가 아직 반영되지 않았을 수 있으므로, 이번 게임에서 이겼으면 다음 층 허용
        const canTryNext = isWinner && nextFloor !== null;
        
        const retryActionPointCost = stage?.actionPointCost ?? 0;
        const nextFloorActionPointCost = nextFloor ? TOWER_STAGES.find(s => {
            const stageFloor = parseInt(s.id.replace('tower-', ''));
            return stageFloor === nextFloor;
        })?.actionPointCost ?? 0 : 0;

        const handleShowResults = () => {
            if (setShowResultModal) {
                setShowResultModal(true);
            }
        };

        const handleRetry = async () => {
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor, useClientSideAi: shouldUseClientSideAi() } });
                const gameId = (result as any)?.gameId;
                if (gameId) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[TowerControls] Failed to retry floor:', error);
                window.alert('재도전에 실패했습니다. 다시 시도해주세요.');
            }
        };
        
        const handleNextFloor = async () => {
            if (!canTryNext || !nextFloor) return;
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor: nextFloor, useClientSideAi: shouldUseClientSideAi() } });
                const gameId = (result as any)?.gameId;
                if (gameId) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[TowerControls] Failed to start next floor:', error);
                window.alert('다음 층 시작에 실패했습니다. 다시 시도해주세요.');
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
            <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col items-stretch justify-center gap-2 w-full min-h-[148px]">
                <div className="bg-gray-900/70 border border-stone-700 rounded-xl px-4 py-3 flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={handleShowResults} colorScheme="none" className={`justify-center !py-1.5 !px-4 !text-sm rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 whitespace-nowrap`}>
                        결과 보기
                    </Button>
                    <Button onClick={handleRetry} colorScheme="none" className={`justify-center !py-1.5 !px-4 !text-sm rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 whitespace-nowrap`}>
                        재도전 {retryActionPointCost > 0 && `(⚡${retryActionPointCost})`}
                    </Button>
                    <Button onClick={handleNextFloor} colorScheme="none" className={`justify-center !py-1.5 !px-4 !text-sm rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/90 via-sky-500/90 to-blue-500/90 text-white shadow-[0_12px_32px_-18px_rgba(56,189,248,0.85)] hover:from-cyan-300 hover:to-blue-500 whitespace-nowrap`} disabled={!canTryNext}>
                        다음 층{canTryNext && nextFloor ? `: ${nextFloor}층` : ''}{nextFloorActionPointCost > 0 && ` (⚡${nextFloorActionPointCost})`}
                    </Button>
                    <Button onClick={handleExitToLobby} colorScheme="none" className={`justify-center !py-1.5 !px-4 !text-sm rounded-xl border border-red-400/50 bg-gradient-to-r from-red-500/90 via-red-600/90 to-rose-600/90 text-white shadow-[0_12px_32px_-18px_rgba(239,68,68,0.85)] hover:from-red-400 hover:to-rose-500 whitespace-nowrap`}>
                        나가기
                    </Button>
                </div>
            </footer>
        );
    }
    
    const handleRefresh = () => {
        if (refreshDisabled) return;
        setRefreshConfirmModal(true);
    };
    const handleRefreshConfirm = () => {
        setRefreshConfirmModal(false);
        onAction({ type: 'TOWER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
    };

    const handleForfeit = () => {
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
            onAction({
                type: 'REQUEST_SCORING',
                payload: {
                    gameId: session.id,
                    boardState: session.boardState,
                    moveHistory: session.moveHistory || [],
                    settings: session.settings
                }
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

    // 도전의 탑 아이템: 로비·가방과 동일하게 이름/id 기준으로 보유 개수 합산 (source 무관)
    const inventory = currentUser?.inventory || [];
    const getItemCount = (namesOrIds: string | string[]): number => {
        const list = Array.isArray(namesOrIds) ? namesOrIds : [namesOrIds];
        return (inventory as any[])
            .filter((inv: any) => list.some((n: string) => inv.name === n || inv.id === n))
            .reduce((sum: number, inv: any) => sum + (inv.quantity ?? 0), 0);
    };

    const isMyTurn = session.currentPlayer === Player.Black;
    const gameStatus = session.gameStatus;
    const showTurnAdd = floor <= 20; // 1~20층에서만 턴 추가 아이템 표시
    // 도전의 탑 전체(1~100층)에서 통과 비활성: 1~20층 따내기 턴 제한, 21층+ 자동 계가
    const passAllowed = false;

    // 턴 추가 아이템 (1~20층, 제한 없음) - 로비·가방과 동기화
    const turnAddCount = showTurnAdd ? getItemCount(['턴 추가', '턴증가', 'turn_add', 'turn_add_item']) : 0;
    const turnAddDisabled = gameStatus !== 'playing' || turnAddCount <= 0;
    
    const handleUseTurnAdd = () => {
        if (gameStatus !== 'playing' || turnAddCount <= 0) return;
        setTurnAddConfirmModal(true);
    };

    const handleTurnAddConfirm = () => {
        setTurnAddConfirmModal(false);
        if (session.gameStatus !== 'playing') return;
        onAction({ type: 'TOWER_ADD_TURNS', payload: { gameId: session.id } });
    };

    // 미사일 아이템 (21층 이상, 최대 2개) - 로비·가방과 동기화
    const missileCount = showMissileAndHiddenForHook ? getItemCount(['미사일', 'missile']) : 0;
    const missileMaxCount = 2;
    const myMissilesLeft = session.missiles_p1 ?? missileCount;
    const missileDisabled = isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing' || myMissilesLeft <= 0;
    
    const handleUseMissile = () => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        onAction({ type: 'START_MISSILE_SELECTION', payload: { gameId: session.id } });
    };
    
    // 히든 아이템 (21층 이상, 최대 2개) - 로비·가방과 동기화
    const hiddenCount = showMissileAndHiddenForHook ? getItemCount(['히든', 'hidden']) : 0;
    const hiddenMaxCount = 2;
    // 히든 아이템 (스캔 아이템처럼 개수 기반)
    const hiddenLeft = session.hidden_stones_p1 ?? hiddenCount;
    const hiddenDisabled = isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing' || hiddenLeft <= 0;
    
    const handleUseHidden = () => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        onAction({ type: 'START_HIDDEN_PLACEMENT', payload: { gameId: session.id } });
    };

    // 스캔 아이템 (21층 이상): 상대(AI)에 미공개 히든돌이 있을 때만 사용 가능 (canScan은 상단 useMemo로 정의)
    const scanDisabled = isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing' || myScansLeftForHook <= 0 || !canScan;

    const handleUseScan = () => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        onAction({ type: 'START_SCANNING', payload: { gameId: session.id } });
    };

    // 배치변경 아이템 (모든 층, 최대 5개) - 로비·가방과 동기화
    const refreshCount = getItemCount(['배치 새로고침', '배치변경', 'reflesh', 'refresh']);
    const refreshMaxCount = 5;
    const canUseRefresh = session.moveHistory && session.moveHistory.length === 0 && session.gameStatus === 'playing' && session.currentPlayer === Player.Black;
    const refreshDisabled = refreshCount <= 0 || !canUseRefresh;

	return (
		<footer className="responsive-controls flex-shrink-0 bg-stone-800/70 backdrop-blur-sm rounded-xl p-3 flex items-stretch justify-between gap-4 w-full min-h-[148px] border border-stone-700/50">
			{/* Left group: 기권, 통과, 배치변경 (가운데 정렬) */}
			<div className="flex-1 flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-1">
                    <ImageButton
                        src="/images/button/giveup.png"
                        alt="기권"
                        onClick={handleForfeit}
                        title="기권하기"
                    />
					<span className="text-[11px] font-semibold text-red-300">기권</span>
                </div>
				{passAllowed && (
                    <div className="flex flex-col items-center gap-1">
                        <ImageButton
                            src="/images/button/pass.png"
                            alt="통과"
                            onClick={handlePassClick}
                            disabled={!isMyTurn || gameStatus !== 'playing'}
                            title="한 수 쉬기"
                        />
                        <span className={`text-[11px] font-semibold ${!isMyTurn || gameStatus !== 'playing' ? 'text-gray-500' : 'text-amber-100'}`}>통과</span>
                    </div>
                )}
                <div className="flex flex-col items-center gap-1">
                    <ImageButton
                        src="/images/button/reflesh.png"
                        alt="배치변경"
                        onClick={handleRefresh}
                        disabled={refreshDisabled}
                        title="배치 새로고침"
                        count={refreshCount}
                        maxCount={refreshMaxCount}
                    />
						<span className={`text-[11px] font-semibold ${refreshDisabled ? 'text-gray-500' : 'text-amber-100'}`}>
                        배치변경
                    </span>
                </div>
            </div>

            {refreshConfirmModal && (
                <ConfirmModal
                    title="배치변경"
                    message={`이용 가격: 배치 새로고침 1개
배치 새로고침 아이템 1개를 사용하여 배치를 다시 섞으시겠습니까?`}
                    onConfirm={handleRefreshConfirm}
                    onCancel={() => setRefreshConfirmModal(false)}
                    confirmText="확인"
                    cancelText="취소"
                    confirmColorScheme="red"
                    isTopmost={true}
                    windowId="tower-refresh-confirm-modal"
                />
            )}
            {passConfirmModal && (
                <ConfirmModal
                    title="통과 확인"
                    message={(session.passCount || 0) >= 1
                        ? "양측 연속 통과 시 계가로 진행됩니다. 통과하시겠습니까?"
                        : "한 수 쉬시겠습니까? 통과하면 상대(AI)에게 차례가 넘어갑니다."}
                    onConfirm={handlePassConfirm}
                    onCancel={() => setPassConfirmModal(false)}
                    confirmText="통과"
                    cancelText="취소"
                    confirmColorScheme="accent"
                    isTopmost={true}
                    windowId="tower-pass-confirm-modal"
                />
            )}
            {turnAddConfirmModal && (
                <ConfirmModal
                    title="턴 추가"
                    message="턴 추가 아이템 1개를 사용하여 흑의 제한 턴을 3턴 늘리시겠습니까? 확인 시 바로 적용됩니다."
                    onConfirm={handleTurnAddConfirm}
                    onCancel={() => setTurnAddConfirmModal(false)}
                    confirmText="사용"
                    cancelText="취소"
                    confirmColorScheme="accent"
                    isTopmost={true}
                    windowId="tower-turn-add-confirm-modal"
                />
            )}

			{/* Right group: 턴 추가 (1~20층) 또는 미사일, 히든 (21층 이상) (가운데 정렬) */}
			<div className="flex-1 flex items-center justify-center gap-6">
                {showTurnAdd && (
                    <div className="flex flex-col items-center gap-1">
                        <ImageButton
                            src="/images/button/addturn.png"
                            alt="턴 추가"
                            onClick={handleUseTurnAdd}
                            disabled={turnAddDisabled}
                            title="남은 턴 3턴 추가"
                            count={turnAddCount}
                        />
						<span className={`text-[11px] font-semibold ${turnAddDisabled ? 'text-gray-500' : 'text-amber-100'}`}>
                            턴 추가
                        </span>
                    </div>
                )}
                {showMissileAndHiddenForHook && (
                    <div className="flex flex-col items-center gap-1">
                        <ImageButton
                            src="/images/button/missile.png"
                            alt="미사일"
                            onClick={handleUseMissile}
                            disabled={missileDisabled}
                            title="미사일 발사"
                            count={myMissilesLeft}
                            maxCount={missileMaxCount}
                        />
						<span className={`text-[11px] font-semibold ${missileDisabled ? 'text-gray-500' : 'text-amber-100'}`}>
                            미사일
                        </span>
                    </div>
                )}
                {showMissileAndHiddenForHook && (
                    <div className="flex flex-col items-center gap-1">
                        <ImageButton
                            src="/images/button/hidden.png"
                            alt="히든"
                            onClick={handleUseHidden}
                            disabled={hiddenDisabled}
                            title="히든 스톤 배치"
                            count={hiddenLeft}
                            maxCount={hiddenMaxCount}
                        />
						<span className={`text-[11px] font-semibold ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>
                            히든
                        </span>
                    </div>
                )}
                {showMissileAndHiddenForHook && (
                    <div className="flex flex-col items-center gap-1">
                        <ImageButton
                            src="/images/button/scan.png"
                            alt="스캔"
                            onClick={handleUseScan}
                            disabled={scanDisabled}
                            title="스캔"
                            count={myScansLeftForHook}
                            maxCount={scanCountSettingForHook}
                        />
						<span className={`text-[11px] font-semibold ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>
                            스캔
                        </span>
                    </div>
                )}
            </div>
        </footer>
    );
};

export default TowerControls;

