import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { GameMode, GameSettings } from '../../types.js';
import { SPECIAL_GAME_MODES, RANKED_STRATEGIC_MODES, STRATEGIC_ACTION_POINT_COST } from '../../constants/index.js';
import { RANKED_GAME_SETTINGS } from '../../constants/rankedGameSettings.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { effectiveStrategicRankedQueueApCostForUser } from '../../shared/utils/pairPetArenaApDiscount.js';

interface RankedMatchSelectionModalProps {
    onClose: () => void;
    onStartMatching: (selectedModes: GameMode[]) => void;
}

const GameCard: React.FC<{ 
    mode: GameMode, 
    image: string, 
    name: string,
    onToggle: (mode: GameMode) => void,
    isSelected: boolean,
}> = ({ mode, image, name, onToggle, isSelected }) => {
    const { t } = useTranslation('lobby');
    const [imgError, setImgError] = useState(false);

    return (
        <div
            className={`bg-panel text-on-panel rounded-lg flex flex-col items-center text-center transition-all transform cursor-pointer relative ${
                isSelected
                    ? 'ring-2 ring-green-500 hover:-translate-y-1 shadow-lg bg-green-900/20'
                    : 'hover:-translate-y-1 shadow-lg'
            }`}
            style={{ padding: '8px', gap: '4px' }}
            onClick={() => onToggle(mode)}
        >
            <div className="absolute top-1 right-1 z-10 bg-green-600 rounded-full p-1 shadow-lg">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(mode)}
                    className="w-5 h-5 cursor-pointer accent-green-500"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
            {isSelected && (
                <div className="absolute top-1 left-1 z-10 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                    {t('ranked.selectedBadge')}
                </div>
            )}
            <div 
                className="w-full flex-shrink-0 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner relative"
                style={{ height: '100px', padding: '4px' }}
            >
                {!imgError ? (
                    <img 
                        src={image} 
                        alt={name} 
                        className="w-full h-full object-contain"
                        onError={() => setImgError(true)} 
                    />
                ) : (
                    <span style={{ fontSize: '10px' }}>{name}</span>
                )}
            </div>
            <h3
                className={`w-full shrink-0 font-bold leading-tight ${
                    isSelected ? 'text-green-300' : 'text-primary'
                }`}
                style={{ fontSize: '11px' }}
            >
                {name}
            </h3>
        </div>
    );
};

