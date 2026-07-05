import { Player, GameMode, LeagueTier, UserStatus, WinReason, RPSChoice, DiceGoVariant, AlkkagiPlacementType, AlkkagiLayoutType, Point, Move, BoardState, EquipmentSlot, InventoryItemType, ItemGrade, CoreStat, ItemOptionType, TournamentType, TournamentSimulationStatus, GameStatus, SinglePlayerLevel, GameCategory, GuildMemberRole, GuildResearchId } from './enums.js';
// FIX: ChatMessage is now defined in api.ts to break circular dependency.
import { UserStatusInfo, ChatMessage } from './api.js';
import type { UnifiedResultContract } from './resultContract.js';
import type { PairTrainingClaimClientSummary } from './pairTrainingClaim.js';

// --- Item & Equipment ---

/** 페어 AI 펫 인스턴스 메타(인벤 `pair-pet-*` 행에 부착) */
export type PairPetDisposition =
    | { kind: 'single'; stat: CoreStat; pct: number }
    | { kind: 'all'; pct: number }
    /** 한 코어의 pct%(등급 기준 기본치 기준)만큼 감소, 그 절대값의 2배를 다른 코어에 가산 */
    | { kind: 'convert'; fromStat: CoreStat; toStat: CoreStat; pct: number };

export type PairPetSpecialization =
    | { kind: 'trainingXp'; pct: number }
    | { kind: 'trainingGold'; pct: number }
    | { kind: 'trainingTime'; pct: number }
    /** 수련 보상 수령 시 영혼석 추가 판정 확률(`soulDropChance`)에 pct%p 가산(상한 99.9%) */
    | { kind: 'soulDrop'; pct: number }
    /** 수련 영혼석 지급 시 수량 +1 */
    | { kind: 'trainingSoulQuantityPlusOne' }
    /** 전략 경기장 탭 랭킹/대국 등 — 대표 펫 장착 시 해당 경기 행동력 소모 -1(최소 0) */
    | { kind: 'strategicArenaApMinusOne' }
    /** 페어 경기장(기본 pair 탭) 랭킹전 등 — 대표 펫 장착 시 인당 행동력 소모 -1(최소 0) */
    | { kind: 'pairArenaApMinusOne' }
    /** 놀이 경기장 탭 — 대표 펫 장착 시 해당 경기 행동력 소모 -1(최소 0) */
    | { kind: 'playfulArenaApMinusOne' };

/** 페어 펫 가위바위보 속성 — 1=가위, 2=바위, 3=보 */
export type PairPetRpsAttribute = 1 | 2 | 3;

export type PairPetMeta = {
    level: number;
    xp: number;
    disposition: PairPetDisposition;
    specialization: PairPetSpecialization;
    /** 부화 시 6코어 각 30~70·합 300 무작위 분배(등급 배율 전 정수). 없으면 구 방식(코어당 50)과 동일 취급 */
    birthCoreBases?: Partial<Record<CoreStat, number>>;
    /** 레벨업 시 등급별 풀을 6코어에 랜덤 분배한 누적 보너스 */
    levelUpCoreBonuses?: Partial<Record<CoreStat, number>>;
    /** 부화 시 부여. 구 데이터는 resolve 시 결정론 백필 */
    rpsAttribute?: PairPetRpsAttribute;
};

/** 수련 시작 시 서버가 확정한 보상(완료 시 재롤 없이 지급). 구버전 세션에는 없음 */
export type PairPetTrainingPrecomputedRewards = {
    goldRoll: number;
    goldGain: number;
    goldFromSpec: number;
    xpRoll: number;
    xpGain: number;
    xpFromSpec: number;
    /** 영혼석 특화 +1 반영된 최종 수량. 없음은 `null` */
    soulDrop: { materialName: string; quantity: number } | null;
};

/** 페어 펫 수련 슬롯(인덱스 0~4)에 배치된 세션 */
export type PairPetTrainingSlotState = {
    slotIndex: number;
    itemId: string;
    startedAt: number;
    /** `PAIR_PET_START_TRAINING` 시 롤·취소 시 폐기 */
    precomputedRewards?: PairPetTrainingPrecomputedRewards;
};

/** 수련 보상 수령 직후 광고 시청 2배 보상 1회 지급 검증용 서버 상태 */
export type PairPetTrainingAdDoubleClaimState = {
    claimId: string;
    createdAt: number;
    slotIndex: number;
    itemId?: string;
    summary: PairTrainingClaimClientSummary;
};

/** 부화장 슬롯에 올려둔 알(부화 진행 중) */
export type PairPetHatcherySession = {
    slotIndex: number;
    startedAt: number;
    /** 부화 시작 시 차감한 알 인벤 행 id (취소 시 복구) */
    eggItemId?: string;
    /** 부화에 사용한 알의 templateId (예: `pair-egg-welcome` → 1분·레벨 10) */
    eggTemplateId?: string;
};

/** 페어 펫 로비 인벤(펫·영혼석) 목록 정렬 */
export type PairPetLobbyInventorySortMode =
    | 'recent'
    | 'oldest'
    | 'name'
    | 'petLevel'
    | 'gradeHigh'
    /** `pair-pet-N` / 영혼석 탭에서는 `pair-soul-N` 도감 번호 오름차순 */
    | 'petNumber';

export type Equipment = Partial<Record<EquipmentSlot, string>>;

export type EquipmentPreset = {
  name: string;
  equipment: Equipment;
};

export type ItemOption = {
  type: ItemOptionType;
  value: number;
  baseValue?: number;
  isPercentage: boolean;
  tier?: number; // For special stats
  display: string;
  range?: [number, number];
  enhancements?: number;
};

export type ItemOptions = {
  main: ItemOption;
  combatSubs: ItemOption[];
  specialSubs: ItemOption[];
  mythicSubs: ItemOption[];
};

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  type: InventoryItemType;
  slot: EquipmentSlot | null;
  quantity?: number;
  level: number;
  isEquipped: boolean;
  createdAt: number;
  image: string;
  grade: ItemGrade;
  stars: number;
  options?: ItemOptions;
  enhancementFails?: number;
  /** 관리자 우편 첨부: 서버에서 부/특 옵션까지 강화 반영 완료. 수령 시 재시뮬레이션하지 않음 */
  mailPreEnhanced?: boolean;
  /** 아이템 출처(가방 합치기·사용 제한 구분). 예: 도전의 탑 `tower`, 페어 로비 `future-pet-system` 등 */
  source?: string;
  /** 장비 템플릿·우편 지급 등 서버 내부 참조용 */
  templateId?: string;
  /** 장비 세련(제련) 누적 횟수 등 */
  refinementCount?: number;
  /** 장비 귀속 여부: 첫 장착 시도 시 true */
  isBound?: boolean;
  /** 귀속 처리 시각(디버깅/로그용) */
  boundAt?: number;
  /** 거래소 등록 중 상태(등록 취소/회수 시 해제) */
  isExchangeListed?: boolean;
  /** 페어 AI 펫 전용(부화 시 생성) */
  pairPetMeta?: PairPetMeta;
};

// --- User & Associated Data ---
export type Mail = {
  id: string;
  from: string;
  title: string;
  message: string;
  attachments?: {
    gold?: number;
    diamonds?: number;
    actionPoints?: number;
    /** 길드 보스전 정산 보상: 유저 재화 */
    guildCoins?: number;
    /** 길드 보스전 정산 보상: 길드 연구소 포인트 */
    researchPoints?: number;
    items?: (InventoryItem | { itemId: string; quantity: number })[];
    /** 관리자 우편: 캐시샵 패키지(수령 시 상점 구매와 동일 효과, 월간 한도 미반영) */
    cashShopPackages?: { packageId: string; quantity: number }[];
  };
  receivedAt: number;
  expiresAt?: number;
  isRead: boolean;
  attachmentsClaimed: boolean;
};

export type QuestReward = {
  gold?: number;
  diamonds?: number;
  xp?: { type: 'strategy' | 'playful' | 'blacksmith'; amount: number };
  items?: (InventoryItem | { itemId: string; quantity: number })[];
  actionPoints?: number;
  guildCoins?: number;
  guildXp?: number;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: QuestReward;
  activityPoints: number;
  isClaimed: boolean;
};

export type DailyQuestData = {
  quests: Quest[];
  activityProgress: number;
  claimedMilestones: boolean[];
  lastReset: number;
};

export type WeeklyQuestData = {
  quests: Quest[];
  activityProgress: number;
  claimedMilestones: boolean[];
  lastReset: number;
};

export type MonthlyQuestData = {
  quests: Quest[];
  activityProgress: number;
  claimedMilestones: boolean[];
  lastReset: number;
};

export type AchievementTrackState = {
  currentIndex: number;
  claimedIndices: number[];
};

export type AchievementData = {
  tracks: Record<string, AchievementTrackState>;
  /** 누적 장비 상자 사용(상점 즉시 개봉·인벤 사용·광고 보상 즉시 개봉 등) */
  totalEquipmentBoxOpens?: number;
  /** 누적 재료 상자 사용 */
  totalMaterialBoxOpens?: number;
  /** 페어 펫 수련 보상 수령 완료 누적 */
  totalPairPetTrainingClaims?: number;
  /** 페어 펫 영혼변환 누적 */
  totalPairPetSoulConverts?: number;
};


export type QuestLog = {
    daily?: DailyQuestData;
    weekly?: WeeklyQuestData;
    monthly?: MonthlyQuestData;
    achievements?: AchievementData;
};

export type AvatarInfo = {
  id: string;
  name: string;
  url: string;
  requiredLevel: number;
  type: 'strategy' | 'playful' | 'any';
};

export type BorderInfo = {
  id: string;
  name: string;
  url: string | null;
  description: string;
  unlockTier?: string;
  requiredLevelSum?: number;
};

export type ShopBorderItem = BorderInfo & {
    price: { gold?: number; diamonds?: number };
};

export type WeeklyCompetitor = {
    id: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: LeagueTier;
    initialScore: number;
};

// --- Tournament ---
export type TournamentDefinition = {
    id: TournamentType;
    name: string;
    description: string;
    format: 'round-robin' | 'tournament';
    players: number;
    image: string;
};

export type CommentaryLine = {
    text: string;
    phase: 'early' | 'mid' | 'end';
    scores?: { player1: number; player2: number };
    isRandomEvent?: boolean;
};

export type Match = {
    id: string;
    players: (PlayerForTournament | null)[];
    winner: PlayerForTournament | null;
    isFinished: boolean;
    commentary: CommentaryLine[];
    isUserMatch: boolean;
    finalScore: { player1: number; player2: number } | null;
    score?: { player1: number; player2: number };
    timeElapsed?: number;
    sgfFileIndex?: number;
    championshipRealGame?: ChampionshipRealGameState | null;
};

export type ChampionshipRealGameEvent = {
    ply: number;
    playerId: string;
    player: Player;
    type: 'mistake' | 'bestMove';
    chancePercent: number;
    originalMove?: Point | null;
    appliedMove: Point;
};

