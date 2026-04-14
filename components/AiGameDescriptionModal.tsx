import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.js';
import { useViewportUniformScale } from '../hooks/useViewportUniformScale.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { LiveGameSession, GameMode, Player, ServerAction, User } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DEFAULT_KOMI, ALKKAGI_GAUGE_SPEEDS, CURLING_GAUGE_SPEEDS } from '../constants.js';
import { getPreGameSummaryFour } from '../utils/preGameSummaryFour.js';
import { buildAiPregameRewardVisual } from '../utils/estimateAiPregameRewardSummary.js';
import { AiPregameRewardVisualStrip } from './game/AiPregameRewardVisualStrip.js';
import {
  PreGameSummaryGrid,
  PRE_GAME_MODAL_SHELL_CLASS,
  PRE_GAME_MODAL_LAYER_CLASS,
  PRE_GAME_MODAL_FOOTER_CLASS,
  PRE_GAME_MODAL_PRIMARY_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH, NATIVE_MOBILE_MODAL_MAX_WIDTH_VW } from '../constants/ads.js';

interface Props {
  session: LiveGameSession;
  onAction: (action: ServerAction) => void;
  /** 인게임 「경기방법」: 확인만 표시 */
  readOnly?: boolean;
  onClose?: () => void;
  /** 보상 추정(레벨 차이·난이도 배율)에 사용. 없으면 기본 배율만 반영 */
  currentUser?: User;
}

const getModeMeta = (mode: GameMode) =>
  SPECIAL_GAME_MODES.find((m) => m.mode === mode) ?? PLAYFUL_GAME_MODES.find((m) => m.mode === mode);

const formatColor = (color?: Player.Black | Player.White) => {
  if (color === Player.Black) return '흑(선공)';
  if (color === Player.White) return '백(후공)';
  return '랜덤';
};

/** 인게임 AI 대국 시작 모달: 요약·보상 블록 기준 설계 너비(PC에서 균일 scale의 기준) */
const AI_GAME_DESC_DESIGN_W = 720;
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

const AiGameDescriptionModal: React.FC<Props> = ({ session, onAction, readOnly = false, onClose, currentUser }) => {
  const { modalLayerUsesDesignPixels } = useAppContext();
  const isHandheld = useIsHandheldDevice(1025);
  const { isNativeMobile } = useNativeMobileShell();
  /** 스케일 캔버스 밖에서도 보이도록: 터치 기기·네이티브는 풀폭 시트 + 본문 스크롤 */
  const isMobileSheet = isHandheld || isNativeMobile;
  const meta = useMemo(() => getModeMeta(session.mode), [session.mode]);
  const summaryFour = useMemo(() => getPreGameSummaryFour(session), [session]);
  const rewardVisual = useMemo(() => buildAiPregameRewardVisual(session, currentUser), [session, currentUser]);
  const isAdventure = String(session.gameCategory ?? '') === 'adventure';
  /** AI 대기실 입장 모달·인게임 경기방법: 설정 표는 생략(요약 그리드만) */
  const showMatchSettingsTable = !session.isAiGame;
  const settingsRows = useMemo(
    () => (showMatchSettingsTable ? getSettingsRows(session) : []),
    [session, showMatchSettingsTable],
  );
  const isGuildWarAi = String(session.gameCategory ?? '') === 'guildwar';
  const sessionBadgeLabel = isGuildWarAi
    ? '길드 전쟁'
    : isAdventure
      ? '모험'
      : session.isAiGame
        ? 'AI 대전'
        : '온라인 대국';
  const shellRef = useRef<HTMLDivElement>(null);
  const [designH, setDesignH] = useState(AI_GAME_DESC_DESIGN_H_FALLBACK);
  /** PC만 균일 scale — 모바일은 width 100% + 내부 스크롤로 잘림·미시청 방지 */
  const uniformScale = useViewportUniformScale(AI_GAME_DESC_DESIGN_W, designH, !isMobileSheet);

  useLayoutEffect(() => {
    if (isMobileSheet) return;
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
  }, [session, summaryFour, settingsRows, rewardVisual, isMobileSheet]);

  const handleStart = () => {
    onAction({ type: 'CONFIRM_AI_GAME_START', payload: { gameId: session.id } });
  };

  const portalTarget =
    typeof document !== 'undefined'
      ? isMobileSheet
        ? document.body
        : document.getElementById('sudamr-modal-root') ?? document.body
      : null;
  if (!portalTarget) return null;

  const overlayPositionClass = isMobileSheet
    ? 'fixed inset-0 z-[60000]'
    : modalLayerUsesDesignPixels
      ? 'absolute inset-0 z-[1]'
      : 'fixed inset-0 z-[60000]';

  const headerBlock = (
    <div
      className={`${PRE_GAME_MODAL_LAYER_CLASS} flex-shrink-0 border-b border-amber-500/25 bg-gradient-to-r from-amber-950/45 via-zinc-900/88 to-zinc-950/95 p-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] sm:p-4`}
    >
      <div
        className={
          isMobileSheet
            ? 'flex flex-row items-start gap-3 sm:gap-5'
            : 'flex gap-5'
        }
      >
        <div
          className={
            isMobileSheet
              ? 'relative h-[4.5rem] w-[4.5rem] flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/35 bg-gradient-to-br from-black/70 via-zinc-950 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_36px_-12px_rgba(0,0,0,0.65)] ring-1 ring-amber-500/20 sm:h-[8.75rem] sm:w-[8.75rem] md:h-[9.25rem] md:w-[9.25rem]'
              : 'relative h-[8.75rem] w-[8.75rem] flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/35 bg-gradient-to-br from-black/70 via-zinc-950 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_36px_-12px_rgba(0,0,0,0.65)] ring-1 ring-amber-500/20 sm:h-[9.25rem] sm:w-[9.25rem]'
          }
        >
          {meta?.image ? (
            <img src={meta.image} alt="" className="h-full w-full object-contain p-1.5 drop-shadow-md sm:p-2" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-bold text-amber-200/50 sm:text-xl">{session.mode}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h2
              className={
                isMobileSheet
                  ? 'text-xl font-black tracking-tight text-white drop-shadow-sm sm:text-3xl md:text-4xl'
                  : 'text-3xl font-black tracking-tight text-white drop-shadow-sm sm:text-4xl'
              }
            >
              {meta?.name ?? session.mode}
            </h2>
            <span className="rounded-full border border-amber-400/45 bg-gradient-to-r from-amber-950/80 to-zinc-900/90 px-2.5 py-1 text-xs font-bold tracking-wide text-amber-100/95 shadow-sm ring-1 ring-amber-500/25 sm:px-3.5 sm:py-1.5 sm:text-sm">
              {sessionBadgeLabel}
            </span>
          </div>
          {readOnly ? (
            <p className="mt-2 text-xs leading-relaxed text-zinc-300 sm:mt-2.5 sm:text-sm md:text-base lg:text-lg">
              시작 전에 안내된 규칙·설정과 동일합니다. 확인 후 창을 닫아 주세요.
            </p>
          ) : null}
          {isAdventure && rewardVisual ? (
            <AiPregameRewardVisualStrip visual={rewardVisual} isMobileSheet={isMobileSheet} placement="titlePanel" />
          ) : null}
        </div>
      </div>
    </div>
  );

  const settingsTableBlock = (
    <div className="mb-3 mt-5 rounded-xl border border-amber-500/22 bg-zinc-950/50 p-3 shadow-inner ring-1 ring-inset ring-white/[0.05] sm:mb-4 sm:mt-7 sm:p-4 md:p-5">
      <h3 className="mb-2.5 flex items-center gap-2 border-b border-amber-500/18 pb-2 text-base font-bold text-amber-100/95 sm:mb-3.5 sm:gap-2.5 sm:pb-3 sm:text-lg md:text-xl">
        {meta?.image ? (
          <img src={meta.image} alt="" className="h-7 w-7 object-contain opacity-95 drop-shadow sm:h-8 sm:w-8 md:h-9 md:w-9" />
        ) : null}
        이번 대국 설정
      </h3>
      <div className="overflow-hidden rounded-lg border border-amber-500/15 bg-black/30">
        {isMobileSheet ? (
          <div className="divide-y divide-amber-500/10">
            {settingsRows.map((row) => (
              <div
                key={row.label}
                className="space-y-1 px-3 py-2.5 odd:bg-zinc-900/55 even:bg-zinc-900/40"
              >
                <div className="text-xs font-bold text-amber-200/85">{row.label}</div>
                <div className="text-sm font-semibold leading-snug text-zinc-100">{row.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm sm:text-base md:text-lg lg:text-[1.12rem]">
            <tbody className="[&>tr:nth-child(odd)]:bg-zinc-900/55">
              {settingsRows.map((row) => (
                <tr key={row.label} className="border-b border-amber-500/10 last:border-b-0">
                  <td className="w-[34%] px-3.5 py-3 text-amber-200/70 sm:px-4 sm:py-3.5">{row.label}</td>
                  <td className="px-3.5 py-3 font-semibold text-zinc-100 sm:px-4 sm:py-3.5">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const footerBlock = readOnly ? (
    <div className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap justify-center gap-3 px-4 py-4 sm:gap-4`}>
      <Button
        onClick={() => onClose?.()}
        colorScheme="purple"
        className={`min-w-0 px-8 py-3 text-base sm:px-10 ${PRE_GAME_MODAL_PRIMARY_BTN_CLASS} !w-auto shrink-0 !min-w-[10rem]`}
      >
        확인
      </Button>
    </div>
  ) : (
    <div
      className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap justify-center gap-3 px-4 py-4 sm:gap-4`}
    >
      <Button
        onClick={handleStart}
        colorScheme="purple"
        className={`min-w-0 px-6 py-3 text-base sm:px-8 ${PRE_GAME_MODAL_PRIMARY_BTN_CLASS} !w-auto shrink-0 !min-w-[11rem] sm:!min-w-[12rem]`}
      >
        경기 시작
      </Button>
    </div>
  );

  const mainBody = (
    <div className={`${PRE_GAME_MODAL_LAYER_CLASS} px-3 pb-2 pt-3 sm:px-5 sm:pt-5 md:px-6`}>
      <PreGameSummaryGrid
        session={session}
        summary={summaryFour}
        singleColumn={isMobileSheet}
        briefLayout={isAdventure}
      />
      {rewardVisual && !isAdventure ? <AiPregameRewardVisualStrip visual={rewardVisual} isMobileSheet={isMobileSheet} /> : null}
      {showMatchSettingsTable ? settingsTableBlock : null}
    </div>
  );

  const mobileShellMaxW = `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`;
  const mobileShellMaxH = `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, 80svh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px))`;

  const layer = (
    <div
      className={`${overlayPositionClass} flex text-base antialiased pointer-events-auto ${
        isMobileSheet
          ? 'items-center justify-center bg-transparent px-3 py-4 sm:px-4 sm:py-6'
          : 'items-center justify-center bg-transparent p-4'
      }`}
      style={
        isMobileSheet
          ? {
              paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
              paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
            }
          : undefined
      }
    >
      <div
        ref={shellRef}
        className={`${PRE_GAME_MODAL_SHELL_CLASS} mx-auto flex flex-col ${isMobileSheet ? 'min-h-0 w-full overflow-hidden' : ''}`}
        style={
          isMobileSheet
            ? {
                width: mobileShellMaxW,
                maxWidth: mobileShellMaxW,
                maxHeight: mobileShellMaxH,
              }
            : {
                width: AI_GAME_DESC_DESIGN_W,
                maxWidth: '100%',
                transform: `scale(${uniformScale})`,
                transformOrigin: 'center center',
              }
        }
      >
        {headerBlock}
        {isMobileSheet ? (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]">
            {mainBody}
          </div>
        ) : (
          mainBody
        )}
        {footerBlock}
      </div>
    </div>
  );

  return createPortal(layer, portalTarget);
};

export default AiGameDescriptionModal;
