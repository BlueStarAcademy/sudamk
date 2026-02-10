import { useEffect, useRef, useState } from 'react';
import { TournamentState, User } from '../types';
import { useAppContext } from './useAppContext';
import { runClientSimulationStep, SeededRandom } from '../utils/tournamentSimulation';

const TOTAL_GAME_DURATION = 50;

export const useTournamentSimulation = (tournament: TournamentState | null, currentUser: User | null) => {
    const { handlers } = useAppContext();
    const [localTournament, setLocalTournament] = useState<TournamentState | null>(tournament);
    
    // Refs for simulation state
    const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isSimulatingRef = useRef(false);
    const rngRef = useRef<SeededRandom | null>(null);
    const player1Ref = useRef<any>(null);
    const player2Ref = useRef<any>(null);
    const player1ScoreRef = useRef(0);
    const player2ScoreRef = useRef(0);
    const commentaryRef = useRef<any[]>([]);
    const timeElapsedRef = useRef(0);
    
    // Track current match to detect changes
    const currentMatchKeyRef = useRef<string | null>(null);

    // Update local tournament state when tournament prop changes
    useEffect(() => {
        if (!tournament) {
            setLocalTournament(null);
            return;
        }

        // Generate match key to detect match changes
        const matchKey = tournament.currentSimulatingMatch
            ? `${tournament.currentSimulatingMatch.roundIndex}-${tournament.currentSimulatingMatch.matchIndex}-${tournament.simulationSeed || ''}`
            : null;

        // If match changed, reset simulation state
        if (matchKey !== currentMatchKeyRef.current) {
            console.log('[useTournamentSimulation] Match changed, resetting simulation state', {
                prevKey: currentMatchKeyRef.current,
                newKey: matchKey,
                status: tournament.status,
                hasSeed: !!tournament.simulationSeed
            });
            
            // Clear any running simulation
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
            
            // Reset simulation state
            isSimulatingRef.current = false;
            timeElapsedRef.current = 0;
            player1ScoreRef.current = 0;
            player2ScoreRef.current = 0;
            commentaryRef.current = [];
            rngRef.current = null;
            player1Ref.current = null;
            player2Ref.current = null;
            
            currentMatchKeyRef.current = matchKey;
        }

        // Update local tournament state
        setLocalTournament(prev => {
            if (!prev) return tournament;
            
            // Preserve client-side simulation state if same match is running
            if (prev.status === 'round_in_progress' && 
                tournament.status === 'round_in_progress' &&
                prev.currentSimulatingMatch &&
                tournament.currentSimulatingMatch &&
                prev.currentSimulatingMatch.roundIndex === tournament.currentSimulatingMatch.roundIndex &&
                prev.currentSimulatingMatch.matchIndex === tournament.currentSimulatingMatch.matchIndex &&
                prev.simulationSeed === tournament.simulationSeed) {
                // Same match, preserve client-side updates
                return {
                    ...tournament,
                    timeElapsed: prev.timeElapsed,
                    currentMatchScores: prev.currentMatchScores,
                    currentMatchCommentary: prev.currentMatchCommentary
                };
            }
            
            return tournament;
        });
    }, [tournament]);

    // Main simulation effect
    useEffect(() => {
        if (!localTournament || !currentUser) {
            // Cleanup
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
            isSimulatingRef.current = false;
            return;
        }

        // Check if we should start simulation
        const shouldStartSimulation = 
            localTournament.status === 'round_in_progress' &&
            localTournament.currentSimulatingMatch !== null &&
            localTournament.simulationSeed !== undefined &&
            !isSimulatingRef.current &&
            !simulationIntervalRef.current;

        if (!shouldStartSimulation) {
            // Cleanup if status changed
            if (localTournament.status !== 'round_in_progress' && simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
                isSimulatingRef.current = false;
            }
            return;
        }

        // Get match
        const match = localTournament.currentSimulatingMatch
            ? localTournament.rounds[localTournament.currentSimulatingMatch.roundIndex]
                ?.matches[localTournament.currentSimulatingMatch.matchIndex]
            : null;

        if (!match || match.isFinished || !match.players[0] || !match.players[1]) {
            console.warn('[useTournamentSimulation] Cannot start simulation: invalid match', {
                hasMatch: !!match,
                isFinished: match?.isFinished,
                hasPlayers: !!(match?.players[0] && match?.players[1])
            });
            return;
        }

        // Get players
        const p1 = tournament?.players.find(p => p.id === match.players[0]!.id) ||
                   localTournament.players.find(p => p.id === match.players[0]!.id);
        const p2 = tournament?.players.find(p => p.id === match.players[1]!.id) ||
                   localTournament.players.find(p => p.id === match.players[1]!.id);

        if (!p1 || !p2) {
            console.warn('[useTournamentSimulation] Cannot start simulation: players not found');
            return;
        }

        console.log('[useTournamentSimulation] Starting simulation', {
            roundIndex: localTournament.currentSimulatingMatch!.roundIndex,
            matchIndex: localTournament.currentSimulatingMatch!.matchIndex,
            p1: p1.nickname,
            p2: p2.nickname
        });

        // Initialize simulation state
        isSimulatingRef.current = true;
        player1Ref.current = JSON.parse(JSON.stringify(p1));
        player2Ref.current = JSON.parse(JSON.stringify(p2));
        rngRef.current = new SeededRandom(localTournament.simulationSeed!);
        
        // Set conditions
        const isP1User = p1.id === currentUser.id;
        const isP2User = p2.id === currentUser.id;
        
        // Preserve user condition from server, generate for others if needed
        if (isP1User && p1.condition !== undefined && p1.condition !== null && p1.condition !== 1000 && p1.condition >= 40 && p1.condition <= 100) {
            player1Ref.current.condition = p1.condition;
        } else if (!isP1User && (p1.condition === undefined || p1.condition === null || p1.condition === 1000 || p1.condition < 40 || p1.condition > 100)) {
            player1Ref.current.condition = rngRef.current.randomInt(40, 100);
        } else {
            player1Ref.current.condition = p1.condition || rngRef.current.randomInt(40, 100);
        }
        
        if (isP2User && p2.condition !== undefined && p2.condition !== null && p2.condition !== 1000 && p2.condition >= 40 && p2.condition <= 100) {
            player2Ref.current.condition = p2.condition;
        } else if (!isP2User && (p2.condition === undefined || p2.condition === null || p2.condition === 1000 || p2.condition < 40 || p2.condition > 100)) {
            player2Ref.current.condition = rngRef.current.randomInt(40, 100);
        } else {
            player2Ref.current.condition = p2.condition || rngRef.current.randomInt(40, 100);
        }

        // Reset stats
        if (player1Ref.current.originalStats) {
            player1Ref.current.stats = JSON.parse(JSON.stringify(player1Ref.current.originalStats));
        }
        if (player2Ref.current.originalStats) {
            player2Ref.current.stats = JSON.parse(JSON.stringify(player2Ref.current.originalStats));
        }
        
        player1ScoreRef.current = 0;
        player2ScoreRef.current = 0;
        commentaryRef.current = [];
        timeElapsedRef.current = 0;

        // Start simulation interval
        try {
            simulationIntervalRef.current = setInterval(() => {
                if (!rngRef.current || !player1Ref.current || !player2Ref.current) {
                    console.warn('[useTournamentSimulation] Missing refs in interval');
                    return;
                }

                timeElapsedRef.current++;

                const prevP1Score = player1ScoreRef.current;
                const prevP2Score = player2ScoreRef.current;

                const result = runClientSimulationStep(
                    rngRef.current,
                    player1Ref.current,
                    player2Ref.current,
                    timeElapsedRef.current,
                    player1ScoreRef.current,
                    player2ScoreRef.current,
                    commentaryRef.current
                );

                const p1ScoreIncrement = result.player1Score - prevP1Score;
                const p2ScoreIncrement = result.player2Score - prevP2Score;
                const p1IsCritical = result.p1IsCritical || false;
                const p2IsCritical = result.p2IsCritical || false;

                player1ScoreRef.current = result.player1Score;
                player2ScoreRef.current = result.player2Score;
                commentaryRef.current = result.commentary;

                // Update local tournament state
                setLocalTournament(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev };
                    updated.timeElapsed = timeElapsedRef.current;
                    if (!updated.currentMatchScores) {
                        updated.currentMatchScores = { player1: 0, player2: 0 };
                    }
                    updated.currentMatchScores.player1 = player1ScoreRef.current;
                    updated.currentMatchScores.player2 = player2ScoreRef.current;
                    updated.currentMatchCommentary = [...commentaryRef.current];
                    updated.lastScoreIncrement = {
                        player1: p1ScoreIncrement > 0 ? {
                            base: p1ScoreIncrement,
                            actual: p1ScoreIncrement,
                            isCritical: p1IsCritical
                        } : null,
                        player2: p2ScoreIncrement > 0 ? {
                            base: p2ScoreIncrement,
                            actual: p2ScoreIncrement,
                            isCritical: p2IsCritical
                        } : null
                    };
                    updated.players = updated.players.map(p => {
                        if (p.id === player1Ref.current.id) {
                            return { ...player1Ref.current, stats: { ...player1Ref.current.stats } };
                        }
                        if (p.id === player2Ref.current.id) {
                            return { ...player2Ref.current, stats: { ...player2Ref.current.stats } };
                        }
                        return p;
                    });
                    return updated;
                });

                // Check if simulation is complete
                if (timeElapsedRef.current >= TOTAL_GAME_DURATION) {
                    if (simulationIntervalRef.current) {
                        clearInterval(simulationIntervalRef.current);
                        simulationIntervalRef.current = null;
                    }
                    isSimulatingRef.current = false;

                    // Calculate final result
                    const totalScore = player1ScoreRef.current + player2ScoreRef.current;
                    const p1Percent = totalScore > 0 ? (player1ScoreRef.current / totalScore) * 100 : 50;
                    const diffPercent = Math.abs(p1Percent - 50) * 2;
                    const scoreDiff = Math.round(diffPercent / 2) + 0.5;

                    let winnerId: string;
                    let winnerNickname: string;
                    if (scoreDiff < 0.5) {
                        const randomWinner = (rngRef.current && rngRef.current.random() < 0.5) ? player1Ref.current : player2Ref.current;
                        winnerId = randomWinner.id;
                        winnerNickname = randomWinner.nickname;
                    } else {
                        const winner = p1Percent > 50 ? player1Ref.current : player2Ref.current;
                        winnerId = winner.id;
                        winnerNickname = winner.nickname;
                    }

                    const finalCommentaryText = scoreDiff < 0.5 
                        ? `[최종결과] ${winnerNickname}, 0.5집 승리!`
                        : `[최종결과] ${winnerNickname}, ${scoreDiff.toFixed(1)}집 승리!`;

                    commentaryRef.current.push({ 
                        text: finalCommentaryText, 
                        phase: 'end', 
                        isRandomEvent: false 
                    });
                    commentaryRef.current.push({ 
                        text: `${winnerNickname}님이 승리했습니다!`, 
                        phase: 'end', 
                        isRandomEvent: false 
                    });

                    // Update final state
                    setLocalTournament(prev => {
                        if (!prev) return prev;
                        const updated = { ...prev };
                        updated.timeElapsed = TOTAL_GAME_DURATION;
                        if (!updated.currentMatchScores) {
                            updated.currentMatchScores = { player1: 0, player2: 0 };
                        }
                        updated.currentMatchScores.player1 = player1ScoreRef.current;
                        updated.currentMatchScores.player2 = player2ScoreRef.current;
                        updated.currentMatchCommentary = [...commentaryRef.current];
                        updated.simulationSeed = undefined;
                        return updated;
                    });

                    // Send result to server
                    handlers.handleAction({
                        type: 'COMPLETE_TOURNAMENT_SIMULATION',
                        payload: {
                            type: localTournament.type,
                            result: {
                                timeElapsed: TOTAL_GAME_DURATION,
                                player1Score: player1ScoreRef.current,
                                player2Score: player2ScoreRef.current,
                                commentary: commentaryRef.current,
                                winnerId: winnerId
                            }
                        }
                    });

                    console.log('[useTournamentSimulation] Simulation completed, result sent to server');
                }
            }, 1000);

            console.log('[useTournamentSimulation] Simulation interval started');
        } catch (error) {
            console.error('[useTournamentSimulation] Error starting simulation:', error);
            isSimulatingRef.current = false;
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
        }

        return () => {
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
            isSimulatingRef.current = false;
        };
    }, [
        localTournament?.status,
        localTournament?.simulationSeed,
        localTournament?.currentSimulatingMatch?.roundIndex,
        localTournament?.currentSimulatingMatch?.matchIndex,
        tournament,
        currentUser?.id
    ]);

    return localTournament;
};
