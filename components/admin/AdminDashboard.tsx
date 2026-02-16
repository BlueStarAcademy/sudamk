
import React from 'react';
// FIX: Import missing types from the centralized types file.
import { AdminProps, LiveGameSession, TournamentType } from '../../types/index.js';
import Button from '../Button.js';

type AdminView = 'dashboard' | 'userManagement' | 'mailSystem' | 'serverSettings' | 'homeBoard';

interface AdminDashboardProps extends Omit<AdminProps, 'onBack'> {
    onNavigate: (view: AdminView) => void;
    onBackToProfile: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onBackToProfile, liveGames, onAction, currentUser }) => {
    
    const handleDeleteGame = (game: LiveGameSession) => {
        if (window.confirm(`[${game.player1.nickname} vs ${game.player2.nickname}] 대국을 강제로 종료하시겠습니까?`)) {
            onAction({ type: 'ADMIN_FORCE_DELETE_GAME', payload: { gameId: game.id } });
        }
    }

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

    return (
        <div className="bg-primary text-primary">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">관리자 대시보드</h1>
                <button onClick={onBackToProfile} className="p-0 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-100 active:shadow-inner active:scale-95 active:translate-y-0.5">
                    <img src="/images/button/back.png" alt="Back" className="w-10 h-10 sm:w-12 sm:h-12" />
                </button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => onNavigate('userManagement')} className="bg-blue-800/50 hover:bg-blue-700/50 p-6 rounded-lg shadow-lg cursor-pointer transition-all transform hover:-translate-y-1 border border-color">
                    <h2 className="text-2xl font-bold text-blue-300">사용자 관리</h2>
                    <p className="mt-2 text-gray-400">사용자 목록 조회, 데이터 초기화, 계정 삭제 등을 수행합니다.</p>
                </div>
                <div onClick={() => onNavigate('mailSystem')} className="bg-green-800/50 hover:bg-green-700/50 p-6 rounded-lg shadow-lg cursor-pointer transition-all transform hover:-translate-y-1 border border-color">
                    <h2 className="text-2xl font-bold text-green-300">우편 발송 시스템</h2>
                    <p className="mt-2 text-gray-400">전체 또는 특정 사용자에게 재화와 메시지를 보냅니다.</p>
                </div>
                <div onClick={() => onNavigate('serverSettings')} className="bg-yellow-800/50 hover:bg-yellow-700/50 p-6 rounded-lg shadow-lg cursor-pointer transition-all transform hover:-translate-y-1 border border-color">
                    <h2 className="text-2xl font-bold text-yellow-300">서버 설정</h2>
                    <p className="mt-2 text-gray-400">공지사항, 게임 모드 활성화 등 서버 전체 설정을 관리합니다.</p>
                </div>
                <div onClick={() => onNavigate('homeBoard')} className="bg-purple-800/50 hover:bg-purple-700/50 p-6 rounded-lg shadow-lg cursor-pointer transition-all transform hover:-translate-y-1 border border-color">
                    <h2 className="text-2xl font-bold text-purple-300">홈 게시판</h2>
                    <p className="mt-2 text-gray-400">홈 화면에 표시되는 공지사항과 업데이트 내역을 관리합니다.</p>
                </div>
            </div>

            <div className="mt-8 bg-panel border border-color p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 border-b border-color pb-2 text-on-panel">챔피언십 토너먼트 테스트</h2>
                <p className="text-sm text-gray-400 mb-4">각 경기장의 토너먼트를 초기화하고 새로운 매칭을 생성하여 테스트할 수 있습니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                        onClick={() => handleResetTournament('neighborhood')} 
                        colorScheme="purple" 
                        className="w-full"
                    >
                        동네바둑리그 재매칭
                    </Button>
                    <Button 
                        onClick={() => handleResetTournament('national')} 
                        colorScheme="purple" 
                        className="w-full"
                    >
                        전국바둑대회 재매칭
                    </Button>
                    <Button 
                        onClick={() => handleResetTournament('world')} 
                        colorScheme="purple" 
                        className="w-full"
                    >
                        월드챔피언십 재매칭
                    </Button>
                </div>
                <div className="mt-4">
                    <Button 
                        onClick={handleResetAllVenues} 
                        colorScheme="purple" 
                        variant="outline"
                        className="w-full"
                    >
                        한번에 모든 경기장 초기화 (동네+전국+월드)
                    </Button>
                </div>
            </div>

            <div className="mt-8 bg-panel border border-color p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 border-b border-color pb-2 text-on-panel">전체 유저 챔피언십 초기화</h2>
                <p className="text-sm text-gray-400 mb-4">모든 유저의 동네바둑리그·전국바둑대회·월드챔피언십 단계와 챔피언십 랭킹 점수를 0으로 초기화합니다.</p>
                <Button 
                    onClick={handleResetAllUsersChampionship} 
                    colorScheme="red" 
                    variant="outline"
                    className="w-full"
                >
                    전체 유저 챔피언십 초기화
                </Button>
            </div>

            <div className="mt-8 bg-panel border border-color p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 border-b border-color pb-2 text-on-panel">진행중인 대국 ({liveGames.length})</h2>
                <div className="max-h-[40vh] overflow-y-auto">
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
                            {liveGames.map(game => (
                                <tr key={game.id} className="bg-primary border-b border-color hover:bg-secondary/50">
                                    <td className="px-4 py-4 font-medium text-primary whitespace-nowrap">{game.player1.nickname} vs {game.player2.nickname}</td>
                                    <td className="px-4 py-4">{game.mode}</td>
                                    <td className="px-4 py-4">{game.gameStatus}</td>
                                    <td className="px-4 py-4">{new Date(game.createdAt).toLocaleString()}</td>
                                    <td className="px-4 py-4">
                                        <button onClick={() => handleDeleteGame(game)} className="font-medium text-red-500 hover:underline">강제 종료</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;