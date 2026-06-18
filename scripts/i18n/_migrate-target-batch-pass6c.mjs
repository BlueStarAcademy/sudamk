/** Pass 6c: final stub fixes for remaining UI Korean. */
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

export function extendCatalogPass6c(ko, en) {
  Object.assign(ko.game.colorSticky, {
    autoProgress: '자동 진행까지',
    autoProgressShort: '자동 진행',
  });
  Object.assign(en.game.colorSticky, {
    autoProgress: 'Auto in',
    autoProgressShort: 'Auto',
  });
  Object.assign(ko.game.pairTurnOrder, {
    orderHintRich: '대국은 흑1 → 백1 → 흑2 → 백2 순서로 진행됩니다.',
    decidedShort: '착수 순서가 결정되었습니다',
    decidingShort: '착수 순서를 결정하는 중입니다',
  });
  Object.assign(en.game.pairTurnOrder, {
    orderHintRich: 'Play order: B1 → W1 → B2 → W2.',
    decidedShort: 'Play order is set',
    decidingShort: 'Setting play order',
  });
  Object.assign(ko.game.baseStoneChoice, {
    pairHostStones: '방장: 양 참가자의 선호 돌을 차례로 선택하세요.',
    pickStone: '마음에 드는 돌을 선택하세요.',
    participant1: '(참가자 1)',
    participant2: '(참가자 2)',
  });
  Object.assign(en.game.baseStoneChoice, {
    pairHostStones: 'Host: pick preferred stones for both players.',
    pickStone: 'Choose your preferred stone.',
    participant1: '(Player 1)',
    participant2: '(Player 2)',
  });
  Object.assign(ko.game.preGameColor, {
    finalCardAlt: '좌우 카드에 최종 선공·후공이 표시됩니다.',
    fastFlashAlt: '두 칸의 흑·백 표시가 바뀌다가 잠시 뒤 최종 배치로 고정됩니다.',
    smoothEndAlt: '흑과 백이 빠르게 바뀌며 무작위로 멈춥니다.',
  });
  Object.assign(en.game.preGameColor, {
    finalCardAlt: 'Final first/second shown on left and right cards.',
    fastFlashAlt: 'Black/white flash in each slot, then lock to final layout.',
    smoothEndAlt: 'Black and white flash quickly until random stop.',
  });
  Object.assign(ko.game.uniformColor, {
    flashHintAlt: '흑돌과 백돌이 빠르게 바뀌다가 무작위로 멈춥니다.',
  });
  Object.assign(en.game.uniformColor, {
    flashHintAlt: 'Black and white stones flash until random stop.',
  });
  Object.assign(ko.game.conditionPotion, {
    expectedMobile: '회복 후(예상)',
    expectedDesktop: '예상 회복 후 컨디션',
  });
  Object.assign(en.game.conditionPotion, {
    expectedMobile: 'After recovery (est.)',
    expectedDesktop: 'Expected condition after recovery',
  });
  Object.assign(ko.game.thiefRole, {
    titleRich: '룰렛으로 역할과 선공/후공이 결정되었습니다',
    waitingConfirmEllipsis: '상대방 확인 대기 중...',
    checkingRouletteEllipsis: '룰렛 결과 확인 중...',
  });
  Object.assign(en.game.thiefRole, {
    titleRich: 'Roulette set role and turn order',
    waitingConfirmEllipsis: 'Waiting for opponent…',
    checkingRouletteEllipsis: 'Checking roulette…',
  });
  Object.assign(ko.game.thiefDeathmatch, {
    subtitleRich: '무작위로 도둑(흑)과 경찰(백)이 배정됩니다. 곧바로 굴림이 시작됩니다.',
    autoProceed: '연출 종료 후 자동으로 진행됩니다.',
  });
  Object.assign(en.game.thiefDeathmatch, {
    subtitleRich: 'Thief (black) and police (white) assigned at random. Rolling starts soon.',
    autoProceed: 'Continues automatically after the animation.',
  });
  Object.assign(ko.game.turnPreference, {
    autoProgress: '자동 선택까지',
    autoProgressShort: '자동 선택',
  });
  Object.assign(en.game.turnPreference, {
    autoProgress: 'Auto-pick in',
    autoProgressShort: 'Auto-pick',
  });
  Object.assign(ko.profile.gameRecords, {
    viewerTitleDash: '기보 — {{name}}',
  });
  Object.assign(en.profile.gameRecords, {
    viewerTitleDash: 'Record — {{name}}',
  });
  Object.assign(ko.inventory.bulkObtained, {
    rankScoreDelta: '랭킹 점수 변화',
    percentIncrease: '{{percent}}% 증가',
    confirm: '확인',
  });
  Object.assign(en.inventory.bulkObtained, {
    rankScoreDelta: 'Ranking score change',
    percentIncrease: '+{{percent}}%',
    confirm: 'OK',
  });
  Object.assign(ko.inventory.disassemblyResult, {
    complete: '장비 분해 완료',
    jackpot: '대박!',
    confirm: '확인',
    blacksmithExp: '대장간 경험치',
  });
  Object.assign(en.inventory.disassemblyResult, {
    complete: 'Disassembly complete',
    jackpot: 'Jackpot!',
    confirm: 'OK',
    blacksmithExp: 'Blacksmith XP',
  });
  Object.assign(ko.inventory.pastRankings, {
    noTier: '티어없음',
  });
  Object.assign(en.inventory.pastRankings, {
    noTier: 'No tier',
  });
  Object.assign(ko.tournament.championship, {
    scoringUntil: '계가까지',
  });
  Object.assign(en.tournament.championship, {
    scoringUntil: 'Until scoring',
  });
  Object.assign(ko.blacksmith.convert, {
    timesSuffix: '{{count}}회',
  });
  Object.assign(en.blacksmith.convert, {
    timesSuffix: '{{count}}×',
  });
  Object.assign(ko.profile.homeBoard, {
    newPostBadge: '새 글',
  });
  Object.assign(en.profile.homeBoard, {
    newPostBadge: 'New',
  });
  Object.assign(ko.game.nigiri, {
    confirmTitle: '흑·백 확인',
  });
  Object.assign(en.game.nigiri, {
    confirmTitle: 'Black & white confirm',
  });
}

