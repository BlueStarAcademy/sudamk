import React, { type ReactNode } from 'react';
import { UserWithStatus, ServerAction, UserStatus, GameMode } from '../../types.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { AVATAR_POOL, BORDER_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { readPairRankedBlock } from '../../shared/utils/unifiedRankedStatsMigration.js';
import { RANKED_ELO_BASE_SCORE } from '../../shared/constants/rules.js';
import { userArenaChannelBadge } from '../../shared/utils/unifiedArenaLobbyUserList.js';

type UserListStats = { wins: number; losses: number; winRate: number; score?: number };

function computeUserListStats(user: UserWithStatus, mode: GameMode | 'strategic' | 'playful' | 'pair'): UserListStats | null {
    if (mode === 'pair') {
        const blk = readPairRankedBlock(user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
        const wins = blk.wins;
        const losses = blk.losses;
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const dr = user.dailyRankings?.pair;
        const score =
            dr && typeof dr.rank === 'number'
                ? RANKED_ELO_BASE_SCORE + (typeof dr.score === 'number' ? dr.score : 0)
                : blk.rankingScore;
        return { wins, losses, winRate, score };
    }
    if (mode === 'strategic' || mode === 'playful') {
        const modes = mode === 'strategic' ? SPECIAL_GAME_MODES.map((m) => m.mode) : PLAYFUL_GAME_MODES.map((m) => m.mode);
        let wins = 0;
        let losses = 0;
        let scoreSum = 0;
        let scoreCount = 0;
        for (const m of modes) {
            const st = user.stats?.[m];
            if (st) {
                wins += st.wins ?? 0;
                losses += st.losses ?? 0;
                if (mode === 'strategic' && st.rankingScore !== undefined && st.rankingScore !== null) {
                    scoreSum += st.rankingScore;
                    scoreCount += 1;
                }
            }
        }
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        if (mode === 'playful') {
            return { wins, losses, winRate };
        }
        const score = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 1200;
        return { wins, losses, winRate, score };
    }
    const st = user.stats?.[mode];
    if (st === undefined) return null;
    const wins = st.wins ?? 0;
    const losses = st.losses ?? 0;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const score = st.rankingScore ?? 1200;
    return { wins, losses, winRate, score };
}

const statusDisplay: Record<UserStatus, { text: string; color: string; }> = {
  'online': { text: '온라인', color: 'text-green-500' },
  'waiting': { text: '대기 중', color: 'text-green-400' },
  'resting': { text: '휴식 중', color: 'text-gray-400' },
  'negotiating': { text: '협상 중', color: 'text-yellow-400' },
  'in-game': { text: '경기중', color: 'text-red-500 font-semibold' },
  'spectating': { text: '관전 중', color: 'text-purple-400' },
  'offline': { text: '오프라인', color: 'text-gray-500' },
};

const arenaBadgeClass: Record<string, string> = {
    strategic: 'border-sky-400/40 bg-sky-500/15 text-sky-100',
    pair: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100',
    playful: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
};

export type PairInviteListTab = 'users' | 'friends' | 'guild';

interface PlayerListProps {
    users: UserWithStatus[];
    onAction: (a: ServerAction) => void;
    currentUser: UserWithStatus;
    mode: GameMode | 'strategic' | 'playful' | 'pair';
    onViewUser: (userId: string) => void;
    lobbyType: 'strategic' | 'playful';
    userCount?: number;
    /** 네이티브 전략·놀이 대기실: 페어 경기장 모바일과 유사한 목록 글자 크기 */
    pairAlignedNativeCompact?: boolean;
    /** 페어 파트너 초대 모달 등: 대국 신청 대신 초대 UI */
    pairInvite?: {
        listTab: PairInviteListTab;
        getInviteDisabledReason: (user: UserWithStatus, listTab: PairInviteListTab) => string | null;
        onInviteUser: (user: UserWithStatus) => void;
        /** 파트너 초대 모달: 상단 제목·인원 문구 숨김 */
        modalLayout?: boolean;
    };
    /** 쿨다운 남은 시간 UI 갱신용(0.5~1초마다 증가) */
    inviteCooldownTicker?: number;
    /** 페어 방 안일 때 내 상태 드롭다운 비활성화 */
    disableStatusSelect?: boolean;
    /** 유저 목록 제목(h2) 바로 아래 · 내 정보(본인 행) 위 — 전체/친구/길드원 등 */
    listScopeTabs?: ReactNode;
}

const PlayerList: React.FC<PlayerListProps> = ({
    users,
    onAction,
    currentUser,
    mode,
    onViewUser,
    lobbyType,
    userCount,
    pairAlignedNativeCompact = false,
    pairInvite,
    inviteCooldownTicker = 0,
    disableStatusSelect = false,
    listScopeTabs,
}) => {
    const { handlers } = useAppContext();
    const isStrategicLobby = lobbyType === 'strategic';
    const me =
        users.find((user) => user.id === currentUser.id) ??
        users.find((user) => String(user?.id) === String(currentUser?.id));

    const otherUsers = users
        .filter((user) => user.id !== currentUser.id && String(user.id) !== String(currentUser.id))
        .sort((a, b) => a.nickname.localeCompare(b.nickname));

    const isPairArenaList = mode === 'pair' && !pairInvite;

    const renderUserItem = (user: UserWithStatus, isCurrentUser: boolean) => {
        const statusInfo = statusDisplay[user.status] ?? statusDisplay.offline;
        const arenaBadge = userArenaChannelBadge(user);
        const isDiceGo = mode === GameMode.Dice;

        const listStats = computeUserListStats(user, mode);

        const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;

        return (
            <li key={user.id} className={`flex items-center justify-between p-1.5 rounded-lg ${isCurrentUser ? 'bg-blue-900/40 border border-blue-700' : 'bg-tertiary/50'}`}>
                <div 
                    className={`flex items-center gap-2 lg:gap-3 overflow-hidden ${!isCurrentUser ? 'cursor-pointer' : ''}`}
                    onClick={() => !isCurrentUser && onViewUser(user.id)}
                    title={!isCurrentUser ? `${user.nickname} 프로필 보기` : ''}
                >
                    <Avatar
                        userId={user.id}
                        userName={user.nickname}
                        size={pairAlignedNativeCompact ? 32 : 36}
                        className="border-2 border-color"
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                    />
                    {isDiceGo && <div className="w-5 h-5 rounded-full bg-black border border-gray-300 flex-shrink-0" />}
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                            className="flex min-w-0 w-full items-baseline justify-between gap-2 overflow-hidden"
                            title={
                                listStats
                                    ? `${user.nickname}${
                                          listStats.score != null ? ` ${listStats.score.toLocaleString()}점 ·` : ' ·'
                                      } ${listStats.wins}승${listStats.losses}패(${listStats.winRate}%)`
                                    : undefined
                            }
                        >
                            <UserNicknameText
                                user={{
                                    nickname: user.nickname,
                                    isAdmin: user.isAdmin,
                                    staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                                }}
                                as="span"
                                className={`min-w-0 flex-1 truncate font-bold ${
                                    pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-sm lg:text-base' : 'text-sm lg:text-base'
                                }`}
                            />
                            {listStats && listStats.score != null && (
                                <span
                                    className={`shrink-0 text-right font-semibold tabular-nums text-amber-200 ${
                                        pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs lg:text-sm' : 'text-xs lg:text-sm'
                                    }`}
                                >
                                    {listStats.score.toLocaleString()}점
                                </span>
                            )}
                        </div>
                        <div className="mt-0.5 flex min-w-0 w-full items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                                <span
                                    className={`shrink-0 ${statusInfo.color} ${
                                        pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-xs'
                                    }`}
                                >
                                    ● {statusInfo.text}
                                </span>
                                {arenaBadge && (
                                    <span
                                        className={`shrink-0 rounded-full border px-1.5 py-0.5 font-bold leading-none ${
                                            arenaBadgeClass[arenaBadge.channel] ?? arenaBadgeClass.strategic
                                        } ${pairAlignedNativeCompact ? 'text-[0.58rem] sm:text-[10px]' : 'text-[10px]'}`}
                                        title={`${arenaBadge.label} 경기장`}
                                    >
                                        {arenaBadge.label}
                                    </span>
                                )}
                            </div>
                            {listStats ? (
                                <span
                                    className={`shrink-0 text-right font-semibold tabular-nums text-secondary ${
                                        pairAlignedNativeCompact ? 'text-[0.62rem] sm:text-[11px] lg:text-xs' : 'text-[10px] lg:text-[11px]'
                                    }`}
                                >
                                    {listStats.wins}승{listStats.losses}패({listStats.winRate}%)
                                </span>
                            ) : (
                                <span
                                    className={`shrink-0 text-right text-tertiary ${
                                        pairAlignedNativeCompact ? 'text-[0.62rem] sm:text-[11px] lg:text-xs' : 'text-[10px] lg:text-[11px]'
                                    }`}
                                >
                                    통계 없음
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {isCurrentUser ? (
                    <div className="flex items-center gap-1.5">
                        {isStrategicLobby && !isPairArenaList && (
                            <Button
                                onClick={() => handlers.openGameRecordList()}
                                colorScheme="none"
                                className={`!py-0.5 !px-1.5 lg:!text-xs bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white font-bold rounded-md shadow-sm whitespace-nowrap ${
                                    pairAlignedNativeCompact ? '!text-[0.65rem] sm:!text-xs' : '!text-[10px]'
                                }`}
                            >
                                기보
                            </Button>
                        )}
                        <select
                            value={currentUser.status}
                            onChange={(e) => onAction({ type: 'SET_USER_STATUS', payload: { status: e.target.value } })}
                            disabled={disableStatusSelect || !['waiting', 'resting'].includes(currentUser.status)}
                            className={`bg-secondary border border-color rounded-lg text-center transition-colors focus:ring-accent focus:border-accent disabled:opacity-50 ${
                                pairAlignedNativeCompact
                                    ? 'w-[4.5rem] px-1 py-0.5 text-[0.65rem] sm:w-20 sm:px-2 sm:py-1 sm:text-xs lg:px-3 lg:py-1.5 lg:text-sm lg:w-24'
                                    : 'w-20 px-2 py-1 text-xs lg:px-3 lg:py-1.5 lg:text-sm lg:w-24'
                            }`}
                            title={disableStatusSelect ? '페어 방에 있을 때는 상태를 바꿀 수 없습니다.' : undefined}
                        >
                            <option value="waiting">대기 중</option>
                            <option value="resting">휴식 중</option>
                            {!['waiting', 'resting'].includes(currentUser.status) && (
                                <option value={currentUser.status} disabled>
                                    {(statusDisplay[currentUser.status] ?? statusDisplay.offline).text}
                                </option>
                            )}
                        </select>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {currentUser.isAdmin && !user.isAdmin && (
                            <Button
                                onClick={() => {
                                    if (window.confirm(`[${user.nickname}]님을 강제로 접속 종료하시겠습니까?`)) {
                                        onAction({ type: 'ADMIN_FORCE_LOGOUT', payload: { targetUserId: user.id } });
                                    }
                                }}
                                colorScheme="red"
                                className={`!py-1 !px-2 ${pairAlignedNativeCompact ? '!text-[0.65rem] sm:!text-xs' : '!text-xs'}`}
                            >
                                강제 퇴장
                            </Button>
                        )}
                        {pairInvite ? (() => {
                            void inviteCooldownTicker;
                            const reason = pairInvite.getInviteDisabledReason(user, pairInvite.listTab);
                            const disabled = reason !== null;
                            return (
                                <Button
                                    onClick={() => pairInvite.onInviteUser(user)}
                                    disabled={disabled}
                                    title={reason || undefined}
                                    colorScheme="none"
                                    className="!text-[11px] !py-1.5 !px-2.5 whitespace-nowrap rounded-md border border-cyan-500/40 bg-cyan-950/50 font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45 sm:!text-xs sm:!px-3"
                                >
                                    초대하기
                                </Button>
                            );
                        })() : null}
                    </div>
                )}
            </li>
        );
    };

    const hideListHeading = Boolean(pairInvite?.modalLayout);

    return (
        <div
            className={`flex min-h-0 flex-col text-on-panel ${
                hideListHeading ? 'min-h-0 flex-1 p-2' : pairAlignedNativeCompact ? 'p-2' : 'p-3'
            }`}
        >
            {!hideListHeading && (
             <h2
                className={`flex flex-shrink-0 items-center justify-between border-b border-color pb-2 font-semibold ${
                    listScopeTabs ? 'mb-1.5' : 'mb-2'
                } ${pairAlignedNativeCompact ? 'text-sm sm:text-base' : 'text-xl'}`}
            >
                <span className="flex items-center gap-1.5 sm:gap-2">
                    유저 목록
                    {userCount !== undefined && (
                        <span
                            className={`font-normal text-secondary ${
                                pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-sm'
                            }`}
                        >
                            ({userCount}명 접속 중)
                        </span>
                    )}
                </span>
            </h2>
            )}
            {listScopeTabs ? <div className="mb-2 shrink-0">{listScopeTabs}</div> : null}
            {me && (
              <div className="flex-shrink-0 mb-2">
                  {renderUserItem(me, true)}
              </div>
            )}
            <ul
                className={`space-y-2 overflow-y-auto pr-2 min-h-[96px] ${
                    hideListHeading ? 'min-h-0 flex-1' : 'max-h-[calc(var(--vh,1vh)*25)]'
                }`}
            >
                {otherUsers.length > 0 ? otherUsers.map(user => renderUserItem(user, false)) : (
                    <p className="text-center text-tertiary pt-8">다른 플레이어가 없습니다.</p>
                )}
            </ul>
        </div>
    );
};

export default PlayerList;