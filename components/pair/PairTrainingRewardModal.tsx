import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useTranslation, Trans } from 'react-i18next';
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
import {
    clearPairTrainingClaimCompleted,
    markPairTrainingClaimCompleted,
    PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR,
    awaitPairTrainingClaimSettled,
    pairTrainingClaimInFlightBySlotIndex,
    parsePairTrainingClaimResponse,
    registerPairTrainingClaimInflight,
} from './pairTrainingClaimInFlight.js';
import PairPetLevelUpCoreDelta from './PairPetLevelUpCoreDelta.js';
import { effectivePairPetGradeFromRow, pairPetShowsGradeUpgradeNeededInsteadOfXp } from '../../shared/constants/pairPetGrade.js';
import { buildOptimisticPairPetTrainingStartUpdate } from '../../shared/utils/pairPetTrainingSlotsClientMerge.js';
import { useAdContext } from '../ads/AdProvider.js';

const XP_BAR_BASE_MS = 700;
const XP_BAR_GAIN_MS = 600;

/** 대국 결과 모달 `XpBar`와 동일한 애니메이션·레이아웃(펫 수련 보상 전용) */
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
    /** 서버에서 이미 수령한 결과가 있으면 즉시 완료 화면으로 진입한다. */
    claimSummary?: PairTrainingClaimClientSummary | null;
    /** true면 마운트 직후 수령 API 호출(확인 문구 생략). false면 「수령할까요?」 후 버튼 수령. */
    autoClaimOnMount?: boolean;
    /** `claimSummary`가 이미 있을 때 백그라운드로 `PAIR_PET_CLAIM_TRAINING`만 동기화(로딩 UI 없음) */
    persistClaimOnMount?: boolean;
    /** `persistClaimOnMount` 시 busy 없이 호출(예: `handlers.handleAction`) */
    commitClaimWithoutBusy?: (action: ServerAction) => Promise<unknown>;
    onClose: () => void;
    applyPetAction: (action: ServerAction) => Promise<unknown>;
    isBusy: boolean;
};

