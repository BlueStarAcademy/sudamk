import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import { GuildWar, GuildWarBoard, User } from '../../types/index.js';

interface Board {
    id: string;
    name: string;
    myStars: number;
    opponentStars: number;
    boardSize: number;
    highestScorer?: string;
    scoreDiff?: number;
    initialStones?: { black: number; white: number };
    ownerGuildId?: string; // 점령한 길드 ID
    gameMode?: 'capture' | 'hidden' | 'missile';
}

const GuildWar = () => {
    const { currentUserWithStatus, guilds, handlers, allUsers } = useAppContext();
    const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
    const [activeWar, setActiveWar] = useState<GuildWar | null>(null);
    const [myGuild, setMyGuild] = useState<any>(null);
    const [opponentGuild, setOpponentGuild] = useState<any>(null);
    const [boards, setBoards] = useState<Board[]>([]);
    const [myMembersChallenging, setMyMembersChallenging] = useState<{ name: string, board: string }[]>([]);
    const [opponentMembersChallenging, setOpponentMembersChallenging] = useState<{ name: string, board: string }[]>([]);
    const [myDailyAttempts, setMyDailyAttempts] = useState(0);
    const [opponentDailyAttempts, setOpponentDailyAttempts] = useState(0);
    const [remainingTime, setRemainingTime] = useState<string>('');

    // 길드전 데이터 가져오기
    useEffect(() => {
        const fetchWarData = async () => {
            if (!currentUserWithStatus?.guildId) return;
            
            try {
                const result = await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' }) as any;
                if (result?.error) {
                    console.error('[GuildWar] Failed to fetch war data:', result.error);
                    return;
                }
                
                const war = result?.clientResponse?.activeWar;
                const guildsData = result?.clientResponse?.guilds || guilds;
                
                if (!war) {
                    // 활성 길드전이 없음
                    setActiveWar(null);
                    return;
                }
                
                setActiveWar(war);
                
                // 내 길드와 상대 길드 정보
                const myGuildId = currentUserWithStatus.guildId;
                const myGuildData = guildsData[myGuildId];
                const opponentGuildId = war.guild1Id === myGuildId ? war.guild2Id : war.guild1Id;
                const opponentGuildData = guildsData[opponentGuildId];
                
                setMyGuild(myGuildData);
                setOpponentGuild(opponentGuildData);
                
                // 바둑판 데이터 변환
                const boardNames: Record<string, string> = {
                    'top-left': '좌상귀',
                    'top-mid': '상변',
                    'top-right': '우상귀',
                    'mid-left': '좌변',
                    'center': '중앙',
                    'mid-right': '우변',
                    'bottom-left': '좌하귀',
                    'bottom-mid': '하변',
                    'bottom-right': '우하귀',
                };
                
                const convertedBoards: Board[] = Object.entries(war.boards || {}).map(([boardId, board]: [string, any]) => {
                    const isGuild1 = war.guild1Id === myGuildId;
                    const myStars = isGuild1 ? (board.guild1Stars || 0) : (board.guild2Stars || 0);
                    const opponentStars = isGuild1 ? (board.guild2Stars || 0) : (board.guild1Stars || 0);
                    const myBestResult = isGuild1 ? board.guild1BestResult : board.guild2BestResult;
                    const opponentBestResult = isGuild1 ? board.guild2BestResult : board.guild1BestResult;
                    
                    // 점령자 결정
                    let ownerGuildId: string | undefined = undefined;
                    if (board.guild1BestResult && board.guild2BestResult) {
                        // 별 개수 비교
                        if (board.guild1BestResult.stars > board.guild2BestResult.stars) {
                            ownerGuildId = war.guild1Id;
                        } else if (board.guild2BestResult.stars > board.guild1BestResult.stars) {
                            ownerGuildId = war.guild2Id;
                        } else {
                            // 따낸 돌 비교
                            if (board.guild1BestResult.captures > board.guild2BestResult.captures) {
                                ownerGuildId = war.guild1Id;
                            } else if (board.guild2BestResult.captures > board.guild1BestResult.captures) {
                                ownerGuildId = war.guild2Id;
                            } else {
                                // 집 차이 비교
                                if (board.guild1BestResult.scoreDiff !== undefined && board.guild2BestResult.scoreDiff !== undefined) {
                                    if (board.guild1BestResult.scoreDiff > board.guild2BestResult.scoreDiff) {
                                        ownerGuildId = war.guild1Id;
                                    } else if (board.guild2BestResult.scoreDiff > board.guild1BestResult.scoreDiff) {
                                        ownerGuildId = war.guild2Id;
                                    }
                                }
                                // 먼저 도전 성공한 사람
                                if (!ownerGuildId) {
                                    ownerGuildId = board.guild1BestResult.completedAt < board.guild2BestResult.completedAt 
                                        ? war.guild1Id : war.guild2Id;
                                }
                            }
                        }
                    } else if (board.guild1BestResult) {
                        ownerGuildId = war.guild1Id;
                    } else if (board.guild2BestResult) {
                        ownerGuildId = war.guild2Id;
                    }
                    
                    const bestResult = myBestResult || opponentBestResult;
                    const userMap = new Map(allUsers.map(u => [u.id, u]));
                    const bestUser = bestResult ? userMap.get(bestResult.userId) : null;
                    
                    return {
                        id: boardId,
                        name: boardNames[boardId] || boardId,
                        myStars,
                        opponentStars,
                        boardSize: board.boardSize || 13,
                        highestScorer: bestUser?.nickname,
                        scoreDiff: bestResult?.scoreDiff,
                        initialStones: board.initialStones?.[0] || { black: 0, white: 0 },
                        ownerGuildId,
                        gameMode: board.gameMode,
                    };
                });
                
                setBoards(convertedBoards);
                
                // 도전 중인 멤버 정보
                const userMap = new Map(allUsers.map(u => [u.id, u]));
                const myChallengers: { name: string, board: string }[] = [];
                const opponentChallengers: { name: string, board: string }[] = [];
                
                Object.entries(war.boards || {}).forEach(([boardId, board]: [string, any]) => {
                    const boardName = boardNames[boardId] || boardId;
                    const isGuild1 = war.guild1Id === myGuildId;
                    const myChallengerIds = isGuild1 ? board.guild1Challengers : board.guild2Challengers;
                    const opponentChallengerIds = isGuild1 ? board.guild2Challengers : board.guild1Challengers;
                    
                    myChallengerIds?.forEach((userId: string) => {
                        const user = userMap.get(userId);
                        if (user) {
                            myChallengers.push({ name: user.nickname, board: boardName });
                        }
                    });
                    
                    opponentChallengerIds?.forEach((userId: string) => {
                        const user = userMap.get(userId);
                        if (user) {
                            opponentChallengers.push({ name: user.nickname, board: boardName });
                        }
                    });
                });
                
                setMyMembersChallenging(myChallengers);
                setOpponentMembersChallenging(opponentChallengers);
                
                // 하루 도전 횟수 계산
                const today = new Date().toISOString().split('T')[0];
                const myAttempts = war.dailyAttempts?.[currentUserWithStatus.id]?.[today] || 0;
                setMyDailyAttempts(myAttempts);
                
                // 상대 길드의 총 도전 횟수 계산 (모든 멤버 합산)
                const opponentGuildMembers = opponentGuildData?.members || [];
                const opponentTotalAttempts = opponentGuildMembers.reduce((sum: number, member: any) => {
                    const attempts = war.dailyAttempts?.[member.userId]?.[today] || 0;
                    return sum + attempts;
                }, 0);
                setOpponentDailyAttempts(opponentTotalAttempts);
                
                // 남은 시간 계산
                if (war.endTime) {
                    const updateRemainingTime = () => {
                        const now = Date.now();
                        const remaining = war.endTime! - now;
                        if (remaining <= 0) {
                            setRemainingTime('종료됨');
                            return;
                        }
                        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
                        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                        setRemainingTime(`${days}일 ${hours}시간`);
                    };
                    updateRemainingTime();
                    const interval = setInterval(updateRemainingTime, 60000); // 1분마다 업데이트
                    return () => clearInterval(interval);
                }
            } catch (error) {
                console.error('[GuildWar] Error fetching war data:', error);
            }
        };
        
        fetchWarData();
    }, [currentUserWithStatus?.guildId, handlers, guilds, allUsers]);
    
    // 바둑판 클릭 시 도전
    const handleBoardClick = async (board: Board) => {
        if (!activeWar || !currentUserWithStatus?.guildId) return;
        
        // 하루 도전 횟수 확인
        if (myDailyAttempts >= 3) {
            alert('오늘 도전 횟수를 모두 사용했습니다. (하루 3회)');
            return;
        }
        
        try {
            const result = await handlers.handleAction({ 
                type: 'START_GUILD_WAR_GAME', 
                payload: { boardId: board.id } 
            }) as any;
            
            if (result?.error) {
                alert(result.error);
            } else {
                // 게임 시작 성공 - 게임 화면으로 이동
                if (result?.clientResponse?.gameId) {
                    window.location.hash = `#/game/${result.clientResponse.gameId}`;
                }
            }
        } catch (error) {
            console.error('[GuildWar] Failed to start game:', error);
            alert('게임 시작에 실패했습니다.');
        }
    };
    
    // 활성 길드전이 없을 때
    if (!activeWar || !myGuild || !opponentGuild) {
        return (
            <div className="h-full w-full flex flex-col bg-tertiary text-primary p-4 bg-cover bg-center" style={{ backgroundImage: "url('/images/guild/guildwar/warmap.png')" }}>
                <header className="flex justify-between items-center mb-4 flex-shrink-0">
                    <BackButton onClick={() => window.location.hash = '#/guild'} />
                    <h1 className="text-3xl font-bold text-white" style={{textShadow: '2px 2px 5px black'}}>길드 전쟁</h1>
                </header>
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center text-white" style={{textShadow: '2px 2px 4px black'}}>
                        <p className="text-2xl font-bold mb-4">진행 중인 길드전이 없습니다.</p>
                        <p className="text-lg">다음 매칭을 기다려주세요.</p>
                    </div>
                </main>
            </div>
        );
    }

    const StarDisplay = ({ count, total = 3, size = 'w-6 h-6' }: { count: number, total?: number, size?: string }) => {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push(<img key={`filled-${i}`} src="/images/guild/guildwar/clearstar.png" alt="filled star" className={size} />);
        }
        for (let i = count; i < total; i++) {
            stars.push(<img key={`empty-${i}`} src="/images/guild/guildwar/emptystar.png" alt="empty star" className={size} />);
        }
        return <div className="flex justify-center">{stars}</div>;
    };
    
    // 총 별 개수 계산
    const totalMyStars = boards.reduce((sum, b) => sum + b.myStars, 0);
    const totalOpponentStars = boards.reduce((sum, b) => sum + b.opponentStars, 0);
    const totalStars = totalMyStars + totalOpponentStars;
    const myStarPercent = totalStars > 0 ? (totalMyStars / totalStars) * 100 : 50;
    
    // 총 점수 계산 (별 개수로 대체)
    const myTotalScore = totalMyStars;
    const opponentTotalScore = totalOpponentStars;

    const StatusAndViewerPanel: React.FC<{
        team: 'blue' | 'red';
        challengingMembers: { name: string, board: string }[];
        usedTickets: number;
        totalTickets: number;
        board: Board | null;
    }> = ({ team, challengingMembers, usedTickets, totalTickets, board }) => {
        const isBlue = team === 'blue';
        const panelClasses = isBlue ? 'bg-blue-900/50 border-blue-700' : 'bg-red-900/50 border-red-700';
        const textClasses = isBlue ? 'text-blue-300' : 'text-red-300';
        const secondaryTextClasses = isBlue ? 'text-blue-200' : 'text-red-200';

        return (
            <div className={`h-full w-full flex flex-col gap-4 ${panelClasses} border-2 rounded-lg p-4`}>
                <div className="h-1/2 flex flex-col border-b-2 border-gray-500/50 pb-2">
                    <h2 className={`text-xl font-bold text-center ${textClasses} pb-2 mb-2`}>상황판</h2>
                    <div className="space-y-3">
                         <div>
                            <h3 className={`font-semibold ${secondaryTextClasses}`}>사용된 도전권</h3>
                            <p className="text-lg">{usedTickets} / {totalTickets}</p>
                        </div>
                        <div>
                            <h3 className={`font-semibold ${secondaryTextClasses}`}>점령중인 길드원</h3>
                            <ul className="text-sm list-disc list-inside pl-2">
                                {challengingMembers.map((m, i) => <li key={i}>{m.name} - {m.board}</li>)}
                                {challengingMembers.length === 0 && <p className="text-xs text-gray-400">없음</p>}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="h-1/2 flex flex-col pt-2">
                    <h2 className={`text-xl font-bold text-center ${textClasses} pb-2 mb-2`}>상세 정보</h2>
                    <div className="flex-grow bg-black/30 rounded-md p-3 text-xs flex flex-col justify-center items-center">
                        {board ? (
                            <div className="space-y-1 text-left w-full">
                                <p><strong>맵:</strong> {board.name} ({board.boardSize}줄)</p>
                                <p><strong>게임 모드:</strong> {
                                    board.gameMode === 'capture' ? '따내기 바둑' :
                                    board.gameMode === 'hidden' ? '히든 바둑' :
                                    board.gameMode === 'missile' ? '미사일 바둑' : '알 수 없음'
                                }</p>
                                <p><strong>초기 배치:</strong> 흑 {board.initialStones?.black || 0} / 백 {board.initialStones?.white || 0}</p>
                                <p><strong>현재 점령자:</strong> {board.highestScorer || '없음'}</p>
                                {board.highestScorer && board.scoreDiff !== undefined && (
                                    <p><strong>점수 차이:</strong> {board.scoreDiff}집</p>
                                )}
                                {board.highestScorer && (
                                    <p><strong>별 개수:</strong> 내 길드 {board.myStars} / 상대 {board.opponentStars}</p>
                                )}
                                {team === 'blue' && (
                                    <button
                                        onClick={() => handleBoardClick(board)}
                                        disabled={myDailyAttempts >= 3}
                                        className={`mt-2 w-full py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                                            myDailyAttempts >= 3
                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]'
                                        }`}
                                    >
                                        {myDailyAttempts >= 3 ? '도전 횟수 소진' : '도전하기'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-tertiary">바둑판을 선택하여<br/>정보를 확인하세요.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full flex flex-col bg-tertiary text-primary p-4 bg-cover bg-center" style={{ backgroundImage: "url('/images/guild/guildwar/warmap.png')" }}>
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                 <BackButton onClick={() => window.location.hash = '#/guild'} />
                <h1 className="text-3xl font-bold text-white" style={{textShadow: '2px 2px 5px black'}}>길드 전쟁</h1>
                 <div className="w-40 text-right">
                    <p className="text-sm text-white font-semibold" style={{textShadow: '1px 1px 3px black'}}>
                        {remainingTime || '계산 중...'}
                    </p>
                </div>
            </header>
            <main className="flex-1 grid grid-cols-5 gap-4 min-h-0">
                {/* Left Panel */}
                <div className="col-span-1">
                    <StatusAndViewerPanel
                        team="blue"
                        challengingMembers={myMembersChallenging}
                        usedTickets={myDailyAttempts}
                        totalTickets={3}
                        board={selectedBoard}
                    />
                </div>

                {/* Center Panel */}
                <div className="col-span-3 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col items-center">
                            <div className="relative w-20 h-28">
                                <img src="/images/guild/guildwar/blueteam.png" alt="Blue Team Flag" className="w-full h-full" />
                                <img src={myGuild.icon || myGuild.emblem || '/images/guild/profile/icon1.png'} alt="My Guild Emblem" className="absolute top-6 left-4 w-12 h-12 object-contain" />
                            </div>
                            <div className="bg-black/60 px-3 py-1 rounded-md -mt-5 z-10 shadow-lg">
                                <span className="font-bold text-white">{myGuild.name}</span>
                            </div>
                        </div>
                        
                        <div className="flex-1 mx-4 flex flex-col items-center gap-1 -translate-y-2">
                             <div className="flex items-center justify-center w-full gap-4 text-white" style={{ textShadow: '2px 2px 4px black' }}>
                                <span className="text-5xl font-black">{totalMyStars}</span>
                                <img src="/images/guild/guildwar/clearstar.png" alt="star" className="w-10 h-10" />
                                <span className="text-5xl font-black text-gray-400">:</span>
                                <img src="/images/guild/guildwar/clearstar.png" alt="star" className="w-10 h-10" />
                                <span className="text-5xl font-black">{totalOpponentStars}</span>
                            </div>
                            
                            <div className="w-full h-4 bg-red-700/80 rounded-full flex relative border-2 border-black/50 shadow-inner mt-1">
                                <div className="h-full bg-blue-500/90 rounded-full" style={{ width: `${myStarPercent}%`, transition: 'width 0.5s ease-in-out' }}></div>
                            </div>

                            <div className="flex items-center justify-between w-full text-xs font-semibold text-white mt-1" style={{ textShadow: '1px 1px 2px black' }}>
                                <span>별 합계: {totalMyStars}</span>
                                <span>별 합계: {totalOpponentStars}</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className="relative w-20 h-28">
                                <img src="/images/guild/guildwar/redteam.png" alt="Red Team Flag" className="w-full h-full" />
                                <img src={opponentGuild.icon || opponentGuild.emblem || '/images/guild/profile/icon1.png'} alt="Opponent Guild Emblem" className="absolute top-6 left-4 w-12 h-12 object-contain" />
                            </div>
                             <div className="bg-black/60 px-3 py-1 rounded-md -mt-5 z-10 shadow-lg">
                                <span className="font-bold text-white">{opponentGuild.name}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-x-8 gap-y-4">
                        {boards.map(board => {
                            // 점령 상태 결정: ownerGuildId가 있으면 사용, 없으면 별 개수 비교
                            let ownerGuildId: string | undefined = board.ownerGuildId;
                            if (!ownerGuildId) {
                                if (board.myStars > board.opponentStars) {
                                    ownerGuildId = myGuild.id;
                                } else if (board.opponentStars > board.myStars) {
                                    ownerGuildId = opponentGuild.id;
                                }
                            }
                            
                            const isMyGuildOccupied = ownerGuildId === myGuild.id;
                            const isOpponentOccupied = ownerGuildId === opponentGuild.id;
                            
                            const isSelected = selectedBoard?.id === board.id;
                            
                            return (
                                <div key={board.id} className={`relative flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${isSelected ? 'scale-110' : 'hover:scale-105'}`} 
                                    onClick={() => setSelectedBoard(board)}>
                                    <StarDisplay count={board.myStars} size="w-5 h-5"/>
                                    <div className="relative flex items-center justify-center">
                                        {/* 좌측 파란 깃발 */}
                                        {isMyGuildOccupied && (
                                            <img 
                                                src="/images/guild/guildwar/blueflag.png" 
                                                alt="Blue Flag" 
                                                className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-8 h-8 z-10" 
                                            />
                                        )}
                                        <img 
                                            src="/images/guild/guildwar/board.png" 
                                            alt="Go Board" 
                                            className={`w-24 h-24 ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}
                                        />
                                        {/* 우측 빨간 깃발 */}
                                        {isOpponentOccupied && (
                                            <img 
                                                src="/images/guild/guildwar/redflag.png" 
                                                alt="Red Flag" 
                                                className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2 w-8 h-8 z-10" 
                                            />
                                        )}
                                    </div>
                                    <span className="bg-black/60 px-2 py-0.5 rounded-md text-sm font-semibold -mt-2">{board.name}</span>
                                    <StarDisplay count={board.opponentStars} size="w-5 h-5"/>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel */}
                <div className="col-span-1">
                     <StatusAndViewerPanel
                        team="red"
                        challengingMembers={opponentMembersChallenging}
                        usedTickets={opponentDailyAttempts}
                        totalTickets={3}
                        board={selectedBoard}
                    />
                </div>
            </main>
        </div>
    );
};

export default GuildWar;
