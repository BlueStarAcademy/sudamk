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

/** 페어 로비 채널 → 패널 톤 */
export function waitingLobbyToneFromPairChannel(ch: 'pair' | 'strategic' | 'playful'): WaitingLobbyPanelTone {
    if (ch === 'playful') return 'playful';
    if (ch === 'pair') return 'pair';
    return 'strategic';
}

const insetSoft = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

/** 「AI와 대결하기」 블록 전용 껍데기 — 전략/페어/놀이 패널 톤과 분리 */
export const aiChallengeFeatureShellClass =
    `relative overflow-hidden rounded-2xl border border-fuchsia-500/42 bg-gradient-to-br from-zinc-950 via-fuchsia-950/38 to-indigo-950/55 ` +
    `shadow-[0_18px_44px_-20px_rgba(192,38,211,0.38)] ring-1 ring-teal-400/18 ${insetSoft}`;

export const aiChallengeFeatureTopHairlineClass =
    'pointer-events-none absolute left-3 right-3 top-2 z-[1] h-px bg-gradient-to-r from-transparent via-fuchsia-300/45 to-transparent sm:left-4 sm:right-4';

/** `AiChallengePanel` 본문 행을 감싸는 안쪽 그라데이션 카드 — 페어 「페어 AI 대전」블록과 동일 */
export const aiChallengePanelInnerGradientClass =
    'rounded-xl border border-fuchsia-400/45 bg-gradient-to-r from-fuchsia-950/55 via-purple-950/55 to-indigo-950/55 p-3 shadow-[0_14px_32px_rgba(192,38,211,0.3)] ring-1 ring-fuchsia-300/20';

// —— 페어 로비 방 목록(슬롯 행·스크롤·퀵조인) —— //

export function pairLobbyRoomListOuterShellClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return `rounded-2xl border border-cyan-500/28 bg-gradient-to-br from-slate-950/92 via-cyan-950/18 to-black/55 p-1 ring-1 ring-cyan-400/14 sm:p-1.5 ${insetSoft}`;
    }
    if (lobby === 'pair') {
        return `rounded-2xl border border-violet-500/32 bg-gradient-to-br from-zinc-950/95 via-violet-950/28 to-black/55 p-1 ring-1 ring-violet-400/16 sm:p-1.5 ${insetSoft}`;
    }
    return `rounded-2xl border border-amber-500/30 bg-gradient-to-br from-zinc-950/92 via-amber-950/22 to-black/55 p-1 ring-1 ring-amber-400/14 sm:p-1.5 ${insetSoft}`;
}

export function pairLobbyRoomListScrollAreaClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-xl border border-dashed border-cyan-500/22 bg-black/28 ring-1 ring-cyan-500/08';
    }
    if (lobby === 'pair') {
        return 'rounded-xl border border-dashed border-violet-500/24 bg-black/28 ring-1 ring-violet-500/10';
    }
    return 'rounded-xl border border-dashed border-amber-500/22 bg-black/28 ring-1 ring-amber-500/08';
}

export function pairLobbyRoomEmptyRowShellClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-lg border border-cyan-500/14 bg-black/22 px-2 py-1 shadow-inner ring-1 ring-cyan-400/08';
    }
    if (lobby === 'pair') {
        return 'rounded-lg border border-violet-500/16 bg-black/22 px-2 py-1 shadow-inner ring-1 ring-violet-400/08';
    }
    return 'rounded-lg border border-amber-500/14 bg-black/22 px-2 py-1 shadow-inner ring-1 ring-amber-400/08';
}

export function pairLobbyRoomEmptySlotNumClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-lg border border-cyan-400/22 bg-black/35 font-mono tabular-nums text-cyan-200/80 shadow-inner';
    }
    if (lobby === 'pair') {
        return 'rounded-lg border border-violet-400/24 bg-black/35 font-mono tabular-nums text-violet-200/85 shadow-inner';
    }
    return 'rounded-lg border border-amber-400/22 bg-black/35 font-mono tabular-nums text-amber-200/85 shadow-inner';
}

export function pairLobbyRoomFilledCardShellClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return `flex h-full min-h-0 w-full min-w-0 flex-row items-stretch gap-2 rounded-lg border border-cyan-400/22 bg-gradient-to-r from-black/40 via-cyan-950/20 to-black/35 shadow-sm ring-1 ring-cyan-400/10 sm:gap-2.5 sm:px-2.5 sm:py-1.5`;
    }
    if (lobby === 'pair') {
        return `flex h-full min-h-0 w-full min-w-0 flex-row items-stretch gap-2 rounded-lg border border-violet-400/24 bg-gradient-to-r from-black/40 via-violet-950/22 to-black/35 shadow-sm ring-1 ring-violet-400/10 sm:gap-2.5 sm:px-2.5 sm:py-1.5`;
    }
    return `flex h-full min-h-0 w-full min-w-0 flex-row items-stretch gap-2 rounded-lg border border-amber-400/22 bg-gradient-to-r from-black/40 via-amber-950/20 to-black/35 shadow-sm ring-1 ring-amber-400/10 sm:gap-2.5 sm:px-2.5 sm:py-1.5`;
}

export const pairLobbyRoomFilledCardShellHandheldExtraClass =
    'min-w-0 flex-nowrap overflow-hidden gap-1.5 px-1.5 py-1';

// —— GameList「진행중인 대국」 —— //

export function waitingLobbyGameListHeadingTextClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'bg-gradient-to-r from-cyan-100 via-sky-100 to-cyan-200 bg-clip-text font-semibold text-transparent';
    }
    if (lobby === 'pair') {
        return 'bg-gradient-to-r from-violet-100 via-fuchsia-100 to-violet-200 bg-clip-text font-semibold text-transparent';
    }
    return 'font-semibold text-amber-50 drop-shadow-[0_0_12px_rgba(251,191,36,0.18)]';
}

export function waitingLobbyGameListHeaderDividerClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'border-cyan-500/22';
    if (lobby === 'pair') return 'border-violet-500/24';
    return 'border-amber-500/22';
}

