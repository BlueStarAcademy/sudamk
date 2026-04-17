const STORAGE_KEY = 'sudamr:ob-bag-tutorial-step';
export const ONBOARDING_BAG_TUTORIAL_STEP_EVENT = 'sudamr-onboarding-bag-step-changed';

/** phase 9 가방 튜토리얼 서브: 0=가방 아이콘, 1=부채 슬롯, 2=장착 버튼, 3=능력치·장착 패널, 4=닫기 */
export function getOnboardingBagTutorialStep(): number {
    if (typeof window === 'undefined') return 0;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const n = raw == null ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 4) return 0;
    return Math.floor(n);
}

export function setOnboardingBagTutorialStep(step: number): void {
    if (typeof window === 'undefined') return;
    const n = Math.max(0, Math.min(4, Math.floor(step)));
    sessionStorage.setItem(STORAGE_KEY, String(n));
    window.dispatchEvent(new CustomEvent(ONBOARDING_BAG_TUTORIAL_STEP_EVENT, { detail: n }));
}

export function clearOnboardingBagTutorialStep(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(ONBOARDING_BAG_TUTORIAL_STEP_EVENT, { detail: -1 }));
}

export function subscribeOnboardingBagTutorialStep(cb: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = () => cb();
    window.addEventListener(ONBOARDING_BAG_TUTORIAL_STEP_EVENT, handler);
    return () => window.removeEventListener(ONBOARDING_BAG_TUTORIAL_STEP_EVENT, handler);
}
