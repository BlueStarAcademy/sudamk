import React, { useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../shared/i18n/config.js';
const tourT = (key: string, opts?: Record<string, unknown>) => i18n.t(`tournament:championship.venue.${key}`, opts);

import DraggableWindow from './DraggableWindow.js';
import { PortalHoverBubble } from './PortalHoverBubble.js';
import { TournamentType, UserWithStatus, TournamentState } from '../types.js';
import { CoreStat, ItemGrade, SpecialStat } from '../types/enums.js';
import { calculateUserEffects } from '../services/effectService.js';
import { computeCoreStatFinalFromBonuses } from '../shared/utils/coreStatComposition.js';
const CORE_STAT_CAP = 1500;

import {
    TOURNAMENT_DEFINITIONS,
    CHAMPIONSHIP_VENUE_LOBBY_BG_IMAGE,
    DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT,
    DUNGEON_STAGE_BASE_REWARDS_MATERIAL,
    DUNGEON_STAGE_BOT_STATS,
    gradeBackgrounds,
} from '../constants';
import {
    DUNGEON_STAGE_EQUIPMENT_DROP,
    DUNGEON_STAGE_MATERIAL_WEIGHTED,
    getDungeonBasicRewardRangeGold,
    getDungeonRankKeysForDisplay,
    getDungeonRankRewardRangeForDisplay,
    type DungeonRankRewardRangeItem,
    type EquipmentGradeKey,
} from '../shared/constants/tournaments.js';
import { normalizeDungeonProgress, isStageCleared } from '../utils/championshipDungeonProgress.js';
import { getChampionshipDungeonDailyEntryState } from '../shared/utils/championshipDungeonDailyEntry.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useAdContext } from './ads/AdProvider.js';
import {
    getChampionshipRewardItemGrade,
    getChampionshipRewardItemImageUrl,
} from '../utils/championshipRewardDisplay.js';
import { translateItemGrade } from '../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';

type RewardPiece = {
    key: string;
    label: string;
    quantity: string;
    imageUrl: string;
    grade?: ItemGrade;
    frame?: 'gold' | 'diamond';
    /** 월드 경기 보상: 실제는 등급 랜덤 장비 — 상자 이미지를 어둡게 + 물음표 */
    mysteryEquip?: boolean;
    /** 동네 기본 보상: 골드 아이콘 어둡게 + 물음표 (승·패 범위는 captionBesideThumb) */
    mysteryNeighborhoodGold?: boolean;
    /** 월드 장비 변경권: 랜덤 지급 안내 — 이미지 어둡게 + 물음표 */
    mysteryChangeTicket?: boolean;
    /** 썸 우하단 수량 배지 숨김 */
    hideThumbQuantityBadge?: boolean;
    /** 수량·이름은 썸 배지에만 표시하고 옆 텍스트 줄 생략 */
    quantityOnThumbOnly?: boolean;
    /** 썸 옆에만 보조 문구 (동네 기본: 승/패 골드 범위, 월드: 랜덤 안내) */
    captionBesideThumb?: string[];
    /** true면 captionBesideThumb는 옆에 표시하지 않고, 호버(title)·누름 시 안내만 */
    captionTooltipOnly?: boolean;
    /** 썸네일 바로 아래 한 줄 라벨 (예: 월드 기본 보상「장비」「변경권」) */
    captionBelowThumb?: string;
    /** true면 썸네일 title(기본 텍스트 설명 툴팁)을 숨김 */
    suppressTitle?: boolean;
};

function getDungeonBotStatRangeForStage(stage: number): { minStat: number; maxStat: number } {
    const clamped = Math.min(10, Math.max(1, Number.isFinite(stage) ? Math.floor(stage) : 1));
    return DUNGEON_STAGE_BOT_STATS[clamped] ?? DUNGEON_STAGE_BOT_STATS[1] ?? { minStat: 100, maxStat: 120 };
}

function fallbackIconByName(name: string): string {
    if (name.includes('골드')) return '/images/icon/Gold.webp';
    if (name.includes('다이아')) return '/images/icon/Zem.webp';
    return '';
}

const WORLD_EQUIP_GRADE_ORDER: EquipmentGradeKey[] = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function formatWorldEquipmentDropCaptionLines(stage: number): string[] {
    const config = DUNGEON_STAGE_EQUIPMENT_DROP[stage] || DUNGEON_STAGE_EQUIPMENT_DROP[1];
    const grades = [...config.win.map(e => e.grade), ...config.loss.map(e => e.grade)];
    if (grades.length === 0) return [tourT('oneGamePerMatch')];
    let lo = grades[0];
    let hi = grades[0];
    for (const g of grades) {
        if (WORLD_EQUIP_GRADE_ORDER.indexOf(g) < WORLD_EQUIP_GRADE_ORDER.indexOf(lo)) lo = g;
        if (WORLD_EQUIP_GRADE_ORDER.indexOf(g) > WORLD_EQUIP_GRADE_ORDER.indexOf(hi)) hi = g;
    }
    const loL = translateItemGrade(lo);
    const hiL = translateItemGrade(hi);
    const rangeLine = lo === hi ? tourT('grade', { grade: loL }) : tourT('gradeRange', { low: loL, high: hiL });

    return [rangeLine];
}

function formatRankGroupLabel(ranks: number[]): string {
    if (ranks.length === 0) return '';
    const lo = ranks[0];
    const hi = ranks[ranks.length - 1];
    if (lo === hi) return tourT('rankPlace', { rank: lo });
    return tourT('rankRange', { low: lo, high: hi });
}

function formatRangeQuantity(min: number, max: number): string {
    if (min === max) return min.toLocaleString();
    return `${min.toLocaleString()}~${max.toLocaleString()}`;
}

function buildNationalMaterialRangeByName(stage: number): Array<{ materialName: string; min: number; max: number }> {
    const s = Math.min(10, Math.max(1, Math.floor(stage)));
    const row = DUNGEON_STAGE_MATERIAL_WEIGHTED[s] ?? DUNGEON_STAGE_MATERIAL_WEIGHTED[1];
    const merged = [...(row?.win ?? []), ...(row?.loss ?? [])];
    const byName = new Map<string, { min: number; max: number }>();
    for (const e of merged) {
        const prev = byName.get(e.materialName);
        if (!prev) {
            byName.set(e.materialName, { min: e.min, max: e.max });
            continue;
        }
        byName.set(e.materialName, {
            min: Math.min(prev.min, e.min),
            max: Math.max(prev.max, e.max),
        });
    }
    return Array.from(byName.entries()).map(([materialName, r]) => ({ materialName, min: r.min, max: r.max }));
}

function parseDungeonRankRangeToPieces(items: DungeonRankRewardRangeItem[]): RewardPiece[] {
    const out: RewardPiece[] = [];
    items.forEach((it, idx) => {
        const qty = formatRangeQuantity(it.min, it.max);
        if (it.itemId === '골드') {
            out.push({
                key: `rank-g-${idx}`,
                label: tourT('gold'),
                quantity: qty,
                imageUrl: '/images/icon/Gold.webp',
                frame: 'gold',
                quantityOnThumbOnly: true,
            });
        } else if (it.itemId === '다이아') {
            out.push({
                key: `rank-d-${idx}`,
                label: tourT('diamonds'),
                quantity: qty,
                imageUrl: '/images/icon/Zem.webp',
                frame: 'diamond',
                quantityOnThumbOnly: true,
            });
        } else {
            const name = it.itemId;
            const matQty = it.min === it.max ? `×${it.min.toLocaleString()}` : formatRangeQuantity(it.min, it.max);
            out.push({
                key: `rank-m-${idx}-${name}`,
                label: name,
                quantity: matQty,
                imageUrl: getChampionshipRewardItemImageUrl(name) || fallbackIconByName(name),
                grade: getChampionshipRewardItemGrade(name),
                quantityOnThumbOnly: true,
            });
        }
    });
    return out;
}

function rangeItemsSignature(items: DungeonRankRewardRangeItem[]): string {
    return JSON.stringify([...items].sort((a, b) => a.itemId.localeCompare(b.itemId)));
}

type RankColumnGroup = { ranks: number[]; headRank: number; rankLabel: string; pieces: RewardPiece[] };

/** 실제 지급과 동일한 순위 보상 표시(동네=골드, 전국=강화석, 월드=다이아 구간). 레거시 DUNGEON_RANK_REWARDS 대신 사용 */
function buildDungeonRankRewardGroupsForEntryModal(type: TournamentType, stage: number): RankColumnGroup[] {
    const keys = getDungeonRankKeysForDisplay(type);
    type Row = { rankNum: number; displayLabel: string; sig: string; pieces: RewardPiece[] };
    const expanded: Row[] = [];

    for (const rankKey of keys) {
        const r = getDungeonRankRewardRangeForDisplay(type, stage, rankKey);
        const displayLabel =
            type === 'world' && rankKey === 9 ? tourT('rankWorld9_16') : type === 'world' && rankKey === 4 ? tourT('rankWorld4_8') : tourT('rankPlace', { rank: rankKey });

        if (type === 'world' && rankKey === 9) {
            const pieces = r?.items?.length ? parseDungeonRankRangeToPieces(r.items) : [];
            expanded.push({
                rankNum: 9,
                displayLabel,
                sig: pieces.length ? rangeItemsSignature(r!.items) : '__world_916_none__',
                pieces,
            });
            continue;
        }

        if (!r?.items?.length) continue;
        expanded.push({
            rankNum: rankKey,
            displayLabel,
            sig: rangeItemsSignature(r.items),
            pieces: parseDungeonRankRangeToPieces(r.items),
        });
    }

    const groups: RankColumnGroup[] = [];
    let cur: { rankNums: number[]; sig: string; pieces: RewardPiece[]; firstLabel: string } | null = null;

    const flush = () => {
        if (!cur) return;
        const headRank = cur.rankNums[0];
        const rankLabel = cur.rankNums.length === 1 ? cur.firstLabel : formatRankGroupLabel(cur.rankNums);
        groups.push({ ranks: cur.rankNums, headRank, rankLabel, pieces: cur.pieces });
        cur = null;
    };

    for (const row of expanded) {
        const last = cur?.rankNums[cur.rankNums.length - 1];
        const extend = cur && cur.sig === row.sig && row.rankNum === last! + 1;
        if (extend) {
            cur!.rankNums.push(row.rankNum);
        } else {
            flush();
            cur = { rankNums: [row.rankNum], sig: row.sig, pieces: row.pieces, firstLabel: row.displayLabel };
        }
    }
    flush();
    return groups;
}

function getBaseRewardPieces(type: TournamentType, stage: number): RewardPiece[] {
    if (type === 'neighborhood') {
        const range = getDungeonBasicRewardRangeGold(stage);
        return [
            {
                key: 'base-gold-mystery',
                label: '',
                quantity: '',
                imageUrl: '/images/icon/Gold.webp',
                frame: 'gold',
                mysteryNeighborhoodGold: true,
                hideThumbQuantityBadge: true,
                quantityOnThumbOnly: true,
                captionTooltipOnly: true,
                captionBesideThumb: [
                    tourT('winGold', { min: range.win.min.toLocaleString(), max: range.win.max.toLocaleString() }),
                    tourT('lossGold', { min: range.loss.min.toLocaleString(), max: range.loss.max.toLocaleString() }),
                ],
            },
        ];
    }
    if (type === 'national') {
        const rows = buildNationalMaterialRangeByName(stage);
        if (rows.length === 0) {
            const m = DUNGEON_STAGE_BASE_REWARDS_MATERIAL[stage];
            if (!m) return [];
            return [
                {
                    key: 'base-mat-fallback',
                    label: m.materialName,
                    quantity: `${m.quantity.toLocaleString()}~${m.quantity.toLocaleString()}`,
                    imageUrl: getChampionshipRewardItemImageUrl(m.materialName) || '/images/materials/materials1.webp',
                    grade: getChampionshipRewardItemGrade(m.materialName),
                    quantityOnThumbOnly: true,
                    suppressTitle: true,
                },
            ];
        }
        return rows.map((r, idx) => ({
            key: `base-mat-${idx}`,
            label: r.materialName,
            quantity: formatRangeQuantity(r.min, r.max),
            imageUrl: getChampionshipRewardItemImageUrl(r.materialName) || '/images/materials/materials1.webp',
            grade: getChampionshipRewardItemGrade(r.materialName),
            quantityOnThumbOnly: true,
            suppressTitle: true,
        }));
    }
    if (type === 'world') {
        const e = DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage];
        if (!e) return [];
        const boxImg = getChampionshipRewardItemImageUrl('장비 상자 I') || '/images/Box/EquipmentBox1.webp';
        const list: RewardPiece[] = [
            {
                key: 'base-equip-random',
                label: '',
                quantity: '',
                imageUrl: boxImg,
                mysteryEquip: true,
                hideThumbQuantityBadge: true,
                quantityOnThumbOnly: true,
                captionTooltipOnly: true,
                captionBesideThumb: formatWorldEquipmentDropCaptionLines(stage),
                captionBelowThumb: tourT('equipment'),
            },
        ];
        if (e.changeTickets > 0) {
            list.push({
                key: 'tickets',
                label: tourT('changeTicket'),
                quantity: '',
                imageUrl: '/images/use/change1.webp',
                mysteryChangeTicket: true,
                hideThumbQuantityBadge: true,
                quantityOnThumbOnly: true,
                captionTooltipOnly: true,
                captionBesideThumb: [
                    tourT('rewardRandom'),
                    tourT('changeTicketMax', { count: e.changeTickets }),
                ],
                captionBelowThumb: tourT('changeTicketShort'),
            });
        }
        return list;
    }
    return [];
}

