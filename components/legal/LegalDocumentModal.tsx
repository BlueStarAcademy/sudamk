import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import { COMPANY_INFO, LEGAL_EFFECTIVE_DATE } from './companyInfo.js';

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
    onClose: () => void;
    windowId: string;
    isTopmost?: boolean;
}

const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
    title,
    eyebrow,
    intro,
    sections,
    onClose,
    windowId,
    isTopmost,
}) => {
    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId={windowId}
            initialWidth={760}
            modal
            modalBackdrop
            isTopmost={isTopmost}
        >
            <div className="h-[min(78dvh,720px)] min-h-[520px] rounded-xl border border-color/40 bg-gradient-to-b from-secondary/40 via-secondary/20 to-transparent p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                <div className="mb-4 rounded-lg border border-amber-400/30 bg-black/30 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                        {eyebrow}
                    </p>
                    <p className="mt-1 text-base font-bold text-on-panel">
                        {title}
                    </p>
                    {intro ? (
                        <p className="mt-2 text-xs leading-relaxed text-on-panel/75">{intro}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-tertiary">
                        시행일: {LEGAL_EFFECTIVE_DATE}
                    </p>
                </div>

                <div className="flex h-[calc(100%-180px)] flex-col gap-3 overflow-y-auto pr-1 text-primary">
                    {sections.map((section, idx) => (
                        <article
                            key={`${section.title}-${idx}`}
                            className="rounded-xl border border-color/45 bg-gradient-to-br from-secondary/55 via-secondary/35 to-black/20 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                        >
                            <h3 className="text-sm font-bold tracking-[0.04em] text-amber-100">
                                {`제 ${idx + 1} 조  ${section.title}`}
                            </h3>
                            {section.paragraphs?.map((p, pi) => (
                                <p
                                    key={`p-${pi}`}
                                    className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-on-panel/90"
                                >
                                    {p}
                                </p>
                            ))}
                            {section.bullets?.length ? (
                                <ul className="mt-2 space-y-1 pl-4 text-[13px] leading-relaxed text-on-panel/85">
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

                <div className="mt-3 rounded-lg border border-color/30 bg-black/30 px-4 py-2 text-[11px] leading-relaxed text-tertiary">
                    <p className="font-semibold text-on-panel/80">{COMPANY_INFO.name}</p>
                    <p className="mt-0.5">
                        대표 {COMPANY_INFO.representative} · 사업자등록번호 {COMPANY_INFO.businessNumber} · 통신판매업신고 {COMPANY_INFO.mailOrderNumber}
                    </p>
                    <p className="mt-0.5">
                        {COMPANY_INFO.address} · 고객센터 {COMPANY_INFO.phone} · {COMPANY_INFO.email}
                    </p>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default LegalDocumentModal;
