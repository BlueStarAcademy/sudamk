import React, { useEffect, useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { TournamentType, UserWithStatus, TournamentState } from '../types.js';
import { CoreStat, ItemGrade } from '../types/enums.js';
import { calculateUserEffects } from '../services/effectService.js';
import {
    TOURNAMENT_DEFINITIONS,
    DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT,
    DUNGEON_STAGE_BASE_REWARDS_MATERIAL,
    DUNGEON_STAGE_BOT_STATS,
    gradeBackgrounds,
} from '../constants';
import {
    DUNGEON_STAGE_EQUIPMENT_DROP,
    getDungeonBasicRewardRangeGold,
    getDungeonRankKeysForDisplay,
    getDungeonRankRewardRangeForDisplay,
    type DungeonRankRewardRangeItem,
    type EquipmentGradeKey,
} from '../shared/constants/tournaments.js';
import { normalizeDungeonProgress, isStageCleared } from '../utils/championshipDungeonProgress.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import {
    getChampionshipRewardItemGrade,
    getChampionshipRewardItemImageUrl,
} from '../utils/championshipRewardDisplay.js';

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
};

function getDungeonBotStatRangeForStage(stage: number): { minStat: number; maxStat: number } {
    const clamped = Math.min(10, Math.max(1, Number.isFinite(stage) ? Math.floor(stage) : 1));
    return DUNGEON_STAGE_BOT_STATS[clamped] ?? DUNGEON_STAGE_BOT_STATS[1] ?? { minStat: 100, maxStat: 120 };
}

function fallbackIconByName(name: string): string {
    if (name.includes('골드')) return '/images/icon/Gold.png';
    if (name.includes('다이아')) return '/images/icon/Zem.png';
    return '';
}

const WORLD_EQUIP_GRADE_LABEL: Record<string, string> = {
    normal: '일반',
    uncommon: '희귀',
    rare: '레어',
    epic: '에픽',
    legendary: '전설',
    mythic: '신화',
};

const WORLD_EQUIP_GRADE_ORDER: EquipmentGradeKey[] = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function formatWorldEquipmentDropCaptionLines(stage: number): string[] {
    const config = DUNGEON_STAGE_EQUIPMENT_DROP[stage] || DUNGEON_STAGE_EQUIPMENT_DROP[1];
    const grades = [...config.win.map(e => e.grade), ...config.loss.map(e => e.grade)];
    if (grades.length === 0) return ['1개/경기 (랜덤)'];
    let lo = grades[0];
    let hi = grades[0];
    for (const g of grades) {
        if (WORLD_EQUIP_GRADE_ORDER.indexOf(g) < WORLD_EQUIP_GRADE_ORDER.indexOf(lo)) lo = g;
        if (WORLD_EQUIP_GRADE_ORDER.indexOf(g) > WORLD_EQUIP_GRADE_ORDER.indexOf(hi)) hi = g;
    }
    const loL = WORLD_EQUIP_GRADE_LABEL[lo] ?? lo;
    const hiL = WORLD_EQUIP_GRADE_LABEL[hi] ?? hi;
    const rangeLine = lo === hi ? `등급: ${loL}` : `등급 범위: ${loL}~${hiL}`;

    const fmt = (entries: { grade: EquipmentGradeKey; chance: number }[]) =>
        entries.map(e => `${WORLD_EQUIP_GRADE_LABEL[e.grade] ?? e.grade}(${e.chance}%)`).join(' · ');

    return [rangeLine, '1개/경기 (랜덤)', `승리: ${fmt(config.win)}`, `패배: ${fmt(config.loss)}`];
}

function formatRankGroupLabel(ranks: number[]): string {
    if (ranks.length === 0) return '';
    const lo = ranks[0];
    const hi = ranks[ranks.length - 1];
    if (lo === hi) return `${lo}위`;
    return `${lo}~${hi}위`;
}

function formatRangeQuantity(min: number, max: number): string {
    if (min === max) return min.toLocaleString();
    return `${min.toLocaleString()}~${max.toLocaleString()}`;
}

