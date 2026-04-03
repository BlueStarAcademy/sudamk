import { useAppContext } from './useAppContext.js';

/** 좁은 뷰포트 + PC동일 레이아웃 Off → 네이티브 풀뷰포트·슬라이드 UI */
export function useNativeMobileShell() {
    const { isNativeMobile, isNarrowViewport, settings, updatePcLikeMobileLayout } = useAppContext();
    const pcLikeMobileLayout = settings.graphics.pcLikeMobileLayout !== false;
    return { isNativeMobile, isNarrowViewport, pcLikeMobileLayout, updatePcLikeMobileLayout };
}
