import React from 'react';
import type { ArenaLobbyIntent } from '../../shared/types/api.js';
import { ARENA_LOBBY_DESTINATION_TITLE } from '../../shared/utils/arenaLobbyDestination.js';

export type ArenaLobbyNavKind = 'pair' | 'strategic' | 'playful';

type TitleBarProps = {
    kind: ArenaLobbyNavKind;
    lobbyIntent?: ArenaLobbyIntent;
    /** 프로필로 이동(대기실 이탈 등은 부모에서 비동기 처리) */
    onBackToProfile: () => void;
    titleHeadingClass: string;
    className?: string;
};

/** 뒤로가기 + 현재 경기장 제목. 경기장 전환은 `ArenaLobbySwitchGrid`에서 처리한다. */
export const ArenaLobbyNavTitleBar: React.FC<TitleBarProps> = ({
    kind,
    lobbyIntent = 'pvp',
    onBackToProfile,
    className,
    titleHeadingClass,
}) => {
    const titleStripChrome =
        kind === 'playful'
            ? 'border-amber-400/45 bg-black/20'
            : kind === 'pair'
              ? 'border-violet-400/50 bg-violet-950/20'
              : 'border-cyan-400/45 bg-black/25';

    const displayTitle = ARENA_LOBBY_DESTINATION_TITLE[kind][lobbyIntent];

    return (
        <div className={className ?? ''}>
            <div
                className={`flex w-full min-w-0 shrink-0 items-center gap-1.5 rounded-xl border p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:gap-2 sm:p-2 ${titleStripChrome}`}
            >
                <button
                    type="button"
                    onClick={onBackToProfile}
                    className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                    aria-label="뒤로가기"
                >
                    <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
                <h1 className={`min-w-0 flex-1 truncate ${titleHeadingClass}`}>{displayTitle}</h1>
            </div>
        </div>
    );
};
