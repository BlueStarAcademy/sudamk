/**
 * Pass 4: remaining target-batch UI Korean → i18n.
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
const I18N_CFG = "import i18n from '../shared/i18n/config.js';\n";
const I18N_CFG_BS = "import i18n from '../../shared/i18n/config.js';\n";
const LC_ROOT = "import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';\n";

const profT = (key, opts) => i18n.t(`profile:${key}`, opts);
const invT = (key, opts) => i18n.t(`inventory:${key}`, opts);
const tourT = (key, opts) => i18n.t(`tournament:${key}`, opts);
const gameT = (key, opts) => i18n.t(`game:${key}`, opts);

export function extendCatalogPass4(ko, en) {
  Object.assign(ko.profile.detailedStats, {
    resetAll: '전체 초기화',
    resetBtn: '초기화',
    totalShort: '합계',
    pointsUnit: '점',
    winSuffix: '승 ',
    lossSuffix: '패',
    pvpWinLoss: '{{wins}}승 {{losses}}패 ({{winRate}}%)',
    aiWinLoss: 'AI {{wins}}승 {{losses}}패 ({{winRate}}%)',
  });
  Object.assign(en.profile.detailedStats, {
    resetAll: 'Reset all',
    resetBtn: 'Reset',
    totalShort: 'Total',
    pointsUnit: 'pts',
    winSuffix: 'W ',
    lossSuffix: 'L',
    pvpWinLoss: '{{wins}}W {{losses}}L ({{winRate}}%)',
    aiWinLoss: 'AI {{wins}}W {{losses}}L ({{winRate}}%)',
  });

  Object.assign(ko.game.pairStats, {
    title: '페어 경기장 상세 전적',
    modeTarget: '「{{name}}」 페어 경기장',
    modeResetNote: '모드별 페어 전적만 초기화됩니다. 랭킹전·페어 AI 전적은 유지됩니다.',
    pairAll: '페어 바둑 전체',
    pairSeasonNote: 'PVP 전적 초기화 시 페어 시즌 랭킹 점수도 함께 초기화됩니다.',
    resetPairAll: '다이아 {{cost}} — 페어 전략 모드 전체',
  });
  Object.assign(en.game.pairStats, {
    title: 'Pair arena detailed record',
    modeTarget: '{{name}} pair arena',
    modeResetNote: 'Resets pair mode only. Ranking and pair AI kept.',
    pairAll: 'All pair Go',
    pairSeasonNote: 'Resetting PVP also resets pair season ranking score.',
    resetPairAll: '{{cost}} diamonds — all pair strategic modes',
  });

  Object.assign(ko.inventory.tierInfo, {
    intro: '각 게임 모드의 랭킹 점수에 따라 시즌 티어가 결정됩니다. 티어는 시즌 종료 시 랭킹 순위에 따라 확정되며, 보상이 지급됩니다.',
    seasonResetDesc: '각 시즌 종료 시 랭킹이 초기화되고 보상이 지급됩니다.',
  });
  Object.assign(en.inventory.tierInfo, {
    intro: 'Season tier is based on ranked score per mode. Tiers finalize at season end by rank; rewards are paid out.',
    seasonResetDesc: 'Rankings reset and rewards are paid at each season end.',
  });

  Object.assign(ko.inventory.leagueTier, {
    titleRanking: '랭킹전 리그 안내',
    intro: '전략바둑 랭킹전 PVP에서 얻는 점수에 따라 티어가 결정됩니다. 주간 종료 시 순위에 따라 승급·잔류·강등이 적용되며, 티어별 보상을 받을 수 있습니다.',
    stay: '잔류',
    rankPlace: '{{rank}}위',
    rankRange: '{{start}}-{{end}}위',
    outcomeLine: '{{label}}: {{ranges}}',
    diamondsAlt: '다이아',
  });
  Object.assign(en.inventory.leagueTier, {
    titleRanking: 'Ranked league guide',
    intro: 'Tier is based on strategic ranked PVP score. Weekly rank determines promote, stay, or demote; tier rewards apply.',
    stay: 'Stay',
    rankPlace: '{{rank}}th',
    rankRange: '{{start}}–{{end}}th',
    outcomeLine: '{{label}}: {{ranges}}',
    diamondsAlt: 'Diamonds',
  });

  Object.assign(ko.tournament.championship.venue, {
    oneGamePerMatch: '1개/경기 (랜덤)',
    changeTicketShort: '변경권',
    rankWorld9_16: '9~16위',
    rankWorld4_8: '4~8위',
    stageLabel: '단계',
    stageUnit: '{{stage}}단계',
    stageLocked: '선택한 단계는 아직 잠겨 있습니다.',
    itemColumn: '항목',
    meColumn: '나',
    opponentColumn: '상대',
    avgStat: '평균 능력치',
    badukAbility: '바둑능력',
    defaultRewardFallback: '기본 보상',
  });
  Object.assign(en.tournament.championship.venue, {
    oneGamePerMatch: '1/game (random)',
    changeTicketShort: 'Change ticket',
    rankWorld9_16: '9–16th',
    rankWorld4_8: '4–8th',
    stageLabel: 'Stage',
    stageUnit: 'Stage {{stage}}',
    stageLocked: 'This stage is still locked.',
    itemColumn: 'Item',
    meColumn: 'You',
    opponentColumn: 'Opponent',
    avgStat: 'Avg stat',
    badukAbility: 'Go ability',
    defaultRewardFallback: 'Default reward',
  });

  Object.assign(ko.tournament.championship.simulationHelp, {
    overviewBody: '플레이어의 능력치와 컨디션을 기반으로 자동 진행되는 경기입니다. 경기는 50초 동안 진행되며, 초반/중반/종반으로 나뉩니다.',
    altSimulation: '시뮬레이션 경기',
    altGold: '골드',
    altMaterial: '재료',
    altEquipmentBox: '장비상자',
    altCondition: '컨디션',
    rewardNeighborhood: '동네바둑리그: 골드 획득',
    rewardNational: '전국바둑대회: 재료(강화석) 획득',
    rewardWorld: '월드챔피언십: 장비 상자 획득',
    fiftySeconds: '50초',
    progressOpening: '초반(1-15초): 초반 능력치 중요',
    progressMidgame: '중반(16-35초): 중반 능력치 중요',
    progressEndgame: '종반(36-50초): 종반 능력치 중요',
    progressScoring: '각 단계마다 해당 능력치에 따라 점수 누적',
    openingFormula: '초반: 집중력×0.4 + 사고속도×0.3 + 판단력×0.4 + 계산력×0.3 + 전투력×0.1 + 안정감×0.5',
    midgameFormula: '중반: 집중력×0.3 + 사고속도×0.3 + 판단력×0.4 + 계산력×0.1 + 전투력×0.8 + 안정감×0.1',
    endgameFormula: '종반: 집중력×0.3 + 사고속도×0.4 + 판단력×0.1 + 계산력×0.6 + 전투력×0.1 + 안정감×0.5',
    randomEvent1: '5초마다 30% 확률로 발생',
    randomEvent2: '4가지 종류: 집중력 감소(부정), 사고속도 증가(긍정), 전투력 증가(긍정), 안정감 증가(긍정)',
    randomEvent3: '능력치가 높을수록 긍정 이벤트 확률 증가',
    randomEvent4: '현재 총 점수의 2~10%만큼 점수 변화',
    critical1: '판단력이 치명타 발생 확률에 영향',
    critical2: '치명타 발생 시 추가 점수 획득',
    critical3: '전투력과 계산력이 추가 점수에 영향',
    condition1: '각 경기 전에 40~100 사이의 랜덤 컨디션 부여',
    condition2: '시뮬레이션 진행 중에는 능력치 수치가 바뀌지 않습니다',
    condition3: '컨디션 회복제로 회복 가능 (경기 시작 전에만 사용)',
  });
  Object.assign(en.tournament.championship.simulationHelp, {
    overviewBody: 'Matches run automatically from stats and condition. Each match lasts 50 seconds in opening, midgame, and endgame.',
    altSimulation: 'Simulation match',
    altGold: 'Gold',
    altMaterial: 'Material',
    altEquipmentBox: 'Equipment box',
    altCondition: 'Condition',
    rewardNeighborhood: 'Neighborhood: gold',
    rewardNational: 'National: materials (stones)',
    rewardWorld: 'World: equipment box',
    fiftySeconds: '50 sec',
    progressOpening: 'Opening (1–15s): opening stats matter',
    progressMidgame: 'Midgame (16–35s): midgame stats matter',
    progressEndgame: 'Endgame (36–50s): endgame stats matter',
    progressScoring: 'Score accumulates by phase stats',
    openingFormula: 'Opening: Concentration×0.4 + Thinking×0.3 + Judgment×0.4 + Calc×0.3 + Combat×0.1 + Stability×0.5',
    midgameFormula: 'Midgame: Concentration×0.3 + Thinking×0.3 + Judgment×0.4 + Calc×0.1 + Combat×0.8 + Stability×0.1',
    endgameFormula: 'Endgame: Concentration×0.3 + Thinking×0.4 + Judgment×0.1 + Calc×0.6 + Combat×0.1 + Stability×0.5',
    randomEvent1: '30% chance every 5 seconds',
    randomEvent2: 'Four types: −concentration, +thinking, +combat, +stability',
    randomEvent3: 'Higher stats increase positive event odds',
    randomEvent4: 'Score changes by 2–10% of current total',
    critical1: 'Judgment affects crit rate',
    critical2: 'Crits grant bonus score',
    critical3: 'Combat and calculation affect bonus',
    condition1: 'Random condition 40–100 before each match',
    condition2: 'Stats do not change during simulation',
    condition3: 'Recover with potions before match start only',
  });

  Object.assign(ko.game.rps, {
    rock: '바위',
    paper: '보',
    scissors: '가위',
    thiefOverlap: '역할이 겹쳤습니다! 이긴 사람이 역할을 가져갑니다.',
    turnOverlap: '순서가 겹쳤습니다! 이긴 사람이 원하는 순서를 가져갑니다.',
    diceDefault: '먼저 주사위를 굴릴 플레이어를 정합니다.',
    rpsRound: '가위바위보 {{round}}',
    tieRandom: '무승부! 랜덤으로 결정됩니다...',
    tieAgain: '무승부! 다시 한번!',
    win: '승리!',
    winFirst: '승리! 선공입니다.',
    winRole: '승리! 원하는 역할을 가져갑니다.',
    winStart: '승리! {{choice}}으로 시작합니다.',
    lose: '패배!',
    loseSecond: '패배! 후공입니다.',
    loseRole: '패배! 상대방이 역할을 선택합니다.',
    loseStart: '패배! 상대가 {{choice}}으로 시작합니다.',
    choiceDone: '선택 완료!',
    waitingChoice: '{{name}}님의 선택을 기다리고 있습니다...',
    tieWarning: '이번에도 비기면 랜덤으로 결정됩니다!',
    firstShort: '선공',
    secondShort: '후공',
  });
  Object.assign(en.game.rps, {
    rock: 'Rock',
    paper: 'Paper',
    scissors: 'Scissors',
    thiefOverlap: 'Roles tied! Winner picks role.',
    turnOverlap: 'Order tied! Winner picks turn order.',
    diceDefault: 'Roll dice to pick first player.',
    rpsRound: 'RPS {{round}}',
    tieRandom: 'Tie! Random pick…',
    tieAgain: 'Tie! Again!',
    win: 'You win!',
    winFirst: 'You win! You go first.',
    winRole: 'You win! Pick your role.',
    winStart: 'You win! Start as {{choice}}.',
    lose: 'You lose!',
    loseSecond: 'You lose! You go second.',
    loseRole: 'You lose! Opponent picks role.',
    loseStart: 'You lose! Opponent starts as {{choice}}.',
    choiceDone: 'Choice locked!',
    waitingChoice: 'Waiting for {{name}}…',
    tieWarning: 'Another tie → random!',
    firstShort: 'First',
    secondShort: 'Second',
  });

  Object.assign(ko.inventory.purchase, {
    typeDivider: '구분 · {{type}}',
    gradeDivider: '등급 · {{grade}}',
    purchaseQty: '구매 수량',
    ownedTotalLine: '{{label}} · 합계 {{count}}개 보유',
    unitPriceLabel: '개당 판매가',
    checkoutAmount: '결제 예정 금액',
    ownedCapLine: '보유 제한: 최대 {{max}}개 보유 가능',
    ownedCapCurrent: '(현재 {{current}}/{{max}})',
    dailyCapLine: '구매 제한: 하루 최대 {{max}}개 구매 가능',
    dailyCapToday: '(오늘 {{today}}/{{max}})',
    bagFullPartial: '가방 공간이 부족합니다. 현재 {{max}}개까지만 구매할 수 있습니다.',
  });
  Object.assign(en.inventory.purchase, {
    typeDivider: 'Type · {{type}}',
    gradeDivider: 'Grade · {{grade}}',
    purchaseQty: 'Purchase quantity',
    ownedTotalLine: '{{label}} · {{count}} owned',
    unitPriceLabel: 'Unit price',
    checkoutAmount: 'Checkout amount',
    ownedCapLine: 'Owned cap: max {{max}}',
    ownedCapCurrent: '({{current}}/{{max}})',
    dailyCapLine: 'Daily limit: {{max}} per day',
    dailyCapToday: '({{today}}/{{max}} today)',
    bagFullPartial: 'Bag full. You can buy up to {{max}}.',
  });

  Object.assign(ko.inventory.sellBulk, {
    ownedTotalLine: '{{label}} · 합계 {{count}}개 보유',
    unitPriceLabel: '개당 판매가',
  });
  Object.assign(en.inventory.sellBulk, {
    ownedTotalLine: '{{label}} · {{count}} owned',
    unitPriceLabel: 'Unit price',
  });

  Object.assign(ko.blacksmith.disassemble, {
    itemCount: '{{count}}개',
  });
  Object.assign(en.blacksmith.disassemble, {
    itemCount: '{{count}}',
  });
}

/** @type {Array<{file:string, fn:(c:string)=>string}>} */
const migrations = [
  {
    file: 'components/DetailedStatsModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        `const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => (
    <span
        className={\`inline-flex items-center gap-0.5 tabular-nums \${className}\`}
        aria-label={t('detailedStats.diamondsAria', { amount: amount.toLocaleString() })}
    >
        <img src={DIAMOND_ICON} alt="" className={\`object-contain \${iconClassName}\`} aria-hidden />
        <span className="font-semibold">{amount.toLocaleString()}</span>
    </span>
);`,
        `const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => {
    const { t } = useTranslation('profile');
    return (
        <span
            className={\`inline-flex items-center gap-0.5 tabular-nums \${className}\`}
            aria-label={t('detailedStats.diamondsAria', { amount: amount.toLocaleString() })}
        >
            <img src={DIAMOND_ICON} alt="" className={\`object-contain \${iconClassName}\`} aria-hidden />
            <span className="font-semibold">{amount.toLocaleString()}</span>
        </span>
    );
};`,
      );
      s = s.replace(
        "seasonResetNote: 'PVP 전적 초기화 시 시즌 랭킹 점수도 함께 초기화됩니다.',",
        "seasonResetNote: t('detailedStats.seasonResetNote'),",
      );
      s = s.replace(
        '<span className="ml-0.5 text-[0.7em] font-semibold text-secondary/85">점</span>',
        '<span className="ml-0.5 text-[0.7em] font-semibold text-secondary/85">{t(\'detailedStats.pointsUnit\')}</span>',
      );
      s = s.replace(
        '>놀이 바둑은 랭킹전이 없습니다<',
        ">{t('detailedStats.noPairRanking')}<",
      );
      s = s.replace(
        '<span className={`mr-1.5 font-semibold ${panelTheme.labelMuted}`}>합계</span>',
        '<span className={`mr-1.5 font-semibold ${panelTheme.labelMuted}`}>{t(\'detailedStats.totalShort\')}</span>',
      );
      s = s.replaceAll('<span className="text-secondary/75">승 </span>', '<span className="text-secondary/75">{t(\'detailedStats.winSuffix\')}</span>');
      s = s.replaceAll('<span className="text-secondary/75">패</span>', '<span className="text-secondary/75">{t(\'detailedStats.lossSuffix\')}</span>');
      s = s.replaceAll(
        '<span className="font-bold">{wins}</span>승{\' \'}\n                                            <span className="font-bold text-slate-200">{losses}</span>패 ({winRate}%)',
        '{t(\'detailedStats.pvpWinLoss\', { wins, losses, winRate })}',
      );
      s = s.replace(
        'AI {aiW}승 {aiL}패 ({aiWr}%)',
        "{t('detailedStats.aiWinLoss', { wins: aiW, losses: aiL, winRate: aiWr })}",
      );
      s = s.replaceAll(
        '? `다이아 ${SINGLE_RESET_COST} — 이 모드만 초기화`\n                                                : `다이아 부족 (필요 ${SINGLE_RESET_COST})`',
        "? t('detailedStats.resetSingle', { cost: SINGLE_RESET_COST })\n                                                : t('detailedStats.diamondInsufficient', { cost: SINGLE_RESET_COST })",
      );
      s = s.replaceAll('<span>초기화</span>', '<span>{t(\'detailedStats.resetBtn\')}</span>');
      s = s.replaceAll(
        'title={canAffordCategory ? resetTitle : `다이아 부족 (필요 ${CATEGORY_RESET_COST.toLocaleString()})`}',
        "title={canAffordCategory ? resetTitle : t('detailedStats.diamondInsufficient', { cost: CATEGORY_RESET_COST.toLocaleString() })}",
      );
      s = s.replaceAll('<span>전체 초기화</span>', '<span>{t(\'detailedStats.resetAll\')}</span>');
      s = s.replace('>전략<', ">{t('detailedStats.tabStrategic')}<");
      s = s.replace('>페어<', ">{t('detailedStats.tabPair')}<");
      s = s.replace('>놀이<', ">{t('detailedStats.tabPlayful')}<");
      s = s.replace(
        '`다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 전략 전체`',
        "t('detailedStats.resetCategory', { cost: CATEGORY_RESET_COST.toLocaleString() })",
      );
      s = s.replace(
        '`다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 놀이 전체`',
        "t('detailedStats.resetPlayfulCategory', { cost: CATEGORY_RESET_COST.toLocaleString() })",
      );
      return s;
    },
  },
  {
    file: 'components/PurchaseQuantityModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N_CFG);
      s = s.replace(
        `function typeLabelKo(it: InventoryItem): string {
    if (it.type === 'equipment') return t('purchase.equipment');
    if (it.type === 'consumable') return t('purchase.consumable');
    return t('purchase.material');
}`,
        `function typeLabelKo(it: InventoryItem): string {
    if (it.type === 'equipment') return invT('purchase.equipment');
    if (it.type === 'consumable') return invT('purchase.consumable');
    return invT('purchase.material');
}`,
      );
      s = s.replace(
        "return lines.length > 0 ? lines : ['이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.'];",
        "return lines.length > 0 ? lines : [invT('purchase.noMaterialUse')];",
      );
      s = s.replace(
        "return [hint ?? '가방에서 사용할 수 있습니다.'];",
        "return [hint ?? invT('encyclopedia.inventoryHint')];",
      );
      s = s.replace(
        "return ['착용·강화·제련 등 캐릭터 성장에 사용합니다.'];",
        "return [invT('purchase.characterGrowth')];",
      );
      if (!s.includes('const invT =')) {
        s = s.replace(
          I18N_CFG.trim(),
          `${I18N_CFG.trim()}\nconst invT = (key: string, opts?: Record<string, unknown>) => i18n.t(\`inventory:\${key}\`, opts);\n`,
        );
      }
      s = ensureHook(s, 'const PurchaseQuantityModal', "    const { t } = useTranslation('inventory');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('>설명<', ">{t('description', { ns: 'common' })}<");
      s = s.replace('>사용처<', ">{t('usageLabel', { ns: 'common' })}<");
      s = s.replace('>획득처<', ">{t('obtainLabel', { ns: 'common' })}<");
      s = s.replace('title="수량 선택"', "title={t('purchase.selectQuantity')}");
      s = s.replace('>구매<', ">{t('purchase', { ns: 'common' })}<");
      s = s.replace("isConfirming ? '구매 중...' : '구매'", "isConfirming ? t('purchasing', { ns: 'common' }) : t('purchase', { ns: 'common' })");
      s = s.replace(
        "setNoticeMessage('가방 공간이 부족합니다. 가방을 정리한 뒤 다시 구매해 주세요.');",
        "setNoticeMessage(t('purchase.bagFull'));",
      );
      s = s.replace(
        'setNoticeMessage(`가방 공간이 부족합니다. 현재 ${maxByInventory}개까지만 구매할 수 있습니다.`);',
        "setNoticeMessage(t('purchase.bagFullPartial', { max: maxByInventory }));",
      );
      s = s.replace('aria-label="구매 상품 상세"', "aria-label={t('purchase.productDetailAria')}");
      s = s.replace('aria-label="한 개 줄이기"', "aria-label={t('purchase.decreaseAria')}");
      s = s.replace('aria-label="한 개 늘리기"', "aria-label={t('purchase.increaseAria')}");
      s = s.replace(
        '<p className="leading-snug text-rose-300/95">보유 개수가 최대치여서 구매할 수 없습니다.</p>',
        '<p className="leading-snug text-rose-300/95">{t(\'purchase.maxOwnedBuy\')}</p>',
      );
      s = s.replace(
        '<p className="leading-snug text-rose-300/95">오늘 구매 한도에 도달했습니다.</p>',
        '<p className="leading-snug text-rose-300/95">{t(\'purchase.dailyLimitReached\')}</p>',
      );
      s = s.replace(
        '<p className="leading-snug text-slate-400">최대 구매 가능: {maxQuantity}개</p>',
        '<p className="leading-snug text-slate-400">{t(\'purchase.maxPurchase\', { count: maxQuantity })}</p>',
      );
      s = s.replace(
        '<p className="leading-snug">일일 남은 구매 가능: {remainingDaily}개</p>',
        '<p className="leading-snug">{t(\'purchase.dailyRemaining\', { count: remainingDaily })}</p>',
      );
      s = s.replace(
        '일일 남은 구매 가능: 0개',
        "{t('purchase.dailyRemaining', { count: 0 })}",
      );
      s = s.replace('>취소<', ">{tCommon('actions.cancel')}<");
      return s;
    },
  },
  {
    file: 'components/SellMaterialBulkModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        `<p className="text-center text-xs font-bold tracking-wide text-cyan-200/85 sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.2em] sm:text-cyan-200/60">
                        일괄 판매
                    </p>`,
        `<p className="text-center text-xs font-bold tracking-wide text-cyan-200/85 sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.2em] sm:text-cyan-200/60">
                        {t('sellBulk.bulkSellTitle')}
                    </p>`,
      );
      s = s.replace(
        `<h3 className="mt-1 text-center text-xl font-black leading-snug tracking-tight text-slate-50 sm:mt-1 sm:text-lg">
                        판매할 수량을 정하세요
                    </h3>`,
        `<h3 className="mt-1 text-center text-xl font-black leading-snug tracking-tight text-slate-50 sm:mt-1 sm:text-lg">
                        {t('sellBulk.pickAmount')}
                    </h3>`,
      );
      s = s.replace(
        `{label} · 합계{' '}
                        <span className="font-semibold text-slate-100">{totalQuantity.toLocaleString()}</span>개 보유`,
        "{t('sellBulk.ownedTotalLine', { label, count: totalQuantity.toLocaleString() })}",
      );
      s = s.replace(
        '<span className="text-sm font-semibold text-slate-300 sm:text-slate-400">개당 판매가</span>',
        '<span className="text-sm font-semibold text-slate-300 sm:text-slate-400">{t(\'sellBulk.unitPriceLabel\')}</span>',
      );
      s = s.replace('>취소<', ">{t('actions.cancel', { ns: 'common' })}<");
      s = s.replace(
        '{quantity.toLocaleString()}개 판매',
        "{t('sellBulk.sellCount', { count: quantity })}",
      );
      return s;
    },
  },
  {
    file: 'components/TierInfoModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const TierInfoModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace(
        `    const tierRequirements: Record<string, string> = {
        '챌린저': '최소 점수 3500 이상 & 상위 100명 한정',
        '마스터': '최소 점수 3000 이상',
        '다이아': '최소 점수 2400 이상',
        '플래티넘': '최소 점수 2000 이상',
        '골드': '최소 점수 1700 이상',
        '실버': '최소 점수 1500 이상',
        '브론즈': '최소 점수 1400 이상',
        '루키': '최소 점수 1300 이상',
        '새싹': '1300 미만 또는 랭킹 대국 50판 미만',
    };`,
        `    const tierKeyByName: Record<string, string> = {
        '챌린저': 'champion',
        '마스터': 'master',
        '다이아': 'diamond',
        '플래티넘': 'platinum',
        '골드': 'gold',
        '실버': 'silver',
        '브론즈': 'bronze',
        '루키': 'iron',
        '새싹': 'unranked',
    };
    const tierRequirement = (name: string) => {
        const key = tierKeyByName[name];
        return key ? t(\`tierInfo.\${key}\`) : 'N/A';
    };`,
      );
      s = s.replace(
        'if (!reward) return <span className="text-gray-500">보상 정보 없음</span>;',
        "if (!reward) return <span className=\"text-gray-500\">{t('tierInfo.noReward')}</span>;",
      );
      s = s.replace('title="시즌 랭킹 티어 안내"', "title={t('tierInfo.title')}");
      s = s.replace(
        '각 게임 모드의 랭킹 점수에 따라 시즌 티어가 결정됩니다. 티어는 시즌 종료 시 랭킹 순위에 따라 확정되며, 보상이 지급됩니다.',
        "{t('tierInfo.intro')}",
      );
      s = s.replace('>시즌 일정<', ">{t('tierInfo.scheduleTitle')}<");
      s = s.replace('<li><span className="font-semibold">시즌 1:</span> 1월 1일 ~ 3월 31일</li>', '<li>{t(\'tierInfo.season1\')}</li>');
      s = s.replace('<li><span className="font-semibold">시즌 2:</span> 4월 1일 ~ 6월 30일</li>', '<li>{t(\'tierInfo.season2\')}</li>');
      s = s.replace('<li><span className="font-semibold">시즌 3:</span> 7월 1일 ~ 9월 30일</li>', '<li>{t(\'tierInfo.season3\')}</li>');
      s = s.replace('<li><span className="font-semibold">시즌 4:</span> 10월 1일 ~ 12월 31일</li>', '<li>{t(\'tierInfo.season4\')}</li>');
      s = s.replace(
        '각 시즌 종료 시 랭킹이 초기화되고 보상이 지급됩니다.',
        "{t('tierInfo.seasonResetDesc')}",
      );
      s = s.replace(
        '{tierRequirements[tier.name] || \'N/A\'}',
        '{tierRequirement(tier.name)}',
      );
      s = s.replace('>시즌 종료 보상<', ">{t('tierInfo.endReward')}<");
      return s;
    },
  },
  {
    file: 'components/LeagueTierInfoModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const LeagueTierInfoModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace(
        'return start === end ? `${start}위` : `${start}-${end}위`;',
        "return start === end ? t('leagueTier.rankPlace', { rank: start }) : t('leagueTier.rankRange', { start, end });",
      );
      s = s.replace(
        "return '잔류';",
        "return t('leagueTier.stay');",
      );
      s = s.replace("return '승급';", "return t('leagueTier.promote');");
      s = s.replace("return '강등';", "return t('leagueTier.demote');");
      s = s.replace("outcomeText = '잔류';", "outcomeText = t('leagueTier.stay');");
      s = s.replace("outcomeText = '승급';", "outcomeText = t('leagueTier.promote');");
      s = s.replace("outcomeText = '강등';", "outcomeText = t('leagueTier.demote');");
      s = s.replace('alt="다이아"', "alt={t('leagueTier.diamondsAlt')}");
      s = s.replace('title="랭킹전 리그 안내"', "title={t('leagueTier.titleRanking')}");
      s = s.replace(
        '전략바둑 랭킹전 PVP에서 얻는 점수에 따라 티어가 결정됩니다. 주간 종료 시 순위에 따라 승급·잔류·강등이 적용되며, 티어별 보상을 받을 수 있습니다.',
        "{t('leagueTier.intro')}",
      );
      s = s.replace(
        '순위 경쟁 기반 티어 (승급·유지·강등 조건은 아래 보상표 참고)',
        "{t('leagueTier.rankHint')}",
      );
      s = s.replace('>주간 보상<', ">{t('leagueTier.weeklyReward')}<");
      s = s.replace(
        '? `${rewardTier.rankStart}위`',
        "? t('leagueTier.rankPlace', { rank: rewardTier.rankStart })",
      );
      s = s.replace(
        ': `${rewardTier.rankStart}-${rewardTier.rankEnd}위`;',
        ": t('leagueTier.rankRange', { start: rewardTier.rankStart, end: rewardTier.rankEnd });",
      );
      return s;
    },
  },
  {
    file: 'components/SimulationArenaHelpModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const SimulationArenaHelpModal', "    const { t } = useTranslation('tournament');\n");
      s = s.replace('title="시뮬레이션 경기장 도움말"', "title={t('championship.simulationHelp.title')}");
      s = s.replace('alt="시뮬레이션 경기"', "alt={t('championship.simulationHelp.altSimulation')}");
      s = s.replace('>시뮬레이션 경기 개요<', ">{t('championship.simulationHelp.overview')}<");
      s = s.replace(
        `플레이어의 능력치와 컨디션을 기반으로 자동 진행되는 경기입니다. 
                                경기는 50초 동안 진행되며, 초반/중반/종반으로 나뉩니다.`,
        "{t('championship.simulationHelp.overviewBody')}",
      );
      s = s.replace('alt="골드"', "alt={t('championship.simulationHelp.altGold')}");
      s = s.replace('alt="재료"', "alt={t('championship.simulationHelp.altMaterial')}");
      s = s.replace('alt="장비상자"', "alt={t('championship.simulationHelp.altEquipmentBox')}");
      s = s.replace('>보상 안내<', ">{t('championship.simulationHelp.rewardGuide')}<");
      s = s.replace('<strong>동네바둑리그:</strong> 골드 획득', '<li>{t(\'championship.simulationHelp.rewardNeighborhood\')}</li>').replace('<li><li>', '<li>');
      s = s.replace('<li><strong>동네바둑리그:</strong> 골드 획득</li>', '<li>{t(\'championship.simulationHelp.rewardNeighborhood\')}</li>');
      s = s.replace('<li><strong>전국바둑대회:</strong> 재료(강화석) 획득</li>', '<li>{t(\'championship.simulationHelp.rewardNational\')}</li>');
      s = s.replace('<li><strong>월드챔피언십:</strong> 장비 상자 획득</li>', '<li>{t(\'championship.simulationHelp.rewardWorld\')}</li>');
      s = s.replace('<span className="text-2xl font-bold text-white">50초</span>', '<span className="text-2xl font-bold text-white">{t(\'championship.simulationHelp.fiftySeconds\')}</span>');
      s = s.replace('>경기 진행 방식<', ">{t('championship.simulationHelp.progress')}<");
      s = s.replace('<li>초반(1-15초): 초반 능력치 중요</li>', '<li>{t(\'championship.simulationHelp.progressOpening\')}</li>');
      s = s.replace('<li>중반(16-35초): 중반 능력치 중요</li>', '<li>{t(\'championship.simulationHelp.progressMidgame\')}</li>');
      s = s.replace('<li>종반(36-50초): 종반 능력치 중요</li>', '<li>{t(\'championship.simulationHelp.progressEndgame\')}</li>');
      s = s.replace('<li>각 단계마다 해당 능력치에 따라 점수 누적</li>', '<li>{t(\'championship.simulationHelp.progressScoring\')}</li>');
      s = s.replace('>초반<', ">{t('championship.simulationHelp.opening')}<");
      s = s.replace('>중반<', ">{t('championship.simulationHelp.midgame')}<");
      s = s.replace('>종반<', ">{t('championship.simulationHelp.endgame')}<");
      s = s.replace('>능력치 계산<', ">{t('championship.simulationHelp.abilityCalc')}<");
      s = s.replace(
        '<strong>초반:</strong> 집중력×0.4 + 사고속도×0.3 + 판단력×0.4 + 계산력×0.3 + 전투력×0.1 + 안정감×0.5',
        '{t(\'championship.simulationHelp.openingFormula\')}',
      );
      s = s.replace(
        '<strong>중반:</strong> 집중력×0.3 + 사고속도×0.3 + 판단력×0.4 + 계산력×0.1 + 전투력×0.8 + 안정감×0.1',
        '{t(\'championship.simulationHelp.midgameFormula\')}',
      );
      s = s.replace(
        '<strong>종반:</strong> 집중력×0.3 + 사고속도×0.4 + 판단력×0.1 + 계산력×0.6 + 전투력×0.1 + 안정감×0.5',
        '{t(\'championship.simulationHelp.endgameFormula\')}',
      );
      s = s.replace('>랜덤 이벤트<', ">{t('championship.simulationHelp.randomEvent')}<");
      s = s.replace('<li>5초마다 30% 확률로 발생</li>', '<li>{t(\'championship.simulationHelp.randomEvent1\')}</li>');
      s = s.replace('<li>4가지 종류: 집중력 감소(부정), 사고속도 증가(긍정), 전투력 증가(긍정), 안정감 증가(긍정)</li>', '<li>{t(\'championship.simulationHelp.randomEvent2\')}</li>');
      s = s.replace('<li>능력치가 높을수록 긍정 이벤트 확률 증가</li>', '<li>{t(\'championship.simulationHelp.randomEvent3\')}</li>');
      s = s.replace('<li>현재 총 점수의 2~10%만큼 점수 변화</li>', '<li>{t(\'championship.simulationHelp.randomEvent4\')}</li>');
      s = s.replace('>치명타<', ">{t('championship.simulationHelp.critical')}<");
      s = s.replace('<li>판단력이 치명타 발생 확률에 영향</li>', '<li>{t(\'championship.simulationHelp.critical1\')}</li>');
      s = s.replace('<li>치명타 발생 시 추가 점수 획득</li>', '<li>{t(\'championship.simulationHelp.critical2\')}</li>');
      s = s.replace('<li>전투력과 계산력이 추가 점수에 영향</li>', '<li>{t(\'championship.simulationHelp.critical3\')}</li>');
      s = s.replace('alt="컨디션"', "alt={t('championship.simulationHelp.altCondition')}");
      s = s.replace('>컨디션<', ">{t('championship.simulationHelp.conditionTitle')}<");
      s = s.replace('<li>각 경기 전에 40~100 사이의 랜덤 컨디션 부여</li>', '<li>{t(\'championship.simulationHelp.condition1\')}</li>');
      s = s.replace('<li>시뮬레이션 진행 중에는 능력치 수치가 바뀌지 않습니다</li>', '<li>{t(\'championship.simulationHelp.condition2\')}</li>');
      s = s.replace('<li>컨디션 회복제로 회복 가능 (경기 시작 전에만 사용)</li>', '<li>{t(\'championship.simulationHelp.condition3\')}</li>');
      return s;
    },
  },
  {
    file: 'components/RPSMinigame.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N_CFG);
      if (!s.includes('const gameT =')) {
        s = s.replace(
          I18N_CFG.trim(),
          `${I18N_CFG.trim()}\nconst gameT = (key: string, opts?: Record<string, unknown>) => i18n.t(\`game:\${key}\`, opts);\n`,
        );
      }
      s = s.replace(
        `const choiceDisplay = {
    rock: { emoji: '✊', name: '바위' },
    paper: { emoji: '🖐️', name: '보' },
    scissors: { emoji: '✌️', name: '가위' },
};`,
        `const choiceDisplay = {
    rock: { emoji: '✊', name: gameT('rps.rock') },
    paper: { emoji: '🖐️', name: gameT('rps.paper') },
    scissors: { emoji: '✌️', name: gameT('rps.scissors') },
};`,
      );
      s = ensureHook(s, 'const RPSMinigame', "    const { t } = useTranslation('game');\n");
      s = s.replace("case GameMode.Thief: return '역할이 겹쳤습니다! 이긴 사람이 역할을 가져갑니다.';", "case GameMode.Thief: return t('rps.thiefOverlap');");
      s = s.replace("return '순서가 겹쳤습니다! 이긴 사람이 원하는 순서를 가져갑니다.';", "return t('rps.turnOverlap');");
      s = s.replace("default: return '먼저 주사위를 굴릴 플레이어를 정합니다.';", "default: return t('rps.diceDefault');");
      s = s.replace('return `가위바위보 ${roundText}`;', "return t('rps.rpsRound', { round: roundText });");
      s = s.replace("resultText = (rpsRound || 1) >= 3 ? '무승부! 랜덤으로 결정됩니다...' : '무승부! 다시 한번!';", "resultText = (rpsRound || 1) >= 3 ? t('rps.tieRandom') : t('rps.tieAgain');");
      s = s.replace("let winMsg = '승리!';", "let winMsg = t('rps.win');");
      s = s.replace("if(mode === GameMode.Dice) winMsg = '승리! 선공입니다.';", "if(mode === GameMode.Dice) winMsg = t('rps.winFirst');");
      s = s.replace("if(mode === GameMode.Thief) winMsg = '승리! 원하는 역할을 가져갑니다.';", "if(mode === GameMode.Thief) winMsg = t('rps.winRole');");
      s = s.replace("winMsg = `승리! ${myTurnChoice === 'first' ? '선공' : '후공'}으로 시작합니다.`;", "winMsg = t('rps.winStart', { choice: myTurnChoice === 'first' ? t('rps.firstShort') : t('rps.secondShort') });");
      s = s.replace("let loseMsg = '패배!';", "let loseMsg = t('rps.lose');");
      s = s.replace("if(mode === GameMode.Dice) loseMsg = '패배! 후공입니다.';", "if(mode === GameMode.Dice) loseMsg = t('rps.loseSecond');");
      s = s.replace("if(mode === GameMode.Thief) loseMsg = '패배! 상대방이 역할을 선택합니다.';", "if(mode === GameMode.Thief) loseMsg = t('rps.loseRole');");
      s = s.replace("loseMsg = `패배! 상대가 ${opponentTurnChoice === 'first' ? '선공' : '후공'}으로 시작합니다.`;", "loseMsg = t('rps.loseStart', { choice: opponentTurnChoice === 'first' ? t('rps.firstShort') : t('rps.secondShort') });");
      s = s.replace('>선택 완료!<', ">{t('rps.choiceDone')}<");
      s = s.replace('{opponent.nickname}님의 선택을 기다리고 있습니다...', "{t('rps.waitingChoice', { name: opponent.nickname })}");
      s = s.replace('>이번에도 비기면 랜덤으로 결정됩니다!<', ">{t('rps.tieWarning')}<");
      return s;
    },
  },
  {
    file: 'components/MbtiInfoModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const MbtiInfoModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace("alert('모든 문항에 답해 주세요.');", "alert(t('mbtiInfo.answerAll'));");
      s = s.replace('title="MBTI 성향 안내"', "title={t('mbtiInfo.title')}");
      s = s.replace('>MBTI란 무엇인가요?<', ">{t('mbtiInfo.whatIsMbti')}<");
      s = s.replace('>완료 시 100 다이아몬드를 드립니다!<', ">{t('mbtiInfo.completeReward')}<");
      s = s.replace("{currentQuestionIndex < MBTI_QUESTIONS.length - 1 ? '다음' : '완료'}", "{currentQuestionIndex < MBTI_QUESTIONS.length - 1 ? t('mbtiInfo.next') : t('mbtiInfo.complete')}");
      s = s.replace('>100 다이아몬드 획득!<', ">{t('mbtiInfo.rewardObtained')}<");
      return s;
    },
  },
  {
    file: 'components/MannerRankModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const MannerRankModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace('title="매너 등급 정보"', "title={t('mannerRank.title')}");
      s = s.replace('>매너 등급<', ">{t('mannerRank.grade')}<");
      s = s.replace('>점수 구간별로 적용되는 혜택·페널티입니다.<', ">{t('mannerRank.rangeHint')}<");
      return s;
    },
  },
  {
    file: 'components/MannerGradeChangeModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const MannerGradeChangeModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace(
        "? '바른 매너를 유지하면 혜택이 늘어납니다. 계속 좋은 대국 부탁드립니다.'",
        "? t('mannerGradeChange.upHint')",
      );
      s = s.replace(
        ": '매너 점수가 낮아지면 보상·능력치에 불리할 수 있습니다. 건전한 플레이를 권장합니다.'}",
        ": t('mannerGradeChange.downHint')}",
      );
      return s;
    },
  },
  {
    file: 'components/AppModalLayer.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const AppModalLayer', "    const { t } = useTranslation('common');\n");
      s = s.replace(
        '<span className="block">다른 곳에서 로그인 되었습니다.</span>',
        '<span className="block">{t(\'disconnectNotice.otherLogin\')}</span>',
      );
      return s;
    },
  },
];

export function runPass4Migrations() {
  const ko = readJson('shared/i18n/catalog/ko.json');
  const en = readJson('shared/i18n/catalog/en.json');
  extendCatalogPass4(ko, en);
  writeJson('shared/i18n/catalog/ko.json', ko);
  writeJson('shared/i18n/catalog/en.json', en);

  let modified = 0;
  for (const { file, fn } of migrations) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      console.warn('Pass4 missing:', file);
      continue;
    }
    const before = read(file);
    const after = fn(before);
    if (after !== before) {
      write(file, after);
      modified++;
      console.log('Pass4:', file);
    }
  }
  console.log(`Pass4 done: ${modified} files modified.`);
  return modified;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runPass4Migrations();
}
