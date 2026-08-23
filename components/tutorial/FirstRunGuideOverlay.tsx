import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    firstRunGuideAnchorForStep,
    firstUnequippedPairPet,
    resolveFirstRunGuideStep,
    type FirstRunGuideStep,
} from '../../shared/utils/firstRunGuide.js';
import { useFirstRunGuide } from './FirstRunGuideContext.js';

const OVERLAY_Z = 80_000;
const HOLE_PAD = 8;

function isPetPanelOpen(modals: {
    isPetManagementModalOpen?: boolean;
    activeQuickUtilityPanel?: string | null;
    mobileViewportStack?: ReadonlyArray<{ type: string; kind?: string }>;
}): boolean {
    if (modals.isPetManagementModalOpen) return true;
    if (modals.activeQuickUtilityPanel === 'pet') return true;
    return (modals.mobileViewportStack ?? []).some(
        (entry) => entry.type === 'quickUtility' && entry.kind === 'pet',
    );
}

function isSinglePlayerLobbyOpen(modals: {
    activeQuickUtilityPanel?: string | null;
    mobileViewportStack?: ReadonlyArray<{ type: string; kind?: string }>;
}): boolean {
    if (modals.activeQuickUtilityPanel === 'singleplayer') return true;
    return (modals.mobileViewportStack ?? []).some(
        (entry) => entry.type === 'quickUtility' && entry.kind === 'singleplayer',
    );
}

function tooltipForStep(
    step: FirstRunGuideStep,
    t: (key: string, opts?: Record<string, unknown>) => string,
    nickname: string,
): { title?: string; body: string } | null {
    switch (step) {
        case 'welcome':
            return { title: t('firstRunGuide.welcomeTitle'), body: t('firstRunGuide.welcomeBody', { name: nickname }) };
        case 'openPet':
            return { body: t('firstRunGuide.openPet') };
        case 'startHatch':
            return { body: t('firstRunGuide.startHatch') };
        case 'confirmHatch':
            return { body: t('firstRunGuide.confirmHatch') };
        case 'waitHatch':
            return { body: t('firstRunGuide.waitHatch') };
        case 'claimPet':
            return { body: t('firstRunGuide.claimPet') };
        case 'equipPet':
            return { body: t('firstRunGuide.equipPet') };
        case 'openAdventure':
            return { body: t('firstRunGuide.openAdventure') };
        case 'selectFirstStage':
            return { body: t('firstRunGuide.selectFirstStage') };
        case 'startFirstStage':
            return { body: t('firstRunGuide.startFirstStage') };
        default:
            return null;
    }
}

