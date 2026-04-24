import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveGameSession, ServerAction, SinglePlayerStageInfo, UserWithStatus } from '../types.js';
import { SINGLE_PLAYER_STAGES, setSinglePlayerStagesFromServer } from '../constants/singlePlayerConstants.js';
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
import TowerItemShopModal, { towerShopItemIdFromSlotKey } from './TowerItemShopModal.js';
import {
    isOnboardingTutorialActive,
    ONBOARDING_PREGAME_DESC_STEP_EVENT,
} from '../shared/constants/onboardingTutorial.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import { activateIntro11TutorialForGame } from '../utils/singlePlayerIntro11Tutorial.js';
import {
    ONBOARDING_SPOTLIGHT_DIM_LAYER_CLASS,
    spotlightDimClipPathFromPxRect,
} from '../utils/onboardingSpotlightDimClipPath.js';
import StageDefinitionEditorShell from './editor/StageDefinitionEditorShell.js';

const SINGLE_PLAYER_CLEAR_GOLD_BOX = `${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;
const SINGLE_PLAYER_CLEAR_ITEM_BOX = `${RESULT_MODAL_BOX_ITEM_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;

interface SinglePlayerGameDescriptionModalProps {
    session: LiveGameSession;
    onStart?: () => void;
    onClose?: () => void;
    /** 인게임 경기방법: 시작하기 대신 확인 버튼만 표시 */
    readOnly?: boolean;
    currentUser?: UserWithStatus;
    onAction?: (action: ServerAction) => Promise<any> | void;
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

/** 모바일 헤더·본문: 1행 반 이름, 2행 스테이지 N */
function getCompactStageTitleLines(stage: SinglePlayerStageInfo, isTower: boolean): { line1: string; line2: string } {
    if (isTower) {
        return { line1: '도전의 탑', line2: stage.name };
    }
    const label = SINGLE_PLAYER_LEVEL_DISPLAY[stage.level as SinglePlayerLevel] ?? '바둑학원';
    const tail = stage.id.split('-').pop() ?? '';
    const stageNum = /^\d+$/.test(tail) ? tail : null;
    return { line1: label, line2: stageNum ? `스테이지 ${stageNum}` : stage.name };
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
type SpotlightRect = { top: number; left: number; width: number; height: number };

function pickVisibleOnboardingTarget(targetId: string): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const modalRoots = Array.from(
        document.querySelectorAll('[data-draggable-window="game-description-modal"]'),
    ) as HTMLElement[];
    const preferredRoot = modalRoots
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 16 && rect.height > 16 && rect.bottom > 0 && rect.right > 0)
        .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0]?.el;
    const scopedNodes = preferredRoot
        ? (Array.from(preferredRoot.querySelectorAll(`[data-onboarding-target="${targetId}"]`)) as HTMLElement[])
        : [];
    const nodes = scopedNodes.length
        ? scopedNodes
        : (Array.from(document.querySelectorAll(`[data-onboarding-target="${targetId}"]`)) as HTMLElement[]);
    if (!nodes.length) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    const scored = nodes
        .map((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 4 || rect.height <= 4) return null;
            const left = Math.max(0, rect.left);
            const top = Math.max(0, rect.top);
            const right = Math.min(vw, rect.right);
            const bottom = Math.min(vh, rect.bottom);
            const visibleW = Math.max(0, right - left);
            const visibleH = Math.max(0, bottom - top);
            const visibleArea = visibleW * visibleH;
            if (visibleArea <= 16) return null;
            const rcx = rect.left + rect.width / 2;
            const rcy = rect.top + rect.height / 2;
            const dist2 = (rcx - cx) * (rcx - cx) + (rcy - cy) * (rcy - cy);
            return { el, visibleArea, dist2 };
        })
        .filter((v): v is { el: HTMLElement; visibleArea: number; dist2: number } => v != null);
    if (!scored.length) return null;
    // 1) 화면에 더 많이 보이는 요소 우선, 2) 동률이면 화면 중심에 가까운 요소 선택
    scored.sort((a, b) => b.visibleArea - a.visibleArea || a.dist2 - b.dist2);
    return scored[0].el;
}

