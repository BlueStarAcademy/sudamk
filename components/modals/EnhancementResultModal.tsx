import React, { useMemo, useState, useEffect } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from '../DraggableWindow.js';
import Button from '../Button.js';
import { InventoryItem, ItemGrade } from '../../types.js';
import { gradeBackgrounds, gradeStyles } from '../../constants/items';

interface EnhancementResultModalProps {
    result: {
        message: string;
        success: boolean;
        itemBefore: InventoryItem;
        itemAfter: InventoryItem;
        xpGained?: number;
        isRolling?: boolean;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: 'prism-text-effect' };
    }
    if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: 'text-purple-400' };
    }
    if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: 'text-amber-400' };
    }
    if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: 'text-white' };
    }
    return { text: '', colorClass: 'text-white' };
};

const ItemDisplay: React.FC<{ item: InventoryItem; label: string; dimmed?: boolean }> = ({ item, label, dimmed }) => {
    const starInfo = getStarDisplayInfo(item.stars);
    return (
        <div className={`flex flex-col items-center ${dimmed ? 'opacity-90' : ''}`}>
            <span className="mb-0.5 hidden text-[8px] font-bold uppercase tracking-wider text-stone-500 sm:mb-1 sm:block sm:text-[9px]">
                {label}
            </span>
            <div
                className={`relative mb-0.5 h-11 w-11 overflow-hidden rounded-lg border border-stone-600/60 bg-stone-950/80 shadow-inner sm:mb-2 sm:h-[4.25rem] sm:w-[4.25rem] sm:rounded-xl sm:border-2 ${
                    item.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''
                }`}
            >
                <img src={gradeBackgrounds[item.grade]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="absolute object-contain p-0.5 sm:p-1.5"
                        style={{ width: '78%', height: '78%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                    />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent py-0.5 text-center sm:py-1">
                    <span className={`text-[9px] font-bold tabular-nums sm:text-xs ${starInfo.colorClass}`}>★{item.stars}</span>
                </div>
            </div>
            <p
                className={`max-w-[3.75rem] truncate text-center text-[8px] font-bold leading-tight sm:max-w-[8.5rem] sm:text-xs md:text-sm ${gradeStyles[item.grade].color}`}
                title={item.name}
            >
                {item.name}
            </p>
        </div>
    );
};

const generateRollingValue = (min: number, max: number, isPercentage: boolean): number => {
    const range = max - min;
    const random = Math.random() * range + min;
    return isPercentage ? Math.round(random * 10) / 10 : Math.round(random);
};

const EnhancementResultModal: React.FC<EnhancementResultModalProps> = ({ result, onClose, isTopmost }) => {
    const { success, message, itemBefore, itemAfter, xpGained, isRolling } = result;
    const [rollingValues, setRollingValues] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!isRolling) {
            setRollingValues({});
            return;
        }

        const interval = setInterval(() => {
            const newValues: Record<string, number> = {};

            if (itemAfter.options?.main) {
                const main = itemAfter.options.main;
                const range = main.range || (main.isPercentage ? [0, 50] : [0, 100]);
                newValues.main = generateRollingValue(range[0], range[1], main.isPercentage);
            }

            if (itemAfter.options?.combatSubs) {
                itemAfter.options.combatSubs.forEach((sub, index) => {
                    const range = sub.range || (sub.isPercentage ? [0, 50] : [0, 100]);
                    newValues[`sub_${index}`] = generateRollingValue(range[0], range[1], sub.isPercentage);
                });
            }

            setRollingValues(newValues);
        }, 50);

        return () => clearInterval(interval);
    }, [isRolling, itemAfter]);

    const changedSubOption = useMemo(() => {
        if (!success || !itemBefore.options || !itemAfter.options) return null;

        if (itemAfter.options.combatSubs.length > itemBefore.options.combatSubs.length) {
            const newSub = itemAfter.options.combatSubs.find(
                (afterSub) =>
                    !itemBefore.options!.combatSubs.some(
                        (beforeSub) => beforeSub.type === afterSub.type && beforeSub.isPercentage === afterSub.isPercentage
                    )
            );
            return newSub ? { type: 'new' as const, option: newSub } : null;
        }

        for (const afterSub of itemAfter.options.combatSubs) {
            const beforeSub = itemBefore.options.combatSubs.find(
                (s) => s.type === afterSub.type && s.isPercentage === afterSub.isPercentage
            );
            if (!beforeSub || beforeSub.value !== afterSub.value) {
                return { type: 'upgraded' as const, before: beforeSub, after: afterSub };
            }
        }
        return null;
    }, [success, itemBefore, itemAfter]);

    const starInfoBefore = getStarDisplayInfo(itemBefore.stars);
    const starInfoAfter = getStarDisplayInfo(itemAfter.stars);

    const title = isRolling ? '제련 진행 중' : success ? '강화 성공' : '강화 실패';

    const mood = isRolling ? 'rolling' : success ? 'success' : 'fail';
    const backdropClass =
        mood === 'success'
            ? 'from-emerald-950/50 via-stone-900/95 to-stone-950'
            : mood === 'fail'
              ? 'from-rose-950/40 via-stone-900/95 to-stone-950'
              : 'from-amber-950/45 via-stone-900/95 to-stone-950';

    const headlineClass =
        mood === 'success'
            ? 'bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-transparent'
            : mood === 'fail'
              ? 'bg-gradient-to-r from-rose-200 via-orange-100 to-amber-200 bg-clip-text text-transparent'
              : 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 bg-clip-text text-transparent';

    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId="enhancementResult"
            initialWidth={540}
            initialHeight={780}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit
            hideFooter
            bodyPaddingClassName="p-2 sm:p-4"
        >
            <>
            <div
                className={`relative flex min-h-0 flex-col overflow-x-hidden overflow-y-visible bg-gradient-to-b ${backdropClass} rounded-b-xl px-0.5 pb-1 pt-0 sm:px-2 sm:pb-2 sm:pt-1`}
            >
                <div
                    className="pointer-events-none absolute -left-24 top-0 hidden h-48 w-48 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-2xl sm:block"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -right-16 bottom-20 hidden h-40 w-40 rounded-full bg-gradient-to-tl from-cyan-500/10 to-transparent blur-3xl sm:block"
                    aria-hidden
                />

                {/* PC: 창 제목과 보조 헤드라인 (이모지 히어로 제거 — 결과 본문 가독성 우선) */}
                <div className="relative hidden flex-col items-center sm:mb-2 sm:mt-1 sm:flex">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        {isRolling ? 'Processing' : success ? 'Enhancement' : 'Result'}
                    </p>
                    <h3 className={`text-2xl font-black tracking-tight sm:text-3xl ${headlineClass}`}>
                        {isRolling ? '제련 진행 중…' : success ? '강화 성공' : '강화 실패'}
                    </h3>
                </div>

                <p className="mx-auto line-clamp-3 max-h-[3.25rem] shrink-0 px-1 text-center text-xs leading-snug text-stone-300 sm:mt-1.5 sm:max-h-none sm:text-sm sm:leading-snug md:text-base">
                    {message}
                </p>

                <div className="mt-1.5 flex w-full max-w-full shrink-0 flex-row flex-nowrap items-center justify-center gap-1 sm:mt-3 sm:gap-4">
                    <div className="rounded-lg border border-stone-600/40 bg-stone-900/50 px-1 py-1 shadow-md backdrop-blur-sm sm:rounded-2xl sm:p-4 sm:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.75)]">
                        <ItemDisplay item={itemBefore} label="이전" dimmed />
                    </div>
                    <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black sm:h-12 sm:w-12 sm:text-lg ${
                            success
                                ? 'border-emerald-500/40 bg-stone-900/90 text-emerald-300 shadow-[0_0_20px_-6px_rgba(52,211,153,0.5)]'
                                : 'border-rose-500/35 bg-stone-900/90 text-rose-300'
                        }`}
                        aria-hidden
                    >
                        {success ? '→' : '×'}
                    </div>
                    <div className="rounded-lg border border-stone-600/40 bg-stone-900/50 px-1 py-1 shadow-md backdrop-blur-sm ring-0 ring-inset ring-white/5 sm:rounded-2xl sm:p-4 sm:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.75)] sm:ring-1">
                        <ItemDisplay item={itemAfter} label="결과" />
                    </div>
                </div>

                {(success || isRolling) && (
                    <div className="relative mt-1.5 flex shrink-0 flex-col overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-stone-900/90 via-stone-950/95 to-black/80 px-2 py-2 shadow-inner backdrop-blur-sm sm:mt-2.5 sm:rounded-2xl sm:px-2.5 sm:py-3">
                        <div className="pointer-events-none absolute left-0 top-0 hidden h-full w-1 bg-gradient-to-b from-amber-400/80 via-amber-500/40 to-amber-600/30 sm:block" aria-hidden />
                        <h4 className="relative z-[1] mb-1.5 border-b border-stone-700/60 pb-1.5 text-center text-sm font-bold tracking-normal text-amber-100 sm:mb-2 sm:pb-2 sm:text-base">
                            {isRolling ? '제련 진행 중…' : '변경 사항'}
                        </h4>
                        {/* 모든 행에 동일한 2열 그리드 → 라벨 길이와 무관하게 값 열 정렬 */}
                        <div className="relative z-[1] mx-auto w-full max-w-[min(100%,22rem)] divide-y divide-stone-800/80 text-sm text-stone-200 sm:text-[15px]">
                            <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-3 py-2 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:gap-x-3.5">
                                <span className="text-right text-xs font-semibold leading-tight tracking-tight text-amber-50/95 sm:text-sm">
                                    등급
                                </span>
                                <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-left font-mono text-xs tabular-nums text-amber-100 sm:text-sm">
                                    <span className={starInfoBefore.colorClass}>{starInfoBefore.text || '(미강화)'}</span>
                                    <span className="shrink-0 text-stone-600">→</span>
                                    <span className={starInfoAfter.colorClass}>{starInfoAfter.text}</span>
                                </span>
                            </div>
                            {itemBefore.options && itemAfter.options && (
                                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-3 py-2 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:gap-x-3.5">
                                    <span className="pt-px text-right text-xs font-semibold leading-tight tracking-tight text-amber-50/95 sm:text-sm">
                                        주옵션
                                    </span>
                                    <span className="min-w-0 text-left font-mono text-xs font-bold leading-snug tracking-tight text-amber-100 sm:text-sm sm:leading-snug">
                                        <span className="text-stone-500">{itemBefore.options.main.display}</span>
                                        <span className="mx-0.5 text-stone-600 sm:mx-1">→</span>
                                        {isRolling && rollingValues.main !== undefined ? (
                                            <span className="animate-pulse text-amber-300">
                                                {itemAfter.options.main.isPercentage
                                                    ? `${rollingValues.main.toFixed(1)}%`
                                                    : rollingValues.main}
                                            </span>
                                        ) : (
                                            <span>{itemAfter.options.main.display}</span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {changedSubOption?.type === 'new' && changedSubOption.option && (
                                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-3 py-2 text-emerald-200 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:gap-x-3.5">
                                    <span className="pt-px text-right text-xs font-semibold leading-tight tracking-tight text-emerald-300/95 sm:text-sm">
                                        부옵션 추가
                                    </span>
                                    <span className="min-w-0 text-left font-mono text-xs font-bold leading-snug tracking-tight sm:text-sm sm:leading-snug">
                                        {isRolling && changedSubOption.option
                                            ? (() => {
                                                  const subIndex =
                                                      itemAfter.options?.combatSubs.findIndex(
                                                          (s) =>
                                                              s.type === changedSubOption.option?.type &&
                                                              s.isPercentage === changedSubOption.option?.isPercentage
                                                      ) ?? -1;
                                                  const rollingValue = subIndex >= 0 ? rollingValues[`sub_${subIndex}`] : undefined;
                                                  return rollingValue !== undefined ? (
                                                      <span className="animate-pulse text-amber-300">
                                                          {changedSubOption.option.isPercentage
                                                              ? `${rollingValue.toFixed(1)}%`
                                                              : rollingValue}
                                                      </span>
                                                  ) : (
                                                      changedSubOption.option.display
                                                  );
                                              })()
                                            : changedSubOption.option.display}
                                    </span>
                                </div>
                            )}
                            {changedSubOption?.type === 'upgraded' && changedSubOption.before && (
                                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-3 py-2 text-sky-200 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:gap-x-3.5">
                                    <span className="pt-px text-right text-xs font-semibold leading-tight tracking-tight text-sky-200/95 sm:text-sm">
                                        부옵션 강화
                                    </span>
                                    <span className="min-w-0 text-left font-mono text-xs font-bold leading-snug tracking-tight sm:text-sm sm:leading-snug">
                                        <span className="text-stone-500">{changedSubOption.before.display}</span>
                                        <span className="mx-0.5 text-stone-600 sm:mx-1">→</span>
                                        {isRolling && changedSubOption.after
                                            ? (() => {
                                                  const subIndex =
                                                      itemAfter.options?.combatSubs.findIndex(
                                                          (s) =>
                                                              s.type === changedSubOption.after?.type &&
                                                              s.isPercentage === changedSubOption.after?.isPercentage
                                                      ) ?? -1;
                                                  const rollingValue = subIndex >= 0 ? rollingValues[`sub_${subIndex}`] : undefined;
                                                  return rollingValue !== undefined ? (
                                                      <span className="animate-pulse text-amber-300">
                                                          {changedSubOption.after.isPercentage
                                                              ? `${rollingValue.toFixed(1)}%`
                                                              : rollingValue}
                                                      </span>
                                                  ) : (
                                                      changedSubOption.after.display
                                                  );
                                              })()
                                            : changedSubOption.after?.display || ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {xpGained !== undefined && xpGained > 0 && (
                    <div className="relative z-[2] mt-1 flex shrink-0 justify-center sm:mt-2">
                        <div className="inline-flex max-w-[min(100%,20rem)] flex-col items-center gap-1 rounded-full border border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-stone-900/60 to-stone-950/80 px-4 py-1.5 shadow-inner sm:flex-row sm:items-center sm:gap-x-2.5 sm:gap-y-0 sm:px-5 sm:py-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-100 sm:text-sm">
                                <img src="/images/equipments/moru.png" alt="" className="h-4 w-4 shrink-0 opacity-90 sm:h-5 sm:w-5" />
                                대장간 경험치
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-amber-300 sm:text-base">
                                +{xpGained.toLocaleString()}
                            </span>
                        </div>
                    </div>
                )}

            </div>
                {!isRolling && (
                    <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} mt-2 flex justify-center px-0.5 pb-2 sm:mt-3 sm:px-2`}>
                        <Button
                            onClick={(e) => {
                                e?.stopPropagation();
                                onClose();
                            }}
                            colorScheme="none"
                            className={`w-auto min-w-[10rem] max-w-[min(100%,18rem)] shrink-0 px-8 !border-2 py-2.5 text-sm font-bold tracking-wide !shadow-lg transition hover:brightness-110 active:scale-[0.99] focus:!ring-offset-stone-900 sm:py-3 sm:text-base ${
                                success
                                    ? '!border-emerald-400/55 bg-gradient-to-r from-emerald-700/90 via-teal-700/90 to-cyan-800/90 text-white !shadow-emerald-950/50 focus:!ring-emerald-400/40'
                                    : '!border-rose-500/35 bg-gradient-to-r from-stone-700/90 via-stone-800/90 to-stone-900/90 text-stone-100 !shadow-black/50 focus:!ring-rose-400/30'
                            }`}
                        >
                            확인
                        </Button>
                    </div>
                )}
            </>
        </DraggableWindow>
    );
};

export default EnhancementResultModal;
