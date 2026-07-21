import * as db from './db.js';
import {
    DEFAULT_SINGLE_PLAYER_STAGES,
    SINGLE_PLAYER_STAGES_BASE,
} from '../shared/constants/singlePlayerConstants.js';
import { GameMode, LiveGameSession, SinglePlayerAiBaseKomiBid, SinglePlayerStageInfo, SinglePlayerStrategicRulePreset } from '../types/index.js';
import { ensureMixModesMinTwoAfterBaseCaptureSanitize } from '../shared/utils/singlePlayerMixBaseCaptureExclusive.js';

const SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY = 'singlePlayerStagesOverride';

type StageRow = (typeof DEFAULT_SINGLE_PLAYER_STAGES)[number];

/** 관리자 편집 시 보상(골드·EXP·아이템·보너스)도 저장. 미지정 칸만 코드 기본값. */
const CANONICAL_SINGLE_PLAYER_REWARDS_BY_ID = new Map(
    SINGLE_PLAYER_STAGES_BASE.map((s) => [s.id, s.rewards] as const)
);

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
};

const RULE_PRESETS: SinglePlayerStrategicRulePreset[] = [
    'auto',
    'classic',
    'capture',
    'survival',
    'speed',
    'base',
    'hidden',
    'missile',
    'mix',
];

const normalizeItemRewardList = (value: unknown): { itemId: string; quantity: number }[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const out = value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const row = entry as Record<string, unknown>;
            const itemId = typeof row.itemId === 'string' ? row.itemId.trim() : '';
            if (!itemId) return null;
            return { itemId, quantity: clampInt(row.quantity, 1, 9999, 1) };
        })
        .filter((entry): entry is { itemId: string; quantity: number } => !!entry);
    return out.length ? out : undefined;
};

const normalizeTimeControl = (
    value: unknown,
    fallback: SinglePlayerStageInfo['timeControl']
): SinglePlayerStageInfo['timeControl'] => {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const fallbackRow = (fallback && typeof fallback === 'object' ? fallback : { type: 'byoyomi' }) as Record<string, unknown>;
    const type = row.type === 'fischer' || row.type === 'byoyomi'
        ? row.type
        : (fallbackRow.type === 'fischer' || fallbackRow.type === 'byoyomi' ? fallbackRow.type : 'byoyomi');

    if (type === 'fischer') {
        return {
            type: 'fischer',
            mainTime: clampInt(row.mainTime, 0, 120, clampInt(fallbackRow.mainTime, 0, 120, 5)),
            increment: clampInt(row.increment, 0, 120, clampInt(fallbackRow.increment, 0, 120, 0)),
        };
    }

    return {
        type: 'byoyomi',
        mainTime: clampInt(row.mainTime, 0, 120, clampInt(fallbackRow.mainTime, 0, 120, 5)),
        byoyomiTime: clampInt(row.byoyomiTime, 0, 300, clampInt(fallbackRow.byoyomiTime, 0, 300, 30)),
        byoyomiCount: clampInt(row.byoyomiCount, 0, 20, clampInt(fallbackRow.byoyomiCount, 0, 20, 3)),
    };
};

const hasOwn = (row: Record<string, unknown>, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(row, key);

const normalizeOptionalPositiveIntFromRow = (
    row: Record<string, unknown>,
    key: string,
    max: number
): number | undefined => {
    if (!hasOwn(row, key)) return undefined;
    const n = clampInt(row[key], 0, max, 0);
    return n > 0 ? n : undefined;
};

const normalizeSinglePlayerAiBaseKomiBid = (value: unknown): SinglePlayerAiBaseKomiBid | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const row = value as Record<string, unknown>;
    const color = row.color === 'black' || row.color === 'white' || row.color === 'random' ? row.color : undefined;
    const komiMode = row.komiMode === 'fixed' || row.komiMode === 'random' ? row.komiMode : undefined;
    if (!color || !komiMode) return undefined;
    const out: SinglePlayerAiBaseKomiBid = { color, komiMode };
    if (komiMode === 'fixed') {
        const k = clampInt(row.komi, 0, 99, 0);
        out.komi = k;
    } else {
        let lo = clampInt(row.komiMin, 0, 99, 5);
        let hi = clampInt(row.komiMax, 0, 99, 20);
        if (lo > hi) {
            const t = lo;
            lo = hi;
            hi = t;
        }
        out.komiMin = lo;
        out.komiMax = hi;
    }
    return out;
};