export function waitingLobbyGameListPanelRootClass(
    lobby: WaitingLobbyPanelTone,
    embedInHomeLobbyPanel: boolean,
    compactPadding: boolean,
): string {
    const pad = compactPadding ? 'p-2 sm:p-3' : embedInHomeLobbyPanel ? 'p-3 sm:p-4' : 'p-4';
    const base = `flex min-h-0 h-full min-w-0 flex-col ${pad}`;
    if (embedInHomeLobbyPanel) {
        if (lobby === 'strategic') {
            return `${base} rounded-xl border border-white/[0.08] bg-black/28 text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-cyan-500/12`;
        }
        if (lobby === 'pair') {
            return `${base} rounded-xl border border-white/[0.08] bg-black/28 text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-violet-500/12`;
        }
        return `${base} rounded-xl border border-white/[0.08] bg-black/28 text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-amber-500/12`;
    }
    if (lobby === 'strategic') {
        return `${base} rounded-lg border border-cyan-500/32 bg-gradient-to-br from-slate-950/88 via-cyan-950/14 to-black/85 text-on-panel shadow-lg ring-1 ring-cyan-400/14`;
    }
    if (lobby === 'pair') {
        return `${base} rounded-lg border border-violet-500/34 bg-gradient-to-br from-zinc-950/92 via-violet-950/22 to-black/85 text-on-panel shadow-lg ring-1 ring-violet-400/14`;
    }
    return `${base} rounded-lg border border-amber-500/30 bg-gradient-to-br from-zinc-950/88 via-amber-950/18 to-black/85 text-on-panel shadow-lg ring-1 ring-amber-400/12`;
}

export function waitingLobbyGameListOngoingRowClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'flex items-center justify-between gap-2 rounded-lg border border-cyan-400/20 bg-gradient-to-r from-black/40 via-cyan-950/18 to-black/32 p-2.5 shadow-sm ring-1 ring-cyan-400/08';
    }
    if (lobby === 'pair') {
        return 'flex items-center justify-between gap-2 rounded-lg border border-violet-400/22 bg-gradient-to-r from-black/40 via-violet-950/20 to-black/32 p-2.5 shadow-sm ring-1 ring-violet-400/08';
    }
    return 'flex items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-gradient-to-r from-black/40 via-amber-950/18 to-black/32 p-2.5 shadow-sm ring-1 ring-amber-400/08';
}

export function waitingLobbyGameListRoomIndexBadgeClass(lobby: WaitingLobbyPanelTone, adminClickable: boolean): string {
    const hover = adminClickable ? 'cursor-pointer transition hover:brightness-110' : '';
    if (lobby === 'strategic') {
        return `flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-950/40 text-sm font-bold text-cyan-100 shadow-inner ring-1 ring-cyan-400/12 ${hover}`;
    }
    if (lobby === 'pair') {
        return `flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-violet-400/38 bg-violet-950/42 text-sm font-bold text-violet-100 shadow-inner ring-1 ring-violet-400/12 ${hover}`;
    }
    return `flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-950/40 text-sm font-bold text-amber-100 shadow-inner ring-1 ring-amber-400/12 ${hover}`;
}

export function waitingLobbyGameListVsTextClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'font-bold text-cyan-300/55';
    if (lobby === 'pair') return 'font-bold text-violet-300/55';
    return 'font-bold text-amber-300/60';
}

export function waitingLobbyGameListAdminFieldClass(lobby: WaitingLobbyPanelTone, compact: boolean): string {
    const pad = compact ? 'p-1.5 text-[0.65rem] sm:text-xs' : 'p-2 text-sm';
    if (lobby === 'strategic') {
        return `min-w-[220px] flex-1 rounded-md border border-cyan-400/25 bg-black/40 ${pad} text-cyan-50 shadow-inner ring-1 ring-cyan-500/10 placeholder:text-cyan-200/35 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/25`;
    }
    if (lobby === 'pair') {
        return `min-w-[220px] flex-1 rounded-md border border-violet-400/28 bg-black/40 ${pad} text-violet-50 shadow-inner ring-1 ring-violet-500/10 placeholder:text-violet-200/35 focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25`;
    }
    return `min-w-[220px] flex-1 rounded-md border border-amber-400/25 bg-black/40 ${pad} text-amber-50 shadow-inner ring-1 ring-amber-500/10 placeholder:text-amber-200/35 focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/25`;
}

export function waitingLobbyGameListDescriptionSnippetClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'hidden max-w-xs truncate text-sm text-cyan-200/90 md:block';
    if (lobby === 'pair') return 'hidden max-w-xs truncate text-sm text-violet-200/90 md:block';
    return 'hidden max-w-xs truncate text-sm text-amber-200/90 md:block';
}

export function waitingLobbyGameListEmptyHintClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'pt-8 text-center text-cyan-200/45';
    if (lobby === 'pair') return 'pt-8 text-center text-violet-200/45';
    return 'pt-8 text-center text-amber-200/45';
}

export function waitingLobbyGameListAdminPopoverClass(lobby: WaitingLobbyPanelTone): string {
    const base = 'absolute left-2 top-12 z-10 w-48 space-y-2 rounded-md border p-2 shadow-lg';
    if (lobby === 'strategic') {
        return `${base} border-cyan-500/28 bg-slate-950/95 ring-1 ring-cyan-400/12`;
    }
    if (lobby === 'pair') {
        return `${base} border-violet-500/30 bg-zinc-950/95 ring-1 ring-violet-400/12`;
    }
    return `${base} border-amber-500/28 bg-zinc-950/95 ring-1 ring-amber-400/12`;
}

export function pairLobbyRoomSlotNumOccupiedClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-lg border border-cyan-400/40 bg-black/45 font-mono tabular-nums text-cyan-100 shadow-inner';
    }
    if (lobby === 'pair') {
        return 'rounded-lg border border-violet-400/42 bg-black/45 font-mono tabular-nums text-violet-100 shadow-inner';
    }
    return 'rounded-lg border border-amber-400/40 bg-black/45 font-mono tabular-nums text-amber-100 shadow-inner';
}

export function pairLobbyRoomKindBadgeClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'shrink-0 rounded border border-cyan-400/42 bg-cyan-950/50 px-1 py-0.5 font-extrabold leading-none text-cyan-100 sm:px-1.5 sm:text-xs';
    }
    if (lobby === 'pair') {
        return 'shrink-0 rounded border border-violet-400/42 bg-violet-950/50 px-1 py-0.5 font-extrabold leading-none text-violet-100 sm:px-1.5 sm:text-xs';
    }
    return 'shrink-0 rounded border border-amber-400/42 bg-amber-950/50 px-1 py-0.5 font-extrabold leading-none text-amber-100 sm:px-1.5 sm:text-xs';
}

/** 방 목록 우측: 예정 게임 모드(주사위 바둑 등) — 방 종류 배지와 구분되는 사각 박스 */
export function pairLobbyGameModeBadgeClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const size = handheld ? 'text-[10px]' : 'text-[11px] sm:text-xs';
    if (lobby === 'strategic') {
        return `min-w-0 max-w-[min(100%,10rem)] shrink truncate rounded border border-slate-500/45 bg-slate-950/70 px-1 py-0.5 text-left font-bold leading-tight text-slate-100 ring-1 ring-cyan-500/12 sm:max-w-[12rem] sm:px-1.5 ${size}`;
    }
    if (lobby === 'pair') {
        return `min-w-0 max-w-[min(100%,10rem)] shrink truncate rounded border border-slate-500/45 bg-slate-950/70 px-1 py-0.5 text-left font-bold leading-tight text-slate-100 ring-1 ring-violet-500/12 sm:max-w-[12rem] sm:px-1.5 ${size}`;
    }
    return `min-w-0 max-w-[min(100%,10rem)] shrink truncate rounded border border-slate-500/45 bg-slate-950/70 px-1 py-0.5 text-left font-bold leading-tight text-slate-100 ring-1 ring-amber-500/12 sm:max-w-[12rem] sm:px-1.5 ${size}`;
}

export function pairLobbyRoomJoinButtonClass(lobby: WaitingLobbyPanelTone, joinable: boolean): string {
    const base =
        'flex shrink-0 flex-none items-center justify-center rounded-lg border text-[11px] font-extrabold leading-tight sm:text-sm';
    if (!joinable) {
        return `${base} cursor-not-allowed border-zinc-700 bg-zinc-900/60 text-zinc-500`;
    }
    if (lobby === 'strategic') {
        return `${base} border-cyan-300/55 bg-cyan-900/45 text-cyan-100 hover:brightness-110`;
    }
    if (lobby === 'pair') {
        return `${base} border-violet-300/55 bg-violet-900/45 text-violet-100 hover:brightness-110`;
    }
    return `${base} border-amber-300/55 bg-amber-900/45 text-amber-100 hover:brightness-110`;
}

export function pairLobbyRoomInGameJoinSlotClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'flex shrink-0 flex-none items-center justify-center rounded-lg border border-cyan-400/45 bg-cyan-950/55 px-0.5 text-center shadow-inner ring-1 ring-cyan-500/15';
    }
    if (lobby === 'pair') {
        return 'flex shrink-0 flex-none items-center justify-center rounded-lg border border-violet-400/45 bg-violet-950/55 px-0.5 text-center shadow-inner ring-1 ring-violet-500/15';
    }
    return 'flex shrink-0 flex-none items-center justify-center rounded-lg border border-amber-400/45 bg-amber-950/55 px-0.5 text-center shadow-inner ring-1 ring-amber-500/15';
}

export function pairLobbyRoomInGameJoinSlotTextClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'max-w-full break-words px-0.5 text-center font-black leading-tight tracking-tight text-cyan-100';
    }
    if (lobby === 'pair') {
        return 'max-w-full break-words px-0.5 text-center font-black leading-tight tracking-tight text-violet-100';
    }
    return 'max-w-full break-words px-0.5 text-center font-black leading-tight tracking-tight text-amber-100';
}

export function pairLobbyQuickJoinToolbarClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'relative flex shrink-0 flex-col gap-2 overflow-hidden rounded-2xl border border-cyan-400/28 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 px-2 py-2 ring-1 ring-cyan-500/12 sm:gap-2.5 sm:px-3 sm:py-2.5';
    }
    if (lobby === 'pair') {
        return 'relative flex shrink-0 flex-col gap-2 overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-r from-slate-950 via-violet-950/42 to-slate-950 px-2 py-2 ring-1 ring-violet-500/12 sm:gap-2.5 sm:px-3 sm:py-2.5';
    }
    return 'relative flex shrink-0 flex-col gap-2 overflow-hidden rounded-2xl border border-amber-400/28 bg-gradient-to-r from-slate-950 via-amber-950/38 to-slate-950 px-2 py-2 ring-1 ring-amber-500/12 sm:gap-2.5 sm:px-3 sm:py-2.5';
}

export function pairLobbyQuickJoinInnerWellClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-xl border border-cyan-400/15 bg-black/30 shadow-inner ring-1 ring-cyan-500/08';
    }
    if (lobby === 'pair') {
        return 'rounded-xl border border-violet-400/16 bg-black/30 shadow-inner ring-1 ring-violet-500/08';
    }
    return 'rounded-xl border border-amber-400/15 bg-black/30 shadow-inner ring-1 ring-amber-500/08';
}

export function pairLobbyQuickJoinRoomNumberRowClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'flex shrink-0 items-stretch rounded-md border border-cyan-400/22 bg-black/40 shadow-inner ring-1 ring-cyan-500/10';
    }
    if (lobby === 'pair') {
        return 'flex shrink-0 items-stretch rounded-md border border-violet-400/24 bg-black/40 shadow-inner ring-1 ring-violet-500/10';
    }
    return 'flex shrink-0 items-stretch rounded-md border border-amber-400/22 bg-black/40 shadow-inner ring-1 ring-amber-500/10';
}

export function pairLobbyQuickJoinRoomNumberInputClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const text =
        lobby === 'strategic'
            ? 'text-cyan-100 placeholder:text-cyan-200/35'
            : lobby === 'pair'
              ? 'text-violet-100 placeholder:text-violet-200/35'
              : 'text-amber-100 placeholder:text-amber-200/35';
    if (handheld) {
        return `min-w-0 w-[3rem] max-w-[4.25rem] flex-1 border-0 bg-transparent py-1 text-center text-[10px] font-semibold tabular-nums outline-none ${text}`;
    }
    return `w-[4.75rem] max-w-[5.5rem] shrink-0 border-0 bg-transparent py-1.5 text-center text-[11px] font-semibold tabular-nums outline-none sm:w-[5.25rem] sm:text-xs ${text}`;
}

export function pairLobbyQuickJoinRoomNumberGoBtnClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const pad = handheld ? 'px-1.5 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px] sm:px-3 sm:text-xs';
    if (lobby === 'strategic') {
        return `shrink-0 rounded border border-cyan-400/40 bg-gradient-to-b from-cyan-900/50 to-cyan-950/80 ${pad} font-bold text-cyan-50 transition hover:border-cyan-300/55 disabled:pointer-events-none disabled:opacity-45`;
    }
    if (lobby === 'pair') {
        return `shrink-0 rounded border border-violet-400/40 bg-gradient-to-b from-violet-900/50 to-violet-950/80 ${pad} font-bold text-violet-50 transition hover:border-violet-300/55 disabled:pointer-events-none disabled:opacity-45`;
    }
    return `shrink-0 rounded border border-amber-400/40 bg-gradient-to-b from-amber-900/50 to-amber-950/80 ${pad} font-bold text-amber-50 transition hover:border-amber-300/55 disabled:pointer-events-none disabled:opacity-45`;
}

export function pairLobbyListFilterSelectClassForTone(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const sizing = handheld
        ? 'min-w-0 max-w-none flex-1 basis-0 rounded-md py-1 pl-1.5 pr-6 text-[11px]'
        : 'max-w-[11rem] min-w-0 shrink rounded-md py-1.5 pl-2 pr-7 text-[10px] sm:max-w-[13rem] sm:text-[11px]';
    if (lobby === 'strategic') {
        return `${sizing} border border-cyan-400/28 bg-black/45 font-semibold text-cyan-100 shadow-inner ring-1 ring-cyan-500/10`;
    }
    if (lobby === 'pair') {
        return `${sizing} border border-violet-400/30 bg-black/45 font-semibold text-violet-100 shadow-inner ring-1 ring-violet-500/10`;
    }
    return `${sizing} border border-amber-400/28 bg-black/45 font-semibold text-amber-100 shadow-inner ring-1 ring-amber-500/10`;
}

export function pairLobbyOrphanRoomChipInGameClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'flex max-w-[11rem] min-w-0 items-center gap-1 truncate rounded-md border border-cyan-400/38 bg-cyan-950/50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-100';
    }
    if (lobby === 'pair') {
        return 'flex max-w-[11rem] min-w-0 items-center gap-1 truncate rounded-md border border-violet-400/38 bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-bold text-violet-100';
    }
    return 'flex max-w-[11rem] min-w-0 items-center gap-1 truncate rounded-md border border-amber-400/38 bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-100';
}

export function pairLobbyOrphanRoomChipJoinableClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'flex max-w-[11rem] min-w-0 items-center gap-1 truncate rounded-md border border-cyan-400/35 bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100 disabled:opacity-40';
    }
    if (lobby === 'pair') {
        return 'flex max-w-[11rem] min-w-0 items-center gap-1 truncate rounded-md border border-violet-400/35 bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-violet-100 disabled:opacity-40';
    }
    return 'flex max-w-[11rem] min-w-0 items-center gap-1 truncate rounded-md border border-amber-400/35 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100 disabled:opacity-40';
}

export function pairLobbyOrphanInGamePillClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'shrink-0 rounded border border-cyan-300/35 bg-black/35 px-1 py-px text-[9px] font-black text-cyan-50';
    }
    if (lobby === 'pair') {
        return 'shrink-0 rounded border border-violet-300/35 bg-black/35 px-1 py-px text-[9px] font-black text-violet-50';
    }
    return 'shrink-0 rounded border border-amber-300/35 bg-black/35 px-1 py-px text-[9px] font-black text-amber-50';
}

// —— 집계 로비「방 안」내부 카드 (PairWaitingLobby — 입장 후 방 UI) —— //

export function pairAggregateRoomInteriorShellClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return (
            'w-full min-w-0 rounded-2xl border border-cyan-400/34 bg-gradient-to-br from-slate-950/94 via-cyan-950/26 to-zinc-950 ' +
            'p-3 shadow-[0_0_40px_-12px_rgba(34,211,238,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-cyan-500/20'
        );
    }
    if (lobby === 'pair') {
        return (
            'w-full min-w-0 rounded-2xl border border-violet-400/38 bg-gradient-to-br from-violet-950/90 via-indigo-950/[0.78] to-zinc-950 ' +
            'p-3 shadow-[0_0_40px_-12px_rgba(139,92,246,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-violet-500/22'
        );
    }
    return (
        'w-full min-w-0 rounded-2xl border border-amber-400/34 bg-gradient-to-br from-zinc-950/92 via-amber-950/28 to-zinc-950 ' +
        'p-3 shadow-[0_0_40px_-12px_rgba(251,191,36,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-500/20'
    );
}

export function pairAggregateRoomInteriorShellHandheldClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return (
            'w-full min-w-0 rounded-xl border border-cyan-400/34 bg-gradient-to-br from-slate-950/94 via-cyan-950/24 to-zinc-950 ' +
            'p-2 shadow-[0_0_40px_-12px_rgba(34,211,238,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-cyan-500/20'
        );
    }
    if (lobby === 'pair') {
        return (
            'w-full min-w-0 rounded-xl border border-violet-400/38 bg-gradient-to-br from-violet-950/90 via-indigo-950/[0.78] to-zinc-950 ' +
            'p-2 shadow-[0_0_40px_-12px_rgba(139,92,246,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-violet-500/22'
        );
    }
    return (
        'w-full min-w-0 rounded-xl border border-amber-400/34 bg-gradient-to-br from-zinc-950/92 via-amber-950/26 to-zinc-950 ' +
        'p-2 shadow-[0_0_40px_-12px_rgba(251,191,36,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-500/20'
    );
}

export function pairAggregateRoomInteriorHeaderDividerHandheldClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'gap-1.5 border-b border-cyan-400/24 pb-2';
    if (lobby === 'pair') return 'gap-1.5 border-b border-violet-400/22 pb-2';
    return 'gap-1.5 border-b border-amber-400/24 pb-2';
}

export function pairAggregateRoomInteriorHeaderDividerDesktopClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'gap-2 border-b border-cyan-400/26 pb-3';
    if (lobby === 'pair') return 'gap-2 border-b border-violet-400/22 pb-3';
    return 'gap-2 border-b border-amber-400/25 pb-3';
}

export function pairAggregateRoomInteriorTeamBoxClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-xl border border-cyan-400/28 bg-black/45 p-2 shadow-inner ring-1 ring-cyan-500/10';
    }
    if (lobby === 'pair') {
        return 'rounded-xl border border-violet-400/26 bg-black/45 p-2 shadow-inner ring-1 ring-violet-500/[0.08]';
    }
    return 'rounded-xl border border-amber-400/26 bg-black/45 p-2 shadow-inner ring-1 ring-amber-500/10';
}

export function pairAggregateRoomInteriorTeamBoxHandheldClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'rounded-lg border border-cyan-400/28 bg-black/45 p-1.5 shadow-inner ring-1 ring-cyan-500/10';
    }
    if (lobby === 'pair') {
        return 'rounded-lg border border-violet-400/26 bg-black/45 p-1.5 shadow-inner ring-1 ring-violet-500/[0.08]';
    }
    return 'rounded-lg border border-amber-400/26 bg-black/45 p-1.5 shadow-inner ring-1 ring-amber-500/10';
}

export function pairAggregateRoomInteriorActionBarClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'grid shrink-0 gap-2 rounded-2xl border border-cyan-400/32 bg-gradient-to-r from-cyan-950/55 via-slate-950/70 to-zinc-950/90 p-2 ring-1 ring-cyan-500/16';
    }
    if (lobby === 'pair') {
        return 'grid shrink-0 gap-2 rounded-2xl border border-violet-400/32 bg-gradient-to-r from-violet-950/60 via-indigo-950/45 to-zinc-950/85 p-2 ring-1 ring-violet-500/18';
    }
    return 'grid shrink-0 gap-2 rounded-2xl border border-amber-400/32 bg-gradient-to-r from-amber-950/55 via-zinc-900/55 to-zinc-950/88 p-2 ring-1 ring-amber-500/16';
}

export function pairAggregateRoomInteriorActionBarHandheldClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'grid shrink-0 gap-1 rounded-lg border border-cyan-400/32 bg-gradient-to-r from-cyan-950/55 via-slate-950/70 to-zinc-950/90 p-1 ring-1 ring-cyan-500/16';
    }
    if (lobby === 'pair') {
        return 'grid shrink-0 gap-1 rounded-lg border border-violet-400/32 bg-gradient-to-r from-violet-950/60 via-indigo-950/45 to-zinc-950/85 p-1 ring-1 ring-violet-500/18';
    }
    return 'grid shrink-0 gap-1 rounded-lg border border-amber-400/32 bg-gradient-to-r from-amber-950/55 via-zinc-900/55 to-zinc-950/88 p-1 ring-1 ring-amber-500/16';
}

export function pairAggregateRoomInteriorTitleTextClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'min-w-0 truncate bg-gradient-to-r from-cyan-50 via-sky-100 to-cyan-100 bg-clip-text font-extrabold text-transparent';
    }
    if (lobby === 'pair') {
        return 'min-w-0 truncate bg-gradient-to-r from-violet-50 to-indigo-100 bg-clip-text font-extrabold text-transparent';
    }
    return 'min-w-0 truncate bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 bg-clip-text font-extrabold text-transparent';
}

export function pairAggregateRoomInteriorVisibilityPrivateClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const size = handheld ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px] sm:text-xs';
    if (lobby === 'strategic') {
        return `shrink-0 whitespace-nowrap rounded-md border font-extrabold sm:rounded-lg ${size} border-cyan-500/42 bg-cyan-950/65 text-cyan-50`;
    }
    if (lobby === 'pair') {
        return `shrink-0 whitespace-nowrap rounded-md border font-extrabold sm:rounded-lg ${size} border-violet-400/45 bg-violet-950/55 text-violet-100`;
    }
    return `shrink-0 whitespace-nowrap rounded-md border font-extrabold sm:rounded-lg ${size} border-amber-500/42 bg-amber-950/60 text-amber-50`;
}

export function pairAggregateRoomInteriorGameSettingsOuterClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const pad = handheld ? 'px-2 py-1.5 text-[11px]' : 'px-2.5 py-2.5 text-sm sm:px-3 sm:py-3';
    if (lobby === 'strategic') {
        return `w-full min-w-0 shrink-0 rounded-xl border-2 border-cyan-500/35 bg-gradient-to-b from-cyan-950/22 via-black/50 to-black/60 text-cyan-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-400/18 ${pad}`;
    }
    if (lobby === 'pair') {
        return `w-full min-w-0 shrink-0 rounded-xl border-2 border-violet-500/35 bg-gradient-to-b from-violet-950/25 via-black/50 to-black/60 text-violet-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-400/15 ${pad}`;
    }
    return `w-full min-w-0 shrink-0 rounded-xl border-2 border-amber-500/34 bg-gradient-to-b from-amber-950/22 via-black/50 to-black/60 text-amber-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/16 ${pad}`;
}

export function pairAggregateRoomInteriorGameSettingsHeadingRowClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const text = handheld ? 'text-[11px]' : 'text-sm sm:text-base';
    if (lobby === 'strategic') {
        return `rounded-lg border border-cyan-400/28 bg-black/30 px-2 py-0.5 text-center font-extrabold tracking-tight text-cyan-100 shadow-inner sm:py-1 ${text}`;
    }
    if (lobby === 'pair') {
        return `rounded-lg border border-violet-400/25 bg-black/30 px-2 py-0.5 text-center font-extrabold tracking-tight text-violet-100 shadow-inner sm:py-1 ${text}`;
    }
    return `rounded-lg border border-amber-400/28 bg-black/30 px-2 py-0.5 text-center font-extrabold tracking-tight text-amber-100 shadow-inner sm:py-1 ${text}`;
}

export function pairAggregateRoomInteriorGameModeColumnClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const wh = handheld
        ? 'w-[5.25rem] min-h-0 gap-1 px-1.5 py-1.5'
        : 'w-[6.75rem] min-h-0 gap-2 px-2 py-2.5 sm:w-[8.25rem] sm:gap-2.5 sm:px-2.5 sm:py-3';
    if (lobby === 'strategic') {
        return `flex min-h-0 shrink-0 flex-col items-stretch rounded-xl border-2 border-cyan-400/42 bg-black/45 shadow-inner ring-1 ring-cyan-300/15 ${wh}`;
    }
    if (lobby === 'pair') {
        return `flex min-h-0 shrink-0 flex-col items-stretch rounded-xl border-2 border-violet-400/40 bg-black/45 shadow-inner ring-1 ring-violet-300/15 ${wh}`;
    }
    return `flex min-h-0 shrink-0 flex-col items-stretch rounded-xl border-2 border-amber-400/42 bg-black/45 shadow-inner ring-1 ring-amber-300/15 ${wh}`;
}

export function pairAggregateRoomInteriorGameModeColumnHeaderClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const t = handheld ? 'pb-1.5 text-[10px]' : 'pb-1.5 text-[11px] sm:text-xs';
    if (lobby === 'strategic') {
        return `w-full border-b border-cyan-400/28 pb-1.5 text-center font-extrabold uppercase tracking-wide text-cyan-200/95 ${t}`;
    }
    if (lobby === 'pair') {
        return `w-full border-b border-violet-400/25 pb-1.5 text-center font-extrabold uppercase tracking-wide text-violet-200/95 ${t}`;
    }
    return `w-full border-b border-amber-400/28 pb-1.5 text-center font-extrabold uppercase tracking-wide text-amber-200/95 ${t}`;
}

