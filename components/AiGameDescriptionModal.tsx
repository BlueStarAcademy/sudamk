import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.js';
import { useViewportUniformScale } from '../hooks/useViewportUniformScale.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { LiveGameSession, GameMode, Player, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DEFAULT_KOMI, ALKKAGI_GAUGE_SPEEDS, CURLING_GAUGE_SPEEDS } from '../constants.js';
import { getPreGameSummaryFour } from '../utils/preGameSummaryFour.js';
import {
  PreGameSummaryGrid,
  PRE_GAME_MODAL_SHELL_CLASS,
  PRE_GAME_MODAL_LAYER_CLASS,
  PRE_GAME_MODAL_FOOTER_CLASS,
  PRE_GAME_MODAL_PRIMARY_BTN_CLASS,
  PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';

interface Props {
  session: LiveGameSession;
  onAction: (action: ServerAction) => void;
  onClose?: () => void;
}

const getModeMeta = (mode: GameMode) =>
  SPECIAL_GAME_MODES.find((m) => m.mode === mode) ?? PLAYFUL_GAME_MODES.find((m) => m.mode === mode);

const formatColor = (color?: Player.Black | Player.White) => {
  if (color === Player.Black) return '흑(선공)';
  if (color === Player.White) return '백(후공)';
  return '랜덤';
};

const AI_GAME_DESC_DESIGN_W = 920;
const AI_GAME_DESC_DESIGN_H_FALLBACK = 820;
const AI_GAME_DESC_DESIGN_H_MIN = 520;
const AI_GAME_DESC_DESIGN_H_MAX = 1200;

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
        value:
          mode === GameMode.Speed
            ? `${settings.timeLimit}분 · ${settings.timeIncrement ?? 0}초 피셔`
            : `${settings.timeLimit}분 · 초읽기 ${settings.byoyomiTime ?? 30}초 × ${settings.byoyomiCount ?? 3}회`,
      });
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
  const strategicModesWithScoringTurn = [GameMode.Standard, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Mix];
  if (strategicModesWithScoringTurn.includes(mode) && settings.scoringTurnLimit != null && settings.scoringTurnLimit > 0) {
    rows.push({ label: '계가까지 턴', value: `${settings.scoringTurnLimit}턴` });
  }
  if ([GameMode.Dice, GameMode.Alkkagi, GameMode.Curling].includes(mode)) {
    rows.push({ label: '내 색', value: formatColor(settings.player1Color) });
  }

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
    rows.push({ label: '홀수 아이템', value: `${settings.oddDiceCount ?? 0}개` });
    rows.push({ label: '짝수 아이템', value: `${settings.evenDiceCount ?? 0}개` });
    rows.push({ label: '낮은 수 아이템 (1~3)', value: `${settings.lowDiceCount ?? 0}개` });
    rows.push({ label: '높은 수 아이템 (4~6)', value: `${settings.highDiceCount ?? 0}개` });
  }
  if (mode === GameMode.Alkkagi) {
    const speedLabel = ALKKAGI_GAUGE_SPEEDS.find((x) => x.value === settings.alkkagiGaugeSpeed)?.label || '보통';
    rows.push({ label: '라운드', value: `${settings.alkkagiRounds}R` });
    rows.push({ label: '돌 개수', value: `${settings.alkkagiStoneCount}개` });
    rows.push({ label: '배치 방식', value: String(settings.alkkagiPlacementType ?? '-') });
    rows.push({ label: '배치 전장', value: String(settings.alkkagiLayout ?? '-') });
    rows.push({ label: '게이지 속도', value: speedLabel });
    rows.push({ label: '슬로우 아이템', value: `${settings.alkkagiSlowItemCount}개` });
    rows.push({ label: '조준선 아이템', value: `${settings.alkkagiAimingLineItemCount}개` });
  }
  if (mode === GameMode.Curling) {
    const speedLabel = CURLING_GAUGE_SPEEDS.find((x) => x.value === settings.curlingGaugeSpeed)?.label || '보통';
    rows.push({ label: '스톤 개수', value: `${settings.curlingStoneCount}개` });
    rows.push({ label: '라운드', value: `${settings.curlingRounds}R` });
    rows.push({ label: '게이지 속도', value: speedLabel });
    rows.push({ label: '슬로우 아이템', value: `${settings.curlingSlowItemCount}개` });
    rows.push({ label: '조준선 아이템', value: `${settings.curlingAimingLineItemCount}개` });
  }

  return rows;
};

const AiGameDescriptionModal: React.FC<Props> = ({ session, onAction }) => {
  const { modalLayerUsesDesignPixels } = useAppContext();
  const meta = useMemo(() => getModeMeta(session.mode), [session.mode]);
  const summaryFour = useMemo(() => getPreGameSummaryFour(session), [session]);
  const settingsRows = useMemo(() => getSettingsRows(session), [session]);
  const isGuildWarAi = String(session.gameCategory ?? '') === 'guildwar';
  const shellRef = useRef<HTMLDivElement>(null);
  const [designH, setDesignH] = useState(AI_GAME_DESC_DESIGN_H_FALLBACK);
  /** 모바일·네이티브 포함: PC 레이아웃 유지 + visual viewport에 맞게 균일 scale(스크롤 없이 시작 버튼까지) */
  const uniformScale = useViewportUniformScale(AI_GAME_DESC_DESIGN_W, designH, true);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = () => {
      const raw = Math.max(el.offsetHeight, el.scrollHeight);
      if (raw < 8) return;
      const next = Math.min(AI_GAME_DESC_DESIGN_H_MAX, Math.max(AI_GAME_DESC_DESIGN_H_MIN, Math.ceil(raw)));
      setDesignH((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(() => requestAnimationFrame(update));
    ro.observe(el);
    return () => ro.disconnect();
  }, [session, summaryFour, settingsRows]);

  const handleStart = () => {
    onAction({ type: 'CONFIRM_AI_GAME_START', payload: { gameId: session.id } });
  };

  const handleLeave = () => {
    onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
  };

  const portalTarget =
    typeof document !== 'undefined'
      ? document.getElementById('sudamr-modal-root') ?? document.body
      : null;
  if (!portalTarget) return null;

  const layer = (
    <div
      className={`${
        modalLayerUsesDesignPixels ? 'absolute inset-0 z-[1]' : 'fixed inset-0 z-[60000]'
      } flex items-center justify-center bg-transparent p-4 text-base antialiased pointer-events-auto`}
    >
      <div
        ref={shellRef}
        className={PRE_GAME_MODAL_SHELL_CLASS}
        style={{
          width: AI_GAME_DESC_DESIGN_W,
          maxWidth: '100%',
          transform: `scale(${uniformScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* 헤더: 모드 이미지 + 제목 */}
        <div
          className={`${PRE_GAME_MODAL_LAYER_CLASS} flex-shrink-0 border-b border-amber-500/25 bg-gradient-to-r from-amber-950/45 via-zinc-900/88 to-zinc-950/95 p-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]`}
        >
          <div className="flex gap-4">
            <div className="relative h-[7.5rem] w-[7.5rem] flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/35 bg-gradient-to-br from-black/70 via-zinc-950 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_36px_-12px_rgba(0,0,0,0.65)] ring-1 ring-amber-500/20">
              {meta?.image ? (
                <img src={meta.image} alt="" className="h-full w-full object-contain p-2 drop-shadow-md" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg font-bold text-amber-200/50">{session.mode}</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-sm sm:text-3xl">{meta?.name ?? session.mode}</h2>
                <span className="rounded-full border border-amber-400/45 bg-gradient-to-r from-amber-950/80 to-zinc-900/90 px-3 py-1 text-xs font-bold tracking-wide text-amber-100/95 shadow-sm ring-1 ring-amber-500/25">
                  {isGuildWarAi ? '길드 전쟁' : 'AI 대전'}
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-300 sm:text-sm lg:text-base">
                네 가지 요약을 확인한 뒤{' '}
                <span className="font-semibold text-violet-300">경기 시작</span>을 눌러주세요.
              </p>
            </div>
          </div>
        </div>

        <div className={`${PRE_GAME_MODAL_LAYER_CLASS} flex-shrink-0 px-4 pb-2 pt-4`}>
          <PreGameSummaryGrid session={session} summary={summaryFour} />

          <div className="mb-4 mt-6 rounded-xl border border-amber-500/22 bg-zinc-950/50 p-3.5 shadow-inner ring-1 ring-inset ring-white/[0.05]">
            <h3 className="mb-3 flex items-center gap-2 border-b border-amber-500/18 pb-2.5 text-base font-bold text-amber-100/95 lg:text-lg">
              {meta?.image ? (
                <img src={meta.image} alt="" className="h-7 w-7 object-contain opacity-95 drop-shadow" />
              ) : null}
              이번 대국 설정
            </h3>
            <div className="overflow-hidden rounded-lg border border-amber-500/15 bg-black/30">
              <table className="w-full text-sm sm:text-base lg:text-[1.05rem]">
                <tbody className="[&>tr:nth-child(odd)]:bg-zinc-900/55">
                  {settingsRows.map((row) => (
                    <tr key={row.label} className="border-b border-amber-500/10 last:border-b-0">
                      <td className="w-[40%] px-3 py-2.5 text-amber-200/70">{row.label}</td>
                      <td className="px-3 py-2.5 font-semibold text-zinc-100">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={PRE_GAME_MODAL_FOOTER_CLASS}>
          {!isGuildWarAi && (
            <Button
              onClick={handleLeave}
              colorScheme="gray"
              className={`!w-auto shrink-0 px-8 py-3 text-base font-bold tracking-wide ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS}`}
            >
              대기실로
            </Button>
          )}
          <Button
            onClick={handleStart}
            colorScheme="purple"
            className={`!w-auto shrink-0 px-8 py-3 text-base font-bold tracking-wide ${PRE_GAME_MODAL_PRIMARY_BTN_CLASS}`}
          >
            경기 시작
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(layer, portalTarget);
};

export default AiGameDescriptionModal;
