import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { replaceAppHash } from '../../utils/appUtils.js';
type DockTab = 'home' | 'ranking' | 'arena' | 'tournament' | 'singleplayer' | 'tower';

const DOCK_ITEMS: { tab: DockTab; label: string }[] = [
    { tab: 'home', label: '홈' },
    { tab: 'ranking', label: '랭킹' },
    { tab: 'arena', label: '경기장' },
    { tab: 'tournament', label: '챔피언십' },
    { tab: 'singleplayer', label: '싱글' },
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
            <div className="grid w-full grid-cols-6 gap-1">
                {DOCK_ITEMS.map(({ tab, label }) => {
                    const on = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => go(tab)}
                            className={[
                                'flex min-h-[44px] flex-col items-center justify-center rounded-xl border px-px py-0.5 text-center transition-all duration-200 active:scale-[0.97] sm:min-h-[48px] sm:rounded-2xl sm:px-0.5 sm:py-1',
                                on
                                    ? 'border-amber-400/70 bg-gradient-to-br from-amber-900/35 via-stone-900/80 to-stone-950/95 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]'
                                    : 'border-stone-600/45 bg-gradient-to-br from-slate-800/85 via-slate-900/90 to-slate-950/95 text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-stone-500/55 hover:from-slate-700/90',
                            ].join(' ')}
                        >
                            {tab === 'tower' ? (
                                <>
                                    <span className="text-[9px] font-bold leading-tight tracking-tight">도전의</span>
                                    <span className="text-[9px] font-bold leading-tight tracking-tight">탑</span>
                                </>
                            ) : (
                                <span className="text-[10px] font-bold leading-tight tracking-tight">{label}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default NativeMobileDock;
