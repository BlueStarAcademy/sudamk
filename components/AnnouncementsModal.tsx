import React from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('nav');
    const modesLabel = (modes: GameMode[] | 'all'): string => {
        if (modes === 'all') return t('all');
        return modes.join(', ');
    };

    return (
        <DraggableWindow title={t('announcements.title')} onClose={onClose} windowId="announcements-modal" initialWidth={720} isTopmost={isTopmost}>
            <div className="h-[min(72dvh,640px)] min-h-[520px] rounded-xl border border-color/40 bg-gradient-to-b from-secondary/40 via-secondary/20 to-transparent p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                <div className="mb-4 rounded-lg border border-color/40 bg-black/20 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary">
                        Notice Center
                    </p>
                    <p className="mt-1 text-sm text-on-panel/85">
                        {t('announcements.body')}
                    </p>
                </div>
                <div className="flex h-[calc(100%-84px)] flex-col gap-3 overflow-y-auto pr-1 text-primary">
                {globalOverrideAnnouncement?.message ? (
                    <div className="rounded-xl border border-amber-400/60 bg-gradient-to-br from-amber-700/30 via-amber-900/35 to-black/25 p-4 shadow-[0_10px_30px_rgba(120,53,15,0.35)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">{t('emergencyNotice')}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-50">
                            {globalOverrideAnnouncement.message}
                        </p>
                        <p className="mt-2 text-[11px] text-amber-200/60">
                            {t('announcements.applied', { modes: modesLabel(globalOverrideAnnouncement.modes) })}
                        </p>
                    </div>
                ) : null}
                {(!announcements || announcements.length === 0) && !globalOverrideAnnouncement?.message ? (
                    <p className="py-8 text-center text-sm text-tertiary">{t('announcements.empty')}</p>
                ) : null}
                {announcements?.map((a) => (
                    <div
                        key={a.id}
                        className="rounded-xl border border-color/45 bg-gradient-to-br from-secondary/55 via-secondary/35 to-black/20 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors hover:border-color/70"
                    >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-panel">{a.message}</p>
                    </div>
                ))}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default AnnouncementsModal;
