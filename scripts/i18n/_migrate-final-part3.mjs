import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits, { replaceAll = false } = {}) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let ok = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) continue;
    s = replaceAll ? s.replaceAll(from, to) : s.replace(from, to);
    ok++;
  }
  fs.writeFileSync(p, s);
  console.log(`${file}: ${ok} patches`);
}

// Fix duplicate tt imports
{
  const p = path.join(root, 'components/TournamentBracket.tsx');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    /import i18n from '\.\.\/shared\/i18n\/config\.js';\n\nconst tt = \(key: string, opts\?: Record<string, unknown>\) => i18n\.t\(`tournament:\$\{key\}`, opts\);\nimport i18n from '\.\.\/shared\/i18n\/config\.js';\n\nconst tt = \(key: string, opts\?: Record<string, unknown>\) => i18n\.t\(`tournament:\$\{key\}`, opts\);/,
    "import i18n from '../shared/i18n/config.js';\n\nconst tt = (key: string, opts?: Record<string, unknown>) => i18n.t(`tournament:${key}`, opts);",
  );
  if (!s.includes('TB_RND_FINAL')) {
    s = s.replace(
      "const tt = (key: string, opts?: Record<string, unknown>) => i18n.t(`tournament:${key}`, opts);",
      `const tt = (key: string, opts?: Record<string, unknown>) => i18n.t(\`tournament:\${key}\`, opts);

const TB_RND_16 = '16\\uAC15';
const TB_RND_QF = '8\\uAC15';
const TB_RND_SF = '4\\uAC15';
const TB_RND_FINAL = '\\uACB0\\uC2B9';
const TB_RND_THIRD = '3,4\\uC704\\uC804';
const TB_TAB_SF = '4\\uAC15\\uC804';
const TB_TAB_FINAL_THIRD = '\\uACB0\\uC2B9&3/4\\uC704\\uC804';
const TB_TAB_FINAL_THIRD_ALT = '\\uACB0\\uC2B9 \\uBC0F 3/4\\uC704\\uC804';
const TB_ROUND_SUFFIX = '\\uD68C\\uCC28';
const TB_ITEM_GOLD = '\\uACE8\\uB4DC';

const displayBracketTabName = (name: string): string => {
    if (name === TB_RND_16) return tt('round16');
    if (name === TB_RND_QF) return tt('roundQuarter');
    if (name === TB_TAB_SF) return tt('tabSemifinal');
    if (name === TB_TAB_FINAL_THIRD || name === TB_TAB_FINAL_THIRD_ALT) return tt('tabFinalThird');
    return name;
};`,
    );
  }
  fs.writeFileSync(p, s);
  console.log('TournamentBracket: imports + constants');
}

// Server round name unicode (order: longer strings first)
{
  const p = path.join(root, 'components/TournamentBracket.tsx');
  let s = fs.readFileSync(p, 'utf8');
  const reps = [
    ['"결승 및 3/4위전"', 'TB_TAB_FINAL_THIRD_ALT'],
    ['"결승&3/4위전"', 'TB_TAB_FINAL_THIRD'],
    ['"4강전"', 'TB_TAB_SF'],
    ['"16강"', 'TB_RND_16'],
    ['"8강"', 'TB_RND_QF'],
    ['"4강"', 'TB_RND_SF'],
    ['"결승"', 'TB_RND_FINAL'],
    ['"3,4위전"', 'TB_RND_THIRD'],
    ["'결승'", 'TB_RND_FINAL'],
    ["'4강'", 'TB_RND_SF'],
    ["'3,4위전'", 'TB_RND_THIRD'],
    ['`${selectedRound}회차`', '`${selectedRound}${TB_ROUND_SUFFIX}`'],
    ['`${currentRound}회차`', '`${currentRound}${TB_ROUND_SUFFIX}`'],
    ['`${pendingRoundSwitchTo}회차`', '`${pendingRoundSwitchTo}${TB_ROUND_SUFFIX}`'],
    ["round.name.replace('회차', '')", "round.name.replace(TB_ROUND_SUFFIX, '')"],
    ["name.includes('결승')", 'name.includes(TB_RND_FINAL)'],
    ["name.includes('3,4위전')", 'name.includes(TB_RND_THIRD)'],
    ["itemName.includes('골드')", 'itemName.includes(TB_ITEM_GOLD)'],
  ];
  for (const [from, to] of reps) {
    s = s.split(from).join(to);
  }
  fs.writeFileSync(p, s);
  console.log('TournamentBracket: round unicode/constants');
}

