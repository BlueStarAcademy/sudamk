import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const rp = (rel, pairs) => { let f=fs.readFileSync(path.join(root,rel),'utf8'); for(const [a,b] of pairs) f=f.replaceAll(a,b); fs.writeFileSync(path.join(root,rel),f); };
const txImport = (f) => f.includes('runtimeText') ? f : f.replace('import React', "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");

const pauseResume = [
  ['? `대국 재개 (${resumeCountdown})`\n                                : \'대국 재개\'', '? tx("game:controls.resumeGameCountdown", { count: resumeCountdown })\n                                : tx("game:controls.resumeGame")'],
  ['? `일시 정지 (${pauseButtonCooldown})`\n                              : \'일시 정지\'', '? tx("game:controls.pauseGameCountdown", { count: pauseButtonCooldown })\n                              : tx("game:controls.pauseGame")'],
  ['? (resumeCountdown > 0 ? `대국 재개 (${resumeCountdown})` : \'대국 재개\')', '? (resumeCountdown > 0 ? tx("game:controls.resumeGameCountdown", { count: resumeCountdown }) : tx("game:controls.resumeGame"))'],
  ['? (pauseButtonCooldown > 0 ? `일시 정지 (${pauseButtonCooldown})` : \'일시 정지\')', '? (pauseButtonCooldown > 0 ? tx("game:controls.pauseGameCountdown", { count: pauseButtonCooldown }) : tx("game:controls.pauseGame"))'],
];

for (const file of ['components/game/GuildWarTowerSidebar.tsx', 'components/game/SinglePlayerSidebar.tsx']) {
  let f = fs.readFileSync(path.join(root, file), 'utf8');
  f = txImport(f);
  for (const [a,b] of pauseResume) f = f.replaceAll(a,b);
  fs.writeFileSync(path.join(root, file), f);
}

rp('components/game/ArenaRightSidebarCollapseToggle.tsx', [
  ["const expandLabel = '사이드바 펼치기';", "const expandLabel = tx('game:sidebar.expand');"],
  ["const collapseLabel = '사이드바 접기';", "const collapseLabel = tx('game:sidebar.collapse');"],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/ArenaRightSidebarCollapseToggle.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/ArenaRightSidebarCollapseToggle.tsx'), txImport(f)); }

rp('components/game/arenaRoundEndShared.tsx', [
  ["title={color === 'black' ? '흑' : '백'}", "title={color === 'black' ? tx('game:black') : tx('game:white')}"],
  ['>누적 점수</p>', '>{tx("game:summary.cumulativeScore")}</p>'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/arenaRoundEndShared.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/arenaRoundEndShared.tsx'), txImport(f)); }

rp('components/game/DraggableMoveConfirmPanel.tsx', [
  ['aria-label="착수 패널 드래그로 위치 조절"', 'aria-label={tx("game:moveConfirm.dragAria")}'],
  ['title="드래그하여 위치 조절"', 'title={tx("game:moveConfirm.dragTitle")}'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/DraggableMoveConfirmPanel.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/DraggableMoveConfirmPanel.tsx'), txImport(f)); }

rp('components/game/ItemObtainModalShared.tsx', [
  ["regionAriaLabel = '획득 아이템'", 'regionAriaLabel = tx("game:itemObtain.regionAria")'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/ItemObtainModalShared.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/ItemObtainModalShared.tsx'), txImport(f)); }

rp('components/game/MatchPlayGuideModal.tsx', [
  ['title="경기방법"', 'title={tx("game:sidebar.howToPlay")}'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/MatchPlayGuideModal.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/MatchPlayGuideModal.tsx'), txImport(f)); }

rp('components/game/MobileGameResultTabBar.tsx', [
  ["matchLabel = '경기 내용'", 'matchLabel = tx("game:summary.gameContent")'],
  ["recordLabel = '대국 결과'", 'recordLabel = tx("game:summary.resultSection")'],
  ['aria-label="결과 탭"', 'aria-label={tx("game:mobileResultTab.aria")}'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/MobileGameResultTabBar.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/MobileGameResultTabBar.tsx'), txImport(f)); }

rp('components/game/ResultModalVipRewardSlot.tsx', [
  ['aria-label="VIP 전용 보상 — 상점에서 보상 VIP를 확인하세요"', 'aria-label={tx("game:resultModal.vipRewardAria")}'],
  ["{rouletteActive ? '룰렛 보상 선택 중...'", '{rouletteActive ? tx("game:resultModal.rouletteSelecting")'],
  ['>보상 VIP</span>', '>{tx("game:resultModal.rewardVip")}</span>'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/ResultModalVipRewardSlot.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/ResultModalVipRewardSlot.tsx'), txImport(f)); }

rp('components/game/SpeedTenSecPressureBar.tsx', [
  ['aria-label={`수당 시간 ${secToNextDrop}초`}', 'aria-label={tx("game:speedPressure.aria", { sec: secToNextDrop })}'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/SpeedTenSecPressureBar.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/SpeedTenSecPressureBar.tsx'), txImport(f)); }

rp('components/game/SpResultRecordPetIdentityRow.tsx', [
  ['>펫</div>', '>{tx("game:resultModal.petShort")}</div>'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/SpResultRecordPetIdentityRow.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/SpResultRecordPetIdentityRow.tsx'), txImport(f)); }

rp('components/game/SpResultRecordSideBySidePanel.tsx', [
  ["'펫 XP'", "tx('game:towerSummary.petXp', { current: '', max: '' }).replace(' /  펫 XP',' XP').replace(/\\d+/g,'').trim() || tx('game:resultModal.petShort') + ' XP'"],
]);
// simpler fix for pet XP
{
  let f = fs.readFileSync(path.join(root,'components/game/SpResultRecordSideBySidePanel.tsx'),'utf8');
  f = txImport(f);
  f = f.replace("'펫 XP'", "tx('game:resultModal.petXpLabel')");
  f = f.replace('title="추가된 능력치"', 'title={tx("game:summary.addedStats")}');
  fs.writeFileSync(path.join(root,'components/game/SpResultRecordSideBySidePanel.tsx'), f);
}

rp('components/game/adventureResultModalSections.tsx', [
  ["c.name === '장비 상자 I'", "c.name === tx('game:dungeonSummary.equipmentBox1')"],
  ["c.name === '재료 상자 I'", "c.name === tx('game:dungeonSummary.materialBox1')"],
  ['lines.push(`보스: ${adventureCodexPercentBossBonusLabelKo(bossBonus)} +${pct}%`)', 'lines.push(tx("game:adventureResult.bossLine", { label: adventureCodexPercentBossBonusLabelKo(bossBonus), pct }))'],
  ['`모험: ${adventureCodexNormalPercentLabelKo(design.normalPercentBonus.kind)} +${specPct}%`', 'tx("game:adventureResult.adventureLine", { label: adventureCodexNormalPercentLabelKo(design.normalPercentBonus.kind), pct: specPct })'],
]);
{ let f=fs.readFileSync(path.join(root,'components/game/adventureResultModalSections.tsx'),'utf8'); if(!f.includes('runtimeText')) fs.writeFileSync(path.join(root,'components/game/adventureResultModalSections.tsx'), txImport(f)); }

console.log('Part 8 done');
