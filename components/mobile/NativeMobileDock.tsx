import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { replaceAppHash, APP_HOME_HASH, APP_HOME_ARENA_HASH } from '../../utils/appUtils.js';
import { translateArenaEntranceClosed, translateArenaProgressionBlocked } from '../../shared/i18n/runtimeText.js';
import { mergeArenaEntranceAvailability, type ArenaEntranceKey } from '../../constants/arenaEntrance.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
type DockTab = 'home' | 'arena' | 'tournament' | 'singleplayer' | 'tower' | 'adventure';

type DockItemDef = { tab: DockTab; labelKey: `dock.${DockTab}` };

const DOCK_ITEMS: DockItemDef[] = [
    { tab: 'home', labelKey: 'dock.home' },
    { tab: 'singleplayer', labelKey: 'dock.singleplayer' },
    { tab: 'tower', labelKey: 'dock.tower' },
    { tab: 'arena', labelKey: 'dock.arena' },
    { tab: 'tournament', labelKey: 'dock.tournament' },
    { tab: 'adventure', labelKey: 'dock.adventure' },
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
    const { t } = useTranslation('nav');
    const { currentRoute, arenaEntranceAvailability, arenaEntranceFromServer, currentUser } = useAppContext();
    const mergedArena = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const serverArena = arenaEntranceFromServer;
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
            const tab = currentRoute.params?.tab;
            if (tab === 'arena') return 'arena';
            return 'home';
        }
        if (v === 'waiting' || v === 'lobby' || v === 'pvp' || v === 'ai' || v === 'arena') return 'arena';
        return null;
    }, [currentRoute.view, currentRoute.params?.tab]);

    const alertProgressionBlocked = (key: ArenaEntranceKey) => translateArenaProgressionBlocked(key);

    const alertEntranceClosed = (key: ArenaEntranceKey) => translateArenaEntranceClosed(key);

    const go = (tab: DockTab) => {
        if (isTabBlocked(tab)) {
            if (tab === 'arena') {
                if (!serverArena.strategicLobby && !serverArena.playfulLobby) {
                    window.alert(t('alerts.arenaBothClosed'));
                } else {
                    window.alert(t('alerts.arenaProgression'));
                }
                return;
            }
            if (tab === 'home') return;
            const key = TAB_ARENA_KEY[tab];
            if (key) {
                if (!serverArena[key]) window.alert(alertEntranceClosed(key));
                else window.alert(alertProgressionBlocked(key));
            }
            return;
        }
        switch (tab) {
            case 'home':
                replaceAppHash(APP_HOME_HASH);
                break;
            case 'arena':
                replaceAppHash(APP_HOME_ARENA_HASH);
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
            className="relative z-20 flex w-full shrink-0 justify-center border-t border-color/40 bg-primary/98 px-1 py-0 backdrop-blur-sm"
            aria-label={t('dock.ariaLabel')}
        >
            <div className="w-full rounded-xl border border-amber-500/25 bg-gradient-to-b from-stone-900/85 via-stone-900/75 to-black/70 px-1 py-0 shadow-[0_-4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="grid w-full grid-cols-6 items-stretch gap-px sm:gap-1">
                    {DOCK_ITEMS.map(({ tab, labelKey }) => {
                        const label = t(labelKey);
                        const on = activeTab === tab;
                        const blocked = isTabBlocked(tab);
                        const labelClass =
                            'bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-center text-[10px] font-bold tracking-tight text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)] min-[380px]:text-[11px] sm:text-[12px]';
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => go(tab)}
                                title={blocked ? t('dock.entranceClosedTitle') : label}
                                className={[
                                    'group relative flex h-11 min-h-0 w-full min-w-0 flex-row items-center justify-center overflow-hidden rounded-md border px-px py-0 text-center transition-all duration-200 active:scale-[0.98] sm:h-12 sm:px-0.5',
                                    blocked ? 'opacity-45 cursor-not-allowed' : '',
                                    on
                                        ? 'border-amber-300/70 bg-gradient-to-b from-amber-700/40 via-amber-900/65 to-stone-950/95 text-amber-50 shadow-[0_3px_10px_rgba(251,191,36,0.2),inset_0_1px_0_rgba(255,255,255,0.18)]'
                                        : 'border-stone-500/45 bg-gradient-to-b from-slate-700/80 via-slate-900/88 to-slate-950/95 text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-stone-400/55',
                                ].join(' ')}
                            >
                                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                                <span title={label} className={`relative min-w-0 max-w-full truncate leading-none ${labelClass}`}>
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default NativeMobileDock;
