/**
 * Complete i18n migration for remaining game UI Korean strings.
 * Run: node scripts/i18n/_migrate-remaining-game-ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function writeJson(rel, obj) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
}

function ensureImport(content, importLine) {
  if (content.includes(importLine.trim())) return content;
  const idx = content.indexOf('\n');
  return content.slice(0, idx + 1) + importLine + content.slice(idx + 1);
}

function ensureHookAfter(content, marker, hookLine) {
  if (content.includes(hookLine.trim())) return content;
  const idx = content.indexOf(marker);
  if (idx < 0) return content;
  const brace = content.indexOf('{', idx);
  const nl = content.indexOf('\n', brace);
  return content.slice(0, nl + 1) + hookLine + content.slice(nl + 1);
}

const ko = readJson('shared/i18n/catalog/ko.json');
const en = readJson('shared/i18n/catalog/en.json');

// --- Extend game namespace ---
Object.assign(ko.game.controls, {
  specialFeatures: '특수 기능',
  resign: '기권',
  resignAlt: '기권',
  goldAlt: '골드',
  hiddenPlaceTitle: '히든 스톤 배치',
  scanDetectTitle: '상대 히든 스톤 탐지',
  missileLaunchTitle: '미사일 발사',
  stoneRefreshTitle: '돌 재배치',
  rematch: '재대결',
  rematchApplying: '신청중',
  thiefHigh36Aria: '높은 수(3~6) 주사위 아이템, 남은 개수 {{count}}',
  thiefHigh36Title: '높은 수(3·4·5·6)만 나오는 주사위. 남은 개수 {{count}}',
  thiefNoOneAria: '1방지(2~5) 주사위 아이템, 남은 개수 {{count}}',
  thiefNoOneTitle: '1이 나오지 않는 주사위(2·3·4·5). 남은 개수 {{count}}',
  thiefHigh36UseTitle: '높은 수(3~6) 주사위 사용',
  thiefHigh36UseBody: '3·4·5·6만 나오는 주사위 아이템을 1개 사용합니다. 경찰 턴이면 두 주사위 모두 이 범위입니다. 계속하시겠습니까?',
  thiefNoOneUseTitle: '1방지 주사위 사용',
  thiefNoOneUseBody: '2·3·4·5만 나오는 주사위(1 불가) 아이템을 1개 사용합니다. 경찰 턴이면 두 주사위 모두 이 범위입니다. 계속하시겠습니까?',
});

Object.assign(en.game.controls, {
  specialFeatures: 'Special features',
  resign: 'Resign',
  resignAlt: 'Resign',
  goldAlt: 'Gold',
  hiddenPlaceTitle: 'Place hidden stone',
  scanDetectTitle: 'Detect opponent hidden stones',
  missileLaunchTitle: 'Launch missile',
  stoneRefreshTitle: 'Refresh stones',
  rematch: 'Rematch',
  rematchApplying: 'Pending',
  thiefHigh36Aria: 'High dice (3–6) item, {{count}} left',
  thiefHigh36Title: 'Dice showing 3·4·5·6 only. {{count}} left',
  thiefNoOneAria: 'No-one (2–5) dice item, {{count}} left',
  thiefNoOneTitle: 'Dice without 1 (2·3·4·5). {{count}} left',
  thiefHigh36UseTitle: 'Use high dice (3–6)',
  thiefHigh36UseBody: 'Use 1 high dice item (3, 4, 5, or 6 only). On police turn both dice use this range. Continue?',
  thiefNoOneUseTitle: 'Use no-one dice',
  thiefNoOneUseBody: 'Use 1 no-one dice item (2–5 only). On police turn both dice use this range. Continue?',
});

Object.assign(ko.game, {
  baseFooter: {
    randomPlace: '랜덤 배치',
    randomPlaceTitle: '남은 돌 무작위 배치',
    randomPlaceDisabled: '남은 베이스돌이 없습니다',
    reset: '재배치',
    resetTitle: '배치한 베이스돌을 모두 치웁니다',
    resetDisabled: '칠 베이스돌이 없습니다',
    confirmComplete: '배치 완료',
    confirmed: '확인 완료',
    waitingOpponent: '상대의 배치 완료를 기다리는 중입니다.',
    confirmNextStep: '배치를 마쳤다면 눌러 다음 단계로 진행합니다.',
    placeAllFirst: '베이스돌을 모두 놓은 뒤 눌러 주세요.',
    basePlacementTitle: '베이스돌 배치',
    basePlacementHint: '베이스돌을 배치하세요. ({{placed}}/{{total}})',
    confirmStart: '대국 시작',
    confirmStartHint: '대국 시작 버튼을 누르면 착수가 시작됩니다.',
    hostPlacesBoth: '방장이 양쪽 베이스돌을 배치합니다.',
    basePlacementPhase: '베이스돌 배치 단계입니다.',
    hostPlacementSide: '방장 배치: {{side}} 측 베이스돌',
    confirmPlacementFull: '남은 베이스돌 (0/{{total}}) · 배치 완료를 눌러 주세요',
    proceedingNext: '남은 베이스돌 (0/{{total}}) · 다음 단계로 진행 중…',
    waitingOpponentShort: '남은 베이스돌 (0/{{total}}) · 상대 확인 대기 중…',
    placeVisibleAdventure: '베이스돌을 바둑판에 놓으세요',
    placeHidden: '상대에게 보이지 않게 베이스돌을 바둑판에 놓으세요',
    timeRemainingSec: '남은 시간 {{sec}}초',
  },
  placementRefresh: {
    title: '배치변경',
    notAllowedStage: '이 스테이지에서는 배치변경을 사용할 수 없습니다.',
    missileFirstTurn: '첫 턴에 미사일을 사용하면 배치변경을 사용할 수 없습니다.',
    noRefreshesLeft: '재배치 횟수를 모두 사용했습니다.',
    waitForStart: '게임이 시작되면 재배치할 수 있습니다.',
    beforeFirstMove: '첫 수를 두기 전에만 재배치할 수 있습니다.',
    insufficientGold: '골드가 부족합니다.',
    paused: '일시 정지 상태에서는 재배치할 수 없습니다.',
    confirmPaid: '{{gold}} 골드를 사용하여 배치를 다시 섞으시겠습니까? (남은 재배치 {{remaining}}/5)',
    confirmFree: '첫 재배치는 무료입니다. 배치를 다시 섞으시겠습니까?',
    priceLine: '이용 가격: {{price}}',
    priceFree: '이용 가격: 무료',
    refreshTitle: '배치 새로고침',
    refreshDisabled: '배치 새로고침 불가',
    refreshTitleWithCost: '배치 새로고침 (비용: {{cost}}골드, 남은 횟수: {{remaining}}/5)',
    confirmModalTitle: '배치변경',
    confirmModalMessagePaid: '{{priceLine}}\n\n{{gold}} 골드를 사용하여 배치를 다시 섞으시겠습니까? (남은 재배치 {{remaining}}/5)',
    confirmModalMessageFree: '{{priceLine}}\n\n첫 재배치는 무료입니다. 배치를 다시 섞으시겠습니까?',
    towerRefreshTitle: '배치변경',
    towerRefreshMessage: '이용 가격: 배치 새로고침 1개\n\n배치를 다시 섞으시겠습니까?',
    towerShopHint: '도전의 탑 아이템 상점에서 구매',
    towerRefreshActive: '배치 새로고침',
    turnAddTitle: '턴 추가',
    turnAddActive: '남은 턴 3턴 추가',
    turnAddMessage: '턴 추가 아이템 1개를 사용하여 흑의 제한 턴을 3턴 늘리시겠습니까? 확인 시 바로 적용됩니다.',
    passConfirmTitle: '통과 확인',
    passConfirmBoth: '양측 연속 통과 시 계가로 진행됩니다. 통과하시겠습니까?',
    passConfirmSingle: '한 수 쉬시겠습니까? 통과하면 상대(AI)에게 차례가 넘어갑니다.',
    useItem: '사용',
  },
  pveControls: {
    retryFailed: '재도전에 실패했습니다. 다시 시도해주세요.',
    nextStageFailed: '다음 층 시작에 실패했습니다. 다시 시도해주세요.',
    nextStepFailed: '다음 단계 시작에 실패했습니다. 다시 시도해주세요.',
    resignConfirmTitle: '기권 확인',
  },
  alerts: {
    noContestConfirm: '상대방의 장고로 인해 페널티 없이 무효 처리하고 나가시겠습니까?',
    cannotResignScoring: '계가 집계 중에는 기권할 수 없습니다.',
    sessionExpired: '게임 세션이 만료되었습니다. 대기실에서 스테이지를 다시 선택해 주세요.',
    startFailed: '게임 시작에 실패했습니다. 다시 시도해주세요.',
  },
  pairAiRematch: {
    title: '페어바둑 AI와 재대결',
    start: 'AI와 대국 시작',
  },
  preGame: {
    none: '없음',
    quantity: '수량 {{count}}',
    quantityBuy: '{{title}} 구매',
    itemShop: '아이템 상점',
    itemShopAria: '{{a11y}}. 탭하여 도전의 탑 아이템 상점 열기',
    goalTitle: '이번 목표',
    winCondition: '승리 조건',
    failConditionTitle: '주의할 실패 조건',
    scoreFactors: '점수 요인',
    timeRules: '시간 규칙',
    items: '아이템',
    noItems: '아이템 없음',
    howToPlay: '하는 법',
    stageKeyPoints: '이번 스테이지 핵심',
    cautionPoints: '주의할 점',
    patternStone2pts: '문양돌은 2점',
    goalAchievement: '목표 달성',
    missilePush: '미사일로 밀기',
    turnAddUse: '턴 추가 사용',
    lowTerritoryFail: '집이 적으면 실패',
    capture: '따내기',
    speed: '스피드',
    base: '베이스',
    hidden: '히든',
    scan: '스캔',
    missile: '미사일',
    dice: '주사위',
    omok: '오목',
    alkkagi: '알까기',
    curling: '컬링',
    thiefPolice: '도둑과경찰',
    classic: '클래식',
    mix: '믹스',
  },
  singlePlayerInfo: {
    close: '닫기',
    proverbsTitle: '바둑 격언',
    quotes: [
      { term: '부득탐승(不得貪勝)', meaning: '너무 이기려고 탐하지 말라.' },
      { term: '입계의완(入界宜緩)', meaning: '상대의 세력권에 들어갈 때는 천천히, 그리고 부드럽게 들어가라.' },
      { term: '공피고아(攻彼顧我)', meaning: '상대를 공격하기 전에 나를 먼저 돌아보고 약점이 없는지 살펴라.' },
      { term: '기자쟁선(棄子爭先)', meaning: '작은 돌을 버리더라도 선수를 잡아 더욱 important한 곳으로 향하라.' },
    ],
  },
  analysis: {
    title: '분석',
    close: '닫기',
    loading: '분석 중...',
    noData: '분석 데이터가 없습니다.',
  },
});

Object.assign(en.game, {
  baseFooter: {
    randomPlace: 'Random placement',
    randomPlaceTitle: 'Place remaining stones randomly',
    randomPlaceDisabled: 'No base stones left',
    reset: 'Reset',
    resetTitle: 'Clear all placed base stones',
    resetDisabled: 'No stones to clear',
    confirmComplete: 'Confirm placement',
    confirmed: 'Confirmed',
    waitingOpponent: 'Waiting for opponent to confirm placement.',
    confirmNextStep: 'Press when done to proceed.',
    placeAllFirst: 'Place all base stones first.',
    basePlacementTitle: 'Base stone placement',
    basePlacementHint: 'Place base stones. ({{placed}}/{{total}})',
    confirmStart: 'Start game',
    confirmStartHint: 'Press Start game to begin play.',
    hostPlacesBoth: 'Host places base stones for both sides.',
    basePlacementPhase: 'Base stone placement phase.',
    hostPlacementSide: 'Host placing: {{side}} base stones',
    confirmPlacementFull: 'Remaining base stones (0/{{total}}) · press Confirm placement',
    proceedingNext: 'Remaining base stones (0/{{total}}) · proceeding…',
    waitingOpponentShort: 'Remaining base stones (0/{{total}}) · waiting for opponent…',
    placeVisibleAdventure: 'Place base stones on the board',
    placeHidden: 'Place base stones hidden from opponent',
    timeRemainingSec: '{{sec}}s remaining',
  },
  placementRefresh: {
    title: 'Refresh layout',
    notAllowedStage: 'Layout refresh is not available on this stage.',
    missileFirstTurn: 'Cannot refresh after using missile on the first turn.',
    noRefreshesLeft: 'No refreshes remaining.',
    waitForStart: 'Refresh available after the game starts.',
    beforeFirstMove: 'Refresh only before the first move.',
    insufficientGold: 'Not enough gold.',
    paused: 'Cannot refresh while paused.',
    confirmPaid: 'Spend {{gold}} gold to shuffle the layout? ({{remaining}}/5 refreshes left)',
    confirmFree: 'First refresh is free. Shuffle the layout?',
    priceLine: 'Price: {{price}}',
    priceFree: 'Price: free',
    refreshTitle: 'Refresh layout',
    refreshDisabled: 'Refresh unavailable',
    refreshTitleWithCost: 'Refresh (cost: {{cost}} gold, {{remaining}}/5 left)',
    confirmModalTitle: 'Refresh layout',
    confirmModalMessagePaid: '{{priceLine}}\n\nSpend {{gold}} gold to shuffle? ({{remaining}}/5 left)',
    confirmModalMessageFree: '{{priceLine}}\n\nFirst refresh is free. Shuffle the layout?',
    towerRefreshTitle: 'Refresh layout',
    towerRefreshMessage: 'Cost: 1 layout refresh\n\nShuffle the layout?',
    towerShopHint: 'Buy in Tower item shop',
    towerRefreshActive: 'Refresh layout',
    turnAddTitle: 'Add turns',
    turnAddActive: 'Add 3 turns',
    turnAddMessage: 'Use 1 turn-add item to add 3 turns to Black\'s limit. Applies immediately. Continue?',
    passConfirmTitle: 'Confirm pass',
    passConfirmBoth: 'Both sides passing in a row triggers scoring. Pass?',
    passConfirmSingle: 'Pass your turn? The opponent (AI) will play next.',
    useItem: 'Use',
  },
  pveControls: {
    retryFailed: 'Retry failed. Please try again.',
    nextStageFailed: 'Failed to start next floor. Please try again.',
    nextStepFailed: 'Failed to start next stage. Please try again.',
    resignConfirmTitle: 'Confirm resignation',
  },
  alerts: {
    noContestConfirm: 'Leave with no penalty due to opponent delay?',
    cannotResignScoring: 'Cannot resign during scoring.',
    sessionExpired: 'Session expired. Select the stage again in the lobby.',
    startFailed: 'Failed to start game. Please try again.',
  },
  pairAiRematch: {
    title: 'Pair Go AI rematch',
    start: 'Start AI match',
  },
  preGame: {
    none: 'None',
    quantity: 'Qty {{count}}',
    quantityBuy: 'Buy {{title}}',
    itemShop: 'Item shop',
    itemShopAria: '{{a11y}}. Tap to open Tower item shop',
    goalTitle: 'This goal',
    winCondition: 'Win condition',
    failConditionTitle: 'Failure conditions',
    scoreFactors: 'Score factors',
    timeRules: 'Time rules',
    items: 'Items',
    noItems: 'No items',
    howToPlay: 'How to play',
    stageKeyPoints: 'Stage highlights',
    cautionPoints: 'Watch out',
    patternStone2pts: 'Pattern stones worth 2',
    goalAchievement: 'Reach the goal',
    missilePush: 'Push with missile',
    turnAddUse: 'Use turn add',
    lowTerritoryFail: 'Fail if territory is too low',
    capture: 'Capture',
    speed: 'Speed',
    base: 'Base',
    hidden: 'Hidden',
    scan: 'Scan',
    missile: 'Missile',
    dice: 'Dice',
    omok: 'Omok',
    alkkagi: 'Alkkagi',
    curling: 'Curling',
    thiefPolice: 'Thief & police',
    classic: 'Classic',
    mix: 'Mix',
  },
  singlePlayerInfo: {
    close: 'Close',
    proverbsTitle: 'Go proverbs',
    quotes: [],
  },
  analysis: {
    title: 'Analysis',
    close: 'Close',
    loading: 'Analyzing…',
    noData: 'No analysis data.',
  },
});

// Fix typo in ko quotes
ko.game.singlePlayerInfo.quotes = [
  { term: '부득탐승(不得貪勝)', meaning: '너무 이기려고 탐하지 말라.' },
  { term: '입계의완(入界宜緩)', meaning: '상대의 세력권에 들어갈 때는 천천히, 그리고 부드럽게 들어가라.' },
  { term: '공피고아(攻彼顧我)', meaning: '상대를 공격하기 전에 나를 먼저 돌아보고 약점이 없는지 살펴라.' },
  { term: '기자쟁선(棄子爭先)', meaning: '작은 돌을 버리더라도 선수를 잡아 더욱 중요한 곳으로 향하라.' },
  { term: '사소취대(捨小就大)', meaning: '작은 이익을 버리고 큰 이익을 취하라.' },
  { term: '봉위수기(逢危須棄)', meaning: '위험에 처하면 돌을 버릴 줄 알아야 한다.' },
  { term: '신물경속(愼勿輕速)', meaning: '신중하되, 경솔하고 빠르게 두지 말라.' },
  { term: '동수상응(動須相應)', meaning: '돌의 행마는 서로 호응하며 리듬을 타야 한다.' },
  { term: '피강자보(彼强自保)', meaning: '상대가 강한 곳에서는 나 자신을 먼저 지켜라.' },
  { term: '세고취화(勢孤取和)', meaning: '세력이 약하고 외로울 때는 싸우지 말고 평화를 취하라.' },
  { term: '아생연후살타(我生然後殺他)', meaning: '나의 돌을 먼저 살린 후에 상대의 돌을 잡으러 가라.' },
  { term: '적의 급소는 나의 급소', meaning: '상대가 두고 싶어하는 좋은 자리는 나에게도 좋은 자리이다.' },
];

writeJson('shared/i18n/catalog/ko.json', ko);
writeJson('shared/i18n/catalog/en.json', en);

function patchFile(rel, patches) {
  let f = read(rel);
  let n = 0;
  for (const [from, to] of patches) {
    if (f.includes(from)) {
      f = f.replaceAll(from, to);
      n++;
    }
  }
  write(rel, f);
  return n;
}

function patchOnce(rel, from, to) {
  let f = read(rel);
  if (!f.includes(from)) return false;
  write(rel, f.replace(from, to));
  return true;
}

// --- GameControls.tsx ---
{
  let f = read('components/game/GameControls.tsx');
  if (!f.includes('runtimeText')) {
    f = f.replace(
      "import i18n from '../../shared/i18n/config.js';",
      "import i18n from '../../shared/i18n/config.js';\nimport { tx } from '../../shared/i18n/runtimeText.js';",
    );
  }
  const gc = [
    ['ariaLabel: `홀수 주사위 아이템, 남은 개수 ${count}`', 'ariaLabel: tx(\'game:controls.oddDiceAria\', { count })'],
    ['title: `홀수(1·3·5) 주사위 아이템. 남은 개수 ${count}`', 'title: tx(\'game:controls.oddDiceTitle\', { count })'],
    ['ariaLabel: `짝수 주사위 아이템, 남은 개수 ${count}`', 'ariaLabel: tx(\'game:controls.evenDiceAria\', { count })'],
    ['title: `짝수(2·4·6) 주사위 아이템. 남은 개수 ${count}`', 'title: tx(\'game:controls.evenDiceTitle\', { count })'],
    ['ariaLabel: `낮은 수 주사위 아이템, 남은 개수 ${count}`', 'ariaLabel: tx(\'game:controls.lowDiceAria\', { count })'],
    ['title: `낮은 수(1·2·3) 주사위 아이템. 남은 개수 ${count}`', 'title: tx(\'game:controls.lowDiceTitle\', { count })'],
    ['ariaLabel: `높은 수 주사위 아이템, 남은 개수 ${count}`', 'ariaLabel: tx(\'game:controls.highDiceAria\', { count })'],
    ['title: `높은 수(4·5·6) 주사위 아이템. 남은 개수 ${count}`', 'title: tx(\'game:controls.highDiceTitle\', { count })'],
    ["title: '홀수 주사위 사용',\n                    body: '홀수(1·3·5)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?'", "title: t('controls.oddDiceUseTitle'),\n                    body: t('controls.oddDiceUseBody')"],
    ["title: '짝수 주사위 사용',\n                    body: '짝수(2·4·6)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?'", "title: t('controls.evenDiceUseTitle'),\n                    body: t('controls.evenDiceUseBody')"],
    ["title: '낮은 수 주사위 사용',\n                    body: '낮은 수(1·2·3)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?'", "title: t('controls.lowDiceUseTitle'),\n                    body: t('controls.lowDiceUseBody')"],
    ["title: '높은 수 주사위 사용',\n                    body: '높은 수(4·5·6)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?'", "title: t('controls.highDiceUseTitle'),\n                    body: t('controls.highDiceUseBody')"],
    ['alt="슬로우"\n                    label="슬로우"', 'alt={tx(\'game:controls.slow\')}\n                    label={tx(\'game:controls.slow\')}'],
    ["caption={isSlowActive ? '사용중' : undefined}", "caption={isSlowActive ? tx('game:controls.inUse') : undefined}"],
    ['title={`슬로우 : 힘조절 그래프의 속도를 줄여줍니다. 남은 개수: ${slowCount}`}', "title={tx('game:controls.slowTitle', { count: slowCount })}"],
    ['alt="조준선"\n                    label="조준선"', 'alt={tx(\'game:controls.aimingLine\')}\n                    label={tx(\'game:controls.aimingLine\')}'],
    ["caption={isAimActive ? '사용중' : undefined}", "caption={isAimActive ? tx('game:controls.inUse') : undefined}"],
    ['title={`조준선 : 조준선의 길이가 길어집니다. 남은 개수: ${aimCount}`}', "title={tx('game:controls.aimTitle', { count: aimCount })}"],
    ['alt="슬로우"\n                label="슬로우"', 'alt={tx(\'game:controls.slow\')}\n                label={tx(\'game:controls.slow\')}'],
    ['alt="조준선"\n                label="조준선"', 'alt={tx(\'game:controls.aimingLine\')}\n                label={tx(\'game:controls.aimingLine\')}'],
    ['ariaLabel: `높은 수(3~6) 주사위 아이템, 남은 개수 ${count}`', 'ariaLabel: tx(\'game:controls.thiefHigh36Aria\', { count })'],
    ['title: `높은 수(3·4·5·6)만 나오는 주사위. 남은 개수 ${count}`', 'title: tx(\'game:controls.thiefHigh36Title\', { count })'],
    ['ariaLabel: `1방지(2~5) 주사위 아이템, 남은 개수 ${count}`', 'ariaLabel: tx(\'game:controls.thiefNoOneAria\', { count })'],
    ['title: `1이 나오지 않는 주사위(2·3·4·5). 남은 개수 ${count}`', 'title: tx(\'game:controls.thiefNoOneTitle\', { count })'],
    ['<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">주사위</span>', '<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">{tx(\'game:controls.dice\')}</span>'],
    ["title: '높은 수(3~6) 주사위 사용',\n                    body: '3·4·5·6만 나오는 주사위 아이템을 1개 사용합니다. 경찰 턴이면 두 주사위 모두 이 범위입니다. 계속하시겠습니까?'", "title: tx('game:controls.thiefHigh36UseTitle'),\n                    body: tx('game:controls.thiefHigh36UseBody')"],
    ["title: '1방지 주사위 사용',\n                    body: '2·3·4·5만 나오는 주사위(1 불가) 아이템을 1개 사용합니다. 경찰 턴이면 두 주사위 모두 이 범위입니다. 계속하시겠습니까?'", "title: tx('game:controls.thiefNoOneUseTitle'),\n                    body: tx('game:controls.thiefNoOneUseBody')"],
    ['label="높은수"', 'label={tx(\'game:controls.highShort\')}'],
    ['label="1방지"', 'label={tx(\'game:controls.noOneShort\')}'],
    ["refreshHelperMessage = '이 스테이지에서는 배치변경을 사용할 수 없습니다.'", "refreshHelperMessage = t('placementRefresh.notAllowedStage')"],
    ["refreshHelperMessage = '첫 턴에 미사일을 사용하면 배치변경을 사용할 수 없습니다.'", "refreshHelperMessage = t('placementRefresh.missileFirstTurn')"],
    ["refreshHelperMessage = '재배치 횟수를 모두 사용했습니다.'", "refreshHelperMessage = t('placementRefresh.noRefreshesLeft')"],
    ["refreshHelperMessage = '게임이 시작되면 재배치할 수 있습니다.'", "refreshHelperMessage = t('placementRefresh.waitForStart')"],
    ["refreshHelperMessage = '첫 수를 두기 전에만 재배치할 수 있습니다.'", "refreshHelperMessage = t('placementRefresh.beforeFirstMove')"],
    ["refreshHelperMessage = '골드가 부족합니다.'", "refreshHelperMessage = t('placementRefresh.insufficientGold')"],
    ["refreshHelperMessage = '일시 정지 상태에서는 재배치할 수 없습니다.'", "refreshHelperMessage = t('placementRefresh.paused')"],
    ["? `${formatGoldAmountKoG(nextCost)} 골드를 사용하여 배치를 다시 섞으시겠습니까? (남은 재배치 ${remainingRefreshes}/5)`\n                : '첫 재배치는 무료입니다. 배치를 다시 섞으시겠습니까?'", "? t('placementRefresh.confirmPaid', { gold: formatGoldAmountKoG(nextCost), remaining: remainingRefreshes })\n                : t('placementRefresh.confirmFree')"],
    ["{rematchRequested ? '신청중' : '재대결'}", "{rematchRequested ? t('controls.rematchApplying') : t('controls.rematch')}"],
    ['alt="기권"', 'alt={t(\'controls.resignAlt\')}'],
    ["title={gameStatus === 'scoring' ? '계가 집계 중에는 기권할 수 없습니다.' : '기권하기'}", "title={gameStatus === 'scoring' ? t('controls.cannotResignDuringScoring') : t('controls.resignTitle')}"],
    ['>기권</span>', '>{t(\'controls.resign\')}</span>'],
    ['alt="돌 재배치"', 'alt={t(\'controls.stoneRefreshTitle\')}'],
    ["title={placementRefreshAllowed ? '돌 재배치' : '이 스테이지에서는 배치변경을 사용할 수 없습니다.'}", "title={placementRefreshAllowed ? t('controls.stoneRefreshTitle') : t('placementRefresh.notAllowedStage')}"],
    ['alt="골드"', 'alt={t(\'controls.goldAlt\')}'],
    ['alt="히든"', 'alt={t(\'controls.hidden\')}'],
    ['title="히든 스톤 배치"', "title={t('controls.hiddenPlaceTitle')}"],
    ['>히든</span>', '>{t(\'controls.hidden\')}</span>'],
    ['alt="스캔"', 'alt={t(\'controls.scan\')}'],
    ['title="상대 히든 스톤 탐지"', "title={t('controls.scanDetectTitle')}"],
    ['>스캔</span>', '>{t(\'controls.scan\')}</span>'],
    ['alt="미사일"', 'alt={t(\'controls.missile\')}'],
    ['title="미사일 발사"', "title={t('controls.missileLaunchTitle')}"],
    ['>미사일</span>', '>{t(\'controls.missile\')}</span>'],
    ["{savingGameRecord ? '저장 중...' : recordAlreadySaved ? '이미 저장됨' : '기보 저장'}", "{savingGameRecord ? t('controls.savingRecord') : recordAlreadySaved ? t('controls.recordAlreadySaved') : t('controls.saveRecord')}"],
    ["{isStrategic ? '특수 기능' : '놀이 기능'}", "{isStrategic ? t('controls.specialFeatures') : t('controls.playfulFeatures')}"],
    ['>관리자 기능</h3>', '>{t(\'controls.adminFeatures\')}</h3>'],
    ['>결과 보기</Button>', '>{t(\'controls.viewResult\')}</Button>'],
    ['>대기실로</Button>', '>{t(\'controls.returnToLobby\')}</Button>'],
    ['>기보 관리</Button>', '>{t(\'controls.manageRecords\')}</Button>'],
    ['{nextCost === 0 && <span>· 무료</span>}', '{nextCost === 0 && <span>· {t(\'common:shop.free\')}</span>}'],
    ['                                취소\n', '                                {t(\'common:actions.cancel\')}\n'],
    ['                                사용\n', '                                {t(\'common:actions.use\')}\n'],
  ];
  for (const [from, to] of gc) f = f.replaceAll(from, to);
  // ThiefPanel needs t hook
  if (!f.includes('const { t } = useTranslation') || !f.match(/ThiefPanel[\s\S]{0,200}useTranslation/)) {
    f = f.replace(
      '}> = ({ session, isMyTurn, onAction, currentUser, variant = \'all\', footerCompact = false, compactMain = false }) => {\n    const { id: gameId, gameStatus } = session;',
      '}> = ({ session, isMyTurn, onAction, currentUser, variant = \'all\', footerCompact = false, compactMain = false }) => {\n    const { t } = useTranslation([\'common\', \'game\']);\n    const { id: gameId, gameStatus } = session;',
    );
  }
  write('components/game/GameControls.tsx', f);
}

console.log('Patched GameControls.tsx');

// Run existing partial migrations
import('./_migrate-game-components-files.mjs').catch(() => {});

console.log('Migration complete. Run: node scripts/i18n/_count-ui-korean.mjs <files>');
