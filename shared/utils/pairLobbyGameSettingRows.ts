import { GameMode, Player, type GameSettings } from '../../types.js';
import {
    DEFAULT_GAME_SETTINGS,
    DEFAULT_KOMI,
    PLAYFUL_GAME_MODES,
    SPECIAL_GAME_MODES,
} from '../../constants.js';
import { isFischerStyleTimeControl } from './gameTimeControl.js';
import { getRankedGameSettings } from '../../constants/rankedGameSettings.js';
import { getAiScoringTurnLimitByBoardSize } from '../constants/gameSettings.js';
import { formatAlkkagiCurlingGaugeSpeedForLobbyDisplay } from './alkkagiCurlingGaugeLobbyDisplay.js';
import { mixSubRuleDisplayName } from './mixSubRuleDisplayName.js';

export type PairLobbyChannel = 'pair' | 'strategic' | 'playful';

export type PairLobbyRoomKind = 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai';

export type PairListRoomKindSource = {
    roomKind?: PairLobbyRoomKind | string;
    room_kind?: string;
    title?: string;
};

/** 서버·구버전 페이로드에서 방 종류 문자열 통일 */
export function normalizePairListRoomKind(room: PairListRoomKindSource): PairLobbyRoomKind | undefined {
    const raw = room.room_kind ?? room.roomKind;
    if (raw === 'friendly_4p' || raw === 'friendly4p') return 'friendly_4p';
    if (raw === 'friendly_2p' || raw === 'friendly2p') return 'friendly_2p';
    if (raw === 'duo_match' || raw === 'duoMatch') return 'duo_match';
    if (raw === 'ai_duel' || raw === 'aiDuel') return 'ai_duel';
    if (raw === 'arena_ai' || raw === 'arenaAi') return 'arena_ai';
    if (typeof raw === 'string' && ['friendly_4p', 'friendly_2p', 'duo_match', 'ai_duel', 'arena_ai'].includes(raw)) {
        return raw as PairLobbyRoomKind;
    }
    if (
        (raw === undefined || raw === null || raw === '') &&
        /님의\s*4인\s*페어방/i.test(String(room.title || ''))
    ) {
        return 'friendly_4p';
    }
    return undefined;
}

export function pairLobbyGameModeIconAndName(mode: GameMode | undefined): { image: string; name: string } {
    if (mode == null) return { image: '/images/simbols/simbol1.webp', name: '미정' };
    const spec = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    if (spec) return { image: spec.image, name: spec.name };
    const play = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
    if (play) return { image: play.image, name: play.name };
    return { image: '/images/simbols/simbol1.webp', name: String(mode) };
}

export function pairLobbyScheduledGameModeLabel(mode: GameMode | undefined): string {
    if (mode == null) return '';
    return pairLobbyGameModeIconAndName(mode).name;
}

function pairLobbyMixedSubModeNames(modes: GameMode[] | undefined): string {
    if (!modes?.length) return '';
    return modes.map((m) => mixSubRuleDisplayName(pairLobbyGameModeIconAndName(m).name)).join(' · ');
}

function pairLobbyAiStepRowValue(g: GameSettings): string | null {
    const n = typeof g.aiDifficulty === 'number' && Number.isFinite(g.aiDifficulty) ? Math.round(g.aiDifficulty) : null;
    if (n != null) return `${n}단계`;
    const m = typeof g.goAiBotLevel === 'number' && Number.isFinite(g.goAiBotLevel) ? Math.round(g.goAiBotLevel) : null;
    if (m != null) return `${m}단계`;
    return null;
}

export function pairLobbyModeIncludesCaptureRule(mode: GameMode, mixed?: GameMode[]): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(mixed?.includes(GameMode.Capture)));
}

/** `AiChallengeModal`(페어·전략·놀이 방 만들기)의 `showGoAiLevel`과 동일 */
function pairLobbyShowKataAiLevelInCreateModal(
    roomKind: PairLobbyRoomKind | undefined,
    lobbyChannel: PairLobbyChannel | undefined,
): boolean {
    if (lobbyChannel === 'playful') return false;
    if (!roomKind) return false;
    if (roomKind === 'friendly_4p' || roomKind === 'friendly_2p') return false;
    if (roomKind === 'duo_match' && lobbyChannel === 'strategic') return false;
    return true;
}

