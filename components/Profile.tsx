import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { UserWithStatus, GameMode, EquipmentSlot, InventoryItem, ItemGrade, ServerAction, LeagueTier, CoreStat, SpecialStat, MythicStat, ItemOptionType, TournamentState, User } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, LEAGUE_DATA, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, emptySlotImages, TOURNAMENT_DEFINITIONS, GRADE_LEVEL_REQUIREMENTS, RANKING_TIERS, SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS } from '../constants';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG } from '../assets.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DetailedStatsModal from './DetailedStatsModal.js';
import ProfileEditModal from './ProfileEditModal.js';
import { getMannerScore, getMannerRank, getMannerStyle } from '../services/manner.js';
import { calculateUserEffects } from '../services/effectService.js';
import { useAppContext } from '../hooks/useAppContext.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from './QuickAccessSidebar.js';
import CoreStatsHexagonChart from './CoreStatsHexagonChart.js';
import GameRankingBoard from './GameRankingBoard.js';
import BadukRankingBoard from './BadukRankingBoard.js';
import { useRanking } from '../hooks/useRanking.js';
import MannerRankModal from './MannerRankModal.js';
import GuildCreateModal from './guild/GuildCreateModal.js';
import GuildJoinModal from './guild/GuildJoinModal.js';
import type { Guild } from '../types/entities.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface ProfileProps {
}

const getXpRequirementForLevel = (level: number): number => {
    if (level < 1) return 0;
    if (level > 100) return Infinity; // Max level
    
    // 레벨 1~10: 200 + (레벨 x 100)
    if (level <= 10) {
        return 200 + (level * 100);
    }
    
    // 레벨 11~20: 300 + (레벨 x 150)
    if (level <= 20) {
        return 300 + (level * 150);
    }
    
    // 레벨 21~50: 이전 필요경험치 x 1.2
    // 레벨 51~100: 이전 필요경험치 x 1.3
    // 레벨 20의 필요 경험치를 먼저 계산
    let xp = 300 + (20 * 150); // 레벨 20의 필요 경험치
    
    // 레벨 21부터 현재 레벨까지 반복
    for (let l = 21; l <= level; l++) {
        if (l <= 50) {
            xp = Math.round(xp * 1.2);
        } else {
            xp = Math.round(xp * 1.3);
        }
    }
    
    return xp;
};