const INTRO11_WINLOSE_TARGET = 'intro11-pregame-winlose';
const INTRO11_START_TARGET = 'intro11-pregame-start';

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
    onAction,
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
    const [towerShopOpen, setTowerShopOpen] = useState(false);
    const [towerShopInitialItemId, setTowerShopInitialItemId] = useState<string | undefined>(undefined);
    const [pregameDescSubStep, setPregameDescSubStep] = useState(-1);
    const [intro11TutorialStep, setIntro11TutorialStep] = useState<number | null>(null);
    const [intro11SpotlightRect, setIntro11SpotlightRect] = useState<SpotlightRect | null>(null);
    const [intro11PanelDragOffset, setIntro11PanelDragOffset] = useState({ x: 0, y: 0 });
    const [intro11PanelDragging, setIntro11PanelDragging] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const intro11PanelRef = useRef<HTMLDivElement | null>(null);
    const intro11DragPointerIdRef = useRef<number | null>(null);
    const intro11DragOriginRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onStep = (ev: Event) => {
            const d = (ev as CustomEvent<number>).detail;
            setPregameDescSubStep(typeof d === 'number' ? d : -1);
        };
        window.addEventListener(ONBOARDING_PREGAME_DESC_STEP_EVENT, onStep as EventListener);
        return () => window.removeEventListener(ONBOARDING_PREGAME_DESC_STEP_EVENT, onStep as EventListener);
    }, []);

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

    const onboardingPhase5Active =
        !readOnly &&
        isOnboardingTutorialActive(currentUser) &&
        (currentUser?.onboardingTutorialPhase ?? 0) === 5;
    const onboardingPregameFinalSubStep = onboardingPhase5Active && pregameDescSubStep >= 2;

    const intro11Stage = stage?.id === '입문-11' && !isTower && !readOnly;
    const isAdminUser = isClientAdmin(currentUser);
    const isIntro11AlreadyCleared = (currentUser?.clearedSinglePlayerStages ?? []).includes('입문-11');
    const shouldAutoOpenIntro11Tutorial = intro11Stage && !isIntro11AlreadyCleared;
    const isIntro11TutorialOpen = intro11TutorialStep !== null;

    useEffect(() => {
        if (shouldAutoOpenIntro11Tutorial) {
            setIntro11TutorialStep((prev) => (prev == null ? 0 : prev));
            return;
        }
        setIntro11TutorialStep(null);
    }, [shouldAutoOpenIntro11Tutorial, session.id]);

    useEffect(() => {
        if (!(intro11Stage && isIntro11TutorialOpen)) return;
        let rafId = 0;
        let lastRectKey = '';
        const run = () => {
            const portalRoot = document.getElementById('sudamr-onboarding-root') ?? document.body;
            const rootRect = portalRoot.getBoundingClientRect();
            const targetId = intro11TutorialStep === 0 ? INTRO11_WINLOSE_TARGET : INTRO11_START_TARGET;
            const target =
                pickVisibleOnboardingTarget(targetId) ??
                (intro11TutorialStep === 0 ? pickVisibleOnboardingTarget('onboarding-sp-pregame-body') : null);
            if (!target) {
                if (lastRectKey !== 'none') {
                    lastRectKey = 'none';
                    setIntro11SpotlightRect(null);
                }
                return;
            }
            const tr = target.getBoundingClientRect();
            const pad = 10;
            const left = tr.left - rootRect.left;
            const top = tr.top - rootRect.top;
            const right = tr.right - rootRect.left;
            const bottom = tr.bottom - rootRect.top;
            const nextRect = {
                top: Math.max(0, top - pad),
                left: Math.max(0, left - pad),
                width: Math.max(0, Math.min(rootRect.width, right + pad) - Math.max(0, left - pad)),
                height: Math.max(0, Math.min(rootRect.height, bottom + pad) - Math.max(0, top - pad)),
            };
            const key = `${Math.round(nextRect.top)}:${Math.round(nextRect.left)}:${Math.round(nextRect.width)}:${Math.round(nextRect.height)}`;
            if (key !== lastRectKey) {
                lastRectKey = key;
                setIntro11SpotlightRect(nextRect);
            }
        };
        const tick = () => {
            run();
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        window.addEventListener('resize', run);
        window.addEventListener('scroll', run, true);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', run);
            window.removeEventListener('scroll', run, true);
        };
    }, [intro11Stage, isIntro11TutorialOpen, intro11TutorialStep, session.id]);

    useEffect(() => {
        setIntro11PanelDragOffset({ x: 0, y: 0 });
        setIntro11PanelDragging(false);
        intro11DragPointerIdRef.current = null;
        intro11DragOriginRef.current = null;
    }, [intro11TutorialStep, session.id, intro11Stage]);

    const clampIntro11PanelOffset = (nextX: number, nextY: number) => {
        const el = intro11PanelRef.current;
        if (!el) return { x: nextX, y: nextY };
        const rect = el.getBoundingClientRect();
        const maxX = Math.max(0, window.innerWidth / 2 - rect.width / 2 - 8);
        const maxY = Math.max(0, window.innerHeight / 2 - rect.height / 2 - 8);
        return {
            x: Math.max(-maxX, Math.min(maxX, nextX)),
            y: Math.max(-maxY, Math.min(maxY, nextY)),
        };
    };

    useEffect(() => {
        if (!intro11PanelDragging) return;
        const onMove = (ev: PointerEvent) => {
            if (intro11DragPointerIdRef.current !== ev.pointerId) return;
            const origin = intro11DragOriginRef.current;
            if (!origin) return;
            const next = clampIntro11PanelOffset(origin.offsetX + (ev.clientX - origin.x), origin.offsetY + (ev.clientY - origin.y));
            setIntro11PanelDragOffset(next);
        };
        const onUp = (ev: PointerEvent) => {
            if (intro11DragPointerIdRef.current !== ev.pointerId) return;
            intro11DragPointerIdRef.current = null;
            intro11DragOriginRef.current = null;
            setIntro11PanelDragging(false);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [intro11PanelDragging]);

    if (!stage) {
        return null;
    }

    const gameModeName = stage.survivalTurns ? '살리기 바둑' : getGameModeName(session.mode);
    const stageDisplayName = formatStageDisplayName(stage, isTower);
    const compactTitleLines = getCompactStageTitleLines(stage, isTower);
    const modeMeta =
        SPECIAL_GAME_MODES.find((m) => m.mode === session.mode) ?? PLAYFUL_GAME_MODES.find((m) => m.mode === session.mode);
    const intro11ViewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const intro11SpotlightCenterY =
        intro11SpotlightRect != null
            ? intro11SpotlightRect.top + intro11SpotlightRect.height / 2
            : null;
    const intro11PanelPlacementTop =
        intro11SpotlightCenterY == null ? true : intro11SpotlightCenterY > intro11ViewportHeight * 0.5;
    const intro11PortalMount = typeof document !== 'undefined' ? document.getElementById('sudamr-onboarding-root') ?? document.body : null;

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

    const canOpenTowerShop = isTower && !!currentUser && !!onTowerItemPurchase;
    const canOpenStageEditor = !isTower && !!currentUser && isClientAdmin(currentUser) && !!onAction;

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
                <div
                    className={`flex items-stretch gap-2 sm:gap-3 md:gap-4 ${isCompactUi ? 'flex-col min-[400px]:flex-row' : 'flex-row'}`}
                >
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
                                        ? 'text-[1.02rem] leading-snug sm:text-lg'
                                        : 'text-lg max-[480px]:text-[1.2rem] sm:text-xl'
                                }`}
                            >
                                {isCompactUi ? (
                                    <>
                                        <span className="block">{compactTitleLines.line1}</span>
                                        <span className="mt-0.5 block text-[0.95rem] font-bold text-amber-100/95 sm:text-[1.02rem]">
                                            {compactTitleLines.line2}
                                        </span>
                                    </>
                                ) : (
                                    stageDisplayName
                                )}
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
                                ? 'flex min-h-0 w-full min-w-0 shrink-0 flex-col border-t border-amber-500/25 pt-2 text-center min-[400px]:w-[min(10.25rem,40%)] min-[400px]:border-l min-[400px]:border-t-0 min-[400px]:pl-2 min-[400px]:pt-0'
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
                                        density={onboardingPhase5Active ? 'preGameInline' : 'compact'}
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
                forceTwoColumnPrimary={isCompactUi}
                briefLayout
                onTowerItemZeroClick={
                    canOpenTowerShop
                        ? (slotKey: string) => {
                              const id = towerShopItemIdFromSlotKey(slotKey);
                              setTowerShopInitialItemId(id);
                              setTowerShopOpen(true);
                          }
                        : undefined
                }
                embedOnboardingSpotlightTargets={onboardingPhase5Active || intro11Stage}
                spotlightWinLoseTargetId={intro11Stage ? INTRO11_WINLOSE_TARGET : 'onboarding-sp-pregame-winlose'}
                spotlightRestTargetId={intro11Stage ? 'intro11-pregame-rest' : 'onboarding-sp-pregame-rest'}
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
            {canOpenStageEditor && (
                <Button
                    onClick={() => setEditorOpen(true)}
                    colorScheme="gray"
                    className={compact ? '!flex-1 basis-0 min-w-0 min-h-[3rem] px-5 py-2.5 text-base max-[480px]:px-4' : `!w-auto shrink-0 text-base ${desktopBtnTight}`}
                >
                    스테이지 편집
                </Button>
            )}
            {onClose && !onboardingPregameFinalSubStep && (
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
                data-onboarding-target={
                    onboardingPregameFinalSubStep || (intro11Stage && isIntro11TutorialOpen && intro11TutorialStep === 1)
                        ? (intro11Stage ? INTRO11_START_TARGET : 'onboarding-sp-game-start')
                        : undefined
                }
                onClick={() => {
                    if (intro11Stage && isIntro11TutorialOpen && intro11TutorialStep === 0) return;
                    if (intro11Stage && isIntro11TutorialOpen) {
                        activateIntro11TutorialForGame(session.id);
                    }
                    onStart?.();
                }}
                colorScheme="accent"
                disabled={!onStart || (intro11Stage && isIntro11TutorialOpen && intro11TutorialStep === 0)}
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
            {intro11Stage && isAdminUser && (
                <button
                    type="button"
                    className="text-[11px] text-amber-200/80 hover:text-amber-100 underline underline-offset-2"
                    onClick={() => setIntro11TutorialStep(0)}
                >
                    튜토리얼2
                </button>
            )}
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

    return (
        <DraggableWindow
            title={`${stageDisplayName} - 게임 설명`}
            titleContent={
                isCompactUi ? (
                    <span className="flex min-w-0 flex-col items-start gap-0 leading-tight">
                        <span className="text-[0.95rem] font-black tracking-tight text-amber-50 sm:text-base">{compactTitleLines.line1}</span>
                        <span className="text-[0.82rem] font-bold text-amber-200/90 sm:text-[0.88rem]">{compactTitleLines.line2}</span>
                        <span className="mt-0.5 text-[0.68rem] font-semibold text-amber-100/70">게임 설명</span>
                    </span>
                ) : undefined
            }
            windowId="game-description-modal"
            onClose={onboardingPregameFinalSubStep ? undefined : onClose}
            initialWidth={760}
            initialHeight={isCompactUi ? 2400 : frameHeight}
            modal={true}
            transparentModalBackdrop
            closeOnOutsideClick={onboardingPregameFinalSubStep ? false : !!onClose}
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
            {canOpenStageEditor && (
                <StageDefinitionEditorShell
                    open={editorOpen}
                    scope="singleplayer"
                    stage={stage}
                    swapStageOptions={SINGLE_PLAYER_STAGES}
                    onClose={() => setEditorOpen(false)}
                    onSave={async (nextStage) => {
                        if (!onAction) return;
                        const nextStages = SINGLE_PLAYER_STAGES.map((row) => (row.id === nextStage.id ? nextStage : row));
                        await onAction({
                            type: 'ADMIN_SET_SINGLE_PLAYER_STAGES',
                            payload: { stages: nextStages },
                        } as ServerAction);
                        setSinglePlayerStagesFromServer(nextStages);
                        setEditorOpen(false);
                    }}
                    onSwapStageInfo={async (targetStageId) => {
                        if (!onAction) return;
                        const source = SINGLE_PLAYER_STAGES.find((row) => row.id === stage.id);
                        const target = SINGLE_PLAYER_STAGES.find((row) => row.id === targetStageId);
                        if (!source || !target || source.id === target.id) return;

                        const { id: sourceId, ...sourceRest } = source;
                        const { id: targetId, ...targetRest } = target;
                        const nextStages = SINGLE_PLAYER_STAGES.map((row) => {
                            if (row.id === sourceId) return { id: sourceId, ...targetRest } as SinglePlayerStageInfo;
                            if (row.id === targetId) return { id: targetId, ...sourceRest } as SinglePlayerStageInfo;
                            return row;
                        });

                        await onAction({
                            type: 'ADMIN_SET_SINGLE_PLAYER_STAGES',
                            payload: { stages: nextStages },
                        } as ServerAction);
                        setSinglePlayerStagesFromServer(nextStages);
                    }}
                    onResetAllToDefault={async () => {
                        if (!onAction) return;
                        await onAction({
                            type: 'ADMIN_RESET_SINGLE_PLAYER_STAGES',
                        } as ServerAction);
                    }}
                />
            )}
            {towerShopPortal}
            <div className={`flex min-h-0 flex-col text-white ${isCompactUi ? 'h-full min-h-0 flex-1' : 'shrink-0'}`}>
                {isCompactUi ? (
                    <div
                        className="flex min-h-0 min-w-0 flex-1 flex-col"
                        {...(onboardingPhase5Active ? { 'data-onboarding-target': 'onboarding-sp-pregame-body' } : {})}
                    >
                        <div
                            className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable] ${PRE_GAME_MODAL_LAYER_CLASS}`}
                        >
                            <div>
                                {mainBlocks}
                            </div>
                        </div>
                        <div
                            className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap shrink-0 mt-1.5 rounded-b-2xl border-t border-amber-500/35 !gap-2 px-2 py-2 sm:px-3`}
                        >
                            {footerButtons(true)}
                        </div>
                    </div>
                ) : (
                    <div
                        ref={contentMeasureRef}
                        className={`flex min-h-0 min-w-0 shrink-0 flex-col ${PRE_GAME_MODAL_LAYER_CLASS}`}
                    >
                        <div
                            className="flex min-h-0 min-w-0 flex-1 flex-col"
                            {...(onboardingPhase5Active ? { 'data-onboarding-target': 'onboarding-sp-pregame-body' } : {})}
                        >
                            <div className="min-h-0 shrink-0 overflow-visible overflow-x-hidden pr-0.5">
                                <div>
                                    {mainBlocks}
                                </div>
                            </div>
                            <div
                                className={`${PRE_GAME_MODAL_FOOTER_CLASS} !flex-nowrap mt-1.5 shrink-0 rounded-b-xl !gap-2 !py-2 !px-3 sm:!px-3.5`}
                            >
                                {footerButtons(false)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {intro11Stage &&
                isIntro11TutorialOpen &&
                intro11PortalMount &&
                createPortal(
                    <>
                        {intro11SpotlightRect && (
                            <div className="pointer-events-none absolute inset-0 z-[280]" aria-hidden>
                                <div
                                    className={ONBOARDING_SPOTLIGHT_DIM_LAYER_CLASS}
                                    style={{
                                        WebkitClipPath: spotlightDimClipPathFromPxRect(intro11SpotlightRect),
                                        clipPath: spotlightDimClipPathFromPxRect(intro11SpotlightRect),
                                    }}
                                />
                            </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 z-[281] px-3 pt-2 sm:px-5 sm:pt-3">
                            <div
                                ref={intro11PanelRef}
                                className="pointer-events-auto absolute left-1/2 w-[min(100%,32rem)] rounded-2xl border border-white/18 bg-slate-950/55 p-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md ring-1 ring-inset ring-white/10 sm:p-5"
                                style={
                                    intro11PanelPlacementTop
                                        ? {
                                              top: '1rem',
                                              transform: `translate3d(calc(-50% + ${intro11PanelDragOffset.x}px), ${intro11PanelDragOffset.y}px, 0)`,
                                          }
                                        : {
                                              bottom: '1rem',
                                              transform: `translate3d(calc(-50% + ${intro11PanelDragOffset.x}px), ${intro11PanelDragOffset.y}px, 0)`,
                                          }
                                }
                            >
                                <div
                                    className={`mb-2 flex touch-none select-none items-center justify-center rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-200/80 ${
                                        intro11PanelDragging ? 'cursor-grabbing' : 'cursor-grab'
                                    }`}
                                    onPointerDown={(ev) => {
                                        if (ev.button !== 0) return;
                                        intro11DragPointerIdRef.current = ev.pointerId;
                                        intro11DragOriginRef.current = {
                                            x: ev.clientX,
                                            y: ev.clientY,
                                            offsetX: intro11PanelDragOffset.x,
                                            offsetY: intro11PanelDragOffset.y,
                                        };
                                        setIntro11PanelDragging(true);
                                        ev.currentTarget.setPointerCapture?.(ev.pointerId);
                                    }}
                                    title="드래그하여 위치 이동"
                                >
                                    <span className="h-1.5 w-14 rounded-full bg-white/45" aria-hidden />
                                </div>
                                <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">튜토리얼</p>
                                <h2 className="mt-0.5 text-center text-base font-bold text-stone-50 sm:text-lg">살기기 바둑</h2>
                                {intro11TutorialStep === 0 ? (
                                    <>
                                        <p className="mt-2 text-left text-sm leading-relaxed text-stone-200/95 sm:text-[15px]">
                                            입문반 11스테이지까지 왔군요! 여기부터 승리 목표가 달라집니다. 승리조건과 패배조건을 잘 확인해야합니다. 이 스테이지는 살리기 바둑으로 제한 턴동안 상대방이 목표점수를 만들지 못하게 내 돌을 지키는 스테이지입니다.
                                        </p>
                                        <div className="mt-3 flex justify-end gap-2 border-t border-white/10 pt-3 sm:mt-4 sm:pt-4">
                                            <Button
                                                type="button"
                                                colorScheme="accent"
                                                onClick={() => setIntro11TutorialStep(1)}
                                                className="min-h-9 px-4 text-sm"
                                            >
                                                다음
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="mt-2 text-left text-sm leading-relaxed text-stone-200/95 sm:text-[15px]">
                                        이제 시작하기 버튼을 눌러 내 돌을 지켜보세요
                                    </p>
                                )}
                            </div>
                        </div>
                    </>,
                    intro11PortalMount,
                )}
        </DraggableWindow>
    );
};

export default SinglePlayerGameDescriptionModal;
