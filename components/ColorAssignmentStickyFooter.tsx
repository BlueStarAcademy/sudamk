import React from 'react';
import { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';

type Props = {
    hasConfirmed: boolean;
    countdown: number;
    onConfirm: () => void;
    /** 모바일: DraggableWindow가 본문 스크롤과 분리해 하단 고정 */
    variant?: 'sticky' | 'inline';
};

const footerBarClass =
    'flex justify-center border-t border-amber-500/30 bg-gradient-to-t from-zinc-950 via-[#0e0d12] to-zinc-900/90 px-4 py-3 shadow-[0_-12px_40px_-24px_rgba(0,0,0,0.75)] backdrop-blur-[8px] sm:py-3.5';

/**
 * 흑·백 확인 모달 하단 시작 버튼 바.
 */
export const ColorAssignmentStickyFooter: React.FC<Props> = ({
    hasConfirmed,
    countdown,
    onConfirm,
    variant = 'sticky',
}) => {
    const label = hasConfirmed ? '상대방 확인 대기 중…' : `경기 시작 · ${countdown}`;

    return (
        <div
            className={`${variant === 'sticky' ? SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS : 'shrink-0'} ${footerBarClass}`}
        >
            <button
                type="button"
                disabled={hasConfirmed}
                onClick={onConfirm}
                className="group relative w-full max-w-[10.75rem] overflow-hidden rounded-xl border border-violet-200/35 bg-gradient-to-br from-violet-500 via-fuchsia-600 to-indigo-700 px-4 py-2.5 text-[0.8125rem] font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_0_0_rgba(55,48,163,0.55),0_14px_36px_-10px_rgba(139,92,246,0.48)] ring-1 ring-violet-300/25 transition-[transform,box-shadow,filter] duration-200 hover:brightness-[1.08] hover:ring-violet-200/40 active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_0_rgba(55,48,163,0.5)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 sm:max-w-[11.25rem] sm:px-5 sm:text-sm"
            >
                <span
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80"
                    aria-hidden
                />
                <span className="relative z-[1] inline-flex items-center justify-center gap-1">{label}</span>
            </button>
        </div>
    );
};
