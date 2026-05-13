
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

interface TurnPreferenceSelectionProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
    tiebreaker?: 'rps' | 'nigiri' | 'dice_roll';
}

const TurnPreferenceSelection: React.FC<TurnPreferenceSelectionProps> = (props) => {
    const { session, currentUser } = props;
    const { player1, player2, turnChoices, turnChoiceDeadline } = session;
    const isPvpPreGame = resolveArenaSessionPolicy(session).matchAxis === 'pvp';
    const [localChoice, setLocalChoice] = useState<'first' | 'second' | null>(null);

    const latestProps = useRef(props);
    useEffect(() => {
        latestProps.current = props;
    });

    const myId = currentUser.id;
    const opponent = myId === player1.id ? player2 : player1;

    const myTurnChoice = turnChoices?.[myId];

    const handleChoice = useCallback((choice: 'first' | 'second') => {
        const { session: currentSession, onAction: currentOnAction, currentUser: user } = latestProps.current;
        const myCurrentTurnChoice = currentSession.turnChoices?.[user.id];

        if (myCurrentTurnChoice) return;
        setLocalChoice(choice);
        currentOnAction({ type: 'CHOOSE_TURN_PREFERENCE', payload: { gameId: currentSession.id, choice } });
    }, []);

    useEffect(() => {
        if (myTurnChoice || localChoice || !isPvpPreGame) return;
        if (!turnChoiceDeadline) return;

        const timerId = setInterval(() => {
            if (Date.now() >= turnChoiceDeadline) {
                clearInterval(timerId);
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [myTurnChoice, localChoice, turnChoiceDeadline, isPvpPreGame]);


    const renderContent = () => {
        if (myTurnChoice || localChoice) {
            return (
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">선택 완료!</h2>
                    <p className="text-gray-300 mb-6 animate-pulse">{opponent.nickname}님의 선택을 기다리고 있습니다...</p>
                    <div className="flex justify-center items-center h-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-100"></div>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center">
                <p className="text-gray-300 mb-6">원하는 순서를 선택하세요. 순서가 같으면 룰렛으로 무작위 정해집니다.</p>
                {isPvpPreGame ? (
                    <RoundCountdownIndicator
                        deadline={turnChoiceDeadline}
                        durationSeconds={PRE_GAME_PVP_COUNTDOWN_SECONDS}
                        label="자동 선택까지"
                        labelShort="자동 선택"
                    />
                ) : null}
                <div className="flex gap-4 mt-4">
                    <Button
                        onClick={() => handleChoice('first')}
                        colorScheme="blue"
                        className="w-full py-4 text-lg"
                    >
                        선공 (흑)
                    </Button>
                    <Button
                        onClick={() => handleChoice('second')}
                        colorScheme="gray"
                        className="w-full py-4 text-lg"
                    >
                        후공 (백)
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <DraggableWindow
            title="순서 선택"
            windowId="turn-preference-selection"
            transparentModalBackdrop
            hideFooter
            skipSavedPosition
            headerShowTitle
        >
            {renderContent()}
        </DraggableWindow>
    );
};

export default TurnPreferenceSelection;