/**
 * 온보딩 스포트라이트: 타깃 구멍 밖만 검정 반투명 + 블러 — 구멍 안은 클립으로 레이어가 없어 선명.
 * (공통 클래스: 시각만 통일, clip-path는 별도 style)
 */
export const ONBOARDING_SPOTLIGHT_DIM_LAYER_CLASS =
    'absolute inset-0 bg-black/80 backdrop-blur-xl [transform:translateZ(0)] will-change-[backdrop-filter]';

export type SpotlightHoleFraction = { top: number; left: number; right: number; bottom: number };

/**
 * `polygon(evenodd, …)`는 한 개의 닫힌 다각형만 가능해 “프레임+구멍”이 되지 않음.
 * `path(evenodd, …)`로 바깥 사각형과 안쪽 구멍을 각각 M…Z로 두어 스포트라이트 구멍이 확실히 뚫리게 함.
 */
export function spotlightDimClipPathFromFraction(hole: SpotlightHoleFraction): string {
    const x1 = hole.left;
    const y1 = hole.top;
    const x2 = 100 - hole.right;
    const y2 = 100 - hole.bottom;
    const d = `M 0 0 L 100% 0 L 100% 100% L 0 100% Z M ${x1}% ${y1}% L ${x2}% ${y1}% L ${x2}% ${y2}% L ${x1}% ${y2}% Z`;
    return `path(evenodd, "${d}")`;
}

export function spotlightDimClipPathFromPxRect(r: { top: number; left: number; width: number; height: number }): string {
    const x1 = r.left;
    const y1 = r.top;
    const x2 = r.left + r.width;
    const y2 = r.top + r.height;
    const d = `M 0 0 L 100% 0 L 100% 100% L 0 100% Z M ${x1}px ${y1}px L ${x2}px ${y1}px L ${x2}px ${y2}px L ${x1}px ${y2}px Z`;
    return `path(evenodd, "${d}")`;
}