const rewardThumbRing = (piece: RewardPiece) => {
    if (piece.frame === 'gold') {
        return 'ring-amber-400/45 shadow-[0_0_14px_-4px_rgba(251,191,36,0.45)]';
    }
    if (piece.frame === 'diamond') {
        return 'ring-sky-400/40 shadow-[0_0_14px_-4px_rgba(56,189,248,0.35)]';
    }
    return 'ring-white/[0.12]';
};

const TIP_TOUCH_HOLD_MS = 420;

const RewardThumb: React.FC<{
    piece: RewardPiece;
    fluid?: boolean;
    compact?: boolean;
    /** 입장 모달 보상 전용 — 더 큰 고정 썸 */
    showcase?: boolean;
}> = ({ piece, fluid = true, compact = false, showcase = false }) => {
    const [pressTip, setPressTip] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);
    const tipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTipHideTimer = () => {
        if (tipHideTimerRef.current != null) {
            clearTimeout(tipHideTimerRef.current);
            tipHideTimerRef.current = null;
        }
    };

    useEffect(
        () => () => {
            clearTipHideTimer();
        },
        []
    );

    const isTouchLikePointer = (e: React.PointerEvent) =>
        e.pointerType === 'touch' || e.pointerType === 'pen';
    const box = showcase
        ? 'h-14 w-14 min-h-14 min-w-14 shrink-0 sm:h-16 sm:w-16 sm:min-h-16 sm:min-w-16'
        : fluid
          ? 'aspect-square w-full min-h-0 min-w-0'
          : compact
            ? 'h-9 w-9 min-h-[2.25rem] min-w-[2.25rem] shrink-0 sm:h-10 sm:w-10 sm:min-h-10 sm:min-w-10'
            : 'h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] shrink-0 sm:h-12 sm:w-12 sm:min-h-12 sm:min-w-12';
    const qtyClass = showcase
        ? 'px-1 py-0.5 text-[10px] sm:text-[11px]'
        : fluid
          ? 'px-0.5 py-px text-[clamp(8px,2.2vw,11px)]'
          : 'px-0.5 py-px text-[10px] sm:text-[11px]';
    const padImg = showcase || fluid ? 'p-[8%]' : 'p-0.5 sm:p-1';
    const mysteryMarkClass = showcase ? 'text-xl sm:text-2xl' : fluid ? 'text-[clamp(0.75rem,3.5vw,1.125rem)]' : 'text-lg';
    /** 월드 등급 상자·변경권: 동일 프레임 + 살짝 더 선명하게 */
    const worldMysteryImgTone = 'opacity-[0.62] brightness-[0.68] contrast-[0.98]';
    const tierBg =
        piece.grade !== undefined && !piece.mysteryEquip && !piece.mysteryNeighborhoodGold && !piece.mysteryChangeTicket
            ? gradeBackgrounds[piece.grade]
            : undefined;
    const ring = rewardThumbRing(piece);
    const tooltipLines =
        piece.captionBesideThumb?.length && piece.captionTooltipOnly
            ? piece.mysteryNeighborhoodGold
                ? [...piece.captionBesideThumb]
                : piece.label
                  ? [piece.label, ...piece.captionBesideThumb]
                  : [...piece.captionBesideThumb]
            : null;
    const titleText = tooltipLines
        ? tooltipLines.join('\n')
        : piece.captionBesideThumb?.length && !piece.captionTooltipOnly
          ? [piece.label, ...piece.captionBesideThumb].join(' · ')
          : `${piece.label} ${piece.quantity}`.trim() || tourT('defaultRewardFallback');
    const tipOnly = Boolean(piece.captionTooltipOnly && piece.captionBesideThumb?.length);

    return (
        <div
            ref={anchorRef}
            className={`relative ${
                showcase
                    ? 'shrink-0'
                    : fluid
                      ? 'mx-auto w-full min-w-0 max-w-[3.25rem] sm:max-w-[3.5rem] md:max-w-[3.75rem]'
                      : 'shrink-0'
            } ${tipOnly ? 'touch-manipulation' : ''}`}
            onMouseEnter={
                tipOnly
                    ? () => {
                          clearTipHideTimer();
                          setPressTip(true);
                      }
                    : undefined
            }
            onMouseLeave={
                tipOnly
                    ? () => {
                          clearTipHideTimer();
                          setPressTip(false);
                      }
                    : undefined
            }
            onPointerDown={
                tipOnly
                    ? e => {
                          if (!isTouchLikePointer(e)) return;
                          clearTipHideTimer();
                          setPressTip(true);
                      }
                    : undefined
            }
            onPointerUp={
                tipOnly
                    ? e => {
                          if (!isTouchLikePointer(e)) return;
                          clearTipHideTimer();
                          tipHideTimerRef.current = setTimeout(() => setPressTip(false), TIP_TOUCH_HOLD_MS);
                      }
                    : undefined
            }
            onPointerCancel={
                tipOnly
                    ? e => {
                          if (!isTouchLikePointer(e)) return;
                          clearTipHideTimer();
                          setPressTip(false);
                      }
                    : undefined
            }
        >
            {tipOnly && tooltipLines && (
                <PortalHoverBubble show={pressTip} anchorRef={anchorRef} placement="top" className="pointer-events-none w-max min-w-0">
                    <div
                        className="box-border max-w-[min(17rem,calc(100vw-1.5rem))] rounded-lg border border-amber-400/50 px-2.5 py-2 text-left text-[10px] leading-snug text-zinc-100 sm:text-[11px] [overflow-wrap:anywhere] break-words shadow-[0_12px_40px_rgba(0,0,0,0.85)] ring-1 ring-black/60"
                        style={{ backgroundColor: '#09090b' }}
                    >
                        {tooltipLines.map((line, i) => (
                            <div key={i} className={i > 0 ? 'mt-1 border-t border-white/10 pt-1' : ''}>
                                {line}
                            </div>
                        ))}
                    </div>
                </PortalHoverBubble>
            )}
            <div
                className={`group/thumb relative overflow-hidden rounded-lg ${fluid ? 'w-full' : 'shrink-0'} ${box} bg-gradient-to-b from-zinc-800/90 to-black/80 ring-1 ${ring} ${tipOnly ? 'cursor-help' : ''}`}
                title={piece.suppressTitle ? undefined : titleText}
            >
            {piece.mysteryNeighborhoodGold && piece.imageUrl ? (
                <>
                    <img
                        src={piece.imageUrl}
                        alt=""
                        className={`relative z-[1] h-full w-full object-contain ${padImg} opacity-[0.42] brightness-[0.5] contrast-[0.95]`}
                        loading="lazy"
                        decoding="async"
                    />
                    <span
                        className={`pointer-events-none absolute inset-0 z-[2] flex items-center justify-center font-black leading-none text-white ${mysteryMarkClass}`}
                        style={{ textShadow: '0 0 10px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}
                        aria-hidden
                    >
                        ?
                    </span>
                </>
            ) : (piece.mysteryEquip || piece.mysteryChangeTicket) && piece.imageUrl ? (
                <>
                    <div className="absolute inset-0 z-[1] flex items-center justify-center p-[10%]">
                        <img
                            src={piece.imageUrl}
                            alt=""
                            className={`max-h-full max-w-full object-contain ${worldMysteryImgTone}`}
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                    <span
                        className={`pointer-events-none absolute inset-0 z-[2] flex items-center justify-center font-black leading-none text-white ${mysteryMarkClass}`}
                        style={{ textShadow: '0 0 10px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}
                        aria-hidden
                    >
                        ?
                    </span>
                </>
            ) : tierBg ? (
                <>
                    <img src={tierBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.88]" aria-hidden />
                    {piece.imageUrl ? (
                        <img
                            src={piece.imageUrl}
                            alt=""
                            className={`relative z-[1] h-full w-full object-contain ${padImg}`}
                            loading="lazy"
                            decoding="async"
                        />
                    ) : null}
                </>
            ) : (
                piece.imageUrl && (
                    <img
                        src={piece.imageUrl}
                        alt=""
                        className={`relative z-[1] h-full w-full object-contain ${padImg}`}
                        loading="lazy"
                        decoding="async"
                    />
                )
            )}
            {piece.quantity && !piece.hideThumbQuantityBadge ? (
                <span
                    className={`absolute bottom-0 right-0 z-[2] max-w-[100%] truncate rounded-tl bg-black/90 font-bold leading-tight text-amber-100/95 tabular-nums ${qtyClass}`}
                >
                    {piece.quantity}
                </span>
            ) : null}
            </div>
        </div>
    );
};

/** 기대값 대비: 더 낮음 → 열세, 10% 이상 높음 → 우세, 그 사이는 중립 */
function compareToneVsExpected(my: number, opponentExpected: number): 'better' | 'worse' | 'neutral' {
    if (my < opponentExpected) return 'worse';
    if (opponentExpected <= 0) return 'neutral';
    if (my >= opponentExpected * 1.1) return 'better';
    return 'neutral';
}

function myStatValueToneClass(tone: 'better' | 'worse' | 'neutral'): string {
    switch (tone) {
        case 'better':
            return 'text-emerald-300';
        case 'worse':
            return 'text-red-400';
        default:
            return 'text-zinc-100';
    }
}

/** 화살표+차이: 낮을 때는 항상 빨강, 높을 때는 우세(10%↑)면 초록·아니면 회색 */
function diffArrowBadgeClass(diff: number, tone: 'better' | 'worse' | 'neutral'): string {
    if (diff === 0) return 'text-zinc-500';
    if (diff < 0) return 'text-red-400';
    return tone === 'better' ? 'text-emerald-400' : 'text-zinc-400';
}

const MyStatCompareValue: React.FC<{ my: number; opponentExpected: number }> = ({ my, opponentExpected }) => {
    const tone = compareToneVsExpected(my, opponentExpected);
    const diff = my - opponentExpected;
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
            <span className={`font-mono text-sm font-bold tabular-nums leading-none sm:text-base ${myStatValueToneClass(tone)}`}>
                {my.toLocaleString()}
            </span>
            {diff !== 0 && (
                <span
                    className={`whitespace-nowrap text-[11px] font-bold tabular-nums leading-none sm:text-xs ${diffArrowBadgeClass(diff, tone)}`}
                    title={diff > 0 ? `+${diff}` : `${diff}`}
                >
                    {diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
                </span>
            )}
        </div>
    );
};

type VenueModalAccent = {
    ring: string;
    glow: string;
    chip: string;
    chipText: string;
    stageActive: string;
    stageNext: string;
    panelBorder: string;
    panelGlow: string;
    bar: string;
    label: string;
};

/** 챔피언십 입장 모달 — 컴팩트 골드 CTA (내용물 폭) */
const VENUE_ENTER_BTN_CLASS =
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300/55 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-950 px-4 py-2 text-[13px] font-semibold tracking-wide text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_3px_0_0_rgb(120,53,15),0_8px_18px_-10px_rgba(245,158,11,0.55)] transition-[transform,filter,box-shadow] hover:brightness-110 active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_0_0_rgb(120,53,15)] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0';

const VENUE_AD_BTN_CLASS =
    'inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-300/45 bg-gradient-to-b from-emerald-500/90 via-emerald-700 to-emerald-950 px-4 py-2 text-[13px] font-semibold tracking-wide text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_0_rgb(6,78,59),0_8px_18px_-10px_rgba(16,185,129,0.45)] transition-[transform,filter,box-shadow] hover:brightness-110 active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_0_0_rgb(6,78,59)] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0';

const VENUE_CONTINUE_BTN_CLASS =
    'inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-300/50 bg-gradient-to-b from-amber-500/90 via-amber-700 to-amber-950 px-4 py-2 text-[13px] font-semibold tracking-wide text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_0_0_rgb(120,53,15)] transition-[transform,filter] hover:brightness-110 active:translate-y-px';

const VENUE_MODAL_ACCENT: Record<TournamentType, VenueModalAccent> = {
    neighborhood: {
        ring: 'ring-emerald-400/30',
        glow: 'from-emerald-700/30 via-amber-900/10 to-transparent',
        chip: 'border-emerald-300/45 bg-gradient-to-b from-emerald-800/85 via-emerald-950/90 to-black/90',
        chipText: 'text-emerald-50',
        stageActive:
            'bg-emerald-500 text-white ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#0a0b10]',
        stageNext: 'bg-emerald-900/80 text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-800',
        panelBorder: 'border-emerald-400/25',
        panelGlow: 'shadow-[inset_0_1px_0_rgba(167,243,208,0.12),0_12px_32px_-20px_rgba(16,185,129,0.35)]',
        bar: 'from-emerald-300/90 via-amber-300/50 to-transparent',
        label: 'text-emerald-100/95',
    },
    national: {
        ring: 'ring-sky-400/30',
        glow: 'from-sky-700/30 via-amber-900/10 to-transparent',
        chip: 'border-sky-300/45 bg-gradient-to-b from-sky-800/85 via-sky-950/90 to-black/90',
        chipText: 'text-sky-50',
        stageActive:
            'bg-sky-500 text-white ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#0a0b10]',
        stageNext: 'bg-sky-900/80 text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-800',
        panelBorder: 'border-sky-400/25',
        panelGlow: 'shadow-[inset_0_1px_0_rgba(186,230,253,0.12),0_12px_32px_-20px_rgba(56,189,248,0.35)]',
        bar: 'from-sky-300/90 via-amber-300/50 to-transparent',
        label: 'text-sky-100/95',
    },
    world: {
        ring: 'ring-violet-400/30',
        glow: 'from-violet-700/30 via-amber-900/10 to-transparent',
        chip: 'border-violet-300/45 bg-gradient-to-b from-violet-800/85 via-violet-950/90 to-black/90',
        chipText: 'text-violet-50',
        stageActive:
            'bg-violet-500 text-white ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#0a0b10]',
        stageNext: 'bg-violet-900/80 text-violet-100 ring-1 ring-violet-400/40 hover:bg-violet-800',
        panelBorder: 'border-violet-400/25',
        panelGlow: 'shadow-[inset_0_1px_0_rgba(221,214,254,0.12),0_12px_32px_-20px_rgba(139,92,246,0.35)]',
        bar: 'from-violet-300/90 via-amber-300/50 to-transparent',
        label: 'text-violet-100/95',
    },
};

export interface ChampionshipVenueEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: TournamentType;
    currentUser: UserWithStatus;
    inProgress: TournamentState | null;
    onEnter: (stage: number) => void;
    onContinue: () => void;
    isTopmost?: boolean;
}

