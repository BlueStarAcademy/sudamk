import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, PAIR_GO_LOBBY_IMG } from '../../assets.js';
import {
    mergeArenaEntranceAvailability,
    type ArenaEntranceKey,
} from '../../constants/arenaEntrance.js';
import { PVP_LOBBIES_MIN_COMBINED_LEVEL } from '../../shared/utils/contentProgressionGates.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../../shared/types/api.js';
import { arenaLobbyHash } from '../../shared/utils/arenaLobbyDestination.js';
import { replaceAppHash, APP_HOME_ARENA_HASH } from '../../utils/appUtils.js';
import {
    translateArenaEntranceClosed,
    translateArenaEntranceLabel,
    translateArenaProgressionBlocked,
} from '../../shared/i18n/runtimeText.js';

const TYPE_CARDS: { channel: ArenaChannel; image: string; entranceKey: ArenaEntranceKey }[] = [
    { channel: 'strategic', image: STRATEGIC_GO_LOBBY_IMG, entranceKey: 'strategicLobby' },
    { channel: 'pair', image: PAIR_GO_LOBBY_IMG, entranceKey: 'pairLobby' },
    { channel: 'playful', image: PLAYFUL_GO_LOBBY_IMG, entranceKey: 'playfulLobby' },
];

export type ArenaTypePickerProps = {
    intent: ArenaLobbyIntent;
};

const ArenaTypePicker: React.FC<ArenaTypePickerProps> = ({ intent }) => {
    const { t } = useTranslation('nav');
    const { t: tProfile } = useTranslation('profile');
    const { currentUserWithStatus, arenaEntranceAvailability } = useAppContext();
    const merged = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const admin = isClientAdmin(currentUserWithStatus ?? null);
    const serverArena = arenaEntranceAvailability ?? {};

    const intentHeading = intent === 'pvp' ? t('arenaTypePicker.pvpHeading') : t('arenaTypePicker.aiHeading');
    const intentSubtitle = intent === 'pvp' ? t('arenaTypePicker.pvpSubtitle') : t('arenaTypePicker.aiSubtitle');

    const getLockReason = useCallback(
        (key: ArenaEntranceKey): string | null => {
            if (admin || merged[key]) return null;
            if (!serverArena[key]) return tProfile('maintenance');
            if (key === 'pairLobby') return tProfile('entryBlocked');
            if (key === 'strategicLobby' || key === 'playfulLobby') {
                const lv = currentUserWithStatus?.userLevel ?? 1;
                return tProfile('combinedLevelRequired', { current: lv, required: PVP_LOBBIES_MIN_COMBINED_LEVEL });
            }
            return translateArenaProgressionBlocked(key) || tProfile('entryBlocked');
        },
        [admin, merged, serverArena, currentUserWithStatus?.userLevel, tProfile],
    );

    const tryEnter = useCallback(
        (channel: ArenaChannel, entranceKey: ArenaEntranceKey) => {
            const lock = getLockReason(entranceKey);
            if (lock) {
                const card = TYPE_CARDS.find((c) => c.channel === channel);
                const label = card ? translateArenaEntranceLabel(card.entranceKey) : channel;
                window.alert(t('arenaTypePicker.entryBlockedAlert', { label, reason: lock }));
                return;
            }
            replaceAppHash(arenaLobbyHash({ intent, channel }));
        },
        [getLockReason, intent, t],
    );

    const backToArena = () => replaceAppHash(APP_HOME_ARENA_HASH);

    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-slate-950 to-black">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
                <button
                    type="button"
                    onClick={backToArena}
                    className="shrink-0 transition-transform active:scale-90"
                    aria-label={t('arenaTypePicker.backToArena')}
                >
                    <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-bold text-white sm:text-lg">{intentHeading}</h1>
                    <p className="truncate text-[11px] text-slate-400 sm:text-xs">{intentSubtitle}</p>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6">
                <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    {TYPE_CARDS.map(({ channel, image, entranceKey }) => {
                        const locked = !!getLockReason(entranceKey);
                        const label = translateArenaEntranceLabel(entranceKey);
                        return (
                            <button
                                key={channel}
                                type="button"
                                disabled={locked}
                                onClick={() => tryEnter(channel, entranceKey)}
                                className={`group relative flex aspect-[4/3] w-full overflow-hidden rounded-xl border text-left shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)] transition ${
                                    locked
                                        ? 'cursor-not-allowed border-white/10 opacity-75 grayscale-[0.2]'
                                        : 'border-amber-400/35 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.995]'
                                }`}
                                aria-label={t('arenaTypePicker.enterAria', { label, intent: intentHeading })}
                            >
                                <img
                                    src={image}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                                <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/30 bg-black/55 px-2 py-0.5 text-sm font-black text-white">
                                    {label}
                                </span>
                                {locked && (
                                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 px-2 text-center">
                                        <span className="text-3xl leading-none">🔒</span>
                                        <span className="mt-1 rounded-md border border-rose-300/40 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-rose-100">
                                            {getLockReason(entranceKey)}
                                        </span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                {!admin && !merged.strategicLobby && !merged.playfulLobby && !merged.pairLobby && (
                    <p className="text-center text-xs text-rose-200/90">
                        {translateArenaEntranceClosed('strategicLobby')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ArenaTypePicker;
