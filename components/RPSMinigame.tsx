
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const choiceDisplay = {
    rock: { emoji: '✊', name: '바위' },
    paper: { emoji: '🖐️', name: '보' },
    scissors: { emoji: '✌️', name: '가위' },
};

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
            case GameMode.Thief: return '역할이 겹쳤습니다! 이긴 사람이 역할을 가져갑니다.';
            case GameMode.Alkkagi:
            case GameMode.Curling:
            case GameMode.Omok:
            case GameMode.Ttamok:
                return '순서가 겹쳤습니다! 이긴 사람이 원하는 순서를 가져갑니다.';
            case GameMode.Dice:
            default: return '먼저 주사위를 굴릴 플레이어를 정합니다.';
        }
    }
    
    const getTitle = () => {
        const roundText = rpsRound ? `(${rpsRound}/3)` : '';
        return `가위바위보 ${roundText}`;
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
                    resultText = (rpsRound || 1) >= 3 ? '무승부! 랜덤으로 결정됩니다...' : '무승부! 다시 한번!';
                    resultColor = 'text-yellow-400';
                } else {
                    const myResult = (myId === player1.id && result === 'p1') || (myId === player2.id && result === 'p2');
                    if (myResult) {
                        let winMsg = '승리!';
                        if(mode === GameMode.Dice) winMsg = '승리! 선공입니다.';
                        if(mode === GameMode.Thief) winMsg = '승리! 원하는 역할을 가져갑니다.';
                        if ((mode === GameMode.Alkkagi || mode === GameMode.Curling || mode === GameMode.Omok || mode === GameMode.Ttamok) && session.turnChoices) {
                            const myTurnChoice = session.turnChoices[myId];
                            winMsg = `승리! ${myTurnChoice === 'first' ? '선공' : '후공'}으로 시작합니다.`;
                        }
                        resultText = winMsg;
                        resultColor = 'text-green-400';
                    } else {
                        let loseMsg = '패배!';
                        if(mode === GameMode.Dice) loseMsg = '패배! 후공입니다.';
                        if(mode === GameMode.Thief) loseMsg = '패배! 상대방이 역할을 선택합니다.';
                        if ((mode === GameMode.Alkkagi || mode === GameMode.Curling || mode === GameMode.Omok || mode === GameMode.Ttamok) && session.turnChoices) {
                            const opponentTurnChoice = session.turnChoices[opponent.id];
                            loseMsg = `패배! 상대가 ${opponentTurnChoice === 'first' ? '선공' : '후공'}으로 시작합니다.`;
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
                <p className="text-gray-300 mb-4">{getSubtitle()}</p>
                {rpsRound === 3 && <p className="text-sm text-yellow-300 mb-4">이번에도 비기면 랜덤으로 결정됩니다!</p>}
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