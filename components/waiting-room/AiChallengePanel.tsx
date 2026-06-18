import React from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../../types.js';
import Button from '../Button.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { aiChallengePanelInnerGradientClass } from './waitingLobbyHomePanelStyles.js';
import { tx } from '../../shared/i18n/runtimeText.js';

function resolveAiChallengeLobbyBotName(mode: GameMode | 'strategic' | 'playful'): string {
    if (typeof mode !== 'string') {
        const playfulDef = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
        if (playfulDef) return tx('lobby:aiChallengeModal.botSuffix', { name: playfulDef.name });
        const strategicDef = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
        if (strategicDef) return tx('lobby:aiChallengeModal.botSuffix', { name: strategicDef.name });
    }
    if (mode === 'playful') {
        const def = PLAYFUL_GAME_MODES[0] ?? SPECIAL_GAME_MODES[0];
        return tx('lobby:aiChallengeModal.botSuffix', { name: def.name });
    }
    const def = SPECIAL_GAME_MODES.find((d) => d.mode === GameMode.Standard) ?? SPECIAL_GAME_MODES[0];
    return tx('lobby:aiChallengeModal.botSuffix', { name: def.name });
}

export function formatLobbyAiRecordLine(rec: { wins: number; losses: number }): string {
    const w = Math.max(0, Math.floor(Number(rec.wins) || 0));
    const l = Math.max(0, Math.floor(Number(rec.losses) || 0));
    const g = w + l;
    const pct = g > 0 ? Math.round((w / g) * 100) : 0;
    return tx('lobby:aiChallengeModal.aiRecord', { wins: w, losses: l, winRate: pct });
}

const AI_CHALLENGE_PANEL_BOX_PX = 40;
const AI_CHALLENGE_PANEL_BOT_IMAGE_SRC = '/images/bot.webp';

const AiChallengePanel: React.FC<{
    mode: GameMode | 'strategic' | 'playful';
    onOpenModal: () => void;
    noOuterShell?: boolean;
    railLayout?: boolean;
    headingTitle?: string;
    aiRecord?: { wins: number; losses: number };
}> = ({ mode, onOpenModal, noOuterShell = false, railLayout = false, headingTitle, aiRecord }) => {
    const { t } = useTranslation('lobby');
    const isStrategic = mode === 'strategic' || SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    const isPlayful = mode === 'playful' || PLAYFUL_GAME_MODES.some((m) => m.mode === mode);

    if (!isStrategic && !isPlayful) return null;

    const botName = resolveAiChallengeLobbyBotName(mode);
    const title = headingTitle ?? (isStrategic ? t('aiChallenge.strategic') : t('aiChallenge.playful'));
    const aiRecordLineText = formatLobbyAiRecordLine(aiRecord ?? { wins: 0, losses: 0 });
    const startLabel = t('aiChallenge.configureAndStart');

    const inner = railLayout ? (
        <div className="flex min-h-0 flex-col gap-2">
            <div className="flex min-w-0 items-start gap-2">
                <div
                    className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-fuchsia-400/80 bg-zinc-900/90 shadow-[0_0_12px_rgba(217,70,239,0.45)]"
                    style={{ width: AI_CHALLENGE_PANEL_BOX_PX - 4, height: AI_CHALLENGE_PANEL_BOX_PX - 4 }}
                    title={botName}
                >
                    <img
                        src={AI_CHALLENGE_PANEL_BOT_IMAGE_SRC}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-[11px] font-extrabold leading-tight tracking-tight text-fuchsia-100 drop-shadow-[0_0_8px_rgba(217,70,239,0.35)] sm:text-xs">
                        {title}
                    </h3>
                    <p className="mt-1 text-[10px] font-semibold tabular-nums leading-snug text-violet-200/90 sm:text-[11px]">
                        {aiRecordLineText}
                    </p>
                </div>
            </div>
            <Button
                onClick={onOpenModal}
                colorScheme="purple"
                className="!w-full !px-2 !py-2 !text-[11px] !font-bold shadow-[0_6px_16px_rgba(139,92,246,0.45)] sm:!text-xs"
            >
                {startLabel}
            </Button>
        </div>
    ) : (
        <div className="flex min-h-[58px] items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div
                    className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-fuchsia-400/80 bg-zinc-900/90 shadow-[0_0_14px_rgba(217,70,239,0.5)]"
                    style={{ width: AI_CHALLENGE_PANEL_BOX_PX, height: AI_CHALLENGE_PANEL_BOX_PX }}
                    title={botName}
                >
                    <img
                        src={AI_CHALLENGE_PANEL_BOT_IMAGE_SRC}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                    />
                </div>
                <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold tracking-tight text-fuchsia-100 drop-shadow-[0_0_10px_rgba(217,70,239,0.35)]">
                        {title}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-violet-200/90 sm:text-sm">{aiRecordLineText}</p>
                </div>
            </div>
            <Button
                onClick={onOpenModal}
                colorScheme="purple"
                className="!px-3.5 !py-2 !text-sm !font-bold shadow-[0_6px_16px_rgba(139,92,246,0.45)]"
            >
                {startLabel}
            </Button>
        </div>
    );

    if (noOuterShell) {
        return inner;
    }

    return <div className={aiChallengePanelInnerGradientClass}>{inner}</div>;
};

export default AiChallengePanel;