export type ChampionshipRealGameState = {
    boardSize: 9 | 13 | 19;
    maxPly: number;
    blackPlayerId: string;
    whitePlayerId: string;
    /** 페어 챔피언십 등: 4인 수순(흑1·백1·흑2·백2). `moves[].pairSeatId`와 함께 쓰인다. */
    pairTurnOrder?: import('../utils/pairGameTurn.js').PairGameTurnSeat[] | null;
    boardState: BoardState;
    moves: Move[];
    lastMove: Point | null;
    currentPly: number;
    status: 'ready' | 'playing' | 'scoring' | 'finished';
    finalScore: { black: number; white: number; scoreLead: number } | null;
    winnerId: string | null;
    events: ChampionshipRealGameEvent[];
    phaseStatsByPlayerId: Record<string, Record<'opening' | 'midgame' | 'endgame', { abilityScore: number; kataLevel: number }>>;
    timeMetrics?: {
        generatedAt: number;
        generationMs: number;
        playbackStartedAt?: number;
        playbackCompletedAt?: number;
        scoringStartedAt?: number;
        scoringCompletedAt?: number;
    };
    /** KataGo(또는 폴백 manual) 계가 분석 — 영토·사석 오버레이용. `generateChampionshipRealMatch` 시점에 확정 */
    scoringAnalysis?: AnalysisResult | null;
    resultContract?: UnifiedResultContract;
};

export type Round = {
    id: number;
    name: string;
    matches: Match[];
};

export type TournamentState = {
    type: TournamentType;
    status: TournamentSimulationStatus;
    title: string;
    players: PlayerForTournament[];
    rounds: Round[];
    currentSimulatingMatch: { roundIndex: number; matchIndex: number } | null;
    currentMatchCommentary: CommentaryLine[];
    currentRoundRobinRound?: number;
    lastPlayedDate: number;
    nextRoundStartTime: number | null;
    timeElapsed: number;
    lastSimulationTime?: number; // 마지막 시뮬레이션 실행 시간 (ms)
    simulationSeed?: string; // 클라이언트 시뮬레이션을 위한 랜덤 시드
    currentMatchScores?: { player1: number; player2: number } | null;
    lastScoreIncrement?: { 
        player1: { base: number; actual: number; isCritical: boolean } | null;
        player2: { base: number; actual: number; isCritical: boolean } | null;
    } | null;
    currentMatchResult?: {
        winnerId: string;
        loserId: string;
        rewards?: { gold: number; diamonds: number; };
    } | null;
    accumulatedGold?: number; // 동네바둑리그 경기별 누적 골드
    matchGoldRewards?: number[]; // 동네바둑리그 경기마다 받은 골드 (표시용, 1회차당 1개씩)
    accumulatedMaterials?: Record<string, number>; // 전국바둑대회 경기별 누적 재료 (재료명: 개수)
    matchMaterialRewards?: Record<string, number>[]; // 전국바둑대회 8강/4강/결승(또는 3·4위전) 각 경기별 재료 (표시용 더미)
    accumulatedEquipmentBoxes?: Record<string, number>; // 월드챔피언십 경기별 누적 장비상자 (상자명: 개수)
    accumulatedEquipmentDrops?: string[]; // 월드챔피언십 경기별 누적 장비 드롭 등급 (normal/rare/epic 등)
    accumulatedEquipmentItems?: InventoryItem[]; // 월드챔피언십 경기별 실제 획득 장비 (즉시 표시/지급용)
    // 던전 시스템 필드
    currentStage?: number; // 현재 클리어한 최고 단계 (1~10)
    unlockedStages?: number[]; // 클리어하여 언락된 단계 배열
    stageResults?: Record<number, {
        cleared: boolean; // 클리어 여부
        scoreDiff: number; // 점수차이 (랭킹 정렬용)
        clearTime: number; // 클리어 시간
        rank?: number; // 해당 단계에서의 순위
        dailyScore?: number; // 일일 획득 점수
    }>;
    dailyStageAttempts?: Record<number, number>; // 일일 단계별 시도 횟수 (리셋용)
    currentStageAttempt?: number; // 현재 진행 중인 단계
    /** Kata 기보 생성 중인 유저 매치 id — 완료·실패 시 null */
    championshipMatchGeneratingMatchId?: string | null;
    autoAdvanceEnabled?: boolean; // 첫 경기 시작 후 자동 진행 여부
    claimedRewardSummary?: {
        stage: number;
        userRank: number;
        wins: number;
        losses: number;
        baseRewards: {
            gold?: number;
            materials?: Record<string, number>;
            equipmentBoxes?: Record<string, number>;
            changeTickets?: number;
            changeTicketGrants?: { name: string; quantity: number }[];
            champCoins?: number;
        };
        rankReward?: {
            items?: Array<{ itemId: string; quantity?: number; min?: number; max?: number }>;
        };
        grantedEquipmentDrops?: Array<{ name: string; image: string }>;
        nextStageUnlocked: boolean;
        nextStageWasAlreadyUnlocked?: boolean;
        dailyScore?: number;
        claimedAt: number;
    } | null;
};

export type LeagueOutcome = 'promote' | 'maintain' | 'demote';

export interface LeagueRewardTier {
    rankStart: number;
    rankEnd: number;
    diamonds: number;
    outcome: LeagueOutcome;
}

export type UserCredentials = {
  username: string;
  passwordHash: string;
  userId: string;
};

export type AdventureRegionalSpecialtyBuffKind =
  | 'regional_win_gold_10pct'
  | 'regional_equip_drop_3pct'
  | 'regional_material_drop_5pct'
  | 'regional_capture_target_plus1'
  | 'regional_time_limit_plus20pct'
  | 'regional_monster_respawn_minus10pct'
  | 'regional_monster_dwell_plus10pct'
  | 'regional_hidden_scan_plus1'
  | 'regional_base_start_score_plus1'
  | 'regional_classic_start_score_plus1'
  | 'regional_missile_plus1'
  | 'adv_gold_pct'
  | 'map_monster_dwell_pct'
  | 'capture_opponent_target_plus1'
  | 'hidden_scan_plus1'
  | 'missile_plus1';

export type AdventureRegionalSpecialtyBuffEntry = {
  kind: AdventureRegionalSpecialtyBuffKind;
  stacks?: number;
  valuePercent?: number;
};

/** 모험 전용 진행·전적(메인 프로필·랭킹 전적과 분리). 서버 `status` JSON 등에 동기화 가능 */
export type AdventureProfile = {
  /** 몬스터(대국 룰 타입)별 처치 수 */
  monstersDefeatedByMode?: Partial<Record<string, number>>;
  monstersDefeatedTotal?: number;
  /** 몬스터(대국 룰 타입)별 패배(놓침) 수 */
  monstersMissedByMode?: Partial<Record<string, number>>;
  monstersMissedTotal?: number;
  /** 스테이지(지역)별 이해도 XP — 누적 시 티어 상승 */
  understandingXpByStage?: Partial<Record<string, number>>;
  /** 도감 몬스터별 누적 승리 수(이해도 경험치) — `codexId` 키 */
  codexDefeatCounts?: Partial<Record<string, number>>;
  /** 도감 몬스터별 현재 승리 수에 마지막 도달 시각(ms). 동점 시 먼저 달성 우선 */
  codexDefeatCountReachedAtByCodexId?: Partial<Record<string, number>>;
  /** 사냥 점수 — 처치한 몬스터 레벨의 누적 합(모험 랭킹) */
  huntingScoreTotal?: number;
  /** 현재 `huntingScoreTotal`에 마지막으로 도달한 시각(ms). 동점 시 먼저 달성한 순 */
  huntingScoreReachedAt?: number;
  /** 도감 연동용 고유 몬스터 ID(추후) */
  uniqueMonsterIdsCaught?: string[];
  lastPlayedStageId?: string | null;
  /**
   * 모험 맵 절대 스케줄 재출현을 늦춤(처치 직후 등). 키는 `stageId::codexId`.
   * 값은 해당 시각(ms) 이전에는 맵에 표시하지 않음.
   */
  adventureMapSuppressUntilByKey?: Partial<Record<string, number>>;
  regionalSpecialtyBuffsByStageId?: Partial<Record<string, AdventureRegionalSpecialtyBuffEntry[]>>;
  regionalBuffEnhancePointsByStageId?: Partial<Record<string, number>>;
  regionalBuffRerollUtcDate?: string;
  regionalBuffRerollCountToday?: number;
  /** 스테이지별 모험 맵 열쇠 보유 */
  adventureMapKeysHeldByStageId?: Partial<Record<string, number>>;
    /** 스테이지별 다음 열쇠까지 열쇠 경험치 누적(챕터별 상한 미만, 상한 도달 시 열쇠 1개 획득 시도) */
    adventureMapKeyKillProgressByStageId?: Partial<Record<string, number>>;
  /** KST YYYY-MM-DD — `adventureMapKeysEarnedTodayByStageId` 일일 한도 기준일 */
  adventureMapKeyEarnedKstDate?: string;
  /** 스테이지별 당일 열쇠 획득 수 */
  adventureMapKeysEarnedTodayByStageId?: Partial<Record<string, number>>;
  /** 스테이지별 보물상자 수령 완료한 출현 창 시작 시각(ms) — 동일 창 중복 방지 */
  adventureMapTreasureClaimedWindowStartByStageId?: Partial<Record<string, number>>;
  /** 스테이지별 보물상자를 건너뛴 출현 창 시작 시각(ms) — 열쇠 유지, 해당 창 동안 맵에 미표시 */
  adventureMapTreasureDismissedWindowStartByStageId?: Partial<Record<string, number>>;
  /** 보물상자 3연 선택(열쇠 확정 전) — `shared/utils/adventureMapTreasureRewards`의 `AdventureMapTreasurePickSession` */
  adventureMapTreasurePickSession?: import('../utils/adventureMapTreasureRewards.js').AdventureMapTreasurePickSession;
};

export type SinglePlayerMissionLevelInfo = {
    level: number;
    unlockStageId?: string; // 레벨 10 오픈조건 (선택적)
    productionRateMinutes: number; // 생산속도 (분)
    rewardAmount: number; // 생산량
    maxCapacity: number; // 최대생산량
};

export type SinglePlayerMissionInfo = {
    id: string;
    name: string;
    description: string;
    unlockStageId: string; // 최초 오픈조건 (레벨 1)
    rewardType: 'gold' | 'diamonds';
    image: string;
    levels: SinglePlayerMissionLevelInfo[]; // 레벨 1-10 정보
};

export type SinglePlayerMissionState = {
    id: string;
    isStarted: boolean;
    level: number; // 현재 레벨 (1-10)
    lastCollectionTime: number;
    accumulatedAmount: number; // 현재 누적 생산량
    accumulatedCollection: number; // 누적 수령액 (레벨업용)
};

export type CurrencyExchangeOrder = {
  id: string;
  posterId: string;
  posterNickname: string;
  fromCurrency: 'gold' | 'diamonds';
  fromAmount: number;
  toCurrency: 'gold' | 'diamonds';
  toAmount: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: number;
  filledAt?: number;
  filledByUserId?: string;
  filledByNickname?: string;
};

export type CurrencyExchangeReceipt = {
  orderId: string;
  amount: number;
  currency: 'gold' | 'diamonds';
  fromCurrency: 'gold' | 'diamonds';
  fromAmount: number;
  filledAt: number;
  claimed: boolean;
};

