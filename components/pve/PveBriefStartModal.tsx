import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useAppTranslation.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import type { LiveGameSession, ServerAction, SinglePlayerStageInfo, UserWithStatus } from '../../types.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import Button from '../Button.js';
import {
    PRE_GAME_MODAL_ACCENT_BTN_CLASS,
    PRE_GAME_MODAL_FOOTER_CLASS,
    PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
} from '../game/PreGameDescriptionLayout.js';
import { resolveLiveSessionSinglePlayerStageRow } from '../../shared/utils/liveSessionSinglePlayerStage.js';
import { getTowerSessionFloor } from '../../utils/towerPreGameDisplay.js';
import { formatSinglePlayerStageShortName } from '../../utils/singlePlayerStageDisplayName.js';
import {
    buildAdventureGoalDisplay,
    buildPveBriefGoalForAcademy,
} from '../../utils/pveBriefGoalDisplay.js';
import PveBriefGoalPanel from './PveBriefGoalPanel.js';
import { getAdventureCodexMonsterById } from '../../constants/adventureMonstersCodex.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import i18n from '../../shared/i18n/config.js';

export type PveBriefMode = 'academy' | 'tower' | 'adventure';

const PVE_BRIEF_FOOTER_BTN =
    '!min-h-[2.65rem] !min-w-0 !px-1.5 !py-1.5 !text-[10px] !font-bold !leading-tight !tracking-tight !whitespace-nowrap sm:!px-3 sm:!text-sm sm:!leading-snug';
const PVE_BRIEF_FOOTER_SECONDARY = `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} ${PVE_BRIEF_FOOTER_BTN}`;
const PVE_BRIEF_FOOTER_ACCENT = `${PRE_GAME_MODAL_ACCENT_BTN_CLASS} ${PVE_BRIEF_FOOTER_BTN}`;
const PVE_BRIEF_FOOTER_TUTORIAL = `${PVE_BRIEF_FOOTER_SECONDARY} !shrink-0 !min-w-max`;

type Props = {
    session: LiveGameSession;
    mode: PveBriefMode;
    onStart?: () => void;
    onExit?: () => void;
    onClose?: () => void;
    readOnly?: boolean;
    currentUser?: UserWithStatus;
    onAction?: (action: ServerAction) => Promise<unknown> | void;
    /** 모험: 튜토리얼 다시보기 */
    onReplayTutorial?: () => void;
    stageOverride?: SinglePlayerStageInfo | null;
    titleOverride?: string;
};

function resolveMode(session: LiveGameSession, explicit?: PveBriefMode): PveBriefMode {
    if (explicit) return explicit;
    if (String(session.gameCategory ?? '') === 'adventure') return 'adventure';
    if (String(session.gameCategory ?? '') === 'tower') return 'tower';
    return 'academy';
}

function resolveTitle(
    session: LiveGameSession,
    mode: PveBriefMode,
    stage: SinglePlayerStageInfo | null | undefined,
    titleOverride?: string,
): string {
    if (titleOverride) return titleOverride;
    if (mode === 'adventure') {
        const codex = session.adventureMonsterCodexId
            ? getAdventureCodexMonsterById(session.adventureMonsterCodexId)
            : null;
        return codex?.name || session.stageId || '—';
    }
    if (!stage) return session.stageId || '—';
    if (mode === 'tower') return stage.name || `${getTowerSessionFloor(session)}층`;
    return formatSinglePlayerStageShortName(stage, i18n.t.bind(i18n));
}