const normalizeOptionalPositiveIntList = (value: unknown, maxValue: number, maxLen: number): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const seen = new Set<number>();
    const out: number[] = [];
    for (const raw of value) {
        const n = clampInt(raw, 1, maxValue, 0);
        if (n <= 0 || seen.has(n)) continue;
        seen.add(n);
        out.push(n);
        if (out.length >= maxLen) break;
    }
    out.sort((a, b) => a - b);
    return out.length > 0 ? out : undefined;
};

const normalizeOptionalText = (value: unknown, fallback: string | undefined, maxLength: number): string | undefined => {
    if (value == null) return fallback;
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    return text ? text.slice(0, maxLength) : undefined;
};

const deleteHiddenStageFields = (stage: SinglePlayerStageInfo): void => {
    delete (stage as { hiddenCount?: number }).hiddenCount;
    delete (stage as { scanCount?: number }).scanCount;
    delete (stage as { aiHiddenItemTurns?: number[] }).aiHiddenItemTurns;
    delete (stage as { aiHiddenItemUseWithinTurn?: number }).aiHiddenItemUseWithinTurn;
    delete (stage as { aiHiddenItemUseCount?: number }).aiHiddenItemUseCount;
    delete (stage as { aiHiddenItemPlacements?: SinglePlayerStageInfo['aiHiddenItemPlacements'] }).aiHiddenItemPlacements;
    delete (stage as { disableAiHiddenItemUsage?: boolean }).disableAiHiddenItemUsage;
    delete (stage as { forceAiResponsesOnHiddenTurnsOnly?: boolean }).forceAiResponsesOnHiddenTurnsOnly;
};

/** prune가 단일 프리셋만 허용한다고 해서 관리자가 넣은 미사일·히든·따내기 한도 등을 지워 버리는 문제 방지 */
const STRATEGIC_MODE_ORDER: GameMode[] = [
    GameMode.Hidden,
    GameMode.Missile,
    GameMode.Base,
    GameMode.Capture,
    GameMode.Speed,
];

const collectImpliedStrategicModes = (stage: SinglePlayerStageInfo): GameMode[] => {
    const raw: GameMode[] = [];
    if (((stage.hiddenCount ?? 0) > 0) || ((stage.scanCount ?? 0) > 0)) raw.push(GameMode.Hidden);
    if ((stage.missileCount ?? 0) > 0) raw.push(GameMode.Missile);
    if ((stage.baseStones ?? 0) > 0) raw.push(GameMode.Base);
    if ((stage.survivalTurns ?? 0) > 0 || (stage.blackTurnLimit ?? 0) > 0) raw.push(GameMode.Capture);
    // 따내기 mix는 저장 단계에서 autoScoringTurns를 제거한다(prune 직전 블록). 남아 있는 값으로 Speed를 implied하지 않음
    const p = stage.strategicRulePreset;
    const mixModes = p === 'mix' ? stage.mixedStrategicModes ?? [] : [];
    /** 믹스에서 `mixedStrategicModes`가 이미 2개 이상이면, 그 목록에 스피드가 없을 때는 `autoScoringTurns`만으로 스피드를 암시하지 않는다(베이스+히든 등 계가 수는 남기되 룰 조합은 관리자 선택을 존중). */
    const mixHasExplicitModeList =
        p === 'mix' &&
        Array.isArray(stage.mixedStrategicModes) &&
        stage.mixedStrategicModes.length >= 2;
    const autoScoringTurnsCanMeanSpeedRule =
        !p ||
        p === 'auto' ||
        p === 'speed' ||
        (p === 'mix' && !mixModes.includes(GameMode.Capture));
    const shouldImplySpeedFromAutoScoring =
        (stage.autoScoringTurns ?? 0) > 0 &&
        autoScoringTurnsCanMeanSpeedRule &&
        (!mixHasExplicitModeList || mixModes.includes(GameMode.Speed));
    if (shouldImplySpeedFromAutoScoring) raw.push(GameMode.Speed);
    return STRATEGIC_MODE_ORDER.filter((m) => raw.includes(m));
};

