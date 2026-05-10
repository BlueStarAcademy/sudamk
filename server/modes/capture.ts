import * as types from '../../types/index.js';
// FIX: Changed import path to avoid circular dependency
import { transitionToPlaying, shouldEnforceTimeControl } from './shared.js';
import * as summaryService from '../summaryService.js';
import { aiUserId } from '../aiPlayer.js';
import { modeIncludesBaseCaptureMix } from '../../shared/utils/liveSessionArenaKind.js';
import { finalizeBaseCaptureBidResolution, baseHttpGameSnapshot } from './base.js';

const getCaptureBidMax = (game: types.LiveGameSession): number => {
    const baseTarget = Math.max(1, Math.floor(Number(game.settings.captureTarget ?? 20)));
    return Math.max(1, baseTarget - 1);
};

const clampCaptureBid = (game: types.LiveGameSession, value: unknown): number => {
    const rawBid = Math.floor(Number(value));
    const bid = Number.isFinite(rawBid) ? rawBid : 1;
    return Math.max(1, Math.min(getCaptureBidMax(game), bid));
};

const randomCaptureBid1To5 = (game: types.LiveGameSession): number => {
    const max = Math.min(5, getCaptureBidMax(game));
    return Math.floor(Math.random() * max) + 1;
};

const isAiLikeParticipantId = (id: string | null | undefined): boolean =>
    id === aiUserId ||
    Boolean(id && (id.startsWith('dungeon-bot-') || id.startsWith('pair-') || id.startsWith('pet-ai-')));

const getPairTeamIdForUser = (
    game: types.LiveGameSession,
    userId: string
): 'teamA' | 'teamB' | null => {
    const pairGame = game.settings?.pairGame;
    if (!pairGame) return null;
    if (pairGame.teamA.members.some((m) => m.kind === 'user' && m.id === userId)) return 'teamA';
    if (pairGame.teamB.members.some((m) => m.kind === 'user' && m.id === userId)) return 'teamB';
    return null;
};

const getPairTeamCaptainId = (
    game: types.LiveGameSession,
    teamId: 'teamA' | 'teamB'
): string | null => {
    const members = game.settings?.pairGame?.[teamId]?.members ?? [];
    return members.find((m) => m.kind === 'user')?.id ?? null;
};

const getPairTeamBidSubjectId = (
    game: types.LiveGameSession,
    teamId: 'teamA' | 'teamB'
): string => teamId === 'teamA' ? game.player1.id : game.player2.id;

const shouldUseCaptureCountdown = (game: types.LiveGameSession): boolean =>
    !game.isAiGame && game.settings?.pairGame?.pairMode !== 'ai';

const getAiRevealConfirmations = (game: types.LiveGameSession): Record<string, boolean> => {
    const confirmations: Record<string, boolean> = {};
    for (const player of [game.player1, game.player2]) {
        if (isAiLikeParticipantId(player.id)) confirmations[player.id] = true;
    }
    return confirmations;
};

const enterCaptureReveal = (
    game: types.LiveGameSession,
    now: number,
    status: 'capture_reveal' | 'capture_tiebreaker',
) => {
    game.gameStatus = status;
    game.revealEndTime = shouldUseCaptureCountdown(game) ? now + 10000 : undefined;
    game.preGameConfirmations = getAiRevealConfirmations(game);
};

const maybeAutoSubmitCaptureBids = (game: types.LiveGameSession) => {
    if (game.gameStatus !== 'capture_bidding') return;
    if (!game.bids) game.bids = { [game.player1.id]: null, [game.player2.id]: null };

    const pairGame = game.settings?.pairGame;
    if (pairGame) {
        if (pairGame.pairMode !== 'ai') return;
        (['teamA', 'teamB'] as const).forEach((teamId) => {
            const members = pairGame[teamId]?.members ?? [];
            const hasHuman = members.some((m) => m.kind === 'user');
            if (hasHuman) return;
            const subjectId = getPairTeamBidSubjectId(game, teamId);
            if (game.bids?.[subjectId] == null) {
                game.bids![subjectId] = randomCaptureBid1To5(game);
            }
        });
        return;
    }

    if (!game.isAiGame) return;
    for (const player of [game.player1, game.player2]) {
        if (isAiLikeParticipantId(player.id) && game.bids[player.id] == null) {
            game.bids[player.id] = randomCaptureBid1To5(game);
        }
    }
};

