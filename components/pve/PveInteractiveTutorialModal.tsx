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
    type PveMissileDirection,
    type PveTutorialId,
    type PveTutorialStone,
} from '../../shared/constants/pveTutorials.js';
import { BLACK_BASE_STONE_IMG } from '../../assets.js';
import PveTutorialMiniBoard from './PveTutorialMiniBoard.js';

type Phase = 'demo' | 'practice' | 'done';

/** 미사일 튜토리얼 단계: 아이템 → 돌 → 방향 → 비행 → 따내기 */
type MissileStep = 'item' | 'stone' | 'direction' | 'flight' | 'capture' | 'done';

/** 히든 튜토리얼: 내 히든·따냄 공개 → 상대 히든 → 스캔 */
type HiddenStep =
    | 'item'
    | 'placeHidden'
    | 'awaitWhite'
    | 'whiteElsewhere'
    | 'awaitCapture'
    | 'captureReveal'
    | 'opponentItem'
    | 'opponentPlace'
    | 'scanItem'
    | 'scanClick'
    | 'scanned'
    | 'done';

/** 베이스: 보드 확인 → 다른 색(0.5덤) → 같은 색 입찰 */
type BaseStep =
    | 'showBoard'
    | 'chooseDiff'
    | 'revealDiff'
    | 'chooseSame'
    | 'revealSame'
    | 'bid'
    | 'bidWin'
    | 'done';

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

const DEMO_STEP_MS = 1400;
const DEMO_HOLD_MS = 900;
const DEMO_SCORING_HOLD_MS = 2000;
const MISSILE_DEMO_STEP_MS = 1600;
const MISSILE_FLIGHT_MS = 1100;
const MISSILE_CAPTURE_MS = 1300;
const HIDDEN_DEMO_STEP_MS = 1700;
const HIDDEN_CAPTURE_MS = 1900;
const HIDDEN_SCAN_MS = 1600;
const BASE_DEMO_STEP_MS = 1700;
const BASE_RESULT_MS = 2100;
/** 튜토리얼용 가속 틱 — 실제 1초보다 짧게 10→0 연출 */
const SPEED_TICK_MS = 750;
const SPEED_SCORE_HOLD_MS = 2000;
const SPEED_MAX_SEC = 10;

const EMPTY_TUTORIAL_STONES: PveTutorialStone[] = [];

const dirLabel = (d: PveMissileDirection): string => {
    switch (d) {
        case 'up':
            return '↑';
        case 'down':
            return '↓';
        case 'left':
            return '←';
        case 'right':
            return '→';
    }
};

const nextMissileDemoStep = (s: MissileStep): MissileStep => {
    switch (s) {
        case 'item':
            return 'stone';
        case 'stone':
            return 'direction';
        case 'direction':
            return 'flight';
        case 'flight':
            return 'capture';
        case 'capture':
            return 'done';
        default:
            return 'done';
    }
};

const nextHiddenDemoStep = (s: HiddenStep): HiddenStep => {
    switch (s) {
        case 'item':
            return 'placeHidden';
        case 'placeHidden':
            return 'awaitWhite';
        case 'awaitWhite':
            return 'whiteElsewhere';
        case 'whiteElsewhere':
            return 'awaitCapture';
        case 'awaitCapture':
            return 'captureReveal';
        case 'captureReveal':
            return 'opponentItem';
        case 'opponentItem':
            return 'opponentPlace';
        case 'opponentPlace':
            return 'scanItem';
        case 'scanItem':
            return 'scanClick';
        case 'scanClick':
            return 'scanned';
        case 'scanned':
            return 'done';
        default:
            return 'done';
    }
};

const nextBaseDemoStep = (s: BaseStep): BaseStep => {
    switch (s) {
        case 'showBoard':
            return 'chooseDiff';
        case 'chooseDiff':
            return 'revealDiff';
        case 'revealDiff':
            return 'chooseSame';
        case 'chooseSame':
            return 'revealSame';
        case 'revealSame':
            return 'bid';
        case 'bid':
            return 'bidWin';
        case 'bidWin':
            return 'done';
        default:
            return 'done';
    }
};

