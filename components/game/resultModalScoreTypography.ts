/**
 * 경기 결과 모달 — 계가·점수 상세·경기 요약 본문의 모바일 글자 크기(px).
 * `mobileTextScale`과 곱해 사용. PVP·싱글·탑 등 모달 간 통일.
 */
export const RESULT_MODAL_SCORE_MOBILE_PX = {
    /** 영토/따낸 돌 등 데이터 행 */
    dataRow: 12.5,
    /** 흑·백 열 제목 */
    columnHead: 13,
    /** 총점 행 */
    totalRow: 13,
    /** 빈 상태·보조 문구 */
    emptyState: 12,
    /** 섹션 소제목(경기 결과 등) */
    sectionLabel: 12.5,
} as const;

/** PC 결과 패널 기준 px — `desktopTextScale`과 곱해 사용 */
export const RESULT_MODAL_DESKTOP_PX = {
    body: 12,
    label: 11,
    nickname: 12.5,
    level: 11,
    badge: 10,
    scoreData: 11,
    scoreHead: 12,
    scoreTotal: 12.5,
    scoreHero: 19,
    scoreColon: 15,
    message: 12.5,
    captureLabel: 11,
    winBanner: 13,
} as const;

/** 경기 결과 모달 본문·프로필·라벨 (mobileTextScale과 곱함) */
export const RESULT_MODAL_BODY_MOBILE_PX = {
    sectionTitle: 12.5,
    body: 12,
    meta: 11,
    nickname: 12.5,
    level: 11,
    badge: 10.5,
} as const;

export function resultModalFontPx(base: number, scale: number): string {
    return `${Math.round(base * scale)}px`;
}

/** 놀이바둑 모바일: 라운드 표·득점 등 정보 밀도가 높아 한 단계 키운 기준 px */
export const RESULT_MODAL_PLAYFUL_SCORE_MOBILE_PX = {
    dataRow: 14,
    columnHead: 15,
    totalRow: 15,
    emptyState: 13,
    sectionLabel: 14,
} as const;

export function resolveResultModalScoreMobilePx(playfulMobile: boolean) {
    return playfulMobile ? RESULT_MODAL_PLAYFUL_SCORE_MOBILE_PX : RESULT_MODAL_SCORE_MOBILE_PX;
}

/** 놀이바둑 모바일 결과 모달 전용 — 뷰포트 스케일 하한을 살짝 올려 본문 타이포 가독성 확보 */
export function bumpPlayfulMobileTextScale(scale: number, playfulMobile: boolean): number {
    if (!playfulMobile) return scale;
    return Math.min(1, scale * 1.12);
}