/** 놀이바둑 방 내부 설정 패널: 값이 4글자 초과면 앞 3글자 + … */
export function truncatePlayfulLobbySettingDisplayValue(text: string): string {
    const t = String(text ?? '');
    if (t.length > 4) return `${t.slice(0, 3)}...`;
    return t;
}

function pairLobbyPlayerOrderOrRoleRow(mode: GameMode, g: GameSettings): { label: string; value: string } | null {
    if (mode === GameMode.Thief) {
        if (g.player1Color === Player.Black) return { label: '역할', value: '도둑 (흑)' };
        if (g.player1Color === Player.White) return { label: '역할', value: '경찰 (백)' };
        return { label: '역할', value: '랜덤' };
    }
    if (mode === GameMode.Dice || mode === GameMode.Alkkagi || mode === GameMode.Curling) {
        if (g.player1Color === Player.Black) {
            return { label: '순서', value: mode === GameMode.Dice ? '선공' : '선공 (흑)' };
        }
        if (g.player1Color === Player.White) {
            return { label: '순서', value: mode === GameMode.Dice ? '후공' : '후공 (백)' };
        }
        return { label: '순서', value: '랜덤' };
    }
    return null;
}

export type PairLobbyGameSettingRoomInput = PairListRoomKindSource & {
    selectedGameMode?: GameMode | null;
    settings?: Partial<GameSettings> | null;
    lobbyChannel?: PairLobbyChannel;
};

export type BuildPairLobbyGameSettingRowsOptions = {
    lobbyChannelFallback?: PairLobbyChannel;
    /** 전략바둑 랭킹전 매칭 모달: 방 만들기와 동일한 시계·계가·자동계가 행을 pair 경기장 채널에서도 표시 */
    rankedStrategicMatchPreset?: boolean;
};

/**
 * 대국 설정(방 내부·제안 요약 표용).
 * 페어·전략·놀이 경기장(`lobbyChannel` 또는 폴백)에서는 방 만들기 모달에 있는 항목만 표시해
 * 저장값(무제한 시계·숨은 기본값)과 표시가 어긋나지 않게 한다.
 */
