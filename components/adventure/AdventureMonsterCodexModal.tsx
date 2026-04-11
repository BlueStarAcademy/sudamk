import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import { ADVENTURE_STAGES, ADVENTURE_MONSTER_MODE_LABELS, ADVENTURE_MONSTER_MODES } from '../../constants/adventureConstants.js';
import { AdventureMonsterSpriteFrame } from './AdventureMonsterSprite.js';

interface Props {
    onClose: () => void;
    isTopmost?: boolean;
}

const AdventureMonsterCodexModal: React.FC<Props> = ({ onClose, isTopmost }) => {
    return (
        <DraggableWindow
            title="모험 몬스터 도감"
            onClose={onClose}
            windowId="adventure-monster-codex"
            initialWidth={720}
            initialHeight={680}
            isTopmost={isTopmost}
        >
            <div className="max-h-[min(78vh,720px)] overflow-y-auto overscroll-contain pr-1">
                <p className="mb-4 rounded-lg border border-violet-500/25 bg-violet-950/20 px-3 py-2 text-xs leading-relaxed text-zinc-300">
                    챕터마다 다른 서식지의 대표 몬스터입니다. 맵에 나타나는 개체는{' '}
                    <span className="font-semibold text-amber-200/95">{ADVENTURE_MONSTER_MODES.map((m) => ADVENTURE_MONSTER_MODE_LABELS[m]).join(' · ')}</span>{' '}
                    규칙으로 무장한 형태로 등장합니다.
                </p>
                <ul className="space-y-4">
                    {ADVENTURE_STAGES.map((stage) => (
                        <li
                            key={stage.id}
                            className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                                <AdventureMonsterSpriteFrame
                                    sheetUrl={stage.monsterSheetWebp}
                                    frameIndex={0}
                                    cols={stage.monsterSpriteLayout.cols}
                                    rows={stage.monsterSpriteLayout.rows}
                                    className="mx-auto aspect-square w-[min(100%,12rem)] shrink-0 rounded-xl border border-amber-500/30 bg-zinc-950/80 shadow-inner sm:mx-0 sm:w-44"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md border border-amber-400/35 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-100 sm:text-xs">
                                            CHAPTER {String(stage.stageIndex).padStart(2, '0')}
                                        </span>
                                        <span className="text-xs font-semibold text-zinc-500">{stage.title}</span>
                                    </div>
                                    <h3 className="mt-2 text-lg font-black tracking-tight text-transparent bg-gradient-to-r from-fuchsia-200 via-amber-100 to-cyan-200 bg-clip-text sm:text-xl">
                                        {stage.monsterName}
                                    </h3>
                                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-300/95">
                                        {stage.monsterCodexLines.map((line, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" aria-hidden />
                                                <span>{line}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default AdventureMonsterCodexModal;
