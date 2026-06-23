import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../shared/i18n/config.js';

const tt = (key: string, opts?: Record<string, unknown>) => i18n.t(`tournament:${key}`, opts);

const TB_RND_16 = '16\uAC15';
const TB_RND_QF = '8\uAC15';
const TB_RND_SF = '4\uAC15';
const TB_RND_FINAL = '\uACB0\uC2B9';
const TB_RND_THIRD = '3,4\uC704\uC804';
const TB_TAB_SF = '4\uAC15\uC804';
const TB_TAB_FINAL_THIRD = '\uACB0\uC2B9&3/4\uC704\uC804';
const TB_TAB_FINAL_THIRD_ALT = '\uACB0\uC2B9 \uBC0F 3/4\uC704\uC804';
const TB_ROUND_SUFFIX = '\uD68C\uCC28';
const TB_ITEM_GOLD = '\uACE8\uB4DC';

const displayBracketTabName = (name: string): string => {
    if (name === TB_RND_16) return tt('round16');
    if (name === TB_RND_QF) return tt('roundQuarter');
    if (name === TB_TAB_SF) return tt('tabSemifinal');
    if (name === TB_TAB_FINAL_THIRD || name === TB_TAB_FINAL_THIRD_ALT) return tt('tabFinalThird');
    return name;
};
import { tx } from '../shared/i18n/runtimeText.js';
import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';
import { createPortal } from 'react-dom';
import {
    UserWithStatus,
    TournamentState,
    PlayerForTournament,
    ServerAction,
    User,
    CoreStat,
    Match,
    Round,
    CommentaryLine,
    TournamentType,
    LeagueTier,
    GameMode,
    Player,
    type AnalysisResult,
} from '../types.js';
import { ItemGrade } from '../types/enums.js';
import Button from './Button.js';
import { ArenaRightSidebarCollapseToggle } from './game/ArenaRightSidebarCollapseToggle.js';
import { useButtonClickThrottle } from '../hooks/useButtonClickThrottle.js';
import {
    useTournamentSimulation,
    CHAMPIONSHIP_SCORING_VEIL_DURATION_MS,
    championshipReplayBoardAfterMoves,
    type ChampionshipPlaybackSpeed,
} from '../hooks/useTournamentSimulation.js';
import { useChampionshipReplayPlaceStoneSound } from '../hooks/useChampionshipReplayPlaceStoneSound.js';
import { findActiveChampionshipUserMatch } from '../shared/utils/championshipTournamentPreserve.js';
import {
    resolveChampionshipDisplayCondition,
    shouldShowChampionshipConditionRecoveryButton,
} from '../shared/utils/championshipConditionDisplay.js';
import {
    TOURNAMENT_DEFINITIONS,
    CONSUMABLE_ITEMS,
    MATERIAL_ITEMS,
    AVATAR_POOL,
    BORDER_POOL,
    CORE_STATS_DATA,
    LEAGUE_DATA,
    DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT,
    gradeBackgrounds,
    getChampionshipArenaBackgroundUrl,
} from '../constants';
import {
    DUNGEON_STAGE_MATERIAL_ROLLS,
    DUNGEON_STAGE_EQUIPMENT_DROP,
    getDungeonBasicRewardRangeGold,
    getDungeonRankRewardForDisplay,
    getDungeonRankRewardRangeForDisplay,
    formatDungeonChampCoinRewardPreviewLabel,
    type EquipmentGradeKey,
} from '../shared/constants/tournaments';
import Avatar from './Avatar.js';
import RadarChart from './RadarChart.js';
import SgfViewer from './SgfViewer.js';
import GoBoard from './GoBoard.js';
import { audioService } from '../services/audioService.js';
import ConditionPotionModal from './ConditionPotionModal.js';
import { calculateTotalStats } from '../services/statService.js';
import DungeonStageSummaryModal, { type DungeonStageSummaryModalProps } from './DungeonStageSummaryModal.js';
import { resolvePublicUrl } from '../utils/publicAssetUrl.js';
import { isFunctionVipActive } from '../shared/utils/rewardVip.js';
import { formatGoldAmountKoG } from '../shared/utils/walletAmountDisplay.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    CHAMPIONSHIP_SIMULATION_PHASE_STAT_WEIGHTS,
    championshipKataLevelForPly,
    DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
    resolveChampionshipDungeonPlaybackSpeedChoices,
    type ChampionshipAbilityKataLadderRow,
} from '../shared/constants/championshipRealMatch.js';
import type { PairPetAbilityKataLadderRow } from '../shared/constants/pairArena.js';
import { DEFAULT_PAIR_PET_ABILITY_KATA_LADDER } from '../shared/constants/pairArena.js';
import { resolveChampionshipVersusPhaseAbilityDisplay } from '../shared/utils/championshipVersusKataResolve.js';
import {
    resolveChampionshipPanelScores,
    resolveChampionshipTerritoryAnalysisForRealGame,
} from '../utils/championshipLiveScores.js';
import {
    ChampionshipDesktopScoreBox,
    ChampionshipDesktopScoringCountdownBox,
    ChampionshipMobileScoreCell,
    ChampionshipMobileScoringCountdownCell,
} from './championship/ChampionshipArenaScorePanels.js';
import { markChampionshipArenaExitSuppressRedirect, replaceAppHash } from '../utils/appUtils.js';
import InlineLoadingSpinner from './ui/InlineLoadingSpinner.js';

/** 서버 inferDungeonStageAttempt와 동일 — currentStageAttempt 누락 시에도 보상 버튼·COMPLETE_DUNGEON_STAGE 단계 일치 */
function resolveDungeonStageAttempt(
    tournamentState: TournamentState,
    user: Pick<UserWithStatus, 'dungeonProgress'>,
    dungeonType: TournamentType
): number {
    const existing = tournamentState.currentStageAttempt;
    if (typeof existing === 'number' && existing >= 1 && existing <= 10) return existing;

    const m = tournamentState.title?.match(/(\d+)\s*단계/);
    if (m?.[1]) {
        const parsed = Number(m[1]);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 10) return parsed;
    }

    const progress = user.dungeonProgress?.[dungeonType];
    const unlocked = progress?.unlockedStages;
    if (Array.isArray(unlocked) && unlocked.length > 0) {
        const maxUnlocked = Math.max(...unlocked);
        const clamped = Math.min(10, Math.max(1, Math.floor(maxUnlocked)));
        if (!Number.isNaN(clamped)) return clamped;
    }

    const currentStage = progress?.currentStage;
    if (typeof currentStage === 'number' && currentStage >= 1 && currentStage <= 10) return currentStage;

    if (dungeonType === 'world' && tournamentState.status === 'eliminated') return 1;

    return 1;
}

/** 챔피언십 던전 토너먼트 종료 시 순위(보상받기·순위 보상 표시와 동일 규칙: 승→패→승률) */
function computeChampionshipDungeonUserRank(tournamentState: TournamentState, userId: string): number | null {
    if (!tournamentState.players.some((p) => p.id === userId)) return null;
    const playerWins: Record<string, number> = {};
    const playerLosses: Record<string, number> = {};
    tournamentState.players.forEach((p) => {
        playerWins[p.id] = 0;
        playerLosses[p.id] = 0;
    });
    tournamentState.rounds.forEach((round) => {
        round.matches?.forEach((m) => {
            if (m.isFinished && m.winner) {
                playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                const loser = m.players.find((p) => p && p.id !== m.winner?.id);
                if (loser) playerLosses[loser.id] = (playerLosses[loser.id] || 0) + 1;
            }
        });
    });
    const rankedPlayers = [...tournamentState.players].sort((a, b) => {
        if (playerWins[b.id] !== playerWins[a.id]) return playerWins[b.id] - playerWins[a.id];
        if (playerLosses[a.id] !== playerLosses[b.id]) return playerLosses[a.id] - playerLosses[b.id];
        const aGames = playerWins[a.id] + playerLosses[a.id];
        const bGames = playerWins[b.id] + playerLosses[b.id];
        const aWinRate = aGames > 0 ? playerWins[a.id] / aGames : 0;
        const bWinRate = bGames > 0 ? playerWins[b.id] / bGames : 0;
        return bWinRate - aWinRate;
    });
    const idx = rankedPlayers.findIndex((p) => p.id === userId);
    return idx === -1 ? null : idx + 1;
}

type ChampionshipDungeonStandingRow = {
    rank: number;
    playerId: string;
    nickname: string;
    wins: number;
    losses: number;
};

/** 던전 토너먼트 종료 화면용: 전체 참가자 순위(승→패→승률, `computeChampionshipDungeonUserRank`와 동일 정렬). */
function buildChampionshipDungeonStandings(tournamentState: TournamentState): ChampionshipDungeonStandingRow[] {
    if (!tournamentState.players?.length) return [];
    const playerWins: Record<string, number> = {};
    const playerLosses: Record<string, number> = {};
    tournamentState.players.forEach((p) => {
        playerWins[p.id] = 0;
        playerLosses[p.id] = 0;
    });
    tournamentState.rounds.forEach((round) => {
        round.matches?.forEach((m) => {
            if (m.isFinished && m.winner) {
                playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                const loser = m.players.find((p) => p && p.id !== m.winner?.id);
                if (loser) playerLosses[loser.id] = (playerLosses[loser.id] || 0) + 1;
            }
        });
    });
    const rankedPlayers = [...tournamentState.players].sort((a, b) => {
        if (playerWins[b.id] !== playerWins[a.id]) return playerWins[b.id] - playerWins[a.id];
        if (playerLosses[a.id] !== playerLosses[b.id]) return playerLosses[a.id] - playerLosses[b.id];
        const aGames = playerWins[a.id] + playerLosses[a.id];
        const bGames = playerWins[b.id] + playerLosses[b.id];
        const aWinRate = aGames > 0 ? playerWins[a.id] / aGames : 0;
        const bWinRate = bGames > 0 ? playerWins[b.id] / bGames : 0;
        return bWinRate - aWinRate;
    });
    return rankedPlayers.map((p, i) => ({
        rank: i + 1,
        playerId: p.id,
        nickname: p.nickname ?? tt('defaultPlayer'),
        wins: playerWins[p.id] ?? 0,
        losses: playerLosses[p.id] ?? 0,
    }));
}

/**
 * 챔피언십 던전: 해당 선수가 참가한 `isUserMatch` 종료 대국만 집계한 전적.
 * `players[].wins`가 이번 경기 직후 아직 갱신되지 않은 경우에도, 라운드·anchor 매치를 맞춰 이번 판을 포함한다.
 */
function dungeonUserMatchRecordForPlayer(
    tournament: TournamentState | null,
    playerId: string,
    anchorMatch: Match | null,
): { wins: number; losses: number } {
    let wins = 0;
    let losses = 0;
    if (!tournament?.rounds?.length) return { wins: 0, losses: 0 };

    for (const round of tournament.rounds) {
        for (const m of round.matches ?? []) {
            if (!m.isUserMatch || !m.isFinished || !m.winner) continue;
            const played = m.players?.some((p) => p?.id === playerId);
            if (!played) continue;
            if (m.winner.id === playerId) wins += 1;
            else losses += 1;
        }
    }

    const anchorPlayed =
        !!anchorMatch?.isFinished &&
        !!anchorMatch.winner &&
        anchorMatch.players?.some((p) => p?.id === playerId);
    if (anchorPlayed) {
        const anchorReflected = tournament.rounds.some((r) =>
            r.matches?.some((m) => m.id === anchorMatch!.id && m.isFinished && !!m.winner),
        );
        if (!anchorReflected) {
            if (anchorMatch!.winner!.id === playerId) wins += 1;
            else losses += 1;
        }
    }

    return { wins, losses };
}

// Error Boundary for PlayerProfilePanel
class PlayerProfilePanelErrorBoundary extends Component<
    { children: ReactNode; fallback?: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode; fallback?: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (import.meta.env.DEV) {
            console.error('[PlayerProfilePanelErrorBoundary] Error caught:', error, errorInfo);
        }
    }

    componentDidUpdate(prevProps: { children: ReactNode }) {
        // props가 변경되면 에러 상태 리셋
        if (prevProps.children !== this.props.children && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">
                    {tx('tournament:playerLoadError')}
                </div>
            );
        }

        return this.props.children;
    }
}

/** 챔피언십 인게임·결과 카드용 아바타/테두리 URL (색상 테두리는 img가 아닌 Avatar가 처리) */
function resolveChampionshipPortraitUrls(
    player: { avatarId?: string; borderId?: string } | null,
): { avatarUrl?: string; borderUrl?: string } {
    const avatarRaw = player?.avatarId ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
    const borderRaw = player?.borderId ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
    const avatarUrl = avatarRaw ? resolvePublicUrl(avatarRaw) : undefined;
    const borderUrl =
        borderRaw == null
            ? undefined
            : borderRaw.startsWith('#') || borderRaw.startsWith('conic-gradient')
              ? borderRaw
              : resolvePublicUrl(borderRaw);
    return { avatarUrl, borderUrl };
}

/** 바둑판 중앙 안내(심호흡·입장 대기·시상식 등) — 배경 위 가독성용 반투명 패널 */
const CHAMPIONSHIP_BOARD_CENTER_NOTICE_TEXT =
    'text-sm font-semibold leading-snug text-slate-50 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]';

const ChampionshipBoardCenterNotice: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <div className="flex h-full w-full items-center justify-center bg-transparent px-2 sm:px-3">
        <div
            className={`w-fit max-w-[calc(100%-0.25rem)] rounded-xl border border-slate-300/45 bg-black/88 px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_36px_-10px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:px-4 sm:py-3 ${className}`}
        >
            {children}
        </div>
    </div>
);

export const ChampionshipRealGoBoard: React.FC<{
    match: Match | null;
    currentUser: UserWithStatus;
    tournamentFinished?: boolean;
    /** 던전 경기장: 바둑판 중앙 안내(카타 로딩·경기 전 대기) */
    dungeonBoardCenterMode?: 'deep_breath' | 'players_entering' | null;
    /** `players_entering`일 때 중앙 문구(미지정이면 기본: 선수 입장 안내) */
    dungeonPlayersEnteringHint?: string;
    /** @deprecated 오버레이 제거됨 — 장내 PVP 등 호환용 no-op */
    suppressFinishedResultCard?: boolean;
    /** 계가·종료 판면에서 영토/사석 오버레이(서버 `calculateScoreManually` 또는 엔진 분석) */
    territoryAnalysis?: AnalysisResult | null;
}> = ({
    match,
    currentUser,
    tournamentFinished = false,
    dungeonBoardCenterMode = null,
    territoryAnalysis = null,
    dungeonPlayersEnteringHint,
}) => {
    const { t } = useTranslation('tournament');
    const realGame = match?.championshipRealGame;

    // 서버는 START_TOURNAMENT_MATCH 시점에 이미 둔 결과(최종 보드)와 함께 currentPly=0으로 내려준다.
    // 시뮬레이션 훅이 빈 판으로 리셋하기 전 한 프레임 동안 최종 기보가 노출되는 깜빡임을 막기 위해
    // currentPly===0이고 아직 종료되지 않은 상태에서는 빈 판을 그린다.
    const displayBoardState = React.useMemo(() => {
        if (!realGame) return null;
        const isFreshBeforePlayback = (realGame.currentPly ?? 0) === 0 && realGame.status !== 'finished';
        if (isFreshBeforePlayback) {
            return Array.from(
                { length: realGame.boardSize },
                () => Array.from({ length: realGame.boardSize }, () => Player.None),
            );
        }
        const moveCount = realGame.moves?.length ?? 0;
        const ply = realGame.currentPly ?? 0;
        const atTerminalPly = moveCount > 0 && ply >= moveCount;
        const terminalForScoring =
            atTerminalPly && (realGame.status === 'scoring' || realGame.status === 'finished');
        if (terminalForScoring) {
            if (realGame.scoringAnalysis && realGame.boardState) {
                return realGame.boardState;
            }
            if (realGame.moves?.length) {
                return championshipReplayBoardAfterMoves(realGame.boardSize, realGame.moves, moveCount);
            }
        }
        return realGame.boardState;
    }, [
        realGame?.boardState,
        realGame?.boardSize,
        realGame?.currentPly,
        realGame?.status,
        realGame?.moves,
        realGame?.scoringAnalysis,
    ]);

    const territoryAnalysisForOverlay = React.useMemo(() => {
        if (!realGame) return null;
        if (realGame.scoringAnalysis) return territoryAnalysis;
        if (realGame.status === 'finished') return territoryAnalysis;
        return null;
    }, [realGame?.scoringAnalysis, realGame?.status, territoryAnalysis]);

    /** 계가 베일·스캔 연출 — `realGame` 없을 때도 훅 순서를 유지해야 함(조기 return 위에 둔다). */
    const [scoringVeilComplete, setScoringVeilComplete] = React.useState(false);
    React.useEffect(() => {
        if (!realGame || realGame.status !== 'scoring') {
            setScoringVeilComplete(false);
            return;
        }
        setScoringVeilComplete(false);
        const id = window.setTimeout(() => setScoringVeilComplete(true), CHAMPIONSHIP_SCORING_VEIL_DURATION_MS);
        return () => window.clearTimeout(id);
    }, [realGame?.status, match?.id]);

    if (!realGame) {
        if (tournamentFinished) {
            return (
                <ChampionshipBoardCenterNotice>
                    <span className={`${CHAMPIONSHIP_BOARD_CENTER_NOTICE_TEXT} text-amber-100`}>
                        {t('allMatchesEnded')}
                    </span>
                </ChampionshipBoardCenterNotice>
            );
        }
        if (dungeonBoardCenterMode === 'deep_breath') {
            return (
                <ChampionshipBoardCenterNotice>
                    <span className={`whitespace-nowrap ${CHAMPIONSHIP_BOARD_CENTER_NOTICE_TEXT} text-cyan-50`}>
                        {t('breathing')}
                    </span>
                </ChampionshipBoardCenterNotice>
            );
        }
        if (dungeonBoardCenterMode === 'players_entering') {
            return (
                <ChampionshipBoardCenterNotice className="py-4">
                    <InlineLoadingSpinner
                        size="lg"
                        label={dungeonPlayersEnteringHint ?? t('playersEntering')}
                        labelClassName={`max-w-none text-center whitespace-nowrap sm:whitespace-normal ${CHAMPIONSHIP_BOARD_CENTER_NOTICE_TEXT} text-sky-100`}
                    />
                </ChampionshipBoardCenterNotice>
            );
        }
        /** 경기 시작 전·기보 없음: 입장 안내는 `players_entering`(시작 클릭 후)에만 표시 */
        return <div className="h-full w-full bg-transparent" aria-hidden />;
    }

    const blackName = match?.players.find(p => p?.id === realGame.blackPlayerId)?.nickname ?? t('black');
    const whiteName = match?.players.find(p => p?.id === realGame.whitePlayerId)?.nickname ?? t('white');
    const isFreshBeforePlayback = (realGame.currentPly ?? 0) === 0 && realGame.status !== 'finished';
    const lastMoveForDisplay = isFreshBeforePlayback ? null : realGame.lastMove;
    const moveHistoryForDisplay = isFreshBeforePlayback ? [] : realGame.moves;

    const boardGameStatus =
        realGame.status === 'scoring' ? 'scoring' : realGame.status === 'finished' ? 'ended' : 'playing';

    const showTerritoryOnBoard =
        !!territoryAnalysisForOverlay &&
        !isFreshBeforePlayback &&
        (realGame.status === 'finished' || (realGame.status === 'scoring' && scoringVeilComplete));

    return (
        <div className="championship-real-board relative flex h-full w-full items-center justify-center overflow-hidden">
            <div className="relative aspect-square h-full max-h-full max-w-full overflow-hidden">
                <GoBoard
                    boardState={displayBoardState ?? realGame.boardState}
                    boardSize={realGame.boardSize}
                    onBoardClick={() => {}}
                    lastMove={lastMoveForDisplay}
                    isBoardDisabled
                    stoneColor={Player.Black}
                    isSpectator
                    mode={GameMode.Standard}
                    myPlayerEnum={Player.Black}
                    gameStatus={boardGameStatus}
                    currentPlayer={moveHistoryForDisplay.length % 2 === 0 ? Player.Black : Player.White}
                    showLastMoveMarker
                    currentUser={currentUser}
                    blackPlayerNickname={blackName}
                    whitePlayerNickname={whiteName}
                    isItemModeActive={false}
                    moveHistory={moveHistoryForDisplay}
                    captures={{ [Player.Black]: 0, [Player.White]: 0 }}
                    analysisResult={territoryAnalysisForOverlay ?? undefined}
                    showTerritoryOverlay={showTerritoryOnBoard}
                />
                {realGame.status === 'scoring' && !scoringVeilComplete && (
                    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
                        {/* 좌→우로 채워지는 어두운 베일 (계가 연출의 본판) — 바둑판 정사각형 영역만 덮는다 */}
                        <div className="championship-scoring-veil absolute inset-0" aria-hidden />
                        {/* 베일의 진행 끝에서 빛나는 좌→우 스캔 빔 */}
                        <div className="championship-scoring-beam absolute inset-y-0" aria-hidden />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-2xl border border-cyan-300/60 bg-slate-950/90 px-5 py-2.5 text-center shadow-2xl">
                                <div className="text-base font-bold tracking-wide text-cyan-200">{t('scoring')}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/** 컨트롤 패널·보상 패널 사이에 표시하는 경기 결과 패널(바둑판 오버레이 대신) */
export const ChampionshipMatchResultPanel: React.FC<{
    match: Match | null;
    currentUser: UserWithStatus;
    tournamentFinished?: boolean;
    tournamentForResult?: TournamentState | null;
    finalStandings?: ChampionshipDungeonStandingRow[] | null;
    resultActionSlot?: React.ReactNode;
    compact?: boolean;
}> = ({
    match,
    currentUser,
    tournamentFinished = false,
    tournamentForResult = null,
    finalStandings = null,
    resultActionSlot = null,
    compact = false,
}) => {
    const realGame = match?.championshipRealGame;
    const canToggleFinalStandings = Boolean(
        tournamentFinished && finalStandings && finalStandings.length > 0,
    );
    const [panelView, setPanelView] = React.useState<'match' | 'standings'>('match');

    React.useEffect(() => {
        setPanelView('match');
    }, [match?.id, tournamentFinished]);

    if (!realGame?.winnerId || !match) return null;

    const userWonThisMatch = realGame.winnerId === currentUser.id;
    const userInMatch = match.players.find((p) => p?.id === currentUser.id) ?? null;
    const opponentInMatch = match.players.find((p) => p && p.id !== currentUser.id) ?? null;
    const userRecord = dungeonUserMatchRecordForPlayer(tournamentForResult, currentUser.id, match);
    const opponentRecord = opponentInMatch
        ? dungeonUserMatchRecordForPlayer(tournamentForResult, opponentInMatch.id, match)
        : { wins: 0, losses: 0 };
    const { avatarUrl: userAvatarUrl, borderUrl: userBorderUrl } = resolveChampionshipPortraitUrls(userInMatch);
    const { avatarUrl: opponentAvatarUrl, borderUrl: opponentBorderUrl } =
        resolveChampionshipPortraitUrls(opponentInMatch);
    const roundLabel = (() => {
        if (!tournamentForResult) return '';
        for (const r of tournamentForResult.rounds) {
            if (r.matches.some((m) => m.id === match.id)) return r.name ?? '';
        }
        return '';
    })();
    const finishedScoreLeadAbs = Math.abs(realGame.finalScore?.scoreLead ?? 0);
    const finalStandingsCount = finalStandings?.length ?? 0;
    const finalStandingsListClass =
        finalStandingsCount > 6
            ? 'grid grid-cols-2 gap-x-1.5 gap-y-0.5 sm:gap-x-2'
            : 'flex flex-col gap-0.5';
    const finalStandingsTextClass = compact
        ? finalStandingsCount > 12
            ? 'text-[9px]'
            : 'text-[10px]'
        : finalStandingsCount > 12
          ? 'text-[9px] sm:text-[10px]'
          : 'text-[10px] sm:text-[11px]';

    const finalStandingsList = finalStandings ? (
        <ul
            className={`w-full ${finalStandingsListClass} ${finalStandingsTextClass} max-h-[9.5rem] overflow-y-auto leading-snug [scrollbar-color:rgba(148,163,184,0.45)_rgba(15,23,42,0.5)] [scrollbar-width:thin]`}
        >
            {finalStandings.map((row) => (
                <li
                    key={row.playerId}
                    className={`flex items-center justify-between gap-1 rounded-md border px-1.5 py-0.5 sm:gap-2 sm:px-2 sm:py-1 ${
                        row.playerId === currentUser.id
                            ? 'border-cyan-400/50 bg-cyan-950/40 text-cyan-50'
                            : 'border-slate-600/40 bg-slate-900/50 text-slate-200'
                    }`}
                >
                    <span className="shrink-0 font-black tabular-nums text-amber-200">{tt('rankSuffix', { rank: row.rank })}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{row.nickname}</span>
                    <span className="shrink-0 tabular-nums text-slate-300">
                        {tt('recordWinsLosses', { wins: row.wins, losses: row.losses })}
                    </span>
                </li>
            ))}
        </ul>
    ) : null;

    const panelToggleButton = canToggleFinalStandings ? (
        <button
            type="button"
            onClick={() => setPanelView((v) => (v === 'match' ? 'standings' : 'match'))}
            className={`w-full rounded-xl border border-violet-300/40 bg-gradient-to-b from-violet-500/88 via-purple-700/88 to-violet-950/95 font-black tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-14px_rgba(0,0,0,0.9)] transition active:scale-[0.98] ${
                compact ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'
            }`}
        >
            {panelView === 'match' ? tt('finalResult') : tt('matchResult')}
        </button>
    ) : null;

    return (
        <section
            className={`flex min-h-0 flex-col rounded-2xl border border-amber-400/35 bg-gradient-to-b from-[#2a3d56] via-[#141c2b] to-[#070a10] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_12px_36px_-18px_rgba(0,0,0,0.92)] ring-1 ring-inset ring-amber-300/12 ${
                compact ? 'p-2' : 'p-2.5'
            }`}
        >
            <div
                className={`championship-finished-result-card rounded-xl border border-amber-300/55 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-black/95 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                    compact ? 'px-3 py-2' : 'px-4 py-3 sm:px-5 sm:py-3.5'
                }`}
            >
                <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
                    <div className={panelView === 'standings' ? 'invisible' : 'visible'}>
                        {roundLabel ? (
                            <div className="flex items-center justify-center">
                                <span
                                    className={`rounded-full border border-amber-300/65 bg-amber-500/15 font-black tracking-wider text-amber-100 ${
                                        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
                                    }`}
                                >
                                    {roundLabel}
                                </span>
                            </div>
                        ) : null}

                        <div
                            className={`flex items-center justify-center ${roundLabel ? (compact ? 'mt-1.5 gap-1.5' : 'mt-2 gap-2') : compact ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}
                        >
                            <div className={`flex flex-col items-center ${compact ? 'w-[4.5rem]' : 'w-[5rem] sm:w-[5.6rem]'}`}>
                                <div
                                    className={`shrink-0 rounded-full ${
                                        userWonThisMatch
                                            ? 'ring-2 ring-emerald-400/90 ring-offset-1 ring-offset-slate-950'
                                            : 'ring-2 ring-rose-400/90 ring-offset-1 ring-offset-slate-950'
                                    }`}
                                >
                                    <Avatar
                                        userId={userInMatch?.id ?? currentUser.id}
                                        userName={userInMatch?.nickname ?? tt('me')}
                                        avatarUrl={userAvatarUrl}
                                        borderUrl={userBorderUrl}
                                        size={compact ? 40 : 48}
                                    />
                                </div>
                                <div
                                    className={`mt-0.5 max-w-full truncate font-bold text-slate-100 ${compact ? 'text-[10px]' : 'text-[10px] sm:text-[11px]'}`}
                                >
                                    {userInMatch?.nickname ?? tt('me')}
                                </div>
                                <div
                                    className={`font-semibold text-emerald-200/85 ${compact ? 'text-[9px]' : 'text-[9px] sm:text-[10px]'}`}
                                >
                                    {tt('tournamentRecord', { wins: userRecord.wins, losses: userRecord.losses })}
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center">
                                <div
                                    className={`font-black leading-tight ${compact ? 'text-base' : 'text-lg sm:text-xl'} ${userWonThisMatch ? 'text-emerald-200' : 'text-rose-200'}`}
                                >
                                    {userWonThisMatch ? tt('victory') : tt('defeat')}
                                </div>
                                <div
                                    className={`mt-0.5 font-bold text-slate-300 ${compact ? 'text-[10px]' : 'text-[10px] sm:text-xs'}`}
                                >
                                    {finishedScoreLeadAbs > 0 ? tt('scoreLead', { points: finishedScoreLeadAbs.toFixed(1) }) : tt('jigo')}
                                </div>
                            </div>

                            <div className={`flex flex-col items-center ${compact ? 'w-[4.5rem]' : 'w-[5rem] sm:w-[5.6rem]'}`}>
                                <div
                                    className={`shrink-0 rounded-full ${
                                        userWonThisMatch
                                            ? 'ring-2 ring-rose-400/90 ring-offset-1 ring-offset-slate-950'
                                            : 'ring-2 ring-emerald-400/90 ring-offset-1 ring-offset-slate-950'
                                    }`}
                                >
                                    <Avatar
                                        userId={opponentInMatch?.id ?? 'opponent'}
                                        userName={opponentInMatch?.nickname ?? tt('opponent')}
                                        avatarUrl={opponentAvatarUrl}
                                        borderUrl={opponentBorderUrl}
                                        size={compact ? 40 : 48}
                                    />
                                </div>
                                <div
                                    className={`mt-0.5 max-w-full truncate font-bold text-slate-100 ${compact ? 'text-[10px]' : 'text-[10px] sm:text-[11px]'}`}
                                >
                                    {opponentInMatch?.nickname ?? tt('opponent')}
                                </div>
                                <div
                                    className={`font-semibold text-emerald-200/85 ${compact ? 'text-[9px]' : 'text-[9px] sm:text-[10px]'}`}
                                >
                                    {tt('tournamentRecord', { wins: opponentRecord.wins, losses: opponentRecord.losses })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {canToggleFinalStandings ? (
                        <div className={panelView === 'match' ? 'invisible' : 'visible w-full text-left'}>
                            {finalStandingsList}
                        </div>
                    ) : null}
                </div>
            </div>
            {panelToggleButton ? (
                <div className={`w-full shrink-0 ${compact ? 'mt-1.5' : 'mt-2'}`}>{panelToggleButton}</div>
            ) : null}
            {resultActionSlot ? (
                <div className={`mt-2 w-full shrink-0 border-t border-amber-300/20 pt-2 ${compact ? '' : 'sm:pt-2.5'}`}>
                    {resultActionSlot}
                </div>
            ) : null}
        </section>
    );
};

/** 네이티브 셸 고정 패널: `Header` + 하단 독·광고(`ChampionshipVersusVenueArena`와 동일 계열) */
const CHAMPIONSHIP_MOBILE_OVERLAY_DRAWER_TOP =
    'calc(env(safe-area-inset-top, 0px) + clamp(3.5rem, calc(2.85rem + 2vw), 4.85rem))';
const CHAMPIONSHIP_MOBILE_OVERLAY_DRAWER_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 7.5rem)';
const CHAMPIONSHIP_MOBILE_SIDEBAR_OPEN_TAB_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 7.5rem + 0.25rem)';

const CHAMPIONSHIP_PHASE_META = [
    { key: 'opening' as const, labelKey: 'phases.opening', ply19: 1, ply13: 1, ply9: 1 },
    { key: 'midgame' as const, labelKey: 'phases.midgame', ply19: 61, ply13: 31, ply9: 15 },
    { key: 'endgame' as const, labelKey: 'phases.endgame', ply19: 121, ply13: 61, ply9: 29 },
];

function championshipPhaseMetaPly(boardSize: number, phase: (typeof CHAMPIONSHIP_PHASE_META)[number]): number {
    if (boardSize === 13) return phase.ply13;
    if (boardSize === 9) return phase.ply9;
    return phase.ply19;
}

const CHAMPIONSHIP_CORE_STATS: CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];


export const ChampionshipAbilityPlayerPanel: React.FC<{
    player: PlayerForTournament | null;
    stats: Record<string, number>;
    match: Match | null;
    currentPhase: 'early' | 'mid' | 'end' | 'none';
    /** 흑/백 선수에 맞춘 패널 테마(청·홍 대신) */
    tone: 'black' | 'white';
    sideLabel: string;
    abilityKataLadder: readonly ChampionshipAbilityKataLadderRow[];
    /** 페어 펫 KATA 사다리(펫 챔피언십·페어 챔피언십 펫 블록) */
    pairPetAbilityKataLadder?: readonly PairPetAbilityKataLadderRow[];
    /** 단일 블록일 때 유저/펫 KATA 구분(펫 챔피언십은 `pet`) */
    singleBlockStatKind?: 'user' | 'pet';
    /** 페어 챔피언십: 유저·펫 능력치를 각각 KATA 사다리로 표시 */
    splitPairAbilities?: {
        userBlockTitle: string;
        userStats: Record<string, number>;
        petBlockTitle: string;
        petStats: Record<string, number>;
    } | null;
    /** 페어 챔피언십: 유저·펫 블록 각각 착수 턴 강조 */
    pairSplitTurnHighlight?: { user: boolean; pet: boolean } | null;
}> = ({
    player,
    stats,
    match,
    currentPhase,
    tone,
    sideLabel,
    abilityKataLadder,
    pairPetAbilityKataLadder = DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
    singleBlockStatKind = 'user',
    splitPairAbilities,
    pairSplitTurnHighlight = null,
}) => {
    useTranslation('tournament');
    const realGame = match?.championshipRealGame;
    const boardSize = realGame?.boardSize ?? 19;
    const activePhaseKey =
        currentPhase === 'early' ? 'opening' : currentPhase === 'mid' ? 'midgame' : currentPhase === 'end' ? 'endgame' : null;
    const accentTone =
        tone === 'black'
            ? 'border-zinc-600 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-stone-100 ring-stone-500/25'
            : 'border-slate-500 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 text-slate-50 ring-slate-300/22';
    const statCardTone =
        tone === 'black'
            ? 'border-zinc-600/80 from-zinc-800 via-zinc-900 to-zinc-950'
            : 'border-slate-500/80 from-slate-600 via-slate-700 to-slate-900';
    const phaseRowActiveClass = (phaseKey: (typeof CHAMPIONSHIP_PHASE_META)[number]['key']): string => {
        const idleRing = 'ring-1 ring-inset ring-transparent';
        if (activePhaseKey !== phaseKey) {
            return tone === 'black'
                ? `border-zinc-700/50 bg-zinc-950/90 ${idleRing}`
                : `border-slate-600/50 bg-slate-950/88 ${idleRing}`;
        }
        if (phaseKey === 'opening') {
            return tone === 'black'
                ? 'border-cyan-300/55 bg-gradient-to-r from-cyan-600/28 to-sky-900/35 ring-1 ring-inset ring-cyan-400/25'
                : 'border-cyan-300/45 bg-gradient-to-r from-cyan-700/22 to-slate-900/50 ring-1 ring-inset ring-cyan-300/20';
        }
        if (phaseKey === 'midgame') {
            return tone === 'black'
                ? 'border-fuchsia-300/50 bg-gradient-to-r from-fuchsia-600/26 to-indigo-950/38 ring-1 ring-inset ring-fuchsia-400/22'
                : 'border-fuchsia-300/45 bg-gradient-to-r from-fuchsia-700/24 to-slate-900/48 ring-1 ring-inset ring-fuchsia-300/20';
        }
        return tone === 'black'
            ? 'border-amber-300/50 bg-gradient-to-r from-amber-600/26 to-orange-950/38 ring-1 ring-inset ring-amber-400/25'
            : 'border-amber-300/45 bg-gradient-to-r from-amber-700/24 to-slate-900/50 ring-1 ring-inset ring-amber-300/22';
    };

    const phaseRowLabelClass = (
        phaseKey: (typeof CHAMPIONSHIP_PHASE_META)[number]['key'],
        density: 'normal' | 'compact' = 'normal',
    ): string => {
        const size = density === 'compact' ? 'text-[10px]' : 'text-[12px]';
        if (activePhaseKey !== phaseKey) return `font-bold ${size} text-slate-500`;
        if (phaseKey === 'opening') return `font-bold ${size} text-cyan-100`;
        if (phaseKey === 'midgame') return `font-bold ${size} text-fuchsia-100`;
        return `font-bold ${size} text-amber-100`;
    };

    const phaseRowValueClass = (
        phaseKey: (typeof CHAMPIONSHIP_PHASE_META)[number]['key'],
        density: 'normal' | 'compact' = 'normal',
    ): string => {
        const size = density === 'compact' ? 'text-[11px]' : 'text-base';
        if (activePhaseKey !== phaseKey) return `${size} font-black tabular-nums text-slate-500`;
        if (phaseKey === 'opening') return `${size} font-black tabular-nums text-cyan-50`;
        if (phaseKey === 'midgame') return `${size} font-black tabular-nums text-fuchsia-50`;
        return `${size} font-black tabular-nums text-amber-50`;
    };

    const phaseBadgeClass =
        currentPhase === 'early'
            ? 'border-cyan-400/45 bg-cyan-950/55 text-cyan-100'
            : currentPhase === 'mid'
              ? 'border-fuchsia-400/45 bg-fuchsia-950/50 text-fuchsia-100'
              : currentPhase === 'end'
                ? 'border-amber-400/50 bg-amber-950/50 text-amber-100'
                : 'border-white/15 bg-black/28 text-slate-300';

    const renderCoreAndPhaseBlock = (
        blockStats: Record<string, number>,
        statKind: 'user' | 'pet',
        density: 'normal' | 'compact' = 'normal',
    ) => {
        const gridGap = density === 'compact' ? 'gap-x-1.5 gap-y-1' : 'gap-x-2 gap-y-1.5';
        const pad = density === 'compact' ? 'p-1.5' : 'p-2.5';
        const statText = density === 'compact' ? 'text-[10px]' : 'text-[11px]';
        const valText = density === 'compact' ? 'text-[11px]' : 'text-[12px]';
        const phasePad = density === 'compact' ? 'px-1.5 py-1' : 'px-2.5 py-2';
        const phaseLabel = density === 'compact' ? 'text-[11px]' : 'text-[12px]';
        const phaseStackGap = density === 'compact' ? 'space-y-1' : 'space-y-2';
        return (
            <>
                <div className={`grid shrink-0 grid-cols-2 ${gridGap} rounded-lg border bg-gradient-to-b ${pad} text-[11px] leading-tight shadow-lg ${statCardTone}`}>
                    {CHAMPIONSHIP_CORE_STATS.map((stat) => {
                        const hi = currentPhase !== 'none' && KEY_STATS_BY_PHASE[currentPhase].includes(stat);
                        const ps = currentPhase !== 'none' ? CHAMPIONSHIP_PHASE_STAT_STYLE[currentPhase] : null;
                        return (
                            <React.Fragment key={stat}>
                                <span
                                    className={`truncate font-semibold ${statText} ${hi && ps ? `${ps.labelActive} font-bold` : 'text-slate-400'}`}
                                >
                                    {stat}
                                </span>
                                <span
                                    className={`text-right ${valText} font-black tabular-nums ${hi && ps ? `${ps.valueActive}` : 'text-slate-50'}`}
                                >
                                    {Math.round(blockStats?.[stat] ?? 0)}
                                </span>
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className={`shrink-0 rounded-lg border bg-gradient-to-b ${pad} shadow-lg ${statCardTone}`}>
                    <div className={phaseStackGap}>
                        {CHAMPIONSHIP_PHASE_META.map((phase) => {
                            const ply = championshipPhaseMetaPly(boardSize, phase);
                            /** 페어 분할 시 스냅샷은 좌석 통합 스탯 기준이라 유저·펫에 동일 적용됨 → 각 블록 코어로만 KATA 산출 */
                            const fromSnapshot =
                                !splitPairAbilities && player?.id
                                    ? realGame?.phaseStatsByPlayerId?.[player.id]?.[phase.key]
                                    : undefined;
                            const computed =
                                fromSnapshot ??
                                resolveChampionshipVersusPhaseAbilityDisplay({
                                    boardSize,
                                    ply,
                                    blockStats,
                                    statKind,
                                    rules: DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
                                    userLadder: abilityKataLadder,
                                    pairPetLadder: pairPetAbilityKataLadder,
                                });
                            return (
                                <div
                                    key={phase.key}
                                    className={`rounded-lg border ${phasePad} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${phaseRowActiveClass(phase.key)}`}
                                >
                                    <div className={`flex items-center justify-between gap-1.5 ${phaseLabel}`}>
                                        <span className={phaseRowLabelClass(phase.key, density)}>{tt(phase.labelKey)}</span>
                                        <span className={phaseRowValueClass(phase.key, density)}>{computed.abilityScore}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </>
        );
    };

    const isSplitPairPanel = Boolean(splitPairAbilities);
    const splitUserTurnRing = pairSplitTurnHighlight?.user
        ? 'ring-2 ring-amber-400/88 shadow-[0_0_16px_-6px_rgba(245,158,11,0.42)] ring-inset rounded-lg'
        : 'ring-2 ring-transparent ring-inset rounded-lg';
    const splitPetTurnRing = pairSplitTurnHighlight?.pet
        ? 'ring-2 ring-amber-400/88 shadow-[0_0_16px_-6px_rgba(245,158,11,0.42)] ring-inset rounded-lg'
        : 'ring-2 ring-transparent ring-inset rounded-lg';

    return (
        <aside
            className={`flex shrink-0 flex-col overflow-hidden rounded-xl border-2 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_42px_-22px_rgba(0,0,0,0.9)] ${
                isSplitPairPanel
                    ? 'h-full min-h-0 max-h-full w-[165px] min-w-[165px] max-w-[165px] gap-1.5 xl:w-[185px] xl:min-w-[185px] xl:max-w-[185px]'
                    : 'h-fit max-h-full w-[165px] min-w-[165px] max-w-[165px] gap-2 self-start xl:w-[185px] xl:min-w-[185px] xl:max-w-[185px]'
            } ${
                tone === 'black'
                    ? 'border-zinc-600 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950'
                    : 'border-slate-500 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900'
            }`}
        >
            <div className={`flex shrink-0 items-center justify-between rounded-lg border p-2 shadow-lg ring-1 ring-inset ${accentTone}`}>
                <div>
                    <div className="text-[13px] font-black tracking-wide text-amber-100">{sideLabel}</div>
                    <div className="mt-0.5 max-w-[7rem] truncate text-[11px] font-semibold text-slate-300">
                        {splitPairAbilities ? tt('userPetAbility') : tt('playerAbility', { name: player?.nickname ?? tt('defaultPlayer') })}
                    </div>
                </div>
                <div className={`rounded-lg border px-2 py-1 text-[12px] font-black shadow-inner ${phaseBadgeClass}`}>
                    {currentPhase === 'early' ? tt('phases.opening') : currentPhase === 'mid' ? tt('phases.midgame') : currentPhase === 'end' ? tt('phases.endgame') : tt('phases.waiting')}
                </div>
            </div>

            {splitPairAbilities ? (
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    <div className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden ${splitUserTurnRing}`}>
                        <div className="shrink-0 text-center text-[9px] font-black uppercase tracking-wide text-amber-100/95">
                            {splitPairAbilities.userBlockTitle}
                        </div>
                        {renderCoreAndPhaseBlock(splitPairAbilities.userStats, 'user', 'compact')}
                    </div>
                    <div className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden border-t border-white/10 pt-0.5 ${splitPetTurnRing}`}>
                        <div className="shrink-0 pt-0.5 text-center text-[9px] font-black uppercase tracking-wide text-sky-200/95">
                            {splitPairAbilities.petBlockTitle}
                        </div>
                        {renderCoreAndPhaseBlock(splitPairAbilities.petStats, 'pet', 'compact')}
                    </div>
                </div>
            ) : (
                <>
                    {renderCoreAndPhaseBlock(stats, singleBlockStatKind, 'normal')}
                </>
            )}
        </aside>
    );
};

const ChampionshipAbilitySidePanel: React.FC<{
    p1: PlayerForTournament | null;
    p2: PlayerForTournament | null;
    p1Stats: Record<string, number>;
    p2Stats: Record<string, number>;
    match: Match | null;
    currentPhase: 'early' | 'mid' | 'end' | 'none';
    abilityKataLadder: readonly ChampionshipAbilityKataLadderRow[];
}> = ({ p1, p2, p1Stats, p2Stats, match, currentPhase, abilityKataLadder }) => (
    <div className="flex h-full gap-2">
        <ChampionshipAbilityPlayerPanel
            player={p1}
            stats={p1Stats}
            match={match}
            currentPhase={currentPhase}
            tone="black"
            sideLabel={tt('championshipAbility')}
            abilityKataLadder={abilityKataLadder}
        />
        <ChampionshipAbilityPlayerPanel
            player={p2}
            stats={p2Stats}
            match={match}
            currentPhase={currentPhase}
            tone="white"
            sideLabel={tt('championshipAbility')}
            abilityKataLadder={abilityKataLadder}
        />
    </div>
);

const championshipFooterButtonBase =
    'rounded-xl border px-4 py-2 text-xs font-black tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-14px_rgba(0,0,0,0.9)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
const championshipFooterPrimaryButton =
    `${championshipFooterButtonBase} border-emerald-300/45 bg-gradient-to-b from-emerald-400/95 via-emerald-600/90 to-emerald-950/95 text-slate-950 hover:brightness-110`;
const championshipFooterSecondaryButton =
    `${championshipFooterButtonBase} border-violet-300/40 bg-gradient-to-b from-violet-500/88 via-purple-700/88 to-violet-950/95 text-white hover:brightness-110`;
const championshipFooterMutedButton =
    `${championshipFooterButtonBase} border-slate-500/40 bg-gradient-to-b from-slate-700/88 via-slate-800/92 to-slate-950 text-slate-300`;
const championshipFooterExitButton =
    `${championshipFooterButtonBase} border-rose-400/45 bg-gradient-to-b from-rose-600/88 via-rose-800/90 to-rose-950/95 text-rose-50 hover:brightness-110`;

/** 페이즈 점수에 모두 반영되므로 하이라이트는 여섯 능력치 전부 */
const CHAMPIONSHIP_ALL_CORE_STATS: CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];

const KEY_STATS_BY_PHASE: Record<'early' | 'mid' | 'end', CoreStat[]> = {
    early: CHAMPIONSHIP_ALL_CORE_STATS,
    mid: CHAMPIONSHIP_ALL_CORE_STATS,
    end: CHAMPIONSHIP_ALL_CORE_STATS,
};

/** 경기 페이즈(초·중·종)에 맞춰 해당 구간 가중 능력치 라벨·수치 색상 */
const CHAMPIONSHIP_PHASE_STAT_STYLE: Record<
    'early' | 'mid' | 'end',
    { labelActive: string; valueActive: string; labelMuted: string; valueMuted: string }
> = {
    early: {
        labelActive: 'text-cyan-200',
        valueActive: 'text-cyan-50',
        labelMuted: 'text-slate-500',
        valueMuted: 'text-slate-500',
    },
    mid: {
        labelActive: 'text-fuchsia-200',
        valueActive: 'text-fuchsia-50',
        labelMuted: 'text-slate-500',
        valueMuted: 'text-slate-500',
    },
    end: {
        labelActive: 'text-amber-200',
        valueActive: 'text-amber-100',
        labelMuted: 'text-slate-500',
        valueMuted: 'text-slate-500',
    },
};

function championshipStatHighlightClass(
    phase: 'early' | 'mid' | 'end' | 'none',
    stat: CoreStat,
    part: 'label' | 'value',
): string {
    if (phase === 'none') {
        return part === 'label' ? 'text-gray-400' : 'text-white';
    }
    const active = KEY_STATS_BY_PHASE[phase].includes(stat);
    const s = CHAMPIONSHIP_PHASE_STAT_STYLE[phase];
    if (active) {
        return part === 'label' ? `${s.labelActive} font-bold` : `${s.valueActive} font-bold`;
    }
    return part === 'label' ? s.labelMuted : s.valueMuted;
}

/** 초·중·종 합산 능력 3칸: 경기 중엔 현재 페이즈 칸만 강조, 그 외에는 세 칸 동일 강조 */
function championshipPhaseAggregateCellClass(
    cellPhase: 'early' | 'mid' | 'end',
    currentPhase: 'early' | 'mid' | 'end' | 'none',
    isMobile: boolean,
    layout: 'gridCell' | 'inlineRow' = 'gridCell',
): { wrap: string; title: string; value: string } {
    const pad = isMobile ? 'px-0.5 py-0.5' : 'px-1 py-0.5';
    const align = layout === 'inlineRow' ? 'flex w-full items-center justify-between gap-2 text-left' : 'text-center';
    const styles: Record<'early' | 'mid' | 'end', { wrap: string; title: string; value: string }> = {
        early: {
            wrap: `rounded ${pad} ${align} border border-cyan-600/45 bg-cyan-950/35`,
            title: 'text-cyan-100/90 font-semibold',
            value: 'text-cyan-200 font-bold',
        },
        mid: {
            wrap: `rounded ${pad} ${align} border border-fuchsia-600/45 bg-fuchsia-950/30`,
            title: 'text-fuchsia-100/90 font-semibold',
            value: 'text-fuchsia-200 font-bold',
        },
        end: {
            wrap: `rounded ${pad} ${align} border border-amber-600/50 bg-amber-950/30`,
            title: 'text-amber-100/90 font-semibold',
            value: 'text-amber-200 font-bold',
        },
    };
    const base = styles[cellPhase];
    if (currentPhase === 'none') {
        return { wrap: base.wrap, title: base.title, value: base.value };
    }
    if (currentPhase !== cellPhase) {
        return {
            wrap: `${base.wrap} opacity-[0.52] saturate-[0.65]`,
            title: `${base.title} opacity-90`,
            value: `${base.value} opacity-90`,
        };
    }
    return {
        wrap: `${base.wrap} ring-1 ring-white/15 shadow-[0_0_14px_-4px_rgba(255,255,255,0.18)]`,
        title: base.title,
        value: base.value,
    };
}

const STAT_WEIGHTS = CHAMPIONSHIP_SIMULATION_PHASE_STAT_WEIGHTS;

const getMaxStatValueForLeague = (league: LeagueTier): number => {
    switch (league) {
        case LeagueTier.Sprout:
        case LeagueTier.Rookie:
        case LeagueTier.Rising:
            return 250;
        case LeagueTier.Ace:
        case LeagueTier.Diamond:
            return 300;
        case LeagueTier.Master:
        case LeagueTier.Grandmaster:
            return 400;
        case LeagueTier.Challenger:
            return 500;
        default:
            return 250;
    }
};

interface TournamentBracketProps {
    tournament: TournamentState;
    /** 서버·관리자에서 내려준 능력치→KATA 사다리. 없으면 코드 기본값 사용 */
    championshipAbilityKataLadder?: readonly ChampionshipAbilityKataLadderRow[];
    currentUser: UserWithStatus;
    onBack: () => void;
    allUsersForRanking: User[];
    onViewUser: (userId: string) => void;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    onStartNextRound: () => void;
    onReset: () => void;
    onSkip: () => void;
    onOpenShop?: () => void;
    isMobile: boolean;
}

const PlayerProfilePanel: React.FC<{ 
    player: PlayerForTournament | null, 
    initialPlayer: PlayerForTournament | null,
    allUsers: User[], 
    currentUserId: string, 
    onViewUser: (userId: string) => void,
    highlightPhase: 'early' | 'mid' | 'end' | 'none';
    isUserMatch?: boolean;
    onUseConditionPotion?: () => void;
    onOpenShop?: () => void;
    timeElapsed?: number;
    tournamentStatus?: string;
    isMobile?: boolean;
    /** false면 경기 진행 중 등 회복제 사용 불가 */
    canUseConditionPotion?: boolean;
    /** 티어 표시 여부. 챔피언십 경기장에서는 false (티어는 전략바둑/놀이바둑에만 존재) */
    showLeague?: boolean;
    /** 모바일 챔피언십 대국자 탭: 장비 비교 모달과 유사한 상태정보/능력수치 탭 */
    championshipMobileCompareLayout?: boolean;
    mobileRadarCompare?: { datasets: { stats: Record<string, number>; color: string; fill: string }[]; maxStatValue: number; radarSize: number };
    radarLegendBelow?: ReactNode;
    /** 양 패널을 세로로 쌓을 때: 패널 내부 스크롤·하단 레이더 제거(부모에서 단일 레이더) */
    championshipMobileStackedNoRadar?: boolean;
    /** 토너먼트 플레이어 객체에 컨디션이 1000일 때 던전 스냅샷 등으로 보강 */
    conditionFallback?: number;
}> = ({
    player,
    initialPlayer,
    allUsers,
    currentUserId,
    onViewUser,
    highlightPhase,
    isUserMatch,
    onUseConditionPotion,
    onOpenShop,
    timeElapsed = 0,
    tournamentStatus,
    isMobile = false,
    canUseConditionPotion = false,
    showLeague = false,
    championshipMobileCompareLayout = false,
    mobileRadarCompare,
    radarLegendBelow,
    championshipMobileStackedNoRadar = false,
    conditionFallback,
}) => {
    // 모든 hooks는 조건부 return 전에 선언되어야 함
    const [previousCondition, setPreviousCondition] = useState<number | undefined>(undefined);
    const [showConditionIncrease, setShowConditionIncrease] = useState(false);
    const [conditionIncreaseAmount, setConditionIncreaseAmount] = useState(0);
    const [statChanges, setStatChanges] = useState<Record<CoreStat, number>>({} as Record<CoreStat, number>);
    const prevStatsRef = useRef<Record<CoreStat, number>>({} as Record<CoreStat, number>);
    const initialStatsKeyRef = useRef<string>('');
    const [championshipMobileInfoTab, setChampionshipMobileInfoTab] = useState<'status' | 'abilities'>('status');
    
    // player가 변경되면 previousCondition 초기화
    useEffect(() => {
        // player가 null이 아니고 condition이 유효한 경우에만 설정
        if (player && player.condition !== undefined && player.condition !== null) {
            setPreviousCondition(player.condition);
        } else {
            setPreviousCondition(undefined);
        }
    }, [player?.id, player?.condition]);
    
    // initialStats를 useMemo로 변경하여 player.originalStats나 initialPlayer가 변경될 때마다 업데이트되도록 함
    const initialStats = useMemo<Record<CoreStat, number>>(() => {
        // player가 없으면 모든 CoreStat을 0으로 초기화
        if (!player) {
            const emptyStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                emptyStats[stat] = 0;
            });
            return emptyStats;
        }
        try {
            // player가 존재하는 경우에만 접근
            const p = player; // 로컬 변수로 안전하게 참조
            
            // 다음 경기로 넘어갔을 때 originalStats로 초기화된 값을 사용
            if (p.originalStats && typeof p.originalStats === 'object' && Object.keys(p.originalStats).length > 0) {
                return { ...p.originalStats };
            }
            // initialPlayer가 있으면 그것을 사용 (경기 시작 시점의 상태)
            if (initialPlayer?.stats && typeof initialPlayer.stats === 'object' && Object.keys(initialPlayer.stats).length > 0) {
                return { ...initialPlayer.stats };
            }
            // 그 외에는 현재 player.stats 사용
            if (p.stats && typeof p.stats === 'object' && Object.keys(p.stats).length > 0) {
                return { ...p.stats };
            }
            // 모든 것이 실패하면 기본값 반환 (모든 CoreStat을 0으로)
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[PlayerProfilePanel] Error in initialStats calculation:', error);
            }
            // 에러 발생 시 기본값 반환
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        }
    }, [player?.id, player?.originalStats, initialPlayer?.stats, player?.stats]);
    
    // initialStats가 변경되면 prevStatsRef 리셋 (새 경기 시작)
    useEffect(() => {
        if (!player) return;
        const currentKey = JSON.stringify(initialStats);
        if (initialStatsKeyRef.current !== currentKey) {
            initialStatsKeyRef.current = currentKey;
            prevStatsRef.current = { ...initialStats };
            setStatChanges({} as Record<CoreStat, number>);
        }
    }, [initialStats, player?.id]);
    
    // 컨디션 변화 감지 및 애니메이션 트리거
    useEffect(() => {
        // player가 null이거나 condition이 유효하지 않으면 early return
        if (!player || player.condition === undefined || player.condition === null) {
            // player가 없으면 previousCondition도 초기화
            if (!player) {
                setPreviousCondition(undefined);
            }
            return;
        }
        
        // player를 로컬 변수로 캡처하여 안전하게 참조
        const currentPlayer = player;
        const currentCondition = currentPlayer.condition;
        
        // currentCondition이 유효하지 않으면 early return
        if (currentCondition === undefined || currentCondition === null) {
            return;
        }
        
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        // 안전 체크: previousCondition이 유효하고 증가한 경우에만 애니메이션
        if (previousCondition !== undefined && 
            currentCondition !== 1000 && 
            previousCondition !== 1000 &&
            currentCondition > previousCondition) {
            const increase = currentCondition - previousCondition;
            if (increase > 0) {
                setConditionIncreaseAmount(increase);
                setShowConditionIncrease(true);
                timeoutId = setTimeout(() => {
                    setShowConditionIncrease(false);
                }, 2000);
            }
        }
        // currentCondition을 previousCondition으로 업데이트
        setPreviousCondition(currentCondition);
        
        // cleanup 함수
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [player?.id, player?.condition, previousCondition]);

    // 모든 hooks는 조건부 return 전에 선언되어야 함 (React hooks 규칙)
    // player가 null일 수 있으므로 안전하게 처리
    const fullUserData = useMemo(() => {
        if (!player || !player.id) return undefined;
        return allUsers.find(u => u.id === player.id);
    }, [allUsers, player?.id]);
    const leagueInfo = useMemo(() => {
        if (!player || player.league === undefined) return undefined;
        return LEAGUE_DATA.find(league => league.tier === player.league);
    }, [player?.league]);

    const cumulativeStats = useMemo(() => {
        const result = { wins: 0, losses: 0 };
        if (fullUserData?.stats) {
            Object.values(fullUserData.stats).forEach(s => {
                result.wins += s.wins ?? 0;
                result.losses += s.losses ?? 0;
            });
        }
        return result;
    }, [fullUserData]);

    // player가 null이 아니라는 것을 확인했지만, 안전성을 위해 옵셔널 체이닝 사용
    const isClickable = player ? (!player.id.startsWith('bot-') && player.id !== currentUserId) : false;
    const avatarUrl = useMemo(() => {
        if (!player || !player.avatarId) return undefined;
        return AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
    }, [player?.avatarId]);
    const borderUrl = useMemo(() => {
        if (!player || !player.borderId) return undefined;
        return BORDER_POOL.find(b => b.id === player.borderId)?.url;
    }, [player?.borderId]);
    const isCurrentUser = player ? (player.id === currentUserId) : false;
    
    // 컨디션 회복제 보유 개수 확인
    const potionCounts = useMemo(() => {
        const counts: Record<string, number> = { small: 0, medium: 0, large: 0 };
        if (fullUserData?.inventory) {
            fullUserData.inventory
                .filter(item => item.type === 'consumable' && item.name.startsWith('\uCEE4\uB514\uC158\uD68C\uBCF5\uC81C'))
                .forEach(item => {
                    if (item.name === '\uCEE4\uB514\uC158\uD68C\uBCF5\uC81C(\uC18C)') {
                        counts.small += item.quantity || 1;
                    } else if (item.name === '\uCEE4\uB514\uC158\uD68C\uBCF5\uC81C(\uC911)') {
                        counts.medium += item.quantity || 1;
                    } else if (item.name === '\uCEE4\uB514\uC158\uD68C\uBCF5\uC81C(\uB300)') {
                        counts.large += item.quantity || 1;
                    }
                });
        }
        return counts;
    }, [fullUserData?.inventory]);
    
    const totalPotionCount = potionCounts.small + potionCounts.medium + potionCounts.large;
    
    // 능력치 변화 감지 (경기 진행 중일 때만) - 모든 hooks는 조건부 return 전에 선언되어야 함
    useEffect(() => {
        // player와 player.stats가 없으면 early return
        if (!player || !player.stats || typeof player.stats !== 'object' || tournamentStatus !== 'round_in_progress') {
            // 경기가 진행 중이 아니면 statChanges 초기화
            if (tournamentStatus !== 'round_in_progress') {
                setStatChanges({} as Record<CoreStat, number>);
            }
            return;
        }
        
        // player를 로컬 변수로 캡처하여 안전하게 참조
        const currentPlayer = player;
        if (!currentPlayer || !currentPlayer.stats || typeof currentPlayer.stats !== 'object') {
            return;
        }
        
        // player.stats가 유효한 객체인지 확인
        const currentStats = currentPlayer.stats as Record<CoreStat, number>;
        if (!currentStats || typeof currentStats !== 'object') {
            return;
        }
        
        // 초기화: prevStatsRef가 비어있거나 initialStats가 변경되었으면 초기화
        const initialKey = JSON.stringify(initialStats);
        if (Object.keys(prevStatsRef.current).length === 0 || initialStatsKeyRef.current !== initialKey) {
            prevStatsRef.current = { ...initialStats };
            initialStatsKeyRef.current = initialKey;
            // 초기화 시에는 변화가 없으므로 statChanges도 초기화
            setStatChanges({} as Record<CoreStat, number>);
            // 초기화 후에는 현재 stats를 저장하고 종료
            prevStatsRef.current = { ...currentStats } as Record<CoreStat, number>;
            return;
        }
        
        // 각 능력치를 개별적으로 비교하여 변화 감지
        const changes: Record<CoreStat, number> = {} as Record<CoreStat, number>;
        let hasChanges = false;
        
        Object.values(CoreStat).forEach(stat => {
            const prev = prevStatsRef.current[stat] ?? initialStats[stat] ?? 0;
            const curr = currentStats[stat] ?? 0;
            const diff = curr - prev;
            // 변화가 있으면 감지 (0이 아닌 변화만)
            if (diff !== 0) {
                changes[stat] = diff;
                hasChanges = true;
            }
        });
        
        // 현재 stats를 깊은 복사로 저장 (다음 비교를 위해, 변화가 있든 없든 항상 업데이트)
        prevStatsRef.current = { ...currentStats } as Record<CoreStat, number>;
        
        // 변화가 있으면 애니메이션 트리거
        if (hasChanges) {
            // 개발 모드에서만 상세 로그 출력
            if (import.meta.env.DEV && Object.keys(changes).length > 0 && currentPlayer?.nickname) {
                console.log(`[PlayerProfilePanel] Stat changes detected for ${currentPlayer.nickname}:`, changes);
            }
            // 새로운 변화를 설정하여 애니메이션 트리거
            setStatChanges(changes);
            // 2초 후 애니메이션 초기화 (fade out)
            const timeoutId = setTimeout(() => {
                setStatChanges({} as Record<CoreStat, number>);
            }, 2000);
            // cleanup 함수에서 timeout 정리
            return () => {
                clearTimeout(timeoutId);
            };
        }
    }, [
        player?.id, // 플레이어가 변경되면 초기화
        player?.stats?.[CoreStat.CombatPower],
        player?.stats?.[CoreStat.ThinkingSpeed],
        player?.stats?.[CoreStat.Judgment],
        player?.stats?.[CoreStat.Calculation],
        player?.stats?.[CoreStat.Concentration],
        player?.stats?.[CoreStat.Stability],
        timeElapsed,
        tournamentStatus,
        initialStats
    ]);

    // 경기 시작 전에는 홈 화면과 동일한 능력치 계산 (calculateTotalStats 사용)
    // 경기 중에는 player.stats를 사용 (컨디션으로 인한 변화 반영)
    const displayStats = useMemo(() => {
        // player가 없으면 기본값 반환
        if (!player) {
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        }
        
        // player를 로컬 변수로 캡처하여 안전하게 참조
        const currentPlayer = player;
        if (!currentPlayer) {
            const defaultStats: Record<CoreStat, number> = {} as Record<CoreStat, number>;
            Object.values(CoreStat).forEach(stat => {
                defaultStats[stat] = 0;
            });
            return defaultStats;
        }
        
        if (tournamentStatus === 'round_in_progress') {
            // 경기 중에는 현재 능력치 사용 (컨디션 변화 반영)
            return currentPlayer.stats || initialStats;
        }

        if (currentPlayer.originalStats && typeof currentPlayer.originalStats === 'object') {
            // 토너먼트 생성 시점의 고정 능력치 사용
            return currentPlayer.originalStats;
        }

        if (fullUserData) {
            // 유저 정보가 있으면 최신 능력치 계산
            try {
                return calculateTotalStats(fullUserData, 'championshipVenue');
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.error('[PlayerProfilePanel] Error calculating total stats:', error);
                }
                return currentPlayer.stats || initialStats;
            }
        }

        return currentPlayer.stats || initialStats;
    }, [player?.id, player?.stats, player?.originalStats, fullUserData, tournamentStatus, initialStats]);
    
    // 바둑능력 점수 계산 (모든 능력치의 합계, 정수로 반올림)
    const totalAbilityScore = useMemo(() => {
        try {
            if (!displayStats || typeof displayStats !== 'object') {
                return 0;
            }
            return Math.round(Object.values(displayStats).reduce((sum, stat) => sum + (stat || 0), 0));
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[PlayerProfilePanel] Error calculating total ability score:', error);
            }
            return 0;
        }
    }, [displayStats]);
    
    // 초반/중반/종반 능력치 계산 (서버의 calculatePower와 동일한 로직)
    // 각 능력치에 가중치를 곱한 후 합산
    const phaseStats = useMemo(() => {
        try {
            if (!displayStats || typeof displayStats !== 'object') {
                return { early: 0, mid: 0, end: 0 };
            }
            
            const calculatePhasePower = (phase: 'early' | 'mid' | 'end') => {
                const weights = STAT_WEIGHTS[phase];
                if (!weights || typeof weights !== 'object') {
                    return 0;
                }
                let power = 0;
                for (const stat in weights) {
                    const statKey = stat as CoreStat;
                    const weight = weights[statKey];
                    if (weight !== undefined && weight !== null) {
                        power += (displayStats[statKey] || 0) * weight;
                    }
                }
                return power;
            };
            
            return {
                early: Math.round(calculatePhasePower('early')),
                mid: Math.round(calculatePhasePower('mid')),
                end: Math.round(calculatePhasePower('end'))
            };
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[PlayerProfilePanel] Error calculating phase stats:', error);
            }
            return { early: 0, mid: 0, end: 0 };
        }
    }, [displayStats, player?.condition]);
    
    // player가 null이면 early return (이미 위에서 처리했지만 안전성을 위해 다시 확인)
    // 이 시점에서 player가 null이면 모든 hooks가 실행되었지만 안전하게 처리되었으므로 안전함
    if (!player) {
        return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">{tt('playerWaiting')}</div>;
    }
    
    // player가 확실히 존재하므로 안전하게 접근 가능
    // 하지만 경기 종료 시점에 player 객체의 속성이 예상치 못하게 변경될 수 있으므로
    // 모든 접근을 안전하게 처리
    const playerId = player?.id;
    const playerNickname = player?.nickname;

    /** 토너먼트 객체에 컨디션이 아직 안 실렸을 때(1000) 스냅샷·fallback으로 표시·회복제 판정 */
    const playerCondition = resolveChampionshipDisplayCondition({
        playerCondition: player.condition,
        snapshotCondition: conditionFallback,
        isCurrentUser,
    });

    // 모든 필수 값이 유효한지 확인
    if (!playerId || !playerNickname) {
        return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">{tt('playerLoadFailed')}</div>;
    }

    /** Avatar.tsx 이미지 테두리 최대 배율(링 1.5)과 동일 — 슬롯을 맞춰 양쪽 패널 능력치 행이 수평으로 정렬되게 함 */
    const avatarSizePx = isMobile ? 40 : 32;
    const avatarSlotRem = (avatarSizePx / 16) * 1.5;
    const totalGames = cumulativeStats.wins + cumulativeStats.losses;
    const winRateLine =
        totalGames === 0
            ? tt('noRecord')
            : tt('winRateWithRecord', { rate: ((100 * cumulativeStats.wins) / totalGames).toFixed(1), wins: cumulativeStats.wins, losses: cumulativeStats.losses });
    const showConditionInStatus =
        tournamentStatus !== 'complete' &&
        tournamentStatus !== 'eliminated' &&
        (tournamentStatus === 'round_in_progress' ||
            tournamentStatus === 'bracket_ready' ||
            tournamentStatus === 'round_complete');

    if (championshipMobileCompareLayout && isMobile && (mobileRadarCompare || championshipMobileStackedNoRadar)) {
        const rowClass =
            'flex items-center justify-between gap-2 rounded-md border border-gray-600/60 bg-slate-900/55 px-2 py-1.5 text-[11px]';
        return (
            <div
                className={`flex flex-col gap-1 rounded-lg border border-gray-600/55 bg-slate-950/90 p-1.5 ${
                    championshipMobileStackedNoRadar ? 'w-full shrink-0' : 'h-full min-h-0'
                }`}
                style={championshipMobileStackedNoRadar ? undefined : { maxHeight: '100%', overflow: 'hidden' }}
            >
                <div
                    className={`flex w-full shrink-0 items-center gap-2 ${isClickable ? 'cursor-pointer hover:bg-slate-800/80' : ''}`}
                    onClick={isClickable ? () => onViewUser(playerId) : undefined}
                    title={isClickable ? tt('viewProfile', { name: playerNickname }) : ''}
                >
                    {showLeague && leagueInfo && (
                        <img
                            key={`league-${playerId}-${leagueInfo.tier}`}
                            src={leagueInfo.icon}
                            alt={leagueInfo.name}
                            className="h-8 w-8 shrink-0 object-contain drop-shadow-lg"
                            loading="lazy"
                        />
                    )}
                    <div
                        className="flex shrink-0 items-center justify-center"
                        style={{
                            width: `${avatarSlotRem}rem`,
                            height: `${avatarSlotRem}rem`,
                            minWidth: `${avatarSlotRem}rem`,
                            minHeight: `${avatarSlotRem}rem`,
                        }}
                    >
                        <Avatar key={`avatar-${playerId}`} userId={playerId} userName={playerNickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarSizePx} />
                    </div>
                    <h4 className="min-w-0 flex-1 truncate text-sm font-bold">{playerNickname}</h4>
                </div>

                <div
                    className={`flex flex-col ${championshipMobileStackedNoRadar ? '' : 'min-h-0 flex-1 overflow-hidden'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="grid shrink-0 grid-cols-2 gap-0.5 border-b border-amber-500/25 px-0.5 pb-1 pt-0.5">
                        {(
                            [
                                ['status', tt('statusInfo')],
                                ['abilities', tt('abilityStats')],
                            ] as const
                        ).map(([key, label]) => {
                            const active = championshipMobileInfoTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setChampionshipMobileInfoTab(key)}
                                    className={`rounded-md border px-0.5 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                        active
                                            ? 'border-amber-400/70 bg-amber-900/40 text-amber-100'
                                            : 'border-gray-600/60 bg-black/25 text-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {showConditionInStatus ? (
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-600/50 px-1 py-1">
                            <span className="shrink-0 text-[10px] font-semibold text-gray-400">{tt('condition')}</span>
                            <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1.5">
                                <span
                                    className={`font-mono text-sm font-bold text-yellow-300 transition-all duration-300 ${
                                        showConditionIncrease ? 'scale-105 text-green-300' : ''
                                    }`}
                                >
                                    {playerCondition === 1000 ? '—' : playerCondition}
                                </span>
                                {showConditionIncrease && conditionIncreaseAmount > 0 && (
                                    <span
                                        className="pointer-events-none absolute -top-2.5 right-6 text-[10px] font-bold text-green-400"
                                        style={{
                                            animation: 'fadeUp 2s ease-out forwards',
                                            textShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
                                        }}
                                    >
                                        +{conditionIncreaseAmount}
                                    </span>
                                )}
                                {isCurrentUser &&
                                isUserMatch &&
                                onUseConditionPotion &&
                                shouldShowChampionshipConditionRecoveryButton({
                                    condition: playerCondition,
                                    tournamentStatus,
                                }) ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (playerCondition >= 100 || !canUseConditionPotion) return;
                                            onUseConditionPotion();
                                        }}
                                        disabled={playerCondition >= 100 || !canUseConditionPotion}
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-colors ${
                                            playerCondition >= 100 || !canUseConditionPotion
                                                ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                        title={
                                            playerCondition >= 100
                                                ? tt('conditionMax')
                                                : !canUseConditionPotion
                                                  ? tt('conditionPotionUnavailable')
                                                  : tt('useConditionPotion')
                                        }
                                    >
                                        +
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div
                        className={`pt-1 ${championshipMobileStackedNoRadar ? 'overflow-x-hidden' : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'}`}
                        style={championshipMobileStackedNoRadar ? undefined : { WebkitOverflowScrolling: 'touch' }}
                    >
                        {championshipMobileInfoTab === 'status' ? (
                            <div className="flex flex-col gap-1">
                                <div className={rowClass}>
                                    <span className="shrink-0 font-semibold text-gray-300">{tt('badukAbility')}</span>
                                    <span className="truncate text-right font-mono font-bold text-blue-300 tabular-nums">{totalAbilityScore}</span>
                                </div>
                                <div className={rowClass}>
                                    <span className="shrink-0 font-semibold text-gray-300">{tt('winRate')}</span>
                                    <span className="min-w-0 truncate text-right text-gray-100">{winRateLine}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 pb-1">
                                {Object.values(CoreStat).map((stat) => {
                                    try {
                                        const initialValue =
                                            tournamentStatus === 'round_in_progress'
                                                ? (initialPlayer?.stats?.[stat] ??
                                                      initialStats[stat] ??
                                                      player?.originalStats?.[stat] ??
                                                      displayStats?.[stat] ??
                                                      0)
                                                : (displayStats?.[stat] ?? 0);
                                        const currentValue = displayStats?.[stat] ?? 0;
                                        const change = tournamentStatus === 'round_in_progress' ? currentValue - initialValue : 0;
                                        return (
                                            <div
                                                key={stat}
                                                className={`flex items-baseline justify-between gap-2 rounded-md border border-gray-600/50 bg-slate-900/45 px-2 py-1 font-mono text-[10px] tabular-nums`}
                                            >
                                                <span
                                                    className={`min-w-0 truncate font-sans font-medium ${championshipStatHighlightClass(
                                                        highlightPhase,
                                                        stat,
                                                        'label',
                                                    )}`}
                                                >
                                                    {stat}
                                                </span>
                                                <div className="flex shrink-0 items-baseline gap-1">
                                                    <span
                                                        className={`font-mono ${championshipStatHighlightClass(highlightPhase, stat, 'value')}`}
                                                    >
                                                        {currentValue}
                                                    </span>
                                                    {tournamentStatus === 'round_in_progress' && change !== 0 ? (
                                                        <span className={change > 0 ? 'text-green-400' : 'text-red-400'}>
                                                            [{change > 0 ? '+' : ''}
                                                            {change}]
                                                        </span>
                                                    ) : null}
                                                    <span className="relative inline-block min-w-[2rem] text-right">
                                                        <span
                                                            className="whitespace-nowrap"
                                                            style={{
                                                                animation:
                                                                    statChanges[stat] !== undefined &&
                                                                    statChanges[stat] !== 0 &&
                                                                    tournamentStatus === 'round_in_progress'
                                                                        ? 'statChangeFade 2s ease-out forwards'
                                                                        : 'none',
                                                                opacity:
                                                                    statChanges[stat] !== undefined &&
                                                                    statChanges[stat] !== 0 &&
                                                                    tournamentStatus === 'round_in_progress'
                                                                        ? 1
                                                                        : 0,
                                                            }}
                                                        >
                                                            {statChanges[stat] !== undefined &&
                                                            statChanges[stat] !== 0 &&
                                                            tournamentStatus === 'round_in_progress' ? (
                                                                <span className={statChanges[stat] > 0 ? 'text-green-300' : 'text-red-300'}>
                                                                    ({statChanges[stat] > 0 ? '+' : ''}
                                                                    {statChanges[stat]})
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    } catch {
                                        return (
                                            <div key={stat} className={rowClass}>
                                                <span className="text-gray-400">{stat}</span>
                                                <span>-</span>
                                            </div>
                                        );
                                    }
                                })}
                                {(['early', 'mid', 'end'] as const).map((pk) => {
                                    const agg = championshipPhaseAggregateCellClass(pk, highlightPhase, true, 'inlineRow');
                                    const label = pk === 'early' ? tt('earlyAbility') : pk === 'mid' ? tt('midAbility') : tt('endAbility');
                                    const val = pk === 'early' ? phaseStats?.early : pk === 'mid' ? phaseStats?.mid : phaseStats?.end;
                                    return (
                                        <div key={pk} className={`text-[10px] ${agg.wrap}`}>
                                            <span className={agg.title}>{label}</span>
                                            <span className={`tabular-nums ${agg.value}`}>{val ?? 0}</span>
                                        </div>
                                    );
                                })}
                                {!championshipMobileStackedNoRadar && mobileRadarCompare ? (
                                    <div className="mt-1 flex w-full shrink-0 flex-col items-center">
                                        <div
                                            className="aspect-square w-full shrink-0"
                                            style={{ maxWidth: mobileRadarCompare.radarSize }}
                                        >
                                            <RadarChart
                                                datasets={mobileRadarCompare.datasets}
                                                maxStatValue={mobileRadarCompare.maxStatValue}
                                                size={mobileRadarCompare.radarSize}
                                            />
                                        </div>
                                        {radarLegendBelow ? <div className="mt-0.5 w-full max-w-full px-0.5">{radarLegendBelow}</div> : null}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex h-full min-h-0 flex-col gap-1 rounded-lg border border-gray-600/55 bg-slate-950/90 p-2 ${isClickable ? 'cursor-pointer hover:bg-slate-800/95' : ''}`} onClick={isClickable ? () => onViewUser(playerId) : undefined} title={isClickable ? tt('viewProfile', { name: playerNickname }) : ''} style={{ maxHeight: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            <div className="flex items-center gap-2 w-full flex-shrink-0">
                {showLeague && leagueInfo && (
                    <img
                        key={`league-${playerId}-${leagueInfo.tier}`}
                        src={leagueInfo.icon}
                        alt={leagueInfo.name}
                        className="w-9 h-9 object-contain drop-shadow-lg flex-shrink-0"
                        loading="lazy"
                    />
                )}
                <div
                    className="flex flex-shrink-0 items-center justify-center"
                    style={{
                        width: `${avatarSlotRem}rem`,
                        height: `${avatarSlotRem}rem`,
                        minWidth: `${avatarSlotRem}rem`,
                        minHeight: `${avatarSlotRem}rem`,
                    }}
                >
                    <Avatar key={`avatar-${playerId}`} userId={playerId} userName={playerNickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarSizePx} />
                </div>
                 <div className="min-w-0 flex-1">
                    <div className={`flex flex-row items-center ${isMobile ? 'gap-1 flex-wrap' : 'gap-1.5'}`}>
                        <h4 className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} truncate`}>{playerNickname}</h4>
                        <span className={`${isMobile ? 'text-xs' : 'text-xs'} text-blue-300 font-semibold whitespace-nowrap`}>{tt('badukAbility')}: {totalAbilityScore}</span>
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 truncate`}>({tt('recordWinsLosses', { wins: cumulativeStats.wins, losses: cumulativeStats.losses })})</p>
                 </div>
            </div>
            {/* 컨디션 표시 영역 - 항상 동일한 공간 유지 (대회 종료·탈락 후에는 숨김) */}
            <div className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} mt-0 relative flex items-center gap-2 w-full justify-center flex-shrink-0`} style={{ 
                visibility: showConditionInStatus ? 'visible' : 'hidden',
                height: showConditionInStatus ? 'auto' : '1.25rem',
                minHeight: '1.25rem'
            }}>
                <span className={isMobile ? 'text-xs' : 'text-sm'}>{tt('condition')}:</span> 
                <span className={`text-yellow-300 ${isMobile ? 'text-xs' : 'text-sm'} relative transition-all duration-300 ${
                    showConditionIncrease ? 'scale-125 text-green-300' : ''
                }`}>
                    {playerCondition === 1000 ? '-' : playerCondition}
                </span>
                {showConditionIncrease && conditionIncreaseAmount > 0 && (
                    <span className={`absolute ${isMobile ? 'text-sm' : 'text-base'} font-bold text-green-400 pointer-events-none whitespace-nowrap ${
                        isMobile ? 'top-[-14px]' : 'top-[-20px]'
                    }`} style={{
                        animation: 'fadeUp 2s ease-out forwards',
                        textShadow: '0 0 8px rgba(34, 197, 94, 0.8)'
                    }}>
                        +{conditionIncreaseAmount}
                    </span>
                )}
                {/* + 버튼 (현재 유저이고, 경기 전일 때만 표시, 자동 진행 대기 중이거나 경기 시작 후에는 비활성화) */}
                {isCurrentUser &&
                isUserMatch &&
                onUseConditionPotion &&
                shouldShowChampionshipConditionRecoveryButton({
                    condition: playerCondition,
                    tournamentStatus,
                }) ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (playerCondition >= 100 || !canUseConditionPotion) return;
                            onUseConditionPotion();
                        }}
                        disabled={playerCondition >= 100 || !canUseConditionPotion}
                        className={`ml-2 ${isMobile ? 'text-sm w-6 h-6' : 'text-base w-6 h-6'} ${
                            playerCondition >= 100 || !canUseConditionPotion
                                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                : 'bg-green-600 hover:bg-green-700'
                        } text-white rounded-full transition-colors flex-shrink-0 flex items-center justify-center font-bold`}
                        title={
                            playerCondition >= 100
                                ? tt('conditionMax')
                                : !canUseConditionPotion
                                  ? tt('conditionPotionUnavailable')
                                  : tt('useConditionPotion')
                        }
                    >
                        +
                    </button>
                ) : null}
            </div>
            <div
                className={`w-full mt-0 border-t border-gray-600 pt-0.5 flex-shrink-0 overflow-hidden grid grid-cols-4 items-baseline font-mono tabular-nums ${
                    isMobile ? 'gap-x-1 gap-y-0.5 text-[10px]' : 'gap-x-3 gap-y-0.5 text-xs'
                }`}
            >
                {Object.values(CoreStat).map(stat => {
                    try {
                        // 초기값: initialPlayer가 있으면 그것을 사용, 없으면 initialStats 사용
                        // player가 null이 아니지만 안전성을 위해 옵셔널 체이닝 사용
                        const initialValue = tournamentStatus === 'round_in_progress' 
                            ? (initialPlayer?.stats?.[stat] ?? initialStats[stat] ?? player?.originalStats?.[stat] ?? displayStats?.[stat] ?? 0)
                            : (displayStats?.[stat] ?? 0);
                        const currentValue = displayStats?.[stat] ?? 0;
                        const change = tournamentStatus === 'round_in_progress' ? (currentValue - initialValue) : 0;

                        const labelEl = (
                            <span
                                className={`truncate min-w-0 font-sans ${championshipStatHighlightClass(highlightPhase, stat, 'label')}`}
                            >
                                {stat}
                            </span>
                        );

                        const currentEl = (
                            <span
                                className={`text-right whitespace-nowrap ${championshipStatHighlightClass(highlightPhase, stat, 'value')} ${
                                    isMobile ? 'min-w-[1.25rem]' : 'min-w-[40px] text-xs'
                                }`}
                            >
                                {currentValue}
                            </span>
                        );

                        const bracketEl = (
                            <span
                                className={`text-right font-bold whitespace-nowrap ${
                                    isMobile ? 'min-w-[1.75rem]' : 'ml-1 text-xs min-w-[45px]'
                                }`}
                            >
                                {tournamentStatus === 'round_in_progress' && change !== 0 ? (
                                    <span className={change > 0 ? 'text-green-400' : 'text-red-400'}>
                                        [{change > 0 ? '+' : ''}
                                        {change}]
                                    </span>
                                ) : isMobile ? (
                                    <span className="invisible" aria-hidden>
                                        [+0]
                                    </span>
                                ) : null}
                            </span>
                        );

                        const popEl = (
                            <span
                                className={`text-right font-bold relative ${isMobile ? 'h-[1.15em] min-w-[2rem]' : 'ml-1 min-w-[50px] text-sm'}`}
                            >
                                <span
                                    className="absolute right-0 top-0 whitespace-nowrap"
                                    style={{
                                        animation:
                                            statChanges[stat] !== undefined &&
                                            statChanges[stat] !== 0 &&
                                            tournamentStatus === 'round_in_progress'
                                                ? 'statChangeFade 2s ease-out forwards'
                                                : 'none',
                                        opacity:
                                            statChanges[stat] !== undefined &&
                                            statChanges[stat] !== 0 &&
                                            tournamentStatus === 'round_in_progress'
                                                ? 1
                                                : 0,
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {statChanges[stat] !== undefined &&
                                    statChanges[stat] !== 0 &&
                                    tournamentStatus === 'round_in_progress' ? (
                                        <span
                                            className={`${isMobile ? 'text-[10px]' : 'text-sm'} ${statChanges[stat] > 0 ? 'text-green-300' : 'text-red-300'}`}
                                        >
                                            ({statChanges[stat] > 0 ? '+' : ''}
                                            {statChanges[stat]})
                                        </span>
                                    ) : null}
                                </span>
                                <span className={`invisible whitespace-nowrap ${isMobile ? 'text-[10px]' : 'text-sm'}`} aria-hidden>
                                    (+99)
                                </span>
                            </span>
                        );

                        const numbersEl = (
                            <div
                                className={`flex min-w-0 justify-end items-baseline ${isMobile ? 'gap-0.5' : ''}`}
                            >
                                {currentEl}
                                {bracketEl}
                                {popEl}
                            </div>
                        );

                        return (
                            <React.Fragment key={stat}>
                                {labelEl}
                                {numbersEl}
                            </React.Fragment>
                        );
                    } catch (error) {
                        if (import.meta.env.DEV) {
                            console.error(`[PlayerProfilePanel] Error rendering stat ${stat}:`, error);
                        }
                        return (
                            <React.Fragment key={stat}>
                                <span className="text-gray-400 truncate min-w-0">{stat}</span>
                                <div className="flex min-w-0 justify-end items-baseline">
                                    <span className="font-mono text-white">-</span>
                                </div>
                            </React.Fragment>
                        );
                    }
                })}
            </div>
            {/* 초반/중반/종반 능력치 표시 */}
            {phaseStats && typeof phaseStats === 'object' && (
                <div className="w-full border-t border-gray-600 mt-0 pt-0.5 flex-shrink-0">
                    <div className={`grid grid-cols-3 gap-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                        {(['early', 'mid', 'end'] as const).map((pk) => {
                            const agg = championshipPhaseAggregateCellClass(pk, highlightPhase, isMobile);
                            const label = pk === 'early' ? tt('earlyAbility') : pk === 'mid' ? tt('midAbility') : tt('endAbility');
                            const val = pk === 'early' ? phaseStats?.early : pk === 'mid' ? phaseStats?.mid : phaseStats?.end;
                            return (
                                <div key={pk} className={agg.wrap}>
                                    <div className={`${agg.title} ${isMobile ? 'mb-0' : 'mb-0'}`}>{label}</div>
                                    <div className={`${agg.value} ${isMobile ? 'text-xs' : 'text-sm'}`}>{val ?? 0}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/** 모바일 챔피언십: 대국자 정보 탭 — 선수별 카드 옆에 해당 선수 상태·능력(하단 액션은 부모 고정 바) */
const MobileChampionshipPlayersCompare: React.FC<{
    p1: PlayerForTournament | null;
    p2: PlayerForTournament | null;
    initialP1: PlayerForTournament | null;
    initialP2: PlayerForTournament | null;
    p1Stats: Record<string, number>;
    p2Stats: Record<string, number>;
    allUsers: User[];
    currentUserId: string;
    onViewUser: (userId: string) => void;
    tournamentStatus: string;
    canUseConditionPotion: boolean;
    onUseConditionPotion: () => void;
    conditionFallback?: number;
    isUserMatchP1: boolean;
    isUserMatchP2: boolean;
    highlightPhase: 'early' | 'mid' | 'end' | 'none';
}> = ({
    p1,
    p2,
    initialP1,
    initialP2,
    p1Stats,
    p2Stats,
    allUsers,
    currentUserId,
    onViewUser,
    tournamentStatus,
    canUseConditionPotion,
    onUseConditionPotion,
    conditionFallback,
    isUserMatchP1,
    isUserMatchP2,
    highlightPhase,
}) => {
    const [infoTab, setInfoTab] = useState<'status' | 'abilities'>('status');

    const fullU1 = useMemo(() => (p1?.id ? allUsers.find((u) => u.id === p1.id) : undefined), [allUsers, p1?.id]);
    const fullU2 = useMemo(() => (p2?.id ? allUsers.find((u) => u.id === p2.id) : undefined), [allUsers, p2?.id]);

    const winLine = (full: User | undefined) => {
        let wins = 0;
        let losses = 0;
        if (full?.stats) {
            Object.values(full.stats).forEach((s) => {
                wins += s.wins ?? 0;
                losses += s.losses ?? 0;
            });
        }
        const total = wins + losses;
        if (total === 0) return tt('noRecord');
        return tt('winRateWithRecord', { rate: ((100 * wins) / total).toFixed(1), wins, losses });
    };

    const totalAbility = (stats: Record<string, number>) =>
        Math.round(Object.values(stats).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0));

    const phasePowers = (stats: Record<string, number>) => {
        const calc = (phase: 'early' | 'mid' | 'end') => {
            const weights = STAT_WEIGHTS[phase];
            let power = 0;
            for (const k in weights) {
                const statKey = k as CoreStat;
                const w = weights[statKey];
                if (w != null) power += (stats[statKey] || 0) * w;
            }
            return Math.round(power);
        };
        return { early: calc('early'), mid: calc('mid'), end: calc('end') };
    };

    const showCondition =
        tournamentStatus !== 'complete' &&
        tournamentStatus !== 'eliminated' &&
        (tournamentStatus === 'round_in_progress' ||
            tournamentStatus === 'bracket_ready' ||
            tournamentStatus === 'round_complete');

    const resolveCondition = (player: PlayerForTournament | null, isCurrentUser: boolean) =>
        resolveChampionshipDisplayCondition({
            playerCondition: player?.condition,
            snapshotCondition: conditionFallback,
            isCurrentUser,
        });

    /** 컨디션 수치 색상: 50 미만 빨강, 80 이상 초록, 그 사이 주황 계열 */
    const conditionValueClass = (cond: number) => {
        if (cond === 1000) return 'text-zinc-500';
        if (cond < 50) return 'text-red-400';
        if (cond >= 80) return 'text-green-400';
        return 'text-amber-200';
    };

    const avatarPx = 40;

    const ph1 = phasePowers(p1Stats as Record<CoreStat, number>);
    const ph2 = phasePowers(p2Stats as Record<CoreStat, number>);
    const sum1 = totalAbility(p1Stats);
    const sum2 = totalAbility(p2Stats);
    const sumDelta = sum2 - sum1;
    const sumDeltaCls = sumDelta > 0 ? 'text-green-400' : sumDelta < 0 ? 'text-red-400' : 'text-stone-500';

    const initSum1 = useMemo(() => {
        const raw = initialP1?.stats ?? p1?.originalStats;
        if (tournamentStatus === 'round_in_progress' && raw && typeof raw === 'object') {
            return totalAbility(raw as Record<string, number>);
        }
        return totalAbility(p1Stats);
    }, [tournamentStatus, initialP1?.stats, p1?.originalStats, p1Stats]);

    const initSum2 = useMemo(() => {
        const raw = initialP2?.stats ?? p2?.originalStats;
        if (tournamentStatus === 'round_in_progress' && raw && typeof raw === 'object') {
            return totalAbility(raw as Record<string, number>);
        }
        return totalAbility(p2Stats);
    }, [tournamentStatus, initialP2?.stats, p2?.originalStats, p2Stats]);

    const sumCh1 = tournamentStatus === 'round_in_progress' ? sum1 - initSum1 : 0;
    const sumCh2 = tournamentStatus === 'round_in_progress' ? sum2 - initSum2 : 0;

    const renderPlayerSideCard = (
        tone: 'cyan' | 'amber',
        title: string,
        player: PlayerForTournament | null,
        _isUserMatch: boolean,
    ) => {
        const borderTone = tone === 'cyan' ? 'border-cyan-500/35' : 'border-amber-500/35';
        const titleCls = tone === 'cyan' ? 'text-cyan-200' : 'text-amber-200';
        if (!player?.id || !player.nickname) {
            return (
                <div className={`flex min-h-0 flex-1 basis-0 flex-col rounded-md border ${borderTone} bg-black/25 p-0.5`}>
                    {title ? (
                        <div className={`mb-0.5 text-center text-[10px] font-semibold ${titleCls}`}>{title}</div>
                    ) : null}
                    <div className="flex min-h-[4.5rem] flex-1 items-center justify-center px-0.5 text-center text-[10px] text-stone-500">
                        {tt('playerWaitingShort')}
                    </div>
                </div>
            );
        }
        const isCurrent = player.id === currentUserId;
        const clickable = !player.id.startsWith('bot-') && !isCurrent;
        const avatarUrl = AVATAR_POOL.find((a) => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find((b) => b.id === player.borderId)?.url;
        return (
            <div className={`flex min-h-0 flex-1 basis-0 flex-col rounded-md border ${borderTone} bg-black/25 p-0.5`}>
                {title ? <div className={`mb-0.5 text-center text-[10px] font-semibold ${titleCls}`}>{title}</div> : null}
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5">
                    <div
                        className={`mx-auto w-[88%] shrink-0 ${clickable ? 'cursor-pointer' : ''}`}
                        onClick={clickable ? () => onViewUser(player.id) : undefined}
                        title={clickable ? tt('viewProfile', { name: player.nickname }) : ''}
                    >
                        <div className="flex justify-center">
                            <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarPx} />
                        </div>
                    </div>
                    <div className="w-full px-0.5 text-center leading-tight">
                        <div className={`text-[11px] font-semibold whitespace-normal break-words sm:text-xs ${titleCls}`}>
                            {player.nickname}
                        </div>
                        {isCurrent ? <div className="text-[10px] font-semibold text-amber-300/90">{tt('me')}</div> : null}
                    </div>
                </div>
            </div>
        );
    };

    const abilityHeaderAvatarPx = 36;
    const renderAbilityPlayerHeader = (player: PlayerForTournament | null, tone: 'cyan' | 'amber') => {
        const titleCls = tone === 'cyan' ? 'text-cyan-200' : 'text-amber-200';
        if (!player?.id || !player.nickname) {
            return (
                <div className="flex min-h-[3.75rem] flex-col items-center justify-center rounded-md bg-black/25 py-1">
                    <span className="text-[0.95em] text-stone-500">—</span>
                </div>
            );
        }
        const isCurrent = player.id === currentUserId;
        const clickable = !player.id.startsWith('bot-') && !isCurrent;
        const avatarUrl = AVATAR_POOL.find((a) => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find((b) => b.id === player.borderId)?.url;
        return (
            <div className="flex flex-col items-center gap-0.5 rounded-md bg-black/20 py-1">
                <div
                    className={clickable ? 'cursor-pointer' : ''}
                    onClick={clickable ? () => onViewUser(player.id) : undefined}
                    title={clickable ? tt('viewProfile', { name: player.nickname }) : ''}
                >
                    <Avatar
                        userId={player.id}
                        userName={player.nickname}
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                        size={abilityHeaderAvatarPx}
                    />
                </div>
                <div className={`w-full px-0.5 text-center text-[0.95em] font-semibold leading-tight ${titleCls}`}>
                    <span className="line-clamp-2 break-words">{player.nickname}</span>
                </div>
                {isCurrent ? <span className="text-[0.82em] font-semibold text-amber-300/90">{tt('me')}</span> : null}
            </div>
        );
    };

    return (
        <section className="mb-0 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden overscroll-y-contain">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-panel-secondary/90 shadow-inner">
                <div className="grid shrink-0 grid-cols-2 gap-0.5 border-b border-cyan-500/20 px-1 py-1.5">
                    {(
                        [
                            ['status', tt('statusInfo')],
                            ['abilities', tt('abilityStats')],
                        ] as const
                    ).map(([key, label]) => {
                        const active = infoTab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setInfoTab(key)}
                                className={`rounded-md border px-0.5 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                    active
                                        ? 'border-amber-400/70 bg-amber-900/40 text-amber-100'
                                        : 'border-gray-600/60 bg-black/25 text-gray-300'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-0 flex-1 p-1">
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                        {infoTab === 'status' ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-1">
                                <div className="flex min-h-0 min-h-[5.5rem] flex-1 gap-1 overflow-hidden">
                                    <div className="flex w-[30%] max-w-[6.5rem] shrink-0 flex-col justify-start">
                                        {renderPlayerSideCard('cyan', '', p1, isUserMatchP1)}
                                    </div>
                                    <div
                                        className="flex min-h-0 flex-1 flex-col justify-center space-y-1.5 overflow-y-auto rounded-md bg-gray-900/50 p-1.5 text-center"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                    >
                                        {showCondition ? (
                                            <div className="rounded-md bg-black/25 px-2 py-2">
                                                <div className="text-xs font-semibold text-stone-400">{tt('condition')}</div>
                                                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                                                    <span
                                                        className={`font-mono text-lg font-bold tabular-nums ${conditionValueClass(
                                                            p1 ? resolveCondition(p1, p1.id === currentUserId) : 1000,
                                                        )}`}
                                                    >
                                                        {p1
                                                            ? resolveCondition(p1, p1.id === currentUserId) === 1000
                                                                ? '—'
                                                                : resolveCondition(p1, p1.id === currentUserId)
                                                            : '—'}
                                                    </span>
                                                    {p1?.id === currentUserId &&
                                                    isUserMatchP1 &&
                                                    shouldShowChampionshipConditionRecoveryButton({
                                                        condition: p1 ? resolveCondition(p1, true) : 1000,
                                                        tournamentStatus,
                                                    }) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const c = p1 ? resolveCondition(p1, true) : 1000;
                                                                if (c >= 100 || !canUseConditionPotion) return;
                                                                onUseConditionPotion();
                                                            }}
                                                            disabled={
                                                                !p1 ||
                                                                resolveCondition(p1, true) >= 100 ||
                                                                !canUseConditionPotion
                                                            }
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                                                !p1 ||
                                                                resolveCondition(p1, true) >= 100 ||
                                                                !canUseConditionPotion
                                                                    ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                                    : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                            title={
                                                                p1 && resolveCondition(p1, true) >= 100
                                                                    ? tt('conditionMax')
                                                                    : !canUseConditionPotion
                                                                      ? tt('conditionPotionUnavailable')
                                                                      : tt('useConditionPotion')
                                                            }
                                                        >
                                                            +
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">{tt('badukAbility')}</div>
                                            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 font-mono text-base font-bold tabular-nums text-cyan-200 sm:text-lg">
                                                <span>{sum1}</span>
                                                {sumCh1 !== 0 ? (
                                                    <span className={sumCh1 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                        ({sumCh1 > 0 ? '+' : ''}
                                                        {sumCh1})
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">{tt('winRateRecord')}</div>
                                            <div className="mt-1 text-sm font-medium leading-snug text-cyan-100/95">
                                                {winLine(fullU1)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex min-h-0 min-h-[5.5rem] flex-1 gap-1 overflow-hidden">
                                    <div className="flex w-[30%] max-w-[6.5rem] shrink-0 flex-col justify-start">
                                        {renderPlayerSideCard('amber', '', p2, isUserMatchP2)}
                                    </div>
                                    <div
                                        className="flex min-h-0 flex-1 flex-col justify-center space-y-1.5 overflow-y-auto rounded-md bg-gray-900/50 p-1.5 text-center"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                    >
                                        {showCondition ? (
                                            <div className="rounded-md bg-black/25 px-2 py-2">
                                                <div className="text-xs font-semibold text-stone-400">{tt('condition')}</div>
                                                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                                                    <span
                                                        className={`font-mono text-lg font-bold tabular-nums ${conditionValueClass(
                                                            p2 ? resolveCondition(p2, p2.id === currentUserId) : 1000,
                                                        )}`}
                                                    >
                                                        {p2
                                                            ? resolveCondition(p2, p2.id === currentUserId) === 1000
                                                                ? '—'
                                                                : resolveCondition(p2, p2.id === currentUserId)
                                                            : '—'}
                                                    </span>
                                                    {p2?.id === currentUserId &&
                                                    isUserMatchP2 &&
                                                    shouldShowChampionshipConditionRecoveryButton({
                                                        condition: p2 ? resolveCondition(p2, true) : 1000,
                                                        tournamentStatus,
                                                    }) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const c = p2 ? resolveCondition(p2, true) : 1000;
                                                                if (c >= 100 || !canUseConditionPotion) return;
                                                                onUseConditionPotion();
                                                            }}
                                                            disabled={
                                                                !p2 ||
                                                                resolveCondition(p2, true) >= 100 ||
                                                                !canUseConditionPotion
                                                            }
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                                                !p2 ||
                                                                resolveCondition(p2, true) >= 100 ||
                                                                !canUseConditionPotion
                                                                    ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                                    : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                            title={
                                                                p2 && resolveCondition(p2, true) >= 100
                                                                    ? tt('conditionMax')
                                                                    : !canUseConditionPotion
                                                                      ? tt('conditionPotionUnavailable')
                                                                      : tt('useConditionPotion')
                                                            }
                                                        >
                                                            +
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">{tt('badukAbility')}</div>
                                            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 font-mono text-base font-bold tabular-nums text-amber-200 sm:text-lg">
                                                <span>{sum2}</span>
                                                {sumCh2 !== 0 ? (
                                                    <span className={sumCh2 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                        ({sumCh2 > 0 ? '+' : ''}
                                                        {sumCh2})
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">{tt('winRateRecord')}</div>
                                            <div className="mt-1 text-sm font-medium leading-snug text-amber-100/95">
                                                {winLine(fullU2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                                <div
                                    className="min-h-0 flex-1 overflow-y-auto rounded-md bg-gray-900/50 p-0.5 sm:p-1"
                                    style={{
                                        WebkitOverflowScrolling: 'touch',
                                        fontSize: 'clamp(8.5px, min(2.75vw, 3.15vmin), 11.5px)',
                                    }}
                                >
                                    <div className="grid grid-cols-[minmax(2.5rem,22%)_minmax(0,1fr)_minmax(0,1fr)] gap-x-0.5 gap-y-0.5">
                                        <div className="min-h-[3.5em] min-w-0" aria-hidden />
                                        <div className="min-w-0">{renderAbilityPlayerHeader(p1, 'cyan')}</div>
                                        <div className="min-w-0 border-l border-gray-600/30 pl-0.5">
                                            {renderAbilityPlayerHeader(p2, 'amber')}
                                        </div>

                                        {Object.values(CoreStat).map((stat) => {
                                            const init1 =
                                                tournamentStatus === 'round_in_progress'
                                                    ? (initialP1?.stats?.[stat] ?? p1?.originalStats?.[stat] ?? p1Stats[stat] ?? 0)
                                                    : (p1Stats[stat] ?? 0);
                                            const init2 =
                                                tournamentStatus === 'round_in_progress'
                                                    ? (initialP2?.stats?.[stat] ?? p2?.originalStats?.[stat] ?? p2Stats[stat] ?? 0)
                                                    : (p2Stats[stat] ?? 0);
                                            const cur1 = p1Stats[stat] ?? 0;
                                            const cur2 = p2Stats[stat] ?? 0;
                                            const ch1 = tournamentStatus === 'round_in_progress' ? cur1 - init1 : 0;
                                            const ch2 = tournamentStatus === 'round_in_progress' ? cur2 - init2 : 0;
                                            const hi =
                                                highlightPhase !== 'none' && KEY_STATS_BY_PHASE[highlightPhase].includes(stat);
                                            const labelCls = `text-[0.92em] font-semibold leading-snug ${championshipStatHighlightClass(
                                                highlightPhase,
                                                stat,
                                                'label',
                                            )}`;
                                            const hiRing =
                                                hi && highlightPhase === 'early'
                                                    ? 'ring-cyan-400/35 bg-cyan-500/10'
                                                    : hi && highlightPhase === 'mid'
                                                      ? 'ring-fuchsia-400/32 bg-fuchsia-500/10'
                                                      : hi && highlightPhase === 'end'
                                                        ? 'ring-amber-400/35 bg-amber-500/10'
                                                        : 'ring-white/[0.06]';
                                            return (
                                                <React.Fragment key={stat}>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md bg-black/25 px-0.5 py-[0.2em] text-center ring-1 ring-inset ring-white/[0.06] ${labelCls}`}
                                                    >
                                                        {stat}
                                                    </div>
                                                    <div
                                                        className={`flex min-h-[1.55em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center font-mono text-[1.06em] tabular-nums leading-none ring-1 ring-inset ${hiRing} ${
                                                            hi ? 'text-sky-100' : 'text-cyan-100'
                                                        }`}
                                                    >
                                                        <span>{cur1}</span>
                                                        {ch1 !== 0 ? (
                                                            <span className={ch1 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                                ({ch1 > 0 ? '+' : ''}
                                                                {ch1})
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div
                                                        className={`flex min-h-[1.55em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center font-mono text-[1.06em] tabular-nums leading-none ring-1 ring-inset ${hiRing} ${
                                                            hi ? 'text-amber-50' : 'text-amber-100'
                                                        }`}
                                                    >
                                                        <span>{cur2}</span>
                                                        {ch2 !== 0 ? (
                                                            <span className={ch2 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                                ({ch2 > 0 ? '+' : ''}
                                                                {ch2})
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        {(['early', 'mid', 'end'] as const).map((phase) => {
                                            const label = phase === 'early' ? tt('earlyAbility') : phase === 'mid' ? tt('midAbility') : tt('endAbility');
                                            const v1 = ph1[phase];
                                            const v2 = ph2[phase];
                                            const isRowActive = highlightPhase === phase;
                                            const labelTone =
                                                phase === 'early'
                                                    ? 'text-cyan-200'
                                                    : phase === 'mid'
                                                      ? 'text-fuchsia-200'
                                                      : 'text-amber-200';
                                            const labelCls = `text-[0.92em] font-semibold ${
                                                isRowActive ? `${labelTone} font-bold` : 'text-stone-500'
                                            }`;
                                            const p1Inactive = 'border-slate-600/35 bg-black/20 text-cyan-200/65';
                                            const p2Inactive = 'border-slate-600/35 bg-black/20 text-amber-200/65';
                                            const p1Cell = isRowActive
                                                ? phase === 'early'
                                                    ? 'border-cyan-500/50 bg-cyan-950/35 text-cyan-50 ring-1 ring-cyan-400/25'
                                                    : phase === 'mid'
                                                      ? 'border-fuchsia-500/50 bg-fuchsia-950/32 text-fuchsia-50 ring-1 ring-fuchsia-400/22'
                                                      : 'border-amber-500/50 bg-amber-950/32 text-amber-50 ring-1 ring-amber-400/28'
                                                : p1Inactive;
                                            const p2Cell = isRowActive
                                                ? phase === 'early'
                                                    ? 'border-cyan-500/45 bg-cyan-950/28 text-amber-100 ring-1 ring-cyan-400/22'
                                                    : phase === 'mid'
                                                      ? 'border-fuchsia-500/45 bg-fuchsia-950/28 text-amber-100 ring-1 ring-fuchsia-400/20'
                                                      : 'border-amber-500/45 bg-amber-950/28 text-amber-100 ring-1 ring-amber-400/25'
                                                : p2Inactive;
                                            return (
                                                <React.Fragment key={phase}>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md bg-black/25 px-0.5 py-[0.2em] text-center ring-1 ring-inset ring-white/[0.06] ${labelCls}`}
                                                    >
                                                        {label}
                                                    </div>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md border px-0.5 py-[0.2em] text-center font-mono text-[0.98em] tabular-nums ${p1Cell}`}
                                                    >
                                                        {v1}
                                                    </div>
                                                    <div
                                                        className={`flex min-h-[1.55em] items-center justify-center rounded-md border px-0.5 py-[0.2em] text-center font-mono text-[0.98em] tabular-nums ${p2Cell}`}
                                                    >
                                                        {v2}
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        <div className="flex min-h-[1.65em] items-center justify-center rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[0.92em] font-semibold text-stone-400 ring-1 ring-inset ring-white/[0.06]">
                                            종합 능력
                                        </div>
                                        <div className="flex min-h-[1.65em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[1.06em] font-bold tabular-nums text-cyan-100 ring-1 ring-inset ring-white/[0.06]">
                                            <span>{sum1}</span>
                                            {sumCh1 !== 0 ? (
                                                <span className={sumCh1 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                    ({sumCh1 > 0 ? '+' : ''}
                                                    {sumCh1})
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex min-h-[1.65em] flex-wrap items-center justify-center gap-x-0.5 rounded-md bg-black/25 px-0.5 py-[0.2em] text-center text-[1.06em] font-bold tabular-nums text-amber-100 ring-1 ring-inset ring-white/[0.06]">
                                            <span>{sum2}</span>
                                            {sumCh2 !== 0 ? (
                                                <span className={sumCh2 > 0 ? 'text-green-400' : 'text-red-400'}>
                                                    ({sumCh2 > 0 ? '+' : ''}
                                                    {sumCh2})
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                {sumDelta !== 0 ? (
                                    <div
                                        className="shrink-0 rounded-md bg-black/30 px-1 py-0.5 text-center font-bold"
                                        style={{ fontSize: 'clamp(9px, min(2.6vw, 3vmin), 11px)' }}
                                    >
                                        <span className="text-stone-500">{tt('difference')} </span>
                                        <span className={sumDeltaCls}>
                                            {sumDelta > 0 ? '+' : ''}
                                            {sumDelta}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

const SimulationProgressBar: React.FC<{ timeElapsed: number; totalDuration: number; compact?: boolean }> = ({
    timeElapsed,
    totalDuration,
    compact = false,
}) => {
    const progress = (timeElapsed / totalDuration) * 100;
    // totalDuration에 맞게 동적으로 계산 (초반 15초, 중반 20초, 종반 15초 비율 유지)
    const EARLY_GAME_DURATION = 15;
    const MID_GAME_DURATION = 20;
    const END_GAME_DURATION = 15;
    const BASE_TOTAL = EARLY_GAME_DURATION + MID_GAME_DURATION + END_GAME_DURATION; // 50
    
    // totalDuration이 BASE_TOTAL과 다를 경우 비율로 스케일링
    const earlyDuration = (EARLY_GAME_DURATION / BASE_TOTAL) * totalDuration;
    const midDuration = (MID_GAME_DURATION / BASE_TOTAL) * totalDuration;
    const endDuration = (END_GAME_DURATION / BASE_TOTAL) * totalDuration;
    
    const earlyStage = Math.min(progress, (earlyDuration / totalDuration) * 100);
    const midStage = Math.min(Math.max(0, progress - (earlyDuration / totalDuration) * 100), (midDuration / totalDuration) * 100);
    const endStage = Math.min(Math.max(0, progress - ((earlyDuration + midDuration) / totalDuration) * 100), (endDuration / totalDuration) * 100);

    return (
        <div>
            <div
                className={`flex w-full overflow-hidden rounded-full border border-gray-600 bg-gray-900 ${compact ? 'h-1.5' : 'h-2'}`}
            >
                <div
                    className="h-full rounded-l-full bg-green-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${earlyStage}%` }}
                    title={tt('openingMatch')}
                />
                <div
                    className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${midStage}%` }}
                    title={tt('midgameMatch')}
                />
                <div
                    className="h-full rounded-r-full bg-red-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${endStage}%` }}
                    title={tt('endgameMatch')}
                />
            </div>
            <div className={`flex text-gray-400 ${compact ? 'mt-0.5 text-[9px] leading-tight' : 'mt-1 text-xs'}`}>
                <div style={{ width: `${(earlyDuration / totalDuration) * 100}%` }}>{tt('phases.opening')}</div>
                <div style={{ width: `${(midDuration / totalDuration) * 100}%` }} className="text-center">
                    중반
                </div>
                <div style={{ width: `${(endDuration / totalDuration) * 100}%` }} className="text-right">
                    종반
                </div>
            </div>
        </div>
    );
};

const ScoreGraph: React.FC<{ 
    p1Percent: number; 
    p2Percent: number; 
    p1Nickname?: string; 
    p2Nickname?: string; 
    p1Cumulative?: number; 
    p2Cumulative?: number; 
    p1Player?: PlayerForTournament | null; 
    p2Player?: PlayerForTournament | null; 
    lastScoreIncrement?: { 
        player1: { base: number; actual: number; isCritical: boolean } | null; 
        player2: { base: number; actual: number; isCritical: boolean } | null; 
    } | null;
    /** 모바일 실시간 중계 등 좁은 폭: 닉네임 줄바꿈·내부 점수 팝업 */
    compact?: boolean;
}> = ({
    p1Percent,
    p2Percent,
    p1Nickname,
    p2Nickname,
    p1Cumulative = 0,
    p2Cumulative = 0,
    p1Player,
    p2Player,
    lastScoreIncrement,
    compact = false,
}) => {
    const [p1Animations, setP1Animations] = useState<Array<{ value: number; isCritical: boolean; key: string }>>([]);
    const [p2Animations, setP2Animations] = useState<Array<{ value: number; isCritical: boolean; key: string }>>([]);
    const [p1DisplayScore, setP1DisplayScore] = useState(p1Cumulative);
    const [p2DisplayScore, setP2DisplayScore] = useState(p2Cumulative);
    const prevP1ValueRef = useRef<string | null>(null); // 중복 방지를 위한 키 저장
    const prevP2ValueRef = useRef<string | null>(null); // 중복 방지를 위한 키 저장
    const scoreBoardRef = useRef<HTMLDivElement>(null);
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const p1GraphProfileRef = useRef<HTMLDivElement>(null); // 그래프 내부의 프로필 참조
    const p2GraphProfileRef = useRef<HTMLDivElement>(null); // 그래프 내부의 프로필 참조
    const isFirstMountP1Ref = useRef(true);
    const isFirstMountP2Ref = useRef(true);
    const timeoutRefsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const p1AnimationFrameRef = useRef<number | null>(null);
    const p2AnimationFrameRef = useRef<number | null>(null);
    const p1AnimationStartRef = useRef<number | null>(null);
    const p2AnimationStartRef = useRef<number | null>(null);
    const lastAnimationTimeRef = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
    
    // 아바타 URL 계산
    const p1AvatarUrl = useMemo(() => p1Player ? AVATAR_POOL.find(a => a.id === p1Player.avatarId)?.url : undefined, [p1Player?.avatarId]);
    const p1BorderUrl = useMemo(() => p1Player ? BORDER_POOL.find(b => b.id === p1Player.borderId)?.url : undefined, [p1Player?.borderId]);
    const p2AvatarUrl = useMemo(() => p2Player ? AVATAR_POOL.find(a => a.id === p2Player.avatarId)?.url : undefined, [p2Player?.avatarId]);
    const p2BorderUrl = useMemo(() => p2Player ? BORDER_POOL.find(b => b.id === p2Player.borderId)?.url : undefined, [p2Player?.borderId]);
    
    // 점수 숫자 애니메이션 (스코어보드에 더해질 때)
    useEffect(() => {
        // 초기화 시에는 즉시 설정 (애니메이션 없이)
        if (p1AnimationStartRef.current === null) {
            p1AnimationStartRef.current = p1Cumulative;
            setP1DisplayScore(p1Cumulative);
            return;
        }
        
        const duration = 500; // 0.5초 동안 증가
        const startScore = p1AnimationStartRef.current;
        const targetScore = p1Cumulative;
        const difference = targetScore - startScore;
        
        if (Math.abs(difference) < 0.01) return;
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic 함수 사용
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + difference * easedProgress);
            
            setP1DisplayScore(currentScore);
            
            if (progress < 1) {
                p1AnimationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setP1DisplayScore(targetScore);
                p1AnimationStartRef.current = targetScore;
            }
        };
        
        // 기존 애니메이션 취소
        if (p1AnimationFrameRef.current !== null) {
            cancelAnimationFrame(p1AnimationFrameRef.current);
        }
        
        animate();
        
        return () => {
            if (p1AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p1AnimationFrameRef.current);
            }
        };
    }, [p1Cumulative]);
    
    useEffect(() => {
        // 초기화 시에는 즉시 설정 (애니메이션 없이)
        if (p2AnimationStartRef.current === null) {
            p2AnimationStartRef.current = p2Cumulative;
            setP2DisplayScore(p2Cumulative);
            return;
        }
        
        const duration = 500;
        const startScore = p2AnimationStartRef.current;
        const targetScore = p2Cumulative;
        const difference = targetScore - startScore;
        
        if (Math.abs(difference) < 0.01) return;
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + difference * easedProgress);
            
            setP2DisplayScore(currentScore);
            
            if (progress < 1) {
                p2AnimationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setP2DisplayScore(targetScore);
                p2AnimationStartRef.current = targetScore;
            }
        };
        
        // 기존 애니메이션 취소
        if (p2AnimationFrameRef.current !== null) {
            cancelAnimationFrame(p2AnimationFrameRef.current);
        }
        
        animate();
        
        return () => {
            if (p2AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p2AnimationFrameRef.current);
            }
        };
    }, [p2Cumulative]);
    
    // lastScoreIncrement가 변경되면 애니메이션 트리거 (스코어보드 양쪽에서 나타남)
    useEffect(() => {
        if (isFirstMountP1Ref.current) {
            // 첫 마운트 시에는 현재 값 저장만 하고 애니메이션 트리거하지 않음
            if (lastScoreIncrement?.player1) {
                prevP1ValueRef.current = `${lastScoreIncrement.player1.actual}-${lastScoreIncrement.player1.isCritical}`;
            }
            isFirstMountP1Ref.current = false;
            return;
        }
        
        // lastScoreIncrement.player1이 있고, 값이 0보다 크면 애니메이션 트리거
        // 1초마다 한 번만 트리거 (중복 방지)
        if (lastScoreIncrement?.player1 && lastScoreIncrement.player1.actual > 0) {
            const now = Date.now();
            const timeSinceLastAnimation = now - lastAnimationTimeRef.current.p1;
            
            // 1초 이상 경과했거나, 이전 값과 다르면 새로운 애니메이션 트리거
            const increment = lastScoreIncrement.player1.actual;
            const isCritical = lastScoreIncrement.player1.isCritical;
            const currentKey = `${increment}-${isCritical}`;
            
            if (timeSinceLastAnimation >= 1000 || prevP1ValueRef.current !== currentKey) {
                const animationKey = `p1-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                const newAnimation = { 
                    value: increment, // 증가량 표시
                    isCritical: isCritical,
                    key: animationKey
                };
                
                setP1Animations(prev => [...prev, newAnimation]);
                prevP1ValueRef.current = currentKey;
                lastAnimationTimeRef.current.p1 = now;
                
                // 1초 후 애니메이션 제거
                const timeoutId = setTimeout(() => {
                    setP1Animations(prev => prev.filter(anim => anim.key !== animationKey));
                }, 1000);
                
                timeoutRefsRef.current.push(timeoutId);
            }
        } else if (!lastScoreIncrement?.player1) {
            // 점수 증가가 없으면 prevP1ValueRef 초기화
            prevP1ValueRef.current = null;
        }
    }, [lastScoreIncrement?.player1]);
    
    // lastScoreIncrement가 변경되면 애니메이션 트리거 (스코어보드 양쪽에서 나타남)
    useEffect(() => {
        if (isFirstMountP2Ref.current) {
            // 첫 마운트 시에는 현재 값 저장만 하고 애니메이션 트리거하지 않음
            if (lastScoreIncrement?.player2) {
                prevP2ValueRef.current = `${lastScoreIncrement.player2.actual}-${lastScoreIncrement.player2.isCritical}`;
            }
            isFirstMountP2Ref.current = false;
            return;
        }
        
        // lastScoreIncrement.player2가 있고, 값이 0보다 크면 애니메이션 트리거
        // 1초마다 한 번만 트리거 (중복 방지)
        if (lastScoreIncrement?.player2 && lastScoreIncrement.player2.actual > 0) {
            const now = Date.now();
            const timeSinceLastAnimation = now - lastAnimationTimeRef.current.p2;
            
            // 1초 이상 경과했거나, 이전 값과 다르면 새로운 애니메이션 트리거
            const increment = lastScoreIncrement.player2.actual;
            const isCritical = lastScoreIncrement.player2.isCritical;
            const currentKey = `${increment}-${isCritical}`;
            
            if (timeSinceLastAnimation >= 1000 || prevP2ValueRef.current !== currentKey) {
                const animationKey = `p2-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                const newAnimation = { 
                    value: increment, // 증가량 표시
                    isCritical: isCritical,
                    key: animationKey
                };
                
                setP2Animations(prev => [...prev, newAnimation]);
                prevP2ValueRef.current = currentKey;
                lastAnimationTimeRef.current.p2 = now;
                
                // 1초 후 애니메이션 제거
                const timeoutId = setTimeout(() => {
                    setP2Animations(prev => prev.filter(anim => anim.key !== animationKey));
                }, 1000);
                
                timeoutRefsRef.current.push(timeoutId);
            }
        } else if (!lastScoreIncrement?.player2) {
            // 점수 증가가 없으면 prevP2ValueRef 초기화
            prevP2ValueRef.current = null;
        }
    }, [lastScoreIncrement?.player2]);
    
    // 컴포넌트 언마운트 시 모든 timeout 정리
    useEffect(() => {
        return () => {
            timeoutRefsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
            timeoutRefsRef.current = [];
            if (p1AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p1AnimationFrameRef.current);
            }
            if (p2AnimationFrameRef.current !== null) {
                cancelAnimationFrame(p2AnimationFrameRef.current);
            }
        };
    }, []);
    
    // 공유 애니메이션 스타일 (한 번만 추가)
    useEffect(() => {
        if (typeof document !== 'undefined' && !document.getElementById('score-popup-animation')) {
            const style = document.createElement('style');
            style.id = 'score-popup-animation';
            style.textContent = `
                @keyframes scorePopUp {
                    0% {
                        opacity: 0;
                        transform: translateY(-50%) translateY(-10px) scale(0.8);
                    }
                    20% {
                        opacity: 1;
                        transform: translateY(-50%) translateY(0) scale(1.1);
                    }
                    80% {
                        opacity: 1;
                        transform: translateY(-50%) translateY(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-50%) translateY(-10px) scale(0.8);
                    }
                }
                @keyframes scorePopUpOverlay {
                    0% { opacity: 0; transform: scale(0.65); }
                    28% { opacity: 1; transform: scale(1.12); }
                    72% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.9); }
                }
                @keyframes scorePopUpSlide {
                    0% { opacity: 0; transform: translateX(-4px); }
                    18% { opacity: 1; transform: translateX(0); }
                    78% { opacity: 1; transform: translateX(0); }
                    100% { opacity: 0; transform: translateX(2px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        return () => {
            // 컴포넌트 언마운트 시 스타일 제거하지 않음 (다른 인스턴스에서 사용할 수 있음)
        };
    }, []);
    
    return (
        <div ref={graphContainerRef} className="relative w-full">
            {compact ? (
                <>
                    <div className="mb-1 flex items-start justify-between gap-1">
                        <div ref={p1GraphProfileRef} className="flex min-w-0 flex-1 items-start gap-1">
                            {p1Player && (
                                <>
                                    <Avatar
                                        userId={p1Player.id}
                                        userName={p1Nickname || ''}
                                        avatarUrl={p1AvatarUrl}
                                        borderUrl={p1BorderUrl}
                                        size={28}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[9px] text-gray-500">{tt('black')}</div>
                                        <div
                                            className="break-words text-[10px] font-bold leading-snug text-gray-200 [overflow-wrap:anywhere]"
                                            title={p1Nickname}
                                        >
                                            {p1Nickname}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div ref={p2GraphProfileRef} className="flex min-w-0 flex-1 flex-row-reverse items-start gap-1">
                            {p2Player && (
                                <>
                                    <Avatar
                                        userId={p2Player.id}
                                        userName={p2Nickname || ''}
                                        avatarUrl={p2AvatarUrl}
                                        borderUrl={p2BorderUrl}
                                        size={28}
                                    />
                                    <div className="min-w-0 flex-1 text-right">
                                        <div className="text-[9px] text-gray-500">{tt('white')}</div>
                                        <div
                                            className="break-words text-right text-[10px] font-bold leading-snug text-gray-200 [overflow-wrap:anywhere]"
                                            title={p2Nickname}
                                        >
                                            {p2Nickname}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative z-10 mx-auto mb-1 w-full min-w-0 max-w-md px-0.5">
                        <div
                            ref={scoreBoardRef}
                            className="relative z-20 overflow-hidden rounded-lg border border-yellow-500/45 bg-gray-900/95 px-2 py-1 shadow-md shadow-yellow-500/15"
                        >
                            <div className="flex items-stretch justify-center gap-1.5">
                                <div
                                    className="flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center gap-0.5"
                                    data-player="p1"
                                >
                                    <div className="shrink-0 text-center">
                                        <div className="text-[9px] text-gray-400">{tt('black')}</div>
                                        <div className="text-sm font-bold leading-tight text-white">
                                            <span className="tabular-nums">{Math.round(p1DisplayScore)}</span>
                                        </div>
                                        <div className="text-[9px] leading-none text-gray-500">({p1Percent.toFixed(1)}%)</div>
                                    </div>
                                    <div className="flex min-h-[2.25rem] min-w-[2.5rem] flex-col items-start justify-center gap-0.5">
                                        {p1Animations.map((animation) => (
                                            <span
                                                key={`p1-${animation.key}`}
                                                className={`pointer-events-none block font-black tabular-nums leading-none ${
                                                    animation.isCritical
                                                        ? 'text-[11px] text-yellow-300 drop-shadow-[0_0_5px_rgba(250,204,21,0.85)]'
                                                        : 'text-[10px] text-green-300'
                                                }`}
                                                style={{ animation: 'scorePopUpSlide 1s ease-out forwards' }}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-px shrink-0 self-stretch bg-gray-600" />
                                <div
                                    className="flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center gap-0.5"
                                    data-player="p2"
                                >
                                    <div className="shrink-0 text-center">
                                        <div className="text-[9px] text-gray-400">{tt('white')}</div>
                                        <div className="text-sm font-bold leading-tight text-white">
                                            <span className="tabular-nums">{Math.round(p2DisplayScore)}</span>
                                        </div>
                                        <div className="text-[9px] leading-none text-gray-500">({p2Percent.toFixed(1)}%)</div>
                                    </div>
                                    <div className="flex min-h-[2.25rem] min-w-[2.5rem] flex-col items-start justify-center gap-0.5">
                                        {p2Animations.map((animation) => (
                                            <span
                                                key={`p2-${animation.key}`}
                                                className={`pointer-events-none block font-black tabular-nums leading-none ${
                                                    animation.isCritical
                                                        ? 'text-[11px] text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]'
                                                        : 'text-[10px] text-orange-300'
                                                }`}
                                                style={{ animation: 'scorePopUpSlide 1s ease-out forwards' }}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex h-2 w-full overflow-hidden rounded-full border border-black/25 bg-gray-700">
                        <div className="bg-black transition-all duration-500 ease-in-out" style={{ width: `${p1Percent}%` }} />
                        <div className="bg-white transition-all duration-500 ease-in-out" style={{ width: `${p2Percent}%` }} />
                        <div
                            className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-gray-400/50"
                            title={tt('center')}
                        />
                    </div>
                </>
            ) : (
                <div className="relative mb-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div ref={p1GraphProfileRef} className="flex shrink-0 items-center gap-2">
                            {p1Player && (
                                <>
                                    <Avatar
                                        userId={p1Player.id}
                                        userName={p1Nickname || ''}
                                        avatarUrl={p1AvatarUrl}
                                        borderUrl={p1BorderUrl}
                                        size={40}
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-bold text-gray-200">{tt('blackColon')} {p1Nickname}</div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="relative mx-2 flex min-w-0 flex-1 items-center justify-center" style={{ minHeight: '60px' }}>
                            <div
                                ref={scoreBoardRef}
                                className="relative z-20 rounded-lg border-2 border-yellow-500/50 bg-gray-900/95 px-4 py-2 shadow-lg shadow-yellow-500/30"
                                style={{ overflow: 'visible' }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[70px] text-center" data-player="p1">
                                        <div className="mb-0.5 text-xs text-gray-400">{tt('black')}</div>
                                        <div className="text-lg font-bold text-white">
                                            <span className="tabular-nums">{Math.round(p1DisplayScore)}</span>
                                            <span className="ml-1 text-xs text-gray-400">({p1Percent.toFixed(1)}%)</span>
                                        </div>
                                    </div>

                                    <div className="h-8 w-px bg-gray-600" />

                                    <div className="min-w-[70px] text-center" data-player="p2">
                                        <div className="mb-0.5 text-xs text-gray-400">{tt('white')}</div>
                                        <div className="text-lg font-bold text-white">
                                            <span className="tabular-nums">{Math.round(p2DisplayScore)}</span>
                                            <span className="ml-1 text-xs text-gray-400">({p2Percent.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                </div>

                                {p1Animations.map((animation) => (
                                    <div
                                        key={`p1-${animation.key}`}
                                        className="pointer-events-none absolute z-[15] whitespace-nowrap"
                                        style={{
                                            right: '100%',
                                            marginRight: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            animation: 'scorePopUp 1s ease-out forwards',
                                        }}
                                    >
                                        <div
                                            className={`rounded-lg px-2 py-1 ${
                                                animation.isCritical
                                                    ? 'border-2 border-yellow-400 bg-black shadow-lg shadow-yellow-500/50'
                                                    : 'border-2 border-gray-600 bg-black shadow-lg'
                                            }`}
                                        >
                                            <span
                                                className={`text-sm font-bold ${
                                                    animation.isCritical ? 'animate-pulse text-yellow-300' : 'text-white'
                                                }`}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {p2Animations.map((animation) => (
                                    <div
                                        key={`p2-${animation.key}`}
                                        className="pointer-events-none absolute z-[15] whitespace-nowrap"
                                        style={{
                                            left: '100%',
                                            marginLeft: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            animation: 'scorePopUp 1s ease-out forwards',
                                        }}
                                    >
                                        <div
                                            className={`rounded-lg px-2 py-1 ${
                                                animation.isCritical
                                                    ? 'border-2 border-red-500 bg-white shadow-lg shadow-red-500/50'
                                                    : 'border-2 border-gray-400 bg-white shadow-lg'
                                            }`}
                                        >
                                            <span
                                                className={`text-sm font-bold ${
                                                    animation.isCritical ? 'animate-pulse text-red-600' : 'text-black'
                                                }`}
                                            >
                                                {animation.isCritical ? `+${Math.round(animation.value)}!` : `+${Math.round(animation.value)}`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div ref={p2GraphProfileRef} className="flex shrink-0 items-center gap-2">
                            {p2Player && (
                                <>
                                    <div className="min-w-0 text-right">
                                        <div className="truncate text-xs font-bold text-gray-200">{tt('whiteColon')} {p2Nickname}</div>
                                    </div>
                                    <Avatar
                                        userId={p2Player.id}
                                        userName={p2Nickname || ''}
                                        avatarUrl={p2AvatarUrl}
                                        borderUrl={p2BorderUrl}
                                        size={40}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative flex h-3 w-full overflow-hidden rounded-full border-2 border-black/30 bg-gray-700">
                        <div className="bg-black transition-all duration-500 ease-in-out" style={{ width: `${p1Percent}%` }} />
                        <div className="bg-white transition-all duration-500 ease-in-out" style={{ width: `${p2Percent}%` }} />
                        <div
                            className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-gray-400/50"
                            title={tt('center')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const parseCommentary = (commentaryLine: CommentaryLine) => {
    const { text, isRandomEvent } = commentaryLine;
    
    // 초반전/중반전/종반전 시작 메시지에만 색상 적용 (정확한 텍스트 매칭)
    let phaseColorClass = '';
    if (text.startsWith('[\uACBD\uAE30 \uC2DC\uC791]')) {
        phaseColorClass = 'text-cyan-300';
    } else if (text.startsWith('\uCD08\uBC18\uC804\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4')) {
        phaseColorClass = 'text-green-400';
    } else if (text.startsWith('\uC911\uBC18\uC804\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4')) {
        phaseColorClass = 'text-yellow-400';
    } else if (text.startsWith('\uC885\uBC18\uC804\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4')) {
        phaseColorClass = 'text-red-400';
    }
    
    if (text.startsWith('\uCD5C\uC885 \uACB0\uACFC \uBC1C\uD45C!') || text.startsWith('[\uCD5C\uC885\uACB0\uACFC]') || text.startsWith('[\uCD5C\uC885\uACC4\uAC00]') || text.startsWith('[\uACBD\uAE30 \uACB0\uACFC]')) {
        return <strong className="text-yellow-400">{text}</strong>;
    }
    
    const leadRegex = /(\d+\.\d+집|\d+\.5집)/g;
    const parts = text.split(leadRegex);
    
    // phase 시작 메시지에만 색상 적용, 그 외는 기본 색상
    const baseColorClass = phaseColorClass || (isRandomEvent ? 'text-cyan-400' : '');
    
    return (
        <span className={baseColorClass}>
            {parts.map((part, index) => 
                leadRegex.test(part) ? (
                    <strong key={index} className="text-yellow-400">{part}</strong>
                ) : (
                    <span key={index}>{part}</span>
                )
            )}
        </span>
    );
};

const CommentaryPanel: React.FC<{
    commentary: CommentaryLine[];
    isSimulating: boolean;
    footerSlot?: React.ReactNode;
    compact?: boolean;
    /** 중계가 비어 있을 때(경기 전·로딩 중) 표시할 안내 문구 */
    emptyStateHint?: string | null;
    /** true면 빈 중계 영역에 로딩 스피너와 안내 문구를 함께 표시 */
    emptyStateLoading?: boolean;
}> = ({ commentary, isSimulating, footerSlot, compact = false, emptyStateHint = null, emptyStateLoading = false }) => {
    const commentaryContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (commentaryContainerRef.current) {
            commentaryContainerRef.current.scrollTop = commentaryContainerRef.current.scrollHeight;
        }
    }, [commentary]);

    return (
        <div className="flex h-full min-h-0 flex-col" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h4
                className={`flex-shrink-0 text-center font-bold text-gray-400 ${
                    compact ? 'mb-0.5 py-0 text-[11px] leading-tight' : 'mb-2 py-1 text-sm'
                }`}
            >
                실시간 중계
                {isSimulating && (
                    <span className={`animate-pulse text-yellow-400 ${compact ? 'ml-1 text-[10px]' : 'ml-2'}`}>
                        {tt('matchInProgress')}
                    </span>
                )}
            </h4>
            <div className={`flex min-h-0 flex-1 flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
                <div
                    ref={commentaryContainerRef}
                    className={`min-h-0 flex-1 overflow-y-auto rounded-md border border-gray-700/45 bg-slate-950/88 text-gray-300 ${
                        compact ? 'space-y-1 p-1.5 text-[11px] leading-snug' : 'space-y-2 p-2 text-sm'
                    }`}
                    style={{
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        flex: '1 1 0',
                        minHeight: 0,
                    }}
                >
                    {commentary.length > 0 ? (
                        commentary.map((line, index) => (
                            <p key={index} className="animate-fade-in break-words">
                                {parseCommentary(line)}
                            </p>
                        ))
                    ) : emptyStateLoading ? (
                        <InlineLoadingSpinner
                            size={compact ? 'md' : 'lg'}
                            label={emptyStateHint ?? tt('waitingForMatchStart')}
                            className="h-full"
                            labelClassName={`max-w-[14rem] text-center leading-relaxed text-gray-400 ${compact ? 'text-[11px]' : 'text-sm'}`}
                        />
                    ) : (
                        <p
                            className={`flex h-full items-center justify-center text-center text-gray-500 ${
                                compact ? 'text-[11px]' : ''
                            }`}
                        >
                            {emptyStateHint ?? tt('waitingForMatchStart')}
                        </p>
                    )}
                </div>
                {footerSlot ? (
                    <div
                        className={`flex w-full shrink-0 flex-col items-center justify-center rounded-md border border-amber-500/20 bg-slate-950/70 ${
                            compact ? 'gap-1 px-1.5 py-1' : 'gap-2 px-2 py-2.5 sm:py-2'
                        }`}
                    >
                        {footerSlot}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

/** 월드 챔피언십 예상 보상: 상자 이미지 + 검은 오버레이 + 물음표 */
const ChampionshipMysteryEquipmentIcon: React.FC<{ className?: string }> = ({
    className = 'h-5 w-5 sm:h-6 sm:w-6',
}) => (
    <span
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
        title={tt('randomEquipment')}
    >
        <img
            src="/images/Box/EquipmentBox1.webp"
            alt=""
            className="h-full w-full object-contain opacity-[0.62] brightness-[0.68] contrast-[0.98]"
            loading="lazy"
            decoding="async"
        />
        <span
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/58 text-[11px] font-black leading-none text-white sm:text-xs"
            style={{ textShadow: '0 0 10px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}
            aria-hidden
        >
            ?
        </span>
    </span>
);

/** 월드 챔피언십 예상 보상: 변경권 이미지 + 검은 오버레이 + 물음표 */
const ChampionshipMysteryChangeTicketIcon: React.FC<{ className?: string; title?: string }> = ({
    className = 'h-5 w-5 sm:h-6 sm:w-6',
    title = tt('randomChangeTicket'),
}) => (
    <span
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
        title={title}
    >
        <img
            src="/images/use/change1.webp"
            alt=""
            className="h-full w-full object-contain opacity-[0.62] brightness-[0.68] contrast-[0.98]"
            loading="lazy"
            decoding="async"
        />
        <span
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/58 text-[11px] font-black leading-none text-white sm:text-xs"
            style={{ textShadow: '0 0 10px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}
            aria-hidden
        >
            ?
        </span>
    </span>
);

const FinalRewardPanel: React.FC<{
    tournamentState: TournamentState;
    /** 계가·중계·다음 경기 대기 중에도 변하지 않게: 매 경기 누적 보상 필드는 서버 스냅샷에서만 읽는다 */
    rewardsSourceTournament?: TournamentState | null;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    onCompleteDungeon?: () => void;
    dungeonRewardAlreadyRequested?: boolean;
    onDungeonRewardRequested?: () => void;
    onOpenRewardHistory?: () => void;
    onExitToLobby?: () => void;
    /** PC 우측 사이드바: 내부 스크롤. 모바일 보상정보 탭: 본문 전체를 탭에서 스크롤(PC와 동일 내용 노출) */
    layoutVariant?: 'sidebar' | 'mobileTab';
    /** 모바일 경기장: 보상·진행 버튼을 화면 하단 고정 바로만 표시 */
    suppressBottomActions?: boolean;
    /** true면 보상받기·보상완료 버튼 숨김(경기 결과 패널에서 처리) */
    suppressClaimActions?: boolean;
    /** true면 우측/하단 액션 버튼 열 전체 숨김(푸터 버튼 패널에서 처리) */
    suppressSideActionButtons?: boolean;
    expectedRewardDetailsOpen?: boolean;
    onExpectedRewardDetailsOpenChange?: (open: boolean) => void;
}> = ({
    tournamentState,
    rewardsSourceTournament,
    currentUser,
    onAction,
    onCompleteDungeon,
    dungeonRewardAlreadyRequested,
    onDungeonRewardRequested,
    onOpenRewardHistory,
    onExitToLobby,
    layoutVariant = 'sidebar',
    suppressBottomActions = false,
    suppressClaimActions = false,
    suppressSideActionButtons = false,
    expectedRewardDetailsOpen,
    onExpectedRewardDetailsOpenChange,
}) => {
    const isMobileTabLayout = layoutVariant === 'mobileTab';
    useTranslation('tournament');
    const localizedGrade = useLocalizedItemGrade();
    const { type, rounds } = tournamentState;
    /** 획득 보상 타일만 서버 기준으로 고정 (시뮬레이션 로컬 상태와 분리) */
    const rs = rewardsSourceTournament ?? tournamentState;
    
    // 모든 경기가 완료되었는지 확인
    const allMatchesFinished = rounds.every(r => r.matches.every(m => m.isFinished));
    /** 월드 등: 예상 변경권 칩은 최소 1경기 종료 후에만 표시 (경기 전 단계 테이블 값 노출 방지) */
    const hasAnyFinishedMatch = (Array.isArray(rounds) ? rounds : []).some((r) =>
        (r.matches ?? []).some((m) => m.isFinished),
    );
    
    // 토너먼트가 완전히 완료되었는지 확인 (status가 complete이거나, 모든 경기가 완료된 경우)
    const isTournamentFullyComplete = tournamentState.status === 'complete' || (allMatchesFinished && tournamentState.status !== 'round_in_progress');
    const isUserEliminated = tournamentState.status === 'eliminated';
    const isInProgress = tournamentState.status === 'round_in_progress' || tournamentState.status === 'bracket_ready';
    const isRoundComplete = tournamentState.status === 'round_complete';
    // 동네바둑리그: 회차별·누적 골드(서버 rs, 수령 모달과 동일 출처)
    const accumulatedGold = rs.type === 'neighborhood' ? (rs.accumulatedGold || 0) : 0;
    const matchGoldRewards = rs.type === 'neighborhood' ? rs.matchGoldRewards : undefined;

    // 전국바둑대회: 라운드별 재료·누적(서버 rs)
    const accumulatedMaterials = rs.type === 'national' ? (rs.accumulatedMaterials || {}) : {};
    const matchMaterialRewards = rs.type === 'national' ? rs.matchMaterialRewards : undefined;

    // 월드챔피언십: 장비·드롭·상자(서버 rs)
    const accumulatedEquipmentBoxes = rs.type === 'world' ? (rs.accumulatedEquipmentBoxes || {}) : {};
    const accumulatedEquipmentDropsList = rs.type === 'world' ? (rs.accumulatedEquipmentDrops || []) : [];
    const accumulatedEquipmentItems = rs.type === 'world' ? (rs.accumulatedEquipmentItems || []) : [];
    const claimedRewardSummary = tournamentState.claimedRewardSummary || null;
    
    // 챔피언십 던전: currentStageAttempt가 JSON/구버전에서 빠져도 제목·dungeonProgress로 단계 복원 (동네/전국에서 보상 버튼 0단계로 숨겨지던 문제 방지)
    const effectiveStageAttempt = resolveDungeonStageAttempt(tournamentState, currentUser, type);
    const isDungeonMode = effectiveStageAttempt >= 1;

    const dungeonUserWinsForChampCoins = useMemo(() => {
        if (!isDungeonMode) return 0;
        let wins = 0;
        for (const round of rounds) {
            for (const m of round.matches ?? []) {
                if (!m.isFinished || !m.winner) continue;
                if (!m.players?.some((p) => p?.id === currentUser.id)) continue;
                if (m.winner.id === currentUser.id) wins += 1;
            }
        }
        return wins;
    }, [isDungeonMode, rounds, currentUser.id]);
    
    const rewardClaimedKey = `${type}RewardClaimed` as keyof User;
    const isClaimed = !!currentUser[rewardClaimedKey];
    const treatAsClaimed = isClaimed || !!dungeonRewardAlreadyRequested;
    const canClaimReward = (isTournamentFullyComplete || isUserEliminated) && !isClaimed && !dungeonRewardAlreadyRequested;
    
    // 중복 클릭 방지를 위한 상태
    const [isClaiming, setIsClaiming] = useState(false);
    const [internalExpectedRewardOpen, setInternalExpectedRewardOpen] = useState(false);
    const showExpectedRewardDetails = expectedRewardDetailsOpen ?? internalExpectedRewardOpen;
    const setShowExpectedRewardDetails = onExpectedRewardDetailsOpenChange ?? setInternalExpectedRewardOpen;
    const toggleExpectedRewardDetails = () => setShowExpectedRewardDetails(!showExpectedRewardDetails);

    const handleClaim = () => {
        // 중복 클릭 방지: 이미 클릭 중이거나 이미 수령했으면 무시
        if (isClaiming || !canClaimReward) {
            return;
        }
        
        setIsClaiming(true);
        audioService.claimReward();
        
        // 챔피언십은 항상 던전 모드 → 단계 보상 수령. onCompleteDungeon이 있으면 서버 호출 후 모달이 뜬 뒤에 부모에서 onDungeonRewardRequested 호출함 (클릭 시 즉시 호출하면 보상 완료로 바뀌어 모달이 안 보임)
        if (effectiveStageAttempt) {
            if (onCompleteDungeon) {
                onCompleteDungeon();
            } else {
                onDungeonRewardRequested?.();
                onAction({
                    type: 'COMPLETE_DUNGEON_STAGE',
                    payload: { dungeonType: type, stage: effectiveStageAttempt },
                });
            }
        }
        
        // 서버 응답 후 상태가 업데이트되면 isClaiming이 자동으로 false가 됨
        // 하지만 안전을 위해 일정 시간 후에도 false로 설정
        setTimeout(() => {
            setIsClaiming(false);
        }, 3000);
    };
    
    // isClaimed가 변경되면 isClaiming도 false로 설정
    useEffect(() => {
        if (isClaimed) {
            setIsClaiming(false);
        }
    }, [isClaimed]);

    /** 순위 보상 타일: 최종 라운드를 포함한 모든 경기가 끝난 뒤에만 매 경기 보상 옆에 추가 (탈락 직후·잔여 경기 중에는 비표시) */
    const showFinalRankRewards = isTournamentFullyComplete;
    const finalUserRank = useMemo(() => {
        if (!showFinalRankRewards) return null;
        return computeChampionshipDungeonUserRank(tournamentState, currentUser.id);
    }, [showFinalRankRewards, tournamentState, currentUser.id]);

    const rankRewardForDisplay = useMemo(() => {
        if (finalUserRank == null || effectiveStageAttempt < 1) return null;
        const maxRank = type === 'neighborhood' ? 6 : type === 'national' ? 8 : 16;
        if (finalUserRank < 1 || finalUserRank > maxRank) return null;
        const claimedRank = claimedRewardSummary?.rankReward;
        if (claimedRank?.items?.length) {
            return { rank: finalUserRank, reward: { items: claimedRank.items } };
        }
        if (type === 'world') {
            const rg = getDungeonRankRewardRangeForDisplay(type, effectiveStageAttempt, finalUserRank);
            if (!rg?.items?.length) return null;
            return { rank: finalUserRank, reward: { items: rg.items.map(it => ({ itemId: it.itemId, min: it.min, max: it.max })) } };
        }
        const qr = getDungeonRankRewardForDisplay(type, effectiveStageAttempt, finalUserRank);
        if (!qr?.items?.length) return null;
        return { rank: finalUserRank, reward: qr };
    }, [finalUserRank, effectiveStageAttempt, type, claimedRewardSummary]);

    const showSideActionsColumn = !isMobileTabLayout && !suppressBottomActions && !suppressSideActionButtons;
    const canShowExpectedRewardPreview = isDungeonMode && !isTournamentFullyComplete && !isUserEliminated;
    const useSplitRewardLayout = canShowExpectedRewardPreview && suppressSideActionButtons;
    const exitActionButton = onExitToLobby ? (
        <button
            type="button"
            onClick={onExitToLobby}
            className={`w-full ${championshipFooterExitButton}`}
        >
            {tt('exit')}
        </button>
    ) : null;
    const expectedRewardActionButton = canShowExpectedRewardPreview ? (
        <button
            type="button"
            onClick={toggleExpectedRewardDetails}
            className={`w-full ${championshipFooterSecondaryButton}`}
        >
            {tt('expectedReward')}
        </button>
    ) : null;
    const expectedRewardPreview = canShowExpectedRewardPreview ? (() => {
        const stage = effectiveStageAttempt;
        const isSplit = useSplitRewardLayout;
        const rowClass = isSplit
            ? 'flex w-full flex-col items-stretch justify-center gap-1.5'
            : 'flex flex-wrap items-center justify-center gap-1.5';
        const splitLineClass =
            'flex w-full min-h-[2.1rem] items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-900/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[2.25rem]';
        const splitLabelClass = 'shrink-0 w-[2.35rem] text-center text-[10px] font-black tracking-wide sm:w-[2.5rem] sm:text-[11px]';
        const splitInlineClass =
            'inline-flex min-w-0 items-center justify-center gap-1.5 text-[11px] font-bold leading-tight text-violet-50 sm:text-xs';
        const chipClass = isSplit
            ? splitLineClass
            : 'inline-flex min-h-[2rem] items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-[10.5px] font-bold leading-tight text-slate-100 shadow-inner';
        const chipIconClass = isSplit ? 'h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6' : 'h-4 w-4 object-contain';
        const gradeTextClass: Record<string, string> = {
            normal: 'text-slate-300',
            uncommon: 'text-green-300',
            rare: 'text-blue-300',
            epic: 'text-purple-300',
            legendary: 'text-red-300',
            mythic: 'text-amber-300',
        };

        const renderSplitOutcomeRow = (label: string, tone: string, content: React.ReactNode) => (
            <div className={splitLineClass}>
                <span className={`${splitLabelClass} ${tone}`}>{label}</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5">{content}</div>
            </div>
        );

        const renderGoldChip = (label: string, tone: string, min: number, max: number) => {
            const value = (
                <>
                    <img src="/images/icon/Gold.webp" alt="" className={chipIconClass} />
                    <span className="truncate tabular-nums">
                        {formatGoldAmountKoG(min)}~{formatGoldAmountKoG(max)}
                    </span>
                </>
            );
            if (isSplit) {
                return renderSplitOutcomeRow(label, tone, <span className={splitInlineClass}>{value}</span>);
            }
            return (
                <span className={chipClass}>
                    <span className={tone}>{label}</span>
                    {value}
                </span>
            );
        };

        if (type === 'neighborhood') {
            const gold = getDungeonBasicRewardRangeGold(stage);
            return (
                <div className={rowClass}>
                    {renderGoldChip(tt('victory'), 'text-emerald-300', gold.win.min, gold.win.max)}
                    {renderGoldChip(tt('defeat'), 'text-slate-400', gold.loss.min, gold.loss.max)}
                </div>
            );
        }

        if (type === 'national') {
            const rolls = DUNGEON_STAGE_MATERIAL_ROLLS[stage] ?? DUNGEON_STAGE_MATERIAL_ROLLS[1];
            const renderRollInline = (roll: typeof rolls.win[number]) => {
                const materialTemplate = MATERIAL_ITEMS[roll.materialName];
                const qty = roll.min === roll.max ? String(roll.min) : `${roll.min}~${roll.max}`;
                return (
                    <span
                        key={`${roll.materialName}-${qty}`}
                        className={splitInlineClass}
                        title={`${roll.materialName} ×${qty}`}
                    >
                        {materialTemplate?.image ? (
                            <img src={materialTemplate.image} alt={roll.materialName} className={chipIconClass} />
                        ) : null}
                        <span className="tabular-nums text-violet-200">×{qty}</span>
                    </span>
                );
            };
            const renderRoll = (label: string, tone: string, roll: typeof rolls.win[number]) => {
                const materialTemplate = MATERIAL_ITEMS[roll.materialName];
                const qty = roll.min === roll.max ? String(roll.min) : `${roll.min}~${roll.max}`;
                if (isSplit) return null;
                return (
                    <span
                        key={`${label}-${roll.materialName}-${qty}`}
                        className={chipClass}
                        title={`${roll.materialName} ×${qty}`}
                    >
                        <span className={tone}>{label}</span>
                        {materialTemplate?.image ? (
                            <img src={materialTemplate.image} alt={roll.materialName} className={chipIconClass} />
                        ) : null}
                        <span className="tabular-nums">×{qty}</span>
                    </span>
                );
            };
            if (isSplit) {
                return (
                    <div className={rowClass}>
                        {renderSplitOutcomeRow(
                            tt('victory'),
                            'text-emerald-300',
                            rolls.win.map((roll) => renderRollInline(roll)),
                        )}
                        {renderSplitOutcomeRow(
                            tt('defeat'),
                            'text-slate-400',
                            (rolls.loss ?? []).map((roll) => renderRollInline(roll)),
                        )}
                    </div>
                );
            }
            return (
                <div className={rowClass}>
                    {rolls.win.map((roll) => renderRoll(tt('winShort'), 'text-emerald-200', roll))}
                    {(rolls.loss ?? []).map((roll) => renderRoll(tt('lossShort'), 'text-slate-300', roll))}
                </div>
            );
        }

        if (type === 'world') {
            const worldBaseRewards = DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage] ?? DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[1];
            const maxChangeTickets = worldBaseRewards?.changeTickets ?? 0;
            const changeTicketTitle =
                maxChangeTickets > 0
                    ? tt('randomChangeTicketHint', { count: maxChangeTickets })
                    : tt('randomChangeTicket');

            const worldEquipGradeOrder: EquipmentGradeKey[] = [
                'normal',
                'uncommon',
                'rare',
                'epic',
                'legendary',
                'mythic',
            ];
            const dropConfig = DUNGEON_STAGE_EQUIPMENT_DROP[stage] ?? DUNGEON_STAGE_EQUIPMENT_DROP[1];
            const dropGrades = [...dropConfig.win.map((e) => e.grade), ...dropConfig.loss.map((e) => e.grade)];
            const gradeRank = (g: EquipmentGradeKey) => worldEquipGradeOrder.indexOf(g);
            let minDropGrade = dropGrades[0] ?? 'epic';
            let maxDropGrade = dropGrades[0] ?? 'mythic';
            for (const g of dropGrades) {
                if (gradeRank(g) < gradeRank(minDropGrade)) minDropGrade = g;
                if (gradeRank(g) > gradeRank(maxDropGrade)) maxDropGrade = g;
            }

            const gradeRangeInline = (
                <>
                    <ChampionshipMysteryEquipmentIcon className={isSplit ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4'} />
                    <span
                        className={`${isSplit ? 'text-[11px] sm:text-xs' : ''} ${gradeTextClass[minDropGrade] ?? gradeTextClass.epic}`}
                    >
                        {localizedGrade(minDropGrade)}
                    </span>
                    {minDropGrade !== maxDropGrade ? (
                        <>
                            <span className={`${isSplit ? 'text-[10px] sm:text-[11px]' : ''} text-slate-500`}>~</span>
                            <span
                                className={`${isSplit ? 'text-[11px] sm:text-xs' : ''} ${gradeTextClass[maxDropGrade] ?? gradeTextClass.mythic}`}
                            >
                                {localizedGrade(maxDropGrade)}
                            </span>
                        </>
                    ) : null}
                </>
            );

            const changeTicketInline = maxChangeTickets > 0 ? (
                <ChampionshipMysteryChangeTicketIcon
                    className={isSplit ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4'}
                    title={changeTicketTitle}
                />
            ) : null;

            if (isSplit) {
                return (
                    <div className={rowClass}>
                        {renderSplitOutcomeRow(
                            tt('equipment'),
                            'text-violet-300',
                            <span className={`${splitInlineClass} gap-2`}>{gradeRangeInline}</span>,
                        )}
                        {maxChangeTickets > 0
                            ? renderSplitOutcomeRow(
                                  tt('changeTicket'),
                                  'text-cyan-300',
                                  <span className={splitInlineClass}>{changeTicketInline}</span>,
                              )
                            : null}
                    </div>
                );
            }

            return (
                <div className={rowClass}>
                    <span className={`${chipClass} gap-2`}>
                        <span>{tt('equipment')}</span>
                        {gradeRangeInline}
                    </span>
                    {maxChangeTickets > 0 ? (
                        <span className={`${chipClass} gap-2`}>
                            <span className="text-cyan-300">{tt('changeTicket')}</span>
                            {changeTicketInline}
                        </span>
                    ) : null}
                </div>
            );
        }

        if (isSplit) {
            return (
                <div className={rowClass}>
                    {renderSplitOutcomeRow(
                        tt('grade'),
                        'text-violet-300',
                        <span className={`${splitInlineClass} gap-2`}>
                            <span className={`text-[11px] sm:text-xs ${gradeTextClass.epic}`}>{localizedGrade('epic')}</span>
                            <span className="text-[10px] text-slate-500 sm:text-[11px]">~</span>
                            <span className={`text-[11px] sm:text-xs ${gradeTextClass.legendary}`}>{localizedGrade('legendary')}</span>
                            <span className="text-[10px] text-slate-500 sm:text-[11px]">~</span>
                            <span className={`text-[11px] sm:text-xs ${gradeTextClass.mythic}`}>{localizedGrade('mythic')}</span>
                        </span>,
                    )}
                </div>
            );
        }

        return (
            <div className={rowClass}>
                <span className={chipClass}>
                    장비 등급
                    <span className={gradeTextClass.epic}>{localizedGrade('epic')}</span>
                    <span className="text-slate-500">~</span>
                    <span className={gradeTextClass.legendary}>{localizedGrade('legendary')}</span>
                    <span className="text-slate-500">~</span>
                    <span className={gradeTextClass.mythic}>{localizedGrade('mythic')}</span>
                </span>
            </div>
        );
    })() : null;

    const sideActionButtons = !suppressBottomActions ? (
        (isTournamentFullyComplete || isUserEliminated) && treatAsClaimed ? (
            <>
                {!suppressClaimActions && isDungeonMode && onCompleteDungeon && !isClaimed ? (
                    <button
                        onClick={onCompleteDungeon}
                        disabled={isClaiming}
                        className={`w-full ${championshipFooterPrimaryButton}`}
                    >
                        {isClaiming ? tt('processing') : tt('rewardComplete')}
                    </button>
                ) : !suppressClaimActions ? (
                    <div className={`w-full text-center ${championshipFooterMutedButton}`}>
                        보상완료
                    </div>
                ) : null}
                {expectedRewardActionButton}
                {exitActionButton}
            </>
        ) : !treatAsClaimed ? (
            <>
                {!suppressClaimActions && (isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt ? (
                    <button
                        onClick={handleClaim}
                        disabled={!canClaimReward || isClaiming}
                        className={`w-full ${
                            canClaimReward && !isClaiming
                                ? championshipFooterPrimaryButton
                                : championshipFooterMutedButton
                        }`}
                    >
                        {isClaiming ? tt('claiming') : (canClaimReward ? tt('claimReward') : tt('claimAfterMatchEnd'))}
                    </button>
                ) : null}
                {expectedRewardActionButton}
                {(isTournamentFullyComplete || isUserEliminated) ? exitActionButton : null}
                {!suppressClaimActions &&
                (isInProgress || isRoundComplete) &&
                !((isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt) ? (
                    <div className="w-full rounded-lg border border-sky-500/35 bg-sky-950/55 px-2 py-1.5 text-center text-[10.5px] font-bold leading-tight text-sky-200">
                        모든 경기 완료 후 보상수령
                    </div>
                ) : null}
            </>
        ) : null
    ) : null;

    const acquiredRewardsClaimMessage =
        (isTournamentFullyComplete || isUserEliminated) && treatAsClaimed ? (
            <div className="mb-1 w-full rounded-lg border border-green-700/50 bg-green-900/30 px-1.5 py-1">
                <p className="text-center text-xs font-semibold text-green-400">{tt('rewardClaimed')}</p>
            </div>
        ) : null;

    const renderAcquiredRewardsContent = (): React.ReactNode => {
                const showRankReward = !!(showFinalRankRewards && rankRewardForDisplay);

                // 보상 수령 모달(`DungeonStageSummaryModal`)과 동일: 동네=회차별 골드 전부, 전국=라운드 합산 재료, 월드=획득 장비·드롭 전부 + 변경권
                const neighborhoodGoldDisplay: number[] = (() => {
                    if (type !== 'neighborhood') return [];
                    const perMatch = matchGoldRewards && matchGoldRewards.length > 0 ? matchGoldRewards : null;
                    if (perMatch?.length) return [...perMatch];
                    if (accumulatedGold > 0) return [accumulatedGold];
                    return [];
                })();
                const hasNeighborhoodGold = neighborhoodGoldDisplay.length > 0;

                const mergedNationalMaterials: Record<string, number> | null =
                    type === 'national' && Array.isArray(matchMaterialRewards) && matchMaterialRewards.length > 0
                        ? matchMaterialRewards.reduce((acc: Record<string, number>, roundMat: Record<string, number>) => {
                              for (const [materialName, quantity] of Object.entries(roundMat)) {
                                  if (quantity <= 0) continue;
                                  acc[materialName] = (acc[materialName] ?? 0) + quantity;
                              }
                              return acc;
                          }, {})
                        : null;
                const hasNationalMergedMaterials =
                    !!mergedNationalMaterials && Object.keys(mergedNationalMaterials).length > 0;
                const hasNationalAccumulated =
                    type === 'national' && !hasNationalMergedMaterials && Object.keys(accumulatedMaterials).length > 0;

                const legacyBoxEntries = Object.entries(accumulatedEquipmentBoxes);
                const hasLegacyEquipBoxes = type === 'world' && legacyBoxEntries.length > 0;

                const hasWorldEquipItemsList = type === 'world' && accumulatedEquipmentItems.length > 0;
                const hasWorldEquipDropsList =
                    type === 'world' && !hasWorldEquipItemsList && accumulatedEquipmentDropsList.length > 0;

                const worldChangeTicketChips: { name: string; quantity: number; image: string }[] = (() => {
                    if (type !== 'world' || !isDungeonMode) return [];
                    const br = claimedRewardSummary?.baseRewards as
                        | { changeTicketGrants?: { name: string; quantity: number }[]; changeTickets?: number }
                        | undefined;
                    if (br?.changeTicketGrants?.length) {
                        return br.changeTicketGrants.map(g => {
                            const mat = (MATERIAL_ITEMS as Record<string, { image?: string }>)[g.name];
                            return { name: g.name, quantity: g.quantity, image: mat?.image || '/images/use/change2.webp' };
                        });
                    }
                    const n =
                        br?.changeTickets ?? DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[effectiveStageAttempt]?.changeTickets ?? 0;
                    if (n > 0 && hasAnyFinishedMatch) {
                        return [{ name: tt('changeTicket'), quantity: n, image: '/images/use/change2.webp' }];
                    }
                    return [];
                })();
                const hasWorldChangeTickets = worldChangeTicketChips.length > 0;

                const claimedChampCoins = Math.max(0, Math.floor(Number(claimedRewardSummary?.baseRewards?.champCoins ?? 0)));
                const canPreviewChampCoins =
                    isDungeonMode &&
                    effectiveStageAttempt >= 1 &&
                    (isTournamentFullyComplete || isUserEliminated) &&
                    !treatAsClaimed;
                const champCoinPreviewLabel = canPreviewChampCoins
                    ? formatDungeonChampCoinRewardPreviewLabel(effectiveStageAttempt, dungeonUserWinsForChampCoins)
                    : null;
                const showChampCoinChip = claimedChampCoins > 0 || !!champCoinPreviewLabel;
                const champCoinBadgeText =
                    claimedChampCoins > 0
                        ? claimedChampCoins.toLocaleString('ko-KR')
                        : (champCoinPreviewLabel ?? '');

                const hasAnyMatchReward =
                    hasNeighborhoodGold ||
                    hasNationalMergedMaterials ||
                    hasNationalAccumulated ||
                    hasLegacyEquipBoxes ||
                    hasWorldEquipItemsList ||
                    hasWorldEquipDropsList ||
                    hasWorldChangeTickets ||
                    showChampCoinChip;

                if (!hasAnyMatchReward && !showRankReward) {
                    return (
                        <div
                            className={`flex w-full items-center justify-center ${
                                useSplitRewardLayout ? 'py-2' : isMobileTabLayout ? 'py-10' : 'h-full'
                            }`}
                        >
                            <p className="text-center text-xs text-gray-400">{tt('noRewards')}</p>
                        </div>
                    );
                }

                const EQUIP_GRADE_BORDER: Record<string, string> = {
                    normal: 'border-2 border-gray-500/80',
                    uncommon: 'border-2 border-green-500/80',
                    rare: 'border-2 border-blue-500/80',
                    epic: 'border-2 border-purple-500/80',
                    legendary: 'border-2 border-red-500/80',
                    mythic: 'border-2 border-amber-500/80',
                    transcendent: 'border-2 border-teal-400/85',
                };
                const EQUIP_GRADE_IMAGE: Record<string, string> = {
                    normal: '/images/equipments/normalbgi.webp',
                    uncommon: '/images/equipments/uncommonbgi.webp',
                    rare: '/images/equipments/rarebgi.webp',
                    epic: '/images/equipments/epicbgi.webp',
                    legendary: '/images/equipments/legendarybgi.webp',
                    mythic: '/images/equipments/mythicbgi.webp',
                    transcendent: '/images/equipments/transcendentbgi.webp',
                };

                return (
                    <div
                        className={`flex w-full flex-wrap items-center justify-center gap-1 ${
                            useSplitRewardLayout ? 'mb-0' : 'mb-1'
                        } ${isClaimed ? 'opacity-75' : ''}`}
                    >
                        {/* 1) 동네바둑리그: 회차별 골드(수령 모달과 동일) */}
                        {hasNeighborhoodGold &&
                            neighborhoodGoldDisplay.map((goldAmount: number, idx: number) => (
                                <div
                                    key={`gold-${idx}`}
                                    className="relative w-11 h-11 rounded-lg border-2 border-yellow-600/70 bg-yellow-900/40 flex items-center justify-center overflow-hidden"
                                    title={
                                        matchGoldRewards && matchGoldRewards.length > 0
                                            ? tt('matchRewardIndex', { index: idx + 1 })
                                            : tt('earnedGold')
                                    }
                                >
                                    <img src="/images/icon/Gold.webp" alt={tt('goldAlt')} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                    <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-yellow-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                        {formatGoldAmountKoG(goldAmount)}
                                    </span>
                                </div>
                            ))}

                        {/* 2) 전국바둑대회: 라운드별 재료 합산(수령 모달과 동일) */}
                        {hasNationalMergedMaterials &&
                            Object.entries(mergedNationalMaterials!).map(([materialName, quantity]) => {
                                const materialTemplate = MATERIAL_ITEMS[materialName];
                                const imageUrl = materialTemplate?.image || '';
                                return (
                                    <div
                                        key={`mat-merged-${materialName}`}
                                        className="relative w-11 h-11 rounded-lg border-2 border-blue-600/70 bg-blue-900/40 flex items-center justify-center overflow-hidden"
                                        title={tt('roundMaterialsSum')}
                                    >
                                        <img src={imageUrl} alt={materialName} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                        <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-blue-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                            {quantity}
                                        </span>
                                    </div>
                                );
                            })}

                        {/* 2-1) 전국바둑대회 폴백: 누적 재료(경기 단위 분할 정보가 없을 때) */}
                        {hasNationalAccumulated && Object.entries(accumulatedMaterials).map(([materialName, quantity]) => {
                            const materialTemplate = MATERIAL_ITEMS[materialName];
                            const imageUrl = materialTemplate?.image || '';
                            return (
                                <div key={`accmat-${materialName}`} className="relative w-11 h-11 rounded-lg border-2 border-blue-600/70 bg-blue-900/40 flex items-center justify-center overflow-hidden">
                                    <img src={imageUrl} alt={materialName} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                    <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-blue-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                        {quantity}
                                    </span>
                                </div>
                            );
                        })}

                        {/* 3) 월드챔피언십(레거시): 누적 장비상자 */}
                        {hasLegacyEquipBoxes && Object.entries(accumulatedEquipmentBoxes).map(([boxName, quantity]) => {
                            const boxTemplate = CONSUMABLE_ITEMS.find(i => i.name === boxName);
                            const imageUrl = boxTemplate?.image || '';
                            return (
                                <div key={`box-${boxName}`} className="relative w-11 h-11 rounded-lg border-2 border-purple-600/70 bg-purple-900/40 flex items-center justify-center overflow-hidden">
                                    <img src={imageUrl} alt={boxName} className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                                    <span className="absolute -bottom-0.5 -right-0.5 text-[11px] font-bold text-purple-100 bg-black/80 px-1 rounded-tl leading-tight shadow-sm">
                                        {quantity}
                                    </span>
                                </div>
                            );
                        })}

                        {/* 4) 월드챔피언십: 경기마다 획득한 장비 전부(수령 모달과 동일) */}
                        {hasWorldEquipItemsList &&
                            accumulatedEquipmentItems.map((item, wi) => {
                                const grade = (item.grade ?? 'normal') as string;
                                const borderClass = EQUIP_GRADE_BORDER[grade] || EQUIP_GRADE_BORDER.normal;
                                return (
                                    <div
                                        key={`equip-${String(item.id ?? '')}-${item.name}-${wi}`}
                                        className={`w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center ${borderClass}`}
                                        title={item.name}
                                    >
                                        <img
                                            src={item.image?.startsWith('/') ? item.image : `/${item.image}`}
                                            alt=""
                                            className="w-[70%] h-[70%] object-contain pointer-events-none"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                );
                            })}

                        {/* 5) 월드챔피언십(레거시): 등급 드롭 전부 — 실제 장비 항목이 없을 때만 */}
                        {hasWorldEquipDropsList &&
                            accumulatedEquipmentDropsList.map((gradeKey: string, di: number) => {
                                const img = EQUIP_GRADE_IMAGE[gradeKey] || '/images/equipments/normalbgi.webp';
                                const label = localizedGrade(gradeKey as ItemGrade);
                                const borderClass = EQUIP_GRADE_BORDER[gradeKey] || EQUIP_GRADE_BORDER.normal;
                                return (
                                    <div
                                        key={`drop-${gradeKey}-${di}`}
                                        className={`w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center ${borderClass}`}
                                        title={tt('labelEquipment', { label })}
                                    >
                                        <img src={img} alt="" className="w-[70%] h-[70%] object-contain pointer-events-none" loading="lazy" decoding="async" />
                                    </div>
                                );
                            })}

                        {/* 5-1) 월드챔피언십: 단계 변경권(수령 후에는 종류·수량 확정값) */}
                        {hasWorldChangeTickets &&
                            worldChangeTicketChips.map((ch, ci) => {
                                const imgSrc = ch.image.startsWith('/') ? ch.image : `/${ch.image}`;
                                return (
                                    <div
                                        key={`wch-${ci}-${ch.name}`}
                                        className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border-2 border-cyan-600/65 bg-cyan-950/35"
                                        title={ch.name}
                                    >
                                        <img src={imgSrc} alt="" className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
                                        <span className="absolute -bottom-0.5 -right-0.5 rounded-tl bg-black/80 px-1 text-[10px] font-bold leading-tight text-cyan-100 shadow-sm">
                                            {ch.quantity.toLocaleString('ko-KR')}
                                        </span>
                                    </div>
                                );
                            })}

                        {/* PVE 공통: 챔프 코인 — 종료 후 수령 전에는 범위, 수령 후에는 확정 지급량 */}
                        {showChampCoinChip && (
                            <div
                                className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border-2 border-amber-400/70 bg-amber-950/45"
                                title={
                                    claimedChampCoins > 0
                                        ? tt('champCoinTimes', { amount: claimedChampCoins.toLocaleString('ko-KR') })
                                        : tt('champCoinPending', { label: champCoinPreviewLabel })
                                }
                            >
                                <img src="/images/icon/champcoin.webp" alt={tt('champCoinAlt')} className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
                                <span className="absolute -bottom-0.5 -right-0.5 max-w-[2.75rem] truncate rounded-tl bg-black/80 px-0.5 text-[10px] font-bold leading-tight text-amber-100 shadow-sm">
                                    {champCoinBadgeText}
                                </span>
                            </div>
                        )}

                        {/* 6) 순위 보상 — 매 경기 보상과 같은 줄에 이어 붙는다. 호화 amber 테두리로 시각적으로 구분 */}
                        {showRankReward && rankRewardForDisplay!.reward.items!.map((it, idx) => {
                            const row = it as { itemId: string; quantity?: number; min?: number; max?: number };
                            const itemName = row.itemId;
                            let src = '';
                            if (itemName.includes('\uACE8\uB4DC')) src = '/images/icon/Gold.webp';
                            else if (itemName.includes('\uB514\uC774\uC544')) src = '/images/icon/Zem.webp';
                            else {
                                const mat = MATERIAL_ITEMS[itemName];
                                if (mat?.image) src = mat.image;
                                else {
                                    const box = CONSUMABLE_ITEMS.find((i) => i.name === itemName);
                                    src = box?.image || '/images/Box/ResourceBox1.webp';
                                }
                            }
                            const hasRange = row.min != null && row.max != null;
                            const qtyLabel = hasRange
                                ? row.min === row.max
                                    ? itemName.includes(TB_ITEM_GOLD)
                                        ? formatGoldAmountKoG(row.min!)
                                        : row.min!.toLocaleString('ko-KR')
                                    : `${row.min}~${row.max}`
                                : row.quantity != null
                                  ? itemName.includes(TB_ITEM_GOLD)
                                      ? formatGoldAmountKoG(row.quantity)
                                      : row.quantity.toLocaleString('ko-KR')
                                  : '1';
                            const qtyForTitle = hasRange
                                ? row.min === row.max
                                    ? String(row.min)
                                    : `${row.min}~${row.max}`
                                : String(row.quantity ?? 1);
                            const resolvedSrc = src.startsWith('/') ? src : src ? `/${src}` : '';
                            return (
                                <div
                                    key={`rank-reward-${idx}-${itemName}`}
                                    className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border-2 border-amber-500/65 bg-amber-950/40"
                                    title={tt('rankRewardTitle', { rank: rankRewardForDisplay!.rank, item: itemName, qty: qtyForTitle })}
                                >
                                    {resolvedSrc ? (
                                        <img src={resolvedSrc} alt="" className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
                                    ) : null}
                                    <span className="absolute -bottom-0.5 -right-0.5 rounded-tl bg-black/80 px-1 text-[11px] font-bold leading-tight text-amber-100 shadow-sm">
                                        {qtyLabel}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                );
    };

    return (
        <div
            className={`flex min-h-0 flex-col ${isMobileTabLayout ? 'h-auto w-full' : 'h-full'}`}
            style={
                isMobileTabLayout
                    ? { display: 'flex', flexDirection: 'column', minHeight: 0 }
                    : { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }
            }
        >
            {useSplitRewardLayout ? (
                <div className="flex min-h-0 flex-1 flex-row gap-1 overflow-hidden">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <h4 className="mb-0.5 shrink-0 text-center text-[11px] font-bold text-violet-200 sm:text-xs">
                            예상 보상
                        </h4>
                        <div
                            className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto rounded-md border border-violet-500/35 bg-gradient-to-b from-violet-950/45 via-violet-950/25 to-slate-950/70 px-2 py-1.5"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {expectedRewardPreview ?? (
                                <p className="py-1 text-center text-[10px] text-slate-500">—</p>
                            )}
                        </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <h4 className="mb-0.5 shrink-0 text-center text-[10px] font-bold text-gray-300 sm:text-[11px]">
                            획득 보상
                        </h4>
                        <div
                            className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto rounded-md border border-gray-700/45 bg-slate-950/88 px-1.5 py-1"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="flex w-full flex-col items-center justify-center">
                                {acquiredRewardsClaimMessage}
                                {renderAcquiredRewardsContent()}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="relative mb-1.5 flex flex-shrink-0 items-center justify-center py-0.5">
                        <h4 className="whitespace-nowrap text-center text-sm font-bold text-gray-300">{tt('earnedRewards')}</h4>
                    </div>
                    <div
                        className={
                            isMobileTabLayout
                                ? 'flex w-full flex-col gap-1.5'
                                : 'flex min-h-0 w-full flex-1 flex-row gap-1.5 overflow-hidden'
                        }
                        style={isMobileTabLayout ? undefined : { minHeight: 0 }}
                    >
                        <div
                            className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-gray-700/45 bg-slate-950/88 p-1.5 md:p-2 ${
                                isMobileTabLayout ? '' : 'min-h-0 flex-1 overflow-y-auto'
                            }`}
                            style={
                                isMobileTabLayout
                                    ? { WebkitOverflowScrolling: 'touch' as const }
                                    : {
                                          overflowY: 'auto',
                                          WebkitOverflowScrolling: 'touch',
                                          flex: '1 1 0',
                                          minHeight: 0,
                                          maxHeight: '100%',
                                      }
                            }
                        >
                            {acquiredRewardsClaimMessage}
                            {showExpectedRewardDetails && expectedRewardPreview ? (
                                <div className="mb-1 w-full rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-2 py-1.5">
                                    <p className="mb-1 text-center text-[10px] font-black tracking-[0.14em] text-cyan-200/90">
                                        예상 보상
                                    </p>
                                    {expectedRewardPreview}
                                </div>
                            ) : null}
                            {renderAcquiredRewardsContent()}
                        </div>

                        {showSideActionsColumn && sideActionButtons ? (
                            <div className="flex w-[7.2rem] shrink-0 flex-col items-stretch justify-center gap-1.5 self-stretch rounded-md border border-gray-700/45 bg-slate-950/72 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                {sideActionButtons}
                            </div>
                        ) : null}
                    </div>
                </>
            )}

            {isMobileTabLayout && !suppressBottomActions && sideActionButtons ? (
                <div className="mt-1.5 flex flex-shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-gray-700 pt-1.5">
                    {sideActionButtons}
                </div>
            ) : null}
        </div>
    );
};


const MatchBox: React.FC<{ match: Match; currentUser: UserWithStatus; tournamentState?: TournamentState; compact?: boolean }> = ({
    match,
    currentUser,
    tournamentState,
    compact = false,
}) => {
    const p1 = match.players[0];
    const p2 = match.players[1];

    // 사용자 진행상태 계산
    const getUserProgressStatus = (playerId: string): string | null => {
        if (playerId !== currentUser.id || !tournamentState) return null;
        
        const isNationalTournament = tournamentState.type === 'national';
        const isWorldTournament = tournamentState.type === 'world';
        
        if (isNationalTournament || isWorldTournament) {
            // 전국바둑대회/월드챔피언십: 토너먼트 형식 (N강 진출, 결승 진출 등)
            const currentRound = tournamentState.rounds.find(r => r.matches.some(m => m.id === match.id));
            if (!currentRound || !match.isFinished) return null;
            
            const isWinner = match.winner?.id === playerId;
            if (!isWinner) return null; // 패자는 표시하지 않음
            
            const roundName = currentRound.name;
            if (roundName === '16\uAC15') {
                return tt('roundAdvance.quarter');
            } else if (roundName === '8\uAC15') {
                return tt('roundAdvance.semi');
            } else if (roundName === '4\uAC15') {
                return tt('roundAdvance.final');
            } else if (roundName === '\uACB0\uC2B9') {
                return tt('roundAdvance.champion');
            } else if (roundName === '3,4\uC704\uC804') {
                return tt('roundAdvance.thirdPlace');
            }
            return null;
        } else {
            // 동네바둑리그: 기존 형식
            const allUserMatches = tournamentState.rounds.flatMap(r => r.matches).filter(m => 
                m.isUserMatch && m.players.some(p => p?.id === playerId)
            );
            const finishedMatches = allUserMatches.filter(m => m.isFinished);
            const wins = finishedMatches.filter(m => m.winner?.id === playerId).length;
            const losses = finishedMatches.length - wins;
            
            if (finishedMatches.length === 0) return null;
            
            const lastMatch = finishedMatches[finishedMatches.length - 1];
            const lastMatchWon = lastMatch.winner?.id === playerId;
            const matchNumber = finishedMatches.length;
            
            return tt('matchRoundResult', { round: matchNumber, outcome: lastMatchWon ? tt('victory') : tt('defeat'), wins, losses });
        }
    };

    // 결승전 우승자 확인
    const isFinalMatch = useMemo(() => {
        if (!tournamentState) return false;
        const finalRound = tournamentState.rounds.find(r => r.name === TB_RND_FINAL);
        return finalRound?.matches.some(m => m.id === match.id) || false;
    }, [tournamentState, match.id]);
    
    const isTournamentComplete = tournamentState?.status === 'complete';

    const avatarSizeNational = compact ? 26 : 36;
    const avatarSizeLeague = compact ? 26 : 32;

    const PlayerDisplay: React.FC<{ player: PlayerForTournament | null, isWinner: boolean }> = ({ player, isWinner }) => {
        const isNationalTournament = tournamentState?.type === 'national';
        const isWorldTournament = tournamentState?.type === 'world';
        const isTournamentFormat = isNationalTournament || isWorldTournament;
        
        if (!player) {
            return (
                <div
                    className={`flex items-center justify-center ${isTournamentFormat ? (compact ? 'h-12 px-2' : 'h-16 px-4') : compact ? 'h-8 px-1' : 'h-10 px-2'}`}
                >
                    <span className={`text-gray-500 italic ${isTournamentFormat ? (compact ? 'text-xs' : 'text-base') : compact ? 'text-[11px]' : 'text-sm'}`}>
                        경기 대기중...
                    </span>
                </div>
            );
        }
        
        const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;
        const progressStatus = getUserProgressStatus(player.id);
        const showTrophy = isFinalMatch && isTournamentComplete && isWinner && player.id === match.winner?.id && match.isFinished;

        if (isTournamentFormat) {
            // 전국바둑대회/월드챔피언십: 가로 배치용 컴팩트 레이아웃
            const winMarginText = isWinner && match.isFinished ? (() => {
                if (!match.finalScore) return tt('winShort');
                const p1Percent = match.finalScore.player1;
                const diffPercent = Math.abs(p1Percent - 50) * 2;
                const scoreDiff = diffPercent / 2;
                const roundedDiff = Math.round(scoreDiff);
                const finalDiff = roundedDiff + 0.5;
                const winMargin = finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
                return tt('winMargin', { margin: winMargin });
            })() : null;
            
            return (
                <div
                    className={`relative flex flex-col items-center justify-center rounded-lg transition-all ${
                        isWinner
                            ? compact
                                ? 'px-1.5 py-1'
                                : 'px-3 py-2'
                            : compact
                              ? 'px-1 py-1'
                              : 'px-2 py-1.5'
                    } ${
                    isWinner 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50 shadow-lg shadow-yellow-500/20' 
                        : match.isFinished 
                            ? 'opacity-50' 
                            : 'hover:bg-slate-800/75'
                }`}
                >
                    {/* 승리 표시 오버레이 (우측 상단) */}
                    {match.isFinished && isWinner && (winMarginText || showTrophy) && (
                        <div className={`absolute flex items-center gap-1 z-10 ${compact ? '-top-1 -right-1' : '-top-2 -right-2'}`}>
                            {winMarginText && (
                                <span
                                    className={`bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-full shadow-lg flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${
                                        compact ? 'text-[8px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'
                                    }`}
                                >
                                    <span>🏆</span>
                                    <span>{winMarginText}</span>
                                </span>
                            )}
                            {showTrophy && (
                                <img 
                                    key={`trophy-${player.id}-${match.id}`}
                                    src="/images/championship/Ranking.webp" 
                                    alt="Trophy" 
                                    className={`flex-shrink-0 drop-shadow-lg ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
                                    loading="lazy"
                                    decoding="async"
                                />
                            )}
                        </div>
                    )}
                    
                    {/* Avatar */}
                    <div className={`flex-shrink-0 ${compact ? 'mb-1' : 'mb-1.5'}`}>
                        <Avatar
                            key={`avatar-${player.id}-${match.id}`}
                            userId={player.id}
                            userName={player.nickname}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                            size={avatarSizeNational}
                        />
                    </div>
                    
                    {/* 텍스트 영역 */}
                    <div className={`flex flex-col items-center justify-center w-full min-w-0 ${compact ? 'gap-0' : 'gap-1'}`}>
                        {/* 닉네임 */}
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <span className={`text-center font-semibold truncate ${compact ? 'text-[11px]' : 'text-sm'} ${
                                isWinner 
                                    ? 'text-yellow-300 font-bold' 
                                    : match.isFinished 
                                        ? 'text-gray-400' 
                                        : 'text-gray-200'
                            }`}>
                                {player.nickname}
                            </span>
                        </div>
                        
                        {/* 진행 상태 (전국바둑대회/월드챔피언십: 승자에게만 표시) */}
                        {progressStatus && (
                            <div
                                className={`text-yellow-400 font-semibold text-center break-words ${compact ? 'text-[9px] leading-tight' : 'text-xs'}`}
                            >
                                {progressStatus}
                            </div>
                        )}
                    </div>
                </div>
            );
        } else {
            // 동네바둑리그: 기본 레이아웃
            const winMargin = isWinner && match.isFinished ? (() => {
                if (!match.finalScore) return '';
                const p1Percent = match.finalScore.player1;
                const diffPercent = Math.abs(p1Percent - 50) * 2;
                const scoreDiff = diffPercent / 2;
                const roundedDiff = Math.round(scoreDiff);
                const finalDiff = roundedDiff + 0.5;
                const margin = finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
                return margin;
            })() : '';
            
            return (
                <div className={`relative flex items-center ${compact ? 'gap-1.5' : 'gap-2'} ${isWinner ? (compact ? 'px-1.5 py-1' : 'px-2 py-2') : compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} rounded-md transition-all ${
                    isWinner 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50 shadow-lg shadow-yellow-500/20' 
                        : match.isFinished 
                            ? 'opacity-50' 
                            : 'hover:bg-slate-800/75'
                }`}>
                    {/* 승리 표시 오버레이 (우측 상단) */}
                    {match.isFinished && isWinner && (winMargin || showTrophy) && (
                        <div className="absolute -top-2 -right-2 flex items-center gap-1 z-10">
                            {winMargin && (
                                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
                                    <span>🏆</span>
                                    <span>{winMargin}집 승</span>
                                </span>
                            )}
                            {showTrophy && (
                                <img 
                                    key={`trophy-${player.id}-${match.id}`}
                                    src="/images/championship/Ranking.webp" 
                                    alt="Trophy" 
                                    className="w-5 h-5 flex-shrink-0 drop-shadow-lg"
                                    loading="lazy"
                                    decoding="async"
                                />
                            )}
                        </div>
                    )}
                    
                    <Avatar
                        key={`avatar-${player.id}-${match.id}`}
                        userId={player.id}
                        userName={player.nickname}
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                        size={avatarSizeLeague}
                    />
                    <div className={`flex-1 min-w-0 flex flex-col ${compact ? 'gap-0' : 'gap-1'}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                            <span className={`truncate font-semibold ${compact ? 'text-xs' : 'text-sm'} ${
                                isWinner 
                                    ? 'text-yellow-300 font-bold' 
                                    : match.isFinished 
                                        ? 'text-gray-400' 
                                        : 'text-gray-200'
                            }`}>
                                {player.nickname}
                            </span>
                        </div>
                        {progressStatus && (
                            <span className={`text-yellow-400 font-semibold truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                                {progressStatus}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
    };
    
    const p1IsWinner = match.isFinished && match.winner?.id === p1?.id;
    const p2IsWinner = match.isFinished && match.winner?.id === p2?.id;
    const isMyMatch = p1?.id === currentUser.id || p2?.id === currentUser.id;
    const isFinished = match.isFinished;

    // finalScore에서 집 차이 계산 (finishMatch 함수의 로직과 동일)
    const calculateWinMargin = (): string => {
        if (!isFinished || !match.finalScore) return '';
        const p1Percent = match.finalScore.player1;
        const diffPercent = Math.abs(p1Percent - 50) * 2;
        const scoreDiff = diffPercent / 2;
        const roundedDiff = Math.round(scoreDiff);
        const finalDiff = roundedDiff + 0.5;
        return finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
    };

    const winMargin = calculateWinMargin();

    // 전국바둑대회/월드챔피언십인지 확인 (tournamentState의 type으로 판단)
    const isNationalTournament = tournamentState?.type === 'national';
    const isWorldTournament = tournamentState?.type === 'world';
    const isTournamentFormat = isNationalTournament || isWorldTournament;
    
    return (
        <div
            className={`relative w-full overflow-visible transition-all duration-300 ${
                compact ? 'rounded-lg' : 'rounded-xl'
            } ${
            isMyMatch 
                ? 'border-2 border-blue-500/80 bg-gradient-to-br from-blue-950/90 via-blue-900/82 to-indigo-950/90 shadow-lg shadow-blue-500/25' 
                : 'border border-gray-500/65 bg-gradient-to-br from-slate-900/94 via-slate-800/90 to-slate-900/94 shadow-md'
        } ${isFinished || compact ? '' : 'hover:scale-[1.02] hover:shadow-xl'}`}
        >
            {/* 승리 배지 (동네바둑리그만 표시, 전국바둑대회/월드챔피언십은 PlayerDisplay에 표시) */}
            {isTournamentFormat ? (
                // 전국바둑대회/월드챔피언십: 가로 배치 (1번선수 vs 2번선수)
                <div className={compact ? 'p-2' : 'p-3'}>
                    <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-3'}`}>
                        <div className="flex-1 min-w-0 flex justify-center">
                            <PlayerDisplay player={p1} isWinner={p1IsWinner} />
                        </div>
                        {!isFinished && (
                            <div className={`text-gray-400 font-semibold flex-shrink-0 ${compact ? 'text-[10px]' : 'text-sm'}`}>VS</div>
                        )}
                        <div className="flex-1 min-w-0 flex justify-center">
                            <PlayerDisplay player={p2} isWinner={p2IsWinner} />
                        </div>
                    </div>
                </div>
            ) : (
                // 동네바둑리그: 세로 배치
                <div className={`${compact ? 'space-y-1 p-2' : 'space-y-2 p-3'}`}>
                    <PlayerDisplay player={p1} isWinner={p1IsWinner} />
                    {!isFinished && (
                        <div className={`flex items-center justify-center ${compact ? 'py-0' : 'py-1'}`}>
                            <div className={`text-gray-400 font-semibold ${compact ? 'text-[10px]' : 'text-xs'}`}>VS</div>
                        </div>
                    )}
                    <PlayerDisplay player={p2} isWinner={p2IsWinner} />
                </div>
            )}
        </div>
    );
};

const RoundColumn: React.FC<{
    name: string;
    matches: Match[] | undefined;
    currentUser: UserWithStatus;
    tournamentState?: TournamentState;
    compact?: boolean;
}> = ({ name, matches, currentUser, tournamentState, compact = false }) => {
    const isFinalRound = name.includes(TB_RND_FINAL) || name.includes(TB_RND_THIRD);
    const isNationalTournament = tournamentState?.type === 'national';
    const isWorldTournament = tournamentState?.type === 'world';
    const isTournamentFormat = isNationalTournament || isWorldTournament;
    
    return (
        <div
            className={`flex h-full flex-shrink-0 flex-col justify-around ${isTournamentFormat ? (compact ? 'gap-3 min-w-[200px]' : 'gap-6 min-w-[280px]') : compact ? 'min-w-[160px] gap-3' : 'min-w-[200px] gap-4'}`}
        >
            <div
                className={`text-center font-bold rounded-lg ${
                isTournamentFormat
                    ? compact
                        ? 'px-3 py-1.5 text-sm'
                        : 'px-5 py-3 text-lg'
                    : compact
                      ? 'px-3 py-1.5 text-xs'
                      : 'px-4 py-2 text-base'
            } ${
                isFinalRound
                    ? 'border-2 border-purple-400/55 bg-gradient-to-r from-purple-700/92 to-pink-700/92 text-white shadow-lg shadow-purple-500/30'
                    : 'border border-gray-500/60 bg-gradient-to-r from-slate-800/92 to-slate-700/88 text-gray-200 shadow-md'
            }`}>
                {name}
            </div>
            <div className={`flex h-full flex-col justify-around ${isTournamentFormat ? (compact ? 'gap-3' : 'gap-6') : compact ? 'gap-3' : 'gap-4'}`}>
                {matches?.map(match => (
                    <MatchBox key={match.id} match={match} currentUser={currentUser} tournamentState={tournamentState} compact={compact} />
                ))}
            </div>
        </div>
    );
};

const RoundRobinDisplay: React.FC<{
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
    /** 다음 경기 자동 시작까지 남은 시간(ms). 있으면 현재 회차에서 카운트다운 후 탭 전환하므로, 카운트다운 중에는 탭을 다음 회차로 넘기지 않음 */
    nextRoundStartTime?: number | null;
    /** 카운트다운 0 시 부모에서 설정. 이 값이 오면 먼저 이 회차로 탭 전환 후 시합 시작 */
    pendingRoundSwitchTo?: number | null;
    /** 모바일 대진표 탭 등 좁은 화면 */
    compact?: boolean;
}> = ({ tournamentState, currentUser, nextRoundStartTime, pendingRoundSwitchTo, compact = false }) => {
    const [activeTab, setActiveTab] = useState<'round' | 'ranking'>('round');
    const { players, rounds, status, currentRoundRobinRound, type: tournamentType } = tournamentState;
    
    // 경기가 완료된 경우 마지막 회차(5회차)를 초기값으로 설정
    const initialRound = status === 'complete' ? 5 : (currentRoundRobinRound || 1);
    const [selectedRound, setSelectedRound] = useState<number>(initialRound);
    
    // 모든 매치를 수집 (5회차 전체)
    const allMatches = useMemo(() => {
        return rounds.flatMap(round => round.matches);
    }, [rounds]);

    const playerStats = useMemo(() => {
        const stats: Record<string, { wins: number; losses: number }> = {};
        players.forEach(p => { stats[p.id] = { wins: 0, losses: 0 }; });
        allMatches.forEach(match => {
            if (match.isFinished && match.winner) {
                const winnerId = match.winner.id;
                if (stats[winnerId]) stats[winnerId].wins++;
                const loser = match.players.find(p => p && p.id !== winnerId);
                if (loser && stats[loser.id]) stats[loser.id].losses++;
            }
        });
        return stats;
    }, [players, allMatches]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            const aWins = playerStats[a.id]?.wins || 0;
            const bWins = playerStats[b.id]?.wins || 0;
            if (aWins !== bWins) return bWins - aWins;
            // 승수가 같으면 패수로 정렬 (패수가 적을수록 좋음)
            const aLosses = playerStats[a.id]?.losses || 0;
            const bLosses = playerStats[b.id]?.losses || 0;
            return aLosses - bLosses;
        });
    }, [players, playerStats]);

    // 현재 표시할 회차 결정
    // 동네바둑리그: 
    // - round_complete 상태일 때는 완료된 회차를 표시 (1회차 완료 후 1회차 표시) - 경기 종료 화면 유지
    // - bracket_ready 상태일 때는 현재 회차를 표시 (다음 경기 버튼을 눌러 2회차로 넘어간 후 2회차 표시) - 다음 회차 대진표로 이동
    // - round_in_progress 상태일 때는 현재 진행 중인 회차를 표시 (던전 모드 자동진행 대응)
    // - complete 상태일 때는 마지막 회차(5회차)를 표시 (경기 종료 후 재입장 시) - 마지막 경기 종료 화면 유지
    const roundForDisplay = status === 'complete' ? 5 : (currentRoundRobinRound || 1);
    
    // rounds 배열에서 선택된 회차의 라운드 찾기 (name이 "1회차", "2회차" 등인 라운드)
    const currentRoundObj = useMemo(() => {
        return rounds.find(round => round.name === `${selectedRound}${TB_ROUND_SUFFIX}`);
    }, [rounds, selectedRound]);
    
    const currentRoundMatches = currentRoundObj?.matches || [];

    // 부모에서 카운트다운 0 시 다음 회차로 먼저 전환 요청한 경우 즉시 탭 전환
    useLayoutEffect(() => {
        if (pendingRoundSwitchTo != null && pendingRoundSwitchTo >= 1) {
            setSelectedRound(pendingRoundSwitchTo);
        }
    }, [pendingRoundSwitchTo]);

    // 현재 회차가 변경되고 사용자가 수동으로 선택하지 않은 경우에만 선택된 회차 업데이트
    // 1회차 종료 후: 같은 자리에서 카운트다운만 보여 주고, 카운트다운 완료(round_in_progress) 후에만 다음 회차 탭으로 이동
    const isManualSelection = useRef(false);
    const prevRoundForDisplay = useRef(roundForDisplay);
    useLayoutEffect(() => {
        if (pendingRoundSwitchTo != null) return; // 부모가 탭 전환 제어 중
        const roundChanged = prevRoundForDisplay.current !== roundForDisplay;
        prevRoundForDisplay.current = roundForDisplay;
        // bracket_ready + nextRoundStartTime + 2회차 이상: 카운트다운 중이므로 탭을 넘기지 않고 현재(이전) 회차 유지
        const countdownInProgress = status === 'bracket_ready' && nextRoundStartTime != null && roundForDisplay >= 2;
        if (countdownInProgress) {
            isManualSelection.current = false;
            return;
        }
        if (!isManualSelection.current && roundForDisplay && (selectedRound !== roundForDisplay || roundChanged)) {
            console.log(`[RoundRobinDisplay] Updating selectedRound: ${selectedRound} -> ${roundForDisplay}, status: ${status}, currentRoundRobinRound: ${currentRoundRobinRound}`);
            setSelectedRound(roundForDisplay);
        }
        isManualSelection.current = false;
    }, [roundForDisplay, selectedRound, status, currentRoundRobinRound, nextRoundStartTime, pendingRoundSwitchTo]);
    
    const handleRoundSelect = (roundNum: number) => {
        isManualSelection.current = true;
        setSelectedRound(roundNum);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <h4 className={`flex-shrink-0 text-center font-bold text-gray-300 ${compact ? 'mb-1 text-xs' : 'mb-2'}`}>{tt('roundRobin')}</h4>
            <div
                className={`mb-2 flex flex-shrink-0 rounded-lg border border-gray-600/55 bg-slate-950/90 ${compact ? 'p-0.5' : 'p-1'}`}
            >
                <button
                    onClick={() => setActiveTab('round')}
                    className={`flex-1 rounded-md font-semibold transition-all ${compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} ${activeTab === 'round' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    대진표
                </button>
                <button
                    onClick={() => setActiveTab('ranking')}
                    className={`flex-1 rounded-md font-semibold transition-all ${compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} ${activeTab === 'ranking' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    {status === 'complete' ? tt('finalRank') : tt('currentRank')}
                </button>
            </div>
            <div className={`min-h-0 flex-grow overflow-y-auto ${compact ? 'pr-1' : 'pr-2'}`}>
                {activeTab === 'round' ? (
                    <div className="flex h-full flex-col">
                        {/* 회차 선택 탭 */}
                        <div className={`flex flex-shrink-0 gap-1 ${compact ? 'mb-1' : 'mb-2'}`}>
                            {[1, 2, 3, 4, 5].map(roundNum => (
                                <button
                                    key={roundNum}
                                    onClick={() => handleRoundSelect(roundNum)}
                                    className={`flex-1 rounded-md font-semibold transition-all ${compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'} ${
                                        selectedRound === roundNum
                                            ? 'bg-blue-700 text-white'
                                            : roundNum <= roundForDisplay
                                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    }`}
                                    disabled={roundNum > roundForDisplay}
                                >
                                    {roundNum}회차
                                </button>
                            ))}
                        </div>
                        {/* 선택된 회차의 매치 표시 */}
                        <div
                            className={`flex min-h-0 flex-grow flex-col items-center justify-around px-1 ${compact ? 'gap-2' : 'gap-4 px-2'}`}
                        >
                            {currentRoundMatches.length > 0 ? (
                                currentRoundMatches.map(match => (
                                    <div key={match.id} className={`w-full ${compact ? 'max-w-[240px]' : 'max-w-md'}`}>
                                        <MatchBox match={match} currentUser={currentUser} tournamentState={tournamentState} compact={compact} />
                                    </div>
                                ))
                            ) : (
                                <div className={`italic text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>{tt('noMatches')}</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <ul className={compact ? 'space-y-1' : 'space-y-2'}>
                        {sortedPlayers.map((player, index) => {
                             const stats = playerStats[player.id];
                             const isCurrentUser = player.id === currentUser.id;
                             const isTopThree = index < 3;
                             // hooks는 map 내부에서 호출할 수 없으므로 일반 변수로 계산
                             const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
                             const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;
                             const isWinner = status === 'complete' && index === 0;
                             
                             return (
                                 <li
                                     key={player.id}
                                     className={`flex items-center rounded-lg transition-all ${
                                         compact ? 'gap-2 p-2' : 'gap-3 p-3'
                                     } ${
                                     isCurrentUser 
                                         ? 'bg-gradient-to-r from-blue-600/60 to-indigo-600/60 border-2 border-blue-400/70 shadow-lg' 
                                         : isTopThree
                                             ? 'bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border border-yellow-600/50 shadow-md'
                                             : 'bg-gray-700/50 border border-gray-600/30 hover:bg-gray-700/70'
                                 }`}
                                 >
                                     <div
                                         className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold ${
                                             compact ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm'
                                         } ${
                                         index === 0 
                                             ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg'
                                             : index === 1
                                                 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 shadow-md'
                                                 : index === 2
                                                     ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-md'
                                                     : 'bg-gray-600 text-gray-200'
                                     }`}>
                                         {index + 1}
                                     </div>
                                     <Avatar
                                         key={`avatar-rr-${player.id}`}
                                         userId={player.id}
                                         userName={player.nickname}
                                         avatarUrl={avatarUrl}
                                         borderUrl={borderUrl}
                                         size={compact ? 28 : 36}
                                     />
                                     <span className={`flex-grow truncate font-semibold ${compact ? 'text-xs' : 'text-sm'} ${
                                         isCurrentUser ? 'text-blue-200' : 'text-gray-200'
                                     }`}>
                                         {player.nickname}
                                     </span>
                                     {isWinner && (
                                         <img 
                                             key={`trophy-rr-${player.id}`}
                                             src="/images/championship/Ranking.webp" 
                                             alt="Trophy" 
                                             className={`flex-shrink-0 ${compact ? 'h-4 w-4' : 'h-6 w-6'}`}
                                             loading="lazy"
                                             decoding="async"
                                         />
                                     )}
                                     <div className={`flex items-baseline font-semibold ${compact ? 'gap-1 text-[10px]' : 'gap-2 text-xs'}`}>
                                         <span className="text-green-400">{tt('recordWinsLosses', { wins: stats.wins, losses: stats.losses }).split(' ')[0]}</span>
                                         <span className="text-gray-400">/</span>
                                         <span className="text-red-400">{stats.losses}{tt('lossShortLabel')}</span>
                                     </div>
                                 </li>
                             );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};


const TournamentRoundViewer: React.FC<{ 
    rounds: Round[]; 
    currentUser: UserWithStatus; 
    tournamentType: TournamentType; 
    tournamentState?: TournamentState;
    nextRoundTrigger?: number;
    nextRoundStartTime?: number | null;
    /** 모바일 대진표 탭 */
    compact?: boolean;
}> = ({ rounds, currentUser, tournamentType, tournamentState, nextRoundTrigger, nextRoundStartTime, compact = false }) => {
    // FIX: Define the type for tab data to help TypeScript's inference.
    type TabData = { name: string; matches: Match[]; isInProgress: boolean; };
    
    const getRoundsForTabs = useMemo((): TabData[] | null => {
        const roundMap = new Map<string, Match[]>();
        rounds.forEach(r => roundMap.set(r.name, r.matches));
        
        let availableTabs: string[] = [];
        if (tournamentType === 'world') {
            availableTabs = [TB_RND_16, TB_RND_QF, TB_TAB_SF, TB_TAB_FINAL_THIRD];
        } else if (tournamentType === 'national') {
            availableTabs = [TB_RND_QF, TB_TAB_SF, TB_TAB_FINAL_THIRD];
        } else {
            return null;
        }

        const tabData = availableTabs.map((tabName): TabData => {
            let roundMatches: Match[] = [];
            let roundNames: string[] = [];
            if (tabName === TB_TAB_FINAL_THIRD_ALT || tabName === TB_TAB_FINAL_THIRD) {
                roundNames = [TB_RND_FINAL, TB_RND_THIRD];
                roundMatches = (roundMap.get(TB_RND_FINAL) || []).concat(roundMap.get(TB_RND_THIRD) || []);
            } else if (tabName === TB_TAB_SF) {
                roundNames = [TB_RND_SF];
                roundMatches = roundMap.get(TB_RND_SF) || [];
            } else {
                roundNames = [tabName];
                roundMatches = roundMap.get(tabName) || [];
            }
            return {
                name: tabName,
                matches: roundMatches,
                isInProgress: roundMatches.length > 0 && roundMatches.some(m => !m.isFinished)
            };
        });
        // 경기가 없어도 탭을 표시하도록 filter 제거
        
        return tabData;
    }, [rounds, tournamentType]);

    // 초기 탭 인덱스 계산 (컴포넌트 마운트 시 한 번만 사용)
    // useState의 초기값 함수는 첫 렌더링 시에만 실행되므로 안전함
    const getInitialTabIndex = () => {
        if (!getRoundsForTabs) return 0;
        
        // 경기가 완료된 경우(complete 또는 eliminated) 마지막 탭을 선택
        if (tournamentState && (tournamentState.status === 'complete' || tournamentState.status === 'eliminated')) {
            return Math.max(0, getRoundsForTabs.length - 1);
        }
        
        // 진행 중인 경기가 있는 탭을 찾음 (초기 입장 시에만)
        const inProgressIndex = getRoundsForTabs.findIndex(tab => tab.isInProgress);
        if (inProgressIndex !== -1) {
            return inProgressIndex;
        }
        
        // 그 외의 경우 첫 번째 탭 선택
        return 0;
    };

    const [activeTab, setActiveTab] = useState(getInitialTabIndex);

    // nextRoundTrigger가 변경되면 다음 탭으로 이동
    const prevNextRoundTrigger = useRef(nextRoundTrigger || 0);
    useEffect(() => {
        if (nextRoundTrigger !== undefined && nextRoundTrigger > prevNextRoundTrigger.current && getRoundsForTabs) {
            const currentTabName = getRoundsForTabs[activeTab]?.name;
            
            // 전국바둑대회
            if (tournamentType === 'national') {
                if (currentTabName === TB_RND_QF) {
                    // 8강 탭에서 다음경기 버튼을 누르면 4강전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === TB_TAB_SF);
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === TB_TAB_SF) {
                    // 4강전 탭에서 다음경기 버튼을 누르면 결승&3/4위전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === TB_TAB_FINAL_THIRD);
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                }
            }
            // 월드챔피언십
            else if (tournamentType === 'world') {
                if (currentTabName === TB_RND_16) {
                    // 16강 탭에서 다음경기 버튼을 누르면 8강 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === TB_RND_QF);
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === TB_RND_QF) {
                    // 8강 탭에서 다음경기 버튼을 누르면 4강전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === TB_TAB_SF);
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === TB_TAB_SF) {
                    // 4강전 탭에서 다음경기 버튼을 누르면 결승&3/4위전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === TB_TAB_FINAL_THIRD);
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                }
            }
            
            prevNextRoundTrigger.current = nextRoundTrigger;
        } else if (nextRoundTrigger !== undefined) {
            // nextRoundTrigger가 변경되었지만 탭 변경 조건을 만족하지 않으면 ref만 업데이트
            prevNextRoundTrigger.current = nextRoundTrigger;
        }
    }, [nextRoundTrigger, activeTab, getRoundsForTabs, tournamentType]);

    // 경기 종료 시점에 다음 경기가 있는 탭으로 자동 이동
    // round_in_progress에서 bracket_ready로 변경될 때 또는 nextRoundStartTime이 설정될 때 탭 변경
    const prevStatus = useRef<string | undefined>(tournamentState?.status);
    const prevNextRoundStartTime = useRef<number | null | undefined>(nextRoundStartTime);
    
    useEffect(() => {
        if (!getRoundsForTabs || !tournamentState) return;
        
        const currentStatus = tournamentState.status;
        const statusChanged = prevStatus.current !== currentStatus;
        const nextRoundStartTimeChanged = nextRoundStartTime !== prevNextRoundStartTime.current;
        
        // 경기 종료 시점 (round_in_progress -> bracket_ready) 또는 카운트다운 시작 시 탭 변경
        const shouldChangeTab = (statusChanged && currentStatus === 'bracket_ready' && prevStatus.current === 'round_in_progress') ||
                                (nextRoundStartTimeChanged && nextRoundStartTime);
        
        if (shouldChangeTab) {
            // 다음 경기가 있는 탭 찾기
            const nextUserMatch = rounds
                .flatMap((round, rIdx) => round.matches.map((match, mIdx) => ({ match, roundIndex: rIdx, matchIndex: mIdx })))
                .find(({ match }) => !match.isFinished && match.isUserMatch);
            
            if (nextUserMatch) {
                // 다음 경기가 있는 라운드 찾기
                const nextRound = rounds[nextUserMatch.roundIndex];
                if (nextRound) {
                    // 해당 라운드가 포함된 탭 찾기
                    const targetTabIndex = getRoundsForTabs.findIndex(tab => {
                        if (tab.name === TB_TAB_FINAL_THIRD) {
                            return nextRound.name === TB_RND_FINAL || nextRound.name === TB_RND_THIRD;
                        } else if (tab.name === TB_TAB_SF) {
                            return nextRound.name === TB_RND_SF;
                        } else {
                            return tab.name === nextRound.name;
                        }
                    });
                    
                    if (targetTabIndex !== -1 && targetTabIndex !== activeTab) {
                        // 경기 종료 시점 또는 카운트다운 시작 시 즉시 탭 변경하여 대진표 업데이트
                        console.log(`[TournamentRoundViewer] match end/countdown tab switch: ${activeTab} -> ${targetTabIndex}, status: ${prevStatus.current} -> ${currentStatus}`);
                        setActiveTab(targetTabIndex);
                    }
                }
            }
        }
        
        prevStatus.current = currentStatus;
        prevNextRoundStartTime.current = nextRoundStartTime;
    }, [tournamentState?.status, nextRoundStartTime, getRoundsForTabs, tournamentState, rounds, activeTab]);

    if (!getRoundsForTabs) {
        const desiredOrder = [TB_RND_16, TB_RND_QF, TB_RND_SF, TB_RND_THIRD, TB_RND_FINAL];
        const sortedRounds = [...rounds].sort((a, b) => desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name));
        return (
            <div className="flex h-full min-h-0 flex-col">
                <h4 className={`flex-shrink-0 text-center font-bold text-gray-300 ${compact ? 'mb-1 text-xs' : 'mb-2'}`}>{tt('bracketTitle')}</h4>
                <div className={`flex flex-grow items-center justify-center overflow-auto ${compact ? 'space-x-2 p-1' : 'space-x-4 p-2'}`}>
                    {sortedRounds.map((round) => (
                        <RoundColumn
                            key={round.id}
                            name={round.name}
                            matches={round.matches}
                            currentUser={currentUser}
                            tournamentState={tournamentState}
                            compact={compact}
                        />
                    ))}
                </div>
            </div>
        );
    }
    
    const activeTabData = getRoundsForTabs[activeTab];

    // 전국바둑대회 전체 토너먼트 브래킷 렌더링 (8강 → 4강 → 결승)
    const renderNationalTournamentBracket = () => {
        const roundMap = new Map<string, Match[]>();
        rounds.forEach(r => roundMap.set(r.name, r.matches));
        
        const quarterFinals = roundMap.get(TB_RND_QF) || [];
        const semiFinals = roundMap.get(TB_RND_SF) || [];
        const final = roundMap.get(TB_RND_FINAL) || [];
        const thirdPlace = roundMap.get(TB_RND_THIRD) || [];
        
        const containerRef = useRef<HTMLDivElement>(null);
        const [lines, setLines] = useState<React.ReactNode[]>([]);
        const matchRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
        
        const setMatchRef = useCallback((matchId: string) => (el: HTMLDivElement | null) => {
            matchRefs.current.set(matchId, el);
        }, []);
        
        useEffect(() => {
            const calculateLines = () => {
                const containerElem = containerRef.current;
                if (!containerElem) return;
                
                const containerRect = containerElem.getBoundingClientRect();
                const newLines: React.ReactNode[] = [];
                
                // 8강 → 4강 연결선 (왼쪽 8강 → 오른쪽 4강, V자 형태로 가운데에서 만남)
                quarterFinals.forEach((qfMatch, qfIndex) => {
                    if (!qfMatch.isFinished || !qfMatch.winner) return;
                    
                    // 위쪽 8강(0,1) → 첫 번째 4강(0), 아래쪽 8강(2,3) → 두 번째 4강(1)
                    const semiIndex = Math.floor(qfIndex / 2);
                    const semiMatch = semiFinals[semiIndex];
                    if (!semiMatch) return;
                    
                    const qfElem = matchRefs.current.get(qfMatch.id);
                    const semiElem = matchRefs.current.get(semiMatch.id);
                    
                    if (qfElem && semiElem) {
                        const qfRect = qfElem.getBoundingClientRect();
                        const semiRect = semiElem.getBoundingClientRect();
                        
                        // 승자 위치 계산 (MatchBox 내부에서 위쪽/아래쪽 플레이어)
                        const qfWinnerIsP1 = qfMatch.winner.id === qfMatch.players[0]?.id;
                        const qfY = qfRect.top + (qfWinnerIsP1 ? qfRect.height * 0.25 : qfRect.height * 0.75) - containerRect.top;
                        
                        // 4강의 위치: 위쪽 8강이면 4강의 위쪽, 아래쪽 8강이면 4강의 아래쪽
                        const isUpperQuarter = qfIndex < 2;
                        const semiY = semiRect.top + (isUpperQuarter ? semiRect.height * 0.25 : semiRect.height * 0.75) - containerRect.top;
                        
                        const startX = qfRect.right - containerRect.left;
                        const endX = semiRect.left - containerRect.left;
                        const midX = startX + (endX - startX) * 0.5; // 가운데 지점
                        const midY = qfRect.top + qfRect.height / 2 - containerRect.top; // 8강 박스의 중간 높이
                        const targetMidY = semiRect.top + semiRect.height / 2 - containerRect.top; // 4강 박스의 중간 높이
                        
                        // V자 형태: 8강에서 아래로 내려가서 가운데에서 만나고, 다시 4강으로 올라감
                        newLines.push(
                            <path key={`qf-${qfMatch.id}`} 
                                d={`M ${startX} ${qfY} V ${midY} H ${midX} V ${targetMidY} H ${endX} V ${semiY}`} 
                                stroke="rgba(251, 146, 60, 0.8)" 
                                strokeWidth="3" 
                                fill="none" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        );
                    }
                });
                
                // 4강 → 결승 연결선 (역 V자 형태로 가운데에서 나뉨)
                semiFinals.forEach((semiMatch, semiIndex) => {
                    if (!semiMatch.isFinished || !semiMatch.winner) return;
                    
                    const finalMatch = final[0];
                    if (!finalMatch) return;
                    
                    const semiElem = matchRefs.current.get(semiMatch.id);
                    const finalElem = matchRefs.current.get(finalMatch.id);
                    
                    if (semiElem && finalElem) {
                        const semiRect = semiElem.getBoundingClientRect();
                        const finalRect = finalElem.getBoundingClientRect();
                        
                        const semiWinnerIsP1 = semiMatch.winner.id === semiMatch.players[0]?.id;
                        const semiY = semiRect.top + (semiWinnerIsP1 ? semiRect.height * 0.25 : semiRect.height * 0.75) - containerRect.top;
                        const finalY = finalRect.top + finalRect.height * 0.5 - containerRect.top;
                        
                        const startX = semiRect.left + semiRect.width / 2 - containerRect.left;
                        const endX = finalRect.left + finalRect.width / 2 - containerRect.left;
                        const midX = (startX + endX) / 2; // 가운데 지점
                        const midY = semiRect.bottom - containerRect.top; // 4강 박스 아래
                        const targetMidY = finalRect.top - containerRect.top; // 결승 박스 위
                        
                        // 역 V자 형태: 4강에서 아래로 내려가서 가운데에서 나뉘고, 다시 결승으로 올라감
                        newLines.push(
                            <path key={`semi-${semiMatch.id}`} 
                                d={`M ${startX} ${semiY} V ${midY} H ${midX} V ${targetMidY} H ${endX} V ${finalY}`} 
                                stroke="rgba(251, 146, 60, 0.8)" 
                                strokeWidth="3" 
                                fill="none" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        );
                    }
                });
                
                setLines(newLines);
            };
            
            const timeoutId = setTimeout(calculateLines, 50);
            const resizeObserver = new ResizeObserver(calculateLines);
            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
            }
            
            return () => {
                clearTimeout(timeoutId);
                resizeObserver.disconnect();
            };
        }, [quarterFinals, semiFinals, final]);
        
        // 이 함수는 더 이상 사용되지 않음 - 탭별로 개별 렌더링
        return null;
    };

    const renderBracketForTab = (tab: typeof activeTabData) => {
        const tabMaxW = compact ? 'max-w-[210px]' : 'max-w-[280px]';
        const tabStackClass = compact
            ? 'flex h-full flex-col items-center justify-start gap-2 overflow-x-visible overflow-y-auto p-2'
            : 'flex h-full flex-col items-center justify-start gap-4 overflow-x-visible overflow-y-auto p-4';
        // 전국바둑대회/월드챔피언십: 탭별로 세로 배치
        if (tournamentType === 'national' || tournamentType === 'world') {
            if (tab.name === TB_TAB_FINAL_THIRD) {
                const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === TB_RND_FINAL);
                const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === TB_RND_THIRD);
                // 부모 컨테이너의 높이가 자동으로 조정되므로 h-full 사용
                return (
                    <div className={tabStackClass}>
                        {finalMatch.length > 0 && (
                            <div className={`w-full pb-2 ${tabMaxW}`}>
                                <MatchBox
                                    match={finalMatch[0]}
                                    currentUser={currentUser}
                                    tournamentState={tournamentState}
                                    compact={compact}
                                />
                            </div>
                        )}
                        {thirdPlaceMatch.length > 0 && (
                            <div className={`w-full pb-2 ${tabMaxW}`}>
                                <MatchBox
                                    match={thirdPlaceMatch[0]}
                                    currentUser={currentUser}
                                    tournamentState={tournamentState}
                                    compact={compact}
                                />
                            </div>
                        )}
                    </div>
                );
            }
            
            // 16강, 8강, 4강전: 세로로 배치
            // 부모 컨테이너의 높이가 자동으로 조정되므로 h-full 사용하여 모든 공간 활용
            // 승자 패널이 잘리지 않도록 overflow-x-visible 및 패딩 추가
            // 보상 패널은 사이드바 레이아웃에서 flex-shrink-0으로 고정되어 있어 자동으로 공간 확보됨
            return (
                <div className={tabStackClass}>
                    {tab.matches.map((match) => (
                        <div key={match.id} className={`w-full pb-2 ${tabMaxW}`}>
                            <MatchBox match={match} currentUser={currentUser} tournamentState={tournamentState} compact={compact} />
                        </div>
                    ))}
                </div>
            );
        }

        // 동네바둑리그: 기존 방식 유지
        if (tab.name === TB_TAB_FINAL_THIRD_ALT) {
             const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === TB_RND_FINAL);
             const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === TB_RND_THIRD);
             return (
                <div
                    className={`flex h-full flex-col items-center justify-center ${compact ? 'gap-4 p-2' : 'gap-8 p-4'}`}
                >
                    {finalMatch.length > 0 && (
                        <div className={`w-full ${compact ? 'max-w-[168px]' : 'max-w-[200px]'}`}>
                            <MatchBox
                                match={finalMatch[0]}
                                currentUser={currentUser}
                                tournamentState={tournamentState}
                                compact={compact}
                            />
                        </div>
                    )}
                    {thirdPlaceMatch.length > 0 && (
                        <div className={`w-full ${compact ? 'max-w-[168px]' : 'max-w-[200px]'}`}>
                            <MatchBox
                                match={thirdPlaceMatch[0]}
                                currentUser={currentUser}
                                tournamentState={tournamentState}
                                compact={compact}
                            />
                        </div>
                    )}
                </div>
             );
        }

        return (
             <div className={`flex h-full items-center justify-center ${compact ? 'gap-2 p-2' : 'gap-4 p-4'}`}>
                <RoundColumn
                    name={displayBracketTabName(tab.name)}
                    matches={tab.matches}
                    currentUser={currentUser}
                    tournamentState={tournamentState}
                    compact={compact}
                />
            </div>
        );
    }

    // 보상 패널이 표시될 때 대진표가 적절히 조정되도록 함
    // 사이드바의 flex 레이아웃이 자동으로 높이를 조정하므로, 내부에서 추가로 높이 제한하지 않음
    return (
        <div className="flex h-full min-h-0 flex-col">
            <h4 className={`flex-shrink-0 text-center font-bold text-gray-200 ${compact ? 'mb-1.5 text-sm' : 'mb-3 text-lg'}`}>{tt('bracketTitle')}</h4>
            <div
                className={`flex flex-shrink-0 rounded-xl border border-gray-600/70 bg-gradient-to-r from-slate-950/95 to-slate-900/92 shadow-lg ${compact ? 'mb-2 p-0.5' : 'mb-3 p-1'}`}
            >
                {getRoundsForTabs.map((tab, index) => (
                    <button
                        key={displayBracketTabName(tab.name)}
                        onClick={() => setActiveTab(index)}
                        className={`flex-1 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                            compact ? 'py-1' : 'py-2'
                        } ${
                            tab.name === TB_TAB_FINAL_THIRD
                                ? compact
                                    ? 'text-[8px]'
                                    : 'text-[10px]'
                                : compact
                                  ? 'text-[10px]'
                                  : 'text-xs'
                        } ${
                            activeTab === index 
                                ? `bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg ${compact ? '' : 'scale-105'}` 
                                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                        }`}
                    >
                        {displayBracketTabName(tab.name)}
                    </button>
                ))}
            </div>
            {/* 대진표 내용 영역 - flex-grow로 남은 공간을 모두 사용하고, 스크롤 가능하도록 설정 */}
            <div className="flex-1 overflow-hidden overflow-x-visible min-h-0">
                {activeTabData && renderBracketForTab(activeTabData)}
            </div>
        </div>
    );
};

export const TournamentBracket: React.FC<TournamentBracketProps> = (props) => {
    const {
        tournament,
        currentUser,
        onBack,
        allUsersForRanking,
        onViewUser,
        onAction,
        onStartNextRound,
        onReset,
        onSkip,
        onOpenShop,
        isMobile,
        championshipAbilityKataLadder: championshipAbilityKataLadderProp,
    } = props;
    const abilityKataLadder = championshipAbilityKataLadderProp ?? CHAMPIONSHIP_ABILITY_KATA_LADDER;
    useTranslation('tournament');
    
    // React 훅 규칙: 모든 훅은 조건문 밖에서 호출되어야 함
    const [lastUserMatchSgfIndex, setLastUserMatchSgfIndex] = useState<number | null>(null);
    const [initialMatchPlayers, setInitialMatchPlayers] = useState<{ p1: PlayerForTournament | null, p2: PlayerForTournament | null }>({ p1: null, p2: null });
    const [showConditionPotionModal, setShowConditionPotionModal] = useState(false);
    /** 던전 챔피언십: 컨디션 낮을 때 경기 시작 전 안내(회복제로 조절 가능) */
    const [showChampionshipLowConditionStartModal, setShowChampionshipLowConditionStartModal] = useState(false);
    /** 던전 보상 수령 시 인벤토리(가방) 부족 — 서버 오류 문구를 모달로 표시 */
    const [championshipInventoryFullMessage, setChampionshipInventoryFullMessage] = useState<string | null>(null);
    /** 모바일 챔피언십 경기장: 대국자정보 / 실시간중계 / 바둑판 / 대진표 / 보상정보 */
    const [mobileChampionshipTab, setMobileChampionshipTab] = useState<'players' | 'board' | 'live' | 'bracket' | 'rewards'>('players');
    const [championshipSidebarTab, setChampionshipSidebarTab] = useState<'commentary' | 'bracket'>('bracket');
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [dungeonStageSummaryData, setDungeonStageSummaryData] = useState<{
        dungeonType: TournamentType;
        stage: number;
        tournamentState: TournamentState;
        userRank: number;
        wins: number;
        losses: number;
        baseRewards: {
            gold?: number;
            materials?: Record<string, number>;
            equipmentBoxes?: Record<string, number>;
            changeTickets?: number;
            changeTicketGrants?: { name: string; quantity: number }[];
            champCoins?: number;
        };
        rankReward?: {
            items?: Array<{ itemId: string; quantity?: number; min?: number; max?: number }>;
        };
        grantedEquipmentDrops?: Array<{ name: string; image: string }>;
        nextStageUnlocked: boolean;
        nextStageWasAlreadyUnlocked?: boolean;
    } | null>(null);
    const [dungeonStageRewardRequested, setDungeonStageRewardRequested] = useState(false);
    const [mobileRewardClaimBusy, setMobileRewardClaimBusy] = useState(false);
    const [showChampionshipExpectedRewardDetails, setShowChampionshipExpectedRewardDetails] = useState(false);
    const [showMobileChampionshipResultModal, setShowMobileChampionshipResultModal] = useState(false);
    const [showMobileChampionshipRewardModal, setShowMobileChampionshipRewardModal] = useState(false);
    const mobileChampionshipResultDismissedMatchIdRef = useRef<string | null>(null);
    const prevStatusRef = useRef(tournament?.status || 'bracket_ready');
    /** handlers.handleAction 참조가 바뀔 때마다 ENTER effect cleanup이 돌면 SAVE가 무한 반복된다 → ref로 고정 */
    const onActionRef = useRef(onAction);
    onActionRef.current = onAction;
    const initialMatchPlayersSetRef = useRef(false);
    const [nextRoundTrigger, setNextRoundTrigger] = useState(0);
    const p1ProfileRef = useRef<HTMLDivElement>(null);
    const p2ProfileRef = useRef<HTMLDivElement>(null);
    const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null); // 자동 다음 경기 카운트다운
    const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
    const nextRoundStartTimeCheckRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<number>(0); // 카운트다운 값을 저장하는 ref
    const hasAutoStartedRef = useRef(false); // 오늘 처음 입장했는지 확인
    const tournamentRef = useRef<TournamentState | undefined>(tournament); // 최신 tournament 상태를 ref로 저장
    const autoStartTimeRef = useRef<number | null>(null); // 카운트다운 시작 시간을 저장하는 ref
    const savedStartTimeRef = useRef<number | null>(null); // nextRoundStartTime을 저장하는 ref
    /** 동일 nextRoundStartTime에 대해 START_TOURNAMENT_MATCH를 한 번만 보내기 (무한 재요청 방지) */
    const hasTriggeredStartForTimeRef = useRef<number | null>(null);
    /** 카운트다운 0 시 먼저 다음 회차 탭으로 전환한 뒤 시합 시작 (순서: 대진표 탭 이동 → 대국자 표시 → 시합 시작) */
    const [pendingRoundSwitchTo, setPendingRoundSwitchTo] = useState<number | null>(null);
    const pendingMatchStartRef = useRef<{ type: TournamentType } | null>(null);
    /** 던전: 경기 시작/다음 경기 클릭 후 서버 기보 준비 완료·round_in_progress 수신까지 무기한 비활성 */
    const [championshipAwaitingKataLoad, setChampionshipAwaitingKataLoad] = useState(false);
    /** 동일 클릭으로 START_TOURNAMENT_MATCH 중복 전송 방지(리렌더 전 연타) */
    const championshipMatchStartLockRef = useRef(false);
    /** 나가기 버튼으로 의도적 퇴장 시 unmount cleanup·지연 redirect가 재입장시키지 않도록 */
    const userInitiatedArenaExitRef = useRef(false);

    const isChampionshipDungeonVenueForPotion = tournament?.currentStageAttempt != null;
    const canUseConditionPotion = useMemo(() => {
        const status = tournament?.status;
        if (!tournament?.rounds || !status) return false;
        if (status === 'round_in_progress' || status === 'complete' || status === 'eliminated') {
            return false;
        }
        if (isChampionshipDungeonVenueForPotion) {
            if (championshipAwaitingKataLoad) return false;
            return status === 'bracket_ready' || status === 'round_complete';
        }
        const hasFinishedUserMatch = tournament.rounds.some((r) =>
            r.matches?.some((m) => m.isUserMatch && m.isFinished),
        );
        return status === 'bracket_ready' && !hasFinishedUserMatch;
    }, [
        tournament?.rounds,
        tournament?.status,
        tournament?.currentStageAttempt,
        championshipAwaitingKataLoad,
        isChampionshipDungeonVenueForPotion,
    ]);

    const finalizeChampionshipDungeonMatchStart = useCallback(async () => {
        const type = tournament?.type ?? 'neighborhood';
        if (championshipMatchStartLockRef.current || championshipAwaitingKataLoad) {
            return;
        }
        championshipMatchStartLockRef.current = true;
        setChampionshipAwaitingKataLoad(true);
        try {
            const res = (await Promise.resolve(
                onAction({ type: 'START_TOURNAMENT_MATCH', payload: { type } }),
            )) as { error?: string } | void;
            if (res?.error) {
                championshipMatchStartLockRef.current = false;
                setChampionshipAwaitingKataLoad(false);
            }
        } catch {
            championshipMatchStartLockRef.current = false;
            setChampionshipAwaitingKataLoad(false);
        }
    }, [tournament?.type, championshipAwaitingKataLoad, onAction]);

    useEffect(() => {
        return () => {
            championshipMatchStartLockRef.current = false;
            setChampionshipAwaitingKataLoad(false);
        };
    }, []);

    useEffect(() => {
        if (!tournament?.type || !currentUser) return;
        const rewardClaimedKey = `${tournament.type}RewardClaimed` as keyof User;
        if (currentUser[rewardClaimedKey]) setMobileRewardClaimBusy(false);
    }, [tournament, currentUser]);

    useEffect(() => {
        if (tournament?.status === 'round_in_progress') {
            setShowChampionshipLowConditionStartModal(false);
        }
    }, [tournament?.status]);
    
    // 안전성 검사: tournament가 없으면 로딩 메시지 표시
    if (!tournament) {
        return (
            <div className="p-4 text-center">
                <p>{tt('loadingTournament')}</p>
            </div>
        );
    }
    
    // 안전성 검사: currentUser가 없으면 에러 메시지 표시
    if (!currentUser || !currentUser.id) {
        return (
            <div className="p-4 text-center">
                <p>{tt('loadingUserInfo')}</p>
            </div>
        );
    }
    
    const resolvedDungeonStageAttempt = resolveDungeonStageAttempt(tournament, currentUser, tournament.type);
    const isDungeonMode = resolvedDungeonStageAttempt >= 1;
    
    const handleCompleteDungeon = useCallback(async () => {
        const effectiveStage = resolveDungeonStageAttempt(tournament, currentUser, tournament.type);
        if (effectiveStage >= 1 && (tournament.status === 'complete' || tournament.status === 'eliminated')) {
            const stage = effectiveStage;
            const dungeonType = tournament.type;
            
            // 유저 플레이어 찾기
            const userPlayer = tournament.players.find(p => p.id === currentUser.id);
            if (!userPlayer) return;
            
            // 순위 계산 (wins/losses 기준, 모든 라운드의 경기 결과 확인)
            const playerWins: Record<string, number> = {};
            const playerLosses: Record<string, number> = {};
            tournament.players.forEach(p => { 
                playerWins[p.id] = 0; 
                playerLosses[p.id] = 0;
            });
            
            // 모든 라운드의 모든 경기 결과 확인
            tournament.rounds.forEach(round => {
                if (round.matches) {
                    round.matches.forEach(m => {
                        if (m.isFinished && m.winner) {
                            playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                            const loser = m.players.find(p => p && p.id !== m.winner?.id);
                            if (loser) {
                                playerLosses[loser.id] = (playerLosses[loser.id] || 0) + 1;
                            }
                        }
                    });
                }
            });
            
            // 순위 정렬: 승수 → 패수 → 승률
            const rankedPlayers = [...tournament.players].sort((a, b) => {
                if (playerWins[b.id] !== playerWins[a.id]) {
                    return playerWins[b.id] - playerWins[a.id];
                }
                if (playerLosses[a.id] !== playerLosses[b.id]) {
                    return playerLosses[a.id] - playerLosses[b.id];
                }
                const aWinRate = (playerWins[a.id] + playerLosses[a.id]) > 0 ? playerWins[a.id] / (playerWins[a.id] + playerLosses[a.id]) : 0;
                const bWinRate = (playerWins[b.id] + playerLosses[b.id]) > 0 ? playerWins[b.id] / (playerWins[b.id] + playerLosses[b.id]) : 0;
                return bWinRate - aWinRate;
            });
            const userRank = rankedPlayers.findIndex(p => p.id === currentUser.id) + 1;
            
            // 실제 승/패 수집
            const userWins = playerWins[currentUser.id] || 0;
            const userLosses = playerLosses[currentUser.id] || 0;
            
            // 기본 보상 수집
            const baseRewards: {
                gold?: number;
                materials?: Record<string, number>;
                equipmentBoxes?: Record<string, number>;
                changeTickets?: number;
                changeTicketGrants?: { name: string; quantity: number }[];
                champCoins?: number;
            } = {};
            
            if (tournament.accumulatedGold) {
                baseRewards.gold = tournament.accumulatedGold;
            }
            if (tournament.accumulatedMaterials) {
                baseRewards.materials = tournament.accumulatedMaterials;
            }
            if (tournament.accumulatedEquipmentBoxes) {
                baseRewards.equipmentBoxes = tournament.accumulatedEquipmentBoxes;
            }
            
            // 변경권은 월드챔피언십의 장비상자 보상에 포함
            if (dungeonType === 'world' && DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage]?.changeTickets) {
                baseRewards.changeTickets = DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage].changeTickets;
            }
            
            // 순위 보상 (표시용 = 범위값 min~max)
            const cleared = userRank <= (dungeonType === 'neighborhood' ? 6 : dungeonType === 'national' ? 8 : 16);
            const rankRewardRange = cleared ? getDungeonRankRewardRangeForDisplay(dungeonType, stage, userRank) ?? undefined : undefined;
            const rankReward = rankRewardRange?.items?.length ? { items: rankRewardRange.items } : undefined;
            
            // 다음 단계 언락 여부 확인
            // 서버에서 userRank <= 3일 때 stage + 1을 언락하므로, userRank <= 3이면 언락됨
            // 모달은 서버 응답 전에 표시되므로, userRank <= 3이면 언락될 것으로 예상
            const dungeonProgress = currentUser.dungeonProgress?.[dungeonType];
            // 서버 응답을 받기 전이므로, userRank가 1~3이면 언락될 것으로 예상
            // 서버 응답 후 useEffect에서 실제 언락 상태로 업데이트됨
            const nextStage = stage + 1;
            // 1위, 2위, 3위를 달성했으면 다음 단계가 언락됨 (서버 응답 전이어도 예상값 사용)
            const nextStageUnlocked = userRank >= 1 && userRank <= 3 && stage < 10 && (
                dungeonProgress?.unlockedStages?.includes(nextStage) || userRank <= 3 // 서버 응답 전이어도 1~3위면 언락 예상
            );
            
            type DungeonRes = { userRank: number; userWins: number; userLosses: number; baseRewards: Record<string, unknown>; grantedRankReward?: { items: Array<{ itemId: string; quantity: number }> }; grantedEquipmentDrops?: Array<{ name: string; image: string }>; nextStageUnlocked: boolean; nextStageWasAlreadyUnlocked?: boolean; dungeonState?: TournamentState };
            const raw = (await (onAction({ type: 'COMPLETE_DUNGEON_STAGE', payload: { dungeonType, stage } }) as unknown as Promise<unknown>)) as { error?: string; clientResponse?: DungeonRes } | DungeonRes | undefined;
            const errMsg =
                raw && typeof raw === 'object' && typeof (raw as { error?: unknown }).error === 'string'
                    ? (raw as { error: string }).error
                    : undefined;
            if (errMsg && /가방|인벤토리|공간/.test(errMsg)) {
                setChampionshipInventoryFullMessage(errMsg);
                return;
            }
            const res: DungeonRes | null = raw && typeof raw === 'object' && !errMsg ? ((raw as { clientResponse?: DungeonRes }).clientResponse ?? (raw as DungeonRes)) : null;
            if (!res || res.userRank == null) return;
            setDungeonStageSummaryData({
                dungeonType,
                stage,
                tournamentState: (res.dungeonState ?? tournament) as TournamentState,
                userRank: res.userRank,
                wins: res.userWins,
                losses: res.userLosses,
                baseRewards: (res.baseRewards ?? {}) as {
                    gold?: number;
                    materials?: Record<string, number>;
                    equipmentBoxes?: Record<string, number>;
                    changeTickets?: number;
                    changeTicketGrants?: { name: string; quantity: number }[];
                    champCoins?: number;
                },
                rankReward: res.grantedRankReward ? { items: res.grantedRankReward.items.map(it => ({ itemId: it.itemId, quantity: it.quantity })) } : undefined,
                grantedEquipmentDrops: res.grantedEquipmentDrops,
                nextStageUnlocked: !!res.nextStageUnlocked,
                nextStageWasAlreadyUnlocked: !!res.nextStageWasAlreadyUnlocked
            });
            // 모달이 뜬 뒤에만 보상 수령 완료로 표시 (보상받기 → 보상 완료 전환)
            setDungeonStageRewardRequested(true);
        }
    }, [tournament, currentUser.id, currentUser.dungeonProgress, onAction]);

    const handleOpenRewardHistory = useCallback(() => {
        const summary = tournament?.claimedRewardSummary;
        if (!summary || !tournament) return;

        setDungeonStageSummaryData({
            dungeonType: tournament.type,
            stage: summary.stage,
            tournamentState: tournament,
            userRank: summary.userRank,
            wins: summary.wins,
            losses: summary.losses,
            baseRewards: summary.baseRewards,
            rankReward: summary.rankReward,
            grantedEquipmentDrops: summary.grantedEquipmentDrops,
            nextStageUnlocked: summary.nextStageUnlocked,
            nextStageWasAlreadyUnlocked: summary.nextStageWasAlreadyUnlocked,
        });
    }, [tournament]);
    
    // 서버 응답 후 모달 데이터 업데이트 (다음 단계 언락 상태 반영)
    // 1·2·3위만 다음 단계 열림. 4위 이하는 unlockedStages에 다음 단계가 있어도 표시하지 않음
    useEffect(() => {
        if (dungeonStageSummaryData && currentUser.dungeonProgress) {
            const dungeonProgress = currentUser.dungeonProgress[dungeonStageSummaryData.dungeonType];
            if (dungeonProgress) {
                const nextStage = dungeonStageSummaryData.stage + 1;
                const isTopThree = dungeonStageSummaryData.userRank >= 1 && dungeonStageSummaryData.userRank <= 3;
                const stageUnderMax = dungeonStageSummaryData.stage < 10;
                const nextInList = dungeonProgress.unlockedStages?.includes(nextStage) ?? false;
                const nextStageUnlocked = isTopThree && stageUnderMax && nextInList;
                
                if (nextStageUnlocked !== dungeonStageSummaryData.nextStageUnlocked) {
                    setDungeonStageSummaryData(prev => prev ? { ...prev, nextStageUnlocked } : null);
                }
            }
        }
    }, [currentUser.dungeonProgress, currentUser.neighborhoodRewardClaimed, currentUser.nationalRewardClaimed, currentUser.worldRewardClaimed, dungeonStageSummaryData]);
    
    // 챔피언십 실대국 중계 배속. localStorage에 영속화. 던전 단계에 따라 허용 배속이 달라진다(아래 effective 참고).
    const [championshipPlaybackSpeed, setChampionshipPlaybackSpeed] = useState<ChampionshipPlaybackSpeed>(() => {
        if (typeof window === 'undefined') return 1;
        try {
            const saved = window.localStorage.getItem('championshipPlaybackSpeed');
            if (saved === '0.5') return 0.5;
            if (saved === '2') return 2;
            if (saved === '3') return 3;
        } catch { /* 무시 */ }
        return 1;
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem('championshipPlaybackSpeed', String(championshipPlaybackSpeed));
        } catch { /* 무시 */ }
    }, [championshipPlaybackSpeed]);

    const championshipDungeonPlaybackSpeedChoices = useMemo((): readonly ChampionshipPlaybackSpeed[] => {
        const attempt = tournament?.currentStageAttempt;
        if (attempt == null || attempt < 1 || attempt > 10) {
            return [0.5, 1, 2, 3];
        }
        return resolveChampionshipDungeonPlaybackSpeedChoices(attempt) as readonly ChampionshipPlaybackSpeed[];
    }, [tournament?.currentStageAttempt]);

    /** 저장값이 현재 단계에서 불가하면(예: 1단계에서 x3) 재생은 x1 등 허용값으로만 진행 */
    const effectiveChampionshipPlaybackSpeed = useMemo((): ChampionshipPlaybackSpeed => {
        const choices = championshipDungeonPlaybackSpeedChoices;
        if (choices.includes(championshipPlaybackSpeed)) return championshipPlaybackSpeed;
        if (choices.includes(1)) return 1;
        return choices[choices.length - 1]!;
    }, [championshipDungeonPlaybackSpeedChoices, championshipPlaybackSpeed]);

    // 클라이언트에서 시뮬레이션 실행
    const simulatedTournament = useTournamentSimulation(tournament, currentUser, effectiveChampionshipPlaybackSpeed);
    const displayTournament = simulatedTournament || tournament;
    const displayTournamentRef = useRef(displayTournament);
    useEffect(() => {
        displayTournamentRef.current = displayTournament;
    }, [displayTournament]);

    const safeRounds = useMemo(() => {
        if (!tournament || !Array.isArray(tournament.rounds)) {
            return [];
        }
        return tournament.rounds;
    }, [tournament?.rounds]);

    const functionVipActive = useMemo(() => isFunctionVipActive(currentUser as User), [currentUser]);

    /** 챔피언십 던전(currentStageAttempt)에서 SKIP 노출·클릭 가능 여부 */
    const championshipDungeonSkipUi = useMemo(() => {
        const t = tournament;
        if (!t || t.currentStageAttempt == null) return { visible: false, canAttempt: false };
        if (t.status === 'complete' || t.status === 'eliminated') return { visible: false, canAttempt: false };

        const hasUnfinishedUserMatch = safeRounds.some((r) =>
            Array.isArray(r?.matches) && r.matches.some((m) => m.isUserMatch && !m.isFinished)
        );
        if (!hasUnfinishedUserMatch) return { visible: false, canAttempt: false };

        if (t.status === 'round_in_progress') {
            return { visible: true, canAttempt: true };
        }

        let nextMatch: Match | undefined;
        if (t.type === 'neighborhood') {
            const currentRound = t.currentRoundRobinRound || 1;
            const currentRoundObj = safeRounds.find((r) => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
            if (currentRoundObj) {
                nextMatch = currentRoundObj.matches.find((m) => m.isUserMatch && !m.isFinished);
            }
        } else {
            nextMatch = safeRounds.flatMap((r) => r.matches).find((m) => m.isUserMatch && !m.isFinished);
        }
        const p1 =
            nextMatch && Array.isArray(t.players) ? t.players.find((p) => p.id === nextMatch!.players[0]?.id) : null;
        const p2 =
            nextMatch && Array.isArray(t.players) ? t.players.find((p) => p.id === nextMatch!.players[1]?.id) : null;
        const playersReady = Boolean(
            p1 &&
                p2 &&
                p1.stats &&
                p2.stats &&
                Object.keys(p1.stats).length > 0 &&
                Object.keys(p2.stats).length > 0
        );

        if (t.status === 'bracket_ready' || t.status === 'round_complete') {
            return { visible: true, canAttempt: playersReady };
        }
        return { visible: false, canAttempt: false };
    }, [tournament, safeRounds]);
    
    // 토너먼트 상태 로깅 (개발 시에만)
    useEffect(() => {
        if (import.meta.env.DEV && tournament) {
            console.log('[TournamentBracket] tournament status:', tournament.status, 'type:', tournament.type, 'round:', tournament.currentRoundRobinRound);
        }
    }, [tournament?.status, tournament?.type, tournament?.currentRoundRobinRound]);

    useEffect(() => {
        if (!currentUser?.id) return;
        if (import.meta.env.DEV) {
            console.log('[TournamentBracket] ENTER_TOURNAMENT_VIEW');
        }
        onActionRef.current({ type: 'ENTER_TOURNAMENT_VIEW' });
        return () => {
            if (userInitiatedArenaExitRef.current) {
                return;
            }
            const t = displayTournamentRef.current;
            if (t?.status === 'round_in_progress') {
                void onActionRef.current({
                    type: 'SAVE_TOURNAMENT_PROGRESS',
                    payload: { type: t.type, tournamentSnapshot: t },
                });
            }
            if (import.meta.env.DEV) {
                console.log('[TournamentBracket] LEAVE_TOURNAMENT_VIEW');
            }
            onActionRef.current({ type: 'LEAVE_TOURNAMENT_VIEW' });
        };
    }, [currentUser?.id]);

    // 자동 다음 경기 진행 로직
    useEffect(() => {
        // 안전성 검사: 필수 props와 데이터 확인
        if (!tournament || !onAction || !onStartNextRound || !Array.isArray(safeRounds)) {
            if (import.meta.env.DEV) {
                console.log('[TournamentBracket] useEffect skip - missing data:', {
                    tournament: !!tournament,
                    onAction: !!onAction,
                    onStartNextRound: !!onStartNextRound,
                    safeRounds: Array.isArray(safeRounds)
                });
            }
            return;
        }
        
        const status = tournament.status;
        const prevStatus = prevStatusRef.current;
        
        if (import.meta.env.DEV && status !== prevStatus) {
            console.log('[TournamentBracket] status change:', prevStatus, '->', status, 'tournament.type:', tournament.type);
        }
        
        // 서버에서 자동으로 다음 경기를 시작하므로 클라이언트는 단순히 상태 변경을 감지
        // bracket_ready 상태일 때는 카운트다운 타이머가 nextRoundStartTime 전용 effect에서만 관리됨.
        // 이 effect에서는 타이머를 정리하지 않음 (currentRoundRobinRound/safeRounds 변경 시 cleanup이
        // 호출되어 카운트다운이 5에서 멈추는 버그 방지).
        // round_in_progress / complete / eliminated 로 바뀐 경우에만 타이머 정리
        if (status === 'round_in_progress' || status === 'complete' || status === 'eliminated') {
            if (autoNextTimerRef.current) {
                clearInterval(autoNextTimerRef.current);
                autoNextTimerRef.current = null;
            }
            setAutoNextCountdown(null);
        }

        if (status === 'round_in_progress' && prevStatus !== 'round_in_progress') {
            setChampionshipSidebarTab('commentary');
        }
        
        // prevStatusRef 업데이트
        prevStatusRef.current = status;
        
        // cleanup에서 타이머를 건드리지 않음 (카운트다운은 nextRoundStartTime effect에서만 관리)
        // deps에 onAction/onStartNextRound/safeRounds를 넣지 않음 — handlers 참조 변경 시 effect·로그 폭주 방지
        return () => {};
    }, [tournament?.status, tournament?.type, tournament?.currentRoundRobinRound]);
    
    // tournament ref 업데이트 - 항상 최신 상태 유지
    useEffect(() => {
        tournamentRef.current = tournament;
        // nextRoundStartTime이 변경되었을 때 로그 출력
        if (import.meta.env.DEV && tournament?.nextRoundStartTime) {
            console.log(`[TournamentBracket] Tournament ref updated, nextRoundStartTime: ${tournament.nextRoundStartTime}, status: ${tournament.status}, currentRound: ${tournament.currentRoundRobinRound}`);
        }
    }, [tournament]);

    // nextRoundStartTime 체크: 5초 카운트다운 후 자동으로 경기 시작
    useEffect(() => {
        const nextRoundStartTime = tournament?.nextRoundStartTime;
        const status = tournament?.status;
        
        // nextRoundStartTime이 없을 때: 이미 카운트다운이 진행 중이면 유지(잠깐 undefined 오는 경우 대비)
        if (!nextRoundStartTime) {
            const saved = savedStartTimeRef.current;
            if (saved != null && Date.now() < saved && autoNextTimerRef.current) {
                return; // 이미 동일 회차 카운트다운 진행 중 → 타이머 유지
            }
            setAutoNextCountdown(null);
            if (autoNextTimerRef.current) {
                clearInterval(autoNextTimerRef.current);
                autoNextTimerRef.current = null;
            }
            countdownRef.current = 0;
            autoStartTimeRef.current = null;
            savedStartTimeRef.current = null;
            hasTriggeredStartForTimeRef.current = null;
            return;
        }

        // 기존 타이머가 있고 같은 startTime이면 재설정하지 않음 (중복 실행 방지)
        if (autoNextTimerRef.current && savedStartTimeRef.current === nextRoundStartTime) {
            return;
        }

        // 기존 타이머가 있으면 정리
        if (autoNextTimerRef.current) {
            clearInterval(autoNextTimerRef.current);
            autoNextTimerRef.current = null;
        }

        // nextRoundStartTime을 ref에 저장하여 타이머가 중단되지 않도록 함 (새 회차면 트리거 플래그 초기화)
        savedStartTimeRef.current = nextRoundStartTime;
        autoStartTimeRef.current = nextRoundStartTime;
        hasTriggeredStartForTimeRef.current = null;
        const savedTournamentType = tournament?.type;
        const savedCurrentRound = tournament?.currentRoundRobinRound;

        const updateCountdown = () => {
            // savedStartTimeRef를 사용하여 타이머가 중단되지 않도록 함
            const startTime = savedStartTimeRef.current;
            if (!startTime) {
                // startTime이 없으면 타이머 정리
                setAutoNextCountdown(null);
                countdownRef.current = 0;
                if (autoNextTimerRef.current) {
                    clearInterval(autoNextTimerRef.current);
                    autoNextTimerRef.current = null;
                }
                return;
            }

            const now = Date.now();
            const timeUntilStart = startTime - now;
            const secondsLeft = Math.max(0, Math.ceil(timeUntilStart / 1000));

            // 항상 카운트다운 업데이트 (0까지 표시)
            setAutoNextCountdown(secondsLeft);

            // 디버깅: 매 초마다 로그 출력 (초가 변경될 때만)
            if (countdownRef.current !== secondsLeft) {
                countdownRef.current = secondsLeft;
                if (secondsLeft > 0) {
                    console.log(`[TournamentBracket] Countdown: ${secondsLeft}s left (startTime: ${startTime}, now: ${now}, diff: ${timeUntilStart}ms)`);
                } else {
                    console.log(`[TournamentBracket] Countdown reached 0, starting match...`);
                }
            }

            // 시간이 지났거나 0에 도달했을 때 경기 시작
            if (timeUntilStart <= 0) {
                // 카운트다운이 끝났으면 바로 경기 시작
                setAutoNextCountdown(null);
                countdownRef.current = 0;
                if (autoNextTimerRef.current) {
                    clearInterval(autoNextTimerRef.current);
                    autoNextTimerRef.current = null;
                }
                autoStartTimeRef.current = null;
                savedStartTimeRef.current = null;
                
                // 다음 경기 찾기 - tournamentRef.current를 사용하여 최신 상태 확인
                const currentTournament = tournamentRef.current;
                const rounds = currentTournament?.rounds || [];
                let nextMatch: Match | undefined = undefined;
                const tournamentType = currentTournament?.type || savedTournamentType;
                const currentRound = currentTournament?.currentRoundRobinRound || savedCurrentRound;
                
                let roundNumForTab: number | null = currentRound ?? null;
                if (tournamentType === 'neighborhood') {
                    // currentRoundRobinRound가 있으면 사용
                    if (currentRound) {
                        const currentRoundObj = rounds.find(r => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
                        if (currentRoundObj) {
                            nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        }
                    }
                    // currentRoundRobinRound가 없거나 경기를 찾지 못한 경우 모든 라운드에서 찾기
                    if (!nextMatch) {
                        for (const round of rounds) {
                            const match = round.matches.find(m => m.isUserMatch && !m.isFinished);
                            if (match) {
                                nextMatch = match;
                                const parsed = parseInt(round.name.replace(TB_ROUND_SUFFIX, ''), 10);
                                roundNumForTab = Number.isNaN(parsed) ? null : parsed;
                                break;
                            }
                        }
                    }
                } else {
                    // 전국/월드챔피언십: 다음 경기 찾기
                    nextMatch = rounds
                        .flatMap(r => r.matches)
                        .find(m => m.isUserMatch && !m.isFinished);
                }

                // 경기를 찾았으면: 동일 startTime에 대해 한 번만 전송 (무한 재요청/무한루프 방지)
                if (nextMatch) {
                    if (hasTriggeredStartForTimeRef.current === startTime) {
                        return; // 이미 이 시각에 대해 시작 요청 보냄 → 중복 전송 방지
                    }
                    hasTriggeredStartForTimeRef.current = startTime;
                    console.log('[TournamentBracket] Auto-starting match after countdown', {
                        nextMatch: nextMatch.id,
                        status: currentTournament?.status,
                        type: tournamentType,
                        roundNumForTab
                    });
                    if (tournamentType === 'neighborhood' && roundNumForTab != null) {
                        // 순서: 1) 다음 회차 탭 이동 요청 → 2) 2회차 대국자 갱신 및 바둑판 초기화 → 3) 150ms 후 시합 시작
                        setPendingRoundSwitchTo(roundNumForTab);
                        pendingMatchStartRef.current = { type: 'neighborhood' as TournamentType };
                        setLastUserMatchSgfIndex(null);
                        const players = currentTournament?.players;
                        if (Array.isArray(players)) {
                            const p1 = players.find((p: PlayerForTournament) => p.id === nextMatch!.players[0]?.id) || null;
                            const p2 = players.find((p: PlayerForTournament) => p.id === nextMatch!.players[1]?.id) || null;
                            const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => ({
                                ...player,
                                stats: (player.originalStats || player.stats) ? { ...(player.originalStats || player.stats)! } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            });
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    } else {
                        setChampionshipSidebarTab('commentary');
                        onActionRef.current({
                            type: 'START_TOURNAMENT_MATCH',
                            payload: { type: tournamentType || 'neighborhood' }
                        });
                    }
                } else {
                    console.warn('[TournamentBracket] Cannot auto-start match: no next match found', {
                        status: currentTournament?.status,
                        type: tournamentType,
                        roundNumForTab,
                        roundsCount: rounds.length
                    });
                }
            }
        };

        // 즉시 한 번 실행하고 타이머 시작
        const timeUntilStart = savedStartTimeRef.current - Date.now();
        console.log(`[TournamentBracket] nextRoundStartTime detected: ${savedStartTimeRef.current}, current time: ${Date.now()}, time until start: ${timeUntilStart}ms, status: ${status}`);
        
        // 이미 시간이 지나간 경우 즉시 시작
        if (timeUntilStart <= 0) {
            console.log(`[TournamentBracket] nextRoundStartTime already passed, starting match immediately`);
            updateCountdown(); // 이 함수 내에서 자동 시작 처리
        } else {
            updateCountdown();
            // 100ms마다 업데이트하여 정확한 카운트다운 유지
            autoNextTimerRef.current = setInterval(updateCountdown, 100);
        }

        return () => {
            // cleanup: nextRoundStartTime이 변경될 때만 타이머 정리
            // 하지만 savedStartTimeRef를 사용하므로 타이머는 계속 실행됨
        };
    }, [tournament?.nextRoundStartTime]); // nextRoundStartTime만 의존성으로 사용하여 타이머가 중단되지 않도록 함
    
    // 다음 회차 탭 전환 후 시합 자동 시작 (동네 챔피언십 순서 보장)
    useEffect(() => {
        if (pendingRoundSwitchTo == null || !pendingMatchStartRef.current) return;
        const payload = pendingMatchStartRef.current;
        const t = setTimeout(() => {
            setChampionshipSidebarTab('commentary');
            onActionRef.current({
                type: 'START_TOURNAMENT_MATCH',
                payload: { type: payload.type }
            });
            pendingMatchStartRef.current = null;
            // pendingRoundSwitchTo는 서버가 round_in_progress로 바꿀 때만 초기화 (아래 useEffect).
            // 그 전에 null로 만들면 3회차→ 등에서 다시 lastFinishedUserMatch(2회차)가 보이는 문제 방지.
        }, 150);
        return () => clearTimeout(t);
    }, [pendingRoundSwitchTo]);

    // round_in_progress로 전환되면 pending 회차 표시 해제 (이후 회차도 순차 표시 유지)
    // 동네바둑리그 5회차 직후: 클라이언트가 round_in_progress를 건너뛰고 complete만 받으면 pending이 남아
    // SGF가 비고(아래 fileIndex가 null) 보상 패널이 깨진 것처럼 보이는 문제가 생김 → complete/eliminated에서도 해제
    useEffect(() => {
        if (pendingRoundSwitchTo == null) return;
        const s = tournament?.status;
        if (s === 'round_in_progress' || s === 'complete' || s === 'eliminated') {
            setPendingRoundSwitchTo(null);
        }
    }, [tournament?.status, pendingRoundSwitchTo]);
    
    useEffect(() => {
        // 안전성 검사
        if (!tournament || !Array.isArray(safeRounds)) {
            return;
        }
        
        const status = tournament.status;
        const prevStatus = prevStatusRef.current;
    
        // 경기가 완료되면 마지막 유저 경기의 SGF 인덱스 저장 (모든 회차에서 동일하게 적용)
        if (status === 'round_complete' || status === 'eliminated' || status === 'complete') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch && lastFinishedUserMatch.sgfFileIndex !== undefined) {
                setLastUserMatchSgfIndex(lastFinishedUserMatch.sgfFileIndex);
            }
        } else if (status === 'bracket_ready') {
            // bracket_ready 상태일 때는 다음 경기가 있으면 준비 상태, 없으면 마지막 경기 완료 상태
            // 다음 경기가 있으면 SGF 인덱스 초기화 (빈 바둑판 표시)
            // 다음 경기가 없으면 (마지막 경기였으면) 마지막 완료된 경기의 SGF를 유지
            const hasNextMatch = safeRounds.some(r => 
                r.matches.some(m => m.isUserMatch && !m.isFinished)
            );
            
            // round_complete에서 bracket_ready로 변경될 때: 카운트다운 중이면 이전 경기 유지, 아니면 다음 경기 선수로 갱신
            if (prevStatus === 'round_complete' && hasNextMatch && tournament && Array.isArray(tournament.players)) {
                const countdownInProgress = tournament.nextRoundStartTime != null;
                if (!countdownInProgress) {
                    setInitialMatchPlayers({ p1: null, p2: null });
                    initialMatchPlayersSetRef.current = false;
                    let nextMatch: Match | undefined = undefined;
                    if (tournament.type === 'neighborhood') {
                        const currentRound = tournament.currentRoundRobinRound || 1;
                        const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
                        if (currentRoundObj) {
                            nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        }
                    } else {
                        nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
                    }
                    if (nextMatch) {
                        const p1 = tournament.players.find(p => p.id === nextMatch.players[0]?.id) || null;
                        const p2 = tournament.players.find(p => p.id === nextMatch.players[1]?.id) || null;
                        if (p1 || p2) {
                            const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => ({
                                ...player,
                                stats: (player.originalStats || player.stats) ? { ...(player.originalStats || player.stats)! } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            });
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                }
            }
            
            if (!hasNextMatch) {
                // 마지막 경기였으면 완료된 경기 화면 유지
                const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                if (lastFinishedUserMatch && lastFinishedUserMatch.sgfFileIndex !== undefined) {
                    setLastUserMatchSgfIndex(lastFinishedUserMatch.sgfFileIndex);
                }
            } else {
                // 다음 경기가 있으면: 카운트다운 중에는 마지막 수순 유지, 카운트다운 끝난 뒤에만 바둑판 초기화
                const countdownInProgress = tournament.nextRoundStartTime != null;
                if (!countdownInProgress) {
                    setLastUserMatchSgfIndex(null);
                }
            }
        } else if (status === 'round_in_progress' && tournament) {
            // 경기가 시작되면 초기 플레이어 상태 저장
            // timeElapsed가 0이거나 1일 때, 또는 이전 상태가 round_in_progress가 아니었을 때
            const matchInfo = tournament.currentSimulatingMatch;
            const isNewMatch = prevStatus !== 'round_in_progress';
            const isEarlyTime = tournament.timeElapsed === 0 || tournament.timeElapsed === 1;
            
            // bracket_ready에서 round_in_progress로 변경되었을 때는 항상 선수 정보 업데이트
            const shouldForceUpdate = isNewMatch || (isEarlyTime && !initialMatchPlayersSetRef.current);
            
            if (matchInfo && shouldForceUpdate) {
                const match = safeRounds[matchInfo.roundIndex]?.matches[matchInfo.matchIndex];
                if (match) {
                    const p1 = tournament.players.find(p => p.id === match.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === match.players[1]?.id) || null;
                    // originalStats를 포함한 깊은 복사로 초기 상태 저장
                    // originalStats가 있으면 그것을 사용, 없으면 현재 stats 사용
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        console.log('[TournamentBracket] player update:', { 
                            p1Id: p1?.id, 
                            p2Id: p2?.id, 
                            isNewMatch, 
                            isEarlyTime, 
                            timeElapsed: tournament.timeElapsed 
                        });
                        
                        setInitialMatchPlayers({
                            p1: p1 ? createPlayerCopy(p1) : null,
                            p2: p2 ? createPlayerCopy(p2) : null,
                        });
                        initialMatchPlayersSetRef.current = true;
                    }
                }
            }
        } else {
            // status가 'round_in_progress'가 아닌 다른 상태일 때
            // 경기가 막 끝났지만 아직 서버에서 상태가 업데이트되지 않은 경우 (currentSimulatingMatch가 있지만 status가 round_in_progress가 아님)
            // 이 경우에도 마지막 경기의 선수 정보를 유지
            if (tournament.currentSimulatingMatch && (tournament.status !== 'round_in_progress')) {
                const matchInfo = tournament.currentSimulatingMatch;
                const match = safeRounds[matchInfo.roundIndex]?.matches[matchInfo.matchIndex];
                if (match) {
                    const p1 = tournament.players.find(p => p.id === match.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === match.players[1]?.id) || null;
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        // 이미 설정되어 있지 않거나 선수가 변경된 경우에만 업데이트
                        // 컨디션 변경도 감지하여 업데이트 (회복제 사용 등)
                        const conditionChanged = (initialMatchPlayers.p1 && p1 && initialMatchPlayers.p1.condition !== p1.condition) ||
                                                 (initialMatchPlayers.p2 && p2 && initialMatchPlayers.p2.condition !== p2.condition);
                        
                        const shouldUpdate = !initialMatchPlayersSetRef.current || 
                            initialMatchPlayers.p1?.id !== p1?.id || 
                            initialMatchPlayers.p2?.id !== p2?.id ||
                            conditionChanged;
                        
                        if (shouldUpdate) {
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                }
            }
            // round_complete 상태일 때는 마지막 완료된 경기의 선수 정보를 유지
            if (tournament.status === 'round_complete' || tournament.status === 'complete' || tournament.status === 'eliminated') {
                // 마지막 완료된 경기의 선수 정보를 찾아서 유지
                const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                if (lastFinishedUserMatch) {
                    const p1 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[1]?.id) || null;
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        // 이미 설정되어 있지 않거나 선수가 변경된 경우에만 업데이트
                        // 컨디션 변경도 감지하여 업데이트 (회복제 사용 등)
                        const conditionChanged = (initialMatchPlayers.p1 && p1 && initialMatchPlayers.p1.condition !== p1.condition) ||
                                                 (initialMatchPlayers.p2 && p2 && initialMatchPlayers.p2.condition !== p2.condition);
                        
                        const shouldUpdate = !initialMatchPlayersSetRef.current || 
                            initialMatchPlayers.p1?.id !== p1?.id || 
                            initialMatchPlayers.p2?.id !== p2?.id ||
                            conditionChanged;
                        
                        if (shouldUpdate) {
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                }
            } else if (tournament.status === 'bracket_ready') {
                const countdownInProgress = tournament.nextRoundStartTime != null;
                const lastFinishedUserMatchForPlayers = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                let nextMatch: Match | undefined = undefined;
                if (countdownInProgress && lastFinishedUserMatchForPlayers) {
                    nextMatch = lastFinishedUserMatchForPlayers;
                } else if (!countdownInProgress) {
                    if (tournament.type === 'neighborhood') {
                        const currentRound = tournament.currentRoundRobinRound || 1;
                        const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
                        if (currentRoundObj) {
                            nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        }
                    } else {
                        nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
                    }
                }
                
                if (nextMatch) {
                    const p1 = tournament.players.find(p => p.id === nextMatch.players[0]?.id) || null;
                    const p2 = tournament.players.find(p => p.id === nextMatch.players[1]?.id) || null;
                    if (p1 || p2) {
                        const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                            const statsToUse = player.originalStats || player.stats;
                            return {
                                ...player,
                                stats: statsToUse ? { ...statsToUse } : player.stats,
                                originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                            };
                        };
                        
                        // 컨디션 변경도 감지하여 업데이트 (회복제 사용 등)
                        const conditionChanged = (initialMatchPlayers.p1 && p1 && initialMatchPlayers.p1.condition !== p1.condition) ||
                                                 (initialMatchPlayers.p2 && p2 && initialMatchPlayers.p2.condition !== p2.condition);
                        
                        // round_complete에서 bracket_ready로 변경될 때 (다음경기 버튼을 눌렀을 때) 강제로 갱신
                        const isTransitionFromRoundComplete = prevStatus === 'round_complete';
                        
                        // 선수 ID가 변경되었거나, 컨디션이 변경되었거나, initialMatchPlayersSetRef가 false이면 업데이트
                        // 특히 전국/월드챔피언십에서 다음 라운드로 이동할 때 선수 ID가 변경되므로 항상 확인
                        // round_complete에서 bracket_ready로 변경될 때는 항상 업데이트 (이전 경기 정보가 남아있을 수 있음)
                        const shouldUpdate = isTransitionFromRoundComplete ||
                            !initialMatchPlayersSetRef.current || 
                            initialMatchPlayers.p1?.id !== p1?.id || 
                            initialMatchPlayers.p2?.id !== p2?.id ||
                            conditionChanged ||
                            // rounds가 변경되었을 때도 업데이트 (다음 라운드 대진표가 생성되었을 때)
                            (tournament.type !== 'neighborhood' && safeRounds.length > 0);
                        
                        if (shouldUpdate) {
                            setInitialMatchPlayers({
                                p1: p1 ? createPlayerCopy(p1) : null,
                                p2: p2 ? createPlayerCopy(p2) : null,
                            });
                            initialMatchPlayersSetRef.current = true;
                        }
                    }
                } else {
                    // 다음 경기가 없으면 마지막 완료된 경기의 선수 정보 유지
                    const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
                    if (lastFinishedUserMatch) {
                        const p1 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[0]?.id) || null;
                        const p2 = tournament.players.find(p => p.id === lastFinishedUserMatch.players[1]?.id) || null;
                        if (p1 || p2) {
                            const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                                const statsToUse = player.originalStats || player.stats;
                                return {
                                    ...player,
                                    stats: statsToUse ? { ...statsToUse } : player.stats,
                                    originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                                };
                            };
                            
                            const shouldUpdate = !initialMatchPlayersSetRef.current || 
                                initialMatchPlayers.p1?.id !== p1?.id || 
                                initialMatchPlayers.p2?.id !== p2?.id;
                            
                            if (shouldUpdate) {
                                setInitialMatchPlayers({
                                    p1: p1 ? createPlayerCopy(p1) : null,
                                    p2: p2 ? createPlayerCopy(p2) : null,
                                });
                                initialMatchPlayersSetRef.current = true;
                            }
                        }
                    } else {
                        // 완료된 경기도 없으면 초기화하지 않음 (이전 정보 유지)
                    }
                }
            }
        }
    
        prevStatusRef.current = status;
    }, [tournament?.status, tournament?.type, safeRounds]);
    
    // nextRoundTrigger가 변경되면 다음 경기의 선수 정보를 강제로 업데이트
    useEffect(() => {
        if (nextRoundTrigger > 0 && tournament.status === 'bracket_ready') {
            // 다음 경기 찾기
            let nextMatch: Match | undefined = undefined;
            if (tournament.type === 'neighborhood') {
                const currentRound = tournament.currentRoundRobinRound || 1;
                const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
                if (currentRoundObj) {
                    nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                }
            } else {
                // 전국/월드챔피언십: 다음 경기 찾기
                nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
            }
            
            if (nextMatch) {
                const p1 = tournament.players.find(p => p.id === nextMatch.players[0]?.id) || null;
                const p2 = tournament.players.find(p => p.id === nextMatch.players[1]?.id) || null;
                if (p1 || p2) {
                    const createPlayerCopy = (player: PlayerForTournament): PlayerForTournament => {
                        const statsToUse = player.originalStats || player.stats;
                        return {
                            ...player,
                            stats: statsToUse ? { ...statsToUse } : player.stats,
                            originalStats: player.originalStats ? { ...player.originalStats } : (player.stats ? { ...player.stats } : undefined)
                        };
                    };
                    
                    // nextRoundTrigger가 변경되었으므로 강제로 업데이트
                    setInitialMatchPlayers({
                        p1: p1 ? createPlayerCopy(p1) : null,
                        p2: p2 ? createPlayerCopy(p2) : null,
                    });
                    initialMatchPlayersSetRef.current = true;
                }
            }
        }
    }, [nextRoundTrigger, tournament.status, tournament.type, tournament.players, safeRounds]);
    
    const handleBackClickRaw = useCallback(() => {
        if (tournament.status === 'round_in_progress') {
            // 경기 진행 중 뒤로가기: 클라 시뮬/실대국 상태를 스냅샷으로 저장 후 로비로 이동
            void onAction({
                type: 'SAVE_TOURNAMENT_PROGRESS',
                payload: { type: tournament.type, tournamentSnapshot: displayTournament },
            });
            onAction({ type: 'LEAVE_TOURNAMENT_VIEW' });
            onBack();
        } else if (tournament.status === 'bracket_ready' || tournament.status === 'round_complete') {
            // 경기 시작 전(대기실만 본 상태) 뒤로가기: 세션 초기화 후 로비에서 최초 상태(단계 선택 + 입장) 유지
            onAction({ type: 'CLEAR_TOURNAMENT_SESSION', payload: { type: tournament.type } });
            onBack();
        } else {
            onBack();
        }
    }, [onBack, onAction, tournament.status, tournament.type, displayTournament]);

    const handleForfeitClickRaw = useCallback(() => {
        if (window.confirm(tt('forfeitConfirm'))) {
            onAction({ type: 'FORFEIT_TOURNAMENT', payload: { type: tournament.type } });
        }
    }, [onAction, tournament.type]);

    // 버튼 클릭 스로틀링 적용
    const { onClick: handleBackClick } = useButtonClickThrottle(handleBackClickRaw);
    const { onClick: handleForfeitClick } = useButtonClickThrottle(handleForfeitClickRaw);

    const performChampionshipArenaExitToLobby = useCallback(async () => {
        userInitiatedArenaExitRef.current = true;
        markChampionshipArenaExitSuppressRedirect();
        if (autoNextTimerRef.current) {
            clearInterval(autoNextTimerRef.current);
            autoNextTimerRef.current = null;
        }
        if (nextRoundStartTimeCheckRef.current) {
            clearTimeout(nextRoundStartTimeCheckRef.current);
            nextRoundStartTimeCheckRef.current = null;
        }
        pendingMatchStartRef.current = null;
        championshipMatchStartLockRef.current = false;
        setAutoNextCountdown(null);
        setChampionshipAwaitingKataLoad(false);

        const t = tournament.type;
        try {
            await Promise.resolve(
                onAction({
                    type: 'SAVE_TOURNAMENT_PROGRESS',
                    payload: { type: t, tournamentSnapshot: displayTournament },
                }),
            );
        } catch (e) {
            console.error('[TournamentBracket] SAVE_TOURNAMENT_PROGRESS failed:', e);
        }
        onAction({ type: 'LEAVE_TOURNAMENT_VIEW' });
        replaceAppHash('#/tournament');
    }, [tournament.type, onAction, displayTournament]);

    const handleChampionshipArenaExitClick = useCallback(() => {
        if (tournament.currentStageAttempt != null || tournament.status === 'round_in_progress') {
            void performChampionshipArenaExitToLobby();
            return;
        }
        handleBackClickRaw();
    }, [
        tournament.currentStageAttempt,
        tournament.status,
        performChampionshipArenaExitToLobby,
        handleBackClickRaw,
    ]);

    // 경기가 진행 중이거나, 경기가 막 끝났지만 아직 서버에서 상태가 업데이트되지 않은 경우
    // currentSimulatingMatch가 있으면 시뮬레이션 중으로 간주 (단, 토너 종료 후에는 stale 참조로 무한 시뮬 방지)
    const terminalTournamentStatus =
        displayTournament.status === 'complete' || displayTournament.status === 'eliminated';
    const isSimulating =
        !terminalTournamentStatus &&
        (displayTournament.status === 'round_in_progress' ||
            (displayTournament.currentSimulatingMatch !== null &&
                displayTournament.currentSimulatingMatch !== undefined));
    // 라이브 진행형 데이터(보드 상태/현재 수/계가 상태)는 시뮬레이션 훅이 갱신하는
    // displayTournament.rounds에서 직접 읽어야 한 수씩 두어지는 모습을 화면에 반영할 수 있다.
    const currentSimMatch = displayTournament.currentSimulatingMatch
        ? displayTournament.rounds?.[displayTournament.currentSimulatingMatch.roundIndex]?.matches[displayTournament.currentSimulatingMatch.matchIndex]
            ?? safeRounds[displayTournament.currentSimulatingMatch.roundIndex]?.matches[displayTournament.currentSimulatingMatch.matchIndex]
            ?? null
        : null;
        
    const lastFinishedUserMatch = useMemo(() => {
        return [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
    }, [safeRounds]);
    
    // 경기 종료 화면 유지 로직
    const matchForDisplay = useMemo(() => {
        if (isSimulating) {
            if (currentSimMatch) return currentSimMatch;
            return findActiveChampionshipUserMatch(displayTournament, currentUser?.id);
        }
        
        // round_complete 상태일 때는 마지막 완료된 경기 화면을 그대로 유지
        // (전국바둑대회, 월드챔피언십, 동네바둑리그 모두 동일하게 처리)
        if (tournament.status === 'round_complete') {
            // lastFinishedUserMatch가 있으면 우선적으로 사용
            if (lastFinishedUserMatch) {
                return lastFinishedUserMatch;
            }
            // lastFinishedUserMatch가 없으면 완료된 경기 중 첫 번째 찾기
            const finishedMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (finishedMatch) {
                return finishedMatch;
            }
        }
        
        // bracket_ready 상태: 카운트다운 중이거나 매 경기 사이 수동 대기 중이면 이전 경기 결과 화면 유지.
        // 카운트다운이 끝났고 이전 경기도 없는(첫 경기) 경우에만 새 경기 화면으로 전환한다.
        if (tournament.status === 'bracket_ready') {
            // 카운트다운 0 직후: 다음 회차 탭으로 전환된 상태 → 다음 회차 대국자 정보 + 빈 바둑판
            if (pendingRoundSwitchTo != null) {
                const nextRoundObj = safeRounds.find(r => r.name === `${pendingRoundSwitchTo}${TB_ROUND_SUFFIX}`);
                const nextMatch = nextRoundObj?.matches.find(m => m.isUserMatch && !m.isFinished);
                if (nextMatch) return nextMatch;
            }
            const countdownInProgress = tournament.nextRoundStartTime != null;
            // 카운트다운 중이거나, 카운트다운이 없어도 직전에 끝난 유저 경기가 있으면 그 결과 화면을 계속 보여준다.
            // 챔피언십 던전: 매 경기 종료 후 유저가 "다음 경기" 버튼을 눌러야 다음 경기로 넘어간다.
            if (lastFinishedUserMatch && (countdownInProgress || lastFinishedUserMatch.championshipRealGame?.status === 'finished')) {
                return lastFinishedUserMatch;
            }
            if (!countdownInProgress) {
                if (tournament.type === 'neighborhood') {
                    const currentRound = tournament.currentRoundRobinRound || 1;
                    const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
                    if (currentRoundObj) {
                        const nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                        if (nextMatch) return nextMatch;
                    }
                } else {
                    const nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
                    if (nextMatch) return nextMatch;
                }
            }
            if (lastFinishedUserMatch) return lastFinishedUserMatch;
            const finishedMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (finishedMatch) return finishedMatch;
        }
        
        // 그 외의 경우: 다음 경기, 마지막 완료된 경기, 또는 첫 경기 순서로 표시
        const nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
        if (nextMatch) {
            return nextMatch;
        }
        if (lastFinishedUserMatch) {
            return lastFinishedUserMatch;
        }
        const anyFinishedMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
        if (anyFinishedMatch) {
            return anyFinishedMatch;
        }
        const anyUserMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch);
        if (anyUserMatch) {
            return anyUserMatch;
        }
        return safeRounds[0]?.matches[0] || null;
    }, [isSimulating, currentSimMatch, displayTournament, currentUser?.id, tournament.status, tournament.nextRoundStartTime, tournament.type, safeRounds, lastFinishedUserMatch, pendingRoundSwitchTo]);

    useChampionshipReplayPlaceStoneSound(
        matchForDisplay?.championshipRealGame?.currentPly,
        matchForDisplay?.id ?? `${displayTournament.type}-championship-replay`,
        isSimulating && (matchForDisplay?.championshipRealGame?.moves?.length ?? 0) > 0,
    );

    useEffect(() => {
        if (!championshipAwaitingKataLoad) return;
        const rg = matchForDisplay?.championshipRealGame;
        if (rg?.moves?.length && tournament?.status === 'round_in_progress') {
            championshipMatchStartLockRef.current = false;
            setChampionshipAwaitingKataLoad(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            championshipMatchStartLockRef.current = false;
            setChampionshipAwaitingKataLoad(false);
        }, 45000);

        return () => window.clearTimeout(timeoutId);
    }, [championshipAwaitingKataLoad, matchForDisplay?.championshipRealGame, tournament?.status]);

    // 유저의 다음 경기 찾기 (경기 시작 전 상태 확인용)
    const upcomingUserMatch = useMemo(() => {
        return safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
    }, [safeRounds]);

    // 현재 유저의 컨디션 찾기 (표시용 displayTournament와 동일 소스 — 시뮬 병합 시 prev.players만 남는 순간에도 스냅샷과 맞춤)
    const userPlayer = useMemo(() => {
        const t = displayTournament;
        if (!t || !Array.isArray(t.players) || !currentUser?.id) {
            return undefined;
        }
        return t.players.find(p => p.id === currentUser.id);
    }, [displayTournament, currentUser?.id]);

    /** 토너먼트 플레이어 객체에 컨디션이 1000으로만 있을 때 던전 스냅샷으로 모달 표시 */
    const conditionForPotionModal = useMemo(() => {
        if (!userPlayer) return 1000;
        const snap =
            tournament?.type && currentUser.dungeonConditionSnapshot?.[tournament.type]?.condition;
        return resolveChampionshipDisplayCondition({
            playerCondition: userPlayer.condition,
            snapshotCondition: snap,
            isCurrentUser: true,
        });
    }, [userPlayer, tournament?.type, currentUser.dungeonConditionSnapshot]);

    const showConditionRecoveryButton = useMemo(
        () =>
            shouldShowChampionshipConditionRecoveryButton({
                condition: conditionForPotionModal,
                tournamentStatus: tournament?.status,
            }),
        [conditionForPotionModal, tournament?.status],
    );

    const championshipConditionFallback = useMemo(() => {
        if (!tournament?.type) return undefined;
        return currentUser.dungeonConditionSnapshot?.[tournament.type]?.condition;
    }, [tournament?.type, currentUser.dungeonConditionSnapshot]);

    const winner = useMemo(() => {
        if (!tournament || tournament.status !== 'complete') return null;
        if (!Array.isArray(tournament.players) || safeRounds.length === 0) return null;
        
        if (tournament.type === 'neighborhood') {
             const wins: Record<string, number> = {};
            tournament.players.forEach(p => wins[p.id] = 0);
            if (safeRounds[0]?.matches) {
                safeRounds[0].matches.forEach(m => { if(m.winner) wins[m.winner.id]++; });
            }
            return [...tournament.players].sort((a,b) => wins[b.id] - wins[a.id])[0];
        } else {
            const finalMatch = safeRounds.find(r => r.name === TB_RND_FINAL);
            return finalMatch?.matches[0]?.winner;
        }
    }, [tournament?.status, tournament?.type, tournament?.players, safeRounds]);
    
    const myResultText = useMemo(() => {
        if (!tournament || !currentUser?.id) return '';
        if (tournament.status === 'complete' || tournament.status === 'eliminated') {
            if (tournament.type === 'neighborhood') {
                if (!Array.isArray(tournament.players) || safeRounds.length === 0) return '';
                const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                const winsCount = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                const lossesCount = allMyMatches.length - winsCount;

                const playerWins: Record<string, number> = {};
                tournament.players.forEach(p => { playerWins[p.id] = 0; });
                if (safeRounds[0]?.matches) {
                    safeRounds[0].matches.forEach(m => {
                        if (m.winner) playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                    });
                }

                const sortedPlayers = [...tournament.players].sort((a, b) => playerWins[b.id] - playerWins[a.id]);
                let myRank = -1; let currentRankValue = 1;
                for (let i = 0; i < sortedPlayers.length; i++) {
                    if (i > 0 && playerWins[sortedPlayers[i].id] < playerWins[sortedPlayers[i-1].id]) currentRankValue = i + 1;
                    if (sortedPlayers[i].id === currentUser.id) { myRank = currentRankValue; break; }
                }
                return tt('statusRecordRank', { wins: winsCount, losses: lossesCount, rank: myRank });
            }

            if (winner?.id === currentUser.id) return tt('championTitle');

            const lastUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastUserMatch) {
                const roundOfLastMatch = safeRounds.find(r => r.matches.some(m => m.id === lastUserMatch.id));
                if (roundOfLastMatch?.name === TB_RND_FINAL) return tt('runnerUp');

                if (roundOfLastMatch?.name === TB_RND_SF) {
                    const thirdPlaceMatch = safeRounds.flatMap(r => r.matches).find(m => {
                        const round = safeRounds.find(r => r.matches.some(match => match.id === m.id));
                        return m.isUserMatch && round?.name === TB_RND_THIRD;
                    });
                    if (thirdPlaceMatch) {
                        const won3rdPlace = thirdPlaceMatch.winner?.id === currentUser.id;
                        return won3rdPlace ? tt('thirdPlace') : tt('fourthPlace');
                    }
                }
                return tt('eliminatedInRound', { round: roundOfLastMatch?.name || '' });
            }
            return tt('tournamentEliminated');
        }

        if (tournament.status === 'round_complete' || tournament.status === 'bracket_ready') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch) {
                const userWonLastMatch = lastFinishedUserMatch.winner?.id === currentUser.id;
                if (tournament.type === 'neighborhood') {
                    const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                    const wins = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                    const losses = allMyMatches.length - wins;
                    return tt('matchRoundResult', { round: allMyMatches.length, outcome: userWonLastMatch ? tt('victory') : tt('defeat'), wins, losses });
                } else if (userWonLastMatch) {
                    const nextUnplayedRound = safeRounds.find(r => r.matches.some(m => !m.isFinished && m.players.some(p => p?.id === currentUser.id)));
                    if (nextUnplayedRound) return tt('roundAdvanceExclaim', { round: nextUnplayedRound.name });
                }
            }
        }
        
        const currentRound = safeRounds.find(r => r.matches.some(m => m.isUserMatch && !m.isFinished));
        return currentRound ? tt('roundInProgress', { round: currentRound.name }) : tt('tournamentPreparing');
    }, [currentUser.id, tournament, winner, safeRounds]);
    
    const p1_from_match = matchForDisplay?.players?.[0] || null;
    const p2_from_match = matchForDisplay?.players?.[1] || null;

    const p1 = p1_from_match && Array.isArray(displayTournament?.players) 
        ? displayTournament.players.find(p => p.id === p1_from_match.id) || p1_from_match 
        : null;
    const p2 = p2_from_match && Array.isArray(displayTournament?.players) 
        ? displayTournament.players.find(p => p.id === p2_from_match.id) || p2_from_match 
        : null;

    // 경기 시작 전에는 홈 화면과 동일한 능력치 계산 (calculateTotalStats 사용)
    // 경기 중에는 player.stats를 사용 (컨디션으로 인한 변화 반영)
    const p1Stats = useMemo(() => {
        if (!displayTournament) return {};
        if (displayTournament.status === 'round_in_progress') {
            return p1?.stats || {};
        }
        if (p1?.originalStats) {
            return p1.originalStats;
        }
            const p1User = allUsersForRanking.find(u => u.id === p1?.id);
            if (p1User) {
                return calculateTotalStats(p1User, 'championshipVenue');
            }
            return p1?.stats || {};
    }, [p1?.stats, p1?.originalStats, p1?.id, displayTournament?.status, allUsersForRanking]);

    const p2Stats = useMemo(() => {
        if (!displayTournament) return {};
        if (displayTournament.status === 'round_in_progress') {
            return p2?.stats || {};
        }
        if (p2?.originalStats) {
            return p2.originalStats;
        }
            const p2User = allUsersForRanking.find(u => u.id === p2?.id);
            if (p2User) {
                return calculateTotalStats(p2User, 'championshipVenue');
            }
            return p2?.stats || {};
    }, [p2?.stats, p2?.originalStats, p2?.id, displayTournament?.status, allUsersForRanking]);

    const radarDatasets = useMemo(() => [
        { stats: p1Stats, color: '#60a5fa', fill: 'rgba(59, 130, 246, 0.4)' },
        { stats: p2Stats, color: '#f87171', fill: 'rgba(239, 68, 68, 0.4)' },
    ], [p1Stats, p2Stats]);

    const maxStatValue = useMemo(() => {
        if (!p1Stats || !p2Stats || Object.keys(p1Stats).length === 0 || Object.keys(p2Stats).length === 0) {
            return 200; // A reasonable default
        }
        const allStats: number[] = [
            ...(Object.values(p1Stats) as number[]),
            ...(Object.values(p2Stats) as number[])
        ];
        const maxStat = Math.max(...allStats, 0);
        return Math.ceil((maxStat + 50) / 50) * 50; // Round up to nearest 50
    }, [p1Stats, p2Stats]);

    const currentPhase = useMemo((): 'early' | 'mid' | 'end' | 'none' => {
        if (!displayTournament || displayTournament.status !== 'round_in_progress') return 'none';
        const realGame = matchForDisplay?.championshipRealGame;
        if (realGame) {
            const ply = realGame.currentPly || displayTournament.timeElapsed || 1;
            const maxPly = Math.max(1, realGame.maxPly || 1);
            const third = Math.max(1, Math.floor(maxPly / 3));
            const openingEnd = third;
            const midEnd = 2 * third;
            if (ply <= openingEnd) return 'early';
            if (ply <= midEnd) return 'mid';
            return 'end';
        }
        const time = displayTournament.timeElapsed || 0;
        if (time <= 15) return 'early';
        if (time <= 35) return 'mid';
        if (time <= 50) return 'end';
        return 'none';
    }, [displayTournament?.timeElapsed, displayTournament?.status, matchForDisplay?.championshipRealGame]);

    // 서버에서 매초 누적된 능력치 점수를 가져옴
    // 초반(1-15초): 초반전 능력치 합계 누적
    // 중반(16-35초): 중반전 능력치 합계 누적
    // 종반(36-50초): 종반전 능력치 합계 누적
    const p1Cumulative = displayTournament?.currentMatchScores?.player1 || 0;
    const p2Cumulative = displayTournament?.currentMatchScores?.player2 || 0;
    const totalCumulative = p1Cumulative + p2Cumulative;
    
    // 누적 점수를 비율로 변환하여 그래프에 표시
    const p1Percent = totalCumulative > 0 ? (p1Cumulative / totalCumulative) * 100 : 50;
    const p2Percent = totalCumulative > 0 ? (p2Cumulative / totalCumulative) * 100 : 50;

    const renderChampionshipSkipButton = (fb: string) => {
        if (!championshipDungeonSkipUi.visible || !tournament) return null;
        const vipOk = functionVipActive;
        const canClick = vipOk && championshipDungeonSkipUi.canAttempt;
        return (
            <div className="flex flex-col items-center gap-0.5">
                <Button
                    type="button"
                    onClick={() => {
                        if (!canClick) return;
                        onAction({ type: 'SKIP_CHAMPIONSHIP_MATCH', payload: { type: tournament.type } });
                    }}
                    disabled={!canClick}
                    colorScheme="none"
                    className={`${vipOk && canClick ? championshipFooterSecondaryButton : championshipFooterMutedButton} ${fb} ${!vipOk ? 'opacity-80' : ''}`}
                    title={
                        !vipOk
                            ? tt('vipSkipRequiresFunctionVip')
                            : !championshipDungeonSkipUi.canAttempt
                              ? tt('preparingOpponentInfo')
                              : tt('skipAllRoundsHint')
                    }
                >
                    전체 스킵
                </Button>
                {!vipOk ? (
                    <span className="max-w-[10rem] text-center text-[10px] font-semibold leading-tight text-amber-400">
                        기능 VIP 활성화
                    </span>
                ) : !championshipDungeonSkipUi.canAttempt ? (
                    <span className="max-w-[10rem] text-center text-[10px] font-medium leading-tight text-slate-400">
                        상대 정보 준비 중
                    </span>
                ) : null}
            </div>
        );
    };

    const isDungeonChampionshipVenue = tournament.currentStageAttempt != null;

    const showChampionshipMatchResultPanel = useMemo(() => {
        if (!isDungeonChampionshipVenue) return false;
        const rg = matchForDisplay?.championshipRealGame;
        if (!matchForDisplay?.isUserMatch || !rg?.winnerId) return false;
        const moveCount = rg.moves?.length ?? 0;
        if (moveCount === 0) return false;
        const ply = rg.currentPly ?? 0;
        if (ply < moveCount) return false;
        return rg.status === 'scoring' || (rg.status === 'finished' && !!matchForDisplay.isFinished);
    }, [
        isDungeonChampionshipVenue,
        matchForDisplay?.isUserMatch,
        matchForDisplay?.isFinished,
        matchForDisplay?.championshipRealGame?.winnerId,
        matchForDisplay?.championshipRealGame?.moves,
        matchForDisplay?.championshipRealGame?.currentPly,
        matchForDisplay?.championshipRealGame?.status,
    ]);

    const renderFooterButton = () => {
        if (!tournament) return null;
        if (showChampionshipMatchResultPanel) return null;

        const { status } = tournament;

        if (status === 'round_in_progress') {
            return null;
        }
        
        if (status === 'complete') {
            return null; // 이미 헤더에 뒤로가기 버튼이 있으므로 버튼 제거
        }

        if (status === 'eliminated') {
            return null; // 이미 헤더에 뒤로가기 버튼이 있으므로 버튼 제거
        }

        // "다음 경기" 버튼 제거 - 자동 진행으로 대체됨

        const hasUnfinishedUserMatch = safeRounds.some(r =>
            Array.isArray(r?.matches) && r.matches.some(m => m.isUserMatch && !m.isFinished)
        );

        // 서버 카운트다운·클라 카운트다운·회차 전환 직전에만 수동 시작 버튼을 숨긴다.
        // (autoAdvanceEnabled는 경기 시작 직후 항상 true가 되지만, 챔피언십 던전은
        //  매 경기 사이 수동 대기로 바뀌었으므로 이 플래그만으로는 수동 버튼을 가리지 않는다.)
        const isAutoStartFlow =
            tournament.nextRoundStartTime != null ||
            autoNextCountdown !== null ||
            pendingRoundSwitchTo != null;

        // 챔피언십 던전: 매 경기 종료 후에는 "다음 경기" 버튼을 통해 유저가 직접 다음 경기를 시작한다.
        // 그 외(비-던전 일반 토너먼트)에는 첫 경기 전에만 수동 시작 버튼이 보이고 이후는 자동 진행한다.
        const isDungeonChampionship = !!tournament.currentStageAttempt;
        const isFirstRoundBeforeStart = tournament.type !== 'neighborhood' || (tournament.currentRoundRobinRound === 1);
        const hasJustFinishedUserMatch = !!lastFinishedUserMatch;
        const showStartButton = isDungeonChampionship
            ? true // 던전 모드: 첫 경기·다음 경기 모두 수동 시작
            : isFirstRoundBeforeStart;
        if (
            (status === 'round_complete' || status === 'bracket_ready') &&
            hasUnfinishedUserMatch &&
            showStartButton &&
            !isAutoStartFlow
        ) {
            if (isDungeonChampionship) {
                return null;
            }

            // 다음 경기의 선수 정보가 준비되었는지 확인
            let nextMatch: Match | undefined = undefined;
            if (tournament.type === 'neighborhood') {
                const currentRound = tournament.currentRoundRobinRound || 1;
                const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
                if (currentRoundObj) {
                    nextMatch = currentRoundObj.matches.find(m => m.isUserMatch && !m.isFinished);
                }
            } else {
                nextMatch = safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch && !m.isFinished);
            }
            
            // 선수 정보 준비 여부 확인
            const p1 = nextMatch && Array.isArray(tournament.players) 
                ? tournament.players.find(p => p.id === nextMatch.players[0]?.id) 
                : null;
            const p2 = nextMatch && Array.isArray(tournament.players) 
                ? tournament.players.find(p => p.id === nextMatch.players[1]?.id) 
                : null;
            const playersReady = p1 && p2 && p1.stats && p2.stats && 
                                 Object.keys(p1.stats).length > 0 && Object.keys(p2.stats).length > 0;
            
            if (!playersReady) {
                return (
                    <>
                        <Button disabled colorScheme="none" className={championshipFooterMutedButton}>
                            다음 상대를 기다리는 중...
                        </Button>
                    </>
                );
            }

            const buttonLabel = hasJustFinishedUserMatch ? tt('nextMatch') : tt('startMatch');
            const isMatchStartBusy = isDungeonChampionship && championshipAwaitingKataLoad;

            if (isMatchStartBusy) {
                return (
                    <Button disabled colorScheme="none" className={championshipFooterMutedButton}>
                        {tt('matchPreparing')}
                    </Button>
                );
            }

            return (
                <>
                    <Button
                        onClick={() => {
                            setChampionshipSidebarTab('commentary');
                            const type = tournament?.type ?? 'neighborhood';
                            if (
                                isDungeonChampionship &&
                                conditionForPotionModal >= 1 &&
                                conditionForPotionModal <= 40
                            ) {
                                setShowChampionshipLowConditionStartModal(true);
                                return;
                            }
                            if (isDungeonChampionship) {
                                finalizeChampionshipDungeonMatchStart();
                                return;
                            }
                            onAction({ type: 'START_TOURNAMENT_MATCH', payload: { type } });
                        }}
                        colorScheme="none"
                        className={`animate-pulse ${championshipFooterPrimaryButton}`}
                    >
                        {buttonLabel}
                    </Button>
                </>
            );
        }
        
        // 시뮬레이션이 끝나고 경기가 초기화되기 전에 다시 입장한 경우, 버튼을 표시하지 않음 (나가기 전 화면과 동일)
        // This is the default case, meaning user's matches are done but tournament isn't 'complete' or 'eliminated'
        return null;
    };

    const footerButtons = renderFooterButton();

    const renderChampionshipClaimRewardAction = (fb: string, onAfterClick?: () => void): React.ReactNode => {
        if (!isDungeonChampionshipVenue) return null;

        const ts = displayTournament;
        const isUserEliminated = ts.status === 'eliminated';
        const allMatchesDone = ts.rounds.every((r) => r.matches.every((m) => m.isFinished));
        const isFullyComplete = ts.status === 'complete' || (allMatchesDone && ts.status !== 'round_in_progress');
        const stageAttempt = resolveDungeonStageAttempt(ts, currentUser, ts.type);
        const rewardClaimedKey = `${ts.type}RewardClaimed` as keyof User;
        const isRewardClaimed = !!currentUser[rewardClaimedKey];
        const canClaimRewardOnResult =
            (isFullyComplete || isUserEliminated) &&
            !isRewardClaimed &&
            !dungeonStageRewardRequested &&
            stageAttempt >= 1;

        if (canClaimRewardOnResult) {
            return (
                <div className="flex flex-col items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => {
                            handleCompleteDungeon();
                            onAfterClick?.();
                        }}
                        disabled={mobileRewardClaimBusy}
                        className={`${championshipFooterPrimaryButton} ${fb}`}
                    >
                        {mobileRewardClaimBusy ? tt('claiming') : tt('claimReward')}
                    </button>
                </div>
            );
        }

        const treatAsClaimedOnResult = isRewardClaimed || dungeonStageRewardRequested;
        if ((isFullyComplete || isUserEliminated) && treatAsClaimedOnResult && stageAttempt >= 1) {
            if (!isRewardClaimed) {
                return (
                    <div className="flex flex-col items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                handleCompleteDungeon();
                                onAfterClick?.();
                            }}
                            disabled={mobileRewardClaimBusy}
                            className={`${championshipFooterPrimaryButton} ${fb}`}
                        >
                            {mobileRewardClaimBusy ? tt('processing') : tt('rewardComplete')}
                        </button>
                    </div>
                );
            }
            return (
                <div className="flex flex-col items-center gap-0.5">
                    <div className={`flex items-center justify-center ${championshipFooterMutedButton} ${fb}`}>
                        보상완료
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderChampionshipStartOrNextMatchAction = (
        fb: string,
        options?: {
            intent?: 'start' | 'next' | 'any';
            allowDuringResultPanel?: boolean;
            onAfterClick?: () => void;
        },
    ): React.ReactNode => {
        if (!isDungeonChampionshipVenue || !tournament) return null;
        const intent = options?.intent ?? 'any';
        if (!options?.allowDuringResultPanel && showChampionshipMatchResultPanel) return null;

        const { status } = tournament;
        if (status === 'round_in_progress' || status === 'complete' || status === 'eliminated') {
            return null;
        }

        const hasUnfinishedUserMatch = safeRounds.some(
            (r) => Array.isArray(r?.matches) && r.matches.some((m) => m.isUserMatch && !m.isFinished),
        );
        const isAutoStartFlow =
            tournament.nextRoundStartTime != null || autoNextCountdown !== null || pendingRoundSwitchTo != null;

        if (
            !((status === 'round_complete' || status === 'bracket_ready') &&
            hasUnfinishedUserMatch &&
            !isAutoStartFlow)
        ) {
            return null;
        }

        let nextMatch: Match | undefined;
        if (tournament.type === 'neighborhood') {
            const currentRound = tournament.currentRoundRobinRound || 1;
            const currentRoundObj = safeRounds.find((r) => r.name === `${currentRound}${TB_ROUND_SUFFIX}`);
            if (currentRoundObj) {
                nextMatch = currentRoundObj.matches.find((m) => m.isUserMatch && !m.isFinished);
            }
        } else {
            nextMatch = safeRounds.flatMap((r) => r.matches).find((m) => m.isUserMatch && !m.isFinished);
        }

        const p1 =
            nextMatch && Array.isArray(tournament.players)
                ? tournament.players.find((p) => p.id === nextMatch!.players[0]?.id)
                : null;
        const p2 =
            nextMatch && Array.isArray(tournament.players)
                ? tournament.players.find((p) => p.id === nextMatch!.players[1]?.id)
                : null;
        const playersReady = Boolean(
            p1 &&
                p2 &&
                p1.stats &&
                p2.stats &&
                Object.keys(p1.stats).length > 0 &&
                Object.keys(p2.stats).length > 0,
        );

        if (!playersReady) {
            return (
                <button type="button" disabled className={`${championshipFooterMutedButton} ${fb}`}>
                    다음 상대를 기다리는 중...
                </button>
            );
        }

        const hasJustFinishedUserMatch = !!lastFinishedUserMatch;
        if (intent === 'start' && hasJustFinishedUserMatch) return null;
        if (intent === 'next' && !hasJustFinishedUserMatch) return null;

        const buttonLabel = hasJustFinishedUserMatch ? tt('nextMatch') : tt('startMatch');

        if (championshipAwaitingKataLoad) {
            return (
                <button type="button" disabled className={`${championshipFooterMutedButton} ${fb}`}>
                    {tt('matchPreparing')}
                </button>
            );
        }

        return (
            <button
                type="button"
                onClick={() => {
                    setChampionshipSidebarTab('commentary');
                    if (conditionForPotionModal >= 1 && conditionForPotionModal <= 40) {
                        setShowChampionshipLowConditionStartModal(true);
                        return;
                    }
                    finalizeChampionshipDungeonMatchStart();
                    options?.onAfterClick?.();
                }}
                className={`animate-pulse ${championshipFooterPrimaryButton} ${fb}`}
            >
                {buttonLabel}
            </button>
        );
    };

    const renderChampionshipNextMatchFooterSlot = (fb: string) => {
        const action = renderChampionshipStartOrNextMatchAction(
            fb,
            !isMobile ? { intent: 'start' } : undefined,
        );
        if (!action) return null;
        return <div className="flex flex-col items-center gap-0.5">{action}</div>;
    };
    
    const isChampionshipMatchInProgress = tournament?.status === 'round_in_progress';

    // 자동 다음 경기 카운트다운 표시 (경기 진행 중은 경기 결과 패널에서 표시)
    const countdownDisplay = championshipAwaitingKataLoad ? (
        <div
            className={`flex items-center justify-center font-bold text-cyan-300 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>{tt('matchPreparing')}</span>
        </div>
    ) : autoNextCountdown !== null ? (
        <div
            className={`flex items-center justify-center font-bold text-yellow-400 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>
                {tt('nextMatchPreparing', { countdown: autoNextCountdown })}
            </span>
        </div>
    ) : null;

    const desktopNextMatchSlot = !isMobile ? renderChampionshipNextMatchFooterSlot('!text-sm !py-2 !px-4') : null;
    const mobileNextMatchSlot = isMobile ? renderChampionshipNextMatchFooterSlot('!text-xs !py-1.5 !px-3') : null;
    const hasChampionshipStartOrNextMatchSlot = !!(desktopNextMatchSlot || mobileNextMatchSlot);

    const renderChampionshipSkipOrClaimSlot = (fb: string) => {
        const skipButton = renderChampionshipSkipButton(fb);
        if (skipButton) return skipButton;
        return renderChampionshipClaimRewardAction(fb);
    };

    const desktopSkipSlot = !isMobile ? renderChampionshipSkipOrClaimSlot('!text-sm !py-2 !px-4') : null;

    const championshipAllMatchesFinished = displayTournament.rounds.every((r) => r.matches.every((m) => m.isFinished));
    const championshipFinished =
        displayTournament.status === 'complete' ||
        displayTournament.status === 'eliminated' ||
        (championshipAllMatchesFinished && displayTournament.status !== 'round_in_progress');

    const championshipDungeonBoardCenterMode = useMemo((): 'deep_breath' | 'players_entering' | null => {
        if (!isDungeonChampionshipVenue || championshipFinished) return null;
        const noRealGame = !matchForDisplay?.championshipRealGame;
        if (!noRealGame) return null;
        if (championshipAwaitingKataLoad) return 'players_entering';
        if (tournament.status === 'bracket_ready' || tournament.status === 'round_complete') return 'deep_breath';
        return null;
    }, [
        isDungeonChampionshipVenue,
        championshipFinished,
        matchForDisplay?.championshipRealGame,
        tournament.status,
        championshipAwaitingKataLoad,
    ]);

    const championshipFinalStandingsRows = useMemo(() => {
        if (!championshipFinished) return null;
        return buildChampionshipDungeonStandings(displayTournament);
    }, [championshipFinished, displayTournament]);

    const championshipResultPanelActionSlot =
        !isMobile || isDungeonChampionshipVenue
            ? null
            : (() => {
                  const fb = '!text-xs !py-1.5 !px-3 w-full';
                  const claimAction = renderChampionshipClaimRewardAction(fb);
                  if (claimAction) return claimAction;
                  if (showChampionshipMatchResultPanel) {
                      const nextAction = renderChampionshipStartOrNextMatchAction(fb, {
                          intent: isMobile ? 'any' : 'next',
                          allowDuringResultPanel: true,
                      });
                      if (nextAction) return nextAction;
                  } else if (isMobile) {
                      const startOrNextAction = renderChampionshipStartOrNextMatchAction(fb);
                      if (startOrNextAction) return startOrNextAction;
                  }
                  if (championshipAwaitingKataLoad) {
                      return (
                          <div
                              className={`flex w-full items-center justify-center font-bold text-cyan-300 ${isMobile ? 'text-center text-xs leading-tight' : 'text-sm'}`}
                          >
                              {tt('matchPreparing')}
                          </div>
                      );
                  }
                  if (autoNextCountdown !== null) {
                      return (
                          <div
                              className={`flex w-full items-center justify-center font-bold text-yellow-400 ${isMobile ? 'text-center text-xs leading-tight' : 'text-sm'}`}
                          >
                              {tt('nextMatchPreparing', { countdown: autoNextCountdown })}
                          </div>
                      );
                  }
                  return null;
              })();

    const mobileBoardCenterMatchAction =
        isMobile && isDungeonChampionshipVenue
            ? renderChampionshipStartOrNextMatchAction(
                  '!text-sm !py-3 !px-8 min-w-[9.5rem] shadow-lg',
                  { intent: 'any', allowDuringResultPanel: true },
              )
            : null;

    const mobileDungeonFooterStatusMessage = useMemo(() => {
        if (!isMobile || !isDungeonChampionshipVenue) return null;
        if (championshipAwaitingKataLoad && !lastFinishedUserMatch) return null;
        if (championshipAwaitingKataLoad) {
            return (
                <p className="mb-1.5 text-center text-[10px] font-bold leading-snug text-cyan-300">{tt('matchPreparing')}</p>
            );
        }
        if (autoNextCountdown !== null) {
            return (
                <p className="mb-1.5 text-center text-[10px] font-bold leading-snug text-yellow-400">
                    {tt('nextMatchPreparing', { countdown: autoNextCountdown })}
                </p>
            );
        }
        return null;
    }, [
        isMobile,
        isDungeonChampionshipVenue,
        championshipAwaitingKataLoad,
        autoNextCountdown,
        lastFinishedUserMatch,
    ]);

    const dismissMobileChampionshipResultModal = useCallback(() => {
        if (matchForDisplay?.id) {
            mobileChampionshipResultDismissedMatchIdRef.current = matchForDisplay.id;
        }
        setShowMobileChampionshipResultModal(false);
    }, [matchForDisplay?.id]);

    useEffect(() => {
        if (!isMobile || !isDungeonChampionshipVenue) return;
        if (!showChampionshipMatchResultPanel || !matchForDisplay?.id) {
            if (!showChampionshipMatchResultPanel) {
                setShowMobileChampionshipResultModal(false);
            }
            return;
        }
        if (mobileChampionshipResultDismissedMatchIdRef.current === matchForDisplay.id) return;
        setShowMobileChampionshipResultModal(true);
    }, [isMobile, isDungeonChampionshipVenue, showChampionshipMatchResultPanel, matchForDisplay?.id]);

    const championshipMatchResultPanelSection =
        showChampionshipMatchResultPanel ? (
            <ChampionshipMatchResultPanel
                match={matchForDisplay}
                currentUser={currentUser}
                tournamentFinished={championshipFinished}
                tournamentForResult={displayTournament}
                finalStandings={championshipFinalStandingsRows}
                compact={isMobile}
                resultActionSlot={isMobile && !isDungeonChampionshipVenue ? championshipResultPanelActionSlot : null}
            />
        ) : (
            <div
                className={`flex min-h-[5rem] flex-col rounded-2xl ${
                    isChampionshipMatchInProgress
                        ? 'border border-blue-400/35 bg-gradient-to-b from-[#2a3d56] via-[#141c2b] to-[#070a10] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'border border-dashed border-slate-600/35 bg-slate-950/50'
                } ${isMobile ? 'px-2 py-2' : 'px-3 py-3'}`}
                aria-hidden={showChampionshipMatchResultPanel}
            >
                <div className="flex min-h-[3.5rem] flex-1 items-center justify-center">
                    {isChampionshipMatchInProgress ? (
                        <span
                            className={`text-center font-bold text-blue-400 ${isMobile ? 'text-xs leading-tight' : 'text-sm sm:text-base'}`}
                        >
                            {tt('matchInProgress')}
                        </span>
                    ) : (
                        <span className={`text-center text-slate-500 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                            경기 종료 후 결과가 표시됩니다
                        </span>
                    )}
                </div>
                {isMobile && !isDungeonChampionshipVenue && championshipResultPanelActionSlot ? (
                    <div className="mt-1.5 w-full shrink-0 border-t border-slate-600/40 pt-1.5">
                        {championshipResultPanelActionSlot}
                    </div>
                ) : null}
            </div>
        );

    const championshipFooterPrimaryActions = showChampionshipMatchResultPanel ? null : footerButtons ?? countdownDisplay;

    const championshipCommentaryEmptyHint = useMemo(() => {
        if (!isDungeonChampionshipVenue) return null;
        if (championshipAwaitingKataLoad) {
            return tt('playersEntering');
        }
        if (
            (tournament.status === 'bracket_ready' || tournament.status === 'round_complete') &&
            !matchForDisplay?.championshipRealGame
        ) {
            return tt('breathing');
        }
        return null;
    }, [
        isDungeonChampionshipVenue,
        championshipAwaitingKataLoad,
        tournament.status,
        matchForDisplay?.championshipRealGame,
    ]);

    const championshipDungeonExitVisible = tournament.currentStageAttempt != null;

    const desktopExitSlot =
        !isMobile && championshipDungeonExitVisible ? (
            <Button
                type="button"
                onClick={handleChampionshipArenaExitClick}
                colorScheme="none"
                className={`${championshipFooterExitButton} !text-sm !py-2 !px-4`}
                                title={
                    tournament.status === 'round_in_progress'
                        ? tt('canResumeFromLobby')
                        : tt('leaveArena')
                }
            >
                {tt('exit')}
            </Button>
        ) : null;

    const mobileChampionshipSkipSlot = isMobile ? renderChampionshipSkipOrClaimSlot('!text-xs !py-1.5 !px-3') : null;
    const mobileChampionshipSkipOnlySlot = isMobile ? renderChampionshipSkipButton('!text-xs !py-1.5 !px-3') : null;
    const mobileChampionshipExitSlot =
        isMobile && championshipDungeonExitVisible ? (
            <Button
                type="button"
                onClick={handleChampionshipArenaExitClick}
                colorScheme="none"
                className={`${championshipFooterExitButton} !text-xs !py-1.5 !px-3`}
                                title={
                    tournament.status === 'round_in_progress'
                        ? tt('canResumeFromLobby')
                        : tt('leaveArena')
                }
            >
                {tt('exit')}
            </Button>
        ) : null;

    // 배속 조절 — 던전 1~5단계는 x0.5·x1·x2, 6단계 이상·비던전은 x3까지.
    const championshipPlaybackSpeedSelector = (
        <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className={`font-semibold tracking-wider text-cyan-100 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                배속
            </span>
            {championshipDungeonPlaybackSpeedChoices.map((speed) => {
                const isActive = effectiveChampionshipPlaybackSpeed === speed;
                const titleBySpeed: Record<string, string> = {
                    '0.5': tt('playbackSpeed.0.5'),
                    '1': tt('playbackSpeed.1'),
                    '2': tt('playbackSpeed.2'),
                    '3': tt('playbackSpeed.3'),
                };
                return (
                    <button
                        key={speed}
                        type="button"
                        onClick={() => setChampionshipPlaybackSpeed(speed)}
                        title={titleBySpeed[String(speed)]}
                        className={`rounded-lg border font-black tracking-wider transition ${
                            isMobile ? 'min-w-[2.6rem] px-2 py-1 text-[11px]' : 'min-w-[3.25rem] px-3 py-1.5 text-sm'
                        } ${
                            isActive
                                ? 'border-cyan-300/80 bg-cyan-500/25 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                                : 'border-slate-500/40 bg-slate-900/60 text-slate-300 hover:border-cyan-300/55 hover:text-cyan-100'
                        }`}
                    >
                        x{speed}
                    </button>
                );
            })}
        </div>
    );

    const renderChampionshipFooterButtonPanel = () => (
        <section
            className={`flex min-h-0 flex-col justify-center rounded-2xl border border-cyan-400/35 bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_16px_36px_-24px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-cyan-400/20 ${
                isMobile
                    ? 'bg-gradient-to-br from-[#2a3d56] via-[#141c2b] to-[#070a10] p-2'
                    : 'bg-gradient-to-br from-[#2a3d56] via-[#141c2b] to-[#070a10] p-2.5'
            }`}
        >
            <div
                className={`flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-xl border border-slate-600/50 bg-[#0c1018] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${
                    isMobile ? 'px-2 py-2' : 'min-h-[3.7rem] px-2.5 py-2.5'
                }`}
            >
                {championshipFinished ? (
                    <>
                        <div className={`text-center font-bold text-emerald-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            모든 경기가 종료되었습니다.
                        </div>
                        <div className="flex w-full flex-wrap items-stretch justify-center gap-2">
                            {isMobile ? mobileNextMatchSlot : desktopNextMatchSlot}
                            {isMobile ? mobileChampionshipSkipSlot : desktopSkipSlot}
                            {isMobile ? mobileChampionshipExitSlot : desktopExitSlot}
                        </div>
                    </>
                ) : (
                    <>
                        {championshipPlaybackSpeedSelector}
                        {championshipFooterPrimaryActions ? (
                            <div className="flex w-full flex-col gap-2">{championshipFooterPrimaryActions}</div>
                        ) : !showChampionshipMatchResultPanel && !isChampionshipMatchInProgress && !hasChampionshipStartOrNextMatchSlot ? (
                            <div
                                className={`rounded-xl border border-slate-500/38 bg-gradient-to-b from-slate-800/85 to-slate-950/92 text-center font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                                    isMobile ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'
                                }`}
                            >
                                다음 자동 대국을 준비 중입니다.
                            </div>
                        ) : null}
                        <div className="flex w-full flex-wrap items-stretch justify-center gap-2">
                            {isMobile ? mobileNextMatchSlot : desktopNextMatchSlot}
                            {isMobile ? mobileChampionshipSkipSlot : desktopSkipSlot}
                            {isMobile ? mobileChampionshipExitSlot : desktopExitSlot}
                        </div>
                    </>
                )}
            </div>
        </section>
    );

    /** 모바일 던전: 컴팩트 하단 툴바 (보상·결과는 모달, 경기 시작은 바둑판 중앙) */
    const renderMobileChampionshipDungeonFooterButtonPanel = () => {
        const mobileBtn = '!text-[10px] !py-2 !px-1 min-h-[2.25rem] w-full whitespace-nowrap';
        const skipVisible = Boolean(championshipDungeonSkipUi.visible && tournament);
        const vipOk = functionVipActive;
        const skipCanClick = vipOk && championshipDungeonSkipUi.canAttempt;

        return (
            <section className="w-full shrink-0 rounded-xl border border-cyan-400/30 bg-[#0c1018]/95 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                {championshipFinished ? (
                    <p className="mb-1.5 text-center text-[10px] font-bold leading-snug text-emerald-200">
                        모든 경기가 종료되었습니다.
                    </p>
                ) : null}
                {mobileDungeonFooterStatusMessage}
                {championshipPlaybackSpeedSelector}
                <div className="grid grid-cols-3 gap-1.5">
                    <button
                        type="button"
                        onClick={() => setShowMobileChampionshipRewardModal(true)}
                        className={`${championshipFooterSecondaryButton} ${mobileBtn}`}
                    >
                        보상정보
                    </button>
                    <Button
                        type="button"
                        bare
                        onClick={() => {
                            if (!skipCanClick || !tournament) return;
                            onAction({ type: 'SKIP_CHAMPIONSHIP_MATCH', payload: { type: tournament.type } });
                        }}
                        disabled={!skipVisible || !skipCanClick}
                        colorScheme="none"
                        className={`${skipVisible && skipCanClick ? championshipFooterSecondaryButton : championshipFooterMutedButton} ${mobileBtn} ${!vipOk && skipVisible ? 'opacity-80' : ''}`}
                        title={
                            !skipVisible
                                ? undefined
                                : !vipOk
                                  ? tt('vipSkipRequiresFunctionVip')
                                  : !championshipDungeonSkipUi.canAttempt
                                    ? tt('preparingOpponentInfo')
                                    : tt('skipAllRoundsHint')
                        }
                    >
                        {tt('skipAll')}
                    </Button>
                    <Button
                        type="button"
                        bare
                        onClick={handleChampionshipArenaExitClick}
                        colorScheme="none"
                        className={`${championshipFooterExitButton} ${mobileBtn}`}
                        title={
                            tournament.status === 'round_in_progress'
                                ? tt('canResumeFromLobby')
                                : tt('leaveArena')
                        }
                    >
                        {tt('exit')}
                    </Button>
                </div>
            </section>
        );
    };

    /** 모바일: 모든 탭 공통 하단 — 경기 시작·진행·카운트다운·보상 수령 */
    const championshipMobileStickyBar = isMobile
        ? (() => {
              const ts = displayTournament;
              const allMatchesFinished = ts.rounds.every((r) => r.matches.every((m) => m.isFinished));
              const isTournamentFullyComplete =
                  ts.status === 'complete' || (allMatchesFinished && ts.status !== 'round_in_progress');
              const isUserEliminated = ts.status === 'eliminated';
              const isInProgress = ts.status === 'round_in_progress' || ts.status === 'bracket_ready';
              const isRoundComplete = ts.status === 'round_complete';
              const effectiveStageAttempt = resolveDungeonStageAttempt(ts, currentUser, ts.type);
              const isDungeonModeFooter = effectiveStageAttempt >= 1;
              const rewardClaimedKey = `${ts.type}RewardClaimed` as keyof User;
              const isRewardClaimed = !!currentUser[rewardClaimedKey];
              const treatAsClaimed = isRewardClaimed || dungeonStageRewardRequested;
              const canClaimReward =
                  (isTournamentFullyComplete || isUserEliminated) && !isRewardClaimed && !dungeonStageRewardRequested;
              const claimedRewardSummary = ts.claimedRewardSummary || null;

              const handleMobileRewardClaim = () => {
                  if (mobileRewardClaimBusy || !canClaimReward || !effectiveStageAttempt) return;
                  setMobileRewardClaimBusy(true);
                  audioService.claimReward();
                  handleCompleteDungeon();
                  setTimeout(() => setMobileRewardClaimBusy(false), 3000);
              };

              return (
                  <div className="flex w-full shrink-0 flex-col gap-1.5 border-t border-cyan-500/35 bg-slate-950/92 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
                      {!isDungeonModeFooter && (isTournamentFullyComplete || isUserEliminated) && treatAsClaimed && (
                          <div className="flex w-full flex-row flex-wrap items-stretch gap-2">
                              <div className="min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
                                  { !isRewardClaimed ? (
                                      <button
                                          type="button"
                                          onClick={() => handleCompleteDungeon()}
                                          disabled={mobileRewardClaimBusy}
                                          className="w-full rounded-lg bg-green-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                          {mobileRewardClaimBusy ? tt('processing') : tt('rewardComplete')}
                                      </button>
                                  ) : (
                                      <div className="flex w-full min-h-[2.25rem] items-center justify-center rounded-lg border border-gray-600 bg-gray-700/50 px-2 py-1.5 text-center text-xs font-semibold text-gray-400">
                                          보상완료
                                      </div>
                                  )}
                              </div>
                              <button
                                  type="button"
                                  onClick={handleChampionshipArenaExitClick}
                                  className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg bg-rose-800/85 px-2 py-1.5 text-xs font-semibold text-rose-50 transition-colors hover:bg-rose-700"
                              >
                                  {tt('exit')}
                              </button>
                          </div>
                      )}
                      {!isDungeonModeFooter && !treatAsClaimed && (
                          <div className="flex w-full flex-row flex-wrap items-stretch gap-2">
                              {(isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt ? (
                                  <button
                                      type="button"
                                      onClick={handleMobileRewardClaim}
                                      disabled={!canClaimReward || mobileRewardClaimBusy}
                                      className={`min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                                          canClaimReward && !mobileRewardClaimBusy
                                              ? 'cursor-pointer bg-green-600 text-white hover:bg-green-700'
                                              : 'cursor-not-allowed bg-gray-600 text-gray-400'
                                      }`}
                                  >
                                      {mobileRewardClaimBusy
                                          ? tt('claiming')
                                          : canClaimReward
                                            ? tt('claimReward')
                                            : tt('claimAfterMatchEnd')}
                                  </button>
                              ) : null}
                              {(isTournamentFullyComplete || isUserEliminated) ? (
                                  <button
                                      type="button"
                                      onClick={handleChampionshipArenaExitClick}
                                      className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg bg-rose-800/85 px-2 py-1.5 text-xs font-semibold text-rose-50 transition-colors hover:bg-rose-700"
                                  >
                                      {tt('exit')}
                                  </button>
                              ) : null}
                              {(isInProgress || isRoundComplete) &&
                              !((isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt) ? (
                                  <div className="min-w-0 flex-1 rounded-lg border border-blue-700/50 bg-blue-900/30 px-2 py-1.5 text-center text-xs font-semibold leading-snug text-blue-300">
                                      모든 경기 완료 후 보상수령
                                  </div>
                              ) : null}
                          </div>
                      )}
                      {isDungeonModeFooter ? (
                          <div className="flex w-full flex-row flex-wrap items-stretch gap-2">
                              {!(isTournamentFullyComplete || isUserEliminated) ? (
                                  <button
                                      type="button"
                                      onClick={() => setMobileChampionshipTab('rewards')}
                                      className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg bg-purple-700/70 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
                                  >
                                      {tt('expectedReward')}
                                  </button>
                              ) : null}
                              <button
                                  type="button"
                                  onClick={handleChampionshipArenaExitClick}
                                  className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg bg-rose-800/85 px-2 py-1.5 text-xs font-semibold text-rose-50 transition-colors hover:bg-rose-700"
                              >
                                  {tt('exit')}
                              </button>
                          </div>
                      ) : null}
                  </div>
              );
          })()
        : null;

    const sgfFileIndexForViewer = isSimulating
        ? currentSimMatch?.sgfFileIndex
        : (() => {
            if (pendingRoundSwitchTo != null && tournament.status === 'bracket_ready') return null;
            if (tournament.status === 'round_complete') {
                return lastUserMatchSgfIndex !== null ? lastUserMatchSgfIndex : (matchForDisplay?.sgfFileIndex !== undefined ? matchForDisplay.sgfFileIndex : null);
            }
            if (tournament.status === 'bracket_ready') {
                if (upcomingUserMatch?.sgfFileIndex !== undefined) {
                    return upcomingUserMatch.sgfFileIndex;
                }
                if (lastUserMatchSgfIndex !== null) {
                    return lastUserMatchSgfIndex;
                }
                return null;
            }
            return lastUserMatchSgfIndex !== null ? lastUserMatchSgfIndex : (matchForDisplay?.sgfFileIndex !== undefined ? matchForDisplay.sgfFileIndex : null);
        })();

    const sgfTimeElapsedForViewer = isSimulating
        ? (displayTournament.timeElapsed || 0)
        : (tournament.status === 'round_complete' || tournament.status === 'complete' || tournament.status === 'eliminated')
            ? 50
            : 0;

    const sgfShowLastMoveOnly = !isSimulating && (tournament.status === 'round_complete' || tournament.status === 'complete' || tournament.status === 'eliminated');

    const renderSidebarContent = (compact: boolean) => (
        <div
            className={`h-full w-full flex flex-col rounded-2xl bg-gradient-to-b from-[#1b2230] via-[#0d121c] to-[#05070b] ring-1 ring-inset ring-slate-500/20 ${compact ? 'gap-1 p-1' : 'gap-2 p-2'}`}
            style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
            <div
                className={`shrink-0 rounded-xl border border-amber-400/45 bg-gradient-to-br from-[#3a2810] via-[#1c2330] to-[#07090d] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_36px_-18px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-amber-300/18 ${compact ? 'p-2' : 'p-3'}`}
            >
                <div className="text-center">
                    <div
                        className={`truncate font-black text-amber-50 drop-shadow-[0_0_14px_rgba(251,191,36,0.22)] ${compact ? 'text-base leading-tight' : 'text-lg'}`}
                    >
                        {TOURNAMENT_DEFINITIONS[tournament.type].name}
                    </div>
                    {resolvedDungeonStageAttempt >= 1 ? (
                        <div
                            className={`mx-auto inline-flex rounded-full border border-amber-300/35 bg-amber-500/12 font-bold text-amber-100 ${compact ? 'mt-1 px-2 py-0.5 text-[10px]' : 'mt-2 px-3 py-1 text-xs'}`}
                        >
                            {resolvedDungeonStageAttempt}단계
                        </div>
                    ) : null}
                </div>
            </div>
            <div
                className={`grid shrink-0 grid-cols-2 rounded-xl border border-slate-600/65 bg-slate-950/88 shadow-inner ${compact ? 'gap-0.5 p-0.5' : 'gap-1 p-1'}`}
            >
                {([
                    { key: 'commentary' as const, label: tt('matchSummary') },
                    { key: 'bracket' as const, label: tt('roundTab') },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setChampionshipSidebarTab(tab.key)}
                        className={`rounded-lg font-bold transition-all ${
                            compact ? 'px-1.5 py-1 text-[10px]' : 'px-3 py-2 text-sm'
                        } ${
                            championshipSidebarTab === tab.key
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                                : 'text-slate-400 hover:bg-slate-800/90 hover:text-slate-100'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div
                className={`overflow-y-auto rounded-xl border border-slate-500/55 bg-gradient-to-b from-[#202938] via-[#111824] to-[#070a10] shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_12px_32px_-20px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.05] ${compact ? 'p-1.5' : 'p-2'}`}
                style={{
                    flex: '1 1 auto',
                    minHeight: 0,
                    maxHeight: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    width: '100%',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
            {championshipSidebarTab === 'commentary' ? (
                <CommentaryPanel
                    commentary={displayTournament.currentMatchCommentary}
                    isSimulating={displayTournament.status === 'round_in_progress'}
                    compact={compact}
                    emptyStateHint={championshipCommentaryEmptyHint}
                    emptyStateLoading={championshipAwaitingKataLoad}
                />
            ) : tournament.type === 'neighborhood' ? (
                <RoundRobinDisplay
                    tournamentState={tournament}
                    currentUser={currentUser}
                    nextRoundStartTime={tournament.nextRoundStartTime}
                    pendingRoundSwitchTo={pendingRoundSwitchTo}
                    compact={compact}
                />
            ) : (
                <TournamentRoundViewer 
                    rounds={safeRounds} 
                    currentUser={currentUser} 
                    tournamentType={tournament.type} 
                    tournamentState={tournament}
                    nextRoundTrigger={nextRoundTrigger}
                    nextRoundStartTime={tournament.nextRoundStartTime}
                    compact={compact}
                />
            )}
            </div>
        </div>
    );

    const radarStatLegend = (
        <div className="mt-1 flex flex-wrap justify-center gap-2 px-1 text-xs">
            <span className="flex items-center gap-0.5">
                <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }} />
                <span className="max-w-none truncate">{p1?.nickname || tt('playerOne')}</span>
            </span>
            <span className="flex items-center gap-0.5">
                <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
                <span className="max-w-none truncate">{p2?.nickname || tt('playerTwo')}</span>
            </span>
        </div>
    );

    const radarDesktopColumn = (
        <div className="flex w-52 shrink-0 flex-col items-center justify-center min-w-0">
            <RadarChart datasets={radarDatasets} maxStatValue={maxStatValue} />
            {radarStatLegend}
        </div>
    );

    const scoreGraphAndProgressSection = (
        <section
            className={`flex-shrink-0 rounded-lg border border-gray-600/75 bg-slate-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                isMobile ? 'p-1.5' : 'p-2'
            }`}
        >
            <ScoreGraph
                p1Percent={p1Percent}
                p2Percent={p2Percent}
                p1Nickname={p1?.nickname}
                p2Nickname={p2?.nickname}
                p1Cumulative={p1Cumulative}
                p2Cumulative={p2Cumulative}
                p1Player={p1}
                p2Player={p2}
                lastScoreIncrement={displayTournament.lastScoreIncrement}
                compact={isMobile}
            />
            <div className={isMobile ? 'mt-1' : 'mt-1.5'}>
                <SimulationProgressBar
                    timeElapsed={displayTournament.timeElapsed}
                    totalDuration={matchForDisplay?.championshipRealGame?.maxPly || 50}
                    compact={isMobile}
                />
            </div>
        </section>
    );

    const commentaryPanelSection = (
        <div
            className={`${!isMobile ? 'min-w-0 flex-[3]' : 'min-h-0 w-full flex-1'} flex flex-col overflow-hidden rounded-lg border border-gray-600/75 bg-slate-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                isMobile ? 'p-1.5' : 'p-2'
            }`}
            style={{ display: 'flex', flexDirection: 'column', minHeight: !isMobile ? undefined : 0 }}
        >
            <CommentaryPanel
                commentary={displayTournament.currentMatchCommentary}
                isSimulating={displayTournament.status === 'round_in_progress'}
                compact={isMobile}
                emptyStateHint={championshipCommentaryEmptyHint}
                emptyStateLoading={championshipAwaitingKataLoad}
            />
        </div>
    );

    const finalRewardSection = (
        <div
            className={`flex min-h-0 flex-col rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                isMobile ? 'w-full min-w-0 overflow-hidden' : 'min-w-0 overflow-hidden'
            }`}
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            <FinalRewardPanel
                tournamentState={displayTournament}
                rewardsSourceTournament={tournament ?? null}
                currentUser={currentUser}
                onAction={onAction}
                onCompleteDungeon={handleCompleteDungeon}
                dungeonRewardAlreadyRequested={dungeonStageRewardRequested}
                onDungeonRewardRequested={() => setDungeonStageRewardRequested(true)}
                onOpenRewardHistory={handleOpenRewardHistory}
                onExitToLobby={handleChampionshipArenaExitClick}
                layoutVariant={isMobile ? 'mobileTab' : 'sidebar'}
                suppressBottomActions={isMobile}
                suppressClaimActions={isDungeonChampionshipVenue}
                suppressSideActionButtons={isDungeonChampionshipVenue}
                expectedRewardDetailsOpen={showChampionshipExpectedRewardDetails}
                onExpectedRewardDetailsOpenChange={setShowChampionshipExpectedRewardDetails}
            />
        </div>
    );

    const championshipPanelScores = useMemo(
        () =>
            resolveChampionshipPanelScores(matchForDisplay?.championshipRealGame, {
                isPlaybackActive: displayTournament?.status === 'round_in_progress',
            }),
        [
            displayTournament?.status,
            matchForDisplay?.championshipRealGame?.status,
            matchForDisplay?.championshipRealGame?.boardSize,
            matchForDisplay?.championshipRealGame?.moves,
            matchForDisplay?.championshipRealGame?.currentPly,
            matchForDisplay?.championshipRealGame?.finalScore?.black,
            matchForDisplay?.championshipRealGame?.finalScore?.white,
        ],
    );

    const championshipDungeonTerritoryAnalysis = useMemo(
        () => resolveChampionshipTerritoryAnalysisForRealGame(matchForDisplay?.championshipRealGame ?? null),
        [
            matchForDisplay?.championshipRealGame?.boardSize,
            matchForDisplay?.championshipRealGame?.moves,
            matchForDisplay?.championshipRealGame?.status,
            matchForDisplay?.championshipRealGame?.scoringAnalysis,
        ],
    );

    const renderSimpleChampionshipPlayerCard = (player: PlayerForTournament | null, tone: 'black' | 'white') => {
        const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
        const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
        const isCurrentUser = player?.id === currentUser.id;
        const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser);
        const realGame = matchForDisplay?.championshipRealGame;
        const isBlackPlayer = player?.id && realGame?.blackPlayerId === player.id;
        const colorLabel = isBlackPlayer ? tt('black') : player?.id && realGame?.whitePlayerId === player.id ? tt('white') : '';
        const isWhite = colorLabel === tt('white');
        const isBlackStone = colorLabel === tt('black');
        const isRightSide = tone === 'white';
        const toneSurface = isWhite
            ? 'bg-gradient-to-br from-slate-100 to-slate-300/95 text-slate-950 shadow-sm'
            : isBlackStone
              ? 'bg-gradient-to-br from-zinc-900/92 to-black/95 text-stone-100 shadow-lg'
              : tone === 'black'
                ? 'bg-gradient-to-br from-zinc-900/92 to-black/95 text-stone-100 shadow-lg'
                : 'bg-gradient-to-br from-slate-600/90 via-slate-700/92 to-slate-950/95 text-slate-50 shadow-lg';
        const toneBorder = isCurrentUser
            ? 'box-border border-2 border-amber-400/90 shadow-[0_0_24px_-6px_rgba(245,158,11,0.5)] ring-1 ring-inset ring-amber-200/25'
            : isWhite
              ? 'box-border border-2 border-slate-500/90 ring-1 ring-inset ring-transparent'
              : isBlackStone
                ? 'box-border border-2 border-stone-600/55 ring-1 ring-inset ring-transparent'
                : tone === 'black'
                  ? 'box-border border-2 border-stone-500/45 ring-1 ring-inset ring-transparent'
                  : 'box-border border-2 border-slate-400/40 ring-1 ring-inset ring-transparent';
        const mutedText = isWhite ? 'text-slate-700' : 'text-slate-300';
        const strongText = isWhite ? 'text-slate-950' : 'text-slate-50';
        const chipClass = isWhite ? 'bg-slate-900/10 text-slate-800' : 'bg-white/10 text-slate-200';
        const resolvedCondition = resolveChampionshipDisplayCondition({
            playerCondition: player?.condition,
            snapshotCondition: championshipConditionFallback,
            isCurrentUser,
        });
        const displayCondition: number | null = resolvedCondition === 1000 ? null : resolvedCondition;
        const conditionTone =
            typeof displayCondition === 'number' && displayCondition < 40
                ? 'text-red-300'
                : typeof displayCondition === 'number' && displayCondition >= 80
                  ? 'text-emerald-300'
                  : strongText;
        const scoreValue = championshipPanelScores
            ? isBlackStone
                ? championshipPanelScores.black
                : isWhite
                  ? championshipPanelScores.white
                  : null
            : null;
        const scoreKind = championshipPanelScores?.kind;
        /** 인게임 던전: `players[].wins`는 이번 단계 누적이 아닐 수 있어, 라운드 종료 대국 기준으로 표시 */
        const dungeonRunRecord =
            tournament.currentStageAttempt != null && player?.id
                ? dungeonUserMatchRecordForPlayer(displayTournament, player.id, matchForDisplay)
                : null;
        const recordWins = dungeonRunRecord ? dungeonRunRecord.wins : (player?.wins ?? 0);
        const recordLosses = dungeonRunRecord ? dungeonRunRecord.losses : (player?.losses ?? 0);
        const scoreBox = (
            <ChampionshipDesktopScoreBox isWhite={isWhite} score={scoreValue} scoreKind={scoreKind} />
        );

        return (
            <div
                className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300 ${isRightSide ? 'flex-row-reverse text-right' : ''} ${toneBorder} ${toneSurface}`}
            >
                <button
                    type="button"
                    className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                    title={clickable && player ? tt('viewProfile', { name: player.nickname }) : undefined}
                >
                    {player ? (
                        <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={64} />
                    ) : (
                        <div className="h-16 w-16 rounded-full bg-slate-800" />
                    )}
                </button>
                <div className="min-w-0 flex-1">
                    <div className={`flex items-center gap-2 ${isRightSide ? 'justify-end' : ''}`}>
                        {colorLabel ? <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${chipClass}`}>{colorLabel}</span> : null}
                        <span className={`truncate text-sm font-bold ${strongText}`}>{player?.nickname ?? tt('playerWaitingShort')}</span>
                        {isCurrentUser ? <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">{tt('me')}</span> : null}
                        <span className={`whitespace-nowrap text-[12px] font-semibold ${mutedText}`}>
                            컨디션{' '}
                            <b className={`text-base tabular-nums ${conditionTone}`}>
                                {displayCondition == null ? '-' : displayCondition}
                            </b>
                        </span>
                        {isCurrentUser &&
                        shouldShowChampionshipConditionRecoveryButton({
                            condition: resolvedCondition,
                            tournamentStatus: tournament?.status,
                        }) ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canUseConditionPotion) return;
                                    setShowConditionPotionModal(true);
                                }}
                                disabled={!canUseConditionPotion}
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-black leading-none text-white shadow-md transition-colors ${
                                    canUseConditionPotion
                                        ? 'border-emerald-300/55 bg-emerald-600/80 hover:bg-emerald-500'
                                        : 'cursor-not-allowed border-gray-500/55 bg-gray-600/80 opacity-60'
                                }`}
                                title={
                                    canUseConditionPotion
                                        ? tt('conditionRecover')
                                        : tt('conditionPotionUnavailable')
                                }
                            >
                                +
                            </button>
                        ) : null}
                    </div>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${isRightSide ? 'justify-end' : ''} ${mutedText}`}>
                        <span title={dungeonRunRecord ? tt('dungeonRunRecordTitle') : undefined}>
                            {tt('record')} <b className={`tabular-nums ${strongText}`}>{tt('recordWinsLosses', { wins: recordWins, losses: recordLosses })}</b>
                        </span>
                    </div>
                </div>
                {scoreBox}
            </div>
        );
    };

    const realGameForCountdown = matchForDisplay?.championshipRealGame;
    const remainingPlyToScoring = realGameForCountdown
        ? Math.max(0, realGameForCountdown.maxPly - realGameForCountdown.currentPly)
        : null;
    const maxPlyToScoring = realGameForCountdown?.maxPly ?? 180;
    const championshipScoringCountdownPanel = (
        <ChampionshipDesktopScoringCountdownBox remaining={remainingPlyToScoring} max={maxPlyToScoring} />
    );

    const championshipPlayerRail = matchForDisplay && (p1 || p2) ? (
        <div className="flex-shrink-0 w-full flex justify-center">
            <div className="min-w-0 w-full flex-1 px-2 pt-1 min-[1025px]:px-1">
                <section className="flex min-h-[74px] shrink-0 flex-row items-stretch gap-2 overflow-hidden rounded-lg border-2 border-zinc-600 bg-zinc-950 p-2 shadow-xl">
                    {renderSimpleChampionshipPlayerCard(p1, 'black')}
                    {championshipScoringCountdownPanel}
                    {renderSimpleChampionshipPlayerCard(p2, 'white')}
                </section>
            </div>
        </div>
    ) : null;

    const championshipBoardHostClipClass = 'overflow-hidden';

    const championshipFooterControls = (
        <div className="flex-shrink-0 w-full flex flex-col gap-1">
            <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#2a3d56] via-[#141c2b] to-[#070a10] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_52px_-18px_rgba(0,0,0,0.96)] ring-1 ring-inset ring-amber-300/12">
                {isMobile && isDungeonChampionshipVenue ? (
                    renderMobileChampionshipDungeonFooterButtonPanel()
                ) : (
                    <div
                        className={`grid min-h-[136px] gap-2 overflow-hidden ${
                            isMobile ? 'grid-cols-[1.15fr_0.85fr]' : 'grid-cols-[1fr_0.9fr_1.25fr]'
                        }`}
                    >
                        {!isMobile && finalRewardSection}
                        {championshipMatchResultPanelSection}
                        {renderChampionshipFooterButtonPanel()}
                    </div>
                )}
            </div>
        </div>
    );

    const championshipMainGameRoom = (
        <main className={`flex-1 flex min-w-0 min-h-0 items-stretch justify-center ${championshipBoardHostClipClass}`}>
            <div className="w-full h-full max-h-full max-w-full flex min-h-0 flex-col items-stretch gap-0.5 lg:gap-1.5">
                {championshipPlayerRail}
                <div className={`relative min-h-0 w-full min-w-0 flex-1 ${championshipBoardHostClipClass}`}>
                    <div className="absolute inset-0 flex min-h-0 flex-col">
                        <div className={`relative flex h-full w-full min-h-0 min-w-0 flex-col ${championshipBoardHostClipClass}`}>
                            <div className={`flex min-h-0 w-full flex-1 items-stretch justify-center transition-opacity duration-500 ${championshipBoardHostClipClass}`}>
                                <div className="flex h-full w-full min-w-0 items-stretch justify-center gap-1.5 px-1 py-1 [&>*]:shrink-0">
                                    <ChampionshipAbilityPlayerPanel
                                        player={p1}
                                        stats={p1Stats as Record<string, number>}
                                        match={matchForDisplay}
                                        currentPhase={currentPhase}
                                        tone="black"
                                        sideLabel={tt('championshipAbility')}
                                        abilityKataLadder={abilityKataLadder}
                                    />
                                    <div className={`relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center bg-transparent p-0 ${championshipBoardHostClipClass}`}>
                                        <ChampionshipRealGoBoard
                                            match={matchForDisplay}
                                            currentUser={currentUser}
                                            tournamentFinished={championshipFinished}
                                            dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                                            territoryAnalysis={championshipDungeonTerritoryAnalysis}
                                        />
                                    </div>
                                    <ChampionshipAbilityPlayerPanel
                                        player={p2}
                                        stats={p2Stats as Record<string, number>}
                                        match={matchForDisplay}
                                        currentPhase={currentPhase}
                                        tone="white"
                                        sideLabel={tt('championshipAbility')}
                                        abilityKataLadder={abilityKataLadder}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {championshipFooterControls}
            </div>
        </main>
    );

    /** 모바일 전용: 상단 대국자 순수정보 카드(점수 제외) — 아바타 + 흑/백 + 닉네임 + 전적 + 컨디션 */
    const renderMobileChampionshipPureInfoCard = (
        player: PlayerForTournament | null,
        side: 'left' | 'right',
    ) => {
        const realGame = matchForDisplay?.championshipRealGame;
        const isBlackPlayer = !!(player?.id && realGame?.blackPlayerId === player.id);
        const isWhitePlayer = !!(player?.id && realGame?.whitePlayerId === player.id);
        const colorLabel = isBlackPlayer ? tt('black') : isWhitePlayer ? tt('white') : '';
        const isCurrentUser = player?.id === currentUser.id;
        const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser);
        const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
        const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
        const resolvedConditionMobile = resolveChampionshipDisplayCondition({
            playerCondition: player?.condition,
            snapshotCondition: championshipConditionFallback,
            isCurrentUser,
        });
        const effectiveCondition: number | null = resolvedConditionMobile === 1000 ? null : resolvedConditionMobile;
        const conditionTone =
            typeof effectiveCondition === 'number' && effectiveCondition < 40
                ? 'text-red-300'
                : typeof effectiveCondition === 'number' && effectiveCondition >= 80
                  ? 'text-emerald-300'
                  : isWhitePlayer
                    ? 'text-slate-900'
                    : 'text-slate-100';
        const dungeonRunRecordMobile =
            tournament.currentStageAttempt != null && player?.id
                ? dungeonUserMatchRecordForPlayer(displayTournament, player.id, matchForDisplay)
                : null;
        const recordWinsMobile = dungeonRunRecordMobile ? dungeonRunRecordMobile.wins : (player?.wins ?? 0);
        const recordLossesMobile = dungeonRunRecordMobile ? dungeonRunRecordMobile.losses : (player?.losses ?? 0);
        const toneSurface = isWhitePlayer
            ? 'bg-gradient-to-br from-slate-100 to-slate-300/95 text-slate-950'
            : isBlackPlayer
              ? 'bg-gradient-to-br from-zinc-900/92 to-black/95 text-stone-100'
              : side === 'left'
                ? 'bg-gradient-to-br from-zinc-900/92 to-black/95 text-stone-100'
                : 'bg-gradient-to-br from-slate-600/90 via-slate-700/92 to-slate-950/95 text-slate-50';
        const toneBorder = isCurrentUser
            ? 'box-border border-2 border-amber-400/90 shadow-[0_0_18px_-5px_rgba(245,158,11,0.45)] ring-1 ring-inset ring-amber-200/20'
            : isWhitePlayer
              ? 'box-border border-2 border-slate-400/85 ring-1 ring-inset ring-transparent'
              : isBlackPlayer
                ? 'box-border border-2 border-stone-600/55 ring-1 ring-inset ring-transparent'
                : side === 'left'
                  ? 'box-border border-2 border-stone-500/45 ring-1 ring-inset ring-transparent'
                  : 'box-border border-2 border-slate-400/40 ring-1 ring-inset ring-transparent';
        const mutedText = isWhitePlayer ? 'text-slate-700' : 'text-slate-300';
        const strongText = isWhitePlayer ? 'text-slate-950' : 'text-slate-50';
        const chipClass = isWhitePlayer ? 'bg-slate-900/12 text-slate-800' : 'bg-white/12 text-slate-100';
        const isRightSide = side === 'right';
        const condDisplay = effectiveCondition == null ? '-' : effectiveCondition;

        return (
            <div
                className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 ${isRightSide ? 'flex-row-reverse text-right' : ''} ${toneBorder} ${toneSurface}`}
            >
                <button
                    type="button"
                    className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                    title={clickable && player ? tt('viewProfile', { name: player.nickname }) : undefined}
                >
                    {player ? (
                        <Avatar
                            userId={player.id}
                            userName={player.nickname}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                            size={42}
                        />
                    ) : (
                        <div className="h-[42px] w-[42px] rounded-full bg-slate-800" />
                    )}
                </button>
                <div className="min-w-0 flex-1">
                    <div className={`flex flex-wrap items-center gap-1 leading-tight ${isRightSide ? 'justify-end' : ''}`}>
                        {colorLabel ? (
                            <span className={`rounded px-1 py-0 text-[10px] font-bold leading-none ${chipClass}`}>
                                {colorLabel}
                            </span>
                        ) : null}
                        <span className={`truncate text-[12px] font-bold ${strongText}`}>
                            {player?.nickname ?? tt('playerWaitingShort')}
                        </span>
                        {isCurrentUser ? (
                            <span className="rounded bg-amber-400/30 px-1 py-0 text-[9px] font-bold text-amber-100">
                                나
                            </span>
                        ) : null}
                    </div>
                    <div
                        className={`mt-0.5 text-[10px] leading-tight ${
                            isRightSide ? 'text-right' : ''
                        } ${mutedText}`}
                    >
                        <span title={dungeonRunRecordMobile ? tt('dungeonRunRecordTitle') : undefined}>
                            전적{' '}
                            <b className={`tabular-nums ${strongText}`}>
                                {recordWinsMobile}승 {recordLossesMobile}패
                            </b>
                        </span>
                    </div>
                    <div
                        className={`mt-0.5 flex items-center gap-1 text-[10px] leading-tight ${
                            isRightSide ? 'justify-end' : ''
                        } ${mutedText}`}
                    >
                        <span className="whitespace-nowrap">
                            컨디션{' '}
                            <b className={`text-[12px] tabular-nums ${conditionTone}`}>{condDisplay}</b>
                        </span>
                        {isCurrentUser &&
                        shouldShowChampionshipConditionRecoveryButton({
                            condition: resolvedConditionMobile,
                            tournamentStatus: tournament?.status,
                        }) ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canUseConditionPotion) return;
                                    setShowConditionPotionModal(true);
                                }}
                                disabled={!canUseConditionPotion}
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-black leading-none text-white shadow ${
                                    canUseConditionPotion
                                        ? 'border-emerald-300/55 bg-emerald-600/85'
                                        : 'cursor-not-allowed border-gray-500/55 bg-gray-600/80 opacity-60'
                                }`}
                                title={
                                    canUseConditionPotion
                                        ? tt('conditionRecover')
                                        : tt('conditionPotionUnavailable')
                                }
                            >
                                +
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    };

    const mobileChampionshipPlayerInfoRow =
        matchForDisplay && (p1 || p2) ? (
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-zinc-600 bg-zinc-950 p-1 shadow-md">
                {renderMobileChampionshipPureInfoCard(p1, 'left')}
                {renderMobileChampionshipPureInfoCard(p2, 'right')}
            </section>
        ) : null;

    /** 모바일 전용: 가로 챔피언십 능력치 패널(초반·중반·종반 단계 능력만 — 코어 6종은 생략) */
    const renderMobileChampionshipAbilityPanel = (
        player: PlayerForTournament | null,
        stats: Record<string, number>,
        tone: 'black' | 'white',
    ) => {
        const realGame = matchForDisplay?.championshipRealGame;
        const boardSize = realGame?.boardSize ?? 19;
        const activePhaseKey =
            currentPhase === 'early'
                ? 'opening'
                : currentPhase === 'mid'
                  ? 'midgame'
                  : currentPhase === 'end'
                    ? 'endgame'
                    : null;
        const accentTone =
            tone === 'black'
                ? 'border-stone-500/45 bg-gradient-to-br from-zinc-900/92 via-zinc-950/93 to-black/95'
                : 'border-slate-300/40 bg-gradient-to-br from-slate-600/90 via-slate-700/92 to-slate-950/95';
        const valueColor = tone === 'black' ? 'text-stone-100' : 'text-slate-50';

        return (
            <div className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border ${accentTone} p-1`}>
                <div className="grid grid-cols-3 gap-0.5">
                    {CHAMPIONSHIP_PHASE_META.map((phase) => {
                        const ply = championshipPhaseMetaPly(boardSize, phase);
                        const fromSnapshot = player?.id
                            ? realGame?.phaseStatsByPlayerId?.[player.id]?.[phase.key]
                            : undefined;
                        const computed =
                            fromSnapshot ?? championshipKataLevelForPly(ply, stats as any, undefined, abilityKataLadder);
                        const isActive = activePhaseKey === phase.key;
                        return (
                            <div
                                key={phase.key}
                                className={`flex items-center justify-between gap-1 rounded px-1 py-0.5 text-[9px] leading-none ${
                                    isActive
                                        ? 'border border-amber-300/65 bg-amber-500/22 text-amber-100'
                                        : 'border border-slate-600/45 bg-black/25 text-slate-300'
                                }`}
                            >
                                <span className="font-semibold">{tt(phase.labelKey)}</span>
                                <span className={`text-[11px] font-black tabular-nums ${valueColor}`}>
                                    {computed.abilityScore}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const mobileChampionshipAbilityRow =
        matchForDisplay && (p1 || p2) ? (
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-zinc-600/80 bg-gradient-to-b from-[#1e293b] via-[#141c2b] to-[#070a10] p-1 shadow-md">
                {renderMobileChampionshipAbilityPanel(p1, p1Stats as Record<string, number>, 'black')}
                {renderMobileChampionshipAbilityPanel(p2, p2Stats as Record<string, number>, 'white')}
            </section>
        ) : null;

    /** 모바일 전용: 점수(P1) + 계가까지 + 점수(P2) — 한 줄 패널 */
    const mobileChampionshipScoreCountdownRow = (() => {
        const realGame = matchForDisplay?.championshipRealGame;
        if (!realGame) return null;
        const remainingPly = Math.max(0, (realGame.maxPly ?? 0) - (realGame.currentPly ?? 0));
        const maxPly = realGame.maxPly ?? 180;
        const blackId = realGame.blackPlayerId;
        const whiteId = realGame.whitePlayerId;
        const p1IsBlack = !!(p1?.id && p1.id === blackId);
        const p1IsWhite = !!(p1?.id && p1.id === whiteId);
        const p2IsBlack = !!(p2?.id && p2.id === blackId);
        const p2IsWhite = !!(p2?.id && p2.id === whiteId);
        const p1Score = championshipPanelScores
            ? p1IsBlack
                ? championshipPanelScores.black
                : p1IsWhite
                  ? championshipPanelScores.white
                  : null
            : null;
        const p2Score = championshipPanelScores
            ? p2IsBlack
                ? championshipPanelScores.black
                : p2IsWhite
                  ? championshipPanelScores.white
                  : null
            : null;

        const mobileScoreKind = championshipPanelScores?.kind;

        return (
            <section className="flex shrink-0 flex-row items-stretch gap-1">
                <ChampionshipMobileScoreCell
                    isWhite={p1IsWhite}
                    score={p1Score}
                    scoreKind={mobileScoreKind}
                    colorLabel={p1IsBlack ? tt('black') : p1IsWhite ? tt('white') : ''}
                    side="left"
                />
                <ChampionshipMobileScoringCountdownCell remaining={remainingPly} max={maxPly} />
                <ChampionshipMobileScoreCell
                    isWhite={p2IsWhite}
                    score={p2Score}
                    scoreKind={mobileScoreKind}
                    colorLabel={p2IsBlack ? tt('black') : p2IsWhite ? tt('white') : ''}
                    side="right"
                />
            </section>
        );
    })();

    /** 모바일 전용: 큰 바둑판 영역 */
    const mobileChampionshipBoardSection = (
        <div
            className={`relative flex min-h-[min(22dvh,260px)] w-full min-w-0 flex-1 items-center justify-center rounded-md bg-transparent p-1 ${championshipBoardHostClipClass}`}
        >
            <ChampionshipRealGoBoard
                match={matchForDisplay}
                currentUser={currentUser}
                tournamentFinished={championshipFinished}
                dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                territoryAnalysis={championshipDungeonTerritoryAnalysis}
            />
            {mobileBoardCenterMatchAction ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <div
                        className={`pointer-events-auto px-2 ${
                            championshipDungeonBoardCenterMode === 'deep_breath' ? 'translate-y-10' : ''
                        }`}
                    >
                        {mobileBoardCenterMatchAction}
                    </div>
                </div>
            ) : null}
        </div>
    );

    /** 모바일 전용: 전체 인게임 경기장 — 정보행 + 능력치행 + 점수/계가행 + 큰 바둑판 + 푸터 */
    const mobileChampionshipMainGameRoom = (
        <main className={`flex flex-1 min-h-0 min-w-0 flex-col items-stretch justify-center bg-transparent ${championshipBoardHostClipClass}`}>
            <div
                className={`flex min-h-0 w-full max-w-full flex-1 flex-col items-stretch gap-1 overflow-y-auto overflow-x-hidden bg-transparent px-1 py-1 ${championshipBoardHostClipClass}`}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {mobileChampionshipPlayerInfoRow}
                {mobileChampionshipAbilityRow}
                {mobileChampionshipScoreCountdownRow}
                {mobileChampionshipBoardSection}
                {isDungeonChampionshipVenue ? (
                    championshipFooterControls
                ) : (
                    <>
                        <div className="w-full shrink-0 min-h-0 max-h-[min(30vh,280px)] overflow-y-auto overflow-x-hidden">
                            {renderChampionshipFooterButtonPanel()}
                            {championshipMatchResultPanelSection}
                        </div>
                        {championshipMobileStickyBar}
                    </>
                )}
            </div>
        </main>
    );

    const mainContent = (
        <div
            className={`${isMobile ? 'flex w-full min-h-0 min-w-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-row gap-2 overflow-hidden'}`}
            style={isMobile ? { minHeight: 0 } : { height: '100%', display: 'flex' }}
        >
            <div
                className={`${
                    isMobile
                        ? `flex min-h-0 w-full flex-1 flex-col gap-2 ${
                              mobileChampionshipTab === 'board' ||
                              mobileChampionshipTab === 'live' ||
                              mobileChampionshipTab === 'players'
                                  ? 'overflow-hidden'
                                  : 'overflow-y-auto'
                          }`
                        : 'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden'
                }`}
            >
                {/* 플레이어 프로필 섹션 */}
                {(!isMobile || mobileChampionshipTab === 'players') &&
                    (matchForDisplay && (p1 || p2) ? (
                        <section
                            className={`rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                                isMobile
                                    ? 'mb-0 mt-0 flex min-h-0 flex-1 flex-col'
                                    : 'flex h-[300px] shrink-0 flex-row items-stretch overflow-hidden'
                            }`}
                            style={isMobile ? {} : { minHeight: '300px', maxHeight: '300px' }}
                        >
                            {isMobile ? (
                                <PlayerProfilePanelErrorBoundary>
                                    <MobileChampionshipPlayersCompare
                                        p1={p1}
                                        p2={p2}
                                        initialP1={initialMatchPlayers.p1}
                                        initialP2={initialMatchPlayers.p2}
                                        p1Stats={p1Stats}
                                        p2Stats={p2Stats}
                                        allUsers={allUsersForRanking}
                                        currentUserId={currentUser.id}
                                        onViewUser={onViewUser}
                                        tournamentStatus={tournament.status}
                                        canUseConditionPotion={canUseConditionPotion}
                                        onUseConditionPotion={() => setShowConditionPotionModal(true)}
                                        conditionFallback={championshipConditionFallback}
                                        isUserMatchP1={
                                            (currentSimMatch?.isUserMatch ||
                                                (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p1?.id))) ||
                                            false
                                        }
                                        isUserMatchP2={
                                            (currentSimMatch?.isUserMatch ||
                                                (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p2?.id))) ||
                                            false
                                        }
                                        highlightPhase={currentPhase}
                                    />
                                </PlayerProfilePanelErrorBoundary>
                            ) : (
                                <>
                                    <div ref={p1ProfileRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
                                        <PlayerProfilePanelErrorBoundary>
                                            <PlayerProfilePanel
                                                player={p1}
                                                initialPlayer={initialMatchPlayers.p1}
                                                allUsers={allUsersForRanking}
                                                currentUserId={currentUser.id}
                                                onViewUser={onViewUser}
                                                highlightPhase={currentPhase}
                                                isUserMatch={
                                                    (currentSimMatch?.isUserMatch ||
                                                        (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p1?.id))) ||
                                                    false
                                                }
                                                onUseConditionPotion={() => {
                                                    setShowConditionPotionModal(true);
                                                }}
                                                timeElapsed={tournament.timeElapsed}
                                                tournamentStatus={tournament.status}
                                                isMobile={isMobile}
                                                canUseConditionPotion={canUseConditionPotion}
                                                conditionFallback={championshipConditionFallback}
                                            />
                                        </PlayerProfilePanelErrorBoundary>
                                    </div>
                                    {radarDesktopColumn}
                                    <div ref={p2ProfileRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
                                        <PlayerProfilePanelErrorBoundary>
                                            <PlayerProfilePanel
                                                player={p2}
                                                initialPlayer={initialMatchPlayers.p2}
                                                allUsers={allUsersForRanking}
                                                currentUserId={currentUser.id}
                                                onViewUser={onViewUser}
                                                highlightPhase={currentPhase}
                                                isUserMatch={
                                                    (currentSimMatch?.isUserMatch ||
                                                        (upcomingUserMatch && upcomingUserMatch.players.some((p) => p?.id === p2?.id))) ||
                                                    false
                                                }
                                                onUseConditionPotion={() => {
                                                    setShowConditionPotionModal(true);
                                                }}
                                                timeElapsed={tournament.timeElapsed}
                                                tournamentStatus={tournament.status}
                                                isMobile={isMobile}
                                                canUseConditionPotion={canUseConditionPotion}
                                                conditionFallback={championshipConditionFallback}
                                            />
                                        </PlayerProfilePanelErrorBoundary>
                                    </div>
                                </>
                            )}
                        </section>
                    ) : (
                        <section
                            className={`flex shrink-0 rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                                isMobile ? 'mt-0 mb-0' : 'h-[300px] overflow-hidden'
                            }`}
                            style={isMobile ? {} : { minHeight: '300px', maxHeight: '300px' }}
                        >
                            <div className="flex flex-1 items-center justify-center text-gray-400">{tt('loadingMatchInfo')}</div>
                        </section>
                    ))}
                
                {/* 데스크톱: 인게임 경기장형 중앙 바둑판 + 하단 패널 / 모바일: 탭으로 분리 */}
                {!isMobile && (
                    <div className={`flex max-h-full min-h-0 flex-1 flex-col gap-2 ${championshipBoardHostClipClass}`}>
                        <div className={`flex min-h-0 flex-1 flex-row gap-2 ${championshipBoardHostClipClass}`}>
                            <div className={`relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-slate-600/70 bg-gradient-to-b from-slate-950/95 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${championshipBoardHostClipClass}`}>
                                <div className={`relative flex min-h-0 w-full flex-1 items-center justify-center ${championshipBoardHostClipClass}`}>
                                    <ChampionshipRealGoBoard
                                        match={matchForDisplay}
                                        currentUser={currentUser}
                                        tournamentFinished={championshipFinished}
                                        dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                                        territoryAnalysis={championshipDungeonTerritoryAnalysis}
                                    />
                                </div>
                            </div>
                            <ChampionshipAbilitySidePanel
                                p1={p1}
                                p2={p2}
                                p1Stats={p1Stats as Record<string, number>}
                                p2Stats={p2Stats as Record<string, number>}
                                match={matchForDisplay}
                                currentPhase={currentPhase}
                                abilityKataLadder={abilityKataLadder}
                            />
                        </div>
                        <div className="grid h-[210px] shrink-0 grid-cols-[1.05fr_1.8fr_1fr] gap-2 overflow-hidden">
                            {scoreGraphAndProgressSection}
                            {commentaryPanelSection}
                            {finalRewardSection}
                        </div>
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'live' && (
                    <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden">
                        {scoreGraphAndProgressSection}
                        {commentaryPanelSection}
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'board' && (
                    <div className={`flex min-h-0 w-full flex-1 flex-col ${championshipBoardHostClipClass}`}>
                        <div
                            className="relative flex min-h-[min(56dvh,520px)] w-full flex-1 flex-col items-center justify-center overflow-auto rounded-lg border border-gray-600/75 bg-slate-950/92 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-2"
                        >
                            <div className={`relative flex min-h-0 w-full flex-1 items-center justify-center ${championshipBoardHostClipClass}`}>
                                <ChampionshipRealGoBoard
                                    match={matchForDisplay}
                                    currentUser={currentUser}
                                    tournamentFinished={championshipFinished}
                                    dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                                    territoryAnalysis={championshipDungeonTerritoryAnalysis}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'bracket' && (
                    <div className="flex min-h-[180px] w-full flex-1 flex-col overflow-hidden rounded-lg border-2 border-gray-600/90 bg-slate-950/95 px-0.5 py-0.5 shadow-lg">
                        {renderSidebarContent(true)}
                    </div>
                )}

                {isMobile && mobileChampionshipTab === 'rewards' && (
                    <div
                        className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-1"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        {finalRewardSection}
                    </div>
                )}
            </div>
            
            {!isMobile && (
                <aside className="flex w-[320px] flex-shrink-0 flex-col rounded-lg border-2 border-gray-600/90 bg-slate-950/95 p-2 shadow-lg xl:w-[380px]" style={{ height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {renderSidebarContent(false)}
                </aside>
            )}
        </div>
    );
    
    return (
        <div
            className="w-full flex flex-col p-1 lg:p-2 relative max-w-full min-h-0 text-white"
            style={{ height: '100%', maxHeight: '100%' }}
        >
            <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url(${resolvePublicUrl(getChampionshipArenaBackgroundUrl(tournament.type as string))})`,
                }}
                aria-hidden
            />
            <div className={`relative z-10 flex min-h-0 flex-1 flex-row gap-2 ${championshipBoardHostClipClass}`}>
                {isMobile ? mobileChampionshipMainGameRoom : championshipMainGameRoom}

                {!isMobile && (
                    <div
                        className={`relative overflow-visible max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
                            isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                        }`}
                    >
                        {!isRightSidebarCollapsed && (
                            <div className="relative flex h-full max-h-full min-h-0 items-stretch overflow-hidden rounded-2xl border border-amber-500/38 bg-gradient-to-b from-[#222b3b] via-[#111827] to-[#050608] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_20px_52px_-18px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-amber-300/10">
                                <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                    {renderSidebarContent(false)}
                                </div>
                            </div>
                        )}
                        <ArenaRightSidebarCollapseToggle
                            collapsed={isRightSidebarCollapsed}
                            onToggle={() => setIsRightSidebarCollapsed((prev) => !prev)}
                            tone="championship"
                        />
                    </div>
                )}

                {isMobile && (
                    <>
                        <div
                            className={`fixed right-0 z-50 flex w-[280px] flex-col overflow-hidden bg-gradient-to-b from-[#222b3b] via-[#111827] to-[#050608] shadow-2xl transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                            style={{
                                top: CHAMPIONSHIP_MOBILE_OVERLAY_DRAWER_TOP,
                                bottom: CHAMPIONSHIP_MOBILE_OVERLAY_DRAWER_BOTTOM,
                            }}
                        >
                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                <div className="flex shrink-0 items-center justify-end border-b border-slate-700 bg-slate-950 px-3 py-2">
                                    <span className="sr-only">{tt('sidebarExtraPanel')}</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(false)}
                                        className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
                                    >
                                        닫기
                                    </button>
                                </div>
                                {renderSidebarContent(true)}
                            </div>
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setIsMobileSidebarOpen(false)} />}
                    </>
                )}
            </div>

            {isMobile && !isMobileSidebarOpen && (
                <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed right-0 z-30 flex h-[6.25rem] w-[2.65rem] flex-col items-center justify-center gap-1 rounded-l-2xl border-2 border-r-0 border-amber-200/75 bg-gradient-to-b from-amber-400/95 via-amber-600/92 to-slate-950 text-white shadow-[0_6px_28px_-4px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-2 ring-amber-300/35 active:translate-x-0.5"
                    style={{ bottom: CHAMPIONSHIP_MOBILE_SIDEBAR_OPEN_TAB_BOTTOM }}
                    aria-label={tt('openRightPanel')}
                    title={tt('openRightPanel')}
                >
                    <span className="text-2xl font-black leading-none tracking-tight text-white drop-shadow-md">‹</span>
                    <span className="h-8 w-1 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.55)]" aria-hidden />
                </button>
            )}

            {showConditionPotionModal && userPlayer && tournament && canUseConditionPotion && (
                <ConditionPotionModal
                    currentUser={currentUser}
                    currentCondition={conditionForPotionModal}
                    onClose={() => setShowConditionPotionModal(false)}
                    onConfirm={(potionType) => {
                        if (!tournament?.type) {
                            return Promise.resolve({ error: tt('tournamentNotFound') });
                        }
                        return onAction({
                            type: 'USE_CONDITION_POTION',
                            payload: { tournamentType: tournament.type, potionType },
                        }) as Promise<{ error?: string } | void>;
                    }}
                    isTopmost={true}
                />
            )}
            {championshipInventoryFullMessage &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[403] flex items-center justify-center bg-black/70 p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="championship-inventory-full-title"
                        onClick={() => setChampionshipInventoryFullMessage(null)}
                    >
                        <div
                            className="max-w-md w-full rounded-2xl border border-rose-400/45 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-5 shadow-2xl ring-1 ring-rose-300/20"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 id="championship-inventory-full-title" className="text-lg font-black text-rose-100">
                                인벤토리 공간 부족
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-200">{championshipInventoryFullMessage}</p>
                            <div className="mt-5 flex justify-end">
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className={championshipFooterPrimaryButton}
                                    onClick={() => setChampionshipInventoryFullMessage(null)}
                                >
                                    확인
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {showMobileChampionshipRewardModal &&
                isMobile &&
                isDungeonChampionshipVenue &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[401] flex items-end justify-center bg-black/70 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="championship-mobile-reward-modal-title"
                        onClick={() => setShowMobileChampionshipRewardModal(false)}
                    >
                        <div
                            className="flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-violet-400/35 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl ring-1 ring-violet-300/15"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-violet-400/25 px-4 py-3">
                                <h2
                                    id="championship-mobile-reward-modal-title"
                                    className="text-base font-black text-violet-100"
                                >
                                    보상 정보
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowMobileChampionshipRewardModal(false)}
                                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
                                >
                                    닫기
                                </button>
                            </div>
                            <div
                                className="min-h-0 flex-1 overflow-y-auto p-3"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                <FinalRewardPanel
                                    tournamentState={displayTournament}
                                    rewardsSourceTournament={tournament ?? null}
                                    currentUser={currentUser}
                                    onAction={onAction}
                                    onCompleteDungeon={handleCompleteDungeon}
                                    dungeonRewardAlreadyRequested={dungeonStageRewardRequested}
                                    onDungeonRewardRequested={() => setDungeonStageRewardRequested(true)}
                                    onOpenRewardHistory={handleOpenRewardHistory}
                                    layoutVariant="mobileTab"
                                    suppressBottomActions
                                    suppressClaimActions
                                    suppressSideActionButtons
                                />
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {showMobileChampionshipResultModal &&
                isMobile &&
                isDungeonChampionshipVenue &&
                showChampionshipMatchResultPanel &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[401] flex items-end justify-center bg-black/70 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="championship-mobile-result-modal-title"
                        onClick={dismissMobileChampionshipResultModal}
                    >
                        <div
                            className="flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl ring-1 ring-amber-300/15"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-amber-400/25 px-4 py-3">
                                <h2
                                    id="championship-mobile-result-modal-title"
                                    className="text-base font-black text-amber-100"
                                >
                                    경기 결과
                                </h2>
                                <button
                                    type="button"
                                    onClick={dismissMobileChampionshipResultModal}
                                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
                                >
                                    닫기
                                </button>
                            </div>
                            <div
                                className="min-h-0 flex-1 overflow-y-auto p-3"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                <ChampionshipMatchResultPanel
                                    match={matchForDisplay}
                                    currentUser={currentUser}
                                    tournamentFinished={championshipFinished}
                                    tournamentForResult={displayTournament}
                                    finalStandings={championshipFinalStandingsRows}
                                    compact
                                />
                            </div>
                            <div className="shrink-0 border-t border-amber-400/20 px-3 py-3">
                                {(() => {
                                    const modalActionFb = '!text-sm !py-2.5 w-full';
                                    const modalPrimaryAction = renderChampionshipClaimRewardAction(
                                        modalActionFb,
                                        dismissMobileChampionshipResultModal,
                                    );
                                    if (modalPrimaryAction) {
                                        return (
                                            <div className="flex w-full flex-col gap-2">
                                                {modalPrimaryAction}
                                                <button
                                                    type="button"
                                                    onClick={dismissMobileChampionshipResultModal}
                                                    className={`w-full ${championshipFooterSecondaryButton} !text-sm !py-2`}
                                                >
                                                    닫기
                                                </button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            type="button"
                                            onClick={dismissMobileChampionshipResultModal}
                                            className={`w-full ${championshipFooterPrimaryButton} !text-sm !py-2.5`}
                                        >
                                            확인
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {showChampionshipLowConditionStartModal &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[402] flex items-center justify-center bg-black/70 p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="championship-low-condition-start-title"
                        onClick={() => setShowChampionshipLowConditionStartModal(false)}
                    >
                        <div
                            className="max-w-md w-full rounded-2xl border border-amber-400/40 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-5 shadow-2xl ring-1 ring-amber-300/15"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 id="championship-low-condition-start-title" className="text-lg font-black text-amber-100">
                                컨디션 안내
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-200">
                                컨디션이 안좋습니다. 컨디션은 좋은수 또는 실수 확률에 영향을 줍니다. 그래도 그냥 경기를 시작하시겠습니까?
                            </p>
                            <div className="mt-5 flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className={championshipFooterMutedButton}
                                    onClick={() => setShowChampionshipLowConditionStartModal(false)}
                                >
                                    취소
                                </Button>
                                {showConditionRecoveryButton ? (
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        className={`border border-emerald-400/50 bg-emerald-800/90 text-emerald-50 hover:brightness-110 !py-2 !px-4 ${
                                            !canUseConditionPotion ? 'cursor-not-allowed opacity-50' : ''
                                        }`}
                                        disabled={!canUseConditionPotion}
                                        onClick={() => {
                                            if (!canUseConditionPotion) return;
                                            setShowChampionshipLowConditionStartModal(false);
                                            setShowConditionPotionModal(true);
                                        }}
                                    >
                                        컨디션 조절
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className={championshipFooterPrimaryButton}
                                    onClick={() => {
                                        setShowChampionshipLowConditionStartModal(false);
                                        setChampionshipSidebarTab('commentary');
                                        finalizeChampionshipDungeonMatchStart();
                                    }}
                                >
                                    그래도 시작
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {dungeonStageSummaryData && (() => {
                const modalProps: DungeonStageSummaryModalProps = {
                    dungeonType: dungeonStageSummaryData.dungeonType,
                    stage: dungeonStageSummaryData.stage,
                    tournamentState: dungeonStageSummaryData.tournamentState,
                    userRank: dungeonStageSummaryData.userRank,
                    wins: dungeonStageSummaryData.wins,
                    losses: dungeonStageSummaryData.losses,
                    baseRewards: dungeonStageSummaryData.baseRewards,
                    rankReward: dungeonStageSummaryData.rankReward,
                    grantedEquipmentDrops: dungeonStageSummaryData.grantedEquipmentDrops,
                    nextStageUnlocked: dungeonStageSummaryData.nextStageUnlocked,
                    nextStageWasAlreadyUnlocked: dungeonStageSummaryData.nextStageWasAlreadyUnlocked,
                    onClose: () => setDungeonStageSummaryData(null),
                    isTopmost: true,
                };
                return <DungeonStageSummaryModal {...modalProps} />;
            })()}
        </div>
    );
};