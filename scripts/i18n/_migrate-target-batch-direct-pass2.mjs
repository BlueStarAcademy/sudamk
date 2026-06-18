/** Pass 2 direct migrations */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(root, f), c, 'utf8');

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

let n = 0;

{
  const file = 'components/gameRecord/GameRecordReplayNav.tsx';
  let s = read(file);
  const before = s;
  s = ensureImport(s, I18N);
  s = ensureHook(s, 'const GameRecordReplayNav', "    const { t } = useTranslation('common');\n");
  s = s.replace("back1: '한수 뒤로',", "back1: t('replayBack1'),").replace("forward1: '한수 앞으로',", "forward1: t('replayForward1'),");
  if (s !== before) { write(file, s); n++; console.log('Pass2:', file); }
}

{
  const file = 'components/SellMaterialBulkModal.tsx';
  let s = read(file);
  const before = s;
  if (!s.includes("const { t }")) {
    s = ensureImport(s, I18N);
    s = ensureHook(s, 'const SellMaterialBulkModal', "    const { t } = useTranslation('inventory');\n");
  }
  s = s
    .replace("title={item.type === 'consumable' ? '소모품 일괄 판매' : '재료 일괄 판매'}", "title={item.type === 'consumable' ? t('sellBulk.consumableBulk') : t('sellBulk.materialBulk')}")
    .replace('>일괄 판매<', ">{t('sellBulk.bulkSellTitle')}<")
    .replace('>판매할 수량을 정하세요<', ">{t('sellBulk.pickAmount')}<")
    .replace("{ label: '1개', q: 1 }", "{ label: t('useQuantity.one'), q: 1 }")
    .replace("{ label: '절반', q: Math.max(1, Math.floor(totalQuantity / 2)) }", "{ label: t('useQuantity.half'), q: Math.max(1, Math.floor(totalQuantity / 2)) }")
    .replace("{ label: '전부', q: totalQuantity }", "{ label: t('useQuantity.all'), q: totalQuantity }")
    .replace('>판매 수량<', ">{t('sellBulk.sellAmount')}<")
    .replace("{isDeleteOnly ? '0 (삭제만)' : `${pricePerUnit.toLocaleString()} 골드`}", "{isDeleteOnly ? t('sellBulk.deleteOnly') : t('sellBulk.goldUnit', { amount: pricePerUnit.toLocaleString() })}")
    .replace("{isDeleteOnly ? '합계 (삭제)' : '총 받을 골드'}", "{isDeleteOnly ? t('sellBulk.deleteCheckout') : t('sellBulk.totalReceive')}")
    .replace('>골드는 들어오지 않고, 선택한 개수만큼만 사라집니다.<', ">{t('sellBulk.noGoldHint')}<")
    .replace('>취소<', ">{t('actions.cancel', { ns: 'common' })}<")
    .replace('>{quantity}개 판매<', ">{t('sellBulk.sellCount', { count: quantity })}<");
  if (s !== before) { write(file, s); n++; console.log('Pass2:', file); }
}

console.log(`Pass2 done: ${n} files`);
