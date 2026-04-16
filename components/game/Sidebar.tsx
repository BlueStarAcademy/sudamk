import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Player, ChatMessage, GameProps, GameMode, User, UserWithStatus, LiveGameSession, ServerAction } from '../../types.js';
import {
    GAME_CHAT_EMOJIS,
    GAME_CHAT_MESSAGES,
    PLAYFUL_GAME_MODES,
    DEFAULT_KOMI,
    AVATAR_POOL,
    BORDER_POOL,
    ALKKAGI_GAUGE_SPEEDS,
    CURLING_GAUGE_SPEEDS,
    SPECIAL_GAME_MODES,
    SINGLE_PLAYER_STAGES,
    ADMIN_USER_ID,
    ADMIN_NICKNAME,
    aiUserId
} from '../../constants/index.js';
import Button from '../Button.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { containsProfanity } from '../../profanity.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { isFischerStyleTimeControl } from '../../shared/utils/gameTimeControl.js';
import { getGuildWarBoardMode, getGuildWarStarConditionLines } from '../../shared/constants/guildConstants.js';
import AdBanner from '../ads/AdBanner.js';
import SinglePlayerGameDescriptionModal from '../SinglePlayerGameDescriptionModal.js';
import AiGameDescriptionModal from '../AiGameDescriptionModal.js';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';
import {
    arenaGameRoomAdminStripClass,
    arenaGameRoomAdminTitleClass,
    arenaGameRoomChatBodyClass,
    arenaGameRoomChatIconToggleClass,
    arenaGameRoomChatInputClass,
    arenaGameRoomChatShellClass,
    arenaGameRoomChatTabActiveClass,
    arenaGameRoomChatTabBarClass,
    arenaGameRoomChatTabInactiveClass,
    arenaGameRoomGuildStarPanelClass,
    arenaGameRoomPanelClass,
    arenaGameRoomPanelTitleClass,
    arenaGameRoomQuickChatEmojiBtnClass,
    arenaGameRoomQuickChatPhraseBtnClass,
    arenaGameRoomQuickChatPopoverClass,
    arenaGameRoomSettingsIconBtnClass,
    arenaGameRoomSidebarLeaveBtnClass,
    arenaGameRoomSidebarPauseBtnClass,
    arenaGameRoomSidebarShell,
    arenaGameRoomSmallCtaClass,
} from './arenaGameRoomStyles.js';


interface SidebarProps extends GameProps {
    onLeaveOrResign: () => void;
    isNoContestLeaveAvailable: boolean;
    onClose?: () => void;
    onOpenSettings?: () => void;
    onTogglePause?: () => void;
    isPaused?: boolean;
    resumeCountdown?: number;
    pauseButtonCooldown?: number;
    /** AI 대국에서 AI 턴일 때 true면 일시정지 버튼 비활성화 (유저 차례에만 일시정지 가능) */
    pauseDisabledBecauseAiTurn?: boolean;
}

