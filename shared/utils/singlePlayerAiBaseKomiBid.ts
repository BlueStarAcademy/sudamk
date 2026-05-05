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
