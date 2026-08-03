import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import {
    LOBBY_CHANNEL_CAPACITY,
    LOBBY_CHANNEL_COUNT,
    LOBBY_CHANNELS_PER_PAGE,
    LOBBY_CHANNEL_MIN,
} from '../../shared/constants/lobbyChannel.js';
import { countUsersInLobbyChannel } from '../../shared/utils/lobbyChannel.js';
import type { UserStatusInfo } from '../../types.js';
import type { ServerAction } from '../../types.js';

export interface LobbyChannelChangeModalProps {
    currentChannel: number;
    /** userId → status (onlineUsers에서 구성) — 본인 채널 보정 포함 */
    userStatuses: Record<string, Pick<UserStatusInfo, 'status' | 'lobbyChannel'> | undefined>;
    onAction: (action: ServerAction) => void;
    onClose: () => void;
}

const TOTAL_PAGES = Math.ceil(LOBBY_CHANNEL_COUNT / LOBBY_CHANNELS_PER_PAGE);

const LobbyChannelChangeModal: React.FC<LobbyChannelChangeModalProps> = ({
    currentChannel,
    userStatuses,
    onAction,
    onClose,
}) => {
    const { t } = useTranslation('lobby');
    const initialPage = Math.max(
        0,
        Math.min(TOTAL_PAGES - 1, Math.floor((currentChannel - LOBBY_CHANNEL_MIN) / LOBBY_CHANNELS_PER_PAGE)),
    );
    const [page, setPage] = useState(initialPage);

    const channelsOnPage = useMemo(() => {
        const start = page * LOBBY_CHANNELS_PER_PAGE + LOBBY_CHANNEL_MIN;
        return Array.from({ length: LOBBY_CHANNELS_PER_PAGE }, (_, i) => start + i).filter(
            (ch) => ch <= LOBBY_CHANNEL_COUNT,
        );
    }, [page]);

    const handleSelect = (channel: number) => {
        if (channel === currentChannel) {
            onClose();
            return;
        }
        onAction({ type: 'CHANGE_LOBBY_CHANNEL', payload: { channel } });
        onClose();
    };

    const occupancyPct = (count: number) =>
        Math.max(0, Math.min(100, Math.round((count / LOBBY_CHANNEL_CAPACITY) * 100)));

    return (
        <DraggableWindow
            title={t('lobbyChannel.modalTitle')}
            windowId="lobby-channel-change-modal"
            onClose={onClose}
            initialWidth={460}
            shrinkHeightToContent
            modal
            closeOnOutsideClick
            isTopmost
            hideFooter
        >
            <div className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-amber-950/20 to-black">
                <div
                    className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent"
                    aria-hidden
                />
                <div className="space-y-4 p-4 sm:p-5">
                    <div className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-950/35 via-black/40 to-zinc-950/80 px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/10">
                        <p className="text-[11px] font-semibold leading-relaxed text-amber-50/85 sm:text-xs">
                            {t('lobbyChannel.modalHint', { capacity: LOBBY_CHANNEL_CAPACITY })}
                        </p>
                        <p className="mt-1 text-[10px] font-bold tabular-nums tracking-wide text-amber-200/70 sm:text-[11px]">
                            {t('lobbyChannel.current')} · Ch.{currentChannel}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5">
                        {channelsOnPage.map((channel) => {
                            const count = countUsersInLobbyChannel(userStatuses, channel, undefined);
                            const isCurrent = channel === currentChannel;
                            const isFull = !isCurrent && count >= LOBBY_CHANNEL_CAPACITY;
                            const pct = occupancyPct(count);
                            return (
                                <button
                                    key={channel}
                                    type="button"
                                    disabled={isFull}
                                    onClick={() => handleSelect(channel)}
                                    className={`group relative flex min-h-[4.25rem] flex-col items-stretch justify-between overflow-hidden rounded-xl border px-2 py-2 text-left transition ${
                                        isCurrent
                                            ? 'border-amber-300/70 bg-gradient-to-b from-amber-700/45 via-amber-950/55 to-black/70 text-amber-50 shadow-[0_10px_24px_-14px_rgba(251,191,36,0.55)] ring-1 ring-amber-300/25'
                                            : isFull
                                              ? 'cursor-not-allowed border-white/8 bg-zinc-950/70 text-zinc-500 opacity-55'
                                              : 'border-white/12 bg-gradient-to-b from-zinc-900/90 via-zinc-950/85 to-black/80 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-amber-400/45 hover:from-amber-950/40 hover:shadow-[0_8px_20px_-12px_rgba(251,191,36,0.35)]'
                                    }`}
                                    title={
                                        isFull
                                            ? t('lobbyChannel.full')
                                            : isCurrent
                                              ? t('lobbyChannel.current')
                                              : t('lobbyChannel.select', { channel })
                                    }
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <span
                                            className={`text-[11px] font-black tracking-wide sm:text-xs ${
                                                isCurrent ? 'text-amber-50' : 'text-zinc-100'
                                            }`}
                                        >
                                            Ch.{channel}
                                        </span>
                                        {isCurrent ? (
                                            <span className="max-w-[2.75rem] truncate rounded-md border border-amber-200/35 bg-amber-400/20 px-1 py-px text-[8px] font-extrabold text-amber-50">
                                                {t('lobbyChannel.current')}
                                            </span>
                                        ) : isFull ? (
                                            <span className="shrink-0 rounded-md border border-rose-400/30 bg-rose-950/50 px-1 py-px text-[8px] font-extrabold text-rose-200/90">
                                                만원
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1.5 space-y-1">
                                        <div className="flex items-baseline justify-between gap-1">
                                            <span
                                                className={`tabular-nums text-[10px] font-bold sm:text-[11px] ${
                                                    isCurrent
                                                        ? 'text-amber-100'
                                                        : isFull
                                                          ? 'text-zinc-500'
                                                          : 'text-zinc-300'
                                                }`}
                                            >
                                                {count}/{LOBBY_CHANNEL_CAPACITY}
                                            </span>
                                            <span className="text-[9px] font-semibold text-zinc-500">{pct}%</span>
                                        </div>
                                        <div className="h-1 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/5">
                                            <div
                                                className={`h-full rounded-full transition-[width] ${
                                                    isCurrent
                                                        ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200'
                                                        : isFull
                                                          ? 'bg-rose-500/70'
                                                          : pct >= 80
                                                            ? 'bg-gradient-to-r from-orange-500/80 to-amber-400/80'
                                                            : 'bg-gradient-to-r from-cyan-500/70 to-emerald-400/70'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/35 p-1 shadow-inner">
                        <button
                            type="button"
                            disabled={page <= 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            className="rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-extrabold text-zinc-200 transition hover:border-amber-400/35 hover:bg-amber-950/40 hover:text-amber-50 disabled:pointer-events-none disabled:opacity-35"
                        >
                            {t('lobbyChannel.prevPage')}
                        </button>
                        <span className="tabular-nums text-[11px] font-bold tracking-wide text-amber-100/80">
                            {t('lobbyChannel.pageLabel', { page: page + 1, total: TOTAL_PAGES })}
                        </span>
                        <button
                            type="button"
                            disabled={page >= TOTAL_PAGES - 1}
                            onClick={() => setPage((p) => Math.min(TOTAL_PAGES - 1, p + 1))}
                            className="rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-extrabold text-zinc-200 transition hover:border-amber-400/35 hover:bg-amber-950/40 hover:text-amber-50 disabled:pointer-events-none disabled:opacity-35"
                        >
                            {t('lobbyChannel.nextPage')}
                        </button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default LobbyChannelChangeModal;
