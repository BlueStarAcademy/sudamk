import React, { Suspense, lazy, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { COMPANY_INFO } from './legal/companyInfo.js';

const TermsOfServiceModal = lazy(() => import('./legal/TermsOfServiceModal.js'));
const PrivacyPolicyModal = lazy(() => import('./legal/PrivacyPolicyModal.js'));
const RefundPolicyModal = lazy(() => import('./legal/RefundPolicyModal.js'));

type LegalModalKey = 'terms' | 'privacy' | 'refund' | null;

interface AppFooterProps {
    variant?: 'main' | 'auth';
}

const FooterLinkButton: React.FC<{
    label: string;
    emphasis?: boolean;
    auth?: boolean;
    onClick: () => void;
}> = ({ label, emphasis, auth, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`whitespace-nowrap text-[11px] sm:text-xs underline-offset-4 transition-colors hover:underline ${
            auth
                ? emphasis
                    ? 'font-semibold text-amber-200 hover:text-amber-50'
                    : 'text-stone-200 hover:text-amber-100'
                : emphasis
                  ? 'font-semibold text-amber-200/95 hover:text-amber-100'
                  : 'text-secondary hover:text-on-panel'
        }`}
    >
        {label}
    </button>
);

const Divider: React.FC<{ auth?: boolean }> = ({ auth }) => (
    <span aria-hidden className={`hidden sm:inline ${auth ? 'text-stone-500/70' : 'text-tertiary/40'}`}>
        ·
    </span>
);

const AppFooter: React.FC<AppFooterProps> = ({ variant = 'main' }) => {
    const [openModal, setOpenModal] = useState<LegalModalKey>(null);
    const close = useCallback(() => setOpenModal(null), []);

    const isAuth = variant === 'auth';

    const footer = (
            <footer
                className={`box-border w-full max-w-none shrink-0 border-t ${
                    isAuth
                        ? 'fixed bottom-0 left-0 right-0 z-[30] border-amber-400/20 bg-zinc-950/72 px-0 py-1.5 text-stone-200 shadow-[0_-8px_32px_rgba(0,0,0,0.28)] backdrop-blur-sm pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] sm:py-2'
                        : 'border-amber-400/15 bg-primary/85 px-3 py-2 sm:px-6 sm:py-3'
                } text-center text-[11px] leading-snug sm:text-xs`}
                role="contentinfo"
                aria-label="사이트 정보"
            >
                <div
                    className={`mx-auto flex w-full flex-col items-center ${
                        isAuth ? 'gap-1 px-3 sm:gap-1.5 sm:px-4' : 'max-w-5xl gap-1.5 sm:gap-2'
                    }`}
                >
                    {/* 약관 링크 행 */}
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-4">
                        <FooterLinkButton
                            label="이용약관"
                            auth={isAuth}
                            onClick={() => setOpenModal('terms')}
                        />
                        <Divider auth={isAuth} />
                        <FooterLinkButton
                            label="개인정보처리방침"
                            emphasis
                            auth={isAuth}
                            onClick={() => setOpenModal('privacy')}
                        />
                        <Divider auth={isAuth} />
                        <FooterLinkButton
                            label="취소·환불 규정"
                            auth={isAuth}
                            onClick={() => setOpenModal('refund')}
                        />
                        <Divider auth={isAuth} />
                        <a
                            href={`mailto:${COMPANY_INFO.email}`}
                            className={`whitespace-nowrap text-[11px] underline-offset-4 transition-colors hover:underline sm:text-xs ${
                                isAuth
                                    ? 'text-stone-200 hover:text-amber-100'
                                    : 'text-secondary hover:text-on-panel'
                            }`}
                        >
                            고객센터
                        </a>
                    </div>

                    {/* 사업자 정보 행 1 */}
                    <p
                        className={
                            isAuth
                                ? 'text-[10px] text-stone-300 sm:text-[11px]'
                                : 'text-[10px] text-tertiary/95 sm:text-[11px]'
                        }
                    >
                        <span
                            className={
                                isAuth ? 'font-semibold text-stone-100' : 'font-semibold text-on-panel/80'
                            }
                        >
                            {COMPANY_INFO.name}
                        </span>
                        <span className={`mx-1.5 ${isAuth ? 'text-stone-500/70' : 'text-tertiary/40'}`}>|</span>
                        대표 {COMPANY_INFO.representative}
                        <span className={`mx-1.5 ${isAuth ? 'text-stone-500/70' : 'text-tertiary/40'}`}>|</span>
                        사업자등록번호 {COMPANY_INFO.businessNumber}
                        <span className={`mx-1.5 ${isAuth ? 'text-stone-500/70' : 'text-tertiary/40'}`}>|</span>
                        통신판매업신고 {COMPANY_INFO.mailOrderNumber}
                    </p>

                    {/* 사업자 정보 행 2 */}
                    <p
                        className={
                            isAuth
                                ? 'text-[10px] text-stone-300 sm:text-[11px]'
                                : 'text-[10px] text-tertiary/95 sm:text-[11px]'
                        }
                    >
                        {COMPANY_INFO.address}
                        <span className={`mx-1.5 ${isAuth ? 'text-stone-500/70' : 'text-tertiary/40'}`}>|</span>
                        고객센터 {COMPANY_INFO.phone}
                        <span className={`mx-1.5 ${isAuth ? 'text-stone-500/70' : 'text-tertiary/40'}`}>|</span>
                        <a
                            href={`mailto:${COMPANY_INFO.email}`}
                            className={`underline-offset-2 transition-colors hover:underline ${
                                isAuth ? 'text-stone-200 hover:text-amber-100' : 'hover:text-on-panel'
                            }`}
                        >
                            {COMPANY_INFO.email}
                        </a>
                    </p>

                    <p
                        className={
                            isAuth ? 'text-[10px] text-stone-400' : 'text-[10px] text-tertiary/70'
                        }
                    >
                        © {new Date().getFullYear()} {COMPANY_INFO.name}. All rights reserved.
                    </p>
                </div>
            </footer>
    );

    return (
        <>
            {isAuth && typeof document !== 'undefined'
                ? createPortal(footer, document.body)
                : footer}

            {openModal !== null ? (
                <Suspense fallback={null}>
                    {openModal === 'terms' ? (
                        <TermsOfServiceModal onClose={close} isTopmost />
                    ) : null}
                    {openModal === 'privacy' ? (
                        <PrivacyPolicyModal onClose={close} isTopmost />
                    ) : null}
                    {openModal === 'refund' ? (
                        <RefundPolicyModal onClose={close} isTopmost />
                    ) : null}
                </Suspense>
            ) : null}
        </>
    );
};

export default AppFooter;
