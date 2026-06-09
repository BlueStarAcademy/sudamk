export type BlacksmithViewerTypography = {
    caption: string;
    body: string;
    bodySemi: string;
    heading: string;
    headingLg: string;
    mono: string;
    empty: string;
};

export type BlacksmithTypographyOptions = {
    /** 모바일 작업 모달(강화·제련·합성 등) — 한 화면에 맞춘 가독성 */
    mobileWork?: boolean;
};

/** PC 대장간 우측 뷰어(넓은 2열) — 모바일·스택 뷰포트 대비 한 단계 큰 본문 */
export function getBlacksmithViewerTypography(
    pcViewer: boolean,
    options?: BlacksmithTypographyOptions,
): BlacksmithViewerTypography {
    if (pcViewer) {
        return {
            caption: 'text-sm leading-snug',
            body: 'text-base leading-snug',
            bodySemi: 'text-base font-semibold leading-snug',
            heading: 'text-base font-bold leading-snug',
            headingLg: 'text-lg font-bold leading-snug',
            mono: 'text-base font-mono tabular-nums leading-snug',
            empty: 'text-lg leading-snug',
        };
    }
    if (options?.mobileWork) {
        return {
            caption: 'text-xs leading-snug',
            body: 'text-sm leading-snug',
            bodySemi: 'text-sm font-semibold leading-snug',
            heading: 'text-sm font-bold leading-snug',
            headingLg: 'text-base font-bold leading-snug',
            mono: 'text-sm font-mono tabular-nums leading-snug',
            empty: 'text-sm leading-snug',
        };
    }
    return {
        caption: 'text-[11px] leading-snug',
        body: 'text-[13px] leading-snug',
        bodySemi: 'text-[13px] font-semibold leading-snug',
        heading: 'text-[13px] font-bold leading-snug',
        headingLg: 'text-sm font-bold leading-snug',
        mono: 'text-[13px] font-mono tabular-nums leading-snug',
        empty: 'text-sm leading-snug',
    };
}

/** 스택(모바일) 작업 패널용 타이포 — pcViewer=false, stackedViewport=true */
export function getBlacksmithMobileWorkTypography(): BlacksmithViewerTypography {
    return getBlacksmithViewerTypography(false, { mobileWork: true });
}

/** 모바일 작업 패널 공통 레이아웃 */
export const BLACKSMITH_MOBILE_WORK_ROOT_CLASS =
    'flex min-h-0 w-full max-w-lg flex-1 flex-col items-stretch justify-center gap-2.5 mx-auto';
export const BLACKSMITH_MOBILE_WORK_SECTION_CLASS = 'flex w-full flex-col items-center text-center';
