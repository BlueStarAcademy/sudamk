import React, { useEffect, useMemo, useState } from 'react';
import type { GameSummary } from '../../types.js';
import { CONSUMABLE_ITEMS, CORE_STATS_DATA, EQUIPMENT_POOL, gradeStyles, MATERIAL_ITEMS } from '../../constants.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import { getAdventureCodexMonsterById } from '../../constants/adventureMonstersCodex.js';
import {
    ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL,
    ADVENTURE_CODEX_MAX_LEVEL,
    adventureCodexNormalPercentLabelKo,
    adventureCodexPercentBossBonusLabelKo,
    CODEX_COMPREHENSION_GRADE_BACKGROUNDS,
    getAdventureCodexComprehensionBarProgress,
    getAdventureCodexComprehensionLevel,
    getAdventureMonsterComprehensionDesign,
    getCodexComprehensionItemGrade,
} from '../../utils/adventureCodexComprehension.js';
import { useResilientImgSrc } from '../../hooks/useResilientImgSrc.js';
import { ResultModalXpRewardBadge } from './ResultModalXpRewardBadge.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    equipmentGradeRewardIconShellClassNames,
    RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_FIVE_COL_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_SIX_COL_CLASS,
} from './ResultModalRewardSlot.js';
import { ResultModalVipRewardSlot } from './ResultModalVipRewardSlot.js';

const ADVENTURE_DEFAULT_EQUIP_BOX_IMG =
    CONSUMABLE_ITEMS.find((c) => c.name === '장비 상자 I')?.image ?? '/images/Box/EquipmentBox1.png';
const ADVENTURE_DEFAULT_MAT_BOX_IMG =
    CONSUMABLE_ITEMS.find((c) => c.name === '재료 상자 I')?.image ?? '/images/Box/ResourceBox1.png';

const ADVENTURE_REWARD_REVEAL_MS = 3000;
const ADVENTURE_REWARD_ROLL_MS = 2800;

function HalfKeyEmojiIcon({ compact }: { compact: boolean }) {
    return (
        <span
            className={`relative inline-flex items-center justify-center overflow-hidden ${compact ? 'h-6 w-4' : 'h-9 w-6'}`}
            aria-label="열쇠 조각"
        >
            <span
                className={`absolute right-0 select-none leading-none ${compact ? 'text-[22px]' : 'text-[34px]'}`}
                style={{ width: compact ? 22 : 34 }}
            >
                🔑
            </span>
        </span>
    );
}

function normalizeRewardImagePath(src: string | undefined | null): string | null {
    if (!src) return null;
    return src.startsWith('/') ? src : `/${src}`;
}

function adventureRewardSlotItemImage(displayName: string | undefined): string | null {
    if (!displayName) return null;
    const ci = CONSUMABLE_ITEMS.find((c) => c.name === displayName);
    if (ci?.image) return normalizeRewardImagePath(ci.image);
    const mat = MATERIAL_ITEMS[displayName];
    if (mat?.image) return normalizeRewardImagePath(mat.image);
    const eq = EQUIPMENT_POOL.find((e) => e.name === displayName);
    if (eq?.image) return normalizeRewardImagePath(eq.image);
    return null;
}

/** 서버에 grade가 없는 구버전 요약: 장비 이름으로 풀에서 등급 추론 */
function adventureEquipmentGradeFromDisplayName(displayName: string | undefined, explicit?: ItemGrade): ItemGrade | undefined {
    if (explicit != null) return explicit;
    if (!displayName) return undefined;
    const eq = EQUIPMENT_POOL.find((e) => e.name === displayName);
    return eq?.grade;
}

function pickDecoyEquipmentNames(n: number, exclude: string): string[] {
    const pool = EQUIPMENT_POOL.filter((e) => e.image && e.name !== exclude);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        out.push(pool[Math.floor(Math.random() * pool.length)]?.name ?? exclude);
    }
    return out;
}

function pickDecoyMaterialNames(n: number, exclude: string): string[] {
    const keys = Object.keys(MATERIAL_ITEMS).filter((k) => k !== exclude);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        out.push(keys[Math.floor(Math.random() * keys.length)] ?? exclude);
    }
    return out;
}

