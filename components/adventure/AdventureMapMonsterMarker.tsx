import React from 'react';
import type { AdventureStageId } from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    useAdventureMonsterSpriteFrame,
    usePrefersReducedMotion,
} from '../../hooks/useAdventureMonsterSpriteFrame.js';
import { buildAdventureMapMonsterWanderStyle } from '../../shared/utils/adventureMapMonsterWander.js';
import type { AdventureMapMonsterInstance } from '../../shared/utils/adventureMapSchedule.js';
import { AdventureMonsterSpriteFrame } from './AdventureMonsterSprite.js';
import AdventureMapMonsterLabel from './AdventureMapMonsterLabel.js';

type Props = {
    monster: AdventureMapMonsterInstance;
    selected: boolean;
    stageId: AdventureStageId;
    mapW: number;
    mapH: number;
    mobileSpritePx: number | null;
    isNativeMobile: boolean;
    remainingMs: number;
    modeBadge: string;
    ariaLabel: string;
    onSelect: () => void;
};

export const AdventureMapMonsterMarker: React.FC<Props> = ({
    monster: m,
    selected,
    stageId,
    mapW,
    mapH,
    mobileSpritePx,
    isNativeMobile,
    remainingMs,
    modeBadge,
    ariaLabel,
    onSelect,
}) => {
    const reducedMotion = usePrefersReducedMotion();
    const wander = buildAdventureMapMonsterWanderStyle(m.id, mapW, mapH, stageId, {
        xPct: m.xPct,
        yPct: m.yPct,
    });
    const frameIndex = useAdventureMonsterSpriteFrame(
        m.spriteCols,
        m.spriteRows,
        wander.walking && !reducedMotion,
        reducedMotion,
    );

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
            className={[
                'absolute z-20 flex touch-manipulation select-none flex-col items-center',
                '-translate-x-1/2 -translate-y-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-0',
                selected ? 'scale-[1.05]' : 'hover:scale-[1.03] active:scale-[0.98]',
            ].join(' ')}
            style={{ left: `${m.xPct}%`, top: `${m.yPct}%` }}
            aria-label={ariaLabel}
        >
            <div
                className={[
                    'adventure-map-monster-wander flex flex-col items-center rounded-md px-0.5 pb-0.5 pt-0',
                    selected ? 'ring-2 ring-amber-400/90 ring-offset-0' : '',
                ].join(' ')}
                style={wander.wanderStyle}
            >
                <div className="adventure-map-monster-face" style={wander.faceStyle}>
                    <div
                        className={[
                            wander.walking && !reducedMotion ? 'adventure-map-monster-bob' : '',
                            'relative flex items-end justify-center',
                            mobileSpritePx != null
                                ? ''
                                : isNativeMobile
                                  ? 'h-[clamp(2.4rem,9vw,3.4rem)] w-[clamp(2.4rem,9vw,3.4rem)]'
                                  : 'h-[clamp(4.25rem,17.25vw,6.1rem)] w-[clamp(4.25rem,17.25vw,6.1rem)] sm:h-[6.75rem] sm:w-[6.75rem]',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        style={
                            mobileSpritePx != null
                                ? {
                                      width: mobileSpritePx,
                                      height: mobileSpritePx,
                                      minWidth: mobileSpritePx,
                                      minHeight: mobileSpritePx,
                                      ...(wander.walking && !reducedMotion ? wander.bobStyle : null),
                                  }
                                : wander.walking && !reducedMotion
                                  ? wander.bobStyle
                                  : undefined
                        }
                    >
                        <AdventureMonsterSpriteFrame
                            sheetUrl={m.spriteSheetWebp}
                            frameIndex={frameIndex}
                            cols={m.spriteCols}
                            rows={m.spriteRows}
                            softBackdrop
                            className="absolute inset-0 z-0 h-full w-full bg-transparent"
                        />
                    </div>
                </div>
                <AdventureMapMonsterLabel
                    variant="map"
                    level={m.level}
                    name={m.speciesName}
                    boss={isAdventureChapterBossCodexId(m.codexId)}
                    modeBadge={modeBadge}
                    remainingMs={remainingMs}
                    compact={isNativeMobile}
                />
            </div>
        </button>
    );
};

export default AdventureMapMonsterMarker;
