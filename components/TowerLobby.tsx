import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useTowerRanking } from '../hooks/useTowerRanking.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL, CONSUMABLE_ITEMS } from '../constants';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { loadWasmGnuGo, shouldUseClientSideAi } from '../services/wasmGnuGo.js';
import { TOWER_CHALLENGE_LOBBY_IMG } from '../assets.js';
import { getKSTDate, getKSTMonth, getKSTFullYear } from '../utils/timeUtils.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import TowerItemShopModal from './TowerItemShopModal.js';
import DraggableWindow from './DraggableWindow.js';
import {
    countTowerLobbyInventoryQty,
    TOWER_ITEM_TURN_ADD_NAMES,
    TOWER_ITEM_MISSILE_NAMES,
    TOWER_ITEM_HIDDEN_NAMES,
    TOWER_ITEM_SCAN_NAMES,
    TOWER_ITEM_REFRESH_NAMES,
} from '../utils/towerLobbyInventory.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

// 월간 보상 구간 (매월 1일 0시 KST 지급, 역대 최고 층수 아님 월간 최고 층수 기준)
// 서버 `processTowerRankingRewards`의 구간·수치와 반드시 동기화할 것
const TOWER_MONTHLY_REWARD_TIERS = [
    { floor: 100, gold: 100_000, diamonds: 300, items: [{ itemId: '장비상자6', quantity: 2 }] },
    { floor: 90, gold: 75_000, diamonds: 225, items: [{ itemId: '장비상자6', quantity: 1 }] },
    { floor: 80, gold: 50_000, diamonds: 150, items: [{ itemId: '장비상자5', quantity: 2 }] },
    { floor: 65, gold: 25_000, diamonds: 75, items: [{ itemId: '장비상자5', quantity: 1 }] },
    { floor: 50, gold: 15_000, diamonds: 60, items: [{ itemId: '장비상자4', quantity: 1 }] },
    { floor: 35, gold: 10_000, diamonds: 45, items: [{ itemId: '장비상자3', quantity: 1 }] },
    { floor: 20, gold: 5_000, diamonds: 30, items: [{ itemId: '장비상자2', quantity: 1 }] },
    { floor: 10, gold: 3_000, diamonds: 15, items: [{ itemId: '장비상자1', quantity: 1 }] },
] as const;

/** 보상정보 모달 층 라벨 색 (TOWER_MONTHLY_REWARD_TIERS 순서와 동일) */
const TOWER_MONTHLY_MODAL_TIER_LABEL_CLASS = [
    'text-yellow-300',
    'text-gray-300',
    'text-amber-600',
    'text-amber-300',
    'text-amber-300',
    'text-amber-300',
    'text-amber-300',
    'text-amber-300',
] as const;

