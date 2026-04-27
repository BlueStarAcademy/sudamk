-- SQLite 전용 (로컬 live_games). PostgreSQL LiveGame은 JSON data에 포함.
ALTER TABLE live_games ADD COLUMN baseKomiBidsSnapshot TEXT;
