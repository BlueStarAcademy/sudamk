import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';
import { usePreGameDeadlineAutoSubmit } from '../hooks/usePreGameDeadlineAutoSubmit.js';

interface AlkkagiStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const AlkkagiStartConfirmationModal: React.FC<AlkkagiStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const { t } = useTranslation('game');
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = preGameConfirmations?.[currentUser.id];
    const [countdown, setCountdown] = useState(PRE_GAME_PVP_COUNTDOWN_SECONDS);
    const [rouletteDone, setRouletteDone] = useState(false);

    useEffect(() => {
        const deadline = revealEndTime || (Date.now() + PRE_GAME_PVP_COUNTDOWN_SECONDS * 1000);
        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCountdown(remaining);
        }, 1000);

        return () => clearInterval(timerId);
    }, [revealEndTime]);

    if (!blackPlayerId || !whitePlayerId) return null;
    
    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

    const handleConfirm = useCallback(() => {
        onAction({ type: 'CONFIRM_ALKKAGI_START', payload: { gameId } });
    }, [onAction, gameId]);

    usePreGameDeadlineAutoSubmit({
        deadline: revealEndTime,
        enabled: true,
        alreadySubmitted: !!hasConfirmed,
        blocking: !rouletteDone,
        onSubmit: handleConfirm,
    });

    return (
        <DraggableWindow
            title={t('startConfirm.title')}
            initialWidth={460}
            shrinkHeightToContent
            windowId="alkkagi-start-confirm"
            transparentModalBackdrop
            skipSavedPosition
            hideFooter
            headerShowTitle
            mobileViewportFit
            mobileViewportMaxHeightCss="calc(100dvh - 8px)"
            mobileViewportDvhBottomGapPx={8}
            containerExtraClassName="!max-w-[min(94vw,28.75rem)]"
        >
            <div className="text-white">
                <PreGameColorRoulette
                    participantsInDisplayOrder={[player1, player2]}
                    blackPlayer={blackPlayer}
                    whitePlayer={whitePlayer}
                    onComplete={() => setRouletteDone(true)}
                    title={t('startConfirm.rouletteDoneShort')}
                    subtitle={t('startConfirm.autoRouletteShort')}
                />
                <p className="mt-5 text-center text-sm leading-relaxed text-stone-400">
                    대국 시작을 누르거나, 30초가 지나면 자동으로 시작됩니다.
                </p>
                <RoundCountdownIndicator
                    deadline={revealEndTime}
                    durationSeconds={PRE_GAME_PVP_COUNTDOWN_SECONDS}
                    label={t('autoProceed', { ns: 'common' })}
                    labelShort={t('autoProceedShort', { ns: 'common' })}
                />

                <Button
                    onClick={handleConfirm}
                    disabled={!!hasConfirmed || !rouletteDone}
                    className="w-full py-3 mt-6"
                >
                    {hasConfirmed ? t('startConfirm.waitingConfirm') : !rouletteDone ? t('startConfirm.checkingRoulette') : t('startConfirm.startCountdown', { count: countdown })}
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default AlkkagiStartConfirmationModal;