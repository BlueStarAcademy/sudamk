import type { LiveGameSession, SinglePlayerStageInfo } from '../types/entities.js';
import { GameMode } from '../types/enums.js';
import {
    resolveSinglePlayerSurvivalModeForSession,
    resolveSinglePlayerSpeedTimeMode,
    inferSinglePlayerStrategicRulePreset,
} from '../utils/singlePlayerStrategicRulePreset.js';
import type { ScreenGuideId } from './screenGuideDismiss.js';

export type PveTutorialStoneColor = 'B' | 'W';

export type PveTutorialStone = {
    x: number;
    y: number;
    color: PveTutorialStoneColor;
    /** 문양돌(따내면 2점) */
    pattern?: boolean;
};

export type PveTutorialId =
    | 'sp_capture_basics'
    | 'sp_pattern'
    | 'sp_survival'
    | 'sp_auto_scoring'
    | 'sp_speed'
    | 'sp_missile'
    | 'sp_hidden'
    | 'sp_base';

/** dismissedScreenGuides에 저장하는 id (= ScreenGuideId) */
export type PveTutorialGuideId = Extract<
    ScreenGuideId,
    | 'sp_tutorial_capture_basics'
    | 'sp_tutorial_pattern'
    | 'sp_tutorial_survival'
    | 'sp_tutorial_auto_scoring'
    | 'sp_tutorial_speed'
    | 'sp_tutorial_missile'
    | 'sp_tutorial_hidden'
    | 'sp_tutorial_base'
>;

export type PveMissileDirection = 'up' | 'down' | 'left' | 'right';

