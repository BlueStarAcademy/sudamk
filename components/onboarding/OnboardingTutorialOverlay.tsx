import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import {
    isOnboardingTutorialActive,
    ONBOARDING_TUTORIAL_STEP_COPY,
    ONBOARDING_PHASE_0_PROFILE_SUBSTEPS,
    ONBOARDING_PHASE_5_PREGAME_SUBSTEP_COPY,
    ONBOARDING_PHASE_6_INGAME_SUBSTEP_COPY,
    ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY,
    ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY,
    ONBOARDING_PREGAME_DESC_STEP_EVENT,
    ONBOARDING_INGAME_SP_STEP_EVENT,
    ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT,
    ONBOARDING_TUTORIAL_PROFILE_INTRO_TITLE,
    ONBOARDING_PHASE_COMPLETE,
    ONBOARDING_LAST_TUTORIAL_PHASE,
    canAdvanceOnboardingTutorialPhase,
    resolveOnboardingSpotlightTarget,
    ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_MOBILE,
    ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_PC,
    ONBOARDING_PHASE_7_SP_RESULT_MODAL_SUBSTEP_COPY,
    type OnboardingSpotlightTargetId,
} from '../../shared/constants/onboardingTutorial.js';
import {
    getOnboardingBagTutorialStep,
    setOnboardingBagTutorialStep,
    subscribeOnboardingBagTutorialStep,
} from '../../utils/onboardingBagTutorialStep.js';
import OnboardingTutorialCompleteModal from './OnboardingTutorialCompleteModal.js';
import {
    clearPhase8TrainingTutorialStep,
    getPhase8TrainingTutorialStep,
    setPhase8TrainingTutorialStep,
    subscribePhase8TrainingTutorialStep,
} from '../../utils/phase8TrainingTutorialStep.js';

const ONBOARDING_RING_CLASS = 'onboarding-spotlight-ring';

type HoleFraction = { top: number; left: number; right: number; bottom: number };

function measureHoleFraction(targetId: OnboardingSpotlightTargetId, root: HTMLElement): HoleFraction | null {
    const el = document.querySelector(`[data-onboarding-target="${targetId}"]`) as HTMLElement | null;
    if (!el || !el.isConnected) return null;
    const rr = root.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const pad = 10;
    const x1 = Math.max(0, er.left - rr.left - pad);
    const y1 = Math.max(0, er.top - rr.top - pad);
    const x2 = Math.min(rr.width, er.right - rr.left + pad);
    const y2 = Math.min(rr.height, er.bottom - rr.top + pad);
    if (x2 <= x1 + 2 || y2 <= y1 + 2) return null;
    return {
        left: (x1 / rr.width) * 100,
        top: (y1 / rr.height) * 100,
        right: 100 - (x2 / rr.width) * 100,
        bottom: 100 - (y2 / rr.height) * 100,
    };
}

/**
 * 신규 온보딩: 반투명 마스크 + 타깃 구멍(스포트라이트) + 하단 설명.
 * `#sudamr-onboarding-root`는 `#sudamr-modal-root`(z-60)보다 위에 두어 경기 설명 튜토리얼이 모달 위에서 안내된다.
 */
