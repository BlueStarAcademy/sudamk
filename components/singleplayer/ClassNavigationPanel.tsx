import React from 'react';
import { useTranslation } from 'react-i18next';
import { SinglePlayerLevel, UserWithStatus } from '../../types.js';
import { getSinglePlayerInGameBackgroundUrl } from '../../utils/singlePlayerPreGameDisplay.js';
import SinglePlayerClassBarRewardsPanel from './SinglePlayerClassBarRewardsPanel.js';

/** 바둑학원 로비 — StageGrid·쉘과 맞춘 에메랄드/틸 팔레트 */
const academyStagePanelShell =
    'flex h-full min-h-0 flex-col rounded-xl border border-emerald-500/30 bg-gradient-to-br from-zinc-900/92 via-emerald-950/38 to-zinc-950/95 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.05)]';
const academyTitleStripVisual =
    'rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/55 via-zinc-900/88 to-teal-950/45 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-2.5';
const academyLobbyTitleH1Class =
    'truncate text-center font-bold bg-gradient-to-r from-emerald-200 via-teal-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(52,211,153,0.22)]';
const academySectionHeadingClass =
    'border-b border-emerald-500/20 text-center font-semibold tracking-tight bg-gradient-to-r from-emerald-200/95 to-teal-200/95 bg-clip-text text-transparent';

/** 뒤로가기 + 화면 제목 — 단계 선택 패널과 별도 상단 패널 */
export const AcademyLobbyHeaderPanel: React.FC<{
    onBack: () => void;
    title: string;
    compact?: boolean;
}> = ({ onBack, title, compact = false }) => {
    const { t } = useTranslation(['lobby', 'common']);
    return (
    <div
        className={`flex w-full shrink-0 items-center gap-2 sm:gap-2.5 ${academyTitleStripVisual} ${compact ? '!p-1.5' : ''}`}
    >
        <button
            type="button"
            onClick={onBack}
            className={`relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg ${compact ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'}`}
            aria-label={t('common:actions.back')}
        >
            <img src="/images/button/back.webp" alt="" className="h-full w-full" />
        </button>
        <h1
            className={`${academyLobbyTitleH1Class} min-w-0 flex-1 truncate text-left ${compact ? 'text-sm' : 'text-base sm:text-lg lg:text-xl'}`}
        >
            {title}
        </h1>
    </div>
    );
};

interface ClassNavigationPanelProps {
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel) => void;
    currentUser: UserWithStatus;
    /** 네이티브 모바일 한 화면용 */
    compact?: boolean;
    /** 싱글플레이 로비: 하단 탭이 있을 때 상단만 차지 — 이미지·제목 높이 축소 */
    lobbyMobileTop?: boolean;
}

const CLASS_INFO = [
    { level: SinglePlayerLevel.입문, stageKey: 'intro' as const },
    { level: SinglePlayerLevel.초급, stageKey: 'beginner' as const },
    { level: SinglePlayerLevel.중급, stageKey: 'intermediate' as const },
    { level: SinglePlayerLevel.고급, stageKey: 'advanced' as const },
    { level: SinglePlayerLevel.유단자, stageKey: 'master' as const },
] as const;

