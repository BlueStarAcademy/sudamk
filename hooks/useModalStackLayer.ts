import { useCallback, useId, useLayoutEffect, useState } from 'react';
import {
    bringModalStackEntryToFront,
    isModalStackEntryTop,
    registerModalStackEntry,
    subscribeModalStack,
    unregisterModalStackEntry,
} from '../utils/modalStack.js';

export type UseModalStackLayerOptions = {
    /** false면 스택에 등록하지 않음(조건부 렌더 모달) */
    enabled?: boolean;
    /** z-index 최소값(floor) */
    zIndexFloor?: number;
    /** 마운트 시 AppModalLayer 등에서 최상위로 승격 */
    promoteOnMount?: boolean;
};

/**
 * DraggableWindow 밖의 `createPortal`·fixed 오버레이용 z-index / 최상단 여부.
 */
export function useModalStackLayer(options: UseModalStackLayerOptions = {}) {
    const { enabled = true, zIndexFloor, promoteOnMount = true } = options;
    const entryId = useId();
    const [zIndex, setZIndex] = useState(zIndexFloor ?? 10_000);
    const [isStackTop, setIsStackTop] = useState(false);

    useLayoutEffect(() => {
        if (!enabled) return;
        setZIndex(registerModalStackEntry(entryId, zIndexFloor));
        const syncTop = () => setIsStackTop(isModalStackEntryTop(entryId));
        syncTop();
        const unsub = subscribeModalStack(syncTop);
        return () => {
            unsub();
            unregisterModalStackEntry(entryId);
        };
    }, [enabled, entryId, zIndexFloor]);

    useLayoutEffect(() => {
        if (!enabled || !promoteOnMount) return;
        setZIndex(bringModalStackEntryToFront(entryId, zIndexFloor));
    }, [enabled, promoteOnMount, entryId, zIndexFloor]);

    const bringToFront = useCallback(() => {
        const next = bringModalStackEntryToFront(entryId, zIndexFloor);
        setZIndex(next);
        setIsStackTop(true);
        return next;
    }, [entryId, zIndexFloor]);

    return { zIndex, isStackTop, bringToFront, entryId };
}
