import React, { useLayoutEffect, useRef } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { LiveGameSession, GameMode } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { MatchPlayGuideSection } from '../../utils/matchPlayGuide.js';
import type { PreGameItemSlot, PreGameSummaryFour } from '../../utils/preGameSummaryFour.js';
import { RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS } from './ResultModalRewardSlot.js';

const summaryNone = () => tx('game:preGame.none');

/** 설정의 패널 엣지(::before 코너) + 금테가 적용되도록 루트에 붙입니다. */
export const PRE_GAME_MODAL_SHELL_CLASS =
  'sudamr-panel-edge-host relative flex flex-col overflow-hidden rounded-2xl border-2 border-amber-400/45 text-on-panel bg-gradient-to-br from-[#2a2640] via-[#181528] to-[#0a0812] shadow-[0_32px_100px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.11),0_0_72px_-28px_rgba(139,92,246,0.14),0_0_48px_-32px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/28';

export const PRE_GAME_MODAL_LAYER_CLASS = 'relative z-[2]';

export const PRE_GAME_MODAL_FOOTER_CLASS =
  'relative z-20 flex flex-shrink-0 flex-wrap items-center justify-center gap-3 border-t border-amber-500/35 bg-gradient-to-t from-[#0c0a10] via-[#14111c] to-[#1c1828] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]';

/** 보라 CTA — AI 대국 시작 등 */
export const PRE_GAME_MODAL_PRIMARY_BTN_CLASS =
  'min-h-[3.1rem] !rounded-[0.65rem] !border !border-violet-300/40 !bg-gradient-to-br !from-violet-500 !via-fuchsia-600 !to-indigo-700 !text-white !font-semibold !tracking-wide !shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_0_0_rgba(49,46,129,0.55),0_14px_40px_-10px_rgba(139,92,246,0.55)] hover:!brightness-[1.08] hover:!border-violet-200/50 active:!translate-y-px active:!shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_0_rgba(49,46,129,0.5)] !transition-all !duration-200 focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-violet-400/50 focus-visible:!ring-offset-2 focus-visible:!ring-offset-zinc-950';

/** 보조 — 나가기·취소 */
export const PRE_GAME_MODAL_SECONDARY_BTN_CLASS =
  'min-h-[3.1rem] !rounded-[0.65rem] !border !border-white/[0.14] !bg-gradient-to-b !from-zinc-600/95 !via-zinc-800 !to-zinc-950 !text-white/95 !font-semibold !tracking-wide !shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_4px_0_0_rgba(0,0,0,0.45),0_10px_28px_-8px_rgba(0,0,0,0.5)] hover:!from-zinc-500 hover:!brightness-105 active:!translate-y-px active:!shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_0_rgba(0,0,0,0.4)] !transition-all !duration-200 focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-zinc-400/45 focus-visible:!ring-offset-2 focus-visible:!ring-offset-zinc-950';

/** 앰버 CTA — 싱글 시작하기 · 수정 제안 */
export const PRE_GAME_MODAL_ACCENT_BTN_CLASS =
  'min-h-[3.1rem] !rounded-[0.65rem] !border !border-amber-200/45 !bg-gradient-to-br !from-amber-400 !via-amber-500 !to-yellow-600 !text-zinc-950 !font-semibold !tracking-wide !shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_0_0_rgba(180,83,9,0.45),0_14px_40px_-10px_rgba(245,158,11,0.4)] hover:!brightness-105 hover:!border-amber-100/55 active:!translate-y-px active:!shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_0_0_rgba(180,83,9,0.4)] !transition-all !duration-200 focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-amber-400/55 focus-visible:!ring-offset-2 focus-visible:!ring-offset-zinc-950';

/** 수락·긍정 확정 */
export const PRE_GAME_MODAL_SUCCESS_BTN_CLASS =
  'min-h-[3.25rem] !rounded-xl !border-2 !border-emerald-400/50 !bg-gradient-to-r !from-emerald-600 !via-teal-600 !to-emerald-800 !text-white !shadow-[0_14px_40px_-12px_rgba(52,211,153,0.42)] hover:!from-emerald-500 hover:!via-teal-500 hover:!to-emerald-700 focus:!ring-emerald-400/45 focus:!ring-offset-2 focus:!ring-offset-zinc-950';

/** 거절·신청 취소 */
export const PRE_GAME_MODAL_DANGER_BTN_CLASS =
  'min-h-[3.25rem] !rounded-xl !border-2 !border-red-400/55 !bg-gradient-to-r !from-red-600 !via-rose-600 !to-red-800 !text-white !shadow-[0_14px_40px_-12px_rgba(239,68,68,0.42)] hover:!from-red-500 hover:!via-rose-500 hover:!to-red-700 focus:!ring-red-400/45 focus:!ring-offset-2 focus:!ring-offset-zinc-950';

/**
 * 모바일·좁은 뷰포트 대기실: AI 대결 / PVP 신청 하단 — `Button`에 `bare`와 함께 사용.
 * 입체 하이라이트·링·터치 영역 확대.
 */
export const LOBBY_MOBILE_MODAL_FOOTER_CLASS =
  'border-t border-amber-400/35 bg-gradient-to-t from-[#060508] via-[#0f0d14] to-[#16131f] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] sm:px-4 sm:py-3.5';

export const LOBBY_MOBILE_BTN_PRIMARY_CLASS =
  'inline-flex min-h-[3.35rem] w-full flex-1 items-center justify-center rounded-xl border border-violet-200/40 bg-gradient-to-br from-violet-500 via-fuchsia-600 to-indigo-800 px-4 text-[15px] font-bold tracking-wide text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.24),0_5px_0_0_rgba(55,48,163,0.72),0_22px_48px_-14px_rgba(139,92,246,0.52)] ring-1 ring-violet-300/25 transition-all duration-200 hover:brightness-[1.08] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_3px_0_0_rgba(55,48,163,0.62)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] touch-manipulation';

export const LOBBY_MOBILE_BTN_SECONDARY_CLASS =
  'inline-flex min-h-[3.35rem] w-full flex-1 items-center justify-center rounded-xl border border-slate-500/55 bg-gradient-to-b from-slate-600/98 via-slate-800 to-slate-950 px-4 text-[15px] font-bold tracking-wide text-slate-50 shadow-[inset_0_2px_0_rgba(255,255,255,0.13),0_5px_0_0_rgba(15,23,42,0.88),0_18px_40px_-12px_rgba(0,0,0,0.58)] ring-1 ring-white/[0.08] transition-all duration-200 hover:from-slate-500 hover:brightness-[1.05] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] touch-manipulation';

export const LOBBY_MOBILE_BTN_DANGER_CLASS =
  'inline-flex min-h-[3.35rem] w-full flex-1 items-center justify-center rounded-xl border border-rose-300/45 bg-gradient-to-br from-rose-600 via-red-600 to-red-950 px-4 text-[15px] font-bold tracking-wide text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2),0_5px_0_0_rgba(127,29,29,0.72),0_20px_44px_-12px_rgba(239,68,68,0.48)] ring-1 ring-rose-300/30 transition-all duration-200 hover:brightness-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] touch-manipulation';

export const LOBBY_MOBILE_BTN_DISABLED_WAIT_CLASS =
  'inline-flex min-h-[3.35rem] w-full flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900/55 px-4 text-[15px] font-semibold tracking-wide text-zinc-500 shadow-inner ring-1 ring-white/[0.04]';

/** 모바일 AI 모달 헤더 「뒤로」 — DraggableWindow headerContent용 */
export const LOBBY_MOBILE_HEADER_BACK_BTN_CLASS =
  'rounded-lg border border-amber-400/35 bg-gradient-to-b from-amber-500/25 to-amber-950/40 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_-6px_rgba(245,158,11,0.35)] ring-1 ring-amber-500/20 transition-all active:scale-[0.98] hover:from-amber-500/35 hover:to-amber-950/50 touch-manipulation sm:text-sm sm:px-4 sm:py-2';

function modeMetaImage(mode: GameMode): string | undefined {
  const meta = SPECIAL_GAME_MODES.find((m) => m.mode === mode) ?? PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
  return meta?.image;
}

function preGameScoreBoxImage(session: LiveGameSession): string {
  const img = modeMetaImage(session.mode);
  if (img) return img;
  const mixed = session.settings.mixedModes ?? [];
  for (const m of mixed) {
    const i = modeMetaImage(m);
    if (i) return i;
  }
  return '/images/simbols/simbol1.webp';
}

/**
 * 점수 요인·시간 규칙 등: `\n`이 있으면 의도적 여러 줄, 없으면 한 줄 유지(넘치면 글자만 축소).
 */
