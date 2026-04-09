import React from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { MATERIAL_ITEMS } from '../constants';

interface DisassemblyResultModalProps {
    isOpen?: boolean;
    onClose: () => void;
    result: {
        gained: { name: string; amount: number }[];
        jackpot: boolean;
        xpGained?: number;
    } | null;
    isTopmost?: boolean;
}

const DisassemblyResultModal: React.FC<DisassemblyResultModalProps> = ({ onClose, result, isTopmost }) => {
    if (!result) return null;

    return (
        <DraggableWindow
            title="분해 결과"
            onClose={onClose}
            windowId="disassemblyResult"
            isTopmost={isTopmost}
            initialWidth={440}
            shrinkHeightToContent
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            <>
                <div className="relative overflow-hidden px-4 pb-2 pt-1 text-on-panel sm:px-5 sm:pb-3 sm:pt-2">
                    <div
                        className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-amber-400/[0.09] blur-3xl"
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute -bottom-8 -left-10 h-32 w-32 rounded-full bg-emerald-500/[0.06] blur-3xl"
                        aria-hidden
                    />

                    <div className="relative text-center">
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-200/75 sm:text-[0.7rem]">
                            Blacksmith
                        </p>
                        <h3 className="mt-1 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-200/90 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-sm sm:text-[1.65rem]">
                            장비 분해 완료
                        </h3>
                    </div>

                    {result.jackpot && (
                        <div className="relative mt-4 overflow-hidden rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-950/55 via-yellow-950/40 to-amber-950/50 px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-12px_rgba(251,191,36,0.35)] ring-1 ring-inset ring-amber-300/15 sm:px-4 sm:py-3.5">
                            <div
                                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(251,191,36,0.2),transparent_65%)]"
                                aria-hidden
                            />
                            <p className="relative text-xl font-black tracking-wide text-amber-200 drop-shadow-[0_0_18px_rgba(251,191,36,0.45)] sm:text-2xl">
                                대박!
                            </p>
                            <p className="relative mt-1 text-sm font-semibold leading-snug text-amber-100/90 sm:text-base">
                                모든 재료 획득량이 <span className="font-bold text-amber-200">2배</span>였습니다
                            </p>
                        </div>
                    )}

                    <div className="sudamr-modal-inner-well relative mt-4 max-h-[min(50vh,16rem)] overflow-y-auto rounded-xl border border-amber-500/18 p-3 shadow-inner ring-1 ring-inset ring-white/[0.04] sm:max-h-[min(52vh,18rem)] sm:p-3.5">
                        <p className="mb-2.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-amber-200/80">획득 재료</p>
                        {result.gained.length > 0 ? (
                            <ul className="space-y-0">
                                {result.gained.map((material, index) => {
                                    const template = MATERIAL_ITEMS[material.name as keyof typeof MATERIAL_ITEMS];
                                    return (
                                        <li
                                            key={`${material.name}-${index}`}
                                            className="flex items-center justify-between gap-3 border-b border-amber-500/[0.1] py-2.5 last:border-b-0"
                                        >
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-black/35 p-1 shadow-inner ring-1 ring-inset ring-white/[0.04]">
                                                    {template?.image ? (
                                                        <img
                                                            src={template.image}
                                                            alt=""
                                                            className="max-h-full max-w-full object-contain drop-shadow-md"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-amber-100/50">?</span>
                                                    )}
                                                </span>
                                                <span className="truncate text-sm font-semibold text-white/95">{material.name}</span>
                                            </span>
                                            <span className="flex-shrink-0 tabular-nums text-sm font-bold text-emerald-300/95">
                                                ×{material.amount.toLocaleString()}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="py-2 text-center text-sm font-medium text-slate-400">획득한 재료가 없습니다</p>
                        )}
                    </div>

                    {result.xpGained !== undefined && result.xpGained > 0 && (
                        <div className="relative mt-3 overflow-hidden rounded-xl border border-amber-500/22 bg-gradient-to-r from-zinc-950/80 via-zinc-900/70 to-zinc-950/80 px-3 py-2.5 shadow-inner ring-1 ring-inset ring-white/[0.04] sm:px-4">
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm font-semibold text-amber-100/90">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/25 bg-black/40 p-1">
                                        <img src="/images/equipments/moru.png" alt="" className="h-6 w-6 object-contain" />
                                    </span>
                                    대장간 경험치
                                </span>
                                <span className="text-base font-black tabular-nums text-orange-300">
                                    +{result.xpGained.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex justify-center border-t border-amber-500/25 bg-gradient-to-t from-[#0c0a10] via-[#14111c] to-transparent px-4 pb-4 pt-3`}>
                    <Button onClick={onClose} colorScheme="accent" className="min-h-[3rem] w-full max-w-xs !px-8 !text-zinc-950">
                        확인
                    </Button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default DisassemblyResultModal;
