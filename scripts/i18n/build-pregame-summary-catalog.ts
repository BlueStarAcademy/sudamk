#!/usr/bin/env npx tsx
/**
 * Merge pre-game summary and item-slot strings into ko/en catalog masters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEED_PER_MOVE_SECONDS } from '../../shared/constants/speedTimePressure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');

const SEC = String(SPEED_PER_MOVE_SECONDS);

const SUMMARY_KO: Record<string, string> = {
    loseTerritory: '계가(종합 점수)에서 집이 적거나, 동점·무승부 규칙에 따라 불리하면 패배',
    loseTerritoryAuto: '{{base}} · {{auto}}에 못 이기면 패배',
    loseCaptureRace: '상대가 {{t}}점을 먼저 따내면 패배 · 아니면 계가에서 집이 적으면 패배',
    loseMix: '종료 시 따내기·계가 등에서 상대가 승리 조건을 먼저 충족하거나 불리하면 패배',

    basePlacementAnalysis: '베이스돌 배치 공개 후 형세분석',
    baseKomiSelect: '상대에게 줄 덤 설정 · 원하는 돌 선택',

    autoScoringCaptureTurn: '{{n}}턴(수) 도달 시 자동 계가 진행',
    autoScoringTerritoryWin: '{{n}}수(턴) 후 자동 계가에서 승리하기',
    autoScoringTerritoryLose: '{{n}}수(턴) 후 자동 계가에서 패배',

    fischerOnly: '피셔 {{sec}}초',
    byoyomiOnly: '초읽기만 · {{time}}초×{{count}}회',
    noTimeLimit: '시간 제한 없음',
    limitFischer: '제한 {{min}}분 · 피셔 {{sec}}초',
    limitByoyomi: '제한 {{min}}분 · 초읽기 {{time}}초×{{count}}회',
    limitNoByoyomi: '제한 {{min}}분 (초읽기 없음)',

    factorTerritory: '영토',
    factorCaptured: '따낸 돌',
    factorDead: '사석',
    factorKomi: '덤(백)',
    factorBaseBonus: '베이스 보너스',
    factorHiddenBonus: '히든 보너스',
    factorSpeedBonus: '수당 {{sec}}초 초과→상대 +1',
    factorMissileEffect: '미사일 연출 반영',
    factorCaptureScore: '따내기 점수',
    factorMixFallback: '모드 조합에 따름',
    factorCaptureNoTerritory: '따내기 점수(집 계산 없음)',
    factorCastle: '확정 영토 · 따낸 돌 · 덤(백)',
    factorChess: '영토 · 따낸 돌 · 사석 · 기물 포획 · 덤(백)',
    factorOmok: '목(승부) — 집 계산 없음',
    factorTtamok: '목 승리 또는 따내기 점수',
    factorDice: '라운드별 백돌 따내기 점수 · 마지막 따내기 보너스',
    factorThief: '라운드별 획득 점수 합산',
    factorAlkkagi: '판 밖으로 나간 상대 돌 수',
    factorCurling: '하우스(목표)에 가까운 스톤 점수',
    factorFallback: '모드 안내 참고',
    factorStageDefault: '스테이지·모드에 따름',
    factorStageCapture: '따내기 점수',
    factorStageCapturePattern: '따내기 점수\n문양돌 2점',
    factorStageSpeed: '영토 · 따낸 돌 · 사석 · 덤\n시간 보너스',
    factorAdventureCaptureShort: '따내기 · 문양 2점',
    factorAdventureBase: '기본 계가',
    factorAdventureBaseStone5: '베이스돌 5점',
    factorAdventureHidden: '히든',
    factorAdventureSpeed: '시간',
    factorAdventureMissile: '미사일',

    itemHidden: '히든 {{n}}개',
    itemScan: '스캔 {{n}}개',
    itemMissile: '미사일 {{n}}개',
    itemSpecialDice: '특수주사위 {{summary}}',
    itemSlowAim: '슬로우 {{slow}} · 조준 {{aim}}',

    mixCaptureWin: '따내기 {{t}}점 선달성 시 즉시 승리 · 미달성 시 계가 후 집 비교',
    mixCaptureWinWithAuto: '따내기 {{t}}점 선달성 시 즉시 승리 · 미달성 시 계가 후 집 비교 · {{auto}}',
    mixAutoTerritoryWin: '{{auto}} — 집이 많은 쪽 승리',
    mixComboTail: '조합({{modes}}) — 종료 시 규칙에 따라 승패 결정',
    mixDefaultEnd: '종료 시 규칙에 따라 승패 결정',

    highlightPatternStone2: '문양돌 따내기 2점',
    highlightHiddenScan: '히든 착수 · 스캔으로 탐색',
    highlightMissileMove: '미사일로 돌 직선 이동',
    speedPvpHighlight: `수당 ${SEC}초 초읽기 · ${SEC}초 초과마다 상대 +1점 · 메인 시간 소진 시 시간패`,
    highlightSurvival: '살리기 바둑 · 백 {{n}}턴 내 목표 점수',
    highlightAutoScoring: '{{n}}수 후 자동 계가',
    highlightBlackTurnLimit: '흑 {{n}}턴 제한',
    highlightTurnAdd: '턴 추가 {{n}}개',
    highlightMissile: '미사일 {{n}}개',
    highlightHiddenScanCounts: '히든 {{hidden}}개 · 스캔 {{scan}}개',

    spTimeMainFischer: '메인 {{min}}분 · 수당 {{sec}}초 초읽기',
    spTimeFischerOnly: '수당 {{sec}}초 초읽기',
    spTimeUnlimited: '제한없음',

    goalSurvivalWinLabel: '백 막기',
    goalSurvivalWinHelper: '{{n}}턴 동안 백 목표를 막기',
    goalSurvivalLoseLabel: '백 성공',
    goalSurvivalLoseHelper: '백이 목표를 만들면 실패',
    goalCaptureWinLabel: '따내기',
    goalCaptureWinHelper: '상대 돌을 둘러싸면 점수',
    goalCaptureLoseTurnLabel: '턴 초과',
    goalCaptureLoseTurnHelper: '{{n}}턴 안에 못 하면 실패',
    goalCaptureLoseFirstLabel: '상대 선취',
    goalCaptureLoseFirstHelper: '상대가 먼저 따내면 실패',
    goalSpeedWinLabel: '빠르게',
    goalSpeedWinHelper: '시간을 지키며 집 만들기',
    goalSpeedLoseLabel: '점수 열세',
    goalSpeedLoseHelper: '집이 적으면 실패',
    goalAutoWinLabel: '집 많이',
    goalAutoWinHelper: '{{n}}수 후 집 계산',
    goalAutoLoseLabel: '집 부족',
    goalAutoLoseHelper: '{{n}}수 때 불리하면 실패',
    goalDefaultWinLabel: '집 만들기',
    goalDefaultWinHelper: '영역을 둘러 집을 만들기',
    goalDefaultLoseLabel: '집 부족',
    goalDefaultLoseHelper: '집이 적으면 실패',

    guideTurnLimitTitle: '턴 제한',
    guideTurnLimitBody: '{{n}}턴 안에 끝내기',
    guideSurvivalTitle: '막기',
    guideSurvivalBody: '{{n}}턴 동안 백 목표 막기',
    guideAutoScoringTitle: '계가',
    guideAutoScoringBody: '{{n}}수 후 집 계산',
    guidePatternStoneTitle: '문양돌',
    guidePatternStoneBody: '따내면 2점',
    guideSpeedTitle: '스피드',
    guideSpeedBody: '늦게 두면 상대 +1점',
    guideTurnAddTitle: '턴 추가',
    guideTurnAddBody: '제한 턴 늘리기',
    guideMissileTitle: '미사일',
    guideMissileBody: '돌을 골라 직선 밀기',
    guideHiddenScanTitle: '히든 · 스캔',
    guideHiddenScanBody: '숨기기 {{hidden}} · 찾기 {{scan}}',

    advCaptureWin: '따내기 승리',
    advCaptureLose: '따내기 패배 · 시간 초과',
    advTerritoryWin: '계가 승리',
    advTerritoryWinAuto: '계가 승리 · {{n}}수 자동',
    advTerritoryLose: '계가 패배 · 시간 초과',
    advTimeLimit: '{{mins}}분 제한',

    gwCaptureWinAuto: '{{cap}}점 선취 또는 {{limit}}턴 계가 승',
    gwCaptureWin: '{{cap}}점 먼저 따내면 승리',
    gwCaptureLose: '상대 {{cap}}점 선취',
    gwTerritoryWinAuto: '계가 집 다수 승 · {{limit}}수 자동 계가',
    gwTerritoryWin: '계가에서 집이 많으면 승리',
    gwTerritoryLose: '계가 열세 · 시간 초과',

    captureWin: '상대 돌 {{t}}점 먼저 따내기',
    captureWinWithAuto: '상대 돌 {{t}}점 먼저 따내기 · {{auto}}',
    territoryWinDefault: '계가 후 집이 많은 쪽 승리',
    speedTerritoryWinDefault: '계가 후 종합 점수가 높은 쪽 승리',
    speedTerritoryLoseDefault: '계가 후 종합 점수가 낮으면 패배',

    castleWin: '상대 돌 1개 이상 따내면 즉시 승리 · 유효수 없으면 영토 계가',
    castleLose: '상대에게 1돌이라도 잡히면 패배 · 계가에서 집이 적으면 패배',
    castleHighlightCount: '캐슬 {{castles}}개 · 완성 영토 진입 불가',
    castleHighlightCapture: '1돌 포획 시 즉시 승리',

    chessWin: '정해진 수순 후 계가',
    chessLose: '계가에서 패배 · 킹 포획 시 즉시 패배',
    chessHighlightBudget: '기물 총점수 {{budget}}점 예산 내 직접 배치(킹 2번째 줄 중앙 고정)',
    chessHighlightMovement: '기물돌을 체스의 움직임으로 매 턴 1회씩 움직일 수 있음(횟수 제한)',

    omokWin: '가로·세로·대각 5목 먼저 완성',
    omokLose: '상대가 먼저 5목을 완성하면 패배',
    omok33Forbidden: '쌍삼 금지',
    omok33Allowed: '쌍삼 허용',
    omokOverlineForbidden: '장목 금지',
    omokOverlineAllowed: '장목 허용',

    ttamokWin: '5목 선완성 또는 따내기 {{cap}}점 선달성',
    ttamokLose: '상대가 먼저 5목을 완성하거나 따내기 {{cap}}점을 먼저 달성하면 패배',
    ttamokHighlightCapture: '따내기 {{cap}}점 선달성 시 승리',

    diceWin: '{{r}}라운드 후 누적 점수가 높은 쪽 승리',
    diceLose: '{{r}}라운드 종료 후 누적 점수가 낮으면 패배',
    diceHighlightRules: '주사위 눈만큼 흑 착수 · 백은 활로에만 배치',

    thiefWin: '5턴×라운드 진행 후 총점이 높은 쪽 승리',
    thiefLose: '라운드 종료 후 총점이 낮으면 패배',
    thiefHighlightRoles: '도둑(흑)·경찰(백) 역할 교대',

    alkkagiWin: '상대 돌 모두 넉아웃',
    alkkagiLose: '내 돌 모두 넉아웃',
    alkkagiHighlightGauge: '게이지로 힘 조절 · 벽 반사',

    curlingWin: '라운드 합산 점수가 높은 쪽 승리',
    curlingLose: '합산 점수가 낮으면 패배',
    curlingHighlightRules: '스톤 미끄러뜨리기 · 라운드제',

    fallbackWin: '대국 진행에 따라 승패 결정',
    fallbackLose: '대국 진행에 따라 패배가 결정되면 패배',

    spDefaultWin: '스테이지 조건 충족 시 승리',
    spDefaultLose: '조건 미달 시 패배',
    spSurvivalWin: '{{n}}턴 내 백 {{tgt}}점 미달성',
    spSurvivalLose: '{{n}}턴 내 백 {{tgt}}점 달성',
    spCaptureTurnWin: '{{limit}}턴 내 {{target}}점 획득',
    spCaptureTurnLoseBoth: '{{limit}}턴 초과 / 백 {{target}}점 획득',
    spCaptureTurnLoseMiss: '{{limit}}턴 내 목표 미달',
    spCaptureRaceWin: '{{target}}점 먼저 획득',
    spCaptureRaceLose: '백 {{target}}점 먼저 획득',
    spCaptureCapWin: '{{cap}}점 먼저 획득',
    spCaptureCapLose: '백이 {{cap}}점 먼저 획득',
    spCaptureGoalWin: '목표점수 달성',
    spCaptureGoalLose: '백이 목표 먼저 달성',
    spSpeedWin: '계가 종합점수에서 승리',
    spSpeedLose: '계가에서 패배',
    spAutoScoringWin: '{{n}}수 계가 후 승리',
    spAutoScoringLose: '{{n}}수 계가 후 패배',
    spLegacyTurnWin: '{{limit}}턴 내 {{target}}점 이상',
    spLegacyTurnLose: '{{limit}}턴 내 목표 미달',
    spLegacyTerritoryWin: '계가 흑 {{black}}집+ · 백 {{white}}집+',
    spLegacyTerritoryLose: '목표 집수 미달',
    spTerritoryWin: '계가 시 집이 더 많으면 승',
    spTerritoryLose: '계가에서 열세',
};

const SUMMARY_EN: Record<string, string> = {
    loseTerritory: 'Lose if territory is lower at scoring (or tie rules favor opponent)',
    loseTerritoryAuto: '{{base}} · lose if you cannot win by {{auto}}',
    loseCaptureRace: 'Lose if opponent reaches {{t}} capture points first · otherwise lose if territory is lower at scoring',
    loseMix: 'Lose if opponent meets win conditions first or you are worse off when capture/scoring ends',

    basePlacementAnalysis: 'Base stones revealed, then position analysis',
    baseKomiSelect: 'Set komi for opponent · choose your stones',

    autoScoringCaptureTurn: 'Auto scoring at {{n}} turns (moves)',
    autoScoringTerritoryWin: 'Win by scoring after {{n}} moves (turns)',
    autoScoringTerritoryLose: 'Lose at auto scoring after {{n}} moves (turns)',

    fischerOnly: 'Fischer {{sec}}s',
    byoyomiOnly: 'Byoyomi only · {{time}}s×{{count}}',
    noTimeLimit: 'No time limit',
    limitFischer: '{{min}} min limit · Fischer {{sec}}s',
    limitByoyomi: '{{min}} min limit · byoyomi {{time}}s×{{count}}',
    limitNoByoyomi: '{{min}} min limit (no byoyomi)',

    factorTerritory: 'Territory',
    factorCaptured: 'Captured stones',
    factorDead: 'Dead stones',
    factorKomi: 'Komi (White)',
    factorBaseBonus: 'Base bonus',
    factorHiddenBonus: 'Hidden bonus',
    factorSpeedBonus: 'Over {{sec}}s per move → opponent +1',
    factorMissileEffect: 'Missile effect',
    factorCaptureScore: 'Capture score',
    factorMixFallback: 'Depends on mode mix',
    factorCaptureNoTerritory: 'Capture score (no territory scoring)',
    factorCastle: 'Fixed territory · captures · komi (White)',
    factorChess: 'Territory · captures · dead stones · piece captures · komi (White)',
    factorOmok: 'Five in a row — no territory scoring',
    factorTtamok: 'Five in a row or capture score',
    factorDice: 'Per-round White capture score · last-capture bonus',
    factorThief: 'Sum of per-round scores',
    factorAlkkagi: 'Opponent stones knocked off the board',
    factorCurling: 'Stones closer to the house score',
    factorFallback: 'See mode guide',
    factorStageDefault: 'Depends on stage and mode',
    factorStageCapture: 'Capture score',
    factorStageCapturePattern: 'Capture score\nPattern stones 2 pts',
    factorStageSpeed: 'Territory · captures · dead stones · komi\nTime bonus',
    factorAdventureCaptureShort: 'Capture · pattern 2 pts',
    factorAdventureBase: 'Standard scoring',
    factorAdventureBaseStone5: 'Base stones 5 pts',
    factorAdventureHidden: 'Hidden',
    factorAdventureSpeed: 'Time',
    factorAdventureMissile: 'Missile',

    itemHidden: 'Hidden {{n}}',
    itemScan: 'Scan {{n}}',
    itemMissile: 'Missile {{n}}',
    itemSpecialDice: 'Special dice {{summary}}',
    itemSlowAim: 'Slow {{slow}} · Aim {{aim}}',

    mixCaptureWin: 'Instant win at {{t}} capture points · else compare territory after scoring',
    mixCaptureWinWithAuto: 'Instant win at {{t}} capture points · else compare territory after scoring · {{auto}}',
    mixAutoTerritoryWin: '{{auto}} — more territory wins',
    mixComboTail: 'Mix ({{modes}}) — outcome by combined rules at end',
    mixDefaultEnd: 'Outcome decided by rules at end',

    highlightPatternStone2: 'Pattern stone capture worth 2',
    highlightHiddenScan: 'Hidden moves · scan to find',
    highlightMissileMove: 'Move a stone in a straight line with missile',
    speedPvpHighlight: `${SEC}s per move byoyomi · opponent +1 per ${SEC}s over · time forfeit when main time runs out`,
    highlightSurvival: 'Survival go · block White goal within {{n}} turns',
    highlightAutoScoring: 'Auto scoring after {{n}} moves',
    highlightBlackTurnLimit: 'Black limited to {{n}} turns',
    highlightTurnAdd: 'Turn add {{n}}',
    highlightMissile: 'Missile {{n}}',
    highlightHiddenScanCounts: 'Hidden {{hidden}} · Scan {{scan}}',

    spTimeMainFischer: 'Main {{min}} min · {{sec}}s per-move byoyomi',
    spTimeFischerOnly: '{{sec}}s per-move byoyomi',
    spTimeUnlimited: 'No limit',

    goalSurvivalWinLabel: 'Block White',
    goalSurvivalWinHelper: 'Stop White goal for {{n}} turns',
    goalSurvivalLoseLabel: 'White succeeds',
    goalSurvivalLoseHelper: 'Fail if White reaches the goal',
    goalCaptureWinLabel: 'Capture',
    goalCaptureWinHelper: 'Surround opponent stones for points',
    goalCaptureLoseTurnLabel: 'Turn limit',
    goalCaptureLoseTurnHelper: 'Fail if not done within {{n}} turns',
    goalCaptureLoseFirstLabel: 'Opponent first',
    goalCaptureLoseFirstHelper: 'Fail if opponent captures first',
    goalSpeedWinLabel: 'Play fast',
    goalSpeedWinHelper: 'Build territory while keeping time',
    goalSpeedLoseLabel: 'Score behind',
    goalSpeedLoseHelper: 'Fail if territory is too low',
    goalAutoWinLabel: 'More territory',
    goalAutoWinHelper: 'Territory counted after {{n}} moves',
    goalAutoLoseLabel: 'Not enough territory',
    goalAutoLoseHelper: 'Fail if behind at {{n}} moves',
    goalDefaultWinLabel: 'Build territory',
    goalDefaultWinHelper: 'Enclose areas to make territory',
    goalDefaultLoseLabel: 'Not enough territory',
    goalDefaultLoseHelper: 'Fail if territory is too low',

    guideTurnLimitTitle: 'Turn limit',
    guideTurnLimitBody: 'Finish within {{n}} turns',
    guideSurvivalTitle: 'Block',
    guideSurvivalBody: 'Block White goal for {{n}} turns',
    guideAutoScoringTitle: 'Scoring',
    guideAutoScoringBody: 'Territory counted after {{n}} moves',
    guidePatternStoneTitle: 'Pattern stone',
    guidePatternStoneBody: 'Worth 2 when captured',
    guideSpeedTitle: 'Speed',
    guideSpeedBody: 'Late moves give opponent +1',
    guideTurnAddTitle: 'Turn add',
    guideTurnAddBody: 'Extend turn limit',
    guideMissileTitle: 'Missile',
    guideMissileBody: 'Pick a stone and push in a line',
    guideHiddenScanTitle: 'Hidden · Scan',
    guideHiddenScanBody: 'Hide {{hidden}} · Find {{scan}}',

    advCaptureWin: 'Win by capture',
    advCaptureLose: 'Lose by capture · time out',
    advTerritoryWin: 'Win by scoring',
    advTerritoryWinAuto: 'Win by scoring · auto at {{n}} moves',
    advTerritoryLose: 'Lose by scoring · time out',
    advTimeLimit: '{{mins}} min limit',

    gwCaptureWinAuto: 'First to {{cap}} pts or win scoring at {{limit}} turns',
    gwCaptureWin: 'First to {{cap}} capture points wins',
    gwCaptureLose: 'Opponent reaches {{cap}} first',
    gwTerritoryWinAuto: 'Win scoring with more territory · auto at {{limit}} moves',
    gwTerritoryWin: 'Win if you have more territory at scoring',
    gwTerritoryLose: 'Lose scoring · time out',

    captureWin: 'Capture {{t}} opponent points first',
    captureWinWithAuto: 'Capture {{t}} opponent points first · {{auto}}',
    territoryWinDefault: 'More territory wins after scoring',
    speedTerritoryWinDefault: 'Higher total score wins after scoring',
    speedTerritoryLoseDefault: 'Lose if total score is lower after scoring',

    castleWin: 'Instant win capturing ≥1 opponent stone · else territory scoring if no valid move',
    castleLose: 'Lose if any stone is captured · or lower territory at scoring',
    castleHighlightCount: '{{castles}} castles · completed territory cannot be entered',
    castleHighlightCapture: 'Instant win on 1-stone capture',

    chessWin: 'Scoring after set sequence',
    chessLose: 'Lose at scoring · instant loss if king is captured',
    chessHighlightBudget: 'Place pieces within {{budget}} total points (king fixed center on 2nd rank)',
    chessHighlightMovement: 'Move piece stones like chess once per turn (limited uses)',

    omokWin: 'First five in a row (horizontal, vertical, diagonal)',
    omokLose: 'Lose if opponent completes five first',
    omok33Forbidden: 'Double-three forbidden',
    omok33Allowed: 'Double-three allowed',
    omokOverlineForbidden: 'Overline forbidden',
    omokOverlineAllowed: 'Overline allowed',

    ttamokWin: 'Five in a row or first to {{cap}} capture points',
    ttamokLose: 'Lose if opponent gets five first or {{cap}} capture points first',
    ttamokHighlightCapture: 'Win at {{cap}} capture points',

    diceWin: 'Higher total score after {{r}} rounds',
    diceLose: 'Lose if total score is lower after {{r}} rounds',
    diceHighlightRules: 'Black plays dice count · White only on marked points',

    thiefWin: 'Higher total after 5 turns × rounds',
    thiefLose: 'Lose if total score is lower after rounds',
    thiefHighlightRoles: 'Thief (Black) and police (White) roles alternate',

    alkkagiWin: 'Knock all opponent stones off',
    alkkagiLose: 'Lose if all your stones are knocked off',
    alkkagiHighlightGauge: 'Gauge power · wall bounce',

    curlingWin: 'Higher combined round score wins',
    curlingLose: 'Lose if combined score is lower',
    curlingHighlightRules: 'Slide stones · round-based',

    fallbackWin: 'Outcome follows match progress',
    fallbackLose: 'Lose when match rules declare defeat',

    spDefaultWin: 'Win when stage conditions are met',
    spDefaultLose: 'Lose if conditions are not met',
    spSurvivalWin: 'White under {{tgt}} pts within {{n}} turns',
    spSurvivalLose: 'White reaches {{tgt}} pts within {{n}} turns',
    spCaptureTurnWin: 'Reach {{target}} pts within {{limit}} turns',
    spCaptureTurnLoseBoth: 'Over {{limit}} turns / White reaches {{target}} pts',
    spCaptureTurnLoseMiss: 'Miss goal within {{limit}} turns',
    spCaptureRaceWin: 'Reach {{target}} pts first',
    spCaptureRaceLose: 'White reaches {{target}} pts first',
    spCaptureCapWin: 'Reach {{cap}} pts first',
    spCaptureCapLose: 'White reaches {{cap}} pts first',
    spCaptureGoalWin: 'Reach target score',
    spCaptureGoalLose: 'White reaches target first',
    spSpeedWin: 'Win total score at scoring',
    spSpeedLose: 'Lose at scoring',
    spAutoScoringWin: 'Win after scoring at {{n}} moves',
    spAutoScoringLose: 'Lose after scoring at {{n}} moves',
    spLegacyTurnWin: 'At least {{target}} pts within {{limit}} turns',
    spLegacyTurnLose: 'Miss goal within {{limit}} turns',
    spLegacyTerritoryWin: 'Scoring: Black {{black}}+ · White {{white}}+',
    spLegacyTerritoryLose: 'Below target territory',
    spTerritoryWin: 'Win if you have more territory at scoring',
    spTerritoryLose: 'Lose at scoring',
};

const ITEM_SLOT_KO: Record<string, string> = {
    hiddenStone: '히든 돌',
    scan: '스캔',
    missile: '미사일',
    diceOdd: '홀수 주사위 아이템',
    diceEven: '짝수 주사위 아이템',
    diceLow: '낮은 수(1~3) 주사위 아이템',
    diceHigh: '높은 수(4~6) 주사위 아이템',
    slow: '슬로우',
    aimLine: '조준선',
    turnAdd: '턴 추가',
};

const ITEM_SLOT_EN: Record<string, string> = {
    hiddenStone: 'Hidden stone',
    scan: 'Scan',
    missile: 'Missile',
    diceOdd: 'Odd dice item',
    diceEven: 'Even dice item',
    diceLow: 'Low (1–3) dice item',
    diceHigh: 'High (4–6) dice item',
    slow: 'Slow',
    aimLine: 'Aiming line',
    turnAdd: 'Turn add',
};

function loadJson(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file: string, data: unknown): void {
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function merge(locale: 'ko' | 'en'): void {
    const file = path.join(catalogDir, `${locale}.json`);
    const catalog = loadJson(file);
    const game = (catalog.game ?? {}) as Record<string, unknown>;
    const preGame = (game.preGame ?? {}) as Record<string, unknown>;

    const summaryKo = locale === 'ko' ? SUMMARY_KO : SUMMARY_EN;
    const itemKo = locale === 'ko' ? ITEM_SLOT_KO : ITEM_SLOT_EN;

    preGame.summary = summaryKo;
    preGame.itemSlot = itemKo;

    game.preGame = preGame;
    catalog.game = game;
    saveJson(file, catalog);

    console.log(
        `[i18n:pregame-summary] merged ${Object.keys(summaryKo).length} summary keys and ${Object.keys(itemKo).length} item-slot keys into ${locale}.json`,
    );
}

merge('ko');
merge('en');
