import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LiveGameSession, SinglePlayerStageInfo } from '../types.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import { GameMode, SinglePlayerLevel } from '../types/enums.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { formatSinglePlayerRewardCell } from '../utils/singlePlayerRewardDisplay.js';
import { getPreGameSummaryFour } from '../utils/preGameSummaryFour.js';
import {
  PreGameSummaryGrid,
  PRE_GAME_MODAL_LAYER_CLASS,
  PRE_GAME_MODAL_FOOTER_CLASS,
  PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
  PRE_GAME_MODAL_ACCENT_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';

interface SinglePlayerGameDescriptionModalProps {
    session: LiveGameSession;
    onStart: () => void;
    onClose?: () => void;
}

const SINGLE_PLAYER_LEVEL_DISPLAY: Partial<Record<SinglePlayerLevel, string>> = {
    [SinglePlayerLevel.입문]: '입문반',
    [SinglePlayerLevel.초급]: '초급반',
    [SinglePlayerLevel.중급]: '중급반',
    [SinglePlayerLevel.고급]: '고급반',
    [SinglePlayerLevel.유단자]: '유단자',
};

/** 싱글: 스테이지명 앞 단계(입문반 등). 탑은 층만 표시 */
function formatStageDisplayName(stage: SinglePlayerStageInfo, isTower: boolean): string {
    if (isTower) return stage.name;
    const label = SINGLE_PLAYER_LEVEL_DISPLAY[stage.level as SinglePlayerLevel];
    return label ? `${label} · ${stage.name}` : stage.name;
}

const getGameModeName = (mode: GameMode): string => {
    const specialMode = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    if (specialMode) return specialMode.name;
    const playfulMode = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
    if (playfulMode) return playfulMode.name;
    return mode;
};

const DRAG_FRAME_CHROME_PX = 96;
const DRAG_FRAME_H_MIN = 560;
const DRAG_FRAME_H_MAX = 1200;

const SinglePlayerGameDescriptionModal: React.FC<SinglePlayerGameDescriptionModalProps> = ({ session, onStart, onClose }) => {
    const isTower = session.gameCategory === 'tower';
    const stage: SinglePlayerStageInfo | undefined = isTower
        ? TOWER_STAGES.find((s) => s.id === session.stageId)
        : SINGLE_PLAYER_STAGES.find((s) => s.id === session.stageId);

    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);
    /** 좁은 뷰·네이티브: 뷰포트 맞춤 + 본문만 스크롤, 하단 버튼 고정 */
    const isCompactUi = isHandheld || isNativeMobile;

    const summaryFour = useMemo(() => getPreGameSummaryFour(session, stage), [session, stage]);
    const contentMeasureRef = useRef<HTMLDivElement>(null);
    const [frameHeight, setFrameHeight] = useState(780);

    useLayoutEffect(() => {
        if (isCompactUi) return;
        const el = contentMeasureRef.current;
        if (!el) return;
        const update = () => {
            const raw = Math.max(el.offsetHeight, el.scrollHeight);
            if (raw < 8) return;
            const next = Math.min(DRAG_FRAME_H_MAX, Math.max(DRAG_FRAME_H_MIN, Math.ceil(raw + DRAG_FRAME_CHROME_PX)));
            setFrameHeight((prev) => (prev === next ? prev : next));
        };
        update();
        const ro = new ResizeObserver(() => requestAnimationFrame(update));
        ro.observe(el);
        return () => ro.disconnect();
    }, [session, stage, summaryFour, isCompactUi]);

    if (!stage) {
        return null;
    }

    const gameModeName = getGameModeName(session.mode);
    const stageDisplayName = formatStageDisplayName(stage, isTower);
    const modeMeta =
        SPECIAL_GAME_MODES.find((m) => m.mode === session.mode) ?? PLAYFUL_GAME_MODES.find((m) => m.mode === session.mode);

    const spacingY = isCompactUi ? 'space-y-4' : 'space-y-5';
    const mainBlocks = (
        <div className={`${spacingY} pr-0.5`}>
            <div className="flex gap-4 rounded-xl border border-amber-500/28 bg-gradient-to-r from-amber-950/50 via-zinc-900/85 to-zinc-950/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07]">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/35 bg-gradient-to-br from-black/70 via-zinc-950 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-500/20 sm:h-28 sm:w-28">
                    {modeMeta?.image ? (
                        <img src={modeMeta.image} alt="" className="h-full w-full object-contain p-2 drop-shadow-md" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm font-bold text-amber-200/45">{session.mode}</div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-200/75 sm:text-xs">
                        {isTower ? '도전의 탑' : '싱글 스테이지'}
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-white drop-shadow-sm max-[480px]:text-[1.35rem] sm:text-2xl">{stageDisplayName}</h3>
                    <p className="mt-1.5 text-base text-sky-200/88 max-[480px]:text-[1.02rem] sm:text-base">
                        모드: <span className="font-semibold text-sky-100/95">{gameModeName}</span>
                    </p>
                </div>
            </div>
            <PreGameSummaryGrid session={session} summary={summaryFour} singleColumn={isCompactUi} />
            {stage.rewards && (
                <div className="rounded-xl border border-amber-500/22 bg-zinc-950/45 p-3.5 ring-1 ring-inset ring-white/[0.05]">
                    <h3 className="mb-3 flex items-center gap-2 border-b border-amber-500/18 pb-2.5 text-base font-bold text-amber-100/95">
                        <img src="/images/icon/Gold.png" alt="" className="h-6 w-6 object-contain opacity-95 drop-shadow" />
                        클리어 보상
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-amber-500/15 bg-black/30">
                        <table className="w-full text-left text-sm sm:text-sm max-[480px]:text-[0.95rem]">
                            <thead>
                                <tr className="border-b border-amber-500/15 bg-zinc-900/70 text-amber-200/95">
                                    <th className="border-r border-amber-500/12 px-3 py-2 font-semibold">구분</th>
                                    <th className="px-3 py-2 font-semibold">내용</th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-200">
                                <tr className="border-b border-amber-500/10 bg-zinc-900/35">
                                    <td className="whitespace-nowrap border-r border-amber-500/10 px-3 py-2.5 align-top font-medium text-emerald-300/95">
                                        최초 클리어
                                    </td>
                                    <td className="px-3 py-2.5 align-top leading-snug">
                                        {formatSinglePlayerRewardCell(stage.rewards.firstClear)}
                                    </td>
                                </tr>
                                <tr className="bg-zinc-900/25">
                                    <td className="whitespace-nowrap border-r border-amber-500/10 px-3 py-2.5 align-top font-medium text-sky-300/95">
                                        재도전 클리어
                                    </td>
                                    <td className="px-3 py-2.5 align-top leading-snug">
                                        {isTower ? '보상 없음' : formatSinglePlayerRewardCell(stage.rewards.repeatClear)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    const footerButtons = (compact: boolean) => (
        <>
            {onClose && (
                <Button
                    onClick={onClose}
                    colorScheme="gray"
                    className={
                        compact
                            ? `!flex-1 basis-0 min-w-0 min-h-[3rem] px-5 py-2.5 text-base max-[480px]:px-4 ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS}`
                            : `!w-auto shrink-0 px-8 py-3 text-base ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS}`
                    }
                >
                    취소
                </Button>
            )}
            <Button
                onClick={onStart}
                colorScheme="accent"
                className={
                    compact
                        ? onClose
                            ? `!flex-1 basis-0 min-w-0 min-h-[3rem] px-5 py-2.5 text-base max-[480px]:px-4 ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                            : `mx-auto !w-full max-w-[min(20rem,92vw)] min-h-[3rem] px-8 py-2.5 text-base ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                        : `!w-auto shrink-0 px-8 py-3 text-base ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                }
            >
                시작하기
            </Button>
        </>
    );

    return (
        <DraggableWindow
            title={`${stageDisplayName} - 게임 설명`}
            windowId="game-description-modal"
            onClose={onClose}
            initialWidth={920}
            initialHeight={isCompactUi ? 2400 : frameHeight}
            modal={true}
            closeOnOutsideClick={!!onClose}
            uniformPcScale={!isCompactUi}
            mobileViewportFit={isCompactUi}
            bodyNoScroll={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4'
                    : undefined
            }
            hideFooter
            skipSavedPosition={isCompactUi}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            <div
                className={`flex min-h-0 flex-col text-white ${isCompactUi ? 'h-full min-h-0' : ''}`}
            >
                {isCompactUi ? (
                    <div
                        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 ${PRE_GAME_MODAL_LAYER_CLASS}`}
                    >
                        {mainBlocks}
                    </div>
                ) : (
                    <div ref={contentMeasureRef} className={`flex min-h-0 flex-col ${PRE_GAME_MODAL_LAYER_CLASS}`}>
                        {mainBlocks}
                        <div className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap -mx-5 -mb-5 mt-6 shrink-0 rounded-b-2xl`}>
                            {footerButtons(false)}
                        </div>
                    </div>
                )}

                {isCompactUi ? (
                    <div
                        className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap shrink-0 mt-4 rounded-b-2xl border-t border-amber-500/35 px-2 py-3 sm:px-3`}
                    >
                        {footerButtons(true)}
                    </div>
                ) : null}
            </div>
        </DraggableWindow>
    );
};

export default SinglePlayerGameDescriptionModal;