const FirstRunGuideOverlay: React.FC = () => {
    const { t } = useTranslation('lobby');
    const { currentUserWithStatus, currentRoute, handlers, modals } = useAppContext();
    const guide = useFirstRunGuide();
    const [now, setNow] = useState(() => Date.now());
    const [holeRect, setHoleRect] = useState<DOMRect | null>(null);

    const petPanelOpen = isPetPanelOpen(modals);
    const singlePlayerLobbyOpen = isSinglePlayerLobbyOpen(modals);
    const obtainModalOpen = Boolean(modals.pairPetDetailModal);
    const guideReady = Boolean(guide) && !guide?.skipped;
    const welcomeAcknowledged = guide?.welcomeAcknowledged ?? false;
    const hatchConfirmOpen = guide?.hatchConfirmOpen ?? false;
    const selectedStageId = guide?.selectedStageId ?? null;
    const getElement = guide?.getElement;
    const version = guide?.version ?? 0;

    const hiddenByRoute =
        !currentUserWithStatus ||
        currentRoute.view === 'set-nickname' ||
        currentRoute.view === 'game' ||
        currentRoute.view === 'login' ||
        !guideReady;

    const step = useMemo(() => {
        if (hiddenByRoute) return 'done' as const;
        return resolveFirstRunGuideStep(currentUserWithStatus, {
            welcomeAcknowledged,
            petPanelOpen,
            hatchConfirmOpen,
            obtainModalOpen,
            singlePlayerLobbyOpen,
            selectedStageId,
            now,
        });
    }, [
        currentUserWithStatus,
        hiddenByRoute,
        welcomeAcknowledged,
        hatchConfirmOpen,
        obtainModalOpen,
        petPanelOpen,
        selectedStageId,
        singlePlayerLobbyOpen,
        now,
    ]);

    useEffect(() => {
        if (step !== 'waitHatch' && step !== 'claimPet') return;
        const id = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(id);
    }, [step]);

    useEffect(() => {
        if (!guideReady || step !== 'equipPet' || obtainModalOpen || !currentUserWithStatus) return;
        const pet = firstUnequippedPairPet(currentUserWithStatus);
        if (pet) handlers.openPairPetDetailModal?.(pet, 'obtain');
    }, [step, obtainModalOpen, currentUserWithStatus, handlers, guideReady]);

    useEffect(() => {
        if (!guideReady || step !== 'openAdventure') return;
        handlers.closePairPetDetailModal?.();
        handlers.closePetManagementModal?.();
        if (petPanelOpen) handlers.closeQuickUtilityPanel?.();
    }, [step, handlers, guideReady, petPanelOpen]);

    const anchorId = firstRunGuideAnchorForStep(step);

    useLayoutEffect(() => {
        if (!getElement || !anchorId) {
            setHoleRect(null);
            return;
        }
        let attached: HTMLElement | null = null;
        let ro: ResizeObserver | null = null;
        let raf = 0;
        const update = () => {
            if (attached) setHoleRect(attached.getBoundingClientRect());
        };
        const detachListeners = () => {
            ro?.disconnect();
            ro = null;
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
        const attach = (el: HTMLElement) => {
            attached = el;
            el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            update();
            ro = new ResizeObserver(update);
            ro.observe(el);
            window.addEventListener('resize', update);
            window.addEventListener('scroll', update, true);
        };
        const tryAttach = () => {
            const el = getElement(anchorId);
            if (!el) return false;
            attach(el);
            return true;
        };
        if (!tryAttach()) {
            setHoleRect(null);
            const poll = () => {
                if (tryAttach()) return;
                raf = window.requestAnimationFrame(poll);
            };
            raf = window.requestAnimationFrame(poll);
        }
        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            detachListeners();
        };
    }, [getElement, anchorId, version, step]);

    if (!guide || step === 'done') return null;

    const copy = tooltipForStep(step, t, currentUserWithStatus?.nickname ?? '');
    if (!copy) return null;

    const hole = holeRect && holeRect.width > 2 && holeRect.height > 2 ? holeRect : null;
    const bubbleStyle: React.CSSProperties = hole
        ? (() => {
              const below = hole.bottom + HOLE_PAD + 12;
              const spaceBelow = window.innerHeight - below;
              const top = spaceBelow < 140 ? Math.max(12, hole.top - HOLE_PAD - 128) : below;
              const left = Math.min(Math.max(12, hole.left), window.innerWidth - 300);
              return { top, left, maxWidth: 288 };
          })()
        : { top: '38%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 340 };

    return (
        <div className="pointer-events-none fixed inset-0" style={{ zIndex: OVERLAY_Z }} aria-live="polite">
            {hole ? (
                <>
                    <div className="pointer-events-auto absolute inset-x-0 top-0 bg-black/60" style={{ height: Math.max(0, hole.top - HOLE_PAD) }} />
                    <div
                        className="pointer-events-auto absolute inset-x-0 bottom-0 bg-black/60"
                        style={{ top: hole.bottom + HOLE_PAD }}
                    />
                    <div
                        className="pointer-events-auto absolute bg-black/60"
                        style={{
                            top: hole.top - HOLE_PAD,
                            left: 0,
                            width: Math.max(0, hole.left - HOLE_PAD),
                            height: hole.height + HOLE_PAD * 2,
                        }}
                    />
                    <div
                        className="pointer-events-auto absolute bg-black/60"
                        style={{
                            top: hole.top - HOLE_PAD,
                            left: hole.right + HOLE_PAD,
                            right: 0,
                            height: hole.height + HOLE_PAD * 2,
                        }}
                    />
                    <div
                        className="pointer-events-none absolute rounded-2xl ring-2 ring-amber-300/90 ring-offset-2 ring-offset-transparent"
                        style={{
                            top: hole.top - HOLE_PAD,
                            left: hole.left - HOLE_PAD,
                            width: hole.width + HOLE_PAD * 2,
                            height: hole.height + HOLE_PAD * 2,
                        }}
                    />
                </>
            ) : (
                <div
                    className={`absolute inset-0 bg-black/65 ${step === 'welcome' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                />
            )}

            <div
                className="pointer-events-auto absolute rounded-2xl border border-amber-300/40 bg-zinc-950/95 px-4 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/20"
                style={bubbleStyle}
            >
                {copy.title ? (
                    <p className="mb-1 text-sm font-black tracking-tight text-amber-100">{copy.title}</p>
                ) : null}
                <p className="text-sm font-semibold leading-snug text-stone-100">{copy.body}</p>
                {step === 'welcome' ? (
                    <button
                        type="button"
                        onClick={() => guide.acknowledgeWelcome()}
                        className="mt-3 w-full rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 py-2 text-sm font-black text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                    >
                        {t('firstRunGuide.start')}
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => guide.skipWalkthrough()}
                    className="mt-2 w-full text-center text-[11px] text-slate-400 underline hover:text-slate-200"
                >
                    {t('firstRunGuide.skip')}
                </button>
            </div>
        </div>
    );
};

export default FirstRunGuideOverlay;
