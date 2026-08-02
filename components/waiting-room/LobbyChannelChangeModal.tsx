import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
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
    /** userId → status (onlineUsers에서 구성) */
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

    return (
        <DraggableWindow
            title={t('lobbyChannel.modalTitle')}
            windowId="lobby-channel-change-modal"
            onClose={onClose}
            initialWidth={420}
            shrinkHeightToContent
            modal
            closeOnOutsideClick
            isTopmost
            hideFooter
        >
            <div className="space-y-3 p-4 sm:p-5">
                <p className="text-center text-xs text-secondary">
                    {t('lobbyChannel.modalHint', { capacity: LOBBY_CHANNEL_CAPACITY })}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {channelsOnPage.map((channel) => {
                        const count = countUsersInLobbyChannel(userStatuses, channel, undefined);
                        const isCurrent = channel === currentChannel;
                        const isFull = !isCurrent && count >= LOBBY_CHANNEL_CAPACITY;
                        return (
                            <button
                                key={channel}
                                type="button"
                                disabled={isFull}
                                onClick={() => handleSelect(channel)}
                                className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors ${
                                    isCurrent
                                        ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                                        : isFull
                                          ? 'cursor-not-allowed border-white/10 bg-black/30 text-zinc-500 opacity-50'
                                          : 'border-white/15 bg-zinc-900/70 text-zinc-100 hover:border-amber-400/50 hover:bg-amber-950/40'
                                }`}
                                title={
                                    isFull
                                        ? t('lobbyChannel.full')
                                        : isCurrent
                                          ? t('lobbyChannel.current')
                                          : t('lobbyChannel.select', { channel })
                                }
                            >
                                <span className="text-xs font-extrabold tracking-wide">Ch.{channel}</span>
                                <span className="mt-0.5 tabular-nums text-[10px] text-secondary">
                                    ({count}/{LOBBY_CHANNEL_CAPACITY})
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                        type="button"
                        colorScheme="gray"
                        disabled={page <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="!px-3 !py-1.5 !text-xs"
                    >
                        {t('lobbyChannel.prevPage')}
                    </Button>
                    <span className="tabular-nums text-xs font-semibold text-secondary">
                        {t('lobbyChannel.pageLabel', { page: page + 1, total: TOTAL_PAGES })}
                    </span>
                    <Button
                        type="button"
                        colorScheme="gray"
                        disabled={page >= TOTAL_PAGES - 1}
                        onClick={() => setPage((p) => Math.min(TOTAL_PAGES - 1, p + 1))}
                        className="!px-3 !py-1.5 !text-xs"
                    >
                        {t('lobbyChannel.nextPage')}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default LobbyChannelChangeModal;
