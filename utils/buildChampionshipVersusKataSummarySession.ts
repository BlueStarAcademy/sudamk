import type {
    AnalysisResult,
    GameSummary,
    InventoryItem,
    LiveGameSession,
    Match,
    PlayerForTournament,
    User,
    UserWithStatus,
} from '../types.js';
import type { ChampionshipVersusVenueKind } from '../shared/types/entities.js';
import { DEFAULT_GAME_SETTINGS } from '../constants/gameSettings.js';
import { GameCategory, GameMode, ItemGrade, Player } from '../types/enums.js';
import { getXpRequirementForLevel } from '../shared/utils/strategyLevelXp.js';
import { levelAndBarFromTotalAccumulatedXp, totalAccumulatedXpFromLevelAndBar } from '../shared/utils/userLevelMerge.js';

export type VersusKataActorRewardClientPayload = {
    goldDelta: number;
    userXpDelta: number;
    goldBefore: number;
    userXpBefore: number;
    /** 계가 직전 계정 레벨(대국 결과 XP 바 표시용) — 구 서버 응답에는 없을 수 있음 */
    userLevelBefore?: number;
    /** XP 반영 후 계정 레벨 */
    userLevelAfter?: number;
    /** XP 반영 후 현재 레벨 구간 바 값 */
    userXpAfter?: number;
    /** 보상 VIP 슬롯에서 추가된 골드(있을 때만) */
    vipGoldBonus?: number;
    pairPetXp?: GameSummary['pairPetXp'];
    pairPetLevel?: GameSummary['pairPetLevel'];
    overallRecord: { wins: number; losses: number };
    vipPlayRewardSlot: NonNullable<GameSummary['vipPlayRewardSlot']>;
};

function seatUserFromTournament(template: UserWithStatus, seat: PlayerForTournament): User {
    return {
        ...template,
        id: seat.id,
        nickname: seat.nickname,
        avatarId: seat.avatarId,
        borderId: seat.borderId,
        league: seat.league,
    } as User;
}

function mapWinnerEnum(match: Match): Player | null {
    const rg = match.championshipRealGame;
    if (!rg?.winnerId) return null;
    if (rg.winnerId === rg.blackPlayerId) return Player.Black;
    if (rg.winnerId === rg.whitePlayerId) return Player.White;
    return null;
}

function syntheticRewardItem(partial: Pick<InventoryItem, 'id' | 'name' | 'image' | 'quantity'>): InventoryItem {
    const now = Date.now();
    return {
        id: partial.id,
        name: partial.name,
        description: partial.name,
        type: 'consumable',
        slot: null,
        quantity: partial.quantity ?? 1,
        level: 1,
        isEquipped: false,
        createdAt: now,
        image: partial.image,
        grade: ItemGrade.Normal,
        stars: 0,
    };
}

/**
 * 챔피언십 장내 카타 대국 종료 후 `GameSummaryModal`에 넘길 최소 `LiveGameSession` 스텁.
 * (싱글/탑/모험 등과 동일 결과 UI — 계가·집 계산은 `analysis` 기준)
 */