export const GameInfoPanel: React.FC<{
    session: LiveGameSession;
    currentUser?: UserWithStatus;
    onClose?: () => void;
    onOpenSettings?: () => void;
    onAction?: GameProps['onAction'];
}> = ({ session, currentUser, onClose, onOpenSettings, onAction }) => {
    const [matchGuideOpen, setMatchGuideOpen] = useState(false);
    const { mode, settings, effectiveCaptureTargets } = session;

    const renderSetting = (label: string, value: React.ReactNode) => (
        value !== undefined && value !== null && value !== '' && (
            <React.Fragment key={label}>
                <div className="font-semibold text-slate-400 whitespace-nowrap">{label}:</div>
                <div className="min-w-0 break-words text-slate-100">{value}</div>
            </React.Fragment>
        )
    );

    const gameDetails = useMemo(() => {
        const details = [];
        const modesWithKomi = [
            GameMode.Standard,
            GameMode.Speed,
            GameMode.Base,
            GameMode.Hidden,
            GameMode.Missile,
            GameMode.Mix,
        ];
        const modesWithoutTime = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief];

        // 게임 모드 이름 결정 (싱글플레이어 살리기 바둑 구분)
        let gameModeDisplayName: string;
        if (session.isSinglePlayer) {
            const isSurvivalMode = (settings as any)?.isSurvivalMode === true;
            if (isSurvivalMode) {
                gameModeDisplayName = '살리기 바둑';
            } else if (mode === GameMode.Capture) {
                gameModeDisplayName = '따내기 바둑';
            } else {
                gameModeDisplayName = mode;
            }
        } else {
            gameModeDisplayName = mode;
        }

        details.push(renderSetting("게임 모드", gameModeDisplayName));
        if (session.isSinglePlayer && session.stageId) {
            const stage = SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
            const stageDisplay = stage ? `${stage.level} · ${stage.name}` : session.stageId;
            details.push(renderSetting("스테이지", stageDisplay));
        }
        if (![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(mode)) {
            details.push(renderSetting("판 크기", `${settings.boardSize}x${settings.boardSize}`));
        }
        
        if (modesWithKomi.includes(mode) && !settings.mixedModes?.includes(GameMode.Base)) {
            details.push(renderSetting("덤", `${session.finalKomi ?? session.settings.komi ?? DEFAULT_KOMI}집`));
        }
       
        // 도전의 탑: 제한시간/초읽기는 무제한이므로 표시하지 않음
        const isTowerGame = (session as any).gameCategory === 'tower';
        const isFischer = isFischerStyleTimeControl(session as any);
        if (!isTowerGame && !modesWithoutTime.includes(mode)) {
            if (settings.timeLimit > 0) {
                details.push(renderSetting("제한시간", `${settings.timeLimit}분`));
                details.push(renderSetting("초읽기", isFischer ? `${settings.timeIncrement}초 피셔` : `${settings.byoyomiTime}초 ${settings.byoyomiCount}회`));
            } else {
                details.push(renderSetting("제한시간", "없음"));
                if (settings.byoyomiTime > 0 && settings.byoyomiCount > 0) {
                    details.push(renderSetting("초읽기", isFischer ? `${settings.timeIncrement}초 피셔` : `${settings.byoyomiTime}초 ${settings.byoyomiCount}회`));
                }
            }
        }
        
        // --- ALL MODE SPECIFIC SETTINGS ---

        if (mode === GameMode.Mix) {
            details.push(renderSetting("조합 규칙", settings.mixedModes?.join(', ')));
        }

        if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
            details.push(renderSetting("쌍삼 금지", settings.has33Forbidden ? '금지' : '가능'));
            details.push(renderSetting("장목 금지", settings.hasOverlineForbidden ? '금지' : '가능'));
        }

        if (mode === GameMode.Ttamok) {
            details.push(renderSetting("따내기 목표", `${settings.captureTarget}개`));
        }
        
        if (mode === GameMode.Capture || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Capture))) {
            const isSurvivalMode = (settings as any)?.isSurvivalMode === true;
            let captureTargetText: string;

            // 도전의 탑: 유저는 항상 흑, 입찰/결정 단계 없음 → "결정 중" 문구 제거
            const isTower = (session as any).gameCategory === 'tower';

            if (effectiveCaptureTargets) {
                if (isTower) {
                    const blackTarget = effectiveCaptureTargets[Player.Black];
                    const whiteTarget = effectiveCaptureTargets[Player.White];
                    captureTargetText = `흑: ${blackTarget} / 백: ${whiteTarget}`;
                } else if (isSurvivalMode) {
                    const blackTarget = effectiveCaptureTargets[Player.Black] === 999 ? '-' : effectiveCaptureTargets[Player.Black];
                    const whiteTarget = effectiveCaptureTargets[Player.White];
                    captureTargetText = `흑: ${blackTarget} / 백: ${whiteTarget}`;
                } else {
                    captureTargetText = `흑: ${effectiveCaptureTargets[Player.Black]} / 백: ${effectiveCaptureTargets[Player.White]}`;
                }
            } else {
                if (isTower) {
                    const baseTarget = settings.captureTarget ?? '-';
                    captureTargetText = `흑: ${baseTarget} / 백: ${baseTarget}`;
                } else {
                    captureTargetText = `${settings.captureTarget}개 (흑/백 결정 중)`;
                }
            }
            details.push(renderSetting("따내기 목표", captureTargetText));
        }
        
        if (mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base))) {
             details.push(renderSetting("베이스돌", `${settings.baseStones}개`));
        }
        
        // 도전의 탑: 턴 추가/미사일/히든/스캔/배치변경은 대기실(가방) 보유 개수만 사용 → 개수 미표시
        if (!isTowerGame && (mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden)))) {
             details.push(renderSetting("히든돌", `${settings.hiddenStoneCount ?? 0}개`));
             details.push(renderSetting("스캔", `${settings.scanCount ?? 0}개`));
        }
        if (!isTowerGame && (mode === GameMode.Missile || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Missile)))) {
             details.push(renderSetting("미사일", `${settings.missileCount}개`));
        }
        if (isTowerGame && (mode === GameMode.Mix || mode === GameMode.Missile || mode === GameMode.Hidden)) {
             details.push(renderSetting("아이템", "대기실 보유 개수 사용"));
        }

        if (SPECIAL_GAME_MODES.some(m => m.mode === mode) && settings.scoringTurnLimit != null && settings.scoringTurnLimit > 0) {
            details.push(renderSetting("계가까지 턴", `${settings.scoringTurnLimit}턴`));
        }
        
        if (mode === GameMode.Dice) {
            details.push(renderSetting("라운드", `${settings.diceGoRounds}R`));
            details.push(renderSetting("홀수 아이템", `${settings.oddDiceCount ?? 0}개`));
            details.push(renderSetting("짝수 아이템", `${settings.evenDiceCount ?? 0}개`));
            details.push(renderSetting("낮은 수 아이템 (1~3)", `${settings.lowDiceCount ?? 0}개`));
            details.push(renderSetting("높은 수 아이템 (4~6)", `${settings.highDiceCount ?? 0}개`));
        }
        
        if (mode === GameMode.Alkkagi) {
            const speedLabel = ALKKAGI_GAUGE_SPEEDS.find(s => s.value === settings.alkkagiGaugeSpeed)?.label || '보통';
            details.push(renderSetting("라운드", `${settings.alkkagiRounds}R`));
            details.push(renderSetting("돌 개수", `${settings.alkkagiStoneCount}개`));
            details.push(renderSetting("배치 방식", settings.alkkagiPlacementType));
            details.push(renderSetting("배치 전장", settings.alkkagiLayout));
            details.push(renderSetting("게이지 속도", speedLabel));
            details.push(renderSetting("슬로우 아이템", `${settings.alkkagiSlowItemCount}개`));
            details.push(renderSetting("조준선 아이템", `${settings.alkkagiAimingLineItemCount}개`));
        }
        
        if (mode === GameMode.Curling) {
            const speedLabel = CURLING_GAUGE_SPEEDS.find(s => s.value === settings.curlingGaugeSpeed)?.label || '보통';
            details.push(renderSetting("스톤 개수", `${settings.curlingStoneCount}개`));
            details.push(renderSetting("라운드", `${settings.curlingRounds}R`));
            details.push(renderSetting("게이지 속도", speedLabel));
            details.push(renderSetting("슬로우 아이템", `${settings.curlingSlowItemCount}개`));
            details.push(renderSetting("조준선 아이템", `${settings.curlingAimingLineItemCount}개`));
        }

        return details.filter(Boolean);
    }, [session]);


    return (
        <>
            <div className={`${arenaGameRoomPanelClass} flex-shrink-0`}>
                <h3 className={arenaGameRoomPanelTitleClass}>
                    <span className="min-w-0 shrink">대국 정보</span>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setMatchGuideOpen(true)}
                            className={arenaGameRoomSmallCtaClass}
                            title="시작 전 게임 설명과 동일한 규칙·설정 안내"
                            aria-label="경기방법 안내 열기"
                        >
                            경기방법
                        </button>
                        {onOpenSettings && (
                            <button
                                onClick={onOpenSettings}
                                className={arenaGameRoomSettingsIconBtnClass}
                                title="설정"
                                aria-label="대국 설정 열기"
                            >
                                ⚙️
                            </button>
                        )}
                        {onClose && (
                            <button type="button" onClick={onClose} className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS} aria-label="닫기">
                                닫기
                            </button>
                        )}
                    </div>
                </h3>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs">
                    {gameDetails}
                </div>
            </div>
            {matchGuideOpen && (
                session.isSinglePlayer || session.gameCategory === 'singleplayer' || session.gameCategory === 'tower' ? (
                    <SinglePlayerGameDescriptionModal
                        session={session}
                        readOnly
                        currentUser={currentUser}
                        onClose={() => setMatchGuideOpen(false)}
                        onTowerItemPurchase={
                            session.gameCategory === 'tower' && onAction
                                ? async (itemId, quantity) => {
                                      await onAction({ type: 'BUY_TOWER_ITEM', payload: { itemId, quantity } } as ServerAction);
                                  }
                                : undefined
                        }
                    />
                ) : (
                    <AiGameDescriptionModal
                        session={session}
                        currentUser={currentUser}
                        readOnly
                        onClose={() => setMatchGuideOpen(false)}
                        onAction={() => {}}
                    />
                )
            )}
        </>
    );
};

