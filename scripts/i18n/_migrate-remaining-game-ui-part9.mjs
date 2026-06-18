import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const w = (rel, content) => fs.writeFileSync(path.join(root, rel), content);

// GameSummaryModal bare JSX → gs() / i18n.t()
{
  let f = fs.readFileSync(path.join(root, 'components/GameSummaryModal.tsx'), 'utf8');
  const reps = [
    ['                최종 스코어\n            </p>', '                {gs(\'finalScoreLabel\')}\n            </p>'],
    ['                        흑\n                    </span>', '                        {i18n.t(\'game:black\')}\n                    </span>'],
    ['                        백\n                    </span>', '                        {i18n.t(\'game:white\')}\n                    </span>'],
    ['                    획득 집점수{\' \'}\n                    <span', '                    {gs(\'houseScoreGain\')}{\' \'}\n                    <span'],
    ['guildWarHouseScore.toFixed(1)}집', 'guildWarHouseScore.toFixed(1)}{gs(\'houseUnit\')}'],
    ['{blackPlayer.nickname} 승리!', '{gs(\'playerWins\', { name: blackPlayer.nickname })}'],
    ['{whitePlayer.nickname} 승리!', '{gs(\'playerWins\', { name: whitePlayer.nickname })}'],
    ['                    라운드별 점수\n                </p>', '                    {gs(\'roundScores\')}\n                </p>'],
    ['                            라운드\n                        </span>', '                            {gs(\'round\')}\n                        </span>'],
    ['                            라운드 점수 (흑:백)\n                        </span>', '                            {gs(\'roundScoreBlackWhite\')}\n                        </span>'],
    ['                                        라운드\n                                    </th>', '                                        {gs(\'round\')}\n                                    </th>'],
    ['                                        하우스\n                                    </th>', '                                        {gs(\'house\')}\n                                    </th>'],
    ['                                        넉아웃\n                                    </th>', '                                        {gs(\'knockout\')}\n                                    </th>'],
    ['                    라운드별 결과\n                </p>', '                    {gs(\'roundResults\')}\n                </p>'],
    ['                                            라운드\n                                        </th>', '                                            {gs(\'round\')}\n                                        </th>'],
    ['                                            득점\n                                        </th>', '                                            {gs(\'scored\')}\n                                        </th>'],
    ['                                            실점\n                                        </th>', '                                            {gs(\'conceded\')}\n                                        </th>'],
    ['                    별 달성 조건\n                </p>', '                    {gs(\'starConditions\')}\n                </p>'],
    ['                        보상 정보가 없습니다.\n                    </p>', '                        {gs(\'noRewardInfo\')}\n                    </p>'],
    ['                        보상이 없습니다.\n                    </p>', '                        {gs(\'noRewardsEmpty\')}\n                    </p>'],
    ['<p className={statLabelClass}>랭킹 점수</p>', '<p className={statLabelClass}>{gs(\'rankingScore\')}</p>'],
    ['<p className={statLabelClass}>매너 점수</p>', '<p className={statLabelClass}>{gs(\'mannerScore\')}</p>'],
    ['<p className={statLabelClass}>통산 전적</p>', '<p className={statLabelClass}>{gs(\'overallRecord\')}</p>'],
    ['<p className={statLabelClass}>매너 등급</p>', '<p className={statLabelClass}>{gs(\'mannerRank\')}</p>'],
    ["session.description.startsWith('챔피언십 장내 카타:')", 'isChampionshipVersusKataSummaryDescription(session.description)'],
  ];
  for (const [a, b] of reps) f = f.replaceAll(a, b);
  if (!f.includes('isChampionshipVersusKataSummaryDescription')) {
    f = f.replace(
      "import { translateGameMode } from '../shared/i18n/localizedCatalog.js';",
      "import { translateGameMode } from '../shared/i18n/localizedCatalog.js';\nimport { isChampionshipVersusKataSummaryDescription } from '../shared/constants/championshipVersusSummary.js';",
    );
  }
  // points delta "점" in stat grid
  f = f.replace(/\n\s+점\n/g, '\n                                                                    {gs(\'pointsDelta\')}\n');
  w('components/GameSummaryModal.tsx', f);
}