export function buildPairRoomLobbyGameSettingRows(
    room: PairLobbyGameSettingRoomInput,
    options?: BuildPairLobbyGameSettingRowsOptions,
): { label: string; value: string }[] {
    const mode = room.selectedGameMode;
    if (!mode) return [];
    const g = { ...DEFAULT_GAME_SETTINGS, ...(room.settings || {}) } as GameSettings;
    const roomKind = normalizePairListRoomKind(room);
    const lobbyChannel = room.lobbyChannel ?? options?.lobbyChannelFallback;
    const pairArenaInterior = lobbyChannel === 'pair' || lobbyChannel === 'strategic' || lobbyChannel === 'playful';
    const ext = Boolean(options?.rankedStrategicMatchPreset);
    const rows: { label: string; value: string }[] = [];

    const modesWithKomi = [
        GameMode.Standard,
        GameMode.Speed,
        GameMode.Base,
        GameMode.Hidden,
        GameMode.Missile,
        GameMode.Mix,
    ];
    const modesWithoutTime = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief];
    const modesWithoutBoardGrid = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief];

    const hideScoringTurnLimit =
        ext
            ? false
            : lobbyChannel === 'playful' ||
              (lobbyChannel === 'pair' && roomKind === 'friendly_2p') ||
              (roomKind !== 'ai_duel' &&
                  roomKind !== 'arena_ai' &&
                  (lobbyChannel !== 'pair' || (roomKind !== 'duo_match' && roomKind !== 'friendly_2p')));
    const showKataAiLevel = ext ? false : pairLobbyShowKataAiLevelInCreateModal(roomKind, lobbyChannel);
    const captureRuleSelected = pairLobbyModeIncludesCaptureRule(mode, g.mixedModes);
    const showScoringTurnLimitRow =
        pairArenaInterior &&
        !hideScoringTurnLimit &&
        (showKataAiLevel || ext) &&
        !captureRuleSelected &&
        typeof g.scoringTurnLimit === 'number' &&
        g.scoringTurnLimit > 0;

    /** `AiChallengeModal`: AI단계 → 판 크기 → 계가까지 턴 → 믹스… 순 */
    if (pairArenaInterior && showKataAiLevel) {
        const kata = typeof g.kataServerLevel === 'number' && Number.isFinite(g.kataServerLevel) ? g.kataServerLevel : -12;
        const levelOpt = [
            { value: -31, label: '1단계' },
            { value: -25, label: '2단계' },
            { value: -21, label: '3단계' },
            { value: -15, label: '4단계' },
            { value: -12, label: '5단계' },
            { value: -8, label: '6단계' },
            { value: -3, label: '7단계' },
            { value: -1, label: '8단계' },
            { value: 3, label: '9단계' },
            { value: 5, label: '10단계' },
        ].find((o) => o.value === kata);
        rows.push({ label: 'AI단계', value: levelOpt?.label ?? `${kata}` });
    }

    if (!modesWithoutBoardGrid.includes(mode) && typeof g.boardSize === 'number') {
        rows.push({ label: '판 크기', value: `${g.boardSize}×${g.boardSize}` });
    }

    if (showScoringTurnLimitRow) {
        rows.push({ label: '계가까지', value: `${g.scoringTurnLimit}수` });
    }

    if (mode === GameMode.Mix && g.mixedModes?.length) {
        rows.push({ label: '조합 규칙', value: pairLobbyMixedSubModeNames(g.mixedModes) });
    }

    if (modesWithKomi.includes(mode) && !g.mixedModes?.includes(GameMode.Base)) {
        rows.push({ label: '덤', value: String(g.komi ?? DEFAULT_KOMI) });
    }

    /** 페어 4·2인 친선 + 전략·놀이 친선전(duo_match): 경기장 내부 요약에도 사람 vs 사람 시계 표시(페어 2인 랭킹 duo_match 제외) */
    const showHumanPvPClockInArenaInterior =
        pairArenaInterior &&
        !ext &&
        ((lobbyChannel === 'pair' && (roomKind === 'friendly_4p' || roomKind === 'friendly_2p')) ||
            ((lobbyChannel === 'strategic' || lobbyChannel === 'playful') && roomKind === 'duo_match'));
    if ((!pairArenaInterior || ext || showHumanPvPClockInArenaInterior) && !modesWithoutTime.includes(mode)) {
        const humanPvP = roomKind === 'duo_match' || roomKind === 'friendly_4p' || roomKind === 'friendly_2p';
        const def = DEFAULT_GAME_SETTINGS;
        let timeLimit = typeof g.timeLimit === 'number' ? g.timeLimit : def.timeLimit;
        let byoyomiTime = g.byoyomiTime ?? 0;
        let byoyomiCount = g.byoyomiCount ?? 0;
        let timeIncrement = g.timeIncrement ?? 0;
        if (humanPvP && timeLimit <= 0 && byoyomiTime <= 0 && byoyomiCount <= 0 && timeIncrement <= 0) {
            timeLimit = def.timeLimit;
            byoyomiTime = def.byoyomiTime;
            byoyomiCount = def.byoyomiCount;
            timeIncrement = def.timeIncrement ?? 0;
        }
        const clockSettings = { ...g, timeLimit, byoyomiTime, byoyomiCount, timeIncrement };
        const pseudoSession = { mode, settings: clockSettings };
        const isFischer = isFischerStyleTimeControl(pseudoSession as Parameters<typeof isFischerStyleTimeControl>[0]);
        if (timeLimit > 0) {
            rows.push({ label: '제한시간', value: `${timeLimit}분` });
            rows.push({
                label: '초읽기',
                value: isFischer
                    ? `${timeIncrement}초 피셔`
                    : `${byoyomiTime}초 ${byoyomiCount}회`,
            });
        } else {
            rows.push({ label: '제한시간', value: '없음' });
            if (byoyomiTime > 0 && byoyomiCount > 0) {
                rows.push({
                    label: '초읽기',
                    value: isFischer ? `${timeIncrement}초 피셔` : `${byoyomiTime}초 ${byoyomiCount}회`,
                });
            }
        }
    }

    if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
        rows.push({ label: '쌍삼 금지', value: g.has33Forbidden ? '금지' : '가능' });
        rows.push({ label: '장목 금지', value: g.hasOverlineForbidden ? '금지' : '가능' });
    }
    if (mode === GameMode.Ttamok && typeof g.captureTarget === 'number') {
        rows.push({ label: '따목 목표점수', value: `${g.captureTarget}개` });
    }

    if (mode === GameMode.Capture || (mode === GameMode.Mix && g.mixedModes?.includes(GameMode.Capture))) {
        if (typeof g.captureTarget === 'number') {
            rows.push({ label: '목표점수', value: `${g.captureTarget}개` });
        }
    }

    if (mode === GameMode.Base || (mode === GameMode.Mix && g.mixedModes?.includes(GameMode.Base))) {
        if (typeof g.baseStones === 'number') rows.push({ label: '베이스돌', value: `${g.baseStones}개` });
    }

    if (mode === GameMode.Hidden || (mode === GameMode.Mix && g.mixedModes?.includes(GameMode.Hidden))) {
        rows.push({ label: '히든돌', value: `${g.hiddenStoneCount ?? 0}개` });
        rows.push({ label: '스캔', value: `${g.scanCount ?? 0}개` });
    }

    if (mode === GameMode.Missile || (mode === GameMode.Mix && g.mixedModes?.includes(GameMode.Missile))) {
        rows.push({ label: '미사일', value: `${g.missileCount ?? 0}개` });
    }

    if (!pairArenaInterior && !ext && typeof g.scoringTurnLimit === 'number' && g.scoringTurnLimit > 0) {
        rows.push({ label: '계가 턴 제한', value: `${g.scoringTurnLimit}턴` });
    }

    if (!pairArenaInterior && !ext && (roomKind === 'ai_duel' || roomKind === 'arena_ai')) {
        const aiStep = pairLobbyAiStepRowValue(g);
        if (aiStep) {
            rows.push({ label: 'AI단계', value: aiStep });
        }
    }

    if ((!pairArenaInterior || ext) && typeof g.autoScoring === 'boolean') {
        rows.push({ label: '자동 계가', value: g.autoScoring ? '예' : '아니오' });
    }

    const showPlayerOrderRoleRow =
        pairArenaInterior &&
        !(lobbyChannel === 'playful' && roomKind === 'duo_match');
    const orderRow = showPlayerOrderRoleRow ? pairLobbyPlayerOrderOrRoleRow(mode, g) : null;
    if (orderRow) rows.push(orderRow);

    if (mode === GameMode.Dice) {
        if ((!pairArenaInterior || ext) && g.diceGoVariant) rows.push({ label: '주사위 규칙', value: String(g.diceGoVariant) });
        if (typeof g.diceGoRounds === 'number') rows.push({ label: '라운드', value: String(g.diceGoRounds) });
        rows.push({ label: '홀수주사위', value: `${g.oddDiceCount ?? 0}개` });
        rows.push({ label: '짝수주사위', value: `${g.evenDiceCount ?? 0}개` });
        rows.push({ label: '(고)주사위', value: `${g.highDiceCount ?? 0}개` });
        rows.push({ label: '(저)주사위', value: `${g.lowDiceCount ?? 0}개` });
        if ((!pairArenaInterior || ext) && typeof g.diceGoItemCount === 'number') {
            rows.push({ label: '아이템', value: `${g.diceGoItemCount}개` });
        }
    }

    if (mode === GameMode.Thief) {
        rows.push({ label: '(고)주사위', value: `${g.thiefHigh36ItemCount ?? 0}개` });
        rows.push({ label: '방지주사위', value: `${g.thiefNoOneItemCount ?? 0}개` });
    }

    if (mode === GameMode.Alkkagi) {
        if (g.alkkagiPlacementType) rows.push({ label: '배치', value: String(g.alkkagiPlacementType) });
        if ((!pairArenaInterior || ext) && g.alkkagiLayout) rows.push({ label: '알까기 레이아웃', value: String(g.alkkagiLayout) });
        if (typeof g.alkkagiRounds === 'number') rows.push({ label: '라운드', value: String(g.alkkagiRounds) });
        if (typeof g.alkkagiStoneCount === 'number') rows.push({ label: '돌 개수', value: String(g.alkkagiStoneCount) });
        if (typeof g.alkkagiGaugeSpeed === 'number') {
            rows.push({ label: '힘 속도', value: formatAlkkagiCurlingGaugeSpeedForLobbyDisplay(g.alkkagiGaugeSpeed) });
        }
        if (typeof g.alkkagiSlowItemCount === 'number') rows.push({ label: '슬로우', value: `${g.alkkagiSlowItemCount}개` });
        if (typeof g.alkkagiAimingLineItemCount === 'number') {
            rows.push({ label: '조준선', value: `${g.alkkagiAimingLineItemCount}개` });
        }
        if ((!pairArenaInterior || ext) && typeof g.alkkagiItemCount === 'number') {
            rows.push({ label: '아이템', value: `${g.alkkagiItemCount}개` });
        }
    }

    if (mode === GameMode.Curling) {
        if (typeof g.curlingStoneCount === 'number') rows.push({ label: '스톤 수', value: String(g.curlingStoneCount) });
        if (typeof g.curlingGaugeSpeed === 'number') {
            rows.push({ label: '힘 속도', value: formatAlkkagiCurlingGaugeSpeedForLobbyDisplay(g.curlingGaugeSpeed) });
        }
        if (typeof g.curlingSlowItemCount === 'number') rows.push({ label: '슬로우', value: `${g.curlingSlowItemCount}개` });
        if (typeof g.curlingAimingLineItemCount === 'number') {
            rows.push({ label: '조준선', value: `${g.curlingAimingLineItemCount}개` });
        }
        if (typeof g.curlingRounds === 'number') rows.push({ label: '라운드', value: String(g.curlingRounds) });
    }

    return rows;
}

