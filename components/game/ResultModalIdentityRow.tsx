import React from 'react';
import {
    RESULT_MODAL_BODY_MOBILE_PX,
    RESULT_MODAL_DESKTOP_PX,
    resultModalFontPx,
} from './resultModalScoreTypography.js';

export function resolveResultModalPortraitPx(
    isMobile: boolean,
    mobileImageScale: number,
    desktopTextScale: number,
): number {
    return isMobile ? Math.round(32 * mobileImageScale) : Math.round(36 * desktopTextScale);
}

export type ResultModalIdentityRowProps = {
    displayName: string;
    level?: number | string | null;
    /** XP 바 표시 시 레벨 텍스트는 바에만 노출 */
    hideLevelLine?: boolean;
    portrait: React.ReactNode;
    xpAside?: React.ReactNode;
    footer?: React.ReactNode;
    isMobile: boolean;
    mobileTextScale: number;
    desktopTextScale?: number;
    /** XP 열 너비를 맞추기 위해 우측 슬롯을 비워 둠 */
    xpColumnReserved?: boolean;
    tone?: 'user' | 'pet';
    variant?: 'card' | 'flat';
};

const CARD_SHELL =
    'rounded-lg border bg-gradient-to-r from-slate-950/80 via-[#15151c] to-slate-950/80 p-1.5 ring-1 ring-inset';

export const ResultModalIdentityRow: React.FC<ResultModalIdentityRowProps> = ({
    displayName,
    level,
    hideLevelLine = false,
    portrait,
    xpAside,
    footer,
    isMobile,
    mobileTextScale,
    desktopTextScale = 1,
    variant = 'card',
    xpColumnReserved = false,
    tone = 'user',
}) => {
    const nicknameStyle: React.CSSProperties = isMobile
        ? { fontSize: resultModalFontPx(RESULT_MODAL_BODY_MOBILE_PX.nickname, mobileTextScale) }
        : { fontSize: resultModalFontPx(RESULT_MODAL_DESKTOP_PX.nickname, desktopTextScale) };
    const levelStyle: React.CSSProperties = isMobile
        ? { fontSize: resultModalFontPx(RESULT_MODAL_BODY_MOBILE_PX.level, mobileTextScale) }
        : { fontSize: resultModalFontPx(RESULT_MODAL_DESKTOP_PX.level, desktopTextScale) };

    const isPetTone = tone === 'pet';
    const borderClass = isPetTone
        ? 'border-fuchsia-500/25 ring-fuchsia-500/10'
        : 'border-amber-500/20 ring-amber-500/10';

    const showLevel =
        !hideLevelLine && level != null && level !== '' && level !== '—' && level !== undefined;

    const useXpColumn = Boolean(xpAside) || xpColumnReserved;

    const body = (
        <>
            <div
                className={`grid min-w-0 items-center gap-x-2 ${
                    useXpColumn
                        ? 'grid-cols-[auto_minmax(0,1fr)_min(52%,11.5rem)]'
                        : 'grid-cols-[auto_minmax(0,1fr)]'
                }`}
            >
                <div className="flex shrink-0 items-center justify-center self-center">{portrait}</div>
                <div className="min-w-0 self-center">
                    <p
                        className="truncate font-bold leading-snug text-white"
                        style={nicknameStyle}
                        title={displayName}
                    >
                        {displayName}
                    </p>
                    {showLevel ? (
                        <p
                            className={`mt-0.5 font-medium leading-none ${isPetTone ? 'text-fuchsia-100/85' : 'text-slate-300'}`}
                            style={levelStyle}
                        >
                            Lv.{level}
                        </p>
                    ) : null}
                </div>
                {xpAside ? (
                    <div className="min-w-0 self-center">{xpAside}</div>
                ) : useXpColumn ? (
                    <div className="min-w-0 self-center" aria-hidden />
                ) : null}
            </div>
            {footer ? <div className="mt-1 w-full border-t border-white/[0.05] pt-1">{footer}</div> : null}
        </>
    );

    if (variant === 'flat') {
        return <div className="min-w-0">{body}</div>;
    }

    return <div className={`${CARD_SHELL} ${borderClass}`}>{body}</div>;
};

export type ResultModalPetPortraitProps = {
    imageSrc: string | null;
    sizePx: number;
    alt?: string;
};

export const ResultModalPetPortrait: React.FC<ResultModalPetPortraitProps> = ({
    imageSrc,
    sizePx,
    alt = '',
}) => (
    <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-fuchsia-500/30 bg-black/40 ring-1 ring-inset ring-fuchsia-400/12"
        style={{ width: sizePx, height: sizePx }}
    >
        {imageSrc ? (
            <img src={imageSrc} alt={alt} className="h-full w-full object-contain p-0.5" loading="lazy" />
        ) : (
            <span className="text-[0.55rem] font-bold text-fuchsia-200/50 sm:text-[0.6rem]">—</span>
        )}
    </div>
);
