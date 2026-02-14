
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { TournamentType, UserWithStatus, PlayerForTournament } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { TournamentBracket } from '../TournamentBracket';
import Button from '../Button';
import { TOURNAMENT_DEFINITIONS } from '../../constants';

// Error Boundary for TournamentBracket
class TournamentBracketErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[TournamentBracketErrorBoundary] Error caught:', error, errorInfo);
    }

    componentDidUpdate(prevProps: { children: ReactNode }) {
        // props가 변경되면 에러 상태 리셋
        if (prevProps.children !== this.props.children && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 text-center">
                    <p className="text-red-400 mb-4">토너먼트 화면을 불러오는 중 오류가 발생했습니다.</p>
                    <Button onClick={() => { window.location.hash = '#/tournament'; }}>토너먼트 로비로 돌아가기</Button>
                    {import.meta.env.DEV && this.state.error && (
                        <details className="mt-4 text-left">
                            <summary className="cursor-pointer text-gray-400">에러 상세 정보</summary>
                            <pre className="mt-2 p-2 bg-gray-800 rounded text-xs text-red-300 overflow-auto">
                                {this.state.error.toString()}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

interface TournamentArenaProps {
    type: TournamentType;
}

const TournamentArena: React.FC<TournamentArenaProps> = ({ type }) => {
    const { currentUserWithStatus, handlers, allUsers } = useAppContext();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // stateKey 결정
    let stateKey: keyof Pick<UserWithStatus, 'lastNeighborhoodTournament' | 'lastNationalTournament' | 'lastWorldTournament'>;
    switch (type) {
        case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
        case 'national': stateKey = 'lastNationalTournament'; break;
        case 'world': stateKey = 'lastWorldTournament'; break;
        default: return <div>Invalid tournament type</div>;
    }

    /** 챔피언십(동네/전국/월드)은 던전 전용. 입장은 로비에서 START_DUNGEON_STAGE로만 가능. */
    const isChampionshipDungeon = type === 'neighborhood' || type === 'national' || type === 'world';

    const tournamentStateFromContext = currentUserWithStatus?.[stateKey] as any;
    /** 챔피언십 입장 직후 컨텍스트 반영 전에도 표시: sessionStorage에 저장된 dungeonState 사용 */
    const pendingDungeonState = React.useMemo(() => {
        if (tournamentStateFromContext || !isChampionshipDungeon) return null;
        try {
            const raw = sessionStorage.getItem(`pendingDungeon_${type}`);
            if (!raw) return null;
            return JSON.parse(raw) as any;
        } catch {
            return null;
        }
    }, [type, tournamentStateFromContext, isChampionshipDungeon]);
    const tournamentState = tournamentStateFromContext ?? pendingDungeonState ?? null;
    const latestTournamentStateRef = React.useRef<typeof tournamentState | null>(tournamentState ?? null);

    /** 상태가 아직 안 왔을 때 HTTP 응답 반영을 위해 잠시 대기 (최대 1.2초) */
    const [waitingForState, setWaitingForState] = useState(true);
    useEffect(() => {
        if (tournamentState) {
            setWaitingForState(false);
            return;
        }
        const t = setTimeout(() => setWaitingForState(false), 1200);
        return () => clearTimeout(t);
    }, [tournamentState]);

    React.useEffect(() => {
        latestTournamentStateRef.current = tournamentState ?? null;
    }, [tournamentState]);

    // 컨텍스트에 반영되면 sessionStorage의 pending 던전 상태 제거 (다음 입장 시 혼선 방지)
    React.useEffect(() => {
        if (tournamentStateFromContext) {
            try {
                sessionStorage.removeItem(`pendingDungeon_${type}`);
            } catch { /* ignore */ }
        }
    }, [type, tournamentStateFromContext]);

    React.useEffect(() => {
        return () => {
            const latestState = latestTournamentStateRef.current;
            if (!latestState) return;
            // 경기 진행 중 나간 경우: 상태 유지(이어보기용)
            if (latestState.status === 'round_in_progress') return;
            // bracket_ready에서 unmount 시 CLEAR 하지 않음 (Strict Mode/이중 마운트 시 방금 입장한 세션이 지워지는 버그 방지).
            // 사용자가 로비에서 '나가기' 등으로 초기화하려면 CLEAR는 로비/별도 액션에서만 호출.
            if (latestState.status === 'bracket_ready') return;
            handlers.handleAction({ type: 'SAVE_TOURNAMENT_PROGRESS', payload: { type } })
                .catch(error => console.error('[TournamentArena] Failed to save tournament progress on unmount:', error));
        };
    }, [handlers, type]);
    const tournamentDefinition = TOURNAMENT_DEFINITIONS[type];

    const handlersRef = React.useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    // 챔피언십 던전: 토너먼트 상태가 있을 때만 bracket_ready 처리 (컨디션 부여). START_TOURNAMENT_SESSION은 호출하지 않음.
    useEffect(() => {
        if (!tournamentState || !isChampionshipDungeon) return;
        if (!tournamentState.autoAdvanceEnabled && tournamentState.status === 'bracket_ready' && 
            tournamentState.players?.some((p: PlayerForTournament) => {
                const hasValidCondition = p.condition !== undefined && p.condition !== null && 
                    p.condition !== 1000 && p.condition >= 40 && p.condition <= 100;
                return !hasValidCondition;
            })) {
            handlersRef.current.handleAction({ type: 'START_TOURNAMENT_ROUND', payload: { type } });
        }
    }, [type, tournamentState, isChampionshipDungeon]);

    if (!currentUserWithStatus) {
        return (
            <div className="p-4 text-center">
                <p>사용자 정보를 불러오는 중입니다...</p>
                <Button onClick={() => { window.location.hash = '#/tournament'; }} className="mt-4">로비로 돌아가기</Button>
            </div>
        );
    }

    // 챔피언십 던전인데 상태 없음: 로비로 이동만 안내 (START_TOURNAMENT_SESSION 호출 금지)
    const noStateAndChampionship = isChampionshipDungeon && !tournamentState && !waitingForState;
    if (noStateAndChampionship) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 w-full flex flex-col h-full items-center justify-center gap-4">
                <Button onClick={() => { window.location.hash = '#/tournament'; }} className="!py-2 !px-4">
                    로비로 돌아가기
                </Button>
            </div>
        );
    }

    // 상태 로딩 대기 중 (방금 입장한 직후 HTTP 응답 반영 대기)
    if (isChampionshipDungeon && !tournamentState && waitingForState) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 w-full flex flex-col h-full items-center justify-center gap-4 text-center">
                <p className="text-gray-400">경기 정보를 불러오는 중...</p>
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full flex flex-col h-full relative overflow-hidden min-h-0">
            {tournamentState && (
                <TournamentBracketErrorBoundary>
                    <TournamentBracket 
                        tournament={tournamentState}
                        currentUser={currentUserWithStatus}
                        onBack={async () => {
                            if (tournamentState.status === 'round_in_progress') {
                                if (window.confirm('경기를 포기하시겠습니까?')) {
                                    handlers.handleAction({ type: 'FORFEIT_CURRENT_MATCH', payload: { type } });
                                }
                            } else {
                                try {
                                    if (tournamentState) {
                                        await handlers.handleAction({ type: 'SAVE_TOURNAMENT_PROGRESS', payload: { type } });
                                    }
                                } catch (error) {
                                    console.error('[TournamentArena] Failed to save tournament progress on exit:', error);
                                } finally {
                                    window.location.hash = '#/tournament';
                                }
                            }
                        }}
                        allUsersForRanking={allUsers}
                        onViewUser={handlers.openViewingUser}
                        onAction={handlers.handleAction}
                        onStartNextRound={() => handlers.handleAction({ type: 'START_TOURNAMENT_ROUND', payload: { type: type } })}
                        onReset={() => handlers.handleAction({ type: 'CLEAR_TOURNAMENT_SESSION', payload: { type: type } })}
                        onSkip={() => handlers.handleAction({ type: 'SKIP_TOURNAMENT_END', payload: { type: type } })}
                        onOpenShop={() => handlers.openShop('consumables')}
                        isMobile={isMobile}
                    />
                </TournamentBracketErrorBoundary>
            )}
        </div>
    );
};

export default TournamentArena;
