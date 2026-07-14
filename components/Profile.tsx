import React, { useMemo, useState, useCallback, useEffect, useRef, useId } from 'react';
import { UserWithStatus, GameMode, EquipmentSlot, InventoryItem, ItemGrade, ServerAction, LeagueTier, CoreStat, SpecialStat, MythicStat, ItemOptionType, TournamentState, User } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, LEAGUE_DATA, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, emptySlotImages, TOURNAMENT_DEFINITIONS, CHAMPIONSHIP_PVP_VENUE_BG_WEBP, GRADE_LEVEL_REQUIREMENTS, formatEquipLevelRequirement, RANKING_TIERS, getSinglePlayerStages } from '../constants';
import { PVP_ARENA_ENTRY_IMG, AI_ARENA_ENTRY_IMG, STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, PAIR_GO_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG, TOWER_MOBILE_HERO_WEBP } from '../assets.js';
import Avatar from './Avatar.js';
import ProfileHomeIdentityHeader from './profile/ProfileHomeIdentityHeader.js';
import ProfileMannerSeal from './profile/ProfileMannerSeal.js';
import UserNicknameText from './UserNicknameText.js';
import Button from './Button.js';
import ProfileEditModal from './ProfileEditModal.js';
import { getMannerScore, getMannerRank } from '../services/manner.js';
import { calculateUserEffects } from '../services/effectService.js';
import { useAppContext } from '../hooks/useAppContext.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import PcLobbyCenterColumn from './shell/PcLobbyCenterColumn.js';
import {
    PC_HOME_LEFT_COLUMN_CLASS,
    PC_HOME_LEFT_COLUMN_GAP_CLASS,
    PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS,
    PC_QUICK_RAIL_COLUMN_CLASS,
    PC_QUICK_RAIL_WRAPPER_CLASS,
} from '../shared/constants/pcShellLayout.js';
import { BADUK_ABILITY_STAT_CAP, BADUK_ABILITY_TOTAL_CAP, CORE_STAT_RADAR_ORDER } from './CoreStatsHexagonChart.js';
import GameRankingBoard from './GameRankingBoard.js';
import BadukRankingBoard from './BadukRankingBoard.js';
import MannerRankModal from './MannerRankModal.js';
import GuildCreateModal from './guild/GuildCreateModal.js';
import GuildJoinModal from './guild/GuildJoinModal.js';
import GuildMark from './guild/GuildMark.js';
import EquipmentEnhancementBadge from './EquipmentEnhancementBadge.js';
import {
    GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS,
    GRADE_SLOT_SCRIM_CLASS,
    gradeSlotBorderOverlayClass,
    itemSlotIconStyleForGrade,
} from '../shared/constants/itemSlotIconLayout.js';
import type { Guild, ChampionshipVersusVenueKind } from '../types/entities.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { ADVENTURE_STAGES } from '../constants/adventureConstants.js';
import {
    mergeArenaEntranceAvailability,
    ARENA_ENTRANCE_CLOSED_MESSAGE,
    type ArenaEntranceKey,
} from '../constants/arenaEntrance.js';
import {
    USER_PROGRESSION_ARENA_BLOCK_MESSAGE,
    PVP_LOBBIES_MIN_COMBINED_LEVEL,
    TOWER_ENTRANCE_REQUIRED_STAGE_ID,
    ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID,
    CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL,
} from '../shared/utils/contentProgressionGates.js';
import {
    PAIR_TRAINING_SLOT_COUNT,
    normalizePairPetTrainingSlots,
    isPairTrainingSlotUnlocked,
} from '../shared/constants/pairTraining.js';
import { mergeWaitingRoomPublicChatMessages } from '../shared/utils/waitingRoomGlobalChatMerge.js';
import {
    PAIR_HATCHERY_MAIN_SLOT_INDEX,
    PAIR_HATCHERY_VIP_SLOT_INDEX,
    normalizePairPetHatcherySessions,
    canUsePairHatcherySlot,
} from '../shared/constants/pairHatchery.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import { arenaLobbyHash } from '../shared/utils/arenaLobbyDestination.js';
import { sumLobbyAiMatchRecordFromStats } from '../shared/utils/lobbyAiMatchRecord.js';
import { getAdventureCodexCompletionBreakdown } from '../utils/adventureCodexCompletion.js';
import { userHasFullTrainingQuestReward } from '../utils/trainingQuestRewardNotify.js';
import { computeCoreStatFinalFromBonuses } from '../shared/utils/coreStatComposition.js';
import {
    userMeetsGuildFeatureLevelRequirement,
    MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES,
    getCombinedStrategyPlayfulLevel,
} from '../shared/constants/guildConstants.js';
import { getXpRequirementForLevel } from '../shared/utils/strategyLevelXp.js';
import {
    readStrategicRankedBlock,
    readPairRankedBlock,
    readPairArenaAiMatchRecord,
} from '../shared/utils/unifiedRankedStatsMigration.js';
import { RANKED_ELO_BASE_SCORE } from '../shared/constants/rules.js';
import { getSeasonalRankingTierName } from '../shared/constants/ranking.js';
import { getChampionshipVersusDisplayRating } from '../shared/utils/championshipVersusElo.js';
import { NEW_FEATURE_BADGE_CLASS } from '../utils/newFeatureBadges.js';
import PairPetProfilePanel from './pair/PairPetProfilePanel.js';
import HomeNativeMergedEquipmentAbilityPanel from './HomeNativeMergedEquipmentAbilityPanel.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { useScreenGuide } from '../hooks/useScreenGuide.js';
import ScreenGuideModal from './ScreenGuideModal.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import { useTranslation } from 'react-i18next';

function isVipExpiresActive(exp?: number): boolean {
    return typeof exp === 'number' && Number.isFinite(exp) && exp > Date.now();
}

interface ProfileProps {
}

const XpBar: React.FC<{
    level: number;
    currentXp: number;
    label: string;
    colorClass: string;
    bumpText?: boolean;
    /** 네이티브 홈 등: 글자·바 높이 축소 */
    dense?: boolean;
}> = ({ level, currentXp, label, colorClass, bumpText = false, dense = false }) => {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    const safeXp = Math.max(0, Math.floor(Number(currentXp) || 0));
    const maxXp = getXpRequirementForLevel(safeLevel);
    const percentage = maxXp > 0 ? Math.min((safeXp / maxXp) * 100, 100) : 0;
    const fs = dense
        ? 'clamp(0.56rem, 1.35vw, 0.68rem)'
        : bumpText
          ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)'
          : 'clamp(0.625rem, 1.5vw, 0.75rem)';
    return (
        <div className="min-w-0">
            <div className="mb-0.5 flex min-w-0 items-baseline justify-between gap-1 text-xs">
                <span className="min-w-0 truncate font-semibold text-slate-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]" style={{ fontSize: fs }}>
                    {label}
                </span>
                <span
                    className="shrink-0 whitespace-nowrap rounded-md border border-amber-400/35 bg-black/45 px-1.5 py-[1px] text-right font-mono font-semibold tabular-nums text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    style={{ fontSize: fs }}
                >
                    {safeXp} / {maxXp}
                </span>
            </div>
            <div className={`w-full rounded-full border border-color bg-tertiary/50 ${dense ? 'h-2' : 'h-3'}`}>
                <div className={`${colorClass} h-full rounded-full transition-width duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const CombinedLevelBadge: React.FC<{ level: number; compact?: boolean }> = ({ level, compact = false }) => {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    return (
        <div className={`flex shrink-0 items-center justify-center rounded-md border border-color bg-tertiary/40 text-center ${compact ? 'w-11 px-1 py-1' : 'w-14 px-1.5 py-1.5'}`}>
            <span className={`whitespace-nowrap font-bold leading-none text-highlight ${compact ? 'text-sm' : 'text-xl'}`}>Lv.{safeLevel}</span>
        </div>
    );
};

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.webp',
    uncommon: '/images/equipments/uncommonbgi.webp',
    rare: '/images/equipments/rarebgi.webp',
    epic: '/images/equipments/epicbgi.webp',
    legendary: '/images/equipments/legendarybgi.webp',
    mythic: '/images/equipments/mythicbgi.webp',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-purple-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const EquipmentSlotDisplay: React.FC<{
    slot: EquipmentSlot;
    item?: InventoryItem;
    onClick?: () => void;
    scaleFactor?: number;
    /** 특정 레이아웃에서만 슬롯·아이콘 축소 */
    compact?: boolean;
}> = ({ slot, item, onClick, compact = false, scaleFactor = 1 }) => {
    const { t } = useTranslation('profile');
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    void scaleFactor;
    
    if (item) {
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
        const titleText = t('equipmentDetailTitle', { name: item.name, level: formatEquipLevelRequirement(requiredLevel) });
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 border-color/50 bg-tertiary/50 ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={titleText}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                <div className={GRADE_SLOT_SCRIM_CLASS} aria-hidden />
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="absolute z-[2] object-contain"
                        style={itemSlotIconStyleForGrade(item.grade)}
                    />
                )}
                <div
                    className={`${GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS} ${gradeSlotBorderOverlayClass(item.grade)}`}
                    aria-hidden
                />
                <EquipmentEnhancementBadge stars={item.stars} />
            </div>
        );
    } else {
        if (compact) {
            return (
                <div className="relative flex w-full aspect-square items-center justify-center rounded-lg border-2 border-color/50 bg-tertiary/50 p-0.5">
                    <img
                        src={emptySlotImages[slot]}
                        alt={`${slot} empty slot`}
                        className="max-h-[94%] max-w-[94%] rounded-md object-contain"
                    />
                </div>
            );
        }
        return (
            <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-lg bg-tertiary/50 border-2 border-color/50" />
        );
    }
};

const LobbyCard: React.FC<{
    type: 'strategic' | 'playful';
    stats: { wins: number; losses: number };
    onEnter: () => void;
    onViewStats: () => void;
    level: number;
    title: string;
    imageUrl: string;
    tier?: { name: string; icon: string; };
    compact?: boolean;
    /** 네이티브 경기장 탭: 세로 스택용 큰 카드 */
    arenaMobile?: boolean;
    /** 경기장 탭: 통합 랭킹 점수(표시용, 선택) */
    integratedRankingScore?: number;
    hideOverlayText?: boolean;
    hideOverlayFooter?: boolean;
    locked?: boolean;
    lockReason?: string;
}> = ({ type, stats, onEnter, onViewStats, level, title, imageUrl, tier, compact, arenaMobile, hideOverlayText = false, hideOverlayFooter = false, locked = false, lockReason }) => {
    const { t } = useTranslation('profile');
    const isStrategic = type === 'strategic';
    const shadowColor = isStrategic ? "hover:shadow-blue-500/30" : "hover:shadow-yellow-500/30";

    const totalGames = stats.wins + stats.losses;
    const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;

    const compactMode = Boolean(compact && !arenaMobile);

    if (arenaMobile) {
        const accentRing = isStrategic ? 'focus-visible:ring-cyan-400/70' : 'focus-visible:ring-amber-400/70';
        const popEase = 'duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]';
        const hoverLift = isStrategic
            ? 'hover:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.78),0_14px_42px_-12px_rgba(56,189,248,0.28)] hover:ring-cyan-400/35'
            : 'hover:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.78),0_14px_42px_-12px_rgba(251,191,36,0.26)] hover:ring-amber-400/35';
        return (
            <button
                type="button"
                onClick={locked ? undefined : onEnter}
                disabled={locked}
                aria-label={t('arenaEnterAria', { title })}
                className={`group relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/40 text-left shadow-[0_14px_44px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/8 transition-all will-change-transform ${popEase} ${locked ? 'cursor-not-allowed grayscale-[0.25] opacity-75' : `hover:z-10 hover:-translate-y-2 hover:scale-[1.035] ${hoverLift} active:translate-y-0 active:scale-[1.01]`} ${accentRing} focus:outline-none focus-visible:ring-2`}
            >
                <img
                    src={imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 group-active:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/12" />
                {locked && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                        <span className="text-[2rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[2.4rem]">🔒</span>
                        <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-rose-100 sm:text-xs">
                            {lockReason ?? t('lock')}
                        </span>
                    </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/12 to-transparent pt-3 pb-10 px-3 sm:pt-4 sm:px-4">
                    <span
                        className={`block text-center text-[1.05rem] font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-xl ${
                            isStrategic
                                ? 'bg-gradient-to-br from-sky-100 via-white to-cyan-200 bg-clip-text text-transparent'
                                : 'bg-gradient-to-br from-amber-100 via-white to-orange-200 bg-clip-text text-transparent'
                        }`}
                    >
                        {title}
                    </span>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/80 via-black/35 to-transparent pb-2 pt-8">
                    <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold text-white/95 shadow-lg backdrop-blur-sm sm:text-xs ${
                            isStrategic ? 'bg-blue-600/88 ring-1 ring-white/15' : 'bg-amber-600/88 ring-1 ring-white/15'
                        }`}
                    >
                        {locked ? t('locked') : t('tapToEnter')}
                    </span>
                </div>
            </button>
        );
    }

    return (
        <div
            onClick={locked ? undefined : onEnter}
            className={`group relative overflow-hidden rounded-xl border border-amber-400/40 text-center transition-all transform shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 ${shadowColor} text-on-panel ${locked ? 'cursor-not-allowed grayscale-[0.25] opacity-75' : 'cursor-pointer'} ${compactMode ? 'h-full min-h-0 p-0.5' : `h-full p-1.5 ${locked ? '' : 'hover:-translate-y-1'} lg:p-2.5`}`}
        >
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-200/25" aria-hidden />
            <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
            <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/0 via-black/0 to-black/14" />
            {locked && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                    <span className="text-[2rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[2.4rem]">🔒</span>
                    <span className={`mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 font-bold text-rose-100 ${compactMode ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
                        {lockReason ?? t('lock')}
                    </span>
                </div>
            )}
            <h2 className={`relative z-[1] font-bold flex items-center justify-center gap-0.5 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${hideOverlayText ? 'hidden' : ''} ${compactMode ? 'mb-0 text-[8px] leading-tight' : 'mb-0.5 h-4 text-xs lg:mb-1 lg:h-6 lg:gap-1 lg:text-base'}`}>
               {title}
               {tier && <img src={tier.icon} alt={tier.name} className={compactMode ? 'h-2.5 w-2.5' : 'h-3 w-3 lg:h-5 lg:w-5'} title={tier.name} />}
               <span className={`text-amber-200 font-semibold ${compactMode ? 'text-[8px]' : 'text-[10px] lg:text-sm'}`}>Lv.{level}</span>
           </h2>
            <div className="min-h-0 w-full flex-1 overflow-hidden rounded-md" />
            {!hideOverlayFooter && (
                <div
                    onClick={(e) => { e.stopPropagation(); if (!locked) onViewStats(); }}
                    className={`relative z-[1] mt-0.5 flex w-full items-center justify-between rounded-md bg-black/50 text-white backdrop-blur-[1px] ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-black/65'} ${compactMode ? 'px-0.5 py-px text-[7px]' : 'mt-1 p-0.5 text-[10px] transition-colors lg:mt-2 lg:p-1 lg:text-xs'}`}
                    title={t('viewStats')}
                >
                    <span className="min-w-0 truncate">{compactMode ? t('totalRecordCompact', { wins: stats.wins, losses: stats.losses, winRate }) : t('totalRecordFull', { wins: stats.wins, losses: stats.losses, winRate })}</span>
                    <span className="flex-shrink-0 text-accent font-semibold">&rarr;</span>
                </div>
            )}
        </div>
    );
};

