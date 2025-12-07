import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import ClassNavigationPanel from './singleplayer/ClassNavigationPanel.js';
import StageGrid from './singleplayer/StageGrid.js';
import TrainingQuestPanel from './singleplayer/TrainingQuestPanel.js';
import { SinglePlayerLevel } from '../types.js';

const SinglePlayerLobby: React.FC = () => {
    const { currentUser, currentUserWithStatus } = useAppContext();
    const [selectedClass, setSelectedClass] = useState<SinglePlayerLevel>(SinglePlayerLevel.입문);
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        // Tailwind의 lg 브레이크포인트(1024px)와 정확히 일치하도록 미디어 쿼리 사용
        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const checkIsMobile = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
        
        // 초기값 설정
        setIsMobile(mediaQuery.matches);
        
        // 미디어 쿼리 리스너 등록 (모던 브라우저)
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', checkIsMobile);
            return () => mediaQuery.removeEventListener('change', checkIsMobile);
        } else {
            // 구형 브라우저 지원
            mediaQuery.addListener(checkIsMobile);
            return () => mediaQuery.removeListener(checkIsMobile);
        }
    }, []);

    const onBackToProfile = () => window.location.hash = '#/profile';

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    return (
        <div className="bg-gray-900 text-gray-100 p-2 sm:p-4 lg:p-8 w-full mx-auto flex flex-col h-full relative min-h-0">
            {/* Header */}
            <header className="flex justify-between items-center mb-3 sm:mb-4 lg:mb-6 flex-shrink-0 px-2 sm:px-0">
                <button 
                    onClick={onBackToProfile} 
                    className="transition-transform active:scale-90 filter hover:drop-shadow-lg p-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg hover:bg-gray-800"
                    aria-label="뒤로가기"
                >
                    <img src="/images/button/back.png" alt="Back" className="w-full h-full" />
                </button>
                <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-100">싱글플레이</h1>
                {/* 모바일: 사이드 메뉴 버튼, 데스크톱: 스페이서 */}
                <div className="lg:hidden absolute top-1/2 -translate-y-1/2 right-0 z-20">
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="w-11 h-12 sm:w-12 sm:h-14 bg-gradient-to-r from-accent/90 via-accent/95 to-accent/90 backdrop-blur-sm rounded-l-xl flex items-center justify-center text-white shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-accent hover:via-accent hover:to-accent hover:shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-95 transition-all duration-200 border-2 border-white/30 hover:border-white/50"
                        aria-label="메뉴 열기"
                    >
                        <span className="relative font-bold text-2xl sm:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                            {'<'}
                        </span>
                    </button>
                </div>
                <div className="hidden lg:block w-10"></div>
            </header>

            {/* Main Content */}
            {/* 모바일: 단계 선택 + 스테이지 패널만 표시 */}
            <div className="lg:hidden flex-1 flex flex-col gap-2 sm:gap-3 min-h-0 overflow-hidden">
                {/* 단계 선택 패널 */}
                <div className="flex-shrink-0 px-2 sm:px-0">
                    <ClassNavigationPanel 
                        selectedClass={selectedClass}
                        onClassSelect={setSelectedClass}
                    />
                </div>

                {/* 스테이지 패널 */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <StageGrid 
                        selectedClass={selectedClass}
                        currentUser={currentUserWithStatus}
                    />
                </div>
            </div>

            {/* 데스크톱: 기존 레이아웃 (3개 패널 모두 표시) */}
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 xl:gap-6 flex-1 min-h-0">
                {/* Left: 큰 이미지 클래스 선택 슬라이더 */}
                <div className="col-span-4 flex flex-col min-h-0">
                    <ClassNavigationPanel 
                        selectedClass={selectedClass}
                        onClassSelect={setSelectedClass}
                    />
                </div>

                {/* Center: Stage Grid - 더 넓게 */}
                <div className="col-span-5 flex flex-col min-h-0">
                    <StageGrid 
                        selectedClass={selectedClass}
                        currentUser={currentUserWithStatus}
                    />
                </div>

                {/* Right: Training Quest Panel */}
                <div className="col-span-3 flex flex-col min-h-0">
                    <TrainingQuestPanel 
                        currentUser={currentUserWithStatus}
                    />
                </div>
            </div>

            {/* 모바일 사이드 메뉴: 수련 과제 패널 */}
            <div className={`lg:hidden fixed top-0 right-0 h-full w-[320px] bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-100">수련 과제</h3>
                            <button 
                                onClick={() => setIsMobileSidebarOpen(false)} 
                                className="text-2xl font-bold text-gray-300 hover:text-white"
                                aria-label="메뉴 닫기"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-4">
                            <TrainingQuestPanel 
                                currentUser={currentUserWithStatus}
                            />
                        </div>
                    </div>
                    {/* 오버레이 */}
                    {isMobileSidebarOpen && (
                        <div 
                            className="lg:hidden fixed inset-0 bg-black/60 z-40" 
                            onClick={() => setIsMobileSidebarOpen(false)}
                        ></div>
                    )}
        </div>
    );
};

export default SinglePlayerLobby;
