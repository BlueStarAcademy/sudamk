import React from 'react';
import { LiveGameSession } from '../../types/index.js';
import AdminPageHeader from './AdminPageHeader.js';
import { adminPageNarrow, adminTileButton } from './adminChrome.js';

export type AdminView =
    | 'dashboard'
    | 'userManagement'
    | 'mailSystem'
    | 'vipGrants'
    | 'rewardSystem'
    | 'serverSettings'
    | 'serverMonitoring'
    | 'dropRateReference'
    | 'homeBoard'
    | 'operations';

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
        view: 'vipGrants',
        title: 'VIP 기간 부여',
        description: '보상·기능·VVIP 중 선택해 특정 유저 또는 전체 유저에게 기간 연장',
        icon: '💎',
        accent: 'from-fuchsia-500/20 to-violet-600/5',
        ringHover: 'hover:ring-fuchsia-400/40',
    },
    {
        view: 'rewardSystem',
        title: '보상 체계',
        description: '퀘스트/활약도/챔피언십 보상 배율 조회 및 운영 조정',
        icon: '🎁',
        accent: 'from-rose-500/20 to-rose-600/5',
        ringHover: 'hover:ring-rose-400/40',
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
        view: 'serverMonitoring',
        title: '부하 · 동시접속',
        description: 'WS·유저 피크, 붐빈 시간대, 메모리·이벤트 루프·과부하 경고 기록',
        icon: '📈',
        accent: 'from-cyan-500/20 to-cyan-600/5',
        ringHover: 'hover:ring-cyan-400/40',
    },
    {
        view: 'dropRateReference',
        title: '확률 정보',
        description: '상점 상자, 챔피언십 보상, 대장간, 모험 보물상자·열쇠 확률 테이블 조회',
        icon: '🎯',
        accent: 'from-teal-500/20 to-teal-600/5',
        ringHover: 'hover:ring-teal-400/40',
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
        <div className={adminPageNarrow}>
            <AdminPageHeader
                title="관리자 대시보드"
                subtitle={`아래 패널을 눌러 각 설정 화면으로 이동합니다. 진행 중 대국은 ${activeCount}건입니다.`}
                onBack={onBackToProfile}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                {TILES.map((tile) => (
                    <button
                        key={tile.view}
                        type="button"
                        onClick={() => onNavigate(tile.view)}
                        className={`${adminTileButton} ${tile.ringHover}`}
                    >
                        <div
                            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tile.accent} opacity-80 pointer-events-none`}
                            aria-hidden
                        />
                        <div className="relative flex gap-4">
                            <div
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-color/60 bg-secondary/70 text-2xl shadow-inner"
                                aria-hidden
                            >
                                {tile.icon}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <h2 className="text-lg font-semibold text-primary transition-colors group-hover:text-amber-200/95">
                                    {tile.title}
                                </h2>
                                <p className="mt-2 text-sm text-gray-400 leading-snug line-clamp-3">{tile.description}</p>
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-400/90 transition-colors group-hover:text-amber-300">
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
