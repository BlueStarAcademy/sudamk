import React, { useEffect, useMemo, useState } from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import type { DetailedStatRecordSlice, DetailedStatResetScope } from '../shared/types/detailedStatReset.js';
import {
    DETAILED_STAT_RESET_SCOPE_LABELS,
    defaultDetailedStatResetScope,
    formatDetailedStatRecordLine,
    getAvailableDetailedStatResetScopes,
    hasDetailedStatRecord,
} from '../shared/utils/detailedStatResetUi.js';

const DIAMOND_ICON = '/images/icon/Zem.webp';

const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${className}`} aria-label={`다이아 ${amount.toLocaleString()}`}>
        <img src={DIAMOND_ICON} alt="" className={`object-contain ${iconClassName}`} aria-hidden />
        <span className="font-semibold">{amount.toLocaleString()}</span>
    </span>
);

export interface DetailedStatsResetConfirmModalProps {
    targetLabel: string;
    pvpRecord: DetailedStatRecordSlice;
    aiRecord: DetailedStatRecordSlice;
    ledgerCost: number;
    seasonResetNote?: string;
    onConfirm: (scope: DetailedStatResetScope) => void;
    onCancel: () => void;
    windowId?: string;
}

const DetailedStatsResetConfirmModal: React.FC<DetailedStatsResetConfirmModalProps> = ({
    targetLabel,
    pvpRecord,
    aiRecord,
    ledgerCost,
    seasonResetNote,
    onConfirm,
    onCancel,
    windowId = 'detailed-stats-reset-confirm',
}) => {
    const availableScopes = useMemo(
        () => getAvailableDetailedStatResetScopes(pvpRecord, aiRecord),
        [pvpRecord, aiRecord],
    );
    const [scope, setScope] = useState<DetailedStatResetScope>(() => defaultDetailedStatResetScope(pvpRecord, aiRecord));

    useEffect(() => {
        setScope(defaultDetailedStatResetScope(pvpRecord, aiRecord));
    }, [pvpRecord, aiRecord, targetLabel]);

    useEffect(() => {
        if (!availableScopes.includes(scope)) {
            setScope(availableScopes[0] ?? 'both');
        }
    }, [availableScopes, scope]);

    const showPvpStats = hasDetailedStatRecord(pvpRecord);
    const showAiStats = hasDetailedStatRecord(aiRecord);
    const showScopePicker = availableScopes.length > 1;

    const handleConfirm = () => {
        onCancel();
        onConfirm(scope);
    };

    return (
        <DraggableWindow
            title="전적 초기화"
            windowId={windowId}
            onClose={onCancel}
            initialWidth={420}
            shrinkHeightToContent
            modal
            closeOnOutsideClick
            isTopmost
            hideFooter
            bodyPaddingClassName="p-0"
        >
            <div className="relative space-y-3 bg-gradient-to-b from-zinc-950 via-[#12141c] to-black px-3.5 py-3 sm:px-4 sm:py-3.5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" aria-hidden />

                <div className="relative overflow-hidden rounded-xl border border-amber-400/22 bg-gradient-to-br from-amber-950/35 via-zinc-950/80 to-black/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_-20px_rgba(251,191,36,0.3)] ring-1 ring-white/[0.04]">
                    <div
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_50%_-20%,rgba(251,191,36,0.1),transparent_55%)]"
                        aria-hidden
                    />
                    <div className="relative min-w-0">
                        <p className="truncate text-sm font-bold text-amber-50">{targetLabel}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">아래 전적을 초기화합니다.</p>
                    </div>

                    <div className="relative mt-2.5 space-y-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                        {showPvpStats ? (
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="shrink-0 font-semibold text-sky-200/90">PVP</span>
                                <span className="font-bold tabular-nums text-primary">{formatDetailedStatRecordLine(pvpRecord)}</span>
                            </div>
                        ) : (
                            <p className="text-center text-[11px] text-zinc-500">기록된 PVP 전적 없음</p>
                        )}
                        {showAiStats ? (
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="shrink-0 font-semibold text-violet-200/90">AI</span>
                                <span className="font-bold tabular-nums text-primary">{formatDetailedStatRecordLine(aiRecord)}</span>
                            </div>
                        ) : (
                            <p className="text-center text-[11px] text-zinc-500">기록된 AI 전적 없음</p>
                        )}
                    </div>

                    {seasonResetNote ? (
                        <p className="relative mt-2 text-center text-[10px] leading-snug text-amber-200/70">{seasonResetNote}</p>
                    ) : null}
                </div>

                {showScopePicker ? (
                    <div className="space-y-1.5">
                        <p className="text-center text-[11px] font-semibold text-zinc-300">초기화 범위</p>
                        <div className="grid gap-1.5">
                            {availableScopes.map((option) => {
                                const selected = scope === option;
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setScope(option)}
                                        className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
                                            selected
                                                ? 'border-amber-400/55 bg-amber-950/50 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                                : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        {DETAILED_STAT_RESET_SCOPE_LABELS[option]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-[11px] text-zinc-400">{DETAILED_STAT_RESET_SCOPE_LABELS[scope]} 초기화됩니다.</p>
                )}

                <div className="flex gap-2">
                    <Button
                        onClick={onCancel}
                        colorScheme="gray"
                        className="flex-1 !rounded-lg !border !border-white/18 !bg-gradient-to-r !from-zinc-800/95 !to-zinc-900/95 !py-2 !text-xs !font-semibold !text-zinc-100 shadow-md hover:!brightness-110"
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        colorScheme="none"
                        className="flex-1 !inline-flex !flex-col !items-center !justify-center !gap-0.5 !rounded-lg !border !border-amber-400/50 !bg-gradient-to-r !from-amber-900/55 !to-zinc-900/90 !py-2 !text-xs !font-bold !text-amber-50 shadow-[0_8px_20px_-12px_rgba(251,191,36,0.45)] hover:!border-amber-300/65 hover:!from-amber-800/60 hover:!to-zinc-800/90 active:!translate-y-px"
                    >
                        <span className="text-amber-50">초기화</span>
                        <DiamondPrice amount={ledgerCost} className="text-cyan-100/95" iconClassName="h-3.5 w-3.5 min-w-[0.875rem]" />
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default DetailedStatsResetConfirmModal;
