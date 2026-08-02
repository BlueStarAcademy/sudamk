import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserStatus, type UserWithStatus } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { PC_HOME_USERS_COLUMN_CLASS } from '../../shared/constants/pcShellLayout.js';
import {
    FRIEND_LIMIT,
    LOBBY_CHANNEL_CAPACITY,
    LOBBY_CHANNEL_MIN,
} from '../../shared/constants/lobbyChannel.js';
import { resolveLobbyChannel } from '../../shared/utils/lobbyChannel.js';
import PlayerList from '../waiting-room/PlayerList.js';

type UserScopeTab = 'channel' | 'friends' | 'guild';

function isLiveOnlineUser(u: UserWithStatus): boolean {
    return u.status !== UserStatus.Offline && u.status !== UserStatus.Spectating;
}

export type HomeViewerOnlineUsersColumnProps = {
    /** 모바일 홈 탭 등 — PC 고정 폭 대신 부모를 가득 채움 */
    fill?: boolean;
};

/**
 * 홈 PC 고정 열 — 입장카드/뷰어 우측.
 * Ch.N / 친구 / 길드원 탭 + 인원 패널. 목록은 같은 접속 채널만.
 */
const HomeViewerOnlineUsersColumn: React.FC<HomeViewerOnlineUsersColumnProps> = ({ fill = false }) => {
    const { t } = useTranslation('lobby');
    const { onlineUsers, currentUserWithStatus, handlers, guilds } = useAppContext();
    const [userTab, setUserTab] = useState<UserScopeTab>('channel');

    const myChannel = resolveLobbyChannel(currentUserWithStatus) ?? LOBBY_CHANNEL_MIN;

    const friendSet = useMemo(
        () => new Set(currentUserWithStatus?.friendIds || []),
        [currentUserWithStatus?.friendIds],
    );
    const guildId = currentUserWithStatus?.guildId;
    const guildTotalMembers = guildId ? guilds[guildId]?.members?.length ?? 0 : 0;

    useEffect(() => {
        if (!guildId || guildTotalMembers > 0) return;
        void handlers.handleAction({ type: 'GET_GUILD_INFO' });
        // handlers는 렌더마다 바뀔 수 있어 guildId·총원만 의존
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [guildId, guildTotalMembers]);

    const statusMap = useMemo(() => {
        const map: Record<string, Pick<UserWithStatus, 'status' | 'lobbyChannel'> | undefined> = {};
        for (const u of onlineUsers) {
            if (u?.id) map[u.id] = u;
        }
        if (currentUserWithStatus?.id) {
            map[currentUserWithStatus.id] = currentUserWithStatus;
        }
        return map;
    }, [onlineUsers, currentUserWithStatus]);

    const liveSameChannelUsers = useMemo(() => {
        if (!currentUserWithStatus) return [] as UserWithStatus[];
        const others = onlineUsers.filter(
            (u) =>
                u &&
                u.id !== currentUserWithStatus.id &&
                isLiveOnlineUser(u) &&
                resolveLobbyChannel(u) === myChannel,
        );
        const meLive = isLiveOnlineUser(currentUserWithStatus)
            ? { ...currentUserWithStatus, lobbyChannel: myChannel }
            : ({ ...currentUserWithStatus, status: UserStatus.Online, lobbyChannel: myChannel } as UserWithStatus);
        return [meLive, ...others];
    }, [onlineUsers, currentUserWithStatus, myChannel]);

    const scopedUsers = useMemo(() => {
        if (!currentUserWithStatus) return [] as UserWithStatus[];
        const uid = currentUserWithStatus.id;
        if (userTab === 'guild') {
            return liveSameChannelUsers.filter((u) => u.id === uid || (!!guildId && u.guildId === guildId));
        }
        if (userTab === 'friends') {
            return liveSameChannelUsers.filter((u) => u.id === uid || friendSet.has(u.id));
        }
        return liveSameChannelUsers;
    }, [liveSameChannelUsers, currentUserWithStatus, userTab, friendSet, guildId]);

    const guildOnlineSameChannel = useMemo(() => {
        if (!guildId) return 0;
        return liveSameChannelUsers.filter((u) => u.guildId === guildId).length;
    }, [liveSameChannelUsers, guildId]);

    /** 목록과 동일하게 본인을 포함한 접속 인원 — 접속자 (N/N) */
    const occupancyLabel = useMemo(() => {
        if (userTab === 'friends') {
            // 같은 채널 접속 친구 + 본인
            const friendsOnlineIncludingSelf = liveSameChannelUsers.filter(
                (u) => u.id === currentUserWithStatus?.id || friendSet.has(u.id),
            ).length;
            return t('userScope.onlineOccupancy', {
                current: friendsOnlineIncludingSelf,
                max: FRIEND_LIMIT,
            });
        }
        if (userTab === 'guild') {
            return t('userScope.onlineOccupancy', {
                current: guildOnlineSameChannel,
                max: Math.max(guildTotalMembers, 1),
            });
        }
        return t('userScope.onlineOccupancy', {
            current: liveSameChannelUsers.length,
            max: LOBBY_CHANNEL_CAPACITY,
        });
    }, [
        t,
        userTab,
        friendSet,
        currentUserWithStatus?.id,
        guildOnlineSameChannel,
        guildTotalMembers,
        liveSameChannelUsers,
    ]);

    if (!currentUserWithStatus) return null;

    const tabBtn = (id: UserScopeTab, label: string) => (
        <button
            type="button"
            onClick={() => setUserTab(id)}
            className={`relative px-1.5 py-2 text-center text-[0.7rem] font-extrabold tracking-wide transition-colors sm:px-2 sm:text-xs ${
                userTab === id ? 'text-amber-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
        >
            {label}
            {userTab === id ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-400 sm:inset-x-3" aria-hidden />
            ) : null}
        </button>
    );

    return (
        <aside
            className={`${fill ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden' : PC_HOME_USERS_COLUMN_CLASS} rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-zinc-950/92 via-zinc-900/88 to-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-100/12`}
            aria-label={t('playerList.title')}
        >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 px-1 pt-1 sm:px-1.5 sm:pt-1.5">
                    <div className="grid grid-cols-3 border-b border-white/10">
                        {tabBtn('channel', `Ch.${myChannel}`)}
                        {tabBtn('friends', t('userScope.friends'))}
                        {tabBtn('guild', t('userScope.guild'))}
                    </div>
                    <div
                        className="mt-1.5 rounded-md border border-white/10 bg-black/35 px-2 py-1.5 text-center text-[0.7rem] font-bold tabular-nums text-amber-100/90 sm:text-xs"
                        aria-live="polite"
                    >
                        {occupancyLabel}
                    </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-1 sm:px-1 sm:pb-1.5">
                    <PlayerList
                        users={scopedUsers}
                        mode="strategic"
                        onAction={handlers.handleAction}
                        currentUser={{ ...currentUserWithStatus, lobbyChannel: myChannel }}
                        onViewUser={handlers.openViewingUser}
                        lobbyType="strategic"
                        lobbyChannelStatusMap={statusMap}
                        pairAlignedNativeCompact
                        hideHeading
                        hideScoreAndRecord
                    />
                </div>
            </div>
        </aside>
    );
};

export default HomeViewerOnlineUsersColumn;
