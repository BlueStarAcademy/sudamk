import type { Application, Request, Response } from 'express';
import prisma from '../prismaClient.js';
import {
    getPayletterConfig,
    requestPayment,
    verifyCallbackHash,
    CALLBACK_OK_RESPONSE,
    type CallbackPayload,
    type PayletterPgInfo,
} from '../services/payletterClient.js';
import { fulfillPaymentProduct, validatePurchasable } from '../services/paymentFulfillment.js';
import {
    isPaymentProductId,
    PAYMENT_PRODUCT_PRICE_KRW,
    type PaymentProductId,
} from '../../shared/constants/paymentProducts.js';

const ALLOWED_PG_INFO: readonly PayletterPgInfo[] = ['PLCreditCardmpi', 'PLCreditCard', 'PLUnionPay'];

/** 콜백·리턴 URL 의 공개 베이스. 미설정 시 요청 호스트 사용 */
function publicBaseUrl(req: Request): string {
    const env = process.env.PAYLETTER_PUBLIC_BASE_URL;
    if (env) return env.replace(/\/$/, '');
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || req.protocol;
    return `${proto}://${req.get('host')}`;
}

function frontendUrl(): string {
    return (process.env.FRONTEND_URL || 'https://sudambaduk.com').replace(/\/$/, '');
}

