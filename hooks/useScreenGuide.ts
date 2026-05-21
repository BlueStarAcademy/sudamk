import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from './useAppContext.js';
import {
    dismissScreenGuide,
    isScreenGuideDismissed,
    type ScreenGuideId,
} from '../utils/screenGuideDismiss.js';

type UseScreenGuideOptions = {
    /** false면 자동 표시 안 함 (온보딩 등) */
    enabled?: boolean;
    /** 모달을 띄울 조건이 참일 때만 시도 (예: TrainingQuest open) */
    active?: boolean;
};

/**
 * 화면 진입 시 1회성 안내 모달. 「다시 보지 않기」는 localStorage에 저장된다.
 */
export function useScreenGuide(
    guideId: ScreenGuideId,
    options: UseScreenGuideOptions = {},
): {
    isOpen: boolean;
    close: () => void;
    dismissForever: () => void;
} {
    const { settings } = useAppContext();
    const autoShowFromSettings = settings.features.screenGuideModals !== false;
    const { enabled = autoShowFromSettings, active = true } = options;
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setIsOpen(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !active) return;
        if (isScreenGuideDismissed(guideId)) return;
        const t = window.setTimeout(() => setIsOpen(true), 400);
        return () => window.clearTimeout(t);
    }, [guideId, enabled, active, settings.features.screenGuideModals]);

    const close = useCallback(() => setIsOpen(false), []);

    const dismissForever = useCallback(() => {
        dismissScreenGuide(guideId);
        setIsOpen(false);
    }, [guideId]);

    return { isOpen, close, dismissForever };
}