const OnboardingTutorialOverlay: React.FC = () => {
    const { currentUserWithStatus, handlers, currentRoute } = useAppContext();
    const isHandheld = useIsHandheldDevice();
    const { isNativeMobile } = useNativeMobileShell();
    const [busy, setBusy] = useState(false);
    const [hole, setHole] = useState<HoleFraction | null>(null);
    const phase1LobbyAdvanceLock = useRef(false);
    const phase4GameEnterAdvanceLock = useRef(false);
    const [phase0ProfileSubIndex, setPhase0ProfileSubIndex] = useState(0);
    const [phase5GameDescSubStep, setPhase5GameDescSubStep] = useState(0);
    const [phase6IngameSubStep, setPhase6IngameSubStep] = useState(0);
    const [phase6Intro1ResultReadAck, setPhase6Intro1ResultReadAck] = useState(false);
    const [intro1DemoArrow, setIntro1DemoArrow] = useState<{ leftPct: number; topPct: number; rotation: number } | null>(null);
    const [phase8TrainingSubStep, setPhase8TrainingSubStep] = useState(0);
    const [phase9BagSubStep, setPhase9BagSubStep] = useState(0);
    const [tutorialCompleteRewards, setTutorialCompleteRewards] = useState<{ gold: number; diamonds: number } | null>(
        null,
    );
    const prevOnboardingPhaseRef = useRef<number | null>(null);
    const phase8HomeAdvanceLock = useRef(false);

    const active = isOnboardingTutorialActive(currentUserWithStatus);
    const phase = currentUserWithStatus?.onboardingTutorialPhase ?? 0;
    /** 입문-1 승리 직후(phase 6) 결과 모달 읽기 안내 */
    const intro1WinTutorialContext =
        phase === 6 &&
        phase6IngameSubStep >= 3 &&
        currentRoute.view === 'game';
    const spResultTutorialStep = currentUserWithStatus?.onboardingSpResultTutorialStep;
    const trainingMission1Started = Boolean(
        (currentUserWithStatus as { singlePlayerMissions?: Record<string, { isStarted?: boolean }> } | null)
            ?.singlePlayerMissions?.mission_attendance?.isStarted,
    );

    const copy = useMemo(() => ONBOARDING_TUTORIAL_STEP_COPY[phase], [phase]);

    useEffect(() => {
        if (phase !== 0) setPhase0ProfileSubIndex(0);
    }, [phase]);

    useEffect(() => {
        if (phase !== 5) setPhase5GameDescSubStep(0);
    }, [phase]);

    useEffect(() => {
        if (phase !== 6) setPhase6IngameSubStep(0);
    }, [phase]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (active && phase === 5) {
            window.dispatchEvent(new CustomEvent(ONBOARDING_PREGAME_DESC_STEP_EVENT, { detail: phase5GameDescSubStep }));
        } else {
            window.dispatchEvent(new CustomEvent(ONBOARDING_PREGAME_DESC_STEP_EVENT, { detail: -1 }));
        }
    }, [active, phase, phase5GameDescSubStep]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (active && phase === 6) {
            window.dispatchEvent(new CustomEvent(ONBOARDING_INGAME_SP_STEP_EVENT, { detail: phase6IngameSubStep }));
        } else {
            window.dispatchEvent(new CustomEvent(ONBOARDING_INGAME_SP_STEP_EVENT, { detail: -1 }));
        }
    }, [active, phase, phase6IngameSubStep]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onDemoDone = () => setPhase6IngameSubStep(3);
        window.addEventListener(ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT, onDemoDone);
        return () => window.removeEventListener(ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT, onDemoDone);
    }, []);

    useEffect(() => {
        if (!intro1WinTutorialContext) setPhase6Intro1ResultReadAck(false);
    }, [intro1WinTutorialContext]);

    useEffect(() => subscribePhase8TrainingTutorialStep(() => setPhase8TrainingSubStep(getPhase8TrainingTutorialStep())), []);

    useEffect(() => subscribeOnboardingBagTutorialStep(() => setPhase9BagSubStep(getOnboardingBagTutorialStep())), []);

    useEffect(() => {
        if (phase === 8) {
            setPhase8TrainingSubStep(getPhase8TrainingTutorialStep());
        }
        if (phase === 9) {
            setPhase9BagSubStep(getOnboardingBagTutorialStep());
        }
    }, [phase]);

    useEffect(() => {
        const prev = prevOnboardingPhaseRef.current;
        prevOnboardingPhaseRef.current = phase;
        if (phase === 8 && prev !== null && prev !== 8) {
            setPhase8TrainingTutorialStep(0);
            setPhase8TrainingSubStep(0);
        }
        if (phase === 9 && prev !== null && prev !== 9) {
            setOnboardingBagTutorialStep(0);
            setPhase9BagSubStep(0);
        }
    }, [phase]);

    useEffect(() => {
        if (phase !== 8 || !active) return;
        if (!trainingMission1Started) return;
        const s = getPhase8TrainingTutorialStep();
        if (s < 2) {
            setPhase8TrainingTutorialStep(2);
            setPhase8TrainingSubStep(2);
        }
    }, [phase, active, trainingMission1Started]);

    useEffect(() => {
        if (phase === 9) {
            clearPhase8TrainingTutorialStep();
        }
    }, [phase]);

    useEffect(() => {
        if (!active || !handlers?.handleAction || !currentUserWithStatus) return;
        if (phase !== 8) return;
        if (getPhase8TrainingTutorialStep() !== 3) return;
        if (currentRoute.view !== 'profile') return;
        if (phase8HomeAdvanceLock.current) return;
        phase8HomeAdvanceLock.current = true;
        void (async () => {
            try {
                if (!canAdvanceOnboardingTutorialPhase(currentUserWithStatus, 9)) return;
                await handlers.handleAction({ type: 'ADVANCE_ONBOARDING_TUTORIAL', payload: { phase: 9 } });
                clearPhase8TrainingTutorialStep();
            } finally {
                phase8HomeAdvanceLock.current = false;
            }
        })();
    }, [active, phase, currentRoute.view, currentUserWithStatus, handlers]);

    const spotlightId = useMemo(() => {
        if (!active || !copy) return null;
        if (intro1WinTutorialContext) return 'onboarding-sp-summary-modal' as OnboardingSpotlightTargetId;
        if (phase === 7 && currentRoute.view === 'game' && typeof spResultTutorialStep === 'number') {
            return resolveOnboardingSpotlightTarget(7, {
                isNativeMobile,
                spResultTutorialStep,
            });
        }
        return resolveOnboardingSpotlightTarget(phase, {
            isNativeMobile,
            phase5GameDescSubStep,
            phase6IngameSubStep,
            phase8TrainingSubStep: phase === 8 ? phase8TrainingSubStep : 0,
            phase9BagSubStep: phase === 9 ? phase9BagSubStep : 0,
        });
    }, [
        active,
        copy,
        phase,
        isNativeMobile,
        phase5GameDescSubStep,
        phase6IngameSubStep,
        phase8TrainingSubStep,
        phase9BagSubStep,
        currentRoute.view,
        intro1WinTutorialContext,
        spResultTutorialStep,
    ]);

    /** phase 6: 0~1은 마스크+스포트라이트, 2~는 판 조작 유지(살짝만 어둡게). 승리 후 결과 모달 구간엔 결과 모달 스포트라이트라 판은 막음 */
    const passThroughLayer = phase === 6 && phase6IngameSubStep >= 2 && !intro1WinTutorialContext;

    const onAdvanceClamped = useCallback(async () => {
        if (!currentUserWithStatus || !handlers?.handleAction) return;
        if (phase >= ONBOARDING_LAST_TUTORIAL_PHASE) return;
        const target = phase + 1;
        if (phase < ONBOARDING_LAST_TUTORIAL_PHASE && !canAdvanceOnboardingTutorialPhase(currentUserWithStatus, target)) {
            return;
        }
        setBusy(true);
        try {
            await handlers.handleAction({ type: 'ADVANCE_ONBOARDING_TUTORIAL', payload: { phase: target } });
        } finally {
            setBusy(false);
        }
    }, [currentUserWithStatus, handlers, phase]);

    const onPrimaryTutorial = useCallback(async () => {
        if (phase === 14 && handlers?.handleAction) {
            setBusy(true);
            try {
                const res = (await handlers.handleAction({ type: 'FINISH_ONBOARDING_TUTORIAL_WITH_REWARD' })) as
                    | { clientResponse?: { onboardingTutorialCompletionRewards?: { gold?: number; diamonds?: number } } }
                    | undefined;
                const rw = res?.clientResponse?.onboardingTutorialCompletionRewards;
                setTutorialCompleteRewards({
                    gold: typeof rw?.gold === 'number' ? rw.gold : 0,
                    diamonds: typeof rw?.diamonds === 'number' ? rw.diamonds : 0,
                });
            } finally {
                setBusy(false);
            }
            return;
        }
        if (phase === 9 && phase9BagSubStep === 3) {
            setOnboardingBagTutorialStep(4);
            setPhase9BagSubStep(4);
            return;
        }
        if (phase === 0 && phase0ProfileSubIndex === 0) {
            setPhase0ProfileSubIndex(1);
            return;
        }
        if (phase === 5 && phase5GameDescSubStep < 2) {
            setPhase5GameDescSubStep((s) => s + 1);
            return;
        }
        if (phase === 6 && phase6IngameSubStep < 2) {
            setPhase6IngameSubStep((s) => s + 1);
            return;
        }
        if (phase === 6 && intro1WinTutorialContext && !phase6Intro1ResultReadAck) {
            await onAdvanceClamped();
            return;
        }
        if (phase === 7 && currentRoute.view === 'game' && spResultTutorialStep === 0 && handlers?.handleAction) {
            setBusy(true);
            try {
                await handlers.handleAction({ type: 'ACK_ONBOARDING_INTRO1_RESULT_ITEM_MODAL' });
            } finally {
                setBusy(false);
            }
            return;
        }
        if (phase === 8) {
            const s = getPhase8TrainingTutorialStep();
            if (s === 0) {
                setPhase8TrainingTutorialStep(1);
                setPhase8TrainingSubStep(1);
                return;
            }
            if (s === 2) {
                setPhase8TrainingTutorialStep(3);
                setPhase8TrainingSubStep(3);
                return;
            }
            return;
        }
        await onAdvanceClamped();
    }, [
        phase,
        phase9BagSubStep,
        phase0ProfileSubIndex,
        phase5GameDescSubStep,
        phase6IngameSubStep,
        phase6Intro1ResultReadAck,
        intro1WinTutorialContext,
        spResultTutorialStep,
        currentRoute.view,
        handlers,
        onAdvanceClamped,
    ]);

    /** 1단계: 「다음」 없이 바둑학원(싱글) 화면 진입 시 2단계로 진행 */
    useEffect(() => {
        if (phase !== 1) {
            phase1LobbyAdvanceLock.current = false;
            return;
        }
        if (!active || currentRoute.view !== 'singleplayer') return;
        if (!currentUserWithStatus || !handlers?.handleAction) return;
        const target = 2;
        if (!canAdvanceOnboardingTutorialPhase(currentUserWithStatus, target)) return;
        if (phase1LobbyAdvanceLock.current) return;
        phase1LobbyAdvanceLock.current = true;
        void handlers
            .handleAction({ type: 'ADVANCE_ONBOARDING_TUTORIAL', payload: { phase: target } })
            .catch(() => {
                phase1LobbyAdvanceLock.current = false;
            });
    }, [active, phase, currentRoute.view, currentUserWithStatus, handlers]);

    /** 4단계: 「다음」 없이 첫 스테이지 입장(게임 화면) 시 5단계로 진행 */
    useEffect(() => {
        if (phase !== 4) {
            phase4GameEnterAdvanceLock.current = false;
            return;
        }
        if (!active || currentRoute.view !== 'game') return;
        if (!currentUserWithStatus || !handlers?.handleAction) return;
        const target = 5;
        if (!canAdvanceOnboardingTutorialPhase(currentUserWithStatus, target)) return;
        if (phase4GameEnterAdvanceLock.current) return;
        phase4GameEnterAdvanceLock.current = true;
        void handlers
            .handleAction({ type: 'ADVANCE_ONBOARDING_TUTORIAL', payload: { phase: target } })
            .catch(() => {
                phase4GameEnterAdvanceLock.current = false;
            });
    }, [active, phase, currentRoute.view, currentUserWithStatus, handlers]);

    useLayoutEffect(() => {
        if (!active || !copy || passThroughLayer || !spotlightId) {
            setHole(null);
            return;
        }
        const root = document.getElementById('sudamr-onboarding-root');
        if (!root) {
            setHole(null);
            return;
        }
        const run = () => {
            setHole(measureHoleFraction(spotlightId, root));
        };
        run();
        const ro = new ResizeObserver(() => requestAnimationFrame(run));
        ro.observe(root);
        window.addEventListener('resize', run);
        window.addEventListener('scroll', run, true);
        const t = window.setInterval(run, 500);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', run);
            window.removeEventListener('scroll', run, true);
            window.clearInterval(t);
        };
    }, [
        active,
        copy,
        passThroughLayer,
        spotlightId,
        phase,
        phase5GameDescSubStep,
        phase6IngameSubStep,
        phase6Intro1ResultReadAck,
        currentRoute.view,
        intro1WinTutorialContext,
        spResultTutorialStep,
        phase8TrainingSubStep,
        phase9BagSubStep,
    ]);

    useEffect(() => {
        if (!active || passThroughLayer) return;
        const ids: string[] = [];
        if (spotlightId) ids.push(spotlightId);
        if (phase === 9 && phase9BagSubStep === 4) ids.push('onboarding-inv-modal-close');
        const els = ids
            .map((id) => document.querySelector(`[data-onboarding-target="${id}"]`))
            .filter((n): n is HTMLElement => n instanceof HTMLElement);
        if (els.length === 0) return;
        els.forEach((el) => el.classList.add(ONBOARDING_RING_CLASS));
        return () => {
            els.forEach((el) => el.classList.remove(ONBOARDING_RING_CLASS));
        };
    }, [
        active,
        passThroughLayer,
        spotlightId,
        phase,
        phase5GameDescSubStep,
        phase6IngameSubStep,
        phase6Intro1ResultReadAck,
        spResultTutorialStep,
        intro1WinTutorialContext,
        phase8TrainingSubStep,
        phase9BagSubStep,
    ]);

    useLayoutEffect(() => {
        if (!active || phase !== 6 || phase6IngameSubStep !== 2) {
            setIntro1DemoArrow(null);
            return;
        }
        const root = document.getElementById('sudamr-onboarding-root');
        const target = document.querySelector(
            '[data-onboarding-target="onboarding-sp-ingame-demo-point"]',
        ) as HTMLElement | null;
        if (!root || !target || !target.isConnected) {
            setIntro1DemoArrow(null);
            return;
        }
        const run = () => {
            const rr = root.getBoundingClientRect();
            const er = target.getBoundingClientRect();
            if (rr.width < 8 || rr.height < 8) {
                setIntro1DemoArrow(null);
                return;
            }
            const cx = er.left + er.width / 2 - rr.left;
            const cy = er.top + er.height / 2 - rr.top;
            const bx = rr.width / 2;
            const by = rr.height * 0.88;
            const dx = cx - bx;
            const dy = cy - by;
            const rotation = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
            setIntro1DemoArrow({
                leftPct: (cx / rr.width) * 100,
                topPct: (cy / rr.height) * 100,
                rotation,
            });
        };
        run();
        const ro = new ResizeObserver(() => requestAnimationFrame(run));
        ro.observe(root);
        window.addEventListener('resize', run);
        window.addEventListener('scroll', run, true);
        const t = window.setInterval(run, 400);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', run);
            window.removeEventListener('scroll', run, true);
            window.clearInterval(t);
        };
    }, [active, phase, phase6IngameSubStep, currentRoute.view]);

    if (!active || !copy) return null;

    if (phase >= 9 && phase <= 14 && currentRoute.view !== 'profile') {
        return null;
    }

    if (phase === 5 && currentRoute.view !== 'game') {
        return null;
    }
    if (phase === 6 && currentRoute.view !== 'game') {
        return null;
    }
    if (phase === 4 && currentRoute.view === 'game') {
        return null;
    }
    if (phase === 2 && currentRoute.view !== 'singleplayer') {
        return null;
    }
    if (phase === 4 && currentRoute.view !== 'singleplayer') {
        return null;
    }
    if (phase === 8 && currentRoute.view !== 'singleplayer') {
        return null;
    }

    const phase0Slice =
        phase === 0 ? ONBOARDING_PHASE_0_PROFILE_SUBSTEPS[phase0ProfileSubIndex] ?? ONBOARDING_PHASE_0_PROFILE_SUBSTEPS[0] : null;
    const phase5Slice =
        phase === 5
            ? ONBOARDING_PHASE_5_PREGAME_SUBSTEP_COPY[phase5GameDescSubStep] ?? ONBOARDING_PHASE_5_PREGAME_SUBSTEP_COPY[0]
            : null;
    const phase6Slice =
        phase === 6 && phase6IngameSubStep < 3
            ? ONBOARDING_PHASE_6_INGAME_SUBSTEP_COPY[Math.min(phase6IngameSubStep, 2)] ??
              ONBOARDING_PHASE_6_INGAME_SUBSTEP_COPY[0]
            : null;
    const phase7ResultSlice =
        phase === 7 &&
        currentRoute.view === 'game' &&
        typeof spResultTutorialStep === 'number' &&
        spResultTutorialStep >= 0
            ? ONBOARDING_PHASE_7_SP_RESULT_MODAL_SUBSTEP_COPY[spResultTutorialStep]
            : null;
    const phase8Slice =
        phase === 8
            ? ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY[
                  Math.min(phase8TrainingSubStep, ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY.length - 1)
              ] ?? ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY[0]
            : null;
    const phase9Slice =
        phase === 9
            ? ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY[
                  Math.min(phase9BagSubStep, ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY.length - 1)
              ] ?? ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY[0]
            : null;

    const body =
        phase === 0 && phase0Slice
            ? isHandheld
                ? phase0Slice.bodyMobile
                : phase0Slice.bodyPc
            : phase === 5 && phase5Slice
              ? isHandheld
                  ? phase5Slice.bodyMobile
                  : phase5Slice.bodyPc
              : phase === 6 && phase6Slice
                ? isHandheld
                    ? phase6Slice.bodyMobile
                    : phase6Slice.bodyPc
                : phase === 7 && phase7ResultSlice
                  ? isHandheld
                      ? phase7ResultSlice.bodyMobile
                      : phase7ResultSlice.bodyPc
                  : phase === 8 && phase8Slice
                    ? isHandheld
                        ? phase8Slice.bodyMobile
                        : phase8Slice.bodyPc
                    : phase === 9 && phase9Slice
                      ? isHandheld
                          ? phase9Slice.bodyMobile
                          : phase9Slice.bodyPc
                      : isHandheld
                        ? copy.bodyMobile
                        : copy.bodyPc;
    const tutorialTitle =
        phase === 0
            ? ONBOARDING_TUTORIAL_PROFILE_INTRO_TITLE
            : phase === 7 && phase7ResultSlice
              ? phase7ResultSlice.title
              : phase === 8 && phase8Slice
                ? phase8Slice.title
                : phase === 9 && phase9Slice
                  ? phase9Slice.title
                  : copy.title;
    const showPrimary =
        (phase === 6 && phase6IngameSubStep < 2) ||
        (phase === 6 && intro1WinTutorialContext && !phase6Intro1ResultReadAck) ||
        (phase === 7 &&
            currentRoute.view === 'game' &&
            typeof spResultTutorialStep === 'number' &&
            spResultTutorialStep === 0) ||
        (phase === 7 && currentRoute.view !== 'game' && !copy.omitPrimary) ||
        (phase === 8 && (phase8TrainingSubStep === 0 || phase8TrainingSubStep === 2)) ||
        (phase === 9 && phase9BagSubStep === 3) ||
        (phase !== 6 &&
            phase !== 7 &&
            phase !== 8 &&
            phase !== 9 &&
            !copy.omitPrimary &&
            !(phase === 5 && phase5GameDescSubStep >= 2));

    const mount = typeof document !== 'undefined' ? document.getElementById('sudamr-onboarding-root') : null;
    if (!mount) return null;

    const showBlockingMask = !passThroughLayer;
    const useHole = showBlockingMask && spotlightId && hole;

    const layer = (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end overflow-hidden">
            {passThroughLayer && (
                <div className="pointer-events-none absolute inset-0 bg-black/25" aria-hidden />
            )}

            {showBlockingMask && !useHole && (
                <div
                    className="pointer-events-auto absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                    aria-hidden
                />
            )}

            {intro1DemoArrow && phase === 6 && phase6IngameSubStep === 2 && (
                <div
                    className="pointer-events-none absolute z-[4]"
                    style={{
                        left: `${intro1DemoArrow.leftPct}%`,
                        top: `${intro1DemoArrow.topPct}%`,
                        transform: `translate(-50%, calc(-100% - 6px)) rotate(${intro1DemoArrow.rotation}deg)`,
                    }}
                    aria-hidden
                >
                    <div className="onboarding-demo-arrow" />
                </div>
            )}

            {useHole && hole && (
                <>
                    <div
                        className="pointer-events-auto absolute left-0 top-0 w-full bg-black/50 backdrop-blur-[2px]"
                        style={{ height: `${hole.top}%` }}
                        aria-hidden
                    />
                    <div
                        className="pointer-events-auto absolute bottom-0 left-0 w-full bg-black/50 backdrop-blur-[2px]"
                        style={{ height: `${hole.bottom}%` }}
                        aria-hidden
                    />
                    <div
                        className="pointer-events-auto absolute bg-black/50 backdrop-blur-[2px]"
                        style={{
                            top: `${hole.top}%`,
                            left: 0,
                            width: `${hole.left}%`,
                            height: `calc(${100 - hole.top - hole.bottom}%)`,
                        }}
                        aria-hidden
                    />
                    <div
                        className="pointer-events-auto absolute bg-black/50 backdrop-blur-[2px]"
                        style={{
                            top: `${hole.top}%`,
                            right: 0,
                            width: `${hole.right}%`,
                            height: `calc(${100 - hole.top - hole.bottom}%)`,
                        }}
                        aria-hidden
                    />
                </>
            )}

            <div
                className="relative z-[2] flex w-full justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-5 sm:pb-4"
                style={{ marginTop: 'auto' }}
            >
                <div
                    className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/18 bg-slate-950/55 p-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md ring-1 ring-inset ring-white/10 sm:p-5"
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="onboarding-tutorial-title"
                >
                    <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
                        튜토리얼
                    </p>
                    <h2
                        id="onboarding-tutorial-title"
                        className="mt-0.5 text-center text-base font-bold text-stone-50 sm:text-lg"
                    >
                        {tutorialTitle}
                    </h2>
                    {intro1WinTutorialContext && !phase6Intro1ResultReadAck ? (
                        <p className="mt-2 text-left text-sm leading-relaxed text-stone-200/95 sm:text-[15px]">
                            {isHandheld
                                ? ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_MOBILE
                                : ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_PC}
                        </p>
                    ) : (
                        <p className="mt-2 text-left text-sm leading-relaxed text-stone-200/95 sm:text-[15px]">{body}</p>
                    )}
                    {showPrimary && (
                        <div className="mt-3 flex justify-end gap-2 border-t border-white/10 pt-3 sm:mt-4 sm:pt-4">
                            <Button
                                type="button"
                                colorScheme="accent"
                                className="min-h-10 px-5 text-sm font-semibold"
                                disabled={busy}
                                onClick={() => void onPrimaryTutorial()}
                            >
                                {phase >= ONBOARDING_LAST_TUTORIAL_PHASE ? '튜토리얼 종료' : '다음'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {createPortal(layer, mount)}
            {tutorialCompleteRewards && (
                <OnboardingTutorialCompleteModal
                    gold={tutorialCompleteRewards.gold}
                    diamonds={tutorialCompleteRewards.diamonds}
                    onClose={() => setTutorialCompleteRewards(null)}
                />
            )}
        </>
    );
};

export default OnboardingTutorialOverlay;
