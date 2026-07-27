/** 회사 정보 — components/legal/companyInfo.ts 와 값 동기 유지 (가이드는 정적 빌드라 직접 상수화) */
export const COMPANY = {
    name: '에코스톤',
    representative: '유호정',
    businessNumber: '574-87-03057',
    mailOrderNumber: '2024-화성동탄-1338',
    address: '경기도 화성시 동탄대로 677-10, 7층 715-A22호(영천동)',
    phone: '010-5484-1960',
    email: 'sudambaduk@gmail.com',
    serviceName: '수담바둑',
    serviceUrl: 'https://sudambaduk.com',
} as const;

export const ADSENSE_CLIENT_ID = 'ca-pub-8820344339947055';

/** 카테고리 메타 — content.config.ts 의 category enum과 동기 유지 */
export const CATEGORIES: Record<string, { label: string; eyebrow: string; description: string }> = {
    basics: {
        label: '바둑 입문',
        eyebrow: 'Baduk Basics',
        description: '바둑판과 돌부터 계가까지 — 처음 배우는 분을 위한 규칙의 전부',
    },
    modes: {
        label: '게임 모드',
        eyebrow: 'Game Modes',
        description: '수담바둑 16종 게임 모드의 규칙과 이기는 요령',
    },
};

export const SITE_TITLE = '수담바둑 가이드';
export const SITE_DESCRIPTION =
    '바둑 규칙부터 16종 게임 모드, 바둑학원 커리큘럼까지 — 수담바둑 공식 가이드';
