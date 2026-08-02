import React from 'react';
import { useTranslation } from 'react-i18next';
import { SinglePlayerLevel, UserWithStatus } from '../../types.js';
import SinglePlayerClassBarRewardsPanel from './SinglePlayerClassBarRewardsPanel.js';

const CLASS_INFO = [
    { level: SinglePlayerLevel.입문, stageKey: 'intro' as const },
    { level: SinglePlayerLevel.초급, stageKey: 'beginner' as const },
    { level: SinglePlayerLevel.중급, stageKey: 'intermediate' as const },
    { level: SinglePlayerLevel.고급, stageKey: 'advanced' as const },
    { level: SinglePlayerLevel.유단자, stageKey: 'master' as const },
] as const;

export type SinglePlayerMapTopBarProps = {
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel) => void;
    currentUser: UserWithStatus;
};

const navBtnBase =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-300/40 bg-gradient-to-b from-sky-600/70 via-slate-900/80 to-zinc-950/85 text-sky-50 shadow-[0_3px_12px_rgba(14,165,233,0.28)] backdrop-blur-sm transition-all hover:brightness-110 sm:h-9 sm:w-9';
const navBtnDisabled = 'pointer-events-none cursor-not-allowed opacity-35 grayscale';

/** 모험 맵 위 오버레이 — 좌측 맵 선택 + 우측 상단 10/20 클리어 보상 */
const SinglePlayerMapTopBar: React.FC<SinglePlayerMapTopBarProps> = ({
    selectedClass,
    onClassSelect,
    currentUser,
}) => {
    const { t } = useTranslation(['lobby', 'profile']);
    const currentIndex = CLASS_INFO.findIndex((c) => c.level === selectedClass);
    const current = CLASS_INFO[Math.max(0, currentIndex)];
    const classLabel = t(`profile:stageLabels.${current.stageKey}`);

    return (
        <div className="flex w-full min-w-0 items-start justify-between gap-2 bg-transparent">
            <div className="flex w-[min(48%,14rem)] shrink-0 flex-col justify-center bg-transparent px-0.5 py-0.5 sm:w-[min(40%,15rem)] sm:px-1">
                <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                    <button
                        type="button"
                        onClick={() => currentIndex > 0 && onClassSelect(CLASS_INFO[currentIndex - 1].level)}
                        disabled={currentIndex <= 0}
                        className={`${navBtnBase} ${currentIndex <= 0 ? navBtnDisabled : 'active:scale-95'}`}
                        aria-label={t('singleplayer.previousClass')}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="min-w-0 flex-1 text-center">
                        <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-sky-100 [text-shadow:0_1px_6px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.55)] sm:text-[10px]">
                            {t('singleplayer.mapSelectLabel')}
                        </div>
                        <div className="truncate text-xs font-black tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.95),0_0_12px_rgba(0,0,0,0.6)] sm:text-sm">
                            {classLabel}
                            <span className="ml-1 text-[10px] font-semibold tabular-nums text-sky-50/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] sm:text-[11px]">
                                {currentIndex + 1}/{CLASS_INFO.length}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            currentIndex < CLASS_INFO.length - 1 &&
                            onClassSelect(CLASS_INFO[currentIndex + 1].level)
                        }
                        disabled={currentIndex >= CLASS_INFO.length - 1}
                        className={`${navBtnBase} ${currentIndex >= CLASS_INFO.length - 1 ? navBtnDisabled : 'active:scale-95'}`}
                        aria-label={t('singleplayer.nextClass')}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
                <div className="mt-1 flex justify-center gap-1">
                    {CLASS_INFO.map((info) => {
                        const selected = selectedClass === info.level;
                        return (
                            <button
                                key={info.level}
                                type="button"
                                onClick={() => onClassSelect(info.level)}
                                className={`rounded-full transition-all ${
                                    selected
                                        ? 'h-1.5 w-5 bg-gradient-to-b from-sky-300 to-cyan-600 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                                        : 'h-1.5 w-1.5 bg-white/55 ring-1 ring-black/40 hover:bg-white/75'
                                }`}
                                aria-label={t(`profile:stageLabels.${info.stageKey}`)}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="shrink-0 bg-transparent px-0.5 py-0.5">
                <SinglePlayerClassBarRewardsPanel
                    selectedClass={selectedClass}
                    currentUser={currentUser}
                    density="topShelf"
                />
            </div>
        </div>
    );
};

export default SinglePlayerMapTopBar;
