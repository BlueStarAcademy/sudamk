import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { formatDateTimeKST, getGuildWarTypeFromMatchTime } from '../../utils/timeUtils.js';

const GUILD_WAR_DURATION_MS = { tue_wed: 47 * 60 * 60 * 1000, fri_sun: 71 * 60 * 60 * 1000 };

interface GuildWarMatchingModalProps {
    onClose: () => void;
    message: string;
    /** 매칭 완료 시 표시할 이번 길드전 시작 시각 (KST 화/금 0시). 있으면 전쟁 기간 정보를 함께 표시 */
    warStartTime?: number;
    isTopmost?: boolean;
}

const GuildWarMatchingModal: React.FC<GuildWarMatchingModalProps> = ({ onClose, message, warStartTime, isTopmost }) => {
    const warInfo =
        warStartTime != null
            ? (() => {
                  const type = getGuildWarTypeFromMatchTime(warStartTime);
                  const warEndTime = warStartTime + GUILD_WAR_DURATION_MS[type];
                  const periodLabel = type === 'tue_wed' ? '화·수 47시간' : '금·토·일 71시간';
                  return { start: warStartTime, end: warEndTime, periodLabel };
              })()
            : null;

    return (
        <DraggableWindow 
            title="길드 전쟁 매칭" 
            onClose={onClose} 
            windowId="guild-war-matching-modal" 
            initialWidth={520} 
            initialHeight={480}
            isTopmost={isTopmost}
        >
            <div className="flex flex-col h-full min-h-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-amber-500/5 to-stone-500/10 pointer-events-none rounded-b-xl" />
                <div className="relative z-10 flex flex-col items-center flex-1 min-h-0 p-6">
                    <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br from-amber-900/60 via-orange-900/50 to-amber-900/60 border-2 border-amber-500/50 flex items-center justify-center mb-4 shadow-lg">
                        <img src="/images/guild/button/guildwar.png" alt="길드 전쟁" className="w-14 h-14 object-contain drop-shadow-xl" />
                    </div>
                    <h2 className="flex-shrink-0 text-xl font-bold text-amber-100 drop-shadow-lg mb-3">길드 전쟁 매칭</h2>
                    <div className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center justify-center gap-3">
                        <p className="text-stone-200 text-base leading-relaxed px-2 text-center">{message}</p>
                        {warInfo && (
                            <div className="w-full rounded-lg bg-stone-800/80 border border-amber-500/30 px-4 py-3 text-center">
                                <div className="text-amber-200/90 text-sm font-medium mb-1">이번 길드전 진행 기간</div>
                                <div className="text-stone-300 text-xs leading-relaxed">
                                    {formatDateTimeKST(warInfo.start)} ~ {formatDateTimeKST(warInfo.end)}
                                </div>
                                <div className="text-stone-400 text-[11px] mt-1">({warInfo.periodLabel})</div>
                            </div>
                        )}
                    </div>
                    <div className="flex-shrink-0 w-full mt-6">
                        <Button 
                            onClick={onClose} 
                            className="w-full py-3.5 font-bold border-2 border-amber-500/60 bg-gradient-to-r from-amber-600/95 via-orange-600/95 to-amber-600/95 text-white shadow-lg hover:shadow-xl hover:from-amber-500 hover:via-orange-500 hover:to-amber-500 transition-all"
                        >
                            확인
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildWarMatchingModal;

