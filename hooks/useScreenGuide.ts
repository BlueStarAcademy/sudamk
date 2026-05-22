import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from './useAppContext.js';
import {
    dismissScreenGuide,
    isScreenGuideDismissed,
    syncDismissedScreenGuidesFromUser,
    type ScreenGuideId,
} from '../utils/screenGuideDismiss.js';

type UseScreenGuideOptions = {
    /** false면 자동 표시 안 함 (온보딩 등) */
    enabled?: boolean;
    /** 모달을 띄울 조건이 참일 때만 시도 (예: TrainingQuest open) */
    active?: boolean;
};

/**
 * 화면 진입 시 1회성 안내 모달.
 * 「다시 보지 않기」는 계정별 localStorage + 서버 `dismissedScreenGuides`에 저장되어 재접속 후에도 유지된다.
 */
export function useScreenGuide(
    guideId: ScreenGuideId,
    options: UseScreenGuideOptions = {},
): {
    isOpen: boolean;
    close: () => void;
    dismissForever: () => void;
} {
    const { settings, currentUserWithStatus, handlers } = useAppContext();
    const userId = currentUserWithStatus?.id ?? null;
    const autoShowFromSettings = settings.features.screenGuideModals !== false;
    const { enabled = autoShowFromSettings, active = true } = options;
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setIsOpen(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!userId) return;
        syncDismissedScreenGuidesFromUser(userId, currentUserWithStatus?.dismissedScreenGuides);
    }, [userId, currentUserWithStatus?.dismissedScreenGuides]);

    useEffect(() => {
        if (!enabled || !active) return;
        if (isScreenGuideDismissed(guideId, userId)) return;
        const t = window.setTimeout(() => setIsOpen(true), 400);
        return () => window.clearTimeout(t);
    }, [guideId, enabled, active, userId, settings.features.screenGuideModals]);

    const close = useCallback(() => setIsOpen(false), []);

    const dismissForever = useCallback(() => {
        dismissScreenGuide(guideId, userId);
        setIsOpen(false);
        if (userId) {
            void handlers.handleAction({ type: 'DISMISS_SCREEN_GUIDE', payload: { guideId } });
        }
    }, [guideId, userId, handlers]);

    return { isOpen, close, dismissForever };
}
