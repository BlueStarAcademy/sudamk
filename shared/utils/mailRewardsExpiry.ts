/** `expiresAt`이 지나면 첨부 보상 수령 불가. `expiresAt` 미설정은 기한 없음 */
export function isMailRewardsClaimExpired(mail: { expiresAt?: number }, nowMs: number = Date.now()): boolean {
    return typeof mail.expiresAt === 'number' && mail.expiresAt <= nowMs;
}

type MailWithAttachments = {
    attachments?: unknown;
    attachmentsClaimed?: boolean;
    expiresAt?: number;
};

/** 첨부 보상을 수령했거나, 수령 기한이 지나 수령 불가인 우편 (일괄 삭제·수령 완료 처리 대상) */
export function isMailRewardSettledForDeletion(mail: MailWithAttachments, nowMs: number = Date.now()): boolean {
    if (!mail.attachments) return false;
    return Boolean(mail.attachmentsClaimed) || isMailRewardsClaimExpired(mail, nowMs);
}
