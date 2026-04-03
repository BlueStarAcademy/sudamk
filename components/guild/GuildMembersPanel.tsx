import React, { useState, useMemo } from 'react';
import { Guild as GuildType, GuildMember, GuildMemberRole } from '../../types/index.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Avatar from '../Avatar.js';
import { AVATAR_POOL, BORDER_POOL, GUILD_INITIAL_MEMBER_LIMIT, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import { formatLastSeenGuild } from '../../utils/timeUtils.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

interface GuildMembersPanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
}

const MemberManagementModal: React.FC<{
    member: GuildMember;
    memberDisplayName: string;
    roleLabel: string;
    isMaster: boolean;
    isVice: boolean;
    onPromote: () => void;
    onDemote: () => void;
    onKick: () => void;
    onTransfer: () => void;
    onClose: () => void;
}> = ({ member, memberDisplayName, roleLabel, isMaster, isVice, onPromote, onDemote, onKick, onTransfer, onClose }) => {
    const canPromoteToVice = isMaster && member.role === GuildMemberRole.Member;
    const canDemote = isMaster && member.role === GuildMemberRole.Vice;
    const canKick = (isMaster && member.role !== GuildMemberRole.Master) || (isVice && member.role === GuildMemberRole.Member);
    const canTransfer = isMaster && member.role !== GuildMemberRole.Master;
    const roleBadgeClass =
        member.role === 'leader'
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : member.role === 'officer'
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-stone-500/20 text-stone-300 border-stone-500/40';

    return (
        <DraggableWindow
            title="길드원 관리"
            windowId="guild-member-management-modal"
            onClose={onClose}
            initialWidth={400}
            initialHeight={520}
            modal={true}
            closeOnOutsideClick={true}
        >
            <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
                {/* 대상 멤버 헤더 */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-stone-800/60 border border-stone-600/40 mb-4">
                    <Avatar userId={member.userId} userName={memberDisplayName} size={52} />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg text-white truncate" title={memberDisplayName}>{memberDisplayName}</p>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${roleBadgeClass}`}>
                            {roleLabel}
                        </span>
                    </div>
                </div>

                {/* 안내 문구 */}
                <p className="text-stone-400 text-sm mb-4 px-0.5">
                    아래 작업 중 선택하세요. 내용이 길어도 모두 표시됩니다.
                </p>

                {/* 작업 버튼 영역 - 내용 잘림 방지 */}
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                    {canPromoteToVice && (
                        <Button
                            onClick={onPromote}
                            className="w-full !text-sm !py-3 !min-h-[44px] border border-blue-500/50 bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white shadow-lg hover:shadow-xl hover:from-blue-500/95 hover:to-indigo-500/95 transition-all whitespace-normal break-words"
                        >
                            부길드장 임명
                        </Button>
                    )}
                    {canDemote && (
                        <Button
                            onClick={onDemote}
                            className="w-full !text-sm !py-3 !min-h-[44px] border border-yellow-500/50 bg-gradient-to-r from-yellow-600/90 to-amber-600/90 text-white shadow-lg hover:shadow-xl hover:from-yellow-500/95 hover:to-amber-500/95 transition-all whitespace-normal break-words"
                        >
                            부길드장 해임
                        </Button>
                    )}
                    {canTransfer && (
                        <Button
                            onClick={onTransfer}
                            className="w-full !text-sm !py-3 !min-h-[44px] border border-orange-500/50 bg-gradient-to-r from-orange-600/90 to-red-600/90 text-white shadow-lg hover:shadow-xl hover:from-orange-500/95 hover:to-red-500/95 transition-all whitespace-normal break-words"
                        >
                            길드장 위임
                        </Button>
                    )}
                    {canKick && (
                        <Button
                            onClick={onKick}
                            className="w-full !text-sm !py-3 !min-h-[44px] border border-red-500/50 bg-gradient-to-r from-red-600/90 to-rose-600/90 text-white shadow-lg hover:shadow-xl hover:from-red-500/95 hover:to-rose-500/95 transition-all whitespace-normal break-words"
                        >
                            추방
                        </Button>
                    )}
                </div>

                {/* 닫기 */}
                <div className="mt-4 pt-4 border-t border-stone-600/50">
                    <Button
                        onClick={onClose}
                        className="w-full !text-sm !py-3 !min-h-[44px] border border-stone-500/50 bg-stone-700/80 hover:bg-stone-600/80 text-stone-200 shadow transition-all"
                    >
                        닫기
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

const GuildMembersPanel: React.FC<GuildMembersPanelProps> = ({ guild, myMemberInfo }) => {
    const { handlers, allUsers, onlineUsers, currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;
    const [managingMember, setManagingMember] = useState<GuildMember | null>(null);

    const memberLimit = useMemo(() => {
        const baseLimit = GUILD_INITIAL_MEMBER_LIMIT;
        const researchBonus = (guild.research?.member_limit_increase?.level || 0) * 5;
        return baseLimit + researchBonus;
    }, [guild]);


    const sortedMembers = useMemo(() => {
        const roleOrder: Record<string, number> = {
            'leader': 0,
            'officer': 1,
            'member': 2,
        };
        let members = guild.members || [];
        // members가 비어있는데 현재 사용자가 이 길드에 속해있으면 폴백으로 자신 표시
        if (members.length === 0 && currentUserWithStatus?.guildId === guild.id) {
            const effectiveUserId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
            members = [{
                id: `${guild.id}-member-${effectiveUserId}`,
                guildId: guild.id,
                userId: effectiveUserId,
                nickname: currentUserWithStatus.nickname || (currentUserWithStatus.isAdmin ? ADMIN_NICKNAME : ''),
                role: guild.leaderId === effectiveUserId ? 'leader' : 'member',
                joinDate: Date.now(),
                contributionTotal: 0,
                weeklyContribution: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }];
        }
        return [...members].sort((a, b) => (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3));
    }, [guild.members, guild.id, guild.leaderId, currentUserWithStatus?.guildId, currentUserWithStatus?.id, currentUserWithStatus?.isAdmin, currentUserWithStatus?.nickname]);
    
    const isMaster = myMemberInfo?.role === 'leader';
    const isVice = myMemberInfo?.role === 'officer';
    const canManage = isMaster || isVice;

    const handleAction = (type: 'PROMOTE' | 'DEMOTE' | 'KICK' | 'TRANSFER', targetMemberId: string) => {
        let actionType: 'GUILD_PROMOTE_MEMBER' | 'GUILD_DEMOTE_MEMBER' | 'GUILD_KICK_MEMBER' | 'GUILD_TRANSFER_MASTERSHIP';
        let confirmMessage = '';
        const targetMember = guild.members?.find(m => m.userId === targetMemberId);
        if (!targetMember) return;

        const memberName = targetMember.nickname || 'Unknown';
        switch (type) {
            case 'PROMOTE':
                actionType = 'GUILD_PROMOTE_MEMBER';
                confirmMessage = `${memberName}님을 부길드장으로 임명하시겠습니까?`;
                break;
            case 'DEMOTE':
                actionType = 'GUILD_DEMOTE_MEMBER';
                confirmMessage = `${memberName}님을 부길드장에서 해임하시겠습니까?`;
                break;
            case 'KICK':
                actionType = 'GUILD_KICK_MEMBER';
                confirmMessage = `${memberName}님을 길드에서 추방하시겠습니까?`;
                break;
            case 'TRANSFER':
                actionType = 'GUILD_TRANSFER_MASTERSHIP';
                confirmMessage = `정말로 길드장 권한을 ${memberName}님에게 위임하시겠습니까? 이 작업은 되돌릴 수 없습니다.`;
                break;
        }

        if (window.confirm(confirmMessage)) {
            if (actionType === 'GUILD_KICK_MEMBER') {
                handlers.handleAction({ type: 'GUILD_KICK_MEMBER', payload: { guildId: guild.id, memberId: targetMemberId, targetMemberId } });
            } else {
                handlers.handleAction({ type: actionType as 'GUILD_PROMOTE_MEMBER' | 'GUILD_DEMOTE_MEMBER' | 'GUILD_TRANSFER_MASTERSHIP', payload: { guildId: guild.id, targetMemberId } });
            }
        }
        setManagingMember(null);
    };

    const getRoleName = (role: string) => {
        switch (role) {
            case 'leader': return '길드장';
            case 'officer': return '부길드장';
            case 'member': return '길드원';
            default: return '길드원';
        }
    };
    
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'leader': return 'text-yellow-400';
            case 'officer': return 'text-blue-400';
            case 'member': return 'text-gray-300';
            default: return 'text-gray-300';
        }
    };
    
    const handleLeaveGuild = async () => {
        if (myMemberInfo?.role === 'leader' && (guild.members?.length || 0) > 1) {
            alert('길드장이 길드를 떠나려면 먼저 다른 길드원에게 길드장을 위임해야 합니다.');
            return;
        }
        const confirmMessage = myMemberInfo?.role === 'leader' && (guild.members?.length || 0) === 1
            ? '길드의 마지막 멤버입니다. 길드를 떠나면 길드가 해체됩니다. 정말로 떠나시겠습니까?'
            : '정말로 길드를 떠나시겠습니까?';

        if (window.confirm(confirmMessage)) {
            try {
                // LEAVE_GUILD 또는 GUILD_LEAVE 둘 다 지원
                const result: any = await handlers.handleAction({ 
                    type: 'LEAVE_GUILD',
                    payload: { guildId: guild.id }
                });
                
                if (result?.error) {
                    alert(result.error);
                } else {
                    // 성공 시 프로필로 리다이렉트 (useApp에서 길드 정보가 자동으로 제거됨)
                    window.location.hash = '#/profile';
                }
            } catch (error: any) {
                console.error('[GuildMembersPanel] Leave guild error:', error);
                alert('길드 탈퇴 중 오류가 발생했습니다.');
            }
        }
    };

    return (
        <div
            className={`relative flex h-full flex-col overflow-visible rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 shadow-2xl backdrop-blur-md ${isNativeMobile ? 'p-3' : 'p-6'}`}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
            <div className="relative z-10 flex h-full flex-col">
                <div className={`flex flex-shrink-0 items-center justify-between gap-2 ${isNativeMobile ? 'mb-3' : 'mb-6'}`}>
                    <h3
                        className={`flex items-center gap-1.5 font-bold text-highlight drop-shadow-lg ${isNativeMobile ? 'min-w-0 flex-1 text-base leading-tight' : 'gap-2 text-2xl'}`}
                    >
                        <span className={isNativeMobile ? 'text-base' : 'text-2xl'} aria-hidden>
                            👥
                        </span>
                        <span className="min-w-0">
                            길드원{' '}
                            <span className={`whitespace-nowrap text-primary ${isNativeMobile ? 'text-xs font-bold' : 'text-lg'}`}>
                                ({sortedMembers.length}/{memberLimit})
                            </span>
                        </span>
                    </h3>
                    {myMemberInfo && myMemberInfo.role !== 'leader' && (
                        <Button
                            onClick={handleLeaveGuild}
                            colorScheme="red"
                            className={`shrink-0 border-2 border-red-500/50 shadow-lg transition-all hover:shadow-xl ${isNativeMobile ? '!px-2 !py-1 !text-[10px]' : '!px-4 !py-2 !text-xs'}`}
                        >
                            길드 탈퇴
                        </Button>
                    )}
                    {myMemberInfo && myMemberInfo.role === 'leader' && sortedMembers.length === 1 && (
                        <Button
                            onClick={handleLeaveGuild}
                            colorScheme="red"
                            className={`shrink-0 border-2 border-red-500/50 shadow-lg transition-all hover:shadow-xl ${isNativeMobile ? '!px-2 !py-1 !text-[10px]' : '!px-4 !py-2 !text-xs'}`}
                        >
                            길드 해체
                        </Button>
                    )}
                </div>
                <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
                <div className={`min-h-0 min-w-0 flex-grow overflow-y-auto ${isNativeMobile ? 'pr-1' : 'pr-3'}`}>
                    {sortedMembers.length === 0 ? (
                        <div className="flex h-full items-center justify-center py-8">
                            <div className="text-center">
                                <p className={`text-tertiary font-semibold ${isNativeMobile ? 'mb-1 text-sm' : 'mb-2 text-xl'}`}>길드원이 없습니다</p>
                                <p className={`text-gray-500 ${isNativeMobile ? 'text-xs' : 'text-sm'}`}>아직 가입한 길드원이 없습니다.</p>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full min-w-0 border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b-2 border-stone-600/50 bg-gradient-to-r from-stone-800/95 via-neutral-700/85 to-stone-800/95 font-bold text-highlight">
                                <th
                                    className={`text-left ${isNativeMobile ? 'max-w-[40%] px-2 py-2 text-[10px] leading-tight' : 'px-5 py-4 text-base'}`}
                                >
                                    길드원
                                </th>
                                <th
                                    className={`text-center whitespace-nowrap ${isNativeMobile ? 'px-0.5 py-2 text-[9px] leading-tight' : 'w-24 py-4 text-sm'}`}
                                    title="주간 기여도"
                                >
                                    {isNativeMobile ? '주간' : '주간 기여도'}
                                </th>
                                <th
                                    className={`text-center whitespace-nowrap ${isNativeMobile ? 'px-0.5 py-2 text-[9px] leading-tight' : 'w-24 py-4 text-sm'}`}
                                    title="누적 기여도"
                                >
                                    {isNativeMobile ? '누적' : '누적 기여도'}
                                </th>
                                <th
                                    className={`text-center ${isNativeMobile ? 'min-w-0 max-w-[4.5rem] px-0.5 py-2 text-[9px] leading-tight' : 'w-28 py-4 text-sm'}`}
                                    title="최근 접속"
                                >
                                    {isNativeMobile ? '접속' : '최근 접속'}
                                </th>
                                {canManage && (
                                    <th
                                        className={`text-center whitespace-nowrap ${isNativeMobile ? 'px-0.5 py-2 text-[9px]' : 'w-20 py-4 text-sm'}`}
                                    >
                                        관리
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedMembers.map(member => {
                            const user = allUsers.find(u => u.id === member.userId || (member.userId === ADMIN_USER_ID && u.isAdmin));
                            const memberDisplayName = member.nickname
                                || (member.userId === ADMIN_USER_ID ? ADMIN_NICKNAME : (user?.isAdmin ? ADMIN_NICKNAME : (user?.nickname || 'Unknown')));
                            const userStatus = onlineUsers.find(u => u.id === member.userId || (member.userId === ADMIN_USER_ID && u.isAdmin));
                            const avatarUrl = user ? AVATAR_POOL.find(a => a.id === user.avatarId)?.url : undefined;
                            const borderUrl = user ? BORDER_POOL.find(b => b.id === user.borderId)?.url : undefined;
                            const isSelf = effectiveUserId && (member.userId === effectiveUserId || member.userId === currentUserWithStatus?.id);
                            const isOnline = !!userStatus || !!isSelf;
                            const isClickable = user && user.id !== currentUserWithStatus?.id;

                            return (
                                <tr
                                    key={member.userId}
                                    onClick={isClickable ? (e) => { e?.stopPropagation(); handlers.openViewingUser(member.userId); } : undefined}
                                    title={isClickable ? `${memberDisplayName} 프로필 보기` : ''}
                                    className={`border-b-2 border-stone-600/50 transition-all duration-200 ${
                                        isClickable 
                                            ? 'cursor-pointer hover:bg-stone-700/50' 
                                            : ''
                                    } ${
                                        member.role === 'leader' 
                                            ? 'bg-gradient-to-r from-yellow-900/20 via-amber-900/15 to-yellow-900/20 border-yellow-500/30' 
                                            : member.role === 'officer'
                                            ? 'bg-gradient-to-r from-blue-900/20 via-indigo-900/15 to-blue-900/20 border-blue-500/30'
                                            : 'bg-gradient-to-r from-stone-800/95 via-neutral-700/90 to-stone-800/95'
                                    }`}
                                >
                                    <td className={isNativeMobile ? 'px-2 py-2' : 'px-5 py-4'}>
                                        <div className={`flex min-w-0 items-center ${isNativeMobile ? 'gap-2' : 'gap-5'}`}>
                                            <div className="relative shrink-0">
                                                <Avatar
                                                    userId={member.userId}
                                                    userName={memberDisplayName}
                                                    size={isNativeMobile ? 36 : 56}
                                                    avatarUrl={avatarUrl}
                                                    borderUrl={borderUrl}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className={`mb-0.5 flex min-w-0 items-center gap-1 font-bold drop-shadow-lg ${isNativeMobile ? 'text-xs leading-snug' : 'mb-1 gap-2 text-xl'}`}
                                                >
                                                    <span
                                                        className={`shrink-0 rounded-full ${isNativeMobile ? 'h-2 w-2' : 'h-2.5 w-2.5'} ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                                                        title={isOnline ? '온라인' : '오프라인'}
                                                    />
                                                    <span className="truncate" title={memberDisplayName}>
                                                        {memberDisplayName}
                                                    </span>
                                                </p>
                                                <p
                                                    className={`font-bold drop-shadow-md ${getRoleColor(member.role)} ${isNativeMobile ? 'text-[10px] leading-none' : 'text-sm'}`}
                                                >
                                                    {getRoleName(member.role)}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="align-middle text-center">
                                        <p
                                            className={`font-bold text-primary drop-shadow-lg ${isNativeMobile ? 'text-xs tabular-nums' : 'text-lg'}`}
                                        >
                                            {member.weeklyContribution || 0}
                                        </p>
                                    </td>
                                    <td className="align-middle text-center">
                                        <p
                                            className={`font-bold text-accent drop-shadow-lg ${isNativeMobile ? 'text-xs tabular-nums' : 'text-lg'}`}
                                        >
                                            {member.contributionTotal || 0}
                                        </p>
                                    </td>
                                    <td className="min-w-0 align-middle text-center">
                                        <p
                                            className={`font-semibold ${isNativeMobile ? 'truncate text-[10px] leading-tight' : 'truncate text-sm'}`}
                                        >
                                            {isOnline ? (
                                                <span className="text-green-400 drop-shadow-lg">온라인</span>
                                            ) : (
                                                <span className="text-tertiary" title={formatLastSeenGuild(member.lastLoginAt ?? user?.lastLoginAt)}>
                                                    {formatLastSeenGuild(member.lastLoginAt ?? user?.lastLoginAt)}
                                                </span>
                                            )}
                                        </p>
                                    </td>
                                    {canManage && (
                                        <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                            {member.userId !== myMemberInfo?.userId && (
                                                <Button
                                                    onClick={() => setManagingMember(member)}
                                                    className={`border-2 border-cyan-500/60 bg-gradient-to-r from-cyan-600/95 via-blue-600/95 to-indigo-600/95 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl ${isNativeMobile ? '!px-1 !py-1 !text-[9px] leading-none' : 'hover:scale-105 !px-4 !py-2.5 !text-xs'}`}
                                                >
                                                    관리
                                                </Button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        </tbody>
                        </table>
                    )}
                </div>
                </div>
            </div>

            {managingMember && (
                <MemberManagementModal
                    member={managingMember}
                    memberDisplayName={
                        (() => {
                            const u = allUsers.find(x => x.id === managingMember.userId || (managingMember.userId === ADMIN_USER_ID && x.isAdmin));
                            return managingMember.nickname
                                || (managingMember.userId === ADMIN_USER_ID ? ADMIN_NICKNAME : (u?.isAdmin ? ADMIN_NICKNAME : (u?.nickname || 'Unknown')));
                        })()
                    }
                    roleLabel={getRoleName(managingMember.role)}
                    isMaster={isMaster}
                    isVice={isVice}
                    onPromote={() => handleAction('PROMOTE', managingMember.userId)}
                    onDemote={() => handleAction('DEMOTE', managingMember.userId)}
                    onKick={() => handleAction('KICK', managingMember.userId)}
                    onTransfer={() => handleAction('TRANSFER', managingMember.userId)}
                    onClose={() => setManagingMember(null)}
                />
            )}
        </div>
    );
};

export default GuildMembersPanel;

