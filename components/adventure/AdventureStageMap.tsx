import React, { useLayoutEffect, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    ADVENTURE_CODEX_CHAPTER_UI,
    ADVENTURE_MAP_THEMES,
    ADVENTURE_MONSTER_MODE_BADGE_SHORT,
    ADVENTURE_MONSTER_MODE_LABELS,
    ADVENTURE_STAGES,
    adventureBattleModeToGameMode,
    getAdventureUnderstandingTierFromXp,
    getAdventureStageById,
    getAdventureStageLevelRange,
    type AdventureStageId,
} from '../../constants/adventureConstants.js';
import { getAdventureMonsterAttackActionPointCost, isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    formatAdventureBattleQuickLines,
    getAdventureAllowedBattleModes,
    resolveAdventureBoardSize,
} from '../../shared/utils/adventureBattleBoard.js';
import { AdventureMonsterSpriteFrame } from './AdventureMonsterSprite.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import {
    getAdventureChapterUnlockBlockers,
    isAdventureStageUnlocked,
    type AdventureChapterUnlockContext,
} from '../../utils/adventureChapterUnlock.js';
import Button from '../Button.js';
import { GameMode } from '../../shared/types/enums.js';
import {
    adventureMapMsUntilNextAppearance,
    adventureMapSuppressKey,
    buildAdventureMapMonstersFromSchedule,
    type AdventureMapMonsterInstance,
} from '../../shared/utils/adventureMapSchedule.js';
import {
    getRegionalMapMonsterDwellMultiplierForStage,
    getRegionalMapMonsterRespawnOffMultiplierForStage,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import AdventureChapterMonsterSituationList from './AdventureChapterMonsterSituationList.js';
import AdventureChapterRewardHints from './AdventureChapterRewardHints.js';
import AdventureChapterKeyPanel from './AdventureChapterKeyPanel.js';
import AdventureTreasureChestPickModal from './AdventureTreasureChestPickModal.js';
import AdventureTreasureChestInfoPanel from './AdventureTreasureChestInfoPanel.js';
import {
    ADVENTURE_MAP_TREASURE_UI_ROW_ID,
    adventureTreasureChestEquipmentImageForStageIndex,
    adventureTreasureChestHandledForCurrentWindow,
    buildAdventureMapTreasureChest,
    getAdventureTreasureChestWindowMeta,
    type AdventureMapTreasureChestInstance,
} from '../../shared/utils/adventureMapTreasureSchedule.js';
import {
    getAdventureTreasureUserRewardSections,
    type AdventureTreasureRollResult,
} from '../../shared/utils/adventureMapTreasureRewards.js';
import { labelRegionalSpecialtyBuffEntry, migrateRegionalBuffEntry } from '../../utils/adventureRegionalSpecialtyBuff.js';
import type { AdventureRegionalSpecialtyBuffEntry } from '../../types/entities.js';
import { formatAdventureUnderstandingTierLabel } from '../../utils/adventureUnderstanding.js';
import { isClientAdmin } from '../../utils/clientAdmin.js';
import {
    getAdventureCodexComprehensionBarProgress,
    getAdventureCodexComprehensionLevel,
} from '../../utils/adventureCodexComprehension.js';

type Props = { stageId: string };


type AdventureStageDef = NonNullable<ReturnType<typeof getAdventureStageById>>;

type AdventureMapMonsterPanelDetails = {
    boardSize: number;
    quickLines: string[];
    apCost: number;
    codexRow: AdventureStageDef['monsters'][number] | undefined;
    chapterUi: (typeof ADVENTURE_CODEX_CHAPTER_UI)[AdventureStageId];
    isBoss: boolean;
};

function buildAdventureMapMonsterDetails(stage: AdventureStageDef, m: MapMonster): AdventureMapMonsterPanelDetails {
    const { min, max } = getAdventureStageLevelRange(stage.stageIndex);
    const boardSize = resolveAdventureBoardSize(stage.id, m.codexId, m.id, {
        monsterLevel: m.level,
        chapterLevelMin: min,
        chapterLevelMax: max,
    });
    const gameMode = adventureBattleModeToGameMode(m.mode);
    const quickLines = formatAdventureBattleQuickLines(boardSize, gameMode);
    const apCost = getAdventureMonsterAttackActionPointCost(stage.stageIndex, m.codexId);
    const codexRow = stage.monsters.find((e) => e.codexId === m.codexId);
    const chapterUi = ADVENTURE_CODEX_CHAPTER_UI[stage.id as AdventureStageId];
    const isBoss = isAdventureChapterBossCodexId(m.codexId);
    return { boardSize, quickLines, apCost, codexRow, chapterUi, isBoss };
}

type MapMonster = AdventureMapMonsterInstance;

function formatRemainMs(ms: number): string {
    if (ms <= 0) return '0초';
    const sec = Math.ceil(ms / 1000);
    if (sec < 90) return `${sec}초`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}분${s > 0 ? ` ${s}초` : ''}`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}시간 ${mm}분`;
}

const BUBBLE_VIEWPORT_PAD_PX = 8;
const BUBBLE_GAP_FROM_ANCHOR_PX = 10;

/**
 * 몬스터 앵커(맵 % 좌표 = 스프라이트 하단 중앙 근처) 기준으로 말풍선을 두되,
 * 맵 카드(overflow hidden) 안에 들어가도록 좌우·위아래 방향을 바꾼 뒤 클램프.
 */
function computeAdventureMonsterBubblePosition(
    vpW: number,
    vpH: number,
    xPct: number,
    yPct: number,
    bubbleW: number,
    bubbleH: number,
): { left: number; top: number } {
    const pad = BUBBLE_VIEWPORT_PAD_PX;
    const g = BUBBLE_GAP_FROM_ANCHOR_PX;
    const ax = (vpW * xPct) / 100;
    const ay = (vpH * yPct) / 100;

    let top: number;
    const preferBelow = yPct < 34;
    if (preferBelow) {
        top = ay + g;
        if (top + bubbleH > vpH - pad) top = ay - g - bubbleH;
    } else {
        top = ay - g - bubbleH;
        if (top < pad) top = ay + g;
    }
    top = Math.max(pad, Math.min(top, vpH - bubbleH - pad));

    let left: number;
    const preferRight = xPct <= 66;
    if (preferRight) {
        left = ax + g;
        if (left + bubbleW > vpW - pad) left = ax - g - bubbleW;
    } else {
        left = ax - g - bubbleW;
        if (left < pad) left = ax + g;
    }
    left = Math.max(pad, Math.min(left, vpW - bubbleW - pad));

    return { left, top };
}

const ChapterLockGlyph: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
    </svg>
);

type AdventureStageRow = (typeof ADVENTURE_STAGES)[number];

const chapterHopDiscSize = {
    mobile: 'h-8 w-8 min-h-8 min-w-8 sm:h-9 sm:w-9 sm:min-h-9 sm:min-w-9',
    desktop: 'h-9 w-9 min-h-9 min-w-9 sm:h-10 sm:w-10 sm:min-h-10 sm:min-w-10',
} as const;

const chapterHopDiscShell =
    'flex shrink-0 items-center justify-center rounded-full border shadow-[0_2px_10px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-inset transition-all duration-200 ease-out';

const AdventureMapChapterHopButton: React.FC<{
    target: AdventureStageRow | null;
    direction: 'prev' | 'next';
    chapterUnlockCtx: AdventureChapterUnlockContext;
    variant: 'mobile' | 'desktop';
}> = ({ target, direction, chapterUnlockCtx, variant }) => {
    const sizeClass = chapterHopDiscSize[variant];
    if (!target) {
        return <div className={`shrink-0 ${sizeClass}`} aria-hidden />;
    }
    const unlocked = isAdventureStageUnlocked(target.id, chapterUnlockCtx);
    const blockers = getAdventureChapterUnlockBlockers(target.stageIndex, chapterUnlockCtx);
    const lockTitle = blockers.length ? blockers.join(' · ') : '잠금';
    const navLabel = direction === 'prev' ? '이전 챕터' : '다음 챕터';
    const chevron = (
        <svg
            className="h-[1.05rem] w-[1.05rem] text-amber-100 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)] sm:h-[1.15rem] sm:w-[1.15rem]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
        >
            {direction === 'prev' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            )}
        </svg>
    );
    const discBase = `${chapterHopDiscShell} ${sizeClass} active:scale-[0.94]`;
    if (!unlocked) {
        return (
            <button
                type="button"
                disabled
                title={lockTitle}
                aria-label={`${navLabel} 잠금`}
                className={`${discBase} cursor-not-allowed border-zinc-600/50 bg-gradient-to-b from-zinc-800/55 via-zinc-900/85 to-black/90 ring-zinc-500/10 opacity-90`}
            >
                <ChapterLockGlyph className="h-[0.95rem] w-[0.95rem] text-zinc-400 sm:h-4 sm:w-4" />
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={() => replaceAppHash(`#/adventure/${target.id}`)}
            title={`「${target.title}」로 이동`}
            aria-label={`${navLabel}: ${target.title}`}
            className={`${discBase} border-amber-400/35 bg-gradient-to-b from-amber-950/75 via-zinc-900/92 to-zinc-950/95 ring-amber-300/20 hover:border-amber-300/55 hover:from-amber-900/88 hover:via-zinc-800/95 hover:shadow-[0_4px_18px_rgba(251,191,36,0.18),inset_0_1px_0_rgba(255,255,255,0.14)] hover:ring-amber-200/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/50`}
        >
            {chevron}
        </button>
    );
};

