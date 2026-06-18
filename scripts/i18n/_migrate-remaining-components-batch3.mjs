/**
 * Batch 3: TournamentLobby + OpponentInsufficientAP + GuideModal title
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
function readFile(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function writeFile(rel, c) { fs.writeFileSync(path.join(root, rel), c, 'utf8'); }

function patchTournamentLobby(c) {
  if (!c.includes('react-i18next')) {
    c = "import { useTranslation } from 'react-i18next';\n" + c;
  }
  // Sub-components: inject hook after each FC declaration that has Korean
  const injectHook = (src, marker, hook = "    const { t } = useTranslation('tournament');\n") => {
    if (src.includes(marker) && !src.slice(src.indexOf(marker), src.indexOf(marker) + 200).includes('useTranslation')) {
      return src.replace(marker, marker + '\n' + hook);
    }
    return src;
  };

  c = injectHook(c, 'const DungeonStageSelector: React.FC<{ dungeonType: TournamentType; currentUser: UserWithStatus; onSelectStage: (stage: number) => void }> = ({ dungeonType, currentUser, onSelectStage }) => {');
  c = injectHook(c, 'const WeeklyCompetitorsPanel: React.FC<{ currentUser: UserWithStatus }> = ({ currentUser }) => {');
  c = injectHook(c, 'const TournamentLobby: React.FC = () => {');

  c = c.replace(
    '{TOURNAMENT_DEFINITIONS[dungeonType].name} 단계 선택',
    "{t('lobby.stageSelect', { name: TOURNAMENT_DEFINITIONS[dungeonType].name })}",
  );
  c = c.replace('<div className="font-bold text-lg">{stage}단계</div>', "<div className=\"font-bold text-lg\">{t('lobby.stageUnit', { stage })}</div>");
  c = c.replace('✓ 클리어', "{t('lobby.cleared')}");

  c = c.replace('주간 경쟁 상대 정보를 불러오는 중...', "{t('lobby.loadingCompetitors')}");
  c = c.replace('이번주 경쟁 상대', "{t('lobby.weeklyCompetitors')}");
  c = c.replace("competitor.scoreChange > 0 ? '▲' : competitor.scoreChange < 0 ? '▼' : '변화없음'", "competitor.scoreChange > 0 ? '▲' : competitor.scoreChange < 0 ? '▼' : t('lobby.noChange')");
  c = c.replace('`${competitor.nickname} 프로필 보기`', "t('lobby.viewProfile', { name: competitor.nickname })");
  c = c.replace('`${user.nickname} 프로필 보기`', "t('lobby.viewProfile', { name: user.nickname })");
  c = c.replace('{score.toLocaleString()}점', "t('lobby.scorePoints', { score: score.toLocaleString() })");

  c = c.replace(/시즌 전적\{' '\}/g, "{t('lobby.seasonRecord')}{' '}");
  c = c.replace(/\{wins\}승 \{losses\}패/g, "{t('recordWinsLosses', { wins, losses })}");

  c = c.replace("hasResultToView ? '결과 보기' : hasUnclaimedReward ? '보상 완료' : '참가 가능'", "hasResultToView ? t('lobby.participationViewResult') : hasUnclaimedReward ? t('lobby.participationReward') : t('lobby.participationAvailable')");
  c = c.replace('aria-label={`${definition.name} 입장 및 보상 안내`}', "aria-label={t('lobby.enterAndRewardAria', { name: definition.name })}");
  c = c.replace('aria-label={`참가 상태: ${participationBadge}`}', "aria-label={t('lobby.participationStatusAria', { status: participationBadge })}");
  c = c.replace('>최고 단계<', ">{t('lobby.highestStage')}<");
  c = c.replace('>추천 단계<', ">{t('lobby.recommendedStage')}<");
  c = c.replace('`${dungeonProgress.currentStage}단계`', "t('lobby.stageUnit', { stage: dungeonProgress.currentStage })");
  c = c.replace('`${recommendedDungeonStage}단계`', "t('lobby.stageUnit', { stage: recommendedDungeonStage })");
  c = c.replace("'✓ 완료'", "t('lobby.completed')");
  c = c.replace("'진행중'", "t('lobby.inProgress')");
  c = c.replace('>최고 {dungeonProgress.currentStage}단계<', ">{t('lobby.highestStageShort', { stage: dungeonProgress.currentStage })}<");
  c = c.replace('최고 {dungeonProgress.currentStage}단계', "{t('lobby.highestStageShort', { stage: dungeonProgress.currentStage })}");

  c = c.replace('로비 정보를 불러오는 중...', "{t('lobby.loadingLobby')}");
  c = c.replace('aria-label="프로필로 돌아가기"', "aria-label={t('lobby.backToProfileAria')}");
  c = c.replace('>챔피언십<', ">{t('lobby.title')}<");
  c = c.replace('>대전정보<', ">{t('lobby.duelInfo')}<");
  c = c.replace('aria-label="챔피언십 구역"', "aria-label={t('lobby.championshipZoneAria')}");
  c = c.replace('>능력치<', ">{t('lobby.statsTab')}<");
  c = c.replace('>경기장<', ">{t('lobby.arenaTab')}<");
  c = c.replace('title="챔피언십 상점"', "title={t('lobby.shopTab')}");
  c = c.replace('>챔피언십 상점<', ">{t('lobby.shopTab')}<");
  c = c.replace("? '능력치'", "? t('lobby.statsTab')");
  c = c.replace("? '경기장'", "? t('lobby.arenaTab')");
  c = c.replace(": '챔피언십 상점'", ": t('lobby.shopTab')");
  c = c.replace('aria-label="챔피언십 상점"', "aria-label={t('lobby.shopAria')}");
  c = c.replace('title="챔프 코인"', "title={t('lobby.champCoin')}");
  c = c.replace('alt="챔프 코인"', "alt={t('lobby.champCoin')}");
  c = c.replace('aria-label="능력치 패널"', "aria-label={t('lobby.statsPanelAria')}");
  c = c.replace('>유저<', ">{t('lobby.userTab')}<");
  c = c.replace('>펫<', ">{t('lobby.petTab')}<");
  c = c.replace('aria-label="퀵 메뉴"', "aria-label={t('lobby.quickMenuAria')}");
  c = c.replace('handlers.applyPreset({ name: `프리셋 ${presetIndex + 1}`, equipment: {} });', "handlers.applyPreset({ name: t('lobby.presetName', { index: presetIndex + 1 }), equipment: {} });");

  return c;
}

let c = readFile('components/TournamentLobby.tsx');
const next = patchTournamentLobby(c);
if (next !== c) {
  writeFile('components/TournamentLobby.tsx', next);
  console.log('Patched TournamentLobby.tsx');
}

// OpponentInsufficientActionPointsModal
c = readFile('components/OpponentInsufficientActionPointsModal.tsx');
if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
if (!c.includes('useTranslation')) {
  c = c.replace(
    'const OpponentInsufficientActionPointsModal',
    "const OpponentInsufficientActionPointsModal",
  );
  c = c.replace(
    /const OpponentInsufficientActionPointsModal[^=]+= \(\{([^}]+)\}\) => \{/,
    (m) => m + "\n    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');",
  );
}
// read file to see strings
const oppPath = path.join(root, 'components/OpponentInsufficientActionPointsModal.tsx');
if (fs.existsSync(oppPath)) {
  let opp = readFile('components/OpponentInsufficientActionPointsModal.tsx');
  if (!opp.includes('react-i18next')) opp = "import { useTranslation } from 'react-i18next';\n" + opp;
  if (!opp.includes("useTranslation('game')")) {
    opp = opp.replace(
      '}) => {\n    const { isNativeMobile',
      "}) => {\n    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n    const { isNativeMobile",
    );
  }
  // Add opponent keys if needed - grep for Korean
  opp = opp.replace(/title="[^"]*행동력[^"]*"/g, "title={t('modals.insufficientAp.opponentTitle')}");
  opp = opp.replace('>닫기<', ">{tCommon('actions.close')}<");
  opp = opp.replace('aria-label="닫기"', "aria-label={tCommon('actions.close')}");
  writeFile('components/OpponentInsufficientActionPointsModal.tsx', opp);
  console.log('Patched OpponentInsufficientActionPointsModal.tsx');
}

// InfoModal already done. GuideModal - check title prop
c = readFile('components/GuideModal.tsx');
if (c.includes('도움말') && !c.includes('useTranslation')) {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  console.log('GuideModal needs manual review');
}

console.log('Batch 3 done');
