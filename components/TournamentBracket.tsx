import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus, TournamentState, PlayerForTournament, ServerAction, User, CoreStat, Match, Round, CommentaryLine, TournamentType, LeagueTier, GameMode, Player } from '../types.js';
import Button from './Button.js';
import { useButtonClickThrottle } from '../hooks/useButtonClickThrottle.js';
import { useTournamentSimulation, type ChampionshipPlaybackSpeed } from '../hooks/useTournamentSimulation.js';
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
    EQUIPMENT_GRADE_LABEL_KO,
    getChampionshipArenaBackgroundUrl,
} from '../constants';
import { getDungeonRankRewardForDisplay, getDungeonRankRewardRangeForDisplay, formatDungeonChampCoinRewardPreviewLabel } from '../shared/constants/tournaments';
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
    resolveChampionshipDungeonPlaybackSpeedChoices,
    type ChampionshipAbilityKataLadderRow,
} from '../shared/constants/championshipRealMatch.js';
import { championshipCapturesAtPly } from '../utils/championshipLiveScores.js';
import { replaceAppHash } from '../utils/appUtils.js';

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
        nickname: p.nickname ?? '선수',
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
                    선수 정보를 불러오는 중 오류가 발생했습니다.
                </div>
            );
        }

        return this.props.children;
    }
}

