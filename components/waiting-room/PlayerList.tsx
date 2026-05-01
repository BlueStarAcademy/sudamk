import React, { useState } from 'react';
import { UserWithStatus, ServerAction, UserStatus, GameMode, Negotiation } from '../../types.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { AVATAR_POOL, BORDER_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import Button from '../Button.js';
import ChallengeSelectionModal from '../ChallengeSelectionModal';
import GameRejectionSettingsModal from '../GameRejectionSettingsModal.tsx';
import { useAppContext } from '../../hooks/useAppContext.js';
import { isOpponentInsufficientActionPointsError } from '../../constants.js';
import { getApiUrl } from '../../utils/apiConfig.js';

type UserListStats = { wins: number; losses: number; winRate: number; score: number };

function computeUserListStats(user: UserWithStatus, mode: GameMode | 'strategic' | 'playful' | 'pair'): UserListStats | null {
    if (mode === 'pair') {
        const st = user.stats?.['pair'];
        const wins = st?.wins ?? 0;
        const losses = st?.losses ?? 0;
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const fromStats = st?.rankingScore;
        const score =
            fromStats !== undefined && fromStats !== null
                ? fromStats
                : Number(user.dailyRankings?.pair?.score ?? user.cumulativeRankingScore?.['pair'] ?? 1200);
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
                if (st.rankingScore !== undefined && st.rankingScore !== null) {
                    scoreSum += st.rankingScore;
                    scoreCount += 1;
                }
            }
        }
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
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
  'in-game': { text: '대국 중', color: 'text-blue-400' },
  'spectating': { text: '관전 중', color: 'text-purple-400' },
  'offline': { text: '오프라인', color: 'text-gray-500' },
};

export type PairInviteListTab = 'users' | 'friends' | 'guild';

interface PlayerListProps {
    users: UserWithStatus[];
    onAction: (a: ServerAction) => void;
    currentUser: UserWithStatus;
    mode: GameMode | 'strategic' | 'playful' | 'pair';
    negotiations: Negotiation[];
    onViewUser: (userId: string) => void;
    lobbyType: 'strategic' | 'playful';
    userCount?: number;
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
}

