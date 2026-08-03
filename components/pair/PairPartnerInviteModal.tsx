import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserWithStatus } from '../../types.js';
import type { ServerAction } from '../../types.js';
import PlayerList, { type PairInviteListTab } from '../waiting-room/PlayerList.js';
import { UserStatus } from '../../types.js';
import { LOBBY_CHANNEL_MIN } from '../../shared/constants/lobbyChannel.js';
import { buildLobbyChannelStatusMap, resolveLobbyChannel } from '../../shared/utils/lobbyChannel.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { getApiUrl } from '../../utils/apiConfig.js';

type Props = {
    onClose: () => void;
    currentUser: UserWithStatus;
    currentUserId: string;
    onlineUsers: UserWithStatus[];
    friendIds: string[];
    guildId?: string | null;
    cooldownUntilByInviteeId: Record<string, number>;
    onRegisterLocalCooldown: (inviteeId: string, untilMs: number) => void;
    onAction: (a: ServerAction) => void | Promise<unknown>;
    onViewUser: (userId: string) => void;
    inviteTargetSlot?: { team: 'teamA' | 'teamB'; index: 0 | 1 } | null;
};

type UserBrief = {
    nickname: string;
    avatarId?: string | null;
    borderId?: string | null;
    isAdmin?: boolean;
    blockArenaPartnerInvites?: boolean;
};

function isLiveOnlineUser(u: UserWithStatus): boolean {
    return u.status !== UserStatus.Offline && u.status !== UserStatus.Spectating;
}

function sortInviteUsers(a: UserWithStatus, b: UserWithStatus, selfId: string): number {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    const aLive = isLiveOnlineUser(a) ? 0 : 1;
    const bLive = isLiveOnlineUser(b) ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return String(a.nickname || a.id).localeCompare(String(b.nickname || b.id), 'ko');
}

