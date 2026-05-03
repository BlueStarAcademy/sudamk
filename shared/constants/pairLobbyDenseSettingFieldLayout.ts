/**
 * 페어 「방 만들기」`AiChallengeModal`의 대국 설정 밀집 그리드와 동일한 레이아웃 토큰.
 * 랭킹전 규칙 요약 등 읽기 전용 필드에도 재사용한다.
 */

/** `pairDenseSettingRowClass` — 라벨·컨트롤 2열 + 드롭다운/고정값 동일 높이 */
export const PAIR_LOBBY_DENSE_SETTING_ROW_CLASS =
    'grid min-w-0 grid-cols-2 items-center gap-x-2 gap-y-0 rounded-lg border border-white/12 bg-zinc-900/45 py-1.5 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [&>label]:min-w-0 [&>label]:w-full [&>label]:text-center [&>label]:leading-tight [&>*:nth-child(2)]:min-w-0 [&>input[type=checkbox]]:justify-self-center [&>div:nth-child(2)]:flex [&>div:nth-child(2)]:w-full [&>div:nth-child(2)]:min-w-0 [&>div:nth-child(2)]:items-center [&>div:nth-child(2)]:justify-center [&_select]:h-9 [&_select]:min-h-9 [&_select]:w-full [&_select]:box-border [&_select]:!py-0 [&_select]:!px-2 [&_select]:text-center [&_input[type=number]]:h-9 [&_input[type=number]]:min-h-9 [&_input[type=number]]:box-border [&_input[type=number]]:!py-0';

/** `<select>`와 같은 시각 — 상호작용 없음 */
export const PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS =
    'w-full h-9 min-h-9 box-border shrink-0 rounded-lg border border-gray-600 bg-gray-700 px-2 py-0 text-center text-sm font-semibold leading-snug text-white pointer-events-none select-none';

/** 페어 방 만들기 우측 열과 같은 auto-fill 카드 그리드(규칙 행 나열) */
export const PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS =
    'grid w-full min-w-0 auto-rows-min content-start justify-center gap-x-2.5 gap-y-2 [grid-template-columns:repeat(auto-fill,minmax(14rem,14rem))] [&>div]:min-w-0';