const PveCard: React.FC<{ title: string; imageUrl: string; layout: 'grid' | 'tall'; footerContent?: React.ReactNode; onClick?: () => void; isComingSoon?: boolean; compact?: boolean; arenaMobile?: boolean; hideOverlayText?: boolean; locked?: boolean; lockReason?: string; imageScaleClass?: string; newBadge?: boolean }> = ({ title, imageUrl, layout, footerContent, onClick, isComingSoon, compact, arenaMobile, hideOverlayText = false, locked = false, lockReason, imageScaleClass = '', newBadge = false }) => {
    const { t } = useTranslation('profile');
    const shadowColor = "hover:shadow-purple-500/30";
    const compactMode = Boolean(compact && !arenaMobile);

    if (arenaMobile) {
        const popEase = 'duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]';
        const interactive = !isComingSoon && !locked && onClick;
        const shellClass = `relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/35 text-left shadow-[0_14px_44px_-18px_rgba(0,0,0,0.85)] ring-1 ring-purple-500/15 transition-all will-change-transform ${popEase} ${
            interactive
                ? 'hover:z-10 hover:-translate-y-2 hover:scale-[1.035] hover:shadow-[0_28px_52px_-14px_rgba(0,0,0,0.72),0_12px_40px_-8px_rgba(168,85,247,0.35)] hover:ring-fuchsia-400/30 active:translate-y-0 active:scale-[1.01] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60'
                : 'cursor-not-allowed opacity-[0.92] grayscale-[0.3]'
        }`;
        const inner = (
            <>
                <img
                    src={imageUrl}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out ${imageScaleClass} ${interactive ? 'group-hover:scale-105 group-active:scale-[1.02]' : ''}`}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-violet-950/5 to-black/16" />
                {locked && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                        <span className="text-[2rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[2.4rem]">🔒</span>
                        <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-rose-100 sm:text-xs">
                            {lockReason ?? t('lock')}
                        </span>
                    </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/12 to-transparent pt-3 pb-10 px-3 sm:pt-4 sm:px-4">
                    <span className="block text-center text-[1.05rem] font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-xl bg-gradient-to-br from-fuchsia-100 via-white to-violet-200 bg-clip-text text-transparent">
                        {title}
                    </span>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/85 via-black/40 to-transparent pb-2 pt-8">
                    <span className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur-sm ring-1 ring-white/10 sm:text-xs">
                        {isComingSoon ? t('comingSoon') : t('tapToEnter')}
                    </span>
                </div>
            </>
        );
        return (
            <div className="relative flex h-full min-h-0 flex-1 flex-col">
                {isComingSoon && (
                    <div className="pointer-events-none absolute right-0 top-3 z-20 rotate-45 bg-gradient-to-r from-purple-600 to-fuchsia-600 px-9 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md sm:px-10 sm:text-[10px]">
                        Soon
                    </div>
                )}
                {newBadge && <span className={`${NEW_FEATURE_BADGE_CLASS} left-2 top-2 sm:left-3 sm:top-3`}>NEW</span>}
                {interactive ? (
                    <button type="button" onClick={onClick} className={`group ${shellClass}`} aria-label={t('enterAria', { title })}>
                        {inner}
                    </button>
                ) : (
                    <div className={shellClass} role="group" aria-label={title}>
                        {inner}
                    </div>
                )}
                {footerContent && (
                    <div className="mt-1 w-full shrink-0 rounded-lg border border-white/5 bg-white/5 p-1 text-[10px] text-slate-300 sm:text-xs">{footerContent}</div>
                )}
            </div>
        );
    }

    return (
        <div
            onClick={locked ? undefined : onClick}
            className={`${isComingSoon ? 'border border-amber-500/35 opacity-60 grayscale' : 'border border-amber-400/45'} relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl text-center shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 text-on-panel ${compactMode ? 'p-0.5' : 'h-full p-1.5 transform transition-all lg:p-2.5'} ${isComingSoon || locked ? 'cursor-not-allowed' : onClick ? `cursor-pointer ${compactMode ? '' : `hover:-translate-y-1 ${shadowColor}`}` : 'cursor-not-allowed'} group ${locked ? 'grayscale-[0.25] opacity-75' : ''}`}
        >
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-200/25" aria-hidden />
            {isComingSoon && (
                <div className={`absolute z-10 -right-6 rotate-45 bg-purple-600 font-bold text-white ${compactMode ? 'top-0 px-6 py-px text-[6px]' : 'top-1 px-8 py-0.5 text-[8px] lg:top-2 lg:-right-10 lg:px-10 lg:text-[10px]'}`}>
                    Coming Soon
                </div>
            )}
            {newBadge && <span className={`${NEW_FEATURE_BADGE_CLASS} left-2 top-2 ${compactMode ? 'scale-75' : ''}`}>NEW</span>}
            <img src={imageUrl} alt={title} className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105 ${imageScaleClass}`} />
            <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/5 via-violet-950/5 to-black/16" />
            {locked && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                    <span className="text-[2rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[2.4rem]">🔒</span>
                    <span className={`mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 font-bold text-rose-100 ${compactMode ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
                        {lockReason ?? t('lock')}
                    </span>
                </div>
            )}
            <h2 className={`relative z-[1] font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${hideOverlayText ? 'hidden' : ''} ${compactMode ? 'mb-0 mt-0 text-[8px]' : 'mb-0.5 mt-0.5 h-4 text-xs lg:mb-1 lg:mt-1 lg:h-6 lg:text-base'} ${isComingSoon ? 'text-gray-300' : ''}`}>{title}</h2>
            <div className="flex w-full min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md" />
            {footerContent && !hideOverlayText && (
                <div className={`relative z-[1] mt-0.5 w-full rounded-md bg-black/50 text-white backdrop-blur-[1px] ${compactMode ? 'p-px text-[7px]' : 'mt-1 p-0.5 text-[10px] lg:mt-2 lg:p-1 lg:text-xs'}`}>
                    {footerContent}
                </div>
            )}
        </div>
    );
};

/** @deprecated split PVP/AI entry — use Profile arena cards */
const StrategicPairPvpSymbolCard: React.FC<{
    onSelectStrategic: () => void;
    onSelectPair: () => void;
    strategicLocked?: boolean;
    strategicLockReason?: string;
    pairLocked?: boolean;
    pairLockReason?: string;
}> = ({ onSelectStrategic, onSelectPair, strategicLocked, strategicLockReason, pairLocked, pairLockReason }) => {
    const { t } = useTranslation('profile');
    return (
        <div className="group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-amber-400/35 text-on-panel shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)]">
            <button
                type="button"
                onClick={strategicLocked ? undefined : onSelectStrategic}
                disabled={strategicLocked}
                className={`relative h-1/2 w-full overflow-hidden border-b border-amber-300/25 text-left transition-transform duration-200 ${strategicLocked ? 'cursor-not-allowed opacity-80' : 'hover:brightness-110 active:scale-[0.995]'}`}
                aria-label={t('strategicLobbyEnter')}
            >
                <img
                    src={STRATEGIC_GO_LOBBY_IMG}
                    alt={t('strategicLobbyAlt')}
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    decoding="async"
                    fetchpriority="high"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-950/45 via-black/25 to-transparent" />
                <span className="pointer-events-none absolute left-2 top-2 rounded-md border border-cyan-300/55 bg-cyan-900/70 px-2 py-0.5 text-xs font-black tracking-wide text-cyan-100">
                    {t('strategic')}
                </span>
                {strategicLocked && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                        <span className="text-[1.35rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[1.6rem]">🔒</span>
                        <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[9px] font-bold text-rose-100 sm:text-[10px]">
                            {strategicLockReason ?? t('entryBlocked')}
                        </span>
                    </div>
                )}
            </button>
            <button
                type="button"
                onClick={pairLocked ? undefined : onSelectPair}
                disabled={pairLocked}
                className={`relative h-1/2 w-full overflow-hidden text-left transition-transform duration-200 ${pairLocked ? 'cursor-not-allowed opacity-80' : 'hover:brightness-110 active:scale-[0.995]'}`}
                aria-label={t('pairArenaEnter')}
            >
                <img
                    src={PAIR_GO_LOBBY_IMG}
                    alt={t('pairArenaAlt')}
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    decoding="async"
                    fetchpriority="high"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-950/45 via-black/25 to-transparent" />
                <span className="pointer-events-none absolute left-2 top-2 rounded-md border border-violet-300/55 bg-violet-900/70 px-2 py-0.5 text-xs font-black tracking-wide text-violet-100">
                    {t('pair')}
                </span>
                {pairLocked && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                        <span className="text-[1.35rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[1.6rem]">🔒</span>
                        <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[9px] font-bold text-rose-100 sm:text-[10px]">
                            {pairLockReason ?? t('entryBlocked')}
                        </span>
                    </div>
                )}
            </button>
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" aria-hidden />
        </div>
    );
};

const formatMythicStat = (stat: MythicStat, _data: { count: number, totalValue: number }, t: (key: string) => string): React.ReactNode => {
    const row = MYTHIC_STATS_DATA[stat];
    if (!row) return <span className="w-full">{t('unknownSpecialStat')}</span>;
    return <span className="w-full">{row.description}</span>;
};

const getTier = (score: number, rank: number, totalGames: number) => {
    if (totalGames === 0) return RANKING_TIERS[RANKING_TIERS.length - 1];
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) {
            return tier;
        }
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

const StatSummaryPanel: React.FC<{ title: string; color: string; children: React.ReactNode; emptyLabel: string }> = ({ title, color, children, emptyLabel }) => {
    const childrenArray = React.Children.toArray(children).filter(Boolean); // Filter out null/undefined children
    return (
        <div className="flex-1 bg-tertiary/30 p-1.5 rounded-md flex flex-col min-h-0">
            <h4 className={`text-center font-semibold mb-0.5 text-xs flex-shrink-0 ${color}`}>{title}</h4>
            <div className="flex-grow overflow-y-auto pr-1 space-y-0.5 text-xs">
                {childrenArray.length > 0 ? childrenArray : <p className="text-xs text-tertiary text-center">{emptyLabel}</p>}
            </div>
        </div>
    );
};

/** 경기장 탭: 상단 티어·레벨·통합 한 줄 + 중앙 총 전적 */
const ArenaMobileStatStrip: React.FC<{
    variant: 'strategic' | 'playful';
    agg: { wins: number; losses: number };
    integratedScore: number;
    tier: { name: string; icon: string };
    level: number;
    onOpenModal: () => void;
}> = ({ variant, agg, integratedScore, tier, level, onOpenModal }) => {
    const { t } = useTranslation('profile');
    const isStrategic = variant === 'strategic';
    const pct = (w: number, l: number) => {
        const t = w + l;
        return t > 0 ? Math.round((w / t) * 100) : 0;
    };

    const accentBar = isStrategic
        ? 'from-transparent via-cyan-400/55 to-transparent'
        : 'from-transparent via-amber-400/50 to-transparent';
    const panelBg = isStrategic
        ? 'from-slate-950/98 via-sky-950/[0.12] to-slate-950/98'
        : 'from-slate-950/98 via-amber-950/[0.1] to-slate-950/98';
    const borderTint = isStrategic ? 'border-sky-500/20' : 'border-amber-500/20';
    const lvTone = isStrategic ? 'text-sky-200' : 'text-amber-200';
    const scoreTone = isStrategic ? 'text-sky-100' : 'text-amber-100';
    const rateTone = isStrategic ? 'text-cyan-200/95' : 'text-amber-200/95';
    const btn = isStrategic
        ? 'border-sky-500/35 bg-sky-950/50 text-sky-50 shadow-[0_4px_20px_-8px_rgba(56,189,248,0.35)] hover:bg-sky-900/55 hover:border-sky-400/45 active:scale-[0.98]'
        : 'border-amber-500/35 bg-amber-950/45 text-amber-50 shadow-[0_4px_20px_-8px_rgba(251,191,36,0.28)] hover:bg-amber-950/60 hover:border-amber-400/40 active:scale-[0.98]';
    const divider = 'h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/40 to-transparent';

    return (
        <div
            className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border ${borderTint} bg-gradient-to-b ${panelBg} text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_40px_-18px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.06]`}
        >
            <div className={`h-[2px] w-full bg-gradient-to-r ${accentBar} opacity-90`} />
            <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2.5 pt-3 sm:px-3">
                {/* 상단: 티어 · 레벨 · 통합 (한 줄) */}
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-x-2.5">
                    {tier ? (
                        <img
                            src={tier.icon}
                            alt={tier.name}
                            title={tier.name}
                            className="h-9 w-9 shrink-0 rounded-md bg-black/30 object-contain p-0.5 ring-1 ring-white/15 shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:h-10 sm:w-10"
                        />
                    ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-sm text-slate-500 ring-1 ring-white/10 sm:h-10 sm:w-10">
                            —
                        </div>
                    )}
                    <span className={divider} aria-hidden />
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold text-slate-300">Lv</span>
                        <span className={`font-mono text-lg font-bold tabular-nums tracking-tight sm:text-xl ${lvTone}`}>{level}</span>
                    </div>
                    <span className={divider} aria-hidden />
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold tracking-wide text-slate-300">{t('integrated')}</span>
                        <span className={`font-mono text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl ${scoreTone}`}>{integratedScore}</span>
                        <span className="text-sm font-medium text-slate-300">{t('points')}</span>
                    </div>
                </div>

                <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/28 to-transparent" />

                {/* 중앙: 총 전적 */}
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-1">
                    <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-200 sm:text-base">{t('totalRecord')}</span>
                    <p className="text-center font-mono text-[1.95rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-[2.15rem]">
                        <span>{agg.wins}</span>
                        <span className="mx-0.5 align-baseline text-[0.56em] font-bold text-slate-200">{t('winShort')}</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span>{agg.losses}</span>
                        <span className="ml-0.5 align-baseline text-[0.56em] font-bold text-slate-200">{t('loseShort')}</span>
                    </p>
                    <p className="text-base text-slate-200">
                        {t('winRate')}{' '}
                        <span className={`font-mono text-lg font-bold tabular-nums sm:text-xl ${rateTone}`}>{pct(agg.wins, agg.losses)}%</span>
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onOpenModal}
                    className={`mx-auto mt-1 w-fit min-w-[6rem] rounded-lg border px-4 py-2 text-center text-xs font-semibold tracking-wide transition-all sm:min-w-[6.5rem] sm:text-sm ${btn}`}
                >
                    {t('viewAll')}
                </button>
            </div>
        </div>
    );
};

type PvpArenaHomeTierSnapshot = {
    bestScore: number;
    bestTier: { name: string; icon: string };
    strategicWins: number;
    strategicLosses: number;
    pairWins: number;
    pairLosses: number;
};

/** 홈·경기장 탭 PVP 카드 우측: 최고 점수+티어 + 전략·페어·놀이 전적 */
const PvpArenaHomeInfoMiddle: React.FC<{
    tiers: PvpArenaHomeTierSnapshot;
    playfulWins: number;
    playfulLosses: number;
    infoPanelMiddleClass: string;
    infoLabelClass: string;
    infoValueClass: string;
}> = ({ tiers, playfulWins, playfulLosses, infoPanelMiddleClass, infoLabelClass, infoValueClass }) => {
    const { t } = useTranslation('profile');
    const recordInnerRowClass =
        'grid w-full min-w-0 grid-cols-[minmax(4.25rem,auto)_minmax(0,1fr)] items-center gap-x-2 py-0.5 text-[12.5px] leading-snug';
    return (
        <div className={infoPanelMiddleClass}>
            <div className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-2 py-2">
                <img
                    src={tiers.bestTier.icon}
                    alt=""
                    title={tiers.bestTier.name}
                    className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
                />
                <div className="min-w-0 flex-1 text-center">
                    <span className={`${infoLabelClass} block text-[11px]`}>{tiers.bestTier.name}</span>
                    <span className={`${infoValueClass} block font-mono text-base text-fuchsia-100 sm:text-lg`}>
                        {tiers.bestScore}{t('points')}
                    </span>
                </div>
            </div>
            <div className="flex w-full flex-col gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
                <div className={recordInnerRowClass}>
                    <span className={infoLabelClass}>{t('strategicRecord')}</span>
                    <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                        {tiers.strategicWins}{t('winShort')}{tiers.strategicLosses}{t('loseShort')}
                    </span>
                </div>
                <div className={recordInnerRowClass}>
                    <span className={infoLabelClass}>{t('pairRecord')}</span>
                    <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                        {tiers.pairWins}{t('winShort')}{tiers.pairLosses}{t('loseShort')}
                    </span>
                </div>
                <div className={recordInnerRowClass}>
                    <span className={infoLabelClass}>{t('playfulRecord')}</span>
                    <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                        {playfulWins}{t('winShort')}{playfulLosses}{t('loseShort')}
                    </span>
                </div>
            </div>
        </div>
    );
};

