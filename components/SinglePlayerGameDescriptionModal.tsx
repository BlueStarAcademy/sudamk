import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { getItemTemplateByName, normalizeBoxItemName } from '../utils/itemTemplateLookup.js';
import { getTowerSessionFloor, isTowerFirstClearAttemptOnFloor } from '../utils/towerPreGameDisplay.js';
import {
  PreGameSummaryGrid,
  PRE_GAME_MODAL_LAYER_CLASS,
  PRE_GAME_MODAL_FOOTER_CLASS,
  PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
  PRE_GAME_MODAL_ACCENT_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';
import { ResultModalXpRewardBadge } from './game/ResultModalXpRewardBadge.js';
import {
    RESULT_MODAL_BOX_GOLD_CLASS,
    RESULT_MODAL_BOX_ITEM_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';
import TowerItemShopModal from './TowerItemShopModal.js';

const SINGLE_PLAYER_CLEAR_GOLD_BOX = `${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;
const SINGLE_PLAYER_CLEAR_ITEM_BOX = `${RESULT_MODAL_BOX_ITEM_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;

interface SinglePlayerGameDescriptionModalProps {
    session: LiveGameSession;
    onStart?: () => void;
    onClose?: () => void;
    /** 인게임 경기방법: 시작하기 대신 확인 버튼만 표시 */
    readOnly?: boolean;
    currentUser?: UserWithStatus;
    /** 도전의 탑: 경기정보 모달에서 아이템 상점 구매 */
    onTowerItemPurchase?: (itemId: string, quantity: number) => Promise<void>;
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

function firstClearRewardHasContent(reward: { gold?: number; exp?: number; items?: readonly unknown[] } | undefined): boolean {
    if (!reward) return false;
    return (reward.gold ?? 0) > 0 || (reward.exp ?? 0) > 0 || (reward.items?.length ?? 0) > 0;
}

const SinglePlayerGameDescriptionModal: React.FC<SinglePlayerGameDescriptionModalProps> = ({
    session,
    onStart,
    onClose,
    readOnly = false,
    currentUser,
    onTowerItemPurchase,
}) => {
    const isTower = session.gameCategory === 'tower';
    const stage: SinglePlayerStageInfo | undefined = isTower
        ? TOWER_STAGES.find((s) => s.id === session.stageId)
        : SINGLE_PLAYER_STAGES.find((s) => s.id === session.stageId);

    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);
    /** 좁은 뷰·네이티브: 뷰포트 맞춤 + 본문만 스크롤, 하단 버튼 고정 */
    const isCompactUi = isHandheld || isNativeMobile;

    const summaryFour = useMemo(
        () =>
            getPreGameSummaryFour(
                session,
                stage,
                isTower ? currentUser?.inventory : undefined
            ),
        [session, stage, isTower, currentUser?.inventory]
    );
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

    /** 서버와 동일: 최초 클리어 보상만 표시(재도전·이미 클리어한 층/스테이지는 없음). */
    const sessionFloorTower = isTower ? getTowerSessionFloor(session) : 0;
    const isEligibleForFirstClearRewards =
        currentUser == null
            ? true
            : isTower
              ? isTowerFirstClearAttemptOnFloor(currentUser.towerFloor, sessionFloorTower)
              : !(currentUser.clearedSinglePlayerStages ?? []).includes(stage.id);
    const firstClearReward = stage.rewards?.firstClear;
    const clearReward = isEligibleForFirstClearRewards ? firstClearReward : undefined;
    const hasClearRewardToShow = isEligibleForFirstClearRewards && firstClearRewardHasContent(clearReward);

    const [towerShopOpen, setTowerShopOpen] = useState(false);
    const canOpenTowerShop = isTower && !!currentUser && !!onTowerItemPurchase;

    const resolveItemImage = (itemId: string): string | null => {
        const normalized = normalizeBoxItemName(itemId);
        const byNorm = getItemTemplateByName(normalized);
        if (byNorm?.image) return byNorm.image;
        const byRaw = getItemTemplateByName(itemId);
        if (byRaw?.image) return byRaw.image;
        const c = CONSUMABLE_ITEMS.find((it) => it.name === itemId);
        if (c?.image) return c.image;
        if (MATERIAL_ITEMS[itemId]?.image) return MATERIAL_ITEMS[itemId].image;
        const eq = EQUIPMENT_POOL.find((it) => it.name === itemId);
        return eq?.image ?? null;
    };

    /** 컴팩트: 세로 간격을 조금 줄여 같은 뷰포트 안에 더 많이 들어가게 함 */
    const spacingY = isCompactUi ? 'space-y-2 sm:space-y-2.5' : 'space-y-3.5';
    const mainBlocks = (
        <div className={`${spacingY} pr-0.5`}>
            <div
                className={`rounded-xl border border-amber-500/28 bg-gradient-to-r from-amber-950/50 via-zinc-900/85 to-zinc-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] ${isCompactUi ? 'p-2.5' : 'p-3 sm:p-3.5'}`}
            >
                <div className="flex flex-row items-stretch gap-2 sm:gap-3 md:gap-4">
                    <div
                        className={`flex min-w-0 flex-1 gap-2 sm:gap-3 ${isCompactUi ? '' : 'sm:items-center'}`}
                    >
                        <div
                            className={`relative flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/35 bg-gradient-to-br from-black/70 via-zinc-950 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-500/20 ${
                                isCompactUi
                                    ? 'h-[4.5rem] w-[4.5rem] sm:h-[5.25rem] sm:w-[5.25rem]'
                                    : 'h-20 w-20 sm:h-[5.25rem] sm:w-[5.25rem]'
                            }`}
                        >
                            {modeMeta?.image ? (
                                <img src={modeMeta.image} alt="" className="h-full w-full object-contain p-1.5 drop-shadow-md sm:p-2" />
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs font-bold text-amber-200/45">{session.mode}</div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p
                                className={`font-bold uppercase tracking-[0.12em] text-amber-200/78 ${
                                    isCompactUi ? 'text-[0.68rem] sm:text-[0.7rem]' : 'text-[0.62rem] sm:text-[0.65rem]'
                                }`}
                            >
                                {isTower ? '도전의 탑' : '싱글 스테이지'}
                            </p>
                            <h3
                                className={`mt-0.5 font-black leading-tight tracking-tight text-white drop-shadow-sm ${
                                    isCompactUi
                                        ? 'text-[1.05rem] leading-snug sm:text-xl'
                                        : 'text-lg max-[480px]:text-[1.2rem] sm:text-xl'
                                }`}
                            >
                                {stageDisplayName}
                            </h3>
                            <p className={`mt-1 text-sky-200/88 ${isCompactUi ? 'text-[0.8125rem] sm:text-[0.95rem]' : 'text-sm sm:text-[0.95rem]'}`}>
                                모드{' '}
                                <span className="whitespace-nowrap font-semibold text-sky-100/95">{gameModeName}</span>
                            </p>
                        </div>
                    </div>

                    <div
                        className={
                            isCompactUi
                                ? 'flex w-[min(10.25rem,40%)] shrink-0 flex-col border-l border-amber-500/25 pl-2 text-center'
                                : 'flex w-auto min-w-[11.5rem] max-w-[16rem] shrink-0 flex-col border-l border-amber-500/25 pl-3 text-center sm:min-w-[12rem] sm:pl-4'
                        }
                    >
                        <p className="w-full shrink-0 whitespace-nowrap text-[0.68rem] font-bold uppercase tracking-[0.12em] text-amber-200/88 sm:text-[0.7rem] sm:tracking-[0.12em] md:text-xs">
                            클리어 보상
                        </p>
                        {hasClearRewardToShow && clearReward ? (
                            <div className="mt-1.5 flex w-full min-w-0 flex-row flex-wrap content-start items-start justify-center gap-x-1.5 gap-y-1.5 sm:mt-2 sm:gap-x-2">
                                {(clearReward.gold ?? 0) > 0 && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <div className={`${SINGLE_PLAYER_CLEAR_GOLD_BOX} ring-1 ring-amber-400/20`} aria-hidden>
                                            <img
                                                src="/images/icon/Gold.png"
                                                alt=""
                                                className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5"
                                            />
                                        </div>
                                        <span className="max-w-[6.5rem] text-center text-[0.7rem] font-bold tabular-nums leading-tight text-amber-100 sm:text-xs">
                                            {(clearReward.gold ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {(clearReward.exp ?? 0) > 0 && (
                                    <ResultModalXpRewardBadge
                                        variant="strategy"
                                        amount={clearReward.exp ?? 0}
                                        density="compact"
                                    />
                                )}
                                {clearReward.items?.map((rewardItem, idx) => {
                                    const image = resolveItemImage(rewardItem.itemId);
                                    return (
                                        <div
                                            key={`${rewardItem.itemId}-${idx}`}
                                            className="flex flex-col items-center gap-0.5"
                                            title={rewardItem.itemId}
                                        >
                                            <div className={`${SINGLE_PLAYER_CLEAR_ITEM_BOX} ring-1 ring-violet-400/15`} aria-hidden>
                                                {image ? (
                                                    <img
                                                        src={image}
                                                        alt=""
                                                        className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5"
                                                    />
                                                ) : (
                                                    <span className="text-base leading-none sm:text-lg">🎁</span>
                                                )}
                                            </div>
                                            <span className="text-center text-[0.68rem] font-bold tabular-nums leading-tight text-violet-100 sm:text-xs">
                                                ×{rewardItem.quantity}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-2 text-center text-sm font-semibold text-amber-100/85 sm:text-[0.95rem]">
                                보상없음
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <PreGameSummaryGrid
                session={session}
                summary={summaryFour}
                singleColumn={isCompactUi}
                briefLayout
                onTowerItemZeroClick={canOpenTowerShop ? () => setTowerShopOpen(true) : undefined}
            />
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

    const towerShopPortal =
        canOpenTowerShop &&
        towerShopOpen &&
        createPortal(
            <div className="fixed inset-0 z-[220]">
                <TowerItemShopModal
                    currentUser={currentUser!}
                    onClose={() => setTowerShopOpen(false)}
                    onBuy={onTowerItemPurchase!}
                />
            </div>,
            document.body
        );

    return (
        <DraggableWindow
            title={`${stageDisplayName} - 게임 설명`}
            windowId="game-description-modal"
            onClose={onClose}
            initialWidth={760}
            initialHeight={isCompactUi ? 2400 : frameHeight}
            modal={true}
            transparentModalBackdrop
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
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            {towerShopPortal}
            <div
                className={`flex min-h-0 flex-col text-white ${isCompactUi ? 'h-full min-h-0 flex-1' : 'shrink-0'}`}
            >
                {isCompactUi ? (
                    <div
                        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable] ${PRE_GAME_MODAL_LAYER_CLASS}`}
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
