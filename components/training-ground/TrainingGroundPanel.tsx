import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useAdContext } from '../ads/AdProvider.js';
import { calculateTotalStats } from '../../services/statService.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    championshipKataAbilityScore,
} from '../../shared/constants/championshipRealMatch.js';
import { DEFAULT_PAIR_PET_ABILITY_KATA_LADDER, pairPetKataAbilityScore } from '../../shared/constants/pairArena.js';
import {
    TRAINING_GROUND_BOARD_IMAGES,
    TRAINING_GROUND_BOARD_SIZES,
    TRAINING_GROUND_KATA_LEVELS,
    TRAINING_GROUND_LOBBY_IMG,
    TRAINING_GROUND_TAB_STORAGE_KEY,
    minAbilityScoreForKataLevel,
    rewardForKataLevel,
    type TrainingGroundBoardSize,
    type TrainingGroundTrack,
} from '../../shared/constants/trainingGround.js';
import {
    getTrainingGroundTrackState,
    resolveTrainingGroundState,
} from '../../shared/utils/trainingGroundDaily.js';
import {
    isTrainingGroundStageUnlocked,
    trainingGroundPetKataLevel,
    trainingGroundUserKataLevel,
} from '../../shared/utils/trainingGroundProgress.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { pairPetKataStatsSixFromEquippedUser } from '../../shared/utils/pairPetKataStatsFromEquippedUser.js';
import TrainingGroundStageCard from './TrainingGroundStageCard.js';
import TrainingGroundAiPanel from './TrainingGroundAiPanel.js';

type LobbyTab = 'kata' | 'pet' | 'ai';

