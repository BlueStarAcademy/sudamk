import React, { useMemo, useState } from 'react';
import { LiveGameSession, TournamentType } from '../../types/index.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminPageNarrow, adminSectionGap } from './adminChrome.js';
import { ServerAction } from '../../types/index.js';
import type { User } from '../../types/index.js';

interface AdminOperationsPanelProps {
    liveGames: LiveGameSession[];
    onAction: (action: ServerAction) => void;
    onBack: () => void;
    currentUser: User;
}

type OpsMobileTab = 'ops' | 'test';

const AdminOperationsPanel: React.FC<AdminOperationsPanelProps> = ({ liveGames, onAction, onBack, currentUser }) => {
    const [isGameManagerOpen, setIsGameManagerOpen] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState('');
    const [mobileTab, setMobileTab] = useState<OpsMobileTab>('ops');

    const activeLiveGames = liveGames.filter((game) => game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest');
    const searchedLiveGames = useMemo(() => {
        const q = gameSearchQuery.trim().toLowerCase();
        if (!q) return activeLiveGames;
        return activeLiveGames.filter(
            (game) =>
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
        const newDescription = prompt('방 내용을 입력하세요 (50자 이내):', game.description || '');
        if (newDescription !== null) {
            if (newDescription.length > 50) {
                alert('방 내용은 50자를 초과할 수 없습니다.');
                return;
            }
            onAction({ type: 'ADMIN_SET_GAME_DESCRIPTION', payload: { gameId: game.id, description: newDescription } });
        }
    };

    const tournamentNames: Record<TournamentType, string> = {
        neighborhood: '동네바둑리그',
        national: '전국바둑대회',
        world: '월드챔피언십',
    };

    const handleResetTournament = (tournamentType: TournamentType) => {
        const tournamentName = tournamentNames[tournamentType];
        if (window.confirm(`${tournamentName} 토너먼트를 초기화하고 새로 매칭하시겠습니까?`)) {
            onAction({
                type: 'ADMIN_RESET_TOURNAMENT_SESSION',
                payload: { targetUserId: currentUser.id, tournamentType },
            });
        }
    };

    const handleResetAllVenues = () => {
        if (window.confirm('동네바둑리그, 전국바둑대회, 월드챔피언십 모든 경기장을 한 번에 초기화하고 재매칭하시겠습니까?')) {
            onAction({ type: 'ADMIN_RESET_ALL_TOURNAMENT_SESSIONS', payload: { targetUserId: currentUser.id } });
        }
    };

    const handleResetAllUsersChampionship = () => {
        if (
            window.confirm(
                '모든 유저의 동네바둑리그/전국바둑대회/월드챔피언십 단계와 챔피언십 랭킹 점수를 0으로 초기화합니다. 계속하시겠습니까?'
            )
        ) {
            onAction({ type: 'ADMIN_RESET_ALL_USERS_CHAMPIONSHIP' });
        }
    };

    const handleGuildWarRechargeToday = () => {
        if (window.confirm(`[${currentUser.nickname}] 님의 길드전 오늘 도전횟수를 초기화(충전)할까요?`)) {
            onAction({
                type: 'ADMIN_GUILD_WAR_RECHARGE_DAILY_ATTEMPTS',
                payload: { targetUserId: currentUser.id },
            });
        }
    };

    const sectionClass = `${adminCard} space-y-4`;

    const championshipSection = (
        <section className={sectionClass}>
            <h2 className={adminCardTitle}>챔피언십 일괄 초기화</h2>
            <p className="text-sm text-gray-400">전체 유저의 챔피언십 단계·관련 점수를 0으로 되돌립니다. 신중히 사용하세요.</p>
            <Button onClick={handleResetAllUsersChampionship} colorScheme="red" variant="outline" className="w-full sm:w-auto">
                전체 유저 챔피언십 초기화
            </Button>
        </section>
    );

    const tournamentSection = (
        <section className={sectionClass}>
            <h2 className={adminCardTitle}>챔피언십 토너먼트 (내 세션 재매칭)</h2>
            <p className="text-sm text-gray-400">관리자 계정 기준 토너먼트 세션을 초기화하고 새 매칭을 만듭니다.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button onClick={() => handleResetTournament('neighborhood')} colorScheme="purple" className="w-full !text-xs">
                    동네바둑리그
                </Button>
                <Button onClick={() => handleResetTournament('national')} colorScheme="purple" className="w-full !text-xs">
                    전국바둑대회
                </Button>
                <Button onClick={() => handleResetTournament('world')} colorScheme="purple" className="w-full !text-xs">
                    월드챔피언십
                </Button>
            </div>
            <Button onClick={handleResetAllVenues} colorScheme="purple" variant="outline" className="w-full !text-xs">
                모든 경기장 한 번에 초기화
            </Button>
        </section>
    );

    const guildWarTestSection = (
        <section className={sectionClass}>
            <h2 className={adminCardTitle}>길드전 (테스트)</h2>
            <p className="text-sm text-gray-400">오늘(KST) 길드전 개인 도전 횟수를 초기화합니다.</p>
            <Button onClick={handleGuildWarRechargeToday} colorScheme="orange" variant="outline" className="w-full sm:w-auto">
                내 길드전 오늘 도전횟수 충전
            </Button>
        </section>
    );

    const liveGamesSection = (
        <section className={sectionClass}>
            <h2 className={adminCardTitle}>진행 중인 대국 ({activeLiveGames.length})</h2>
            <p className="text-sm text-gray-400">목록은 별도 창에서 검색·강제 종료·방 설명 수정이 가능합니다.</p>
            <Button onClick={() => setIsGameManagerOpen(true)} colorScheme="yellow" className="w-full sm:w-auto">
                대국 관리 창 열기
            </Button>
        </section>
    );

    const mobileTabs: { id: OpsMobileTab; label: string }[] = [
        { id: 'ops', label: '운영' },
        { id: 'test', label: '테스트' },
    ];

    return (
        <div className={`${adminPageNarrow} ${adminSectionGap}`}>
            <AdminPageHeader
                title="운영 · 테스트 도구"
                subtitle="챔피언십·토너먼트·길드전·진행 중 대국을 이 화면에서만 조작합니다."
                onBack={onBack}
            />

            <div className="lg:hidden">
                <div
                    className="sticky top-0 z-20 -mx-1 mb-4 border-b border-color/40 bg-primary/95 px-1 pb-3 pt-0 backdrop-blur-md"
                    role="tablist"
                    aria-label="운영·테스트 구역"
                >
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                        {mobileTabs.map((tab) => {
                            const active = mobileTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setMobileTab(tab.id)}
                                    className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                                        active
                                            ? 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-inner'
                                            : 'border-color/50 bg-secondary/40 text-gray-400 hover:border-color hover:bg-secondary/60 hover:text-primary'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className={`min-h-[12rem] ${adminSectionGap}`} role="tabpanel">
                    {mobileTab === 'ops' && (
                        <>
                            {championshipSection}
                            {tournamentSection}
                            {liveGamesSection}
                        </>
                    )}
                    {mobileTab === 'test' && guildWarTestSection}
                </div>
            </div>

            <div className={`hidden lg:flex lg:flex-col ${adminSectionGap}`}>
                {championshipSection}
                {tournamentSection}
                {guildWarTestSection}
                {liveGamesSection}
            </div>

            {isGameManagerOpen && (
                <DraggableWindow
                    title={`진행 중인 대국 (${activeLiveGames.length})`}
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
                                placeholder="플레이어 / 모드 / 게임 ID 검색"
                                className="flex-1 rounded-lg border border-color bg-secondary p-2.5 text-primary"
                            />
                            <span className="shrink-0 text-sm text-gray-400">결과 {searchedLiveGames.length}건</span>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-left text-sm text-secondary">
                                <thead className="sticky top-0 bg-secondary text-xs uppercase text-secondary">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">
                                            플레이어
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            모드
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            상태
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            생성
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            액션
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchedLiveGames.map((game) => (
                                        <tr key={game.id} className="border-b border-color bg-primary hover:bg-secondary/50">
                                            <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">
                                                {game.player1.nickname} vs {game.player2.nickname}
                                            </td>
                                            <td className="px-4 py-3">{game.mode}</td>
                                            <td className="px-4 py-3">{game.gameStatus}</td>
                                            <td className="px-4 py-3">{new Date(game.createdAt).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onAction({ type: 'SPECTATE_GAME', payload: { gameId: game.id } })}
                                                        className="text-blue-400 hover:underline"
                                                    >
                                                        관전
                                                    </button>
                                                    <button type="button" onClick={() => handleSetDescription(game)} className="text-yellow-300 hover:underline">
                                                        방내용
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteGame(game)} className="text-red-500 hover:underline">
                                                        강제 종료
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {searchedLiveGames.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                                검색 결과가 없습니다.
                                            </td>
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

export default AdminOperationsPanel;
