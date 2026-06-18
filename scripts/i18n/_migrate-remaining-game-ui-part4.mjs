/** Part 4: remaining game/*.tsx Korean UI */
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, c) => fs.writeFileSync(path.join(root, r), c, 'utf8');
const ei = (f, line) => (f.includes(line.trim()) ? f : f.replace('\n', '\n' + line));
const hook = (f, marker, line) => {
  if (f.includes(line.trim())) return f;
  const i = f.indexOf(marker);
  if (i < 0) return f;
  const b = f.indexOf('{', i);
  const nl = f.indexOf('\n', b);
  return f.slice(0, nl + 1) + line + f.slice(nl + 1);
};

// AnalysisWindows
{
  let f = read('components/game/AnalysisWindows.tsx');
  f = ei(f, "import { useTranslation } from 'react-i18next';\n");
  f = hook(f, 'const TerritoryAnalysisWindow', "    const { t } = useTranslation('game');\n");
  f = hook(f, 'const HintAnalysisWindow', "    const { t } = useTranslation('game');\n");
  const p = [
    ['title="형세분석"', "title={t('analysis.territoryTitle')}"],
    ['>분석 데이터를 불러오는 중입니다...</p>', ">{t('analysis.loadingData')}</p>"],
    ["const leadPlayer = scoreDiff > 0 ? '흑' : '백';", "const leadPlayer = scoreDiff > 0 ? t('black') : t('white');"],
    ['>흑 {blackWinRate', ">{t('black')} {blackWinRate"],
    ['>백 {whiteWinRate', ">{t('white')} {whiteWinRate"],
    ['>예상 집 차이</span>', ">{t('analysis.expectedScoreDiff')}</span>"],
    ['{leadPlayer} {leadAmount}집 우세', "{t('analysis.leadByPoints', { player: leadPlayer, amount: leadAmount })}"],
    ['>흑</h4>', ">{t('black')}</h4>"],
    ['>백</h4>', ">{t('white')}</h4>"],
    ['>영토:</span>', ">{t('summary.territory')}:</span>"],
    ['>따낸 돌:</span>', ">{t('summary.captures')}:</span>"],
    ['>사석:</span>', ">{t('summary.deadStones')}:</span>"],
    ['>덤:</span>', ">{t('summary.komi')}:</span>"],
    ['>총점:</span>', ">{t('summary.total')}:</span>"],
    ['>베이스:</span>', ">{t('analysis.baseBonus')}:</span>"],
    ['>히든돌:</span>', ">{t('analysis.hiddenBonus')}:</span>"],
    ['>시간:</span>', ">{t('analysis.timeBonus')}:</span>"],
    ['>아이템:</span>', ">{t('analysis.itemBonus')}:</span>"],
    ['title="AI 추천수"', "title={t('analysis.aiHintTitle')}"],
    ['>추천수를 계산하는 중이거나, 추천수가 없습니다.</p>', ">{t('analysis.noHint')}</p>"],
    ['move.scoreLead > 0 ? `흑 +` : `백 +`', "move.scoreLead > 0 ? `${t('black')} +` : `${t('white')} +`"],
    ['>승률: {move.winrate.toFixed(1)}%</span>', ">{t('analysis.winRate', { rate: move.winrate.toFixed(1) })}</span>"],
  ];
  for (const [a, b] of p) f = f.replaceAll(a, b);
  write('components/game/AnalysisWindows.tsx', f);
}

// BaseCaptureMixBidFooterStrip
{
  let f = read('components/game/BaseCaptureMixBidFooterStrip.tsx');
  f = ei(f, "import { useTranslation } from 'react-i18next';\n");
  f = hook(f, 'const BaseCaptureMixBidFooterStrip', "    const { t } = useTranslation('game');\n");
  const p = [
    ['>1차 제시</span>', ">{t('baseCaptureMix.round1')}</span>"],
    ['>양측의 흑(선) 점수 제시를 기다리는 중입니다.</p>', ">{t('baseCaptureMix.waitingBothBids')}</p>"],
    ['winnerLine = `${winner.nickname}님 ${wBid}점 → 흑(선), 백 목표 ${Math.max(1, baseTarget - wBid)}점`;', "winnerLine = t('baseCaptureMix.winnerLine', { name: winner.nickname, bid: wBid, target: Math.max(1, baseTarget - wBid) });"],
    ["? '제시한 동점이 같습니다. 무작위로 흑·백을 정합니다.'", "? t('baseCaptureMix.tieRandomBoth')"],
    [": '동점 — 무작위로 흑·백을 정합니다.'", ": t('baseCaptureMix.tieRandom')"],
    [": '동점 — 재제시로 전환합니다.';", ": t('baseCaptureMix.tieRebid');"],
    ["{biddingRound === 2 ? ' · 2차' : ''}", "{biddingRound === 2 ? t('baseCaptureMix.round2Suffix') : ''}"],
    ["{isTie && biddingRound === 1 ? '잠시만 기다려 주세요…' : '다음 단계로 넘어갑니다…'}", "{isTie && biddingRound === 1 ? t('baseCaptureMix.pleaseWait') : t('baseCaptureMix.proceedingNext')}"],
    ['>제시 {myBid}점 확정</span>', ">{t('baseCaptureMix.bidConfirmed', { bid: myBid })}</span>"],
    ['>{opponent.nickname}님 제시 대기</p>', ">{t('baseCaptureMix.waitingOpponentBid', { name: opponent.nickname })}</p>"],
    ['>기본</span>', ">{t('baseCaptureMix.defaultLabel')}</span>"],
    ['>제시</span>', ">{t('baseCaptureMix.bidLabel')}</span>"],
    ['>무제한</span>', ">{t('baseCaptureMix.unlimited')}</span>"],
    ['>점</span>', ">{t('baseCaptureMix.pointsUnit')}</span>"],
    ["{isSubmitting ? '전송…' : !canSubmitPairBid ? '방장 제시' : '제시 확정'}", "{isSubmitting ? t('baseCaptureMix.submitting') : !canSubmitPairBid ? t('baseCaptureMix.hostBid') : t('baseCaptureMix.confirmBid')}"],
  ];
  for (const [a, b] of p) f = f.replaceAll(a, b);
  f = f.replace(
    '흑이 되면 백 따내기 목표 <span className="font-bold text-cyan-200/95">{whiteTargetIfWin}</span>점 (기본 {baseTarget}점)',
    "{t('baseCaptureMix.blackTargetHint', { target: whiteTargetIfWin, base: baseTarget })}",
  );
  write('components/game/BaseCaptureMixBidFooterStrip.tsx', f);
}

// MoveConfirmFooterSlot
{
  let f = read('components/game/MoveConfirmFooterSlot.tsx');
  f = f.replace(
    "const title = !mobileConfirm\n        ? '착수 버튼 모드가 OFF입니다.'\n        : pendingMove\n          ? '착수 확정'\n          : '바둑판을 클릭해 착점을 선택하세요';",
    "const title = !mobileConfirm\n        ? tx('game:moveConfirm.modeOff')\n        : pendingMove\n          ? tx('game:moveConfirm.confirmTitle')\n          : tx('game:moveConfirm.pickPoint');",
  );
  f = f.replace('aria-label="착수 버튼 모드"', "aria-label={tx('game:moveConfirm.modeAria')}");
  write('components/game/MoveConfirmFooterSlot.tsx', f);
}

console.log('Part 4 done');
