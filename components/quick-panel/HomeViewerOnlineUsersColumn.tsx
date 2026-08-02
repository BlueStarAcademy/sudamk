import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserStatus, type UserWithStatus } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { PC_HOME_USERS_COLUMN_CLASS } from '../../shared/constants/pcShellLayout.js';
import PlayerList from '../waiting-room/PlayerList.js';

type UserScopeTab = 'friends' | 'guild';

function isLiveOnlineUser(u: UserWithStatus): boolean {
    return u.status !== UserStatus.Offline && u.status !== UserStatus.Spectating;
}

/**
 * 홈 PC 고정 열 — 입장카드/뷰어 우측.
 * 롤 스타일: 친구 / 길드원 탭만, 점수·전적은 상세보기에서만.
 */
const HomeViewerOnlineUsersColumn: React.FC = () => {
    const { t } = useTranslation('lobby');
    const { onlineUsers, currentUserWithStatus, handlers } = useAppContext();
    const [userTab, setUserTab] = useState<UserScopeTab>('friends');

    const friendSet = useMemo(
        () => new Set(currentUserWithStatus?.friendIds || []),
        [currentUserWithStatus?.friendIds],
    );
    const guildId = currentUserWithStatus?.guildId;

    const liveUsers = useMemo(() => {
        if (!currentUserWithStatus) return [] as UserWithStatus[];
        const others = onlineUsers.filter(
            (u) => u && u.id !== currentUserWithStatus.id && isLiveOnlineUser(u),
        );
        const meLive = isLiveOnlineUser(currentUserWithStatus)
            ? currentUserWithStatus
            : ({ ...currentUserWithStatus, status: UserStatus.Online } as UserWithStatus);
        return [meLive, ...others];
    }, [onlineUsers, currentUserWithStatus]);

    const scopedUsers = useMemo(() => {
        if (!currentUserWithStatus) return [] as UserWithStatus[];
        const uid = currentUserWithStatus.id;
        if (userTab === 'guild') {
            return liveUsers.filter((u) => u.id === uid || (!!guildId && u.guildId === guildId));
        }
        return liveUsers.filter((u) => u.id === uid || friendSet.has(u.id));
    }, [liveUsers, currentUserWithStatus, userTab, friendSet, guildId]);

    if (!currentUserWithStatus) return null;

    const scopeTabs = (
        <div className="grid grid-cols-2 border-b border-white/10">
            <button
                type="button"
                onClick={() => setUserTab('friends')}
                className={`relative px-2 py-2 text-center text-xs font-extrabold tracking-wide transition-colors ${
                    userTab === 'friends'
                        ? 'text-amber-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                {t('userScope.friends')}
                {userTab === 'friends' ? (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-amber-400" aria-hidden />
                ) : null}
            </button>
            <button
                type="button"
                onClick={() => setUserTab('guild')}
                className={`relative px-2 py-2 text-center text-xs font-extrabold tracking-wide transition-colors ${
                    userTab === 'guild'
                        ? 'text-amber-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                {t('userScope.guild')}
                {userTab === 'guild' ? (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-amber-400" aria-hidden />
                ) : null}
            </button>
        </div>
    );

    return (
        <aside
            className={`${PC_HOME_USERS_COLUMN_CLASS} rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-zinc-950/92 via-zinc-900/88 to-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-100/12`}
            aria-label={t('playerList.title')}
        >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 px-1 pt-1 sm:px-1.5 sm:pt-1.5">{scopeTabs}</div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-1 sm:px-1 sm:pb-1.5">
                    <PlayerList
                        users={scopedUsers}
                        mode="strategic"
                        onAction={handlers.handleAction}
                        currentUser={currentUserWithStatus}
                        onViewUser={handlers.openViewingUser}
                        lobbyType="strategic"
                        disableStatusSelect
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
