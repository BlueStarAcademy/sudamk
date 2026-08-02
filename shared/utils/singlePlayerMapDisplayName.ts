import { SinglePlayerLevel } from '../types/enums.js';

/** 모험 맵(반) 표시명 — KO 기본(서버·폴백). UI는 i18n `profile:stageLabels.*` 우선. */
export const SINGLE_PLAYER_MAP_NAME_KO: Record<SinglePlayerLevel, string> = {
    [SinglePlayerLevel.입문]: '새싹의 숲',
    [SinglePlayerLevel.초급]: '바람의 언덕',
    [SinglePlayerLevel.중급]: '별빛 계곡',
    [SinglePlayerLevel.고급]: '용암의 성채',
    [SinglePlayerLevel.유단자]: '천상의 탑',
};

export const SINGLE_PLAYER_MAP_NAME_EN: Record<SinglePlayerLevel, string> = {
    [SinglePlayerLevel.입문]: 'Sproutwood',
    [SinglePlayerLevel.초급]: 'Windy Hills',
    [SinglePlayerLevel.중급]: 'Starlit Vale',
    [SinglePlayerLevel.고급]: 'Ember Keep',
    [SinglePlayerLevel.유단자]: 'Celestial Spire',
};

export function singlePlayerMapNameKo(level: SinglePlayerLevel | undefined): string {
    if (!level) return SINGLE_PLAYER_MAP_NAME_KO[SinglePlayerLevel.입문];
    return SINGLE_PLAYER_MAP_NAME_KO[level] ?? SINGLE_PLAYER_MAP_NAME_KO[SinglePlayerLevel.입문];
}

/** `새싹의 숲 1` — 서버 메시지·비 i18n 경로용 */
export function formatSinglePlayerStageNameKo(stage: { id: string; level: SinglePlayerLevel }): string {
    const mapName = singlePlayerMapNameKo(stage.level);
    const stageNum = String(stage.id).split('-').pop() ?? '';
    return /^\d+$/.test(stageNum) ? `${mapName} ${stageNum}` : mapName;
}
