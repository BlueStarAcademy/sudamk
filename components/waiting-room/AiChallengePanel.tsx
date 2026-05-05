import React from 'react';
import { GameMode } from '../../types.js';
import Button from '../Button.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { aiChallengePanelInnerGradientClass } from './waitingLobbyHomePanelStyles.js';

/** `title` 등: 모드별 「○○봇」 표기 */
function resolveAiChallengeLobbyBotName(mode: GameMode | 'strategic' | 'playful'): string {
    if (typeof mode !== 'string') {
        const playfulDef = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
        if (playfulDef) return `${playfulDef.name}봇`;
        const strategicDef = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
        if (strategicDef) return `${strategicDef.name}봇`;
    }
    if (mode === 'playful') {
        const def = PLAYFUL_GAME_MODES[0] ?? SPECIAL_GAME_MODES[0];
        return `${def.name}봇`;
    }
    const def = SPECIAL_GAME_MODES.find((d) => d.mode === GameMode.Standard) ?? SPECIAL_GAME_MODES[0];
    return `${def.name}봇`;
}

const AI_CHALLENGE_PANEL_BOX_PX = 40;
const AI_CHALLENGE_PANEL_BOT_IMAGE_SRC = '/images/bot.webp';

const AiChallengePanel: React.FC<{
    mode: GameMode | 'strategic' | 'playful';
    onOpenModal: () => void;
    /** true면 바깥 `aiChallengeFeatureShellClass` 껍데기만 쓰고 내부는 콘텐츠 행만 렌더 */
    noOuterShell?: boolean;
}> = ({ mode, onOpenModal, noOuterShell = false }) => {
    const isStrategic = mode === 'strategic' || SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    const isPlayful = mode === 'playful' || PLAYFUL_GAME_MODES.some((m) => m.mode === mode);

    if (!isStrategic && !isPlayful) return null;

    const botName = resolveAiChallengeLobbyBotName(mode);

    const inner = (
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
                        AI와 대결하기
                    </h3>
                </div>
            </div>
            <Button
                onClick={onOpenModal}
                colorScheme="purple"
                className="!px-3.5 !py-2 !text-sm !font-bold shadow-[0_6px_16px_rgba(139,92,246,0.45)]"
            >
                설정 및 시작
            </Button>
        </div>
    );

    if (noOuterShell) {
        return inner;
    }

    return (
        <div className={aiChallengePanelInnerGradientClass}>
            {inner}
        </div>
    );
};

export default AiChallengePanel;