function codexGradeBorderClass(grade: ItemGrade | null): string {
    switch (grade ?? ItemGrade.Normal) {
        case ItemGrade.Normal:
            return 'border-zinc-400';
        case ItemGrade.Uncommon:
            return 'border-emerald-500';
        case ItemGrade.Rare:
            return 'border-sky-500';
        case ItemGrade.Epic:
            return 'border-violet-500';
        case ItemGrade.Legendary:
            return 'border-rose-500';
        case ItemGrade.Mythic:
            return 'border-amber-400';
        case ItemGrade.Transcendent:
            return 'border-cyan-400';
        default:
            return 'border-zinc-400';
    }
}

function buildAdventureCodexEffectLinesKo(codexId: string, level: number): string[] {
    const m = getAdventureCodexMonsterById(codexId);
    if (!m || level <= 0) return [];
    const bossBonus = 'codexPercentBossBonus' in m && m.codexPercentBossBonus ? m.codexPercentBossBonus : undefined;
    const design = getAdventureMonsterComprehensionDesign(codexId);
    const lines: string[] = [];
    if (bossBonus) {
        const pct = Math.min(level, ADVENTURE_CODEX_MAX_LEVEL) * ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL;
        lines.push(`보스: ${adventureCodexPercentBossBonusLabelKo(bossBonus)} +${pct}%`);
        return lines;
    }
    if (design && !design.isBoss) {
        for (const stat of Object.values(CoreStat)) {
            const add = (design.coreStatBonusPerLevel[stat] ?? 0) * level;
            if (add > 0) lines.push(`${CORE_STATS_DATA[stat]?.name ?? stat} +${add}`);
        }
        if (design.normalPercentBonus) {
            const specPct = design.normalPercentBonus.percentPerLevel * level;
            if (specPct > 0.0005) {
                lines.push(
                    `모험: ${adventureCodexNormalPercentLabelKo(design.normalPercentBonus.kind)} +${specPct}%`,
                );
            }
        }
    }
    return lines;
}

function VerticalReel({
    rowPx,
    children,
}: {
    rowPx: number;
    children: React.ReactNode[];
}) {
    const n = children.length;
    const [go, setGo] = useState(false);
    useEffect(() => {
        const id = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => setGo(true));
        });
        return () => window.cancelAnimationFrame(id);
    }, []);
    const y = go ? -(n - 1) * rowPx : 0;
    return (
        <div className="relative w-full max-w-full overflow-hidden" style={{ height: rowPx }}>
            <div
                className="will-change-transform"
                style={{
                    transform: `translateY(${y}px)`,
                    transition: `transform ${ADVENTURE_REWARD_ROLL_MS}ms cubic-bezier(0.15, 0.72, 0.1, 1)`,
                }}
            >
                {children.map((c, i) => (
                    <div
                        key={i}
                        className="flex w-full max-w-full items-center justify-center overflow-hidden"
                        style={{ height: rowPx }}
                    >
                        {c}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AdventureMissedRewardSlot({
    compact,
    iconSrc,
    questionOverlay,
}: {
    compact: boolean;
    iconSrc: string;
    questionOverlay?: boolean;
}) {
    const box = compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]';
    const imgCls = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5 opacity-50 grayscale'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12 opacity-50 grayscale';
    return (
        <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''}`}>
            <div className={`${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${box}`}>
                <img src={iconSrc} alt="" className={imgCls} draggable={false} />
                {questionOverlay ? (
                    <span
                        className={`pointer-events-none absolute inset-0 flex items-center justify-center font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95),0_0_12px_rgba(0,0,0,0.65)] ${
                            compact ? 'text-lg min-[400px]:text-xl' : 'text-2xl min-[1024px]:text-3xl'
                        }`}
                        aria-hidden
                    >
                        ?
                    </span>
                ) : null}
            </div>
            <span
                className={
                    compact
                        ? 'text-center text-[0.72rem] font-bold tabular-nums text-slate-500'
                        : 'text-center text-sm font-bold tabular-nums text-slate-500 min-[1024px]:text-base'
                }
            >
                미획득
            </span>
        </div>
    );
}

function AdventureKeyFragmentRewardSlot({
    compact,
    amount,
}: {
    compact: boolean;
    amount: number;
}) {
    const qty = Math.max(1, Math.floor(amount));
    return (
        <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''}`}>
            <div
                className={`${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'} flex-col`}
            >
                <HalfKeyEmojiIcon compact={compact} />
            </div>
            <span
                className={
                    compact
                        ? 'text-center text-[0.72rem] font-bold tabular-nums text-amber-100'
                        : 'text-center text-sm font-bold tabular-nums text-amber-100 min-[1024px]:text-base'
                }
            >
                ×{qty}
            </span>
        </div>
    );
}