const applyBaseCaptureResolutionIfNeeded = (
    game: types.LiveGameSession,
    now: number,
    blackPlayerId: string,
    whitePlayerId: string,
) => {
    if (!modeIncludesBaseCaptureMix(game.mode, game.settings)) {
        game.blackPlayerId = blackPlayerId;
        game.whitePlayerId = whitePlayerId;
        return;
    }
    finalizeBaseCaptureBidResolution(game, now, blackPlayerId, whitePlayerId);
};

export const initializeCapture = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    game.gameStatus = 'capture_bidding';
    game.bids = { [p1Id]: null, [p2Id]: null };
    game.biddingRound = 1;
    game.captureFirstRoundTieBidSnapshot = undefined;
    game.captureBidDeadline = shouldUseCaptureCountdown(game) ? now + 30000 : undefined;
};

export const updateCaptureState = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case 'capture_bidding': {
            maybeAutoSubmitCaptureBids(game);
            const bothHaveBid = game.bids?.[p1Id] != null && game.bids?.[p2Id] != null;
            const deadlinePassedBid = game.captureBidDeadline && now > game.captureBidDeadline;

            if (bothHaveBid || deadlinePassedBid) {
                if (deadlinePassedBid) {
                    if (game.bids![p1Id] == null) game.bids![p1Id] = clampCaptureBid(game, 1);
                    if (game.bids![p2Id] == null) game.bids![p2Id] = clampCaptureBid(game, 1);
                }

                const p1Bid = clampCaptureBid(game, game.bids![p1Id]!);
                const p2Bid = clampCaptureBid(game, game.bids![p2Id]!);
                game.bids![p1Id] = p1Bid;
                game.bids![p2Id] = p2Bid;
                const baseTarget = game.settings.captureTarget || 20;

                if (p1Bid !== p2Bid) {
                    game.captureFirstRoundTieBidSnapshot = undefined;
                    const winnerId = p1Bid > p2Bid ? p1Id : p2Id;
                    const loserId = winnerId === p1Id ? p2Id : p1Id;
                    const winnerBid = Math.max(p1Bid, p2Bid);
                    
                    applyBaseCaptureResolutionIfNeeded(game, now, winnerId, loserId);
                    
                    game.effectiveCaptureTargets = {
                        [types.Player.None]: 0,
                        [types.Player.Black]: baseTarget,
                        [types.Player.White]: Math.max(1, baseTarget - winnerBid),
                    };
                    
                    enterCaptureReveal(game, now, 'capture_reveal');
                } else { // Tie
                    if (game.biddingRound === 1) {
                        // 동점 1라운드는 즉시 재입찰로 전환 (3초 대기 제거)
                        game.captureFirstRoundTieBidSnapshot = { [p1Id]: p1Bid, [p2Id]: p2Bid };
                        game.biddingRound = 2;
                        game.bids = { [p1Id]: null, [p2Id]: null };
                        game.captureBidDeadline = shouldUseCaptureCountdown(game) ? now + 30000 : undefined;
                        game.gameStatus = 'capture_bidding';
                        game.preGameConfirmations = {};
                        game.revealEndTime = undefined;
                        return;
                    } else {
                        const winnerId = Math.random() < 0.5 ? p1Id : p2Id;
                        const loserId = winnerId === p1Id ? p2Id : p1Id;

                        applyBaseCaptureResolutionIfNeeded(game, now, winnerId, loserId);

                        game.effectiveCaptureTargets = {
                            [types.Player.None]: 0,
                            [types.Player.Black]: baseTarget,
                            [types.Player.White]: Math.max(1, baseTarget - p1Bid),
                        };

                        // 룰렛 연출·확인 버튼 여유 (클라이언트 PreGameColorRoulette ~2.6s + 여유)
                        enterCaptureReveal(game, now, 'capture_tiebreaker');
                        game.captureFirstRoundTieBidSnapshot = undefined;
                    }
                }
            }
            break;
        }
        case 'capture_reveal':
        case 'capture_tiebreaker': {
            const bothConfirmedCapture = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            if (bothConfirmedCapture || (game.revealEndTime && now > game.revealEndTime)) {
                
                const p1Bid = game.bids?.[p1Id];
                const p2Bid = game.bids?.[p2Id];
                /** `undefined === undefined`이면 동점 재입찰로 오인해 reveal 단계가 깨질 수 있음 — 실수 입찰 숫자 동점만 재입찰 */
                const isRoundOneTieRebid =
                    game.biddingRound === 1 &&
                    typeof p1Bid === 'number' &&
                    typeof p2Bid === 'number' &&
                    p1Bid === p2Bid;
                if (isRoundOneTieRebid) {
                    game.captureFirstRoundTieBidSnapshot = { [p1Id]: p1Bid, [p2Id]: p2Bid };
                    game.biddingRound = 2;
                    game.bids = { [p1Id]: null, [p2Id]: null };
                    game.captureBidDeadline = shouldUseCaptureCountdown(game) ? now + 30000 : undefined;
                    game.gameStatus = 'capture_bidding';
                    game.preGameConfirmations = {};
                    game.revealEndTime = undefined;
                    return;
                }
                
                transitionToPlaying(game, now);
                game.bids = undefined; 
                game.biddingRound = undefined;
                game.captureFirstRoundTieBidSnapshot = undefined;
            }
            break;
        }
        case 'playing': {
            if (shouldEnforceTimeControl(game) && game.turnDeadline && now > game.turnDeadline) {
                const timedOutPlayer = game.currentPlayer;
                const timeKey = timedOutPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const byoyomiKey = timedOutPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';

                if (game[timeKey] > 0) { // Main time expired -> enter byoyomi without consuming a period
                    game[timeKey] = 0;
                    if (game.settings.byoyomiCount > 0) {
                        // Do not decrement period on entering byoyomi
                        game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                        game.turnStartTime = now;
                        return;
                    }
                } else { // Byoyomi expired
                    if (game[byoyomiKey] > 0) {
                        game[byoyomiKey]--;
                        game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                        game.turnStartTime = now;
                        return;
                    }
                }
                
                // No time or byoyomi left
                const winner = timedOutPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
                game.lastTimeoutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                game.lastTimeoutPlayerIdClearTime = now + 5000;
                
                summaryService.endGame(game, winner, 'timeout');
            }
            break;
        }
    }
};

