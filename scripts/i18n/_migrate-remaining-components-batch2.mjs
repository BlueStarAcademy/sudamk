/**
 * Batch 2: more component i18n migrations.
 * Run: node scripts/i18n/_migrate-remaining-components-batch2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function writeJson(rel, obj) { fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8'); }
function readFile(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function writeFile(rel, c) { fs.writeFileSync(path.join(root, rel), c, 'utf8'); }

const ko = readJson('shared/i18n/catalog/ko.json');
const en = readJson('shared/i18n/catalog/en.json');

Object.assign(ko.shop.actionPoint, {
  manageTitle: '행동력 관리',
  currentAp: '현재 행동력',
  noInfo: '정보 없음',
  hint: '회복제 사용 또는 다이아로 즉시 충전할 수 있습니다.',
  ownedPotions: '보유 행동력 회복제',
  noPotions: '가방에 행동력 회복제가 없습니다.',
  ownedCount: '보유: {{count}}개',
  useButton: '사용하기',
  diamondRecharge: '다이아로 행동력 충전',
  exceedMaxHint: '최대치를 초과해서도 바로 충전됩니다.',
  diamondAlt: '다이아',
});
Object.assign(en.shop.actionPoint, {
  manageTitle: 'Action points',
  currentAp: 'Current AP',
  noInfo: 'No data',
  hint: 'Use recovery items or recharge instantly with diamonds.',
  ownedPotions: 'Owned AP recovery items',
  noPotions: 'No AP recovery items in your bag.',
  ownedCount: 'Owned: {{count}}',
  useButton: 'Use',
  diamondRecharge: 'Recharge AP with diamonds',
  exceedMaxHint: 'Can exceed the maximum cap instantly.',
  diamondAlt: 'Diamonds',
});

Object.assign(ko.game.modals, {
  disconnection: {
    title: '플레이어 접속 끊김 ({{count}}/3회)',
    seconds: '초',
    playerDisconnected: '{{name}} 님의 연결이 끊겼습니다.',
    waitingReconnect: '재접속을 기다리는 중입니다...',
    refreshHint: '페이지를 새로고침하여 재접속하세요.',
  },
  insufficientAp: {
    title: '행동력 부족',
    rechargeMethods: '충전 방법',
    shopConsumables: '상점 · 소모품',
    buyPotion: '행동력 회복제 구매',
    buyPotionLimit: ' · 종류별 하루 1개',
    diamondInstant: '다이아 즉시 충전',
    diamondInstantHint: '원할 때 바로 행동력을 채울 수 있습니다.',
    goShopConsumables: '상점(소모품)에서 회복제 구매',
    goDiamondRecharge: '다이아로 즉시 충전',
    selfHeading: '본인의 행동력이 부족합니다.',
    selfDetail: '대국을 시작하려면 행동력이 필요합니다. 아래 방법으로 충전해 주세요.',
  },
});
Object.assign(en.game.modals, {
  disconnection: {
    title: 'Player disconnected ({{count}}/3)',
    seconds: 'sec',
    playerDisconnected: '{{name}} has disconnected.',
    waitingReconnect: 'Waiting for reconnect…',
    refreshHint: 'Refresh the page to reconnect.',
  },
  insufficientAp: {
    title: 'Insufficient action points',
    rechargeMethods: 'How to recharge',
    shopConsumables: 'Shop · consumables',
    buyPotion: 'Buy AP recovery items',
    buyPotionLimit: ' · one per type per day',
    diamondInstant: 'Instant diamond recharge',
    diamondInstantHint: 'Fill action points whenever you need.',
    goShopConsumables: 'Buy recovery items (shop consumables)',
    goDiamondRecharge: 'Instant recharge with diamonds',
    selfHeading: 'You do not have enough action points.',
    selfDetail: 'Action points are required to start a game. Recharge using the options below.',
  },
});

Object.assign(ko.common, {
  ads: {
    label: '광고',
    bannerPlaceholder: '광고 영역 ({{width}}×{{height}})',
    interstitialPlaceholder: '전면 광고 영역 (336×280)',
    cancel: '취소',
    claimReward: '보상 받기',
    claimRewardIn: '{{seconds}}초 후 보상 받기',
    close: '닫기',
    skipIn: '{{seconds}}초 후 스킵 가능',
  },
  help: {
    title: '도움말',
    gameRules: '게임 규칙',
    modeHowTo: '{{mode}} 게임 방법',
    modeRulesSummary: '모드별 규칙 요약',
    strategicLobby: '전략바둑 대기실 도움말',
    playfulLobby: '놀이바둑 대기실 도움말',
    guild: '길드 도움말',
    guildBoss: '길드 보스전 도움말',
  },
});
Object.assign(en.common, {
  ads: {
    label: 'Ad',
    bannerPlaceholder: 'Ad area ({{width}}×{{height}})',
    interstitialPlaceholder: 'Interstitial ad (336×280)',
    cancel: 'Cancel',
    claimReward: 'Claim reward',
    claimRewardIn: 'Claim reward in {{seconds}}s',
    close: 'Close',
    skipIn: 'Skip in {{seconds}}s',
  },
  help: {
    title: 'Help',
    gameRules: 'Game rules',
    modeHowTo: 'How to play {{mode}}',
    modeRulesSummary: 'Mode rules summary',
    strategicLobby: 'Strategy lobby help',
    playfulLobby: 'Casual lobby help',
    guild: 'Guild help',
    guildBoss: 'Guild boss help',
  },
});

writeJson('shared/i18n/catalog/ko.json', ko);
writeJson('shared/i18n/catalog/en.json', en);

function patchFile(file, fn) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { console.warn('missing', file); return false; }
  const orig = readFile(file);
  const next = fn(orig);
  if (next !== orig) { writeFile(file, next); console.log('Patched', file); return true; }
  return false;
}

let n = 0;

// SinglePlayerLobby
if (patchFile('components/SinglePlayerLobby.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  c = c.replace("const SINGLE_PLAYER_LOBBY_TITLE = '바둑학원';\n\n", '');
  c = c.replace(
    'const SinglePlayerLobby: React.FC = () => {\n    const { currentUser',
    "const SinglePlayerLobby: React.FC = () => {\n    const { t } = useTranslation('lobby');\n    const { t: tNav } = useTranslation('nav');\n    const lobbyTitle = tNav('dock.singleplayer');\n    const { currentUser",
  );
  c = c.replace(/title={SINGLE_PLAYER_LOBBY_TITLE}/g, 'title={lobbyTitle}');
  c = c.replace('aria-label="바둑학원 하단"', "aria-label={t('singleplayer.lobbyBottomTabsAria')}");
  c = c.replace(
    /aria-label=\{\s*hasTrainingQuestRewardToClaim\s*\?\s*'수련과제, 수령 가능한 보상이 있습니다'\s*:\s*'수련과제'\s*\}/,
    "aria-label={hasTrainingQuestRewardToClaim ? t('singleplayer.trainingQuestRewardAria') : t('singleplayer.trainingQuestTab')}",
  );
  c = c.replace('>수련과제<', ">{t('singleplayer.trainingQuestTab')}<");
  c = c.replace('title="수령 가능한 보상"', "title={t('profile.claimableReward')}");
  c = c.replace('>스테이지<', ">{t('singleplayer.stageTab')}<");
  return c;
})) n++;

// Header remaining strings
if (patchFile('components/Header.tsx', (c) => {
  c = c.replace('title="행동력 충전 (상점)"', "title={tNav('header.actionPointRechargeShop')}");
  c = c.replace('alt="행동력 충전"', "alt={tNav('header.actionPointRecharge')}");
  c = c.replace('title="길드·챔피언십 참여권"', "title={tNav('header.participationTickets')}");
  c = c.replace(/title="길드 코인·챔프 코인"/g, "title={tNav('header.guildChampCoins')}");
  c = c.replace(/\n\s*관리자\n/, "\n                            {tNav('header.admin')}\n");
  return c;
})) n++;

// ActionPointModal
if (patchFile('components/ActionPointModal.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  c = c.replace(
    'const ActionPointModal: React.FC<ActionPointModalProps> = ({ currentUser, onClose, onAction, isTopmost, embedded = false }) => {',
    "const ActionPointModal: React.FC<ActionPointModalProps> = ({ currentUser, onClose, onAction, isTopmost, embedded = false }) => {\n    const { t } = useTranslation('shop');\n    const { t: tCommon } = useTranslation('common');",
  );
  c = c.replace('현재 행동력', "{t('actionPoint.currentAp')}");
  c = c.replace(": '정보 없음'", ": t('actionPoint.noInfo')");
  c = c.replace('회복제 사용 또는 다이아로 즉시 충전할 수 있습니다.', "{t('actionPoint.hint')}");
  c = c.replace('보유 행동력 회복제', "{t('actionPoint.ownedPotions')}");
  c = c.replace('가방에 행동력 회복제가 없습니다.', "{t('actionPoint.noPotions')}");
  c = c.replace('보유: {group.total.toLocaleString()}개', "{t('actionPoint.ownedCount', { count: group.total.toLocaleString() })}");
  c = c.replace('>사용하기<', ">{t('actionPoint.useButton')}<");
  c = c.replace('다이아로 행동력 충전', "{t('actionPoint.diamondRecharge')}");
  c = c.replace('>행동력 충전<', ">{t('actionPoint.title')}<");
  c = c.replace('최대치를 초과해서도 바로 충전됩니다.', "{t('actionPoint.exceedMaxHint')}");
  c = c.replace('alt="다이아"', "alt={t('actionPoint.diamondAlt')}");
  c = c.replace('오늘 구매 {purchasesToday}/{MAX_ACTION_POINT_PURCHASES_PER_DAY}', "{t('actionPoint.todayPurchases', { current: purchasesToday, max: MAX_ACTION_POINT_PURCHASES_PER_DAY })}");
  c = c.replace('오늘 구매 한도에 도달했습니다.', "{t('actionPoint.dailyLimitReached')}");
  c = c.replace('다이아가 부족합니다.', "{t('actionPoint.insufficientDiamonds')}");
  c = c.replace('title="행동력 관리"', "title={t('actionPoint.manageTitle')}");
  return c;
})) n++;

// DisconnectionModal
if (patchFile('components/DisconnectionModal.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  c = c.replace(
    'const DisconnectionModal: React.FC<DisconnectionModalProps> = ({ session, currentUser }) => {',
    "const DisconnectionModal: React.FC<DisconnectionModalProps> = ({ session, currentUser }) => {\n    const { t } = useTranslation('game');",
  );
  c = c.replace('플레이어 접속 끊김 ({count}/3회)', "{t('modals.disconnection.title', { count })}");
  c = c.replace('>초<', ">{t('modals.disconnection.seconds')}<");
  c = c.replace(
    '<span className="font-bold">{disconnectedPlayer.nickname}</span> 님의 연결이 끊겼습니다.',
    "{t('modals.disconnection.playerDisconnected', { name: disconnectedPlayer.nickname })}",
  );
  c = c.replace('재접속을 기다리는 중입니다...', "{t('modals.disconnection.waitingReconnect')}");
  c = c.replace('페이지를 새로고침하여 재접속하세요.', "{t('modals.disconnection.refreshHint')}");
  return c;
})) n++;

// InsufficientActionPointsModal
if (patchFile('components/InsufficientActionPointsModal.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  c = c.replace(
    "import { SELF_INSUFFICIENT_AP_HEADING, SELF_INSUFFICIENT_AP_DETAIL } from '../constants.js';\n",
    '',
  );
  c = c.replace(
    'function SelfModalContent({',
    "function SelfModalContent({\n    t,\n",
  );
  c = c.replace(
    '}: {\n    onClose: () => void;\n    goShopConsumables: () => void;\n    goDiamondRecharge: () => void;\n    embeddedInWindow?: boolean;\n}) {',
    "}: {\n    t: (key: string, opts?: Record<string, unknown>) => string;\n    onClose: () => void;\n    goShopConsumables: () => void;\n    goDiamondRecharge: () => void;\n    embeddedInWindow?: boolean;\n}) {",
  );
  c = c.replace('행동력 부족', "{t('modals.insufficientAp.title')}");
  c = c.replace('{SELF_INSUFFICIENT_AP_HEADING}', "{t('modals.insufficientAp.selfHeading')}");
  c = c.replace('{SELF_INSUFFICIENT_AP_DETAIL}', "{t('modals.insufficientAp.selfDetail')}");
  c = c.replace('충전 방법', "{t('modals.insufficientAp.rechargeMethods')}");
  c = c.replace('상점 · 소모품', "{t('modals.insufficientAp.shopConsumables')}");
  c = c.replace('행동력 회복제 구매', "{t('modals.insufficientAp.buyPotion')}");
  c = c.replace(' · 종류별 하루 1개', "{t('modals.insufficientAp.buyPotionLimit')}");
  c = c.replace('다이아 즉시 충전', "{t('modals.insufficientAp.diamondInstant')}");
  c = c.replace('원할 때 바로 행동력을 채울 수 있습니다.', "{t('modals.insufficientAp.diamondInstantHint')}");
  c = c.replace('상점(소모품)에서 회복제 구매', "{t('modals.insufficientAp.goShopConsumables')}");
  c = c.replace('다이아로 즉시 충전', "{t('modals.insufficientAp.goDiamondRecharge')}");
  c = c.replace('>닫기<', ">{t('actions.close', { ns: 'common' })}<".replace("t('actions.close', { ns: 'common' })", "tCommon('actions.close')"));
  // fix close button - use tCommon properly
  c = c.replace(">{t('actions.close', { ns: 'common' })}<", ">{tCommon('actions.close')}<");
  c = c.replace(
    'const InsufficientActionPointsModal: React.FC<InsufficientActionPointsModalProps> = ({',
    "const InsufficientActionPointsModal: React.FC<InsufficientActionPointsModalProps> = ({\n    // placeholder",
  );
  c = c.replace(
    '    // placeholder\n    onClose,',
    '    onClose,',
  );
  c = c.replace(
    '}) => {\n    const { isNativeMobile',
    "}) => {\n    const { t } = useTranslation('game');\n    const { t: tCommon } = useTranslation('common');\n    const { isNativeMobile",
  );
  c = c.replace('aria-label="닫기"', "aria-label={tCommon('actions.close')}");
  c = c.replace('title="행동력 부족"', "title={t('modals.insufficientAp.title')}");
  c = c.replace(
    '<SelfModalContent\n                            onClose={onClose}',
    '<SelfModalContent\n                            t={t}\n                            onClose={onClose}',
  );
  c = c.replace(
    '<SelfModalContent\n                onClose={onClose}',
    '<SelfModalContent\n                t={t}\n                onClose={onClose}',
  );
  return c;
})) n++;

// AdBanner
if (patchFile('components/ads/AdBanner.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  c = c.replace(/export (default )?function AdBanner/, "export function AdBanner");
  c = c.replace('export function AdBanner', "export function AdBanner");
  if (!c.includes("useTranslation('common')")) {
    c = c.replace('}: AdBannerProps) {', "}: AdBannerProps) {\n  const { t } = useTranslation('common');");
  }
  c = c.replace(
    '광고 영역 ({size.width}×{size.height})',
    "{t('ads.bannerPlaceholder', { width: size.width, height: size.height })}",
  );
  return c;
})) n++;

// AdInterstitial
if (patchFile('components/ads/AdInterstitial.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  c = c.replace('export default function AdInterstitial', 'function AdInterstitial');
  if (!c.includes('useTranslation')) {
    c = c.replace('const { interstitial', "const { t } = useTranslation('common');\n  const { interstitial");
  }
  c = c.replace('>광고<', ">{t('ads.label')}<");
  c = c.replace('전면 광고 영역 (336×280)', "{t('ads.interstitialPlaceholder')}");
  c = c.replace('>취소<', ">{t('ads.cancel')}<");
  c = c.replace("'보상 받기'", "t('ads.claimReward')");
  c = c.replace('`${interstitial.skipCountdown}초 후 보상 받기`', "t('ads.claimRewardIn', { seconds: interstitial.skipCountdown })");
  c = c.replace("'닫기'", "t('ads.close')");
  c = c.replace('`${interstitial.skipCountdown}초 후 스킵 가능`', "t('ads.skipIn', { seconds: interstitial.skipCountdown })");
  if (!c.includes('export default AdInterstitial')) c += '\nexport default AdInterstitial;\n';
  return c;
})) n++;

// HelpModal
if (patchFile('components/HelpModal.tsx', (c) => {
  if (!c.includes('react-i18next')) c = "import { useTranslation } from 'react-i18next';\n" + c;
  // Convert LOBBY_HELP to use keys - patch the component render instead
  c = c.replace(
    'const HelpModal: React.FC<HelpModalProps> = ({ mode, onClose, isTopmost }) => {',
    "const HelpModal: React.FC<HelpModalProps> = ({ mode, onClose, isTopmost }) => {\n    const { t } = useTranslation('common');",
  );
  c = c.replace("title: `${rules.title} 게임 방법`", "title: t('help.modeHowTo', { mode: rules.title })");
  c = c.replace("tagline: '모드별 규칙 요약'", "tagline: t('help.modeRulesSummary')");
  c = c.replace("title: '전략바둑 대기실 도움말'", "title: t('help.strategicLobby')");
  c = c.replace("title: '놀이바둑 대기실 도움말'", "title: t('help.playfulLobby')");
  c = c.replace("title: '길드 도움말'", "title: t('help.guild')");
  c = c.replace("title: '길드 보스전 도움말'", "title: t('help.guildBoss')");
  c = c.replace('title="도움말"', 'title={t(\'help.title\')}');
  c = c.replace("label: '게임 규칙'", "label: t('help.gameRules')");
  return c;
})) n++;

console.log(`\nBatch 2: ${n} files patched, catalog updated.`);
