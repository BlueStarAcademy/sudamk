import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_TIER_LABELS,
    getAdventureUnderstandingTierFromXp,
} from '../../constants/adventureConstants.js';
import type { AdventureChapterUnlockContext } from '../../utils/adventureChapterUnlock.js';
import { isAdventureStageUnlocked } from '../../utils/adventureChapterUnlock.js';
import type { AdventureProfile } from '../../types/entities.js';
import {
    ADVENTURE_REGIONAL_SPECIALTY_KINDS,
    ADVENTURE_REGIONAL_BUFF_ACTION_GOLD,
    enhancementPointsGrantedTotalForTier,
    getRegionalBuffMaxStacks,
    getRegionalEnhancePointsRemaining,
    isRegionalBuffEnhanceable,
    labelRegionalSpecialtyBuffEntry,
    migrateRegionalBuffEntry,
    regionalBuffEnhanceCountSuffix,
    slotCountForUnderstandingTier,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import type { AdventureRegionalSpecialtyBuffEntry, AdventureRegionalSpecialtyBuffKind } from '../../types/entities.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import AdventureRegionalUnderstandingHelpModal from './AdventureRegionalUnderstandingHelpModal.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';

const REGIONAL_SPECIALTY_SLOT_COUNT = 5 as const;

export type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';
import type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';

const GoldCostInline: React.FC<{ text: string }> = ({ text }) => (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
        <img
            src="/images/icon/Gold.webp"
            alt=""
            className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4"
            aria-hidden
        />
        <span>{text}</span>
    </span>
);

const AdventureRegionalBuffPanel: React.FC<{
    profile: AdventureProfile | null | undefined;
    stageRows: AdventureStageUnderstandingRow[];
    /** 버튼 비활성·표시용 보유 골드 */
    userGold?: number;
    compact?: boolean;
    /** 지정 시 해당 지역만 표시(탭 숨김) — 챕터 카드 모달용 */
    singleStageId?: string;
    /** 지역 효과 모달 내 임베드 — 여백·슬롯 간격 축소 */
    embeddedInModal?: boolean;
    /** 생략 시 앱 컨텍스트의 유저 레벨·이해도로 지역 잠금을 판별합니다. */
    chapterUnlockCtx?: AdventureChapterUnlockContext;
}> = ({ profile, stageRows, userGold = 0, compact = false, singleStageId, embeddedInModal = false, chapterUnlockCtx: chapterUnlockCtxProp }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const chapterUnlockCtx = useMemo<AdventureChapterUnlockContext>(
        () =>
            chapterUnlockCtxProp ?? {
                strategyLevel: Number(currentUserWithStatus?.userLevel ?? 0) || 0,
                isAdmin: !!currentUserWithStatus?.isAdmin,
                understandingXpByStage: currentUserWithStatus?.adventureProfile?.understandingXpByStage,
            },
        [
            chapterUnlockCtxProp,
            currentUserWithStatus?.userLevel,
            currentUserWithStatus?.isAdmin,
            currentUserWithStatus?.adventureProfile?.understandingXpByStage,
        ],
    );
    const singleStageIdx = useMemo(() => {
        if (!singleStageId) return -1;
        const idx = ADVENTURE_STAGES.findIndex((s) => s.id === singleStageId);
        return idx >= 0 ? idx : 0;
    }, [singleStageId]);
    const [tabIdx, setTabIdx] = useState(singleStageIdx >= 0 ? singleStageIdx : 0);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [rouletteLabelBySlot, setRouletteLabelBySlot] = useState<Record<number, string>>({});
    const [spinningSlots, setSpinningSlots] = useState<Record<number, boolean>>({});
    const [flashSlots, setFlashSlots] = useState<Record<number, boolean>>({});
    const rouletteIntervalRefs = useRef<Record<number, ReturnType<typeof setInterval> | undefined>>({});
    const rouletteTimeoutRefs = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
    const flashTimeoutRefs = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
    /** 동기적으로 연타·다중 슬롯 중복 요청 차단 (스핀 상태 커밋 전까지) */
    const regionalRerollLockedRef = useRef(false);
    const activeIdx = singleStageIdx >= 0 ? singleStageIdx : tabIdx;
    const stage = ADVENTURE_STAGES[activeIdx] ?? ADVENTURE_STAGES[0]!;
    const stageId = stage.id;
    const understandingRow = stageRows[activeIdx] ?? stageRows[0];
    const stageChapterUnlocked = isAdventureStageUnlocked(stageId, chapterUnlockCtx);

    const p = useMemo(() => normalizeAdventureProfile(profile), [profile]);
    const buffs: (AdventureRegionalSpecialtyBuffEntry | undefined)[] = (p.regionalSpecialtyBuffsByStageId?.[stageId] ?? []).map(
        (e) =>
            e != null && typeof e === 'object' && String((e as { kind?: unknown }).kind ?? '').trim() !== ''
                ? migrateRegionalBuffEntry(e as any)
                : undefined,
    );
    const tier = understandingRow ? getAdventureUnderstandingTierFromXp(understandingRow.xp) : 0;
    const maxSlots = slotCountForUnderstandingTier(tier);
    const grantPts = enhancementPointsGrantedTotalForTier(tier);
    const remainingPts = getRegionalEnhancePointsRemaining(p, stageId);
    const canAfford = userGold >= ADVENTURE_REGIONAL_BUFF_ACTION_GOLD;

    const panelCompact = compact || embeddedInModal;

    const labelCls = panelCompact
        ? 'text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:text-xs'
        : 'text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm';

    const randomRouletteLabel = (): string => {
        const pool = ADVENTURE_REGIONAL_SPECIALTY_KINDS;
        const kind = pool[Math.floor(Math.random() * pool.length)] as AdventureRegionalSpecialtyBuffKind;
        return labelRegionalSpecialtyBuffEntry({ kind, stacks: 1 } as AdventureRegionalSpecialtyBuffEntry);
    };

    const startRouletteAnimation = (slotIndex: number, onSpinComplete?: () => void) => {
        const prevInterval = rouletteIntervalRefs.current[slotIndex];
        if (prevInterval) clearInterval(prevInterval);
        const prevTimeout = rouletteTimeoutRefs.current[slotIndex];
        if (prevTimeout) clearTimeout(prevTimeout);

        setRouletteLabelBySlot((prev) => ({ ...prev, [slotIndex]: randomRouletteLabel() }));

        rouletteIntervalRefs.current[slotIndex] = setInterval(() => {
            setRouletteLabelBySlot((prev) => ({ ...prev, [slotIndex]: randomRouletteLabel() }));
        }, 70);

        rouletteTimeoutRefs.current[slotIndex] = setTimeout(() => {
            const curInterval = rouletteIntervalRefs.current[slotIndex];
            if (curInterval) clearInterval(curInterval);
            rouletteIntervalRefs.current[slotIndex] = undefined;
            setSpinningSlots((prev) => ({ ...prev, [slotIndex]: false }));
            setRouletteLabelBySlot((prev) => {
                const next = { ...prev };
                delete next[slotIndex];
                return next;
            });
            onSpinComplete?.();
        }, 900);
    };

    const startEnhanceFlashAnimation = (slotIndex: number) => {
        const prevTimeout = flashTimeoutRefs.current[slotIndex];
        if (prevTimeout) clearTimeout(prevTimeout);
        setFlashSlots((prev) => ({ ...prev, [slotIndex]: true }));
        flashTimeoutRefs.current[slotIndex] = setTimeout(() => {
            setFlashSlots((prev) => ({ ...prev, [slotIndex]: false }));
            flashTimeoutRefs.current[slotIndex] = undefined;
        }, 450);
    };

    useEffect(() => {
        return () => {
            Object.values(rouletteIntervalRefs.current).forEach((t) => t && clearInterval(t));
            Object.values(rouletteTimeoutRefs.current).forEach((t) => t && clearTimeout(t));
            Object.values(flashTimeoutRefs.current).forEach((t) => t && clearTimeout(t));
        };
    }, []);

    const anySlotSpinning = useMemo(() => Object.values(spinningSlots).some(Boolean), [spinningSlots]);

    const onChange = async (slotIndex: number) => {
        if (!stageChapterUnlocked) return;
        if (regionalRerollLockedRef.current || anySlotSpinning) return;
        const rawSlot = buffs[slotIndex];
        if (rawSlot) {
            const ent = migrateRegionalBuffEntry(rawSlot as any);
            const st = Math.max(1, Math.floor(ent.stacks ?? 1));
            if (st > 1) {
                const ok = window.confirm(
                    '강화된 효과를 변경하면 1단계 효과로 돌아가며, 이 효과에 쓰인 강화 포인트를 돌려받습니다. 계속할까요?',
                );
                if (!ok) return;
            }
        }

        regionalRerollLockedRef.current = true;
        setSpinningSlots((prev) => ({ ...prev, [slotIndex]: true }));
        setRouletteLabelBySlot((prev) => ({ ...prev, [slotIndex]: '적용 중…' }));

        try {
            const res = await handlers.handleAction({
                type: 'REROLL_ADVENTURE_REGIONAL_BUFF',
                payload: { stageId, slotIndex },
            } as any);

            if (res && typeof (res as { error?: string }).error === 'string') {
                const prevInterval = rouletteIntervalRefs.current[slotIndex];
                if (prevInterval) clearInterval(prevInterval);
                const prevTimeout = rouletteTimeoutRefs.current[slotIndex];
                if (prevTimeout) clearTimeout(prevTimeout);
                rouletteIntervalRefs.current[slotIndex] = undefined;
                rouletteTimeoutRefs.current[slotIndex] = undefined;
                setSpinningSlots((prev) => ({ ...prev, [slotIndex]: false }));
                setRouletteLabelBySlot((prev) => {
                    const next = { ...prev };
                    delete next[slotIndex];
                    return next;
                });
                regionalRerollLockedRef.current = false;
                return;
            }

            startRouletteAnimation(slotIndex, () => {
                regionalRerollLockedRef.current = false;
            });
        } catch {
            const prevInterval = rouletteIntervalRefs.current[slotIndex];
            if (prevInterval) clearInterval(prevInterval);
            const prevTimeout = rouletteTimeoutRefs.current[slotIndex];
            if (prevTimeout) clearTimeout(prevTimeout);
            rouletteIntervalRefs.current[slotIndex] = undefined;
            rouletteTimeoutRefs.current[slotIndex] = undefined;
            setSpinningSlots((prev) => ({ ...prev, [slotIndex]: false }));
            setRouletteLabelBySlot((prev) => {
                const next = { ...prev };
                delete next[slotIndex];
                return next;
            });
            regionalRerollLockedRef.current = false;
        }
    };

    const onEnhance = (slotIndex: number) => {
        if (!stageChapterUnlocked) return;
        startEnhanceFlashAnimation(slotIndex);
        handlers.handleAction({
            type: 'ENHANCE_ADVENTURE_REGIONAL_BUFF',
            payload: { stageId, slotIndex },
        } as any);
    };

    const getCompactLabel = (e: AdventureRegionalSpecialtyBuffEntry): string => {
        const st = Math.max(1, Math.floor(e.stacks ?? 1));
        const sfx = regionalBuffEnhanceCountSuffix(e.kind, st);
        switch (e.kind) {
            case 'regional_win_gold_10pct':
                return `골드 +${st * 10}%${sfx}`;
            case 'regional_equip_drop_3pct':
                return `장비획득 +${st * 3}%${sfx}`;
            case 'regional_material_drop_5pct':
                return `재료획득 +${st * 5}%${sfx}`;
            case 'regional_capture_target_plus1':
                return `[따내기바둑] 상대목표+${st}${sfx}`;
            case 'regional_time_limit_plus20pct':
                return `제한시간 +${st * 20}%${sfx}`;
            case 'regional_monster_respawn_minus10pct':
                return `출현대기 -${Math.min(50, st * 10)}%${sfx}`;
            case 'regional_monster_dwell_plus10pct':
                return `몬스터체류 +${st * 10}%${sfx}`;
            case 'regional_hidden_scan_plus1':
                return `[히든바둑] 스캔+${st}${sfx}`;
            case 'regional_base_start_score_plus1':
                return `[베이스바둑] 시작+${st}점${sfx}`;
            case 'regional_classic_start_score_plus1':
                return `[클래식바둑] 시작+${st}점${sfx}`;
            case 'regional_missile_plus1':
                return `[미사일바둑] 미사일+1`;
            default:
                return labelRegionalSpecialtyBuffEntry(e);
        }
    };

    return (
        <>
            <div
                className={`w-full min-w-0 rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/15 ${
                    embeddedInModal
                        ? 'border-0 bg-transparent px-0 py-0'
                        : panelCompact
                          ? 'px-3 py-2.5'
                          : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
                }`}
            >
                <div className={`flex items-center gap-2 ${embeddedInModal ? 'justify-end' : 'justify-between'}`}>
                    {!embeddedInModal ? <p className={labelCls}>지역 탐험도</p> : null}
                    <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="inline-flex items-center rounded-md border border-fuchsia-400/45 bg-fuchsia-950/45 px-2 py-1 text-[10px] font-bold text-fuchsia-100 transition-colors hover:border-amber-400/45 hover:text-amber-100 sm:text-[11px]"
                        aria-label="지역 탐험도 효과 정보 열기"
                    >
                        효과정보
                    </button>
                </div>

                {!singleStageId ? (
                    <div
                        className={`mt-2 flex flex-wrap gap-1 border-b border-white/10 pb-2 ${
                            compact ? '' : 'sm:gap-1.5'
                        }`}
                        role="tablist"
                        aria-label="지역 탐험도 탭"
                    >
                        {ADVENTURE_STAGES.map((s, i) => {
                            const tabUnlocked = isAdventureStageUnlocked(s.id, chapterUnlockCtx);
                            return (
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
                                    {!tabUnlocked ? <span aria-hidden> 🔒</span> : null}
                                    {!compact && <span className="ml-1 hidden sm:inline">{s.title}</span>}
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                <div className={embeddedInModal ? 'mt-2 space-y-2' : 'mt-2.5 space-y-2.5'}>
                    {understandingRow && (
                        <div className={embeddedInModal ? 'grid grid-cols-[minmax(0,1fr)_10.5rem] gap-2' : undefined}>
                        <div
                            className={`min-w-0 rounded-lg border border-white/8 bg-black/25 ${
                                panelCompact ? 'px-2.5 py-2' : 'px-3 py-2.5 sm:px-3.5'
                            }`}
                        >
                            <div
                                className={`flex items-center justify-between gap-2 ${
                                    panelCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                                }`}
                            >
                                <span
                                    className={`min-w-0 font-bold text-zinc-100 ${
                                        embeddedInModal ? 'whitespace-nowrap' : 'truncate'
                                    }`}
                                >
                                    {understandingRow.title}
                                </span>
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
                                    panelCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                                }`}
                            >
                                XP ({(understandingRow.xpInTier ?? understandingRow.xp).toLocaleString()}/
                                {(understandingRow.xpNeedInTier ?? understandingRow.xpGoal).toLocaleString()})
                            </p>
                            {!embeddedInModal ? (
                                <p
                                    className={`mt-1 font-semibold tabular-nums text-amber-200/90 ${
                                        panelCompact ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
                                    }`}
                                >
                                    강화 포인트 {remainingPts.toLocaleString()} / {grantPts.toLocaleString()}
                                </p>
                            ) : null}
                        </div>
                        {embeddedInModal ? (
                            <div className="flex min-w-0 flex-col justify-center rounded-lg border border-amber-500/35 bg-gradient-to-br from-amber-950/45 via-amber-950/20 to-zinc-950/85 px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/85">
                                    강화 포인트
                                </p>
                                <p className="mt-1 flex items-baseline gap-1 tabular-nums">
                                    <span className="text-2xl font-black leading-none text-amber-100">
                                        {remainingPts.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-semibold text-zinc-500">
                                        / {grantPts.toLocaleString()}
                                    </span>
                                </p>
                            </div>
                        ) : null}
                        </div>
                    )}

                    <div
                        className={`${embeddedInModal ? '' : 'mt-2'} flex min-h-0 w-full min-w-0 flex-col ${
                            embeddedInModal ? 'gap-1.5' : 'gap-1.5 sm:gap-2'
                        }`}
                    >
                        {!stageChapterUnlocked ? (
                            <div
                                className={`flex w-full items-center gap-2 rounded-md border border-dashed border-zinc-600/50 bg-black/20 px-2 py-2 ${
                                    compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
                                }`}
                            >
                                <span className="shrink-0 text-base leading-none sm:text-lg" aria-hidden>🔒</span>
                                <p className="min-w-0 flex-1 font-bold text-zinc-500">
                                    슬롯 1 잠김 · 챕터{stage.stageIndex} 오픈
                                </p>
                            </div>
                        ) : null}
                        {stageChapterUnlocked
                            ? Array.from({ length: REGIONAL_SPECIALTY_SLOT_COUNT }, (_, slotIndex) => {
                            const unlocked = slotIndex < maxSlots;
                            if (!unlocked) {
                                const tierLabel = ADVENTURE_UNDERSTANDING_TIER_LABELS[slotIndex];
                                return (
                                    <div
                                        key={slotIndex}
                                        className={`flex w-full items-center gap-2 rounded-md border border-dashed border-zinc-600/50 bg-black/20 px-2 py-2 ${
                                            compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
                                        }`}
                                    >
                                        <span className="shrink-0 text-base leading-none sm:text-lg" aria-hidden>🔒</span>
                                        <p
                                            className={`min-w-0 flex-1 font-bold text-zinc-500 ${
                                                embeddedInModal ? 'whitespace-nowrap' : 'truncate'
                                            }`}
                                        >
                                            슬롯 {slotIndex + 1} 잠김 · {tierLabel} 이상
                                        </p>
                                    </div>
                                );
                            }
                            const raw = buffs[slotIndex];
                            const isEmptyUnlockedSlot = !raw;
                            const e = raw ? migrateRegionalBuffEntry(raw as any) : null;
                            const isSpinning = !!spinningSlots[slotIndex];
                            const rouletteLabel = rouletteLabelBySlot[slotIndex];
                            const isFlashing = !!flashSlots[slotIndex];
                            return (
                                <div
                                    key={slotIndex}
                                    className={`relative flex w-full cursor-pointer rounded-md border px-2.5 transition-all duration-300 ${
                                        embeddedInModal
                                            ? 'flex-wrap gap-x-2 gap-y-2 py-2.5'
                                            : 'min-h-[3.25rem] items-center gap-2 py-2.5'
                                    } ${
                                        isFlashing
                                            ? 'border-amber-300/80 bg-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                                            : 'border-white/8 bg-black/25'
                                    } ${
                                        panelCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                                    }`}
                                >
                                    {isSpinning ? (
                                        <p
                                            className={`animate-pulse font-semibold leading-snug text-amber-100/95 ${
                                                embeddedInModal
                                                    ? 'w-full basis-full whitespace-nowrap'
                                                    : 'min-w-0 flex-1'
                                            }`}
                                        >
                                            {rouletteLabel ?? '효과 선택 중...'}
                                        </p>
                                    ) : isEmptyUnlockedSlot ? (
                                        <p
                                            className={`font-semibold leading-snug text-amber-100/95 ${
                                                embeddedInModal ? 'w-full basis-full whitespace-nowrap' : 'min-w-0 flex-1'
                                            }`}
                                        >
                                            🔓 사용 가능
                                        </p>
                                    ) : (
                                        <p
                                            className={`font-semibold leading-snug text-cyan-100/95 ${
                                                embeddedInModal ? 'w-full basis-full whitespace-nowrap' : 'min-w-0 flex-1'
                                            }`}
                                        >
                                            {labelRegionalSpecialtyBuffEntry(e!)}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        disabled={
                                            isSpinning ||
                                            anySlotSpinning ||
                                            (!isEmptyUnlockedSlot && !canAfford)
                                        }
                                        onClick={() => void onChange(slotIndex)}
                                        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs ${
                                            isEmptyUnlockedSlot
                                                ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100 enabled:hover:bg-emerald-900/45'
                                                : 'border-amber-500/45 bg-amber-950/35 text-amber-100 enabled:hover:bg-amber-900/45'
                                        }`}
                                        aria-label={
                                            isEmptyUnlockedSlot
                                                ? '효과 획득 (무료)'
                                                : `효과 변경, 비용 ${ADVENTURE_REGIONAL_BUFF_ACTION_GOLD} 골드`
                                        }
                                    >
                                        <span>{isEmptyUnlockedSlot ? '효과 획득' : '변경'}</span>
                                        {!isEmptyUnlockedSlot ? (
                                            <GoldCostInline text={formatGoldAmountKoG(ADVENTURE_REGIONAL_BUFF_ACTION_GOLD)} />
                                        ) : (
                                            <span className="tabular-nums text-emerald-200/90">무료</span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            !canAfford ||
                                            isSpinning ||
                                            !e ||
                                            !isRegionalBuffEnhanceable(e.kind) ||
                                            remainingPts < 1 ||
                                            Math.floor(e.stacks ?? 1) >= getRegionalBuffMaxStacks(e.kind)
                                        }
                                        title={
                                            !e
                                                ? '빈 슬롯은 강화할 수 없습니다'
                                                : !isRegionalBuffEnhanceable(e.kind)
                                                ? '이 효과는 강화할 수 없습니다'
                                                : remainingPts < 1
                                                  ? '강화 포인트가 부족합니다'
                                                  : undefined
                                        }
                                        onClick={() => onEnhance(slotIndex)}
                                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-fuchsia-500/45 bg-fuchsia-950/35 px-2 py-1.5 text-[11px] font-bold text-fuchsia-100 transition-colors enabled:hover:bg-fuchsia-900/45 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
                                        aria-label={`강화, 비용 ${ADVENTURE_REGIONAL_BUFF_ACTION_GOLD} 골드 및 포인트 1`}
                                    >
                                        <span>강화</span>
                                        <GoldCostInline text={formatGoldAmountKoG(ADVENTURE_REGIONAL_BUFF_ACTION_GOLD)} />
                                    </button>
                                </div>
                            );
                        })
                            : null}
                    </div>
                </div>
            </div>
            {showHelpModal ? (
                <AdventureRegionalUnderstandingHelpModal onClose={() => setShowHelpModal(false)} isTopmost />
            ) : null}
        </>
    );
};

export default AdventureRegionalBuffPanel;