const mergeModeListsPreserveExistingOrder = (existing: GameMode[], implied: GameMode[]): GameMode[] => {
    const union = new Set<GameMode>([...existing, ...implied]);
    const pri: GameMode[] = [];
    const seen = new Set<GameMode>();
    for (const m of existing) {
        if (union.has(m) && !seen.has(m)) {
            seen.add(m);
            pri.push(m);
        }
    }
    for (const m of STRATEGIC_MODE_ORDER) {
        if (union.has(m) && !seen.has(m)) {
            seen.add(m);
            pri.push(m);
        }
    }
    return pri.slice(0, 5);
};

const modesSupportedByExplicitPreset = (preset: SinglePlayerStrategicRulePreset, stage: SinglePlayerStageInfo): GameMode[] => {
    switch (preset) {
        case 'capture':
        case 'survival':
            return [GameMode.Capture];
        case 'missile':
            return [GameMode.Missile];
        case 'hidden':
            return [GameMode.Hidden];
        case 'speed':
            return [GameMode.Speed];
        case 'base':
            return [GameMode.Base];
        case 'classic':
            return [];
        case 'mix':
            return Array.isArray(stage.mixedStrategicModes) ? [...stage.mixedStrategicModes] : [];
        default:
            return [];
    }
};

/** 단일 프리셋이 저장 필드와 맞지 않으면 mix로 승격해 prune가 미사일/히든/턴 한도 등을 삭제하지 않게 함 */
const repairStagePresetBeforePrune = (stage: SinglePlayerStageInfo): void => {
    const implied = collectImpliedStrategicModes(stage);
    if (implied.length === 0) return;

    const p = stage.strategicRulePreset;
    if (!p || p === 'auto') {
        if (implied.length >= 2) {
            stage.strategicRulePreset = 'mix';
            stage.mixedStrategicModes = ensureMixModesMinTwoAfterBaseCaptureSanitize(implied.slice(0, 5));
        }
        return;
    }

    if (p === 'mix') {
        const fallbackMix = [GameMode.Speed, GameMode.Capture];
        const existing =
            Array.isArray(stage.mixedStrategicModes) && stage.mixedStrategicModes.length >= 2
                ? stage.mixedStrategicModes
                : fallbackMix;
        stage.strategicRulePreset = 'mix';
        stage.mixedStrategicModes = ensureMixModesMinTwoAfterBaseCaptureSanitize(
            mergeModeListsPreserveExistingOrder(existing, implied).slice(0, 5)
        );
        return;
    }

    const supported = modesSupportedByExplicitPreset(p, stage);
    const missing = implied.filter((m) => !supported.includes(m));
    if (missing.length === 0) return;

    stage.strategicRulePreset = 'mix';
    stage.mixedStrategicModes = ensureMixModesMinTwoAfterBaseCaptureSanitize(
        mergeModeListsPreserveExistingOrder([...supported, ...implied], []).slice(0, 5)
    );
};

const pruneStageFieldsForExplicitRulePreset = (stage: SinglePlayerStageInfo): void => {
    const preset = stage.strategicRulePreset;
    if (!preset || preset === 'auto') return;

    const mixModes =
        preset === 'mix'
            ? (Array.isArray(stage.mixedStrategicModes) && stage.mixedStrategicModes.length >= 2
                ? stage.mixedStrategicModes
                : [GameMode.Speed, GameMode.Capture])
            : [];
    const keepsHidden = preset === 'hidden' || (preset === 'mix' && mixModes.includes(GameMode.Hidden));
    const keepsMissile = preset === 'missile' || (preset === 'mix' && mixModes.includes(GameMode.Missile));
    const keepsBase = preset === 'base' || (preset === 'mix' && mixModes.includes(GameMode.Base));
    const keepsCapture = preset === 'capture' || preset === 'survival' || (preset === 'mix' && mixModes.includes(GameMode.Capture));
    const keepsSurvival = preset === 'survival';
    // 편집기·인게임은 클래식/베이스/히든/미사일에서도 계가 수순을 쓸 수 있다. 여기서만 false면 저장 직후 필드가 사라져 0으로 보인다.
    const keepsAutoScoring =
        preset === 'classic'
        || preset === 'speed'
        || preset === 'base'
        || preset === 'hidden'
        || preset === 'missile'
        || (preset === 'mix' && !mixModes.includes(GameMode.Capture));

    if (!keepsHidden) deleteHiddenStageFields(stage);
    if (!keepsMissile) delete (stage as { missileCount?: number }).missileCount;
    if (!keepsBase) {
        delete (stage as { baseStones?: number }).baseStones;
        delete (stage as { singlePlayerAiBaseKomiBid?: SinglePlayerAiBaseKomiBid }).singlePlayerAiBaseKomiBid;
    } else if (keepsBase && (preset === 'base' || preset === 'mix')) {
        // 베이스(순수 또는 믹스): 미리 깔리는 돌 없음
        stage.placements = { black: 0, white: 0, blackPattern: 0, whitePattern: 0 };
        delete (stage as { centerBlackStoneChance?: number }).centerBlackStoneChance;
        delete (stage as { fixedOpening?: SinglePlayerStageInfo['fixedOpening'] }).fixedOpening;
        delete (stage as { mergeRandomPlacementsWithFixed?: boolean }).mergeRandomPlacementsWithFixed;
    }
    if (!keepsCapture) delete (stage as { blackTurnLimit?: number }).blackTurnLimit;
    if (!keepsSurvival) delete (stage as { survivalTurns?: number }).survivalTurns;
    if (!keepsAutoScoring) delete (stage as { autoScoringTurns?: number }).autoScoringTurns;
    if (preset !== 'mix') delete (stage as { mixedStrategicModes?: GameMode[] }).mixedStrategicModes;
};

const defaultSinglePlayerKataServerLevel = (level: SinglePlayerStageInfo['level']): number => {
    switch (level) {
        case '입문':
            return -31;
        case '초급':
            return -30;
        case '중급':
            return -29;
        case '고급':
            return -28;
        case '유단자':
            return -27;
        default:
            return -31;
    }
};

export const resolveSinglePlayerStageKataServerLevel = (stage: Pick<SinglePlayerStageInfo, 'level' | 'kataServerLevel'>): number =>
    clampInt(stage.kataServerLevel, -31, 9, defaultSinglePlayerKataServerLevel(stage.level));

export const resolveSinglePlayerKataServerLevelForGame = async (
    game: Pick<LiveGameSession, 'settings' | 'stageId' | 'singlePlayerStageDisplay'>
): Promise<number | undefined> => {
    const fromSettings = (game.settings as { kataServerLevel?: unknown } | undefined)?.kataServerLevel;
    if (typeof fromSettings === 'number' && Number.isFinite(fromSettings)) {
        return Math.max(-31, Math.min(9, Math.floor(fromSettings)));
    }

    const stageId = game.stageId;
    const display = game.singlePlayerStageDisplay;
    if (stageId && display?.id === stageId) {
        return resolveSinglePlayerStageKataServerLevel(display);
    }

    if (!stageId) return undefined;
    const stage = (await getEffectiveSinglePlayerStages()).find((s) => s.id === stageId);
    return stage ? resolveSinglePlayerStageKataServerLevel(stage) : undefined;
};

