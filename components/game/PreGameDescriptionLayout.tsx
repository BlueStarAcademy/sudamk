import React from 'react';
import { LiveGameSession, GameMode } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { MatchPlayGuideSection } from '../../utils/matchPlayGuide.js';
import type { PreGameSummaryFour } from '../../utils/preGameSummaryFour.js';

const SUMMARY_NONE = '없음';

/** 설정의 패널 엣지(::before 코너) + 금테가 적용되도록 루트에 붙입니다. */
export const PRE_GAME_MODAL_SHELL_CLASS =
  'sudamr-panel-edge-host relative flex flex-col overflow-hidden rounded-2xl border-2 border-amber-400/45 text-on-panel bg-gradient-to-br from-[#2a2640] via-[#181528] to-[#0a0812] shadow-[0_32px_100px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.11),0_0_72px_-28px_rgba(139,92,246,0.14),0_0_48px_-32px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/28';

export const PRE_GAME_MODAL_LAYER_CLASS = 'relative z-[2]';

export const PRE_GAME_MODAL_FOOTER_CLASS =
  'relative z-20 flex flex-shrink-0 flex-wrap items-center justify-center gap-3 border-t border-amber-500/35 bg-gradient-to-t from-[#0c0a10] via-[#14111c] to-[#1c1828] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]';

/** 보라 CTA — AI 대국 시작 등 */
export const PRE_GAME_MODAL_PRIMARY_BTN_CLASS =
  'min-h-[3.25rem] !rounded-xl !border-2 !border-amber-400/55 !bg-gradient-to-r !from-violet-600 !via-purple-600 !to-indigo-700 !text-white !shadow-[0_14px_40px_-12px_rgba(139,92,246,0.6)] hover:!from-violet-500 hover:!via-purple-500 hover:!to-indigo-600 focus:!ring-amber-400/45 focus:!ring-offset-2 focus:!ring-offset-zinc-950';

/** 보조 — 나가기·취소 */
export const PRE_GAME_MODAL_SECONDARY_BTN_CLASS =
  'min-h-[3.25rem] !rounded-xl !border-2 !border-zinc-500/50 !bg-gradient-to-b !from-zinc-600 !to-zinc-900 !text-white !shadow-[0_10px_28px_-14px_rgba(0,0,0,0.75)] hover:!from-zinc-500 hover:!to-zinc-800 focus:!ring-zinc-400/35 focus:!ring-offset-2 focus:!ring-offset-zinc-950';

/** 앰버 CTA — 싱글 시작하기 · 수정 제안 */
export const PRE_GAME_MODAL_ACCENT_BTN_CLASS =
  'min-h-[3.25rem] !rounded-xl !border-2 !border-amber-300/60 !bg-gradient-to-r !from-amber-500 !via-amber-400 !to-yellow-500 !text-zinc-950 !shadow-[0_14px_40px_-12px_rgba(245,158,11,0.42)] hover:!from-amber-400 hover:!via-amber-300 hover:!to-yellow-400 focus:!ring-amber-400/50 focus:!ring-offset-2 focus:!ring-offset-zinc-950';

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

function preGameItemsBoxImage(summary: PreGameSummaryFour): string {
  if (summary.items === SUMMARY_NONE) return '/images/simbols/simbol1.png';
  if (summary.items.includes('미사일')) return '/images/button/missile.png';
  if (summary.items.includes('히든')) return '/images/button/hidden.png';
  if (summary.items.includes('스캔')) return '/images/button/scan.png';
  if (summary.items.includes('주사위')) return '/images/simbols/simbolp1.png';
  if (summary.items.includes('슬로우') || summary.items.includes('조준')) return '/images/simbols/simbolp5.png';
  return '/images/icon/Gold.png';
}

