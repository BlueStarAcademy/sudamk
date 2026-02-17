import React, { useMemo } from 'react';
import Button from './Button.js';
import { LiveGameSession, GameMode, Player, ServerAction } from '../types.js';
import {
  SPECIAL_GAME_MODES,
  PLAYFUL_GAME_MODES,
  DEFAULT_KOMI,
  ALKKAGI_GAUGE_SPEEDS,
  CURLING_GAUGE_SPEEDS,
} from '../constants.js';

interface Props {
  session: LiveGameSession;
  onAction: (action: ServerAction) => void;
  onClose?: () => void;
}

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-tertiary/60 border border-color text-primary flex-shrink-0">
    {children}
  </span>
);

const Svg = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const getModeMeta = (mode: GameMode) => {
  return (
    SPECIAL_GAME_MODES.find(m => m.mode === mode) ??
    PLAYFUL_GAME_MODES.find(m => m.mode === mode)
  );
};

const getWinConditions = (session: LiveGameSession): string[] => {
  const s = session.settings;
  switch (session.mode) {
    case GameMode.Capture:
      return [`상대 돌을 먼저 ${(s.captureTarget ?? 20)}점 따내면 승리합니다.`, '기권/시간패로도 승패가 결정됩니다.'];
    case GameMode.Omok:
      return ['가로/세로/대각선으로 5목을 먼저 만들면 승리합니다.'];
    case GameMode.Ttamok:
      return [
        '5목을 먼저 만들거나, 상대 돌을 먼저 따내면 승리합니다.',
        `따내기 목표: ${(s.captureTarget ?? 5)}점`,
      ];
    case GameMode.Dice:
      return ['주사위를 굴려 흑돌을 놓고, 백돌을 모두 따내면 승리합니다.'];
    case GameMode.Thief:
      return ['라운드별 점수를 합산해 총점이 높은 쪽이 승리합니다.'];
    case GameMode.Alkkagi:
      return ['상대의 돌을 판 밖으로 밀어내며 라운드 승패를 겨룹니다.'];
    case GameMode.Curling:
      return ['하우스(목표)에 더 가깝게 보내 점수를 얻고, 누적 점수가 높은 쪽이 승리합니다.'];
    case GameMode.Base:
      return ['베이스돌 배치 → (공개 후) 덤/색 입찰 → 집(점수)으로 승패를 결정합니다.'];
    case GameMode.Hidden:
      return ['히든돌/스캔 아이템이 포함된 바둑입니다. 집(점수)으로 승패를 결정합니다.'];
    case GameMode.Missile:
      return ['미사일 아이템으로 돌을 이동할 수 있습니다. 집(점수)으로 승패를 결정합니다.'];
    case GameMode.Speed:
      return ['피셔(시간 추가) 방식입니다. 집(점수)으로 승패를 결정합니다.'];
    case GameMode.Mix:
      return ['여러 규칙이 섞인 바둑입니다. 집(점수)으로 승패를 결정합니다.'];
    case GameMode.Standard:
    default:
      return ['집(점수)으로 승패를 결정합니다.'];
  }
};

const formatColor = (color?: Player.Black | Player.White) => {
  if (color === Player.Black) return '흑(선공)';
  if (color === Player.White) return '백(후공)';
  return '랜덤';
};

