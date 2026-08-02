import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../shared/i18n/config.js';

const towerTx = (key: string, opts?: Record<string, unknown>) => i18n.t(`tower:${key}`, opts);
import { useAppContext } from '../hooks/useAppContext.js';
import { useTowerRanking } from '../hooks/useTowerRanking.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL, CONSUMABLE_ITEMS } from '../constants';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import StageClearRewardPreview from './rewards/StageClearRewardPreview.js';
import {
    resolveTowerCaptureBlackTarget,
    resolveTowerPlainBlackCount,
    resolveTowerPlainWhiteCount,
} from '../shared/utils/towerStageRules.js';
import { TOWER_CHALLENGE_LOBBY_IMG, TOWER_MOBILE_HERO_WEBP, TOWER_STAGE_SCROLL_BG_WEBP } from '../assets.js';
import { getKSTDate, getKSTMonth, getKSTFullYear } from '../utils/timeUtils.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import PcLobbyCenterColumn from './shell/PcLobbyCenterColumn.js';
import {
    PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS,
    PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS,
    PC_QUICK_RAIL_COLUMN_CLASS,
    PC_QUICK_RAIL_WRAPPER_CLASS,
} from '../shared/constants/pcShellLayout.js';

/** 도전의 탑 PC 좌열 — 홈 기본(43%/500)보다 좁혀 스테이지 열 확보 */
const PC_TOWER_LEFT_COLUMN_CLASS =
    'w-[min(32%,340px)] min-w-[260px] max-w-[340px] shrink-0';
/** PC 스테이지 행 고정 높이 — 층 정보량 차이와 무관하게 통일 */
const PC_TOWER_STAGE_ROW_HEIGHT_CLASS = 'h-[5rem] min-h-[5rem] max-h-[5rem]';
import PurchaseQuantityModal from './PurchaseQuantityModal.js';
import { buildTowerShopPurchasableItem } from '../shared/constants/towerShopItems.js';
import DraggableWindow from './DraggableWindow.js';
import {
    countTowerLobbyInventoryQty,
    TOWER_ITEM_TURN_ADD_NAMES,
    TOWER_ITEM_MISSILE_NAMES,
    TOWER_ITEM_HIDDEN_NAMES,
    TOWER_ITEM_SCAN_NAMES,
    TOWER_ITEM_REFRESH_NAMES,
} from '../utils/towerLobbyInventory.js';
import { formatGoldAmountKoG } from '../shared/utils/walletAmountDisplay.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useScreenGuide } from '../hooks/useScreenGuide.js';
import ScreenGuideModal from './ScreenGuideModal.js';

// 월간 보상 구간 (매월 1일 0시 KST 지급, 역대 최고 층수 아님 월간 최고 층수 기준)
// 서버 `processTowerRankingRewards`의 구간·수치와 반드시 동기화할 것
const TOWER_MONTHLY_REWARD_TIERS = [
    {
        floor: 100,
        gold: 150_000,
        diamonds: 150,
        items: [
            { itemId: '\uC7A5\uBE44\uC0C1\uC7906', quantity: 1 },
            { itemId: '\uC7A5\uBE44\uC0C1\uC7905', quantity: 1 }
        ]
    },
    { floor: 90, gold: 125_000, diamonds: 100, items: [{ itemId: '\uC7A5\uBE44\uC0C1\uC7905', quantity: 2 }] },
    {
        floor: 80,
        gold: 100_000,
        diamonds: 75,
        items: [
            { itemId: '\uC7A5\uBE44\uC0C1\uC7905', quantity: 1 },
            { itemId: '\uC7A5\uBE44\uC0C1\uC7904', quantity: 1 }
        ]
    },
    { floor: 65, gold: 75_000, diamonds: 50, items: [{ itemId: '\uC7A5\uBE44\uC0C1\uC7904', quantity: 2 }] },
    { floor: 50, gold: 50_000, diamonds: 35, items: [{ itemId: '\uC7A5\uBE44\uC0C1\uC7904', quantity: 1 }] },
    { floor: 35, gold: 30_000, diamonds: 25, items: [{ itemId: '\uC7A5\uBE44\uC0C1\uC7903', quantity: 1 }] },
    { floor: 20, gold: 20_000, diamonds: 15, items: [{ itemId: '\uC7A5\uBE44\uC0C1\uC7902', quantity: 1 }] },
    { floor: 10, gold: 10_000, diamonds: 10, items: [{ itemId: '\uC7A5\uBE44\uC0C1\uC7901', quantity: 1 }] },
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
    '\uC7A5\uBE44\uC0C1\uC7901': 'rewardItems.equipmentBox1',
    '\uC7A5\uBE44\uC0C1\uC7902': 'rewardItems.equipmentBox2',
    '\uC7A5\uBE44\uC0C1\uC7903': 'rewardItems.equipmentBox3',
    '\uC7A5\uBE44\uC0C1\uC7904': 'rewardItems.equipmentBox4',
    '\uC7A5\uBE44\uC0C1\uC7905': 'rewardItems.equipmentBox5',
    '\uC7A5\uBE44\uC0C1\uC7906': 'rewardItems.equipmentBox6',
    '\uC7AC\uB8CC\uC0C1\uC7901': 'rewardItems.materialBox1',
    '\uC7AC\uB8CC\uC0C1\uC7902': 'rewardItems.materialBox2',
    '\uC7AC\uB8CC\uC0C1\uC7903': 'rewardItems.materialBox3',
    '\uC7AC\uB8CC\uC0C1\uC7904': 'rewardItems.materialBox4',
    '\uC7AC\uB8CC\uC0C1\uC7905': 'rewardItems.materialBox5',
    '\uC7AC\uB8CC\uC0C1\uC7906': 'rewardItems.materialBox6',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF8I': 'rewardItems.goldBundle1',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF8II': 'rewardItems.goldBundle2',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF8III': 'rewardItems.goldBundle3',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF8IV': 'rewardItems.goldBundle4',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF81': 'rewardItems.goldBundle1',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF82': 'rewardItems.goldBundle2',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF83': 'rewardItems.goldBundle3',
    '\uACE8\uB4DC\uAF43\uB7EC\uBBF84': 'rewardItems.goldBundle4',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF8I': 'rewardItems.diamondBundle1',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF8II': 'rewardItems.diamondBundle2',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF8III': 'rewardItems.diamondBundle3',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF8IV': 'rewardItems.diamondBundle4',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF81': 'rewardItems.diamondBundle1',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF82': 'rewardItems.diamondBundle2',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF83': 'rewardItems.diamondBundle3',
    '\uB514\uC774\uC544\uAF43\uB7EC\uBBF84': 'rewardItems.diamondBundle4',
};

