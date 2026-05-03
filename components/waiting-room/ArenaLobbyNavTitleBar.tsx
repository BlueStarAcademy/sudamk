import React from 'react';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, PAIR_GO_LOBBY_IMG } from '../../assets.js';
import { mergeArenaEntranceAvailability, ARENA_ENTRANCE_CLOSED_MESSAGE, type ArenaEntranceKey } from '../../constants/arenaEntrance.js';
import { USER_PROGRESSION_ARENA_BLOCK_MESSAGE } from '../../shared/utils/contentProgressionGates.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
import type { UserWithStatus } from '../../types.js';

export type ArenaLobbyNavKind = 'pair' | 'strategic' | 'playful';

type SharedNavProps = {
    kind: ArenaLobbyNavKind;
    currentUser: UserWithStatus | null | undefined;
    arenaEntranceFromServer: Partial<Record<ArenaEntranceKey, boolean>> | undefined;
    arenaEntranceAvailability: Partial<Record<string, boolean>> | null | undefined;
    onSelectArena: (target: ArenaLobbyNavKind) => void;
    className?: string;
    /** `compact`: 타이틀 오른쪽 한 줄 배치용 작은 탭 */
    tabDensity?: 'default' | 'compact';
};

type TitleBarProps = {
    kind: ArenaLobbyNavKind;
    /** 프로필로 이동(대기실 이탈 등은 부모에서 비동기 처리) */
    onBackToProfile: () => void;
    titleHeadingClass: string;
    className?: string;
    /** 모바일 등: 전략/페어/놀이 탭을 뒤로가기·경기장 이름과 같은 영역에 포함 */
    embeddedArenaSwitcher?: Pick<
        SharedNavProps,
        'currentUser' | 'arenaEntranceFromServer' | 'arenaEntranceAvailability' | 'onSelectArena'
    >;
};

const arenaKey: Record<ArenaLobbyNavKind, ArenaEntranceKey> = {
    strategic: 'strategicLobby',
    playful: 'playfulLobby',
    pair: 'pairLobby',
};

const arenaTitle: Record<ArenaLobbyNavKind, string> = {
    strategic: '전략바둑 경기장',
    playful: '놀이바둑 경기장',
    pair: '페어 경기장',
};

/** 프로필 홈 PVP 카드와 동일한 배경 이미지 */
const arenaTabArt: Record<ArenaLobbyNavKind, { image: string; short: string }> = {
    strategic: { image: STRATEGIC_GO_LOBBY_IMG, short: '전략' },
    pair: { image: PAIR_GO_LOBBY_IMG, short: '페어' },
    playful: { image: PLAYFUL_GO_LOBBY_IMG, short: '놀이' },
};

