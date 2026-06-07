/** PC 설계 캔버스 `#sudamr-modal-root` 또는 `document.body` */
export function getSudamrModalPortalTarget(preferDesignCanvas: boolean): HTMLElement {
    if (typeof document === 'undefined') {
        throw new Error('getSudamrModalPortalTarget requires document');
    }
    if (preferDesignCanvas) {
        return document.getElementById('sudamr-modal-root') ?? document.body;
    }
    return document.body;
}
