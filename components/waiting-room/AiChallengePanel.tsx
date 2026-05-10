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

function defaultHeadingForMode(mode: GameMode | 'strategic' | 'playful'): string {
    const isStrategic = mode === 'strategic' || SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    return isStrategic ? '전략 AI대전' : '놀이 AI대전';
}

const AI_CHALLENGE_PANEL_BOX_PX = 40;
const AI_CHALLENGE_PANEL_BOT_IMAGE_SRC = '/images/bot.webp';

/** 집계·페어 AI 패널 공통: `AI 전적 0승 0패 (0%)` */
export function formatLobbyAiRecordLine(rec: { wins: number; losses: number }): string {
    const w = Math.max(0, Math.floor(Number(rec.wins) || 0));
    const l = Math.max(0, Math.floor(Number(rec.losses) || 0));
    const g = w + l;
    const pct = g > 0 ? Math.round((w / g) * 100) : 0;
    return `AI 전적 ${w}승 ${l}패 (${pct}%)`;
}

const AiChallengePanel: React.FC<{
    mode: GameMode | 'strategic' | 'playful';
    onOpenModal: () => void;
    /** true면 바깥 `aiChallengeFeatureShellClass` 껍데기만 쓰고 내부는 콘텐츠 행만 렌더 */
    noOuterShell?: boolean;
    /** 우측 퀵 레일 등 좁은 폭: 세로 스택 */
    railLayout?: boolean;
    /** 기본: 전략「전략 AI대전」·놀이「놀이 AI대전」 */
    headingTitle?: string;
    /** 내 AI 대국 누적 전적(모드 합계). 생략 시 0승 0패(0%)로 표시 */
    aiRecord?: { wins: number; losses: number };
}> = ({ mode, onOpenModal, noOuterShell = false, railLayout = false, headingTitle, aiRecord }) => {
    const isStrategic = mode === 'strategic' || SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    const isPlayful = mode === 'playful' || PLAYFUL_GAME_MODES.some((m) => m.mode === mode);

    if (!isStrategic && !isPlayful) return null;

    const botName = resolveAiChallengeLobbyBotName(mode);
    const title = headingTitle ?? defaultHeadingForMode(mode);
    const aiRecordLineText = formatLobbyAiRecordLine(aiRecord ?? { wins: 0, losses: 0 });

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
                설정 및 시작
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
                설정 및 시작
            </Button>
        </div>
    );

    if (noOuterShell) {
        return inner;
    }

    return <div className={aiChallengePanelInnerGradientClass}>{inner}</div>;
};

export default AiChallengePanel;