/** 모험 행 — 입장카드 높이에 맞춘 플레이스홀더 */
const ArenaMobilePvpStatStrip: React.FC = () => {
    const { t } = useTranslation('profile');
    return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-purple-500/30 bg-gradient-to-b from-purple-950/40 via-slate-950/90 to-slate-950/98 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.05]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/25 to-transparent" />
        <span className="bg-gradient-to-r from-fuchsia-200 via-purple-100 to-violet-200 bg-clip-text text-sm font-bold tracking-wide text-transparent sm:text-base">{t('adventure')}</span>
        <span className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">{t('comingSoon')}</span>
    </div>
    );
};

const Profile: React.FC<ProfileProps> = () => {
    const {
        currentUserWithStatus,
        allUsers,
        handlers,
        hasClaimableQuest,
        presets,
        guilds,
        currentRoute,
        arenaEntranceAvailability,
        arenaEntranceFromServer,
        singlePlayerStagesListRevision,
        waitingRoomChats,
    } = useAppContext();
    const adventureCodexDonutGradId = useId().replace(/:/g, '');
    const { t } = useTranslation(['profile', 'lobby', 'nav']);
    const { isNativeMobile } = useNativeMobileShell();
    const profileTab = (currentRoute.params?.tab as 'home' | 'ranking' | 'arena' | undefined) ?? 'home';
    /** 홈 탭: PC와 동일 패널·타이포 */
    const readableHome = profileTab === 'home';
    /** 홈: 유저 패널(프로필·길드·능력치·대표펫 한 줄) + 채팅 패널 2단 구성 */
    const homeLeftColumnMerge = profileTab === 'home';
    /** 네이티브 앱 홈: PC와 동일 구조, 타이포·썸네일·펫 카드만 축소해 통일 */
    const nativeCompactHome = isNativeMobile && homeLeftColumnMerge;
    const mergedPublicChatMessages = useMemo(
        () => mergeWaitingRoomPublicChatMessages(waitingRoomChats),
        [waitingRoomChats],
    );
    /** 챔피언십 경기장: 통합 ELO + 경기장별 시즌 전적 */
    const championshipVenueStrip = useMemo(() => {
        const u = currentUserWithStatus;
        if (!u) {
            const fallback = RANKING_TIERS[RANKING_TIERS.length - 1]!;
            return {
                rating: RANKED_ELO_BASE_SCORE,
                tier: fallback,
                tierName: fallback.name,
                venueSeason: [] as { label: string; wins: number; losses: number }[],
            };
        }
        const rating = getChampionshipVersusDisplayRating(u, 'pvp', Date.now());
        const wl = (k: ChampionshipVersusVenueKind) => {
            const e = u.championshipVersusVenueRatings?.[k];
            return {
                wins: Math.max(0, Math.floor(Number(e?.seasonWins) || 0)),
                losses: Math.max(0, Math.floor(Number(e?.seasonLosses) || 0)),
            };
        };
        const p = wl('pvp');
        const pet = wl('pet');
        const pr = wl('petpair');
        const games = Math.max(p.wins + p.losses, pet.wins + pet.losses, pr.wins + pr.losses);
        const tierName = getSeasonalRankingTierName(rating, 999_999, games);
        const tier = RANKING_TIERS.find((x) => x.name === tierName) ?? RANKING_TIERS[RANKING_TIERS.length - 1]!;
        return {
            rating: Math.round(rating),
            tier,
            tierName,
            venueSeason: [
                { label: t('chartLegend.user'), ...p },
                { label: t('chartLegend.pet'), ...pet },
                { label: t('chartLegend.pair'), ...pr },
            ],
        };
    }, [currentUserWithStatus, t]);
    const [towerTimeLeft, setTowerTimeLeft] = useState('');
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [showMannerRankModal, setShowMannerRankModal] = useState(false);
    const [isGuildCreateModalOpen, setIsGuildCreateModalOpen] = useState(false);
    const [isGuildJoinModalOpen, setIsGuildJoinModalOpen] = useState(false);
    const [adminModalPreviewMenuOpen, setAdminModalPreviewMenuOpen] = useState(false);
    const homeScreenGuide = useScreenGuide('home');

    const meetsGuildLevelForFeatures = useMemo(
        () => (currentUserWithStatus ? userMeetsGuildFeatureLevelRequirement(currentUserWithStatus) : false),
        [currentUserWithStatus?.userLevel, currentUserWithStatus?.isAdmin],
    );

    const [vipMenuOpen, setVipMenuOpen] = useState(false);
    const [vipTestBusy, setVipTestBusy] = useState(false);
    const vipMenuRef = useRef<HTMLDivElement>(null);
    const adminModalPreviewMenuRef = useRef<HTMLDivElement>(null);

    const sendAdminVipTestFlags = useCallback(
        async (flags: { rewardVip: boolean; functionVip: boolean; vvip: boolean; removeAds: boolean }) => {
            if (!handlers?.handleAction || !isClientAdmin(currentUserWithStatus)) return;
            setVipTestBusy(true);
            try {
                await handlers.handleAction({ type: 'ADMIN_SET_VIP_TEST_FLAGS', payload: flags });
            } finally {
                setVipTestBusy(false);
            }
        },
        [handlers, currentUserWithStatus],
    );

    const sendAdminDiamondPackageTest = useCallback(
        async (tier: 1 | 2 | 3, on: boolean) => {
            if (!handlers?.handleAction || !isClientAdmin(currentUserWithStatus)) return;
            setVipTestBusy(true);
            try {
                await handlers.handleAction({ type: 'ADMIN_SET_DIAMOND_PACKAGE_TEST', payload: { tier, on } });
            } finally {
                setVipTestBusy(false);
            }
        },
        [handlers, currentUserWithStatus],
    );

    useEffect(() => {
        if (!vipMenuOpen) return;
        const onPointerDown = (ev: PointerEvent) => {
            const el = vipMenuRef.current;
            if (!el) return;
            if (!el.contains(ev.target as Node)) {
                setVipMenuOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [vipMenuOpen]);

    useEffect(() => {
        if (!adminModalPreviewMenuOpen) return;
        const onPointerDown = (ev: PointerEvent) => {
            const el = adminModalPreviewMenuRef.current;
            if (!el) return;
            if (!el.contains(ev.target as Node)) {
                setAdminModalPreviewMenuOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [adminModalPreviewMenuOpen]);

    useEffect(() => {
        if (profileTab !== 'home') setAdminModalPreviewMenuOpen(false);
    }, [profileTab]);

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const nextMonth = new Date(year, month + 1, 1);
            const diff = nextMonth.getTime() - now.getTime();

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTowerTimeLeft(t('timeDaysHours', { days, hours }));
        };
        calculateTime();
        const interval = setInterval(calculateTime, 60 * 60 * 1000); // Update every hour
        return () => clearInterval(interval);
    }, []);

    // Get guild info: context(guilds+user.guildId) 또는 GET_GUILD_INFO 성공 시 저장한 길드 (새로고침 시 guildId가 늦게 올 수 있음)
    const [checkedGuildFromApi, setCheckedGuildFromApi] = useState<Guild | null>(null);
    const guildInfo = useMemo(() => {
        const gid = currentUserWithStatus?.guildId;
        if (!gid) return null;
        const fromState = guilds[gid];
        if (fromState) return fromState;
        if (checkedGuildFromApi?.id === gid) return checkedGuildFromApi;
        return null;
    }, [currentUserWithStatus?.guildId, guilds, checkedGuildFromApi]);

    useEffect(() => {
        if (currentUserWithStatus && !currentUserWithStatus.guildId) {
            setCheckedGuildFromApi(null);
        }
    }, [currentUserWithStatus?.guildId, currentUserWithStatus?.id]);
    
    // 길드 로딩 상태: 확인이 끝나기 전에는 항상 빈칸만 표시(버튼 노출 방지)
    const [guildLoadingFailed, setGuildLoadingFailed] = useState(false);
    const [guildCheckDone, setGuildCheckDone] = useState(false); // true가 되어야 길드/버튼 중 하나 표시
    const hasLoadedGuildRef = useRef<Set<string>>(new Set());
    const hasCheckedGuildRef = useRef(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevMeetsGuildLevelRef = useRef<boolean | null>(null);

    useEffect(() => {
        const p = prevMeetsGuildLevelRef.current;
        if (p === false && meetsGuildLevelForFeatures) {
            hasCheckedGuildRef.current = false;
            setGuildCheckDone(false);
        }
        prevMeetsGuildLevelRef.current = meetsGuildLevelForFeatures;
    }, [meetsGuildLevelForFeatures]);

    // 길드 정보 확인 (초기 로딩 시 한 번만 실행)
    // guildCheckDone은 '길드 있음' 또는 '가입한 길드 없음'이 확실할 때만 true → 그 전에는 버튼 노출 안 함
    useEffect(() => {
        if (hasCheckedGuildRef.current) return;
        const u = currentUserWithStatus;
        if (!u || !handlers?.handleAction) return;

        if (!meetsGuildLevelForFeatures && !u.guildId) {
            hasCheckedGuildRef.current = true;
            setGuildCheckDone(true);
            setGuildLoadingFailed(false);
            setCheckedGuildFromApi(null);
            return;
        }

        const checkGuild = async () => {
            setGuildLoadingFailed(false);
            
            try {
                const result: any = await handlers.handleAction({ type: 'GET_GUILD_INFO' });
                hasCheckedGuildRef.current = true;
                
                if (result?.clientResponse?.guild) {
                    const g = result.clientResponse.guild;
                    setCheckedGuildFromApi(g);
                    setGuildLoadingFailed(false);
                    setGuildCheckDone(true);
                } else if (result?.error && (result.error.includes('가입한 길드가 없습니다') || result.error.includes('길드를 찾을 수 없습니다'))) {
                    setCheckedGuildFromApi(null);
                    setGuildLoadingFailed(true);
                    setGuildCheckDone(true);
                } else {
                    setCheckedGuildFromApi(null);
                    setGuildLoadingFailed(true);
                    // 그 외 오류는 완료 처리 안 함 → 계속 빈칸, 재요청 등으로 길드 올 수 있음
                }
            } catch (error) {
                console.error('[Profile] Failed to check guild:', error);
                hasCheckedGuildRef.current = true;
                setCheckedGuildFromApi(null);
                setGuildLoadingFailed(true);
                // 네트워크 등 오류 시에도 완료 처리 안 함 → 빈칸 유지
            }
        };
        
        void checkGuild();
    }, [handlers, currentUserWithStatus, meetsGuildLevelForFeatures]);
    
    // 다른 경로(두 번째 useEffect 등)로 guildInfo가 들어오면 그때 완료 처리해서 길드 표시
    useEffect(() => {
        if (guildInfo && !guildCheckDone) setGuildCheckDone(true);
    }, [guildInfo, guildCheckDone]);
    
    // 길드에 소속되어 있는데 길드 정보가 없으면 즉시 가져오기 (한 번만 실행)
    useEffect(() => {
        const guildId = currentUserWithStatus?.guildId;
        if (!meetsGuildLevelForFeatures && !guildId) {
            return;
        }
        if (!guildId) {
            // guildId가 없어도 이미 확인했으면 더 이상 처리하지 않음
            if (hasCheckedGuildRef.current) {
                return;
            }
            return;
        }
        
        // 이미 로드 시도한 길드 ID는 다시 시도하지 않음
        if (hasLoadedGuildRef.current.has(guildId)) {
            // 길드 정보가 여전히 없으면 로딩 실패로 간주
            if (!guilds[guildId]) {
                setGuildLoadingFailed(true);
            }
            return;
        }
        
        // 길드 정보가 없으면 로드 시도 (guilds 객체는 의존성에서 제거하여 무한 루프 방지)
        if (!guilds[guildId]) {
            hasLoadedGuildRef.current.add(guildId);
            setGuildLoadingFailed(false);
            
            // 타임아웃 설정 (5초 후 실패로 간주)
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
            loadingTimeoutRef.current = setTimeout(() => {
                if (!guilds[guildId]) {
                    setGuildLoadingFailed(true);
                }
            }, 5000);
            
            handlers.handleAction({ type: 'GET_GUILD_INFO' }).then((result: any) => {
                if (result?.error) {
                    // "가입한 길드가 없습니다" 또는 "길드를 찾을 수 없습니다" 오류는 로딩 실패로 간주
                    if (result.error.includes('가입한 길드가 없습니다') || result.error.includes('길드를 찾을 수 없습니다')) {
                        setGuildLoadingFailed(true);
                    }
                } else if (result?.clientResponse?.guild) {
                    // 길드 정보가 로드되었으면 로딩 실패 상태 해제
                    setGuildLoadingFailed(false);
                }
                if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current);
                }
            }).catch(() => {
                setGuildLoadingFailed(true);
                if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current);
                }
            });
        } else {
            setGuildLoadingFailed(false);
        }
        
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserWithStatus?.guildId, meetsGuildLevelForFeatures]);
    
    if (!currentUserWithStatus) return null;

    const { inventory, stats, nickname, avatarId, borderId } = currentUserWithStatus;
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    const equippedItems = useMemo(() => {
        return (inventory || []).filter(item => item.isEquipped);
    }, [inventory]);

    const aggregatedStats = useMemo(() => {
        const strategic = { wins: 0, losses: 0 };
        const playful = { wins: 0, losses: 0 };
        if (stats) {
            for (const mode of SPECIAL_GAME_MODES) {
                const gameStats = stats[mode.mode];
                if (gameStats) {
                    strategic.wins += gameStats.wins ?? 0;
                    strategic.losses += gameStats.losses ?? 0;
                }
            }
            for (const mode of PLAYFUL_GAME_MODES) {
                const gameStats = stats[mode.mode];
                if (gameStats) {
                    playful.wins += gameStats.wins ?? 0;
                    playful.losses += gameStats.losses ?? 0;
                }
            }
        }
        return { strategic, playful };
    }, [stats]);

    const pairArenaHomeSlots = useMemo(() => {
        const u = currentUserWithStatus;
        const trainingSlots = normalizePairPetTrainingSlots(u.pairPetTrainingSlots);
        let trainUsed = 0;
        let trainOpen = 0;
        for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i++) {
            if (isPairTrainingSlotUnlocked(u, i)) trainOpen++;
            if (trainingSlots[i]) trainUsed++;
        }
        const hatchSessions = normalizePairPetHatcherySessions(u.pairPetHatcherySessions);
        let hatchUsed = 0;
        let hatchOpen = canUsePairHatcherySlot(u, PAIR_HATCHERY_MAIN_SLOT_INDEX) ? 1 : 0;
        if (canUsePairHatcherySlot(u, PAIR_HATCHERY_VIP_SLOT_INDEX)) hatchOpen += 1;
        for (let i = 0; i < hatchSessions.length; i += 1) {
            if (hatchSessions[i]) hatchUsed += 1;
        }
        const ps = u.stats?.['pair' as keyof typeof u.stats] as { wins?: number; losses?: number } | undefined;
        return {
            trainUsed,
            trainOpen,
            hatchUsed,
            hatchOpen,
            pairWins: ps?.wins ?? 0,
            pairLosses: ps?.losses ?? 0,
        };
    }, [currentUserWithStatus]);
    
    const totalMannerScore = getMannerScore(currentUserWithStatus);
    const mannerRank = getMannerRank(totalMannerScore);
    
    const { coreStatBonuses, specialStatBonuses, mythicStatBonuses } = useMemo(() => calculateUserEffects(currentUserWithStatus), [currentUserWithStatus]);
    
    const hasSpecialBonuses = useMemo(() => Object.values(specialStatBonuses).some(bonus => bonus.flat > 0 || bonus.percent > 0), [specialStatBonuses]);
    const hasMythicBonuses = useMemo(() => Object.values(mythicStatBonuses).some(bonus => bonus.flat > 0), [mythicStatBonuses]);

    const aggregatedMythicStats = useMemo(() => {
        const toN = (v: unknown) => {
            const x = Number(v);
            return Number.isFinite(x) ? x : 0;
        };
        const aggregated: Record<MythicStat, { count: number, totalValue: number }> = {} as any;
        for (const key of Object.values(MythicStat)) {
            aggregated[key] = { count: 0, totalValue: 0 };
        }
        equippedItems.forEach(item => {
            item.options?.mythicSubs?.forEach(sub => {
                const key = sub.type as MythicStat;
                if (aggregated[key]) {
                    aggregated[key].count++;
                    aggregated[key].totalValue += toN(sub.value);
                }
            });
        });
        return aggregated;
    }, [equippedItems]);

    const combinedLevel = currentUserWithStatus.userLevel;
    const levelPoints = (currentUserWithStatus.userLevel - 1) * 2;
    const bonusPoints = currentUserWithStatus.bonusStatPoints || 0;
    const totalPoints = levelPoints + bonusPoints;

    const spentPoints = useMemo(() => {
        return Object.values(currentUserWithStatus.spentStatPoints || {}).reduce((sum, points) => sum + points, 0);
    }, [currentUserWithStatus.spentStatPoints]);
    const availablePoints = totalPoints - spentPoints;

    const mergedArena = useMemo(() => mergeArenaEntranceAvailability(arenaEntranceAvailability), [arenaEntranceAvailability]);
    const serverArena = arenaEntranceFromServer;
    const arenaAdminBypass = isClientAdmin(currentUserWithStatus);
    const tryArenaEnter = useCallback(
        (key: ArenaEntranceKey, fn: () => void) => {
            if (arenaAdminBypass || mergedArena[key]) fn();
            else if (!serverArena[key]) window.alert(ARENA_ENTRANCE_CLOSED_MESSAGE[key]);
            else window.alert(USER_PROGRESSION_ARENA_BLOCK_MESSAGE[key] ?? ARENA_ENTRANCE_CLOSED_MESSAGE[key]);
        },
        [arenaAdminBypass, mergedArena, serverArena],
    );
    
    const getArenaLobbyLockReason = useCallback(
        (key: 'strategicLobby' | 'playfulLobby') => {
            if (arenaAdminBypass || mergedArena[key]) return null;
            if (!serverArena[key]) return t('maintenance');
            const combinedLevel = currentUserWithStatus.userLevel;
            return t('combinedLevelRequired', { current: combinedLevel, required: PVP_LOBBIES_MIN_COMBINED_LEVEL });
        },
        [arenaAdminBypass, mergedArena, serverArena, currentUserWithStatus.userLevel, t],
    );
    const getArenaEntryLockReason = useCallback(
        (key: 'tower' | 'adventure' | 'championship' | 'pairLobby') => {
            if (arenaAdminBypass || mergedArena[key]) return null;
            if (!serverArena[key]) return t('maintenance');
            if (key === 'pairLobby') return t('entryBlocked');
            if (key === 'championship') return t('abilityRequired', { total: CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL });
            const cleared = Array.isArray(currentUserWithStatus.clearedSinglePlayerStages)
                ? new Set(currentUserWithStatus.clearedSinglePlayerStages)
                : new Set<string>();
            if (key === 'tower') {
                return cleared.has(TOWER_ENTRANCE_REQUIRED_STAGE_ID) ? null : t('intro10Required');
            }
            return cleared.has(ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID) ? null : t('intro20Required');
        },
        [arenaAdminBypass, mergedArena, serverArena, currentUserWithStatus.clearedSinglePlayerStages, t],
    );

    const onSelectArenaIntent = (intent: 'pvp' | 'ai') => {
        tryArenaEnter('strategicLobby', () => {
            window.location.hash = arenaLobbyHash({ intent, channel: 'strategic' });
        });
    };
    const onSelectTournamentLobby = () => tryArenaEnter('championship', () => { window.location.hash = '#/tournament'; });
    const onSelectSinglePlayerLobby = () => tryArenaEnter('singleplayer', () => { window.location.hash = '#/singleplayer'; });

    const aiLobbyRecordByKind = useMemo(() => {
        const strategic = sumLobbyAiMatchRecordFromStats(stats, 'strategic');
        const pair = readPairArenaAiMatchRecord(stats as Record<string, { wins?: number; losses?: number }>);
        const playful = sumLobbyAiMatchRecordFromStats(stats, 'playful');
        return { strategic, pair, playful };
    }, [stats]);

    const openEquippedPairPetDetailFromProfileHome = useCallback(() => {
        const u = currentUserWithStatus;
        if (!u?.equippedPairPetTemplateId) return;
        const row = getEquippedPairPetInventoryRow(u);
        if (row) handlers.openPairPetDetailModal(row, 'view');
    }, [currentUserWithStatus, handlers]);

    const focusPairPetInventoryFromProfileHome = useCallback(() => {
        tryArenaEnter('pairLobby', () => {
            try {
                sessionStorage.setItem('sudamr_pair_lobby_open_pet_tab', '1');
            } catch {
                // ignore
            }
            window.location.hash = '#/pvp/pair';
        });
    }, [tryArenaEnter]);

    const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const presetIndex = Number(event.target.value);
        setSelectedPreset(presetIndex);
        const selectedPresetData = presets[presetIndex];
        // 프리셋이 있으면 적용하고, 없으면(빈 프리셋) 빈 장비 세트를 적용
        handlers.applyPreset(selectedPresetData || { name: t('presetDefault', { index: presetIndex + 1 }), equipment: {} });
    };

    const overallTiers = useMemo(() => {
        const statsMap = (currentUserWithStatus.stats ?? {}) as NonNullable<User['stats']>;
        const strategicBlock = readStrategicRankedBlock(statsMap);
        const pairBlock = readPairRankedBlock(statsMap);

        const strategicDr = currentUserWithStatus.dailyRankings?.strategic;
        const strategicTotalGames = strategicBlock.wins + strategicBlock.losses;
        let strategicScore: number;
        let strategicRank: number;
        if (strategicDr && typeof strategicDr.rank === 'number') {
            strategicScore =
                RANKED_ELO_BASE_SCORE + (typeof strategicDr.score === 'number' ? strategicDr.score : 0);
            strategicRank = strategicDr.rank;
        } else {
            strategicScore = strategicBlock.rankingScore;
            strategicRank = 99_999;
        }
        const strategicTier = getTier(strategicScore, strategicRank, strategicTotalGames);

        const pairDr = currentUserWithStatus.dailyRankings?.pair;
        const pairTotalGames = pairBlock.wins + pairBlock.losses;
        let pairScore: number;
        let pairRank: number;
        if (pairDr && typeof pairDr.rank === 'number') {
            pairScore = RANKED_ELO_BASE_SCORE + (typeof pairDr.score === 'number' ? pairDr.score : 0);
            pairRank = pairDr.rank;
        } else {
            pairScore = pairBlock.rankingScore;
            pairRank = 99_999;
        }
        const pairTier = getTier(pairScore, pairRank, pairTotalGames);

        const bestScore = Math.max(strategicScore, pairScore);
        const bestTier = pairScore > strategicScore ? pairTier : strategicTier;

        return {
            strategicTier,
            strategicIntegratedScore: Math.round(strategicScore),
            strategicWins: strategicBlock.wins,
            strategicLosses: strategicBlock.losses,
            pairTier,
            pairSeasonScore: Math.round(pairScore),
            pairWins: pairBlock.wins,
            pairLosses: pairBlock.losses,
            bestScore: Math.round(bestScore),
            bestTier,
        };
    }, [currentUserWithStatus]);
    
    const coreStatAbbreviations: Record<CoreStat, string> = useMemo(() => ({
        [CoreStat.Concentration]: t('coreStats.concentration'),
        [CoreStat.ThinkingSpeed]: t('coreStats.thinkingSpeed'),
        [CoreStat.Judgment]: t('coreStats.judgment'),
        [CoreStat.Calculation]: t('coreStats.calculation'),
        [CoreStat.CombatPower]: t('coreStats.combatPower'),
        [CoreStat.Stability]: t('coreStats.stability'),
    }), [t]);
    
    const specialStatAbbreviations: Record<SpecialStat, string> = useMemo(() => ({
        [SpecialStat.ActionPointMax]: t('specialStats.actionPointMax'),
        [SpecialStat.StrategyXpBonus]: t('specialStats.strategyXpBonus'),
        [SpecialStat.PlayfulXpBonus]: t('specialStats.playfulXpBonus'),
        [SpecialStat.ChampionshipVenueAllStats]: t('specialStats.championshipVenueAllStats'),
        [SpecialStat.GuildBossBattleAllStats]: t('specialStats.guildBossBattleAllStats'),
    }), [t]);
    
    const bonusNum = (v: unknown): number => {
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
    };

    const mainOptionBonuses = useMemo(() => {
        const bonuses: Record<string, { flat: number; percent: number }> = {};
        equippedItems.forEach(item => {
            if (item.options?.main) {
                const main = item.options.main;
                const key = main.type as string;
                if (!bonuses[key]) {
                    bonuses[key] = { flat: 0, percent: 0 };
                }
                const mv = bonusNum(main.value);
                if (main.isPercentage) bonuses[key].percent += mv;
                else bonuses[key].flat += mv;
            }
        });
        return bonuses;
    }, [equippedItems]);

    const combatSubOptionBonuses = useMemo(() => {
        const bonuses: Record<string, { flat: number; percent: number }> = {};
        equippedItems.forEach(item => {
            if (item.options?.combatSubs) {
                item.options.combatSubs.forEach(sub => {
                    const key = sub.type as string;
                    if (!bonuses[key]) {
                        bonuses[key] = { flat: 0, percent: 0 };
                    }
                    const sv = bonusNum(sub.value);
                    if (sub.isPercentage) bonuses[key].percent += sv;
                    else bonuses[key].flat += sv;
                });
            }
        });
        return bonuses;
    }, [equippedItems]);
    
    /** 장착 그리드·프리셋: 네이티브 홈은 가로(슬롯+프리셋)로 전체 폭 사용 */
    const EQUIPMENT_BAND_MAX_CLASS = readableHome ? '' : 'max-w-[275px]';

    /** 프로필 스택(모바일·PC 좌열) 패널 내부 패딩·간격 — 뷰포트 높이에 비례 */
    const profileStackPanelPad = 'px-[clamp(0.38rem,1.55vw,0.58rem)] py-[clamp(0.28rem,1.15dvh,0.52rem)]';
    /** PC 홈 좌열 프로필 칸만 좌우 여백 축소 (레벨·매너·길드 박스 폭 확보) */
    const profileStackPanelPadProfilePc =
        'px-[clamp(0.18rem,0.75vw,0.38rem)] py-[clamp(0.28rem,1.15dvh,0.52rem)]';
    /** 네이티브 홈 좌열: 한 단계 더 촘촘히 */
    const profileStackPanelPadNativeHome =
        'px-[clamp(0.1rem,0.55vw,0.28rem)] py-[clamp(0.18rem,0.85dvh,0.4rem)]';
    const profileStackPanelGap = 'gap-[clamp(0.25rem,0.85dvh,0.4rem)]';
    /** 스크롤 영역: 가로는 꽉 채우고 세로는 중앙 정렬 */
    const profileStackScrollInnerClass =
        'flex min-h-full w-full flex-col items-stretch justify-center gap-0 py-0.5';

    const ProfileGuildPanelContent = useMemo(() => {
        const nh = isNativeMobile && !readableHome;
        const ch = nativeCompactHome;
        return (
            <div className="w-full min-w-0 overflow-hidden rounded-lg border border-zinc-600/80 bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-inner">
                <div className={nh ? 'min-h-0 px-1 py-0.5' : ch ? 'min-h-0 p-0.5 sm:p-0.5' : 'min-h-0 p-0.5 sm:p-1'}>
                    {!guildCheckDone ? (
                        <div className="w-full min-h-[32px] p-1.5" aria-hidden="true" />
                    ) : !meetsGuildLevelForFeatures && !currentUserWithStatus.guildId ? (
                        <div
                            className={`px-2 py-1.5 text-center leading-snug text-zinc-300 ${
                                nh ? 'text-[10px]' : ch ? 'text-[10px] sm:text-[11px]' : readableHome ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                            }`}
                        >
                            {t('guildLockedLevel', { level: MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES })}
                        </div>
                    ) : guildInfo ? (
                        <div className={`flex min-w-0 flex-nowrap items-center gap-1.5 px-0.5 py-0.5 ${ch ? 'sm:gap-1.5 sm:px-0.5 sm:py-0.5' : 'sm:gap-2 sm:px-1 sm:py-1'}`}>
                            {guildInfo.icon ? (
                                <GuildMark
                                    icon={guildInfo.icon}
                                    alt={guildInfo.name}
                                    size={ch ? 32 : 40}
                                    tone="plain"
                                />
                            ) : (
                                <div
                                    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-color bg-secondary/50 ${
                                        ch ? 'h-8 w-8' : readableHome ? 'h-9 w-9 sm:h-10 sm:w-10' : nh ? 'h-9 w-9' : 'h-9 w-9 sm:h-10 sm:w-10'
                                    }`}
                                >
                                    <img src="/images/button/guild.webp" alt={t('guildLocked')} className={`object-contain ${nh ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8'}`} />
                                </div>
                            )}
                            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-1.5">
                                <span
                                    className={`shrink-0 rounded-md border border-amber-500/45 bg-amber-950/45 font-semibold leading-tight text-amber-100 ${
                                        nh ? 'px-1.5 py-0 text-[10px]' : ch ? 'px-1.5 py-0 text-[10px] sm:text-[11px]' : readableHome ? 'px-1.5 py-0.5 text-xs sm:px-2 sm:text-sm' : 'px-1.5 py-0.5 text-[11px] sm:text-xs'
                                    }`}
                                >
                                    Lv.{guildInfo.level || 1}
                                </span>
                                <div
                                    className="min-w-0 truncate font-semibold text-white"
                                    style={{
                                        fontSize: nh
                                            ? 'clamp(0.78rem, 2.1vw, 0.9rem)'
                                            : ch
                                              ? 'clamp(0.72rem, 1.75vw, 0.88rem)'
                                              : readableHome
                                                ? 'clamp(0.9rem, 1.9vw, 1.05rem)'
                                                : 'clamp(0.82rem, 1.6vw, 0.95rem)',
                                    }}
                                    title={guildInfo.name}
                                >
                                    {guildInfo.name}
                                </div>
                            </div>
                            {meetsGuildLevelForFeatures ? (
                                <Button
                                    onClick={() => {
                                        window.location.hash = '#/guild';
                                    }}
                                    colorScheme="none"
                                    className={`!shrink-0 !whitespace-nowrap rounded-md border border-amber-500/55 bg-gradient-to-b from-zinc-700 to-zinc-800 !font-semibold !leading-none !text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_rgba(0,0,0,0.35)] hover:border-amber-400/70 hover:from-zinc-600 hover:to-zinc-700 hover:!text-white ${
                                        ch
                                            ? '!px-2 !py-1 !text-[10px] sm:!text-[11px]'
                                            : readableHome
                                              ? '!px-2.5 !py-1.5 !text-xs sm:!text-sm'
                                              : nh
                                                ? '!px-2 !py-1 !text-[10px]'
                                                : '!px-2 !py-1 !text-[10px] sm:!px-2.5 sm:!py-1 sm:!text-[11px]'
                                    }`}
                                    title={t('guildHome')}
                                >
                                    {t('guildEnter')}
                                </Button>
                            ) : (
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <Button
                                        type="button"
                                        disabled
                                        colorScheme="none"
                                        className={`!shrink-0 cursor-not-allowed !whitespace-nowrap rounded-md border border-zinc-600 bg-zinc-800/80 !text-zinc-400 ${
                                            nh ? '!px-2 !py-1 !text-[10px]' : '!px-2.5 !py-1 !text-[11px] sm:!text-xs'
                                        }`}
                                        title={t('guildLevelHint', { level: MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES })}
                                    >
                                        {t('lock')}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (!window.confirm(t('guildLeaveConfirm'))) return;
                                            void handlers.handleAction({ type: 'LEAVE_GUILD' });
                                        }}
                                        colorScheme="none"
                                        className={`!shrink-0 !whitespace-nowrap rounded-md border border-rose-500/50 bg-rose-950/40 !font-semibold !text-rose-100 hover:border-rose-400 ${
                                            nh ? '!px-2 !py-0.5 !text-[10px]' : '!px-2 !py-1 !text-[10px] sm:!text-xs'
                                        }`}
                                    >
                                        {t('guildLeave')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : guildLoadingFailed || (meetsGuildLevelForFeatures && !currentUserWithStatus.guildId) ? (
                        meetsGuildLevelForFeatures ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <div className="flex min-w-0 flex-1 flex-nowrap gap-2">
                                    <Button
                                        onClick={() => setIsGuildCreateModalOpen(true)}
                                        colorScheme="none"
                                        className={`min-w-0 flex-1 justify-center whitespace-nowrap !py-0.5 rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 ${nh ? '!text-[10px]' : ''}`}
                                    >
                                        {t('guildCreate')}
                                    </Button>
                                    <Button
                                        onClick={() => setIsGuildJoinModalOpen(true)}
                                        colorScheme="none"
                                        className={`min-w-0 flex-1 justify-center whitespace-nowrap !py-0.5 rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 ${nh ? '!text-[10px]' : ''}`}
                                    >
                                        {t('guildJoin')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`px-2 py-1.5 text-center leading-snug text-zinc-300 ${
                                    nh ? 'text-[10px]' : ch ? 'text-[10px] sm:text-[11px]' : readableHome ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                                }`}
                            >
                                {t('guildLevelNotice', {
                                    level: MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES,
                                    current: getCombinedStrategyPlayfulLevel(currentUserWithStatus),
                                })}
                            </div>
                        )
                    ) : (
                        <div className="w-full min-h-[32px] p-1.5" aria-hidden="true" />
                    )}
                </div>
            </div>
        );
    }, [
        currentUserWithStatus,
        handlers,
        guildInfo,
        guildCheckDone,
        guildLoadingFailed,
        isNativeMobile,
        readableHome,
        meetsGuildLevelForFeatures,
        nativeCompactHome,
    ]);

    const coreStatComputeBundle = useMemo(() => {
        const finalByStat = {} as Record<CoreStat, number>;
        const baseByStat = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            const baseStats = currentUserWithStatus.baseStats || {};
            const spentStatPoints = currentUserWithStatus.spentStatPoints || {};
            const baseValue = (baseStats[stat] || 0) + (spentStatPoints[stat] || 0);
            const bonusInfo = coreStatBonuses[stat] || { percent: 0, flat: 0 };
            const flatBonus = Number(bonusInfo.flat) || 0;
            const percentBonus = Number(bonusInfo.percent) || 0;
            const finalValue = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
            finalByStat[stat] = isNaN(finalValue) ? 0 : finalValue;
            baseByStat[stat] = baseValue;
        }
        const badukAbilityTotal = Math.min(
            BADUK_ABILITY_TOTAL_CAP,
            Object.values(finalByStat).reduce((sum, v) => {
                const safeValue = Number.isFinite(v) ? Math.max(0, v) : 0;
                return sum + Math.min(BADUK_ABILITY_STAT_CAP, safeValue);
            }, 0),
        );
        return { finalByStat, baseByStat, badukAbilityTotal };
    }, [currentUserWithStatus, coreStatBonuses]);

    const EquipmentPanelContent = useMemo(() => {
        const nh = isNativeMobile && !readableHome;
        if (homeLeftColumnMerge) {
            /** 폭은 상위 `w-[min(18rem,100%)]` 열이 담당 — 여기서 max-w·min-w-0로 다시 줄이지 않음 */
            const ch = nativeCompactHome;
            const homeEquipGrid = ch
                ? 'grid w-full grid-cols-3 gap-x-1 gap-y-0.5 auto-rows-auto sm:gap-x-1.5 sm:gap-y-1'
                : 'grid w-full grid-cols-3 gap-1.5 auto-rows-auto sm:gap-2';
            /** 네이티브 홈: 슬롯 칸을 살짝만 줄여 탭 영역에 세로 여유 확보 */
            const mergeEquipScale = ch ? 0.82 : 1.18;
            const mergeSlotCapClass = ch ? 'mx-auto w-full max-w-[min(100%,4.55rem)]' : 'w-full';
            return (
                <div className="flex min-h-0 w-full flex-col items-stretch gap-1 overflow-x-hidden overflow-y-visible">
                    <div className={`${homeEquipGrid} min-w-0`}>
                        {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map((slot) => {
                            const item = equippedItems.find((it) => it.slot === slot);
                            return (
                                <div key={slot} className="flex w-full items-center justify-center">
                                    <div className={mergeSlotCapClass}>
                                        <EquipmentSlotDisplay
                                            slot={slot}
                                            item={item}
                                            onClick={() => item && handlers.openViewingItem(item, true)}
                                            scaleFactor={mergeEquipScale}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="relative z-20 flex w-full min-w-0 flex-row items-stretch gap-1.5 overflow-visible border-t border-amber-500/25 px-0.5 pt-1.5">
                        <select
                            value={selectedPreset}
                            onChange={handlePresetChange}
                            className={`min-h-[26px] min-w-0 flex-1 rounded-md border border-color bg-secondary px-1.5 py-0.5 text-[11px] shadow-sm focus:border-accent focus:ring-1 focus:ring-accent sm:min-h-[28px] sm:text-xs`}
                            title={presets?.[selectedPreset]?.name}
                        >
                            {presets &&
                                presets.map((preset, index) => (
                                    <option key={index} value={index}>
                                        {preset.name}
                                    </option>
                                ))}
                        </select>
                        <Button
                            onClick={handlers.openEquipmentEffectsModal}
                            colorScheme="none"
                            className={`!shrink-0 !whitespace-nowrap !justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white ${ch ? '!px-1.5 !py-0.5 !text-[10px] sm:!text-[11px]' : '!px-2 !py-0.5 !text-[10px] sm:!text-xs'}`}
                        >
                            {t('equipmentEffects')}
                        </Button>
                    </div>
                </div>
            );
        }
        /** 모바일 홈 세로형: 2행이 1fr로 늘어나며 슬롯 간 세로 간격이 들쭉날쭉해지지 않도록 고정 gap·auto 행 + 가로 중앙 */
        const mobileVerticalSlotGridClass =
            'mx-auto grid w-full max-w-[min(100%,18rem)] grid-cols-3 gap-2 auto-rows-auto [&>*]:min-w-0';
        const ch = nativeCompactHome;
        const pcHomeSlotGridClass = ch
            ? 'grid min-h-0 min-w-0 w-full flex-1 grid-cols-3 grid-rows-[repeat(2,minmax(0,1fr))] gap-[clamp(0.08rem,0.42dvh,0.22rem)] [&>*]:min-h-0 [&>*]:min-w-0'
            : 'grid min-h-0 min-w-0 w-full flex-1 grid-cols-3 grid-rows-[repeat(2,minmax(0,1fr))] gap-[clamp(0.15rem,0.55dvh,0.3rem)] [&>*]:min-h-0 [&>*]:min-w-0';
        const slotGrid = (
            <div className={readableHome ? pcHomeSlotGridClass : mobileVerticalSlotGridClass}>
                {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                    const item = equippedItems.find(it => it.slot === slot);
                    return (
                        <div
                            key={slot}
                            className={
                                readableHome
                                    ? 'flex min-h-0 min-w-0 h-full w-full items-center justify-center'
                                    : 'flex w-full min-w-0 items-center justify-center'
                            }
                        >
                            <EquipmentSlotDisplay
                                slot={slot}
                                item={item}
                                onClick={() => item && handlers.openViewingItem(item, true)}
                                compact
                                scaleFactor={readableHome ? (ch ? 0.9 : 1.18) : nh ? 1.05 : 1.18}
                            />
                        </div>
                    );
                })}
            </div>
        );
        const presetControls = (
            <div className="relative z-20 flex w-full min-w-0 flex-row items-stretch gap-1.5 overflow-visible px-0.5 py-0.5">
                <select
                    value={selectedPreset}
                    onChange={handlePresetChange}
                    className={`min-h-[28px] min-w-0 flex-1 rounded-md border border-color bg-secondary px-1.5 py-0.5 shadow-sm focus:border-accent focus:ring-1 focus:ring-accent ${
                        readableHome ? (ch ? 'min-h-[26px] text-xs' : 'text-sm') : nh ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                    }`}
                    title={presets?.[selectedPreset]?.name}
                >
                    {presets && presets.map((preset, index) => (
                        <option key={index} value={index}>
                            {preset.name}
                        </option>
                    ))}
                </select>
                <Button
                    onClick={handlers.openEquipmentEffectsModal}
                    colorScheme="none"
                    className={`!shrink-0 !whitespace-nowrap !justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white ${
                        readableHome ? (ch ? '!px-2 !py-0.5 !text-[11px]' : '!px-2.5 !py-1 !text-sm') : '!px-2 !py-0.5 !text-[11px] sm:!text-xs'
                    }`}
                >
                    {t('equipmentEffects')}
                </Button>
            </div>
        );
        return (
            <div
                className={`flex h-full min-h-0 w-full min-w-0 flex-col ${
                    nh ? 'max-w-none' : EQUIPMENT_BAND_MAX_CLASS ? `${EQUIPMENT_BAND_MAX_CLASS} mx-auto w-full` : 'w-full'
                }`}
            >
                {readableHome ? (
                    <div className={`flex min-h-0 w-full flex-1 flex-row items-stretch ${ch ? 'gap-1' : 'gap-1.5'}`}>
                        <div className="flex min-h-0 min-w-0 flex-[1.15] flex-col justify-center">{slotGrid}</div>
                        <div
                            className={`relative z-20 flex min-h-0 shrink-0 flex-col justify-center overflow-visible border-l border-amber-500/25 pl-2 pr-0.5 ${ch ? 'w-[min(34%,6.25rem)] min-w-[4.75rem] max-w-[6.75rem]' : 'w-[min(36%,7.25rem)] min-w-[5.5rem] max-w-[8rem]'}`}
                        >
                            {presetControls}
                        </div>
                    </div>
                ) : (
                    <div
                        className={`flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 ${
                            nh ? '' : profileStackPanelGap
                        }`}
                    >
                        {slotGrid}
                        <div className="relative z-20 mx-auto flex w-full max-w-[min(100%,18rem)] min-w-0 shrink-0 items-stretch gap-1.5 overflow-visible px-0.5 border-t border-color/40 pt-2">
                            <select
                                value={selectedPreset}
                                onChange={handlePresetChange}
                                className="min-h-[26px] min-w-0 flex-1 rounded-md border border-color bg-secondary px-1.5 py-0.5 text-xs shadow-sm focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm"
                                title={presets?.[selectedPreset]?.name}
                            >
                                {presets && presets.map((preset, index) => (
                                    <option key={index} value={index}>
                                        {preset.name}
                                    </option>
                                ))}
                            </select>
                            <Button
                                onClick={handlers.openEquipmentEffectsModal}
                                colorScheme="none"
                                className="!shrink-0 !whitespace-nowrap !px-2 !py-0.5 !text-[11px] justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white sm:!text-xs"
                            >
                                {t('effects')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }, [
        equippedItems,
        selectedPreset,
        presets,
        handlers,
        isNativeMobile,
        readableHome,
        handlePresetChange,
        homeLeftColumnMerge,
        nativeCompactHome,
    ]);

    const ProfilePanelContent = useMemo(() => {
        const nh = isNativeMobile && !readableHome;
        const ch = nativeCompactHome;
        const homeMerge = homeLeftColumnMerge;
        return (
        <div
            className={`flex h-full min-h-0 w-full min-w-0 max-w-full flex-col ${
                readableHome ? (ch ? 'gap-[clamp(0.12rem,0.75dvh,0.28rem)]' : 'gap-[clamp(0.2rem,1.1dvh,0.42rem)]') : 'gap-[clamp(0.2rem,1dvh,0.5rem)]'
            }`}
        >
            <div className={`flex min-h-0 min-w-0 w-full flex-1 flex-row items-stretch ${nh ? 'gap-2' : ch ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
                <div
                    className={`relative flex shrink-0 flex-col items-center justify-center gap-0.5 self-stretch ${
                        readableHome
                            ? ch
                                ? 'w-[7rem] min-w-[6.5rem] max-w-[7.5rem]'
                                : 'w-[8.5rem] min-w-[7.875rem] max-w-[9.125rem] sm:w-[8.75rem] sm:min-w-[8.125rem] sm:max-w-[9.375rem]'
                            : 'w-[9.5rem] min-w-[8.75rem] max-w-[10.25rem]'
                    }`}
                >
                    <div className="relative rounded-full bg-gradient-to-br from-amber-200/70 via-amber-500/35 to-zinc-600/60 p-[3px] shadow-[0_10px_32px_-8px_rgba(0,0,0,0.55),0_0_28px_rgba(251,191,36,0.18)]">
                        <div className="relative rounded-full bg-zinc-950/90 p-[2px]">
                            <Avatar
                                userId={currentUserWithStatus.id}
                                userName={nickname}
                                size={readableHome ? (ch ? 62 : 78) : 82}
                                avatarUrl={avatarUrl}
                                borderUrl={borderUrl}
                                className="z-0"
                            />
                            <button
                                onClick={handlers.openProfileEditModal}
                                className={`absolute bottom-0 right-0 z-10 flex items-center justify-center rounded-full border-2 border-primary bg-secondary transition-transform hover:scale-110 hover:bg-tertiary active:scale-95 ${ch ? 'h-7 w-7 p-0.5' : 'h-8 w-8 p-1'}`}
                                title={t('editProfile')}
                            >
                                <span className={ch ? 'text-xs' : 'text-sm'}>✏️</span>
                                {!currentUserWithStatus.mbti && (
                                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500"></span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className={`w-full min-w-0 px-0.5 ${readableHome ? (ch ? 'mt-1 sm:mt-1' : 'mt-1.5 sm:mt-2') : 'mt-2 sm:mt-2'}`}>
                        <div
                            className={`w-full min-w-[6.25em] rounded-xl border border-indigo-400/35 bg-gradient-to-b from-indigo-950/90 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_20px_rgba(0,0,0,0.45)] ${
                                readableHome ? (ch ? 'px-1.5 py-1 sm:px-2 sm:py-1.5' : 'px-2 py-1.5 sm:px-2.5 sm:py-2') : 'px-1.5 py-1 sm:px-2'
                            }`}
                        >
                            <div className="flex justify-center">
                                <span
                                    className={`inline-flex max-w-full items-center gap-x-1.5 whitespace-nowrap rounded-md border border-indigo-400/45 bg-indigo-950 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:gap-x-2 ${
                                        readableHome
                                            ? ch
                                                ? 'px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-0.5 sm:text-[11px]'
                                                : 'px-2 py-1 text-xs sm:px-2.5 sm:py-1 sm:text-sm'
                                            : `px-1.5 py-px sm:px-2 sm:py-0.5 ${
                                                  nh ? 'text-[9px] sm:text-[10px]' : 'text-[9px] sm:text-[10px]'
                                              }`
                                    }`}
                                    title={currentUserWithStatus.mbti ? t('mbtiTitle', { value: currentUserWithStatus.mbti }) : t('mbtiUnsetTitle')}
                                >
                                    <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-indigo-200/85">MBTI</span>
                                    <span
                                        className={`min-w-0 truncate font-bold tracking-[0.06em] text-indigo-100 ${currentUserWithStatus.mbti ? 'uppercase tabular-nums' : 'font-semibold normal-case text-indigo-300/85'}`}
                                    >
                                        {currentUserWithStatus.mbti ? currentUserWithStatus.mbti : t('mbtiUnset')}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`flex min-h-0 min-w-0 w-full flex-1 flex-col justify-end ${ch ? 'gap-0.5' : 'gap-1'}`}>
                    <ProfileHomeIdentityHeader
                        user={currentUserWithStatus}
                        level={combinedLevel}
                        nickname={nickname}
                        isAdmin={currentUserWithStatus.isAdmin}
                        staffNicknameDisplayEligibility={currentUserWithStatus.staffNicknameDisplayEligibility}
                        compact={ch}
                        denseNative={nh}
                        userLevel={currentUserWithStatus.userLevel}
                        userXp={currentUserWithStatus.userXp}
                        xpDense={ch}
                        xpBumpText={nh && !ch}
                    />
                    <ProfileMannerSeal
                        score={totalMannerScore}
                        rank={mannerRank.rank}
                        rankColorClass={mannerRank.color}
                        compact={ch}
                        onOpenInfo={() => setShowMannerRankModal(true)}
                    />
                </div>
            </div>

            {!homeMerge && (
                <div className={`flex w-full shrink-0 flex-col items-stretch gap-1.5 sm:gap-2 ${nh ? 'mt-0.5 pt-0.5' : 'mt-0.5 pt-0.5'}`}>
                    <PairPetProfilePanel
                        currentUser={currentUserWithStatus}
                        currentUserId={currentUserWithStatus.id}
                        isBusy={false}
                        compact
                        onOpenEquippedPetDetail={openEquippedPairPetDetailFromProfileHome}
                        onFocusPetInventory={focusPairPetInventoryFromProfileHome}
                    />
                    {ProfileGuildPanelContent}
                </div>
            )}
        </div>
        );
    }, [
        currentUserWithStatus,
        handlers,
        mannerRank,
        totalMannerScore,
        combinedLevel,
        nickname,
        avatarUrl,
        borderUrl,
        isNativeMobile,
        readableHome,
        openEquippedPairPetDetailFromProfileHome,
        focusPairPetInventoryFromProfileHome,
        homeLeftColumnMerge,
        ProfileGuildPanelContent,
        nativeCompactHome,
    ]);

    const AbilityBadukBannerContent = useMemo(() => {
        const nh = isNativeMobile && !readableHome;
        const ch = nativeCompactHome;
        const badukAbilityTotal = coreStatComputeBundle.badukAbilityTotal;
        return readableHome ? (
            <div
                className={`relative w-full shrink-0 rounded-xl border border-amber-600/45 bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${
                    ch ? 'px-1.5 py-1 sm:px-2 sm:py-1.5' : 'px-2 py-1.5 sm:px-2.5 sm:py-2'
                }`}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" aria-hidden />
                <div className={`relative flex min-w-0 flex-nowrap items-center justify-between ${ch ? 'gap-1' : 'gap-1.5'}`}>
                    <div className={`flex min-w-0 items-baseline ${ch ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
                        <span
                            className={`shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text font-bold tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.22)] ${
                                ch ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                            }`}
                            title={t('coreStatsTotal')}
                        >
                            {t('badukAbility')}
                        </span>
                        <span
                            className={`min-w-0 font-mono font-black tabular-nums leading-none text-amber-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${
                                ch ? 'text-lg sm:text-xl' : 'text-2xl sm:text-[1.75rem]'
                            }`}
                            title={t('coreStatsTotal')}
                        >
                            {badukAbilityTotal}
                        </span>
                    </div>
                    <div className={`flex shrink-0 items-center ${ch ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
                        <span
                            className={`whitespace-nowrap font-medium text-amber-100/90 ${ch ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                            title={t('bonusPoints', { points: availablePoints })}
                        >
                            {t('bonus')} <span className="font-bold tabular-nums text-emerald-300">{availablePoints}</span>
                            <span className="text-amber-100/50">P</span>
                        </span>
                        <Button
                            onClick={handlers.openStatAllocationModal}
                            colorScheme="none"
                            className={`!shrink-0 !whitespace-nowrap !rounded-lg !border-2 !border-cyan-300/65 !bg-gradient-to-r !from-indigo-500 !via-violet-500 !to-fuchsia-500 !font-bold !text-white !shadow-[0_10px_26px_-10px_rgba(99,102,241,0.75)] hover:!brightness-110 ${
                                ch
                                    ? '!px-2 !py-1 !text-[11px] sm:!px-2.5 sm:!py-1 sm:!text-xs'
                                    : '!px-3 !py-1.5 !text-xs sm:!px-3.5 sm:!py-1.5 sm:!text-sm'
                            }`}
                        >
                            {t('allocate')}
                        </Button>
                    </div>
                </div>
            </div>
        ) : (
            <div
                className={`relative w-full max-w-[min(100%,24rem)] shrink-0 overflow-hidden rounded-xl border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 shadow-[0_10px_32px_-14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] sm:max-w-[min(100%,26rem)] ${nh ? 'px-[clamp(0.26rem,1.1vw,0.4rem)] py-[clamp(0.18rem,0.75dvh,0.34rem)] max-[760px]:px-[0.22rem] max-[760px]:py-[0.14rem] max-[680px]:px-[0.2rem] max-[680px]:py-[0.12rem]' : 'px-[clamp(0.38rem,1vw,0.55rem)] py-[clamp(0.28rem,1dvh,0.45rem)] sm:px-2.5 sm:py-2'}`}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" aria-hidden />
                <div className="relative flex w-full min-w-0 flex-row flex-wrap items-start gap-x-1.5 gap-y-0.5 sm:gap-x-2 md:gap-x-2.5 max-[760px]:gap-x-1 max-[760px]:gap-y-0.5 max-[680px]:gap-x-0.5">
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-start gap-x-0.5 gap-y-0 text-left sm:gap-x-1 md:gap-x-1.5">
                        <span
                            className={`shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text text-left font-bold tracking-tight text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.25)] ${nh ? 'text-sm' : 'text-sm sm:text-base md:text-lg'}`}
                        >
                            {t('badukAbility')}
                        </span>
                        <span
                            className={`min-w-0 bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text text-left font-mono font-black tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${nh ? 'text-[1.15rem]' : 'text-[1.2rem] sm:text-xl md:text-2xl'}`}
                            title={t('coreStatsTotal')}
                        >
                            {badukAbilityTotal}
                        </span>
                    </div>
                    <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-0.5 text-right sm:gap-1 max-[760px]:gap-0.5">
                        <span
                            className={`max-w-[min(9.6rem,58vw)] break-words font-medium text-amber-100/85 sm:max-w-[11rem] md:max-w-none ${nh ? 'text-[11px] sm:text-xs' : 'text-[11px] sm:text-xs md:text-sm'}`}
                            title={t('bonusPoints', { points: availablePoints })}
                        >
                            {t('bonus')} <span className="font-bold tabular-nums text-emerald-300">{availablePoints}</span>
                            <span className="text-amber-100/55">P</span>
                        </span>
                        <Button
                            onClick={handlers.openStatAllocationModal}
                            colorScheme="none"
                            className="!shrink-0 !whitespace-nowrap !rounded-lg !border-2 !border-cyan-300/65 !bg-gradient-to-r !from-indigo-500 !via-violet-500 !to-fuchsia-500 !font-bold !text-white !shadow-[0_10px_26px_-10px_rgba(99,102,241,0.75)] hover:!brightness-110 !px-2.5 !py-1 !text-[11px] sm:!px-2.5 sm:!py-1 sm:!text-xs"
                        >
                            {t('allocate')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }, [coreStatComputeBundle, handlers, availablePoints, isNativeMobile, readableHome, nativeCompactHome]);

    const AbilityCoreStatsGridContent = useMemo(() => {
        const { finalByStat, baseByStat } = coreStatComputeBundle;
        const ch = nativeCompactHome;
        const gridCols = homeLeftColumnMerge ? 'grid-cols-1' : 'grid-cols-3';
        return (
            <div className={`grid w-full min-w-0 shrink-0 ${gridCols} ${ch ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5'}`}>
                {CORE_STAT_RADAR_ORDER.map((stat) => {
                    const cap = BADUK_ABILITY_STAT_CAP;
                    const finalV = Number(finalByStat[stat]);
                    const safeFinal = Number.isFinite(finalV) ? finalV : 0;
                    const v = Math.min(cap, Math.max(0, Math.floor(safeFinal)));
                    const baseV = baseByStat[stat] ?? 0;
                    const bonus = safeFinal - baseV;
                    const bonusRounded = Math.round(bonus);
                    const hasBonus = bonusRounded > 0;
                    const label = CORE_STATS_DATA[stat]?.name ?? stat;
                    const mergedRow = homeLeftColumnMerge;
                    const statLabelClass =
                        mergedRow && ch
                            ? 'max-w-[58%] truncate text-left text-[11px] font-semibold leading-snug text-slate-300 sm:text-xs'
                            : mergedRow
                              ? 'max-w-[58%] truncate text-left text-[11px] font-semibold leading-snug text-slate-300 sm:text-xs'
                              : 'max-w-full truncate text-center text-[11px] font-semibold leading-snug text-slate-300 sm:text-xs';
                    const statValueClass = 'font-mono text-xs font-bold tabular-nums text-amber-100 sm:text-sm';
                    const statBonusClass = ch
                        ? 'shrink-0 font-mono text-[10px] font-semibold tabular-nums text-emerald-400/95 sm:text-[11px]'
                        : 'shrink-0 font-mono text-[10px] font-semibold tabular-nums text-emerald-400/95 sm:text-xs';
                    return (
                        <div
                            key={stat}
                            className={
                                mergedRow
                                    ? ch
                                        ? 'flex min-w-0 flex-row items-center justify-between gap-1 rounded-md border border-white/10 bg-black/30 px-1 py-0.5 sm:px-1.5 sm:py-1'
                                        : 'flex min-w-0 flex-row items-center justify-between gap-1.5 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 sm:px-2'
                                    : 'flex min-w-0 flex-col items-center justify-center rounded-md border border-white/10 bg-black/30 px-1 py-1 sm:px-1.5 sm:py-1.5'
                            }
                            title={
                                hasBonus
                                    ? t('statBaseDisplay', { base: baseV, display: v, bonus: bonusRounded })
                                    : baseV !== v
                                      ? t('statBaseOnly', { base: baseV })
                                      : undefined
                            }
                        >
                            <span className={statLabelClass}>{label}</span>
                            <span
                                className={`flex min-w-0 flex-wrap items-center leading-tight ${
                                    mergedRow ? 'shrink-0 justify-end gap-x-1' : 'justify-center gap-x-1'
                                }`}
                            >
                                <span className={statValueClass}>{v}</span>
                                {hasBonus ? <span className={statBonusClass}>(+{bonusRounded})</span> : null}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }, [coreStatComputeBundle, homeLeftColumnMerge, nativeCompactHome]);

    const AbilityStatsPanelContent = useMemo(() => {
        const nh = isNativeMobile && !readableHome;
        const ch = nativeCompactHome;
        return (
            <div
                className={`flex min-h-0 w-full min-w-0 shrink-0 flex-col items-stretch ${readableHome ? (ch ? 'gap-0.5 overflow-x-hidden' : 'gap-1 overflow-x-hidden') : ''} ${nh ? 'gap-[clamp(0.14rem,0.65dvh,0.38rem)] overflow-x-hidden' : !readableHome ? 'gap-[clamp(0.22rem,0.85dvh,0.42rem)] overflow-x-hidden' : ''}`}
            >
                {AbilityBadukBannerContent}
                {AbilityCoreStatsGridContent}
            </div>
        );
    }, [
        AbilityBadukBannerContent,
        AbilityCoreStatsGridContent,
        isNativeMobile,
        readableHome,
        nativeCompactHome,
    ]);

    const HomeLeftChatColumnContent = useMemo(
        () => (
            <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                <div className={`relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden ${nativeCompactHome ? 'p-1 sm:p-1.5' : 'p-1.5 sm:p-2'}`}>
                    <ChatWindow
                        messages={mergedPublicChatMessages}
                        mode="global"
                        onAction={handlers.handleAction}
                        onViewUser={handlers.openViewingUser}
                        locationPrefix={t('lobby:locationPrefix.home')}
                        compactTournamentMobile
                    />
                </div>
            </div>
        ),
        [mergedPublicChatMessages, handlers, nativeCompactHome],
    );

    const HomeMergedUserStackContent = useMemo(
        () => (
            <div
                className={`flex h-full min-h-0 w-full min-w-0 flex-col ${nativeCompactHome ? 'gap-[clamp(0.08rem,0.5dvh,0.22rem)]' : 'gap-[clamp(0.14rem,0.65dvh,0.32rem)]'}`}
            >
                <div className="w-full min-w-0 shrink-0">{ProfilePanelContent}</div>
                <div className="w-full min-w-0 shrink-0 border-t border-amber-500/25 pt-1">{ProfileGuildPanelContent}</div>
                <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain border-t border-amber-500/25 pt-1 [scrollbar-width:thin]">
                    <HomeNativeMergedEquipmentAbilityPanel
                        equippedItems={equippedItems}
                        presets={presets}
                        selectedPreset={selectedPreset}
                        onPresetChange={handlePresetChange}
                        onOpenEquipmentEffects={handlers.openEquipmentEffectsModal}
                        onOpenStatAllocation={handlers.openStatAllocationModal}
                        onViewEquippedItem={(item) => handlers.openViewingItem(item, true)}
                        finalByStat={coreStatComputeBundle.finalByStat}
                        baseByStat={coreStatComputeBundle.baseByStat}
                        badukAbilityTotal={coreStatComputeBundle.badukAbilityTotal}
                        availablePoints={availablePoints}
                        framed={false}
                        compactLayout={nativeCompactHome}
                        bannerAside={
                            <div
                                className={`flex h-full min-h-0 w-full flex-col items-center justify-center rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-950/45 via-black/40 to-fuchsia-950/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                                    nativeCompactHome ? 'px-1 py-1' : 'px-2 py-1.5 sm:px-2.5 sm:py-2'
                                }`}
                            >
                                <PairPetProfilePanel
                                    currentUser={currentUserWithStatus}
                                    currentUserId={currentUserWithStatus.id}
                                    isBusy={false}
                                    embed
                                    compact
                                    profileHomeBannerAside
                                    hideInlineBadukChip
                                    showRepresentativeBadge={Boolean(getEquippedPairPetInventoryRow(currentUserWithStatus))}
                                    onOpenEquippedPetDetail={openEquippedPairPetDetailFromProfileHome}
                                    onFocusPetInventory={focusPairPetInventoryFromProfileHome}
                                />
                            </div>
                        }
                    />
                </div>
            </div>
        ),
        [
            ProfilePanelContent,
            ProfileGuildPanelContent,
            currentUserWithStatus,
            equippedItems,
            presets,
            selectedPreset,
            handlePresetChange,
            handlers,
            coreStatComputeBundle,
            availablePoints,
            nativeCompactHome,
            openEquippedPairPetDetailFromProfileHome,
            focusPairPetInventoryFromProfileHome,
        ],
    );

    const singleProgress = currentUserWithStatus.singlePlayerProgress ?? 0;
    const singlePlayerTotalStages = useMemo(
        () => getSinglePlayerStages().length,
        [singlePlayerStagesListRevision]
    );
    const singleStageLabel = singleProgress >= 40 ? t('stageLabels.master')
        : singleProgress >= 30 ? t('stageLabels.advanced')
        : singleProgress >= 20 ? t('stageLabels.intermediate')
        : singleProgress >= 10 ? t('stageLabels.beginner')
        : t('stageLabels.intro');
    const towerCurrentFloor = Math.max(1, (currentUserWithStatus as User)?.towerFloor ?? 0);
    const towerCurrentRank = (currentUserWithStatus as any)?.monthlyTowerRank ?? (currentUserWithStatus as any)?.towerRank ?? null;
    const adventureCodexBreakdown = getAdventureCodexCompletionBreakdown(currentUserWithStatus.adventureProfile);
    const adventureCodexOverallPercentText =
        adventureCodexBreakdown.overallPercent >= 10
            ? `${Math.round(adventureCodexBreakdown.overallPercent)}%`
            : `${Math.round(adventureCodexBreakdown.overallPercent * 10) / 10}%`;
    const adventureCodexDonutR = 33;
    const adventureCodexDonutC = 2 * Math.PI * adventureCodexDonutR;
    const adventureCodexDonutDash =
        (Math.min(100, Math.max(0, adventureCodexBreakdown.overallPercent)) / 100) * adventureCodexDonutC;
    /** 2×3: 1행 싱글·탑 / 2행 전략·놀이 / 3행 챔피언십·모험 (PC·모바일 홈 외 공용; 모바일 경기장 전용 화면은 별도) */
    const lobbyGridShell =
        isNativeMobile && profileTab !== 'home'
            ? 'grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-[repeat(3,minmax(0,1fr))] gap-1.5 overflow-hidden px-0.5 pb-0.5 [&>*]:min-h-0 [&>*]:min-w-0'
            : 'grid h-full min-h-0 w-full content-center grid-cols-2 grid-rows-[repeat(3,minmax(0,15rem))] gap-2.5 lg:gap-3 lg:grid-rows-[repeat(3,minmax(0,17.5rem))] [&>*]:min-h-0 [&>*]:min-w-0';

    const mergedCardClass = 'flex h-full min-h-0 overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10';
    const imagePaneClass = 'min-h-0 min-w-0 flex-[1.78] p-0.5';
    /** PC 경기장 카드 우측: 타이틀 상단·버튼 하단 고정, 중간 통계 블록 세로 중앙 */
    const infoPanelShellClass =
        'flex h-full min-h-0 min-w-[196px] flex-[0.92] flex-col gap-2 border-l border-amber-200/20 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
    const infoPanelMiddleClass =
        'flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch justify-center gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]';
    const infoTitleClass =
        'inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-amber-300/40 bg-gradient-to-r from-amber-950/80 via-zinc-900/90 to-amber-950/80 px-2 py-1 text-[15px] font-black tracking-tight text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-8px_rgba(251,191,36,0.4)]';
    const infoRowClass =
        'grid w-full min-w-0 grid-cols-[minmax(4.25rem,auto)_minmax(0,1fr)] items-center gap-x-2 rounded-md border border-white/12 bg-black/35 px-2.5 py-1.5 text-[12.5px] leading-snug';
    const infoLabelClass = 'min-w-0 text-center font-semibold text-slate-300/95';
    const infoValueClass = 'min-w-0 w-full text-center font-semibold text-slate-100/95 whitespace-normal break-keep';
    const hasPcHomeTrainingQuestReward =
        !isNativeMobile && userHasFullTrainingQuestReward(currentUserWithStatus);
    const LobbyCards = (
        <div className={lobbyGridShell}>
            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <div
                        onClick={onSelectSinglePlayerLobby}
                        className="group border border-emerald-400/40 flex h-full min-h-0 w-full flex-col rounded-xl text-center shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-all transform hover:-translate-y-1 hover:shadow-green-500/30 cursor-pointer text-on-panel relative overflow-hidden p-1"
                    >
                        <img src={SINGLE_PLAYER_LOBBY_IMG} alt={t('goSchool')} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/0 via-black/0 to-black/14" />
                        <h2 className="relative z-[1] mb-0.5 h-4 text-[10px] font-bold leading-tight text-white">{t('goSchool')}</h2>
                        <div className="flex min-h-0 w-full flex-1 rounded-md" />
                    </div>
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <div
                                onClick={onSelectSinglePlayerLobby}
                                className="group flex h-full min-h-0 w-full flex-col rounded-xl text-center transition-all transform hover:-translate-y-1 hover:shadow-green-500/30 cursor-pointer text-on-panel relative overflow-hidden"
                            >
                                <img src={SINGLE_PLAYER_LOBBY_IMG} alt={t('goSchool')} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                                <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/0 via-black/0 to-black/14" />
                                <div className="flex min-h-0 w-full flex-1 rounded-md" />
                            </div>
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>{t('goSchool')}</div>
                            <div className={infoPanelMiddleClass}>
                                <div className={infoRowClass}><span className={infoLabelClass}>{t('currentLocation')}</span><span className={infoValueClass}>{singleStageLabel}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>{t('progress')}</span><span className={infoValueClass}>{singleProgress} / {singlePlayerTotalStages}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>{t('cleared')}</span><span className={infoValueClass}>{Math.max(0, singleProgress)}</span></div>
                            </div>
                            {!isNativeMobile && (
                                <Button
                                    type="button"
                                    onClick={() => handlers.openTrainingQuest()}
                                    colorScheme="none"
                                    bare
                                    aria-label={
                                        hasPcHomeTrainingQuestReward
                                            ? t('trainingQuestRewardHint')
                                            : t('trainingQuest')
                                    }
                                    className="relative w-full shrink-0 !justify-center rounded-lg border border-emerald-400/45 bg-gradient-to-b from-emerald-900/55 via-zinc-900/80 to-black/90 !px-2 !py-1.5 !text-[12px] !font-bold !text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_18px_-10px_rgba(16,185,129,0.45)] hover:border-emerald-300/55 hover:from-emerald-800/65 hover:to-zinc-900"
                                >
                                    {t('trainingQuest')}
                                    {hasPcHomeTrainingQuestReward && (
                                        <span
                                            className="absolute right-2 top-1/2 z-[1] h-2 w-2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.65)]"
                                            aria-hidden
                                            title={t('claimableReward')}
                                        />
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <PveCard title={t('challengeTower')} imageUrl={TOWER_MOBILE_HERO_WEBP} layout="tall" onClick={() => tryArenaEnter('tower', () => { window.location.hash = '#/tower'; })} compact={true} locked={!!getArenaEntryLockReason('tower')} lockReason={getArenaEntryLockReason('tower') ?? undefined} />
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <PveCard title={t('challengeTower')} imageUrl={TOWER_MOBILE_HERO_WEBP} layout="tall" onClick={() => tryArenaEnter('tower', () => { window.location.hash = '#/tower'; })} compact={false} hideOverlayText={true} locked={!!getArenaEntryLockReason('tower')} lockReason={getArenaEntryLockReason('tower') ?? undefined} />
                            </div>
                            <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>{t('challengeTower')}</div>
                            <div className={infoPanelMiddleClass}>
                                <div className={infoRowClass}><span className={infoLabelClass}>{t('currentFloor')}</span><span className={infoValueClass}>{t('floorUnit', { floor: towerCurrentFloor })}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>{t('timeRemaining')}</span><span className={infoValueClass}>{towerTimeLeft}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>{t('currentRank')}</span><span className={infoValueClass}>{towerCurrentRank ? t('rankUnit', { rank: towerCurrentRank }) : '-'}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div
                className={
                    isNativeMobile && profileTab === 'home'
                        ? 'flex min-h-0 min-w-0 flex-col gap-1.5'
                        : 'col-span-2 grid h-full min-h-0 min-w-0 grid-cols-2 gap-2.5 lg:gap-3 [&>*]:min-h-0 [&>*]:min-w-0'
                }
            >
                <div className={mergedCardClass}>
                    <div className={imagePaneClass}>
                        <PveCard
                            title={t('pvpArena')}
                            imageUrl={PVP_ARENA_ENTRY_IMG}
                            layout="tall"
                            onClick={() => onSelectArenaIntent('pvp')}
                            compact={false}
                            hideOverlayText
                        />
                    </div>
                    <div className={`${infoPanelShellClass} border-fuchsia-300/25`}>
                        <div className={`${infoTitleClass} text-fuchsia-100`}>{t('pvpArena')}</div>
                        <PvpArenaHomeInfoMiddle
                            tiers={overallTiers}
                            playfulWins={aggregatedStats.playful.wins}
                            playfulLosses={aggregatedStats.playful.losses}
                            infoPanelMiddleClass={infoPanelMiddleClass}
                            infoLabelClass={infoLabelClass}
                            infoValueClass={infoValueClass}
                        />
                        <Button
                            type="button"
                            onClick={() => handlers.openDetailedStats('both')}
                            colorScheme="none"
                            bare
                            className="w-full shrink-0 !justify-center rounded-lg border border-fuchsia-300/45 bg-gradient-to-r from-cyan-950/50 via-fuchsia-950/40 to-violet-950/45 !px-2 !py-1.5 !text-[12px] !font-bold !text-fuchsia-50 hover:from-cyan-900/55 hover:via-fuchsia-900/45 hover:to-violet-900/50"
                        >
                            {t('detailedStatsBtn')}
                        </Button>
                    </div>
                </div>
                <div className={mergedCardClass}>
                    <div className={imagePaneClass}>
                        <PveCard
                            title={t('aiArena')}
                            imageUrl={AI_ARENA_ENTRY_IMG}
                            layout="tall"
                            onClick={() => onSelectArenaIntent('ai')}
                            compact={false}
                            hideOverlayText
                        />
                    </div>
                    <div className={`${infoPanelShellClass} border-violet-300/25`}>
                        <div className={`${infoTitleClass} text-violet-100`}>{t('aiArena')}</div>
                        <div className={infoPanelMiddleClass}>
                            <div className={infoRowClass}>
                                <span className={infoLabelClass}>{t('strategicAiRecord')}</span>
                                <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                                    {aiLobbyRecordByKind.strategic.wins}{t('winShort')}{aiLobbyRecordByKind.strategic.losses}{t('loseShort')}
                                </span>
                            </div>
                            <div className={infoRowClass}>
                                <span className={infoLabelClass}>{t('pairAiRecord')}</span>
                                <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                                    {aiLobbyRecordByKind.pair.wins}{t('winShort')}{aiLobbyRecordByKind.pair.losses}{t('loseShort')}
                                </span>
                            </div>
                            <div className={infoRowClass}>
                                <span className={infoLabelClass}>{t('playfulAiRecord')}</span>
                                <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                                    {aiLobbyRecordByKind.playful.wins}{t('winShort')}{aiLobbyRecordByKind.playful.losses}{t('loseShort')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <div onClick={getArenaEntryLockReason('championship') ? undefined : onSelectTournamentLobby} className={`group border border-fuchsia-400/40 flex h-full min-h-0 w-full flex-col rounded-xl text-center shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-all transform text-on-panel p-1 relative overflow-hidden ${getArenaEntryLockReason('championship') ? 'cursor-not-allowed grayscale-[0.25] opacity-75' : 'cursor-pointer hover:-translate-y-1 hover:shadow-purple-500/30'}`}>
                        <img src={CHAMPIONSHIP_PVP_VENUE_BG_WEBP} alt={t('championship')} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/4 via-black/0 to-black/14" />
                        {getArenaEntryLockReason('championship') && (
                            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                                <span className="text-[2rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[2.4rem]">🔒</span>
                                <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-rose-100 sm:text-xs">
                                    {getArenaEntryLockReason('championship')}
                                </span>
                            </div>
                        )}
                        <h2 className="relative z-[1] mb-0.5 h-4 text-[10px] font-bold leading-tight text-white">{t('championship')}</h2>
                        <div className="flex min-h-0 w-full flex-1 rounded-md" />
                    </div>
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <div onClick={getArenaEntryLockReason('championship') ? undefined : onSelectTournamentLobby} className={`group flex h-full min-h-0 w-full flex-col text-center transition-all transform text-on-panel relative overflow-hidden rounded-xl ${getArenaEntryLockReason('championship') ? 'cursor-not-allowed grayscale-[0.25] opacity-75' : 'cursor-pointer hover:-translate-y-1 hover:shadow-purple-500/30'}`}>
                                <img src={CHAMPIONSHIP_PVP_VENUE_BG_WEBP} alt={t('championship')} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                                <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/4 via-black/0 to-black/14" />
                                {getArenaEntryLockReason('championship') && (
                                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                                        <span className="text-[2rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] sm:text-[2.4rem]">🔒</span>
                                        <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-rose-100 sm:text-xs">
                                            {getArenaEntryLockReason('championship')}
                                        </span>
                                    </div>
                                )}
                                <div className="flex min-h-0 w-full flex-1 rounded-md" />
                            </div>
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>{t('championship')}</div>
                            <div className={infoPanelMiddleClass}>
                                <div className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-2 py-2">
                                    <img
                                        src={championshipVenueStrip.tier.icon}
                                        alt=""
                                        title={championshipVenueStrip.tierName}
                                        className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
                                    />
                                    <div className="min-w-0 flex-1 text-center">
                                        <span className={`${infoLabelClass} block text-[11px]`}>{t('integratedScore')}</span>
                                        <span className={`${infoValueClass} block font-mono text-base text-amber-100 sm:text-lg`}>
                                            {championshipVenueStrip.rating}{t('points')}
                                        </span>
                                    </div>
                                </div>
                                <div className={infoRowClass}>
                                    <span className={`${infoLabelClass} self-start`}>{t('seasonRecord')}</span>
                                    <div className={`${infoValueClass} flex flex-col items-end gap-0.5 font-mono text-[11px] leading-tight sm:text-xs`}>
                                        {championshipVenueStrip.venueSeason.map((row) => (
                                            <span key={row.label} className="whitespace-nowrap text-right">
                                                <span className="text-slate-500">{row.label}</span>{' '}
                                                <span className="text-primary">
                                                    {row.wins}{t('winShort')} {row.losses}{t('loseShort')}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <PveCard
                        title={t('adventure')}
                        imageUrl={ADVENTURE_STAGES[0].mapWebp}
                        layout="tall"
                        onClick={() => tryArenaEnter('adventure', () => { window.location.hash = '#/adventure'; })}
                        compact={true}
                        locked={!!getArenaEntryLockReason('adventure')}
                        lockReason={getArenaEntryLockReason('adventure') ?? undefined}
                    />
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <PveCard
                                title={t('adventure')}
                                imageUrl={ADVENTURE_STAGES[0].mapWebp}
                                layout="tall"
                                onClick={() => tryArenaEnter('adventure', () => { window.location.hash = '#/adventure'; })}
                                compact={false}
                                hideOverlayText={true}
                                locked={!!getArenaEntryLockReason('adventure')}
                                lockReason={getArenaEntryLockReason('adventure') ?? undefined}
                            />
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>{t('adventure')}</div>
                            <div className={infoPanelMiddleClass}>
                                <div className="flex w-full items-center justify-center">
                                    <div className="relative h-[6.5rem] w-[6.5rem] shrink-0">
                                        <svg
                                            viewBox={`0 0 ${(adventureCodexDonutR + 14) * 2} ${(adventureCodexDonutR + 14) * 2}`}
                                            className="h-full w-full -rotate-90 text-zinc-800"
                                            aria-hidden
                                        >
                                            <circle
                                                cx={adventureCodexDonutR + 14}
                                                cy={adventureCodexDonutR + 14}
                                                r={adventureCodexDonutR}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={7}
                                                className="text-zinc-800/95"
                                            />
                                            <circle
                                                cx={adventureCodexDonutR + 14}
                                                cy={adventureCodexDonutR + 14}
                                                r={adventureCodexDonutR}
                                                fill="none"
                                                stroke={`url(#${adventureCodexDonutGradId})`}
                                                strokeWidth={7}
                                                strokeLinecap="round"
                                                strokeDasharray={`${adventureCodexDonutDash} ${adventureCodexDonutC}`}
                                            />
                                            <defs>
                                                <linearGradient id={adventureCodexDonutGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="rgb(167, 139, 250)" />
                                                    <stop offset="55%" stopColor="rgb(244, 114, 182)" />
                                                    <stop offset="100%" stopColor="rgb(251, 191, 36)" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                            <span className="text-[1.05rem] font-black tabular-nums text-white drop-shadow sm:text-xl">
                                                {adventureCodexOverallPercentText}
                                            </span>
                                            <span className="min-w-[5.25rem] text-center text-[10px] font-semibold tabular-nums text-zinc-400 sm:min-w-[6rem] sm:text-xs">
                                                {adventureCodexBreakdown.totalSum}/{adventureCodexBreakdown.totalMax} Lv
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button
                                type="button"
                                colorScheme="none"
                                bare
                                onClick={() => handlers.openAdventureMonsterCodexModal()}
                                className="w-full shrink-0 !justify-center rounded-lg border border-violet-400/45 bg-gradient-to-r from-violet-950/55 via-purple-950/40 to-fuchsia-950/40 !px-2 !py-1.5 !text-[12px] !font-bold !text-violet-50 hover:from-violet-900/55 hover:via-purple-900/45 hover:to-fuchsia-900/45"
                            >
                                {t('monsterCodex')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
    const adminVipCorner =
        isClientAdmin(currentUserWithStatus) ? (
            <div className="pointer-events-auto absolute left-1 top-1 z-[4] max-[680px]:left-0.5 max-[680px]:top-0.5 sm:left-2 sm:top-1.5">
                <div ref={vipMenuRef} className="relative">
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        disabled={vipTestBusy}
                        onClick={() => setVipMenuOpen((o) => !o)}
                        className="touch-manipulation !rounded-md !border !border-amber-400/55 !bg-amber-950/95 !px-2 !py-1 !text-[9px] !font-bold uppercase tracking-wide !text-amber-100 shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:!px-2.5 sm:!py-1.5 sm:!text-[10px]"
                        title={t('vipTestTitle')}
                    >
                        VIP
                    </Button>
                    {vipMenuOpen ? (
                        <div
                            className="absolute left-0 top-[calc(100%+0.35rem)] z-[5] w-[14.25rem] rounded-xl border border-amber-500/45 bg-zinc-950/98 p-2 shadow-2xl ring-1 ring-black/50 backdrop-blur-sm"
                            role="dialog"
                            aria-label={t('vipTestAria')}
                        >
                            <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200/90">
                                {t('vipTypes')}
                            </p>
                            <div className="space-y-1.5">
                                {(
                                    [
                                        { flag: 'rewardVip' as const, label: t('rewardVip') },
                                        { flag: 'functionVip' as const, label: t('functionVip') },
                                        { flag: 'vvip' as const, label: 'VVIP' },
                                        { flag: 'removeAds' as const, label: t('removeAds') },
                                    ] as const
                                ).map((row) => {
                                    const base = currentUserWithStatus;
                                    const curFlags = {
                                        rewardVip: isVipExpiresActive(base.rewardVipExpiresAt),
                                        functionVip: isVipExpiresActive(base.functionVipExpiresAt),
                                        vvip: isVipExpiresActive(base.vvipExpiresAt),
                                        removeAds: Boolean(base.removeAdsPurchased),
                                    };
                                    const on = curFlags[row.flag];
                                    return (
                                        <div
                                            key={row.flag}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5"
                                        >
                                            <span className="min-w-0 text-[11px] font-semibold text-amber-50/95">{row.label}</span>
                                            <div className="flex shrink-0 gap-0.5">
                                                <button
                                                    type="button"
                                                    disabled={vipTestBusy}
                                                    onClick={() =>
                                                        void sendAdminVipTestFlags({
                                                            ...curFlags,
                                                            [row.flag]: false,
                                                        })
                                                    }
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                                                        !on
                                                            ? 'bg-amber-600 text-white'
                                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                    }`}
                                                >
                                                    OFF
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={vipTestBusy}
                                                    onClick={() =>
                                                        void sendAdminVipTestFlags({
                                                            ...curFlags,
                                                            [row.flag]: true,
                                                        })
                                                    }
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                                                        on
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                    }`}
                                                >
                                                    ON
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 border-t border-white/10 pt-2">
                                <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200/90">
                                    {t('diamondPackage')}
                                </p>
                                <div className="space-y-1.5">
                                    {([1, 2, 3] as const).map((tier) => {
                                        const base = currentUserWithStatus;
                                        const pkgOn =
                                            (base.diamondPackageExpiresAt ?? 0) > Date.now() &&
                                            base.activeDiamondPackageTier === tier;
                                        const roman = tier === 1 ? 'I' : tier === 2 ? 'II' : 'III';
                                        return (
                                            <div
                                                key={tier}
                                                className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5"
                                            >
                                                <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-cyan-50/95">
                                                    <img src="/images/icon/Zem.webp" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                                    {t('packageRoman', { roman })}
                                                </span>
                                                <div className="flex shrink-0 gap-0.5">
                                                    <button
                                                        type="button"
                                                        disabled={vipTestBusy}
                                                        onClick={() => void sendAdminDiamondPackageTest(tier, false)}
                                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                                                            !pkgOn
                                                                ? 'bg-amber-600 text-white'
                                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                        }`}
                                                    >
                                                        OFF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={vipTestBusy}
                                                        onClick={() => void sendAdminDiamondPackageTest(tier, true)}
                                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                                                            pkgOn
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                        }`}
                                                    >
                                                        ON
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        ) : null;

    const nativeMobileHome = isNativeMobile && profileTab === 'home';
    /** PC 홈: 대표펫 푸터 제거로 확보된 높이(≈ min-h 3.75rem + py-2)만큼 채팅 행 확대 */
    const profileHomeLeftGridClassPc =
        `grid h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} ${PC_HOME_LEFT_COLUMN_GAP_CLASS} overflow-hidden ` +
        (homeLeftColumnMerge ? 'grid-rows-[minmax(0,1fr)_minmax(14.75rem,0.68fr)]' : 'grid-rows-[repeat(3,minmax(0,1fr))]');
    const profileHomeLeftGridClassNative =
        'grid h-full min-h-0 w-full min-w-0 flex-1 gap-[clamp(0.22rem,0.7dvh,0.38rem)] overflow-hidden grid-rows-[minmax(0,1fr)_minmax(9.5rem,0.48fr)]';

    const renderProfileHomeLeftColumn = (gridClassName: string) => (
        <div className={gridClassName}>
            <div
                className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15 ${
                    homeLeftColumnMerge ? 'h-full min-h-0' : 'h-full'
                }`}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                {profileTab === 'home' && adminVipCorner}
                {profileTab === 'home' && isClientAdmin(currentUserWithStatus) && (
                    <div className="pointer-events-auto absolute right-1.5 top-1.5 z-[4] flex flex-col items-end gap-1 sm:right-2 sm:top-2 sm:flex-row sm:items-center sm:gap-1.5">
                        <div ref={adminModalPreviewMenuRef} className="relative">
                            <Button
                                type="button"
                                colorScheme="none"
                                bare
                                onClick={() => setAdminModalPreviewMenuOpen((prev) => !prev)}
                                className="!rounded-md !border !border-sky-400/55 !bg-sky-950/95 !px-2.5 !py-1 !text-[10px] !font-bold uppercase tracking-wide !text-sky-100 shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:!px-3 sm:!py-1.5 sm:!text-xs"
                                title={t('modalPreviewList')}
                            >
                                {t('modalPreview')}
                            </Button>
                            {adminModalPreviewMenuOpen && (
                                <div className="absolute right-0 top-[calc(100%+0.35rem)] z-[6] flex min-w-[10rem] flex-col gap-1 rounded-lg border border-white/15 bg-black/90 p-1 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        bare
                                        onClick={() => {
                                            handlers.previewAdminLevelUpCelebrationModal();
                                            setAdminModalPreviewMenuOpen(false);
                                        }}
                                        className="!justify-start !rounded-md !border !border-emerald-400/45 !bg-emerald-950/85 !px-2 !py-1 !text-[11px] !font-bold !text-emerald-100"
                                    >
                                        {t('levelUpModal')}
                                    </Button>
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        bare
                                        onClick={() => {
                                            handlers.previewAdminMannerGradeUpModal();
                                            setAdminModalPreviewMenuOpen(false);
                                        }}
                                        className="!justify-start !rounded-md !border !border-amber-400/45 !bg-amber-950/85 !px-2 !py-1 !text-[11px] !font-bold !text-amber-100"
                                    >
                                        {t('mannerGradeModal')}
                                    </Button>
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        bare
                                        onClick={() => {
                                            handlers.previewAdminContentUnlockNoticeModal('tower');
                                            setAdminModalPreviewMenuOpen(false);
                                        }}
                                        className="!justify-start !rounded-md !border !border-violet-400/45 !bg-violet-950/85 !px-2 !py-1 !text-[11px] !font-bold !text-violet-100"
                                    >
                                        {t('towerUnlockModal')}
                                    </Button>
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        bare
                                        onClick={() => {
                                            handlers.previewAdminContentUnlockNoticeModal('adventure');
                                            setAdminModalPreviewMenuOpen(false);
                                        }}
                                        className="!justify-start !rounded-md !border !border-fuchsia-400/45 !bg-fuchsia-950/85 !px-2 !py-1 !text-[11px] !font-bold !text-fuchsia-100"
                                    >
                                        {t('adventureUnlockModal')}
                                    </Button>
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        bare
                                        onClick={() => {
                                            handlers.previewAdminGameResultModal();
                                            setAdminModalPreviewMenuOpen(false);
                                        }}
                                        className="!justify-start !rounded-md !border !border-rose-400/45 !bg-rose-950/85 !px-2 !py-1 !text-[11px] !font-bold !text-rose-100"
                                    >
                                        {t('gameResultDemo')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div
                    className={`flex min-h-0 min-w-0 flex-col overflow-hidden text-on-panel ${
                        nativeCompactHome ? profileStackPanelPadNativeHome : profileStackPanelPadProfilePc
                    } ${homeLeftColumnMerge ? 'h-full min-h-0 flex-1' : 'h-full min-h-0 flex-1'}`}
                >
                    <div
                        className={
                            homeLeftColumnMerge
                                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                                : 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]'
                        }
                    >
                        {homeLeftColumnMerge ? (
                            HomeMergedUserStackContent
                        ) : (
                            <div className={profileStackScrollInnerClass}>{ProfilePanelContent}</div>
                        )}
                    </div>
                </div>
            </div>
            {!homeLeftColumnMerge && (
                <>
                    <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_40px_-20px_rgba(0,0,0,0.7)] ring-1 ring-amber-100/10">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                        <div className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden ${profileStackPanelPad}`}>
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                <div className={profileStackScrollInnerClass}>{EquipmentPanelContent}</div>
                            </div>
                        </div>
                    </div>
                    <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_50px_-22px_rgba(0,0,0,0.72)] ring-1 ring-amber-100/10">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                        <div className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden ${profileStackPanelPad}`}>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                <div className={profileStackScrollInnerClass}>{AbilityStatsPanelContent}</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {homeLeftColumnMerge && (
                <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden">
                    {HomeLeftChatColumnContent}
                </div>
            )}
        </div>
    );

    return (
        <div
            className={`bg-transparent text-primary flex w-full flex-col ${isNativeMobile ? 'sudamr-native-route-root h-full max-h-full min-h-0' : 'h-full p-2 sm:p-4 lg:p-2'}`}
        >
            {(isNativeMobile ? profileTab === 'ranking' : false) && (
                <header className={`flex min-w-0 flex-shrink-0 items-center ${isNativeMobile ? 'mb-0 px-1 py-1.5' : 'mb-1 px-1 lg:mb-2 lg:px-2'}`}>
                    <h1 className={`min-w-0 truncate font-bold text-primary ${isNativeMobile ? 'text-base sm:text-lg' : 'text-base lg:text-2xl'}`}>
                        {profileTab === 'ranking' ? t('tabs.ranking') : t('tabs.arena')}
                    </h1>
                </header>
            )}
            <main
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
                {isNativeMobile && profileTab !== 'home' ? (
                    <>
                        {profileTab === 'ranking' && (
                            <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-0.5 pb-0.5">
                                <div className="flex min-h-0 h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                    <GameRankingBoard mobileSplitLarge />
                                </div>
                                <div className="flex min-h-0 h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                    <BadukRankingBoard mobileSplitLarge />
                                </div>
                            </div>
                        )}
                        {profileTab === 'arena' && (
                            <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 pb-1">
                                <div className="flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-2.5">
                                    <div className={`${mergedCardClass} min-h-0 flex-1`}>
                                        <div className={imagePaneClass}>
                                            <PveCard
                                                title={t('pvpArena')}
                                                imageUrl={PVP_ARENA_ENTRY_IMG}
                                                layout="tall"
                                                onClick={() => onSelectArenaIntent('pvp')}
                                                compact={false}
                                                hideOverlayText
                                            />
                                        </div>
                                        <div className={`${infoPanelShellClass} border-fuchsia-300/25`}>
                                            <div className={`${infoTitleClass} text-fuchsia-100`}>{t('pvpArena')}</div>
                                            <PvpArenaHomeInfoMiddle
                                                tiers={overallTiers}
                                                playfulWins={aggregatedStats.playful.wins}
                                                playfulLosses={aggregatedStats.playful.losses}
                                                infoPanelMiddleClass={infoPanelMiddleClass}
                                                infoLabelClass={infoLabelClass}
                                                infoValueClass={infoValueClass}
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => handlers.openDetailedStats('both')}
                                                colorScheme="none"
                                                bare
                                                className="w-full shrink-0 !justify-center rounded-lg border border-fuchsia-300/45 bg-gradient-to-r from-cyan-950/50 via-fuchsia-950/40 to-violet-950/45 !px-2 !py-1.5 !text-[12px] !font-bold !text-fuchsia-50"
                                            >
                                                {t('detailedStatsBtn')}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className={`${mergedCardClass} min-h-0 flex-1`}>
                                        <div className={imagePaneClass}>
                                            <PveCard
                                                title={t('aiArena')}
                                                imageUrl={AI_ARENA_ENTRY_IMG}
                                                layout="tall"
                                                onClick={() => onSelectArenaIntent('ai')}
                                                compact={false}
                                                hideOverlayText
                                            />
                                        </div>
                                        <div className={`${infoPanelShellClass} border-violet-300/25`}>
                                            <div className={`${infoTitleClass} text-violet-100`}>{t('aiArena')}</div>
                                            <div className={infoPanelMiddleClass}>
                                                <div className={infoRowClass}>
                                                    <span className={infoLabelClass}>{t('strategicAiRecord')}</span>
                                                    <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                                                        {aiLobbyRecordByKind.strategic.wins}{t('winShort')}{aiLobbyRecordByKind.strategic.losses}{t('loseShort')}
                                                    </span>
                                                </div>
                                                <div className={infoRowClass}>
                                                    <span className={infoLabelClass}>{t('pairAiRecord')}</span>
                                                    <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                                                        {aiLobbyRecordByKind.pair.wins}{t('winShort')}{aiLobbyRecordByKind.pair.losses}{t('loseShort')}
                                                    </span>
                                                </div>
                                                <div className={infoRowClass}>
                                                    <span className={infoLabelClass}>{t('playfulAiRecord')}</span>
                                                    <span className={`${infoValueClass} font-mono whitespace-nowrap`}>
                                                        {aiLobbyRecordByKind.playful.wins}{t('winShort')}{aiLobbyRecordByKind.playful.losses}{t('loseShort')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : nativeMobileHome ? (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-0.5 pt-0.5">
                        {renderProfileHomeLeftColumn(profileHomeLeftGridClassNative)}
                    </div>
                ) : (
                    <div className={`flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
                        {/* 좌: 유저·펫 / 중: 로비 카드 / 우: 퀵 메뉴 (PC·웹) */}
                        {renderProfileHomeLeftColumn(profileHomeLeftGridClassPc)}
                        <PcLobbyCenterColumn>{LobbyCards}</PcLobbyCenterColumn>
                        <div
                            className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}
                            aria-label={t('quickMenuAria')}
                        >
                            <div className={PC_QUICK_RAIL_WRAPPER_CLASS}>
                                <QuickAccessSidebar fillHeight={true} />
                            </div>
                        </div>
                    </div>
                )}
            </main>
            {showMannerRankModal && currentUserWithStatus && (
                <MannerRankModal
                    user={currentUserWithStatus}
                    onClose={() => setShowMannerRankModal(false)}
                    isTopmost={true}
                />
            )}
            {isGuildCreateModalOpen && (
                <GuildCreateModal
                    onClose={() => setIsGuildCreateModalOpen(false)}
                    onSuccess={async (guild: Guild) => {
                        console.log('[Profile] Guild created, opening guild home modal:', guild);
                        setIsGuildCreateModalOpen(false);
                        // 길드 생성 성공 시 길드 홈 페이지로 이동
                        window.location.hash = '#/guild';
                    }}
                />
            )}
            {isGuildJoinModalOpen && (
                <GuildJoinModal
                    onClose={() => setIsGuildJoinModalOpen(false)}
                    onSuccess={async (guild: Guild) => {
                        setIsGuildJoinModalOpen(false);
                        window.location.hash = '#/guild';
                    }}
                />
            )}
            {homeScreenGuide.isOpen && (
                <ScreenGuideModal
                    guideId="home"
                    onClose={homeScreenGuide.close}
                    onDismissForever={homeScreenGuide.dismissForever}
                />
            )}
        </div>
    );
};

export default Profile;