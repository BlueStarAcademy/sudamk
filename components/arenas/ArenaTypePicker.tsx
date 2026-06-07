import React, { useCallback, useMemo } from 'react';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, PAIR_GO_LOBBY_IMG } from '../../assets.js';
import {
    mergeArenaEntranceAvailability,
    ARENA_ENTRANCE_CLOSED_MESSAGE,
    type ArenaEntranceKey,
} from '../../constants/arenaEntrance.js';
import {
    USER_PROGRESSION_ARENA_BLOCK_MESSAGE,
    PVP_LOBBIES_MIN_COMBINED_LEVEL,
} from '../../shared/utils/contentProgressionGates.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../../shared/types/api.js';
import { arenaLobbyHash } from '../../shared/utils/arenaLobbyDestination.js';
import { replaceAppHash } from '../../utils/appUtils.js';

const TYPE_CARDS: { channel: ArenaChannel; image: string; label: string; entranceKey: ArenaEntranceKey }[] = [
    { channel: 'strategic', image: STRATEGIC_GO_LOBBY_IMG, label: '전략바둑', entranceKey: 'strategicLobby' },
    { channel: 'pair', image: PAIR_GO_LOBBY_IMG, label: '페어바둑', entranceKey: 'pairLobby' },
    { channel: 'playful', image: PLAYFUL_GO_LOBBY_IMG, label: '놀이바둑', entranceKey: 'playfulLobby' },
];

const INTENT_HEADING: Record<ArenaLobbyIntent, string> = {
    pvp: 'PVP 경기장',
    ai: 'AI 대전',
};

const INTENT_SUBTITLE: Record<ArenaLobbyIntent, string> = {
    pvp: '전략 · 페어 · 놀이 중 대전할 종류를 선택하세요',
    ai: '전략 · 페어 · 놀이 중 AI와 대전할 종류를 선택하세요',
};

export type ArenaTypePickerProps = {
    intent: ArenaLobbyIntent;
};

const ArenaTypePicker: React.FC<ArenaTypePickerProps> = ({ intent }) => {
    const { currentUserWithStatus, arenaEntranceAvailability } = useAppContext();
    const merged = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const admin = isClientAdmin(currentUserWithStatus ?? null);
    const serverArena = arenaEntranceAvailability ?? {};

    const getLockReason = useCallback(
        (key: ArenaEntranceKey): string | null => {
            if (admin || merged[key]) return null;
            if (!serverArena[key]) return '점검중';
            if (key === 'pairLobby') return '입장 불가';
            if (key === 'strategicLobby' || key === 'playfulLobby') {
                const lv = currentUserWithStatus?.userLevel ?? 1;
                return `통합 Lv.${lv}/${PVP_LOBBIES_MIN_COMBINED_LEVEL}`;
            }
            return USER_PROGRESSION_ARENA_BLOCK_MESSAGE[key] ?? '입장 불가';
        },
        [admin, merged, serverArena, currentUserWithStatus?.userLevel],
    );

    const tryEnter = useCallback(
        (channel: ArenaChannel, entranceKey: ArenaEntranceKey) => {
            const lock = getLockReason(entranceKey);
            if (lock) {
                window.alert(`${TYPE_CARDS.find((c) => c.channel === channel)?.label ?? channel} 입장 불가: ${lock}`);
                return;
            }
            replaceAppHash(arenaLobbyHash({ intent, channel }));
        },
        [getLockReason, intent],
    );

    const backToArena = () => replaceAppHash('#/profile/arena');

    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-slate-950 to-black">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
                <button
                    type="button"
                    onClick={backToArena}
                    className="shrink-0 transition-transform active:scale-90"
                    aria-label="경기장으로 돌아가기"
                >
                    <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-bold text-white sm:text-lg">{INTENT_HEADING[intent]}</h1>
                    <p className="truncate text-[11px] text-slate-400 sm:text-xs">{INTENT_SUBTITLE[intent]}</p>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6">
                <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    {TYPE_CARDS.map(({ channel, image, label, entranceKey }) => {
                        const locked = !!getLockReason(entranceKey);
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
                                aria-label={`${label} ${INTENT_HEADING[intent]} 입장`}
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
                        {ARENA_ENTRANCE_CLOSED_MESSAGE.strategicLobby}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ArenaTypePicker;
