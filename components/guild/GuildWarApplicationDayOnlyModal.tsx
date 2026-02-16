import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

interface GuildWarApplicationDayOnlyModalProps {
    onClose: () => void;
    nextApplicationDayLabel: string;
}

const GuildWarApplicationDayOnlyModal: React.FC<GuildWarApplicationDayOnlyModalProps> = ({ onClose, nextApplicationDayLabel }) => {
    return (
        <DraggableWindow
            title="길드 전쟁 참여 신청"
            onClose={onClose}
            windowId="guild-war-application-day-only-modal"
            initialWidth={440}
            initialHeight={320}
        >
            <div className="flex flex-col h-full min-h-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-amber-500/5 to-stone-500/10 pointer-events-none rounded-b-xl" />
                <div className="relative z-10 flex flex-col items-center flex-1 min-h-0 p-6">
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-amber-900/50 border-2 border-amber-500/40 flex items-center justify-center mb-4">
                        <span className="text-3xl">📅</span>
                    </div>
                    <h2 className="flex-shrink-0 text-lg font-bold text-amber-100 mb-3">신청 가능한 날이 아닙니다</h2>
                    <div className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center justify-center text-center">
                        <p className="text-stone-200 text-sm leading-relaxed mb-2">
                            길드 전쟁 참여 신청은 <strong className="text-amber-200">월요일</strong>과 <strong className="text-amber-200">목요일</strong>에만 가능합니다.
                        </p>
                        <p className="text-stone-300 text-sm">
                            다른 요일에는 참여 신청을 할 수 없습니다.
                        </p>
                        <p className="text-amber-200/90 text-sm font-medium mt-4">
                            다음 신청 가능일: {nextApplicationDayLabel} (KST)
                        </p>
                    </div>
                    <div className="flex-shrink-0 w-full mt-6">
                        <Button
                            onClick={onClose}
                            className="w-full py-3 font-bold border-2 border-amber-500/60 bg-gradient-to-r from-amber-600/95 via-orange-600/95 to-amber-600/95 text-white shadow-lg hover:shadow-xl"
                        >
                            확인
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildWarApplicationDayOnlyModal;
