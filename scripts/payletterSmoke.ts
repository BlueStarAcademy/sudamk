import { getPayletterConfig, requestPayment } from '../server/services/payletterClient.js';

async function main() {
    const cfg = getPayletterConfig();
    console.log('config:', { storeId: cfg.storeId, testMode: cfg.testMode });
    try {
        const res = await requestPayment(cfg, {
            orderId: 'smoke-' + Math.random().toString(36).slice(2, 10),
            amount: 1000,
            currency: 'KRW',
            pgInfo: 'PLCreditCard',
            payerId: 'smoke-tester',
            payerEmail: 'smoke@sudambaduk.com',
            productName: 'smoke-test',
            returnUrl: 'https://sudambaduk.com/api/payment/return',
            notiUrl: 'https://sudambaduk.com/api/payment/callback',
        });
        console.log('RESPONSE KEYS:', Object.keys(res));
        console.log('code:', res.code, '| message:', res.message);
        const ou = res.online_url, mu = res.mobile_url;
        console.log('online_url:', typeof ou === 'string' ? ou.slice(0, 90) : ou);
        console.log('mobile_url:', typeof mu === 'string' ? mu.slice(0, 90) : mu);
    } catch (e) {
        console.error('SMOKE FAIL:', (e as Error).message);
        process.exitCode = 1;
    }
}
main();
