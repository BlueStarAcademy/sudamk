import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GuildBossFxKind } from '../../types/index.js';

export type GuildBossSkillHitFxProps = {
    fxKind: GuildBossFxKind;
    secondaryFxKind?: GuildBossFxKind;
    icon?: string;
    isCrit?: boolean;
    /** Remount key for animation restart */
    fxKey: number;
    /** Projectile flies left→right (user attacks boss) or right→left */
    projectileDir?: 'to-boss' | 'to-user' | 'none';
    missProjectile?: boolean;
    className?: string;
};

const Burst: React.FC<{ kind: GuildBossFxKind; strong?: boolean }> = ({ kind, strong }) => {
    const strongClass = strong ? 'guild-boss-fx--strong' : '';
    switch (kind) {
        case 'slash':
            return <div className={`guild-boss-fx-slash ${strongClass}`} aria-hidden />;
        case 'wave':
            return <div className={`guild-boss-fx-wave ${strongClass}`} aria-hidden />;
        case 'burn':
        case 'research_ignite':
            return <div className={`guild-boss-fx-burn ${strongClass}`} aria-hidden />;
        case 'nature':
            return <div className={`guild-boss-fx-nature ${strongClass}`} aria-hidden />;
        case 'heal':
        case 'research_regen':
            return <div className={`guild-boss-fx-heal ${strongClass}`} aria-hidden />;
        case 'mystery':
            return <div className={`guild-boss-fx-mystery ${strongClass}`} aria-hidden />;
        case 'radiance':
            return <div className={`guild-boss-fx-radiance ${strongClass}`} aria-hidden />;
        case 'crush':
            return <div className={`guild-boss-fx-crush ${strongClass}`} aria-hidden />;
        case 'debuff':
            return <div className={`guild-boss-fx-debuff ${strongClass}`} aria-hidden />;
        case 'dodge':
            return <div className={`guild-boss-fx-dodge ${strongClass}`} aria-hidden />;
        case 'guard_partial':
            return <div className={`guild-boss-fx-guard ${strongClass}`} aria-hidden />;
        case 'research_heal_block':
            return <div className={`guild-boss-fx-block ${strongClass}`} aria-hidden />;
        case 'research_heal_reduce':
            return <div className={`guild-boss-fx-block guild-boss-fx-block--soft ${strongClass}`} aria-hidden />;
        case 'research_damage_buff':
            return <div className={`guild-boss-fx-dmg-buff ${strongClass}`} aria-hidden />;
        case 'research_hp_buff':
            return <div className={`guild-boss-fx-hp-buff ${strongClass}`} aria-hidden />;
        case 'extra_turn':
            return <div className={`guild-boss-fx-extra ${strongClass}`} aria-hidden />;
        default:
            return <div className={`guild-boss-fx-slash ${strongClass}`} aria-hidden />;
    }
};

const GuildBossSkillHitFx: React.FC<GuildBossSkillHitFxProps> = ({
    fxKind,
    secondaryFxKind,
    icon,
    isCrit = false,
    fxKey,
    projectileDir = 'none',
    missProjectile = false,
    className = '',
}) => {
    const { t } = useTranslation('guild');
    const showLabel = fxKind === 'dodge' || fxKind === 'guard_partial' || fxKind === 'extra_turn';

    return (
        <div key={fxKey} className={`pointer-events-none absolute inset-0 z-30 overflow-visible ${className}`} aria-hidden>
            {projectileDir !== 'none' && icon ? (
                <img
                    src={icon}
                    alt=""
                    className={`guild-boss-fx-projectile ${
                        projectileDir === 'to-boss' ? 'guild-boss-fx-projectile--to-boss' : 'guild-boss-fx-projectile--to-user'
                    } ${missProjectile ? 'guild-boss-fx-projectile--miss' : ''}`}
                />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
                <Burst kind={fxKind} strong={isCrit} />
                {secondaryFxKind ? (
                    <div className="absolute inset-0 flex items-center justify-center opacity-70">
                        <Burst kind={secondaryFxKind} strong={false} />
                    </div>
                ) : null}
                {showLabel ? (
                    <span className="guild-boss-fx-label">
                        {fxKind === 'dodge'
                            ? t('boss.fxDodge')
                            : fxKind === 'guard_partial'
                              ? t('boss.fxGuard')
                              : t('boss.fxExtraTurn')}
                    </span>
                ) : null}
            </div>
        </div>
    );
};

export default GuildBossSkillHitFx;
