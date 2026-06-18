import { useTranslation } from 'react-i18next';
import type { LegalSection } from './LegalDocumentModal.js';
import { COMPANY_INFO, LEGAL_EFFECTIVE_DATE } from './companyInfo.js';

export function useLegalCompanyInfo() {
    const { t } = useTranslation('legal');
    return {
        name: t('company.name'),
        representative: t('company.representative'),
        businessNumber: COMPANY_INFO.businessNumber,
        mailOrderNumber: COMPANY_INFO.mailOrderNumber,
        address: t('company.address'),
        phone: COMPANY_INFO.phone,
        email: COMPANY_INFO.email,
        serviceName: t('company.serviceName'),
        serviceUrl: COMPANY_INFO.serviceUrl,
    };
}

export function useLegalDocument(documentKey: 'termsOfService' | 'privacyPolicy' | 'refundPolicy') {
    const { t } = useTranslation('legal');
    const company = useLegalCompanyInfo();
    const sections = t(`${documentKey}.sections`, {
        returnObjects: true,
        companyName: company.name,
        serviceName: company.serviceName,
        email: company.email,
        phone: company.phone,
        representative: company.representative,
        businessNumber: company.businessNumber,
        mailOrderNumber: company.mailOrderNumber,
        address: company.address,
    }) as LegalSection[];

    return {
        title: t(`${documentKey}.title`),
        eyebrow: t(`${documentKey}.eyebrow`),
        intro: t(`${documentKey}.intro`, {
            companyName: company.name,
            serviceName: company.serviceName,
            email: company.email,
            phone: company.phone,
        }),
        sections: Array.isArray(sections) ? sections : [],
        effectiveDate: LEGAL_EFFECTIVE_DATE,
        company,
    };
}
