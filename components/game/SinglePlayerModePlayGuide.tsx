import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useAppTranslation.js';
import type { AcademyModeGuideTab } from '../../utils/singlePlayerAcademyModeGuide.js';

interface SinglePlayerModePlayGuideProps {
  tabs: AcademyModeGuideTab[];
  compact?: boolean;
}

const SinglePlayerModePlayGuide: React.FC<SinglePlayerModePlayGuideProps> = ({ tabs, compact = false }) => {
  const { t } = useTranslation(['game', 'gameModes']);
  const [activeIdx, setActiveIdx] = useState(0);

  const safeIdx = tabs.length === 0 ? 0 : Math.min(activeIdx, tabs.length - 1);
  const activeTab = tabs[safeIdx];

  const panelShell = useMemo(
    () =>
      'relative min-w-0 overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] shadow-[0_12px_36px_-16px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-400/12',
    [],
  );

  if (!activeTab || tabs.length === 0) return null;

  const titleClass = 'text-[0.72rem] font-black uppercase tracking-[0.1em] text-amber-200/90 sm:text-[0.78rem]';
  const tabBtnClass = (selected: boolean) =>
    `inline-flex min-h-[2.1rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-bold transition sm:min-h-[2.25rem] sm:px-3 sm:text-xs ${
      selected
        ? 'border-amber-300/55 bg-amber-500/20 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-amber-400/25'
        : 'border-white/10 bg-black/25 text-amber-100/75 hover:border-amber-400/30 hover:text-amber-50'
    }`;

  return (
    <section className={`${panelShell} p-2.5`} aria-label={t('game:singlePlayerDesc.modeGuideTitle')}>
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/[0.06] blur-2xl"
        aria-hidden
      />

      <div
        className="flex min-w-0 flex-wrap gap-1.5 sm:gap-2"
        role="tablist"
        aria-label={t('game:singlePlayerDesc.modeTypeTabs')}
      >
        {tabs.map((tab, idx) => {
          const selected = idx === safeIdx;
          return (
            <button
              key={`${String(tab.mode)}-${idx}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIdx(idx)}
              className={tabBtnClass(selected)}
            >
              <img src={tab.modeIcon} alt="" className="h-4 w-4 object-contain sm:h-[1.125rem] sm:w-[1.125rem]" />
              <span>{t(tab.tabLabelKey as any)}</span>
            </button>
          );
        })}
      </div>

      <div className={`${titleClass} mt-2`}>{t('game:singlePlayerDesc.modeGuideTitle')}</div>

      <div className="mt-1.5 space-y-1.5" role="tabpanel">
        {activeTab.steps.map((step) => (
          <div
            key={step.key}
            className="flex min-w-0 items-start gap-2 rounded-lg border border-amber-500/22 bg-black/32 px-2 py-1.5 ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-amber-400/22 bg-gradient-to-br from-zinc-950/90 to-black/80 p-0.5 shadow-inner">
              <img src={step.img} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.78rem] font-black leading-tight text-amber-100 sm:text-sm">
                {t(step.titleKey as any)}
              </p>
              <p className="mt-0.5 text-[0.72rem] font-semibold leading-snug text-white/84 sm:text-xs">
                {t(step.bodyKey as any, step.bodyParams as any)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SinglePlayerModePlayGuide;
