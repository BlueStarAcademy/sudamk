import crypto from 'node:crypto';

/**
 * Payletter 글로벌(해외) 결제 API 클라이언트.
 * 문서: https://www.payletter.com/ko/technical/index_global
 * - 인증: `Authorization: GPLKEY {API_KEY}`
 * - 테스트: dev-api.payletter.com (PLCreditCard 는 4/51/35/34 로 시작하는 임의 카드번호 허용)
 * - 라이브: api.payletter.com
 */

const LIVE_BASE_URL = 'https://api.payletter.com';
const TEST_BASE_URL = 'https://dev-api.payletter.com';

export type PayletterPgInfo = 'PLCreditCardmpi' | 'PLCreditCard' | 'PLUnionPay';

export interface PayletterConfig {
    storeId: string;
    apiKey: string;
    /** true 면 dev-api 사용 */
    testMode: boolean;
}

export function getPayletterConfig(): PayletterConfig {
    const storeId = process.env.PAYLETTER_STORE_ID;
    const apiKey = process.env.PAYLETTER_API_KEY;
    if (!storeId || !apiKey) {
        throw new Error('[Payletter] PAYLETTER_STORE_ID / PAYLETTER_API_KEY env가 설정되지 않았습니다.');
    }
    return {
        storeId,
        apiKey,
        testMode: process.env.PAYLETTER_TEST_MODE !== 'false',
    };
}

function baseUrl(cfg: PayletterConfig): string {
    return cfg.testMode ? TEST_BASE_URL : LIVE_BASE_URL;
}

async function postJson<T>(cfg: PayletterConfig, path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${baseUrl(cfg)}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `GPLKEY ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`[Payletter] ${path} 비정상 응답 (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }
    if (!res.ok) {
        throw new Error(`[Payletter] ${path} 실패 (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }
    return parsed as T;
}

export interface PaymentRequestParams {
    /** PaymentOrder.id — storeorderno 로 전달 */
    orderId: string;
    amount: number;
    currency: 'KRW';
    pgInfo: PayletterPgInfo;
    payerId: string;
    payerEmail: string;
    productName: string;
    returnUrl: string;
    notiUrl: string;
}

export interface PaymentRequestResponse {
    /** PC 결제창 URL */
    online_url?: string;
    /** 모바일 결제창 URL */
    mobile_url?: string;
    code?: number | string;
    message?: string;
    [key: string]: unknown;
}

/** 결제창 요청 — 응답의 online_url/mobile_url 로 유저를 보낸다 */
export async function requestPayment(cfg: PayletterConfig, p: PaymentRequestParams): Promise<PaymentRequestResponse> {
    return postJson<PaymentRequestResponse>(cfg, '/api/payment/request', {
        storeid: cfg.storeId,
        storeorderno: p.orderId,
        amount: p.amount,
        currency: p.currency,
        pginfo: p.pgInfo,
        payerid: p.payerId,
        payeremail: p.payerEmail,
        productname: p.productName,
        returnurl: p.returnUrl,
        notiurl: p.notiUrl,
    });
}

export interface RefundParams {
    payToken: string;
    currency: 'KRW';
    amount: number;
}

/** 결제 취소/환불 */
export async function refundPayment(cfg: PayletterConfig, p: RefundParams): Promise<Record<string, unknown>> {
    return postJson(cfg, '/api/payment/refund', {
        storeid: cfg.storeId,
        paytoken: p.payToken,
        currency: p.currency,
        amount: p.amount,
    });
}

export interface CallbackPayload {
    paytoken?: string;
    storeorderno?: string;
    currency?: string;
    payamt?: string | number;
    payerid?: string;
    timestamp?: string;
    notifytype?: string | number;
    hash?: string;
    [key: string]: unknown;
}

/**
 * notiurl 콜백 hash 검증.
 * hash = SHA256(storeid + currency + storeorderno + payamt + payerid + timestamp + API_Key)
 */
export function verifyCallbackHash(cfg: PayletterConfig, cb: CallbackPayload): boolean {
    if (!cb.hash) return false;
    const raw = `${cfg.storeId}${cb.currency ?? ''}${cb.storeorderno ?? ''}${cb.payamt ?? ''}${cb.payerid ?? ''}${cb.timestamp ?? ''}${cfg.apiKey}`;
    const expected = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    // 대소문자 차이 허용, 타이밍 공격 방지 비교
    const a = Buffer.from(expected.toLowerCase(), 'utf8');
    const b = Buffer.from(String(cb.hash).toLowerCase(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** notiurl 응답 본문 — Payletter 는 이 문자열을 받아야 재전송을 멈춘다 */
export const CALLBACK_OK_RESPONSE = '<RESULT>OK</RESULT>';
