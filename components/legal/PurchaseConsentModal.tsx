import React, { Suspense, lazy, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { COMPANY_INFO } from './companyInfo.js';

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
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreeRefund, setAgreeRefund] = useState(false);
    const [agreeSubscription, setAgreeSubscription] = useState(!target.isSubscription);
    const [openLegal, setOpenLegal] = useState<LegalModalKey>(null);
    const closeLegal = () => setOpenLegal(null);

    const allAgreed = agreeTerms && agreeRefund && agreeSubscription;

    return (
        <>
            <DraggableWindow
                title="결제 진행 확인"
                onClose={onCancel}
                windowId="purchase-consent-modal"
                initialWidth={520}
                modal
                modalBackdrop
                isTopmost
            >
                <div className="flex max-h-[min(80dvh,640px)] flex-col gap-3 rounded-xl border border-amber-400/30 bg-gradient-to-b from-secondary/40 via-secondary/20 to-transparent p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                    {/* 상품 요약 */}
                    <div className="rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-900/30 via-black/40 to-black/50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
                            Purchase Summary
                        </p>
                        <p className="mt-1 text-base font-bold text-on-panel">{target.productName}</p>
                        <p className="mt-1 text-sm font-semibold text-amber-100">{target.priceLabel}</p>
                        {target.summary ? (
                            <p className="mt-1 text-[11px] leading-relaxed text-on-panel/70">{target.summary}</p>
                        ) : null}
                        {target.isSubscription ? (
                            <p className="mt-2 rounded border border-amber-400/30 bg-black/30 px-2 py-1 text-[11px] leading-relaxed text-amber-100/90">
                                <span className="font-bold">정기결제 상품입니다.</span> 별도 해지 신청이 없으면 30일마다 자동으로 결제되며, 마이페이지 또는 고객센터({COMPANY_INFO.phone})에서 언제든 해지할 수 있습니다.
                            </p>
                        ) : null}
                    </div>

                    {/* 결제 직전 안내 */}
                    <div className="rounded-lg border border-color/45 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-on-panel/85">
                        <p className="font-semibold text-amber-100/90">결제 전 안내</p>
                        <ul className="mt-1.5 space-y-1 pl-4">
                            <li className="list-disc marker:text-amber-300/60">
                                결제 직후 즉시 지급되는 디지털 콘텐츠로, 사용·소비 후에는 청약철회가 제한됩니다.
                            </li>
                            <li className="list-disc marker:text-amber-300/60">
                                미사용 상품은 결제일로부터 7일 이내 청약철회가 가능합니다.
                            </li>
                            <li className="list-disc marker:text-amber-300/60">
                                환불 신청은 고객센터 이메일({COMPANY_INFO.email})로 접수해 주세요.
                            </li>
                        </ul>
                    </div>

                    {/* 동의 체크박스 */}
                    <div className="space-y-2">
                        <ConsentCheckbox
                            checked={agreeTerms}
                            onChange={setAgreeTerms}
                        >
                            <span>
                                <button
                                    type="button"
                                    onClick={() => setOpenLegal('terms')}
                                    className="font-semibold text-amber-200 underline-offset-2 hover:underline"
                                >
                                    이용약관
                                </button>
                                {' '}및{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenLegal('privacy')}
                                    className="font-semibold text-amber-200 underline-offset-2 hover:underline"
                                >
                                    개인정보처리방침
                                </button>
                                을 확인했습니다. (필수)
                            </span>
                        </ConsentCheckbox>
                        <ConsentCheckbox
                            checked={agreeRefund}
                            onChange={setAgreeRefund}
                        >
                            <span>
                                <button
                                    type="button"
                                    onClick={() => setOpenLegal('refund')}
                                    className="font-semibold text-amber-200 underline-offset-2 hover:underline"
                                >
                                    취소·환불 규정
                                </button>
                                을 확인했으며 위 청약철회 제한 사항에 동의합니다. (필수)
                            </span>
                        </ConsentCheckbox>
                        {target.isSubscription ? (
                            <ConsentCheckbox
                                checked={agreeSubscription}
                                onChange={setAgreeSubscription}
                            >
                                <span>
                                    30일 주기로 자동 결제되는 <span className="font-semibold text-amber-200">정기결제 상품</span>이며, 해지 전까지 매월 청구된다는 점에 동의합니다. (필수)
                                </span>
                            </ConsentCheckbox>
                        ) : null}
                    </div>

                    {/* 결제/취소 버튼 */}
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <Button
                            onClick={onCancel}
                            colorScheme="gray"
                            className="flex-1"
                        >
                            취소
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={!allAgreed}
                            colorScheme="yellow"
                            className="flex-1"
                        >
                            결제 진행
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
