import React from 'react';
import { useTranslation } from 'react-i18next';

interface GuildExpBadgeProps {
    className?: string;
    textClassName?: string;
}

const GuildExpBadge: React.FC<GuildExpBadgeProps> = ({ className = '', textClassName = '' }) => {
    const { t } = useTranslation('guild');
    return (
        <span
            className={`inline-flex h-6 min-w-[2.25rem] shrink-0 flex-col items-center justify-center rounded-md border border-blue-400/45 bg-blue-950/45 px-1 ${className}`.trim()}
            aria-label={t('expBadge.label')}
            title={t('expBadge.label')}
        >
            <span className={`block text-[8px] font-black uppercase leading-none tracking-wide text-blue-100 ${textClassName}`.trim()}>
                {t('expBadge.short')}
            </span>
            <span className={`block text-[8px] font-black uppercase leading-none tracking-wide text-blue-100 ${textClassName}`.trim()}>
                EXP
            </span>
        </span>
    );
};

export default GuildExpBadge;
