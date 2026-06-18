/**
 * Complete i18n migration for remaining high-traffic modals/lobbies.
 * Run: node scripts/i18n/_migrate-remaining-10-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let applied = 0;
  let skipped = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) {
      console.warn(`SKIP ${file}: ${from.slice(0, 70).replace(/\n/g, ' ')}...`);
      skipped++;
      continue;
    }
    s = s.replace(from, to);
    applied++;
  }
  fs.writeFileSync(p, s);
  console.log(`patched ${file}: ${applied} ok, ${skipped} skipped`);
}

// --- ProfileEditModal ---
patch('components/ProfileEditModal.tsx', [
  [
    `alert("닉네임에 부적절한 단어가 포함되어 있습니다.");`,
    `alert(t('edit.profanityAlert'));`,
  ],
  [
    `if (window.confirm(\`다이아 \${nicknameChangeCost}개를 사용하여 닉네임을 '\${newNickname}'(으)로 변경하시겠습니까?\`)) {`,
    `if (window.confirm(t('edit.nicknameChangeConfirm', { cost: nicknameChangeCost, name: newNickname }))) {`,
  ],
  [
    `const categories: Record<BorderCategory, BorderInfo[]> = {
            '기본': [],
            '레벨제한': [],
            '구매테두리': [],
            '전시즌보상': [],
        };`,
    `const categories: Record<BorderCategory, BorderInfo[]> = {
            basic: [],
            levelLocked: [],
            shop: [],
            seasonReward: [],
        };`,
  ],
  [
    `categories['전시즌보상'].push(border);`,
    `categories.seasonReward.push(border);`,
  ],
  [
    `categories['레벨제한'].push(border);`,
    `categories.levelLocked.push(border);`,
  ],
  [
    `categories['구매테두리'].push(border);`,
    `categories.shop.push(border);`,
  ],
  [
    `categories['기본'].push(border);`,
    `categories.basic.push(border);`,
  ],
  [`aria-label="아바타 목록"`, `aria-label={t('edit.avatarListAria')}`],
  [
    `aria-label={avatar.name ? \`아바타: \${avatar.name}\` : '아바타'}`,
    `aria-label={avatar.name ? t('edit.avatarAria', { name: avatar.name }) : t('edit.avatarDefaultAria')}`,
  ],
  [`<span className="text-[8px] font-bold text-amber-100">잠김</span>`, `<span className="text-[8px] font-bold text-amber-100">{t('edit.locked')}</span>`],
  [
    `{avatar.type === 'strategy' ? '전략' : '놀이'} Lv.{avatar.requiredLevel}`,
    `{avatar.type === 'strategy' ? t('edit.strategyLevel') : t('edit.playfulLevel')} Lv.{avatar.requiredLevel}`,
  ],
  [
    `<p className={\`mb-1.5 shrink-0 px-1 font-semibold text-stone-200 \${isNativeMobile ? 'text-[11px]' : 'px-2 text-xs sm:text-sm'}\`}>아바타 선택</p>`,
    `<p className={\`mb-1.5 shrink-0 px-1 font-semibold text-stone-200 \${isNativeMobile ? 'text-[11px]' : 'px-2 text-xs sm:text-sm'}\`}>{t('edit.avatarSelect')}</p>`,
  ],
  [
    `unlockText = \`이전 시즌 \${border.unlockTier} 티어 필요\`;`,
    `unlockText = t('edit.tierRequired', { tier: border.unlockTier });`,
  ],
  [
    `unlockText = \`레벨 합 \${border.requiredLevelSum} 필요\`;`,
    `unlockText = t('edit.levelSumRequired', { level: border.requiredLevelSum });`,
  ],
  [
    `? \`\${formatGoldAmountKoG(shopItem.price.gold)} 골드\`
                                        : \`\${formatWalletDiamonds(shopItem.price.diamonds ?? 0)} 다이아\`;`,
    `? t('edit.goldPrice', { amount: formatGoldAmountKoG(shopItem.price.gold) })
                                        : t('edit.diamondPrice', { amount: formatWalletDiamonds(shopItem.price.diamonds ?? 0) });`,
  ],
  [
    `if (window.confirm(\`'\${border.name}' 테두리를 \${priceText}로 구매하시겠습니까?\`)) {`,
    `if (window.confirm(t('edit.borderPurchaseConfirm', { name: border.name, price: priceText }))) {`,
  ],
  [
    `? \`클릭하여 구매: \${border.description}\``,
    `? t('edit.borderPurchaseHint', { description: border.description })`,
  ],
  [
    `? \`레벨합 \${border.requiredLevelSum}\``,
    `? t('edit.levelSumShort', { level: border.requiredLevelSum })`,
  ],
  [
    `? \`\${border.unlockTier} 티어\``,
    `? t('edit.tierShort', { tier: border.unlockTier })`,
  ],
  [`aria-label="테두리 종류"`, `aria-label={t('edit.borderCategoryAria')}`],
  [
    `<h3 className={\`font-bold tracking-wide text-amber-100/95 \${isNativeMobile ? 'text-xs' : 'text-sm sm:text-base'}\`}>{category}</h3>`,
    `<h3 className={\`font-bold tracking-wide text-amber-100/95 \${isNativeMobile ? 'text-xs' : 'text-sm sm:text-base'}\`}>{t(\`edit.borderCategories.\${category}\`)}</h3>`,
  ],
  [`새 닉네임`, `{t('edit.newNickname')}`],
  [
    `<p className="mb-3 text-center text-[11px] text-zinc-500">2~6자 · 비속어 불가 · 변경 시 다이아가 소모됩니다</p>`,
    `<p className="mb-3 text-center text-[11px] text-zinc-500">{t('edit.nicknameHint')}</p>`,
  ],
  [`placeholder="닉네임 입력"`, `placeholder={t('edit.nicknamePlaceholder')}`],
  [`<span className="text-zinc-400">변경 비용</span>`, `<span className="text-zinc-400">{t('edit.changeCost')}</span>`],
  [`<span className="text-zinc-400">보유 다이아</span>`, `<span className="text-zinc-400">{t('edit.ownedDiamonds')}</span>`],
  [
    `<h3 className="mb-2 text-lg font-bold tracking-tight text-amber-100 sm:text-xl">MBTI란 무엇인가요?</h3>`,
    `<h3 className="mb-2 text-lg font-bold tracking-tight text-amber-100 sm:text-xl">{t('edit.mbtiWhatTitle')}</h3>`,
  ],
  [
    `MBTI(Myers-Briggs Type Indicator)는 개인의 선호도를 바탕으로 성격 유형을 이해하는 도구입니다.
                                    자신을 더 잘 이해하고 다른 사람들과의 관계를 개선하는 데 도움을 줄 수 있습니다.`,
    `{t('edit.mbtiWhatDesc')}`,
  ],
  [
    `<h4 className="mb-2 mt-5 text-base font-bold text-amber-200/90 sm:text-lg">바둑 MBTI</h4>`,
    `<h4 className="mb-2 mt-5 text-base font-bold text-amber-200/90 sm:text-lg">{t('edit.goMbtiTitle')}</h4>`,
  ],
  [
    `바둑 MBTI는 당신의 바둑 스타일을 MBTI 개념으로 분석한 것입니다.
                                    각 유형마다 고유한 플레이 성향이 있어, 자신에 맞는 스타일을 찾을 수 있습니다.`,
    `{t('edit.goMbtiDesc')}`,
  ],
  [
    `<p className="mb-4 text-sm text-zinc-300">최초 설정 시 다이아 100개를 드립니다</p>`,
    `<p className="mb-4 text-sm text-zinc-300">{t('edit.mbtiFirstReward')}</p>`,
  ],
  [`MBTI 설정하기`, `{t('edit.setupMbti')}`],
  [
    `질문 {mbtiQuestionIndex + 1} / {MBTI_QUESTIONS.length}`,
    `{t('edit.questionProgress', { current: mbtiQuestionIndex + 1, total: MBTI_QUESTIONS.length })}`,
  ],
  [
    `<span className="font-semibold text-amber-200/90">바둑 스타일</span>`,
    `<span className="font-semibold text-amber-200/90">{t('edit.goStyleLabel')}</span>`,
  ],
  [`{MBTI_DETAILS[opt].name}`, `{t(\`edit.mbtiTypes.\${opt}.name\`)}`],
  [
    `const selectedMbtiDetails = [mbti.ei, mbti.sn, mbti.tf, mbti.jp].map((key) => MBTI_DETAILS[key]);`,
    `const selectedMbtiDetails = [mbti.ei, mbti.sn, mbti.tf, mbti.jp].map((key) => ({
                    name: t(\`edit.mbtiTypes.\${key}.name\`),
                    general: t(\`edit.mbtiTypes.\${key}.general\`),
                    goStyle: t(\`edit.mbtiTypes.\${key}.goStyle\`),
                }));`,
  ],
  [
    `<p className="text-[11px] text-zinc-400 sm:text-sm">MBTI는 프로필에 공개됩니다</p>`,
    `<p className="text-[11px] text-zinc-400 sm:text-sm">{t('edit.mbtiPublicHint')}</p>`,
  ],
  [`title="에너지 방향"`, `title={t('edit.energyDirection')}`],
  [`title="인식 기능"`, `title={t('edit.perception')}`],
  [`title="판단 기능"`, `title={t('edit.judgment')}`],
  [`title="생활 양식"`, `title={t('edit.lifestyle')}`],
  [
    `<h4 className="text-sm font-bold text-amber-100 sm:text-base">종합 성향</h4>`,
    `<h4 className="text-sm font-bold text-amber-100 sm:text-base">{t('edit.overallTendency')}</h4>`,
  ],
  [
    `<h5 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200/85">일반적 성향</h5>`,
    `<h5 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200/85">{t('edit.generalTendency')}</h5>`,
  ],
  [
    `<h5 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/85">바둑 성향</h5>`,
    `<h5 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/85">{t('edit.goTendency')}</h5>`,
  ],
  [
    `<span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-sm">나의 MBTI</span>`,
    `<span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-sm">{t('edit.myMbti')}</span>`,
  ],
  [`다시 설정하기`, `{t('edit.resetMbti')}`],
  [
    `const tabs: { id: EditTab; label: string }[] = [
        { id: 'avatar', label: '아바타' },
        { id: 'border', label: '테두리' },
        { id: 'nickname', label: '닉네임' },
        { id: 'mbti', label: 'MBTI' },
    ];`,
    `const tabs: { id: EditTab; label: string }[] = [
        { id: 'avatar', label: t('edit.tabs.avatar') },
        { id: 'border', label: t('edit.tabs.border') },
        { id: 'nickname', label: t('edit.tabs.nickname') },
        { id: 'mbti', label: t('edit.tabs.mbti') },
    ];`,
  ],
  [`? '다이아 부족'`, `? t('edit.insufficientDiamonds')`],
  [`? '다음'`, `? t('edit.next')`],
  [`: '완료'`, `: t('edit.complete')`],
  [`: '저장'`, `: t('edit.save')`],
]);

// --- InventoryModal ---
patch('components/InventoryModal.tsx', [
  [`>사용</Button>`, `>{t('buttons.use')}</Button>`],
  [`>사용\n`, `>{t('buttons.use')}\n`],
  [`재료변환`, `{t('buttons.materialConvert')}`],
  [`장착 장비`, `{t('equippedGear')}`],
  [`장착장비`, `{t('labels.equippedGearCompact')}`],
  [`title="장착된 장비 없음"`, `title={t('noEquippedGear')}`],
  [`['info', '장비정보']`, `['info', t('compareTabs.info')]`],
  [`['mainSub', '주/부옵션']`, `['mainSub', t('compareTabs.mainSub')]`],
  [`['special', '특수옵션']`, `['special', t('compareTabs.special')]`],
  [`['mythic', '신화옵션']`, `['mythic', t('compareTabs.mythic')]`],
  [`?? '장비 없음'`, `?? t('noGear')`],
  [`: '제련불가'`, `: t('refinementUnavailable')`],
  [
    `{correspondingEquippedItem?.name ?? '장비 없음'}`,
    `{correspondingEquippedItem?.name ?? t('noGear')}`,
  ],
  [
    `{\`제련 가능 : \${currentRefine}\`}`,
    `{t('labels.refinementAvailableColon', { value: currentRefine })}`,
  ],
  [
    `{\`제련 가능 : \${selectedRefine}\`}`,
    `{t('labels.refinementAvailableColon', { value: selectedRefine })}`,
  ],
  [`>저장</Button>`, `>{t('presetSave')}</Button>`],
  [`현재 장착`, `{t('currentlyEquipped')}`],
  [`이전 선택`, `{t('labels.previousSelection')}`],
]);

// --- NegotiationModal ---
patch('components/NegotiationModal.tsx', [
  [
    `return <span className="text-lg font-bold tabular-nums">({countdown}초)</span>;`,
    `return <span className="text-lg font-bold tabular-nums">{t('countdownSec', { count: countdown })}</span>;`,
  ],
  [
    `const CountdownDisplay: React.FC<{ deadline: number }> = ({ deadline }) => {
    const [countdown, setCountdown] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));`,
    `const CountdownDisplay: React.FC<{ deadline: number }> = ({ deadline }) => {
    const { t } = useTranslation('negotiation');
    const [countdown, setCountdown] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));`,
  ],
  [`return { level, levelLabel: '유저', wins, losses, mannerScore, winRate };`, `return { level, levelLabel: t('userLevel'), wins, losses, mannerScore, winRate };`],
  [
    `<p className="font-semibold">{opponentStats.wins}승 {opponentStats.losses}패 ({opponentStats.winRate}%)</p>`,
    `<p className="font-semibold">{t('record', { wins: opponentStats.wins, losses: opponentStats.losses, winRate: opponentStats.winRate })}</p>`,
  ],
  [
    `<p className="text-gray-300">매너: {opponentStats.mannerScore}점</p>`,
    `<p className="text-gray-300">{t('manner', { score: opponentStats.mannerScore })}</p>`,
  ],
  [
    `<h3 className="mb-1 text-base font-semibold text-gray-300">믹스룰 조합 (2개 이상 선택)</h3>`,
    `<h3 className="mb-1 text-base font-semibold text-gray-300">{t('mixRulesTitle')}</h3>`,
  ],
  [
    `함께 적용할 규칙을 고릅니다. (클래식 바둑은 기본으로 포함됩니다.)
                                따내기와 캐슬은 동시에 선택할 수 없습니다.`,
    `{t('mixRulesHint')}`,
  ],
  [
    `title={mixDisabled ? '따내기와 캐슬은 동시에 선택할 수 없습니다.' : undefined}`,
    `title={mixDisabled ? t('mixCaptureCastleConflict') : undefined}`,
  ],
  [`label="베이스돌 개수"`, `label={t('settings.baseStones')}`],
  [`label="히든돌 개수"`, `label={t('settings.hiddenStones')}`],
  [`label="스캔 개수"`, `label={t('settings.scanCount')}`],
  [`label="미사일 개수"`, `label={t('settings.missileCount')}`],
  [`label="목표점수"`, `label={t('settings.captureTarget')}`],
  [`label="캐슬"`, `label={t('settings.castle')}`],
  [`label="판 크기"`, `label={t('settings.boardSize')}`],
  [`label="기물 총점수"`, `label={t('settings.totalScore')}`],
  [`label="계가까지 턴"`, `label={t('settings.scoringTurns')}`],
  [`label="덤 (백)"`, `label={t('settings.komiWhite')}`],
  [`label="시작 역할"`, `label={t('settings.startRole')}`],
  [`label="내 돌 색"`, `label={t('settings.myStoneColor')}`],
  [`label="라운드"`, `label={t('settings.round')}`],
  [`label="홀수주사위"`, `label={t('settings.oddDice')}`],
  [`label="짝수주사위"`, `label={t('settings.evenDice')}`],
  [`label="(고)주사위"`, `label={t('settings.highDice')}`],
  [`label="(저)주사위"`, `label={t('settings.lowDice')}`],
  [`label="방지주사위"`, `label={t('settings.blockDice')}`],
  [`label="쌍삼 금지"`, `label={t('settings.forbid33')}`],
  [`label="장목 금지"`, `label={t('settings.forbidOverline')}`],
  [`label="배치 방식"`, `label={t('settings.placementType')}`],
  [`label="배치 전장"`, `label={t('settings.placementField')}`],
  [`label="바둑돌 개수"`, `label={t('settings.stoneCount')}`],
  [`label="힘 속도"`, `label={t('settings.gaugeSpeed')}`],
  [`label="슬로우"`, `label={t('settings.slow')}`],
  [`label="조준선"`, `label={t('settings.aimingLine')}`],
  [`label="스톤 개수"`, `label={t('settings.stoneCount')}`],
  [`{c}개</option>`, `{t('countUnit', { count: c })}</option>`],
  [`{size}줄`, `{t('boardLines', { size })}`],
  [`<span className="text-base text-gray-200">9점 (고정)</span>`, `<span className="text-base text-gray-200">{t('pointsFixed')}</span>`],
  [`{score}점`, `{t('pointsUnit', { score })}`],
  [`{limit}수`, `{t('turnsUnit', { limit })}`],
  [`<span className="whitespace-nowrap text-xl font-bold text-gray-300">.5 집</span>`, `<span className="whitespace-nowrap text-xl font-bold text-gray-300">{t('komiHalf')}</span>`],
  [`<option value={Player.Black}>도둑(흑)</option>`, `<option value={Player.Black}>{t('roles.thiefBlack')}</option>`],
  [`<option value={Player.White}>경찰(백)</option>`, `<option value={Player.White}>{t('roles.policeWhite')}</option>`],
]);

console.log('Done.');
