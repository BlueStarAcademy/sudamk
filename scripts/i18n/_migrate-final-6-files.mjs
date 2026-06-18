/**
 * Final i18n migration for 6 high-traffic components.
 * Run: node scripts/i18n/_migrate-final-6-files.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits, { replaceAll = false } = {}) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let ok = 0;
  let skip = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) {
      skip++;
      continue;
    }
    s = replaceAll ? s.replaceAll(from, to) : s.replace(from, to);
    ok++;
  }
  fs.writeFileSync(p, s);
  console.log(`${file}: ${ok} applied, ${skip} skipped`);
}

// --- InventoryModal (remaining) ---
patch('components/InventoryModal.tsx', []);

// --- ExchangeModal ---
patch('components/ExchangeModal.tsx', [
  [`alt={selectedBuyListing.currency === 'gold' ? '골드' : '다이아'}`, `alt={selectedBuyListing.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}`],
  [`alt={recentSoldForBuySelection.currency === 'gold' ? '골드' : '다이아'}`, `alt={recentSoldForBuySelection.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}`],
  [`alt={saleCurrency === 'gold' ? '골드' : '다이아'}`, `alt={saleCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}`],
  [`alt={currentLowestForSelected.currency === 'gold' ? '골드' : '다이아'}`, `alt={currentLowestForSelected.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}`],
  [`gradeStyles[gradeKey]?.name ?? '일반'`, `gradeStyles[gradeKey]?.name ?? t('filters.gradeNormal')`],
  [`gradeStyles[slotGradeKey]?.name ?? '일반'`, `gradeStyles[slotGradeKey]?.name ?? t('filters.gradeNormal')`],
  [`title={isMyListing ? '내가 등록한 판매' : undefined}`, `title={isMyListing ? t('labels.myListing') : undefined}`],
  [`{selectedBuyListingIsMine ? '내 등록 물품' : '구매'}`, `{selectedBuyListingIsMine ? t('labels.myListingItem') : t('modals.purchase')}`],
  [`<p className="mb-1.5 shrink-0 text-[11px] font-bold text-amber-200">등록된 아이템</p>`, `<p className="mb-1.5 shrink-0 text-[11px] font-bold text-amber-200">{t('labels.registeredItems')}</p>`],
  [`<p className="text-sm font-semibold text-amber-200">등록된 아이템</p>`, `<p className="text-sm font-semibold text-amber-200">{t('labels.registeredItems')}</p>`],
  [`{verification === 'verifying' ? '등록중' : isExpired ? '만료됨' :`, `{verification === 'verifying' ? t('labels.registering') : isExpired ? t('labels.expired') :`],
  [`? \`\${listingRecoverCooldownSecondsLeft}초 뒤에 다시 회수할 수 있습니다.\``, `? t('labels.recoverCooldown', { seconds: listingRecoverCooldownSecondsLeft })`],
  [`{isExpired ? '회수' : '판매취소'}`, `{isExpired ? t('labels.recover') : t('labels.cancelSale')}`],
  [`<span>이름</span>`, `<span>{t('labels.name')}</span>`],
  [`등록된 판매 물품이 없습니다.`, `{t('labels.noListings')}`],
  [`내 등록`, `{t('labels.myListingBadge')}`],
  [`새로 판매할 장비는 <span className="font-semibold text-amber-200/95">「장비 선택」</span>에서 고릅니다.`, `{t('labels.newGearHintPrefix')}<span className="font-semibold text-amber-200/95">{t('modals.selectGear')}</span>{t('labels.newGearHintSuffix')}`],
  [`장비 선택`, `{t('modals.selectGear')}`],
  [`<span className="text-center">이름</span>`, `<span className="text-center">{t('labels.name')}</span>`],
  [`<span className="text-center">판매가</span>`, `<span className="text-center">{t('labels.salePrice')}</span>`],
  [`<span className="text-center">수수료</span>`, `<span className="text-center">{t('labels.fee')}</span>`],
  [`<span className="text-center">수령액</span>`, `<span className="text-center">{t('labels.netAmount')}</span>`],
  [`정산 가능한 판매 내역이 없습니다.`, `{t('labels.noSettlement')}`],
  [`entry.currency === 'gold' ? '골드' : '다이아'`, `entry.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')`],
  [`<p className={\`\${settlementDetailLabel}\`}>선택 항목</p>`, `<p className={\`\${settlementDetailLabel}\`}>{t('labels.selectedItem')}</p>`],
  [`<span className="text-rose-200">수수료</span>`, `<span className="text-rose-200">{t('labels.fee')}</span>`],
  [`<span>수령액</span>`, `<span>{t('labels.netAmount')}</span>`],
  [`<p className={\`\${settlementDetailLabel}\`}>모든 항목</p>`, `<p className={\`\${settlementDetailLabel}\`}>{t('labels.allItems')}</p>`],
  [`<span className="shrink-0 text-rose-200">수수료</span>`, `<span className="shrink-0 text-rose-200">{t('labels.fee')}</span>`],
  [`<span className="shrink-0 text-emerald-200">수령액</span>`, `<span className="shrink-0 text-emerald-200">{t('labels.netAmount')}</span>`],
  [`선택 항목 수령`, `{t('labels.claimSelected')}`],
  [`모두 수령`, `{t('labels.claimAll')}`],
  [`정산 대기 항목이 없습니다.`, `{t('labels.noSettlementPending')}`],
  [`총 거래 이력 {visibleExchangeHistory.length}건`, `{t('labels.totalHistoryCount', { count: visibleExchangeHistory.length })}`],
  [`>총 지출</span>`, `>{t('labels.totalSpent')}</span>`],
  [`>총 수입</span>`, `>{t('labels.totalIncome')}</span>`],
  [`<img src="/images/icon/Gold.webp" alt="골드"`, `<img src="/images/icon/Gold.webp" alt={tCommon('resources.gold')}`],
  [`<img src="/images/icon/Zem.webp" alt="다이아"`, `<img src="/images/icon/Zem.webp" alt={tCommon('resources.diamonds')}`],
  [`<span className="text-center">상태</span>`, `<span className="text-center">{t('labels.statusLabel')}</span>`],
  [`<span className="text-center">날짜/시간</span>`, `<span className="text-center">{t('labels.dateTime')}</span>`],
  [`<span className="text-center">가격</span>`, `<span className="text-center">{t('labels.price')}</span>`],
  [`거래 이력이 없습니다.`, `{t('labels.noHistory')}`],
  [`row.statusText === '정산 수령'`, `row.statusText === t('labels.settlementReceived')`],
  [`                                등록`, `{t('labels.registerSale')}`],
  [`                                취소`, `{tCommon('actions.cancel')}`],
  [`                                유지`, `{t('labels.keep')}`],
  [`                            확인`, `{tCommon('actions.confirm')}`],
  [`                            구매`, `{t('modals.purchase')}`],
  [`                            판매등록`, `{t('labels.registerSale')}`],
  [`                            정산`, `{t('tabs.settlement')}`],
], { replaceAll: true });

// --- TowerLobby ---
patch('components/TowerLobby.tsx', [
  [`alt="다이아"`, `alt={tCommon('resources.diamonds')}`],
  [`alt="다이아몬드"`, `alt={t('diamondFullAlt')}`],
  [`>내 기록</`, `>{t('myRecord')}</`],
  [`>랭킹 정보</`, `>{t('rankingInfo')}</`],
  [`>보유 아이템</`, `>{t('ownedItems')}</`],
  [`>보상정보</`, `>{t('rewardInfoTitle')}</`],
  [`aria-label="패널 닫기"`, `aria-label={t('closePanelAria')}`],
  [`{mobileHeroDrawer === 'inventory' && '보유 아이템'}`, `{mobileHeroDrawer === 'inventory' && t('ownedItems')}`],
  [`aria-label="닫기"`, `aria-label={t('close')}`],
  [`>닫기</`, `>{t('close')}</`],
  [`>역대 최고 층수</`, `>{t('allTimeBest')}</`],
  [`>{bestFloorAllTime}층</`, `>{t('floorTier', { floor: bestFloorAllTime })}</`],
  [`>현재 층수</`, `>{t('currentFloorLabel')}</`],
  [`>{effectiveMonthlyFloorForReward}층</`, `>{t('floorTier', { floor: effectiveMonthlyFloorForReward })}</`],
  [`>예상 보상</`, `>{t('expectedReward')}</`],
  [`현재 층수 10층 이상부터 보상 지급`, `{t('rewardFromFloor10')}`],
  [`>스테이지</`, `>{t('stages')}</`],
  [`aria-label="뒤로가기"`, `aria-label={tCommon('backAria')}`],
  [`>도전의 탑</`, `>{t('title')}</`],
  [`>랭킹 Top 100</`, `>{t('rankingTop100')}</`],
  [`>보상정보</`, `>{t('rewardInfoTitle')}</`],
  [`>이번 달 최고 층</`, `>{t('monthlyBest')}</`],
  [`{myRewardTier.floor}층 구간 보상 · 월말 정산 시 지급`, `{t('rewardTierLine', { floor: myRewardTier.floor })}`],
  [`10층 이상 클리어 시 월간 보상을 받을 수 있습니다.`, `{t('rewardFromFloor10Short')}`],
  [`{pr !== null ? pr : '순위 외'}`, `{pr !== null ? pr : t('unranked')}`],
  [`10층 이상 클리어 시 랭킹에 표시됩니다.`, `{t('rankingHint')}`],
  [`랭킹 불러오는 중...`, `{t('rankingLoading')}`],
  [`Top 100에 표시된 다른 순위가 없습니다.`, `{t('noOtherRanked')}`],
  [`랭킹 데이터가 없습니다.`, `{t('rankingEmpty')}`],
  [`aria-label="퀵 메뉴"`, `aria-label={tNav('quickMenu.quickMenuAria')}`],
  [`title="도전의 탑 보상정보"`, `title={t('rewardModalTitle')}`],
  [`>보상 정산까지 남은 시간</`, `>{t('settlementRemaining')}</`],
  [`>내 현재 보상</`, `>{t('myCurrentReward')}</`],
  [`>{tier.floor}층</`, `>{t('floorTier', { floor: tier.floor })}</`],
  [`층: {(user as any).displayFloor ?? 0}`, `{t('floorLabel', { floor: (user as any).displayFloor ?? 0 })}`],
  [`층: {pinned.displayFloor ?? 0}`, `{t('floorLabel', { floor: pinned.displayFloor ?? 0 })}`],
  [`alt="도전의 탑"`, `alt={t('towerAlt')}`],
], { replaceAll: true });

// Add tNav to TowerLobby if missing
{
  const p = path.join(root, 'components/TowerLobby.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes("tNav('quickMenu") && !s.includes("t: tNav")) {
    s = s.replace(
      "const { t: tCommon } = useTranslation('common');",
      "const { t: tCommon } = useTranslation('common');\n    const { t: tNav } = useTranslation('nav');",
    );
    fs.writeFileSync(p, s);
    console.log('TowerLobby: added tNav hook');
  }
}

// --- TournamentBracket ---
patch('components/TournamentBracket.tsx', [
  [`sideLabel="챔피언십 능력치"`, `sideLabel={tt('championshipAbility')}`],
  [`title={isClickable ? \`\${playerNickname} 프로필 보기\` : ''}`, `title={isClickable ? tt('viewProfile', { name: playerNickname }) : ''}`],
  [`>바둑능력: {totalAbilityScore}</span>`, `>{tt('badukAbility')}: {totalAbilityScore}</span>`],
  [`({cumulativeStats.wins}승 {cumulativeStats.losses}패)`, `({tt('recordWinsLosses', { wins: cumulativeStats.wins, losses: cumulativeStats.losses })})`],
  [`>컨디션:</span>`, `>{tt('condition')}:</span>`],
  [`? '컨디션이 이미 최대입니다'`, `? tt('conditionMax')`],
  [`? '지금은 컨디션 회복제를 사용할 수 없습니다'`, `? tt('conditionPotionUnavailable')`],
  [`: '컨디션 회복제 사용'`, `: tt('useConditionPotion')`],
  [`if (total === 0) return '전적 없음';`, `if (total === 0) return tt('noRecord');`],
  [`return \`\${((100 * wins) / total).toFixed(1)}% (\${wins}승 \${losses}패)\`;`, `return tt('winRateWithRecord', { rate: ((100 * wins) / total).toFixed(1), wins, losses });`],
  [`title={clickable ? \`\${player.nickname} 프로필 보기\` : ''}`, `title={clickable ? tt('viewProfile', { name: player.nickname }) : ''}`],
  [`['status', '상태정보']`, `['status', tt('statusInfo')]`],
  [`['abilities', '능력수치']`, `['abilities', tt('abilityStats')]`],
  [`>컨디션</div>`, `>{tt('condition')}</div>`],
  [`>바둑능력</div>`, `>{tt('badukAbility')}</div>`],
  [`>승률 · 전적</div>`, `>{tt('winRateRecord')}</div>`],
  [`? '초반능력' : pk === 'mid' ? '중반능력' : '종반능력'`, `? tt('earlyAbility') : pk === 'mid' ? tt('midAbility') : tt('endAbility')`],
  [`? '초반능력' : phase === 'mid' ? '중반능력' : '종반능력'`, `? tt('earlyAbility') : phase === 'mid' ? tt('midAbility') : tt('endAbility')`],
  [`>차이 </span>`, `>{tt('difference')} </span>`],
  [`>초반</div>`, `>{tt('phases.opening')}</div>`],
  [`title="중앙"`, `title={tt('center')}`],
  [`>흑</div>`, `>{tt('black')}</div>`],
  [`>백</div>`, `>{tt('white')}</div>`],
  [`'경기 시작 대기 중...'`, `tt('waitingForMatchStart')`],
  [`title="랜덤 장비"`, `title={tt('randomEquipment')}`],
  [`title = '랜덤 변경권'`, `title = tt('randomChangeTicket')`],
  [`renderGoldChip('승리'`, `renderGoldChip(tt('victory')`],
  [`renderGoldChip('패배'`, `renderGoldChip(tt('defeat')`],
  [`'승리'`, `tt('victory')`],
  [`'패배'`, `tt('defeat')`],
  [`renderRoll('승'`, `renderRoll(tt('winShort')`],
  [`renderRoll('패'`, `renderRoll(tt('lossShort')`],
  [`: '랜덤 변경권'`, `: tt('randomChangeTicket')`],
  [`'장비'`, `tt('equipment')`],
  [`'변경권'`, `tt('changeTicket')`],
  [`>장비</span>`, `>{tt('equipment')}</span>`],
  [`>변경권</span>`, `>{tt('changeTicket')}</span>`],
  [`'등급'`, `tt('grade')`],
  [`'처리 중...'`, `tt('processing')`],
  [`'보상 완료'`, `tt('rewardComplete')`],
  [`'수령 중...'`, `tt('claiming')`],
  [`'보상받기'`, `tt('claimReward')`],
  [`'경기 종료 후 수령 가능'`, `tt('claimAfterMatchEnd')`],
  [`name: '변경권'`, `name: tt('changeTicket')`],
  [`>획득한 보상이 없습니다.</p>`, `>{tt('noRewards')}</p>`],
  [`: '획득 골드'`, `: tt('earnedGold')`],
  [`alt="골드"`, `alt={tt('goldAlt')}`],
  [`alt="챔프 코인"`, `alt={tt('champCoinAlt')}`],
  [`title="라운드 합산 재료"`, `title={tt('roundMaterialsSum')}`],
  [`\${label} 장비`, `tt('labelEquipment', { label })`],
  [`>획득 보상</h4>`, `>{tt('earnedRewards')}</h4>`],
  [`>나가기</`, `>{tt('exit')}</`],
  [`>예상보상</`, `>{tt('expectedReward')}</`],
  [`>실시간 중계</`, `>{tt('liveCommentary')}</`],
  [`경기 진행 중...`, `{tt('matchInProgress')}`],
  [`>종합 능력</`, `>{tt('overallAbility')}</`],
  [`선수 대기 중`, `{tt('playerWaitingShort')}`],
  [`>중반</`, `>{tt('phases.midgame')}</`],
  [`>종반</`, `>{tt('phases.endgame')}</`],
  [`'다음 경기'`, `tt('nextMatch')`],
  [`'경기 시작'`, `tt('startMatch')`],
  [`'보상받기'`, `tt('claimReward')`],
  [`{ key: 'commentary' as const, label: '경기 요약' }`, `{ key: 'commentary' as const, label: tt('matchSummary') }`],
  [`{ key: 'bracket' as const, label: '라운드' }`, `{ key: 'bracket' as const, label: tt('roundTab') }`],
  [`'선수 1'`, `tt('playerOne')`],
  [`'선수 2'`, `tt('playerTwo')`],
  [`'선수 대기'`, `tt('playerWaitingShort')`],
  [`'컨디션 회복'`, `tt('conditionRecover')`],
  [`>전적 <b`, `>{tt('record')} <b`],
  [`'기능 VIP 활성화 후 사용할 수 있습니다.'`, `tt('vipSkipRequiresFunctionVip')`],
  [`'상대 정보를 준비하고 있습니다.'`, `tt('preparingOpponent')`],
  [`'로비로 나가도 대회를 이어할 수 있습니다.'`, `tt('canReturnFromLobby')`],
  [`'경기장을 나갔습니다.'`, `tt('leftArena')`],
  [`'선수들이 입장하고 있습니다. 잠시만 기다려주세요.'`, `tt('playersEntering')`],
  [`'경기 정보를 불러오는 중..'`, `tt('loadingMatchInfo')`],
  [`>대진표</h4>`, `>{tt('bracketTitle')}</h4>`],
  [`>풀리그 대진표</h4>`, `>{tt('roundRobin')}</h4>`],
  [`>경기가 없습니다.</div>`, `>{tt('noMatches')}</div>`],
  [`{status === 'complete' ? '최종 순위' : '현재 순위'}`, `{status === 'complete' ? tt('finalRank') : tt('currentRank')}`],
  [`>최종 결과</`, `>{tt('finalResult')}</`],
  [`>경기결과</`, `>{tt('matchResult')}</`],
], { replaceAll: true });

// --- PairWaitingLobby ---
patch('components/PairWaitingLobby.tsx', [
  [`subLabel: '장착 펫'`, `subLabel: pt('equippedPet')`],
  [`{ value: 'duo_match', label: '친선전' }`, `{ value: 'duo_match', label: pt('roomKinds.friendly') }`],
  [`{ value: 'arena_ai', label: 'AI와 대결' }`, `{ value: 'arena_ai', label: pt('roomKinds.arenaAi') }`],
  [`{ value: 'friendly_4p', label: '4인 친선' }`, `{ value: 'friendly_4p', label: pt('roomKinds.friendly4p') }`],
  [`{ value: 'friendly_2p', label: '2인 친선' }`, `{ value: 'friendly_2p', label: pt('roomKinds.friendly2p') }`],
  [`{ value: 'duo_match', label: '2인 AI대전' }`, `{ value: 'duo_match', label: pt('roomKinds.duoAi') }`],
  [`?? '내 펫'`, `?? pt('myPet')`],
  [`>로딩 중...</div>`, `>{pt('loading')}</div>`],
  [`return '유저'`, `return pt('defaultUser')`],
  [`|| '유저'`, `|| pt('defaultUser')`],
  [`out[myRoom.ownerId] = '참여중'`, `out[myRoom.ownerId] = pt('participating')`],
  [`out[pid] = '참여중'`, `out[pid] = pt('participating')`],
  [`>페어 랭킹전</`, `>{pt('waitingLobby.pairRanked')}</`],
  [`>취소</span>`, `>{pt('waitingLobby.cancel')}</span>`],
  [`>매칭 중...</`, `>{pt('waitingLobby.matching')}</`],
  [`>대기 시간</`, `>{pt('waitingLobby.waitTime')}</`],
  [`>현재 시즌</`, `>{pt('waitingLobby.currentSeason')}</`],
  [`' (첫 시즌)'`, `pt('waitingLobby.firstSeasonSuffix')`],
  [`>현재 점수</`, `>{pt('waitingLobby.currentScore')}</`],
  [`{pairLobbyRankedStrip.wins}승 {pairLobbyRankedStrip.losses}패 · 승률`, `{pt('waitingLobby.recordWinRate', { wins: pairLobbyRankedStrip.wins, losses: pairLobbyRankedStrip.losses })}`],
  [`>시즌 최고</span>`, `>{pt('waitingLobby.seasonBest')}</span>`],
  [`' (동일)'`, `pt('waitingLobby.sameScoreSuffix')`],
  [`>최고 시즌</`, `>{pt('waitingLobby.bestSeason')}</`],
  [`>역대 최고 등급</`, `>{pt('waitingLobby.allTimeBestTier')}</`],
  [`prefix: '[전략바둑]'`, `prefix: pt('waitingLobby.prefixStrategic')`],
  [`prefix: '[놀이바둑]'`, `prefix: pt('waitingLobby.prefixPlayful')`],
  [`prefix: '[페어바둑]'`, `prefix: pt('waitingLobby.prefixPair')`],
  [`>전체</`, `>{pt('waitingLobby.filterAll')}</`],
  [`>친구</`, `>{pt('waitingLobby.filterFriends')}</`],
  [`>길드원</`, `>{pt('waitingLobby.filterGuild')}</`],
  [`|| '미정'`, `|| pt('waitingLobby.undecided')`],
  [`? '비공개' : '공개'`, `? pt('waitingLobby.private') : pt('waitingLobby.public')`],
  [`>암호</`, `>{pt('waitingLobby.password')}</`],
  [`? '전략바둑 경기장'`, `? pt('waitingLobby.strategicArena')`],
  [`? '놀이바둑 경기장'`, `? pt('waitingLobby.playfulArena')`],
  [`: '페어 경기장'`, `: pt('waitingLobby.pairArena')`],
  [`>방장</span>`, `>{pt('waitingLobby.host')}</span>`],
  [`title="경기 진행 중"`, `title={pt('waitingLobby.matchInProgress')}`],
  [`>경기중</`, `>{pt('waitingLobby.inMatch')}</`],
  [`>입장</`, `>{pt('waitingLobby.enter')}</`],
  [`>번호 1~100 밖의 방</`, `>{pt('waitingLobby.orphanRooms')}</`],
  [`>방 종류 필터</`, `>{pt('waitingLobby.roomKindFilter')}</`],
  [`>게임 모드 필터</`, `>{pt('waitingLobby.gameModeFilter')}</`],
  [`placeholder="방 번호"`, `placeholder={pt('waitingLobby.roomNumberPlaceholder')}`],
  [`? '취소' : '방만들기'`, `? pt('waitingLobby.cancel') : pt('waitingLobby.createRoom')`],
  [`>대국 설정</`, `>{pt('waitingLobby.matchSettings')}</`],
  [`>게임 모드</`, `>{pt('waitingLobby.gameMode')}</`],
  [`>세부 조건</`, `>{pt('waitingLobby.detailConditions')}</`],
  [`>표시할 세부 설정이 없습니다.</`, `>{pt('waitingLobby.noDetailSettings')}</`],
  [`>대국 설정·시작은 AI 탭에서 진행합니다.</`, `>{pt('waitingLobby.aiTabHint')}</`],
  [`title="방 종류"`, `title={pt('waitingLobby.roomKind')}`],
  [`>방 변경</`, `>{pt('waitingLobby.changeRoom')}</`],
  [`>변경 제안</`, `>{pt('waitingLobby.proposeChange')}</`],
  [`>매칭중</`, `>{pt('waitingLobby.matchingShort')}</`],
  [`? '준비 해제' : '준비'`, `? pt('waitingLobby.unready') : pt('waitingLobby.ready')`],
  [`>준비 해제`, `>{pt('waitingLobby.unready')}`],
  [`>준비</`, `>{pt('waitingLobby.ready')}</`],
  [`>매칭 취소</`, `>{pt('waitingLobby.cancelMatch')}</`],
  [`>제안 취소</`, `>{pt('waitingLobby.cancelProposal')}</`],
  [`'AI대전 시작'`, `pt('waitingLobby.startAi')`],
  [`>경기 시작</span>`, `>{pt('waitingLobby.startMatch')}</span>`],
  [`'경기 시작'`, `pt('waitingLobby.startMatch')`],
  [`'매칭 시작'`, `pt('waitingLobby.startMatching')`],
  [`window.alert('비공개방 비밀번호는 4자로 입력해 주세요.')`, `window.alert(pt('alerts.privatePasswordLength'))`],
  [`window.alert('방장만 랭킹전 매칭을 시작할 수 있습니다.')`, `window.alert(pt('alerts.ownerOnlyRanked'))`],
  [`window.alert('방장만 AI 대전을 시작할 수 있습니다.')`, `window.alert(pt('alerts.ownerOnlyAi'))`],
  [`window.alert('페어 랭킹전을 이용하려면 페어 펫을 장착해야 합니다.')`, `window.alert(pt('alerts.equipPetForRanked'))`],
  [`window.alert('페어 랭킹전을 시작하려면 다른 페어 방에서 나와 주세요.')`, `window.alert(pt('alerts.leaveOtherRoomForRanked'))`],
  [`roomTitle: target?.title || '비공개 방'`, `roomTitle: target?.title || pt('alerts.privateRoom')`],
  [`return isBusy ? '2인 AI 방을 준비하는 중입니다.' : '2인 AI 방을 여는 중입니다.'`, `return isBusy ? pt('waitingLobby.preparingAiRoom') : pt('waitingLobby.openingAiRoom')`],
  [`if (!isOwner) return '방장만 AI 대전을 시작할 수 있습니다.'`, `if (!isOwner) return pt('alerts.ownerOnlyAi')`],
  [`if (!hasPartner) return '좌측 패널에서 파트너를 초대해 주세요.'`, `if (!hasPartner) return pt('waitingLobby.invitePartnerHint')`],
  [`if (!duoPairAiPartnerReady) return '파트너 준비완료를 기다려 주세요.'`, `if (!duoPairAiPartnerReady) return pt('waitingLobby.waitPartnerReady')`],
  [`? \`\${nick}님의 전략바둑방\``, `? pt('alerts.strategicRoomTitle', { name: nick })`],
  [`? \`\${nick}님의 놀이바둑방\``, `? pt('alerts.playfulRoomTitle', { name: nick })`],
  [`: \`\${nick}님의 페어방\``, `: pt('alerts.pairRoomTitle', { name: nick })`],
  [`isHandheld ? '시작' : '랭킹전 시작'`, `isHandheld ? pt('waitingLobby.startShort') : pt('waitingLobby.rankedStart')`],
], { replaceAll: true });

// --- ShopModal: fix CASH_PURCHASE reference + wrap item arrays ---
{
  const p = path.join(root, 'components/ShopModal.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE')) {
    s = s.replaceAll('CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE', "t('notImplemented')");
    console.log('ShopModal: fixed CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE');
  }
  if (!s.includes('const localizeShopItem')) {
    s = s.replace(
      `const ShopModal: React.FC<ShopModalProps> = ({`,
      `const localizeShopItem = (t: (key: string) => string, itemId: string, rest: Record<string, unknown>) => ({
    itemId,
    name: t(\`items.\${itemId}.name\`),
    description: t(\`items.\${itemId}.description\`),
    ...rest,
});

const ShopModal: React.FC<ShopModalProps> = ({`,
    );
  }
  const itemReplacements = [
    ['name: "재료 상자 I", description: "하급~상급강화석 5개"', '...localizeShopItem(t, "material_box_1",'],
    // use simpler: replace name/description pairs with t() inline
  ];
  // Replace material/equipment item name+description with t() calls
  s = s.replace(/name: "([^"]+)", description: "([^"]+)"/g, (m, _n, _d, offset) => {
    const before = s.slice(Math.max(0, offset - 80), offset);
    const idMatch = before.match(/itemId:\s*['"]([^'"]+)['"]\s*,?\s*$/);
    if (!idMatch) return m;
    const id = idMatch[1];
    return `name: t('items.${id}.name'), description: t('items.${id}.description')`;
  });
  s = s.replace(/name: '([^']+)', description: '([^']+)'/g, (m, _n, _d, offset) => {
    const before = s.slice(Math.max(0, offset - 80), offset);
    const idMatch = before.match(/itemId:\s*['"]([^'"]+)['"]\s*,?\s*$/);
    if (!idMatch) return m;
    const id = idMatch[1];
    return `name: t('items.${id}.name'), description: t('items.${id}.description')`;
  });
  fs.writeFileSync(p, s);
  console.log('ShopModal: localized item name/description via itemId');
}

console.log('Part 1 migration done. Run i18n key merge separately.');
