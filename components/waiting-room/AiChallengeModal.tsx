import React, { useState, useMemo, useEffect, useRef } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import {
    LOBBY_MOBILE_BTN_PRIMARY_CLASS,
    LOBBY_MOBILE_BTN_SECONDARY_CLASS,
    LOBBY_MOBILE_HEADER_BACK_BTN_CLASS,
    LOBBY_MOBILE_MODAL_FOOTER_CLASS,
} from '../game/PreGameDescriptionLayout.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../../constants/ads.js';
import { GameMode, ServerAction, GameSettings, Player, AlkkagiPlacementType } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DEFAULT_GAME_SETTINGS, STRATEGIC_ACTION_POINT_COST, PLAYFUL_ACTION_POINT_COST, aiUserId } from '../../constants';
import { 
  BOARD_SIZES, TIME_LIMITS, BYOYOMI_COUNTS, BYOYOMI_TIMES, CAPTURE_BOARD_SIZES, 
  CAPTURE_TARGETS, TTAMOK_CAPTURE_TARGETS, SPEED_BOARD_SIZES, SPEED_TIME_LIMITS, BASE_STONE_COUNTS,
  HIDDEN_STONE_COUNTS, SCAN_COUNTS, MISSILE_BOARD_SIZES, MISSILE_COUNTS,
  ALKKAGI_STONE_COUNTS, ALKKAGI_ROUNDS, ALKKAGI_GAUGE_SPEEDS, ALKKAGI_ITEM_COUNTS,
  CURLING_STONE_COUNTS, CURLING_ROUNDS, CURLING_GAUGE_SPEEDS, CURLING_ITEM_COUNTS,
  OMOK_BOARD_SIZES, HIDDEN_BOARD_SIZES, DICE_GO_ITEM_COUNTS, getStrategicBoardSizesByMode, getScoringTurnLimitOptionsByBoardSize
} from '../../constants/gameSettings.js';
import Avatar from '../Avatar.js';
import { shouldUseClientSideAi } from '../../services/wasmGnuGo.js';
import { profileStepFromKataServerLevel } from '../../shared/utils/strategicAiDifficulty.js';

interface AiChallengeModalProps {
    lobbyType: 'strategic' | 'playful';
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

const GameCard: React.FC<{
    mode: GameMode;
    image: string;
    displayName: string;
    onSelect: (mode: GameMode) => void;
    isSelected: boolean;
    compact?: boolean;
}> = ({ mode, image, displayName, onSelect, isSelected, compact }) => {
    const [imgError, setImgError] = useState(false);
    const imgH = compact ? 68 : 100;
    const pad = compact ? 6 : 8;
    const titlePx = compact ? 12 : 14;

    return (
        <div
            className={`bg-panel text-on-panel rounded-lg flex flex-col items-center text-center transition-all transform touch-manipulation ${
                isSelected
                    ? compact
                        ? 'cursor-pointer ring-2 ring-violet-400/85 ring-offset-2 ring-offset-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(167,139,250,0.35),0_10px_28px_-8px_rgba(139,92,246,0.45)] active:scale-[0.98]'
                        : 'ring-2 ring-purple-500 shadow-lg cursor-pointer active:scale-[0.98]'
                    : 'shadow-lg cursor-pointer active:scale-[0.98] hover:ring-1 hover:ring-purple-400/40'
            }`}
            style={{ padding: `${pad}px`, gap: compact ? '3px' : '4px' }}
            onClick={() => onSelect(mode)}
        >
            <div
                className="w-full flex-shrink-0 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner relative"
                style={{ height: `${imgH}px`, marginBottom: compact ? '2px' : '4px', padding: '4px' }}
            >
                {!imgError ? (
                    <img
                        src={image}
                        alt={displayName}
                        className="w-full h-full object-contain"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span style={{ fontSize: compact ? '11px' : '13px' }}>{displayName}</span>
                )}
            </div>
            <div className="flex-grow flex flex-col w-full min-w-0">
                <h3 className="font-bold leading-tight text-primary truncate px-0.5" style={{ fontSize: `${titlePx}px`, marginBottom: '2px' }}>
                    {displayName}
                </h3>
            </div>
        </div>
    );
};

const AiChallengeModal: React.FC<AiChallengeModalProps> = ({ lobbyType, onClose, onAction }) => {
    const availableGameModes = lobbyType === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(availableGameModes[0]?.mode || null);
    const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
    const prevSelectedGameModeRef = useRef<GameMode | null>(null);
    const [mobileStep, setMobileStep] = useState<'pickMode' | 'settings'>('pickMode');

    const actionPointCost = useMemo(() => {
        if (!selectedGameMode) return STRATEGIC_ACTION_POINT_COST;
        if (SPECIAL_GAME_MODES.some(m => m.mode === selectedGameMode)) return STRATEGIC_ACTION_POINT_COST;
        if (PLAYFUL_GAME_MODES.some(m => m.mode === selectedGameMode)) return PLAYFUL_ACTION_POINT_COST;
        return STRATEGIC_ACTION_POINT_COST;
    }, [selectedGameMode]);

    const { isNativeMobile } = useNativeMobileShell();
    const isCompactViewport = useIsHandheldDevice(1024);
    const isMobile = isNativeMobile || isCompactViewport;
    /** PC: 캔버스(scale) 내 고정 프레임. 모바일: 뷰포트 맞춤으로 별도 레이아웃 */
    const calculatedWidth = isMobile ? 720 : 900;
    const calculatedHeight = isMobile ? 720 : 780;
    const mobileTextScale = 1.0;

    const selectedGameDefinition = useMemo(() => {
        return availableGameModes.find(mode => mode.mode === selectedGameMode);
    }, [availableGameModes, selectedGameMode]);

    // 게임 모드 변경 시 설정 초기화
    useEffect(() => {
        if (selectedGameMode) {
            const savedSettings = localStorage.getItem(`preferredGameSettings_${selectedGameMode}`);
            if (savedSettings) {
                try {
                    const parsed = JSON.parse(savedSettings);
                    // 알까기: 예전 단일 아이템 개수(alkkagiItemCount)를 슬로우/조준선 각각으로 이전
                    if (selectedGameMode === GameMode.Alkkagi && parsed.alkkagiItemCount != null && parsed.alkkagiSlowItemCount == null && parsed.alkkagiAimingLineItemCount == null) {
                        parsed.alkkagiSlowItemCount = parsed.alkkagiItemCount;
                        parsed.alkkagiAimingLineItemCount = parsed.alkkagiItemCount;
                    }
                    if (parsed.mixedModes && parsed.mixedModes.includes(GameMode.Base) && parsed.mixedModes.includes(GameMode.Capture)) {
                        parsed.mixedModes = parsed.mixedModes.filter((m: GameMode) => m !== GameMode.Base);
                    }
                    if (selectedGameMode === GameMode.Capture) {
                        parsed.scoringTurnLimit = 0;
                        delete (parsed as any).autoScoringTurns;
                    }
                    setSettings({ ...DEFAULT_GAME_SETTINGS, ...parsed });
                } catch {
                    setSettings({ ...DEFAULT_GAME_SETTINGS });
                }
            } else {
                setSettings({ ...DEFAULT_GAME_SETTINGS });
            }
        }
    }, [selectedGameMode]);

    useEffect(() => {
        if (!selectedGameMode) return;
        const boardSizeOptions = getStrategicBoardSizesByMode(selectedGameMode);
        if (!boardSizeOptions.includes(settings.boardSize)) {
            handleSettingChange('boardSize', boardSizeOptions[0] as GameSettings['boardSize']);
        }
    }, [selectedGameMode, settings.boardSize]);

    useEffect(() => {
        if (selectedGameMode === GameMode.Capture) return;
        const scoringTurnLimitOptions = getScoringTurnLimitOptionsByBoardSize(settings.boardSize);
        const nonZeroOptions = scoringTurnLimitOptions.filter(l => l > 0);
        const currentLimit = settings.scoringTurnLimit ?? 0;
        if (!nonZeroOptions.includes(currentLimit)) {
            // "제한없음(0)" 옵션 제거 정책: 항상 0보다 큰 값만 허용
            handleSettingChange('scoringTurnLimit', nonZeroOptions[0] ?? 1);
        }
    }, [selectedGameMode, settings.boardSize, settings.scoringTurnLimit]);

    const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            if (newSettings.mixedModes) {
                const isBaseSelected = newSettings.mixedModes.includes(GameMode.Base);
                const isCaptureSelected = newSettings.mixedModes.includes(GameMode.Capture);
                if (isBaseSelected && isCaptureSelected) {
                    newSettings.mixedModes = newSettings.mixedModes.filter(m => m !== GameMode.Base);
                }
            }
            if (selectedGameMode) {
                localStorage.setItem(`preferredGameSettings_${selectedGameMode}`, JSON.stringify(newSettings));
            }
            return newSettings;
        });
    };

    const handleMixedModeChange = (subMode: GameMode, checked: boolean) => {
        setSettings(prev => {
            let nextMixed = checked
                ? [...(prev.mixedModes || []), subMode]
                : (prev.mixedModes || []).filter(m => m !== subMode);
            if (nextMixed.includes(GameMode.Base) && nextMixed.includes(GameMode.Capture)) {
                nextMixed = nextMixed.filter(m => m !== GameMode.Base);
            }
            const newSettings = { ...prev, mixedModes: nextMixed };
            if (selectedGameMode) {
                localStorage.setItem(`preferredGameSettings_${selectedGameMode}`, JSON.stringify(newSettings));
            }
            return newSettings;
        });
    };

    // 믹스로 전환 시 mixedModes가 비어 있으면 PVP 기본과 같이 유효한 조합을 채움 (신청 화면에서 규칙 선택이 보이도록)
    useEffect(() => {
        if (selectedGameMode !== GameMode.Mix) {
            prevSelectedGameModeRef.current = selectedGameMode;
            return;
        }
        const justEnteredMix = prevSelectedGameModeRef.current !== GameMode.Mix;
        prevSelectedGameModeRef.current = selectedGameMode;
        if (!justEnteredMix) return;

        setSettings(prev => {
            if (prev.mixedModes && prev.mixedModes.length >= 2) return prev;
            const defaults = DEFAULT_GAME_SETTINGS.mixedModes?.filter(Boolean) ?? [];
            const nextMixed =
                prev.mixedModes && prev.mixedModes.length === 1
                    ? [...prev.mixedModes, defaults.find(m => !prev.mixedModes!.includes(m)) ?? GameMode.Hidden]
                    : (defaults.length >= 2 ? defaults : [GameMode.Hidden, GameMode.Speed]);
            const next = { ...prev, mixedModes: nextMixed };
            localStorage.setItem(`preferredGameSettings_${GameMode.Mix}`, JSON.stringify(next));
            return next;
        });
    }, [selectedGameMode]);

    const handleChallenge = () => {
        if (selectedGameMode) {
            if (selectedGameMode === GameMode.Mix && (!settings.mixedModes || settings.mixedModes.length < 2)) {
                window.alert('믹스룰은 규칙을 2개 이상 선택해야 합니다.');
                return;
            }
            // Gnugo 대체 엔진(lightGoAi)을 브라우저에서 실행해 서버 부하를 줄임.
            // 바둑(착수) 모드만 클라이언트 AI 사용. 놀이바둑은 서버만 사용.
            const goModes: GameMode[] = [
                GameMode.Standard,
                GameMode.Capture,
                GameMode.Speed,
                GameMode.Base,
                GameMode.Hidden,
                GameMode.Missile,
                GameMode.Mix,
            ];
            const isGoMode = goModes.includes(selectedGameMode);
            // 전략바둑 대기실에서 시작하는 AI 대국은 항상 서버 AI를 사용한다.
            // 클라이언트 측 AI(lightGoAi)는 놀이바둑 등 다른 컨텐츠에서만 사용.
            const useClientSideAi = lobbyType === 'strategic'
                ? false
                : (isGoMode && shouldUseClientSideAi());

            // AI 대국은 모두 시간 무제한으로 고정:
            // - timeLimit: 0, byoyomiTime: 0, byoyomiCount: 0, timeIncrement: 0
            const timeUnlimitedSettings: Partial<GameSettings> = {
                timeLimit: 0,
                byoyomiTime: 0,
                byoyomiCount: 0,
                timeIncrement: 0,
            };

            const defaultKataWhenUnset = -12;
            const kataResolved =
                typeof settings.kataServerLevel === 'number' && Number.isFinite(settings.kataServerLevel)
                    ? settings.kataServerLevel
                    : defaultKataWhenUnset;
            const aiProfileStep =
                profileStepFromKataServerLevel(kataResolved) ??
                (lobbyType === 'strategic' ? 5 : (settings.goAiBotLevel ?? settings.aiDifficulty ?? 5));

            const mergedSettings: GameSettings = {
                ...settings,
                ...timeUnlimitedSettings,
                useClientSideAi,
                ...(lobbyType === 'strategic'
                    ? {
                          kataServerLevel: kataResolved,
                          goAiBotLevel: aiProfileStep,
                          aiDifficulty: aiProfileStep,
                      }
                    : {}),
            };
            if (selectedGameMode === GameMode.Capture) {
                mergedSettings.scoringTurnLimit = 0;
                delete (mergedSettings as any).autoScoringTurns;
            }

            onAction({ 
                type: 'START_AI_GAME', 
                payload: { 
                    mode: selectedGameMode, 
                    settings: mergedSettings,
                } 
            });
            onClose();
        }
    };

    // 게임 모드별 설정 UI 렌더링
    const renderGameSettings = () => {
        if (!selectedGameMode) {
            return (
                <div className="text-center text-gray-400 py-8">
                    좌측에서 게임 종류를 선택하세요
                </div>
            );
        }

        const showBoardSize = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(selectedGameMode);
        const showKomi = ![GameMode.Capture, GameMode.Omok, GameMode.Ttamok, GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief, GameMode.Base].includes(selectedGameMode);
        // AI 대국은 모두 시간 무제한이므로, 제한시간/초읽기 관련 UI는 항상 숨긴다.
        const showTimeControls = false;
        const showCaptureTarget = selectedGameMode === GameMode.Capture;
        const showTtamokCaptureTarget = selectedGameMode === GameMode.Ttamok;
        const showBaseStones = selectedGameMode === GameMode.Base;
        const showHiddenStones = selectedGameMode === GameMode.Hidden;
        const showMissileCount = selectedGameMode === GameMode.Missile;
        const showMixModeSelection = selectedGameMode === GameMode.Mix;
        const showDiceGoSettings = selectedGameMode === GameMode.Dice;
        const showAlkkagiSettings = selectedGameMode === GameMode.Alkkagi;
        const showCurlingSettings = selectedGameMode === GameMode.Curling;
        const showThiefSettings = selectedGameMode === GameMode.Thief;
        // 도둑과 경찰은 역할 설정으로 대체되므로 순서 설정에서 제외
        const showPlayerColor = [GameMode.Dice, GameMode.Alkkagi, GameMode.Curling].includes(selectedGameMode);
        const showOmokForbiddenRules = selectedGameMode === GameMode.Omok;
        const showTtamokForbiddenRules = selectedGameMode === GameMode.Ttamok;

        const showGoAiLevel = lobbyType === 'strategic';
        const showScoringTurnLimit = showGoAiLevel && selectedGameMode !== GameMode.Capture;

        const AI_LEVELS = [
            { value: -31, label: '1단계 (입문)' },
            { value: -25, label: '2단계 (초보)' },
            { value: -21, label: '3단계 (하급)' },
            { value: -15, label: '4단계 (초급)' },
            { value: -12, label: '5단계 (중급)' },
            { value: -8,  label: '6단계 (중상급)' },
            { value: -3,  label: '7단계 (상급)' },
            { value: -1,  label: '8단계 (고급)' },
            { value: 3,   label: '9단계 (최상급)' },
            { value: 5,   label: '10단계 (고수)' },
        ];

        const boardSizeOptions = selectedGameMode != null ? getStrategicBoardSizesByMode(selectedGameMode) : BOARD_SIZES;
        const scoringTurnLimitOptions = getScoringTurnLimitOptionsByBoardSize(settings.boardSize);
        const nonZeroScoringTurnLimitOptions = scoringTurnLimitOptions.filter(l => l > 0);

        return (
            <div className="h-full flex flex-col gap-2 overflow-y-auto pr-2">
                {showGoAiLevel && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>AI 난이도</label>
                        <select
                            value={settings.kataServerLevel ?? -12}
                            onChange={e => handleSettingChange('kataServerLevel', parseInt(e.target.value, 10))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {AI_LEVELS.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showBoardSize && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>판 크기</label>
                        <select 
                            value={settings.boardSize} 
                            onChange={e => handleSettingChange('boardSize', parseInt(e.target.value, 10) as GameSettings['boardSize'])}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {(selectedGameMode === GameMode.Omok || selectedGameMode === GameMode.Ttamok ? OMOK_BOARD_SIZES : 
                                selectedGameMode === GameMode.Thief ? [9, 13, 19] : 
                                boardSizeOptions).map(size => (
                                <option key={size} value={size}>{size}줄</option>
                            ))}
                        </select>
                    </div>
                )}

                {showScoringTurnLimit && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>계가까지 턴</label>
                        <select 
                            value={settings.scoringTurnLimit ?? nonZeroScoringTurnLimitOptions[0] ?? 1} 
                            onChange={e => handleSettingChange('scoringTurnLimit', parseInt(e.target.value, 10))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {nonZeroScoringTurnLimitOptions.map(limit => (
                                <option key={limit} value={limit}>
                                    {`${limit}수`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {showMixModeSelection && (() => {
                    const isBaseSelected = settings.mixedModes?.includes(GameMode.Base);
                    const isCaptureSelected = settings.mixedModes?.includes(GameMode.Capture);
                    return (
                        <div className="w-full border-t border-gray-700 pt-3 mt-1 space-y-3">
                            <div>
                                <h3 className="font-semibold text-gray-300 mb-1" style={{ fontSize: `${Math.max(14, Math.round(16 * mobileTextScale))}px` }}>
                                    믹스룰 조합 (2개 이상 선택)
                                </h3>
                                <p className="text-gray-500 text-xs leading-snug">
                                    PVP 신청 화면과 같이, 함께 적용할 규칙을 고릅니다. (클래식 바둑은 기본으로 포함됩니다.)
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {SPECIAL_GAME_MODES.filter(m => m.mode !== GameMode.Standard && m.mode !== GameMode.Mix).map(m => {
                                    const isDisabledByConflict =
                                        (m.mode === GameMode.Base && isCaptureSelected) ||
                                        (m.mode === GameMode.Capture && isBaseSelected);
                                    return (
                                        <label
                                            key={m.mode}
                                            className={`flex items-center gap-2 p-2 bg-gray-700/50 rounded-md text-gray-200 ${isDisabledByConflict ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={settings.mixedModes?.includes(m.mode) ?? false}
                                                onChange={e => handleMixedModeChange(m.mode, e.target.checked)}
                                                disabled={isDisabledByConflict}
                                                className="w-4 h-4 flex-shrink-0"
                                            />
                                            <span className="leading-tight">{m.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {settings.mixedModes?.includes(GameMode.Base) && (
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>베이스돌 개수</label>
                                    <select
                                        value={settings.baseStones}
                                        onChange={e => handleSettingChange('baseStones', parseInt(e.target.value, 10))}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                        style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                    >
                                        {BASE_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                                    </select>
                                </div>
                            )}
                            {settings.mixedModes?.includes(GameMode.Hidden) && (
                                <>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>히든돌 개수</label>
                                        <select
                                            value={settings.hiddenStoneCount}
                                            onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value, 10))}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                        >
                                            {HIDDEN_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>스캔 개수</label>
                                        <select
                                            value={settings.scanCount ?? 5}
                                            onChange={e => handleSettingChange('scanCount', parseInt(e.target.value, 10))}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                        >
                                            {SCAN_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                                        </select>
                                    </div>
                                </>
                            )}
                            {settings.mixedModes?.includes(GameMode.Missile) && (
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>미사일 개수</label>
                                    <select
                                        value={settings.missileCount ?? 3}
                                        onChange={e => handleSettingChange('missileCount', parseInt(e.target.value, 10))}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                        style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                    >
                                        {MISSILE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                                    </select>
                                </div>
                            )}
                            {settings.mixedModes?.includes(GameMode.Capture) && (
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>따내기 목표</label>
                                    <select
                                        value={settings.captureTarget}
                                        onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value, 10))}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                        style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                    >
                                        {CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}개</option>)}
                                    </select>
                                </div>
                            )}
                            {settings.mixedModes && settings.mixedModes.length < 2 && (
                                <p className="text-amber-300/90 text-xs">규칙을 2개 이상 선택해 주세요.</p>
                            )}
                        </div>
                    );
                })()}

                {showKomi && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>덤 (백)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                step="1" 
                                value={Math.floor(settings.komi)} 
                                onChange={e => handleSettingChange('komi', parseInt(e.target.value, 10) + 0.5)} 
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            />
                            <span className="font-bold text-gray-300 whitespace-nowrap" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>.5 집</span>
                        </div>
                    </div>
                )}

                {showTimeControls && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>제한 시간</label>
                            <select 
                                value={settings.timeLimit} 
                                onChange={e => handleSettingChange('timeLimit', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {TIME_LIMITS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>초읽기</label>
                            <div className="flex gap-2">
                                <select 
                                    value={settings.byoyomiTime} 
                                    onChange={e => handleSettingChange('byoyomiTime', parseInt(e.target.value))}
                                    className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                >
                                    {BYOYOMI_TIMES.map(t => <option key={t} value={t}>{t}초</option>)}
                                </select>
                                <select 
                                    value={settings.byoyomiCount} 
                                    onChange={e => handleSettingChange('byoyomiCount', parseInt(e.target.value))}
                                    className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                >
                                    {BYOYOMI_COUNTS.map(c => <option key={c} value={c}>{c}회</option>)}
                                </select>
                            </div>
                        </div>
                    </>
                )}

                {showCaptureTarget && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>포획 목표</label>
                        <select 
                            value={settings.captureTarget} 
                            onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                        </select>
                    </div>
                )}

                {showTtamokCaptureTarget && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>포획 목표</label>
                        <select 
                            value={settings.captureTarget || 5} 
                            onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {TTAMOK_CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                        </select>
                    </div>
                )}

                {showOmokForbiddenRules && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>삼삼 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.has33Forbidden ?? true} 
                                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>육목 이상 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.hasOverlineForbidden ?? true} 
                                onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                    </>
                )}

                {showTtamokForbiddenRules && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>삼삼 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.has33Forbidden ?? true} 
                                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>육목 이상 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.hasOverlineForbidden ?? true} 
                                onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                    </>
                )}

                {showPlayerColor && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>순서</label>
                        <select 
                            value={settings.player1Color === Player.Black ? 'black' : settings.player1Color === Player.White ? 'white' : 'random'} 
                            onChange={e => {
                                if (e.target.value === 'black') {
                                    handleSettingChange('player1Color', Player.Black);
                                } else if (e.target.value === 'white') {
                                    handleSettingChange('player1Color', Player.White);
                                } else {
                                    handleSettingChange('player1Color', undefined);
                                }
                            }}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            <option value="random">랜덤</option>
                            <option value="black">{selectedGameMode === GameMode.Dice ? '선공' : '선공 (흑)'}</option>
                            <option value="white">{selectedGameMode === GameMode.Dice ? '후공' : '후공 (백)'}</option>
                        </select>
                    </div>
                )}

                {showThiefSettings && (
                    <>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>역할</label>
                        <select 
                            value={settings.player1Color === Player.Black ? 'thief' : settings.player1Color === Player.White ? 'police' : 'random'} 
                            onChange={e => {
                                if (e.target.value === 'thief') {
                                    handleSettingChange('player1Color', Player.Black);
                                } else if (e.target.value === 'police') {
                                    handleSettingChange('player1Color', Player.White);
                                } else {
                                    handleSettingChange('player1Color', undefined);
                                }
                            }}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            <option value="random">랜덤</option>
                            <option value="thief">도둑 (흑)</option>
                            <option value="police">경찰 (백)</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>높은 수 (3~6)</label>
                        <select
                            value={settings.thiefHigh36ItemCount ?? 1}
                            onChange={e => handleSettingChange('thiefHigh36ItemCount', parseInt(e.target.value, 10))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>1방지 (2~5)</label>
                        <select
                            value={settings.thiefNoOneItemCount ?? 1}
                            onChange={e => handleSettingChange('thiefNoOneItemCount', parseInt(e.target.value, 10))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                    </>
                )}

                {showBaseStones && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>베이스 돌</label>
                        <select 
                            value={settings.baseStones} 
                            onChange={e => handleSettingChange('baseStones', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {BASE_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                )}

                {showHiddenStones && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>히든아이템</label>
                            <select 
                                value={settings.hiddenStoneCount} 
                                onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {HIDDEN_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>스캔아이템</label>
                            <select 
                                value={settings.scanCount || 5} 
                                onChange={e => handleSettingChange('scanCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {SCAN_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showMissileCount && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>미사일 개수</label>
                        <select 
                            value={settings.missileCount || 3} 
                            onChange={e => handleSettingChange('missileCount', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {MISSILE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                )}

                {showDiceGoSettings && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>라운드 설정</label>
                            <select 
                                value={settings.diceGoRounds ?? 3} 
                                onChange={e => handleSettingChange('diceGoRounds', parseInt(e.target.value, 10) as 1 | 2 | 3)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {[1, 2, 3].map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>홀수 주사위</label>
                            <select 
                                value={settings.oddDiceCount ?? 1} 
                                onChange={e => handleSettingChange('oddDiceCount', parseInt(e.target.value, 10))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>짝수 주사위</label>
                            <select 
                                value={settings.evenDiceCount ?? 1} 
                                onChange={e => handleSettingChange('evenDiceCount', parseInt(e.target.value, 10))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>낮은 수 (1~3)</label>
                            <select 
                                value={settings.lowDiceCount ?? 1} 
                                onChange={e => handleSettingChange('lowDiceCount', parseInt(e.target.value, 10))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>높은 수 (4~6)</label>
                            <select 
                                value={settings.highDiceCount ?? 1} 
                                onChange={e => handleSettingChange('highDiceCount', parseInt(e.target.value, 10))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showAlkkagiSettings && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>돌 개수</label>
                            <select 
                                value={settings.alkkagiStoneCount ?? 5} 
                                onChange={e => handleSettingChange('alkkagiStoneCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.alkkagiRounds ?? 3} 
                                onChange={e => handleSettingChange('alkkagiRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>배치 방식</label>
                            <select 
                                value={settings.alkkagiPlacementType ?? AlkkagiPlacementType.TurnByTurn} 
                                onChange={e => handleSettingChange('alkkagiPlacementType', e.target.value as AlkkagiPlacementType)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {Object.values(AlkkagiPlacementType).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>게이지 속도</label>
                            <select 
                                value={settings.alkkagiGaugeSpeed ?? 700} 
                                onChange={e => handleSettingChange('alkkagiGaugeSpeed', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>슬로우 아이템</label>
                            <select 
                                value={settings.alkkagiSlowItemCount ?? 2} 
                                onChange={e => handleSettingChange('alkkagiSlowItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>조준선 아이템</label>
                            <select 
                                value={settings.alkkagiAimingLineItemCount ?? 2} 
                                onChange={e => handleSettingChange('alkkagiAimingLineItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showCurlingSettings && (
                    <>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>돌 개수</label>
                            <select 
                                value={settings.curlingStoneCount ?? 5} 
                                onChange={e => handleSettingChange('curlingStoneCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.curlingRounds ?? 3} 
                                onChange={e => handleSettingChange('curlingRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>게이지 속도</label>
                            <select 
                                value={settings.curlingGaugeSpeed ?? 700} 
                                onChange={e => handleSettingChange('curlingGaugeSpeed', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>슬로우 아이템</label>
                            <select 
                                value={settings.curlingSlowItemCount ?? 2} 
                                onChange={e => handleSettingChange('curlingSlowItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>조준선 아이템</label>
                            <select 
                                value={settings.curlingAimingLineItemCount ?? 2} 
                                onChange={e => handleSettingChange('curlingAimingLineItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const opponentSubtitle = selectedGameDefinition ? `${selectedGameDefinition.name} 봇` : '게임 종류를 선택하세요';

    const mobileHeaderBack =
        isMobile && mobileStep === 'settings' ? (
            <button
                type="button"
                className={LOBBY_MOBILE_HEADER_BACK_BTN_CLASS}
                onClick={(e) => {
                    e.stopPropagation();
                    setMobileStep('pickMode');
                }}
            >
                뒤로
            </button>
        ) : undefined;

    return (
        <DraggableWindow
            title="AI와 대결하기"
            onClose={onClose}
            windowId="ai-challenge"
            initialWidth={calculatedWidth}
            initialHeight={calculatedHeight}
            uniformPcScale={!isMobile}
            bodyScrollable={!isMobile}
            bodyNoScroll={isMobile}
            isTopmost
            variant={isMobile ? 'store' : undefined}
            headerShowTitle={isMobile}
            headerContent={mobileHeaderBack}
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={isMobile ? NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH : undefined}
            hideFooter={isMobile}
            skipSavedPosition={isMobile}
            bodyPaddingClassName={isMobile ? '!p-2' : undefined}
        >
            {isMobile ? (
                <div
                    className="relative flex min-h-0 max-h-[min(94dvh,880px)] flex-1 flex-col gap-2 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/92 via-zinc-950/96 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:gap-3 sm:p-3"
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" aria-hidden />
                    {/* 상대(AI) 프로필 — 항상 표시 */}
                    <div className="relative z-[1] shrink-0 rounded-xl border border-purple-500/35 bg-gray-900/65 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-start gap-2.5">
                            <Avatar userId={aiUserId} userName="AI" size={52} className="shrink-0 border-2 border-purple-500" />
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-purple-200 text-base leading-tight">AI</h3>
                                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{opponentSubtitle}</p>
                                {selectedGameDefinition ? (
                                    <div className="mt-2 border-t border-white/10 pt-2">
                                        <p className="text-[11px] font-semibold text-gray-400 mb-0.5">게임 설명</p>
                                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-4">
                                            {selectedGameDefinition.description || '선택된 게임에 대한 설명이 없습니다.'}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {mobileStep === 'pickMode' ? (
                        <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                            <h3 className="shrink-0 text-sm font-bold tracking-tight text-amber-100/95">게임 종류 선택</h3>
                            <p className="shrink-0 text-[11px] leading-snug text-zinc-500">항목을 눌러 선택한 뒤 아래에서 대국 설정으로 이동하세요.</p>
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5 -mr-0.5">
                                <div className="grid grid-cols-2 gap-2 pb-1">
                                    {availableGameModes.map((game) => (
                                        <GameCard
                                            key={game.mode}
                                            mode={game.mode}
                                            image={game.image}
                                            displayName={game.name ?? String(game.mode)}
                                            onSelect={setSelectedGameMode}
                                            isSelected={selectedGameMode === game.mode}
                                            compact
                                        />
                                    ))}
                                </div>
                            </div>
                            <div
                                className={`shrink-0 -mx-2 -mb-2 mt-1 flex flex-col gap-2.5 rounded-b-2xl sm:-mx-3 sm:-mb-3 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS}`}
                            >
                                <Button
                                    bare
                                    colorScheme="none"
                                    onClick={() => setMobileStep('settings')}
                                    disabled={!selectedGameMode}
                                    className={`${LOBBY_MOBILE_BTN_PRIMARY_CLASS} ${!selectedGameMode ? '!cursor-not-allowed !opacity-45 !hover:brightness-100' : ''}`}
                                >
                                    다음 — 대국 설정
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                            <h3 className="shrink-0 text-sm font-bold tracking-tight text-amber-100/95">대국 설정</h3>
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 -mr-0.5 rounded-lg border border-white/5 bg-black/20 p-1.5">
                                {renderGameSettings()}
                            </div>
                            <div
                                className={`shrink-0 -mx-2 -mb-2 mt-1 flex flex-col gap-2.5 rounded-b-2xl sm:flex-row sm:-mx-3 sm:-mb-3 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS}`}
                            >
                                <Button
                                    bare
                                    colorScheme="none"
                                    onClick={onClose}
                                    className={LOBBY_MOBILE_BTN_SECONDARY_CLASS}
                                >
                                    취소
                                </Button>
                                <Button
                                    bare
                                    colorScheme="none"
                                    onClick={handleChallenge}
                                    disabled={!selectedGameMode}
                                    className={`${LOBBY_MOBILE_BTN_PRIMARY_CLASS} sm:flex-[1.35] ${!selectedGameMode ? '!cursor-not-allowed !opacity-45 !hover:brightness-100' : ''}`}
                                >
                                    시작 (⚡{actionPointCost})
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex h-full">
                    <div className="w-1/3 bg-tertiary/30 p-4 flex flex-col text-on-panel rounded-l-lg border-r border-gray-700">
                        <h3 className="font-bold text-purple-300 mb-3" style={{ fontSize: `${Math.max(15, Math.round(19 * mobileTextScale))}px` }}>
                            게임 종류 선택
                        </h3>
                        <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto pr-2">
                            {availableGameModes.map((game) => (
                                <GameCard
                                    key={game.mode}
                                    mode={game.mode}
                                    image={game.image}
                                    displayName={game.name ?? String(game.mode)}
                                    onSelect={setSelectedGameMode}
                                    isSelected={selectedGameMode === game.mode}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="w-2/3 bg-primary p-4 flex flex-col rounded-r-lg">
                        <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-3 mb-4 flex-shrink-0">
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar userId={aiUserId} userName="AI" size={54} className="border-2 border-purple-500" />
                                <div>
                                    <h3 className="font-bold text-purple-300" style={{ fontSize: `${Math.max(15, Math.round(19 * mobileTextScale))}px` }}>
                                        AI
                                    </h3>
                                    <p className="text-gray-400" style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>
                                        {selectedGameDefinition ? `${selectedGameDefinition.name} 봇` : 'AI 봇'}
                                    </p>
                                </div>
                            </div>
                            {selectedGameDefinition && (
                                <div className="border-t border-gray-700 pt-3 mt-3">
                                    <h4 className="font-semibold text-gray-300 mb-2" style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>
                                        게임 설명
                                    </h4>
                                    <p className="text-tertiary leading-relaxed" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>
                                        {selectedGameDefinition.description || '선택된 게임에 대한 설명이 없습니다.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            <h4 className="font-semibold text-gray-300 mb-2 flex-shrink-0" style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>
                                대국 설정
                            </h4>
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">{renderGameSettings()}</div>
                        </div>

                        <div className="mt-4 flex flex-shrink-0 justify-end gap-3 border-t border-gray-700 pt-4">
                            <Button
                                onClick={onClose}
                                colorScheme="gray"
                                className="min-h-[2.75rem] px-5 py-2.5 font-semibold"
                                style={{ fontSize: `${Math.max(15, Math.round(17 * mobileTextScale))}px` }}
                            >
                                취소
                            </Button>
                            <Button
                                onClick={handleChallenge}
                                colorScheme="purple"
                                disabled={!selectedGameMode}
                                className="min-h-[2.75rem] px-5 py-2.5 font-semibold"
                                style={{ fontSize: `${Math.max(15, Math.round(17 * mobileTextScale))}px` }}
                            >
                                시작 (⚡{actionPointCost})
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DraggableWindow>
    );
};

export default AiChallengeModal;
