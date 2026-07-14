import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../hooks/useAppTranslation.js';
import i18n from '../shared/i18n/config.js';
import { createPortal } from 'react-dom';
import { LiveGameSession, ServerAction, SinglePlayerStageInfo, UserWithStatus } from '../types.js';
import { getSinglePlayerStages, setSinglePlayerStagesFromServer } from '../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, EQUIPMENT_POOL } from '../constants/index.js';
import { SinglePlayerLevel } from '../types/enums.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import Button from './Button.js';
import DraggableWindow, { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from './DraggableWindow.js';
import { getPreGameSummaryFour, type PreGameItemSlot } from '../utils/preGameSummaryFour.js';
import { buildSinglePlayerAcademyGoalDisplay } from '../utils/singlePlayerAcademyPreGameDisplay.js';
import { resolveSinglePlayerAcademyModeGuideTabs } from '../utils/singlePlayerAcademyModeGuide.js';
import { resolveLiveSessionSinglePlayerStageRow } from '../shared/utils/liveSessionSinglePlayerStage.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { getItemTemplateByName, normalizeBoxItemName } from '../utils/itemTemplateLookup.js';
import { getTowerSessionFloor, isTowerFirstClearAttemptOnFloor } from '../utils/towerPreGameDisplay.js';
import {
  PRE_GAME_MODAL_LAYER_CLASS,
  PRE_GAME_MODAL_FOOTER_CLASS,
  PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
  PRE_GAME_MODAL_ACCENT_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';
import SinglePlayerAcademyGoalStrip from './game/SinglePlayerAcademyGoalStrip.js';
import SinglePlayerModePlayGuide from './game/SinglePlayerModePlayGuide.js';
import { ResultModalXpRewardBadge } from './game/ResultModalXpRewardBadge.js';
import { formatGoldAmountKoG } from '../shared/utils/walletAmountDisplay.js';
import {
    RESULT_MODAL_BOX_GOLD_CLASS,
    RESULT_MODAL_BOX_ITEM_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';
import TowerItemShopModal, { towerShopItemIdFromSlotKey } from './TowerItemShopModal.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import StageDefinitionEditorShell from './editor/StageDefinitionEditorShell.js';
import SinglePlayerStageOrderEditor from './editor/SinglePlayerStageOrderEditor.js';

const SINGLE_PLAYER_CLEAR_GOLD_BOX = `${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;
const SINGLE_PLAYER_CLEAR_ITEM_BOX = `${RESULT_MODAL_BOX_ITEM_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;
const ADMIN_HEADER_BTN_CLASS = `${SUDAMR_MODAL_CLOSE_BUTTON_CLASS} shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40`;

interface SinglePlayerGameDescriptionModalProps {
    session: LiveGameSession;
    onStart?: () => void;
    onClose?: () => void;
    /** 경기 시작 전: 로비(바둑학원·탑)로 나가기 */
    onExit?: () => void;
    /** 인게임 경기방법: 시작하기 대신 확인 버튼만 표시 */
    readOnly?: boolean;
    currentUser?: UserWithStatus;
    onAction?: (action: ServerAction) => Promise<any> | void;
    /** 도전의 탑: 경기정보 모달에서 아이템 상점 구매 */
    onTowerItemPurchase?: (itemId: string, quantity: number) => Promise<void>;
}

const SINGLE_PLAYER_LEVEL_KEY: Partial<Record<SinglePlayerLevel, string>> = {
    [SinglePlayerLevel.입문]: 'intro',
    [SinglePlayerLevel.초급]: 'beginner',
    [SinglePlayerLevel.중급]: 'intermediate',
    [SinglePlayerLevel.고급]: 'advanced',
    [SinglePlayerLevel.유단자]: 'masterClass',
};

/** 싱글: 바둑학원 + 반 · 스테이지. 탑은 층명 */
function formatStageDisplayName(stage: SinglePlayerStageInfo, isTower: boolean): string {
    if (isTower) return stage.name;
    const parts = resolveAcademyStageHeaderParts(stage);
    const segments = [parts.academyName, parts.className].filter(Boolean);
    if (parts.stageNum) segments.push(i18n.t('game:singlePlayerDesc.stage', { num: parts.stageNum }));
    return segments.join(' · ');
}

type AcademyStageHeaderParts = {
    academyName: string;
    className: string;
    stageNum: string | null;
};

function resolveAcademyStageHeaderParts(stage: SinglePlayerStageInfo): AcademyStageHeaderParts {
    const levelKey = SINGLE_PLAYER_LEVEL_KEY[stage.level as SinglePlayerLevel];
    const className = levelKey ? i18n.t(`game:singlePlayerDesc.${levelKey}`) : stage.name;
    const tail = stage.id.split('-').pop() ?? '';
    const stageNum = /^\d+$/.test(tail) ? tail : null;
    return {
        academyName: i18n.t('game:singlePlayerDesc.academy'),
        className,
        stageNum,
    };
}

function StageHeaderTitle({
    stage,
    isTower,
    compact = false,
    centered = false,
}: {
    stage: SinglePlayerStageInfo;
    isTower: boolean;
    compact?: boolean;
    centered?: boolean;
}) {
    const { t } = useTranslation('game');
    const titleClass = compact
        ? 'text-[1rem] font-black leading-tight text-white sm:text-[1.05rem]'
        : 'text-lg font-black leading-tight text-white sm:text-xl';
    const metaClass = compact
        ? 'text-[0.78rem] font-bold text-amber-200/88 sm:text-[0.82rem]'
        : 'text-sm font-bold text-amber-200/88 sm:text-[0.9rem]';
    const dotClass = 'text-amber-500/40 font-bold select-none';
    const rowClass = `flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5${
        centered ? ' w-full justify-center text-center' : ''
    }`;

    if (isTower) {
        return (
            <div className={rowClass}>
                <span className={metaClass}>{t('singlePlayerDesc.tower')}</span>
                <span className={dotClass} aria-hidden>
                    ·
                </span>
                <span className={titleClass}>{stage.name}</span>
            </div>
        );
    }

    const parts = resolveAcademyStageHeaderParts(stage);
    return (
        <div className={rowClass}>
            <span className={metaClass}>{parts.academyName}</span>
            <span className={titleClass}>{parts.className}</span>
            {parts.stageNum && (
                <>
                    <span className={dotClass} aria-hidden>
                        ·
                    </span>
                    <span className={`${metaClass} text-amber-100/92`}>
                        {t('singlePlayerDesc.stage', { num: parts.stageNum })}
                    </span>
                </>
            )}
        </div>
    );
}

function TowerItemSlotChip({
    slot,
    onZeroClick,
}: {
    slot: PreGameItemSlot;
    onZeroClick?: () => void;
}) {
    const { t } = useTranslation('game');
    const muted = slot.inventoryBadgeMode && slot.count <= 0;
    const badgeClass = muted
        ? 'border-2 border-gray-700 bg-gray-600 text-gray-300'
        : slot.inventoryBadgeMode
          ? 'border-2 border-purple-900 bg-yellow-400 text-gray-900'
          : 'border border-amber-500/45 bg-zinc-950/95 text-amber-100';
    const inner = (
        <>
            <div
                className={`${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center rounded-lg border border-amber-400/28 bg-gradient-to-br from-black/55 via-zinc-950/90 to-zinc-900/80 p-0.5 ring-1 ring-inset ring-amber-400/12`}
            >
                <img src={slot.img} alt="" className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain" />
            </div>
            <span
                className={`pointer-events-none absolute -bottom-0.5 -right-0.5 flex min-h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-md px-0.5 py-px text-[0.56rem] font-black tabular-nums leading-none sm:text-[0.62rem] ${badgeClass}`}
            >
                {slot.count}
            </span>
        </>
    );
    if (onZeroClick) {
        return (
            <button
                type="button"
                className="relative flex flex-shrink-0 flex-col items-center gap-0.5 rounded-lg border-0 bg-transparent p-0 outline-none ring-amber-400/40 transition hover:brightness-110 focus-visible:ring-2"
                title={slot.title ? t('preGame.quantityBuy', { title: slot.title }) : t('preGame.itemShop')}
                onClick={onZeroClick}
            >
                {inner}
            </button>
        );
    }
    return <div className="relative flex flex-shrink-0 flex-col items-center gap-0.5">{inner}</div>;
}

/** DraggableWindow 헤더 + 본문(좌우·상단) 패딩 — 하단 pb는 본문 클래스에서 별도 최소화 */
const DRAG_WINDOW_CHROME_PX = 132;
/** 측정 ref에 버튼 바 포함 시, DraggableWindow 하단 ‘창 위치 기억하기’ 줄 + 여유 */
const IN_MODAL_FOOTER_RESERVE_PX = 72;
/** 내용 높이 측정 후 스크롤 방지용 추가 여유 */
const FRAME_CONTENT_HEIGHT_BUFFER_PX = 48;
/** 내용에 맞춤 */
const DRAG_FRAME_H_MIN = 460;
const DRAG_FRAME_H_MAX = 1400;
function firstClearRewardHasContent(reward: { gold?: number; exp?: number; items?: readonly unknown[] } | undefined): boolean {
    if (!reward) return false;
    return (reward.gold ?? 0) > 0 || (reward.exp ?? 0) > 0 || (reward.items?.length ?? 0) > 0;
}

const SinglePlayerGameDescriptionModal: React.FC<SinglePlayerGameDescriptionModalProps> = ({
    session,
    onStart,
    onClose,
    onExit,
    readOnly = false,
    currentUser,
    onAction,
    onTowerItemPurchase,
}) => {
    const { t } = useTranslation('game');
    const { singlePlayerStagesListRevision } = useAppContext();
    const isTower = session.gameCategory === 'tower';
    const stage: SinglePlayerStageInfo | undefined = isTower
        ? TOWER_STAGES.find((s) => s.id === session.stageId)
        : resolveLiveSessionSinglePlayerStageRow(session);

    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);
    /** 좁은 뷰·네이티브: 뷰포트 맞춤 + 본문만 스크롤, 하단 버튼 고정 */
    const isCompactUi = isHandheld || isNativeMobile;

    const summaryFour = useMemo(
        () =>
            stage
                ? getPreGameSummaryFour(session, stage, isTower ? currentUser?.inventory : undefined)
                : null,
        [session, stage, isTower, currentUser?.inventory, singlePlayerStagesListRevision]
    );
    const academyGoals = useMemo(
        () => (stage ? buildSinglePlayerAcademyGoalDisplay(session, stage) : null),
        [session, stage, singlePlayerStagesListRevision]
    );
    const modeGuideContext = useMemo(
        () => ({
            missileCount: session.settings.missileCount ?? stage?.missileCount ?? 0,
            hiddenCount: session.settings.hiddenStoneCount ?? stage?.hiddenCount ?? 0,
            scanCount: session.settings.scanCount ?? stage?.scanCount ?? 0,
        }),
        [session.settings, stage]
    );
    const modeGuideTabs = useMemo(
        () => (stage ? resolveSinglePlayerAcademyModeGuideTabs(session, stage, modeGuideContext) : []),
        [session, stage, modeGuideContext, singlePlayerStagesListRevision]
    );
    const contentMeasureRef = useRef<HTMLDivElement>(null);
    const [frameHeight, setFrameHeight] = useState(860);
    const [towerShopOpen, setTowerShopOpen] = useState(false);
    const [towerShopInitialItemId, setTowerShopInitialItemId] = useState<string | undefined>(undefined);
    const [editorOpen, setEditorOpen] = useState(false);
    const [orderEditorOpen, setOrderEditorOpen] = useState(false);

    useLayoutEffect(() => {
        const el = contentMeasureRef.current;
        if (!el) return;
        const update = () => {
            const raw = Math.max(el.offsetHeight, el.scrollHeight);
            if (raw < 8) return;
            const next = Math.min(
                DRAG_FRAME_H_MAX,
                Math.max(
                    DRAG_FRAME_H_MIN,
                    Math.ceil(raw + DRAG_WINDOW_CHROME_PX + IN_MODAL_FOOTER_RESERVE_PX + FRAME_CONTENT_HEIGHT_BUFFER_PX),
                ),
            );
            setFrameHeight((prev) => (prev === next ? prev : next));
        };
        update();
        const ro = new ResizeObserver(() => requestAnimationFrame(update));
        ro.observe(el);
        return () => ro.disconnect();
    }, [session, stage, academyGoals, modeGuideTabs, summaryFour]);

    const canOpenTowerShop = isTower && !!currentUser && !!onTowerItemPurchase;
    const canOpenStageEditor = !isTower && !!currentUser && isClientAdmin(currentUser) && !!onAction;
    const pendingSinglePlayerGameId = !isTower && session.gameStatus === 'pending' ? session.id : undefined;
    const adminStageListIndex = useMemo(() => {
        if (isTower) return -1;
        return getSinglePlayerStages().findIndex((s) => s.id === session.stageId);
    }, [isTower, session.stageId, singlePlayerStagesListRevision]);
    const adminSpListLen = useMemo(
        () => getSinglePlayerStages().length,
        [singlePlayerStagesListRevision],
    );
    const adminCanJumpPrev =
        !!pendingSinglePlayerGameId && canOpenStageEditor && adminStageListIndex > 0;
    const adminCanJumpNext =
        !!pendingSinglePlayerGameId &&
        canOpenStageEditor &&
        adminStageListIndex >= 0 &&
        adminStageListIndex < adminSpListLen - 1;

    if (!stage) {
        return null;
    }

    const stageDisplayName = formatStageDisplayName(stage, isTower);
    const itemSlots = summaryFour?.itemSlots ?? [];

    /** 서버와 동일: 최초 클리어 보상만 표시(재도전·이미 클리어한 층/스테이지는 없음). */
    const sessionFloorTower = isTower ? getTowerSessionFloor(session) : 0;
    const isEligibleForFirstClearRewards =
        currentUser == null
            ? true
            : isTower
              ? isTowerFirstClearAttemptOnFloor(currentUser.monthlyTowerFloor, sessionFloorTower)
              : !(currentUser.clearedSinglePlayerStages ?? []).includes(stage.id);
    const firstClearReward = stage.rewards?.firstClear;
    const clearReward = isEligibleForFirstClearRewards ? firstClearReward : undefined;
    const hasClearRewardToShow = isEligibleForFirstClearRewards && firstClearRewardHasContent(clearReward);

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

    /** 컴팩트: 세로 간격·패딩 통일 */
    const spacingY = 'space-y-2';
    const panelPad = 'p-2.5';
    const mainBlocks = (
        <div className={`${spacingY} min-w-0`}>
            <div
                className={`rounded-xl border border-amber-500/28 bg-gradient-to-r from-amber-950/50 via-zinc-900/85 to-zinc-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] ${panelPad}`}
            >
                <div className="flex flex-col items-center gap-2 text-center">
                    <StageHeaderTitle stage={stage} isTower={isTower} compact={isCompactUi} centered />
                    <div className="w-full border-t border-amber-500/25 pt-2">
                        <p className="w-full shrink-0 whitespace-nowrap text-[0.68rem] font-bold uppercase tracking-[0.12em] text-amber-200/88 sm:text-[0.7rem]">
                            {t('singlePlayerDesc.clearReward')}
                        </p>
                        {hasClearRewardToShow && clearReward ? (
                            <div className="mt-1.5 flex w-full min-w-0 flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-1.5 sm:mt-2 sm:gap-x-2">
                                {(clearReward.gold ?? 0) > 0 && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <div className={`${SINGLE_PLAYER_CLEAR_GOLD_BOX} ring-1 ring-amber-400/20`} aria-hidden>
                                            <img
                                                src="/images/icon/Gold.webp"
                                                alt=""
                                                className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5"
                                            />
                                        </div>
                                        <span className="max-w-[6.5rem] text-center text-[0.7rem] font-bold tabular-nums leading-tight text-amber-100 sm:text-xs">
                                            {formatGoldAmountKoG(clearReward.gold ?? 0)}
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
                                {t('singlePlayerDesc.noReward')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {academyGoals && (
                <SinglePlayerAcademyGoalStrip goals={academyGoals} compact={isCompactUi} centered />
            )}

            <SinglePlayerModePlayGuide tabs={modeGuideTabs} compact={isCompactUi} />

            {itemSlots.length > 0 && (
                <div
                    className={`rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] ${panelPad} text-center ring-1 ring-inset ring-amber-400/12`}
                >
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-amber-200/88 sm:text-xs">
                        {t('preGame.items')}
                    </p>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-center gap-2">
                        {itemSlots.map((slot) => (
                            <TowerItemSlotChip
                                key={slot.key}
                                slot={slot}
                                onZeroClick={
                                    canOpenTowerShop &&
                                    slot.towerShopOnZero &&
                                    slot.count <= 0
                                        ? () => {
                                              const id = towerShopItemIdFromSlotKey(slot.key);
                                              setTowerShopInitialItemId(id);
                                              setTowerShopOpen(true);
                                          }
                                        : undefined
                                }
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    /** 데스크톱: 공통 버튼 박스 높이만 살짝 낮춤(모달 전용, AI 설명 모달 등은 유지) */
    const desktopBtnTight = '!min-h-[2.65rem] !py-2 !px-6 sm:!px-7';

    const adminHeaderContent = useMemo(() => {
        if (readOnly || !canOpenStageEditor) return null;
        const stopDrag = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();
        return (
            <div className="flex max-w-[min(100vw-8rem,26rem)] flex-wrap items-center justify-end gap-1 sm:max-w-none sm:gap-2">
                {pendingSinglePlayerGameId && onAction && (
                    <>
                        <button
                            type="button"
                            onMouseDown={stopDrag}
                            onTouchStart={stopDrag}
                            onClick={() => {
                                void onAction({
                                    type: 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE',
                                    payload: { gameId: pendingSinglePlayerGameId, direction: 'prev' },
                                } as ServerAction);
                            }}
                            disabled={!adminCanJumpPrev}
                            className={ADMIN_HEADER_BTN_CLASS}
                        >
                            {t('singlePlayerDesc.prev')}
                        </button>
                        <button
                            type="button"
                            onMouseDown={stopDrag}
                            onTouchStart={stopDrag}
                            onClick={() => {
                                void onAction({
                                    type: 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE',
                                    payload: { gameId: pendingSinglePlayerGameId, direction: 'next' },
                                } as ServerAction);
                            }}
                            disabled={!adminCanJumpNext}
                            className={ADMIN_HEADER_BTN_CLASS}
                        >
                            {t('singlePlayerDesc.next')}
                        </button>
                    </>
                )}
                <button
                    type="button"
                    onMouseDown={stopDrag}
                    onTouchStart={stopDrag}
                    onClick={() => setEditorOpen(true)}
                    className={ADMIN_HEADER_BTN_CLASS}
                >
                    {t('singlePlayerDesc.editStage')}
                </button>
                <button
                    type="button"
                    onMouseDown={stopDrag}
                    onTouchStart={stopDrag}
                    onClick={() => setOrderEditorOpen(true)}
                    className={ADMIN_HEADER_BTN_CLASS}
                >
                    {t('singlePlayerDesc.editOrder')}
                </button>
            </div>
        );
    }, [
        readOnly,
        canOpenStageEditor,
        pendingSinglePlayerGameId,
        onAction,
        adminCanJumpPrev,
        adminCanJumpNext,
        t,
    ]);

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
                    {t('singlePlayerDesc.confirm')}
                </Button>
            ) : (
                <>
            {onExit && (
                <Button
                    onClick={onExit}
                    colorScheme="gray"
                    className={
                        compact
                            ? `!flex-1 basis-0 min-w-0 min-h-[3rem] px-5 py-2.5 text-base max-[480px]:px-4 ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS}`
                            : `!w-auto shrink-0 text-base ${desktopBtnTight} ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS}`
                    }
                >
                    {t('singlePlayerDesc.exit')}
                </Button>
            )}
            <Button
                onClick={() => {
                    onStart?.();
                }}
                colorScheme="accent"
                disabled={!onStart}
                className={
                    compact
                        ? onExit
                            ? `!flex-1 basis-0 min-w-0 min-h-[3rem] px-5 py-2.5 text-base max-[480px]:px-4 ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                            : `mx-auto !w-full max-w-[min(20rem,92vw)] min-h-[3rem] px-8 py-2.5 text-base ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                        : `!w-auto shrink-0 text-base ${desktopBtnTight} ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`
                }
            >
                {t('singlePlayerDesc.start')}
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
                    initialSelectedItemId={towerShopInitialItemId}
                    onClose={() => {
                        setTowerShopOpen(false);
                        setTowerShopInitialItemId(undefined);
                    }}
                    onBuy={onTowerItemPurchase!}
                />
            </div>,
            document.body
        );

    /** DraggableWindow 본문이 overflow-hidden이라 fixed 편집기가 창 안에 갇히지 않도록 body로 포털 */
    const stageEditorPortal =
        canOpenStageEditor &&
        createPortal(
            <StageDefinitionEditorShell
                open={editorOpen}
                scope="singleplayer"
                stage={stage}
                onClose={() => setEditorOpen(false)}
                onSave={async (nextStage) => {
                    if (!onAction) return;
                    const nextStages = getSinglePlayerStages().map((row) => (row.id === nextStage.id ? nextStage : row));
                    const result = (await onAction({
                        type: 'ADMIN_SET_SINGLE_PLAYER_STAGES',
                        payload: { stages: nextStages },
                    } as ServerAction)) as any;
                    if (result?.error) throw new Error(result.error);
                    setSinglePlayerStagesFromServer(result?.clientResponse?.singlePlayerStages ?? nextStages);
                    if (session.isSinglePlayer && session.gameStatus === 'pending') {
                        try {
                            await onAction({
                                type: 'SINGLE_PLAYER_SYNC_PENDING_STAGE',
                                payload: { gameId: session.id },
                            } as ServerAction);
                        } catch (error) {
                            console.warn('[StageDefinitionEditorShell] pending stage sync failed:', error);
                        }
                    }
                    setEditorOpen(false);
                }}
                onResetAllToDefault={async () => {
                    if (!onAction) return;
                    const result = (await onAction({
                        type: 'ADMIN_RESET_SINGLE_PLAYER_STAGES',
                    } as ServerAction)) as any;
                    if (result?.error) throw new Error(result.error);
                    if (session.isSinglePlayer && session.gameStatus === 'pending') {
                        try {
                            await onAction({
                                type: 'SINGLE_PLAYER_SYNC_PENDING_STAGE',
                                payload: { gameId: session.id },
                            } as ServerAction);
                        } catch (e) {
                            console.warn('[SinglePlayerGameDescriptionModal] pending sync after reset:', e);
                        }
                    }
                }}
            />,
            document.body
        );

    const stageOrderEditorPortal =
        canOpenStageEditor &&
        orderEditorOpen &&
        onAction &&
        createPortal(
            <SinglePlayerStageOrderEditor
                open={orderEditorOpen}
                onClose={() => setOrderEditorOpen(false)}
                onAction={onAction}
                pendingSinglePlayerGameId={pendingSinglePlayerGameId}
            />,
            document.body
        );

    return (
        <DraggableWindow
            title={t('singlePlayerDesc.title', { name: stageDisplayName })}
            titleContent={
                isCompactUi ? (
                    <span className="flex min-w-0 flex-col items-center gap-0.5 text-center leading-tight">
                        <StageHeaderTitle stage={stage} isTower={isTower} compact centered />
                        <span className="text-[0.68rem] font-semibold text-amber-100/70">{t('singlePlayerDesc.gameDesc')}</span>
                    </span>
                ) : undefined
            }
            windowId="game-description-modal"
            onClose={readOnly ? onClose : onExit ?? onClose}
            headerContent={adminHeaderContent}
            initialWidth={640}
            initialHeight={isCompactUi ? 2800 : frameHeight}
            modal={true}
            transparentModalBackdrop
            closeOnOutsideClick={!!(readOnly ? onClose : onExit ?? onClose)}
            uniformPcScale={!isCompactUi}
            bodyAvoidVerticalStretch={true}
            mobileViewportFit={isCompactUi}
            mobileViewportMaxHeightCss="92dvh"
            mobileViewportDvhBottomGapPx={12}
            bodyNoScroll={true}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2.5 sm:p-3'
                    : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-1.5 pt-3 sm:px-3.5 sm:pb-2 sm:pt-3'
            }
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            {stageEditorPortal}
            {stageOrderEditorPortal}
            {towerShopPortal}
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col text-white">
                <div
                    className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable] ${PRE_GAME_MODAL_LAYER_CLASS}`}
                >
                    <div ref={contentMeasureRef}>{mainBlocks}</div>
                </div>
                <div
                    className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap shrink-0 border-t border-amber-500/35 !gap-2 px-2 py-2 sm:px-3 sm:py-2.5 ${
                        isCompactUi ? 'mt-1.5 rounded-b-2xl' : 'rounded-b-xl'
                    }`}
                >
                    {footerButtons(isCompactUi)}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SinglePlayerGameDescriptionModal;
