import type { User } from '../types/entities.js';

/**
 * 행동력 차감 후 자연 회복 타이머를 갱신한다.
 * 만땅(last === 0)에서 차감해 비만땅이 되면 nowMs부터 회복을 시작하고,
 * 이미 회복 중이면 lastActionPointUpdate를 유지해 남은 시간이 초기화되지 않게 한다.
 */
export function recordActionPointSpend(user: User, amount: number, nowMs: number = Date.now()): void {
    if (!user?.actionPoints || user.isAdmin || amount <= 0) return;
    user.actionPoints.current -= amount;
    if (user.lastActionPointUpdate === 0) {
        user.lastActionPointUpdate = nowMs;
    }
}

/**
 * 행동력 환불·롤백·아이템 회복 등으로 current를 올릴 때 타이머를 맞춘다.
 * max 이상이면 회복 정지(last = 0), 그 미만이면 진행 중인 last는 유지한다.
 */
export function recordActionPointRestore(user: User, amount: number): void {
    if (!user?.actionPoints || amount <= 0) return;
    const maxAp = user.actionPoints.max;
    user.actionPoints.current = Math.min(maxAp, user.actionPoints.current + amount);
    if (user.actionPoints.current >= maxAp) {
        user.lastActionPointUpdate = 0;
    }
}