function parseDungeonRankRangeToPieces(items: DungeonRankRewardRangeItem[]): RewardPiece[] {
    const out: RewardPiece[] = [];
    items.forEach((it, idx) => {
        const qty = formatRangeQuantity(it.min, it.max);
        if (it.itemId === '골드') {
            out.push({
                key: `rank-g-${idx}`,
                label: '골드',
                quantity: qty,
                imageUrl: '/images/icon/Gold.png',
                frame: 'gold',
                quantityOnThumbOnly: true,
            });
        } else if (it.itemId === '다이아') {
            out.push({
                key: `rank-d-${idx}`,
                label: '다이아',
                quantity: qty,
                imageUrl: '/images/icon/Zem.png',
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
            type === 'world' && rankKey === 9 ? '9~16위' : type === 'world' && rankKey === 4 ? '4~8위' : `${rankKey}위`;

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
                imageUrl: '/images/icon/Gold.png',
                frame: 'gold',
                mysteryNeighborhoodGold: true,
                hideThumbQuantityBadge: true,
                quantityOnThumbOnly: true,
                captionTooltipOnly: true,
                captionBesideThumb: [
                    `승리 시 ${range.win.min.toLocaleString()}~${range.win.max.toLocaleString()} 골드`,
                    `패배 시 ${range.loss.min.toLocaleString()}~${range.loss.max.toLocaleString()} 골드`,
                ],
            },
        ];
    }
    if (type === 'national') {
        const m = DUNGEON_STAGE_BASE_REWARDS_MATERIAL[stage];
        if (!m) return [];
        return [
            {
                key: 'base-mat',
                label: m.materialName,
                quantity: `×${m.quantity}`,
                imageUrl: getChampionshipRewardItemImageUrl(m.materialName) || '/images/materials/materials1.png',
                grade: getChampionshipRewardItemGrade(m.materialName),
                quantityOnThumbOnly: true,
            },
        ];
    }
    if (type === 'world') {
        const e = DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage];
        if (!e) return [];
        const boxImg = getChampionshipRewardItemImageUrl('장비 상자 I') || '/images/Box/EquipmentBox1.png';
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
                captionBelowThumb: '장비',
            },
        ];
        if (e.changeTickets > 0) {
            list.push({
                key: 'tickets',
                label: '장비 변경권',
                quantity: '',
                imageUrl: '/images/use/change1.png',
                mysteryChangeTicket: true,
                hideThumbQuantityBadge: true,
                quantityOnThumbOnly: true,
                captionTooltipOnly: true,
                captionBesideThumb: [
                    '경기 결과에 따라 지급 여부·수량이 달라질 수 있습니다 (랜덤).',
                    `단계 기준 최대 ${e.changeTickets}개 범위`,
                ],
                captionBelowThumb: '변경권',
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

const RewardThumb: React.FC<{ piece: RewardPiece; fluid?: boolean }> = ({ piece, fluid = true }) => {
    const [pressTip, setPressTip] = useState(false);
    const box = fluid
        ? 'aspect-square w-full min-h-0 min-w-0'
        : 'h-9 w-9 min-h-[2.25rem] min-w-[2.25rem] shrink-0 sm:h-10 sm:w-10 sm:min-h-10 sm:min-w-10';
    const qtyClass = fluid
        ? 'px-0.5 py-px text-[clamp(7px,2.2vw,11px)]'
        : 'px-0.5 py-px text-[8px] sm:text-[9px]';
    const padImg = fluid ? 'p-[6%] sm:p-[8%]' : 'p-0.5 sm:p-1';
    const mysteryMarkClass = fluid ? 'text-[clamp(0.65rem,3.5vw,1.125rem)]' : 'text-lg';
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
          : `${piece.label} ${piece.quantity}`.trim() || '기본 보상';
    const tipOnly = Boolean(piece.captionTooltipOnly && piece.captionBesideThumb?.length);

    return (
        <div
            className={`relative ${fluid ? 'mx-auto w-full min-w-0 max-w-[3rem] sm:max-w-[3.25rem]' : 'shrink-0'} ${tipOnly ? 'touch-manipulation' : ''}`}
            onPointerDown={tipOnly ? () => setPressTip(true) : undefined}
            onPointerUp={tipOnly ? () => setPressTip(false) : undefined}
            onPointerCancel={tipOnly ? () => setPressTip(false) : undefined}
            onPointerLeave={tipOnly ? () => setPressTip(false) : undefined}
        >
            {tipOnly && pressTip && tooltipLines && (
                <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[min(17rem,calc(100vw-3rem))] -translate-x-1/2 rounded-lg border border-amber-400/35 bg-slate-950/98 px-2.5 py-2 text-left text-[10px] leading-snug text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.65)] sm:text-[11px]"
                    role="tooltip"
                >
                    {tooltipLines.map((line, i) => (
                        <div key={i} className={i > 0 ? 'mt-1 border-t border-white/10 pt-1' : ''}>
                            {line}
                        </div>
                    ))}
                </div>
            )}
            <div
                className={`group/thumb relative overflow-hidden rounded-lg ${fluid ? 'w-full' : 'shrink-0'} ${box} bg-gradient-to-b from-zinc-800/90 to-black/80 ring-1 ${ring} ${tipOnly ? 'cursor-help' : ''}`}
                title={titleText}
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

const RewardStripRow: React.FC<{ piece: RewardPiece }> = ({ piece }) => {
    const hasCaption =
        piece.captionBesideThumb &&
        piece.captionBesideThumb.length > 0 &&
        !piece.captionTooltipOnly;
    const hasBelow = Boolean(piece.captionBelowThumb);
    const alignClass = hasCaption ? 'items-start' : 'items-center';
    const rowJustify = hasCaption ? '' : 'justify-center';
    const layoutClass = hasCaption
        ? 'items-start gap-1'
        : hasBelow
          ? 'flex-col items-center justify-center gap-0'
          : `gap-1 ${alignClass} ${rowJustify}`;
    return (
        <div className={`flex min-w-0 w-full shrink-0 ${layoutClass}`}>
            <RewardThumb piece={piece} fluid={!hasCaption} />
            {hasCaption ? (
                <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5 text-[9px] leading-snug text-zinc-300 sm:text-[10px]">
                    {piece.captionBesideThumb!.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            ) : !piece.quantityOnThumbOnly && !hasBelow ? (
                <span
                    className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-medium text-zinc-200 sm:text-xs"
                    title={`${piece.label} ${piece.quantity}`}
                >
                    {piece.label}
                    <span className="ml-1 tabular-nums font-semibold text-amber-200/90">{piece.quantity}</span>
                </span>
            ) : null}
            {hasBelow ? (
                <span className="max-w-full text-center text-[10px] font-semibold leading-none text-zinc-400 sm:text-[11px]">
                    {piece.captionBelowThumb}
                </span>
            ) : null}
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

const MyStatCompareCell: React.FC<{ my: number; opponentExpected: number; borderBottom?: boolean }> = ({
    my,
    opponentExpected,
    borderBottom = true,
}) => {
    const tone = compareToneVsExpected(my, opponentExpected);
    const diff = my - opponentExpected;
    const valueCls = `font-mono text-sm font-bold tabular-nums leading-none sm:text-base ${myStatValueToneClass(tone)}`;
    return (
        <div
            className={`flex min-h-[2.5rem] flex-col items-center justify-center gap-0.5 border-r border-white/[0.07] px-1 py-1.5 ${borderBottom ? 'border-b border-white/[0.07]' : ''}`}
        >
            <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0.5">
                <span className={valueCls}>{my.toLocaleString()}</span>
                {diff !== 0 && (
                    <span
                        className={`whitespace-nowrap text-[11px] font-bold tabular-nums leading-none sm:text-xs ${diffArrowBadgeClass(diff, tone)}`}
                        title={diff > 0 ? `+${diff}` : `${diff}`}
                    >
                        {diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
                    </span>
                )}
            </div>
        </div>
    );
};

const SectionTitle: React.FC<{ children: React.ReactNode; accent: 'cyan' | 'amber' }> = ({ children, accent }) => {
    const line =
        accent === 'cyan'
            ? 'from-cyan-400/50 via-cyan-300/20 to-transparent'
            : 'from-amber-400/50 via-amber-300/15 to-transparent';
    const text = accent === 'cyan' ? 'text-cyan-100/95' : 'text-amber-100/95';
    return (
        <div className="mb-1.5 flex items-center gap-2">
            <span className={`whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] sm:text-sm ${text}`}>{children}</span>
            <span className={`h-px min-w-0 flex-1 bg-gradient-to-r ${line}`} aria-hidden />
        </div>
    );
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
    const definition = TOURNAMENT_DEFINITIONS[type];
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

    const maxUnlockedStage = useMemo(
        () => (dungeonProgress.unlockedStages.length > 0 ? Math.max(...dungeonProgress.unlockedStages) : 1),
        [dungeonProgress.unlockedStages]
    );

    const [selectedStage, setSelectedStage] = useState(maxUnlockedStage);
    useEffect(() => {
        if (isOpen) setSelectedStage(maxUnlockedStage);
    }, [isOpen, maxUnlockedStage]);

    const now = Date.now();
    let playedDateKey: keyof UserWithStatus;
    switch (type) {
        case 'neighborhood':
            playedDateKey = 'lastNeighborhoodPlayedDate';
            break;
        case 'national':
            playedDateKey = 'lastNationalPlayedDate';
            break;
        case 'world':
            playedDateKey = 'lastWorldPlayedDate';
            break;
    }
    const lastPlayedDate = currentUser[playedDateKey as keyof UserWithStatus] as number | null | undefined;
    const hasPlayedToday = lastPlayedDate && isSameDayKST(lastPlayedDate, now);

    const hasResultToView = inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isCompletedToday = !!(hasPlayedToday && hasResultToView);
    const hasStartedMatch =
        inProgress &&
        (inProgress.status === 'round_in_progress' || inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isDungeonMode = !!(
        hasStartedMatch &&
        inProgress &&
        inProgress.currentStageAttempt !== undefined &&
        inProgress.currentStageAttempt !== null
    );
    const showContinueFlow = isCompletedToday || !!(isDungeonMode && inProgress);

    let continueLabel = '이어서 보기';
    if (isCompletedToday) {
        continueLabel = '결과보기';
    } else if (isDungeonMode && inProgress) {
        if (inProgress.status === 'complete' || inProgress.status === 'eliminated') {
            continueLabel = '결과보기';
        } else {
            continueLabel = '이어서 보기';
        }
    }

    const basePieces = useMemo(() => getBaseRewardPieces(type, selectedStage), [type, selectedStage]);

    const rankRewardGroups = useMemo(
        () => buildDungeonRankRewardGroupsForEntryModal(type, selectedStage),
        [type, selectedStage]
    );

    const botStatRange = useMemo(() => getDungeonBotStatRangeForStage(selectedStage), [selectedStage]);
    const botAvgStat = useMemo(
        () => Math.round((botStatRange.minStat + botStatRange.maxStat) / 2),
        [botStatRange]
    );
    /** 6개 핵심 능력치 각각이 위 범위·평균을 따를 때의 기대 합(참고) */
    const botBadukAbilityAvg = useMemo(() => botAvgStat * 6, [botAvgStat]);

    const { coreStatBonuses } = useMemo(() => calculateUserEffects(currentUser), [currentUser]);
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
            out[stat] = Math.floor((baseValue + coreStatBonuses[stat].flat) * (1 + coreStatBonuses[stat].percent / 100));
        }
        return out;
    }, [baseByStat, coreStatBonuses]);
    const myBadukAbilityTotal = useMemo(
        () => Object.values(finalByStat).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0),
        [finalByStat]
    );
    const myAvgStat = useMemo(() => Math.round(myBadukAbilityTotal / 6), [myBadukAbilityTotal]);

    const isUnlocked = dungeonProgress.unlockedStages.includes(selectedStage);
    const canEnterFresh = !showContinueFlow && isUnlocked;

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title={definition.name}
            windowId={`championship-venue-entry-${type}`}
            onClose={onClose}
            initialWidth={760}
            initialHeight={720}
            modal
            isTopmost={isTopmost}
            mobileViewportFit
            mobileViewportMaxHeightCss="92dvh"
            mobileViewportMaxHeightVh={94}
            bodyNoScroll
            hideFooter
            bodyPaddingClassName="!p-0"
        >
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#07080c] text-zinc-100">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    }}
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-900/25 via-violet-900/10 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-purple-600/15 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-amber-600/10 blur-3xl" aria-hidden />

                <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-1 p-2 sm:gap-1.5 sm:p-3">
                    <div className="relative flex h-[3.35rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-amber-500/25 sm:h-[5rem]">
                        <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 to-black/25" />
                        <div className="relative z-[1] flex flex-1 flex-col justify-center px-3.5 py-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80 sm:text-xs">Championship</span>
                            <span className="line-clamp-1 text-lg font-bold leading-tight text-white drop-shadow-md sm:text-xl">
                                {definition.name}
                            </span>
                        </div>
                        <div className="relative z-[1] flex items-center pr-3 sm:pr-4">
                            <div className="rounded-lg bg-black/55 px-3 py-1.5 ring-1 ring-amber-400/30 backdrop-blur-sm">
                                <span className="block text-center text-[10px] font-semibold uppercase tracking-wider text-amber-200/85 sm:text-xs">단계</span>
                                <span className="block text-center text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{selectedStage}</span>
                            </div>
                        </div>
                    </div>

                    {showContinueFlow && (
                        <div className="shrink-0 rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-950/50 via-yellow-950/25 to-amber-950/40 p-2.5 ring-1 ring-inset ring-amber-500/15 sm:p-3">
                            <p className="mb-2 text-center text-sm leading-snug text-amber-50/90 sm:text-base">
                                {isCompletedToday ||
                                (isDungeonMode && inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated'))
                                    ? '오늘 진행한 경기가 있습니다. 결과를 확인하세요.'
                                    : '진행 중인 경기가 있습니다.'}
                            </p>
                            <Button
                                onClick={() => {
                                    onContinue();
                                    onClose();
                                }}
                                colorScheme="none"
                                className="w-full border border-amber-400/40 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 py-2.5 text-base font-bold text-amber-950 shadow-lg shadow-amber-900/30 hover:from-amber-500 hover:to-yellow-500 sm:py-3 sm:text-lg"
                            >
                                {continueLabel}
                            </Button>
                        </div>
                    )}

                    <div className="shrink-0">
                        <SectionTitle accent="cyan">단계 선택</SectionTitle>
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stage => {
                                const unlocked = dungeonProgress.unlockedStages.includes(stage);
                                const maxUnlocked = dungeonProgress.unlockedStages.length > 0 ? Math.max(...dungeonProgress.unlockedStages) : 1;
                                const cleared = isStageCleared(dungeonProgress.stageResults, stage, dungeonProgress.currentStage, maxUnlocked);
                                const isNext = stage === dungeonProgress.currentStage + 1;
                                const active = selectedStage === stage;
                                return (
                                    <button
                                        key={stage}
                                        type="button"
                                        disabled={!unlocked}
                                        onClick={() => unlocked && setSelectedStage(stage)}
                                        className={`relative rounded-lg py-2 text-center text-sm font-bold tabular-nums transition-all sm:py-2.5 sm:text-base ${
                                            !unlocked
                                                ? 'cursor-not-allowed bg-zinc-950/80 text-zinc-600 ring-1 ring-zinc-800'
                                                : active
                                                  ? 'bg-gradient-to-b from-violet-600 to-indigo-800 text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.55)] ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#07080c]'
                                                  : isNext
                                                    ? 'bg-gradient-to-b from-violet-800/90 to-zinc-900 text-violet-100 ring-1 ring-violet-400/35 hover:from-violet-700'
                                                    : cleared
                                                      ? 'bg-gradient-to-b from-emerald-950/80 to-zinc-900 text-emerald-200/90 ring-1 ring-emerald-500/25 hover:from-emerald-900/70'
                                                      : 'bg-gradient-to-b from-zinc-800 to-zinc-950 text-zinc-200 ring-1 ring-white/10 hover:from-zinc-700'
                                        }`}
                                    >
                                        {stage}
                                        {cleared && (
                                            <span className="absolute right-1 top-1 text-[10px] leading-none text-emerald-300 sm:text-xs" aria-hidden>
                                                ✓
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="shrink-0 rounded-xl border border-violet-500/25 bg-black/35 p-1.5 ring-1 ring-inset ring-violet-500/10 sm:p-2">
                        <SectionTitle accent="cyan">나 vs 상대 (참고)</SectionTitle>
                        <div className="mt-0.5 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="grid grid-cols-[minmax(4.75rem,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-0 text-center">
                                <div className="border-b border-r border-white/[0.07] bg-black/35 py-1.5 text-xs font-bold tracking-wide text-zinc-400 sm:py-2 sm:text-sm">
                                    항목
                                </div>
                                <div className="border-b border-r border-white/[0.07] bg-black/35 py-1.5 text-xs font-bold tracking-wide text-cyan-200 sm:py-2 sm:text-sm">
                                    나
                                </div>
                                <div className="border-b border-white/[0.07] bg-black/35 py-1.5 text-xs font-bold tracking-wide text-violet-200 sm:py-2 sm:text-sm">
                                    상대
                                </div>

                                <div className="border-b border-r border-white/[0.07] px-1 py-2 text-center text-xs font-semibold leading-snug text-zinc-300 sm:px-2 sm:text-sm">
                                    평균 능력치
                                </div>
                                <MyStatCompareCell my={myAvgStat} opponentExpected={botAvgStat} borderBottom />
                                <div className="flex flex-col items-center justify-center border-b border-white/[0.07] px-0.5 py-1.5 sm:px-1 sm:py-2">
                                    <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                                        <span className="font-mono text-sm font-bold tabular-nums text-violet-100 sm:text-base">
                                            {botAvgStat.toLocaleString()}
                                        </span>
                                        <span className="font-mono text-[10px] font-medium tabular-nums text-zinc-400 sm:text-[11px]">
                                            ({botStatRange.minStat}~{botStatRange.maxStat})
                                        </span>
                                    </div>
                                </div>

                                <div className="border-r border-white/[0.07] px-1 py-2 text-center text-xs font-semibold leading-snug text-zinc-300 sm:px-2 sm:text-sm">
                                    바둑능력
                                </div>
                                <MyStatCompareCell my={myBadukAbilityTotal} opponentExpected={botBadukAbilityAvg} borderBottom={false} />
                                <div className="flex flex-col items-center justify-center px-0.5 py-1.5 sm:px-1 sm:py-2">
                                    <span className="font-mono text-sm font-bold tabular-nums text-violet-100 sm:text-base">
                                        {botBadukAbilityAvg.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-600/35 bg-zinc-950/55 ring-1 ring-inset ring-white/[0.06]">
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(52,211,153,0.35)_transparent] sm:p-2">
                            <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-0">
                                <div className="flex min-w-0 flex-1 basis-0 flex-col items-stretch gap-0 pr-px">
                                    <div className="flex min-h-8 w-full shrink-0 items-center justify-center border-b border-white/[0.07] px-0.5 pb-0.5 text-center">
                                        <span className="text-xs font-bold leading-tight text-emerald-400 sm:text-sm">
                                            기본 보상
                                        </span>
                                    </div>
                                    <div
                                        className={`min-w-0 w-full pt-1 ${
                                            type === 'world' && basePieces.length > 1
                                                ? 'grid grid-cols-2 items-end justify-items-center gap-x-2'
                                                : 'flex flex-col items-stretch gap-1'
                                        }`}
                                    >
                                        {basePieces.length === 0 ? (
                                            <span className="text-sm text-zinc-500">—</span>
                                        ) : type === 'world' && basePieces.length > 1 ? (
                                            basePieces.map(p => (
                                                <div key={p.key} className="flex min-w-0 w-full justify-center">
                                                    <RewardStripRow piece={p} />
                                                </div>
                                            ))
                                        ) : (
                                            basePieces.map(p => <RewardStripRow key={p.key} piece={p} />)
                                        )}
                                    </div>
                                </div>
                                {rankRewardGroups.length === 0 ? (
                                    <div className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center border-l border-white/[0.08] pl-px sm:pl-0.5">
                                        <span className="text-center text-xs leading-tight text-zinc-500 sm:text-sm">없음</span>
                                    </div>
                                ) : (
                                    rankRewardGroups.map(({ ranks, headRank, rankLabel, pieces }) => {
                                        const noReward = pieces.length === 0;
                                        return (
                                        <div
                                            key={ranks.join('-')}
                                            className="flex min-w-0 flex-1 basis-0 flex-col items-stretch gap-0 border-l border-white/[0.08] pl-px sm:pl-0.5"
                                        >
                                            <div className="flex min-h-8 w-full shrink-0 items-center justify-center border-b border-white/[0.07] px-0.5 pb-0.5 text-center">
                                                <span
                                                    className={`max-w-full text-xs font-bold leading-tight sm:text-sm ${
                                                        noReward ? 'truncate' : 'whitespace-nowrap'
                                                    } ${
                                                        headRank === 1
                                                            ? 'text-amber-300'
                                                            : headRank === 2
                                                              ? 'text-slate-200'
                                                              : headRank === 3
                                                                ? 'text-orange-300/95'
                                                                : 'text-zinc-300'
                                                    }`}
                                                    title={rankLabel}
                                                >
                                                    {rankLabel}
                                                </span>
                                            </div>
                                            <div className="flex w-full min-w-0 flex-col items-stretch gap-1 pt-1">
                                                {noReward ? (
                                                    <span className="text-center text-xs leading-tight text-zinc-500 sm:text-sm">없음</span>
                                                ) : (
                                                    pieces.map(p => <RewardStripRow key={p.key} piece={p} />)
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {!showContinueFlow && (
                        <div className="relative z-10 flex shrink-0 flex-col items-center gap-1.5 border-t border-white/10 bg-[#07080c]/95 pt-2.5 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] backdrop-blur-[2px] sm:gap-2 sm:pt-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (canEnterFresh) {
                                        onEnter(selectedStage);
                                        onClose();
                                    }
                                }}
                                disabled={!canEnterFresh}
                                className="group relative mx-auto w-auto min-w-[13rem] max-w-[min(17rem,90vw)] overflow-hidden rounded-full border border-violet-300/45 bg-gradient-to-b from-violet-500 via-indigo-600 to-violet-950 px-9 py-3 text-base font-bold text-white shadow-[0_10px_36px_-10px_rgba(109,40,217,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:border-violet-200/50 hover:shadow-[0_14px_40px_-8px_rgba(139,92,246,0.55)] disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none sm:min-w-[14.5rem] sm:px-11 sm:py-3.5 sm:text-lg"
                            >
                                <span
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                                    aria-hidden
                                />
                                <span className="relative flex items-center justify-center gap-2">
                                    <span className="tracking-wide">입장하기</span>
                                    <span className="rounded-full bg-black/25 px-2 py-0.5 text-sm font-extrabold tabular-nums text-violet-100 ring-1 ring-white/15 sm:text-base">
                                        {selectedStage}단계
                                    </span>
                                </span>
                            </button>
                            {!isUnlocked && (
                                <p className="text-center text-sm text-red-300/90 sm:text-base">선택한 단계는 아직 잠겨 있습니다.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChampionshipVenueEntryModal;
