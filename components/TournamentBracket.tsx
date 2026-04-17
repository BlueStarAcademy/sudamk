import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus, TournamentState, PlayerForTournament, ServerAction, User, CoreStat, Match, Round, CommentaryLine, TournamentType, LeagueTier } from '../types.js';
import Button from './Button.js';
import { useButtonClickThrottle } from '../hooks/useButtonClickThrottle.js';
import { useTournamentSimulation } from '../hooks/useTournamentSimulation.js';
import { TOURNAMENT_DEFINITIONS, TOURNAMENT_SCORE_REWARDS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, AVATAR_POOL, BORDER_POOL, CORE_STATS_DATA, LEAGUE_DATA, DUNGEON_STAGE_BASE_SCORE, DUNGEON_STAGE_BASE_REWARDS_MATERIAL, DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT, DUNGEON_RANK_SCORE_BONUS, DUNGEON_DEFAULT_SCORE_BONUS, gradeBackgrounds, EQUIPMENT_GRADE_LABEL_KO } from '../constants';
import { getDungeonRankRewardForDisplay, getDungeonRankRewardRangeForDisplay, getDungeonRankKeysForDisplay, getDungeonBasicRewardRangeGold, getDungeonStageScore, DUNGEON_STAGE_MATERIAL_ROLLS, DUNGEON_STAGE_EQUIPMENT_DROP } from '../shared/constants/tournaments';
import Avatar from './Avatar.js';
import RadarChart from './RadarChart.js';
import SgfViewer from './SgfViewer.js';
import { audioService } from '../services/audioService.js';
import ConditionPotionModal from './ConditionPotionModal.js';
import { calculateTotalStats } from '../services/statService.js';
import DungeonStageSummaryModal, { type DungeonStageSummaryModalProps } from './DungeonStageSummaryModal.js';
import { resolvePublicUrl } from '../utils/publicAssetUrl.js';
import { isFunctionVipActive } from '../shared/utils/rewardVip.js';

// 순위보상 itemId(재료 상자1~6, 장비 상자1~6) → CONSUMABLE_ITEMS name(재료 상자 I~VI, 장비 상자 I~VI) 매핑
const REWARD_ITEM_ID_TO_NAME: Record<string, string> = {
    '재료 상자1': '재료 상자 I', '재료 상자2': '재료 상자 II', '재료 상자3': '재료 상자 III',
    '재료 상자4': '재료 상자 IV', '재료 상자5': '재료 상자 V', '재료 상자6': '재료 상자 VI',
    '장비 상자1': '장비 상자 I', '장비 상자2': '장비 상자 II', '장비 상자3': '장비 상자 III',
    '장비 상자4': '장비 상자 IV', '장비 상자5': '장비 상자 V', '장비 상자6': '장비 상자 VI',
};
function getRewardItemImageUrl(itemName: string): string {
    const lookupName = REWARD_ITEM_ID_TO_NAME[itemName] ?? itemName;
    const consumable = CONSUMABLE_ITEMS.find(i => i.name === lookupName);
    if (consumable?.image) return consumable.image;
    const material = MATERIAL_ITEMS[lookupName] ?? MATERIAL_ITEMS[itemName];
    return (material as any)?.image ?? '';
}

/** 월드 던전 경기당 장비: 승·패 풀을 합쳐 나올 수 있는 등급의 최저~최고만 표시 */
const WORLD_DUNGEON_EQUIP_GRADE_ORDER = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
function worldDungeonEquipmentGradeRangeText(stage: number): string {
    const config = DUNGEON_STAGE_EQUIPMENT_DROP[stage] || DUNGEON_STAGE_EQUIPMENT_DROP[1];
    const grades = [...config.win.map(e => e.grade), ...config.loss.map(e => e.grade)];
    if (grades.length === 0) return '등급: —';
    let lo = grades[0]!;
    let hi = grades[0]!;
    for (const g of grades) {
        const gi = WORLD_DUNGEON_EQUIP_GRADE_ORDER.indexOf(g as (typeof WORLD_DUNGEON_EQUIP_GRADE_ORDER)[number]);
        const loi = WORLD_DUNGEON_EQUIP_GRADE_ORDER.indexOf(lo as (typeof WORLD_DUNGEON_EQUIP_GRADE_ORDER)[number]);
        const hii = WORLD_DUNGEON_EQUIP_GRADE_ORDER.indexOf(hi as (typeof WORLD_DUNGEON_EQUIP_GRADE_ORDER)[number]);
        if (gi >= 0 && (loi < 0 || gi < loi)) lo = g;
        if (gi >= 0 && (hii < 0 || gi > hii)) hi = g;
    }
    const loL = EQUIPMENT_GRADE_LABEL_KO[lo as keyof typeof EQUIPMENT_GRADE_LABEL_KO] ?? lo;
    const hiL = EQUIPMENT_GRADE_LABEL_KO[hi as keyof typeof EQUIPMENT_GRADE_LABEL_KO] ?? hi;
    return lo === hi ? `등급: ${loL}` : `등급 범위: ${loL}~${hiL}`;
}

/** 동네 챔피언십 기본 보상(경기당): 실제는 골드 범위 지급 — 골드 아이콘 어둡게 + 물음표 */
function MysteryNeighborhoodGoldThumb() {
    return (
        <div
            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 border-amber-500/75 bg-slate-900/95 ring-1 ring-amber-400/25"
            aria-hidden
        >
            <img
                src="/images/icon/Gold.png"
                alt=""
                className="h-full w-full object-contain p-0.5 opacity-[0.42] brightness-[0.5] contrast-[0.95]"
                loading="lazy"
                decoding="async"
            />
            <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-black leading-none text-white"
                style={{ textShadow: '0 0 10px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}
            >
                ?
            </span>
        </div>
    );
}

/** 챔피언십 기본 보상(경기당): 전국·월드 — 장비 상자 아이콘 + 물음표로 ‘내용은 문구 참고’ 표시 */
function MysteryBaseRewardBoxThumb({ accent }: { accent: 'amber' | 'blue' | 'purple' }) {
    const box = CONSUMABLE_ITEMS.find((i) => i.name === '장비 상자 I');
    const src = box?.image || '';
    const ring =
        accent === 'amber'
            ? 'border-amber-500/75 ring-1 ring-amber-400/25'
            : accent === 'blue'
              ? 'border-sky-500/75 ring-1 ring-sky-400/25'
              : 'border-violet-500/75 ring-1 ring-violet-400/25';
    return (
        <div className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900/95 ${ring}`} aria-hidden>
            {src ? (
                <img src={src} alt="" className="h-full w-full object-contain p-0.5 opacity-90" loading="lazy" decoding="async" />
            ) : null}
            <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-black leading-none text-white"
                style={{ textShadow: '0 0 10px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}
            >
                ?
            </span>
        </div>
    );
}

/** 순위별 보상 그리드에서 ‘내 순위’ 행 강조 (종료 후) */
function isDungeonRankGridRowHighlighted(type: TournamentType, userRank: number, rankKey: number, tournamentFinished: boolean): boolean {
    if (!tournamentFinished || userRank < 1) return false;
    if (type === 'world') {
        if (userRank >= 9) return rankKey === 9;
        if (userRank >= 4 && userRank <= 8) return rankKey === 4;
        return rankKey === userRank;
    }
    return rankKey === userRank;
}

/** 서버 inferDungeonStageAttempt와 동일 — currentStageAttempt 누락 시에도 보상 버튼·COMPLETE_DUNGEON_STAGE 단계 일치 */
function resolveDungeonStageAttempt(
    tournamentState: TournamentState,
    user: Pick<UserWithStatus, 'dungeonProgress'>,
    dungeonType: TournamentType
): number {
    const existing = tournamentState.currentStageAttempt;
    if (typeof existing === 'number' && existing >= 1 && existing <= 10) return existing;

    const m = tournamentState.title?.match(/(\d+)\s*단계/);
    if (m?.[1]) {
        const parsed = Number(m[1]);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 10) return parsed;
    }

    const progress = user.dungeonProgress?.[dungeonType];
    const unlocked = progress?.unlockedStages;
    if (Array.isArray(unlocked) && unlocked.length > 0) {
        const maxUnlocked = Math.max(...unlocked);
        const clamped = Math.min(10, Math.max(1, Math.floor(maxUnlocked)));
        if (!Number.isNaN(clamped)) return clamped;
    }

    const currentStage = progress?.currentStage;
    if (typeof currentStage === 'number' && currentStage >= 1 && currentStage <= 10) return currentStage;

    if (dungeonType === 'world' && tournamentState.status === 'eliminated') return 1;

    return 1;
}

// Error Boundary for PlayerProfilePanel
class PlayerProfilePanelErrorBoundary extends Component<
    { children: ReactNode; fallback?: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode; fallback?: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (import.meta.env.DEV) {
            console.error('[PlayerProfilePanelErrorBoundary] Error caught:', error, errorInfo);
        }
    }

    componentDidUpdate(prevProps: { children: ReactNode }) {
        // props가 변경되면 에러 상태 리셋
        if (prevProps.children !== this.props.children && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500 backdrop-blur-sm">
                    선수 정보를 불러오는 중 오류가 발생했습니다.
                </div>
            );
        }

        return this.props.children;
    }
}

const KEY_STATS_BY_PHASE: Record<'early' | 'mid' | 'end', CoreStat[]> = {
    early: [CoreStat.CombatPower, CoreStat.ThinkingSpeed, CoreStat.Concentration],
    mid: [CoreStat.CombatPower, CoreStat.Judgment, CoreStat.Concentration, CoreStat.Stability],
    end: [CoreStat.Calculation, CoreStat.Stability, CoreStat.Concentration],
};

// 서버의 STAT_WEIGHTS와 동일한 가중치 정의
const STAT_WEIGHTS: Record<'early' | 'mid' | 'end', Partial<Record<CoreStat, number>>> = {
    early: {
        [CoreStat.CombatPower]: 0.4,
        [CoreStat.ThinkingSpeed]: 0.3,
        [CoreStat.Concentration]: 0.3,
    },
    mid: {
        [CoreStat.CombatPower]: 0.3,
        [CoreStat.Judgment]: 0.3,
        [CoreStat.Concentration]: 0.2,
        [CoreStat.Stability]: 0.2,
    },
    end: {
        [CoreStat.Calculation]: 0.5,
        [CoreStat.Stability]: 0.3,
        [CoreStat.Concentration]: 0.2,
    },
};

const getMaxStatValueForLeague = (league: LeagueTier): number => {
    switch (league) {
        case LeagueTier.Sprout:
        case LeagueTier.Rookie:
        case LeagueTier.Rising:
            return 250;
        case LeagueTier.Ace:
        case LeagueTier.Diamond:
            return 300;
        case LeagueTier.Master:
        case LeagueTier.Grandmaster:
            return 400;
        case LeagueTier.Challenger:
            return 500;
        default:
            return 250;
    }
};

interface TournamentBracketProps {
    tournament: TournamentState;
    currentUser: UserWithStatus;
    onBack: () => void;
    allUsersForRanking: User[];
    onViewUser: (userId: string) => void;
    onAction: (action: ServerAction) => void;
    onStartNextRound: () => void;
    onReset: () => void;
    onSkip: () => void;
    onOpenShop?: () => void;
    isMobile: boolean;
}

const PlayerProfilePanel: React.FC<{ 
    player: PlayerForTournament | null, 
    initialPlayer: PlayerForTournament | null,
    allUsers: User[], 
    currentUserId: string, 
    onViewUser: (userId: string) => void,
    highlightPhase: 'early' | 'mid' | 'end' | 'none';
    isUserMatch?: boolean;
    onUseConditionPotion?: () => void;
    onOpenShop?: () => void;
    timeElapsed?: number;
    tournamentStatus?: string;
    isMobile?: boolean;
    /** 1회차 경기 시작 전에만 true. 시작 후·종료 후에는 false (컨디션 회복제 버튼 비활성화) */
    canUseConditionPotion?: boolean;
    /** 티어 표시 여부. 챔피언십 경기장에서는 false (티어는 전략바둑/놀이바둑에만 존재) */
    showLeague?: boolean;
    /** 모바일 챔피언십 대국자 탭: 장비 비교 모달과 유사한 상태정보/능력수치 탭 */
    championshipMobileCompareLayout?: boolean;
    mobileRadarCompare?: { datasets: { stats: Record<string, number>; color: string; fill: string }[]; maxStatValue: number; radarSize: number };
    radarLegendBelow?: ReactNode;
    /** 양 패널을 세로로 쌓을 때: 패널 내부 스크롤·하단 레이더 제거(부모에서 단일 레이더) */
    championshipMobileStackedNoRadar?: boolean;
    /** 토너먼트 플레이어 객체에 컨디션이 1000일 때 던전 스냅샷 등으로 보강 */
    conditionFallback?: number;
}> = ({
    player,
    initialPlayer,
    allUsers,
    currentUserId,
    onViewUser,
    highlightPhase,
    isUserMatch,
    onUseConditionPotion,
    onOpenShop,
    timeElapsed = 0,
    tournamentStatus,
    isMobile = false,
    canUseConditionPotion = false,
    showLeague = false,
    championshipMobileCompareLayout = false,
    mobileRadarCompare,
    radarLegendBelow,
    championshipMobileStackedNoRadar = false,
    conditionFallback,
}) => {
    // 모든 hooks는 조건부 return 전에 선언되어야 함
    const [previousCondition, setPreviousCondition] = useState<number | undefined>(undefined);
    const [showConditionIncrease, setShowConditionIncrease] = useState(false);
    const [conditionIncreaseAmount, setConditionIncreaseAmount] = useState(0);
    const [statChanges, setStatChanges] = useState<Record<CoreStat, number>>({} as Record<CoreStat, number>);
    const prevStatsRef = useRef<Record<CoreStat, number>>({} as Record<CoreStat, number>);
    const initialStatsKeyRef = useRef<string>('');
    const [championshipMobileInfoTab, setChampionshipMobileInfoTab] = useState<'status' | 'abilities'>('status');
    
    // player가 변경되면 previousCondition 초기화
    useEffect(() => {
        // player가 null이 아니고 condition이 유효한 경우에만 설정
        if (player && player.condition !== undefined && player.condition !== null) {
            setPreviousCondition(player.condition);
        } else {
            setPreviousCondition(undefined);
        }
    }, [player?.id, player?.condition]);
    
    // initialStats를 useMemo로 변경하여 player.originalStats나 initialPlayer가 변경될 때마다 업데이트되도록 함
    const initialStats = useMemo<Record<CoreStat, number>>(() => {
        // player가 없으면 모든 CoreStat을 0으로 초기화
        if (!player) {
            const emptyStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                emptyStats[stat] = 0;
            });
            return emptyStats;
        }
        try {
            // player가 존재하는 경우에만 접근
            const p = player; // 로컬 변수로 안전하게 참조
            
            // 다음 경기로 넘어갔을 때 originalStats로 초기화된 값을 사용
            if (p.originalStats && typeof p.originalStats === 'object' && Object.keys(p.originalStats).length > 0) {
                return { ...p.originalStats };
            }
            // initialPlayer가 있으면 그것을 사용 (경기 시작 시점의 상태)
            if (initialPlayer?.stats && typeof initialPlayer.stats === 'object' && Object.keys(initialPlayer.stats).length > 0) {
                return { ...initialPlayer.stats };
            }
            // 그 외에는 현재 player.stats 사용
            if (p.stats && typeof p.stats === 'object' && Object.keys(p.stats).length > 0) {
                return { ...p.stats };
            }
            // 모든 것이 실패하면 기본값 반환 (모든 CoreStat을 0으로)
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[PlayerProfilePanel] Error in initialStats calculation:', error);
            }
            // 에러 발생 시 기본값 반환
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        }
    }, [player?.id, player?.originalStats, initialPlayer?.stats, player?.stats]);
    
    // initialStats가 변경되면 prevStatsRef 리셋 (새 경기 시작)
    useEffect(() => {
        if (!player) return;
        const currentKey = JSON.stringify(initialStats);
        if (initialStatsKeyRef.current !== currentKey) {
            initialStatsKeyRef.current = currentKey;
            prevStatsRef.current = { ...initialStats };
            setStatChanges({} as Record<CoreStat, number>);
        }
    }, [initialStats, player?.id]);
    
    // 컨디션 변화 감지 및 애니메이션 트리거
    useEffect(() => {
        // player가 null이거나 condition이 유효하지 않으면 early return
        if (!player || player.condition === undefined || player.condition === null) {
            // player가 없으면 previousCondition도 초기화
            if (!player) {
                setPreviousCondition(undefined);
            }
            return;
        }
        
        // player를 로컬 변수로 캡처하여 안전하게 참조
        const currentPlayer = player;
        const currentCondition = currentPlayer.condition;
        
        // currentCondition이 유효하지 않으면 early return
        if (currentCondition === undefined || currentCondition === null) {
            return;
        }
        
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        // 안전 체크: previousCondition이 유효하고 증가한 경우에만 애니메이션
        if (previousCondition !== undefined && 
            currentCondition !== 1000 && 
            previousCondition !== 1000 &&
            currentCondition > previousCondition) {
            const increase = currentCondition - previousCondition;
            if (increase > 0) {
                setConditionIncreaseAmount(increase);
                setShowConditionIncrease(true);
                timeoutId = setTimeout(() => {
                    setShowConditionIncrease(false);
                }, 2000);
            }
        }
        // currentCondition을 previousCondition으로 업데이트
        setPreviousCondition(currentCondition);
        
        // cleanup 함수
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [player?.id, player?.condition, previousCondition]);

    // 모든 hooks는 조건부 return 전에 선언되어야 함 (React hooks 규칙)
    // player가 null일 수 있으므로 안전하게 처리
    const fullUserData = useMemo(() => {
        if (!player || !player.id) return undefined;
        return allUsers.find(u => u.id === player.id);
    }, [allUsers, player?.id]);
    const leagueInfo = useMemo(() => {
        if (!player || player.league === undefined) return undefined;
        return LEAGUE_DATA.find(league => league.tier === player.league);
    }, [player?.league]);

    const cumulativeStats = useMemo(() => {
        const result = { wins: 0, losses: 0 };
        if (fullUserData?.stats) {
            Object.values(fullUserData.stats).forEach(s => {
                result.wins += s.wins;
                result.losses += s.losses;
            });
        }
        return result;
    }, [fullUserData]);

    // player가 null이 아니라는 것을 확인했지만, 안전성을 위해 옵셔널 체이닝 사용
    const isClickable = player ? (!player.id.startsWith('bot-') && player.id !== currentUserId) : false;
    const avatarUrl = useMemo(() => {
        if (!player || !player.avatarId) return undefined;
        return AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
    }, [player?.avatarId]);
    const borderUrl = useMemo(() => {
        if (!player || !player.borderId) return undefined;
        return BORDER_POOL.find(b => b.id === player.borderId)?.url;
    }, [player?.borderId]);
    const isCurrentUser = player ? (player.id === currentUserId) : false;
    
    // 컨디션 회복제 보유 개수 확인
    const potionCounts = useMemo(() => {
        const counts: Record<string, number> = { small: 0, medium: 0, large: 0 };
        if (fullUserData?.inventory) {
            fullUserData.inventory
                .filter(item => item.type === 'consumable' && item.name.startsWith('컨디션회복제'))
                .forEach(item => {
                    if (item.name === '컨디션회복제(소)') {
                        counts.small += item.quantity || 1;
                    } else if (item.name === '컨디션회복제(중)') {
                        counts.medium += item.quantity || 1;
                    } else if (item.name === '컨디션회복제(대)') {
                        counts.large += item.quantity || 1;
                    }
                });
        }
        return counts;
    }, [fullUserData?.inventory]);
    
    const totalPotionCount = potionCounts.small + potionCounts.medium + potionCounts.large;
    
    // 능력치 변화 감지 (경기 진행 중일 때만) - 모든 hooks는 조건부 return 전에 선언되어야 함
    useEffect(() => {
        // player와 player.stats가 없으면 early return
        if (!player || !player.stats || typeof player.stats !== 'object' || tournamentStatus !== 'round_in_progress') {
            // 경기가 진행 중이 아니면 statChanges 초기화
            if (tournamentStatus !== 'round_in_progress') {
                setStatChanges({} as Record<CoreStat, number>);
            }
            return;
        }
        
        // player를 로컬 변수로 캡처하여 안전하게 참조
        const currentPlayer = player;
        if (!currentPlayer || !currentPlayer.stats || typeof currentPlayer.stats !== 'object') {
            return;
        }
        
        // player.stats가 유효한 객체인지 확인
        const currentStats = currentPlayer.stats as Record<CoreStat, number>;
        if (!currentStats || typeof currentStats !== 'object') {
            return;
        }
        
        // 초기화: prevStatsRef가 비어있거나 initialStats가 변경되었으면 초기화
        const initialKey = JSON.stringify(initialStats);
        if (Object.keys(prevStatsRef.current).length === 0 || initialStatsKeyRef.current !== initialKey) {
            prevStatsRef.current = { ...initialStats };
            initialStatsKeyRef.current = initialKey;
            // 초기화 시에는 변화가 없으므로 statChanges도 초기화
            setStatChanges({} as Record<CoreStat, number>);
            // 초기화 후에는 현재 stats를 저장하고 종료
            prevStatsRef.current = { ...currentStats } as Record<CoreStat, number>;
            return;
        }
        
        // 각 능력치를 개별적으로 비교하여 변화 감지
        const changes: Record<CoreStat, number> = {} as Record<CoreStat, number>;
        let hasChanges = false;
        
        Object.values(CoreStat).forEach(stat => {
            const prev = prevStatsRef.current[stat] ?? initialStats[stat] ?? 0;
            const curr = currentStats[stat] ?? 0;
            const diff = curr - prev;
            // 변화가 있으면 감지 (0이 아닌 변화만)
            if (diff !== 0) {
                changes[stat] = diff;
                hasChanges = true;
            }
        });
        
        // 현재 stats를 깊은 복사로 저장 (다음 비교를 위해, 변화가 있든 없든 항상 업데이트)
        prevStatsRef.current = { ...currentStats } as Record<CoreStat, number>;
        
        // 변화가 있으면 애니메이션 트리거
        if (hasChanges) {
            // 개발 모드에서만 상세 로그 출력
            if (import.meta.env.DEV && Object.keys(changes).length > 0 && currentPlayer?.nickname) {
                console.log(`[PlayerProfilePanel] Stat changes detected for ${currentPlayer.nickname}:`, changes);
            }
            // 새로운 변화를 설정하여 애니메이션 트리거
            setStatChanges(changes);
            // 2초 후 애니메이션 초기화 (fade out)
            const timeoutId = setTimeout(() => {
                setStatChanges({} as Record<CoreStat, number>);
            }, 2000);
            // cleanup 함수에서 timeout 정리
            return () => {
                clearTimeout(timeoutId);
            };
        }
    }, [
        player?.id, // 플레이어가 변경되면 초기화
        player?.stats?.[CoreStat.CombatPower],
        player?.stats?.[CoreStat.ThinkingSpeed],
        player?.stats?.[CoreStat.Judgment],
        player?.stats?.[CoreStat.Calculation],
        player?.stats?.[CoreStat.Concentration],
        player?.stats?.[CoreStat.Stability],
        timeElapsed,
        tournamentStatus,
        initialStats
    ]);

    const isStatHighlighted = (stat: CoreStat) => {
        if (highlightPhase === 'none') return false;
        return KEY_STATS_BY_PHASE[highlightPhase].includes(stat);
    };
    
    // 경기 시작 전에는 홈 화면과 동일한 능력치 계산 (calculateTotalStats 사용)
    // 경기 중에는 player.stats를 사용 (컨디션으로 인한 변화 반영)
    const displayStats = useMemo(() => {
        // player가 없으면 기본값 반환
        if (!player) {
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        }
        
        // player를 로컬 변수로 캡처하여 안전하게 참조
        const currentPlayer = player;
        if (!currentPlayer) {
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        }
        
        if (tournamentStatus === 'round_in_progress') {
            // 경기 중에는 현재 능력치 사용 (컨디션 변화 반영)
            return currentPlayer.stats || initialStats;
        }

        if (currentPlayer.originalStats && typeof currentPlayer.originalStats === 'object') {
            // 토너먼트 생성 시점의 고정 능력치 사용
            return currentPlayer.originalStats;
        }

        if (fullUserData) {
            // 유저 정보가 있으면 최신 능력치 계산
            try {
                return calculateTotalStats(fullUserData);
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.error('[PlayerProfilePanel] Error calculating total stats:', error);
                }
                return currentPlayer.stats || initialStats;
            }
        }

        return currentPlayer.stats || initialStats;
    }, [player?.id, player?.stats, player?.originalStats, fullUserData, tournamentStatus, initialStats]);
    
    // 바둑능력 점수 계산 (모든 능력치의 합계, 정수로 반올림)
    const totalAbilityScore = useMemo(() => {
        try {
            if (!displayStats || typeof displayStats !== 'object') {
                return 0;
            }
            return Math.round(Object.values(displayStats).reduce((sum, stat) => sum + (stat || 0), 0));
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[PlayerProfilePanel] Error calculating total ability score:', error);
            }
            return 0;
        }
    }, [displayStats]);
    
    // 초반/중반/종반 능력치 계산 (서버의 calculatePower와 동일한 로직)
    // 각 능력치에 가중치를 곱한 후 합산
    const phaseStats = useMemo(() => {
        try {
            if (!displayStats || typeof displayStats !== 'object') {
                return { early: 0, mid: 0, end: 0 };
            }
            
            const calculatePhasePower = (phase: 'early' | 'mid' | 'end') => {
                const weights = STAT_WEIGHTS[phase];
                if (!weights || typeof weights !== 'object') {
                    return 0;
                }
                let power = 0;
                for (const stat in weights) {
                    const statKey = stat as CoreStat;
                    const weight = weights[statKey];
                    if (weight !== undefined && weight !== null) {
                        power += (displayStats[statKey] || 0) * weight;
                    }
                }
                return power;
            };
            
            return {
                early: Math.round(calculatePhasePower('early')),
                mid: Math.round(calculatePhasePower('mid')),
                end: Math.round(calculatePhasePower('end'))
            };
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[PlayerProfilePanel] Error calculating phase stats:', error);
            }
            return { early: 0, mid: 0, end: 0 };
        }
    }, [displayStats, player?.condition]);
    
    // player가 null이면 early return (이미 위에서 처리했지만 안전성을 위해 다시 확인)
    // 이 시점에서 player가 null이면 모든 hooks가 실행되었지만 안전하게 처리되었으므로 안전함
    if (!player) {
        return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500 backdrop-blur-sm">선수 대기 중...</div>;
    }
    
    // player가 확실히 존재하므로 안전하게 접근 가능
    // 하지만 경기 종료 시점에 player 객체의 속성이 예상치 못하게 변경될 수 있으므로
    // 모든 접근을 안전하게 처리
    const playerId = player?.id;
    const playerNickname = player?.nickname;

    /** 토너먼트 객체에 컨디션이 아직 안 실렸을 때(1000) 스냅샷·fallback으로 표시·회복제 판정 */
    const playerCondition = (() => {
        const c = player.condition;
        if (c !== undefined && c !== null && c !== 1000) {
            return c;
        }
        if (
            isCurrentUser &&
            conditionFallback !== undefined &&
            conditionFallback !== null &&
            conditionFallback !== 1000
        ) {
            return conditionFallback;
        }
        if (c !== undefined && c !== null) {
            return c;
        }
        return 1000;
    })();

    // 모든 필수 값이 유효한지 확인
    if (!playerId || !playerNickname) {
        return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500 backdrop-blur-sm">선수 정보를 불러올 수 없습니다.</div>;
    }

    /** Avatar.tsx 이미지 테두리 최대 배율(링 1.5)과 동일 — 슬롯을 맞춰 양쪽 패널 능력치 행이 수평으로 정렬되게 함 */
    const avatarSizePx = isMobile ? 40 : 32;
    const avatarSlotRem = (avatarSizePx / 16) * 1.5;
    const totalGames = cumulativeStats.wins + cumulativeStats.losses;
    const winRateLine =
        totalGames === 0
            ? '전적 없음'
            : `${((100 * cumulativeStats.wins) / totalGames).toFixed(1)}% (${cumulativeStats.wins}승 ${cumulativeStats.losses}패)`;
    const showConditionInStatus =
        tournamentStatus !== 'complete' &&
        tournamentStatus !== 'eliminated' &&
        (tournamentStatus === 'round_in_progress' ||
            tournamentStatus === 'bracket_ready' ||
            tournamentStatus === 'round_complete');

    if (championshipMobileCompareLayout && isMobile && (mobileRadarCompare || championshipMobileStackedNoRadar)) {
        const rowClass =
            'flex items-center justify-between gap-2 rounded-md border border-gray-600/60 bg-slate-900/55 px-2 py-1.5 text-[11px]';
        return (
            <div
                className={`flex flex-col gap-1 rounded-lg border border-gray-600/55 bg-slate-950/90 p-1.5 backdrop-blur-sm ${
                    championshipMobileStackedNoRadar ? 'w-full shrink-0' : 'h-full min-h-0'
                }`}
                style={championshipMobileStackedNoRadar ? undefined : { maxHeight: '100%', overflow: 'hidden' }}
            >
                <div
                    className={`flex w-full shrink-0 items-center gap-2 ${isClickable ? 'cursor-pointer hover:bg-slate-800/80' : ''}`}
                    onClick={isClickable ? () => onViewUser(playerId) : undefined}
                    title={isClickable ? `${playerNickname} 프로필 보기` : ''}
                >
                    {showLeague && leagueInfo && (
                        <img
                            key={`league-${playerId}-${leagueInfo.tier}`}
                            src={leagueInfo.icon}
                            alt={leagueInfo.name}
                            className="h-8 w-8 shrink-0 object-contain drop-shadow-lg"
                            loading="lazy"
                        />
                    )}
                    <div
                        className="flex shrink-0 items-center justify-center"
                        style={{
                            width: `${avatarSlotRem}rem`,
                            height: `${avatarSlotRem}rem`,
                            minWidth: `${avatarSlotRem}rem`,
                            minHeight: `${avatarSlotRem}rem`,
                        }}
                    >
                        <Avatar key={`avatar-${playerId}`} userId={playerId} userName={playerNickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarSizePx} />
                    </div>
                    <h4 className="min-w-0 flex-1 truncate text-sm font-bold">{playerNickname}</h4>
                </div>

                <div
                    className={`flex flex-col ${championshipMobileStackedNoRadar ? '' : 'min-h-0 flex-1 overflow-hidden'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="grid shrink-0 grid-cols-2 gap-0.5 border-b border-amber-500/25 px-0.5 pb-1 pt-0.5">
                        {(
                            [
                                ['status', '상태정보'],
                                ['abilities', '능력수치'],
                            ] as const
                        ).map(([key, label]) => {
                            const active = championshipMobileInfoTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setChampionshipMobileInfoTab(key)}
                                    className={`rounded-md border px-0.5 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                        active
                                            ? 'border-amber-400/70 bg-amber-900/40 text-amber-100'
                                            : 'border-gray-600/60 bg-black/25 text-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {showConditionInStatus ? (
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-600/50 px-1 py-1">
                            <span className="shrink-0 text-[10px] font-semibold text-gray-400">컨디션</span>
                            <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1.5">
                                <span
                                    className={`font-mono text-sm font-bold text-yellow-300 transition-all duration-300 ${
                                        showConditionIncrease ? 'scale-105 text-green-300' : ''
                                    }`}
                                >
                                    {playerCondition === 1000 ? '—' : playerCondition}
                                </span>
                                {showConditionIncrease && conditionIncreaseAmount > 0 && (
                                    <span
                                        className="pointer-events-none absolute -top-2.5 right-6 text-[10px] font-bold text-green-400"
                                        style={{
                                            animation: 'fadeUp 2s ease-out forwards',
                                            textShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
                                        }}
                                    >
                                        +{conditionIncreaseAmount}
                                    </span>
                                )}
                                {isCurrentUser && isUserMatch && canUseConditionPotion && onUseConditionPotion && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (playerCondition >= 100) return;
                                            onUseConditionPotion();
                                        }}
                                        disabled={playerCondition >= 100}
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-colors ${
                                            playerCondition >= 100
                                                ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                        title={
                                            playerCondition >= 100
                                                ? '컨디션이 이미 최대입니다'
                                                : '컨디션 회복제 사용 (1회차 경기 시작 전에만 가능)'
                                        }
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : null}

                    <div
                        className={`pt-1 ${championshipMobileStackedNoRadar ? 'overflow-x-hidden' : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'}`}
                        style={championshipMobileStackedNoRadar ? undefined : { WebkitOverflowScrolling: 'touch' }}
                    >
                        {championshipMobileInfoTab === 'status' ? (
                            <div className="flex flex-col gap-1">
                                <div className={rowClass}>
                                    <span className="shrink-0 font-semibold text-gray-300">바둑능력</span>
                                    <span className="truncate text-right font-mono font-bold text-blue-300 tabular-nums">{totalAbilityScore}</span>
                                </div>
                                <div className={rowClass}>
                                    <span className="shrink-0 font-semibold text-gray-300">승률</span>
                                    <span className="min-w-0 truncate text-right text-gray-100">{winRateLine}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 pb-1">
                                {Object.values(CoreStat).map((stat) => {
                                    try {
                                        const initialValue =
                                            tournamentStatus === 'round_in_progress'
                                                ? (initialPlayer?.stats?.[stat] ??
                                                      initialStats[stat] ??
                                                      player?.originalStats?.[stat] ??
                                                      displayStats?.[stat] ??
                                                      0)
                                                : (displayStats?.[stat] ?? 0);
                                        const currentValue = displayStats?.[stat] ?? 0;
                                        const change = tournamentStatus === 'round_in_progress' ? currentValue - initialValue : 0;
                                        return (
                                            <div
                                                key={stat}
                                                className={`flex items-baseline justify-between gap-2 rounded-md border border-gray-600/50 bg-slate-900/45 px-2 py-1 font-mono text-[10px] tabular-nums`}
                                            >
                                                <span
                                                    className={`min-w-0 truncate font-sans font-medium ${
                                                        isStatHighlighted(stat) ? 'font-bold text-yellow-400' : 'text-gray-400'
                                                    }`}
                                                >
                                                    {stat}
                                                </span>
                                                <div className="flex shrink-0 items-baseline gap-1">
                                                    <span className={isStatHighlighted(stat) ? 'font-bold text-yellow-300' : 'text-white'}>{currentValue}</span>
                                                    {tournamentStatus === 'round_in_progress' && change !== 0 ? (
                                                        <span className={change > 0 ? 'text-green-400' : 'text-red-400'}>
                                                            [{change > 0 ? '+' : ''}
                                                            {change}]
                                                        </span>
                                                    ) : null}
                                                    <span className="relative inline-block min-w-[2rem] text-right">
                                                        <span
                                                            className="whitespace-nowrap"
                                                            style={{
                                                                animation:
                                                                    statChanges[stat] !== undefined &&
                                                                    statChanges[stat] !== 0 &&
                                                                    tournamentStatus === 'round_in_progress'
                                                                        ? 'statChangeFade 2s ease-out forwards'
                                                                        : 'none',
                                                                opacity:
                                                                    statChanges[stat] !== undefined &&
                                                                    statChanges[stat] !== 0 &&
                                                                    tournamentStatus === 'round_in_progress'
                                                                        ? 1
                                                                        : 0,
                                                            }}
                                                        >
                                                            {statChanges[stat] !== undefined &&
                                                            statChanges[stat] !== 0 &&
                                                            tournamentStatus === 'round_in_progress' ? (
                                                                <span className={statChanges[stat] > 0 ? 'text-green-300' : 'text-red-300'}>
                                                                    ({statChanges[stat] > 0 ? '+' : ''}
                                                                    {statChanges[stat]})
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    } catch {
                                        return (
                                            <div key={stat} className={rowClass}>
                                                <span className="text-gray-400">{stat}</span>
                                                <span>-</span>
                                            </div>
                                        );
                                    }
                                })}
                                <div className="mt-0.5 flex items-center justify-between rounded-md border border-blue-700/45 bg-blue-900/25 px-2 py-1 text-[10px]">
                                    <span className="font-semibold text-gray-300">초반능력</span>
                                    <span className="font-bold text-blue-300 tabular-nums">{phaseStats?.early ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-md border border-purple-700/45 bg-purple-900/25 px-2 py-1 text-[10px]">
                                    <span className="font-semibold text-gray-300">중반능력</span>
                                    <span className="font-bold text-purple-300 tabular-nums">{phaseStats?.mid ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-md border border-orange-700/45 bg-orange-900/25 px-2 py-1 text-[10px]">
                                    <span className="font-semibold text-gray-300">종반능력</span>
                                    <span className="font-bold text-orange-300 tabular-nums">{phaseStats?.end ?? 0}</span>
                                </div>
                                {!championshipMobileStackedNoRadar && mobileRadarCompare ? (
                                    <div className="mt-1 flex w-full shrink-0 flex-col items-center">
                                        <div
                                            className="aspect-square w-full shrink-0"
                                            style={{ maxWidth: mobileRadarCompare.radarSize }}
                                        >
                                            <RadarChart
                                                datasets={mobileRadarCompare.datasets}
                                                maxStatValue={mobileRadarCompare.maxStatValue}
                                                size={mobileRadarCompare.radarSize}
                                            />
                                        </div>
                                        {radarLegendBelow ? <div className="mt-0.5 w-full max-w-full px-0.5">{radarLegendBelow}</div> : null}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex h-full min-h-0 flex-col gap-1 rounded-lg border border-gray-600/55 bg-slate-950/90 p-2 backdrop-blur-sm ${isClickable ? 'cursor-pointer hover:bg-slate-800/95' : ''}`} onClick={isClickable ? () => onViewUser(playerId) : undefined} title={isClickable ? `${playerNickname} 프로필 보기` : ''} style={{ maxHeight: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            <div className="flex items-center gap-2 w-full flex-shrink-0">
                {showLeague && leagueInfo && (
                    <img
                        key={`league-${playerId}-${leagueInfo.tier}`}
                        src={leagueInfo.icon}
                        alt={leagueInfo.name}
                        className="w-9 h-9 object-contain drop-shadow-lg flex-shrink-0"
                        loading="lazy"
                    />
                )}
                <div
                    className="flex flex-shrink-0 items-center justify-center"
                    style={{
                        width: `${avatarSlotRem}rem`,
                        height: `${avatarSlotRem}rem`,
                        minWidth: `${avatarSlotRem}rem`,
                        minHeight: `${avatarSlotRem}rem`,
                    }}
                >
                    <Avatar key={`avatar-${playerId}`} userId={playerId} userName={playerNickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarSizePx} />
                </div>
                 <div className="min-w-0 flex-1">
                    <div className={`flex flex-row items-center ${isMobile ? 'gap-1 flex-wrap' : 'gap-1.5'}`}>
                        <h4 className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} truncate`}>{playerNickname}</h4>
                        <span className={`${isMobile ? 'text-xs' : 'text-xs'} text-blue-300 font-semibold whitespace-nowrap`}>바둑능력: {totalAbilityScore}</span>
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 truncate`}>({cumulativeStats.wins}승 {cumulativeStats.losses}패)</p>
                 </div>
            </div>
            {/* 컨디션 표시 영역 - 항상 동일한 공간 유지 (대회 종료·탈락 후에는 숨김) */}
            <div className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} mt-0 relative flex items-center gap-2 w-full justify-center flex-shrink-0`} style={{ 
                visibility: showConditionInStatus ? 'visible' : 'hidden',
                height: showConditionInStatus ? 'auto' : '1.25rem',
                minHeight: '1.25rem'
            }}>
                <span className={isMobile ? 'text-xs' : 'text-sm'}>컨디션:</span> 
                <span className={`text-yellow-300 ${isMobile ? 'text-xs' : 'text-sm'} relative transition-all duration-300 ${
                    showConditionIncrease ? 'scale-125 text-green-300' : ''
                }`}>
                    {playerCondition === 1000 ? '-' : playerCondition}
                </span>
                {showConditionIncrease && conditionIncreaseAmount > 0 && (
                    <span className={`absolute ${isMobile ? 'text-sm' : 'text-base'} font-bold text-green-400 pointer-events-none whitespace-nowrap ${
                        isMobile ? 'top-[-14px]' : 'top-[-20px]'
                    }`} style={{
                        animation: 'fadeUp 2s ease-out forwards',
                        textShadow: '0 0 8px rgba(34, 197, 94, 0.8)'
                    }}>
                        +{conditionIncreaseAmount}
                    </span>
                )}
                {/* + 버튼 (현재 유저이고, 경기 전일 때만 표시, 자동 진행 대기 중이거나 경기 시작 후에는 비활성화) */}
                {isCurrentUser && isUserMatch && canUseConditionPotion && onUseConditionPotion && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (playerCondition >= 100) return;
                            onUseConditionPotion();
                        }}
                        disabled={playerCondition >= 100}
                        className={`ml-2 ${isMobile ? 'text-sm w-6 h-6' : 'text-base w-6 h-6'} ${
                            playerCondition >= 100 ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-green-600 hover:bg-green-700'
                        } text-white rounded-full transition-colors flex-shrink-0 flex items-center justify-center font-bold`}
                        title={playerCondition >= 100 ? "컨디션이 이미 최대입니다" : "컨디션 회복제 사용 (1회차 경기 시작 전에만 가능)"}
                    >
                        +
                    </button>
                )}
            </div>
            <div
                className={`w-full mt-0 border-t border-gray-600 pt-0.5 flex-shrink-0 overflow-hidden grid grid-cols-4 items-baseline font-mono tabular-nums ${
                    isMobile ? 'gap-x-1 gap-y-0.5 text-[10px]' : 'gap-x-3 gap-y-0.5 text-xs'
                }`}
            >
                {Object.values(CoreStat).map(stat => {
                    try {
                        // 초기값: initialPlayer가 있으면 그것을 사용, 없으면 initialStats 사용
                        // player가 null이 아니지만 안전성을 위해 옵셔널 체이닝 사용
                        const initialValue = tournamentStatus === 'round_in_progress' 
                            ? (initialPlayer?.stats?.[stat] ?? initialStats[stat] ?? player?.originalStats?.[stat] ?? displayStats?.[stat] ?? 0)
                            : (displayStats?.[stat] ?? 0);
                        const currentValue = displayStats?.[stat] ?? 0;
                        const change = tournamentStatus === 'round_in_progress' ? (currentValue - initialValue) : 0;

                        const labelEl = (
                            <span
                                className={`text-gray-400 truncate min-w-0 font-sans ${isStatHighlighted(stat) ? 'text-yellow-400 font-bold' : ''}`}
                            >
                                {stat}
                            </span>
                        );

                        const currentEl = (
                            <span
                                className={`text-right text-white whitespace-nowrap ${isStatHighlighted(stat) ? 'text-yellow-400 font-bold' : ''} ${
                                    isMobile ? 'min-w-[1.25rem]' : 'min-w-[40px] text-xs'
                                }`}
                            >
                                {currentValue}
                            </span>
                        );

                        const bracketEl = (
                            <span
                                className={`text-right font-bold whitespace-nowrap ${
                                    isMobile ? 'min-w-[1.75rem]' : 'ml-1 text-xs min-w-[45px]'
                                }`}
                            >
                                {tournamentStatus === 'round_in_progress' && change !== 0 ? (
                                    <span className={change > 0 ? 'text-green-400' : 'text-red-400'}>
                                        [{change > 0 ? '+' : ''}
                                        {change}]
                                    </span>
                                ) : isMobile ? (
                                    <span className="invisible" aria-hidden>
                                        [+0]
                                    </span>
                                ) : null}
                            </span>
                        );

                        const popEl = (
                            <span
                                className={`text-right font-bold relative ${isMobile ? 'h-[1.15em] min-w-[2rem]' : 'ml-1 min-w-[50px] text-sm'}`}
                            >
                                <span
                                    className="absolute right-0 top-0 whitespace-nowrap"
                                    style={{
                                        animation:
                                            statChanges[stat] !== undefined &&
                                            statChanges[stat] !== 0 &&
                                            tournamentStatus === 'round_in_progress'
                                                ? 'statChangeFade 2s ease-out forwards'
                                                : 'none',
                                        opacity:
                                            statChanges[stat] !== undefined &&
                                            statChanges[stat] !== 0 &&
                                            tournamentStatus === 'round_in_progress'
                                                ? 1
                                                : 0,
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {statChanges[stat] !== undefined &&
                                    statChanges[stat] !== 0 &&
                                    tournamentStatus === 'round_in_progress' ? (
                                        <span
                                            className={`${isMobile ? 'text-[10px]' : 'text-sm'} ${statChanges[stat] > 0 ? 'text-green-300' : 'text-red-300'}`}
                                        >
                                            ({statChanges[stat] > 0 ? '+' : ''}
                                            {statChanges[stat]})
                                        </span>
                                    ) : null}
                                </span>
                                <span className={`invisible whitespace-nowrap ${isMobile ? 'text-[10px]' : 'text-sm'}`} aria-hidden>
                                    (+99)
                                </span>
                            </span>
                        );

                        const numbersEl = (
                            <div
                                className={`flex min-w-0 justify-end items-baseline ${isMobile ? 'gap-0.5' : ''}`}
                            >
                                {currentEl}
                                {bracketEl}
                                {popEl}
                            </div>
                        );

                        return (
                            <React.Fragment key={stat}>
                                {labelEl}
                                {numbersEl}
                            </React.Fragment>
                        );
                    } catch (error) {
                        if (import.meta.env.DEV) {
                            console.error(`[PlayerProfilePanel] Error rendering stat ${stat}:`, error);
                        }
                        return (
                            <React.Fragment key={stat}>
                                <span className="text-gray-400 truncate min-w-0">{stat}</span>
                                <div className="flex min-w-0 justify-end items-baseline">
                                    <span className="font-mono text-white">-</span>
                                </div>
                            </React.Fragment>
                        );
                    }
                })}
            </div>
            {/* 초반/중반/종반 능력치 표시 */}
            {phaseStats && typeof phaseStats === 'object' && (
                <div className="w-full border-t border-gray-600 mt-0 pt-0.5 flex-shrink-0">
                    <div className={`grid grid-cols-3 gap-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                        <div className={`bg-blue-900/30 rounded ${isMobile ? 'px-0.5 py-0.5' : 'px-1 py-0.5'} text-center border border-blue-700/50`}>
                            <div className={`text-gray-300 font-semibold ${isMobile ? 'mb-0' : 'mb-0'}`}>초반능력</div>
                            <div className={`text-blue-300 font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>{phaseStats?.early ?? 0}</div>
                        </div>
                        <div className={`bg-purple-900/30 rounded ${isMobile ? 'px-0.5 py-0.5' : 'px-1 py-0.5'} text-center border border-purple-700/50`}>
                            <div className={`text-gray-300 font-semibold ${isMobile ? 'mb-0' : 'mb-0'}`}>중반능력</div>
                            <div className={`text-purple-300 font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>{phaseStats?.mid ?? 0}</div>
                        </div>
                        <div className={`bg-orange-900/30 rounded ${isMobile ? 'px-0.5 py-0.5' : 'px-1 py-0.5'} text-center border border-orange-700/50`}>
                            <div className={`text-gray-300 font-semibold ${isMobile ? 'mb-0' : 'mb-0'}`}>종반능력</div>
                            <div className={`text-orange-300 font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>{phaseStats?.end ?? 0}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/** 모바일 챔피언십: 대국자 정보 탭 — 선수별 카드 옆에 해당 선수 상태·능력(하단 액션은 부모 고정 바) */
const MobileChampionshipPlayersCompare: React.FC<{
    p1: PlayerForTournament | null;
    p2: PlayerForTournament | null;
    initialP1: PlayerForTournament | null;
    initialP2: PlayerForTournament | null;
    p1Stats: Record<string, number>;
    p2Stats: Record<string, number>;
    allUsers: User[];
    currentUserId: string;
    onViewUser: (userId: string) => void;
    tournamentStatus: string;
    canUseConditionPotion: boolean;
    onUseConditionPotion: () => void;
    conditionFallback?: number;
    isUserMatchP1: boolean;
    isUserMatchP2: boolean;
    highlightPhase: 'early' | 'mid' | 'end' | 'none';
}> = ({
    p1,
    p2,
    initialP1,
    initialP2,
    p1Stats,
    p2Stats,
    allUsers,
    currentUserId,
    onViewUser,
    tournamentStatus,
    canUseConditionPotion,
    onUseConditionPotion,
    conditionFallback,
    isUserMatchP1,
    isUserMatchP2,
    highlightPhase,
}) => {
    const [infoTab, setInfoTab] = useState<'status' | 'abilities'>('status');

    const fullU1 = useMemo(() => (p1?.id ? allUsers.find((u) => u.id === p1.id) : undefined), [allUsers, p1?.id]);
    const fullU2 = useMemo(() => (p2?.id ? allUsers.find((u) => u.id === p2.id) : undefined), [allUsers, p2?.id]);

    const winLine = (full: User | undefined) => {
        let wins = 0;
        let losses = 0;
        if (full?.stats) {
            Object.values(full.stats).forEach((s) => {
                wins += s.wins;
                losses += s.losses;
            });
        }
        const total = wins + losses;
        if (total === 0) return '전적 없음';
        return `${((100 * wins) / total).toFixed(1)}% (${wins}승 ${losses}패)`;
    };

    const totalAbility = (stats: Record<string, number>) =>
        Math.round(Object.values(stats).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0));

    const phasePowers = (stats: Record<string, number>) => {
        const calc = (phase: 'early' | 'mid' | 'end') => {
            const weights = STAT_WEIGHTS[phase];
            let power = 0;
            for (const k in weights) {
                const statKey = k as CoreStat;
                const w = weights[statKey];
                if (w != null) power += (stats[statKey] || 0) * w;
            }
            return Math.round(power);
        };
        return { early: calc('early'), mid: calc('mid'), end: calc('end') };
    };

    const showCondition =
        tournamentStatus !== 'complete' &&
        tournamentStatus !== 'eliminated' &&
        (tournamentStatus === 'round_in_progress' ||
            tournamentStatus === 'bracket_ready' ||
            tournamentStatus === 'round_complete');

    const resolveCondition = (player: PlayerForTournament | null, isCurrentUser: boolean) => {
        const c = player?.condition;
        if (c !== undefined && c !== null && c !== 1000) return c;
        if (isCurrentUser && conditionFallback !== undefined && conditionFallback !== null && conditionFallback !== 1000) {
            return conditionFallback;
        }
        if (c !== undefined && c !== null) return c;
        return 1000;
    };

    const statHighlighted = (stat: CoreStat) => highlightPhase !== 'none' && KEY_STATS_BY_PHASE[highlightPhase].includes(stat);

    /** 컨디션 수치 색상: 50 미만 빨강, 80 이상 초록, 그 사이 주황 계열 */
    const conditionValueClass = (cond: number) => {
        if (cond === 1000) return 'text-zinc-500';
        if (cond < 50) return 'text-red-400';
        if (cond >= 80) return 'text-green-400';
        return 'text-amber-200';
    };

    const avatarPx = 40;

    const ph1 = phasePowers(p1Stats as Record<CoreStat, number>);
    const ph2 = phasePowers(p2Stats as Record<CoreStat, number>);
    const sum1 = totalAbility(p1Stats);
    const sum2 = totalAbility(p2Stats);
    const sumDelta = sum2 - sum1;
    const sumDeltaCls = sumDelta > 0 ? 'text-green-400' : sumDelta < 0 ? 'text-red-400' : 'text-stone-500';

    const initSum1 = useMemo(() => {
        const raw = initialP1?.stats ?? p1?.originalStats;
        if (tournamentStatus === 'round_in_progress' && raw && typeof raw === 'object') {
            return totalAbility(raw as Record<string, number>);
        }
        return totalAbility(p1Stats);
    }, [tournamentStatus, initialP1?.stats, p1?.originalStats, p1Stats]);

    const initSum2 = useMemo(() => {
        const raw = initialP2?.stats ?? p2?.originalStats;
        if (tournamentStatus === 'round_in_progress' && raw && typeof raw === 'object') {
            return totalAbility(raw as Record<string, number>);
        }
        return totalAbility(p2Stats);
    }, [tournamentStatus, initialP2?.stats, p2?.originalStats, p2Stats]);

    const sumCh1 = tournamentStatus === 'round_in_progress' ? sum1 - initSum1 : 0;
    const sumCh2 = tournamentStatus === 'round_in_progress' ? sum2 - initSum2 : 0;

    const renderPlayerSideCard = (
        tone: 'cyan' | 'amber',
        title: string,
        player: PlayerForTournament | null,
        _isUserMatch: boolean,
    ) => {
        const borderTone = tone === 'cyan' ? 'border-cyan-500/35' : 'border-amber-500/35';
        const titleCls = tone === 'cyan' ? 'text-cyan-200' : 'text-amber-200';
        if (!player?.id || !player.nickname) {
            return (
                <div className={`flex min-h-0 flex-1 basis-0 flex-col rounded-md border ${borderTone} bg-black/25 p-0.5`}>
                    {title ? (
                        <div className={`mb-0.5 text-center text-[10px] font-semibold ${titleCls}`}>{title}</div>
                    ) : null}
                    <div className="flex min-h-[4.5rem] flex-1 items-center justify-center px-0.5 text-center text-[10px] text-stone-500">
                        선수 대기 중
                    </div>
                </div>
            );
        }
        const isCurrent = player.id === currentUserId;
        const clickable = !player.id.startsWith('bot-') && !isCurrent;
        const avatarUrl = AVATAR_POOL.find((a) => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find((b) => b.id === player.borderId)?.url;
        return (
            <div className={`flex min-h-0 flex-1 basis-0 flex-col rounded-md border ${borderTone} bg-black/25 p-0.5`}>
                {title ? <div className={`mb-0.5 text-center text-[10px] font-semibold ${titleCls}`}>{title}</div> : null}
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5">
                    <div
                        className={`mx-auto w-[88%] shrink-0 ${clickable ? 'cursor-pointer' : ''}`}
                        onClick={clickable ? () => onViewUser(player.id) : undefined}
                        title={clickable ? `${player.nickname} 프로필 보기` : ''}
                    >
                        <div className="flex justify-center">
                            <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarPx} />
                        </div>
                    </div>
                    <div className="w-full px-0.5 text-center leading-tight">
                        <div className={`text-[11px] font-semibold whitespace-normal break-words sm:text-xs ${titleCls}`}>
                            {player.nickname}
                        </div>
                        {isCurrent ? <div className="text-[10px] font-semibold text-amber-300/90">나</div> : null}
                    </div>
                </div>
            </div>
        );
    };

    const abilityHeaderAvatarPx = 36;
    const renderAbilityPlayerHeader = (player: PlayerForTournament | null, tone: 'cyan' | 'amber') => {
        const titleCls = tone === 'cyan' ? 'text-cyan-200' : 'text-amber-200';
        if (!player?.id || !player.nickname) {
            return (
                <div className="flex min-h-[3.75rem] flex-col items-center justify-center rounded-md bg-black/25 py-1">
                    <span className="text-[0.95em] text-stone-500">—</span>
                </div>
            );
        }
        const isCurrent = player.id === currentUserId;
        const clickable = !player.id.startsWith('bot-') && !isCurrent;
        const avatarUrl = AVATAR_POOL.find((a) => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find((b) => b.id === player.borderId)?.url;
        return (
            <div className="flex flex-col items-center gap-0.5 rounded-md bg-black/20 py-1">
                <div
                    className={clickable ? 'cursor-pointer' : ''}
                    onClick={clickable ? () => onViewUser(player.id) : undefined}
                    title={clickable ? `${player.nickname} 프로필 보기` : ''}
                >
                    <Avatar
                        userId={player.id}
                        userName={player.nickname}
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                        size={abilityHeaderAvatarPx}
                    />
                </div>
                <div className={`w-full px-0.5 text-center text-[0.95em] font-semibold leading-tight ${titleCls}`}>
                    <span className="line-clamp-2 break-words">{player.nickname}</span>
                </div>
                {isCurrent ? <span className="text-[0.82em] font-semibold text-amber-300/90">나</span> : null}
            </div>
        );
    };

    return (
        <section className="mb-0 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden overscroll-y-contain">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-panel-secondary/90 shadow-inner">
                <div className="grid shrink-0 grid-cols-2 gap-0.5 border-b border-cyan-500/20 px-1 py-1.5">
                    {(
                        [
                            ['status', '상태정보'],
                            ['abilities', '능력수치'],
                        ] as const
                    ).map(([key, label]) => {
                        const active = infoTab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setInfoTab(key)}
                                className={`rounded-md border px-0.5 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                    active
                                        ? 'border-amber-400/70 bg-amber-900/40 text-amber-100'
                                        : 'border-gray-600/60 bg-black/25 text-gray-300'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-0 flex-1 p-1">
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                        {infoTab === 'status' ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-1">
                                <div className="flex min-h-0 min-h-[5.5rem] flex-1 gap-1 overflow-hidden">
                                    <div className="flex w-[30%] max-w-[6.5rem] shrink-0 flex-col justify-start">
                                        {renderPlayerSideCard('cyan', '', p1, isUserMatchP1)}
                                    </div>
                                    <div
                                        className="flex min-h-0 flex-1 flex-col justify-center space-y-1.5 overflow-y-auto rounded-md bg-gray-900/50 p-1.5 text-center"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                    >
                                        {showCondition ? (
                                            <div className="rounded-md bg-black/25 px-2 py-2">
                                                <div className="text-xs font-semibold text-stone-400">컨디션</div>
                                                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                                                    <span
                                                        className={`font-mono text-lg font-bold tabular-nums ${conditionValueClass(
                                                            p1 ? resolveCondition(p1, p1.id === currentUserId) : 1000,
                                                        )}`}
                                                    >
                                                        {p1
                                                            ? resolveCondition(p1, p1.id === currentUserId) === 1000
                                                                ? '—'
                                                                : resolveCondition(p1, p1.id === currentUserId)
                                                            : '—'}
                                                    </span>
                                                    {canUseConditionPotion && p1?.id === currentUserId && isUserMatchP1 ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const c = p1 ? resolveCondition(p1, true) : 1000;
                                                                if (c >= 100) return;
                                                                onUseConditionPotion();
                                                            }}
                                                            disabled={!p1 || resolveCondition(p1, true) >= 100}
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                                                !p1 || resolveCondition(p1, true) >= 100
                                                                    ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                                    : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                            title={
                                                                p1 && resolveCondition(p1, true) >= 100
                                                                    ? '컨디션이 이미 최대입니다'
                                                                    : '컨디션 회복제 사용 (경기 시작 전)'
                                                            }
                                                        >
                                                            +
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">바둑능력</div>
                                            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 font-mono text-base font-bold tabular-nums text-cyan-200 sm:text-lg">
                                                <span>{sum1}</span>
                                                {sumCh1 !== 0 ? (
                                                    <span className={sumCh1 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                        ({sumCh1 > 0 ? '+' : ''}
                                                        {sumCh1})
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">승률 · 전적</div>
                                            <div className="mt-1 text-sm font-medium leading-snug text-cyan-100/95">
                                                {winLine(fullU1)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex min-h-0 min-h-[5.5rem] flex-1 gap-1 overflow-hidden">
                                    <div className="flex w-[30%] max-w-[6.5rem] shrink-0 flex-col justify-start">
                                        {renderPlayerSideCard('amber', '', p2, isUserMatchP2)}
                                    </div>
                                    <div
                                        className="flex min-h-0 flex-1 flex-col justify-center space-y-1.5 overflow-y-auto rounded-md bg-gray-900/50 p-1.5 text-center"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                    >
                                        {showCondition ? (
                                            <div className="rounded-md bg-black/25 px-2 py-2">
                                                <div className="text-xs font-semibold text-stone-400">컨디션</div>
                                                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                                                    <span
                                                        className={`font-mono text-lg font-bold tabular-nums ${conditionValueClass(
                                                            p2 ? resolveCondition(p2, p2.id === currentUserId) : 1000,
                                                        )}`}
                                                    >
                                                        {p2
                                                            ? resolveCondition(p2, p2.id === currentUserId) === 1000
                                                                ? '—'
                                                                : resolveCondition(p2, p2.id === currentUserId)
                                                            : '—'}
                                                    </span>
                                                    {canUseConditionPotion && p2?.id === currentUserId && isUserMatchP2 ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const c = p2 ? resolveCondition(p2, true) : 1000;
                                                                if (c >= 100) return;
                                                                onUseConditionPotion();
                                                            }}
                                                            disabled={!p2 || resolveCondition(p2, true) >= 100}
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                                                !p2 || resolveCondition(p2, true) >= 100
                                                                    ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                                    : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                            title={
                                                                p2 && resolveCondition(p2, true) >= 100
                                                                    ? '컨디션이 이미 최대입니다'
                                                                    : '컨디션 회복제 사용 (경기 시작 전)'
                                                            }
                                                        >
                                                            +
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">바둑능력</div>
                                            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 font-mono text-base font-bold tabular-nums text-amber-200 sm:text-lg">
                                                <span>{sum2}</span>
                                                {sumCh2 !== 0 ? (
                                                    <span className={sumCh2 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                        ({sumCh2 > 0 ? '+' : ''}
                                                        {sumCh2})
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">승률 · 전적</div>
                                            <div className="mt-1 text-sm font-medium leading-snug text-amber-100/95">
                                                {winLine(fullU2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                                <div
                                    className="min-h-0 flex-1 overflow-y-auto rounded-md bg-gray-900/50 p-0.5 sm:p-1"
                                    style={{
                                        WebkitOverflowScrolling: 'touch',
                                        fontSize: 'clamp(8.5px, min(2.75vw, 3.15vmin), 11.5px)',
                                    }}
                                >
                                    <div className="grid grid-cols-[minmax(2.5rem,22%)_minmax(0,1fr)_minmax(0,1fr)] gap-x-0.5 gap-y-0.5">
                                        <div className="min-h-[3.5em] min-w-0" aria-hidden />
                                        <div className="min-w-0">{renderAbilityPlayerHeader(p1, 'cyan')}</div>
                                        <div className="min-w-0 border-l border-gray-600/30 pl-0.5">
                                            {renderAbilityPlayerHeader(p2, 'amber')}
                                        </div>

                                        {Object.values(CoreStat).map((stat) => {
                                            const init1 =
                                                tournamentStatus === 'round_in_progress'
                                                    ? (initialP1?.stats?.[stat] ?? p1?.originalStats?.[stat] ?? p1Stats[stat] ?? 0)
                                                    : (p1Stats[stat] ?? 0);
                                            const init2 =
                                                tournamentStatus === 'round_in_progress'
                                                    ? (initialP2?.stats?.[stat] ?? p2?.originalStats?.[stat] ?? p2Stats[stat] ?? 0)
                                                    : (p2Stats[stat] ?? 0);
                                            const cur1 = p1Stats[stat] ?? 0;
                                            const cur2 = p2Stats[stat] ?? 0;
                                            const ch1 = tournamentStatus === 'round_in_progress' ? cur1 - init1 : 0;
                                            const ch2 = tournamentStatus === 'round_in_progress' ? cur2 - init2 : 0;
                                            const hi = statHighlighted(stat);
                                            const labelCls = hi ? 'font-bold text-yellow-300' : 'text-stone-300';
                                            return (
                                                <React.Fragment key={stat}>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[0.92em] font-semibold leading-snug ring-1 ring-inset ring-white/[0.06] ${labelCls}`}
                                                    >
                                                        {stat}
                                                    </div>
                                                    <div className="flex min-h-[1.55em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center font-mono text-[1.06em] tabular-nums leading-none text-cyan-100 ring-1 ring-inset ring-white/[0.06]">
                                                        <span>{cur1}</span>
                                                        {ch1 !== 0 ? (
                                                            <span className={ch1 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                                ({ch1 > 0 ? '+' : ''}
                                                                {ch1})
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex min-h-[1.55em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center font-mono text-[1.06em] tabular-nums leading-none text-amber-100 ring-1 ring-inset ring-white/[0.06]">
                                                        <span>{cur2}</span>
                                                        {ch2 !== 0 ? (
                                                            <span className={ch2 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                                ({ch2 > 0 ? '+' : ''}
                                                                {ch2})
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        {(['early', 'mid', 'end'] as const).map((phase, idx) => {
                                            const label = phase === 'early' ? '초반능력' : phase === 'mid' ? '중반능력' : '종반능력';
                                            const v1 = ph1[phase];
                                            const v2 = ph2[phase];
                                            const borderAccent =
                                                idx === 0
                                                    ? 'border-blue-700/40'
                                                    : idx === 1
                                                      ? 'border-purple-700/40'
                                                      : 'border-orange-700/40';
                                            return (
                                                <React.Fragment key={phase}>
                                                    <div className="flex min-h-[1.55em] items-center justify-center rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[0.92em] font-semibold text-stone-400 ring-1 ring-inset ring-white/[0.06]">
                                                        {label}
                                                    </div>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md border ${borderAccent} bg-black/20 px-0.5 py-[0.2em] text-center font-mono text-[0.98em] tabular-nums text-cyan-200`}
                                                    >
                                                        {v1}
                                                    </div>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md border ${borderAccent} bg-black/20 px-0.5 py-[0.2em] text-center font-mono text-[0.98em] tabular-nums text-amber-200`}
                                                    >
                                                        {v2}
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        <div className="flex min-h-[1.65em] items-center justify-center rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[0.92em] font-semibold text-stone-400 ring-1 ring-inset ring-white/[0.06]">
                                            종합 능력
                                        </div>
                                        <div className="flex min-h-[1.65em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[1.06em] font-bold tabular-nums text-cyan-100 ring-1 ring-inset ring-white/[0.06]">
                                            <span>{sum1}</span>
                                            {sumCh1 !== 0 ? (
                                                <span className={sumCh1 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                    ({sumCh1 > 0 ? '+' : ''}
                                                    {sumCh1})
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex min-h-[1.65em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[1.06em] font-bold tabular-nums text-amber-100 ring-1 ring-inset ring-white/[0.06]">
                                            <span>{sum2}</span>
                                            {sumCh2 !== 0 ? (
                                                <span className={sumCh2 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                    ({sumCh2 > 0 ? '+' : ''}
                                                    {sumCh2})
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                {sumDelta !== 0 ? (
                                    <div
                                        className="shrink-0 rounded-md bg-black/30 px-1 py-0.5 text-center font-bold"
                                        style={{ fontSize: 'clamp(9px, min(2.6vw, 3vmin), 11px)' }}
                                    >
                                        <span className="text-stone-500">차이 </span>
                                        <span className={sumDeltaCls}>
                                            {sumDelta > 0 ? '+' : ''}
                                            {sumDelta}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

const SimulationProgressBar: React.FC<{ timeElapsed: number; totalDuration: number; compact?: boolean }> = ({
    timeElapsed,
    totalDuration,
    compact = false,
}) => {
    const progress = (timeElapsed / totalDuration) * 100;
    // totalDuration에 맞게 동적으로 계산 (초반 15초, 중반 20초, 종반 15초 비율 유지)
    const EARLY_GAME_DURATION = 15;
    const MID_GAME_DURATION = 20;
    const END_GAME_DURATION = 15;
    const BASE_TOTAL = EARLY_GAME_DURATION + MID_GAME_DURATION + END_GAME_DURATION; // 50
    
    // totalDuration이 BASE_TOTAL과 다를 경우 비율로 스케일링
    const earlyDuration = (EARLY_GAME_DURATION / BASE_TOTAL) * totalDuration;
    const midDuration = (MID_GAME_DURATION / BASE_TOTAL) * totalDuration;
    const endDuration = (END_GAME_DURATION / BASE_TOTAL) * totalDuration;
    
    const earlyStage = Math.min(progress, (earlyDuration / totalDuration) * 100);
    const midStage = Math.min(Math.max(0, progress - (earlyDuration / totalDuration) * 100), (midDuration / totalDuration) * 100);
    const endStage = Math.min(Math.max(0, progress - ((earlyDuration + midDuration) / totalDuration) * 100), (endDuration / totalDuration) * 100);

    return (
        <div>
            <div
                className={`flex w-full overflow-hidden rounded-full border border-gray-600 bg-gray-900 ${compact ? 'h-1.5' : 'h-2'}`}
            >
                <div
                    className="h-full rounded-l-full bg-green-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${earlyStage}%` }}
                    title="초반전"
                />
                <div
                    className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${midStage}%` }}
                    title="중반전"
                />
                <div
                    className="h-full rounded-r-full bg-red-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${endStage}%` }}
                    title="끝내기"
                />
            </div>
            <div className={`flex text-gray-400 ${compact ? 'mt-0.5 text-[9px] leading-tight' : 'mt-1 text-xs'}`}>
                <div style={{ width: `${(earlyDuration / totalDuration) * 100}%` }}>초반</div>
                <div style={{ width: `${(midDuration / totalDuration) * 100}%` }} className="text-center">
                    중반
                </div>
                <div style={{ width: `${(endDuration / totalDuration) * 100}%` }} className="text-right">
                    종반
                </div>
            </div>
        </div>
    );
};

const ScoreGraph: React.FC<{ 
    p1Percent: number; 
    p2Percent: number; 
    p1Nickname?: string; 
    p2Nickname?: string; 
    p1Cumulative?: number; 
    p2Cumulative?: number; 
    p1Player?: PlayerForTournament | null; 
    p2Player?: PlayerForTournament | null; 
    lastScoreIncrement?: { 
        player1: { base: number; actual: number; isCritical: boolean } | null; 
        player2: { base: number; actual: number; isCritical: boolean } | null; 
    } | null;
    /** 모바일 실시간 중계 등 좁은 폭: 닉네임 줄바꿈·내부 점수 팝업 */
    compact?: boolean;
}> = ({
    p1Percent,
    p2Percent,
    p1Nickname,
    p2Nickname,
    p1Cumulative = 0,
    p2Cumulative = 0,
    p1Player,
    p2Player,
    lastScoreIncrement,
    compact = false,
}) => {
    const [p1Animations, setP1Animations] = useState<Array<{ value: number; isCritical: boolean; key: string }>>([]);
    const [p2Animations, setP2Animations] = useState<Array<{ value: number; isCritical: boolean; key: string }>>([]);
    const [p1DisplayScore, setP1DisplayScore] = useState(p1Cumulative);
    const [p2DisplayScore, setP2DisplayScore] = useState(p2Cumulative);
    const prevP1ValueRef = useRef<string | null>(null); // 중복 방지를 위한 키 저장
    const prevP2ValueRef = useRef<string | null>(null); // 중복 방지를 위한 키 저장
    const scoreBoardRef = useRef<HTMLDivElement>(null);
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const p1GraphProfileRef = useRef<HTMLDivElement>(null); // 그래프 내부의 프로필 참조
    const p2GraphProfileRef = useRef<HTMLDivElement>(null); // 그래프 내부의 프로필 참조
    const isFirstMountP1Ref = useRef(true);
    const isFirstMountP2Ref = useRef(true);
    const timeoutRefsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const p1AnimationFrameRef = useRef<number | null>(null);
    const p2AnimationFrameRef = useRef<number | null>(null);
    const p1AnimationStartRef = useRef<number | null>(null);
    const p2AnimationStartRef = useRef<number | null>(null);
    const lastAnimationTimeRef = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
    
    // 아바타 URL 계산
    const p1AvatarUrl = useMemo(() => p1Player ? AVATAR_POOL.find(a => a.id === p1Player.avatarId)?.url : undefined, [p1Player?.avatarId]);
    const p1BorderUrl = useMemo(() => p1Player ? BORDER_POOL.find(b => b.id === p1Player.borderId)?.url : undefined, [p1Player?.borderId]);
    const p2AvatarUrl = useMemo(() => p2Player ? AVATAR_POOL.find(a => a.id === p2Player.avatarId)?.url : undefined, [p2Player?.avatarId]);
    const p2BorderUrl = useMemo(() => p2Player ? BORDER_POOL.find(b => b.id === p2Player.borderId)?.url : undefined, [p2Player?.borderId]);
    
    // 점수 숫자 애니메이션 (스코어보드에 더해질 때)
    useEffect(() => {
        // 초기화 시에는 즉시 설정 (애니메이션 없이)
        if (p1AnimationStartRef.current === null) {
            p1AnimationStartRef.current = p1Cumulative;
            setP1DisplayScore(p1Cumulative);
            return;
        }
        
        const duration = 500; // 0.5초 동안 증가
        const startScore = p1AnimationStartRef.current;
        const targetScore = p1Cumulative;
        const difference = targetScore - startScore;
        
        if (Math.abs(difference) < 0.01) return;
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic 함수 사용
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + difference * easedProgress);
            
            setP1DisplayScore(currentScore);
            
            if (progress < 1) {
                p1AnimationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setP1DisplayScore(targetScore);
                p1AnimationStartRef.current = targetScore;
            }
        };
        
        // 기존 애니메이션 취소
        if (p1AnimationFrameRef.current !== null) {
            cancelAnimationFrame(p1AnimationFrameRef.current);
        }
        
        animate();
        
        return () => {
            if (p1AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p1AnimationFrameRef.current);
            }
        };
    }, [p1Cumulative]);
    
    useEffect(() => {
        // 초기화 시에는 즉시 설정 (애니메이션 없이)
        if (p2AnimationStartRef.current === null) {
            p2AnimationStartRef.current = p2Cumulative;
            setP2DisplayScore(p2Cumulative);
            return;
        }
        
        const duration = 500;
        const startScore = p2AnimationStartRef.current;
        const targetScore = p2Cumulative;
        const difference = targetScore - startScore;
        
        if (Math.abs(difference) < 0.01) return;
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + difference * easedProgress);
            
            setP2DisplayScore(currentScore);
            
            if (progress < 1) {
                p2AnimationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setP2DisplayScore(targetScore);
                p2AnimationStartRef.current = targetScore;
            }
        };
        
        // 기존 애니메이션 취소
        if (p2AnimationFrameRef.current !== null) {
            cancelAnimationFrame(p2AnimationFrameRef.current);
        }
        
        animate();
        
        return () => {
            if (p2AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p2AnimationFrameRef.current);
            }
        };
    }, [p2Cumulative]);
    
    // lastScoreIncrement가 변경되면 애니메이션 트리거 (스코어보드 양쪽에서 나타남)
    useEffect(() => {
        if (isFirstMountP1Ref.current) {
            // 첫 마운트 시에는 현재 값 저장만 하고 애니메이션 트리거하지 않음
            if (lastScoreIncrement?.player1) {
                prevP1ValueRef.current = `${lastScoreIncrement.player1.actual}-${lastScoreIncrement.player1.isCritical}`;
            }
            isFirstMountP1Ref.current = false;
            return;
        }
        
        // lastScoreIncrement.player1이 있고, 값이 0보다 크면 애니메이션 트리거
        // 1초마다 한 번만 트리거 (중복 방지)
        if (lastScoreIncrement?.player1 && lastScoreIncrement.player1.actual > 0) {
            const now = Date.now();
            const timeSinceLastAnimation = now - lastAnimationTimeRef.current.p1;
            
            // 1초 이상 경과했거나, 이전 값과 다르면 새로운 애니메이션 트리거
            const increment = lastScoreIncrement.player1.actual;
            const isCritical = lastScoreIncrement.player1.isCritical;
            const currentKey = `${increment}-${isCritical}`;
            
            if (timeSinceLastAnimation >= 1000 || prevP1ValueRef.current !== currentKey) {
                const animationKey = `p1-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                const newAnimation = { 
                    value: increment, // 증가량 표시
                    isCritical: isCritical,
                    key: animationKey
                };
                
                setP1Animations(prev => [...prev, newAnimation]);
                prevP1ValueRef.current = currentKey;
                lastAnimationTimeRef.current.p1 = now;
                
                // 1초 후 애니메이션 제거
                const timeoutId = setTimeout(() => {
                    setP1Animations(prev => prev.filter(anim => anim.key !== animationKey));
                }, 1000);
                
                timeoutRefsRef.current.push(timeoutId);
            }
        } else if (!lastScoreIncrement?.player1) {
            // 점수 증가가 없으면 prevP1ValueRef 초기화
            prevP1ValueRef.current = null;
        }
    }, [lastScoreIncrement?.player1]);
    
    // lastScoreIncrement가 변경되면 애니메이션 트리거 (스코어보드 양쪽에서 나타남)
    useEffect(() => {
        if (isFirstMountP2Ref.current) {
            // 첫 마운트 시에는 현재 값 저장만 하고 애니메이션 트리거하지 않음
            if (lastScoreIncrement?.player2) {
                prevP2ValueRef.current = `${lastScoreIncrement.player2.actual}-${lastScoreIncrement.player2.isCritical}`;
            }
            isFirstMountP2Ref.current = false;
            return;
        }
        
        // lastScoreIncrement.player2가 있고, 값이 0보다 크면 애니메이션 트리거
        // 1초마다 한 번만 트리거 (중복 방지)
        if (lastScoreIncrement?.player2 && lastScoreIncrement.player2.actual > 0) {
            const now = Date.now();
            const timeSinceLastAnimation = now - lastAnimationTimeRef.current.p2;
            
            // 1초 이상 경과했거나, 이전 값과 다르면 새로운 애니메이션 트리거
            const increment = lastScoreIncrement.player2.actual;
            const isCritical = lastScoreIncrement.player2.isCritical;
            const currentKey = `${increment}-${isCritical}`;
            
            if (timeSinceLastAnimation >= 1000 || prevP2ValueRef.current !== currentKey) {
                const animationKey = `p2-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                const newAnimation = { 
                    value: increment, // 증가량 표시
                    isCritical: isCritical,
                    key: animationKey
                };
                
                setP2Animations(prev => [...prev, newAnimation]);
                prevP2ValueRef.current = currentKey;
                lastAnimationTimeRef.current.p2 = now;
                
                // 1초 후 애니메이션 제거
                const timeoutId = setTimeout(() => {
                    setP2Animations(prev => prev.filter(anim => anim.key !== animationKey));
                }, 1000);
                
                timeoutRefsRef.current.push(timeoutId);
            }
        } else if (!lastScoreIncrement?.player2) {
            // 점수 증가가 없으면 prevP2ValueRef 초기화
            prevP2ValueRef.current = null;
        }
    }, [lastScoreIncrement?.player2]);
    
    // 컴포넌트 언마운트 시 모든 timeout 정리
    useEffect(() => {
        return () => {
            timeoutRefsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
            timeoutRefsRef.current = [];
            if (p1AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p1AnimationFrameRef.current);
            }
            if (p2AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p2AnimationFrameRef.current);
            }
        };
    }, []);
    
    // 공유 애니메이션 스타일 (한 번만 추가)
    useEffect(() => {
        if (typeof document !== 'undefined' && !document.getElementById('score-popup-animation')) {
            const style = document.createElement('style');
            style.id = 'score-popup-animation';
            style.textContent = `
                @keyframes scorePopUp {
                    0% {
                        opacity: 0;
                        transform: translateY(-50%) translateY(-10px) scale(0.8);
                    }
                    20% {
                        opacity: 1;
                        transform: translateY(-50%) translateY(0) scale(1.1);
                    }
                    80% {
                        opacity: 1;
                        transform: translateY(-50%) translateY(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-50%) translateY(-10px) scale(0.8);
                    }
                }
                @keyframes scorePopUpOverlay {
                    0% { opacity: 0; transform: scale(0.65); }
                    28% { opacity: 1; transform: scale(1.12); }
                    72% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.9); }
                }
                @keyframes scorePopUpSlide {
                    0% { opacity: 0; transform: translateX(-4px); }
                    18% { opacity: 1; transform: translateX(0); }
                    78% { opacity: 1; transform: translateX(0); }
                    100% { opacity: 0; transform: translateX(2px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        return () => {
            // 컴포넌트 언마운트 시 스타일 제거하지 않음 (다른 인스턴스에서 사용할 수 있음)
        };
    }, []);
    
    return (
        <div ref={graphContainerRef} className="relative w-full">
            {compact ? (
                <>
                    <div className="mb-1 flex items-start justify-between gap-1">
                        <div ref={p1GraphProfileRef} className="flex min-w-0 flex-1 items-start gap-1">
                            {p1Player && (
                                <>
                                    <Avatar
                                        userId={p1Player.id}
                                        userName={p1Nickname || ''}
                                        avatarUrl={p1AvatarUrl}
                                        borderUrl={p1BorderUrl}
                                        size={28}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[9px] text-gray-500">흑</div>
                                        <div
                                            className="break-words text-[10px] font-bold leading-snug text-gray-200 [overflow-wrap:anywhere]"
                                            title={p1Nickname}
                                        >
                                            {p1Nickname}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div ref={p2GraphProfileRef} className="flex min-w-0 flex-1 flex-row-reverse items-start gap-1">
                            {p2Player && (
                                <>
                                    <Avatar
                                        userId={p2Player.id}
                                        userName={p2Nickname || ''}
                                        avatarUrl={p2AvatarUrl}
                                        borderUrl={p2BorderUrl}
                                        size={28}
                                    />
                                    <div className="min-w-0 flex-1 text-right">
                                        <div className="text-[9px] text-gray-500">백</div>
                                        <div
                                            className="break-words text-right text-[10px] font-bold leading-snug text-gray-200 [overflow-wrap:anywhere]"
                                            title={p2Nickname}
                                        >
                                            {p2Nickname}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative z-10 mx-auto mb-1 w-full min-w-0 max-w-md px-0.5">
                        <div
                            ref={scoreBoardRef}
                            className="relative z-20 overflow-hidden rounded-lg border border-yellow-500/45 bg-gray-900/95 px-2 py-1 shadow-md shadow-yellow-500/15"
                        >
                            <div className="flex items-stretch justify-center gap-1.5">
                                <div
                                    className="flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center gap-0.5"
                                    data-player="p1"
                                >
                                    <div className="shrink-0 text-center">
                                        <div className="text-[9px] text-gray-400">흑</div>
                                        <div className="text-sm font-bold leading-tight text-white">
                                            <span className="tabular-nums">{Math.round(p1DisplayScore)}</span>
                                        </div>
                                        <div className="text-[9px] leading-none text-gray-500">({p1Percent.toFixed(1)}%)</div>
                                    </div>
                                    <div className="flex min-h-[2.25rem] min-w-[2.5rem] flex-col items-start justify-center gap-0.5">
                                        {p1Animations.map((animation) => (
                                            <span
                                                key={`p1-${animation.key}`}
                                                className={`pointer-events-none block font-black tabular-nums leading-none ${
                                                    animation.isCritical
                                                        ? 'text-[11px] text-yellow-300 drop-shadow-[0_0_5px_rgba(250,204,21,0.85)]'
                                                        : 'text-[10px] text-green-300'
                                                }`}
                                                style={{ animation: 'scorePopUpSlide 1s ease-out forwards' }}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-px shrink-0 self-stretch bg-gray-600" />
                                <div
                                    className="flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center gap-0.5"
                                    data-player="p2"
                                >
                                    <div className="shrink-0 text-center">
                                        <div className="text-[9px] text-gray-400">백</div>
                                        <div className="text-sm font-bold leading-tight text-white">
                                            <span className="tabular-nums">{Math.round(p2DisplayScore)}</span>
                                        </div>
                                        <div className="text-[9px] leading-none text-gray-500">({p2Percent.toFixed(1)}%)</div>
                                    </div>
                                    <div className="flex min-h-[2.25rem] min-w-[2.5rem] flex-col items-start justify-center gap-0.5">
                                        {p2Animations.map((animation) => (
                                            <span
                                                key={`p2-${animation.key}`}
                                                className={`pointer-events-none block font-black tabular-nums leading-none ${
                                                    animation.isCritical
                                                        ? 'text-[11px] text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]'
                                                        : 'text-[10px] text-orange-300'
                                                }`}
                                                style={{ animation: 'scorePopUpSlide 1s ease-out forwards' }}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex h-2 w-full overflow-hidden rounded-full border border-black/25 bg-gray-700">
                        <div className="bg-black transition-all duration-500 ease-in-out" style={{ width: `${p1Percent}%` }} />
                        <div className="bg-white transition-all duration-500 ease-in-out" style={{ width: `${p2Percent}%` }} />
                        <div
                            className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-gray-400/50"
                            title="중앙"
                        />
                    </div>
                </>
            ) : (
                <div className="relative mb-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div ref={p1GraphProfileRef} className="flex shrink-0 items-center gap-2">
                            {p1Player && (
                                <>
                                    <Avatar
                                        userId={p1Player.id}
                                        userName={p1Nickname || ''}
                                        avatarUrl={p1AvatarUrl}
                                        borderUrl={p1BorderUrl}
                                        size={40}
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-bold text-gray-200">흑: {p1Nickname}</div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="relative mx-2 flex min-w-0 flex-1 items-center justify-center" style={{ minHeight: '60px' }}>
                            <div
                                ref={scoreBoardRef}
                                className="relative z-20 rounded-lg border-2 border-yellow-500/50 bg-gray-900/95 px-4 py-2 shadow-lg shadow-yellow-500/30"
                                style={{ overflow: 'visible' }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[70px] text-center" data-player="p1">
                                        <div className="mb-0.5 text-xs text-gray-400">흑</div>
                                        <div className="text-lg font-bold text-white">
                                            <span className="tabular-nums">{Math.round(p1DisplayScore)}</span>
                                            <span className="ml-1 text-xs text-gray-400">({p1Percent.toFixed(1)}%)</span>
                                        </div>
                                    </div>

                                    <div className="h-8 w-px bg-gray-600" />

                                    <div className="min-w-[70px] text-center" data-player="p2">
                                        <div className="mb-0.5 text-xs text-gray-400">백</div>
                                        <div className="text-lg font-bold text-white">
                                            <span className="tabular-nums">{Math.round(p2DisplayScore)}</span>
                                            <span className="ml-1 text-xs text-gray-400">({p2Percent.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                </div>

                                {p1Animations.map((animation) => (
                                    <div
                                        key={`p1-${animation.key}`}
                                        className="pointer-events-none absolute z-[15] whitespace-nowrap"
                                        style={{
                                            right: '100%',
                                            marginRight: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            animation: 'scorePopUp 1s ease-out forwards',
                                        }}
                                    >
                                        <div
                                            className={`rounded-lg px-2 py-1 ${
                                                animation.isCritical
                                                    ? 'border-2 border-yellow-400 bg-black shadow-lg shadow-yellow-500/50'
                                                    : 'border-2 border-gray-600 bg-black shadow-lg'
                                            }`}
                                        >
                                            <span
                                                className={`text-sm font-bold ${
                                                    animation.isCritical ? 'animate-pulse text-yellow-300' : 'text-white'
                                                }`}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {p2Animations.map((animation) => (
                                    <div
                                        key={`p2-${animation.key}`}
                                        className="pointer-events-none absolute z-[15] whitespace-nowrap"
                                        style={{
                                            left: '100%',
                                            marginLeft: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            animation: 'scorePopUp 1s ease-out forwards',
                                        }}
                                    >
                                        <div
                                            className={`rounded-lg px-2 py-1 ${
                                                animation.isCritical
                                                    ? 'border-2 border-red-500 bg-white shadow-lg shadow-red-500/50'
                                                    : 'border-2 border-gray-400 bg-white shadow-lg'
                                            }`}
                                        >
                                            <span
                                                className={`text-sm font-bold ${
                                                    animation.isCritical ? 'animate-pulse text-red-600' : 'text-black'
                                                }`}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div ref={p2GraphProfileRef} className="flex shrink-0 items-center gap-2">
                            {p2Player && (
                                <>
                                    <div className="min-w-0 text-right">
                                        <div className="truncate text-xs font-bold text-gray-200">백: {p2Nickname}</div>
                                    </div>
                                    <Avatar
                                        userId={p2Player.id}
                                        userName={p2Nickname || ''}
                                        avatarUrl={p2AvatarUrl}
                                        borderUrl={p2BorderUrl}
                                        size={40}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative flex h-3 w-full overflow-hidden rounded-full border-2 border-black/30 bg-gray-700">
                        <div className="bg-black transition-all duration-500 ease-in-out" style={{ width: `${p1Percent}%` }} />
                        <div className="bg-white transition-all duration-500 ease-in-out" style={{ width: `${p2Percent}%` }} />
                        <div
                            className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-gray-400/50"
                            title="중앙"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const parseCommentary = (commentaryLine: CommentaryLine) => {
    const { text, isRandomEvent } = commentaryLine;
    
    // 초반전/중반전/종반전 시작 메시지에만 색상 적용 (정확한 텍스트 매칭)
    let phaseColorClass = '';
    if (text === '초반전이 시작되었습니다. (필요능력치: 전투력, 사고속도, 집중력)') {
        phaseColorClass = 'text-green-400'; // 초록색
    } else if (text === '중반전이 시작되었습니다. (필요능력치: 전투력, 판단력, 집중력, 안정감)') {
        phaseColorClass = 'text-yellow-400'; // 노란색
    } else if (text === '종반전이 시작되었습니다. (필요능력치: 계산력, 안정감, 집중력)') {
        phaseColorClass = 'text-red-400'; // 빨간색
    }
    
    if (text.startsWith('최종 결과 발표!') || text.startsWith('[최종결과]')) {
        return <strong className="text-yellow-400">{text}</strong>;
    }
    
    const leadRegex = /(\d+\.\d+집|\d+\.5집)/g;
    const parts = text.split(leadRegex);
    
    // phase 시작 메시지에만 색상 적용, 그 외는 기본 색상
    const baseColorClass = phaseColorClass || (isRandomEvent ? 'text-cyan-400' : '');
    
    return (
        <span className={baseColorClass}>
            {parts.map((part, index) => 
                leadRegex.test(part) ? (
                    <strong key={index} className="text-yellow-400">{part}</strong>
                ) : (
                    <span key={index}>{part}</span>
                )
            )}
        </span>
    );
};

const CommentaryPanel: React.FC<{
    commentary: CommentaryLine[];
    isSimulating: boolean;
    footerSlot?: React.ReactNode;
    compact?: boolean;
}> = ({ commentary, isSimulating, footerSlot, compact = false }) => {
    const commentaryContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (commentaryContainerRef.current) {
            commentaryContainerRef.current.scrollTop = commentaryContainerRef.current.scrollHeight;
        }
    }, [commentary]);

    return (
        <div className="flex h-full min-h-0 flex-col" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h4
                className={`flex-shrink-0 text-center font-bold text-gray-400 ${
                    compact ? 'mb-0.5 py-0 text-[11px] leading-tight' : 'mb-2 py-1 text-sm'
                }`}
            >
                실시간 중계
                {isSimulating && (
                    <span className={`animate-pulse text-yellow-400 ${compact ? 'ml-1 text-[10px]' : 'ml-2'}`}>
                        경기 진행 중...
                    </span>
                )}
            </h4>
            <div className={`flex min-h-0 flex-1 flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
                <div
                    ref={commentaryContainerRef}
                    className={`min-h-0 flex-1 overflow-y-auto rounded-md border border-gray-700/45 bg-slate-950/88 text-gray-300 backdrop-blur-sm ${
                        compact ? 'space-y-1 p-1.5 text-[11px] leading-snug' : 'space-y-2 p-2 text-sm'
                    }`}
                    style={{
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        flex: '1 1 0',
                        minHeight: 0,
                    }}
                >
                    {commentary.length > 0 ? (
                        commentary.map((line, index) => (
                            <p key={index} className="animate-fade-in break-words">
                                {parseCommentary(line)}
                            </p>
                        ))
                    ) : (
                        <p
                            className={`flex h-full items-center justify-center text-center text-gray-500 ${
                                compact ? 'text-[11px]' : ''
                            }`}
                        >
                            경기 시작 대기 중...
                        </p>
                    )}
                </div>
                {footerSlot ? (
                    <div
                        className={`flex w-full shrink-0 flex-col items-center justify-center rounded-md border border-amber-500/20 bg-slate-950/70 ${
                            compact ? 'gap-1 px-1.5 py-1' : 'gap-2 px-2 py-2.5 sm:py-2'
                        }`}
                    >
                        {footerSlot}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const FinalRewardPanel: React.FC<{
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    onCompleteDungeon?: () => void;
    dungeonRewardAlreadyRequested?: boolean;
    onDungeonRewardRequested?: () => void;
    onOpenRewardHistory?: () => void;
    /** PC 우측 사이드바: 내부 스크롤. 모바일 보상정보 탭: 본문 전체를 탭에서 스크롤(PC와 동일 내용 노출) */
    layoutVariant?: 'sidebar' | 'mobileTab';
    /** 모바일 경기장: 보상·진행 버튼을 화면 하단 고정 바로만 표시 */
    suppressBottomActions?: boolean;
}> = ({
    tournamentState,
    currentUser,
    onAction,
    onCompleteDungeon,
    dungeonRewardAlreadyRequested,
    onDungeonRewardRequested,
    onOpenRewardHistory,
    layoutVariant = 'sidebar',
    suppressBottomActions = false,
}) => {
    const isMobileTabLayout = layoutVariant === 'mobileTab';
    const { type, rounds } = tournamentState;
    
    // 모든 경기가 완료되었는지 확인
    const allMatchesFinished = rounds.every(r => r.matches.every(m => m.isFinished));
    
    // 토너먼트가 완전히 완료되었는지 확인 (status가 complete이거나, 모든 경기가 완료된 경우)
    const isTournamentFullyComplete = tournamentState.status === 'complete' || (allMatchesFinished && tournamentState.status !== 'round_in_progress');
    const isUserEliminated = tournamentState.status === 'eliminated';
    const isInProgress = tournamentState.status === 'round_in_progress' || tournamentState.status === 'bracket_ready';
    const isRoundComplete = tournamentState.status === 'round_complete';
    const definition = TOURNAMENT_DEFINITIONS[type];
    
    // 현재 순위 계산 (경기 진행 중에도 업데이트)
    let userRank = -1;

    if (type === 'neighborhood') {
        const wins: Record<string, number> = {};
        tournamentState.players.forEach(p => { wins[p.id] = 0; });

        rounds.forEach(round => {
            round.matches.forEach(m => {
                if (m.winner) {
                    wins[m.winner.id] = (wins[m.winner.id] || 0) + 1;
                }
            });
        });

        const sortedPlayers = [...tournamentState.players].sort((a, b) => wins[b.id] - wins[a.id]);
        
        let currentRank = -1;
        for (let i = 0; i < sortedPlayers.length; i++) {
            if (i === 0) {
                currentRank = 1;
            } else {
                if (wins[sortedPlayers[i].id] < wins[sortedPlayers[i-1].id]) {
                    currentRank = i + 1;
                }
            }
            if (sortedPlayers[i].id === currentUser.id) {
                userRank = currentRank;
                break;
            }
        }
    } else {
        const totalRounds = rounds.length;
        let lostInRound = -1;
        
        for (let i = 0; i < totalRounds; i++) {
            const round = rounds[i];
            const userMatch = round.matches.find(m => m.isUserMatch);
            if (userMatch && userMatch.winner?.id !== currentUser.id) {
                lostInRound = i;
                break;
            }
        }

        if (lostInRound === -1) {
            userRank = 1; // Winner
        } else {
            const playersInLostRound = definition.players / Math.pow(2, lostInRound);
            if (totalRounds === 3 && lostInRound === 1) { // 8-player, lost in semis
                 const thirdPlaceMatch = rounds.find(r => r.name === "3,4위전");
                 if (thirdPlaceMatch) {
                     const userWasIn3rdPlaceMatch = thirdPlaceMatch.matches.some(m => m.isUserMatch);
                     if (userWasIn3rdPlaceMatch) {
                         const won3rdPlace = thirdPlaceMatch.matches.some(m => m.isUserMatch && m.winner?.id === currentUser.id);
                         userRank = won3rdPlace ? 3 : 4;
                     } else {
                         userRank = 4;
                     }
                 } else {
                     userRank = 4;
                 }
            } else {
                 userRank = playersInLostRound;
            }
        }
    }
    
    // 동네바둑리그: 누적 골드 표시 (경기 진행 중에도 표시)
    const accumulatedGold = tournamentState.type === 'neighborhood' ? (tournamentState.accumulatedGold || 0) : 0;
    
    // 전국바둑대회: 누적 재료 표시 (경기 진행 중에도 표시)
    const accumulatedMaterials = tournamentState.type === 'national' ? (tournamentState.accumulatedMaterials || {}) : {};
    
    // 월드챔피언십: 누적 장비상자(레거시) 또는 경기당 장비 드롭 개수 (서버는 accumulatedEquipmentDrops만 채움)
    const accumulatedEquipmentBoxes = tournamentState.type === 'world' ? (tournamentState.accumulatedEquipmentBoxes || {}) : {};
    const accumulatedEquipmentDropsCount = tournamentState.type === 'world' ? (tournamentState.accumulatedEquipmentDrops?.length ?? 0) : 0;
    const accumulatedEquipmentItems = tournamentState.type === 'world' ? (tournamentState.accumulatedEquipmentItems || []) : [];
    const claimedRewardSummary = tournamentState.claimedRewardSummary || null;
    
    // 랭킹 점수 계산 (현재 순위 기준, 경기 진행 중에도 표시)
    const scoreRewardInfo = TOURNAMENT_SCORE_REWARDS[type];
    let scoreRewardKey: number = 9; // 기본값 (최하위)
    if (userRank > 0) {
        if (type === 'neighborhood') {
            scoreRewardKey = userRank;
        } else if (type === 'national') {
            scoreRewardKey = userRank <= 4 ? userRank : 5;
        } else { // world
            if (userRank <= 4) scoreRewardKey = userRank;
            else if (userRank <= 8) scoreRewardKey = 5;
            else scoreRewardKey = 9;
        }
    }
    const scoreReward = scoreRewardInfo?.[scoreRewardKey] || 0;
    
    // 챔피언십 던전: currentStageAttempt가 JSON/구버전에서 빠져도 제목·dungeonProgress로 단계 복원 (동네/전국에서 보상 버튼 0단계로 숨겨지던 문제 방지)
    const effectiveStageAttempt = resolveDungeonStageAttempt(tournamentState, currentUser, type);
    const isDungeonMode = effectiveStageAttempt >= 1;
    
    const rewardClaimedKey = `${type}RewardClaimed` as keyof User;
    const isClaimed = !!currentUser[rewardClaimedKey];
    const treatAsClaimed = isClaimed || !!dungeonRewardAlreadyRequested;
    const canClaimReward = (isTournamentFullyComplete || isUserEliminated) && !isClaimed && !dungeonRewardAlreadyRequested;
    
    // 중복 클릭 방지를 위한 상태
    const [isClaiming, setIsClaiming] = useState(false);

    const handleClaim = () => {
        // 중복 클릭 방지: 이미 클릭 중이거나 이미 수령했으면 무시
        if (isClaiming || !canClaimReward) {
            return;
        }
        
        setIsClaiming(true);
        audioService.claimReward();
        
        // 챔피언십은 항상 던전 모드 → 단계 보상 수령. onCompleteDungeon이 있으면 서버 호출 후 모달이 뜬 뒤에 부모에서 onDungeonRewardRequested 호출함 (클릭 시 즉시 호출하면 보상 완료로 바뀌어 모달이 안 보임)
        if (effectiveStageAttempt) {
            if (onCompleteDungeon) {
                onCompleteDungeon();
            } else {
                onDungeonRewardRequested?.();
                onAction({
                    type: 'COMPLETE_DUNGEON_STAGE',
                    payload: { dungeonType: type, stage: effectiveStageAttempt },
                });
            }
        }
        
        // 서버 응답 후 상태가 업데이트되면 isClaiming이 자동으로 false가 됨
        // 하지만 안전을 위해 일정 시간 후에도 false로 설정
        setTimeout(() => {
            setIsClaiming(false);
        }, 3000);
    };
    
    // isClaimed가 변경되면 isClaiming도 false로 설정
    useEffect(() => {
        if (isClaimed) {
            setIsClaiming(false);
        }
    }, [isClaimed]);
    
    return (
        <div
            className={`flex min-h-0 flex-col ${isMobileTabLayout ? 'h-auto w-full' : 'h-full'}`}
            style={
                isMobileTabLayout
                    ? { display: 'flex', flexDirection: 'column', minHeight: 0 }
                    : { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }
            }
        >
            <h4 className="flex-shrink-0 whitespace-nowrap py-0.5 text-center text-sm font-bold text-gray-300 mb-1.5">획득 보상</h4>
            <div
                className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-gray-700/45 bg-slate-950/88 p-1.5 backdrop-blur-sm md:p-2 ${
                    isMobileTabLayout ? '' : 'min-h-0 flex-1 overflow-y-auto'
                }`}
                style={
                    isMobileTabLayout
                        ? { WebkitOverflowScrolling: 'touch' as const }
                        : {
                              overflowY: 'auto',
                              WebkitOverflowScrolling: 'touch',
                              flex: '1 1 0',
                              minHeight: 0,
                              maxHeight: '100%',
                          }
                }
            >
            {/* 기본 보상 (경기당) 범위 - 던전 모드 입장 시 1경기 끝날 때마다 받는 보상의 범위를 미리 표시 */}
            {effectiveStageAttempt && (() => {
                const stage = effectiveStageAttempt;
                if (type === 'neighborhood') {
                    const range = getDungeonBasicRewardRangeGold(stage);
                    return (
                        <div className="mb-1.5 flex w-full flex-col items-center justify-center gap-2 text-center rounded-lg border border-amber-700/50 bg-amber-900/25 px-1.5 py-1.5">
                            <MysteryNeighborhoodGoldThumb />
                            <div className="min-w-0">
                                <div className="text-[10px] font-semibold text-amber-200/95">기본 보상 (경기당)</div>
                                <div className="mt-0.5 text-[10px] leading-snug text-amber-100/85">
                                    <div>승리: {range.win.min.toLocaleString()}~{range.win.max.toLocaleString()} 골드</div>
                                    <div>패배: {range.loss.min.toLocaleString()}~{range.loss.max.toLocaleString()} 골드</div>
                                </div>
                            </div>
                        </div>
                    );
                }
                if (type === 'national') {
                    const config = DUNGEON_STAGE_MATERIAL_ROLLS[stage] || DUNGEON_STAGE_MATERIAL_ROLLS[1];
                    const winParts = config.win.map(r => `${r.materialName} ${r.min}~${r.max}개`).join(' · ');
                    const lossRolls = config.loss ?? config.win;
                    const lossParts = lossRolls.map(r => `${r.materialName} ${r.min}~${r.max}개`).join(' · ');
                    return (
                        <div className="mb-1.5 flex w-full flex-col items-center justify-center gap-2 text-center rounded-lg border border-blue-700/50 bg-blue-900/25 px-1.5 py-1.5">
                            <MysteryBaseRewardBoxThumb accent="blue" />
                            <div className="min-w-0">
                                <div className="text-[10px] font-semibold text-blue-200/95">기본 보상 (경기당)</div>
                                <div className="mt-0.5 text-[10px] leading-snug text-blue-100/85">
                                    <div>승리: {winParts} (랜덤)</div>
                                    <div>패배: {lossParts} (랜덤)</div>
                                </div>
                            </div>
                        </div>
                    );
                }
                if (type === 'world') {
                    const gradeLine = worldDungeonEquipmentGradeRangeText(stage);
                    return (
                        <div className="mb-1.5 flex w-full flex-col items-center justify-center gap-2 text-center rounded-lg border border-purple-700/50 bg-purple-900/25 px-1.5 py-1.5">
                            <MysteryBaseRewardBoxThumb accent="purple" />
                            <div className="min-w-0">
                                <div className="text-[10px] font-semibold text-purple-200/95">기본 보상 (경기당, 장비 1개)</div>
                                <div className="mt-0.5 text-[10px] leading-snug text-purple-100/85">
                                    <div>{gradeLine}</div>
                                </div>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}
            {/* 수령 완료 메시지 - 경기 종료 후에만 표시 */}
            {(isTournamentFullyComplete || isUserEliminated) && treatAsClaimed && (
                <div className="mb-1 w-full px-1.5 py-1 bg-green-900/30 rounded-lg border border-green-700/50">
                    <p className="text-xs text-green-400 text-center font-semibold">✓ 보상을 수령했습니다.</p>
                </div>
            )}
            
            {/* 누적 골드 (동네바둑리그) - 경기마다 따로 더미 표시하여 여러 번 받은 것처럼 표시 */}
            {accumulatedGold > 0 && (
                <div className={`mb-1 flex w-full flex-wrap justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                    {(tournamentState.matchGoldRewards && tournamentState.matchGoldRewards.length > 0
                        ? tournamentState.matchGoldRewards
                        : [accumulatedGold]
                    ).map((goldAmount: number, idx: number) => (
                        <div key={idx} className="relative w-11 h-11 rounded-lg border-2 border-yellow-600/70 bg-yellow-900/40 flex items-center justify-center overflow-hidden" title={`경기 ${idx + 1} 보상`}>
                            <img src="/images/icon/Gold.png" alt="골드" className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                            <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-yellow-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                {goldAmount.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            
            {/* 누적 재료 (전국바둑대회): 8강/4강/결승(또는 3·4위전) 각각 더미로 표시 */}
            {(tournamentState.type === 'national' && tournamentState.matchMaterialRewards && tournamentState.matchMaterialRewards.length > 0 ? (
                <div className={`mb-1 flex w-full flex-wrap justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                    {tournamentState.matchMaterialRewards.map((roundMaterials: Record<string, number>, idx: number) => {
                        const roundLabel = ['8강', '4강', '결승 / 3·4위전'][idx] ?? `경기 ${idx + 1}`;
                        return (
                            <div key={idx} className="flex flex-wrap items-center justify-center gap-1">
                                {Object.entries(roundMaterials).map(([materialName, quantity]) => {
                                    const materialTemplate = MATERIAL_ITEMS[materialName];
                                    const imageUrl = materialTemplate?.image || '';
                                    return (
                                        <div key={`${idx}-${materialName}`} className="relative w-11 h-11 rounded-lg border-2 border-blue-600/70 bg-blue-900/40 flex items-center justify-center overflow-hidden" title={`${roundLabel} 보상`}>
                                            <img src={imageUrl} alt={materialName} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                            <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-blue-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                                {quantity}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            ) : Object.keys(accumulatedMaterials).length > 0 && (
                <div className={`mb-1 flex w-full flex-wrap justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                    {Object.entries(accumulatedMaterials).map(([materialName, quantity]) => {
                        const materialTemplate = MATERIAL_ITEMS[materialName];
                        const imageUrl = materialTemplate?.image || '';
                        return (
                            <div key={materialName} className="relative w-11 h-11 rounded-lg border-2 border-blue-600/70 bg-blue-900/40 flex items-center justify-center overflow-hidden">
                                <img src={imageUrl} alt={materialName} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-blue-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                    {quantity}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
            
            {/* 누적 장비상자 (월드챔피언십, 레거시) - 아이콘 형태 */}
            {Object.keys(accumulatedEquipmentBoxes).length > 0 && (
                <div className={`mb-1 flex w-full flex-wrap justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                    {Object.entries(accumulatedEquipmentBoxes).map(([boxName, quantity]) => {
                        const boxTemplate = CONSUMABLE_ITEMS.find(i => i.name === boxName);
                        const imageUrl = boxTemplate?.image || '';
                        return (
                            <div key={boxName} className="relative w-11 h-11 rounded-lg border-2 border-purple-600/70 bg-purple-900/40 flex items-center justify-center overflow-hidden">
                                <img src={imageUrl} alt={boxName} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-purple-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                    {quantity}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* 월드챔피언십: 경기당 실제 획득 장비 — 등급 테두리 + 아이템 이미지만 표시, 이름은 마우스 오버 시 */}
            {tournamentState.type === 'world' && accumulatedEquipmentItems.length > 0 && (() => {
                const EQUIP_GRADE_BORDER: Record<string, string> = {
                    normal: 'border-2 border-gray-500/80',
                    uncommon: 'border-2 border-green-500/80',
                    rare: 'border-2 border-blue-500/80',
                    epic: 'border-2 border-purple-500/80',
                    legendary: 'border-2 border-red-500/80',
                    mythic: 'border-2 border-amber-500/80',
                };
                return (
                    <div className={`mb-1 flex w-full flex-wrap justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                        {accumulatedEquipmentItems.map((item, idx) => {
                            const grade = (item.grade ?? 'normal') as string;
                            const borderClass = EQUIP_GRADE_BORDER[grade] || EQUIP_GRADE_BORDER.normal;
                            return (
                                <div
                                    key={`${item.id ?? item.name}-${idx}`}
                                    className={`w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center ${borderClass}`}
                                    title={`경기 ${idx + 1} · ${item.name}`}
                                >
                                    <img src={item.image?.startsWith('/') ? item.image : `/${item.image}`} alt="" className="w-[70%] h-[70%] object-contain pointer-events-none" loading="lazy" decoding="async" />
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
            {/* 레거시 데이터 폴백: 등급만 남아있는 경우 — 등급 테두리 + 등급 아이콘, 이름은 마우스 오버 시 */}
            {tournamentState.type === 'world' && accumulatedEquipmentItems.length === 0 && tournamentState.accumulatedEquipmentDrops && tournamentState.accumulatedEquipmentDrops.length > 0 && (() => {
                const EQUIP_GRADE_IMAGE: Record<string, string> = {
                    normal: '/images/equipments/normalbgi.png',
                    uncommon: '/images/equipments/uncommonbgi.png',
                    rare: '/images/equipments/rarebgi.png',
                    epic: '/images/equipments/epicbgi.png',
                    legendary: '/images/equipments/legendarybgi.png',
                    mythic: '/images/equipments/mythicbgi.png',
                    transcendent: '/images/equipments/transcendentbgi.png',
                };
                const EQUIP_GRADE_BORDER: Record<string, string> = {
                    normal: 'border-2 border-gray-500/80',
                    uncommon: 'border-2 border-green-500/80',
                    rare: 'border-2 border-blue-500/80',
                    epic: 'border-2 border-purple-500/80',
                    legendary: 'border-2 border-red-500/80',
                    mythic: 'border-2 border-amber-500/80',
                    transcendent: 'border-2 border-teal-400/85',
                };
                return (
                    <div className={`mb-1 flex w-full flex-wrap justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                        {(tournamentState.accumulatedEquipmentDrops as string[]).map((gradeKey: string, idx: number) => {
                            const img = EQUIP_GRADE_IMAGE[gradeKey] || '/images/equipments/normalbgi.png';
                            const label = EQUIPMENT_GRADE_LABEL_KO[gradeKey] ?? gradeKey;
                            const borderClass = EQUIP_GRADE_BORDER[gradeKey] || EQUIP_GRADE_BORDER.normal;
                            return (
                                <div key={idx} className={`w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center ${borderClass}`} title={`경기 ${idx + 1} · ${label} 장비`}>
                                    <img src={img} alt="" className="w-[70%] h-[70%] object-contain" loading="lazy" decoding="async" />
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
            
            {/* 던전 모드 보상 표시 (단계별 기본 보상 + 순위 보상) */}
            {effectiveStageAttempt && (() => {
                const stage = effectiveStageAttempt;
                
                // 순위 계산 (wins/losses 기준, 모든 라운드의 경기 결과 확인)
                const playerWins: Record<string, number> = {};
                const playerLosses: Record<string, number> = {};
                tournamentState.players.forEach(p => { 
                    playerWins[p.id] = 0; 
                    playerLosses[p.id] = 0;
                });
                
                // 모든 라운드의 모든 경기 결과 확인
                tournamentState.rounds.forEach(round => {
                    if (round.matches) {
                        round.matches.forEach(m => {
                            if (m.isFinished && m.winner) {
                                playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                                const loser = m.players.find(p => p && p.id !== m.winner?.id);
                                if (loser) {
                                    playerLosses[loser.id] = (playerLosses[loser.id] || 0) + 1;
                                }
                            }
                        });
                    }
                });
                
                // 순위 정렬: 승수 → 패수 → 승률
                const sortedPlayers = [...tournamentState.players].sort((a, b) => {
                    if (playerWins[b.id] !== playerWins[a.id]) {
                        return playerWins[b.id] - playerWins[a.id];
                    }
                    if (playerLosses[a.id] !== playerLosses[b.id]) {
                        return playerLosses[a.id] - playerLosses[b.id];
                    }
                    const aWinRate = (playerWins[a.id] + playerLosses[a.id]) > 0 ? playerWins[a.id] / (playerWins[a.id] + playerLosses[a.id]) : 0;
                    const bWinRate = (playerWins[b.id] + playerLosses[b.id]) > 0 ? playerWins[b.id] / (playerWins[b.id] + playerLosses[b.id]) : 0;
                    return bWinRate - aWinRate;
                });
                
                const userRank = sortedPlayers.findIndex(p => p.id === currentUser.id) + 1;
                
                // 단계별 기본 점수 계산
                const baseScore = DUNGEON_STAGE_BASE_SCORE[stage] || 0;
                const rankBonus = DUNGEON_RANK_SCORE_BONUS[userRank] || DUNGEON_DEFAULT_SCORE_BONUS;
                const totalScore = Math.round(baseScore * (1 + rankBonus));
                
                // 기본 보상은 실제 경기가 끝나 누적된 값이 있을 때만 위(accumulatedGold/Materials/EquipmentBoxes)에서 표시됨.
                // 순위 보상 표시 = 범위값(min~max)으로 표시
                const renderRewardRangeChip = (item: { itemId: string; min: number; max: number }, index: number, opacity = '', size: 'sm' | 'md' = 'sm') => {
                    const itemName = item.itemId;
                    const imageUrl = getRewardItemImageUrl(itemName) || (itemName.includes('골드') ? '/images/icon/Gold.png' : itemName.includes('다이아') ? '/images/icon/Zem.png' : '');
                    const isGold = itemName.includes('골드');
                    const isDiamond = itemName.includes('다이아');
                    const borderColor = isGold ? 'border-yellow-600/70' : isDiamond ? 'border-blue-600/70' : 'border-purple-600/70';
                    const bgColor = isGold ? 'bg-yellow-900/40' : isDiamond ? 'bg-blue-900/40' : 'bg-purple-900/40';
                    const textColor = isGold ? 'text-yellow-100' : isDiamond ? 'text-blue-100' : 'text-purple-100';
                    const qtyText = item.min === item.max ? `${item.min}` : `${item.min}~${item.max}`;
                    const displayQty = qtyText;
                    const isSm = size === 'sm';
                    // 티어 배경: 장비/상자 등 grade가 있는 소비 아이템이면 gradeBackgrounds 사용
                    const consumableTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemName);
                    const tierBg = consumableTemplate?.grade ? gradeBackgrounds[consumableTemplate.grade] : undefined;
                    return (
                        <div key={index} className={`relative rounded-lg border-2 ${borderColor} ${bgColor} flex items-center justify-center overflow-hidden ${opacity} ${isSm ? 'w-9 h-9' : 'w-11 h-11'}`}>
                            {tierBg ? (
                                <>
                                    <img
                                        src={tierBg}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                        aria-hidden
                                    />
                                    {imageUrl && (
                                        <img
                                            src={imageUrl}
                                            alt={itemName}
                                            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${isSm ? 'w-[70%] h-[70%]' : 'w-[75%] h-[75%]'} object-contain pointer-events-none`}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    {imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt={itemName}
                                            className={isSm ? 'w-5 h-5 object-contain' : 'w-7 h-7 object-contain'}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    ) : (
                                        <span className="text-[10px] text-gray-300 truncate px-0.5">{itemName}</span>
                                    )}
                                </>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 font-bold ${textColor} bg-black/80 px-1 rounded-tl leading-tight shadow-sm ${isSm ? 'text-[10px]' : 'text-[11px]'}`}>{displayQty}</span>
                        </div>
                    );
                };
                const rankKeys = getDungeonRankKeysForDisplay(type);
                const isDungeonRankDecided = allMatchesFinished && (isTournamentFullyComplete || isUserEliminated || isClaimed);
                return (
                    <>
                        {/* 순위별 보상: 경기 전·후 모두 전 구간 표시 (월드 9~16위는 ‘없음’ 명시), 종료 후 내 순위 행 강조 */}
                        {rankKeys.length > 0 && (
                            <div className="mt-2 w-full border-t border-gray-700 pt-2">
                                <div className="mb-1.5 text-center text-xs font-semibold text-gray-300">
                                    {allMatchesFinished ? '순위별 보상' : '순위별 보상 (경기 종료 후 확정)'}
                                </div>
                                <div
                                    className={`grid w-full grid-cols-2 gap-x-2 gap-y-1 ${
                                        isMobileTabLayout ? '' : 'max-h-40 overflow-y-auto'
                                    }`}
                                >
                                    {rankKeys.map((rankKey: number) => {
                                        const r = getDungeonRankRewardRangeForDisplay(type, stage, rankKey);
                                        const rankLabel =
                                            type === 'world' && rankKey === 9
                                                ? '9~16위'
                                                : type === 'world' && rankKey === 4
                                                  ? '4~8위'
                                                  : `${rankKey}위`;
                                        const isWorldNoRankReward = type === 'world' && rankKey === 9;
                                        const hasItems = !!(r?.items && r.items.length > 0);
                                        if (!isWorldNoRankReward && !hasItems) return null;
                                        const rowHighlight = isDungeonRankGridRowHighlighted(type, userRank, rankKey, isDungeonRankDecided);
                                        return (
                                            <div
                                                key={rankKey}
                                                className={`flex min-w-0 flex-col items-center gap-1 rounded-md py-0.5 pl-0.5 pr-1 text-center ${
                                                    rowHighlight
                                                        ? 'bg-amber-900/40 ring-1 ring-amber-500/45'
                                                        : ''
                                                }`}
                                            >
                                                <span className="w-full flex-shrink-0 text-[11px] font-medium text-gray-300">{rankLabel}</span>
                                                <div className="flex min-w-0 flex-wrap justify-center gap-1">
                                                    {isWorldNoRankReward && !hasItems ? (
                                                        <span className="text-[10px] leading-tight text-gray-500">순위 보상 없음</span>
                                                    ) : (
                                                        r!.items.map((item, idx) => renderRewardRangeChip(item, idx, '', 'sm'))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}
            
            {/* 보상이 하나도 없는 경우 (전국은 matchMaterialRewards 있으면 보상 있음) */}
            {scoreReward === 0 && accumulatedGold === 0 && Object.keys(accumulatedMaterials).length === 0 && Object.keys(accumulatedEquipmentBoxes).length === 0 && accumulatedEquipmentDropsCount === 0 && accumulatedEquipmentItems.length === 0 && !(type === 'national' && tournamentState.matchMaterialRewards && tournamentState.matchMaterialRewards.length > 0) && (
                <div className={`flex w-full items-center justify-center ${isMobileTabLayout ? 'py-10' : 'h-full'}`}>
                    <p className="text-xs text-gray-400 text-center">획득한 보상이 없습니다.</p>
                </div>
            )}
            </div>
            
            {/* 하단 보상 영역: 수령 전에는 보상받기, 수령 후에는 보상완료. 이미 수령(isClaimed)이면 클릭 불가(서버 재호출 방지) */}
            {!suppressBottomActions && (isTournamentFullyComplete || isUserEliminated) && treatAsClaimed && (
                <div className="flex-shrink-0 pt-1.5 border-t border-gray-700 mt-1.5">
                    <div className="space-y-1.5">
                        {isDungeonMode && onCompleteDungeon && !isClaimed ? (
                            <button
                                onClick={onCompleteDungeon}
                                disabled={isClaiming}
                                className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-green-600 hover:bg-green-700 text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isClaiming ? '처리 중...' : '보상 완료'}
                            </button>
                        ) : (
                            <div className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs text-center bg-gray-700/50 text-gray-400 border border-gray-600">
                                보상완료
                            </div>
                        )}
                        {claimedRewardSummary && onOpenRewardHistory && (
                            <button
                                onClick={onOpenRewardHistory}
                                className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-purple-700/70 hover:bg-purple-700 text-white transition-colors"
                            >
                                보상내역
                            </button>
                        )}
                    </div>
                </div>
            )}
            {!suppressBottomActions && !treatAsClaimed && (
                <div className="flex-shrink-0 pt-1.5 border-t border-gray-700 mt-1.5">
                    {/* 경기 종료 후 보상받기 버튼 (챔피언십 = 던전 단계 보상) */}
                    {(isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt && (
                        <button
                            onClick={handleClaim}
                            disabled={!canClaimReward || isClaiming}
                            className={`w-full py-1.5 px-3 rounded-lg font-semibold text-xs transition-colors ${
                                canClaimReward && !isClaiming
                                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isClaiming ? '수령 중...' : (canClaimReward ? '보상받기' : '경기 종료 후 수령 가능')}
                        </button>
                    )}
                    
                    {/* 경기 진행 중 또는 다음경기 버튼이 있을 때 안내 메시지 */}
                    {(isInProgress || isRoundComplete) && !((isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt) && (
                        <div className="w-full bg-blue-900/30 text-blue-300 py-1.5 px-3 rounded-lg font-semibold text-xs text-center border border-blue-700/50">
                            모든 경기 완료 후 보상수령
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const MatchBox: React.FC<{ match: Match; currentUser: UserWithStatus; tournamentState?: TournamentState; compact?: boolean }> = ({
    match,
    currentUser,
    tournamentState,
    compact = false,
}) => {
    const p1 = match.players[0];
    const p2 = match.players[1];

    // 사용자 진행상태 계산
    const getUserProgressStatus = (playerId: string): string | null => {
        if (playerId !== currentUser.id || !tournamentState) return null;
        
        const isNationalTournament = tournamentState.type === 'national';
        const isWorldTournament = tournamentState.type === 'world';
        
        if (isNationalTournament || isWorldTournament) {
            // 전국바둑대회/월드챔피언십: 토너먼트 형식 (N강 진출, 결승 진출 등)
            const currentRound = tournamentState.rounds.find(r => r.matches.some(m => m.id === match.id));
            if (!currentRound || !match.isFinished) return null;
            
            const isWinner = match.winner?.id === playerId;
            if (!isWinner) return null; // 패자는 표시하지 않음
            
            const roundName = currentRound.name;
            if (roundName === '16강') {
                return '8강 진출';
            } else if (roundName === '8강') {
                return '4강 진출';
            } else if (roundName === '4강') {
                return '결승 진출';
            } else if (roundName === '결승') {
                return '우승';
            } else if (roundName === '3,4위전') {
                return '3/4위전 진출';
            }
            return null;
        } else {
            // 동네바둑리그: 기존 형식
            const allUserMatches = tournamentState.rounds.flatMap(r => r.matches).filter(m => 
                m.isUserMatch && m.players.some(p => p?.id === playerId)
            );
            const finishedMatches = allUserMatches.filter(m => m.isFinished);
            const wins = finishedMatches.filter(m => m.winner?.id === playerId).length;
            const losses = finishedMatches.length - wins;
            
            if (finishedMatches.length === 0) return null;
            
            const lastMatch = finishedMatches[finishedMatches.length - 1];
            const lastMatchWon = lastMatch.winner?.id === playerId;
            const matchNumber = finishedMatches.length;
            
            return `${matchNumber}차전 ${lastMatchWon ? '승리' : '패배'}! (${wins}승 ${losses}패)`;
        }
    };

    // 결승전 우승자 확인
    const isFinalMatch = useMemo(() => {
        if (!tournamentState) return false;
        const finalRound = tournamentState.rounds.find(r => r.name === '결승');
        return finalRound?.matches.some(m => m.id === match.id) || false;
    }, [tournamentState, match.id]);
    
    const isTournamentComplete = tournamentState?.status === 'complete';

    const avatarSizeNational = compact ? 26 : 36;
    const avatarSizeLeague = compact ? 26 : 32;

    const PlayerDisplay: React.FC<{ player: PlayerForTournament | null, isWinner: boolean }> = ({ player, isWinner }) => {
        const isNationalTournament = tournamentState?.type === 'national';
        const isWorldTournament = tournamentState?.type === 'world';
        const isTournamentFormat = isNationalTournament || isWorldTournament;
        
        if (!player) {
            return (
                <div
                    className={`flex items-center justify-center ${isTournamentFormat ? (compact ? 'h-12 px-2' : 'h-16 px-4') : compact ? 'h-8 px-1' : 'h-10 px-2'}`}
                >
                    <span className={`text-gray-500 italic ${isTournamentFormat ? (compact ? 'text-xs' : 'text-base') : compact ? 'text-[11px]' : 'text-sm'}`}>
                        경기 대기중...
                    </span>
                </div>
            );
        }
        
        const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;
        const progressStatus = getUserProgressStatus(player.id);
        const showTrophy = isFinalMatch && isTournamentComplete && isWinner && player.id === match.winner?.id && match.isFinished;

        if (isTournamentFormat) {
            // 전국바둑대회/월드챔피언십: 가로 배치용 컴팩트 레이아웃
            const winMarginText = isWinner && match.isFinished ? (() => {
                if (!match.finalScore) return '승';
                const p1Percent = match.finalScore.player1;
                const diffPercent = Math.abs(p1Percent - 50) * 2;
                const scoreDiff = diffPercent / 2;
                const roundedDiff = Math.round(scoreDiff);
                const finalDiff = roundedDiff + 0.5;
                const winMargin = finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
                return `${winMargin}집 승`;
            })() : null;
            
            return (
                <div
                    className={`relative flex flex-col items-center justify-center rounded-lg transition-all ${
                        isWinner
                            ? compact
                                ? 'px-1.5 py-1'
                                : 'px-3 py-2'
                            : compact
                              ? 'px-1 py-1'
                              : 'px-2 py-1.5'
                    } ${
                    isWinner 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50 shadow-lg shadow-yellow-500/20' 
                        : match.isFinished 
                            ? 'opacity-50' 
                            : 'hover:bg-slate-800/75'
                }`}
                >
                    {/* 승리 표시 오버레이 (우측 상단) */}
                    {match.isFinished && isWinner && (winMarginText || showTrophy) && (
                        <div className={`absolute flex items-center gap-1 z-10 ${compact ? '-top-1 -right-1' : '-top-2 -right-2'}`}>
                            {winMarginText && (
                                <span
                                    className={`bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-full shadow-lg flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${
                                        compact ? 'text-[8px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'
                                    }`}
                                >
                                    <span>🏆</span>
                                    <span>{winMarginText}</span>
                                </span>
                            )}
                            {showTrophy && (
                                <img 
                                    key={`trophy-${player.id}-${match.id}`}
                                    src="/images/championship/Ranking.png" 
                                    alt="Trophy" 
                                    className={`flex-shrink-0 drop-shadow-lg ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
                                    loading="lazy"
                                    decoding="async"
                                />
                            )}
                        </div>
                    )}
                    
                    {/* Avatar */}
                    <div className={`flex-shrink-0 ${compact ? 'mb-1' : 'mb-1.5'}`}>
                        <Avatar
                            key={`avatar-${player.id}-${match.id}`}
                            userId={player.id}
                            userName={player.nickname}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                            size={avatarSizeNational}
                        />
                    </div>
                    
                    {/* 텍스트 영역 */}
                    <div className={`flex flex-col items-center justify-center w-full min-w-0 ${compact ? 'gap-0' : 'gap-1'}`}>
                        {/* 닉네임 */}
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <span className={`text-center font-semibold truncate ${compact ? 'text-[11px]' : 'text-sm'} ${
                                isWinner 
                                    ? 'text-yellow-300 font-bold' 
                                    : match.isFinished 
                                        ? 'text-gray-400' 
                                        : 'text-gray-200'
                            }`}>
                                {player.nickname}
                            </span>
                        </div>
                        
                        {/* 진행 상태 (전국바둑대회/월드챔피언십: 승자에게만 표시) */}
                        {progressStatus && (
                            <div
                                className={`text-yellow-400 font-semibold text-center break-words ${compact ? 'text-[9px] leading-tight' : 'text-xs'}`}
                            >
                                {progressStatus}
                            </div>
                        )}
                    </div>
                </div>
            );
        } else {
            // 동네바둑리그: 기본 레이아웃
            const winMargin = isWinner && match.isFinished ? (() => {
                if (!match.finalScore) return '';
                const p1Percent = match.finalScore.player1;
                const diffPercent = Math.abs(p1Percent - 50) * 2;
                const scoreDiff = diffPercent / 2;
                const roundedDiff = Math.round(scoreDiff);
                const finalDiff = roundedDiff + 0.5;
                const margin = finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
                return margin;
            })() : '';
            
            return (
                <div className={`relative flex items-center ${compact ? 'gap-1.5' : 'gap-2'} ${isWinner ? (compact ? 'px-1.5 py-1' : 'px-2 py-2') : compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} rounded-md transition-all ${
                    isWinner 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50 shadow-lg shadow-yellow-500/20' 
                        : match.isFinished 
                            ? 'opacity-50' 
                            : 'hover:bg-slate-800/75'
                }`}>
                    {/* 승리 표시 오버레이 (우측 상단) */}
                    {match.isFinished && isWinner && (winMargin || showTrophy) && (
                        <div className="absolute -top-2 -right-2 flex items-center gap-1 z-10">
                            {winMargin && (
                                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
                                    <span>🏆</span>
                                    <span>{winMargin}집 승</span>
                                </span>
                            )}
                            {showTrophy && (
                                <img 
                                    key={`trophy-${player.id}-${match.id}`}
                                    src="/images/championship/Ranking.png" 
                                    alt="Trophy" 
                                    className="w-5 h-5 flex-shrink-0 drop-shadow-lg"
                                    loading="lazy"
                                    decoding="async"
                                />
                            )}
                        </div>
                    )}
                    
                    <Avatar
                        key={`avatar-${player.id}-${match.id}`}
                        userId={player.id}
                        userName={player.nickname}
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                        size={avatarSizeLeague}
                    />
                    <div className={`flex-1 min-w-0 flex flex-col ${compact ? 'gap-0' : 'gap-1'}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                            <span className={`truncate font-semibold ${compact ? 'text-xs' : 'text-sm'} ${
                                isWinner 
                                    ? 'text-yellow-300 font-bold' 
                                    : match.isFinished 
                                        ? 'text-gray-400' 
                                        : 'text-gray-200'
                            }`}>
                                {player.nickname}
                            </span>
                        </div>
                        {progressStatus && (
                            <span className={`text-yellow-400 font-semibold truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                                {progressStatus}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
    };
    
    const p1IsWinner = match.isFinished && match.winner?.id === p1?.id;
    const p2IsWinner = match.isFinished && match.winner?.id === p2?.id;
    const isMyMatch = p1?.id === currentUser.id || p2?.id === currentUser.id;
    const isFinished = match.isFinished;

    // finalScore에서 집 차이 계산 (finishMatch 함수의 로직과 동일)
    const calculateWinMargin = (): string => {
        if (!isFinished || !match.finalScore) return '';
        const p1Percent = match.finalScore.player1;
        const diffPercent = Math.abs(p1Percent - 50) * 2;
        const scoreDiff = diffPercent / 2;
        const roundedDiff = Math.round(scoreDiff);
        const finalDiff = roundedDiff + 0.5;
        return finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
    };

    const winMargin = calculateWinMargin();

    // 전국바둑대회/월드챔피언십인지 확인 (tournamentState의 type으로 판단)
    const isNationalTournament = tournamentState?.type === 'national';
    const isWorldTournament = tournamentState?.type === 'world';
    const isTournamentFormat = isNationalTournament || isWorldTournament;
    
    return (
        <div
            className={`relative w-full overflow-visible transition-all duration-300 ${
                compact ? 'rounded-lg' : 'rounded-xl'
            } ${
            isMyMatch 
                ? 'border-2 border-blue-500/80 bg-gradient-to-br from-blue-950/90 via-blue-900/82 to-indigo-950/90 shadow-lg shadow-blue-500/25' 
                : 'border border-gray-500/65 bg-gradient-to-br from-slate-900/94 via-slate-800/90 to-slate-900/94 shadow-md backdrop-blur-sm'
        } ${isFinished || compact ? '' : 'hover:scale-[1.02] hover:shadow-xl'}`}
        >
            {/* 승리 배지 (동네바둑리그만 표시, 전국바둑대회/월드챔피언십은 PlayerDisplay에 표시) */}
            {isTournamentFormat ? (
                // 전국바둑대회/월드챔피언십: 가로 배치 (1번선수 vs 2번선수)
                <div className={compact ? 'p-2' : 'p-3'}>
                    <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-3'}`}>
                        <div className="flex-1 min-w-0 flex justify-center">
                            <PlayerDisplay player={p1} isWinner={p1IsWinner} />
                        </div>
                        {!isFinished && (
                            <div className={`text-gray-400 font-semibold flex-shrink-0 ${compact ? 'text-[10px]' : 'text-sm'}`}>VS</div>
                        )}
                        <div className="flex-1 min-w-0 flex justify-center">
                            <PlayerDisplay player={p2} isWinner={p2IsWinner} />
                        </div>
                    </div>
                </div>
            ) : (
                // 동네바둑리그: 세로 배치
                <div className={`${compact ? 'space-y-1 p-2' : 'space-y-2 p-3'}`}>
                    <PlayerDisplay player={p1} isWinner={p1IsWinner} />
                    {!isFinished && (
                        <div className={`flex items-center justify-center ${compact ? 'py-0' : 'py-1'}`}>
                            <div className={`text-gray-400 font-semibold ${compact ? 'text-[10px]' : 'text-xs'}`}>VS</div>
                        </div>
                    )}
                    <PlayerDisplay player={p2} isWinner={p2IsWinner} />
                </div>
            )}
        </div>
    );
};

const RoundColumn: React.FC<{
    name: string;
    matches: Match[] | undefined;
    currentUser: UserWithStatus;
    tournamentState?: TournamentState;
    compact?: boolean;
}> = ({ name, matches, currentUser, tournamentState, compact = false }) => {
    const isFinalRound = name.includes('결승') || name.includes('3,4위전');
    const isNationalTournament = tournamentState?.type === 'national';
    const isWorldTournament = tournamentState?.type === 'world';
    const isTournamentFormat = isNationalTournament || isWorldTournament;
    
    return (
        <div
            className={`flex h-full flex-shrink-0 flex-col justify-around ${isTournamentFormat ? (compact ? 'gap-3 min-w-[200px]' : 'gap-6 min-w-[280px]') : compact ? 'min-w-[160px] gap-3' : 'min-w-[200px] gap-4'}`}
        >
            <div
                className={`text-center font-bold rounded-lg ${
                isTournamentFormat
                    ? compact
                        ? 'px-3 py-1.5 text-sm'
                        : 'px-5 py-3 text-lg'
                    : compact
                      ? 'px-3 py-1.5 text-xs'
                      : 'px-4 py-2 text-base'
            } ${
                isFinalRound
                    ? 'border-2 border-purple-400/55 bg-gradient-to-r from-purple-700/92 to-pink-700/92 text-white shadow-lg shadow-purple-500/30'
                    : 'border border-gray-500/60 bg-gradient-to-r from-slate-800/92 to-slate-700/88 text-gray-200 shadow-md backdrop-blur-sm'
            }`}>
                {name}
            </div>
            <div className={`flex h-full flex-col justify-around ${isTournamentFormat ? (compact ? 'gap-3' : 'gap-6') : compact ? 'gap-3' : 'gap-4'}`}>
                {matches?.map(match => (
                    <MatchBox key={match.id} match={match} currentUser={currentUser} tournamentState={tournamentState} compact={compact} />
                ))}
            </div>
        </div>
    );
};

const RoundRobinDisplay: React.FC<{
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
    /** 다음 경기 자동 시작까지 남은 시간(ms). 있으면 현재 회차에서 카운트다운 후 탭 전환하므로, 카운트다운 중에는 탭을 다음 회차로 넘기지 않음 */
    nextRoundStartTime?: number | null;
    /** 카운트다운 0 시 부모에서 설정. 이 값이 오면 먼저 이 회차로 탭 전환 후 시합 시작 */
    pendingRoundSwitchTo?: number | null;
    /** 모바일 대진표 탭 등 좁은 화면 */
    compact?: boolean;
}> = ({ tournamentState, currentUser, nextRoundStartTime, pendingRoundSwitchTo, compact = false }) => {
    const [activeTab, setActiveTab] = useState<'round' | 'ranking'>('round');
    const { players, rounds, status, currentRoundRobinRound, type: tournamentType } = tournamentState;
    
    // 경기가 완료된 경우 마지막 회차(5회차)를 초기값으로 설정
    const initialRound = status === 'complete' ? 5 : (currentRoundRobinRound || 1);
    const [selectedRound, setSelectedRound] = useState<number>(initialRound);
    
    // 모든 매치를 수집 (5회차 전체)
    const allMatches = useMemo(() => {
        return rounds.flatMap(round => round.matches);
    }, [rounds]);

    const playerStats = useMemo(() => {
        const stats: Record<string, { wins: number; losses: number }> = {};
        players.forEach(p => { stats[p.id] = { wins: 0, losses: 0 }; });
        allMatches.forEach(match => {
            if (match.isFinished && match.winner) {
                const winnerId = match.winner.id;
                if (stats[winnerId]) stats[winnerId].wins++;
                const loser = match.players.find(p => p && p.id !== winnerId);
                if (loser && stats[loser.id]) stats[loser.id].losses++;
            }
        });
        return stats;
    }, [players, allMatches]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            const aWins = playerStats[a.id]?.wins || 0;
            const bWins = playerStats[b.id]?.wins || 0;
            if (aWins !== bWins) return bWins - aWins;
            // 승수가 같으면 패수로 정렬 (패수가 적을수록 좋음)
            const aLosses = playerStats[a.id]?.losses || 0;
            const bLosses = playerStats[b.id]?.losses || 0;
            return aLosses - bLosses;
        });
    }, [players, playerStats]);

    // 현재 표시할 회차 결정
    // 동네바둑리그: 
    // - round_complete 상태일 때는 완료된 회차를 표시 (1회차 완료 후 1회차 표시) - 경기 종료 화면 유지
    // - bracket_ready 상태일 때는 현재 회차를 표시 (다음 경기 버튼을 눌러 2회차로 넘어간 후 2회차 표시) - 다음 회차 대진표로 이동
    // - round_in_progress 상태일 때는 현재 진행 중인 회차를 표시 (던전 모드 자동진행 대응)
    // - complete 상태일 때는 마지막 회차(5회차)를 표시 (경기 종료 후 재입장 시) - 마지막 경기 종료 화면 유지
    const roundForDisplay = status === 'complete' ? 5 : (currentRoundRobinRound || 1);
    
    // rounds 배열에서 선택된 회차의 라운드 찾기 (name이 "1회차", "2회차" 등인 라운드)
    const currentRoundObj = useMemo(() => {
        return rounds.find(round => round.name === `${selectedRound}회차`);
    }, [rounds, selectedRound]);
    
    const currentRoundMatches = currentRoundObj?.matches || [];

    // 부모에서 카운트다운 0 시 다음 회차로 먼저 전환 요청한 경우 즉시 탭 전환
    useLayoutEffect(() => {
        if (pendingRoundSwitchTo != null && pendingRoundSwitchTo >= 1) {
            setSelectedRound(pendingRoundSwitchTo);
        }
    }, [pendingRoundSwitchTo]);

    // 현재 회차가 변경되고 사용자가 수동으로 선택하지 않은 경우에만 선택된 회차 업데이트
    // 1회차 종료 후: 같은 자리에서 카운트다운만 보여 주고, 카운트다운 완료(round_in_progress) 후에만 다음 회차 탭으로 이동
    const isManualSelection = useRef(false);
    const prevRoundForDisplay = useRef(roundForDisplay);
    useLayoutEffect(() => {
        if (pendingRoundSwitchTo != null) return; // 부모가 탭 전환 제어 중
        const roundChanged = prevRoundForDisplay.current !== roundForDisplay;
        prevRoundForDisplay.current = roundForDisplay;
        // bracket_ready + nextRoundStartTime + 2회차 이상: 카운트다운 중이므로 탭을 넘기지 않고 현재(이전) 회차 유지
        const countdownInProgress = status === 'bracket_ready' && nextRoundStartTime != null && roundForDisplay >= 2;
        if (countdownInProgress) {
            isManualSelection.current = false;
            return;
        }
        if (!isManualSelection.current && roundForDisplay && (selectedRound !== roundForDisplay || roundChanged)) {
            console.log(`[RoundRobinDisplay] Updating selectedRound: ${selectedRound} -> ${roundForDisplay}, status: ${status}, currentRoundRobinRound: ${currentRoundRobinRound}`);
            setSelectedRound(roundForDisplay);
        }
        isManualSelection.current = false;
    }, [roundForDisplay, selectedRound, status, currentRoundRobinRound, nextRoundStartTime, pendingRoundSwitchTo]);
    
    const handleRoundSelect = (roundNum: number) => {
        isManualSelection.current = true;
        setSelectedRound(roundNum);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <h4 className={`flex-shrink-0 text-center font-bold text-gray-300 ${compact ? 'mb-1 text-xs' : 'mb-2'}`}>풀리그 대진표</h4>
            <div
                className={`mb-2 flex flex-shrink-0 rounded-lg border border-gray-600/55 bg-slate-950/90 backdrop-blur-sm ${compact ? 'p-0.5' : 'p-1'}`}
            >
                <button
                    onClick={() => setActiveTab('round')}
                    className={`flex-1 rounded-md font-semibold transition-all ${compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} ${activeTab === 'round' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    대진표
                </button>
                <button
                    onClick={() => setActiveTab('ranking')}
                    className={`flex-1 rounded-md font-semibold transition-all ${compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} ${activeTab === 'ranking' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    {status === 'complete' ? '최종 순위' : '현재 순위'}
                </button>
            </div>
            <div className={`min-h-0 flex-grow overflow-y-auto ${compact ? 'pr-1' : 'pr-2'}`}>
                {activeTab === 'round' ? (
                    <div className="flex h-full flex-col">
                        {/* 회차 선택 탭 */}
                        <div className={`flex flex-shrink-0 gap-1 ${compact ? 'mb-1' : 'mb-2'}`}>
                            {[1, 2, 3, 4, 5].map(roundNum => (
                                <button
                                    key={roundNum}
                                    onClick={() => handleRoundSelect(roundNum)}
                                    className={`flex-1 rounded-md font-semibold transition-all ${compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} ${
                                        selectedRound === roundNum
                                            ? 'bg-blue-700 text-white'
                                            : roundNum <= roundForDisplay
                                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    }`}
                                    disabled={roundNum > roundForDisplay}
                                >
                                    {roundNum}회차
                                </button>
                            ))}
                        </div>
                        {/* 선택된 회차의 매치 표시 */}
                        <div
                            className={`flex min-h-0 flex-grow flex-col items-center justify-around px-1 ${compact ? 'gap-2' : 'gap-4 px-2'}`}
                        >
                            {currentRoundMatches.length > 0 ? (
                                currentRoundMatches.map(match => (
                                    <div key={match.id} className={`w-full ${compact ? 'max-w-[240px]' : 'max-w-md'}`}>
                                        <MatchBox match={match} currentUser={currentUser} tournamentState={tournamentState} compact={compact} />
                                    </div>
                                ))
                            ) : (
                                <div className={`italic text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>경기가 없습니다.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <ul className={compact ? 'space-y-1' : 'space-y-2'}>
                        {sortedPlayers.map((player, index) => {
                             const stats = playerStats[player.id];
                             const isCurrentUser = player.id === currentUser.id;
                             const isTopThree = index < 3;
                             // hooks는 map 내부에서 호출할 수 없으므로 일반 변수로 계산
                             const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
                             const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;
                             const isWinner = status === 'complete' && index === 0;
                             
                             return (
                                 <li
                                     key={player.id}
                                     className={`flex items-center rounded-lg transition-all ${
                                         compact ? 'gap-2 p-2' : 'gap-3 p-3'
                                     } ${
                                     isCurrentUser 
                                         ? 'bg-gradient-to-r from-blue-600/60 to-indigo-600/60 border-2 border-blue-400/70 shadow-lg' 
                                         : isTopThree
                                             ? 'bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border border-yellow-600/50 shadow-md'
                                             : 'bg-gray-700/50 border border-gray-600/30 hover:bg-gray-700/70'
                                 }`}
                                 >
                                     <div
                                         className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold ${
                                             compact ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm'
                                         } ${
                                         index === 0 
                                             ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg'
                                             : index === 1
                                                 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 shadow-md'
                                                 : index === 2
                                                     ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-md'
                                                     : 'bg-gray-600 text-gray-200'
                                     }`}>
                                         {index + 1}
                                     </div>
                                     <Avatar
                                         key={`avatar-rr-${player.id}`}
                                         userId={player.id}
                                         userName={player.nickname}
                                         avatarUrl={avatarUrl}
                                         borderUrl={borderUrl}
                                         size={compact ? 28 : 36}
                                     />
                                     <span className={`flex-grow truncate font-semibold ${compact ? 'text-xs' : 'text-sm'} ${
                                         isCurrentUser ? 'text-blue-200' : 'text-gray-200'
                                     }`}>
                                         {player.nickname}
                                     </span>
                                     {isWinner && (
                                         <img 
                                             key={`trophy-rr-${player.id}`}
                                             src="/images/championship/Ranking.png" 
                                             alt="Trophy" 
                                             className={`flex-shrink-0 ${compact ? 'h-4 w-4' : 'h-6 w-6'}`}
                                             loading="lazy"
                                             decoding="async"
                                         />
                                     )}
                                     <div className={`flex items-baseline font-semibold ${compact ? 'gap-1 text-[10px]' : 'gap-2 text-xs'}`}>
                                         <span className="text-green-400">{stats.wins}승</span>
                                         <span className="text-gray-400">/</span>
                                         <span className="text-red-400">{stats.losses}패</span>
                                     </div>
                                 </li>
                             );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};


const TournamentRoundViewer: React.FC<{ 
    rounds: Round[]; 
    currentUser: UserWithStatus; 
    tournamentType: TournamentType; 
    tournamentState?: TournamentState;
    nextRoundTrigger?: number;
    nextRoundStartTime?: number | null;
    /** 모바일 대진표 탭 */
    compact?: boolean;
}> = ({ rounds, currentUser, tournamentType, tournamentState, nextRoundTrigger, nextRoundStartTime, compact = false }) => {
    // FIX: Define the type for tab data to help TypeScript's inference.
    type TabData = { name: string; matches: Match[]; isInProgress: boolean; };
    
    const getRoundsForTabs = useMemo((): TabData[] | null => {
        const roundMap = new Map<string, Match[]>();
        rounds.forEach(r => roundMap.set(r.name, r.matches));
        
        let availableTabs: string[] = [];
        if (tournamentType === 'world') {
            availableTabs = ["16강", "8강", "4강전", "결승&3/4위전"];
        } else if (tournamentType === 'national') {
            availableTabs = ["8강", "4강전", "결승&3/4위전"];
        } else {
            return null;
        }

        const tabData = availableTabs.map((tabName): TabData => {
            let roundMatches: Match[] = [];
            let roundNames: string[] = [];
            if (tabName === "결승 및 3/4위전" || tabName === "결승&3/4위전") {
                roundNames = ["결승", "3,4위전"];
                roundMatches = (roundMap.get("결승") || []).concat(roundMap.get("3,4위전") || []);
            } else if (tabName === "4강전") {
                roundNames = ["4강"];
                roundMatches = roundMap.get("4강") || [];
            } else {
                roundNames = [tabName];
                roundMatches = roundMap.get(tabName) || [];
            }
            return {
                name: tabName,
                matches: roundMatches,
                isInProgress: roundMatches.length > 0 && roundMatches.some(m => !m.isFinished)
            };
        });
        // 경기가 없어도 탭을 표시하도록 filter 제거
        
        return tabData;
    }, [rounds, tournamentType]);

    // 초기 탭 인덱스 계산 (컴포넌트 마운트 시 한 번만 사용)
    // useState의 초기값 함수는 첫 렌더링 시에만 실행되므로 안전함
    const getInitialTabIndex = () => {
        if (!getRoundsForTabs) return 0;
        
        // 경기가 완료된 경우(complete 또는 eliminated) 마지막 탭을 선택
        if (tournamentState && (tournamentState.status === 'complete' || tournamentState.status === 'eliminated')) {
            return Math.max(0, getRoundsForTabs.length - 1);
        }
        
        // 진행 중인 경기가 있는 탭을 찾음 (초기 입장 시에만)
        const inProgressIndex = getRoundsForTabs.findIndex(tab => tab.isInProgress);
        if (inProgressIndex !== -1) {
            return inProgressIndex;
        }
        
        // 그 외의 경우 첫 번째 탭 선택
        return 0;
    };

    const [activeTab, setActiveTab] = useState(getInitialTabIndex);

    // nextRoundTrigger가 변경되면 다음 탭으로 이동
    const prevNextRoundTrigger = useRef(nextRoundTrigger || 0);
    useEffect(() => {
        if (nextRoundTrigger !== undefined && nextRoundTrigger > prevNextRoundTrigger.current && getRoundsForTabs) {
            const currentTabName = getRoundsForTabs[activeTab]?.name;
            
            // 전국바둑대회
            if (tournamentType === 'national') {
                if (currentTabName === "8강") {
                    // 8강 탭에서 다음경기 버튼을 누르면 4강전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "4강전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === "4강전") {
                    // 4강전 탭에서 다음경기 버튼을 누르면 결승&3/4위전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "결승&3/4위전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                }
            }
            // 월드챔피언십
            else if (tournamentType === 'world') {
                if (currentTabName === "16강") {
                    // 16강 탭에서 다음경기 버튼을 누르면 8강 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "8강");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === "8강") {
                    // 8강 탭에서 다음경기 버튼을 누르면 4강전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "4강전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === "4강전") {
                    // 4강전 탭에서 다음경기 버튼을 누르면 결승&3/4위전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "결승&3/4위전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                }
            }
            
            prevNextRoundTrigger.current = nextRoundTrigger;
        } else if (nextRoundTrigger !== undefined) {
            // nextRoundTrigger가 변경되었지만 탭 변경 조건을 만족하지 않으면 ref만 업데이트
            prevNextRoundTrigger.current = nextRoundTrigger;
        }
    }, [nextRoundTrigger, activeTab, getRoundsForTabs, tournamentType]);

    // 경기 종료 시점에 다음 경기가 있는 탭으로 자동 이동
    // round_in_progress에서 bracket_ready로 변경될 때 또는 nextRoundStartTime이 설정될 때 탭 변경
    const prevStatus = useRef<string | undefined>(tournamentState?.status);
    const prevNextRoundStartTime = useRef<number | null | undefined>(nextRoundStartTime);
    
    useEffect(() => {
        if (!getRoundsForTabs || !tournamentState) return;
        
        const currentStatus = tournamentState.status;
        const statusChanged = prevStatus.current !== currentStatus;
        const nextRoundStartTimeChanged = nextRoundStartTime !== prevNextRoundStartTime.current;
        
        // 경기 종료 시점 (round_in_progress -> bracket_ready) 또는 카운트다운 시작 시 탭 변경
        const shouldChangeTab = (statusChanged && currentStatus === 'bracket_ready' && prevStatus.current === 'round_in_progress') ||
                                (nextRoundStartTimeChanged && nextRoundStartTime);
        
        if (shouldChangeTab) {
            // 다음 경기가 있는 탭 찾기
            const nextUserMatch = rounds
                .flatMap((round, rIdx) => round.matches.map((match, mIdx) => ({ match, roundIndex: rIdx, matchIndex: mIdx })))
                .find(({ match }) => !match.isFinished && match.isUserMatch);
            
            if (nextUserMatch) {
                // 다음 경기가 있는 라운드 찾기
                const nextRound = rounds[nextUserMatch.roundIndex];
                if (nextRound) {
                    // 해당 라운드가 포함된 탭 찾기
                    const targetTabIndex = getRoundsForTabs.findIndex(tab => {
                        if (tab.name === "결승&3/4위전") {
                            return nextRound.name === "결승" || nextRound.name === "3,4위전";
                        } else if (tab.name === "4강전") {
                            return nextRound.name === "4강";
                        } else {
                            return tab.name === nextRound.name;
                        }
                    });
                    
                    if (targetTabIndex !== -1 && targetTabIndex !== activeTab) {
                        // 경기 종료 시점 또는 카운트다운 시작 시 즉시 탭 변경하여 대진표 업데이트
                        console.log(`[TournamentRoundViewer] 경기 종료/카운트다운 시작, 탭 변경: ${activeTab} -> ${targetTabIndex}, status: ${prevStatus.current} -> ${currentStatus}`);
                        setActiveTab(targetTabIndex);
                    }
                }
            }
        }
        
        prevStatus.current = currentStatus;
        prevNextRoundStartTime.current = nextRoundStartTime;
    }, [tournamentState?.status, nextRoundStartTime, getRoundsForTabs, tournamentState, rounds, activeTab]);

    if (!getRoundsForTabs) {
        const desiredOrder = ["16강", "8강", "4강", "3,4위전", "결승"];
        const sortedRounds = [...rounds].sort((a, b) => desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name));
        return (
            <div className="flex h-full min-h-0 flex-col">
                <h4 className={`flex-shrink-0 text-center font-bold text-gray-300 ${compact ? 'mb-1 text-xs' : 'mb-2'}`}>대진표</h4>
                <div className={`flex flex-grow items-center justify-center overflow-auto ${compact ? 'space-x-2 p-1' : 'space-x-4 p-2'}`}>
                    {sortedRounds.map((round) => (
                        <RoundColumn
                            key={round.id}
                            name={round.name}
                            matches={round.matches}
                            currentUser={currentUser}
                            tournamentState={tournamentState}
                            compact={compact}
                        />
                    ))}
                </div>
            </div>
        );
    }
    
    const activeTabData = getRoundsForTabs[activeTab];

    // 전국바둑대회 전체 토너먼트 브래킷 렌더링 (8강 → 4강 → 결승)
    const renderNationalTournamentBracket = () => {
        const roundMap = new Map<string, Match[]>();
        rounds.forEach(r => roundMap.set(r.name, r.matches));
        
        const quarterFinals = roundMap.get("8강") || [];
        const semiFinals = roundMap.get("4강") || [];
        const final = roundMap.get("결승") || [];
        const thirdPlace = roundMap.get("3,4위전") || [];
        
        const containerRef = useRef<HTMLDivElement>(null);
        const [lines, setLines] = useState<React.ReactNode[]>([]);
        const matchRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
        
        const setMatchRef = useCallback((matchId: string) => (el: HTMLDivElement | null) => {
            matchRefs.current.set(matchId, el);
        }, []);
        
        useEffect(() => {
            const calculateLines = () => {
                const containerElem = containerRef.current;
                if (!containerElem) return;
                
                const containerRect = containerElem.getBoundingClientRect();
                const newLines: React.ReactNode[] = [];
                
                // 8강 → 4강 연결선 (왼쪽 8강 → 오른쪽 4강, V자 형태로 가운데에서 만남)
                quarterFinals.forEach((qfMatch, qfIndex) => {
                    if (!qfMatch.isFinished || !qfMatch.winner) return;
                    
                    // 위쪽 8강(0,1) → 첫 번째 4강(0), 아래쪽 8강(2,3) → 두 번째 4강(1)
                    const semiIndex = Math.floor(qfIndex / 2);
                    const semiMatch = semiFinals[semiIndex];
                    if (!semiMatch) return;
                    
                    const qfElem = matchRefs.current.get(qfMatch.id);
                    const semiElem = matchRefs.current.get(semiMatch.id);
                    
                    if (qfElem && semiElem) {
                        const qfRect = qfElem.getBoundingClientRect();
                        const semiRect = semiElem.getBoundingClientRect();
                        
                        // 승자 위치 계산 (MatchBox 내부에서 위쪽/아래쪽 플레이어)
                        const qfWinnerIsP1 = qfMatch.winner.id === qfMatch.players[0]?.id;
                        const qfY = qfRect.top + (qfWinnerIsP1 ? qfRect.height * 0.25 : qfRect.height * 0.75) - containerRect.top;
                        
                        // 4강의 위치: 위쪽 8강이면 4강의 위쪽, 아래쪽 8강이면 4강의 아래쪽
                        const isUpperQuarter = qfIndex < 2;
                        const semiY = semiRect.top + (isUpperQuarter ? semiRect.height * 0.25 : semiRect.height * 0.75) - containerRect.top;
                        
                        const startX = qfRect.right - containerRect.left;
                        const endX = semiRect.left - containerRect.left;
                        const midX = startX + (endX - startX) * 0.5; // 가운데 지점
                        const midY = qfRect.top + qfRect.height / 2 - containerRect.top; // 8강 박스의 중간 높이
                        const targetMidY = semiRect.top + semiRect.height / 2 - containerRect.top; // 4강 박스의 중간 높이
                        
                        // V자 형태: 8강에서 아래로 내려가서 가운데에서 만나고, 다시 4강으로 올라감
                        newLines.push(
                            <path key={`qf-${qfMatch.id}`} 
                                d={`M ${startX} ${qfY} V ${midY} H ${midX} V ${targetMidY} H ${endX} V ${semiY}`} 
                                stroke="rgba(251, 146, 60, 0.8)" 
                                strokeWidth="3" 
                                fill="none" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        );
                    }
                });
                
                // 4강 → 결승 연결선 (역 V자 형태로 가운데에서 나뉨)
                semiFinals.forEach((semiMatch, semiIndex) => {
                    if (!semiMatch.isFinished || !semiMatch.winner) return;
                    
                    const finalMatch = final[0];
                    if (!finalMatch) return;
                    
                    const semiElem = matchRefs.current.get(semiMatch.id);
                    const finalElem = matchRefs.current.get(finalMatch.id);
                    
                    if (semiElem && finalElem) {
                        const semiRect = semiElem.getBoundingClientRect();
                        const finalRect = finalElem.getBoundingClientRect();
                        
                        const semiWinnerIsP1 = semiMatch.winner.id === semiMatch.players[0]?.id;
                        const semiY = semiRect.top + (semiWinnerIsP1 ? semiRect.height * 0.25 : semiRect.height * 0.75) - containerRect.top;
                        const finalY = finalRect.top + finalRect.height * 0.5 - containerRect.top;
                        
                        const startX = semiRect.left + semiRect.width / 2 - containerRect.left;
                        const endX = finalRect.left + finalRect.width / 2 - containerRect.left;
                        const midX = (startX + endX) / 2; // 가운데 지점
                        const midY = semiRect.bottom - containerRect.top; // 4강 박스 아래
                        const targetMidY = finalRect.top - containerRect.top; // 결승 박스 위
                        
                        // 역 V자 형태: 4강에서 아래로 내려가서 가운데에서 나뉘고, 다시 결승으로 올라감
                        newLines.push(
                            <path key={`semi-${semiMatch.id}`} 
                                d={`M ${startX} ${semiY} V ${midY} H ${midX} V ${targetMidY} H ${endX} V ${finalY}`} 
                                stroke="rgba(251, 146, 60, 0.8)" 
                                strokeWidth="3" 
                                fill="none" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        );
                    }
                });
                
                setLines(newLines);
            };
            
            const timeoutId = setTimeout(calculateLines, 50);
            const resizeObserver = new ResizeObserver(calculateLines);
            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
            }
            
            return () => {
                clearTimeout(timeoutId);
                resizeObserver.disconnect();
            };
        }, [quarterFinals, semiFinals, final]);
        
        // 이 함수는 더 이상 사용되지 않음 - 탭별로 개별 렌더링
        return null;
    };

    const renderBracketForTab = (tab: typeof activeTabData) => {
        const tabMaxW = compact ? 'max-w-[210px]' : 'max-w-[280px]';
        const tabStackClass = compact
            ? 'flex h-full flex-col items-center justify-start gap-2 overflow-x-visible overflow-y-auto p-2'
            : 'flex h-full flex-col items-center justify-start gap-4 overflow-x-visible overflow-y-auto p-4';
        // 전국바둑대회/월드챔피언십: 탭별로 세로 배치
        if (tournamentType === 'national' || tournamentType === 'world') {
            if (tab.name === "결승&3/4위전") {
                const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '결승');
                const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '3,4위전');
                // 부모 컨테이너의 높이가 자동으로 조정되므로 h-full 사용
                return (
                    <div className={tabStackClass}>
                        {finalMatch.length > 0 && (
                            <div className={`w-full pb-2 ${tabMaxW}`}>
                                <MatchBox
                                    match={finalMatch[0]}
                                    currentUser={currentUser}
                                    tournamentState={tournamentState}
                                    compact={compact}
                                />
                            </div>
                        )}
                        {thirdPlaceMatch.length > 0 && (
                            <div className={`w-full pb-2 ${tabMaxW}`}>
                                <MatchBox
                                    match={thirdPlaceMatch[0]}
                                    currentUser={currentUser}
                                    tournamentState={tournamentState}
                                    compact={compact}
                                />
                            </div>
                        )}
                    </div>
                );
            }
            
            // 16강, 8강, 4강전: 세로로 배치
            // 부모 컨테이너의 높이가 자동으로 조정되므로 h-full 사용하여 모든 공간 활용
            // 승자 패널이 잘리지 않도록 overflow-x-visible 및 패딩 추가
            // 보상 패널은 사이드바 레이아웃에서 flex-shrink-0으로 고정되어 있어 자동으로 공간 확보됨
            return (
                <div className={tabStackClass}>
                    {tab.matches.map((match) => (
                        <div key={match.id} className={`w-full pb-2 ${tabMaxW}`}>
                            <MatchBox match={match} currentUser={currentUser} tournamentState={tournamentState} compact={compact} />
                        </div>
                    ))}
                </div>
            );
        }

        // 동네바둑리그: 기존 방식 유지
        if (tab.name === "결승 및 3/4위전") {
             const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '결승');
             const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '3,4위전');
             return (
                <div
                    className={`flex h-full flex-col items-center justify-center ${compact ? 'gap-4 p-2' : 'gap-8 p-4'}`}
                >
                    {finalMatch.length > 0 && (
                        <div className={`w-full ${compact ? 'max-w-[168px]' : 'max-w-[200px]'}`}>
                            <MatchBox
                                match={finalMatch[0]}
                                currentUser={currentUser}
                                tournamentState={tournamentState}
                                compact={compact}
                            />
                        </div>
                    )}
                    {thirdPlaceMatch.length > 0 && (
                        <div className={`w-full ${compact ? 'max-w-[168px]' : 'max-w-[200px]'}`}>
                            <MatchBox
                                match={thirdPlaceMatch[0]}
                                currentUser={currentUser}
                                tournamentState={tournamentState}
                                compact={compact}
                            />
                        </div>
                    )}
                </div>
             );
        }

        return (
             <div className={`flex h-full items-center justify-center ${compact ? 'gap-2 p-2' : 'gap-4 p-4'}`}>
                <RoundColumn
                    name={tab.name}
                    matches={tab.matches}
                    currentUser={currentUser}
                    tournamentState={tournamentState}
                    compact={compact}
                />
            </div>
        );
    }

    // 보상 패널이 표시될 때 대진표가 적절히 조정되도록 함
    // 사이드바의 flex 레이아웃이 자동으로 높이를 조정하므로, 내부에서 추가로 높이 제한하지 않음
    return (
        <div className="flex h-full min-h-0 flex-col">
            <h4 className={`flex-shrink-0 text-center font-bold text-gray-200 ${compact ? 'mb-1.5 text-sm' : 'mb-3 text-lg'}`}>대진표</h4>
            <div
                className={`flex flex-shrink-0 rounded-xl border border-gray-600/70 bg-gradient-to-r from-slate-950/95 to-slate-900/92 shadow-lg backdrop-blur-md ${compact ? 'mb-2 p-0.5' : 'mb-3 p-1'}`}
            >
                {getRoundsForTabs.map((tab, index) => (
                    <button
                        key={tab.name}
                        onClick={() => setActiveTab(index)}
                        className={`flex-1 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                            compact ? 'py-1' : 'py-2'
                        } ${
                            tab.name === "결승&3/4위전"
                                ? compact
                                    ? 'text-[8px]'
                                    : 'text-[10px]'
                                : compact
                                  ? 'text-[10px]'
                                  : 'text-xs'
                        } ${
                            activeTab === index 
                                ? `bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg ${compact ? '' : 'scale-105'}` 
                                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                        }`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>
            {/* 대진표 내용 영역 - flex-grow로 남은 공간을 모두 사용하고, 스크롤 가능하도록 설정 */}
            <div className="flex-1 overflow-hidden overflow-x-visible min-h-0">
                {activeTabData && renderBracketForTab(activeTabData)}
            </div>
        </div>
    );
};

export const TournamentBracket: React.FC<TournamentBracketProps> = (props) => {
    const { tournament, currentUser, onBack, allUsersForRanking, onViewUser, onAction, onStartNextRound, onReset, onSkip, onOpenShop, isMobile } = props;
    
    /** 1회차 경기 시작 전에만 true. 경기 시작 후·종료 후에는 컨디션 회복제 버튼 비활성화 */
    const canUseConditionPotion = Boolean(
        tournament?.status === 'bracket_ready' &&
        tournament?.rounds &&
        !tournament.rounds.some((r: { matches?: Array<{ isUserMatch?: boolean; isFinished?: boolean }> }) =>
            r.matches?.some((m: { isUserMatch?: boolean; isFinished?: boolean }) => m.isUserMatch && m.isFinished)
        )
    );
    
    // React 훅 규칙: 모든 훅은 조건문 밖에서 호출되어야 함
    const [lastUserMatchSgfIndex, setLastUserMatchSgfIndex] = useState<number | null>(null);
    const [initialMatchPlayers, setInitialMatchPlayers] = useState<{ p1: PlayerForTournament | null, p2: PlayerForTournament | null }>({ p1: null, p2: null });
    const [showConditionPotionModal, setShowConditionPotionModal] = useState(false);
    /** 모바일 챔피언십 경기장: 대국자정보 / 실시간중계 / 바둑판 / 대진표 / 보상정보 */
    const [mobileChampionshipTab, setMobileChampionshipTab] = useState<'players' | 'board' | 'live' | 'bracket' | 'rewards'>('players');
    const [dungeonStageSummaryData, setDungeonStageSummaryData] = useState<{
        dungeonType: TournamentType;
        stage: number;
        tournamentState: TournamentState;
        userRank: number;
        wins: number;
        losses: number;
        baseRewards: {
            gold?: number;
            materials?: Record<string, number>;
            equipmentBoxes?: Record<string, number>;
            changeTickets?: number;
            changeTicketGrants?: { name: string; quantity: number }[];
        };
        rankReward?: {
            items?: Array<{ itemId: string; quantity?: number; min?: number; max?: number }>;
        };
        grantedEquipmentDrops?: Array<{ name: string; image: string }>;
        nextStageUnlocked: boolean;
        nextStageWasAlreadyUnlocked?: boolean;
        dailyScore?: number;
        previousRank?: number;
        currentRank?: number;
    } | null>(null);
    const [dungeonStageRewardRequested, setDungeonStageRewardRequested] = useState(false);
    const [mobileRewardClaimBusy, setMobileRewardClaimBusy] = useState(false);
    const prevStatusRef = useRef(tournament?.status || 'bracket_ready');
    const initialMatchPlayersSetRef = useRef(false);
    const [nextRoundTrigger, setNextRoundTrigger] = useState(0);
    const p1ProfileRef = useRef<HTMLDivElement>(null);
    const p2ProfileRef = useRef<HTMLDivElement>(null);
    const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null); // 자동 다음 경기 카운트다운
    const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
    const nextRoundStartTimeCheckRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<number>(0); // 카운트다운 값을 저장하는 ref
    const hasAutoStartedRef = useRef(false); // 오늘 처음 입장했는지 확인
    const tournamentRef = useRef<TournamentState | undefined>(tournament); // 최신 tournament 상태를 ref로 저장
    const autoStartTimeRef = useRef<number | null>(null); // 카운트다운 시작 시간을 저장하는 ref
    const savedStartTimeRef = useRef<number | null>(null); // nextRoundStartTime을 저장하는 ref
    /** 동일 nextRoundStartTime에 대해 START_TOURNAMENT_MATCH를 한 번만 보내기 (무한 재요청 방지) */
    const hasTriggeredStartForTimeRef = useRef<number | null>(null);
    /** 카운트다운 0 시 먼저 다음 회차 탭으로 전환한 뒤 시합 시작 (순서: 대진표 탭 이동 → 대국자 표시 → 시합 시작) */
    const [pendingRoundSwitchTo, setPendingRoundSwitchTo] = useState<number | null>(null);
    const pendingMatchStartRef = useRef<{ type: TournamentType } | null>(null);

    useEffect(() => {
        if (!tournament?.type || !currentUser) return;
        const rewardClaimedKey = `${tournament.type}RewardClaimed` as keyof User;
        if (currentUser[rewardClaimedKey]) setMobileRewardClaimBusy(false);
    }, [tournament, currentUser]);
    
    // 안전성 검사: tournament가 없으면 로딩 메시지 표시
    if (!tournament) {
        return (
            <div className="p-4 text-center">
                <p>토너먼트 정보를 불러오는 중입니다...</p>
            </div>
        );
    }
    
    // 안전성 검사: currentUser가 없으면 에러 메시지 표시
    if (!currentUser || !currentUser.id) {
        return (
            <div className="p-4 text-center">
                <p>사용자 정보를 불러오는 중입니다...</p>
            </div>
        );
    }
    
    const resolvedDungeonStageAttempt = resolveDungeonStageAttempt(tournament, currentUser, tournament.type);
    const isDungeonMode = resolvedDungeonStageAttempt >= 1;
    
    const handleCompleteDungeon = useCallback(async () => {
        const effectiveStage = resolveDungeonStageAttempt(tournament, currentUser, tournament.type);
        if (effectiveStage >= 1 && (tournament.status === 'complete' || tournament.status === 'eliminated')) {
            const stage = effectiveStage;
            const dungeonType = tournament.type;
            
            // 유저 플레이어 찾기
            const userPlayer = tournament.players.find(p => p.id === currentUser.id);
            if (!userPlayer) return;
            
            // 순위 계산 (wins/losses 기준, 모든 라운드의 경기 결과 확인)
            const playerWins: Record<string, number> = {};
            const playerLosses: Record<string, number> = {};
            tournament.players.forEach(p => { 
                playerWins[p.id] = 0; 
                playerLosses[p.id] = 0;
            });
            
            // 모든 라운드의 모든 경기 결과 확인
            tournament.rounds.forEach(round => {
                if (round.matches) {
                    round.matches.forEach(m => {
                        if (m.isFinished && m.winner) {
                            playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                            const loser = m.players.find(p => p && p.id !== m.winner?.id);
                            if (loser) {
                                playerLosses[loser.id] = (playerLosses[loser.id] || 0) + 1;
                            }
                        }
                    });
                }
            });
            
            // 순위 정렬: 승수 → 패수 → 승률
            const rankedPlayers = [...tournament.players].sort((a, b) => {
                if (playerWins[b.id] !== playerWins[a.id]) {
                    return playerWins[b.id] - playerWins[a.id];
                }
                if (playerLosses[a.id] !== playerLosses[b.id]) {
                    return playerLosses[a.id] - playerLosses[b.id];
                }
                const aWinRate = (playerWins[a.id] + playerLosses[a.id]) > 0 ? playerWins[a.id] / (playerWins[a.id] + playerLosses[a.id]) : 0;
                const bWinRate = (playerWins[b.id] + playerLosses[b.id]) > 0 ? playerWins[b.id] / (playerWins[b.id] + playerLosses[b.id]) : 0;
                return bWinRate - aWinRate;
            });
            const userRank = rankedPlayers.findIndex(p => p.id === currentUser.id) + 1;
            
            // 실제 승/패 수집
            const userWins = playerWins[currentUser.id] || 0;
            const userLosses = playerLosses[currentUser.id] || 0;
            
            // 기본 보상 수집
            const baseRewards: {
                gold?: number;
                materials?: Record<string, number>;
                equipmentBoxes?: Record<string, number>;
                changeTickets?: number;
                changeTicketGrants?: { name: string; quantity: number }[];
            } = {};
            
            if (tournament.accumulatedGold) {
                baseRewards.gold = tournament.accumulatedGold;
            }
            if (tournament.accumulatedMaterials) {
                baseRewards.materials = tournament.accumulatedMaterials;
            }
            if (tournament.accumulatedEquipmentBoxes) {
                baseRewards.equipmentBoxes = tournament.accumulatedEquipmentBoxes;
            }
            
            // 변경권은 월드챔피언십의 장비상자 보상에 포함
            if (dungeonType === 'world' && DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage]?.changeTickets) {
                baseRewards.changeTickets = DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage].changeTickets;
            }
            
            // 순위 보상 (표시용 = 범위값 min~max)
            const cleared = userRank <= (dungeonType === 'neighborhood' ? 6 : dungeonType === 'national' ? 8 : 16);
            const rankRewardRange = cleared ? getDungeonRankRewardRangeForDisplay(dungeonType, stage, userRank) ?? undefined : undefined;
            const rankReward = rankRewardRange?.items?.length ? { items: rankRewardRange.items } : undefined;
            
            // 다음 단계 언락 여부 확인
            // 서버에서 userRank <= 3일 때 stage + 1을 언락하므로, userRank <= 3이면 언락됨
            // 모달은 서버 응답 전에 표시되므로, userRank <= 3이면 언락될 것으로 예상
            const dungeonProgress = currentUser.dungeonProgress?.[dungeonType];
            // 서버 응답을 받기 전이므로, userRank가 1~3이면 언락될 것으로 예상
            // 서버 응답 후 useEffect에서 실제 언락 상태로 업데이트됨
            const nextStage = stage + 1;
            // 1위, 2위, 3위를 달성했으면 다음 단계가 언락됨 (서버 응답 전이어도 예상값 사용)
            const nextStageUnlocked = userRank >= 1 && userRank <= 3 && stage < 10 && (
                dungeonProgress?.unlockedStages?.includes(nextStage) || userRank <= 3 // 서버 응답 전이어도 1~3위면 언락 예상
            );
            
            // 일일 랭킹 점수: 대기실 일일 획득 가능 점수표와 동일 (getDungeonStageScore)
            const dailyScore = getDungeonStageScore(dungeonType, stage, userRank);
            
            // 이전 순위 (일일 랭킹에서 가져오기)
            const previousRank = currentUser.dailyRankings?.championship?.[dungeonType]?.rank;
            
            // 현재 순위 계산 (allUsersForRanking을 사용하여 실시간 계산)
            let currentRank: number | undefined = undefined;
            if (allUsersForRanking && allUsersForRanking.length > 0) {
                // 챔피언십 랭킹 계산 (던전 시스템: 최고 클리어 단계 기준)
                const usersWithProgress = allUsersForRanking
                    .filter(u => {
                        if (!u || !u.id) return false;
                        if (!u.dungeonProgress || !u.dungeonProgress[dungeonType]) return false;
                        const progress = u.dungeonProgress[dungeonType];
                        return progress && progress.currentStage > 0;
                    })
                    .map(u => {
                        const progress = u.dungeonProgress![dungeonType];
                        let maxStage = progress.currentStage || 0;
                        let maxScoreDiff = -Infinity;
                        
                        // 같은 단계면 점수차이 큰 순서
                        for (const [stageStr, result] of Object.entries(progress.stageResults || {})) {
                            const res = result as any;
                            if (res.cleared && parseInt(stageStr) === maxStage) {
                                if (res.scoreDiff > maxScoreDiff) {
                                    maxScoreDiff = res.scoreDiff;
                                }
                            }
                        }
                        
                        // 6가지 능력치 합계 계산
                        let totalAbility = 0;
                        if (u.baseStats) {
                            totalAbility = Object.values(u.baseStats).reduce((sum: number, stat: any) => sum + (stat || 0), 0);
                        }
                        
                        return {
                            user: u,
                            maxStage,
                            maxScoreDiff: maxScoreDiff === -Infinity ? 0 : maxScoreDiff,
                            totalAbility
                        };
                    })
                    .sort((a, b) => {
                        // 1순위: 최고 클리어 단계 (높은 순서)
                        if (a.maxStage !== b.maxStage) {
                            return b.maxStage - a.maxStage;
                        }
                        // 2순위: 점수차이 (큰 순서)
                        if (a.maxScoreDiff !== b.maxScoreDiff) {
                            return b.maxScoreDiff - a.maxScoreDiff;
                        }
                        // 3순위: 능력치 합계 (큰 순서)
                        return b.totalAbility - a.totalAbility;
                    });
                
                const userRankIndex = usersWithProgress.findIndex(entry => entry.user.id === currentUser.id);
                if (userRankIndex !== -1) {
                    currentRank = userRankIndex + 1;
                }
            }
            
            type DungeonRes = { userRank: number; userWins: number; userLosses: number; baseRewards: Record<string, unknown>; grantedRankReward?: { items: Array<{ itemId: string; quantity: number }> }; grantedEquipmentDrops?: Array<{ name: string; image: string }>; nextStageUnlocked: boolean; nextStageWasAlreadyUnlocked?: boolean; dailyScore?: number; dungeonState?: TournamentState };
            const raw = (await (onAction({ type: 'COMPLETE_DUNGEON_STAGE', payload: { dungeonType, stage } }) as unknown as Promise<unknown>)) as { error?: string; clientResponse?: DungeonRes } | DungeonRes | undefined;
            const res: DungeonRes | null = raw && typeof raw === 'object' && !(raw as { error?: string }).error ? ((raw as { clientResponse?: DungeonRes }).clientResponse ?? (raw as DungeonRes)) : null;
            if (!res || res.userRank == null) return;
            const dailyScoreFromRes = res.dailyScore ?? getDungeonStageScore(dungeonType, stage, res.userRank);
            let currentRankRes: number | undefined;
            if (allUsersForRanking?.length) {
                const usersWithProgress = allUsersForRanking
                    .filter(u => u?.id && u.dungeonProgress?.[dungeonType] && (u.dungeonProgress[dungeonType] as any).currentStage > 0)
                    .map(u => {
                        const progress = u.dungeonProgress![dungeonType];
                        let maxStage = progress.currentStage || 0;
                        let maxScoreDiff = -Infinity;
                        for (const [stageStr, sr] of Object.entries(progress.stageResults || {})) {
                            const r = sr as any;
                            if (r?.cleared && parseInt(stageStr) === maxStage && r.scoreDiff > maxScoreDiff) maxScoreDiff = r.scoreDiff;
                        }
                        let totalAbility = 0;
                        if (u.baseStats) totalAbility = Object.values(u.baseStats).reduce((s: number, v: any) => s + (v || 0), 0);
                        return { user: u, maxStage, maxScoreDiff: maxScoreDiff === -Infinity ? 0 : maxScoreDiff, totalAbility };
                    })
                    .sort((a, b) => b.maxStage - a.maxStage || b.maxScoreDiff - a.maxScoreDiff || b.totalAbility - a.totalAbility);
                const idx = usersWithProgress.findIndex(e => e.user.id === currentUser.id);
                if (idx !== -1) currentRankRes = idx + 1;
            }
            setDungeonStageSummaryData({
                dungeonType,
                stage,
                tournamentState: (res.dungeonState ?? tournament) as TournamentState,
                userRank: res.userRank,
                wins: res.userWins,
                losses: res.userLosses,
                baseRewards: (res.baseRewards ?? {}) as {
                    gold?: number;
                    materials?: Record<string, number>;
                    equipmentBoxes?: Record<string, number>;
                    changeTickets?: number;
                    changeTicketGrants?: { name: string; quantity: number }[];
                },
                rankReward: res.grantedRankReward ? { items: res.grantedRankReward.items.map(it => ({ itemId: it.itemId, quantity: it.quantity })) } : undefined,
                grantedEquipmentDrops: res.grantedEquipmentDrops,
                nextStageUnlocked: !!res.nextStageUnlocked,
                nextStageWasAlreadyUnlocked: !!res.nextStageWasAlreadyUnlocked,
                dailyScore: dailyScoreFromRes,
                previousRank: currentUser.dailyRankings?.championship?.[dungeonType]?.rank,
                currentRank: currentRankRes
            });
            // 모달이 뜬 뒤에만 보상 수령 완료로 표시 (보상받기 → 보상 완료 전환)
            setDungeonStageRewardRequested(true);
        }
    }, [tournament, currentUser.id, currentUser.dungeonProgress, currentUser.dailyRankings, allUsersForRanking, onAction]);

    const handleOpenRewardHistory = useCallback(() => {
        const summary = tournament?.claimedRewardSummary;
        if (!summary || !tournament) return;

        setDungeonStageSummaryData({
            dungeonType: tournament.type,
            stage: summary.stage,
            tournamentState: tournament,
            userRank: summary.userRank,
            wins: summary.wins,
            losses: summary.losses,
            baseRewards: summary.baseRewards,
            rankReward: summary.rankReward,
            grantedEquipmentDrops: summary.grantedEquipmentDrops,
            nextStageUnlocked: summary.nextStageUnlocked,
            nextStageWasAlreadyUnlocked: summary.nextStageWasAlreadyUnlocked,
            dailyScore: summary.dailyScore,
            previousRank: undefined,
            currentRank: undefined,
        });
    }, [tournament]);
    
    // 서버 응답 후 모달 데이터 업데이트 (다음 단계 언락 상태 반영)
    // 1·2·3위만 다음 단계 열림. 4위 이하는 unlockedStages에 다음 단계가 있어도 표시하지 않음
    useEffect(() => {
        if (dungeonStageSummaryData && currentUser.dungeonProgress) {
            const dungeonProgress = currentUser.dungeonProgress[dungeonStageSummaryData.dungeonType];
            if (dungeonProgress) {
                const nextStage = dungeonStageSummaryData.stage + 1;
                const isTopThree = dungeonStageSummaryData.userRank >= 1 && dungeonStageSummaryData.userRank <= 3;
                const stageUnderMax = dungeonStageSummaryData.stage < 10;
                const nextInList = dungeonProgress.unlockedStages?.includes(nextStage) ?? false;
                const nextStageUnlocked = isTopThree && stageUnderMax && nextInList;
                
                if (nextStageUnlocked !== dungeonStageSummaryData.nextStageUnlocked) {
                    setDungeonStageSummaryData(prev => prev ? { ...prev, nextStageUnlocked } : null);
                }
            }
        }
    }, [currentUser.dungeonProgress, currentUser.neighborhoodRewardClaimed, currentUser.nationalRewardClaimed, currentUser.worldRewardClaimed, dungeonStageSummaryData]);
    
    // 클라이언트에서 시뮬레이션 실행
    const simulatedTournament = useTournamentSimulation(tournament, currentUser);
    const displayTournament = simulatedTournament || tournament;
    
    const safeRounds = useMemo(() => {
        if (!tournament || !Array.isArray(tournament.rounds)) {
            return [];
        }
        return tournament.rounds;
    }, [tournament?.rounds]);

    const functionVipActive = useMemo(() => isFunctionVipActive(currentUser as User), [currentUser]);

    /** 챔피언십 던전(currentStageAttempt)에서 SKIP 노출·클릭 가능 여부 */
    const championshipDungeonSkipUi = useMemo(() => {
        const t = tournament;
        if (!t || t.currentStageAttempt == null) return { visible: false, canAttempt: false };
        if (t.status === 'complete' || t.status === 'eliminated') return { visible: false, canAttempt: false };

        const hasUnfinishedUserMatch = safeRounds.some((r) =>
            Array.isArray(r?.matches) && r.matches.some((m) => m.isUserMatch && !m.isFinished)
        );
        if (!hasUnfinishedUserMatch) return { visible: false, canAttempt: false };

        if (t.status === 'round_in_progress') {
            return { visible: true, canAttempt: true };
        }

        let nextMatch: Match | undefined;
        if (t.type === 'neighborhood') {
            const currentRound = t.currentRoundRobinRound || 1;
            const currentRoundObj = safeRounds.find((r) => r.name === `${currentRound}회차`);
            if (currentRoundObj) {
                nextMatch = currentRoundObj.matches.find((m) => m.isUserMatch && !m.isFinished);
            }
        } else {
            nextMatch = safeRounds.flatMap((r) => r.matches).find((m) => m.isUserMatch && !m.isFinished);
        }
        const p1 =
            nextMatch && Array.isArray(t.players) ? t.players.find((p) => p.id === nextMatch!.players[0]?.id) : null;
        const p2 =
            nextMatch && Array.isArray(t.players) ? t.players.find((p) => p.id === nextMatch!.players[1]?.id) : null;
        const playersReady = Boolean(
            p1 &&
                p2 &&
                p1.stats &&
                p2.stats &&
                Object.keys(p1.stats).length > 0 &&
                Object.keys(p2.stats).length > 0
        );

        if (t.status === 'bracket_ready' || t.status === 'round_complete') {
            return { visible: true, canAttempt: playersReady };
        }
        return { visible: false, canAttempt: false };
    }, [tournament, safeRounds]);
    
    // 토너먼트 상태 로깅
    useEffect(() => {
        if (tournament) {
            console.log('[TournamentBracket] 토너먼트 상태:', tournament.status, '타입:', tournament.type, '현재 회차:', tournament.currentRoundRobinRound);
        }
    }, [tournament?.status, tournament?.type, tournament?.currentRoundRobinRound]);

    useEffect(() => {
        if (currentUser?.id) {
            console.log('[TournamentBracket] ENTER_TOURNAMENT_VIEW 호출');
            onAction({ type: 'ENTER_TOURNAMENT_VIEW' });
            return () => {
                console.log('[TournamentBracket] LEAVE_TOURNAMENT_VIEW 호출');
                onAction({ type: 'LEAVE_TOURNAMENT_VIEW' });
            };
        }
    }, [onAction, currentUser?.id]);

    // 자동 다음 경기 진행 로직
    useEffect(() => {
        // 안전성 검사: 필수 props와 데이터 확인
        if (!tournament || !onAction || !onStartNextRound || !Array.isArray(safeRounds)) {
            console.log('[TournamentBracket] useEffect 스킵 - 필수 데이터 없음:', {
                tournament: !!tournament,
                onAction: !!onAction,
                onStartNextRound: !!onStartNextRound,
                safeRounds: Array.isArray(safeRounds)
            });
            return;
        }
        
        const status = tournament.status;
        const prevStatus = prevStatusRef.current;
        
        // 상태 변경 로깅
        if (status !== prevStatus) {
            console.log('[TournamentBracket] 상태 변경:', prevStatus, '->', status, 'tournament.type:', tournament.type);
        } else {
            console.log('[TournamentBracket] 현재 상태:', status, '이전 상태:', prevStatus);
        }
        
        // 서버에서 자동으로 다음 경기를 시작하므로 클라이언트는 단순히 상태 변경을 감지
        // bracket_ready 상태일 때는 카운트다운 타이머가 nextRoundStartTime 전용 effect에서만 관리됨.
        // 이 effect에서는 타이머를 정리하지 않음 (currentRoundRobinRound/safeRounds 변경 시 cleanup이
        // 호출되어 카운트다운이 5에서 멈추는 버그 방지).
        // round_in_progress / complete / eliminated 로 바뀐 경우에만 타이머 정리
        if (status === 'round_in_progress' || status === 'complete' || status === 'eliminated') {
            if (autoNextTimerRef.current) {
                clearInterval(autoNextTimerRef.current);
                autoNextTimerRef.current = null;
            }
            setAutoNextCountdown(null);
        }
        
        // prevStatusRef 업데이트
        prevStatusRef.current = status;
        
        // cleanup에서 타이머를 건드리지 않음 (카운트다운은 nextRoundStartTime effect에서만 관리)
        return () => {};
    }, [tournament?.status, tournament?.type, tournament?.currentRoundRobinRound, safeRounds, onStartNextRound, onAction, currentUser?.id]);
    
    // tournament ref 업데이트 - 항상 최신 상태 유지
    useEffect(() => {
        tournamentRef.current = tournament;
        // nextRoundStartTime이 변경되었을 때 로그 출력
        if (tournament?.nextRoundStartTime) {
            console.log(`[TournamentBracket] Tournament ref updated, nextRoundStartTime: ${tournament.nextRoundStartTime}, status: ${tournament.status}, currentRound: ${tournament.currentRoundRobinRound}`);
        }
    }, [tournament]);

    // onAction ref로 저장 (클로저 문제 방지)
    const onActionRef = useRef(onAction);
    useEffect(() => {
        onActionRef.current = onAction;
    }, [onAction]);

    // nextRoundStartTime 체크: 5초 카운트다운 후 자동으로 경기 시작
    useEffect(() => {
        const nextRoundStartTime = tournament?.nextRoundStartTime;
        const status = tournament?.status;
        
        // nextRoundStartTime이 없을 때: 이미 카운트다운이 진행 중이면 유지(잠깐 undefined 오는 경우 대비)
        if (!nextRoundStartTime) {
            const saved = savedStartTimeRef.current;
            if (saved != null && Date.now() < saved && autoNextTimerRef.current) {
                return; // 이미 동일 회차 카운트다운 진행 중 → 타이머 유지
            }
            setAutoNextCountdown(null);
            if (autoNextTimerRef.current) {
                clearInterval(autoNextTimerRef.current);
                autoNextTimerRef.current = null;
            }
            countdownRef.current = 0;
            autoStartTimeRef.current = null;
            savedStartTimeRef.current = null;
            hasTriggeredStartForTimeRef.current = null;
            return;
        }

        // 기존 타이머가 있고 같은 startTime이면 재설정하지 않음 (중복 실행 방지)
        if (autoNextTimerRef.current && savedStartTimeRef.current === nextRoundStartTime) {
            return;
        }

        // 기존 타이머가 있으면 정리
        if (autoNextTimerRef.current) {
            clearInterval(autoNextTimerRef.current);
            autoNextTimerRef.current = null;
        }

        // nextRoundStartTime을 ref에 저장하여 타이머가 중단되지 않도록 함 (새 회차면 트리거 플래그 초기화)
        savedStartTimeRef.current = nextRoundStartTime;
        autoStartTimeRef.current = nextRoundStartTime;
        hasTriggeredStartForTimeRef.current = null;
        const savedTournamentType = tournament?.type;
        const savedCurrentRound = tournament?.currentRoundRobinRound;

        const updateCountdown = () => {
            // savedStartTimeRef를 사용하여 타이머가 중단되지 않도록 함
            const startTime = savedStartTimeRef.current;
            if (!startTime) {
                // startTime이 없으면 타이머 정리
                setAutoNextCountdown(null);
                countdownRef.current = 0;
                if (autoNextTimerRef.current) {
                    clearInterval(autoNextTimerRef.current);
                    autoNextTimerRef.current = null;
                }
                return;
            }

            const now = Date.now();
            const timeUntilStart = startTime - now;
            const secondsLeft = Math.max(0, Math.ceil(timeUntilStart / 1000));

            // 항상 카운트다운 업데이트 (0까지 표시)
            setAutoNextCountdown(secondsLeft);

            // 디버깅: 매 초마다 로그 출력 (초가 변경될 때만)
            if (countdownRef.current !== secondsLeft) {
                countdownRef.current = secondsLeft;
                if (secondsLeft > 0) {
                    console.log(`[TournamentBracket] Countdown: ${secondsLeft}초 남음 (startTime: ${startTime}, now: ${now}, diff: ${timeUntilStart}ms)`);
                } else {
                    console.log(`[TournamentBracket] Countdown reached 0, starting match...`);
                }
            }

            // 시간이 지났거나 0에 도달했을 때 경기 시작
            if (timeUntilStart <= 0) {
                // 카운트다운이 끝났으면 바로 경기 시작
                setAutoNextCountdown(null);
                countdownRef.current = 0;
                if (autoNextTimerRef.current) {
                    clearInterval(autoNextTimerRef.current);
                    autoNextTimerRef.current = null;
                }
                autoStartTimeRef.current = null;
                savedStartTimeRef.current = null;
                
                // 다음 경기 찾기 - tournamentRef.current를 사용하여 최신 상태 확인
                const currentTournament = tournamentRef.current;
                const rounds = currentTournament?.rounds || [];
                let nextMatch: Match | undefined = undefined;
                const tournamentType = currentTournament?.type || savedTournamentType;
                const currentRound = currentTournament?.currentRoundRobinRound || savedCurrentRound;
                
                let roundNumForTab: number | null = currentRound ?? null;
                if (tournamentType === 'neighborhood') {
                    // currentRoundRobinRound가 있으면 사용
                    if (currentRound) {
                        const currentRoundObj = rounds.find(r => r.name === `${currentRound}회차`);
                        if (currentRoundObj) {
                            nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        }
                    }
                    // currentRoundRobinRound가 없거나 경기를 찾지 못한 경우 모든 라운드에서 찾기
                    if (!nextMatch) {
                        for (const round of rounds) {
                            const match = round.matches.find(m => m.isUserMatch && !m.isFinished);
                            if (match) {
                                nextMatch = match;
                                const parsed = parseInt(round.name.replace('회차', ''), 10);
                                roundNumForTab = Number.isNaN(parsed) ? null : parsed;
                                break;
                            }
                        }
                    }
                } else {
                    // 전국/월드챔피언십: 다음 경기 찾기
                    nextMatch = rounds
                        .flatMap(r => r.matches)
                        .find(m => m.isUserMatch && !m.isFinished);
                }

                // 경기를 찾았으면: 동일 startTime에 대해 한 번만 전송 (무한 재요청/무한루프 방지)
                if (nextMatch) {
                    if (hasTriggeredStartForTimeRef.current === startTime) {
                        return; // 이미 이 시각에 대해 시작 요청 보냄 → 중복 전송 방지
                    }
                    hasTriggeredStartForTimeRef.current = startTime;
                    console.log('[TournamentBracket] Auto-starting match after countdown', {
                        nextMatch: nextMatch.id,
                        status: currentTournament?.status,
                        type: tournamentType,
                        roundNumForTab
                    });
                    if (tournamentType === 'neighborhood' && roundNumForTab != null) {
                        // 순서: 1) 다음 회차 탭 이동 요청 → 2) 2회차 대국자 갱신 및 바둑판 초기화 → 3) 150ms 후 시합 시작
                        setPendingRoundSwitchTo(roundNumForTab);
                        pendingMatchStartRef.current = { type: 'neighborhood' as TournamentType };
                        setLastUserMatchSgfIndex(null);
                        const players = currentTournament?.players;
                        if (Array.isArray(players)) {
                            const p1 = players.find((p: PlayerForTournament) => p.id === nextMatch!.players[0]?.id) || null;
                            const p2 = players.find((p: PlayerForTournament) => p.id === nextMatch!.players[1]?.id) || null;
                            const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => ({
                                ...player,
                                stats: (player.originalStats || player.stats) ? { ...(player.originalStats || player.stats)! } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            });
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    } else {
                        onActionRef.current({
                            type: 'START_TOURNAMENT_MATCH',
                            payload: { type: tournamentType || 'neighborhood' }
                        });
                    }
                } else {
                    console.warn('[TournamentBracket] Cannot auto-start match: no next match found', {
                        status: currentTournament?.status,
                        type: tournamentType,
                        roundNumForTab,
                        roundsCount: rounds.length
                    });
                }
            }
        };

        // 즉시 한 번 실행하고 타이머 시작
        const timeUntilStart = savedStartTimeRef.current - Date.now();
        console.log(`[TournamentBracket] nextRoundStartTime detected: ${savedStartTimeRef.current}, current time: ${Date.now()}, time until start: ${timeUntilStart}ms, status: ${status}`);
        
        // 이미 시간이 지나간 경우 즉시 시작
        if (timeUntilStart <= 0) {
            console.log(`[TournamentBracket] nextRoundStartTime already passed, starting match immediately`);
            updateCountdown(); // 이 함수 내에서 자동 시작 처리
        } else {
            updateCountdown();
            // 100ms마다 업데이트하여 정확한 카운트다운 유지
            autoNextTimerRef.current = setInterval(updateCountdown, 100);
        }

        return () => {
            // cleanup: nextRoundStartTime이 변경될 때만 타이머 정리
            // 하지만 savedStartTimeRef를 사용하므로 타이머는 계속 실행됨
        };
    }, [tournament?.nextRoundStartTime]); // nextRoundStartTime만 의존성으로 사용하여 타이머가 중단되지 않도록 함
    
    // 다음 회차 탭 전환 후 시합 자동 시작 (동네 챔피언십 순서 보장)
    useEffect(() => {
        if (pendingRoundSwitchTo == null || !pendingMatchStartRef.current) return;
        const payload = pendingMatchStartRef.current;
        const t = setTimeout(() => {
            onActionRef.current({
                type: 'START_TOURNAMENT_MATCH',
                payload: { type: payload.type }
            });
            pendingMatchStartRef.current = null;
            // pendingRoundSwitchTo는 서버가 round_in_progress로 바꿀 때만 초기화 (아래 useEffect).
            // 그 전에 null로 만들면 3회차→ 등에서 다시 lastFinishedUserMatch(2회차)가 보이는 문제 방지.
        }, 150);
        return () => clearTimeout(t);
    }, [pendingRoundSwitchTo]);

    // round_in_progress로 전환되면 pending 회차 표시 해제 (이후 회차도 순차 표시 유지)
    // 동네바둑리그 5회차 직후: 클라이언트가 round_in_progress를 건너뛰고 complete만 받으면 pending이 남아
    // SGF가 비고(아래 fileIndex가 null) 보상 패널이 깨진 것처럼 보이는 문제가 생김 → complete/eliminated에서도 해제
    useEffect(() => {
        if (pendingRoundSwitchTo == null) return;
        const s = tournament?.status;
        if (s === 'round_in_progress' || s === 'complete' || s === 'eliminated') {
            setPendingRoundSwitchTo(null);
        }
    }, [tournament?.status, pendingRoundSwitchTo]);
    
    useEffect(() => {
        // 안전성 검사
        if (!tournament || !Array.isArray(safeRounds)) {
            return;
        }
        
        const status = tournament.status;
        const prevStatus = prevStatusRef.current;
    
        // 경기가 완료되면 마지막 유저 경기의 SGF 인덱스 저장 (모든 회차에서 동일하게 적용)
        if (status === 'round_complete' || status === 'eliminated' || status === 'complete') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch && lastFinishedUserMatch.sgfFileIndex !== undefined) {
                setLastUserMatchSgfIndex(lastFinishedUserMatch.sgfFileIndex);
            }
        } else if (status === 'bracket_ready') {
            // bracket_ready 상태일 때는 다음 경기가 있으면 준비 상태, 없으면 마지막 경기 완료 상태
            // 다음 경기가 있으면 SGF 인덱스 초기화 (빈 바둑판 표시)
            // 다음 경기가 없으면 (마지막 경기였으면) 마지막 완료된 경기의 SGF를 유지
            const hasNextMatch = safeRounds.some(r => 
                r.matches.some(m => m.isUserMatch && !m.isFinished)
            );
            
            // round_complete에서 bracket_ready로 변경될 때: 카운트다운 중이면 이전 경기 유지, 아니면 다음 경기 선수로 갱신
            if (prevStatus === 'round_complete' && hasNextMatch && tournament && Array.isArray(tournament.players)) {
                const countdownInProgress = tournament.nextRoundStartTime != null;
                if (!countdownInProgress) {
                    setInitialMatchPlayers({ p1: null, p2: null });
                    initialMatchPlayersSetRef.current = false;
                    let nextMatch: Match | undefined = undefined;
                    if (tournament.type === 'neighborhood') {
                        const currentRound = tournament.currentRoundRobinRound || 1;
                        const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
                        if (currentRoundObj) {
                            nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        }
                    } else {
                        nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
                    }
                    if (nextMatch) {
                        const p1 = tournament.players.find(p => p.id === nextMatch.players[0]?.id) || null;
                        const p2 = tournament.players.find(p => p.id === nextMatch.players[1]?.id) || null;
                        if (p1 || p2) {
                            const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => ({
                                ...player,
                                stats: (player.originalStats || player.stats) ? { ...(player.originalStats || player.stats)! } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            });
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                }
            }
            
            if (!hasNextMatch) {
                // 마지막 경기였으면 완료된 경기 화면 유지
                const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                if (lastFinishedUserMatch && lastFinishedUserMatch.sgfFileIndex !== undefined) {
                    setLastUserMatchSgfIndex(lastFinishedUserMatch.sgfFileIndex);
                }
            } else {
                // 다음 경기가 있으면: 카운트다운 중에는 마지막 수순 유지, 카운트다운 끝난 뒤에만 바둑판 초기화
                const countdownInProgress = tournament.nextRoundStartTime != null;
                if (!countdownInProgress) {
                    setLastUserMatchSgfIndex(null);
                }
            }
        } else if (status === 'round_in_progress' && tournament) {
            // 경기가 시작되면 초기 플레이어 상태 저장
            // timeElapsed가 0이거나 1일 때, 또는 이전 상태가 round_in_progress가 아니었을 때
            const matchInfo = tournament.currentSimulatingMatch;
            const isNewMatch = prevStatus !== 'round_in_progress';
            const isEarlyTime = tournament.timeElapsed === 0 || tournament.timeElapsed === 1;
            
            // bracket_ready에서 round_in_progress로 변경되었을 때는 항상 선수 정보 업데이트
            const shouldForceUpdate = isNewMatch || (isEarlyTime && !initialMatchPlayersSetRef.current);
            
            if (matchInfo && shouldForceUpdate) {
                const match = safeRounds[matchInfo.roundIndex]?.matches[matchInfo.matchIndex];
                if (match) {
                    const p1 = tournament.players.find(p => p.id === match.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === match.players[1]?.id) || null;
                    // originalStats를 포함한 깊은 복사로 초기 상태 저장
                    // originalStats가 있으면 그것을 사용, 없으면 현재 stats 사용
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        console.log('[TournamentBracket] 선수 정보 업데이트:', { 
                            p1Id: p1?.id, 
                            p2Id: p2?.id, 
                            isNewMatch, 
                            isEarlyTime, 
                            timeElapsed: tournament.timeElapsed 
                        });
                        
                        setInitialMatchPlayers({
                            p1: p1 ? createPlayerCopy(p1) : null,
                            p2: p2 ? createPlayerCopy(p2) : null,
                        });
                        initialMatchPlayersSetRef.current = true;
                    }
                }
            }
        } else {
            // status가 'round_in_progress'가 아닌 다른 상태일 때
            // 경기가 막 끝났지만 아직 서버에서 상태가 업데이트되지 않은 경우 (currentSimulatingMatch가 있지만 status가 round_in_progress가 아님)
            // 이 경우에도 마지막 경기의 선수 정보를 유지
            if (tournament.currentSimulatingMatch && (tournament.status !== 'round_in_progress')) {
                const matchInfo = tournament.currentSimulatingMatch;
                const match = safeRounds[matchInfo.roundIndex]?.matches[matchInfo.matchIndex];
                if (match) {
                    const p1 = tournament.players.find(p => p.id === match.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === match.players[1]?.id) || null;
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        // 이미 설정되어 있지 않거나 선수가 변경된 경우에만 업데이트
                        // 컨디션 변경도 감지하여 업데이트 (회복제 사용 등)
                        const conditionChanged = (initialMatchPlayers.p1 && p1 && initialMatchPlayers.p1.condition !== p1.condition) ||
                                                 (initialMatchPlayers.p2 && p2 && initialMatchPlayers.p2.condition !== p2.condition);
                        
                        const shouldUpdate = !initialMatchPlayersSetRef.current || 
                            initialMatchPlayers.p1?.id !== p1?.id || 
                            initialMatchPlayers.p2?.id !== p2?.id ||
                            conditionChanged;
                        
                        if (shouldUpdate) {
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                }
            }
            // round_complete 상태일 때는 마지막 완료된 경기의 선수 정보를 유지
            if (tournament.status === 'round_complete' || tournament.status === 'complete' || tournament.status === 'eliminated') {
                // 마지막 완료된 경기의 선수 정보를 찾아서 유지
                const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                if (lastFinishedUserMatch) {
                    const p1 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[1]?.id) || null;
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        // 이미 설정되어 있지 않거나 선수가 변경된 경우에만 업데이트
                        // 컨디션 변경도 감지하여 업데이트 (회복제 사용 등)
                        const conditionChanged = (initialMatchPlayers.p1 && p1 && initialMatchPlayers.p1.condition !== p1.condition) ||
                                                 (initialMatchPlayers.p2 && p2 && initialMatchPlayers.p2.condition !== p2.condition);
                        
                        const shouldUpdate = !initialMatchPlayersSetRef.current || 
                            initialMatchPlayers.p1?.id !== p1?.id || 
                            initialMatchPlayers.p2?.id !== p2?.id ||
                            conditionChanged;
                        
                        if (shouldUpdate) {
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                }
            } else if (tournament.status === 'bracket_ready') {
                const countdownInProgress = tournament.nextRoundStartTime != null;
                const lastFinishedUserMatchForPlayers = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                let nextMatch: Match | undefined = undefined;
                if (countdownInProgress && lastFinishedUserMatchForPlayers) {
                    nextMatch = lastFinishedUserMatchForPlayers;
                } else if (!countdownInProgress) {
                    if (tournament.type === 'neighborhood') {
                        const currentRound = tournament.currentRoundRobinRound || 1;
                        const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
                        if (currentRoundObj) {
                            nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        }
                    } else {
                        nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
                    }
                }
                
                if (nextMatch) {
                    const p1 = tournament.players.find(p => p.id === nextMatch.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === nextMatch.players[1]?.id) || null;
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        // 컨디션 변경도 감지하여 업데이트 (회복제 사용 등)
                        const conditionChanged = (initialMatchPlayers.p1 && p1 && initialMatchPlayers.p1.condition !== p1.condition) ||
                                                 (initialMatchPlayers.p2 && p2 && initialMatchPlayers.p2.condition !== p2.condition);
                        
                        // round_complete에서 bracket_ready로 변경될 때 (다음경기 버튼을 눌렀을 때) 강제로 갱신
                        const isTransitionFromRoundComplete = prevStatus === 'round_complete';
                        
                        // 선수 ID가 변경되었거나, 컨디션이 변경되었거나, initialMatchPlayersSetRef가 false이면 업데이트
                        // 특히 전국/월드챔피언십에서 다음 라운드로 이동할 때 선수 ID가 변경되므로 항상 확인
                        // round_complete에서 bracket_ready로 변경될 때는 항상 업데이트 (이전 경기 정보가 남아있을 수 있음)
                        const shouldUpdate = isTransitionFromRoundComplete ||
                            !initialMatchPlayersSetRef.current || 
                            initialMatchPlayers.p1?.id !== p1?.id || 
                            initialMatchPlayers.p2?.id !== p2?.id ||
                            conditionChanged ||
                            // rounds가 변경되었을 때도 업데이트 (다음 라운드 대진표가 생성되었을 때)
                            (tournament.type !== 'neighborhood' && safeRounds.length > 0);
                        
                        if (shouldUpdate) {
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                } else {
                    // 다음 경기가 없으면 마지막 완료된 경기의 선수 정보 유지
                    const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                    if (lastFinishedUserMatch) {
                        const p1 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[0]?.id) || null;
                        const p2 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[1]?.id) || null;
                        if (p1 || p2) {
                            const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                                const statsToUse = player.originalStats || player.stats;
                                return {
                                    ...player,
                                    stats: statsToUse ? { ...statsToUse } : player.stats,
                                    originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                                };
                            };
                            
                            const shouldUpdate = !initialMatchPlayersSetRef.current || 
                                initialMatchPlayers.p1?.id !== p1?.id || 
                                initialMatchPlayers.p2?.id !== p2?.id;
                            
                            if (shouldUpdate) {
                                setInitialMatchPlayers({
                                    p1: p1 ? createPlayerCopy(p1) : null,
                                    p2: p2 ? createPlayerCopy(p2) : null,
                                });
                                initialMatchPlayersSetRef.current = true;
                            }
                        }
                    } else {
                        // 완료된 경기도 없으면 초기화하지 않음 (이전 정보 유지)
                    }
                }
            }
        }
    
        prevStatusRef.current = status;
    }, [tournament?.status, tournament?.type, safeRounds]);
    
    // nextRoundTrigger가 변경되면 다음 경기의 선수 정보를 강제로 업데이트
    useEffect(() => {
        if (nextRoundTrigger > 0 && tournament.status === 'bracket_ready') {
            // 다음 경기 찾기
            let nextMatch: Match | undefined = undefined;
            if (tournament.type === 'neighborhood') {
                const currentRound = tournament.currentRoundRobinRound || 1;
                const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
                if (currentRoundObj) {
                    nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                }
            } else {
                // 전국/월드챔피언십: 다음 경기 찾기
                nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
            }
            
            if (nextMatch) {
                const p1 = tournament.players.find(p => p.id === nextMatch.players[0]?.id) || null;
                const p2 = tournament.players.find(p => p.id === nextMatch.players[1]?.id) || null;
                if (p1 || p2) {
                    const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                        const statsToUse = player.originalStats || player.stats;
                        return {
                            ...player,
                            stats: statsToUse ? { ...statsToUse } : player.stats,
                            originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                        };
                    };
                    
                    // nextRoundTrigger가 변경되었으므로 강제로 업데이트
                    setInitialMatchPlayers({
                        p1: p1 ? createPlayerCopy(p1) : null,
                        p2: p2 ? createPlayerCopy(p2) : null,
                    });
                    initialMatchPlayersSetRef.current = true;
                }
            }
        }
    }, [nextRoundTrigger, tournament.status, tournament.type, tournament.players, safeRounds]);
    
    const handleBackClickRaw = useCallback(() => {
        if (tournament.status === 'round_in_progress') {
            // 경기 진행 중 뒤로가기: 일시정지(LEAVE) 후 로비로 이동 → 로비에서 "진행중.." + 이어보기 표시
            onAction({ type: 'LEAVE_TOURNAMENT_VIEW' });
            onBack();
        } else if (tournament.status === 'bracket_ready' || tournament.status === 'round_complete') {
            // 경기 시작 전(대기실만 본 상태) 뒤로가기: 세션 초기화 후 로비에서 최초 상태(단계 선택 + 입장) 유지
            onAction({ type: 'CLEAR_TOURNAMENT_SESSION', payload: { type: tournament.type } });
            onBack();
        } else {
            onBack();
        }
    }, [onBack, onAction, tournament.status, tournament.type]);

    const handleForfeitClickRaw = useCallback(() => {
        if (window.confirm('토너먼트를 포기하고 나가시겠습니까? 오늘의 참가 기회는 사라집니다.')) {
            onAction({ type: 'FORFEIT_TOURNAMENT', payload: { type: tournament.type } });
        }
    }, [onAction, tournament.type]);

    // 버튼 클릭 스로틀링 적용
    const { onClick: handleBackClick } = useButtonClickThrottle(handleBackClickRaw);
    const { onClick: handleForfeitClick } = useButtonClickThrottle(handleForfeitClickRaw);

    // 경기가 진행 중이거나, 경기가 막 끝났지만 아직 서버에서 상태가 업데이트되지 않은 경우
    // currentSimulatingMatch가 있으면 시뮬레이션 중으로 간주 (단, 토너 종료 후에는 stale 참조로 무한 시뮬 방지)
    const terminalTournamentStatus =
        displayTournament.status === 'complete' || displayTournament.status === 'eliminated';
    const isSimulating =
        !terminalTournamentStatus &&
        (displayTournament.status === 'round_in_progress' ||
            (displayTournament.currentSimulatingMatch !== null &&
                displayTournament.currentSimulatingMatch !== undefined));
    const currentSimMatch = displayTournament.currentSimulatingMatch 
        ? safeRounds[displayTournament.currentSimulatingMatch.roundIndex]?.matches[displayTournament.currentSimulatingMatch.matchIndex] || null
        : null;
        
    const lastFinishedUserMatch = useMemo(() => {
        return [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
    }, [safeRounds]);
    
    // 경기 종료 화면 유지 로직
    const matchForDisplay = useMemo(() => {
        if (isSimulating) {
            return currentSimMatch;
        }
        
        // round_complete 상태일 때는 마지막 완료된 경기 화면을 그대로 유지
        // (전국바둑대회, 월드챔피언십, 동네바둑리그 모두 동일하게 처리)
        if (tournament.status === 'round_complete') {
            // lastFinishedUserMatch가 있으면 우선적으로 사용
            if (lastFinishedUserMatch) {
                return lastFinishedUserMatch;
            }
            // lastFinishedUserMatch가 없으면 완료된 경기 중 첫 번째 찾기
            const finishedMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (finishedMatch) {
                return finishedMatch;
            }
        }
        
        // bracket_ready 상태: 카운트다운 중이면 이전 경기 결과 화면 유지, 카운트다운 끝나면 새 경기로 전환
        if (tournament.status === 'bracket_ready') {
            // 카운트다운 0 직후: 다음 회차 탭으로 전환된 상태 → 다음 회차 대국자 정보 + 빈 바둑판
            if (pendingRoundSwitchTo != null) {
                const nextRoundObj = safeRounds.find(r => r.name === `${pendingRoundSwitchTo}회차`);
                const nextMatch = nextRoundObj?.matches.find(m => m.isUserMatch && !m.isFinished);
                if (nextMatch) return nextMatch;
            }
            const countdownInProgress = tournament.nextRoundStartTime != null;
            if (countdownInProgress && lastFinishedUserMatch) {
                return lastFinishedUserMatch;
            }
            if (!countdownInProgress) {
                if (tournament.type === 'neighborhood') {
                    const currentRound = tournament.currentRoundRobinRound || 1;
                    const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
                    if (currentRoundObj) {
                        const nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        if (nextMatch) return nextMatch;
                    }
                } else {
                    const nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
                    if (nextMatch) return nextMatch;
                }
            }
            if (lastFinishedUserMatch) return lastFinishedUserMatch;
            const finishedMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (finishedMatch) return finishedMatch;
        }
        
        // 그 외의 경우: 다음 경기, 마지막 완료된 경기, 또는 첫 경기 순서로 표시
        const nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
        if (nextMatch) {
            return nextMatch;
        }
        if (lastFinishedUserMatch) {
            return lastFinishedUserMatch;
        }
        const anyFinishedMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
        if (anyFinishedMatch) {
            return anyFinishedMatch;
        }
        const anyUserMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch);
        if (anyUserMatch) {
            return anyUserMatch;
        }
        return safeRounds[0]?.matches[0] || null;
    }, [isSimulating, currentSimMatch, tournament.status, tournament.nextRoundStartTime, tournament.type, safeRounds, lastFinishedUserMatch, pendingRoundSwitchTo]);
    
    // 유저의 다음 경기 찾기 (경기 시작 전 상태 확인용)
    const upcomingUserMatch = useMemo(() => {
        return safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
    }, [safeRounds]);

    // 현재 유저의 컨디션 찾기
    const userPlayer = useMemo(() => {
        if (!tournament || !Array.isArray(tournament.players) || !currentUser?.id) {
            return undefined;
        }
        return tournament.players.find(p => p.id === currentUser.id);
    }, [tournament?.players, currentUser?.id]);

    /** 토너먼트 플레이어 객체에 컨디션이 1000으로만 있을 때 던전 스냅샷으로 모달 표시 */
    const conditionForPotionModal = useMemo(() => {
        if (!userPlayer) return 1000;
        const tp = userPlayer.condition;
        if (tp !== undefined && tp !== null && tp !== 1000) return tp;
        const snap =
            tournament?.type && currentUser.dungeonConditionSnapshot?.[tournament.type]?.condition;
        if (snap !== undefined && snap !== null && snap !== 1000) return snap;
        return tp !== undefined && tp !== null ? tp : 1000;
    }, [userPlayer, tournament?.type, currentUser.dungeonConditionSnapshot]);

    const championshipConditionFallback = useMemo(() => {
        if (!tournament?.type) return undefined;
        return currentUser.dungeonConditionSnapshot?.[tournament.type]?.condition;
    }, [tournament?.type, currentUser.dungeonConditionSnapshot]);

    const winner = useMemo(() => {
        if (!tournament || tournament.status !== 'complete') return null;
        if (!Array.isArray(tournament.players) || safeRounds.length === 0) return null;
        
        if (tournament.type === 'neighborhood') {
             const wins: Record<string, number> = {};
            tournament.players.forEach(p => wins[p.id] = 0);
            if (safeRounds[0]?.matches) {
                safeRounds[0].matches.forEach(m => { if(m.winner) wins[m.winner.id]++; });
            }
            return [...tournament.players].sort((a,b) => wins[b.id] - wins[a.id])[0];
        } else {
            const finalMatch = safeRounds.find(r => r.name === '결승');
            return finalMatch?.matches[0]?.winner;
        }
    }, [tournament?.status, tournament?.type, tournament?.players, safeRounds]);
    
    const myResultText = useMemo(() => {
        if (!tournament || !currentUser?.id) return '';
        if (tournament.status === 'complete' || tournament.status === 'eliminated') {
            if (tournament.type === 'neighborhood') {
                if (!Array.isArray(tournament.players) || safeRounds.length === 0) return '';
                const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                const winsCount = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                const lossesCount = allMyMatches.length - winsCount;

                const playerWins: Record<string, number> = {};
                tournament.players.forEach(p => { playerWins[p.id] = 0; });
                if (safeRounds[0]?.matches) {
                    safeRounds[0].matches.forEach(m => {
                        if (m.winner) playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                    });
                }

                const sortedPlayers = [...tournament.players].sort((a, b) => playerWins[b.id] - playerWins[a.id]);
                let myRank = -1; let currentRankValue = 1;
                for (let i = 0; i < sortedPlayers.length; i++) {
                    if (i > 0 && playerWins[sortedPlayers[i].id] < playerWins[sortedPlayers[i-1].id]) currentRankValue = i + 1;
                    if (sortedPlayers[i].id === currentUser.id) { myRank = currentRankValue; break; }
                }
                return `${winsCount}승 ${lossesCount}패! ${myRank}위`;
            }

            if (winner?.id === currentUser.id) return "🏆 우승!";

            const lastUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastUserMatch) {
                const roundOfLastMatch = safeRounds.find(r => r.matches.some(m => m.id === lastUserMatch.id));
                if (roundOfLastMatch?.name === '결승') return "준우승!";

                if (roundOfLastMatch?.name === '4강') {
                    const thirdPlaceMatch = safeRounds.flatMap(r => r.matches).find(m => {
                        const round = safeRounds.find(r => r.matches.some(match => match.id === m.id));
                        return m.isUserMatch && round?.name === '3,4위전';
                    });
                    if (thirdPlaceMatch) {
                        const won3rdPlace = thirdPlaceMatch.winner?.id === currentUser.id;
                        return won3rdPlace ? "3위" : "4위";
                    }
                }
                return `${roundOfLastMatch?.name || ''}에서 탈락`;
            }
            return "토너먼트 탈락";
        }

        if (tournament.status === 'round_complete' || tournament.status === 'bracket_ready') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch) {
                const userWonLastMatch = lastFinishedUserMatch.winner?.id === currentUser.id;
                if (tournament.type === 'neighborhood') {
                    const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                    const wins = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                    const losses = allMyMatches.length - wins;
                    return `${allMyMatches.length}차전 ${userWonLastMatch ? '승리' : '패배'}! (${wins}승 ${losses}패)`;
                } else if (userWonLastMatch) {
                    const nextUnplayedRound = safeRounds.find(r => r.matches.some(m => !m.isFinished && m.players.some(p => p?.id === currentUser.id)));
                    if (nextUnplayedRound) return `${nextUnplayedRound.name} 진출!`;
                }
            }
        }
        
        const currentRound = safeRounds.find(r => r.matches.some(m => m.isUserMatch && !m.isFinished));
        return currentRound ? `${currentRound.name} 진행 중` : "대회 준비 중";
    }, [currentUser.id, tournament, winner, safeRounds]);
    
    const p1_from_match = matchForDisplay?.players?.[0] || null;
    const p2_from_match = matchForDisplay?.players?.[1] || null;

    const p1 = p1_from_match && Array.isArray(displayTournament?.players) 
        ? displayTournament.players.find(p => p.id === p1_from_match.id) || p1_from_match 
        : null;
    const p2 = p2_from_match && Array.isArray(displayTournament?.players) 
        ? displayTournament.players.find(p => p.id === p2_from_match.id) || p2_from_match 
        : null;

    // 경기 시작 전에는 홈 화면과 동일한 능력치 계산 (calculateTotalStats 사용)
    // 경기 중에는 player.stats를 사용 (컨디션으로 인한 변화 반영)
    const p1Stats = useMemo(() => {
        if (!displayTournament) return {};
        if (displayTournament.status === 'round_in_progress') {
            return p1?.stats || {};
        }
        if (p1?.originalStats) {
            return p1.originalStats;
        }
            const p1User = allUsersForRanking.find(u => u.id === p1?.id);
            if (p1User) {
                return calculateTotalStats(p1User);
            }
            return p1?.stats || {};
    }, [p1?.stats, p1?.originalStats, p1?.id, displayTournament?.status, allUsersForRanking]);

    const p2Stats = useMemo(() => {
        if (!displayTournament) return {};
        if (displayTournament.status === 'round_in_progress') {
            return p2?.stats || {};
        }
        if (p2?.originalStats) {
            return p2.originalStats;
        }
            const p2User = allUsersForRanking.find(u => u.id === p2?.id);
            if (p2User) {
                return calculateTotalStats(p2User);
            }
            return p2?.stats || {};
    }, [p2?.stats, p2?.originalStats, p2?.id, displayTournament?.status, allUsersForRanking]);

    const radarDatasets = useMemo(() => [
        { stats: p1Stats, color: '#60a5fa', fill: 'rgba(59, 130, 246, 0.4)' },
        { stats: p2Stats, color: '#f87171', fill: 'rgba(239, 68, 68, 0.4)' },
    ], [p1Stats, p2Stats]);

    const maxStatValue = useMemo(() => {
        if (!p1Stats || !p2Stats || Object.keys(p1Stats).length === 0 || Object.keys(p2Stats).length === 0) {
            return 200; // A reasonable default
        }
        const allStats: number[] = [
            ...(Object.values(p1Stats) as number[]),
            ...(Object.values(p2Stats) as number[])
        ];
        const maxStat = Math.max(...allStats, 0);
        return Math.ceil((maxStat + 50) / 50) * 50; // Round up to nearest 50
    }, [p1Stats, p2Stats]);

    const currentPhase = useMemo((): 'early' | 'mid' | 'end' | 'none' => {
        if (!displayTournament || displayTournament.status !== 'round_in_progress') return 'none';
        const time = displayTournament.timeElapsed || 0;
        if (time <= 15) return 'early';
        if (time <= 35) return 'mid';
        if (time <= 50) return 'end';
        return 'none';
    }, [displayTournament?.timeElapsed, displayTournament?.status]);

    // 서버에서 매초 누적된 능력치 점수를 가져옴
    // 초반(1-15초): 초반전 능력치 합계 누적
    // 중반(16-35초): 중반전 능력치 합계 누적
    // 종반(36-50초): 종반전 능력치 합계 누적
    const p1Cumulative = displayTournament?.currentMatchScores?.player1 || 0;
    const p2Cumulative = displayTournament?.currentMatchScores?.player2 || 0;
    const totalCumulative = p1Cumulative + p2Cumulative;
    
    // 누적 점수를 비율로 변환하여 그래프에 표시
    const p1Percent = totalCumulative > 0 ? (p1Cumulative / totalCumulative) * 100 : 50;
    const p2Percent = totalCumulative > 0 ? (p2Cumulative / totalCumulative) * 100 : 50;

    const renderChampionshipSkipButton = (fb: string) => {
        if (!championshipDungeonSkipUi.visible || !tournament) return null;
        const vipOk = functionVipActive;
        const canClick = vipOk && championshipDungeonSkipUi.canAttempt;
        return (
            <div className="flex flex-col items-center gap-0.5">
                <Button
                    type="button"
                    onClick={() => {
                        if (!canClick) return;
                        onAction({ type: 'SKIP_CHAMPIONSHIP_MATCH', payload: { type: tournament.type } });
                    }}
                    disabled={!canClick}
                    colorScheme={vipOk && canClick ? 'purple' : 'gray'}
                    className={`${fb} ${!vipOk ? 'opacity-80' : ''}`}
                    title={
                        !vipOk
                            ? '기능 VIP 활성화 후 사용할 수 있습니다.'
                            : !championshipDungeonSkipUi.canAttempt
                              ? '상대 정보를 준비하는 중입니다.'
                              : '경기를 즉시 완료하고 결과를 확인합니다.'
                    }
                >
                    SKIP
                </Button>
                {!vipOk ? (
                    <span className="max-w-[10rem] text-center text-[10px] font-semibold leading-tight text-amber-400">
                        기능 VIP 활성화
                    </span>
                ) : !championshipDungeonSkipUi.canAttempt ? (
                    <span className="max-w-[10rem] text-center text-[10px] font-medium leading-tight text-slate-400">
                        상대 정보 준비 중
                    </span>
                ) : null}
            </div>
        );
    };

    const renderFooterButton = () => {
        if (!tournament) return null;

        const fb = isMobile ? '!text-xs !py-1.5 !px-3' : '!text-sm !py-2 !px-4';

        const { status } = tournament;

        if (status === 'round_in_progress') {
            return (
                <Button disabled colorScheme="green" className={fb}>
                    경기 진행 중...
                </Button>
            );
        }
        
        if (status === 'complete') {
            return null; // 이미 헤더에 뒤로가기 버튼이 있으므로 버튼 제거
        }

        if (status === 'eliminated') {
            return null; // 이미 헤더에 뒤로가기 버튼이 있으므로 버튼 제거
        }

        // "다음 경기" 버튼 제거 - 자동 진행으로 대체됨

        const hasUnfinishedUserMatch = safeRounds.some(r =>
            Array.isArray(r?.matches) && r.matches.some(m => m.isUserMatch && !m.isFinished)
        );

        // 서버 5초 카운트다운·클라 카운트다운·회차 전환 직전·첫 경기 이후 자동 진행 중에는 수동 시작 버튼 숨김 (카운트 직전 깜빡임 방지)
        const isAutoStartFlow =
            tournament.nextRoundStartTime != null ||
            autoNextCountdown !== null ||
            pendingRoundSwitchTo != null ||
            tournament.autoAdvanceEnabled === true;

        // 경기 시작 버튼: 1회차 시작 전에만 표시 (동네바둑리그 2·3회차 등은 카운트다운 후 자동 시작되므로 버튼 미표시)
        const isFirstRoundBeforeStart = tournament.type !== 'neighborhood' || (tournament.currentRoundRobinRound === 1);
        if (
            (status === 'round_complete' || status === 'bracket_ready') &&
            hasUnfinishedUserMatch &&
            isFirstRoundBeforeStart &&
            !isAutoStartFlow
        ) {
            // 다음 경기의 선수 정보가 준비되었는지 확인
            let nextMatch: Match | undefined = undefined;
            if (tournament.type === 'neighborhood') {
                const currentRound = tournament.currentRoundRobinRound || 1;
                const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
                if (currentRoundObj) {
                    nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                }
            } else {
                nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
            }
            
            // 선수 정보 준비 여부 확인
            const p1 = nextMatch && Array.isArray(tournament.players) 
                ? tournament.players.find(p => p.id === nextMatch.players[0]?.id) 
                : null;
            const p2 = nextMatch && Array.isArray(tournament.players) 
                ? tournament.players.find(p => p.id === nextMatch.players[1]?.id) 
                : null;
            const playersReady = p1 && p2 && p1.stats && p2.stats && 
                                 Object.keys(p1.stats).length > 0 && Object.keys(p2.stats).length > 0;
            
            if (!playersReady) {
                return (
                    <>
                        <Button disabled colorScheme="gray" className={`${fb} cursor-not-allowed opacity-50`}>
                            다음 상대를 기다리는 중...
                        </Button>
                    </>
                );
            }

            return (
                <>
                    <Button
                        onClick={() =>
                            onAction({ type: 'START_TOURNAMENT_MATCH', payload: { type: tournament?.type ?? 'neighborhood' } })
                        }
                        colorScheme="green"
                        className={`animate-pulse ${fb}`}
                    >
                        경기 시작
                    </Button>
                </>
            );
        }
        
        // 시뮬레이션이 끝나고 경기가 초기화되기 전에 다시 입장한 경우, 버튼을 표시하지 않음 (나가기 전 화면과 동일)
        // This is the default case, meaning user's matches are done but tournament isn't 'complete' or 'eliminated'
        return null;
    };

    const footerButtons = renderFooterButton();
    
    // 자동 다음 경기 카운트다운 표시
    // 경기가 진행 중일 때는 "경기 진행중" 표시
    const countdownDisplay = tournament?.status === 'round_in_progress' ? (
        <div
            className={`flex items-center justify-center font-bold text-blue-400 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>경기 진행중</span>
        </div>
    ) : autoNextCountdown !== null ? (
        <div
            className={`flex items-center justify-center font-bold text-yellow-400 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>
                다음 경기 준비중... {autoNextCountdown}
            </span>
        </div>
    ) : null;

    const desktopSkipSlot = !isMobile ? renderChampionshipSkipButton('!text-sm !py-2 !px-4') : null;
    const desktopCommentaryCoreSlot = footerButtons || countdownDisplay;
    const desktopCommentaryFooterSlot =
        !isMobile && (desktopCommentaryCoreSlot || desktopSkipSlot) ? (
            <div className="mt-1.5 flex w-full flex-wrap items-center justify-center gap-2">
                {desktopCommentaryCoreSlot}
                {desktopSkipSlot}
            </div>
        ) : undefined;

    /** 모바일: 모든 탭 공통 하단 — 경기 시작·진행·카운트다운·보상 수령 */
    const championshipMobileStickyBar = isMobile
        ? (() => {
              const ts = displayTournament;
              const allMatchesFinished = ts.rounds.every((r) => r.matches.every((m) => m.isFinished));
              const isTournamentFullyComplete =
                  ts.status === 'complete' || (allMatchesFinished && ts.status !== 'round_in_progress');
              const isUserEliminated = ts.status === 'eliminated';
              const isInProgress = ts.status === 'round_in_progress' || ts.status === 'bracket_ready';
              const isRoundComplete = ts.status === 'round_complete';
              const effectiveStageAttempt = resolveDungeonStageAttempt(ts, currentUser, ts.type);
              const isDungeonModeFooter = effectiveStageAttempt >= 1;
              const rewardClaimedKey = `${ts.type}RewardClaimed` as keyof User;
              const isRewardClaimed = !!currentUser[rewardClaimedKey];
              const treatAsClaimed = isRewardClaimed || dungeonStageRewardRequested;
              const canClaimReward =
                  (isTournamentFullyComplete || isUserEliminated) && !isRewardClaimed && !dungeonStageRewardRequested;
              const claimedRewardSummary = ts.claimedRewardSummary || null;

              const handleMobileRewardClaim = () => {
                  if (mobileRewardClaimBusy || !canClaimReward || !effectiveStageAttempt) return;
                  setMobileRewardClaimBusy(true);
                  audioService.claimReward();
                  handleCompleteDungeon();
                  setTimeout(() => setMobileRewardClaimBusy(false), 3000);
              };

              const skipBtn = renderChampionshipSkipButton('!text-xs !py-1.5 !px-3');
              const baseMatchRow = footerButtons || countdownDisplay;
              const matchRow =
                  baseMatchRow || skipBtn ? (
                      <div className="flex w-full flex-wrap items-center justify-center gap-2">
                          {baseMatchRow}
                          {skipBtn}
                      </div>
                  ) : null;

              return (
                  <div className="flex w-full shrink-0 flex-col gap-1.5 border-t border-cyan-500/35 bg-panel-secondary/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm">
                      {matchRow}
                      {(isTournamentFullyComplete || isUserEliminated) && treatAsClaimed && (
                          <div className="space-y-1.5">
                              {isDungeonModeFooter && !isRewardClaimed ? (
                                  <button
                                      type="button"
                                      onClick={() => handleCompleteDungeon()}
                                      disabled={mobileRewardClaimBusy}
                                      className="w-full rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                      {mobileRewardClaimBusy ? '처리 중...' : '보상 완료'}
                                  </button>
                              ) : (
                                  <div className="w-full rounded-lg border border-gray-600 bg-gray-700/50 py-1.5 px-3 text-center text-xs font-semibold text-gray-400">
                                      보상완료
                                  </div>
                              )}
                              {claimedRewardSummary ? (
                                  <button
                                      type="button"
                                      onClick={handleOpenRewardHistory}
                                      className="w-full rounded-lg bg-purple-700/70 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
                                  >
                                      보상내역
                                  </button>
                              ) : null}
                          </div>
                      )}
                      {!treatAsClaimed && (
                          <div className="space-y-1.5">
                              {(isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt ? (
                                  <button
                                      type="button"
                                      onClick={handleMobileRewardClaim}
                                      disabled={!canClaimReward || mobileRewardClaimBusy}
                                      className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                          canClaimReward && !mobileRewardClaimBusy
                                              ? 'cursor-pointer bg-green-600 text-white hover:bg-green-700'
                                              : 'cursor-not-allowed bg-gray-600 text-gray-400'
                                      }`}
                                  >
                                      {mobileRewardClaimBusy
                                          ? '수령 중...'
                                          : canClaimReward
                                            ? '보상받기'
                                            : '경기 종료 후 수령 가능'}
                                  </button>
                              ) : null}
                              {(isInProgress || isRoundComplete) &&
                              !((isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt) ? (
                                  <div className="w-full rounded-lg border border-blue-700/50 bg-blue-900/30 py-1.5 px-3 text-center text-xs font-semibold text-blue-300">
                                      모든 경기 완료 후 보상수령
                                  </div>
                              ) : null}
                          </div>
                      )}
                  </div>
              );
          })()
        : null;

    const sgfFileIndexForViewer = isSimulating
        ? currentSimMatch?.sgfFileIndex
        : (() => {
            if (pendingRoundSwitchTo != null && tournament.status === 'bracket_ready') return null;
            if (tournament.status === 'round_complete') {
                return lastUserMatchSgfIndex !== null ? lastUserMatchSgfIndex : (matchForDisplay?.sgfFileIndex !== undefined ? matchForDisplay.sgfFileIndex : null);
            }
            if (tournament.status === 'bracket_ready') {
                if (upcomingUserMatch?.sgfFileIndex !== undefined) {
                    return upcomingUserMatch.sgfFileIndex;
                }
                if (lastUserMatchSgfIndex !== null) {
                    return lastUserMatchSgfIndex;
                }
                return null;
            }
            return lastUserMatchSgfIndex !== null ? lastUserMatchSgfIndex : (matchForDisplay?.sgfFileIndex !== undefined ? matchForDisplay.sgfFileIndex : null);
        })();

    const sgfTimeElapsedForViewer = isSimulating
        ? (displayTournament.timeElapsed || 0)
        : (tournament.status === 'round_complete' || tournament.status === 'complete' || tournament.status === 'eliminated')
            ? 50
            : 0;

    const sgfShowLastMoveOnly = !isSimulating && (tournament.status === 'round_complete' || tournament.status === 'complete' || tournament.status === 'eliminated');

    const renderSidebarContent = (compact: boolean) => (
        <div className="h-full w-full flex flex-col" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* 대진표/라운드 뷰어 전용 영역 */}
            <div 
                className="overflow-y-auto" 
                style={{ 
                    flex: '1 1 auto', 
                    minHeight: 0, 
                    maxHeight: '100%',
                    overflowY: 'auto', 
                    overflowX: 'hidden', 
                    width: '100%',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
            {tournament.type === 'neighborhood' ? (
                <RoundRobinDisplay
                    tournamentState={tournament}
                    currentUser={currentUser}
                    nextRoundStartTime={tournament.nextRoundStartTime}
                    pendingRoundSwitchTo={pendingRoundSwitchTo}
                    compact={compact}
                />
            ) : (
                <TournamentRoundViewer 
                    rounds={safeRounds} 
                    currentUser={currentUser} 
                    tournamentType={tournament.type} 
                    tournamentState={tournament}
                    nextRoundTrigger={nextRoundTrigger}
                    nextRoundStartTime={tournament.nextRoundStartTime}
                    compact={compact}
                />
            )}
            </div>
        </div>
    );

    const radarStatLegend = (
        <div className="mt-1 flex flex-wrap justify-center gap-2 px-1 text-xs">
            <span className="flex items-center gap-0.5">
                <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }} />
                <span className="max-w-none truncate">{p1?.nickname || '선수 1'}</span>
            </span>
            <span className="flex items-center gap-0.5">
                <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
                <span className="max-w-none truncate">{p2?.nickname || '선수 2'}</span>
            </span>
        </div>
    );

    const radarDesktopColumn = (
        <div className="flex w-52 shrink-0 flex-col items-center justify-center min-w-0">
            <RadarChart datasets={radarDatasets} maxStatValue={maxStatValue} />
            {radarStatLegend}
        </div>
    );

    const scoreGraphAndProgressSection = (
        <section
            className={`flex-shrink-0 rounded-lg border border-gray-600/75 bg-slate-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md ${
                isMobile ? 'p-1.5' : 'p-2'
            }`}
        >
            <ScoreGraph
                p1Percent={p1Percent}
                p2Percent={p2Percent}
                p1Nickname={p1?.nickname}
                p2Nickname={p2?.nickname}
                p1Cumulative={p1Cumulative}
                p2Cumulative={p2Cumulative}
                p1Player={p1}
                p2Player={p2}
                lastScoreIncrement={displayTournament.lastScoreIncrement}
                compact={isMobile}
            />
            <div className={isMobile ? 'mt-1' : 'mt-1.5'}>
                <SimulationProgressBar
                    timeElapsed={displayTournament.timeElapsed}
                    totalDuration={50}
                    compact={isMobile}
                />
            </div>
        </section>
    );

    const commentaryPanelSection = (
        <div
            className={`${!isMobile ? 'min-w-0 flex-[3]' : 'min-h-0 w-full flex-1'} flex flex-col overflow-hidden rounded-lg border border-gray-600/75 bg-slate-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md ${
                isMobile ? 'p-1.5' : 'p-2'
            }`}
            style={{ display: 'flex', flexDirection: 'column', minHeight: !isMobile ? undefined : 0 }}
        >
            <CommentaryPanel
                commentary={displayTournament.currentMatchCommentary}
                isSimulating={displayTournament.status === 'round_in_progress'}
                footerSlot={desktopCommentaryFooterSlot}
                compact={isMobile}
            />
        </div>
    );

    const finalRewardSection = (
        <div
            className={`flex flex-col rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md ${
                !isMobile ? 'min-w-[160px] flex-[1.4] overflow-hidden' : 'w-full min-w-0'
            }`}
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            <FinalRewardPanel
                tournamentState={displayTournament}
                currentUser={currentUser}
                onAction={onAction}
                onCompleteDungeon={handleCompleteDungeon}
                dungeonRewardAlreadyRequested={dungeonStageRewardRequested}
                onDungeonRewardRequested={() => setDungeonStageRewardRequested(true)}
                onOpenRewardHistory={handleOpenRewardHistory}
                layoutVariant={isMobile ? 'mobileTab' : 'sidebar'}
                suppressBottomActions={isMobile}
            />
        </div>
    );

    const mainContent = (
        <div
            className={`${isMobile ? 'flex w-full min-h-0 min-w-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-row gap-2 overflow-hidden'}`}
            style={isMobile ? { minHeight: 0 } : { height: '100%', display: 'flex' }}
        >
            <div
                className={`${
                    isMobile
                        ? `flex min-h-0 w-full flex-1 flex-col gap-2 ${
                              mobileChampionshipTab === 'board' ||
                              mobileChampionshipTab === 'live' ||
                              mobileChampionshipTab === 'players'
                                  ? 'overflow-hidden'
                                  : 'overflow-y-auto'
                          }`
                        : 'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden'
                }`}
            >
                {/* 플레이어 프로필 섹션 */}
                {(!isMobile || mobileChampionshipTab === 'players') &&
                    (matchForDisplay && (p1 || p2) ? (
                        <section
                            className={`rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md ${
                                isMobile
                                    ? 'mb-0 mt-0 flex min-h-0 flex-1 flex-col'
                                    : 'flex h-[300px] shrink-0 flex-row items-stretch overflow-hidden'
                            }`}
                            style={isMobile ? {} : { minHeight: '300px', maxHeight: '300px' }}
                        >
                            {isMobile ? (
                                <PlayerProfilePanelErrorBoundary>
                                    <MobileChampionshipPlayersCompare
                                        p1={p1}
                                        p2={p2}
                                        initialP1={initialMatchPlayers.p1}
                                        initialP2={initialMatchPlayers.p2}
                                        p1Stats={p1Stats}
                                        p2Stats={p2Stats}
                                        allUsers={allUsersForRanking}
                                        currentUserId={currentUser.id}
                                        onViewUser={onViewUser}
                                        tournamentStatus={tournament.status}
                                        canUseConditionPotion={canUseConditionPotion}
                                        onUseConditionPotion={() => setShowConditionPotionModal(true)}
                                        conditionFallback={championshipConditionFallback}
                                        isUserMatchP1={
                                            (currentSimMatch?.isUserMatch ||
                                                (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p1?.id))) ||
                                            false
                                        }
                                        isUserMatchP2={
                                            (currentSimMatch?.isUserMatch ||
                                                (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p2?.id))) ||
                                            false
                                        }
                                        highlightPhase={currentPhase}
                                    />
                                </PlayerProfilePanelErrorBoundary>
                            ) : (
                                <>
                                    <div ref={p1ProfileRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
                                        <PlayerProfilePanelErrorBoundary>
                                            <PlayerProfilePanel
                                                player={p1}
                                                initialPlayer={initialMatchPlayers.p1}
                                                allUsers={allUsersForRanking}
                                                currentUserId={currentUser.id}
                                                onViewUser={onViewUser}
                                                highlightPhase={currentPhase}
                                                isUserMatch={
                                                    (currentSimMatch?.isUserMatch ||
                                                        (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p1?.id))) ||
                                                    false
                                                }
                                                onUseConditionPotion={() => {
                                                    setShowConditionPotionModal(true);
                                                }}
                                                timeElapsed={tournament.timeElapsed}
                                                tournamentStatus={tournament.status}
                                                isMobile={isMobile}
                                                canUseConditionPotion={canUseConditionPotion}
                                                conditionFallback={championshipConditionFallback}
                                            />
                                        </PlayerProfilePanelErrorBoundary>
                                    </div>
                                    {radarDesktopColumn}
                                    <div ref={p2ProfileRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
                                        <PlayerProfilePanelErrorBoundary>
                                            <PlayerProfilePanel
                                                player={p2}
                                                initialPlayer={initialMatchPlayers.p2}
                                                allUsers={allUsersForRanking}
                                                currentUserId={currentUser.id}
                                                onViewUser={onViewUser}
                                                highlightPhase={currentPhase}
                                                isUserMatch={
                                                    (currentSimMatch?.isUserMatch ||
                                                        (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p2?.id))) ||
                                                    false
                                                }
                                                onUseConditionPotion={() => {
                                                    setShowConditionPotionModal(true);
                                                }}
                                                timeElapsed={tournament.timeElapsed}
                                                tournamentStatus={tournament.status}
                                                isMobile={isMobile}
                                                canUseConditionPotion={canUseConditionPotion}
                                                conditionFallback={championshipConditionFallback}
                                            />
                                        </PlayerProfilePanelErrorBoundary>
                                    </div>
                                </>
                            )}
                        </section>
                    ) : (
                        <section
                            className={`flex shrink-0 rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md ${
                                isMobile ? 'mt-0 mb-0' : 'h-[300px] overflow-hidden'
                            }`}
                            style={isMobile ? {} : { minHeight: '300px', maxHeight: '300px' }}
                        >
                            <div className="flex flex-1 items-center justify-center text-gray-400">경기 정보를 불러오는 중...</div>
                        </section>
                    ))}
                
                {/* 데스크톱: SGF + 중계 + 보상 / 모바일: 탭으로 분리 */}
                {!isMobile && (
                    <div className="flex max-h-full min-h-0 flex-1 flex-row gap-2 overflow-hidden">
                        <div className="relative flex w-2/5 flex-col items-center justify-center overflow-auto rounded-lg border border-gray-600/75 bg-slate-950/92 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md md:p-2">
                            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                                <SgfViewer
                                    timeElapsed={sgfTimeElapsedForViewer}
                                    fileIndex={sgfFileIndexForViewer}
                                    showLastMoveOnly={sgfShowLastMoveOnly}
                                />
                            </div>
                        </div>
                        <div className="flex w-3/5 min-h-0 flex-col gap-2 overflow-hidden" style={{ height: '100%', minHeight: 0 }}>
                            {scoreGraphAndProgressSection}
                            <div className="flex min-h-0 flex-1 flex-row gap-2 overflow-hidden" style={{ display: 'flex' }}>
                                {commentaryPanelSection}
                                {finalRewardSection}
                            </div>
                        </div>
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'live' && (
                    <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden">
                        {scoreGraphAndProgressSection}
                        {commentaryPanelSection}
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'board' && (
                    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                        <div className="relative flex min-h-[min(56dvh,520px)] w-full flex-1 flex-col items-center justify-center overflow-auto rounded-lg border border-gray-600/75 bg-slate-950/92 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md md:p-2">
                            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                                <SgfViewer
                                    timeElapsed={sgfTimeElapsedForViewer}
                                    fileIndex={sgfFileIndexForViewer}
                                    showLastMoveOnly={sgfShowLastMoveOnly}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'bracket' && (
                    <div className="flex min-h-[180px] w-full flex-1 flex-col overflow-hidden rounded-lg border-2 border-gray-600/90 bg-slate-950/95 px-0.5 py-0.5 shadow-lg backdrop-blur-md">
                        {renderSidebarContent(true)}
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'rewards' && (
                    <div
                        className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-1"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        {finalRewardSection}
                    </div>
                )}
            </div>
            
            {!isMobile && (
                <aside className="flex w-[320px] flex-shrink-0 flex-col rounded-lg border-2 border-gray-600/90 bg-slate-950/95 p-2 shadow-lg backdrop-blur-md xl:w-[380px]" style={{ height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {renderSidebarContent(false)}
                </aside>
            )}
        </div>
    );
    
    const championshipVenueBackgroundUrl = resolvePublicUrl(TOURNAMENT_DEFINITIONS[tournament.type].image);

    return (
        <div className="relative flex h-full w-full min-h-0 flex-col gap-2 overflow-hidden text-white" style={{ height: '100%', minHeight: 0 }}>
            <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${championshipVenueBackgroundUrl})` }}
                aria-hidden
            />
            {/* 입장 카드(TournamentCard)와 동일 톤의 딤 — 텍스트·패널 가독성 */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/75" aria-hidden />
            <header className="relative z-10 flex flex-shrink-0 items-center justify-between border-b border-gray-600/70 bg-slate-950/78 p-3 backdrop-blur-md">
                <button onClick={handleBackClick} className="transition-transform active:scale-90 filter hover:drop-shadow-lg">
                    <img src="/images/button/back.png" alt="Back" className="w-12 h-12" loading="lazy" decoding="async" />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-2xl font-bold">
                        {TOURNAMENT_DEFINITIONS[tournament.type].name}
                        {resolvedDungeonStageAttempt >= 1 && (
                            <span className="ml-2 text-xl text-yellow-400">
                                {resolvedDungeonStageAttempt}단계
                            </span>
                        )}
                    </h1>
                </div>
                <div className="h-12 w-12 shrink-0" aria-hidden />
            </header>
            {isMobile ? (
                <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-2 pt-0 sm:px-2">
                    <nav
                        className="flex w-full shrink-0 gap-px border-b border-gray-600/60 bg-slate-950/80 py-1 backdrop-blur-sm"
                        aria-label="경기장 탭"
                    >
                        {(
                            [
                                { id: 'players' as const, label: '대국자정보' },
                                { id: 'live' as const, label: '실시간중계' },
                                { id: 'board' as const, label: '바둑판' },
                                { id: 'bracket' as const, label: '대진표' },
                                { id: 'rewards' as const, label: '보상정보' },
                            ] as const
                        ).map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setMobileChampionshipTab(id)}
                                className={`min-w-0 flex-1 basis-0 rounded-md px-1 py-1.5 text-center text-[9px] font-semibold leading-tight transition-colors sm:text-[10px] ${
                                    mobileChampionshipTab === id
                                        ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                }`}
                            >
                                <span className="line-clamp-2 break-words">{label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {mainContent}
                    </div>
                    {championshipMobileStickyBar}
                </div>
            ) : (
                <div className="relative z-10 min-h-0 flex-1 overflow-hidden p-1 pb-2 sm:p-2">
                    {mainContent}
                </div>
            )}
            {showConditionPotionModal && userPlayer && tournament && canUseConditionPotion && (
                <ConditionPotionModal
                    currentUser={currentUser}
                    currentCondition={conditionForPotionModal}
                    onClose={() => setShowConditionPotionModal(false)}
                    onConfirm={(potionType) => {
                        if (tournament?.type) {
                            onAction({ type: 'USE_CONDITION_POTION', payload: { tournamentType: tournament.type, potionType } });
                        }
                    }}
                    isTopmost={true}
                />
            )}
            {dungeonStageSummaryData && (() => {
                const modalProps: DungeonStageSummaryModalProps = {
                    dungeonType: dungeonStageSummaryData.dungeonType,
                    stage: dungeonStageSummaryData.stage,
                    tournamentState: dungeonStageSummaryData.tournamentState,
                    userRank: dungeonStageSummaryData.userRank,
                    wins: dungeonStageSummaryData.wins,
                    losses: dungeonStageSummaryData.losses,
                    baseRewards: dungeonStageSummaryData.baseRewards,
                    rankReward: dungeonStageSummaryData.rankReward,
                    grantedEquipmentDrops: dungeonStageSummaryData.grantedEquipmentDrops,
                    nextStageUnlocked: dungeonStageSummaryData.nextStageUnlocked,
                    nextStageWasAlreadyUnlocked: dungeonStageSummaryData.nextStageWasAlreadyUnlocked,
                    dailyScore: dungeonStageSummaryData.dailyScore,
                    previousRank: dungeonStageSummaryData.previousRank,
                    currentRank: dungeonStageSummaryData.currentRank,
                    onClose: () => setDungeonStageSummaryData(null),
                    isTopmost: true,
                };
                return <DungeonStageSummaryModal {...modalProps} />;
            })()}
        </div>
    );
};