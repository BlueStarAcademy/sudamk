/**
 * Batch i18n migration for remaining components.
 * Run: node scripts/i18n/_migrate-remaining-components.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function writeJson(rel, obj) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function readFile(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function writeFile(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
}

const ko = readJson('shared/i18n/catalog/ko.json');
const en = readJson('shared/i18n/catalog/en.json');

// --- common extensions ---
Object.assign(ko.common, {
  alerts: { ...(ko.common.alerts || {}), title: '알림' },
  backAria: '뒤로가기',
  pointsSuffix: '{{count}}점',
  installPrompt: {
    title: '앱 설치하기',
    body: 'SUDAM을 설치하여 더 빠르고 편리하게 이용하세요. 바탕화면에 바로가기를 추가할 수 있습니다.',
    install: '설치하기',
    later: '나중에',
  },
  inAppBrowser: {
    title: '브라우저에서 열기',
    body: '카카오톡·메신저 안에서는 화면이 돌아가거나 위쪽이 잘리는 문제가 있을 수 있습니다. Chrome·Safari 등 기본 브라우저에서 플레이해 주세요.',
    bodyStrong: '기본 브라우저',
    openExternal: '외부 브라우저에서 열기',
    menuHint: '버튼이 동작하지 않으면 ⋯ 메뉴에서 「Safari/Chrome에서 열기」를 선택해 주세요.',
  },
  manner: {
    label: '매너',
    infoTitle: '매너 등급 정보',
    infoButton: '정보',
    scoreTitle: '{{score}}점 · {{rank}}',
  },
  diamondAria: '다이아 {{amount}}',
});
Object.assign(en.common, {
  alerts: { ...(en.common.alerts || {}), title: 'Notice' },
  backAria: 'Go back',
  pointsSuffix: '{{count}} pts',
  installPrompt: {
    title: 'Install app',
    body: 'Install SUDAM for a faster experience. You can add a shortcut to your home screen.',
    install: 'Install',
    later: 'Later',
  },
  inAppBrowser: {
    title: 'Open in browser',
    body: 'In KakaoTalk or other in-app browsers the screen may rotate or clip. Please play in Chrome, Safari, or your default browser.',
    bodyStrong: 'default browser',
    openExternal: 'Open in external browser',
    menuHint: 'If the button does not work, use ⋯ and choose "Open in Safari/Chrome".',
  },
  manner: {
    label: 'Manner',
    infoTitle: 'Manner grade info',
    infoButton: 'Info',
    scoreTitle: '{{score}} pts · {{rank}}',
  },
  diamondAria: 'Diamonds {{amount}}',
});

// --- auth callback ---
Object.assign(ko.auth, {
  callback: {
    noAuthCode: '인증 코드를 받을 수 없습니다.',
    kakaoProcessing: '카카오 로그인 처리 중...',
    kakaoProcessError: '카카오 로그인 처리 중 오류가 발생했습니다.',
    googleProcessing: '구글 로그인 처리 중...',
    googleProcessError: '구글 로그인 처리 중 오류가 발생했습니다.',
    backToLogin: '로그인 페이지로 돌아가기',
  },
});
Object.assign(en.auth, {
  callback: {
    noAuthCode: 'Could not receive authorization code.',
    kakaoProcessing: 'Processing Kakao sign-in…',
    kakaoProcessError: 'An error occurred during Kakao sign-in.',
    googleProcessing: 'Processing Google sign-in…',
    googleProcessError: 'An error occurred during Google sign-in.',
    backToLogin: 'Back to sign-in',
  },
});

// --- nav.header extensions ---
Object.assign(ko.nav.header, {
  actionPointRechargeShop: '행동력 충전 (상점)',
  actionPointRecharge: '행동력 충전',
  participationTickets: '길드·챔피언십 참여권',
  guildChampCoins: '길드 코인·챔프 코인',
  admin: '관리자',
});
Object.assign(en.nav.header, {
  actionPointRechargeShop: 'Recharge action points (shop)',
  actionPointRecharge: 'Recharge action points',
  participationTickets: 'Guild & championship tickets',
  guildChampCoins: 'Guild coins & champ coins',
  admin: 'Admin',
});

// --- lobby.singleplayer extensions ---
Object.assign(ko.lobby.singleplayer, {
  lobbyBottomTabsAria: '바둑학원 하단',
  trainingQuestTab: '수련과제',
  stageTab: '스테이지',
  trainingQuestRewardAria: '수련과제, 수령 가능한 보상이 있습니다',
});
Object.assign(en.lobby.singleplayer, {
  lobbyBottomTabsAria: 'Go academy bottom tabs',
  trainingQuestTab: 'Training quests',
  stageTab: 'Stages',
  trainingQuestRewardAria: 'Training quests — rewards available to claim',
});

// --- exchange ---
Object.assign(ko.exchange.labels, {
  tradeTicket: '거래 등록권',
});
Object.assign(en.exchange.labels, {
  tradeTicket: 'Trade listing ticket',
});

// --- game modals ---
Object.assign(ko.game, {
  modals: {
    noContest: {
      title: '무효 대국',
      body: '10수 미만 대국에서 기권 또는 계가 요청이 있어\n해당 대국은 무효 처리되었습니다.',
      warning: '경고: 반복적으로 무효 대국을 만들 경우, 페널티가 적용될 수 있습니다.',
    },
  },
});
Object.assign(en.game, {
  modals: {
    noContest: {
      title: 'Void game',
      body: 'This game was voided because a resign or scoring request occurred before 10 moves.',
      warning: 'Warning: Repeated void games may incur penalties.',
    },
  },
});

// --- tournament lobby ---
Object.assign(ko.tournament, {
  lobby: {
    title: '챔피언십',
    loadingLobby: '로비 정보를 불러오는 중...',
    loadingCompetitors: '주간 경쟁 상대 정보를 불러오는 중...',
    weeklyCompetitors: '이번주 경쟁 상대',
    noChange: '변화없음',
    viewProfile: '{{name}} 프로필 보기',
    scorePoints: '{{score}}점',
    seasonRecord: '시즌 전적',
    stageSelect: '{{name}} 단계 선택',
    stageUnit: '{{stage}}단계',
    cleared: '✓ 클리어',
    highestStage: '최고 단계',
    recommendedStage: '추천 단계',
    highestStageShort: '최고 {{stage}}단계',
    participationViewResult: '결과 보기',
    participationReward: '보상 완료',
    participationAvailable: '참가 가능',
    enterAndRewardAria: '{{name}} 입장 및 보상 안내',
    participationStatusAria: '참가 상태: {{status}}',
    completed: '✓ 완료',
    inProgress: '진행중',
    duelInfo: '대전정보',
    championshipZoneAria: '챔피언십 구역',
    statsTab: '능력치',
    arenaTab: '경기장',
    shopTab: '챔피언십 상점',
    shopAria: '챔피언십 상점',
    champCoin: '챔프 코인',
    backToProfileAria: '프로필로 돌아가기',
    statsPanelAria: '능력치 패널',
    userTab: '유저',
    petTab: '펫',
    quickMenuAria: '퀵 메뉴',
    presetName: '프리셋 {{index}}',
  },
});
Object.assign(en.tournament, {
  lobby: {
    title: 'Championship',
    loadingLobby: 'Loading lobby info…',
    loadingCompetitors: 'Loading weekly competitors…',
    weeklyCompetitors: 'This week\'s competitors',
    noChange: 'No change',
    viewProfile: 'View {{name}}\'s profile',
    scorePoints: '{{score}} pts',
    seasonRecord: 'Season record',
    stageSelect: 'Select {{name}} stage',
    stageUnit: 'Stage {{stage}}',
    cleared: '✓ Cleared',
    highestStage: 'Best stage',
    recommendedStage: 'Recommended',
    highestStageShort: 'Best stage {{stage}}',
    participationViewResult: 'View results',
    participationReward: 'Reward done',
    participationAvailable: 'Can enter',
    enterAndRewardAria: '{{name}} entry & rewards',
    participationStatusAria: 'Entry status: {{status}}',
    completed: '✓ Done',
    inProgress: 'In progress',
    duelInfo: 'Match info',
    championshipZoneAria: 'Championship area',
    statsTab: 'Stats',
    arenaTab: 'Arena',
    shopTab: 'Championship shop',
    shopAria: 'Championship shop',
    champCoin: 'Champ coins',
    backToProfileAria: 'Back to profile',
    statsPanelAria: 'Stats panel',
    userTab: 'User',
    petTab: 'Pet',
    quickMenuAria: 'Quick menu',
    presetName: 'Preset {{index}}',
  },
});

writeJson('shared/i18n/catalog/ko.json', ko);
writeJson('shared/i18n/catalog/en.json', en);

// --- component file patches ---
const patches = [
  {
    file: 'components/AlertModal.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        "const AlertModal: React.FC<AlertModalProps> = ({ title = '알림', message, onClose, confirmText = '확인', isTopmost = false, windowId }) => {",
        "const AlertModal: React.FC<AlertModalProps> = ({ title, message, onClose, confirmText, isTopmost = false, windowId }) => {\n    const { t } = useTranslation('common');\n    const resolvedTitle = title ?? t('alerts.title');\n    const resolvedConfirm = confirmText ?? t('actions.ok');",
      ],
      ['title={title}', 'title={resolvedTitle}'],
      ['{confirmText}', '{resolvedConfirm}'],
    ],
  },
  {
    file: 'components/InfoModal.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    wrap: true,
    replacements: [
      [
        'const InfoModal: React.FC<InfoModalProps> = ({ onClose, isTopmost, initialSelection }) => (',
        'const InfoModal: React.FC<InfoModalProps> = ({ onClose, isTopmost, initialSelection }) => {\n    const { t } = useTranslation(\'nav\');\n    return (',
      ],
      ["title=\"도움말 센터\"", "title={t('quickMenu.help')}"],
      [');\n\nexport default InfoModal;', ');\n};\n\nexport default InfoModal;'],
    ],
  },
  {
    file: 'components/BackButton.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        'const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {\n    return (',
        "const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {\n    const { t } = useTranslation('common');\n    return (",
      ],
      ['aria-label="뒤로가기"', "aria-label={t('backAria')}"],
    ],
  },
  {
    file: 'components/KakaoCallback.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    hookLine: "const { t } = useTranslation('auth');",
    replacements: [
      ["setError('인증 코드를 받을 수 없습니다.');", "setError(t('callback.noAuthCode'));"],
      ["errorData.message || '카카오 로그인에 실패했습니다.'", "errorData.message || t('errors.kakaoLoginFailed')"],
      ["err.message || '카카오 로그인 처리 중 오류가 발생했습니다.'", "err.message || t('callback.kakaoProcessError')"],
      ['카카오 로그인 처리 중...', "{t('callback.kakaoProcessing')}"],
      ['로그인 페이지로 돌아가기', "{t('callback.backToLogin')}"],
    ],
  },
  {
    file: 'components/GoogleCallback.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    hookLine: "const { t } = useTranslation('auth');",
    replacements: [
      ["setError('인증 코드를 받을 수 없습니다.');", "setError(t('callback.noAuthCode'));"],
      ["errorData.message || '구글 로그인에 실패했습니다.'", "errorData.message || t('errors.googleLoginFailed')"],
      ["err.message || '구글 로그인 처리 중 오류가 발생했습니다.'", "err.message || t('callback.googleProcessError')"],
      ['구글 로그인 처리 중...', "{t('callback.googleProcessing')}"],
      ['로그인 페이지로 돌아가기', "{t('callback.backToLogin')}"],
    ],
  },
  {
    file: 'components/InstallPrompt.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        'const InstallPrompt: React.FC = () => {',
        "const InstallPrompt: React.FC = () => {\n  const { t } = useTranslation('common');",
      ],
      ['앱 설치하기', "{t('installPrompt.title')}"],
      [
        'SUDAM을 설치하여 더 빠르고 편리하게 이용하세요. 바탕화면에 바로가기를 추가할 수 있습니다.',
        "{t('installPrompt.body')}",
      ],
      ['설치하기', "{t('installPrompt.install')}"],
      ['나중에', "{t('installPrompt.later')}"],
      ['aria-label="닫기"', "aria-label={t('actions.close')}"],
      ['>닫기<', ">{t('actions.close')}<"],
    ],
  },
  {
    file: 'components/InAppBrowserEscapeGate.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        'const InAppBrowserEscapeGate: React.FC = () => {',
        "const InAppBrowserEscapeGate: React.FC = () => {\n    const { t } = useTranslation('common');",
      ],
      ['브라우저에서 열기', "{t('inAppBrowser.title')}"],
      [
        '카카오톡·메신저 안에서는 화면이 돌아가거나 위쪽이 잘리는 문제가 있을 수 있습니다. Chrome·Safari 등\n                    <strong className="font-semibold text-white"> 기본 브라우저</strong>에서 플레이해 주세요.',
        "{t('inAppBrowser.body')}",
      ],
      ['외부 브라우저에서 열기', "{t('inAppBrowser.openExternal')}"],
      [
        '버튼이 동작하지 않으면 ⋯ 메뉴에서 「Safari/Chrome에서 열기」를 선택해 주세요.',
        "{t('inAppBrowser.menuHint')}",
      ],
    ],
  },
  {
    file: 'components/mobile/MobileModalTitleBar.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        '}) => (',
        "}) => {\n    const { t } = useTranslation('common');\n    return (",
      ],
      ['aria-label={`${title} 닫기`}', "aria-label={t('modal.closeAria', { title })}"],
      ['>닫기<', ">{t('actions.close')}<"],
      [');\n\nexport default MobileModalTitleBar;', ');\n};\n\nexport default MobileModalTitleBar;'],
    ],
  },
  {
    file: 'components/exchange/ExchangeTradeTicketBadge.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        'export const ExchangeTradeTicketBadge: React.FC<ExchangeTradeTicketBadgeProps> = ({ count, compact = false }) => (',
        "export const ExchangeTradeTicketBadge: React.FC<ExchangeTradeTicketBadgeProps> = ({ count, compact = false }) => {\n    const { t } = useTranslation('exchange');\n    return (",
      ],
      ['title="거래 등록권"', "title={t('labels.tradeTicket')}"],
      ['alt="거래 등록권"', "alt={t('labels.tradeTicket')}"],
      [');', ');\n};', 1],
    ],
  },
  {
    file: 'components/profile/ProfileMannerSeal.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        '}) => {\n    return (',
        "}) => {\n    const { t } = useTranslation('common');\n    return (",
      ],
      ['title={`${score}점 · ${rank}`}', "title={t('manner.scoreTitle', { score, rank })}"],
      ['매너', "{t('manner.label')}"],
      ['{score}점', "{t('pointsSuffix', { count: score })}"],
      ['title="매너 등급 정보"', "title={t('manner.infoTitle')}"],
      ['정보', "{t('manner.infoButton')}"],
    ],
  },
  {
    file: 'components/shell/NavTitleBar.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        '}) => (',
        "}) => {\n    const { t } = useTranslation('common');\n    return (",
      ],
      ['aria-label="뒤로가기"', "aria-label={t('backAria')}"],
      [');\n\nexport default NavTitleBar;', ');\n};\n\nexport default NavTitleBar;'],
    ],
  },
  {
    file: 'components/NoContestModal.tsx',
    ensureImport: "import { useTranslation } from 'react-i18next';\n",
    replacements: [
      [
        'const NoContestModal: React.FC<NoContestModalProps> = ({ session, currentUser, onConfirm, onAction, onOpenGameRecordList, isSpectator = false }) => {',
        "const NoContestModal: React.FC<NoContestModalProps> = ({ session, currentUser, onConfirm, onAction, onOpenGameRecordList, isSpectator = false }) => {\n    const { t } = useTranslation('game');",
      ],
      ['title="무효 대국"', "title={t('modals.noContest.title')}"],
      [
        '10수 미만 대국에서 기권 또는 계가 요청이 있어<br/>\n                        해당 대국은 무효 처리되었습니다.',
        "{t('modals.noContest.body')}",
      ],
      [
        '경고: 반복적으로 무효 대국을 만들 경우, 페널티가 적용될 수 있습니다.',
        "{t('modals.noContest.warning')}",
      ],
    ],
  },
];

let filesModified = 0;
for (const patch of patches) {
  const filePath = path.join(root, patch.file);
  if (!fs.existsSync(filePath)) {
    console.warn('Skip missing:', patch.file);
    continue;
  }
  let content = readFile(patch.file);
  const original = content;

  if (patch.ensureImport && !content.includes('react-i18next')) {
    content = patch.ensureImport + content;
  }
  if (patch.hookLine && !content.includes(patch.hookLine)) {
    content = content.replace(
      /const \[[\w]+, set\w+\] = useState/,
      `${patch.hookLine}\n    $&`,
    );
  }

  for (const [from, to, limit] of patch.replacements) {
    if (limit === 1) {
      const idx = content.indexOf(from);
      if (idx !== -1) content = content.slice(0, idx) + to + content.slice(idx + from.length);
    } else {
      content = content.split(from).join(to);
    }
  }

  if (content !== original) {
    writeFile(patch.file, content);
    filesModified++;
    console.log('Patched:', patch.file);
  }
}

console.log(`\nCatalog updated. ${filesModified} component files patched.`);
