import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { mergeArenaEntranceAvailability, ARENA_ENTRANCE_CLOSED_MESSAGE, type ArenaEntranceKey } from '../../constants/arenaEntrance.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
type DockTab = 'home' | 'arena' | 'tournament' | 'singleplayer' | 'tower' | 'adventure';

type DockItemDef = { tab: DockTab; label: string; labelLines?: readonly [string, string] };

const DOCK_ITEMS: DockItemDef[] = [
    { tab: 'home', label: '홈' },
    { tab: 'singleplayer', label: '싱글플레이', labelLines: ['싱글', '플레이'] },
    { tab: 'tower', label: '도전의탑' },
    { tab: 'arena', label: '경기장' },
    { tab: 'tournament', label: '챔피언십' },
    { tab: 'adventure', label: '모험' },
];

/**
 * 네이티브 모바일: 광고 바로 위 고정 탭. 프로필 하위(홈·경기장) + 주요 로비 이동.
 */
const TAB_ARENA_KEY: Record<Exclude<DockTab, 'home'>, ArenaEntranceKey | null> = {
    arena: null,
    singleplayer: 'singleplayer',
    tower: 'tower',
    tournament: 'championship',
    adventure: 'adventure',
};

const NativeMobileDock: React.FC = () => {
    const { currentRoute, arenaEntranceAvailability, currentUser } = useAppContext();
    const mergedArena = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const adminBypass = isClientAdmin(currentUser);

    const isTabBlocked = (tab: DockTab): boolean => {
        if (tab === 'home' || adminBypass) return false;
        if (tab === 'arena') return !mergedArena.strategicLobby && !mergedArena.playfulLobby;
        const key = TAB_ARENA_KEY[tab];
        return key ? !mergedArena[key] : false;
    };

    const activeTab = useMemo((): DockTab | null => {
        const v = currentRoute.view;
        if (v === 'tournament') return 'tournament';
        if (v === 'singleplayer') return 'singleplayer';
        if (v === 'tower') return 'tower';
        if (v === 'adventure') return 'adventure';
        if (v === 'profile') {
            const t = currentRoute.params?.tab;
            if (t === 'arena') return 'arena';
            return 'home';
        }
        if (v === 'waiting' || v === 'lobby') return 'arena';
        return null;
    }, [currentRoute.view, currentRoute.params?.tab]);

    const go = (tab: DockTab) => {
        if (isTabBlocked(tab)) {
            if (tab === 'arena') {
                window.alert('전략·놀이 경기장 입장이 모두 닫혀 있습니다.');
                return;
            }
            const key = TAB_ARENA_KEY[tab];
            if (key) window.alert(ARENA_ENTRANCE_CLOSED_MESSAGE[key]);
            return;
        }
        switch (tab) {
            case 'home':
                replaceAppHash('#/profile');
                break;
            case 'arena':
                replaceAppHash('#/profile/arena');
                break;
            case 'tournament':
                replaceAppHash('#/tournament');
                break;
            case 'singleplayer':
                replaceAppHash('#/singleplayer');
                break;
            case 'tower':
                replaceAppHash('#/tower');
                break;
            case 'adventure':
                replaceAppHash('#/adventure');
                break;
            default:
                break;
        }
    };

    return (
        <nav
            className="relative z-20 flex w-full shrink-0 justify-center border-t border-color/40 bg-primary/98 px-1 py-1.5 backdrop-blur-sm"
            aria-label="주요 메뉴"
        >
            <div className="w-full rounded-xl border border-amber-500/25 bg-gradient-to-b from-stone-900/85 via-stone-900/75 to-black/70 p-1 shadow-[0_-4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="grid w-full grid-cols-6 gap-px sm:gap-1">
                    {DOCK_ITEMS.map(({ tab, label, labelLines }) => {
                        const on = activeTab === tab;
                        const blocked = isTabBlocked(tab);
                        const labelClass =
                            'bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-center text-[10px] font-bold tracking-tight text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)] min-[380px]:text-[11px] sm:text-[12px]';
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => go(tab)}
                                title={blocked ? '입장이 닫혀 있습니다' : label}
                                className={[
                                    'group relative flex h-11 min-h-0 w-full min-w-0 flex-row items-center justify-center overflow-hidden rounded-md border px-px py-0.5 text-center transition-all duration-200 active:scale-[0.98] sm:h-12 sm:px-0.5',
                                    blocked ? 'opacity-45 cursor-not-allowed' : '',
                                    on
                                        ? 'border-amber-300/70 bg-gradient-to-b from-amber-700/40 via-amber-900/65 to-stone-950/95 text-amber-50 shadow-[0_3px_10px_rgba(251,191,36,0.2),inset_0_1px_0_rgba(255,255,255,0.18)]'
                                        : 'border-stone-500/45 bg-gradient-to-b from-slate-700/80 via-slate-900/88 to-slate-950/95 text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-stone-400/55',
                                ].join(' ')}
                            >
                                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                                {labelLines ? (
                                    <span
                                        title={label}
                                        className="relative flex min-w-0 max-w-full flex-col items-center justify-center gap-0 leading-tight"
                                    >
                                        <span className={`block max-w-full truncate leading-tight ${labelClass}`}>
                                            {labelLines[0]}
                                        </span>
                                        <span className={`block max-w-full truncate leading-tight ${labelClass}`}>
                                            {labelLines[1]}
                                        </span>
                                    </span>
                                ) : (
                                    <span title={label} className={`relative min-w-0 max-w-full truncate leading-none ${labelClass}`}>
                                        {label}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default NativeMobileDock;