export function pairAggregateRoomInteriorGameModeNameBoxClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const sz = handheld ? 'text-[11px] leading-tight' : 'text-sm sm:text-base';
    if (lobby === 'strategic') {
        return `w-full rounded-md border border-white/10 bg-cyan-950/35 px-1 py-1 text-center font-extrabold leading-snug text-white ${sz}`;
    }
    if (lobby === 'pair') {
        return `w-full rounded-md border border-white/10 bg-violet-950/35 px-1 py-1 text-center font-extrabold leading-snug text-white ${sz}`;
    }
    return `w-full rounded-md border border-white/10 bg-amber-950/38 px-1 py-1 text-center font-extrabold leading-snug text-white ${sz}`;
}

export function pairAggregateRoomInteriorGameModeIconDropShadowClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'drop-shadow-[0_0_14px_rgba(34,211,238,0.42)]';
    if (lobby === 'pair') return 'drop-shadow-[0_0_14px_rgba(167,139,250,0.4)]';
    return 'drop-shadow-[0_0_14px_rgba(251,191,36,0.38)]';
}

export function pairAggregateRoomInteriorDetailColumnOuterClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-cyan-500/30 bg-black/50 shadow-inner ring-1 ring-cyan-400/14 sm:min-w-[12rem]';
    }
    if (lobby === 'pair') {
        return 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-violet-500/32 bg-black/50 shadow-inner ring-1 ring-violet-400/14 sm:min-w-[12rem]';
    }
    return 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-500/30 bg-black/50 shadow-inner ring-1 ring-amber-400/14 sm:min-w-[12rem]';
}

export function pairAggregateRoomInteriorDetailColumnHeaderClass(lobby: WaitingLobbyPanelTone, handheld: boolean): string {
    const pad = handheld ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs';
    if (lobby === 'strategic') {
        return `shrink-0 border-b border-cyan-500/25 bg-cyan-950/30 text-center font-extrabold uppercase tracking-wide text-cyan-100/95 ${pad}`;
    }
    if (lobby === 'pair') {
        return `shrink-0 border-b border-violet-500/25 bg-violet-950/28 text-center font-extrabold uppercase tracking-wide text-violet-100/95 ${pad}`;
    }
    return `shrink-0 border-b border-amber-500/25 bg-amber-950/30 text-center font-extrabold uppercase tracking-wide text-amber-100/95 ${pad}`;
}

export function pairAggregateRoomSeatDelegateBtnToneClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') {
        return 'border border-cyan-400/55 bg-cyan-950/70 text-cyan-100 hover:border-cyan-300/60 hover:bg-cyan-900/55';
    }
    if (lobby === 'pair') {
        return 'border border-violet-400/55 bg-violet-950/70 text-violet-100 hover:border-violet-300/60 hover:bg-violet-900/55';
    }
    return 'border border-amber-400/55 bg-amber-950/70 text-amber-100 hover:border-amber-300/60 hover:bg-amber-900/55';
}

export type PairRoomChatInteriorChrome = {
    rootFill: string;
    rootFixed: string;
    toolbar: string;
    title: string;
    tabShell: string;
    tabActive: string;
    emptyHint: string;
    messageBubble: string;
    selfName: string;
    form: string;
    input: string;
};

export function pairRoomChatInteriorChrome(lobby: WaitingLobbyPanelTone): PairRoomChatInteriorChrome {
    if (lobby === 'strategic') {
        return {
            rootFill:
                'flex h-full min-h-0 flex-1 flex-col rounded-xl border border-cyan-400/30 bg-cyan-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-500/10',
            rootFixed:
                'flex flex-col rounded-xl border border-cyan-400/30 bg-cyan-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-500/10',
            toolbar: 'flex shrink-0 items-center gap-1.5 border-b border-cyan-400/25',
            title: 'font-extrabold tracking-wide text-cyan-200/95',
            tabShell: 'grid grid-cols-2 overflow-hidden rounded-lg border border-cyan-400/25 bg-black/35 p-0.5',
            tabActive: 'rounded-md bg-cyan-500/80 px-1.5 py-0.5 font-extrabold text-white shadow-sm',
            emptyHint: 'text-cyan-300/45',
            messageBubble: 'break-words rounded-md border border-cyan-500/12 bg-black/30',
            selfName: 'text-cyan-200',
            form: 'flex shrink-0 items-stretch gap-0.5 border-t border-cyan-400/25',
            input:
                'min-w-0 flex-1 border border-cyan-400/25 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:opacity-45',
        };
    }
    if (lobby === 'pair') {
        return {
            rootFill:
                'flex h-full min-h-0 flex-1 flex-col rounded-xl border border-violet-400/30 bg-violet-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/10',
            rootFixed:
                'flex flex-col rounded-xl border border-violet-400/30 bg-violet-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/10',
            toolbar: 'flex shrink-0 items-center gap-1.5 border-b border-violet-400/25',
            title: 'font-extrabold tracking-wide text-violet-200/95',
            tabShell: 'grid grid-cols-2 overflow-hidden rounded-lg border border-violet-400/25 bg-black/35 p-0.5',
            tabActive: 'rounded-md bg-violet-500/80 px-1.5 py-0.5 font-extrabold text-white shadow-sm',
            emptyHint: 'text-violet-300/45',
            messageBubble: 'break-words rounded-md border border-violet-500/10 bg-black/30',
            selfName: 'text-violet-200',
            form: 'flex shrink-0 items-stretch gap-0.5 border-t border-violet-400/25',
            input:
                'min-w-0 flex-1 border border-violet-400/25 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/50 disabled:opacity-45',
        };
    }
    return {
        rootFill:
            'flex h-full min-h-0 flex-1 flex-col rounded-xl border border-amber-400/32 bg-amber-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-500/10',
        rootFixed:
            'flex flex-col rounded-xl border border-amber-400/32 bg-amber-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-500/10',
        toolbar: 'flex shrink-0 items-center gap-1.5 border-b border-amber-400/26',
        title: 'font-extrabold tracking-wide text-amber-200/95',
        tabShell: 'grid grid-cols-2 overflow-hidden rounded-lg border border-amber-400/28 bg-black/35 p-0.5',
        tabActive: 'rounded-md bg-amber-500/85 px-1.5 py-0.5 font-extrabold text-amber-950 shadow-sm',
        emptyHint: 'text-amber-300/45',
        messageBubble: 'break-words rounded-md border border-amber-500/14 bg-black/30',
        selfName: 'text-amber-200',
        form: 'flex shrink-0 items-stretch gap-0.5 border-t border-amber-400/26',
        input:
            'min-w-0 flex-1 border border-amber-400/28 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/50 disabled:opacity-45',
    };
}