function GoldRollingPlaceholder({
    compact,
    obtained,
    targetAmount,
}: {
    compact: boolean;
    obtained: boolean;
    targetAmount: number;
}) {
    const rowPx = compact ? 22 : 28;
    const decoys = useMemo(() => {
        if (!obtained) {
            return Array.from({ length: 10 }, (_, i) => (
                <span
                    key={i}
                    className={
                        compact
                            ? 'text-[0.72rem] font-bold tabular-nums text-slate-500'
                            : 'text-sm font-bold tabular-nums text-slate-500 min-[1024px]:text-base'
                    }
                >
                    ???
                </span>
            ));
        }
        const nums: React.ReactNode[] = [];
        for (let i = 0; i < 10; i++) {
            const v = Math.max(1, Math.floor(Math.random() * Math.max(targetAmount * 2, 800)));
            nums.push(
                <span
                    key={i}
                    className={
                        compact
                            ? 'text-[0.72rem] font-bold tabular-nums text-amber-100'
                            : 'text-sm font-bold tabular-nums text-amber-100 min-[1024px]:text-base'
                    }
                >
                    {v.toLocaleString()}
                </span>,
            );
        }
        return nums;
    }, [obtained, targetAmount, compact]);

    const imgClass = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 sm:h-9 sm:w-9'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';

    const finalNum = (
        <span
            className={
                compact
                    ? 'text-[0.72rem] font-bold tabular-nums text-amber-100'
                    : 'text-sm font-bold tabular-nums text-amber-100 min-[1024px]:text-base'
            }
        >
            {obtained ? targetAmount.toLocaleString() : '—'}
        </span>
    );

    return (
        <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''}`}>
            <div
                className={`${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'}`}
            >
                <img src="/images/icon/Gold.png" alt="" className={imgClass} />
            </div>
            <VerticalReel rowPx={rowPx} children={[...decoys, finalNum]} />
        </div>
    );
}

function EquipmentRollingPlaceholder({
    compact,
    finalName,
    finalGrade,
}: {
    compact: boolean;
    finalName: string;
    finalGrade?: ItemGrade;
}) {
    const rowH = compact ? 64 : 88;
    const decoyNames = useMemo(() => pickDecoyEquipmentNames(10, finalName), [finalName]);
    const imgClass = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';

    const row = (name: string, isFinal: boolean) => {
        const src = adventureRewardSlotItemImage(name);
        const gradeBox = isFinal && finalGrade != null ? equipmentGradeRewardIconShellClassNames(finalGrade) : null;
        return (
            <div className="flex w-full flex-col items-center justify-center gap-0.5 px-0.5">
                <div
                    className={
                        gradeBox
                            ? `${gradeBox.outer} ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'}`
                            : `${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'}`
                    }
                >
                    {gradeBox ? (
                        <>
                            <div
                                className={`pointer-events-none absolute inset-0 ${gradeBox.transcendentClass}`}
                                style={gradeBox.bgStyle}
                                aria-hidden
                            />
                            <div className="relative z-[1] flex h-full w-full items-center justify-center">
                                {src ? (
                                    <img src={src} alt="" className={imgClass} />
                                ) : (
                                    <span className="text-[0.55rem] font-bold text-zinc-200/90">?</span>
                                )}
                            </div>
                        </>
                    ) : src ? (
                        <img src={src} alt="" className={imgClass} />
                    ) : (
                        <span className="text-[0.55rem] font-bold text-slate-300/85">?</span>
                    )}
                </div>
                <span
                    className={`line-clamp-2 w-full text-center font-semibold leading-tight ${
                        isFinal && finalGrade != null
                            ? gradeStyles[finalGrade]?.color ?? 'text-slate-200'
                            : 'text-slate-200/90'
                    } ${compact ? 'text-[0.58rem]' : 'text-[0.65rem] min-[1024px]:text-xs'} ${isFinal ? '' : 'opacity-70'}`}
                >
                    {name}
                </span>
            </div>
        );
    };

    return (
        <div className={`flex flex-col items-center ${compact ? 'max-w-[3.25rem] shrink-0 min-[360px]:max-w-[3.5rem] min-[400px]:max-w-12 sm:max-w-[6.75rem]' : 'max-w-[6.75rem]'}`}>
            <VerticalReel
                rowPx={rowH}
                children={[...decoyNames.map((n) => row(n, false)), row(finalName, true)]}
            />
        </div>
    );
}

