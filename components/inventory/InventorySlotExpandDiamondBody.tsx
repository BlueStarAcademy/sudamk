import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';

export interface InventorySlotExpandDiamondBodyProps {
    eyebrow: string;
    question: string;
    currentSlots: number;
    nextSlots: number;
    /** 슬롯 칩 아래 보조 한 줄(예: +N칸 추가). 없으면 생략 */
    slotsHint?: React.ReactNode;
    diamondCost: number;
    hasEnoughDiamonds: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    /** 펫 로비 등에서 로딩 중 비활성 */
    confirmDisabled?: boolean;
}

/**
 * 가방 확장 / 페어 펫·알 로비 인벤 확장 등 다이아로 슬롯을 늘리는 확인 UI 공통 본문.
 */
const InventorySlotExpandDiamondBody: React.FC<InventorySlotExpandDiamondBodyProps> = ({
    eyebrow,
    question,
    currentSlots,
    nextSlots,
    slotsHint,
    diamondCost,
    hasEnoughDiamonds,
    onCancel,
    onConfirm,
    confirmDisabled = false,
}) => {
    const { t } = useTranslation(['inventory', 'common']);
    return (
        <div className="relative flex flex-col overflow-hidden rounded-b-[inherit] bg-gradient-to-b from-amber-950/25 via-stone-950 to-zinc-950 px-4 pb-3 pt-2 sm:px-5 sm:pb-4 sm:pt-2">
            <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-amber-500/12 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -right-16 bottom-24 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/20 to-transparent"
                aria-hidden
            />

            <div className="relative mx-auto flex w-full max-w-[22rem] flex-col gap-2">
                <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/55">{eyebrow}</p>
                    <p className="mt-1 text-balance text-base font-bold leading-snug text-amber-50/95 sm:text-lg">{question}</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 via-stone-900/75 to-stone-950/95 p-3 shadow-[0_20px_50px_-28px_rgba(16,185,129,0.45)] ring-1 ring-inset ring-white/[0.06] sm:p-4">
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-on-panel">
                        <span className="rounded-lg border border-stone-600/50 bg-stone-900/70 px-3 py-1.5 font-mono text-sm font-bold tabular-nums text-stone-400 shadow-inner sm:text-base">
                            {t('labels.slotCount', { count: currentSlots })}
                        </span>
                        <span className="text-lg font-black text-emerald-500/70 sm:text-xl" aria-hidden>
                            →
                        </span>
                        <span className="rounded-lg border border-emerald-400/35 bg-emerald-950/40 px-3 py-1.5 font-mono text-sm font-bold tabular-nums text-emerald-200 shadow-[0_0_24px_-8px_rgba(52,211,153,0.5)] sm:text-base">
                            {t('labels.slotCount', { count: nextSlots })}
                        </span>
                        {slotsHint ? (
                            <span className="w-full text-center text-xs font-semibold text-emerald-400/90 sm:w-auto sm:text-sm">{slotsHint}</span>
                        ) : null}
                    </div>
                </div>

                <div
                    className={`rounded-2xl border p-3 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.05] sm:p-3.5 ${
                        hasEnoughDiamonds
                            ? 'border-cyan-400/35 bg-gradient-to-br from-sky-950/40 via-stone-900/80 to-indigo-950/30'
                            : 'border-rose-500/40 bg-gradient-to-br from-rose-950/35 via-stone-900/80 to-stone-950'
                    }`}
                >
                    <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-stone-400">{t('labels.requiredDiamonds')}</p>
                    <div className="flex items-center justify-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 shadow-inner">
                            <img src="/images/icon/Zem.webp" alt="" className="h-6 w-6 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.45)]" />
                        </div>
                        <span
                            className={`font-mono text-xl font-black tabular-nums tracking-tight sm:text-[1.5rem] ${
                                hasEnoughDiamonds ? 'text-cyan-100' : 'text-rose-200'
                            }`}
                        >
                            {diamondCost.toLocaleString()}
                        </span>
                    </div>
                    {!hasEnoughDiamonds ? <p className="mt-3 text-center text-xs font-medium text-rose-300/95">{t('labels.insufficientDiamondsShort')}</p> : null}
                </div>

                <div className="flex flex-wrap items-stretch justify-center gap-2.5 pb-0.5 pt-0.5">
                    <Button
                        onClick={onCancel}
                        colorScheme="none"
                        className="min-h-[2.75rem] min-w-[6.5rem] rounded-xl border-2 border-stone-500/45 bg-gradient-to-b from-stone-700/90 to-stone-900/95 px-5 py-2.5 text-sm font-bold text-stone-100 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] transition hover:border-stone-400/55 hover:brightness-110 active:scale-[0.99]"
                    >
                        {t('common:actions.cancel')}
                    </Button>
                    <ResourceActionButton
                        onClick={onConfirm}
                        disabled={!hasEnoughDiamonds || confirmDisabled}
                        variant="diamonds"
                        className="!w-auto min-h-[2.75rem] min-w-[9.5rem] !rounded-xl !border-2 !px-5 !py-2.5 !text-sm !font-bold !shadow-[0_12px_36px_-16px_rgba(56,189,248,0.55)]"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <span>{t('labels.expand')}</span>
                            <span className="flex items-center gap-1 opacity-95">
                                <img src="/images/icon/Zem.webp" alt="" className="h-4 w-4 object-contain" />
                                <span className="font-mono tabular-nums">{diamondCost.toLocaleString()}</span>
                            </span>
                        </span>
                    </ResourceActionButton>
                </div>
            </div>
        </div>
    );
};

export default InventorySlotExpandDiamondBody;
