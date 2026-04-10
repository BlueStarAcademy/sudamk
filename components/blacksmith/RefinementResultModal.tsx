import React, { useMemo } from 'react';
import { MythicOptionAbbrev } from '../MythicStatAbbrev.js';
import DraggableWindow from '../DraggableWindow.js';
import { InventoryItem, ItemGrade, ItemOption } from '../../types.js';

const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string }> = {
    normal: { name: '일반', color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { name: '고급', color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { name: '희귀', color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { name: '에픽', color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { name: '전설', color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { name: '신화', color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
    transcendent: { name: '초월', color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.png' },
};

type RefinementDiff = {
    id: string;
    slotLabel: string;
    changeHint: string;
    beforeText: string;
    afterText: string;
    beforeValue: number | null;
    afterValue: number | null;
    isPercentage: boolean;
    isMythic: boolean;
    mythicBefore?: ItemOption;
    mythicAfter?: ItemOption;
};

function numericOptionValue(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function optionsEqualEnough(a: ItemOption | undefined, b: ItemOption | undefined): boolean {
    if (!a || !b) return a === b;
    if (a.type !== b.type) return false;
    if (Number(a.value) !== Number(b.value)) return false;
    if ((a.display || '') !== (b.display || '')) return false;
    return true;
}

function collectRefinementDiffs(beforeItem: InventoryItem, afterItem: InventoryItem): RefinementDiff[] {
    const out: RefinementDiff[] = [];
    const b = beforeItem.options;
    const a = afterItem.options;
    if (!b || !a) return out;

    if (!optionsEqualEnough(b.main, a.main)) {
        const typeChanged = b.main.type !== a.main.type;
        const valueChanged = Number(b.main.value) !== Number(a.main.value);
        let hint = '옵션 변경';
        if (typeChanged && valueChanged) hint = '종류 · 수치 변경';
        else if (typeChanged) hint = '종류 변경';
        else if (valueChanged) hint = '수치 변경';
        out.push({
            id: 'main',
            slotLabel: '주옵션',
            changeHint: hint,
            beforeText: b.main.display,
            afterText: a.main.display,
            beforeValue: numericOptionValue(b.main.value),
            afterValue: numericOptionValue(a.main.value),
            isPercentage: !!a.main.isPercentage,
            isMythic: false,
        });
    }

    const nCombat = Math.max(b.combatSubs?.length || 0, a.combatSubs?.length || 0);
    for (let i = 0; i < nCombat; i++) {
        const bs = b.combatSubs[i];
        const as = a.combatSubs[i];
        if (!bs || !as) continue;
        if (optionsEqualEnough(bs, as)) continue;
        const typeChanged = bs.type !== as.type;
        const valueChanged = Number(bs.value) !== Number(as.value);
        let hint = '옵션 변경';
        if (typeChanged && valueChanged) hint = '종류 · 수치 변경';
        else if (typeChanged) hint = '종류 변경';
        else if (valueChanged) hint = '수치 변경';
        out.push({
            id: `combat-${i}`,
            slotLabel: `부옵션 ${i + 1}`,
            changeHint: hint,
            beforeText: bs.display,
            afterText: as.display,
            beforeValue: numericOptionValue(bs.value),
            afterValue: numericOptionValue(as.value),
            isPercentage: !!as.isPercentage,
            isMythic: false,
        });
    }

    const nSpec = Math.max(b.specialSubs?.length || 0, a.specialSubs?.length || 0);
    for (let i = 0; i < nSpec; i++) {
        const bs = b.specialSubs[i];
        const as = a.specialSubs[i];
        if (!bs || !as) continue;
        if (optionsEqualEnough(bs, as)) continue;
        const typeChanged = bs.type !== as.type;
        const valueChanged = Number(bs.value) !== Number(as.value);
        let hint = '옵션 변경';
        if (typeChanged && valueChanged) hint = '종류 · 수치 변경';
        else if (typeChanged) hint = '종류 변경';
        else if (valueChanged) hint = '수치 변경';
        out.push({
            id: `special-${i}`,
            slotLabel: `특수옵션 ${i + 1}`,
            changeHint: hint,
            beforeText: bs.display,
            afterText: as.display,
            beforeValue: numericOptionValue(bs.value),
            afterValue: numericOptionValue(as.value),
            isPercentage: !!as.isPercentage,
            isMythic: false,
        });
    }

    const nMyth = Math.max(b.mythicSubs?.length || 0, a.mythicSubs?.length || 0);
    for (let i = 0; i < nMyth; i++) {
        const bs = b.mythicSubs[i];
        const as = a.mythicSubs[i];
        if (!bs || !as) continue;
        if (bs.type === as.type && Number(bs.value) === Number(as.value) && (bs.display || '') === (as.display || '')) continue;
        const typeChanged = bs.type !== as.type;
        const valueChanged = Number(bs.value) !== Number(as.value);
        let hint = '신화 옵션 변경';
        if (typeChanged && valueChanged) hint = '신화 · 종류·수치 변경';
        else if (typeChanged) hint = '신화 · 종류 변경';
        else if (valueChanged) hint = '신화 · 수치 변경';
        out.push({
            id: `mythic-${i}`,
            slotLabel: `신화옵션 ${i + 1}`,
            changeHint: hint,
            beforeText: bs.display,
            afterText: as.display,
            beforeValue: numericOptionValue(bs.value),
            afterValue: numericOptionValue(as.value),
            isPercentage: false,
            isMythic: true,
            mythicBefore: bs,
            mythicAfter: as,
        });
    }

    const rcBefore = (beforeItem as { refinementCount?: number }).refinementCount;
    const rcAfter = (afterItem as { refinementCount?: number }).refinementCount;
    if (rcBefore !== undefined && rcAfter !== undefined && rcBefore !== rcAfter) {
        out.push({
            id: 'refinement-count',
            slotLabel: '제련 가능 횟수',
            changeHint: '1회 소모',
            beforeText: `${rcBefore}회`,
            afterText: `${rcAfter}회`,
            beforeValue: rcBefore,
            afterValue: rcAfter,
            isPercentage: false,
            isMythic: false,
        });
    }

    return out;
}

function formatDelta(before: number | null, after: number | null, isPercentage: boolean): string | null {
    if (before === null || after === null) return null;
    if (Number.isNaN(before) || Number.isNaN(after)) return null;
    const d = after - before;
    if (Math.abs(d) < 1e-9) return null;
    const sign = d > 0 ? '+' : '';
    const suffix = isPercentage ? '%' : '';
    const rounded = Number.isInteger(d) ? d : parseFloat(d.toFixed(2));
    return `${sign}${rounded}${suffix}`;
}

const renderStarBadge = (stars: number) => {
    if (stars <= 0) return null;
    let starImage = '/images/equipments/Star1.png';
    let numberColor = 'text-white';
    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = 'prism-text-effect';
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = 'text-purple-300';
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = 'text-amber-300';
    }
    return (
        <div
            className="flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 ring-1 ring-amber-600/40"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
            <img src={starImage} alt="" className="h-3.5 w-3.5" />
            <span className={`text-[11px] font-bold tabular-nums leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

interface RefinementResultModalProps {
    result: {
        message: string;
        success: boolean;
        itemBefore: InventoryItem;
        itemAfter: InventoryItem;
    } | null;
    onClose: () => void;
    isTopmost?: boolean;
}

const RefinementResultModal: React.FC<RefinementResultModalProps> = ({ result, onClose, isTopmost }) => {
    const diffs = useMemo(() => {
        if (!result?.success || !result.itemBefore || !result.itemAfter) return [];
        return collectRefinementDiffs(result.itemBefore, result.itemAfter);
    }, [result]);

    if (!result) return null;

    const after = result.itemAfter;
    const styles = gradeStyles[after.grade];

    return (
        <DraggableWindow
            title="제련 결과"
            onClose={onClose}
            windowId="refinement-result"
            isTopmost={isTopmost !== false}
            initialWidth={Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 24 : 560)}
            initialHeight={640}
            variant="store"
            headerContent={
                <span className="hidden sm:inline shrink-0 rounded bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200/90 ring-1 ring-amber-600/50">
                    Reforge
                </span>
            }
        >
            <div
                className="relative flex max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-b-lg"
                style={{
                    background:
                        'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(245, 158, 11, 0.18), transparent 55%), linear-gradient(180deg, #0c0a09 0%, #1c1917 45%, #0f0d0b 100%)',
                }}
            >
                <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.9)_1px,transparent_0)] [background-size:20px_20px]" />

                <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-4 pb-3">
                    {/* 상단: 장비 헤더 카드 */}
                    <div className="relative overflow-hidden rounded-xl border border-amber-600/35 bg-gradient-to-br from-zinc-900/95 via-stone-950/95 to-zinc-950 p-3 shadow-[0_0_32px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/5">
                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
                        <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-orange-600/10 blur-2xl" />

                        <div className="relative flex gap-3">
                            <div
                                className={`relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg shadow-lg ring-2 ring-amber-600/40 ring-offset-2 ring-offset-stone-950 ${
                                    after.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''
                                }`}
                            >
                                <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                {after.image && (
                                    <img
                                        src={after.image}
                                        alt=""
                                        className="absolute object-contain p-1.5"
                                        style={{ width: '82%', height: '82%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                    />
                                )}
                                <div className="absolute left-1 top-1">{renderStarBadge(after.stars || 0)}</div>
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500/80">완료</p>
                                <h2 className={`truncate text-base font-bold leading-tight ${styles.color}`} title={after.name}>
                                    {after.name}
                                </h2>
                                <p className="mt-1 text-xs text-stone-400">{result.message}</p>
                                {after.options?.main && (
                                    <p
                                        className="mt-1.5 truncate text-xs font-semibold text-amber-200/95"
                                        title={after.options.main.display}
                                    >
                                        {after.options.main.display}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 변경 요약 */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-0.5">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent" />
                            <span className="shrink-0 text-[11px] font-bold tracking-wide text-amber-200/90">능력치 변화</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent" />
                        </div>

                        {result.success && diffs.length === 0 && (
                            <p className="rounded-lg border border-stone-700/80 bg-stone-900/50 px-3 py-4 text-center text-sm text-stone-400">
                                표시할 변경 내역이 없습니다.
                            </p>
                        )}

                        {result.success &&
                            diffs.map((d) => {
                                const delta = formatDelta(d.beforeValue, d.afterValue, d.isPercentage);
                                return (
                                    <div
                                        key={d.id}
                                        className="group relative overflow-hidden rounded-xl border border-stone-700/70 bg-stone-900/40 p-3 shadow-md backdrop-blur-sm transition-all duration-300 hover:border-amber-600/35 hover:shadow-[0_0_24px_rgba(245,158,11,0.08)]"
                                    >
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className="rounded-md bg-gradient-to-r from-amber-700/50 to-amber-600/30 px-2 py-0.5 text-[11px] font-bold text-amber-100 ring-1 ring-amber-500/30">
                                                {d.slotLabel}
                                            </span>
                                            <span className="text-[10px] text-stone-500">{d.changeHint}</span>
                                            {delta && (
                                                <span className="ml-auto rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-300 ring-1 ring-emerald-600/40">
                                                    Δ {delta}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-[11px] sm:text-xs">
                                            <div className="min-w-0 rounded-lg border border-red-950/60 bg-red-950/25 p-2 ring-1 ring-red-900/20">
                                                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-red-400/80">
                                                    이전
                                                </div>
                                                {d.isMythic && d.mythicBefore ? (
                                                    <MythicOptionAbbrev option={d.mythicBefore} textClassName="text-red-300/95 text-[11px]" />
                                                ) : (
                                                    <p className="break-words text-red-200/90 leading-snug">{d.beforeText}</p>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 flex-col items-center justify-center px-0.5 text-amber-400">
                                                <span className="text-lg leading-none opacity-90">→</span>
                                            </div>
                                            <div className="min-w-0 rounded-lg border border-emerald-950/50 bg-emerald-950/20 p-2 ring-1 ring-emerald-800/25 shadow-[inset_0_0_12px_rgba(16,185,129,0.06)]">
                                                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                                                    이후
                                                </div>
                                                {d.isMythic && d.mythicAfter ? (
                                                    <MythicOptionAbbrev option={d.mythicAfter} textClassName="text-emerald-200 text-[11px] font-semibold" />
                                                ) : (
                                                    <p className="break-words font-semibold text-emerald-100/95 leading-snug">{d.afterText}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                <div className="relative shrink-0 border-t border-amber-900/40 bg-gradient-to-t from-black/50 to-transparent p-3 pt-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="group relative w-full overflow-hidden rounded-xl py-3 text-sm font-bold text-stone-950 shadow-[0_4px_24px_rgba(245,158,11,0.25)] transition-transform active:scale-[0.99]"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 transition-opacity group-hover:opacity-95" />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                        <span className="relative">확인</span>
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default RefinementResultModal;