const GOLD_ICON = '/images/icon/Gold.webp';
const ZEM_ICON = '/images/icon/Zem.webp';

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
    const { currentUserWithStatus, handlers, championshipAbilityKataLadder, kataServerRuntimeConfig } =
        useAppContext();
    const { showShopAdRewardInterstitial, isAdFree } = useAdContext();
    const [tab, setTab] = useState<LobbyTab>(readStoredTab);
    const [boardSize, setBoardSize] = useState<TrainingGroundBoardSize>(19);
    const [selectedKata, setSelectedKata] = useState<number>(TRAINING_GROUND_KATA_LEVELS[0] ?? -30);

    useEffect(() => {
        try {
            sessionStorage.setItem(TRAINING_GROUND_TAB_STORAGE_KEY, tab);
        } catch {
            /* ignore */
        }
    }, [tab]);

    const user = currentUserWithStatus;
    const userLadder = championshipAbilityKataLadder?.length
        ? championshipAbilityKataLadder
        : CHAMPIONSHIP_ABILITY_KATA_LADDER;
    const petLadder = kataServerRuntimeConfig?.pairPet?.abilityKataLadder?.length
        ? kataServerRuntimeConfig.pairPet.abilityKataLadder
        : DEFAULT_PAIR_PET_ABILITY_KATA_LADDER;

    const stats = useMemo(() => (user ? calculateTotalStats(user) : null), [user]);
    const userKata = stats ? trainingGroundUserKataLevel(stats, userLadder) : -30;
    const equippedPet = user ? getEquippedPairPetInventoryRow(user) : null;
    const petKata = user && equippedPet ? trainingGroundPetKataLevel(user, petLadder) : null;

    const kataTicket = user ? getTrainingGroundTrackState(user, 'kata') : { remaining: 1, max: 1 as const, canWatchAd: false };
    const petTicket = user ? getTrainingGroundTrackState(user, 'pet') : { remaining: 1, max: 1 as const, canWatchAd: false };
    const cleared = user ? resolveTrainingGroundState(user) : { kataClearedLevels: [] as number[], petClearedLevels: [] as number[] };

    const track: TrainingGroundTrack = tab === 'pet' ? 'pet' : 'kata';
    const ticket = track === 'pet' ? petTicket : kataTicket;
    const currentKata = track === 'pet' ? petKata : userKata;
    const unlockLadder = track === 'pet' ? petLadder : userLadder;
    const selectedUnlocked = isTrainingGroundStageUnlocked(currentKata, selectedKata);
    const selectedReward = rewardForKataLevel(selectedKata, boardSize);
    const selectedAbility = minAbilityScoreForKataLevel(selectedKata, unlockLadder);
    const petLocked = tab === 'pet' && !equippedPet;

    const abilityTriple = useMemo(() => {
        if (tab === 'ai') return null;
        if (tab === 'pet') {
            if (!user) return null;
            const six = pairPetKataStatsSixFromEquippedUser(user);
            if (!six) return null;
            return {
                opening: pairPetKataAbilityScore('opening', six),
                midgame: pairPetKataAbilityScore('midgame', six),
                endgame: pairPetKataAbilityScore('endgame', six),
                kata: petKata ?? -1,
            };
        }
        if (!stats) return null;
        return {
            opening: championshipKataAbilityScore('opening', stats),
            midgame: championshipKataAbilityScore('midgame', stats),
            endgame: championshipKataAbilityScore('endgame', stats),
            kata: userKata,
        };
    }, [tab, user, stats, petKata, userKata]);

    const startStage = () => {
        if (!user || petLocked || !selectedUnlocked || ticket.remaining < 1) return;
        void handlers.handleAction({
            type: 'START_TRAINING_GROUND_GAME',
            payload: { track, kataLevel: selectedKata, boardSize },
        });
    };

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

                {tab !== 'ai' && (
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-900/40 bg-black/45 px-2 py-1.5 text-[11px] font-bold text-amber-100">
                        <span>
                            {t('trainingGroundUi.homeTickets', {
                                kata: kataTicket.remaining,
                                pet: petTicket.remaining,
                            })}
                        </span>
                        <span>
                            {t('trainingGroundUi.remainingRewards', {
                                remaining: ticket.remaining,
                                max: ticket.max,
                            })}
                        </span>
                    </div>
                )}
                {abilityTriple ? (
                    <p className="shrink-0 rounded-lg border border-amber-900/30 bg-black/30 px-2 py-1 text-[11px] font-semibold text-amber-100/90">
                        {t('trainingGroundUi.abilityTriple', abilityTriple)}
                    </p>
                ) : null}

                {tab === 'ai' ? (
                    <TrainingGroundAiPanel />
                ) : petLocked ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-rose-900/40 bg-black/50 p-6 text-center text-sm font-bold text-rose-100">
                        {t('trainingGroundUi.needEquippedPet')}
                    </div>
                ) : (
                    <>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[11px] font-black text-amber-100/80">{t('trainingGroundUi.boardSize')}</span>
                            {TRAINING_GROUND_BOARD_SIZES.map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => setBoardSize(size)}
                                    className={`overflow-hidden rounded-lg border ${
                                        boardSize === size
                                            ? 'border-amber-300 ring-2 ring-amber-300/70'
                                            : 'border-amber-900/50'
                                    }`}
                                >
                                    <img
                                        src={TRAINING_GROUND_BOARD_IMAGES[size]}
                                        alt={`${size}`}
                                        className="h-10 w-10 object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {TRAINING_GROUND_KATA_LEVELS.map((level) => (
                                    <TrainingGroundStageCard
                                        key={level}
                                        kataLevel={level}
                                        unlocked={isTrainingGroundStageUnlocked(currentKata, level)}
                                        selected={selectedKata === level}
                                        cleared={(track === 'pet'
                                            ? cleared.petClearedLevels
                                            : cleared.kataClearedLevels
                                        ).includes(level)}
                                        boardSize={boardSize}
                                        unlockAbility={minAbilityScoreForKataLevel(level, unlockLadder)}
                                        onSelect={() => setSelectedKata(level)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="shrink-0 rounded-xl border border-amber-800/50 bg-black/60 p-3">
                            <div className="mb-2 flex items-center gap-3 text-sm font-black text-amber-50">
                                <span className="inline-flex items-center gap-1">
                                    <img src={GOLD_ICON} alt="" className="h-4 w-4 object-contain" />
                                    {selectedReward.gold.toLocaleString()}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <img src={ZEM_ICON} alt="" className="h-4 w-4 object-contain" />
                                    {selectedReward.diamonds.toLocaleString()}
                                </span>
                                <span className="ml-auto text-[11px] font-semibold text-amber-100/80">
                                    {t('trainingGroundUi.unlockAbilityMin', { n: selectedAbility })}
                                </span>
                            </div>
                            {ticket.remaining >= 1 && selectedUnlocked ? (
                                <button
                                    type="button"
                                    onClick={startStage}
                                    className="w-full rounded-lg bg-amber-400 py-2 text-sm font-black text-stone-950"
                                >
                                    {t('trainingGroundUi.enter')}
                                </button>
                            ) : ticket.canWatchAd ? (
                                <button
                                    type="button"
                                    onClick={restoreAd}
                                    className="w-full rounded-lg bg-sky-500 py-2 text-sm font-black text-white"
                                >
                                    {t('trainingGroundUi.watchAdRestore')}
                                </button>
                            ) : ticket.remaining < 1 ? (
                                <p className="text-center text-[12px] font-bold text-stone-300">
                                    {t('trainingGroundUi.exhaustedToday')}
                                </p>
                            ) : (
                                <p className="text-center text-[12px] font-bold text-rose-200">
                                    {t('trainingGroundUi.unlockAbilityMin', { n: selectedAbility })}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TrainingGroundPanel;
