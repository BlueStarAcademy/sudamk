import { ALKKAGI_GAUGE_SPEEDS, CURLING_GAUGE_SPEEDS } from '../constants/gameSettings.js';

/** 방·로비 요약: 내부 ms 값 → `x1` / `x2` / `x3` */
export function formatAlkkagiCurlingGaugeSpeedForLobbyDisplay(ms: number): string {
    const label =
        ALKKAGI_GAUGE_SPEEDS.find((s) => s.value === ms)?.label ??
        CURLING_GAUGE_SPEEDS.find((s) => s.value === ms)?.label;
    if (label) {
        const tier = label.match(/^x[123]/);
        if (tier) return tier[0];
    }
    return String(ms);
}
