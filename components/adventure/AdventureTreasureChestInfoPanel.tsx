import React from 'react';
import type { AdventureTreasureUserRewardSections } from '../../shared/utils/adventureMapTreasureRewards.js';
import AdventureTreasureChestRewardSections from './AdventureTreasureChestRewardSections.js';
import Button from '../Button.js';

export type AdventureTreasureChestInfoPanelProps = {
    /** `보물상자-{지역명}` 상단 줄 — 맵 말풍선 등에서만 표시 */
    stageTitle: string;
    showInlineTitle?: boolean;
    equipmentBoxImage: string;
    /** 남은 시간 등 표시 문자열(부모에서 계산) */
    remainingLabel: string;
    mapKeysHeld: number;
    sections: AdventureTreasureUserRewardSections;
    onOpen: () => void | Promise<void>;
    openDisabled: boolean;
};

const openButtonClass =
    'group relative mx-auto min-w-[10.25rem] max-w-[14rem] overflow-hidden rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-500/35 via-amber-600/20 to-zinc-950/90 px-5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 enabled:hover:border-amber-300/75 enabled:hover:from-amber-400/45 enabled:hover:shadow-[0_12px_28px_rgba(251,191,36,0.18)] enabled:active:translate-y-px enabled:active:shadow-[0_4px_14px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-45 sm:px-6';

/**
 * 맵 말풍선 · 챕터 몬스터 목록 모달 · 모바일 시트 공통 — 보물상자 정보 본문
 */
const AdventureTreasureChestInfoPanel: React.FC<AdventureTreasureChestInfoPanelProps> = ({
    stageTitle,
    showInlineTitle = false,
    equipmentBoxImage,
    remainingLabel,
    mapKeysHeld,
    sections,
    onOpen,
    openDisabled,
}) => {
    return (
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
            {showInlineTitle ? (
                <p className="px-1 text-center text-base font-black tracking-tight text-amber-50 drop-shadow-sm sm:text-lg">
                    보물상자-{stageTitle}
                </p>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/45 via-zinc-900/95 to-violet-950/35 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                    <div className="relative h-[5rem] w-[5rem] shrink-0 sm:h-[5.25rem] sm:w-[5.25rem]">
                        <div className="absolute inset-0 rounded-2xl bg-amber-400/15 blur-xl" aria-hidden />
                        <img
                            src={equipmentBoxImage}
                            alt=""
                            className="relative z-[1] h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
                            draggable={false}
                        />
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-base font-black tabular-nums text-amber-200 sm:text-lg">
                        <span className="text-sm opacity-80 sm:text-base" aria-hidden>
                            ⏳
                        </span>
                        {remainingLabel}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-amber-400/35 bg-black/40 px-1.5 py-0.5 text-sm font-black tabular-nums text-amber-100 sm:px-2 sm:py-1">
                        <span aria-hidden>🔑</span>
                        {mapKeysHeld}
                    </span>
                </div>
            </div>
            <AdventureTreasureChestRewardSections sections={sections} grid2x2 />
            <Button
                type="button"
                bare
                title="열쇠 1개로 보물상자 열기"
                onClick={() => void onOpen()}
                disabled={openDisabled}
                className={`${openButtonClass} mt-1 sm:mt-1.5`}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <span className="relative z-[1] flex items-center justify-center gap-2">
                    <span className="text-sm font-black tracking-wide text-amber-50 drop-shadow-sm">열기</span>
                    <span className="flex items-center gap-0.5 rounded-md border border-amber-300/45 bg-black/55 px-2 py-0.5 font-mono text-xs font-black tabular-nums text-amber-100 shadow-inner">
                        <span aria-hidden>🔑</span>
                        <span>1</span>
                    </span>
                </span>
            </Button>
        </div>
    );
};

export default AdventureTreasureChestInfoPanel;
