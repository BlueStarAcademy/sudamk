import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

interface ThiefRoleConfirmedModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const ThiefRoleConfirmedModal: React.FC<ThiefRoleConfirmedModalProps> = ({ session, currentUser, onAction }) => {
    const { t } = useTranslation('game');
    const { t: tCommon } = useTranslation('common');
    const { t } = useTranslation('game');
    const { id: gameId, player1, player2, thiefPlayerId, policePlayerId, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = !!(preGameConfirmations?.[currentUser.id]);
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

    if (!thiefPlayerId || !policePlayerId) return null;

    const thiefPlayer = player1.id === thiefPlayerId ? player1 : player2;
    const policePlayer = player1.id === policePlayerId ? player1 : player2;

    return (
        <DraggableWindow title={t('thiefRole.title')} initialWidth={600} windowId="thief-role-confirm" transparentModalBackdrop>
            <div className="text-white">
                <PreGameColorRoulette
                    participantsInDisplayOrder={[player1, player2]}
                    blackPlayer={thiefPlayer}
                    whitePlayer={policePlayer}
                    onComplete={() => setRouletteDone(true)}
                    title={t('thiefRole.titleRich')}
                    subtitle={t('thiefRole.thiefPolice')}
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
                    onClick={() => onAction({ type: 'CONFIRM_THIEF_ROLE', payload: { gameId }})} 
                    disabled={!!hasConfirmed || !rouletteDone}
                    className="w-full py-3 mt-6"
                >
                    {hasConfirmed ? t('thiefRole.waitingConfirmEllipsis') : !rouletteDone ? t('thiefRole.checkingRouletteEllipsis') : t('startConfirm.startCountdown', { count: countdown })}
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default ThiefRoleConfirmedModal;