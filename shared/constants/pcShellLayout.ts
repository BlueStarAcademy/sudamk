/** Profile 홈 PC 3열 레이아웃 — 모든 PC 로비의 좌·중·우 폭 기준 */

/** 좌측 패널 (유저·펫·로비 좌열) */
export const PC_HOME_LEFT_COLUMN_CLASS =
    'w-[min(43%,500px)] min-w-0 max-w-[500px] shrink-0';

/** 좌측 패널 내부 gap (Profile 홈 grid) */
export const PC_HOME_LEFT_COLUMN_GAP_CLASS = 'gap-[clamp(0.22rem,0.7dvh,0.38rem)]';

/** 3열 행 gap */
export const PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS = 'gap-1.5';

/** PVP 경기장 PC 우측 열 — 유저·랭킹전 (전략·놀이·페어 공통 고정 폭) */
export const PC_LOBBY_USERS_COLUMN_CLASS =
    'flex h-full min-h-0 w-[30rem] min-w-[30rem] max-w-[30rem] shrink-0 flex-col overflow-hidden';

/** PC 로비·경기장 본문 패딩 — Profile 홈과 동일 */
export const PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS = 'p-2 sm:p-4 lg:p-2';

/** 중앙 뷰포트 외곽 셸 — 좌측 패널과 동일 앰버 테두리, 투명 배경 (Profile 홈·챔피언십 로비 등) */
export const PC_HOME_CENTER_SHELL_CLASS =
    'relative flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden rounded-xl border-2 border-amber-500/45 ' +
    'bg-transparent p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15';

/** 중앙 뷰포트 내부 max-width */
export const PC_HOME_CENTER_INNER_MAX_CLASS = 'max-w-[min(100%,1040px)]';

/** PC·캔버스 세로 퀵 메뉴 외곽 열 폭 */
export const PC_QUICK_RAIL_COLUMN_CLASS =
    'w-[7.5rem] min-w-[120px] max-w-[8.5rem] shrink-0';

/** 퀵 레일 래퍼 (Profile·로비 공통 크롬) */
export const PC_QUICK_RAIL_WRAPPER_CLASS =
    'flex h-full min-h-0 flex-col rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40';

/** 퀵 유틸 인라인 패널 — 중앙 열 전체 높이·폭 사용 (max-width·justify-center 없음) */
export const PC_QUICK_UTILITY_CENTER_SHELL_CLASS =
    'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-amber-500/42 ' +
    'bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_20px_48px_-24px_rgba(0,0,0,0.92)] ring-1 ring-amber-100/12 ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,rgba(251,191,36,0.09),transparent_58%)]';

/** 로비 기본 콘텐츠용 중앙 inner (입장카드 세로 중앙 정렬) */
export const PC_HOME_CENTER_INNER_LOBBY_CLASS =
    `mx-auto flex h-full min-h-0 w-full ${PC_HOME_CENTER_INNER_MAX_CLASS} flex-col justify-start overflow-y-auto overflow-x-hidden`;

/** embedded 퀵 유틸 본문 루트 — 중앙 열 높이 전체 사용, 내부 스크롤 허용 */
export const PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS =
    'flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden';

/** 모바일 퀵 유틸 패널 — Router 영역 전체 높이 */
export const MOBILE_QUICK_UTILITY_SHELL_CLASS =
    'relative flex h-full min-h-0 w-full flex-col overflow-hidden';

/** 모바일 퀵 유틸 본문 스크롤 루트 */
export const MOBILE_QUICK_UTILITY_BODY_SCROLL_CLASS =
    'flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]';

/** 길드 홈 PC 우측 뷰포트 — 배경·테두리 없는 투명 셸 */
export const PC_GUILD_CENTER_SHELL_CLASS =
    'flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden';

/** 길드 홈 PC 우측 패널 묶음 max-width (로비 기본보다 약간 넓음) */
export const PC_GUILD_HOME_CENTER_INNER_MAX_CLASS = 'max-w-[min(100%,1140px)]';

/** 길드 홈 PC 메인 그리드: 좌열 | 우측 뷰포트 | 퀵 레일 */
export const PC_GUILD_HOME_MAIN_GRID_CLASS =
    'grid-cols-[min(43%,500px)_minmax(0,1fr)_minmax(120px,7.5rem)] grid-rows-[auto_1fr]';

/** 길드 홈 PC 우측 뷰포트 inner */
export const PC_GUILD_CENTER_INNER_CLASS =
    `mx-auto flex h-full min-h-0 w-full ${PC_GUILD_HOME_CENTER_INNER_MAX_CLASS} flex-col justify-start overflow-hidden`;