const XpBar: React.FC<{ level: number, currentXp: number, label: string, colorClass: string; bumpText?: boolean }> = ({ level, currentXp, label, colorClass, bumpText = false }) => {
    const maxXp = getXpRequirementForLevel(level);
    const percentage = Math.min((currentXp / maxXp) * 100, 100);
    const fs = bumpText ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)' : 'clamp(0.625rem, 1.5vw, 0.75rem)';
    return (
        <div className="min-w-0">
            <div className="mb-0.5 flex min-w-0 items-baseline justify-between gap-1 text-xs">
                <span className="min-w-0 truncate font-semibold text-slate-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]" style={{ fontSize: fs }}>
                    {label} <span className="text-base font-bold text-amber-200">Lv.{level}</span>
                </span>
                <span
                    className="shrink-0 whitespace-nowrap rounded-md border border-amber-400/35 bg-black/45 px-1.5 py-[1px] text-right font-mono font-semibold tabular-nums text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    style={{ fontSize: fs }}
                >
                    {currentXp} / {maxXp}
                </span>
            </div>
            <div className="w-full bg-tertiary/50 rounded-full h-3 border border-color">
                <div className={`${colorClass} h-full rounded-full transition-width duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const CombinedLevelBadge: React.FC<{ level: number; compact?: boolean }> = ({ level, compact = false }) => {
    return (
        <div className={`flex shrink-0 items-center justify-center rounded-md border border-color bg-tertiary/40 text-center ${compact ? 'w-11 px-1 py-1' : 'w-14 px-1.5 py-1.5'}`}>
            <span className={`whitespace-nowrap font-bold leading-none text-highlight ${compact ? 'text-sm' : 'text-xl'}`}>Lv.{level}</span>
        </div>
    );
};


const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
    transcendent: '/images/equipments/mythicbgi.png',
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
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    const itemImgPct = Math.min(96, (compact ? 78 : 86) * scaleFactor);
    
    if (item) {
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
        const titleText = `${item.name} (착용 레벨 합: ${requiredLevel}) - 클릭하여 상세보기`;
        const starInfo = getStarDisplayInfo(item.stars);
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative w-full aspect-square rounded-lg border-2 border-color/50 bg-tertiary/50 p-0.5 ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={titleText}
                onClick={onClick}
                style={{ border: isTranscendent ? undefined : undefined }}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                {item.stars > 0 && (
                    <div className={`absolute ${compact ? 'top-0.5 right-1 text-[10px]' : 'top-1 right-2.5 text-sm'} font-bold z-10 ${starInfo.colorClass}`} style={{ textShadow: '1px 1px 2px black' }}>
                        ★{item.stars}
                    </div>
                )}
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className={`absolute object-contain ${compact ? 'p-1' : 'p-1.5'}`}
                        style={{
                            width: `${itemImgPct}%`,
                            height: `${itemImgPct}%`,
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                )}
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
}> = ({ type, stats, onEnter, onViewStats, level, title, imageUrl, tier, compact, arenaMobile, hideOverlayText = false, hideOverlayFooter = false }) => {
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
                onClick={onEnter}
                aria-label={`${title} 경기장 입장`}
                className={`group relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/40 text-left shadow-[0_14px_44px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/8 transition-all will-change-transform ${popEase} hover:z-10 hover:-translate-y-2 hover:scale-[1.035] ${hoverLift} active:translate-y-0 active:scale-[1.01] ${accentRing} focus:outline-none focus-visible:ring-2`}
            >
                <img
                    src={imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 group-active:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/70" />
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent pt-3 pb-10 px-3 sm:pt-4 sm:px-4">
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
                        탭하여 입장
                    </span>
                </div>
            </button>
        );
    }

    return (
        <div
            onClick={onEnter}
            className={`group relative overflow-hidden rounded-xl border border-amber-400/40 text-center transition-all transform shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 ${shadowColor} cursor-pointer text-on-panel ${compactMode ? 'h-full min-h-0 p-0.5' : 'h-full p-1.5 hover:-translate-y-1 lg:p-2.5'}`}
        >
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-200/25" aria-hidden />
            <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
            <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
            <h2 className={`relative z-[1] font-bold flex items-center justify-center gap-0.5 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${hideOverlayText ? 'hidden' : ''} ${compactMode ? 'mb-0 text-[8px] leading-tight' : 'mb-0.5 h-4 text-xs lg:mb-1 lg:h-6 lg:gap-1 lg:text-base'}`}>
               {title}
               {tier && <img src={tier.icon} alt={tier.name} className={compactMode ? 'h-2.5 w-2.5' : 'h-3 w-3 lg:h-5 lg:w-5'} title={tier.name} />}
               <span className={`text-amber-200 font-semibold ${compactMode ? 'text-[8px]' : 'text-[10px] lg:text-sm'}`}>Lv.{level}</span>
           </h2>
            <div className="min-h-0 w-full flex-1 overflow-hidden rounded-md" />
            {!hideOverlayFooter && (
                <div
                    onClick={(e) => { e.stopPropagation(); onViewStats(); }}
                    className={`relative z-[1] mt-0.5 flex w-full cursor-pointer items-center justify-between rounded-md bg-black/50 text-white backdrop-blur-[1px] hover:bg-black/65 ${compactMode ? 'px-0.5 py-px text-[7px]' : 'mt-1 p-0.5 text-[10px] transition-colors lg:mt-2 lg:p-1 lg:text-xs'}`}
                    title="상세 전적 보기"
                >
                    <span className="min-w-0 truncate">{compactMode ? `${stats.wins}승${stats.losses}패 ${winRate}%` : `총 전적: ${stats.wins}승 ${stats.losses}패 (${winRate}%)`}</span>
                    <span className="flex-shrink-0 text-accent font-semibold">&rarr;</span>
                </div>
            )}
        </div>
    );
};

const PveCard: React.FC<{ title: string; imageUrl: string; layout: 'grid' | 'tall'; footerContent?: React.ReactNode; onClick?: () => void; isComingSoon?: boolean; compact?: boolean; arenaMobile?: boolean; hideOverlayText?: boolean }> = ({ title, imageUrl, layout, footerContent, onClick, isComingSoon, compact, arenaMobile, hideOverlayText = false }) => {
    const shadowColor = "hover:shadow-purple-500/30";
    const compactMode = Boolean(compact && !arenaMobile);

    if (arenaMobile) {
        const popEase = 'duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]';
        const interactive = !isComingSoon && onClick;
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
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out ${interactive ? 'group-hover:scale-105 group-active:scale-[1.02]' : ''}`}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-violet-950/20 to-black/75" />
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent pt-3 pb-10 px-3 sm:pt-4 sm:px-4">
                    <span className="block text-center text-[1.05rem] font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-xl bg-gradient-to-br from-fuchsia-100 via-white to-violet-200 bg-clip-text text-transparent">
                        {title}
                    </span>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/85 via-black/40 to-transparent pb-2 pt-8">
                    <span className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur-sm ring-1 ring-white/10 sm:text-xs">
                        {isComingSoon ? '오픈 예정' : '탭하여 입장'}
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
                {interactive ? (
                    <button type="button" onClick={onClick} className={`group ${shellClass}`} aria-label={`${title} 입장`}>
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
            onClick={onClick}
            className={`${isComingSoon ? 'border border-amber-500/35 opacity-60 grayscale' : 'border border-amber-400/45'} relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl text-center shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 text-on-panel ${compactMode ? 'p-0.5' : 'h-full p-1.5 transform transition-all lg:p-2.5'} ${isComingSoon ? 'cursor-not-allowed' : onClick ? `cursor-pointer ${compactMode ? '' : `hover:-translate-y-1 ${shadowColor}`}` : 'cursor-not-allowed'} group`}
        >
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-200/25" aria-hidden />
            {isComingSoon && (
                <div className={`absolute z-10 -right-6 rotate-45 bg-purple-600 font-bold text-white ${compactMode ? 'top-0 px-6 py-px text-[6px]' : 'top-1 px-8 py-0.5 text-[8px] lg:top-2 lg:-right-10 lg:px-10 lg:text-[10px]'}`}>
                    Coming Soon
                </div>
            )}
            <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
            <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/55 via-violet-950/20 to-black/75" />
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

const formatMythicStat = (stat: MythicStat, data: { count: number, totalValue: number }): React.ReactNode => {
    const baseDescription = MYTHIC_STATS_DATA[stat].description;

    switch (stat) {
        case MythicStat.StrategicGoldBonus:
        case MythicStat.PlayfulGoldBonus: {
            const newPercentage = 20 * data.count;
            return <span className="w-full">{baseDescription.replace(/20%/, `${newPercentage}%`)}</span>;
        }
        case MythicStat.MannerActionCooldown: {
             return (
                <div className="flex justify-between items-center w-full">
                    <span>{baseDescription}</span>
                    <span className="font-mono font-semibold">+{data.totalValue}</span>
                </div>
            );
        }
        case MythicStat.DiceGoOddBonus:
        case MythicStat.AlkkagiSlowBonus:
        case MythicStat.AlkkagiAimingBonus: {
            return <span className="w-full">{baseDescription.replace(/1개/g, `${data.totalValue}개`)}</span>;
        }
        default:
            return <span className="w-full">{baseDescription}</span>;
    }
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

const StatSummaryPanel: React.FC<{ title: string; color: string; children: React.ReactNode }> = ({ title, color, children }) => {
    const childrenArray = React.Children.toArray(children).filter(Boolean); // Filter out null/undefined children
    return (
        <div className="flex-1 bg-tertiary/30 p-1.5 rounded-md flex flex-col min-h-0">
            <h4 className={`text-center font-semibold mb-0.5 text-xs flex-shrink-0 ${color}`}>{title}</h4>
            <div className="flex-grow overflow-y-auto pr-1 space-y-0.5 text-xs">
                {childrenArray.length > 0 ? childrenArray : <p className="text-xs text-tertiary text-center">해당 없음</p>}
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
                        <span className="text-sm font-semibold tracking-wide text-slate-300">통합</span>
                        <span className={`font-mono text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl ${scoreTone}`}>{integratedScore}</span>
                        <span className="text-sm font-medium text-slate-300">점</span>
                    </div>
                </div>

                <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/28 to-transparent" />

                {/* 중앙: 총 전적 */}
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-1">
                    <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-200 sm:text-base">총 전적</span>
                    <p className="text-center font-mono text-[1.95rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-[2.15rem]">
                        <span>{agg.wins}</span>
                        <span className="mx-0.5 align-baseline text-[0.56em] font-bold text-slate-200">승</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span>{agg.losses}</span>
                        <span className="ml-0.5 align-baseline text-[0.56em] font-bold text-slate-200">패</span>
                    </p>
                    <p className="text-base text-slate-200">
                        승률{' '}
                        <span className={`font-mono text-lg font-bold tabular-nums sm:text-xl ${rateTone}`}>{pct(agg.wins, agg.losses)}%</span>
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onOpenModal}
                    className={`mx-auto mt-1 w-fit min-w-[6rem] rounded-lg border px-4 py-2 text-center text-xs font-semibold tracking-wide transition-all sm:min-w-[6.5rem] sm:text-sm ${btn}`}
                >
                    전체보기
                </button>
            </div>
        </div>
    );
};

/** 모험 행 — 입장카드 높이에 맞춘 플레이스홀더 */
const ArenaMobilePvpStatStrip: React.FC = () => (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-purple-500/30 bg-gradient-to-b from-purple-950/40 via-slate-950/90 to-slate-950/98 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.05]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/25 to-transparent" />
        <span className="bg-gradient-to-r from-fuchsia-200 via-purple-100 to-violet-200 bg-clip-text text-sm font-bold tracking-wide text-transparent sm:text-base">모험</span>
        <span className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">오픈 예정</span>
    </div>
);


const Profile: React.FC<ProfileProps> = () => {
    const { currentUserWithStatus, allUsers, handlers, hasClaimableQuest, presets, guilds, currentRoute } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const profileTab = (currentRoute.params?.tab as 'home' | 'ranking' | 'arena' | undefined) ?? 'home';
    const usePcHomePanelStyle = isNativeMobile && profileTab === 'home';
    /** 웹 브라우저 홈 좌열 프로필(레벨·매너·길드 박스 가로 확장) */
    const webHomeProfileLayout = !isNativeMobile && profileTab === 'home';
    const { rankings: championshipRankings } = useRanking('championship', 100, 0);
    const championshipMyEntry = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return championshipRankings.find(e => e.id === currentUserWithStatus.id) ?? null;
    }, [championshipRankings, currentUserWithStatus]);
    const championshipScore = championshipMyEntry?.score ?? currentUserWithStatus?.cumulativeTournamentScore ?? 0;
    const championshipRank = championshipMyEntry?.rank ?? null;
    const [detailedStatsType, setDetailedStatsType] = useState<'strategic' | 'playful' | null>(null);
    const [towerTimeLeft, setTowerTimeLeft] = useState('');
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [showMannerRankModal, setShowMannerRankModal] = useState(false);
    const [isGuildCreateModalOpen, setIsGuildCreateModalOpen] = useState(false);
    const [isGuildJoinModalOpen, setIsGuildJoinModalOpen] = useState(false);

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const nextMonth = new Date(year, month + 1, 1);
            const diff = nextMonth.getTime() - now.getTime();

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTowerTimeLeft(`${days}일 ${hours}시간`);
        };
        calculateTime();
        const interval = setInterval(calculateTime, 60 * 60 * 1000); // Update every hour
        return () => clearInterval(interval);
    }, []);

    // Get guild info: context(guilds+user.guildId) 또는 GET_GUILD_INFO 성공 시 저장한 길드 (새로고침 시 guildId가 늦게 올 수 있음)
    const [checkedGuildFromApi, setCheckedGuildFromApi] = useState<Guild | null>(null);
    const guildInfo = useMemo(() => {
        if (currentUserWithStatus?.guildId && guilds[currentUserWithStatus.guildId]) {
            return guilds[currentUserWithStatus.guildId];
        }
        return checkedGuildFromApi;
    }, [currentUserWithStatus?.guildId, guilds, checkedGuildFromApi]);
    
    // 길드 로딩 상태: 확인이 끝나기 전에는 항상 빈칸만 표시(버튼 노출 방지)
    const [guildLoadingFailed, setGuildLoadingFailed] = useState(false);
    const [guildCheckDone, setGuildCheckDone] = useState(false); // true가 되어야 길드/버튼 중 하나 표시
    const hasLoadedGuildRef = useRef<Set<string>>(new Set());
    const hasCheckedGuildRef = useRef(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // 길드 정보 확인 (초기 로딩 시 한 번만 실행)
    // guildCheckDone은 '길드 있음' 또는 '가입한 길드 없음'이 확실할 때만 true → 그 전에는 버튼 노출 안 함
    useEffect(() => {
        if (hasCheckedGuildRef.current) return;
        
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
        
        checkGuild();
    }, [handlers]);
    
    // 다른 경로(두 번째 useEffect 등)로 guildInfo가 들어오면 그때 완료 처리해서 길드 표시
    useEffect(() => {
        if (guildInfo && !guildCheckDone) setGuildCheckDone(true);
    }, [guildInfo, guildCheckDone]);
    
    // 길드에 소속되어 있는데 길드 정보가 없으면 즉시 가져오기 (한 번만 실행)
    useEffect(() => {
        const guildId = currentUserWithStatus?.guildId;
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
    }, [currentUserWithStatus?.guildId]);
    
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
                    strategic.wins += gameStats.wins;
                    strategic.losses += gameStats.losses;
                }
            }
            for (const mode of PLAYFUL_GAME_MODES) {
                const gameStats = stats[mode.mode];
                if (gameStats) {
                    playful.wins += gameStats.wins;
                    playful.losses += gameStats.losses;
                }
            }
        }
        return { strategic, playful };
    }, [stats]);
    
    const totalMannerScore = getMannerScore(currentUserWithStatus);
    const mannerRank = getMannerRank(totalMannerScore);
    const mannerStyle = getMannerStyle(totalMannerScore);
    
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

    const combinedLevel = currentUserWithStatus.strategyLevel + currentUserWithStatus.playfulLevel;
    const levelPoints = (currentUserWithStatus.strategyLevel - 1) * 2 + (currentUserWithStatus.playfulLevel - 1) * 2;
    const bonusPoints = currentUserWithStatus.bonusStatPoints || 0;
    const totalPoints = levelPoints + bonusPoints;

    const spentPoints = useMemo(() => {
        return Object.values(currentUserWithStatus.spentStatPoints || {}).reduce((sum, points) => sum + points, 0);
    }, [currentUserWithStatus.spentStatPoints]);
    const availablePoints = totalPoints - spentPoints;
    
    const onSelectLobby = (type: 'strategic' | 'playful') => window.location.hash = `#/waiting/${type}`;
    const onSelectTournamentLobby = () => window.location.hash = '#/tournament';
    const onSelectSinglePlayerLobby = () => window.location.hash = '#/singleplayer';

    // 수련과제 보상이 가득 찬지 확인
    const hasFullTrainingQuestReward = useMemo(() => {
        const userMissions = (currentUserWithStatus as any).singlePlayerMissions || {};
        const clearedStages = (currentUserWithStatus as any).clearedSinglePlayerStages || [];
        const currentTime = Date.now();
        
        return SINGLE_PLAYER_MISSIONS.some(mission => {
            const missionState = userMissions[mission.id];
            if (!missionState) return false;
            
            // 미션이 언락되어 있고 시작되었는지 확인
            const isUnlocked = clearedStages.includes(mission.unlockStageId);
            const isStarted = missionState.isStarted;
            if (!isUnlocked || !isStarted) return false;
            
            const currentLevel = missionState.level || 0;
            if (currentLevel === 0 || currentLevel > mission.levels.length) return false;
            
            const levelInfo = mission.levels[currentLevel - 1];
            const accumulatedAmount = missionState.accumulatedAmount || 0;
            
            // 생산량 계산 (실시간 반영)
            const productionRateMs = levelInfo.productionRateMinutes * 60 * 1000;
            const lastCollectionTime = missionState.lastCollectionTime || currentTime;
            const elapsed = currentTime - lastCollectionTime;
            const cycles = Math.floor(elapsed / productionRateMs);
            
            let reward = accumulatedAmount;
            if (cycles > 0) {
                const generatedAmount = cycles * levelInfo.rewardAmount;
                reward = Math.min(levelInfo.maxCapacity, accumulatedAmount + generatedAmount);
            }
            
            // 가득 찬 상태 확인
            return reward >= levelInfo.maxCapacity;
        });
    }, [currentUserWithStatus]);

    const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const presetIndex = Number(event.target.value);
        setSelectedPreset(presetIndex);
        const selectedPresetData = presets[presetIndex];
        // 프리셋이 있으면 적용하고, 없으면(빈 프리셋) 빈 장비 세트를 적용
        handlers.applyPreset(selectedPresetData || { name: `프리셋 ${presetIndex + 1}`, equipment: {} });
    };

    const overallTiers = useMemo(() => {
        const getAvgScore = (user: User, modes: typeof SPECIAL_GAME_MODES) => {
            let totalScore = 0;
            let count = 0;
            for (const mode of modes) {
                const s = user.stats?.[mode.mode];
                if (s) {
                    totalScore += s.rankingScore;
                    count++;
                }
            }
            return count > 0 ? totalScore / count : 1200;
        };

        const strategicScores = allUsers.map(u => ({ id: u.id, score: getAvgScore(u, SPECIAL_GAME_MODES) })).sort((a,b) => b.score - a.score);
        const playfulScores = allUsers.map(u => ({ id: u.id, score: getAvgScore(u, PLAYFUL_GAME_MODES) })).sort((a,b) => b.score - a.score);

        const myStrategicRank = strategicScores.findIndex(u => u.id === currentUserWithStatus.id) + 1;
        const myPlayfulRank = playfulScores.findIndex(u => u.id === currentUserWithStatus.id) + 1;

        const myStrategicScore = strategicScores.find(u => u.id === currentUserWithStatus.id)?.score || 0;
        const myPlayfulScore = playfulScores.find(u => u.id === currentUserWithStatus.id)?.score || 0;

        const strategicTier = getTier(myStrategicScore, myStrategicRank, strategicScores.length);
        const playfulTier = getTier(myPlayfulScore, myPlayfulRank, playfulScores.length);

        return {
            strategicTier,
            playfulTier,
            strategicIntegratedScore: Math.round(myStrategicScore),
            playfulIntegratedScore: Math.round(myPlayfulScore),
        };
    }, [currentUserWithStatus, allUsers]);
    
    const coreStatAbbreviations: Record<CoreStat, string> = {
        [CoreStat.Concentration]: '집중',
        [CoreStat.ThinkingSpeed]: '사고',
        [CoreStat.Judgment]: '판단',
        [CoreStat.Calculation]: '계산',
        [CoreStat.CombatPower]: '전투',
        [CoreStat.Stability]: '안정',
    };
    
    const specialStatAbbreviations: Record<SpecialStat, string> = {
        [SpecialStat.ActionPointMax]: '최대 AP',
        [SpecialStat.ActionPointRegen]: 'AP 회복',
        [SpecialStat.StrategyXpBonus]: '전략 XP',
        [SpecialStat.PlayfulXpBonus]: '놀이 XP',
        [SpecialStat.GoldBonus]: '골드 보상',
        [SpecialStat.ItemDropRate]: '장비 드랍',
        [SpecialStat.MaterialDropRate]: '재료 드랍',
    };
    
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
    
    /** 장착 그리드·프리셋 행 공통 너비 (네이티브 모바일 홈은 패널 폭 전체 사용) */
    const EQUIPMENT_BAND_MAX_CLASS = usePcHomePanelStyle ? 'max-w-[320px]' : 'max-w-[275px]';

    /** 프로필 스택(모바일·PC 좌열) 패널 내부 패딩·간격 — 뷰포트 높이에 비례 */
    const profileStackPanelPad = 'px-[clamp(0.45rem,1.8vw,0.65rem)] py-[clamp(0.35rem,1.35dvh,0.65rem)]';
    /** PC 홈 좌열 프로필 칸만 좌우 여백 축소 (레벨·매너·길드 박스 폭 확보) */
    const profileStackPanelPadProfilePc =
        'px-[clamp(0.2rem,0.85vw,0.42rem)] py-[clamp(0.35rem,1.35dvh,0.65rem)]';
    const profileStackPanelGap = 'gap-[clamp(0.25rem,0.85dvh,0.4rem)]';
    /** 스크롤 영역: 가로는 꽉 채우고 세로는 중앙 정렬 */
    const profileStackScrollInnerClass =
        'flex min-h-full w-full flex-col items-stretch justify-center gap-0 py-0.5';

    const EquipmentPanelContent = useMemo(() => {
        const nh = isNativeMobile && !usePcHomePanelStyle;
        return (
            <div
                className={`flex h-full min-h-0 w-full min-w-0 flex-col ${nh ? 'max-w-none' : `${EQUIPMENT_BAND_MAX_CLASS} mx-auto w-full`}`}
            >
                <div className={`flex min-h-0 w-full flex-1 flex-col justify-center ${profileStackPanelGap}`}>
                    <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-3 grid-rows-[repeat(2,minmax(0,1fr))] gap-[clamp(0.2rem,0.75dvh,0.35rem)] [&>*]:min-h-0 [&>*]:min-w-0">
                        {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                            const item = equippedItems.find(it => it.slot === slot);
                            return (
                                <div key={slot} className="flex min-h-0 min-w-0 h-full w-full items-center justify-center">
                                    <EquipmentSlotDisplay
                                        slot={slot}
                                        item={item}
                                        onClick={() => item && handlers.openViewingItem(item, true)}
                                        compact
                                        scaleFactor={usePcHomePanelStyle ? 1.35 : nh ? 1.05 : 1.18}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex w-full min-w-0 shrink-0 items-stretch gap-1 border-t border-color/40 pt-[clamp(0.2rem,0.8dvh,0.35rem)]">
                        <select
                            value={selectedPreset}
                            onChange={handlePresetChange}
                            className={`min-h-[24px] min-w-0 flex-1 rounded border border-color bg-secondary px-1 py-0.5 text-[10px] focus:border-accent focus:ring-accent ${nh ? '' : 'sm:text-xs'}`}
                            title={presets?.[selectedPreset]?.name}
                        >
                            {presets && presets.map((preset, index) => (
                                <option key={index} value={index}>{preset.name}</option>
                            ))}
                        </select>
                        <Button
                            onClick={handlers.openEquipmentEffectsModal}
                            colorScheme="none"
                            className="!shrink-0 !whitespace-nowrap !px-2 !py-0.5 !text-[9px] justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white"
                        >
                            효과
                        </Button>
                    </div>
                </div>
            </div>
        );
    }, [equippedItems, selectedPreset, presets, handlers, isNativeMobile, usePcHomePanelStyle, handlePresetChange]);

    const ProfilePanelContent = useMemo(() => {
        const nh = isNativeMobile && !usePcHomePanelStyle;
        const readableHome = usePcHomePanelStyle || webHomeProfileLayout;
        return (
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-[clamp(0.2rem,1dvh,0.5rem)]">
            <div className={`flex min-h-0 min-w-0 w-full flex-1 flex-row items-stretch ${nh ? 'gap-2' : 'gap-1.5 sm:gap-2'}`}>
                <div
                    className={`flex shrink-0 flex-col items-center justify-center gap-0.5 self-stretch ${
                        readableHome
                            ? 'w-[8.5rem] min-w-[7.875rem] max-w-[9.125rem] sm:w-[8.75rem] sm:min-w-[8.125rem] sm:max-w-[9.375rem]'
                            : 'w-[9.5rem] min-w-[8.75rem] max-w-[10.25rem]'
                    }`}
                >
                    <div className="relative">
                        <Avatar userId={currentUserWithStatus.id} userName={nickname} size={82} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                        <button
                            onClick={handlers.openProfileEditModal}
                            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-secondary p-1 transition-transform hover:scale-110 hover:bg-tertiary active:scale-95"
                            title="프로필 수정"
                        >
                            <span className="text-sm">✏️</span>
                            {!currentUserWithStatus.mbti && (
                                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500"></span>
                            )}
                        </button>
                    </div>
                    <div className="mt-3 w-full min-w-0 px-0.5 sm:mt-3.5">
                        <div className="w-full min-w-[6.25em] rounded-xl border border-amber-500/40 bg-gradient-to-b from-zinc-800 to-zinc-900 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_20px_rgba(0,0,0,0.5)]">
                            <h2
                                className={`w-full min-w-0 truncate text-center font-extrabold leading-snug tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${readableHome ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}
                                style={{ fontSize: nh ? 'clamp(0.9rem, 2.35vw, 1.05rem)' : undefined }}
                                title={nickname}
                            >
                                {nickname}
                            </h2>
                            <div className="mt-2 flex justify-center sm:mt-2.5">
                                <span
                                    className={`inline-flex max-w-full items-center justify-center rounded-lg border border-indigo-400/45 bg-indigo-950 px-2 py-0.5 text-center font-bold uppercase tracking-[0.1em] text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${readableHome ? 'text-sm sm:text-base' : nh ? 'text-[13px] sm:text-sm' : 'text-xs sm:text-sm'}`}
                                    title={currentUserWithStatus.mbti ? `MBTI: ${currentUserWithStatus.mbti}` : 'MBTI: 미설정'}
                                >
                                    MBTI · {currentUserWithStatus.mbti ? currentUserWithStatus.mbti : '미설정'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col justify-center gap-1 self-stretch">
                    <div className="flex w-full min-w-0 flex-col gap-1">
                        <div
                            className={`flex w-full min-w-0 flex-col gap-1 rounded-lg border border-zinc-600/90 bg-gradient-to-br from-zinc-800 to-zinc-950 p-1 pl-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${nh ? '' : 'sm:p-1 sm:pl-1.5 sm:gap-0.5'}`}
                        >
                            <div className="flex min-w-0 items-center gap-1.5">
                                <CombinedLevelBadge level={combinedLevel} compact={nh} />
                                <div className="flex min-w-0 flex-1 flex-col justify-center space-y-0.5">
                                    <XpBar bumpText={nh} level={currentUserWithStatus.strategyLevel} currentXp={currentUserWithStatus.strategyXp} label="전략" colorClass="bg-gradient-to-r from-blue-500 to-cyan-400" />
                                    <XpBar bumpText={nh} level={currentUserWithStatus.playfulLevel} currentXp={currentUserWithStatus.playfulXp} label="놀이" colorClass="bg-gradient-to-r from-yellow-500 to-orange-400" />
                                </div>
                            </div>
                        </div>
                        <div
                            className={`w-full min-w-0 overflow-hidden rounded-lg border border-amber-500/35 bg-gradient-to-b from-zinc-800/90 to-zinc-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-18px_rgba(0,0,0,0.65)] ${nh ? '' : 'sm:p-2'}`}
                        >
                            <div className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1">
                                <span
                                    className="shrink-0 font-bold text-amber-100/95"
                                    style={{ fontSize: nh ? 'clamp(0.75rem, 1.65vw, 0.875rem)' : 'clamp(0.75rem, 1.45vw, 0.875rem)' }}
                                >
                                    매너 등급
                                </span>
                                <span
                                    className={`min-w-0 shrink truncate font-bold tabular-nums ${mannerRank.color}`}
                                    style={{ fontSize: nh ? 'clamp(0.75rem, 1.65vw, 0.875rem)' : 'clamp(0.75rem, 1.45vw, 0.875rem)' }}
                                    title={`${totalMannerScore}점 (${mannerRank.rank})`}
                                >
                                    {totalMannerScore}점 ({mannerRank.rank})
                                </span>
                                <Button
                                    type="button"
                                    onClick={() => setShowMannerRankModal(true)}
                                    colorScheme="none"
                                    className="!ml-auto !shrink-0 !whitespace-nowrap rounded-md border border-amber-500/55 bg-gradient-to-b from-zinc-700 to-zinc-800 px-1.5 py-0.5 !text-[9px] !font-semibold !leading-none !text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_rgba(0,0,0,0.35)] hover:border-amber-400/70 hover:from-zinc-600 hover:to-zinc-700 hover:!text-white sm:!px-2 sm:!py-0.5 sm:!text-[10px]"
                                    title="매너 등급 정보"
                                >
                                    등급 정보
                                </Button>
                            </div>
                            <div className="h-1.5 w-full rounded-full border border-color bg-tertiary/50 sm:h-2">
                                <div className={`${mannerStyle.colorClass} h-full rounded-full`} style={{ width: `${mannerStyle.percentage}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`flex w-full shrink-0 flex-col items-stretch ${nh ? 'mt-0.5 pt-0.5' : 'mt-0.5 pt-0.5'}`}>
                <div className="w-full min-w-0 overflow-hidden rounded-lg border border-zinc-600/80 bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-inner">
                    <div className={`${nh ? 'min-h-0 py-1 px-1' : 'min-h-[52px]'} ${nh ? '' : readableHome ? 'p-1.5 sm:p-2' : 'p-1 sm:p-1.5'}`}>
                    {!guildCheckDone ? (
                        <div className="w-full p-2 min-h-[40px]" aria-hidden="true" />
                    ) : guildInfo ? (
                            <div className="flex min-w-0 flex-nowrap items-center gap-1.5 px-0.5 py-1 sm:gap-2 sm:px-1 sm:py-1.5">
                                <div
                                    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-color bg-secondary/50 ${nh ? 'h-9 w-9' : 'h-9 w-9 sm:h-10 sm:w-10'}`}
                                >
                                    {guildInfo.icon ? (
                                        <img
                                            src={
                                                guildInfo.icon.startsWith('/images/guild/icon')
                                                    ? guildInfo.icon.replace('/images/guild/icon', '/images/guild/profile/icon')
                                                    : guildInfo.icon
                                            }
                                            alt={guildInfo.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <img src="/images/button/guild.png" alt="길드" className={`object-contain ${nh ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8'}`} />
                                    )}
                                </div>
                                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-1.5">
                                    <span
                                        className={`shrink-0 rounded-md border border-amber-500/45 bg-amber-950/45 font-semibold leading-tight text-amber-100 ${
                                            nh ? 'px-1.5 py-0 text-[10px]' : readableHome ? 'px-1.5 py-0.5 text-xs sm:px-2 sm:text-sm' : 'px-1.5 py-0.5 text-[11px] sm:text-xs'
                                        }`}
                                    >
                                        Lv.{guildInfo.level || 1}
                                    </span>
                                    <div
                                        className="min-w-0 truncate font-semibold text-white"
                                        style={{
                                            fontSize: nh
                                                ? 'clamp(0.78rem, 2.1vw, 0.9rem)'
                                                : readableHome
                                                  ? 'clamp(0.85rem, 1.8vw, 1rem)'
                                                  : 'clamp(0.82rem, 1.6vw, 0.95rem)',
                                        }}
                                        title={guildInfo.name}
                                    >
                                        {guildInfo.name}
                                    </div>
                                </div>
                                <Button
                                    onClick={() => (window.location.hash = '#/guild')}
                                    colorScheme="none"
                                    className={`!shrink-0 !whitespace-nowrap rounded-md border border-amber-500/55 bg-gradient-to-b from-zinc-700 to-zinc-800 !font-semibold !leading-none !text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_rgba(0,0,0,0.35)] hover:border-amber-400/70 hover:from-zinc-600 hover:to-zinc-700 hover:!text-white ${
                                        nh
                                            ? '!px-2 !py-1 !text-[10px]'
                                            : '!px-2 !py-1 !text-[10px] sm:!px-2.5 sm:!py-1 sm:!text-[11px]'
                                    }`}
                                    title="길드 홈 보기"
                                >
                                    길드 입장
                                </Button>
                            </div>
                    ) : guildLoadingFailed ? (
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="flex min-w-0 flex-1 flex-nowrap gap-2">
                                <Button onClick={() => setIsGuildCreateModalOpen(true)} colorScheme="none" className={`min-w-0 flex-1 justify-center whitespace-nowrap !py-0.5 rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 ${nh ? '!text-[10px]' : ''}`}>길드창설</Button>
                                <Button onClick={() => setIsGuildJoinModalOpen(true)} colorScheme="none" className={`min-w-0 flex-1 justify-center whitespace-nowrap !py-0.5 rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 ${nh ? '!text-[10px]' : ''}`}>길드가입</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full p-2 min-h-[40px]" aria-hidden="true" />
                    )}
                    </div>
                </div>
            </div>
        </div>
        );
    }, [currentUserWithStatus, handlers, mannerRank, mannerStyle, totalMannerScore, guildInfo, guilds, guildCheckDone, guildLoadingFailed, combinedLevel, nickname, avatarUrl, borderUrl, isNativeMobile, usePcHomePanelStyle, webHomeProfileLayout]);

    const AbilityStatsPanelContent = useMemo(() => {
        const nh = isNativeMobile && !usePcHomePanelStyle;
        const readableHome = usePcHomePanelStyle;
        const finalByStat = {} as Record<CoreStat, number>;
        const baseByStat = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            const baseStats = currentUserWithStatus.baseStats || {};
            const spentStatPoints = currentUserWithStatus.spentStatPoints || {};
            const baseValue = (baseStats[stat] || 0) + (spentStatPoints[stat] || 0);
            const bonusInfo = coreStatBonuses[stat] || { percent: 0, flat: 0 };
            const finalValue = Math.floor((baseValue + bonusInfo.flat) * (1 + bonusInfo.percent / 100));
            finalByStat[stat] = isNaN(finalValue) ? 0 : finalValue;
            baseByStat[stat] = baseValue;
        }
        const badukAbilityTotal = Object.values(finalByStat).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
        return (
            <div
                className={`flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center ${nh ? 'gap-[clamp(0.2rem,0.85dvh,0.45rem)] overflow-x-hidden' : 'gap-[clamp(0.35rem,1dvh,0.5rem)] overflow-hidden'}`}
            >
                <div className={`relative w-full max-w-[min(100%,24rem)] shrink-0 overflow-hidden rounded-xl border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 shadow-[0_10px_32px_-14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] sm:max-w-[min(100%,26rem)] ${nh ? 'px-[clamp(0.32rem,1.35vw,0.48rem)] py-[clamp(0.24rem,0.95dvh,0.42rem)] max-[760px]:px-[0.28rem] max-[760px]:py-[0.2rem] max-[680px]:px-[0.24rem] max-[680px]:py-[0.16rem]' : 'px-[clamp(0.45rem,1.2vw,0.65rem)] py-[clamp(0.35rem,1.2dvh,0.55rem)] sm:px-3 sm:py-2.5'}`}>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" aria-hidden />
                    <div className="relative flex w-full min-w-0 flex-row flex-wrap items-start gap-x-2 gap-y-1 sm:gap-x-2.5 md:gap-x-3 max-[760px]:gap-x-1.5 max-[760px]:gap-y-0.5 max-[680px]:gap-x-1">
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-start gap-x-1 gap-y-0.5 text-left sm:gap-x-1.5 md:gap-x-2">
                            <span
                                className={`shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text text-left font-bold tracking-tight text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.25)] ${nh ? 'text-sm' : readableHome ? 'text-base sm:text-lg md:text-xl' : 'text-sm sm:text-base md:text-lg'}`}
                            >
                                바둑능력
                            </span>
                            <span
                                className={`min-w-0 bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text text-left font-mono font-black tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${nh ? 'text-[1.15rem]' : readableHome ? 'text-[1.35rem] sm:text-[1.65rem] md:text-[2rem]' : 'text-[1.2rem] sm:text-xl md:text-2xl'}`}
                                title="6개 핵심 능력치 합계"
                            >
                                {badukAbilityTotal}
                            </span>
                        </div>
                        <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 text-right sm:gap-1.5 max-[760px]:gap-0.5">
                            <span
                                className={`max-w-[min(9.6rem,58vw)] break-words font-medium text-amber-100/85 sm:max-w-[11rem] md:max-w-none ${nh ? 'text-[10px]' : readableHome ? 'text-xs sm:text-sm md:text-base' : 'text-[11px] sm:text-xs md:text-sm'}`}
                                title={`보너스: ${availablePoints}P`}
                            >
                                보너스{' '}
                                <span className="font-bold tabular-nums text-emerald-300">{availablePoints}</span>
                                <span className="text-amber-100/55">P</span>
                            </span>
                            <Button
                                onClick={handlers.openStatAllocationModal}
                                colorScheme="none"
                                className={`!shrink-0 !whitespace-nowrap !rounded-lg !border !border-indigo-400/45 !bg-gradient-to-r !from-indigo-500/90 !via-violet-500/85 !to-fuchsia-500/80 !font-semibold !text-white !shadow-[0_6px_20px_-8px_rgba(99,102,241,0.55)] hover:!brightness-110 ${nh ? '!px-2 !py-0.5 !text-[9px]' : '!px-2 !py-0.5 !text-[10px] sm:!px-2.5 sm:!py-1 sm:!text-[11px]'}`}
                            >
                                분배
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center overflow-y-auto overflow-x-hidden overscroll-y-contain">
                    <CoreStatsHexagonChart
                        values={finalByStat}
                        baseByStat={baseByStat}
                        className="min-h-0 w-full min-w-0 max-w-[min(100%,26rem)] flex-1 sm:max-w-[min(100%,28rem)]"
                        desktopLike={usePcHomePanelStyle}
                        mobileReadable={usePcHomePanelStyle}
                        profileMobileCompact={nh}
                    />
                </div>
            </div>
        );
    }, [currentUserWithStatus, handlers, availablePoints, coreStatBonuses, isNativeMobile, usePcHomePanelStyle]);
    
    const singleProgress = currentUserWithStatus.singlePlayerProgress ?? 0;
    const singleStageLabel = singleProgress >= 40 ? '유단자'
        : singleProgress >= 30 ? '고급반'
        : singleProgress >= 20 ? '중급반'
        : singleProgress >= 10 ? '초급반'
        : '입문반';
    const towerCurrentFloor = Math.max(1, (currentUserWithStatus as User)?.towerFloor ?? 0);
    const towerCurrentRank = (currentUserWithStatus as any)?.monthlyTowerRank ?? (currentUserWithStatus as any)?.towerRank ?? null;
    const strategicTotal = aggregatedStats.strategic.wins + aggregatedStats.strategic.losses;
    const playfulTotal = aggregatedStats.playful.wins + aggregatedStats.playful.losses;
    const strategicWinRate = strategicTotal > 0 ? Math.round((aggregatedStats.strategic.wins / strategicTotal) * 100) : 0;
    const playfulWinRate = playfulTotal > 0 ? Math.round((aggregatedStats.playful.wins / playfulTotal) * 100) : 0;
    const dungeonProgress = (currentUserWithStatus as any)?.dungeonProgress ?? {};

    /** 2×3: 1행 싱글·탑 / 2행 전략·놀이 / 3행 챔피언십·모험 (PC·모바일 홈 외 공용; 모바일 경기장 전용 화면은 별도) */
    const lobbyGridShell = isNativeMobile
        ? (profileTab === 'home'
            ? 'grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[repeat(6,minmax(0,10.5rem))] gap-1.5 overflow-y-auto overscroll-y-contain px-0.5 pb-0.5 [&>*]:min-h-0 [&>*]:min-w-0'
            : 'grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-[repeat(3,minmax(0,1fr))] gap-1.5 overflow-hidden px-0.5 pb-0.5 [&>*]:min-h-0 [&>*]:min-w-0')
        : 'grid h-full min-h-0 w-full content-center grid-cols-2 grid-rows-[repeat(3,minmax(0,15rem))] gap-2.5 lg:gap-3 lg:grid-rows-[repeat(3,minmax(0,17.5rem))] [&>*]:min-h-0 [&>*]:min-w-0';

    const mergedCardClass = 'flex h-full min-h-0 overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10';
    const imagePaneClass = 'min-h-0 min-w-0 flex-[1.78] p-0.5';
    /** PC 경기장 카드 우측: 타이틀 상단·버튼 하단 고정, 중간 통계 블록 세로 중앙 */
    const infoPanelShellClass =
        'flex h-full min-h-0 min-w-[196px] flex-[0.92] flex-col gap-2 border-l border-amber-200/15 bg-gradient-to-b from-zinc-900/90 to-black/84 p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
    const infoPanelMiddleClass =
        'flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch justify-center gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]';
    const infoTitleClass =
        'inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-gradient-to-r from-amber-950/55 via-zinc-900/65 to-amber-950/55 px-2 py-1 text-[15px] font-black tracking-tight text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-8px_rgba(251,191,36,0.4)]';
    const infoRowClass =
        'grid w-full min-w-0 grid-cols-[minmax(4.25rem,auto)_minmax(0,1fr)] items-center gap-x-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[12.5px] leading-snug';
    const infoLabelClass = 'min-w-0 text-center font-semibold text-slate-300/95';
    const infoValueClass = 'min-w-0 w-full text-center font-semibold text-slate-100/95 whitespace-normal break-keep';
    const LobbyCards = (
        <div className={lobbyGridShell}>
            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <div
                        onClick={onSelectSinglePlayerLobby}
                        className="group border border-emerald-400/40 flex h-full min-h-0 w-full flex-col rounded-xl text-center shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-all transform hover:-translate-y-1 hover:shadow-green-500/30 cursor-pointer text-on-panel relative overflow-hidden p-1"
                    >
                        <img src={SINGLE_PLAYER_LOBBY_IMG} alt="싱글플레이" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                        <h2 className="relative z-[1] mb-0.5 h-4 text-[10px] font-bold leading-tight text-white">싱글플레이</h2>
                        <div className="flex min-h-0 w-full flex-1 rounded-md" />
                    </div>
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <div
                                onClick={onSelectSinglePlayerLobby}
                                className="group flex h-full min-h-0 w-full flex-col rounded-xl text-center transition-all transform hover:-translate-y-1 hover:shadow-green-500/30 cursor-pointer text-on-panel relative overflow-hidden"
                            >
                                <img src={SINGLE_PLAYER_LOBBY_IMG} alt="싱글플레이" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                                <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                                <div className="flex min-h-0 w-full flex-1 rounded-md" />
                            </div>
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>싱글플레이</div>
                            <div className={infoPanelMiddleClass}>
                                <div className={infoRowClass}><span className={infoLabelClass}>현재 위치</span><span className={infoValueClass}>{singleStageLabel}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>진행도</span><span className={infoValueClass}>{singleProgress} / {SINGLE_PLAYER_STAGES.length}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>클리어</span><span className={infoValueClass}>{Math.max(0, singleProgress)}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <PveCard title="도전의 탑" imageUrl="/images/tower/Tower1.png" layout="tall" onClick={() => window.location.hash = '#/tower'} compact={true} />
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <PveCard title="도전의 탑" imageUrl="/images/tower/Tower1.png" layout="tall" onClick={() => window.location.hash = '#/tower'} compact={false} hideOverlayText={true} />
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>도전의 탑</div>
                            <div className={infoPanelMiddleClass}>
                                <div className={infoRowClass}><span className={infoLabelClass}>현재 층</span><span className={infoValueClass}>{towerCurrentFloor}층</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>남은 시간</span><span className={infoValueClass}>{towerTimeLeft}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>현재 순위</span><span className={infoValueClass}>{towerCurrentRank ? `${towerCurrentRank}위` : '-'}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} compact={true} />
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} compact={false} hideOverlayText={true} hideOverlayFooter={true} />
                        </div>
                        <div className={`${infoPanelShellClass} border-cyan-300/20`}>
                            <div className={`${infoTitleClass} text-cyan-100`}>전략 바둑</div>
                            <div className={infoPanelMiddleClass}>
                                <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-950/30 px-2.5 py-2">
                                    {overallTiers.strategicTier?.icon && <img src={overallTiers.strategicTier.icon} alt={overallTiers.strategicTier.name} className="h-7 w-7 shrink-0 rounded-md object-contain ring-1 ring-white/20" />}
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                        <span className="min-w-0 truncate text-left text-[12px] font-semibold text-cyan-100/90">{overallTiers.strategicTier.name}</span>
                                        <span className="shrink-0 text-sm font-bold tabular-nums text-cyan-50">Lv.{currentUserWithStatus.strategyLevel}</span>
                                    </div>
                                </div>
                                <div className={infoRowClass}><span className={infoLabelClass}>통합 점수</span><span className={`${infoValueClass} font-mono text-cyan-200`}>{overallTiers.strategicIntegratedScore}점</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>전적</span><span className={`${infoValueClass} font-mono whitespace-nowrap`}>{aggregatedStats.strategic.wins}승{aggregatedStats.strategic.losses}패({strategicWinRate}%)</span></div>
                            </div>
                            <Button onClick={() => setDetailedStatsType('strategic')} colorScheme="none" className="w-full shrink-0 !justify-center rounded-lg border border-cyan-300/35 bg-cyan-950/45 !px-2 !py-1.5 !text-[12px] !font-bold !text-cyan-50 hover:bg-cyan-900/55">
                                상세보기
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} compact={true} />
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} compact={false} hideOverlayText={true} hideOverlayFooter={true} />
                        </div>
                        <div className={`${infoPanelShellClass} border-amber-300/20`}>
                            <div className={`${infoTitleClass} text-amber-100`}>놀이 바둑</div>
                            <div className={infoPanelMiddleClass}>
                                <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-950/30 px-2.5 py-2">
                                    {overallTiers.playfulTier?.icon && <img src={overallTiers.playfulTier.icon} alt={overallTiers.playfulTier.name} className="h-7 w-7 shrink-0 rounded-md object-contain ring-1 ring-white/20" />}
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                        <span className="min-w-0 truncate text-left text-[12px] font-semibold text-amber-100/90">{overallTiers.playfulTier.name}</span>
                                        <span className="shrink-0 text-sm font-bold tabular-nums text-amber-50">Lv.{currentUserWithStatus.playfulLevel}</span>
                                    </div>
                                </div>
                                <div className={infoRowClass}><span className={infoLabelClass}>통합 점수</span><span className={`${infoValueClass} font-mono text-amber-200`}>{overallTiers.playfulIntegratedScore}점</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>전적</span><span className={`${infoValueClass} font-mono whitespace-nowrap`}>{aggregatedStats.playful.wins}승{aggregatedStats.playful.losses}패({playfulWinRate}%)</span></div>
                            </div>
                            <Button onClick={() => setDetailedStatsType('playful')} colorScheme="none" className="w-full shrink-0 !justify-center rounded-lg border border-amber-300/35 bg-amber-950/45 !px-2 !py-1.5 !text-[12px] !font-bold !text-amber-50 hover:bg-amber-900/55">
                                상세보기
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <div onClick={onSelectTournamentLobby} className="group border border-fuchsia-400/40 flex h-full min-h-0 w-full flex-col rounded-xl text-center shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-all transform hover:-translate-y-1 hover:shadow-purple-500/30 cursor-pointer text-on-panel p-1 relative overflow-hidden">
                        <img src={TOURNAMENT_LOBBY_IMG} alt="챔피언십" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                        <h2 className="relative z-[1] mb-0.5 h-4 text-[10px] font-bold leading-tight text-white">챔피언십</h2>
                        <div className="flex min-h-0 w-full flex-1 rounded-md" />
                    </div>
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <div onClick={onSelectTournamentLobby} className="group flex h-full min-h-0 w-full flex-col text-center transition-all transform hover:-translate-y-1 hover:shadow-purple-500/30 cursor-pointer text-on-panel relative overflow-hidden rounded-xl">
                                <img src={TOURNAMENT_LOBBY_IMG} alt="챔피언십" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                                <div className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                                <div className="flex min-h-0 w-full flex-1 rounded-md" />
                            </div>
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>챔피언십</div>
                            <div className={infoPanelMiddleClass}>
                                <div className={infoRowClass}><span className={infoLabelClass}>시즌 점수</span><span className={infoValueClass}>{championshipScore}점</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>현재 순위</span><span className={infoValueClass}>{championshipRank != null ? `${championshipRank}위` : '100+위'}</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>동네리그</span><span className={infoValueClass}>{dungeonProgress.neighborhood?.currentStage ?? 0}단계</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>전국대회</span><span className={infoValueClass}>{dungeonProgress.national?.currentStage ?? 0}단계</span></div>
                                <div className={infoRowClass}><span className={infoLabelClass}>월드전</span><span className={infoValueClass}>{dungeonProgress.world?.currentStage ?? 0}단계</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
                {isNativeMobile && profileTab !== 'home' ? (
                    <PveCard title="모험" imageUrl={STRATEGIC_GO_LOBBY_IMG} layout="tall" isComingSoon={true} compact={true} />
                ) : (
                    <div className={mergedCardClass}>
                        <div className={imagePaneClass}>
                            <PveCard title="모험" imageUrl={STRATEGIC_GO_LOBBY_IMG} layout="tall" isComingSoon={true} compact={false} hideOverlayText={true} />
                        </div>
                        <div className={infoPanelShellClass}>
                            <div className={infoTitleClass}>모험</div>
                            <div className={infoPanelMiddleClass}>
                                <div className={infoRowClass}><span className={infoLabelClass}>상태</span><span className={infoValueClass}>오픈 예정</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
    return (
        <div
            className={`bg-transparent text-primary flex w-full flex-col ${isNativeMobile ? 'sudamr-native-route-root h-full max-h-full min-h-0' : 'h-full p-2 sm:p-4 lg:p-2'}`}
        >
            {(isNativeMobile ? profileTab !== 'home' : false) && (
                <header className={`flex min-w-0 flex-shrink-0 items-center ${isNativeMobile ? 'mb-0 px-1 py-1.5' : 'mb-1 px-1 lg:mb-2 lg:px-2'}`}>
                    <h1 className={`min-w-0 truncate font-bold text-primary ${isNativeMobile ? 'text-sm sm:text-base' : 'text-base lg:text-2xl'}`}>
                        {profileTab === 'ranking' ? '랭킹' : '경기장'}
                    </h1>
                </header>
            )}
            <main
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
                {isNativeMobile ? (
                    <>
                        {profileTab === 'home' && (
                            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-1 overflow-hidden max-[760px]:gap-0.5 max-[680px]:gap-[0.18rem]">
                                <div className="grid h-full min-h-0 w-full min-w-0 grid-rows-[minmax(0,1.14fr)_minmax(0,0.93fr)_minmax(0,0.93fr)] gap-[clamp(0.18rem,0.65dvh,0.38rem)] overflow-hidden max-[760px]:grid-rows-[minmax(0,1.18fr)_minmax(0,0.91fr)_minmax(0,0.91fr)] max-[760px]:gap-[clamp(0.14rem,0.5dvh,0.3rem)] max-[680px]:grid-rows-[minmax(0,1.22fr)_minmax(0,0.89fr)_minmax(0,0.89fr)] max-[680px]:gap-[0.12rem]">
                                    <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                                    <div
                                        className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden text-on-panel ${
                                            usePcHomePanelStyle ? profileStackPanelPadProfilePc : profileStackPanelPad
                                        }`}
                                    >
                                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                            <div className={profileStackScrollInnerClass}>
                                                {ProfilePanelContent}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                    <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_40px_-20px_rgba(0,0,0,0.7)] ring-1 ring-amber-100/10">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                                    <div className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden ${profileStackPanelPad}`}>
                                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                            <div className={profileStackScrollInnerClass}>
                                                {EquipmentPanelContent}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                    <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_50px_-22px_rgba(0,0,0,0.72)] ring-1 ring-amber-100/10">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                                    <div className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden ${profileStackPanelPad}`}>
                                        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                            <div className={profileStackScrollInnerClass}>
                                                {AbilityStatsPanelContent}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>
                        )}
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
                            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 pb-1">
                                <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-2.5">
                                    <div className="flex min-h-0 min-w-0 flex-[1.05] basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <LobbyCard
                                            type="strategic"
                                            stats={aggregatedStats.strategic}
                                            onEnter={() => onSelectLobby('strategic')}
                                            onViewStats={() => setDetailedStatsType('strategic')}
                                            level={currentUserWithStatus.strategyLevel}
                                            title="전략 바둑"
                                            imageUrl={STRATEGIC_GO_LOBBY_IMG}
                                            tier={overallTiers.strategicTier}
                                            integratedRankingScore={overallTiers.strategicIntegratedScore}
                                            arenaMobile
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <ArenaMobileStatStrip
                                            variant="strategic"
                                            agg={aggregatedStats.strategic}
                                            integratedScore={overallTiers.strategicIntegratedScore}
                                            tier={overallTiers.strategicTier}
                                            level={currentUserWithStatus.strategyLevel}
                                            onOpenModal={() => setDetailedStatsType('strategic')}
                                        />
                                    </div>
                                </div>
                                <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-2.5">
                                    <div className="flex min-h-0 min-w-0 flex-[1.05] basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <LobbyCard
                                            type="playful"
                                            stats={aggregatedStats.playful}
                                            onEnter={() => onSelectLobby('playful')}
                                            onViewStats={() => setDetailedStatsType('playful')}
                                            level={currentUserWithStatus.playfulLevel}
                                            title="놀이 바둑"
                                            imageUrl={PLAYFUL_GO_LOBBY_IMG}
                                            tier={overallTiers.playfulTier}
                                            integratedRankingScore={overallTiers.playfulIntegratedScore}
                                            arenaMobile
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <ArenaMobileStatStrip
                                            variant="playful"
                                            agg={aggregatedStats.playful}
                                            integratedScore={overallTiers.playfulIntegratedScore}
                                            tier={overallTiers.playfulTier}
                                            level={currentUserWithStatus.playfulLevel}
                                            onOpenModal={() => setDetailedStatsType('playful')}
                                        />
                                    </div>
                                </div>
                                <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-2.5">
                                    <div className="flex min-h-0 min-w-0 flex-[1.05] basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <PveCard
                                            title="모험"
                                            imageUrl={STRATEGIC_GO_LOBBY_IMG}
                                            layout="tall"
                                            isComingSoon
                                            arenaMobile
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <ArenaMobilePvpStatStrip />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-1.5 overflow-hidden">
                    {/* 좌측: 프로필 패널(스크롤 없음) + 능력치 / 중앙: 입장 카드 / 우측: 퀵 메뉴 */}
                    <div className="grid h-full min-h-0 w-[min(43%,500px)] min-w-[292px] max-w-[500px] shrink-0 grid-rows-[repeat(3,minmax(0,1fr))] gap-[clamp(0.3rem,0.9dvh,0.45rem)] overflow-hidden">
                        <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                            <div
                                className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden text-on-panel ${profileStackPanelPadProfilePc}`}
                            >
                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                    <div className={profileStackScrollInnerClass}>
                                        {ProfilePanelContent}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_40px_-20px_rgba(0,0,0,0.7)] ring-1 ring-amber-100/10">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                            <div className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden ${profileStackPanelPad}`}>
                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                    <div className={profileStackScrollInnerClass}>
                                        {EquipmentPanelContent}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_50px_-22px_rgba(0,0,0,0.72)] ring-1 ring-amber-100/10">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                            <div className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden ${profileStackPanelPad}`}>
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]">
                                    <div className={profileStackScrollInnerClass}>
                                        {AbilityStatsPanelContent}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden rounded-lg border border-zinc-600/80 bg-panel p-1 shadow-inner">
                        <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(100%,1040px)] flex-col justify-center">
                            {LobbyCards}
                        </div>
                    </div>
                    <div
                        className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}
                        aria-label="퀵 메뉴"
                    >
                        <div className="flex h-full min-h-0 flex-col rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40">
                            <QuickAccessSidebar fillHeight={true} />
                        </div>
                    </div>
                </div>
                )}
            </main>
            {detailedStatsType && (
                <DetailedStatsModal
                    currentUser={currentUserWithStatus}
                    statsType={detailedStatsType}
                    onClose={() => setDetailedStatsType(null)}
                    onAction={handlers.handleAction}
                />
            )}
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
        </div>
    );
};

export default Profile;