const ChampionshipRealGoBoard: React.FC<{
    match: Match | null;
    currentUser: UserWithStatus;
    tournamentFinished?: boolean;
    tournamentForResult?: TournamentState | null;
    /** 던전 경기장: 바둑판 중앙 안내(카타 로딩·경기 전 대기) */
    dungeonBoardCenterMode?: 'deep_breath' | 'players_entering' | null;
    /** 모든 경기 종료 후 최종 순위표 */
    finalStandings?: ChampionshipDungeonStandingRow[] | null;
}> = ({
    match,
    currentUser,
    tournamentFinished = false,
    tournamentForResult = null,
    dungeonBoardCenterMode = null,
    finalStandings = null,
}) => {
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
        return realGame.boardState;
    }, [realGame?.boardState, realGame?.boardSize, realGame?.currentPly, realGame?.status]);

    if (!realGame) {
        const fallbackText = tournamentFinished
            ? '경기가 모두 종료되었습니다. 시상식이 치뤄지고 있습니다.'
            : dungeonBoardCenterMode === 'deep_breath'
              ? '대회에 참가하기 위해 심호흡을 하고있습니다.'
              : dungeonBoardCenterMode === 'players_entering'
                ? '선수들이 입장하고 있습니다. 잠시만 기다려주세요.'
                : '경기장에 선수들이 입장하고 있습니다. 잠시만 기다려 주세요.';
        return (
            <div className="flex h-full w-full items-center justify-center bg-transparent px-4 text-center text-sm text-slate-300/85">
                <span>{fallbackText}</span>
            </div>
        );
    }

    const blackName = match?.players.find(p => p?.id === realGame.blackPlayerId)?.nickname ?? '흑';
    const whiteName = match?.players.find(p => p?.id === realGame.whitePlayerId)?.nickname ?? '백';
    const isFreshBeforePlayback = (realGame.currentPly ?? 0) === 0 && realGame.status !== 'finished';
    const lastMoveForDisplay = isFreshBeforePlayback ? null : realGame.lastMove;
    const moveHistoryForDisplay = isFreshBeforePlayback ? [] : realGame.moves;

    // 매 경기 종료 후 다음 경기를 누르기 전까지 결과 카드를 바둑판 위에 띄워, 어떤 결과로 끝났는지 한눈에 확인할 수 있게 한다.
    const showFinishedResult = realGame.status === 'finished' && !!match?.isFinished && !!realGame.winnerId;
    const finishedScoreLeadAbs = showFinishedResult
        ? Math.abs(realGame.finalScore?.scoreLead ?? 0)
        : 0;

    // 결과 카드에 노출할 부가 정보(회차/라운드, 양 선수 프로필, 누적 승패, 다음 안내) 계산
    const userWonThisMatch = !!realGame.winnerId && realGame.winnerId === currentUser.id;
    const userInMatch =
        match?.players.find(p => p?.id === currentUser.id) ?? null;
    const opponentInMatch =
        match?.players.find(p => p && p.id !== currentUser.id) ?? null;

    const userRecord = dungeonUserMatchRecordForPlayer(tournamentForResult, currentUser.id, match);
    const opponentRecord = opponentInMatch
        ? dungeonUserMatchRecordForPlayer(tournamentForResult, opponentInMatch.id, match)
        : { wins: 0, losses: 0 };

    const userAvatarUrl = userInMatch?.avatarId
        ? AVATAR_POOL.find(a => a.id === userInMatch.avatarId)?.url
        : undefined;
    const userBorderUrl = userInMatch?.borderId
        ? BORDER_POOL.find(b => b.id === userInMatch.borderId)?.url
        : undefined;
    const opponentAvatarUrl = opponentInMatch?.avatarId
        ? AVATAR_POOL.find(a => a.id === opponentInMatch.avatarId)?.url
        : undefined;
    const opponentBorderUrl = opponentInMatch?.borderId
        ? BORDER_POOL.find(b => b.id === opponentInMatch.borderId)?.url
        : undefined;

    const roundLabel = (() => {
        if (!tournamentForResult || !match) return '';
        for (const r of tournamentForResult.rounds) {
            if (r.matches.some(m => m.id === match.id)) return r.name ?? '';
        }
        return '';
    })();

    // 마지막 경기가 끝난 다음에는 "다음 경기" 버튼이 없으므로 보상 수령 안내로 바꿔 표시한다.
    const nextActionMessage = tournamentFinished
        ? '"보상받기" 버튼을 눌러 보상을 수령하세요.'
        : '"다음 경기" 버튼을 눌러 진행해 주세요.';

    const finalStandingsCount = finalStandings?.length ?? 0;
    const finalStandingsListClass =
        finalStandingsCount > 6
            ? 'grid grid-cols-2 gap-x-1.5 gap-y-0.5 sm:gap-x-2'
            : 'flex flex-col gap-0.5';
    const finalStandingsTextClass = finalStandingsCount > 12 ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-[11px]';

    return (
        <div
            className={`championship-real-board relative flex h-full w-full items-center justify-center ${
                showFinishedResult ? 'overflow-visible' : 'overflow-hidden'
            }`}
        >
            {/* 오버레이를 바둑판 정사각형 영역 안에 두어 계가 연출이 바둑판 위로 정확히 덮이도록 한다. */}
            <div
                className={`relative aspect-square h-full max-h-full max-w-full ${
                    showFinishedResult ? 'overflow-visible' : 'overflow-hidden'
                }`}
            >
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
                    gameStatus={realGame.status === 'scoring' ? 'scoring' : 'playing'}
                    currentPlayer={moveHistoryForDisplay.length % 2 === 0 ? Player.Black : Player.White}
                    showLastMoveMarker
                    currentUser={currentUser}
                    blackPlayerNickname={blackName}
                    whitePlayerNickname={whiteName}
                    isItemModeActive={false}
                    moveHistory={moveHistoryForDisplay}
                    captures={{ [Player.Black]: 0, [Player.White]: 0 }}
                />
                {realGame.status === 'scoring' && (
                    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
                        {/* 좌→우로 채워지는 어두운 베일 (계가 연출의 본판) — 바둑판 정사각형 영역만 덮는다 */}
                        <div className="championship-scoring-veil absolute inset-0" aria-hidden />
                        {/* 베일의 진행 끝에서 빛나는 좌→우 스캔 빔 */}
                        <div className="championship-scoring-beam absolute inset-y-0" aria-hidden />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-2xl border border-cyan-300/60 bg-slate-950/80 px-5 py-2.5 text-center shadow-2xl backdrop-blur-sm">
                                <div className="text-base font-bold tracking-wide text-cyan-200">계가 중...</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* 경기 종료 카드는 바둑판 정사각형 밖(경기장 전체)에 두어 최종 순위가 잘리지 않게 한다. */}
            {showFinishedResult && (
                <div className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center overflow-visible p-1.5 sm:p-2">
                    <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1.5px]" aria-hidden />
                    <div className="relative z-[1] flex w-full max-w-full items-center justify-center px-1 sm:px-2">
                        <div className="championship-finished-result-card pointer-events-auto max-w-[min(100%,min(92vw,30rem))] rounded-2xl border-2 border-amber-300/70 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-black/95 px-3 py-2.5 text-center shadow-[0_18px_42px_-12px_rgba(0,0,0,0.85)] ring-1 ring-amber-300/15 sm:px-5 sm:py-3.5">
                            <div className="flex items-center justify-center gap-2">
                                {roundLabel && (
                                    <span className="rounded-full border border-amber-300/65 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-100">
                                        {roundLabel}
                                    </span>
                                )}
                                <span className="text-[10px] font-black tracking-[0.32em] text-amber-200/80">FINAL RESULT</span>
                            </div>

                            <div className="mt-2 flex items-center justify-center gap-2 sm:mt-2.5 sm:gap-3">
                                <div className="flex w-[5rem] flex-col items-center sm:w-[5.6rem]">
                                    <div className="relative h-11 w-11 sm:h-12 sm:w-12">
                                        {userAvatarUrl ? (
                                            <img
                                                src={userAvatarUrl}
                                                alt={userInMatch?.nickname ?? '유저'}
                                                className={`h-full w-full rounded-full border-2 object-cover ${userWonThisMatch ? 'border-emerald-300/85' : 'border-rose-300/85'}`}
                                            />
                                        ) : (
                                            <div
                                                className={`flex h-full w-full items-center justify-center rounded-full border-2 bg-slate-700 text-sm font-bold text-slate-100 ${userWonThisMatch ? 'border-emerald-300/85' : 'border-rose-300/85'}`}
                                            >
                                                {userInMatch?.nickname?.[0] ?? '나'}
                                            </div>
                                        )}
                                        {userBorderUrl && (
                                            <img src={userBorderUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full" />
                                        )}
                                    </div>
                                    <div className="mt-0.5 max-w-full truncate text-[10px] font-bold text-slate-100 sm:mt-1 sm:text-[11px]">
                                        {userInMatch?.nickname ?? '나'}
                                    </div>
                                    <div className="text-[9px] font-semibold text-emerald-200/85 sm:text-[10px]">
                                        대회 {userRecord.wins}승 <span className="text-rose-200/85">{userRecord.losses}패</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center">
                                    <div className={`text-base font-black leading-tight sm:text-lg ${userWonThisMatch ? 'text-emerald-200' : 'text-rose-200'}`}>
                                        {userWonThisMatch ? '승리' : '패배'}
                                    </div>
                                    <div className="mt-0.5 text-[9px] font-bold text-slate-300 sm:text-[10px]">
                                        {finishedScoreLeadAbs > 0 ? `${finishedScoreLeadAbs.toFixed(1)}집 차` : '백병전'}
                                    </div>
                                </div>

                                <div className="flex w-[5rem] flex-col items-center sm:w-[5.6rem]">
                                    <div className="relative h-11 w-11 sm:h-12 sm:w-12">
                                        {opponentAvatarUrl ? (
                                            <img
                                                src={opponentAvatarUrl}
                                                alt={opponentInMatch?.nickname ?? '상대'}
                                                className={`h-full w-full rounded-full border-2 object-cover ${userWonThisMatch ? 'border-rose-300/85' : 'border-emerald-300/85'}`}
                                            />
                                        ) : (
                                            <div
                                                className={`flex h-full w-full items-center justify-center rounded-full border-2 bg-slate-700 text-sm font-bold text-slate-100 ${userWonThisMatch ? 'border-rose-300/85' : 'border-emerald-300/85'}`}
                                            >
                                                {opponentInMatch?.nickname?.[0] ?? '상'}
                                            </div>
                                        )}
                                        {opponentBorderUrl && (
                                            <img src={opponentBorderUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full" />
                                        )}
                                    </div>
                                    <div className="mt-0.5 max-w-full truncate text-[10px] font-bold text-slate-100 sm:mt-1 sm:text-[11px]">
                                        {opponentInMatch?.nickname ?? '상대'}
                                    </div>
                                    <div className="text-[9px] font-semibold text-emerald-200/85 sm:text-[10px]">
                                        대회 {opponentRecord.wins}승 <span className="text-rose-200/85">{opponentRecord.losses}패</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 text-[10px] font-semibold text-cyan-200/85 sm:mt-2.5 sm:text-[11px]">{nextActionMessage}</div>

                            {tournamentFinished && finalStandings && finalStandings.length > 0 ? (
                                <div className="mt-2 w-full max-w-[min(100%,32rem)] border-t border-amber-300/25 pt-2 text-left sm:mt-3 sm:pt-2.5">
                                    <div className="text-center text-[9px] font-black tracking-[0.22em] text-amber-200/90 sm:text-[10px] sm:tracking-[0.28em]">
                                        최종 결과 · 순위
                                    </div>
                                    <ul className={`mt-1.5 w-full ${finalStandingsListClass} ${finalStandingsTextClass} leading-snug`}>
                                        {finalStandings.map((row) => (
                                            <li
                                                key={row.playerId}
                                                className={`flex items-center justify-between gap-1 rounded-md border px-1.5 py-0.5 sm:gap-2 sm:px-2 sm:py-1 ${
                                                    row.playerId === currentUser.id
                                                        ? 'border-cyan-400/50 bg-cyan-950/40 text-cyan-50'
                                                        : 'border-slate-600/40 bg-slate-900/50 text-slate-200'
                                                }`}
                                            >
                                                <span className="shrink-0 font-black tabular-nums text-amber-200">{row.rank}위</span>
                                                <span className="min-w-0 flex-1 truncate font-bold">{row.nickname}</span>
                                                <span className="shrink-0 tabular-nums text-slate-300">
                                                    {row.wins}승 {row.losses}패
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const CHAMPIONSHIP_PHASE_META = [
    { key: 'opening' as const, label: '초반', ply19: 1, ply13: 1, ply9: 1 },
    { key: 'midgame' as const, label: '중반', ply19: 61, ply13: 31, ply9: 15 },
    { key: 'endgame' as const, label: '종반', ply19: 121, ply13: 61, ply9: 29 },
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


const ChampionshipAbilityPlayerPanel: React.FC<{
    player: PlayerForTournament | null;
    stats: Record<string, number>;
    match: Match | null;
    currentPhase: 'early' | 'mid' | 'end' | 'none';
    tone: 'blue' | 'rose';
    sideLabel: string;
    abilityKataLadder: readonly ChampionshipAbilityKataLadderRow[];
}> = ({ player, stats, match, currentPhase, tone, sideLabel, abilityKataLadder }) => {
    const realGame = match?.championshipRealGame;
    const boardSize = realGame?.boardSize ?? 19;
    const activePhaseKey =
        currentPhase === 'early' ? 'opening' : currentPhase === 'mid' ? 'midgame' : currentPhase === 'end' ? 'endgame' : null;
    const accentTone =
        tone === 'blue'
            ? 'border-blue-300/45 bg-gradient-to-br from-[#1e3a5f] via-[#13253f] to-[#07111f] text-blue-50 ring-blue-300/15'
            : 'border-rose-300/45 bg-gradient-to-br from-[#5f1e33] via-[#351724] to-[#14070c] text-rose-50 ring-rose-300/15';
    const statCardTone =
        tone === 'blue'
            ? 'border-blue-300/35 from-[#172c48] via-[#0e1b2d] to-[#050911]'
            : 'border-rose-300/35 from-[#481724] via-[#250d15] to-[#090406]';
    const phaseRowActiveClass = (phaseKey: (typeof CHAMPIONSHIP_PHASE_META)[number]['key']): string => {
        if (activePhaseKey !== phaseKey) return 'border-slate-600/45 bg-black/24';
        if (phaseKey === 'opening') {
            return tone === 'blue'
                ? 'border-cyan-300/55 bg-gradient-to-r from-cyan-600/28 to-sky-900/35 ring-1 ring-cyan-400/25'
                : 'border-cyan-300/45 bg-gradient-to-r from-cyan-700/22 to-rose-950/40 ring-1 ring-cyan-300/20';
        }
        if (phaseKey === 'midgame') {
            return tone === 'blue'
                ? 'border-fuchsia-300/50 bg-gradient-to-r from-fuchsia-600/26 to-indigo-950/38 ring-1 ring-fuchsia-400/22'
                : 'border-fuchsia-300/45 bg-gradient-to-r from-fuchsia-700/24 to-rose-950/42 ring-1 ring-fuchsia-300/20';
        }
        return tone === 'blue'
            ? 'border-amber-300/50 bg-gradient-to-r from-amber-600/26 to-orange-950/38 ring-1 ring-amber-400/25'
            : 'border-amber-300/45 bg-gradient-to-r from-amber-700/24 to-rose-950/45 ring-1 ring-amber-300/22';
    };

    const phaseRowLabelClass = (phaseKey: (typeof CHAMPIONSHIP_PHASE_META)[number]['key']): string => {
        if (activePhaseKey !== phaseKey) return 'font-bold text-slate-500';
        if (phaseKey === 'opening') return 'font-bold text-cyan-100';
        if (phaseKey === 'midgame') return 'font-bold text-fuchsia-100';
        return 'font-bold text-amber-100';
    };

    const phaseRowValueClass = (phaseKey: (typeof CHAMPIONSHIP_PHASE_META)[number]['key']): string => {
        if (activePhaseKey !== phaseKey) return 'text-base font-black tabular-nums text-slate-500';
        if (phaseKey === 'opening') return 'text-base font-black tabular-nums text-cyan-50';
        if (phaseKey === 'midgame') return 'text-base font-black tabular-nums text-fuchsia-50';
        return 'text-base font-black tabular-nums text-amber-50';
    };

    const phaseBadgeClass =
        currentPhase === 'early'
            ? 'border-cyan-400/45 bg-cyan-950/55 text-cyan-100'
            : currentPhase === 'mid'
              ? 'border-fuchsia-400/45 bg-fuchsia-950/50 text-fuchsia-100'
              : currentPhase === 'end'
                ? 'border-amber-400/50 bg-amber-950/50 text-amber-100'
                : 'border-white/15 bg-black/28 text-slate-300';

    return (
        <aside className="flex h-fit max-h-full w-[165px] shrink-0 flex-col gap-2 self-start overflow-hidden rounded-xl border border-slate-700/35 bg-gradient-to-b from-[#111827] via-[#070b12] to-[#020305] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_42px_-22px_rgba(0,0,0,0.9)] xl:w-[185px]">
            <div className={`flex shrink-0 items-center justify-between rounded-lg border p-2 shadow-lg ring-1 ring-inset ${accentTone}`}>
                <div>
                    <div className="text-[13px] font-black tracking-wide text-amber-100">{sideLabel}</div>
                    <div className="mt-0.5 max-w-[7rem] truncate text-[11px] font-semibold text-slate-300">{player?.nickname ?? '선수'} 능력치</div>
                </div>
                <div className={`rounded-lg border px-2 py-1 text-[12px] font-black shadow-inner ${phaseBadgeClass}`}>
                    {currentPhase === 'early' ? '초반' : currentPhase === 'mid' ? '중반' : currentPhase === 'end' ? '종반' : '대기'}
                </div>
            </div>

            <div className={`grid shrink-0 grid-cols-2 gap-x-2 gap-y-1.5 rounded-lg border bg-gradient-to-b p-2.5 text-[11px] leading-tight shadow-lg ${statCardTone}`}>
                {CHAMPIONSHIP_CORE_STATS.map((stat) => {
                    const hi = currentPhase !== 'none' && KEY_STATS_BY_PHASE[currentPhase].includes(stat);
                    const ps = currentPhase !== 'none' ? CHAMPIONSHIP_PHASE_STAT_STYLE[currentPhase] : null;
                    return (
                        <React.Fragment key={stat}>
                            <span
                                className={`truncate font-semibold ${hi && ps ? `${ps.labelActive} font-bold` : 'text-slate-400'}`}
                            >
                                {stat}
                            </span>
                            <span
                                className={`text-right text-[12px] font-black tabular-nums ${hi && ps ? `${ps.valueActive}` : 'text-slate-50'}`}
                            >
                                {Math.round(stats?.[stat] ?? 0)}
                            </span>
                        </React.Fragment>
                    );
                })}
            </div>

            <div className={`shrink-0 rounded-lg border bg-gradient-to-b p-2.5 shadow-lg ${statCardTone}`}>
                <div className="space-y-2">
                    {CHAMPIONSHIP_PHASE_META.map((phase) => {
                        const ply = championshipPhaseMetaPly(boardSize, phase);
                        const fromSnapshot = player?.id ? realGame?.phaseStatsByPlayerId?.[player.id]?.[phase.key] : undefined;
                        const computed =
                            fromSnapshot ?? championshipKataLevelForPly(ply, stats as any, undefined, abilityKataLadder);
                        return (
                            <div
                                key={phase.key}
                                className={`rounded-lg border px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${phaseRowActiveClass(phase.key)}`}
                            >
                                <div className="flex items-center justify-between gap-2 text-[12px]">
                                    <span className={phaseRowLabelClass(phase.key)}>{phase.label}</span>
                                    <span className={phaseRowValueClass(phase.key)}>{computed.abilityScore}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
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
            tone="blue"
            sideLabel="챔피언십 능력치"
            abilityKataLadder={abilityKataLadder}
        />
        <ChampionshipAbilityPlayerPanel
            player={p2}
            stats={p2Stats}
            match={match}
            currentPhase={currentPhase}
            tone="rose"
            sideLabel="챔피언십 능력치"
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
                .filter(item => item.type === 'consumable' && item.name.startsWith('컨디션회복제'))
                .forEach(item => {
                    if (item.name === '컨디션회복제(소)') {
                        counts.small += item.quantity || 1;
                    } else if (item.name === '컨디션회복제(중)') {
                        counts.medium += item.quantity || 1;
                    } else if (item.name === '컨디션회복제(대)') {
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
        return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">선수 대기 중...</div>;
    }
    
    // player가 확실히 존재하므로 안전하게 접근 가능
    // 하지만 경기 종료 시점에 player 객체의 속성이 예상치 못하게 변경될 수 있으므로
    // 모든 접근을 안전하게 처리
    const playerId = player?.id;
    const playerNickname = player?.nickname;

    /** 토너먼트 객체에 컨디션이 아직 안 실렸을 때(1000) 스냅샷·fallback으로 표시·회복제 판정 */
    const playerCondition = (() => {
        const c = player.condition;
        if (c !== undefined && c !== null && c !== 1000) {
            return c;
        }
        if (
            isCurrentUser &&
            conditionFallback !== undefined &&
            conditionFallback !== null &&
            conditionFallback !== 1000
        ) {
            return conditionFallback;
        }
        if (c !== undefined && c !== null) {
            return c;
        }
        return 1000;
    })();

    // 모든 필수 값이 유효한지 확인
    if (!playerId || !playerNickname) {
        return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">선수 정보를 불러올 수 없습니다.</div>;
    }

    /** Avatar.tsx 이미지 테두리 최대 배율(링 1.5)과 동일 — 슬롯을 맞춰 양쪽 패널 능력치 행이 수평으로 정렬되게 함 */
    const avatarSizePx = isMobile ? 40 : 32;
    const avatarSlotRem = (avatarSizePx / 16) * 1.5;
    const totalGames = cumulativeStats.wins + cumulativeStats.losses;
    const winRateLine =
        totalGames === 0
            ? '전적 없음'
            : `${((100 * cumulativeStats.wins) / totalGames).toFixed(1)}% (${cumulativeStats.wins}승 ${cumulativeStats.losses}패)`;
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
                    title={isClickable ? `${playerNickname} 프로필 보기` : ''}
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
                                ['status', '상태정보'],
                                ['abilities', '능력수치'],
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
                            <span className="shrink-0 text-[10px] font-semibold text-gray-400">컨디션</span>
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
                                {isCurrentUser && isUserMatch && canUseConditionPotion && onUseConditionPotion && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (playerCondition >= 100) return;
                                            onUseConditionPotion();
                                        }}
                                        disabled={playerCondition >= 100}
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-colors ${
                                            playerCondition >= 100
                                                ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                        title={
                                            playerCondition >= 100
                                                ? '컨디션이 이미 최대입니다'
                                                : '컨디션 회복제 사용 (경기 진행 중에는 불가)'
                                        }
                                    >
                                        +
                                    </button>
                                )}
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
                                    <span className="shrink-0 font-semibold text-gray-300">바둑능력</span>
                                    <span className="truncate text-right font-mono font-bold text-blue-300 tabular-nums">{totalAbilityScore}</span>
                                </div>
                                <div className={rowClass}>
                                    <span className="shrink-0 font-semibold text-gray-300">승률</span>
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
                                    const label = pk === 'early' ? '초반능력' : pk === 'mid' ? '중반능력' : '종반능력';
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
        <div className={`flex h-full min-h-0 flex-col gap-1 rounded-lg border border-gray-600/55 bg-slate-950/90 p-2 ${isClickable ? 'cursor-pointer hover:bg-slate-800/95' : ''}`} onClick={isClickable ? () => onViewUser(playerId) : undefined} title={isClickable ? `${playerNickname} 프로필 보기` : ''} style={{ maxHeight: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
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
                        <span className={`${isMobile ? 'text-xs' : 'text-xs'} text-blue-300 font-semibold whitespace-nowrap`}>바둑능력: {totalAbilityScore}</span>
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 truncate`}>({cumulativeStats.wins}승 {cumulativeStats.losses}패)</p>
                 </div>
            </div>
            {/* 컨디션 표시 영역 - 항상 동일한 공간 유지 (대회 종료·탈락 후에는 숨김) */}
            <div className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} mt-0 relative flex items-center gap-2 w-full justify-center flex-shrink-0`} style={{ 
                visibility: showConditionInStatus ? 'visible' : 'hidden',
                height: showConditionInStatus ? 'auto' : '1.25rem',
                minHeight: '1.25rem'
            }}>
                <span className={isMobile ? 'text-xs' : 'text-sm'}>컨디션:</span> 
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
                {isCurrentUser && isUserMatch && canUseConditionPotion && onUseConditionPotion && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (playerCondition >= 100) return;
                            onUseConditionPotion();
                        }}
                        disabled={playerCondition >= 100}
                        className={`ml-2 ${isMobile ? 'text-sm w-6 h-6' : 'text-base w-6 h-6'} ${
                            playerCondition >= 100 ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-green-600 hover:bg-green-700'
                        } text-white rounded-full transition-colors flex-shrink-0 flex items-center justify-center font-bold`}
                        title={playerCondition >= 100 ? "컨디션이 이미 최대입니다" : "컨디션 회복제 사용 (경기 진행 중에는 불가)"}
                    >
                        +
                    </button>
                )}
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
                            const label = pk === 'early' ? '초반능력' : pk === 'mid' ? '중반능력' : '종반능력';
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
        if (total === 0) return '전적 없음';
        return `${((100 * wins) / total).toFixed(1)}% (${wins}승 ${losses}패)`;
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

    const resolveCondition = (player: PlayerForTournament | null, isCurrentUser: boolean) => {
        const c = player?.condition;
        if (c !== undefined && c !== null && c !== 1000) return c;
        if (isCurrentUser && conditionFallback !== undefined && conditionFallback !== null && conditionFallback !== 1000) {
            return conditionFallback;
        }
        if (c !== undefined && c !== null) return c;
        return 1000;
    };

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
                        선수 대기 중
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
                        title={clickable ? `${player.nickname} 프로필 보기` : ''}
                    >
                        <div className="flex justify-center">
                            <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarPx} />
                        </div>
                    </div>
                    <div className="w-full px-0.5 text-center leading-tight">
                        <div className={`text-[11px] font-semibold whitespace-normal break-words sm:text-xs ${titleCls}`}>
                            {player.nickname}
                        </div>
                        {isCurrent ? <div className="text-[10px] font-semibold text-amber-300/90">나</div> : null}
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
                    title={clickable ? `${player.nickname} 프로필 보기` : ''}
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
                {isCurrent ? <span className="text-[0.82em] font-semibold text-amber-300/90">나</span> : null}
            </div>
        );
    };

    return (
        <section className="mb-0 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden overscroll-y-contain">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-panel-secondary/90 shadow-inner">
                <div className="grid shrink-0 grid-cols-2 gap-0.5 border-b border-cyan-500/20 px-1 py-1.5">
                    {(
                        [
                            ['status', '상태정보'],
                            ['abilities', '능력수치'],
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
                                                <div className="text-xs font-semibold text-stone-400">컨디션</div>
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
                                                    {canUseConditionPotion && p1?.id === currentUserId && isUserMatchP1 ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const c = p1 ? resolveCondition(p1, true) : 1000;
                                                                if (c >= 100) return;
                                                                onUseConditionPotion();
                                                            }}
                                                            disabled={!p1 || resolveCondition(p1, true) >= 100}
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                                                !p1 || resolveCondition(p1, true) >= 100
                                                                    ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                                    : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                            title={
                                                                p1 && resolveCondition(p1, true) >= 100
                                                                    ? '컨디션이 이미 최대입니다'
                                                                    : '컨디션 회복제 사용 (경기 진행 중에는 불가)'
                                                            }
                                                        >
                                                            +
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">바둑능력</div>
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
                                            <div className="text-xs font-semibold text-stone-400">승률 · 전적</div>
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
                                                <div className="text-xs font-semibold text-stone-400">컨디션</div>
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
                                                    {canUseConditionPotion && p2?.id === currentUserId && isUserMatchP2 ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const c = p2 ? resolveCondition(p2, true) : 1000;
                                                                if (c >= 100) return;
                                                                onUseConditionPotion();
                                                            }}
                                                            disabled={!p2 || resolveCondition(p2, true) >= 100}
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                                                !p2 || resolveCondition(p2, true) >= 100
                                                                    ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                                                    : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                            title={
                                                                p2 && resolveCondition(p2, true) >= 100
                                                                    ? '컨디션이 이미 최대입니다'
                                                                    : '컨디션 회복제 사용 (경기 진행 중에는 불가)'
                                                            }
                                                        >
                                                            +
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-md bg-black/25 px-2 py-2">
                                            <div className="text-xs font-semibold text-stone-400">바둑능력</div>
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
                                            <div className="text-xs font-semibold text-stone-400">승률 · 전적</div>
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
                                            const label = phase === 'early' ? '초반능력' : phase === 'mid' ? '중반능력' : '종반능력';
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
                                        <span className="text-stone-500">차이 </span>
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
                    title="초반전"
                />
                <div
                    className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${midStage}%` }}
                    title="중반전"
                />
                <div
                    className="h-full rounded-r-full bg-red-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${endStage}%` }}
                    title="끝내기"
                />
            </div>
            <div className={`flex text-gray-400 ${compact ? 'mt-0.5 text-[9px] leading-tight' : 'mt-1 text-xs'}`}>
                <div style={{ width: `${(earlyDuration / totalDuration) * 100}%` }}>초반</div>
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
                                        <div className="text-[9px] text-gray-500">흑</div>
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
                                        <div className="text-[9px] text-gray-500">백</div>
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
                                        <div className="text-[9px] text-gray-400">흑</div>
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
                                        <div className="text-[9px] text-gray-400">백</div>
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
                            title="중앙"
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
                                        <div className="truncate text-xs font-bold text-gray-200">흑: {p1Nickname}</div>
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
                                        <div className="mb-0.5 text-xs text-gray-400">흑</div>
                                        <div className="text-lg font-bold text-white">
                                            <span className="tabular-nums">{Math.round(p1DisplayScore)}</span>
                                            <span className="ml-1 text-xs text-gray-400">({p1Percent.toFixed(1)}%)</span>
                                        </div>
                                    </div>

                                    <div className="h-8 w-px bg-gray-600" />

                                    <div className="min-w-[70px] text-center" data-player="p2">
                                        <div className="mb-0.5 text-xs text-gray-400">백</div>
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
                                        <div className="truncate text-xs font-bold text-gray-200">백: {p2Nickname}</div>
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
                            title="중앙"
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
    if (text.startsWith('[경기 시작]')) {
        phaseColorClass = 'text-cyan-300';
    } else if (text.startsWith('초반전이 시작되었습니다')) {
        phaseColorClass = 'text-green-400'; // 초록색
    } else if (text.startsWith('중반전이 시작되었습니다')) {
        phaseColorClass = 'text-yellow-400'; // 노란색
    } else if (text.startsWith('종반전이 시작되었습니다')) {
        phaseColorClass = 'text-red-400'; // 빨간색
    }
    
    if (text.startsWith('최종 결과 발표!') || text.startsWith('[최종결과]') || text.startsWith('[최종계가]') || text.startsWith('[경기 결과]')) {
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
}> = ({ commentary, isSimulating, footerSlot, compact = false, emptyStateHint = null }) => {
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
                        경기 진행 중...
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
                    ) : (
                        <p
                            className={`flex h-full items-center justify-center text-center text-gray-500 ${
                                compact ? 'text-[11px]' : ''
                            }`}
                        >
                            {emptyStateHint ?? '경기 시작 대기 중...'}
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
    /** PC 우측 사이드바: 내부 스크롤. 모바일 보상정보 탭: 본문 전체를 탭에서 스크롤(PC와 동일 내용 노출) */
    layoutVariant?: 'sidebar' | 'mobileTab';
    /** 모바일 경기장: 보상·진행 버튼을 화면 하단 고정 바로만 표시 */
    suppressBottomActions?: boolean;
}> = ({
    tournamentState,
    rewardsSourceTournament,
    currentUser,
    onAction,
    onCompleteDungeon,
    dungeonRewardAlreadyRequested,
    onDungeonRewardRequested,
    onOpenRewardHistory,
    layoutVariant = 'sidebar',
    suppressBottomActions = false,
}) => {
    const isMobileTabLayout = layoutVariant === 'mobileTab';
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
    
    const rewardClaimedKey = `${type}RewardClaimed` as keyof User;
    const isClaimed = !!currentUser[rewardClaimedKey];
    const treatAsClaimed = isClaimed || !!dungeonRewardAlreadyRequested;
    const canClaimReward = (isTournamentFullyComplete || isUserEliminated) && !isClaimed && !dungeonRewardAlreadyRequested;
    
    // 중복 클릭 방지를 위한 상태
    const [isClaiming, setIsClaiming] = useState(false);

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

    const showSideActionsColumn = !isMobileTabLayout && !suppressBottomActions;

    const sideActionButtons = !suppressBottomActions ? (
        (isTournamentFullyComplete || isUserEliminated) && treatAsClaimed ? (
            <>
                {isDungeonMode && onCompleteDungeon && !isClaimed ? (
                    <button
                        onClick={onCompleteDungeon}
                        disabled={isClaiming}
                        className={`w-full ${championshipFooterPrimaryButton}`}
                    >
                        {isClaiming ? '처리 중...' : '보상 완료'}
                    </button>
                ) : (
                    <div className={`w-full text-center ${championshipFooterMutedButton}`}>
                        보상완료
                    </div>
                )}
                {onOpenRewardHistory && (
                    <button
                        onClick={onOpenRewardHistory}
                        className={`w-full ${championshipFooterSecondaryButton}`}
                    >
                        보상내역
                    </button>
                )}
            </>
        ) : !treatAsClaimed ? (
            <>
                {(isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt ? (
                    <button
                        onClick={handleClaim}
                        disabled={!canClaimReward || isClaiming}
                        className={`w-full ${
                            canClaimReward && !isClaiming
                                ? championshipFooterPrimaryButton
                                : championshipFooterMutedButton
                        }`}
                    >
                        {isClaiming ? '수령 중...' : (canClaimReward ? '보상받기' : '경기 종료 후 수령 가능')}
                    </button>
                ) : null}
                {onOpenRewardHistory && (
                    <button
                        onClick={onOpenRewardHistory}
                        className={`w-full ${championshipFooterSecondaryButton}`}
                    >
                        보상내역
                    </button>
                )}
                {(isInProgress || isRoundComplete) && !((isTournamentFullyComplete || isUserEliminated) && effectiveStageAttempt) && (
                    <div className="w-full rounded-lg border border-sky-500/35 bg-sky-950/55 px-2 py-1.5 text-center text-[10.5px] font-bold leading-tight text-sky-200">
                        모든 경기 완료 후 보상수령
                    </div>
                )}
            </>
        ) : null
    ) : null;

    return (
        <div
            className={`flex min-h-0 flex-col ${isMobileTabLayout ? 'h-auto w-full' : 'h-full'}`}
            style={
                isMobileTabLayout
                    ? { display: 'flex', flexDirection: 'column', minHeight: 0 }
                    : { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }
            }
        >
            <h4 className="flex-shrink-0 whitespace-nowrap py-0.5 text-center text-sm font-bold text-gray-300 mb-1.5">획득 보상</h4>
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
            {/* 수령 완료 메시지 - 경기 종료 후에만 표시 */}
            {(isTournamentFullyComplete || isUserEliminated) && treatAsClaimed && (
                <div className="mb-1 w-full px-1.5 py-1 bg-green-900/30 rounded-lg border border-green-700/50">
                    <p className="text-xs text-green-400 text-center font-semibold">✓ 보상을 수령했습니다.</p>
                </div>
            )}
            
            {/* 매 경기 누적 보상 + 순위 보상을 가로 한 줄에 함께 표시한다.
                각 토너먼트 타입의 경기 보상이 채워진 뒤 끝에 순위 보상 아이콘이 이어 붙는다. */}
            {(() => {
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
                        return [{ name: '변경권', quantity: n, image: '/images/use/change2.webp' }];
                    }
                    return [];
                })();
                const hasWorldChangeTickets = worldChangeTicketChips.length > 0;

                const champCoinsExactClaimed =
                    typeof claimedRewardSummary?.baseRewards?.champCoins === 'number'
                        ? claimedRewardSummary.baseRewards.champCoins
                        : undefined;
                let champWinsPreview = 0;
                if (champCoinsExactClaimed == null) {
                    for (const r of tournamentState.rounds || []) {
                        for (const m of r.matches || []) {
                            if (m.isFinished && m.isUserMatch && m.winner?.id === currentUser.id) {
                                champWinsPreview++;
                            }
                        }
                    }
                }
                const showChampCoinChip =
                    isDungeonMode &&
                    effectiveStageAttempt >= 1 &&
                    effectiveStageAttempt <= 10 &&
                    (type === 'neighborhood' || type === 'national' || type === 'world');

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
                        <div className={`flex w-full items-center justify-center ${isMobileTabLayout ? 'py-10' : 'h-full'}`}>
                            <p className="text-xs text-gray-400 text-center">획득한 보상이 없습니다.</p>
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
                    <div className={`mb-1 flex w-full flex-wrap items-center justify-center gap-1 ${isClaimed ? 'opacity-75' : ''}`}>
                        {/* 1) 동네바둑리그: 회차별 골드(수령 모달과 동일) */}
                        {hasNeighborhoodGold &&
                            neighborhoodGoldDisplay.map((goldAmount: number, idx: number) => (
                                <div
                                    key={`gold-${idx}`}
                                    className="relative w-11 h-11 rounded-lg border-2 border-yellow-600/70 bg-yellow-900/40 flex items-center justify-center overflow-hidden"
                                    title={
                                        matchGoldRewards && matchGoldRewards.length > 0
                                            ? `경기 ${idx + 1} 보상`
                                            : '획득 골드'
                                    }
                                >
                                    <img src="/images/icon/Gold.webp" alt="골드" className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
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
                                        title="라운드 합산 재료"
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
                                const label = EQUIPMENT_GRADE_LABEL_KO[gradeKey] ?? gradeKey;
                                const borderClass = EQUIP_GRADE_BORDER[gradeKey] || EQUIP_GRADE_BORDER.normal;
                                return (
                                    <div
                                        key={`drop-${gradeKey}-${di}`}
                                        className={`w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center ${borderClass}`}
                                        title={`${label} 장비`}
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

                        {/* PVE 공통: 챔프 코인 (완료 수령 시 확정, 그 전에는 단계 범위 + 현재 승) */}
                        {showChampCoinChip && (
                            <div
                                className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border-2 border-amber-400/70 bg-amber-950/45"
                                title={
                                    champCoinsExactClaimed != null
                                        ? `챔프 코인 ${champCoinsExactClaimed.toLocaleString('ko-KR')}개`
                                        : `챔프 코인: 단계별 무작위 + 승리 수 (현재 ${formatDungeonChampCoinRewardPreviewLabel(effectiveStageAttempt, champWinsPreview)})`
                                }
                            >
                                <img src="/images/icon/champcoin.webp" alt="" className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
                                <span className="absolute -bottom-0.5 -right-0.5 max-w-[2.75rem] truncate rounded-tl bg-black/80 px-0.5 text-[9px] font-bold leading-tight text-amber-100 shadow-sm">
                                    {champCoinsExactClaimed != null
                                        ? champCoinsExactClaimed.toLocaleString('ko-KR')
                                        : formatDungeonChampCoinRewardPreviewLabel(effectiveStageAttempt, champWinsPreview)}
                                </span>
                            </div>
                        )}

                        {/* 6) 순위 보상 — 매 경기 보상과 같은 줄에 이어 붙는다. 호화 amber 테두리로 시각적으로 구분 */}
                        {showRankReward && rankRewardForDisplay!.reward.items!.map((it, idx) => {
                            const row = it as { itemId: string; quantity?: number; min?: number; max?: number };
                            const itemName = row.itemId;
                            let src = '';
                            if (itemName.includes('골드')) src = '/images/icon/Gold.webp';
                            else if (itemName.includes('다이아')) src = '/images/icon/Zem.webp';
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
                                    ? itemName.includes('골드')
                                        ? formatGoldAmountKoG(row.min!)
                                        : row.min!.toLocaleString('ko-KR')
                                    : `${row.min}~${row.max}`
                                : row.quantity != null
                                  ? itemName.includes('골드')
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
                                    title={`${rankRewardForDisplay!.rank}위 순위 보상 · ${itemName} ×${qtyForTitle}`}
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
            })()}
            </div>

            {showSideActionsColumn && sideActionButtons ? (
                <div className="flex w-[7.2rem] shrink-0 flex-col items-stretch justify-center gap-1.5 self-stretch rounded-md border border-gray-700/45 bg-slate-950/72 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {sideActionButtons}
                </div>
            ) : null}
            </div>

            {/* 모바일 탭 레이아웃에서는 하단에 가로 배치 (모바일 sticky bar가 막혀있을 경우 대비) */}
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
            if (roundName === '16강') {
                return '8강 진출';
            } else if (roundName === '8강') {
                return '4강 진출';
            } else if (roundName === '4강') {
                return '결승 진출';
            } else if (roundName === '결승') {
                return '우승';
            } else if (roundName === '3,4위전') {
                return '3/4위전 진출';
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
            
            return `${matchNumber}차전 ${lastMatchWon ? '승리' : '패배'}! (${wins}승 ${losses}패)`;
        }
    };

    // 결승전 우승자 확인
    const isFinalMatch = useMemo(() => {
        if (!tournamentState) return false;
        const finalRound = tournamentState.rounds.find(r => r.name === '결승');
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
                if (!match.finalScore) return '승';
                const p1Percent = match.finalScore.player1;
                const diffPercent = Math.abs(p1Percent - 50) * 2;
                const scoreDiff = diffPercent / 2;
                const roundedDiff = Math.round(scoreDiff);
                const finalDiff = roundedDiff + 0.5;
                const winMargin = finalDiff < 0.5 ? '0.5' : finalDiff.toFixed(1);
                return `${winMargin}집 승`;
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
    const isFinalRound = name.includes('결승') || name.includes('3,4위전');
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
        return rounds.find(round => round.name === `${selectedRound}회차`);
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
            <h4 className={`flex-shrink-0 text-center font-bold text-gray-300 ${compact ? 'mb-1 text-xs' : 'mb-2'}`}>풀리그 대진표</h4>
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
                    {status === 'complete' ? '최종 순위' : '현재 순위'}
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
                                <div className={`italic text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>경기가 없습니다.</div>
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
                                         <span className="text-green-400">{stats.wins}승</span>
                                         <span className="text-gray-400">/</span>
                                         <span className="text-red-400">{stats.losses}패</span>
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
            availableTabs = ["16강", "8강", "4강전", "결승&3/4위전"];
        } else if (tournamentType === 'national') {
            availableTabs = ["8강", "4강전", "결승&3/4위전"];
        } else {
            return null;
        }

        const tabData = availableTabs.map((tabName): TabData => {
            let roundMatches: Match[] = [];
            let roundNames: string[] = [];
            if (tabName === "결승 및 3/4위전" || tabName === "결승&3/4위전") {
                roundNames = ["결승", "3,4위전"];
                roundMatches = (roundMap.get("결승") || []).concat(roundMap.get("3,4위전") || []);
            } else if (tabName === "4강전") {
                roundNames = ["4강"];
                roundMatches = roundMap.get("4강") || [];
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
                if (currentTabName === "8강") {
                    // 8강 탭에서 다음경기 버튼을 누르면 4강전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "4강전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === "4강전") {
                    // 4강전 탭에서 다음경기 버튼을 누르면 결승&3/4위전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "결승&3/4위전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                }
            }
            // 월드챔피언십
            else if (tournamentType === 'world') {
                if (currentTabName === "16강") {
                    // 16강 탭에서 다음경기 버튼을 누르면 8강 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "8강");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === "8강") {
                    // 8강 탭에서 다음경기 버튼을 누르면 4강전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "4강전");
                    if (nextTabIndex !== -1) {
                        setActiveTab(nextTabIndex);
                    }
                } else if (currentTabName === "4강전") {
                    // 4강전 탭에서 다음경기 버튼을 누르면 결승&3/4위전 탭으로 이동
                    const nextTabIndex = getRoundsForTabs.findIndex(tab => tab.name === "결승&3/4위전");
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
                        if (tab.name === "결승&3/4위전") {
                            return nextRound.name === "결승" || nextRound.name === "3,4위전";
                        } else if (tab.name === "4강전") {
                            return nextRound.name === "4강";
                        } else {
                            return tab.name === nextRound.name;
                        }
                    });
                    
                    if (targetTabIndex !== -1 && targetTabIndex !== activeTab) {
                        // 경기 종료 시점 또는 카운트다운 시작 시 즉시 탭 변경하여 대진표 업데이트
                        console.log(`[TournamentRoundViewer] 경기 종료/카운트다운 시작, 탭 변경: ${activeTab} -> ${targetTabIndex}, status: ${prevStatus.current} -> ${currentStatus}`);
                        setActiveTab(targetTabIndex);
                    }
                }
            }
        }
        
        prevStatus.current = currentStatus;
        prevNextRoundStartTime.current = nextRoundStartTime;
    }, [tournamentState?.status, nextRoundStartTime, getRoundsForTabs, tournamentState, rounds, activeTab]);

    if (!getRoundsForTabs) {
        const desiredOrder = ["16강", "8강", "4강", "3,4위전", "결승"];
        const sortedRounds = [...rounds].sort((a, b) => desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name));
        return (
            <div className="flex h-full min-h-0 flex-col">
                <h4 className={`flex-shrink-0 text-center font-bold text-gray-300 ${compact ? 'mb-1 text-xs' : 'mb-2'}`}>대진표</h4>
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
        
        const quarterFinals = roundMap.get("8강") || [];
        const semiFinals = roundMap.get("4강") || [];
        const final = roundMap.get("결승") || [];
        const thirdPlace = roundMap.get("3,4위전") || [];
        
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
            if (tab.name === "결승&3/4위전") {
                const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '결승');
                const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '3,4위전');
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
        if (tab.name === "결승 및 3/4위전") {
             const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '결승');
             const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '3,4위전');
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
                    name={tab.name}
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
            <h4 className={`flex-shrink-0 text-center font-bold text-gray-200 ${compact ? 'mb-1.5 text-sm' : 'mb-3 text-lg'}`}>대진표</h4>
            <div
                className={`flex flex-shrink-0 rounded-xl border border-gray-600/70 bg-gradient-to-r from-slate-950/95 to-slate-900/92 shadow-lg ${compact ? 'mb-2 p-0.5' : 'mb-3 p-1'}`}
            >
                {getRoundsForTabs.map((tab, index) => (
                    <button
                        key={tab.name}
                        onClick={() => setActiveTab(index)}
                        className={`flex-1 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                            compact ? 'py-1' : 'py-2'
                        } ${
                            tab.name === "결승&3/4위전"
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
                        {tab.name}
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
    
    // React 훅 규칙: 모든 훅은 조건문 밖에서 호출되어야 함
    const [lastUserMatchSgfIndex, setLastUserMatchSgfIndex] = useState<number | null>(null);
    const [initialMatchPlayers, setInitialMatchPlayers] = useState<{ p1: PlayerForTournament | null, p2: PlayerForTournament | null }>({ p1: null, p2: null });
    const [showConditionPotionModal, setShowConditionPotionModal] = useState(false);
    /** 던전 챔피언십: 컨디션 낮을 때 경기 시작 전 안내(회복제로 조절 가능) */
    const [showChampionshipLowConditionStartModal, setShowChampionshipLowConditionStartModal] = useState(false);
    const [showChampionshipExitConfirmModal, setShowChampionshipExitConfirmModal] = useState(false);
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

    const isChampionshipDungeonVenueForPotion = tournament?.currentStageAttempt != null;
    const canUseConditionPotion = useMemo(
        () =>
            Boolean(
                tournament?.rounds &&
                tournament?.status !== 'round_in_progress' &&
                tournament?.status !== 'complete' &&
                tournament?.status !== 'eliminated' &&
                !(isChampionshipDungeonVenueForPotion && championshipAwaitingKataLoad) &&
                (isChampionshipDungeonVenueForPotion
                    ? true
                    : tournament?.status === 'bracket_ready' &&
                          !tournament.rounds.some((r: { matches?: Array<{ isUserMatch?: boolean; isFinished?: boolean }> }) =>
                              r.matches?.some((m: { isUserMatch?: boolean; isFinished?: boolean }) => m.isUserMatch && m.isFinished)
                          ))
            ),
        [tournament?.rounds, tournament?.status, tournament?.currentStageAttempt, championshipAwaitingKataLoad]
    );

    const finalizeChampionshipDungeonMatchStart = useCallback(() => {
        const type = tournament?.type ?? 'neighborhood';
        if (championshipMatchStartLockRef.current || championshipAwaitingKataLoad) {
            return;
        }
        championshipMatchStartLockRef.current = true;
        setChampionshipAwaitingKataLoad(true);
        onAction({ type: 'START_TOURNAMENT_MATCH', payload: { type } });
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
                <p>토너먼트 정보를 불러오는 중입니다...</p>
            </div>
        );
    }
    
    // 안전성 검사: currentUser가 없으면 에러 메시지 표시
    if (!currentUser || !currentUser.id) {
        return (
            <div className="p-4 text-center">
                <p>사용자 정보를 불러오는 중입니다...</p>
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
            const currentRoundObj = safeRounds.find((r) => r.name === `${currentRound}회차`);
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
            console.log('[TournamentBracket] 토너먼트 상태:', tournament.status, '타입:', tournament.type, '현재 회차:', tournament.currentRoundRobinRound);
        }
    }, [tournament?.status, tournament?.type, tournament?.currentRoundRobinRound]);

    useEffect(() => {
        if (!currentUser?.id) return;
        if (import.meta.env.DEV) {
            console.log('[TournamentBracket] ENTER_TOURNAMENT_VIEW 호출');
        }
        onActionRef.current({ type: 'ENTER_TOURNAMENT_VIEW' });
        return () => {
            const t = displayTournamentRef.current;
            if (t?.status === 'round_in_progress') {
                void onActionRef.current({
                    type: 'SAVE_TOURNAMENT_PROGRESS',
                    payload: { type: t.type, tournamentSnapshot: t },
                });
            }
            if (import.meta.env.DEV) {
                console.log('[TournamentBracket] LEAVE_TOURNAMENT_VIEW 호출');
            }
            onActionRef.current({ type: 'LEAVE_TOURNAMENT_VIEW' });
        };
    }, [currentUser?.id]);

    // 자동 다음 경기 진행 로직
    useEffect(() => {
        // 안전성 검사: 필수 props와 데이터 확인
        if (!tournament || !onAction || !onStartNextRound || !Array.isArray(safeRounds)) {
            if (import.meta.env.DEV) {
                console.log('[TournamentBracket] useEffect 스킵 - 필수 데이터 없음:', {
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
            console.log('[TournamentBracket] 상태 변경:', prevStatus, '->', status, 'tournament.type:', tournament.type);
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
                    console.log(`[TournamentBracket] Countdown: ${secondsLeft}초 남음 (startTime: ${startTime}, now: ${now}, diff: ${timeUntilStart}ms)`);
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
                        const currentRoundObj = rounds.find(r => r.name === `${currentRound}회차`);
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
                                const parsed = parseInt(round.name.replace('회차', ''), 10);
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
                        const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
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
                        
                        console.log('[TournamentBracket] 선수 정보 업데이트:', { 
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
                        const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
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
                const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
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
        if (window.confirm('토너먼트를 포기하고 나가시겠습니까? 오늘의 참가 기회는 사라집니다.')) {
            onAction({ type: 'FORFEIT_TOURNAMENT', payload: { type: tournament.type } });
        }
    }, [onAction, tournament.type]);

    // 버튼 클릭 스로틀링 적용
    const { onClick: handleBackClick } = useButtonClickThrottle(handleBackClickRaw);
    const { onClick: handleForfeitClick } = useButtonClickThrottle(handleForfeitClickRaw);

    const handleChampionshipArenaExitClick = useCallback(() => {
        if (tournament.status === 'round_in_progress') {
            setShowChampionshipExitConfirmModal(true);
            return;
        }
        handleBackClickRaw();
    }, [tournament.status, handleBackClickRaw]);

    const confirmChampionshipArenaExitToLobby = useCallback(async () => {
        const t = tournament.type;
        setShowChampionshipExitConfirmModal(false);
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
            return currentSimMatch;
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
                const nextRoundObj = safeRounds.find(r => r.name === `${pendingRoundSwitchTo}회차`);
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
                    const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
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
    }, [isSimulating, currentSimMatch, tournament.status, tournament.nextRoundStartTime, tournament.type, safeRounds, lastFinishedUserMatch, pendingRoundSwitchTo]);

    useEffect(() => {
        if (!championshipAwaitingKataLoad) return;
        const rg = matchForDisplay?.championshipRealGame;
        if (rg && tournament?.status === 'round_in_progress') {
            championshipMatchStartLockRef.current = false;
            setChampionshipAwaitingKataLoad(false);
        }
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
        const tp = userPlayer.condition;
        if (tp !== undefined && tp !== null && tp !== 1000) return tp;
        const snap =
            tournament?.type && currentUser.dungeonConditionSnapshot?.[tournament.type]?.condition;
        if (snap !== undefined && snap !== null && snap !== 1000) return snap;
        return tp !== undefined && tp !== null ? tp : 1000;
    }, [userPlayer, tournament?.type, currentUser.dungeonConditionSnapshot]);

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
            const finalMatch = safeRounds.find(r => r.name === '결승');
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
                return `${winsCount}승 ${lossesCount}패! ${myRank}위`;
            }

            if (winner?.id === currentUser.id) return "🏆 우승!";

            const lastUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastUserMatch) {
                const roundOfLastMatch = safeRounds.find(r => r.matches.some(m => m.id === lastUserMatch.id));
                if (roundOfLastMatch?.name === '결승') return "준우승!";

                if (roundOfLastMatch?.name === '4강') {
                    const thirdPlaceMatch = safeRounds.flatMap(r => r.matches).find(m => {
                        const round = safeRounds.find(r => r.matches.some(match => match.id === m.id));
                        return m.isUserMatch && round?.name === '3,4위전';
                    });
                    if (thirdPlaceMatch) {
                        const won3rdPlace = thirdPlaceMatch.winner?.id === currentUser.id;
                        return won3rdPlace ? "3위" : "4위";
                    }
                }
                return `${roundOfLastMatch?.name || ''}에서 탈락`;
            }
            return "토너먼트 탈락";
        }

        if (tournament.status === 'round_complete' || tournament.status === 'bracket_ready') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch) {
                const userWonLastMatch = lastFinishedUserMatch.winner?.id === currentUser.id;
                if (tournament.type === 'neighborhood') {
                    const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                    const wins = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                    const losses = allMyMatches.length - wins;
                    return `${allMyMatches.length}차전 ${userWonLastMatch ? '승리' : '패배'}! (${wins}승 ${losses}패)`;
                } else if (userWonLastMatch) {
                    const nextUnplayedRound = safeRounds.find(r => r.matches.some(m => !m.isFinished && m.players.some(p => p?.id === currentUser.id)));
                    if (nextUnplayedRound) return `${nextUnplayedRound.name} 진출!`;
                }
            }
        }
        
        const currentRound = safeRounds.find(r => r.matches.some(m => m.isUserMatch && !m.isFinished));
        return currentRound ? `${currentRound.name} 진행 중` : "대회 준비 중";
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
                            ? '기능 VIP 활성화 후 사용할 수 있습니다.'
                            : !championshipDungeonSkipUi.canAttempt
                              ? '상대 정보를 준비하는 중입니다.'
                              : '남은 모든 라운드(유저 경기)를 한 번에 스킵하고 대회를 끝까지 진행합니다.'
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

    const renderFooterButton = () => {
        if (!tournament) return null;

        const { status } = tournament;

        if (status === 'round_in_progress') {
            return (
                <Button disabled colorScheme="none" className={championshipFooterMutedButton}>
                    경기 진행 중...
                </Button>
            );
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
            // 다음 경기의 선수 정보가 준비되었는지 확인
            let nextMatch: Match | undefined = undefined;
            if (tournament.type === 'neighborhood') {
                const currentRound = tournament.currentRoundRobinRound || 1;
                const currentRoundObj = safeRounds.find(r => r.name === `${currentRound}회차`);
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

            const buttonLabel = hasJustFinishedUserMatch ? '다음 경기' : '경기 시작';
            const isMatchStartBusy = isDungeonChampionship && championshipAwaitingKataLoad;

            if (isMatchStartBusy) {
                return (
                    <Button disabled colorScheme="none" className={championshipFooterMutedButton}>
                        경기 준비 중..
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
    
    // 자동 다음 경기 카운트다운 표시
    // 경기가 진행 중일 때는 "경기 진행 중..." 표시
    const countdownDisplay = tournament?.status === 'round_in_progress' ? (
        <div
            className={`flex items-center justify-center font-bold text-blue-400 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>경기 진행 중...</span>
        </div>
    ) : championshipAwaitingKataLoad ? (
        <div
            className={`flex items-center justify-center font-bold text-cyan-300 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>경기 준비 중..</span>
        </div>
    ) : autoNextCountdown !== null ? (
        <div
            className={`flex items-center justify-center font-bold text-yellow-400 ${isMobile ? 'gap-1 text-center text-xs leading-tight' : 'gap-2 text-lg'}`}
        >
            <span>
                다음 경기 준비중... {autoNextCountdown}
            </span>
        </div>
    ) : null;

    const desktopSkipSlot = !isMobile ? renderChampionshipSkipButton('!text-sm !py-2 !px-4') : null;

    const championshipAllMatchesFinished = displayTournament.rounds.every((r) => r.matches.every((m) => m.isFinished));
    const championshipFinished =
        displayTournament.status === 'complete' ||
        displayTournament.status === 'eliminated' ||
        (championshipAllMatchesFinished && displayTournament.status !== 'round_in_progress');

    const isDungeonChampionshipVenue = tournament.currentStageAttempt != null;

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

    const championshipCommentaryEmptyHint = useMemo(() => {
        if (!isDungeonChampionshipVenue) return null;
        if (championshipAwaitingKataLoad) {
            return '선수들이 입장하고 있습니다. 잠시만 기다려주세요.';
        }
        if (
            (tournament.status === 'bracket_ready' || tournament.status === 'round_complete') &&
            !matchForDisplay?.championshipRealGame
        ) {
            return '대회에 참가하기 위해 심호흡을 하고있습니다.';
        }
        return null;
    }, [
        isDungeonChampionshipVenue,
        championshipAwaitingKataLoad,
        tournament.status,
        matchForDisplay?.championshipRealGame,
    ]);

    const championshipDungeonExitVisible =
        tournament.currentStageAttempt != null && !championshipFinished;

    const desktopExitSlot =
        !isMobile && championshipDungeonExitVisible ? (
            <Button
                type="button"
                onClick={handleChampionshipArenaExitClick}
                colorScheme="none"
                className={`${championshipFooterExitButton} !text-sm !py-2 !px-4`}
                                title={
                    tournament.status === 'round_in_progress'
                        ? '로비로 나가도 저장 후 이어서 할 수 있습니다.'
                        : '경기장을 나갑니다.'
                }
            >
                나가기
            </Button>
        ) : null;

    const mobileChampionshipSkipSlot = isMobile ? renderChampionshipSkipButton('!text-xs !py-1.5 !px-3') : null;
    const mobileChampionshipExitSlot =
        isMobile && championshipDungeonExitVisible ? (
            <Button
                type="button"
                onClick={handleChampionshipArenaExitClick}
                colorScheme="none"
                className={`${championshipFooterExitButton} !text-xs !py-1.5 !px-3`}
                                title={
                    tournament.status === 'round_in_progress'
                        ? '로비로 나가도 저장 후 이어서 할 수 있습니다.'
                        : '경기장을 나갑니다.'
                }
            >
                나가기
            </Button>
        ) : null;

    // 배속 조절 — 던전 1~3단계는 x0.5·x1만, 4~5단계는 x0.5·x1·x2, 6단계 이상·비던전은 x3까지.
    const championshipPlaybackSpeedSelector = (
        <div className="mt-1.5 flex items-center justify-center gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-cyan-100/75">배속</span>
            {championshipDungeonPlaybackSpeedChoices.map((speed) => {
                const isActive = effectiveChampionshipPlaybackSpeed === speed;
                const titleBySpeed: Record<string, string> = {
                    '0.5': '3초에 한 수',
                    '1': '1.5초에 한 수',
                    '2': '1초에 한 수',
                    '3': '0.5초에 한 수',
                };
                return (
                    <button
                        key={speed}
                        type="button"
                        onClick={() => setChampionshipPlaybackSpeed(speed)}
                        title={titleBySpeed[String(speed)]}
                        className={`min-w-[2.4rem] rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-wider transition ${
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

    const renderChampionshipMatchControlPanel = () => (
        <section
            className={`flex min-h-0 flex-col justify-center rounded-2xl border border-cyan-300/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_16px_36px_-24px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-cyan-300/10 ${
                isMobile
                    ? 'bg-gradient-to-br from-[#27364a]/65 via-[#121a27]/50 to-[#070a10]/60 p-2 backdrop-blur-md'
                    : 'bg-gradient-to-br from-[#27364a] via-[#121a27] to-[#070a10] p-2.5'
            }`}
        >
            <div className={`text-center font-black tracking-[0.22em] text-cyan-100/85 ${isMobile ? 'mb-1 text-[9px]' : 'mb-1.5 text-[10px]'}`}>
                AUTO MATCH CONTROL
            </div>
            <div
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] ${
                    isMobile
                        ? 'min-h-0 bg-gradient-to-b from-black/28 to-slate-950/48 px-2 py-2 backdrop-blur-sm'
                        : 'min-h-[3.7rem] bg-gradient-to-b from-black/34 to-slate-950/72 px-2.5 py-2.5'
                }`}
            >
                {championshipFinished ? (
                    <>
                        <div className={`font-bold text-emerald-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>모든 경기가 종료되었습니다.</div>
                        <Button onClick={handleBackClick} colorScheme="none" className={championshipFooterMutedButton}>
                            나가기
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-2">
                            {footerButtons || countdownDisplay || (
                                <div
                                    className={`rounded-xl border border-slate-500/38 bg-gradient-to-b from-slate-800/85 to-slate-950/92 font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                                        isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
                                    }`}
                                >
                                    다음 자동 대국을 준비 중입니다.
                                </div>
                            )}
                            {isMobile ? mobileChampionshipSkipSlot : desktopSkipSlot}
                            {isMobile ? mobileChampionshipExitSlot : desktopExitSlot}
                        </div>
                        {championshipPlaybackSpeedSelector}
                    </>
                )}
            </div>
        </section>
    );

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
                  <div className="flex w-full shrink-0 flex-col gap-1.5 border-t border-cyan-500/35 bg-slate-950/55 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md">
                      {(isTournamentFullyComplete || isUserEliminated) && treatAsClaimed && (
                          <div className="flex w-full flex-row flex-wrap items-stretch gap-2">
                              <div className="min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
                                  {isDungeonModeFooter && !isRewardClaimed ? (
                                      <button
                                          type="button"
                                          onClick={() => handleCompleteDungeon()}
                                          disabled={mobileRewardClaimBusy}
                                          className="w-full rounded-lg bg-green-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                          {mobileRewardClaimBusy ? '처리 중...' : '보상 완료'}
                                      </button>
                                  ) : (
                                      <div className="flex w-full min-h-[2.25rem] items-center justify-center rounded-lg border border-gray-600 bg-gray-700/50 px-2 py-1.5 text-center text-xs font-semibold text-gray-400">
                                          보상완료
                                      </div>
                                  )}
                              </div>
                              {claimedRewardSummary ? (
                                  <button
                                      type="button"
                                      onClick={handleOpenRewardHistory}
                                      className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg bg-purple-700/70 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
                                  >
                                      보상내역
                                  </button>
                              ) : null}
                          </div>
                      )}
                      {!treatAsClaimed && (
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
                                          ? '수령 중...'
                                          : canClaimReward
                                            ? '보상받기'
                                            : '경기 종료 후 수령 가능'}
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
        <div className="h-full w-full flex flex-col gap-2 rounded-2xl bg-gradient-to-b from-[#1b2230] via-[#0d121c] to-[#05070b] p-2 ring-1 ring-inset ring-slate-500/20" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div className="shrink-0 rounded-xl border border-amber-400/45 bg-gradient-to-br from-[#3a2810] via-[#1c2330] to-[#07090d] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_36px_-18px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-amber-300/18">
                <div className="text-center">
                    <div className="text-[11px] font-bold tracking-[0.24em] text-amber-200/80">CHAMPIONSHIP ARENA</div>
                    <div className="mt-1 truncate text-lg font-black text-amber-50 drop-shadow-[0_0_14px_rgba(251,191,36,0.22)]">
                        {TOURNAMENT_DEFINITIONS[tournament.type].name}
                    </div>
                    {resolvedDungeonStageAttempt >= 1 ? (
                        <div className="mx-auto mt-2 inline-flex rounded-full border border-amber-300/35 bg-amber-500/12 px-3 py-1 text-xs font-bold text-amber-100">
                            {resolvedDungeonStageAttempt}단계
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-slate-600/65 bg-slate-950/88 p-1 shadow-inner">
                {([
                    { key: 'commentary' as const, label: '중계내용' },
                    { key: 'bracket' as const, label: '대진표' },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setChampionshipSidebarTab(tab.key)}
                        className={`rounded-lg font-bold transition-all ${
                            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
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
                className="overflow-y-auto rounded-xl border border-slate-500/55 bg-gradient-to-b from-[#202938] via-[#111824] to-[#070a10] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_12px_32px_-20px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.05]" 
                style={{ 
                    flex: '1 1 auto', 
                    minHeight: 0, 
                    maxHeight: '100%',
                    overflowY: 'auto', 
                    overflowX: 'hidden', 
                    width: '100%',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
            {championshipSidebarTab === 'commentary' ? (
                <CommentaryPanel
                    commentary={displayTournament.currentMatchCommentary}
                    isSimulating={displayTournament.status === 'round_in_progress'}
                    compact={compact}
                    emptyStateHint={championshipCommentaryEmptyHint}
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
                <span className="max-w-none truncate">{p1?.nickname || '선수 1'}</span>
            </span>
            <span className="flex items-center gap-0.5">
                <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
                <span className="max-w-none truncate">{p2?.nickname || '선수 2'}</span>
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
            />
        </div>
    );

    const finalRewardSection = (
        <div
            className={`flex flex-col rounded-lg border border-gray-600/75 bg-slate-950/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                !isMobile ? 'min-w-[160px] flex-[1.4] overflow-hidden' : 'w-full min-w-0'
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
                layoutVariant={isMobile ? 'mobileTab' : 'sidebar'}
                suppressBottomActions={isMobile}
            />
        </div>
    );

    const championshipPanelScores = useMemo((): { black: number; white: number; kind: 'captures' | 'final' } | null => {
        const rg = matchForDisplay?.championshipRealGame;
        if (!rg?.moves?.length) return null;
        const ply = rg.currentPly ?? 0;
        const simming = displayTournament?.status === 'round_in_progress';
        const showAuthoritativeFinal = rg.status === 'finished';

        if (simming || rg.status === 'scoring' || (rg.status === 'playing' && ply > 0)) {
            if (ply <= 0) return null;
            const cap = championshipCapturesAtPly(rg.boardSize, rg.moves, Math.min(ply, rg.moves.length));
            if (!cap) return null;
            return { black: cap.black, white: cap.white, kind: 'captures' };
        }

        if (showAuthoritativeFinal && rg.finalScore) {
            return { black: rg.finalScore.black, white: rg.finalScore.white, kind: 'final' };
        }
        return null;
    }, [
        displayTournament?.status,
        matchForDisplay?.championshipRealGame?.status,
        matchForDisplay?.championshipRealGame?.boardSize,
        matchForDisplay?.championshipRealGame?.moves,
        matchForDisplay?.championshipRealGame?.currentPly,
        matchForDisplay?.championshipRealGame?.finalScore?.black,
        matchForDisplay?.championshipRealGame?.finalScore?.white,
    ]);

    const renderSimpleChampionshipPlayerCard = (player: PlayerForTournament | null, tone: 'blue' | 'rose') => {
        const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
        const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
        const isCurrentUser = player?.id === currentUser.id;
        const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser);
        const realGame = matchForDisplay?.championshipRealGame;
        const isBlackPlayer = player?.id && realGame?.blackPlayerId === player.id;
        const colorLabel = isBlackPlayer ? '흑' : player?.id && realGame?.whitePlayerId === player.id ? '백' : '';
        const isWhite = colorLabel === '백';
        const isBlackStone = colorLabel === '흑';
        const isRightSide = tone === 'rose';
        const toneClass = isWhite
            ? 'border-slate-500/90 bg-gradient-to-br from-slate-100 to-slate-300/95 text-slate-950 shadow-sm'
            : isBlackStone
              ? 'border-gray-600 bg-gradient-to-br from-gray-800 to-black text-slate-100 shadow-lg'
              : tone === 'blue'
                ? 'border-blue-400/30 bg-gradient-to-br from-gray-800 to-black text-blue-100 shadow-lg'
                : 'border-rose-400/30 bg-gradient-to-br from-gray-800 to-black text-rose-100 shadow-lg';
        const mutedText = isWhite ? 'text-slate-700' : 'text-slate-300';
        const strongText = isWhite ? 'text-slate-950' : 'text-slate-50';
        const chipClass = isWhite ? 'bg-slate-900/10 text-slate-800' : 'bg-white/10 text-slate-200';
        const rawCondition = player?.condition;
        const displayCondition: number | null =
            rawCondition !== undefined && rawCondition !== null && rawCondition !== 1000
                ? rawCondition
                : isCurrentUser &&
                    championshipConditionFallback !== undefined &&
                    championshipConditionFallback !== null &&
                    championshipConditionFallback !== 1000
                  ? championshipConditionFallback
                  : null;
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
        const scoreMetricLabel = scoreKind === 'captures' ? '따낸 돌' : scoreKind === 'final' ? '집' : '점수';
        const scoreDisplayText =
            scoreValue == null ? '-' : scoreKind === 'captures' ? String(Math.round(scoreValue)) : scoreValue.toFixed(1);
        /** 인게임 던전: `players[].wins`는 이번 단계 누적이 아닐 수 있어, 라운드 종료 대국 기준으로 표시 */
        const dungeonRunRecord =
            tournament.currentStageAttempt != null && player?.id
                ? dungeonUserMatchRecordForPlayer(displayTournament, player.id, matchForDisplay)
                : null;
        const recordWins = dungeonRunRecord ? dungeonRunRecord.wins : (player?.wins ?? 0);
        const recordLosses = dungeonRunRecord ? dungeonRunRecord.losses : (player?.losses ?? 0);
        const scoreBox = (
            <div
                className={`flex w-[4.8rem] shrink-0 flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-center shadow-lg ${
                    isWhite
                        ? 'border-slate-500/90 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-950'
                        : 'border-gray-600 bg-gradient-to-br from-gray-800 to-black text-white'
                }`}
            >
                <span className={`text-[10px] font-bold leading-none ${isWhite ? 'text-slate-700' : 'text-gray-300'}`}>
                    {scoreMetricLabel}
                </span>
                <span className="mt-1 text-xl font-black leading-none tabular-nums">{scoreDisplayText}</span>
            </div>
        );

        return (
            <div className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-lg border-2 px-3 py-2 transition-all duration-300 ${isRightSide ? 'flex-row-reverse text-right' : ''} ${toneClass}`}>
                <button
                    type="button"
                    className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                    title={clickable && player ? `${player.nickname} 프로필 보기` : undefined}
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
                        <span className={`truncate text-sm font-bold ${strongText}`}>{player?.nickname ?? '선수 대기'}</span>
                        {isCurrentUser ? <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">나</span> : null}
                        <span className={`whitespace-nowrap text-[12px] font-semibold ${mutedText}`}>
                            컨디션{' '}
                            <b className={`text-base tabular-nums ${conditionTone}`}>
                                {displayCondition == null ? '-' : displayCondition}
                            </b>
                        </span>
                        {isCurrentUser && canUseConditionPotion ? (
                            <button
                                type="button"
                                onClick={() => setShowConditionPotionModal(true)}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-600/80 text-sm font-black leading-none text-white shadow-md transition-colors hover:bg-emerald-500"
                                title="컨디션 회복"
                            >
                                +
                            </button>
                        ) : null}
                    </div>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${isRightSide ? 'justify-end' : ''} ${mutedText}`}>
                        <span title={dungeonRunRecord ? '이번 챔피언십 단계에서의 전적' : undefined}>
                            전적 <b className={`tabular-nums ${strongText}`}>{recordWins}승 {recordLosses}패</b>
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
        <div className="flex w-36 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-stone-600/80 bg-gradient-to-br from-gray-800 to-black px-3 py-2 text-center shadow-lg">
            <div className="text-[11px] font-bold tracking-wide text-amber-100">계가까지</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                {remainingPlyToScoring ?? '-'}/{maxPlyToScoring}
            </div>
            <div className="text-[10px] font-semibold text-slate-400">수 남음</div>
        </div>
    );

    const championshipPlayerRail = matchForDisplay && (p1 || p2) ? (
        <div className="flex-shrink-0 w-full flex justify-center">
            <div className="min-w-0 w-full flex-1 px-2 pt-1 min-[1025px]:px-1">
                <section className="flex min-h-[74px] shrink-0 flex-row items-stretch gap-2 overflow-hidden rounded-lg border-2 border-stone-500 bg-stone-800/95 p-2 shadow-xl">
                    {renderSimpleChampionshipPlayerCard(p1, 'blue')}
                    {championshipScoringCountdownPanel}
                    {renderSimpleChampionshipPlayerCard(p2, 'rose')}
                </section>
            </div>
        </div>
    ) : null;

    /** 실대국 종료 결과 카드(최종 순위)가 바둑판 영역 밖으로 펼쳐질 때 상위 overflow-hidden에 잘리지 않도록 동기화 */
    const championshipFinishedResultOverlay =
        !!matchForDisplay?.isFinished &&
        matchForDisplay?.championshipRealGame?.status === 'finished' &&
        !!matchForDisplay.championshipRealGame?.winnerId;
    const championshipBoardHostClipClass = championshipFinishedResultOverlay ? 'overflow-visible' : 'overflow-hidden';

    const championshipFooterControls = (
        <div className="flex-shrink-0 w-full flex flex-col gap-1">
            <div className="rounded-2xl border border-amber-300/18 bg-gradient-to-b from-[#283247] via-[#151c2a] to-[#07090f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_52px_-18px_rgba(0,0,0,0.96)] ring-1 ring-inset ring-white/[0.04]">
                <div className="grid min-h-[168px] grid-cols-[0.7fr_1.3fr] gap-2 overflow-hidden">
                    {renderChampionshipMatchControlPanel()}
                    {finalRewardSection}
                </div>
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
                            <div className={`flex min-h-0 w-full flex-1 items-center justify-center transition-opacity duration-500 ${championshipBoardHostClipClass}`}>
                                <div className="flex h-full w-full min-w-0 items-stretch justify-center gap-1.5 px-1 py-1">
                                    <ChampionshipAbilityPlayerPanel
                                        player={p1}
                                        stats={p1Stats as Record<string, number>}
                                        match={matchForDisplay}
                                        currentPhase={currentPhase}
                                        tone="blue"
                                        sideLabel="챔피언십 능력치"
                                        abilityKataLadder={abilityKataLadder}
                                    />
                                    <div className={`relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center bg-transparent p-0 ${championshipBoardHostClipClass}`}>
                                        <ChampionshipRealGoBoard
                                            match={matchForDisplay}
                                            currentUser={currentUser}
                                            tournamentFinished={championshipFinished}
                                            tournamentForResult={displayTournament}
                                            dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                                            finalStandings={championshipFinalStandingsRows}
                                        />
                                    </div>
                                    <ChampionshipAbilityPlayerPanel
                                        player={p2}
                                        stats={p2Stats as Record<string, number>}
                                        match={matchForDisplay}
                                        currentPhase={currentPhase}
                                        tone="rose"
                                        sideLabel="챔피언십 능력치"
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
        const colorLabel = isBlackPlayer ? '흑' : isWhitePlayer ? '백' : '';
        const isCurrentUser = player?.id === currentUser.id;
        const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser);
        const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
        const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
        const rawCondition = player?.condition;
        const effectiveCondition: number | null =
            rawCondition !== undefined && rawCondition !== null && rawCondition !== 1000
                ? rawCondition
                : isCurrentUser &&
                    championshipConditionFallback !== undefined &&
                    championshipConditionFallback !== null &&
                    championshipConditionFallback !== 1000
                  ? championshipConditionFallback
                  : null;
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
        const toneClass = isWhitePlayer
            ? 'border-slate-400/85 bg-gradient-to-br from-slate-100 to-slate-300/95 text-slate-950'
            : isBlackPlayer
              ? 'border-gray-600 bg-gradient-to-br from-gray-800 to-black text-slate-100'
              : side === 'left'
                ? 'border-blue-400/40 bg-gradient-to-br from-slate-800 to-black text-blue-50'
                : 'border-rose-400/40 bg-gradient-to-br from-slate-800 to-black text-rose-50';
        const mutedText = isWhitePlayer ? 'text-slate-700' : 'text-slate-300';
        const strongText = isWhitePlayer ? 'text-slate-950' : 'text-slate-50';
        const chipClass = isWhitePlayer ? 'bg-slate-900/12 text-slate-800' : 'bg-white/12 text-slate-100';
        const isRightSide = side === 'right';
        const condDisplay = effectiveCondition == null ? '-' : effectiveCondition;

        return (
            <div
                className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md border-2 px-1.5 py-1 ${
                    isRightSide ? 'flex-row-reverse text-right' : ''
                } ${toneClass}`}
            >
                <button
                    type="button"
                    className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                    title={clickable && player ? `${player.nickname} 프로필 보기` : undefined}
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
                            {player?.nickname ?? '선수 대기'}
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
                        <span title={dungeonRunRecordMobile ? '이번 챔피언십 단계에서의 전적' : undefined}>
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
                        {isCurrentUser && canUseConditionPotion ? (
                            <button
                                type="button"
                                onClick={() => setShowConditionPotionModal(true)}
                                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-600/85 text-[10px] font-black leading-none text-white shadow"
                                title="컨디션 회복"
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
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-stone-500/70 bg-stone-900/48 p-1 shadow-md backdrop-blur-md">
                {renderMobileChampionshipPureInfoCard(p1, 'left')}
                {renderMobileChampionshipPureInfoCard(p2, 'right')}
            </section>
        ) : null;

    /** 모바일 전용: 가로 챔피언십 능력치 패널(코어 6개 + 단계별 능력) */
    const renderMobileChampionshipAbilityPanel = (
        player: PlayerForTournament | null,
        stats: Record<string, number>,
        tone: 'blue' | 'rose',
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
            tone === 'blue'
                ? 'border-blue-300/45 bg-gradient-to-br from-[#172c48] via-[#0e1b2d] to-[#050911]'
                : 'border-rose-300/45 bg-gradient-to-br from-[#481724] via-[#250d15] to-[#090406]';
        const valueColor = tone === 'blue' ? 'text-blue-50' : 'text-rose-50';

        return (
            <div className={`flex min-w-0 flex-1 flex-col gap-1 rounded-md border ${accentTone} p-1`}>
                <div className="grid grid-cols-3 gap-x-0.5 gap-y-0.5">
                    {CHAMPIONSHIP_CORE_STATS.map((stat) => (
                        <div
                            key={stat}
                            className="flex items-baseline justify-between gap-0.5 rounded bg-black/35 px-1 py-0.5 text-[9px] leading-none"
                        >
                            <span className="truncate text-slate-400">{stat}</span>
                            <span className={`text-[10px] font-bold tabular-nums ${valueColor}`}>
                                {Math.round(stats?.[stat] ?? 0)}
                            </span>
                        </div>
                    ))}
                </div>
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
                                <span className="font-semibold">{phase.label}</span>
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
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-slate-700/45 bg-gradient-to-b from-[#111827]/55 to-[#070b12]/62 p-1 shadow-md backdrop-blur-md">
                {renderMobileChampionshipAbilityPanel(p1, p1Stats as Record<string, number>, 'blue')}
                {renderMobileChampionshipAbilityPanel(p2, p2Stats as Record<string, number>, 'rose')}
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
        const mobileScoreSubLabel = mobileScoreKind === 'captures' ? '따낸 돌' : mobileScoreKind === 'final' ? '집' : '점수';

        const renderScoreCell = (
            isWhite: boolean,
            score: number | null,
            colorLabel: string,
            side: 'left' | 'right',
        ) => {
            const cellTone = isWhite
                ? 'border-slate-500/85 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-950'
                : 'border-gray-600 bg-gradient-to-br from-gray-800 to-black text-white';
            const labelColor = isWhite ? 'text-slate-700' : 'text-gray-300';
            const scoreText =
                score == null ? '-' : mobileScoreKind === 'captures' ? String(Math.round(score)) : score.toFixed(1);
            return (
                <div
                    className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border-2 px-2 py-1 ${cellTone} ${
                        side === 'right' ? 'flex-row-reverse' : ''
                    }`}
                >
                    <span className={`max-w-[4.5rem] text-center text-[8px] font-bold leading-tight tracking-wide ${labelColor}`}>
                        {colorLabel ? `${colorLabel} ${mobileScoreSubLabel}` : mobileScoreSubLabel}
                    </span>
                    <span className="text-base font-black leading-none tabular-nums">{scoreText}</span>
                </div>
            );
        };

        return (
            <section className="flex shrink-0 flex-row items-stretch gap-1">
                {renderScoreCell(p1IsWhite, p1Score, p1IsBlack ? '흑' : p1IsWhite ? '백' : '', 'left')}
                <div className="flex w-[36%] shrink-0 flex-col items-center justify-center rounded-md border-2 border-amber-400/55 bg-gradient-to-br from-gray-800 to-black px-1 py-0.5 text-center">
                    <div className="text-[9px] font-bold tracking-wide text-amber-100">계가까지</div>
                    <div className="text-base font-black tabular-nums leading-none text-white">
                        {remainingPly}/{maxPly}
                    </div>
                    <div className="text-[8px] font-semibold text-slate-400">수 남음</div>
                </div>
                {renderScoreCell(p2IsWhite, p2Score, p2IsBlack ? '흑' : p2IsWhite ? '백' : '', 'right')}
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
                tournamentForResult={displayTournament}
                dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                finalStandings={championshipFinalStandingsRows}
            />
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
                <div className="w-full shrink-0 min-h-0 max-h-[min(30vh,280px)] overflow-y-auto overflow-x-hidden">
                    {renderChampionshipMatchControlPanel()}
                </div>
                {championshipMobileStickyBar}
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
                            <div className="flex flex-1 items-center justify-center text-gray-400">경기 정보를 불러오는 중...</div>
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
                                        tournamentForResult={displayTournament}
                                        dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                                        finalStandings={championshipFinalStandingsRows}
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
                            className={`relative flex min-h-[min(56dvh,520px)] w-full flex-1 flex-col items-center justify-center rounded-lg border border-gray-600/75 bg-slate-950/92 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-2 ${
                                championshipFinishedResultOverlay ? 'overflow-visible' : 'overflow-auto'
                            }`}
                        >
                            <div className={`relative flex min-h-0 w-full flex-1 items-center justify-center ${championshipBoardHostClipClass}`}>
                                <ChampionshipRealGoBoard
                                    match={matchForDisplay}
                                    currentUser={currentUser}
                                    tournamentFinished={championshipFinished}
                                    tournamentForResult={displayTournament}
                                    dungeonBoardCenterMode={championshipDungeonBoardCenterMode}
                                    finalStandings={championshipFinalStandingsRows}
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
                        className={`relative max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
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
                        <button
                            type="button"
                            onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                            className="absolute top-1/2 -left-6 z-[120] flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-slate-600/80 bg-slate-900/90 text-gray-300 transition-colors hover:bg-slate-800/90 hover:text-white"
                            title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        >
                            <span className="text-sm font-bold leading-none">{isRightSidebarCollapsed ? '<' : '>'}</span>
                        </button>
                    </div>
                )}

                {isMobile && (
                    <>
                        <div
                            className={`fixed right-0 z-50 flex w-[280px] flex-col overflow-hidden bg-gradient-to-b from-[#222b3b] via-[#111827] to-[#050608] shadow-2xl transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                            style={{
                                top: 'env(safe-area-inset-top, 0px)',
                                /* NativeMobileDock(h-11~12 + 테두리) + 홈 인디케이터 — 하단 퀵 탭 위에서만 패널이 끝나도록 */
                                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 3.5rem)',
                            }}
                        >
                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2">
                                    <span className="text-sm font-bold text-amber-100">중계 · 대진표</span>
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
                    className="fixed top-1/2 right-0 z-30 flex h-24 w-9 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-l-xl border border-r-0 border-amber-300/55 bg-slate-950/95 text-amber-100 shadow-2xl active:translate-x-0.5"
                    aria-label="중계 및 대진표 열기"
                    title="중계 및 대진표 열기"
                >
                    <span className="text-base font-black leading-none">‹</span>
                    <span className="text-[10px] font-bold leading-tight">중계</span>
                    <span className="text-[10px] font-bold leading-tight">대진표</span>
                </button>
            )}

            {showConditionPotionModal && userPlayer && tournament && canUseConditionPotion && (
                <ConditionPotionModal
                    currentUser={currentUser}
                    currentCondition={conditionForPotionModal}
                    onClose={() => setShowConditionPotionModal(false)}
                    onConfirm={(potionType) => {
                        if (tournament?.type) {
                            onAction({ type: 'USE_CONDITION_POTION', payload: { tournamentType: tournament.type, potionType } });
                        }
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
                                {canUseConditionPotion ? (
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        className="border border-emerald-400/50 bg-emerald-800/90 text-emerald-50 hover:brightness-110 !py-2 !px-4"
                                        onClick={() => {
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
            {showChampionshipExitConfirmModal &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="championship-exit-confirm-title"
                        onClick={() => setShowChampionshipExitConfirmModal(false)}
                    >
                        <div
                            className="max-w-md w-full rounded-2xl border border-rose-500/45 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-5 shadow-2xl ring-1 ring-rose-400/15"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 id="championship-exit-confirm-title" className="text-lg font-black text-rose-100">
                                경기장 나가기
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-200">
                                로비로 나가도 진행 중인 경기는 저장됩니다. 오늘 안에 같은 단계에서 이어서 진행할 수 있습니다. (날짜가 바뀌어 입장이 초기화되면 해당 진행은 무효됩니다.)
                            </p>
                            <div className="mt-5 flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className={championshipFooterMutedButton}
                                    onClick={() => setShowChampionshipExitConfirmModal(false)}
                                >
                                    취소
                                </Button>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className={championshipFooterExitButton}
                                    onClick={() => void confirmChampionshipArenaExitToLobby()}
                                >
                                    로비로 나가기
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
};