/** 수련과제 패널·강화 모달 공통: 메탈릭 그라데이션 + 글로우 (sm:에서 살짝 키움) */
export const PREMIUM_QUEST_BTN = {
    claim:
        'flex-1 flex items-center justify-center !rounded-lg !border !border-emerald-300/55 !bg-gradient-to-b !from-teal-400/95 !via-emerald-700 !to-emerald-950 !px-1.5 !py-1 !text-[11px] !font-bold !leading-tight !text-white !shadow-[0_2px_14px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] hover:!brightness-110 active:!scale-[0.98] disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!grayscale disabled:hover:!brightness-100 transition-all duration-200 sm:!px-2 sm:!py-1.5 sm:!text-xs',
    upgrade:
        'flex-1 flex items-center justify-center !whitespace-nowrap !rounded-lg !border !border-violet-300/50 !bg-gradient-to-b !from-violet-500/95 !via-purple-800 !to-indigo-950 !px-1.5 !py-1 !text-[11px] !font-bold !leading-tight !text-violet-50 !shadow-[0_2px_14px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] hover:!brightness-110 active:!scale-[0.98] disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!grayscale disabled:hover:!brightness-100 transition-all duration-200 sm:!px-2 sm:!py-1.5 sm:!text-xs',
    start:
        'w-full !rounded-lg !border !border-sky-300/50 !bg-gradient-to-b !from-sky-500/95 !via-blue-700 !to-slate-950 !px-1.5 !py-1 !text-[11px] !font-bold !text-sky-50 !shadow-[0_2px_14px_rgba(56,189,248,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:!brightness-110 active:!scale-[0.98] transition-all duration-200 sm:!px-2 sm:!py-1.5 sm:!text-xs',
    claimAll:
        'whitespace-nowrap !rounded-lg !border !border-emerald-300/55 !bg-gradient-to-b !from-teal-500/90 !via-emerald-800 !to-emerald-950 !px-2 !py-1 !text-[11px] !font-bold !text-white !shadow-[0_2px_12px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:!brightness-110 active:!scale-[0.98] disabled:!opacity-50 transition-all duration-200 sm:!px-2.5 sm:!py-1.5 sm:!text-xs',
    /** PC 모달 확인 등: 전폭이 아닌 콘텐츠 폭 + 메탈릭 그라데이션 */
    confirmModal:
        'inline-flex !w-auto max-w-full items-center justify-center !rounded-lg !border !border-amber-300/55 !bg-gradient-to-b !from-amber-500/95 !via-amber-800/95 !to-amber-950 !px-7 !py-2 !text-sm !font-bold !text-amber-50 !shadow-[0_2px_14px_rgba(245,158,11,0.42),inset_0_1px_0_rgba(255,255,255,0.22)] hover:!brightness-110 active:!scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55',
} as const;