export function PreGameSummaryCellBody({
  text,
  density = 'default',
}: {
  text: string;
  /** compact: 시작 전 요약 그리드 등 여백 최소화 / comfortable: 모바일 단일열용 조금 더 큼 / micro: 모험 등 초짧은 카피용 */
  density?: 'default' | 'compact' | 'comfortable' | 'micro';
}) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isMultiline = lines.length > 1;
  const singleLine = (lines.length === 1 ? lines[0] : text.trim()) || text;
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (isMultiline) return;
    /** comfortable: 시작 전 모달(좁은 뷰)에서 한 줄 강제·글자 축소 대신 줄바꿈으로 가로 공간 활용 */
    if (density === 'comfortable') return;
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = '';
      let px = parseFloat(window.getComputedStyle(el).fontSize) || 15;
      const minPx = density === 'micro' ? 7.5 : density === 'compact' ? 8.5 : 9;
      const maxW = parent.clientWidth;
      el.style.fontSize = `${px}px`;
      while (px > minPx && el.scrollWidth > maxW) {
        px -= 0.5;
        el.style.fontSize = `${px}px`;
      }
    };
    fit();
    const parent = el.parentElement;
    if (!parent) return () => {};
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [singleLine, isMultiline, density]);

  const lineClass =
    density === 'micro'
      ? 'text-[0.68rem] font-semibold leading-tight text-white/95 sm:text-[0.72rem] md:text-[0.76rem]'
      : density === 'compact'
        ? 'text-[0.8125rem] font-semibold leading-snug text-white/95 sm:text-sm md:text-[0.9rem]'
        : density === 'comfortable'
          ? 'text-[0.875rem] font-semibold leading-snug text-white/95 sm:text-[0.95rem]'
          : 'text-[0.95rem] font-semibold leading-snug text-white/95 max-[480px]:text-[1.02rem] sm:text-sm md:text-base lg:text-[1.05rem]';

  if (isMultiline) {
    return (
      <div
        className={
          density === 'compact' || density === 'comfortable' || density === 'micro'
            ? 'mt-0.5 space-y-0.5'
            : 'mt-1 space-y-1'
        }
      >
        {lines.map((line, i) => (
          <p key={i} className={lineClass}>
            {line}
          </p>
        ))}
      </div>
    );
  }

  const wrapComfortable =
    density === 'comfortable' ? 'whitespace-normal break-words text-balance' : '';

  return (
    <p
      ref={density === 'comfortable' ? undefined : ref}
      className={`${density === 'compact' || density === 'comfortable' || density === 'micro' ? 'mt-0.5' : 'mt-1'} ${lineClass} min-w-0 w-full max-w-full ${wrapComfortable}`}
    >
      {singleLine}
    </p>
  );
}

function preGameItemSlotRingClass(slot: PreGameItemSlot): string {
  if (slot.key.startsWith('dice-')) {
    if (slot.key === 'dice-odd') return 'border-amber-400/40 ring-amber-500/25';
    if (slot.key === 'dice-even') return 'border-sky-400/38 ring-sky-500/22';
    if (slot.key === 'dice-low') return 'border-emerald-400/35 ring-emerald-500/20';
    if (slot.key === 'dice-high') return 'border-rose-400/38 ring-rose-500/22';
  }
  return 'border-amber-400/28 ring-amber-400/12';
}

