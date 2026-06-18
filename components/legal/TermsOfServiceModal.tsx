import React from 'react';
import LegalDocumentModal from './LegalDocumentModal.js';
import { useLegalDocument } from './useLegalDocument.js';

interface Props {
    onClose: () => void;
    isTopmost?: boolean;
}

const TermsOfServiceModal: React.FC<Props> = ({ onClose, isTopmost }) => {
    const doc = useLegalDocument('termsOfService');
    return (
        <LegalDocumentModal
            title={doc.title}
            eyebrow={doc.eyebrow}
            intro={doc.intro}
            sections={doc.sections}
            effectiveDate={doc.effectiveDate}
            company={doc.company}
            onClose={onClose}
            isTopmost={isTopmost}
        />
    );
};

export default TermsOfServiceModal;
