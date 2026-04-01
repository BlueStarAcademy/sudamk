
import React from 'react';
import { LiveGameSession } from '../../types/index.js';

export type AdminView = 'dashboard' | 'userManagement' | 'mailSystem' | 'serverSettings' | 'homeBoard' | 'operations';

interface AdminDashboardProps {
    onNavigate: (view: AdminView) => void;
    onBackToProfile: () => void;
    liveGames: LiveGameSession[];
}

type TileDef = {
    view: Exclude<AdminView, 'dashboard'>;
    title: string;
    description: string;
    icon: string;
    accent: string;
    ringHover: string;
};

const TILES: TileDef[] = [
    {
        view: 'userManagement',
        title: '사용자 관리',
        description: '검색·계정 수정, 보상 우편 연동, 인벤·장비, 권한 및 전적 관련 작업',
        icon: '👤',
        accent: 'from-blue-500/20 to-blue-600/5',
        ringHover: 'hover:ring-blue-400/40',
    },
    {
        view: 'mailSystem',
        title: '우편 발송',
        description: '전체 또는 지정 수신자에게 골드·다이아·아이템 우편 발송',
        icon: '✉️',
        accent: 'from-emerald-500/20 to-emerald-600/5',
        ringHover: 'hover:ring-emerald-400/40',
    },
    {
        view: 'serverSettings',
        title: '서버 설정',
        description: '대기실 공지, 게임 모드 on/off, 긴급 공지, KataGo 상태',
        icon: '🖥️',
        accent: 'from-amber-500/20 to-amber-600/5',
        ringHover: 'hover:ring-amber-400/40',
    },
    {
        view: 'operations',
        title: '운영 · 테스트',
        description: '챔피언십·토너먼트 초기화, 길드전 충전, 진행 중 대국 관리',
        icon: '🛠️',
        accent: 'from-violet-500/20 to-violet-600/5',
        ringHover: 'hover:ring-violet-400/40',
    },
    {
        view: 'homeBoard',
        title: '홈 게시판',
        description: '홈 공지·업데이트 글 작성, 고정 및 삭제',
        icon: '📋',
        accent: 'from-fuchsia-500/20 to-fuchsia-600/5',
        ringHover: 'hover:ring-fuchsia-400/40',
    },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onBackToProfile, liveGames }) => {
    const activeCount = liveGames.filter(
        (g) => g.gameStatus !== 'ended' && g.gameStatus !== 'no_contest'
    ).length;

    return (
        <div className="max-w-5xl mx-auto bg-primary text-primary pb-10 px-1">
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-accent/90 mb-1">Admin</p>
                    <h1 className="text-3xl font-bold tracking-tight">관리자 대시보드</h1>
                    <p className="mt-2 text-sm text-gray-400 max-w-xl">
                        아래 패널을 눌러 각 설정 화면으로 이동합니다. 진행 중 대국은{' '}
                        <span className="text-primary font-medium">{activeCount}건</span>입니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onBackToProfile}
                    className="self-end sm:self-start p-0 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-100 active:shadow-inner active:scale-95 active:translate-y-0.5 shrink-0"
                    aria-label="프로필로 돌아가기"
                >
                    <img src="/images/button/back.png" alt="" className="w-10 h-10 sm:w-12 sm:h-12" />
                </button>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
                {TILES.map((tile) => (
                    <button
                        key={tile.view}
                        type="button"
                        onClick={() => onNavigate(tile.view)}
                        className={`
                            group relative text-left rounded-2xl border border-color bg-panel/90 backdrop-blur-sm
                            p-6 shadow-md transition-all duration-200
                            hover:shadow-lg hover:border-accent/30 hover:-translate-y-0.5
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary
                            ${tile.ringHover}
                        `}
                    >
                        <div
                            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tile.accent} opacity-80 pointer-events-none`}
                            aria-hidden
                        />
                        <div className="relative flex gap-4">
                            <div
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary/80 border border-color text-2xl shadow-inner"
                                aria-hidden
                            >
                                {tile.icon}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <h2 className="text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                                    {tile.title}
                                </h2>
                                <p className="mt-2 text-sm text-gray-400 leading-snug line-clamp-3">{tile.description}</p>
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent/90 group-hover:text-accent">
                                    설정 열기
                                    <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                                        →
                                    </span>
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AdminDashboard;
