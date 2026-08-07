import type { LiveGameSession, SinglePlayerStageInfo } from '../types/entities.js';
import {
    resolveSinglePlayerSurvivalModeForSession,
    inferSinglePlayerStrategicRulePreset,
} from '../utils/singlePlayerStrategicRulePreset.js';
import type { ScreenGuideId } from './screenGuideDismiss.js';

export type PveTutorialStoneColor = 'B' | 'W';

export type PveTutorialStone = {
    x: number;
    y: number;
    color: PveTutorialStoneColor;
};

export type PveTutorialId =
    | 'sp_capture_basics'
    | 'sp_survival'
    | 'sp_auto_scoring'
    | 'sp_missile'
    | 'sp_hidden'
    | 'sp_base';

/** dismissedScreenGuides에 저장하는 id (= ScreenGuideId) */
export type PveTutorialGuideId = Extract<
    ScreenGuideId,
    | 'sp_tutorial_capture_basics'
    | 'sp_tutorial_survival'
    | 'sp_tutorial_auto_scoring'
    | 'sp_tutorial_missile'
    | 'sp_tutorial_hidden'
    | 'sp_tutorial_base'
>;

export type PveTutorialLesson = {
    id: PveTutorialId;
    guideId: PveTutorialGuideId;
    titleKey: string;
    bodyKey: string;
    boardSize: number;
    /** 시작 시 이미 놓인 돌 */
    initialStones: PveTutorialStone[];
    /** 자동재생으로 순차 배치 */
    demoPlacements: PveTutorialStone[];
    /** 따라놓기: 유저가 놓을 흑 돌 순서 (빈 칸만) */
    practiceTargets: Array<{ x: number; y: number }>;
    /** 따라놓기 시작 보드 = initial + demo 완료 상태와 다를 때 별도 지정 */
    practiceInitialStones?: PveTutorialStone[];
    /** 데모 마지막 수 이후 제거할 돌(따내기 연출) */
    demoCaptureRemovals?: Array<{ x: number; y: number }>;
};

export const PVE_TUTORIAL_LESSONS: Record<PveTutorialId, PveTutorialLesson> = {
    sp_capture_basics: {
        id: 'sp_capture_basics',
        guideId: 'sp_tutorial_capture_basics',
        titleKey: 'pveBrief.tutorials.sp_capture_basics.title',
        bodyKey: 'pveBrief.tutorials.sp_capture_basics.body',
        boardSize: 5,
        // 흰돌 하나, 흑이 삼면을 둘러싼 뒤 마지막 수로 따냄
        initialStones: [
            { x: 2, y: 2, color: 'W' },
            { x: 1, y: 2, color: 'B' },
            { x: 3, y: 2, color: 'B' },
            { x: 2, y: 1, color: 'B' },
        ],
        demoPlacements: [{ x: 2, y: 3, color: 'B' }],
        demoCaptureRemovals: [{ x: 2, y: 2 }],
        practiceTargets: [{ x: 2, y: 3 }],
    },
    sp_survival: {
        id: 'sp_survival',
        guideId: 'sp_tutorial_survival',
        titleKey: 'pveBrief.tutorials.sp_survival.title',
        bodyKey: 'pveBrief.tutorials.sp_survival.body',
        boardSize: 5,
        initialStones: [
            { x: 2, y: 2, color: 'B' },
            { x: 1, y: 2, color: 'W' },
            { x: 3, y: 2, color: 'W' },
        ],
        demoPlacements: [
            { x: 2, y: 1, color: 'B' },
            { x: 2, y: 3, color: 'B' },
        ],
        practiceTargets: [
            { x: 2, y: 1 },
            { x: 2, y: 3 },
        ],
    },
    sp_auto_scoring: {
        id: 'sp_auto_scoring',
        guideId: 'sp_tutorial_auto_scoring',
        titleKey: 'pveBrief.tutorials.sp_auto_scoring.title',
        bodyKey: 'pveBrief.tutorials.sp_auto_scoring.body',
        boardSize: 5,
        initialStones: [
            { x: 1, y: 1, color: 'B' },
            { x: 1, y: 2, color: 'B' },
            { x: 2, y: 1, color: 'B' },
            { x: 3, y: 3, color: 'W' },
            { x: 3, y: 2, color: 'W' },
        ],
        demoPlacements: [{ x: 2, y: 2, color: 'B' }],
        practiceTargets: [{ x: 2, y: 2 }],
    },
    sp_missile: {
        id: 'sp_missile',
        guideId: 'sp_tutorial_missile',
        titleKey: 'pveBrief.tutorials.sp_missile.title',
        bodyKey: 'pveBrief.tutorials.sp_missile.body',
        boardSize: 5,
        initialStones: [
            { x: 1, y: 2, color: 'B' },
            { x: 2, y: 2, color: 'W' },
            { x: 3, y: 2, color: 'W' },
        ],
        // 미사일 효과 연출 대신, 유리한 착점으로 형세 이득
        demoPlacements: [{ x: 4, y: 2, color: 'B' }],
        practiceTargets: [{ x: 4, y: 2 }],
    },
    sp_hidden: {
        id: 'sp_hidden',
        guideId: 'sp_tutorial_hidden',
        titleKey: 'pveBrief.tutorials.sp_hidden.title',
        bodyKey: 'pveBrief.tutorials.sp_hidden.body',
        boardSize: 5,
        initialStones: [
            { x: 2, y: 2, color: 'W' },
            { x: 1, y: 1, color: 'B' },
        ],
        demoPlacements: [{ x: 3, y: 3, color: 'B' }],
        practiceTargets: [{ x: 3, y: 3 }],
    },
    sp_base: {
        id: 'sp_base',
        guideId: 'sp_tutorial_base',
        titleKey: 'pveBrief.tutorials.sp_base.title',
        bodyKey: 'pveBrief.tutorials.sp_base.body',
        boardSize: 5,
        initialStones: [
            { x: 0, y: 0, color: 'B' },
            { x: 4, y: 4, color: 'W' },
            { x: 0, y: 4, color: 'B' },
            { x: 4, y: 0, color: 'W' },
        ],
        demoPlacements: [{ x: 2, y: 2, color: 'B' }],
        practiceTargets: [{ x: 2, y: 2 }],
    },
};