function PreGameItemSlotIcon({
  slot,
  comfortable,
  briefLayout,
  onZeroClick,
}: {
  slot: PreGameItemSlot;
  comfortable?: boolean;
  briefLayout?: boolean;
  onZeroClick?: () => void;
}) {
  const ring = preGameItemSlotRingClass(slot);
  const a11y = slot.title ? `${slot.title} ${tx('game:aiDescription.countUnit', { count: slot.count })}` : tx('game:preGame.quantity', { count: slot.count });
  const muted = slot.inventoryBadgeMode && slot.count <= 0;
  const badgeClass = muted
    ? 'border-2 border-gray-700 bg-gray-600 text-gray-300'
    : slot.inventoryBadgeMode
      ? 'border-2 border-purple-900 bg-yellow-400 text-gray-900'
      : 'border border-amber-500/45 bg-zinc-950/95 text-amber-100';
  const outerClass = briefLayout
    ? 'relative flex-shrink-0 flex flex-col items-center gap-0.5'
    : comfortable
      ? 'relative h-11 w-11 flex-shrink-0 sm:h-11 sm:w-11'
      : 'relative h-10 w-10 flex-shrink-0 sm:h-11 sm:w-11';
  const innerBoxClass = briefLayout
    ? `${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ${ring}`
    : `flex h-full w-full items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ${ring}`;
  const imgClassName = briefLayout
    ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain drop-shadow-md'
    : 'max-h-full max-w-full object-contain drop-shadow-md';
  const badgeSpanClass = briefLayout
    ? `pointer-events-none absolute -bottom-0.5 -right-0.5 flex min-h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-md px-0.5 py-px text-center text-[0.56rem] font-black leading-none tabular-nums shadow-[0_2px_8px_rgba(0,0,0,0.65)] min-[360px]:text-[0.58rem] sm:text-[0.62rem] ${badgeClass}`
    : `pointer-events-none absolute -bottom-0.5 -right-0.5 flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-md px-0.5 py-px text-center text-[0.62rem] font-black leading-none tabular-nums shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[0.68rem] ${badgeClass}`;
  const inner = (
    <>
      <div className={innerBoxClass}>
        <img src={slot.img} alt="" aria-hidden className={imgClassName} />
      </div>
      <span className={badgeSpanClass} aria-hidden>
        {slot.count}
      </span>
    </>
  );
  if (onZeroClick) {
    return (
      <button
        type="button"
        className={`${outerClass} cursor-pointer rounded-lg border-0 bg-transparent p-0 text-left outline-none ring-amber-400/40 transition hover:brightness-110 focus-visible:ring-2`}
        title={slot.title ? tx('game:preGame.quantityBuy', { title: slot.title }) : tx('game:preGame.itemShop')}
        aria-label={tx('game:preGame.itemShopAria', { a11y })}
        onClick={onZeroClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={outerClass} title={slot.title ?? undefined} aria-label={a11y} role="img">
      {inner}
    </div>
  );
}

/** 시작 전 모달용 요약: 승리·패배 분리 + 점수·시간 + 아이템(가로 전체) + 특수 규칙 */
export function PreGameSummaryGrid({
  session,
  summary,
  singleColumn = false,
  /** 모험 등: 짧은 카피 + 한 단 작은 글자 */
  briefLayout = false,
  /** 인게임 싱글/탑 시작 모달: 좁은 폭에서도 2열(2×2)로 세로 스크롤 최소화 */
  forceTwoColumnPrimary = false,
  /** 도전의 탑: 미사일·히든·스캔 배지가 0일 때 탭하면 상점 */
  onTowerItemZeroClick,
}: {
  session: LiveGameSession;
  summary: PreGameSummaryFour;
  /** 모바일 풀폭: 한 줄에 한 카드씩 세로 스택 */
  singleColumn?: boolean;
  briefLayout?: boolean;
  forceTwoColumnPrimary?: boolean;
  onTowerItemZeroClick?: (slotKey: string) => void;
}) {
  const panelShell =
    'group relative min-w-0 overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] shadow-[0_12px_36px_-16px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-400/12 transition-[box-shadow,ring-color] duration-200 hover:ring-amber-400/20';
  const casualAcademyLayout = session.isSinglePlayer && session.gameCategory !== 'tower' && !!summary.goalVisuals;

  type TopCell =
    | {
        key: string;
        title: string;
        kind: 'goal';
        goalKind: 'win' | 'lose';
        line: string;
        visual?: NonNullable<PreGameSummaryFour['goalVisuals']>['win'];
      }
    | { key: string; title: string; kind: 'img'; body: string; img: string; span2?: boolean }
    | { key: string; title: string; kind: 'itemStrip'; span2?: boolean };

  const primaryCells: TopCell[] = [
    {
      key: 'win',
      title: summary.goalVisuals?.win ? tx('game:preGame.goalTitle') : tx('game:preGame.winCondition'),
      kind: 'goal',
      goalKind: 'win',
      line: summary.winGoal,
      visual: summary.goalVisuals?.win,
    },
    {
      key: 'lose',
      title: tx('game:preGame.failConditionTitle'),
      kind: 'goal',
      goalKind: 'lose',
      line: summary.loseGoal,
      visual: summary.goalVisuals?.lose,
    },
  ];
  if (!casualAcademyLayout) {
    primaryCells.push(
      {
        key: 'score',
        title: tx('game:preGame.scoreFactors'),
        kind: 'img',
        body: summary.scoreFactors,
        img: preGameScoreBoxImage(session),
      },
      {
        key: 'time',
        title: tx('game:preGame.timeRules'),
        kind: 'img',
        body: summary.timeRules,
        img: '/images/icon/timer.webp',
      },
    );
  }
  const itemStripCell: TopCell = {
    key: 'items',
    title: tx('game:preGame.items'),
    kind: 'itemStrip',
    span2: true,
  };

  const gridGap = casualAcademyLayout ? 'gap-2' : singleColumn ? 'gap-2.5' : 'gap-2 sm:gap-2.5';
  /** 좁은 단일열 모드: 기본은 1열→480px 이상 2열. `forceTwoColumnPrimary`면 항상 2열(인게임 시작 모달) */
  const primaryGridClass = singleColumn
    ? forceTwoColumnPrimary
      ? `grid grid-cols-2 ${gridGap}`
      : `grid grid-cols-1 min-[480px]:grid-cols-2 ${gridGap}`
    : `grid grid-cols-2 ${gridGap}`;
  const titleRow = briefLayout
    ? singleColumn
      ? 'text-[0.62rem] font-bold uppercase tracking-[0.08em] text-amber-200/88 sm:text-[0.65rem]'
      : 'text-[0.58rem] font-bold uppercase tracking-[0.07em] text-amber-200/88 sm:text-[0.62rem]'
    : singleColumn
      ? 'text-[0.76rem] font-bold uppercase tracking-[0.09em] text-amber-200/88 sm:text-[0.78rem] sm:tracking-[0.1em]'
      : 'text-[0.68rem] font-bold uppercase tracking-[0.08em] text-amber-200/88 sm:text-[0.72rem] sm:tracking-[0.1em]';
  /** 단일열(모바일 시트 등)에서도 줄바꿈 없이 `PreGameSummaryCellBody`가 글자 크기만 줄여 맞춤 */
  const cellDensity: 'compact' | 'micro' = briefLayout ? 'micro' : 'compact';
  const imgBoxGoal = singleColumn
    ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-11 sm:w-11'
    : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-10 sm:w-10';
  const imgBoxPlain = singleColumn
    ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/28 bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-11 sm:w-11 sm:p-1'
    : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/28 bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-10 sm:w-10 sm:p-1';
  const winLoseBadge = briefLayout
    ? singleColumn
      ? 'select-none text-center text-[0.62rem] font-black italic leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-[0.68rem]'
      : 'select-none text-center text-[0.58rem] font-black italic leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-[0.65rem]'
    : singleColumn
      ? 'select-none text-center text-[0.72rem] font-black italic leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-xs'
      : 'select-none text-center text-[0.65rem] font-black italic leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-xs';

  const outerStackClass = singleColumn ? 'space-y-2.5 sm:space-y-2.5' : 'space-y-2 sm:space-y-2.5';
  const guideTitleClass = briefLayout
    ? singleColumn
      ? 'text-[0.62rem] font-bold uppercase tracking-[0.09em] text-amber-200/85 sm:text-[0.65rem]'
      : 'text-[0.58rem] font-bold uppercase tracking-[0.09em] text-amber-200/85 sm:text-[0.62rem]'
    : singleColumn
      ? 'text-[0.7rem] font-bold uppercase tracking-[0.1em] text-amber-200/85 sm:text-[0.72rem]'
      : 'text-[0.62rem] font-bold uppercase tracking-[0.1em] text-amber-200/85 sm:text-[0.7rem]';

  const renderPrimaryCell = (c: TopCell) => {
    if (c.kind === 'goal') {
      const isWin = c.goalKind === 'win';
      const visual = c.visual;
      return (
        <div
          key={c.key}
          className={`${panelShell} flex min-h-0 min-w-0 flex-col ${visual ? 'ring-amber-300/18' : ''} ${
            casualAcademyLayout ? 'p-2 sm:p-2.5' : singleColumn ? 'p-2.5 sm:p-2.5' : 'p-2 sm:p-2.5'
          }`}
        >
          <div
            className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-200 group-hover:opacity-90 ${
              isWin ? 'bg-amber-400/[0.07]' : 'bg-rose-500/[0.06]'
            }`}
            aria-hidden
          />
          <div className="flex min-w-0 w-full items-start gap-2 sm:gap-2.5">
            <div className={`${imgBoxGoal} ${visual ? 'p-0.5' : ''} ${isWin ? 'border-amber-400/35' : 'border-rose-400/35'}`}>
              {visual ? (
                <img
                  src={visual.img}
                  alt=""
                  className="max-h-full max-w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                />
              ) : (
                <span
                  className={`${winLoseBadge} ${isWin ? 'text-amber-200' : 'text-rose-200/95'}`}
                  aria-hidden
                >
                  {isWin ? 'WIN' : 'LOSE'}
                </span>
              )}
            </div>
            <div className="relative min-w-0 flex-1 self-stretch">
              <div className={titleRow}>{c.title}</div>
              <PreGameSummaryCellBody text={c.line} density={cellDensity} />
              {visual?.helper && (
                <p
                  className={
                    casualAcademyLayout
                      ? 'mt-0.5 text-[0.68rem] font-semibold leading-tight text-amber-100/78 sm:text-[0.74rem]'
                      : briefLayout
                      ? 'mt-1 line-clamp-2 text-[0.62rem] font-semibold leading-snug text-amber-100/78 sm:text-[0.68rem]'
                      : 'mt-1 text-[0.74rem] font-semibold leading-snug text-amber-100/82 sm:text-xs'
                  }
                >
                  <span className={isWin ? 'text-amber-200/95' : 'text-rose-200/95'}>{visual.label}</span>
                  {' · '}
                  {visual.helper}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (c.kind !== 'img') return null;

    return (
      <div
        key={c.key}
        className={`${panelShell} flex min-h-0 min-w-0 items-start gap-2 sm:gap-2.5 ${singleColumn ? 'p-2.5 sm:p-2.5' : 'p-2 sm:p-2.5'}`}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-400/[0.05] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
          aria-hidden
        />
        <div className={imgBoxPlain}>
          <img src={c.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" />
        </div>
        <div className="relative min-w-0 flex-1 self-stretch">
          <div className={titleRow}>{c.title}</div>
          <PreGameSummaryCellBody text={c.body} density={cellDensity} />
        </div>
      </div>
    );
  };

  const itemStripPanel = (
    <div className={`${panelShell} flex min-w-0 flex-col gap-2 ${singleColumn ? 'p-2.5 sm:p-2.5' : 'p-2 sm:p-2.5'}`}>
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-400/[0.05] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
        aria-hidden
      />
      <div className={titleRow}>{itemStripCell.title}</div>
      {summary.itemSlots.length === 0 ? (
        <div
          className={
            briefLayout
              ? `flex ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-black/35 p-0.5 opacity-45`
              : singleColumn
                ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-black/35 p-1 opacity-45 sm:h-11 sm:w-11'
                : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-black/35 p-1 opacity-45 sm:h-10 sm:w-10'
          }
          aria-label={tx('game:preGame.noItems')}
          role="img"
        >
          <img
            src="/images/simbols/simbol1.webp"
            alt=""
            className={
              briefLayout
                ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain opacity-70 grayscale'
                : 'max-h-full max-w-full object-contain opacity-70 grayscale'
            }
          />
        </div>
      ) : (
        <div
          className={
            briefLayout
              ? 'flex min-w-0 flex-wrap content-start gap-1.5 sm:gap-2'
              : 'flex min-w-0 flex-wrap content-start gap-2 sm:gap-2.5'
          }
        >
          {summary.itemSlots.map((slot) => (
            <PreGameItemSlotIcon
              key={slot.key}
              slot={slot}
              comfortable={singleColumn}
              briefLayout={briefLayout}
              onZeroClick={
                session.gameCategory === 'tower' &&
                slot.towerShopOnZero &&
                slot.count <= 0 &&
                onTowerItemZeroClick
                  ? () => onTowerItemZeroClick(slot.key)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );

  const ruleGuidePanel = summary.ruleGuides && summary.ruleGuides.length > 0 ? (
    <div className={`${panelShell} ${singleColumn ? 'p-2.5 sm:p-3' : 'p-2.5 sm:p-3'}`}>
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/[0.06] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
        aria-hidden
      />
      <div className={guideTitleClass}>{casualAcademyLayout ? tx('game:preGame.howToPlay') : tx('game:preGame.stageKeyPoints')}</div>
      <div className={`mt-2 grid min-w-0 ${casualAcademyLayout ? 'grid-cols-2 gap-1.5 sm:gap-2' : singleColumn ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-2'}`}>
        {summary.ruleGuides.map((guide) => (
          <div
            key={guide.key}
            className={`flex min-w-0 items-start gap-2 rounded-lg border border-amber-500/22 bg-black/32 ring-1 ring-inset ring-white/[0.04] ${
              casualAcademyLayout ? 'px-1.5 py-1.5 sm:px-2' : 'px-2 py-2'
            }`}
          >
            <div
              className={
                casualAcademyLayout
                  ? 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-8 sm:w-8'
                  : briefLayout
                  ? 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner'
                  : 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner'
              }
            >
              <img src={guide.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={
                  casualAcademyLayout
                    ? 'text-[0.66rem] font-black leading-tight text-amber-100 sm:text-[0.72rem]'
                    : briefLayout
                    ? 'text-[0.68rem] font-black leading-tight text-amber-100 sm:text-[0.72rem]'
                    : 'text-xs font-black leading-tight text-amber-100 sm:text-sm'
                }
              >
                {guide.title}
              </p>
              <p
                className={
                  casualAcademyLayout
                    ? 'mt-0.5 text-[0.62rem] font-semibold leading-tight text-white/82 sm:text-[0.68rem]'
                    : briefLayout
                    ? 'mt-0.5 text-[0.62rem] font-semibold leading-snug text-white/82 sm:text-[0.68rem]'
                    : 'mt-0.5 text-[0.74rem] font-semibold leading-snug text-white/84 sm:text-xs'
                }
              >
                {guide.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const specialRulesPanel = (
    <div className={`${panelShell} ${singleColumn ? 'p-2.5 sm:p-3' : 'p-2.5 sm:p-3'}`}>
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/[0.06] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
        aria-hidden
      />
      <div
        className={
          briefLayout
            ? singleColumn
              ? 'text-[0.62rem] font-bold uppercase tracking-[0.09em] text-amber-200/85 sm:text-[0.65rem]'
              : 'text-[0.58rem] font-bold uppercase tracking-[0.09em] text-amber-200/85 sm:text-[0.62rem]'
            : singleColumn
              ? 'text-[0.7rem] font-bold uppercase tracking-[0.1em] text-amber-200/85 sm:text-[0.72rem]'
              : 'text-[0.62rem] font-bold uppercase tracking-[0.1em] text-amber-200/85 sm:text-[0.7rem]'
        }
      >
        {tx('game:preGame.specialRules')}
      </div>
      {summary.specialHighlights.length === 0 ? (
        <p
          className={
            briefLayout
              ? singleColumn
                ? 'mt-1 text-[0.68rem] font-semibold text-slate-400 sm:text-[0.72rem]'
                : 'mt-1 text-[0.65rem] font-semibold text-slate-400 sm:text-[0.7rem]'
              : singleColumn
                ? 'mt-1.5 text-[0.8125rem] font-semibold text-slate-400 sm:text-sm'
                : 'mt-1.5 text-xs font-semibold text-slate-400 sm:text-sm'
          }
        >
          {summaryNone()}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2 sm:gap-2">
          {summary.specialHighlights.map((row, idx) => (
            <div
              key={`${row.text}-${idx}`}
              className={`flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-amber-500/22 bg-black/32 ring-1 ring-inset ring-white/[0.04] sm:gap-2 ${
                briefLayout ? 'px-1.5 py-1 sm:px-2 sm:py-1.5' : 'px-2 py-1.5 sm:px-2.5 sm:py-2'
              }`}
            >
              <div
                className={
                  briefLayout
                    ? singleColumn
                      ? 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-9 sm:w-9'
                      : 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-8 sm:w-8'
                    : singleColumn
                      ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-11 sm:w-11'
                      : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-10 sm:w-10'
                }
              >
                <img src={row.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
              </div>
              <div className="min-w-0 flex-1 self-center overflow-hidden">
                <PreGameSummaryCellBody text={row.text} density={briefLayout ? 'micro' : 'compact'} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (casualAcademyLayout) {
    type CasualTile = { key: string; img: string; text: string };
    const cautionGuideKeys = new Set(['turn-limit', 'auto-scoring', 'speed']);
    const guides = summary.ruleGuides ?? [];
    const goalTiles: CasualTile[] = [];
    const cautionTiles: CasualTile[] = [];
    const addTile = (list: CasualTile[], tile: CasualTile) => {
      const text = tile.text.trim();
      if (!text) return;
      if (!list.some((row) => row.key === tile.key || row.text === text)) {
        list.push({ ...tile, text });
      }
    };
    const casualGuideText = (guide: NonNullable<PreGameSummaryFour['ruleGuides']>[number]): string => {
      switch (guide.key) {
        case 'pattern-stone':
          return tx('game:preGame.patternStone2pts');
        case 'turn-limit':
          return guide.body.replace(tx('game:preGame.finishWord'), tx('game:preGame.goalAchievement'));
        case 'auto-scoring':
          return guide.body;
        case 'missile':
          return tx('game:preGame.missilePush');
        case 'hidden-scan':
          return guide.body;
        case 'turn-add':
          return tx('game:preGame.turnAddUse');
        case 'survival':
        case 'speed':
          return guide.body;
        default:
          return guide.body || guide.title;
      }
    };

    if (summary.goalVisuals?.win) {
      addTile(goalTiles, {
        key: 'win',
        img: summary.goalVisuals.win.img,
        text: summary.winGoal,
      });
    }
    for (const guide of guides) {
      const target = cautionGuideKeys.has(guide.key) ? cautionTiles : goalTiles;
      addTile(target, { key: guide.key, img: guide.img, text: casualGuideText(guide) });
    }
    if (summary.goalVisuals?.lose && cautionTiles.length === 0) {
      addTile(cautionTiles, {
        key: 'lose',
        img: summary.goalVisuals.lose.img,
        text: summary.loseGoal,
      });
    }
    if (cautionTiles.length === 0) {
      addTile(cautionTiles, {
        key: 'default-caution',
        img: '/images/simbols/simbol7.webp',
        text: tx('game:preGame.lowTerritoryFail'),
      });
    }

    const sectionTitleClass = 'text-[0.72rem] font-black uppercase tracking-[0.1em] text-amber-200/90 sm:text-[0.78rem]';
    const renderTile = (tile: CasualTile, tone: 'goal' | 'caution') => (
      <div
        key={tile.key}
        className={`flex min-w-0 items-center gap-2 rounded-lg border bg-black/32 px-2 py-1.5 ring-1 ring-inset ring-white/[0.04] ${
          tone === 'goal' ? 'border-amber-500/24' : 'border-rose-400/24'
        }`}
      >
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner ${
            tone === 'goal' ? 'border-amber-400/25' : 'border-rose-300/25'
          }`}
        >
          <img src={tile.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[0.78rem] font-black leading-tight sm:text-[0.85rem] ${tone === 'goal' ? 'text-amber-100' : 'text-rose-100'}`}>
            {tile.text}
          </p>
        </div>
      </div>
    );

    const renderSection = (title: string, tiles: CasualTile[], tone: 'goal' | 'caution') => (
      <section className={`${panelShell} p-2.5 sm:p-3`}>
        <div
          className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-200 group-hover:opacity-90 ${
            tone === 'goal' ? 'bg-amber-400/[0.07]' : 'bg-rose-500/[0.06]'
          }`}
          aria-hidden
        />
        <div className={sectionTitleClass}>{title}</div>
        <div className="mt-2 grid grid-cols-1 gap-1.5 min-[430px]:grid-cols-2 sm:gap-2">
          {tiles.map((tile) => renderTile(tile, tone))}
        </div>
      </section>
    );

    return (
      <div className={outerStackClass}>
        {renderSection(tx('game:preGame.goalTitle'), goalTiles, 'goal')}
        {renderSection(tx('game:preGame.cautionPoints'), cautionTiles, 'caution')}
      </div>
    );
  }

  return (
    <div className={outerStackClass}>
      <div className={primaryGridClass}>{primaryCells.map(renderPrimaryCell)}</div>
      {ruleGuidePanel}
      {itemStripPanel}
      {specialRulesPanel}
    </div>
  );
}

/** 시작 전 설명 모달 공통: 승리·패배 문구 분리 표시 + 선택 보조 목록 */
export function PreGameWinGoalCard({
  winLine,
  loseLine,
  secondaryLines = [],
  size = 'hero',
}: {
  winLine: string;
  loseLine: string;
  secondaryLines?: string[];
  /** hero: AI 대국용 큰 본문 / compact: 긴 문장용 */
  size?: 'hero' | 'compact';
}) {
  const bodyClass =
    size === 'compact'
      ? 'mt-1.5 text-sm font-bold leading-snug text-white sm:text-base'
      : 'mt-1.5 text-lg font-black leading-snug text-white sm:text-xl';
  const loseClass =
    size === 'compact'
      ? 'mt-2 text-sm font-bold leading-snug text-rose-100/90 sm:text-base'
      : 'mt-2 text-lg font-black leading-snug text-rose-100/88 sm:text-xl';
  return (
    <div className="flex-shrink-0 rounded-xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-950/95 p-3 shadow-[0_0_40px_-12px_rgba(251,191,36,0.35)] sm:p-3.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="min-w-0 rounded-lg border border-amber-400/30 bg-black/25 p-2 ring-1 ring-inset ring-amber-400/10">
          <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-amber-200/90 sm:text-xs">
            <span className="flex h-6 min-w-[1.75rem] items-center justify-center rounded border border-amber-400/40 bg-black/40 px-1 text-[0.6rem] font-black italic text-amber-100 shadow-inner">
              WIN
            </span>
            {tx('game:preGame.winCondition')}
          </div>
          <p className={bodyClass}>{winLine}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-rose-400/28 bg-black/25 p-2 ring-1 ring-inset ring-rose-400/10">
          <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-rose-200/88 sm:text-xs">
            <span className="flex h-6 min-w-[1.75rem] items-center justify-center rounded border border-rose-400/40 bg-black/40 px-1 text-[0.6rem] font-black italic text-rose-100 shadow-inner">
              LOSE
            </span>
            {tx('game:preGame.loseCondition')}
          </div>
          <p className={loseClass}>{loseLine}</p>
        </div>
      </div>
      {secondaryLines.length > 0 && (
        <ul className="mt-2.5 space-y-1 border-t border-amber-500/20 pt-2.5 text-xs leading-relaxed text-amber-100/85 sm:text-sm">
          {secondaryLines.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/90" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PreGameFeatureStrip({ session }: { session: LiveGameSession }) {
  const s = session.settings;
  const mixed = s.mixedModes ?? [];
  const items: { src: string; label: string }[] = [];

  const add = (src: string, label: string) => {
    if (!items.some((x) => x.label === label)) items.push({ src, label });
  };

  const mode = session.mode;
  if (mode === GameMode.Capture || mixed.includes(GameMode.Capture)) {
    add('/images/simbols/simbol2.webp', tx('game:preGame.capture'));
  }
  if (mode === GameMode.Speed || mixed.includes(GameMode.Speed)) {
    add('/images/icon/timer.webp', tx('game:preGame.speed'));
  }
  if (mode === GameMode.Base || mixed.includes(GameMode.Base)) {
    add('/images/simbols/simbol4.webp', tx('game:preGame.base'));
  }
  if (mode === GameMode.Hidden || mixed.includes(GameMode.Hidden)) {
    add('/images/button/hidden.webp', tx('game:preGame.hidden'));
    add('/images/button/scan.webp', tx('game:preGame.scan'));
  }
  if (mode === GameMode.Missile || mixed.includes(GameMode.Missile)) {
    add('/images/button/missile.webp', tx('game:preGame.missile'));
  }
  if (mode === GameMode.Dice) {
    add('/images/simbols/simbolp1.webp', tx('game:preGame.dice'));
  }
  if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
    add('/images/simbols/simbolp2.webp', tx('game:preGame.omok'));
  }
  if (mode === GameMode.Alkkagi) {
    add('/images/simbols/simbolp5.webp', tx('game:preGame.alkkagi'));
  }
  if (mode === GameMode.Curling) {
    add('/images/simbols/simbolp6.webp', tx('game:preGame.curling'));
  }
  if (mode === GameMode.Thief) {
    add('/images/simbols/simbolp4.webp', tx('game:preGame.thiefPolice'));
  }

  if (items.length === 0) {
    const fallback: Partial<Record<GameMode, { src: string; label: string }>> = {
      [GameMode.Standard]: { src: '/images/simbols/simbol1.webp', label: tx('game:preGame.classic') },
      [GameMode.Mix]: { src: '/images/simbols/simbol10.webp', label: tx('game:preGame.mix') },
    };
    const f = fallback[mode];
    if (f) items.push(f);
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-shrink-0 flex-wrap gap-2 px-1 pb-2">
      {items.map((i) => (
        <div
          key={i.label}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-tertiary/25 px-2.5 py-1.5"
        >
          <img src={i.src} alt="" className="h-8 w-8 object-contain" />
          <span className="text-sm font-semibold text-primary">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PreGameRuleSections({ sections }: { sections: MatchPlayGuideSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="space-y-5">
      <h3 className="flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-bold text-sky-200/95">
        <img src="/images/icon/timer.webp" alt="" className="h-5 w-5 object-contain opacity-80" />
        {tx('game:preGame.rulesAndGuide')}
      </h3>
      {sections.map((section) => (
        <section key={section.subtitle}>
          <h4 className="mb-2 text-base font-bold text-amber-200/90">{section.subtitle}</h4>
          <ul className="space-y-2 text-sm leading-relaxed text-gray-200 sm:text-base">
            {section.items.map((line, idx) => (
              <li key={idx} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400/80" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
