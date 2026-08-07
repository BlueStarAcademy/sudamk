import { GameMode, LiveGameSession, SinglePlayerStageInfo } from '../types.js';
import { Player } from '../types/enums.js';
import {
    getAdventureDesignCaptureTarget,
    getAdventureDesignScoringTurnLimit,
} from '../shared/utils/adventureBattleBoard.js';
import {
    buildSinglePlayerAcademyGoalDisplay,
    type SinglePlayerAcademyGoalDisplay,
} from './singlePlayerAcademyPreGameDisplay.js';

export type PveBriefGoalKind = 'capture' | 'survival' | 'autoScoring' | 'territory';

export type PveBriefItemHint = {
    kind: 'missile' | 'hidden' | 'base' | 'scan';
    count: number;
};

/** 시작 모달용 목표 (칩 + 문장형 헤드라인) */
export type PveBriefGoalDisplay = SinglePlayerAcademyGoalDisplay & {
    kind: PveBriefGoalKind;
    /** i18n key under `game:pveBrief.*` */
    headlineKey: string;
    headlineParams?: Record<string, string | number>;
    itemHints?: PveBriefItemHint[];
};

function itemHintsFromStageAndSession(
    session: LiveGameSession,
    stage?: SinglePlayerStageInfo | null,
): PveBriefItemHint[] {
    const hints: PveBriefItemHint[] = [];
    const missile =
        Number(session.settings.missileCount ?? stage?.missileCount ?? 0) || 0;
    const hidden =
        Number(session.settings.hiddenStoneCount ?? stage?.hiddenCount ?? 0) || 0;
    const scan = Number(session.settings.scanCount ?? stage?.scanCount ?? 0) || 0;
    const base = Number(session.settings.baseStones ?? stage?.baseStones ?? 0) || 0;
    if (missile > 0) hints.push({ kind: 'missile', count: missile });
    if (hidden > 0) hints.push({ kind: 'hidden', count: hidden });
    if (scan > 0) hints.push({ kind: 'scan', count: scan });
    if (base > 0) hints.push({ kind: 'base', count: base });
    return hints;
}

function enrichAcademyGoals(
    base: SinglePlayerAcademyGoalDisplay,
    session: LiveGameSession,
    stage: SinglePlayerStageInfo,
): PveBriefGoalDisplay {
    const itemHints = itemHintsFromStageAndSession(session, stage);

    if (base.survivalGoal) {
        return {
            ...base,
            kind: 'survival',
            headlineKey: 'pveBrief.headlineSurvival',
            headlineParams: {
                turns: base.survivalGoal.turns,
                count: base.survivalGoal.opponentTarget,
            },
            itemHints,
        };
    }

    const my = base.myCaptureTarget;
    const opp = base.opponentCaptureTarget;
    if (my != null && opp != null) {
        return {
            ...base,
            kind: 'capture',
            headlineKey: 'pveBrief.headlineCaptureVs',
            headlineParams: { my, opp },
            itemHints,
        };
    }
    if (my != null) {
        return {
            ...base,
            kind: 'capture',
            headlineKey: 'pveBrief.headlineCaptureSolo',
            headlineParams: { count: my },
            itemHints,
        };
    }

    if (base.autoScoringTurns != null && base.autoScoringTurns > 0) {
        return {
            ...base,
            kind: 'autoScoring',
            headlineKey: 'pveBrief.headlineAutoScoring',
            headlineParams: { turns: base.autoScoringTurns },
            itemHints,
        };
    }

    return {
        ...base,
        kind: 'territory',
        headlineKey: 'pveBrief.headlineTerritory',
        itemHints,
    };
}

/** 모험·도전의 탑 시작 모달 목표 */
export function buildPveBriefGoalForAcademy(
    session: LiveGameSession,
    stage: SinglePlayerStageInfo,
): PveBriefGoalDisplay {
    return enrichAcademyGoals(buildSinglePlayerAcademyGoalDisplay(session, stage), session, stage);
}

/** 탐험(adventure) 시작 모달 목표 */
export function buildAdventureGoalDisplay(session: LiveGameSession): PveBriefGoalDisplay {
    const boardSize = Number(session.settings.boardSize) || 9;
    const mode = session.mode;
    const itemHints = itemHintsFromStageAndSession(session, null);

    if (mode === GameMode.Capture) {
        const fromSettings = Number(session.settings.captureTarget);
        const fromDesign = getAdventureDesignCaptureTarget(boardSize);
        const target =
            Number.isFinite(fromSettings) && fromSettings > 0
                ? Math.floor(fromSettings)
                : fromDesign ?? 5;
        const effective = session.effectiveCaptureTargets;
        const my =
            typeof effective?.[Player.Black] === 'number' && effective[Player.Black] !== 999
                ? effective[Player.Black]
                : target;
        const opp =
            typeof effective?.[Player.White] === 'number' && effective[Player.White] !== 999
                ? effective[Player.White]
                : target;
        return {
            kind: 'capture',
            myCaptureTarget: my,
            opponentCaptureTarget: opp,
            headlineKey: 'pveBrief.headlineCaptureVs',
            headlineParams: { my, opp },
            itemHints,
        };
    }

    const scoringFromSettings = Number(
        (session.settings as { scoringTurnLimit?: number; autoScoringTurns?: number }).scoringTurnLimit ??
            (session.settings as { autoScoringTurns?: number }).autoScoringTurns,
    );
    const turns =
        Number.isFinite(scoringFromSettings) && scoringFromSettings > 0
            ? Math.floor(scoringFromSettings)
            : getAdventureDesignScoringTurnLimit(boardSize) ?? 40;

    return {
        kind: 'autoScoring',
        autoScoringTurns: turns,
        showTerritoryGoal: true,
        headlineKey: 'pveBrief.headlineAutoScoring',
        headlineParams: { turns },
        itemHints,
    };
}