export const ensureSinglePlayerKataServerLevelOnGame = async (
    game: LiveGameSession
): Promise<number | undefined> => {
    if (!game.isSinglePlayer && String((game as { gameCategory?: unknown }).gameCategory ?? '') !== 'singleplayer') {
        return undefined;
    }
    const level = await resolveSinglePlayerKataServerLevelForGame(game);
    if (level === undefined) return undefined;
    if (!game.settings || typeof game.settings !== 'object') return level;
    (game.settings as { kataServerLevel?: number }).kataServerLevel = level;
    return level;
};

const clampPlacementsToCapacity = (
    placements: SinglePlayerStageInfo['placements'],
    capacity: number
): SinglePlayerStageInfo['placements'] => {
    let remaining = Math.max(0, capacity);
    const black = Math.min(placements.black, remaining);
    remaining -= black;
    const white = Math.min(placements.white, remaining);
    remaining -= white;
    const blackPattern = Math.min(placements.blackPattern, remaining);
    remaining -= blackPattern;
    const whitePattern = Math.min(placements.whitePattern, remaining);

    return {
        ...placements,
        black,
        white,
        blackPattern,
        whitePattern,
    };
};

const normalizeStage = (raw: unknown, fallback: StageRow): SinglePlayerStageInfo | null => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const boardSize = [7, 9, 11, 13].includes(Number(row.boardSize))
        ? (Number(row.boardSize) as SinglePlayerStageInfo['boardSize'])
        : fallback.boardSize;
    const fixedOpeningRaw = Array.isArray(row.fixedOpening) ? row.fixedOpening : fallback.fixedOpening;
    type FixedOpeningStone = NonNullable<SinglePlayerStageInfo['fixedOpening']>[number];
    const usedFixedCells = new Set<string>();
    const fixedOpening = fixedOpeningRaw
        ?.map((entry): FixedOpeningStone | null => {
            if (!entry || typeof entry !== 'object') return null;
            const s = entry as Record<string, unknown>;
            const color = s.color === 'black' || s.color === 'white' ? s.color : null;
            if (!color) return null;
            const x = clampInt(s.x, 0, boardSize - 1, 0);
            const y = clampInt(s.y, 0, boardSize - 1, 0);
            const kind: FixedOpeningStone['kind'] = s.kind === 'pattern' ? 'pattern' : 'plain';
            return { x, y, color, kind };
        })
        .filter((entry): entry is FixedOpeningStone => {
            if (!entry) return false;
            const key = `${entry.x}:${entry.y}`;
            if (usedFixedCells.has(key)) return false;
            usedFixedCells.add(key);
            return true;
        });

    const normalizedPlacements = clampPlacementsToCapacity(
        {
            black: clampInt((row.placements as any)?.black, 0, boardSize * boardSize, fallback.placements.black),
            white: clampInt((row.placements as any)?.white, 0, boardSize * boardSize, fallback.placements.white),
            blackPattern: clampInt((row.placements as any)?.blackPattern, 0, boardSize * boardSize, fallback.placements.blackPattern),
            whitePattern: clampInt((row.placements as any)?.whitePattern, 0, boardSize * boardSize, fallback.placements.whitePattern),
            centerBlackStoneChance: clampInt(
                (row.placements as any)?.centerBlackStoneChance,
                0,
                100,
                fallback.placements.centerBlackStoneChance ?? 0
            ),
        },
        boardSize * boardSize - (Boolean(row.mergeRandomPlacementsWithFixed) ? (fixedOpening?.length ?? 0) : 0)
    );

    const forcedAiResponsesRaw = Array.isArray(row.forcedAiResponses)
        ? (row.forcedAiResponses as unknown[])
        : [];
    const normalizePointInBoard = (value: unknown): { x: number; y: number } | null => {
        if (!value || typeof value !== 'object') return null;
        const v = value as Record<string, unknown>;
        return {
            x: clampInt(v.x, 0, boardSize - 1, 0),
            y: clampInt(v.y, 0, boardSize - 1, 0),
        };
    };
    type ForcedAiResponse = NonNullable<SinglePlayerStageInfo['forcedAiResponses']>[number];
    const forcedAiResponses: ForcedAiResponse[] = forcedAiResponsesRaw
        .map((entry): ForcedAiResponse | null => {
            if (!entry || typeof entry !== 'object') return null;
            const obj = entry as Record<string, unknown>;
            const move = normalizePointInBoard(obj.move);
            if (!move) return null;
            const whenOpponentStoneAt = normalizePointInBoard(obj.whenOpponentStoneAt);
            return whenOpponentStoneAt ? { move, whenOpponentStoneAt } : { move };
        })
        .filter((entry): entry is ForcedAiResponse => entry != null);
    const aiHiddenItemPlacementsRaw = Array.isArray(row.aiHiddenItemPlacements)
        ? (row.aiHiddenItemPlacements as unknown[])
        : [];
    const aiHiddenItemPlacements = aiHiddenItemPlacementsRaw
        .map((entry) => normalizePointInBoard(entry))
        .filter((entry): entry is { x: number; y: number } => entry != null)
        .slice(0, 12);

    const out: SinglePlayerStageInfo = {
        ...fallback,
        ...row,
        id: fallback.id,
        description: normalizeOptionalText(row.description, fallback.description, 1200),
        level: fallback.level,
        boardSize,
        actionPointCost: clampInt(row.actionPointCost, 0, 99, fallback.actionPointCost),
        targetScore: {
            black: clampInt((row.targetScore as any)?.black, 0, 999, fallback.targetScore.black),
            white: clampInt((row.targetScore as any)?.white, 0, 999, fallback.targetScore.white),
        },
        placements: normalizedPlacements,
        timeControl: normalizeTimeControl(row.timeControl, fallback.timeControl),
        blackTurnLimit: normalizeOptionalPositiveIntFromRow(row, 'blackTurnLimit', 999),
        survivalTurns: normalizeOptionalPositiveIntFromRow(row, 'survivalTurns', 999),
        hiddenCount: normalizeOptionalPositiveIntFromRow(row, 'hiddenCount', 99),
        scanCount: normalizeOptionalPositiveIntFromRow(row, 'scanCount', 99),
        aiHiddenItemTurns: normalizeOptionalPositiveIntList(row.aiHiddenItemTurns, 99, 12),
        aiHiddenItemUseWithinTurn: normalizeOptionalPositiveIntFromRow(row, 'aiHiddenItemUseWithinTurn', 99),
        aiHiddenItemUseCount: normalizeOptionalPositiveIntFromRow(row, 'aiHiddenItemUseCount', 12),
        aiHiddenItemPlacements: aiHiddenItemPlacements.length > 0 ? aiHiddenItemPlacements : undefined,
        disableAiHiddenItemUsage: row.disableAiHiddenItemUsage === true ? true : undefined,
        forceAiResponsesOnHiddenTurnsOnly: row.forceAiResponsesOnHiddenTurnsOnly === true ? true : undefined,
        missileCount: normalizeOptionalPositiveIntFromRow(row, 'missileCount', 99),
        autoScoringTurns: normalizeOptionalPositiveIntFromRow(row, 'autoScoringTurns', 999),
        rewards: (() => {
            const canonical = CANONICAL_SINGLE_PLAYER_REWARDS_BY_ID.get(fallback.id) ?? fallback.rewards;
            const rowRewards =
                row.rewards && typeof row.rewards === 'object'
                    ? (row.rewards as Record<string, unknown>)
                    : null;
            const normalizeCell = (
                cellRaw: unknown,
                fallbackCell: SinglePlayerStageInfo['rewards']['firstClear']
            ): SinglePlayerStageInfo['rewards']['firstClear'] => {
                const cell =
                    cellRaw && typeof cellRaw === 'object'
                        ? (cellRaw as Record<string, unknown>)
                        : null;
                const out: SinglePlayerStageInfo['rewards']['firstClear'] = {
                    gold: clampInt(cell?.gold, 0, 9_999_999, fallbackCell.gold ?? 0),
                    exp: clampInt(cell?.exp, 0, 9_999_999, fallbackCell.exp ?? 0),
                };
                const bonusRaw = cell?.bonus ?? fallbackCell.bonus;
                if (typeof bonusRaw === 'string' && bonusRaw.length > 0) out.bonus = bonusRaw;
                const items =
                    normalizeItemRewardList(cell?.items) ??
                    (Array.isArray(fallbackCell.items) && fallbackCell.items.length > 0
                        ? fallbackCell.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity }))
                        : undefined);
                if (items?.length) out.items = items;
                return out;
            };
            return {
                firstClear: normalizeCell(rowRewards?.firstClear, canonical.firstClear),
                repeatClear: normalizeCell(rowRewards?.repeatClear, canonical.repeatClear),
            };
        })(),
        baseStones: normalizeOptionalPositiveIntFromRow(row, 'baseStones', 20),
        singlePlayerAiBaseKomiBid: normalizeSinglePlayerAiBaseKomiBid((row as Record<string, unknown>).singlePlayerAiBaseKomiBid),
        fixedOpening: fixedOpening?.length ? fixedOpening : undefined,
        mergeRandomPlacementsWithFixed: Boolean(row.mergeRandomPlacementsWithFixed),
        allowPlacementRefresh: row.allowPlacementRefresh === false ? false : fallback.allowPlacementRefresh !== false,
        kataServerLevel: resolveSinglePlayerStageKataServerLevel({
            level: fallback.level,
            kataServerLevel: (row as any).kataServerLevel ?? (fallback as any).kataServerLevel,
        }),
        forcedAiResponses: forcedAiResponses.length > 0 ? forcedAiResponses : undefined,
        strictForcedAiResponses: row.strictForcedAiResponses === true ? true : undefined,
    };

    const presetRaw = (row as Record<string, unknown>).strategicRulePreset;
    if (typeof presetRaw === 'string' && (RULE_PRESETS as readonly string[]).includes(presetRaw)) {
        out.strategicRulePreset = presetRaw as SinglePlayerStrategicRulePreset;
    } else {
        delete (out as { strategicRulePreset?: SinglePlayerStrategicRulePreset }).strategicRulePreset;
    }
    const mixRaw = (row as Record<string, unknown>).mixedStrategicModes;
    if (Array.isArray(mixRaw) && mixRaw.length >= 2) {
        const allowed = new Set(Object.values(GameMode));
        const cleaned = mixRaw
            .map((m) => (typeof m === 'string' && allowed.has(m as GameMode) ? (m as GameMode) : null))
            .filter((m): m is GameMode => m != null);
        if (cleaned.length >= 2) {
            out.mixedStrategicModes = ensureMixModesMinTwoAfterBaseCaptureSanitize(cleaned).slice(0, 5);
        } else {
            delete (out as { mixedStrategicModes?: GameMode[] }).mixedStrategicModes;
        }
    } else {
        delete (out as { mixedStrategicModes?: GameMode[] }).mixedStrategicModes;
    }

    // 기본 슬롯과 merge되면 다른 룰 전용 필드가 남는다. repair가 implied로 mix로 승격하기 전에
    // 명시 프리셋에 맞게 잘라야 한다. (capture에 missile을 넣어 mix로 승격시키는 케이스는 여기서 지우지 않는다.)
    const pBeforeRepair = out.strategicRulePreset;
    if (
        pBeforeRepair === 'missile' ||
        pBeforeRepair === 'hidden' ||
        pBeforeRepair === 'base' ||
        pBeforeRepair === 'speed' ||
        pBeforeRepair === 'classic' ||
        pBeforeRepair === 'survival'
    ) {
        pruneStageFieldsForExplicitRulePreset(out);
    }

    repairStagePresetBeforePrune(out);
    if (out.strategicRulePreset === 'mix' && Array.isArray(out.mixedStrategicModes)) {
        const sanitized = ensureMixModesMinTwoAfterBaseCaptureSanitize(out.mixedStrategicModes);
        const same =
            sanitized.length === out.mixedStrategicModes.length &&
            sanitized.every((m, i) => m === out.mixedStrategicModes![i]);
        if (!same) {
            out.mixedStrategicModes = sanitized;
        }
    }
    if (out.strategicRulePreset === 'mix' && out.mixedStrategicModes?.includes(GameMode.Capture)) {
        delete (out as { autoScoringTurns?: number }).autoScoringTurns;
    }
    pruneStageFieldsForExplicitRulePreset(out);

    return out;
};

