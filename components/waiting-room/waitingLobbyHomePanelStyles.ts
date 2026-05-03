/**
 * PC 전략·페어·놀이 집계 대기실 패널 — Profile 경기장 홈의 경기 카드(mergedCard / info 패널)와 같은 톤.
 * 전략: 시안 / 페어: 바이올렛 / 놀이: 앰버
 */

const insetHighlight = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]';

export type WaitingLobbyPanelTone = 'strategic' | 'pair' | 'playful';

/** 좌·우·중앙 메인 패널 외곽 */
export function waitingLobbyPcPanelShellClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return (
            `rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-zinc-900 via-slate-950 to-black ` +
            `shadow-[0_18px_40px_-22px_rgba(0,0,0,0.88)] ring-1 ring-cyan-400/28 ${insetHighlight}`
        );
    }
    if (lobby === 'pair') {
        return (
            `rounded-2xl border border-violet-500/45 bg-gradient-to-br from-zinc-950 via-violet-950/35 to-black ` +
            `shadow-[0_18px_44px_-20px_rgba(76,29,149,0.45)] ring-1 ring-violet-400/32 ${insetHighlight}`
        );
    }
    return (
        `rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black ` +
        `shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${insetHighlight}`
    );
}

/** 중앙 열(공지 + 대국 목록): 패딩·세로 gap 포함 */
export function waitingLobbyPcCenterColumnClass(lobby: WaitingLobbyPanelTone): string {
    return (
        `${waitingLobbyPcPanelShellClass(lobby)} relative flex min-h-0 min-w-0 flex-1 ` +
        `flex-col gap-[clamp(0.3rem,0.9dvh,0.45rem)] overflow-hidden p-1.5 sm:p-2`
    );
}

/** 홈 카드 상단 하이라이트 라인 */
export function waitingLobbyPcPanelTopHairlineClassFor(lobby: WaitingLobbyPanelTone): string {
    const via =
        lobby === 'strategic' ? 'via-cyan-300/38' : lobby === 'pair' ? 'via-violet-300/40' : 'via-amber-300/42';
    return `pointer-events-none absolute left-3 right-3 top-2 z-[1] h-px bg-gradient-to-r from-transparent ${via} to-transparent sm:left-4 sm:right-4`;
}

/**
 * 페어 경기장 모바일(핸드헬드) 상단 탭과 동일한 글자·패딩.
 * 전략·놀이 네이티브 대기실: 상단 4탭, 유저목록의 전체/친구/길드 탭에 사용.
 */
export const waitingLobbyPairAlignedMobileTabButtonClass =
    'rounded-lg px-1.5 py-1.5 text-[0.65rem] font-extrabold leading-tight sm:px-2 sm:py-2 sm:text-xs';

/**
 * 페어 경기장 모바일 헤더 제목(`PairWaitingLobby` h1)과 동일한 반응형 크기.
 */
export const waitingLobbyPairAlignedMobileScreenTitleClass =
    'truncate text-sm font-bold sm:text-lg lg:text-xl';
