import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import type { Announcement, OverrideAnnouncement, GameMode } from '../types.js';

interface AnnouncementsModalProps {
    announcements: Announcement[];
    globalOverrideAnnouncement: OverrideAnnouncement | null;
    onClose: () => void;
    isTopmost?: boolean;
}

const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({
    announcements,
    globalOverrideAnnouncement,
    onClose,
    isTopmost,
}) => {
    const modesLabel = (modes: GameMode[] | 'all'): string => {
        if (modes === 'all') return '전체';
        return modes.join(', ');
    };

    return (
        <DraggableWindow title="공지" onClose={onClose} windowId="announcements-modal" initialWidth={520} isTopmost={isTopmost}>
            <div className="flex max-h-[min(70dvh,520px)] flex-col gap-3 overflow-y-auto pr-1 text-primary">
                {globalOverrideAnnouncement?.message ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 p-3 shadow-inner">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">긴급 안내</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-50">
                            {globalOverrideAnnouncement.message}
                        </p>
                        <p className="mt-2 text-[11px] text-amber-200/60">
                            적용: {modesLabel(globalOverrideAnnouncement.modes)}
                        </p>
                    </div>
                ) : null}
                {(!announcements || announcements.length === 0) && !globalOverrideAnnouncement?.message ? (
                    <p className="py-8 text-center text-sm text-tertiary">등록된 공지가 없습니다.</p>
                ) : null}
                {announcements?.map((a) => (
                    <div
                        key={a.id}
                        className="rounded-lg border border-color/40 bg-secondary/40 p-3 shadow-sm"
                    >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-panel">{a.message}</p>
                    </div>
                ))}
            </div>
        </DraggableWindow>
    );
};

export default AnnouncementsModal;
