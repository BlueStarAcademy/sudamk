import React from 'react';
import { LiveGameSession, ServerAction, User, ThiefRoundSummary as ThiefRoundSummaryType } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface ThiefRoundSummaryProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const renderPlayerSummary = (summary: ThiefRoundSummaryType['player1'], user: User) => {
    const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;
    return (
        <div className="bg-gray-900/50 p-4 rounded-lg flex flex-col items-center text-center">
            <Avatar userId={user.id} userName={user.nickname} size={80} avatarUrl={avatarUrl} borderUrl={borderUrl} />
            <p className="mt-2 font-bold text-lg">{user.nickname}</p>
            <p className={`px-2 py-0.5 rounded-full text-sm font-semibold my-2 ${summary.role === 'thief' ? 'bg-yellow-600 text-black' : 'bg-blue-600 text-white'}`}>
                {summary.role === 'thief' ? '🏃 도둑' : '🚓 경찰'}
            </p>
            <div className="text-left text-sm space-y-1 w-full">
                <div className="flex justify-between">
                    <span>라운드 성과:</span>
                    <span className="font-bold">{summary.roundScore} {summary.role === 'thief' ? '개 생존' : '개 검거'}</span>
                </div>
                <div className="flex justify-between border-t border-gray-600 pt-1 mt-1 font-bold">
                    <span>누적 점수:</span>
                    <span className="font-mono text-xl text-yellow-300">{summary.cumulativeScore}점</span>
                </div>
            </div>
        </div>
    );
};

const ThiefRoundSummary: React.FC<ThiefRoundSummaryProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, thiefRoundSummary, roundEndConfirmations, revealEndTime } = session;
    const hasConfirmed = !!(roundEndConfirmations?.[currentUser.id]);

    if (!thiefRoundSummary) return null;
    
    const { round, isDeathmatch, player1: summaryP1, player2: summaryP2 } = thiefRoundSummary;

    const title = isDeathmatch ? `데스매치 ${round - 2} 종료` : `${round} 라운드 종료`;

    let description = '';
    if (isDeathmatch) {
        description = '승부가 나지 않아, 다시 역할을 정하고 데스매치를 진행합니다.';
    } else if (round < 2) {
        description = '이제 역할을 교대하여 다음 라운드를 시작합니다.';
    } else {
        description = '2라운드가 모두 종료되었습니다. 최종 점수가 같으면 데스매치를 진행합니다.';
    }

    return (
        <DraggableWindow title={title} initialWidth={550} windowId="thief-round-summary">
            <div className="text-white">
                <p className="text-center text-gray-300 mb-6">{description}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                    {renderPlayerSummary(summaryP1, player1)}
                    {renderPlayerSummary(summaryP2, player2)}
                </div>

                <Button
                    onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId }})} 
                    disabled={hasConfirmed}
                    className="w-full py-3"
                >
                    {hasConfirmed ? '상대방 확인 대기 중...' : '다음 라운드 시작'}
                </Button>
                {!session.isAiGame && revealEndTime != null && (
                    <RoundCountdownIndicator
                        deadline={revealEndTime}
                        durationSeconds={20}
                        label={isDeathmatch ? '다음 데스매치 자동 시작까지' : '다음 라운드 자동 시작까지'}
                    />
                )}
            </div>
        </DraggableWindow>
    );
};

export default ThiefRoundSummary;