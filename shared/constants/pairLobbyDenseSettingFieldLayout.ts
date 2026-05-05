/**
 * 페어 「방 만들기」`AiChallengeModal`의 대국 설정 밀집 그리드와 동일한 레이아웃 토큰.
 * 랭킹전 규칙 요약 등 읽기 전용 필드에도 재사용한다.
 */

/**
 * 대국 설정 밀집 행: 라벨을 `<select>`·값 박스 위에 두고 한 줄(`whitespace-nowrap`)로 표시.
 * (모바일 2열 그리드에서 옆열 `fr` 라벨 칸이 좁아져 글자가 세로로 쪼개지던 문제 방지)
 */
export const PAIR_LOBBY_DENSE_SETTING_ROW_CLASS =
    'flex min-w-0 w-full flex-col items-stretch gap-y-1 gap-x-0 rounded-lg border border-white/12 bg-zinc-900/45 py-1.5 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [&>label]:block [&>label]:min-w-0 [&>label]:w-full [&>label]:shrink-0 [&>label]:whitespace-nowrap [&>label]:text-left [&>label]:leading-none [&>*:nth-child(2)]:min-w-0 [&>div:nth-child(2)]:w-full [&>div:nth-child(2)]:min-w-0 [&>input[type=checkbox]]:self-start [&_select]:h-9 [&_select]:min-h-9 [&_select]:w-full [&_select]:box-border [&_select]:!py-0 [&_select]:!pl-2 [&_select]:!pr-10 [&_select]:text-left [&_input[type=number]]:h-9 [&_input[type=number]]:min-h-9 [&_input[type=number]]:box-border [&_input[type=number]]:!py-0';

/** `<select>`와 같은 시각 — 상호작용 없음 */
export const PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS =
    'flex h-9 min-h-9 w-full shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-0 text-center text-sm font-semibold leading-none text-white pointer-events-none select-none box-border';

/** 페어 방 만들기 우측 열과 같은 auto-fill 카드 그리드(규칙 행 나열) */
export const PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS =
    'grid w-full min-w-0 auto-rows-min content-start justify-center gap-x-2.5 gap-y-2 [grid-template-columns:repeat(auto-fill,minmax(15rem,15rem))] [&>div]:min-w-0';