export const handleCaptureAction = (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): types.HandleActionResult | null => {
    const { type, payload } = action as any;

    switch (type) {
        case 'UPDATE_CAPTURE_BID':
            if (game.gameStatus !== 'capture_bidding') return { error: "Cannot bid now." };
            if (!game.bids) game.bids = {};
            {
                let bidSubjectId = user.id;
                const pairGame = game.settings?.pairGame;
                if (pairGame && modeIncludesBaseCaptureMix(game.mode, game.settings)) {
                    const teamId = getPairTeamIdForUser(game, user.id);
                    if (!teamId) return { error: '페어 팀 참가자만 입찰할 수 있습니다.' };
                    const captainId = getPairTeamCaptainId(game, teamId);
                    if (captainId !== user.id) return { error: '각 팀 방장만 입찰할 수 있습니다.' };
                    bidSubjectId = getPairTeamBidSubjectId(game, teamId);
                }
                if (game.bids?.[bidSubjectId]) return { error: "Cannot bid now." };
                game.bids[bidSubjectId] = clampCaptureBid(game, payload.bid);
            }
            return {};
        case 'CONFIRM_CAPTURE_REVEAL':
            if (!['capture_reveal', 'capture_tiebreaker'].includes(game.gameStatus)) {
                if (game.gameStatus === 'playing') {
                    return baseHttpGameSnapshot(game);
                }
                return { error: "Not in confirmation phase." };
            }
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            if (game.isAiGame || game.settings?.pairGame?.pairMode === 'ai') {
                Object.assign(game.preGameConfirmations, getAiRevealConfirmations(game));
            }
            let revealConfirmKey = user.id;
            {
                const pairGame = game.settings?.pairGame;
                if (pairGame && pairGame.pairMode !== 'ai' && modeIncludesBaseCaptureMix(game.mode, game.settings)) {
                    const teamId = getPairTeamIdForUser(game, user.id);
                    if (!teamId) return { error: '페어 팀 참가자만 확인할 수 있습니다.' };
                    revealConfirmKey = getPairTeamBidSubjectId(game, teamId);
                }
            }
            game.preGameConfirmations[revealConfirmKey] = true;
            return {};
    }
    return null;
};