const migrations = [
  {
    file: 'components/GameRecordViewerModal.tsx',
    fn: (c) => c.replace(
      'title={`기보 — ${record.opponent.nickname}`}',
      "title={t('gameRecords.viewerTitleDash', { name: record.opponent.nickname })}",
    ),
  },
  {
    file: 'components/ChampionshipRankingPanel.tsx',
    fn: (c) => c.replace(
      'title={!isCurrentUser ? `${entry.nickname} 프로필 보기` : \'\'}',
      "title={!isCurrentUser ? t('championship.ranking.viewProfile', { name: entry.nickname }) : ''}",
    ),
  },
  {
    file: 'components/HomeNativeMergedEquipmentAbilityPanel.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        'title={`보너스: ${availablePoints}P`}',
        "title={t('coreAbility.bonusPoints', { points: availablePoints })}",
      );
      s = s.replace(
        ": `기본 ${baseV} · 장비·보너스 반영`",
        ": t('coreAbility.statBaseOnly', { base: baseV })",
      );
      return s;
    },
  },
  {
    file: 'components/ColorAssignmentStickyFooter.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'export const ColorAssignmentStickyFooter', "    const { t } = useTranslation('game');\n");
      s = s.replace("const label = hasConfirmed ? '상대방 확인 대기 중…' : '시작하기';", "const label = hasConfirmed ? t('colorSticky.waiting') : t('colorSticky.start');");
      s = s.replace('label="자동 진행까지"', "label={t('colorSticky.autoProgress')}");
      s = s.replace('labelShort="자동 진행"', "labelShort={t('colorSticky.autoProgressShort')}");
      return s;
    },
  },
  {
    file: 'components/TurnPreferenceSelection.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace('label="자동 선택까지"', "label={t('turnPreference.autoProgress')}");
      s = s.replace('labelShort="자동 선택"', "labelShort={t('turnPreference.autoProgressShort')}");
      s = s.replace('title="순서 선택"', "title={t('turnPreference.title')}");
      return s;
    },
  },
  {
    file: 'components/PairTurnOrderModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        "{rouletteDone ? '착수 순서가 결정되었습니다' : '착수 순서를 결정하는 중입니다'}",
        "{rouletteDone ? t('pairTurnOrder.decidedShort') : t('pairTurnOrder.decidingShort')}",
      );
      s = s.replace(
        '대국은 <span className="font-bold text-amber-200">흑1 → 백1 → 흑2 → 백2</span> 순서로 진행됩니다.',
        "{t('pairTurnOrder.orderHintRich')}",
      );
      return s;
    },
  },
  {
    file: 'components/ThiefRoleConfirmedModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace('title="룰렛으로 역할과 선공/후공이 결정되었습니다"', "title={t('thiefRole.titleRich')}");
      s = s.replace(
        "{hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `대국 시작 (${countdown})`}",
        "{hasConfirmed ? t('thiefRole.waitingConfirmEllipsis') : !rouletteDone ? t('thiefRole.checkingRouletteEllipsis') : t('startConfirm.startCountdown', { count: countdown })}",
      );
      return s;
    },
  },
  {
    file: 'components/DiceGoStartConfirmationModal.tsx',
    fn: (c) => c.replace(
      "{hasConfirmed ? '상대방 확인 대기 중...' : `대국 시작 (${countdown})`}",
      "{hasConfirmed ? t('startConfirm.waitingConfirm') : t('startConfirm.startCountdown', { count: countdown })}",
    ),
  },
  {
    file: 'components/ConditionPotionModal.tsx',
    fn: (c) => c.replace(
      "{isNativeMobile ? '회복 후(예상)' : '예상 회복 후 컨디션'}",
      "{isNativeMobile ? t('conditionPotion.expectedMobile') : t('conditionPotion.expectedDesktop')}",
    ),
  },
  {
    file: 'components/UniformColorRouletteModal.tsx',
    fn: (c) => c.replace(
      ": '흑돌과 백돌이 빠르게 바뀌다가 무작위로 멈춥니다.'}",
      ": t('uniformColor.flashHintAlt')}",
    ),
  },
  {
    file: 'components/BaseStoneColorChoicePanel.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        "{isPairHostChoice ? '방장: 양 참가자의 선호 돌을 차례로 선택하세요.' : '마음에 드는 돌을 선택하세요.'}",
        "{isPairHostChoice ? t('baseStoneChoice.pairHostStones') : t('baseStoneChoice.pickStone')}",
      );
      s = s.replace(' (참가자 1)', " {t('baseStoneChoice.participant1')}");
      s = s.replace(' (참가자 2)', " {t('baseStoneChoice.participant2')}");
      return s;
    },
  },
  {
    file: 'components/PreGameColorRoulette.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace("? '좌우 카드에 최종 선공·후공이 표시됩니다.'", "? t('preGameColor.finalCardAlt')");
      s = s.replace("? '두 칸의 흑·백 표시가 바뀌다가 잠시 뒤 최종 배치로 고정됩니다.'", "? t('preGameColor.fastFlashAlt')");
      s = s.replace(": '흑과 백이 빠르게 바뀌며 무작위로 멈춥니다.'}", ": t('preGameColor.smoothEndAlt')}");
      return s;
    },
  },
  {
    file: 'components/StatAllocationModal.tsx',
    fn: (c) => c.replace('title="능력치 포인트 분배"', "title={t('statAllocation.allocateTitle')}"),
  },
  {
    file: 'components/EquipmentDetailPanel.tsx',
    fn: (c) => c.replace("{item.isBound ? '귀속' : '거래가능'}", "{item.isBound ? t('equipmentDetail.bound') : t('equipmentDetail.tradable')}"),
  },
  {
    file: 'components/RankingQuickModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace('title="스코어 가이드 보기"', "title={t('rankingQuick.scrollGuide')}");
      s = s.replace('aria-label="스코어 가이드 보기"', "aria-label={t('rankingQuick.scrollGuideAria')}");
      return s;
    },
  },
  {
    file: 'components/SellItemConfirmModal.tsx',
    fn: (c) => c.replace(
      "{isDeleteOnly ? '골드 0 — 인벤에서만 삭제됩니다' : '판매 후 지급'}",
      "{isDeleteOnly ? t('sellConfirm.deleteOnlyHint') : t('sellConfirm.afterSell')}",
    ),
  },
  {
    file: 'components/HomeBoardPanel.tsx',
    fn: (c) => c.replace('aria-label="새 글"', "aria-label={t('homeBoard.newPostBadge')}"),
  },
  {
    file: 'components/blacksmith/ConversionView.tsx',
    fn: (c) => c.replace(
      '`${quantity}회 ${isUpgrade ? t(\'convert.combine\') : t(\'convert.disassemble\')}`',
      "t('convert.timesSuffix', { count: quantity }) + ' ' + (isUpgrade ? t('convert.combine') : t('convert.disassemble'))",
    ),
  },
  {
    file: 'components/BulkItemObtainedModal.tsx',
    fn: (c) => {
      let s = ensureHook(c, 'const BulkItemObtainedModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace('>랭킹 점수 변화<', ">{t('bulkObtained.rankScoreDelta')}<");
      s = s.replace(
        '{((tournamentScoreChange.scoreReward / tournamentScoreChange.oldScore) * 100).toFixed(1)}% 증가',
        "{t('bulkObtained.percentIncrease', { percent: ((tournamentScoreChange.scoreReward / tournamentScoreChange.oldScore) * 100).toFixed(1) })}",
      );
      s = s.replace('>확인<', ">{t('bulkObtained.confirm')}<");
      return s;
    },
  },
  {
    file: 'components/DisassemblyResultModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace('>장비 분해 완료<', ">{t('disassemblyResult.complete')}<");
      s = s.replace('>대박!<', ">{t('disassemblyResult.jackpot')}<");
      s = s.replace(
        '모든 재료 획득량이 <span className="font-bold text-amber-200">2배</span>였습니다',
        "{t('disassemblyResult.jackpotAll')}",
      );
      s = s.replace('>대장간 경험치<', ">{t('disassemblyResult.blacksmithExp')}<");
      s = s.replace('>확인<', ">{t('disassemblyResult.confirm')}<");
      return s;
    },
  },
  {
    file: 'components/modals/PastRankingsModal.tsx',
    fn: (c) => c.replace('>티어없음<', ">{t('pastRankings.noTier')}<"),
  },
  {
    file: 'components/championship/ChampionshipArenaScorePanels.tsx',
    fn: (c) => c.replaceAll('>계가까지<', ">{t('championship.scoringUntil')}<"),
  },
  {
    file: 'components/championship/ChampionshipShopPanel.tsx',
    fn: (c) => {
      let s = c;
      if (!s.includes("useTranslation('tournament')")) {
        s = ensureImport(s, I18N);
        s = ensureHook(s, 'const ChampionshipShopPanel', "    const { t } = useTranslation('tournament');\n");
      }
      return s;
    },
  },
  {
    file: 'components/PairPetObtainedModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const PairPetObtainedModal', "    const { t } = useTranslation('game');\n");
      s = s.replace(
        "mode === 'obtain' ? '펫 획득' : isEquippedRowDetail ? '대표 펫 정보' : '펫 상세 정보'",
        "mode === 'obtain' ? t('pairPet.obtained') : isEquippedRowDetail ? t('pairPet.equippedDetail') : t('pairPet.detail')",
      );
      return s;
    },
  },
  {
    file: 'components/StageSelectionModal.tsx',
    fn: (c) => c.replace(
      /목표 점수: 흑\{stage\.targetScore\.black > 0 \? stage\.targetScore\.black : '—'\}\/백\{stage\.targetScore\.white > 0 \? stage\.targetScore\.white : '—'\}집/,
      "{t('stageSelection.targetScore', { black: stage.targetScore.black > 0 ? stage.targetScore.black : '—', white: stage.targetScore.white > 0 ? stage.targetScore.white : '—' })}",
    ),
  },
  {
    file: 'components/ThiefDeathmatchRoleRouletteModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const ThiefDeathmatchRoleRouletteModal', "    const { t } = useTranslation('game');\n");
      s = s.replace(
        'subtitle="무작위로 도둑(흑)과 경찰(백)이 배정됩니다. 곧바로 굴림이 시작됩니다."',
        "subtitle={t('thiefDeathmatch.subtitleRich')}",
      );
      s = s.replace('>연출 종료 후 자동으로 진행됩니다.<', ">{t('thiefDeathmatch.autoProceed')}<");
      return s;
    },
  },
  {
    file: 'components/ColorStartConfirmationModal.tsx',
    fn: (c) => c.replace('title="흑·백 확인"', "title={t('nigiri.confirmTitle')}"),
  },
  {
    file: 'components/TurnPreferenceRouletteModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const TurnPreferenceRouletteModal', "    const { t } = useTranslation('game');\n");
      s = s.replace('title="선공 · 후공"', "title={t('turnRoulette.title')}");
      return s;
    },
  },
  {
    file: 'components/GameApplicationModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace('<h3 className="mb-4 text-3xl font-bold text-primary">{selectedGameMode.mode} 신청</h3>', "<h3 className=\"mb-4 text-3xl font-bold text-primary\">{t('gameApplication.applyTitle', { mode: selectedGameMode.mode })}</h3>");
      s = s.replace('>게임 신청<', ">{t('gameApplication.title')}<");
      return s;
    },
  },
  {
    file: 'components/Button.tsx',
    fn: (c) => c.replace("// 'none'은 className으로", '// scheme none: className'),
  },
];

export function runPass6cMigrations() {
  const ko = readJson('shared/i18n/catalog/ko.json');
  const en = readJson('shared/i18n/catalog/en.json');
  extendCatalogPass6c(ko, en);
  writeJson('shared/i18n/catalog/ko.json', ko);
  writeJson('shared/i18n/catalog/en.json', en);
  let modified = 0;
  for (const { file, fn } of migrations) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const before = read(file);
    const after = fn(before);
    if (after !== before) {
      write(file, after);
      modified++;
      console.log('Pass6c:', file);
    }
  }
  console.log(`Pass6c done: ${modified} files modified.`);
}
