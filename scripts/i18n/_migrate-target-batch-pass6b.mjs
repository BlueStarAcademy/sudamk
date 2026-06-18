/**
 * Pass 6b: remaining target-batch UI Korean migration.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(root, f), c, 'utf8');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, obj) => fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');

const I18N = "import { useTranslation } from 'react-i18next';\n";
const I18N_CFG = "import i18n from '../shared/i18n/config.js';\n";
const I18N_CFG2 = "import i18n from '../../shared/i18n/config.js';\n";
const LC = "import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';\n";

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
function fixBrokenHookInjection(content) {
  return content.replace(
    /(=\ \(\{\n)\s*(const \{ t[^}]+\} = useTranslation[^;]+;\n)((?:\s+[\w.:]+(?: = [^,\n]+)?,\n)+)\}\) => \{/g,
    '$1$3}) => {\n    $2',
  );
}

export function extendCatalogPass6b(ko, en) {
  const ensure = (root, path) => {
    let cur = root;
    for (const key of path) {
      if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
      cur = cur[key];
    }
    return cur;
  };
  ensure(ko, ['tournament', 'championship', 'points']);
  ensure(en, ['tournament', 'championship', 'points']);
  ensure(ko, ['tournament', 'championship', 'duelHistory']);
  ensure(en, ['tournament', 'championship', 'duelHistory']);
  ensure(ko, ['game', 'thiefDeathmatch']);
  ensure(en, ['game', 'thiefDeathmatch']);
  ensure(ko, ['nav', 'announcements']);
  ensure(en, ['nav', 'announcements']);
  Object.assign(ko.tournament.championship.points, {
    dailyTitle: '일일 획득 가능 점수',
    stageSelectLabel: '단계 선택',
    arenaStageTitle: '{{title}} ({{stage}}단계)',
    pointsUnit: '점',
    stageUnit: '{{stage}}단계',
  });
  Object.assign(en.tournament.championship.points, {
    dailyTitle: 'Daily earnable points',
    stageSelectLabel: 'Select stage',
    arenaStageTitle: '{{title}} (stage {{stage}})',
    pointsUnit: ' pts',
    stageUnit: 'Stage {{stage}}',
  });
  Object.assign(ko.game.singlePlayerDesc, {
    survivalGo: '살리기 바둑',
    modeLabel: '모드',
    clearReward: '클리어 보상',
    noReward: '보상없음',
    confirm: '확인',
    prev: '이전',
    next: '다음',
    editStage: '스테이지 편집',
    editOrder: '순서 편집',
    cancel: '취소',
    start: '시작하기',
    singleStage: '싱글 스테이지',
    masterClass: '유단자',
  });
  Object.assign(en.game.singlePlayerDesc, {
    survivalGo: 'Survival Go',
    modeLabel: 'Mode',
    clearReward: 'Clear reward',
    noReward: 'No reward',
    confirm: 'OK',
    prev: 'Previous',
    next: 'Next',
    editStage: 'Edit stages',
    editOrder: 'Edit order',
    cancel: 'Cancel',
    start: 'Start',
    singleStage: 'Single-player stage',
    masterClass: 'Master class',
  });
  Object.assign(ko.profile.gameRecords, {
    movesLabel: '수순',
    tryPlacement: '놓아보기',
    clearReviewMoves: '검토 수 지우기',
    gameInfo: '대국 정보',
    scoreDetail: '점수 상세',
    scoreDetailNone: '점수 상세 없음',
    blackScoreLine: '흑 {{score}}점',
    whiteScoreLine: '백 {{score}}점',
    timeBonusLong: '시간 보너스 +{{bonus}}',
    baseBonusLong: '베이스 보너스 +{{bonus}}',
    hiddenBonusLong: '히든 보너스 +{{bonus}}',
    itemBonusLong: '아이템 보너스 +{{bonus}}',
    recordList: '기보 목록',
    viewRecord: '기보보기',
    blackWhiteScore: '흑 {{black}} : {{white}} 백',
  });
  Object.assign(en.profile.gameRecords, {
    movesLabel: 'Moves',
    tryPlacement: 'Try moves',
    clearReviewMoves: 'Clear review moves',
    gameInfo: 'Game info',
    scoreDetail: 'Score breakdown',
    scoreDetailNone: 'No score breakdown',
    blackScoreLine: 'Black {{score}}',
    whiteScoreLine: 'White {{score}}',
    timeBonusLong: 'Time bonus +{{bonus}}',
    baseBonusLong: 'Base bonus +{{bonus}}',
    hiddenBonusLong: 'Hidden bonus +{{bonus}}',
    itemBonusLong: 'Item bonus +{{bonus}}',
    recordList: 'Record list',
    viewRecord: 'View record',
    blackWhiteScore: 'B {{black}} : {{white}} W',
  });
  Object.assign(ko.nav, {
    announcements: {
      title: '공지 / 패치 노트',
      body: '공지사항 및 패치/업데이트 내역을 확인할 수 있습니다.',
      applied: '적용: {{modes}}',
      empty: '등록된 공지가 없습니다.',
    },
  });
  Object.assign(en.nav, {
    announcements: {
      title: 'Announcements / patch notes',
      body: 'View announcements and patch/update notes.',
      applied: 'Applies to: {{modes}}',
      empty: 'No announcements yet.',
    },
  });
  Object.assign(ko.tournament.championship.duelHistory, {
    kstHint: 'KST 기준 최근 7일간의 기록입니다. 하루가 지날수록 오래된 기록은 자동으로 사라집니다.',
  });
  Object.assign(en.tournament.championship.duelHistory, {
    kstHint: 'Records from the last 7 days (KST). Older entries are removed daily.',
  });
  Object.assign(ko.game.roundSummary, {
    house: '하우스',
    knockout: '넉아웃',
    roundResultBoard: '라운드 결과 보드',
  });
  Object.assign(en.game.roundSummary, {
    house: 'House',
    knockout: 'Knockout',
    roundResultBoard: 'Round result board',
  });
  Object.assign(ko.game.preGameColor, {
    blackShort: '흑',
    whiteShort: '백',
    blackRole: '선공 · 흑',
    whiteRole: '후공 · 백',
  });
  Object.assign(en.game.preGameColor, {
    blackShort: 'Black',
    whiteShort: 'White',
    blackRole: 'First · Black',
    whiteRole: 'Second · White',
  });
  Object.assign(ko.game.conditionPotion, {
    recoveryTitle: '컨디션 회복',
    potionTitle: '{{name}} · 회복 {{min}}~{{max}} · 보유 {{count}}',
    currentLabel: '현재 컨디션',
    expectedLabel: '예상 회복 후',
    applying: '회복 적용 중...',
    goShop: '상점으로 이동',
    usePotion: '회복제 사용',
  });
  Object.assign(en.game.conditionPotion, {
    recoveryTitle: 'Condition recovery',
    potionTitle: '{{name}} · recovery {{min}}–{{max}} · owned {{count}}',
    currentLabel: 'Current condition',
    expectedLabel: 'Expected after recovery',
    applying: 'Applying…',
    goShop: 'Go to shop',
    usePotion: 'Use potion',
  });
  Object.assign(ko.game.turnPreference, {
    selectionDone: '선택 완료!',
  });
  Object.assign(en.game.turnPreference, {
    selectionDone: 'Selection complete!',
  });
  Object.assign(ko.game.thiefDeathmatch, {
    title: '데스매치 역할 룰렛',
    subtitle: '룰렛으로 역할을 결정합니다.',
  });
  Object.assign(en.game.thiefDeathmatch, {
    title: 'Deathmatch role roulette',
    subtitle: 'Roles are decided by roulette.',
  });
  Object.assign(ko.profile.coreAbility, {
    equipmentEffects: '장비 효과',
    allocate: '분배',
    opening: '초반',
    midgame: '중반',
    endgame: '종반',
    goAbility: '바둑능력',
    bonusLabel: '보너스',
  });
  Object.assign(en.profile.coreAbility, {
    equipmentEffects: 'Gear effects',
    allocate: 'Allocate',
    opening: 'Opening',
    midgame: 'Midgame',
    endgame: 'Endgame',
    goAbility: 'Go ability',
    bonusLabel: 'Bonus',
  });
  Object.assign(ko.game.nigiri, {
    confirmTitle: '흑·백 확인',
  });
  Object.assign(en.game.nigiri, {
    confirmTitle: 'Black & white confirm',
  });
  Object.assign(ko.game.thiefRound, {
    piecesUnit: '개',
  });
  Object.assign(en.game.thiefRound, {
    piecesUnit: '',
  });
  Object.assign(ko.tournament.championship.ranking, {
    loginHint: '로그인 후 챔피언십 랭킹을 확인할 수 있습니다.',
    noScoredUsers: '랭킹에 표시할 점수가 있는 유저가 없습니다.',
    loadingMore: '로딩 중...',
    noRankedUsers: '랭크된 유저가 없습니다.',
  });
  Object.assign(en.tournament.championship.ranking, {
    loginHint: 'Log in to view championship rankings.',
    noScoredUsers: 'No users with ranking scores yet.',
    loadingMore: 'Loading…',
    noRankedUsers: 'No ranked users yet.',
  });
}

/** @type {Array<{file:string, fn:(c:string)=>string, skip?:boolean}>} */
const migrations = [
  {
    file: 'components/UseQuantityModal.tsx',
    fn: (c) => {
      let s = fixBrokenHookInjection(c);
      s = s.replace(
        /합계 <span className="font-semibold text-slate-100">\{totalQuantity\.toLocaleString\(\)\}<\/span>개 보유/,
        "{t('useQuantity.ownedTotal', { count: totalQuantity.toLocaleString() })}",
      );
      return s;
    },
  },
  {
    file: 'components/gameRecord/GameRecordViewerPanel.tsx',
    fn: (c) => {
      let s = fixBrokenHookInjection(c);
      s = ensureImport(s, I18N_CFG);
      s = s.replace(
        /function formatScoreDetailsOneLine[\s\S]*?return t\('common:scoreDetailsLine'[\s\S]*?\n\}/,
        `function formatScoreDetailsOneLine(record: GameRecord): string {
    const { blackScore, whiteScore, scoreDetails } = record.gameResult;
    if (!scoreDetails) {
        return i18n.t('common:scoreDetailsLine', { blackLine: i18n.t('common:scoreLine', { label: i18n.t('common:black'), score: blackScore }), whiteLine: i18n.t('common:scoreLine', { label: i18n.t('common:white'), score: whiteScore }) });
    }
    const sideLine = (label: string, total: number, side: ScoreSideDetails) => {
        const parts = [\`\${label} \${total}\`];
        if (side.timeBonus > 0) parts.push(i18n.t('common:timeBonus', { bonus: side.timeBonus }));
        if (side.baseStoneBonus > 0) parts.push(i18n.t('common:baseBonus', { bonus: side.baseStoneBonus }));
        if (side.hiddenStoneBonus > 0) parts.push(i18n.t('common:hiddenBonus', { bonus: side.hiddenStoneBonus }));
        if (side.itemBonus > 0) parts.push(i18n.t('common:itemBonus', { bonus: side.itemBonus }));
        return parts.join(' ');
    };
    return i18n.t('common:scoreDetailsLine', { blackLine: sideLine(i18n.t('common:black'), blackScore, scoreDetails.black), whiteLine: sideLine(i18n.t('common:white'), whiteScore, scoreDetails.white) });
}`,
      );
      s = ensureHook(s, 'const GameRecordViewerPanel', "    const { t } = useTranslation(['profile', 'common']);\n    const localizedGameMode = useLocalizedGameMode();\n");
      s = s.replace(
        /const GameRecordViewerPanel: React\.FC<GameRecordViewerPanelProps> = \(\{\n\s*const \{ t \}[^\n]+\n\s*const localizedGameMode[^\n]+\n/,
        'const GameRecordViewerPanel: React.FC<GameRecordViewerPanelProps> = ({\n',
      );
      s = s.replace('>수순<', ">{t('gameRecords.movesLabel')}<");
      s = s.replace("{isReviewMode ? '원래기보' : '놓아보기'}", "{isReviewMode ? t('common:originalGame') : t('gameRecords.tryPlacement')}");
      s = s.replace('>검토 수 지우기<', ">{t('gameRecords.clearReviewMoves')}<");
      s = s.replace(
        '수순 <span className="text-amber-200">{currentMoveIndex}</span>',
        "{t('gameRecords.movesLabel')} <span className=\"text-amber-200\">{currentMoveIndex}</span>",
      );
      s = s.replace('>대국 정보<', ">{t('gameRecords.gameInfo')}<");
      s = s.replace('>점수 상세<', ">{t('gameRecords.scoreDetail')}<");
      s = s.replace(
        '<div className="mb-0.5 font-semibold text-sky-200/90">흑 {record.gameResult.blackScore}점</div>',
        "<div className=\"mb-0.5 font-semibold text-sky-200/90\">{t('gameRecords.blackScoreLine', { score: record.gameResult.blackScore })}</div>",
      );
      s = s.replace(
        '<div className="text-amber-200/90">시간 보너스 +{scoreDetails.black.timeBonus}</div>',
        "<div className=\"text-amber-200/90\">{t('gameRecords.timeBonusLong', { bonus: scoreDetails.black.timeBonus })}</div>",
      );
      s = s.replace(
        '<div className="text-sky-300/90">베이스 보너스 +{scoreDetails.black.baseStoneBonus}</div>',
        "<div className=\"text-sky-300/90\">{t('gameRecords.baseBonusLong', { bonus: scoreDetails.black.baseStoneBonus })}</div>",
      );
      s = s.replace(
        '<div className="text-violet-300/90">히든 보너스 +{scoreDetails.black.hiddenStoneBonus}</div>',
        "<div className=\"text-violet-300/90\">{t('gameRecords.hiddenBonusLong', { bonus: scoreDetails.black.hiddenStoneBonus })}</div>",
      );
      s = s.replace(
        '<div className="text-emerald-300/90">아이템 보너스 +{scoreDetails.black.itemBonus}</div>',
        "<div className=\"text-emerald-300/90\">{t('gameRecords.itemBonusLong', { bonus: scoreDetails.black.itemBonus })}</div>",
      );
      s = s.replace(
        '<div className="mb-0.5 font-semibold text-amber-200/90">백 {record.gameResult.whiteScore}점</div>',
        "<div className=\"mb-0.5 font-semibold text-amber-200/90\">{t('gameRecords.whiteScoreLine', { score: record.gameResult.whiteScore })}</div>",
      );
      s = s.replace(
        '<div className="text-amber-200/90">시간 보너스 +{scoreDetails.white.timeBonus}</div>',
        "<div className=\"text-amber-200/90\">{t('gameRecords.timeBonusLong', { bonus: scoreDetails.white.timeBonus })}</div>",
      );
      s = s.replace(
        '<div className="text-sky-300/90">베이스 보너스 +{scoreDetails.white.baseStoneBonus}</div>',
        "<div className=\"text-sky-300/90\">{t('gameRecords.baseBonusLong', { bonus: scoreDetails.white.baseStoneBonus })}</div>",
      );
      s = s.replace(
        '<div className="text-violet-300/90">히든 보너스 +{scoreDetails.white.hiddenStoneBonus}</div>',
        "<div className=\"text-violet-300/90\">{t('gameRecords.hiddenBonusLong', { bonus: scoreDetails.white.hiddenStoneBonus })}</div>",
      );
      s = s.replace(
        '<div className="text-emerald-300/90">아이템 보너스 +{scoreDetails.white.itemBonus}</div>',
        "<div className=\"text-emerald-300/90\">{t('gameRecords.itemBonusLong', { bonus: scoreDetails.white.itemBonus })}</div>",
      );
      s = s.replace('>점수 상세 없음<', ">{t('gameRecords.scoreDetailNone')}<");
      s = s.replace('>닫기<', ">{t('common:closeViewer')}<");
      return s;
    },
  },
  {
    file: 'components/gameRecord/GameRecordReplayNav.tsx',
    fn: fixBrokenHookInjection,
  },
  {
    file: 'components/StatAllocationModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const StatAllocationModal', "    const { t } = useTranslation('profile');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace(
        /if \(window\.confirm\(`골드 \$\{resetCost\.toLocaleString\(\)\}개를 사용하여[\s\S]*?\)`\)/,
        "if (window.confirm(t('statAllocation.resetConfirm', { cost: resetCost.toLocaleString(), remaining: remainingResetsToday })))",
      );
      s = s.replace('>전투력<', ">{t('statAllocation.combatPower')}<");
      s = s.replace('>잔여<', ">{t('statAllocation.remaining')}<");
      s = s.replace('>남은 능력치에 분배<', ">{t('statAllocation.allocateHint')}<");
      s = s.replace('alt="골드"', "alt={tCommon('gold')}");
      s = s.replace(
        'aria-label={`${CORE_STATS_DATA[selectedStat].name} 분배`}',
        "aria-label={t('statAllocation.allocateAria', { stat: CORE_STATS_DATA[selectedStat].name })}",
      );
      s = s.replace('title="능력치 포인트 배분"', "title={t('statAllocation.allocateTitle')}");
      return s;
    },
  },
  {
    file: 'components/PreGameColorRoulette.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N_CFG);
      s = s.replace(
        "title = '룰렛으로 흑/백을 결정하는 중...',",
        "title = i18n.t('game:preGameColor.title'),",
      );
      s = s.replace(
        "subtitle = '자동으로 선공과 후공이 배정됩니다.',",
        "subtitle = i18n.t('game:preGameColor.subtitle'),",
      );
      s = s.replace(
        "blackRoleLabel = '선공 · 흑',",
        "blackRoleLabel = i18n.t('game:preGameColor.blackRole'),",
      );
      s = s.replace(
        "whiteRoleLabel = '후공 · 백',",
        "whiteRoleLabel = i18n.t('game:preGameColor.whiteRole'),",
      );
      s = ensureHook(s, 'const PreGameColorRoulette', "    const { t } = useTranslation('game');\n");
      s = s.replace('>룰렛 종료<', ">{t('preGameColor.rouletteEnd')}<");
      s = s.replace(">흑<", ">{t('preGameColor.blackShort')}<");
      s = s.replace("{activeColor === Player.Black ? '흑' : '백'}", "{activeColor === Player.Black ? t('preGameColor.blackShort') : t('preGameColor.whiteShort')}");
      s = s.replace(
        "? '좌우 카드의 최종 선공·후공을 표시합니다.'",
        "? t('preGameColor.finalCard')",
      );
      s = s.replace(
        "? '흑·백 표시가 빠르게 번갈아가며 잠시 후 최종 배치로 고정됩니다.'",
        "? t('preGameColor.fastFlash')",
      );
      s = s.replace(": '흑과 백이 빠르게 번갈아 깜빡이며 무작위로 멈춥니다.'}", ": t('preGameColor.smoothEnd')}");
      return s;
    },
  },
  {
    file: 'components/BaseStoneColorChoicePanel.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const BaseStoneColorChoicePanel', "    const { t } = useTranslation('game');\n");
      s = s.replace('>방장이 왼쪽 색상 판을 선택합니다.<', ">{t('baseStoneChoice.hostPick')}<");
      s = s.replace('>잠시만 기다려 주세요.<', ">{t('baseStoneChoice.wait')}<");
      s = s.replace(
        "{isPairHostChoice ? '방장: 팀원의 색상 판을 대신으로 선택하세요.' : '마음에 드는 판을 선택하세요.'}",
        "{isPairHostChoice ? t('baseStoneChoice.pairHost') : t('baseStoneChoice.pickPanel')}",
      );
      s = s.replace(' (참가자1)', " {t('baseStoneChoice.teammate1')}");
      s = s.replace(' (참가자2)', " {t('baseStoneChoice.teammate2')}");
      s = s.replace('>선택을 전송했습니다. 상대 선택을 기다립니다.<', ">{t('baseStoneChoice.sentWaiting')}<");
      s = s.replace('>왼쪽 선택을 전송했습니다.<', ">{t('baseStoneChoice.sent')}<");
      return s;
    },
  },
  {
    file: 'components/UniformColorRouletteModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const UniformColorRouletteModal', "    const { t } = useTranslation('game');\n");
      s = s.replace('>일색 바둑<', ">{t('uniformColor.title')}<");
      s = s.replace(
        "? `이번 경기 돌 색상: ${resultLabel}`",
        "? t('uniformColor.thisColor', { color: resultLabel })",
      );
      s = s.replace(
        ": '흑돌과 백돌이 빠르게 번갈아 깜빡이며 무작위로 멈춥니다.'",
        ": t('uniformColor.flashHint')",
      );
      s = s.replace('>추첨 종료 후 자동으로 경기가 시작됩니다.<', ">{t('uniformColor.autoStart')}<");
      return s;
    },
  },
  {
    file: 'components/ConditionPotionModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureImport(s, LC);
      s = ensureHook(s, 'const ConditionPotionModal', "    const { t } = useTranslation('game');\n    const localizedGrade = useLocalizedItemGrade();\n");
      s = s.replace(
        /const GRADE_LABEL = \{[\s\S]*?\} as const;\n\nconst GRADE_RING/,
        'const GRADE_RING',
      );
      s = s.replace('title="컨디션 회복"', "title={t('conditionPotion.recoveryTitle')}");
      s = s.replace(
        'title={`${potion.name} · 회복 ${potion.minRecovery}~${potion.maxRecovery} · 보유 ${count}`}',
        "title={t('conditionPotion.potionTitle', { name: potion.name, min: potion.minRecovery, max: potion.maxRecovery, count })}",
      );
      s = s.replace('>현재 컨디션<', ">{t('conditionPotion.currentLabel')}<");
      s = s.replace(
        "{isNativeMobile ? '회복 후 (예상)' : '예상 회복 후 컨디션'}",
        "{isNativeMobile ? t('conditionPotion.expectedLabel') : t('conditionPotion.expectedLabel')}",
      );
      s = s.replace(
        "{isApplyingPotion ? '회복 적용 중...' : selectedPotionType && !hasPotion ? '상점으로 이동' : '회복제 사용'}",
        "{isApplyingPotion ? t('conditionPotion.applying') : selectedPotionType && !hasPotion ? t('conditionPotion.goShop') : t('conditionPotion.usePotion')}",
      );
      s = s.replace(/GRADE_LABEL\[grade\]/g, 'localizedGrade(grade)');
      return s;
    },
  },
  {
    file: 'components/DiceGoStartConfirmationModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const DiceGoStartConfirmationModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace(
        '<p className="text-center text-gray-300 mb-2">주사위 결과 <span className="font-bold text-yellow-300">{winner.nickname}</span>님이 승리하여 선/후공이 결정되었습니다.</p>',
        "<p className=\"text-center text-gray-300 mb-2\" dangerouslySetInnerHTML={{ __html: t('diceGo.winner', { name: winner.nickname }) }} />",
      );
      s = s.replace(
        '<p className="text-center text-gray-400 mb-4 text-sm">아래 시작 버튼을 누르거나 30초 후 대국이 자동으로 시작됩니다.</p>',
        "<p className=\"text-center text-gray-400 mb-4 text-sm\">{t('diceGo.autoStart')}</p>",
      );
      s = s.replace(
        "{hasConfirmed ? '상대방 확인 대기 중…' : `대국 시작 (${countdown})`}",
        "{hasConfirmed ? t('diceGo.waitingConfirmShort') : t('diceGo.startCountdownBtn', { countdown })}",
      );
      return s;
    },
  },
  {
    file: 'components/ThiefRoleConfirmedModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ThiefRoleConfirmedModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('title="룰렛으로 흑/백과 선공/후공이 결정되었습니다."', "title={t('thiefRole.subtitle')}");
      s = s.replace(
        "{hasConfirmed ? '상대방 확인 대기 중…' : !rouletteDone ? '룰렛 결과 확인 중..' : `대국 시작 (${countdown})`}",
        "{hasConfirmed ? t('startConfirm.waitingConfirm') : !rouletteDone ? t('startConfirm.checkingRoulette') : t('startConfirm.startCountdown', { count: countdown })}",
      );
      return s;
    },
  },
  {
    file: 'components/PairArenaDetailedStatsModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        '<span className="font-bold">{wins}</span>승',
        "<span className=\"font-bold\">{wins}</span>{t('common:wins')}",
      );
      s = s.replace(
        '<span className="font-bold text-slate-200">{losses}</span>패',
        "<span className=\"font-bold text-slate-200\">{losses}</span>{t('common:losses')}",
      );
      return s;
    },
  },
  {
    file: 'components/PairTurnOrderModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const PairTurnOrderModal', "    const { t } = useTranslation('game');\n");
      s = s.replace(
        /const seatLabel: Record<string, string> = \{[\s\S]*?\};\n\nconst ROULETTE/,
        'const ROULETTE',
      );
      s = s.replace('title="페어 순서 결정"', "title={t('pairTurnOrder.title')}");
      s = s.replace(
        "{rouletteDone ? '착수 순서가 결정되었습니다.' : '착수 순서를 결정하는 중입니다'}",
        "{rouletteDone ? t('pairTurnOrder.decided') : t('pairTurnOrder.deciding')}",
      );
      s = s.replace(
        '대국은 <span className="font-bold text-amber-200">흑 → 백 → 흑 → 백</span> 순서로 진행됩니다.',
        "{t('pairTurnOrder.orderHint')}",
      );
      s = s.replace("{seat.kind === 'user' ? '대국자' : seat.kind === 'pet' ? '펫 AI' : 'AI'}", "{seat.kind === 'user' ? t('pairTurnOrder.player') : seat.kind === 'pet' ? t('pairTurnOrder.petAi') : t('pairTurnOrder.ai')}");
      s = s.replace(
        "{hasConfirmed ? '확인 완료' : rouletteDone ? '경기 시작 확인' : '순서 결정 중'}",
        "{hasConfirmed ? t('pairTurnOrder.confirmDone') : rouletteDone ? t('pairTurnOrder.confirmStart') : t('pairTurnOrder.confirming')}",
      );
      s = s.replace('>대국자 확인을 기다리는 중입니다.<', ">{t('pairTurnOrder.waitingPlayers')}<");
      s = s.replace(/seatLabel\[seat\.seat\]/g, "t(`pairTurnOrder.${seat.seat}`)");
      return s;
    },
  },
  {
    file: 'components/PairPetObtainedModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const PairPetObtainedModal', "    const { t } = useTranslation('game');\n");
      s = s.replace(
        "mode === 'obtain' ? '펫 획득' : isEquippedRowDetail ? '대표펫 정보' : '펫 상세 정보'",
        "mode === 'obtain' ? t('pairPet.obtained') : isEquippedRowDetail ? t('pairPet.equippedDetail') : t('pairPet.detail')",
      );
      return s;
    },
  },
  {
    file: 'components/NigiriModal.tsx',
    fn: (c) => c.replace('title="흑·백 확인"', "title={t('nigiri.confirmTitle')}"),
  },
  {
    file: 'components/StageSelectionModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const StageSelectionModal', "    const { t } = useTranslation('game');\n");
      s = s.replace(
        /목표 점수: 흑\{stage\.targetScore\.black > 0 \? stage\.targetScore\.black : '0'\}\/백\{stage\.targetScore\.white > 0 \? stage\.targetScore\.white : '0'\}집/,
        "{t('stageSelection.targetScore', { black: stage.targetScore.black > 0 ? stage.targetScore.black : '0', white: stage.targetScore.white > 0 ? stage.targetScore.white : '0' })}",
      );
      return s;
    },
  },
  {
    file: 'components/SinglePlayerGameDescriptionModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N_CFG);
      s = ensureHook(s, 'const SinglePlayerGameDescriptionModal', "    const { t } = useTranslation('game');\n");
      s = s.replace(
        /const SINGLE_PLAYER_LEVEL_DISPLAY: Partial<Record<SinglePlayerLevel, string>> = \{[\s\S]*?\};\n/,
        `const SINGLE_PLAYER_LEVEL_KEY: Partial<Record<SinglePlayerLevel, string>> = {
    [SinglePlayerLevel.입문]: 'intro',
    [SinglePlayerLevel.초급]: 'beginner',
    [SinglePlayerLevel.중급]: 'intermediate',
    [SinglePlayerLevel.고급]: 'advanced',
    [SinglePlayerLevel.유단자]: 'masterClass',
};
`,
      );
      s = s.replace(
        "return { line1: '도전의 탑', line2: stage.name };",
        "return { line1: i18n.t('game:singlePlayerDesc.tower'), line2: stage.name };",
      );
      s = s.replace(
        "const label = SINGLE_PLAYER_LEVEL_DISPLAY[stage.level as SinglePlayerLevel] ?? '바둑학원';",
        "const levelKey = SINGLE_PLAYER_LEVEL_KEY[stage.level as SinglePlayerLevel];\n    const label = levelKey ? i18n.t(`game:singlePlayerDesc.${levelKey}`) : i18n.t('game:singlePlayerDesc.academy');",
      );
      s = s.replace(
        'line2: stageNum ? `스테이지 ${stageNum}` : stage.name',
        "line2: stageNum ? i18n.t('game:singlePlayerDesc.stage', { num: stageNum }) : stage.name",
      );
      s = s.replace("? '살리기 바둑'", "? t('singlePlayerDesc.survivalGo')");
      s = s.replace("{isTower ? '도전의 탑' : '싱글 스테이지'}", "{isTower ? t('singlePlayerDesc.tower') : t('singlePlayerDesc.singleStage')}");
      s = s.replace('>모드<', ">{t('singlePlayerDesc.modeLabel')}<");
      s = s.replace('>클리어 보상<', ">{t('singlePlayerDesc.clearReward')}<");
      s = s.replace('>보상없음<', ">{t('singlePlayerDesc.noReward')}<");
      s = s.replace('>확인<', ">{t('singlePlayerDesc.confirm')}<");
      s = s.replace('>이전<', ">{t('singlePlayerDesc.prev')}<");
      s = s.replace('>다음<', ">{t('singlePlayerDesc.next')}<");
      s = s.replace('>스테이지 편집<', ">{t('singlePlayerDesc.editStage')}<");
      s = s.replace('>순서 편집<', ">{t('singlePlayerDesc.editOrder')}<");
      s = s.replace('>취소<', ">{t('singlePlayerDesc.cancel')}<");
      s = s.replace('>시작하기<', ">{t('singlePlayerDesc.start')}<");
      s = s.replace(
        'title={`${stageDisplayName} - 게임 설명`}',
        "title={t('singlePlayerDesc.title', { name: stageDisplayName })}",
      );
      s = s.replace('>게임 설명<', ">{t('singlePlayerDesc.gameDesc')}<");
      return s;
    },
  },
  {
    file: 'components/TurnPreferenceSelection.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const TurnPreferenceSelection', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('>선택 완료!<', ">{t('turnPreference.selectionDone')}<");
      s = s.replace('>원하는 순서를 선택하세요. 순서가 같으면 룰렛으로 무작위로 정해집니다.<', ">{t('turnPreference.pickOrder')}<");
      s = s.replace('>자동 선택까지<', ">{t('turnPreference.autoSelect')}<");
      s = s.replace('>선공 (흑)<', ">{t('diceGo.firstBlack')}<");
      s = s.replace('>후공 (백)<', ">{t('diceGo.secondWhite')}<");
      s = s.replace('>자동 선택<', ">{t('turnPreference.autoSelectShort')}<");
      return s;
    },
  },
  {
    file: 'components/TurnPreferenceRouletteModal.tsx',
    fn: (c) => c.replace('title="선공 · 후공"', "title={t('turnRoulette.title')}"),
  },
  {
    file: 'components/ThiefDeathmatchRoleRouletteModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ThiefDeathmatchRoleRouletteModal', "    const { t } = useTranslation('game');\n");
      s = s.replace('>데스매치 역할 룰렛<', ">{t('thiefDeathmatch.title')}<");
      s = s.replace('>룰렛으로 역할을 결정합니다.<', ">{t('thiefDeathmatch.subtitle')}<");
      return s;
    },
  },
  {
    file: 'components/GameApplicationModal.tsx',
    fn: (c) => c.replace('>게임을 선택해주세요.<', ">{t('gameApplication.selectMode')}<"),
  },
  {
    file: 'components/ColorAssignmentStickyFooter.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ColorAssignmentStickyFooter', "    const { t } = useTranslation('game');\n");
      s = s.replace('>상대방 확인 대기 중…<', ">{t('colorSticky.waiting')}<");
      s = s.replace('>시작하기<', ">{t('colorSticky.start')}<");
      return s;
    },
  },
  {
    file: 'components/ColorStartConfirmationModal.tsx',
    fn: (c) => c.replace('title="니기리 확인"', "title={t('colorStart.title')}"),
  },
  {
    file: 'components/DetailedStatsResetConfirmModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const DetailedStatsResetConfirmModal', "    const { t } = useTranslation('profile');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace(
        'aria-label={`다이아 ${amount.toLocaleString()}`}',
        "aria-label={tCommon('diamondAria', { amount: amount.toLocaleString() })}",
      );
      s = s.replace('title="전적 초기화"', "title={t('detailedStatsReset.title')}");
      s = s.replace('>아래 전적을 초기화합니다.<', ">{t('detailedStatsReset.willReset')}<");
      s = s.replace('>기록된 PVP 전적 없음<', ">{t('detailedStatsReset.noPvp')}<");
      s = s.replace('>기록된 AI 전적 없음<', ">{t('detailedStatsReset.noAi')}<");
      s = s.replace('>초기화 범위<', ">{t('detailedStatsReset.scope')}<");
      s = s.replace(
        '{DETAILED_STAT_RESET_SCOPE_LABELS[scope]} 초기화됩니다.',
        "{t('detailedStatsReset.scopeLabel', { scope: DETAILED_STAT_RESET_SCOPE_LABELS[scope] })}",
      );
      s = s.replace('>취소<', ">{tCommon('cancel')}<");
      s = s.replace('>초기화<', ">{t('detailedStatsReset.resetBtn')}<");
      return s;
    },
  },
  {
    file: 'components/HomeNativeMergedEquipmentAbilityPanel.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'export const HomeNativeMergedEquipmentAbilityPanel', "    const { t } = useTranslation('profile');\n");
      s = ensureHook(s, 'export const HomeEquippedSlotDisplay', "    const { t } = useTranslation('profile');\n");
      s = s.replace(
        'const titleText = `${item.name} (${formatEquipLevelRequirement(requiredLevel)}) - 클릭하여 상세보기`;',
        "const titleText = t('coreAbility.detailClick', { name: item.name, level: formatEquipLevelRequirement(requiredLevel) });",
      );
      s = s.replace('>장비 효과<', ">{t('coreAbility.equipmentEffects')}<");
      s = s.replaceAll('title="6개 핵심 능력치 합계"', "title={t('coreAbility.coreTotal')}");
      s = s.replaceAll('>바둑능력<', ">{t('coreAbility.goAbility')}<");
      s = s.replace(
        'title={`보너스: ${availablePoints}P`}',
        "title={t('coreAbility.bonusPoints', { points: availablePoints })}",
      );
      s = s.replaceAll('>보너스 <', ">{t('coreAbility.bonusLabel')} <");
      s = s.replaceAll('>분배<', ">{t('coreAbility.allocate')}<");
      s = s.replace(
        "? `기본 ${baseV} → 표시 ${v} (장비·보너스 +${bonusRounded})`",
        "? t('coreAbility.statBreakdown', { base: baseV, shown: v, bonus: bonusRounded })",
      );
      s = s.replace(
        ": `기본 ${baseV} · 장비·보너스 반영`",
        ": t('coreAbility.statBaseOnly', { base: baseV })",
      );
      s = s.replace('aria-label="챔피언십 페이즈별 능력치 점수"', "aria-label={t('coreAbility.phaseScoreAria')}");
      s = s.replace("{ key: 'opening' as const, label: '초반' }", "{ key: 'opening' as const, label: t('coreAbility.opening') }");
      s = s.replace("{ key: 'midgame' as const, label: '중반' }", "{ key: 'midgame' as const, label: t('coreAbility.midgame') }");
      s = s.replace("{ key: 'endgame' as const, label: '종반' }", "{ key: 'endgame' as const, label: t('coreAbility.endgame') }");
      return s;
    },
  },
  {
    file: 'components/CurlingRoundSummary.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const CurlingRoundSummary', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('>하우스<', ">{t('roundSummary.house')}<");
      s = s.replace('>넉아웃<', ">{t('roundSummary.knockout')}<");
      s = s.replace('>합계<', ">{tCommon('total')}<");
      s = s.replace('>결과 보드<', ">{t('roundSummary.resultBoardTab')}<");
      s = s.replace('>상세 점수<', ">{t('roundSummary.detailScores')}<");
      s = s.replace('>라운드 결과 보드<', ">{t('roundSummary.roundResultBoard')}<");
      return s;
    },
  },
  {
    file: 'components/ThiefRoundSummary.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ThiefRoundSummary', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace("{isThief ? '도둑' : '경찰'}", "{isThief ? t('thiefRound.thief') : t('thiefRound.police')}");
      s = s.replace("{isThief ? '생존' : '검거'}", "{isThief ? t('thiefRound.survive') : t('thiefRound.arrest')}");
      s = s.replace('<span className="ml-0.5 font-sans text-[11px] font-normal text-zinc-300">개</span>', "<span className=\"ml-0.5 font-sans text-[11px] font-normal text-zinc-300\">{t('thiefRound.piecesUnit')}</span>");
      s = s.replace(
        'const title = isDeathmatch ? `데스매치 ${round - 2} 종료` : `${round}라운드 집계`;',
        "const title = isDeathmatch ? t('thiefRound.deathmatchEnd', { round: round - 2 }) : t('thiefRound.roundSummary', { round });",
      );
      s = s.replace("description = '동점으로 데스매치를 이어갑니다.';", "description = t('thiefRound.tieDeathmatch');");
      s = s.replace("description = '역할을 바꿔 다음 라운드를 진행합니다.';", "description = t('thiefRound.swapRoles');");
      s = s.replace("description = '2라운드 종료. 동점이면 데스매치입니다.';", "description = t('thiefRound.round2Tie');");
      s = s.replace("const btnLabel = hasConfirmed ? '상대 확인 대기' : '다음 라운드';", "const btnLabel = hasConfirmed ? t('thiefRound.waitingConfirm') : t('thiefRound.nextRound');");
      s = s.replace("const countdownLabel = isDeathmatch ? '다음 데스매치 자동 시작까지' : '다음 라운드 자동 시작까지';", "const countdownLabel = isDeathmatch ? tCommon('deathmatchAuto') : tCommon('nextRoundAuto');");
      s = s.replace("const countdownLabelShort = isDeathmatch ? '데스매치까지' : '다음까지';", "const countdownLabelShort = isDeathmatch ? tCommon('deathmatchShort') : tCommon('nextRoundShort');");
      return s;
    },
  },
  {
    file: 'components/PointsInfoPanel.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureImport(s, I18N_CFG);
      s = s.replace(
        /const TOURNAMENT_ARENA_META: \{ type: TournamentType; arena: string; title: string; maxRank: number \}\[\] = \[[\s\S]*?\];\n/,
        `const TOURNAMENT_ARENA_META: { type: TournamentType; arenaKey: string; titleKey: string; maxRank: number }[] = [
    { type: 'neighborhood', arenaKey: 'neighborhood', titleKey: 'neighborhoodTitle', maxRank: 6 },
    { type: 'national', arenaKey: 'national', titleKey: 'nationalTitle', maxRank: 8 },
    { type: 'world', arenaKey: 'world', titleKey: 'worldTitle', maxRank: 15 },
];
`,
      );
      s = s.replace(
        "const label = startRank === endRank ? `${startRank}위` : `${startRank}~${endRank}위`;",
        "const label = startRank === endRank ? i18n.t('tournament:championship.points.rankPlace', { start: startRank }) : i18n.t('tournament:championship.points.rankRange', { start: startRank, end: endRank });",
      );
      s = ensureHook(s, 'const PointsInfoPanel', "    const { t } = useTranslation('tournament');\n");
      s = s.replace('>일일 획득 가능 점수<', ">{t('championship.points.dailyTitle')}<");
      s = s.replace('>단계 선택<', ">{t('championship.points.stageSelectLabel')}<");
      s = s.replace('aria-label="점수표 단계 선택"', "aria-label={t('championship.points.stageSelectAria')}");
      s = s.replace(
        "{stage}단계",
        "{t('championship.points.stageUnit', { stage })}",
      );
      s = s.replace(
        "{embedded && arenaTabs && myStageForActiveArena != null && stage === myStageForActiveArena ? ' (내 단계)' : ''}",
        "{embedded && arenaTabs && myStageForActiveArena != null && stage === myStageForActiveArena ? t('championship.points.myStage') : ''}",
      );
      s = s.replace(
        '{arenaData.title} ({selectedStage}단계)',
        "{t(`championship.points.${arenaData.titleKey}`)} ({t('championship.points.stageUnit', { stage: selectedStage })})",
      );
      s = s.replace('>순위<', ">{t('championship.points.rankHeader')}<");
      s = s.replace('>점수<', ">{t('championship.points.scoreHeader')}<");
      s = s.replace('<span className="ml-0.5 font-sans font-bold">점</span>', "<span className=\"ml-0.5 font-sans font-bold\">{t('championship.points.pointsUnit')}</span>");
      return s;
    },
  },
  {
    file: 'components/ChampionshipRankingPanel.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ChampionshipRankingPanel', "    const { t } = useTranslation('tournament');\n");
      s = s.replace(
        'title={!isCurrentUser ? `${entry.nickname} 프로필 보기` : \'\'}',
        "title={!isCurrentUser ? t('championship.ranking.viewProfile', { name: entry.nickname }) : ''}",
      );
      s = s.replace(
        '로그인 후 챔피언십 랭킹을 확인할 수 있습니다.',
        "{t('championship.ranking.loginHint')}",
      );
      s = s.replace('>챔피언십 랭킹<', ">{t('championship.ranking.title')}<");
      s = s.replace('>데이터 로딩 중...<', ">{t('championship.ranking.loading')}<");
      s = s.replace('>랭킹을 불러오는데 실패했습니다.<', ">{t('championship.ranking.loadFailed')}<");
      s = s.replace('>랭킹에 표시할 점수가 있는 유저가 없습니다.<', ">{t('championship.ranking.noScoredUsers')}<");
      s = s.replace('>로딩 중...<', ">{t('championship.ranking.loadingMore')}<");
      s = s.replace('>랭킹 불러오는 중...<', ">{t('championship.ranking.loadingRank')}<");
      s = s.replace(
        '{entry.score.toLocaleString()}점',
        "{t('lobby.scorePoints', { score: entry.score.toLocaleString() })}",
      );
      s = s.replace(
        '{myRankDisplay.score.toLocaleString()}점',
        "{t('lobby.scorePoints', { score: myRankDisplay.score.toLocaleString() })}",
      );
      s = s.replace('>랭크된 유저가 없습니다.<', ">{t('championship.ranking.noRankedUsers')}<");
      return s;
    },
  },
  {
    file: 'components/ChampionshipVersusDuelHistoryModal.tsx',
    fn: (c) => {
      let s = fixBrokenHookInjection(c);
      s = s.replace("title = '대전정보',", "title = t('lobby.duelInfo'),");
      s = s.replace('>닫기<', ">{t('common:closeViewer')}<");
      s = s.replace(
        'KST 기준 최근 7일간의 기록입니다. 하루가 지날수록 오래된 기록은 자동으로 사라집니다.',
        "{t('championship.duelHistory.kstHint')}",
      );
      s = s.replace('>랭킹점수 변화<', ">{t('championship.duelHistory.rankDelta')}<");
      return s;
    },
  },
  {
    file: 'components/AnnouncementsModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const AnnouncementsModal', "    const { t } = useTranslation('nav');\n");
      s = s.replace('title="공지 / 패치 노트"', "title={t('announcements.title')}");
      s = s.replace(
        '공지사항 및 패치/업데이트 내역을 확인할 수 있습니다.',
        "{t('announcements.body')}",
      );
      s = s.replace(
        '적용: {modesLabel(globalOverrideAnnouncement.modes)}',
        "{t('announcements.applied', { modes: modesLabel(globalOverrideAnnouncement.modes) })}",
      );
      s = s.replace('>등록된 공지가 없습니다.<', ">{t('announcements.empty')}<");
      return s;
    },
  },
  {
    file: 'components/GameRecordListModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const GameRecordListModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace(
        '게임 종료 후 기보 저장을 누르면 여기에 쌓입니다.',
        "{t('gameRecords.saveHint')}",
      );
      s = s.replace(
        /흑 \{record\.gameResult\.blackScore\}\s*<span className="mx-1 text-slate-600">:<\/span>\s*\{record\.gameResult\.whiteScore\} 백/,
        "{t('gameRecords.blackWhiteScore', { black: record.gameResult.blackScore, white: record.gameResult.whiteScore })}",
      );
      s = s.replace(
        '목록에서 기보를 선택하면 우측에서 바로 복기할 수 있습니다.',
        "{t('gameRecords.selectHint')}",
      );
      s = s.replace('>기보 목록<', ">{t('gameRecords.recordList')}<");
      s = s.replace('>대국 정보<', ">{t('gameRecords.gameInfo')}<");
      s = s.replace('>기보보기<', ">{t('gameRecords.viewRecord')}<");
      return s;
    },
  },
  {
    file: 'components/GameRecordViewerModal.tsx',
    fn: (c) => {
      let s = fixBrokenHookInjection(c);
      s = s.replace(
        'title={`기보 뷰 ${record.opponentNickname ?? record.mode}`}',
        "title={t('gameRecords.viewerTitle', { name: record.opponentNickname ?? record.mode })}",
      );
      return s;
    },
  },
];

export function runPass6bMigrations() {
  const ko = readJson('shared/i18n/catalog/ko.json');
  const en = readJson('shared/i18n/catalog/en.json');
  extendCatalogPass6b(ko, en);
  writeJson('shared/i18n/catalog/ko.json', ko);
  writeJson('shared/i18n/catalog/en.json', en);

  let modified = 0;
  for (const { file, fn, skip } of migrations) {
    if (skip) continue;
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const before = read(file);
    const after = fn(before);
    if (after !== before) {
      write(file, after);
      modified++;
      console.log('Pass6b:', file);
    }
  }
  console.log(`Pass6b done: ${modified} files modified.`);
  return modified;
}