const PairPartnerInviteModal: React.FC<Props> = ({
    onClose,
    currentUser,
    currentUserId,
    onlineUsers,
    friendIds,
    guildId,
    cooldownUntilByInviteeId,
    onRegisterLocalCooldown,
    onAction,
    onViewUser,
    inviteTargetSlot,
}) => {
    const { t } = useTranslation(['pair', 'common', 'lobby']);
    const { t: tCommon } = useTranslation('common');
    const { allUsers, guilds, handlers } = useAppContext();
    const [userTab, setUserTab] = useState<PairInviteListTab>('users');
    const [tick, setTick] = useState(0);
    const [briefById, setBriefById] = useState<Record<string, UserBrief>>({});

    useEffect(() => {
        const id = window.setInterval(() => setTick((n) => n + 1), 500);
        return () => window.clearInterval(id);
    }, []);

    void tick;

    const myChannel = resolveLobbyChannel(currentUser) ?? LOBBY_CHANNEL_MIN;
    const guild = guildId ? guilds[guildId] : undefined;
    const guildMembers = guild?.members ?? [];

    useEffect(() => {
        if (!guildId) return;
        if ((guild?.members?.length ?? 0) > 0) return;
        void handlers.handleAction({ type: 'GET_GUILD_INFO' });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- guildId·멤버 수만
    }, [guildId, guild?.members?.length]);

    const onlineById = useMemo(() => {
        const map = new Map<string, UserWithStatus>();
        for (const u of onlineUsers) {
            if (u?.id) map.set(u.id, u);
        }
        return map;
    }, [onlineUsers]);

    const allUsersById = useMemo(() => {
        const map = new Map<string, { id: string; nickname?: string; avatarId?: string | null; borderId?: string | null; isAdmin?: boolean; guildId?: string | null; blockArenaPartnerInvites?: boolean }>();
        for (const u of allUsers || []) {
            if (u?.id) map.set(u.id, u);
        }
        return map;
    }, [allUsers]);

    const idsNeedingBrief = useMemo(() => {
        const ids = new Set<string>();
        for (const id of friendIds) {
            if (!id || id === currentUserId) continue;
            if (onlineById.has(id)) continue;
            if (briefById[id]) continue;
            if (allUsersById.get(id)?.nickname) continue;
            ids.add(id);
        }
        for (const m of guildMembers) {
            const id = m.userId;
            if (!id || id === currentUserId) continue;
            if (onlineById.has(id)) continue;
            if (briefById[id]) continue;
            if (m.nickname) continue;
            if (allUsersById.get(id)?.nickname) continue;
            ids.add(id);
        }
        return [...ids];
    }, [friendIds, guildMembers, currentUserId, onlineById, briefById, allUsersById]);

    useEffect(() => {
        if (idsNeedingBrief.length === 0) return;
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(
                    getApiUrl(`/api/users/brief?ids=${encodeURIComponent(idsNeedingBrief.join(','))}`),
                    { signal: controller.signal },
                );
                if (!res.ok) return;
                const data = await res.json();
                if (!Array.isArray(data)) return;
                setBriefById((prev) => {
                    const next = { ...prev };
                    for (const b of data as Array<UserBrief & { id?: string }>) {
                        if (!b?.id) continue;
                        next[b.id] = {
                            nickname: b.nickname || b.id,
                            avatarId: b.avatarId,
                            borderId: b.borderId,
                            isAdmin: b.isAdmin,
                            blockArenaPartnerInvites: b.blockArenaPartnerInvites === true,
                        };
                    }
                    return next;
                });
            } catch (e) {
                if ((e as Error)?.name !== 'AbortError') {
                    console.warn('[PairPartnerInviteModal] brief fetch failed:', e);
                }
            }
        })();
        return () => controller.abort();
    }, [idsNeedingBrief]);

    const resolveDisplayUser = (userId: string, fallbackNickname?: string, forceGuildId?: string | null): UserWithStatus => {
        const live = onlineById.get(userId);
        /** onlineUsers에 있으면 접속 중 — 실제 상태 유지(관전 포함). 없을 때만 오프라인 스텁 */
        if (live) {
            return forceGuildId != null ? { ...live, guildId: forceGuildId ?? live.guildId } : live;
        }
        const cached = allUsersById.get(userId);
        const brief = briefById[userId];
        const nickname =
            fallbackNickname ||
            brief?.nickname ||
            cached?.nickname ||
            (userId === currentUserId ? currentUser.nickname : undefined) ||
            userId;
        return {
            ...(cached as object),
            id: userId,
            nickname,
            avatarId: brief?.avatarId ?? cached?.avatarId,
            borderId: brief?.borderId ?? cached?.borderId,
            isAdmin: brief?.isAdmin ?? cached?.isAdmin ?? false,
            guildId: forceGuildId ?? cached?.guildId ?? null,
            blockArenaPartnerInvites:
                brief?.blockArenaPartnerInvites === true || cached?.blockArenaPartnerInvites === true,
            status: UserStatus.Offline,
            friendIds: [],
        } as UserWithStatus;
    };

    const statusMap = useMemo(
        () =>
            buildLobbyChannelStatusMap({
                users: onlineUsers,
                viewer: currentUser,
                viewerChannel: myChannel,
            }),
        [onlineUsers, currentUser, myChannel],
    );

    /** 같은 접속 채널(Ch.N)에 있는 라이브 유저 */
    const liveSameChannelUsers = useMemo(() => {
        const others = onlineUsers.filter(
            (u) =>
                u &&
                u.id !== currentUserId &&
                isLiveOnlineUser(u) &&
                resolveLobbyChannel(u) === myChannel,
        );
        const meLive = isLiveOnlineUser(currentUser)
            ? { ...currentUser, lobbyChannel: myChannel }
            : ({ ...currentUser, status: UserStatus.Online, lobbyChannel: myChannel } as UserWithStatus);
        return [meLive, ...others];
    }, [onlineUsers, currentUser, currentUserId, myChannel]);

    const friendUsersIncludingOffline = useMemo(() => {
        const me = resolveDisplayUser(currentUserId);
        const rows = friendIds
            .filter((id) => id && id !== currentUserId)
            .map((id) => resolveDisplayUser(id));
        return [me, ...rows].sort((a, b) => sortInviteUsers(a, b, currentUserId));
        // resolveDisplayUser closes over caches; deps listed explicitly
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [friendIds, currentUserId, onlineById, allUsersById, briefById, currentUser]);

    const guildUsersIncludingOffline = useMemo(() => {
        const me = resolveDisplayUser(currentUserId, currentUser.nickname, guildId);
        if (!guildId) return [me];
        const memberIds = new Set<string>();
        const rows: UserWithStatus[] = [];
        for (const m of guildMembers) {
            if (!m.userId || m.userId === currentUserId) continue;
            if (memberIds.has(m.userId)) continue;
            memberIds.add(m.userId);
            rows.push(resolveDisplayUser(m.userId, m.nickname, guildId));
        }
        return [me, ...rows].sort((a, b) => sortInviteUsers(a, b, currentUserId));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [guildId, guildMembers, currentUserId, onlineById, allUsersById, briefById, currentUser]);

    const displayedUsers = useMemo(() => {
        if (userTab === 'friends') return friendUsersIncludingOffline;
        if (userTab === 'guild') return guildUsersIncludingOffline;
        return liveSameChannelUsers;
    }, [userTab, friendUsersIncludingOffline, guildUsersIncludingOffline, liveSameChannelUsers]);

    const mergedCooldownUntil = useMemo(
        () => ({ ...cooldownUntilByInviteeId }),
        [cooldownUntilByInviteeId, tick],
    );

    const getInviteDisabledReason = (u: UserWithStatus, _tab: PairInviteListTab): string | null => {
        if (currentUser.status === UserStatus.Resting) return t('invite.restingSelf');
        if (u.id === currentUserId) return t('invite.cannotInviteSelf');
        if (u.status === UserStatus.Offline) return t('invite.targetOffline');
        if (u.blockArenaPartnerInvites === true) return t('invite.invitesBlocked');
        if (u.status === UserStatus.Resting) return t('invite.targetResting');
        if (
            u.status === UserStatus.InGame ||
            u.status === UserStatus.Negotiating ||
            u.status === UserStatus.Spectating
        ) {
            return t('invite.targetBusy');
        }
        const until = mergedCooldownUntil[u.id] ?? 0;
        if (Date.now() < until) return t('invite.cooldown');
        if (resolveLobbyChannel(u) !== myChannel) {
            return t('invite.lobbyOnly');
        }
        return null;
    };

    const sendInvite = async (target: UserWithStatus) => {
        const reason = getInviteDisabledReason(target, userTab);
        if (reason) return;
        try {
            const result = await onAction({
                type: 'PAIR_INVITE_PARTNER',
                payload: {
                    targetUserId: target.id,
                    ...(inviteTargetSlot
                        ? { targetTeam: inviteTargetSlot.team, targetIndex: inviteTargetSlot.index }
                        : {}),
                },
            });
            const err = (result as any)?.error;
            if (typeof err === 'string' && err.includes('잠시 후')) {
                onRegisterLocalCooldown(target.id, Date.now() + 10000);
            }
            if (err) {
                window.alert(err);
                return;
            }
            onClose();
        } catch {
            window.alert(t('invite.sendFailed'));
        }
    };

    const currentUserForList = useMemo(
        () => ({ ...currentUser, lobbyChannel: myChannel }),
        [currentUser, myChannel],
    );

    return (
        <div
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="flex h-[580px] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-zinc-900 to-black shadow-2xl ring-1 ring-white/10 sm:max-w-lg"
                role="dialog"
                aria-modal
                aria-labelledby="pair-invite-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                    <h2 id="pair-invite-modal-title" className="text-base font-extrabold text-cyan-50">
                        {t('invite.partnerInvite')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-white/15 bg-black/40 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-white/10"
                    >
                        {tCommon('actions.close')}
                    </button>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-white/10 bg-black/25 p-1">
                    <button
                        type="button"
                        onClick={() => setUserTab('users')}
                        className={`rounded-lg px-2 py-1.5 text-xs font-bold ${userTab === 'users' ? 'bg-cyan-500 text-cyan-950' : 'text-cyan-100 hover:bg-cyan-950/45'}`}
                    >
                        {`Ch.${myChannel}`}
                    </button>
                    <button
                        type="button"
                        onClick={() => setUserTab('friends')}
                        className={`rounded-lg px-2 py-1.5 text-xs font-bold ${userTab === 'friends' ? 'bg-violet-500 text-violet-950' : 'text-violet-100 hover:bg-violet-950/45'}`}
                    >
                        {t('lobby:userScope.friends')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setUserTab('guild')}
                        className={`rounded-lg px-2 py-1.5 text-xs font-bold ${userTab === 'guild' ? 'bg-amber-500 text-amber-950' : 'text-amber-100 hover:bg-amber-950/45'}`}
                    >
                        {t('lobby:userScope.guild')}
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <PlayerList
                        users={displayedUsers}
                        mode="pair"
                        onAction={onAction}
                        currentUser={currentUserForList}
                        onViewUser={onViewUser}
                        lobbyType="strategic"
                        lobbyChannelStatusMap={statusMap}
                        showArenaPartnerInviteBlockToggle
                        pairInvite={{
                            listTab: userTab,
                            getInviteDisabledReason,
                            onInviteUser: (u) => void sendInvite(u),
                            modalLayout: true,
                        }}
                        inviteCooldownTicker={tick}
                        disableStatusSelect
                    />
                </div>
            </div>
        </div>
    );
};

export default PairPartnerInviteModal;
