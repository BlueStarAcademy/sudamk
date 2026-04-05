import { LiveGameSession, GameMode, GameSettings, SinglePlayerStageInfo } from '../types.js';
import { Player } from '../types/enums.js';

export type PreGameSpecialHighlight = {
  img: string;
  text: string;
};

export type PreGameSummaryFour = {
  winGoal: string;
  scoreFactors: string;
  /** 초읽기·피셔 등 시간 규칙만 (놀이 모드 등 해당 없으면 '없음') */
  timeRules: string;
  /** 모드별 특수 규칙(이미지+문구). 없으면 빈 배열 → UI에서 '없음' */
  specialHighlights: PreGameSpecialHighlight[];
  items: string;
};

const NONE = '없음';

/** 바둑판 문양돌과 동일 스프라이트(`GoBoard` 흑 문양) — 게임 설명 모달 하이라이트 */
const PATTERN_STONE_HIGHLIGHT_IMG = '/images/single/BlackDouble.png';

function defaultBaseStoneCount(settings: GameSettings): number {
  return settings.baseStones ?? 4;
}

function mixedList(s: GameSettings): GameMode[] {
  return s.mixedModes ?? [];
}

function hasMix(m: GameMode[], mode: GameMode): boolean {
  return m.includes(mode);
}

function effectiveModesForRules(mode: GameMode, mix: GameMode[]): GameMode[] {
  if (mode === GameMode.Mix) return mix.length ? mix : [];
  return [mode];
}

function usesTerritoryScoring(mode: GameMode, mix: GameMode[]): boolean {
  if (mode === GameMode.Mix) {
    if (mix.length === 0) return true;
    if (hasMix(mix, GameMode.Capture) && mix.length === 1) return false;
    return true;
  }
  return [GameMode.Standard, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile].includes(mode);
}

function autoScoringLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string | null {
  const n = settings.scoringTurnLimit;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (!usesTerritoryScoring(mode, mix)) return null;
  if (mode === GameMode.Capture || hasMix(mix, GameMode.Capture)) {
    return `${n}턴(수) 도달 시 자동 계가 진행`;
  }
  return `${n}수(턴) 후 자동 계가에서 승리하기`;
}

function timeLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string {
  if ([GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief].includes(mode)) return NONE;
  if (
    mode === GameMode.Mix &&
    !hasMix(mix, GameMode.Speed) &&
    mix.every((x) => ![GameMode.Standard, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Speed].includes(x))
  ) {
    return NONE;
  }
  if (!settings.timeLimit || settings.timeLimit <= 0) return '시간 제한 없음';
  if (mode === GameMode.Speed || hasMix(mix, GameMode.Speed)) {
    return `피셔 · 본전 ${settings.timeLimit}분 + ${settings.timeIncrement ?? 0}초/수`;
  }
  return `제한 ${settings.timeLimit}분 · 초읽기 ${settings.byoyomiTime ?? 30}초×${settings.byoyomiCount ?? 3}회`;
}

function territoryScoreParts(settings: GameSettings, mode: GameMode, mix: GameMode[]): string[] {
  const parts: string[] = ['영토', '따낸 돌', '사석', '덤(백)'];
  const em = effectiveModesForRules(mode, mix);
  if (em.includes(GameMode.Base)) parts.push('베이스 보너스');
  if (em.includes(GameMode.Hidden)) parts.push('히든 보너스');
  if (em.includes(GameMode.Speed)) parts.push('시간 보너스');
  if (em.includes(GameMode.Missile)) parts.push('미사일 연출 반영');
  return parts;
}

function itemLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string {
  const chunks: string[] = [];
  if (mode === GameMode.Hidden || hasMix(mix, GameMode.Hidden)) {
    chunks.push(`히든 ${settings.hiddenStoneCount ?? 0}개`);
    chunks.push(`스캔 ${settings.scanCount ?? 0}개`);
  }
  if (mode === GameMode.Missile || hasMix(mix, GameMode.Missile)) {
    chunks.push(`미사일 ${settings.missileCount ?? 0}개`);
  }
  if (mode === GameMode.Dice) {
    const o = settings.oddDiceCount ?? 0;
    const e = settings.evenDiceCount ?? 0;
    const l = settings.lowDiceCount ?? 0;
    const h = settings.highDiceCount ?? 0;
    if (o + e + l + h > 0) chunks.push(`주사위 아이템 홀${o}·짝${e}·저${l}·고${h}`);
  }
  if (mode === GameMode.Alkkagi) {
    chunks.push(`슬로우 ${settings.alkkagiSlowItemCount ?? 0} · 조준 ${settings.alkkagiAimingLineItemCount ?? 0}`);
  }
  if (mode === GameMode.Curling) {
    chunks.push(`슬로우 ${settings.curlingSlowItemCount ?? 0} · 조준 ${settings.curlingAimingLineItemCount ?? 0}`);
  }
  return chunks.length ? chunks.join(' · ') : NONE;
}

function mixWinGoal(settings: GameSettings, mix: GameMode[]): string {
  const cap = hasMix(mix, GameMode.Capture);
  const auto = autoScoringLine(settings, GameMode.Mix, mix);
  const tail = mix.filter((m) => m !== GameMode.Standard);
  if (cap) {
    const t = settings.captureTarget ?? 20;
    const base = `따내기 ${t}점 선달성 시 즉시 승리 · 미달성 시 계가 후 집 비교`;
    return auto ? `${base} · ${auto}` : base;
  }
  if (auto) {
    return `${auto} — 집이 많은 쪽 승리`;
  }
  return tail.length ? `조합(${tail.join(', ')}) — 종료 시 규칙에 따라 승패 결정` : '종료 시 규칙에 따라 승패 결정';
}

function mixScoreFactors(settings: GameSettings, mix: GameMode[]): string {
  const parts: string[] = [];
  if (hasMix(mix, GameMode.Capture)) parts.push('따내기 점수');
  const terr =
    hasMix(mix, GameMode.Standard) ||
    hasMix(mix, GameMode.Speed) ||
    hasMix(mix, GameMode.Base) ||
    hasMix(mix, GameMode.Hidden) ||
    hasMix(mix, GameMode.Missile);
  if (terr) {
    parts.push(...territoryScoreParts(settings, GameMode.Mix, mix));
  }
  const dedup = [...new Set(parts)];
  return dedup.length ? dedup.join(' · ') : '모드 조합에 따름';
}

function mixSpecialHighlights(settings: GameSettings, mix: GameMode[]): PreGameSpecialHighlight[] {
  const h: PreGameSpecialHighlight[] = [];
  const bs = defaultBaseStoneCount(settings);
  if (hasMix(mix, GameMode.Capture)) {
    h.push({ img: PATTERN_STONE_HIGHLIGHT_IMG, text: '문양돌 따내기 2점' });
  }
  if (hasMix(mix, GameMode.Base)) {
    h.push({
      img: '/images/simbols/simbol4.png',
      text: `비밀 베이스돌 최대 ${bs}개 · 공개 후 덤/색 입찰 · 계가 보너스`,
    });
  }
  if (hasMix(mix, GameMode.Hidden)) {
    h.push({ img: '/images/button/hidden.png', text: '히든 착수 · 스캔으로 탐색' });
  }
  if (hasMix(mix, GameMode.Missile)) {
    h.push({ img: '/images/button/missile.png', text: '미사일로 돌 직선 이동' });
  }
  if (hasMix(mix, GameMode.Speed)) {
    h.push({ img: '/images/icon/timer.png', text: '피셔 시계 · 착수당 시간 가산 · 계가 시 시간 보너스' });
  }
  const auto = autoScoringLine(settings, GameMode.Mix, mix);
  if (auto) {
    h.push({ img: '/images/simbols/simbol7.png', text: auto });
  }
  return h;
}

function singlePlayerStageTimeRules(stage: SinglePlayerStageInfo): string {
  const tc = stage.timeControl;
  if (tc.type === 'fischer') {
    return `피셔 · 본전 ${tc.mainTime}분 + ${tc.increment ?? 0}초/수`;
  }
  if (tc.mainTime && tc.mainTime > 0) {
    return `제한 ${tc.mainTime}분 · 초읽기 ${tc.byoyomiTime ?? 30}초×${tc.byoyomiCount ?? 3}회`;
  }
  return NONE;
}

function singlePlayerStageHighlights(session: LiveGameSession, stage: SinglePlayerStageInfo): PreGameSpecialHighlight[] {
  const h: PreGameSpecialHighlight[] = [];
  const isCaptureMode = stage.blackTurnLimit !== undefined || session.mode === GameMode.Capture;
  const bs = defaultBaseStoneCount(session.settings);

  if ((stage.placements.blackPattern > 0 || stage.placements.whitePattern > 0) && isCaptureMode) {
    h.push({ img: PATTERN_STONE_HIGHLIGHT_IMG, text: '문양돌 따내기 2점' });
  }
  if (session.mode === GameMode.Base) {
    h.push({
      img: '/images/simbols/simbol4.png',
      text: `비밀 베이스돌 최대 ${bs}개 · 공개 시 계가 보너스`,
    });
  }
  if (stage.survivalTurns) {
    h.push({
      img: '/images/simbols/simbol1.png',
      text: `살리기 바둑 · 백 ${stage.survivalTurns}턴 내 목표 점수`,
    });
  }
  if (stage.autoScoringTurns && stage.autoScoringTurns > 0) {
    h.push({ img: '/images/simbols/simbol7.png', text: `${stage.autoScoringTurns}수 후 자동 계가` });
  }
  if (stage.blackTurnLimit) {
    h.push({ img: '/images/icon/timer.png', text: `흑 ${stage.blackTurnLimit}턴 제한` });
  }
  if ((stage.missileCount ?? 0) > 0) {
    h.push({ img: '/images/button/missile.png', text: `미사일 ${stage.missileCount}개` });
  }
  if ((stage.hiddenCount ?? 0) > 0 || (stage.scanCount ?? 0) > 0) {
    h.push({
      img: '/images/button/hidden.png',
      text: `히든 ${stage.hiddenCount ?? 0}개 · 스캔 ${stage.scanCount ?? 0}개`,
    });
  }
  return h;
}

/**
 * 인게임 시작 전 모달용 요약 (승리 목표 / 점수 요인 / 시간 규칙 / 아이템 + 특수 규칙 행)
 */
export function getPreGameSummaryFour(session: LiveGameSession, stage?: SinglePlayerStageInfo): PreGameSummaryFour {
  const { mode, settings } = session;
  const mix = mixedList(settings);
  const bs = defaultBaseStoneCount(settings);

  if (stage) {
    return getSinglePlayerStageSummary(session, stage);
  }

  if (mode === GameMode.Mix) {
    return {
      winGoal: mixWinGoal(settings, mix),
      scoreFactors: mixScoreFactors(settings, mix),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: mixSpecialHighlights(settings, mix),
      items: itemLine(settings, mode, mix),
    };
  }

  if (mode === GameMode.Capture) {
    const t = settings.captureTarget ?? 20;
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto ? `상대 돌 ${t}점 먼저 따내기 · ${auto}` : `상대 돌 ${t}점 먼저 따내기`,
      scoreFactors: '따내기 점수(집 계산 없음)',
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [{ img: PATTERN_STONE_HIGHLIGHT_IMG, text: '문양돌 따내기 2점' }],
      items: NONE,
    };
  }

  if (mode === GameMode.Speed) {
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 종합 점수가 높은 쪽 승리',
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        { img: '/images/icon/timer.png', text: '피셔 시계 · 사용 시간에 따른 계가 시간 보너스' },
      ],
      items: NONE,
    };
  }

  if (mode === GameMode.Base) {
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: '/images/simbols/simbol4.png',
          text: `비밀 베이스돌 최대 ${bs}개 · 공개 후 덤/색 입찰 · 계가 보너스`,
        },
      ],
      items: NONE,
    };
  }

  if (mode === GameMode.Hidden) {
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [{ img: '/images/button/hidden.png', text: '히든 착수 · 스캔으로 탐색' }],
      items: itemLine(settings, mode, mix),
    };
  }

  if (mode === GameMode.Missile) {
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [{ img: '/images/button/missile.png', text: '미사일로 돌 직선 이동' }],
      items: itemLine(settings, mode, mix),
    };
  }

  if (mode === GameMode.Standard) {
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: auto ? [{ img: '/images/simbols/simbol7.png', text: auto }] : [],
      items: NONE,
    };
  }

  if (mode === GameMode.Omok) {
    const f33 = settings.has33Forbidden ? '쌍삼 금지' : '쌍삼 허용';
    const fo = settings.hasOverlineForbidden ? '장목 금지' : '장목 허용';
    return {
      winGoal: '가로·세로·대각 5목 먼저 완성',
      scoreFactors: '목(승부) — 집 계산 없음',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp2.png', text: `${f33} · ${fo}` }],
      items: NONE,
    };
  }

  if (mode === GameMode.Ttamok) {
    const cap = settings.captureTarget ?? 5;
    const f33 = settings.has33Forbidden ? '쌍삼 금지' : '쌍삼 허용';
    const fo = settings.hasOverlineForbidden ? '장목 금지' : '장목 허용';
    return {
      winGoal: `5목 선완성 또는 따내기 ${cap}점 선달성`,
      scoreFactors: '목 승리 또는 따내기 점수',
      timeRules: NONE,
      specialHighlights: [
        { img: '/images/simbols/simbolp2.png', text: `${f33} · ${fo}` },
        { img: '/images/simbols/simbol2.png', text: `따내기 ${cap}점 선달성 시 승리` },
      ],
      items: NONE,
    };
  }

  if (mode === GameMode.Dice) {
    const r = settings.diceGoRounds ?? 3;
    return {
      winGoal: `${r}라운드 후 누적 점수가 높은 쪽 승리`,
      scoreFactors: '라운드별 백돌 따내기 점수 · 마지막 따내기 보너스',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp1.png', text: '주사위 눈만큼 흑 착수 · 백은 활로에만 배치' }],
      items: itemLine(settings, mode, mix),
    };
  }

  if (mode === GameMode.Thief) {
    return {
      winGoal: '5턴×라운드 진행 후 총점이 높은 쪽 승리',
      scoreFactors: '라운드별 획득 점수 합산',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp4.png', text: '도둑(흑)·경찰(백) 역할 교대' }],
      items: NONE,
    };
  }

  if (mode === GameMode.Alkkagi) {
    return {
      winGoal: '라운드별로 상대 돌을 판 밖으로 더 많이 밀어낸 쪽 승',
      scoreFactors: '판 밖으로 나간 상대 돌 수',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp5.png', text: '게이지로 힘 조절 · 벽 반사' }],
      items: itemLine(settings, mode, mix),
    };
  }

  if (mode === GameMode.Curling) {
    return {
      winGoal: '라운드 합산 점수가 높은 쪽 승리',
      scoreFactors: '하우스(목표)에 가까운 스톤 점수',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp6.png', text: '스톤 미끄러뜨리기 · 라운드제' }],
      items: itemLine(settings, mode, mix),
    };
  }

  return {
    winGoal: '대국 진행에 따라 승패 결정',
    scoreFactors: '모드 안내 참고',
    timeRules: NONE,
    specialHighlights: [],
    items: NONE,
  };
}

function getSinglePlayerStageSummary(session: LiveGameSession, stage: SinglePlayerStageInfo): PreGameSummaryFour {
  const effectiveTargets = session.effectiveCaptureTargets;
  const blackTarget = effectiveTargets?.[Player.Black];
  const whiteTarget = effectiveTargets?.[Player.White];
  const isCaptureMode = stage.blackTurnLimit !== undefined || session.mode === GameMode.Capture;
  const isSpeedMode = !isCaptureMode && stage.timeControl.type === 'fischer';

  let winGoal = '스테이지 조건에 따라 승패 결정';
  if (stage.survivalTurns) {
    const tgt = stage.targetScore.black;
    winGoal = `백이 ${stage.survivalTurns}턴 내 목표 ${tgt}점 못 달성 → 흑 승`;
  } else if (isCaptureMode) {
    if (stage.blackTurnLimit && typeof blackTarget === 'number' && blackTarget !== 999) {
      winGoal =
        typeof whiteTarget === 'number' && whiteTarget !== 999
          ? `${stage.blackTurnLimit}턴 내 흑 ${blackTarget}점+ · 백은 ${whiteTarget}점 달성 시 승`
          : `${stage.blackTurnLimit}턴 내 흑 ${blackTarget}점 이상 따내기`;
    } else if (typeof blackTarget === 'number' && blackTarget !== 999 && typeof whiteTarget === 'number' && whiteTarget !== 999) {
      winGoal = `흑 ${blackTarget}점 · 백 ${whiteTarget}점 선달성 경쟁`;
    } else if (typeof session.settings.captureTarget === 'number') {
      winGoal = `흑이 ${session.settings.captureTarget}점 먼저 따내기`;
    } else {
      winGoal = '따내기 목표 달성 시 승리';
    }
  } else if (isSpeedMode) {
    winGoal = '계가 후 종합 점수(시간 보너스 포함)로 승부';
  } else if (stage.autoScoringTurns && stage.autoScoringTurns > 0) {
    winGoal = `${stage.autoScoringTurns}수 후 자동 계가에서 승리하기`;
  } else if (stage.blackTurnLimit && stage.targetScore.black > 0) {
    winGoal = `${stage.blackTurnLimit}턴 내 ${stage.targetScore.black}점 이상`;
  } else if (stage.targetScore.black > 0 && stage.targetScore.white > 0) {
    winGoal = `계가 시 흑 ${stage.targetScore.black}집+ · 백 ${stage.targetScore.white}집+ 목표`;
  } else {
    winGoal = '계가 후 집이 많은 쪽 승리';
  }

  let scoreFactors = '스테이지·모드에 따름';
  if (isCaptureMode) scoreFactors = '따내기 점수 · 문양돌은 2점';
  else if (isSpeedMode) scoreFactors = '영토 · 따낸 돌 · 사석 · 덤 · 시간 보너스';
  else if (session.mode === GameMode.Capture) scoreFactors = '따내기 점수';
  else scoreFactors = '영토 · 따낸 돌 · 사석 · 덤(백)';

  const itemBits: string[] = [];
  if ((stage.missileCount ?? 0) > 0) itemBits.push(`미사일 ${stage.missileCount}개`);
  if ((stage.hiddenCount ?? 0) > 0) itemBits.push(`히든 ${stage.hiddenCount}개`);
  if ((stage.scanCount ?? 0) > 0) itemBits.push(`스캔 ${stage.scanCount}개`);

  const specialHighlights = singlePlayerStageHighlights(session, stage);

  return {
    winGoal,
    scoreFactors,
    timeRules: singlePlayerStageTimeRules(stage),
    specialHighlights,
    items: itemBits.length ? itemBits.join(' · ') : NONE,
  };
}
