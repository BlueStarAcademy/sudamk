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
            className="relative z-20 flex w-full shrink-0 justify-center border-t border-color/40 bg-primary/98 px-0.5 py-0.5 backdrop-blur-sm"
            aria-label="주요 메뉴"
        >
            <div className="w-full rounded-xl border border-amber-500/25 bg-gradient-to-b from-stone-900/85 via-stone-900/75 to-black/70 p-0.5 shadow-[0_-4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="grid w-full grid-cols-6 gap-0.5">
                    {DOCK_ITEMS.map(({ tab, label }) => {
                        const on = activeTab === tab;
                        const compactLabel =
                            tab === 'tournament' || tab === 'singleplayer' || tab === 'tower';
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => go(tab)}
                                className={[
                                    'group relative flex h-9 min-h-0 w-full min-w-0 flex-row items-center justify-center overflow-hidden rounded-md border px-0.5 py-0 text-center transition-all duration-200 active:scale-[0.98] sm:h-10',
                                    on
                                        ? 'border-amber-300/70 bg-gradient-to-b from-amber-700/40 via-amber-900/65 to-stone-950/95 text-amber-50 shadow-[0_3px_10px_rgba(251,191,36,0.2),inset_0_1px_0_rgba(255,255,255,0.18)]'
                                        : 'border-stone-500/45 bg-gradient-to-b from-slate-700/80 via-slate-900/88 to-slate-950/95 text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-stone-400/55',
                                ].join(' ')}
                            >
                                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                                <span
                                    className={[
                                        'relative max-w-full bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-center font-bold leading-tight text-transparent',
                                        'drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]',
                                        compactLabel ? 'text-[10px] tracking-tighter sm:text-[11px]' : 'text-[11px] tracking-tight sm:text-[12px]',
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
