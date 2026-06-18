import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');

function extractSections(src) {
    const m = src.match(/const SECTIONS[^=]*=\s*(\[[\s\S]*?\n\]);/);
    if (!m) return [];
    const sanitized = m[1]
        .replace(/\$\{COMPANY_INFO\.name\}/g, '__COMPANY_NAME__')
        .replace(/\$\{COMPANY_INFO\.serviceName\}/g, '__SERVICE_NAME__')
        .replace(/\$\{COMPANY_INFO\.email\}/g, '__EMAIL__')
        .replace(/\$\{COMPANY_INFO\.phone\}/g, '__PHONE__')
        .replace(/\$\{COMPANY_INFO\.representative\}/g, '__REPRESENTATIVE__')
        .replace(/\$\{COMPANY_INFO\.businessNumber\}/g, '__BUSINESS_NUMBER__')
        .replace(/\$\{COMPANY_INFO\.mailOrderNumber\}/g, '__MAIL_ORDER__');
    // eslint-disable-next-line no-eval
    const sections = eval(sanitized);
    const repl = (s) =>
        String(s)
            .replace(/__COMPANY_NAME__/g, '{{companyName}}')
            .replace(/__SERVICE_NAME__/g, '{{serviceName}}')
            .replace(/__EMAIL__/g, '{{email}}')
            .replace(/__PHONE__/g, '{{phone}}')
            .replace(/__REPRESENTATIVE__/g, '{{representative}}')
            .replace(/__BUSINESS_NUMBER__/g, '{{businessNumber}}')
            .replace(/__MAIL_ORDER__/g, '{{mailOrderNumber}}');
    return sections.map((sec) => ({
        ...sec,
        title: repl(sec.title),
        paragraphs: sec.paragraphs?.map(repl),
        bullets: sec.bullets?.map(repl),
    }));
}

const termsFromGit = fs.readFileSync(path.join(root, 'components/legal/TermsOfServiceModal.tsx'), 'utf8');
const privacySrc = fs.readFileSync(path.join(root, 'components/legal/PrivacyPolicyModal.tsx'), 'utf8');
const refundSrc = fs.readFileSync(path.join(root, 'components/legal/RefundPolicyModal.tsx'), 'utf8');

// Terms file may already be migrated; fall back to git HEAD content
let termsSections = extractSections(termsFromGit);
if (!termsSections.length) {
    try {
        const { execSync } = await import('node:child_process');
        const gitTerms = execSync('git show HEAD:components/legal/TermsOfServiceModal.tsx', { cwd: root, encoding: 'utf8' });
        termsSections = extractSections(gitTerms);
    } catch {
        termsSections = [];
    }
}

const koLegal = {
    company: {
        name: '에코스톤',
        representative: '유호정',
        address: '경기도 화성시 동탄대로 677-10, 7층 715-A22호(영천동)',
        serviceName: '수담바둑',
    },
    common: {
        close: '닫기',
        closeAria: '{{title}} 닫기',
        effectiveDate: '시행일: {{date}}',
        articleHeading: '제 {{num}} 조  {{title}}',
        footerRepresentative: '대표 {{representative}} · 사업자등록번호 {{businessNumber}} · 통신판매업신고 {{mailOrderNumber}}',
        footerContact: '{{address}} · 고객센터 {{phone}} · {{email}}',
    },
    termsOfService: {
        title: '이용약관',
        eyebrow: 'Terms of Service',
        intro: '{{serviceName}} 서비스를 이용해 주셔서 감사합니다. 본 약관은 회원과 회사 간의 권리·의무 및 책임 사항을 정합니다.',
        sections: termsSections,
    },
    privacyPolicy: {
        title: '개인정보처리방침',
        eyebrow: 'Privacy Policy',
        intro: '{{companyName}}은 「개인정보 보호법」 등 관계 법령에 따라 회원의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 본 방침을 수립·공개합니다.',
        sections: extractSections(privacySrc),
    },
    refundPolicy: {
        title: '취소·환불 규정',
        eyebrow: 'Refund Policy',
        intro: '유료 콘텐츠의 청약철회 및 환불에 관한 사항을 안내드립니다. 본 규정은 전자상거래법 등 관계 법령에 따라 작성되었습니다.',
        sections: extractSections(refundSrc),
    },
    purchaseConsent: {
        title: '결제 진행 확인',
        purchaseSummary: 'Purchase Summary',
        subscriptionNoticeBold: '정기결제 상품입니다.',
        subscriptionNotice: '별도 해지 신청이 없으면 30일마다 자동으로 결제되며, 마이페이지 또는 고객센터({{phone}})에서 언제든 해지할 수 있습니다.',
        prePaymentTitle: '결제 전 안내',
        prePaymentDigital: '결제 직후 즉시 지급되는 디지털 콘텐츠로, 사용·소비 후에는 청약철회가 제한됩니다.',
        prePaymentUnused: '미사용 상품은 결제일로부터 7일 이내 청약철회가 가능합니다.',
        prePaymentRefundEmail: '환불 신청은 고객센터 이메일({{email}})로 접수해 주세요.',
        termsLink: '이용약관',
        and: '및',
        privacyLink: '개인정보처리방침',
        termsAgree: '을 확인했습니다. (필수)',
        refundLink: '취소·환불 규정',
        refundAgree: '을 확인했으며 위 청약철회 제한 사항에 동의합니다. (필수)',
        subscriptionAgreePrefix: '30일 주기로 자동 결제되는',
        subscriptionProduct: '정기결제 상품',
        subscriptionAgreeSuffix: '이며, 해지 전까지 매월 청구된다는 점에 동의합니다. (필수)',
        proceed: '결제 진행',
    },
};

const koPath = path.join(catalogDir, 'ko.json');
const ko = JSON.parse(fs.readFileSync(koPath, 'utf8'));
ko.legal = koLegal;
fs.writeFileSync(koPath, `${JSON.stringify(ko, null, 2)}\n`, 'utf8');
console.log('[merge-legal-ko] sections', {
    terms: koLegal.termsOfService.sections.length,
    privacy: koLegal.privacyPolicy.sections.length,
    refund: koLegal.refundPolicy.sections.length,
});
