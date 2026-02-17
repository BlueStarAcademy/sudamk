import React, { useState, useEffect } from 'react';
import { LiveGameSession, ServerAction, Player, User } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface CurlingRoundSummaryProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const CurlingRoundSummary: React.FC<CurlingRoundSummaryProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, curlingRoundSummary, player1, player2, blackPlayerId, whitePlayerId, roundEndConfirmations, isAiGame } = session;
    const [countdown, setCountdown] = useState(10);
    const hasConfirmed = !!(roundEndConfirmations?.[currentUser.id]);
    const totalRounds = session.settings.curlingRounds || 3;
    const isFinalRound = curlingRoundSummary?.round >= totalRounds;

    useEffect(() => {
        // AI 게임일 때는 카운트다운을 표시하지 않음 (무제한 대기)
        if (isAiGame) {
            setCountdown(0);
            return;
        }
        const deadline = session.revealEndTime || (Date.now() + 10000);
        const timerId = setInterval(() => {
            const remaining = Math.max(0, (deadline - Date.now()) / 1000);
            setCountdown(remaining);
        }, 50); // 더 부드러운 애니메이션을 위해 50ms마다 업데이트
        return () => clearInterval(timerId);
    }, [session.revealEndTime, isAiGame]);

    if (!curlingRoundSummary) return null;

    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;

    const blackAvatarUrl = AVATAR_POOL.find(a => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find(b => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find(a => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find(b => b.id === whitePlayer.borderId)?.url;

    const { round, black, white, cumulativeScores, stonesState, scoredStones } = curlingRoundSummary;

    const myPlayerEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;

    const boardSizePx = 840;
    const center = { x: boardSizePx / 2, y: boardSizePx / 2 };
    const cellSize = boardSizePx / 19;
    const houseRadii = [cellSize * 6, cellSize * 4, cellSize * 2, cellSize * 0.5];
    const houseColors = ['rgba(0, 100, 255, 0.2)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 0, 0, 0.2)', 'white'];

    return (
        <DraggableWindow title={`${round} 라운드 결과`} initialWidth={900} windowId="curling-round-summary">
            <div className="text-white flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/2 flex flex-col items-center flex-shrink-0">
                    <h3 className="text-xl font-bold mb-2">라운드 결과 보드</h3>
                    <div className="w-full aspect-square bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600">
                        <svg viewBox={`0 0 ${boardSizePx} ${boardSizePx}`} className="w-full h-full bg-[#DDAA77]">
                            <defs>
                                <radialGradient id={`gloss-curling-summary-1`}><stop offset="10%" stopColor="#333"/><stop offset="95%" stopColor="#000"/></radialGradient>
                                <radialGradient id={`gloss-curling-summary-2`}><stop offset="10%" stopColor="#fff"/><stop offset="95%" stopColor="#ccc"/></radialGradient>
                                <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                                    <feMerge>
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            
                            {houseRadii.map((r, i) => <circle key={i} cx={center.x} cy={center.y} r={r} fill={houseColors[i]} />)}
                            
                            {stonesState.map(stone => {
                                if (!stone.onBoard) return null;
                                const score = scoredStones[stone.id];
                                // 각 플레이어의 관점에서 돌 위치 변환 (CurlingBoard와 동일한 로직)
                                // 서버 좌표계: 백(White)은 상단(y 작음), 흑(Black)은 하단(y 큼)
                                // 화면 좌표계: 각 플레이어의 발사 영역이 화면 하단에 보임
                                const isMyStone = stone.player === myPlayerEnum;
                                const displayX = stone.x;
                                let displayY: number;
                                if (isMyStone) {
                                    // 내 돌: 내 플레이어 타입에 따라 변환
                                    if (myPlayerEnum === Player.White) {
                                        // 백 플레이어: 서버 좌표계 상단 = 화면 하단 (반전)
                                        displayY = boardSizePx - stone.y;
                                    } else {
                                        // 흑 플레이어: 서버 좌표계 하단 = 화면 하단 (그대로)
                                        displayY = stone.y;
                                    }
                                } else {
                                    // 상대방 돌: 상대방의 플레이어 타입에 따라 변환
                                    // 흑 플레이어가 볼 때: 백 돌은 서버 좌표계 상단(y 작음) = 화면 상단(y 작음) (반전 불필요)
                                    // 백 플레이어가 볼 때: 흑 돌은 서버 좌표계 하단(y 큼) = 화면 상단(y 작음) (반전 필요)
                                    if (stone.player === Player.White) {
                                        // 상대방이 백: 서버 상단 = 화면 상단 (반전 불필요)
                                        displayY = stone.y;
                                    } else {
                                        // 상대방이 흑: 서버 하단 = 화면 상단 (반전 필요)
                                        displayY = boardSizePx - stone.y;
                                    }
                                }
                                return (
                                    <g key={stone.id}>
                                        <circle cx={displayX} cy={displayY} r={stone.radius} fill={stone.player === Player.Black ? "#111827" : "#f9fafb"} />
                                        <circle cx={displayX} cy={displayY} r={stone.radius} fill={`url(#gloss-curling-summary-${stone.player})`} />
                                        {score && (
                                            <g style={{ pointerEvents: 'none' }}>
                                                <circle cx={displayX} cy={displayY} r={stone.radius} fill="none" stroke={stone.player === Player.Black ? "#67e8f9" : "#facc15"} strokeWidth="5" filter="url(#glow-effect)" />
                                                <text x={displayX} y={displayY} textAnchor="middle" dy=".35em" fontSize={stone.radius * 0.9} fontWeight="bold" fill={stone.player === Player.Black ? "white" : "black"} stroke="rgba(0,0,0,0.5)" strokeWidth="0.5px">
                                                    +{score}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>

                <div className="w-full md:w-1/2 flex-grow flex flex-col justify-center">
                    <div className="grid grid-cols-1 gap-2 my-2">
                        <div className="bg-gray-900/50 p-4 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar userId={blackPlayer.id} userName={blackPlayer.nickname} size={48} avatarUrl={blackAvatarUrl} borderUrl={blackBorderUrl} />
                                <div><p className="text-lg font-bold">{blackPlayer.nickname}</p><p className="text-sm text-gray-400">흑돌</p></div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>하우스 점수:</span> <span className="font-semibold">{black.houseScore}점</span></div>
                                <div className="flex justify-between"><span>넉아웃 점수:</span> <span className="font-semibold">{black.knockoutScore}점</span></div>
                                <div className="flex flex-col gap-1 border-t border-gray-600 pt-2 mt-2">
                                    <div className="flex justify-between text-base"><strong>라운드 합계:</strong> <strong className="text-yellow-300">{black.total}점</strong></div>
                                    {black.previousKnockoutScore !== undefined && black.previousKnockoutScore > 0 && (
                                        <div className="flex justify-between text-xs text-gray-400 ml-4">
                                            <span>이전 라운드:</span> <span>{black.previousKnockoutScore}점</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/50 p-4 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar userId={whitePlayer.id} userName={whitePlayer.nickname} size={48} avatarUrl={whiteAvatarUrl} borderUrl={whiteBorderUrl} />
                                <div><p className="text-lg font-bold">{whitePlayer.nickname}</p><p className="text-sm text-gray-400">백돌</p></div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>하우스 점수:</span> <span className="font-semibold">{white.houseScore}점</span></div>
                                <div className="flex justify-between"><span>넉아웃 점수:</span> <span className="font-semibold">{white.knockoutScore}점</span></div>
                                <div className="flex flex-col gap-1 border-t border-gray-600 pt-2 mt-2">
                                    <div className="flex justify-between text-base"><strong>라운드 합계:</strong> <strong className="text-yellow-300">{white.total}점</strong></div>
                                    {white.previousKnockoutScore !== undefined && white.previousKnockoutScore > 0 && (
                                        <div className="flex justify-between text-xs text-gray-400 ml-4">
                                            <span>이전 라운드:</span> <span>{white.previousKnockoutScore}점</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center bg-gray-700/50 p-3 rounded-lg mt-4">
                        <p className="text-lg font-bold">누적 점수</p>
                        <p className="text-2xl font-mono">
                            <span>흑 {cumulativeScores[Player.Black]}</span>
                            <span className="mx-4 text-gray-400">:</span>
                            <span>백 {cumulativeScores[Player.White]}</span>
                        </p>
                    </div>

                    {/* 카운트다운 표시 (AI 게임이 아닐 때만) */}
                    {!isAiGame && (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-300">다음 화면까지</span>
                                <span className="text-xl font-mono font-bold text-yellow-400">{Math.ceil(countdown)}초</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-full rounded-full transition-all duration-50 ease-linear"
                                    style={{ width: `${Math.max(0, Math.min(100, (countdown / 10) * 100))}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <Button 
                        onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId }})} 
                        disabled={!isAiGame && !!hasConfirmed}
                        className="w-full mt-6 py-3"
                    >
                        {isAiGame 
                            ? (isFinalRound ? '확인' : '다음 라운드 시작')
                            : hasConfirmed 
                                ? '상대방 확인 대기 중...' 
                                : (isFinalRound ? '확인' : `다음 라운드 시작 (${countdown})`)
                        }
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default CurlingRoundSummary;