import React, { type ReactNode } from 'react';

export type LobbyMatchKindTone = 'cyan' | 'amber' | 'violet' | 'fuchsia';

export type LobbyMatchKindOption<T extends string = string> = {
    value: T;
    label: ReactNode;
    disabled?: boolean;
    tone?: LobbyMatchKindTone;
};

const TONE_ACTIVE: Record<LobbyMatchKindTone, string> = {
    cyan: 'bg-cyan-500 text-cyan-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
    amber: 'bg-amber-500 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
    violet: 'bg-violet-600 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
    fuchsia: 'bg-fuchsia-600 text-fuchsia-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
};

const TONE_IDLE: Record<LobbyMatchKindTone, string> = {
    cyan: 'text-cyan-100 hover:bg-cyan-950/45',
    amber: 'text-amber-100 hover:bg-amber-950/45',
    violet: 'text-violet-100 hover:bg-violet-950/45',
    fuchsia: 'text-fuchsia-100 hover:bg-fuchsia-950/45',
};

const TONE_SHELL: Record<LobbyMatchKindTone, string> = {
    cyan: 'border-cyan-400/30',
    amber: 'border-amber-400/30',
    violet: 'border-violet-500/30',
    fuchsia: 'border-fuchsia-500/30',
};

export type LobbyMatchKindPickerProps<T extends string = string> = {
    options: readonly LobbyMatchKindOption<T>[];
    value: T;
    onChange: (next: T) => void;
    ariaLabel: string;
    /** 설정 영역 제목(「게임 종류」등) */
    title?: string;
    className?: string;
    /**
     * rail: 설정 좌측 세로 버튼(기본)
     * row: 좁은 화면용 가로 세그먼트
     * title: 게임 모드 선택 위 타이틀을 대체하는 큰 탭
     */
    layout?: 'rail' | 'row' | 'title';
    defaultTone?: LobbyMatchKindTone;
};

/**
 * 친선전·AI대전·놀이터 공통 — 방/대결 종류 선택.
 * 설정 패널 좌측에 세로 레일로 두어 UI를 통일한다.
 */
function LobbyMatchKindPicker<T extends string>({
    options,
    value,
    onChange,
    ariaLabel,
    title,
    className,
    layout = 'rail',
    defaultTone = 'cyan',
}: LobbyMatchKindPickerProps<T>) {
    if (options.length <= 1) return null;

    const shellTone = options.find((o) => o.value === value)?.tone ?? defaultTone;

    if (layout === 'title' || layout === 'row') {
        const isTitle = layout === 'title';
        const tabClass = isTitle
            ? 'rounded-lg px-2 py-2 text-center text-sm font-black leading-tight transition sm:px-3 sm:py-2.5 sm:text-base'
            : 'rounded-lg px-1.5 py-1.5 text-center text-[0.7rem] font-extrabold leading-tight whitespace-pre-line transition sm:px-2 sm:py-2 sm:text-sm';
        return (
            <div
                className={`grid min-w-0 gap-1 rounded-xl border bg-black/30 p-1 ${TONE_SHELL[shellTone]} ${
                    options.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'
                } ${isTitle ? 'min-w-0 flex-1' : 'shrink-0'} ${className ?? ''}`}
                role="tablist"
                aria-label={ariaLabel}
            >
                {options.map((opt) => {
                    const tone = opt.tone ?? defaultTone;
                    const sel = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="tab"
                            aria-pressed={sel}
                            aria-disabled={opt.disabled || undefined}
                            disabled={opt.disabled}
                            onClick={() => {
                                if (opt.disabled) return;
                                onChange(opt.value);
                            }}
                            className={`${tabClass} ${
                                sel
                                    ? TONE_ACTIVE[tone]
                                    : opt.disabled
                                      ? 'cursor-not-allowed text-slate-500 opacity-50'
                                      : TONE_IDLE[tone]
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            className={`flex w-[5.25rem] shrink-0 flex-col gap-1.5 sm:w-[6.25rem] ${className ?? ''}`}
            role="tablist"
            aria-label={ariaLabel}
        >
            {title ? (
                <p className="px-0.5 text-center text-[10px] font-extrabold tracking-wide text-slate-300 sm:text-[11px]">
                    {title}
                </p>
            ) : null}
            <div
                className={`flex min-h-0 flex-1 flex-col gap-1 rounded-xl border bg-black/30 p-1 ${TONE_SHELL[shellTone]}`}
            >
                {options.map((opt) => {
                    const tone = opt.tone ?? defaultTone;
                    const sel = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="tab"
                            aria-pressed={sel}
                            aria-disabled={opt.disabled || undefined}
                            disabled={opt.disabled}
                            onClick={() => {
                                if (opt.disabled) return;
                                onChange(opt.value);
                            }}
                            className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-lg px-1 py-2 text-center text-[0.68rem] font-extrabold leading-tight transition sm:min-h-[3rem] sm:text-xs ${
                                sel
                                    ? TONE_ACTIVE[tone]
                                    : opt.disabled
                                      ? 'cursor-not-allowed text-slate-500 opacity-50'
                                      : TONE_IDLE[tone]
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default LobbyMatchKindPicker;