const UserListPanel: React.FC<SidebarProps & { onClose?: () => void }> = ({ session, onlineUsers, currentUser, onClose, onAction, onViewUser }) => {
    const { player1, player2, blackPlayerId, whitePlayerId, gameStatus, isAiGame } = session;
    const isGuildWarGame = session.gameCategory === 'guildwar';

    // Derive players and spectators from the live onlineUsers list for accuracy
    const playersInRoom = useMemo(() => {
        return onlineUsers
            .filter((u) => {
                if (u.status !== 'in-game' || u.gameId !== session.id) return false;
                // 대기실 AI 대국: 온라인 목록에 봇 계정이 잡히면 유저 목록에 중복·노이즈 → 표시 제외 (상단 패널에만 봇 표시)
                if (session.isAiGame && u.id === aiUserId) return false;
                return true;
            })
            .sort((a, b) => {
                if (a.id === blackPlayerId) return -1;
                if (b.id === blackPlayerId) return 1;
                return 0; // white player will be second
            });
    }, [onlineUsers, session.id, blackPlayerId, session.isAiGame]);

    const spectators = useMemo(() => {
        return onlineUsers.filter(u => u.status === 'spectating' && u.spectatingGameId === session.id);
    }, [onlineUsers, session.id]);

    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const rematchRequested = gameStatus === 'rematch_pending';

    const handleRematch = (opponentId: string) => {
        onAction({ type: 'REQUEST_REMATCH', payload: { opponentId, originalGameId: session.id } });
    };

    const renderUser = (user: UserWithStatus, role: '흑' | '백' | '관전') => {
        const isMe = user.id === currentUser.id;
        const isOpponent = !isMe && (user.id === player1.id || user.id === player2.id);

        const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;

        return (
            <div key={user.id} className={`flex items-center gap-2 p-1 rounded-lg transition-colors ${isMe ? 'bg-sky-950/45 ring-1 ring-inset ring-sky-500/15' : 'hover:bg-white/[0.04]'}`}>
                <Avatar userId={user.id} userName={user.nickname} size={28} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                <div 
                    className={`flex items-center gap-2 flex-grow overflow-hidden ${!isMe ? 'cursor-pointer' : ''}`}
                    onClick={() => !isMe && onViewUser(user.id)}
                    title={!isMe ? `${user.nickname} 프로필 보기` : ''}
                >
                    <UserNicknameText
                        user={{
                            nickname: user.nickname,
                            isAdmin: user.isAdmin,
                            staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                        }}
                        className="font-semibold truncate text-sm"
                    />
                    {/* 재대결 버튼은 하단 대국 기능 패널로 이동 */}
                </div>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{role}</span>
            </div>
         )
    }

    return (
        <div className={`${arenaGameRoomPanelClass} flex flex-col`}>
            <h3 className={`${arenaGameRoomPanelTitleClass} flex-shrink-0`}>
                유저 목록
                {onClose && (
                    <button type="button" onClick={onClose} className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS} aria-label="닫기">
                        닫기
                    </button>
                )}
            </h3>
            <div className="space-y-0.5 overflow-y-auto pr-1 flex-grow min-h-0" style={{ maxHeight: '7.5rem' }}>
                {playersInRoom.map(user => renderUser(user, user.id === blackPlayerId ? '흑' : '백'))}
                {spectators.map(user => renderUser(user, '관전'))}
            </div>
        </div>
    );
};


