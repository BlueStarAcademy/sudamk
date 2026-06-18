/**
 * Part 2: Exchange, Tower, Shop bulk i18n patches.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits, replaceAll = false) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let applied = 0;
  let skipped = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) {
      console.warn(`SKIP ${file}: ${from.slice(0, 60)}...`);
      skipped++;
      continue;
    }
    s = replaceAll ? s.replaceAll(from, to) : s.replace(from, to);
    applied++;
  }
  fs.writeFileSync(p, s);
  console.log(`patched ${file}: ${applied} ok, ${skipped} skipped`);
}

// --- ExchangeModal ---
patch('components/ExchangeModal.tsx', [
  [`|| '장비'`, `|| t('fallbackGear')`],
  [
    `currency === 'gold' ? '골드' : '다이아'`,
    `currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')`,
  ],
  [
    `name: isGold ? '골드' : '다이아몬드'`,
    `name: isGold ? tCommon('resources.gold') : tCommon('resources.diamonds')`,
  ],
  [`<span>최근 거래가</span>`, `<span>{t('labels.recentPrice')}</span>`],
  [`<span>남은 시간</span>`, `<span>{t('labels.timeRemaining')}</span>`],
  [
    `{buyRemainingDays}일 {buyRemainingHours}시간`,
    `{t('labels.timeDaysHours', { days: buyRemainingDays, hours: buyRemainingHours })}`,
  ],
  [`<p className={sellFormLabel}>판매 재화 종류</p>`, `<p className={sellFormLabel}>{t('labels.sellCurrency')}</p>`],
  [
    `<span className={\`\${sellFormText} font-semibold text-amber-100\`}>골드</span>`,
    `<span className={\`\${sellFormText} font-semibold text-amber-100\`}>{tCommon('resources.gold')}</span>`,
  ],
  [
    `<span className={\`\${sellFormText} font-semibold text-sky-100\`}>다이아</span>`,
    `<span className={\`\${sellFormText} font-semibold text-sky-100\`}>{tCommon('resources.diamonds')}</span>`,
  ],
  [`<span className={sellFormLabel}>판매 가격 입력</span>`, `<span className={sellFormLabel}>{t('labels.sellPriceInput')}</span>`],
  [`<span>현재 최저가</span>`, `<span>{t('labels.currentLowest')}</span>`],
  [`<span>수수료(10%)</span>`, `<span>{t('labels.feePercent')}</span>`],
  [`confirmText="확인"`, `confirmText={tCommon('actions.confirm')}`],
  [
    `gradeStyle?.name ?? '일반'`,
    `gradeStyle?.name ?? t('filters.gradeNormal')`,
  ],
  [`<span className="text-slate-300">판매 가격</span>`, `<span className="text-slate-300">{t('labels.salePrice')}</span>`],
  [
    `<span className="text-slate-300">등록 수수료(10%)</span>`,
    `<span className="text-slate-300">{t('labels.registrationFee')}</span>`,
  ],
  [`취소`, `{tCommon('actions.cancel')}`],
  [`등록`, `{t('labels.registerSale')}`],
  [`title="거래등록권 1장 사용"`, `title={t('modals.useTicketTitle')}`],
  [`alt="거래 등록권"`, `alt={t('modals.useTicket')}`],
  [
    `<p className="text-sm font-semibold text-amber-100">거래등록권 1장 사용</p>`,
    `<p className="text-sm font-semibold text-amber-100">{t('modals.useTicket')}</p>`,
  ],
  [`title="판매 취소 확인"`, `title={t('modals.cancelSaleConfirm')}`],
  [
    `등록시 발생한 수수료는 반납되지 않습니다.`,
    `{t('alerts.registrationFeeNonRefundable')}`,
  ],
  [`등록취소`, `{tCommon('actions.cancel')}`],
  [`유지`, `{t('labels.keep', { defaultValue: 'Keep' })}`],
  [`구매가 완료되었습니다.`, `{t('labels.purchaseCompleteMessage', { defaultValue: t('labels.purchaseComplete') })}`],
  [
    `{selectedBuyListingIsMine ? '내 등록 물품' : '구매'}`,
    `{selectedBuyListingIsMine ? t('labels.myListing') : t('modals.purchase')}`,
  ],
  [`title="장비 선택"`, `title={t('modals.selectGear')}`],
  [
    `<p className="text-[11px] font-semibold leading-snug text-slate-300">장비를 선택하세요</p>`,
    `<p className="text-[11px] font-semibold leading-snug text-slate-300">{t('labels.selectGearHint')}</p>`,
  ],
  [
    `<p className="text-[11px] font-medium leading-snug text-slate-500">아래 그리드에서 탭한 뒤 오른쪽에서 가격·수수료를 확인하세요.</p>`,
    `<p className="text-[11px] font-medium leading-snug text-slate-500">{t('labels.selectGearSub')}</p>`,
  ],
  [`aria-label="인벤토리 정렬"`, `aria-label={t('sort.label', { defaultValue: 'Sort' })}`],
  [`<option value="createdAt">최신순</option>`, `<option value="createdAt">{t('sort.newest')}</option>`],
  [`<option value="grade">등급순</option>`, `<option value="grade">{t('sort.grade')}</option>`],
  [`<option value="name">이름순</option>`, `<option value="name">{t('sort.name')}</option>`],
  [`판매등록`, `{t('labels.registerSale')}`],
  [`구매`, `{t('modals.purchase')}`],
  [`정산`, `{t('tabs.settlement')}`],
  [`거래이력`, `{t('tabs.history')}`],
  [
    `거래 물품 정보를 불러오는 중입니다…`,
    `{t('loading.items', { defaultValue: 'Loading trade items…' })}`,
  ],
  [
    `서버에서 최신 목록을 받아오는 동안 잠시만 기다려 주세요.`,
    `{t('loading.wait', { defaultValue: 'Please wait while we fetch the latest list.' })}`,
  ],
  [`placeholder="아이템 검색"`, `placeholder={t('labels.searchPlaceholder')}`],
  [`aria-label="거래소 목록 새로고침"`, `aria-label={t('labels.refresh')}`],
  [`title="새로고침"`, `title={t('labels.refresh')}`],
  [
    `? '구매 완료'`,
    `? t('labels.purchaseComplete')`,
  ],
  [
    `? '정산 수령'`,
    `? t('labels.settlementReceived')`,
  ],
]);

// --- TowerLobby ---
patch('components/TowerLobby.tsx', [
  [`alt="골드"`, `alt={tCommon('resources.gold')}`],
  [`title="골드"`, `title={tCommon('resources.gold')}`],
  [`alt="흑"`, `alt={t('black')}`],
  [`alt="백"`, `alt={t('white')}`],
  [`alt="흑 문양"`, `alt={t('blackPatternAlt')}`],
  [`alt="베이스"`, `alt={t('baseAlt')}`],
  [`>바둑판</span>`, `>{t('board')}</span>`],
  [
    `title={\`바둑판 \${stage.boardSize}×\${stage.boardSize}\`}`,
    `title={t('boardSize', { size: stage.boardSize })}`,
  ],
  [`>목표</span>`, `>{t('goal')}</span>`],
  [`>제한</span>`, `>{t('limit')}</span>`],
  [`>계가</span>`, `>{t('scoring')}</span>`],
  [
    `<span className="text-yellow-300 font-bold">흑 {towerDisplayBlackTarget}개</span>`,
    `<span className="text-yellow-300 font-bold">{t('blackCaptureGoal', { count: towerDisplayBlackTarget })}</span>`,
  ],
  [
    `<span className="text-amber-200 font-bold tabular-nums">{stage.blackTurnLimit}턴</span>`,
    `<span className="text-amber-200 font-bold tabular-nums">{t('turnUnit', { count: stage.blackTurnLimit })}</span>`,
  ],
  [
    `<span className="text-sky-300 font-bold">베이스{stage.baseStones}</span>`,
    `<span className="text-sky-300 font-bold">{t('base')}{stage.baseStones}</span>`,
  ],
  [`<span className="text-[10px] leading-none sm:text-xs">도전</span>`, `<span className="text-[10px] leading-none sm:text-xs">{t('challenge')}</span>`],
  [
    `10층 이상 클리어 시 랭킹에 표시됩니다.`,
    `{t('rankingHint')}`,
  ],
  [
    `<p className="py-6 text-center text-sm text-amber-300/60">랭킹 불러오는 중...</p>`,
    `<p className="py-6 text-center text-sm text-amber-300/60">{t('rankingLoading')}</p>`,
  ],
]);

// --- ShopModal ---
patch('components/ShopModal.tsx', [
  [
    `const CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE = '아직 구현되지 않았습니다.';`,
    ``,
  ],
  [
    `<p className={groupTitleClass}>매일 우편</p>`,
    `<p className={groupTitleClass}>{t('dailyMail')}</p>`,
  ],
  [
    `>× {durationDays}일</span>`,
    `>{t('daysMultiplier', { days: durationDays })}</span>`,
  ],
  [
    `<p className={groupTitleClass}>즉시지급</p>`,
    `<p className={groupTitleClass}>{t('instantGrant')}</p>`,
  ],
  [
    `aria-label={\`수량 \${b.quantity}\`}`,
    `aria-label={t('quantityAria', { count: b.quantity })}`,
  ],
  [
    `aria-label={\`\${equipmentBonusGradeWord} 장비\`}`,
    `aria-label={\`\${equipmentBonusGradeWord} \${t('equipmentWord')}\`}`,
  ],
  [
    `<span className={\`\${bonusEquipmentLineBaseClass} text-emerald-100\`}>장비</span>`,
    `<span className={\`\${bonusEquipmentLineBaseClass} text-emerald-100\`}>{t('equipmentWord')}</span>`,
  ],
  [
    `다이아 패키지 I,II,III 중복구매 불가`,
    `{t('diamondPackageNoDup')}`,
  ],
  [
    `구매제한 월({equipRemaining}/{equipLimit}회)`,
    `{t('monthlyPurchaseLimit', { remaining: equipRemaining, limit: equipLimit })}`,
  ],
  [
    `계정당 1회 · 영구 적용`,
    `{t('accountOncePermanent')}`,
  ],
  [`aria-label="포함 혜택"`, `aria-label={t('includedBenefitsAria')}`],
  [
    `{removeAdsBlocked ? '보유 중' : isPurchasePending ? '구매 중...' : \`\${product.priceKRW.toLocaleString()}원\`}`,
    `{removeAdsBlocked ? t('owned') : isPurchasePending ? t('purchasing') : t('priceKrw', { price: product.priceKRW.toLocaleString() })}`,
  ],
  [`title="중복 구매 시 기간 연장"`, `title={t('duplicateExtends')}`],
  [
    `중복 구매 시 기간 연장`,
    `{t('duplicateExtends')}`,
  ],
  [
    `자동갱신 구독 중 · 만료 시 동일 요금으로 30일 연장`,
    `{t('autoRenewActive')}`,
  ],
  [
    `<span className="min-w-0 text-center leading-tight">일회성 결제</span>`,
    `<span className="min-w-0 text-center leading-tight">{t('oneTimePayment')}</span>`,
  ],
  [
    `{product.priceKRW.toLocaleString()}원 · {durationDays}일`,
    `{t('oneTimePriceDays', { price: product.priceKRW.toLocaleString(), days: durationDays })}`,
  ],
  [
    `<span className="text-center font-bold leading-tight">구독 (30일마다 자동결제)</span>`,
    `<span className="text-center font-bold leading-tight">{t('subscription')}</span>`,
  ],
  [
    `만료 시점에 등록 결제로 {product.priceKRW.toLocaleString()}원 청구 후 연장`,
    `{t('subscriptionCharge', { price: product.priceKRW.toLocaleString() })}`,
  ],
  [
    `setToastMessage('VIP 자동갱신 구독을 해지했습니다.');`,
    `setToastMessage(t('cancelSubscriptionToast'));`,
  ],
  [
    `구독 해지`,
    `{t('cancelSubscription')}`,
  ],
  [
    `title={\`\${countLabel}개\`}`,
    `title={t('countUnit', { count: countLabel })}`,
  ],
  [
    `{countLabel}개`,
    `{t('countUnit', { count: countLabel })}`,
  ],
  [
    `{product.priceKRW.toLocaleString()}원`,
    `{t('priceKrw', { price: product.priceKRW.toLocaleString() })}`,
  ],
]);

console.log('Part 2 done.');
