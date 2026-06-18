import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AI_ARENA_ENTRY_IMG, PVP_ARENA_ENTRY_IMG, STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, PAIR_GO_LOBBY_IMG } from '../../assets.js';
import {
    mergeArenaEntranceAvailability,
    type ArenaEntranceKey,
} from '../../constants/arenaEntrance.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
import type { UserWithStatus } from '../../types.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../../shared/types/api.js';
import type { ArenaLobbyNavKind } from './ArenaLobbyNavTitleBar.js';
import {
    translateArenaEntranceClosed,
    translateArenaProgressionBlocked,
} from '../../shared/i18n/runtimeText.js';

const CHANNEL_CARDS: {
    channel: ArenaChannel;
    navKind: ArenaLobbyNavKind;
    image: string;
    entranceKey: ArenaEntranceKey;
}[] = [
    { channel: 'strategic', navKind: 'strategic', image: STRATEGIC_GO_LOBBY_IMG, entranceKey: 'strategicLobby' },
    { channel: 'pair', navKind: 'pair', image: PAIR_GO_LOBBY_IMG, entranceKey: 'pairLobby' },
    { channel: 'playful', navKind: 'playful', image: PLAYFUL_GO_LOBBY_IMG, entranceKey: 'playfulLobby' },
];

export type ArenaLobbySwitchGridProps = {
    channel: ArenaChannel;
    intent: ArenaLobbyIntent;
    onSelectChannel: (target: ArenaLobbyNavKind) => void;
    onSelectIntent: (target: ArenaLobbyIntent) => void;
    currentUser: UserWithStatus | null | undefined;
    arenaEntranceFromServer: Partial<Record<ArenaEntranceKey, boolean>> | undefined;
    arenaEntranceAvailability: Partial<Record<string, boolean>> | null | undefined;
    layout?: 'grid' | 'scroll';
    className?: string;
};

function destinationTitleKey(target: ArenaChannel, cardIntent: ArenaLobbyIntent): string {
    const suffix = cardIntent === 'pvp' ? 'Pvp' : 'Ai';
    return `${target}${suffix}`;
}

function cardLabelKey(target: ArenaChannel, cardIntent: ArenaLobbyIntent): string {
    const suffix = cardIntent === 'pvp' ? 'Pvp' : 'Ai';
    return `${target}${suffix}`;
}

