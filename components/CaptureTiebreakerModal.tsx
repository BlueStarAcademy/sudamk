import React, { useState, useEffect } from 'react';
import { LiveGameSession, Player, ServerAction, User } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface CaptureTiebreakerModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const CaptureTiebreakerModal: React.FC<CaptureTiebreakerModalProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, effectiveCaptureTargets, gameStatus, settings, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = preGameConfirmations?.[currentUser.id];
    const [countdown, setCountdown] = useState(10);
    const isTiebreaker = gameStatus === 'capture_tiebreaker';
    const [rouletteDone, setRouletteDone] = useState(() => !isTiebreaker);

    useEffect(() => {
        setRouletteDone(!isTiebreaker);
    }, [isTiebreaker, gameId]);

    useEffect(() => {
        if (!isTiebreaker) return;
        const t = window.setTimeout(() => setRouletteDone(true), 4500);
        return () => window.clearTimeout(t);
    }, [isTiebreaker, gameId]);

    useEffect(() => {
        const deadline = revealEndTime || (Date.now() + 10000);
        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCountdown(remaining);
        }, 1000);

        return () => {
            clearInterval(timerId);
        };
    }, [revealEndTime]);

    if (!blackPlayerId || !whitePlayerId || !effectiveCaptureTargets) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const blackUi = { ...blackPlayer, nickname: getSessionPlayerDisplayName(session, blackPlayer) };
    const whiteUi = { ...whitePlayer, nickname: getSessionPlayerDisplayName(session, whitePlayer) };
    const blackTarget = effectiveCaptureTargets[Player.Black];
    const whiteTarget = effectiveCaptureTargets[Player.White];

    const getTitleAndDescription = () => {
        if (isTiebreaker) {
            return {
                title: '흑백 결정 (동점 룰렛)',
                description: '두 번째 입찰에서도 동점이 되어, 룰렛으로 흑·백이 무작위 배정되었습니다.',
            };
        }

        const winnerBid = effectiveCaptureTargets[Player.Black]! - settings.captureTarget!;
        const winner = blackPlayer;
        return {
            title: '흑백 결정 완료',
            description: `${getSessionPlayerDisplayName(session, winner)}님이 ${winnerBid}개를 설정하여 흑(선)이 됩니다.`,
        };
    };

    const { title, description } = getTitleAndDescription();

    const PlayerDisplay = ({ user, color, target }: { user: User; color: '흑' | '백'; target: number | undefined }) => (
        <div className="flex flex-col items-center text-center rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <Avatar
                userId={user.id}
                userName={getSessionPlayerDisplayName(session, user)}
                size={80}
                className={`border-4 ${color === '흑' ? 'border-gray-500' : 'border-gray-400'}`}
            />
            <p className="mt-3 text-xl font-bold">{getSessionPlayerDisplayName(session, user)}</p>
            <p className={`text-lg font-semibold text-gray-300`}>
                {color}
                {color === '흑' && ' (선)'}
            </p>
            <div className="mt-2 rounded-full bg-gray-800 px-3 py-1 text-sm">
                <span className="text-gray-400">승리 조건: </span>
                <span className="font-bold text-yellow-300">{target}개</span>
                <span className="text-gray-400"> 따내기</span>
            </div>
        </div>
    );

    const showAssignmentGrid = !isTiebreaker || rouletteDone;

    return (
        <DraggableWindow title={title} initialWidth={isTiebreaker ? 680 : 550} windowId="capture-tiebreaker">
            <div className="space-y-5 text-white">
                {isTiebreaker && (
                    <PreGameColorRoulette
                        blackPlayer={blackUi}
                        whitePlayer={whiteUi}
                        durationMs={4200}
                        title="무작위로 흑·백을 정합니다"
                        subtitle="2차 입찰 동점 — 룰렛으로 선공(흑)이 정해집니다."
                        onComplete={() => setRouletteDone(true)}
                        suppressHeader
                    />
                )}

                <p className="text-center text-sm text-gray-300">{description}</p>

                {showAssignmentGrid && (
                    <div className="my-4 grid grid-cols-2 gap-4">
                        <PlayerDisplay user={blackPlayer} color="흑" target={blackTarget} />
                        <PlayerDisplay user={whitePlayer} color="백" target={whiteTarget} />
                    </div>
                )}

                <Button
                    onClick={() => onAction({ type: 'CONFIRM_CAPTURE_REVEAL', payload: { gameId } })}
                    disabled={!!hasConfirmed || (isTiebreaker && !rouletteDone)}
                    className="w-full py-3"
                >
                    {hasConfirmed
                        ? '상대방 확인 대기 중...'
                        : isTiebreaker && !rouletteDone
                          ? '룰렛 결과 확인 중...'
                          : `대국 시작 (${countdown})`}
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default CaptureTiebreakerModal;
