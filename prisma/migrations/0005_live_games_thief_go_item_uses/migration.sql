-- SQLite live_games: 도둑과 경찰 주사위 아이템 잔량 저장
-- 기존 DB에 적용: sqlite3 your.db < this file  또는 수동 실행
ALTER TABLE live_games ADD COLUMN thiefGoItemUses TEXT;
