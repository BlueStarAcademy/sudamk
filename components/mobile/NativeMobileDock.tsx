import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { replaceAppHash } from '../../utils/appUtils.js';
type DockTab = 'home' | 'ranking' | 'arena' | 'tournament' | 'singleplayer' | 'tower';

const DOCK_ITEMS: { tab: DockTab; label: string }[] = [
    { tab: 'home', label: '홈' },
    { tab: 'ranking', label: '랭킹' },
    { tab: 'arena', label: '경기장' },
    { tab: 'tournament', label: '챔피언십' },
    { tab: 'singleplayer', label: '싱글플레이' },
    { tab: 'tower', label: '도전의 탑' },
];

/**
 * 네이티브 모바일: 광고 바로 위 고정 탭. 프로필 하위(홈·랭킹·경기장) + 주요 로비 이동.
 */
const NativeMobileDock: React.FC = () => {
    const { currentRoute } = useAppContext();

    const activeTab = useMemo((): DockTab | null => {
        const v = currentRoute.view;
        if (v === 'tournament') return 'tournament';
        if (v === 'singleplayer') return 'singleplayer';
        if (v === 'tower') return 'tower';
        if (v === 'profile') {
            const t = currentRoute.params?.tab;
            if (t === 'ranking') return 'ranking';
            if (t === 'arena') return 'arena';
            return 'home';
        }
        if (v === 'waiting' || v === 'lobby') return 'arena';
        return null;
    }, [currentRoute.view, currentRoute.params?.tab]);

    const go = (tab: DockTab) => {
        switch (tab) {
            case 'home':
                replaceAppHash('#/profile');
                break;
            case 'ranking':
                replaceAppHash('#/profile/ranking');
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
            default:
                break;
        }
    };

    return (
        <nav
            className="flex w-full shrink-0 justify-center border-t border-color/40 bg-primary/98 px-1 py-1 backdrop-blur-sm"
            aria-label="주요 메뉴"
        >
            <div className="w-full rounded-2xl border border-amber-500/25 bg-gradient-to-b from-stone-900/85 via-stone-900/75 to-black/70 p-1 shadow-[0_-6px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="grid w-full grid-cols-6 gap-1">
                {DOCK_ITEMS.map(({ tab, label }) => {
                    const on = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => go(tab)}
                            className={[
                                'group relative flex aspect-square w-full min-h-[52px] flex-col items-center justify-center overflow-hidden rounded-xl border text-center transition-all duration-200 active:scale-[0.96] sm:min-h-[58px] sm:rounded-2xl',
                                on
                                    ? 'border-amber-300/70 bg-gradient-to-br from-amber-700/45 via-amber-900/70 to-stone-950/95 text-amber-50 shadow-[0_8px_18px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(255,255,255,0.22)]'
                                    : 'border-stone-500/50 bg-gradient-to-br from-slate-700/85 via-slate-900/90 to-slate-950/95 text-stone-100 shadow-[0_4px_14px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-stone-400/60',
                            ].join(' ')}
                        >
                            <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                            <span
                                className={[
                                    'relative whitespace-nowrap bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-transparent',
                                    'font-extrabold leading-none tracking-tight',
                                    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] [text-shadow:0_0_10px_rgba(251,191,36,0.22)]',
                                    tab === 'tournament' || tab === 'tower' || tab === 'singleplayer'
                                        ? 'text-[15px] tracking-tighter'
                                        : 'text-[18px] tracking-tight',
                                ].join(' ')}
                            >
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
