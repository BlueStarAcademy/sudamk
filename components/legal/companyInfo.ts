/** Non-localized company identifiers used for API/legal matching. */
export const COMPANY_INFO = {
    businessNumber: '574-87-03057',
    mailOrderNumber: '2024-화성동탄-1338',
    phone: '010-5484-1960',
    email: 'sudambaduk@gmail.com',
    serviceUrl: 'https://sudambaduk.com',
} as const;

export const LEGAL_EFFECTIVE_DATE = '2026-06-16';

export type CompanyInfoDisplay = {
    name: string;
    representative: string;
    businessNumber: string;
    mailOrderNumber: string;
    address: string;
    phone: string;
    email: string;
    serviceName: string;
    serviceUrl: string;
};