const PveBriefStartModal: React.FC<Props> = ({
    session,
    mode: modeProp,
    onStart,
    onExit,
    onClose,
    readOnly = false,
    onReplayTutorial,
    stageOverride,
    titleOverride,
}) => {
    const { t } = useTranslation('game');
    const { modalLayerUsesDesignPixels } = useAppContext();
    const isHandheld = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isCompact = isHandheld || isNativeMobile;
    const mode = resolveMode(session, modeProp);

    const stage = useMemo(() => {
        if (stageOverride) return stageOverride;
        if (mode === 'adventure') return null;
        if (mode === 'tower') {
            return TOWER_STAGES.find((s) => s.id === session.stageId) ?? null;
        }
        return resolveLiveSessionSinglePlayerStageRow(session) ?? null;
    }, [mode, session, stageOverride]);

    const goals = useMemo(() => {
        if (mode === 'adventure') return buildAdventureGoalDisplay(session);
        if (!stage) return null;
        return buildPveBriefGoalForAcademy(session, stage);
    }, [mode, session, stage]);

    const badgeKey =
        mode === 'tower'
            ? 'pveBrief.badgeTower'
            : mode === 'adventure'
              ? 'pveBrief.badgeAdventure'
              : 'pveBrief.badgeAcademy';
    const title = resolveTitle(session, mode, stage, titleOverride);

    const footer = (
        <div className={`${PRE_GAME_MODAL_FOOTER_CLASS} !gap-1.5 !p-2.5 sm:!gap-3 sm:!p-4`}>
            {readOnly ? (
                <>
                    {onReplayTutorial ? (
                        <Button
                            type="button"
                            colorScheme="none"
                            bare
                            className={`${PVE_BRIEF_FOOTER_TUTORIAL} flex-1`}
                            onClick={onReplayTutorial}
                            cooldownMs={0}
                        >
                            {t('pveBrief.replayTutorial')}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_BRIEF_FOOTER_ACCENT} flex-1`}
                        onClick={onClose}
                        cooldownMs={0}
                    >
                        {t('pveBrief.confirm')}
                    </Button>
                </>
            ) : (
                <>
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_BRIEF_FOOTER_SECONDARY} flex-1`}
                        onClick={onExit}
                        cooldownMs={0}
                    >
                        {t('pveBrief.exit')}
                    </Button>
                    {onReplayTutorial ? (
                        <Button
                            type="button"
                            colorScheme="none"
                            bare
                            className={`${PVE_BRIEF_FOOTER_TUTORIAL} flex-[0.95]`}
                            onClick={onReplayTutorial}
                            cooldownMs={0}
                        >
                            {t('pveBrief.replayTutorial')}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        colorScheme="none"
                        bare
                        className={`${PVE_BRIEF_FOOTER_ACCENT} flex-[1.2]`}
                        onClick={onStart}
                        cooldownMs={0}
                    >
                        {t('pveBrief.start')}
                    </Button>
                </>
            )}
        </div>
    );

    const body = (
        <div
            className={`relative w-full max-w-[22rem] overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-b from-[#1c1628] via-[#121018] to-[#08070c] shadow-[0_20px_50px_-16px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-300/15 ${
                isCompact ? 'mx-3' : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pve-brief-title"
        >
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" aria-hidden />
            <div className={`relative space-y-3 ${isCompact ? 'px-3.5 py-3.5' : 'px-5 py-5'}`}>
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="rounded-full border border-amber-400/40 bg-amber-950/50 px-2.5 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-200/95">
                        {t(badgeKey)}
                    </span>
                    <h2 id="pve-brief-title" className="text-xl font-black leading-tight text-white sm:text-2xl">
                        {title}
                    </h2>
                </div>
                {goals ? <PveBriefGoalPanel goals={goals} compact={isCompact} /> : null}
            </div>
            <div className="relative border-t border-white/10 bg-black/35 px-3 py-3 sm:px-4">{footer}</div>
        </div>
    );

    const overlayPositionClass = modalLayerUsesDesignPixels
        ? 'absolute inset-0 z-[1]'
        : 'fixed inset-0 z-[60000]';

    const layer = (
        <div
            className={`pointer-events-auto ${overlayPositionClass} flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]`}
        >
            {body}
        </div>
    );

    if (typeof document === 'undefined') return layer;
    const root = document.getElementById('sudamr-modal-root') || document.body;
    return createPortal(layer, root);
};

export default PveBriefStartModal;
