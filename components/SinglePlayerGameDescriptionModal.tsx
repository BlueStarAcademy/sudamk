import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LiveGameSession, SinglePlayerStageInfo, UserWithStatus } from '../types.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, EQUIPMENT_POOL } from '../constants/index.js';
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
    onStart?: () => void;
    onClose?: () => void;
    /** 인게임 경기방법: 시작하기 대신 확인 버튼만 표시 */
    readOnly?: boolean;
    currentUser?: UserWithStatus;
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

/** DraggableWindow 헤더 + 본문 p-5 등(과소 추정 시 하단 버튼이 잘림) */
const DRAG_WINDOW_CHROME_PX = 140;
/** 모달 내부 하단 시작/취소 바 */
const IN_MODAL_FOOTER_RESERVE_PX = 104;
const DRAG_FRAME_H_MIN = 560;
const DRAG_FRAME_H_MAX = 1200;

const SinglePlayerGameDescriptionModal: React.FC<SinglePlayerGameDescriptionModalProps> = ({ session, onStart, onClose, readOnly = false, currentUser }) => {
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
            const next = Math.min(
                DRAG_FRAME_H_MAX,
                Math.max(DRAG_FRAME_H_MIN, Math.ceil(raw + DRAG_WINDOW_CHROME_PX + IN_MODAL_FOOTER_RESERVE_PX)),
            );
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

    const stageIndex = useMemo(
        () => (isTower ? -1 : SINGLE_PLAYER_STAGES.findIndex((s) => s.id === stage.id)),
        [isTower, stage.id]
    );
    const isFirstClearReward = useMemo(() => {
        if (isTower || !currentUser || stageIndex < 0) return true;
        const clearedStages = (currentUser as { clearedSinglePlayerStages?: string[] }).clearedSinglePlayerStages || [];
        const singlePlayerProgress = (currentUser as { singlePlayerProgress?: number }).singlePlayerProgress ?? 0;
        return !(clearedStages.includes(stage.id) || singlePlayerProgress > stageIndex);
    }, [currentUser, isTower, stage.id, stageIndex]);

    const selectedClearReward = stage.rewards
        ? (isFirstClearReward ? stage.rewards.firstClear : stage.rewards.repeatClear)
        : undefined;

    const resolveItemImage = (itemId: string): string | null => {
        const c = CONSUMABLE_ITEMS.find((it) => it.name === itemId);
        if (c?.image) return c.image;
        if (MATERIAL_ITEMS[itemId]?.image) return MATERIAL_ITEMS[itemId].image;
        const eq = EQUIPMENT_POOL.find((it) => it.name === itemId);
        return eq?.image ?? null;
    };

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
                    <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-xl font-black tracking-tight text-white drop-shadow-sm max-[480px]:text-[1.35rem] sm:text-2xl">
                            {stageDisplayName}
                        </h3>
                        <div className="max-w-full rounded-lg border border-amber-500/35 bg-black/40 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                            <p className="text-right text-[10px] font-semibold tracking-wide text-amber-200/90 sm:text-[11px]">
                                이번 클리어 보상 ({isFirstClearReward ? '첫 클리어' : '재도전'})
                            </p>
                            {selectedClearReward ? (
                                <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
                                    {(selectedClearReward.gold ?? 0) > 0 && (
                                        <div className="inline-flex h-9 min-w-[4.25rem] items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-amber-950/25 px-2 text-[11px] font-semibold text-amber-100">
                                            <img src="/images/icon/Gold.png" alt="" className="h-4 w-4 object-contain" />
                                            {(selectedClearReward.gold ?? 0).toLocaleString()}
                                        </div>
                                    )}
                                    {(selectedClearReward.exp ?? 0) > 0 && (
                                        <div className="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-950/25 px-2 text-[10px] font-black tracking-[0.03em] text-emerald-200">
                                            전략EXP +{selectedClearReward.exp}
                                        </div>
                                    )}
                                    {selectedClearReward.items?.map((rewardItem, idx) => {
                                        const image = resolveItemImage(rewardItem.itemId);
                                        return (
                                            <div
                                                key={`${rewardItem.itemId}-${idx}`}
                                                className="inline-flex h-9 min-w-[4.25rem] items-center justify-center gap-1 rounded-md border border-violet-500/30 bg-violet-950/20 px-2 text-[10px] font-semibold text-violet-100"
                                                title={rewardItem.itemId}
                                            >
                                                {image ? <img src={image} alt="" className="h-4 w-4 object-contain" /> : <span>🎁</span>}
                                                x{rewardItem.quantity}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="mt-1 text-right text-[11px] leading-snug text-amber-100/80 sm:text-xs">보상 정보 없음</p>
                            )}
                        </div>
                    </div>
                    <p className="mt-1.5 text-base text-sky-200/88 max-[480px]:text-[1.02rem] sm:text-base">
                        모드: <span className="font-semibold text-sky-100/95">{gameModeName}</span>
                    </p>
                </div>
            </div>
            <PreGameSummaryGrid session={session} summary={summaryFour} singleColumn={isCompactUi} />
        </div>
    );

    const footerButtons = (compact: boolean) => (
        <>
            {readOnly ? (
                <Button
                    onClick={onClose}
                    colorScheme="accent"
                    className={
                        compact
                            ? `mx-auto !w-full max-w-[min(20rem,92vw)] min-h-[3rem] px-8 py-2.5 text-base ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                            : `!w-auto shrink-0 px-8 py-3 text-base ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                    }
                >
                    확인
                </Button>
            ) : (
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
                onClick={() => onStart?.()}
                colorScheme="accent"
                disabled={!onStart}
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
            )}
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
            headerShowTitle={false}
            uniformPcScale={!isCompactUi}
            mobileViewportFit={isCompactUi}
            bodyNoScroll={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4'
                    : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5'
            }
            hideFooter
            skipSavedPosition={isCompactUi}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            <div className={`flex min-h-0 flex-col text-white ${isCompactUi ? 'h-full min-h-0' : 'min-h-0 flex-1'}`}>
                {isCompactUi ? (
                    <div
                        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [zoom:0.5] ${PRE_GAME_MODAL_LAYER_CLASS}`}
                    >
                        {mainBlocks}
                    </div>
                ) : (
                    <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${PRE_GAME_MODAL_LAYER_CLASS}`}>
                        <div
                            ref={contentMeasureRef}
                            className="min-h-0 flex-1 overflow-visible overflow-x-hidden pr-0.5"
                        >
                            {mainBlocks}
                        </div>
                        <div
                            className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap mt-4 shrink-0 rounded-b-xl`}
                        >
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
