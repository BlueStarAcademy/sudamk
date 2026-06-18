import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    migrateRegionalBuffEntry,
    slotCountForUnderstandingTier,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import type { AdventureRegionalSpecialtyBuffEntry, AdventureRegionalSpecialtyBuffKind } from '../../types/entities.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import AdventureRegionalUnderstandingHelpModal from './AdventureRegionalUnderstandingHelpModal.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';
import {
    labelRegionalSpecialtyBuffCompactI18n,
    labelRegionalSpecialtyBuffI18n,
} from './adventureI18nHelpers.js';

const REGIONAL_SPECIALTY_SLOT_COUNT = 5 as const;

export type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';
import type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';

const GoldCostInline: React.FC<{ text: string; compact?: boolean }> = ({ text, compact = false }) => (
    <span className="inline-flex items-center justify-center gap-0.5 tabular-nums">
        <img
            src="/images/icon/Gold.webp"
            alt=""
            className={`shrink-0 object-contain ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`}
            aria-hidden
        />
        <span>{text}</span>
    </span>
);

const RegionalBuffStackedActionButton: React.FC<{
    label: string;
    cost: React.ReactNode;
    disabled?: boolean;
    onClick: () => void;
    variant: 'change' | 'changeEmpty' | 'enhance';
    title?: string;
    'aria-label'?: string;
}> = ({ label, cost, disabled, onClick, variant, title, 'aria-label': ariaLabel }) => {
    const variantClass =
        variant === 'enhance'
            ? 'border-fuchsia-500/45 bg-fuchsia-950/35 text-fuchsia-100 enabled:hover:bg-fuchsia-900/45'
            : variant === 'changeEmpty'
              ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100 enabled:hover:bg-emerald-900/45'
              : 'border-amber-500/45 bg-amber-950/35 text-amber-100 enabled:hover:bg-amber-900/45';

    return (
        <button
            type="button"
            disabled={disabled}
            title={title}
            onClick={onClick}
            aria-label={ariaLabel}
            className={`inline-flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1.5 text-center text-[11px] font-bold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[3.5rem] sm:text-xs ${variantClass}`}
        >
            <span className="whitespace-nowrap">{label}</span>
            <span className="text-[10px] font-semibold leading-tight sm:text-[11px]">{cost}</span>
        </button>
    );
};

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
    const { t } = useTranslation('lobby');
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
        return labelRegionalSpecialtyBuffCompactI18n(t, { kind, stacks: 1 } as AdventureRegionalSpecialtyBuffEntry);
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
                const ok = window.confirm(t('adventure.confirmChangeEnhanced'));
                if (!ok) return;
            }
        }

        regionalRerollLockedRef.current = true;
        setSpinningSlots((prev) => ({ ...prev, [slotIndex]: true }));
        setRouletteLabelBySlot((prev) => ({ ...prev, [slotIndex]: t('adventure.applying') }));

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

    const getCompactLabel = (e: AdventureRegionalSpecialtyBuffEntry): string =>
        labelRegionalSpecialtyBuffCompactI18n(t, e);

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
                    {!embeddedInModal ? <p className={labelCls}>{t('adventure.regionalExploration')}</p> : null}
                    <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="inline-flex items-center rounded-md border border-fuchsia-400/45 bg-fuchsia-950/45 px-2 py-1 text-[10px] font-bold text-fuchsia-100 transition-colors hover:border-amber-400/45 hover:text-amber-100 sm:text-[11px]"
                        aria-label={t('adventure.effectInfoOpenAria')}
                    >
                        {t('adventure.effectInfo')}
                    </button>
                </div>

                {!singleStageId ? (
                    <div
                        className={`mt-2 flex flex-wrap gap-1 border-b border-white/10 pb-2 ${
                            compact ? '' : 'sm:gap-1.5'
                        }`}
                        role="tablist"
                        aria-label={t('adventure.regionalExplorationTabsAria')}
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
                                    {t('adventure.enhancePointsCount', {
                                        remaining: remainingPts.toLocaleString(),
                                        grant: grantPts.toLocaleString(),
                                    })}
                                </p>
                            ) : null}
                        </div>
                        {embeddedInModal ? (
                            <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-amber-500/35 bg-gradient-to-br from-amber-950/45 via-amber-950/20 to-zinc-950/85 px-3 py-2.5 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/85">
                                    {t('adventure.enhancePoints')}
                                </p>
                                <p className="mt-1 flex items-baseline justify-center gap-1 tabular-nums">
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
                                    {t('adventure.slot1LockedChapterOpen', { stageIndex: stage.stageIndex })}
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
                                            {t('adventure.slotLockedTier', { slot: slotIndex + 1, tier: tierLabel })}
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
                            const goldCostLabel = formatGoldAmountKoG(ADVENTURE_REGIONAL_BUFF_ACTION_GOLD);

                            const effectLabel = isSpinning ? (
                                <p className="min-w-0 flex-1 animate-pulse font-semibold leading-snug text-amber-100/95">
                                    {rouletteLabel ?? t('adventure.effectSelecting')}
                                </p>
                            ) : isEmptyUnlockedSlot ? (
                                <p className="min-w-0 flex-1 font-semibold leading-snug text-amber-100/95">{t('adventure.slotAvailable')}</p>
                            ) : (
                                <p
                                    className={`min-w-0 flex-1 font-semibold leading-snug text-cyan-100/95 ${
                                        embeddedInModal ? 'whitespace-nowrap' : ''
                                    }`}
                                >
                                    {labelRegionalSpecialtyBuffI18n(t, e!)}
                                </p>
                            );

                            const changeButton = (
                                <button
                                    type="button"
                                    disabled={isSpinning || anySlotSpinning || (!isEmptyUnlockedSlot && !canAfford)}
                                    onClick={() => void onChange(slotIndex)}
                                    className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs ${
                                        isEmptyUnlockedSlot
                                            ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100 enabled:hover:bg-emerald-900/45'
                                            : 'border-amber-500/45 bg-amber-950/35 text-amber-100 enabled:hover:bg-amber-900/45'
                                    }`}
                                    aria-label={
                                        isEmptyUnlockedSlot
                                            ? t('adventure.gainEffectFree')
                                            : t('adventure.changeEffectCost', { gold: ADVENTURE_REGIONAL_BUFF_ACTION_GOLD })
                                    }
                                >
                                    <span>{isEmptyUnlockedSlot ? t('adventure.gainEffect') : t('adventure.changeEffect')}</span>
                                    {!isEmptyUnlockedSlot ? (
                                        <GoldCostInline text={goldCostLabel} />
                                    ) : (
                                        <span className="tabular-nums text-emerald-200/90">{t('adventure.free')}</span>
                                    )}
                                </button>
                            );

                            const enhanceButton = (
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
                                            ? t('adventure.cannotEnhanceEmpty')
                                            : !isRegionalBuffEnhanceable(e.kind)
                                              ? t('adventure.cannotEnhanceEffect')
                                              : remainingPts < 1
                                                ? t('adventure.insufficientEnhancePoints')
                                                : undefined
                                    }
                                    onClick={() => onEnhance(slotIndex)}
                                    className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-fuchsia-500/45 bg-fuchsia-950/35 px-2 py-1.5 text-[11px] font-bold text-fuchsia-100 transition-colors enabled:hover:bg-fuchsia-900/45 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
                                    aria-label={t('adventure.enhanceCostAria', { gold: ADVENTURE_REGIONAL_BUFF_ACTION_GOLD })}
                                >
                                    <span>{t('adventure.enhance')}</span>
                                    <GoldCostInline text={goldCostLabel} />
                                </button>
                            );

                            const modalActionButtons = (
                                <div className="flex shrink-0 flex-row items-center gap-1.5">
                                    <RegionalBuffStackedActionButton
                                        label={isEmptyUnlockedSlot ? t('adventure.gainEffect') : t('adventure.changeEffect')}
                                        cost={
                                            isEmptyUnlockedSlot ? (
                                                <span className="text-emerald-200/90">{t('adventure.free')}</span>
                                            ) : (
                                                <GoldCostInline text={goldCostLabel} compact />
                                            )
                                        }
                                        disabled={
                                            isSpinning || anySlotSpinning || (!isEmptyUnlockedSlot && !canAfford)
                                        }
                                        variant={isEmptyUnlockedSlot ? 'changeEmpty' : 'change'}
                                        onClick={() => void onChange(slotIndex)}
                                        aria-label={
                                            isEmptyUnlockedSlot
                                                ? t('adventure.gainEffectFree')
                                                : t('adventure.changeEffectCost', { gold: ADVENTURE_REGIONAL_BUFF_ACTION_GOLD })
                                        }
                                    />
                                    <RegionalBuffStackedActionButton
                                        label={t('adventure.enhance')}
                                        cost={<GoldCostInline text={goldCostLabel} compact />}
                                        disabled={
                                            !canAfford ||
                                            isSpinning ||
                                            !e ||
                                            !isRegionalBuffEnhanceable(e.kind) ||
                                            remainingPts < 1 ||
                                            Math.floor(e.stacks ?? 1) >= getRegionalBuffMaxStacks(e.kind)
                                        }
                                        variant="enhance"
                                        title={
                                            !e
                                                ? t('adventure.cannotEnhanceEmpty')
                                                : !isRegionalBuffEnhanceable(e.kind)
                                                  ? t('adventure.cannotEnhanceEffect')
                                                  : remainingPts < 1
                                                    ? t('adventure.insufficientEnhancePoints')
                                                    : undefined
                                        }
                                        onClick={() => onEnhance(slotIndex)}
                                        aria-label={t('adventure.enhanceCostAria', { gold: ADVENTURE_REGIONAL_BUFF_ACTION_GOLD })}
                                    />
                                </div>
                            );

                            return (
                                <div
                                    key={slotIndex}
                                    className={`relative flex w-full cursor-pointer rounded-md border px-2.5 transition-all duration-300 ${
                                        embeddedInModal
                                            ? 'min-h-[3rem] items-center gap-2 py-2.5'
                                            : 'min-h-[3.25rem] items-center gap-2 py-2.5'
                                    } ${
                                        isFlashing
                                            ? 'border-amber-300/80 bg-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                                            : 'border-white/8 bg-black/25'
                                    } ${panelCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                                >
                                    {effectLabel}
                                    {embeddedInModal ? modalActionButtons : (
                                        <>
                                            {changeButton}
                                            {enhanceButton}
                                        </>
                                    )}
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
