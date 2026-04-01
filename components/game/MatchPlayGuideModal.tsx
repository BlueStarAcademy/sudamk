import React from 'react';
import { LiveGameSession } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import { buildMatchPlayGuide } from '../../utils/matchPlayGuide.js';

interface MatchPlayGuideModalProps {
    session: LiveGameSession;
    onClose: () => void;
}

const MatchPlayGuideModal: React.FC<MatchPlayGuideModalProps> = ({ session, onClose }) => {
    const guide = buildMatchPlayGuide(session);

    return (
        <DraggableWindow
            title="경기방법"
            windowId="match-play-guide"
            onClose={onClose}
            initialWidth={520}
            initialHeight={480}
            closeOnOutsideClick
        >
            <div className="flex flex-col gap-3 p-3 text-sm text-gray-200 max-h-[min(70vh,520px)] overflow-y-auto">
                <p className="text-amber-200/95 font-bold text-base border-b border-gray-600 pb-2">{guide.title}</p>
                {guide.sections.map((section) => (
                    <section key={section.subtitle}>
                        <h4 className="font-semibold text-sky-300 mb-1.5">{section.subtitle}</h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-gray-300 leading-relaxed">
                            {section.items.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </DraggableWindow>
    );
};

export default MatchPlayGuideModal;