function MaterialRollingPlaceholder({
    compact,
    finalName,
    finalQty,
}: {
    compact: boolean;
    finalName: string;
    finalQty: number;
}) {
    const rowH = compact ? 56 : 74;
    const decoyNames = useMemo(() => pickDecoyMaterialNames(10, finalName), [finalName]);
    const imgClass = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';

    const row = (matName: string, qty: number) => {
        const src = adventureRewardSlotItemImage(matName);
        return (
            <div className="flex w-full flex-col items-center justify-center gap-0.5">
                <div
                    className={`${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'}`}
                >
                    {src ? <img src={src} alt="" className={imgClass} /> : <span className="text-[0.55rem] text-slate-200/90">?</span>}
                </div>
                <span
                    className={
                        compact
                            ? 'text-[0.72rem] font-bold tabular-nums text-slate-200'
                            : 'text-sm font-bold tabular-nums text-slate-200 min-[1024px]:text-base'
                    }
                >
                    ×{qty}
                </span>
            </div>
        );
    };

    const decoyRows = decoyNames.map((n) => row(n, Math.max(1, Math.floor(Math.random() * 8) + 1)));

    return (
        <div className={`flex flex-col items-center ${compact ? 'max-w-[3.25rem] shrink-0 min-[360px]:max-w-[3.5rem] min-[400px]:max-w-12 sm:max-w-[6.75rem]' : 'max-w-[6.75rem]'}`}>
            <VerticalReel rowPx={rowH} children={[...decoyRows, row(finalName, finalQty)]} />
        </div>
    );
}

