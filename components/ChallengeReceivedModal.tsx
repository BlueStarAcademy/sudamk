import React, { useMemo, useState, useEffect } from 'react';
import { GameMode, UserWithStatus, GameSettings, Negotiation, ServerAction, User } from '../types.js';
import {
  SPECIAL_GAME_MODES,
  PLAYFUL_GAME_MODES,
  DEFAULT_GAME_SETTINGS,
  STRATEGIC_ACTION_POINT_COST,
  PLAYFUL_ACTION_POINT_COST,
} from '../constants.js';
import { 
  BOARD_SIZES, TIME_LIMITS, BYOYOMI_COUNTS, BYOYOMI_TIMES, CAPTURE_BOARD_SIZES, 
  CAPTURE_TARGETS, SPEED_BOARD_SIZES, SPEED_TIME_LIMITS, BASE_STONE_COUNTS,
  HIDDEN_STONE_COUNTS, SCAN_COUNTS, MISSILE_BOARD_SIZES, MISSILE_COUNTS,
  ALKKAGI_STONE_COUNTS, ALKKAGI_ROUNDS, CURLING_STONE_COUNTS, CURLING_ROUNDS,
  OMOK_BOARD_SIZES, HIDDEN_BOARD_SIZES, TTAMOK_CAPTURE_TARGETS, DICE_GO_ITEM_COUNTS,
  ALKKAGI_ITEM_COUNTS, CURLING_ITEM_COUNTS, ALKKAGI_GAUGE_SPEEDS, CURLING_GAUGE_SPEEDS,
  FISCHER_INCREMENT_SECONDS, getStrategicBoardSizesByMode
} from '../constants/gameSettings.js';
import { AlkkagiPlacementType, AlkkagiLayoutType } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import Avatar from './Avatar.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { projectActionPointsCurrent } from '../services/effectService.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants.js';
import {
  PRE_GAME_MODAL_ACCENT_BTN_CLASS,
  PRE_GAME_MODAL_DANGER_BTN_CLASS,
  PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
  PRE_GAME_MODAL_SUCCESS_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';

interface ChallengeReceivedModalProps {
  negotiation: Negotiation;
  currentUser: UserWithStatus;
  onAccept: (settings: GameSettings) => void;
  onDecline: () => void;
  onProposeModification: (settings: GameSettings) => void;
  onClose: () => void;
  onAction: (action: ServerAction) => void;
}

const ChallengeReceivedModal: React.FC<ChallengeReceivedModalProps> = ({ 
  negotiation, 
  currentUser, 
  onAccept, 
  onDecline, 
  onProposeModification, 
  onClose,
  onAction
}) => {
  const { onlineUsers, handlers } = useAppContext();

  const challenger = negotiation.challenger;
  const displayChallenger = useMemo(() => {
    const fresh = onlineUsers.find((u) => u.id === challenger.id);
    return fresh ?? challenger;
  }, [onlineUsers, challenger]);
  const [settings, setSettings] = useState<GameSettings>(negotiation.settings);
  const selectedMode = negotiation.mode;
  const actionPointCost = SPECIAL_GAME_MODES.some(m => m.mode === selectedMode) ? STRATEGIC_ACTION_POINT_COST : PLAYFUL_ACTION_POINT_COST;
  const myApProjected = projectActionPointsCurrent(currentUser as User, Date.now());
  const hasEnoughAP = !!currentUser?.isAdmin || myApProjected >= actionPointCost;

  const handleAcceptClick = () => {
    if (!currentUser?.isAdmin) {
      const ap = projectActionPointsCurrent(currentUser as User, Date.now());
      if (ap < actionPointCost) {
        handlers.openActionPointModal();
        return;
      }
    }
    onAccept(negotiation.settings);
  };
  
  // negotiation.settings가 변경되면 로컬 state 업데이트
  useEffect(() => {
    setSettings(negotiation.settings);
  }, [negotiation.settings]);

  useEffect(() => {
    const boardSizeOptions = getStrategicBoardSizesByMode(selectedMode);
    if (!boardSizeOptions.includes(settings.boardSize)) {
      handleSettingChange('boardSize', boardSizeOptions[0] as GameSettings['boardSize']);
    }
  }, [selectedMode, settings.boardSize]);
  
  const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleMixedModeToggle = (mode: GameMode, checked: boolean) => {
    const cur = settings.mixedModes || [];
    let mixedModes = checked ? [...cur, mode] : cur.filter((m) => m !== mode);
    const next: GameSettings = { ...settings, mixedModes };
    if (mode === GameMode.Base && checked) {
      next.komi = 0.5;
    }
    setSettings(next);
  };

  // 설정이 변경되었는지 확인
  const settingsHaveChanged = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(negotiation.settings);
  }, [settings, negotiation.settings]);

  const challengerAvatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === displayChallenger.avatarId)?.url, [displayChallenger.avatarId]);
  const challengerBorderUrl = useMemo(() => BORDER_POOL.find(b => b.id === displayChallenger.borderId)?.url, [displayChallenger.borderId]);

  const selectedGameDefinition = useMemo(() => {
    const allGameModes = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];
    return allGameModes.find(mode => mode.mode === selectedMode);
  }, [selectedMode]);

  const challengerLevel = useMemo(() => {
    const isStrategicLobby = SPECIAL_GAME_MODES.some((m) => m.mode === selectedMode);
    if (isStrategicLobby) {
      return displayChallenger.strategyLevel ?? 1;
    }
    return displayChallenger.playfulLevel ?? 1;
  }, [displayChallenger.strategyLevel, displayChallenger.playfulLevel, selectedMode]);

  const challengerGameStats = useMemo(() => {
    if (!selectedMode) return null;
    const stats = displayChallenger.stats || {};
    const gameStats = stats[selectedMode];
    if (!gameStats) {
      return { wins: 0, losses: 0, rankingScore: 1200 };
    }
    return gameStats;
  }, [selectedMode, displayChallenger.stats]);

  const getBoardSizeLabel = (size: number) => {
    // HIDDEN_BOARD_SIZES는 number 배열이므로 단순히 size를 반환
    return `${size}x${size}`;
  };

  const getStoneCountLabel = (count: number) => {
    // HIDDEN_STONE_COUNTS는 number 배열이므로 단순히 count를 반환
    return `${count}개`;
  };

  const isGoGame = [GameMode.Standard, GameMode.Speed, GameMode.Capture, GameMode.Omok, GameMode.Thief, GameMode.Missile].includes(selectedMode);
  const isAlkkagiGame = selectedMode === GameMode.Alkkagi;
  const isCurlingGame = selectedMode === GameMode.Curling;
  
  const mixRx = settings.mixedModes ?? [];
  const isMixRx = selectedMode === GameMode.Mix;

  const showBoardSize = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(selectedMode);
  const showKomi =
    ![GameMode.Capture, GameMode.Omok, GameMode.Ttamok, GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief, GameMode.Base].includes(selectedMode) &&
    !(isMixRx && mixRx.includes(GameMode.Base));
  const showTimeControls = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief].includes(selectedMode);
  const showFischer = selectedMode === GameMode.Speed || (isMixRx && mixRx.includes(GameMode.Speed));
  const showCaptureTarget = selectedMode === GameMode.Capture || (isMixRx && mixRx.includes(GameMode.Capture));
  const showTtamokCaptureTarget = selectedMode === GameMode.Ttamok;
  const showOmokRules = selectedMode === GameMode.Omok || selectedMode === GameMode.Ttamok;
  const showBaseStones = selectedMode === GameMode.Base || (isMixRx && mixRx.includes(GameMode.Base));
  const showHiddenStones = selectedMode === GameMode.Hidden || (isMixRx && mixRx.includes(GameMode.Hidden));
  const showMissileCount = selectedMode === GameMode.Missile || (isMixRx && mixRx.includes(GameMode.Missile));
  const showDiceGoSettings = selectedMode === GameMode.Dice;
  const showAlkkagiSettings = selectedMode === GameMode.Alkkagi;
  const showCurlingSettings = selectedMode === GameMode.Curling;
  const showMixModeSelection = selectedMode === GameMode.Mix;

  const [imgError, setImgError] = useState(false);
  
  // 30초 타임아웃 시각화
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [deadlineTime, setDeadlineTime] = useState<number | null>(null);
  
  // negotiation.deadline이 변경되면 즉시 타이머 시작
  useEffect(() => {
    if (negotiation.deadline) {
      // deadline을 받은 즉시 타이머 시작
      const deadline = negotiation.deadline;
      setDeadlineTime(deadline);
      // 즉시 남은 시간 계산
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeRemaining(Math.min(remaining, 60));
    } else {
      // deadline이 없으면 60초로 초기화
      setTimeRemaining(60);
      setDeadlineTime(null);
    }
  }, [negotiation.deadline]);
  
  // 타이머 업데이트 (즉시 시작)
  useEffect(() => {
    if (!deadlineTime) return;
    
    // 첫 업데이트는 즉시 실행
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((deadlineTime - Date.now()) / 1000));
      setTimeRemaining(Math.min(remaining, 60));
      
      // 시간이 0초가 되면 자동으로 거절 처리
      if (remaining <= 0) {
        console.log('[ChallengeReceivedModal] Time expired, auto-declining');
        onDecline();
      }
    };
    
    // 즉시 한 번 실행
    updateTime();
    
    // 이후 100ms마다 업데이트
    const interval = setInterval(updateTime, 100);
    
    return () => clearInterval(interval);
  }, [deadlineTime, onDecline]);
  
  const progressPercentage = (timeRemaining / 60) * 100;

  const boardSizeOptions = getStrategicBoardSizesByMode(selectedMode);

  return (
    <DraggableWindow
      title="대국 신청 받음"
      onClose={onClose}
      windowId="challenge-received"
      initialWidth={900}
      initialHeight={740}
      uniformPcScale
      bodyScrollable
      closeOnOutsideClick={false}
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="min-h-0 flex flex-col text-base antialiased">
        <div className="flex flex-row gap-4 h-[600px] min-h-[600px] min-w-0">
          {/* 좌측 패널: 게임 종류 이미지 및 게임 설명 */}
          <div className="w-1/3 border-r border-gray-700 pr-2 lg:pr-4 flex flex-col">
            <p className="mb-2 flex-shrink-0 text-center text-sm text-yellow-300 lg:mb-4" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>{displayChallenger.nickname}님에게서 대국 신청이 도착했습니다.</p>
            
            {/* 타임아웃 카운트다운 */}
            {negotiation.deadline && (
              <div className="mb-3 flex-shrink-0">
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">응답 남은 시간</span>
                    <span className={`text-xl font-bold ${timeRemaining <= 5 ? 'text-red-400' : timeRemaining <= 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {timeRemaining}초
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-100 ${timeRemaining <= 5 ? 'bg-red-500' : timeRemaining <= 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* 게임 이미지 */}
            {selectedGameDefinition && (
              <div className="mb-4 flex-shrink-0">
                <div className="w-full h-[150px] lg:h-[250px] bg-tertiary rounded-lg flex items-center justify-center overflow-hidden shadow-inner relative">
                  {!imgError ? (
                    <img 
                      src={selectedGameDefinition.image} 
                      alt={selectedMode} 
                      className="w-full h-full object-contain"
                      onError={() => setImgError(true)} 
                    />
                  ) : (
                    <span className="text-xl font-bold">{selectedMode}</span>
                  )}
                </div>
                <h3 className="text-center font-bold text-primary mt-2" style={{ fontSize: `${Math.max(15, Math.round(19 * 0.92))}px` }}>{selectedMode}</h3>
              </div>
            )}
            
            {/* 게임 설명 */}
            <div className="flex-grow overflow-y-auto pr-1">
              <h4 className="font-semibold text-gray-300 mb-2 lg:mb-3" style={{ fontSize: `${Math.max(13, Math.round(15 * 0.92))}px` }}>게임 설명</h4>
              <p className="text-tertiary leading-relaxed" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                {selectedGameDefinition?.description || '선택된 게임에 대한 설명이 없습니다.'}
              </p>
            </div>
          </div>

          {/* 우측 패널: 프로필 + 전적 + 대국 설정 */}
          <div className="w-2/3 pl-2 lg:pl-4 flex flex-col">
            {/* 신청자 프로필 */}
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 mb-4 flex-shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <Avatar 
                  userId={displayChallenger.id} 
                  userName={displayChallenger.nickname} 
                  avatarUrl={challengerAvatarUrl} 
                  borderUrl={challengerBorderUrl} 
                  size={Math.max(40, Math.round(54 * 0.92))} 
                />
                <div className="flex-grow">
                  <h3 className="font-bold" style={{ fontSize: `${Math.max(15, Math.round(19 * 0.92))}px` }}>{displayChallenger.nickname}</h3>
                  <p className="text-gray-400" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                    {SPECIAL_GAME_MODES.some(m => m.mode === selectedMode) ? '전략' : '놀이'} Lv.{challengerLevel}
                  </p>
                </div>
              </div>
              {/* 선택한 게임 전적 */}
              {selectedMode && challengerGameStats && (
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <p className="font-semibold text-gray-300 mb-2" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>{selectedMode} 전적</p>
                  <div className="flex justify-between items-center" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                    <span className="text-gray-400">승률</span>
                    <span className="font-bold">
                      {challengerGameStats.wins}승 {challengerGameStats.losses}패 
                      ({challengerGameStats.wins + challengerGameStats.losses > 0 
                        ? Math.round((challengerGameStats.wins / (challengerGameStats.wins + challengerGameStats.losses)) * 100) 
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                    <span className="text-gray-400">랭킹 점수</span>
                    <span className="font-mono text-yellow-300">{challengerGameStats.rankingScore}점</span>
                  </div>
                </div>
              )}
            </div>

            {/* 대국 설정 */}
            <div className="flex-grow overflow-y-auto">
              <h4 className="font-semibold text-gray-300 mb-3" style={{ fontSize: `${Math.max(13, Math.round(15 * 0.92))}px` }}>대국 설정</h4>
              <div className="space-y-2 lg:space-y-3 pr-2">
              {showMixModeSelection && (() => {
                const isBaseS = mixRx.includes(GameMode.Base);
                const isCapS = mixRx.includes(GameMode.Capture);
                return (
                  <div className="flex flex-col gap-2 border-b border-gray-600/50 pb-3 mb-1">
                    <label className="font-semibold text-amber-200/90" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                      믹스룰 조합 (2개 이상)
                    </label>
                    <p className="text-gray-500" style={{ fontSize: `${Math.max(11, Math.round(12 * 0.92))}px`, lineHeight: 1.35 }}>
                      클래식 바둑은 기본 포함입니다. 베이스와 따내기는 동시에 선택할 수 없습니다.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {SPECIAL_GAME_MODES.filter((m) => m.mode !== GameMode.Standard && m.mode !== GameMode.Mix).map((modeDef) => {
                        const conflict =
                          (modeDef.mode === GameMode.Base && isCapS) || (modeDef.mode === GameMode.Capture && isBaseS);
                        return (
                          <label
                            key={modeDef.mode}
                            className={`flex items-center gap-2 rounded-md bg-gray-700/40 p-2 ${conflict ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={mixRx.includes(modeDef.mode)}
                              disabled={conflict}
                              onChange={(e) => handleMixedModeToggle(modeDef.mode, e.target.checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-gray-300" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                              {modeDef.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {mixRx.length < 2 && (
                      <p className="text-red-400" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                        최소 2개 이상의 규칙을 선택해야 합니다.
                      </p>
                    )}
                  </div>
                );
              })()}
              {showBoardSize && (
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>판 크기</label>
                  <select 
                    value={settings.boardSize} 
                    onChange={e => handleSettingChange('boardSize', parseInt(e.target.value, 10) as GameSettings['boardSize'])}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {(selectedMode === GameMode.Omok || selectedMode === GameMode.Ttamok ? OMOK_BOARD_SIZES : 
                      selectedMode === GameMode.Thief ? [9, 13, 19] : 
                      boardSizeOptions).map(size => (
                      <option key={size} value={size}>{size}줄</option>
                    ))}
                  </select>
                </div>
              )}

              {showKomi && (
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>덤 (백)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      step="1" 
                      value={Math.floor(settings.komi)} 
                      onChange={e => handleSettingChange('komi', parseInt(e.target.value, 10) + 0.5)} 
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                      style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }} 
                    />
                    <span className="font-bold text-gray-300 whitespace-nowrap" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>.5 집</span>
                  </div>
                </div>
              )}

              {showTimeControls &&
                (showFischer ? (
                  <>
                    <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                      <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                        제한 시간
                      </label>
                      <select
                        value={settings.timeLimit}
                        onChange={(e) => handleSettingChange('timeLimit', parseInt(e.target.value, 10))}
                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                        style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                      >
                        {SPEED_TIME_LIMITS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                      <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                        초읽기 시간
                      </label>
                      <p className="text-gray-300" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                        {FISCHER_INCREMENT_SECONDS}초 (피셔 방식)
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                      <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                        제한 시간
                      </label>
                      <select
                        value={settings.timeLimit}
                        onChange={(e) => handleSettingChange('timeLimit', parseInt(e.target.value, 10))}
                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                        style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                      >
                        {TIME_LIMITS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                      <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>
                        초읽기
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={settings.byoyomiTime}
                          onChange={(e) => handleSettingChange('byoyomiTime', parseInt(e.target.value, 10))}
                          className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                          style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                        >
                          {BYOYOMI_TIMES.map((t) => (
                            <option key={t} value={t}>
                              {t}초
                            </option>
                          ))}
                        </select>
                        <select
                          value={settings.byoyomiCount}
                          onChange={(e) => handleSettingChange('byoyomiCount', parseInt(e.target.value, 10))}
                          className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                          style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                        >
                          {BYOYOMI_COUNTS.map((c) => (
                            <option key={c} value={c}>
                              {c}회
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ))}

              {showCaptureTarget && (
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>포획 목표</label>
                  <select 
                    value={settings.captureTarget} 
                    onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                  </select>
                </div>
              )}

              {showTtamokCaptureTarget && (
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>따내기 목표</label>
                  <select 
                    value={settings.captureTarget ?? 20} 
                    onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {TTAMOK_CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}개</option>)}
                  </select>
                </div>
              )}

              {showOmokRules && (
                <>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>쌍삼 금지</label>
                    <input 
                      type="checkbox" 
                      checked={settings.has33Forbidden ?? true} 
                      onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                      className="w-5 h-5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>장목 금지</label>
                    <input 
                      type="checkbox" 
                      checked={settings.hasOverlineForbidden ?? true} 
                      onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} 
                      className="w-5 h-5"
                    />
                  </div>
                </>
              )}

              {showBaseStones && (
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>베이스 돌</label>
                  <select 
                    value={settings.baseStones} 
                    onChange={e => handleSettingChange('baseStones', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {BASE_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                  </select>
                </div>
              )}

              {showHiddenStones && (
                <>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>히든아이템</label>
                    <select 
                      value={settings.hiddenStoneCount} 
                      onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {HIDDEN_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>스캔아이템</label>
                    <select 
                      value={settings.scanCount || 5} 
                      onChange={e => handleSettingChange('scanCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {SCAN_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                </>
              )}

              {selectedMode === GameMode.Thief && (
                <>
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>도둑말 개수</label>
                  <select 
                    value={settings.hiddenStoneCount ?? 3} 
                    onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {[1, 2, 3, 4, 5].map(c => <option key={c} value={c}>{c}개</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>높은 수 (3~6)</label>
                  <select
                    value={settings.thiefHigh36ItemCount ?? 1}
                    onChange={e => handleSettingChange('thiefHigh36ItemCount', parseInt(e.target.value, 10))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>1방지 (2~5)</label>
                  <select
                    value={settings.thiefNoOneItemCount ?? 1}
                    onChange={e => handleSettingChange('thiefNoOneItemCount', parseInt(e.target.value, 10))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                  </select>
                </div>
                </>
              )}

              {showMissileCount && (
                <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                  <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>미사일 개수</label>
                  <select 
                    value={settings.missileCount} 
                    onChange={e => handleSettingChange('missileCount', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                  >
                    {MISSILE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                  </select>
                </div>
              )}

              {showDiceGoSettings && (
                <>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>라운드 설정</label>
                    <select 
                      value={settings.diceGoRounds ?? 3} 
                      onChange={e => handleSettingChange('diceGoRounds', parseInt(e.target.value, 10) as 1 | 2 | 3)}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {[1, 2, 3].map(r => <option key={r} value={r}>{r}라운드</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>홀수 주사위</label>
                    <select 
                      value={settings.oddDiceCount ?? 1} 
                      onChange={e => handleSettingChange('oddDiceCount', parseInt(e.target.value, 10))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>짝수 주사위</label>
                    <select 
                      value={settings.evenDiceCount ?? 1} 
                      onChange={e => handleSettingChange('evenDiceCount', parseInt(e.target.value, 10))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>낮은 수 (1~3)</label>
                    <select 
                      value={settings.lowDiceCount ?? 1} 
                      onChange={e => handleSettingChange('lowDiceCount', parseInt(e.target.value, 10))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>높은 수 (4~6)</label>
                    <select 
                      value={settings.highDiceCount ?? 1} 
                      onChange={e => handleSettingChange('highDiceCount', parseInt(e.target.value, 10))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                </>
              )}

              {showAlkkagiSettings && (
                <>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>돌 개수</label>
                    <select 
                      value={settings.alkkagiStoneCount ?? 5} 
                      onChange={e => handleSettingChange('alkkagiStoneCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {ALKKAGI_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>라운드</label>
                    <select 
                      value={settings.alkkagiRounds ?? 1} 
                      onChange={e => handleSettingChange('alkkagiRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {ALKKAGI_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>배치 방식</label>
                    <select 
                      value={settings.alkkagiPlacementType ?? AlkkagiPlacementType.TurnByTurn} 
                      onChange={e => handleSettingChange('alkkagiPlacementType', e.target.value as AlkkagiPlacementType)}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {Object.values(AlkkagiPlacementType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>배치 전장</label>
                    <select 
                      value={settings.alkkagiLayout ?? AlkkagiLayoutType.Normal} 
                      onChange={e => handleSettingChange('alkkagiLayout', e.target.value as AlkkagiLayoutType)}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {Object.values(AlkkagiLayoutType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>게이지 속도</label>
                    <select 
                      value={settings.alkkagiGaugeSpeed ?? 700} 
                      onChange={e => handleSettingChange('alkkagiGaugeSpeed', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {ALKKAGI_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>슬로우 아이템</label>
                    <select 
                      value={settings.alkkagiSlowItemCount ?? 2} 
                      onChange={e => handleSettingChange('alkkagiSlowItemCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>조준선 아이템</label>
                    <select 
                      value={settings.alkkagiAimingLineItemCount ?? 2} 
                      onChange={e => handleSettingChange('alkkagiAimingLineItemCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                </>
              )}

              {showCurlingSettings && (
                <>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>돌 개수</label>
                    <select 
                      value={settings.curlingStoneCount ?? 5} 
                      onChange={e => handleSettingChange('curlingStoneCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {CURLING_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>라운드</label>
                    <select 
                      value={settings.curlingRounds ?? 3} 
                      onChange={e => handleSettingChange('curlingRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {CURLING_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>게이지 속도</label>
                    <select 
                      value={settings.curlingGaugeSpeed ?? 700} 
                      onChange={e => handleSettingChange('curlingGaugeSpeed', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {CURLING_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>슬로우 아이템</label>
                    <select 
                      value={settings.curlingSlowItemCount ?? 2} 
                      onChange={e => handleSettingChange('curlingSlowItemCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 lg:gap-2 items-center">
                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}>조준선 아이템</label>
                    <select 
                      value={settings.curlingAimingLineItemCount ?? 2} 
                      onChange={e => handleSettingChange('curlingAimingLineItemCount', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                    style={{ fontSize: `${Math.max(12, Math.round(14 * 0.92))}px` }}
                    >
                      {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                    </select>
                  </div>
                </>
              )}
              </div>
            </div>

            <div
              className="mt-2 lg:mt-3 p-2 lg:p-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-200 flex-shrink-0"
            >
              <p className="text-center text-sm lg:text-base">
                수락 시 행동력 <span className="text-amber-300 font-semibold">⚡{actionPointCost}</span>가 소모됩니다.
                {!currentUser?.isAdmin && !hasEnoughAP && (
                  <span className="block mt-1 text-amber-200/95">
                    현재 추정 행동력이 부족합니다. 수락을 누르면 행동력 관리 창이 열립니다.
                  </span>
                )}
              </p>
            </div>

            {/* 하단 버튼 */}
            <div className="mt-2 flex flex-wrap justify-stretch gap-2 border-t border-amber-500/25 bg-gradient-to-t from-black/20 to-transparent pt-3 lg:mt-4 lg:gap-3 lg:pt-4 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:!min-h-[2.75rem]">
              <Button
                onClick={onDecline}
                colorScheme="none"
                className={`${PRE_GAME_MODAL_DANGER_BTN_CLASS} !font-semibold !tracking-wide`}
                style={{ fontSize: `${Math.max(14, Math.round(16 * 0.92))}px`, lineHeight: 1.3 }}
              >
                거절
              </Button>
              <Button
                onClick={() => onProposeModification(settings)}
                colorScheme="none"
                disabled={!settingsHaveChanged}
                className={
                  !settingsHaveChanged
                    ? `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !cursor-not-allowed !font-semibold !tracking-wide !opacity-45`
                    : `${PRE_GAME_MODAL_ACCENT_BTN_CLASS} !font-semibold !tracking-wide`
                }
                style={{ fontSize: `${Math.max(14, Math.round(16 * 0.92))}px`, lineHeight: 1.3 }}
              >
                수정 제안
              </Button>
              <Button
                onClick={handleAcceptClick}
                colorScheme="none"
                disabled={settingsHaveChanged}
                className={
                  settingsHaveChanged
                    ? `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !cursor-not-allowed !font-semibold !tracking-wide !opacity-45`
                    : `${PRE_GAME_MODAL_SUCCESS_BTN_CLASS} !font-semibold !tracking-wide`
                }
                style={{ fontSize: `${Math.max(14, Math.round(16 * 0.92))}px`, lineHeight: 1.3 }}
              >
                수락 (⚡{actionPointCost})
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default ChallengeReceivedModal;

