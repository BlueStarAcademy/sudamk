export type PcModalPortalPolicyInput = {
    viewportPortal: boolean;
    autoViewportPortalOnSmallDesktop: boolean;
    appModalLayerUsesDesignPixels: boolean;
    preferInCanvasModalPortal: boolean;
    disableSmallPcViewportPortal: boolean;
    isNativeMobile: boolean;
    isCompactViewport: boolean;
    ingameBoardFrame: boolean;
    isSmallPcViewport: boolean;
    isScrollableDesignFrameCandidate: boolean;
};

export type PcModalPortalPolicyResult = {
    useReadableSmallPcViewportPortal: boolean;
    effectiveViewportPortal: boolean;
    modalLayerUsesDesignPixels: boolean;
};

/**
 * DraggableWindow 포털·설계픽셀 분기 — PC 캔버스 셸에서는 in-canvas modal-root 우선.
 */
export function resolvePcModalPortalPolicy(input: PcModalPortalPolicyInput): PcModalPortalPolicyResult {
    const useReadableSmallPcViewportPortal =
        !input.disableSmallPcViewportPortal &&
        !input.viewportPortal &&
        input.appModalLayerUsesDesignPixels &&
        !input.isNativeMobile &&
        !input.isCompactViewport &&
        (input.autoViewportPortalOnSmallDesktop || input.isSmallPcViewport) &&
        !input.isScrollableDesignFrameCandidate;

    const effectiveViewportPortal =
        input.appModalLayerUsesDesignPixels && input.preferInCanvasModalPortal
            ? input.viewportPortal || useReadableSmallPcViewportPortal
            : input.viewportPortal || useReadableSmallPcViewportPortal || !input.ingameBoardFrame;

    const modalLayerUsesDesignPixels = input.appModalLayerUsesDesignPixels && !effectiveViewportPortal;

    return {
        useReadableSmallPcViewportPortal,
        effectiveViewportPortal,
        modalLayerUsesDesignPixels,
    };
}