/** 모험 획득 보상: 경험치·골드·장비·재료 4칸 고정(이미지+숫자, 미획득 시 동일 칸에 미획득) */
export function AdventureBattleFixedRewardRow({
    slots,
    xpChange,
    isPlayful,
    compact,
    vipPlayRewardSlot,
    onVipLockedClick,
}: {
    slots: NonNullable<GameSummary['adventureRewardSlots']>;
    xpChange: number;
    isPlayful: boolean;
    compact: boolean;
    vipPlayRewardSlot?: GameSummary['vipPlayRewardSlot'];
    onVipLockedClick?: () => void;
}) {
    const keyFragmentAmount = Math.max(1, Math.floor(slots.keyFragment?.amount ?? 1));
    const xpOk = xpChange > 0;
    const rowClass = compact
        ? vipPlayRewardSlot
            ? RESULT_MODAL_REWARDS_ROW_MOBILE_SIX_COL_CLASS
            : RESULT_MODAL_REWARDS_ROW_MOBILE_FIVE_COL_CLASS
        : vipPlayRewardSlot
          ? 'grid w-full min-w-0 grid-cols-6 items-start justify-items-center gap-1 min-h-[7.6rem]'
          : 'grid w-full min-w-0 grid-cols-5 items-start justify-items-center gap-1.5 min-h-[7.6rem]';

    const xpMissedBox = (
        <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''} opacity-45`}>
            <div
                className={`flex ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'} shrink-0 flex-col items-center justify-center rounded-lg border ring-1 ring-inset ${
                    isPlayful
                        ? 'border-sky-400/35 bg-gradient-to-br from-sky-600/35 via-violet-900/55 to-indigo-950/70 ring-sky-400/25'
                        : 'border-emerald-400/35 bg-gradient-to-br from-emerald-700/35 via-emerald-950/80 to-black/55 ring-emerald-400/25'
                }`}
                aria-hidden
            >
                <span
                    className={
                        compact
                            ? `text-[0.5rem] min-[360px]:text-[0.52rem] min-[400px]:text-[0.54rem] font-bold ${
                                  isPlayful ? 'text-sky-100/85' : 'text-emerald-100/80'
                              }`
                            : `text-[0.5rem] font-bold ${isPlayful ? 'text-sky-100/85' : 'text-emerald-100/80'}`
                    }
                >
                    {isPlayful ? '놀이' : '전략'}
                </span>
                <span
                    className={
                        compact
                            ? `mt-px text-[0.56rem] min-[360px]:text-[0.58rem] min-[400px]:text-[0.6rem] font-black ${
                                  isPlayful ? 'text-violet-100' : 'text-emerald-50'
                              }`
                            : `mt-0.5 text-[0.58rem] font-black ${isPlayful ? 'text-violet-100' : 'text-emerald-50'}`
                    }
                >
                    EXP
                </span>
            </div>
            <span
                className={
                    compact
                        ? 'text-center text-[0.72rem] font-bold tabular-nums text-slate-500'
                        : 'text-center text-sm font-bold tabular-nums text-slate-500 min-[1024px]:text-base'
                }
            >
                미획득
            </span>
        </div>
    );

    return (
        <div className={rowClass}>
            {xpOk ? (
                <ResultModalXpRewardBadge
                    variant={isPlayful ? 'playful' : 'strategy'}
                    amount={xpChange}
                    density={compact ? 'compact' : 'comfortable'}
                />
            ) : (
                xpMissedBox
            )}
            {slots.gold.obtained ? (
                <ResultModalGoldCurrencySlot
                    amount={slots.gold.amount}
                    compact={compact}
                    understandingBonus={slots.gold.understandingBonus}
                    adventureUnifiedSlot
                />
            ) : (
                <AdventureMissedRewardSlot compact={compact} iconSrc="/images/icon/Gold.png" />
            )}
            <AdventureKeyFragmentRewardSlot compact={compact} amount={keyFragmentAmount} />
            {slots.equipment.obtained && slots.equipment.displayName ? (
                <ResultModalItemRewardSlot
                    imageSrc={adventureRewardSlotItemImage(slots.equipment.displayName)}
                    name={slots.equipment.displayName}
                    quantity={1}
                    compact={compact}
                    alwaysShowNameBelow
                    adventureUnifiedSlot
                    equipmentGrade={adventureEquipmentGradeFromDisplayName(
                        slots.equipment.displayName,
                        slots.equipment.grade,
                    )}
                />
            ) : (
                <AdventureMissedRewardSlot compact={compact} iconSrc={ADVENTURE_DEFAULT_EQUIP_BOX_IMG} questionOverlay />
            )}
            {slots.material.obtained && slots.material.displayName ? (
                <ResultModalItemRewardSlot
                    imageSrc={adventureRewardSlotItemImage(slots.material.displayName)}
                    name={slots.material.displayName}
                    quantity={slots.material.quantity ?? 1}
                    compact={compact}
                    materialQuantityOnly
                    adventureUnifiedSlot
                />
            ) : (
                <AdventureMissedRewardSlot compact={compact} iconSrc={ADVENTURE_DEFAULT_MAT_BOX_IMG} questionOverlay />
            )}
            {vipPlayRewardSlot ? (
                <ResultModalVipRewardSlot
                    slot={vipPlayRewardSlot}
                    compact={compact}
                    onLockedClick={vipPlayRewardSlot.locked ? onVipLockedClick : undefined}
                />
            ) : null}
        </div>
    );
}

/** 최초 3초 롤링 후 실제 보상 공개 — 전략 경험치만 즉시 표시 */
export function AdventureBattleRewardRowWithReveal({
    slots,
    xpChange,
    isPlayful,
    compact,
    vipPlayRewardSlot,
    onVipLockedClick,
}: {
    slots: NonNullable<GameSummary['adventureRewardSlots']>;
    xpChange: number;
    isPlayful: boolean;
    compact: boolean;
    vipPlayRewardSlot?: GameSummary['vipPlayRewardSlot'];
    onVipLockedClick?: () => void;
}) {
    const keyFragmentAmount = Math.max(1, Math.floor(slots.keyFragment?.amount ?? 1));
    const [revealed, setRevealed] = useState(false);
    useEffect(() => {
        const id = window.setTimeout(() => setRevealed(true), ADVENTURE_REWARD_REVEAL_MS);
        return () => window.clearTimeout(id);
    }, []);

    if (revealed) {
        return (
            <AdventureBattleFixedRewardRow
                slots={slots}
                xpChange={xpChange}
                isPlayful={isPlayful}
                compact={compact}
                vipPlayRewardSlot={vipPlayRewardSlot}
                onVipLockedClick={onVipLockedClick}
            />
        );
    }

    const xpOk = xpChange > 0;
    const rowClass = compact
        ? vipPlayRewardSlot
            ? RESULT_MODAL_REWARDS_ROW_MOBILE_SIX_COL_CLASS
            : RESULT_MODAL_REWARDS_ROW_MOBILE_FIVE_COL_CLASS
        : vipPlayRewardSlot
          ? 'grid w-full min-w-0 grid-cols-6 items-start justify-items-center gap-1 min-h-[7.6rem]'
          : 'grid w-full min-w-0 grid-cols-5 items-start justify-items-center gap-1.5 min-h-[7.6rem]';

    const xpMissedBox = (
        <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''} opacity-45`}>
            <div
                className={`flex ${compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]'} shrink-0 flex-col items-center justify-center rounded-lg border ring-1 ring-inset ${
                    isPlayful
                        ? 'border-sky-400/35 bg-gradient-to-br from-sky-600/35 via-violet-900/55 to-indigo-950/70 ring-sky-400/25'
                        : 'border-emerald-400/35 bg-gradient-to-br from-emerald-700/35 via-emerald-950/80 to-black/55 ring-emerald-400/25'
                }`}
                aria-hidden
            >
                <span
                    className={
                        compact
                            ? `text-[0.5rem] min-[360px]:text-[0.52rem] min-[400px]:text-[0.54rem] font-bold ${
                                  isPlayful ? 'text-sky-100/85' : 'text-emerald-100/80'
                              }`
                            : `text-[0.5rem] font-bold ${isPlayful ? 'text-sky-100/85' : 'text-emerald-100/80'}`
                    }
                >
                    {isPlayful ? '놀이' : '전략'}
                </span>
                <span
                    className={
                        compact
                            ? `mt-px text-[0.56rem] min-[360px]:text-[0.58rem] min-[400px]:text-[0.6rem] font-black ${
                                  isPlayful ? 'text-violet-100' : 'text-emerald-50'
                              }`
                            : `mt-0.5 text-[0.58rem] font-black ${isPlayful ? 'text-violet-100' : 'text-emerald-50'}`
                    }
                >
                    EXP
                </span>
            </div>
            <span
                className={
                    compact
                        ? 'text-center text-[0.72rem] font-bold tabular-nums text-slate-500'
                        : 'text-center text-sm font-bold tabular-nums text-slate-500 min-[1024px]:text-base'
                }
            >
                미획득
            </span>
        </div>
    );

    const equipName = slots.equipment.displayName ?? '';
    const matName = slots.material.displayName ?? '';
    const matQty = slots.material.quantity ?? 1;

    return (
        <div className={rowClass}>
            {xpOk ? (
                <ResultModalXpRewardBadge
                    variant={isPlayful ? 'playful' : 'strategy'}
                    amount={xpChange}
                    density={compact ? 'compact' : 'comfortable'}
                />
            ) : (
                xpMissedBox
            )}
            <GoldRollingPlaceholder compact={compact} obtained={slots.gold.obtained} targetAmount={slots.gold.amount} />
            <AdventureKeyFragmentRewardSlot compact={compact} amount={keyFragmentAmount} />
            {slots.equipment.obtained && equipName ? (
                <EquipmentRollingPlaceholder
                    compact={compact}
                    finalName={equipName}
                    finalGrade={adventureEquipmentGradeFromDisplayName(equipName, slots.equipment.grade)}
                />
            ) : (
                <div className={`flex flex-col items-center ${compact ? 'max-w-[3.25rem] shrink-0 min-[360px]:max-w-[3.5rem] min-[400px]:max-w-12 sm:max-w-[6.75rem]' : 'max-w-[6.75rem]'}`}>
                    <VerticalReel
                        rowPx={compact ? 86 : 112}
                        children={[
                            ...pickDecoyEquipmentNames(10, '').map((n, i) => (
                                <div key={`d-${i}-${n}`} className="flex w-full flex-col items-center justify-center opacity-50">
                                    <AdventureMissedRewardSlot compact={compact} iconSrc={ADVENTURE_DEFAULT_EQUIP_BOX_IMG} questionOverlay />
                                </div>
                            )),
                            <div key="final" className="flex w-full justify-center">
                                <AdventureMissedRewardSlot compact={compact} iconSrc={ADVENTURE_DEFAULT_EQUIP_BOX_IMG} questionOverlay />
                            </div>,
                        ]}
                    />
                </div>
            )}
            {slots.material.obtained && matName ? (
                <MaterialRollingPlaceholder compact={compact} finalName={matName} finalQty={matQty} />
            ) : (
                <div className={`flex flex-col items-center ${compact ? 'max-w-[3.25rem] shrink-0 min-[360px]:max-w-[3.5rem] min-[400px]:max-w-12 sm:max-w-[6.75rem]' : 'max-w-[6.75rem]'}`}>
                    <VerticalReel
                        rowPx={compact ? 86 : 112}
                        children={[
                            ...Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className="flex w-full justify-center opacity-60">
                                    <AdventureMissedRewardSlot compact={compact} iconSrc={ADVENTURE_DEFAULT_MAT_BOX_IMG} questionOverlay />
                                </div>
                            )),
                            <div key="f" className="flex w-full justify-center">
                                <AdventureMissedRewardSlot compact={compact} iconSrc={ADVENTURE_DEFAULT_MAT_BOX_IMG} questionOverlay />
                            </div>,
                        ]}
                    />
                </div>
            )}
            {vipPlayRewardSlot ? (
                <ResultModalVipRewardSlot
                    slot={vipPlayRewardSlot}
                    compact={compact}
                    onLockedClick={vipPlayRewardSlot.locked ? onVipLockedClick : undefined}
                />
            ) : null}
        </div>
    );
}

