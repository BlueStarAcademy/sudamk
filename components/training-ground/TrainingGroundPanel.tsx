import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useAdContext } from '../ads/AdProvider.js';
import { calculateTotalStats } from '../../services/statService.js';
import {
    TRAINING_GROUND_BOARD_IMAGES,
    TRAINING_GROUND_BOARD_SIZES,
    TRAINING_GROUND_KATA_LEVELS,
    TRAINING_GROUND_LOBBY_IMG,
    TRAINING_GROUND_TAB_STORAGE_KEY,
    trainingGroundUnlockTotalAbility,
    type TrainingGroundBoardSize,
    type TrainingGroundTrack,
} from '../../shared/constants/trainingGround.js';
import {
    getTrainingGroundTrackState,
    resolveTrainingGroundState,
} from '../../shared/utils/trainingGroundDaily.js';
import {
    isTrainingGroundStageUnlocked,
    isTrainingGroundStageUnlockedBySequentialClear,
    trainingGroundPetTotalAbility,
    trainingGroundUserTotalAbility,
} from '../../shared/utils/trainingGroundProgress.js';
import {
    isTrainingGroundModeCompatibleWithBoard,
    trainingGroundSelectableGameModes,
} from '../../shared/utils/trainingGroundGameSettings.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import {
    LOBBY_VERTICAL_AMBER_SCROLL_CLASS,
} from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';
import TrainingGroundStageCard from './TrainingGroundStageCard.js';
import TrainingGroundModePicker from './TrainingGroundModePicker.js';
import TrainingGroundRewardPanel from './TrainingGroundRewardPanel.js';
import TrainingGroundEnterButton from './TrainingGroundEnterButton.js';
import TrainingGroundAiPanel from './TrainingGroundAiPanel.js';

type LobbyTab = 'kata' | 'pet' | 'ai';

function readStoredTab(): LobbyTab {
    try {
        const raw = sessionStorage.getItem(TRAINING_GROUND_TAB_STORAGE_KEY);
        if (raw === 'kata' || raw === 'pet' || raw === 'ai') return raw;
    } catch {
        /* ignore */
    }
    return 'kata';
}

