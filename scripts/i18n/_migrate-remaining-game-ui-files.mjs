/**
 * Patch remaining game UI files to use i18n keys.
 * Run after: node scripts/i18n/_migrate-remaining-game-ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(root, rel), c, 'utf8'); }
function rp(rel, pairs) {
  let f = read(rel);
  for (const [a, b] of pairs) f = f.replaceAll(a, b);
  write(rel, f);
}
function ensureImport(f, line) {
  if (f.includes(line.trim())) return f;
  const i = f.indexOf('\n');
  return f.slice(0, i + 1) + line + f.slice(i + 1);
}
function ensureHook(f, marker, hook) {
  if (f.includes(hook.trim())) return f;
  const idx = f.indexOf(marker);
  if (idx < 0) return f;
  const brace = f.indexOf('{', idx);
  const nl = f.indexOf('\n', brace);
  return f.slice(0, nl + 1) + hook + f.slice(nl + 1);
}

// --- SinglePlayerSummaryModal ---
{
  let f = read('components/SinglePlayerSummaryModal.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureHook(f, 'const SinglePlayerSummaryModal: React.FC', "    const { t } = useTranslation('game');\n");
  f = ensureHook(f, 'const ScoreDetailsPanel: React.FC', "    const { t } = useTranslation('game');\n");
  const p = [
    ['>점수 정보가 없습니다.</p>', ">{t('summary.noScoreInfo')}</p>"],
    ['>흑</h3>', ">{t('black')}</h3>"],
    ['>백</h3>', ">{t('white')}</h3>"],
    ['>영토:</span>', ">{t('summary.territory')}:</span>"],
    ['>따낸 돌:</span>', ">{t('summary.captures')}:</span>"],
    ['>사석:</span>', ">{t('summary.deadStones')}:</span>"],
    ['>덤:</span>', ">{t('summary.komi')}:</span>"],
    ['>총점:</span>', ">{t('summary.total')}:</span>"],
    ["return '제한 턴이 부족하여 미션에 실패했습니다.'", "return t('singlePlayerSummary.failTurnLimit')"],
    ["return '제한시간이 초과되어 미션에 실패했습니다.'", "return t('singlePlayerSummary.failTimeLimit')"],
    ["? '백이 정해진 턴을 모두 버텨 미션에 실패했습니다.'\n                    : '상대가 목표 점수를 먼저 달성했습니다.'", "? t('singlePlayerSummary.failSurvival')\n                    : t('singlePlayerSummary.failCaptureTarget')"],
    ["return '계가 결과 상대가 더 많은 집을 차지했습니다.'", "return t('singlePlayerSummary.failScoring')"],
    ["return '기권하셨습니다.'", "return t('singlePlayerSummary.failResign')"],
    ["return '연결이 끊어져 미션이 실패 처리되었습니다.'", "return t('singlePlayerSummary.failDisconnect')"],
    ["return '총 점수 합계에서 상대에게 밀렸습니다.'", "return t('singlePlayerSummary.failTotalScore')"],
    ["return '주사위 점수에서 뒤처졌습니다.'", "return t('singlePlayerSummary.failDice')"],
    ["return '반칙 한도를 초과했습니다.'", "return t('singlePlayerSummary.failFoul')"],
    ["return '도둑 돌이 모두 잡혔습니다.'", "return t('singlePlayerSummary.failThiefCaught')"],
    ["return '경찰이 더 많은 점수를 획득했습니다.'", "return t('singlePlayerSummary.failPoliceScore')"],
    ["return '상대가 먼저 다섯 줄을 완성했습니다.'", "return t('singlePlayerSummary.failOmok')"],
    ["return '알까기 승부에서 뒤졌습니다.'", "return t('singlePlayerSummary.failAlkkagi')"],
    ["return '컬링 총점에서 상대에게 뒤졌습니다.'", "return t('singlePlayerSummary.failCurling')"],
    ["? '제한 턴만큼 점수를 잘 지켜냈습니다.'\n                    : '목표 점수를 달성했습니다.'", "? t('singlePlayerSummary.winSurvival')\n                    : t('singlePlayerSummary.winCaptureTarget')"],
    ["return '계가 결과 승리했습니다.'", "return t('singlePlayerSummary.winScoring')"],
    ["return '시간초과 시간패입니다.'", "return t('singlePlayerSummary.winTime')"],
    ["return '상대방이 기권했습니다.'", "return t('singlePlayerSummary.winResign')"],
    ["return '상대방의 연결이 끊어졌습니다.'", "return t('singlePlayerSummary.winDisconnect')"],
    ["return '총 점수 합계에서 승리했습니다.'", "return t('singlePlayerSummary.winTotalScore')"],
    ["return '주사위 점수에서 승리했습니다.'", "return t('singlePlayerSummary.winDice')"],
    ["return '상대방이 반칙 한도를 초과했습니다.'", "return t('singlePlayerSummary.winFoul')"],
    ["return '도둑 돌을 모두 잡았습니다.'", "return t('singlePlayerSummary.winThiefCaught')"],
    ["return '경찰로서 더 많은 점수를 획득했습니다.'", "return t('singlePlayerSummary.winPoliceScore')"],
    ["return '먼저 다섯 줄을 완성했습니다.'", "return t('singlePlayerSummary.winOmok')"],
    ["return '알까기 승부에서 승리했습니다.'", "return t('singlePlayerSummary.winAlkkagi')"],
    ["return '컬링 총점에서 승리했습니다.'", "return t('singlePlayerSummary.winCurling')"],
    ["return '승리했습니다.'", "return t('singlePlayerSummary.winGeneric')"],
    ['? "계가 중..."', '? t("towerSummary.scoring")'],
    ['? (isWinner ? "미션 클리어" : "미션 실패")', '? (isWinner ? t("singlePlayerSummary.missionClear") : t("singlePlayerSummary.missionFail"))'],
    [': "게임 결과"', ': t("towerSummary.gameResult")'],
    ["{isScoring ? '계가 중...' : '보상 정보가 없습니다.'}", "{isScoring ? t('towerSummary.scoring') : t('towerSummary.noRewardInfo')}"],
    ['>결과</div>', '>{t("singlePlayerSummary.result")}</div>'],
    ["{isWinner ? '미션 성공' : '미션 실패'}", "{isWinner ? t('singlePlayerSummary.missionSuccess') : t('singlePlayerSummary.missionFail')}"],
    ['>총 걸린 시간</span>', '>{t("towerSummary.totalElapsed").replace(":", "")}</span>'],
    ['>총 걸린 시간:</span>', '>{t("towerSummary.totalElapsed")}</span>'],
    ['>백 목표/획득 점수:</span>', '>{t("singlePlayerSummary.whiteTargetScore")}</span>'],
    ['>계가 결과가 없습니다.</p>', '>{t("towerSummary.noScoringResult")}</p>'],
  ];
  for (const [a, b] of p) f = f.replaceAll(a, b);
  write('components/SinglePlayerSummaryModal.tsx', f);
}

// --- AiGameDescriptionModal ---
{
  let f = read('components/AiGameDescriptionModal.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureImport(f, "import { tx } from '../shared/i18n/runtimeText.js';\n");
  f = f.replace(
    "const formatColor = (color?: Player.Black | Player.White) => {\n  if (color === Player.Black) return '흑(선공)';\n  if (color === Player.White) return '백(후공)';\n  return '랜덤';\n};",
    "const formatColor = (color?: Player.Black | Player.White) => {\n  if (color === Player.Black) return tx('game:aiDescription.blackFirst');\n  if (color === Player.White) return tx('game:aiDescription.whiteSecond');\n  return tx('game:aiDescription.random');\n};",
  );
  f = f.replace(
    'const getSettingsRows = (session: LiveGameSession): { label: string; value: React.ReactNode }[] => {',
    'const getSettingsRows = (session: LiveGameSession, t: (k: string, o?: Record<string, unknown>) => string): { label: string; value: React.ReactNode }[] => {',
  );
  const labelMap = [
    ["label: '판 크기'", "label: t('sidebar.settings.boardSize')"],
    ["label: '덤'", "label: t('sidebar.settings.komi')"],
    ["label: '시간'", "label: t('aiDescription.time')"],
    ["value: '없음'", "value: t('aiDescription.timeNone')"],
    ["label: '계가까지 턴'", "label: t('sidebar.settings.scoringTurnLimit')"],
    ["label: '내 색'", "label: t('aiDescription.myColor')"],
    ["label: '쌍삼 금지'", "label: t('sidebar.settings.forbid33')"],
    ["label: '장목 금지'", "label: t('sidebar.settings.forbidOverline')"],
    ["? '금지' : '가능'", "? t('aiDescription.forbidden') : t('aiDescription.allowed')"],
    ["label: '목표점수'", "label: t('sidebar.settings.captureTarget')"],
    ["label: '베이스돌'", "label: t('sidebar.settings.baseStones')"],
    ["label: '히든돌'", "label: t('sidebar.settings.hiddenStones')"],
    ["label: '스캔'", "label: t('sidebar.settings.scan')"],
    ["label: '미사일'", "label: t('sidebar.settings.missile')"],
    ["label: '조합 규칙'", "label: t('sidebar.settings.mixRules')"],
    ["label: '라운드'", "label: t('sidebar.settings.round')"],
    ["label: '특수주사위'", "label: t('sidebar.settings.specialDice')"],
    ["label: '돌 개수'", "label: t('sidebar.settings.stoneCount')"],
    ["label: '배치 방식'", "label: t('sidebar.settings.placementType')"],
    ["label: '배치 전장'", "label: t('sidebar.settings.placementField')"],
    ["label: '힘 속도'", "label: t('sidebar.settings.gaugeSpeed')"],
    ["label: '슬로우'", "label: t('sidebar.settings.slow')"],
    ["label: '조준선'", "label: t('sidebar.settings.aimingLine')"],
    ["label: '스톤 개수'", "label: t('sidebar.settings.curlingStoneCount')"],
    ["|| '보통'", "|| t('sidebar.settings.speedNormal')"],
    ["? '길드 전쟁'", "? t('aiDescription.guildWar')"],
    ["? '모험'", "? t('aiDescription.adventure')"],
    ["? 'AI 대전'", "? t('aiDescription.aiMatch')"],
    [": '온라인 대국'", ": t('aiDescription.onlineMatch')"],
  ];
  for (const [a, b] of labelMap) f = f.replaceAll(a, b);
  f = f.replace(
    "rows.push({ label: t('sidebar.settings.boardSize'), value: `${settings.boardSize}x${settings.boardSize}` });",
    "rows.push({ label: t('sidebar.settings.boardSize'), value: t('aiDescription.boardSizeValue', { size: settings.boardSize }) });",
  );
  f = f.replace(
    "rows.push({ label: t('sidebar.settings.komi'), value: `${session.finalKomi ?? settings.komi ?? DEFAULT_KOMI}집` });",
    "rows.push({ label: t('sidebar.settings.komi'), value: t('aiDescription.komiValue', { komi: session.finalKomi ?? settings.komi ?? DEFAULT_KOMI }) });",
  );
  f = f.replace(
    /rows\.push\(\{ label: t\('aiDescription\.time'\), value: `\$\{settings\.timeLimit\}분 · 피셔 \$\{timeIncrement\}초` \}\);/g,
    "rows.push({ label: t('aiDescription.time'), value: t('aiDescription.timeFischer', { minutes: settings.timeLimit, increment: timeIncrement }) });",
  );
  f = f.replace(
    /rows\.push\(\{ label: t\('aiDescription\.time'\), value: `\$\{settings\.timeLimit\}분 · 초읽기 \$\{settings\.byoyomiTime \?\? 30\}초 × \$\{settings\.byoyomiCount \?\? 3\}회` \}\);/g,
    "rows.push({ label: t('aiDescription.time'), value: t('aiDescription.timeByoyomi', { minutes: settings.timeLimit, byoyomi: settings.byoyomiTime ?? 30, count: settings.byoyomiCount ?? 3 }) });",
  );
  f = f.replace(
    "rows.push({ label: t('sidebar.settings.scoringTurnLimit'), value: `${settings.scoringTurnLimit}턴` });",
    "rows.push({ label: t('sidebar.settings.scoringTurnLimit'), value: t('aiDescription.scoringTurnValue', { turns: settings.scoringTurnLimit }) });",
  );
  f = f.replaceAll("value: `${settings.captureTarget}개`", "value: t('aiDescription.countUnit', { count: settings.captureTarget })");
  f = f.replaceAll("value: `${settings.baseStones}개`", "value: t('aiDescription.countUnit', { count: settings.baseStones })");
  f = f.replaceAll("value: `${settings.hiddenStoneCount}개`", "value: t('aiDescription.countUnit', { count: settings.hiddenStoneCount })");
  f = f.replaceAll("value: `${settings.scanCount}개`", "value: t('aiDescription.countUnit', { count: settings.scanCount })");
  f = f.replaceAll("value: `${settings.missileCount}개`", "value: t('aiDescription.countUnit', { count: settings.missileCount })");
  f = f.replaceAll("value: `${settings.diceGoRounds}R`", "value: t('aiDescription.roundValue', { round: settings.diceGoRounds })");
  f = f.replaceAll("value: `${settings.alkkagiRounds}R`", "value: t('aiDescription.roundValue', { round: settings.alkkagiRounds })");
  f = f.replaceAll("value: `${settings.curlingRounds}R`", "value: t('aiDescription.roundValue', { round: settings.curlingRounds })");
  f = f.replaceAll("value: `${settings.alkkagiStoneCount}개`", "value: t('aiDescription.countUnit', { count: settings.alkkagiStoneCount })");
  f = f.replaceAll("value: `${settings.curlingStoneCount}개`", "value: t('aiDescription.countUnit', { count: settings.curlingStoneCount })");
  f = f.replaceAll("value: `${settings.alkkagiSlowItemCount}개`", "value: t('aiDescription.countUnit', { count: settings.alkkagiSlowItemCount })");
  f = f.replaceAll("value: `${settings.alkkagiAimingLineItemCount}개`", "value: t('aiDescription.countUnit', { count: settings.alkkagiAimingLineItemCount })");
  f = f.replaceAll("value: `${settings.curlingSlowItemCount}개`", "value: t('aiDescription.countUnit', { count: settings.curlingSlowItemCount })");
  f = f.replaceAll("value: `${settings.curlingAimingLineItemCount}개`", "value: t('aiDescription.countUnit', { count: settings.curlingAimingLineItemCount })");
  f = ensureHook(f, 'const AiGameDescriptionModal: React.FC', "  const { t } = useTranslation('game');\n");
  f = f.replace('getSettingsRows(session)', 'getSettingsRows(session, t)');
  f = f.replace(">이번 대국 설정<", ">{t('aiDescription.matchSettings')}<");
  f = f.replace(">경기 시작<", ">{t('aiDescription.startMatch')}<");
  write('components/AiGameDescriptionModal.tsx', f);
}

// --- ChallengeSelectionModal ---
{
  let f = read('components/ChallengeSelectionModal.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureImport(f, "import { useLocalizedGameMode } from '../shared/i18n/localizedCatalog.js';\n");
  f = ensureHook(f, 'const ChallengeSelectionModal: React.FC', "  const { t } = useTranslation('game');\n  const localizeMode = useLocalizedGameMode();\n");
  const p = [
    ["alert('믹스룰 바둑은 조합 규칙을 2개 이상 선택해야 합니다.');", "alert(t('challengeModal.mixRulesMinAlert'));"],
    ['title="믹스룰 조합 (2개 이상)"', "title={t('challengeModal.mixRulesTitle')}"],
    ["title={mixDisabled ? '따내기와 캐슬은 동시에 선택할 수 없습니다.' : undefined}", "title={mixDisabled ? t('challengeModal.mixCaptureCastleConflict') : undefined}"],
    ['title="바둑판·계가·덤·따내기"', "title={t('challengeModal.boardKomiCapture')}"],
    ["title={showSpeedTimeControls ? '스피드 시간 규칙' : '제한 시간·초읽기'}", "title={showSpeedTimeControls ? t('challengeModal.speedTimeRules') : t('challengeModal.timeByoyomi')}"],
    ['title="베이스 바둑"', "title={t('challengeModal.baseGo')}"],
    ["title={selectedMode === GameMode.Castle ? '캐슬 바둑' : '캐슬'}", "title={selectedMode === GameMode.Castle ? t('challengeModal.castleGo') : t('challengeModal.castleShort')}"],
    ['title="히든 바둑"', "title={t('challengeModal.hiddenGo')}"],
    ['title="스캔"', "title={t('challengeModal.scan')}"],
    ['title="미사일 바둑"', "title={t('challengeModal.missileGo')}"],
    ['title="주사위 바둑"', "title={t('challengeModal.diceGo')}"],
    ['title="도둑 바둑"', "title={t('challengeModal.thiefGo')}"],
    ['title="오목·따목"', "title={t('challengeModal.omokTtamok')}"],
    ['title="알까기"', "title={t('challengeModal.alkkagi')}"],
    ['title="바둑 컬링"', "title={t('challengeModal.curling')}"],
    ['title="대국 신청"', "title={t('challengeModal.title')}"],
    ["{lobbyType === 'strategic' ? '전략' : '놀이'} Lv.", "{lobbyType === 'strategic' ? t('challengeModal.strategicShort') : t('challengeModal.playfulShort')} Lv."],
    ['? `${displayOpponent.nickname}님의 응답을 기다리는 중...`', "? t('challengeModal.waitingResponse', { name: displayOpponent.nickname })"],
    [': `${displayOpponent.nickname}님에게 대국을 신청합니다.`', ": t('challengeModal.applyingTo', { name: displayOpponent.nickname })"],
  ];
  for (const [a, b] of p) f = f.replaceAll(a, b);
  write('components/ChallengeSelectionModal.tsx', f);
}

// --- BaseGameFooterPanel ---
{
  let f = read('components/game/BaseGameFooterPanel.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureHook(f, '}> = ({ session, currentUser, onAction, isMobile, isSinglePlayer = false }) => {', "    const { t } = useTranslation('game');\n");
  f = ensureHook(f, 'const BaseGameFooterPanel: React.FC', "    const { t } = useTranslation('game');\n");
  rp('components/game/BaseGameFooterPanel.tsx', [
    ["title={canRandomFill ? '남은 돌 무작위 배치' : '남은 베이스돌이 없습니다'}", "title={canRandomFill ? t('baseFooter.randomPlaceTitle') : t('baseFooter.randomPlaceDisabled')}"],
    ['>랜덤 배치</button>', ">{t('baseFooter.randomPlace')}</button>"],
    ["title={canResetPlacement ? '배치한 베이스돌을 모두 치웁니다' : '칠 베이스돌이 없습니다'}", "title={canResetPlacement ? t('baseFooter.resetTitle') : t('baseFooter.resetDisabled')}"],
    ['>재배치</button>', ">{t('baseFooter.reset')}</button>"],
    ["? '상대의 배치 완료를 기다리는 중입니다.'", "? t('baseFooter.waitingOpponent')"],
    ["? '배치를 마쳤다면 눌러 다음 단계로 진행합니다.'", "? t('baseFooter.confirmNextStep')"],
    [": '베이스돌을 모두 놓은 뒤 눌러 주세요.'", ": t('baseFooter.placeAllFirst')"],
    ["{myReady ? '확인 완료' : '배치 완료'}", "{myReady ? t('baseFooter.confirmed') : t('baseFooter.confirmComplete')}"],
  ]);
}

// --- PlayerPanel ---
{
  let f = read('components/game/PlayerPanel.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureImport(f, "import { tx } from '../../shared/i18n/runtimeText.js';\n");
  f = ensureHook(f, 'const PlayerPanel: React.FC', "    const { t } = useTranslation('game');\n");
  rp('components/game/PlayerPanel.tsx', [
    ["title={isFoulMode ? `남은 기회 ${effectiveByoyomiPeriodsLeft}회` : undefined}", "title={isFoulMode ? t('playerPanel.chancesLeftTitle', { count: effectiveByoyomiPeriodsLeft }) : undefined}"],
    ["alt={isFoulMode ? '남은 기회' : '초읽기'}", "alt={isFoulMode ? t('playerPanel.chancesLeftAlt') : t('playerPanel.byoyomiAlt')}"],
    ['>승</span>', '>{t("playerPanel.win")}</span>'],
    ['>패</span>', '>{t("playerPanel.lose")}</span>'],
    ["? '도둑' : '경찰'", "? t('playerPanel.thief') : t('playerPanel.police')"],
    ["label: '흑 남은 턴'", "label: t('playerPanel.blackTurnsLeft')"],
    ["label: '백 남은 턴'", "label: t('playerPanel.whiteTurnsLeft')"],
    ["label: '수순'", "label: t('playerPanel.moves')"],
    ["label: '계가까지'", "label: t('playerPanel.scoringRemaining')"],
    ["const playfulRollAnimAriaHint = '주사위 굴림 중. 남은 돌 수는 굴림이 끝난 뒤 표시됩니다.';", "const playfulRollAnimAriaHint = tx('game:messages.diceRollAriaHint');"],
    ['`${strategicLobbyTurnInfo.current}수`', "t('messages.movesCount', { count: strategicLobbyTurnInfo.current })"],
    ['`${turnInfo.current}수`', "t('messages.movesCount', { count: turnInfo.current })"],
  ]);
}

// --- SinglePlayerInfoPanel ---
{
  let f = read('components/game/SinglePlayerInfoPanel.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureHook(f, 'const SinglePlayerInfoPanel', "    const { t } = useTranslation('game');\n");
  f = f.replace(
    /const GO_PROVERBS = \[[\s\S]*?\];/,
    "// Quotes loaded from i18n game.singlePlayerInfo.quotes",
  );
  f = f.replace('GO_PROVERBS.map', "((t('singlePlayerInfo.quotes', { returnObjects: true }) as { term: string; meaning: string }[]) ?? []).map");
  f = f.replace('aria-label="닫기"', "aria-label={t('singlePlayerInfo.close')}");
  write('components/game/SinglePlayerInfoPanel.tsx', f);
}

console.log('Patched summary modals, AiGameDescription, Challenge, BaseFooter, PlayerPanel, SinglePlayerInfo');

// --- part 2: TowerControls, SinglePlayerControls, Game, summaries, sidebar, pregame, proverb ---

function sharedPveControlPatches() {
  return [
    ["window.alert('재도전에 실패했습니다. 다시 시도해주세요.');", "window.alert(tx('game:pveControls.retryFailed'));"],
    ["window.alert('다음 층 시작에 실패했습니다. 다시 시도해주세요.');", "window.alert(tx('game:pveControls.nextStageFailed'));"],
    ["setAlertModal({ message: '재도전에 실패했습니다. 다시 시도해주세요.' });", "setAlertModal({ message: tx('game:pveControls.retryFailed') });"],
    ["setAlertModal({ message: '다음 단계 시작에 실패했습니다. 다시 시도해주세요.' });", "setAlertModal({ message: tx('game:pveControls.nextStepFailed') });"],
    ["petHintPhase === 'opening' ? '초반' : petHintPhase === 'midgame' ? '중반' : '종반'", "petHintPhase === 'opening' ? tx('game:controls.phaseOpening') : petHintPhase === 'midgame' ? tx('game:controls.phaseMidgame') : tx('game:controls.phaseEndgame')"],
    ["petHintPhasePlyRemaining == null ? '종반' : `${petHintPhaseLabel} ${petHintPhasePlyRemaining}수`", "petHintPhasePlyRemaining == null ? tx('game:controls.phaseEndgame') : t('controls.phaseMovesLeft', { phase: petHintPhaseLabel, count: petHintPhasePlyRemaining })"],
    ['let petHintTitleBody = `${petHintPhaseLabel}에 한 번 — 대표 펫이 좋은 자리를 표시해 줘요.`;', "let petHintTitleBody = t('controls.petHintPhaseOnce', { phase: petHintPhaseLabel });"],
    ["petHintTitleBody = '대표 펫을 장착하면 힌트를 사용할 수 있어요.';", "petHintTitleBody = t('controls.petHintEquipPet');"],
    ["petHintTitleBody = '대국이 진행 중일 때 사용할 수 있어요.';", "petHintTitleBody = t('controls.petHintDuringGame');"],
    ["petHintTitleBody = '내 차례에만 사용할 수 있어요.';", "petHintTitleBody = t('controls.petHintMyTurnOnly');"],
    ['petHintTitleBody = `${petHintPhaseLabel} 구간에서 이미 힌트를 사용했어요.`;', "petHintTitleBody = t('controls.petHintPhaseUsed', { phase: petHintPhaseLabel });"],
    ['? `${petHintPhaseLabel} ${petHintPhasePlyRemaining}수 남음 — ${petHintTitleBody}`', "? t('controls.petHintPhaseRemaining', { phase: petHintPhaseLabel, count: petHintPhasePlyRemaining, body: petHintTitleBody })"],
    ['imageBottomOverlay="힌트"', 'imageBottomOverlay={t("controls.hint")}'],
    ['alt={`펫 힌트 ${petHintCountdownLabel}`}', 'alt={t("controls.petHintAria", { label: petHintCountdownLabel })}'],
    ['aria-label={`펫 힌트 ${petHintCountdownLabel} (대표 펫 미장착)`}', 'aria-label={t("controls.petHintAriaNoPet", { label: petHintCountdownLabel })}'],
    ['alt="기권"', 'alt={t("controls.resignAlt")}'],
    ["title={gameStatus === 'scoring' ? '계가 집계 중에는 기권할 수 없습니다.' : '기권하기'}", "title={gameStatus === 'scoring' ? t('controls.cannotResignDuringScoring') : t('controls.resignTitle')}"],
    ['>기권</span>', '>{t("controls.resign")}</span>'],
    ['alt="통과"', 'alt={t("controls.passLabel")}'],
    ['title="한 수 쉬기"', "title={t('controls.passTitle')}"],
    ['>통과</span>', '>{t("controls.passLabel")}</span>'],
    ['alt="배치변경"', 'alt={t("placementRefresh.title")}'],
    ['>배치변경</span>', '>{t("placementRefresh.title")}</span>'],
    ['title={refreshCount > 0 ? \'배치 새로고침\' : \'도전의 탑 아이템 상점에서 구매\'}', "title={refreshCount > 0 ? t('placementRefresh.towerRefreshActive') : t('placementRefresh.towerShopHint')}"],
    ['alt="턴 추가"', 'alt={t("placementRefresh.turnAddTitle")}'],
    ['title={turnAddCount > 0 ? \'남은 턴 3턴 추가\' : \'도전의 탑 아이템 상점에서 구매\'}', "title={turnAddCount > 0 ? t('placementRefresh.turnAddActive') : t('placementRefresh.towerShopHint')}"],
    ['alt="미사일"', 'alt={t("controls.missile")}'],
    ["title={missileCount > 0 ? '미사일 발사' : '도전의 탑 아이템 상점에서 구매'}", "title={missileCount > 0 ? t('controls.missileLaunchTitle') : t('placementRefresh.towerShopHint')}"],
    ['>미사일</span>', '>{t("controls.missile")}</span>'],
    ['alt="히든"', 'alt={t("controls.hidden")}'],
    ["title={hiddenCount > 0 ? '히든 스톤 배치' : '도전의 탑 아이템 상점에서 구매'}", "title={hiddenCount > 0 ? t('controls.hiddenPlaceTitle') : t('placementRefresh.towerShopHint')}"],
    ['>히든</span>', '>{t("controls.hidden")}</span>'],
    ['alt="스캔"', 'alt={t("controls.scan")}'],
    ["title={scanInventoryCount > 0 ? '스캔' : '도전의 탑 아이템 상점에서 구매'}", "title={scanInventoryCount > 0 ? t('controls.scan') : t('placementRefresh.towerShopHint')}"],
    ['>스캔</span>', '>{t("controls.scan")}</span>'],
    ['title="배치변경"', "title={t('placementRefresh.towerRefreshTitle')}"],
    ['message={`이용 가격: 배치 새로고침 1개', "message={t('placementRefresh.towerRefreshMessage')"],
    ['confirmText="확인"', 'confirmText={t("common:actions.confirm")}'],
    ['cancelText="취소"', 'cancelText={t("common:actions.cancel")}'],
    ['title="통과 확인"', "title={t('placementRefresh.passConfirmTitle')}"],
    ['? "양측 연속 통과 시 계가로 진행됩니다. 통과하시겠습니까?"', "? t('placementRefresh.passConfirmBoth')"],
    [': "한 수 쉬시겠습니까? 통과하면 상대(AI)에게 차례가 넘어갑니다."}', ": t('placementRefresh.passConfirmSingle')}"],
    ['confirmText="통과"', 'confirmText={t("controls.passLabel")}'],
    ['title="턴 추가"', "title={t('placementRefresh.turnAddTitle')}"],
    ['message="턴 추가 아이템 1개를 사용하여 흑의 제한 턴을 3턴 늘리시겠습니까? 확인 시 바로 적용됩니다."', "message={t('placementRefresh.turnAddMessage')}"],
    ['confirmText="사용"', 'confirmText={t("placementRefresh.useItem")}'],
    ['alt="배치 새로고침"', 'alt={t("placementRefresh.refreshTitle")}'],
    ['title="히든 스톤 배치"', "title={t('controls.hiddenPlaceTitle')}"],
    ['title="상대 히든 스톤 탐지"', "title={t('controls.scanDetectTitle')}"],
    ['title="미사일 발사"', "title={t('controls.missileLaunchTitle')}"],
    ["title: '배치변경'", "title: t('placementRefresh.confirmModalTitle')"],
    ["title: '기권 확인'", "title: t('pveControls.resignConfirmTitle')"],
    ["message: '경기를 포기하시겠습니까?'", "message: t('controls.confirmResign')"],
    ["title={confirmModal.title || '확인'}", "title={confirmModal.title || t('common:actions.confirm')}"],
    ["setAlertModal({ message: '이 스테이지에서는 배치변경을 사용할 수 없습니다.' });", "setAlertModal({ message: t('placementRefresh.notAllowedStage') });"],
    ["const priceLine = nextCost > 0 ? `이용 가격: ${formatGoldAmountKoG(nextCost)} 골드` : '이용 가격: 무료';", "const priceLine = nextCost > 0 ? t('placementRefresh.priceLine', { price: `${formatGoldAmountKoG(nextCost)} gold` }) : t('placementRefresh.priceFree');"],
    ['alt="골드"', 'alt={t("controls.goldAlt")}'],
  ];
}

// TowerControls
{
  let f = read('components/game/TowerControls.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureImport(f, "import { tx } from '../../shared/i18n/runtimeText.js';\n");
  f = ensureHook(f, 'const TowerControls: React.FC', "    const { t } = useTranslation(['common', 'game']);\n");
  for (const [a, b] of sharedPveControlPatches()) f = f.replaceAll(a, b);
  write('components/game/TowerControls.tsx', f);
}

// SinglePlayerControls
{
  let f = read('components/game/SinglePlayerControls.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureImport(f, "import { tx } from '../../shared/i18n/runtimeText.js';\n");
  f = ensureHook(f, 'const SinglePlayerControls: React.FC', "    const { t } = useTranslation(['common', 'game']);\n");
  for (const [a, b] of sharedPveControlPatches()) f = f.replaceAll(a, b);
  f = f.replace(
    "title={refreshDisabled ? (!placementRefreshAllowed ? '이 스테이지에서는 배치변경을 사용할 수 없습니다.' : usedMissileBeforeFirstMove ? '첫 턴에 미사일을 사용하면 배치변경을 사용할 수 없습니다.' : !canAfford ? '골드가 부족합니다.' : '배치 새로고침 불가') : `배치 새로고침 (비용: ${nextCost}골드, 남은 횟수: ${remainingRefreshes}/5)`}",
    "title={refreshDisabled ? (!placementRefreshAllowed ? t('placementRefresh.notAllowedStage') : usedMissileBeforeFirstMove ? t('placementRefresh.missileFirstTurn') : !canAfford ? t('placementRefresh.insufficientGold') : t('placementRefresh.refreshDisabled')) : t('placementRefresh.refreshTitleWithCost', { cost: nextCost, remaining: remainingRefreshes })}",
  );
  write('components/game/SinglePlayerControls.tsx', f);
}

// BaseGameFooterPanel remaining
{
  let f = read('components/game/BaseGameFooterPanel.tsx');
  rp('components/game/BaseGameFooterPanel.tsx', [
    ['>방장이 양쪽 베이스돌을 배치합니다.</p>', ">{t('baseFooter.hostPlacesBoth')}</p>"],
    ["primaryLine = '베이스돌 배치 단계입니다.';", "primaryLine = t('baseFooter.basePlacementPhase');"],
    ['`방장 배치: ${side} 측 베이스돌`', "t('baseFooter.hostPlacementSide', { side })"],
    ['`남은 베이스돌 (${Math.max(0, baseStoneCount - cur)}/${baseStoneCount})`', "t('turn.baseStonesRemaining', { remaining: Math.max(0, baseStoneCount - cur), total: baseStoneCount })"],
    ['parts.push(`남은 시간 ${secLeft}초`)', "parts.push(t('baseFooter.timeRemainingSec', { sec: secLeft }))"],
    ["primaryLine = `남은 베이스돌 (0/${baseStoneCount}) · 배치 완료를 눌러 주세요`;", "primaryLine = t('baseFooter.confirmPlacementFull', { total: baseStoneCount });"],
    ["? `남은 베이스돌 (0/${baseStoneCount}) · 다음 단계로 진행 중…`", "? t('baseFooter.proceedingNext', { total: baseStoneCount })"],
    [": `남은 베이스돌 (0/${baseStoneCount}) · 상대 확인 대기 중…`;", ": t('baseFooter.waitingOpponentShort', { total: baseStoneCount });"],
    ["const hint = isAdventureVsAi ? '베이스돌을 바둑판에 놓으세요' : '상대에게 보이지 않게 베이스돌을 바둑판에 놓으세요';", "const hint = isAdventureVsAi ? t('baseFooter.placeVisibleAdventure') : t('baseFooter.placeHidden');"],
    ['`남은 베이스돌 (${remain}/${baseStoneCount})`', "t('turn.baseStonesRemaining', { remaining: remain, total: baseStoneCount })"],
  ]);
}

// AiGameDescriptionModal time strings
{
  let f = read('components/AiGameDescriptionModal.tsx');
  f = f.replace(
    /`\$\{settings\.timeLimit\}분 · 피셔 \$\{timeIncrement\}초`/g,
    "t('aiDescription.timeFischer', { minutes: settings.timeLimit, increment: timeIncrement })",
  );
  f = f.replace(
    /`\$\{settings\.timeLimit\}분 · 초읽기 \$\{settings\.byoyomiTime \?\? 30\}초 × \$\{settings\.byoyomiCount \?\? 3\}회`/g,
    "t('aiDescription.timeByoyomi', { minutes: settings.timeLimit, byoyomi: settings.byoyomiTime ?? 30, count: settings.byoyomiCount ?? 3 })",
  );
  write('components/AiGameDescriptionModal.tsx', f);
}

// PlayerPanel thief round strings
{
  let f = read('components/game/PlayerPanel.tsx');
  f = f.replaceAll(
    '`라운드 ${thiefUiRound} / ${THIEF_NIGHTS_PER_SEGMENT}. ${playfulRollAnimAriaHint}`',
    "t('playerPanel.thiefRoundAria', { round: thiefUiRound, total: THIEF_NIGHTS_PER_SEGMENT, hint: playfulRollAnimAriaHint })",
  );
  f = f.replaceAll(
    '`라운드 ${thiefUiRound} / ${THIEF_NIGHTS_PER_SEGMENT}, 남은 착수 ${playfulStonesCountDisplay}개`',
    "t('playerPanel.thiefRoundPlacements', { round: thiefUiRound, total: THIEF_NIGHTS_PER_SEGMENT, count: playfulStonesCountDisplay })",
  );
  f = f.replaceAll(
    '`남은 착수 ${playfulStonesCountDisplay}개`',
    "t('playerPanel.remainingPlacementsCount', { count: playfulStonesCountDisplay })",
  );
  f = f.replaceAll('>{strategicLobbyTurnInfo.current}수</span>', '>{t("messages.movesCount", { count: strategicLobbyTurnInfo.current })}</span>');
  f = f.replaceAll('>{turnInfo.current}수</span>', '>{t("messages.movesCount", { count: turnInfo.current })}</span>');
  write('components/game/PlayerPanel.tsx', f);
}

// ProverbPanel / SinglePlayerInfoPanel
{
  let f = read('components/game/SinglePlayerInfoPanel.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = f.replace(
    /const goProverbs = \[[\s\S]*?\];/,
    '',
  );
  f = f.replace(
    'const ProverbPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {',
    "const ProverbPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {\n    const { t } = useTranslation('game');\n    const goProverbs = (t('singlePlayerInfo.quotes', { returnObjects: true }) as { term: string; meaning: string }[]) ?? [];",
  );
  f = f.replace('>바둑 격언</span>', ">{t('singlePlayerInfo.proverbsTitle')}</span>");
  f = f.replace('aria-label="닫기"', "aria-label={t('singlePlayerInfo.close')}");
  f = f.replace('>닫기</button>', ">{t('singlePlayerInfo.close')}</button>");
  write('components/game/SinglePlayerInfoPanel.tsx', f);
}

// Game.tsx
{
  let f = read('Game.tsx');
  if (!f.includes('runtimeText')) {
    f = f.replace(
      "import { InGameModalLayoutProvider } from './contexts/InGameModalLayoutContext.js';",
      "import { InGameModalLayoutProvider } from './contexts/InGameModalLayoutContext.js';\nimport { tx } from './shared/i18n/runtimeText.js';",
    );
  }
  f = f.replace('>통과</span>', '>{tx(\'game:controls.passLabel\')}</span>');
  f = f.replace('title="펫 속성(가위·바위·보)"', "title={tx('game:messages.petAttributeAria')}");
  f = f.replace('>점수</div>', '>{tx(\'game:playerPanel.score\')}</div>');
  f = f.replace('>점수</span>', '>{tx(\'game:playerPanel.score\')}</span>');
  f = f.replace('alt="초읽기"', "alt={tx('game:messages.byoyomiAlt')}");
  f = f.replace("return { label: '수순', primary: moveCount };", "return { label: tx('game:playerPanel.moves'), primary: moveCount };");
  f = f.replace("return { label: '계가까지', primary: remaining, secondary: limit };", "return { label: tx('game:playerPanel.scoringRemaining'), primary: remaining, secondary: limit };");
  f = f.replace('aria-label="펫 속성"', "aria-label={tx('game:messages.petAttributeLabel')}");
  f = f.replace('window.confirm("상대방의 장고로 인해 페널티 없이 무효 처리하고 나가시겠습니까?")', "window.confirm(tx('game:alerts.noContestConfirm'))");
  f = f.replace("window.alert('계가 집계 중에는 기권할 수 없습니다.')", "window.alert(tx('game:alerts.cannotResignScoring'))");
  f = f.replace("window.alert('게임 세션이 만료되었습니다. 대기실에서 스테이지를 다시 선택해 주세요.')", "window.alert(tx('game:alerts.sessionExpired'))");
  f = f.replace("window.alert('게임 시작에 실패했습니다. 다시 시도해주세요.')", "window.alert(tx('game:alerts.startFailed'))");
  f = f.replace("? '몬스터가 히든 아이템을 사용했습니다!'\n                        : 'AI봇이 히든 아이템을 사용했습니다!'", "? tx('game:turn.monsterHiddenItem')\n                        : tx('game:turn.aiHiddenItem')");
  f = f.replace("title={isPairArenaAiRematch ? '페어바둑 AI와 재대결' : undefined}", "title={isPairArenaAiRematch ? tx('game:pairAiRematch.title') : undefined}");
  f = f.replace("submitLabel={isPairArenaAiRematch ? 'AI와 대국 시작' : undefined}", "submitLabel={isPairArenaAiRematch ? tx('game:pairAiRematch.start') : undefined}");
  f = f.replace('>일시 정지</h2>', '>{tx(\'game:board.paused\')}</h2>');
  write('Game.tsx', f);
}

console.log('Patched part 2 files');

// --- part 3: GameSummaryModal, DungeonStageSummaryModal, Sidebar, PreGameDescriptionLayout, misc game ---

// GameSummaryModal (uses gs() helper)
{
  rp('components/GameSummaryModal.tsx', [
    ['>라운드</th>', '>{gs("round")}</th>'],
    ['>합계</th>', '>{gs("totalScore")}</th>'],
    ['>도망</span>', '>{gs("escaped")}</span>'],
    ['>잡은 돌</span>', '>{gs("capturedStones")}</span>'],
    ['>최종 점수</p>', '>{gs("finalScore")}</p>'],
    ['>점수 정보가 없습니다.</p>', '>{gs("noScoreInfo")}</p>'],
    ['>누적 점수</p>', '>{gs("cumulativeScore")}</p>'],
    ['>(이전: {blackPreviousKnockout})</span>', '>{gs("previousKnockout", { count: blackPreviousKnockout })}</span>'],
    ['>(이전: {whitePreviousKnockout})</span>', '>{gs("previousKnockout", { count: whitePreviousKnockout })}</span>'],
    ['>흑</span>', '>{i18n.t("game:black")}</span>'],
    ['>백</span>', '>{i18n.t("game:white")}</span>'],
    ['>득점</span>', '>{gs("scored")}</span>'],
    ['>실점</span>', '>{gs("conceded")}</span>'],
    ['>점</span>', '>{gs("pointsUnit")}</span>'],
    ['>점수 계산 중...</p>', '>{gs("calculatingScore")}</p>'],
    ['{ label: `한 번에 ${GUILD_WAR_STAR_CAPTURE_TIER2_MIN}점 획득`', '{ label: gs("captureTier2", { min: GUILD_WAR_STAR_CAPTURE_TIER2_MIN })'],
    ['{ label: `한 번에 ${GUILD_WAR_STAR_CAPTURE_TIER3_MIN}점 획득`', '{ label: gs("captureTier3", { min: GUILD_WAR_STAR_CAPTURE_TIER3_MIN })'],
    ['{ label: `집차이 ${scoreT2}집 이상`', '{ label: gs("scoreDiffTier", { diff: scoreT2 })'],
    ['{ label: `집차이 ${scoreT3}집 이상`', '{ label: gs("scoreDiffTier", { diff: scoreT3 })'],
    ["{isGuildWar ? '길드 전쟁 보상' : '획득 보상'}", '{isGuildWar ? gs("guildWarRewards") : gs("rewardsEarned")}'],
    [": '변동 없음'", ': gs("noChange")'],
    ['>변동 없음</span>', '>{gs("noChange")}</span>'],
    ['>승</span>', '>{gs("winShort")}</span>'],
    ['>패</span>', '>{gs("loseShort")}</span>'],
    ["displayName.includes('골드꾸러미')", "displayName.includes(gs('goldBundleCompact'))"],
    ["displayName.replace('골드꾸러미', '골드 꾸러미')", "displayName.replace(gs('goldBundleCompact'), gs('goldBundleSpaced'))"],
    ["displayName.includes('골드 꾸러미')", "displayName.includes(gs('goldBundleSpaced'))"],
    ["displayName.replace('골드 꾸러미', '골드꾸러미')", "displayName.replace(gs('goldBundleSpaced'), gs('goldBundleCompact'))"],
  ]);
}

// DungeonStageSummaryModal
{
  let f = read('components/DungeonStageSummaryModal.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = ensureImport(f, "import { tx } from '../shared/i18n/runtimeText.js';\n");
  f = ensureHook(f, 'const DungeonStageSummaryModal', "    const { t } = useTranslation('game');\n");
  const ds = (k, o) => `t('dungeonSummary.${k}'${o ? `, ${o}` : ''})`;
  rp('components/DungeonStageSummaryModal.tsx', [
    ["name: `골드 ${formatGoldAmountKoG(goldAmount)}`", "name: t('dungeonSummary.goldAmount', { amount: formatGoldAmountKoG(goldAmount) })"],
    ["name: '골드'", "name: tx('common:resources.gold')"],
    ["name: `${label} 장비`", "name: t('dungeonSummary.equipmentSuffix', { label })"],
    ["name: `변경권 x${baseRewards.changeTickets}`", "name: t('dungeonSummary.changeTickets', { count: baseRewards.changeTickets })"],
    ["name: '챔프 코인'", "name: t('dungeonSummary.champCoin')"],
    ["'재료 상자1': '재료 상자 I'", "'재료 상자1': t('dungeonSummary.materialBox1')"],
    ["'재료 상자2': '재료 상자 II'", "'재료 상자2': t('dungeonSummary.materialBox2')"],
    ["'재료 상자3': '재료 상자 III'", "'재료 상자3': t('dungeonSummary.materialBox3')"],
    ["'재료 상자4': '재료 상자 IV'", "'재료 상자4': t('dungeonSummary.materialBox4')"],
    ["'재료 상자5': '재료 상자 V'", "'재료 상자5': t('dungeonSummary.materialBox5')"],
    ["'재료 상자6': '재료 상자 VI'", "'재료 상자6': t('dungeonSummary.materialBox6')"],
    ["'재료상자1': '재료 상자 I'", "'재료상자1': t('dungeonSummary.materialBox1')"],
    ["'재료상자2': '재료 상자 II'", "'재료상자2': t('dungeonSummary.materialBox2')"],
    ["'재료상자3': '재료 상자 III'", "'재료상자3': t('dungeonSummary.materialBox3')"],
    ["'재료상자4': '재료 상자 IV'", "'재료상자4': t('dungeonSummary.materialBox4')"],
    ["'재료상자5': '재료 상자 V'", "'재료상자5': t('dungeonSummary.materialBox5')"],
    ["'재료상자6': '재료 상자 VI'", "'재료상자6': t('dungeonSummary.materialBox6')"],
    ["? '3위 이상 시 열림'", "? t('dungeonSummary.lockedTop3')"],
    ["? '이미 열림'", "? t('dungeonSummary.alreadyOpen')"],
    [": '해제됨'", ": t('dungeonSummary.unlocked')"],
    ["? '잠김 (3위 이상 시 열림)'", "? t('dungeonSummary.lockedTop3Full')"],
    ["? '다음 단계가 이미 열려있습니다.'", "? t('dungeonSummary.nextStageAlreadyOpen')"],
    [": '열림'", ": t('dungeonSummary.open')"],
    ['>이번 대회 결과</h3>', '>{t("dungeonSummary.resultTitle")}</h3>'],
    ['>전적</div>', '>{t("dungeonSummary.record")}</div>'],
    ['>승</span>', '>{tx("game:summary.winShort")}</span>'],
    ['>패</span>', '>{tx("game:summary.loseShort")}</span>'],
    ['>순위</div>', '>{t("dungeonSummary.rank")}</div>'],
    ['>위</span>', '>{t("dungeonSummary.rankSuffix")}</span>'],
    ['>현재 단계 누적 전적</h3>', '>{t("dungeonSummary.stageTotalsTitle")}</h3>'],
    ['>승률</div>', '>{t("dungeonSummary.winRate")}</div>'],
    ['>보상 없음</p>', '>{t("dungeonSummary.noRewards")}</p>'],
    ['aria-label="보상 아이콘"', 'aria-label={t("dungeonSummary.rewardsAria")}'],
    ['title={`${tournamentName} ${stage}단계 결과`}', 'title={t("dungeonSummary.stageResultTitle", { tournament: tournamentName, stage })}'],
    ['>단계</span>', '>{t("dungeonSummary.stageLabel")}</span>'],
    ['aria-label="결과 요약"', 'aria-label={t("dungeonSummary.resultAria")}'],
    ["['thisRun', '이번 대회 결과']", "['thisRun', t('dungeonSummary.resultTitle')]"],
    ["['stageTotals', '현재 단계 누적 전적']", "['stageTotals', t('dungeonSummary.stageTotalsTitle')]"],
    ['>보상 내역</h3>', '>{t("dungeonSummary.rewardsTitle")}</h3>'],
    ['>{nextStage}단계</span>', '>{t("dungeonSummary.nextStage", { stage: nextStage })}</span>'],
  ]);
}

// Sidebar remaining
{
  let f = read('components/game/Sidebar.tsx');
  f = f.replace(
    "if (window.confirm(`${session.player2?.nickname}님 기권승(승자: ${session.player1?.nickname}) 처리하시겠습니까?`))",
    "if (window.confirm(t('sidebar.adminResignConfirm', { loser: session.player2?.nickname, winner: session.player1?.nickname })))",
  );
  f = f.replace(
    "if (window.confirm(`${session.player1?.nickname}님 기권승(승자: ${session.player2?.nickname}) 처리하시겠습니까?`))",
    "if (window.confirm(t('sidebar.adminResignConfirm', { loser: session.player1?.nickname, winner: session.player2?.nickname })))",
  );
  f = f.replace(
    "? '내 차례에만 일시정지할 수 있습니다'",
    "? t('controls.pauseMyTurnOnly')",
  );
  f = f.replace(
    "? `대국 재개 (${resumeCountdown})`\n                                    : '대국 재개'",
    "? t('controls.resumeGameCountdown', { count: resumeCountdown })\n                                    : t('controls.resumeGame')",
  );
  f = f.replace(
    "? `일시 정지 (${pauseButtonCooldown})`\n                                  : pauseDisabledBecauseAiTurn\n                                    ? '일시 정지 (AI 차례)'\n                                    : '일시 정지'}",
    "? t('controls.pauseGameCountdown', { count: pauseButtonCooldown })\n                                  : pauseDisabledBecauseAiTurn\n                                    ? t('controls.pauseGameAiTurn')\n                                    : t('controls.pauseGame')}",
  );
  f = f.replace(
    "? '계가 집계 중에는 기권할 수 없습니다.'",
    "? t('controls.cannotResignDuringScoring')",
  );
  write('components/game/Sidebar.tsx', f);
}

// PreGameDescriptionLayout
{
  let f = read('components/game/PreGameDescriptionLayout.tsx');
  f = ensureImport(f, "import { tx } from '../../shared/i18n/runtimeText.js';\n");
  f = f.replace("const SUMMARY_NONE = '없음';", "const summaryNone = () => tx('game:preGame.none');");
  f = f.replaceAll('SUMMARY_NONE', 'summaryNone()');
  f = f.replace(
    'const a11y = slot.title ? `${slot.title} ${slot.count}개` : `수량 ${slot.count}`;',
    "const a11y = slot.title ? `${slot.title} ${tx('game:aiDescription.countUnit', { count: slot.count })}` : tx('game:preGame.quantity', { count: slot.count });",
  );
  f = f.replace(
    "title={slot.title ? `${slot.title} 구매` : '아이템 상점'}",
    "title={slot.title ? tx('game:preGame.quantityBuy', { title: slot.title }) : tx('game:preGame.itemShop')}",
  );
  f = f.replace(
    'aria-label={`${a11y}. 탭하여 도전의 탑 아이템 상점 열기`}',
    "aria-label={tx('game:preGame.itemShopAria', { a11y })}",
  );
  f = f.replace("title: summary.goalVisuals?.win ? '이번 목표' : '승리 조건'", "title: summary.goalVisuals?.win ? tx('game:preGame.goalTitle') : tx('game:preGame.winCondition')");
  f = f.replace("title: '주의할 실패 조건'", "title: tx('game:preGame.failConditionTitle')");
  f = f.replace("title: '점수 요인'", "title: tx('game:preGame.scoreFactors')");
  f = f.replace("title: '시간 규칙'", "title: tx('game:preGame.timeRules')");
  f = f.replace("title: '아이템'", "title: tx('game:preGame.items')");
  f = f.replace('aria-label="아이템 없음"', "aria-label={tx('game:preGame.noItems')}");
  f = f.replace("{casualAcademyLayout ? '하는 법' : '이번 스테이지 핵심'}", "{casualAcademyLayout ? tx('game:preGame.howToPlay') : tx('game:preGame.stageKeyPoints')}");
  f = f.replace("return '문양돌은 2점'", "return tx('game:preGame.patternStone2pts')");
  f = f.replace("return guide.body.replace('끝내기', '목표 달성')", "return guide.body.replace(tx('game:preGame.finishWord'), tx('game:preGame.goalAchievement'))");
  f = f.replace("return '미사일로 밀기'", "return tx('game:preGame.missilePush')");
  f = f.replace("return '턴 추가 사용'", "return tx('game:preGame.turnAddUse')");
  f = f.replace("text: '집이 적으면 실패'", "text: tx('game:preGame.lowTerritoryFail')");
  f = f.replace("{renderSection('이번 목표', goalTiles, 'goal')}", "{renderSection(tx('game:preGame.goalTitle'), goalTiles, 'goal')}");
  f = f.replace("{renderSection('주의할 점', cautionTiles, 'caution')}", "{renderSection(tx('game:preGame.cautionPoints'), cautionTiles, 'caution')}");
  const modeLabels = [
    ["add('/images/simbols/simbol2.webp', '따내기')", "add('/images/simbols/simbol2.webp', tx('game:preGame.capture'))"],
    ["add('/images/icon/timer.webp', '스피드')", "add('/images/icon/timer.webp', tx('game:preGame.speed'))"],
    ["add('/images/simbols/simbol4.webp', '베이스')", "add('/images/simbols/simbol4.webp', tx('game:preGame.base'))"],
    ["add('/images/button/hidden.webp', '히든')", "add('/images/button/hidden.webp', tx('game:preGame.hidden'))"],
    ["add('/images/button/scan.webp', '스캔')", "add('/images/button/scan.webp', tx('game:preGame.scan'))"],
    ["add('/images/button/missile.webp', '미사일')", "add('/images/button/missile.webp', tx('game:preGame.missile'))"],
    ["add('/images/simbols/simbolp1.webp', '주사위')", "add('/images/simbols/simbolp1.webp', tx('game:preGame.dice'))"],
    ["add('/images/simbols/simbolp2.webp', '오목')", "add('/images/simbols/simbolp2.webp', tx('game:preGame.omok'))"],
    ["add('/images/simbols/simbolp5.webp', '알까기')", "add('/images/simbols/simbolp5.webp', tx('game:preGame.alkkagi'))"],
    ["add('/images/simbols/simbolp6.webp', '컬링')", "add('/images/simbols/simbolp6.webp', tx('game:preGame.curling'))"],
    ["add('/images/simbols/simbolp4.webp', '도둑과경찰')", "add('/images/simbols/simbolp4.webp', tx('game:preGame.thiefPolice'))"],
    ["label: '클래식'", "label: tx('game:preGame.classic')"],
    ["label: '믹스'", "label: tx('game:preGame.mix')"],
  ];
  for (const [a, b] of modeLabels) f = f.replace(a, b);
  write('components/game/PreGameDescriptionLayout.tsx', f);
}

// Misc smaller game components - use tx for simple strings
const miscPatches = {
  'components/game/TurnDisplay.tsx': [
    ["msg === 'AI봇이 히든 아이템을 사용했습니다!'", "msg === i18n.t(AI_HIDDEN_ITEM_MESSAGE_KEY)"],
    ["msg === '몬스터가 히든 아이템을 사용했습니다!'", "msg === i18n.t(MONSTER_HIDDEN_ITEM_MESSAGE_KEY)"],
  ],
  'components/game/MoveConfirmFooterSlot.tsx': [
    ['>착수</', '>{tx("game:confirmMove")}</'],
    ['>취소</', '>{tx("common:actions.cancel")}</'],
  ],
  'components/game/ScoringOverlay.tsx': [
    ['>계가 중...</', '>{tx("game:towerSummary.scoring")}</'],
  ],
  'components/game/IngameMobileFooterAd.tsx': [
    ['aria-label="광고"', 'aria-label={tx("common:ads.label")}'],
  ],
};
for (const [rel, pairs] of Object.entries(miscPatches)) {
  let f = read(rel);
  if (!f.includes('runtimeText') && !f.includes('config.js')) {
    f = ensureImport(f, "import { tx } from '../../shared/i18n/runtimeText.js';\n");
  }
  for (const [a, b] of pairs) f = f.replaceAll(a, b);
  write(rel, f);
}

console.log('Patched part 3 files');


