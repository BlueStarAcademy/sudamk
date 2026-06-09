import { useAppContext } from './useAppContext.js';
import { useIsHandheldDevice } from './useIsMobileLayout.js';
import { useNativeMobileShell } from './useNativeMobileShell.js';

/** 모바일 로비·길드 등: 타이틀 바 + 구분선 + 닫기(오버레이 버튼 아님) */
export function useMobileModalChrome(): boolean {
    const { usePortraitFirstShell, modalLayerUsesDesignPixels } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);

    if (modalLayerUsesDesignPixels) return false;
    return usePortraitFirstShell || isNativeMobile || isHandheld;
}