patch('components/TournamentBracket.tsx', [
  ['phaseColorClass = \'text-green-400\'; // 초록색', 'phaseColorClass = \'text-green-400\';'],
  ['phaseColorClass = \'text-yellow-400\'; // 노란색', 'phaseColorClass = \'text-yellow-400\';'],
  ['phaseColorClass = \'text-red-400\'; // 빨간색', 'phaseColorClass = \'text-red-400\';'],
  ['? `랜덤 변경권 · 경기 결과에 따라 지급 · 단계 기준 최대 ${maxChangeTickets}개`', '? tt(\'randomChangeTicketHint\', { count: maxChangeTickets })'],
  ['? `경기 ${idx + 1} 보상`', '? tt(\'matchRewardIndex\', { index: idx + 1 })'],
  ['? `챔프 코인 ×${claimedChampCoins.toLocaleString(\'ko-KR\')}`', '? tt(\'champCoinTimes\', { amount: claimedChampCoins.toLocaleString(\'ko-KR\') })'],
  [': `챔프 코인 ${champCoinPreviewLabel} (수령 시 확정)`', ': tt(\'champCoinPending\', { label: champCoinPreviewLabel })'],
  ['title={`${rankRewardForDisplay!.rank}위 순위 보상 · ${itemName} ×${qtyForTitle}`}', 'title={tt(\'rankRewardTitle\', { rank: rankRewardForDisplay!.rank, item: itemName, qty: qtyForTitle })}'],
  ['return `${matchNumber}차전 ${lastMatchWon ? tt(\'victory\') : tt(\'defeat\')}! (${wins}승 ${losses}패)`;', 'return tt(\'matchRoundResult\', { round: matchNumber, outcome: lastMatchWon ? tt(\'victory\') : tt(\'defeat\'), wins, losses });'],
  ['<span className="text-red-400">{stats.losses}패</span>', '<span className="text-red-400">{tt(\'lossShortLabel\', { defaultValue: stats.losses + tt(\'lossShortLabel\') })}</span>'],
], { replaceAll: true });

