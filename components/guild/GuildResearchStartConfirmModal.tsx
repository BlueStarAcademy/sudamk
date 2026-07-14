import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

import type { GuildResearchId } from '../../types/index.js';

export interface GuildResearchStartConfirmPayload {
    researchId: GuildResearchId;
    name: string;
    image: string;
    level: number;
    cost: number;
    timeLabel: string;
}

interface GuildResearchStartConfirmModalProps {
    payload: GuildResearchStartConfirmPayload;
    onClose: () => void;
    onConfirm: () => void;
}

const GuildResearchStartConfirmModal: React.FC<GuildResearchStartConfirmModalProps> = ({
    payload,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation(['guild', 'common']);

    const handleConfirm = () => {
        onClose();
        onConfirm();
    };

    return (
        <DraggableWindow
            title={t('research.startResearch')}
            onClose={onClose}
            windowId="guild-research-start-confirm"
            initialWidth={440}
            shrinkHeightToContent
            modal
            closeOnOutsideClick
            isTopmost
            hideFooter
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightVh={90}
        >
            <div className="relative overflow-hidden">
                <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_10%_0%,rgba(217,70,239,0.2),transparent_50%),radial-gradient(70%_60%_at_100%_100%,rgba(45,212,191,0.16),transparent_55%),linear-gradient(145deg,rgba(8,6,20,0.98),rgba(22,18,40,0.96))]"
                    aria-hidden
                />
                <div className="relative z-10 space-y-4 p-5 sm:p-6">
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-950/50 via-violet-950/40 to-cyan-950/45 p-4 shadow-[0_16px_36px_-24px_rgba(217,70,239,0.55)]">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-fuchsia-300/35 bg-gradient-to-br from-fuchsia-600/20 via-violet-700/15 to-cyan-600/15">
                            <img src={payload.image} alt="" className="h-12 w-12 object-contain" />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-bold text-fuchsia-100">{payload.name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-amber-200/90">Lv {payload.level}</p>
                        </div>
                        <p className="text-center text-sm leading-relaxed text-violet-100/90">
                            {t('research.startConfirmQuestion', {
                                name: payload.name,
                                level: payload.level,
                                defaultValue: 'Start level {{level}} research for [{{name}}]?',
                            })}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-amber-400/30 bg-amber-950/30 px-3 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/60">
                                {t('research.points')}
                            </p>
                            <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-200">
                                {payload.cost.toLocaleString()} RP
                            </p>
                        </div>
                        <div className="rounded-lg border border-cyan-400/30 bg-cyan-950/30 px-3 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/60">
                                {t('research.time')}
                            </p>
                            <p className="mt-0.5 text-sm font-bold tabular-nums text-cyan-100">{payload.timeLabel}</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={onClose}
                            colorScheme="gray"
                            className="flex-1 !rounded-xl !border !border-white/18 !bg-gradient-to-r !from-zinc-800/95 !to-zinc-900/95 !py-2.5 !text-sm !font-semibold !text-zinc-100"
                        >
                            {t('actions.cancel', { ns: 'common' })}
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            colorScheme="green"
                            className="flex-1 !rounded-xl !border !border-emerald-400/45 !bg-gradient-to-r !from-emerald-600/95 via-teal-600/95 !to-emerald-700/95 !py-2.5 !text-sm !font-bold text-white shadow-[0_14px_36px_-18px_rgba(16,185,129,0.55)]"
                        >
                            {t('research.startResearch')}
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildResearchStartConfirmModal;
