import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits) {
    const p = path.join(root, file);
    let s = fs.readFileSync(p, 'utf8');
    for (const [from, to] of edits) {
        if (!s.includes(from)) {
            console.warn(`SKIP missing in ${file}: ${from.slice(0, 60)}...`);
            continue;
        }
        s = s.replace(from, to);
    }
    fs.writeFileSync(p, s);
    console.log('patched', file);
}

patch('components/pair/PairPetGradeUpgradeModal.tsx', [
    [
        "import React, { useMemo, useState } from 'react';",
        "import React, { useMemo, useState } from 'react';\nimport { useTranslation } from 'react-i18next';",
    ],
    [
        `}) => {
    const mainGradeStored = mainItem.grade ?? ItemGrade.Normal;`,
        `}) => {
    const { t } = useTranslation(['pair', 'common']);
    const { t: tCommon } = useTranslation('common');
    const mainGradeStored = mainItem.grade ?? ItemGrade.Normal;`,
    ],
    [
        `            return \`모든 능력치 +\${d.pct}% → \${bumped.pct}%\`;`,
        `            return t('pet.dispositionUpgradeAll', { from: d.pct, to: bumped.pct });`,
    ],
    [
        `        return \`\${fromName}→\${toName} +\${d.pct}% → \${bumped.pct}%\`;`,
        `        return t('pet.dispositionUpgradeConvert', { from: fromName, to: toName, fromPct: d.pct, toPct: bumped.pct });`,
    ],
    [
        `            return \`\${name} +\${d.pct}% → \${bumped.pct}%\`;`,
        `            return t('pet.dispositionUpgradeSingle', { stat: name, from: d.pct, to: bumped.pct });`,
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
        `            const nameKo = soulMat?.name ?? soulMatName ?? '영혼석';`,
        `            const nameKo = soulMat?.name ?? soulMatName ?? t('gradeUpgrade.soulStoneFallback');`,
    ],
    [
        `            setGradeBlockHint(\`\${nameKo}이 부족합니다. \${soulNeed}개 필요 (보유 \${ownedSoul}개)\`);`,
        `            setGradeBlockHint(t('gradeUpgrade.soulInsufficient', { name: nameKo, need: soulNeed, owned: ownedSoul }));`,
    ],
    [`title="펫 등급 강화"`, `title={t('gradeUpgrade.title')}`],
    [
        `<p className="mt-1 text-xs font-semibold text-amber-300/95 sm:text-sm">등급 강화까지 Lv.{needLv}</p>`,
        `<p className="mt-1 text-xs font-semibold text-amber-300/95 sm:text-sm">{t('gradeUpgrade.untilLevel', { level: needLv })}</p>`,
    ],
    [
        `>현재</span>`,
        `>{t('gradeUpgrade.current')}</span>`,
    ],
    [
        `>다음</span>`,
        `>{t('gradeUpgrade.next')}</span>`,
    ],
    [
        `                                더 올릴 수 있는 등급이 없습니다.`,
        `                                {t('gradeUpgrade.noHigherGrade')}`,
    ],
    [`<dt className="text-slate-400">기본 능력치 증가</dt>`, `<dt className="text-slate-400">{t('gradeUpgrade.baseStatIncrease')}</dt>`],
    [
        `<dd className="tabular-nums font-mono font-black text-amber-200 sm:text-right">+10%</dd>`,
        `<dd className="tabular-nums font-mono font-black text-amber-200 sm:text-right">{t('gradeUpgrade.percentTen')}</dd>`,
    ],
    [
        `                                            다음등급 구간 펫 레벨업 시 자동 분배 능력치`,
        `                                            {t('gradeUpgrade.nextGradeLevelUpBudget')}`,
    ],
    [
        `<p className="text-xs font-bold uppercase tracking-[0.12em] text-fuchsia-300/90 sm:text-[0.8125rem]">성향 강화</p>`,
        `<p className="text-xs font-bold uppercase tracking-[0.12em] text-fuchsia-300/90 sm:text-[0.8125rem]">{t('gradeUpgrade.dispositionBoost')}</p>`,
    ],
    [
        `<p className="mb-2.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85 sm:text-[0.8125rem]">필요 재료</p>`,
        `<p className="mb-2.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85 sm:text-[0.8125rem]">{t('gradeUpgrade.requiredMaterials')}</p>`,
    ],
    [
        `<div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">영혼석</div>`,
        `<div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">{t('gradeUpgrade.soulStoneFallback')}</div>`,
    ],
    [
        `<p className="text-base font-extrabold text-violet-50 sm:text-lg">{soulMat?.name ?? soulMatName ?? '영혼석'}</p>`,
        `<p className="text-base font-extrabold text-violet-50 sm:text-lg">{soulMat?.name ?? soulMatName ?? t('gradeUpgrade.soulStoneFallback')}</p>`,
    ],
    [
        `                            <p className="mt-2 text-sm font-semibold text-rose-300/95">영혼석이 부족합니다.</p>`,
        `                            <p className="mt-2 text-sm font-semibold text-rose-300/95">{t('gradeUpgrade.soulInsufficientInline')}</p>`,
    ],
    [`                        등급 강화`, `                        {t('gradeUpgrade.action')}`],
    [`                    title="안내"`, `                    title={t('lobby.noticeTitle')}`],
]);