export function AdventureResultCodexCard({
    codexDelta,
    understandingDelta,
    compact,
    mobileTextScale = 1,
}: {
    codexDelta: NonNullable<GameSummary['adventureCodexDelta']>;
    understandingDelta?: GameSummary['adventureUnderstandingDelta'];
    compact: boolean;
    mobileTextScale?: number;
}) {
    const { codexId, winsBefore, winsAfter } = codexDelta;
    const gainedWins = Math.max(0, winsAfter - winsBefore);
    const entry = getAdventureCodexMonsterById(codexId);
    const portrait = useResilientImgSrc(entry?.imageWebp);
    const levelBefore = getAdventureCodexComprehensionLevel(winsBefore);
    const levelAfter = getAdventureCodexComprehensionLevel(winsAfter);
    const { prog: progBefore } = getAdventureCodexComprehensionBarProgress(winsBefore, levelBefore);
    const { prog: progAfter, nextAt } = getAdventureCodexComprehensionBarProgress(winsAfter, levelAfter);
    const pctBefore = Math.min(1, Math.max(0, progBefore)) * 100;
    const pctAfter = Math.min(1, Math.max(0, progAfter)) * 100;
    const [barPct, setBarPct] = useState(pctBefore);
    useEffect(() => {
        let cancelled = false;
        setBarPct(pctBefore);
        const id = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (!cancelled) setBarPct(pctAfter);
            });
        });
        return () => {
            cancelled = true;
            window.cancelAnimationFrame(id);
        };
    }, [codexId, winsBefore, winsAfter, pctBefore, pctAfter]);

    const atMax = levelAfter >= ADVENTURE_CODEX_MAX_LEVEL;
    const grade = getCodexComprehensionItemGrade(levelAfter);
    const borderCls = codexGradeBorderClass(grade);
    const bgGrade = grade ?? ItemGrade.Normal;
    const bgUrl = CODEX_COMPREHENSION_GRADE_BACKGROUNDS[bgGrade] ?? CODEX_COMPREHENSION_GRADE_BACKGROUNDS[ItemGrade.Normal];

    const effectLines = buildAdventureCodexEffectLinesKo(codexId, levelAfter);
    const imgPx = compact ? 52 : 72;

    const nnLabelTarget = atMax ? Math.max(nextAt ?? ADVENTURE_CODEX_MAX_LEVEL, winsAfter) : (nextAt ?? winsAfter);
    const nnLabel = `Lv.${atMax ? ADVENTURE_CODEX_MAX_LEVEL : Math.max(0, levelAfter)} (${winsAfter}/${nnLabelTarget})`;
    const understandingGain = understandingDelta ? Math.max(0, understandingDelta.xpAfter - understandingDelta.xpBefore) : 0;

    return (
        <div className={`mt-1.5 flex min-w-0 gap-2 ${compact ? 'items-start' : 'items-center'}`}>
            <div className="flex shrink-0 flex-col items-center gap-1">
                <div
                    className={`relative overflow-hidden rounded-lg border-[3px] bg-white shadow-md ${borderCls}`}
                    style={{ width: imgPx, height: imgPx }}
                >
                    <img
                        src={bgUrl}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
                        draggable={false}
                    />
                    {entry ? (
                        <img
                            src={portrait.src}
                            alt=""
                            className="relative z-[1] h-full w-full object-contain p-1"
                            draggable={false}
                            onError={portrait.onError}
                        />
                    ) : null}
                </div>
            </div>
            <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-end justify-between gap-1 text-[0.76rem] text-zinc-400">
                    <span
                        className="font-bold tracking-wide text-zinc-200"
                        style={{ fontSize: compact ? `${10.5 * mobileTextScale}px` : undefined }}
                    >
                        도감 경험치
                    </span>
                    <span
                        className="font-mono font-bold tabular-nums text-zinc-100"
                        style={{ fontSize: compact ? `${10.5 * mobileTextScale}px` : undefined }}
                    >
                        {nnLabel}
                    </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800/95 ring-1 ring-inset ring-black/40">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-500 to-amber-400 shadow-[0_0_8px_rgba(192,132,252,0.25)] transition-[width] duration-[750ms] ease-out"
                        style={{ width: `${Math.max(0, gainedWins > 0 ? Math.max(barPct, 2) : barPct)}%` }}
                    />
                </div>
                <div className="mt-1.5 min-h-[1.2rem]">
                    {understandingDelta ? (
                        <p
                            className="mb-1 text-[0.78rem] font-bold text-emerald-300 [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]"
                            style={{ fontSize: compact ? `${10.5 * mobileTextScale}px` : undefined }}
                        >
                            지역 탐험도 +{understandingGain.toLocaleString()} XP
                        </p>
                    ) : null}
                    {effectLines.length > 0 ? (
                        <ul className="space-y-0.5">
                            {effectLines.map((line) => (
                                <li
                                    key={line}
                                    className="text-[0.82rem] font-semibold leading-snug text-zinc-50 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                                    style={{ fontSize: compact ? `${10.5 * mobileTextScale}px` : undefined }}
                                >
                                    {line}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p
                            className="text-[0.78rem] font-semibold text-zinc-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]"
                            style={{ fontSize: compact ? `${10.5 * mobileTextScale}px` : undefined }}
                        >
                            보너스 효과 없음
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
