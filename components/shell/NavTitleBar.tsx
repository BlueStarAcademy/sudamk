import { useTranslation } from 'react-i18next';
import React from 'react';

type NavTitleBarProps = {
    title: string;
    onBack: () => void;
    /** 제목 바로 옆(타이틀 행 내) */
    titleTrailing?: React.ReactNode;
    titleHeadingClass?: string;
    className?: string;
    /** 경기장 톤 등 — 기본 앰버 */
    chromeClass?: string;
    iconUrl?: string;
    iconEmoji?: string;
    /** true면 외곽 border·rounded를 부모에 맡김 (퀵 유틸 패널 헤더) */
    flush?: boolean;
};

const DEFAULT_CHROME = 'border-amber-400/45 bg-black/20';

/** 뒤로가기 + 제목 스트립 (경기장·퀵 유틸 패널 공통) */
export const NavTitleBar: React.FC<NavTitleBarProps> = ({
    title,
    onBack,
    titleTrailing,
    titleHeadingClass = 'text-base font-bold text-amber-100 sm:text-lg',
    className,
    chromeClass = DEFAULT_CHROME,
    iconUrl,
    iconEmoji,
    flush = false,
}) => {
    const { t } = useTranslation('common');
    return (
    <div className={className ?? ''}>
        <div
            className={`flex w-full min-w-0 shrink-0 items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:gap-2 ${
                flush
                    ? `rounded-lg border px-1.5 py-1 sm:px-2 sm:py-1.5 ${chromeClass}`
                    : `rounded-xl border p-1.5 sm:p-2 ${chromeClass}`
            }`}
        >
            <button
                type="button"
                onClick={onBack}
                className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                aria-label={t('backAria')}
            >
                <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
            </button>
            {(iconUrl || iconEmoji) && (
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/35 shadow-inner sm:h-10 sm:w-10"
                    aria-hidden
                >
                    {iconUrl ? (
                        <img src={iconUrl} alt="" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
                    ) : (
                        <span className="text-lg sm:text-xl">{iconEmoji}</span>
                    )}
                </div>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <h1 className={`min-w-0 truncate ${titleHeadingClass}`}>{title}</h1>
                {titleTrailing}
            </div>
        </div>
    </div>
);
};

export default NavTitleBar;
