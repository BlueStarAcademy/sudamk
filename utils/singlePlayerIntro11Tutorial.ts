const INTRO11_ACTIVE_PREFIX = 'sp-intro11-tutorial-active:';
const INTRO11_INGAME_READ_PREFIX = 'sp-intro11-tutorial-ingame-read:';
const INTRO11_RESULT_READ_PREFIX = 'sp-intro11-tutorial-result-read:';

const hasWindow = (): boolean => typeof window !== 'undefined';

export const isIntro11TutorialActiveForGame = (gameId: string): boolean => {
    if (!hasWindow()) return false;
    return window.sessionStorage.getItem(`${INTRO11_ACTIVE_PREFIX}${gameId}`) === '1';
};

export const activateIntro11TutorialForGame = (gameId: string): void => {
    if (!hasWindow()) return;
    window.sessionStorage.setItem(`${INTRO11_ACTIVE_PREFIX}${gameId}`, '1');
};

export const clearIntro11TutorialForGame = (gameId: string): void => {
    if (!hasWindow()) return;
    window.sessionStorage.removeItem(`${INTRO11_ACTIVE_PREFIX}${gameId}`);
    window.sessionStorage.removeItem(`${INTRO11_INGAME_READ_PREFIX}${gameId}`);
    window.sessionStorage.removeItem(`${INTRO11_RESULT_READ_PREFIX}${gameId}`);
};

export const isIntro11IngameStepRead = (gameId: string): boolean => {
    if (!hasWindow()) return false;
    return window.sessionStorage.getItem(`${INTRO11_INGAME_READ_PREFIX}${gameId}`) === '1';
};

export const markIntro11IngameStepRead = (gameId: string): void => {
    if (!hasWindow()) return;
    window.sessionStorage.setItem(`${INTRO11_INGAME_READ_PREFIX}${gameId}`, '1');
};

export const isIntro11ResultStepRead = (gameId: string): boolean => {
    if (!hasWindow()) return false;
    return window.sessionStorage.getItem(`${INTRO11_RESULT_READ_PREFIX}${gameId}`) === '1';
};

export const markIntro11ResultStepRead = (gameId: string): void => {
    if (!hasWindow()) return;
    window.sessionStorage.setItem(`${INTRO11_RESULT_READ_PREFIX}${gameId}`, '1');
};
