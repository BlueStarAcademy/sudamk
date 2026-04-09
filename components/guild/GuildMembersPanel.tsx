import React, { useState, useMemo, useCallback } from 'react';
import { Guild as GuildType, GuildMember, GuildMemberRole } from '../../types/index.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import Avatar from '../Avatar.js';
import { AVATAR_POOL, BORDER_POOL, GUILD_INITIAL_MEMBER_LIMIT, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import { formatLastSeenGuild } from '../../utils/timeUtils.js';

type GuildMemberSortMode = 'role' | 'joinDate' | 'contributionTotal' | 'weeklyContribution' | 'lastLogin' | 'nickname';

const MEMBER_SORT_OPTIONS: { value: GuildMemberSortMode; label: string }[] = [
    { value: 'role', label: '직책순' },
    { value: 'joinDate', label: '가입일순' },
    { value: 'contributionTotal', label: '누적기여도순' },
    { value: 'weeklyContribution', label: '주간기여도순' },
    { value: 'lastLogin', label: '최근접속순' },
    { value: 'nickname', label: '닉네임순' },
];

interface GuildMembersPanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
    /** 모바일 길드홈 전체 화면 목록: 글자·아바타 축소, 줄바꿈 최소화 */
    compact?: boolean;
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
    const isMobileShell = useNativeMobileShell();
    const canPromoteToVice = isMaster && member.role === GuildMemberRole.Member;
    const canDemote = isMaster && member.role === GuildMemberRole.Vice;
    const canKick = (isMaster && member.role !== GuildMemberRole.Master) || (isVice && member.role === GuildMemberRole.Member);
    const canTransfer = isMaster && member.role !== GuildMemberRole.Master;
    const actionButtonClass = `flex w-full ${isMobileShell ? 'max-w-[320px]' : 'max-w-[360px]'} items-center justify-center text-center !min-h-[40px] sm:!min-h-[46px] whitespace-normal break-words !rounded-xl !px-3 !py-2.5 sm:!py-3 !text-sm !font-bold text-white leading-tight transition-all hover:brightness-110`;
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
            initialWidth={isMobileShell ? 400 : 460}
            initialHeight={isMobileShell ? 520 : 560}
            modal={true}
            closeOnOutsideClick={true}
        >
            <div className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-b-[inherit] bg-gradient-to-b from-[#171923] via-[#11131a] to-[#0a0b10] p-3">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute -left-16 top-6 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl" aria-hidden />
                <div className="pointer-events-none absolute -right-16 bottom-10 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" aria-hidden />
                {/* 대상 멤버 헤더 */}
                <div className="relative mb-3 flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-slate-800/80 via-slate-900/75 to-black/85 p-3 shadow-[0_18px_44px_-26px_rgba(34,211,238,0.6)] ring-1 ring-white/[0.04]">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-amber-500/10" aria-hidden />
                    <Avatar userId={member.userId} userName={memberDisplayName} size={52} />
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-lg font-bold text-white drop-shadow-sm" title={memberDisplayName}>{memberDisplayName}</p>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${roleBadgeClass}`}>
                            {roleLabel}
                        </span>
                    </div>
                </div>

                {/* 선택 길드원 요약 정보 */}
                <div className="mb-3 grid shrink-0 grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/25 p-1.5">
                    <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 px-1.5 py-1 text-center">
                        <p className="text-[10px] text-amber-200/85">누적 기여도</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-100">{member.contributionTotal || 0}</p>
                    </div>
                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-1.5 py-1 text-center">
                        <p className="text-[10px] text-cyan-200/85">주간 기여도</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-cyan-100">{member.weeklyContribution || 0}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-1.5 py-1 text-center">
                        <p className="text-[10px] text-emerald-200/85">최근 접속</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-emerald-100">{formatLastSeenGuild(member.lastLoginAt)}</p>
                    </div>
                </div>

                {/* 작업 버튼 영역 - 내용 잘림 방지 */}
                <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pb-1">
                    {canPromoteToVice && (
                        <Button
                            onClick={onPromote}
                            className={`${actionButtonClass} !border !border-sky-400/55 !bg-gradient-to-r !from-sky-500/92 !via-blue-600/92 !to-indigo-700/92 shadow-[0_16px_36px_-20px_rgba(56,189,248,0.75)] hover:shadow-[0_20px_42px_-18px_rgba(96,165,250,0.82)]`}
                        >
                            부길드장 임명
                        </Button>
                    )}
                    {canDemote && (
                        <Button
                            onClick={onDemote}
                            className={`${actionButtonClass} !border !border-amber-400/60 !bg-gradient-to-r !from-amber-500/92 !via-yellow-600/92 !to-orange-600/92 shadow-[0_16px_36px_-20px_rgba(251,191,36,0.75)] hover:shadow-[0_20px_42px_-18px_rgba(251,191,36,0.82)]`}
                        >
                            부길드장 해임
                        </Button>
                    )}
                    {canTransfer && (
                        <Button
                            onClick={onTransfer}
                            className={`${actionButtonClass} !border !border-orange-400/60 !bg-gradient-to-r !from-orange-500/92 !via-orange-600/92 !to-rose-700/92 shadow-[0_16px_36px_-20px_rgba(251,146,60,0.75)] hover:shadow-[0_20px_42px_-18px_rgba(251,146,60,0.82)]`}
                        >
                            길드장 위임
                        </Button>
                    )}
                    {canKick && (
                        <Button
                            onClick={onKick}
                            className={`${actionButtonClass} !border !border-red-400/60 !bg-gradient-to-r !from-red-500/92 !via-red-600/92 !to-rose-700/92 shadow-[0_16px_36px_-20px_rgba(248,113,113,0.75)] hover:shadow-[0_20px_42px_-18px_rgba(248,113,113,0.82)]`}
                        >
                            추방
                        </Button>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

const GuildMembersPanel: React.FC<GuildMembersPanelProps> = ({ guild, myMemberInfo, compact = false }) => {
    const { handlers, allUsers, onlineUsers, currentUserWithStatus } = useAppContext();
    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;
    const [managingMember, setManagingMember] = useState<GuildMember | null>(null);
    const [sortMode, setSortMode] = useState<GuildMemberSortMode>('role');

    const memberLimit = useMemo(() => {
        const baseLimit = GUILD_INITIAL_MEMBER_LIMIT;
        const researchBonus = (guild.research?.member_limit_increase?.level || 0) * 5;
        return baseLimit + researchBonus;
    }, [guild]);

    const resolveDisplayName = useCallback((m: GuildMember) => {
        const user = allUsers.find((u) => u.id === m.userId || (m.userId === ADMIN_USER_ID && u.isAdmin));
        return (
            m.nickname ||
            (m.userId === ADMIN_USER_ID ? ADMIN_NICKNAME : user?.isAdmin ? ADMIN_NICKNAME : user?.nickname || 'Unknown')
        );
    }, [allUsers]);

    const baseMembers = useMemo(() => {
        let members = guild.members || [];
        if (members.length === 0 && currentUserWithStatus?.guildId === guild.id) {
            const uid = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
            members = [
                {
                    id: `${guild.id}-member-${uid}`,
                    guildId: guild.id,
                    userId: uid,
                    nickname: currentUserWithStatus.nickname || (currentUserWithStatus.isAdmin ? ADMIN_NICKNAME : ''),
                    role: guild.leaderId === uid ? 'leader' : 'member',
                    joinDate: Date.now(),
                    contributionTotal: 0,
                    weeklyContribution: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            ];
        }
        return members;
    }, [guild.members, guild.id, guild.leaderId, currentUserWithStatus?.guildId, currentUserWithStatus?.id, currentUserWithStatus?.isAdmin, currentUserWithStatus?.nickname]);

    const displayMembers = useMemo(() => {
        const roleOrder: Record<string, number> = { leader: 0, officer: 1, member: 2 };
        const arr = [...baseMembers];
        const ONLINE_BIAS = 1e15;

        const lastLoginSortKey = (m: GuildMember) => {
            const u = allUsers.find((x) => x.id === m.userId || (m.userId === ADMIN_USER_ID && x.isAdmin));
            const userStatus = onlineUsers.find((ou) => ou.id === m.userId || (m.userId === ADMIN_USER_ID && ou.isAdmin));
            const isSelf =
                !!effectiveUserId &&
                (m.userId === effectiveUserId || m.userId === currentUserWithStatus?.id);
            const isOnline = !!userStatus || !!isSelf;
            const base = Math.max(0, m.lastLoginAt ?? u?.lastLoginAt ?? 0);
            return isOnline ? ONLINE_BIAS + base : base;
        };

        const tieUser = (a: GuildMember, b: GuildMember) => String(a.userId).localeCompare(String(b.userId));

        arr.sort((a, b) => {
            const nameA = resolveDisplayName(a);
            const nameB = resolveDisplayName(b);
            let cmp = 0;
            switch (sortMode) {
                case 'role': {
                    const ra = roleOrder[a.role] ?? 3;
                    const rb = roleOrder[b.role] ?? 3;
                    cmp = ra - rb;
                    if (cmp === 0) cmp = nameA.localeCompare(nameB, 'ko');
                    break;
                }
                case 'joinDate':
                    cmp = a.joinDate - b.joinDate;
                    break;
                case 'contributionTotal':
                    cmp = (b.contributionTotal || 0) - (a.contributionTotal || 0);
                    break;
                case 'weeklyContribution':
                    cmp = (b.weeklyContribution || 0) - (a.weeklyContribution || 0);
                    break;
                case 'lastLogin':
                    cmp = lastLoginSortKey(b) - lastLoginSortKey(a);
                    break;
                case 'nickname':
                    cmp = nameA.localeCompare(nameB, 'ko');
                    break;
                default:
                    cmp = 0;
            }
            if (cmp !== 0) return cmp;
            return tieUser(a, b);
        });
        return arr;
    }, [
        baseMembers,
        sortMode,
        allUsers,
        onlineUsers,
        effectiveUserId,
        currentUserWithStatus?.id,
        resolveDisplayName,
    ]);
    
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
            className={`relative flex h-full flex-col overflow-visible rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 shadow-2xl backdrop-blur-md ${
                compact ? 'p-3' : 'p-6'
            }`}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
            <div className="relative z-10 flex h-full flex-col">
                <div className={`flex flex-shrink-0 flex-col ${compact ? 'mb-2 gap-2' : 'mb-6 gap-3'}`}>
                    <div className="flex items-center justify-between gap-1">
                        <h3
                            className={`font-bold text-highlight drop-shadow-lg flex min-w-0 items-center gap-1 ${
                                compact ? 'text-base' : 'gap-2 text-2xl'
                            }`}
                        >
                            <span className={compact ? 'text-lg' : 'text-2xl'}>👥</span>
                            <span className="min-w-0 truncate">
                                길드원{' '}
                                <span className={compact ? 'text-sm text-primary' : 'text-lg text-primary'}>
                                    ({displayMembers.length}/{memberLimit})
                                </span>
                            </span>
                        </h3>
                        {myMemberInfo && myMemberInfo.role !== 'leader' && (
                            <Button
                                onClick={handleLeaveGuild}
                                colorScheme="red"
                                className={`shrink-0 border-2 border-red-500/50 shadow-lg transition-all hover:shadow-xl ${compact ? '!px-3 !py-2 !text-xs' : '!px-4 !py-2 !text-xs'}`}
                            >
                                탈퇴
                            </Button>
                        )}
                        {myMemberInfo && myMemberInfo.role === 'leader' && displayMembers.length === 1 && (
                            <Button
                                onClick={handleLeaveGuild}
                                colorScheme="red"
                                className={`shrink-0 border-2 border-red-500/50 shadow-lg transition-all hover:shadow-xl ${compact ? '!px-3 !py-2 !text-xs' : '!px-4 !py-2 !text-xs'}`}
                            >
                                해체
                            </Button>
                        )}
                    </div>
                    <div className={`flex min-w-0 items-center gap-2 ${compact ? '' : 'max-w-md'}`}>
                        <span className="shrink-0 text-sm text-stone-400">정렬</span>
                        <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value as GuildMemberSortMode)}
                            aria-label="길드원 목록 정렬"
                            className={`min-w-0 flex-1 rounded-lg border border-stone-500/50 bg-stone-800/90 text-stone-100 shadow-inner outline-none focus:border-cyan-500/60 ${
                                compact ? 'py-2.5 pl-2.5 pr-8 text-sm' : 'py-2 pl-3 pr-8 text-sm'
                            }`}
                        >
                            {MEMBER_SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
                <div className={`min-h-0 min-w-0 flex-grow overflow-y-auto ${compact ? 'pr-1' : 'pr-3'}`}>
                    {displayMembers.length === 0 ? (
                        <div className={`flex h-full items-center justify-center ${compact ? 'py-6' : 'py-12'}`}>
                            <div className="text-center">
                                <p className={`text-tertiary font-semibold ${compact ? 'mb-1 text-base' : 'mb-2 text-xl'}`}>길드원이 없습니다</p>
                                <p className={compact ? 'text-sm text-gray-500' : 'text-sm text-gray-500'}>아직 가입한 길드원이 없습니다.</p>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr
                                className={`border-b-2 border-stone-600/50 bg-gradient-to-r from-stone-800/95 via-neutral-700/85 to-stone-800/95 font-bold text-highlight ${
                                    compact ? 'text-xs' : 'text-sm'
                                }`}
                            >
                                <th className={`text-left ${compact ? 'px-2 py-2.5' : 'px-5 py-4 text-base'}`}>길드원</th>
                                <th className={`text-center ${compact ? 'px-2 py-2.5' : 'w-24 py-4'}`}>주간</th>
                                <th className={`text-center ${compact ? 'px-2 py-2.5' : 'w-24 py-4'}`}>누적</th>
                                <th className={`text-center ${compact ? 'px-2 py-2.5' : 'w-28 py-4'}`}>접속</th>
                                {canManage && <th className={`text-center ${compact ? 'px-2 py-2.5' : 'w-20 py-4'}`}>관리</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {displayMembers.map(member => {
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
                                    className={`transition-all duration-200 ${
                                        compact ? 'border-b border-stone-600/40' : 'border-b-2 border-stone-600/50'
                                    } ${
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
                                    <td className={compact ? 'px-2 py-2.5' : 'px-5 py-4'}>
                                        <div className={`flex min-w-0 items-center ${compact ? 'gap-2.5' : 'gap-5'}`}>
                                            <div className="relative flex-shrink-0">
                                                 <Avatar userId={member.userId} userName={memberDisplayName} size={compact ? 44 : 56} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                                            </div>
                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                <p
                                                    className={`flex items-center gap-1.5 font-bold drop-shadow-lg ${
                                                        compact ? 'text-[11px] leading-snug' : 'mb-1 gap-2 text-lg'
                                                    }`}
                                                >
                                                    <span className={`flex-shrink-0 rounded-full ${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? '온라인' : '오프라인'} />
                                                    <span className="whitespace-normal break-words">{memberDisplayName}</span>
                                                </p>
                                                <p className={`font-bold ${getRoleColor(member.role)} drop-shadow-md ${compact ? 'text-[10px] leading-snug' : 'text-sm'}`}>{getRoleName(member.role)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`text-center align-middle ${compact ? 'px-2 py-2' : 'w-24'}`}>
                                        <p className={`font-bold tabular-nums text-primary drop-shadow-lg ${compact ? 'text-sm leading-tight' : 'text-lg'}`}>{member.weeklyContribution || 0}</p>
                                    </td>
                                    <td className={`text-center align-middle ${compact ? 'px-2 py-2' : 'w-24'}`}>
                                        <p className={`font-bold tabular-nums text-accent drop-shadow-lg ${compact ? 'text-sm leading-tight' : 'text-lg'}`}>{member.contributionTotal || 0}</p>
                                    </td>
                                    <td className={`min-w-0 text-center align-middle ${compact ? 'px-2 py-2' : 'w-28'}`}>
                                        <p className={`font-semibold ${compact ? 'text-[10px] leading-snug' : 'text-sm'}`}>
                                            {isOnline ? <span className="text-green-400 drop-shadow-lg">온라인</span> : <span className="text-tertiary">{formatLastSeenGuild(member.lastLoginAt ?? user?.lastLoginAt)}</span>}
                                        </p>
                                    </td>
                                    {canManage && (
                                        <td className={`text-center align-middle ${compact ? 'px-2 py-2' : 'w-20'}`} onClick={(e) => e.stopPropagation()}>
                                            {member.userId !== myMemberInfo?.userId && (
                                                <Button
                                                    onClick={() => setManagingMember(member)}
                                                    className={
                                                        compact
                                                            ? '!px-2 !py-1.5 !text-xs border border-cyan-500/60 bg-gradient-to-r from-cyan-600/95 via-blue-600/95 to-indigo-600/95 font-semibold text-white shadow-md'
                                                            : '!px-4 !py-2.5 !text-xs border-2 border-cyan-500/60 bg-gradient-to-r from-cyan-600/95 via-blue-600/95 to-indigo-600/95 font-semibold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200'
                                                    }
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

