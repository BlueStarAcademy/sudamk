-- Legacy PvE cumulative championship score (replaced by championshipVersus season ELO for public rankings).
-- SQLite `users` table (legacy row store). Safe to run multiple times.
UPDATE users
SET cumulativeTournamentScore = 0
WHERE IFNULL(cumulativeTournamentScore, 0) != 0;
