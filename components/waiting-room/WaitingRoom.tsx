import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GameMode, ServerAction, Announcement, OverrideAnnouncement, UserWithStatus, LiveGameSession, UserStatus } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';

// Import newly created sub-components
import PlayerList from './PlayerList.js';
import RankingList from './RankingList.js';
import GameList from './GameList.js';
import ChatWindow from './ChatWindow.js';
import TierInfoModal from '../TierInfoModal.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from '../QuickAccessSidebar.js';
import AiChallengeModal from './AiChallengeModal.js';
import AiChallengePanel from './AiChallengePanel.js';
import RankedMatchPanel from './RankedMatchPanel.js';
import MatchFoundModal from './MatchFoundModal.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { mergeArenaEntranceAvailability } from '../../constants/arenaEntrance.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import {
  aiChallengeFeatureShellClass,
  aiChallengeFeatureTopHairlineClass,
  aiChallengePanelInnerGradientClass,
  waitingLobbyPcCenterColumnClass,
  waitingLobbyPcPanelShellClass,
  waitingLobbyPcPanelTopHairlineClassFor,
  waitingLobbyPairAlignedMobileScreenTitleClass,
  waitingLobbyPairAlignedMobileTabButtonClass,
} from './waitingLobbyHomePanelStyles.js';
import { WaitingLobbyAnnouncementBoard, WAITING_LOBBY_PANEL_GLASS } from './WaitingLobbyAnnouncementBoard.js';
import { userInUnifiedArenaLobbyUserList } from './aggregateWaitingLobbyUserFilter.js';
import { sumLobbyAiMatchRecordFromStats } from '../../shared/utils/lobbyAiMatchRecord.js';

interface WaitingRoomComponentProps {
    mode: GameMode | 'strategic' | 'playful';
}

const PLAYFUL_AI_MODES: GameMode[] = [GameMode.Dice, GameMode.Omok, GameMode.Ttamok, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling];