/** 시작 전 모달용 요약: 2×2(승리·점수·시간·아이템) + 특수 규칙 전체 행 */
export function PreGameSummaryGrid({ session, summary }: { session: LiveGameSession; summary: PreGameSummaryFour }) {
  const topCells: {
    key: string;
    title: string;
    body: string;
    visual: 'win' | 'img';
    img?: string;
  }[] = [
    { key: 'win', title: '승리 목표', body: summary.winGoal, visual: 'win' },
    {
      key: 'score',
      title: '점수 요인',
      body: summary.scoreFactors,
      visual: 'img',
      img: preGameScoreBoxImage(session),
    },
    {
      key: 'time',
      title: '시간 규칙',
      body: summary.timeRules,
      visual: 'img',
      img: '/images/icon/timer.png',
    },
    {
      key: 'items',
      title: '아이템',
      body: summary.items,
      visual: 'img',
      img: preGameItemsBoxImage(summary),
    },
  ];

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {topCells.map((c) => (
          <div
            key={c.key}
            className="group relative flex gap-3.5 overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] p-3.5 shadow-[0_14px_44px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/12 transition-[box-shadow,ring-color] duration-200 hover:ring-amber-400/22"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/[0.06] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
              aria-hidden
            />
            <div className="flex h-[3.75rem] w-[3.75rem] flex-shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              {c.visual === 'win' ? (
                <span
                  className="select-none text-center text-lg font-black italic leading-none tracking-tight text-amber-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-xl"
                  aria-hidden
                >
                  WIN
                </span>
              ) : (
                <img src={c.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
              )}
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-200/85 sm:text-xs">{c.title}</div>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-white/95 sm:text-[0.95rem]">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="group relative overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] p-3.5 shadow-[0_14px_44px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/12 sm:col-span-2">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-500/[0.07] blur-2xl transition-opacity duration-200 group-hover:opacity-90"
          aria-hidden
        />
        <div className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-200/85 sm:text-xs">특수 규칙</div>
        {summary.specialHighlights.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-slate-400 sm:text-[0.95rem]">{SUMMARY_NONE}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2.5 sm:gap-3">
            {summary.specialHighlights.map((row, idx) => (
              <div
                key={`${row.text}-${idx}`}
                className="flex min-w-0 max-w-full items-center gap-2.5 rounded-lg border border-amber-500/25 bg-black/35 px-2.5 py-2 ring-1 ring-inset ring-white/[0.05] sm:gap-3 sm:px-3 sm:py-2.5"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/25 bg-gradient-to-br from-zinc-950/90 to-black/80 p-1 shadow-inner sm:h-12 sm:w-12">
                  <img src={row.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
                </div>
                <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white/95 sm:text-[0.95rem]">{row.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 시작 전 설명 모달 공통: 승리 목표 강조 + 규칙 섹션 + 선택적 특징 아이콘 줄 */
export function PreGameWinGoalCard({
  primaryText,
  secondaryLines = [],
  size = 'hero',
}: {
  primaryText: string;
  secondaryLines?: string[];
  /** hero: AI 대국용 큰 제목 / compact: 긴 문장(싱글 스테이지)용 */
  size?: 'hero' | 'compact';
}) {
  const primaryClass =
    size === 'compact'
      ? 'mt-2 text-base font-black leading-relaxed text-white sm:text-lg'
      : 'mt-2 text-xl font-black leading-snug text-white sm:text-2xl';
  return (
    <div className="flex-shrink-0 rounded-xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-950/95 p-4 shadow-[0_0_40px_-12px_rgba(251,191,36,0.35)]">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-200/90">
        <span className="flex h-7 min-w-[2.25rem] items-center justify-center rounded-md border border-amber-400/40 bg-black/40 px-1.5 text-[0.7rem] font-black italic leading-none text-amber-100 shadow-inner">
          WIN
        </span>
        승리 목표
      </div>
      <p className={primaryClass}>{primaryText}</p>
      {secondaryLines.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-amber-500/20 pt-3 text-sm leading-relaxed text-amber-100/85">
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