const PairTrainingRewardModal: React.FC<PairTrainingRewardModalProps> = ({
    slotIndex,
    slotLabel,
    petItem,
    claimSummary = null,
    autoClaimOnMount = false,
    persistClaimOnMount = false,
    commitClaimWithoutBusy,
    onClose,
    applyPetAction,
    isBusy,
}) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const { t } = useTranslation(['pair', 'common', 'game']);
    const { t: tCommon } = useTranslation('common');
    const { showShopAdRewardInterstitial, isAdFree } = useAdContext();
    const isMobile = useIsHandheldDevice();
    const [phase, setPhase] = useState<'ready' | 'done'>(claimSummary ? 'done' : 'ready');
    const [summary, setSummary] = useState<PairTrainingClaimClientSummary | null>(claimSummary);
    const [adDoublePending, setAdDoublePending] = useState(false);

    /** 부모가 매 렌더마다 새 함수를 넘기면(예: `applyPetAction` inline) effect 의존성에 넣으면 `isBusy` 토글마다 재수령·실패·모달 닫힘 → ref로 고정 */
    const applyPetActionRef = useRef(applyPetAction);
    const commitClaimRef = useRef(commitClaimWithoutBusy ?? applyPetAction);
    const onCloseRef = useRef(onClose);
    const trainAgainInFlightRef = useRef(false);
    const [trainAgainBusy, setTrainAgainBusy] = useState(false);
    applyPetActionRef.current = applyPetAction;
    commitClaimRef.current = commitClaimWithoutBusy ?? applyPetAction;
    onCloseRef.current = onClose;

    const compactRewards = isMobile;

    const handleClaim = async () => {
        const res = (await applyPetAction({
            type: 'PAIR_PET_CLAIM_TRAINING',
            payload: { slotIndex },
        })) as {
            error?: string;
            /** `/api/action`이 `{ success, ...clientResponse }` 평탄화로 보냄 */
            pairTrainingClaimSummary?: PairTrainingClaimClientSummary;
            clientResponse?: { pairTrainingClaimSummary?: PairTrainingClaimClientSummary };
        } | null;
        if (res?.error) {
            window.alert(res.error);
            return;
        }
        const s =
            res?.pairTrainingClaimSummary ??
            res?.clientResponse?.pairTrainingClaimSummary ??
            (res as { data?: { pairTrainingClaimSummary?: PairTrainingClaimClientSummary } })?.data
                ?.pairTrainingClaimSummary;
        if (!s) {
            window.alert(t('training.rewardLoadFailed'));
            onClose();
            return;
        }
        setSummary(s);
        setPhase('done');
        markPairTrainingClaimCompleted(slotIndex);
    };

    const handleAdDoubleClaim = () => {
        const claimId = summary?.adDoubleClaimId;
        if (!claimId || adDoublePending || summary?.adDoubled) return;
        const runClaim = () => {
            setAdDoublePending(true);
            void Promise.resolve(
                applyPetActionRef.current({
                    type: 'PAIR_PET_CLAIM_TRAINING_AD_DOUBLE',
                    payload: { claimId },
                }),
            )
                .then((raw) => {
                    const { error, summary: doubledSummary } = parsePairTrainingClaimResponse(raw);
                    if (error) {
                        window.alert(error);
                        return;
                    }
                    if (!doubledSummary) {
                        window.alert(t('training.adDoubleFailed'));
                        return;
                    }
                    setSummary(doubledSummary);
                })
                .finally(() => setAdDoublePending(false));
        };

        showShopAdRewardInterstitial(runClaim, {
            placementName: `pair-training-ad-double-${claimId}`,
            onDismissed: () => window.alert(t('common:ads.dismissedNoReward')),
        });
    };

    /** 수령 완료 후 재수련 — 선행 수령 확정 후 UI 즉시 반영, START만 백그라운드 */
    const handleTrainAgain = () => {
        if (trainAgainInFlightRef.current) return;
        const user = currentUserWithStatus;
        if (!user) return;

        trainAgainInFlightRef.current = true;
        setTrainAgainBusy(true);

        void (async () => {
            try {
                const claimParsed = await awaitPairTrainingClaimSettled(slotIndex, {
                    petItemId: petItem.id,
                    commitClaim: () =>
                        commitClaimRef.current({
                            type: 'PAIR_PET_CLAIM_TRAINING',
                            payload: { slotIndex },
                        }),
                    getTrainingSlots: () => currentUserWithStatus?.pairPetTrainingSlots ?? user.pairPetTrainingSlots,
                });
                if (claimParsed.error) {
                    window.alert(claimParsed.error);
                    return;
                }

                const { nextSlots, prevSlotsSnapshot } = buildOptimisticPairPetTrainingStartUpdate(
                    currentUserWithStatus?.pairPetTrainingSlots ?? user.pairPetTrainingSlots,
                    slotIndex,
                    petItem.id,
                );
                flushSync(() => onCloseRef.current());
                handlers.applyDeferredUserUpdate(
                    { pairPetTrainingSlots: nextSlots },
                    'PAIR_PET_START_TRAINING-optimistic-post-claim',
                );

                // START 병합 시 client-claimed 가드가 in-progress 세션을 지우지 않도록 선제 해제
                clearPairTrainingClaimCompleted(slotIndex);

                const startRaw = await handlers.handleAction({
                    type: 'PAIR_PET_START_TRAINING',
                    payload: { slotIndex, itemId: petItem.id },
                });
                const startErr = (startRaw as { error?: string } | null)?.error;
                if (startErr) {
                    handlers.applyDeferredUserUpdate(
                        { pairPetTrainingSlots: prevSlotsSnapshot },
                        'PAIR_PET_START_TRAINING-optimistic-rollback',
                    );
                    window.alert(startErr);
                }
            } finally {
                trainAgainInFlightRef.current = false;
                setTrainAgainBusy(false);
            }
        })();
    };

    useLayoutEffect(() => {
        if (claimSummary) {
            setSummary(claimSummary);
            setPhase('done');
            if (!persistClaimOnMount) return;

            let cancelled = false;
            let inflight = pairTrainingClaimInFlightBySlotIndex.get(slotIndex);
            if (!inflight) {
                inflight = commitClaimRef.current({
                    type: 'PAIR_PET_CLAIM_TRAINING',
                    payload: { slotIndex },
                });
                registerPairTrainingClaimInflight(slotIndex, inflight);
            }

            void inflight
                .then((raw) => {
                    if (cancelled) return;
                    const { error, summary: serverSummary } = parsePairTrainingClaimResponse(raw);
                    if (error) {
                        if (error !== PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR) {
                            window.alert(error);
                            onCloseRef.current();
                        }
                        return;
                    }
                    if (!serverSummary) {
                        window.alert(t('training.rewardLoadFailed'));
                        onCloseRef.current();
                        return;
                    }
                    markPairTrainingClaimCompleted(slotIndex);
                    const coreDelta = serverSummary.pairPetLevelUpCoreBonuses;
                    if (coreDelta && Object.values(coreDelta).some((v) => typeof v === 'number' && v !== 0)) {
                        setSummary((prev) =>
                            prev ? { ...prev, pairPetLevelUpCoreBonuses: coreDelta } : serverSummary,
                        );
                    }
                });

            return () => {
                cancelled = true;
            };
        }

        setPhase('ready');
        setSummary(null);
        if (!autoClaimOnMount) return;
        let cancelled = false;

        let inflight = pairTrainingClaimInFlightBySlotIndex.get(slotIndex);
        if (!inflight) {
            inflight = commitClaimRef.current({
                type: 'PAIR_PET_CLAIM_TRAINING',
                payload: { slotIndex },
            });
            registerPairTrainingClaimInflight(slotIndex, inflight);
        }

        void inflight
            .then((raw) => {
                if (cancelled) return;
                const { error, summary: s } = parsePairTrainingClaimResponse(raw);
                if (error) {
                    if (error !== PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR) {
                        window.alert(error);
                        onCloseRef.current();
                    }
                    return;
                }
                if (!s) {
                    window.alert(t('training.rewardLoadFailed'));
                    onCloseRef.current();
                    return;
                }
                markPairTrainingClaimCompleted(slotIndex);
                setSummary(s);
                setPhase('done');
            });

        return () => {
            cancelled = true;
        };
    }, [slotIndex, petItem.id, claimSummary, autoClaimOnMount, persistClaimOnMount]);

    const soulMat = summary?.soulDrop
        ? MATERIAL_ITEMS[summary.soulDrop.materialName as keyof typeof MATERIAL_ITEMS]
        : undefined;

    /** 특화 골드 추가분: `goldFromSpecialization`가 없거나 0이어도 `goldBase`·`goldGain`으로 복구 */
    const goldRollBase = summary && typeof summary.goldBase === 'number' ? summary.goldBase : undefined;
    const trainingGoldSpecBonus = summary
        ? typeof summary.goldFromSpecialization === 'number' && summary.goldFromSpecialization > 0
            ? summary.goldFromSpecialization
            : goldRollBase != null
              ? Math.max(0, summary.goldGain - goldRollBase)
              : 0
        : 0;
    const trainingGoldBaseForUi =
        summary && trainingGoldSpecBonus > 0
            ? goldRollBase != null
                ? goldRollBase
                : Math.max(0, summary.goldGain - trainingGoldSpecBonus)
            : summary?.goldGain ?? 0;

    /** 펫 XP: `xpFromSpecialization` 키가 빠져도 롤 기준값(`xpBase`)과 총 획득으로 특화분 표시 */
    const totalPetXpGain =
        summary?.pairPetXp != null
            ? summary.pairPetXp.change
            : typeof summary?.xpGain === 'number'
              ? summary.xpGain
              : undefined;
    const xpRollBase = summary && typeof summary.xpBase === 'number' ? summary.xpBase : undefined;
    const petXpSpecSplitForUi =
        summary && xpRollBase != null && typeof totalPetXpGain === 'number'
            ? { base: xpRollBase, spec: Math.max(0, totalPetXpGain - xpRollBase) }
            : undefined;

    const showPetGradeUpgradeInsteadOfXp = Boolean(
        summary &&
            pairPetShowsGradeUpgradeNeededInsteadOfXp({
                grade: effectivePairPetGradeFromRow(petItem),
                petFinalLevel: summary.pairPetLevel?.final,
                xpChange: summary.pairPetXp?.change,
            }),
    );
    const canClaimAdDouble = Boolean(
        summary?.adDoubleClaimId &&
            !summary.adDoubled &&
            ((summary.goldGain ?? 0) > 0 ||
                (summary.pairPetXp?.change ?? summary.xpGain ?? 0) > 0 ||
                (summary.soulDrop?.quantity ?? 0) > 0),
    );

    return (
        <DraggableWindow
            title={phase === 'ready' ? t('training.rewardTitle') : t('training.completeTitle')}
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
                            src={phase === 'ready' ? petItem.image : (summary?.petImage ?? petItem.image)}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                            loading="lazy"
                        />
                    </div>

                    {phase === 'ready' && autoClaimOnMount ? (
                        <div className="mx-auto flex min-h-[5.5rem] max-w-sm flex-col items-center justify-center gap-1.5 py-2 sm:min-h-[6.5rem] sm:gap-2">
                            <p className="text-center text-xs font-bold leading-snug text-fuchsia-100/90 sm:text-base sm:leading-snug">
                                {t('training.preparingReturn')}
                            </p>
                            <p className="text-[0.65rem] font-medium text-slate-500 sm:text-xs">{t('training.pleaseWait')}</p>
                        </div>
                    ) : phase === 'ready' ? (
                        <>
                            <h3 className="text-sm font-bold leading-snug text-fuchsia-50 sm:text-lg sm:font-black">
                                <span className="text-white/95">{(petItem.name ?? t('pet.defaultName')).replace(/\s+/g, ' ')}</span>
                                <br />
                                <span className="text-fuchsia-200/90 sm:text-fuchsia-200/95">{t('training.claimPrompt')}</span>
                            </h3>
                            <div className="mx-auto mt-4 flex w-full max-w-sm flex-row items-stretch justify-center gap-2 sm:mt-5 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isBusy}
                                    className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-45 sm:min-w-[8rem] sm:flex-none sm:px-5 sm:py-2.5 sm:text-sm"
                                >
                                    {tCommon('actions.close')}
                                </button>
                                <Button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleClaim()}
                                    colorScheme="none"
                                    className="min-w-0 flex-1 !rounded-full !border !border-fuchsia-400/50 !bg-gradient-to-r !from-fuchsia-600 !via-fuchsia-500 !to-violet-600 !px-3 !py-2 !text-xs !font-bold !text-white !shadow-[0_6px_20px_rgba(192,38,211,0.35),inset_0_1px_0_rgba(255,255,255,0.16)] hover:!from-fuchsia-500 hover:!via-fuchsia-400 hover:!to-violet-500 disabled:!opacity-40 sm:!min-w-[8rem] sm:!flex-none sm:!px-6 sm:!py-2.5 sm:!text-sm sm:!font-black sm:!shadow-[0_8px_26px_rgba(192,38,211,0.4),inset_0_1px_0_rgba(255,255,255,0.18)]"
                                >
                                    {t('training.claimReward')}
                                </Button>
                            </div>
                        </>
                    ) : summary ? (
                        <>
                            <div className="mx-auto w-full max-w-md">
                                <h3 className="text-sm font-bold tracking-tight text-fuchsia-50 sm:text-lg sm:font-black">
                                    {summary.petDisplayName ?? petItem.name}
                                </h3>
                                <p className="mt-0.5 text-[0.65rem] font-medium tracking-wide text-slate-500 sm:mt-1 sm:text-sm sm:font-semibold sm:text-slate-400">
                                    {t('training.rewardGranted')}
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
                                                            ? t('training.petXpBaseSpec', {
                                                                  base: petXpSpecSplitForUi.base.toLocaleString(),
                                                                  spec: petXpSpecSplitForUi.spec.toLocaleString(),
                                                              })
                                                            : t('training.petXpGain', {
                                                                  amount: summary.pairPetXp.change.toLocaleString(),
                                                              })
                                                        : t('training.petXpNoChange')
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
                                                {t('game:summary.petGradeUpgradeNeeded')}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mx-auto mt-3 w-full max-w-md space-y-2 sm:mt-4">
                                        <div className="rounded-xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-950/40 via-zinc-950/30 to-black/40 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-3 sm:py-2.5">
                                            <p className="mb-1.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.14em] text-fuchsia-200/90 sm:mb-2 sm:text-xs sm:font-black sm:tracking-tight sm:normal-case">
                                                {t('training.petGrowth')}
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
                                            title={t('game:summary.addedStats')}
                                            compact={compactRewards}
                                            className="mx-auto w-full max-w-md"
                                        />
                                    </div>
                                )
                            ) : null}

                            {canClaimAdDouble ? (
                                <div className="mx-auto mt-3 flex w-full max-w-sm justify-center sm:mt-4">
                                    <button
                                        type="button"
                                        disabled={adDoublePending || isBusy}
                                        onClick={handleAdDoubleClaim}
                                        className="min-h-[38px] w-full rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-xs font-black text-slate-950 shadow-[0_10px_28px_-14px_rgba(251,191,36,0.9)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70 sm:text-sm"
                                    >
                                        {adDoublePending
                                            ? t('training.adDoubleClaiming')
                                            : isAdFree
                                              ? t('training.adDoubleAdFree')
                                              : t('training.adDoubleButton')}
                                    </button>
                                </div>
                            ) : summary.adDoubled ? (
                                <p className="mx-auto mt-3 max-w-sm rounded-full border border-emerald-400/25 bg-emerald-950/30 px-3 py-1.5 text-center text-[0.65rem] font-bold text-emerald-200 sm:mt-4 sm:text-xs">
                                    {t('training.adDoubleClaimed')}
                                </p>
                            ) : null}

                            <div className="mx-auto mt-4 flex w-full max-w-sm flex-row items-stretch justify-center gap-2 sm:mt-5 sm:gap-3">
                                <button
                                    type="button"
                                    disabled={trainAgainBusy || isBusy}
                                    onClick={() => void handleTrainAgain()}
                                    className="min-w-0 flex-1 rounded-xl border border-violet-400/45 bg-violet-950/35 px-2 py-2 text-[0.65rem] font-bold leading-snug text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-300/55 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:py-2.5 sm:text-sm sm:font-black"
                                >
                                    {trainAgainBusy ? t('training.trainAgainBusy') : t('training.trainAgain')}
                                </button>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    disabled={isBusy}
                                    className="min-w-0 flex-1 !rounded-xl !border !border-fuchsia-400/40 !bg-gradient-to-b !from-fuchsia-600/85 !via-fuchsia-800/50 !to-zinc-950/90 !py-2 !text-xs !font-bold !tracking-wide !text-fuchsia-50/95 !shadow-[0_10px_28px_rgba(0,0,0,0.35)] hover:!from-fuchsia-500 hover:!via-fuchsia-700/45 hover:!to-zinc-950 disabled:!opacity-45 sm:!py-2.5 sm:!text-sm sm:!font-black sm:!tracking-normal"
                                    onClick={onClose}
                                >
                                    {tCommon('actions.confirm')}
                                </Button>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairTrainingRewardModal;
