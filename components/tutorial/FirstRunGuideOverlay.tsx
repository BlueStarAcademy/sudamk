import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext, useAppGameStoreSlice } from '../../hooks/useAppContext.js';
import {
    FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS,
    firstRunGuideAllowsBoardPointer,
    firstRunGuideAnchorForStep,
    firstUnequippedPairPet,
    resolveFirstRunGuideStep,
    type FirstRunGuideAnchorId,
    type FirstRunGuideStep,
} from '../../shared/utils/firstRunGuide.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { useFirstRunGuide } from './FirstRunGuideContext.js';

const OVERLAY_Z = 80_000;
const HOLE_PAD = 8;

/** Pan/zoom map viewport anchors — scrollIntoView distorts the stage map transform. */
const SKIP_SCROLL_INTO_VIEW_ANCHORS = new Set<FirstRunGuideAnchorId>(['sp-stage-입문-1', 'pet-hint-board']);

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
        case 'pressPetHint':
            return { body: t('firstRunGuide.pressPetHint') };
        case 'placePetHint':
            return { body: t('firstRunGuide.placePetHint') };
        default:
            return null;
    }
}

const FirstRunGuideOverlay: React.FC = () => {
    const { t } = useTranslation('lobby');
    const { currentUserWithStatus, currentRoute, handlers, modals } = useAppContext();
    const { activeGame } = useAppGameStoreSlice();
    const guide = useFirstRunGuide();
    const [now, setNow] = useState(() => Date.now());
    const [holeRect, setHoleRect] = useState<DOMRect | null>(null);

    const petPanelOpen = isPetPanelOpen(modals);
    const singlePlayerLobbyOpen = isSinglePlayerLobbyOpen(modals);
    const obtainModalOpen = Boolean(modals.pairPetDetailModal);
    const sequencePreviewStep = guide?.sequencePreviewStep ?? null;
    const isSequencePreview = sequencePreviewStep != null;
    const guideReady = Boolean(guide) && (isSequencePreview || !guide?.skipped);
    const welcomeAcknowledged = guide?.welcomeAcknowledged ?? false;
    const hatchConfirmOpen = guide?.hatchConfirmOpen ?? false;
    const selectedStageId = guide?.selectedStageId ?? null;
    const petHintOverlayActive = guide?.petHintOverlayActive ?? false;
    const pveBlockingModalOpen = guide?.pveBlockingModalOpen ?? false;
    const getElement = guide?.getElement;
    const version = guide?.version ?? 0;

    const inSinglePlayerGame = useMemo(() => {
        if (currentRoute.view !== 'game' || !activeGame) return false;
        return resolveArenaSessionPolicy(activeGame).kind === 'singleplayer';
    }, [currentRoute.view, activeGame]);
    const gameStatusPlaying = activeGame?.gameStatus === 'playing';

    const routeBlocksGuide =
        !currentUserWithStatus ||
        currentRoute.view === 'set-nickname' ||
        currentRoute.view === 'login' ||
        !guideReady;

    const step = useMemo(() => {
        if (routeBlocksGuide) return 'done' as const;
        if (sequencePreviewStep) return sequencePreviewStep;
        return resolveFirstRunGuideStep(currentUserWithStatus, {
            welcomeAcknowledged,
            petPanelOpen,
            hatchConfirmOpen,
            obtainModalOpen,
            singlePlayerLobbyOpen,
            selectedStageId,
            inSinglePlayerGame,
            gameStatusPlaying,
            petHintOverlayActive,
            pveBlockingModalOpen,
            now,
        });
    }, [
        currentUserWithStatus,
        routeBlocksGuide,
        sequencePreviewStep,
        welcomeAcknowledged,
        hatchConfirmOpen,
        obtainModalOpen,
        petPanelOpen,
        selectedStageId,
        singlePlayerLobbyOpen,
        inSinglePlayerGame,
        gameStatusPlaying,
        petHintOverlayActive,
        pveBlockingModalOpen,
        now,
    ]);

    useEffect(() => {
        if (isSequencePreview) return;
        if (step !== 'waitHatch' && step !== 'claimPet') return;
        const id = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(id);
    }, [step, isSequencePreview]);

    const openPetPanelInline = useCallback(() => {
        handlers.closePairPetDetailModal?.();
        handlers.closePetManagementModal?.();
        handlers.openPetManagementModal?.();
    }, [handlers]);

    const openSinglePlayerInline = useCallback(() => {
        handlers.closePairPetDetailModal?.();
        handlers.closePetManagementModal?.();
        handlers.closeQuickUtilityPanel?.();
        handlers.openSinglePlayerLobby?.();
    }, [handlers]);

    const returnHomeForAdventureCard = useCallback(() => {
        handlers.closePairPetDetailModal?.();
        handlers.closePetManagementModal?.();
        handlers.closeQuickUtilityPanel?.();
    }, [handlers]);

    useEffect(() => {
        if (isSequencePreview || !guideReady || step !== 'equipPet' || obtainModalOpen || !currentUserWithStatus) {
            return;
        }
        const pet = firstUnequippedPairPet(currentUserWithStatus);
        if (pet) handlers.openPairPetDetailModal?.(pet, 'obtain');
    }, [step, obtainModalOpen, currentUserWithStatus, handlers, guideReady, isSequencePreview]);

    useEffect(() => {
        if (isSequencePreview || !guideReady) return;
        if (modals.isPetManagementModalOpen && modals.activeQuickUtilityPanel !== 'pet') {
            openPetPanelInline();
        }
    }, [
        guideReady,
        isSequencePreview,
        modals.activeQuickUtilityPanel,
        modals.isPetManagementModalOpen,
        openPetPanelInline,
    ]);

    useEffect(() => {
        if (isSequencePreview || !guideReady) return;
        if ((step === 'openPet' || step === 'claimPet') && !petPanelOpen) {
            openPetPanelInline();
        }
    }, [step, guideReady, petPanelOpen, openPetPanelInline, isSequencePreview]);

    /** 대표펫 장착 후 홈 모험 카드가 보이도록 펫 패널·모달을 닫음 (자동 입장하지 않음) */
    useEffect(() => {
        if (isSequencePreview || !guideReady || step !== 'openAdventure') return;
        returnHomeForAdventureCard();
    }, [step, guideReady, isSequencePreview, returnHomeForAdventureCard]);

    const showShortcut =
        !isSequencePreview &&
        ((step === 'openPet' && !petPanelOpen) || (step === 'openAdventure' && !singlePlayerLobbyOpen));
    const onShortcut = () => {
        if (step === 'openPet') openPetPanelInline();
        else if (step === 'openAdventure') openSinglePlayerInline();
    };

    const anchorId = isSequencePreview ? null : firstRunGuideAnchorForStep(step);

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
            if (!SKIP_SCROLL_INTO_VIEW_ANCHORS.has(anchorId)) {
                el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            }
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

    if (!guide || step === 'done' || step === 'waitGameReady') return null;

    const copy = tooltipForStep(step, t, currentUserWithStatus?.nickname ?? '');
    if (!copy) return null;

    const previewIndex = isSequencePreview
        ? FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS.indexOf(sequencePreviewStep)
        : -1;
    const previewTotal = FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS.length;
    const isLastPreviewStep = isSequencePreview && previewIndex >= previewTotal - 1;

    const hole = !isSequencePreview && holeRect && holeRect.width > 2 && holeRect.height > 2 ? holeRect : null;
    const allowBoardPointer = firstRunGuideAllowsBoardPointer(step);
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
                    <div
                        className={`absolute inset-x-0 top-0 bg-black/60 ${allowBoardPointer ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        style={{ height: Math.max(0, hole.top - HOLE_PAD) }}
                    />
                    <div
                        className={`absolute inset-x-0 bottom-0 bg-black/60 ${allowBoardPointer ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        style={{ top: hole.bottom + HOLE_PAD }}
                    />
                    <div
                        className={`absolute bg-black/60 ${allowBoardPointer ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        style={{
                            top: hole.top - HOLE_PAD,
                            left: 0,
                            width: Math.max(0, hole.left - HOLE_PAD),
                            height: hole.height + HOLE_PAD * 2,
                        }}
                    />
                    <div
                        className={`absolute bg-black/60 ${allowBoardPointer ? 'pointer-events-none' : 'pointer-events-auto'}`}
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
                    className={`absolute inset-0 bg-black/65 ${
                        step === 'welcome' || isSequencePreview ? 'pointer-events-auto' : 'pointer-events-none'
                    }`}
                />
            )}

            <div
                className="pointer-events-auto absolute rounded-2xl border border-amber-300/40 bg-zinc-950/95 px-4 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/20"
                style={bubbleStyle}
            >
                {isSequencePreview ? (
                    <p className="mb-1 text-[11px] font-bold text-teal-300/90">
                        {t('firstRunGuide.previewBadge', { current: previewIndex + 1, total: previewTotal })}
                    </p>
                ) : null}
                {copy.title ? (
                    <p className="mb-1 text-sm font-black tracking-tight text-amber-100">{copy.title}</p>
                ) : null}
                <p className="text-sm font-semibold leading-snug text-stone-100">{copy.body}</p>
                {isSequencePreview ? (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                if (isLastPreviewStep) guide.endSequencePreview();
                                else guide.advanceSequencePreview();
                            }}
                            className="mt-3 w-full rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 py-2 text-sm font-black text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                        >
                            {isLastPreviewStep ? t('firstRunGuide.previewDone') : t('firstRunGuide.previewNext')}
                        </button>
                        <button
                            type="button"
                            onClick={() => guide.endSequencePreview()}
                            className="mt-2 w-full text-center text-[11px] text-slate-400 underline hover:text-slate-200"
                        >
                            {t('firstRunGuide.previewClose')}
                        </button>
                    </>
                ) : (
                    <>
                        {step === 'welcome' ? (
                            <button
                                type="button"
                                onClick={() => {
                                    guide.acknowledgeWelcome();
                                    openPetPanelInline();
                                }}
                                className="mt-3 w-full rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 py-2 text-sm font-black text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                            >
                                {t('firstRunGuide.start')}
                            </button>
                        ) : null}
                        {showShortcut ? (
                            <button
                                type="button"
                                onClick={onShortcut}
                                className="mt-3 w-full rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 py-2 text-sm font-black text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                            >
                                {t('firstRunGuide.shortcut')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => guide.skipWalkthrough()}
                            className="mt-2 w-full text-center text-[11px] text-slate-400 underline hover:text-slate-200"
                        >
                            {t('firstRunGuide.skip')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default FirstRunGuideOverlay;