const RankedMatchSelectionModal: React.FC<RankedMatchSelectionModalProps> = ({ onClose, onStartMatching }) => {
    const { t } = useTranslation('lobby');
    const { t: tNeg } = useTranslation('negotiation');
    const { t: tCommon } = useTranslation('common');
    const { currentUser } = useAppContext();
    const actionPointCost = useMemo(
        () => (currentUser ? effectiveStrategicRankedQueueApCostForUser(currentUser) : STRATEGIC_ACTION_POINT_COST),
        [currentUser],
    );
    const availableModes = useMemo(() => RANKED_STRATEGIC_MODES, []);

    const availableGameDefinitions = useMemo(() => {
        return SPECIAL_GAME_MODES.filter((m) => availableModes.includes(m.mode));
    }, [availableModes]);

    const [selectedModes, setSelectedModes] = useState<GameMode[]>([]);
    const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);

    const moveModeUp = (mode: GameMode) => {
        setSelectedModes(prev => {
            const index = prev.indexOf(mode);
            if (index <= 0) return prev;
            const newModes = [...prev];
            [newModes[index - 1], newModes[index]] = [newModes[index], newModes[index - 1]];
            return newModes;
        });
    };

    const moveModeDown = (mode: GameMode) => {
        setSelectedModes(prev => {
            const index = prev.indexOf(mode);
            if (index < 0 || index >= prev.length - 1) return prev;
            const newModes = [...prev];
            [newModes[index], newModes[index + 1]] = [newModes[index + 1], newModes[index]];
            return newModes;
        });
    };
    
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setWindowHeight(window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const isCompactViewport = windowWidth < 1025;
    const calculatedWidth = Math.max(800, Math.min(1200, windowWidth * 0.85));
    const calculatedHeight = Math.max(600, Math.min(900, windowHeight * 0.8));
    const mobileTextScale = isCompactViewport ? 1.15 : 1.0;

    const selectedGameDefinition = useMemo(() => {
        return availableGameDefinitions.find(mode => mode.mode === selectedMode);
    }, [availableGameDefinitions, selectedMode]);

    const handleModeToggle = (mode: GameMode) => {
        setSelectedModes(prev => 
            prev.includes(mode) 
                ? prev.filter(m => m !== mode)
                : [...prev, mode]
        );
        if (!selectedModes.includes(mode)) {
            setSelectedMode(mode);
        } else if (selectedMode === mode) {
            const remaining = selectedModes.filter(m => m !== mode);
            setSelectedMode(remaining.length > 0 ? remaining[0] : null);
        }
    };

    const handleStartMatching = () => {
        if (selectedModes.length === 0) {
            alert(t('ranked.selectModesMin'));
            return;
        }
        onStartMatching(selectedModes);
    };

    const renderRankedSettings = (mode: GameMode) => {
        const settings = RANKED_GAME_SETTINGS[mode];
        if (!settings) return null;

        const items: { label: string; value: string }[] = [];

        if (settings.boardSize) {
            items.push({ label: tNeg('settings.boardSize'), value: t('ranked.boardSizeValue', { size: settings.boardSize }) });
        }
        if (settings.scoringTurnLimit && settings.scoringTurnLimit > 0) {
            items.push({ label: t('ranked.scoringUntil'), value: t('ranked.scoringTurnValue', { count: settings.scoringTurnLimit }) });
        }
        if (settings.timeLimit > 0) {
            items.push({ label: t('ranked.timeLimit'), value: t('ranked.minutesFormat', { minutes: settings.timeLimit }) });
        }
        if (settings.byoyomiTime > 0 && settings.byoyomiCount > 0) {
            items.push({ label: t('ranked.byoyomi'), value: t('ranked.byoyomiFormat', { seconds: settings.byoyomiTime, count: settings.byoyomiCount }) });
        }
        if (settings.timeIncrement && settings.timeIncrement > 0) {
            items.push({ label: t('ranked.timeIncrement'), value: t('ranked.fischerIncrement', { seconds: settings.timeIncrement }) });
        }
        if (settings.captureTarget) {
            items.push({ label: t('ranked.targetScore'), value: t('ranked.scorePoints', { score: settings.captureTarget }) });
        }
        if (settings.hiddenStoneCount) {
            items.push({ label: t('ranked.hiddenItem'), value: t('ranked.itemCountValue', { count: settings.hiddenStoneCount }) });
        }
        if (settings.scanCount) {
            items.push({ label: t('ranked.scanItem'), value: t('ranked.itemCountValue', { count: settings.scanCount }) });
        }
        if (settings.missileCount) {
            items.push({ label: t('ranked.missileItem'), value: t('ranked.itemCountValue', { count: settings.missileCount }) });
        }
        if (settings.castleCount) {
            items.push({ label: tNeg('settings.castle'), value: t('ranked.itemCountValue', { count: settings.castleCount }) });
        }
        if (settings.diceGoRounds) {
            items.push({ label: tNeg('settings.round'), value: t('ranked.roundUnit', { count: settings.diceGoRounds }) });
        }
        if (settings.has33Forbidden !== undefined) {
            items.push({ label: t('ranked.forbid33Short'), value: settings.has33Forbidden ? t('ranked.applied') : t('ranked.notApplied') });
        }
        if (settings.hasOverlineForbidden !== undefined) {
            items.push({ label: t('ranked.forbidOverlineShort'), value: settings.hasOverlineForbidden ? t('ranked.applied') : t('ranked.notApplied') });
        }
        if (settings.alkkagiRounds) {
            items.push({ label: tNeg('settings.round'), value: t('ranked.roundUnit', { count: settings.alkkagiRounds }) });
        }
        if (settings.alkkagiStoneCount) {
            items.push({ label: t('ranked.stonePlacementCount'), value: t('ranked.itemCountValue', { count: settings.alkkagiStoneCount }) });
        }
        if (settings.alkkagiGaugeSpeed) {
            items.push({ label: t('ranked.gaugeSpeed'), value: t('ranked.gaugeFast', { speed: settings.alkkagiGaugeSpeed }) });
        }
        if (settings.alkkagiSlowItemCount) {
            items.push({ label: t('ranked.slowItem'), value: t('ranked.itemCountValue', { count: settings.alkkagiSlowItemCount }) });
        }
        if (settings.alkkagiAimingLineItemCount) {
            items.push({ label: t('ranked.aimingLine'), value: t('ranked.itemCountValue', { count: settings.alkkagiAimingLineItemCount }) });
        }
        if (settings.curlingRounds) {
            items.push({ label: tNeg('settings.round'), value: t('ranked.roundUnit', { count: settings.curlingRounds }) });
        }
        if (settings.curlingStoneCount) {
            items.push({ label: t('ranked.stoneCount'), value: t('ranked.itemCountValue', { count: settings.curlingStoneCount }) });
        }
        if (settings.curlingGaugeSpeed) {
            items.push({ label: t('ranked.gaugeSpeed'), value: t('ranked.gaugeFast', { speed: settings.curlingGaugeSpeed }) });
        }
        if (settings.curlingSlowItemCount) {
            items.push({ label: t('ranked.slowItem'), value: t('ranked.itemCountValue', { count: settings.curlingSlowItemCount }) });
        }
        if (settings.curlingAimingLineItemCount) {
            items.push({ label: t('ranked.aimingLine'), value: t('ranked.itemCountValue', { count: settings.curlingAimingLineItemCount }) });
        }
        if (mode === GameMode.Standard) {
            items.push({ label: t('ranked.rankingScore'), value: t('ranked.scoreBonusWin') });
        }

        return items;
    };

    return (
        <DraggableWindow 
            title={t('ranked.selectTitle')} 
            onClose={onClose} 
            windowId="ranked-match-selection" 
            initialWidth={calculatedWidth} 
            initialHeight={calculatedHeight}
            isTopmost
        >
            <div className="flex h-full">
                <div className={`w-1/3 bg-tertiary/30 ${isCompactViewport ? 'p-2' : 'p-4'} flex flex-col text-on-panel rounded-l-lg border-r border-gray-700`}>
                    <h3 className="font-bold text-green-300 mb-3" style={{ fontSize: `${Math.max(12, Math.round(16 * mobileTextScale))}px` }}>
                        {t('ranked.multiSelectTitle')}
                    </h3>
                    
                    <div className="grid flex-1 grid-cols-2 items-start gap-2 overflow-y-auto pr-2">
                        {availableGameDefinitions.map((game) => {
                            const isSelected = selectedModes.includes(game.mode);
                            return (
                                <div key={game.mode} className="relative">
                                    <GameCard
                                        mode={game.mode}
                                        image={game.image}
                                        name={game.name}
                                        onToggle={handleModeToggle}
                                        isSelected={isSelected}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-400">
                            {t('ranked.selectedCount', { count: selectedModes.length })}
                        </p>
                    </div>
                </div>

                <div className={`w-2/3 bg-primary ${isCompactViewport ? 'p-2' : 'p-4'} flex flex-col rounded-r-lg overflow-y-auto`}>
                    {selectedModes.length > 0 && (
                        <div className="mb-4 flex-1 min-h-0 flex flex-col">
                            <h4 className="font-semibold text-yellow-300 mb-2 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>
                                {t('ranked.priorityTitle')}
                            </h4>
                            <div className="bg-gray-900/50 border border-yellow-700/50 rounded-lg p-3 flex-1 min-h-0 flex flex-col">
                                <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                                    {selectedModes.map((mode, index) => {
                                        const gameDef = availableGameDefinitions.find(g => g.mode === mode);
                                        if (!gameDef) return null;
                                        
                                        return (
                                            <div 
                                                key={mode} 
                                                className="flex items-center gap-2 bg-gray-800/70 rounded-lg p-2 border border-gray-700 hover:border-green-500 transition-colors"
                                            >
                                                <div className="flex-shrink-0 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                    {index + 1}
                                                </div>
                                                
                                                <img 
                                                    src={gameDef.image} 
                                                    alt={gameDef.name}
                                                    className="w-10 h-10 object-contain flex-shrink-0"
                                                />
                                                
                                                <span className="flex-grow text-sm text-white font-medium">
                                                    {gameDef.name}
                                                </span>
                                                
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => moveModeUp(mode)}
                                                            disabled={index === 0}
                                                            className={`w-6 h-6 flex items-center justify-center rounded ${
                                                                index === 0 
                                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                                            }`}
                                                            style={{ fontSize: '11px' }}
                                                            title={t('ranked.priorityUp')}
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            onClick={() => moveModeDown(mode)}
                                                            disabled={index === selectedModes.length - 1}
                                                            className={`w-6 h-6 flex items-center justify-center rounded ${
                                                                index === selectedModes.length - 1 
                                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                                            }`}
                                                            style={{ fontSize: '11px' }}
                                                            title={t('ranked.priorityDown')}
                                                        >
                                                            ↓
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleModeToggle(mode)}
                                                        className="w-6 h-6 flex items-center justify-center rounded bg-red-600 hover:bg-red-500 text-white"
                                                        style={{ fontSize: '12px' }}
                                                        title={t('ranked.deselect')}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-yellow-300 mt-2 pt-2 border-t border-gray-700 flex-shrink-0">
                                    {t('ranked.priorityAdjustTip')}
                                </p>
                            </div>
                        </div>
                    )}
                    {selectedGameDefinition ? (
                        <div className={`flex gap-4 ${isCompactViewport ? 'flex-col' : 'flex-row'} flex-shrink-0`} style={{ maxHeight: '40%' }}>
                            <div className={`bg-gray-900/50 rounded-lg border border-gray-700 ${isCompactViewport ? 'p-2' : 'p-3'} ${isCompactViewport ? 'w-full' : 'w-1/2'} flex-shrink-0 flex flex-col`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <img 
                                        src={selectedGameDefinition.image} 
                                        alt={selectedGameDefinition.name}
                                        className="w-16 h-16 object-contain"
                                    />
                                    <div>
                                        <h3 className="font-bold text-green-300" style={{ fontSize: `${Math.max(14, Math.round(18 * mobileTextScale))}px` }}>
                                            {selectedGameDefinition.name}
                                        </h3>
                                        <p className="text-xs text-gray-400">
                                            {selectedModes.includes(selectedGameDefinition.mode) ? t('ranked.selected') : t('ranked.notSelected')}
                                        </p>
                                    </div>
                                </div>
                                <div className="border-t border-gray-700 pt-3 mt-3 flex-1">
                                    <h4 className="font-semibold text-gray-300 mb-2" style={{ fontSize: `${Math.max(10, Math.round(12 * mobileTextScale))}px` }}>
                                        {t('ranked.gameDescription')}
                                    </h4>
                                    <p className="text-tertiary leading-relaxed" style={{ fontSize: `${Math.max(9, Math.round(11 * mobileTextScale))}px` }}>
                                        {selectedGameDefinition.description || t('ranked.noDescription')}
                                    </p>
                                </div>
                            </div>

                            <div className={`bg-yellow-900/20 border border-yellow-700/50 rounded-lg ${isCompactViewport ? 'p-2' : 'p-3'} ${isCompactViewport ? 'w-full' : 'w-1/2'} flex-shrink-0 flex flex-col`}>
                                <h4 className="font-semibold text-yellow-300 mb-3 flex-shrink-0" style={{ fontSize: `${Math.max(10, Math.round(12 * mobileTextScale))}px` }}>
                                    {t('ranked.gameSettingsTitle')}
                                </h4>
                                <div className="grid grid-cols-1 gap-2 overflow-y-auto flex-1">
                                    {renderRankedSettings(selectedGameDefinition.mode)?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-300">{item.label}:</span>
                                            <span className="text-yellow-200 font-semibold">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-gray-400 text-center">
                                {t('ranked.selectModeLeftPrompt')}
                            </p>
                        </div>
                    )}

                    <div className="border-t border-gray-700 flex justify-end gap-2 mt-4 pt-4 flex-shrink-0">
                        <Button 
                            onClick={onClose} 
                            colorScheme="gray" 
                            style={{ fontSize: `${Math.max(10, Math.round(12 * mobileTextScale))}px` }}
                        >
                            {tCommon('actions.cancel')}
                        </Button>
                        <Button 
                            onClick={handleStartMatching} 
                            colorScheme="green" 
                            disabled={selectedModes.length === 0}
                            style={{ fontSize: `${Math.max(10, Math.round(12 * mobileTextScale))}px` }}
                        >
                            {t('ranked.startMatching', { count: selectedModes.length })} (⚡{actionPointCost})
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default RankedMatchSelectionModal;
