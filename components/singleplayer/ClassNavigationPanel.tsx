import React from 'react';
import { SinglePlayerLevel } from '../../types.js';

type ClassNavigationLobbyChrome = {
    onBack: () => void;
    /** 화면 제목 (예: 바둑학원) */
    screenTitle: string;
    /** 모바일: 중앙 정렬 그리드 타이틀 바 */
    compactTitleBar: boolean;
};

interface ClassNavigationPanelProps {
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel) => void;
    /** 네이티브 모바일 한 화면용 */
    compact?: boolean;
    /** 싱글플레이 로비: 하단 탭이 있을 때 상단만 차지 — 이미지·제목 높이 축소 */
    lobbyMobileTop?: boolean;
    /** 로비: 단계 선택 패널과 같은 박스 안에 뒤로가기 + 화면 제목 */
    lobbyChrome?: ClassNavigationLobbyChrome;
}

const CLASS_INFO = [
    { level: SinglePlayerLevel.입문, name: '입문반', image: '/images/single/Academy1.png' },
    { level: SinglePlayerLevel.초급, name: '초급반', image: '/images/single/Academy2.png' },
    { level: SinglePlayerLevel.중급, name: '중급반', image: '/images/single/Academy3.png' },
    { level: SinglePlayerLevel.고급, name: '고급반', image: '/images/single/Academy4.png' },
    { level: SinglePlayerLevel.유단자, name: '유단자', image: '/images/single/Academy5.png' },
];

/** `SinglePlayerLobby` 타이틀 스트립과 동일 계열 */
const lobbyTitleStripVisual =
    'rounded-xl border border-emerald-400/45 bg-black/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-2';
const lobbyTitleStripRow = `${lobbyTitleStripVisual} flex w-full shrink-0 items-center gap-2 sm:gap-2.5`;
const lobbyTitleH1Class =
    'relative z-[1] min-w-0 flex-1 truncate text-left text-base font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-200 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(52,211,153,0.2)]';

