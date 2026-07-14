import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SgfViewer from '../SgfViewer.js';
import GuildBossSkillHitFx from './GuildBossSkillHitFx.js';
import type { GuildBossCombatFxState } from '../../utils/guildBossBattleFx.js';
import {
    GUILD_BOSS_AMBIENT_MOVE_MS,
    GUILD_BOSS_ENGAGE_MOVE_MS,
    GUILD_BOSS_ENGAGE_STONE_COUNT,
    getGuildBossBattleBoardConfig,
    getGuildBossBoardMoveAt,
    guildBossBoardPointToPercent,
    type GuildBossPresentationPhase,
} from '../../utils/guildBossBattleBoards.js';

export type GuildBossBattleBoardProps = {
    bossId: string;
    phase: GuildBossPresentationPhase;
    /** Stones placed during combat playback (continues after engage intro) */
    combatMoveCount: number;
    combatFx: GuildBossCombatFxState | null;
    showOpeningHpBuff: boolean;
    currentBattleDamage: number;
    compact?: boolean;
    showEngageLabel?: boolean;
};

const GuildBossBattleBoard: React.FC<GuildBossBattleBoardProps> = ({
    bossId,
    phase,
    combatMoveCount,
    combatFx,
    showOpeningHpBuff,
    currentBattleDamage,
    compact = false,
    showEngageLabel = false,
}) => {
    const { t } = useTranslation('guild');
    const config = useMemo(() => getGuildBossBattleBoardConfig(bossId), [bossId]);
    const [ambientCount, setAmbientCount] = useState(0);
    const [engageCount, setEngageCount] = useState(0);
    const [placeFlashKey, setPlaceFlashKey] = useState(0);
    const prevReplayRef = useRef(0);

    useEffect(() => {
        setAmbientCount(0);
        setEngageCount(0);
        prevReplayRef.current = 0;
    }, [bossId]);

    useEffect(() => {
        if (phase !== 'idle') return;
        const id = window.setInterval(() => {
            setAmbientCount((n) => {
                const next = n + 1;
                return next > config.moveCount ? 0 : next;
            });
        }, GUILD_BOSS_AMBIENT_MOVE_MS);
        return () => window.clearInterval(id);
    }, [phase, config.moveCount, bossId]);

    // Challenge start: place stones one-by-one on the board
    useEffect(() => {
        if (phase !== 'engage') return;
        setEngageCount(0);
        const target = Math.min(GUILD_BOSS_ENGAGE_STONE_COUNT, config.moveCount);
        const id = window.setInterval(() => {
            setEngageCount((n) => {
                if (n >= target) return n;
                return n + 1;
            });
        }, GUILD_BOSS_ENGAGE_MOVE_MS);
        return () => window.clearInterval(id);
    }, [phase, config.moveCount, bossId]);

    const replayMoveCount = useMemo(() => {
        if (phase === 'idle') return ambientCount;
        if (phase === 'engage') return Math.min(engageCount, config.moveCount);
        // combat / finale / result — parent keeps incrementing from engage seed
        return Math.min(Math.max(combatMoveCount, 0), config.moveCount);
    }, [phase, ambientCount, engageCount, combatMoveCount, config.moveCount]);

    useEffect(() => {
        if (replayMoveCount > prevReplayRef.current && replayMoveCount > 0) {
            setPlaceFlashKey((k) => k + 1);
        }
        prevReplayRef.current = replayMoveCount;
    }, [replayMoveCount]);

    const lastMove = useMemo(() => {
        if (replayMoveCount <= 0) return null;
        return getGuildBossBoardMoveAt(bossId, replayMoveCount - 1);
    }, [bossId, replayMoveCount]);

    const anchorStyle = useMemo(() => {
        if (!lastMove) return { left: '50%', top: '50%' };
        return guildBossBoardPointToPercent(lastMove.x, lastMove.y, config.boardSize);
    }, [lastMove, config.boardSize]);

    const showSpectacle = Boolean(combatFx) || showOpeningHpBuff;
    const showPlaceFlash = placeFlashKey > 0 && Boolean(lastMove);
    const phaseClass = `guild-boss-battle-board--${phase}`;
    const themeClass = `guild-boss-battle-board--theme-${config.theme}`;

    return (
        <div
            className={`guild-boss-battle-board ${phaseClass} ${themeClass} ${compact ? 'guild-boss-battle-board--compact' : ''}`}
        >
            <div className="guild-boss-battle-board__chrome">
                <div
                    className={`guild-boss-vs-badge guild-boss-vs-badge--board ${compact ? 'guild-boss-vs-badge--compact' : ''} ${
                        phase === 'engage' ? 'guild-boss-vs-badge--engage' : ''
                    } ${phase === 'idle' ? 'guild-boss-vs-badge--enter' : ''}`}
                    aria-hidden
                >
                    <span className="guild-boss-vs-badge__wing guild-boss-vs-badge__wing--l" />
                    <span className="guild-boss-vs-badge__core">
                        <span className="guild-boss-vs-badge__text">VS</span>
                    </span>
                    <span className="guild-boss-vs-badge__wing guild-boss-vs-badge__wing--r" />
                </div>
                <div
                    className={`guild-boss-vs-damage ${compact ? 'guild-boss-vs-damage--compact' : ''} ${
                        phase === 'finale' ? 'guild-boss-vs-damage--finale' : ''
                    }`}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <span className="guild-boss-vs-damage__label">{t('boss.vsLiveDamage')}</span>
                    <span className="guild-boss-vs-damage__value tabular-nums">
                        {Math.max(0, Math.floor(currentBattleDamage)).toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="guild-boss-battle-board__stage">
                <div className="guild-boss-battle-board__pedestal" aria-hidden />
                <div className="guild-boss-battle-board__glow" aria-hidden />
                <div className="guild-boss-battle-board__perspective">
                    <div className="guild-boss-battle-board__frame">
                        <div className="guild-boss-battle-board__motif" aria-hidden />
                        <div className="guild-boss-battle-board__surface">
                            <SgfViewer
                                sgfContent={config.sgfContent}
                                replayMoveCount={replayMoveCount}
                                interactive={false}
                                boardSizePx={compact ? 420 : 560}
                                atmosphereStones
                            />
                            <div className="guild-boss-battle-board__mist" aria-hidden />
                            {showPlaceFlash ? (
                                <span
                                    key={`place-${placeFlashKey}`}
                                    className="guild-boss-battle-board__place-flash"
                                    style={anchorStyle}
                                    aria-hidden
                                />
                            ) : null}
                            {showSpectacle ? (
                                <div className="guild-boss-battle-board__fx guild-boss-fx-board-layer">
                                    <GuildBossSkillHitFx
                                        fxKind={
                                            showOpeningHpBuff && !combatFx
                                                ? 'research_hp_buff'
                                                : combatFx!.fxKind
                                        }
                                        secondaryFxKind={combatFx?.secondaryFxKind}
                                        spectacle={
                                            showOpeningHpBuff && !combatFx
                                                ? 'research_hp_buff'
                                                : combatFx?.spectacle
                                        }
                                        secondarySpectacle={combatFx?.secondarySpectacle}
                                        direction={combatFx?.direction ?? 'none'}
                                        isCrit={combatFx?.isCrit}
                                        fxKey={combatFx?.fxKey ?? 0}
                                        projectileDir="none"
                                        muted={combatFx?.fxKind === 'dodge'}
                                        className="guild-boss-fx-board-mount"
                                    />
                                    {(combatFx || showOpeningHpBuff) && lastMove ? (
                                        <span
                                            className={`guild-boss-battle-board__hit-anchor${
                                                combatFx?.isCrit
                                                    ? ' guild-boss-battle-board__hit-anchor--crit'
                                                    : ''
                                            }${
                                                combatFx?.fxKind === 'heal' ||
                                                combatFx?.fxKind === 'research_regen'
                                                    ? ' guild-boss-battle-board__hit-anchor--heal'
                                                    : ''
                                            }${
                                                combatFx?.fxKind === 'dodge'
                                                    ? ' guild-boss-battle-board__hit-anchor--dodge'
                                                    : ''
                                            }`}
                                            style={anchorStyle}
                                            aria-hidden
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
                {showEngageLabel ? (
                    <div className="guild-boss-battle-board__engage" aria-live="polite">
                        <span className="guild-boss-battle-board__engage-text">{t('boss.engage')}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default GuildBossBattleBoard;
