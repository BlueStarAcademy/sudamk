export type BlacksmithViewerTypography = {
    caption: string;
    body: string;
    bodySemi: string;
    heading: string;
    headingLg: string;
    mono: string;
    empty: string;
};

/** PC 대장간 우측 뷰어(넓은 2열) — 모바일·스택 뷰포트 대비 한 단계 큰 본문 */
export function getBlacksmithViewerTypography(pcViewer: boolean): BlacksmithViewerTypography {
    if (pcViewer) {
        return {
            caption: 'text-sm leading-snug',
            body: 'text-base leading-snug',
            bodySemi: 'text-base font-semibold leading-snug',
            heading: 'text-base font-bold leading-snug',
            headingLg: 'text-lg font-bold leading-snug',
            mono: 'text-base font-mono leading-snug',
            empty: 'text-lg leading-snug',
        };
    }
    return {
        caption: 'text-[10px] leading-snug',
        body: 'text-xs leading-snug',
        bodySemi: 'text-[11px] font-semibold leading-snug',
        heading: 'text-xs font-bold',
        headingLg: 'text-sm font-bold',
        mono: 'text-xs font-mono leading-snug',
        empty: 'text-sm leading-snug',
    };
}
