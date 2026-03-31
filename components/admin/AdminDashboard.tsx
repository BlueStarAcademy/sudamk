
import React, { useMemo, useState } from 'react';
// FIX: Import missing types from the centralized types file.
import { AdminProps, LiveGameSession, TournamentType } from '../../types/index.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';

type AdminView = 'dashboard' | 'userManagement' | 'mailSystem' | 'serverSettings' | 'homeBoard';

interface AdminDashboardProps extends Omit<AdminProps, 'onBack'> {
    onNavigate: (view: AdminView) => void;
    onBackToProfile: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onBackToProfile, liveGames, onAction, currentUser }) => {
    const [isGameManagerOpen, setIsGameManagerOpen] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState('');
    
    const activeLiveGames = liveGames.filter(game => game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest');
    const searchedLiveGames = useMemo(() => {
        const q = gameSearchQuery.trim().toLowerCase();
        if (!q) return activeLiveGames;
        return activeLiveGames.filter(game =>
            game.player1.nickname.toLowerCase().includes(q) ||
            game.player2.nickname.toLowerCase().includes(q) ||
            game.mode.toLowerCase().includes(q) ||
            game.id.toLowerCase().includes(q)
        );
    }, [activeLiveGames, gameSearchQuery]);

    const handleDeleteGame = (game: LiveGameSession) => {
        if (window.confirm(`[${game.player1.nickname} vs ${game.player2.nickname}] 대국을 강제로 종료하시겠습니까?`)) {
            onAction({ type: 'ADMIN_FORCE_DELETE_GAME', payload: { gameId: game.id } });
        }
    };

    const handleSetDescription = (game: LiveGameSession) => {
        const newDescription = prompt("방 내용을 입력하세요 (50자 이내):", game.description || "");
        if (newDescription !== null) {
            if (newDescription.length > 50) {
                alert("방 내용은 50자를 초과할 수 없습니다.");
                return;
            }
            onAction({ type: 'ADMIN_SET_GAME_DESCRIPTION', payload: { gameId: game.id, description: newDescription } });
        }
    };

    const tournamentNames: Record<TournamentType, string> = {
        neighborhood: '동네바둑리그',
        national: '전국바둑대회',
        world: '월드챔피언십'
    };

    const handleResetTournament = (tournamentType: TournamentType) => {
        const tournamentName = tournamentNames[tournamentType];
        if (window.confirm(`${tournamentName} 토너먼트를 초기화하고 새로 매칭하시겠습니까?`)) {
            onAction({ 
                type: 'ADMIN_RESET_TOURNAMENT_SESSION', 
                payload: { targetUserId: currentUser.id, tournamentType } 
            });
        }
    };

    const handleResetAllVenues = () => {
        if (window.confirm('동네바둑리그, 전국바둑대회, 월드챔피언십 모든 경기장을 한 번에 초기화하고 재매칭하시겠습니까?')) {
            onAction({ type: 'ADMIN_RESET_ALL_TOURNAMENT_SESSIONS', payload: { targetUserId: currentUser.id } });
        }
    };

    const handleResetAllUsersChampionship = () => {
        if (window.confirm('모든 유저의 동네바둑리그/전국바둑대회/월드챔피언십 단계와 챔피언십 랭킹 점수를 0으로 초기화합니다. 계속하시겠습니까?')) {
            onAction({ type: 'ADMIN_RESET_ALL_USERS_CHAMPIONSHIP' });
        }
    }

    const handleGuildWarRechargeToday = () => {
        const targetUserId = currentUser.id;
        if (window.confirm(`[${currentUser.nickname}] 님의 길드전 오늘 도전횟수를 초기화(충전)할까요?`)) {
            onAction({
                type: 'ADMIN_GUILD_WAR_RECHARGE_DAILY_ATTEMPTS',
                payload: { targetUserId },
            });
        }
    };

    return (
        <div className="bg-primary text-primary space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">관리자 대시보드</h1>
                    <p className="mt-2 text-sm text-gray-400">기능을 4개 분류로 정리했습니다. 필요한 작업은 각 분류에서 바로 이동/실행할 수 있습니다.</p>
                </div>
                <button onClick={onBackToProfile} className="p-0 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-100 active:shadow-inner active:scale-95 active:translate-y-0.5">
                    <img src="/images/button/back.png" alt="Back" className="w-10 h-10 sm:w-12 sm:h-12" />
                </button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="bg-panel border border-color p-6 rounded-lg shadow-lg text-on-panel space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-blue-300">사용자 관리</h2>
                            <p className="text-sm text-gray-400 mt-1">사용자 조회/수정, 권한 관리, 전적/챔피언십 초기화 등 계정 관련 작업을 처리합니다.</p>
                        </div>
                        <Button onClick={() => onNavigate('userManagement')} colorScheme="blue" className="shrink-0">열기</Button>
                    </div>
                    <div className="pt-4 border-t border-color">
                        <h3 className="font-semibold mb-2">빠른 실행</h3>
                        <p className="text-sm text-gray-400 mb-3">전체 유저의 챔피언십 단계를 0으로 초기화합니다.</p>
                        <Button
                            onClick={handleResetAllUsersChampionship}
                            colorScheme="red"
                            variant="outline"
                            className="w-full"
                        >
                            전체 유저 챔피언십 초기화
                        </Button>
                    </div>
                </section>

                <section className="bg-panel border border-color p-6 rounded-lg shadow-lg text-on-panel space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-green-300">우편 발송 시스템</h2>
                            <p className="text-sm text-gray-400 mt-1">전체/개별 사용자 대상 우편, 재화/아이템 첨부, 만료일 설정을 관리합니다.</p>
                        </div>
                        <Button onClick={() => onNavigate('mailSystem')} colorScheme="green" className="shrink-0">열기</Button>
                    </div>
                </section>

                <section className="bg-panel border border-color p-6 rounded-lg shadow-lg text-on-panel space-y-6 xl:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-yellow-300">서버 설정</h2>
                            <p className="text-sm text-gray-400 mt-1">공지/모드 제어와 함께 운영 테스트 기능(토너먼트, 길드전, 진행중 대국 관리)을 통합했습니다.</p>
                        </div>
                        <Button onClick={() => onNavigate('serverSettings')} colorScheme="yellow" className="shrink-0">열기</Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-secondary/30 border border-color rounded-lg p-4">
                            <h3 className="font-semibold mb-2">챔피언십 토너먼트 테스트</h3>
                            <p className="text-sm text-gray-400 mb-4">각 경기장 토너먼트를 초기화하고 새 매칭을 생성합니다.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Button onClick={() => handleResetTournament('neighborhood')} colorScheme="purple" className="w-full !text-xs">동네바둑리그</Button>
                                <Button onClick={() => handleResetTournament('national')} colorScheme="purple" className="w-full !text-xs">전국바둑대회</Button>
                                <Button onClick={() => handleResetTournament('world')} colorScheme="purple" className="w-full !text-xs">월드챔피언십</Button>
                            </div>
                            <Button onClick={handleResetAllVenues} colorScheme="purple" variant="outline" className="w-full mt-3 !text-xs">
                                모든 경기장 한번에 초기화
                            </Button>
                        </div>

                        <div className="bg-secondary/30 border border-color rounded-lg p-4">
                            <h3 className="font-semibold mb-2">길드전 도전횟수 충전(오늘)</h3>
                            <p className="text-sm text-gray-400 mb-4">테스트용으로 오늘 날짜의 내 길드전 도전횟수를 즉시 초기화합니다.</p>
                            <Button
                                onClick={handleGuildWarRechargeToday}
                                colorScheme="orange"
                                variant="outline"
                                className="w-full"
                            >
                                내 길드전 오늘 도전횟수 충전
                            </Button>
                        </div>
                    </div>

                    <div className="bg-secondary/30 border border-color rounded-lg p-4">
                        <h3 className="font-semibold mb-3">진행중인 대국 관리 ({activeLiveGames.length})</h3>
                        <p className="text-sm text-gray-400 mb-3">목록을 별도 모달에서 검색/관리할 수 있도록 분리했습니다.</p>
                        <Button onClick={() => setIsGameManagerOpen(true)} colorScheme="yellow" className="w-full sm:w-auto">
                            진행중인 대국 관리 열기
                        </Button>
                    </div>
                </section>

                <section className="bg-panel border border-color p-6 rounded-lg shadow-lg text-on-panel space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-purple-300">홈 게시판</h2>
                            <p className="text-sm text-gray-400 mt-1">홈 공지/업데이트 게시글을 작성, 수정, 삭제하고 상단 고정을 관리합니다.</p>
                        </div>
                        <Button onClick={() => onNavigate('homeBoard')} colorScheme="purple" className="shrink-0">열기</Button>
                    </div>
                </section>
            </div>
            {isGameManagerOpen && (
                <DraggableWindow
                    title={`진행중인 대국 관리 (${activeLiveGames.length})`}
                    onClose={() => setIsGameManagerOpen(false)}
                    windowId="admin-live-games-manager"
                    initialWidth={1000}
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={gameSearchQuery}
                                onChange={(e) => setGameSearchQuery(e.target.value)}
                                placeholder="플레이어/모드/게임ID 검색"
                                className="flex-1 bg-secondary border border-color text-primary rounded-lg p-2.5"
                            />
                            <span className="text-sm text-gray-400 shrink-0">결과 {searchedLiveGames.length}건</span>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-sm text-left text-secondary">
                                <thead className="text-xs text-secondary uppercase bg-secondary sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">플레이어</th>
                                        <th scope="col" className="px-4 py-3">게임 모드</th>
                                        <th scope="col" className="px-4 py-3">상태</th>
                                        <th scope="col" className="px-4 py-3">생성 시간</th>
                                        <th scope="col" className="px-4 py-3">액션</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchedLiveGames.map(game => (
                                        <tr key={game.id} className="bg-primary border-b border-color hover:bg-secondary/50">
                                            <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{game.player1.nickname} vs {game.player2.nickname}</td>
                                            <td className="px-4 py-3">{game.mode}</td>
                                            <td className="px-4 py-3">{game.gameStatus}</td>
                                            <td className="px-4 py-3">{new Date(game.createdAt).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => onAction({ type: 'SPECTATE_GAME', payload: { gameId: game.id } })} className="text-blue-400 hover:underline">관전</button>
                                                    <button onClick={() => handleSetDescription(game)} className="text-yellow-300 hover:underline">방내용</button>
                                                    <button onClick={() => handleDeleteGame(game)} className="text-red-500 hover:underline">강제 종료</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {searchedLiveGames.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400">검색 결과가 없습니다.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </DraggableWindow>
            )}
        </div>
    );
};

export default AdminDashboard;