/** 미사일 튜토리얼: 아이템 → 내 돌 → 방향 발사 → 착지·따내기 */
export type PveMissileTutorialDemo = {
    selectStone: { x: number; y: number };
    direction: PveMissileDirection;
    landing: { x: number; y: number };
    captureRemovals: Array<{ x: number; y: number }>;
};

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
    /**
     * 데모/연습 완료 후 계가 연출용 영토 표시.
     * 마지막 공배를 막은 뒤 확정된 집(빈 칸)을 색으로 표시한다.
     */
    scoringTerritory?: PveTutorialStone[];
    /**
     * 공배를 n수 둔 뒤(1-based) 보여줄 영토. 있으면 착점마다 영토가 늘어난다.
     * 없으면 `scoringTerritory`는 모든 데모 착점 완료 후에만 표시.
     */
    scoringTerritorySteps?: PveTutorialStone[][];
    /** 있으면 착점 대신 미사일 아이템 사용 연출을 쓴다 */
    missileDemo?: PveMissileTutorialDemo;
    /** 스피드 막대(10→0)와 상대 +1점 연출 */
    speedDemo?: boolean;
    /** true면 따라놓기 없이 데모 후 완료 */
    skipPractice?: boolean;
    /** 따낸 뒤 표시할 획득 점수(문양돌 2점 등) */
    captureScorePoints?: number;
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
    sp_pattern: {
        id: 'sp_pattern',
        guideId: 'sp_tutorial_pattern',
        titleKey: 'pveBrief.tutorials.sp_pattern.title',
        bodyKey: 'pveBrief.tutorials.sp_pattern.body',
        boardSize: 5,
        // 문양이 새겨진 백돌 — 따내면 2점
        initialStones: [
            { x: 2, y: 2, color: 'W', pattern: true },
            { x: 1, y: 2, color: 'B' },
            { x: 3, y: 2, color: 'B' },
            { x: 2, y: 1, color: 'B' },
        ],
        demoPlacements: [{ x: 2, y: 3, color: 'B' }],
        demoCaptureRemovals: [{ x: 2, y: 2 }],
        practiceTargets: [{ x: 2, y: 3 }],
        captureScorePoints: 2,
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
        boardSize: 7,
        // 제공 이미지와 동일(7×7, 흑·백 각 9). 마주보는 공배 두 곳을 메우며 영토 표시.
        // . . . B W . .
        // . B . B W . .
        // . . B . W . .
        // . . B B W . .
        // . . . B . W .
        // . . B W W W .
        // . . B W . . .
        initialStones: [
            { x: 3, y: 0, color: 'B' },
            { x: 1, y: 1, color: 'B' },
            { x: 3, y: 1, color: 'B' },
            { x: 2, y: 2, color: 'B' },
            { x: 2, y: 3, color: 'B' },
            { x: 3, y: 3, color: 'B' },
            { x: 3, y: 4, color: 'B' },
            { x: 2, y: 5, color: 'B' },
            { x: 2, y: 6, color: 'B' },
            { x: 4, y: 0, color: 'W' },
            { x: 4, y: 1, color: 'W' },
            { x: 4, y: 2, color: 'W' },
            { x: 4, y: 3, color: 'W' },
            { x: 5, y: 4, color: 'W' },
            { x: 3, y: 5, color: 'W' },
            { x: 4, y: 5, color: 'W' },
            { x: 5, y: 5, color: 'W' },
            { x: 3, y: 6, color: 'W' },
        ],
        // 마주보는 공배: (3,2) 흑·백 사이, (4,4) 흑·백 사이
        demoPlacements: [
            { x: 3, y: 2, color: 'B' },
            { x: 4, y: 4, color: 'W' },
        ],
        practiceTargets: [
            { x: 3, y: 2 },
            { x: 4, y: 4 },
        ],
        scoringTerritorySteps: [
            // 1수: 상단 쪽 영토가 드러남
            [
                { x: 0, y: 0, color: 'B' },
                { x: 1, y: 0, color: 'B' },
                { x: 2, y: 0, color: 'B' },
                { x: 0, y: 1, color: 'B' },
                { x: 2, y: 1, color: 'B' },
                { x: 0, y: 2, color: 'B' },
                { x: 1, y: 2, color: 'B' },
                { x: 5, y: 0, color: 'W' },
                { x: 6, y: 0, color: 'W' },
                { x: 5, y: 1, color: 'W' },
                { x: 6, y: 1, color: 'W' },
                { x: 5, y: 2, color: 'W' },
                { x: 6, y: 2, color: 'W' },
                { x: 5, y: 3, color: 'W' },
                { x: 6, y: 3, color: 'W' },
            ],
            // 2수: 하단 영토까지 확정 (한쪽마다 서로 떨어진 집 2곳)
            [
                { x: 0, y: 0, color: 'B' },
                { x: 1, y: 0, color: 'B' },
                { x: 2, y: 0, color: 'B' },
                { x: 0, y: 1, color: 'B' },
                { x: 2, y: 1, color: 'B' },
                { x: 0, y: 2, color: 'B' },
                { x: 1, y: 2, color: 'B' },
                { x: 0, y: 3, color: 'B' },
                { x: 1, y: 3, color: 'B' },
                { x: 0, y: 4, color: 'B' },
                { x: 1, y: 4, color: 'B' },
                { x: 2, y: 4, color: 'B' },
                { x: 0, y: 5, color: 'B' },
                { x: 1, y: 5, color: 'B' },
                { x: 0, y: 6, color: 'B' },
                { x: 1, y: 6, color: 'B' },
                { x: 5, y: 0, color: 'W' },
                { x: 6, y: 0, color: 'W' },
                { x: 5, y: 1, color: 'W' },
                { x: 6, y: 1, color: 'W' },
                { x: 5, y: 2, color: 'W' },
                { x: 6, y: 2, color: 'W' },
                { x: 5, y: 3, color: 'W' },
                { x: 6, y: 3, color: 'W' },
                { x: 6, y: 4, color: 'W' },
                { x: 6, y: 5, color: 'W' },
                { x: 6, y: 6, color: 'W' },
                { x: 5, y: 6, color: 'W' },
                { x: 4, y: 6, color: 'W' },
            ],
        ],
        scoringTerritory: [
            { x: 0, y: 0, color: 'B' },
            { x: 1, y: 0, color: 'B' },
            { x: 2, y: 0, color: 'B' },
            { x: 0, y: 1, color: 'B' },
            { x: 2, y: 1, color: 'B' },
            { x: 0, y: 2, color: 'B' },
            { x: 1, y: 2, color: 'B' },
            { x: 0, y: 3, color: 'B' },
            { x: 1, y: 3, color: 'B' },
            { x: 0, y: 4, color: 'B' },
            { x: 1, y: 4, color: 'B' },
            { x: 2, y: 4, color: 'B' },
            { x: 0, y: 5, color: 'B' },
            { x: 1, y: 5, color: 'B' },
            { x: 0, y: 6, color: 'B' },
            { x: 1, y: 6, color: 'B' },
            { x: 5, y: 0, color: 'W' },
            { x: 6, y: 0, color: 'W' },
            { x: 5, y: 1, color: 'W' },
            { x: 6, y: 1, color: 'W' },
            { x: 5, y: 2, color: 'W' },
            { x: 6, y: 2, color: 'W' },
            { x: 5, y: 3, color: 'W' },
            { x: 6, y: 3, color: 'W' },
            { x: 6, y: 4, color: 'W' },
            { x: 6, y: 5, color: 'W' },
            { x: 6, y: 6, color: 'W' },
            { x: 5, y: 6, color: 'W' },
            { x: 4, y: 6, color: 'W' },
        ],
    },
    sp_speed: {
        id: 'sp_speed',
        guideId: 'sp_tutorial_speed',
        titleKey: 'pveBrief.tutorials.sp_speed.title',
        bodyKey: 'pveBrief.tutorials.sp_speed.body',
        boardSize: 5,
        // 보드 착점 대신 10초 막대·상대 +1점 연출 (따라놓기 없음)
        initialStones: [
            { x: 2, y: 2, color: 'B' },
            { x: 3, y: 3, color: 'W' },
            { x: 1, y: 3, color: 'B' },
            { x: 4, y: 2, color: 'W' },
        ],
        demoPlacements: [],
        practiceTargets: [],
        speedDemo: true,
        skipPractice: true,
    },
    sp_missile: {
        id: 'sp_missile',
        guideId: 'sp_tutorial_missile',
        titleKey: 'pveBrief.tutorials.sp_missile.title',
        bodyKey: 'pveBrief.tutorials.sp_missile.body',
        boardSize: 5,
        // 백 한 점의 마지막 활로(2,3)를, 아래 흑 돌을 위로 밀어 막아 따낸다.
        initialStones: [
            { x: 2, y: 1, color: 'B' },
            { x: 1, y: 2, color: 'B' },
            { x: 3, y: 2, color: 'B' },
            { x: 2, y: 2, color: 'W' },
            { x: 2, y: 4, color: 'B' },
        ],
        demoPlacements: [],
        practiceTargets: [],
        demoCaptureRemovals: [{ x: 2, y: 2 }],
        missileDemo: {
            selectStone: { x: 2, y: 4 },
            direction: 'up',
            landing: { x: 2, y: 3 },
            captureRemovals: [{ x: 2, y: 2 }],
        },
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
    sp_pattern: 'sp_tutorial_pattern',
    sp_survival: 'sp_tutorial_survival',
    sp_auto_scoring: 'sp_tutorial_auto_scoring',
    sp_speed: 'sp_tutorial_speed',
    sp_missile: 'sp_tutorial_missile',
    sp_hidden: 'sp_tutorial_hidden',
    sp_base: 'sp_tutorial_base',
};

