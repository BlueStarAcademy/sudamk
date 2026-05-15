import React, { useEffect, useRef, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS,
} from '../game/ResultModalRewardSlot.js';
import { ResultModalXpRewardBadge, ResultModalPetGradeUpgradeNeededSlot } from '../game/ResultModalXpRewardBadge.js';
import { MATERIAL_ITEMS } from '../../shared/constants/items.js';
import { ItemGrade } from '../../types/enums.js';
import type { InventoryItem, ServerAction } from '../../types.js';
import type { PairTrainingClaimClientSummary } from '../../shared/types/pairTrainingClaim.js';
import PairPetLevelUpCoreDelta from './PairPetLevelUpCoreDelta.js';
import { effectivePairPetGradeFromRow, pairPetShowsGradeUpgradeNeededInsteadOfXp } from '../../shared/constants/pairPetGrade.js';

const XP_BAR_BASE_MS = 700;
const XP_BAR_GAIN_MS = 600;

const TrainingClaimXpBar: React.FC<{
    initial: number;
    final: number;
    max: number;
    levelUp: boolean;
    xpGain: number;
    finalLevel: number;
    isMobile: boolean;
}> = ({ initial, final, max, levelUp, xpGain, finalLevel, isMobile }) => {
    const [baseW, setBaseW] = useState(0);
    const [gainW, setGainW] = useState(0);
    const [showGainText, setShowGainText] = useState(false);

    const initialPercent = max > 0 ? (initial / max) * 100 : 0;
    const finalPercent = max > 0 ? Math.min(100, (final / max) * 100) : 0;
    const gainPercent = Math.max(0, finalPercent - initialPercent);

    useEffect(() => {
        let cancelled = false;
        setBaseW(0);
        setGainW(0);
        setShowGainText(false);

        const startTimer = setTimeout(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
                if (cancelled) return;
                requestAnimationFrame(() => {
                    if (!cancelled) setBaseW(initialPercent);
                });
            });
        }, 150);

        const gainTimer =
            gainPercent > 0
                ? setTimeout(() => {
                      if (cancelled) return;
                      requestAnimationFrame(() => {
                          if (cancelled) return;
                          requestAnimationFrame(() => {
                              if (cancelled) return;
                              setGainW(gainPercent);
                              if (xpGain > 0) setShowGainText(true);
                          });
                      });
                  }, 150 + XP_BAR_BASE_MS)
                : null;

        return () => {
            cancelled = true;
            clearTimeout(startTimer);
            if (gainTimer) clearTimeout(gainTimer);
        };
    }, [initial, final, max, levelUp, initialPercent, finalPercent, gainPercent, xpGain]);

    const gainTextKey = `${xpGain}-${initial}`;
    const barCenterLabel = levelUp ? `0 +${final} / ${max} XP` : `${initial} +${xpGain} / ${max} XP`;

    if (isMobile) {
        return (
            <div className="flex w-full min-w-0 flex-col gap-1">
                <div className="flex w-full min-w-0 items-center gap-1.5">
                    <span className="w-11 shrink-0 text-right text-xs font-bold tabular-nums">Lv.{finalLevel}</span>
                    <div className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-gray-900/50 bg-gray-700/50">
                        <div
                            className="absolute left-0 top-0 z-[1] h-full rounded-l-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-[width] ease-out"
                            style={{ width: `${baseW}%`, transitionDuration: `${XP_BAR_BASE_MS}ms` }}
                        />
                        {gainPercent > 0 && (
                            <div
                                className="pointer-events-none absolute top-0 z-[2] h-full rounded-r-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] ease-out"
                                style={{
                                    left: `${initialPercent}%`,
                                    width: `${gainW}%`,
                                    transitionDuration: `${XP_BAR_GAIN_MS}ms`,
                                }}
                            />
                        )}
                        {levelUp && (
                            <span
                                className="absolute inset-0 z-[11] flex items-center justify-center text-[8px] font-bold text-white animate-pulse"
                                style={{ textShadow: '0 0 5px black' }}
                            >
                                LEVEL UP!
                            </span>
                        )}
                    </div>
                    {gainPercent > 0 && xpGain > 0 && (
                        <span
                            key={gainTextKey}
                            className={`shrink-0 whitespace-nowrap text-xs font-bold tabular-nums ${
                                showGainText
                                    ? 'text-green-400 animate-fade-in-xp'
                                    : 'pointer-events-none text-green-400 opacity-0'
                            }`}
                            aria-hidden={!showGainText}
                        >
                            +{xpGain} XP
                        </span>
                    )}
                </div>
                <div className="w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    <p className="whitespace-nowrap text-center text-[9px] font-bold tabular-nums text-slate-600">
                        {levelUp ? (
                            <>
                                0 <span className="text-emerald-700">+{final.toLocaleString()}</span> / {max.toLocaleString()} XP
                            </>
                        ) : (
                            <>
                                {initial.toLocaleString()} <span className="text-emerald-700">+{xpGain}</span> / {max.toLocaleString()} XP
                            </>
                        )}
                    </p>
                </div>
                <style>{`
                @keyframes fadeInXp {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-xp {
                    animation: fadeInXp 0.5s ease-out forwards;
                }
            `}</style>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 min-[1024px]:gap-2.5">
            <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums min-[1024px]:w-16 min-[1024px]:text-base">
                Lv.{finalLevel}
            </span>
            <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-full border border-gray-900/50 bg-gray-700/50 min-[1024px]:h-[18px]">
                <div
                    className="absolute left-0 top-0 z-[1] h-full rounded-l-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-[width] ease-out"
                    style={{ width: `${baseW}%`, transitionDuration: `${XP_BAR_BASE_MS}ms` }}
                />
                {gainPercent > 0 && (
                    <div
                        className="pointer-events-none absolute top-0 z-[2] h-full rounded-r-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] ease-out"
                        style={{
                            left: `${initialPercent}%`,
                            width: `${gainW}%`,
                            transitionDuration: `${XP_BAR_GAIN_MS}ms`,
                        }}
                    />
                )}
                <span className="absolute inset-0 z-[10] flex items-center justify-center text-xs font-bold text-black/80 drop-shadow-sm min-[1024px]:text-sm">
                    {barCenterLabel}
                </span>
                {levelUp && (
                    <span
                        className="absolute inset-0 z-[11] flex items-center justify-center text-xs font-bold text-white animate-pulse min-[1024px]:text-sm"
                        style={{ textShadow: '0 0 5px black' }}
                    >
                        LEVEL UP!
                    </span>
                )}
            </div>
            {gainPercent > 0 && xpGain > 0 && (
                <span
                    key={gainTextKey}
                    className={`inline-flex w-[4.25rem] shrink-0 items-center justify-end whitespace-nowrap text-sm font-bold text-green-400 min-[1024px]:w-20 min-[1024px]:text-base ${
                        showGainText ? 'animate-fade-in-xp' : 'pointer-events-none opacity-0'
                    }`}
                    aria-hidden={!showGainText}
                >
                    +{xpGain} XP
                </span>
            )}
            <style>{`
                @keyframes fadeInXp {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-xp {
                    animation: fadeInXp 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export type PairTrainingRewardModalProps = {
    slotIndex: number;
    slotLabel: string;
    petItem: InventoryItem;
    /** 부모에서 `PAIR_PET_CLAIM_TRAINING` 완료 후 전달 — 보상 연출만 표시 */
    claimSummary: PairTrainingClaimClientSummary;
    onClose: () => void;
    applyPetAction: (action: ServerAction) => Promise<unknown>;
    isBusy: boolean;
};

const PairTrainingRewardModal: React.FC<PairTrainingRewardModalProps> = ({
    slotIndex,
    slotLabel,
    petItem,
    claimSummary,
    onClose,
    applyPetAction,
    isBusy,
}) => {
    const isMobile = useIsHandheldDevice();
    const summary = claimSummary;

    /** 부모가 매 렌더마다 새 함수를 넘기면 `isBusy` 토글마다 재요청 위험 → ref로 고정 */
    const applyPetActionRef = useRef(applyPetAction);
    const onCloseRef = useRef(onClose);
    applyPetActionRef.current = applyPetAction;
    onCloseRef.current = onClose;

    const compactRewards = isMobile;

    /** 수령 직후 슬롯은 비었으므로 같은 슬롯·같은 인벤 행으로 수련 재시작 */
    const handleTrainAgain = async () => {
        const res = (await applyPetActionRef.current({
            type: 'PAIR_PET_START_TRAINING',
            payload: { slotIndex, itemId: petItem.id },
        })) as { error?: string } | null;
        if (res?.error) return;
        onCloseRef.current();
    };

    const soulMat = summary.soulDrop
        ? MATERIAL_ITEMS[summary.soulDrop.materialName as keyof typeof MATERIAL_ITEMS]
        : undefined;

    /** 특화 골드 추가분: `goldFromSpecialization`가 없거나 0이어도 `goldBase`·`goldGain`으로 복구 */
    const goldRollBase = typeof summary.goldBase === 'number' ? summary.goldBase : undefined;
    const trainingGoldSpecBonus =
        typeof summary.goldFromSpecialization === 'number' && summary.goldFromSpecialization > 0
            ? summary.goldFromSpecialization
            : goldRollBase != null
              ? Math.max(0, summary.goldGain - goldRollBase)
              : 0;
    const trainingGoldBaseForUi =
        trainingGoldSpecBonus > 0
            ? goldRollBase != null
                ? goldRollBase
                : Math.max(0, summary.goldGain - trainingGoldSpecBonus)
            : summary.goldGain ?? 0;

    /** 펫 XP: `xpFromSpecialization` 키가 빠져도 롤 기준값(`xpBase`)과 총 획득으로 특화분 표시 */
    const totalPetXpGain =
        summary.pairPetXp != null
            ? summary.pairPetXp.change
            : typeof summary.xpGain === 'number'
              ? summary.xpGain
              : undefined;
    const xpRollBase = typeof summary.xpBase === 'number' ? summary.xpBase : undefined;
    const petXpSpecSplitForUi =
        xpRollBase != null && typeof totalPetXpGain === 'number'
            ? { base: xpRollBase, spec: Math.max(0, totalPetXpGain - xpRollBase) }
            : undefined;

    const showPetGradeUpgradeInsteadOfXp = Boolean(
        pairPetShowsGradeUpgradeNeededInsteadOfXp({
            grade: effectivePairPetGradeFromRow(petItem),
            petFinalLevel: summary.pairPetLevel?.final,
            xpChange: summary.pairPetXp?.change,
        }),
    );

    return (
        <DraggableWindow
            title="수련 완료"
            onClose={onClose}
            windowId="pair-training-reward"
            isTopmost
            variant="store"
            initialWidth={isMobile ? 360 : 480}
            shrinkHeightToContent
            bodyNoScroll
            bodyPaddingClassName="p-0"
        >
            <div className="relative overflow-hidden">
                <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-18%,rgba(217,70,239,0.28),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)48%,rgba(59,7,100,0.28)100%)]"
                    aria-hidden
                />
                <div className="relative px-3 pb-4 pt-4 text-center sm:px-6 sm:pb-6 sm:pt-6">
                    <p className="mb-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-fuchsia-300/85 sm:text-xs sm:tracking-wide">
                        {slotLabel}
                    </p>

                    <div className="mx-auto mb-3 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl border border-fuchsia-400/35 bg-black/40 p-1 shadow-inner sm:mb-4 sm:h-[5.75rem] sm:w-[5.75rem] sm:border-fuchsia-400/40">
                        <img
                            src={summary.petImage ?? petItem.image}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                            loading="lazy"
                        />
                    </div>

                    <>
                        <div className="mx-auto w-full max-w-md">
                            <h3 className="text-sm font-bold tracking-tight text-fuchsia-50 sm:text-lg sm:font-black">
                                {summary.petDisplayName ?? petItem.name}
                            </h3>
                            <p className="mt-0.5 text-[0.65rem] font-medium tracking-wide text-slate-500 sm:mt-1 sm:text-sm sm:font-semibold sm:text-slate-400">
                                수련 보상이 지급되었습니다.
                            </p>
                        </div>

                        <div
                            className={`mx-auto mt-3 flex w-full max-w-md flex-wrap content-center items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-zinc-900/50 to-black/35 px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-fuchsia-500/[0.08] sm:mt-4 sm:gap-2.5 sm:px-3 sm:py-3.5 ${RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS}`}
                        >
                            {summary.goldGain > 0 ? (
                                <ResultModalGoldCurrencySlot
                                    amount={trainingGoldBaseForUi}
                                    understandingBonus={trainingGoldSpecBonus > 0 ? trainingGoldSpecBonus : undefined}
                                    primaryIsBaseAmount={trainingGoldSpecBonus > 0}
                                    compact={compactRewards}
                                />
                            ) : null}
                            {summary.pairPetXp != null ? (
                                <div className="flex shrink-0 flex-col items-center justify-center">
                                    {showPetGradeUpgradeInsteadOfXp ? (
                                        <ResultModalPetGradeUpgradeNeededSlot density={compactRewards ? 'compact' : 'comfortable'} />
                                    ) : (
                                        <ResultModalXpRewardBadge
                                            variant="pet"
                                            amount={summary.pairPetXp.change}
                                            petXpSpecSplit={petXpSpecSplitForUi}
                                            density={compactRewards ? 'compact' : 'comfortable'}
                                            title={
                                                summary.pairPetXp.change > 0
                                                    ? petXpSpecSplitForUi && petXpSpecSplitForUi.spec > 0
                                                        ? `펫 경험치 기본 +${petXpSpecSplitForUi.base.toLocaleString()} (특화 +${petXpSpecSplitForUi.spec.toLocaleString()})`
                                                        : `펫 경험치 +${summary.pairPetXp.change.toLocaleString()}`
                                                    : '펫 경험치 변동 없음'
                                            }
                                            allowZeroDisplay
                                        />
                                    )}
                                </div>
                            ) : null}
                            {summary.soulDrop && soulMat ? (
                                <ResultModalItemRewardSlot
                                    imageSrc={soulMat.image}
                                    name={soulMat.name}
                                    quantity={summary.soulDrop.quantity}
                                    compact={compactRewards}
                                    equipmentGrade={(soulMat.grade ?? ItemGrade.Normal) as ItemGrade}
                                    materialQuantityOnly
                                />
                            ) : null}
                        </div>

                        {summary.pairPetLevel && summary.pairPetXp ? (
                            showPetGradeUpgradeInsteadOfXp ? (
                                <div className="mx-auto mt-3 w-full max-w-md space-y-2 sm:mt-4">
                                    <div className="rounded-xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-950/40 via-zinc-950/30 to-black/40 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-3 sm:py-2.5">
                                        <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.12em] text-fuchsia-200/90 sm:text-xs">
                                            펫 등급강화 필요
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="mx-auto mt-3 w-full max-w-md space-y-2 sm:mt-4">
                                    <div className="rounded-xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-950/40 via-zinc-950/30 to-black/40 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-3 sm:py-2.5">
                                        <p className="mb-1.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.14em] text-fuchsia-200/90 sm:mb-2 sm:text-xs sm:font-black sm:tracking-tight sm:normal-case">
                                            펫 성장
                                        </p>
                                        <TrainingClaimXpBar
                                            initial={summary.pairPetLevel.progress.initial}
                                            final={summary.pairPetLevel.progress.final}
                                            max={Math.max(1, summary.pairPetLevel.progress.max)}
                                            levelUp={summary.pairPetLevel.initial < summary.pairPetLevel.final}
                                            xpGain={summary.pairPetXp.change}
                                            finalLevel={summary.pairPetLevel.final}
                                            isMobile={isMobile}
                                        />
                                    </div>
                                    <PairPetLevelUpCoreDelta
                                        delta={summary.pairPetLevelUpCoreBonuses}
                                        title="추가된 능력치"
                                        compact={compactRewards}
                                        className="mx-auto w-full max-w-md"
                                    />
                                </div>
                            )
                        ) : null}

                        <div className="mx-auto mt-4 flex w-full max-w-sm flex-row items-stretch justify-center gap-2 sm:mt-5 sm:gap-3">
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleTrainAgain()}
                                className="min-w-0 flex-1 rounded-xl border border-violet-400/45 bg-violet-950/35 px-2 py-2 text-[0.65rem] font-bold leading-snug text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-300/55 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:py-2.5 sm:text-sm sm:font-black"
                            >
                                한번 더 수련
                            </button>
                            <Button
                                type="button"
                                colorScheme="none"
                                disabled={isBusy}
                                className="min-w-0 flex-1 !rounded-xl !border !border-fuchsia-400/40 !bg-gradient-to-b !from-fuchsia-600/85 !via-fuchsia-800/50 !to-zinc-950/90 !py-2 !text-xs !font-bold !tracking-wide !text-fuchsia-50/95 !shadow-[0_10px_28px_rgba(0,0,0,0.35)] hover:!from-fuchsia-500 hover:!via-fuchsia-700/45 hover:!to-zinc-950 disabled:!opacity-45 sm:!py-2.5 sm:!text-sm sm:!font-black sm:!tracking-normal"
                                onClick={onClose}
                            >
                                확인
                            </Button>
                        </div>
                    </>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairTrainingRewardModal;
