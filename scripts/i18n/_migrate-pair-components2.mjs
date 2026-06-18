import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits) {
    const p = path.join(root, file);
    let s = fs.readFileSync(p, 'utf8');
    let n = 0;
    for (const [from, to] of edits) {
        if (!s.includes(from)) {
            console.warn(`SKIP ${file}: ${from.slice(0, 50).replace(/\n/g, ' ')}...`);
            continue;
        }
        s = s.replace(from, to);
        n++;
    }
    fs.writeFileSync(p, s);
    console.log(`patched ${file} (${n} edits)`);
}

patch('components/pair/PairPetGradeUpgradeModal.tsx', [
    [
        `                                <p className="mt-1 tabular-nums text-sm font-bold text-slate-300">
                                    보유 <span className="text-fuchsia-200">{ownedSoul}</span>
                                    <span className="text-slate-500"> / 필요 </span>
                                    <span className="text-amber-200">{soulNeed ?? '—'}</span>
                                </p>`,
        `                                <p className="mt-1 tabular-nums text-sm font-bold text-slate-300">
                                    <Trans
                                        i18nKey="pair:gradeUpgrade.ownedCount"
                                        values={{ owned: ownedSoul, need: soulNeed ?? '—' }}
                                        components={{
                                            owned: <span className="text-fuchsia-200" />,
                                            sep: <span className="text-slate-500" />,
                                            need: <span className="text-amber-200" />,
                                        }}
                                    />
                                </p>`,
    ],
    [
        `import { useTranslation } from 'react-i18next';`,
        `import { useTranslation, Trans } from 'react-i18next';`,
    ],
]);

patch('components/pair/PairPetLobbyInfoPetViewer.tsx', [
    [
        "import React, { useMemo, useState } from 'react';",
        "import React, { useMemo, useState } from 'react';\nimport { useTranslation } from 'react-i18next';",
    ],
    [
        `}) => {
    const tid = item.templateId ?? null;`,
        `}) => {
    const { t } = useTranslation(['pair', 'common']);
    const { t: tCommon } = useTranslation('common');
    const tid = item.templateId ?? null;`,
    ],
    [
        `            setGradeBlockHint('수련 중인 펫은 등급 강화할 수 없습니다. 수련을 마친 뒤 이용해 주세요.');`,
        `            setGradeBlockHint(t('gradeUpgrade.cannotWhileTraining'));`,
    ],
    [
        `            setGradeBlockHint('더 올릴 수 있는 등급이 없습니다.');`,
        `            setGradeBlockHint(t('gradeUpgrade.noHigherGrade'));`,
    ],
    [
        `            setGradeBlockHint(\`펫 레벨이 부족합니다. Lv.\${needLv} 필요 (현재 Lv.\${levelSafe})\`);`,
        `            setGradeBlockHint(t('gradeUpgrade.levelInsufficient', { need: needLv, current: levelSafe }));`,
    ],
    [
        `            setGradeBlockHint('등급 강화 조건을 확인할 수 없습니다.');`,
        `            setGradeBlockHint(t('gradeUpgrade.conditionsUnknown'));`,
    ],
    [
        `                \`\${soulNameKo ?? '영혼석'}이 부족합니다. \${soulNeed}개 필요 (보유 \${ownedSoul}개)\`,`,
        `                t('gradeUpgrade.soulInsufficient', { name: soulNameKo ?? t('gradeUpgrade.soulStoneFallback'), need: soulNeed, owned: ownedSoul }),`,
    ],
    [`                        대표펫 해제`, `{t('gradeUpgrade.unequipRepFirst')}`],
    [
        `                                ? '수련 중인 펫은 대표펫으로 지정할 수 없습니다. 수련을 마친 뒤 지정해 주세요.'`,
        `                                ? t('gradeUpgrade.cannotSetRepWhileTraining')`,
    ],
    [`                        대표펫 장착`, `{t('gradeUpgrade.equipRep')}`],
    [
        `                            ? \`\${soulNameKo ?? '영혼석'} \${soulNeed ?? ''}개 소모 · 등급 상승\``,
        `                            ? t('gradeUpgrade.soulCostTitle', { name: soulNameKo ?? t('gradeUpgrade.soulStoneFallback'), count: soulNeed ?? '' })`,
    ],
    [
        `                              ? '수련 중인 펫은 등급 강화할 수 없습니다.'`,
        `                              ? t('gradeUpgrade.cannotWhileTrainingShort')`,
    ],
    [
        `                                ? '더 올릴 수 있는 등급이 없습니다.'`,
        `                                ? t('gradeUpgrade.noHigherGrade')`,
    ],
    [
        `                                  ? \`\${soulNameKo ?? '영혼석'}이 부족합니다. (\${soulNeed}개 필요, 보유 \${ownedSoul})\``,
        `                                  ? t('gradeUpgrade.soulInsufficientShort', { name: soulNameKo ?? t('gradeUpgrade.soulStoneFallback'), need: soulNeed, owned: ownedSoul })`,
    ],
    [
        `                                  : \`Lv.\${needLv} 이상에서 등급 강화할 수 있습니다.\``,
        `                                  : t('gradeUpgrade.soulCostTitleMinLevel', { level: needLv })`,
    ],
    [`                    등급 강화`, `{t('gradeUpgrade.action')}`],
    [
        `                            ? '수련 중인 펫은 영혼변환할 수 없습니다. 수련을 마친 뒤 이용하세요.'`,
        `                            ? t('gradeUpgrade.cannotSoulConvertTraining')`,
    ],
    [
        `                              ? '대표펫으로 장착 중인 펫은 영혼변환할 수 없습니다. 대표펫 해제 후 이용하세요.'`,
        `                              ? t('gradeUpgrade.cannotSoulConvertRep')`,
    ],
    [`                    영혼변환`, `{t('gradeUpgrade.soulConvert')}`],
    [`                    title="안내"`, `                    title={t('lobby.noticeTitle')}`],
]);