/** 모드별로 대기실에서 설정한 내용과 동일한 설정 항목을 표시 */
const getSettingsRows = (session: LiveGameSession): { label: string; value: React.ReactNode }[] => {
  const { mode, settings } = session;
  const modesWithKomi = [GameMode.Standard, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Mix];
  const modesWithoutBoardSize = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice];
  const modesWithoutTime = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief];
  const rows: { label: string; value: React.ReactNode }[] = [];

  if (!modesWithoutBoardSize.includes(mode)) {
    rows.push({ label: '판 크기', value: `${settings.boardSize}x${settings.boardSize}` });
  }
  if (modesWithKomi.includes(mode) && !settings.mixedModes?.includes(GameMode.Base)) {
    rows.push({ label: '덤', value: `${session.finalKomi ?? settings.komi ?? DEFAULT_KOMI}집` });
  }
  if (!modesWithoutTime.includes(mode)) {
    if (settings.timeLimit && settings.timeLimit > 0) {
      rows.push({
        label: '시간',
        value: mode === GameMode.Speed
          ? `${settings.timeLimit}분 · ${settings.timeIncrement ?? 0}초 피셔`
          : `${settings.timeLimit}분 · 초읽기 ${settings.byoyomiTime ?? 30}초 × ${settings.byoyomiCount ?? 3}회`,
      });
      // 초읽기 정보를 "N초 / N회" 형식으로 별도 표시 (제한시간 있는 비-스피드 모드)
      if (mode !== GameMode.Speed && !(mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Speed))) {
        const byoyomiTime = settings.byoyomiTime ?? 30;
        const byoyomiCount = settings.byoyomiCount ?? 3;
        if (byoyomiCount > 0) {
          rows.push({ label: '초읽기', value: `${byoyomiTime}초 / ${byoyomiCount}회` });
        }
      }
    } else {
      rows.push({ label: '시간', value: '없음' });
    }
  }
  // 전략 바둑(클래식 등) AI 대전: 계가까지 턴 설정 표시 (대국실에 전달된 설정과 동일하게 표시)
  const strategicModesWithScoringTurn = [GameMode.Standard, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Mix];
  if (strategicModesWithScoringTurn.includes(mode) && settings.scoringTurnLimit != null && settings.scoringTurnLimit > 0) {
    rows.push({ label: '계가까지 턴', value: `${settings.scoringTurnLimit}턴` });
  }
  if ([GameMode.Dice, GameMode.Alkkagi, GameMode.Curling].includes(mode)) {
    rows.push({ label: '내 색', value: formatColor(settings.player1Color) });
  }

  // 모드별 전용 설정
  if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
    rows.push({ label: '쌍삼 금지', value: settings.has33Forbidden ? '금지' : '가능' });
    rows.push({ label: '장목 금지', value: settings.hasOverlineForbidden ? '금지' : '가능' });
  }
  if (mode === GameMode.Ttamok) {
    rows.push({ label: '따내기 목표', value: `${settings.captureTarget}개` });
  }
  if (mode === GameMode.Capture || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Capture))) {
    rows.push({ label: '따내기 목표', value: `${settings.captureTarget}개` });
  }
  if (mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base))) {
    rows.push({ label: '베이스돌', value: `${settings.baseStones}개` });
  }
  if (mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden))) {
    rows.push({ label: '히든돌', value: `${settings.hiddenStoneCount}개` });
    rows.push({ label: '스캔', value: `${settings.scanCount}개` });
  }
  if (mode === GameMode.Missile || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Missile))) {
    rows.push({ label: '미사일', value: `${settings.missileCount}개` });
  }
  if (mode === GameMode.Mix) {
    rows.push({ label: '조합 규칙', value: settings.mixedModes?.join(', ') ?? '-' });
  }
  if (mode === GameMode.Dice) {
    rows.push({ label: '라운드', value: `${settings.diceGoRounds}R` });
    rows.push({ label: '홀수 아이템', value: `${settings.oddDiceCount}개` });
    rows.push({ label: '짝수 아이템', value: `${settings.evenDiceCount}개` });
  }
  if (mode === GameMode.Alkkagi) {
    const speedLabel = ALKKAGI_GAUGE_SPEEDS.find(s => s.value === settings.alkkagiGaugeSpeed)?.label || '보통';
    rows.push({ label: '라운드', value: `${settings.alkkagiRounds}R` });
    rows.push({ label: '돌 개수', value: `${settings.alkkagiStoneCount}개` });
    rows.push({ label: '배치 방식', value: String(settings.alkkagiPlacementType ?? '-') });
    rows.push({ label: '배치 전장', value: String(settings.alkkagiLayout ?? '-') });
    rows.push({ label: '게이지 속도', value: speedLabel });
    rows.push({ label: '슬로우 아이템', value: `${settings.alkkagiSlowItemCount}개` });
    rows.push({ label: '조준선 아이템', value: `${settings.alkkagiAimingLineItemCount}개` });
  }
  if (mode === GameMode.Curling) {
    const speedLabel = CURLING_GAUGE_SPEEDS.find(s => s.value === settings.curlingGaugeSpeed)?.label || '보통';
    rows.push({ label: '스톤 개수', value: `${settings.curlingStoneCount}개` });
    rows.push({ label: '라운드', value: `${settings.curlingRounds}R` });
    rows.push({ label: '게이지 속도', value: speedLabel });
    rows.push({ label: '슬로우 아이템', value: `${settings.curlingSlowItemCount}개` });
    rows.push({ label: '조준선 아이템', value: `${settings.curlingAimingLineItemCount}개` });
  }

  return rows;
};

const AiGameDescriptionModal: React.FC<Props> = ({ session, onAction }) => {
  const meta = useMemo(() => getModeMeta(session.mode), [session.mode]);
  const winConditions = useMemo(() => getWinConditions(session), [session]);
  const settingsRows = useMemo(() => getSettingsRows(session), [session]);

  const handleStart = () => {
    onAction({ type: 'CONFIRM_AI_GAME_START', payload: { gameId: session.id } });
  };

  const handleLeave = () => {
    onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gray-900/95 border border-color rounded-xl shadow-2xl text-on-panel overflow-hidden">
        <div className="p-5 border-b border-color bg-tertiary/20">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-tertiary/60 border border-color flex items-center justify-center overflow-hidden flex-shrink-0">
              {meta?.image ? (
                <img src={meta.image} alt={meta.name ?? session.mode} className="w-full h-full object-contain p-2" />
              ) : (
                <span className="text-sm font-bold">{session.mode}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight truncate">{meta?.name ?? session.mode}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full border border-color bg-secondary/60 text-tertiary flex-shrink-0">
                  AI 대전
                </span>
              </div>
              {meta?.description && <p className="text-tertiary mt-1 text-sm leading-relaxed">{meta.description}</p>}
              <p className="text-xs text-tertiary mt-2">
                시작 전에는 규칙 확인 단계입니다. 준비되면 <span className="text-primary font-semibold">경기 시작</span>을 눌러주세요.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-color bg-tertiary/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon><Svg d="M4 7h16M4 12h16M4 17h16" /></Icon>
              <h3 className="font-bold text-primary">설정</h3>
            </div>

            <div className="overflow-hidden rounded-lg border border-color">
              <table className="w-full text-sm">
                <tbody className="[&>tr:nth-child(odd)]:bg-secondary/30">
                  {settingsRows.map((row) => (
                    <tr key={row.label} className="border-b border-color last:border-b-0">
                      <td className="px-3 py-2 text-tertiary w-32">{row.label}</td>
                      <td className="px-3 py-2 font-semibold">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-color bg-tertiary/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon><Svg d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7l3-7z" /></Icon>
              <h3 className="font-bold text-primary">승리 조건</h3>
            </div>

            <div className="space-y-2">
              {winConditions.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <p className="text-sm text-tertiary leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-color bg-tertiary/10 flex gap-3">
          <Button onClick={handleLeave} colorScheme="gray" className="w-full">
            나가기
          </Button>
          <Button onClick={handleStart} colorScheme="purple" className="w-full">
            경기 시작
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AiGameDescriptionModal;