const dirButtonClass = (active: boolean, clickable: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-black transition ${
        active
            ? 'animate-pulse border-amber-300 bg-amber-400/90 text-black shadow-[0_0_12px_rgba(251,191,36,0.55)]'
            : 'border-white/20 bg-black/50 text-white/70'
    } ${clickable ? 'cursor-pointer' : 'cursor-default'}`;

const PveInteractiveTutorialModal: React.FC<Props> = ({ tutorialId, onComplete, onClose }) => {
    const { t } = useTranslation('game');
    const { modalLayerUsesDesignPixels } = useAppContext();
    const lesson = PVE_TUTORIAL_LESSONS[tutorialId];
    const missileDemo = lesson?.missileDemo;
    const hiddenDemo = lesson?.hiddenDemo;
    const baseDemo = lesson?.baseDemo;
    const isMissile = Boolean(missileDemo);
    const isHidden = Boolean(hiddenDemo);
    const isBase = Boolean(baseDemo);
    const isSpeed = Boolean(lesson?.speedDemo);
    const skipPractice = Boolean(lesson?.skipPractice) || isSpeed;

    const [phase, setPhase] = useState<Phase>('demo');
    const [demoIndex, setDemoIndex] = useState(0);
    const [practiceIndex, setPracticeIndex] = useState(0);
    const [demoPlaying, setDemoPlaying] = useState(true);
    const [demoEpoch, setDemoEpoch] = useState(0);
    const [missileStep, setMissileStep] = useState<MissileStep>('item');
    const [missileItemArmed, setMissileItemArmed] = useState(false);
    const [hiddenStep, setHiddenStep] = useState<HiddenStep>('item');
    const [hiddenItemArmed, setHiddenItemArmed] = useState(false);
    const [scanItemArmed, setScanItemArmed] = useState(false);
    const [baseStep, setBaseStep] = useState<BaseStep>('showBoard');
    const [baseBidValue, setBaseBidValue] = useState(0);
    const [speedSec, setSpeedSec] = useState(SPEED_MAX_SEC);
    const [oppScore, setOppScore] = useState(0);
    const [speedPenaltyFlash, setSpeedPenaltyFlash] = useState(false);
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
        setMissileStep('item');
        setMissileItemArmed(false);
        setHiddenStep('item');
        setHiddenItemArmed(false);
        setScanItemArmed(false);
        setBaseStep('showBoard');
        setBaseBidValue(0);
        setSpeedSec(SPEED_MAX_SEC);
        setOppScore(0);
        setSpeedPenaltyFlash(false);
        setDemoEpoch((n) => n + 1);
    }, [clearTimer]);

    useEffect(() => {
        clearTimer();
        setPhase('demo');
        setDemoIndex(0);
        setPracticeIndex(0);
        setDemoPlaying(true);
        setMissileStep('item');
        setMissileItemArmed(false);
        setHiddenStep('item');
        setHiddenItemArmed(false);
        setScanItemArmed(false);
        setBaseStep('showBoard');
        setBaseBidValue(0);
        setSpeedSec(SPEED_MAX_SEC);
        setOppScore(0);
        setSpeedPenaltyFlash(false);
        setDemoEpoch(0);
        return () => clearTimer();
    }, [tutorialId, clearTimer]);

    useEffect(() => {
        if (isMissile || isHidden || isBase || isSpeed || phase !== 'demo' || !demoPlaying || !lesson) return;
        clearTimer();
        const total = lesson.demoPlacements.length;
        if (demoIndex >= total) {
            const holdMs = lesson.scoringTerritory?.length ? DEMO_SCORING_HOLD_MS : DEMO_HOLD_MS;
            timerRef.current = setTimeout(() => {
                setDemoPlaying(false);
                if (lesson.skipPractice) setPhase('done');
            }, holdMs);
            return () => clearTimer();
        }
        timerRef.current = setTimeout(() => {
            setDemoIndex((i) => i + 1);
        }, DEMO_STEP_MS);
        return () => clearTimer();
    }, [isMissile, isHidden, isBase, isSpeed, phase, demoPlaying, demoIndex, demoEpoch, lesson, clearTimer]);

    useEffect(() => {
        if (!isMissile || phase !== 'demo' || !demoPlaying || !missileDemo) return;
        clearTimer();
        if (missileStep === 'done') {
            timerRef.current = setTimeout(() => {
                setDemoPlaying(false);
                if (skipPractice) setPhase('done');
            }, DEMO_HOLD_MS);
            return () => clearTimer();
        }
        const delay =
            missileStep === 'flight'
                ? MISSILE_FLIGHT_MS
                : missileStep === 'capture'
                  ? MISSILE_CAPTURE_MS
                  : MISSILE_DEMO_STEP_MS;
        timerRef.current = setTimeout(() => {
            setMissileStep((s) => nextMissileDemoStep(s));
        }, delay);
        return () => clearTimer();
    }, [isMissile, phase, demoPlaying, missileStep, demoEpoch, missileDemo, skipPractice, clearTimer]);

    useEffect(() => {
        if (!isHidden || phase !== 'demo' || !demoPlaying || !hiddenDemo) return;
        clearTimer();
        if (hiddenStep === 'done') {
            timerRef.current = setTimeout(() => {
                setDemoPlaying(false);
                if (skipPractice) setPhase('done');
            }, DEMO_HOLD_MS);
            return () => clearTimer();
        }
        const delay =
            hiddenStep === 'captureReveal'
                ? HIDDEN_CAPTURE_MS
                : hiddenStep === 'scanned'
                  ? HIDDEN_SCAN_MS
                  : HIDDEN_DEMO_STEP_MS;
        timerRef.current = setTimeout(() => {
            setHiddenStep((s) => nextHiddenDemoStep(s));
        }, delay);
        return () => clearTimer();
    }, [isHidden, phase, demoPlaying, hiddenStep, demoEpoch, hiddenDemo, skipPractice, clearTimer]);

    useEffect(() => {
        if (!isBase || phase !== 'demo' || !demoPlaying || !baseDemo) return;
        clearTimer();
        if (baseStep === 'done') {
            timerRef.current = setTimeout(() => {
                setDemoPlaying(false);
                if (skipPractice) setPhase('done');
            }, DEMO_HOLD_MS);
            return () => clearTimer();
        }
        if (baseStep === 'bid') {
            setBaseBidValue(baseDemo.winBid);
        }
        const delay =
            baseStep === 'revealDiff' || baseStep === 'revealSame' || baseStep === 'bidWin'
                ? BASE_RESULT_MS
                : BASE_DEMO_STEP_MS;
        timerRef.current = setTimeout(() => {
            setBaseStep((s) => nextBaseDemoStep(s));
        }, delay);
        return () => clearTimer();
    }, [isBase, phase, demoPlaying, baseStep, demoEpoch, baseDemo, skipPractice, clearTimer]);

    // 스피드: 막대 10→0 후 상대 +1점, 따라놓기 없이 완료
    useEffect(() => {
        if (!isSpeed || phase !== 'demo' || !demoPlaying) return;
        clearTimer();
        if (speedSec > 0) {
            timerRef.current = setTimeout(() => {
                setSpeedSec((s) => s - 1);
            }, SPEED_TICK_MS);
            return () => clearTimer();
        }
        setOppScore((prev) => (prev < 1 ? 1 : prev));
        setSpeedPenaltyFlash(true);
        timerRef.current = setTimeout(() => {
            setDemoPlaying(false);
            setPhase('done');
        }, SPEED_SCORE_HOLD_MS);
        return () => clearTimer();
    }, [isSpeed, phase, demoPlaying, speedSec, demoEpoch, clearTimer]);

    const applyMissileBoard = useCallback(
        (base: PveTutorialStone[], step: MissileStep): PveTutorialStone[] => {
            if (!missileDemo) return base;
            let stones = [...base];
            const fromKey = `${missileDemo.selectStone.x},${missileDemo.selectStone.y}`;
            if (step === 'flight' || step === 'capture' || step === 'done') {
                stones = stones
                    .filter((s) => `${s.x},${s.y}` !== fromKey)
                    .concat([{ ...missileDemo.landing, color: 'B' }]);
            }
            if (step === 'capture' || step === 'done') {
                const rem = new Set(missileDemo.captureRemovals.map((p) => `${p.x},${p.y}`));
                stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
            }
            return stones;
        },
        [missileDemo],
    );

    const applyHiddenBoard = useCallback(
        (base: PveTutorialStone[], step: HiddenStep): PveTutorialStone[] => {
            if (!hiddenDemo) return base;
            let stones = [...base];
            // placeHidden은 빈 칸 하이라이트만 — 착수 후(awaitWhite~)에 돌 표시
            const afterPlace: HiddenStep[] = [
                'awaitWhite',
                'whiteElsewhere',
                'awaitCapture',
                'captureReveal',
                'opponentItem',
                'opponentPlace',
                'scanItem',
                'scanClick',
                'scanned',
                'done',
            ];
            if (afterPlace.includes(step)) {
                stones = [
                    ...stones,
                    {
                        ...hiddenDemo.myHiddenPlace,
                        color: 'B',
                        hiddenMark: true,
                        hiddenMine:
                            step === 'awaitWhite' ||
                            step === 'whiteElsewhere' ||
                            step === 'awaitCapture',
                    },
                ];
            }
            if (
                step === 'whiteElsewhere' ||
                step === 'awaitCapture' ||
                step === 'captureReveal' ||
                step === 'opponentItem' ||
                step === 'opponentPlace' ||
                step === 'scanItem' ||
                step === 'scanClick' ||
                step === 'scanned' ||
                step === 'done'
            ) {
                stones = [...stones, { ...hiddenDemo.whiteElsewhere, color: 'W' }];
            }
            if (
                step === 'captureReveal' ||
                step === 'opponentItem' ||
                step === 'opponentPlace' ||
                step === 'scanItem' ||
                step === 'scanClick' ||
                step === 'scanned' ||
                step === 'done'
            ) {
                stones = stones.map((s) =>
                    s.x === hiddenDemo.myHiddenPlace.x && s.y === hiddenDemo.myHiddenPlace.y
                        ? { x: s.x, y: s.y, color: 'B' as const, hiddenMark: true }
                        : s,
                );
                stones = [...stones, { ...hiddenDemo.capturePlace, color: 'B' }];
                const rem = new Set(hiddenDemo.captureRemovals.map((p) => `${p.x},${p.y}`));
                stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
            }
            if (step === 'scanned' || step === 'done') {
                stones = [
                    ...stones,
                    { ...hiddenDemo.opponentHiddenPlace, color: 'W', scanned: true, hiddenMark: true },
                ];
            }
            return stones;
        },
        [hiddenDemo],
    );

    const demoStones: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return EMPTY_TUTORIAL_STONES;
        if (missileDemo) return applyMissileBoard(lesson.initialStones, missileStep);
        if (hiddenDemo) return applyHiddenBoard(lesson.initialStones, hiddenStep);
        let stones = [...lesson.initialStones, ...lesson.demoPlacements.slice(0, demoIndex)];
        if (demoIndex >= lesson.demoPlacements.length && lesson.demoCaptureRemovals?.length) {
            const rem = new Set(lesson.demoCaptureRemovals.map((p) => `${p.x},${p.y}`));
            stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
        }
        return stones;
    }, [lesson, demoIndex, missileDemo, missileStep, applyMissileBoard, hiddenDemo, hiddenStep, applyHiddenBoard]);

    const practiceSequence: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return EMPTY_TUTORIAL_STONES;
        return lesson.practiceTargets.map((t, i) => {
            const demo = lesson.demoPlacements[i];
            if (demo && demo.x === t.x && demo.y === t.y) return demo;
            return { ...t, color: 'B' as const };
        });
    }, [lesson]);

    const practiceCompleteStones: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return EMPTY_TUTORIAL_STONES;
        if (missileDemo) return applyMissileBoard(lesson.initialStones, 'done');
        if (hiddenDemo) return applyHiddenBoard(lesson.initialStones, 'done');
        if (baseDemo) return lesson.initialStones;
        let stones = [...(lesson.practiceInitialStones ?? lesson.initialStones), ...practiceSequence];
        if (lesson.demoCaptureRemovals?.length) {
            const rem = new Set(lesson.demoCaptureRemovals.map((p) => `${p.x},${p.y}`));
            stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
        }
        return stones;
    }, [lesson, practiceSequence, missileDemo, applyMissileBoard, hiddenDemo, applyHiddenBoard, baseDemo]);

    const practiceBase = lesson?.practiceInitialStones ?? lesson?.initialStones ?? EMPTY_TUTORIAL_STONES;
    const practiceStones: PveTutorialStone[] = useMemo(() => {
        if (!lesson) return [];
        if (missileDemo) return applyMissileBoard(lesson.initialStones, missileStep);
        if (hiddenDemo) return applyHiddenBoard(lesson.initialStones, hiddenStep);
        if (baseDemo) return lesson.initialStones;
        const placed = practiceSequence.slice(0, practiceIndex);
        let stones: PveTutorialStone[] = [...practiceBase, ...placed];
        if (practiceIndex >= practiceSequence.length && lesson.demoCaptureRemovals?.length) {
            const rem = new Set(lesson.demoCaptureRemovals.map((p) => `${p.x},${p.y}`));
            stones = stones.filter((s) => !rem.has(`${s.x},${s.y}`));
        }
        return stones;
    }, [
        lesson,
        practiceBase,
        practiceIndex,
        practiceSequence,
        missileDemo,
        missileStep,
        applyMissileBoard,
        hiddenDemo,
        hiddenStep,
        applyHiddenBoard,
        baseDemo,
    ]);

    if (!lesson) return null;

    const highlight =
        isMissile && missileDemo
            ? (() => {
                  if (phase === 'done') return null;
                  if (missileStep === 'stone') return missileDemo.selectStone;
                  if (missileStep === 'direction' || missileStep === 'flight') return missileDemo.landing;
                  return null;
              })()
            : isHidden && hiddenDemo
              ? (() => {
                    if (phase === 'done') return null;
                    if (hiddenStep === 'placeHidden') return hiddenDemo.myHiddenPlace;
                    if (hiddenStep === 'awaitWhite') return hiddenDemo.whiteElsewhere;
                    if (hiddenStep === 'whiteElsewhere') return hiddenDemo.whiteElsewhere;
                    if (hiddenStep === 'awaitCapture') return hiddenDemo.capturePlace;
                    if (hiddenStep === 'captureReveal') return hiddenDemo.capturePlace;
                    if (hiddenStep === 'opponentPlace') return hiddenDemo.opponentHiddenPlace;
                    if (hiddenStep === 'scanClick') return hiddenDemo.opponentHiddenPlace;
                    return null;
                })()
              : phase === 'demo' && demoPlaying && demoIndex < lesson.demoPlacements.length
                ? lesson.demoPlacements[demoIndex]
                : phase === 'practice' && practiceIndex < practiceSequence.length
                  ? practiceSequence[practiceIndex]
                  : null;

    const placedForTerritory =
        phase === 'done'
            ? Math.max(lesson.demoPlacements.length, practiceSequence.length)
            : phase === 'practice'
              ? practiceIndex
              : demoIndex;

    const visibleTerritory: PveTutorialStone[] | null = (() => {
        if (isMissile || isSpeed || isHidden || isBase) return null;
        const steps = lesson.scoringTerritorySteps;
        if (steps?.length) {
            if (placedForTerritory <= 0) return null;
            return steps[Math.min(placedForTerritory, steps.length) - 1] ?? null;
        }
        if (
            lesson.scoringTerritory?.length &&
            placedForTerritory >= lesson.demoPlacements.length &&
            (phase === 'demo' || phase === 'done' || phase === 'practice')
        ) {
            if (phase === 'demo' && placedForTerritory < lesson.demoPlacements.length) return null;
            if (phase === 'practice' && practiceIndex < practiceSequence.length) return null;
            return lesson.scoringTerritory;
        }
        return null;
    })();

    const showScoringOverlay = Boolean(visibleTerritory?.length);
    const boardStones =
        phase === 'done'
            ? practiceCompleteStones
            : phase === 'practice'
              ? practiceStones
              : demoStones;

    const runMissileFlightThenDone = () => {
        clearTimer();
        setMissileStep('flight');
        timerRef.current = setTimeout(() => {
            setMissileStep('capture');
            timerRef.current = setTimeout(() => {
                setMissileStep('done');
                setPhase('done');
            }, MISSILE_CAPTURE_MS);
        }, MISSILE_FLIGHT_MS);
    };

    const advanceHiddenPracticeAfterCapture = () => {
        clearTimer();
        setHiddenStep('captureReveal');
        timerRef.current = setTimeout(() => {
            setHiddenStep('opponentItem');
            timerRef.current = setTimeout(() => {
                setHiddenStep('opponentPlace');
                timerRef.current = setTimeout(() => {
                    setHiddenStep('scanItem');
                }, HIDDEN_DEMO_STEP_MS);
            }, HIDDEN_DEMO_STEP_MS);
        }, HIDDEN_CAPTURE_MS);
    };

    const handleMissileItemClick = () => {
        if (phase !== 'practice' || !missileDemo) return;
        if (missileStep !== 'item') return;
        setMissileItemArmed(true);
        setMissileStep('stone');
    };

    const handleHiddenItemClick = () => {
        if (phase !== 'practice' || !hiddenDemo) return;
        if (hiddenStep !== 'item') return;
        setHiddenItemArmed(true);
        setHiddenStep('placeHidden');
    };

    const handleScanItemClick = () => {
        if (phase !== 'practice' || !hiddenDemo) return;
        if (hiddenStep !== 'scanItem') return;
        setScanItemArmed(true);
        setHiddenStep('scanClick');
    };

    const handlePracticeClick = (x: number, y: number) => {
        if (phase !== 'practice') return;
        if (missileDemo) {
            if (missileStep === 'stone') {
                if (x !== missileDemo.selectStone.x || y !== missileDemo.selectStone.y) return;
                setMissileStep('direction');
            }
            return;
        }
        if (hiddenDemo) {
            if (hiddenStep === 'placeHidden') {
                if (x !== hiddenDemo.myHiddenPlace.x || y !== hiddenDemo.myHiddenPlace.y) return;
                setHiddenStep('awaitWhite');
                return;
            }
            if (hiddenStep === 'awaitWhite') {
                if (x !== hiddenDemo.whiteElsewhere.x || y !== hiddenDemo.whiteElsewhere.y) return;
                setHiddenStep('awaitCapture');
                return;
            }
            if (hiddenStep === 'awaitCapture') {
                if (x !== hiddenDemo.capturePlace.x || y !== hiddenDemo.capturePlace.y) return;
                advanceHiddenPracticeAfterCapture();
                return;
            }
            if (hiddenStep === 'scanClick') {
                if (x !== hiddenDemo.opponentHiddenPlace.x || y !== hiddenDemo.opponentHiddenPlace.y) return;
                setHiddenStep('scanned');
                timerRef.current = setTimeout(() => {
                    setHiddenStep('done');
                    setPhase('done');
                }, HIDDEN_SCAN_MS);
            }
            return;
        }
        const target = practiceSequence[practiceIndex];
        if (!target || target.x !== x || target.y !== y) return;
        const next = practiceIndex + 1;
        setPracticeIndex(next);
        if (next >= practiceSequence.length) {
            setPhase('done');
        }
    };

    const handleMissileDirClick = (dir: PveMissileDirection) => {
        if (phase !== 'practice' || !missileDemo) return;
        if (missileStep !== 'direction') return;
        if (dir !== missileDemo.direction) return;
        runMissileFlightThenDone();
    };

    const goPractice = () => {
        clearTimer();
        setDemoIndex(lesson.demoPlacements.length);
        setDemoPlaying(false);
        setPhase('practice');
        setPracticeIndex(0);
        setMissileStep('item');
        setMissileItemArmed(false);
        setHiddenStep('item');
        setHiddenItemArmed(false);
        setScanItemArmed(false);
        setBaseStep('chooseDiff');
        setBaseBidValue(0);
    };

    const handleBaseColorPick = (color: 'B' | 'W') => {
        if (phase !== 'practice' || !baseDemo) return;
        if (color !== 'B') return;
        if (baseStep === 'chooseDiff') {
            setBaseStep('revealDiff');
            clearTimer();
            timerRef.current = setTimeout(() => {
                setBaseStep('chooseSame');
            }, BASE_RESULT_MS);
            return;
        }
        if (baseStep === 'chooseSame') {
            setBaseStep('revealSame');
            clearTimer();
            timerRef.current = setTimeout(() => {
                setBaseBidValue(0);
                setBaseStep('bid');
            }, BASE_RESULT_MS);
        }
    };

    const handleBaseBidSubmit = () => {
        if (phase !== 'practice' || !baseDemo || baseStep !== 'bid') return;
        if (baseBidValue < baseDemo.winBid) return;
        clearTimer();
        setBaseStep('bidWin');
        timerRef.current = setTimeout(() => {
            setBaseStep('done');
            setPhase('done');
        }, BASE_RESULT_MS);
    };

    const dirClickable = phase === 'practice' && missileStep === 'direction';
    const dirHighlightActive =
        (phase === 'demo' && demoPlaying && (missileStep === 'direction' || missileStep === 'flight')) ||
        dirClickable;

    const showMissilePad =
        isMissile &&
        missileDemo &&
        ((phase === 'demo' &&
            (missileStep === 'direction' ||
                missileStep === 'flight' ||
                missileStep === 'capture' ||
                missileStep === 'done')) ||
            (phase === 'practice' &&
                (missileStep === 'direction' || missileStep === 'flight' || missileStep === 'capture')) ||
            phase === 'done');

    const missileItemPulse =
        (phase === 'demo' && demoPlaying && missileStep === 'item') ||
        (phase === 'practice' && missileStep === 'item');

    const missileItemActive =
        (phase === 'demo' && missileStep !== 'item') ||
        (phase === 'practice' && missileItemArmed) ||
        phase === 'done';

    const missilesLeftDisplay =
        missileStep === 'flight' || missileStep === 'capture' || missileStep === 'done' || phase === 'done'
            ? 0
            : 1;

    const hiddenItemPulse =
        (phase === 'demo' && demoPlaying && hiddenStep === 'item') ||
        (phase === 'practice' && hiddenStep === 'item');
    const hiddenItemActive =
        (phase === 'demo' && hiddenStep !== 'item') ||
        (phase === 'practice' && hiddenItemArmed) ||
        (isHidden && phase === 'done');
    const hiddenLeftDisplay =
        hiddenStep === 'item' || (phase === 'practice' && hiddenStep === 'item' && !hiddenItemArmed) ? 1 : 0;

    const scanItemPulse =
        (phase === 'demo' && demoPlaying && hiddenStep === 'scanItem') ||
        (phase === 'practice' && hiddenStep === 'scanItem');
    const scanItemActive =
        (phase === 'demo' &&
            (hiddenStep === 'scanClick' || hiddenStep === 'scanned' || hiddenStep === 'done')) ||
        (phase === 'practice' && scanItemArmed) ||
        (isHidden && phase === 'done');
    const scanLeftDisplay =
        hiddenStep === 'scanned' || hiddenStep === 'done' || phase === 'done' ? 0 : 1;

    const showHiddenItemBtn =
        isHidden &&
        (phase === 'demo' ||
            phase === 'done' ||
            (phase === 'practice' &&
                (hiddenStep === 'item' ||
                    hiddenStep === 'placeHidden' ||
                    hiddenStep === 'awaitWhite' ||
                    hiddenStep === 'whiteElsewhere' ||
                    hiddenStep === 'awaitCapture' ||
                    hiddenStep === 'captureReveal' ||
                    hiddenStep === 'opponentItem' ||
                    hiddenStep === 'opponentPlace')));
    const showScanItemBtn =
        isHidden &&
        (phase === 'done' ||
            (phase === 'demo' &&
                (hiddenStep === 'scanItem' ||
                    hiddenStep === 'scanClick' ||
                    hiddenStep === 'scanned' ||
                    hiddenStep === 'done')) ||
            (phase === 'practice' &&
                (hiddenStep === 'scanItem' ||
                    hiddenStep === 'scanClick' ||
                    hiddenStep === 'scanned' ||
                    hiddenStep === 'opponentPlace' ||
                    hiddenStep === 'done')));

    const practiceHintKey = (() => {
        if (isBase && phase === 'practice') {
            if (baseStep === 'chooseDiff' || baseStep === 'chooseSame') {
                return 'pveBrief.tutorialBaseChooseHint';
            }
            if (baseStep === 'revealDiff') return 'pveBrief.tutorialBaseDiffHint';
            if (baseStep === 'revealSame') return 'pveBrief.tutorialBaseSameHint';
            if (baseStep === 'bid') return 'pveBrief.tutorialBaseBidHint';
            if (baseStep === 'bidWin') return 'pveBrief.tutorialBaseBidWinHint';
            return 'pveBrief.tutorialBaseChooseHint';
        }
        if (isHidden && phase === 'practice') {
            if (hiddenStep === 'item') return 'pveBrief.tutorialHiddenItemHint';
            if (hiddenStep === 'placeHidden') return 'pveBrief.tutorialHiddenPlaceHint';
            if (hiddenStep === 'awaitWhite') return 'pveBrief.tutorialHiddenWhiteHint';
            if (hiddenStep === 'awaitCapture') return 'pveBrief.tutorialHiddenCaptureHint';
            if (hiddenStep === 'scanItem') return 'pveBrief.tutorialScanItemHint';
            if (hiddenStep === 'scanClick') return 'pveBrief.tutorialScanClickHint';
            if (hiddenStep === 'opponentItem' || hiddenStep === 'opponentPlace') {
                return 'pveBrief.tutorialHiddenOpponentHint';
            }
            return 'pveBrief.tutorialHiddenPlaceHint';
        }
        if (!isMissile || phase !== 'practice') return 'pveBrief.tutorialPlaceHint';
        if (missileStep === 'item') return 'pveBrief.tutorialMissileItemHint';
        if (missileStep === 'stone') return 'pveBrief.tutorialMissileStoneHint';
        if (missileStep === 'direction') return 'pveBrief.tutorialMissileDirHint';
        return 'pveBrief.tutorialMissileFireHint';
    })();

    const showCaptureFlash =
        (isMissile &&
            (missileStep === 'capture' ||
                (phase === 'done' && (missileStep === 'done' || missileStep === 'capture')))) ||
        (isHidden &&
            (hiddenStep === 'captureReveal' ||
                (phase === 'done' && hiddenStep === 'done')));

    const showScanFlash = isHidden && (hiddenStep === 'scanned' || (phase === 'done' && isHidden));
    const showOpponentHiddenFlash =
        isHidden && (hiddenStep === 'opponentItem' || hiddenStep === 'opponentPlace');
    const showBaseDiffFlash = isBase && baseStep === 'revealDiff';
    const showBaseBidWinFlash = isBase && baseStep === 'bidWin';
    const showBaseColorUi =
        isBase &&
        (baseStep === 'chooseDiff' ||
            baseStep === 'revealDiff' ||
            baseStep === 'chooseSame' ||
            baseStep === 'revealSame');
    const showBaseBidUi = isBase && (baseStep === 'bid' || baseStep === 'bidWin' || baseStep === 'done');
    const baseColorClickable =
        phase === 'practice' && (baseStep === 'chooseDiff' || baseStep === 'chooseSame');
    const baseBlackPulse =
        (phase === 'demo' && demoPlaying && (baseStep === 'chooseDiff' || baseStep === 'chooseSame')) ||
        baseColorClickable;
    const baseMyPickedBlack =
        baseStep === 'revealDiff' ||
        baseStep === 'revealSame' ||
        baseStep === 'bid' ||
        baseStep === 'bidWin' ||
        baseStep === 'done';
    const baseOppIsWhite = baseStep === 'revealDiff';
    const baseBidDisplay =
        phase === 'demo' && (baseStep === 'bid' || baseStep === 'bidWin' || baseStep === 'done')
            ? (baseDemo?.winBid ?? 0)
            : baseBidValue;
    const baseOppBidDisplay = baseDemo?.oppBid ?? 0;
    const baseBidCanSubmit =
        phase === 'practice' && baseStep === 'bid' && Boolean(baseDemo) && baseBidValue >= baseDemo!.winBid;
    const pulseBaseMarks = isBase && phase === 'demo' && demoPlaying && baseStep === 'showBoard';

    const capturePts = lesson.captureScorePoints;
    const showPatternScore = typeof capturePts === 'number' && capturePts > 0;
    const patternCaptured =
        showPatternScore &&
        ((phase === 'demo' &&
            !demoPlaying &&
            demoIndex >= lesson.demoPlacements.length &&
            Boolean(lesson.demoCaptureRemovals?.length)) ||
            (phase === 'demo' &&
                demoPlaying &&
                demoIndex >= lesson.demoPlacements.length &&
                Boolean(lesson.demoCaptureRemovals?.length)) ||
            (phase === 'practice' && practiceIndex >= practiceSequence.length) ||
            phase === 'done');
    const patternScoreValue = patternCaptured ? capturePts! : 0;

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
                    {skipPractice ? (
                        <Button
                            type="button"
                            colorScheme="none"
                            bare
                            className={`${PVE_FOOTER_BTN_ACCENT} flex-[1.15]`}
                            disabled={demoPlaying}
                            onClick={onComplete}
                            cooldownMs={0}
                        >
                            {t('pveBrief.tutorialDone')}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            colorScheme="none"
                            bare
                            className={`${PVE_FOOTER_BTN_ACCENT} flex-[1.15]`}
                            disabled={demoPlaying}
                            onClick={goPractice}
                            cooldownMs={0}
                        >
                            {t(
                                isMissile || isHidden || isBase
                                    ? 'pveBrief.tutorialMissilePractice'
                                    : 'pveBrief.tutorialPractice',
                            )}
                        </Button>
                    )}
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
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_FOOTER_BTN_ACCENT} flex-[1.15]`}
                        disabled
                        cooldownMs={0}
                    >
                        {t(
                            isMissile || isHidden || isBase
                                ? 'pveBrief.tutorialMissilePractice'
                                : 'pveBrief.tutorialPractice',
                        )}
                    </Button>
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

    const missileDirectionPad =
        showMissilePad && missileDemo ? (
            <div className="mt-2 flex flex-col items-center gap-1" aria-label="missile directions">
                <button
                    type="button"
                    disabled={!dirClickable}
                    onClick={() => handleMissileDirClick('up')}
                    className={dirButtonClass(dirHighlightActive && missileDemo.direction === 'up', dirClickable)}
                    aria-label="fire up"
                >
                    {dirLabel('up')}
                </button>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={!dirClickable}
                        onClick={() => handleMissileDirClick('left')}
                        className={dirButtonClass(dirHighlightActive && missileDemo.direction === 'left', dirClickable)}
                        aria-label="fire left"
                    >
                        {dirLabel('left')}
                    </button>
                    <span className="h-9 w-9" aria-hidden />
                    <button
                        type="button"
                        disabled={!dirClickable}
                        onClick={() => handleMissileDirClick('right')}
                        className={dirButtonClass(dirHighlightActive && missileDemo.direction === 'right', dirClickable)}
                        aria-label="fire right"
                    >
                        {dirLabel('right')}
                    </button>
                </div>
                <button
                    type="button"
                    disabled={!dirClickable}
                    onClick={() => handleMissileDirClick('down')}
                    className={dirButtonClass(dirHighlightActive && missileDemo.direction === 'down', dirClickable)}
                    aria-label="fire down"
                >
                    {dirLabel('down')}
                </button>
            </div>
        ) : null;

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

                {isMissile ? (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            disabled={!(phase === 'practice' && missileStep === 'item')}
                            onClick={handleMissileItemClick}
                            className={`relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition ${
                                missileItemPulse
                                    ? 'animate-pulse border-amber-300 bg-amber-400/25 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                                    : missileItemActive
                                      ? 'border-emerald-400/70 bg-emerald-500/20'
                                      : 'border-white/20 bg-black/40'
                            } ${phase === 'practice' && missileStep === 'item' ? 'cursor-pointer' : 'cursor-default'}`}
                            aria-label="missile item"
                        >
                            <img
                                src="/images/button/missile.webp"
                                alt=""
                                className="h-10 w-10 object-contain"
                                draggable={false}
                            />
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                                {missilesLeftDisplay}
                            </span>
                        </button>
                    </div>
                ) : null}

                {isHidden ? (
                    <div className="flex justify-center gap-3">
                        {showHiddenItemBtn ? (
                            <button
                                type="button"
                                disabled={!(phase === 'practice' && hiddenStep === 'item')}
                                onClick={handleHiddenItemClick}
                                className={`relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition ${
                                    hiddenItemPulse
                                        ? 'animate-pulse border-violet-300 bg-violet-400/25 shadow-[0_0_18px_rgba(167,139,250,0.45)]'
                                        : hiddenItemActive
                                          ? 'border-violet-400/70 bg-violet-500/20'
                                          : 'border-white/20 bg-black/40'
                                } ${phase === 'practice' && hiddenStep === 'item' ? 'cursor-pointer' : 'cursor-default'}`}
                                aria-label="hidden item"
                            >
                                <img
                                    src="/images/button/hidden.webp"
                                    alt=""
                                    className="h-10 w-10 object-contain"
                                    draggable={false}
                                />
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                                    {hiddenLeftDisplay}
                                </span>
                            </button>
                        ) : null}
                        {showScanItemBtn ? (
                            <button
                                type="button"
                                disabled={!(phase === 'practice' && hiddenStep === 'scanItem')}
                                onClick={handleScanItemClick}
                                className={`relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition ${
                                    scanItemPulse
                                        ? 'animate-pulse border-sky-300 bg-sky-400/25 shadow-[0_0_18px_rgba(56,189,248,0.45)]'
                                        : scanItemActive
                                          ? 'border-sky-400/70 bg-sky-500/20'
                                          : 'border-white/20 bg-black/40'
                                } ${phase === 'practice' && hiddenStep === 'scanItem' ? 'cursor-pointer' : 'cursor-default'}`}
                                aria-label="scan item"
                            >
                                <img
                                    src="/images/button/scan.webp"
                                    alt=""
                                    className="h-10 w-10 object-contain"
                                    draggable={false}
                                />
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                                    {scanLeftDisplay}
                                </span>
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {isBase && showBaseColorUi ? (
                    <div className="space-y-2 rounded-xl border border-amber-400/25 bg-black/45 px-3 py-3">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                disabled={!baseColorClickable}
                                onClick={() => handleBaseColorPick('B')}
                                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 transition ${
                                    baseBlackPulse
                                        ? 'animate-pulse border-amber-300 bg-amber-400/20 shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                                        : baseMyPickedBlack
                                          ? 'border-emerald-400/70 bg-emerald-500/15'
                                          : 'border-white/15 bg-zinc-900/80'
                                } ${baseColorClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                aria-label="pick black"
                            >
                                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-zinc-700 to-black shadow-md">
                                    <img
                                        src={BLACK_BASE_STONE_IMG}
                                        alt=""
                                        className="absolute h-[70%] w-[70%] object-contain"
                                        draggable={false}
                                    />
                                </span>
                                <span className="text-[11px] font-black text-white">{t('pveBrief.tutorialBaseBlack')}</span>
                            </button>
                            <button
                                type="button"
                                disabled
                                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 cursor-default ${
                                    baseOppIsWhite
                                        ? 'border-sky-300/70 bg-sky-500/15'
                                        : 'border-white/15 bg-zinc-900/80 opacity-70'
                                }`}
                                aria-label="white"
                            >
                                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white to-zinc-200 shadow-md">
                                    <img
                                        src={BLACK_BASE_STONE_IMG}
                                        alt=""
                                        className="absolute h-[70%] w-[70%] object-contain"
                                        draggable={false}
                                    />
                                </span>
                                <span className="text-[11px] font-black text-white">{t('pveBrief.tutorialBaseWhite')}</span>
                            </button>
                        </div>
                        {baseStep === 'revealDiff' || baseStep === 'revealSame' ? (
                            <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                                <p className="text-emerald-200/90">
                                    {t('pveBrief.tutorialBaseYou')}: {t('pveBrief.tutorialBaseBlack')}
                                </p>
                                <p className={baseOppIsWhite ? 'text-sky-200/90' : 'text-amber-200/90'}>
                                    {t('pveBrief.tutorialBaseOpponent')}:{' '}
                                    {baseOppIsWhite
                                        ? t('pveBrief.tutorialBaseWhite')
                                        : t('pveBrief.tutorialBaseBlack')}
                                </p>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {isBase && showBaseBidUi && baseDemo ? (
                    <div className="space-y-2.5 rounded-xl border border-amber-400/25 bg-black/45 px-3 py-3">
                        <p className="text-center text-[11px] font-bold text-amber-100/90">
                            {t('pveBrief.tutorialBaseContested', { color: t('pveBrief.tutorialBaseBlack') })}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-center">
                                <p className="text-[10px] font-bold text-white/60">{t('pveBrief.tutorialBaseYou')}</p>
                                <p className="mt-1 text-2xl font-black tabular-nums text-amber-200">{baseBidDisplay}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-center">
                                <p className="text-[10px] font-bold text-white/60">
                                    {t('pveBrief.tutorialBaseOpponent')}
                                </p>
                                <p className="mt-1 text-2xl font-black tabular-nums text-sky-200">{baseOppBidDisplay}</p>
                            </div>
                        </div>
                        {phase === 'practice' && baseStep === 'bid' ? (
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-lg font-black text-white"
                                    onClick={() => setBaseBidValue((v) => Math.max(0, v - 1))}
                                    aria-label="decrease bid"
                                >
                                    −
                                </button>
                                <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-lg font-black text-white"
                                    onClick={() => setBaseBidValue((v) => Math.min(20, v + 1))}
                                    aria-label="increase bid"
                                >
                                    +
                                </button>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    bare
                                    className={`${PVE_FOOTER_BTN_ACCENT} !min-h-9 !px-3 ${
                                        baseBidCanSubmit ? 'animate-pulse' : 'opacity-50'
                                    }`}
                                    disabled={!baseBidCanSubmit}
                                    onClick={handleBaseBidSubmit}
                                    cooldownMs={0}
                                >
                                    {t('pveBrief.tutorialBaseBidSubmit')}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {isSpeed ? (
                    <div className="relative space-y-3 rounded-xl bg-black px-2.5 py-3 sm:px-3 sm:py-3.5">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-emerald-400/40 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-200/80">
                                    {t('pveBrief.tutorialSpeedYou')}
                                </p>
                                <p className="mt-1 text-2xl font-black tabular-nums text-white">0</p>
                                <p className="text-[10px] font-semibold text-white/50">{t('pveBrief.tutorialSpeedScore')}</p>
                                <div
                                    className="mt-2 flex w-full min-w-0 items-center gap-2 border-t border-white/10 pt-2"
                                    role="timer"
                                    aria-live="polite"
                                    aria-label={t('speedPressure.aria', { sec: speedSec })}
                                >
                                    <span
                                        className={`shrink-0 min-w-[2ch] text-center text-lg font-black tabular-nums leading-none ${
                                            speedSec <= 3 ? 'text-red-300' : 'text-amber-200'
                                        }`}
                                    >
                                        {speedSec}
                                    </span>
                                    <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
                                        <div
                                            className={`h-full rounded-full transition-[width] duration-300 ${
                                                speedSec <= 3 ? 'bg-red-400' : 'bg-amber-400'
                                            }`}
                                            style={{
                                                width: `${Math.max(0, Math.min(100, (speedSec / SPEED_MAX_SEC) * 100))}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div
                                className={`relative rounded-lg border bg-gradient-to-b from-slate-100 to-slate-300 p-2.5 transition ${
                                    speedPenaltyFlash
                                        ? 'border-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.45)]'
                                        : 'border-slate-400/50'
                                }`}
                            >
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                    {t('pveBrief.tutorialSpeedOpponent')}
                                </p>
                                <p
                                    className={`mt-1 text-2xl font-black tabular-nums text-slate-900 transition ${
                                        speedPenaltyFlash ? 'scale-110 text-rose-600' : ''
                                    }`}
                                >
                                    {oppScore}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-500">{t('pveBrief.tutorialSpeedScore')}</p>
                                {speedPenaltyFlash ? (
                                    <span className="absolute right-2 top-2 animate-pulse rounded-full border border-rose-400/60 bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                                        {t('pveBrief.tutorialSpeedPenaltyFlash')}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <PveTutorialMiniBoard
                            boardSize={lesson.boardSize}
                            stones={boardStones}
                            highlight={null}
                            interactive={false}
                            className="!max-w-[12rem] opacity-80"
                        />
                    </div>
                ) : (
                    <div className="relative space-y-2 rounded-xl bg-black px-2.5 py-3 sm:px-3 sm:py-3.5">
                        {showPatternScore ? (
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-zinc-900/80 px-3 py-2">
                                <span className="text-xs font-bold text-emerald-100/90">
                                    {t('pveBrief.tutorialSpeedYou')} · {t('pveBrief.tutorialSpeedScore')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-2xl font-black tabular-nums transition ${
                                            patternCaptured ? 'scale-110 text-amber-300' : 'text-white'
                                        }`}
                                    >
                                        {patternScoreValue}
                                    </span>
                                    {patternCaptured ? (
                                        <span className="animate-pulse rounded-full border border-amber-300/50 bg-amber-500/90 px-2 py-0.5 text-[10px] font-black text-black">
                                            {t('pveBrief.tutorialPatternScoreFlash', { points: capturePts })}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-cyan-200/80">
                                            {t('pveBrief.tutorialPatternLookHint')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : null}
                        <PveTutorialMiniBoard
                            boardSize={lesson.boardSize}
                            stones={boardStones}
                            highlight={highlight}
                            territory={visibleTerritory}
                            interactive={phase === 'practice' && !isBase}
                            allowSelectOccupied={isMissile && missileStep === 'stone'}
                            pulseBaseMarks={pulseBaseMarks}
                            onCellClick={handlePracticeClick}
                        />
                        {showScoringOverlay ? (
                            <div
                                className="pointer-events-none absolute inset-x-3 top-3 z-[2] flex justify-center sm:inset-x-4 sm:top-3.5"
                                aria-live="polite"
                            >
                                <span className="rounded-full border border-amber-300/50 bg-black/75 px-3 py-1 text-[11px] font-black tracking-wide text-amber-100 shadow-lg sm:text-xs">
                                    {t('pveBrief.tutorialScoringFlash')}
                                </span>
                            </div>
                        ) : null}
                        {showCaptureFlash ? (
                            <div
                                className="pointer-events-none absolute inset-x-3 top-3 z-[2] flex justify-center sm:inset-x-4 sm:top-3.5"
                                aria-live="polite"
                            >
                                <span className="rounded-full border border-rose-300/50 bg-black/75 px-3 py-1 text-[11px] font-black tracking-wide text-rose-100 shadow-lg sm:text-xs">
                                    {t(
                                        isHidden
                                            ? 'pveBrief.tutorialHiddenRevealFlash'
                                            : 'pveBrief.tutorialMissileCaptureFlash',
                                    )}
                                </span>
                            </div>
                        ) : null}
                        {showScanFlash && !showCaptureFlash ? (
                            <div
                                className="pointer-events-none absolute inset-x-3 top-3 z-[2] flex justify-center sm:inset-x-4 sm:top-3.5"
                                aria-live="polite"
                            >
                                <span className="rounded-full border border-sky-300/50 bg-black/75 px-3 py-1 text-[11px] font-black tracking-wide text-sky-100 shadow-lg sm:text-xs">
                                    {t('pveBrief.tutorialScanFoundFlash')}
                                </span>
                            </div>
                        ) : null}
                        {showOpponentHiddenFlash && !showCaptureFlash ? (
                            <div
                                className="pointer-events-none absolute inset-x-3 top-3 z-[2] flex justify-center sm:inset-x-4 sm:top-3.5"
                                aria-live="polite"
                            >
                                <span className="rounded-full border border-violet-300/50 bg-black/75 px-3 py-1 text-[11px] font-black tracking-wide text-violet-100 shadow-lg sm:text-xs">
                                    {t('pveBrief.tutorialHiddenOpponentFlash')}
                                </span>
                            </div>
                        ) : null}
                        {showBaseDiffFlash ? (
                            <div
                                className="pointer-events-none absolute inset-x-3 top-3 z-[2] flex justify-center sm:inset-x-4 sm:top-3.5"
                                aria-live="polite"
                            >
                                <span className="rounded-full border border-amber-300/50 bg-black/75 px-3 py-1 text-[11px] font-black tracking-wide text-amber-100 shadow-lg sm:text-xs">
                                    {t('pveBrief.tutorialBaseDiffFlash')}
                                </span>
                            </div>
                        ) : null}
                        {showBaseBidWinFlash && !showBaseDiffFlash ? (
                            <div
                                className="pointer-events-none absolute inset-x-3 top-3 z-[2] flex justify-center sm:inset-x-4 sm:top-3.5"
                                aria-live="polite"
                            >
                                <span className="rounded-full border border-emerald-300/50 bg-black/75 px-3 py-1 text-[11px] font-black tracking-wide text-emerald-100 shadow-lg sm:text-xs">
                                    {t('pveBrief.tutorialBaseBidWinFlash')}
                                </span>
                            </div>
                        ) : null}
                    </div>
                )}

                {missileDirectionPad}

                {phase === 'practice' ? (
                    <p className="text-center text-xs font-bold text-emerald-200/90">{t(practiceHintKey)}</p>
                ) : isBase && phase === 'demo' && baseStep === 'showBoard' ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialBaseShowHint')}</p>
                ) : isBase && phase === 'demo' && (baseStep === 'chooseDiff' || baseStep === 'chooseSame') ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialBaseChooseHint')}</p>
                ) : isBase && phase === 'demo' && baseStep === 'revealDiff' ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialBaseDiffHint')}</p>
                ) : isBase && phase === 'demo' && baseStep === 'revealSame' ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialBaseSameHint')}</p>
                ) : isBase && phase === 'demo' && baseStep === 'bid' ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialBaseBidHint')}</p>
                ) : isBase && phase === 'demo' && baseStep === 'bidWin' ? (
                    <p className="text-center text-xs font-bold text-emerald-100/90">{t('pveBrief.tutorialBaseBidWinHint')}</p>
                ) : showScoringOverlay && phase === 'demo' ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialScoringHint')}</p>
                ) : isHidden && phase === 'demo' && hiddenStep === 'captureReveal' ? (
                    <p className="text-center text-xs font-bold text-rose-100/90">{t('pveBrief.tutorialHiddenRevealHint')}</p>
                ) : isHidden && phase === 'demo' && (hiddenStep === 'opponentItem' || hiddenStep === 'opponentPlace') ? (
                    <p className="text-center text-xs font-bold text-violet-100/90">{t('pveBrief.tutorialHiddenOpponentHint')}</p>
                ) : isHidden && phase === 'demo' && (hiddenStep === 'scanItem' || hiddenStep === 'scanClick') ? (
                    <p className="text-center text-xs font-bold text-sky-100/90">{t('pveBrief.tutorialScanHint')}</p>
                ) : isHidden && phase === 'demo' && hiddenStep === 'scanned' ? (
                    <p className="text-center text-xs font-bold text-sky-100/90">{t('pveBrief.tutorialScanFoundHint')}</p>
                ) : isMissile && phase === 'demo' && missileStep === 'capture' ? (
                    <p className="text-center text-xs font-bold text-rose-100/90">{t('pveBrief.tutorialMissileCaptureHint')}</p>
                ) : isSpeed && speedPenaltyFlash ? (
                    <p className="text-center text-xs font-bold text-rose-100/90">{t('pveBrief.tutorialSpeedHint')}</p>
                ) : isSpeed && phase === 'demo' && demoPlaying ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">{t('pveBrief.tutorialSpeedHint')}</p>
                ) : showPatternScore && patternCaptured ? (
                    <p className="text-center text-xs font-bold text-amber-100/90">
                        {t('pveBrief.tutorialPatternCaptureHint', { points: capturePts })}
                    </p>
                ) : showPatternScore && phase === 'demo' && demoPlaying && !patternCaptured ? (
                    <p className="text-center text-xs font-bold text-cyan-100/90">{t('pveBrief.tutorialPatternLookHint')}</p>
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
