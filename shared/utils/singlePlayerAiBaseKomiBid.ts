import type { KomiBid, SinglePlayerAiBaseKomiBid } from '../types/entities.js';
import { Player } from '../types/enums.js';

const legacyRandomKomi = (): number => Math.floor(Math.random() * 10) + 1;

/**
 * 싱글 베이스바둑 덤 입찰: AI 입찰값.
 * `cfg`가 없으면 기존 서버 동작(흑/백 50:50, 덤 1~10)과 동일.
 */
export const resolveRuntimeAiBaseKomiBid = (cfg: SinglePlayerAiBaseKomiBid | undefined): KomiBid => {
    const color =
        !cfg || cfg.color === 'random'
            ? Math.random() < 0.5
                ? Player.Black
                : Player.White
            : cfg.color === 'black'
              ? Player.Black
              : Player.White;

    let komi: number;
    if (cfg?.komiMode === 'fixed') {
        const k = Math.floor(Number(cfg.komi));
        komi = Number.isFinite(k) && k >= 0 ? Math.min(99, k) : legacyRandomKomi();
    } else if (cfg?.komiMode === 'random') {
        const lo = Math.max(0, Math.floor(Number(cfg.komiMin ?? 1)));
        const hi = Math.max(lo, Math.floor(Number(cfg.komiMax ?? 10)));
        komi = lo + Math.floor(Math.random() * (hi - lo + 1));
    } else {
        komi = legacyRandomKomi();
    }
    return { color, komi };
};

const clampKomiBid = (n: number) => Math.min(100, Math.max(0, Math.floor(n)));

/**
 * 2차 덤 입찰 등: 인간과 동일한 집수를 피해 AI 덤 값을 고른다(동률 재발 방지).
 * `avoidKomi`가 없으면 {@link resolveRuntimeAiBaseKomiBid}와 동일 분포.
 */
export const pickAiKomiValueAvoiding = (
    cfg: SinglePlayerAiBaseKomiBid | undefined,
    avoidKomi: number | undefined,
): number => {
    if (avoidKomi == null || !Number.isFinite(avoidKomi)) {
        return resolveRuntimeAiBaseKomiBid(cfg).komi;
    }
    const avoid = clampKomiBid(avoidKomi);

    if (cfg?.komiMode === 'fixed') {
        const raw = Math.floor(Number(cfg.komi));
        const k = Number.isFinite(raw) && raw >= 0 ? clampKomiBid(raw) : legacyRandomKomi();
        if (k !== avoid) return k;
        return avoid >= 100 ? Math.max(0, avoid - 1) : avoid + 1;
    }

    if (cfg?.komiMode === 'random') {
        const lo = Math.max(0, Math.floor(Number(cfg.komiMin ?? 1)));
        const hi = Math.max(lo, Math.floor(Number(cfg.komiMax ?? 10)));
        if (hi > lo) {
            for (let i = 0; i < 80; i++) {
                const v = lo + Math.floor(Math.random() * (hi - lo + 1));
                if (v !== avoid) return v;
            }
            return avoid >= hi ? lo : hi;
        }
        return avoid === lo ? clampKomiBid(lo + 1) : lo;
    }

    for (let i = 0; i < 80; i++) {
        const v = legacyRandomKomi();
        if (v !== avoid) return v;
    }
    return avoid >= 10 ? 1 : avoid + 1;
};
