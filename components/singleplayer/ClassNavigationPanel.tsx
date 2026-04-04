import React from 'react';
import { SinglePlayerLevel } from '../../types.js';

interface ClassNavigationPanelProps {
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel) => void;
    /** 네이티브 모바일 한 화면용 */
    compact?: boolean;
}

const CLASS_INFO = [
    { level: SinglePlayerLevel.입문, name: '입문반', image: '/images/single/Academy1.png' },
    { level: SinglePlayerLevel.초급, name: '초급반', image: '/images/single/Academy2.png' },
    { level: SinglePlayerLevel.중급, name: '중급반', image: '/images/single/Academy3.png' },
    { level: SinglePlayerLevel.고급, name: '고급반', image: '/images/single/Academy4.png' },
    { level: SinglePlayerLevel.유단자, name: '유단자', image: '/images/single/Academy5.png' },
];

const ClassNavigationPanel: React.FC<ClassNavigationPanelProps> = ({ selectedClass, onClassSelect, compact = false }) => {
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

    return (
        <div className={`flex h-full flex-col rounded-lg bg-gray-800 shadow-lg ${isMobile ? 'p-1' : 'p-4'}`}>
            <h2 className={`border-b border-gray-700 text-center font-bold text-gray-200 ${isMobile ? 'mb-1 pb-0.5 text-sm' : 'mb-4 pb-2 text-xl'}`}>단계 선택</h2>
            
            {/* 큰 이미지와 좌우 화살표 */}
            <div className="flex-1 flex items-center justify-center relative">
                {/* 좌측 화살표 버튼 */}
                <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className={`
                        absolute left-0 z-10 ${isMobile ? 'h-10 w-10' : 'h-14 w-14'} rounded-full border-2 border-gray-500/80 bg-gradient-to-b from-gray-600 to-gray-800
                        shadow-[0_4px_14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110
                        flex items-center justify-center transition-all duration-200
                        ${currentIndex === 0 ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:scale-110 cursor-pointer active:scale-95'}
                    `}
                    aria-label="이전 단계"
                >
                    <svg 
                        className={`${isMobile ? 'h-5 w-5' : 'h-8 w-8'} text-gray-200`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* 현재 선택된 클래스 이미지 */}
                <div className={`relative flex h-full flex-1 flex-col items-center justify-center ${isMobile ? 'mx-11' : 'mx-16'}`}>
                    <div
                        className={`relative h-full w-full overflow-hidden rounded-lg border-2 border-purple-500/90 shadow-[0_0_24px_rgba(168,85,247,0.25)] shadow-xl ring-1 ring-purple-400/30 ${isMobile ? 'max-h-[min(58dvh,440px)] min-h-[min(32dvh,240px)]' : 'max-h-[500px]'}`}
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
                                    parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gray-700 text-gray-200 font-bold ${isMobile ? 'text-lg' : 'text-2xl'}">${currentClass.name}</div>`;
                                }
                            }}
                        />
                        {/* PC·모바일 공통: 상단 앰버 타이틀 + 하단 진행 표시 */}
                        <div
                            className={`pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/92 via-black/45 to-transparent text-center ${isMobile ? 'px-2 pb-12 pt-2.5' : 'px-4 pb-14 pt-4'}`}
                        >
                            <div
                                className={`font-black leading-tight tracking-tight text-amber-100 [text-shadow:0_1px_0_rgba(255,255,255,0.12),0_3px_12px_rgba(0,0,0,0.95),0_0_20px_rgba(251,191,36,0.35)] ${isMobile ? 'text-2xl' : 'text-3xl lg:text-4xl'}`}
                            >
                                {currentClass.name}
                            </div>
                            <div
                                className={`mt-1 font-semibold tracking-wider text-amber-200/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)] ${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}
                            >
                                바둑학원 단계
                            </div>
                        </div>
                        <div
                            className={`pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/88 via-black/55 to-transparent text-center ${isMobile ? 'px-2 py-2' : 'px-4 py-3'}`}
                        >
                            <div className={`font-semibold text-gray-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                {currentIndex + 1} / {CLASS_INFO.length}
                            </div>
                        </div>
                    </div>
                    
                    {/* 하단 클래스 선택 인디케이터 */}
                    <div className={`flex gap-1 ${isMobile ? 'mt-0.5' : 'mt-4'}`}>
                        {CLASS_INFO.map((classInfo, index) => {
                            const isSelected = selectedClass === classInfo.level;
                            return (
                                <button
                                    key={classInfo.level}
                                    onClick={() => onClassSelect(classInfo.level)}
                                    className={`
                                        ${isMobile ? 'h-1.5 w-1.5' : 'h-3 w-3'} rounded-full transition-all duration-200
                                        ${isSelected 
                                            ? `bg-purple-500 ${isMobile ? 'w-4' : 'w-8'}` 
                                            : 'bg-gray-600 hover:bg-gray-500'
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
                        absolute right-0 z-10 ${isMobile ? 'h-10 w-10' : 'h-14 w-14'} rounded-full border-2 border-gray-500/80 bg-gradient-to-b from-gray-600 to-gray-800
                        shadow-[0_4px_14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110
                        flex items-center justify-center transition-all duration-200
                        ${currentIndex === CLASS_INFO.length - 1 ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:scale-110 cursor-pointer active:scale-95'}
                    `}
                    aria-label="다음 단계"
                >
                    <svg 
                        className={`${isMobile ? 'h-5 w-5' : 'h-8 w-8'} text-gray-200`}
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