patch('components/pair/PairPetLobbySoulStoneViewer.tsx', [
    [
        "import React, { useMemo } from 'react';",
        "import React, { useMemo } from 'react';\nimport { useTranslation } from 'react-i18next';\nimport { tx } from '../../shared/i18n/runtimeText.js';",
    ],
    [
        `    return \`[슬롯 \${slots.join('·')}]\`;`,
        `    return tx('pair:soulStone.slotList', { slots: slots.join('·') });`,
    ],
    [
        `            ? \`[다이아 \${formatWalletDiamonds(sku.diamonds)}]\``,
        `            ? tx('pair:soulStone.diamondPrice', { price: formatWalletDiamonds(sku.diamonds) })`,
    ],
    [
        `            : \`[골드 \${formatGoldAmountKoG(sku.gold)}]\``,
        `            : tx('pair:soulStone.goldPrice', { price: formatGoldAmountKoG(sku.gold) })`,
    ],
    [
        `    return \`\${price} [일일 \${sku.dailyLimit}회]\`;`,
        `    return tx('pair:soulStone.dailyLimitPrice', { price, limit: sku.dailyLimit });`,
    ],
    [
        `}) => {
    const grade = itemGradeSafe(item.grade);`,
        `}) => {
    const { t } = useTranslation('pair');
    const grade = itemGradeSafe(item.grade);`,
    ],
    [
        `                                보유 ×{qty.toLocaleString()}`,
        `{t('soulStone.ownedQty', { qty: qty.toLocaleString() })}`,
    ],
    [`<p className={\`\${PET_PANEL_TRAIT_TITLE} text-cyan-200/90\`}>사용처</p>`, `<p className={\`\${PET_PANEL_TRAIT_TITLE} text-cyan-200/90\`}>{t('soulStone.usage')}</p>`],
    [
        `<span className="text-violet-300">[펫]</span>`,
        `<span className="text-violet-300">{t('soulStone.petTag')}</span>`,
    ],
    [
        `<span className="text-slate-200">[등급 강화]</span>`,
        `<span className="text-slate-200">{t('soulStone.gradeUpgradeTag')}</span>`,
    ],
    [
        `                                        · 펫 Lv.{usageUpgrade.minLevel} 이상`,
        `                                        {t('soulStone.petLevelMin', { level: usageUpgrade.minLevel })}`,
    ],
    [`<span className="ml-1 text-slate-400">등급 강화에 사용</span>`, `<span className="ml-1 text-slate-400">{t('soulStone.usedForGradeUpgrade')}</span>`],
    [`<p className={\`\${PET_PANEL_TRAIT_TITLE} text-amber-200/90\`}>획득처</p>`, `<p className={\`\${PET_PANEL_TRAIT_TITLE} text-amber-200/90\`}>{t('soulStone.acquire')}</p>`],
    [
        `<span className="text-slate-200">[수련 보상]</span>`,
        `<span className="text-slate-200">{t('soulStone.trainingRewardTag')}</span>`,
    ],
    [
        `{acquireTraining || '해당 슬롯 없음'}`,
        `{acquireTraining || t('soulStone.noMatchingSlot')}`,
    ],
    [
        `<span className="text-slate-200">[영혼 변환]</span>`,
        `<span className="text-slate-200">{t('soulStone.soulConvertTag')}</span>`,
    ],
    [
        `{acquireConvert || '해당 등급 없음'}`,
        `{acquireConvert || t('soulStone.noMatchingGrade')}`,
    ],
    [
        `<span className="text-slate-200">[펫 상점]</span>`,
        `<span className="text-slate-200">{t('soulStone.petShopTag')}</span>`,
    ],
    [`{acquireShop || '판매 없음'}`, `{acquireShop || t('soulStone.notSold')}`],
    [`                    판매`, `                    {t('soulStone.sell')}`],
    [`                        일괄 판매`, `                        {t('soulStone.bulkSell')}`],
]);

console.log('batch2 done');
