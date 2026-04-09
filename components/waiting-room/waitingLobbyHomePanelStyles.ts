/**
 * PC 전략·놀이 집계 대기실 패널 — Profile 경기장 홈의 경기 카드(mergedCard / info 패널)와 같은 톤.
 * 기존 bg-panel + border-color 대비 눈에 띄는 앰버·시안 프레임 + 징크 그라데이션.
 */

const insetHighlight = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]';

/** 좌·우·중앙 메인 패널 외곽 */
export function waitingLobbyPcPanelShellClass(lobby: 'strategic' | 'playful'): string {
    if (lobby === 'strategic') {
        return (
            `rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-zinc-900 via-slate-950 to-black ` +
            `shadow-[0_18px_40px_-22px_rgba(0,0,0,0.88)] ring-1 ring-cyan-400/28 ${insetHighlight}`
        );
    }
    return (
        `rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black ` +
        `shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${insetHighlight}`
    );
}

/** 중앙 열(공지 + 대국 목록): 패딩·세로 gap 포함 */
export function waitingLobbyPcCenterColumnClass(lobby: 'strategic' | 'playful'): string {
    return (
        `${waitingLobbyPcPanelShellClass(lobby)} relative flex min-h-0 min-w-0 flex-1 ` +
        `flex-col gap-[clamp(0.3rem,0.9dvh,0.45rem)] overflow-hidden p-1.5 sm:p-2`
    );
}

/** 홈 카드 상단 하이라이트 라인 */
export function waitingLobbyPcPanelTopHairlineClassFor(lobby: 'strategic' | 'playful'): string {
    const via = lobby === 'strategic' ? 'via-cyan-300/38' : 'via-amber-300/42';
    return `pointer-events-none absolute left-3 right-3 top-2 z-[1] h-px bg-gradient-to-r from-transparent ${via} to-transparent sm:left-4 sm:right-4`;
}
