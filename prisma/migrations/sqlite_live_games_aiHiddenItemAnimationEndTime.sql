-- SQLite 전용 (로컬 live_games). PostgreSQL은 0007_live_game_ai_hidden_item_animation_end_time 적용.
ALTER TABLE live_games ADD COLUMN aiHiddenItemAnimationEndTime INTEGER;