export const ChatPanel: React.FC<Omit<SidebarProps, 'onLeaveOrResign' | 'isNoContestLeaveAvailable'>> = (props) => {
    const { session, isSpectator, onAction, waitingRoomChat, gameChat, onClose, onViewUser } = props;
    const { mode } = session;
    const { currentUserWithStatus, handlers, allUsers, guilds } = useAppContext();
    const isAiGame = session.isAiGame;

    const [activeTab, setActiveTab] = useState<'game' | 'global' | 'guild'>(isAiGame ? 'global' : 'game');
    const [guildMessages, setGuildMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const quickChatRef = useRef<HTMLDivElement>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);

    // 길드 채팅 메시지 로드
    useEffect(() => {
        if (currentUserWithStatus?.guildId && guilds[currentUserWithStatus.guildId]) {
            const guild = guilds[currentUserWithStatus.guildId];
            if (guild.chatHistory) {
                setGuildMessages(guild.chatHistory);
            }
        } else {
            setGuildMessages([]);
        }
    }, [currentUserWithStatus?.guildId, guilds]);

    const activeChatMessages = activeTab === 'game' ? gameChat : (activeTab === 'guild' ? guildMessages : waitingRoomChat);
    
    useEffect(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight; }, [activeChatMessages]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => {
                setCooldown(prev => Math.max(0, prev - 1));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickChatRef.current && !quickChatRef.current.contains(event.target as Node)) setShowQuickChat(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 싱글플레이, 도전의 탑, 전략/놀이바둑 명확히 구분 (gameCategory·isSinglePlayer 우선)
    let locationPrefix: string;
    if (session.gameCategory === 'tower') {
        locationPrefix = '[도전의탑]';
    } else if (session.gameCategory === 'singleplayer' || session.isSinglePlayer) {
        locationPrefix = '[싱글플레이]';
    } else {
        // 전략바둑/놀이바둑 대기실 게임만 [전략:모드] / [놀이:모드]
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
        const lobbyType = isStrategic ? '전략' : '놀이';
        locationPrefix = `[${lobbyType}:${mode}]`;
    }

    const handleSend = (message: { text?: string, emoji?: string }) => {
        if(isSpectator || cooldown > 0) return;
        
        if (activeTab === 'guild') {
            // 길드 채팅 전송
            handlers.handleAction({ type: 'SEND_GUILD_CHAT_MESSAGE', payload: { content: message.text || '' } });
        } else {
            const channel = activeTab === 'game' ? session.id : 'global';
            const payload: any = { channel, ...message };

            if (channel === 'global') {
                payload.location = locationPrefix;
            }

            onAction({ type: 'SEND_CHAT_MESSAGE', payload });
        }
        setShowQuickChat(false); setChatInput('');
        setCooldown(5);
    };

    const handleSendTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            if (containsProfanity(chatInput)) {
                alert("부적절한 단어가 포함되어 있어 메시지를 전송할 수 없습니다.");
                setChatInput('');
                return;
            }
            handleSend({ text: chatInput });
        }
    };
    
    if (!currentUserWithStatus) return null;

    const handleUserClick = (userId: string) => {
        if (currentUserWithStatus.isAdmin && userId !== currentUserWithStatus.id) {
            handlers.openModerationModal(userId);
        } else if (userId !== currentUserWithStatus.id) {
            onViewUser(userId);
        }
    };

    const isBanned = (currentUserWithStatus.chatBanUntil ?? 0) > Date.now();
    const banTimeLeft = isBanned ? Math.ceil((currentUserWithStatus.chatBanUntil! - Date.now()) / 1000 / 60) : 0;
    const isInputDisabled = isBanned || cooldown > 0;
    const placeholderText = isBanned 
        ? `채팅 금지 중 (${banTimeLeft}분 남음)` 
        : isInputDisabled
            ? `(${cooldown}초)`
            : "[메시지 입력]";
    
    return (
        <div className={arenaGameRoomChatShellClass}>
            {isAiGame ? (
                currentUserWithStatus?.guildId ? (
                    <div className={`${arenaGameRoomChatTabBarClass} mb-2`}>
                        <button type="button" onClick={() => setActiveTab('global')} className={activeTab === 'global' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass}>전체채팅</button>
                        <button type="button" onClick={() => setActiveTab('guild')} className={activeTab === 'guild' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass}>길드채팅</button>
                    </div>
                ) : (
                    <h3 className={`${arenaGameRoomPanelTitleClass} flex-shrink-0 border-b-0 mb-2 pb-0`}>전체채팅</h3>
                )
            ) : (
                <div className={`${arenaGameRoomChatTabBarClass} mb-2`}>
                    <button type="button" onClick={() => setActiveTab('game')} className={activeTab === 'game' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass}>대국실</button>
                    <button type="button" onClick={() => setActiveTab('global')} className={activeTab === 'global' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass}>전체채팅</button>
                    {currentUserWithStatus?.guildId && (
                        <button type="button" onClick={() => setActiveTab('guild')} className={activeTab === 'guild' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass}>길드채팅</button>
                    )}
                </div>
            )}
            <div ref={chatBodyRef} className={arenaGameRoomChatBodyClass}>
                {activeTab === 'guild' ? (
                    // 길드 채팅 메시지 표시 (파란색)
                    activeChatMessages.length > 0 ? (
                        activeChatMessages.map((msg: any) => {
                            const senderId = msg.user?.id || msg.authorId;
                            const sender = senderId && senderId !== 'system' ? allUsers.find(u => u.id === senderId) : undefined;
                            const isSystem = senderId === 'system';
                            const displayName = isSystem ? '시스템' : (msg.user?.nickname || (senderId === ADMIN_USER_ID || sender?.isAdmin ? ADMIN_NICKNAME : sender?.nickname) || 'Unknown');
                            
                            return (
                                <div key={msg.id || msg.timestamp || msg.createdAt} className="text-sm">
                                    <span className={`font-semibold pr-2 ${isSystem ? 'text-blue-400' : 'text-blue-300 cursor-pointer hover:underline'}`}>
                                        {displayName}:
                                    </span>
                                    <span className="text-blue-300">{msg.text || msg.content || ''}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex items-center justify-center text-tertiary text-sm">길드 채팅 메시지가 없습니다.</div>
                    )
                ) : (
                    // 전체 채팅 메시지 표시
                    <>
                        {activeChatMessages.map(msg => {
                            const isBotMessage = msg.system && !msg.actionInfo && msg.user.nickname === 'AI 보안관봇';
                            return (
                                <div key={msg.id} className="text-sm">
                            {msg.actionInfo ? (
                                <>
                                    <span className="font-semibold text-gray-400 pr-2">{msg.user.nickname}:</span>
                                    <span className="text-yellow-400">{msg.actionInfo.message}</span>
                                    <span className="text-gray-400"> (매너 </span>
                                    <span className={msg.actionInfo.scoreChange > 0 ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
                                        {msg.actionInfo.scoreChange > 0 ? `+${msg.actionInfo.scoreChange}` : msg.actionInfo.scoreChange}
                                    </span>
                                    <span className="text-gray-400">)</span>
                                </>
                            ) : (
                                <>
                                    {msg.location && <span className="font-semibold text-gray-500 pr-1">{msg.location}</span>}
                                    <span 
                                        className={`font-semibold pr-2 ${msg.system ? 'text-yellow-400' : 'text-gray-400 cursor-pointer hover:underline'}`}
                                        onClick={() => !msg.system && handleUserClick(msg.user.id)}
                                        title={!msg.system ? `${msg.user.nickname} 프로필 보기 / 제재` : ''}
                                    >
                                        {msg.system ? (isBotMessage ? 'AI 보안관봇' : '시스템') : msg.user.nickname}:
                                    </span>
                                    {msg.text && (() => {
                                        const textStr = msg.text;
                                        const parts: (string | React.ReactElement)[] = [];
                                        let currentIndex = 0;
                                        
                                        // 사용자 이름과 장비 이름의 위치 찾기
                                        const userLinkIndex = msg.userLink ? textStr.indexOf(`${msg.userLink.userName}님`) : -1;
                                        const itemLinkIndex = msg.itemLink ? textStr.indexOf(msg.itemLink.itemName) : -1;
                                        
                                        // 정렬된 인덱스 배열 생성
                                        const linkIndices: Array<{ type: 'user' | 'item', index: number, length: number }> = [];
                                        if (userLinkIndex >= 0 && msg.userLink) {
                                            linkIndices.push({ type: 'user', index: userLinkIndex, length: `${msg.userLink.userName}님`.length });
                                        }
                                        if (itemLinkIndex >= 0 && msg.itemLink) {
                                            linkIndices.push({ type: 'item', index: itemLinkIndex, length: msg.itemLink.itemName.length });
                                        }
                                        linkIndices.sort((a, b) => a.index - b.index);
                                        
                                        // 링크가 없는 경우
                                        if (linkIndices.length === 0) {
                                            return <span className={isBotMessage ? 'text-yellow-400' : ''}>{textStr}{isBotMessage && ' 🚓'}</span>;
                                        }
                                        
                                        // 링크가 있는 경우 순차적으로 처리
                                        linkIndices.forEach((link, idx) => {
                                            // 링크 이전 텍스트 추가
                                            if (link.index > currentIndex) {
                                                parts.push(textStr.substring(currentIndex, link.index));
                                            }
                                            
                                            // 링크 추가
                                            if (link.type === 'user' && msg.userLink) {
                                                parts.push(
                                                    <span 
                                                        key={`user-${idx}`}
                                                        className="text-blue-400 cursor-pointer hover:underline font-semibold"
                                                        onClick={() => handleUserClick(msg.userLink!.userId)}
                                                        title={`${msg.userLink.userName} 프로필 보기 / 제재`}
                                                    >
                                                        {msg.userLink.userName}
                                                    </span>
                                                );
                                                parts.push('님');
                                            } else if (link.type === 'item' && msg.itemLink) {
                                                // 등급별 색상 매핑
                                                const gradeColorMap: Record<string, string> = {
                                                    'normal': 'text-gray-300',
                                                    'uncommon': 'text-green-400',
                                                    'rare': 'text-blue-400',
                                                    'epic': 'text-purple-400',
                                                    'legendary': 'text-red-500',
                                                    'mythic': 'text-orange-400'
                                                };
                                                const itemGrade = msg.itemLink.itemGrade || 'normal';
                                                const gradeColor = gradeColorMap[itemGrade] || 'text-gray-300';
                                                
                                                parts.push(
                                                    <span 
                                                        key={`item-${idx}`}
                                                        className={`${gradeColor} cursor-pointer hover:underline font-semibold`}
                                                        onClick={() => {
                                                            const targetUser = allUsers.find(u => u.id === msg.itemLink!.userId);
                                                            if (targetUser) {
                                                                const item = targetUser.inventory?.find(i => i.id === msg.itemLink!.itemId);
                                                                if (item) {
                                                                    handlers.openViewingItem(item, targetUser.id === currentUserWithStatus?.id);
                                                                }
                                                            }
                                                        }}
                                                        title={`${msg.itemLink.itemName} 클릭하여 상세 정보 보기`}
                                                    >
                                                        {msg.itemLink.itemName}
                                                    </span>
                                                );
                                            }
                                            
                                            currentIndex = link.index + link.length;
                                        });
                                        
                                        // 마지막 텍스트 추가
                                        if (currentIndex < textStr.length) {
                                            parts.push(textStr.substring(currentIndex));
                                        }
                                        
                                        return <span className={isBotMessage ? 'text-yellow-400' : ''}>{parts}{isBotMessage && ' 🚓'}</span>;
                                    })()}
                                        {msg.emoji && <span className="text-xl">{msg.emoji}</span>}
                                    </>
                                )}
                            </div>
                        );
                        })}
                        {activeChatMessages.length === 0 && <div className="h-full flex items-center justify-center text-gray-500 text-sm">채팅 메시지가 없습니다.</div>}
                    </>
                )}
            </div>
            {!isSpectator && (
                <div className="relative flex-shrink-0">
                   {showQuickChat && (
                       <div ref={quickChatRef} className={arenaGameRoomQuickChatPopoverClass}>
                           <div className="grid grid-cols-5 gap-2 text-2xl mb-2 border-b border-slate-600/45 pb-2">
                              {GAME_CHAT_EMOJIS.map(emoji => ( <button key={emoji} type="button" onClick={() => handleSend({ emoji })} className={arenaGameRoomQuickChatEmojiBtnClass}> {emoji} </button> ))}
                           </div>
                           <ul className="space-y-1">
                              {GAME_CHAT_MESSAGES.map(msg => ( <li key={msg}> <button type="button" onClick={() => handleSend({ text: msg })} className={arenaGameRoomQuickChatPhraseBtnClass}> {msg} </button> </li> ))}
                           </ul>
                       </div>
                   )}
                   <form onSubmit={handleSendTextSubmit} className="flex gap-2">
                        <button type="button" onClick={() => setShowQuickChat(s => !s)} className={arenaGameRoomChatIconToggleClass} title="빠른 채팅" disabled={isInputDisabled}>
                            <span>🙂</span>
                        </button>
                       <input
                           type="text"
                           value={chatInput}
                           onChange={e => setChatInput(e.target.value)}
                           placeholder={placeholderText}
                           className={arenaGameRoomChatInputClass}
                           maxLength={30}
                           disabled={isInputDisabled}
                       />
                       <Button type="submit" bare disabled={!chatInput.trim() || isInputDisabled} colorScheme="none" title="보내기" className="!px-3 !py-2 rounded-lg border border-sky-600/40 bg-gradient-to-b from-sky-700/90 to-sky-950 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 disabled:opacity-40 disabled:grayscale">
                            💬
                       </Button>
                   </form>
                </div>
            )}
        </div>
    );
};

const GuildWarStarConditionsPanel: React.FC<{ session: LiveGameSession }> = ({ session }) => {
    if (session.gameCategory !== 'guildwar') return null;
    const boardId = (session as any).guildWarBoardId as string | undefined;
    const boardMode = boardId ? getGuildWarBoardMode(boardId) : undefined;
    const lines = getGuildWarStarConditionLines(boardMode, boardId);

    return (
        <div className={arenaGameRoomGuildStarPanelClass}>
            <h3 className={`${arenaGameRoomPanelTitleClass} border-amber-700/25`}>별 획득 조건</h3>
            <div className="space-y-1">
                {lines.map((line) => (
                    <div key={line} className="text-xs text-gray-200">
                        {line}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
    const { session, onLeaveOrResign, isNoContestLeaveAvailable, isSpectator, onTogglePause, isPaused = false, resumeCountdown = 0, pauseButtonCooldown = 0, pauseDisabledBecauseAiTurn = false } = props;
    const { gameStatus } = session;

    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
    const isPauseButtonDisabled = (isPaused && resumeCountdown > 0) || (!isPaused && pauseButtonCooldown > 0) || pauseDisabledBecauseAiTurn;

    const leaveButtonText = isNoContestLeaveAvailable ? '무효처리' : (isGameEnded ? '대기실로' : (isSpectator ? '관전종료' : '기권하기'));

    return (
        <div className={`${arenaGameRoomSidebarShell} gap-2`}>
            <div className="flex-shrink-0 space-y-2">
                <GameInfoPanel
                    session={session}
                    currentUser={props.currentUser}
                    onClose={props.onClose}
                    onOpenSettings={props.onOpenSettings}
                    onAction={props.onAction}
                />
                <UserListPanel {...props} />
                <GuildWarStarConditionsPanel session={session} />
                {/* PC 사이드바 광고 (300×250) */}
                <AdBanner position="sidebar" />
            </div>
            <div className="flex-1 mt-2 min-h-0">
                <ChatPanel {...props} />
            </div>
            {isSpectator && props.currentUser?.isAdmin && !isGameEnded && (
                <div className={arenaGameRoomAdminStripClass}>
                    <h3 className={arenaGameRoomAdminTitleClass}>관리자 기능</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            bare
                            onClick={() => {
                                if (window.confirm(`${session.player2?.nickname}님 기권승(승자: ${session.player1?.nickname}) 처리하시겠습니까?`)) {
                                    props.onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId: session.id, winnerId: session.player1?.id } });
                                }
                            }}
                            colorScheme="none"
                            className={`${arenaGameRoomSidebarLeaveBtnClass(false)} !py-2 !px-3 !text-xs !min-h-0`}
                        >
                            {session.player2?.nickname} 기권승
                        </Button>
                        <Button
                            bare
                            onClick={() => {
                                if (window.confirm(`${session.player1?.nickname}님 기권승(승자: ${session.player2?.nickname}) 처리하시겠습니까?`)) {
                                    props.onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId: session.id, winnerId: session.player2?.id } });
                                }
                            }}
                            colorScheme="none"
                            className={`${arenaGameRoomSidebarLeaveBtnClass(false)} !py-2 !px-3 !text-xs !min-h-0`}
                        >
                            {session.player1?.nickname} 기권승
                        </Button>
                    </div>
                </div>
            )}
            <div className="flex-shrink-0 pt-2">
                {isPausableAiGame && !isGameEnded && !isSpectator && onTogglePause ? (
                    <Button
                        bare
                        onClick={onTogglePause}
                        colorScheme="none"
                        className={`w-full ${arenaGameRoomSidebarPauseBtnClass(isPaused)}`}
                        disabled={isPauseButtonDisabled}
                        title={pauseDisabledBecauseAiTurn ? '내 차례에만 일시정지할 수 있습니다' : undefined}
                    >
                        {isPaused
                            ? (resumeCountdown > 0 ? `대국 재개 (${resumeCountdown})` : '대국 재개')
                            : (pauseButtonCooldown > 0 ? `일시 정지 (${pauseButtonCooldown})` : (pauseDisabledBecauseAiTurn ? '일시 정지 (AI 차례)' : '일시 정지'))}
                    </Button>
                ) : (
                    <Button bare onClick={onLeaveOrResign} colorScheme="none" className={`w-full ${arenaGameRoomSidebarLeaveBtnClass(isNoContestLeaveAvailable)}`}>
                        {leaveButtonText}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default Sidebar;