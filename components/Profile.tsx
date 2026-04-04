import React, { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { UserWithStatus, GameMode, EquipmentSlot, InventoryItem, ItemGrade, ServerAction, LeagueTier, CoreStat, SpecialStat, MythicStat, ItemOptionType, TournamentState, User } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, LEAGUE_DATA, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, emptySlotImages, TOURNAMENT_DEFINITIONS, GRADE_LEVEL_REQUIREMENTS, RANKING_TIERS, SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS } from '../constants';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG } from '../assets.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DetailedStatsModal from './DetailedStatsModal.js';
import DraggableWindow from './DraggableWindow.js';
import ProfileEditModal from './ProfileEditModal.js';
import { getMannerScore, getMannerRank, getMannerStyle } from '../services/manner.js';
import { calculateUserEffects } from '../services/effectService.js';
import { useAppContext } from '../hooks/useAppContext.js';
import QuickAccessSidebar, { NATIVE_QUICK_RAIL_WIDTH_CLASS } from './QuickAccessSidebar.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import GameRankingBoard from './GameRankingBoard.js';
import BadukRankingBoard from './BadukRankingBoard.js';
import ChampionshipRankingPanel from './ChampionshipRankingPanel.js';
import { useRanking } from '../hooks/useRanking.js';
import MannerRankModal from './MannerRankModal.js';
import HomeBoardPanel from './HomeBoardPanel.js';
import GuildCreateModal from './guild/GuildCreateModal.js';
import GuildJoinModal from './guild/GuildJoinModal.js';
import type { Guild } from '../types/entities.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface ProfileProps {
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
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
                <span className="min-w-0 truncate font-semibold" style={{ fontSize: fs }}>{label} <span className="text-base font-bold">Lv.{level}</span></span>
                <span className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-tertiary" style={{ fontSize: fs }}>{currentXp} / {maxXp}</span>
            </div>
            <div className="w-full bg-tertiary/50 rounded-full h-3 border border-color">
                <div className={`${colorClass} h-full rounded-full transition-width duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const CombinedLevelBadge: React.FC<{ level: number; compact?: boolean }> = ({ level, compact = false }) => {
    return (
        <div className={`flex-shrink-0 bg-tertiary/40 rounded-md border border-color flex items-center justify-center text-center ${compact ? 'w-12 px-1 py-1' : 'w-16 px-2 py-2'}`}>
            <span className={`font-bold leading-none text-highlight whitespace-nowrap ${compact ? 'text-base' : 'text-2xl'}`}>Lv.{level}</span>
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
    const itemImgPct = Math.min(96, (compact ? 72 : 80) * scaleFactor);
    
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
    /** 네이티브 경기장 탭: 세로 스택용 큰 텍스트 */
    arenaMobile?: boolean;
    /** 경기장 탭: 해당 경기장 통합 랭킹 점수(모드 평균) */
    integratedRankingScore?: number;
}> = ({ type, stats, onEnter, onViewStats, level, title, imageUrl, tier, compact, arenaMobile, integratedRankingScore }) => {
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
            className={`bg-panel border border-color rounded-lg flex flex-col text-center transition-all transform shadow-lg ${shadowColor} cursor-pointer text-on-panel ${compactMode ? 'min-h-0 p-0.5' : 'h-full p-1 hover:-translate-y-1 lg:p-2'}`}
        >
             <h2 className={`font-bold flex items-center justify-center gap-0.5 ${compactMode ? 'mb-0 text-[8px] leading-tight' : 'mb-0.5 h-4 text-xs lg:mb-1 lg:h-6 lg:gap-1 lg:text-base'}`}>
                {title}
                {tier && <img src={tier.icon} alt={tier.name} className={compactMode ? 'h-2.5 w-2.5' : 'h-3 w-3 lg:h-5 lg:w-5'} title={tier.name} />}
                <span className={`text-highlight font-normal ${compactMode ? 'text-[8px]' : 'text-[10px] lg:text-sm'}`}>Lv.{level}</span>
            </h2>
            <div
                className={`w-full overflow-hidden rounded-md bg-tertiary ${compactMode ? 'h-[3.25rem] flex-none' : 'min-h-0 flex-1'}`}
            >
                <img src={imageUrl} alt={title} className="h-full w-full object-cover object-center" />
            </div>
            <div
                onClick={(e) => { e.stopPropagation(); onViewStats(); }}
                className={`mt-0.5 flex w-full cursor-pointer items-center justify-between rounded-md bg-tertiary/50 hover:bg-tertiary ${compactMode ? 'px-0.5 py-px text-[7px]' : 'mt-1 p-0.5 text-[10px] transition-colors lg:mt-2 lg:p-1 lg:text-xs'}`}
                title="상세 전적 보기"
            >
                <span className="min-w-0 truncate">{compactMode ? `${stats.wins}승${stats.losses}패 ${winRate}%` : `총 전적: ${stats.wins}승 ${stats.losses}패 (${winRate}%)`}</span>
                <span className="flex-shrink-0 text-accent font-semibold">&rarr;</span>
            </div>
        </div>
    );
};

const PveCard: React.FC<{ title: string; imageUrl: string; layout: 'grid' | 'tall'; footerContent?: React.ReactNode; onClick?: () => void; isComingSoon?: boolean; compact?: boolean; arenaMobile?: boolean }> = ({ title, imageUrl, layout, footerContent, onClick, isComingSoon, compact, arenaMobile }) => {
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
            className={`${isComingSoon ? 'bg-panel border border-color opacity-60 grayscale' : 'bg-panel border border-color'} relative flex flex-col overflow-hidden rounded-lg text-center shadow-lg text-on-panel ${compactMode ? 'min-h-0 p-0.5' : 'h-full p-1 transform transition-all lg:p-2'} ${isComingSoon ? 'cursor-not-allowed' : onClick ? `cursor-pointer ${compactMode ? '' : `hover:-translate-y-1 ${shadowColor}`}` : 'cursor-not-allowed'} group`}
        >
            {isComingSoon && (
                <div className={`absolute z-10 -right-6 rotate-45 bg-purple-600 font-bold text-white ${compactMode ? 'top-0 px-6 py-px text-[6px]' : 'top-1 px-8 py-0.5 text-[8px] lg:top-2 lg:-right-10 lg:px-10 lg:text-[10px]'}`}>
                    Coming Soon
                </div>
            )}
            <h2 className={`font-bold ${compactMode ? 'mb-0 mt-0 text-[8px]' : 'mb-0.5 mt-0.5 h-4 text-xs lg:mb-1 lg:mt-1 lg:h-6 lg:text-base'} ${isComingSoon ? 'text-gray-400' : ''}`}>{title}</h2>
            <div
                className={`w-full overflow-hidden rounded-md bg-tertiary ${compactMode ? 'h-[3rem] flex-none' : 'min-h-0 flex-1'} flex items-center justify-center text-tertiary transition-transform duration-300 ${!isComingSoon && !compactMode && 'group-hover:scale-105'}`}
            >
                <img src={imageUrl} alt={title} className="h-full w-full object-cover object-center" />
            </div>
            {footerContent && (
                <div className={`mt-0.5 w-full rounded-md bg-tertiary/50 ${compactMode ? 'p-px text-[7px]' : 'mt-1 p-0.5 text-[10px] lg:mt-2 lg:p-1 lg:text-xs'}`}>
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
    const divider = 'h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/25 to-transparent';

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
                        <span className="text-sm font-medium text-slate-500">Lv</span>
                        <span className={`font-mono text-lg font-bold tabular-nums tracking-tight sm:text-xl ${lvTone}`}>{level}</span>
                    </div>
                    <span className={divider} aria-hidden />
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-medium tracking-wide text-slate-500">통합</span>
                        <span className={`font-mono text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl ${scoreTone}`}>{integratedScore}</span>
                        <span className="text-sm text-slate-500">점</span>
                    </div>
                </div>

                <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent" />

                {/* 중앙: 총 전적 */}
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">총 전적</span>
                    <p className="text-center font-mono text-[1.75rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-[2rem]">
                        <span>{agg.wins}</span>
                        <span className="mx-0.5 align-baseline text-[0.55em] font-bold text-slate-500">승</span>
                        <span className="mx-1 text-slate-600">·</span>
                        <span>{agg.losses}</span>
                        <span className="ml-0.5 align-baseline text-[0.55em] font-bold text-slate-500">패</span>
                    </p>
                    <p className="text-sm text-slate-400">
                        승률{' '}
                        <span className={`font-mono text-base font-semibold tabular-nums sm:text-lg ${rateTone}`}>{pct(agg.wins, agg.losses)}%</span>
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

/** 능력 PVP 행 — 입장카드 높이에 맞춘 플레이스홀더 */
const ArenaMobilePvpStatStrip: React.FC = () => (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-purple-500/30 bg-gradient-to-b from-purple-950/40 via-slate-950/90 to-slate-950/98 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.05]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/25 to-transparent" />
        <span className="bg-gradient-to-r from-fuchsia-200 via-purple-100 to-violet-200 bg-clip-text text-sm font-bold tracking-wide text-transparent sm:text-base">능력 PVP</span>
        <span className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">오픈 예정</span>
    </div>
);


const Profile: React.FC<ProfileProps> = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats, hasClaimableQuest, presets, homeBoardPosts, guilds, currentRoute } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const profileTab = (currentRoute.params?.tab as 'home' | 'ranking' | 'arena' | undefined) ?? 'home';
    const { rankings: championshipRankings } = useRanking('championship', 100, 0);
    const championshipMyEntry = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return championshipRankings.find(e => e.id === currentUserWithStatus.id) ?? null;
    }, [championshipRankings, currentUserWithStatus]);
    const championshipScore = championshipMyEntry?.score ?? currentUserWithStatus?.cumulativeTournamentScore ?? 0;
    const championshipRank = championshipMyEntry?.rank ?? null;
    const [detailedStatsType, setDetailedStatsType] = useState<'strategic' | 'playful' | null>(null);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [towerTimeLeft, setTowerTimeLeft] = useState('');
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [showMannerRankModal, setShowMannerRankModal] = useState(false);
    const [isGuildCreateModalOpen, setIsGuildCreateModalOpen] = useState(false);
    const [isGuildJoinModalOpen, setIsGuildJoinModalOpen] = useState(false);

    /** 홈 상단 행 높이 = 퀵메뉴(정사각 버튼 누적) 고유 높이 — 프로필·장비 패널과 하단 정렬 */
    const nativeHomeQuickMeasureRef = useRef<HTMLDivElement>(null);
    const [nativeHomeTopRowHeightPx, setNativeHomeTopRowHeightPx] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (!isNativeMobile || profileTab !== 'home' || !currentUserWithStatus) {
            setNativeHomeTopRowHeightPx(null);
            return;
        }
        const outer = nativeHomeQuickMeasureRef.current;
        if (!outer) return;
        const update = () => {
            const inner = outer.querySelector<HTMLElement>('[data-quick-access-sidebar-root]');
            if (!inner) return;
            // 전체 래퍼(테두리·패딩·퀵 루트) 기준 — inner만 더하면 누락/반올림으로 하단이 잘릴 수 있음
            const boxH = Math.ceil(
                Math.max(outer.getBoundingClientRect().height, outer.scrollHeight, outer.offsetHeight)
            );
            const h = boxH > 0 ? boxH : 0;
            if (h > 0) setNativeHomeTopRowHeightPx(h);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(outer);
        const innerRoot = outer.querySelector('[data-quick-access-sidebar-root]');
        if (innerRoot) ro.observe(innerRoot);
        return () => ro.disconnect();
    }, [isNativeMobile, profileTab, currentUserWithStatus]);

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const nextMonth = new Date(year, month + 1, 1);
            const diff = nextMonth.getTime() - now.getTime();

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTowerTimeLeft(`${days}일 ${hours}시간 남음`);
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
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    const prevChatLength = usePrevious(globalChat.length);

    useEffect(() => {
        if (prevChatLength !== undefined && globalChat.length > prevChatLength) {
            setHasNewMessage(true);
        }
    }, [globalChat.length, prevChatLength]);
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    const equippedItems = useMemo(() => {
        return (inventory || []).filter(item => item.isEquipped);
    }, [inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(item => item.slot === slot);
    };

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
    
    const ProfilePanelContent = useMemo(() => {
        const nh = isNativeMobile;
        return (
        <>
            <div className="flex min-w-0 flex-row items-center gap-1.5">
                <div className="flex w-20 flex-shrink-0 flex-col items-center gap-0.5">
                    <div className="relative">
                        <Avatar userId={currentUserWithStatus.id} userName={nickname} size={64} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                        <button 
                            onClick={handlers.openProfileEditModal}
                            className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center bg-secondary hover:bg-tertiary rounded-full p-1 border-2 border-primary transition-transform hover:scale-110 active:scale-95"
                            title="프로필 수정"
                        >
                            <span className="text-sm">✏️</span>
                            {!currentUserWithStatus.mbti && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>
                    </div>
                    <div className="flex w-full min-w-0 flex-col items-center">
                        <div className="flex w-full min-w-0 justify-center">
                            <h2 className="max-w-full truncate text-sm font-bold" style={{ fontSize: nh ? 'clamp(0.8125rem, 2.15vw, 0.9375rem)' : 'clamp(0.75rem, 2vw, 0.875rem)' }} title={nickname}>{nickname}</h2>
                        </div>
                         <p className="mt-0.5 max-w-full truncate text-tertiary" style={{ fontSize: nh ? 'clamp(0.6875rem, 1.65vw, 0.75rem)' : 'clamp(0.625rem, 1.5vw, 0.625rem)' }} title={currentUserWithStatus.mbti ? `MBTI: ${currentUserWithStatus.mbti}` : 'MBTI: 미설정'}>
                            MBTI: {currentUserWithStatus.mbti ? currentUserWithStatus.mbti : '미설정'}
                        </p>
                    </div>
                </div>
                
                <div className="min-w-0 flex-1 rounded-md bg-tertiary/30 p-1.5 flex flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <CombinedLevelBadge level={combinedLevel} compact={nh} />
                        <div className="flex min-w-0 flex-1 flex-col justify-center space-y-0.5">
                            <XpBar bumpText={nh} level={currentUserWithStatus.strategyLevel} currentXp={currentUserWithStatus.strategyXp} label="전략" colorClass="bg-gradient-to-r from-blue-500 to-cyan-400" />
                            <XpBar bumpText={nh} level={currentUserWithStatus.playfulLevel} currentXp={currentUserWithStatus.playfulXp} label="놀이" colorClass="bg-gradient-to-r from-yellow-500 to-orange-400" />
                        </div>
                    </div>
                    <button
                        onClick={() => setShowMannerRankModal(true)}
                        className="w-full min-w-0 text-left hover:bg-tertiary/50 rounded-md p-1 transition-all"
                        title="매너 등급 정보 보기"
                    >
                        <div className="mb-0.5 flex min-w-0 items-baseline justify-between gap-1 text-xs">
                            <span className="min-w-0 shrink-0 font-semibold" style={{ fontSize: nh ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)' : 'clamp(0.625rem, 1.5vw, 0.75rem)' }}>매너 등급</span>
                            <span className={`min-w-0 truncate text-right text-xs font-semibold ${mannerRank.color} cursor-pointer transition-all`} style={{ fontSize: nh ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)' : 'clamp(0.625rem, 1.5vw, 0.75rem)' }} title={`${totalMannerScore}점 (${mannerRank.rank})`}>
                                {totalMannerScore}점 ({mannerRank.rank})
                            </span>
                        </div>
                        <div className="w-full bg-tertiary/50 rounded-full h-2 border border-color">
                            <div className={`${mannerStyle.colorClass} h-full rounded-full`} style={{ width: `${mannerStyle.percentage}%` }}></div>
                        </div>
                    </button>
                </div>
            </div>        

            <div className="flex-grow flex flex-col min-h-0 border-t border-color mt-1 pt-1">
                <div className="bg-tertiary/30 p-1.5 rounded-md mb-1 min-h-[52px]">
                    {!guildCheckDone ? (
                        // 길드 확인이 끝나기 전에는 항상 빈칸 (버튼 절대 노출 안 함)
                        <div className="w-full p-2 min-h-[40px]" aria-hidden="true" />
                    ) : guildInfo ? (
                        // 길드가 있으면 길드 바로가기 버튼
                            <button
                                onClick={() => window.location.hash = '#/guild'}
                                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-tertiary/50 transition-all cursor-pointer border border-color/50 hover:border-accent/50"
                                title="길드 홈 보기"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-md bg-secondary/50 border border-color flex items-center justify-center overflow-hidden">
                                    {guildInfo.icon ? (
                                        <img src={guildInfo.icon.startsWith('/images/guild/icon') ? guildInfo.icon.replace('/images/guild/icon', '/images/guild/profile/icon') : guildInfo.icon} alt={guildInfo.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <img src="/images/button/guild.png" alt="길드" className="w-8 h-8 object-contain" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="truncate font-semibold text-white" style={{ fontSize: nh ? 'clamp(0.8125rem, 2.1vw, 0.9375rem)' : 'clamp(0.75rem, 2vw, 0.875rem)' }}>
                                        {guildInfo.name}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        Lv.{guildInfo.level || 1}
                                    </div>
                                </div>
                                <div className="flex-shrink-0 text-accent">
                                    →
                                </div>
                            </button>
                    ) : guildLoadingFailed ? (
                        // 확인 완료 후, 서버에서 '가입한 길드 없음'일 때만 창설/가입 버튼
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
                 <div className="mb-1 flex min-w-0 flex-shrink-0 items-center justify-between gap-1">
                    <h3 className="min-w-0 shrink-0 text-sm font-semibold text-secondary" style={{ fontSize: nh ? 'clamp(0.8125rem, 2.1vw, 0.9375rem)' : 'clamp(0.75rem, 2vw, 0.875rem)' }}>능력치</h3>
                    <div className="flex min-w-0 items-center gap-1 text-xs sm:gap-2">
                        <span className="min-w-0 truncate" style={{ fontSize: nh ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)' : 'clamp(0.625rem, 1.5vw, 0.75rem)' }} title={`보너스: ${availablePoints}P`}>보너스: <span className="font-bold text-green-400">{availablePoints}</span>P</span>
                        <Button 
                            onClick={handlers.openStatAllocationModal} 
                            colorScheme="none" 
                            className={`!shrink-0 !whitespace-nowrap !px-2 !py-0.5 rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_8px_20px_-12px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 ${nh ? '!text-[10px]' : '!text-[9px]'}`}
                        >
                            분배
                        </Button>
                    </div>
                </div>
                <div className={`grid grid-cols-2 gap-y-1 ${nh ? 'gap-x-2' : 'gap-x-4'}`}>
                    {Object.values(CoreStat).map(stat => {
						const baseStats = currentUserWithStatus.baseStats || {};
						const spentStatPoints = currentUserWithStatus.spentStatPoints || {};
						const baseValue = (baseStats[stat] || 0) + (spentStatPoints[stat] || 0);
						// Align with calculateTotalStats: final = floor((base + flat) * (1 + percent/100))
						const bonusInfo = coreStatBonuses[stat] || { percent: 0, flat: 0 };
						const finalValue = Math.floor((baseValue + bonusInfo.flat) * (1 + bonusInfo.percent / 100));
						const bonus = finalValue - baseValue;
                        return (
                            <div key={stat} className="flex min-w-0 items-center justify-between gap-0.5 rounded-md bg-tertiary/40 p-1 text-xs">
                                <span className="min-w-0 truncate font-semibold text-secondary" style={{ fontSize: nh ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)' : 'clamp(0.625rem, 1.5vw, 0.75rem)' }} title={stat}>{stat}</span>
                                <span className="shrink-0 whitespace-nowrap text-right font-mono font-bold tabular-nums" style={{ fontSize: nh ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)' : 'clamp(0.625rem, 1.5vw, 0.75rem)' }} title={`기본: ${baseValue}, 장비: ${bonus}`}>
                                    {isNaN(finalValue) ? 0 : finalValue}
                                    {bonus > 0 && <span className="ml-0.5 text-xs text-green-400">(+{bonus})</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
        );
    }, [currentUserWithStatus, handlers, mannerRank, mannerStyle, totalMannerScore, availablePoints, coreStatBonuses, guildInfo, guilds, guildCheckDone, guildLoadingFailed, combinedLevel, nickname, avatarUrl, borderUrl, isNativeMobile]);
    
    const LobbyCards = (
        <div className="grid grid-cols-12 grid-rows-2 gap-2 lg:gap-4 h-full">
            <div className="col-span-4 row-span-1">
                <LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} />
            </div>
    
            <div className="col-span-4 row-span-1">
                <LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} />
            </div>

            <div className="col-span-4 row-span-1">
                <PveCard 
                    title="바둑능력PVP" 
                    imageUrl={STRATEGIC_GO_LOBBY_IMG} 
                    layout="tall" 
                    isComingSoon={true}
                />
            </div>

            <div className="col-span-4 row-span-1">
                <div onClick={onSelectTournamentLobby} className="bg-panel border border-color rounded-lg p-1 lg:p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/30 cursor-pointer h-full text-on-panel">
                    <h2 className="text-xs lg:text-base font-bold flex items-center justify-center gap-0.5 lg:gap-1 h-4 lg:h-6 mb-0.5 lg:mb-1">챔피언십</h2>
                    <div className="w-full flex-1 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden min-h-0">
                        <img src={TOURNAMENT_LOBBY_IMG} alt="챔피언십" className="w-full h-full object-cover object-center" />
                    </div>
                    <div className="w-full bg-tertiary/50 rounded-md p-0.5 lg:p-1 text-[10px] lg:text-xs flex justify-between items-center cursor-pointer hover:bg-tertiary transition-colors mt-1 lg:mt-2" title="챔피언십 (던전)">
                        <span>현재 시즌 {championshipScore.toLocaleString()}점 · {championshipRank != null ? `${championshipRank}위` : '100+위'}</span>
                        <span className="text-accent font-semibold">&rarr;</span>
                    </div>
                </div>
            </div>

            <div className="col-span-4 row-span-1">
                <div onClick={onSelectSinglePlayerLobby} className="bg-panel border border-color rounded-lg p-1 lg:p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-green-500/30 cursor-pointer h-full text-on-panel relative">
                    {hasFullTrainingQuestReward && (
                        <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full z-10 border-2 border-gray-900"></div>
                    )}
                    <h2 className="text-xs lg:text-base font-bold flex items-center justify-center gap-0.5 lg:gap-1 h-4 lg:h-6 mb-0.5 lg:mb-1">싱글플레이</h2>
                    <div className="w-full flex-1 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden min-h-0">
                        <img src={SINGLE_PLAYER_LOBBY_IMG} alt="싱글플레이" className="w-full h-full object-cover object-center" />
                    </div>
                    <div className="w-full bg-tertiary/50 rounded-md p-0.5 lg:p-1 text-[10px] lg:text-xs flex justify-between items-center cursor-pointer hover:bg-tertiary transition-colors mt-1 lg:mt-2" title="싱글플레이 정보">
                        <span>진행도: {currentUserWithStatus.singlePlayerProgress ?? 0} / {SINGLE_PLAYER_STAGES.length}</span>
                        <span className="text-accent font-semibold">&rarr;</span>
                    </div>
                </div>
            </div>
                
            <div className="col-span-4 row-span-1">
                <PveCard 
                    title="도전의 탑" 
                    imageUrl="/images/tower/Tower1.png" 
                    layout="tall" 
                    onClick={() => window.location.hash = '#/tower'}
                    footerContent={
                        <div className="flex flex-col items-center">
                            <span>현재 층: {Math.max(1, (currentUserWithStatus as User)?.towerFloor ?? 0)}층</span>
                            <span className="text-tertiary">{towerTimeLeft}</span>
                        </div>
                    }
                />
            </div>
            </div>
        );
    return (
        <div
            className={`bg-primary text-primary flex w-full flex-col ${isNativeMobile ? 'sudamr-native-route-root h-full max-h-full min-h-0' : 'h-full p-2 sm:p-4 lg:p-2'}`}
        >
            <header className={`flex min-w-0 flex-shrink-0 items-center justify-between ${isNativeMobile ? 'mb-0 gap-1.5 px-1 py-1.5' : 'mb-1 px-1 lg:mb-2 lg:px-2'}`}>
                <h1 className={`min-w-0 truncate font-bold text-primary ${isNativeMobile ? 'text-sm sm:text-base' : 'text-base lg:text-2xl'}`}>
                    {isNativeMobile ? (profileTab === 'ranking' ? '랭킹' : profileTab === 'arena' ? '경기장' : '홈') : '홈'}
                </h1>
                <div className={`flex shrink-0 items-center ${isNativeMobile ? 'gap-1' : 'gap-1 lg:gap-2'}`}>
                    <button
                        onClick={handlers.openEncyclopedia}
                        className={`flex flex-shrink-0 items-center justify-center transition-transform hover:scale-110 ${isNativeMobile ? 'h-7 w-7' : 'h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10'}`}
                        title="도감"
                    >
                        <img src="/images/button/itembook.png" alt="도감" className="h-full w-full object-contain" />
                    </button>
                    <button
                        onClick={handlers.openInfoModal}
                        className={`flex flex-shrink-0 items-center justify-center transition-transform hover:scale-110 ${isNativeMobile ? 'h-7 w-7' : 'h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10'}`}
                        title="도움말"
                    >
                        <img src="/images/button/help.webp" alt="도움말" className="h-full w-full object-contain" />
                    </button>
                </div>
            </header>
            <main
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
                {isNativeMobile ? (
                    <>
                        {profileTab === 'home' && (
                            <div className="grid h-full w-full min-h-0 min-w-0 max-w-full flex-1 grid-rows-[auto_minmax(0,1fr)] gap-y-0.5 overflow-hidden px-0.5 pb-0">
                                {/* 상단: 프로필·장비·퀵 동일 행 높이(stretch), 퀵은 fillHeight로 하단 정렬 */}
                                <div
                                    className="grid min-h-0 w-full min-w-0 max-w-full grid-cols-[minmax(0,1.08fr)_minmax(0,0.94fr)_5.5rem] items-stretch gap-0.5 overflow-hidden"
                                    style={
                                        nativeHomeTopRowHeightPx != null
                                            ? {
                                                  height: `${nativeHomeTopRowHeightPx}px`,
                                                  minHeight: 0,
                                                  // 측정값이 퀵 메뉴 전체 높이 — maxHeight로 잘리면 하단 버튼이 잘림
                                              }
                                            : { minHeight: 0, maxHeight: 'min(54dvh, 90vh)' }
                                    }
                                >
                                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-md border border-color bg-panel p-1.5 text-[clamp(8px,2.4vw,10px)] leading-snug antialiased [&_button]:max-w-full">
                                        {ProfilePanelContent}
                                    </div>

                                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-color bg-panel px-1 py-1.5">
                                        <h3 className="mb-1 w-full shrink-0 whitespace-nowrap text-center text-xs font-bold leading-tight tracking-tight text-secondary">
                                            장착 장비
                                        </h3>
                                        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden px-0.5 py-0.5">
                                            <div className="flex w-full min-w-0 shrink-0 flex-col">
                                                <div className="grid w-full min-w-0 shrink-0 grid-cols-3 grid-rows-2 gap-0.5 [&>*]:min-w-0">
                                                    {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                                                        const item = getItemForSlot(slot);
                                                        return (
                                                            <div key={slot} className="aspect-square w-full min-w-0">
                                                                <EquipmentSlotDisplay
                                                                    slot={slot}
                                                                    item={item}
                                                                    onClick={() => item && handlers.openViewingItem(item, true)}
                                                                    scaleFactor={0.9}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2 flex w-full min-w-0 shrink-0 items-stretch gap-1 border-t border-color/40 pt-2">
                                                    <select
                                                        value={selectedPreset}
                                                        onChange={handlePresetChange}
                                                        className="min-h-[24px] min-w-0 flex-1 basis-0 rounded border border-color bg-secondary px-1 py-0.5 text-[10px] focus:border-accent focus:ring-accent"
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
                                    </div>

                                    <div className={`relative z-10 flex h-full min-h-0 flex-col overflow-hidden ${NATIVE_QUICK_RAIL_WIDTH_CLASS}`}>
                                        <div
                                            ref={nativeHomeQuickMeasureRef}
                                            className="box-border flex h-fit min-h-0 w-full shrink-0 flex-col self-start overflow-hidden rounded-md border border-color/50 bg-panel/95 p-0.5"
                                        >
                                            <QuickAccessSidebar nativeHomeColumn />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid h-full min-h-0 min-w-0 max-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1 overflow-hidden pt-px">
                                    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-color bg-panel shadow-sm">
                                        <ChatWindow
                                            messages={globalChat}
                                            mode="global"
                                            onAction={handlers.handleAction}
                                            onViewUser={handlers.openViewingUser}
                                            locationPrefix="[홈]"
                                            compactHome
                                        />
                                    </div>
                                    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-color/80 bg-panel/95 shadow-sm">
                                        <div className="flex h-full min-h-0 max-w-full min-w-0 flex-1 flex-col overflow-hidden">
                                        <HomeBoardPanel
                                            posts={homeBoardPosts || []}
                                            isAdmin={currentUserWithStatus.isAdmin}
                                            onAction={handlers.handleAction}
                                            fitViewport
                                        />
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
                            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 pb-1">
                                <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-2">
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
                                <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-2">
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
                                <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-2">
                                    <div className="flex min-h-0 min-w-0 flex-[1.05] basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                                        <PveCard
                                            title="능력 PVP"
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
                <div className="flex flex-col h-full gap-1 min-w-0 overflow-hidden">
                    <div className="flex flex-row gap-1 min-w-0 flex-shrink-0 max-h-[380px]">
                        <div className="w-[30%] min-w-[240px] max-w-[360px] bg-panel border border-color text-on-panel rounded-lg p-1.5 flex flex-col gap-0.5 overflow-hidden">{ProfilePanelContent}</div>
                        {/* New structure for equipped items, ranking boards, and quick access */}
                        <div className="flex-1 flex flex-row gap-1 min-w-0 overflow-hidden">
                            <div className="flex h-full min-h-0 w-[280px] min-w-[200px] max-w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-md border border-color bg-panel px-1 py-1.5 text-on-panel">
                                <h3 className="mb-1 w-full shrink-0 whitespace-nowrap text-center text-xs font-bold leading-tight tracking-tight text-secondary">
                                    장착 장비
                                </h3>
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden px-0.5 py-0.5">
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <div className="grid w-full min-w-0 shrink-0 grid-cols-3 grid-rows-2 gap-0.5 [&>*]:min-w-0">
                                            {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                                                const item = getItemForSlot(slot);
                                                return (
                                                    <div key={slot} className="aspect-square w-full min-w-0">
                                                        <EquipmentSlotDisplay
                                                            slot={slot}
                                                            item={item}
                                                            onClick={() => item && handlers.openViewingItem(item, true)}
                                                            scaleFactor={0.9}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 flex w-full min-w-0 shrink-0 items-stretch gap-1 border-t border-color/40 pt-2">
                                            <select
                                                value={selectedPreset}
                                                onChange={handlePresetChange}
                                                className="min-h-[24px] min-w-0 flex-1 basis-0 rounded border border-color bg-secondary px-1 py-0.5 text-[10px] focus:border-accent focus:ring-accent sm:text-xs"
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
                            </div>
                            <div className="flex-1 flex flex-row gap-1 min-w-0 overflow-hidden">
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <GameRankingBoard />
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <BadukRankingBoard />
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden min-w-[200px]">
                                    <ChampionshipRankingPanel compact />
                                </div>
                            </div>
                            <div className="w-24 min-w-[96px] flex-shrink-0 overflow-hidden">
                                <QuickAccessSidebar />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 grid grid-cols-12 gap-2 min-h-0 overflow-hidden">
                        <div className="col-span-3 min-w-0 bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col overflow-hidden">
                            <ChatWindow messages={globalChat} mode="global" onAction={handlers.handleAction} onViewUser={handlers.openViewingUser} locationPrefix="[홈]" />
                        </div>
                        <div className="col-span-3 min-w-0 bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col overflow-hidden">
                            <HomeBoardPanel posts={homeBoardPosts || []} isAdmin={currentUserWithStatus.isAdmin} onAction={handlers.handleAction} />
                        </div>
                        <div className="col-span-6 min-w-0 min-h-0 flex flex-col overflow-hidden">
                            {LobbyCards}
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