export function registerPaymentRoutes(app: Application): void {
    /**
     * 주문 생성 + 결제창 URL 발급.
     * 금액은 서버 단일 소스(PAYMENT_PRODUCT_PRICE_KRW)만 사용 — 클라이언트 금액은 받지 않는다.
     */
    app.post('/api/payment/orders', async (req: Request, res: Response) => {
        try {
            const { userId, productId, pgInfo: rawPgInfo } = (req.body ?? {}) as {
                userId?: string;
                productId?: string;
                pgInfo?: string;
            };
            if (!userId || typeof userId !== 'string') {
                res.status(401).json({ message: '인증 정보가 없습니다.' });
                return;
            }
            if (!productId || !isPaymentProductId(productId)) {
                res.status(400).json({ message: '유효하지 않은 상품입니다.' });
                return;
            }

            const blocked = await validatePurchasable(userId, productId);
            if (blocked) {
                res.status(409).json({ message: blocked });
                return;
            }

            const cfg = getPayletterConfig();
            // 테스트 환경은 PLCreditCardmpi 미지원 → 비인증으로 폴백
            const defaultPgInfo: PayletterPgInfo = cfg.testMode ? 'PLCreditCard' : 'PLCreditCardmpi';
            const pgInfo: PayletterPgInfo = ALLOWED_PG_INFO.includes(rawPgInfo as PayletterPgInfo)
                ? (rawPgInfo as PayletterPgInfo)
                : defaultPgInfo;

            const amount = PAYMENT_PRODUCT_PRICE_KRW[productId as PaymentProductId];
            const order = await prisma.paymentOrder.create({
                data: {
                    userId,
                    productId,
                    productName: productId,
                    amount,
                    currency: 'KRW',
                    pgInfo,
                },
            });

            const base = publicBaseUrl(req);
            let payRes;
            try {
                payRes = await requestPayment(cfg, {
                    orderId: order.id,
                    amount,
                    currency: 'KRW',
                    pgInfo,
                    payerId: userId,
                    payerEmail: 'noreply@sudambaduk.com',
                    productName: productId,
                    returnUrl: `${base}/api/payment/return?orderId=${order.id}`,
                    notiUrl: `${base}/api/payment/callback`,
                });
            } catch (e) {
                await prisma.paymentOrder.update({
                    where: { id: order.id },
                    data: { status: 'FAILED', failReason: `결제요청 실패: ${(e as Error).message.slice(0, 500)}` },
                });
                console.error('[Payment] 결제요청 실패:', e);
                res.status(502).json({ message: '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
                return;
            }

            const onlineUrl = typeof payRes.online_url === 'string' ? payRes.online_url : null;
            const mobileUrl = typeof payRes.mobile_url === 'string' ? payRes.mobile_url : null;
            if (!onlineUrl && !mobileUrl) {
                await prisma.paymentOrder.update({
                    where: { id: order.id },
                    data: { status: 'FAILED', failReason: `결제창 URL 미수신: ${JSON.stringify(payRes).slice(0, 500)}` },
                });
                res.status(502).json({ message: '결제창 정보를 받지 못했습니다.' });
                return;
            }

            res.json({ orderId: order.id, amount, onlineUrl, mobileUrl });
        } catch (e) {
            console.error('[Payment] 주문 생성 오류:', e);
            res.status(500).json({ message: '주문 생성 중 오류가 발생했습니다.' });
        }
    });

    /**
     * Payletter server-to-server 결제 통지(notiurl).
     * hash 검증 → 주문·금액 대조 → 멱등 전이 → 지급. 성공 시 <RESULT>OK</RESULT> 응답 필수.
     */
    app.post('/api/payment/callback', async (req: Request, res: Response) => {
        const cb = (req.body ?? {}) as CallbackPayload;
        const orderId = String(cb.storeorderno ?? '');
        try {
            const cfg = getPayletterConfig();
            if (!verifyCallbackHash(cfg, cb)) {
                console.error('[Payment] 콜백 hash 검증 실패:', { orderId, keys: Object.keys(cb) });
                res.status(400).send('INVALID HASH');
                return;
            }

            const order = orderId ? await prisma.paymentOrder.findUnique({ where: { id: orderId } }) : null;
            if (!order) {
                console.error('[Payment] 콜백: 주문 없음:', orderId);
                res.status(404).send('ORDER NOT FOUND');
                return;
            }

            const notifyType = String(cb.notifytype ?? '');

            // 환불 통지
            if (notifyType === '2') {
                await prisma.paymentOrder.update({
                    where: { id: order.id },
                    data: { status: 'REFUNDED', rawCallback: cb as object },
                });
                console.log(`[Payment] 환불 통지 처리: ${order.id}`);
                res.send(CALLBACK_OK_RESPONSE);
                return;
            }

            if (notifyType !== '1') {
                console.warn(`[Payment] 미처리 notifytype=${notifyType}:`, order.id);
                res.send(CALLBACK_OK_RESPONSE);
                return;
            }

            // 금액·통화 대조 (위변조 방지)
            const paidAmount = Number(cb.payamt);
            if (paidAmount !== order.amount || (cb.currency ?? 'KRW') !== order.currency) {
                await prisma.paymentOrder.update({
                    where: { id: order.id },
                    data: {
                        status: 'FAILED',
                        failReason: `금액 불일치: 주문 ${order.amount}${order.currency} vs 결제 ${cb.payamt}${cb.currency}`,
                        rawCallback: cb as object,
                    },
                });
                console.error(`[Payment] 금액 불일치: ${order.id}`, { expected: order.amount, got: cb.payamt });
                res.status(400).send('AMOUNT MISMATCH');
                return;
            }

            // 멱등 전이: PENDING → PAID (0건이면 이미 처리된 콜백 → OK 만 응답)
            const transitioned = await prisma.paymentOrder.updateMany({
                where: { id: order.id, status: 'PENDING' },
                data: {
                    status: 'PAID',
                    payToken: cb.paytoken ? String(cb.paytoken) : undefined,
                    rawCallback: cb as object,
                },
            });
            if (transitioned.count === 0) {
                console.log(`[Payment] 중복 콜백 무시: ${order.id} (status=${order.status})`);
                res.send(CALLBACK_OK_RESPONSE);
                return;
            }

            // 지급 — 실패해도 결제는 완료됐으므로 OK 응답 (PAID + failReason 로 남겨 수동 복구)
            const fulfill = await fulfillPaymentProduct(order.userId, order.productId as PaymentProductId);
            if (fulfill.ok) {
                await prisma.paymentOrder.update({
                    where: { id: order.id },
                    data: { status: 'FULFILLED', fulfilledAt: new Date() },
                });
                console.log(`[Payment] 지급 완료: ${order.id} (${order.productId} → ${order.userId})`);
            } else {
                await prisma.paymentOrder.update({
                    where: { id: order.id },
                    data: { failReason: `지급 실패(수동 복구 필요): ${fulfill.error}` },
                });
                console.error(`[Payment] 지급 실패(PAID 유지): ${order.id} — ${fulfill.error}`);
            }
            res.send(CALLBACK_OK_RESPONSE);
        } catch (e) {
            console.error('[Payment] 콜백 처리 오류:', orderId, e);
            // 5xx 응답 시 Payletter 가 재시도 → 일시 오류 복구 기회
            res.status(500).send('ERROR');
        }
    });

    /** 결제창 종료 후 브라우저 복귀 — 앱으로 리다이렉트 (결과는 클라이언트가 status 폴링) */
    app.all('/api/payment/return', (req: Request, res: Response) => {
        const orderId = String(req.query.orderId ?? (req.body as Record<string, unknown> | undefined)?.storeorderno ?? '');
        const target = orderId
            ? `${frontendUrl()}/?paymentOrderId=${encodeURIComponent(orderId)}`
            : `${frontendUrl()}/`;
        res.redirect(302, target);
    });

    /** 주문 상태 조회 (본인 주문만) — 클라이언트 폴링용 */
    app.get('/api/payment/orders/:orderId/status', async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;
            const userId = String(req.query.userId ?? '');
            if (!userId) {
                res.status(401).json({ message: '인증 정보가 없습니다.' });
                return;
            }
            const order = await prisma.paymentOrder.findUnique({
                where: { id: orderId },
                select: { id: true, userId: true, productId: true, amount: true, status: true, failReason: true },
            });
            if (!order || order.userId !== userId) {
                res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
                return;
            }
            res.json({ orderId: order.id, productId: order.productId, amount: order.amount, status: order.status });
        } catch (e) {
            console.error('[Payment] 상태 조회 오류:', e);
            res.status(500).json({ message: '상태 조회 중 오류가 발생했습니다.' });
        }
    });
}