export type ExchangeState = {
  listings: Array<{
    id: string;
    sellerId: string;
    sellerNickname: string;
    itemId: string;
    itemName: string;
    itemImage?: string;
    itemSlot?: EquipmentSlot;
    itemGrade?: string;
    itemStars?: number;
    itemLevel?: number;
    price: number;
    currency: 'gold' | 'diamonds';
    verificationStatus: 'verifying' | 'active';
    createdAt: number;
    verificationEndsAt?: number;
    expiresAt: number;
    status: 'listed' | 'sold';
    soldAt?: number;
    /** 등록 시점 장비 전체(주/부옵션 등) — 구매자 미리보기용 */
    listedEquipment?: InventoryItem;
  }>;
  settlements: Array<{
    listingId: string;
    itemId: string;
    itemName: string;
    soldPrice: number;
    currency: 'gold' | 'diamonds';
    soldAt: number;
    claimed: boolean;
  }>;
  history: string[];
  /** P2P 골드↔다이아 환전 요청 (본인 등록분) */
  currencyOrders?: CurrencyExchangeOrder[];
  /** P2P 환전 완료 후 수령 대기 */
  currencyReceipts?: CurrencyExchangeReceipt[];
  /** 일일 바로환전 사용량 (KST 0시 기준 리셋) */
  instantDaily?: {
    lastResetDayKST: number;
    goldSpent: number;
    diamondsSpent: number;
  };
};

/** PVP / 펫 / 펫 페어 챔피언십 경기장(인게임) — 전략바둑 랭킹전과 동일한 분기(KST) 시즌·1200점대 ELO */
export type ChampionshipVersusVenueKind = 'pvp' | 'pet' | 'petpair';

export type ChampionshipVersusVenueRatingEntry = {
    /** 시즌 ELO (전략바둑 랭킹전과 동일 기준점 1200, 시즌이 바뀌어도 점수는 유지) */
    rating: number;
    /** `getCurrentSeason().name` 과 일치해야 현재 시즌 전적·집계에 포함 */
    ratingSeasonKey: string;
    /** 현재 시즌 챔피언십 대전장 대국 승(시즌 종료 시 0으로 리셋) */
    seasonWins: number;
    /** 현재 시즌 패 */
    seasonLosses: number;
};

/** KST 달력 기준 최근 7일 챔피언십 대전장 대전 기록(본인 시점: 상대·승패·내 ELO 변화) */
export type ChampionshipVersusDuelWeekLogEntry = {
    id: string;
    occurredAt: number;
    venue: ChampionshipVersusVenueKind;
    opponentUserId: string;
    opponentNickname: string;
    won: boolean;
    ratingBefore: number;
    ratingAfter: number;
};

/** 직전 시즌 종료 시점의 챔피언십 대전장 티어(전략바둑 시즌 보상과 동일 RANKING_TIERS) */
export type ChampionshipVersusSeasonHistory = Partial<Record<ChampionshipVersusVenueKind, string>>;

export type User = {
  id: string;
  username: string;
  nickname: string;
  isAdmin: boolean;
  /** 관리자 패널에서 예약 닉네임(관리자/운영자 문구)을 허용한 경우 UI 강조용 */
  staffNicknameDisplayEligibility?: boolean;
  userLevel: number;
  userXp: number;
  baseStats: Record<CoreStat, number>;
  spentStatPoints: Record<CoreStat, number>;
  inventory: InventoryItem[];
  exchangeState?: ExchangeState;
  inventorySlots: { equipment: number; consumable: number; material: number; };
  equipment: Equipment;
  equipmentPresets?: EquipmentPreset[];
  actionPoints: { current: number; max: number };
  lastActionPointUpdate: number;
  actionPointPurchasesToday?: number;
  lastActionPointPurchaseDate?: number;
  dailyShopPurchases?: Record<string, { quantity: number; date: number; lastPurchaseTimestamp?: number }>;
  gold: number;
  diamonds: number;
  mannerScore: number;
  mail: Mail[];
  quests: QuestLog;
  stats?: Record<string, { wins?: number; losses?: number; rankingScore?: number; aiWins?: number; aiLosses?: number }>;
  chatBanUntil?: number | null;
  connectionBanUntil?: number | null;
  chatBanReason?: string | null;
  connectionBanReason?: string | null;
  sanctionHistory?: Array<{
    id: string;
    sanctionType: 'chat' | 'connection';
    reason: string;
    details?: string;
    createdAt: number;
    expiresAt?: number | null;
    releasedAt?: number | null;
    releasedBy?: string;
  }>;
  avatarId: string;
  borderId: string;
  ownedBorders: string[];
  previousSeasonTier?: string | null;
  seasonHistory?: Record<string, Partial<Record<GameMode, string>>>;
  tournamentScore: number;
  league: LeagueTier;
  mannerMasteryApplied?: boolean;
  pendingPenaltyNotification?: string | null;
  lastNeighborhoodPlayedDate?: number | null;
  dailyNeighborhoodWins?: number;
  neighborhoodRewardClaimed?: boolean;
  lastNeighborhoodTournament?: TournamentState | null;
  lastNationalPlayedDate?: number | null;
  dailyNationalWins?: number;
  nationalRewardClaimed?: boolean;
  lastNationalTournament?: TournamentState | null;
  lastWorldPlayedDate?: number | null;
  dailyWorldWins?: number;
  worldRewardClaimed?: boolean;
  lastWorldTournament?: TournamentState | null;
  /** 주간 리그 경쟁상대 (동네/전국/월드 던전 등에서 사용) */
  weeklyCompetitors?: WeeklyCompetitor[];
  /** 주간 경쟁상대 중 봇의 점수 (id -> { score, lastUpdate, yesterdayScore }) */
  weeklyCompetitorsBotScores?: Record<string, { score: number; lastUpdate: number; yesterdayScore: number }>;
  lastWeeklyCompetitorsUpdate?: number | null;
  lastLeagueUpdate?: number | null; // league는 유지 (다른 곳에서 사용 가능)
  // 던전 진행 상태
  dungeonProgress?: Record<TournamentType, {
    currentStage: number; // 현재 클리어한 최고 단계 (1~10)
    unlockedStages: number[]; // 클리어하여 언락된 단계 배열
    stageResults: Record<number, {
      cleared: boolean;
      scoreDiff: number;
      clearTime: number;
      rank?: number;
      dailyScore?: number;
    }>;
    dailyStageAttempts: Record<number, number>; // 일일 단계별 시도 횟수
  }>;
  /** 경기장별·오늘자 컨디션 스냅샷. 뒤로 나갔다 재입장해도 같은 컨디션 유지, 회복제 반영 유지. 완료/포기 시 삭제 */
  dungeonConditionSnapshot?: Partial<Record<TournamentType, { condition: number; dateStartOfDayKST: number }>>;
  /** PVE 챔피언십 던전 일일 입장(기본 1회 + 광고 보너스 1회) */
  championshipDungeonDailyEntry?: Partial<
      Record<TournamentType, { dateStartOfDayKST: number; entriesUsed: number; adBonusGranted: boolean }>
  >;
  dailyDungeonScore?: number; // 일일 획득 점수 (리셋용)
  mbti?: string | null;
  rejectedGameModes?: GameMode[];
  isMbtiPublic?: boolean;
  /** 페어 경기장 파트너 초대 수신 거부(전략·놀이 집계 로비 유저 목록에서 설정) */
  blockArenaPartnerInvites?: boolean;
  /** 화면별 첫 진입 도움말 「다시 보지 않기」 (계정·기기 간 동기화) */
  dismissedScreenGuides?: string[];
  statResetCountToday?: number;
  lastStatResetDate?: string | null;
  singlePlayerProgress?: number;
  clearedSinglePlayerStages?: string[]; // 클리어한 스테이지 ID 배열 (최초 클리어 여부 추적용)
  /** 반별 스테이지 클리어 수 10·20점 막대 보상 수령 여부 */
  singlePlayerClassBarClaims?: Partial<Record<SinglePlayerLevel, { m10?: boolean; m20?: boolean }>>;
  bonusStatPoints?: number;
  /**
   * 통합 레벨 구조 변경 시 서버가 1회 `spentStatPoints`를 비운 뒤 true.
   * 신규 유저는 생성 시 true로 두어 마이그레이션을 건너뜀.
   */
  statAllocationResetForUserLevelStructureV1?: boolean;
  singlePlayerMissions?: Record<string, SinglePlayerMissionState>;
  guildId?: string;
  /** 길드전 출전 의사 (미설정은 참여로 간주) */
  guildWarParticipationEnabled?: boolean;
  /** 길드전 월간 출전 횟수 (KST 기준, key: YYYY-MM) */
  guildWarMonthlyParticipations?: Record<string, number>;
  blacksmithLevel: number;
  blacksmithXp: number;
  cumulativeRankingScore?: Record<string, number>;
  cumulativeTournamentScore?: number; /** @deprecated 레거시 던전 누적 — 항상 0, 랭킹에는 미사용 */
  yesterdayTournamentScore?: number; // 어제의 챔피언십 점수 (변화량 계산용)
  inventorySlotsMigrated?: boolean;
  towerFloor?: number; // 도전의 탑 최고 층수
  lastTowerClearTime?: number; // 마지막 층 클리어 시간 (랭킹 정렬용)
  monthlyTowerFloor?: number; // 한 달 동안 클리어한 최고 층수 (매월 1일 리셋)
  dailyRankings?: {
    strategic?: { rank: number; score: number; lastUpdated: number };
    pair?: { rank: number; score: number; lastUpdated: number };
    championship?: {
      score?: number;
      neighborhood?: { rank: number; maxStage: number; maxScoreDiff: number; totalAbility: number; lastUpdated: number };
      national?: { rank: number; maxStage: number; maxScoreDiff: number; totalAbility: number; lastUpdated: number };
      world?: { rank: number; maxStage: number; maxScoreDiff: number; totalAbility: number; lastUpdated: number };
    };
  };
  savedGameRecords?: GameRecord[];
  lastLoginAt?: number;
  dailyDonations?: { gold: number; diamond: number; date: number };
  guildCoins?: number;
  /** 챔피언십 상점: 주간 한도 상품 구매 수 (키: 상품 id, date: 마지막 구매 시각 ms — `isDifferentWeekKST`로 주 초기화) */
  championshipShopWeekPurchases?: Record<string, { quantity: number; date: number }>;
  /** 챔피언십 상점 등 전용 재화 */
  champCoins?: number;
  /** PVP·펫·펫 페어 챔피언십 경기장 분기 시즌 ELO·시즌 전적 */
  championshipVersusVenueRatings?: Partial<Record<ChampionshipVersusVenueKind, ChampionshipVersusVenueRatingEntry>>;
  /** 시즌명 → 경기장별 당시 티어(전략바둑 `seasonHistory`와 별도) */
  championshipVersusSeasonHistory?: Record<string, ChampionshipVersusSeasonHistory>;
  /** KST `YYYY-MM-DD` — 당일 챔피언십 대전장 상대 목록 무료 새로고침 집계일 */
  championshipVersusOppRefreshDayKST?: string;
  /** 당일 무료 새로고침 사용 횟수(날짜 바뀌면 0으로 리셋) */
  championshipVersusOppRefreshFreeUsed?: number;
  /** PVP·펫·페어 챔피언십 경기장별 오늘(KST) 컨디션 스냅샷 — 던전과 동일하게 회복제·재입장 시 유지 */
  championshipVersusConditionSnapshot?: Partial<
    Record<ChampionshipVersusVenueKind, { condition: number; dateStartOfDayKST: number }>
  >;
  /** 챔피언십 대전장 결투권(최대 5). 2시간마다 1회복 — PVP 풀 미러(구 클라이언트·로그용) */
  championshipVersusDuelTickets?: number;
  /** 결투권이 최대 미만일 때 다음 1개 충전 시각(ms) — PVP 풀 미러 */
  championshipVersusDuelTicketNextAt?: number;
  /** 경기장별 결투권 보유 수(PVP·펫·페어 각각 소모, ELO는 공유) */
  championshipVersusDuelTicketsByVenue?: Partial<Record<ChampionshipVersusVenueKind, number>>;
  /** 경기장별 다음 1개 충전 시각(ms) */
  championshipVersusDuelTicketNextAtByVenue?: Partial<Record<ChampionshipVersusVenueKind, number>>;
  /** KST 최근 7일 챔피언십 대전장 대전 기록 */
  championshipVersusDuelWeekLog?: ChampionshipVersusDuelWeekLogEntry[];
  guildBossAttempts?: number;
  /** KST 기준 마지막 보스전 참여일 'YYYY-MM-DD' (일일 2회 제한용) */
  guildBossLastAttemptDayKST?: string;
  /** 당일(KST) 사용한 보스전 참여 횟수 (0|1|2). 날짜가 바뀌면 0으로 리셋, 미사용 시 누적 없음 */
  guildBossAttemptsUsedToday?: number;
  guildApplications?: Array<{ guildId: string; appliedAt: number }>;
  friendIds?: string[];
  incomingFriendRequestIds?: string[];
  outgoingFriendRequestIds?: string[];
  /** 페어 AI 동료 펫: 인벤 `templateId`(pair-pet-*) 중 전투/프로필에 반영할 템플릿 */
  equippedPairPetTemplateId?: string | null;
  /** 동종 펫이 여러 마리일 때 대표로 쓸 정확한 인벤 행 (`inventory[].id`) */
  equippedPairPetInventoryItemId?: string | null;
  /** 페어 경기장 펫 탭 로비 인벤 슬롯 수(기본 10, 최대 50, 확장 시 +5) */
  pairPetLobbyPetSlotCount?: number;
  /** 페어 경기장 알 탭 로비 인벤 슬롯 수(기본 10, 최대 50, 확장 시 +5) */
  pairPetLobbyEggSlotCount?: number;
  /** @deprecated 예전 단일 필드 — pet/egg 미저장 시 마이그레이션용 */
  pairPetLobbySlotCount?: number;
  /** 페어 펫 수련장: 슬롯별 진행 중 세션(null = 비어 있음) */
  pairPetTrainingSlots?: (PairPetTrainingSlotState | null)[];
  /** 페어 펫 수련 완료 보상 광고 2배: 최근 수령분별 1회성 대기 상태 */
  pairPetTrainingAdDoubleClaims?: Record<string, PairPetTrainingAdDoubleClaimState>;
  /** 부화장 1번 슬롯 강화 I~III 해금 여부 `[tier1, tier2, tier3]` (레거시 4칸 해금 배열도 마이그레이션) */
  pairPetHatcherySlotUnlocked?: boolean[];
  /** 부화장: 1번 슬롯 + VIP 슬롯 진행 세션 */
  pairPetHatcherySessions?: (PairPetHatcherySession | null)[];
  /** 페어 펫 로비 인벤 정렬(저장 시 다음 접속에 유지) */
  pairPetLobbyInventorySort?: PairPetLobbyInventorySortMode;
  /** 페어 경기장 대국만의 모드별 승패 (PVP 일반 대국 `stats[mode]`와 별도) */
  pairArenaStatsByMode?: Record<string, { wins: number; losses: number }>;
  /** 모험 스테이지·몬스터 전용 통계 및 이해도 */
  adventureProfile?: AdventureProfile;
  /** VIP 만료 시각(ms). Header 등에서 활성 여부 판별. 관리자 테스트용으로 직접 설정 가능. */
  rewardVipExpiresAt?: number;
  functionVipExpiresAt?: number;
    vvipExpiresAt?: number;
    /** 활성 유료 다이아 패키지 티어(1~3). 만료 후 0 또는 미설정 */
    activeDiamondPackageTier?: 0 | 1 | 2 | 3;
    /** 다이아 패키지(매일 우편 구간) 종료 시각(ms) */
    diamondPackageExpiresAt?: number;
    /** KST 기준 마지막 다이아 패키지 일일 우편 발송일 YYYY-MM-DD */
    diamondPackageLastMailDayKST?: string;
    /** 상점 「광고 제거」 패키지 구매 시 true — 영구 */
    removeAdsPurchased?: boolean;
    /**
     * 상점 VIP 탭: 상품별 30일 자동갱신(만료 시 등록 결제로 연장).
     * PG 연동 시 결제 성공 후에만 true로 두는 것을 권장합니다.
     */
    vipShopAutoRenew?: Partial<Record<'reward_vip' | 'function_vip' | 'vvip', boolean>>;
};