const ChampionshipVenueEntryModal: React.FC<ChampionshipVenueEntryModalProps> = ({
    isOpen,
    onClose,
    type,
    currentUser,
    inProgress,
    onEnter,
    onContinue,
    isTopmost,
}) => {
    const { t } = useTranslation(['tournament', 'common']);
    const { handlers } = useAppContext();
    const { showShopAdRewardInterstitial, isAdFree } = useAdContext();
    const [adClaimPending, setAdClaimPending] = useState(false);
    const definition = TOURNAMENT_DEFINITIONS[type];
    const venueLobbyBg = CHAMPIONSHIP_VENUE_LOBBY_BG_IMAGE[type];
    const isHandheld = useIsHandheldDevice(1025);
    /** 이미지+VS/보상 구성에 맞춘 폭 (과도한 빈 여백 방지) */
    const entryModalWidth = useMemo(() => {
        if (typeof window === 'undefined') return 560;
        if (!isHandheld) return Math.min(560, Math.max(520, window.innerWidth - 48));
        return Math.min(392, Math.max(328, window.innerWidth - 12));
    }, [isHandheld]);
    const dungeonProgress = useMemo(
        () =>
            normalizeDungeonProgress(
                currentUser?.dungeonProgress?.[type] || {
                    currentStage: 0,
                    unlockedStages: [1],
                    stageResults: {},
                    dailyStageAttempts: {},
                }
            ),
        [currentUser?.dungeonProgress, type]
    );

    const unlockedStages = dungeonProgress.unlockedStages;

    /** 가장 최근 경기 단계 → 없으면 최고 언락 단계 */
    const defaultStage = useMemo(() => {
        const unlocked = unlockedStages.length > 0 ? unlockedStages : [1];
        const unlockedSet = new Set(unlocked);
        const pick = (stage: number | null | undefined) =>
            stage != null && stage >= 1 && stage <= 10 && unlockedSet.has(stage) ? stage : null;

        const fromInProgress = pick(inProgress?.currentStageAttempt);
        if (fromInProgress != null) return fromInProgress;

        let bestStage = 0;
        let bestTime = -1;
        const results = dungeonProgress.stageResults as Record<
            number | string,
            { clearTime?: number; cleared?: boolean }
        >;
        for (const [key, entry] of Object.entries(results || {})) {
            const stage = Number(key);
            if (!unlockedSet.has(stage) || !entry) continue;
            const t = Number(entry.clearTime) || 0;
            if (t > bestTime) {
                bestTime = t;
                bestStage = stage;
            }
        }
        if (bestStage > 0) return bestStage;

        const fromCleared = pick(dungeonProgress.currentStage);
        if (fromCleared != null) return fromCleared;

        return Math.max(...unlocked);
    }, [unlockedStages, dungeonProgress.stageResults, dungeonProgress.currentStage, inProgress?.currentStageAttempt]);

    const [selectedStage, setSelectedStage] = useState(defaultStage);
    useEffect(() => {
        if (isOpen) setSelectedStage(defaultStage);
    }, [isOpen, defaultStage]);

    const now = Date.now();
    let rewardClaimedKey: keyof UserWithStatus;
    switch (type) {
        case 'neighborhood':
            rewardClaimedKey = 'neighborhoodRewardClaimed';
            break;
        case 'national':
            rewardClaimedKey = 'nationalRewardClaimed';
            break;
        case 'world':
            rewardClaimedKey = 'worldRewardClaimed';
            break;
    }
    const rewardClaimed = Boolean(currentUser[rewardClaimedKey as keyof UserWithStatus]);

    const hasResultToView = inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isPausedInProgress = inProgress?.status === 'round_in_progress';
    const hasUnclaimedCompleteResult = Boolean(hasResultToView && !rewardClaimed);
    const showContinueFlow = isPausedInProgress || hasUnclaimedCompleteResult;

    let continueLabel = t('championship.venue.continueView');
    if (hasUnclaimedCompleteResult) {
        continueLabel = t('championship.venue.viewResult');
    } else if (isPausedInProgress) {
        continueLabel = t('championship.venue.continueViewAlt');
    }

    const basePieces = useMemo(() => getBaseRewardPieces(type, selectedStage), [type, selectedStage, t]);

    const rankRewardGroups = useMemo(
        () => buildDungeonRankRewardGroupsForEntryModal(type, selectedStage),
        [type, selectedStage, t],
    );

    /** 단계별 수령 가능 보상 — 이미지(고유)만 */
    const rewardPreviewPieces = useMemo(() => {
        const all = [...basePieces, ...rankRewardGroups.flatMap(g => g.pieces)];
        const seen = new Set<string>();
        const out: RewardPiece[] = [];
        for (const p of all) {
            const key = p.imageUrl || p.key;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(p);
        }
        return out;
    }, [basePieces, rankRewardGroups]);

    const botStatRange = useMemo(() => getDungeonBotStatRangeForStage(selectedStage), [selectedStage]);
    const botAvgStat = useMemo(
        () => Math.round((botStatRange.minStat + botStatRange.maxStat) / 2),
        [botStatRange]
    );
    /** 6개 핵심 능력치 각각이 위 범위·평균을 따를 때의 기대 합(참고) */
    const botBadukAbilityAvg = useMemo(() => botAvgStat * 6, [botAvgStat]);

    const equipmentEffects = useMemo(() => calculateUserEffects(currentUser), [currentUser]);
    const { coreStatBonuses } = equipmentEffects;
    const championshipVenueAllCorePct =
        equipmentEffects.specialStatBonuses[SpecialStat.ChampionshipVenueAllStats]?.percent ?? 0;
    const baseByStat = useMemo(() => {
        const out = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            out[stat] = (currentUser.baseStats?.[stat] || 0) + (currentUser.spentStatPoints?.[stat] || 0);
        }
        return out;
    }, [currentUser]);
    const finalByStat = useMemo(() => {
        const out = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            const baseValue = baseByStat[stat] || 0;
            const flatBonus = Number(coreStatBonuses[stat].flat) || 0;
            const percentBonus = (Number(coreStatBonuses[stat].percent) || 0) + championshipVenueAllCorePct;
            out[stat] = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
        }
        return out;
    }, [baseByStat, coreStatBonuses, championshipVenueAllCorePct]);
    const myBadukAbilityTotal = useMemo(
        () =>
            Object.values(finalByStat).reduce((sum, v) => {
                const safe = Number.isFinite(v) ? Math.max(0, v) : 0;
                return sum + Math.min(CORE_STAT_CAP, safe);
            }, 0),
        [finalByStat]
    );
    const myAvgStat = useMemo(() => Math.round(myBadukAbilityTotal / 6), [myBadukAbilityTotal]);

    const isUnlocked = dungeonProgress.unlockedStages.includes(selectedStage);
    const dailyEntryState = useMemo(
        () => getChampionshipDungeonDailyEntryState(currentUser, type, now),
        [currentUser, type, now],
    );
    const canEnterFresh = !showContinueFlow && isUnlocked && dailyEntryState.remaining > 0;
    const showAdEntryButton = !showContinueFlow && dailyEntryState.canWatchAd;
    const isStatShortage = myBadukAbilityTotal < botBadukAbilityAvg;

    const handleClaimAdEntry = () => {
        if (adClaimPending) return;
        const runClaim = () => {
            setAdClaimPending(true);
            void handlers
                .handleAction({ type: 'CLAIM_CHAMPIONSHIP_DUNGEON_AD_ENTRY', payload: { dungeonType: type } })
                .then((result) => {
                    if (result && typeof result === 'object' && 'error' in result && result.error) {
                        window.alert(String(result.error));
                    }
                })
                .finally(() => setAdClaimPending(false));
        };
        showShopAdRewardInterstitial(runClaim, {
            placementName: `championship-dungeon-ad-entry-${type}`,
            onDismissed: () => window.alert(t('common:ads.dismissedNoReward')),
        });
    };

    if (!isOpen) return null;

    const accent = VENUE_MODAL_ACCENT[type];
    const formatLabelKey =
        type === 'neighborhood'
            ? 'championship.venue.formatNeighborhood'
            : type === 'national'
              ? 'championship.venue.formatNational'
              : 'championship.venue.formatWorld';

    return (
        <DraggableWindow
            title={definition.name}
            windowId={`championship-venue-entry-v6-${type}`}
            onClose={onClose}
            initialWidth={entryModalWidth}
            shrinkHeightToContent
            bodyShrinkToContent
            hideFooter
            modal
            isTopmost={isTopmost}
            mobileViewportFit
            mobileViewportMaxHeightCss="92dvh"
            mobileViewportMaxHeightVh={92}
            bodyPaddingClassName="!p-0"
            bodyNoScroll
        >
            <div className="relative flex flex-col overflow-hidden bg-[#0a0b10] text-zinc-100">
                <div className="pointer-events-none absolute inset-0 opacity-[0.28]" aria-hidden>
                    <img src={venueLobbyBg} alt="" className="h-full w-full scale-110 object-cover blur-2xl brightness-[0.3]" />
                </div>
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent.glow}`} aria-hidden />

                <div className="relative z-[1] flex flex-col gap-3 p-3 sm:gap-3.5 sm:p-3.5">
                    {/* 모바일: 세로 스택 / PC: 이미지+정보 나란히 */}
                    <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-stretch sm:justify-center sm:gap-3">
                        <div
                            className={`relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-amber-400/30 sm:h-auto sm:w-[12.75rem] sm:min-h-[17.5rem] ${accent.ring} ring-1 shadow-[0_12px_28px_-16px_rgba(0,0,0,0.9)]`}
                        >
                            <img src={venueLobbyBg} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/35" />
                            <span
                                className={`absolute left-1/2 top-0 z-[2] max-w-[92%] -translate-x-1/2 truncate rounded-b-md border border-t-0 px-2 py-0.5 text-[10px] font-black tracking-wide sm:rounded-b-lg sm:px-2.5 sm:text-xs ${accent.chip} ${accent.chipText}`}
                            >
                                {definition.name}
                            </span>
                            <div className="absolute inset-x-0 bottom-0 z-[2] flex justify-center px-2 pb-2.5 sm:pb-3">
                                <span
                                    className={`inline-flex max-w-[92%] items-center justify-center truncate rounded-full border px-2.5 py-1 text-[11px] font-black tracking-wide shadow-[0_8px_20px_-8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm sm:px-3 sm:py-1.5 sm:text-xs ${accent.chip} ${accent.chipText}`}
                                >
                                    {t(formatLabelKey)}
                                </span>
                            </div>
                        </div>

                        <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-[18.5rem] sm:shrink-0">
                            <div className={`flex flex-col rounded-xl border bg-black/50 p-2.5 sm:p-3 ${accent.panelBorder}`}>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className={`min-w-0 truncate text-xs font-bold tracking-wide sm:text-sm ${accent.label}`}>
                                        {t('championship.venue.vsOpponent')}
                                    </span>
                                    <label className="flex shrink-0 items-center">
                                        <span className="sr-only">{t('championship.venue.stageSelect')}</span>
                                        <select
                                            value={selectedStage}
                                            onChange={e => setSelectedStage(Number(e.target.value))}
                                            className="max-w-[9rem] cursor-pointer appearance-none rounded-md border border-amber-300/35 bg-[#12141c] py-1 pl-2 pr-7 text-xs font-bold tabular-nums text-amber-50 outline-none ring-0 transition-colors hover:border-amber-300/55 focus:border-amber-300/70 sm:text-sm"
                                            style={{
                                                backgroundImage:
                                                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fcd34d' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E\")",
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'right 0.4rem center',
                                            }}
                                        >
                                            {unlockedStages.map(stage => {
                                                const cleared = isStageCleared(
                                                    dungeonProgress.stageResults,
                                                    stage,
                                                    dungeonProgress.currentStage
                                                );
                                                return (
                                                    <option key={stage} value={stage}>
                                                        {t('championship.venue.stageUnit', { stage })}
                                                        {cleared ? ' ✓' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </label>
                                </div>

                                <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                                    <div className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] text-center text-xs sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:text-sm">
                                        <div className="flex items-center justify-center border-b border-r border-white/10 bg-white/[0.03] px-1 py-2 font-semibold text-zinc-400">
                                            {t('championship.venue.itemColumn')}
                                        </div>
                                        <div className="flex items-center justify-center border-b border-r border-white/10 bg-white/[0.03] px-1 py-2 font-semibold leading-tight text-zinc-300">
                                            {t('championship.venue.avgStat')}
                                        </div>
                                        <div className="flex items-center justify-center border-b border-white/10 bg-white/[0.03] px-1 py-2 font-semibold leading-tight text-zinc-300">
                                            {t('championship.venue.badukAbility')}
                                        </div>

                                        <div className="flex items-center justify-center border-b border-r border-white/10 bg-white/[0.03] px-1 py-2.5 font-semibold text-cyan-300">
                                            {t('championship.venue.meColumn')}
                                        </div>
                                        <div className="flex items-center justify-center border-b border-r border-white/10 px-1 py-2.5">
                                            <MyStatCompareValue my={myAvgStat} opponentExpected={botAvgStat} />
                                        </div>
                                        <div className="flex items-center justify-center border-b border-white/10 px-1 py-2.5">
                                            <MyStatCompareValue
                                                my={myBadukAbilityTotal}
                                                opponentExpected={botBadukAbilityAvg}
                                            />
                                        </div>

                                        <div className="flex items-center justify-center border-r border-white/10 bg-white/[0.03] px-1 py-2.5 font-semibold text-violet-300">
                                            {t('championship.venue.opponentColumn')}
                                        </div>
                                        <div className="flex flex-col items-center justify-center border-r border-white/10 px-1 py-2.5">
                                            <span className="font-mono text-sm font-bold tabular-nums text-violet-100 sm:text-base">
                                                {botAvgStat.toLocaleString()}
                                            </span>
                                            <span className="font-mono text-[11px] tabular-nums text-zinc-400 sm:text-xs">
                                                {botStatRange.minStat}~{botStatRange.maxStat}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-center px-1 py-2.5">
                                            <span className="font-mono text-sm font-bold tabular-nums text-violet-100 sm:text-base">
                                                {botBadukAbilityAvg.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`rounded-xl border bg-black/45 px-2.5 py-2.5 sm:px-3 sm:py-3 ${accent.panelBorder}`}>
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="text-xs font-bold text-amber-100/90 sm:text-sm">
                                        {t('championship.venue.defaultReward')}
                                    </span>
                                    <span className="h-px flex-1 bg-amber-300/20" aria-hidden />
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                                    {rewardPreviewPieces.length === 0 ? (
                                        <span className="text-sm text-zinc-500">—</span>
                                    ) : (
                                        rewardPreviewPieces.map(p => (
                                            <RewardThumb
                                                key={p.key}
                                                piece={{ ...p, hideThumbQuantityBadge: true, quantity: '' }}
                                                fluid={false}
                                                showcase
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {showContinueFlow && (
                        <div className="rounded-xl border border-amber-400/40 bg-[#1a1408] p-2.5">
                            <p className="mb-2 text-center text-xs leading-snug text-amber-50/95 sm:text-sm">
                                {hasUnclaimedCompleteResult
                                    ? t('championship.venue.inProgressToday')
                                    : t('championship.venue.inProgress')}
                            </p>
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onContinue();
                                        onClose();
                                    }}
                                    className={VENUE_CONTINUE_BTN_CLASS}
                                >
                                    {continueLabel}
                                </button>
                            </div>
                        </div>
                    )}

                    {!showContinueFlow && (
                        <div className="flex flex-col items-center gap-1.5 pb-[max(0.15rem,env(safe-area-inset-bottom,0px))] pt-0.5">
                            {isStatShortage && (canEnterFresh || showAdEntryButton) && (
                                <p className="max-w-[18rem] text-center text-xs font-medium leading-snug text-red-300/95 sm:text-sm">
                                    {t('championship.venue.statShortageWarning')}
                                </p>
                            )}
                            {showAdEntryButton ? (
                                <button
                                    type="button"
                                    onClick={handleClaimAdEntry}
                                    disabled={adClaimPending}
                                    className={VENUE_AD_BTN_CLASS}
                                >
                                    {adClaimPending
                                        ? t('championship.venue.adEntryClaiming')
                                        : isAdFree
                                          ? t('championship.venue.extraEntry')
                                          : t('championship.venue.watchAdForEntry')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (canEnterFresh) {
                                            onEnter(selectedStage);
                                            onClose();
                                        }
                                    }}
                                    disabled={!canEnterFresh}
                                    className={VENUE_ENTER_BTN_CLASS}
                                >
                                    <span>{t('championship.venue.enter')}</span>
                                    <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none text-amber-50/95 ring-1 ring-white/15">
                                        {dailyEntryState.remaining}/{dailyEntryState.max}
                                    </span>
                                </button>
                            )}
                            {!isUnlocked && (
                                <p className="text-center text-xs leading-tight text-red-300/90">
                                    {t('championship.venue.stageLocked')}
                                </p>
                            )}
                            {!showAdEntryButton && isUnlocked && dailyEntryState.remaining <= 0 && (
                                <p className="text-center text-xs leading-tight text-amber-200/80">
                                    {t('championship.venue.dailyEntryExhausted')}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChampionshipVenueEntryModal;
