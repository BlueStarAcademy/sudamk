import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useAppTranslation.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import {
    PRE_GAME_MODAL_ACCENT_BTN_CLASS,
    PRE_GAME_MODAL_FOOTER_CLASS,
    PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
} from '../game/PreGameDescriptionLayout.js';
import {
    PVE_TUTORIAL_LESSONS,
    type PveTutorialId,
    type PveTutorialStone,
} from '../../shared/constants/pveTutorials.js';
import PveTutorialMiniBoard from './PveTutorialMiniBoard.js';

type Phase = 'demo' | 'practice' | 'done';

type Props = {
    tutorialId: PveTutorialId;
    onComplete: () => void;
    /** 튜토리얼 닫기 → 경기 시작(brief) 모달로 이동 */
    onClose: () => void;
};

const PVE_FOOTER_BTN =
    '!min-h-[2.5rem] !min-w-0 !px-1.5 !py-1.5 !text-[10px] !font-bold !leading-tight !tracking-tight !whitespace-normal sm:!px-3 sm:!text-sm sm:!leading-snug';
const PVE_FOOTER_BTN_SECONDARY = `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} ${PVE_FOOTER_BTN}`;
const PVE_FOOTER_BTN_ACCENT = `${PRE_GAME_MODAL_ACCENT_BTN_CLASS} ${PVE_FOOTER_BTN}`;

const DEMO_STEP_MS = 700;
const DEMO_HOLD_MS = 450;

const EMPTY_TUTORIAL_STONES: PveTutorialStone[] = [];

const PveInteractiveTutorialModal: React.FC<Props> = ({ tutorialId, onComplete, onClose }) => {
    const { t } = useTranslation('game');
    const { modalLayerUsesDesignPixels } = useAppContext();
    const lesson = PVE_TUTORIAL_LESSONS[tutorialId];
    const [phase, setPhase] = useState<Phase>('demo');
    const [demoIndex, setDemoIndex] = useState(0);
    const [practiceIndex, setPracticeIndex] = useState(0);
    const [demoPlaying, setDemoPlaying] = useState(true);
    const [demoEpoch, setDemoEpoch] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const resetDemo = useCallback(() => {
        clearTimer();
        setPhase('demo');
        setDemoIndex(0);
        setPracticeIndex(0);
        setDemoPlaying(true);
        setDemoEpoch((n) => n + 1);
    }, [clearTimer]);

    // tutorialId 변경 시에만 초기화 (mount 포함). resetDemo를 deps에 두지 않아 루프 방지.
    useEffect(() => {
        clearTimer();
        setPhase('demo');
        setDemoIndex(0);
        setPracticeIndex(0);
        setDemoPlaying(true);
        setDemoEpoch(0);
        return () => clearTimer();
    }, [tutorialId, clearTimer]);

    // 데모 자동재생 — 타이머만 사용, 동기 setState 연쇄 금지
    useEffect(() => {
        if (phase !== 'demo' || !demoPlaying || !lesson) return;
        clearTimer();
        const total = lesson.demoPlacements.length;
        if (demoIndex >= total) {
            timerRef.current = setTimeout(() => {
                setDemoPlaying(false);
            }, DEMO_HOLD_MS);
            return () => clearTimer();
        }
        timerRef.current = setTimeout(() => {
            setDemoIndex((i) => i + 1);
        }, DEMO_STEP_MS);
        return () => clearTimer();
    }, [phase, demoPlaying, demoIndex, demoEpoch, lesson, clearTimer]);

    const demoStones: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return EMPTY_TUTORIAL_STONES;
        let stones = [...lesson.initialStones, ...lesson.demoPlacements.slice(0, demoIndex)];
        if (demoIndex >= lesson.demoPlacements.length && lesson.demoCaptureRemovals?.length) {
            const rem = new Set(lesson.demoCaptureRemovals.map((p) => `${p.x},${p.y}`));
            stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
        }
        return stones;
    }, [lesson, demoIndex]);

    const practiceCompleteStones: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return EMPTY_TUTORIAL_STONES;
        let stones = [
            ...(lesson.practiceInitialStones ?? lesson.initialStones),
            ...lesson.practiceTargets.map((p) => ({ ...p, color: 'B' as const })),
        ];
        if (lesson.demoCaptureRemovals?.length) {
            const rem = new Set(lesson.demoCaptureRemovals.map((p) => `${p.x},${p.y}`));
            stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
        }
        return stones;
    }, [lesson]);

    const practiceBase = lesson?.practiceInitialStones ?? lesson?.initialStones ?? EMPTY_TUTORIAL_STONES;
    const practiceStones: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return [];
        const placed = lesson.practiceTargets.slice(0, practiceIndex).map((p) => ({
            ...p,
            color: 'B' as const,
        }));
        let stones: PveTutorialStone[] = [...practiceBase, ...placed];
        if (practiceIndex >= lesson.practiceTargets.length && lesson.demoCaptureRemovals?.length) {
            const rem = new Set(lesson.demoCaptureRemovals.map((p) => `${p.x},${p.y}`));
            stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
        }
        return stones;
    }, [lesson, practiceBase, practiceIndex]);

    if (!lesson) return null;

    const highlight =
        phase === 'demo' && demoPlaying && demoIndex < lesson.demoPlacements.length
            ? lesson.demoPlacements[demoIndex]
            : phase === 'practice' && practiceIndex < lesson.practiceTargets.length
              ? lesson.practiceTargets[practiceIndex]
              : null;

    const handlePracticeClick = (x: number, y: number) => {
        if (phase !== 'practice') return;
        const target = lesson.practiceTargets[practiceIndex];
        if (!target || target.x !== x || target.y !== y) return;
        const next = practiceIndex + 1;
        setPracticeIndex(next);
        if (next >= lesson.practiceTargets.length) {
            setPhase('done');
        }
    };

    const goPractice = () => {
        clearTimer();
        setDemoIndex(lesson.demoPlacements.length);
        setDemoPlaying(false);
        setPhase('practice');
        setPracticeIndex(0);
    };

    const footer = (
        <div className={`${PRE_GAME_MODAL_FOOTER_CLASS} !gap-1.5 !p-2.5 sm:!gap-3 sm:!p-4`}>
            <Button
                type="button"
                colorScheme="none"
                bare
                className={`${PVE_FOOTER_BTN_SECONDARY} flex-1`}
                onClick={onClose}
                cooldownMs={0}
            >
                {t('pveBrief.tutorialSkip')}
            </Button>
            {phase === 'demo' ? (
                <>
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_FOOTER_BTN_SECONDARY} flex-1`}
                        onClick={resetDemo}
                        cooldownMs={0}
                    >
                        {t('pveBrief.tutorialReplayDemo')}
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_FOOTER_BTN_ACCENT} flex-[1.15]`}
                        disabled={demoPlaying}
                        onClick={goPractice}
                        cooldownMs={0}
                    >
                        {t('pveBrief.tutorialPractice')}
                    </Button>
                </>
            ) : phase === 'practice' ? (
                <>
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_FOOTER_BTN_SECONDARY} flex-1`}
                        onClick={resetDemo}
                        cooldownMs={0}
                    >
                        {t('pveBrief.tutorialReplayDemo')}
                    </Button>
                    <span className="flex min-h-[2.5rem] min-w-0 flex-[1.15] items-center justify-center px-1 text-center text-[10px] font-bold leading-tight text-emerald-100/90 sm:text-xs">
                        {t('pveBrief.tutorialPlaceHint')}
                    </span>
                </>
            ) : (
                <>
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_FOOTER_BTN_SECONDARY} flex-1`}
                        onClick={resetDemo}
                        cooldownMs={0}
                    >
                        {t('pveBrief.tutorialReplayDemo')}
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_FOOTER_BTN_ACCENT} flex-[1.15]`}
                        onClick={onComplete}
                        cooldownMs={0}
                    >
                        {t('pveBrief.tutorialDone')}
                    </Button>
                </>
            )}
        </div>
    );

    const body = (
        <div
            className="relative z-[1] w-full max-w-[24rem] overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-[#14201c] via-[#101418] to-[#080a0c] shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-emerald-300/15"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pve-tutorial-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-2xl" aria-hidden />
            <div className="relative space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                <div className="text-center">
                    <h2 id="pve-tutorial-title" className="text-lg font-black text-white sm:text-xl">
                        {t(lesson.titleKey)}
                    </h2>
                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-emerald-50/85">{t(lesson.bodyKey)}</p>
                </div>
                <div className="rounded-xl bg-black px-2.5 py-3 sm:px-3 sm:py-3.5">
                    <PveTutorialMiniBoard
                        boardSize={lesson.boardSize}
                        stones={
                            phase === 'done'
                                ? practiceCompleteStones
                                : phase === 'practice'
                                  ? practiceStones
                                  : demoStones
                        }
                        highlight={highlight}
                        interactive={phase === 'practice'}
                        onCellClick={handlePracticeClick}
                    />
                </div>
                {phase === 'practice' ? (
                    <p className="text-center text-xs font-bold text-emerald-200/90">{t('pveBrief.tutorialPlaceHint')}</p>
                ) : null}
            </div>
            <div className="relative border-t border-white/10 bg-black/35 px-3 py-3">{footer}</div>
        </div>
    );

    const overlayPositionClass = modalLayerUsesDesignPixels
        ? 'absolute inset-0 z-[1]'
        : 'fixed inset-0 z-[60000]';

    const layer = (
        <div
            className={`pointer-events-auto ${overlayPositionClass} flex items-center justify-center bg-black/70 p-3 backdrop-blur-[3px]`}
            role="presentation"
        >
            {body}
        </div>
    );

    if (typeof document === 'undefined') return layer;
    const root = document.getElementById('sudamr-modal-root') || document.body;
    return createPortal(layer, root);
};

export default PveInteractiveTutorialModal;