// Game.tsx
{
  let f = fs.readFileSync(path.join(root, 'Game.tsx'), 'utf8');
  if (!f.includes('AlkkagiPlacementType')) {
    f = f.replace(
      /from '\.\/types\.js';/,
      "from './types.js';\nimport { AlkkagiPlacementType } from './shared/types/enums.js';",
    );
  }
  if (!f.includes('shouldSuppressKoPlaceStoneClientError')) {
    f = f.replace(
      /import \{ AlkkagiPlacementType \} from '\.\/shared\/types\/enums\.js';/,
      "import { AlkkagiPlacementType } from './shared/types/enums.js';\nimport { shouldSuppressKoPlaceStoneClientError, isGameAlreadyStartedError } from './shared/utils/serverErrorMatch.js';",
    );
  }
  f = f.replace(
    "session.settings.alkkagiPlacementType === '일괄 배치'",
    'session.settings.alkkagiPlacementType === AlkkagiPlacementType.Simultaneous',
  );
  f = f.replace(
    /err\.includes\('패 모양'\) \|\| err\.includes\('코 금지'\) \|\| \(err\.includes\('바로'\) && err\.includes\('따낼'\)\)/g,
    'shouldSuppressKoPlaceStoneClientError(err)',
  );
  f = f.replace(
    "typeof err === 'string' && err.includes('이미 시작')",
    "typeof err === 'string' && isGameAlreadyStartedError(err)",
  );
  w('Game.tsx', f);
}

// buildChampionshipVersusKataSummarySession
{
  let f = fs.readFileSync(path.join(root, 'utils/buildChampionshipVersusKataSummarySession.ts'), 'utf8');
  if (!f.includes('CHAMPIONSHIP_VERSUS_KATA_SUMMARY_DESCRIPTION_PREFIX')) {
    f = f.replace(
      "import { GameCategory, GameMode, Player } from '../types.js';",
      "import { GameCategory, GameMode, Player } from '../types.js';\nimport { CHAMPIONSHIP_VERSUS_KATA_SUMMARY_DESCRIPTION_PREFIX } from '../shared/constants/championshipVersusSummary.js';",
    );
    f = f.replace(
      'description: `챔피언십 장내 카타:${venue}`',
      'description: `${CHAMPIONSHIP_VERSUS_KATA_SUMMARY_DESCRIPTION_PREFIX}${venue}`',
    );
  }
  w('utils/buildChampionshipVersusKataSummarySession.ts', f);
}

// Sidebar
{
  let f = fs.readFileSync(path.join(root, 'components/game/Sidebar.tsx'), 'utf8');
  f = f.replace(
    "msg.user.nickname === 'AI 보안관봇'",
    "msg.user.nickname === t('sidebar.securityBot')",
  );
  f = f.replace(
    '<h3 className={arenaGameRoomAdminTitleClass}>관리자 기능</h3>',
    '<h3 className={arenaGameRoomAdminTitleClass}>{t(\'controls.adminFeatures\')}</h3>',
  );
  f = f.replace(
    '{session.player2?.nickname} 기권승',
    "{t('sidebar.adminForceResignWin', { name: session.player2?.nickname })}",
  );
  f = f.replace(
    '{session.player1?.nickname} 기권승',
    "{t('sidebar.adminForceResignWin', { name: session.player1?.nickname })}",
  );
  w('components/game/Sidebar.tsx', f);
}