// —— AiChallengeModal: 버킷별 껍데기(「AI와 대결」 전용 vs 방 만들기=경기장 톤) —— //

export type AiChallengeModalChromeKind = 'ai_feature' | WaitingLobbyPanelTone;

/** `preferredGameSettingsBucket` 문자열로 모달 외곽 톤 결정 — `AiChallengeModal`과 동일 키 규칙 */
export function aiChallengeModalChromeFromBucket(bucket: string): AiChallengeModalChromeKind {
    /** 전략·페어 AI 매치만 「AI 기능」푸시아 쉘. 놀이바둑 AI는 `playful_*` 방 만들기와 동일 앰버 톤. */
    if (bucket === 'strategic_ai_challenge' || bucket === 'pair_ai_match_modal') {
        return 'ai_feature';
    }
    if (bucket.startsWith('playful_')) return 'playful';
    if (bucket.startsWith('pair_')) return 'pair';
    return 'strategic';
}

export function aiChallengeModalBodyFrameClass(kind: AiChallengeModalChromeKind): string {
    const base =
        'flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
    if (kind === 'ai_feature') {
        return `${base} border border-fuchsia-400/45 bg-gradient-to-br from-zinc-950/97 via-fuchsia-950/34 to-indigo-950/92 ring-1 ring-teal-400/16`;
    }
    if (kind === 'strategic') {
        return `${base} border border-cyan-500/38 bg-gradient-to-br from-zinc-900/95 via-slate-950/98 to-black/92 ring-1 ring-cyan-400/22`;
    }
    if (kind === 'pair') {
        return `${base} border border-violet-400/40 bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black/92 ring-1 ring-violet-500/15`;
    }
    return `${base} border border-amber-500/36 bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black/92 ring-1 ring-amber-400/18`;
}

export function aiChallengeModalModePickerColumnClass(kind: AiChallengeModalChromeKind): string {
    const layout =
        'flex min-h-0 max-h-[min(50dvh,28rem)] flex-col overflow-hidden border-b border-gray-700 p-3 text-on-panel sm:p-4 lg:max-h-none lg:min-h-[11rem] lg:w-[min(36%,20rem)] lg:min-w-[15.5rem] lg:max-w-[20rem] lg:shrink-0 lg:border-b-0 lg:border-r lg:border-gray-700';
    if (kind === 'ai_feature') {
        return `${layout} bg-gradient-to-b from-fuchsia-950/28 via-zinc-950/92 to-black/90 ring-1 ring-inset ring-fuchsia-500/10`;
    }
    if (kind === 'strategic') {
        return `${layout} bg-gradient-to-b from-cyan-950/22 via-slate-950/92 to-black/88 ring-1 ring-inset ring-cyan-500/10`;
    }
    if (kind === 'pair') {
        return `${layout} bg-gradient-to-b from-violet-950/24 via-zinc-950/92 to-black/88 ring-1 ring-inset ring-violet-500/10`;
    }
    return `${layout} bg-gradient-to-b from-amber-950/22 via-zinc-950/92 to-black/88 ring-1 ring-inset ring-amber-500/10`;
}

export function aiChallengeModalModeTitleTextClass(kind: AiChallengeModalChromeKind): string {
    if (kind === 'ai_feature') return 'text-fuchsia-100';
    if (kind === 'strategic') return 'text-cyan-100';
    if (kind === 'pair') return 'text-violet-100';
    return 'text-amber-100';
}

export function aiChallengeModalDenseSettingsHeadingClass(kind: AiChallengeModalChromeKind): string {
    if (kind === 'ai_feature') return 'text-fuchsia-100';
    if (kind === 'strategic') return 'text-cyan-100';
    if (kind === 'pair') return 'text-violet-100';
    return 'text-amber-100';
}

export function aiChallengeModalMobileNextCtaClass(kind: AiChallengeModalChromeKind): string {
    const base =
        'inline-flex min-h-[2.55rem] max-w-[min(12.25rem,76vw)] shrink-0 items-center justify-center rounded-xl border px-4 text-[12.5px] font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_0_rgba(30,27,75,0.45),0_12px_32px_-12px_rgba(99,102,241,0.35)] transition-all duration-200 hover:brightness-[1.06] active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] touch-manipulation disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!hover:brightness-100';
    if (kind === 'ai_feature') {
        return `${base} border-fuchsia-300/50 bg-gradient-to-br from-fuchsia-600/96 via-purple-700/94 to-indigo-900 ring-1 ring-fuchsia-300/25 focus-visible:ring-fuchsia-400/45`;
    }
    if (kind === 'strategic') {
        return `${base} border-cyan-300/48 bg-gradient-to-br from-cyan-600/92 via-sky-800/92 to-slate-900 ring-1 ring-cyan-300/22 focus-visible:ring-cyan-400/45`;
    }
    if (kind === 'pair') {
        return `${base} border-violet-300/45 bg-gradient-to-br from-violet-500/96 via-fuchsia-600/94 to-indigo-800 ring-1 ring-violet-300/22 focus-visible:ring-violet-400/45`;
    }
    return `${base} border-amber-300/48 bg-gradient-to-br from-amber-600/92 via-orange-800/88 to-zinc-900 ring-1 ring-amber-300/22 focus-visible:ring-amber-400/45`;
}

export function aiChallengeModalPairHandheldNextButtonClass(kind: AiChallengeModalChromeKind): string {
    const base = '!justify-center rounded-xl !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-60 !font-extrabold';
    if (kind === 'ai_feature') {
        return `${base} border border-fuchsia-400/50 bg-fuchsia-900/55 !text-fuchsia-50`;
    }
    if (kind === 'strategic') {
        return `${base} border border-cyan-400/50 bg-cyan-900/55 !text-cyan-50`;
    }
    if (kind === 'pair') {
        return `${base} border border-violet-400/50 bg-violet-900/55 !text-violet-50`;
    }
    return `${base} border border-amber-400/50 bg-amber-900/55 !text-amber-50`;
}

/**
 * 모바일 단독 「AI와 대결하기」: 게임 모드 단계 본문 — `PairWaitingLobby` 핸드헬드 방 만들기 1단계와 동일한 단열·그라데이션 톤.
 */
