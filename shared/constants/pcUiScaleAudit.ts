/**
 * PC UI 비율 통일 QA·감사 기준선.
 * 수동 QA 및 E2E 스크린샷 뷰포트 매트릭스.
 */
export const PC_UI_SCALE_QA_VIEWPORTS = [
    { label: 'baseline', width: 1920, height: 1080 },
    { label: 'laptop-1600', width: 1600, height: 900 },
    { label: 'laptop-1366', width: 1366, height: 768 },
    { label: 'hd-720', width: 1280, height: 720 },
    { label: 'ultrawide-1440', width: 2560, height: 1440 },
    { label: 'short-window', width: 1440, height: 600 },
] as const;

/** DraggableWindow 플래그 감사 카테고리 (회귀 점검용) */
export const PC_MODAL_SCALE_FLAG_CATEGORIES = [
    'uniformPcScale',
    'mobileViewportFit',
    'viewportPortal',
    'autoViewportPortalOnSmallDesktop',
] as const;

/** embedded Quick Utility 본문 — EmbeddedDesignPanelFit 적용 대상 */
export const PC_EMBEDDED_UTILITY_PANEL_KINDS = [
    'quests',
    'exchange',
    'blacksmith',
    'shop',
    'inventory',
    'pet',
    'trainingQuest',
    'detailedStats',
    'monsterCodex',
    'ranking',
    'gameRecords',
    'encyclopedia',
    'announcements',
] as const;