const PlayerList: React.FC<PlayerListProps> = ({
    users,
    onAction,
    currentUser,
    mode,
    negotiations,
    onViewUser,
    lobbyType,
    userCount,
    pairInvite,
    inviteCooldownTicker = 0,
    disableStatusSelect = false,
}) => {
    const { handlers } = useAppContext();
    const isStrategicLobby = lobbyType === 'strategic';
    const [isChallengeSelectionModalOpen, setIsChallengeSelectionModalOpen] = useState(false);
    const [challengeTargetUser, setChallengeTargetUser] = useState<UserWithStatus | null>(null);
    const [isRejectionSettingsModalOpen, setIsRejectionSettingsModalOpen] = useState(false);
    const me = users.find(user => user.id === currentUser.id);

    // 신청자 UI는 ChallengeSelectionModal로 일관 유지 (상대 수정 제안 시에도 닫지 않음)
    const otherUsers = users.filter(user => user.id !== currentUser.id).sort((a,b) => a.nickname.localeCompare(b.nickname));

    const canChallenge = (targetUser: UserWithStatus) => {
        // 서버가 CHALLENGE_USER에서 waiting으로 보정하므로 online/resting도 신청 허용
        // (취소 직후 상태 동기화 지연으로 버튼이 잠기는 현상 방지)
        const canRequesterChallenge =
            currentUser.status === 'waiting' ||
            currentUser.status === 'resting' ||
            currentUser.status === 'online';
        if (!canRequesterChallenge) {
            return false;
        }
        // negotiating: 상대가 나에게 신청 작성 중일 수 있음 — 버튼은 열어두고 서버/수신 모달에서 먼저 신청한 쪽 우선 처리
        return (
            targetUser.status === 'waiting' ||
            targetUser.status === 'online' ||
            targetUser.status === 'negotiating'
        );
    };

    const isPairArenaList = mode === 'pair' && !pairInvite;

    const renderUserItem = (user: UserWithStatus, isCurrentUser: boolean) => {
        const isChallengeable = !isCurrentUser && !isPairArenaList && canChallenge(user);
        const statusInfo = statusDisplay[user.status];
        const isDiceGo = mode === GameMode.Dice;

        const sentNegotiation = !isCurrentUser ? negotiations.find(n => 
            n.challenger.id === currentUser.id && 
            n.opponent.id === user.id && 
            (n.status === 'pending' || n.status === 'draft')
        ) : null;

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
                    <Avatar userId={user.id} userName={user.nickname} size={36} className="border-2 border-color" avatarUrl={avatarUrl} borderUrl={borderUrl} />
                    {isDiceGo && <div className="w-5 h-5 rounded-full bg-black border border-gray-300 flex-shrink-0" />}
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                            className="flex min-w-0 w-full items-baseline justify-between gap-2 overflow-hidden"
                            title={
                                listStats
                                    ? `${user.nickname} ${listStats.score.toLocaleString()}점 · ${listStats.wins}승${listStats.losses}패(${listStats.winRate}%)`
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
                                className="min-w-0 flex-1 truncate font-bold text-sm lg:text-base"
                            />
                            {listStats && (
                                <span className="shrink-0 text-right font-semibold tabular-nums text-xs text-amber-200 lg:text-sm">
                                    {listStats.score.toLocaleString()}점
                                </span>
                            )}
                        </div>
                        <div className="mt-0.5 flex min-w-0 w-full items-center justify-between gap-2">
                            <span className={`shrink-0 text-xs ${statusInfo.color}`}>● {statusInfo.text}</span>
                            {listStats ? (
                                <span className="shrink-0 text-right font-semibold tabular-nums text-[10px] text-secondary lg:text-[11px]">
                                    {listStats.wins}승{listStats.losses}패({listStats.winRate}%)
                                </span>
                            ) : (
                                <span className="shrink-0 text-right text-[10px] text-tertiary lg:text-[11px]">통계 없음</span>
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
                                className="!text-[10px] !py-0.5 !px-1.5 lg:!text-xs bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white font-bold rounded-md shadow-sm whitespace-nowrap"
                            >
                                기보
                            </Button>
                        )}
                        <select
                            value={currentUser.status}
                            onChange={(e) => onAction({ type: 'SET_USER_STATUS', payload: { status: e.target.value } })}
                            disabled={disableStatusSelect || !['waiting', 'resting'].includes(currentUser.status)}
                            className="px-2 py-1 lg:px-3 lg:py-1.5 bg-secondary border border-color rounded-lg text-xs lg:text-sm transition-colors w-20 lg:w-24 text-center focus:ring-accent focus:border-accent disabled:opacity-50"
                            title={disableStatusSelect ? '페어 방에 있을 때는 상태를 바꿀 수 없습니다.' : undefined}
                        >
                            <option value="waiting">대기 중</option>
                            <option value="resting">휴식 중</option>
                            {!['waiting', 'resting'].includes(currentUser.status) && (
                                <option value={currentUser.status} disabled>{statusDisplay[currentUser.status].text}</option>
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
                                className="!text-xs !py-1 !px-2"
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
                        })() : isPairArenaList ? null : sentNegotiation ? (
                             <Button
                                onClick={() => onAction({ type: 'DECLINE_NEGOTIATION', payload: { negotiationId: sentNegotiation.id } })}
                                colorScheme="red"
                                className="!text-xs !py-1 !px-2"
                            >
                                신청 취소
                            </Button>
                        ) : (
                            <Button
                                onClick={() => {
                                    setChallengeTargetUser(user);
                                    setIsChallengeSelectionModalOpen(true);
                                }}
                                disabled={!isChallengeable}
                                className="!text-xs !py-1 !px-2"
                            >
                                대국 신청
                            </Button>
                        )}
                    </div>
                )}
            </li>
        );
    };

    const hideListHeading = Boolean(pairInvite?.modalLayout);

    return (
        <div className={`${hideListHeading ? 'p-2 flex-1 min-h-0' : 'p-3'} flex flex-col min-h-0 text-on-panel`}>
            {!hideListHeading && (
             <h2 className="text-xl font-semibold mb-2 border-b border-color pb-2 flex-shrink-0 flex justify-between items-center">
                <span className="flex items-center gap-2">
                    유저 목록
                    {userCount !== undefined && (
                        <span className="text-sm text-secondary font-normal">({userCount}명 접속 중)</span>
                    )}
                </span>
                {!isPairArenaList && (
                    <Button
                        onClick={() => setIsRejectionSettingsModalOpen(true)}
                        colorScheme="none"
                        className="!text-xs !py-1 !px-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-bold rounded-lg shadow-lg transition-all duration-200"
                    >
                        대국 신청 거부
                    </Button>
                )}
            </h2>
            )}
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
            {!pairInvite && isRejectionSettingsModalOpen && (
                <GameRejectionSettingsModal
                    onClose={() => setIsRejectionSettingsModalOpen(false)}
                    lobbyType={lobbyType}
                />
            )}
            {!pairInvite && isChallengeSelectionModalOpen && challengeTargetUser && (
                <ChallengeSelectionModal
                    opponent={challengeTargetUser}
                    onClose={() => {
                        setIsChallengeSelectionModalOpen(false);
                        setChallengeTargetUser(null);
                    }}
                    negotiations={negotiations}
                    currentUser={currentUser}
                    onChallenge={async (gameMode, settings) => {
                        // 모달을 닫지 않고 유지하여 응답을 기다림
                        
                        // CHALLENGE_USER로 draft negotiation 생성 (친선전)
                        const createChallengeAction = { 
                            type: 'CHALLENGE_USER', 
                            payload: { opponentId: challengeTargetUser.id, mode: gameMode, settings, isRanked: false } 
                        };
                        
                        // handleAction을 직접 호출하여 응답을 받음
                        try {
                            // 배포(프론트/백 분리)에서도 백엔드로 요청되도록 getApiUrl 사용
                            const response = await fetch(getApiUrl('/api/action'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                    ...createChallengeAction,
                                    userId: currentUser.id
                                })
                            });
                            
                            const result = await response.json();
                            if (result.challengeComposerSuperseded === true) {
                                setIsChallengeSelectionModalOpen(false);
                                setChallengeTargetUser(null);
                                return;
                            }
                            const serverError =
                                (typeof result?.error === 'string' && result.error) ||
                                (typeof result?.message === 'string' && result.message) ||
                                (!response.ok ? '대국 신청 생성에 실패했습니다.' : '');

                            if (serverError) {
                                if (isOpponentInsufficientActionPointsError(serverError)) {
                                    handlers.openOpponentInsufficientActionPointsModal();
                                } else {
                                    alert(serverError);
                                }
                                return;
                            }
                            
                            // 응답에서 negotiationId를 받아서 즉시 SEND_CHALLENGE 호출
                            const negotiationId = result.negotiationId || result.clientResponse?.negotiationId;
                            if (negotiationId) {
                                onAction({ 
                                    type: 'SEND_CHALLENGE', 
                                    payload: { negotiationId, settings } 
                                });
                            } else {
                                // negotiationId가 없으면 WebSocket 업데이트를 기다림
                                setTimeout(() => {
                                    const negotiationsArray = Object.values(negotiations || {});
                                    const draftNegotiation = negotiationsArray.find(n => 
                                        n.challenger.id === currentUser.id && 
                                        n.opponent.id === challengeTargetUser.id && 
                                        n.status === 'draft'
                                    );
                                    
                                    if (draftNegotiation) {
                                        onAction({ 
                                            type: 'SEND_CHALLENGE', 
                                            payload: { negotiationId: draftNegotiation.id, settings } 
                                        });
                                    }
                                }, 300);
                            }
                        } catch (error) {
                            console.error('Failed to send challenge:', error);
                            alert('대국 신청 전송에 실패했습니다.');
                        }
                    }}
                    lobbyType={lobbyType}
                />
            )}
        </div>
    );
};

export default PlayerList;