export function pveTutorialGuideId(id: PveTutorialId): PveTutorialGuideId {
    return GUIDE_BY_TUTORIAL[id];
}

/**
 * 모험(싱글) 스테이지에 대해 보여줄 튜토리얼 id.
 * 우선순위: 살리기 → 미사일 → 히든 → 베이스 → 스피드 → 계가 → 문양돌 → 입문-1 따내기
 * 해당 없으면 null (시작 모달 튜토리얼 버튼도 숨김).
 * 자동 노출은 종류별 `dismissedScreenGuides`로 **한 번만**.
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
    const mixModes = (session.settings as { mixedModes?: GameMode[] } | undefined)?.mixedModes;
    const stageMix = stage.mixedStrategicModes;
    const missileCount = Number(session.settings.missileCount ?? stage.missileCount ?? 0);
    const hasMissileRule =
        missileCount > 0 ||
        session.mode === GameMode.Missile ||
        stage.strategicRulePreset === 'missile' ||
        (session.mode === GameMode.Mix && Array.isArray(mixModes) && mixModes.includes(GameMode.Missile)) ||
        (stage.strategicRulePreset === 'mix' && Array.isArray(stageMix) && stageMix.includes(GameMode.Missile));
    if (hasMissileRule) {
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
    const isSpeedSession =
        resolveSinglePlayerSpeedTimeMode(stage) ||
        session.mode === GameMode.Speed ||
        preset === 'speed' ||
        (session.mode === GameMode.Mix && Array.isArray(mixModes) && mixModes.includes(GameMode.Speed));
    if (isSpeedSession) {
        return 'sp_speed';
    }
    const auto =
        typeof stage.autoScoringTurns === 'number' && stage.autoScoringTurns > 0
            ? stage.autoScoringTurns
            : Number((session.settings as { autoScoringTurns?: number }).autoScoringTurns ?? 0);
    if (auto > 0 || preset === 'classic') {
        return 'sp_auto_scoring';
    }
    const patternCount =
        Math.max(0, Number(stage.placements?.blackPattern ?? 0)) +
        Math.max(0, Number(stage.placements?.whitePattern ?? 0));
    if (patternCount > 0) {
        return 'sp_pattern';
    }
    // 따내기 기초는 새싹의 숲 1관문에서만 — 이후 스테이지에서는 재노출하지 않음
    if (stage.id === '입문-1') {
        return 'sp_capture_basics';
    }
    return null;
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
    'sp_pattern',
    'sp_survival',
    'sp_auto_scoring',
    'sp_speed',
    'sp_missile',
    'sp_hidden',
    'sp_base',
];