export type GameRecord = {
  id: string;
  gameId: string;
  mode: GameMode;
  /** 기보를 저장한 유저의 착색 (구 기록에는 없을 수 있음) */
  myColor?: Player;
  opponent: {
    id: string;
    nickname: string;
  };
  date: number;
  sgfContent: string;
  gameResult: {
    winner: Player;
    blackScore: number;
    whiteScore: number;
    /** 종료 사유 (구 기록에는 없을 수 있음) */
    winReason?: WinReason;
    /** 계가 승 시 집 차이(절대값). 구 기록은 점수에서 추정 가능 */
    scoreMargin?: number;
    scoreDetails?: {
      black: {
        timeBonus: number;
        baseStoneBonus: number;
        hiddenStoneBonus: number;
        itemBonus: number;
        komi?: number;
      };
      white: {
        timeBonus: number;
        baseStoneBonus: number;
        hiddenStoneBonus: number;
        itemBonus: number;
        komi?: number;
      };
    };
  };
};

export type EnhancementResult = {
  message: string;
  success: boolean;
  itemBefore: InventoryItem;
  itemAfter: InventoryItem;
  isRolling?: boolean; // 롤링 애니메이션 상태 (제련 진행 중)
  xpGained?: number;
};

export type UserWithStatus = User & UserStatusInfo;

export type PlayerForTournament = Pick<User, 'id' | 'nickname' | 'avatarId' | 'borderId' | 'league'> & {
    stats: Record<CoreStat, number>;
    originalStats?: Record<CoreStat, number>;
    wins: number;
    losses: number;
    condition: number;
    statsTimestamp?: number; // 오늘 0시 기준 타임스탬프 (능력치 고정용)
};

export type StageInfo = {
    id: string;
    name: string;
    description: string;
    level: SinglePlayerLevel;
    mode: GameMode;
    boardState: BoardState;
    player: Player;
    reward: {
        gold: number;
        diamonds: number;
    };
};

/** 싱글 베이스바둑: AI가 덤 입찰에서 제시할 색·덤 집. 미지정이면 흑/백 무작위 + 덤 5~20집 */
export type SinglePlayerAiBaseKomiBid = {
    color: 'black' | 'white' | 'random';
    komiMode: 'fixed' | 'random';
    /** komiMode=fixed일 때 입찰 덤 집(정수, 0~99) */
    komi?: number;
    /** komiMode=random일 때 포함 범위 하한 */
    komiMin?: number;
    /** komiMode=random일 때 포함 범위 상한 */
    komiMax?: number;
};

/** 관리자 스테이지 편집: 미지정·auto면 기존 필드(hiddenCount 등)로 룰 추론 */
export type SinglePlayerStrategicRulePreset =
    | 'auto'
    | 'classic'
    | 'capture'
    | 'survival'
    | 'speed'
    | 'base'
    | 'hidden'
    | 'missile'
    | 'mix';

export type SinglePlayerStageInfo = {
    id: string;
    name: string;
    description?: string;
    level: SinglePlayerLevel;
    actionPointCost: number;
    boardSize: 7 | 9 | 11 | 13;
    targetScore: { black: number; white: number; };
    placements: {
        black: number;
        white: number;
        blackPattern: number;
        whitePattern: number;
        centerBlackStoneChance?: number;
    };
    timeControl: {
        type: 'byoyomi' | 'fischer';
        mainTime: number; // minutes
        byoyomiTime?: number; // seconds
        byoyomiCount?: number;
        increment?: number; // seconds
    };
    rewards: {
        firstClear: { gold: number; exp: number; items?: { itemId: string; quantity: number }[]; bonus?: string };
        repeatClear: { gold: number; exp: number; items?: { itemId: string; quantity: number }[]; bonus?: string };
    };
    // 살리기 바둑 모드: AI(백)가 정해진 턴 동안 살아남기
    survivalTurns?: number; // AI(백)가 살아남아야 하는 턴 수 (백의 턴 수 제한)
    // 자동 계가 턴 수: 정해진 턴 수에 도달하면 자동으로 계가 진행
    autoScoringTurns?: number; // 총 턴 수 (유저+AI 합산)
    // 미사일바둑 모드: 미사일 아이템 개수
    missileCount?: number; // 미사일 아이템 개수
    // 히든바둑 모드: 히든/스캔 아이템 개수
    hiddenCount?: number; // 히든 아이템 개수
    scanCount?: number; // 스캔 아이템 개수
    /** AI 히든 연출(아이템 사용) 턴을 직접 지정 (AI의 n번째 턴 기준, 예: [2,5]) */
    aiHiddenItemTurns?: number[];
    /** AI 히든 연출을 n번째 AI 턴 이내에서 무작위 1회 사용 (aiHiddenItemTurns 미지정 시 사용) */
    aiHiddenItemUseWithinTurn?: number;
    /** AI 히든 연출을 몇 번 사용할지 지정. 직접 턴 목록이 있으면 목록 길이를 우선한다. */
    aiHiddenItemUseCount?: number;
    /** AI 히든 아이템 사용 시 착수할 좌표(순서대로 사용, 예: [{x:2,y:3}, {x:5,y:4}]) */
    aiHiddenItemPlacements?: Point[];
    /** true면 싱글 스테이지에서 AI 히든 아이템 사용(연출+실사용)을 비활성화 */
    disableAiHiddenItemUsage?: boolean;
    /** true면 강제 응수 규칙을 AI 히든 연출 턴에만 적용 */
    forceAiResponsesOnHiddenTurnsOnly?: boolean;
    // 흑(유저)의 턴 수 제한
    blackTurnLimit?: number; // 유저(흑)의 턴 수 제한
    // 베이스 바둑 모드: 베이스 돌 개수
    baseStones?: number;
    /** 베이스 싱글: AI 덤 입찰(흑/백·고정 또는 범위 랜덤 집). 없으면 서버 기본 랜덤 */
    singlePlayerAiBaseKomiBid?: SinglePlayerAiBaseKomiBid;
    /** 고정 초기 배치(좌표는 x,y / boardState[y][x]). */
    fixedOpening?: Array<{ x: number; y: number; color: 'black' | 'white'; kind?: 'plain' | 'pattern' }>;
    /** fixedOpening이 있어도 placements 랜덤을 baseBoard 위에 추가 적용 */
    mergeRandomPlacementsWithFixed?: boolean;
    /** false면 해당 싱글 스테이지에서 첫 수 전 배치변경 버튼/액션 사용 불가 */
    allowPlacementRefresh?: boolean;
    /** 싱글 스테이지별 KataServer 레벨 오버라이드(-31~9). 미지정 시 반(level) 기본값 사용 */
    kataServerLevel?: number;
    strategicRulePreset?: SinglePlayerStrategicRulePreset;
    /** strategicRulePreset이 mix일 때만 사용. 2~5개, 비어 있으면 서버 기본 믹스 조합 */
    mixedStrategicModes?: GameMode[];
    /** 싱글플레이 스테이지 전용: AI 응수를 강제하고 싶을 때 조건→착점 규칙을 순서대로 적용 */
    forcedAiResponses?: Array<{
        /** 이 좌표에 상대 돌(유저 돌)이 있을 때만 규칙 발동. 생략하면 항상 발동 */
        whenOpponentStoneAt?: Point;
        /** 규칙 발동 시 AI가 두려는 좌표 */
        move: Point;
    }>;
    /** true면 강제 규칙이 모두 불가능할 때 일반 Kata/합법수 폴백 대신 즉시 기권 처리 */
    strictForcedAiResponses?: boolean;
};


// --- Game ---
export type KomiBid = { color: Player; komi: number; };

export type AlkkagiStone = {
    id: number;
    player: Player;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    onBoard: boolean;
    timeOffBoard?: number;
};

export type GameSettings = {
  boardSize: 9 | 13 | 19 | 7 | 11 | 15;
  komi: number;
  timeLimit: number; // in minutes
  byoyomiTime: number; // in seconds
  byoyomiCount: number;
  pairGame?: {
    /** 대기 방이 속한 경기장 — 인게임 배경(페어 전용 이미지 vs 전략/놀이 CSS) 구분 */
    lobbyChannel?: 'pair' | 'strategic' | 'playful';
    roomId: string;
    pairMode: 'pvp' | 'ai';
    teamA: {
      name: string;
      members: Array<{ id: string; name: string; kind: 'user' | 'ai' | 'pet'; slot: string }>;
    };
    teamB: {
      name: string;
      members: Array<{ id: string; name: string; kind: 'user' | 'ai' | 'pet'; slot: string }>;
    };
    futurePetAi?: {
      enabled: boolean;
      source: 'future-pet-system';
      notes: string;
    };
    /** 페어바둑 인게임: 흑1→백1→흑2→백2 순환 좌석 */
    turnOrder?: import('../utils/pairGameTurn.js').PairGameTurnSeat[];
    /** `turnOrder`의 현재 인덱스 */
    currentTurnIndex?: number;
    /** 4명 모두 패스해야 계가. 착수 시 초기화 */
    passSeatIds?: import('../utils/pairGameTurn.js').PairGameTurnSeatId[];
    /** 순서 공개 모달 확인 상태(인간 참가자만) */
    orderRevealConfirmed?: Record<string, boolean>;
    orderSeededAt?: number;
    /** 펫/AI 좌석별 KATA 산출용 6코어 스냅샷 */
    petKataStatsByParticipantId?: Record<string, import('../constants/pairArena.js').PairPetCoreStatsSix>;
    /** 인게임 표시·가위바위보 — 좌석 participantId → 1가위 2바위 3보 */
    pairPetRpsAttributeByParticipantId?: Record<string, PairPetRpsAttribute>;
    /** 고정 KATA 레벨을 쓰는 AI 좌석(펫 페어 AI 대전 상대 등) */
    pairKataFixedLevelByParticipantId?: Record<string, number>;
    /** 페어 AI 대전 등: 합성 상대 펫 좌석에 보일 레벨(단계별 구간에서 굴림, 인게임·요약 UI용) */
    pairOpponentPetDisplayLevelByParticipantId?: Record<string, number>;
    /** 페어 대기방 방장 — 베이스돌·베이스 덤 입찰 등은 방장만 조작(듀오 손님 불가) */
    pairLobbyOwnerId?: string;
  };
  
  // Mode-specific settings
  captureTarget?: number;
  timeIncrement?: number; // Fischer
  baseStones?: number;
  hiddenStoneCount?: number;
  scanCount?: number;
  missileCount?: number;
  /** 캐슬 바둑: 중립 캐슬(장애물) 개수 1~3 */
  castleCount?: 1 | 2 | 3 | 4 | 5 | 6;
  /** 체스 바둑: AI/테스트 기본 100수 자동계가 (13×13) */
  chessScoringTurnLimit?: number;
  /** 체스 바둑: 기물 배치 총점수 예산 (9줄=9 고정, 13줄=9~23, 랭킹=15) */
  chessPieceTotalScore?: number;
  /** 싱글플레이 스테이지별 배치변경 허용 여부 */
  singlePlayerPlacementRefreshAllowed?: boolean;
  /** 싱글/탑 런타임: 살리기 모드 명시(스테이지와 불일치 방지) */
  isSurvivalMode?: boolean;
  /** 세션에 복사된 살리기 턴 한도(표시·로직용) */
  survivalTurns?: number;
  mixedModes?: GameMode[];
  autoScoring?: boolean;
  /** START_SINGLE_PLAYER_GAME 시 stage.forcedAiResponses를 runtime으로 복사해 AI 착수에서 사용 */
  singlePlayerForcedAiResponses?: Array<{
    whenOpponentStoneAt?: Point;
    move: Point;
  }>;
  singlePlayerStrictForcedAiResponses?: boolean;
  /** 싱글 스테이지 히든 연출 AI 턴 지정(직접 지정) */
  singlePlayerAiHiddenItemTurns?: number[];
  /** 싱글 스테이지 히든 연출 AI 턴 지정(무작위 상한) */
  singlePlayerAiHiddenItemUseWithinTurn?: number;
  /** 싱글 스테이지 히든 연출 사용 횟수 */
  singlePlayerAiHiddenItemUseCount?: number;
  /** 싱글 스테이지 AI 히든 아이템 착수 좌표(순서대로 사용) */
  singlePlayerAiHiddenItemPlacements?: Point[];
  /** true면 싱글 스테이지에서 AI 히든 아이템 사용(연출+실사용)을 비활성화 */
  singlePlayerDisableAiHiddenItemUsage?: boolean;
  /** true면 강제 응수 규칙을 히든 연출 턴에만 적용 */
  singlePlayerForceAiResponsesOnHiddenTurnsOnly?: boolean;
  /** 싱글 베이스: AI 덤 입찰(스테이지에서 복사). 없으면 흑백·덤 무작위 */
  singlePlayerAiBaseKomiBid?: SinglePlayerAiBaseKomiBid;
  
  // Omok settings
  has33Forbidden?: boolean;
  hasOverlineForbidden?: boolean;

  // Dice Go settings
  diceGoVariant?: DiceGoVariant;
  diceGoRounds?: 1 | 2 | 3;
  oddDiceCount?: number;
  evenDiceCount?: number;
  /** 1~3만 나오는 주사위 아이템 */
  lowDiceCount?: number;
  /** 4~6만 나오는 주사위 아이템 */
  highDiceCount?: number;
  diceGoItemCount?: number;

  /** 도둑과 경찰: 3~6만 나오는 주사위 아이템 */
  thiefHigh36ItemCount?: number;
  /** 도둑과 경찰: 2~5만 나오는 주사위(1 방지) 아이템 */
  thiefNoOneItemCount?: number;
  
  // Alkkagi settings
  alkkagiPlacementType?: AlkkagiPlacementType;
  alkkagiLayout?: AlkkagiLayoutType;
  alkkagiRounds?: 1 | 2 | 3;
  alkkagiStoneCount?: number;
  alkkagiGaugeSpeed?: number;
  alkkagiSlowItemCount?: number;
  alkkagiAimingLineItemCount?: number;
  alkkagiItemCount?: number;

  // Curling settings
  curlingStoneCount?: number;
  curlingGaugeSpeed?: number;
  curlingSlowItemCount?: number;
  curlingAimingLineItemCount?: number;
  curlingRounds?: 1 | 2 | 3;

  // AI Game settings
  player1Color?: Player.Black | Player.White; // For AI games, P1 is always the human
  aiDifficulty?: number; // 1-5 (싱글/탑)
  /** Gnugo AI 레벨 1~10 (전략바둑 AI 대국) */
  goAiBotLevel?: number;
  /** KataServer 레벨봇 레벨 (-31~9). 미설정 시 goAiBotLevel 사용 */
  kataServerLevel?: number;
  /** 전략바둑 대국 시 계가까지 턴 제한 (해당 턴 수가 되면 자동으로 KataGo 계가 진행). 0/미설정 시 제한 없음 */
  scoringTurnLimit?: number;
  /** 클라이언트 GnuGo 등으로 착수만 처리하는 AI 대국 */
  useClientSideAi?: boolean;
};

// --- Round Summaries ---
export type AlkkagiRoundSummary = {
    round: number;
    winnerId: string;
    loserId: string;
    refillsRemaining: { [playerId: string]: number };
};

/** 라운드별 기록 (결과 모달 표시용) */
export type AlkkagiRoundHistoryEntry = {
    round: number;
    winnerId: string;
    loserId: string;
    blackKnockout: number;
    whiteKnockout: number;
};

export type CurlingRoundSummary = {
    round: number;
    roundWinner?: Player | null; // Winner of the round
    black: { houseScore: number; knockoutScore: number; previousKnockoutScore?: number; total: number; };
    white: { houseScore: number; knockoutScore: number; previousKnockoutScore?: number; total: number; };
    cumulativeScores: { [key in Player]: number; };
    stonesState: AlkkagiStone[];
    scoredStones: { [stoneId: number]: number };
};

export type DiceRoundSummary = {
    round: number;
    scores: { [playerId: string]: number };
    /** 해당 라운드 종료 시 마지막 백(더미) 포획으로만 부여된 보너스(누적 점수에는 이미 반영됨) */
    lastDummyCaptureBonus?: { playerId: string; amount: number } | null;
    diceStats?: {
        [playerId: string]: {
            rolls: { [roll: number]: number };
            totalRolls: number;
        };
    };
};

export type ThiefRoundSummary = {
    round: number;
    isDeathmatch?: boolean;
    player1: { id: string; role: 'thief' | 'police'; roundScore: number; cumulativeScore: number; };
    player2: { id: string; role: 'thief' | 'police'; roundScore: number; cumulativeScore: number; };
    diceStats?: {
        [playerId: string]: {
            rolls: { [roll: number]: number };
            totalRolls: number;
        };
    };
};

export type ThiefRoundHistoryEntry = {
    round: number;
    player1: {
        id: string;
        role: 'thief' | 'police';
        escapedStones: number;
        capturedStones: number;
        roundScore: number;
        cumulativeScore: number;
    };
    player2: {
        id: string;
        role: 'thief' | 'police';
        escapedStones: number;
        capturedStones: number;
        roundScore: number;
        cumulativeScore: number;
    };
};

export type AnimationData =
  | { type: 'scan'; point: Point; success: boolean; startTime: number; duration: number; playerId: string; towerResumeScanning?: boolean }
  | { type: 'missile'; from: Point; to: Point; player: Player; startTime: number; duration: number }
  | { type: 'dice_roll_turn'; p1Roll: number; p2Roll: number; startTime: number; duration: number }
  | { type: 'dice_roll_main'; dice: { dice1: number, dice2: number, dice3: number }; startTime: number; duration: number }
  | { type: 'alkkagi_flick'; stoneId: number; vx: number; vy: number; startTime: number; duration: number }
  | { type: 'curling_flick'; stone: AlkkagiStone; velocity: Point; startTime: number; duration: number }
  | { type: 'hidden_reveal'; stones: { point: Point; player: Player }[]; startTime: number; duration: number }
  | { type: 'hidden_missile'; from: Point; to: Point; player: Player; startTime: number; duration: number }
  | { type: 'bonus_text'; text: string; point: Point; player: Player; startTime: number; duration: number }
  | { type: 'bonus_score'; playerId: string; bonus: number; startTime: number; duration: number }
  | {
        type: 'ai_thinking';
        startTime: number;
        duration: number;
        playerId: string;
        /** AI 히든 아이템 연출 중 새로고침 시 Kata 좌표 복원용(서버가 makeGoAiBotMove에서 사용) */
        pendingHiddenMove?: Point;
    };

// --- Analysis & Summary ---
export type RecommendedMove = {
  x: number;
  y: number;
  winrate: number;
  scoreLead: number;
  order: number;
};

export type AnalysisResult = {
  /** 분석/계가 결과 출처 (UI 표시 및 디버깅 용도) */
  source?: 'katago' | 'manual';
  /** KataGo가 느릴 때 임시(대체) 계가 결과 여부 */
  isProvisional?: boolean;
  winRateBlack: number;
  winRateChange?: number;
  scoreLead?: number;
  blackConfirmed: Point[];
  whiteConfirmed: Point[];
  blackRight: Point[];
  whiteRight: Point[];
  blackLikely: Point[];
  whiteLikely: Point[];
  deadStones: Point[];
  ownershipMap: number[][] | null;
  recommendedMoves: RecommendedMove[];
  areaScore: { black: number; white: number; };
  scoreDetails: {
    black: { territory: number; captures: number; liveCaptures?: number; deadStones?: number; baseStoneBonus: number; hiddenStoneBonus: number; timeBonus: number; itemBonus: number; total: number; };
    white: { territory: number; captures: number; liveCaptures?: number; deadStones?: number; komi: number; baseStoneBonus: number; hiddenStoneBonus: number; timeBonus: number; itemBonus: number; total: number; };
  };
};

export type StatChange = {
  initial: number;
  change: number;
  final: number;
};

export type GameSummary = {
  xp: StatChange;
  rating: StatChange;
  manner: StatChange;
  mannerActionChange?: number;
  mannerGrade?: { initial: string; final: string; };
  actionPoints?: StatChange;
  level?: {
      initial: number;
      final: number;
      progress: { initial: number; final: number; max: number };
  };
  overallRecord?: { wins: number; losses: number; aiWins?: number; aiLosses?: number; };
  gold?: number;
  /** 경기 자체 정산 골드( VIP 슬롯 골드 제외 ) */
  matchGold?: number;
  /** 결과 모달 광고 시청으로 추가 지급된 경기 골드 */
  adGoldBonus?: number;
  /** 결과 모달 광고 골드 2배 보상을 이미 수령했는지 */
  adGoldDoubled?: boolean;
  /** 페어바둑 장착 펫 경험치 변화 */
  pairPetXp?: StatChange;
  /** 페어바둑 장착 펫 레벨·경험치 진행 변화 */
  pairPetLevel?: {
      initial: number;
      final: number;
      progress: {
          initial: number;
          final: number;
          max: number;
      };
  };
  /** 페어 대국 등으로 이번에만 추가된 펫 6코어 레벨업 보너스 */
  pairPetLevelUpCoreBonuses?: Partial<Record<CoreStat, number>>;
  /** VIP 슬롯에서 추가 지급된 골드 */
  vipGoldBonus?: number;
  diamonds?: number;
  /** 모험 지역 이해도 효과로만 추가된 골드(표시용; `gold` 합계에 이미 포함) */
  adventureGoldUnderstandingBonus?: number;
  items?: InventoryItem[];
  /** 길드 전쟁 AI 대국 종료 시 획득 별(0~3) */
  guildWarStars?: number;
  /** 모험 몬스터 승리 시 슬롯 결과(연출용; 실제 지급은 gold·items와 동일) */
  adventureRewardSlots?: {
    gold: { obtained: boolean; amount: number; understandingBonus?: number };
    keyFragment?: { obtained: boolean; amount: number };
    equipment: { obtained: boolean; displayName?: string; grade?: ItemGrade };
    material: { obtained: boolean; displayName?: string; quantity?: number };
  };
  /** 모험 승리 직후 도감 이해도(결과 모달 변화도 연출) */
  adventureCodexDelta?: {
    codexId: string;
    winsBefore: number;
    winsAfter: number;
  };
  /** 모험 승리 직후 지역 탐험도(지역 이해도) 변화 */
  adventureUnderstandingDelta?: {
    stageId: string;
    xpBefore: number;
    xpAfter: number;
  };
  /** 전략/놀이/모험·길드 전쟁 AI 대국 등: 항상 표시되는 VIP 보상 슬롯(잠금 또는 지급 아이템) */
  vipPlayRewardSlot?: {
    locked: boolean;
    grantedItem?: { name: string; quantity: number; image?: string };
  };
};


// --- Chess Go ---
export type ChessPieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

export type ChessSetupDraftPiece = {
  type: ChessPieceType;
  x: number;
  y: number;
};

export type ChessPieceState = {
  id: string;
  type: ChessPieceType;
  owner: Player.Black | Player.White;
  x: number;
  y: number;
  /** 게임 시작 시 배치 좌표 — 폰 2칸 초행 판정용 */
  startX: number;
  startY: number;
  remainingMoves: number;
};

/** 체스 바둑: 직전 기물 이동(from→to) — 상대방 마지막 수 표시용 */
export type ChessLastMoveMarker = {
  from: Point;
  to: Point;
  player: Player.Black | Player.White;
};

// --- Core Entities ---
export type LiveGameSession = {
  id: string;
  mode: GameMode;
  settings: GameSettings;
  description?: string;
  player1: User;
  player2: User;
  blackPlayerId: string | null;
  whitePlayerId: string | null;
  /**
   * 베이스 바둑 배치 단계 임시 좌석:
   * - `base_placement` ~ `base_*_*` 사전 단계에서만 의미 있다.
   * - 색이 확정되어 본대국 좌석(`blackPlayerId`/`whitePlayerId`)이 정해지면 즉시 비운다.
   * - 본대국(`playing`) 이후에는 절대로 읽지 말 것 — `blackPlayerId`/`whitePlayerId`만 진실원이다.
   */
  basePlacementBlackPlayerId?: string | null;
  basePlacementWhitePlayerId?: string | null;
  /** 베이스(순·믹스) 본대국 `playing` 최초 진입 시 고정된 흑/백 좌석 — 재동기화·슬림 WS에서 임시 배치 좌석이 덮어쓰지 않도록 함 */
  playingLockedBlackPlayerId?: string | null;
  playingLockedWhitePlayerId?: string | null;
  gameStatus: GameStatus;
  currentPlayer: Player;
  boardState: BoardState;
  moveHistory: Move[];
  serverRevision?: number;
  lastSyncedAt?: number;
  captures: { [key in Player]: number };
  baseStoneCaptures: { [key in Player]: number };
  hiddenStoneCaptures: { [key in Player]: number };
  winner: Player | null;
  winReason: WinReason | null;
  finalScores?: { black: number, white: number };
  createdAt: number;
  startTime?: number;
  endTime?: number;
  lastMove: Point | null;
  lastTurnStones?: Point[] | null;
  stonesPlacedThisTurn?: Point[] | null;
  passCount: number;
  koInfo: { point: Point; turn: number } | null;
  winningLine?: Point[] | null;
  statsUpdated?: boolean;
  summary?: { [playerId: string]: GameSummary };
  resultContract?: UnifiedResultContract;
  animation?: AnimationData | null;
  blackTimeLeft: number;
  whiteTimeLeft: number;
  blackByoyomiPeriodsLeft: number;
  whiteByoyomiPeriodsLeft: number;
  /** 스피드바둑 PVP 계가용: 게임 시작 시 각 플레이어의 기본 시간(초) */
  blackInitialTimeLeft?: number;
  whiteInitialTimeLeft?: number;
  turnDeadline?: number;
  turnStartTime?: number;
  nigiriStartTime?: number;
  canRequestNoContest?: { [playerId: string]: boolean };
  pausedTurnTimeLeft?: number;
  itemUseDeadline?: number;
  lastTimeoutPlayerId?: string | null;
  lastTimeoutPlayerIdClearTime?: number;
  revealAnimationEndTime?: number;
  revealEndTime?: number;
  /** 일색 바둑: 보드에 표시할 단일 돌 색(실제 흑/백 규칙과 별개) */
  uniformStoneDisplayColor?: Player;
  disconnectionState?: { disconnectedPlayerId: string; timerStartedAt: number; } | null;
  disconnectionCounts: { [playerId: string]: number; };
  aiHiddenItemUsed?: boolean;
  aiHiddenItemTurn?: number;
  aiHiddenItemTurns?: number[];
  aiHiddenItemsUsedCount?: number;
  aiHiddenItemAnimationEndTime?: number;
  /** 싱글·탑 PVE: 마지막 AI 수 직후 착수 애니 후 이 시각에 도달하면 계가 시작 */
  pendingAutoScoringKickoffAt?: number;
  noContestInitiatorIds?: string[];
  /** 전략 PVP: 10수 미만 규정에 따른 무효 대국(기보 저장 제외 등에 사용) */
  shortGameNoContest?: boolean;
  currentActionButtons: { [playerId: string]: any[] }; // ActionButton
  actionButtonCooldownDeadline?: { [playerId: string]: number | undefined };
  actionButtonUses?: { [playerId: string]: number };
  maxActionButtonUses?: number;
  actionButtonUsedThisCycle?: { [playerId: string]: boolean };
  mannerScoreChanges?: { [playerId: string]: number };
  nigiri?: { holderId: string; guesserId: string; stones: number | null; guess: 1 | 2 | null; result: 'correct' | 'incorrect' | null; processed?: boolean; purpose?: 'determine_colors' | 'turn_choice_tiebreaker'; };
  guessDeadline?: number;
  bids?: { [userId: string]: number | null };
  biddingRound?: number;
  /** 베이스+따내기: 1차 입찰이 동점일 때 2차 재제시 동안 전광판·하단에 1차 점수 유지 (키=player1/player2 좌석 id) */
  captureFirstRoundTieBidSnapshot?: { [seatPlayerId: string]: number };
  captureBidDeadline?: number;
  effectiveCaptureTargets?: { [key in Player]: number };
  baseStones?: { x: number; y: number; player: Player; }[];
  baseStones_p1?: Point[];
  baseStones_p2?: Point[];
  /** 캐슬 바둑: 게임 시작 시 고정된 중립 캐슬 좌표 */
  castleStonePoints?: Point[];
  /** 캐슬 바둑: 확정 영토 `"x,y"` → 소유 색 */
  confirmedTerritoryOwnerByPoint?: Record<string, Player.Black | Player.White>;
  /** 체스 바둑: 기물 상태 */
  chessPieces?: ChessPieceState[];
  /** 체스 바둑: 기물 포획 보너스 점수 */
  chessCaptureScore?: { [key in Player]: number };
  /** 체스 바둑: 이번 턴에 기물을 이미 이동했는지 */
  chessPieceMovedThisTurn?: boolean;
  /** 체스 바둑: 직전 기물 이동(from→to). 바둑 착수 후에도 유지되어 상대 마지막 기물 수 표시에 사용 */
  lastChessMove?: ChessLastMoveMarker | null;
  /** 체스 바둑: moveHistory에는 남지만 보드에서 제거된 교차점(따내기) */
  chessGoRemovedPoints?: Point[];
  /** 체스 바둑: 기물 배치 단계 draft (userId → 배치 기물, king 제외) */
  chessPiecePlacementDraft?: Record<string, ChessSetupDraftPiece[]>;
  /** 체스 바둑: 기물 배치 완료 여부 */
  chessPiecePlacementReady?: Record<string, boolean>;
  /** 체스 바둑: PVP 배치 제한 시간 (PVE는 undefined) */
  chessPiecePlacementDeadline?: number;
  basePlacementDeadline?: number;
  /** 베이스돌 배치: 각 참가자가 배치 완료 버튼을 눌렀는지 (돌 개수 충족 후) */
  basePlacementReady?: { [userId: string]: boolean };
  baseStoneColorChoices?: { [userId: string]: Player | null };
  baseColorChoiceDeadline?: number;
  baseSameColorTieColor?: Player;
  komiBids?: { [userId: string]: KomiBid | null };
  komiBiddingDeadline?: number;
  komiBiddingRound?: number;
  komiBidRevealProcessed?: boolean;
  finalKomi?: number;
  /** 베이스 덤: 확정 직전 입찰(색·추가 덤 집). komiBids 정리 후에도 결과 모달에서 표시 */
  baseKomiBidsSnapshot?: { [userId: string]: KomiBid };
  hiddenMoves?: { [moveIndex: number]: boolean };
  /** PVE 클라 전용 진행에서 hiddenMoves 인덱스가 밀려도 유저 히든 좌표를 안정적으로 보존 */
  humanHiddenStonePoints?: Array<Point & { player?: Player }>;
  /** PVE: AI 히든 착수 좌표(서버 AI 수·hiddenMoves 슬림 패킷 누락 시 포획 공개 연출 복구) */
  aiHiddenStonePoints?: Array<Point & { player?: Player }>;
  scans_p1?: number;
  scans_p2?: number;
  hidden_stones_p1?: number;
  hidden_stones_p2?: number;
  revealedHiddenMoves?: { [playerId: string]: number[] };
  newlyRevealed?: { point: Point, player: Player }[];
  justCaptured?: {
    point: Point;
    player: Player;
    wasHidden: boolean;
    capturePoints?: number;
    /** 베이스 배치돌 따내기(+5). capturePoints 누락 시 플로트 표시용 */
    wasBaseStone?: boolean;
    capturerId?: string;
  }[];
  hidden_stones_used_p1?: number;
  hidden_stones_used_p2?: number;
  /** hidden_placing/scanning/missile_selecting 진입 시점의 색(흑/백). 타임아웃·소비 시 currentPlayer 스왑 레이스 방지 */
  itemPhaseActingPlayer?: Player;
  pendingCapture?: { stones: Point[]; move: Move; hiddenContributors: Point[]; capturedHiddenStones?: Point[] } | null;
  permanentlyRevealedStones?: Point[];
  processingMove?: { playerId: string; x: number; y: number; timestamp: number } | null; // 동시성 제어를 위한 처리 중인 수
  missiles_p1?: number;
  missiles_p2?: number;
  missileUsedThisTurn?: boolean;
  rpsState?: { [userId:string]: RPSChoice | null };
  rpsRound?: number;
  dice?: { dice1: number, dice2: number, dice3: number };
  stonesToPlace?: number;
  /** 주사위 바둑: 인간이 착수를 마친 뒤 턴 넘김 전 대기(타임스탬프 ms). 이전까지는 dice_placing 유지 */
  dicePlacingSettleUntil?: number;
  turnOrderRolls?: { [userId: string]: number | null };
  turnOrderRollReady?: { [userId: string]: boolean };
  turnOrderRollResult?: 'tie' | null;
  turnOrderRollTies?: number;
  turnOrderRollDeadline?: number;
  turnOrderAnimationEndTime?: number;
  turnChoiceDeadline?: number;
  turnChooserId?: string | null;
  turnChoices?: { [userId: string]: 'first' | 'second' | null };
  turnSelectionTiebreaker?: 'rps' | 'nigiri' | 'dice_roll';
  diceRollHistory?: { [playerId: string]: number[] };
  diceRoundSummary?: DiceRoundSummary;
  lastWhiteGroupInfo?: { size: number; liberties: number } | null;
  diceGoOvershotTicker?: { maxDice: number; lastCaptureBonus: number } | null;
  gameStartTime?: number; // 게임 시작 시간 (초기화 시점)
  isEarlyTermination?: boolean; // 조기 종료 여부
  badMannerPlayerId?: string; // 비매너 행동자 ID
  isRankedGame?: boolean; // true면 랭킹전, false면 친선전 (기본값: false)
  diceGoItemUses?: { [playerId: string]: { odd: number; even: number; low: number; high: number } };
  diceGoBonuses?: { [playerId: string]: number };
  diceCapturesThisTurn?: number;
  diceLastCaptureStones?: Point[];
  round: number;
  isDeathmatch?: boolean;
  turnInRound: number;
  scores: { [userId: string]: number };
  thiefPlayerId?: string;
  policePlayerId?: string;
  roleChoices?: { [userId: string]: 'thief' | 'police' | null };
  roleChoiceWinnerId?: string | null;
  thiefRoundSummary?: ThiefRoundSummary;
  thiefRoundHistory?: ThiefRoundHistoryEntry[];
  thiefDiceRollHistory?: { [playerId: string]: number[] };
  thiefCapturesThisRound?: number;
  /** 도둑 착수 턴 시작 시 판에 흑(도둑)이 없었으면 true — 한 턴 동안 주사위 개수만큼 어디에나 놓을 수 있음 */
  thiefFreestyleThiefPlacing?: boolean;
  thiefGoItemUses?: { [playerId: string]: { high36: number; noOne: number } };
  alkkagiStones?: AlkkagiStone[];
  alkkagiStones_p1?: AlkkagiStone[];
  alkkagiStones_p2?: AlkkagiStone[];
  alkkagiTurnDeadline?: number;
  alkkagiPlacementDeadline?: number;
  alkkagiItemUses?: { [playerId: string]: { slow: number; aimingLine: number } };
  activeAlkkagiItems?: { [playerId: string]: ('slow' | 'aimingLine')[] };
  alkkagiRound?: number;
  alkkagiRefillsUsed?: { [playerId: string]: number };
  /** 알까기 배치 페이즈 전용: 이번 배치에서 새로 둔 돌 수(이전 라운드에서 남은 판 위 돌은 제외). */
  alkkagiStonesPlacedThisRound?: { [playerId: string]: number };
  alkkagiRoundSummary?: AlkkagiRoundSummary;
  alkkagiRoundHistory?: AlkkagiRoundHistoryEntry[];
  curlingStones?: AlkkagiStone[];
  curlingTurnDeadline?: number;
  curlingScores?: { [key in Player]: number };
  curlingRound?: number;
  curlingRoundSummary?: CurlingRoundSummary;
  curlingItemUses?: { [playerId: string]: { slow: number; aimingLine: number } };
  activeCurlingItems?: { [playerId: string]: ('slow' | 'aimingLine')[] };
  hammerPlayerId?: string; // Player with last stone advantage
  isTiebreaker?: boolean;
  tiebreakerStonesThrown?: number;
  /** 바둑 컬링: 최종 라운드 동점 후 승부치기(같은 보드) — 스냅 기준으로 하우스·넉아웃 변화 반영 */
  curlingTiebreakerSnap?: {
    scoreBlack: number;
    scoreWhite: number;
    houseBlack: number;
    houseWhite: number;
    koBlack: number;
    koWhite: number;
  };
  stonesThrownThisRound?: { [playerId: string]: number };
  preGameConfirmations?: { [playerId: string]: boolean | number };
  roundEndConfirmations?: { [playerId: string]: number };
  rematchRejectionCount?: { [playerId: string]: number };
  timeoutFouls?: { [playerId: string]: number };
  curlingStonesLostToFoul?: { [playerId: string]: number };
  foulInfo?: { message: string; expiry: number; } | null;
  isAnalyzing?: boolean;
  analysisResult?: { [playerId: string]: AnalysisResult } | null;
  previousAnalysisResult?: { [playerId: string]: AnalysisResult } | null;
  isAiGame?: boolean;
  aiTurnStartTime?: number;
  mythicBonuses?: {
    [playerId: string]: {
        strategicGoldTriggers: number;
        playfulGoldTriggers: number;
    }
  };
  lastPlayfulGoldCheck?: {
      [playerId: string]: number;
  };
  pendingSystemMessages?: ChatMessage[];
  isSinglePlayer?: boolean;  // Deprecated: Use gameCategory instead
  gameCategory?: GameCategory;  // 게임 카테고리: normal, singleplayer, tower, adventure
  /** 모험 스테이지 id — 배경 webp 매핑용 */
  adventureStageId?: string;
  adventureMonsterCodexId?: string;
  adventureMonsterLevel?: number;
  adventureMonsterBattleMode?: string;
  adventureBoardSize?: number;
  /** 모험: 경기 시작(CONFIRM) 후 전체 제한 시각(epoch ms) — 초과 시 몬스터 도주 패배 */
  adventureEncounterDeadlineMs?: number;
  adventureEncounterDurationMultiplier?: number;
  adventureRegionalHumanFlatScoreBonus?: number;
  stageId?: string;
  /** 싱글: 서버가 적용한 최신 스테이지(KV). 두루마리·모드 표시에 번들 상수보다 우선 */
  singlePlayerStageDisplay?: SinglePlayerStageInfo;
  towerFloor?: number;  // 도전의 탑 층수
  /** 이번 탑 대국 입장 시 차감된 행동력(재도전 라벨·장비 할인 반영·클라 towerFloor stale 보정) */
  towerStartActionPointCost?: number;
  blackPatternStones?: Point[];
  whitePatternStones?: Point[];
  /** 특수(문양·베이스·히든) 돌이 따인 교차점(1회 소모). 같은 대국에서 해당 좌표는 일반 돌로만 표시 */
  consumedPatternIntersections?: Point[];
  whiteTurnsPlayed?: number; // 살리기 바둑 모드: 백(AI)이 둔 턴 수
  /** 싱글 따내기: 턴 제한 실패 대기 상태에서 UI 0/N 고정용 남은 턴 스냅샷 */
  blackTurnLimitRemaining?: number;
  singlePlayerPlacementRefreshesUsed?: number;
  /** 이번 대국 입장 시 차감된 행동력(재도전 라벨·클라 stale 보정용). 0이면 재도전도 무료로 표시 */
  singlePlayerStartActionPointCost?: number;
  /** 인게임(`playing`) 진입 시 행동력 차감 완료 여부 */
  actionPointsChargedAtStart?: boolean;
  /** PVE 승리 정산 시 행동력 차감 완료 여부 (학원·탑) */
  actionPointsChargedOnVictory?: boolean;
  totalTurns?: number; // 총 턴 수 (유저 + AI 합산), 자동 계가 트리거용
  /** 페어 휴먼 PVP: 팀원 기권 동의 대기(요청자·응답자·턴 키) */
  pairTeamResignRequest?: {
      requesterUserId: string;
      partnerUserId: string;
      resigningTeamId: 'teamA' | 'teamB';
      turnKey: string;
  };
  /** 페어 휴먼 PVP: 해당 턴 키에서 팀원이 기권 요청을 거절한 팀 — 같은 턴에 재요청 불가 */
  pairTeamResignCooldownByTeam?: Partial<Record<'teamA' | 'teamB', string>>;
};

