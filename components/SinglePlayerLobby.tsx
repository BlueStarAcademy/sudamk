import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import ClassNavigationPanel from './singleplayer/ClassNavigationPanel.js';
import StageGrid from './singleplayer/StageGrid.js';
import TrainingQuestPanel from './singleplayer/TrainingQuestPanel.js';
import { SinglePlayerLevel } from '../types.js';

const SinglePlayerLobby: React.FC = () => {
    const { currentUser, currentUserWithStatus } = useAppContext();
    const [selectedClass, setSelectedClass] = useState<SinglePlayerLevel>(SinglePlayerLevel.입문);

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
                <div className="w-10"></div>
            </header>

            <div className="grid grid-cols-12 gap-4 xl:gap-6 flex-1 min-h-0">
                <div className="col-span-4 flex flex-col min-h-0">
                    <ClassNavigationPanel 
                        selectedClass={selectedClass}
                        onClassSelect={setSelectedClass}
                    />
                </div>

                <div className="col-span-5 flex flex-col min-h-0">
                    <StageGrid 
                        selectedClass={selectedClass}
                        currentUser={currentUserWithStatus}
                    />
                </div>
                <div className="col-span-3 flex flex-col min-h-0">
                    <TrainingQuestPanel 
                        currentUser={currentUserWithStatus}
                    />
                </div>
            </div>
        </div>
    );
};

export default SinglePlayerLobby;
