import React from 'react';
import { GameMode } from '../../types.js';
import Avatar from '../Avatar.js';
import Button from '../Button.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, aiUserId } from '../../constants.js';

const AiChallengePanel: React.FC<{
    mode: GameMode | 'strategic' | 'playful';
    onOpenModal: () => void;
    /** 네이티브 전략·놀이 대기실: 페어 경기장 모바일과 동일한 글자 크기 */
    pairAlignedTypography?: boolean;
}> = ({ mode, onOpenModal, pairAlignedTypography = false }) => {
    const isStrategic = mode === 'strategic' || SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    const isPlayful = mode === 'playful' || PLAYFUL_GAME_MODES.some((m) => m.mode === mode);

    if (!isStrategic && !isPlayful) return null;

    const botName = mode === 'strategic' ? '전략바둑 AI' : '놀이바둑 AI';

    return (
        <div
            className={`rounded-xl border border-fuchsia-400/45 bg-gradient-to-r from-fuchsia-950/55 via-purple-950/55 to-indigo-950/55 shadow-[0_14px_32px_rgba(192,38,211,0.3)] ring-1 ring-fuchsia-300/20 ${
                pairAlignedTypography ? 'p-2' : 'p-3'
            }`}
        >
            <div className={`flex items-center justify-between gap-2 sm:gap-3 ${pairAlignedTypography ? 'min-h-[52px]' : 'min-h-[58px]'}`}>
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <Avatar
                        userId={aiUserId}
                        userName="AI"
                        size={pairAlignedTypography ? 32 : 40}
                        className="border-2 border-fuchsia-400/80 shadow-[0_0_14px_rgba(217,70,239,0.5)]"
                    />
                    <div className="min-w-0">
                        <h3
                            className={`truncate font-extrabold tracking-tight text-fuchsia-100 drop-shadow-[0_0_10px_rgba(217,70,239,0.35)] ${
                                pairAlignedTypography ? 'text-sm sm:text-base' : 'text-base'
                            }`}
                        >
                            AI와 대결하기
                        </h3>
                        <p
                            className={`truncate font-medium text-fuchsia-200/90 ${
                                pairAlignedTypography ? 'text-[0.65rem] sm:text-xs' : 'text-xs'
                            }`}
                        >
                            {botName}와 즉시 대국 시작
                        </p>
                    </div>
                </div>
                <Button
                    onClick={onOpenModal}
                    colorScheme="purple"
                    className={
                        pairAlignedTypography
                            ? '!px-2.5 !py-1.5 !text-[0.65rem] !font-bold shadow-[0_6px_16px_rgba(139,92,246,0.45)] sm:!text-xs'
                            : '!px-3.5 !py-2 !text-sm !font-bold shadow-[0_6px_16px_rgba(139,92,246,0.45)]'
                    }
                >
                    설정 및 시작
                </Button>
            </div>
        </div>
    );
};

export default AiChallengePanel;
