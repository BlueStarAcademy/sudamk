import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../../shared/constants/mobileModalChrome.js';
import type { CompanyInfoDisplay } from './companyInfo.js';

export interface LegalSection {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
}

interface LegalDocumentModalProps {
    title: string;
    eyebrow: string;
    intro?: string;
    sections: LegalSection[];
    effectiveDate: string;
    company: CompanyInfoDisplay;
    onClose: () => void;
    isTopmost?: boolean;
}

const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
    title,
    eyebrow,
    intro,
    sections,
    effectiveDate,
    company,
    onClose,
    isTopmost = true,
}) => {
    const { t } = useTranslation('legal');

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const zIndex = isTopmost ? 80 : 70;

    const modal = (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={{
                zIndex,
                paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
                paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
            }}
            role="presentation"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                aria-label={t('common.closeAria', { title })}
                onClick={onClose}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative z-10 flex w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-color/50 bg-primary shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-amber-400/15"
                style={{
                    height: 'min(88dvh, 900px)',
                    maxHeight: 'min(88dvh, 900px)',
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-400/20 bg-secondary px-4 py-2.5 sm:px-5 sm:py-3">
                    <h2 className="min-w-0 truncate text-sm font-bold text-amber-50 sm:text-base">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS}
                        aria-label={t('common.closeAria', { title })}
                    >
                        {t('common.close')}
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-primary p-4 sm:p-5">
                    <div className="mb-3 shrink-0 rounded-lg border border-amber-400/30 bg-secondary px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                            {eyebrow}
                        </p>
                        <p className="mt-1 text-base font-bold text-on-panel">{title}</p>
                        {intro ? (
                            <p className="mt-2 text-xs leading-relaxed text-on-panel/75">{intro}</p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-tertiary">{t('common.effectiveDate', { date: effectiveDate })}</p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-gutter:stable]">
                        <div className="flex flex-col gap-3 text-primary">
                            {sections.map((section, idx) => (
                                <article
                                    key={`${section.title}-${idx}`}
                                    className="rounded-xl border border-color/45 bg-secondary p-4 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                                >
                                    <h3 className="text-sm font-bold tracking-[0.04em] text-amber-100">
                                        {t('common.articleHeading', { num: idx + 1, title: section.title })}
                                    </h3>
                                    {section.paragraphs?.map((p, pi) => (
                                        <p
                                            key={`p-${pi}`}
                                            className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-panel/90"
                                        >
                                            {p}
                                        </p>
                                    ))}
                                    {section.bullets?.length ? (
                                        <ul className="mt-2 space-y-1 break-words pl-4 text-[13px] leading-relaxed text-on-panel/85">
                                            {section.bullets.map((b, bi) => (
                                                <li key={`b-${bi}`} className="list-disc marker:text-amber-300/60">
                                                    {b}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 shrink-0 rounded-lg border border-color/30 bg-secondary px-4 py-2 text-[11px] leading-relaxed text-tertiary">
                        <p className="font-semibold text-on-panel/80">{company.name}</p>
                        <p className="mt-0.5 break-words">
                            {t('common.footerRepresentative', {
                                representative: company.representative,
                                businessNumber: company.businessNumber,
                                mailOrderNumber: company.mailOrderNumber,
                            })}
                        </p>
                        <p className="mt-0.5 break-words">
                            {t('common.footerContact', {
                                address: company.address,
                                phone: company.phone,
                                email: company.email,
                            })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return modal;
    return createPortal(modal, document.body);
};

export default LegalDocumentModal;
