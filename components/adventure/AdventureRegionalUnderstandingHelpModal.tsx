import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import {
    ADVENTURE_REGIONAL_SPECIALTY_KINDS,
    labelRegionalSpecialtyBuffEntry,
    migrateRegionalBuffEntry,
} from '../../utils/adventureRegionalSpecialtyBuff.js';

type Props = {
    onClose: () => void;
    isTopmost?: boolean;
};

const AdventureRegionalUnderstandingHelpModal: React.FC<Props> = ({ onClose, isTopmost }) => {
    return (
        <DraggableWindow
            title="효과 정보"
            onClose={onClose}
            windowId="adventure-regional-understanding-help"
            initialWidth={560}
            initialHeight={520}
            isTopmost={isTopmost}
        >
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm text-zinc-200">
                <section className="rounded-lg border border-violet-500/25 bg-violet-950/15 p-3">
                    <h3 className="text-base font-bold text-violet-100">슬롯에서 나올 수 있는 효과</h3>
                    <ul className="mt-2 space-y-1.5">
                        {ADVENTURE_REGIONAL_SPECIALTY_KINDS.map((kind) => (
                            <li
                                key={kind}
                                className="rounded-md border border-white/8 bg-black/30 px-2 py-1.5 text-xs font-medium leading-snug text-zinc-200"
                            >
                                {labelRegionalSpecialtyBuffEntry(migrateRegionalBuffEntry({ kind, stacks: 1 }))}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </DraggableWindow>
    );
};

export default AdventureRegionalUnderstandingHelpModal;
