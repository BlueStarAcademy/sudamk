import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '../../shared/i18n/runtimeText.js';
import { useLocalizedGameMode } from '../../shared/i18n/localizedCatalog.js';
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
import { mixSubRuleDisplayName } from '../../shared/utils/mixSubRuleDisplayName.js';
import { pairSeatMatchesViewerUser, pairTurnSeatIdShortLabel } from '../../shared/utils/pairGameTurn.js';
import { formatDiceGoSpecialDiceSummary } from '../../shared/utils/diceGoSettings.js';
import {
    getGuildWarBoardMode,
    getGuildWarBoardRuleModeFromGameMode,
    getGuildWarStarConditionLines,
    GUILD_WAR_STAR_CAPTURE_TIER2_MIN,
    GUILD_WAR_STAR_CAPTURE_TIER3_MIN,
} from '../../shared/constants/guildConstants.js';
import AdBanner from '../ads/AdBanner.js';
import SinglePlayerGameDescriptionModal from '../SinglePlayerGameDescriptionModal.js';
import AiGameDescriptionModal from '../AiGameDescriptionModal.js';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';
import { resolveLiveSessionSinglePlayerStageRow } from '../../shared/utils/liveSessionSinglePlayerStage.js';
import { CHESS_GO_BOARD_SIZE } from '../../shared/utils/chessGoRules.js';
import {
    arenaGameRoomAdminStripClass,
    arenaGameRoomAdminTitleClass,
    arenaGameRoomChatBodyClass,
    arenaGameRoomChatIconToggleClass,
    arenaGameRoomChatInputClass,
    arenaGameRoomChatShellClass,
    arenaGameRoomChatTabActiveClass,
    arenaGameRoomChatTabActiveDrawerClass,
    arenaGameRoomChatTabBarClass,
    arenaGameRoomChatTabInactiveClass,
    arenaGameRoomChatTabInactiveDrawerClass,
    arenaGameRoomGuildStarPanelClass,
    arenaGameRoomPanelClass,
    arenaGameRoomPanelTitleClass,
    arenaGameRoomQuickChatEmojiBtnClass,
    arenaGameRoomQuickChatPhraseBtnClass,
    arenaGameRoomQuickChatPopoverClass,
    arenaGameRoomSidebarLeaveBtnClass,
    arenaGameRoomSidebarPauseBtnClass,
    arenaGameRoomSidebarShell,
    arenaGameRoomSmallCtaClass,
} from './arenaGameRoomStyles.js';


