import React, {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import type { FirstRunGuideAnchorId, FirstRunGuideStep } from '../../shared/utils/firstRunGuide.js';
import {
    FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS,
    FIRST_RUN_WALKTHROUGH_GUIDE_ID,
} from '../../shared/utils/firstRunGuide.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { dismissScreenGuide } from '../../utils/screenGuideDismiss.js';

const WELCOME_ACK_KEY_PREFIX = 'sudamr.firstRunGuide.welcomeAck.v1:';

type Registry = Map<FirstRunGuideAnchorId, HTMLElement>;

export type FirstRunGuideContextValue = {
    version: number;
    register: (id: FirstRunGuideAnchorId, el: HTMLElement | null) => void;
    getElement: (id: FirstRunGuideAnchorId) => HTMLElement | null;
    hatchConfirmOpen: boolean;
    setHatchConfirmOpen: (open: boolean) => void;
    selectedStageId: string | null;
    setSelectedStageId: (id: string | null) => void;
    welcomeAcknowledged: boolean;
    acknowledgeWelcome: () => void;
    skipped: boolean;
    skipWalkthrough: () => void;
    /** 관리자 수순 미리보기 중이면 강제 스텝(데이터·dismiss 변경 없음). */
    sequencePreviewStep: Exclude<FirstRunGuideStep, 'done'> | null;
    advanceSequencePreview: () => void;
    endSequencePreview: () => void;
};

const FirstRunGuideContext = createContext<FirstRunGuideContextValue | null>(null);

function welcomeAckKey(userId: string): string {
    return `${WELCOME_ACK_KEY_PREFIX}${userId}`;
}

function readWelcomeAck(userId: string | null): boolean {
    if (!userId || typeof window === 'undefined') return false;
    try {
        return window.sessionStorage.getItem(welcomeAckKey(userId)) === '1';
    } catch {
        return false;
    }
}

function writeWelcomeAck(userId: string | null): void {
    if (!userId || typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(welcomeAckKey(userId), '1');
    } catch {
        // ignore quota / private mode
    }
}

export const FirstRunGuideProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUserWithStatus, handlers, firstRunGuideResetNonce, firstRunGuidePreviewNonce } = useAppContext();
    const userId = currentUserWithStatus?.id ?? null;
    const registryRef = useRef<Registry>(new Map());
    const [version, setVersion] = useState(0);
    const [hatchConfirmOpen, setHatchConfirmOpen] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [welcomeAcknowledged, setWelcomeAcknowledged] = useState(() => readWelcomeAck(userId));
    const [skipped, setSkipped] = useState(false);
    const [sequencePreviewStep, setSequencePreviewStep] = useState<Exclude<FirstRunGuideStep, 'done'> | null>(
        null,
    );

    useLayoutEffect(() => {
        setWelcomeAcknowledged(readWelcomeAck(userId));
        setSkipped(false);
        setSequencePreviewStep(null);
    }, [userId]);

    useLayoutEffect(() => {
        if (!firstRunGuideResetNonce) return;
        setWelcomeAcknowledged(false);
        setSkipped(false);
        setHatchConfirmOpen(false);
        setSelectedStageId(null);
        setSequencePreviewStep(null);
        if (userId) {
            try {
                sessionStorage.removeItem(welcomeAckKey(userId));
            } catch {
                // ignore
            }
        }
    }, [firstRunGuideResetNonce, userId]);

    useLayoutEffect(() => {
        if (!firstRunGuidePreviewNonce) return;
        setSkipped(false);
        setSequencePreviewStep(FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS[0] ?? null);
    }, [firstRunGuidePreviewNonce]);

    const bump = useCallback(() => {
        setVersion((n) => n + 1);
    }, []);

    const register = useCallback(
        (id: FirstRunGuideAnchorId, el: HTMLElement | null) => {
            const map = registryRef.current;
            if (el) {
                if (map.get(id) === el) return;
                map.set(id, el);
            } else if (map.has(id)) {
                map.delete(id);
            } else {
                return;
            }
            bump();
        },
        [bump],
    );

    const getElement = useCallback((id: FirstRunGuideAnchorId) => {
        return registryRef.current.get(id) ?? null;
    }, []);

    const acknowledgeWelcome = useCallback(() => {
        writeWelcomeAck(userId);
        setWelcomeAcknowledged(true);
    }, [userId]);

    const skipWalkthrough = useCallback(() => {
        setSkipped(true);
        writeWelcomeAck(userId);
        setWelcomeAcknowledged(true);
        if (userId) {
            dismissScreenGuide(FIRST_RUN_WALKTHROUGH_GUIDE_ID, userId);
            dismissScreenGuide('home', userId);
            void handlers.handleAction({
                type: 'DISMISS_SCREEN_GUIDE',
                payload: { guideId: FIRST_RUN_WALKTHROUGH_GUIDE_ID },
            });
        }
    }, [handlers, userId]);

    const advanceSequencePreview = useCallback(() => {
        setSequencePreviewStep((cur) => {
            if (!cur) return null;
            const idx = FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS.indexOf(cur);
            if (idx < 0) return null;
            return FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS[idx + 1] ?? null;
        });
    }, []);

    const endSequencePreview = useCallback(() => {
        setSequencePreviewStep(null);
    }, []);

    const value = useMemo<FirstRunGuideContextValue>(
        () => ({
            version,
            register,
            getElement,
            hatchConfirmOpen,
            setHatchConfirmOpen,
            selectedStageId,
            setSelectedStageId,
            welcomeAcknowledged,
            acknowledgeWelcome,
            skipped,
            skipWalkthrough,
            sequencePreviewStep,
            advanceSequencePreview,
            endSequencePreview,
        }),
        [
            acknowledgeWelcome,
            advanceSequencePreview,
            endSequencePreview,
            getElement,
            hatchConfirmOpen,
            register,
            selectedStageId,
            sequencePreviewStep,
            skipWalkthrough,
            skipped,
            version,
            welcomeAcknowledged,
        ],
    );

    return <FirstRunGuideContext.Provider value={value}>{children}</FirstRunGuideContext.Provider>;
};

export function useFirstRunGuideOptional(): FirstRunGuideContextValue | null {
    return useContext(FirstRunGuideContext);
}

export function useFirstRunGuide(): FirstRunGuideContextValue | null {
    return useContext(FirstRunGuideContext);
}

export function useTutorialAnchor(
    id: FirstRunGuideAnchorId | undefined,
    ref: { readonly current: HTMLElement | null },
): void {
    const ctx = useContext(FirstRunGuideContext);
    const register = ctx?.register;
    useLayoutEffect(() => {
        if (!register || !id) return;
        register(id, ref.current);
        return () => register(id, null);
    }, [register, id, ref]);
}

type TutorialAnchorProps = {
    id: FirstRunGuideAnchorId;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
};

export const TutorialAnchor: React.FC<TutorialAnchorProps> = ({ id, className, style, children }) => {
    const ref = useRef<HTMLDivElement>(null);
    useTutorialAnchor(id, ref);
    return (
        <div ref={ref} className={className ?? 'w-full min-w-0'} style={style} data-tutorial-anchor={id}>
            {children}
        </div>
    );
};