const WaitingRoom: React.FC<WaitingRoomComponentProps> = ({ mode }) => {
  const { 
    currentUserWithStatus, onlineUsers, allUsers, liveGames, 
    waitingRoomChats, handlers, arenaEntranceAvailability,
    rankedMatchingQueue, rankedMatchFound,
  } = useAppContext();
  const { isNativeMobile } = useNativeMobileShell();

  const [isTierInfoModalOpen, setIsTierInfoModalOpen] = useState(false);
  const [isAiChallengeModalOpen, setIsAiChallengeModalOpen] = useState(false);
  const [nativeWaitingTab, setNativeWaitingTab] = useState<
    'users' | 'ai' | 'games' | 'ranked' | 'rankingInfo' | 'rankedAi'
  >('users');
  const [isRankedMatching, setIsRankedMatching] = useState(false);
  const [rankedMatchingStartTime, setRankedMatchingStartTime] = useState(0);
  const [matchFoundData, setMatchFoundData] = useState<{ gameId: string; player1: any; player2: any } | null>(null);
  /** 전략·놀이 대기실 유저 목록 패널: 전체 / 친구 / 길드원 */
  const [waitingUserListScope, setWaitingUserListScope] = useState<'all' | 'friends' | 'guild'>('all');
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const navigateToWaitingLobby = useCallback((targetMode: 'strategic' | 'playful') => {
    if (mode === targetMode) return;
    window.location.hash = `#/waiting/${targetMode}`;
  }, [mode]);

  useEffect(() => {
    if (mode !== 'strategic' && mode !== 'playful') return;
    if (isClientAdmin(currentUserWithStatus)) return;
    const m = mergeArenaEntranceAvailability(arenaEntranceAvailability);
    if (mode === 'strategic' && !m.strategicLobby) replaceAppHash('#/profile');
    if (mode === 'playful' && !m.playfulLobby) replaceAppHash('#/profile');
  }, [mode, arenaEntranceAvailability, currentUserWithStatus]);

  // 전략바둑과 놀이바둑 대기실은 각각의 채널 사용
  const chatChannel = mode === 'strategic' ? 'strategic' : mode === 'playful' ? 'playful' : 'global';
  const chatMessages = waitingRoomChats[chatChannel] || [];

  const isStrategic = useMemo(() => {
    if (mode === 'strategic') return true;
    if (mode === 'playful') return false;
    return SPECIAL_GAME_MODES.some(m => m.mode === mode);
  }, [mode]);

  // 대기실 입장 시 자동으로 ENTER_WAITING_ROOM 액션 전송
  const hasEnteredWaitingRoom = useRef(false);
  const lastModeRef = useRef<string | GameMode | undefined>(undefined);
  
  useEffect(() => {
    // mode가 변경되면 플래그 리셋
    if (lastModeRef.current !== mode) {
      hasEnteredWaitingRoom.current = false;
      lastModeRef.current = mode;
    }
    
    if (currentUserWithStatus && mode && !hasEnteredWaitingRoom.current) {
      // 현재 유저가 이미 대기실에 있는지 확인
      const isAlreadyInWaitingRoom = currentUserWithStatus.status === UserStatus.Waiting || currentUserWithStatus.status === UserStatus.Resting;
      // 전략/놀이바둑 대기실의 경우 mode 매칭 체크를 다르게 처리
      const modeMatches = mode === 'strategic' || mode === 'playful' 
        ? (!currentUserWithStatus.mode || 
           (mode === 'strategic' && SPECIAL_GAME_MODES.some(m => m.mode === currentUserWithStatus.mode)) ||
           (mode === 'playful' && PLAYFUL_GAME_MODES.some(m => m.mode === currentUserWithStatus.mode)))
        : currentUserWithStatus.mode === mode;
      
      // 대기 상태가 아니거나 모드가 일치하지 않으면 대기실 입장
      if (!isAlreadyInWaitingRoom || !modeMatches) {
        hasEnteredWaitingRoom.current = true;
        handlers.handleAction({ type: 'ENTER_WAITING_ROOM', payload: { mode } });
      } else {
        hasEnteredWaitingRoom.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentUserWithStatus?.id]);

  // 랭킹전 매칭 상태 업데이트는 useApp의 중앙 WebSocket 핸들러가 반영한 상태를 구독한다.
  useEffect(() => {
    const userEntry = currentUserWithStatus?.id
      ? rankedMatchingQueue?.strategic?.[currentUserWithStatus.id]
      : undefined;
    if (userEntry) {
      setIsRankedMatching(true);
      setRankedMatchingStartTime(userEntry.startTime);
    } else {
      setIsRankedMatching(false);
      setRankedMatchingStartTime(0);
    }
  }, [rankedMatchingQueue, currentUserWithStatus?.id]);

  useEffect(() => {
    if (
      mode === 'playful' &&
      (nativeWaitingTab === 'ranked' || nativeWaitingTab === 'rankingInfo' || nativeWaitingTab === 'rankedAi')
    ) {
      setNativeWaitingTab('users');
    }
  }, [mode, nativeWaitingTab]);

  /** 이전 분리 탭(ai / ranked) 상태를 합친 탭으로 이월 */
  useEffect(() => {
    if (mode !== 'strategic') return;
    if (nativeWaitingTab === 'ai' || nativeWaitingTab === 'ranked') {
      setNativeWaitingTab('rankedAi');
    }
  }, [mode, nativeWaitingTab]);

  useEffect(() => {
    if (!rankedMatchFound) return;
    if (rankedMatchFound.player1?.id !== currentUserWithStatus?.id && rankedMatchFound.player2?.id !== currentUserWithStatus?.id) {
      return;
    }
    setIsRankedMatching(false);
    setRankedMatchingStartTime(0);
    setMatchFoundData(rankedMatchFound);
  }, [rankedMatchFound, currentUserWithStatus?.id]);

  useEffect(() => {
    if (mode === 'strategic' || mode === 'playful') setWaitingUserListScope('all');
  }, [mode]);

  const onBackToLobby = () => {
    // 홈 이동은 항상 즉시 수행하고, 대기실 이탈 상태 정리는 비동기로 처리
    window.location.hash = '#/profile';
    Promise.resolve(handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' })).catch((error) => {
      console.error('[WaitingRoom] LEAVE_WAITING_ROOM failed:', error);
    });
  }

  if (!currentUserWithStatus) return null;

  // PVP만 표시. 진행 중이거나, 종료됐어도 대국실에 한 명이라도 있으면 목록 유지
  const ongoingGames = useMemo(() => {
    const allGames = Object.values(liveGames) as LiveGameSession[];
    const byCategory = (() => {
      if (mode === 'strategic') {
        return allGames.filter(g => SPECIAL_GAME_MODES.some(m => m.mode === g.mode));
      } else if (mode === 'playful') {
        return allGames.filter(g => PLAYFUL_GAME_MODES.some(m => m.mode === g.mode));
      } else {
        return allGames.filter(g => g.mode === mode);
      }
    })();
    /** 종료 후에도 대기실에 남은 방(gameId 유지)은 플레이어가 퇴장할 때까지 목록에 남긴다. */
    const hasSomeoneInRoom = (gameId: string) =>
      onlineUsers.some((u) => u.gameId === gameId || u.spectatingGameId === gameId);
    return byCategory.filter(g => {
      if (g.isAiGame) return false;
      const isOngoing = g.gameStatus !== 'ended' && g.gameStatus !== 'no_contest';
      return isOngoing || hasSomeoneInRoom(g.id);
    });
  }, [liveGames, mode, onlineUsers]);
  
  const usersInThisRoom = useMemo(() => {
        const isStrategicLobby = mode === 'strategic';
        const isPlayfulLobby = mode === 'playful';

        // 전략/놀이 집계 대기실: 전략·놀이·페어 대국실 연동 유저 풀 공통
        const all = onlineUsers.filter((u) => {
            if (isStrategicLobby || isPlayfulLobby) {
                return userInUnifiedArenaLobbyUserList(u);
            }
            return u.mode === mode;
        });
        
        // 현재 유저가 목록에 없으면 추가 (대기실에 입장했지만 아직 상태가 업데이트되지 않은 경우)
        const me = all.find(u => u.id === currentUserWithStatus.id);
        if (!me) {
            // 현재 유저를 대기실 상태로 추가
            // 전략/놀이바둑 대기실의 경우 mode는 strategic/playful로 설정
            // 단일 게임 모드 대기실의 경우 mode를 그대로 사용
            const { waitingLobby: _wlDrop, mode: _modeDrop, ...userBase } = currentUserWithStatus;
            const currentUserInRoom: UserWithStatus =
                isStrategicLobby || isPlayfulLobby
                    ? {
                          ...userBase,
                          status: UserStatus.Waiting,
                          waitingLobby: isStrategicLobby ? 'strategic' : 'playful',
                      }
                    : {
                          ...userBase,
                          status: UserStatus.Waiting,
                          mode: mode as GameMode,
                      };
            return [currentUserInRoom, ...all];
        }
        
        return [me, ...all.filter(u => u.id !== currentUserWithStatus.id)];
  }, [onlineUsers, mode, currentUserWithStatus]);

  const friendIdsSet = useMemo(
    () => new Set(currentUserWithStatus?.friendIds || []),
    [currentUserWithStatus?.friendIds]
  );

  const playersForListPanel = useMemo(() => {
    if (mode !== 'strategic' && mode !== 'playful') return usersInThisRoom;
    const uid = currentUserWithStatus.id;
    const gid = currentUserWithStatus.guildId;
    if (waitingUserListScope === 'friends') {
      return usersInThisRoom.filter((u) => u.id === uid || friendIdsSet.has(u.id));
    }
    if (waitingUserListScope === 'guild') {
      return usersInThisRoom.filter((u) => u.id === uid || (!!gid && u.guildId === gid));
    }
    return usersInThisRoom;
  }, [mode, usersInThisRoom, waitingUserListScope, currentUserWithStatus.id, currentUserWithStatus.guildId, friendIdsSet]);

  const waitingUserScopeTabs =
    mode === 'strategic' || mode === 'playful' ? (
      <div className="grid shrink-0 grid-cols-3 gap-0.5 border-b border-white/10 bg-black/25 p-0.5 sm:gap-1 sm:p-1">
        <button
          type="button"
          onClick={() => setWaitingUserListScope('all')}
          className={`${waitingLobbyPairAlignedMobileTabButtonClass} ${
            waitingUserListScope === 'all'
              ? mode === 'strategic'
                ? 'bg-cyan-500 text-cyan-950'
                : 'bg-amber-500 text-amber-950'
              : mode === 'strategic'
                ? 'text-cyan-100 hover:bg-cyan-950/45'
                : 'text-amber-100 hover:bg-amber-900/40'
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setWaitingUserListScope('friends')}
          className={`${waitingLobbyPairAlignedMobileTabButtonClass} ${
            waitingUserListScope === 'friends'
              ? mode === 'strategic'
                ? 'bg-violet-500 text-violet-950'
                : 'bg-orange-500 text-orange-950'
              : mode === 'strategic'
                ? 'text-violet-100 hover:bg-violet-950/45'
                : 'text-orange-100 hover:bg-orange-950/40'
          }`}
        >
          친구
        </button>
        <button
          type="button"
          onClick={() => setWaitingUserListScope('guild')}
          className={`${waitingLobbyPairAlignedMobileTabButtonClass} ${
            waitingUserListScope === 'guild'
              ? mode === 'strategic'
                ? 'bg-amber-500 text-amber-950'
                : 'bg-yellow-500 text-yellow-950'
              : mode === 'strategic'
                ? 'text-amber-100 hover:bg-amber-950/45'
                : 'text-yellow-100 hover:bg-yellow-950/30'
          }`}
        >
          길드원
        </button>
      </div>
    ) : null;

  // 허용된 위치만 설정
  let locationPrefix: string;
  if (mode === 'strategic') {
    locationPrefix = '[전략바둑]';
  } else if (mode === 'playful') {
    locationPrefix = '[놀이바둑]';
  } else {
    // 알 수 없는 모드는 기본값으로 [홈] 반환
    locationPrefix = '[홈]';
  }
    
  const isStrategicPlayfulLobby = mode === 'strategic' || mode === 'playful';
  const waitingLobbyAiRecord = useMemo(() => {
    if (!currentUserWithStatus?.stats || !isStrategicPlayfulLobby) return { wins: 0, losses: 0 };
    return sumLobbyAiMatchRecordFromStats(currentUserWithStatus.stats, isStrategic ? 'strategic' : 'playful');
  }, [currentUserWithStatus?.stats, isStrategic, isStrategicPlayfulLobby]);
  const waitingShellBgClass =
    mode === 'strategic'
      ? 'bg-lobby-shell-strategic'
      : mode === 'playful'
        ? 'bg-lobby-shell-playful'
        : 'bg-primary';
  /** 그라데이션 위 패널 대비: 반투명 + backdrop-blur */
  const waitingLobbyPanelOpaqueStyle = isStrategicPlayfulLobby
    ? ({ ['--custom-panel-bg' as string]: 'rgb(var(--bg-secondary) / 0.82)' } as React.CSSProperties)
    : undefined;
  const waitingLobbyGlass = isStrategicPlayfulLobby ? WAITING_LOBBY_PANEL_GLASS : '';
  const pcLobbyHomeTone: 'strategic' | 'playful' | null =
    mode === 'strategic' ? 'strategic' : mode === 'playful' ? 'playful' : null;
  const waitingLobbyPcShellClass = pcLobbyHomeTone ? waitingLobbyPcPanelShellClass(pcLobbyHomeTone) : '';
  const waitingLobbyPcCenterShellClass = pcLobbyHomeTone ? waitingLobbyPcCenterColumnClass(pcLobbyHomeTone) : '';
  const waitingLobbyPcHairlineClass = pcLobbyHomeTone ? waitingLobbyPcPanelTopHairlineClassFor(pcLobbyHomeTone) : '';
  const waitingLobbyHeaderChrome = isStrategicPlayfulLobby
    ? 'rounded-b-2xl border-b border-color/60 bg-secondary/92 shadow-[0_10px_36px_rgba(0,0,0,0.42)] backdrop-blur-[4px] pb-2'
    : '';
  /** 챔피언십 로비(TournamentLobby) 타이틀 줄과 동일 계열 */
  const waitingLobbyTitleStripVisual =
    mode === 'strategic'
      ? 'rounded-xl border border-cyan-400/45 bg-black/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-2'
      : 'rounded-xl border border-amber-500/35 bg-black/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-2';
  const waitingLobbyTitleStripRow = `${waitingLobbyTitleStripVisual} flex w-full shrink-0 items-center gap-2 sm:gap-2.5`;
  const waitingLobbyTitleH1Class =
    mode === 'strategic'
      ? 'relative z-[1] min-w-0 flex-1 truncate text-left text-base font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-cyan-100 via-sky-100 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.22)]'
      : 'relative z-[1] min-w-0 flex-1 truncate text-left text-base font-bold text-amber-50 sm:text-lg lg:text-xl drop-shadow-[0_0_14px_rgba(251,191,36,0.2)]';

  const lobbySwitchTabs = (compact?: boolean) => (
    <div
      className={`relative z-[1] grid shrink-0 grid-cols-2 gap-1 rounded-xl border-2 ${
        mode === 'strategic'
          ? 'border-cyan-300/70 bg-cyan-950/35 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
          : 'border-amber-300/70 bg-amber-950/25 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
      } p-1 ${compact ? 'h-8 min-w-[7.4rem]' : 'h-11 min-w-[10.5rem]'}`}
      title="대기실 전환"
      aria-label="전략 바둑과 놀이 바둑 대기실 전환"
    >
      <button
        type="button"
        onClick={() => navigateToWaitingLobby('strategic')}
        aria-pressed={mode === 'strategic'}
        className={`rounded-lg px-2 font-extrabold transition-all duration-200 ${
          compact ? 'text-[0.65rem] sm:text-xs' : 'text-sm'
        } ${
          mode === 'strategic'
            ? 'bg-gradient-to-b from-cyan-400 to-cyan-600 text-white ring-2 ring-cyan-200/90 shadow-[0_0_18px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] scale-[1.02]'
            : 'text-cyan-100/95 bg-cyan-900/25 hover:bg-cyan-700/35 hover:text-cyan-50'
        }`}
      >
        전략
      </button>
      <button
        type="button"
        onClick={() => navigateToWaitingLobby('playful')}
        aria-pressed={mode === 'playful'}
        className={`rounded-lg px-2 font-extrabold transition-all duration-200 ${
          compact ? 'text-[0.65rem] sm:text-xs' : 'text-sm'
        } ${
          mode === 'playful'
            ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white ring-2 ring-amber-200/90 shadow-[0_0_18px_rgba(251,191,36,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] scale-[1.02]'
            : 'text-amber-100/95 bg-amber-900/20 hover:bg-amber-700/35 hover:text-amber-50'
        }`}
      >
        놀이
      </button>
    </div>
  );

  return (
    <div
      className={`${waitingShellBgClass} text-primary flex flex-col h-full max-w-full`}
      style={waitingLobbyPanelOpaqueStyle}
    >
      {isNativeMobile && isStrategicPlayfulLobby && (
        <div className="shrink-0 px-2 pt-2">
          <div className="overflow-hidden rounded-lg">
            <WaitingLobbyAnnouncementBoard mode={mode} />
          </div>
        </div>
      )}
      {(isNativeMobile && isStrategicPlayfulLobby) || !isStrategicPlayfulLobby ? (
      <header
        className={`relative flex flex-shrink-0 items-center ${
          isNativeMobile && isStrategicPlayfulLobby
            ? `mb-2 justify-between sm:mb-4 ${waitingLobbyHeaderChrome} px-2 pt-1.5`
            : `mb-2 justify-between sm:mb-4 ${waitingLobbyHeaderChrome} px-2 pt-2 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6`
        }`}
      >
        {isNativeMobile && isStrategicPlayfulLobby ? (
          <div className={`w-full ${waitingLobbyTitleStripVisual}`}>
            <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
              <div className="w-10 shrink-0" aria-hidden />
              <div className="mx-auto flex min-w-0 max-w-[min(100%,18rem)] items-center justify-center gap-1.5">
                <h1
                  className={`${waitingLobbyPairAlignedMobileScreenTitleClass} text-center ${
                    mode === 'strategic'
                      ? 'bg-gradient-to-r from-cyan-100 to-cyan-200 bg-clip-text text-transparent'
                      : 'text-amber-50'
                  }`}
                >
                  {mode === 'strategic' ? '전략바둑 대기실' : '놀이바둑 대기실'}
                </h1>
                {lobbySwitchTabs(true)}
              </div>
              <div className="w-10 shrink-0" aria-hidden />
            </div>
          </div>
        ) : (
          <>
            <div className="relative z-20 w-10 shrink-0 sm:w-12">
              <button
                type="button"
                onClick={onBackToLobby}
                className="pointer-events-auto relative z-20 flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-all duration-100 active:translate-y-0.5 active:scale-95 active:shadow-inner sm:h-12 sm:w-12"
                aria-label="뒤로가기"
              >
                <img src="/images/button/back.png" alt="" className="h-full w-full" />
              </button>
            </div>
            <div className="pointer-events-none flex min-w-0 flex-1 justify-center px-2 text-center">
              <div className="flex max-w-md min-w-0 flex-nowrap items-center justify-center gap-2 sm:gap-3">
                <h1 className="truncate text-base font-bold sm:text-xl lg:text-2xl">
                  {mode === 'strategic' ? '전략바둑 대기실' : mode === 'playful' ? '놀이바둑 대기실' : `${mode} 대기실`}
                </h1>
                {(mode === 'strategic' || mode === 'playful') && lobbySwitchTabs(false)}
              </div>
            </div>
            <div className="w-10 shrink-0 sm:w-12" aria-hidden />
          </>
        )}
      </header>
      ) : null}
      <div
        className={`flex-1 min-h-0 relative ${
          isNativeMobile
            ? 'overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 sm:px-4 lg:px-6 pb-2 sm:pb-4 lg:pb-6'
            : isStrategicPlayfulLobby
              ? 'overflow-hidden px-2 pb-1.5 pt-1.5 sm:px-3 sm:pb-2 sm:pt-2 lg:px-4 lg:pb-3 lg:pt-2'
              : 'overflow-hidden px-2 sm:px-4 lg:px-6 pb-2 sm:pb-4 lg:pb-6'
        }`}
      >
          {isNativeMobile && isStrategicPlayfulLobby ? (
            <div className="relative flex h-full min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-0.5 pb-0.5">
              <div className="mb-0.5 flex shrink-0 gap-0.5" role="tablist" aria-label="대기실 보기">
                {(
                  mode === 'playful'
                    ? [
                          { id: 'users' as const, label: '유저목록' },
                          { id: 'ai' as const, label: 'AI대결' },
                          { id: 'games' as const, label: '대국실목록' },
                      ]
                    : [
                          { id: 'users' as const, label: '유저목록' },
                          { id: 'rankedAi' as const, label: '랭킹전/AI대결' },
                          { id: 'games' as const, label: '대국실목록' },
                          { id: 'rankingInfo' as const, label: '랭킹정보' },
                      ]
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={nativeWaitingTab === id}
                    onClick={() => setNativeWaitingTab(id)}
                    className={`min-h-0 min-w-0 flex-1 ${waitingLobbyPairAlignedMobileTabButtonClass} transition-all ${
                      nativeWaitingTab === id
                        ? 'border border-amber-400/55 bg-gradient-to-b from-amber-800/40 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                    }`}
                  >
                    <span className="block leading-tight">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden" role="tabpanel">
                {nativeWaitingTab === 'users' && (
                  <div
                    className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-color bg-panel shadow-lg ${waitingLobbyGlass}`}
                  >
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <PlayerList
                        users={playersForListPanel}
                        mode={mode}
                        onAction={handlers.handleAction}
                        currentUser={currentUserWithStatus}
                        onViewUser={handlers.openViewingUser}
                        lobbyType={isStrategic ? 'strategic' : 'playful'}
                        userCount={playersForListPanel.length}
                        pairAlignedNativeCompact
                        listScopeTabs={waitingUserScopeTabs}
                        showArenaPartnerInviteBlockToggle
                      />
                    </div>
                  </div>
                )}
                {nativeWaitingTab === 'ai' && mode === 'playful' && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                    <div className={`${aiChallengeFeatureShellClass} relative shrink-0 overflow-hidden p-2`}>
                      <div className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                      <div className={aiChallengePanelInnerGradientClass}>
                        <AiChallengePanel
                          mode={mode}
                          noOuterShell
                          headingTitle={isStrategic ? '전략 AI대전' : '놀이 AI대전'}
                          aiRecord={waitingLobbyAiRecord}
                          onOpenModal={() => setIsAiChallengeModalOpen(true)}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {nativeWaitingTab === 'rankedAi' && mode === 'strategic' && (
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden pb-0.5">
                    <div className={`${aiChallengeFeatureShellClass} relative shrink-0 overflow-hidden p-2`}>
                      <div className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                      <div className={aiChallengePanelInnerGradientClass}>
                        <AiChallengePanel
                          mode={mode}
                          noOuterShell
                          headingTitle="전략 AI대전"
                          aiRecord={waitingLobbyAiRecord}
                          onOpenModal={() => setIsAiChallengeModalOpen(true)}
                        />
                      </div>
                    </div>
                    <div
                      className={`flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-color bg-panel shadow-lg ${waitingLobbyGlass}`}
                    >
                      <RankedMatchPanel
                        currentUser={currentUserWithStatus}
                        onAction={handlers.handleAction}
                        isMatching={isRankedMatching}
                        matchingStartTime={rankedMatchingStartTime}
                        variant="nativeNarrow"
                        onMatchingStateChange={(isMatching, startTime) => {
                          setIsRankedMatching(isMatching);
                          setRankedMatchingStartTime(startTime);
                        }}
                        onCancelMatching={() => {
                          setIsRankedMatching(false);
                          setRankedMatchingStartTime(0);
                        }}
                      />
                    </div>
                  </div>
                )}
                {nativeWaitingTab === 'games' && (
                  <div
                    className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-color bg-panel shadow-lg ${waitingLobbyGlass}`}
                  >
                    <GameList
                      games={ongoingGames}
                      onAction={handlers.handleAction}
                      currentUser={currentUserWithStatus}
                      lobbyTone={mode === 'strategic' ? 'strategic' : 'playful'}
                      panelExtraClassName={waitingLobbyGlass}
                      pairAlignedNativeCompact
                    />
                  </div>
                )}
                {nativeWaitingTab === 'rankingInfo' && mode === 'strategic' && (
                  <div
                    className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-color bg-panel shadow-lg ${waitingLobbyGlass}`}
                  >
                    <RankingList
                      currentUser={currentUserWithStatus}
                      mode={mode}
                      onViewUser={handlers.openViewingUser}
                      onShowTierInfo={() => setIsTierInfoModalOpen(true)}
                      onShowPastRankings={handlers.openPastRankings}
                      lobbyType="strategic"
                      pairAlignedNativeCompact
                    />
                  </div>
                )}
              </div>
            </div>
          ) : isStrategicPlayfulLobby ? (
            <div
              ref={desktopContainerRef}
              className="flex h-full min-h-0 w-full flex-row gap-1.5 overflow-hidden sm:gap-2 lg:gap-2"
            >
              {/* 좌: 챔피언십형 타이틀 + 랭킹전 + 랭킹보드 — 중·우열은 타이틀 행 상단부터 같은 높이로 확장 */}
              <div className="flex h-full min-h-0 w-[min(43%,500px)] min-w-[292px] max-w-[500px] shrink-0 flex-col gap-[clamp(0.3rem,0.9dvh,0.45rem)] overflow-hidden">
                <div className={waitingLobbyTitleStripRow}>
                  <button
                    type="button"
                    onClick={onBackToLobby}
                    className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                    aria-label="뒤로가기"
                  >
                    <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                  </button>
                  <h1 className={waitingLobbyTitleH1Class}>
                    {mode === 'strategic' ? '전략바둑 대기실' : '놀이바둑 대기실'}
                  </h1>
                  {lobbySwitchTabs(true)}
                </div>
                {mode === 'strategic' ? (
                  <>
                    <div className={`${aiChallengeFeatureShellClass} relative shrink-0 overflow-hidden p-2`}>
                      <div className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                      <div className={aiChallengePanelInnerGradientClass}>
                        <AiChallengePanel
                          mode={mode}
                          noOuterShell
                          headingTitle="전략 AI대전"
                          aiRecord={waitingLobbyAiRecord}
                          onOpenModal={() => setIsAiChallengeModalOpen(true)}
                        />
                      </div>
                    </div>
                    <div className={`shrink-0 overflow-hidden ${waitingLobbyPcShellClass}`}>
                      <RankedMatchPanel
                        currentUser={currentUserWithStatus}
                        onAction={handlers.handleAction}
                        isMatching={isRankedMatching}
                        matchingStartTime={rankedMatchingStartTime}
                        shrinkToContent
                        onMatchingStateChange={(isMatching, startTime) => {
                          setIsRankedMatching(isMatching);
                          setRankedMatchingStartTime(startTime);
                        }}
                        onCancelMatching={() => {
                          setIsRankedMatching(false);
                          setRankedMatchingStartTime(0);
                        }}
                      />
                    </div>
                    <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${waitingLobbyPcShellClass}`}>
                      <RankingList
                        currentUser={currentUserWithStatus}
                        mode={mode}
                        onViewUser={handlers.openViewingUser}
                        onShowTierInfo={() => setIsTierInfoModalOpen(true)}
                        onShowPastRankings={handlers.openPastRankings}
                        lobbyType="strategic"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`${aiChallengeFeatureShellClass} relative shrink-0 overflow-hidden p-2`}>
                      <div className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                      <div className={aiChallengePanelInnerGradientClass}>
                        <AiChallengePanel
                          mode={mode}
                          noOuterShell
                          headingTitle="놀이 AI대전"
                          aiRecord={waitingLobbyAiRecord}
                          onOpenModal={() => setIsAiChallengeModalOpen(true)}
                        />
                      </div>
                    </div>
                    <div
                      className={`flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-2 overflow-hidden rounded-lg border border-amber-600/30 bg-black/25 p-4 text-center text-sm text-amber-100/90 ${waitingLobbyPcShellClass}`}
                    >
                      <p className="font-semibold text-amber-50">놀이바둑 안내</p>
                      <p className="text-xs leading-relaxed text-amber-100/80">
                        놀이바둑 경기장에서는 랭킹전·시즌 랭킹 점수를 사용하지 않습니다. 전략바둑 대기실에서만 랭킹전을 이용할 수 있습니다.
                      </p>
                    </div>
                  </>
                )}
              </div>
              {/* 중앙: 공지 전광판 + 진행 중 대국 */}
              <div className={waitingLobbyPcCenterShellClass}>
                <div className={waitingLobbyPcHairlineClass} aria-hidden />
                <div className="relative z-[2] shrink-0 px-0.5 pt-0.5 sm:px-1">
                  <WaitingLobbyAnnouncementBoard mode={mode} />
                </div>
                <div className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-hidden">
                  <GameList
                    games={ongoingGames}
                    onAction={handlers.handleAction}
                    currentUser={currentUserWithStatus}
                    lobbyTone={mode === 'strategic' ? 'strategic' : 'playful'}
                    embedInHomeLobbyPanel
                  />
                </div>
              </div>
              {/* 우: 유저 목록(하단까지) + 퀵 메뉴 — shrink-0으로 중앙 대국 열이 유저 폭을 과도하게 잡아먹지 않도록 */}
              <div className="flex h-full min-h-0 shrink-0 flex-row gap-1.5 overflow-hidden sm:gap-2">
                <div className="flex h-full min-h-0 min-w-0 w-[min(100%,40rem)] max-w-2xl flex-1 flex-col overflow-hidden sm:min-w-[30rem]">
                  <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/15 ${waitingLobbyPcShellClass}`}>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <PlayerList
                        users={playersForListPanel}
                        mode={mode}
                        onAction={handlers.handleAction}
                        currentUser={currentUserWithStatus}
                        onViewUser={handlers.openViewingUser}
                        lobbyType={isStrategic ? 'strategic' : 'playful'}
                        userCount={playersForListPanel.length}
                        listScopeTabs={waitingUserScopeTabs}
                        showArenaPartnerInviteBlockToggle
                      />
                    </div>
                  </div>
                </div>
                <div
                  className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}
                  aria-label="퀵 메뉴"
                >
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40">
                    <QuickAccessSidebar fillHeight />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div ref={desktopContainerRef} className="grid h-full grid-cols-5 gap-4 overflow-hidden">
              <div className="col-span-3 flex min-h-0 flex-col gap-4 overflow-hidden">
                <div className="flex-shrink-0">
                  <WaitingLobbyAnnouncementBoard mode={mode} />
                </div>
                <div className="flex min-h-0 flex-[1.25] flex-col overflow-hidden">
                  <GameList
                    games={ongoingGames}
                    onAction={handlers.handleAction}
                    currentUser={currentUserWithStatus}
                    lobbyTone={isStrategic ? 'strategic' : 'playful'}
                    panelExtraClassName={waitingLobbyGlass}
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-row gap-3 overflow-hidden">
                  <div
                    className={`flex min-h-0 min-w-0 flex-[0.42] flex-col overflow-hidden rounded-lg border border-color bg-panel shadow-lg lg:flex-[0.38] ${waitingLobbyGlass}`}
                  >
                    <ChatWindow
                      messages={chatMessages}
                      mode={chatChannel}
                      onAction={handlers.handleAction}
                      locationPrefix={locationPrefix}
                      onViewUser={handlers.openViewingUser}
                    />
                  </div>
                  <div
                    className={`flex min-h-0 min-w-0 flex-[0.58] flex-col gap-2 overflow-hidden rounded-lg border border-color bg-panel shadow-lg sm:min-w-[25rem] lg:min-w-[30rem] lg:flex-[0.62] ${waitingLobbyGlass}`}
                  >
                    {isStrategic ? (
                      <>
                        <div className={`${aiChallengeFeatureShellClass} relative shrink-0 overflow-hidden p-2`}>
                          <div className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                          <div className={aiChallengePanelInnerGradientClass}>
                            <AiChallengePanel
                              mode={mode}
                              noOuterShell
                              headingTitle="전략 AI대전"
                              aiRecord={waitingLobbyAiRecord}
                              onOpenModal={() => setIsAiChallengeModalOpen(true)}
                            />
                          </div>
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                          <RankedMatchPanel
                            currentUser={currentUserWithStatus}
                            onAction={handlers.handleAction}
                            isMatching={isRankedMatching}
                            matchingStartTime={rankedMatchingStartTime}
                            onMatchingStateChange={(isMatching, startTime) => {
                              setIsRankedMatching(isMatching);
                              setRankedMatchingStartTime(startTime);
                            }}
                            onCancelMatching={() => {
                              setIsRankedMatching(false);
                              setRankedMatchingStartTime(0);
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`${aiChallengeFeatureShellClass} relative shrink-0 overflow-hidden p-2`}>
                          <div className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                          <div className={aiChallengePanelInnerGradientClass}>
                            <AiChallengePanel
                              mode={mode}
                              noOuterShell
                              headingTitle="놀이 AI대전"
                              aiRecord={waitingLobbyAiRecord}
                              onOpenModal={() => setIsAiChallengeModalOpen(true)}
                            />
                          </div>
                        </div>
                        <div className="flex h-full min-h-[8rem] flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-secondary">
                          <p className="font-semibold text-primary">랭킹전 없음</p>
                          <p className="leading-relaxed">전략바둑 대기실에서만 랭킹전을 이용할 수 있습니다.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex min-h-0 flex-col gap-4 overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4 overflow-hidden">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div
                      className={`min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-lg ring-1 ring-white/[0.06] ${waitingLobbyGlass}`}
                    >
                      <PlayerList
                        users={usersInThisRoom}
                        mode={mode}
                        onAction={handlers.handleAction}
                        currentUser={currentUserWithStatus}
                        onViewUser={handlers.openViewingUser}
                        lobbyType={isStrategic ? 'strategic' : 'playful'}
                        userCount={usersInThisRoom.length}
                        showArenaPartnerInviteBlockToggle
                      />
                    </div>
                  </div>
                  <div className={`${PC_QUICK_RAIL_COLUMN_CLASS} flex flex-col overflow-hidden`}>
                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40">
                      <QuickAccessSidebar fillHeight />
                    </div>
                  </div>
                </div>
                <div
                  className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-color bg-panel shadow-lg ${waitingLobbyGlass}`}
                >
                  {isStrategic ? (
                    <RankingList
                      currentUser={currentUserWithStatus}
                      mode={mode}
                      onViewUser={handlers.openViewingUser}
                      onShowTierInfo={() => setIsTierInfoModalOpen(true)}
                      onShowPastRankings={handlers.openPastRankings}
                      lobbyType="strategic"
                    />
                  ) : (
                    <div className="flex h-full min-h-[6rem] flex-col items-center justify-center p-4 text-center text-xs text-secondary">
                      시즌 랭킹 목록은 전략바둑 대기실에서 확인할 수 있습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
      {isTierInfoModalOpen && <TierInfoModal onClose={() => setIsTierInfoModalOpen(false)} />}
      {isAiChallengeModalOpen && (
        <AiChallengeModal 
          lobbyType={isStrategic ? 'strategic' : 'playful'} 
          preferredGameSettingsBucket={mode === 'playful' ? 'playful_ai_challenge' : 'strategic_ai_challenge'}
          title={isStrategic ? '전략바둑 AI와 대결하기' : '놀이바둑 AI와 대결하기'}
          onClose={() => setIsAiChallengeModalOpen(false)} 
          onAction={handlers.handleAction}
        />
      )}
      {matchFoundData && (
        <MatchFoundModal
          gameId={matchFoundData.gameId}
          player1={matchFoundData.player1}
          player2={matchFoundData.player2}
          currentUserId={currentUserWithStatus.id}
          onClose={() => {
            setMatchFoundData(null);
            handlers.clearRankedMatchFound?.();
          }}
          onEnterGame={(gameId) => {
            setMatchFoundData(null);
            handlers.clearRankedMatchFound?.();
            window.location.hash = `#/game/${gameId}`;
          }}
        />
      )}
    </div>
  );
};

export default WaitingRoom;