export function aiChallengeModalHandheldModeStepShellClass(kind: AiChallengeModalChromeKind): string {
    const shell =
        'relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/12 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset sm:p-3';
    if (kind === 'ai_feature') {
        return `${shell} bg-gradient-to-b from-fuchsia-950/38 via-zinc-950/96 to-black/92 ring-fuchsia-500/14`;
    }
    if (kind === 'strategic') {
        return `${shell} bg-gradient-to-b from-cyan-950/28 via-slate-950/96 to-black/92 ring-cyan-500/12`;
    }
    if (kind === 'pair') {
        return `${shell} bg-gradient-to-b from-violet-950/30 via-zinc-950/96 to-black/92 ring-violet-500/12`;
    }
    return `${shell} bg-gradient-to-b from-amber-950/26 via-zinc-950/96 to-black/92 ring-amber-500/12`;
}

/**
 * 모바일 단독 AI 모달 — 「대국 설정」스크롤 구역(방 만들기 2단계 본문 톤).
 */
/** 모바일 단독 AI 모달 상단 — 선택 모드 요약 카드 외곽 링(방 만들기 임베드 상단과 유사) */
export function aiChallengeModalHandheldSummaryOuterClass(kind: AiChallengeModalChromeKind): string {
    const b = 'shrink-0 rounded-2xl p-[3px] ring-1 ring-inset';
    if (kind === 'ai_feature') return `${b} ring-fuchsia-400/22`;
    if (kind === 'strategic') return `${b} ring-cyan-400/18`;
    if (kind === 'pair') return `${b} ring-violet-400/18`;
    return `${b} ring-amber-400/18`;
}

export function aiChallengeModalHandheldSettingsScrollShellClass(kind: AiChallengeModalChromeKind): string {
    const base =
        'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-white/12 bg-black/40 px-2 py-2 shadow-inner ring-1 ring-black/35 [-webkit-overflow-scrolling:touch] sm:px-2.5 sm:py-2.5';
    if (kind === 'ai_feature') {
        return `${base} ring-fuchsia-500/10`;
    }
    if (kind === 'strategic') {
        return `${base} ring-cyan-500/10`;
    }
    if (kind === 'pair') {
        return `${base} ring-violet-500/10`;
    }
    return `${base} ring-amber-500/10`;
}

export function aiChallengeModalGameModeOverlayTone(kind: AiChallengeModalChromeKind): {
    panel: string;
    title: string;
} {
    if (kind === 'ai_feature') {
        return {
            panel: 'border-fuchsia-300/60 bg-gradient-to-b from-fuchsia-950/97 via-zinc-950/95 to-black/94 shadow-[0_20px_48px_-12px_rgba(217,70,239,0.55)]',
            title: 'text-fuchsia-50',
        };
    }
    if (kind === 'strategic') {
        return {
            panel: 'border-cyan-300/60 bg-gradient-to-b from-cyan-950/97 via-zinc-950/95 to-black/94 shadow-[0_20px_48px_-12px_rgba(34,211,238,0.45)]',
            title: 'text-cyan-50',
        };
    }
    if (kind === 'pair') {
        return {
            panel: 'border-violet-300/60 bg-gradient-to-b from-violet-950/97 via-zinc-950/95 to-black/94 shadow-[0_20px_48px_-12px_rgba(139,92,246,0.5)]',
            title: 'text-violet-50',
        };
    }
    return {
        panel: 'border-amber-300/60 bg-gradient-to-b from-amber-950/97 via-zinc-950/95 to-black/94 shadow-[0_20px_48px_-12px_rgba(251,191,36,0.42)]',
        title: 'text-amber-50',
    };
}

export function aiChallengeModalGameCardSelectedTitleClass(kind: AiChallengeModalChromeKind): string {
    if (kind === 'ai_feature') return 'text-fuchsia-50';
    if (kind === 'strategic') return 'text-cyan-50';
    if (kind === 'pair') return 'text-violet-50';
    return 'text-amber-50';
}

export function aiChallengeModalGameCardSelectedRingOverlayClass(kind: AiChallengeModalChromeKind): string {
    if (kind === 'ai_feature') {
        return 'border-2 border-fuchsia-300 shadow-[0_0_0_1px_rgba(232,121,249,0.55),0_0_14px_rgba(217,70,239,0.55)]';
    }
    if (kind === 'strategic') {
        return 'border-2 border-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_0_14px_rgba(34,211,238,0.5)]';
    }
    if (kind === 'pair') {
        return 'border-2 border-violet-300 shadow-[0_0_0_1px_rgba(167,139,250,0.52),0_0_14px_rgba(139,92,246,0.52)]';
    }
    return 'border-2 border-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.48),0_0_14px_rgba(251,191,36,0.45)]';
}

export function aiChallengeModalGameCardSurfaceClass(
    kind: AiChallengeModalChromeKind,
    isSelected: boolean,
    compact: boolean,
): string {
    const base =
        'box-border bg-panel text-on-panel flex w-full touch-manipulation flex-col items-center gap-1 rounded-lg p-2 text-center text-sm transition-[box-shadow,background-color]';
    if (isSelected) {
        const selectedGlow =
            kind === 'ai_feature'
                ? 'shadow-[0_12px_32px_-10px_rgba(217,70,239,0.45)]'
                : kind === 'strategic'
                  ? 'shadow-[0_12px_32px_-10px_rgba(34,211,238,0.42)]'
                  : kind === 'pair'
                    ? 'shadow-[0_12px_32px_-10px_rgba(139,92,246,0.45)]'
                    : 'shadow-[0_12px_32px_-10px_rgba(251,191,36,0.38)]';
        return compact
            ? `${base} cursor-pointer ${selectedGlow}`
            : `${base} cursor-pointer ${selectedGlow} active:scale-[0.98]`;
    }
    if (kind === 'ai_feature') {
        return `${base} cursor-pointer border-2 border-transparent shadow-lg active:scale-[0.98] hover:border-fuchsia-400/45 hover:ring-1 hover:ring-fuchsia-400/35`;
    }
    if (kind === 'strategic') {
        return `${base} cursor-pointer border-2 border-transparent shadow-lg active:scale-[0.98] hover:border-cyan-400/45 hover:ring-1 hover:ring-cyan-400/35`;
    }
    if (kind === 'pair') {
        return `${base} cursor-pointer border-2 border-transparent shadow-lg active:scale-[0.98] hover:border-violet-400/45 hover:ring-1 hover:ring-violet-400/35`;
    }
    return `${base} cursor-pointer border-2 border-transparent shadow-lg active:scale-[0.98] hover:border-amber-400/45 hover:ring-1 hover:ring-amber-400/35`;
}