const ClassNavigationPanel: React.FC<ClassNavigationPanelProps> = ({
    selectedClass,
    onClassSelect,
    compact = false,
    lobbyMobileTop = false,
    lobbyChrome,
}) => {
    const currentIndex = CLASS_INFO.findIndex(c => c.level === selectedClass);
    const currentClass = CLASS_INFO[currentIndex];

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
    const shellClass = `flex h-full min-h-0 flex-col ${shellOverflowClass} rounded-xl border border-emerald-500/20 bg-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_28px_rgba(0,0,0,0.35)]`;
    const navBtnBase =
        'z-10 flex items-center justify-center rounded-full border-2 border-emerald-400/45 bg-gradient-to-b from-emerald-600/95 via-emerald-900 to-zinc-950 text-amber-50 shadow-[0_4px_18px_rgba(16,185,129,0.38),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-200 hover:brightness-110';
    const navBtnDisabled = 'opacity-40 cursor-not-allowed pointer-events-none grayscale';
    const navBtnActive = 'cursor-pointer hover:scale-105 active:scale-95';

    return (
        <div
            className={`${shellClass} ${
                isMobile ? 'p-1 sm:p-1.5' : lobbyChrome ? 'p-3 sm:p-4' : 'p-4'
            }`}
        >
            {lobbyChrome && (
                <>
                    {lobbyChrome.compactTitleBar ? (
                        <div className={`mb-1.5 w-full shrink-0 ${lobbyTitleStripVisual}`}>
                            <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
                                <button
                                    type="button"
                                    onClick={lobbyChrome.onBack}
                                    data-onboarding-target="onboarding-sp-lobby-back"
                                    className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center transition-transform active:scale-90 hover:drop-shadow-lg"
                                    aria-label="뒤로가기"
                                >
                                    <img src="/images/button/back.png" alt="" className="h-full w-full" />
                                </button>
                                <h1 className="truncate text-center text-sm font-bold bg-gradient-to-r from-emerald-100 to-teal-200 bg-clip-text text-transparent">
                                    {lobbyChrome.screenTitle}
                                </h1>
                                <div className="w-9 shrink-0" aria-hidden />
                            </div>
                        </div>
                    ) : (
                        <div className={`mb-3 shrink-0 ${lobbyTitleStripRow}`}>
                            <button
                                type="button"
                                onClick={lobbyChrome.onBack}
                                data-onboarding-target="onboarding-sp-lobby-back"
                                className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                                aria-label="뒤로가기"
                            >
                                <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                            </button>
                            <h1 className={lobbyTitleH1Class}>{lobbyChrome.screenTitle}</h1>
                        </div>
                    )}
                </>
            )}
            <h2
                className={`border-b border-white/10 text-center font-bold tracking-tight text-on-panel ${
                    lobbyChrome && !isMobile
                        ? 'mb-2 pb-1.5 text-base lg:text-lg'
                        : topShelf
                          ? 'mb-0.5 pb-0 text-sm'
                          : isMobile
                            ? 'mb-1 pb-0.5 text-sm'
                            : 'mb-4 pb-2 text-xl'
                }`}
            >
                단계 선택
            </h2>

            {/* 큰 이미지와 좌우 화살표 — py로 상·하 그림자/스케일 여유, 화살표는 세로 중앙 고정 */}
            <div className={`relative flex min-h-0 flex-1 items-center justify-center ${topShelf ? 'py-1.5' : isMobile ? 'py-2' : 'py-2.5'}`}>
                {/* 좌측 화살표 버튼 */}
                <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className={`
                        absolute left-0 top-1/2 z-10 -translate-y-1/2 ${isMobile ? 'h-10 w-10' : 'h-14 w-14'} ${navBtnBase}
                        ${currentIndex === 0 ? navBtnDisabled : navBtnActive}
                    `}
                    aria-label="이전 단계"
                >
                    <svg
                        className={`${isMobile ? 'h-5 w-5' : 'h-8 w-8'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* 현재 선택된 클래스 이미지 */}
                <div className={`relative flex h-full min-h-0 flex-1 flex-col items-center justify-center ${isMobile ? 'mx-11' : 'mx-16'}`}>
                    <div
                        className={`relative h-full w-full overflow-hidden rounded-xl border-2 border-emerald-400/40 shadow-[0_0_28px_rgba(16,185,129,0.2),0_6px_20px_rgba(0,0,0,0.45)] ring-1 ring-amber-400/20 ${
                            topShelf
                                ? 'max-h-[min(24dvh,200px)] min-h-[min(11dvh,92px)]'
                                : isMobile
                                  ? 'max-h-[min(58dvh,440px)] min-h-[min(32dvh,240px)]'
                                  : 'max-h-[500px]'
                        }`}
                    >
                        <img 
                            src={currentClass.image} 
                            alt={currentClass.name}
                            className="h-full w-full object-cover brightness-[1.02]"
                            onError={(e) => {
                                // Fallback if image doesn't exist
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                    parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-zinc-800/90 text-amber-100/90 font-bold ${isMobile ? 'text-lg' : 'text-2xl'}">${currentClass.name}</div>`;
                                }
                            }}
                        />
                        {/* PC·모바일 공통: 상단 단계명(반투명 패널) + 하단 진행 표시 */}
                        <div
                            className={`pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/92 via-black/45 to-transparent text-center ${
                                topShelf ? 'px-2 pb-3.5 pt-1' : isMobile ? 'px-2 pb-12 pt-2.5' : 'px-4 pb-14 pt-4'
                            }`}
                        >
                            <div className="mx-auto inline-flex items-center justify-center rounded-lg border border-amber-400/35 bg-black/55 shadow-[0_2px_14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[2px]">
                                <div
                                    className={`font-black leading-tight tracking-tight text-amber-50 [text-shadow:0_1px_0_rgba(255,255,255,0.15),0_3px_12px_rgba(0,0,0,0.95),0_0_18px_rgba(251,191,36,0.4)] ${
                                        topShelf ? 'px-2 py-0.5 text-lg' : isMobile ? 'px-3 py-1 text-2xl' : 'px-4 py-1.5 text-3xl lg:text-4xl'
                                    }`}
                                >
                                    {currentClass.name}
                                </div>
                            </div>
                        </div>
                        <div
                            className={`pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/88 via-black/55 to-transparent text-center ${isMobile ? 'px-2 py-2' : 'px-4 py-3'}`}
                        >
                            <div
                                className={`font-semibold tabular-nums text-amber-100/90 ${topShelf ? 'text-[11px]' : isMobile ? 'text-xs' : 'text-sm'}`}
                            >
                                {currentIndex + 1} / {CLASS_INFO.length}
                            </div>
                        </div>
                    </div>
                    
                    {/* 하단 클래스 선택 인디케이터 — 하단 클리핑 여유 */}
                    <div className={`flex shrink-0 flex-wrap justify-center gap-1 ${isMobile ? 'mt-1 pb-0.5' : 'mt-3 pb-1'}`}>
                        {CLASS_INFO.map((classInfo, index) => {
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
                                    aria-label={classInfo.name}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* 우측 화살표 버튼 */}
                <button
                    onClick={handleNext}
                    disabled={currentIndex === CLASS_INFO.length - 1}
                    className={`
                        absolute right-0 top-1/2 z-10 -translate-y-1/2 ${isMobile ? 'h-10 w-10' : 'h-14 w-14'} ${navBtnBase}
                        ${currentIndex === CLASS_INFO.length - 1 ? navBtnDisabled : navBtnActive}
                    `}
                    aria-label="다음 단계"
                >
                    <svg
                        className={`${isMobile ? 'h-5 w-5' : 'h-8 w-8'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default ClassNavigationPanel;

