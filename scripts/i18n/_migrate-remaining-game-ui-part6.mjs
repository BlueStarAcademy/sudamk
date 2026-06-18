/** Part 6: chess, result modal, strategic time, misc */
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const rp = (rel, pairs) => {
  let f = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const [a, b] of pairs) f = f.replaceAll(a, b);
  fs.writeFileSync(path.join(root, rel), f);
};

rp('components/game/ChessPiecePlacementPanel.tsx', [
  ["{ type: 'pawn', label: '폰' }", "{ type: 'pawn', label: tx('game:chessPlacement.pawn') }"],
  ["{ type: 'rook', label: '룩' }", "{ type: 'rook', label: tx('game:chessPlacement.rook') }"],
  ["{ type: 'knight', label: '나이트' }", "{ type: 'knight', label: tx('game:chessPlacement.knight') }"],
  ["{ type: 'bishop', label: '비숍' }", "{ type: 'bishop', label: tx('game:chessPlacement.bishop') }"],
  ["{ type: 'queen', label: '퀸' }", "{ type: 'queen', label: tx('game:chessPlacement.queen') }"],
  ['title={`${label} · ${moves}회 · ${cost}점`}', "title={tx('game:chessPlacement.pieceTitle', { label, moves, cost })}"],
  ['>방장이 기물을 배치합니다</p>', '>{tx("game:chessPlacement.hostPlacing")}</p>'],
  ['>배치가 끝나면 공격 턴에 참여합니다.</p>', '>{tx("game:chessPlacement.hostPlacingHint")}</p>'],
  ["{isAiGame ? '배치 완료 · 게임을 시작합니다…' : '배치 완료 · 상대를 기다리는 중…'}", "{isAiGame ? tx('game:chessPlacement.completeStarting') : tx('game:chessPlacement.completeWaiting')}"],
  ['>{secondsLeft}초</span>', '>{tx("game:chessPlacement.secondsLeft", { sec: secondsLeft })}</span>'],
  ["{opponentReady ? '● 상대 배치 완료' : '○ 상대 배치 중'}", "{opponentReady ? tx('game:chessPlacement.opponentReady') : tx('game:chessPlacement.opponentPlacing')}"],
  ['>랜덤 배치</span>', '>{tx("game:chessPlacement.randomPlace")}</span>'],
  ['>재배치</span>', '>{tx("game:chessPlacement.reset")}</span>'],
]);

// ensure tx import in ChessPiecePlacementPanel
{
  let f = fs.readFileSync(path.join(root, 'components/game/ChessPiecePlacementPanel.tsx'), 'utf8');
  if (!f.includes('runtimeText')) {
    f = f.replace("import React", "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
    fs.writeFileSync(path.join(root, 'components/game/ChessPiecePlacementPanel.tsx'), f);
  }
}

rp('components/game/ResultModalXpRewardBadge.tsx', [
  ["const modeLabel = variant === 'strategy' ? '' : variant === 'playful' ? '놀이' : '펫';", "const modeLabel = variant === 'strategy' ? '' : variant === 'playful' ? tx('game:resultModal.playfulShort') : tx('game:resultModal.petShort');"],
  ["? '변동 없음'", "? tx('game:resultModal.noChange')"],
  ['`기본 +${petXpSpecSplit.base.toLocaleString()} (특화 +${petXpSpecSplit.spec.toLocaleString()})`', "tx('game:resultModal.petXpSplit', { base: petXpSpecSplit.base.toLocaleString(), spec: petXpSpecSplit.spec.toLocaleString() })"],
  ['`${modeLabel} 경험치 +${amount.toLocaleString()}`', "tx('game:resultModal.modeXpGain', { mode: modeLabel, amount: amount.toLocaleString() })"],
  ['>변동 없음</span>', '>{tx("game:resultModal.noChange")}</span>'],
  ['title="펫 등급강화 필요"', "title={tx('game:resultModal.petGradeUpgradeNeeded')}"],
]);

{
  let f = fs.readFileSync(path.join(root, 'components/game/ResultModalXpRewardBadge.tsx'), 'utf8');
  if (!f.includes('runtimeText')) {
    f = f.replace("import React", "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
    fs.writeFileSync(path.join(root, 'components/game/ResultModalXpRewardBadge.tsx'), f);
  }
}

rp('components/game/AiPregameRewardVisualStrip.tsx', [
  ['>보상 VIP</span>', '>{tx("game:resultModal.rewardVip")}</span>'],
  ["expTopLabel: slot.xpVariant === 'playful' ? '놀이' : undefined", "expTopLabel: slot.xpVariant === 'playful' ? tx('game:resultModal.playfulShort') : undefined"],
  ["line: '보상'", "line: tx('game:resultModal.rewardLine')"],
  ["line: 'VIP 보상'", "line: tx('game:resultModal.vipRewardLine')"],
  ['>보상</span>', '>{tx("game:resultModal.rewardLine")}</span>'],
]);

{
  let f = fs.readFileSync(path.join(root, 'components/game/AiPregameRewardVisualStrip.tsx'), 'utf8');
  if (!f.includes('runtimeText')) {
    f = f.replace("import React", "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
    fs.writeFileSync(path.join(root, 'components/game/AiPregameRewardVisualStrip.tsx'), f);
  }
}

rp('components/game/StrategicTimeControlFields.tsx', [
  ['label="시간 방식"', 'label={tx("game:strategicTimeControl.timeMode")}'],
  ['>제한시간 + 초읽기</option>', '>{tx("game:strategicTimeControl.byoyomiOption")}</option>'],
  ['>제한시간 + 피셔</option>', '>{tx("game:strategicTimeControl.fischerOption")}</option>'],
  ["label={isSpeed ? '메인 제한 시간' : '제한 시간'}", "label={isSpeed ? tx('game:strategicTimeControl.mainTimeLimit') : tx('game:strategicTimeControl.timeLimit')}"],
  ['label="초읽기"', 'label={tx("game:strategicTimeControl.byoyomi")}'],
  ['label="피셔 추가"', 'label={tx("game:strategicTimeControl.fischerIncrement")}'],
]);

{
  let f = fs.readFileSync(path.join(root, 'components/game/StrategicTimeControlFields.tsx'), 'utf8');
  if (!f.includes('runtimeText')) {
    f = f.replace("import React", "import { tx } from '../../shared/i18n/runtimeText.js';\nimport React");
    fs.writeFileSync(path.join(root, 'components/game/StrategicTimeControlFields.tsx'), f);
  }
}

console.log('Part 6 done');
