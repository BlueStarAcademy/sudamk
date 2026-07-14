import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GuildBossFxKind } from '../../types/index.js';
import {
    fxKindToSpectacle,
    type GuildBossFxDirection,
    type GuildBossFxSpectacle,
} from '../../utils/guildBossBattleFx.js';

export type GuildBossSkillHitFxProps = {
    fxKind: GuildBossFxKind;
    secondaryFxKind?: GuildBossFxKind;
    spectacle?: GuildBossFxSpectacle;
    secondarySpectacle?: GuildBossFxSpectacle;
    direction?: GuildBossFxDirection;
    icon?: string;
    isCrit?: boolean;
    /** Remount key for animation restart */
    fxKey: number;
    /** @deprecated Prefer arena spectacles; kept for rare miss trails */
    projectileDir?: 'to-boss' | 'to-user' | 'none';
    missProjectile?: boolean;
    className?: string;
    /** Dim primary spectacle (e.g. blocked/dodged attack echo) */
    muted?: boolean;
};

const SpectacleLayers: React.FC<{
    spectacle: GuildBossFxSpectacle;
    strong?: boolean;
    direction: GuildBossFxDirection;
    muted?: boolean;
}> = ({ spectacle, strong, direction, muted }) => {
    const strongClass = strong ? 'guild-boss-fx--strong' : '';
    const dirClass =
        direction === 'to-user'
            ? 'guild-boss-fx-spectacle--to-user'
            : direction === 'to-boss'
              ? 'guild-boss-fx-spectacle--to-boss'
              : '';
    const muteClass = muted ? 'guild-boss-fx-spectacle--muted' : '';
    const root = `guild-boss-fx-spectacle guild-boss-fx-spectacle--${spectacle.replace(/_/g, '-')} ${dirClass} ${strongClass} ${muteClass}`;

    switch (spectacle) {
        case 'wave_crash':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-body" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-crest" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-foam" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-spray" />
                </div>
            );
        case 'wave_crush':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-pressure" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-ring" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--crush-impact" />
                </div>
            );
        case 'burn_surge':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-pillar" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-glow" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-ember" />
                </div>
            );
        case 'burn_blast':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-blast" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-ring" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-flash" />
                </div>
            );
        case 'burn_dots':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-dots" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-glow" />
                </div>
            );
        case 'nature_vines':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--vine-a" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--vine-b" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--leaf-burst" />
                </div>
            );
        case 'nature_spores':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--spore-cloud" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--spore-dots" />
                </div>
            );
        case 'heal_bloom':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--heal-ring" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--heal-rise" />
                </div>
            );
        case 'mystery_swirl':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--mystery-disk" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--mystery-swirl" />
                </div>
            );
        case 'mystery_invert':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--mystery-invert" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--mystery-flash" />
                </div>
            );
        case 'mystery_mind':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--mystery-mind" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--mystery-pulse" />
                </div>
            );
        case 'radiance_strike':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-beam" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-cross" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-flash" />
                </div>
            );
        case 'radiance_barrier':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-barrier" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-ring" />
                </div>
            );
        case 'radiance_judgment':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-judgment" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--light-pillar" />
                </div>
            );
        case 'slash_cut':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--slash-sheet" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--slash-spark" />
                </div>
            );
        case 'debuff_suppress':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--debuff-veil" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--debuff-seal" />
                </div>
            );
        case 'crush_default':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--crush-impact" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--wave-ring" />
                </div>
            );
        case 'research_ignite':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--ignite-trail" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--fire-glow" />
                </div>
            );
        case 'research_regen':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--heal-ring" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--heal-rise" />
                </div>
            );
        case 'research_heal_block':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--block-x" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--block-ring" />
                </div>
            );
        case 'research_heal_reduce':
            return (
                <div className={`${root} guild-boss-fx-spectacle--soft`} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--block-x" />
                </div>
            );
        case 'research_damage_buff':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--dmg-buff" />
                </div>
            );
        case 'research_hp_buff':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--hp-buff" />
                </div>
            );
        case 'research_hit_guard':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--hit-guard" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--hit-guard-ring" />
                </div>
            );
        case 'dodge':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--dodge-ring" />
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--dodge-slash" />
                </div>
            );
        case 'guard_partial':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--guard-shield" />
                </div>
            );
        case 'extra_turn':
            return (
                <div className={root} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--extra-pulse" />
                </div>
            );
        default:
            return (
                <div className={`${root} guild-boss-fx-spectacle--generic`} aria-hidden>
                    <div className="guild-boss-fx-layer guild-boss-fx-layer--slash-sheet" />
                </div>
            );
    }
};

const GuildBossSkillHitFx: React.FC<GuildBossSkillHitFxProps> = ({
    fxKind,
    secondaryFxKind,
    spectacle,
    secondarySpectacle,
    direction = 'none',
    isCrit = false,
    fxKey,
    projectileDir = 'none',
    missProjectile = false,
    className = '',
    muted = false,
    icon,
}) => {
    const { t } = useTranslation('guild');
    const showLabel = fxKind === 'dodge' || fxKind === 'guard_partial' || fxKind === 'extra_turn';
    const primarySpectacle = spectacle ?? fxKindToSpectacle(fxKind);

    return (
        <div
            key={fxKey}
            className={`pointer-events-none absolute inset-0 z-30 overflow-hidden ${className}`}
            aria-hidden
        >
            {projectileDir !== 'none' && missProjectile && icon ? (
                <img
                    src={icon}
                    alt=""
                    className={`guild-boss-fx-projectile guild-boss-fx-projectile--ghost ${
                        projectileDir === 'to-boss' ? 'guild-boss-fx-projectile--to-boss' : 'guild-boss-fx-projectile--to-user'
                    } guild-boss-fx-projectile--miss`}
                />
            ) : null}
            <div className="absolute inset-0">
                <SpectacleLayers
                    spectacle={primarySpectacle}
                    strong={isCrit}
                    direction={direction}
                    muted={muted || fxKind === 'dodge'}
                />
                {secondarySpectacle ? (
                    <div className="absolute inset-0 opacity-80">
                        <SpectacleLayers
                            spectacle={secondarySpectacle}
                            strong={false}
                            direction={direction}
                            muted={fxKind === 'dodge'}
                        />
                    </div>
                ) : secondaryFxKind ? (
                    <div className="absolute inset-0 opacity-70">
                        <SpectacleLayers
                            spectacle={
                                secondaryFxKind === 'guard_partial'
                                    ? 'guard_partial'
                                    : secondaryFxKind === 'research_hit_guard'
                                      ? 'research_hit_guard'
                                      : secondaryFxKind === 'research_damage_buff'
                                        ? 'research_damage_buff'
                                        : (secondaryFxKind as GuildBossFxSpectacle)
                            }
                            strong={false}
                            direction={direction}
                            muted={fxKind === 'dodge'}
                        />
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