// Fix loss display - the above patch is wrong. Use simpler:
{
  const p = path.join(root, 'components/TournamentBracket.tsx');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    `<span className="text-red-400">{tt('lossShortLabel', { defaultValue: stats.losses + tt('lossShortLabel') })}</span>`,
    `<span className="text-red-400">{stats.losses}{tt('lossShortLabel')}</span>`,
  );
  s = s.replace(
    "if (window.confirm('토너먼트를 포기하고 나가시겠습니까? 오늘의 참가 기회는 사라집니다.'))",
    "if (window.confirm(tt('forfeitConfirm')))",
  );
  s = s.replace(
    'return `${winsCount}승 ${lossesCount}패! ${myRank}위`;',
    "return tt('statusRecordRank', { wins: winsCount, losses: lossesCount, rank: myRank });",
  );
  s = s.replace('if (winner?.id === currentUser.id) return "🏆 우승!";', "if (winner?.id === currentUser.id) return tt('championTitle');");
  s = s.replace('if (roundOfLastMatch?.name === TB_RND_FINAL) return "준우승!";', "if (roundOfLastMatch?.name === TB_RND_FINAL) return tt('runnerUp');");
  s = s.replace('return won3rdPlace ? "3위" : "4위";', "return won3rdPlace ? tt('thirdPlace') : tt('fourthPlace');");
  s = s.replace(
    'return `${roundOfLastMatch?.name || \'\'}에서 탈락`;',
    "return tt('eliminatedInRound', { round: roundOfLastMatch?.name || '' });",
  );
  s = s.replace('return "토너먼트 탈락";', "return tt('tournamentEliminated');");
  s = s.replace(
    'return `${allMyMatches.length}차전 ${userWonLastMatch ? tt(\'victory\') : tt(\'defeat\')}! (${wins}승 ${losses}패)`;',
    "return tt('matchRoundResult', { round: allMyMatches.length, outcome: userWonLastMatch ? tt('victory') : tt('defeat'), wins, losses });",
  );
  s = s.replace(
    'if (nextUnplayedRound) return `${nextUnplayedRound.name} 진출!`;',
    "if (nextUnplayedRound) return tt('roundAdvanceExclaim', { round: nextUnplayedRound.name });",
  );
  s = s.replace(
    'return currentRound ? `${currentRound.name} 진행 중` : "대회 준비 중";',
    "return currentRound ? tt('roundInProgress', { round: currentRound.name }) : tt('tournamentPreparing');",
  );
  s = s.replace(
    "? '상대 정보를 준비하는 중입니다.'",
    "? tt('preparingOpponentInfo')",
  );
  s = s.replace(
    ": '남은 모든 라운드(유저 경기)를 한 번에 스킵하고 대회를 끝까지 진행합니다.'",
    ": tt('skipAllRoundsHint')",
  );
  s = s.replace(
    '<p className="mb-1.5 text-center text-[10px] font-bold leading-snug text-cyan-300">경기 준비 중..</p>',
    '<p className="mb-1.5 text-center text-[10px] font-bold leading-snug text-cyan-300">{tt(\'matchPreparing\')}</p>',
  );
  s = s.replace(
    "return '대회에 참가하기 위해 심호흡을 하고있습니다.';",
    "return tt('breathing');",
  );
  s = s.replace(
    "? '로비로 나가도 저장 후 이어서 할 수 있습니다.'",
    "? tt('canResumeFromLobby')",
  );
  s = s.replace(
    ": '경기장을 나갑니다.'",
    ": tt('leaveArena')",
  );
  s = s.replace(
    "'0.5': '3초에 한 수',",
    "'0.5': tt('playbackSpeed.0.5'),",
  );
  s = s.replace(
    "'1': '1.5초에 한 수',",
    "'1': tt('playbackSpeed.1'),",
  );
  s = s.replace(
    "'2': '1초에 한 수',",
    "'2': tt('playbackSpeed.2'),",
  );
  s = s.replace(
    "'3': '0.5초에 한 수',",
    "'3': tt('playbackSpeed.3'),",
  );
  s = s.replace(
    "const colorLabel = isBlackPlayer ? '흑' : player?.id && realGame?.whitePlayerId === player.id ? '백' : '';",
    "const colorLabel = isBlackPlayer ? tt('black') : player?.id && realGame?.whitePlayerId === player.id ? tt('white') : '';",
  );
  s = s.replace(
    "const isWhite = colorLabel === '백';",
    "const isWhite = colorLabel === tt('white');",
  );
  s = s.replace(
    "const isBlackStone = colorLabel === '흑';",
    "const isBlackStone = colorLabel === tt('black');",
  );
  s = s.replace(
    'title={clickable && player ? `${player.nickname} 프로필 보기` : undefined}',
    'title={clickable && player ? tt(\'viewProfile\', { name: player.nickname }) : undefined}',
  );
  s = s.replace(
    '{isCurrentUser ? <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">나</span> : null}',
    '{isCurrentUser ? <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">{tt(\'me\')}</span> : null}',
  );
  s = s.replace(
    ": '지금은 컨디션 회복제를 사용할 수 없습니다'",
    ": tt('conditionPotionUnavailable')",
  );
  s = s.replace(
    "title={dungeonRunRecord ? '이번 챔피언십 단계에서의 전적' : undefined}",
    "title={dungeonRunRecord ? tt('dungeonRunRecordTitle') : undefined}",
  );
  s = s.replace(
    '전적 <b className={`tabular-nums ${strongText}`}>{recordWins}승 {recordLosses}패</b>',
    '{tt(\'record\')} <b className={`tabular-nums ${strongText}`}>{tt(\'recordWinsLosses\', { wins: recordWins, losses: recordLosses })}</b>',
  );
  s = s.replace(
    "const colorLabel = isBlackPlayer ? '흑' : isWhitePlayer ? '백' : '';",
    "const colorLabel = isBlackPlayer ? tt('black') : isWhitePlayer ? tt('white') : '';",
  );
  s = s.replace(
    "title={dungeonRunRecordMobile ? '이번 챔피언십 단계에서의 전적' : undefined}",
    "title={dungeonRunRecordMobile ? tt('dungeonRunRecordTitle') : undefined}",
  );
  s = s.replace(
    "colorLabel={p1IsBlack ? '흑' : p1IsWhite ? '백' : ''}",
    "colorLabel={p1IsBlack ? tt('black') : p1IsWhite ? tt('white') : ''}",
  );
  s = s.replace(
    "colorLabel={p2IsBlack ? '흑' : p2IsWhite ? '백' : ''}",
    "colorLabel={p2IsBlack ? tt('black') : p2IsWhite ? tt('white') : ''}",
  );
  s = s.replace(
    '<div className="flex flex-1 items-center justify-center text-gray-400">경기 정보를 불러오는 중...</div>',
    '<div className="flex flex-1 items-center justify-center text-gray-400">{tt(\'loadingMatchInfo\')}</div>',
  );
  s = s.replace(
    '<span className="sr-only">부가 정보 패널</span>',
    '<span className="sr-only">{tt(\'sidebarExtraPanel\')}</span>',
  );
  s = s.replace(
    'aria-label="우측 패널 열기"\n                                title="우측 패널 열기"',
    'aria-label={tt(\'openRightPanel\')}\n                                title={tt(\'openRightPanel\')}',
  );
  s = s.replace(
    "return Promise.resolve({ error: '토너먼트 정보를 찾을 수 없습니다.' });",
    "return Promise.resolve({ error: tt('tournamentNotFound') });",
  );
  // dev logs -> English
  s = s.replace(/console\.log\('\[TournamentBracket\] 토너먼트 상태:'/g, "console.log('[TournamentBracket] tournament status:'");
  s = s.replace(/console\.log\('\[TournamentBracket\] ENTER_TOURNAMENT_VIEW 호출'\)/g, "console.log('[TournamentBracket] ENTER_TOURNAMENT_VIEW')");
  s = s.replace(/console\.log\('\[TournamentBracket\] LEAVE_TOURNAMENT_VIEW 호출'\)/g, "console.log('[TournamentBracket] LEAVE_TOURNAMENT_VIEW')");
  s = s.replace(/console\.log\('\[TournamentBracket\] useEffect 스킵 - 필수 데이터 없음:'/g, "console.log('[TournamentBracket] useEffect skip - missing data:'");
  s = s.replace(/console\.log\('\[TournamentBracket\] 상태 변경:'/g, "console.log('[TournamentBracket] status change:'");
  s = s.replace(/console\.log\(`\[TournamentBracket\] Countdown: \$\{secondsLeft\}초 남음/g, 'console.log(`[TournamentBracket] Countdown: ${secondsLeft}s left');
  s = s.replace(/console\.log\('\[TournamentBracket\] 선수 정보 업데이트:'/g, "console.log('[TournamentBracket] player update:'");
  s = s.replace(/console\.log\(`\[TournamentRoundViewer\] 경기 종료\/카운트다운 시작, 탭 변경:/g, 'console.log(`[TournamentRoundViewer] match end/countdown tab switch:');
  // tab display
  s = s.replace(/\{tab\.name\}/g, '{displayBracketTabName(tab.name)}');
  fs.writeFileSync(p, s);
  console.log('TournamentBracket: display strings');
}

patch('components/PairWaitingLobby.tsx', [
  [`'AI 대전은 펫 페어(기존 방)·전략·놀이 친선(듀오)·경기장 AI 방에서만 시작할 수 있습니다. 펫 페어 새 방은 유저 목록 상단 「페어 AI 대전」에서 만드세요.'`, `pt('alerts.aiStartRestricted')`],
  [`'이미 참여 중인 방이 있습니다. 펫 페어 랭킹전은 다른 페어 방에서 나온 뒤 유저 목록 상단에서 시작해 주세요.'`, `pt('alerts.alreadyInRoomForRanked')`],
  [`? \`거절 후 \${Math.max(0, Math.ceil(((lobbyChangeCooldownMs as number) - Date.now()) / 1000))}초 뒤에 다시 제안할 수 있습니다.\``, `? pt('alerts.proposalCooldown', { seconds: Math.max(0, Math.ceil(((lobbyChangeCooldownMs as number) - Date.now()) / 1000)) })`],
  [`\`랭킹전 매칭 (⚡\${pairRankedMatchApButtonLabel})\``, `pt('rankedMatch.queueWithAp', { cost: pairRankedMatchApButtonLabel })`],
  [`? '전략바둑 방 만들기'`, `? pt('waitingLobby.createStrategicRoom')`],
  [`? '놀이바둑 방 만들기'`, `? pt('waitingLobby.createPlayfulRoom')`],
  [`: '페어 방 만들기'`, `: pt('waitingLobby.createPairRoom')`],
  [`submitLabel="이 설정으로 저장"`, `submitLabel={pt('waitingLobby.saveThisSettings')}`],
  [`? '변경된 대국 설정이 없습니다.'`, `? pt('waitingLobby.noSettingsChanged')`],
  [`{pairLobbyRoomForm === 'edit' ? '저장' : pairLobbyRoomForm === 'propose' ? '제안하기' : '만들기'}`, `{pairLobbyRoomForm === 'edit' ? pt('waitingLobby.save') : pairLobbyRoomForm === 'propose' ? pt('waitingLobby.propose') : pt('waitingLobby.create')}`],
  [`<option value="public">공개방</option>`, `<option value="public">{pt('waitingLobby.publicRoom')}</option>`],
  [`<option value="private">비공개방</option>`, `<option value="private">{pt('waitingLobby.privateRoom')}</option>`],
  [`? '암호 4자'`, `? pt('waitingLobby.passwordFourChars')`],
  [`aria-label="비공개 방 비밀번호 4자"`, `aria-label={pt('waitingLobby.privatePasswordAria')}`],
  [`? '(비밀번호 4자)'`, `? pt('waitingLobby.passwordFourCharsHint')`],
  [`}>방 종류</div>`, `}>{pt('waitingLobby.roomKind')}</div>`],
  [`window.alert('이 방 종류를 만들려면 페어 펫을 장착해야 합니다.');`, `window.alert(pt('alerts.equipPetForRoomKind'));`],
  [`<span className="font-bold text-white">{delegateConfirmModal.userName}</span>님에게 방장을 위임하시겠습니까?`, `{pt('modals.delegateConfirm', { name: delegateConfirmModal.userName })}`],
  [`<span className="font-bold text-white">{kickConfirmModal.userName}</span>님을 방에서보내겠습니까?`, `{pt('modals.kickConfirm', { name: kickConfirmModal.userName })}`],
  [`<h2 id="pair-join-password-title" className="text-center text-base font-extrabold text-violet-100">방 입장</h2>`, `<h2 id="pair-join-password-title" className="text-center text-base font-extrabold text-violet-100">{pt('modals.joinRoom')}</h2>`],
  [`<p className="mt-0.5 text-center text-xs text-violet-200/80">비공개 방입니다. 비밀번호를 입력하세요.</p>`, `<p className="mt-0.5 text-center text-xs text-violet-200/80">{pt('modals.privateRoomEnter')}</p>`],
  [`<label className="mt-4 block text-xs font-bold text-cyan-100">비밀번호</label>`, `<label className="mt-4 block text-xs font-bold text-cyan-100">{pt('modals.password')}</label>`],
  [`placeholder="비밀번호"`, `placeholder={pt('modals.password')}`],
  [`<p className="mt-3 text-center text-sm leading-relaxed text-amber-100/90">대국 설정 변경제안이 왔습니다.</p>`, `<p className="mt-3 text-center text-sm leading-relaxed text-amber-100/90">{pt('modals.changeProposalReceived')}</p>`],
  [`title="대국 설정 변경 제안"`, `title={pt('modals.changeProposalTitle')}`],
  [`<span className="font-black text-amber-50">{prop.fromUserName}</span>님의 제안`, `{pt('modals.proposalFrom', { name: prop.fromUserName })}`],
  [`? '변경 제안이 수락되었습니다. 방장이 제안 내용을 반영했습니다.'`, `? pt('modals.proposalAccepted')`],
  [`: '변경 제안이 거절되었습니다.'}`, `: pt('modals.proposalRejected')}`],
  [`? '전략바둑 경기장으로 이동'`, `? pt('modals.navigateStrategicArena')`],
  [`? '놀이바둑 경기장으로 이동'`, `? pt('modals.navigatePlayfulArena')`],
  [`? '페어 경기장으로 이동'`, `? pt('modals.navigatePairArena')`],
  [`? '다른 경기장으로 이동하면 참여 중인 방에서 나가집니다. 계속하시겠습니까?'`, `? pt('modals.leaveRoomOnNavigate')`],
  [`: '참여한 방에서 나가집니다. 계속하시겠습니까?'`, `: pt('modals.leaveRoomConfirm')`],
  [`? '놀이바둑 방 목록'`, `? pt('waitingLobby.playfulRoomList')`],
  [`? '전략바둑 방 목록'`, `? pt('waitingLobby.strategicRoomList')`],
  [`: '페어 방 목록'`, `: pt('waitingLobby.pairRoomList')`],
  [`? '접속 중인 유저 목록'`, `? pt('waitingLobby.onlineUserList')`],
  [`? '유저 목록'`, `? pt('waitingLobby.userList')`],
  [`: '유저 목록 · 페어 AI 대전'`, `: pt('waitingLobby.userListPairAi')`],
  [`title="AI 대전 설정"`, `title={pt('waitingLobby.aiSettingsTitle')}`],
  [`title="랭킹전 매칭"`, `title={pt('waitingLobby.rankedMatchTitle')}`],
  [`title="페어바둑 대국 설정"`, `title={pt('waitingLobby.pairMatchSettings')}`],
  [`submitLabel="대국 시작"`, `submitLabel={pt('waitingLobby.startMatch')}`],
], { replaceAll: true });

// ShopModal
{
  const p = path.join(root, 'components/ShopModal.tsx');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    `    const vipProducts: MiscShopProduct[] = [
        {
            id: 'reward_vip',
            name: '보상 VIP',
            duration: '30일 적용',
            priceKRW: 9900,
            benefits: [
                'VIP 보상슬롯 활성화',
                '전략바둑 승리 보상 2배',
                '페어바둑 승리 보상 2배',
                '놀이바둑 승리 보상 2배',
                '길드 코인 보상 2배',
                '일일/주간/월간 퀘스트 보상2배',
                '퀘스트 활약도 보상2배',
                '모험 보물상자 2개오픈',
            ],
            benefitFooter: 'VIP보상슬롯 : 골드/장비상자/재료상자/전설장비 중 1개 획득',
        },
        {
            id: 'function_vip',
            name: '기능 VIP',
            duration: '30일 적용',
            priceKRW: 9900,
            benefits: [
                '행동력 최대치 +20',
                '행동력 회복 속도 50% 증가',
                '행동력 회복제 III 매일 지급',
                '대장간 경험치 획득 +50%',
                '장비 강화 성공확률 +10%',
                '장비 합성 대성공 확률 +10%',
                '장비 분해 대박 확률 +10%',
                '재료 분해/합성 대박 확률 +10%',
                '거래소 물품등록 가능(3개)',
                '펫 VIP수련슬롯 개방',
                '펫 VIP부화슬롯 개방',
                '챔피언십 경기 SKIP 기능',
            ],
        },
        {
            id: 'vvip',
            name: 'VVIP',
            duration: '30일 적용',
            priceKRW: 15900,
            benefits: ['보상 VIP + 기능 VIP 통합 혜택'],
        },
    ];`,
    `    const vipProducts: MiscShopProduct[] = useMemo(() => [
        {
            id: 'reward_vip',
            name: t('vipProducts.reward_vip.name'),
            duration: t('duration30Days'),
            priceKRW: 9900,
            benefits: ['0', '1', '2', '3', '4', '5', '6', '7'].map((k) => t(\`vipProducts.reward_vip.benefits.\${k}\`)),
            benefitFooter: t('vipProducts.reward_vip.benefitFooter'),
        },
        {
            id: 'function_vip',
            name: t('vipProducts.function_vip.name'),
            duration: t('duration30Days'),
            priceKRW: 9900,
            benefits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map((k) => t(\`vipProducts.function_vip.benefits.\${k}\`)),
        },
        {
            id: 'vvip',
            name: t('vipProducts.vvip.name'),
            duration: t('duration30Days'),
            priceKRW: 15900,
            benefits: [t('vipProducts.vvip.benefits.0')],
        },
    ], [t]);`,
  );
  // misc products - replace in chunks
  s = s.replace(/name: '다이아 패키지 I'/g, "name: t('packages.diamond_package_1')");
  s = s.replace(/name: '다이아 패키지 II'/g, "name: t('packages.diamond_package_2')");
  s = s.replace(/name: '다이아 패키지 III'/g, "name: t('packages.diamond_package_3')");
  s = s.replace(/name: '장비상자 패키지 I'/g, "name: t('packages.equipment_package_1')");
  s = s.replace(/name: '장비상자 패키지 II'/g, "name: t('packages.equipment_package_2')");
  s = s.replace(/name: '장비상자 패키지 III'/g, "name: t('packages.equipment_package_3')");
  s = s.replace(/name: '광고 제거'/g, "name: t('packages.remove_ads')");
  s = s.replace(/duration: '7일 적용'/g, "duration: t('duration7Days')");
  s = s.replace(/duration: '15일 적용'/g, "duration: t('duration15Days')");
  s = s.replace(/duration: '30일 적용'/g, "duration: t('duration30Days')");
  s = s.replace("'매일 우편으로 50다이아 지급 (총 350다이아)'", "t('packageBenefits.diamond_daily_50_350')");
  s = s.replace("'즉시 100다이아 지급'", "t('packageBenefits.diamond_instant_100')");
  s = s.replace("'매일 우편으로 50다이아 지급 (총 750다이아)'", "t('packageBenefits.diamond_daily_50_750')");
  s = s.replace("'즉시 250다이아 지급'", "t('packageBenefits.diamond_instant_250')");
  s = s.replace("'매일 우편으로 50다이아 지급 (총 1500다이아)'", "t('packageBenefits.diamond_daily_50_1500')");
  s = s.replace("'즉시 750다이아 지급'", "t('packageBenefits.diamond_instant_750')");
  s = s.replace("'장비상자 V 1개'", "t('packageBenefits.equip_pkg1_boxes')");
  s = s.replace("'재료상자 VI 1개'", "t('packageBenefits.equip_pkg1_mat')");
  s = s.replace('\'+ "에픽 장비" 확정지급\'', "t('packageBenefits.equip_pkg1_bonus')");
  s = s.replace("'장비상자 V 2개'", "t('packageBenefits.equip_pkg2_boxes')");
  s = s.replace("'재료상자 VI 2개'", "t('packageBenefits.equip_pkg2_mat')");
  s = s.replace('\'+ "전설 장비" 확정지급\'', "t('packageBenefits.equip_pkg2_bonus')");
  s = s.replace("'장비상자 VI 2개'", "t('packageBenefits.equip_pkg3_boxes')");
  s = s.replace("'재료상자 VI 5개'", "t('packageBenefits.equip_pkg3_mat')");
  s = s.replace('\'+ "신화 장비" 확정지급\'', "t('packageBenefits.equip_pkg3_bonus')");
  s = s.replace("'로비·대국 등 게임 내 배너·전면 광고 비표시'", "t('packageBenefits.remove_ads_1')");
  s = s.replace("'상점 보상형 광고 없이 동일 보상 수령(일일 한도 유지)'", "t('packageBenefits.remove_ads_2')");
  s = s.replace(/alt: '장비 상자 V'/g, "alt: t('boxNames.equipmentBox5')");
  s = s.replace(/displayName: '장비 상자 V'/g, "displayName: t('boxNames.equipmentBox5')");
  s = s.replace(/alt: '장비 상자 VI'/g, "alt: t('boxNames.equipmentBox6')");
  s = s.replace(/displayName: '장비 상자 VI'/g, "displayName: t('boxNames.equipmentBox6')");
  s = s.replace(/alt: '재료 상자 VI'/g, "alt: t('boxNames.materialBox6')");
  s = s.replace(/displayName: '재료 상자 VI'/g, "displayName: t('boxNames.materialBox6')");
  s = s.replace("setToastMessage('구매 요청이 처리되지 않았습니다. 잠시 후 다시 시도해 주세요.');", "setToastMessage(t('toast.purchaseFailed'));");
  s = s.replace("setToastMessage('컨디션 회복제 구매 완료! 회복 모달에서 사용할 수 있습니다.');", "setToastMessage(t('toast.conditionPotionPurchased'));");
  s = s.replace("setToastMessage('구매 완료! 가방을 확인하세요.');", "setToastMessage(t('toast.purchaseComplete'));");
  s = s.replace("setToastMessage('행동력 구매 완료!');", "setToastMessage(t('toast.actionPointPurchased'));");
  s = s.replace("setToastMessage('결제가 취소되었습니다.');", "setToastMessage(t('toast.paymentCancelled'));");
  s = s.replace("priceLabel: '원화 결제 (페이레터)',", "priceLabel: t('consent.cashPriceLabel'),");
  s = s.replace("summary: '결제 직후 다이아 또는 패키지 보상이 지급됩니다.',", "summary: t('consent.cashSummary'),");
  s = s.replace("priceLabel: billing === 'subscription' ? '정기결제 / 30일 자동 갱신' : '단건 결제 / 30일 적용',", "priceLabel: billing === 'subscription' ? t('consent.subscriptionPriceLabel') : t('consent.oneTimePriceLabel'),");
  s = s.replace("summary: 'VIP 멤버십 혜택이 30일간 적용됩니다.',", "summary: t('consent.vipSummary'),");
  s = s.replace('rewardDescription="일반 ~ 에픽 등급 장비 1개"', 'rewardDescription={t(\'adRewardDescriptions.equipment\')}');
  s = s.replace('rewardDescription="하급 ~ 상급 강화석 5개"', 'rewardDescription={t(\'adRewardDescriptions.materials\')}');
  s = s.replace('rewardDescription="다이아몬드 10개"', 'rewardDescription={t(\'adRewardDescriptions.diamonds\')}');
  s = s.replace('rewardDescription="행동력 회복제(+10) 1개"', 'rewardDescription={t(\'adRewardDescriptions.actionPoint\')}');
  s = s.replace(
    `{ itemId: 'action_point_10' as const, name: '행동력 회복제(+10)', description: '뭔가 하고싶은 의욕이 생긴다.', dailyLimit: 1, prices: [1000], badge: '+10' },
                    { itemId: 'action_point_20' as const, name: '행동력 회복제(+20)', description: '뭔가 해야 할 것 같다.', dailyLimit: 1, prices: [1500], badge: '+20' },
                    { itemId: 'action_point_30' as const, name: '행동력 회복제(+30)', description: '바로 경기를 하러 가자.', dailyLimit: 1, prices: [2000], badge: '+30' },`,
    `{ itemId: 'action_point_10' as const, name: t('items.action_point_10.name'), description: t('items.action_point_10.description'), dailyLimit: 1, prices: [1000], badge: '+10' },
                    { itemId: 'action_point_20' as const, name: t('items.action_point_20.name'), description: t('items.action_point_20.description'), dailyLimit: 1, prices: [1500], badge: '+20' },
                    { itemId: 'action_point_30' as const, name: t('items.action_point_30.name'), description: t('items.action_point_30.description'), dailyLimit: 1, prices: [2000], badge: '+30' },`,
  );
  if (!s.includes("useMemo")) {
    s = s.replace(
      "import React, { useCallback, useEffect, useRef, useState } from 'react';",
      "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
    );
  }
  fs.writeFileSync(p, s);
  console.log('ShopModal: localized');
}

console.log('part3 done');
