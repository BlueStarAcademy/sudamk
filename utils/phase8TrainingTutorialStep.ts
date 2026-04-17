const STORAGE_KEY = 'sudamr:ob-phase8-training-step';
export const PHASE8_TRAINING_TUTORIAL_STEP_EVENT = 'sudamr-phase8-training-step-changed';

export function getPhase8TrainingTutorialStep(): number {
    if (typeof window === 'undefined') return 0;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const n = raw == null ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 3) return 0;
    return Math.floor(n);
}

export function setPhase8TrainingTutorialStep(step: number): void {
    if (typeof window === 'undefined') return;
    const n = Math.max(0, Math.min(3, Math.floor(step)));
    sessionStorage.setItem(STORAGE_KEY, String(n));
    window.dispatchEvent(new CustomEvent(PHASE8_TRAINING_TUTORIAL_STEP_EVENT, { detail: n }));
}

export function clearPhase8TrainingTutorialStep(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(PHASE8_TRAINING_TUTORIAL_STEP_EVENT, { detail: -1 }));
}

export function subscribePhase8TrainingTutorialStep(cb: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = () => cb();
    window.addEventListener(PHASE8_TRAINING_TUTORIAL_STEP_EVENT, handler);
    return () => window.removeEventListener(PHASE8_TRAINING_TUTORIAL_STEP_EVENT, handler);
}
