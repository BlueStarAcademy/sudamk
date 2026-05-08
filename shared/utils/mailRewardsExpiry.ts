/** `expiresAt`이 지나면 첨부 보상 수령 불가. `expiresAt` 미설정은 기한 없음 */
export function isMailRewardsClaimExpired(mail: { expiresAt?: number }, nowMs: number = Date.now()): boolean {
    return typeof mail.expiresAt === 'number' && mail.expiresAt <= nowMs;
}