const resolveTowerRewardDisplayName = (itemId: string): string => {
    const normalized = normalizeTowerRewardItemKey(itemId);
    const key = TOWER_REWARD_ITEM_NAME_BY_KEY[normalized];
    return key ? towerTx(key) : itemId;
};

const resolveTowerRewardImage = (itemId: string): string => {
    const normalized = normalizeTowerRewardItemKey(itemId);
    const equipmentMatch = normalized.match(/^\uC7A5\uBE44\uC0C1\uC790(\d+)$/);
    if (equipmentMatch) {
        return `/images/Box/EquipmentBox${equipmentMatch[1]}.webp`;
    }
    const displayName = resolveTowerRewardDisplayName(itemId);
    const itemTemplate = CONSUMABLE_ITEMS.find(
        (item) => normalizeTowerRewardItemKey(item.name) === normalizeTowerRewardItemKey(displayName)
    );
    return itemTemplate?.image || '/images/icon/item_box.webp';
};

const TOWER_LOBBY_INVENTORY_ITEMS = [
    { itemKey: 'turnAdd', icon: '/images/button/addturn.webp', namesOrIds: TOWER_ITEM_TURN_ADD_NAMES },
    { itemKey: 'missile', icon: '/images/button/missile.webp', namesOrIds: TOWER_ITEM_MISSILE_NAMES },
    { itemKey: 'hidden', icon: '/images/button/hidden.webp', namesOrIds: TOWER_ITEM_HIDDEN_NAMES },
    { itemKey: 'scan', icon: '/images/button/scan.webp', namesOrIds: TOWER_ITEM_SCAN_NAMES },
    { itemKey: 'refresh', icon: '/images/button/reflesh.webp', namesOrIds: TOWER_ITEM_REFRESH_NAMES },
] as const;

/** 서버 `BUY_TOWER_ITEM` / `TOWER_SHOP_ITEMS.itemId` 와 동일해야 함 (유니코드 오타 시 턴 추가로 폴백됨) */
const TOWER_LOBBY_ITEM_SERVER_ID: Record<(typeof TOWER_LOBBY_INVENTORY_ITEMS)[number]['itemKey'], string> = {
    turnAdd: '턴 추가',
    missile: '미사일',
    hidden: '히든',
    scan: '스캔',
    refresh: '배치변경',
};

export type TowerLobbyProps = {
    /** homeViewer: 홈 중앙 퀵유틸 — PC는 좌(기록·랭킹·아이템)/우(스테이지), 모바일은 히어로+드로어 */
    presentation?: 'full' | 'homeViewer';
};

