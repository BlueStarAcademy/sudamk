import React, { useMemo } from 'react';
import { Guild as GuildType, GuildMember, GuildMission } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import DraggableWindow from '../DraggableWindow.js';
import { calculateGuildMissionXp } from '../../utils/guildUtils.js';
import { isDifferentWeekKST } from '../../utils/timeUtils.js';
import { ADMIN_USER_ID } from '../../constants/index.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';

interface GuildMissionsPanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
    onClose: () => void;
}

const MissionItem: React.FC<{ mission: GuildMission; guildLevel: number; guild: GuildType; isNativeMobile: boolean; }> = ({ mission, guildLevel, guild, isNativeMobile }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const progress = mission.progress ?? 0;
    const target = mission.target ?? 0;
    const isComplete = progress >= target;
    const percentage = target > 0 ? Math.min((progress / target) * 100, 100) : 100;
    
    const effectiveUserId = currentUserWithStatus!.isAdmin ? ADMIN_USER_ID : currentUserWithStatus!.id;
    const isClaimed = mission.claimedBy?.includes(effectiveUserId) ?? false;
    
    // 초기화 후 지난 보상은 받을 수 없도록 체크
    const now = Date.now();
    const isExpired = guild.lastMissionReset && isDifferentWeekKST(guild.lastMissionReset, now);
    const canClaim = isComplete && !isClaimed && !isExpired;

    const handleClaim = async () => {
        if (canClaim) {
            await handlers.handleAction({ type: 'GUILD_CLAIM_MISSION_REWARD', payload: { missionId: mission.id } });
            // 보상 받기 후 길드 정보 갱신
            await handlers.handleAction({ type: 'GET_GUILD_INFO' });
        }
    };
    
    const finalXp = calculateGuildMissionXp((mission.guildReward?.guildXp ?? 0), guildLevel);

    return (
        <div className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 rounded-xl flex items-center border-2 border-stone-600/60 hover:border-stone-500/80 transition-all relative overflow-hidden ${isNativeMobile ? 'p-2 gap-2' : 'p-3 gap-3'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className={`relative z-10 flex items-center w-full ${isNativeMobile ? 'gap-2' : 'gap-3'}`}>
            <div className={`bg-gradient-to-br from-stone-800/90 to-stone-900/90 rounded-lg flex items-center justify-center flex-shrink-0 border-2 border-stone-600/60 shadow-lg ${isNativeMobile ? 'w-11 h-11 text-lg' : 'w-14 h-14 text-2xl rounded-xl'}`}>
                📜
            </div>
            <div className="flex-grow min-w-0">
                <h4 className={`font-bold text-white truncate ${isNativeMobile ? 'text-[13px] mb-1' : 'text-sm mb-0.5'}`}>{mission.title}</h4>
                <div className={`w-full bg-stone-800/60 rounded-full border border-stone-700/50 ${isNativeMobile ? 'h-1.5' : 'h-2'}`}>
                    <div className={`bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all shadow-sm ${isNativeMobile ? 'h-1.5' : 'h-2'}`} style={{ width: `${percentage}%` }}></div>
                </div>
                <p className={`text-right text-stone-300 mt-1 ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>{progress.toLocaleString()} / {target.toLocaleString()}</p>
            </div>
            <div className={`text-center flex-shrink-0 flex flex-col items-center ${isNativeMobile ? 'w-[5.25rem] gap-1' : 'w-28 gap-1.5'}`}>
                <button
                    onClick={handleClaim}
                    disabled={!canClaim}
                    className={`w-full rounded-lg font-bold transition-all relative overflow-hidden group ${
                        isNativeMobile ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
                    } ${
                        canClaim
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]'
                            : isClaimed
                            ? 'bg-stone-700/50 text-stone-400 cursor-not-allowed'
                            : 'bg-stone-700/50 text-stone-400 cursor-not-allowed'
                    }`}
                >
                    {canClaim && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    )}
                    <span className="relative z-10">
                        {isExpired ? '만료됨' : (isClaimed ? '완료' : (isComplete ? '보상 받기' : '진행 중'))}
                    </span>
                </button>
                <div className={`flex items-center justify-center flex-wrap font-semibold ${isNativeMobile ? 'gap-1 text-[9px]' : 'gap-2 text-[10px]'}`}>
                    <div className="flex items-center gap-0.5">
                        <img src="/images/guild/tokken.png" alt="Guild Coin" className={isNativeMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                        <span className="text-amber-300">{mission.personalReward?.guildCoins ?? 0}</span>
                    </div>
                    <span className="text-emerald-400">XP +{finalXp.toLocaleString()}</span>
                </div>
            </div>
            </div>
        </div>
    );
};

const GuildMissionsPanel: React.FC<GuildMissionsPanelProps> = ({ guild, onClose }) => {
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);
    const now = Date.now();
    const isExpired = guild.lastMissionReset && isDifferentWeekKST(guild.lastMissionReset, now);
    
    // 초기화 전 보상 받을 내역이 있는지 확인
    const hasUnclaimedRewards = useMemo(() => {
        if (!currentUserWithStatus || !guild.weeklyMissions) return false;
        if (isExpired) return false; // 초기화된 경우 보상 받을 수 없음
        
        const effectiveUserId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
        return guild.weeklyMissions.some(mission => {
            const isComplete = (mission.progress ?? 0) >= (mission.target ?? 0);
            const isClaimed = mission.claimedBy?.includes(effectiveUserId) ?? false;
            return isComplete && !isClaimed;
        });
    }, [guild.weeklyMissions, currentUserWithStatus, isExpired]);

    return (
        <DraggableWindow
            title="주간 길드 임무"
            onClose={onClose}
            windowId="guild-missions"
            initialWidth={1000}
            initialHeight={800}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            mobileLockViewportHeight={isHandheld}
            bodyNoScroll={isHandheld}
            hideFooter={isHandheld}
            bodyPaddingClassName={isNativeMobile ? 'p-2' : undefined}
        >
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-950/50 via-neutral-900/30 to-stone-950/50 pointer-events-none"></div>
                <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
                {hasUnclaimedRewards && (
                    <div className={`flex-shrink-0 ${isNativeMobile ? 'mb-2' : 'mb-3'}`}>
                        <div className={`flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-950/40 ${isNativeMobile ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                            <span className={`bg-red-500 rounded-full animate-pulse flex-shrink-0 ${isNativeMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
                            <span className={`text-red-300 font-semibold ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>미수령 보상 있음</span>
                        </div>
                    </div>
                )}
                <div className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch] ${isNativeMobile ? 'pr-1' : 'pr-2'}`}>
                    {guild.weeklyMissions && guild.weeklyMissions.length > 0 ? (
                        <ul className="space-y-2">
                            {guild.weeklyMissions.map(mission => (
                                <li key={mission.id}>
                                    <MissionItem mission={mission} guildLevel={guild.level} guild={guild} isNativeMobile={isNativeMobile} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="h-full flex items-center justify-center text-stone-500">
                            <p>진행 가능한 임무가 없습니다.</p>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildMissionsPanel;