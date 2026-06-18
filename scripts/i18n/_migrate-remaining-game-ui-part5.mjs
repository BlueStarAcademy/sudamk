/** Part 5: shared control string replacements across remaining game/*.tsx */
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

const root = path.resolve(import.meta.dirname, '../..');
const files = globSync('components/game/*.tsx', { cwd: root });

const shared = [
  ['alt="기권"', 'alt={tx("game:controls.resignAlt")}'],
  ["title={gameStatus === 'scoring' ? '계가 집계 중에는 기권할 수 없습니다.' : '기권하기'}", "title={gameStatus === 'scoring' ? tx('game:controls.cannotResignDuringScoring') : tx('game:controls.resignTitle')}"],
  ['>기권</span>', '>{tx("game:controls.resign")}</span>'],
  ['alt="히든"', 'alt={tx("game:controls.hidden")}'],
  ['title="히든 스톤 배치"', "title={tx('game:controls.hiddenPlaceTitle')}"],
  ['>히든</span>', '>{tx("game:controls.hidden")}</span>'],
  ['alt="스캔"', 'alt={tx("game:controls.scan")}'],
  ['title="스캔"', "title={tx('game:controls.scan')}"],
  ['>스캔</span>', '>{tx("game:controls.scan")}</span>'],
  ['alt="미사일"', 'alt={tx("game:controls.missile")}'],
  ['title="미사일 발사"', "title={tx('game:controls.missileLaunchTitle')}"],
  ['>미사일</span>', '>{tx("game:controls.missile")}</span>'],
  ['>계가 중...</', '>{tx("game:towerSummary.scoring")}</'],
  ['confirmText="확인"', 'confirmText={tx("common:actions.confirm")}'],
  ['cancelText="취소"', 'cancelText={tx("common:actions.cancel")}'],
  ['>확인</', '>{tx("common:actions.confirm")}</'],
  ['>취소</', '>{tx("common:actions.cancel")}</'],
];

const scoringOverlay = [
  ['>AI가 바둑판을 분석하고 있어요</p>', '>{tx("game:scoringOverlay.analyzing")}</p>'],
  ['`약 ${remainingSec}초 남음`', "tx('game:scoringOverlay.secondsLeft', { sec: remainingSec })"],
  ["'곧 완료...'", "tx('game:scoringOverlay.completingSoon')"],
];

for (const rel of files) {
  let f = fs.readFileSync(path.join(root, rel), 'utf8');
  const before = f;
  if (!f.includes('runtimeText') && /[\uAC00-\uD7A3]/.test(f)) {
    const nl = f.indexOf('\n');
    f = f.slice(0, nl + 1) + "import { tx } from '../../shared/i18n/runtimeText.js';\n" + f.slice(nl + 1);
  }
  for (const [a, b] of shared) f = f.replaceAll(a, b);
  if (rel.endsWith('ScoringOverlay.tsx')) {
    for (const [a, b] of scoringOverlay) f = f.replaceAll(a, b);
  }
  if (f !== before) fs.writeFileSync(path.join(root, rel), f);
}

console.log('Part 5 applied to', files.length, 'files');