patch('components/pair/PairPetGradeUpgradeResultModal.tsx', [
    [
        "import React, { useMemo } from 'react';",
        "import React, { useMemo } from 'react';\nimport { useTranslation } from 'react-i18next';",
    ],
    [
        `const PHASE_DEFS: { phase: PairPetKataPhase; label: string }[] = [
    { phase: 'opening', label: '초반' },
    { phase: 'midgame', label: '중반' },
    { phase: 'endgame', label: '종반' },
];`,
        '',
    ],
    [
        `}) => {
    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(itemAfter), [itemAfter]);`,
        `}) => {
    const { t } = useTranslation(['pair', 'common', 'profile', 'game']);
    const { t: tCommon } = useTranslation('common');
    const phaseDefs = useMemo(
        () =>
            [
                { phase: 'opening' as const, label: t('game:controls.phaseOpening') },
                { phase: 'midgame' as const, label: t('game:controls.phaseMidgame') },
                { phase: 'endgame' as const, label: t('game:controls.phaseEndgame') },
            ] as const,
        [t],
    );
    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(itemAfter), [itemAfter]);`,
    ],
    [`title="등급 강화 완료"`, `title={t('gradeUpgrade.completeTitle')}`],
    [`>이전</span>`, `>{t('gradeUpgrade.before')}</span>`],
    [`>이후</span>`, `>{t('gradeUpgrade.after')}</span>`],
    [
        `<span className="font-semibold text-slate-400">레벨업 추가능력치(랜덤)</span>`,
        `<span className="font-semibold text-slate-400">{t('gradeUpgrade.levelUpRandomBudget')}</span>`,
    ],
    [
        `<span className="text-[0.65rem] font-bold text-amber-100/95 sm:text-xs">바둑능력</span>`,
        `<span className="text-[0.65rem] font-bold text-amber-100/95 sm:text-xs">{t('profile:badukAbility')}</span>`,
    ],
    [`{PHASE_DEFS.map(({ phase, label }) => {`, `{phaseDefs.map(({ phase, label }) => {`],
    [`                                능력치 변화`, `                                {t('gradeUpgrade.statChanges')}`],
    [`                        확인`, `                        {tCommon('actions.confirm')}`],
]);

patch('components/pair/PairPetSoulConvertModal.tsx', [
    [
        "import React, { useMemo } from 'react';",
        "import React, { useMemo } from 'react';\nimport { useTranslation, Trans } from 'react-i18next';",
    ],
    [
        `}) => {
    const displayGrade = effectivePairPetGradeFromRow(item);`,
        `}) => {
    const { t } = useTranslation(['pair', 'common']);
    const { t: tCommon } = useTranslation('common');
    const displayGrade = effectivePairPetGradeFromRow(item);`,
    ],
    [`title="영혼변환"`, `title={t('soulConvert.title')}`],
    [`                    펫을 떠나 보냅니다`, `                    {t('soulConvert.farewell')}`],
    [
        `                        주의: 영혼변환은 취소하거나 복구할 수 없습니다.`,
        `                        {t('soulConvert.warningTitle')}`,
    ],
    [`                        <li>선택한 펫은 인벤토리에서 영구 삭제됩니다.</li>`, `<li>{t('soulConvert.warningDelete')}</li>`],
    [
        `<li>레벨, 경험치, 성향, 코어 보너스 정보가 모두 사라집니다.</li>`,
        `<li>{t('soulConvert.warningLoseProgress')}</li>`,
    ],
    [`<li>영혼변환 버튼을 누르면 즉시 변환됩니다.</li>`, `<li>{t('soulConvert.warningImmediate')}</li>`],
    [`<p className="text-center text-xs font-semibold text-violet-200/90 sm:text-sm">변환 시 지급</p>`, `<p className="text-center text-xs font-semibold text-violet-200/90 sm:text-sm">{t('soulConvert.rewardOnConvert')}</p>`],
    [
        `<span className="font-bold text-fuchsia-200">{preview.fixedQty}개</span>를 받습니다. (확정)`,
        `<Trans i18nKey="pair:soulConvert.fixedQty" values={{ qty: preview.fixedQty }} components={{ qty: <span className="font-bold text-fuchsia-200" /> }} />`,
    ],
    [
        `<span className="font-bold text-fuchsia-200">
                                        {preview.qtyMin}~{preview.qtyMax}개
                                    </span>
                                    를 무작위로 받습니다. 실제 개수는 변환 시 정해집니다.`,
        `<Trans
                                        i18nKey="pair:soulConvert.randomQty"
                                        values={{ min: preview.qtyMin, max: preview.qtyMax }}
                                        components={{
                                            range: (
                                                <span className="font-bold text-fuchsia-200" />
                                            ),
                                        }}
                                    />`,
    ],
    [`                        영혼변환`, `                        {t('soulConvert.title')}`],
    [`                        취소`, `                        {tCommon('actions.cancel')}`],
]);

console.log('done');