const GUIDE_BY_TUTORIAL: Record<PveTutorialId, PveTutorialGuideId> = {
    sp_capture_basics: 'sp_tutorial_capture_basics',
    sp_survival: 'sp_tutorial_survival',
    sp_auto_scoring: 'sp_tutorial_auto_scoring',
    sp_missile: 'sp_tutorial_missile',
    sp_hidden: 'sp_tutorial_hidden',
    sp_base: 'sp_tutorial_base',
};

export function pveTutorialGuideId(id: PveTutorialId): PveTutorialGuideId {
    return GUIDE_BY_TUTORIAL[id];
}

/**
 * 모험(싱글) 스테이지에 대해 보여줄 튜토리얼 id.
 * 우선순위: 살리기 → 미사일 → 히든 → 베이스 → 계가 → 따내기(기본)
 * 자동 노출은 종류별 `dismissedScreenGuides`로 억제 — 다른 종류가 나올 때까지 재표시하지 않음.
 * (시작하기 모달의 「튜토리얼」로 강제 다시보기는 가능)
 */
export function resolveTutorialForStage(
    session: LiveGameSession,
    stage: SinglePlayerStageInfo,
): PveTutorialId | null {
    // 탑·탐험은 호출하지 않음
    if (session.gameCategory === 'tower') return null;
    if (String(session.gameCategory ?? '') === 'adventure') return null;

    if (resolveSinglePlayerSurvivalModeForSession(session, stage)) {
        return 'sp_survival';
    }
    const missile = Number(session.settings.missileCount ?? stage.missileCount ?? 0);
    if (missile > 0) {
        return 'sp_missile';
    }
    const hidden = Number(session.settings.hiddenStoneCount ?? stage.hiddenCount ?? 0);
    if (hidden > 0 || stage.strategicRulePreset === 'hidden') {
        return 'sp_hidden';
    }
    const base = Number(session.settings.baseStones ?? stage.baseStones ?? 0);
    if (base > 0 || stage.strategicRulePreset === 'base') {
        return 'sp_base';
    }
    const preset = inferSinglePlayerStrategicRulePreset(stage);
    const auto =
        typeof stage.autoScoringTurns === 'number' && stage.autoScoringTurns > 0
            ? stage.autoScoringTurns
            : Number((session.settings as { autoScoringTurns?: number }).autoScoringTurns ?? 0);
    if (auto > 0 || preset === 'speed' || preset === 'classic') {
        return 'sp_auto_scoring';
    }
    return 'sp_capture_basics';
}

/** 해당 튜토리얼 종류를 이미 봤는지 (서버/로컬 dismissedScreenGuides) */
export function isPveTutorialKindDismissed(
    tutorialId: PveTutorialId,
    dismissedGuides: readonly string[] | null | undefined,
): boolean {
    const guideId = pveTutorialGuideId(tutorialId);
    return Array.isArray(dismissedGuides) && dismissedGuides.includes(guideId);
}

/** 모든 모험 튜토리얼 id */
export const ALL_PVE_TUTORIAL_IDS: readonly PveTutorialId[] = [
    'sp_capture_basics',
    'sp_survival',
    'sp_auto_scoring',
    'sp_missile',
    'sp_hidden',
    'sp_base',
];
