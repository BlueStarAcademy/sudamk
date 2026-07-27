/** 결제 라우트 로컬 검증 — hash 불일치/주문 없음/리다이렉트 (유저·주문 데이터 무변경) */
import express from 'express';
import crypto from 'node:crypto';
import { registerPaymentRoutes } from '../server/routes/paymentRoutes.js';

process.env.PAYLETTER_STORE_ID = 'PL_Merchant';
process.env.PAYLETTER_API_KEY = 'PL_Merchant';
process.env.PAYLETTER_TEST_MODE = 'true';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
registerPaymentRoutes(app);

const server = app.listen(4998, async () => {
    const base = 'http://127.0.0.1:4998';
    let pass = 0, fail = 0;
    const check = (name: string, ok: boolean, extra = '') => {
        console.log(`${ok ? '✅' : '❌'} ${name} ${extra}`);
        ok ? pass++ : fail++;
    };

    // 1. 잘못된 hash → 400
    let r = await fetch(`${base}/api/payment/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeorderno: 'no-such-order', hash: 'deadbeef', payamt: 1000, currency: 'KRW', payerid: 'x', timestamp: '20260728' }),
    });
    check('invalid hash → 400', r.status === 400, `(got ${r.status})`);

    // 2. 올바른 hash + 존재하지 않는 주문 → 404
    const cb = { storeorderno: 'no-such-order', currency: 'KRW', payamt: '1000', payerid: 'x', timestamp: '20260728', notifytype: '1' };
    const raw = `PL_Merchant${cb.currency}${cb.storeorderno}${cb.payamt}${cb.payerid}${cb.timestamp}PL_Merchant`;
    const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    r = await fetch(`${base}/api/payment/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cb, hash }),
    });
    check('valid hash + missing order → 404', r.status === 404, `(got ${r.status})`);

    // 3. form-urlencoded 콜백도 파싱되는지 (Payletter 는 form 전송 가능성)
    r = await fetch(`${base}/api/payment/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...cb, hash } as Record<string, string>).toString(),
    });
    check('form-urlencoded callback parsed → 404 (not 400)', r.status === 404, `(got ${r.status})`);

    // 4. return 리다이렉트
    r = await fetch(`${base}/api/payment/return?orderId=abc`, { redirect: 'manual' });
    const loc = r.headers.get('location') ?? '';
    check('return → 302 to frontend', r.status === 302 && loc.includes('paymentOrderId=abc'), `(${r.status} → ${loc})`);

    // 5. 주문 생성: 인증 없음 → 401
    r = await fetch(`${base}/api/payment/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'diamond_500' }),
    });
    check('order without userId → 401', r.status === 401, `(got ${r.status})`);

    // 6. 주문 생성: 잘못된 상품 → 400
    r = await fetch(`${base}/api/payment/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u', productId: 'not_a_product' }),
    });
    check('order with bad product → 400', r.status === 400, `(got ${r.status})`);

    console.log(`\n${pass} passed, ${fail} failed`);
    server.close();
    process.exit(fail > 0 ? 1 : 0);
});
