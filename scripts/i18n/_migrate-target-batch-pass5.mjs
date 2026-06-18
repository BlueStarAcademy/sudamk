/**
 * Pass 5: remaining high-count target files.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(root, f), c, 'utf8');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, obj) => fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');

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
const I18N_CFG = "import i18n from '../shared/i18n/config.js';\n";

export function extendCatalogPass5(ko, en) {
  Object.assign(ko.profile.mbtiInfo, {
    istjDesc: '현실적, 책임감, 신중함',
    isfjDesc: '헌신적, 온화함, 섬세함',
    infjDesc: '통찰력, 이상주의, 깊이 있음',
    intjDesc: '전략적, 독립적, 논리적',
    istpDesc: '논리적, 실용적, 문제 해결사',
    isfpDesc: '겸손함, 예술적, 융통성',
    infpDesc: '이상주의, 공감 능력, 창의적',
    intpDesc: '지적 호기심, 분석적, 독창적',
    estpDesc: '활동적, 현실적, 대담함',
    esfpDesc: '사교적, 낙천적, 즉흥적',
    enfpDesc: '열정적, 상상력 풍부, 사교적',
    entpDesc: '독창적, 박식함, 논쟁가',
    estjDesc: '체계적, 현실적, 리더십',
    esfjDesc: '사교적, 협조적, 배려심',
    enfjDesc: '카리스마, 영감, 리더십',
    entjDesc: '결단력, 리더십, 전략가',
    mbtiExplain1: 'MBTI(Myers-Briggs Type Indicator)는 개인의 선호도를 바탕으로 성격 유형을 이해하는 도구입니다.',
    mbtiExplain2: '자신을 더 잘 이해하고 다른 사람들과의 관계를 개선하는 데 도움을 줄 수 있습니다.',
    setupMbti: 'MBTI 설정하기',
    questionProgress: '질문 {{current}} / {{total}} · 축마다 답을 모으면 유형이 정해집니다',
    yourMbtiIs: '당신의 MBTI는 {{mbti}} 입니다!',
    setupAgain: '다시 설정하기',
    myMbtiLabel: '나의 MBTI:',
  });
  Object.assign(en.profile.mbtiInfo, {
    istjDesc: 'Realistic, responsible, careful',
    isfjDesc: 'Dedicated, gentle, detail-oriented',
    infjDesc: 'Insightful, idealistic, deep',
    intjDesc: 'Strategic, independent, logical',
    istpDesc: 'Logical, practical, problem-solver',
    isfpDesc: 'Humble, artistic, flexible',
    infpDesc: 'Idealistic, empathetic, creative',
    intpDesc: 'Curious, analytical, original',
    estpDesc: 'Active, realistic, bold',
    esfpDesc: 'Social, optimistic, spontaneous',
    enfpDesc: 'Passionate, imaginative, social',
    entpDesc: 'Original, knowledgeable, debater',
    estjDesc: 'Systematic, realistic, leadership',
    esfjDesc: 'Social, cooperative, caring',
    enfjDesc: 'Charismatic, inspiring, leader',
    entjDesc: 'Decisive, leadership, strategist',
    mbtiExplain1: 'MBTI (Myers-Briggs Type Indicator) helps understand personality types from preferences.',
    mbtiExplain2: 'It can help you understand yourself and improve relationships with others.',
    setupMbti: 'Set up MBTI',
    questionProgress: 'Question {{current}} / {{total}} · Answer each axis to determine your type',
    yourMbtiIs: 'Your MBTI is {{mbti}}!',
    setupAgain: 'Set up again',
    myMbtiLabel: 'My MBTI:',
  });
}

const migrations = [
  {
    file: 'components/PairArenaDetailedStatsModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = s.replace(
        `const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => (
    <span
        className={\`inline-flex items-center gap-0.5 tabular-nums \${className}\`}
        aria-label={\`다이아 \${amount.toLocaleString()}\`}
    >`,
        `const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => {
    const { t } = useTranslation('profile');
    return (
    <span
        className={\`inline-flex items-center gap-0.5 tabular-nums \${className}\`}
        aria-label={t('detailedStats.diamondsAria', { amount: amount.toLocaleString() })}
    >`,
      );
      s = s.replace(
        `        <span className="font-semibold">{amount.toLocaleString()}</span>
    </span>
);`,
        `        <span className="font-semibold">{amount.toLocaleString()}</span>
    </span>
    );
};`,
      );
      s = ensureHook(s, 'export const PairArenaStatsPanel', "    const { t } = useTranslation('profile');\n    const { t: tGame } = useTranslation('game');\n");
      s = s.replace(
        'targetLabel: `「${pairResetConfirm.displayName}」 페어 경기장`,',
        "targetLabel: tGame('pairStats.modeTarget', { name: pairResetConfirm.displayName }),",
      );
      s = s.replace(
        "seasonResetNote: '모드별 페어 전적만 초기화됩니다. 랭킹전·페어 AI 전적은 유지됩니다.',",
        "seasonResetNote: tGame('pairStats.modeResetNote'),",
      );
      s = s.replace("targetLabel: '페어 바둑 전체',", "targetLabel: tGame('pairStats.pairAll'),");
      s = s.replace(
        "seasonResetNote: 'PVP 전적 초기화 시 페어 시즌 랭킹 점수도 함께 초기화됩니다.',",
        "seasonResetNote: tGame('pairStats.pairSeasonNote'),",
      );
      s = s.replace(
        '<span className="ml-0.5 text-[0.7em] font-semibold text-secondary/85">점</span>',
        '<span className="ml-0.5 text-[0.7em] font-semibold text-secondary/85">{t(\'detailedStats.pointsUnit\')}</span>',
      );
      s = s.replace(
        '<span className={`mr-1.5 font-semibold ${theme.labelMuted}`}>합계</span>',
        '<span className={`mr-1.5 font-semibold ${theme.labelMuted}`}>{t(\'detailedStats.totalShort\')}</span>',
      );
      s = s.replaceAll('<span className="text-secondary/75">승 </span>', '<span className="text-secondary/75">{t(\'detailedStats.winSuffix\')}</span>');
      s = s.replaceAll('<span className="text-secondary/75">패</span>', '<span className="text-secondary/75">{t(\'detailedStats.lossSuffix\')}</span>');
      s = s.replace(
        '? `다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 페어 전략 모드 전체`',
        "? tGame('pairStats.resetPairAll', { cost: CATEGORY_RESET_COST.toLocaleString() })",
      );
      s = s.replaceAll('<span>전체 초기화</span>', '<span>{t(\'detailedStats.resetAll\')}</span>');
      s = s.replaceAll('<span>초기화</span>', '<span>{t(\'detailedStats.resetBtn\')}</span>');
      s = s.replaceAll(
        '? `다이아 ${SINGLE_RESET_COST} — 이 모드만 초기화`',
        "? t('detailedStats.resetSingle', { cost: SINGLE_RESET_COST })",
      );
      s = s.replaceAll(
        ': `다이아 부족 (필요 ${SINGLE_RESET_COST})`',
        ": t('detailedStats.diamondInsufficient', { cost: SINGLE_RESET_COST })",
      );
      s = s.replaceAll(
        ': `다이아 부족 (필요 ${CATEGORY_RESET_COST.toLocaleString()})`',
        ": t('detailedStats.diamondInsufficient', { cost: CATEGORY_RESET_COST.toLocaleString() })",
      );
      s = s.replace('title="페어 경기장 상세 전적"', "title={tGame('pairStats.title')}");
      return s;
    },
  },
  {
    file: 'components/DetailedStatsModal.tsx',
    fn: (c) => {
      let s = c;
      s = s.replaceAll(
        '<span className="font-bold">{aiW}</span>승{\' \'}\n                                            <span className="font-bold">{aiL}</span>패 ({aiWr}%)',
        "{t('detailedStats.aiWinLoss', { wins: aiW, losses: aiL, winRate: aiWr })}",
      );
      s = s.replaceAll(
        '? `다이아 ${SINGLE_RESET_COST} — 이 모드만 초기화`',
        "? t('detailedStats.resetSingle', { cost: SINGLE_RESET_COST })",
      );
      s = s.replaceAll(
        ': `다이아 부족 (필요 ${SINGLE_RESET_COST})`',
        ": t('detailedStats.diamondInsufficient', { cost: SINGLE_RESET_COST })",
      );
      s = s.replace(
        '`다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 전략 전체`',
        "t('detailedStats.resetCategory', { cost: CATEGORY_RESET_COST.toLocaleString() })",
      );
      s = s.replace(
        '`다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 놀이 전체`',
        "t('detailedStats.resetPlayfulCategory', { cost: CATEGORY_RESET_COST.toLocaleString() })",
      );
      return s;
    },
  },
  {
    file: 'components/MbtiInfoModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const MbtiInfoModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace("alert('모든 문항에 답해 주세요.');", "alert(t('mbtiInfo.answerAll'));");
      s = s.replace('title="MBTI 성향 안내"', "title={t('mbtiInfo.title')}");
      s = s.replace('>MBTI란 무엇인가요?<', ">{t('mbtiInfo.whatIsMbti')}<");
      s = s.replace(
        'MBTI(Myers-Briggs Type Indicator)는 개인의 선호도를 바탕으로 성격 유형을 이해하는 도구입니다.',
        "{t('mbtiInfo.mbtiExplain1')}",
      );
      s = s.replace(
        '자신을 더 잘 이해하고 다른 사람들과의 관계를 개선하는 데 도움을 줄 수 있습니다.',
        "{t('mbtiInfo.mbtiExplain2')}",
      );
      s = s.replace('>MBTI 설정하기<', ">{t('mbtiInfo.setupMbti')}<");
      s = s.replace(
        '질문 {currentQuestionIndex + 1} / {MBTI_QUESTIONS.length} · 축마다 답을 모으면 유형이 정해집니다',
        "{t('mbtiInfo.questionProgress', { current: currentQuestionIndex + 1, total: MBTI_QUESTIONS.length })}",
      );
      s = s.replace(
        '당신의 MBTI는 <span className="tabular-nums">{calculatedMbti}</span> 입니다!',
        "{t('mbtiInfo.yourMbtiIs', { mbti: calculatedMbti })}",
      );
      s = s.replace('>다시 설정하기<', ">{t('mbtiInfo.setupAgain')}<");
      s = s.replace('>확인<', ">{t('actions.ok', { ns: 'common' })}<");
      s = s.replace('>나의 MBTI:{\' \'}<', ">{t('mbtiInfo.myMbtiLabel')}{' '}<");
      s = s.replace("{currentQuestionIndex < MBTI_QUESTIONS.length - 1 ? '다음' : '완료'}", "{currentQuestionIndex < MBTI_QUESTIONS.length - 1 ? t('mbtiInfo.next') : t('mbtiInfo.complete')}");
      s = s.replace('>100 다이아몬드 획득!<', ">{t('mbtiInfo.rewardObtained')}<");
      s = s.replace('>완료 시 100 다이아몬드를 드립니다!<', ">{t('mbtiInfo.completeReward')}<");
      return s;
    },
  },
  {
    file: 'components/MannerRankModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      s = ensureHook(s, 'const MannerRankModal', "    const { t } = useTranslation('profile');\n");
      s = s.replace('title="매너 등급 정보"', "title={t('mannerRank.title')}");
      s = s.replace('>매너 등급<', ">{t('mannerRank.grade')}<");
      s = s.replace('>점수 구간별로 적용되는 혜택·페널티입니다.<', ">{t('mannerRank.rangeHint')}<");
      s = s.replace('>모든 능력치 +10<', ">{t('mannerRank.allStatsPlus10')}<");
      s = s.replace('>분해 대박 확률 +20%<', ">{t('mannerRank.disassembleJackpot')}<");
      s = s.replace('>승리 아이템 확률 +20%<', ">{t('mannerRank.winItemBonus')}<");
      s = s.replace('>승리 골드 확률 +20%<', ">{t('mannerRank.winGoldBonus')}<");
      s = s.replace('>최대 행동력 +10<', ">{t('mannerRank.maxApPlus10')}<");
      s = s.replace('>최대 행동력 -20<', ">{t('mannerRank.maxApMinus20')}<");
      s = s.replace('>행동력 지급 시간 증가<', ">{t('mannerRank.apRegenBoost')}<");
      s = s.replace('>승리 골드 보상 -50%<', ">{t('mannerRank.winGoldPenalty')}<");
      s = s.replace('>승리 아이템 확률 -50%<', ">{t('mannerRank.winItemPenalty')}<");
      s = s.replace('>기본 효과 (효과 없음)<', ">{t('mannerRank.noEffect')}<");
      return s;
    },
  },
  {
    file: 'components/MannerGradeChangeModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N);
      if (!s.includes("useTranslation('profile')")) {
        s = ensureHook(s, 'const MannerGradeChangeModal', "    const { t } = useTranslation('profile');\n");
      }
      s = s.replace(
        "? '바른 매너를 유지하면 혜택이 늘어납니다. 계속 좋은 대국 부탁드립니다.'",
        "? t('mannerGradeChange.upHint')",
      );
      s = s.replace(
        ": '매너 점수가 낮아지면 보상·능력치에 불리할 수 있습니다. 건전한 플레이를 권장합니다.'}",
        ": t('mannerGradeChange.downHint')}",
      );
      return s;
    },
  },
  {
    file: 'components/ChampionshipVenueEntryModal.tsx',
    fn: (c) => {
      let s = ensureImport(c, I18N_CFG);
      if (!s.includes('const tourT =')) {
        s = s.replace(
          I18N_CFG.trim(),
          `${I18N_CFG.trim()}\nconst tourT = (key: string, opts?: Record<string, unknown>) => i18n.t(\`tournament:championship.venue.\${key}\`, opts);\n`,
        );
      }
      s = s.replace("if (grades.length === 0) return ['1개/경기 (랜덤)'];", "if (grades.length === 0) return [tourT('oneGamePerMatch')];");
      s = s.replace(
        'const rangeLine = lo === hi ? `등급: ${loL}` : `등급 범위: ${loL}~${hiL}`;',
        "const rangeLine = lo === hi ? tourT('grade', { grade: loL }) : tourT('gradeRange', { low: loL, high: hiL });",
      );
      s = s.replace('if (lo === hi) return `${lo}위`;', "if (lo === hi) return tourT('rankPlace', { rank: lo });");
      s = s.replace('return `${lo}~${hi}위`;', "return tourT('rankRange', { low: lo, high: hi });");
      s = s.replace("label: '골드',", "label: tourT('gold'),");
      s = s.replace("label: '다이아',", "label: tourT('diamonds'),");
      s = s.replace(
        "type === 'world' && rankKey === 9 ? '9~16위' : type === 'world' && rankKey === 4 ? '4~8위' : `${rankKey}위`",
        "type === 'world' && rankKey === 9 ? tourT('rankWorld9_16') : type === 'world' && rankKey === 4 ? tourT('rankWorld4_8') : tourT('rankPlace', { rank: rankKey })",
      );
      s = s.replace(
        '`승리 시 ${range.win.min.toLocaleString()}~${range.win.max.toLocaleString()} 골드`',
        "tourT('winGold', { min: range.win.min.toLocaleString(), max: range.win.max.toLocaleString() })",
      );
      s = s.replace(
        '`패배 시 ${range.loss.min.toLocaleString()}~${range.loss.max.toLocaleString()} 골드`',
        "tourT('lossGold', { min: range.loss.min.toLocaleString(), max: range.loss.max.toLocaleString() })",
      );
      s = s.replace("captionBelowThumb: '장비',", "captionBelowThumb: tourT('equipment'),");
      s = s.replace("label: '장비 변경권',", "label: tourT('changeTicket'),");
      s = s.replace(
        "'경기 결과에 따라 지급 여부·수량이 달라질 수 있습니다 (랜덤).',",
        "tourT('rewardRandom'),",
      );
      s = s.replace(
        '`단계 기준 최대 ${e.changeTickets}개 범위`',
        "tourT('changeTicketMax', { count: e.changeTickets })",
      );
      s = s.replace("captionBelowThumb: '변경권',", "captionBelowThumb: tourT('changeTicketShort'),");
      s = s.replace("|| '기본 보상';", "|| tourT('defaultRewardFallback');");
      s = ensureHook(s, 'const ChampionshipVenueEntryModal', "    const { t } = useTranslation('tournament');\n");
      s = s.replace("let continueLabel = '이어서 보기';", "let continueLabel = t('championship.venue.continueView');");
      s = s.replace("continueLabel = '결과보기';", "continueLabel = t('championship.venue.viewResult');");
      s = s.replace(
        "? '오늘 진행한 경기가 있습니다. 결과를 확인하세요.'",
        "? t('championship.venue.inProgressToday')",
      );
      s = s.replace(": '진행 중인 경기가 있습니다.'}", ": t('championship.venue.inProgress')}");
      s = s.replace('>단계 선택<', ">{t('championship.venue.stageSelect')}<");
      s = s.replace('>나 vs 상대 (참고)<', ">{t('championship.venue.vsOpponent')}<");
      s = s.replace('>없음<', ">{t('championship.venue.none')}<");
      s = s.replace('>입장하기<', ">{t('championship.venue.enter')}<");
      s = s.replace(
        '선택한 단계는 아직 잠겨 있습니다.',
        "{t('championship.venue.stageLocked')}",
      );
      s = s.replace('{selectedStage}단계', "{t('championship.venue.stageUnit', { stage: selectedStage })}");
      return s;
    },
  },
];

export function runPass5Migrations() {
  const ko = readJson('shared/i18n/catalog/ko.json');
  const en = readJson('shared/i18n/catalog/en.json');
  extendCatalogPass5(ko, en);
  writeJson('shared/i18n/catalog/ko.json', ko);
  writeJson('shared/i18n/catalog/en.json', en);

  let modified = 0;
  for (const { file, fn } of migrations) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const before = read(file);
    const after = fn(before);
    if (after !== before) {
      write(file, after);
      modified++;
      console.log('Pass5:', file);
    }
  }
  console.log(`Pass5 done: ${modified} files modified.`);
  return modified;
}
