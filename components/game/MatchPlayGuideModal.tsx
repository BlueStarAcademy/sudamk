import React, { useLayoutEffect, useRef, useState } from 'react';
import { LiveGameSession } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import { buildMatchPlayGuide } from '../../utils/matchPlayGuide.js';

interface MatchPlayGuideModalProps {
    session: LiveGameSession;
    onClose: () => void;
}

const MatchPlayGuideModal: React.FC<MatchPlayGuideModalProps> = ({ session, onClose }) => {
    const guide = buildMatchPlayGuide(session);
    const contentRef = useRef<HTMLDivElement>(null);
    const [frameHeight, setFrameHeight] = useState(620);

    useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const update = () => {
            const raw = Math.max(el.offsetHeight, el.scrollHeight);
            if (raw < 8) return;
            // 헤더/패딩/푸터 여유를 포함해서 스크롤 없이 보이게 조정
            const next = Math.min(980, Math.max(520, Math.ceil(raw + 170)));
            setFrameHeight((prev) => (prev === next ? prev : next));
        };
        update();
        const ro = new ResizeObserver(() => requestAnimationFrame(update));
        ro.observe(el);
        return () => ro.disconnect();
    }, [guide.title, guide.sections]);

    return (
        <DraggableWindow
            title="경기방법"
            windowId="match-play-guide"
            onClose={onClose}
            initialWidth={560}
            initialHeight={frameHeight}
            uniformPcScale
            bodyScrollable={false}
            closeOnOutsideClick
        >
            <div ref={contentRef} className="flex flex-col gap-4 text-base leading-relaxed text-gray-200 antialiased">
                <p className="border-b border-gray-600 pb-2 text-lg font-bold text-amber-200/95">{guide.title}</p>
                {guide.sections.map((section) => (
                    <section key={section.subtitle}>
                        <h4 className="mb-2 text-base font-semibold text-sky-300">{section.subtitle}</h4>
                        <ul className="list-disc space-y-2 pl-5 text-gray-200 leading-relaxed">
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
