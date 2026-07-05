
import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { MATERIAL_ITEMS } from '../constants';
import { useLocalizedInventoryItemName } from '../shared/i18n/localizedCatalog.js';

interface CraftingResultModalProps {
    result: {
        gained: { name: string, amount: number }[];
        used: { name: string, amount: number }[];
        craftType: 'upgrade' | 'downgrade';
        jackpot?: boolean;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const CraftingResultModal: React.FC<CraftingResultModalProps> = ({ result, onClose, isTopmost }) => {
    const { t } = useTranslation(['inventory', 'common', 'blacksmith']);
    const localizedItemName = useLocalizedInventoryItemName();
    const { gained, used, craftType, jackpot } = result;
    const isJackpot = Boolean(jackpot);

    const title = isJackpot
        ? (craftType === 'upgrade' ? t('craftingResult.upgradeJackpotTitle') : t('craftingResult.downgradeJackpotTitle'))
        : (craftType === 'upgrade' ? t('craftingResult.upgradeTitle') : t('craftingResult.downgradeTitle'));
    const gainedItem = gained[0];
    const usedItem = used[0];

    const gainedTemplate = MATERIAL_ITEMS[gainedItem.name as keyof typeof MATERIAL_ITEMS];
    const usedTemplate = MATERIAL_ITEMS[usedItem.name as keyof typeof MATERIAL_ITEMS];
    const resultShellClass = isJackpot
        ? 'border-amber-300/35 bg-gradient-to-br from-amber-950/55 via-yellow-950/35 to-slate-950/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_54px_-18px_rgba(251,191,36,0.7)]'
        : 'border-emerald-300/28 bg-gradient-to-br from-emerald-950/35 via-cyan-950/24 to-slate-950/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_44px_-18px_rgba(16,185,129,0.56)]';
    const amountClass = isJackpot
        ? 'text-amber-200 drop-shadow-[0_0_14px_rgba(251,191,36,0.58)]'
        : 'text-emerald-200 drop-shadow-[0_0_12px_rgba(52,211,153,0.34)]';
    const itemCardBaseClass =
        'group relative flex min-w-0 flex-1 flex-col items-center overflow-hidden rounded-2xl border px-2.5 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-white/[0.035] sm:px-3.5 sm:py-4';
    const itemImageFrameClass =
        'relative mb-2 flex h-20 w-20 items-center justify-center rounded-2xl border bg-black/36 p-2 shadow-inner ring-1 ring-inset ring-white/[0.04] sm:h-24 sm:w-24';

    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId="crafting-result"
            initialWidth={460}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={70}
            variant="store"
            containerExtraClassName={`sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ${
                isJackpot ? 'ring-amber-300/24' : 'ring-emerald-300/18'
            }`}
        >
            <>
                <div className="relative overflow-hidden px-4 pb-3 pt-2 text-on-panel sm:px-5 sm:pb-4">
                    <div
                        className={`pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full ${
                            isJackpot ? 'bg-amber-300/[0.12]' : 'bg-emerald-300/[0.09]'
                        } blur-3xl`}
                        aria-hidden
                    />
                    <div
                        className={`pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full ${
                            isJackpot ? 'bg-orange-500/[0.1]' : 'bg-cyan-400/[0.07]'
                        } blur-3xl`}
                        aria-hidden
                    />

                    <div className="relative text-center">
                        <div
                            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border ${
                                isJackpot
                                    ? 'border-amber-200/38 bg-amber-400/[0.12] text-amber-100 shadow-[0_0_34px_-10px_rgba(251,191,36,0.84)]'
                                    : 'border-emerald-200/28 bg-emerald-400/[0.1] text-emerald-100 shadow-[0_0_28px_-12px_rgba(52,211,153,0.72)]'
                            }`}
                            aria-hidden
                        >
                            <span className={`text-2xl font-black leading-none ${isJackpot ? 'animate-pulse' : ''}`}>
                                {isJackpot ? '!' : '+'}
                            </span>
                        </div>
                        <p
                            className={`text-[0.65rem] font-bold uppercase tracking-[0.16em] ${
                                isJackpot ? 'text-amber-200/78' : 'text-emerald-200/76'
                            } sm:text-[0.7rem]`}
                        >
                            {t('blacksmith:title')}
                        </p>
                        <h3
                            className={`mt-1 bg-gradient-to-r bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-sm sm:text-[1.7rem] ${
                                isJackpot
                                    ? 'from-amber-100 via-yellow-50 to-orange-200'
                                    : 'from-emerald-100 via-cyan-50 to-emerald-200'
                            }`}
                        >
                            {title}
                        </h3>
                    </div>

                    {isJackpot ? (
                        <div className={`relative mt-4 overflow-hidden rounded-2xl border px-3 py-3.5 text-center ${resultShellClass}`}>
                            <div
                                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(251,191,36,0.22),transparent_68%)]"
                                aria-hidden
                            />
                            <div className="relative text-2xl font-black tracking-wide text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.56)] sm:text-3xl">
                                {t('craftingResult.jackpotHeading')}
                            </div>
                            <div className="relative mt-1.5 text-sm font-semibold leading-snug text-amber-100/90 sm:text-base">
                                {t('craftingResult.jackpotBody')}
                            </div>
                        </div>
                    ) : (
                        <div className={`relative mt-4 overflow-hidden rounded-2xl border px-3 py-3 text-center ${resultShellClass}`}>
                            <div
                                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgba(52,211,153,0.14),transparent_68%)]"
                                aria-hidden
                            />
                            <p className="relative text-sm font-semibold leading-relaxed text-emerald-100/90 sm:text-base">
                                {t('craftingResult.convertedBody')}
                            </p>
                        </div>
                    )}

                    <div className="relative mt-4 grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-stretch gap-2 rounded-2xl border border-white/[0.08] bg-slate-950/48 p-2.5 shadow-inner ring-1 ring-inset ring-white/[0.035] sm:gap-3 sm:p-3">
                        <div className={`${itemCardBaseClass} border-rose-300/20 bg-gradient-to-b from-rose-950/24 via-slate-900/68 to-slate-950/90`}>
                            <div
                                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-rose-200/26 to-transparent"
                                aria-hidden
                            />
                            <div className={`${itemImageFrameClass} border-rose-300/18`}>
                                {usedTemplate?.image ? (
                                    <img
                                        src={usedTemplate.image}
                                        alt={localizedItemName(usedItem.name)}
                                        className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                                    />
                                ) : (
                                    <span className="text-xs font-bold text-rose-100/45">?</span>
                                )}
                            </div>
                            <span className="block max-w-full truncate text-sm font-bold text-slate-100" title={localizedItemName(usedItem.name)}>
                                {localizedItemName(usedItem.name)}
                            </span>
                            <span className="mt-1.5 rounded-full border border-rose-300/20 bg-rose-950/42 px-2.5 py-1 text-sm font-black tabular-nums text-rose-200">
                                -{usedItem.amount.toLocaleString()}
                                {t('craftingResult.quantityUnit')}
                            </span>
                        </div>

                        <div className="flex min-w-0 items-center justify-center">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                                    isJackpot
                                        ? 'border-amber-300/40 bg-amber-400/[0.1] text-amber-100 shadow-[0_0_26px_-10px_rgba(251,191,36,0.72)]'
                                        : 'border-emerald-300/30 bg-emerald-400/[0.09] text-emerald-100 shadow-[0_0_22px_-12px_rgba(52,211,153,0.56)]'
                                }`}
                                aria-hidden
                            >
                                <span className="text-2xl font-black leading-none">→</span>
                            </div>
                        </div>

                        <div
                            className={`${itemCardBaseClass} ${
                                isJackpot
                                    ? 'border-amber-300/32 bg-gradient-to-b from-amber-900/32 via-slate-900/70 to-slate-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_32px_-18px_rgba(251,191,36,0.7)]'
                                    : 'border-emerald-300/24 bg-gradient-to-b from-emerald-950/28 via-slate-900/70 to-slate-950/90'
                            }`}
                        >
                            <div
                                className={`pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent ${
                                    isJackpot ? 'via-amber-200/38' : 'via-emerald-200/28'
                                } to-transparent`}
                                aria-hidden
                            />
                            <div
                                className={`${itemImageFrameClass} ${
                                    isJackpot
                                        ? 'border-amber-300/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_-14px_rgba(251,191,36,0.7)]'
                                        : 'border-emerald-300/22'
                                }`}
                            >
                                <div
                                    className={`pointer-events-none absolute inset-1 rounded-xl ${
                                        isJackpot ? 'bg-amber-300/[0.08]' : 'bg-emerald-300/[0.08]'
                                    } blur-md`}
                                    aria-hidden
                                />
                                {gainedTemplate?.image ? (
                                    <img
                                        src={gainedTemplate.image}
                                        alt={localizedItemName(gainedItem.name)}
                                        className="relative max-h-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.56)]"
                                    />
                                ) : (
                                    <span className="relative text-xs font-bold text-emerald-100/45">?</span>
                                )}
                            </div>
                            <span className="block max-w-full truncate text-sm font-bold text-slate-50" title={localizedItemName(gainedItem.name)}>
                                {localizedItemName(gainedItem.name)}
                            </span>
                            <span
                                className={`mt-1.5 rounded-full border px-2.5 py-1 text-sm font-black tabular-nums ${
                                    isJackpot ? 'border-amber-200/30 bg-amber-500/[0.12]' : 'border-emerald-200/24 bg-emerald-500/[0.1]'
                                } ${amountClass}`}
                            >
                                +{gainedItem.amount.toLocaleString()}
                                {t('craftingResult.quantityUnit')}
                            </span>
                        </div>
                    </div>
                </div>
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex justify-center border-t ${
                        isJackpot ? 'border-amber-500/25' : 'border-emerald-500/20'
                    } bg-gradient-to-t from-[#0c0a10] via-[#14111c] to-transparent px-4 pb-4 pt-3`}
                >
                    <Button
                        onClick={onClose}
                        colorScheme={isJackpot ? 'yellow' : 'green'}
                        className={`min-h-[3rem] w-full max-w-xs !px-8 ${
                            isJackpot
                                ? '!border-amber-200/55 !bg-gradient-to-b !from-amber-300 !via-amber-500 !to-orange-700 !text-zinc-950'
                                : '!border-emerald-200/45 !bg-gradient-to-b !from-emerald-400 !via-emerald-600 !to-emerald-900 !text-white'
                        }`}
                    >
                        {t('common:actions.ok')}
                    </Button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default CraftingResultModal;
