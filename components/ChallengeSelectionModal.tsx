import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalizedGameMode } from '../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import { GameMode, User, UserWithStatus, GameSettings, Negotiation } from '../types';
import {
  SPECIAL_GAME_MODES,
  PLAYFUL_GAME_MODES,
  DEFAULT_GAME_SETTINGS,
  isPlayableLobbyGameMode,
} from '../constants';
import { 
  BOARD_SIZES, TIME_LIMITS, BYOYOMI_COUNTS, BYOYOMI_TIMES, CAPTURE_BOARD_SIZES, 
  CAPTURE_TARGETS, TTAMOK_CAPTURE_TARGETS, SPEED_BOARD_SIZES, SPEED_TIME_LIMITS, BASE_STONE_COUNTS,
  HIDDEN_STONE_COUNTS, SCAN_COUNTS, MISSILE_BOARD_SIZES, MISSILE_COUNTS,
  ALKKAGI_STONE_COUNTS, ALKKAGI_ROUNDS, ALKKAGI_GAUGE_SPEEDS, ALKKAGI_ITEM_COUNTS,
  CURLING_STONE_COUNTS, CURLING_ROUNDS, CURLING_GAUGE_SPEEDS, CURLING_ITEM_COUNTS,
  OMOK_BOARD_SIZES, HIDDEN_BOARD_SIZES, DICE_GO_ITEM_COUNTS, getStrategicBoardSizesByMode,
  applyByoyomiTimeControl, getCastleCountsByBoardSize, clampCastleCount, getDefaultCastleKomiByBoardSize, getDefaultCastleCountByBoardSize,
  getDefaultChessKomiByBoardSize, getDefaultChessScoringTurnLimit,
} from '../constants/gameSettings';
import { getRankedGameSettings } from '../constants/rankedGameSettings';
import { MAX_GAME_INTEGER_INPUT } from '../shared/constants/numericLimits.js';
import { clampGameInt } from '../shared/utils/gameIntegerField.js';
import { mixSubRuleDisplayName } from '../shared/utils/mixSubRuleDisplayName.js';
import { sanitizePvpGameSettings, stripHumanPvpTurnLimitFields } from '../shared/utils/sanitizePvpGameSettings.js';
import {
  applyMixModeSettingsConstraints,
  getMixBoardSizeOptions,
  isMixSubModeCheckboxDisabled,
  normalizeMixedModesSelection,
} from '../shared/utils/mixModeSettings.js';
import StrategicTimeControlFields from './game/StrategicTimeControlFields.js';
import { AlkkagiPlacementType, AlkkagiLayoutType } from '../types';
import Button from './Button';
import DraggableWindow from './DraggableWindow';
import Avatar from './Avatar';
import { useAppContext } from '../hooks/useAppContext';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import {
  LOBBY_MOBILE_BTN_DANGER_CLASS,
  LOBBY_MOBILE_BTN_DISABLED_WAIT_CLASS,
  LOBBY_MOBILE_BTN_PRIMARY_CLASS,
  LOBBY_MOBILE_BTN_SECONDARY_CLASS,
  LOBBY_MOBILE_MODAL_FOOTER_CLASS,
  PRE_GAME_MODAL_PRIMARY_BTN_CLASS,
  PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
  PRE_GAME_MODAL_DANGER_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout';
import {
    basePvpActionPointCostForMode,
    effectiveNegotiationApCostForUser,
    formatActionPointCostWithPetDiscount,
} from '../shared/utils/pairPetArenaApDiscount.js';

interface ChallengeSelectionModalProps {
  opponent: UserWithStatus;
  onChallenge: (mode: GameMode, settings?: GameSettings) => void;
  onClose: () => void;
  lobbyType: 'strategic' | 'playful';
  negotiations?: Negotiation[];
  currentUser?: UserWithStatus;
}

/** 서버 negotiationActions: SEND_CHALLENGE 후 deadline = now + 60000 */
const CHALLENGE_NEGOTIATION_WINDOW_SEC = 60;

const GameCard: React.FC<{ 
    mode: GameMode, 
    image: string, 
    onSelect: (mode: GameMode) => void,
    isSelected: boolean,
    isRejected: boolean,
    scaleFactor?: number;
    /** 상대 응답 대기 중에는 카드 변경 불가 */
    interactionLocked?: boolean;
    comingSoon?: boolean;
}> = ({ mode, image, onSelect, isSelected, isRejected, scaleFactor = 1, interactionLocked = false, comingSoon = false }) => {
    const { t } = useTranslation('game');
    const [imgError, setImgError] = useState(false);
    
    // 스케일에 따른 크기 계산 (더 컴팩트하게)
    const padding = Math.max(3, Math.round(6 * scaleFactor));
    const imageHeight = Math.max(70, Math.round(100 * scaleFactor));
    const fontSize = Math.max(10, Math.round(12 * scaleFactor));
    const titleFontSize = Math.max(11, Math.round(13 * scaleFactor));

    const noClick = isRejected || interactionLocked || comingSoon;
    return (
        <button
            type="button"
            data-lobby-mode-card
            disabled={noClick}
            className={`bg-panel text-on-panel touch-manipulation flex w-full flex-col items-center rounded-lg text-center appearance-none border-0 outline-none transition-all transform active:scale-[0.98] ${
                isRejected || comingSoon
                    ? 'opacity-50 cursor-not-allowed grayscale pointer-events-none' 
                    : interactionLocked && !isSelected
                    ? 'opacity-55 cursor-default shadow-lg'
                    : isSelected
                    ? `ring-2 ring-primary shadow-lg ${interactionLocked ? '' : 'hover:-translate-y-1 cursor-pointer'}`
                    : 'hover:-translate-y-1 shadow-lg cursor-pointer'
            }`}
            style={{ padding: `${padding}px`, gap: `${Math.max(4, Math.round(8 * scaleFactor))}px` }}
            onClick={() => {
                if (!noClick) {
                    onSelect(mode);
                }
            }}
        >
            <div
                className="relative flex w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-tertiary text-tertiary shadow-inner"
                style={{
                    height: `${imageHeight}px`,
                    padding: `${Math.max(4, Math.round(8 * scaleFactor))}px`,
                }}
            >
                {!imgError ? (
                    <>
                        <img 
                            src={image} 
                            alt={mode} 
                            className={`w-full h-full object-contain ${isRejected ? 'grayscale' : ''}`}
                            onError={() => setImgError(true)} 
                        />
                        {isRejected && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <span 
                                    className="text-white font-bold text-center"
                                    style={{ fontSize: `${fontSize}px` }}
                                >
                                    {t('challengeModal.rejected')}
                                </span>
                            </div>
                        )}
                        {comingSoon && !isRejected && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center px-1">
                                <span
                                    className="text-white font-bold text-center leading-tight"
                                    style={{ fontSize: `${Math.max(9, fontSize - 1)}px` }}
                                >
                                    {t('challengeModal.preparing')}
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <span style={{ fontSize: `${fontSize}px` }}>{mode}</span>
                )}
            </div>
            <h3
                className={`w-full shrink-0 font-bold leading-tight ${isRejected ? 'text-gray-400' : 'text-primary'}`}
                style={{ fontSize: `${titleFontSize}px` }}
            >
                {mode}
            </h3>
        </button>
    );
};

const SettingsSection: React.FC<{
  title: string;
  children: React.ReactNode;
  scaleFactor: number;
}> = ({ title, children, scaleFactor }) => (
  <section className="min-w-0 rounded-lg border border-white/[0.12] bg-gray-900/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <h4
      className="mb-2.5 border-b border-amber-500/20 pb-2 font-semibold text-amber-200/95"
      style={{ fontSize: `${Math.max(13, Math.round(14 * scaleFactor))}px`, lineHeight: 1.35 }}
    >
      {title}
    </h4>
    <div className="flex min-w-0 flex-col">{children}</div>
  </section>
);

const ChallengeSelectionModal: React.FC<ChallengeSelectionModalProps> = ({ opponent, onChallenge, onClose, lobbyType, negotiations, currentUser: propCurrentUser }) => {
  const { t } = useTranslation('game');
  const localizeMode = useLocalizedGameMode();
  const { currentUserWithStatus: contextCurrentUser, handlers, onlineUsers } = useAppContext();
  const currentUser = propCurrentUser || contextCurrentUser;

  /** 대기실 목록보다 onlineUsers에 최신 레벨·전적이 올 수 있음 */
  const displayOpponent = useMemo(() => {
    const fresh = onlineUsers.find((u) => u.id === opponent.id);
    return fresh ?? opponent;
  }, [onlineUsers, opponent]);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const hadNegotiationForThisOpponentRef = useRef(false);

  /** PC 설계 캔버스 좌표 — App canvas scale로 균일 축소 */
  const calculatedWidth = 900;
  const calculatedHeight = 780;
  const scaleFactor = 1;
  const isHandheldLobbyUi = useIsHandheldDevice(1024);
  
  // 현재 negotiation 상태 확인 (모든 상태 포함)
  const currentNegotiation = useMemo(() => {
    if (!currentUser || !negotiations) return null;
    // negotiations가 배열인지 객체인지 확인
    const negotiationsArray = Array.isArray(negotiations) ? negotiations : Object.values(negotiations);
    return negotiationsArray.find((n: any) => {
      const neg = n as Negotiation;
      return neg.challenger.id === currentUser.id && neg.opponent.id === opponent.id;
    }) as Negotiation | undefined || null;
  }, [currentUser, opponent.id, negotiations]);

  useEffect(() => {
    if (currentNegotiation) hadNegotiationForThisOpponentRef.current = true;
  }, [currentNegotiation]);

  /** 수락·거절·타임아웃 등으로 협상이 사라지면 모달 닫기 (신청 전에는 동작하지 않음) */
  useEffect(() => {
    if (!hadNegotiationForThisOpponentRef.current) return;
    if (currentNegotiation) return;
    onClose();
  }, [currentNegotiation, onClose]);

  /** 상대가 먼저 보낸 대국 신청이 도착하면 작성 창은 닫고 수신 모달로 넘김 */
  useEffect(() => {
    if (!currentUser?.id || !negotiations?.length) return;
    const list = (Array.isArray(negotiations) ? negotiations : Object.values(negotiations)) as Negotiation[];
    const incoming = list.find(
      (n) =>
        n.status === 'pending' &&
        n.challenger.id === opponent.id &&
        n.opponent.id === currentUser.id
    );
    if (incoming) onClose();
  }, [negotiations, opponent.id, currentUser?.id, onClose]);
  
  /** 초기 신청 후 상대(수락/거절) 차례 — 서버가 proposerId를 opponent로 둠 */
  const isWaitingForResponse = currentNegotiation?.status === 'pending' && currentNegotiation?.proposerId === opponent.id;

  const availableGames = lobbyType === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
  const actionPointModeForAp = useMemo(() => {
      if (selectedMode) return selectedMode;
      return availableGames[0]?.mode ?? GameMode.Standard;
  }, [selectedMode, availableGames]);
  const actionPointBase = useMemo(() => basePvpActionPointCostForMode(actionPointModeForAp), [actionPointModeForAp]);
  const actionPointEffective = useMemo(() => {
      if (!currentUser) return actionPointBase;
      return effectiveNegotiationApCostForUser(currentUser as User, actionPointModeForAp);
  }, [currentUser, actionPointBase, actionPointModeForAp]);
  const actionPointCostDisplay = useMemo(
      () => formatActionPointCostWithPetDiscount(actionPointBase, actionPointEffective),
      [actionPointBase, actionPointEffective],
  );

  // 친선전 표시 (현재 협상 시스템은 모두 친선전)
  const isCasual = true;

  // 상대방이 대기실에서 나갔는지 확인
  // — 신청 후 상대는 'negotiating'이 되므로, 응답 대기 중에는 이 상태를 허용해야 모달이 바로 닫히지 않음
  // — 작성 전에도 상대가 먼저 신청하면 negotiating이 될 수 있음 → 오프라인 오탐·모달 오닫힘 방지
  useEffect(() => {
    if (isWaitingForResponse) return;
    const currentOpponent = onlineUsers.find(u => u.id === opponent.id);
    // negotiating: 상대가 먼저 신청·초안 작성 중이어도 작성 창은 유지(WS 순서로 오닫힘 방지). 대국/관전/오프라인만 닫음
    const allowed: string[] = ['waiting', 'online', 'resting', 'negotiating'];
    if (!currentOpponent || !allowed.includes(currentOpponent.status)) {
      onClose();
    }
  }, [onlineUsers, opponent.id, onClose, isWaitingForResponse]);

  const withdrawNegotiationAndClose = useCallback(() => {
    if (currentNegotiation?.id) {
      handlers.handleAction({ type: 'DECLINE_NEGOTIATION', payload: { negotiationId: currentNegotiation.id } });
    }
    onClose();
  }, [currentNegotiation?.id, handlers, onClose]);

  /** 상대 응답 대기 중에는 X/바깥 클릭으로 닫지 않음 — 신청 취소만 허용 */
  const handleAttemptClose = useCallback(() => {
    if (isWaitingForResponse) return;
    if (currentNegotiation?.status === 'draft' && currentNegotiation.id) {
      handlers.handleAction({ type: 'DECLINE_NEGOTIATION', payload: { negotiationId: currentNegotiation.id } });
    }
    onClose();
  }, [isWaitingForResponse, currentNegotiation?.status, currentNegotiation?.id, handlers, onClose]);
  
  // negotiation이 업데이트되면 selectedMode와 settings 동기화
  useEffect(() => {
    if (currentNegotiation && currentNegotiation.status === 'pending') {
      if (!selectedMode || selectedMode !== currentNegotiation.mode) {
        setSelectedMode(currentNegotiation.mode);
      }
      if (JSON.stringify(settings) !== JSON.stringify(currentNegotiation.settings)) {
        setSettings(currentNegotiation.settings);
      }
    }
  }, [currentNegotiation, selectedMode, settings]);

  // 상대방 프로필 정보
  const opponentAvatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === displayOpponent.avatarId)?.url, [displayOpponent.avatarId]);
  const opponentBorderUrl = useMemo(() => BORDER_POOL.find(b => b.id === displayOpponent.borderId)?.url, [displayOpponent.borderId]);

  // 선택한 게임에 대한 상대방 전적
  const selectedGameStats = useMemo(() => {
    if (!selectedMode) return null;
    const stats = displayOpponent.stats || {};
    const gameStats = stats[selectedMode];
    if (!gameStats) {
      return { wins: 0, losses: 0, rankingScore: 1200 };
    }
    return gameStats;
  }, [selectedMode, displayOpponent.stats]);

  /** NegotiationModal과 동일: 서버 저장 전략/놀이 레벨 필드 사용 (XP/100 가짜 레벨 아님) */
  const opponentLevel = useMemo(() => displayOpponent.userLevel ?? 1, [displayOpponent.userLevel]);

  // 선택한 게임 정의
  const selectedGameDefinition = useMemo(() => {
    if (!selectedMode) return null;
    return availableGames.find(game => game.mode === selectedMode) || null;
  }, [selectedMode, availableGames]);

  // 60초 응답 창 (서버 negotiation deadline 과 일치)
  const negotiationDeadline = currentNegotiation?.deadline;
  const [timeRemaining, setTimeRemaining] = useState<number>(CHALLENGE_NEGOTIATION_WINDOW_SEC);
  
  useEffect(() => {
    if (negotiationDeadline && isWaitingForResponse) {
      const remaining = Math.max(0, Math.ceil((negotiationDeadline - Date.now()) / 1000));
      setTimeRemaining(Math.min(remaining, CHALLENGE_NEGOTIATION_WINDOW_SEC));
    } else if (!isWaitingForResponse) {
      setTimeRemaining(CHALLENGE_NEGOTIATION_WINDOW_SEC);
    }
  }, [negotiationDeadline, isWaitingForResponse]);
  
  useEffect(() => {
    if (!isWaitingForResponse || !negotiationDeadline) return;
    const startTime = negotiationDeadline;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((startTime - Date.now()) / 1000));
      setTimeRemaining(Math.min(remaining, CHALLENGE_NEGOTIATION_WINDOW_SEC));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [isWaitingForResponse, negotiationDeadline]);
  
  const progressPercentage =
    CHALLENGE_NEGOTIATION_WINDOW_SEC > 0
      ? (timeRemaining / CHALLENGE_NEGOTIATION_WINDOW_SEC) * 100
      : 0;

  const mergeModeSettings = useCallback((mode: GameMode, savedSettings?: Partial<GameSettings>): GameSettings => {
    const base = savedSettings
      ? ({ ...DEFAULT_GAME_SETTINGS, ...savedSettings } as GameSettings)
      : mode === GameMode.Castle
        ? ({
            ...DEFAULT_GAME_SETTINGS,
            boardSize: 13,
            castleCount: getDefaultCastleCountByBoardSize(13),
            komi: getDefaultCastleKomiByBoardSize(13),
            timeLimit: 10,
            byoyomiTime: 30,
            byoyomiCount: 3,
          } as GameSettings)
        : mode === GameMode.Chess
          ? ({
              ...DEFAULT_GAME_SETTINGS,
              boardSize: 13,
              komi: getDefaultChessKomiByBoardSize(13),
              scoringTurnLimit: getDefaultChessScoringTurnLimit(),
              timeLimit: 10,
              byoyomiTime: 30,
              byoyomiCount: 3,
            } as GameSettings)
        : ({ ...DEFAULT_GAME_SETTINGS, ...getRankedGameSettings(mode) } as GameSettings);
    if (mode === GameMode.Capture) {
      base.scoringTurnLimit = 0;
      delete (base as { autoScoringTurns?: number }).autoScoringTurns;
    }
    if (mode === GameMode.Castle) {
      base.scoringTurnLimit = 0;
      delete (base as { autoScoringTurns?: number }).autoScoringTurns;
    }
    if (mode === GameMode.Chess) {
      base.boardSize = 13;
      base.komi = getDefaultChessKomiByBoardSize(13);
      base.scoringTurnLimit = getDefaultChessScoringTurnLimit();
      delete (base as { autoScoringTurns?: number }).autoScoringTurns;
    }
    if (
      mode === GameMode.Speed ||
      (mode === GameMode.Mix && base.mixedModes?.includes(GameMode.Speed))
    ) {
      return applyByoyomiTimeControl(base);
    }
    return base;
  }, []);

  const handleGameSelect = (mode: GameMode) => {
    const def = availableGames.find((g) => g.mode === mode);
    if (def && !isPlayableLobbyGameMode(def)) return;
    try {
      if (selectedMode && selectedMode !== mode) {
        localStorage.setItem(`preferredGameSettings_${selectedMode}`, JSON.stringify(settings));
      }
    } catch {
      /* ignore quota / private mode */
    }
    setSelectedMode(mode);
    // 로컬 스토리지에서 선호 설정 불러오기
    try {
      const storageKey = `preferredGameSettings_${mode}`;
      const savedSettingsJSON = localStorage.getItem(storageKey);
      if (savedSettingsJSON) {
        setSettings(mergeModeSettings(mode, JSON.parse(savedSettingsJSON)));
      } else {
        setSettings(mergeModeSettings(mode));
      }
    } catch (e) {
      setSettings(mergeModeSettings(mode));
    }
  };

  const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (selectedMode === GameMode.Castle && key === 'boardSize') {
        const boardSize = Number(value);
        next.komi = getDefaultCastleKomiByBoardSize(boardSize);
        next.castleCount = clampCastleCount(next.castleCount ?? getDefaultCastleCountByBoardSize(boardSize), boardSize);
      }
      return next;
    });
  };

  const handleMixedModeChange = (mode: GameMode, checked: boolean) => {
    setSettings((prev) => {
      const mixedModes = normalizeMixedModesSelection(prev.mixedModes, mode, checked);
      let next: GameSettings = applyMixModeSettingsConstraints({ ...prev, mixedModes });
      if (mode === GameMode.Base && checked) {
        next.komi = 0.5;
      }
      if (mode === GameMode.Speed && checked) {
        return applyByoyomiTimeControl(next);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!selectedMode) return;
    if (selectedMode === GameMode.Chess) {
      setSettings((prev) => {
        const next = {
          ...prev,
          boardSize: 13 as GameSettings['boardSize'],
          komi: getDefaultChessKomiByBoardSize(13),
          scoringTurnLimit: getDefaultChessScoringTurnLimit(),
        };
        if (
          prev.boardSize === next.boardSize &&
          prev.komi === next.komi &&
          prev.scoringTurnLimit === next.scoringTurnLimit
        ) {
          return prev;
        }
        return next;
      });
      return;
    }
    const boardSizeOptions = getStrategicBoardSizesByMode(selectedMode);
    if (!boardSizeOptions.includes(settings.boardSize)) {
      handleSettingChange('boardSize', boardSizeOptions[0] as GameSettings['boardSize']);
    }
  }, [selectedMode, settings.boardSize]);

  const handleChallenge = async () => {
    if (!selectedMode) return;

    // 거부된 게임인지 확인
    if (displayOpponent.rejectedGameModes?.includes(selectedMode)) {
      return;
    }

    if (selectedMode === GameMode.Mix && (!settings.mixedModes || settings.mixedModes.length < 2)) {
      alert(t('challengeModal.mixRulesMinAlert'));
      return;
    }

    let finalSettings: GameSettings = { ...settings };
    const mixHasCapture =
      selectedMode === GameMode.Mix && (finalSettings.mixedModes || []).includes(GameMode.Capture);
    if (selectedMode === GameMode.Capture || mixHasCapture) {
      finalSettings = stripHumanPvpTurnLimitFields(finalSettings);
    }
    if (lobbyType === 'strategic') {
      finalSettings = stripHumanPvpTurnLimitFields(finalSettings);
    }
    finalSettings = sanitizePvpGameSettings(selectedMode, finalSettings, { isAiGame: false });

    // 현재 유저가 대기 상태인지 확인하고, 아니면 대기 상태로 설정
    if (currentUser && currentUser.status !== 'waiting' && currentUser.status !== 'resting') {
      try {
        await handlers.handleAction({ 
          type: 'ENTER_WAITING_ROOM', 
          payload: { mode: lobbyType === 'strategic' ? 'strategic' : 'playful' } 
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        onChallenge(selectedMode, finalSettings);
      } catch (error) {
        console.error('Failed to enter waiting room:', error);
        onChallenge(selectedMode, finalSettings);
      }
    } else {
      onChallenge(selectedMode, finalSettings);
    }
  };

  // 게임 모드별 설정 UI 렌더링
  const renderGameSettings = () => {
    if (!selectedMode) {
      return (
        <div
          className="text-center text-gray-300 antialiased subpixel-antialiased [text-rendering:optimizeLegibility]"
          style={{
            paddingTop: `${Math.max(32, Math.round(32 * scaleFactor))}px`,
            paddingBottom: `${Math.max(32, Math.round(32 * scaleFactor))}px`,
            fontSize: `${Math.max(15, Math.round(17 * scaleFactor))}px`,
            lineHeight: 1.45,
          }}
        >
          {t('challengeModal.selectModePrompt')}
        </div>
      );
    }

    const mix = settings.mixedModes ?? [];
    const isMix = selectedMode === GameMode.Mix;

    const showBoardSize = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Chess].includes(selectedMode);
    const showKomi =
      ![GameMode.Capture, GameMode.Omok, GameMode.Ttamok, GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief, GameMode.Base, GameMode.Chess].includes(selectedMode) &&
      !(isMix && mix.includes(GameMode.Base));
    const showCastleCount = selectedMode === GameMode.Castle || (isMix && mix.includes(GameMode.Castle));
    const showCastleDedicatedTimeControls = selectedMode === GameMode.Castle;
    const showTimeControls = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief].includes(selectedMode) && !showCastleDedicatedTimeControls;
    const showSpeedTimeControls = selectedMode === GameMode.Speed || (isMix && mix.includes(GameMode.Speed));

    const showMixModeSelection = isMix;
    const showCaptureTarget = selectedMode === GameMode.Capture || (isMix && mix.includes(GameMode.Capture));
    const showTtamokCaptureTarget = selectedMode === GameMode.Ttamok;
    const showOmokRules = selectedMode === GameMode.Omok || selectedMode === GameMode.Ttamok;
    const showBaseStones = selectedMode === GameMode.Base || (isMix && mix.includes(GameMode.Base));
    const showHiddenStones = selectedMode === GameMode.Hidden || (isMix && mix.includes(GameMode.Hidden));
    const showMissileCount = selectedMode === GameMode.Missile || (isMix && mix.includes(GameMode.Missile));
    const showDiceGoSettings = selectedMode === GameMode.Dice;
    const showThiefGoItemSettings = selectedMode === GameMode.Thief;
    const showAlkkagiSettings = selectedMode === GameMode.Alkkagi;
    const showCurlingSettings = selectedMode === GameMode.Curling;
    
    const settingRowStyle = {
      marginBottom: `${Math.max(6, Math.round(8 * scaleFactor))}px`,
    };
    const labelStyle = {
      fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
      lineHeight: 1.35,
    };
    const inputStyle = {
      fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
      lineHeight: 1.35,
      padding: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
    };
    /** `<select>`에는 좌우대칭 패딩만 쓰면 네이티브 화살표와 글자가 겹침 — 클래스에서 오른쪽 여유 확보 */
    const selectFontStyle = {
      fontSize: inputStyle.fontSize,
      lineHeight: inputStyle.lineHeight,
    };
    const settingsLabelClass =
      'font-semibold text-gray-200 flex-shrink-0 text-[15px] sm:text-[16px] leading-snug antialiased subpixel-antialiased [text-rendering:optimizeLegibility]';
    const settingsControlBaseClass =
      'w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 py-2.5 text-[15px] sm:text-[16px] leading-snug antialiased subpixel-antialiased [text-rendering:optimizeLegibility]';
    const settingsSelectFullClass = `${settingsControlBaseClass} pl-3 pr-9`;
    const settingsNumberInputFullClass = `${settingsControlBaseClass} px-3`;

    const boardSizeOptions =
      selectedMode === GameMode.Mix
        ? getMixBoardSizeOptions(mix)
        : selectedMode != null
          ? getStrategicBoardSizesByMode(selectedMode)
          : BOARD_SIZES;

    return (
      <div
        className="flex min-h-0 min-w-0 flex-col"
        style={{
          gap: `${Math.max(10, Math.round(12 * scaleFactor))}px`,
          paddingRight: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
        }}
      >
        {showMixModeSelection && (
            <SettingsSection title={t('challengeModal.mixRulesTitle')} scaleFactor={scaleFactor}>
              <p className="mb-2 text-gray-500" style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor))}px`, lineHeight: 1.35 }}>
                클래식 바둑은 기본 포함입니다. 함께 쓸 규칙을 고릅니다. 따내기와 캐슬은 동시에 선택할 수 없습니다.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SPECIAL_GAME_MODES.filter((m) => m.mode !== GameMode.Standard && m.mode !== GameMode.Mix).map((m) => {
                  const mixDisabled = isMixSubModeCheckboxDisabled(mix, m.mode);
                  return (
                    <label
                      key={m.mode}
                      className={`flex items-center gap-2 rounded-md bg-gray-700/50 p-2 ${mixDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={mix.includes(m.mode)}
                        onChange={(e) => handleMixedModeChange(m.mode, e.target.checked)}
                        disabled={mixDisabled}
                        title={mixDisabled ? t('challengeModal.mixCaptureCastleConflict') : undefined}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="leading-tight text-gray-200" style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor))}px` }}>
                        {mixSubRuleDisplayName(m.name)}
                      </span>
                    </label>
                  );
                })}
              </div>
              {mix.length < 2 && (
                <p className="mt-2 text-red-400/95" style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor))}px` }}>
                  규칙을 2개 이상 선택해 주세요.
                </p>
              )}
            </SettingsSection>
        )}

        <SettingsSection title={t('challengeModal.boardKomiCapture')} scaleFactor={scaleFactor}>
        {showBoardSize && (
          <div 
            className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3"
            style={settingRowStyle}
          >
            <label className={settingsLabelClass} style={labelStyle}>
              바둑판
            </label>
            <select 
              value={settings.boardSize} 
              onChange={e => handleSettingChange('boardSize', parseInt(e.target.value, 10) as GameSettings['boardSize'])}
              className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
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
          <div 
            className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3"
            style={settingRowStyle}
          >
            <label className={settingsLabelClass} style={labelStyle}>
              덤 (백)
            </label>
            <div className="flex min-w-0 items-center" style={{ gap: `${Math.max(4, Math.round(6 * scaleFactor))}px` }}>
              <input 
                type="number" 
                step="1" 
                min={0}
                max={MAX_GAME_INTEGER_INPUT}
                value={Math.floor(settings.komi)} 
                onChange={(e) =>
                  handleSettingChange(
                    'komi',
                    clampGameInt(parseInt(e.target.value, 10) || 0, { min: 0, max: MAX_GAME_INTEGER_INPUT }) + 0.5,
                  )
                }
                className={`${settingsNumberInputFullClass} min-h-[2.75rem]`}
                style={inputStyle}
              />
              <span className="font-bold text-gray-200 whitespace-nowrap antialiased subpixel-antialiased" style={labelStyle}>
                {t('challengeModal.komiHalf')}
              </span>
            </div>
          </div>
        )}

        {showCaptureTarget && (
          <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
            <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.captureTarget')}</label>
            <select 
              value={settings.captureTarget} 
              onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
              className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
            >
              {CAPTURE_TARGETS.map((target) => <option key={target} value={target}>{t('challengeModal.capturePoints', { count: target })}</option>)}
            </select>
          </div>
        )}

        {showTtamokCaptureTarget && (
          <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
            <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.captureTarget')}</label>
            <select 
              value={settings.captureTarget ?? 20} 
              onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
              className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
            >
              {TTAMOK_CAPTURE_TARGETS.map((target) => <option key={target} value={target}>{t('challengeModal.captureCount', { count: target })}</option>)}
            </select>
          </div>
        )}
        </SettingsSection>

        {showTimeControls && (
          <SettingsSection title={showSpeedTimeControls ? t('challengeModal.speedTimeRules') : t('challengeModal.timeByoyomi')} scaleFactor={scaleFactor}>
            <StrategicTimeControlFields
              settings={settings}
              onSettingsChange={setSettings}
              isSpeed={showSpeedTimeControls}
              variant="grid"
              labelClassName={settingsLabelClass}
              selectClassName={`${settingsSelectFullClass} min-h-[2.75rem]`}
            />
          </SettingsSection>
        )}

        {showBaseStones && (
          <SettingsSection title={t('challengeModal.baseGo')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.baseStones')}</label>
              <select 
                value={settings.baseStones} 
                onChange={e => handleSettingChange('baseStones', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                  style={selectFontStyle}
              >
                {BASE_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
          </SettingsSection>
        )}

        {showCastleCount && (
          <SettingsSection title={selectedMode === GameMode.Castle ? t('challengeModal.castleGo') : t('challengeModal.castleShort')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.castleShort')}</label>
              <select
                value={settings.castleCount ?? getDefaultCastleCountByBoardSize(settings.boardSize ?? 13)}
                onChange={e => handleSettingChange('castleCount', parseInt(e.target.value, 10) as GameSettings['castleCount'])}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {getCastleCountsByBoardSize(settings.boardSize ?? 13).map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.timeLimit')}</label>
              <select
                value={settings.timeLimit}
                onChange={(e) => handleSettingChange('timeLimit', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {TIME_LIMITS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.byoyomi')}</label>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <select
                  value={settings.byoyomiTime}
                  onChange={(e) => handleSettingChange('byoyomiTime', parseInt(e.target.value, 10))}
                  className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                  style={selectFontStyle}
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
                  className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                  style={selectFontStyle}
                >
                  {BYOYOMI_COUNTS.map((c) => (
                    <option key={c} value={c}>
                      {c}회
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsSection>
        )}

        {showHiddenStones && (
          <SettingsSection title={t('challengeModal.hiddenGo')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.hiddenItems')}</label>
              <select 
                value={settings.hiddenStoneCount} 
                onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {HIDDEN_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
          </SettingsSection>
        )}

        {showHiddenStones && (
          <SettingsSection title={t('challengeModal.scan')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.scanItems')}</label>
              <select 
                value={settings.scanCount || 5} 
                onChange={e => handleSettingChange('scanCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {SCAN_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
          </SettingsSection>
        )}

        {showMissileCount && (
          <SettingsSection title={t('challengeModal.missileGo')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.missileCount')}</label>
              <select 
                value={settings.missileCount} 
                onChange={e => handleSettingChange('missileCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                  style={selectFontStyle}
              >
                {MISSILE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
          </SettingsSection>
        )}

        {showDiceGoSettings && (
          <SettingsSection title={t('challengeModal.diceGo')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.round')}</label>
              <select 
                value={settings.diceGoRounds ?? 3} 
                onChange={e => handleSettingChange('diceGoRounds', parseInt(e.target.value, 10) as 1 | 2 | 3)}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {[1, 2, 3].map((r) => <option key={r} value={r}>{t('challengeModal.roundCount', { count: r })}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.oddDice')}</label>
              <select
                value={settings.oddDiceCount ?? 1}
                onChange={(e) => handleSettingChange('oddDiceCount', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {DICE_GO_ITEM_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}개
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.evenDice')}</label>
              <select
                value={settings.evenDiceCount ?? 1}
                onChange={(e) => handleSettingChange('evenDiceCount', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {DICE_GO_ITEM_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}개
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.highDice')}</label>
              <select
                value={settings.highDiceCount ?? 1}
                onChange={(e) => handleSettingChange('highDiceCount', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {DICE_GO_ITEM_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}개
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.lowDice')}</label>
              <select
                value={settings.lowDiceCount ?? 1}
                onChange={(e) => handleSettingChange('lowDiceCount', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {DICE_GO_ITEM_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}개
                  </option>
                ))}
              </select>
            </div>
          </SettingsSection>
        )}

        {showThiefGoItemSettings && (
          <SettingsSection title={t('challengeModal.thiefGo')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.highDice')}</label>
              <select
                value={settings.thiefHigh36ItemCount ?? 1}
                onChange={(e) => handleSettingChange('thiefHigh36ItemCount', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {DICE_GO_ITEM_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}개
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.blockDice')}</label>
              <select
                value={settings.thiefNoOneItemCount ?? 1}
                onChange={(e) => handleSettingChange('thiefNoOneItemCount', parseInt(e.target.value, 10))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {DICE_GO_ITEM_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}개
                  </option>
                ))}
              </select>
            </div>
          </SettingsSection>
        )}

        {showOmokRules && (
          <SettingsSection title={t('challengeModal.omokTtamok')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.forbid33')}</label>
              <input 
                type="checkbox" 
                checked={settings.has33Forbidden ?? true} 
                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                className="h-6 w-6 shrink-0 rounded border-2 border-gray-500 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.forbidOverline')}</label>
              <input 
                type="checkbox" 
                checked={settings.hasOverlineForbidden ?? true} 
                onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} 
                className="h-6 w-6 shrink-0 rounded border-2 border-gray-500 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </SettingsSection>
        )}

        {showAlkkagiSettings && (
          <SettingsSection title={t('challengeModal.alkkagi')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.stoneCount')}</label>
              <select 
                value={settings.alkkagiStoneCount ?? 5} 
                onChange={e => handleSettingChange('alkkagiStoneCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {ALKKAGI_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.round')}</label>
              <select 
                value={settings.alkkagiRounds ?? 1} 
                onChange={e => handleSettingChange('alkkagiRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {ALKKAGI_ROUNDS.map((r) => <option key={r} value={r}>{t('challengeModal.roundCount', { count: r })}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.placementType')}</label>
              <select 
                value={settings.alkkagiPlacementType ?? AlkkagiPlacementType.TurnByTurn} 
                onChange={e => handleSettingChange('alkkagiPlacementType', e.target.value as AlkkagiPlacementType)}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {Object.values(AlkkagiPlacementType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.placementField')}</label>
              <select 
                value={settings.alkkagiLayout ?? AlkkagiLayoutType.Normal} 
                onChange={e => handleSettingChange('alkkagiLayout', e.target.value as AlkkagiLayoutType)}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {Object.values(AlkkagiLayoutType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.gaugeSpeed')}</label>
              <select 
                value={settings.alkkagiGaugeSpeed ?? 700} 
                onChange={e => handleSettingChange('alkkagiGaugeSpeed', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {ALKKAGI_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.slow')}</label>
              <select 
                value={settings.alkkagiSlowItemCount ?? 2} 
                onChange={e => handleSettingChange('alkkagiSlowItemCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.aimingLine')}</label>
              <select 
                value={settings.alkkagiAimingLineItemCount ?? 2} 
                onChange={e => handleSettingChange('alkkagiAimingLineItemCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
          </SettingsSection>
        )}

        {showCurlingSettings && (
          <SettingsSection title={t('challengeModal.curling')} scaleFactor={scaleFactor}>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.stoneCount')}</label>
              <select 
                value={settings.curlingStoneCount ?? 5} 
                onChange={e => handleSettingChange('curlingStoneCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {CURLING_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.round')}</label>
              <select 
                value={settings.curlingRounds ?? 3} 
                onChange={e => handleSettingChange('curlingRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {CURLING_ROUNDS.map((r) => <option key={r} value={r}>{t('challengeModal.roundCount', { count: r })}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.gaugeSpeed')}</label>
              <select 
                value={settings.curlingGaugeSpeed ?? 700} 
                onChange={e => handleSettingChange('curlingGaugeSpeed', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {CURLING_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.slow')}</label>
              <select 
                value={settings.curlingSlowItemCount ?? 2} 
                onChange={e => handleSettingChange('curlingSlowItemCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3" style={settingRowStyle}>
              <label className={settingsLabelClass} style={labelStyle}>{t('challengeModal.aimingLine')}</label>
              <select 
                value={settings.curlingAimingLineItemCount ?? 2} 
                onChange={e => handleSettingChange('curlingAimingLineItemCount', parseInt(e.target.value))}
                className={`${settingsSelectFullClass} min-h-[2.75rem]`}
                style={selectFontStyle}
              >
                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
              </select>
            </div>
          </SettingsSection>
        )}
      </div>
    );
  };

  return (
    <DraggableWindow
      title={t('challengeModal.title')}
      windowId="challenge-selection"
      onClose={handleAttemptClose}
      initialWidth={calculatedWidth}
      initialHeight={calculatedHeight}
      closeOnOutsideClick={false}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="h-full flex flex-col overflow-hidden antialiased subpixel-antialiased [text-rendering:optimizeLegibility]"
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ gap: `${Math.max(8, Math.round(12 * scaleFactor))}px` }}
        >
          {/* 상대 프로필 — 모달 본문 전체 가로 폭 */}
          <div
            className="sudamr-modal-inner-well flex-shrink-0 rounded-xl border border-white/[0.09] bg-gradient-to-r from-slate-950/90 via-slate-900/85 to-slate-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{
              padding: `${Math.max(10, Math.round(14 * scaleFactor))}px ${Math.max(12, Math.round(16 * scaleFactor))}px`,
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div
                className="flex min-w-0 flex-1 items-center"
                style={{ gap: `${Math.max(10, Math.round(14 * scaleFactor))}px` }}
              >
                <Avatar
                  userId={displayOpponent.id}
                  userName={displayOpponent.nickname}
                  avatarUrl={opponentAvatarUrl}
                  borderUrl={opponentBorderUrl}
                  size={Math.max(44, Math.round(52 * scaleFactor))}
                />
                <div className="min-w-0 flex-1">
                  <h3
                    className="truncate font-bold tracking-tight text-gray-50"
                    style={{ fontSize: `${Math.max(17, Math.round(20 * scaleFactor))}px`, lineHeight: 1.2 }}
                  >
                    {displayOpponent.nickname}
                  </h3>
                  <p
                    className="text-gray-400"
                    style={{ fontSize: `${Math.max(13, Math.round(15 * scaleFactor))}px`, lineHeight: 1.35 }}
                  >
                    {lobbyType === 'strategic' ? t('challengeModal.strategicShort') : t('challengeModal.playfulShort')} Lv.{opponentLevel}
                  </p>
                </div>
              </div>
              {selectedMode && selectedGameStats && (
                <div
                  className="flex flex-wrap items-end gap-x-8 gap-y-2 border-t border-white/10 pt-3 sm:border-t-0 sm:border-l sm:border-white/10 sm:pl-8 sm:pt-0"
                >
                  <div className="min-w-[5.5rem]">
                    <p
                      className="font-medium uppercase tracking-wider text-gray-500"
                      style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor))}px`, lineHeight: 1.2 }}
                    >
                      모드 전적
                    </p>
                    <p
                      className="font-semibold text-gray-200"
                      style={{ fontSize: `${Math.max(14, Math.round(15 * scaleFactor))}px`, lineHeight: 1.3 }}
                    >
                      {selectedMode}
                    </p>
                  </div>
                  <div className="min-w-[6rem]">
                    <p
                      className="text-gray-500"
                      style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor))}px`, lineHeight: 1.2 }}
                    >
                      승패
                    </p>
                    <p
                      className="font-bold tabular-nums text-gray-100"
                      style={{ fontSize: `${Math.max(14, Math.round(15 * scaleFactor))}px`, lineHeight: 1.3 }}
                    >
                      {(selectedGameStats.wins ?? 0)}승 {(selectedGameStats.losses ?? 0)}패
                      <span className="ml-1 font-semibold text-gray-400">
                        (
                        {(selectedGameStats.wins ?? 0) + (selectedGameStats.losses ?? 0) > 0
                          ? Math.round(
                              ((selectedGameStats.wins ?? 0) /
                                ((selectedGameStats.wins ?? 0) + (selectedGameStats.losses ?? 0))) *
                                100,
                            )
                          : 0}
                        %)
                      </span>
                    </p>
                  </div>
                  <div className="min-w-[5rem]">
                    <p
                      className="text-gray-500"
                      style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor))}px`, lineHeight: 1.2 }}
                    >
                      랭킹
                    </p>
                    <p
                      className="font-mono font-semibold tabular-nums text-amber-300/95"
                      style={{ fontSize: `${Math.max(14, Math.round(15 * scaleFactor))}px`, lineHeight: 1.3 }}
                    >
                      {selectedGameStats.rankingScore}점
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="flex min-h-0 flex-1 flex-row overflow-hidden"
            style={{ gap: `${Math.max(6, Math.round(10 * scaleFactor))}px` }}
          >
          {/* 좌측 패널: 게임 모드 선택 또는 게임 정보 */}
          <div 
            className="min-w-0 flex-[0_0_42%] sudamr-modal-inner-well flex flex-col overflow-hidden rounded-xl border border-white/[0.07]"
            style={{
              padding: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
              paddingRight: `${Math.max(10, Math.round(14 * scaleFactor))}px`,
            }}
          >
            <p
              className="flex-shrink-0 text-center font-semibold text-yellow-200"
              style={{
                marginBottom: `${Math.max(6, Math.round(10 * scaleFactor))}px`,
                fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
                lineHeight: 1.4,
              }}
            >
              {isWaitingForResponse 
                ? t('challengeModal.waitingResponse', { name: displayOpponent.nickname }) 
                : t('challengeModal.applyingTo', { name: displayOpponent.nickname })}
            </p>
            
            {isWaitingForResponse && negotiationDeadline && (
              <div className="flex-shrink-0" style={{ marginBottom: `${Math.max(8, Math.round(10 * scaleFactor))}px` }}>
                <div 
                  className="bg-gray-800/50 rounded-lg border border-gray-700"
                  style={{ padding: `${Math.max(8, Math.round(10 * scaleFactor))}px` }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: `${Math.max(6, Math.round(6 * scaleFactor))}px` }}>
                    <span className="text-gray-300" style={{ fontSize: `${Math.max(13, Math.round(15 * scaleFactor))}px`, lineHeight: 1.35 }}>
                      응답 남은 시간
                    </span>
                    <span
                      className={`font-bold tabular-nums ${timeRemaining <= 5 ? 'text-red-400' : timeRemaining <= 10 ? 'text-yellow-400' : 'text-green-400'}`}
                      style={{ fontSize: `${Math.max(15, Math.round(18 * scaleFactor))}px`, lineHeight: 1.2 }}
                    >
                      {timeRemaining}초
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full overflow-hidden" style={{ height: `${Math.max(8, Math.round(12 * scaleFactor))}px` }}>
                    <div 
                      className={`h-full transition-all duration-100 ${timeRemaining <= 5 ? 'bg-red-500' : timeRemaining <= 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div
              className="grid min-h-0 flex-1 grid-cols-2 items-start overflow-y-auto"
              style={{
                gap: `${Math.max(6, Math.round(12 * scaleFactor))}px`,
                paddingRight: `${Math.max(4, Math.round(8 * scaleFactor))}px`,
              }}
            >
              {availableGames.map((game) => {
                const isRejected = displayOpponent.rejectedGameModes?.includes(game.mode) || false;
                const comingSoon = !isPlayableLobbyGameMode(game);
                return (
                  <GameCard
                    key={game.mode}
                    mode={game.mode}
                    image={game.image}
                    onSelect={handleGameSelect}
                    isSelected={selectedMode === game.mode}
                    isRejected={isRejected}
                    comingSoon={comingSoon}
                    scaleFactor={scaleFactor}
                    interactionLocked={isWaitingForResponse}
                  />
                );
              })}
            </div>
          </div>

          {/* 우측: 대국 설정 + 하단 버튼 */}
          <div
            className="sudamr-modal-inner-well min-w-0 flex-1 flex flex-col overflow-hidden rounded-xl border border-white/[0.07]"
            style={{ padding: `${Math.max(8, Math.round(10 * scaleFactor))}px` }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <h4
                className="flex-shrink-0 font-bold tracking-tight text-gray-100"
                style={{
                  marginBottom: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
                  fontSize: `${Math.max(16, Math.round(17 * scaleFactor))}px`,
                  lineHeight: 1.3,
                }}
              >
                <span className="bg-gradient-to-r from-amber-200/90 to-amber-400/80 bg-clip-text text-transparent">
                  대국 설정
                </span>
              </h4>
              <div
                className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain text-gray-100"
                style={{
                  paddingRight: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
                }}
              >
                {renderGameSettings()}
              </div>
            </div>

            <div
              className={
                isHandheldLobbyUi
                  ? `flex flex-shrink-0 flex-col gap-2.5 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS} rounded-b-xl`
                  : 'flex flex-shrink-0 flex-wrap justify-end border-t border-amber-500/25 bg-gradient-to-t from-black/25 via-transparent to-transparent'
              }
              style={
                isHandheldLobbyUi
                  ? {
                      marginTop: `${Math.max(6, Math.round(8 * scaleFactor))}px`,
                      paddingTop: `${Math.max(10, Math.round(12 * scaleFactor))}px`,
                    }
                  : {
                      marginTop: `${Math.max(6, Math.round(8 * scaleFactor))}px`,
                      paddingTop: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
                      gap: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
                    }
              }
            >
              {isWaitingForResponse ? (
                <>
                  <Button
                    onClick={withdrawNegotiationAndClose}
                    bare={isHandheldLobbyUi}
                    colorScheme="none"
                    className={
                      isHandheldLobbyUi
                        ? LOBBY_MOBILE_BTN_DANGER_CLASS
                        : `${PRE_GAME_MODAL_DANGER_BTN_CLASS} !min-h-[2.75rem] !px-5 !font-semibold !tracking-wide`
                    }
                    style={
                      isHandheldLobbyUi
                        ? undefined
                        : {
                            fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
                            lineHeight: 1.3,
                          }
                    }
                  >
                    신청 취소
                  </Button>
                  <Button
                    disabled
                    bare={isHandheldLobbyUi}
                    colorScheme="none"
                    className={
                      isHandheldLobbyUi
                        ? LOBBY_MOBILE_BTN_DISABLED_WAIT_CLASS
                        : `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !min-h-[2.75rem] !cursor-not-allowed !px-5 !opacity-50 !font-semibold !tracking-wide`
                    }
                    style={
                      isHandheldLobbyUi
                        ? undefined
                        : {
                            fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
                            lineHeight: 1.3,
                          }
                    }
                  >
                    신청 중
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleAttemptClose}
                    bare={isHandheldLobbyUi}
                    colorScheme="none"
                    className={
                      isHandheldLobbyUi
                        ? LOBBY_MOBILE_BTN_SECONDARY_CLASS
                        : `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !min-h-[2.75rem] !px-5 !font-semibold !tracking-wide`
                    }
                    style={
                      isHandheldLobbyUi
                        ? undefined
                        : {
                            fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
                            lineHeight: 1.3,
                          }
                    }
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleChallenge}
                    disabled={
                      !selectedMode ||
                      (selectedMode === GameMode.Mix &&
                        (!settings.mixedModes || settings.mixedModes.length < 2))
                    }
                    bare={isHandheldLobbyUi}
                    colorScheme="none"
                    className={
                      isHandheldLobbyUi
                        ? `${LOBBY_MOBILE_BTN_PRIMARY_CLASS} ${
                            !selectedMode ||
                            (selectedMode === GameMode.Mix &&
                              (!settings.mixedModes || settings.mixedModes.length < 2))
                              ? '!cursor-not-allowed !opacity-45 !hover:brightness-100'
                              : ''
                          }`
                        : `${PRE_GAME_MODAL_PRIMARY_BTN_CLASS} !min-h-[2.75rem] !px-5 !font-semibold !tracking-wide ${
                            !selectedMode ||
                            (selectedMode === GameMode.Mix &&
                              (!settings.mixedModes || settings.mixedModes.length < 2))
                              ? '!cursor-not-allowed !opacity-45'
                              : ''
                          }`
                    }
                    style={
                      isHandheldLobbyUi
                        ? undefined
                        : {
                            fontSize: `${Math.max(14, Math.round(16 * scaleFactor))}px`,
                            lineHeight: 1.3,
                          }
                    }
                  >
                    대국 신청 (⚡{actionPointCostDisplay})
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default ChallengeSelectionModal;