export type PairLobbySettingChangeDiffRow = {
    label: string;
    before: string;
    after: string;
};

/** 손님 변경 제안 시 방장 전용 필드 — 서버 `stripPairLobbyGuestForbiddenSettingsPatch`와 동일 */
export function stripPairLobbyGuestProposableSettings(settings: GameSettings): GameSettings {
    const next = { ...settings };
    delete (next as { komi?: number }).komi;
    delete (next as { baseStones?: number }).baseStones;
    delete (next as { captureTarget?: number }).captureTarget;
    return next;
}

/** 방 내부 표시 행 기준으로 기존·제안 대국 설정 차이만 추출 */
export function buildPairLobbySettingChangeDiffRows(
    baseRoom: PairLobbyGameSettingRoomInput,
    proposedSettings: Partial<GameSettings> | null | undefined,
    options?: BuildPairLobbyGameSettingRowsOptions,
): PairLobbySettingChangeDiffRow[] {
    const baseSettings = { ...DEFAULT_GAME_SETTINGS, ...(baseRoom.settings ?? {}) } as GameSettings;
    const mergedProposed = stripPairLobbyGuestProposableSettings({
        ...baseSettings,
        ...(proposedSettings && typeof proposedSettings === 'object' ? proposedSettings : {}),
    });
    const beforeRows = buildPairRoomLobbyGameSettingRows({ ...baseRoom, settings: baseSettings }, options);
    const afterRows = buildPairRoomLobbyGameSettingRows({ ...baseRoom, settings: mergedProposed }, options);
    const beforeMap = new Map(beforeRows.map((row) => [row.label, row.value]));
    const afterMap = new Map(afterRows.map((row) => [row.label, row.value]));
    const labelOrder: string[] = [];
    for (const row of beforeRows) {
        if (!labelOrder.includes(row.label)) labelOrder.push(row.label);
    }
    for (const row of afterRows) {
        if (!labelOrder.includes(row.label)) labelOrder.push(row.label);
    }
    const diffs: PairLobbySettingChangeDiffRow[] = [];
    for (const label of labelOrder) {
        const before = beforeMap.get(label) ?? '—';
        const after = afterMap.get(label) ?? '—';
        if (before !== after) diffs.push({ label, before, after });
    }
    return diffs;
}