/** 전체 스테이지 배열이 기본 ID 집합과 1:1 대응하는 순열이면 true (관리자 순서 편집 저장) */
export const isFullSinglePlayerStagesPermutation = (raw: unknown): boolean => {
    if (!Array.isArray(raw)) return false;
    const fallbacks = DEFAULT_SINGLE_PLAYER_STAGES;
    const n = fallbacks.length;
    if (raw.length !== n) return false;
    const expected = new Set(fallbacks.map((s) => s.id));
    const seen = new Set<string>();
    for (const row of raw) {
        if (!row || typeof row !== 'object') return false;
        const id = typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id : '';
        if (!id || !expected.has(id) || seen.has(id)) return false;
        seen.add(id);
    }
    return seen.size === n;
};

export const normalizeSinglePlayerStagesOverride = (raw: unknown): SinglePlayerStageInfo[] => {
    if (!Array.isArray(raw)) return DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
    const fallbackById = new Map(DEFAULT_SINGLE_PLAYER_STAGES.map((row) => [row.id, row]));

    if (isFullSinglePlayerStagesPermutation(raw)) {
        return DEFAULT_SINGLE_PLAYER_STAGES.map((slotDefault, i) => {
            const row = raw[i] as Record<string, unknown>;
            const normalized = normalizeStage({ ...row, name: slotDefault.name }, slotDefault);
            return normalized ?? ({ ...slotDefault } as SinglePlayerStageInfo);
        });
    }

    const overrideById = new Map<string, unknown>();
    const used = new Set<string>();
    for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const id = typeof (row as any).id === 'string' ? (row as any).id : '';
        const fallback = fallbackById.get(id);
        if (!fallback || used.has(id)) continue;
        used.add(id);
        overrideById.set(id, row);
    }
    return DEFAULT_SINGLE_PLAYER_STAGES.map((fallback) => {
        const normalized = normalizeStage(overrideById.get(fallback.id) ?? fallback, fallback);
        return normalized ?? ({ ...fallback } as SinglePlayerStageInfo);
    });
};

export const getEffectiveSinglePlayerStages = async (): Promise<SinglePlayerStageInfo[]> => {
    const raw = await db.getKV<unknown>(SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY);
    if (!raw) return DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
    return normalizeSinglePlayerStagesOverride(raw);
};

export const setSinglePlayerStagesOverride = async (stages: SinglePlayerStageInfo[]): Promise<SinglePlayerStageInfo[]> => {
    const normalized = normalizeSinglePlayerStagesOverride(stages);
    await db.setKV(SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY, normalized);
    return normalized;
};

export const resolveSinglePlayerStage = async (stageId: string): Promise<SinglePlayerStageInfo | undefined> => {
    const stages = await getEffectiveSinglePlayerStages();
    return stages.find((stage) => stage.id === stageId);
};

