import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const targets = [
  'components/blacksmith', 'components/modals', 'components/championship', 'components/gameRecord',
  'components/shell', 'components/quick-panel', 'components/adventure/AdventureLobby.tsx',
  'components/TournamentLobby.tsx', 'components/GuideModal.tsx', 'components/AppModalLayer.tsx',
  'components/QuickAccessSidebar.tsx', 'components/MbtiComparisonModal.tsx', 'components/MannerGradeChangeModal.tsx',
  'components/StatAllocationModal.tsx', 'components/DetailedStatsModal.tsx', 'components/ContentUnlockNoticeModal.tsx',
  'components/HomeBoardPanel.tsx', 'components/EquipmentEffectsModal.tsx', 'components/ItemDetailModal.tsx',
  'components/PurchaseQuantityModal.tsx', 'components/UseQuantityModal.tsx', 'components/SellMaterialBulkModal.tsx',
  'components/SellItemConfirmModal.tsx', 'components/ItemObtainedModal.tsx', 'components/BulkItemObtainedModal.tsx',
  'components/ClaimAllSummaryModal.tsx', 'components/RewardSummaryModal.tsx', 'components/DisassemblyResultModal.tsx',
  'components/LevelUpCelebrationModal.tsx', 'components/TierInfoModal.tsx', 'components/LeagueTierInfoModal.tsx',
  'components/ChampionshipVenueEntryModal.tsx', 'components/ChampionshipHelpModal.tsx', 'components/SimulationArenaHelpModal.tsx',
  'components/RankingQuickModal.tsx', 'components/ChatQuickModal.tsx', 'components/PreGameColorRoulette.tsx',
  'components/CaptureBidModal.tsx', 'components/CaptureTiebreakerModal.tsx', 'components/BaseStoneColorChoicePanel.tsx',
  'components/UniformColorRouletteModal.tsx', 'components/ConditionPotionModal.tsx', 'components/CurlingStartConfirmationModal.tsx',
  'components/AlkkagiStartConfirmationModal.tsx', 'components/BaseStartConfirmationModal.tsx', 'components/DiceGoStartConfirmationModal.tsx',
  'components/ThiefRoleConfirmedModal.tsx', 'components/PairArenaDetailedStatsModal.tsx', 'components/PairTurnOrderModal.tsx',
  'components/PairPetObtainedModal.tsx', 'components/PetManagementModal.tsx', 'components/NigiriModal.tsx',
  'components/StageSelectionModal.tsx', 'components/SinglePlayerGameDescriptionModal.tsx', 'components/TowerItemShopModal.tsx',
  'components/RPSMinigame.tsx', 'components/DiceGoTurnSelectionModal.tsx', 'components/TurnPreferenceSelection.tsx',
  'components/TurnPreferenceRouletteModal.tsx', 'components/ThiefDeathmatchRoleRouletteModal.tsx', 'components/GameApplicationModal.tsx',
  'components/ColorAssignmentStickyFooter.tsx', 'components/ColorStartConfirmationModal.tsx', 'components/DetailedStatsResetConfirmModal.tsx',
  'components/EquipmentDetailPanel.tsx', 'components/HomeNativeMergedEquipmentAbilityPanel.tsx', 'components/CurlingBoard.tsx',
  'components/AlkkagiBoard.tsx', 'components/AlkkagiRoundSummary.tsx', 'components/CurlingRoundSummary.tsx', 'components/DiceRoundSummary.tsx',
  'components/ThiefRoundSummary.tsx', 'components/PointsInfoPanel.tsx', 'components/CoreStatsHexagonChart.tsx',
  'components/ChampionshipRankingPanel.tsx', 'components/ChampionshipVersusDuelHistoryModal.tsx', 'components/Button.tsx',
  'components/MythicSubsPartitioned.tsx', 'components/AnnouncementsModal.tsx', 'components/MbtiInfoModal.tsx',
  'components/MannerRankModal.tsx', 'components/GameRecordListModal.tsx', 'components/GameRecordViewerModal.tsx',
];

function collectFiles(p) {
  const full = path.join(root, p);
  if (fs.existsSync(full) && full.endsWith('.tsx')) return [p.replace(/\\/g, '/')];
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { recursive: true })
    .filter((f) => String(f).endsWith('.tsx'))
    .map((f) => path.join(p, String(f)).replace(/\\/g, '/'));
}

const ko = /[\uAC00-\uD7A3]/;
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

for (const t of targets) {
  for (const f of collectFiles(t)) {
    if (f.includes('components/admin/')) continue;
    const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
    const hits = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**') || trimmed.startsWith('/*'))
        return;
      if (ko.test(line) && strKo.test(line)) hits.push(`${i + 1}: ${line.trim().slice(0, 140)}`);
    });
    if (hits.length) {
      console.log(`=== ${f} (${hits.length}) ===`);
      hits.forEach((h) => console.log(h));
    }
  }
}