export type Negotiation = {
  id: string;
  challenger: User;
  opponent: User;
  mode: GameMode;
  settings: GameSettings;
  proposerId: string;
  status: 'draft' | 'pending';
  turnCount?: number;
  deadline: number;
  rematchOfGameId?: string;
  previousSettings?: GameSettings;
  isRanked?: boolean; // false면 친선전, true면 랭킹전 (기본값: false)
  /**
   * 페어 국: `initializeGame`에서 전략 초기화보다 먼저 RPS·6코어 스냅샷을 넣기 위한 참가 유저(장착 펫 메타).
   * `pairPetConfigureOwnerId`는 `ownerPet` 슬롯 귀속에 사용(기본: challenger).
   */
  pairPetStatUsers?: User[];
  pairPetConfigureOwnerId?: string;
  /** `initializeGame`에서 LiveGameSession 모험 필드로 복사 */
  adventureBattle?: {
    stageId: string;
    codexId: string;
    level: number;
    battleMode: string;
    boardSize: number;
  };
};

export type SanctionLogData = {
    sanctionType: 'chat' | 'connection';
    durationMinutes?: number;
    reason?: string;
    reasonDetail?: string;
};

export type AdminLog = {
  id: string;
  timestamp: number;
  adminId: string;
  adminNickname: string;
  targetUserId: string;
  targetNickname: string;
  action:
    | 'reset_stats'
    | 'reset_full'
    | 'delete_user'
    | 'force_logout'
    | 'force_delete_game'
    | 'send_mail'
    | 'set_game_description'
    | 'update_user_details'
    | 'apply_sanction'
    | 'lift_sanction'
    | 'force_win'
    | 'reset_tournament_session'
    | 'reset_dungeon_progress'
    | 'reset_championship_all'
    | 'reset_strategic_ranking_all'
    | 'reset_ranked_match_stats_all'
    | 'clear_user_guild'
    | 'guild_war_recharge_daily_attempts'
    | 'create_home_board_post'
    | 'update_home_board_post'
    | 'delete_home_board_post'
    | 'update_user_inventory'
    | 'append_inventory_items'
    | 'update_reward_config'
    | 'set_maintenance_mode'
    | 'grant_vip_duration';
  backupData:
    | Partial<User>
    | { status: UserStatusInfo }
    | LiveGameSession
    | { mailTitle: string }
    | SanctionLogData
    | { gameId: string; winnerId: string }
    | { postId: string; title: string }
    | { oldGuildId: string | undefined }
    | { before: Record<string, number>; after: Record<string, number> }
    | { maintenanceEnabled: boolean; kickAllUsers: boolean; message: string }
    | {
          scope: 'single' | 'all';
          durationDays: number;
          grantRewardVip: boolean;
          grantFunctionVip: boolean;
          grantVvip: boolean;
          before?: { rewardVipExpiresAt: number; functionVipExpiresAt: number; vvipExpiresAt: number };
          affectedCount?: number;
          failureCount?: number;
          totalUsers?: number;
      };
};

export type Announcement = {
    id: string;
    message: string;
};

export type OverrideAnnouncement = {
    message: string;
    modes: GameMode[] | 'all';
};

export type HomeBoardPost = {
    id: string;
    title: string;
    content: string;
    authorId: string;
    isPinned: boolean;
    createdAt: number;
    updatedAt: number;
};

export type ActionButton = {
  name: string;
  message: string;
  type: 'manner' | 'unmannerly';
};

// --- Guild Types ---
export type Guild = {
  id: string;
  name: string;
  leaderId: string;
  description?: string;
  emblem?: string;
  icon?: string;
  settings?: any;
  gold: number;
  level: number;
  experience: number;
  xp?: number; // alias for experience
  researchPoints?: number;
  research?: Record<string, { level: number }>;
  researchTask?: { researchId: string; startedAt: number; completedAt: number; completionTime?: number } | null;
  members?: GuildMember[];
  memberLimit?: number;
  isPublic?: boolean;
  joinType?: 'application' | 'free'; // 'application': 신청가입 (승인 필요), 'free': 자유가입 (자동 가입)
  announcement?: string;
  chatHistory?: GuildMessage[];
  checkIns?: Record<string, number>;
  /** 출석 마일스톤 일일 수령 기록 (claimedKstDay: YYYY-MM-DD KST, 생략 시 레거시) */
  dailyCheckInRewardsClaimed?: Array<{ userId: string; milestoneIndex: number; claimedKstDay?: string }>;
  donationLog?: Array<{ userId: string; nickname: string; type: 'gold' | 'diamond'; count: number; coins: number; research: number; timestamp: number }>;
  guildBossState?: {
    bossId: string;
    hp: number;
    maxHp: number;
    defeatedAt?: number;
    lastResetAt: number;
    currentBossId?: string;
    currentBossHp?: number;
    /** 현재 출현 보스 난이도 단계 (1~10) */
    currentBossStage?: number;
    /** 보스 id별 누적 난이도 (다음 출현 시 적용) */
    bossStageByBossId?: Record<string, number>;
    totalDamageLog?: Record<string, number>;
    maxDamageLog?: Record<string, number>;
  } | null;
  weeklyMissions?: GuildMission[];
  lastMissionReset?: number;
  /** KST 주간(월요일 시작) 길드 채팅 마지막 초기화 시각 */
  lastGuildChatWeekResetMs?: number;
  /** 주간 기부·미션 등 주간 리셋 기준 시각 */
  lastWeeklyContributionReset?: number;
  applicants?: Array<{ userId: string; appliedAt: number }>;
  recruitmentBanUntil?: number;
  createdAt: number;
  updatedAt: number;
};

export type GuildMember = {
  id: string;
  guildId: string;
  userId: string;
  nickname?: string;
  role: 'leader' | 'officer' | 'member';
  joinDate: number;
  contributionTotal: number;
  weeklyContribution?: number;
  lastLoginAt?: number; // 최근 접속 시각 (길드원 목록 표시용)
  createdAt: number;
  updatedAt: number;
};

export type GuildMessage = {
  id: string;
  guildId: string;
  authorId: string;
  content: string;
  createdAt: number;
  user?: { id: string; nickname: string };
  system?: boolean;
  timestamp?: number;
  text?: string;
  i18nKey?: string;
  i18nParams?: Record<string, string | number | boolean | undefined>;
};

export type GuildMission = {
  id: string;
  guildId: string;
  missionType: string;
  status: 'active' | 'completed' | 'expired';
  /** 미션 목표 달성 여부(레거시). 없으면 `status === 'completed'`로 판별 */
  isCompleted?: boolean;
  title?: string;
  description?: string;
  target?: number;
  progress?: any;
  progressKey?: string;
  personalReward?: { guildCoins?: number };
  guildReward?: { guildXp?: number };
  /** 완료 시 계산된 길드 XP(미수령). 수령 시 길드에 반영 후 제거. 레거시 미션에는 없음(완료 시 이미 길드 XP 반영됨). */
  guildXpPending?: number;
  claimedBy?: string[];
  resetAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type GuildShop = {
  id: string;
  guildId: string;
  itemTemplateId: string;
  price: number;
  stock: number; // -1 means unlimited
  purchasedBy?: string[];
  createdAt: number;
  updatedAt: number;
};

export type GuildDonation = {
  id: string;
  guildId: string;
  userId: string;
  amount: number;
  itemId?: string;
  createdAt: number;
};

export type GuildWar = {
  id: string;
  guild1Id: string;
  guild2Id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  result?: {
    winnerId: string;
    guild1Score: number;
    guild2Score: number;
  };
  createdAt: number;
  updatedAt: number;
  /** 9칸 보드별 진행 상태 (서버/KV) */
  boards?: Record<string, unknown>;
  userAttempts?: Record<string, number>;
};

// --- Guild Research & Boss Types ---
export enum GuildResearchCategory {
    development = 'development',
    boss = 'boss',
    stats = 'stats',
    rewards = 'rewards',
}

export interface GuildResearchProject {
    image: string;
    category: GuildResearchCategory;
    name: string;
    description: string;
    maxLevel: number;
    baseCost: number;
    costMultiplier: number;
    baseEffect: number;
    effectUnit: '%' | '점' | '명' | '초';
    baseTimeHours: number;
    timeIncrementHours: number;
    requiredGuildLevel: number[];
}

export interface GuildBossSkillEffect {
    type: 'damage' | 'hp_percent' | 'heal' | 'debuff';
    value?: [number, number];
    hits?: number;
    debuffType?: 'user_combat_power_reduction_percent' | 'user_heal_reduction_percent';
    debuffValue?: [number, number];
    debuffDuration?: number;
}

export interface GuildBossSkillSubEffect extends GuildBossSkillEffect {}

export interface GuildBossSkill {
    id: string;
    name: string;
    description: string;
    type: 'active' | 'passive';
    image: string;
}

export interface GuildBossActiveSkill extends GuildBossSkill {
    type: 'active';
    checkStat: CoreStat | CoreStat[];
    onSuccess: GuildBossSkillEffect[];
    onFailure: GuildBossSkillEffect[];
}

export interface GuildBossPassiveSkill extends GuildBossSkill {
    type: 'passive';
    passiveTrigger: 'always' | 'every_turn' | 'on_user_heal';
    checkStat?: CoreStat;
    passiveEffect: GuildBossSkillSubEffect[];
    passiveChance?: number;
}

export interface GuildBossInfo {
    id: string;
    name: string;
    description: string;
    image: string;
    maxHp: number;
    hp: number;
    stats: Record<CoreStat, number>;
    skills: (GuildBossActiveSkill | GuildBossPassiveSkill)[];
    strategyGuide: string;
    recommendedStats: CoreStat[];
    recommendedResearch: GuildResearchId[];
}

export type GuildWarMatch = {
  id: string;
  warId: string;
  player1Id: string;
  player2Id: string;
  result?: {
    winnerId: string;
    gameId: string;
  };
  gameId?: string;
  createdAt: number;
  updatedAt: number;
};

export type BattleLogEntry = {
    turn: number;
    icon?: string;
    message: string;
    isUserAction: boolean;
    bossHealingDone?: number;
    damageTaken?: number;
    healingDone?: number;
    debuffsApplied?: string[];
    isCrit?: boolean;
};

export type GuildBossBattleResult = {
    damageDealt: number;
    turnsSurvived: number;
    /** 길드 보스 전투 결과에 항상 포함되는 VIP 슬롯 표시용 */
    vipPlayRewardSlot?: {
        locked: boolean;
        grantedItem?: { name: string; quantity: number; image?: string };
    };
    rewards: {
        tier: number;
        guildXp: number;
        guildCoins: number;
        researchPoints: number;
        gold: number;
        materials: { name: string; quantity: number };
        materialsBonus?: { name: string; quantity: number };
        tickets: { name: string; quantity: number }[];
        equipment?: { grade: ItemGrade };
        materialBox?: { name: string; quantity: number };
    };
    battleLog: BattleLogEntry[];
    bossHpBefore: number;
    bossHpAfter: number;
    bossMaxHp: number;
    userHp: number;
    maxUserHp: number;
};

export interface MannerEffects {
    maxActionPoints: number;
    actionPointRegenInterval: number;
    goldBonusPercent: number;
    itemDropRateBonus: number;
    mannerActionButtonBonus: number;
    rewardMultiplier: number;
    enhancementSuccessRateBonus: number;
}