function buildArenaLobbyNavHandlers({
    kind,
    currentUser,
    arenaEntranceFromServer,
    arenaEntranceAvailability,
    onSelectArena,
    tabDensity = 'default',
}: SharedNavProps) {
    const merged = mergeArenaEntranceAvailability(arenaEntranceAvailability);
    const admin = isClientAdmin(currentUser ?? null);
    const serverArena = arenaEntranceFromServer ?? {};
    const compact = tabDensity === 'compact';

    const tryEnter = (target: ArenaLobbyNavKind) => {
        if (target === kind) return;
        const key = arenaKey[target];
        if (admin || merged[key]) {
            onSelectArena(target);
            return;
        }
        if (!serverArena[key]) {
            window.alert(ARENA_ENTRANCE_CLOSED_MESSAGE[key]);
            return;
        }
        window.alert(USER_PROGRESSION_ARENA_BLOCK_MESSAGE[key] ?? ARENA_ENTRANCE_CLOSED_MESSAGE[key]);
    };

    const tabBtn = (target: ArenaLobbyNavKind) => {
        const active = kind === target;
        const { image, short } = arenaTabArt[target];
        const isStrategic = target === 'strategic';
        const isPlayful = target === 'playful';

        /** 모바일 타이틀 줄: 이미지 없이 기존 텍스트 탭 */
        if (compact) {
            const cyan = target === 'strategic';
            const amber = target === 'playful';
            const sizeCls =
                'min-w-0 flex-1 rounded-md px-1 py-1 text-[0.58rem] font-extrabold leading-tight transition sm:px-1.5 sm:py-1.5 sm:text-[0.65rem]';
            return (
                <button
                    type="button"
                    key={target}
                    onClick={() => tryEnter(target)}
                    aria-pressed={active}
                    aria-label={`${arenaTitle[target]}으로 이동`}
                    title={arenaTitle[target]}
                    className={`${sizeCls} ${
                        active
                            ? cyan
                                ? 'bg-cyan-500 text-cyan-950 ring-1 ring-cyan-200/80'
                                : amber
                                  ? 'bg-amber-500 text-amber-950 ring-1 ring-amber-200/80'
                                  : 'bg-violet-500 text-violet-950 ring-1 ring-violet-200/80'
                            : cyan
                              ? 'text-cyan-100 hover:bg-cyan-950/45'
                              : amber
                                ? 'text-amber-100 hover:bg-amber-950/40'
                                : 'text-violet-100 hover:bg-violet-950/45'
                    }`}
                >
                    {short}
                </button>
            );
        }

        const toneRing = isStrategic
            ? 'ring-cyan-300/75'
            : isPlayful
              ? 'ring-amber-300/75'
              : 'ring-violet-300/75';
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
        const shell = `relative min-w-0 overflow-hidden rounded-lg border-2 ${toneBorder} shadow-[0_10px_28px_-14px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
            active
                ? `z-[1] scale-[1.02] ring-2 ${toneRing} brightness-[1.05]`
                : 'opacity-90 hover:opacity-100 hover:brightness-110 hover:shadow-[0_14px_34px_-12px_rgba(0,0,0,0.75)] active:scale-[0.99]'
        }`;
        const hCls = 'h-[3.15rem] sm:h-14 md:h-[3.65rem]';
        return (
            <button
                type="button"
                key={target}
                onClick={() => tryEnter(target)}
                aria-pressed={active}
                aria-label={`${arenaTitle[target]}으로 이동`}
                title={arenaTitle[target]}
                className={`${shell} ${hCls}`}
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

    return { tryEnter, tabBtn };
}

/** 전략 / 페어 / 놀이 경기장 전환 — 가운데 패널 위 등에 단독 배치 */
export const ArenaLobbyArenaSwitcherPanel: React.FC<SharedNavProps> = (props) => {
    const { className } = props;
    const { tabBtn } = buildArenaLobbyNavHandlers(props);

    return (
        <div
            className={`w-full shrink-0 rounded-xl border border-amber-500/40 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_28px_-16px_rgba(0,0,0,0.65)] ring-1 ring-white/10 sm:p-1.5 ${className ?? ''}`}
            role="tablist"
            aria-label="경기장 전환"
        >
            <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2">
                {tabBtn('strategic')}
                {tabBtn('pair')}
                {tabBtn('playful')}
            </div>
        </div>
    );
};

/** 뒤로가기 + 현재 경기장 제목. `embeddedArenaSwitcher`가 있으면 전략/페어/놀이 탭을 타이틀 오른쪽 한 줄에 둔다. */
export const ArenaLobbyNavTitleBar: React.FC<TitleBarProps> = ({
    kind,
    onBackToProfile,
    className,
    titleHeadingClass,
    embeddedArenaSwitcher,
}) => {
    const embeddedHandlers = embeddedArenaSwitcher
        ? buildArenaLobbyNavHandlers({
              kind,
              currentUser: embeddedArenaSwitcher.currentUser,
              arenaEntranceFromServer: embeddedArenaSwitcher.arenaEntranceFromServer,
              arenaEntranceAvailability: embeddedArenaSwitcher.arenaEntranceAvailability,
              onSelectArena: embeddedArenaSwitcher.onSelectArena,
              tabDensity: 'compact',
          })
        : null;

    const titleStripChrome =
        kind === 'playful'
            ? 'border-amber-400/45 bg-black/20'
            : kind === 'pair'
              ? 'border-violet-400/50 bg-violet-950/20'
              : 'border-cyan-400/45 bg-black/25';

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
                    <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
                <h1 className={`min-w-0 flex-1 truncate ${titleHeadingClass}`}>{arenaTitle[kind]}</h1>
                {embeddedHandlers ? (
                    <div
                        className="flex max-w-[52%] shrink-0 items-stretch gap-0.5 rounded-lg border border-amber-500/35 bg-gradient-to-b from-zinc-900/90 via-zinc-950/90 to-black/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/8 sm:max-w-[50%] sm:gap-1 sm:p-1"
                        role="tablist"
                        aria-label="경기장 전환"
                    >
                        {embeddedHandlers.tabBtn('strategic')}
                        {embeddedHandlers.tabBtn('pair')}
                        {embeddedHandlers.tabBtn('playful')}
                    </div>
                ) : null}
            </div>
        </div>
    );
};
