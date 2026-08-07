import React from 'react';
import { useTranslation } from '../../hooks/useAppTranslation.js';
import type { PveBriefGoalDisplay } from '../../utils/pveBriefGoalDisplay.js';
import SinglePlayerAcademyGoalStrip from '../game/SinglePlayerAcademyGoalStrip.js';

const ITEM_HINT_KEY: Record<NonNullable<PveBriefGoalDisplay['itemHints']>[number]['kind'], string> = {
    missile: 'pveBrief.itemMissile',
    hidden: 'pveBrief.itemHidden',
    scan: 'pveBrief.itemScan',
    base: 'pveBrief.itemBase',
};

type Props = {
    goals: PveBriefGoalDisplay;
    compact?: boolean;
};

/** 문장형 헤드라인 + 기존 목표 칩 */
const PveBriefGoalPanel: React.FC<Props> = ({ goals, compact = false }) => {
    const { t } = useTranslation('game');
    const headline = t(goals.headlineKey, goals.headlineParams ?? {});
    const hints = goals.itemHints ?? [];

    return (
        <div className="flex min-w-0 flex-col gap-2.5">
            <p
                className={`text-center font-black leading-snug tracking-tight text-amber-50 ${
                    compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
                }`}
            >
                {headline}
            </p>
            <SinglePlayerAcademyGoalStrip goals={goals} compact={compact} centered />
            {hints.length > 0 ? (
                <div className="rounded-lg border border-sky-500/25 bg-sky-950/35 px-2.5 py-2 text-center ring-1 ring-inset ring-sky-400/10">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-sky-200/80">
                        {t('pveBrief.itemHintLabel')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                        {hints.map((h) => (
                            <span
                                key={`${h.kind}-${h.count}`}
                                className="rounded-md border border-sky-400/30 bg-black/35 px-2 py-1 text-[0.78rem] font-bold text-sky-50"
                            >
                                {t(ITEM_HINT_KEY[h.kind], { count: h.count })}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default PveBriefGoalPanel;
