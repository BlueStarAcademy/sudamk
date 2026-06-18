import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserWithStatus } from '../../types.js';
import type { ServerAction } from '../../types.js';
import PlayerList, { type PairInviteListTab } from '../waiting-room/PlayerList.js';
import { UserStatus } from '../../types.js';
import { userInUnifiedArenaLobbyUserList } from '../../shared/utils/unifiedArenaLobbyUserList.js';

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
    const [userTab, setUserTab] = useState<PairInviteListTab>('users');
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const id = window.setInterval(() => setTick((t) => t + 1), 500);
        return () => window.clearInterval(id);
    }, []);

    void tick;

    const friendSet = useMemo(() => new Set(friendIds), [friendIds]);

    const pairLobbyUsers = useMemo(
        () => onlineUsers.filter((u) => userInUnifiedArenaLobbyUserList(u)),
        [onlineUsers],
    );

    const displayedUsers = useMemo(() => {
        if (userTab === 'friends') {
            return onlineUsers.filter((u) => friendSet.has(u.id));
        }
        if (userTab === 'guild') {
            return onlineUsers.filter((u) => Boolean(guildId && u.guildId === guildId));
        }
        return pairLobbyUsers;
    }, [userTab, onlineUsers, pairLobbyUsers, friendSet, guildId]);

    const mergedCooldownUntil = useMemo(
        () => ({ ...cooldownUntilByInviteeId }),
        [cooldownUntilByInviteeId, tick]
    );

    const getInviteDisabledReason = (u: UserWithStatus, tab: PairInviteListTab): string | null => {
        if (currentUser.status === UserStatus.Resting) return t('invite.restingSelf');
        if (u.id === currentUserId) return t('invite.cannotInviteSelf');
        if (u.blockArenaPartnerInvites === true) return t('invite.invitesBlocked');
        if (u.status === UserStatus.Resting) return t('invite.targetResting');
        if (u.status === UserStatus.InGame || u.status === UserStatus.Negotiating) {
            return t('invite.targetBusy');
        }
        const until = mergedCooldownUntil[u.id] ?? 0;
        if (Date.now() < until) return t('invite.cooldown');
        if (tab === 'users' && !userInUnifiedArenaLobbyUserList(u)) {
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
                        {t('lobby:userScope.all')}
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
                        currentUser={currentUser}
                        onViewUser={onViewUser}
                        lobbyType="strategic"
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
