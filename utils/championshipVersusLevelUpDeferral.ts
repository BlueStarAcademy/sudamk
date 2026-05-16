/** 챔피언십 장내 카타: `START_CHAMPIONSHIP_VERSUS_KATA_DUEL` 직후 재생·결과 모달 전까지 레벨업 축하 모달 지연 */

type FlushDeferredLevelUp = () => void;

let kataRewardsPending = false;
let flushDeferredLevelUp: FlushDeferredLevelUp | null = null;

export function registerChampionshipVersusDeferredLevelUpFlush(cb: FlushDeferredLevelUp | null): void {
    flushDeferredLevelUp = cb;
}

export function shouldDeferLevelUpCelebrationForChampionshipVersusKata(): boolean {
    return kataRewardsPending;
}

export function markChampionshipVersusKataRewardsPending(): void {
    kataRewardsPending = true;
}

export function clearChampionshipVersusKataRewardsPending(): void {
    kataRewardsPending = false;
}

/** 대국 결과 모달 표시 시점(또는 경기장 이탈 시) 보류 중이던 레벨업 축하 모달을 연다. */
export function flushChampionshipVersusDeferredLevelUp(): void {
    if (!kataRewardsPending) return;
    kataRewardsPending = false;
    flushDeferredLevelUp?.();
}
