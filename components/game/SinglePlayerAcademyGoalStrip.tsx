import React, { useMemo } from 'react';
import { useTranslation } from '../../hooks/useAppTranslation.js';
import type { SinglePlayerAcademyGoalDisplay } from '../../utils/singlePlayerAcademyPreGameDisplay.js';

interface SinglePlayerAcademyGoalStripProps {
  goals: SinglePlayerAcademyGoalDisplay;
  compact?: boolean;
  centered?: boolean;
}

const CAPTURE_ICON = '/images/single/BlackDouble.webp';
const TERRITORY_ICON = '/images/simbols/simbol7.webp';
const SURVIVAL_ICON = '/images/simbols/simbol1.webp';
const TIMER_ICON = '/images/icon/timer.webp';

const SinglePlayerAcademyGoalStrip: React.FC<SinglePlayerAcademyGoalStripProps> = ({
  goals,
  compact = false,
  centered = false,
}) => {
  const { t } = useTranslation('game');

  const hasCapturePair =
    goals.myCaptureTarget != null && goals.opponentCaptureTarget != null;
  const hasAnyGoal = useMemo(() => {
    return (
      goals.turnLimit != null ||
      goals.autoScoringTurns != null ||
      goals.myCaptureTarget != null ||
      goals.opponentCaptureTarget != null ||
      goals.survivalGoal != null ||
      (goals.showTerritoryGoal &&
        goals.myCaptureTarget == null &&
        goals.opponentCaptureTarget == null &&
        goals.survivalGoal == null)
    );
  }, [goals]);

  if (!hasAnyGoal) return null;

  const panelClass =
    'relative overflow-hidden rounded-xl border-2 border-amber-400/38 bg-gradient-to-br from-amber-950/55 via-[#1a1524] to-[#0c0a10] px-2.5 py-2 text-center shadow-[0_8px_28px_-8px_rgba(251,191,36,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-300/18';
  const labelClass =
    'flex-shrink-0 text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-200';
  const chipClass =
    'flex min-w-0 flex-shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/28 bg-black/35 px-2 py-1.5 ring-1 ring-inset ring-white/[0.04] sm:px-2.5';
  const iconClass = 'h-6 w-6 flex-shrink-0 object-contain';
  const numClass = compact
    ? 'text-[1.2rem] font-black tabular-nums leading-none text-amber-50'
    : 'text-[1.3rem] font-black tabular-nums leading-none text-amber-50';
  const unitClass = 'text-[0.65rem] font-bold text-amber-200/88';
  const sideLabelClass = 'text-[0.62rem] font-bold text-amber-200/75';
  const vsClass = 'px-0.5 text-[0.58rem] font-black uppercase text-amber-300/50';
  const dotClass = 'text-amber-400/35 font-black select-none';
  const phraseClass = 'text-[0.78rem] font-black leading-tight text-amber-50 sm:text-[0.82rem]';
  const chipsRowClass = centered
    ? 'flex min-w-0 flex-wrap items-center justify-center gap-1.5'
    : 'flex min-w-0 flex-1 flex-wrap items-center gap-1.5';

  return (
    <section className={panelClass} aria-label={t('singlePlayerDesc.goalSection')}>
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-400/[0.08] blur-2xl"
        aria-hidden
      />
      <div
        className={`relative flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5${
          centered ? ' justify-center' : ''
        }`}
      >
        <div className={`flex flex-shrink-0 items-center gap-1.5${centered ? ' justify-center' : ''}`}>
          <span className="h-3.5 w-1 rounded-full bg-amber-400/85" aria-hidden />
          <div className={labelClass}>{t('singlePlayerDesc.goalSection')}</div>
        </div>

        <div className={chipsRowClass}>
          {goals.turnLimit != null && (
            <div className={chipClass}>
              <img src={TIMER_ICON} alt="" className={iconClass} />
              <span className={sideLabelClass}>{t('singlePlayerDesc.goalTurnCaption')}</span>
              <span className={numClass}>{goals.turnLimit}</span>
              <span className={unitClass}>{t('singlePlayerDesc.goalTurnUnit')}</span>
            </div>
          )}

          {goals.autoScoringTurns != null && (
            <div className={chipClass}>
              <img src={TERRITORY_ICON} alt="" className={iconClass} />
              <span className={phraseClass}>
                {t('singlePlayerDesc.autoScoringGoal', { count: goals.autoScoringTurns })}
              </span>
            </div>
          )}

          {hasCapturePair && (
            <div className={chipClass}>
              <img src={CAPTURE_ICON} alt="" className={iconClass} />
              <span className={sideLabelClass}>{t('singlePlayerDesc.goalMySide')}</span>
              <span className={numClass}>{goals.myCaptureTarget}</span>
              <span className={vsClass}>{t('singlePlayerDesc.vs')}</span>
              <span className={sideLabelClass}>{t('singlePlayerDesc.goalOpponentSide')}</span>
              <span className={numClass}>{goals.opponentCaptureTarget}</span>
              <span className={unitClass}>{t('singlePlayerDesc.goalCaptureUnit')}</span>
            </div>
          )}

          {!hasCapturePair && goals.myCaptureTarget != null && (
            <div className={chipClass}>
              <img src={CAPTURE_ICON} alt="" className={iconClass} />
              <span className={sideLabelClass}>{t('singlePlayerDesc.goalMySide')}</span>
              <span className={numClass}>{goals.myCaptureTarget}</span>
              <span className={unitClass}>{t('singlePlayerDesc.goalCaptureUnit')}</span>
            </div>
          )}

          {!hasCapturePair && goals.opponentCaptureTarget != null && (
            <div className={chipClass}>
              <img src={CAPTURE_ICON} alt="" className={iconClass} />
              <span className={sideLabelClass}>{t('singlePlayerDesc.goalOpponentSide')}</span>
              <span className={numClass}>{goals.opponentCaptureTarget}</span>
              <span className={unitClass}>{t('singlePlayerDesc.goalCaptureUnit')}</span>
            </div>
          )}

          {goals.survivalGoal != null && (
            <div className={chipClass}>
              <img src={SURVIVAL_ICON} alt="" className={iconClass} />
              <span className={numClass}>{goals.survivalGoal.turns}</span>
              <span className={unitClass}>{t('singlePlayerDesc.goalTurnUnit')}</span>
              <span className={dotClass} aria-hidden>
                ·
              </span>
              <span className={sideLabelClass}>{t('singlePlayerDesc.goalSurvivalBlockCaption')}</span>
              <span className={numClass}>{goals.survivalGoal.opponentTarget}</span>
              <span className={unitClass}>{t('singlePlayerDesc.goalSurvivalPointUnit')}</span>
            </div>
          )}

          {goals.showTerritoryGoal &&
            goals.myCaptureTarget == null &&
            goals.opponentCaptureTarget == null &&
            goals.survivalGoal == null && (
              <div className={chipClass}>
                <img src={TERRITORY_ICON} alt="" className={iconClass} />
                <span className={phraseClass}>{t('singlePlayerDesc.territoryGoal')}</span>
              </div>
            )}
        </div>
      </div>
    </section>
  );
};

export default SinglePlayerAcademyGoalStrip;