export const ArenaLobbySwitchGrid: React.FC<ArenaLobbySwitchGridProps> = ({
    channel,
    intent,
    onSelectChannel,
    onSelectIntent,
    currentUser,
    arenaEntranceFromServer,
    arenaEntranceAvailability,
    layout = 'grid',
    className,
}) => {
    const { t } = useTranslation('lobby');
    const merged = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const admin = isClientAdmin(currentUser ?? null);
    const serverArena = arenaEntranceFromServer ?? {};

    const intentToggleMeta = useMemo(
        () => ({
            pvp: {
                label: t('arenaLobby.intentToggle.aiArena'),
                opposite: 'ai' as const,
                image: AI_ARENA_ENTRY_IMG,
                toneBorder: 'border-violet-400/45',
                toneRing: 'ring-violet-300/75',
                badgeClass: 'border-violet-400/55 bg-black text-violet-100',
            },
            ai: {
                label: t('arenaLobby.intentToggle.pvpArena'),
                opposite: 'pvp' as const,
                image: PVP_ARENA_ENTRY_IMG,
                toneBorder: 'border-fuchsia-400/45',
                toneRing: 'ring-fuchsia-300/75',
                badgeClass: 'border-fuchsia-400/55 bg-black text-fuchsia-100',
            },
        }),
        [t],
    );

    const tryEnterChannel = useCallback(
        (target: ArenaLobbyNavKind) => {
            if (target === channel) return;
            const key = CHANNEL_CARDS.find((c) => c.navKind === target)?.entranceKey;
            if (!key) return;
            if (admin || merged[key]) {
                onSelectChannel(target);
                return;
            }
            if (!serverArena[key]) {
                window.alert(translateArenaEntranceClosed(key));
                return;
            }
            window.alert(translateArenaProgressionBlocked(key) || translateArenaEntranceClosed(key));
        },
        [channel, admin, merged, serverArena, onSelectChannel],
    );

    const tryToggleIntent = useCallback(() => {
        const opposite = intentToggleMeta[intent].opposite;
        if (opposite === intent) return;
        onSelectIntent(opposite);
    }, [intent, intentToggleMeta, onSelectIntent]);

    const channelCardShell = (
        target: ArenaChannel,
        navKind: ArenaLobbyNavKind,
        image: string,
        short: string,
        active: boolean,
        onClick: () => void,
        cardIntent: ArenaLobbyIntent,
    ) => {
        const isStrategic = target === 'strategic';
        const isPlayful = target === 'playful';
        const toneRing = isStrategic ? 'ring-cyan-300/75' : isPlayful ? 'ring-amber-300/75' : 'ring-violet-300/75';
        const toneBorder = isStrategic
            ? 'border-cyan-400/40'
            : isPlayful
              ? 'border-amber-400/40'
              : 'border-violet-400/40';
        const badgeClass = isStrategic
            ? 'border-cyan-400/55 bg-black text-cyan-100'
            : isPlayful
              ? 'border-amber-400/55 bg-black text-amber-100'
              : 'border-violet-400/55 bg-black text-violet-100';
        const title = t(`arenaLobby.destinationTitle.${destinationTitleKey(target, cardIntent)}`);
        const sizeCls =
            layout === 'scroll'
                ? 'h-[3.25rem] w-[5.5rem] shrink-0 sm:h-14 sm:w-[6.25rem]'
                : 'aspect-[4/3] w-full min-h-0';

        return (
            <button
                type="button"
                key={`${target}-${cardIntent}`}
                onClick={onClick}
                aria-pressed={active}
                aria-label={t('arenaLobby.goToTitle', { title })}
                title={title}
                className={`relative min-w-0 overflow-hidden rounded-lg border-2 ${toneBorder} shadow-[0_10px_28px_-14px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${sizeCls} ${
                    active
                        ? `z-[1] scale-[1.02] ring-2 ${toneRing} brightness-[1.05]`
                        : 'opacity-90 hover:opacity-100 hover:brightness-110 hover:shadow-[0_14px_34px_-12px_rgba(0,0,0,0.75)] active:scale-[0.99]'
                }`}
            >
                <img
                    src={image}
                    alt=""
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ${active ? 'scale-105' : ''}`}
                    loading="lazy"
                    decoding="async"
                />
                <div
                    className={`pointer-events-none absolute inset-0 ${
                        isStrategic
                            ? 'bg-gradient-to-t from-cyan-950/80 via-black/35 to-black/10'
                            : isPlayful
                              ? 'bg-gradient-to-t from-amber-950/78 via-black/35 to-black/10'
                              : 'bg-gradient-to-t from-violet-950/80 via-black/35 to-black/10'
                    }`}
                />
                <span
                    className={`pointer-events-none absolute left-1.5 top-1.5 rounded border px-1.5 py-0.5 font-black tracking-wide shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:left-2 sm:top-2 sm:px-2 sm:py-0.5 ${badgeClass} text-[0.65rem] sm:text-xs`}
                >
                    {short}
                </span>
            </button>
        );
    };

    const intentToggle = intentToggleMeta[intent];
    const intentCard = (
        <button
            type="button"
            onClick={tryToggleIntent}
            aria-label={t('arenaLobby.switchIntent', { label: intentToggle.label })}
            title={intentToggle.label}
            className={`relative min-w-0 overflow-hidden rounded-lg border-2 ${intentToggle.toneBorder} shadow-[0_10px_28px_-14px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] transition duration-200 hover:opacity-100 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.99] ${
                layout === 'scroll' ? 'h-[3.25rem] w-[5.5rem] shrink-0 sm:h-14 sm:w-[6.25rem]' : 'aspect-[4/3] w-full min-h-0'
            } opacity-95`}
        >
            <img
                src={intentToggle.image}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                loading="lazy"
                decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/15" />
            <span
                className={`pointer-events-none absolute left-1.5 top-1.5 rounded border px-1.5 py-0.5 font-black tracking-wide shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:left-2 sm:top-2 sm:px-2 sm:py-0.5 ${intentToggle.badgeClass} text-[0.65rem] sm:text-xs`}
            >
                {intentToggle.label}
            </span>
        </button>
    );

    const strategicCard = channelCardShell(
        'strategic',
        'strategic',
        STRATEGIC_GO_LOBBY_IMG,
        t(`arenaLobby.cardLabel.${cardLabelKey('strategic', intent)}`),
        channel === 'strategic',
        () => tryEnterChannel('strategic'),
        intent,
    );
    const pairCard = channelCardShell(
        'pair',
        'pair',
        PAIR_GO_LOBBY_IMG,
        t(`arenaLobby.cardLabel.${cardLabelKey('pair', intent)}`),
        channel === 'pair',
        () => tryEnterChannel('pair'),
        intent,
    );
    const playfulCard = channelCardShell(
        'playful',
        'playful',
        PLAYFUL_GO_LOBBY_IMG,
        t(`arenaLobby.cardLabel.${cardLabelKey('playful', intent)}`),
        channel === 'playful',
        () => tryEnterChannel('playful'),
        intent,
    );

    const switchAria = t('arenaLobby.switchArena');

    if (layout === 'scroll') {
        return (
            <div
                className={`w-full shrink-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] ${className ?? ''}`}
                role="tablist"
                aria-label={switchAria}
            >
                <div className="flex w-max min-w-full gap-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/90 p-1.5 ring-1 ring-white/10 sm:gap-2 sm:p-2">
                    {strategicCard}
                    {pairCard}
                    {playfulCard}
                    {intentCard}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`w-full shrink-0 rounded-xl border border-amber-500/40 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_28px_-16px_rgba(0,0,0,0.65)] ring-1 ring-white/10 sm:p-2 ${className ?? ''}`}
            role="tablist"
            aria-label={switchAria}
        >
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {strategicCard}
                {pairCard}
                {playfulCard}
                {intentCard}
            </div>
        </div>
    );
};
