import React, { useEffect, useMemo, useState } from 'react';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, EQUIPMENT_POOL } from '../../constants.js';
import { RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS } from './ResultModalRewardSlot.js';

export type VipPlayRewardSlotState = {
    locked: boolean;
    grantedItem?: { name: string; quantity: number; image?: string };
};

function normalizeRewardImagePath(src: string | undefined | null): string | null {
    if (!src) return null;
    return src.startsWith('/') ? src : `/${src}`;
}

function resolveGrantedImage(name: string, explicit?: string): string | null {
    if (explicit) return normalizeRewardImagePath(explicit);
    const ci = CONSUMABLE_ITEMS.find((c) => c.name === name);
    if (ci?.image) return normalizeRewardImagePath(ci.image);
    const mat = MATERIAL_ITEMS[name];
    if (mat?.image) return normalizeRewardImagePath(mat.image);
    const eq = EQUIPMENT_POOL.find((e) => e.name === name);
    if (eq?.image) return normalizeRewardImagePath(eq.image);
    return null;
}

/** 대국·모험·길드보스 결과: VIP 전용 보상 슬롯(잠금 / 지급 연출) */
export const ResultModalVipRewardSlot: React.FC<{
    slot: VipPlayRewardSlotState;
    compact: boolean;
    onLockedClick?: () => void;
    rouletteActive?: boolean;
}> = ({ slot, compact, onLockedClick, rouletteActive = false }) => {
    const box = compact ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]';
    const imgCls = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5 sm:h-9 sm:w-9'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';

    if (slot.locked) {
        return (
            <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''}`}>
                <button
                    type="button"
                    onClick={onLockedClick}
                    className={`group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-[#2a1538]/95 via-[#1a0f28]/95 to-[#0c0612]/98 p-0 shadow-[0_0_22px_rgba(251,191,36,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-300/25 transition hover:border-amber-400/70 hover:shadow-[0_0_28px_rgba(251,191,36,0.28)] ${box} ${onLockedClick ? 'cursor-pointer' : 'cursor-default'}`}
                    aria-label="VIP 전용 보상 — 상점에서 보상 VIP를 확인하세요"
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.22]"
                        style={{
                            background:
                                'radial-gradient(circle at 30% 20%, rgba(250,204,21,0.45), transparent 42%), radial-gradient(circle at 80% 70%, rgba(168,85,247,0.35), transparent 48%)',
                        }}
                    />
                    <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5">
                        <span
                            className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-amber-200/90 drop-shadow sm:text-[0.62rem]"
                            style={{ textShadow: '0 0 12px rgba(251,191,36,0.35)' }}
                        >
                            VIP
                        </span>
                        <svg className="h-5 w-5 text-amber-100/90 drop-shadow-md sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-7V9a6 6 0 10-12 0v1H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2v-8a2 2 0 00-2-2h-2zm-2 0H8V9a4 4 0 118 0v1z" />
                        </svg>
                        <span className="text-center text-[0.58rem] font-extrabold leading-tight text-amber-50/95 sm:text-[0.62rem]">
                            VIP전용
                        </span>
                    </div>
                </button>
                <span className="max-w-[5.5rem] text-center text-[0.62rem] font-semibold text-amber-200/75 sm:max-w-[6.5rem] sm:text-xs">
                    보상 VIP
                </span>
            </div>
        );
    }

    const g = slot.grantedItem;
    const img = g ? resolveGrantedImage(g.name, g.image) : null;
    const roulettePool = useMemo(() => {
        const fromConsumables = CONSUMABLE_ITEMS
            .map((c) => normalizeRewardImagePath(c.image))
            .filter((v): v is string => !!v)
            .filter((v) => /box|gold|ticket|material|item/i.test(v))
            .slice(0, 8);
        const base = [img, ...fromConsumables, '/images/icon/Gold.png'].filter((v): v is string => !!v);
        return Array.from(new Set(base));
    }, [img]);
    const [rouletteIdx, setRouletteIdx] = useState(0);

    useEffect(() => {
        if (!rouletteActive || roulettePool.length <= 1) return;
        const t = setInterval(() => setRouletteIdx((prev) => (prev + 1) % roulettePool.length), 90);
        return () => clearInterval(t);
    }, [rouletteActive, roulettePool]);

    const rouletteImg = rouletteActive && roulettePool.length > 0 ? roulettePool[rouletteIdx] : img;

    return (
        <div className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''}`}>
            <div
                className={`relative flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-fuchsia-400/55 bg-gradient-to-br from-fuchsia-950/90 via-violet-950/90 to-[#0a0614]/95 p-1 shadow-[0_0_24px_rgba(217,70,239,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-fuchsia-300/30 ${box}`}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                        background:
                            'radial-gradient(circle at 25% 15%, rgba(250,232,255,0.5), transparent 40%), radial-gradient(circle at 90% 80%, rgba(52,211,153,0.25), transparent 45%)',
                    }}
                />
                <span
                    className="relative z-[1] mb-0.5 text-[0.5rem] font-black uppercase tracking-[0.2em] text-fuchsia-100/95"
                    style={{ textShadow: '0 0 10px rgba(232,121,249,0.45)' }}
                >
                    VIP 보상
                </span>
                {g && rouletteImg ? (
                    <div className="relative z-[1] flex flex-col items-center">
                        <img src={rouletteImg} alt="" className={`${imgCls} drop-shadow-[0_0_8px_rgba(250,232,255,0.35)]`} />
                    </div>
                ) : (
                    <div className="relative z-[1] flex flex-col items-center justify-center gap-0.5 px-1 text-center">
                        <span className="text-[0.58rem] font-semibold text-fuchsia-100/80 sm:text-[0.62rem]">이번 전투</span>
                        <span className="text-[0.58rem] font-bold text-slate-300/90 sm:text-[0.62rem]">추가 없음</span>
                    </div>
                )}
            </div>
            {g ? (
                <span className="max-w-[6rem] text-center text-[0.68rem] font-bold leading-tight text-fuchsia-100/95 sm:max-w-[7rem] sm:text-xs">
                    {rouletteActive ? '룰렛 보상 선택 중...' : `${g.name}${g.quantity > 1 ? ` ×${g.quantity}` : ''}`}
                </span>
            ) : (
                <span className="text-center text-[0.62rem] font-semibold text-fuchsia-200/70 sm:text-xs">보상 VIP</span>
            )}
        </div>
    );
};
