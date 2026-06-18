import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, User, Player, RPSChoice, GameMode, GameStatus, ServerAction } from '../types.js';
import { DICE_GO_MAIN_ROLL_TIME } from '../constants';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';

interface RPSMinigameProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const choices: RPSChoice[] = ['rock', 'paper', 'scissors'];

const getResult = (p1Choice: RPSChoice, p2Choice: RPSChoice): 'p1' | 'p2' | 'draw' => {
    if (p1Choice === p2Choice) return 'draw';
    if (
        (p1Choice === 'rock' && p2Choice === 'scissors') ||
        (p1Choice === 'scissors' && p2Choice === 'paper') ||
        (p1Choice === 'paper' && p2Choice === 'rock')
    ) {
        return 'p1';
    }
    return 'p2';
};

const RPSMinigame: React.FC<RPSMinigameProps> = (props) => {
    const { t } = useTranslation('game');
    const choiceDisplay = useMemo(
        () => ({
            rock: { emoji: '✊', name: t('rps.rock') },
            paper: { emoji: '🖐️', name: t('rps.paper') },
            scissors: { emoji: '✌️', name: t('rps.scissors') },
        }),
        [t],
    );
    const { session, currentUser, onAction } = props;
    const { id: gameId, player1, player2, rpsState, gameStatus, mode, rpsRound } = session;
    const [localChoice, setLocalChoice] = useState<RPSChoice | null>(null);
    const [countdown, setCountdown] = useState(30);

    const latestProps = useRef(props);
    useEffect(() => {
        latestProps.current = props;
    });

    const myId = currentUser.id;
    const opponent = myId === player1.id ? player2 : player1;

    const myRPS = rpsState?.[myId];
    
    const handleChoice = useCallback((choice: RPSChoice) => {
        const { session: currentSession, onAction: currentOnAction, currentUser: user } = latestProps.current;
        const { id: currentGameId, rpsState: currentRpsState } = currentSession;
        const myCurrentRPS = currentRpsState?.[user.id];

        if (myCurrentRPS) return;
        setLocalChoice(choice);
        currentOnAction({ type: 'SUBMIT_RPS_CHOICE', payload: { gameId: currentGameId, choice } });
    }, []);
    
    useEffect(() => {
        const isChoosingState = gameStatus === 'dice_rps' || gameStatus === 'thief_rps' || gameStatus === 'alkkagi_rps' || gameStatus === 'curling_rps' || gameStatus === 'omok_rps' || gameStatus === 'ttamok_rps';
        if (isChoosingState) {
            setLocalChoice(null);
            setCountdown(30);
        }
    }, [gameStatus]);

    useEffect(() => {
        const isChoosing = !myRPS && !localChoice && (gameStatus === 'dice_rps' || gameStatus === 'thief_rps' || gameStatus === 'alkkagi_rps' || gameStatus === 'curling_rps' || gameStatus === 'omok_rps' || gameStatus === 'ttamok_rps');
        if (!isChoosing) return;

        const timerId = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    const randomChoice = choices[Math.floor(Math.random() * choices.length)];
                    handleChoice(randomChoice);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerId);
    }, [myRPS, localChoice, gameStatus, handleChoice]);


    const getSubtitle = () => {
        switch(mode) {
            case GameMode.Thief: return t('rps.thiefOverlap');
            case GameMode.Alkkagi:
            case GameMode.Curling:
            case GameMode.Omok:
            case GameMode.Ttamok:
                return t('rps.turnOverlap');
            case GameMode.Dice:
            default: return t('rps.diceDefault');
        }
    }
    
    const getTitle = () => {
        const roundText = rpsRound ? `(${rpsRound}/3)` : '';
        return t('rps.rpsRound', { round: roundText });
    }

    const renderContent = () => {
        const revealStatus = gameStatus.endsWith('_rps_reveal');
        if (revealStatus) {
            const p1Choice = rpsState?.[player1.id];
            const p2Choice = rpsState?.[player2.id];

            if (p1Choice && p2Choice) {
                const result = getResult(p1Choice, p2Choice);
                let resultText = '';
                let resultColor = '';
                if (result === 'draw') {
                    resultText = (rpsRound || 1) >= 3 ? t('rps.tieRandom') : t('rps.tieAgain');
                    resultColor = 'text-yellow-400';
                } else {
                    const myResult = (myId === player1.id && result === 'p1') || (myId === player2.id && result === 'p2');
                    if (myResult) {
                        let winMsg = t('rps.win');
                        if(mode === GameMode.Dice) winMsg = t('rps.winFirst');
                        if(mode === GameMode.Thief) winMsg = t('rps.winRole');
                        if ((mode === GameMode.Alkkagi || mode === GameMode.Curling || mode === GameMode.Omok || mode === GameMode.Ttamok) && session.turnChoices) {
                            const myTurnChoice = session.turnChoices[myId];
                            winMsg = t('rps.winStart', { choice: myTurnChoice === 'first' ? t('rps.firstShort') : t('rps.secondShort') });
                        }
                        resultText = winMsg;
                        resultColor = 'text-green-400';
                    } else {
                        let loseMsg = t('rps.lose');
                        if(mode === GameMode.Dice) loseMsg = t('rps.loseSecond');
                        if(mode === GameMode.Thief) loseMsg = t('rps.loseRole');
                        if ((mode === GameMode.Alkkagi || mode === GameMode.Curling || mode === GameMode.Omok || mode === GameMode.Ttamok) && session.turnChoices) {
                            const opponentTurnChoice = session.turnChoices[opponent.id];
                            loseMsg = t('rps.loseStart', { choice: opponentTurnChoice === 'first' ? t('rps.firstShort') : t('rps.secondShort') });
                        }
                        resultText = loseMsg;
                        resultColor = 'text-red-400';
                    }
                }

                return (
                    <div className="text-center">
                        <div className="flex justify-around items-center mb-6">
                            <div className="flex flex-col items-center">
                                <span className="text-lg font-semibold">{player1.nickname}</span>
                                <span className="text-7xl my-2">{choiceDisplay[p1Choice].emoji}</span>
                                <span className="text-gray-300">{choiceDisplay[p1Choice].name}</span>
                            </div>
                            <span className="text-4xl font-bold text-gray-500">VS</span>
                            <div className="flex flex-col items-center">
                                <span className="text-lg font-semibold">{player2.nickname}</span>
                                <span className="text-7xl my-2">{choiceDisplay[p2Choice].emoji}</span>
                                <span className="text-gray-300">{choiceDisplay[p2Choice].name}</span>
                            </div>
                        </div>
                        <h2 className={`text-3xl font-bold animate-pulse ${resultColor}`}>{resultText}</h2>
                    </div>
                );
            }
        }
        
        if (myRPS || localChoice) {
            return (
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">{t('rps.choiceDone')}</h2>
                    <p className="text-gray-300 mb-6 animate-pulse">{t('rps.waitingChoice', { name: opponent.nickname })}</p>
                    <div className="flex justify-center items-center h-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-100"></div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="text-center">
                <p className="text-gray-300 mb-4">{getSubtitle()}</p>
                {rpsRound === 3 && <p className="text-sm text-yellow-300 mb-4">{t('rps.tieWarning')}</p>}
                <div className="my-4 text-center">
                    <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${(countdown / 30) * 100}%`, transition: 'width 1s linear' }}></div>
                    </div>
                    <div className="text-5xl font-mono text-yellow-300">{countdown}</div>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                    {choices.map(choice => (
                        <Button
                            key={choice}
                            onClick={() => handleChoice(choice)}
                            colorScheme="gray"
                            className="w-32 h-20 text-lg"
                        >
                           <div className="flex flex-col items-center justify-center">
                             <span className="text-3xl">{choiceDisplay[choice].emoji}</span>
                             <span>{choiceDisplay[choice].name}</span>
                           </div>
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <DraggableWindow title={getTitle()} windowId="rps-minigame" hideFooter skipSavedPosition headerShowTitle>
            {renderContent()}
        </DraggableWindow>
    );
};

export default RPSMinigame;