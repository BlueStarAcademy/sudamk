/** Legacy Korean server error fragments — match only, not displayed in UI. */
const KO_SHAPE_ERROR_MARKERS = ['패 모양', '코 금지'] as const;
const GAME_ALREADY_STARTED_MARKERS = ['이미 시작', 'already started'] as const;
const BASE_STONE_COLOR_BENIGN_MARKERS = ['선호 돌 선택 단계가 아닙니다', '이미 선택했습니다'] as const;
const ACTION_POINTS_MARKERS = ['액션 포인트', '행동력'] as const;
const GAME_NOT_FOUND_MARKERS = ['게임을 찾을 수 없습니다', '게임 정보를 찾을 수 없습니다'] as const;
const GAME_ALREADY_ENDED_MARKERS = ['이미 종료된', 'already ended', 'Game not in playing state'] as const;
const INVENTORY_FULL_MARKERS = /가방|인벤토리|공간/;

export function shouldSuppressKoPlaceStoneClientError(errorMessage: string): boolean {
    return (
        KO_SHAPE_ERROR_MARKERS.some((m) => errorMessage.includes(m)) ||
        (errorMessage.includes('바로') && errorMessage.includes('따낼')) ||
        (errorMessage.includes('같은 위치') && errorMessage.includes('다시'))
    );
}

export function isGameAlreadyStartedError(errorMessage: string): boolean {
    return GAME_ALREADY_STARTED_MARKERS.some((m) => errorMessage.includes(m));
}

export function isBaseStoneColorChoiceBenignError(errorMessage: string): boolean {
    return BASE_STONE_COLOR_BENIGN_MARKERS.some((m) => errorMessage.includes(m));
}

export function isInsufficientActionPointsServerError(errorMessage: string): boolean {
    return ACTION_POINTS_MARKERS.some((m) => errorMessage.includes(m));
}

export function isGameNotFoundServerError(errorMessage: string): boolean {
    return /game not found/i.test(errorMessage) || GAME_NOT_FOUND_MARKERS.some((m) => errorMessage.includes(m));
}

export function isGameAlreadyEndedServerError(errorMessage: string): boolean {
    return (
        GAME_ALREADY_ENDED_MARKERS.some((m) => errorMessage.includes(m)) ||
        /game not in playing state/i.test(errorMessage)
    );
}

export function isInventoryFullServerError(errorMessage: string): boolean {
    return INVENTORY_FULL_MARKERS.test(errorMessage);
}

