import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const w = (r,c) => fs.writeFileSync(path.join(root,r),c);
const r = (p) => fs.readFileSync(path.join(root,p),'utf8');

// TowerSidebar, GuildWarTowerSidebar
for (const [file, titleKey] of [
  ['components/game/TowerSidebar.tsx', 'towerSidebar.title'],
  ['components/game/GuildWarTowerSidebar.tsx', 'guildWarSidebar.title'],
]) {
  let f = r(file);
  if (!f.includes('runtimeText')) f = f.replace('import React', "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
  f = f.replace('>도전의 탑</p>', '>{tx("game:towerSidebar.title")}</p>');
  f = f.replace('>길드 전쟁</p>', '>{tx("game:guildWarSidebar.title")}</p>');
  f = f.replace('{floor}층</p>', '{tx("game:towerSidebar.floor", { floor })}</p>');
  f = f.replace(": '길드 전쟁'", ': tx("game:guildWarSidebar.title")');
  f = f.replace(/\? `대국 재개 \(\$\{resumeCountdown\}\)` : '대국 재개'/g, '? tx("game:controls.resumeGameCountdown", { count: resumeCountdown }) : tx("game:controls.resumeGame")');
  f = f.replace(/\? `일시 정지 \(\$\{pauseButtonCooldown\}\)` : '일시 정지'/g, '? tx("game:controls.pauseGameCountdown", { count: pauseButtonCooldown }) : tx("game:controls.pauseGame")');
  w(file, f);
}

// GameModals
{
  let f = r('components/game/GameModals.tsx');
  if (!f.includes('runtimeText')) f = f.replace('import React', "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
  f = f.replace("title: '기권 확인'", "title: tx('game:gameModals.resignConfirmTitle')");
  f = f.replace("lead: '경기를 포기하시겠습니까?'", "lead: tx('game:gameModals.resignConfirmLead')");
  f = f.replace("detail: '대국이 즉시 종료되며 기권패로 처리됩니다.'", "detail: tx('game:gameModals.resignConfirmDetail')");
  f = f.replace("confirmText: '기권'", "confirmText: tx('game:gameModals.resignConfirmButton')");
  w('components/game/GameModals.tsx', f);
}

// ResultModalRewardSlot
{
  let f = r('components/game/ResultModalRewardSlot.tsx');
  if (!f.includes('runtimeText')) f = f.replace('import React', "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
  f = f.replace("raw.includes('골드꾸러미') ? raw.replace(/골드꾸러미/g, '골드 꾸러미') : raw", "raw.includes(tx('game:summary.goldBundleCompact')) ? raw.replace(new RegExp(tx('game:summary.goldBundleCompact'), 'g'), tx('game:summary.goldBundleSpaced')) : raw");
  f = f.replace(
    '? `획득 골드 합계 ${formatGoldAmountKoG(amount + bonus)} (기본 ${formatGoldAmountKoG(amount)}, 특화 +${formatGoldAmountKoG(bonus)})`',
    '? tx("game:resultModalGold.totalTitle", { total: formatGoldAmountKoG(amount + bonus), base: formatGoldAmountKoG(amount), bonus: formatGoldAmountKoG(bonus) })',
  );
  f = f.replace('? `획득 골드 ${formatGoldAmountKoG(amount)}`', '? tx("game:resultModalGold.earnedTitle", { amount: formatGoldAmountKoG(amount) })');
  f = f.replace('? `골드 ${formatGoldAmountKoG(amount)} (모험 이해도·효과 +${formatGoldAmountKoG(bonus)})`', '? tx("game:resultModalGold.withBonusTitle", { amount: formatGoldAmountKoG(amount), bonus: formatGoldAmountKoG(bonus) })');
  f = f.replace(': `골드 ${formatGoldAmountKoG(amount)}`', ': tx("game:resultModalGold.plainTitle", { amount: formatGoldAmountKoG(amount) })');
  w('components/game/ResultModalRewardSlot.tsx', f);
}

console.log('Part 7 done');