// SinglePlayerSidebar
{
  let f = fs.readFileSync(path.join(root, 'components/game/SinglePlayerSidebar.tsx'), 'utf8');
  f = f.replace(
    ": (pauseButtonCooldown > 0 ? `일시 정지 (${pauseButtonCooldown})` : '일시 정지')}",
    ': (pauseButtonCooldown > 0 ? tx("game:controls.pauseGameCountdown", { count: pauseButtonCooldown }) : tx("game:controls.pauseGame"))}',
  );
  w('components/game/SinglePlayerSidebar.tsx', f);
}

// SpResultRecordSideBySidePanel
{
  let f = fs.readFileSync(path.join(root, 'components/game/SpResultRecordSideBySidePanel.tsx'), 'utf8');
  f = f.replace('                                펫 등급강화 필요', '                                {tx("game:resultModal.petGradeUpgradeNeeded")}');
  f = f.replace(
    /tx\('game:towerSummary\.petXp'[^)]+\)[^,]+,/,
    "tx('game:resultModal.petXpLabel'),",
  );
  w('components/game/SpResultRecordSideBySidePanel.tsx', f);
}

// DungeonStageSummaryModal
{
  let f = fs.readFileSync(path.join(root, 'components/DungeonStageSummaryModal.tsx'), 'utf8');
  if (!f.includes('useTranslation')) {
    f = f.replace(
      "import { useGameResultModalLayout } from './game/useGameResultModalLayout.js';",
      "import { useGameResultModalLayout } from './game/useGameResultModalLayout.js';\nimport { useTranslation } from 'react-i18next';\nimport { tx } from '../shared/i18n/runtimeText.js';\nimport {\n    DUNGEON_MATERIAL_BOX_SERVER_IDS,\n    DUNGEON_GOLD_REWARD_NAME_MARKER,\n    DUNGEON_DIAMOND_REWARD_NAME_MARKER,\n} from '../shared/constants/dungeonRewardServerIds.js';",
    );
    f = f.replace(
      '}) => {\n    const isCompactViewport',
      '}) => {\n    const { t } = useTranslation(\'game\');\n    const isCompactViewport',
    );
  }
  f = f.replace(
    `                const nameMappings: Record<string, string> = {
                    '재료 상자1': t('dungeonSummary.materialBox1'), '재료 상자2': t('dungeonSummary.materialBox2'), '재료 상자3': t('dungeonSummary.materialBox3'),
                    '재료 상자4': t('dungeonSummary.materialBox4'), '재료 상자5': t('dungeonSummary.materialBox5'), '재료 상자6': t('dungeonSummary.materialBox6'),
                    '재료상자1': t('dungeonSummary.materialBox1'), '재료상자2': t('dungeonSummary.materialBox2'), '재료상자3': t('dungeonSummary.materialBox3'),
                    '재료상자4': t('dungeonSummary.materialBox4'), '재료상자5': t('dungeonSummary.materialBox5'), '재료상자6': t('dungeonSummary.materialBox6'),
                };
                const mappedName = nameMappings[itemName];`,
    `                const i18nKey = DUNGEON_MATERIAL_BOX_SERVER_IDS[itemName];
                const mappedName = i18nKey ? t(\`dungeonSummary.\${i18nKey}\`) : undefined;`,
  );
  f = f.replace(
    "itemName.includes('골드')",
    `itemName.includes(DUNGEON_GOLD_REWARD_NAME_MARKER)`,
  );
  f = f.replace(
    "itemName.includes('다이아')",
    `itemName.includes(DUNGEON_DIAMOND_REWARD_NAME_MARKER)`,
  );
  f = f.replace(
    '                            다음 {nextStage}단계',
    "                            {t('dungeonSummary.nextStage', { stage: nextStage })}",
  );
  f = f.replace(
    '                                        보상 내역\n                                    </h3>',
    '                                        {t("dungeonSummary.rewardsTitle")}\n                                    </h3>',
  );
  f = f.replace(/\n\s+확인\n\s+<\/Button>/g, '\n                                    {t("summary.confirm")}\n                                </Button>');
  w('components/DungeonStageSummaryModal.tsx', f);
}

console.log('Part 9 done');
