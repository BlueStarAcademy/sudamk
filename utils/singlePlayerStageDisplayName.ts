import type { TFunction } from 'i18next';
import { SinglePlayerLevel, type SinglePlayerStageInfo } from '../types.js';
import { singlePlayerMapNameKo } from '../shared/utils/singlePlayerMapDisplayName.js';

const LEVEL_TO_STAGE_KEY: Record<SinglePlayerLevel, string> = {
    [SinglePlayerLevel.입문]: 'intro',
    [SinglePlayerLevel.초급]: 'beginner',
    [SinglePlayerLevel.중급]: 'intermediate',
    [SinglePlayerLevel.고급]: 'advanced',
    [SinglePlayerLevel.유단자]: 'master',
};

/** 반(맵) i18n 키 — `profile:stageLabels.*` / `game:singlePlayerDesc.*` 공용 */
export function singlePlayerLevelStageKey(level: SinglePlayerLevel | undefined): string {
    if (!level) return 'intro';
    return LEVEL_TO_STAGE_KEY[level] ?? 'intro';
}

/** 인게임·모달·사이드바용: `천상의 탑 1` 형식 */
export function formatSinglePlayerStageShortName(
    stage: Pick<SinglePlayerStageInfo, 'id' | 'level'>,
    t: TFunction,
): string {
    const key = singlePlayerLevelStageKey(stage.level);
    const translated = t(`profile:stageLabels.${key}`);
    const mapName =
        !translated || translated === `profile:stageLabels.${key}` || translated === `stageLabels.${key}`
            ? singlePlayerMapNameKo(stage.level)
            : translated;
    const stageNum = stage.id.split('-').pop() ?? '';
    return /^\d+$/.test(stageNum) ? `${mapName} ${stageNum}` : mapName;
}
