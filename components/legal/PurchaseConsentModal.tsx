import React, { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { useLegalCompanyInfo } from './useLegalDocument.js';

const TermsOfServiceModal = lazy(() => import('./TermsOfServiceModal.js'));
const RefundPolicyModal = lazy(() => import('./RefundPolicyModal.js'));
const PrivacyPolicyModal = lazy(() => import('./PrivacyPolicyModal.js'));

export interface PurchaseConsentTarget {
    productName: string;
    priceLabel: string;
    isSubscription?: boolean;
    summary?: string;
}

interface PurchaseConsentModalProps {
    target: PurchaseConsentTarget;
    onConfirm: () => void;
    onCancel: () => void;
}

type LegalModalKey = 'terms' | 'refund' | 'privacy' | null;

const PurchaseConsentModal: React.FC<PurchaseConsentModalProps> = ({ target, onConfirm, onCancel }) => {
    const { t } = useTranslation(['legal', 'common']);
    const company = useLegalCompanyInfo();
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreeRefund, setAgreeRefund] = useState(false);
    const [agreeSubscription, setAgreeSubscription] = useState(!target.isSubscription);
    const [openLegal, setOpenLegal] = useState<LegalModalKey>(null);
    const closeLegal = () => setOpenLegal(null);

    const allAgreed = agreeTerms && agreeRefund && agreeSubscription;

    return (
        <>
            <DraggableWindow
                title={t('purchaseConsent.title')}
                onClose={onCancel}
                windowId="purchase-consent-modal"
                initialWidth={520}
                modal
                modalBackdrop
                isTopmost
            >
                <div className="flex max-h-[min(80dvh,640px)] flex-col gap-3 rounded-xl border border-amber-400/30 bg-gradient-to-b from-secondary/40 via-secondary/20 to-transparent p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                    <div className="rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-900/30 via-black/40 to-black/50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
                            {t('purchaseConsent.purchaseSummary')}
                        </p>
                        <p className="mt-1 text-base font-bold text-on-panel">{target.productName}</p>
                        <p className="mt-1 text-sm font-semibold text-amber-100">{target.priceLabel}</p>
                        {target.summary ? (
                            <p className="mt-1 text-[11px] leading-relaxed text-on-panel/70">{target.summary}</p>
                        ) : null}
                        {target.isSubscription ? (
                            <p className="mt-2 rounded border border-amber-400/30 bg-black/30 px-2 py-1 text-[11px] leading-relaxed text-amber-100/90">
                                <span className="font-bold">{t('purchaseConsent.subscriptionNoticeBold')}</span>{' '}
                                {t('purchaseConsent.subscriptionNotice', { phone: company.phone })}
                            </p>
                        ) : null}
                    </div>

                    <div className="rounded-lg border border-color/45 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-on-panel/85">
                        <p className="font-semibold text-amber-100/90">{t('purchaseConsent.prePaymentTitle')}</p>
                        <ul className="mt-1.5 space-y-1 pl-4">
                            <li className="list-disc marker:text-amber-300/60">{t('purchaseConsent.prePaymentDigital')}</li>
                            <li className="list-disc marker:text-amber-300/60">{t('purchaseConsent.prePaymentUnused')}</li>
                            <li className="list-disc marker:text-amber-300/60">
                                {t('purchaseConsent.prePaymentRefundEmail', { email: company.email })}
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <ConsentCheckbox checked={agreeTerms} onChange={setAgreeTerms}>
                            <span>
                                <button
                                    type="button"
                                    onClick={() => setOpenLegal('terms')}
                                    className="font-semibold text-amber-200 underline-offset-2 hover:underline"
                                >
                                    {t('purchaseConsent.termsLink')}
                                </button>
                                {' '}
                                {t('purchaseConsent.and')}{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenLegal('privacy')}
                                    className="font-semibold text-amber-200 underline-offset-2 hover:underline"
                                >
                                    {t('purchaseConsent.privacyLink')}
                                </button>
                                {t('purchaseConsent.termsAgree')}
                            </span>
                        </ConsentCheckbox>
                        <ConsentCheckbox checked={agreeRefund} onChange={setAgreeRefund}>
                            <span>
                                <button
                                    type="button"
                                    onClick={() => setOpenLegal('refund')}
                                    className="font-semibold text-amber-200 underline-offset-2 hover:underline"
                                >
                                    {t('purchaseConsent.refundLink')}
                                </button>
                                {t('purchaseConsent.refundAgree')}
                            </span>
                        </ConsentCheckbox>
                        {target.isSubscription ? (
                            <ConsentCheckbox checked={agreeSubscription} onChange={setAgreeSubscription}>
                                <span>
                                    {t('purchaseConsent.subscriptionAgreePrefix')}{' '}
                                    <span className="font-semibold text-amber-200">{t('purchaseConsent.subscriptionProduct')}</span>
                                    {t('purchaseConsent.subscriptionAgreeSuffix')}
                                </span>
                            </ConsentCheckbox>
                        ) : null}
                    </div>

                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <Button onClick={onCancel} colorScheme="gray" className="flex-1">
                            {t('common:actions.cancel')}
                        </Button>
                        <Button onClick={onConfirm} disabled={!allAgreed} colorScheme="yellow" className="flex-1">
                            {t('purchaseConsent.proceed')}
                        </Button>
                    </div>
                </div>
            </DraggableWindow>

            {openLegal !== null ? (
                <Suspense fallback={null}>
                    {openLegal === 'terms' ? <TermsOfServiceModal onClose={closeLegal} isTopmost /> : null}
                    {openLegal === 'refund' ? <RefundPolicyModal onClose={closeLegal} isTopmost /> : null}
                    {openLegal === 'privacy' ? <PrivacyPolicyModal onClose={closeLegal} isTopmost /> : null}
                </Suspense>
            ) : null}
        </>
    );
};

const ConsentCheckbox: React.FC<{
    checked: boolean;
    onChange: (next: boolean) => void;
    children: React.ReactNode;
}> = ({ checked, onChange, children }) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-color/40 bg-black/25 px-3 py-2 text-[12px] leading-relaxed text-on-panel/90 transition-colors hover:border-amber-400/40">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-400"
        />
        <span className="flex-1">{children}</span>
    </label>
);

export default PurchaseConsentModal;
