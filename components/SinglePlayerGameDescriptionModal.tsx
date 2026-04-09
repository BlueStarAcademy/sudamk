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

/** DraggableWindow 헤더 + 본문(좌우·상단) 패딩 — 하단 pb는 본문 클래스에서 별도 최소화 */
const DRAG_WINDOW_CHROME_PX = 118;
/** 측정 ref에 버튼 바 포함 시, DraggableWindow 하단 ‘창 위치 기억하기’ 줄 */
const IN_MODAL_FOOTER_RESERVE_PX = 50;
/** 내용에 맞춤 */
const DRAG_FRAME_H_MIN = 320;
const DRAG_FRAME_H_MAX = 1200;

const SinglePlayerGameDescriptionModal: React.FC<SinglePlayerGameDescriptionModalProps> = ({
    session,
    onStart,
    onClose,
    readOnly = false,
    currentUser: _currentUser,
}) => {
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

    /** 싱글/탑: 최초 클리어 보상만 노출 (재도전 별도 보상 문구 없음) */
    const clearReward = stage.rewards?.firstClear;

    const resolveItemImage = (itemId: string): string | null => {
        const c = CONSUMABLE_ITEMS.find((it) => it.name === itemId);
        if (c?.image) return c.image;
        if (MATERIAL_ITEMS[itemId]?.image) return MATERIAL_ITEMS[itemId].image;
        const eq = EQUIPMENT_POOL.find((it) => it.name === itemId);
        return eq?.image ?? null;
    };

    const spacingY = isCompactUi ? 'space-y-3' : 'space-y-3.5';
    const mainBlocks = (
        <div className={`${spacingY} pr-0.5`}>
            <div className="rounded-xl border border-amber-500/28 bg-gradient-to-r from-amber-950/50 via-zinc-900/85 to-zinc-950/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] sm:p-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
                    <div className="flex min-w-0 flex-1 gap-3 sm:items-center">
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/35 bg-gradient-to-br from-black/70 via-zinc-950 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-500/20 sm:h-[5.25rem] sm:w-[5.25rem]">
                            {modeMeta?.image ? (
                                <img src={modeMeta.image} alt="" className="h-full w-full object-contain p-1.5 drop-shadow-md sm:p-2" />
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs font-bold text-amber-200/45">{session.mode}</div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-amber-200/78 sm:text-[0.65rem]">
                                {isTower ? '도전의 탑' : '싱글 스테이지'}
                            </p>
                            <h3 className="mt-0.5 text-lg font-black leading-tight tracking-tight text-white drop-shadow-sm max-[480px]:text-[1.2rem] sm:text-xl">
                                {stageDisplayName}
                            </h3>
                            <p className="mt-1 text-sm text-sky-200/88 sm:text-[0.95rem]">
                                모드{' '}
                                <span className="whitespace-nowrap font-semibold text-sky-100/95">{gameModeName}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center border-t border-amber-500/25 pt-3 text-center sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 md:min-w-[12rem]">
                        <p className="w-full text-center text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-200/88 sm:text-xs">
                            클리어 보상
                        </p>
                        {clearReward ? (
                            <div className="mt-2 flex w-full max-w-[16rem] flex-col items-center gap-1.5">
                                {(clearReward.gold ?? 0) > 0 && (
                                    <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/35 bg-black/45 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                        <img
                                            src="/images/icon/Gold.png"
                                            alt=""
                                            className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4"
                                            aria-hidden
                                        />
                                        <span className="text-[0.8125rem] font-semibold tabular-nums leading-snug text-amber-100 sm:text-sm">
                                            {(clearReward.gold ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {(clearReward.exp ?? 0) > 0 && (
                                    <div className="flex w-full items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-950/30 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                        <span className="text-[0.8125rem] font-semibold leading-snug text-emerald-100 sm:text-sm">
                                            전략 EXP +{(clearReward.exp ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {clearReward.items && clearReward.items.length > 0 && (
                                    <div className="flex w-full flex-wrap justify-center gap-1.5">
                                        {clearReward.items.map((rewardItem, idx) => {
                                            const image = resolveItemImage(rewardItem.itemId);
                                            return (
                                                <div
                                                    key={`${rewardItem.itemId}-${idx}`}
                                                    className="inline-flex h-7 min-w-[3.25rem] items-center justify-center gap-1 rounded-lg border border-violet-500/30 bg-violet-950/25 px-2 text-[10px] font-semibold text-violet-100"
                                                    title={rewardItem.itemId}
                                                >
                                                    {image ? <img src={image} alt="" className="h-3 w-3 object-contain" /> : <span>🎁</span>}
                                                    ×{rewardItem.quantity}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="mt-1.5 text-center text-xs text-amber-100/75">보상 정보 없음</p>
                        )}
                    </div>
                </div>
            </div>
            <PreGameSummaryGrid session={session} summary={summaryFour} singleColumn={isCompactUi} />
        </div>
    );

    /** 데스크톱: 공통 버튼 박스 높이만 살짝 낮춤(모달 전용, AI 설명 모달 등은 유지) */
    const desktopBtnTight = '!min-h-[2.65rem] !py-2 !px-6 sm:!px-7';

    const footerButtons = (compact: boolean) => (
        <>
            {readOnly ? (
                <Button
                    onClick={onClose}
                    colorScheme="accent"
                    className={
                        compact
                            ? `mx-auto !w-full max-w-[min(20rem,92vw)] min-h-[3rem] px-8 py-2.5 text-base ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                            : `!w-auto shrink-0 text-base ${desktopBtnTight} ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
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
                            : `!w-auto shrink-0 text-base ${desktopBtnTight} ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS}`
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
                        : `!w-auto shrink-0 text-base ${desktopBtnTight} ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
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
            initialWidth={760}
            initialHeight={isCompactUi ? 2400 : frameHeight}
            modal={true}
            closeOnOutsideClick={!!onClose}
            uniformPcScale={!isCompactUi}
            bodyAvoidVerticalStretch={!isCompactUi}
            mobileViewportFit={isCompactUi}
            bodyNoScroll={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4'
                    : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pb-1.5 pt-4 sm:px-5 sm:pb-2 sm:pt-4'
            }
            hideFooter={isCompactUi}
            skipSavedPosition={isCompactUi}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            <div
                className={`flex min-h-0 flex-col text-white ${isCompactUi ? 'h-full min-h-0 flex-1' : 'shrink-0'}`}
            >
                {isCompactUi ? (
                    <div
                        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [zoom:0.5] ${PRE_GAME_MODAL_LAYER_CLASS}`}
                    >
                        {mainBlocks}
                    </div>
                ) : (
                    <div
                        ref={contentMeasureRef}
                        className={`flex min-h-0 min-w-0 shrink-0 flex-col ${PRE_GAME_MODAL_LAYER_CLASS}`}
                    >
                        <div className="min-h-0 shrink-0 overflow-visible overflow-x-hidden pr-0.5">
                            {mainBlocks}
                        </div>
                        <div
                            className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap mt-1.5 shrink-0 rounded-b-xl !gap-2 !py-2 !px-3 sm:!px-3.5`}
                        >
                            {footerButtons(false)}
                        </div>
                    </div>
                )}

                {isCompactUi ? (
                    <div
                        className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap shrink-0 mt-1.5 rounded-b-2xl border-t border-amber-500/35 !gap-2 px-2 py-2 sm:px-3`}
                    >
                        {footerButtons(true)}
                    </div>
                ) : null}
            </div>
        </DraggableWindow>
    );
};

export default SinglePlayerGameDescriptionModal;
