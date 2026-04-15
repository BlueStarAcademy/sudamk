import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useTowerRanking } from '../hooks/useTowerRanking.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL, CONSUMABLE_ITEMS } from '../constants';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { resolveTowerCaptureBlackTarget, resolveTowerPlainWhiteCount } from '../shared/utils/towerStageRules.js';
import { shouldUseClientSideAi } from '../services/wasmGnuGo.js';
import { TOWER_CHALLENGE_LOBBY_IMG, TOWER_MOBILE_HERO_WEBP } from '../assets.js';
import { getKSTDate, getKSTMonth, getKSTFullYear } from '../utils/timeUtils.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from './QuickAccessSidebar.js';
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

/** 전략/놀이 대기실 `WaitingRoom` 타이틀 스트립과 동일 계열 (앰버 톤) */
const towerTitleStripVisual =
    'rounded-xl border border-amber-500/35 bg-black/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-2';
const towerTitleStripRow = `${towerTitleStripVisual} flex w-full shrink-0 items-center gap-2 sm:gap-2.5`;
const towerTitleH1Class =
    'relative z-[1] min-w-0 flex-1 truncate text-left text-base font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-100 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(251,191,36,0.2)]';

const formatTowerRewardItemLabel = (itemId: string): string => {
    return resolveTowerRewardDisplayName(itemId);
};

const normalizeTowerRewardItemKey = (value: string): string => value.replace(/\s+/g, '');

