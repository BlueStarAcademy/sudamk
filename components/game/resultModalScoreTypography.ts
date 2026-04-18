/**
 * 경기 결과 모달 — 계가·점수 상세·경기 요약 본문의 모바일 글자 크기(px).
 * `mobileTextScale`과 곱해 사용. PVP·싱글·탑 등 모달 간 통일.
 */
export const RESULT_MODAL_SCORE_MOBILE_PX = {
    /** 영토/따낸 돌 등 데이터 행 */
    dataRow: 12,
    /** 흑·백 열 제목 */
    columnHead: 13,
    /** 총점 행 */
    totalRow: 13,
    /** 빈 상태·보조 문구 */
    emptyState: 12,
    /** 섹션 소제목(경기 결과 등) */
    sectionLabel: 12,
} as const;
