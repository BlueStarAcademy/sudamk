import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GameMode, ServerAction, Announcement, OverrideAnnouncement, UserWithStatus, LiveGameSession, UserStatus } from '../../types.js';
import Avatar from '../Avatar.js';
import HelpModal from '../HelpModal.js';
import { useAppContext } from '../../hooks/useAppContext.js';

// Import newly created sub-components
import PlayerList from './PlayerList.js';
import RankingList from './RankingList.js';
import GameList from './GameList.js';
import ChatWindow from './ChatWindow.js';
import TierInfoModal from '../TierInfoModal.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, aiUserId } from '../../constants';
import QuickAccessSidebar from '../QuickAccessSidebar.js';
import Button from '../Button.js';
import AiChallengeModal from './AiChallengeModal.js';
import RankedMatchPanel from './RankedMatchPanel.js';
import MatchFoundModal from './MatchFoundModal.js';


interface WaitingRoomComponentProps {
    mode: GameMode | 'strategic' | 'playful';
}

const PLAYFUL_AI_MODES: GameMode[] = [GameMode.Dice, GameMode.Omok, GameMode.Ttamok, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling];


const ROW_HEIGHT_REM = 2.5;

const AnnouncementBoard: React.FC<{ mode: GameMode | 'strategic' | 'playful'; }> = ({ mode }) => {
    const { announcements, globalOverrideAnnouncement, announcementInterval } = useAppContext();
    const [currentIndex, setCurrentIndex] = useState(0);
    const announcementIds = useMemo(() => announcements.map(a => a.id).join(','), [announcements]);
    const strategicModes = useMemo(() => SPECIAL_GAME_MODES.map(m => m.mode), []);
    const playfulModes = useMemo(() => PLAYFUL_GAME_MODES.map(m => m.mode), []);

    useEffect(() => {
        if (!announcements || announcements.length <= 1) {
            setCurrentIndex(0);
            return;
        }
        const intervalMs = Math.max(2000, (announcementInterval ?? 3) * 1000);
        const timer = setInterval(() => {
            setCurrentIndex(prevIndex => (prevIndex + 1) % announcements.length);
        }, intervalMs);
        return () => clearInterval(timer);
    }, [announcementIds, announcements.length, announcementInterval]);

    const relevantOverride = globalOverrideAnnouncement && (
        globalOverrideAnnouncement.modes === 'all' ||
        (Array.isArray(globalOverrideAnnouncement.modes) && globalOverrideAnnouncement.modes.some(m => {
            if (mode === 'strategic') return strategicModes.includes(m);
            if (mode === 'playful') return playfulModes.includes(m);
            return m === mode;
        }))
    );

    if (relevantOverride) {
        return (
            <div className="bg-yellow-800/50 border border-yellow-600 rounded-lg shadow-lg p-2 flex items-center justify-center flex-shrink-0 h-10">
                <span className="font-bold text-yellow-300 animate-pulse text-center">{globalOverrideAnnouncement.message}</span>
            </div>
        );
    }
    
    if (!announcements || announcements.length === 0) {
        return (
            <div className="bg-panel rounded-lg shadow-lg p-2 flex items-center justify-center flex-shrink-0 h-10 text-on-panel border border-color">
                <span className="font-bold text-tertiary text-center">[현재 등록된 공지사항이 없습니다.]</span>
            </div>
        );
    }

    return (
        <div
            className="bg-panel rounded-lg shadow-lg px-4 relative overflow-hidden flex-shrink-0 border border-color text-on-panel"
            style={{ height: `${ROW_HEIGHT_REM}rem` }}
        >
            <div
                className="w-full absolute left-0 transition-transform duration-500 ease-in-out will-change-transform"
                style={{
                    height: `${announcements.length * ROW_HEIGHT_REM}rem`,
                    transform: `translateY(-${currentIndex * ROW_HEIGHT_REM}rem)`,
                }}
            >
                {announcements.map((announcement) => (
                    <div
                        key={announcement.id}
                        className="w-full flex items-center justify-center flex-shrink-0"
                        style={{ height: `${ROW_HEIGHT_REM}rem` }}
                    >
                        <span className="font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-2">
                            <span className="text-red-500 mr-2">[공지]</span>
                            <span className="text-highlight">{announcement.message}</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const WaitingRoom: React.FC<WaitingRoomComponentProps> = ({ mode }) => {
  const { 
    currentUserWithStatus, onlineUsers, allUsers, liveGames, 
    waitingRoomChats, negotiations, handlers 
  } = useAppContext();

  const [isTierInfoModalOpen, setIsTierInfoModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAiChallengeModalOpen, setIsAiChallengeModalOpen] = useState(false);
  const [isRankedMatching, setIsRankedMatching] = useState(false);
  const [rankedMatchingStartTime, setRankedMatchingStartTime] = useState(0);
  const [matchFoundData, setMatchFoundData] = useState<{ gameId: string; player1: any; player2: any } | null>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);

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

  // 랭킹전 매칭 상태 업데이트 (WebSocket 메시지 처리)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'RANKED_MATCHING_UPDATE') {
          const queue = message.payload?.queue as Record<string, Record<string, any>> | undefined;
          if (queue) {
            // mode를 직접 사용하여 lobbyType 계산
            const lobbyType: 'strategic' | 'playful' = (mode === 'strategic' || (mode !== 'playful' && SPECIAL_GAME_MODES.some(m => m.mode === mode))) ? 'strategic' : 'playful';
            const userEntry = currentUserWithStatus?.id ? queue[lobbyType]?.[currentUserWithStatus.id] : undefined;
            if (userEntry) {
              setIsRankedMatching(true);
              setRankedMatchingStartTime(userEntry.startTime);
            } else {
              setIsRankedMatching(false);
              setRankedMatchingStartTime(0);
            }
          }
        } else if (message.type === 'RANKED_MATCH_FOUND') {
          // 매칭 성공 시 VS 화면 표시
          setIsRankedMatching(false);
          setRankedMatchingStartTime(0);
          setMatchFoundData({
            gameId: message.payload.gameId,
            player1: message.payload.player1,
            player2: message.payload.player2,
          });
        }
      } catch (e) {
        // 무시
      }
    };

    const ws = (window as any).ws;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    }
  }, [mode, currentUserWithStatus?.id]);

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
    const hasSomeoneInRoom = (gameId: string) =>
      onlineUsers.some(u => (u.gameId === gameId || u.spectatingGameId === gameId) && (u.status === UserStatus.InGame || u.status === UserStatus.Spectating));
    return byCategory.filter(g => {
      if (g.isAiGame) return false;
      const isOngoing = g.gameStatus !== 'ended' && g.gameStatus !== 'no_contest';
      return isOngoing || hasSomeoneInRoom(g.id);
    });
  }, [liveGames, mode, onlineUsers]);
  
  const usersInThisRoom = useMemo(() => {
        const isStrategicLobby = mode === 'strategic';
        const isPlayfulLobby = mode === 'playful';

        // 전략/놀이바둑 대기실의 경우: mode가 정확히 일치하는 유저만 포함 (완전 분리)
        // 단일 게임 모드 대기실의 경우: mode가 정확히 일치하는 유저만 포함
        const all = onlineUsers.filter(u => {
            if (isStrategicLobby || isPlayfulLobby) {
                // 전략/놀이바둑 대기실: mode가 undefined이거나 해당 카테고리의 게임 모드이고 waiting 또는 resting 상태인 유저만 포함
                return (!u.mode || (isStrategicLobby && SPECIAL_GAME_MODES.some(m => m.mode === u.mode)) || (isPlayfulLobby && PLAYFUL_GAME_MODES.some(m => m.mode === u.mode))) && 
                       (u.status === UserStatus.Waiting || u.status === UserStatus.Resting);
            }
            // 단일 게임 모드 대기실: mode가 정확히 일치하는 유저만 포함
            return u.mode === mode;
        });
        
        // 현재 유저가 목록에 없으면 추가 (대기실에 입장했지만 아직 상태가 업데이트되지 않은 경우)
        const me = all.find(u => u.id === currentUserWithStatus.id);
        if (!me) {
            // 현재 유저를 대기실 상태로 추가
            // 전략/놀이바둑 대기실의 경우 mode는 strategic/playful로 설정
            // 단일 게임 모드 대기실의 경우 mode를 그대로 사용
            const currentUserInRoom: UserWithStatus = {
                ...currentUserWithStatus,
                status: UserStatus.Waiting,
                mode: (isStrategicLobby || isPlayfulLobby) ? undefined : (mode as GameMode)
            };
            return [currentUserInRoom, ...all];
        }
        
        return [me, ...all.filter(u => u.id !== currentUserWithStatus.id)];
  }, [onlineUsers, mode, currentUserWithStatus]);

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
    
  return (
    <div className="bg-primary text-primary flex flex-col h-full max-w-full">
      <header className="relative flex justify-between items-center mb-4 flex-shrink-0 px-2 sm:px-4 lg:px-6 pt-2 sm:pt-4 lg:pt-6">
        <div className="flex-1 relative z-20">
          <button onClick={onBackToLobby} className="relative z-20 pointer-events-auto p-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg transition-all duration-100 active:shadow-inner active:scale-95 active:translate-y-0.5">
            <img src="/images/button/back.png" alt="Back" className="w-full h-full" />
          </button>
        </div>
        <div className='flex-1 min-w-0 text-center flex items-center justify-center h-full pointer-events-none'>
          <div className="flex items-center gap-2 sm:gap-3 flex-nowrap h-full">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold whitespace-nowrap">
              {mode === 'strategic' ? '전략바둑 대기실' : mode === 'playful' ? '놀이바둑 대기실' : `${mode} 대기실`}
            </h1>
            {(mode === 'strategic' || mode === 'playful') && (
              <button
                type="button"
                aria-label={mode === 'strategic' ? '놀이바둑 대기실로 이동' : '전략바둑 대기실로 이동'}
                title={mode === 'strategic' ? '놀이바둑 대기실로 이동' : '전략바둑 대기실로 이동'}
                onClick={() => {
                  const targetMode = mode === 'strategic' ? 'playful' : 'strategic';
                  window.location.hash = `#/waiting/${targetMode}`;
                }}
                className="pointer-events-auto w-8 sm:w-10 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 text-on-panel relative overflow-hidden group"
                style={{ 
                  height: '60%',
                  marginTop: '4px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-purple-500/20 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="text-base sm:text-lg font-bold flex flex-col items-center justify-center gap-0 relative z-10 drop-shadow-sm leading-none">
                  <span className="transition-transform duration-300 group-hover:-translate-x-0.5 -mb-2.5">←</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5 -mt-2.5">→</span>
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 flex justify-end items-center">
          {(mode === 'strategic' || mode === 'playful') && (
            <button 
              onClick={() => setIsHelpModalOpen(true)}
              className="w-8 h-8 flex items-center justify-center transition-transform hover:scale-110"
              aria-label="게임 방법 보기"
              title="게임 방법 보기"
            >
              <img src="/images/button/help.webp" alt="도움말" className="w-full h-full" />
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0 relative px-2 sm:px-4 lg:px-6 pb-2 sm:pb-4 lg:pb-6 overflow-hidden">
          <div ref={desktopContainerRef} className="grid grid-cols-5 h-full gap-4 overflow-hidden">
              {/* Main Content Column */}
                  <div className="col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden">
                      <div className="flex-shrink-0">
                          <AnnouncementBoard mode={mode} />
                      </div>
                      
                      {/* 진행중인 대국 패널을 위로 이동 */}
                      <div className="h-[400px] min-h-0 flex-shrink-0 overflow-hidden">
                          <GameList games={ongoingGames} onAction={handlers.handleAction} currentUser={currentUserWithStatus} />
                      </div>
                      
                      {/* 채팅창과 랭킹전 패널 — 채팅은 좁게, 랭킹전은 넓게(비율 + 최소 폭) */}
                      <div className="flex-1 flex flex-row gap-3 min-h-0 overflow-hidden">
                          <div className="min-w-0 flex-[0.42] lg:flex-[0.38] flex flex-col bg-panel border border-color rounded-lg shadow-lg min-h-0 overflow-hidden">
                              <ChatWindow messages={chatMessages} mode={chatChannel} onAction={handlers.handleAction} locationPrefix={locationPrefix} onViewUser={handlers.openViewingUser} />
                          </div>
                          <div className="min-w-0 flex-[0.58] lg:flex-[0.62] sm:min-w-[25rem] lg:min-w-[30rem] bg-panel border border-color rounded-lg shadow-lg min-h-0 flex flex-col overflow-hidden">
                              <RankedMatchPanel 
                                lobbyType={isStrategic ? 'strategic' : 'playful'}
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
                      </div>
                  </div>
              
              {/* Right Sidebar Column */}
              <div className="col-span-2 flex flex-col gap-4 min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-row gap-4 items-stretch min-h-0 overflow-hidden">
                  <div className="flex-1 bg-panel border border-color rounded-lg shadow-lg min-w-0 min-h-0 overflow-hidden">
                    <PlayerList 
                      users={usersInThisRoom} 
                      mode={mode} 
                      onAction={handlers.handleAction} 
                      currentUser={currentUserWithStatus} 
                      negotiations={Object.values(negotiations)} 
                      onViewUser={handlers.openViewingUser} 
                      lobbyType={isStrategic ? 'strategic' : 'playful'} 
                      userCount={usersInThisRoom.length}
                      onOpenAiModal={() => setIsAiChallengeModalOpen(true)}
                    />
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <QuickAccessSidebar />
                  </div>
                </div>

                <div className="flex-1 bg-panel border border-color rounded-lg shadow-lg min-h-0 overflow-hidden">
                  <RankingList currentUser={currentUserWithStatus} mode={mode} onViewUser={handlers.openViewingUser} onShowTierInfo={() => setIsTierInfoModalOpen(true)} onShowPastRankings={handlers.openPastRankings} lobbyType={isStrategic ? 'strategic' : 'playful'} />
                </div>
              </div>
          </div>
      </div>
      {isTierInfoModalOpen && <TierInfoModal onClose={() => setIsTierInfoModalOpen(false)} />}
      {isHelpModalOpen && <HelpModal mode={mode} onClose={() => setIsHelpModalOpen(false)} />}
      {isAiChallengeModalOpen && (
        <AiChallengeModal 
          lobbyType={isStrategic ? 'strategic' : 'playful'} 
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
          onClose={() => setMatchFoundData(null)}
          onEnterGame={(gameId) => {
            setMatchFoundData(null);
            window.location.hash = `#/game/${gameId}`;
          }}
        />
      )}
    </div>
  );
};

export default WaitingRoom;