const TOWER_REWARD_ITEM_NAME_BY_KEY: Record<string, string> = {
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

const resolveTowerRewardDisplayName = (itemId: string): string => {
    const normalized = normalizeTowerRewardItemKey(itemId);
    return TOWER_REWARD_ITEM_NAME_BY_KEY[normalized] ?? itemId;
};

const resolveTowerRewardImage = (itemId: string): string => {
    const normalized = normalizeTowerRewardItemKey(itemId);
    const equipmentMatch = normalized.match(/^장비상자(\d+)$/);
    if (equipmentMatch) {
        return `/images/Box/EquipmentBox${equipmentMatch[1]}.png`;
    }
    const displayName = resolveTowerRewardDisplayName(itemId);
    const itemTemplate = CONSUMABLE_ITEMS.find(
        (item) => normalizeTowerRewardItemKey(item.name) === normalizeTowerRewardItemKey(displayName)
    );
    return itemTemplate?.image || '/images/icon/item_box.png';
};

const TowerLobby: React.FC = () => {
        const { currentUser, currentUserWithStatus, handlers, towerRankingsRefetchTrigger } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [isItemShopOpen, setIsItemShopOpen] = useState(false);
    /** 네이티브 모바일: 도전의 탑 히어로 우측 슬라이드 패널 */
    const [mobileHeroDrawer, setMobileHeroDrawer] = useState<null | 'record' | 'ranking' | 'inventory'>(null);
    const [mobileRewardTooltipKey, setMobileRewardTooltipKey] = useState<string | null>(null);
    const [timeUntilReset, setTimeUntilReset] = useState<string>('');
    const stageScrollRef = useRef<HTMLDivElement>(null);
    const isChallengingRef = useRef(false); // 중복 클릭 방지용 ref

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

    const onBackToProfile = () => window.location.hash = '#/profile';

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    const { rankings: towerRankings, loading: towerRankingsLoading } = useTowerRanking(towerRankingsRefetchTrigger);

    // 랭킹 계산: 서버에서 받은 랭킹 데이터 사용
    const { myRankingEntry, top100Users, top100ScrollUsers } = useMemo(() => {
        if (towerRankings.length === 0) {
            return { myRankingEntry: null, top100Users: [], top100ScrollUsers: [] };
        }

        // 내 아이디 찾기
        const myEntry = towerRankings.find((entry: any) => entry.id === currentUser.id);

        // Top 100 (내 아이디도 100위 안이면 원래 순위에 그대로 표시)
        const top100 = towerRankings.slice(0, 100);

        const top100UsersMapped = top100.map((entry: any) => ({
            id: entry.id,
            nickname: entry.nickname,
            avatarId: entry.avatarId,
            borderId: entry.borderId,
            rank: entry.rank,
            displayFloor: entry.monthlyTowerFloor ?? entry.towerFloor ?? 0,
        }));

        const myFull =
            myEntry != null
                ? {
                      id: myEntry.id,
                      nickname: myEntry.nickname,
                      avatarId: myEntry.avatarId,
                      borderId: myEntry.borderId,
                      rank: myEntry.rank,
                      displayFloor: myEntry.monthlyTowerFloor ?? myEntry.towerFloor ?? 0,
                  }
                : null;

        // PC: 상단 고정 행에 본인을 두고 스크롤 목록에서는 중복 제거
        const top100ScrollUsers =
            myFull && myFull.rank <= 100
                ? top100UsersMapped.filter((u) => u.id !== currentUser.id)
                : top100UsersMapped;

        return {
            myRankingEntry: myFull,
            top100Users: top100UsersMapped,
            top100ScrollUsers,
        };
    }, [towerRankings, currentUser.id]);

    // 도전의 탑 진행 층수(현재 시즌/월 진행도)
    const towerProgressFloor = (currentUserWithStatus as any)?.towerFloor ?? 0;
    // 역대 최고 층수(백엔드에서 별도 필드가 오면 우선 사용, 없으면 기존 towerFloor로 폴백)
    const bestFloorAllTime =
        (currentUserWithStatus as any)?.allTimeTowerFloor
        ?? (currentUserWithStatus as any)?.towerBestFloor
        ?? (currentUserWithStatus as any)?.highestTowerFloor
        ?? towerProgressFloor;
    /** 월간 보상 구간 산정용 층수: 유저 상태·랭킹 API·진행 층 중 최대 (PC 등에서 monthlyTowerFloor만 비어 있는 경우 보강) */
    const effectiveMonthlyFloorForReward = useMemo(() => {
        const fromUser = Number((currentUserWithStatus as any)?.monthlyTowerFloor) || 0;
        const fromRanking = Number(myRankingEntry?.displayFloor) || 0;
        const fromTower = Number((currentUserWithStatus as any)?.towerFloor) || 0;
        return Math.max(fromUser, fromRanking, fromTower);
    }, [currentUserWithStatus, myRankingEntry]);

    const myRewardTier = useMemo(() => {
        if (effectiveMonthlyFloorForReward < 10) return null;
        return TOWER_MONTHLY_REWARD_TIERS.find(t => effectiveMonthlyFloorForReward >= t.floor) ?? null;
    }, [effectiveMonthlyFloorForReward]);

    // 스테이지(층) 데이터 (1층부터 100층까지, 역순으로 표시하여 아래에서 위로 스크롤)
    const stages = Array.from({ length: 100 }, (_, i) => i + 1).reverse();

    // 입장·진행 갱신 시: 현재 진행 기준 최고 층(towerProgressFloor)이 보이도록 스크롤
    useLayoutEffect(() => {
        const el = stageScrollRef.current;
        if (!el) return;
        if (towerProgressFloor <= 0) {
            el.scrollTop = el.scrollHeight;
            return;
        }
        const row = el.querySelector<HTMLElement>(`[data-tower-floor="${towerProgressFloor}"]`);
        row?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, [towerProgressFloor, isNativeMobile]);

    const rankingColClass = isNativeMobile
        ? 'flex max-h-[32dvh] min-h-0 w-full flex-none flex-col gap-1 overflow-hidden pb-0.5'
        : 'flex-[4_1_0%] min-w-0 flex flex-col gap-2 min-h-0 overflow-hidden';
    const imageColClass = isNativeMobile
        ? 'relative h-[14dvh] max-h-[120px] min-h-[72px] w-full flex-shrink-0 overflow-hidden rounded-lg border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 shadow-lg shadow-amber-900/40 backdrop-blur-md'
        : 'flex-[5_1_0%] min-w-0 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl shadow-amber-900/50 relative min-h-0';
    const stageColClass = isNativeMobile
        ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 p-1 shadow-lg shadow-amber-900/40 backdrop-blur-md sm:p-2'
        : 'flex-[7_1_0%] min-w-0 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 border-2 border-amber-600/40 rounded-xl p-2 sm:p-3 flex flex-col min-h-0 overflow-hidden backdrop-blur-md shadow-2xl shadow-amber-900/50';
    const quickColClass = isNativeMobile
        ? `flex h-[min(30dvh,280px)] min-h-[200px] flex-col overflow-hidden self-center ${PC_QUICK_RAIL_COLUMN_CLASS}`
        : `overflow-hidden ${PC_QUICK_RAIL_COLUMN_CLASS}`;

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

                            const p = stage.placements ?? { black: 0, white: 0, blackPattern: 0, whitePattern: 0 };
                            const towerDisplayBlackTarget = resolveTowerCaptureBlackTarget(floor, stage.targetScore?.black);
                            const towerDisplayWhitePlain = resolveTowerPlainWhiteCount(
                                floor,
                                p.black ?? 0,
                                p.blackPattern ?? 0,
                                p.whitePattern ?? 0,
                                p.white ?? 0
                            );
                            
                            // 목표 정보 (툴팁·표시용)
                            const getTargetInfo = () => {
                                if (stage.blackTurnLimit) {
                                    return `흑 ${towerDisplayBlackTarget}개 따내기 (${stage.blackTurnLimit}턴 제한)`;
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
                            const rewardInfoContent = isCleared ? (
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
                                                const itemImage = resolveTowerRewardImage(itemId);
                                                const itemDisplayName = resolveTowerRewardDisplayName(itemId);
                                                return (
                                                    <div key={idx} className="flex items-center gap-0.5">
                                                        <img src={itemImage} alt={itemDisplayName} title={itemDisplayName} className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </>
                            );
                            
                            const isCaptureMode = floor <= 20; // 1-20층: 따내기 바둑
                            
                            return (
                                <div
                                    key={floor}
                                    data-tower-floor={floor}
                                    className={`rounded-lg border flex items-center justify-between relative gap-2 p-2.5 sm:p-3 ${
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
                                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                        {/* 층수 */}
                                        <div
                                            className="flex flex-shrink-0 items-center gap-1.5 rounded border border-amber-600/40 bg-amber-900/50 px-2 py-1.5 sm:px-2.5"
                                        >
                                            <span
                                                className={`font-black text-lg sm:text-xl ${
                                                    isCurrent
                                                        ? 'text-yellow-300'
                                                        : isCleared
                                                          ? 'text-amber-200'
                                                          : 'text-amber-400'
                                                }`}
                                            >
                                                {floor}
                                            </span>
                                            <span className="text-xs font-semibold text-amber-300 sm:text-sm">층</span>
                                            {isCleared && (
                                                <span className="text-sm font-bold text-green-400 sm:text-base">✓</span>
                                            )}
                                        </div>

                                        {/* 바둑판·배치 / 목표·제한 → 두 줄로 가로 배치 */}
                                        <div
                                            className="flex min-w-0 flex-1 flex-col gap-y-1.5 text-[11px] sm:text-xs"
                                        >
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
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/Black.png" alt="흑" className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                                                                    <span className="text-amber-200 font-bold tabular-nums">{stage.placements.black}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/White.png" alt="백" className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                                                                    <span className="text-amber-200 font-bold tabular-nums">{towerDisplayWhitePlain}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 gap-y-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-amber-400/90 font-semibold whitespace-nowrap">목표</span>
                                                            <span className="text-yellow-300 font-bold">흑 {towerDisplayBlackTarget}개</span>
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
                                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-x-3">
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/Black.png" alt="흑" className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="text-amber-200 font-bold tabular-nums">{stage.placements.black}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/White.png" alt="백" className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="text-amber-200 font-bold tabular-nums">{towerDisplayWhitePlain}</span>
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
                                        <div className={`flex flex-col gap-1 flex-shrink-0 ml-auto ${isNativeMobile ? 'hidden' : ''}`}>
                                            {rewardInfoContent}
                                        </div>
                                    </div>
                                    
                                    {/* 오른쪽: 모바일은 보상/버튼 세로 배치, PC는 버튼 단독 */}
                                    {isNativeMobile ? (
                                        <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-1.5">
                                            <div className="flex flex-col items-end gap-0.5 text-right">
                                                {rewardInfoContent}
                                            </div>
                                            <button
                                                onClick={async (e) => {
                                                    if (isChallengingRef.current || !canChallenge || isLocked) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    isChallengingRef.current = true;
                                                    try {
                                                        const res = await handlers.handleAction({
                                                            type: 'START_TOWER_GAME',
                                                            payload: { floor, useClientSideAi: shouldUseClientSideAi() }
                                                        });
                                                        const gameId = (res as any)?.gameId || (res as any)?.clientResponse?.gameId;
                                                        console.log('[TowerLobby] START_TOWER_GAME response:', { res, gameId });
                                                    } catch (error) {
                                                        console.error('[TowerLobby] Failed to start tower game:', error);
                                                        isChallengingRef.current = false;
                                                    }
                                                }}
                                                disabled={!canChallenge || isLocked || isChallengingRef.current}
                                                className={`flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                                    canChallenge && !isLocked
                                                        ? 'bg-gradient-to-br from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-lg shadow-amber-600/50'
                                                        : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                                                }`}
                                            >
                                                <span className="text-[10px] leading-none">⚡{effectiveActionPointCost}</span>
                                                <span className="text-[10px] leading-none">도전</span>
                                            </button>
                                        </div>
                                    ) : (
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
                                        className={`flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                                            canChallenge && !isLocked
                                                ? 'bg-gradient-to-br from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-lg shadow-amber-600/50'
                                                : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className="text-[10px] leading-none sm:text-xs">⚡{effectiveActionPointCost}</span>
                                        <span className="text-[10px] leading-none sm:text-xs">도전</span>
                                    </button>
                                    )}
                                </div>
                            );
                        });


    function renderTowerMainColumns() {
        if (isNativeMobile) {
            const inventory = currentUserWithStatus?.inventory || [];
            const getItemCount = (namesOrIds: readonly string[]): number =>
                countTowerLobbyInventoryQty(inventory, namesOrIds);
            const mobileTowerItems = [
                { name: '턴 추가', icon: '/images/button/addturn.png', count: getItemCount(TOWER_ITEM_TURN_ADD_NAMES) },
                { name: '미사일', icon: '/images/button/missile.png', count: getItemCount(TOWER_ITEM_MISSILE_NAMES) },
                { name: '히든', icon: '/images/button/hidden.png', count: getItemCount(TOWER_ITEM_HIDDEN_NAMES) },
                { name: '스캔', icon: '/images/button/scan.png', count: getItemCount(TOWER_ITEM_SCAN_NAMES) },
                { name: '배치변경', icon: '/images/button/reflesh.png', count: getItemCount(TOWER_ITEM_REFRESH_NAMES) },
            ] as const;

            const mobileHeroDrawerOpen = mobileHeroDrawer !== null;
            const setMobileDrawer = (next: 'record' | 'ranking' | 'inventory') => {
                setMobileRewardTooltipKey(null);
                setMobileHeroDrawer((prev) => (prev === next ? null : next));
            };

            const mobileRankingList = (
                <>
                    {!myRankingEntry && effectiveMonthlyFloorForReward < 10 && (
                        <p className="px-0.5 py-2 text-center text-xs text-amber-300/80">
                            10층 이상 클리어 시 랭킹에 표시됩니다.
                        </p>
                    )}
                    {towerRankingsLoading && towerRankings.length === 0 ? (
                        <p className="py-6 text-center text-sm text-amber-300/60">랭킹 불러오는 중...</p>
                    ) : top100Users.length > 0 ? (
                        top100Users.map((user) => {
                            const avatarUrl = AVATAR_POOL.find((a) => a.id === user.avatarId)?.url;
                            const borderUrl = BORDER_POOL.find((b) => b.id === user.borderId)?.url;
                            const isTop3 = (user as any).rank <= 3;
                            const rank = (user as any).rank;
                            const isCurrentUser = !!currentUser && user.id === currentUser.id;
                            return (
                                <div
                                    key={user.id}
                                    className={`flex items-center gap-2 rounded-lg p-2 transition-all ${
                                        isCurrentUser
                                            ? 'border-2 border-yellow-400/55 bg-gradient-to-r from-yellow-900/50 via-amber-800/40 to-orange-900/40 shadow-sm shadow-yellow-900/25'
                                            : isTop3
                                              ? 'border border-amber-500/45 bg-gradient-to-r from-amber-900/35 to-yellow-900/35'
                                              : 'border border-amber-700/25 bg-gray-900/45 hover:border-amber-600/40'
                                    }`}
                                >
                                    <span
                                        className={`w-6 shrink-0 text-xs font-bold sm:text-sm ${
                                            rank === 1
                                                ? 'text-yellow-300'
                                                : rank === 2
                                                  ? 'text-gray-300'
                                                  : rank === 3
                                                    ? 'text-amber-500'
                                                    : 'text-amber-300'
                                        }`}
                                    >
                                        {rank}
                                    </span>
                                    <Avatar
                                        userId={user.id}
                                        userName={user.nickname}
                                        avatarUrl={avatarUrl}
                                        borderUrl={borderUrl}
                                        size={32}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`truncate text-xs font-semibold sm:text-sm ${isCurrentUser ? 'text-yellow-100' : 'text-amber-100'}`}
                                        >
                                            {user.nickname}
                                        </p>
                                        <p className="text-[10px] text-amber-300/85 sm:text-xs">층: {(user as any).displayFloor ?? 0}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="py-6 text-center text-sm text-amber-300/60">랭킹 데이터가 없습니다.</p>
                    )}
                </>
            );

            return (
                <>
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        {/* 상단: 풀폭 히어로 + 좌상단 오버레이 버튼 + 우측 슬라이드 패널 */}
                        <section className="relative w-full shrink-0 overflow-hidden rounded-xl border-2 border-amber-600/40 bg-gray-900 shadow-lg shadow-amber-900/40 min-h-[200px] h-[min(38dvh,300px)] max-h-[320px]">
                            <img
                                src={TOWER_MOBILE_HERO_WEBP}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover object-[center_40%]"
                                onError={(e) => {
                                    const el = e.currentTarget;
                                    if (el.src.includes('Tower1.webp')) el.src = TOWER_CHALLENGE_LOBBY_IMG;
                                }}
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/70" />
                            <div className="pointer-events-none absolute inset-0 bg-amber-950/15" />

                            <div className="absolute left-2 top-2 z-20 flex flex-col gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setMobileDrawer('record')}
                                    className="inline-flex min-w-[6.75rem] items-center justify-center rounded-xl border border-amber-400/70 bg-gradient-to-br from-amber-700/80 via-amber-800/75 to-yellow-700/70 px-3 py-1.5 text-center text-xs font-extrabold tracking-wide text-amber-50 shadow-[0_8px_22px_rgba(217,119,6,0.45)] ring-1 ring-amber-200/20 backdrop-blur-sm transition-all hover:from-amber-600/85 hover:to-yellow-600/80 active:scale-[0.98]"
                                >
                                    내 기록
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileDrawer('ranking')}
                                    className="inline-flex min-w-[6.75rem] items-center justify-center rounded-xl border border-amber-400/70 bg-gradient-to-br from-amber-700/80 via-amber-800/75 to-yellow-700/70 px-3 py-1.5 text-center text-xs font-extrabold tracking-wide text-amber-50 shadow-[0_8px_22px_rgba(217,119,6,0.45)] ring-1 ring-amber-200/20 backdrop-blur-sm transition-all hover:from-amber-600/85 hover:to-yellow-600/80 active:scale-[0.98]"
                                >
                                    랭킹 정보
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileDrawer('inventory')}
                                    className="inline-flex min-w-[6.75rem] items-center justify-center rounded-xl border border-amber-400/70 bg-gradient-to-br from-amber-700/80 via-amber-800/75 to-yellow-700/70 px-3 py-1.5 text-center text-xs font-extrabold tracking-wide text-amber-50 shadow-[0_8px_22px_rgba(217,119,6,0.45)] ring-1 ring-amber-200/20 backdrop-blur-sm transition-all hover:from-amber-600/85 hover:to-yellow-600/80 active:scale-[0.98]"
                                >
                                    보유 아이템
                                </button>
                            </div>
                            <div className="absolute right-2 top-2 z-20">
                                <Button
                                    onClick={() => setIsRewardModalOpen(true)}
                                    colorScheme="none"
                                    className="!min-w-0 rounded-lg !px-2.5 !py-1.5 !text-[11px] border border-amber-500/60 bg-black/60 font-semibold text-amber-100 shadow-md backdrop-blur-sm hover:bg-amber-900/45"
                                >
                                    보상정보
                                </Button>
                            </div>

                            {mobileHeroDrawerOpen && (
                                <button
                                    type="button"
                                    aria-label="패널 닫기"
                                    className="absolute inset-0 z-[25] bg-black/50"
                                    onClick={() => {
                                        setMobileRewardTooltipKey(null);
                                        setMobileHeroDrawer(null);
                                    }}
                                />
                            )}

                            <div
                                className={`absolute inset-y-0 right-0 z-30 flex w-[min(100%,22rem)] max-w-[min(94vw,22rem)] flex-col border-l border-amber-500/50 bg-gray-950/96 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out ${
                                    mobileHeroDrawerOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
                                }`}
                            >
                                <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-amber-600/35 px-3 py-1.5">
                                    <h3 className="min-w-0 truncate text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-200">
                                        {mobileHeroDrawer === 'record' && ''}
                                        {mobileHeroDrawer === 'ranking' && `Top 100 · ${timeUntilReset}`}
                                        {mobileHeroDrawer === 'inventory' && '보유 아이템'}
                                    </h3>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                            type="button"
                                            aria-label="닫기"
                                            onClick={() => {
                                                setMobileRewardTooltipKey(null);
                                                setMobileHeroDrawer(null);
                                            }}
                                            className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-lg border border-amber-600/45 bg-gray-900/80 px-2 text-xs font-semibold leading-none text-amber-100 hover:bg-amber-900/40"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                                    {mobileHeroDrawer === 'record' && (
                                        <div className="space-y-3">
                                            <div className="grid min-w-0 grid-cols-2 gap-2">
                                                <div className="min-w-0 rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/45 via-gray-900/85 to-black/70 p-2.5 shadow-[0_10px_24px_rgba(217,119,6,0.2)] ring-1 ring-amber-200/10 backdrop-blur-md">
                                                    <div className="mb-2 flex items-center justify-start">
                                                        <span className="text-xs font-semibold tracking-wide text-amber-200/90">내 기록</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="rounded-lg border border-amber-500/30 bg-black/35 px-2 py-1.5 text-center">
                                                            <p className="text-[10px] font-semibold tracking-wide text-amber-200/80">역대 최고 층수</p>
                                                            <p className="mt-0.5 text-lg font-black tabular-nums text-yellow-100">{bestFloorAllTime}층</p>
                                                        </div>
                                                        <div className="rounded-lg border border-amber-500/30 bg-black/35 px-2 py-1.5 text-center">
                                                            <p className="text-[10px] font-semibold tracking-wide text-amber-200/80">현재 층수</p>
                                                            <p className="mt-0.5 text-lg font-black tabular-nums text-amber-50">{effectiveMonthlyFloorForReward}층</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="min-w-0 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/35 via-gray-900/85 to-amber-950/40 p-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.2)] ring-1 ring-emerald-200/10 backdrop-blur-md">
                                                    <div className="mb-2 flex items-center justify-start gap-1">
                                                        <span className="text-xs font-semibold tracking-wide text-emerald-200/90">예상 보상</span>
                                                    </div>
                                                    {myRewardTier ? (
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-1 gap-1.5">
                                                                <div className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-amber-500/25 bg-black/35 px-1.5 py-1.5 text-xs text-yellow-100">
                                                                    <img src="/images/icon/Gold.png" alt="" className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="truncate tabular-nums font-semibold">{myRewardTier.gold.toLocaleString()}</span>
                                                                </div>
                                                                <div className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-cyan-500/30 bg-black/35 px-1.5 py-1.5 text-xs text-cyan-100">
                                                                    <img src="/images/icon/Zem.png" alt="" className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="truncate tabular-nums font-semibold">{myRewardTier.diamonds}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap items-start justify-center gap-1.5">
                                                                {myRewardTier.items.map((it: { itemId: string; quantity: number }, i: number) => (
                                                                    <span
                                                                        key={i}
                                                                        className="relative inline-flex flex-col items-center justify-start gap-0.5 text-amber-100"
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const key = `${it.itemId}-${i}`;
                                                                                setMobileRewardTooltipKey((prev) => (prev === key ? null : key));
                                                                            }}
                                                                            className="relative inline-flex items-center justify-center"
                                                                            aria-label={`${resolveTowerRewardDisplayName(it.itemId)} 보기`}
                                                                        >
                                                                            <img
                                                                                src={resolveTowerRewardImage(it.itemId)}
                                                                                alt={resolveTowerRewardDisplayName(it.itemId)}
                                                                                className="h-9 w-9 shrink-0 object-contain"
                                                                            />
                                                                            {mobileRewardTooltipKey === `${it.itemId}-${i}` && (
                                                                                <span className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-500/45 bg-gray-950/95 px-2 py-1 text-[10px] font-semibold text-amber-100 shadow-lg">
                                                                                    {resolveTowerRewardDisplayName(it.itemId)}
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                        <span className="text-[10px] font-semibold leading-none tabular-nums">x{it.quantity}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-amber-700/35 bg-black/30 px-2 py-2 text-center text-[11px] text-amber-200/90">
                                                            현재 층수 10층 이상부터 보상 지급
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {mobileHeroDrawer === 'ranking' && (
                                        <div className="space-y-2">
                                            {mobileRankingList}
                                        </div>
                                    )}
                                    {mobileHeroDrawer === 'inventory' && (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {mobileTowerItems.map((item, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-700/35 bg-gray-800/50 px-1 py-1.5 transition-colors hover:border-amber-600/55 hover:bg-gray-700/50"
                                                        onClick={() => setIsItemShopOpen(true)}
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0">
                                                            <img src={item.icon} alt={item.name} className="h-full w-full object-contain" />
                                                            <div
                                                                className={`absolute -bottom-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-amber-900 px-1 text-[9px] font-bold leading-none ${
                                                                    item.count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'
                                                                }`}
                                                            >
                                                                {item.count}
                                                            </div>
                                                        </div>
                                                        <p className="max-w-full truncate text-center text-[11px] font-semibold leading-tight text-amber-100">{item.name}</p>
                                                    </button>
                                                ))}
                                            </div>
                                            <Button
                                                onClick={() => setIsItemShopOpen(true)}
                                                colorScheme="none"
                                                className="w-full !py-1.5 !text-xs font-semibold border border-amber-600/50 bg-amber-900/45 hover:bg-amber-800/60 text-amber-100"
                                            >
                                                구매하기
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* 하단: 스테이지 목록 풀폭 */}
                        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 p-2 sm:p-3 shadow-lg shadow-amber-900/40 backdrop-blur-md">
                            <h2 className="mb-3 flex-shrink-0 text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)] sm:text-lg">
                                스테이지
                            </h2>
                            <div
                                ref={stageScrollRef}
                                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5"
                            >
                                <div className="space-y-2 pb-1">{renderTowerFloorRows()}</div>
                            </div>
                        </section>
                    </div>
                </>
            );
        }

        return (
            <>
                    {/* 좌측: 랭킹 Top 100 + 보유 아이템 (아래쪽 별도 패널). PC 타이틀·뒤로가기는 랭킹 패널 위에만 둬서 우측 열(이미지·스테이지·퀵메뉴)이 상단까지 올라오게 함 */}
                    <div className={rankingColClass}>
                    {!isNativeMobile && (
                        <div className={`shrink-0 ${towerTitleStripRow}`}>
                            <button
                                type="button"
                                onClick={onBackToProfile}
                                className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                                aria-label="뒤로가기"
                            >
                                <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                            </button>
                            <h1 className={towerTitleH1Class}>도전의 탑</h1>
                        </div>
                    )}
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
                    {/* PC: 내 기록(좌) + 예상 보상(우) 가로 2열 · 순위는 아래 표 상단 고정 행으로만 표시 */}
                    <div className="mb-2 flex-shrink-0">
                        <div className="overflow-hidden rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/80 via-gray-900/90 to-amber-950/80 shadow-xl shadow-amber-900/40">
                            <div className="border-b border-amber-600/50 bg-amber-900/30 px-3 py-2">
                                <h3 className="bg-gradient-to-r from-yellow-200 to-amber-200 bg-clip-text text-sm font-bold text-transparent">
                                    내 기록
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 divide-y divide-amber-700/35 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                <div className="space-y-2.5 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-amber-300/90">역대 최고 층수</span>
                                        <span className="font-bold text-yellow-200 tabular-nums">{bestFloorAllTime}층</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-amber-300/90">이번 달 최고 층</span>
                                        <span className="font-bold text-amber-100 tabular-nums">{effectiveMonthlyFloorForReward}층</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 p-3">
                                    <p className="text-[11px] font-semibold tracking-wide text-emerald-200/90">예상 보상</p>
                                    {myRewardTier ? (
                                        <div className="flex flex-col gap-1.5 text-xs">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="inline-flex items-center gap-1 text-yellow-200">
                                                    <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 shrink-0" />
                                                    {myRewardTier.gold.toLocaleString()}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-cyan-200">
                                                    <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 shrink-0" />
                                                    {myRewardTier.diamonds}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {myRewardTier.items.map((it: { itemId: string; quantity: number }, i: number) => (
                                                    <span key={i} className="inline-flex items-center gap-1 text-amber-200">
                                                        <img
                                                            src={resolveTowerRewardImage(it.itemId)}
                                                            alt={resolveTowerRewardDisplayName(it.itemId)}
                                                            className="h-4 w-4 shrink-0"
                                                        />
                                                        ×{it.quantity}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-[10px] leading-snug text-amber-400/85">
                                                {myRewardTier.floor}층 구간 보상 · 월말 정산 시 지급
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-amber-400/80">10층 이상 클리어 시 월간 보상을 받을 수 있습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {(() => {
                            const pinned =
                                myRankingEntry ??
                                (effectiveMonthlyFloorForReward >= 10
                                    ? {
                                          id: currentUser!.id,
                                          nickname: currentUser!.nickname,
                                          avatarId: currentUser!.avatarId,
                                          borderId: currentUser!.borderId,
                                          rank: null as number | null,
                                          displayFloor: effectiveMonthlyFloorForReward,
                                      }
                                    : null);
                            if (!pinned) return null;
                            const avatarUrl = AVATAR_POOL.find((a) => a.id === pinned.avatarId)?.url;
                            const borderUrl = BORDER_POOL.find((b) => b.id === pinned.borderId)?.url;
                            const pr = pinned.rank;
                            return (
                                <div className="mb-1.5 flex shrink-0 flex-col gap-0.5">
                                    <div
                                        className={`flex items-center gap-2 rounded-lg p-2 transition-all ${
                                            'bg-gradient-to-r from-yellow-900/45 via-amber-800/45 to-orange-900/45 border-2 border-yellow-400/60 shadow-md shadow-yellow-900/30'
                                        }`}
                                    >
                                        <span
                                            className={`flex w-11 shrink-0 justify-center text-center text-[11px] font-bold leading-tight sm:w-12 sm:text-xs ${
                                                pr === 1
                                                    ? 'text-yellow-300'
                                                    : pr === 2
                                                      ? 'text-gray-300'
                                                      : pr === 3
                                                        ? 'text-amber-500'
                                                        : pr !== null
                                                          ? 'text-amber-300'
                                                          : 'text-amber-200/90'
                                            }`}
                                        >
                                            {pr !== null ? pr : '순위 외'}
                                        </span>
                                        <Avatar
                                            userId={pinned.id}
                                            userName={pinned.nickname}
                                            avatarUrl={avatarUrl}
                                            borderUrl={borderUrl}
                                            size={32}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-semibold text-yellow-100 sm:text-sm">{pinned.nickname}</p>
                                            <p className="text-[10px] text-amber-300/80 sm:text-xs">층: {pinned.displayFloor ?? 0}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                            {!myRankingEntry && effectiveMonthlyFloorForReward < 10 && (
                                <p className="px-1 py-2 text-center text-xs text-amber-300/70">10층 이상 클리어 시 랭킹에 표시됩니다.</p>
                            )}
                            {towerRankingsLoading && towerRankings.length === 0 ? (
                                <p className="py-8 text-center text-amber-300/60">랭킹 불러오는 중...</p>
                            ) : top100Users.length > 0 ? (
                                <>
                                    {top100ScrollUsers.map((user) => {
                                        const avatarUrl = AVATAR_POOL.find((a) => a.id === user.avatarId)?.url;
                                        const borderUrl = BORDER_POOL.find((b) => b.id === user.borderId)?.url;
                                        const isTop3 = (user as any).rank <= 3;
                                        const rank = (user as any).rank;
                                        return (
                                            <div
                                                key={user.id}
                                                className={`flex items-center gap-2 rounded-lg p-2 transition-all ${
                                                    isTop3
                                                        ? 'border border-amber-500/50 bg-gradient-to-r from-amber-900/40 to-yellow-900/40 hover:from-amber-800/50 hover:to-yellow-800/50'
                                                        : 'border border-amber-700/30 bg-gray-800/40 hover:bg-gray-700/50 hover:border-amber-600/50'
                                                }`}
                                            >
                                                <span
                                                    className={`w-6 flex-shrink-0 text-xs font-bold sm:text-sm ${
                                                        rank === 1
                                                            ? 'text-yellow-300'
                                                            : rank === 2
                                                              ? 'text-gray-300'
                                                              : rank === 3
                                                                ? 'text-amber-500'
                                                                : 'text-amber-300'
                                                    }`}
                                                >
                                                    {rank}
                                                </span>
                                                <Avatar
                                                    userId={user.id}
                                                    userName={user.nickname}
                                                    avatarUrl={avatarUrl}
                                                    borderUrl={borderUrl}
                                                    size={32}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-semibold text-amber-100 sm:text-sm">{user.nickname}</p>
                                                    <p className="text-[10px] text-amber-300/80 sm:text-xs">층: {(user as any).displayFloor ?? 0}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {top100ScrollUsers.length === 0 && (
                                        <p className="py-3 text-center text-[11px] text-amber-400/75">Top 100에 표시된 다른 순위가 없습니다.</p>
                                    )}
                                </>
                            ) : (
                                <p className="py-8 text-center text-amber-300/60">랭킹 데이터가 없습니다.</p>
                            )}
                        </div>
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
                        <div className="flex flex-row gap-2 justify-center items-center flex-wrap">
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
                                        className="flex flex-col items-center gap-0.5 bg-gray-800/40 border border-amber-700/30 rounded-lg p-2 hover:bg-gray-700/50 hover:border-amber-600/50 transition-colors"
                                        onClick={() => setIsItemShopOpen(true)}
                                    >
                                        <div className="relative w-9 h-9 flex-shrink-0">
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
            className={`relative flex w-full flex-col bg-lobby-shell-tower text-white ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain' : 'h-full min-h-0 overflow-hidden'}`}
        >
            {/* 네이티브 모바일만 전역 헤더. PC는 랭킹 패널 상단 스트립으로만 표시해 우측 열이 화면 상단까지 올라오게 함 */}
            {isNativeMobile && (
                <header className="flex flex-shrink-0 px-1.5 py-2">
                    <div className={`w-full ${towerTitleStripVisual}`}>
                        <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
                            <button
                                type="button"
                                onClick={onBackToProfile}
                                className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center transition-transform active:scale-90 hover:drop-shadow-lg"
                                aria-label="뒤로가기"
                            >
                                <img src="/images/button/back.png" alt="" className="h-full w-full" />
                            </button>
                            <h1 className="truncate text-center text-sm font-bold bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-100 bg-clip-text text-transparent">
                                도전의 탑
                            </h1>
                            <div className="w-9 shrink-0" aria-hidden />
                        </div>
                    </div>
                </header>
            )}

            {/* 보상정보 모달 */}
            {isRewardModalOpen && (
                <DraggableWindow
                    title="도전의 탑 보상정보"
                    onClose={() => setIsRewardModalOpen(false)}
                    windowId="tower-reward-info"
                    initialWidth={isNativeMobile ? 680 : 640}
                    initialHeight={isNativeMobile ? 620 : 760}
                    isTopmost
                >
                    <div className="h-full space-y-3 overflow-y-auto pr-1 text-sm text-amber-100">
                        <div className="rounded-lg border border-amber-700/40 bg-gradient-to-r from-amber-900/25 to-yellow-900/15 px-3 py-2.5 text-center">
                            <p className="text-xs font-semibold text-amber-200/90 sm:text-sm">보상 정산까지 남은 시간</p>
                            <p className="mt-0.5 text-sm font-bold text-yellow-300 sm:text-base">{timeUntilReset}</p>
                        </div>

                        <div className="space-y-2 pb-1">
                            {TOWER_MONTHLY_REWARD_TIERS.map((tier, idx) => {
                                const isMyCurrentTier = myRewardTier !== null && tier.floor === myRewardTier.floor;
                                return (
                                    <div
                                        key={tier.floor}
                                        className={`relative grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2.5 py-2 sm:grid-cols-[68px_minmax(0,1fr)] sm:px-3 sm:py-2.5 ${
                                            isMyCurrentTier
                                                ? 'border-[3px] border-amber-400/95 bg-gradient-to-r from-amber-950/55 to-yellow-950/35 shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_12px_28px_-8px_rgba(251,191,36,0.45)] ring-2 ring-amber-300/50'
                                                : 'border border-amber-700/30 bg-black/20'
                                        }`}
                                    >
                                        {isMyCurrentTier && (
                                            <div className="absolute -top-2 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-amber-300/80 bg-gradient-to-b from-amber-600 to-amber-800 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-50 shadow-md sm:text-[11px]">
                                                내 현재 보상
                                            </div>
                                        )}
                                        <span
                                            className={`${TOWER_MONTHLY_MODAL_TIER_LABEL_CLASS[idx] ?? 'text-amber-300'} font-bold text-sm sm:text-lg ${isMyCurrentTier ? 'pt-2 sm:pt-2.5' : ''}`}
                                        >
                                            {tier.floor}층
                                        </span>
                                        <div
                                            className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:gap-3 sm:text-base ${isMyCurrentTier ? 'pt-2 sm:pt-2.5' : ''}`}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 sm:h-6 sm:w-6" />
                                                {tier.gold.toLocaleString()}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <img src="/images/icon/Zem.png" alt="다이아몬드" className="h-4 w-4 sm:h-6 sm:w-6" />
                                                {tier.diamonds.toLocaleString()}
                                            </span>
                                            {tier.items.map((it) => (
                                                <span key={`${it.itemId}-${it.quantity}`} className="inline-flex items-center gap-1">
                                                    <img
                                                        src={resolveTowerRewardImage(it.itemId)}
                                                        alt={resolveTowerRewardDisplayName(it.itemId)}
                                                        className="h-4 w-4 sm:h-6 sm:w-6"
                                                    />
                                                    {formatTowerRewardItemLabel(it.itemId)} x{it.quantity}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {isNativeMobile ? (
                <div className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 py-1">
                    {renderTowerMainColumns()}
                </div>
            ) : (
                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-row gap-2 overflow-hidden px-2 py-2 sm:gap-3 sm:px-3 sm:py-3 lg:gap-4 lg:px-4 lg:py-4">
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