const TrainingGroundPanel: React.FC = () => {
    const { t } = useTranslation('profile');
    const { currentUserWithStatus, handlers } = useAppContext();
    const { showShopAdRewardInterstitial, isAdFree } = useAdContext();
    const [tab, setTab] = useState<LobbyTab>(readStoredTab);
    const [boardSize, setBoardSize] = useState<TrainingGroundBoardSize>(19);
    const [selectedKata, setSelectedKata] = useState<number>(TRAINING_GROUND_KATA_LEVELS[0] ?? -30);
    const [selectedMode, setSelectedMode] = useState<GameMode>(
        () => trainingGroundSelectableGameModes()[0]?.mode ?? GameMode.Standard,
    );

    const modeCompatible = isTrainingGroundModeCompatibleWithBoard(selectedMode, boardSize);

    useEffect(() => {
        if (modeCompatible) return;
        const fallback =
            [...TRAINING_GROUND_BOARD_SIZES]
                .reverse()
                .find((size) => isTrainingGroundModeCompatibleWithBoard(selectedMode, size)) ?? 13;
        setBoardSize(fallback);
    }, [selectedMode, boardSize, modeCompatible]);

    useEffect(() => {
        try {
            sessionStorage.setItem(TRAINING_GROUND_TAB_STORAGE_KEY, tab);
        } catch {
            /* ignore */
        }
    }, [tab]);

    const user = currentUserWithStatus;
    const stats = useMemo(() => (user ? calculateTotalStats(user) : null), [user]);
    const equippedPet = user ? getEquippedPairPetInventoryRow(user) : null;
    const userTotalAbility = stats ? trainingGroundUserTotalAbility(stats) : 0;
    const petTotalAbility = user && equippedPet ? trainingGroundPetTotalAbility(user) : null;

    const track: TrainingGroundTrack = tab === 'pet' ? 'pet' : 'kata';
    const cleared = user ? resolveTrainingGroundState(user) : { kataClearedLevels: [] as number[], petClearedLevels: [] as number[] };
    const ticket = user
        ? getTrainingGroundTrackState(user, track)
        : { remaining: 1, max: 1 as const, canWatchAd: false };
    const currentTotalAbility = track === 'pet' ? petTotalAbility : userTotalAbility;
    const clearedLevels = track === 'pet' ? cleared.petClearedLevels : cleared.kataClearedLevels;
    const selectedAbilityUnlocked = isTrainingGroundStageUnlocked(currentTotalAbility, selectedKata, track);
    const selectedSequentialUnlocked = isTrainingGroundStageUnlockedBySequentialClear(clearedLevels, selectedKata);
    const selectedUnlocked = selectedAbilityUnlocked && selectedSequentialUnlocked;
    const petLocked = tab === 'pet' && !equippedPet;

    const restoreAd = () => {
        if (!ticket.canWatchAd) return;
        const runClaim = () => {
            void handlers.handleAction({
                type: 'CLAIM_TRAINING_GROUND_AD_RESTORE',
                payload: { track },
            });
        };
        if (isAdFree) {
            runClaim();
            return;
        }
        showShopAdRewardInterstitial(runClaim, {
            placementName: `training-ground-ad-restore-${track}`,
            onDismissed: () => window.alert(t('trainingGroundUi.adDismissed')),
        });
    };

    const startStageWithBoard = (size: TrainingGroundBoardSize) => {
        setBoardSize(size);
        if (!user || petLocked) return;
        if (ticket.remaining < 1) {
            restoreAd();
            return;
        }
        if (!selectedUnlocked) return;
        void handlers.handleAction({
            type: 'START_TRAINING_GROUND_GAME',
            payload: { track, kataLevel: selectedKata, boardSize: size, gameMode: selectedMode },
        });
    };

    const canStartSelected = ticket.remaining >= 1 && selectedUnlocked && modeCompatible;
    const canRestoreEntry = ticket.remaining < 1 && ticket.canWatchAd;
    const enterButtonVariant = canRestoreEntry ? 'ad' : canStartSelected ? 'enter' : 'disabled';

    const tabs: { id: LobbyTab; label: string }[] = [
        { id: 'kata', label: t('trainingGroundUi.kataPractice') },
        { id: 'pet', label: t('trainingGroundUi.petPractice') },
        { id: 'ai', label: t('trainingGroundUi.trainingMachine') },
    ];

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <img src={TRAINING_GROUND_LOBBY_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-stone-950/80 to-black/90" />
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 p-2 sm:p-3">
                <div className="flex shrink-0 gap-1 rounded-lg border border-amber-900/50 bg-black/50 p-1">
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-black ${
                                tab === item.id
                                    ? 'bg-amber-400 text-stone-950'
                                    : 'text-amber-100/80 hover:bg-white/5'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === 'ai' ? (
                    <TrainingGroundAiPanel />
                ) : petLocked ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-rose-900/40 bg-black/50 p-6 text-center text-sm font-bold text-rose-100">
                        {t('trainingGroundUi.needEquippedPet')}
                    </div>
                ) : (
                    <>
                        <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-amber-800/50 bg-black/60 p-2 sm:p-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2 lg:gap-3">
                                <TrainingGroundModePicker
                                    selectedMode={selectedMode}
                                    onSelect={setSelectedMode}
                                />

                                <div className="hidden w-px shrink-0 self-stretch bg-amber-700/40 sm:block" aria-hidden />
                                <div className="h-px w-full shrink-0 bg-amber-700/40 sm:hidden" aria-hidden />

                                <div className="flex min-w-0 shrink-0 items-stretch gap-1.5 sm:gap-2">
                                    <div className="flex shrink-0 flex-col justify-center gap-1">
                                        <p className="px-0.5 text-[10px] font-extrabold tracking-wide text-amber-200/80 sm:text-[11px]">
                                            {t('trainingGroundUi.boardSize')}
                                        </p>
                                        <div className="flex items-center gap-1.5 sm:gap-2.5">
                                            {TRAINING_GROUND_BOARD_SIZES.map((size) => {
                                                const sizeEnabled = isTrainingGroundModeCompatibleWithBoard(
                                                    selectedMode,
                                                    size,
                                                );
                                                const selected = boardSize === size;
                                                return (
                                                    <button
                                                        key={size}
                                                        type="button"
                                                        disabled={!sizeEnabled}
                                                        onClick={() => sizeEnabled && setBoardSize(size)}
                                                        className={`flex flex-col items-center gap-1 ${
                                                            sizeEnabled ? '' : 'cursor-not-allowed opacity-40'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`block overflow-hidden rounded-xl border-2 transition ${
                                                                selected && sizeEnabled
                                                                    ? 'border-amber-300 ring-2 ring-amber-300/70'
                                                                    : sizeEnabled
                                                                      ? 'border-amber-900/50 hover:border-amber-500/70'
                                                                      : 'border-stone-700/60 grayscale'
                                                            }`}
                                                        >
                                                            <img
                                                                src={TRAINING_GROUND_BOARD_IMAGES[size]}
                                                                alt={`${size}`}
                                                                className="h-11 w-11 object-cover sm:h-14 sm:w-14"
                                                            />
                                                        </span>
                                                        <span
                                                            className={`text-[9px] font-bold tabular-nums leading-none sm:text-[10px] ${
                                                                !sizeEnabled
                                                                    ? 'text-stone-500'
                                                                    : selected
                                                                      ? 'text-amber-200'
                                                                      : 'text-amber-100/65'
                                                            }`}
                                                        >
                                                            {size}×{size}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="w-px shrink-0 self-stretch bg-amber-700/40" aria-hidden />

                                    <div className="shrink-0 w-full sm:w-[8.25rem]">
                                        <TrainingGroundRewardPanel
                                            track={track}
                                            kataLevel={selectedKata}
                                            boardSize={boardSize}
                                        />
                                    </div>

                                    <div className="flex shrink-0 flex-col items-center justify-center overflow-visible self-center">
                                        <TrainingGroundEnterButton
                                            variant={enterButtonVariant}
                                            disabled={!canStartSelected && !canRestoreEntry}
                                            remaining={ticket.remaining}
                                            max={ticket.max}
                                            onClick={() => startStageWithBoard(boardSize)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={`min-h-0 flex-1 pr-1 ${LOBBY_VERTICAL_AMBER_SCROLL_CLASS}`}>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {TRAINING_GROUND_KATA_LEVELS.map((level) => {
                                    const abilityUnlocked = isTrainingGroundStageUnlocked(
                                        currentTotalAbility,
                                        level,
                                        track,
                                    );
                                    const sequentialUnlocked = isTrainingGroundStageUnlockedBySequentialClear(
                                        clearedLevels,
                                        level,
                                    );
                                    return (
                                    <TrainingGroundStageCard
                                        key={level}
                                        kataLevel={level}
                                        unlocked={abilityUnlocked && sequentialUnlocked}
                                        abilityUnlocked={abilityUnlocked}
                                        sequentialUnlocked={sequentialUnlocked}
                                        selected={selectedKata === level}
                                        cleared={clearedLevels.includes(level)}
                                        boardSize={boardSize}
                                        unlockAbility={trainingGroundUnlockTotalAbility(level, track)}
                                        showKataUserXp={track === 'kata'}
                                        showPetXp={track === 'pet'}
                                        onSelect={() => setSelectedKata(level)}
                                    />
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TrainingGroundPanel;
