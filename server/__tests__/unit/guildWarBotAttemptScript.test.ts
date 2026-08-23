import { describe, expect, it } from 'vitest';
import { GUILD_WAR_BOT_GUILD_ID } from '../../../shared/constants/auth.js';
import {
    GUILD_WAR_BOT_ATTEMPTS_PER_DAY,
    GUILD_WAR_BOT_ATTEMPTS_WAR_TOTAL,
    GUILD_WAR_BOARD_ORDER,
} from '../../../shared/constants/guildConstants.js';

/**
 * applyBotGuildWarAttemptScript 는 guildActions에 비공개라 동일 누적 규칙을 단위로 검증한다.
 * 경과 일수 d(0..5) → 목표 (d+1)*12, 하루 만에 72로 점프하지 않음.
 * 전쟁 개시 전(now < startTime)에는 봇 도전 0 — 화요일 0시 이후 day0부터 12회.
 */
function botTargetUsed(elapsedDays: number, perDay = GUILD_WAR_BOT_ATTEMPTS_PER_DAY): number {
    const d = Math.min(5, Math.max(0, Math.floor(elapsedDays)));
    return Math.min(GUILD_WAR_BOT_ATTEMPTS_WAR_TOTAL, (d + 1) * perDay);
}

function botTargetUsedBeforeStart(now: number, startMs: number): number {
    if (now < startMs) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const elapsedDays = Math.min(5, Math.max(0, Math.floor((now - startMs) / dayMs)));
    return botTargetUsed(elapsedDays);
}

describe('guild war AI bot attempt pacing', () => {
    it('6일 × 12회 누적 목표', () => {
        expect(botTargetUsed(0)).toBe(12);
        expect(botTargetUsed(1)).toBe(24);
        expect(botTargetUsed(2)).toBe(36);
        expect(botTargetUsed(5)).toBe(72);
        expect(botTargetUsed(5)).toBe(GUILD_WAR_BOT_ATTEMPTS_WAR_TOTAL);
    });

    it('개시 전(월요일 매칭 직후)에는 봇 도전 0', () => {
        const monMatch = Date.UTC(2026, 4, 11, 14, 30, 0); // Mon 23:30 KST
        const tueStart = Date.UTC(2026, 4, 11, 15, 0, 0); // Tue 00:00 KST
        expect(botTargetUsedBeforeStart(monMatch, tueStart)).toBe(0);
        expect(botTargetUsedBeforeStart(tueStart, tueStart)).toBe(12);
        expect(botTargetUsedBeforeStart(tueStart + 24 * 60 * 60 * 1000, tueStart)).toBe(24);
    });

    it('보드 수가 양수인지(스크립트 할당 대상)', () => {
        expect(GUILD_WAR_BOARD_ORDER.length).toBeGreaterThan(0);
        expect(GUILD_WAR_BOT_GUILD_ID).toBeTruthy();
        expect(GUILD_WAR_BOT_ATTEMPTS_PER_DAY).toBe(12);
    });
});