interface SidebarProps extends GameProps {
    /** 모바일 인게임 우측 서랍: 광고 제외·타이포 통일 */
    sidebarLayout?: 'desktop' | 'mobileDrawer';
    onLeaveOrResign: () => void;
    isNoContestLeaveAvailable: boolean;
    onClose?: () => void;
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
    onAction?: GameProps['onAction'];
    sidebarLayout?: 'desktop' | 'mobileDrawer';
    singlePlayerStagesListRevision?: number;
}> = ({ session, currentUser, onClose, onAction, sidebarLayout, singlePlayerStagesListRevision = 0 }) => {
    const { t } = useTranslation('game');
    const { t: tCommon } = useTranslation('common');
    const drawerUi = sidebarLayout === 'mobileDrawer';
    const [matchGuideOpen, setMatchGuideOpen] = useState(false);
    const { mode, settings, effectiveCaptureTargets } = session;

    const detailText = drawerUi ? 'text-[13px] leading-snug' : 'text-xs leading-snug';
    const renderSetting = (label: string, value: React.ReactNode) => (
        value !== undefined && value !== null && value !== '' && (
            <React.Fragment key={label}>
                <div className={`font-semibold text-slate-400 whitespace-nowrap ${detailText}`}>{label}:</div>
                <div className={`min-w-0 break-words text-slate-100 ${detailText}`}>{value}</div>
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
                gameModeDisplayName = t('sidebar.settings.survivalGo');
            } else if (mode === GameMode.Capture) {
                gameModeDisplayName = t('sidebar.settings.captureGo');
            } else {
                gameModeDisplayName = mode;
            }
        } else {
            gameModeDisplayName = mode;
        }

        details.push(renderSetting(t('sidebar.settings.gameMode'), gameModeDisplayName));
        if (session.isSinglePlayer && session.stageId) {
            const stage = resolveLiveSessionSinglePlayerStageRow(session);
            const stageDisplay = stage ? `${stage.level} · ${stage.name}` : session.stageId;
            details.push(renderSetting(t('sidebar.settings.stage'), stageDisplay));
        }
        if (![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(mode)) {
            const boardSizeLabel =
                mode === GameMode.Chess ? CHESS_GO_BOARD_SIZE : settings.boardSize;
            details.push(renderSetting(t('sidebar.settings.boardSize'), `${boardSizeLabel}x${boardSizeLabel}`));
        }
        
        if (modesWithKomi.includes(mode) && !settings.mixedModes?.includes(GameMode.Base)) {
            details.push(renderSetting(t('sidebar.settings.komi'), t('sidebar.settings.komiValue', { komi: session.finalKomi ?? session.settings.komi ?? DEFAULT_KOMI })));
        }
       
        // 도전의 탑: 제한시간/초읽기는 무제한이므로 표시하지 않음
        const isTowerGame = (session as any).gameCategory === 'tower';
        const isFischer = isFischerStyleTimeControl(session as any);
        if (!isTowerGame && !modesWithoutTime.includes(mode)) {
            if (settings.timeLimit > 0) {
                details.push(renderSetting(t('sidebar.settings.timeLimit'), t('sidebar.settings.timeLimitMin', { minutes: settings.timeLimit })));
                details.push(renderSetting(t('sidebar.settings.byoyomi'), isFischer ? t('sidebar.settings.byoyomiFischer', { seconds: settings.timeIncrement }) : t('sidebar.settings.byoyomiCount', { seconds: settings.byoyomiTime, count: settings.byoyomiCount })));
            } else {
                details.push(renderSetting(t('sidebar.settings.timeLimit'), t('sidebar.settings.none')));
                if (settings.byoyomiTime > 0 && settings.byoyomiCount > 0) {
                    details.push(renderSetting(t('sidebar.settings.byoyomi'), isFischer ? t('sidebar.settings.byoyomiFischer', { seconds: settings.timeIncrement }) : t('sidebar.settings.byoyomiCount', { seconds: settings.byoyomiTime, count: settings.byoyomiCount })));
                }
            }
        }
        
        // --- ALL MODE SPECIFIC SETTINGS ---

        if (mode === GameMode.Mix) {
            details.push(renderSetting(
                t('sidebar.settings.mixRules'),
                settings.mixedModes?.map((m) => mixSubRuleDisplayName(String(m))).join(', '),
            ));
        }

        if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
            details.push(renderSetting(t('sidebar.settings.forbid33'), settings.has33Forbidden ? t('sidebar.settings.forbidden') : t('sidebar.settings.allowed')));
            details.push(renderSetting(t('sidebar.settings.forbidOverline'), settings.hasOverlineForbidden ? t('sidebar.settings.forbidden') : t('sidebar.settings.allowed')));
        }

        if (mode === GameMode.Ttamok) {
            details.push(renderSetting(t('sidebar.settings.captureTarget'), t('sidebar.settings.captureTargetCount', { count: settings.captureTarget })));
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
                    captureTargetText = t('sidebar.settings.captureTargetBoth', { black: blackTarget, white: whiteTarget });
                } else if (isSurvivalMode) {
                    const blackTarget = effectiveCaptureTargets[Player.Black] === 999 ? '-' : effectiveCaptureTargets[Player.Black];
                    const whiteTarget = effectiveCaptureTargets[Player.White];
                    captureTargetText = t('sidebar.settings.captureTargetBoth', { black: blackTarget, white: whiteTarget });
                } else {
                    captureTargetText = t('sidebar.settings.captureTargetBoth', { black: effectiveCaptureTargets[Player.Black], white: effectiveCaptureTargets[Player.White] });
                }
            } else {
                if (isTower) {
                    const baseTarget = settings.captureTarget ?? '-';
                    captureTargetText = t('sidebar.settings.captureTargetBoth', { black: baseTarget, white: baseTarget });
                } else {
                    captureTargetText = t('sidebar.settings.captureTargetPending', { count: settings.captureTarget });
                }
            }
            details.push(renderSetting(t('sidebar.settings.captureTarget'), captureTargetText));
        }
        
        if (mode === GameMode.Castle) {
            details.push(renderSetting(t('sidebar.settings.castle'), t('sidebar.settings.castleCount', { count: settings.castleCount ?? 1 })));
        }

        if (mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base))) {
             details.push(renderSetting(t('sidebar.settings.baseStones'), t('sidebar.settings.captureTargetCount', { count: settings.baseStones })));
        }
        
        // 도전의 탑: 턴 추가/미사일/히든/스캔/배치변경은 대기실(가방) 보유 개수만 사용 → 개수 미표시
        if (!isTowerGame && (mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden)))) {
             details.push(renderSetting(t('sidebar.settings.hiddenStones'), t('sidebar.settings.captureTargetCount', { count: settings.hiddenStoneCount ?? 0 })));
             details.push(renderSetting(t('sidebar.settings.scan'), t('sidebar.settings.captureTargetCount', { count: settings.scanCount ?? 0 })));
        }
        if (!isTowerGame && (mode === GameMode.Missile || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Missile)))) {
             details.push(renderSetting(t('sidebar.settings.missile'), t('sidebar.settings.captureTargetCount', { count: settings.missileCount })));
        }
        if (isTowerGame && (mode === GameMode.Mix || mode === GameMode.Missile || mode === GameMode.Hidden)) {
             details.push(renderSetting(t('sidebar.settings.itemsFromLobby'), t('sidebar.settings.itemsFromLobbyValue')));
        }

        if (!settings.pairGame && mode !== GameMode.Castle && SPECIAL_GAME_MODES.some(m => m.mode === mode) && settings.scoringTurnLimit != null && settings.scoringTurnLimit > 0) {
            details.push(renderSetting(t('sidebar.settings.scoringTurnLimit'), t('sidebar.settings.scoringTurnLimitValue', { count: settings.scoringTurnLimit })));
        }
        
        if (mode === GameMode.Dice) {
            details.push(renderSetting(t('sidebar.settings.round'), `${settings.diceGoRounds}R`));
            details.push(renderSetting(t('sidebar.settings.specialDice'), formatDiceGoSpecialDiceSummary(settings)));
        }
        
        if (mode === GameMode.Alkkagi) {
            const speedLabel = ALKKAGI_GAUGE_SPEEDS.find(s => s.value === settings.alkkagiGaugeSpeed)?.label || t('sidebar.settings.speedNormal');
            details.push(renderSetting(t('sidebar.settings.round'), `${settings.alkkagiRounds}R`));
            details.push(renderSetting(t('sidebar.settings.stoneCount'), t('sidebar.settings.captureTargetCount', { count: settings.alkkagiStoneCount })));
            details.push(renderSetting(t('sidebar.settings.placementType'), settings.alkkagiPlacementType));
            details.push(renderSetting(t('sidebar.settings.placementField'), settings.alkkagiLayout));
            details.push(renderSetting(t('sidebar.settings.gaugeSpeed'), speedLabel));
            details.push(renderSetting(t('sidebar.settings.slow'), t('sidebar.settings.captureTargetCount', { count: settings.alkkagiSlowItemCount })));
            details.push(renderSetting(t('sidebar.settings.aimingLine'), t('sidebar.settings.captureTargetCount', { count: settings.alkkagiAimingLineItemCount })));
        }
        
        if (mode === GameMode.Curling) {
            const speedLabel = CURLING_GAUGE_SPEEDS.find(s => s.value === settings.curlingGaugeSpeed)?.label || t('sidebar.settings.speedNormal');
            details.push(renderSetting(t('sidebar.settings.curlingStoneCount'), t('sidebar.settings.captureTargetCount', { count: settings.curlingStoneCount })));
            details.push(renderSetting(t('sidebar.settings.round'), `${settings.curlingRounds}R`));
            details.push(renderSetting(t('sidebar.settings.gaugeSpeed'), speedLabel));
            details.push(renderSetting(t('sidebar.settings.slow'), t('sidebar.settings.captureTargetCount', { count: settings.curlingSlowItemCount })));
            details.push(renderSetting(t('sidebar.settings.aimingLine'), t('sidebar.settings.captureTargetCount', { count: settings.curlingAimingLineItemCount })));
        }

        return details.filter(Boolean);
    }, [session, singlePlayerStagesListRevision, t]);


    return (
        <>
            <div className={`${arenaGameRoomPanelClass} flex-shrink-0`}>
                <h3 className={arenaGameRoomPanelTitleClass}>
                    <span className="min-w-0 shrink">{t('sidebar.gameInfo')}</span>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setMatchGuideOpen(true)}
                            className={`${arenaGameRoomSmallCtaClass}${drawerUi ? ' !text-[13px] sm:!text-[13px] !px-2.5 !py-1.5' : ''}`}
                            title={t('sidebar.howToPlayTitle')}
                            aria-label={t('sidebar.howToPlayAria')}
                        >
                            {t('sidebar.howToPlay')}
                        </button>
                        {onClose && (
                            <button type="button" onClick={onClose} className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS} aria-label={tCommon('actions.close')}>
                                {tCommon('actions.close')}
                            </button>
                        )}
                    </div>
                </h3>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
                    {gameDetails}
                </div>
            </div>
            {matchGuideOpen && (
                session.isSinglePlayer || session.gameCategory === 'singleplayer' || session.gameCategory === 'tower' ? (
                    <SinglePlayerGameDescriptionModal
                        session={session}
                        readOnly
                        currentUser={currentUser}
                        onAction={onAction}
                        onClose={() => setMatchGuideOpen(false)}
                        onTowerItemPurchase={
                            session.gameCategory === 'tower' && onAction
                                ? async (itemId, quantity) => {
                                      const gid = session.id;
                                      await onAction({
                                          type: 'BUY_TOWER_ITEM',
                                          payload: {
                                              itemId,
                                              quantity,
                                              ...(typeof gid === 'string' && gid.startsWith('tower-game-') ? { gameId: gid } : {}),
                                          },
                                      } as ServerAction);
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

const UserListPanel: React.FC<SidebarProps & { onClose?: () => void }> = ({
    session,
    onlineUsers,
    currentUser,
    onClose,
    onAction,
    onViewUser,
    sidebarLayout,
}) => {
    const { t } = useTranslation('game');
    const { t: tCommon } = useTranslation('common');
    const drawerUi = sidebarLayout === 'mobileDrawer';
    const rowText = drawerUi ? 'text-[13px]' : 'text-sm';
    const roleText = drawerUi ? 'text-[13px]' : 'text-xs';
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

    const renderUser = (user: UserWithStatus, roleKey: 'black' | 'white' | 'spectator') => {
        const roleLabel = roleKey === 'black' ? t('black') : roleKey === 'white' ? t('white') : t('sidebar.spectator');
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
                    title={!isMe ? t('sidebar.viewProfile', { name: user.nickname }) : ''}
                >
                    <UserNicknameText
                        user={{
                            nickname: user.nickname,
                            isAdmin: user.isAdmin,
                            staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                        }}
                        className={`font-semibold truncate ${rowText}`}
                    />
                    {/* 재대결 버튼은 하단 대국 기능 패널로 이동 */}
                </div>
                <span className={`ml-auto ${roleText} text-gray-400 flex-shrink-0`}>{roleLabel}</span>
            </div>
         )
    }

    return (
        <div className={`${arenaGameRoomPanelClass} flex flex-col`}>
            <h3 className={`${arenaGameRoomPanelTitleClass} flex-shrink-0`}>
                {t('sidebar.userList')}
                {onClose && (
                    <button type="button" onClick={onClose} className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS} aria-label={tCommon('actions.close')}>
                        {tCommon('actions.close')}
                    </button>
                )}
            </h3>
            <div className="space-y-0.5 overflow-y-auto pr-1 flex-grow min-h-0" style={{ maxHeight: '7.5rem' }}>
                {playersInRoom.map(user => renderUser(user, user.id === blackPlayerId ? 'black' : 'white'))}
                {spectators.map(user => renderUser(user, 'spectator'))}
            </div>
        </div>
    );
};


export const ChatPanel: React.FC<Omit<SidebarProps, 'onLeaveOrResign' | 'isNoContestLeaveAvailable'>> = (props) => {
    const { t } = useTranslation('game');
    const localizedGameMode = useLocalizedGameMode();
    const { session, isSpectator, onAction, waitingRoomChat, gameChat, onClose, onViewUser, sidebarLayout } = props;
    const drawerUi = sidebarLayout === 'mobileDrawer';
    const tabActiveClass = drawerUi ? arenaGameRoomChatTabActiveDrawerClass : arenaGameRoomChatTabActiveClass;
    const tabInactiveClass = drawerUi ? arenaGameRoomChatTabInactiveDrawerClass : arenaGameRoomChatTabInactiveClass;
    const chatMsgClass = drawerUi ? 'text-sm leading-snug' : 'text-base leading-snug';
    const { mode } = session;
    const { currentUserWithStatus, handlers, allUsers } = useAppContext();

    const [activeTab, setActiveTab] = useState<'game' | 'global'>('game');
    const [chatInput, setChatInput] = useState('');
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const quickChatRef = useRef<HTMLDivElement>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);

    const activeChatMessages = activeTab === 'game' ? gameChat : waitingRoomChat;
    
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
        locationPrefix = t('sidebar.locationTower');
    } else if (session.gameCategory === 'singleplayer' || session.isSinglePlayer) {
        locationPrefix = t('sidebar.locationSingle');
    } else {
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
        const lobbyType = isStrategic ? t('sidebar.strategicShort') : t('sidebar.playfulShort');
        locationPrefix = isStrategic
            ? t('sidebar.locationStrategic', { mode: localizedGameMode(mode) })
            : t('sidebar.locationPlayful', { mode: localizedGameMode(mode) });
    }

    const handleSend = (message: { text?: string, emoji?: string }) => {
        if(isSpectator || cooldown > 0) return;
        
        const channel = activeTab === 'game' ? session.id : 'global';
        const payload: any = { channel, ...message };

        if (channel === 'global') {
            payload.location = locationPrefix;
        } else if (channel === session.id && session.settings?.pairGame?.turnOrder?.length && currentUserWithStatus) {
            const viewerSeat = session.settings.pairGame.turnOrder.find((s) =>
                pairSeatMatchesViewerUser(s, currentUserWithStatus.id),
            );
            if (viewerSeat?.seatId) {
                payload.location = `[${pairTurnSeatIdShortLabel(viewerSeat.seatId)}]`;
            }
        }

        onAction({ type: 'SEND_CHAT_MESSAGE', payload });
        setShowQuickChat(false); setChatInput('');
        setCooldown(5);
    };

    const handleSendTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            if (containsProfanity(chatInput)) {
                alert(tx('game:sidebar.profanityBlocked'));
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
        ? t('sidebar.chatBanned', { minutes: banTimeLeft }) 
        : isInputDisabled
            ? t('messages.secondsCooldown', { seconds: cooldown })
            : t('sidebar.chatPlaceholderBracket');
    
    return (
        <div className={arenaGameRoomChatShellClass}>
            <div className={`${arenaGameRoomChatTabBarClass} mb-2`}>
                <button type="button" onClick={() => setActiveTab('game')} className={activeTab === 'game' ? tabActiveClass : tabInactiveClass}>
                    {t('sidebar.gameRoom')}
                </button>
                <button type="button" onClick={() => setActiveTab('global')} className={activeTab === 'global' ? tabActiveClass : tabInactiveClass}>
                    {t('sidebar.globalChat')}
                </button>
            </div>
            <div ref={chatBodyRef} className={arenaGameRoomChatBodyClass}>
                <>
                        {activeChatMessages.map(msg => {
                            const isBotMessage = msg.system && !msg.actionInfo && msg.user.nickname === t('sidebar.securityBot');
                            const isPairPetSeatChatSpeaker =
                                !msg.system &&
                                (msg.user.id.startsWith('pet-ai-') || msg.user.id === 'pair-opponent-pet');
                            return (
                                <div key={msg.id} className={chatMsgClass}>
                            {msg.actionInfo ? (
                                <>
                                    <span className="font-semibold text-gray-400 pr-2">{msg.user.nickname}:</span>
                                    <span className="text-yellow-400">{msg.actionInfo.message}</span>
                                    <span className="text-gray-400"> ({t('sidebar.manner')} </span>
                                    <span className={msg.actionInfo.scoreChange > 0 ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
                                        {msg.actionInfo.scoreChange > 0 ? `+${msg.actionInfo.scoreChange}` : msg.actionInfo.scoreChange}
                                    </span>
                                    <span className="text-gray-400">)</span>
                                </>
                            ) : (
                                <>
                                    {msg.location && <span className="font-semibold text-gray-500 pr-1">{msg.location}</span>}
                                    <span 
                                        className={`font-semibold pr-2 ${
                                            msg.system
                                                ? 'text-yellow-400'
                                                : isPairPetSeatChatSpeaker
                                                  ? 'text-fuchsia-200/95'
                                                  : 'text-gray-400 cursor-pointer hover:underline'
                                        }`}
                                        onClick={() => !msg.system && !isPairPetSeatChatSpeaker && handleUserClick(msg.user.id)}
                                        title={
                                            msg.system
                                                ? ''
                                                : isPairPetSeatChatSpeaker
                                                  ? `${msg.user.nickname}${t('sidebar.pairPetSuffix')}`
                                                  : t('sidebar.profileSanction', { name: msg.user.nickname })
                                        }
                                    >
                                        {msg.system ? (isBotMessage ? t('sidebar.securityBot') : t('sidebar.system')) : msg.user.nickname}:
                                    </span>
                                    {msg.text && (() => {
                                        const textStr = msg.text;
                                        const parts: (string | React.ReactElement)[] = [];
                                        let currentIndex = 0;
                                        
                                        // 사용자 이름과 장비 이름의 위치 찾기
                                        const userLinkIndex = msg.userLink ? textStr.indexOf(`${msg.userLink.userName}${t('sidebar.honorific')}`) : -1;
                                        const itemLinkIndex = msg.itemLink ? textStr.indexOf(msg.itemLink.itemName) : -1;
                                        
                                        // 정렬된 인덱스 배열 생성
                                        const linkIndices: Array<{ type: 'user' | 'item', index: number, length: number }> = [];
                                        if (userLinkIndex >= 0 && msg.userLink) {
                                            linkIndices.push({ type: 'user', index: userLinkIndex, length: `${msg.userLink.userName}${t('sidebar.honorific')}`.length });
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
                                                        title={t('sidebar.profileSanction', { name: msg.userLink.userName })}
                                                    >
                                                        {msg.userLink.userName}
                                                    </span>
                                                );
                                                parts.push(t('sidebar.honorific'));
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
                                                        title={t('sidebar.itemDetail', { name: msg.itemLink.itemName })}
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
                        {activeChatMessages.length === 0 && (
                            <div className={`h-full flex items-center justify-center text-gray-500 ${chatMsgClass}`}>{t('sidebar.noChatMessages')}</div>
                        )}
                </>
            </div>
            {!isSpectator && (
                <div className="relative flex-shrink-0">
                   {showQuickChat && (
                       <div ref={quickChatRef} className={arenaGameRoomQuickChatPopoverClass}>
                           <div className="grid grid-cols-5 gap-2 text-2xl mb-2 border-b border-slate-600/45 pb-2">
                              {GAME_CHAT_EMOJIS.map(emoji => ( <button key={emoji} type="button" onClick={() => handleSend({ emoji })} className={arenaGameRoomQuickChatEmojiBtnClass}> {emoji} </button> ))}
                           </div>
                           <ul className="space-y-1">
                              {GAME_CHAT_MESSAGES.map(msg => (
                                  <li key={msg}>
                                      <button
                                          type="button"
                                          onClick={() => handleSend({ text: msg })}
                                          className={`${arenaGameRoomQuickChatPhraseBtnClass}${drawerUi ? ' !text-[13px] !leading-snug' : ''}`}
                                      >
                                          {msg}
                                      </button>
                                  </li>
                              ))}
                           </ul>
                       </div>
                   )}
                   <form onSubmit={handleSendTextSubmit} className="flex gap-2">
                        <button type="button" onClick={() => setShowQuickChat(s => !s)} className={arenaGameRoomChatIconToggleClass} title={t('sidebar.quickChat')} disabled={isInputDisabled}>
                            <span>🙂</span>
                        </button>
                       <input
                           type="text"
                           value={chatInput}
                           onChange={e => setChatInput(e.target.value)}
                           placeholder={placeholderText}
                           className={`${arenaGameRoomChatInputClass}${drawerUi ? ' !text-[13px] !py-1.5' : ''}`}
                           maxLength={30}
                           disabled={isInputDisabled}
                       />
                       <Button type="submit" bare disabled={!chatInput.trim() || isInputDisabled} colorScheme="none" title={t('sidebar.send')} className={`!px-3 !py-2 rounded-lg border border-sky-600/40 bg-gradient-to-b from-sky-700/90 to-sky-950 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 disabled:opacity-40 disabled:grayscale ${drawerUi ? '!text-[13px]' : 'text-sm'}`}>
                            💬
                       </Button>
                   </form>
                </div>
            )}
        </div>
    );
};

const GuildWarStarConditionsPanel: React.FC<{
    session: LiveGameSession;
    currentUser: User;
    sidebarLayout?: 'desktop' | 'mobileDrawer';
}> = ({ session, currentUser, sidebarLayout }) => {
    const { t } = useTranslation('game');
    const drawerUi = sidebarLayout === 'mobileDrawer';
    const starBodyClass = drawerUi ? 'text-[13px] leading-snug text-gray-200' : 'text-xs text-gray-200';
    if (session.gameCategory !== 'guildwar') return null;
    const boardId = (session as any).guildWarBoardId as string | undefined;
    const boardMode =
        getGuildWarBoardRuleModeFromGameMode(session.mode) ?? (boardId ? getGuildWarBoardMode(boardId) : 'capture');
    const lines = getGuildWarStarConditionLines(boardMode, boardId);

    const humanEnum = currentUser.id === session.blackPlayerId ? Player.Black : Player.White;
    const ended = ['ended', 'no_contest', 'rematch_pending'].includes(session.gameStatus);
    const humanWon = ended && session.winner === humanEnum;
    const maxPts = Number((session as any).maxSingleCapturePointsByPlayer?.[humanEnum] ?? 0) || 0;

    if (boardMode === 'capture') {
        const c2 = GUILD_WAR_STAR_CAPTURE_TIER2_MIN;
        const c3 = GUILD_WAR_STAR_CAPTURE_TIER3_MIN;
        const rows = [
            { label: t('win'), ok: humanWon },
            { label: lines[1] ?? t('summary.captureTier2', { min: c2 }), ok: maxPts >= c2 },
            { label: lines[2] ?? t('summary.captureTier3', { min: c3 }), ok: maxPts >= c3 },
        ];
        return (
            <div className={arenaGameRoomGuildStarPanelClass}>
                <h3 className={`${arenaGameRoomPanelTitleClass} border-amber-700/25`}>{t('sidebar.starConditions')}</h3>
                <div className="space-y-1.5">
                    {rows.map((row) => (
                        <div key={row.label} className={`flex items-start justify-between gap-2 ${starBodyClass}`}>
                            <span className="min-w-0 flex-1 leading-snug">{row.label}</span>
                            <img
                                src={row.ok ? '/images/guild/guildwar/clearstar.webp' : '/images/guild/guildwar/emptystar.webp'}
                                alt=""
                                className="mt-0.5 h-4 w-4 shrink-0 object-contain opacity-95"
                                aria-hidden
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={arenaGameRoomGuildStarPanelClass}>
            <h3 className={`${arenaGameRoomPanelTitleClass} border-amber-700/25`}>{t('sidebar.starConditions')}</h3>
            <div className="space-y-1">
                {lines.map((line) => (
                    <div key={line} className={starBodyClass}>
                        {line}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
    const { t } = useTranslation('game');
    const {
        session,
        onLeaveOrResign,
        isNoContestLeaveAvailable,
        isSpectator,
        onTogglePause,
        isPaused = false,
        resumeCountdown = 0,
        pauseButtonCooldown = 0,
        pauseDisabledBecauseAiTurn = false,
        sidebarLayout = 'desktop',
    } = props;
    const { gameStatus } = session;

    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const isAdventureGame = session.gameCategory === 'adventure';
    const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
    const isPauseButtonDisabled = (isPaused && resumeCountdown > 0) || (!isPaused && pauseButtonCooldown > 0) || pauseDisabledBecauseAiTurn;

    const leaveButtonText = isNoContestLeaveAvailable
        ? t('controls.noContestLeave')
        : isGameEnded
          ? isAdventureGame
              ? t('controls.goToMap')
              : t('controls.returnToLobby')
          : isSpectator
            ? t('controls.endSpectating')
            : t('controls.resignTitle');

    return (
        <div className={`${arenaGameRoomSidebarShell} gap-2`}>
            <div className="flex-shrink-0 space-y-2">
                <GameInfoPanel
                    session={session}
                    currentUser={props.currentUser}
                    onClose={props.onClose}
                    onAction={props.onAction}
                    sidebarLayout={sidebarLayout}
                    singlePlayerStagesListRevision={props.singlePlayerStagesListRevision}
                />
                <UserListPanel {...props} />
                <GuildWarStarConditionsPanel session={session} currentUser={props.currentUser} sidebarLayout={sidebarLayout} />
                {/* PC 사이드바 광고(300×250). 모바일 인게임 서랍에서는 제외 → 푸터 320×50 */}
                {sidebarLayout !== 'mobileDrawer' ? <AdBanner position="sidebar" /> : null}
            </div>
            <div className="flex-1 mt-2 min-h-0">
                <ChatPanel {...props} />
            </div>
            {isSpectator && props.currentUser?.isAdmin && !isGameEnded && (
                <div className={arenaGameRoomAdminStripClass}>
                    <h3 className={arenaGameRoomAdminTitleClass}>{t('controls.adminFeatures')}</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            bare
                            onClick={() => {
                                if (window.confirm(t('sidebar.adminResignConfirm', { loser: session.player2?.nickname, winner: session.player1?.nickname }))) {
                                    props.onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId: session.id, winnerId: session.player1?.id } });
                                }
                            }}
                            colorScheme="none"
                            className={`${arenaGameRoomSidebarLeaveBtnClass(false)} !py-2 !px-3 !text-xs !min-h-0`}
                        >
                            {t('sidebar.adminForceResignWin', { name: session.player2?.nickname })}
                        </Button>
                        <Button
                            bare
                            onClick={() => {
                                if (window.confirm(t('sidebar.adminResignConfirm', { loser: session.player1?.nickname, winner: session.player2?.nickname }))) {
                                    props.onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId: session.id, winnerId: session.player2?.id } });
                                }
                            }}
                            colorScheme="none"
                            className={`${arenaGameRoomSidebarLeaveBtnClass(false)} !py-2 !px-3 !text-xs !min-h-0`}
                        >
                            {t('sidebar.adminForceResignWin', { name: session.player1?.nickname })}
                        </Button>
                    </div>
                </div>
            )}
            {!isGameEnded && (
                <div className="flex-shrink-0 flex flex-col gap-1.5 pt-2">
                    {isPausableAiGame && !isSpectator && onTogglePause ? (
                        <Button
                            bare
                            onClick={onTogglePause}
                            colorScheme="none"
                            className={`w-full ${arenaGameRoomSidebarPauseBtnClass(isPaused)}`}
                            disabled={isPauseButtonDisabled}
                            title={
                                pauseDisabledBecauseAiTurn
                                    ? t('controls.pauseMyTurnOnly')
                                    : undefined
                            }
                        >
                            {isPaused
                                ? resumeCountdown > 0
                                    ? t('controls.resumeGameCountdown', { count: resumeCountdown })
                                    : t('controls.resumeGame')
                                : pauseButtonCooldown > 0
                                  ? t('controls.pauseGameCountdown', { count: pauseButtonCooldown })
                                  : pauseDisabledBecauseAiTurn
                                    ? t('controls.pauseGameAiTurn')
                                    : t('controls.pauseGame')}
                        </Button>
                    ) : (
                        <Button
                            bare
                            onClick={onLeaveOrResign}
                            colorScheme="none"
                            className={`w-full ${arenaGameRoomSidebarLeaveBtnClass(isNoContestLeaveAvailable)}`}
                            disabled={
                                gameStatus === 'scoring' &&
                                !isSpectator &&
                                !isGameEnded &&
                                !isNoContestLeaveAvailable
                            }
                            title={
                                gameStatus === 'scoring' &&
                                !isSpectator &&
                                !isGameEnded &&
                                !isNoContestLeaveAvailable
                                    ? t('controls.cannotResignDuringScoring')
                                    : undefined
                            }
                        >
                            {leaveButtonText}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Sidebar;