export function buildChampionshipVersusKataSummarySession(params: {
    match: Match;
    analysis: AnalysisResult;
    currentUser: UserWithStatus;
    venue: ChampionshipVersusVenueKind;
    actorVenueRatingBefore: number;
    actorVenueRatingAfter: number;
    actorVenueRatingDelta: number;
    champCoinsDelta: number;
    rewards: VersusKataActorRewardClientPayload;
}): LiveGameSession {
    const { match, analysis, currentUser, venue, actorVenueRatingBefore, actorVenueRatingAfter, actorVenueRatingDelta, champCoinsDelta, rewards } =
        params;
    const rg = match.championshipRealGame!;
    const moves = Array.isArray(rg.moves) ? rg.moves : [];
    const p1 = match.players[0]!;
    const p2 = match.players[1]!;
    const player1 = seatUserFromTournament(currentUser, p1);
    const player2 = seatUserFromTournament(currentUser, p2);
    const now = Date.now();
    const settings = { ...DEFAULT_GAME_SETTINGS, boardSize: rg.boardSize };
    const winner = mapWinnerEnum(match);
    const finalScores =
        rg.finalScore != null
            ? { black: rg.finalScore.black, white: rg.finalScore.white }
            : analysis.scoreDetails
              ? { black: analysis.scoreDetails.black.total, white: analysis.scoreDetails.white.total }
              : undefined;

    const rewardItems: InventoryItem[] = [];
    if (champCoinsDelta > 0) {
        rewardItems.push(
            syntheticRewardItem({
                id: `versus-champ-coins-${match.id}`,
                name: '챔피언십 코인',
                image: '/images/icon/champcoin.webp',
                quantity: champCoinsDelta,
            }),
        );
    }

    const baseGold = Math.max(0, Math.floor(rewards.goldDelta));
    const vipGoldBonus = Math.max(0, Math.floor(Number(rewards.vipGoldBonus) || 0));
    const xpChange = Math.max(0, Math.floor(rewards.userXpDelta));
    const initialLevel = Math.max(
        1,
        Math.floor(Number(rewards.userLevelBefore ?? currentUser.userLevel) || 1),
    );
    let finalLevel = Math.max(1, Math.floor(Number(rewards.userLevelAfter) || initialLevel));
    let finalXpBar: number;
    if (
        rewards.userLevelAfter != null &&
        rewards.userXpAfter != null &&
        Number.isFinite(rewards.userXpAfter) &&
        rewards.userXpAfter >= 0
    ) {
        finalLevel = Math.max(1, Math.floor(Number(rewards.userLevelAfter) || 1));
        finalXpBar = Math.floor(rewards.userXpAfter);
    } else if (xpChange > 0) {
        const totalAfter = totalAccumulatedXpFromLevelAndBar(initialLevel, rewards.userXpBefore) + xpChange;
        const resolved = levelAndBarFromTotalAccumulatedXp(totalAfter);
        finalLevel = resolved.userLevel;
        finalXpBar = resolved.userXp;
    } else {
        finalLevel = initialLevel;
        finalXpBar = rewards.userXpBefore;
    }
    const leveledUp = finalLevel > initialLevel;
    const requiredXpForInitialLevel = getXpRequirementForLevel(initialLevel);
    const maxForProgress = leveledUp ? getXpRequirementForLevel(finalLevel) : requiredXpForInitialLevel;
    const initialForProgress = leveledUp ? 0 : rewards.userXpBefore;
    const safeMax =
        Number.isFinite(maxForProgress) && maxForProgress > 0
            ? maxForProgress
            : leveledUp
              ? 1
              : Number.isFinite(requiredXpForInitialLevel) && requiredXpForInitialLevel > 0
                ? requiredXpForInitialLevel
                : 1;

    const summary: GameSummary = {
        xp: { initial: rewards.userXpBefore, change: xpChange, final: finalXpBar },
        rating: {
            initial: actorVenueRatingBefore,
            change: actorVenueRatingDelta,
            final: actorVenueRatingAfter,
        },
        manner: { initial: currentUser.mannerScore, change: 0, final: currentUser.mannerScore },
        gold: baseGold + vipGoldBonus,
        matchGold: baseGold,
        ...(vipGoldBonus > 0 ? { vipGoldBonus } : {}),
        diamonds: 0,
        overallRecord: rewards.overallRecord,
        level: {
            initial: initialLevel,
            final: finalLevel,
            progress: {
                initial: initialForProgress,
                final: finalXpBar,
                max: safeMax,
            },
        },
        vipPlayRewardSlot: rewards.vipPlayRewardSlot,
        ...(rewardItems.length ? { items: rewardItems } : {}),
        ...(rewards.pairPetXp ? { pairPetXp: rewards.pairPetXp } : {}),
        ...(rewards.pairPetLevel ? { pairPetLevel: rewards.pairPetLevel } : {}),
    };

    const session = {
        id: `versus-kata-summary-${match.id}`,
        mode: GameMode.Standard,
        settings,
        description: `챔피언십 장내 카타:${venue}`,
        player1,
        player2,
        blackPlayerId: rg.blackPlayerId,
        whitePlayerId: rg.whitePlayerId,
        gameCategory: GameCategory.Normal,
        isSinglePlayer: false,
        isAiGame: false,
        isRankedGame: true,
        gameStatus: 'ended' as const,
        currentPlayer: Player.None,
        boardState: rg.boardState,
        moveHistory: [...moves],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner,
        winReason: 'score' as const,
        finalScores,
        createdAt: now - 60_000,
        gameStartTime: now - 60_000,
        endTime: now,
        turnStartTime: now,
        lastMove: rg.lastMove,
        passCount: 0,
        koInfo: null,
        winningLine: null,
        statsUpdated: true,
        summary: { [currentUser.id]: summary },
        analysisResult: { system: analysis },
        isAnalyzing: false,
        blackTimeLeft: 0,
        whiteTimeLeft: 0,
        blackByoyomiPeriodsLeft: 0,
        whiteByoyomiPeriodsLeft: 0,
        disconnectionState: null,
        disconnectionCounts: { [player1.id]: 0, [player2.id]: 0 },
        currentActionButtons: { [player1.id]: [], [player2.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUses: { [player1.id]: 0, [player2.id]: 0 },
        maxActionButtonUses: 5,
        actionButtonUsedThisCycle: { [player1.id]: false, [player2.id]: false },
        missileUsedThisTurn: false,
        round: 1,
        turnInRound: 1,
        newlyRevealed: [],
        scores: { [player1.id]: 0, [player2.id]: 0 },
    };

    return session as unknown as LiveGameSession;
}