const TowerLobby: React.FC = () => {
        const { currentUser, currentUserWithStatus, handlers, towerRankingsRefetchTrigger } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [isItemShopOpen, setIsItemShopOpen] = useState(false);
    const [timeUntilReset, setTimeUntilReset] = useState<string>('');
    const stageScrollRef = useRef<HTMLDivElement>(null);
    const isChallengingRef = useRef(false); // 중복 클릭 방지용 ref

    // 도전의 탑 입장 시 WASM GnuGo 최초 1회 프리로드
    useEffect(() => {
        loadWasmGnuGo().catch(() => {});
    }, []);

    // 다음 달 1일 0시(KST)까지 남은 시간 계산
    useEffect(() => {
        const updateTimeUntilReset = () => {
            const now = Date.now();
            const kstDate = getKSTDate(now);
            const kstYear = getKSTFullYear(now);
            const kstMonth = getKSTMonth(now);
            
            // 다음 달 1일 0시(KST)
            const nextMonth = kstMonth === 11 ? 0 : kstMonth + 1;
            const nextYear = kstMonth === 11 ? kstYear + 1 : kstYear;
            
            // KST 시간으로 다음 달 1일 0시 생성
            const resetDateKST = new Date(Date.UTC(nextYear, nextMonth, 1, 0, 0, 0, 0));
            // KST는 UTC+9이므로 UTC로 변환하려면 9시간 빼기
            const resetDateUTC = new Date(resetDateKST.getTime() - (9 * 60 * 60 * 1000));
            
            const diff = resetDateUTC.getTime() - now;
            
            if (diff <= 0) {
                setTimeUntilReset('초기화됨');
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (days > 0) {
                setTimeUntilReset(`${days}일 ${hours}시간 ${minutes}분`);
            } else if (hours > 0) {
                setTimeUntilReset(`${hours}시간 ${minutes}분 ${seconds}초`);
            } else {
                setTimeUntilReset(`${minutes}분 ${seconds}초`);
            }
        };
        
        updateTimeUntilReset();
        const interval = setInterval(updateTimeUntilReset, 1000);
        return () => clearInterval(interval);
    }, []);

    /** 네이티브 상단 행(탑 이미지·랭킹·퀵메뉴) 높이: 퀵메뉴 고유 높이에 맞춤 */
    const nativeQuickMenuMeasureRef = useRef<HTMLDivElement>(null);
    const [nativeTopRowHeightPx, setNativeTopRowHeightPx] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (!isNativeMobile || !currentUser) return;
        const outer = nativeQuickMenuMeasureRef.current;
        if (!outer) return;
        const update = () => {
            const inner = outer.querySelector<HTMLElement>('[data-quick-access-sidebar-root]');
            if (!inner) return;
            const boxH = Math.ceil(
                Math.max(outer.getBoundingClientRect().height, outer.scrollHeight, outer.offsetHeight)
            );
            if (boxH > 0) setNativeTopRowHeightPx(boxH);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(outer);
        const innerRoot = outer.querySelector('[data-quick-access-sidebar-root]');
        if (innerRoot) ro.observe(innerRoot);
        return () => ro.disconnect();
    }, [isNativeMobile, currentUser]);

    const onBackToProfile = () => window.location.hash = '#/profile';

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    const { rankings: towerRankings, loading: towerRankingsLoading } = useTowerRanking(towerRankingsRefetchTrigger);
    
    // 랭킹 계산: 서버에서 받은 랭킹 데이터 사용
    const { myRankingEntry, top100Users } = useMemo(() => {
        if (towerRankings.length === 0) {
            return { myRankingEntry: null, top100Users: [] };
        }
        
        // 내 아이디 찾기
        const myEntry = towerRankings.find((entry: any) => entry.id === currentUser.id);
        
        // Top 100 (내 아이디도 100위 안이면 원래 순위에 그대로 표시)
        const top100 = towerRankings.slice(0, 100);
        
        return {
            myRankingEntry: myEntry ? { 
                id: myEntry.id,
                nickname: myEntry.nickname,
                avatarId: myEntry.avatarId,
                borderId: myEntry.borderId,
                rank: myEntry.rank,
                displayFloor: myEntry.monthlyTowerFloor ?? myEntry.towerFloor ?? 0,
            } : null,
            top100Users: top100.map((entry: any) => ({
                id: entry.id,
                nickname: entry.nickname,
                avatarId: entry.avatarId,
                borderId: entry.borderId,
                rank: entry.rank,
                displayFloor: entry.monthlyTowerFloor ?? entry.towerFloor ?? 0,
            }))
        };
    }, [towerRankings, currentUser.id]);

    // 역대 최고 층수, 월간 최고 층수, 현재 순위 기준 월간 보상
    const bestFloorAllTime = (currentUserWithStatus as any)?.towerFloor ?? 0;
    const monthlyBestFloor = (currentUserWithStatus as any)?.monthlyTowerFloor ?? 0;
    const myRewardTier = useMemo(() => {
        if (monthlyBestFloor < 10) return null;
        const tier = TOWER_MONTHLY_REWARD_TIERS.find(t => monthlyBestFloor >= t.floor);
        return tier ?? null;
    }, [monthlyBestFloor]);

    // 스테이지(층) 데이터 (1층부터 100층까지, 역순으로 표시하여 아래에서 위로 스크롤)
    const stages = Array.from({ length: 100 }, (_, i) => i + 1).reverse();

    // 스크롤을 아래쪽(1층)부터 시작하도록 설정
    useEffect(() => {
        if (stageScrollRef.current) {
            // 스크롤을 맨 아래(1층)로 설정
            stageScrollRef.current.scrollTop = stageScrollRef.current.scrollHeight;
        }
    }, []);

    const rankingColClass = isNativeMobile
        ? 'flex max-h-[32dvh] min-h-0 w-full flex-none flex-col gap-1 overflow-hidden pb-0.5'
        : 'flex-[0_0_20%] max-w-[20%] flex flex-col gap-2 min-h-0 overflow-hidden';
    const imageColClass = isNativeMobile
        ? 'relative h-[14dvh] max-h-[120px] min-h-[72px] w-full flex-shrink-0 overflow-hidden rounded-lg border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 shadow-lg shadow-amber-900/40 backdrop-blur-md'
        : 'flex-[0_0_25%] max-w-[25%] bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl shadow-amber-900/50 relative min-h-0';
    const stageColClass = isNativeMobile
        ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 p-1 shadow-lg shadow-amber-900/40 backdrop-blur-md sm:p-2'
        : 'flex-[0_0_35%] max-w-[35%] bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl p-2 sm:p-3 flex flex-col min-h-0 overflow-hidden backdrop-blur-md shadow-2xl shadow-amber-900/50';
    const quickColClass = isNativeMobile
        ? 'flex h-[min(30dvh,280px)] min-h-[200px] w-24 min-w-[96px] max-w-[96px] flex-shrink-0 flex-col overflow-hidden self-center'
        : 'flex-shrink-0 w-24 min-w-[96px] overflow-hidden';

    const towerNativeGlass =
        'rounded-xl border border-amber-500/40 bg-gray-950/50 backdrop-blur-md shadow-lg shadow-black/30';

    const renderTowerFloorRows = () =>
        stages.map((floor) => {
                            const stage = TOWER_STAGES.find(s => s.id === `tower-${floor}`);
                            const userTowerFloor = (currentUserWithStatus as any).towerFloor ?? 0;
                            const isCleared = floor <= userTowerFloor;
                            const isCurrent = floor === userTowerFloor + 1;
                            const actionPoints = currentUserWithStatus?.actionPoints?.current ?? 0;
                            
                            // 관리자 여부 확인
                            const isAdmin = currentUser?.isAdmin ?? false;
                            
                            // 잠금 여부: 1층은 항상 열림, 2층 이상은 이전 층이 클리어되어야 함 (관리자는 예외)
                            const isLocked = !isAdmin && floor > 1 && floor > userTowerFloor + 1;
                            
                            // 클리어한 층은 행동력 소모가 0
                            const effectiveActionPointCost = isCleared ? 0 : (stage?.actionPointCost ?? 0);
                            const canChallenge = !isLocked && actionPoints >= effectiveActionPointCost;
                            
                            if (!stage) return null;
                            
                            // 목표 정보 (툴팁·표시용)
                            const getTargetInfo = () => {
                                if (stage.blackTurnLimit) {
                                    return `흑 ${stage.targetScore?.black ?? 0}개 따내기 (${stage.blackTurnLimit}턴 제한)`;
                                }
                                if (stage.autoScoringTurns != null && stage.autoScoringTurns > 0) {
                                    return `[${stage.autoScoringTurns}수 계가] 해당 수까지 두면 자동 계가`;
                                }
                                return '승리';
                            };
                            const autoScoringLabel =
                                floor >= 21 && stage.autoScoringTurns != null && stage.autoScoringTurns > 0
                                    ? `[${stage.autoScoringTurns}수 계가]`
                                    : null;
                            
                            // 보상 정보
                            const reward = stage.rewards.firstClear;
                            const hasItemReward = reward.items && reward.items.length > 0;
                            
                            // 아이템 이미지 찾기 함수
                            const getItemImage = (itemId: string): string => {
                                // itemId를 이름으로 변환 (예: '장비상자1' -> '장비 상자 I')
                                const itemNameMap: Record<string, string> = {
                                    '장비상자1': '장비 상자 I',
                                    '장비상자2': '장비 상자 II',
                                    '장비상자3': '장비 상자 III',
                                    '장비상자4': '장비 상자 IV',
                                    '장비상자5': '장비 상자 V',
                                    '장비상자6': '장비 상자 VI',
                                    '재료상자1': '재료 상자 I',
                                    '재료상자2': '재료 상자 II',
                                    '재료상자3': '재료 상자 III',
                                    '재료상자4': '재료 상자 IV',
                                    '재료상자5': '재료 상자 V',
                                    '재료상자6': '재료 상자 VI',
                                    '골드꾸러미1': '골드 꾸러미1',
                                    '골드꾸러미2': '골드 꾸러미2',
                                    '골드꾸러미3': '골드 꾸러미3',
                                    '골드꾸러미4': '골드 꾸러미4',
                                    '다이아꾸러미1': '다이아 꾸러미1',
                                    '다이아꾸러미2': '다이아 꾸러미2',
                                    '다이아꾸러미3': '다이아 꾸러미3',
                                    '다이아꾸러미4': '다이아 꾸러미4',
                                };
                                
                                const itemName = itemNameMap[itemId] || itemId;
                                const itemTemplate = CONSUMABLE_ITEMS.find(item => item.name === itemName);
                                return itemTemplate?.image || '/images/icon/item_box.png';
                            };

							const getItemDisplayName = (itemId: string): string => {
								const itemNameMap: Record<string, string> = {
									'장비상자1': '장비 상자 I',
									'장비상자2': '장비 상자 II',
									'장비상자3': '장비 상자 III',
									'장비상자4': '장비 상자 IV',
									'장비상자5': '장비 상자 V',
									'장비상자6': '장비 상자 VI',
									'재료상자1': '재료 상자 I',
									'재료상자2': '재료 상자 II',
									'재료상자3': '재료 상자 III',
									'재료상자4': '재료 상자 IV',
									'재료상자5': '재료 상자 V',
									'재료상자6': '재료 상자 VI',
									'골드꾸러미1': '골드 꾸러미1',
									'골드꾸러미2': '골드 꾸러미2',
									'골드꾸러미3': '골드 꾸러미3',
									'골드꾸러미4': '골드 꾸러미4',
									'다이아꾸러미1': '다이아 꾸러미1',
									'다이아꾸러미2': '다이아 꾸러미2',
									'다이아꾸러미3': '다이아 꾸러미3',
									'다이아꾸러미4': '다이아 꾸러미4',
								};
								return itemNameMap[itemId] || itemId;
							};
                            
                            const isCaptureMode = floor <= 20; // 1-20층: 따내기 바둑
                            
                            return (
                                <div
                                    key={floor}
                                    className={`rounded-lg p-2.5 sm:p-3 border flex items-center justify-between gap-2 relative ${
                                        isLocked
                                            ? 'bg-gray-900/50 border-gray-700/50 opacity-60'
                                            : isCurrent
                                            ? 'bg-gradient-to-r from-amber-700/50 to-yellow-700/50 border-amber-500/70 shadow-lg shadow-amber-600/50'
                                            : isCleared
                                            ? 'bg-gray-700/40 border-amber-600/50 hover:bg-gray-600/50 hover:border-amber-500/70'
                                            : 'bg-gray-800/30 border-amber-700/30 hover:bg-gray-700/40 hover:border-amber-600/50'
                                    }`}
                                >
                                    {/* 자물쇠 오버레이 */}
                                    {isLocked && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg z-10 backdrop-blur-sm">
                                            <div className="flex items-center gap-2 px-2">
                                                <span className="text-2xl sm:text-3xl">🔒</span>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs sm:text-sm text-amber-300 font-semibold whitespace-nowrap">잠금</span>
                                                    <span className="text-[10px] sm:text-xs text-amber-400/80 whitespace-nowrap">아래층을 먼저 클리어하세요</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* 왼쪽: 정보 영역 */}
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        {/* 층수 */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1.5 sm:px-2.5 bg-amber-900/50 rounded border border-amber-600/40">
                                            <span
                                                className={`text-lg sm:text-xl font-black ${
                                                    isCurrent
                                                        ? 'text-yellow-300'
                                                        : isCleared
                                                          ? 'text-amber-200'
                                                          : 'text-amber-400'
                                                }`}
                                            >
                                                {floor}
                                            </span>
                                            <span className="text-xs sm:text-sm text-amber-300 font-semibold">층</span>
                                            {isCleared && (
                                                <span className="text-green-400 text-sm sm:text-base font-bold">✓</span>
                                            )}
                                        </div>

                                        {/* 바둑판·배치 / 목표·제한 → 두 줄로 가로 배치 */}
                                        <div className="flex flex-col gap-y-1.5 min-w-0 flex-1 text-[11px] sm:text-xs">
                                            {isCaptureMode && (
                                                <>
                                                    <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 gap-y-1 min-w-0">
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-amber-400/90 font-semibold whitespace-nowrap">바둑판</span>
                                                            <span
                                                                className="font-bold tabular-nums text-amber-100"
                                                                title={`바둑판 ${stage.boardSize}×${stage.boardSize}`}
                                                            >
                                                                {stage.boardSize}×{stage.boardSize}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-amber-400/90 font-semibold whitespace-nowrap shrink-0">배치</span>
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/Black.png" alt="흑" className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                                                                    <span className="text-amber-200 font-bold tabular-nums">{stage.placements.black}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/White.png" alt="백" className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                                                                    <span className="text-amber-200 font-bold tabular-nums">{stage.placements.white}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 gap-y-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-amber-400/90 font-semibold whitespace-nowrap">목표</span>
                                                            <span className="text-yellow-300 font-bold">흑 {stage.targetScore?.black ?? 0}개</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-amber-400/90 font-semibold whitespace-nowrap">제한</span>
                                                            <span className="text-amber-200 font-bold tabular-nums">{stage.blackTurnLimit}턴</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {!isCaptureMode && (
                                                <div className="flex flex-col gap-y-1 min-w-0" title={getTargetInfo()}>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0 sm:gap-x-4">
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-amber-400/90 font-semibold whitespace-nowrap">바둑판</span>
                                                            <span className="font-bold tabular-nums text-amber-100">{stage.boardSize}×{stage.boardSize}</span>
                                                        </div>
                                                        {autoScoringLabel && (
                                                            <div className="flex min-w-0 items-center gap-1.5">
                                                                <span className="shrink-0 text-amber-400/90 font-semibold whitespace-nowrap">계가</span>
                                                                <span className="min-w-0 truncate text-sky-300 font-bold tracking-tight">{autoScoringLabel}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 sm:gap-x-4">
                                                        <span className="text-amber-400/90 font-semibold whitespace-nowrap shrink-0">배치</span>
                                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-x-3">
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/Black.png" alt="흑" className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="text-amber-200 font-bold tabular-nums">{stage.placements.black}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/White.png" alt="백" className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="text-amber-200 font-bold tabular-nums">{stage.placements.white}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/BlackDouble.png" alt="흑 문양" className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="text-amber-200 font-bold tabular-nums">×{stage.placements.blackPattern}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/WhiteDouble.png" alt="백 문양" className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="text-amber-200 font-bold tabular-nums">×{stage.placements.whitePattern}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* 보상 정보 (두 줄로 표시, 도전 버튼 왼쪽에 정렬) */}
                                        <div className="flex flex-col gap-1 flex-shrink-0 ml-auto">
                                            {isCleared ? (
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <span className="text-xs sm:text-sm text-amber-300 font-semibold whitespace-nowrap">보상수령완료</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* 첫 번째 줄: 골드 또는 아이템 */}
                                                    {reward.gold > 0 ? (
                                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                                            <img src="/images/icon/Gold.png" alt="골드" title="골드" className="w-4 h-4 sm:w-5 sm:h-5" />
                                                            <span className="text-xs sm:text-sm text-yellow-300 font-semibold whitespace-nowrap">{reward.gold}</span>
                                                        </div>
                                                    ) : hasItemReward && reward.items ? (
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {reward.items.map((item: any, idx: number) => {
                                                                const itemId = 'itemId' in item ? item.itemId : item.name || item.id;
                                                                const itemImage = getItemImage(itemId);
                                                                const itemDisplayName = getItemDisplayName(itemId);
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-0.5">
                                                                        <img src={itemImage} alt={itemDisplayName} title={itemDisplayName} className="w-4 h-4 sm:w-5 sm:h-5" />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : null}
                                                    {/* 두 번째 줄: 전략EXP */}
                                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                                        <span className="text-xs sm:text-sm text-green-300 font-semibold whitespace-nowrap">전략EXP {reward.exp}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* 오른쪽: 도전 버튼 */}
									<button
										onClick={async (e) => {
                                            // 중복 클릭 방지
                                            if (isChallengingRef.current || !canChallenge || isLocked) {
                                                e.preventDefault();
                                                return;
                                            }
                                            
                                            // 클릭 처리 시작
                                            isChallengingRef.current = true;
                                            
											try {
												const res = await handlers.handleAction({
                                                    type: 'START_TOWER_GAME',
                                                    payload: { floor, useClientSideAi: shouldUseClientSideAi() }
                                                });
												const gameId = (res as any)?.gameId || (res as any)?.clientResponse?.gameId;
												console.log('[TowerLobby] START_TOWER_GAME response:', { res, gameId });
												// useApp.ts에서 라우팅을 처리하므로 여기서는 액션만 호출
											} catch (error) {
												console.error('[TowerLobby] Failed to start tower game:', error);
												// 에러 발생 시에만 플래그 해제 (성공 시 라우팅되므로 해제 불필요)
												isChallengingRef.current = false;
											}
                                        }}
                                        disabled={!canChallenge || isLocked || isChallengingRef.current}
                                        className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                                            canChallenge && !isLocked
                                                ? 'bg-gradient-to-br from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-lg shadow-amber-600/50'
                                                : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {effectiveActionPointCost > 0 && (
                                            <span className="text-[10px] sm:text-xs leading-none">⚡{effectiveActionPointCost}</span>
                                        )}
                                        <span className="text-[10px] sm:text-xs leading-none">도전</span>
                                    </button>
                                </div>
                            );
                        });


    function renderTowerMainColumns() {
        if (isNativeMobile) {
            return (
                <>
                    <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0a0a0a] via-[#1a1510] to-[#0a0a0a]" />
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                        <div
                            className="grid min-h-0 shrink-0 grid-cols-[minmax(0,2.5fr)_minmax(0,6.5fr)_5.5rem] items-stretch gap-1 overflow-hidden"
                            style={
                                nativeTopRowHeightPx != null
                                    ? { height: `${nativeTopRowHeightPx}px`, minHeight: 0 }
                                    : { minHeight: 0, maxHeight: 'min(44dvh, 90vh)' }
                            }
                        >
                            <div className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0.5 ${towerNativeGlass}`}>
                                <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
                                    <img
                                        src={TOWER_CHALLENGE_LOBBY_IMG}
                                        alt="도전의 탑"
                                        className="h-full w-full object-cover object-center"
                                    />
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
                                </div>
                            </div>
                            <div className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-1 sm:p-2 ${towerNativeGlass}`}>
                    <div className="mb-1 flex flex-shrink-0 items-center justify-between sm:mb-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)]">
                                랭킹 Top 100
                            </h2>
                            <span className="text-xs sm:text-sm font-semibold text-yellow-300">{timeUntilReset}</span>
                        </div>
                        <Button
                            onClick={() => setIsRewardModalOpen(true)}
                            colorScheme="none"
                            className="!p-1.5 !min-w-0 border border-amber-600/50 bg-amber-900/40 hover:bg-amber-800/60 backdrop-blur-sm text-xs sm:text-sm text-amber-200"
                        >
                            보상정보
                        </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                        {/* 내 정보 전용 박스: 역대 최고 층수, 현재 순위, 해당 보상 */}
                        <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/80 via-gray-900/90 to-amber-950/80 shadow-xl shadow-amber-900/40 overflow-hidden mb-3">
                            <div className="px-3 py-2.5 border-b border-amber-600/50 bg-amber-900/30">
                                <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-200">내 도전의 탑 기록</h3>
                            </div>
                            <div className="p-3 space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-amber-300/90">역대 최고 층수</span>
                                    <span className="font-bold text-yellow-200">{bestFloorAllTime}층</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-amber-300/90">현재 나의 순위</span>
                                    <span className="font-bold text-yellow-200">{myRankingEntry ? `${myRankingEntry.rank}위` : '순위 외'}</span>
                                </div>
                                <div className="pt-2 border-t border-amber-700/40">
                                    <p className="text-amber-300/90 text-xs mb-1.5">이번 달 예정 보상 (현재 기록 기준)</p>
                                    {myRewardTier ? (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="inline-flex items-center gap-1 text-yellow-200"><img src="/images/icon/Gold.png" alt="골드" className="w-4 h-4" />{myRewardTier.gold.toLocaleString()}</span>
                                            <span className="inline-flex items-center gap-1 text-cyan-200"><img src="/images/icon/Zem.png" alt="다이아" className="w-4 h-4" />{myRewardTier.diamonds}</span>
                                            {myRewardTier.items.map((it: { itemId: string; quantity: number }, i: number) => (
                                                <span key={i} className="inline-flex items-center gap-1 text-amber-200">
                                                    <img src={`/images/Box/EquipmentBox${it.itemId.replace('장비상자', '')}.png`} alt={it.itemId} className="w-4 h-4" />
                                                    ×{it.quantity}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-amber-400/80 text-xs">10층 이상 클리어 시 월간 보상을 받을 수 있습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        {!myRankingEntry && monthlyBestFloor < 10 && (
                            <p className="text-center text-amber-300/70 text-xs py-2 px-1">10층 이상 클리어 시 랭킹에 표시됩니다.</p>
                        )}
                        {/* Top 100 */}
                        {towerRankingsLoading && towerRankings.length === 0 ? (
                            <p className="text-center text-amber-300/60 py-8">랭킹 불러오는 중...</p>
                        ) : top100Users.length > 0 ? (
                            top100Users.map((user) => {
                                const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
                                const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;
                                const isTop3 = (user as any).rank <= 3;
                                const rank = (user as any).rank;
                                const isCurrentUser = !!currentUser && user.id === currentUser.id;
                                return (
                                    <div
                                        key={user.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                                            isCurrentUser
                                                ? 'bg-gradient-to-r from-yellow-900/45 via-amber-800/45 to-orange-900/45 border-2 border-yellow-400/60 shadow-md shadow-yellow-900/30'
                                                : isTop3
                                                ? 'bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-500/50 hover:from-amber-800/50 hover:to-yellow-800/50'
                                                : 'bg-gray-800/40 border border-amber-700/30 hover:bg-gray-700/50 hover:border-amber-600/50'
                                        }`}
                                    >
                                        <span className={`text-xs sm:text-sm font-bold w-6 flex-shrink-0 ${
                                            rank === 1 ? 'text-yellow-300' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-500' : 'text-amber-300'
                                        }`}>
                                            {rank}
                                        </span>
                                        <Avatar
                                            userId={user.id}
                                            userName={user.nickname}
                                            avatarUrl={avatarUrl}
                                            borderUrl={borderUrl}
                                            size={32}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs sm:text-sm font-semibold truncate ${isCurrentUser ? 'text-yellow-100' : 'text-amber-100'}`}>{user.nickname}</p>
                                            <p className="text-[10px] sm:text-xs text-amber-300/80">
                                                층: {(user as any).displayFloor ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-amber-300/60 py-8">랭킹 데이터가 없습니다.</p>
                        )}
                    </div>
                                </div>
                            <div
                                ref={nativeQuickMenuMeasureRef}
                                className={`box-border flex h-fit min-h-0 w-full min-w-0 shrink-0 flex-col self-start overflow-hidden p-0.5 ${towerNativeGlass}`}
                            >
                                <QuickAccessSidebar nativeHomeColumn />
                            </div>
                        </div>
                        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_5.5rem] gap-1 overflow-hidden">
                            <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1 sm:p-2 ${towerNativeGlass}`}>
                                <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 mb-2 flex-shrink-0 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)]">
                                    스테이지
                                </h2>
                                <div
                                    ref={stageScrollRef}
                                    className="min-h-0 flex-1 overflow-y-auto space-y-1.5 pr-1"
                                >
                                    {renderTowerFloorRows()}
                                </div>
                            </div>
                            <div className={`flex min-h-0 w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] shrink-0 flex-col overflow-hidden p-1.5 ${towerNativeGlass}`}>
                                <h3 className="mb-1.5 shrink-0 whitespace-nowrap text-center text-[9px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)] sm:text-[10px]">
                                    보유 아이템
                                </h3>
                                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                                    <div className="flex flex-row flex-wrap items-center justify-center gap-1 pb-1">
                                        {(() => {
                                            const inventory = currentUserWithStatus?.inventory || [];
                                            const getItemCount = (namesOrIds: readonly string[]): number =>
                                                countTowerLobbyInventoryQty(inventory, namesOrIds);
                                            const items = [
                                                { name: '턴 추가', icon: '/images/button/addturn.png', count: getItemCount(TOWER_ITEM_TURN_ADD_NAMES) },
                                                { name: '미사일', icon: '/images/button/missile.png', count: getItemCount(TOWER_ITEM_MISSILE_NAMES) },
                                                { name: '히든', icon: '/images/button/hidden.png', count: getItemCount(TOWER_ITEM_HIDDEN_NAMES) },
                                                { name: '스캔', icon: '/images/button/scan.png', count: getItemCount(TOWER_ITEM_SCAN_NAMES) },
                                                { name: '배치변경', icon: '/images/button/reflesh.png', count: getItemCount(TOWER_ITEM_REFRESH_NAMES) },
                                            ];
                                            return items.map((item, index) => (
                                                <button
                                                    key={index}
                                                    className="flex flex-col items-center gap-0.5 bg-gray-800/40 border border-amber-700/30 rounded-lg p-1.5 hover:bg-gray-700/50 hover:border-amber-600/50 transition-colors"
                                                    onClick={() => setIsItemShopOpen(true)}
                                                >
                                                    <div className="relative w-8 h-8 flex-shrink-0">
                                                        <img src={item.icon} alt={item.name} className="w-full h-full object-contain" />
                                                        <div className={`absolute -bottom-0.5 -right-0.5 text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border border-amber-900 ${item.count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'}`}>
                                                            {item.count}
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-amber-100 text-center leading-tight">{item.name}</p>
                                                </button>
                                            ));
                                        })()}
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setIsItemShopOpen(true)}
                                    colorScheme="none"
                                    className="mt-1.5 w-full shrink-0 !min-w-0 !px-1 !py-1 !text-[10px] font-semibold leading-tight border border-amber-600/50 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200"
                                >
                                    구매하기
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            );
        }

        return (
            <>
                    {/* 좌측: 랭킹 Top 100 + 보유 아이템 (아래쪽 별도 패널) */}
                    <div className={rankingColClass}>
                    {/* 랭킹 Top 100 (하단 여유 줄여서 보유 아이템 공간 확보) */}
                    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl p-2 sm:p-3 overflow-hidden backdrop-blur-md shadow-2xl shadow-amber-900/50">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)]">
                                랭킹 Top 100
                            </h2>
                            <span className="text-xs sm:text-sm font-semibold text-yellow-300">{timeUntilReset}</span>
                        </div>
                        <Button
                            onClick={() => setIsRewardModalOpen(true)}
                            colorScheme="none"
                            className="!p-1.5 !min-w-0 border border-amber-600/50 bg-amber-900/40 hover:bg-amber-800/60 backdrop-blur-sm text-xs sm:text-sm text-amber-200"
                        >
                            보상정보
                        </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                        {/* 내 정보 전용 박스: 역대 최고 층수, 현재 순위, 해당 보상 */}
                        <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/80 via-gray-900/90 to-amber-950/80 shadow-xl shadow-amber-900/40 overflow-hidden mb-3">
                            <div className="px-3 py-2.5 border-b border-amber-600/50 bg-amber-900/30">
                                <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-200">내 도전의 탑 기록</h3>
                            </div>
                            <div className="p-3 space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-amber-300/90">역대 최고 층수</span>
                                    <span className="font-bold text-yellow-200">{bestFloorAllTime}층</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-amber-300/90">현재 나의 순위</span>
                                    <span className="font-bold text-yellow-200">{myRankingEntry ? `${myRankingEntry.rank}위` : '순위 외'}</span>
                                </div>
                                <div className="pt-2 border-t border-amber-700/40">
                                    <p className="text-amber-300/90 text-xs mb-1.5">이번 달 예정 보상 (현재 기록 기준)</p>
                                    {myRewardTier ? (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="inline-flex items-center gap-1 text-yellow-200"><img src="/images/icon/Gold.png" alt="골드" className="w-4 h-4" />{myRewardTier.gold.toLocaleString()}</span>
                                            <span className="inline-flex items-center gap-1 text-cyan-200"><img src="/images/icon/Zem.png" alt="다이아" className="w-4 h-4" />{myRewardTier.diamonds}</span>
                                            {myRewardTier.items.map((it: { itemId: string; quantity: number }, i: number) => (
                                                <span key={i} className="inline-flex items-center gap-1 text-amber-200">
                                                    <img src={`/images/Box/EquipmentBox${it.itemId.replace('장비상자', '')}.png`} alt={it.itemId} className="w-4 h-4" />
                                                    ×{it.quantity}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-amber-400/80 text-xs">10층 이상 클리어 시 월간 보상을 받을 수 있습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        {!myRankingEntry && monthlyBestFloor < 10 && (
                            <p className="text-center text-amber-300/70 text-xs py-2 px-1">10층 이상 클리어 시 랭킹에 표시됩니다.</p>
                        )}
                        {/* Top 100 */}
                        {towerRankingsLoading && towerRankings.length === 0 ? (
                            <p className="text-center text-amber-300/60 py-8">랭킹 불러오는 중...</p>
                        ) : top100Users.length > 0 ? (
                            top100Users.map((user) => {
                                const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
                                const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;
                                const isTop3 = (user as any).rank <= 3;
                                const rank = (user as any).rank;
                                const isCurrentUser = !!currentUser && user.id === currentUser.id;
                                return (
                                    <div
                                        key={user.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                                            isCurrentUser
                                                ? 'bg-gradient-to-r from-yellow-900/45 via-amber-800/45 to-orange-900/45 border-2 border-yellow-400/60 shadow-md shadow-yellow-900/30'
                                                : isTop3
                                                ? 'bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-500/50 hover:from-amber-800/50 hover:to-yellow-800/50'
                                                : 'bg-gray-800/40 border border-amber-700/30 hover:bg-gray-700/50 hover:border-amber-600/50'
                                        }`}
                                    >
                                        <span className={`text-xs sm:text-sm font-bold w-6 flex-shrink-0 ${
                                            rank === 1 ? 'text-yellow-300' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-500' : 'text-amber-300'
                                        }`}>
                                            {rank}
                                        </span>
                                        <Avatar
                                            userId={user.id}
                                            userName={user.nickname}
                                            avatarUrl={avatarUrl}
                                            borderUrl={borderUrl}
                                            size={32}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs sm:text-sm font-semibold truncate ${isCurrentUser ? 'text-yellow-100' : 'text-amber-100'}`}>{user.nickname}</p>
                                            <p className="text-[10px] sm:text-xs text-amber-300/80">
                                                층: {(user as any).displayFloor ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-amber-300/60 py-8">랭킹 데이터가 없습니다.</p>
                        )}
                    </div>
                    </div>

                    {/* 보유 아이템 (랭킹 하단 별도 패널, 잘리지 않도록) */}
                    <div className="flex-shrink-0 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl p-2 backdrop-blur-md shadow-2xl shadow-amber-900/50">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs sm:text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)]">
                                보유 아이템
                            </h3>
                            <Button
                                onClick={() => setIsItemShopOpen(true)}
                                colorScheme="none"
                                className="!py-1 !px-2 !min-w-0 text-xs font-semibold border border-amber-600/50 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200"
                            >
                                구매하기
                            </Button>
                        </div>
                        <div className="flex flex-row gap-1.5 justify-center items-center flex-wrap">
                            {(() => {
                                const inventory = currentUserWithStatus?.inventory || [];
                                const getItemCount = (namesOrIds: readonly string[]): number =>
                                    countTowerLobbyInventoryQty(inventory, namesOrIds);
                                const items = [
                                    { name: '턴 추가', icon: '/images/button/addturn.png', count: getItemCount(TOWER_ITEM_TURN_ADD_NAMES) },
                                    { name: '미사일', icon: '/images/button/missile.png', count: getItemCount(TOWER_ITEM_MISSILE_NAMES) },
                                    { name: '히든', icon: '/images/button/hidden.png', count: getItemCount(TOWER_ITEM_HIDDEN_NAMES) },
                                    { name: '스캔', icon: '/images/button/scan.png', count: getItemCount(TOWER_ITEM_SCAN_NAMES) },
                                    { name: '배치변경', icon: '/images/button/reflesh.png', count: getItemCount(TOWER_ITEM_REFRESH_NAMES) },
                                ];
                                return items.map((item, index) => (
                                    <button
                                        key={index}
                                        className="flex flex-col items-center gap-0.5 bg-gray-800/40 border border-amber-700/30 rounded-lg p-1.5 hover:bg-gray-700/50 hover:border-amber-600/50 transition-colors"
                                        onClick={() => setIsItemShopOpen(true)}
                                    >
                                        <div className="relative w-8 h-8 flex-shrink-0">
                                            <img src={item.icon} alt={item.name} className="w-full h-full object-contain" />
                                            <div className={`absolute -bottom-0.5 -right-0.5 text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border border-amber-900 ${item.count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'}`}>
                                                {item.count}
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-semibold text-amber-100 text-center leading-tight">{item.name}</p>
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                    </div>

                    {/* 가운데: 도전의 탑 이미지 */}
                    <div className={imageColClass}>
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-transparent to-yellow-600/10 rounded-xl"></div>
                    <img
                        src={TOWER_CHALLENGE_LOBBY_IMG}
                        alt="도전의 탑"
                        className="w-full h-full object-cover object-center relative z-10"
                    />
                </div>

                    {/* 우측: 스테이지 */}
                    <div className={stageColClass}>
                    <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 mb-3 flex-shrink-0 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)]">
                        스테이지
                    </h2>
                    <div
                        ref={stageScrollRef}
                        className="flex-1 overflow-y-auto space-y-1.5 pr-1"
                    >
                                                {renderTowerFloorRows()}
                    </div>
                </div>

                {/* 우측 끝: 퀵메뉴 (PC: 기존 밀도·세로 분배 유지 / 네이티브는 별도 상단 행) */}
                <div className={quickColClass}>
                    <div className="bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl p-1 backdrop-blur-md shadow-2xl shadow-amber-900/50">
                        <QuickAccessSidebar
                            fillHeight={!isNativeMobile}
                            compact={isNativeMobile}
                            dense={isNativeMobile}
                            mobile={isNativeMobile}
                        />
                    </div>
                </div>
            </>
        );
    }

    return (
        <div
            className={`relative flex w-full flex-col text-white ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain' : 'h-full min-h-0 overflow-hidden'}`}
            style={
                isNativeMobile
                    ? { background: '#0a0a0a' }
                    : {
                          background:
                              'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 20%, #2d2419 40%, #3d2e1f 60%, #4a3a2a 80%, #5c4a35 100%)',
                          backgroundSize: '400% 400%',
                          animation: 'gradientShift 20s ease infinite',
                      }
            }
        >
            {!isNativeMobile && (
                <style>{`
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
            )}
            {/* 헤더: (모바일은 뒤로가기 없음) 타이틀, 도움말 */}
            <header
                className={`flex flex-shrink-0 items-center justify-between border-b border-amber-600/40 bg-gradient-to-b from-black/60 via-amber-900/20 to-transparent shadow-[0_4px_20px_rgba(217,119,6,0.3)] backdrop-blur-sm ${isNativeMobile ? 'px-1 py-1.5' : 'px-2 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5'}`}
            >
                {isNativeMobile ? (
                    <div className="h-8 w-8 flex-shrink-0" aria-hidden />
                ) : (
                    <button
                        onClick={onBackToProfile}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/30 p-0 transition-transform hover:drop-shadow-lg hover:bg-amber-900/40 active:scale-90 sm:h-12 sm:w-12"
                        aria-label="뒤로가기"
                    >
                        <img src="/images/button/back.png" alt="Back" className="h-full w-full" />
                    </button>
                )}
                <h1
                    className={`truncate font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-200 drop-shadow-[0_0_12px_rgba(217,119,6,0.9)] ${isNativeMobile ? 'max-w-[55%] text-center text-base' : 'text-2xl sm:text-3xl lg:text-4xl'}`}
                >
                    도전의 탑
                </h1>
                <button
                    onClick={() => setIsHelpOpen(!isHelpOpen)}
                    className={`flex items-center justify-center transition-transform hover:scale-110 ${isNativeMobile ? 'h-7 w-7' : 'h-8 w-8 sm:h-10 sm:w-10'}`}
                    aria-label="도움말"
                    title="도움말"
                >
                    <img src="/images/button/help.webp" alt="도움말" className="h-full w-full" />
                </button>
            </header>

            {/* 도움말 모달 */}
            {isHelpOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-gray-900/95 via-amber-950/90 to-gray-800/95 border-2 border-amber-600/50 rounded-xl p-4 sm:p-6 max-w-md max-h-[80vh] overflow-y-auto shadow-2xl shadow-amber-900/50 backdrop-blur-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300">도전의 탑 도움말</h2>
                            <Button
                                onClick={() => setIsHelpOpen(false)}
                                colorScheme="none"
                                className="!p-1 !min-w-0 hover:bg-amber-900/50 rounded border border-amber-700/30"
                            >
                                <span className="text-xl text-amber-200">×</span>
                            </Button>
                        </div>
                        <div className="text-sm text-amber-100 space-y-2">
                            <p>도전의 탑은 100층으로 구성된 PvE 콘텐츠입니다.</p>
                            <p>각 층을 클리어하면 보상을 받을 수 있습니다.</p>
                            <p>랭킹은 클리어한 층 수와 시간으로 결정됩니다.</p>
                            <p className="text-amber-300 font-semibold mt-3">매월 1일 0시(KST)에 모든 층이 초기화됩니다.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 보상정보 모달 */}
            {isRewardModalOpen && (
                <DraggableWindow
                    title="도전의 탑 보상정보"
                    onClose={() => setIsRewardModalOpen(false)}
                    windowId="tower-reward-info"
                    initialWidth={900}
                    initialHeight={760}
                    isTopmost
                >
                    <div className="h-full overflow-y-auto pr-2 text-sm text-amber-100 space-y-5">
                        <div className="bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-700/40 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-yellow-300 mb-2">월간 보상</h3>
                            <p className="text-sm text-amber-200/85">
                                한 달 동안 클리어한 최고 층수에 따라 보상이 지급됩니다. 누적이 아닌 월간 최고 기록만 반영되며, 매월 1일 0시 KST에 정산됩니다.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {TOWER_MONTHLY_REWARD_TIERS.map((tier, idx) => (
                                <div
                                    key={tier.floor}
                                    className="grid grid-cols-[80px_1fr] gap-3 items-start rounded-lg border border-amber-700/30 bg-black/20 p-3"
                                >
                                    <span
                                        className={`${TOWER_MONTHLY_MODAL_TIER_LABEL_CLASS[idx] ?? 'text-amber-300'} font-bold text-base`}
                                    >
                                        {tier.floor}층
                                    </span>
                                    <div className="flex items-center gap-4 flex-wrap text-sm">
                                        <span className="inline-flex items-center gap-1">
                                            <img src="/images/icon/Gold.png" alt="골드" className="w-5 h-5" />
                                            {tier.gold.toLocaleString()}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <img src="/images/icon/Zem.png" alt="다이아몬드" className="w-5 h-5" />
                                            {tier.diamonds.toLocaleString()}
                                        </span>
                                        {tier.items.map((it) => (
                                            <span key={`${it.itemId}-${it.quantity}`} className="inline-flex items-center gap-1">
                                                <img
                                                    src={`/images/Box/EquipmentBox${it.itemId.replace('장비상자', '')}.png`}
                                                    alt={it.itemId}
                                                    className="w-5 h-5"
                                                />
                                                {it.itemId} ×{it.quantity}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-lg border border-amber-700/40 bg-amber-950/25 p-4 space-y-2 text-sm">
                            <h3 className="text-base font-bold text-yellow-300">안내</h3>
                            <p className="text-amber-200/85">10층 미만 클리어 시 월간 보상이 지급되지 않습니다.</p>
                            <p className="text-amber-200/85">보상은 매월 1일 0시(KST)에 메일로 지급되며, 30일 이내에 수령해주세요.</p>
                        </div>

                        <div className="border-t border-amber-700/40 pt-4">
                            <h3 className="text-base font-bold text-yellow-300 mb-2">층별 클리어 보상</h3>
                            <div className="space-y-1 text-sm text-amber-200/90">
                                <p>각 층을 클리어하면 골드와 전략 경험치를 획득할 수 있습니다.</p>
                                <p>높은 층일수록 더 많은 보상을 받을 수 있습니다.</p>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {isNativeMobile ? (
                <div className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 py-1">
                    {renderTowerMainColumns()}
                </div>
            ) : (
                <div className="flex-1 flex flex-row justify-center gap-2 sm:gap-3 lg:gap-4 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 min-h-0 overflow-hidden">
                    {renderTowerMainColumns()}
                </div>
            )}
            {/* 아이템 구매 모달 */}
            {isItemShopOpen && currentUserWithStatus && (
                <TowerItemShopModal
                    currentUser={currentUserWithStatus}
                    onClose={() => setIsItemShopOpen(false)}
                    onBuy={async (itemId, quantity) => {
                        await handlers.handleAction({
                            type: 'BUY_TOWER_ITEM',
                            payload: { itemId, quantity }
                        } as any);
                    }}
                />
            )}
        </div>
    );

};

export default TowerLobby;

