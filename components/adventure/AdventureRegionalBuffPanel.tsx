import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import type { AdventureProfile } from '../../types/entities.js';
import {
    computeAdventureRegionalBuffChangeCostGold,
    labelRegionalSpecialtyBuffEntry,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';
import { useAppContext } from '../../hooks/useAppContext.js';

/** `AdventureProfilePanel`의 지역 탐험도(XP·티어) 행 — 탭 선택 시 같은 지역의 특화 효과와 함께 표시 */
export type AdventureStageUnderstandingRow = {
    id: string;
    title: string;
    xp: number;
    /** 표시용 분모 — 다음 티어까지 필요한 누적 XP(전설 티어는 최종 구간 기준 1000) */
    xpGoal: number;
    tier: number;
    prog: number;
    tierLabel: string;
};

const LOCK_OPEN = '🔓';
const LOCK_CLOSED = '🔒';

const AdventureRegionalBuffPanel: React.FC<{
    profile: AdventureProfile | null | undefined;
    stageRows: AdventureStageUnderstandingRow[];
    /** 버튼 비활성·표시용 보유 골드 */
    userGold?: number;
    compact?: boolean;
}> = ({ profile, stageRows, userGold = 0, compact = false }) => {
    const { handlers } = useAppContext();
    const p = useMemo(() => normalizeAdventureProfile(profile), [profile]);
    const [tabIdx, setTabIdx] = useState(0);
    const stage = ADVENTURE_STAGES[tabIdx] ?? ADVENTURE_STAGES[0]!;
    const stageId = stage.id;
    const understandingRow = stageRows[tabIdx] ?? stageRows[0];

    const buffs = p.regionalSpecialtyBuffsByStageId?.[stageId] ?? [];
    const buffSig = useMemo(() => buffs.map((b) => b.kind).join('|'), [buffs]);

    /** true = 잠금(유지), false = 변경 대상 */
    const [lockedMask, setLockedMask] = useState<boolean[]>([]);

    useEffect(() => {
        const n = buffs.length;
        if (n === 0) {
            setLockedMask([]);
            return;
        }
        setLockedMask(
            n >= 2
                ? buffs.map((_, i) => i !== n - 1)
                : buffs.map(() => false),
        );
    }, [stageId, buffSig]);

    const lockedCount = lockedMask.filter(Boolean).length;
    const cost = useMemo(
        () => computeAdventureRegionalBuffChangeCostGold(buffs.length, buffs.length >= 2 ? lockedCount : 0),
        [buffs.length, lockedCount],
    );

    const lockStateValid =
        buffs.length === 0 ||
        buffs.length === 1 ||
        (lockedCount >= 1 && lockedCount < buffs.length);

    const canAfford = userGold >= cost;
    const canChange = buffs.length > 0 && lockStateValid && cost > 0 && canAfford;

    const labelCls = compact
        ? 'text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:text-xs'
        : 'text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm';

    const toggleLock = useCallback(
        (idx: number) => {
            if (buffs.length < 2) return;
            setLockedMask((prev) => {
                if (idx < 0 || idx >= prev.length) return prev;
                const next = [...prev];
                next[idx] = !next[idx];
                const lc = next.filter(Boolean).length;
                if (lc === 0 || lc >= buffs.length) return prev;
                return next;
            });
        },
        [buffs.length],
    );

    const onChangeEffects = () => {
        if (!canChange) return;
        const lockedIndices = lockedMask.map((locked, i) => (locked ? i : -1)).filter((i) => i >= 0);
        handlers.handleAction({
            type: 'REROLL_ADVENTURE_REGIONAL_BUFF',
            payload: { stageId, lockedIndices },
        } as any);
    };

    return (
        <div
            className={`w-full min-w-0 rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/15 ${
                compact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
            }`}
        >
            <p className={labelCls}>지역 탐험도</p>

            <div
                className={`mt-2 flex flex-wrap gap-1 border-b border-white/10 pb-2 ${
                    compact ? '' : 'sm:gap-1.5'
                }`}
                role="tablist"
                aria-label="지역 탐험도 탭"
            >
                {ADVENTURE_STAGES.map((s, i) => (
                    <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={i === tabIdx}
                        onClick={() => setTabIdx(i)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors sm:text-xs ${
                            i === tabIdx
                                ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                                : 'border-white/10 bg-black/25 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                        }`}
                    >
                        <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                        {!compact && <span className="ml-1 hidden sm:inline">{s.title}</span>}
                    </button>
                ))}
            </div>

            <div className="mt-2.5 space-y-2.5">
                {understandingRow && (
                    <div
                        className={`min-w-0 rounded-lg border border-white/8 bg-black/25 ${
                            compact ? 'px-2.5 py-2' : 'px-3 py-2.5 sm:px-3.5'
                        }`}
                    >
                        <div
                            className={`flex items-center justify-between gap-2 ${
                                compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                            }`}
                        >
                            <span className="min-w-0 truncate font-bold text-zinc-100">{understandingRow.title}</span>
                            <span className="shrink-0 rounded-md border border-fuchsia-500/30 bg-fuchsia-950/30 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-100 sm:text-xs lg:text-sm">
                                {understandingRow.tierLabel}
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800 sm:h-2">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 via-fuchsia-500/80 to-amber-400/90 transition-all duration-500"
                                style={{ width: `${understandingRow.prog}%` }}
                            />
                        </div>
                        <p
                            className={`mt-1 tabular-nums text-zinc-500 ${
                                compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                            }`}
                        >
                            XP ({understandingRow.xp.toLocaleString()}/{understandingRow.xpGoal.toLocaleString()})
                        </p>
                    </div>
                )}

                <div className="min-h-0">
                    {buffs.length > 0 ? (
                        <ul
                            className={`space-y-1.5 ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                        >
                            {buffs.map((e, idx) => {
                                const locked = buffs.length >= 2 && lockedMask[idx] === true;
                                const showToggle = buffs.length >= 2;
                                return (
                                    <li
                                        key={`${e.kind}-${idx}`}
                                        className="flex items-start gap-2 rounded-md border border-white/8 bg-black/25 px-2 py-1.5 text-zinc-100"
                                    >
                                        {showToggle ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleLock(idx)}
                                                className="mt-0.5 shrink-0 select-none text-base leading-none transition-opacity hover:opacity-90"
                                                title={
                                                    locked
                                                        ? '잠금 — 변경하지 않습니다. 눌러 잠금 해제'
                                                        : '변경 대상 — 눌러 잠그면 유지됩니다'
                                                }
                                                aria-label={locked ? '잠금됨, 클릭하여 잠금 해제' : '변경 대상, 클릭하여 잠금'}
                                            >
                                                {locked ? LOCK_CLOSED : LOCK_OPEN}
                                            </button>
                                        ) : (
                                            <span
                                                className="mt-0.5 shrink-0 select-none text-base leading-none text-zinc-500"
                                                title="효과 1개 — 이 효과를 변경합니다"
                                                aria-hidden
                                            >
                                                {LOCK_OPEN}
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1 font-semibold text-cyan-100/95">
                                            {labelRegionalSpecialtyBuffEntry(e)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
                <button
                    type="button"
                    onClick={onChangeEffects}
                    disabled={!canChange}
                    title={
                        !lockStateValid && buffs.length >= 2
                            ? '잠금·변경 대상을 각각 하나 이상 두어 주세요'
                            : !canAfford && cost > 0
                              ? `골드 ${cost.toLocaleString()} 필요`
                              : undefined
                    }
                    aria-label={`효과 변경하기, 비용 ${cost} 골드`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-950/40 px-3 py-1.5 text-sm font-bold text-amber-100 transition-colors enabled:hover:bg-amber-900/45 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <span>효과 변경하기</span>
                    <span className="inline-flex items-center gap-0.5 tabular-nums">
                        <img
                            src="/images/icon/Gold.png"
                            alt=""
                            className="h-4 w-4 shrink-0 object-contain sm:h-[1.125rem] sm:w-[1.125rem]"
                            aria-hidden
                        />
                        <span>{cost.toLocaleString()}</span>
                    </span>
                </button>
            </div>
        </div>
    );
};

export default AdventureRegionalBuffPanel;
