import { useTranslation } from 'react-i18next';
import React from 'react';
import Button from '../Button.js';
import { translateMannerRankLabel } from '../../shared/utils/translateMannerRankLabel.js';

type ProfileMannerSealProps = {
    score: number;
    rank: string;
    rankColorClass: string;
    compact?: boolean;
    onOpenInfo: () => void;
};

const ProfileMannerSeal: React.FC<ProfileMannerSealProps> = ({
    score,
    rank,
    rankColorClass,
    compact = false,
    onOpenInfo,
}) => {
    const { t } = useTranslation(['common', 'profile']);
    const translatedRank = translateMannerRankLabel(t, rank);
    return (
        <div
            className={`flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border border-amber-500/30 bg-gradient-to-r from-zinc-800/95 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                compact ? 'px-2 py-1' : 'px-2.5 py-1.5 sm:px-3'
            }`}
            title={t('manner.scoreTitle', { score, rank: translatedRank })}
        >
            <span
                className={`shrink-0 font-bold text-amber-100/90 ${compact ? 'text-[10px]' : 'text-xs'}`}
            >
                {t('manner.label')}
            </span>
            <span
                className={`max-w-[40%] shrink-0 truncate rounded border border-amber-400/40 bg-black/35 px-1.5 py-px font-bold leading-none ${rankColorClass} ${
                    compact ? 'text-[10px]' : 'text-xs'
                }`}
            >
                {translatedRank}
            </span>
            <span
                className={`min-w-0 flex-1 truncate text-right font-bold tabular-nums text-amber-50 ${
                    compact ? 'text-[10px]' : 'text-xs sm:text-sm'
                }`}
            >
                {t('pointsSuffix', { count: score })}
            </span>
            <Button
                type="button"
                onClick={onOpenInfo}
                colorScheme="none"
                className={`!shrink-0 !whitespace-nowrap rounded-md border border-amber-500/55 bg-gradient-to-b from-zinc-700 to-zinc-800 !font-semibold !leading-none !text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-amber-400/70 ${
                    compact ? '!px-1.5 !py-0.5 !text-[10px]' : '!px-2 !py-0.5 !text-[10px] sm:!text-xs'
                }`}
                title="{t('manner.label')} 등급 {t('manner.infoButton')}"
            >
                {t('manner.infoButton')}
            </Button>
        </div>
    );
};

export default ProfileMannerSeal;