const ClassNavigationPanel: React.FC<ClassNavigationPanelProps> = ({
    selectedClass,
    onClassSelect,
    currentUser,
    compact = false,
    lobbyMobileTop = false,
}) => {
    const { t } = useTranslation(['lobby', 'profile']);
    const classLabel = (stageKey: (typeof CLASS_INFO)[number]['stageKey']) => t(`profile:stageLabels.${stageKey}`);
    const currentIndex = CLASS_INFO.findIndex(c => c.level === selectedClass);
    const currentClass = CLASS_INFO[currentIndex];
    const currentClassName = classLabel(currentClass.stageKey);

    const handlePrevious = () => {
        if (currentIndex > 0) {
            onClassSelect(CLASS_INFO[currentIndex - 1].level);
        }
    };

    const handleNext = () => {
        if (currentIndex < CLASS_INFO.length - 1) {
            onClassSelect(CLASS_INFO[currentIndex + 1].level);
        }
    };

    const isMobile = compact;
    const topShelf = isMobile && lobbyMobileTop;

    /** 모바일 로비 상단(topShelf): 높이 캡 대비 내용이 넘치면 패널 안에서만 스크롤. PC는 overflow-hidden으로 카드 유지 */
    const shellOverflowClass = topShelf ? 'overflow-x-hidden overflow-y-auto' : 'overflow-hidden';
    const shellClass = `${academyStagePanelShell} ${shellOverflowClass}`;
    const navBtnBase =
        'z-10 flex items-center justify-center rounded-full border-2 border-emerald-400/50 bg-gradient-to-b from-emerald-700/90 via-emerald-950 to-zinc-950 text-emerald-50 shadow-[0_4px_16px_rgba(16,185,129,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all duration-200 hover:brightness-110';
    const navBtnDisabled = 'opacity-40 cursor-not-allowed pointer-events-none grayscale';
    const navBtnActive = 'cursor-pointer hover:scale-105 active:scale-95';

    return (
        <div
            className={`${shellClass} ${
                topShelf ? 'p-1' : isMobile ? 'p-1 sm:p-1.5' : 'p-3 sm:p-4'
            }`}
        >
            <div
                className={`flex min-h-0 flex-1 flex-col justify-center ${topShelf ? 'gap-0.5' : isMobile ? 'gap-1.5' : 'gap-2'}`}
            >
            <h2
                className={`shrink-0 ${academySectionHeadingClass} ${
                    topShelf
                        ? 'border-emerald-500/15 pb-0 text-[11px]'
                        : isMobile
                          ? 'pb-0.5 text-sm'
                          : 'pb-2 text-xl'
                }`}
            >
                {t('singleplayer.classSelect')}
            </h2>

            <div className={`flex shrink-0 flex-col ${topShelf ? 'gap-0.5' : isMobile ? 'gap-1.5' : 'gap-2'}`}>
                {/* 단계 타이틀 + 좌우 화살표 */}
                <div
                    className={`flex shrink-0 items-center justify-center ${topShelf ? 'gap-0.5' : isMobile ? 'gap-1.5' : 'gap-2.5'}`}
                >
                    <button
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                        className={`
                            shrink-0 ${topShelf ? 'h-6 w-6' : isMobile ? 'h-9 w-9' : 'h-11 w-11'} ${navBtnBase}
                            ${currentIndex === 0 ? navBtnDisabled : navBtnActive}
                        `}
                        aria-label={t('singleplayer.previousClass')}
                    >
                        <svg
                            className={`${topShelf ? 'h-3 w-3' : isMobile ? 'h-4 w-4' : 'h-5 w-5'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div
                        className={`min-w-0 flex-1 text-center font-black leading-tight tracking-tight text-emerald-50 [text-shadow:0_1px_0_rgba(255,255,255,0.1),0_2px_10px_rgba(0,0,0,0.85),0_0_14px_rgba(52,211,153,0.32)] ${
                            topShelf ? 'text-xs' : isMobile ? 'text-xl' : 'text-2xl lg:text-3xl'
                        }`}
                    >
                        {currentClassName}
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={currentIndex === CLASS_INFO.length - 1}
                        className={`
                            shrink-0 ${topShelf ? 'h-6 w-6' : isMobile ? 'h-9 w-9' : 'h-11 w-11'} ${navBtnBase}
                            ${currentIndex === CLASS_INFO.length - 1 ? navBtnDisabled : navBtnActive}
                        `}
                        aria-label={t('singleplayer.nextClass')}
                    >
                        <svg
                            className={`${topShelf ? 'h-3 w-3' : isMobile ? 'h-4 w-4' : 'h-5 w-5'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* 단계 이미지 — 가로 전폭 */}
                <div
                    className={`relative w-full min-w-0 overflow-hidden rounded-xl border-2 border-emerald-500/35 shadow-[0_0_24px_rgba(16,185,129,0.18),0_6px_20px_rgba(0,0,0,0.45)] ring-1 ring-emerald-400/15 ${
                        topShelf
                            ? 'aspect-[16/9] max-h-[min(9dvh,76px)] sm:max-h-[min(10dvh,84px)]'
                            : isMobile
                              ? 'aspect-[16/10] max-h-[min(52dvh,380px)] min-h-[min(28dvh,200px)]'
                              : 'aspect-[16/10] min-h-[140px] max-h-[min(42dvh,320px)] lg:max-h-[360px]'
                    }`}
                >
                    <img
                        src={getSinglePlayerInGameBackgroundUrl(currentClass.level)}
                        alt={currentClassName}
                        className="h-full w-full object-cover brightness-[1.02]"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-zinc-800/90 text-amber-100/90 font-bold ${isMobile ? 'text-lg' : 'text-2xl'}">${currentClassName}</div>`;
                            }
                        }}
                    />
                    <div
                        className={`pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/88 via-black/55 to-transparent text-center ${topShelf ? 'px-1 py-0.5' : isMobile ? 'px-2 py-2' : 'px-4 py-3'}`}
                    >
                        <div
                            className={`font-semibold tabular-nums text-emerald-100/90 ${topShelf ? 'text-[10px]' : isMobile ? 'text-xs' : 'text-sm'}`}
                        >
                            {currentIndex + 1} / {CLASS_INFO.length}
                        </div>
                    </div>
                </div>

                {/* 하단 클래스 선택 인디케이터 */}
                <div className={`flex shrink-0 flex-wrap justify-center gap-0.5 ${topShelf ? 'pb-0' : 'pb-0.5'}`}>
                    {CLASS_INFO.map((classInfo) => {
                        const isSelected = selectedClass === classInfo.level;
                        return (
                            <button
                                key={classInfo.level}
                                onClick={() => onClassSelect(classInfo.level)}
                                className={`
                                    rounded-full transition-all duration-200
                                    ${
                                        isSelected
                                            ? isMobile
                                                ? 'h-2 w-5 bg-gradient-to-b from-amber-400 to-amber-700 shadow-[0_0_10px_rgba(251,191,36,0.45)] ring-1 ring-amber-300/50'
                                                : 'h-2.5 w-8 bg-gradient-to-b from-amber-400 to-amber-700 shadow-[0_0_12px_rgba(251,191,36,0.5)] ring-1 ring-amber-300/50'
                                            : `${isMobile ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'} bg-zinc-600 hover:bg-zinc-500`
                                    }
                                `}
                                aria-label={classLabel(classInfo.stageKey)}
                            />
                        );
                    })}
                </div>

                <div
                    className={`shrink-0 border-t border-emerald-500/20 ${topShelf ? 'pt-0.5' : isMobile ? 'pt-1.5' : 'pt-2'}`}
                    aria-hidden
                />

                <div className="w-full min-w-0 shrink-0">
                    <SinglePlayerClassBarRewardsPanel
                        selectedClass={selectedClass}
                        currentUser={currentUser}
                        density={topShelf ? 'topShelf' : isMobile ? 'compact' : 'desktop'}
                    />
                </div>
            </div>
            </div>
        </div>
    );
};

export default ClassNavigationPanel;