/** 전략바둑 랭킹전 매칭 모달용: `getRankedGameSettings` + 방 만들기와 동일한 행 구성 */
export function buildRankedStrategicMatchLobbySettingRows(mode: GameMode): { label: string; value: string }[] {
    const g: GameSettings = {
        ...DEFAULT_GAME_SETTINGS,
        ...getRankedGameSettings(mode),
    };
    if (!pairLobbyModeIncludesCaptureRule(mode, g.mixedModes) && SPECIAL_GAME_MODES.some((m) => m.mode === mode)) {
        g.scoringTurnLimit = getAiScoringTurnLimitByBoardSize(g.boardSize ?? DEFAULT_GAME_SETTINGS.boardSize ?? 19);
    }
    return buildPairRoomLobbyGameSettingRows(
        {
            selectedGameMode: mode,
            settings: g,
            roomKind: 'duo_match',
            title: '',
            lobbyChannel: 'strategic',
        },
        { lobbyChannelFallback: 'strategic', rankedStrategicMatchPreset: true },
    );
}

/** 페어 경기장 「2인 랭킹전」방 만들기: 유저+유저 팀 vs 유저+유저 팀 — 공식 랭킹 규칙 요약 */
export function buildPairArenaDuoRankedLobbySettingRows(mode: GameMode): { label: string; value: string }[] {
    const g: GameSettings = {
        ...DEFAULT_GAME_SETTINGS,
        ...getRankedGameSettings(mode),
    };
    if (!pairLobbyModeIncludesCaptureRule(mode, g.mixedModes) && SPECIAL_GAME_MODES.some((m) => m.mode === mode)) {
        g.scoringTurnLimit = getAiScoringTurnLimitByBoardSize(g.boardSize ?? DEFAULT_GAME_SETTINGS.boardSize ?? 19);
    }
    return buildPairRoomLobbyGameSettingRows(
        {
            selectedGameMode: mode,
            settings: g,
            roomKind: 'duo_match',
            title: '',
            lobbyChannel: 'pair',
        },
        { lobbyChannelFallback: 'pair', rankedStrategicMatchPreset: true },
    );
}

