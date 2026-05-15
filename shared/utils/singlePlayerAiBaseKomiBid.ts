import type { KomiBid, SinglePlayerAiBaseKomiBid } from '../types/entities.js';
import { Player } from '../types/enums.js';

const DEFAULT_BASE_AI_KOMI_MIN = 5;
const DEFAULT_BASE_AI_KOMI_MAX = 20;
const legacyRandomKomi = (): number =>
    DEFAULT_BASE_AI_KOMI_MIN +
    Math.floor(Math.random() * (DEFAULT_BASE_AI_KOMI_MAX - DEFAULT_BASE_AI_KOMI_MIN + 1));

/**
 * 싱글 베이스바둑 덤 입찰: AI 입찰값.
 * `cfg`가 없으면 기본 서버 동작(흑/백 50:50, 덤 5~20)을 사용.
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
        const lo = Math.max(0, Math.floor(Number(cfg.komiMin ?? DEFAULT_BASE_AI_KOMI_MIN)));
        const hi = Math.max(lo, Math.floor(Number(cfg.komiMax ?? DEFAULT_BASE_AI_KOMI_MAX)));
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
        const lo = Math.max(0, Math.floor(Number(cfg.komiMin ?? DEFAULT_BASE_AI_KOMI_MIN)));
        const hi = Math.max(lo, Math.floor(Number(cfg.komiMax ?? DEFAULT_BASE_AI_KOMI_MAX)));
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
    return avoid >= DEFAULT_BASE_AI_KOMI_MAX ? DEFAULT_BASE_AI_KOMI_MIN : avoid + 1;
};
