import React, { useLayoutEffect, useRef } from 'react';
import { LiveGameSession, GameMode } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { MatchPlayGuideSection } from '../../utils/matchPlayGuide.js';
import type { PreGameItemSlot, PreGameSummaryFour } from '../../utils/preGameSummaryFour.js';

const SUMMARY_NONE = '없음';

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
  return '/images/simbols/simbol1.png';
}

/**
 * 점수 요인·시간 규칙 등: `\n`이 있으면 의도적 여러 줄, 없으면 한 줄 유지(넘치면 글자만 축소).
 */
export function PreGameSummaryCellBody({
  text,
  density = 'default',
}: {
  text: string;
  /** compact: 시작 전 요약 그리드 등 여백 최소화 / comfortable: 모바일 단일열용 조금 더 큼 */
  density?: 'default' | 'compact' | 'comfortable';
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
      const minPx = density === 'compact' ? 8.5 : 9;
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
    density === 'compact'
      ? 'text-[0.8125rem] font-semibold leading-snug text-white/95 sm:text-sm md:text-[0.9rem]'
      : density === 'comfortable'
        ? 'text-[0.875rem] font-semibold leading-snug text-white/95 sm:text-[0.95rem]'
        : 'text-[0.95rem] font-semibold leading-snug text-white/95 max-[480px]:text-[1.02rem] sm:text-sm md:text-base lg:text-[1.05rem]';

  if (isMultiline) {
    return (
      <div
        className={
          density === 'compact' || density === 'comfortable' ? 'mt-0.5 space-y-0.5' : 'mt-1 space-y-1'
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
      className={`${density === 'compact' || density === 'comfortable' ? 'mt-0.5' : 'mt-1'} ${lineClass} min-w-0 w-full max-w-full ${wrapComfortable}`}
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

function PreGameItemSlotIcon({ slot, comfortable }: { slot: PreGameItemSlot; comfortable?: boolean }) {
  const ring = preGameItemSlotRingClass(slot);
  const a11y = slot.title ? `${slot.title} ${slot.count}개` : `수량 ${slot.count}`;
  return (
    <div
      className={
        comfortable
          ? 'relative h-11 w-11 flex-shrink-0 sm:h-11 sm:w-11'
          : 'relative h-10 w-10 flex-shrink-0 sm:h-11 sm:w-11'
      }
      title={slot.title ?? undefined}
      aria-label={a11y}
      role="img"
    >
      <div
        className={`flex h-full w-full items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ${ring}`}
      >
        <img src={slot.img} alt="" aria-hidden className="max-h-full max-w-full object-contain drop-shadow-md" />
      </div>
      <span
        className="pointer-events-none absolute -bottom-0.5 -right-0.5 min-w-[1.15rem] rounded-md border border-amber-500/45 bg-zinc-950/95 px-0.5 py-px text-center text-[0.62rem] font-black leading-none tabular-nums text-amber-100 shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[0.68rem]"
        aria-hidden
      >
        {slot.count}
      </span>
    </div>
  );
}

/** 시작 전 모달용 요약: 승리·패배 분리 + 점수·시간 + 아이템(가로 전체) + 특수 규칙 */
export function PreGameSummaryGrid({
  session,
  summary,
  singleColumn = false,
}: {
  session: LiveGameSession;
  summary: PreGameSummaryFour;
  /** 모바일 풀폭: 한 줄에 한 카드씩 세로 스택 */
  singleColumn?: boolean;
}) {
  const panelShell =
    'group relative min-w-0 overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] shadow-[0_12px_36px_-16px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-400/12 transition-[box-shadow,ring-color] duration-200 hover:ring-amber-400/20';

  type TopCell =
    | { key: string; title: string; kind: 'goal'; goalKind: 'win' | 'lose'; line: string }
    | { key: string; title: string; kind: 'img'; body: string; img: string; span2?: boolean }
    | { key: string; title: string; kind: 'itemStrip'; span2?: boolean };

  const primaryCells: TopCell[] = [
    { key: 'win', title: '승리 조건', kind: 'goal', goalKind: 'win', line: summary.winGoal },
    { key: 'lose', title: '패배 조건', kind: 'goal', goalKind: 'lose', line: summary.loseGoal },
    {
      key: 'score',
      title: '점수 요인',
      kind: 'img',
      body: summary.scoreFactors,
      img: preGameScoreBoxImage(session),
    },
    {
      key: 'time',
      title: '시간 규칙',
      kind: 'img',
      body: summary.timeRules,
      img: '/images/icon/timer.png',
    },
  ];
  const itemStripCell: TopCell = {
    key: 'items',
    title: '아이템',
    kind: 'itemStrip',
    span2: true,
  };

  const gridGap = singleColumn ? 'gap-2.5' : 'gap-2 sm:gap-2.5';
  /** 좁은 단일열 모드: 매우 좁은 폰은 1열, ~480px 이상부터 2열(승리|패배, 점수|시간)로 가로 활용 */
  const primaryGridClass = singleColumn
    ? `grid grid-cols-1 min-[480px]:grid-cols-2 ${gridGap}`
    : `grid grid-cols-2 ${gridGap}`;
  const titleRow = singleColumn
    ? 'text-[0.76rem] font-bold uppercase tracking-[0.09em] text-amber-200/88 sm:text-[0.78rem] sm:tracking-[0.1em]'
    : 'text-[0.68rem] font-bold uppercase tracking-[0.08em] text-amber-200/88 sm:text-[0.72rem] sm:tracking-[0.1em]';
  const cellDensity = singleColumn ? 'comfortable' : 'compact';
  const imgBoxGoal = singleColumn
    ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-11 sm:w-11'
    : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-10 sm:w-10';
  const imgBoxPlain = singleColumn
    ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/28 bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-11 sm:w-11 sm:p-1'
    : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/28 bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:h-10 sm:w-10 sm:p-1';
  const winLoseBadge = singleColumn
    ? 'select-none text-center text-[0.72rem] font-black italic leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-xs'
    : 'select-none text-center text-[0.65rem] font-black italic leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-xs';

  return (
    <div className={singleColumn ? 'space-y-2.5 sm:space-y-2.5' : 'space-y-2 sm:space-y-2.5'}>
      <div className={primaryGridClass}>
        {primaryCells.map((c) => {
          if (c.kind === 'goal') {
            const isWin = c.goalKind === 'win';
            return (
              <div
                key={c.key}
                className={`${panelShell} flex min-h-0 min-w-0 flex-col ${singleColumn ? 'p-2.5 sm:p-2.5' : 'p-2 sm:p-2.5'}`}
              >
                <div
                  className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-200 group-hover:opacity-90 ${
                    isWin ? 'bg-amber-400/[0.07]' : 'bg-rose-500/[0.06]'
                  }`}
                  aria-hidden
                />
                <div className="flex min-w-0 w-full items-start gap-2 sm:gap-2.5">
                  <div
                    className={`${imgBoxGoal} ${isWin ? 'border-amber-400/35' : 'border-rose-400/35'}`}
                  >
                    <span
                      className={`${winLoseBadge} ${isWin ? 'text-amber-200' : 'text-rose-200/95'}`}
                      aria-hidden
                    >
                      {isWin ? 'WIN' : 'LOSE'}
                    </span>
                  </div>
                  <div className="relative min-w-0 flex-1 self-stretch">
                    <div className={titleRow}>{c.title}</div>
                    <PreGameSummaryCellBody text={c.line} density={cellDensity} />
                  </div>
                </div>
              </div>
            );
          }

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
        })}
      </div>

      <div className={`${panelShell} flex min-w-0 flex-col gap-2 ${singleColumn ? 'p-2.5 sm:p-2.5' : 'p-2 sm:p-2.5'}`}>
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-400/[0.05] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
          aria-hidden
        />
        <div className={titleRow}>{itemStripCell.title}</div>
        {summary.itemSlots.length === 0 ? (
          <div
            className={
              singleColumn
                ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-black/35 p-1 opacity-45 sm:h-11 sm:w-11'
                : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-black/35 p-1 opacity-45 sm:h-10 sm:w-10'
            }
            aria-label="아이템 없음"
            role="img"
          >
            <img
              src="/images/simbols/simbol1.png"
              alt=""
              className="max-h-full max-w-full object-contain opacity-70 grayscale"
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-wrap content-start gap-2 sm:gap-2.5">
            {summary.itemSlots.map((slot) => (
              <PreGameItemSlotIcon key={slot.key} slot={slot} comfortable={singleColumn} />
            ))}
          </div>
        )}
      </div>

      <div className={`${panelShell} ${singleColumn ? 'p-2.5 sm:p-3' : 'p-2.5 sm:p-3'}`}>
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/[0.06] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
          aria-hidden
        />
        <div
          className={
            singleColumn
              ? 'text-[0.7rem] font-bold uppercase tracking-[0.1em] text-amber-200/85 sm:text-[0.72rem]'
              : 'text-[0.62rem] font-bold uppercase tracking-[0.1em] text-amber-200/85 sm:text-[0.7rem]'
          }
        >
          특수 규칙
        </div>
        {summary.specialHighlights.length === 0 ? (
          <p
            className={
              singleColumn
                ? 'mt-1.5 text-[0.8125rem] font-semibold text-slate-400 sm:text-sm'
                : 'mt-1.5 text-xs font-semibold text-slate-400 sm:text-sm'
            }
          >
            {SUMMARY_NONE}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2 sm:gap-2">
            {summary.specialHighlights.map((row, idx) => (
              <div
                key={`${row.text}-${idx}`}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-amber-500/22 bg-black/32 px-2 py-1.5 ring-1 ring-inset ring-white/[0.04] sm:gap-2 sm:px-2.5 sm:py-2"
              >
                <div
                  className={
                    singleColumn
                      ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-11 sm:w-11'
                      : 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner sm:h-10 sm:w-10'
                  }
                >
                  <img src={row.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
                </div>
                <p
                  className={
                    singleColumn
                      ? 'min-w-0 flex-1 text-[0.8125rem] font-semibold leading-snug text-white/95 sm:text-sm'
                      : 'min-w-0 flex-1 text-xs font-semibold leading-snug text-white/95 sm:text-sm'
                  }
                >
                  {row.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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
            승리 조건
          </div>
          <p className={bodyClass}>{winLine}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-rose-400/28 bg-black/25 p-2 ring-1 ring-inset ring-rose-400/10">
          <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-rose-200/88 sm:text-xs">
            <span className="flex h-6 min-w-[1.75rem] items-center justify-center rounded border border-rose-400/40 bg-black/40 px-1 text-[0.6rem] font-black italic text-rose-100 shadow-inner">
              LOSE
            </span>
            패배 조건
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
    add('/images/simbols/simbol2.png', '따내기');
  }
  if (mode === GameMode.Speed || mixed.includes(GameMode.Speed)) {
    add('/images/icon/timer.png', '스피드');
  }
  if (mode === GameMode.Base || mixed.includes(GameMode.Base)) {
    add('/images/simbols/simbol4.png', '베이스');
  }
  if (mode === GameMode.Hidden || mixed.includes(GameMode.Hidden)) {
    add('/images/button/hidden.png', '히든');
    add('/images/button/scan.png', '스캔');
  }
  if (mode === GameMode.Missile || mixed.includes(GameMode.Missile)) {
    add('/images/button/missile.png', '미사일');
  }
  if (mode === GameMode.Dice) {
    add('/images/simbols/simbolp1.png', '주사위');
  }
  if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
    add('/images/simbols/simbolp2.png', '오목');
  }
  if (mode === GameMode.Alkkagi) {
    add('/images/simbols/simbolp5.png', '알까기');
  }
  if (mode === GameMode.Curling) {
    add('/images/simbols/simbolp6.png', '컬링');
  }
  if (mode === GameMode.Thief) {
    add('/images/simbols/simbolp4.png', '도둑과경찰');
  }

  if (items.length === 0) {
    const fallback: Partial<Record<GameMode, { src: string; label: string }>> = {
      [GameMode.Standard]: { src: '/images/simbols/simbol1.png', label: '클래식' },
      [GameMode.Mix]: { src: '/images/simbols/simbol7.png', label: '믹스' },
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
        <img src="/images/icon/timer.png" alt="" className="h-5 w-5 object-contain opacity-80" />
        게임 규칙 · 플레이 안내
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