const AdventureStageMap: React.FC<Props> = ({ stageId }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus, handlers } = useAppContext();
    const stage = getAdventureStageById(stageId);
    const theme = stage ? ADVENTURE_MAP_THEMES[stage.id as AdventureStageId] : null;

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [, setUiTick] = useState(0);
    const [panelSecondTick, setPanelSecondTick] = useState(0);
    const [rosterModalCodexId, setRosterModalCodexId] = useState<string | null>(null);
    const [regionalEffectModalOpen, setRegionalEffectModalOpen] = useState(false);
    const [treasurePickModal, setTreasurePickModal] = useState<null | {
        rolls: [AdventureTreasureRollResult, AdventureTreasureRollResult, AdventureTreasureRollResult];
        nonce: string;
        pickSlots: 1 | 2;
        equipmentBoxImage: string;
    }>(null);
    const [mapBox, setMapBox] = useState({ w: 0, h: 0 });
    /** 말풍선이 잘리지 않게 클램프할 맵 카드(overflow hidden) */
    const mapViewportRef = useRef<HTMLDivElement>(null);
    const monsterBubbleRef = useRef<HTMLDivElement>(null);
    /** 데스크톱: 지역 열쇠 패널 높이를 획득 가능 보상 패널과 동일하게 맞춤 */
    const desktopRewardBandRef = useRef<HTMLDivElement>(null);
    const [desktopKeyPanelHeightPx, setDesktopKeyPanelHeightPx] = useState<number | null>(null);
    const [desktopRewardWidthPx, setDesktopRewardWidthPx] = useState<number | null>(null);
    const [monsterBubblePos, setMonsterBubblePos] = useState<{ left: number; top: number } | null>(null);

    const suppressJson = useMemo(
        () => JSON.stringify(currentUserWithStatus?.adventureProfile?.adventureMapSuppressUntilByKey ?? {}),
        [currentUserWithStatus?.adventureProfile?.adventureMapSuppressUntilByKey],
    );

    const suppressRecord = useMemo(() => JSON.parse(suppressJson) as Record<string, number>, [suppressJson]);

    useLayoutEffect(() => {
        if (isNativeMobile) {
            setDesktopKeyPanelHeightPx(null);
            setDesktopRewardWidthPx(null);
            return;
        }
        const el = desktopRewardBandRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            return;
        }
        const sync = () => {
            const r = el.getBoundingClientRect();
            setDesktopKeyPanelHeightPx(Math.round(r.height));
            setDesktopRewardWidthPx(Math.round(r.width));
        };
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isNativeMobile, stage?.id]);

    const mapDwellMult = useMemo(
        () =>
            stage
                ? getRegionalMapMonsterDwellMultiplierForStage(currentUserWithStatus?.adventureProfile, stage.id)
                : 1,
        [currentUserWithStatus?.adventureProfile, stage?.id],
    );
    const mapRespawnOffMult = useMemo(
        () =>
            stage
                ? getRegionalMapMonsterRespawnOffMultiplierForStage(currentUserWithStatus?.adventureProfile, stage.id)
                : 1,
        [currentUserWithStatus?.adventureProfile, stage?.id],
    );

    const stageRegionalBuffEntries: AdventureRegionalSpecialtyBuffEntry[] = stage
        ? (currentUserWithStatus?.adventureProfile?.regionalSpecialtyBuffsByStageId?.[stage.id] ?? [])
              .filter(
                  (entry): entry is NonNullable<typeof entry> =>
                      entry != null &&
                      typeof entry === 'object' &&
                      String((entry as { kind?: unknown }).kind ?? '').trim() !== '',
              )
              .map((entry) => migrateRegionalBuffEntry(entry as Partial<AdventureRegionalSpecialtyBuffEntry>))
        : [];
    const stageUnderstandingXp = stage
        ? Math.max(0, Math.floor(currentUserWithStatus?.adventureProfile?.understandingXpByStage?.[stage.id] ?? 0))
        : 0;
    const stageUnderstandingTierLabel = formatAdventureUnderstandingTierLabel(
        getAdventureUnderstandingTierFromXp(stageUnderstandingXp),
    );

    const monsters = useMemo(() => {
        if (!stage) return [];
        return buildAdventureMapMonstersFromSchedule(stage, Date.now(), suppressRecord, mapDwellMult, mapRespawnOffMult);
    }, [stage, suppressRecord, panelSecondTick, mapDwellMult, mapRespawnOffMult]);

    const treasure = useMemo(() => {
        if (!stage) return null;
        const tNow = Date.now();
        if (
            adventureTreasureChestHandledForCurrentWindow(
                stage.id,
                tNow,
                currentUserWithStatus?.adventureProfile?.adventureMapTreasureDismissedWindowStartByStageId,
                currentUserWithStatus?.adventureProfile?.adventureMapTreasureClaimedWindowStartByStageId,
            )
        ) {
            return null;
        }
        return buildAdventureMapTreasureChest(stage.id, stage.stageIndex, tNow, monsters, {
            mapPositionUserId: currentUserWithStatus?.id,
        });
    }, [
        stage,
        monsters,
        panelSecondTick,
        currentUserWithStatus?.id,
        currentUserWithStatus?.adventureProfile?.adventureMapTreasureDismissedWindowStartByStageId,
        currentUserWithStatus?.adventureProfile?.adventureMapTreasureClaimedWindowStartByStageId,
    ]);

    const chapterUnlockCtx: AdventureChapterUnlockContext = useMemo(
        () => ({
            strategyLevel: Number(currentUserWithStatus?.strategyLevel ?? 0) || 0,
            isAdmin: !!currentUserWithStatus?.isAdmin,
            understandingXpByStage: currentUserWithStatus?.adventureProfile?.understandingXpByStage,
        }),
        [
            currentUserWithStatus?.strategyLevel,
            currentUserWithStatus?.isAdmin,
            currentUserWithStatus?.adventureProfile?.understandingXpByStage,
        ],
    );
    const stageUnlocked = stage ? isAdventureStageUnlocked(stage.id, chapterUnlockCtx) : false;

    const adjacentChapters = useMemo(() => {
        const st = getAdventureStageById(stageId);
        if (!st) return { prev: null as AdventureStageRow | null, next: null as AdventureStageRow | null };
        const idx = ADVENTURE_STAGES.findIndex((s) => s.id === st.id);
        const prev = idx > 0 ? ADVENTURE_STAGES[idx - 1]! : null;
        const next = idx >= 0 && idx < ADVENTURE_STAGES.length - 1 ? ADVENTURE_STAGES[idx + 1]! : null;
        return { prev, next };
    }, [stageId]);

    useLayoutEffect(() => {
        if (!stage || !theme) replaceAppHash('#/adventure');
    }, [stage, theme]);

    useLayoutEffect(() => {
        if (!stage || !theme) return;
        if (!currentUserWithStatus) return;
        if (!isAdventureStageUnlocked(stage.id, chapterUnlockCtx)) replaceAppHash('#/adventure');
    }, [stage, theme, currentUserWithStatus, chapterUnlockCtx]);

    useEffect(() => {
        if (!stage) return;
        setSelectedId(null);
        setRosterModalCodexId(null);
    }, [stage?.id]);

    /** 해시는 #/game/인데 currentRoute가 아직 모험맵인 짧은 구간에 body 포털 시트가 남지 않도록 함 */
    useEffect(() => {
        const closeAdventureOverlaysForGameHash = () => {
            if (!window.location.hash.startsWith('#/game/')) return;
            setSelectedId(null);
            setRosterModalCodexId(null);
        };
        window.addEventListener('hashchange', closeAdventureOverlaysForGameHash);
        return () => window.removeEventListener('hashchange', closeAdventureOverlaysForGameHash);
    }, []);

    useLayoutEffect(() => {
        if (!isNativeMobile || !stage) {
            setMapBox({ w: 0, h: 0 });
            return;
        }
        const el = mapViewportRef.current;
        if (!el) return;
        const measure = () => setMapBox({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isNativeMobile, stage?.id]);

    useEffect(() => {
        const id = window.setInterval(() => setPanelSecondTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        const id = window.setInterval(() => setUiTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [selectedId]);

    useEffect(() => {
        if (!selectedId || !treasure || selectedId !== treasure.id) return;
        if (Date.now() >= treasure.windowEndMs) setSelectedId(null);
    }, [selectedId, treasure, panelSecondTick]);

    useEffect(() => {
        if (treasure) return;
        if (selectedId?.startsWith('adv-treasure-')) setSelectedId(null);
    }, [treasure, selectedId]);

    const selectedMonster = selectedId ? monsters.find((m) => m.id === selectedId) : undefined;
    const selectedTreasure: AdventureMapTreasureChestInstance | undefined =
        treasure && selectedId === treasure.id ? treasure : undefined;
    const selectedMonsterCodexWins = selectedMonster
        ? Math.max(0, Math.floor(currentUserWithStatus?.adventureProfile?.codexDefeatCounts?.[selectedMonster.codexId] ?? 0))
        : 0;
    const selectedMonsterComprehensionLevel = getAdventureCodexComprehensionLevel(selectedMonsterCodexWins);
    const selectedMonsterComprehensionProgress = getAdventureCodexComprehensionBarProgress(
        selectedMonsterCodexWins,
        selectedMonsterComprehensionLevel,
    );
    const selectedMonsterComprehensionProgressPct = Math.round(
        Math.min(1, Math.max(0, selectedMonsterComprehensionProgress.prog)) * 100,
    );

    const now = Date.now();
    const treasureHandledForWindow =
        !!stage &&
        adventureTreasureChestHandledForCurrentWindow(
            stage.id,
            now,
            currentUserWithStatus?.adventureProfile?.adventureMapTreasureDismissedWindowStartByStageId,
            currentUserWithStatus?.adventureProfile?.adventureMapTreasureClaimedWindowStartByStageId,
        );
    const treasureHandledKind: 'claimed' | 'dismissed' | null = (() => {
        if (!stage) return null;
        const wm = getAdventureTreasureChestWindowMeta(stage.id, now);
        if (!wm) return null;
        const ws = wm.windowStartMs;
        if (currentUserWithStatus?.adventureProfile?.adventureMapTreasureClaimedWindowStartByStageId?.[stage.id] === ws) {
            return 'claimed';
        }
        if (currentUserWithStatus?.adventureProfile?.adventureMapTreasureDismissedWindowStartByStageId?.[stage.id] === ws) {
            return 'dismissed';
        }
        return null;
    })();

    const selectionDetails = useMemo(() => {
        if (!selectedMonster || !stage) return null;
        return buildAdventureMapMonsterDetails(stage, selectedMonster);
    }, [selectedMonster, stage]);

    const treasureRewardSections = useMemo(() => {
        if (!stage) return null;
        return getAdventureTreasureUserRewardSections(stage.stageIndex);
    }, [stage]);

    const bubbleAnchor = useMemo(() => {
        if (selectedMonster) return { xPct: selectedMonster.xPct, yPct: selectedMonster.yPct };
        if (selectedTreasure) return { xPct: selectedTreasure.xPct, yPct: selectedTreasure.yPct };
        return null;
    }, [selectedMonster, selectedTreasure]);

    const syncMonsterBubblePos = useCallback(() => {
        if (isNativeMobile) {
            setMonsterBubblePos(null);
            return;
        }
        if (!bubbleAnchor || !mapViewportRef.current || !monsterBubbleRef.current) {
            setMonsterBubblePos(null);
            return;
        }
        if (selectedMonster && !selectionDetails) {
            setMonsterBubblePos(null);
            return;
        }
        const vp = mapViewportRef.current;
        const vpW = vp.clientWidth;
        const vpH = vp.clientHeight;
        if (vpW <= 0 || vpH <= 0) return;
        const br = monsterBubbleRef.current.getBoundingClientRect();
        setMonsterBubblePos(
            computeAdventureMonsterBubblePosition(
                vpW,
                vpH,
                bubbleAnchor.xPct,
                bubbleAnchor.yPct,
                br.width,
                br.height,
            ),
        );
    }, [isNativeMobile, selectedMonster, selectedTreasure, selectionDetails, bubbleAnchor]);

    useLayoutEffect(() => {
        syncMonsterBubblePos();
    }, [syncMonsterBubblePos]);

    useEffect(() => {
        if (isNativeMobile || (!selectedMonster && !selectedTreasure) || !mapViewportRef.current) return;
        if (selectedMonster && !selectionDetails) return;
        const vp = mapViewportRef.current;
        const ro = new ResizeObserver(() => syncMonsterBubblePos());
        ro.observe(vp);
        window.addEventListener('resize', syncMonsterBubblePos);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', syncMonsterBubblePos);
        };
    }, [isNativeMobile, selectedMonster, selectedTreasure, selectionDetails, syncMonsterBubblePos]);

    useEffect(() => {
        if (!isNativeMobile || !selectedId) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isNativeMobile, selectedId]);

    useEffect(() => {
        if (!isNativeMobile || !selectedId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedId(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isNativeMobile, selectedId]);

    const rosterModalIsTreasure = rosterModalCodexId === ADVENTURE_MAP_TREASURE_UI_ROW_ID;

    const rosterModalRow = useMemo(() => {
        if (!rosterModalCodexId || !stage || rosterModalCodexId === ADVENTURE_MAP_TREASURE_UI_ROW_ID) return null;
        return stage.monsters.find((e) => e.codexId === rosterModalCodexId) ?? null;
    }, [rosterModalCodexId, stage]);

    const rosterModalInstance = useMemo(() => {
        if (!rosterModalCodexId) return undefined;
        return monsters.find((m) => m.codexId === rosterModalCodexId && m.expiresAt > now);
    }, [monsters, rosterModalCodexId, now]);

    const rosterModalInstanceDetails = useMemo(() => {
        if (!rosterModalInstance || !stage) return null;
        return buildAdventureMapMonsterDetails(stage, rosterModalInstance);
    }, [rosterModalInstance, stage]);
    const rosterModalCodexWins = Math.max(
        0,
        Math.floor(
            currentUserWithStatus?.adventureProfile?.codexDefeatCounts?.[
                rosterModalInstance?.codexId ?? rosterModalRow?.codexId ?? ''
            ] ?? 0,
        ),
    );
    const rosterModalComprehensionLevel = getAdventureCodexComprehensionLevel(rosterModalCodexWins);
    const rosterModalComprehensionProgress = getAdventureCodexComprehensionBarProgress(
        rosterModalCodexWins,
        rosterModalComprehensionLevel,
    );
    const rosterModalComprehensionProgressPct = Math.round(
        Math.min(1, Math.max(0, rosterModalComprehensionProgress.prog)) * 100,
    );

    const rosterModalStaticPreview = useMemo(() => {
        if (!rosterModalRow || !stage || rosterModalInstance) return null;
        const { min, max } = getAdventureStageLevelRange(stage.stageIndex);
        const mid = Math.floor((min + max) / 2);
        const isBoss = isAdventureChapterBossCodexId(rosterModalRow.codexId);
        const levelPreview = isBoss ? max : mid;
        const boardSize = resolveAdventureBoardSize(stage.id, rosterModalRow.codexId, `static-${rosterModalRow.codexId}`, {
            monsterLevel: levelPreview,
            chapterLevelMin: min,
            chapterLevelMax: max,
        });
        const quickLinesClassic = formatAdventureBattleQuickLines(boardSize, GameMode.Standard);
        const apCost = getAdventureMonsterAttackActionPointCost(stage.stageIndex, rosterModalRow.codexId);
        const chapterUi = ADVENTURE_CODEX_CHAPTER_UI[stage.id as AdventureStageId];
        const modes = getAdventureAllowedBattleModes(boardSize)
            .map((mode) => ADVENTURE_MONSTER_MODE_LABELS[mode])
            .join(' · ');
        return { min, max, quickLinesClassic, apCost, chapterUi, isBoss, modes };
    }, [rosterModalRow, stage, rosterModalInstance]);

    useEffect(() => {
        if (!rosterModalCodexId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setRosterModalCodexId(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rosterModalCodexId]);

    useEffect(() => {
        if (!selectedId) return;
        if (monsters.some((m) => m.id === selectedId)) return;
        if (treasure && treasure.id === selectedId) return;
        setSelectedId(null);
    }, [monsters, treasure, selectedId, panelSecondTick]);

    const minMsUntilAnyAppearance = useMemo(() => {
        if (!stage) return 0;
        const t = Date.now();
        let minM = Infinity;
        for (const row of stage.monsters) {
            const boss = isAdventureChapterBossCodexId(row.codexId);
            const key = adventureMapSuppressKey(stage.id, row.codexId);
            const m = adventureMapMsUntilNextAppearance(
                t,
                stage.id,
                row.codexId,
                boss,
                suppressRecord[key],
                mapDwellMult,
                mapRespawnOffMult,
            );
            minM = Math.min(minM, m);
        }
        return Number.isFinite(minM) ? minM : 0;
    }, [stage, suppressRecord, panelSecondTick, mapDwellMult, mapRespawnOffMult]);

    const onBack = () => replaceAppHash('#/adventure');

    if (!stage || !theme) {
        return (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">로비로 이동합니다…</div>
        );
    }

    const gridStyle: React.CSSProperties = {
        backgroundImage: `
            linear-gradient(${theme.gridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)
        `,
        backgroundSize: '28px 28px',
    };

    const mobileSpritePx =
        isNativeMobile && mapBox.w > 0 && mapBox.h > 0
            ? Math.max(36, Math.min(Math.round(Math.min(mapBox.w * 0.11, mapBox.h * 0.16)), 78))
            : null;

    const handleStartMonsterBattle = async (target?: MapMonster) => {
        const monster = target ?? selectedMonster;
        if (!monster || !stage) return;
        const result = await handlers.handleAction({
            type: 'START_ADVENTURE_MONSTER_BATTLE',
            payload: {
                codexId: monster.codexId,
                stageId: stage.id,
                battleMode: monster.mode,
                monsterLevel: monster.level,
                mapMonsterId: monster.id,
            },
        });
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            return;
        }
        flushSync(() => {
            setSelectedId(null);
            setRosterModalCodexId(null);
        });
    };

    const handleOpenTreasureChest = async () => {
        if (!stage) return;
        const result = await handlers.handleAction({
            type: 'PREPARE_ADVENTURE_MAP_TREASURE_CHEST',
            payload: { stageId: stage.id },
        });
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            return;
        }
        const r = result as {
            adventureTreasurePick?: {
                rolls: [AdventureTreasureRollResult, AdventureTreasureRollResult, AdventureTreasureRollResult];
                nonce: string;
                pickSlots?: 1 | 2;
                equipmentBoxImage: string;
            };
            clientResponse?: {
                adventureTreasurePick?: {
                    rolls: [AdventureTreasureRollResult, AdventureTreasureRollResult, AdventureTreasureRollResult];
                    nonce: string;
                    pickSlots?: 1 | 2;
                    equipmentBoxImage: string;
                };
            };
        };
        const pick = r?.clientResponse?.adventureTreasurePick ?? r?.adventureTreasurePick;
        if (!pick?.rolls || !pick.nonce || !pick.equipmentBoxImage) return;
        flushSync(() => {
            setSelectedId(null);
            setRosterModalCodexId(null);
        });
        setTreasurePickModal({
            rolls: pick.rolls,
            nonce: pick.nonce,
            pickSlots: pick.pickSlots === 2 ? 2 : 1,
            equipmentBoxImage: pick.equipmentBoxImage,
        });
    };

    const mapKeysHeld = Math.max(
        0,
        Math.floor(currentUserWithStatus?.adventureProfile?.adventureMapKeysHeldByStageId?.[stage.id] ?? 0),
    );
    const treasureOpenBlockedByKeys = !isClientAdmin(currentUserWithStatus) && mapKeysHeld < 1;
    const rosterModalTreasureWindow = rosterModalIsTreasure ? getAdventureTreasureChestWindowMeta(stage.id, now) : null;

    /** 모달·목록 공통: 출현 중 / 다음 절대 출현까지 */
    let rosterModalRightSlot = formatRemainMs(minMsUntilAnyAppearance);
    let rosterModalRightClass = 'font-mono font-bold tabular-nums text-amber-200';
    if (rosterModalIsTreasure) {
        const wm = getAdventureTreasureChestWindowMeta(stage.id, now);
        if (wm && !treasureHandledForWindow) {
            rosterModalRightSlot = '출현중';
            rosterModalRightClass = 'font-bold text-emerald-300';
        } else if (wm && treasureHandledForWindow) {
            rosterModalRightSlot = treasureHandledKind === 'claimed' ? '수령완료' : '건너뜀';
            rosterModalRightClass = 'font-bold text-zinc-400';
        } else {
            rosterModalRightSlot = '알수없음';
            rosterModalRightClass = 'font-bold text-zinc-400';
        }
    } else if (rosterModalRow && stage) {
        const boss = isAdventureChapterBossCodexId(rosterModalRow.codexId);
        const supK = adventureMapSuppressKey(stage.id, rosterModalRow.codexId);
        const until = adventureMapMsUntilNextAppearance(
            now,
            stage.id,
            rosterModalRow.codexId,
            boss,
            suppressRecord[supK],
            mapDwellMult,
            mapRespawnOffMult,
        );
        if (rosterModalInstance) {
            rosterModalRightSlot = '출현중';
            rosterModalRightClass = 'font-bold text-emerald-300';
        } else if (until > 0) {
            rosterModalRightSlot = formatRemainMs(until);
            rosterModalRightClass = 'font-mono font-bold tabular-nums text-amber-200';
        }
    }

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5' : 'h-full min-h-0 overflow-hidden p-2 sm:p-3 lg:p-4'
            }`}
        >
            {isNativeMobile ? (
                <div className="sticky top-0 z-[55] shrink-0 border-b border-amber-500/30 bg-gradient-to-b from-zinc-900/98 via-zinc-950/98 to-zinc-950/95 pb-1.5 pt-0.5 shadow-[0_10px_28px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md">
                    <div className="flex items-center gap-1.5 px-1">
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 active:scale-90"
                            aria-label="스테이지 목록으로"
                        >
                            <img src="/images/button/back.png" alt="" className="h-full w-full" />
                        </button>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
                                <AdventureMapChapterHopButton
                                    target={adjacentChapters.prev}
                                    direction="prev"
                                    chapterUnlockCtx={chapterUnlockCtx}
                                    variant="mobile"
                                />
                                <div className="min-w-0 max-w-[10.5rem] px-0.5 text-left sm:max-w-[min(18rem,42vw)] sm:px-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">모험 맵</p>
                                    <h1 className="truncate text-sm font-black leading-tight text-white drop-shadow">{stage.title}</h1>
                                </div>
                                <AdventureMapChapterHopButton
                                    target={adjacentChapters.next}
                                    direction="next"
                                    chapterUnlockCtx={chapterUnlockCtx}
                                    variant="mobile"
                                />
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
                            <button
                                type="button"
                                onClick={() => setRegionalEffectModalOpen(true)}
                                className="shrink-0 rounded-lg border border-cyan-400/45 bg-cyan-950/70 px-2 py-1.5 text-[10px] font-bold leading-tight text-cyan-100 shadow-sm transition hover:border-amber-400/50 hover:bg-cyan-900/60 active:scale-[0.99]"
                                aria-label="지역효과 보기"
                            >
                                지역효과
                            </button>
                            </div>
                        </div>
                    </div>
                    <div className="mx-1 mt-1.5 flex min-h-0 items-stretch gap-1.5">
                        <aside
                            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-1.5 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md"
                            aria-label="챕터 보상 안내"
                        >
                            <AdventureChapterRewardHints stageId={stage.id as AdventureStageId} compact />
                        </aside>
                        <aside
                            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-1.5 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md"
                            aria-label="지역 열쇠"
                        >
                            <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
                                <AdventureChapterKeyPanel
                                    stageId={stage.id as AdventureStageId}
                                    adventureProfile={currentUserWithStatus?.adventureProfile}
                                    compact
                                />
                            </div>
                        </aside>
                    </div>
                </div>
            ) : (
                <header className="relative z-50 mb-2 flex flex-shrink-0 items-center justify-between px-1 sm:mb-2 sm:px-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 active:scale-90 sm:h-11 sm:w-11"
                        aria-label="스테이지 목록으로"
                    >
                        <img src="/images/button/back.png" alt="" className="h-full w-full" />
                    </button>
                    <div className="flex min-w-0 flex-1 items-center justify-center px-0.5 sm:px-1">
                        <div className="flex max-w-full items-center justify-center gap-1.5 sm:gap-2.5">
                            <AdventureMapChapterHopButton
                                target={adjacentChapters.prev}
                                direction="prev"
                                chapterUnlockCtx={chapterUnlockCtx}
                                variant="desktop"
                            />
                            <div className="min-w-0 max-w-[11rem] px-1 text-center sm:max-w-[min(22rem,48vw)] sm:px-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 sm:text-xs">모험 맵</p>
                                <h1 className="truncate text-base font-black text-white drop-shadow sm:text-lg">{stage.title}</h1>
                            </div>
                            <AdventureMapChapterHopButton
                                target={adjacentChapters.next}
                                direction="next"
                                chapterUnlockCtx={chapterUnlockCtx}
                                variant="desktop"
                            />
                        </div>
                    </div>
                    <div className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" aria-hidden />
                </header>
            )}

            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
                <div
                    ref={mapViewportRef}
                    className={
                        isNativeMobile
                            ? 'relative min-h-[10.5rem] max-h-[min(52dvh,26rem)] flex-1 overflow-hidden rounded-lg border border-amber-500/35 shadow-[0_8px_32px_-10px_rgba(0,0,0,0.82),inset_0_0_0_1px_rgba(255,255,255,0.05)]'
                            : 'relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-amber-500/30 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(255,255,255,0.06)] sm:rounded-2xl'
                    }
                >
                <div className="absolute inset-0 overflow-visible">
                                <button
                                    type="button"
                                    className="absolute inset-0 z-[5] cursor-default bg-transparent"
                                    aria-label="맵 빈 곳"
                                    onClick={() => setSelectedId(null)}
                                />
                                <img
                                    src={stage.mapWebp}
                                    alt=""
                                    className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
                                    draggable={false}
                                />
                                <div
                                    className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/25 via-transparent to-black/45"
                                    aria-hidden
                                />
                                <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.35]" style={gridStyle} />
                                <div
                                    className="pointer-events-none absolute inset-0 z-[1] opacity-40 mix-blend-soft-light"
                                    style={{
                                        background:
                                            'radial-gradient(ellipse 80% 55% at 70% 30%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(ellipse 60% 45% at 20% 75%, rgba(0,0,0,0.4), transparent 50%)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute inset-0 z-[1]"
                                    style={{
                                        background: `linear-gradient(to bottom, ${theme.fog} 0%, transparent 35%, transparent 65%, ${theme.fog} 100%)`,
                                    }}
                                />
                                {monsters.map((m) => {
                                    const sel = m.id === selectedId;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedId(m.id);
                                            }}
                                            className={[
                                                'absolute z-20 flex touch-manipulation select-none flex-col items-center',
                                                '-translate-x-1/2 -translate-y-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-0',
                                                sel ? 'scale-[1.05]' : 'hover:scale-[1.03] active:scale-[0.98]',
                                            ].join(' ')}
                                            style={{ left: `${m.xPct}%`, top: `${m.yPct}%` }}
                                            aria-label={`${m.speciesName} 레벨 ${m.level} ${ADVENTURE_MONSTER_MODE_LABELS[m.mode]}`}
                                        >
                                            <div
                                                className={[
                                                    'flex flex-col items-center rounded-md px-0.5 pb-0.5 pt-0',
                                                    sel ? 'ring-2 ring-amber-400/90 ring-offset-0' : '',
                                                ].join(' ')}
                                            >
                                                <div
                                                    className={[
                                                        'relative flex items-end justify-center',
                                                        mobileSpritePx != null
                                                            ? ''
                                                            : isNativeMobile
                                                              ? 'h-[clamp(2.4rem,9vw,3.4rem)] w-[clamp(2.4rem,9vw,3.4rem)]'
                                                              : 'h-[clamp(4.25rem,17.25vw,6.1rem)] w-[clamp(4.25rem,17.25vw,6.1rem)] sm:h-[6.75rem] sm:w-[6.75rem]',
                                                    ].join(' ')}
                                                    style={
                                                        mobileSpritePx != null
                                                            ? {
                                                                  width: mobileSpritePx,
                                                                  height: mobileSpritePx,
                                                                  minWidth: mobileSpritePx,
                                                                  minHeight: mobileSpritePx,
                                                              }
                                                            : undefined
                                                    }
                                                >
                                                    <AdventureMonsterSpriteFrame
                                                        sheetUrl={m.spriteSheetWebp}
                                                        frameIndex={m.spriteFrameIndex}
                                                        cols={m.spriteCols}
                                                        rows={m.spriteRows}
                                                        softBackdrop
                                                        className="absolute inset-0 z-0 h-full w-full bg-transparent"
                                                    />
                                                    <span
                                                        className={`pointer-events-none absolute right-0 top-0 z-10 rounded bg-violet-950/90 py-px font-mono font-bold leading-none text-fuchsia-100 shadow-sm ${
                                                            isNativeMobile
                                                                ? 'px-0.5 text-[9px] sm:px-1.5 sm:py-0.5 sm:text-sm'
                                                                : 'px-1 text-xs sm:px-1.5 sm:py-0.5 sm:text-sm'
                                                        }`}
                                                        title={ADVENTURE_MONSTER_MODE_LABELS[m.mode]}
                                                    >
                                                        {ADVENTURE_MONSTER_MODE_BADGE_SHORT[m.mode]}
                                                    </span>
                                                </div>
                                                <p
                                                    className={`mt-1 flex items-center justify-center gap-1.5 whitespace-nowrap text-center font-bold leading-tight text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                                                        isNativeMobile
                                                            ? 'max-w-[min(42vw,7rem)] gap-1 text-[9px]'
                                                            : 'max-w-[11rem] gap-1.5 text-[11px] sm:max-w-[13rem] sm:gap-2 sm:text-xs'
                                                    }`}
                                                >
                                                    <span className="shrink-0 font-mono font-black text-amber-200">LV{m.level}</span>
                                                    <span className="min-w-0 truncate">{m.speciesName}</span>
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                                {treasure ? (
                                    <button
                                        key={treasure.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedId(treasure.id);
                                        }}
                                        className={[
                                            'absolute z-[21] flex touch-manipulation select-none flex-col items-center',
                                            '-translate-x-1/2 -translate-y-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-0',
                                            treasure.id === selectedId ? 'scale-[1.05]' : 'hover:scale-[1.03] active:scale-[0.98]',
                                        ].join(' ')}
                                        style={{ left: `${treasure.xPct}%`, top: `${treasure.yPct}%` }}
                                        aria-label="보물상자"
                                    >
                                        <div
                                            className={[
                                                'flex flex-col items-center rounded-md px-0.5 pb-0.5 pt-0',
                                                treasure.id === selectedId ? 'ring-2 ring-amber-400/90 ring-offset-0' : '',
                                            ].join(' ')}
                                        >
                                            <div
                                                className={[
                                                    'relative flex items-center justify-center',
                                                    mobileSpritePx != null
                                                        ? ''
                                                        : isNativeMobile
                                                          ? 'h-[clamp(2.4rem,9vw,3.4rem)] w-[clamp(2.4rem,9vw,3.4rem)]'
                                                          : 'h-[clamp(4.25rem,17.25vw,6.1rem)] w-[clamp(4.25rem,17.25vw,6.1rem)] sm:h-[6.75rem] sm:w-[6.75rem]',
                                                ].join(' ')}
                                                style={
                                                    mobileSpritePx != null
                                                        ? {
                                                              width: mobileSpritePx,
                                                              height: mobileSpritePx,
                                                              minWidth: mobileSpritePx,
                                                              minHeight: mobileSpritePx,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <img
                                                    src={treasure.equipmentBoxImage}
                                                    alt=""
                                                    className="h-full w-full object-contain drop-shadow"
                                                    draggable={false}
                                                />
                                                {!isNativeMobile ? (
                                                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                                                        <span className="rounded-full border border-white/35 bg-black/55 px-2 py-1 text-base font-black text-white shadow sm:px-2.5 sm:py-1 sm:text-lg">
                                                            ?
                                                        </span>
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p
                                                className={`mt-1 text-center font-bold leading-tight text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                                                    isNativeMobile ? 'text-[9px]' : 'text-[11px] sm:text-xs'
                                                }`}
                                            >
                                                보물상자
                                            </p>
                                        </div>
                                    </button>
                                ) : null}

                                {((selectedMonster && selectionDetails) || (selectedTreasure && treasureRewardSections)) &&
                                    !isNativeMobile && (
                                    <div
                                        ref={monsterBubbleRef}
                                        role="dialog"
                                        aria-label={selectedTreasure ? '보물상자 정보' : '몬스터 정보'}
                                        className={`pointer-events-auto absolute z-40 ${
                                            selectedTreasure
                                                ? 'min-w-[min(100%,20rem)] w-[min(calc(100%-0.75rem),36rem)] max-w-[36rem]'
                                                : 'w-[min(calc(100%-0.75rem),24rem)] max-w-[24rem]'
                                        }`}
                                        style={
                                            monsterBubblePos
                                                ? {
                                                      left: monsterBubblePos.left,
                                                      top: monsterBubblePos.top,
                                                      transform: 'none',
                                                      transformOrigin: 'top left',
                                                  }
                                                : bubbleAnchor
                                                  ? {
                                                        left: `calc(${bubbleAnchor.xPct}% + 2.65rem)`,
                                                        top: `${bubbleAnchor.yPct}%`,
                                                        transform:
                                                            bubbleAnchor.yPct < 28
                                                                ? 'translateY(0.5rem)'
                                                                : 'translateY(calc(-100% - 0.5rem))',
                                                        transformOrigin: 'top left',
                                                    }
                                                  : undefined
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="relative rounded-2xl border border-amber-400/55 bg-zinc-950 shadow-[0_20px_56px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                                            {selectedMonster && selectionDetails ? (
                                            <div className="relative flex flex-col gap-3.5 p-3.5 sm:flex-row sm:items-start sm:gap-4 sm:p-4">
                                                <div
                                                    className={[
                                                        'mx-auto flex w-[7.5rem] shrink-0 flex-col self-start overflow-hidden rounded-xl border-[3px] border-amber-400/60 bg-white shadow-md sm:mx-0 sm:w-[8.25rem]',
                                                    ].join(' ')}
                                                >
                                                    <div
                                                        className={`flex min-h-[2.35rem] shrink-0 flex-col items-center justify-center gap-0.5 bg-gradient-to-b px-2 py-1.5 ${selectionDetails.chapterUi.nameBarClass}`}
                                                    >
                                                        <p className="line-clamp-2 text-center text-xs font-black leading-tight tracking-wide text-amber-50 [text-shadow:0_0_8px_rgba(0,0,0,0.85),0_1px_0_rgba(0,0,0,0.9)] sm:text-[13px]">
                                                            {selectionDetails.codexRow?.name ?? selectedMonster.speciesName}
                                                        </p>
                                                        {selectionDetails.isBoss ? (
                                                            <span className="rounded border border-amber-400/40 bg-black/50 px-1 py-px text-[8px] font-black uppercase tracking-wider text-amber-100">
                                                                보스
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-white p-2">
                                                        <AdventureMonsterSpriteFrame
                                                            sheetUrl={selectedMonster.spriteSheetWebp}
                                                            frameIndex={selectedMonster.spriteFrameIndex}
                                                            cols={selectedMonster.spriteCols}
                                                            rows={selectedMonster.spriteRows}
                                                            softBackdrop
                                                            className="h-full w-full max-h-full max-w-full bg-transparent"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex min-w-0 flex-1 flex-col gap-3">
                                                    <div className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 sm:px-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-xs font-bold text-zinc-400">대국</span>
                                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                                <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-black tabular-nums text-amber-50">
                                                                    LV{selectedMonster.level}
                                                                </span>
                                                                <span className="text-sm font-bold text-fuchsia-200">
                                                                    {ADVENTURE_MONSTER_MODE_LABELS[selectedMonster.mode]}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-white/10 pt-2">
                                                            <span className="shrink-0 text-xs font-semibold text-zinc-500">남은 시간</span>
                                                            <span className="text-right font-mono text-sm font-bold tabular-nums text-amber-200">
                                                                {formatRemainMs(selectedMonster.expiresAt - now)}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 border-t border-white/10 pt-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="shrink-0 text-xs font-semibold text-zinc-500">이해도 레벨</span>
                                                                <span className="font-mono text-sm font-bold tabular-nums text-cyan-200">
                                                                    Lv.{selectedMonsterComprehensionLevel}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                                                <span className="shrink-0 text-xs font-semibold text-zinc-500">이해도 경험치</span>
                                                                <span className="font-mono text-xs font-bold tabular-nums text-zinc-300">
                                                                    {selectedMonsterComprehensionProgress.nextAt != null
                                                                        ? `${selectedMonsterCodexWins}/${selectedMonsterComprehensionProgress.nextAt}`
                                                                        : `최대 · ${selectedMonsterCodexWins}`}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800/95 ring-1 ring-inset ring-black/40">
                                                                <div
                                                                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-400 transition-all duration-500"
                                                                    style={{
                                                                        width: `${selectedMonsterComprehensionProgress.nextAt == null ? 100 : selectedMonsterComprehensionProgressPct}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ul className="space-y-1.5 text-[13px] font-medium leading-snug text-zinc-100 sm:text-sm">
                                                        {selectionDetails.quickLines.map((line, i) => (
                                                            <li key={`${i}-${line}`} className="border-b border-white/[0.06] pb-1.5 last:border-0 last:pb-0">
                                                                {line}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <Button
                                                        type="button"
                                                        bare
                                                        onClick={() => void handleStartMonsterBattle()}
                                                        title={`행동력 ${selectionDetails.apCost}`}
                                                        className="group relative mt-auto w-full overflow-hidden rounded-xl border border-amber-400/55 bg-gradient-to-b from-amber-500/[0.22] via-amber-600/[0.14] to-zinc-900/80 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all duration-200 hover:border-amber-300/70 hover:from-amber-400/[0.28] hover:shadow-[0_14px_36px_rgba(251,191,36,0.14)] active:translate-y-px active:shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:px-4 sm:py-3.5"
                                                    >
                                                        <span
                                                            aria-hidden
                                                            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                                        />
                                                        <span className="relative z-[1] flex w-full items-center justify-between gap-3">
                                                            <span className="text-left text-sm font-black tracking-wide text-amber-50 drop-shadow-sm sm:text-[0.95rem]">
                                                                공격하기
                                                            </span>
                                                            <span className="flex items-center gap-1 rounded-lg border border-amber-300/25 bg-black/40 px-2.5 py-1 text-base font-black tabular-nums text-amber-100 shadow-inner sm:px-3 sm:text-lg">
                                                                <span aria-hidden>⚡</span>
                                                                <span>{selectionDetails.apCost}</span>
                                                            </span>
                                                        </span>
                                                    </Button>
                                                </div>
                                            </div>
                                            ) : selectedTreasure && treasureRewardSections ? (
                                                <div className="p-4 sm:p-5">
                                                    <AdventureTreasureChestInfoPanel
                                                        stageTitle={stage.title}
                                                        showInlineTitle
                                                        equipmentBoxImage={selectedTreasure.equipmentBoxImage}
                                                        remainingLabel={formatRemainMs(Math.max(0, selectedTreasure.windowEndMs - now))}
                                                        mapKeysHeld={mapKeysHeld}
                                                        sections={treasureRewardSections}
                                                        onOpen={handleOpenTreasureChest}
                                                        openDisabled={
                                                            treasureOpenBlockedByKeys ||
                                                            treasureHandledForWindow ||
                                                            now >= selectedTreasure.windowEndMs
                                                        }
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )}
                </div>

                {!isNativeMobile ? (
                    <div className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 z-30 flex w-max max-w-[min(96vw,32rem)] flex-col sm:bottom-2 sm:left-2 sm:top-2">
                        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col items-start gap-2">
                            <div className="flex shrink-0 gap-2">
                                <aside
                                    ref={desktopRewardBandRef}
                                    className="shrink-0 rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-3 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:p-3.5"
                                    aria-label="챕터 보상 안내"
                                >
                                    <AdventureChapterRewardHints stageId={stage.id as AdventureStageId} iconLayout="wrap" />
                                </aside>
                                <aside
                                    className="flex min-h-0 w-[10rem] shrink-0 flex-col overflow-x-hidden overflow-y-hidden rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-3 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:w-[11.25rem] sm:p-3.5"
                                    style={
                                        desktopKeyPanelHeightPx != null
                                            ? {
                                                  height: desktopKeyPanelHeightPx,
                                                  minHeight: desktopKeyPanelHeightPx,
                                                  maxHeight: desktopKeyPanelHeightPx,
                                              }
                                            : undefined
                                    }
                                    aria-label="지역 열쇠"
                                >
                                    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
                                        <AdventureChapterKeyPanel
                                            stageId={stage.id as AdventureStageId}
                                            adventureProfile={currentUserWithStatus?.adventureProfile}
                                            compact
                                        />
                                    </div>
                                </aside>
                            </div>
                            <aside
                                className={`flex min-h-0 min-w-0 max-w-full flex-1 flex-col self-start overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm ${
                                    desktopRewardWidthPx == null ? 'max-w-[18.5rem]' : ''
                                }`}
                                style={desktopRewardWidthPx != null ? { width: desktopRewardWidthPx, maxWidth: '100%' } : undefined}
                                aria-label="챕터 몬스터 목록"
                            >
                                <div className="flex shrink-0 items-center justify-center border-b border-white/10 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                    <p className="min-w-0 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-400/90 sm:text-xs">
                                        챕터 몬스터
                                    </p>
                                </div>
                                <div
                                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-3 pt-1 sm:px-3 sm:pb-3.5 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.5)_rgba(24,24,27,0.5)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/80 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-500/45 hover:[&::-webkit-scrollbar-thumb]:bg-amber-400/55"
                                >
                                    <AdventureChapterMonsterSituationList
                                        stageId={stage.id}
                                        mapMonsters={monsters}
                                        suppressRecord={suppressRecord}
                                        nowMs={now}
                                        onPickRow={(id) => setRosterModalCodexId(id)}
                                        mapDwellMultiplier={mapDwellMult}
                                        mapRespawnOffMultiplier={mapRespawnOffMult}
                                        treasureHandledForCurrentWindow={treasureHandledForWindow}
                                        treasureHandledKind={treasureHandledKind}
                                    />
                                </div>
                            </aside>
                        </div>
                    </div>
                ) : null}
                {!isNativeMobile ? (
                    <div className="pointer-events-none absolute right-1.5 top-1.5 z-30 w-[min(88vw,17.5rem)] sm:right-2 sm:top-2 sm:w-[18.5rem]">
                        <aside
                            className="pointer-events-auto rounded-xl border border-cyan-500/35 bg-zinc-950/92 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                            aria-label="지역 탐험도 효과"
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300/90 sm:text-xs">지역 탐험도</p>
                                <span className="rounded-md border border-cyan-400/30 bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-100 sm:text-xs">
                                    {stageUnderstandingTierLabel}
                                </span>
                            </div>
                            <p className="mt-1.5 text-[10px] font-mono tabular-nums text-zinc-400 sm:text-[11px]">
                                XP {stageUnderstandingXp.toLocaleString()}
                            </p>
                            <ul className="mt-2 space-y-1.5">
                                {!stageUnlocked ? (
                                    <li className="rounded-md border border-white/8 bg-black/25 px-2 py-1.5 text-[11px] font-semibold text-zinc-300 sm:text-xs">
                                        슬롯 1 잠김 - 지역 오픈
                                    </li>
                                ) : stageRegionalBuffEntries.length > 0 ? (
                                    stageRegionalBuffEntries.map((entry, idx) => (
                                        <li
                                            key={`${entry.kind}-${idx}`}
                                            className="rounded-md border border-white/8 bg-black/25 px-2 py-1.5 text-[11px] font-semibold leading-snug text-cyan-100/95 sm:text-xs"
                                        >
                                            {labelRegionalSpecialtyBuffEntry(entry)}
                                        </li>
                                    ))
                                ) : (
                                    <li className="rounded-md border border-white/8 bg-black/25 px-2 py-1.5 text-[11px] text-zinc-500 sm:text-xs">
                                        적용 중인 지역효과 없음
                                    </li>
                                )}
                            </ul>
                        </aside>
                    </div>
                ) : null}

                {rosterModalRow || rosterModalIsTreasure ? (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-5"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="adventure-roster-modal-title"
                        onClick={() => setRosterModalCodexId(null)}
                    >
                        <div
                            className={`max-h-[min(90dvh,780px)] w-full overflow-y-auto rounded-2xl border border-amber-400/45 bg-zinc-950/[0.98] shadow-[0_20px_60px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.05)] ${
                                rosterModalIsTreasure ? 'max-w-2xl' : 'max-w-lg'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
                                <h2
                                    id="adventure-roster-modal-title"
                                    className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-black text-amber-100 sm:text-base"
                                >
                                    {rosterModalIsTreasure ? (
                                        <span className="min-w-0 flex-1 truncate text-sm font-black tracking-tight text-amber-100 sm:text-base">
                                            보물상자-{stage.title}
                                        </span>
                                    ) : (
                                        <>
                                            <span className="min-w-0 truncate">{rosterModalRow?.name}</span>
                                            {rosterModalRow && isAdventureChapterBossCodexId(rosterModalRow.codexId) ? (
                                                <span className="shrink-0 rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-amber-100 sm:text-[10px]">
                                                    보스
                                                </span>
                                            ) : null}
                                        </>
                                    )}
                                </h2>
                                {rosterModalIsTreasure ? (
                                    <button
                                        type="button"
                                        className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-white/10 active:scale-[0.98]"
                                        onClick={() => setRosterModalCodexId(null)}
                                    >
                                        닫기
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-white/10"
                                        onClick={() => setRosterModalCodexId(null)}
                                    >
                                        닫기
                                    </button>
                                )}
                            </div>
                            <div className="space-y-5 p-5 sm:p-6">
                                {!rosterModalIsTreasure ? (
                                    <p className="text-center text-sm sm:text-base">
                                        <span className={`${rosterModalRightClass}`}>{rosterModalRightSlot}</span>
                                    </p>
                                ) : null}

                                {rosterModalIsTreasure && treasureRewardSections ? (
                                    <AdventureTreasureChestInfoPanel
                                        stageTitle={stage.title}
                                        equipmentBoxImage={adventureTreasureChestEquipmentImageForStageIndex(stage.stageIndex)}
                                        remainingLabel={
                                            rosterModalTreasureWindow && now < rosterModalTreasureWindow.windowEndMs
                                                ? formatRemainMs(Math.max(0, rosterModalTreasureWindow.windowEndMs - now))
                                                : '—'
                                        }
                                        mapKeysHeld={mapKeysHeld}
                                        sections={treasureRewardSections}
                                        onOpen={handleOpenTreasureChest}
                                        openDisabled={
                                            treasureOpenBlockedByKeys ||
                                            treasureHandledForWindow ||
                                            !rosterModalTreasureWindow ||
                                            now >= rosterModalTreasureWindow.windowEndMs
                                        }
                                    />
                                ) : rosterModalInstance && rosterModalInstanceDetails ? (
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                        <div
                                            className={[
                                                'mx-auto flex w-[7.5rem] shrink-0 flex-col self-start overflow-hidden rounded-xl border-[3px] border-amber-400/55 bg-white shadow-lg sm:mx-0 sm:w-[8.25rem]',
                                            ].join(' ')}
                                        >
                                            <div
                                                className={`flex min-h-[2.25rem] shrink-0 flex-col items-center justify-center gap-0.5 bg-gradient-to-b px-1.5 py-1.5 ${rosterModalInstanceDetails.chapterUi.nameBarClass}`}
                                            >
                                                <p className="line-clamp-2 text-center text-[11px] font-black leading-tight text-amber-50 sm:text-xs">
                                                    {rosterModalInstanceDetails.codexRow?.name ?? rosterModalInstance.speciesName}
                                                </p>
                                                {rosterModalInstanceDetails.isBoss ? (
                                                    <span className="rounded border border-amber-400/40 bg-black/50 px-1 py-px text-[7px] font-black uppercase tracking-wider text-amber-100 sm:text-[8px]">
                                                        보스
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-white p-2">
                                                <AdventureMonsterSpriteFrame
                                                    sheetUrl={rosterModalInstance.spriteSheetWebp}
                                                    frameIndex={rosterModalInstance.spriteFrameIndex}
                                                    cols={rosterModalInstance.spriteCols}
                                                    rows={rosterModalInstance.spriteRows}
                                                    softBackdrop
                                                    className="h-full w-full max-h-full max-w-full bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                                                <span className="text-[11px] font-semibold text-zinc-500 sm:text-xs">대국</span>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <span className="rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-black tabular-nums text-amber-100 sm:text-xs">
                                                        LV{rosterModalInstance.level}
                                                    </span>
                                                    <span className="text-xs font-bold text-fuchsia-100/95 sm:text-sm">
                                                        {ADVENTURE_MONSTER_MODE_LABELS[rosterModalInstance.mode]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-black/35 px-2.5 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-semibold text-zinc-500 sm:text-xs">이해도 레벨</span>
                                                    <span className="font-mono text-xs font-bold tabular-nums text-cyan-200 sm:text-sm">
                                                        Lv.{rosterModalComprehensionLevel}
                                                    </span>
                                                </div>
                                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-semibold text-zinc-500 sm:text-xs">이해도 경험치</span>
                                                    <span className="font-mono text-[11px] font-bold tabular-nums text-zinc-300 sm:text-xs">
                                                        {rosterModalComprehensionProgress.nextAt != null
                                                            ? `${rosterModalCodexWins}/${rosterModalComprehensionProgress.nextAt}`
                                                            : `최대 · ${rosterModalCodexWins}`}
                                                    </span>
                                                </div>
                                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800/95 ring-1 ring-inset ring-black/40">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-400 transition-all duration-500"
                                                        style={{
                                                            width: `${rosterModalComprehensionProgress.nextAt == null ? 100 : rosterModalComprehensionProgressPct}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <ul className="space-y-1.5 text-[13px] font-medium leading-snug text-zinc-100 sm:text-sm">
                                                {rosterModalInstanceDetails.quickLines.map((line, i) => (
                                                    <li key={`${i}-${line}`} className="border-b border-white/[0.06] pb-1.5 last:border-0 last:pb-0">
                                                        {line}
                                                    </li>
                                                ))}
                                            </ul>
                                            <Button
                                                type="button"
                                                bare
                                                onClick={() => void handleStartMonsterBattle(rosterModalInstance)}
                                                title={`행동력 ${rosterModalInstanceDetails.apCost}`}
                                                className="group relative mt-1 w-full overflow-hidden rounded-xl border border-amber-400/55 bg-gradient-to-b from-amber-500/[0.22] via-amber-600/[0.14] to-zinc-900/80 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all duration-200 hover:border-amber-300/70 hover:from-amber-400/[0.28] hover:shadow-[0_14px_36px_rgba(251,191,36,0.14)] active:translate-y-px active:shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:px-4 sm:py-3.5"
                                            >
                                                <span
                                                    aria-hidden
                                                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                                />
                                                <span className="relative z-[1] flex w-full items-center justify-between gap-3">
                                                    <span className="text-left text-sm font-black tracking-wide text-amber-50 drop-shadow-sm sm:text-[0.95rem]">
                                                        공격하기
                                                    </span>
                                                    <span className="flex items-center gap-1 rounded-lg border border-amber-300/25 bg-black/40 px-2.5 py-1 text-base font-black tabular-nums text-amber-100 shadow-inner sm:px-3 sm:text-lg">
                                                        <span aria-hidden>⚡</span>
                                                        <span>{rosterModalInstanceDetails.apCost}</span>
                                                    </span>
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                ) : rosterModalStaticPreview && rosterModalRow ? (
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                        <div
                                            className={[
                                                'mx-auto flex w-[7.5rem] shrink-0 flex-col self-start overflow-hidden rounded-xl border-[3px] border-amber-400/55 bg-white shadow-lg sm:mx-0 sm:w-[8.25rem]',
                                            ].join(' ')}
                                        >
                                            <div
                                                className={`flex min-h-[2.25rem] shrink-0 flex-col items-center justify-center gap-0.5 bg-gradient-to-b px-1.5 py-1.5 ${rosterModalStaticPreview.chapterUi.nameBarClass}`}
                                            >
                                                <p className="line-clamp-2 text-center text-[11px] font-black leading-tight text-amber-50 sm:text-xs">
                                                    {rosterModalRow!.name}
                                                </p>
                                                {rosterModalStaticPreview.isBoss ? (
                                                    <span className="rounded border border-amber-400/40 bg-black/50 px-1 py-px text-[7px] font-black uppercase tracking-wider text-amber-100 sm:text-[8px]">
                                                        보스
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-white p-2">
                                                <AdventureMonsterSpriteFrame
                                                    sheetUrl={rosterModalRow!.imageWebp}
                                                    frameIndex={0}
                                                    cols={1}
                                                    rows={1}
                                                    softBackdrop
                                                    className="h-full w-full max-h-full max-w-full bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-2.5">
                                            <p className="text-[13px] leading-relaxed text-zinc-300 sm:text-sm">{rosterModalRow!.codexDescription}</p>
                                            <p className="text-xs text-zinc-500">
                                                출현 레벨{' '}
                                                <span className="font-mono font-semibold text-amber-100">
                                                    Lv.{rosterModalStaticPreview.min}–{rosterModalStaticPreview.max}
                                                </span>
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                공격 시 소모{' '}
                                                <span className="font-mono font-bold text-amber-100">
                                                    <span aria-hidden>⚡</span>
                                                    {rosterModalStaticPreview.apCost}
                                                </span>
                                            </p>
                                            <p className="text-xs leading-snug text-zinc-500">
                                                가능한 대국{' '}
                                                <span className="font-medium text-zinc-200">{rosterModalStaticPreview.modes}</span>
                                            </p>
                                            <ul className="space-y-1.5 text-[13px] font-medium leading-snug text-zinc-100 sm:text-sm">
                                                {rosterModalStaticPreview.quickLinesClassic.map((line, i) => (
                                                    <li key={`${i}-${line}`} className="border-b border-white/[0.06] pb-1.5 last:border-0 last:pb-0">
                                                        {line}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}
                </div>

                {isNativeMobile ? (
                    <aside
                        className="mt-1 flex min-h-0 max-h-[min(32vh,14rem)] min-w-0 shrink-0 flex-col overflow-hidden rounded-lg border border-amber-500/35 bg-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        aria-label="챕터 몬스터 목록"
                    >
                        <div className="shrink-0 border-b border-white/10 px-2 py-1.5">
                            <p className="text-center text-[10px] font-bold uppercase tracking-wide text-emerald-400/90">
                                챕터 몬스터
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
                            <AdventureChapterMonsterSituationList
                                stageId={stage.id}
                                mapMonsters={monsters}
                                suppressRecord={suppressRecord}
                                nowMs={now}
                                onPickRow={(id) => setRosterModalCodexId(id)}
                                mapDwellMultiplier={mapDwellMult}
                                mapRespawnOffMultiplier={mapRespawnOffMult}
                                treasureHandledForCurrentWindow={treasureHandledForWindow}
                                treasureHandledKind={treasureHandledKind}
                                listClassName="mt-1 space-y-1.5"
                            />
                        </div>
                    </aside>
                ) : null}
            </div>

            {((selectedMonster && selectionDetails) || (selectedTreasure && treasureRewardSections)) &&
            isNativeMobile &&
            typeof document !== 'undefined'
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/60 backdrop-blur-[2px]"
                          role="presentation"
                          onClick={() => setSelectedId(null)}
                      >
                          <div
                              role="dialog"
                              aria-modal="true"
                              aria-label={selectedTreasure ? `보물상자-${stage.title} 정보` : '몬스터 정보'}
                              className="pointer-events-auto flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-0.5rem))] w-full min-h-0 flex-col overflow-hidden rounded-t-[1.35rem] border-x border-t border-amber-400/50 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-[0_-24px_64px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)]"
                              onClick={(e) => e.stopPropagation()}
                          >
                              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                  <div
                                      className="flex shrink-0 justify-center pt-2"
                                      aria-hidden
                                  >
                                      <span className="h-1 w-10 rounded-full bg-zinc-600/90" />
                                  </div>
                                  <div className="flex shrink-0 items-start gap-3 border-b border-amber-500/15 px-4 pb-3 pt-1">
                                      <div className="min-w-0 flex-1">
                                          {selectedTreasure ? (
                                              <h2 className="min-w-0 flex-1 truncate text-lg font-black leading-tight tracking-tight text-white">
                                                  보물상자-{stage.title}
                                              </h2>
                                          ) : (
                                              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                  <span className="min-w-0 truncate text-base font-black leading-tight text-amber-50">
                                                      {selectionDetails!.codexRow?.name ?? selectedMonster!.speciesName}
                                                  </span>
                                                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-amber-200/95">
                                                      LV{selectedMonster!.level}
                                                  </span>
                                              </p>
                                          )}
                                      </div>
                                      <button
                                          type="button"
                                          className="shrink-0 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-bold text-zinc-200 transition active:scale-[0.98] active:bg-white/10"
                                          onClick={() => setSelectedId(null)}
                                      >
                                          닫기
                                      </button>
                                  </div>
                                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-6">
                                      {selectedMonster && selectionDetails ? (
                                      <div className="flex items-start gap-3">
                                          <div
                                              className={[
                                                  'flex w-[6.25rem] shrink-0 flex-col self-start overflow-hidden rounded-lg border-2 border-amber-400/55 bg-white shadow-md',
                                              ].join(' ')}
                                          >
                                              <div
                                                  className={`flex min-h-[2.25rem] shrink-0 flex-col items-center justify-center gap-0.5 bg-gradient-to-b px-1.5 py-1 ${selectionDetails.chapterUi.nameBarClass}`}
                                              >
                                                  <p className="line-clamp-2 text-center text-[11px] font-black leading-tight text-amber-50">
                                                      {selectionDetails.codexRow?.name ?? selectedMonster.speciesName}
                                                  </p>
                                                  {selectionDetails.isBoss ? (
                                                      <span className="rounded border border-amber-400/40 bg-black/50 px-1 py-px text-[8px] font-black uppercase tracking-wider text-amber-100">
                                                          보스
                                                      </span>
                                                  ) : null}
                                              </div>
                                              <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-white p-1.5">
                                                  <AdventureMonsterSpriteFrame
                                                      sheetUrl={selectedMonster.spriteSheetWebp}
                                                      frameIndex={selectedMonster.spriteFrameIndex}
                                                      cols={selectedMonster.spriteCols}
                                                      rows={selectedMonster.spriteRows}
                                                      softBackdrop
                                                      className="h-full w-full max-h-full max-w-full bg-transparent"
                                                  />
                                              </div>
                                          </div>
                                          <div className="min-w-0 flex-1 space-y-3">
                                              <div className="rounded-lg border border-white/10 bg-black/45 px-3 py-2.5">
                                                  <div className="space-y-1">
                                                      <p className="text-xs font-bold text-zinc-500">대국</p>
                                                      <p className="text-sm font-bold leading-snug text-zinc-100">
                                                          <span className="font-mono tabular-nums text-amber-200">
                                                              LV{selectedMonster.level}
                                                          </span>
                                                          <span className="mx-2 text-zinc-600" aria-hidden>
                                                              ·
                                                          </span>
                                                          <span className="text-fuchsia-200">
                                                              {ADVENTURE_MONSTER_MODE_LABELS[selectedMonster.mode]}
                                                          </span>
                                                      </p>
                                                  </div>
                                                  <div className="mt-2.5 border-t border-white/10 pt-2.5">
                                                      <p className="text-xs font-bold text-zinc-500">남은 시간</p>
                                                      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-amber-200">
                                                          {formatRemainMs(selectedMonster.expiresAt - now)}
                                                      </p>
                                                  </div>
                                                  <div className="mt-2.5 border-t border-white/10 pt-2.5">
                                                      <div className="flex items-center justify-between gap-2">
                                                          <p className="text-xs font-bold text-zinc-500">이해도 레벨</p>
                                                          <p className="font-mono text-sm font-bold tabular-nums text-cyan-200">
                                                              Lv.{selectedMonsterComprehensionLevel}
                                                          </p>
                                                      </div>
                                                      <div className="mt-1.5 flex items-center justify-between gap-2">
                                                          <p className="text-xs font-bold text-zinc-500">이해도 경험치</p>
                                                          <p className="font-mono text-xs font-bold tabular-nums text-zinc-300">
                                                              {selectedMonsterComprehensionProgress.nextAt != null
                                                                  ? `${selectedMonsterCodexWins}/${selectedMonsterComprehensionProgress.nextAt}`
                                                                  : `최대 · ${selectedMonsterCodexWins}`}
                                                          </p>
                                                      </div>
                                                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800/95 ring-1 ring-inset ring-black/40">
                                                          <div
                                                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-400 transition-all duration-500"
                                                              style={{
                                                                  width: `${selectedMonsterComprehensionProgress.nextAt == null ? 100 : selectedMonsterComprehensionProgressPct}%`,
                                                              }}
                                                          />
                                                      </div>
                                                  </div>
                                              </div>
                                              <ul className="space-y-2 text-sm font-medium leading-snug text-zinc-200">
                                                  {selectionDetails.quickLines.map((line, i) => (
                                                      <li
                                                          key={`m-${i}-${line}`}
                                                          className="border-b border-white/[0.07] pb-2 pl-0.5 last:border-0 last:pb-0"
                                                      >
                                                          {line}
                                                      </li>
                                                  ))}
                                              </ul>
                                          </div>
                                      </div>
                                      ) : selectedTreasure && treasureRewardSections ? (
                                          <AdventureTreasureChestInfoPanel
                                              stageTitle={stage.title}
                                              equipmentBoxImage={selectedTreasure.equipmentBoxImage}
                                              remainingLabel={formatRemainMs(Math.max(0, selectedTreasure.windowEndMs - now))}
                                              mapKeysHeld={mapKeysHeld}
                                              sections={treasureRewardSections}
                                              onOpen={handleOpenTreasureChest}
                                              openDisabled={
                                                  treasureOpenBlockedByKeys ||
                                                  treasureHandledForWindow ||
                                                  now >= selectedTreasure.windowEndMs
                                              }
                                          />
                                      ) : null}
                                  </div>
                                  <div className="flex shrink-0 justify-center border-t border-amber-500/20 bg-gradient-to-t from-black/80 to-zinc-950 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))]">
                                      {selectedMonster && selectionDetails ? (
                                          <Button
                                              type="button"
                                              bare
                                              onClick={() => void handleStartMonsterBattle()}
                                              title={`행동력 ${selectionDetails.apCost}`}
                                              className="group relative w-auto min-w-[10.5rem] max-w-full overflow-hidden rounded-xl border border-amber-400/55 bg-gradient-to-b from-amber-500/[0.22] via-amber-600/[0.14] to-zinc-900/80 px-5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all active:translate-y-px active:shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
                                          >
                                              <span
                                                  aria-hidden
                                                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                              />
                                              <span className="relative z-[1] flex items-center justify-center gap-2.5">
                                                  <span className="text-sm font-black tracking-wide text-amber-50">공격하기</span>
                                                  <span className="flex items-center gap-1 rounded-lg border border-amber-300/25 bg-black/40 px-2 py-0.5 text-sm font-black tabular-nums text-amber-100 shadow-inner">
                                                      <span aria-hidden>⚡</span>
                                                      <span>{selectionDetails.apCost}</span>
                                                  </span>
                                              </span>
                                          </Button>
                                      ) : null}
                                  </div>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}

            {isNativeMobile && regionalEffectModalOpen ? (
                <div
                    className="fixed inset-0 z-[95] flex items-end bg-black/65 backdrop-blur-[2px]"
                    role="presentation"
                    onClick={() => setRegionalEffectModalOpen(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="지역효과"
                        className="pointer-events-auto w-full rounded-t-2xl border-x border-t border-cyan-400/45 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-[0_-20px_56px_rgba(0,0,0,0.82)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                            <h2 className="text-sm font-black text-cyan-100">지역효과</h2>
                            <button
                                type="button"
                                onClick={() => setRegionalEffectModalOpen(false)}
                                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-100"
                            >
                                닫기
                            </button>
                        </div>
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                                <span className="text-xs font-semibold text-zinc-400">탐험도 등급</span>
                                <span className="rounded-md border border-cyan-400/30 bg-cyan-950/40 px-2 py-0.5 text-xs font-bold text-cyan-100">
                                    {stageUnderstandingTierLabel}
                                </span>
                            </div>
                            <p className="text-xs font-mono tabular-nums text-zinc-400">XP {stageUnderstandingXp.toLocaleString()}</p>
                            <ul className="space-y-1.5">
                                {!stageUnlocked ? (
                                    <li className="rounded-md border border-white/8 bg-black/25 px-2.5 py-2 text-xs font-semibold text-zinc-300">
                                        슬롯 1 잠김 - 지역 오픈
                                    </li>
                                ) : stageRegionalBuffEntries.length > 0 ? (
                                    stageRegionalBuffEntries.map((entry, idx) => (
                                        <li
                                            key={`${entry.kind}-${idx}`}
                                            className="rounded-md border border-white/8 bg-black/25 px-2.5 py-2 text-xs font-semibold leading-snug text-cyan-100/95"
                                        >
                                            {labelRegionalSpecialtyBuffEntry(entry)}
                                        </li>
                                    ))
                                ) : (
                                    <li className="rounded-md border border-white/8 bg-black/25 px-2.5 py-2 text-xs text-zinc-500">
                                        적용 중인 지역효과 없음
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            ) : null}

            {treasurePickModal && typeof document !== 'undefined'
                ? createPortal(
                      <AdventureTreasureChestPickModal
                          open
                          isNativeMobile={isNativeMobile}
                          onClose={() => setTreasurePickModal(null)}
                          stageId={stage.id}
                          stageTitle={stage.title}
                          stageIndex={stage.stageIndex}
                          equipmentBoxImage={treasurePickModal.equipmentBoxImage}
                          rolls={treasurePickModal.rolls}
                          pickSlots={treasurePickModal.pickSlots}
                          nonce={treasurePickModal.nonce}
                          onAbandonPick={async () => {
                              const abandonResult = await handlers.handleAction({
                                  type: 'ABANDON_ADVENTURE_MAP_TREASURE_PICK',
                                  payload: { stageId: stage.id },
                              });
                              if (
                                  abandonResult &&
                                  typeof abandonResult === 'object' &&
                                  'error' in abandonResult &&
                                  (abandonResult as { error?: string }).error
                              ) {
                                  return {
                                      ok: false,
                                      error: String((abandonResult as { error?: string }).error),
                                  };
                              }
                              return { ok: true };
                          }}
                          onConfirm={async (selectedSlots) => {
                              const confirmResult = await handlers.handleAction({
                                  type: 'CONFIRM_ADVENTURE_MAP_TREASURE_CHEST',
                                  payload: {
                                      stageId: stage.id,
                                      nonce: treasurePickModal.nonce,
                                      selectedSlots,
                                  },
                              });
                              if (
                                  confirmResult &&
                                  typeof confirmResult === 'object' &&
                                  'error' in confirmResult &&
                                  (confirmResult as { error?: string }).error
                              ) {
                                  return {
                                      ok: false,
                                      error: String((confirmResult as { error?: string }).error),
                                  };
                              }
                              return { ok: true };
                          }}
                      />,
                      document.body,
                  )
                : null}
        </div>
    );
};

export default AdventureStageMap;
