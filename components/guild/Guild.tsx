import React, { useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
// FIX: Changed to named import as GuildDashboard is not a default export.
import { GuildDashboard } from './GuildDashboard.js';
import type { Guild as GuildType } from '../../types/index.js';

const Guild: React.FC = () => {
    // Fetched `guildDonationAnimation` from useAppContext to pass to GuildDashboard.
    // FIX: Destructure 'modals' from useAppContext to access 'guildDonationAnimation'.
    const { currentUserWithStatus, guilds, modals, handlers } = useAppContext();

    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId) return null;
        return guilds[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);
    
    // 길드가 없으면 프로필로 리다이렉트
    useEffect(() => {
        if (!currentUserWithStatus?.guildId) {
            window.location.hash = '#/profile';
        }
    }, [currentUserWithStatus?.guildId]);
    
    if (!currentUserWithStatus) {
        return <div className="flex items-center justify-center h-full">사용자 정보를 불러오는 중...</div>;
    }
    
    // 길드가 없으면 프로필로 리다이렉트
    useEffect(() => {
        if (!currentUserWithStatus?.guildId || (!myGuild && currentUserWithStatus?.guildId)) {
            // 길드 ID가 있지만 길드 정보가 없는 경우, GET_GUILD_INFO 시도
            if (currentUserWithStatus?.guildId && !myGuild) {
                const loadGuildInfo = async () => {
                    try {
                        const result: any = await handlers.handleAction({ type: 'GET_GUILD_INFO' });
                        if (result?.error) {
                            // 길드가 없으면 프로필로 리다이렉트
                            window.location.hash = '#/profile';
                        }
                    } catch (error) {
                        // 에러 발생 시 프로필로 리다이렉트
                        window.location.hash = '#/profile';
                    }
                };
                loadGuildInfo();
            } else {
                // 길드 ID가 없으면 즉시 프로필로 리다이렉트
                window.location.hash = '#/profile';
            }
        }
    }, [currentUserWithStatus?.guildId, myGuild, handlers]);
    
    if (!currentUserWithStatus?.guildId || !myGuild) {
        // 길드가 없으면 리다이렉트 중 (아무것도 표시하지 않음)
        return null;
    }

    // Pass the required `guildDonationAnimation` prop to GuildDashboard.
    // TODO: Add guildDonationAnimation state to useApp if needed
    return <GuildDashboard key={myGuild.id} guild={myGuild} guildDonationAnimation={null} />;
};

export default Guild;
