// 주간 챔피언십 점수만 0으로 초기화하는 스크립트 (레거시 누적 필드는 사용하지 않음)

import * as db from '../db.js';

const resetWeeklyChampionshipScores = async () => {
    console.log('[WeeklyReset] Starting weekly championship score reset (tournamentScore only)...');

    const allUsers = await db.getAllUsers();
    console.log(`[WeeklyReset] Found ${allUsers.length} users`);

    let usersUpdated = 0;
    let tournamentScoreReset = 0;

    for (const user of allUsers) {
        const updatedUser = JSON.parse(JSON.stringify(user));

        if (updatedUser.tournamentScore !== 0) {
            updatedUser.tournamentScore = 0;
            tournamentScoreReset++;
            console.log(`[WeeklyReset] Reset tournamentScore for ${updatedUser.nickname} (${updatedUser.id}): ${user.tournamentScore} -> 0`);
        }

        updatedUser.cumulativeTournamentScore = 0;
        updatedUser.yesterdayTournamentScore = 0;

        if (!updatedUser.dailyRankings) {
            updatedUser.dailyRankings = {};
        }
        updatedUser.dailyRankings.championship = {
            rank: 0,
            score: 0,
            lastUpdated: Date.now(),
        };

        const ch = user.dailyRankings?.championship as { score?: number; rank?: number } | undefined;
        const championshipSnapshotClean =
            (ch?.score ?? 0) === 0 && (ch?.rank ?? 0) === 0;

        const changed =
            updatedUser.tournamentScore !== user.tournamentScore ||
            (user.cumulativeTournamentScore ?? 0) !== 0 ||
            (user.yesterdayTournamentScore ?? 0) !== 0 ||
            !championshipSnapshotClean;

        if (changed) {
            await db.updateUser(updatedUser);
            usersUpdated++;
        }
    }

    console.log(`[WeeklyReset] Users updated: ${usersUpdated}`);
    console.log(`[WeeklyReset] tournamentScore reset: ${tournamentScoreReset}`);
};

// 스크립트 실행
resetWeeklyChampionshipScores()
    .then(() => {
        console.log('[WeeklyReset] Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[WeeklyReset] Script failed:', error);
        process.exit(1);
    });

