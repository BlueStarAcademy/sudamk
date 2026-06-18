import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, Player } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { UNIFORM_COLOR_ROULETTE_MS } from '../shared/utils/uniformGoRules.js';

interface UniformColorRouletteModalProps {
    session: LiveGameSession;
}

const ROULETTE_TICK_MS = 110;

/** PVP 일색 바둑: 흑·백 확정 후 보드에 표시할 단일 돌 색 룰렛 */
const UniformColorRouletteModal: React.FC<UniformColorRouletteModalProps> = ({ session }) => {
    const { t } = useTranslation('game');
    const target = session.uniformStoneDisplayColor ?? Player.Black;
    const [activeColor, setActiveColor] = useState<Player>(Player.Black);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        setIsFinished(false);
        setActiveColor(Player.Black);
        const colors: Player[] = [Player.Black, Player.White];
        let tick = 0;
        const timerId = window.setInterval(() => {
            tick += 1;
            setActiveColor(colors[tick % colors.length]!);
        }, ROULETTE_TICK_MS);

        const finishId = window.setTimeout(() => {
            window.clearInterval(timerId);
            setActiveColor(target);
            setIsFinished(true);
        }, UNIFORM_COLOR_ROULETTE_MS);

        return () => {
            window.clearInterval(timerId);
            window.clearTimeout(finishId);
        };
    }, [target, session.id]);

    const resultColor = isFinished ? target : activeColor;
    const resultLabel = resultColor === Player.Black ? t('uniformColor.blackStone') : t('uniformColor.whiteStone');

    return (
        <DraggableWindow
            title={t('uniformColor.title')}
            windowId="uniform-color-roulette"
            initialWidth={400}
            shrinkHeightToContent
            modal={false}
            hideFooter
            headerShowTitle
            defaultPosition={{ x: 12, y: 88 }}
            bodyPaddingClassName="p-3 sm:p-4"
            bodyNoScroll
            containerExtraClassName="!max-w-[min(100vw,440px)]"
        >
            <div className="text-white">
                <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-zinc-900/[0.97] via-zinc-950/[0.99] to-black/[0.92] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_48px_-20px_rgba(0,0,0,0.75)] sm:p-5">
                    <div className="mb-4 border-b border-amber-500/10 pb-4 text-center sm:mb-5 sm:pb-5">
                        <p className="text-base font-bold tracking-tight text-amber-50/95 sm:text-lg">{t('uniformColor.stoneColorRoulette')}</p>
                        <p className="mt-2 text-xs leading-relaxed text-stone-400 sm:text-sm">
                            이번 대국에서는 모든 돌이 아래 색으로 보입니다. (실제 흑·백 규칙은 그대로 적용됩니다)
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div
                            className={`relative flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-xl border-2 border-amber-400/45 bg-gradient-to-b from-zinc-900/95 to-black/90 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)] transition-colors duration-100 ${
                                isFinished ? 'ring-2 ring-emerald-400/40' : ''
                            }`}
                        >
                            <div
                                className={`flex h-full w-full flex-col items-center justify-center rounded-[10px] text-2xl font-black sm:text-3xl ${
                                    resultColor === Player.Black
                                        ? 'border border-stone-500 bg-black text-white'
                                        : 'border border-stone-300 bg-white text-zinc-900'
                                }`}
                            >
                                {resultLabel}
                            </div>
                        </div>
                        <p
                            className={`max-w-md text-center text-xs font-semibold leading-snug sm:text-sm ${
                                isFinished ? 'text-emerald-200/90' : 'animate-pulse text-amber-200/90'
                            }`}
                        >
                            {isFinished
                                ? t('uniformColor.thisColor', { color: resultLabel })
                                : t('uniformColor.flashHintAlt')}
                        </p>
                    </div>
                </div>
                <p className="mt-3 text-center text-xs leading-relaxed text-stone-300">{t('uniformColor.autoStartAfterEffect')}</p>
            </div>
        </DraggableWindow>
    );
};

export default UniformColorRouletteModal;
