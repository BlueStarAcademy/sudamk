/**
 * Direct remaining i18n migrations for partially-migrated target files.
 * Run after _migrate-target-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

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
const LC = "import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../../shared/i18n/localizedCatalog.js';\n";
const LC_ROOT = "import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../shared/i18n/localizedCatalog.js';\n";
const LC_GAME = "import { useLocalizedGameMode } from '../shared/i18n/localizedCatalog.js';\n";
const T_COMMON = "import type { TFunction } from 'i18next';\n";

/** @type {Array<{file:string, fn:(c:string)=>string}>} */
const migrations = [
  {
    file: 'components/AppModalLayer.tsx',
    fn: (c) => c.replace(
      '<span className="block">다른 곳에서 로그인 되었습니다.</span>',
      '<span className="block">{t(\'disconnectNotice.otherLogin\')}</span>',
    ),
  },
  {
    file: 'components/MannerGradeChangeModal.tsx',
    fn: (c) => c
      .replace(
        "? '바른 매너를 유지하면 혜택이 늘어납니다. 계속 좋은 대국 부탁드립니다.'",
        "? t('mannerGradeChange.upHint')",
      )
      .replace(
        ": '매너 점수가 낮아지면 보상·능력치에 불리할 수 있습니다. 건전한 플레이를 권장합니다.'}",
        ": t('mannerGradeChange.downHint')}",
      ),
  },
  {
    file: 'components/blacksmith/EnhancementView.tsx',
    fn: (c) => {
      let s = c;
      s = s.replace(
        '{starInfoBefore.text || \'(미강화)\'}',
        "{starInfoBefore.text || t('notEnhanced', { ns: 'common' })}",
      );
      s = s.replace(
        'return `레벨 부족 (${formatEquipLevelRequirement(levelRequirement)} 필요)`;',
        "return t('enhance.levelInsufficient', { required: formatEquipLevelRequirement(levelRequirement) });",
      );
      s = s.replace(
        'successRateBreakdownParts.push(`기본 ${formatBlacksmithPercentInt(baseSuccessRate)}%`);',
        "successRateBreakdownParts.push(t('enhance.baseRate', { rate: formatBlacksmithPercentInt(baseSuccessRate) }));",
      );
      s = s.replace(
        'if (failBonus > 0) successRateBreakdownParts.push(`실패 보너스 +${formatBlacksmithPercentInt(failBonus)}%`);',
        "if (failBonus > 0) successRateBreakdownParts.push(t('enhance.failBonus', { rate: formatBlacksmithPercentInt(failBonus) }));",
      );
      s = s.replace(
        'if (vipEnhanceBonus > 0) successRateBreakdownParts.push(`기능 VIP +${formatBlacksmithPercentInt(vipEnhanceBonus)}%`);',
        "if (vipEnhanceBonus > 0) successRateBreakdownParts.push(t('enhance.vipBonus', { rate: formatBlacksmithPercentInt(vipEnhanceBonus) }));",
      );
      s = s.replace(
        '<span className="flex-shrink-0 whitespace-nowrap text-gray-400">주옵션:</span>',
        '<span className="flex-shrink-0 whitespace-nowrap text-gray-400">{t(\'enhance.mainOptionLabel\')}</span>',
      );
      s = s.replace(
        'title={`골드: ${formatGoldAmountKoG(currentUser?.gold || 0)} / ${formatGoldAmountKoG(goldCost)}`}',
        "title={t('enhance.goldTitle', { current: formatGoldAmountKoG(currentUser?.gold || 0), cost: formatGoldAmountKoG(goldCost) })}",
      );
      s = s.replace('<p>강화할 장비를 선택해주세요.</p>', '<p>{t(\'enhance.pickGear\')}</p>');
      return s;
    },
  },
  {
    file: 'components/blacksmith/RefinementResultModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, T_COMMON);
      s = s.replace(
        'function collectRefinementDiffs(beforeItem: InventoryItem, afterItem: InventoryItem): RefinementDiff[] {',
        "function collectRefinementDiffs(beforeItem: InventoryItem, afterItem: InventoryItem, t: TFunction<'blacksmith'>): RefinementDiff[] {",
      );
      s = s.replace(
        "let hint = '스페셜 옵션 변경';",
        "let hint = t('refine.specialOptionChange');",
      );
      s = s.replace("hint = '스페셜 · 종류·수치 변경';", "hint = t('refine.specialTypeValue');");
      s = s.replace("hint = '스페셜 · 종류 변경';", "hint = t('refine.specialType');");
      s = s.replace("hint = '스페셜 · 수치 변경';", "hint = t('refine.specialValue');");
      s = s.replace(
        'slotLabel: `스페셜 옵션 ${i + 1}`,',
        "slotLabel: t('refine.specialOptionSlot', { index: i + 1 }),",
      );
      s = s.replace('beforeText: `${rcBefore}회`,', "beforeText: t('refine.countTimes', { count: rcBefore }),");
      s = s.replace('afterText: `${rcAfter}회`,', "afterText: t('refine.countTimes', { count: rcAfter }),");
      s = s.replace(
        '<span className="shrink-0 text-[11px] font-bold tracking-wide text-amber-200/90">능력치 변화</span>',
        '<span className="shrink-0 text-[11px] font-bold tracking-wide text-amber-200/90">{t(\'refine.abilityChange\')}</span>',
      );
      s = s.replace(
        /const gradeStyles: Record<ItemGrade, \{ name: string; color: string; background: string \}> = \{[\s\S]*?\};/,
        `const gradeStyles: Record<ItemGrade, { color: string; background: string }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-orange-400', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};`,
      );
      s = ensureImport(s, LC);
      s = ensureHook(s, 'const RefinementResultModal', "    const localizedGrade = useLocalizedItemGrade();\n");
      s = s.replace(/gradeStyles\[([^\]]+)\]\.name/g, 'localizedGrade($1)');
      s = s.replace(
        'const diffs = useMemo(() => collectRefinementDiffs(beforeItem, afterItem), [beforeItem, afterItem]);',
        'const diffs = useMemo(() => collectRefinementDiffs(beforeItem, afterItem, t), [beforeItem, afterItem, t]);',
      );
      return s;
    },
  },
  {
    file: 'components/blacksmith/CombinationResultModal.tsx',
    fn: (c) => c.replace(
      '<span className="flex items-center gap-1"><img src="/images/equipments/moru.webp" alt={t(\'combinationResult.expGain\')} className="w-5 h-5" /> 대장간 경험치:</span>',
      '<span className="flex items-center gap-1"><img src="/images/equipments/moru.webp" alt={t(\'combinationResult.expGain\')} className="w-5 h-5" /> {t(\'combinationResult.expGainLabel\')}</span>',
    ).replace(
      '제련 가능: {(item as any).refinementCount > 0 ?',
      '{t(\'combinationResult.refinementPrefix\')} {(item as any).refinementCount > 0 ?',
    ),
  },
  {
    file: 'components/CurlingStartConfirmationModal.tsx',
    fn: (c) => c
      .replace('title="룰렛으로 선공/후공이 결정되었습니다"', 'title={t(\'startConfirm.rouletteDoneShort\')}')
      .replace('subtitle="가위바위보 대신 자동 룰렛으로 흑과 백이 배정됩니다."', 'subtitle={t(\'startConfirm.autoRouletteShort\')}')
      .replace("{hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `대국 시작 (${countdown})`}", "{hasConfirmed ? t('startConfirm.waitingConfirm') : !rouletteDone ? t('startConfirm.checkingRoulette') : t('startConfirm.startCountdown', { count: countdown })}"),
  },
  {
    file: 'components/AlkkagiStartConfirmationModal.tsx',
    fn: (c) => c
      .replace('title="룰렛으로 선공/후공이 결정되었습니다"', 'title={t(\'startConfirm.rouletteDoneShort\')}')
      .replace('subtitle="가위바위보 대신 자동 룰렛으로 흑과 백이 배정됩니다."', 'subtitle={t(\'startConfirm.autoRouletteShort\')}')
      .replace("{hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `대국 시작 (${countdown})`}", "{hasConfirmed ? t('startConfirm.waitingConfirm') : !rouletteDone ? t('startConfirm.checkingRoulette') : t('startConfirm.startCountdown', { count: countdown })}"),
  },
  {
    file: 'components/SellMaterialBulkModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const SellMaterialBulkModal', "    const { t } = useTranslation('inventory');\n");
      s = s.replace("const label = item.type === 'consumable' ? '소mo품' : '재료';", "const label = item.type === 'consumable' ? t('purchase.consumable') : t('purchase.material');");
      s = s.replace("const label = item.type === 'consumable' ? '소모품' : '재료';", "const label = item.type === 'consumable' ? t('purchase.consumable') : t('purchase.material');");
      s = s.replace("title={item.type === 'consumable' ? '소mo품 일괄 판매' : '재료 일괄 판매'}", "title={item.type === 'consumable' ? t('sellBulk.consumableBulk') : t('sellBulk.materialBulk')}");
      s = s.replace("title={item.type === 'consumable' ? '소모품 일괄 판매' : '재료 일괄 판매'}", "title={item.type === 'consumable' ? t('sellBulk.consumableBulk') : t('sellBulk.materialBulk')}");
      return s;
    },
  },
];

let modified = 0;
for (const { file, fn } of migrations) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.warn('Missing', file);
    continue;
  }
  const before = read(file);
  const after = fn(before);
  if (after !== before) {
    write(file, after);
    modified++;
    console.log('Direct migrated:', file);
  }
}
console.log(`\nDirect remaining: ${modified} files modified.`);