const TowerLobby: React.FC<TowerLobbyProps> = ({ presentation = 'full' }) => {
    const { t } = useTranslation('tower');
    const { t: tCommon } = useTranslation('common');
    const { t: tNav } = useTranslation('nav');
    const { currentUser, currentUserWithStatus, handlers, towerRankingsRefetchTrigger } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const isHomeViewer = presentation === 'homeViewer';
    /** 네이티브 모바일만 히어로+드로어+단열 스테이지. PC(홈뷰어 포함)는 좌우 구성 */
    const useMobileTowerLayout = isNativeMobile;
    const towerScreenGuide = useScreenGuide('tower');
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [towerPurchasingItemId, setTowerPurchasingItemId] = useState<string | null>(null);
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
                setTimeUntilReset(t('resetDone'));
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (days > 0) {
                setTimeUntilReset(t('timeDaysHoursMinutes', { days, hours, minutes }));
            } else if (hours > 0) {
                setTimeUntilReset(t('timeHoursMinutesSeconds', { hours, minutes, seconds }));
            } else {
                setTimeUntilReset(t('timeMinutesSeconds', { minutes, seconds }));
            }
        };
        
        updateTimeUntilReset();
        const interval = setInterval(updateTimeUntilReset, 1000);
        return () => clearInterval(interval);
    }, []);

    const onBackToProfile = () => {
        if (isHomeViewer) {
            handlers.closeQuickUtilityPanel?.();
            return;
        }
        window.location.hash = '#/home';
    };

    const openTowerItemPurchase = (itemId: string) => {
        setTowerPurchasingItemId(itemId);
    };

    const towerPurchasingItem =
        towerPurchasingItemId && currentUserWithStatus
            ? buildTowerShopPurchasableItem(currentUserWithStatus, towerPurchasingItemId)
            : null;

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
    }, [towerProgressFloor, useMobileTowerLayout]);

    const rankingColClass = useMobileTowerLayout
        ? 'flex max-h-[32dvh] min-h-0 w-full flex-none flex-col gap-1 overflow-hidden pb-0.5'
        : `flex h-full min-h-0 ${PC_TOWER_LEFT_COLUMN_CLASS} flex-col gap-2 overflow-hidden`;
    /** PC: 스테이지 열 전폭 + 스크롤 탑 배경(이미지 레이어는 stagePanel 내부) */
    const stageColClass = useMobileTowerLayout
        ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/60 to-gray-800/70 p-1 shadow-lg shadow-amber-900/40 backdrop-blur-md sm:p-2'
        : 'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-600/40 bg-zinc-950/80 p-2 shadow-2xl shadow-amber-900/50 sm:p-3';
    const quickColClass = `flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`;

    const renderTowerFloorRows = () =>
        stages.map((floor) => {
                            const stage = TOWER_STAGES.find(s => s.id === `tower-${floor}`);
                            const userTowerFloor = (currentUserWithStatus as any).towerFloor ?? 0;
                            const userMonthlyTowerFloor =
                                Number((currentUserWithStatus as any).monthlyTowerFloor ?? 0) || 0;
                            // 보상·⚡0: 이번 달 클리어(monthly). 잠금/현재층: 진행도(towerFloor)
                            const isCleared = floor <= userMonthlyTowerFloor;
                            const isCurrent = floor === userTowerFloor + 1;
                            const actionPoints = currentUserWithStatus?.actionPoints?.current ?? 0;
                            
                            // 관리자 여부 확인
                            const isAdmin = currentUser?.isAdmin ?? false;
                            
                            // 잠금 여부: 1층은 항상 열림, 2층 이상은 이전 층이 클리어되어야 함 (관리자는 예외)
                            const isLocked = !isAdmin && floor > 1 && floor > userTowerFloor + 1;
                            
                            // 이번 달 이미 클리어한 층은 행동력 소모가 0
                            const effectiveActionPointCost = isCleared ? 0 : (stage?.actionPointCost ?? 0);
                            const canChallenge = !isLocked && actionPoints >= effectiveActionPointCost;
                            
                            if (!stage) return null;

                            const p = stage.placements ?? { black: 0, white: 0, blackPattern: 0, whitePattern: 0 };
                            const towerDisplayBlackPlain = resolveTowerPlainBlackCount(floor, p.black ?? 0);
                            const towerDisplayBlackTarget = resolveTowerCaptureBlackTarget(floor, stage.targetScore?.black);
                            const towerDisplayWhitePlain = resolveTowerPlainWhiteCount(
                                floor,
                                p.black ?? 0,
                                p.blackPattern ?? 0,
                                p.whitePattern ?? 0,
                                p.white ?? 0
                            );
                            const hasBaseMode = (stage.baseStones ?? 0) > 0;
                            
                            // 목표 정보 (툴팁·표시용)
                            const getTargetInfo = () => {
                                if (stage.blackTurnLimit) {
                                    return t('captureGoalTurnLimit', { count: towerDisplayBlackTarget, turns: stage.blackTurnLimit });
                                }
                                if (stage.autoScoringTurns != null && stage.autoScoringTurns > 0) {
                                    return t('autoScoringHint', { turns: stage.autoScoringTurns });
                                }
                                return t('victory');
                            };
                            const autoScoringLabel =
                                floor >= 21 && stage.autoScoringTurns != null && stage.autoScoringTurns > 0
                                    ? t('autoScoringShort', { turns: stage.autoScoringTurns })
                                    : null;
                            
                            const rewardInfoContent = (
                                <div className="flex flex-col items-end gap-0.5">
                                    <StageClearRewardPreview
                                        reward={stage.rewards.firstClear}
                                        claimed={isCleared}
                                        tabShelf={false}
                                        isMobile={useMobileTowerLayout}
                                        usePremiumDesktop={false}
                                        align="end"
                                        resolveItemImage={resolveTowerRewardImage}
                                        resolveItemTitle={resolveTowerRewardDisplayName}
                                    />
                                    {isCleared && (
                                        <span className="text-[10px] sm:text-xs font-semibold text-stone-400 whitespace-nowrap">
                                            {t('rewardClaimed')}
                                        </span>
                                    )}
                                </div>
                            );
                            
                            const isCaptureMode = floor <= 20; // 1-20층: 따내기 바둑
                            
                            return (
                                <div
                                    key={floor}
                                    data-tower-floor={floor}
                                    className={`relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border ${
                                        useMobileTowerLayout
                                            ? 'p-2.5 sm:p-3'
                                            : `${PC_TOWER_STAGE_ROW_HEIGHT_CLASS} px-2.5 py-0 sm:px-3`
                                    } ${
                                        isLocked
                                            ? 'border-gray-700/50 bg-gray-950/55 opacity-60 backdrop-blur-[2px]'
                                            : isCurrent
                                            ? 'border-amber-500/70 bg-gradient-to-r from-amber-800/70 to-yellow-800/55 shadow-lg shadow-amber-600/40 backdrop-blur-[2px]'
                                            : isCleared
                                            ? 'border-amber-600/45 bg-zinc-900/50 hover:border-amber-500/65 hover:bg-zinc-800/55 backdrop-blur-[2px]'
                                            : 'border-amber-700/35 bg-zinc-950/45 hover:border-amber-600/50 hover:bg-zinc-900/50 backdrop-blur-[2px]'
                                    }`}
                                >
                                    {/* 자물쇠 오버레이 */}
                                    {isLocked && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg z-10 backdrop-blur-sm">
                                            <div className="flex items-center gap-2 px-2">
                                                <span className="text-2xl sm:text-3xl">🔒</span>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs sm:text-sm text-amber-300 font-semibold whitespace-nowrap">{t('locked')}</span>
                                                    <span className="text-[10px] sm:text-xs text-amber-400/80 whitespace-nowrap">{t('clearLowerFirst')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* 왼쪽: 정보 영역 */}
                                    <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
                                        {/* 층수 */}
                                        <div
                                            className="flex flex-shrink-0 items-center gap-1.5 rounded border border-amber-600/40 bg-amber-900/55 px-2 py-1.5 sm:px-2.5"
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
                                            <span className="text-xs font-semibold text-amber-300 sm:text-sm">{t('floorUnit')}</span>
                                            {isCleared && (
                                                <span className="text-sm font-bold text-green-400 sm:text-base">✓</span>
                                            )}
                                        </div>

                                        {/* 바둑판·배치 / 목표·제한 — PC는 고정 2줄(nowrap)로 행 높이 통일 */}
                                        <div
                                            className={`flex min-w-0 flex-1 flex-col justify-center text-[11px] sm:text-xs ${
                                                useMobileTowerLayout ? 'gap-y-1.5' : 'gap-y-1 overflow-hidden'
                                            }`}
                                        >
                                            {isCaptureMode && (
                                                <>
                                                    <div
                                                        className={`flex min-w-0 items-center gap-x-4 sm:gap-x-5 ${
                                                            useMobileTowerLayout ? 'flex-wrap gap-y-1' : 'flex-nowrap'
                                                        }`}
                                                    >
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <span className="whitespace-nowrap font-semibold text-amber-400/90">{t('board')}</span>
                                                            <span
                                                                className="font-bold tabular-nums text-amber-100"
                                                                title={t('boardSize', { size: stage.boardSize })}
                                                            >
                                                                {stage.boardSize}×{stage.boardSize}
                                                            </span>
                                                        </div>
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/Black.webp" alt={t('black')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="font-bold tabular-nums text-amber-200">{towerDisplayBlackPlain}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/single/White.webp" alt={t('white')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="font-bold tabular-nums text-amber-200">{towerDisplayWhitePlain}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={`flex min-w-0 items-center gap-x-4 sm:gap-x-5 ${
                                                            useMobileTowerLayout ? 'flex-wrap gap-y-1' : 'flex-nowrap'
                                                        }`}
                                                    >
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <span className="whitespace-nowrap font-semibold text-amber-400/90">{t('goal')}</span>
                                                            <span className="font-bold text-yellow-300">{t('blackCaptureGoal', { count: towerDisplayBlackTarget })}</span>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <span className="whitespace-nowrap font-semibold text-amber-400/90">{t('limit')}</span>
                                                            <span className="font-bold tabular-nums text-amber-200">{t('turnUnit', { count: stage.blackTurnLimit })}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {!isCaptureMode && (
                                                <div className="flex min-w-0 flex-col gap-y-1 overflow-hidden" title={getTargetInfo()}>
                                                    <div
                                                        className={`flex min-w-0 items-center gap-x-3 sm:gap-x-4 ${
                                                            useMobileTowerLayout ? 'flex-wrap gap-y-0.5' : 'flex-nowrap'
                                                        }`}
                                                    >
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <span className="whitespace-nowrap font-semibold text-amber-400/90">{t('board')}</span>
                                                            <span className="font-bold tabular-nums text-amber-100">{stage.boardSize}×{stage.boardSize}</span>
                                                        </div>
                                                        {autoScoringLabel && (
                                                            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                                                <span className="shrink-0 whitespace-nowrap font-semibold text-amber-400/90">{t('scoring')}</span>
                                                                <span className="min-w-0 truncate font-bold tracking-tight text-sky-300">{autoScoringLabel}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div
                                                        className={`flex min-w-0 items-center gap-x-2 sm:gap-x-3 ${
                                                            useMobileTowerLayout ? 'flex-wrap gap-y-0.5' : 'flex-nowrap overflow-hidden'
                                                        }`}
                                                    >
                                                        {hasBaseMode ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <img src="/images/simbols/simbol4.webp" alt={t('baseAlt')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                <span className="font-bold text-sky-300">{t('base')}{stage.baseStones}</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/Black.webp" alt={t('black')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                    <span className="font-bold tabular-nums text-amber-200">{towerDisplayBlackPlain}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/White.webp" alt={t('white')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                    <span className="font-bold tabular-nums text-amber-200">{towerDisplayWhitePlain}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/BlackDouble.webp" alt={t('blackPatternAlt')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                    <span className="font-bold tabular-nums text-amber-200">×{stage.placements.blackPattern}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <img src="/images/single/WhiteDouble.webp" alt={t('blackPatternAlt')} className="h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
                                                                    <span className="font-bold tabular-nums text-amber-200">×{stage.placements.whitePattern}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* 보상 정보 (PC 고정행 안에서 잘리지 않게 폭 제한) */}
                                        <div
                                            className={`ml-auto flex shrink-0 flex-col items-end justify-center gap-0.5 overflow-hidden ${
                                                useMobileTowerLayout ? 'hidden' : 'max-w-[9.5rem] sm:max-w-[11rem]'
                                            }`}
                                        >
                                            {rewardInfoContent}
                                        </div>
                                    </div>
                                    
                                    {/* 오른쪽: 모바일은 보상/버튼 세로 배치, PC는 버튼 단독 */}
                                    {useMobileTowerLayout ? (
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
                                                            payload: { floor }
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
                                                <span className="text-[10px] leading-none">{t('challenge')}</span>
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
                                                    payload: { floor }
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
                                        <span className="text-[10px] leading-none sm:text-xs">{t('challenge')}</span>
                                    </button>
                                    )}
                                </div>
                            );
                        });


    function renderTowerMainColumns() {
        if (useMobileTowerLayout) {
            const inventory = currentUserWithStatus?.inventory || [];
            const getItemCount = (namesOrIds: readonly string[]): number =>
                countTowerLobbyInventoryQty(inventory, namesOrIds);
            const mobileTowerItems = TOWER_LOBBY_INVENTORY_ITEMS.map((item) => ({
                ...item,
                itemId: TOWER_LOBBY_ITEM_SERVER_ID[item.itemKey],
                name: t(`inventoryItems.${item.itemKey}`),
                count: getItemCount(item.namesOrIds),
            }));

            const mobileHeroDrawerOpen = mobileHeroDrawer !== null;
            const setMobileDrawer = (next: 'record' | 'ranking' | 'inventory') => {
                setMobileRewardTooltipKey(null);
                setMobileHeroDrawer((prev) => (prev === next ? null : next));
            };

            const mobileRankingList = (
                <>
                    {!myRankingEntry && effectiveMonthlyFloorForReward < 10 && (
                        <p className="px-0.5 py-2 text-center text-xs text-amber-300/80">
                            {t('rankingHint')}
                        </p>
                    )}
                    {towerRankingsLoading && towerRankings.length === 0 ? (
                        <p className="py-6 text-center text-sm text-amber-300/60">{t('rankingLoading')}</p>
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
                                        <p className="text-[10px] text-amber-300/85 sm:text-xs">{t('floorLabel', { floor: (user as any).displayFloor ?? 0 })}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="py-6 text-center text-sm text-amber-300/60">{t('rankingEmpty')}</p>
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
                                    if (el.src.includes('towergo.webp')) el.src = TOWER_CHALLENGE_LOBBY_IMG;
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
                                    aria-label={t('closePanelAria')}
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
                                        {mobileHeroDrawer === 'inventory' && t('ownedItems')}
                                    </h3>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                            type="button"
                                            aria-label={t('close')}
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
                                                        <span className="text-xs font-semibold tracking-wide text-amber-200/90">{t('myRecord')}</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="rounded-lg border border-amber-500/30 bg-black/35 px-2 py-1.5 text-center">
                                                            <p className="text-[10px] font-semibold tracking-wide text-amber-200/80">{t('allTimeBest')}</p>
                                                            <p className="mt-0.5 text-lg font-black tabular-nums text-yellow-100">{t('floorTier', { floor: bestFloorAllTime })}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-amber-500/30 bg-black/35 px-2 py-1.5 text-center">
                                                            <p className="text-[10px] font-semibold tracking-wide text-amber-200/80">{t('currentFloorLabel')}</p>
                                                            <p className="mt-0.5 text-lg font-black tabular-nums text-amber-50">{t('floorTier', { floor: effectiveMonthlyFloorForReward })}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="min-w-0 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/35 via-gray-900/85 to-amber-950/40 p-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.2)] ring-1 ring-emerald-200/10 backdrop-blur-md">
                                                    <div className="mb-2 flex items-center justify-start gap-1">
                                                        <span className="text-xs font-semibold tracking-wide text-emerald-200/90">{t('expectedReward')}</span>
                                                    </div>
                                                    {myRewardTier ? (
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-1 gap-1.5">
                                                                <div className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-amber-500/25 bg-black/35 px-1.5 py-1.5 text-xs text-yellow-100">
                                                                    <img src="/images/icon/Gold.webp" alt="" className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="truncate tabular-nums font-semibold">{formatGoldAmountKoG(myRewardTier.gold)}</span>
                                                                </div>
                                                                <div className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-cyan-500/30 bg-black/35 px-1.5 py-1.5 text-xs text-cyan-100">
                                                                    <img src="/images/icon/Zem.webp" alt="" className="h-3.5 w-3.5 shrink-0" />
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
                                                                            aria-label={t('viewRewardItem', { name: resolveTowerRewardDisplayName(it.itemId) })}
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
                                                            {t('rewardFromFloor10')}
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
                                                {mobileTowerItems.map((item) => (
                                                    <button
                                                        key={item.itemId}
                                                        type="button"
                                                        className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-700/35 bg-gray-800/50 px-1 py-1.5 transition-colors hover:border-amber-600/55 hover:bg-gray-700/50"
                                                        onClick={() => openTowerItemPurchase(item.itemId)}
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
                                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 ${RANKING_MODAL_SLIM_SCROLL_Y}`}
                            >
                                <div className="space-y-2 pb-1">{renderTowerFloorRows()}</div>
                            </div>
                        </section>
                    </div>
                </>
            );
        }

        const stagePanel = (
            <div className={stageColClass}>
                <h2 className="relative z-20 mb-2 flex-shrink-0 bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-base font-bold text-transparent drop-shadow-[0_0_4px_rgba(217,119,6,0.8)] sm:mb-3 sm:text-lg">
                    스테이지
                </h2>
                <div
                    ref={stageScrollRef}
                    className={`relative z-10 min-h-0 flex-1 overflow-y-auto ${RANKING_MODAL_SLIM_SCROLL_Y}`}
                >
                    {/*
                      스크롤 콘텐츠 높이 = 1~100층 전체.
                      세로형 Tower 이미지를 콘텐츠에 맞춰 깔아 위로 갈수록(100층) 꼭대기가 보이게 함.
                    */}
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
                            <img
                                src={TOWER_STAGE_SCROLL_BG_WEBP}
                                alt=""
                                className="h-full w-full object-cover object-center"
                                draggable={false}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-zinc-950/35 to-black/55" />
                            <div className="absolute inset-0 bg-amber-950/10" />
                        </div>
                        <div className="relative z-10 space-y-1.5 py-0.5">{renderTowerFloorRows()}</div>
                    </div>
                </div>
            </div>
        );

        /** PC 홈뷰어: AdventureLobby와 동일 — 좌(기록·랭킹·아이템) | 우(스테이지), 탑 이미지·퀵레일 없음 */
        if (isHomeViewer) {
            return (
                <div
                    className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-2 overflow-hidden"
                    aria-label={t('title')}
                >
                    <div className={rankingColClass}>{renderPcLeftPanels()}</div>
                    {stagePanel}
                </div>
            );
        }

        return (
            <>
                    {/* 좌측: 랭킹 Top 100 + 보유 아이템. 타이틀은 좌열만 — 우측 스테이지·퀵메뉴가 상단까지 */}
                    <div className={rankingColClass}>
                    <div className={`shrink-0 ${towerTitleStripRow}`}>
                        <button
                            type="button"
                            onClick={onBackToProfile}
                            className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                            aria-label={tCommon('backAria')}
                        >
                            <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                        </button>
                        <h1 className={towerTitleH1Class}>{t('title')}</h1>
                    </div>
                    {renderPcLeftPanels()}
                    </div>

                    <PcLobbyCenterColumn transparentShell fullWidth>
                        {stagePanel}
                    </PcLobbyCenterColumn>

                <div className={quickColClass} aria-label={tNav('quickMenu.quickMenuAria')}>
                    <div className={PC_QUICK_RAIL_WRAPPER_CLASS}>
                        <QuickAccessSidebar fillHeight={true} />
                    </div>
                </div>
            </>
        );
    }

    function renderPcLeftPanels() {
        const inventory = currentUserWithStatus?.inventory || [];
        const getItemCount = (namesOrIds: readonly string[]): number =>
            countTowerLobbyInventoryQty(inventory, namesOrIds);

        return (
            <>
                {/* 내 기록 + 예상 보상 */}
                <div className="shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/55 bg-gradient-to-b from-amber-950/85 via-zinc-950/90 to-amber-950/80 shadow-xl shadow-amber-900/35">
                    <div className="flex items-center justify-between gap-2 border-b border-amber-600/45 bg-amber-900/35 px-2.5 py-1.5">
                        <h3 className="bg-gradient-to-r from-yellow-200 to-amber-200 bg-clip-text text-sm font-bold text-transparent">
                            내 기록
                        </h3>
                        <Button
                            onClick={() => setIsRewardModalOpen(true)}
                            colorScheme="none"
                            className="!min-w-0 !px-2 !py-1 border border-amber-500/55 bg-amber-900/45 text-[11px] font-semibold text-amber-100 hover:bg-amber-800/60"
                        >
                            {t('rewardInfo')}
                        </Button>
                    </div>
                    <div className="space-y-2 p-2.5">
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="rounded-lg border border-amber-600/40 bg-black/25 px-2 py-1.5 text-center">
                                <p className="text-[10px] font-semibold text-amber-300/85">{t('allTimeBest')}</p>
                                <p className="mt-0.5 text-base font-black tabular-nums text-yellow-200">
                                    {t('floorTier', { floor: bestFloorAllTime })}
                                </p>
                            </div>
                            <div className="rounded-lg border border-amber-600/40 bg-black/25 px-2 py-1.5 text-center">
                                <p className="text-[10px] font-semibold text-amber-300/85">{t('monthlyBest')}</p>
                                <p className="mt-0.5 text-base font-black tabular-nums text-amber-100">
                                    {t('floorTier', { floor: effectiveMonthlyFloorForReward })}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-emerald-700/35 bg-emerald-950/25 px-2 py-1.5">
                            <div className="mb-1.5 flex items-center justify-between gap-1">
                                <p className="text-[11px] font-bold tracking-wide text-emerald-200/95">{t('expectedReward')}</p>
                                {myRewardTier ? (
                                    <span className="text-[10px] font-semibold text-emerald-300/80">
                                        {t('rewardTierLine', { floor: myRewardTier.floor })}
                                    </span>
                                ) : null}
                            </div>
                            {myRewardTier ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <div
                                        className="flex items-center gap-1 rounded-md border border-yellow-600/40 bg-black/30 px-1.5 py-1"
                                        title={tCommon('resources.gold')}
                                    >
                                        <img src="/images/icon/Gold.webp" alt="" className="h-5 w-5 object-contain" />
                                        <span className="text-xs font-bold tabular-nums text-yellow-200">
                                            {formatGoldAmountKoG(myRewardTier.gold)}
                                        </span>
                                    </div>
                                    <div
                                        className="flex items-center gap-1 rounded-md border border-cyan-600/40 bg-black/30 px-1.5 py-1"
                                        title={tCommon('resources.diamonds')}
                                    >
                                        <img src="/images/icon/Zem.webp" alt="" className="h-5 w-5 object-contain" />
                                        <span className="text-xs font-bold tabular-nums text-cyan-200">
                                            {myRewardTier.diamonds}
                                        </span>
                                    </div>
                                    {myRewardTier.items.map((it: { itemId: string; quantity: number }, i: number) => (
                                        <div
                                            key={`${it.itemId}-${i}`}
                                            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-amber-500/45 bg-gradient-to-b from-amber-900/40 to-zinc-950/70 shadow-sm"
                                            title={`${resolveTowerRewardDisplayName(it.itemId)} ×${it.quantity}`}
                                        >
                                            <img
                                                src={resolveTowerRewardImage(it.itemId)}
                                                alt={resolveTowerRewardDisplayName(it.itemId)}
                                                className="h-7 w-7 object-contain drop-shadow"
                                            />
                                            <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-amber-900 bg-yellow-400 px-0.5 text-[9px] font-extrabold leading-none text-zinc-900">
                                                {it.quantity}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] leading-snug text-amber-300/80">{t('rewardFromFloor10Short')}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 랭킹 Top 100 */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/70 via-amber-950/55 to-gray-800/70 p-2 shadow-2xl shadow-amber-900/40 backdrop-blur-md">
                    <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
                        <h2 className="bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-sm font-bold text-transparent sm:text-base">
                            랭킹 Top 100
                        </h2>
                        <span className="truncate text-[10px] font-semibold tabular-nums text-yellow-300/90 sm:text-xs">
                            {timeUntilReset}
                        </span>
                    </div>
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
                            <div className="mb-1.5 flex shrink-0 items-center gap-2 rounded-lg border-2 border-yellow-400/60 bg-gradient-to-r from-yellow-900/45 via-amber-800/45 to-orange-900/45 p-1.5 shadow-md shadow-yellow-900/25">
                                <span
                                    className={`flex w-10 shrink-0 justify-center text-center text-[11px] font-bold leading-tight ${
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
                                    {pr !== null ? pr : t('unranked')}
                                </span>
                                <Avatar
                                    userId={pinned.id}
                                    userName={pinned.nickname}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={30}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-yellow-100">{pinned.nickname}</p>
                                    <p className="text-[10px] text-amber-300/85">{t('floorLabel', { floor: pinned.displayFloor ?? 0 })}</p>
                                </div>
                            </div>
                        );
                    })()}
                    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5">
                        {!myRankingEntry && effectiveMonthlyFloorForReward < 10 && (
                            <p className="px-1 py-2 text-center text-[11px] text-amber-300/70">{t('rankingHint')}</p>
                        )}
                        {towerRankingsLoading && towerRankings.length === 0 ? (
                            <p className="py-6 text-center text-sm text-amber-300/60">{t('rankingLoading')}</p>
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
                                            className={`flex items-center gap-2 rounded-lg p-1.5 transition-all ${
                                                isTop3
                                                    ? 'border border-amber-500/50 bg-gradient-to-r from-amber-900/40 to-yellow-900/40'
                                                    : 'border border-amber-700/30 bg-gray-800/40 hover:border-amber-600/50 hover:bg-gray-700/50'
                                            }`}
                                        >
                                            <span
                                                className={`w-6 shrink-0 text-center text-xs font-bold ${
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
                                                size={28}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-amber-100">{user.nickname}</p>
                                                <p className="text-[10px] text-amber-300/80">
                                                    {t('floorLabel', { floor: (user as any).displayFloor ?? 0 })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {top100ScrollUsers.length === 0 && (
                                    <p className="py-3 text-center text-[11px] text-amber-400/75">{t('noOtherRanked')}</p>
                                )}
                            </>
                        ) : (
                            <p className="py-6 text-center text-sm text-amber-300/60">{t('rankingEmpty')}</p>
                        )}
                    </div>
                </div>

                {/* 보유 아이템 — 아이콘 슬롯 그리드 */}
                <div className="shrink-0 rounded-xl border-2 border-amber-600/40 bg-gradient-to-br from-gray-900/75 via-amber-950/55 to-gray-800/75 p-2 shadow-2xl shadow-amber-900/40 backdrop-blur-md">
                    <h3 className="mb-1.5 bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-sm font-bold text-transparent">
                        {t('ownedItems')}
                    </h3>
                    <div className="grid grid-cols-5 gap-1">
                        {TOWER_LOBBY_INVENTORY_ITEMS.map((item) => {
                            const count = getItemCount(item.namesOrIds);
                            const itemId = TOWER_LOBBY_ITEM_SERVER_ID[item.itemKey];
                            const name = t(`inventoryItems.${item.itemKey}`);
                            const shop = buildTowerShopPurchasableItem(currentUserWithStatus!, itemId);
                            const goldPrice = shop?.price?.gold;
                            return (
                                <button
                                    key={item.itemKey}
                                    type="button"
                                    title={goldPrice != null ? `${name} · ${formatGoldAmountKoG(goldPrice)}` : name}
                                    onClick={() => openTowerItemPurchase(itemId)}
                                    className="group flex flex-col items-center gap-0.5 rounded-lg border border-amber-700/40 bg-gradient-to-b from-zinc-800/70 to-zinc-950/80 px-0.5 py-1.5 transition-all hover:border-amber-500/65 hover:from-amber-900/35 hover:to-zinc-950 active:scale-[0.97]"
                                >
                                    <div className="relative flex h-10 w-10 items-center justify-center rounded-md border border-amber-500/35 bg-black/35 shadow-inner">
                                        <img
                                            src={item.icon}
                                            alt={name}
                                            className="h-8 w-8 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-105"
                                        />
                                        <span
                                            className={`absolute -bottom-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-amber-950 px-0.5 text-[9px] font-extrabold leading-none ${
                                                count > 0 ? 'bg-yellow-400 text-zinc-900' : 'bg-zinc-600 text-zinc-200'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    </div>
                                    <span className="max-w-full truncate text-center text-[9px] font-semibold leading-tight text-amber-100/95">
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </>
        );
    }

    return (
        <div
            className={`relative flex w-full flex-col text-white ${
                isHomeViewer
                    ? 'h-full min-h-0 overflow-hidden bg-transparent'
                    : isNativeMobile
                      ? 'sudamr-native-route-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-lobby-shell-tower'
                      : `h-full min-h-0 overflow-hidden bg-lobby-shell-tower ${PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS}`
            }`}
        >
            {/* 네이티브 풀페이지 전역 헤더. homeViewer는 퀵유틸 NavTitleBar 사용 */}
            {isNativeMobile && !isHomeViewer && (
                <header className="flex flex-shrink-0 px-1.5 py-2">
                    <div className={`w-full ${towerTitleStripVisual}`}>
                        <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
                            <button
                                type="button"
                                onClick={onBackToProfile}
                                className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center transition-transform active:scale-90 hover:drop-shadow-lg"
                                aria-label={tCommon('backAria')}
                            >
                                <img src="/images/button/back.webp" alt="" className="h-full w-full" />
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
                    title={t('rewardModalTitle')}
                    onClose={() => setIsRewardModalOpen(false)}
                    windowId="tower-reward-info"
                    initialWidth={useMobileTowerLayout ? 680 : 640}
                    initialHeight={useMobileTowerLayout ? 620 : 760}
                    isTopmost
                >
                    <div className="h-full space-y-3 overflow-y-auto pr-1 text-sm text-amber-100">
                        <div className="rounded-lg border border-amber-700/40 bg-gradient-to-r from-amber-900/25 to-yellow-900/15 px-3 py-2.5 text-center">
                            <p className="text-xs font-semibold text-amber-200/90 sm:text-sm">{t('settlementRemaining')}</p>
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
                                                {t('myCurrentReward')}
                                            </div>
                                        )}
                                        <span
                                            className={`${TOWER_MONTHLY_MODAL_TIER_LABEL_CLASS[idx] ?? 'text-amber-300'} font-bold text-sm sm:text-lg ${isMyCurrentTier ? 'pt-2 sm:pt-2.5' : ''}`}
                                        >
                                            {t('floorTier', { floor: tier.floor })}
                                        </span>
                                        <div
                                            className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:gap-3 sm:text-base ${isMyCurrentTier ? 'pt-2 sm:pt-2.5' : ''}`}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                <img src="/images/icon/Gold.webp" alt={tCommon('resources.gold')} className="h-4 w-4 sm:h-6 sm:w-6" />
                                                {formatGoldAmountKoG(tier.gold)}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <img src="/images/icon/Zem.webp" alt={t('diamondFullAlt')} className="h-4 w-4 sm:h-6 sm:w-6" />
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

            {useMobileTowerLayout ? (
                <div className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 py-1">
                    {renderTowerMainColumns()}
                </div>
            ) : isHomeViewer ? (
                renderTowerMainColumns()
            ) : (
                <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
                    {renderTowerMainColumns()}
                </div>
            )}
            {towerPurchasingItem && currentUserWithStatus && (
                <PurchaseQuantityModal
                    item={towerPurchasingItem}
                    currentUser={currentUserWithStatus}
                    ignoreInventorySlotLimit
                    onClose={() => setTowerPurchasingItemId(null)}
                    onConfirm={async (itemId, quantity) => {
                        await handlers.handleAction({
                            type: 'BUY_TOWER_ITEM',
                            payload: { itemId, quantity },
                        } as any);
                    }}
                />
            )}
            {towerScreenGuide.isOpen && (
                <ScreenGuideModal
                    guideId="tower"
                    onClose={towerScreenGuide.close}
                    onDismissForever={towerScreenGuide.dismissForever}
                />
            )}
        </div>
    );

};

export default TowerLobby;

