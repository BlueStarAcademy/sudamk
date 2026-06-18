/**
 * Pass 3: wire remaining target files to existing catalog keys + add missing keys.
 * Run via _migrate-target-batch.mjs
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
  const line = importLine.trim();
  if (content.includes(line)) return content;
  const idx = content.indexOf('\n');
  return content.slice(0, idx + 1) + importLine + content.slice(idx + 1);
}
function ensureHook(content, marker, hookLine) {
  const hook = hookLine.trim();
  if (content.includes(hook)) return content;
  const idx = content.indexOf(marker);
  if (idx < 0) return content;
  const fnArrow = content.indexOf('=> {', idx);
  if (fnArrow < 0) return content;
  const nl = content.indexOf('\n', fnArrow);
  return content.slice(0, nl + 1) + hookLine + content.slice(nl + 1);
}

const I18N = "import { useTranslation } from 'react-i18next';\n";
const LC_ROOT = "import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';\n";
const LC_GAME = "import { useLocalizedGameMode } from '../shared/i18n/localizedCatalog.js';\n";
const T_COMMON = "import type { TFunction } from 'i18next';\n";

export function extendCatalogPass3(ko, en) {
  Object.assign(ko.game.captureBid, {
    bidResultBadge: '흑선 배팅 결과',
    setupComplete: '설정 완료',
    baseTargetIntro: '기본 목표는 {{target}}개.',
    bidInstructionRich2: '흑(선수)을 가져오기 위해 상대에게 줄 점수를 제시하세요.',
    aiAutoBidHint: 'AI는 1~5점 사이에서 자동 제시합니다. 제한시간 없이 점수를 고를 수 있습니다.',
    baseTargetLabel: '기본 목표',
    waitingCaptain: '팀 방장의 입찰을 기다리고 있습니다.',
    titleRerollSuffix: '· 재배팅 라운드',
  });
  Object.assign(en.game.captureBid, {
    bidResultBadge: 'Black bid result',
    setupComplete: 'Settings saved',
    baseTargetIntro: 'Base target is {{target}} pieces.',
    bidInstructionRich2: 'Bid points to give your opponent to take black (first).',
    aiAutoBidHint: 'AI bids 1–5 automatically. No time limit.',
    baseTargetLabel: 'Base target',
    waitingCaptain: 'Waiting for team captain bid.',
    titleRerollSuffix: '· Rebid round',
  });

  Object.assign(ko.game.captureTiebreaker, {
    colorRouletteTitle: '흑백 결정 (동점 룰렛)',
    colorRouletteDesc: '룰렛으로 흑·백이 정해졌습니다.',
    baseCaptureTitle: '베이스 + 따내기',
    baseCaptureDesc: '아래 카드에서 조건을 확인하세요.',
    basePrepTitle2: '베이스 대국 준비',
    basePrepDesc2: '아래에서 흑·백·덤을 확인하세요.',
    colorDecideTitle: '흑백 결정',
    colorDecideDesc: '{{name}} · 흑(선) · 제시 {{bid}}점',
    blackFirstSuffix: ' · 선공',
    whiteSecondSuffix: ' · 후공',
    myWinCondition: '내 승리 조건',
    blackWinCondition: '흑 승리 조건',
    myRole: '내 역할',
    role: '역할',
    whiteWinCondition: '백 승리 조건',
    myKomi: '내 덤 (백)',
    komiWhite: '덤 (백)',
    capturePoints: '점 따내기',
    komiStones: '집',
    blackWhiteRoulette: '흑·백 룰렛',
    tieRerollSubtitle: '동점 2차 입찰',
    beforeStart: '시작 전 확인',
    bidResult: '제시 결과',
    baseTargetLabel: '기본 목표',
    bidScoreLabel: '제시 점수',
    rulesLabel: '규칙',
    baseRule: '베이스',
    whiteTargetLabel: '백 목표',
    firstBlackRole: '선(흑)',
  });

  Object.assign(en.game.captureTiebreaker, {
    colorRouletteTitle: 'Black/white (tie roulette)',
    colorRouletteDesc: 'Black and white decided by roulette.',
    baseCaptureTitle: 'Base + capture',
    baseCaptureDesc: 'Check conditions on the cards below.',
    basePrepTitle2: 'Base game prep',
    basePrepDesc2: 'Confirm black, white, and komi below.',
    colorDecideTitle: 'Black/white decided',
    colorDecideDesc: '{{name}} · Black · bid {{bid}} pts',
    blackFirstSuffix: ' · First',
    whiteSecondSuffix: ' · Second',
    myWinCondition: 'My win condition',
    blackWinCondition: 'Black win condition',
    myRole: 'My role',
    role: 'Role',
    whiteWinCondition: 'White win condition',
    myKomi: 'My komi (white)',
    komiWhite: 'Komi (white)',
    capturePoints: ' capture points',
    komiStones: ' stones',
    blackWhiteRoulette: 'Black/white roulette',
    tieRerollSubtitle: 'Tie rebid',
    beforeStart: 'Pre-start check',
    bidResult: 'Bid result',
    baseTargetLabel: 'Base target',
    bidScoreLabel: 'Bid score',
    rulesLabel: 'Rules',
    baseRule: 'Base',
    whiteTargetLabel: 'White target',
    firstBlackRole: 'First (black)',
  });

  Object.assign(ko.game.roundSummary, {
    previousRound: '이전 라운드',
    previousKnockShort: '이전 넉',
    detailScores: '상세 점수',
    resultBoardTab: '결과 보드',
    finalRoundTieBody: '최종 라운드가 동점입니다. 확인 후 같은 보드에서 한 번씩 돌을 더 쏘는 승부치기가 이어집니다.',
    stonesLeft: '남은 돌',
    scoredFor: '득점',
    scoredAgainst: '실점',
    roundWinner: '{{round}}라운드 — {{name}}님 승리',
    noRolls: '굴림 없음',
    diceStats: '주사위 통계',
    lastDummyBonus: '마지막 더미 +{{bonus}}',
    alkkagiKnockout: '넉아웃',
  });
  Object.assign(en.game.roundSummary, {
    previousRound: 'Previous round',
    previousKnockShort: 'Prev KO',
    detailScores: 'Score details',
    resultBoardTab: 'Result board',
    finalRoundTieBody: 'Final round tied. After confirm, a tiebreaker shot follows on the same board.',
    stonesLeft: 'Stones left',
    scoredFor: 'Scored',
    scoredAgainst: 'Against',
    roundWinner: 'Round {{round}} — {{name}} wins',
    noRolls: 'No rolls',
    diceStats: 'Dice stats',
    lastDummyBonus: 'Last pile +{{bonus}}',
    alkkagiKnockout: 'Knockout',
  });

  Object.assign(ko.blacksmith.refine, {
    refineBtn: '제련하기',
    charmUsageHint: '제련이 불가능한 장비의 제련가능 횟수를 1추가합니다. 사용처 : [대장간]-[장비제련] 제련불가 장비 선택',
    useBtn: '사용하기',
    selectMethodEmpty: '제련 방식을 선택하세요.',
    stepSelectOption: '① 옵션 선택',
    stepRefineInfo: '② 제련 정보',
    refinementCountLine: '제련 가능: {{value}}',
    refinementUnavailableShort: '제련불가',
  });
  Object.assign(en.blacksmith.refine, {
    refineBtn: 'Refine',
    charmUsageHint: 'Adds 1 refinement count to gear that cannot be refined. Use in Blacksmith > Refine.',
    useBtn: 'Use',
    selectMethodEmpty: 'Choose a refinement method.',
    stepSelectOption: '① Select option',
    stepRefineInfo: '② Refine info',
    refinementCountLine: 'Refinement available: {{value}}',
    refinementUnavailableShort: 'Cannot refine',
  });

  Object.assign(ko.common, {
    successLabel: '성공:',
    secondsShort: '초',
  });
  Object.assign(en.common, {
    successLabel: 'Success:',
    secondsShort: 'sec',
  });

  Object.assign(ko.tournament.championship.help, {
    titleKo: '챔피언십 도움말',
    altChampionship: '챔피언십',
    overviewBody1: '챔피언십은 던전 시스템으로 운영됩니다. 각 경기장(동네바둑리그, 전국바둑대회, 월드챔피언십)마다 1단계부터 10단계까지의 단계가 있으며, 각 단계에서 봇들과 리그/토너먼트를 진행하여 순위를 결정합니다.',
    unlockHintRich: '다음 단계 언락 조건:',
    unlockHintBody: '동네바둑리그, 전국바둑대회, 월드챔피언십 모두 1~3위를 달성하면 해당 단계 클리어로 인정되며 다음 단계가 열립니다.',
    rankUnlock: '3등 이상 달성 시 다음 단계 언락',
    commonFeatures: '경기장 공통 특징',
    simulationTitle: '시뮬레이션 경기',
    conditionTitle: '컨디션',
    rewardsTitle: '보상',
    baseRewardLine: '기본 보상:',
    baseRewardDesc: '각 경기마다 승/패에 따라 골드, 강화석, 장비상자가 자동으로 지급됩니다',
    rankRewardLine: '순위 보상:',
    rankRewardDesc: '토너먼트 완료 시 최종 순위에 따라 추가 보상이 지급됩니다',
    neighborhoodRewardLine: '동네바둑리그:',
    neighborhoodRewardDesc: '골드 꾸러미 (순위가 높을수록 더 많은 골드)',
    nationalRewardLine: '전국바둑대회:',
    nationalRewardDesc: '재료 상자 (순위가 높을수록 더 높은 등급의 재료 상자)',
    worldRewardLine: '월드챔피언십:',
    worldRewardDesc: '다이아 꾸러미 (순위가 높을수록 더 많은 다이아 꾸러미)',
    dailyScoreLine: '일일 점수:',
    dailyScoreDesc: '단계별 기본 점수와 순위 보너스를 합산하여 챔피언십 점수 획득',
  });
  Object.assign(en.tournament.championship.help, {
    titleKo: 'Championship help',
    altChampionship: 'Championship',
    overviewBody1: 'Championship is a dungeon system. Each venue has stages 1–10; you play leagues/tournaments against bots to rank.',
    unlockHintRich: 'Next tier unlock:',
    unlockHintBody: 'Place 1st–3rd in Neighborhood, National, and World to clear the stage and unlock the next.',
    rankUnlock: 'Top 3 unlocks next stage',
    commonFeatures: 'Common arena features',
    simulationTitle: 'Simulation match',
    conditionTitle: 'Condition',
    rewardsTitle: 'Rewards',
    baseRewardLine: 'Base reward:',
    baseRewardDesc: 'Gold, stones, and equipment boxes per match by win/loss',
    rankRewardLine: 'Placement reward:',
    rankRewardDesc: 'Extra rewards by final rank when the tournament ends',
    neighborhoodRewardLine: 'Neighborhood:',
    neighborhoodRewardDesc: 'Gold bundle (more for higher rank)',
    nationalRewardLine: 'National:',
    nationalRewardDesc: 'Material box (higher tier for higher rank)',
    worldRewardLine: 'World:',
    worldRewardDesc: 'Diamond bundle (more for higher rank)',
    dailyScoreLine: 'Daily score:',
    dailyScoreDesc: 'Stage base score plus rank bonus for championship points',
  });
}

/** @type {Array<{file:string, fn:(c:string)=>string}>} */
const migrations = [
  {
    file: 'components/CaptureBidModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const CaptureBidModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace(
        'winnerText = `${winner.nickname}님이 ${winnerBid}점을 제시하여 흑(선)이 됩니다. 백의 목표는 ${Math.max(1, baseTarget - winnerBid)}점입니다.`;',
        'winnerText = t(\'captureBid.winnerBid\', { name: winner.nickname, bid: winnerBid, target: Math.max(1, baseTarget - winnerBid) });',
      );
      s = s.replace(
        "winnerText = biddingRound === 2 ? '두 번째에도 비겨서, 랜덤으로 결정됩니다.' : '동점이므로, 재설정합니다!';",
        "winnerText = biddingRound === 2 ? t('captureBid.tieReroll') : t('captureBid.tieReset');",
      );
      s = s.replace("? '재설정으로 즉시 전환됩니다...'", "? t('captureBid.switching')");
      s = s.replace(": '잠시 후 대국이 시작됩니다...'", ": t('captureBid.startingSoon')");
      s = s.replace('흑선 배팅 결과', "{t('captureBid.bidResultBadge')}");
      s = s.replaceAll('<span className="text-base font-semibold ml-1 text-slate-300">점</span>', '<span className="text-base font-semibold ml-1 text-slate-300">{t(\'captureBid.pointsSuffix\')}</span>');
      s = s.replace('설정 완료', "{t('captureBid.setupComplete')}");
      s = s.replace('{opponent.nickname}님의 설정을 기다리고 있습니다...', "{t('captureBid.waitingBid', { name: opponent.nickname })}");
      s = s.replace(
        '기본 목표는 <span className="font-bold text-amber-300">{baseTarget}개</span>.',
        "{t('captureBid.baseTargetIntro', { target: baseTarget })}",
      );
      s = s.replace(
        '흑(선수)을 가져오기 위해 <span className="font-bold text-amber-200">상대에게 줄 점수</span>를 제시하세요.',
        "{t('captureBid.bidInstructionRich2')}",
      );
      s = s.replace(
        '<span className="text-slate-300/90">더 높은 점수를 제시한 플레이어가 흑이 되며, 백의 목표가 그만큼 낮아집니다. 최대 {maxBid}점까지 제시할 수 있습니다.</span>',
        "<span className=\"text-slate-300/90\">{t('captureBid.bidHint', { max: maxBid })}</span>",
      );
      s = s.replace('배팅 타이머', "{t('captureBid.bidTimer')}");
      s = s.replace('라운드 {biddingRound}', "{t('captureBid.bidRound', { round: biddingRound })}");
      s = s.replace('<span className="text-xs text-slate-300 pb-1">초</span>', '<span className="text-xs text-slate-300 pb-1">{tCommon(\'secondsShort\')}</span>');
      s = s.replace('남은 시간 내 배팅 확정', "{t('captureBid.timeRemainingBidShort')}");
      s = s.replace('AI전 무제한 제시', "{t('captureBid.aiUnlimitedTitle')}");
      s = s.replace('AI는 1~5점 사이에서 자동 제시합니다. 제한시간 없이 점수를 고를 수 있습니다.', "{t('captureBid.aiAutoBidHint')}");
      s = s.replace('>기본 목표<', ">{t('captureBid.baseTargetLabel')}<");
      s = s.replaceAll('<span className="text-sm font-semibold ml-1">개</span>', '<span className="text-sm font-semibold ml-1">{t(\'captureBid.piecesSuffix\')}</span>');
      s = s.replace('>상대에게 주는 점수<', ">{t('captureBid.opponentPoints')}<");
      s = s.replaceAll('<span className="text-sm font-semibold ml-1">점</span>', '<span className="text-sm font-semibold ml-1">{t(\'captureBid.pointsSuffix\')}</span>');
      s = s.replace(
        '흑 선택 시 백 목표: <span className="text-amber-200 font-semibold">{whiteTargetIfWin}점</span>',
        "{t('captureBid.whiteTargetIfWin', { target: whiteTargetIfWin })}",
      );
      s = s.replace(
        '<>현재 제시: <span className="text-amber-200 font-semibold">{effectiveLocalBid}점</span></>',
        "<>{t('captureBid.currentBid', { score: effectiveLocalBid })}</>",
      );
      s = s.replace('<>팀 방장의 입찰을 기다리고 있습니다.</>', "<>{t('captureBid.waitingCaptain')}</>");
      s = s.replace("{isSubmitting ? '설정 중...' : '흑선 점수 제시 확정'}", "{isSubmitting ? t('captureBid.setting') : t('captureBid.bidConfirmBtn')}");
      s = s.replace(
        'title={`흑선 가져오기 ${biddingRound === 2 ? \'· 재배팅 라운드\' : \'\'}`}',
        "title={`${t('captureBid.title')}${biddingRound === 2 ? t('captureBid.titleRerollSuffix') : ''}`}",
      );
      return s;
    },
  },
  {
    file: 'components/CaptureTiebreakerModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const CaptureTiebreakerModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace("title: '흑백 결정 (동점 룰렛)'", "title: t('captureTiebreaker.colorRouletteTitle')");
      s = s.replace("description: '룰렛으로 흑·백이 정해졌습니다.'", "description: t('captureTiebreaker.colorRouletteDesc')");
      s = s.replace("title: '베이스 + 따내기'", "title: t('captureTiebreaker.baseCaptureTitle')");
      s = s.replace("description: '아래 카드에서 조건을 확인하세요.'", "description: t('captureTiebreaker.baseCaptureDesc')");
      s = s.replace("title: '베이스 대국 준비'", "title: t('captureTiebreaker.basePrepTitle2')");
      s = s.replace("description: '아래에서 흑·백·덤을 확인하세요.'", "description: t('captureTiebreaker.basePrepDesc2')");
      s = s.replace("title: '흑백 결정'", "title: t('captureTiebreaker.colorDecideTitle')");
      s = s.replace(
        "description: `${getSessionPlayerDisplayName(session, winner)} · 흑(선) · 제시 ${winnerBid}점`",
        "description: t('captureTiebreaker.colorDecideDesc', { name: getSessionPlayerDisplayName(session, winner), bid: winnerBid })",
      );
      s = s.replace("{color}{isBlack ? ' · 선공' : ' · 후공'}", "{color}{isBlack ? t('captureTiebreaker.blackFirstSuffix') : t('captureTiebreaker.whiteSecondSuffix')}");
      s = s.replace("title: currentUser.id === blackPlayerId ? '내 승리 조건' : '흑 승리 조건'", "title: currentUser.id === blackPlayerId ? t('captureTiebreaker.myWinCondition') : t('captureTiebreaker.blackWinCondition')");
      s = s.replace("title: currentUser.id === blackPlayerId ? '내 역할' : '역할'", "title: currentUser.id === blackPlayerId ? t('captureTiebreaker.myRole') : t('captureTiebreaker.role')");
      s = s.replace("title: currentUser.id === whitePlayerId ? '내 승리 조건' : '백 승리 조건'", "title: currentUser.id === whitePlayerId ? t('captureTiebreaker.myWinCondition') : t('captureTiebreaker.whiteWinCondition')");
      s = s.replace("title: currentUser.id === whitePlayerId ? '내 덤 (백)' : '덤 (백)'", "title: currentUser.id === whitePlayerId ? t('captureTiebreaker.myKomi') : t('captureTiebreaker.komiWhite')");
      s = s.replace('>점 따내기<', ">{t('captureTiebreaker.capturePoints')}<");
      s = s.replace('>집<', ">{t('captureTiebreaker.komiStones')}<");
      s = s.replace('title="흑·백 룰렛"', "title={t('captureTiebreaker.blackWhiteRoulette')}");
      s = s.replace('subtitle="동점 2차 입찰"', "subtitle={t('captureTiebreaker.tieRerollSubtitle')}");
      s = s.replace("{isBaseStartConfirmation ? '시작 전 확인' : '제시 결과'}", "{isBaseStartConfirmation ? t('captureTiebreaker.beforeStart') : t('captureTiebreaker.bidResult')}");
      s = s.replace('>기본 목표<', ">{t('captureTiebreaker.baseTargetLabel')}<");
      s = s.replace('>제시 점수<', ">{t('captureTiebreaker.bidScoreLabel')}<");
      s = s.replace('>규칙<', ">{t('captureTiebreaker.rulesLabel')}<");
      s = s.replace('>베이스<', ">{t('captureTiebreaker.baseRule')}<");
      s = s.replace('>덤 (백)<', ">{t('captureTiebreaker.komiWhite')}<");
      s = s.replace('label="자동 진행까지"', "label={tCommon('autoProceed')}");
      s = s.replace('labelShort="자동 진행"', "labelShort={tCommon('autoProceedShort')}");
      s = s.replace("? '경기 시작 준비 완료'", "? t('captureTiebreaker.prepComplete')");
      s = s.replace("? '룰렛 결과 확인 중...'", "? t('startConfirm.checkingRoulette')");
      s = s.replace('? `대국 시작 (${countdown})`', "? t('startConfirm.startCountdown', { count: countdown })");
      s = s.replace(": '대국 시작'", ": tCommon('startGame')");
      s = s.replace('main: <span className="text-amber-200">선공 (흑)</span>', "main: <span className=\"text-amber-200\">{t('captureTiebreaker.firstBlackRole')}</span>");
      return s;
    },
  },
  {
    file: 'components/CurlingRoundSummary.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const CurlingRoundSummary', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('>흑돌<', ">{t('roundSummary.curlingBlack')}<");
      s = s.replace('>백돌<', ">{t('roundSummary.curlingWhite')}<");
      s = s.replace('>하우스<', ">{t('summary.house')}<");
      s = s.replace('>넉아웃<', ">{t('summary.knockout')}<");
      s = s.replace('>합계<', ">{t('summary.totalScore')}<");
      s = s.replace('{black.total}점', "{black.total}{t('summary.pointsUnit')}");
      s = s.replace('{white.total}점', "{white.total}{t('summary.pointsUnit')}");
      s = s.replace('{black.houseScore}점', "{black.houseScore}{t('summary.pointsUnit')}");
      s = s.replace('{white.houseScore}점', "{white.houseScore}{t('summary.pointsUnit')}");
      s = s.replace('{black.knockoutScore}점', "{black.knockoutScore}{t('summary.pointsUnit')}");
      s = s.replace('{white.knockoutScore}점', "{white.knockoutScore}{t('summary.pointsUnit')}");
      s = s.replace('<span>이전 라운드</span>', "<span>{t('roundSummary.previousRound')}</span>");
      s = s.replace('<span>이전 넉</span>', "<span>{t('roundSummary.previousKnockShort')}</span>");
      s = s.replace("{black.previousKnockoutScore}점", "{black.previousKnockoutScore}{t('summary.pointsUnit')}");
      s = s.replace("{white.previousKnockoutScore}점", "{white.previousKnockoutScore}{t('summary.pointsUnit')}");
      s = s.replace("? '확인'", "? tCommon('actions.ok')");
      s = s.replace(": '다음 라운드 시작'", ": tCommon('nextRound')");
      s = s.replace("? '상대방 확인 대기 중...'", "? tCommon('waitingOpponentConfirm')");
      s = s.replace("label={isFinalRound ? '최종 결과 자동 표시까지' : '다음 라운드 자동 시작까지'}", "label={isFinalRound ? tCommon('finalResultAuto') : tCommon('nextRoundAuto')}");
      s = s.replace(
        'title={finalRoundTie ? `${round} 라운드 결과 · 동점` : `${round} 라운드 결과`}',
        "title={finalRoundTie ? t('roundSummary.curlingTieTitle', { round }) : t('roundSummary.curlingTitle', { round })}",
      );
      s = s.replace('aria-label="라운드 결과 보기"', "aria-label={tCommon('viewRoundResult')}");
      s = s.replace('>결과 보드<', ">{t('roundSummary.resultBoardTab')}<");
      s = s.replace('>상세 점수<', ">{t('roundSummary.detailScores')}<");
      s = s.replace('>라운드 결과 보드<', ">{tCommon('roundResultBoard')}<");
      s = s.replace(
        '최종 라운드가 동점입니다. 확인 후 같은 보드에서 한 번씩 돌을 더 쏘는 승부치기가 이어집니다.',
        "{t('roundSummary.finalRoundTieBody')}",
      );
      s = s.replace('<p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">흑</p>', '<p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{tCommon(\'blackShort\')}</p>');
      s = s.replace('<p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">백</p>', '<p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{tCommon(\'whiteShort\')}</p>');
      return s;
    },
  },
  {
    file: 'components/blacksmith/RefinementView.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        '제련 가능: {(item as any).refinementCount > 0 ? `${(item as any).refinementCount}회` : \'제련불가\'}',
        "{t('refine.refinementCountLine', { value: (item as any).refinementCount > 0 ? t('refine.countTimes', { count: (item as any).refinementCount }) : t('refine.refinementUnavailableShort') })}",
      );
      s = s.replace('>신화 스페셜 옵션<', ">{t('refine.mythicSpecial')}<");
      s = s.replace('>초월 스페셜 옵션<', ">{t('refine.transcendentSpecial')}<");
      s = s.replace('>제련하기<', ">{t('refine.refineBtn')}<");
      s = s.replace('>제련 진행도<', ">{t('refine.progressLabel')}<");
      s = s.replace(
        '제련이 불가능한 장비의 제련가능 횟수를 1추가합니다. 사용처 : [대장간]-[장비제련] 제련불가 장비 선택',
        "{t('refine.charmUsageHint')}",
      );
      s = s.replace('>사용하기<', ">{t('refine.useBtn')}<");
      s = s.replace('>선택된 옵션<', ">{t('refine.selectedOptionLabel')}<");
      s = s.replace('>스페셜 옵션 변경<', ">{t('refine.specialChangeShort')}<");
      s = s.replace('제련 방식을 선택하세요.', "{t('refine.selectMethodEmpty')}");
      s = s.replace(
        "{stackedViewport ? '제련할 옵션을 선택해주세요.' : '좌측에서 옵션을 선택해주세요.'}",
        "{stackedViewport ? t('refine.selectOptionMobile') : t('refine.selectOptionDesktop')}",
      );
      s = s.replace('>선택된 장비<', ">{t('refine.selectedGearShort')}<");
      s = s.replace('① 옵션 선택', "{t('refine.stepSelectOption')}");
      s = s.replace('② 제련 정보', "{t('refine.stepRefineInfo')}");
      return s;
    },
  },
  {
    file: 'components/ChampionshipHelpModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ChampionshipHelpModal', "    const { t } = useTranslation('tournament');\n");
      s = s.replace('title="챔피언십 도움말"', "title={t('championship.help.titleKo')}");
      s = s.replace('alt="챔피언십"', "alt={t('championship.help.altChampionship')}");
      s = s.replace('>챔피언십 개요<', ">{t('championship.help.overview')}<");
      s = s.replace(
        '챔피언십은 던전 시스템으로 운영됩니다. 각 경기장(동네바둑리그, 전국바둑대회, 월드챔피언십)마다 1단계부터 10단계까지의 단계가 있으며, \n                                각 단계에서 봇들과 리그/토너먼트를 진행하여 순위를 결정합니다.',
        "{t('championship.help.overviewBody1')}",
      );
      s = s.replace('<strong className="text-yellow-400">다음 단계 언락 조건:</strong>', '<strong className="text-yellow-400">{t(\'championship.help.unlockHintRich\')}</strong>');
      s = s.replace(
        '동네바둑리그, 전국바둑대회, 월드챔피언십 모두 <strong>1~3위</strong>를 달성하면 해당 단계 클리어로 인정되며 다음 단계가 열립니다.',
        "{t('championship.help.unlockHintBody')}",
      );
      s = s.replace('alt="동네바둑리그"', "alt={t('championship.help.neighborhood')}");
      s = s.replace('>동네바둑리그<', ">{t('championship.help.neighborhood')}<");
      s = s.replace('<strong className="text-yellow-400">3등 이상 달성 시 다음 단계 언락</strong>', '<strong className="text-yellow-400">{t(\'championship.help.rankUnlock\')}</strong>');
      s = s.replace('alt="전국바둑대회"', "alt={t('championship.help.national')}");
      s = s.replace('>전국바둑대회<', ">{t('championship.help.national')}<");
      s = s.replace('alt="월드챔피언십"', "alt={t('championship.help.world')}");
      s = s.replace('>월드챔피언십<', ">{t('championship.help.world')}<");
      s = s.replace('>경기장 공통 특징<', ">{t('championship.help.commonFeatures')}<");
      s = s.replace('>시뮬레이션 경기<', ">{t('championship.help.simulationTitle')}<");
      s = s.replace('>컨디션<', ">{t('championship.help.conditionTitle')}<");
      s = s.replace('>보상<', ">{t('championship.help.rewardsTitle')}<");
      s = s.replace('<strong className="text-yellow-300">기본 보상:</strong>', '<strong className="text-yellow-300">{t(\'championship.help.baseRewardLine\')}</strong>');
      s = s.replace('각 경기마다 승/패에 따라 골드, 강화석, 장비상자가 자동으로 지급됩니다', "{t('championship.help.baseRewardDesc')}");
      s = s.replace('<strong className="text-yellow-300">순위 보상:</strong>', '<strong className="text-yellow-300">{t(\'championship.help.rankRewardLine\')}</strong>');
      s = s.replace('토너먼트 완료 시 최종 순위에 따라 추가 보상이 지급됩니다', "{t('championship.help.rankRewardDesc')}");
      s = s.replace('<strong className="text-yellow-300">동네바둑리그:</strong>', '<strong className="text-yellow-300">{t(\'championship.help.neighborhoodRewardLine\')}</strong>');
      s = s.replace('골드 꾸러미 (순위가 높을수록 더 많은 골드)', "{t('championship.help.neighborhoodRewardDesc')}");
      s = s.replace('<strong className="text-yellow-300">전국바둑대회:</strong>', '<strong className="text-yellow-300">{t(\'championship.help.nationalRewardLine\')}</strong>');
      s = s.replace('재료 상자 (순위가 높을수록 더 높은 등급의 재료 상자)', "{t('championship.help.nationalRewardDesc')}");
      s = s.replace('<strong className="text-yellow-300">월드챔피언십:</strong>', '<strong className="text-yellow-300">{t(\'championship.help.worldRewardLine\')}</strong>');
      s = s.replace('다이아 꾸러미 (순위가 높을수록 더 많은 다이아 꾸러미)', "{t('championship.help.worldRewardDesc')}");
      s = s.replace('<strong className="text-yellow-300">일일 점수:</strong>', '<strong className="text-yellow-300">{t(\'championship.help.dailyScoreLine\')}</strong>');
      s = s.replace('단계별 기본 점수와 순위 보너스를 합산하여 챔피언십 점수 획득', "{t('championship.help.dailyScoreDesc')}");
      return s;
    },
  },
  {
    file: 'components/blacksmith/CombinationView.tsx',
    fn: (c) => c.replace('<span className={probTypo.label}>성공:</span>', '<span className={probTypo.label}>{t(\'successLabel\', { ns: \'common\' })}</span>'),
  },
  {
    file: 'components/MythicSubsPartitioned.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'export const MythicSubsPartitioned', "    const { t } = useTranslation('game');\n");
      if (!s.includes("useTranslation('game')")) {
        s = ensureHook(s, 'const MythicSubsPartitioned', "    const { t } = useTranslation('game');\n");
      }
      s = s.replace('>신화 스페셜옵션<', ">{t('mythicPartition.mythic')}<");
      s = s.replace('>초월 스페셜옵션<', ">{t('mythicPartition.transcendent')}<");
      return s;
    },
  },
  {
    file: 'components/AlkkagiRoundSummary.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const AlkkagiRoundSummary', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace(
        'title={`${alkkagiRoundSummary.round}라운드 집계`}',
        "title={t('roundSummary.alkkagiTitle', { round: alkkagiRoundSummary.round })}",
      );
      s = s.replace(
        '{winnerUser.nickname}님이 이번 라운드에서 승리했습니다.',
        "{t('summary.playerWins', { name: winnerUser.nickname })}",
      );
      s = s.replace('남은 돌 {blackStonesLeft}개', "{t('roundSummary.stonesLeft')} {blackStonesLeft}");
      s = s.replace('남은 돌 {whiteStonesLeft}개', "{t('roundSummary.stonesLeft')} {whiteStonesLeft}");
      s = s.replace('득점 {blackForTotal} / 실점 {blackAgainstTotal}', "{t('roundSummary.scoredFor')} {blackForTotal} / {t('roundSummary.scoredAgainst')} {blackAgainstTotal}");
      s = s.replace('득점 {whiteForTotal} / 실점 {whiteAgainstTotal}', "{t('roundSummary.scoredFor')} {whiteForTotal} / {t('roundSummary.scoredAgainst')} {whiteAgainstTotal}");
      s = s.replace("{hasConfirmed ? '확인 대기 중' : '다음 라운드'}", "{hasConfirmed ? tCommon('confirmWaiting') : tCommon('nextRoundConfirm')}");
      s = s.replace('label="다음 라운드 자동 시작까지"', "label={tCommon('nextRoundAuto')}");
      s = s.replace('labelShort="다음까지"', "labelShort={tCommon('nextRoundShort')}");
      return s;
    },
  },
  {
    file: 'components/BaseStartConfirmationModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const BaseStartConfirmationModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace("{isBaseCaptureMix ? '베이스 + 따내기 대국 준비' : '베이스 대국 준비'}", "{isBaseCaptureMix ? t('captureTiebreaker.baseCaptureTitle') : t('captureTiebreaker.basePrepTitle')}");
      s = s.replace('>흑돌<', ">{t('roundSummary.curlingBlack')}<");
      s = s.replace('>백돌<', ">{t('roundSummary.curlingWhite')}<");
      s = s.replace('>기본 목표<', ">{t('captureTiebreaker.baseTargetLabel')}<");
      s = s.replace('>제시 점수<', ">{t('captureTiebreaker.bidScoreLabel')}<");
      s = s.replace('>백 목표<', ">{t('captureTiebreaker.whiteTargetLabel')}<");
      s = s.replace('>흑 승리 조건<', ">{t('captureTiebreaker.blackWinCondition')}<");
      s = s.replace('{blackCaptureTarget}점 따내기', "{blackCaptureTarget}{t('captureTiebreaker.capturePoints')}");
      s = s.replace("{bid.color === Player.Black ? '흑' : '백'}, {bid.komi}집", "{bid.color === Player.Black ? tCommon('blackShort') : tCommon('whiteShort')}, {bid.komi}{t('captureTiebreaker.komiStones')}");
      s = s.replace('덤 <span className="font-mono font-bold text-amber-200">{komiLabel}</span>집', "{t('captureTiebreaker.komiWhite')} <span className=\"font-mono font-bold text-amber-200\">{komiLabel}</span>{t('captureTiebreaker.komiStones')}");
      s = s.replace("{hasConfirmed ? '상대방 확인 대기 중…' : '시작하기'}", "{hasConfirmed ? tCommon('waitingOpponentConfirmShort') : tCommon('confirmStart')}");
      s = s.replace('title="베이스 대국 준비"', "title={t('captureTiebreaker.basePrepTitle')}");
      s = s.replace('{baseCaptureTarget}점', '{baseCaptureTarget}{t(\'captureBid.pointsSuffix\')}');
      s = s.replace('{captureBidPoints}점', '{captureBidPoints}{t(\'captureBid.pointsSuffix\')}');
      s = s.replace('{whiteCaptureTarget}점', '{whiteCaptureTarget}{t(\'captureBid.pointsSuffix\')}');
      return s;
    },
  },
  {
    file: 'components/blacksmith/DisassemblyView.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace('>선택된 장비<', ">{t('disassemble.selectedGear')}<");
      s = s.replace('{items.length.toLocaleString()}개', "{t('disassemble.itemCount', { count: items.length })}");
      s = s.replace(
        'const jackpotHint = `${formatBlacksmithPercentInt(jackpotRatePct)}%확률로 대박 발생(재료2배)`;',
        "const jackpotHint = t('disassemble.jackpotHint', { rate: formatBlacksmithPercentInt(jackpotRatePct) });",
      );
      s = s.replace(
        "? '「장비 다시 선택」으로 모달을 열어 분해할 장비를 고르세요.'",
        "? t('disassemble.reopenHint')",
      );
      return s;
    },
  },
];

export function runPass3Migrations() {
  const ko = readJson('shared/i18n/catalog/ko.json');
  const en = readJson('shared/i18n/catalog/en.json');
  extendCatalogPass3(ko, en);
  writeJson('shared/i18n/catalog/ko.json', ko);
  writeJson('shared/i18n/catalog/en.json', en);

  let modified = 0;
  for (const { file, fn } of migrations) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      console.warn('Pass3 missing:', file);
      continue;
    }
    const before = read(file);
    const after = fn(before);
    if (after !== before) {
      write(file, after);
      modified++;
      console.log('Pass3:', file);
    }
  }
  console.log(`Pass3 done: ${modified} files modified.`);
  return modified;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runPass3Migrations();
}
