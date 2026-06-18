/**
 * Pass 6: final target-batch UI Korean migration.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(root, f), c, 'utf8');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, obj) => fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');

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
const LC = "import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';\n";
const LC_BS = "import { useLocalizedItemGrade } from '../../shared/i18n/localizedCatalog.js';\n";
const I18N_CFG = "import i18n from '../shared/i18n/config.js';\n";

export function extendCatalogPass6(ko, en) {
  Object.assign(ko.profile.mannerRank, {
    mannerPointsTitle: '{{score}}점 ({{rank}})',
  });
  Object.assign(en.profile.mannerRank, {
    mannerPointsTitle: '{{score}} pts ({{rank}})',
  });
  Object.assign(ko.profile.homeBoard, {
    homeBoardTitle: '홈 게시판',
    newPostBadge: '새 글',
    editedAt: '(수정됨: {{date}})',
  });
  Object.assign(en.profile.homeBoard, {
    homeBoardTitle: 'Home board',
    newPostBadge: 'New',
    editedAt: '(Edited: {{date}})',
  });
  Object.assign(ko.profile.mannerGradeChange, {
    pointsSuffix: '점',
  });
  Object.assign(en.profile.mannerGradeChange, {
    pointsSuffix: ' pts',
  });
  Object.assign(ko.inventory.equipmentEffects, {
    summaryAtGlance: '한눈에',
    mythicTab: '스페셜',
    equippedTotal: '장착 합산',
    equippedTitle: '장비 장착 효과',
  });
  Object.assign(en.inventory.equipmentEffects, {
    summaryAtGlance: 'Overview',
    mythicTab: 'Special',
    equippedTotal: 'Equipped total',
    equippedTitle: 'Equipped gear effects',
  });
  Object.assign(ko.inventory.purchase, {
    gradeDivider: '등급 · {{grade}}',
    totalLabel: '합계',
    checkoutAmount: '결제 예정 금액',
  });
  Object.assign(en.inventory.purchase, {
    gradeDivider: 'Grade · {{grade}}',
    totalLabel: 'Total',
    checkoutAmount: 'Checkout amount',
  });
  Object.assign(ko.profile.equipmentDetail, {
    typeConsumable: '소모품',
    typeMaterial: '재료',
    bound: '귀속',
    tradable: '거래가능',
  });
  Object.assign(en.profile.equipmentDetail, {
    typeConsumable: 'Consumable',
    typeMaterial: 'Material',
    bound: 'Bound',
    tradable: 'Tradable',
  });
  Object.assign(ko.game.diceTurn, {
    intro: '준비 버튼을 눌러 주사위를 굴립니다. 높은 숫자가 나온 사람이 선공/후공을 선택합니다.',
    tieReroll: '동점! 잠시 후 다시 굴립니다.',
    pickTurn: '선공 또는 후공을 선택하세요. ({{countdown}})',
    firstBlackBtn: '선공 (흑)',
    secondWhiteBtn: '후공 (백)',
    waitingOpponentPick: '상대방이 선/후공을 선택하고 있습니다...',
    readyBtn: '준비 ({{countdown}})',
    waitingOpponent: '상대방 대기 중...',
    rolling: '주사위를 굴립니다...',
  });
  Object.assign(en.game.diceTurn, {
    intro: 'Press Ready to roll. Higher roll picks first or second.',
    tieReroll: 'Tie! Rolling again shortly.',
    pickTurn: 'Pick first or second. ({{countdown}})',
    firstBlackBtn: 'First (Black)',
    secondWhiteBtn: 'Second (White)',
    waitingOpponentPick: 'Waiting for opponent to pick…',
    readyBtn: 'Ready ({{countdown}})',
    waitingOpponent: 'Waiting for opponent…',
    rolling: 'Rolling dice…',
  });
  Object.assign(ko.game.diceGo, {
    resultRich: '주사위 결과 <strong>{{name}}</strong>님이 승리하여 선/후공이 결정되었습니다.',
    startCountdownBtn: '대국 시작 ({{countdown}})',
    waitingConfirmShort: '상대방 확인 대기 중…',
  });
  Object.assign(en.game.diceGo, {
    resultRich: 'Dice: <strong>{{name}}</strong> won and picks turn order.',
    startCountdownBtn: 'Start ({{countdown}})',
    waitingConfirmShort: 'Waiting for opponent…',
  });
  Object.assign(ko.game.roundSummary, {
    playerFallback: '플레이어',
    waitingOpponentConfirm: '상대 확인 대기',
  });
  Object.assign(en.game.roundSummary, {
    playerFallback: 'Player',
    waitingOpponentConfirm: 'Waiting for confirm',
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
  Object.assign(ko.game.captureTiebreaker, {
    meBadge: '나',
  });
  Object.assign(en.game.captureTiebreaker, {
    meBadge: 'Me',
  });
  Object.assign(ko.inventory.leagueTier, {
    stayLine: '잔류: {{ranges}}',
    demoteLine: '강등: {{ranges}}',
    rankHintShort: '순위 경쟁 기반 티어 (승급·잔류·강등 조건은 아래 보상표 참고)',
  });
  Object.assign(en.inventory.leagueTier, {
    stayLine: 'Stay: {{ranges}}',
    demoteLine: 'Demote: {{ranges}}',
    rankHintShort: 'Rank-based tiers (see rewards for promote/stay/demote rules)',
  });
  Object.assign(ko.tournament.championship.venue, {
    continueViewAlt: '이어서 보기',
  });
  Object.assign(en.tournament.championship.venue, {
    continueViewAlt: 'Continue',
  });
  Object.assign(ko.blacksmith.convert, {
    processing: '처리 중...',
    yieldSingle: '{{count}}개',
    yieldRange: '{{min}}~{{max}}개',
  });
  Object.assign(en.blacksmith.convert, {
    processing: 'Processing…',
    yieldSingle: '{{count}}',
    yieldRange: '{{min}}–{{max}}',
  });
  Object.assign(ko.blacksmith.combinationResult, {
    refinementTimes: '{{count}}회',
  });
  Object.assign(en.blacksmith.combinationResult, {
    refinementTimes: '{{count}}×',
  });
}

/** @type {Array<{file:string, fn:(c:string)=>string, skip?:boolean}>} */
const migrations = [
  {
    file: 'components/MbtiInfoModal.tsx',
    fn: (c) => {
      let s = c.replace(
        /const MBTI_DESCRIPTIONS: Record<string, string> = \{[\s\S]*?\};\n/,
        "const MBTI_TYPES = ['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ'] as const;\n",
      );
      s = s.replace(
        '{Object.entries(MBTI_DESCRIPTIONS).map(([type, description]) => (',
        '{MBTI_TYPES.map((type) => (',
      );
      s = s.replace(
        '<span className="text-sm text-gray-300">{description}</span>',
        '<span className="text-sm text-gray-300">{t(`mbtiInfo.${type.toLowerCase()}Desc`)}</span>',
      );
      s = s.replace('>다시 설정하기<', ">{t('mbtiInfo.setupAgain')}<");
      return s;
    },
  },
  {
    file: 'components/Button.tsx',
    fn: (c) => c.replace("// 'none'은 className으로", '// none scheme: className'),
  },
  {
    file: 'components/blacksmith/CombinationResultModal.tsx',
    fn: (c) => c.replace(
      "t('combinationResult.refinementCount', { value: `${(item as any).refinementCount}회` })",
      "t('combinationResult.refinementCount', { value: t('combinationResult.refinementTimes', { count: (item as any).refinementCount }) })",
    ),
  },
  {
    file: 'components/blacksmith/ConversionView.tsx',
    fn: (c) => {
      let s = ensureHook(c, 'const ConversionView', "    const { t } = useTranslation('blacksmith');\n");
      s = s.replace(
        "? `${(quantity * yieldMin).toLocaleString()}개`",
        "? t('convert.yieldSingle', { count: (quantity * yieldMin).toLocaleString() })",
      );
      s = s.replace(
        ": `${(quantity * yieldMin).toLocaleString()}~${(quantity * yieldMax).toLocaleString()}개`",
        ": t('convert.yieldRange', { min: (quantity * yieldMin).toLocaleString(), max: (quantity * yieldMax).toLocaleString() })",
      );
      s = s.replace("{isBlacksmithBusy ? '처리 중...' :", "{isBlacksmithBusy ? t('convert.processing') :");
      return s;
    },
  },
  {
    file: 'components/modals/PastRankingsModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const PastRankingsModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace('title="지난 시즌 랭킹"', "title={t('pastRankings.title')}");
      s = s.replace('>지난 시즌 랭킹 정보 없음<', ">{t('pastRankings.empty')}<");
      return s;
    },
  },
  {
    file: 'components/championship/ChampionshipArenaScorePanels.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'export const ChampionshipArenaScorePanels', "    const { t } = useTranslation('tournament');\n");
      if (!s.includes("useTranslation('tournament')")) {
        s = ensureHook(s, 'const ChampionshipArenaScorePanels', "    const { t } = useTranslation('tournament');\n");
      }
      s = s.replace('>점수<', ">{t('championship.score')}<");
      s = s.replace('>시간보너스<', ">{t('championship.timeBonus')}<");
      return s;
    },
  },
  {
    file: 'components/championship/ChampionshipShopPanel.tsx',
    fn: (c) => {
      let s = c;
      if (!s.includes("useTranslation('tournament')")) {
        s = ensureImport(s, I18N);
        s = ensureHook(s, 'const ChampionshipShopPanel', "    const { t } = useTranslation('tournament');\n");
      }
      s = s.replace(
        "? `주간 잔여 구매 0/${limit}회 (이번 주 한도 소진)`",
        "? t('championship.shop.weeklyLimitUsed', { limit })",
      );
      s = s.replace(
        /`주간 잔여 구매 \$\{remaining\}\/\$\{limit\}회 \(이번 주 \$\{used\}회 구매\)`/,
        "t('championship.shop.weeklyLimit', { remaining, limit, used })",
      );
      return s;
    },
  },
  {
    file: 'components/MannerGradeChangeModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const MannerGradeChangeModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace(
        '{payload.previousScore.toLocaleString()}점',
        "{payload.previousScore.toLocaleString()}{t('mannerGradeChange.pointsSuffix')}",
      );
      s = s.replace(
        '{payload.newScore.toLocaleString()}점',
        "{payload.newScore.toLocaleString()}{t('mannerGradeChange.pointsSuffix')}",
      );
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
    file: 'components/MannerRankModal.tsx',
    fn: (c) => c.replace(
      'title={`${totalMannerScore}점 (${mannerRank.rank})`}',
      "title={t('mannerRank.mannerPointsTitle', { score: totalMannerScore, rank: mannerRank.rank })}",
    ),
  },
  {
    file: 'components/HomeBoardPanel.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const HomeBoardPanel', "    const { t } = useTranslation('profile');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace("window.alert('제목과 내용을 입력해주세요.');", "window.alert(t('homeBoard.enterTitleContent'));");
      s = s.replace("window.confirm('이 게시글을 삭제하시겠습니까?')", "window.confirm(t('homeBoard.deleteConfirm'))");
      s = s.replace('aria-label="새 글"', "aria-label={t('homeBoard.newPostBadge')}");
      s = s.replace("{modalMode ? '공지 게시판' : '홈 게시판'}", "{modalMode ? t('homeBoard.noticeBoard') : t('homeBoard.homeBoardTitle')}");
      s = s.replace('aria-label="공지 게시판 닫기"', "aria-label={t('homeBoard.closeNotice')}");
      s = s.replace("renderPostList(noticePosts, '공지사항이 없습니다.')", "renderPostList(noticePosts, t('homeBoard.noNotices'))");
      s = s.replace("renderPostList(patchPosts, '패치/업데이트 내역이 없습니다.')", "renderPostList(patchPosts, t('homeBoard.noPatches'))");
      s = s.replace(
        '<span className="ml-2">(수정됨: {formatDateTime(selectedPost.updatedAt)})</span>',
        '<span className="ml-2">{t(\'homeBoard.editedAt\', { date: formatDateTime(selectedPost.updatedAt) })}</span>',
      );
      return s;
    },
  },
  {
    file: 'components/EquipmentEffectsModal.tsx',
    fn: (c) => {
      let s = c.replace(
        /const TAB_LABEL: Record<TabId, string> = \{[\s\S]*?\};\n\nfunction formatFlatPercent/,
        'function formatFlatPercent',
      );
      if (!s.includes("const EquipmentEffectsModal")) return s;
      if (!s.includes('const TAB_LABEL: Record<TabId, string>')) {
        s = s.replace(
          "const { t } = useTranslation('inventory');\n    const { isNativeMobile",
          `const { t } = useTranslation('inventory');
    const TAB_LABEL: Record<TabId, string> = {
        summary: t('equipmentEffects.summaryAtGlance'),
        main: t('equipmentEffects.main'),
        combat: t('equipmentEffects.combat'),
        special: t('equipmentEffects.special'),
        mythic: t('equipmentEffects.mythicTab'),
    };
    const { isNativeMobile`,
        );
      } else {
        s = s.replace(
          '}) => {\n    const { isNativeMobile } = useNativeMobileShell();',
          `}) => {
    const { t } = useTranslation('inventory');
    const TAB_LABEL: Record<TabId, string> = {
        summary: t('equipmentEffects.summaryAtGlance'),
        main: t('equipmentEffects.main'),
        combat: t('equipmentEffects.combat'),
        special: t('equipmentEffects.special'),
        mythic: t('equipmentEffects.mythicTab'),
    };
    const { isNativeMobile } = useNativeMobileShell();`,
        );
      }
      s = s.replace('알 수 없는 스페셜 옵션', "{t('equipmentEffects.unknownMythic')}");
      s = s.replace('>장착 합산<', ">{t('equipmentEffects.equippedTotal')}<");
      s = s.replace('>적용 중인 특수 옵션이 없습니다.<', ">{t('equipmentEffects.noSpecialActive')}<");
      s = s.replace('>적용 중인 스페셜 옵션이 없습니다.<', ">{t('equipmentEffects.noMythicActive')}<");
      s = s.replace('>신화 스페셜 옵션<', ">{t('equipmentEffects.mythicCandidates')}<");
      s = s.replace('>초월 스페셜 옵션<', ">{t('equipmentEffects.transcendentCandidates')}<");
      s = s.replace('title="장비 장착 효과"', "title={t('equipmentEffects.equippedTitle')}");
      return s;
    },
  },
  {
    file: 'components/PurchaseQuantityModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, LC);
      s = ensureHook(s, 'const PurchaseModalItemShowcase', "    const { t } = useTranslation('inventory');\n    const localizedGrade = useLocalizedItemGrade();\n");
      s = s.replace(
        '등급 · <span className={styles.color}>{styles.name}</span>',
        "{t('purchase.gradeDivider', { grade: localizedGrade(preview.grade) })}",
      );
      s = s.replace('>안내 문구가 없습니다.<', ">{t('encyclopedia.noGuide', { ns: 'inventory' })}<");
      s = s.replace('>합계<', ">{t('purchase.totalLabel')}<");
      s = s.replace('>결제 예정 금액<', ">{t('purchase.checkoutAmount')}<");
      return s;
    },
  },
  {
    file: 'components/UseQuantityModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const UseQuantityModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace(
        /합계 <span className="font-semibold text-slate-100">\{totalQuantity\.toLocaleString\(\)\}<\/span>개 보유/,
        "{t('useQuantity.ownedTotal', { count: totalQuantity.toLocaleString() })}",
      );
      return s;
    },
  },
  {
    file: 'components/SellItemConfirmModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const SellItemConfirmModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace('title="아이템 판매"', "title={t('sellConfirm.sellItem')}");
      s = s.replace('>강화 {item.stars}성<', ">{t('sellConfirm.enhanceStars', { stars: item.stars })}<");
      s = s.replace(
        '<span className="font-semibold text-slate-100">{item.quantity.toLocaleString()}</span>개',
        '<span className="font-semibold text-slate-100">{t(\'sellConfirm.ownedQty\', { count: item.quantity.toLocaleString() })}</span>',
      );
      s = s.replace(
        '<span className="font-semibold text-slate-200">{materialQty.toLocaleString()}</span>개',
        '<span className="font-semibold text-slate-200">{t(\'sellConfirm.materialQty\', { count: materialQty.toLocaleString() })}</span>',
      );
      s = s.replace('· 소모품은 일부 판매됩니다.', "{t('sellConfirm.consumablePartial')}");
      s = s.replace("{isDeleteOnly ? '정산 안내' : '받을 골드'}", "{isDeleteOnly ? t('sellConfirm.settlementNotice') : t('sellConfirm.receiveGold')}");
      s = s.replace(
        "{isDeleteOnly ? '골드 0 · 인벤에서만 삭제됩니다.' : '판매 후 지급'}",
        "{isDeleteOnly ? t('sellConfirm.deleteOnlyHint') : t('sellConfirm.afterSell')}",
      );
      return s;
    },
  },
  {
    file: 'components/ItemObtainedModal.tsx',
    fn: (c) => {
      let s = c;
      s = ensureHook(s, 'const ItemObtainedModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace("name=\"골드\"", "name={t('obtained.goldName')}");
      s = s.replace("name=\"다이아몬드\"", "name={t('obtained.diamondsName')}");
      return s;
    },
  },
  {
    file: 'components/BulkItemObtainedModal.tsx',
    fn: (c) => c.replace('>랭킹 점수 변동<', ">{t('bulkObtained.rankScoreDelta')}<"),
  },
  {
    file: 'components/DisassemblyResultModal.tsx',
    fn: (c) => {
      let s = ensureHook(c, 'const DisassemblyResultModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace(
        '모든 재료 획득량이 <span className="font-bold text-amber-200">2배</span>입니다.',
        "{t('disassemblyResult.jackpotAll')}",
      );
      return s;
    },
  },
  {
    file: 'components/LevelUpCelebrationModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const LevelUpCelebrationModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace(
        '한 번에 <span className="font-bold text-amber-100/95">{gain}레벨</span> 상승했습니다.',
        "{t('levelUp.gained', { gain })}",
      );
      return s;
    },
  },
  {
    file: 'components/LeagueTierInfoModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const LeagueTierInfoModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace('parts.push(`잔류: ${rangeTexts.join(\', \')}`);', "parts.push(t('leagueTier.stayLine', { ranges: rangeTexts.join(', ') }));");
      s = s.replace('parts.push(`강등: ${demoteTexts.join(\', \')}`);', "parts.push(t('leagueTier.demoteLine', { ranges: demoteTexts.join(', ') }));");
      s = s.replace(
        '순위 경쟁 기반 티어 (승급·잔류·강등 조건은 아래 보상표 참고)',
        "{t('leagueTier.rankHintShort')}",
      );
      return s;
    },
  },
  {
    file: 'components/ChampionshipVenueEntryModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace("continueLabel = '이어서 보기';", "continueLabel = t('championship.venue.continueViewAlt');");
      s = s.replace('>없음<', ">{t('championship.venue.none')}<");
      return s;
    },
  },
  {
    file: 'components/RankingQuickModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const RankingQuickModal', "    const { t } = useTranslation('tournament');\n");
      s = s.replace(
        "로그인 후 {lobbyType === 'pair' ? '페어바둑' : '전략바둑'} 랭킹을 확인할 수 있습니다.",
        "{t('rankingQuick.loginHint', { lobby: lobbyType === 'pair' ? t('rankingQuick.pairLobby') : t('rankingQuick.strategicLobby') })}",
      );
      s = s.replace('title="스크롤 가이드 보기"', "title={t('rankingQuick.scrollGuide')}");
      s = s.replace('aria-label="스크롤 가이드 보기"', "aria-label={t('rankingQuick.scrollGuideAria')}");
      s = s.replace('>스크롤 가이드<', ">{t('rankingQuick.scrollGuideTitle')}<");
      s = s.replace('aria-label="랭킹 카테고리"', "aria-label={t('rankingQuick.categoryAria')}");
      return s;
    },
  },
  {
    file: 'components/ChatQuickModal.tsx',
    fn: (c) => {
      let s = c.replace(
        /const ChatQuickModal: React\.FC<ChatQuickModalProps> = \(\{\n\s*const \{ t \} = useTranslation\('nav'\);\n/,
        'const ChatQuickModal: React.FC<ChatQuickModalProps> = ({\n',
      );
      s = ensureHook(s, 'const ChatQuickModal', "    const { t } = useTranslation(['nav', 'lobby']);\n");
      s = s.replace('locationPrefix="[홈]"', "locationPrefix={t('locationPrefix.home', { ns: 'lobby' })}");
      return s;
    },
  },
  {
    file: 'components/CaptureTiebreakerModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace("color: '흑' | '백';", "color: 'black' | 'white';");
      s = s.replace("const isBlack = color === '흑';", "const isBlack = color === 'black';");
      s = s.replace('{color}{isBlack ? t(', '{isBlack ? tCommon(\'blackShort\') : tCommon(\'whiteShort\')}{isBlack ? t(');
      s = s.replace('color="흑"', 'color="black"');
      s = s.replace('color="백"', 'color="white"');
      s = s.replace('                                나', "                                {t('captureTiebreaker.meBadge')}");
      return s;
    },
  },
  {
    file: 'components/DiceRoundSummary.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const DiceRoundSummary', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('>굴림 없음<', ">{t('roundSummary.noRolls')}<");
      s = s.replace("let buttonText = '다음 라운드 시작';", "let buttonText = tCommon('nextRound');");
      s = s.replace("buttonText = '데스매치 시작';", "buttonText = t('roundSummary.deathmatchStart');");
      s = s.replace("buttonText = '최종 결과 보기';", "buttonText = t('roundSummary.viewFinal');");
      s = s.replace("buttonText = '상대 확인 대기';", "buttonText = t('roundSummary.waitingOpponentConfirm');");
      s = s.replace("? '데스매치 자동 시작까지'", "? tCommon('deathmatchAuto')");
      s = s.replace(": '최종 결과 자동 표시까지'", ": tCommon('finalResultAuto')");
      s = s.replace(": '다음 라운드 자동 시작까지';", ": tCommon('nextRoundAuto');");
      s = s.replace("? (isTie ? '데스매치까지' : '결과까지')", "? (isTie ? tCommon('deathmatchShort') : tCommon('finalResultShort'))");
      s = s.replace(": '다음까지';", ": tCommon('nextRoundShort');");
      s = s.replace(
        'title={`${round}라운드 집계`}',
        "title={t('roundSummary.diceTitle', { round })}",
      );
      s = s.replace("?? '플레이어'", "?? t('roundSummary.playerFallback')");
      return s;
    },
  },
  {
    file: 'components/TowerItemShopModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const TowerItemShopModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('aria-label="도전의 탑 아이템 구매 닫기"', "aria-label={t('towerShop.closeAria')}");
      s = s.replaceAll('alt="골드"', "alt={tCommon('gold')}");
      s = s.replaceAll('alt="다이아"', "alt={tCommon('diamonds')}");
      s = s.replace('>수량 선택<', ">{t('towerShop.selectQty')}<");
      s = s.replace("atMaxOwned ? '보유 한도 도달' : '일일 구매 한도 도달'", "atMaxOwned ? t('towerShop.ownedLimit') : t('towerShop.dailyLimit')");
      s = s.replace('>보유 제한:<', ">{t('towerShop.ownedCap')}<");
      s = s.replace('>구매 제한:<', ">{t('towerShop.purchaseCap')}<");
      s = s.replace('>수량 선택:<', ">{t('towerShop.selectQty')}:<");
      s = s.replace('>보유 개수가 최대치여서 구매할 수 없습니다.<', ">{t('towerShop.maxOwnedBuy')}<");
      s = s.replace('>오늘 구매 한도에 도달했습니다.<', ">{t('towerShop.dailyLimitReached')}<");
      s = s.replace('>총 가격<', ">{t('towerShop.totalPrice')}<");
      return s;
    },
  },
  {
    file: 'components/DiceGoTurnSelectionModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const DiceGoTurnSelectionModal', "    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n");
      s = s.replace('title="선공/후공 결정"', "title={t('diceTurn.title')}");
      s = s.replace(
        '준비 버튼을 눌러 주사위를 굴립니다. 높은 숫자가 나온 사람이 선공/후공을 선택합니다.',
        "{t('diceTurn.intro')}",
      );
      s = s.replace('>동점! 잠시 후 다시 굴립니다.<', ">{t('diceTurn.tieReroll')}<");
      s = s.replace("resultMessage = '승리!';", "resultMessage = t('diceTurn.win');");
      s = s.replace("resultMessage = '패배!';", "resultMessage = t('diceTurn.lose');");
      s = s.replace("resultMessage = '동점!';", "resultMessage = t('diceTurn.tie');");
      s = s.replace(
        '선공 또는 후공을 선택하세요. ({countdown})',
        "{t('diceTurn.pickTurn', { countdown })}",
      );
      s = s.replace('>선공 (흑)<', ">{t('diceTurn.firstBlackBtn')}<");
      s = s.replace('>후공 (백)<', ">{t('diceTurn.secondWhiteBtn')}<");
      s = s.replace('>상대방이 선/후공을 선택하고 있습니다...<', ">{t('diceTurn.waitingOpponentPick')}<");
      s = s.replace('>준비 ({countdown})<', ">{t('diceTurn.readyBtn', { countdown })}<");
      s = s.replace('>상대방 대기 중...<', ">{t('diceTurn.waitingOpponent')}<");
      s = s.replace('>주사위를 굴립니다...<', ">{t('diceTurn.rolling')}<");
      return s;
    },
  },
  {
    file: 'components/EquipmentDetailPanel.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureImport(s, LC);
      const gradeBlock = `export const equipmentDetailGradeStyles: Record<ItemGrade, { name: string; color: string; background: string; frame: string }> = {
    normal: { name: '일반', color: 'text-zinc-300', background: '/images/equipments/normalbgi.webp', frame: 'from-zinc-500/15 to-zinc-700/5 ring-zinc-500/25' },
    uncommon: { name: '고급', color: 'text-emerald-400', background: '/images/equipments/uncommonbgi.webp', frame: 'from-emerald-500/20 to-emerald-900/10 ring-emerald-500/30' },
    rare: { name: '희귀', color: 'text-sky-400', background: '/images/equipments/rarebgi.webp', frame: 'from-sky-500/20 to-blue-950/15 ring-sky-500/35' },
    epic: { name: '에픽', color: 'text-violet-400', background: '/images/equipments/epicbgi.webp', frame: 'from-violet-500/25 to-purple-950/15 ring-violet-500/40' },
    legendary: { name: '전설', color: 'text-rose-500', background: '/images/equipments/legendarybgi.webp', frame: 'from-rose-500/25 to-red-950/15 ring-rose-500/40' },
    mythic: { name: '신화', color: 'text-amber-400', background: '/images/equipments/mythicbgi.webp', frame: 'from-amber-500/25 to-orange-950/20 ring-amber-400/45' },
    transcendent: {
        name: '초월',
        color: 'text-cyan-300',
        background: '/images/equipments/transcendentbgi.webp',
        frame: 'from-cyan-500/30 via-teal-600/20 to-cyan-950/25 ring-cyan-400/50',
    },
};`;
      const gradeBlockNew = `export const equipmentDetailGradeStyles: Record<ItemGrade, { color: string; background: string; frame: string }> = {
    normal: { color: 'text-zinc-300', background: '/images/equipments/normalbgi.webp', frame: 'from-zinc-500/15 to-zinc-700/5 ring-zinc-500/25' },
    uncommon: { color: 'text-emerald-400', background: '/images/equipments/uncommonbgi.webp', frame: 'from-emerald-500/20 to-emerald-900/10 ring-emerald-500/30' },
    rare: { color: 'text-sky-400', background: '/images/equipments/rarebgi.webp', frame: 'from-sky-500/20 to-blue-950/15 ring-sky-500/35' },
    epic: { color: 'text-violet-400', background: '/images/equipments/epicbgi.webp', frame: 'from-violet-500/25 to-purple-950/15 ring-violet-500/40' },
    legendary: { color: 'text-rose-500', background: '/images/equipments/legendarybgi.webp', frame: 'from-rose-500/25 to-red-950/15 ring-rose-500/40' },
    mythic: { color: 'text-amber-400', background: '/images/equipments/mythicbgi.webp', frame: 'from-amber-500/25 to-orange-950/20 ring-amber-400/45' },
    transcendent: {
        color: 'text-cyan-300',
        background: '/images/equipments/transcendentbgi.webp',
        frame: 'from-cyan-500/30 via-teal-600/20 to-cyan-950/25 ring-cyan-400/50',
    },
};`;
      s = s.replace(gradeBlock, gradeBlockNew);
      s = ensureHook(s, 'const EquipmentDetailContent', "    const { t } = useTranslation('profile');\n    const localizedGrade = useLocalizedItemGrade();\n");
      if (!s.includes('localizedGrade')) {
        s = ensureHook(s, 'export const EquipmentDetailPanel', "    const { t } = useTranslation('profile');\n    const localizedGrade = useLocalizedItemGrade();\n");
      }
      s = s.replace(
        "item.type === 'consumable' ? '가방에서 사용할 수 있습니다.' : '이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.';",
        "item.type === 'consumable' ? t('equipmentDetail.inventoryUse') : t('equipmentDetail.noMaterialUse');",
      );
      s = s.replace(
        "const typeLabel = item.type === 'consumable' ? '소모품' : '재료';",
        "const typeLabel = item.type === 'consumable' ? t('equipmentDetail.typeConsumable') : t('equipmentDetail.typeMaterial');",
      );
      s = s.replace(
        "{materialQuantityCaption === 'obtained' ? '획득 수량' : '보유 수량'}",
        "{materialQuantityCaption === 'obtained' ? t('equipmentDetail.obtainedQty') : t('equipmentDetail.ownedQty')}",
      );
      s = s.replaceAll('[{styles.name}]', '[{localizedGrade(item.grade)}]');
      s = s.replace("{item.isBound ? '귀속' : '거래가능'}", "{item.isBound ? t('equipmentDetail.bound') : t('equipmentDetail.tradable')}");
      s = s.replace(
        "제련 가능: {refinementCount > 0 ? `${refinementCount}회` : '제련불가'}",
        "{t('equipmentDetail.refinementCount', { value: refinementCount > 0 ? `${refinementCount}` : t('equipmentDetail.refinementUnavailable') })}",
      );
      return s;
    },
  },
];

export function runPass6Migrations() {
  const ko = readJson('shared/i18n/catalog/ko.json');
  const en = readJson('shared/i18n/catalog/en.json');
  extendCatalogPass6(ko, en);
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
      console.log('Pass6:', file);
    }
  }
  console.log(`Pass6 done: ${modified} files modified.`);
  return modified;
}