/** 알까기·컬링·주사위: 고정 물리 판(19줄 기준) — 다른 모드의 `boardSize`가 섞이지 않게 */
const PAIR_LOBBY_MODES_WITHOUT_GO_BOARD_SIZE: readonly GameMode[] = [
    GameMode.Alkkagi,
    GameMode.Curling,
    GameMode.Dice,
];

export function pairLobbyDraftBoardSizeOptions(
    mode: GameMode,
    lobbyType: 'strategic' | 'playful',
): readonly number[] {
    if (PAIR_LOBBY_MODES_WITHOUT_GO_BOARD_SIZE.includes(mode)) return [19];
    if (lobbyType === 'strategic') {
        const restrictedStrategicModes: GameMode[] = [
            GameMode.Capture,
            GameMode.Base,
            GameMode.Hidden,
            GameMode.Missile,
            GameMode.Mix,
        ];
        if (restrictedStrategicModes.includes(mode)) return [9, 13];
        return [9, 13, 19];
    }
    if (mode === GameMode.Omok || mode === GameMode.Ttamok) return [19, 15];
    if (mode === GameMode.Thief) return [9, 13, 19];
    if (mode === GameMode.Capture) return [13, 11, 9, 7];
    if (mode === GameMode.Hidden) return [19, 13, 11, 9, 7];
    if (mode === GameMode.Missile) return [19, 13, 9];
    if (mode === GameMode.Speed) return [7, 9, 11, 13, 19];
    if (mode === GameMode.Standard) return [9, 13, 19];
    return [19, 13, 9];
}

/** 방 만들기 초안: 모드·로비에 맞지 않는 판 크기·계가 턴 등 제거 */
export function sanitizePairLobbyDraftModeSettings(
    mode: GameMode,
    settings: GameSettings,
    lobbyType: 'strategic' | 'playful',
): GameSettings {
    let next: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settings };
    if (PAIR_LOBBY_MODES_WITHOUT_GO_BOARD_SIZE.includes(mode)) {
        next.boardSize = 19 as GameSettings['boardSize'];
        delete (next as { scoringTurnLimit?: number }).scoringTurnLimit;
        delete (next as { autoScoringTurns?: number }).autoScoringTurns;
        return next;
    }
    const validBoardSizes = pairLobbyDraftBoardSizeOptions(mode, lobbyType);
    const rawBs = next.boardSize as unknown;
    const bsNum =
        typeof rawBs === 'number' && Number.isFinite(rawBs)
            ? rawBs
            : typeof rawBs === 'string' && String(rawBs).trim() !== ''
              ? Number.parseInt(String(rawBs), 10)
              : NaN;
    if (!Number.isFinite(bsNum) || !validBoardSizes.includes(bsNum)) {
        next.boardSize = validBoardSizes[0] as GameSettings['boardSize'];
    } else if (typeof rawBs === 'string') {
        next.boardSize = bsNum as GameSettings['boardSize'];
    }
    return next;
}
