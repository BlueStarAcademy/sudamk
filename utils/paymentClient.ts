import { getApiUrl } from './apiConfig.js';

/**
 * Payletter 결제 클라이언트 유틸.
 * 서버 /api/payment/* 라우트와 짝 — 금액은 서버가 결정하므로 여기서는 상품 ID만 보낸다.
 */

export interface CheckoutSession {
    orderId: string;
    amount: number;
    onlineUrl: string | null;
    mobileUrl: string | null;
}

export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'FULFILLED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export async function createPaymentOrder(userId: string, productId: string): Promise<CheckoutSession> {
    const res = await fetch(getApiUrl('/api/payment/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productId }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : '결제 요청에 실패했습니다.');
    }
    return body as unknown as CheckoutSession;
}

export async function getPaymentOrderStatus(orderId: string, userId: string): Promise<PaymentOrderStatus | null> {
    const res = await fetch(
        getApiUrl(`/api/payment/orders/${encodeURIComponent(orderId)}/status?userId=${encodeURIComponent(userId)}`),
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { status?: PaymentOrderStatus };
    return body.status ?? null;
}

/**
 * 결제 완료까지 상태 폴링.
 * @returns 최종 상태, 또는 시간 초과 시 'TIMEOUT'
 */
export async function pollPaymentOrder(
    orderId: string,
    userId: string,
    opts?: { intervalMs?: number; timeoutMs?: number; shouldStop?: () => boolean },
): Promise<PaymentOrderStatus | 'TIMEOUT'> {
    const intervalMs = opts?.intervalMs ?? 3_000;
    const timeoutMs = opts?.timeoutMs ?? 10 * 60_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (opts?.shouldStop?.()) return 'TIMEOUT';
        const status = await getPaymentOrderStatus(orderId, userId).catch(() => null);
        if (status && status !== 'PENDING' && status !== 'PAID') return status;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return 'TIMEOUT';
}

/**
 * 결제창 열기.
 * - PC: 팝업 (실패 시 리다이렉트 폴백)
 * - 모바일: 현재 창 리다이렉트 (팝업 차단 회피, return URL 로 복귀)
 * @returns 'popup'이면 호출측이 폴링을 계속해야 함, 'redirect'면 페이지 이탈
 */
export function openCheckout(session: CheckoutSession, preferMobile: boolean): 'popup' | 'redirect' | 'failed' {
    const url = preferMobile ? (session.mobileUrl ?? session.onlineUrl) : (session.onlineUrl ?? session.mobileUrl);
    if (!url) return 'failed';
    if (preferMobile) {
        window.location.href = url;
        return 'redirect';
    }
    const popup = window.open(url, 'payletter_checkout', 'width=720,height=800,menubar=no,toolbar=no');
    if (!popup) {
        window.location.href = url;
        return 'redirect';
    }
    return 'popup';
}
