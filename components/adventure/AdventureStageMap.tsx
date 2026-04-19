import React, { useLayoutEffect, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    ADVENTURE_CODEX_CHAPTER_UI,
    ADVENTURE_MAP_THEMES,
    ADVENTURE_MONSTER_MODE_BADGE_SHORT,
    ADVENTURE_MONSTER_MODE_LABELS,
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
import { isAdventureStageUnlocked, type AdventureChapterUnlockContext } from '../../utils/adventureChapterUnlock.js';
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
import AdventureMonsterCodexModal from './AdventureMonsterCodexModal.js';
import AdventureChapterRewardHints from './AdventureChapterRewardHints.js';
import { labelRegionalSpecialtyBuffEntry, migrateRegionalBuffEntry } from '../../utils/adventureRegionalSpecialtyBuff.js';
import type { AdventureRegionalSpecialtyBuffEntry } from '../../types/entities.js';
import { formatAdventureUnderstandingTierLabel } from '../../utils/adventureUnderstanding.js';
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

const AdventureStageMap: React.FC<Props> = ({ stageId }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus, handlers } = useAppContext();
    const stage = getAdventureStageById(stageId);
    const theme = stage ? ADVENTURE_MAP_THEMES[stage.id as AdventureStageId] : null;

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [, setUiTick] = useState(0);
    const [panelSecondTick, setPanelSecondTick] = useState(0);
    const [rosterModalCodexId, setRosterModalCodexId] = useState<string | null>(null);
    const [monsterHubOpen, setMonsterHubOpen] = useState(false);
    const [monsterHubInitialTab, setMonsterHubInitialTab] = useState<'situation' | 'codex'>('situation');
    const [regionalEffectModalOpen, setRegionalEffectModalOpen] = useState(false);
    const [mapBox, setMapBox] = useState({ w: 0, h: 0 });
    /** 말풍선이 잘리지 않게 클램프할 맵 카드(overflow hidden) */
    const mapViewportRef = useRef<HTMLDivElement>(null);
    const monsterBubbleRef = useRef<HTMLDivElement>(null);
    const [monsterBubblePos, setMonsterBubblePos] = useState<{ left: number; top: number } | null>(null);

    const suppressJson = useMemo(
        () => JSON.stringify(currentUserWithStatus?.adventureProfile?.adventureMapSuppressUntilByKey ?? {}),
        [currentUserWithStatus?.adventureProfile?.adventureMapSuppressUntilByKey],
    );

    const suppressRecord = useMemo(() => JSON.parse(suppressJson) as Record<string, number>, [suppressJson]);

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
        setMonsterHubOpen(false);
    }, [stage?.id]);

    /** 해시는 #/game/인데 currentRoute가 아직 모험맵인 짧은 구간에 body 포털 시트가 남지 않도록 함 */
    useEffect(() => {
        const closeAdventureOverlaysForGameHash = () => {
            if (!window.location.hash.startsWith('#/game/')) return;
            setSelectedId(null);
            setRosterModalCodexId(null);
            setMonsterHubOpen(false);
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

    const selectedMonster = selectedId ? monsters.find((m) => m.id === selectedId) : undefined;
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

    const selectionDetails = useMemo(() => {
        if (!selectedMonster || !stage) return null;
        return buildAdventureMapMonsterDetails(stage, selectedMonster);
    }, [selectedMonster, stage]);

    const syncMonsterBubblePos = useCallback(() => {
        if (isNativeMobile) {
            setMonsterBubblePos(null);
            return;
        }
        if (!selectedMonster || !selectionDetails || !mapViewportRef.current || !monsterBubbleRef.current) {
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
                selectedMonster.xPct,
                selectedMonster.yPct,
                br.width,
                br.height,
            ),
        );
    }, [isNativeMobile, selectedMonster, selectionDetails]);

    useLayoutEffect(() => {
        syncMonsterBubblePos();
    }, [syncMonsterBubblePos]);

    useEffect(() => {
        if (isNativeMobile || !selectedMonster || !selectionDetails || !mapViewportRef.current) return;
        const vp = mapViewportRef.current;
        const ro = new ResizeObserver(() => syncMonsterBubblePos());
        ro.observe(vp);
        window.addEventListener('resize', syncMonsterBubblePos);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', syncMonsterBubblePos);
        };
    }, [isNativeMobile, selectedMonster, selectionDetails, syncMonsterBubblePos]);

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

    const rosterModalRow = useMemo(() => {
        if (!rosterModalCodexId || !stage) return null;
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
        if (selectedId && !monsters.some((m) => m.id === selectedId)) {
            setSelectedId(null);
        }
    }, [monsters, selectedId]);

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
            setMonsterHubOpen(false);
        });
    };

    /** 모달·목록 공통: 출현 중 / 다음 절대 출현까지 */
    let rosterModalRightSlot = formatRemainMs(minMsUntilAnyAppearance);
    let rosterModalRightClass = 'font-mono font-bold tabular-nums text-amber-200';
    if (rosterModalRow && stage) {
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
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <div className="min-w-0 flex-1 text-left">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">모험 맵</p>
                                <h1 className="truncate text-sm font-black leading-tight text-white drop-shadow">{stage.title}</h1>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setMonsterHubInitialTab('codex');
                                    setMonsterHubOpen(true);
                                }}
                                className="shrink-0 rounded-lg border border-violet-400/45 bg-violet-950/75 px-2 py-1.5 text-[10px] font-bold leading-tight text-violet-100 shadow-sm transition hover:border-amber-400/50 hover:bg-violet-900/60 active:scale-[0.99]"
                                aria-label="몬스터 도감 열기"
                            >
                                몬스터 도감
                            </button>
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
                    <aside
                        className="mx-1 mt-1.5 rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-2 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md"
                        aria-label="챕터 보상 안내"
                    >
                        <AdventureChapterRewardHints stageId={stage.id as AdventureStageId} compact />
                    </aside>
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
                    <div className="min-w-0 flex-1 px-2 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 sm:text-xs">모험 맵</p>
                        <h1 className="truncate text-base font-black text-white drop-shadow sm:text-lg">{stage.title}</h1>
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

                                {selectedMonster && selectionDetails && !isNativeMobile && (
                                    <div
                                        ref={monsterBubbleRef}
                                        role="dialog"
                                        aria-label="몬스터 정보"
                                        className="pointer-events-auto absolute z-40 w-[min(calc(100%-0.75rem),24rem)] max-w-[24rem]"
                                        style={
                                            monsterBubblePos
                                                ? {
                                                      left: monsterBubblePos.left,
                                                      top: monsterBubblePos.top,
                                                      transform: 'none',
                                                      transformOrigin: 'top left',
                                                  }
                                                : {
                                                      left: `calc(${selectedMonster.xPct}% + 2.65rem)`,
                                                      top: `${selectedMonster.yPct}%`,
                                                      transform:
                                                          selectedMonster.yPct < 28
                                                              ? 'translateY(0.5rem)'
                                                              : 'translateY(calc(-100% - 0.5rem))',
                                                      transformOrigin: 'top left',
                                                  }
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="relative rounded-2xl border border-amber-400/55 bg-zinc-950 shadow-[0_20px_56px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
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
                                        </div>
                                    </div>
                                )}
                </div>

                {!isNativeMobile ? (
                    <div className="pointer-events-none absolute left-1.5 top-1.5 z-30 flex w-[min(88vw,15.5rem)] max-h-[min(100%-0.5rem,calc(100dvh-4.75rem))] flex-col gap-2 sm:left-2 sm:top-2 sm:w-[16.5rem] sm:max-h-[min(100%-0.75rem,calc(100dvh-5.5rem))]">
                        <aside
                            className="pointer-events-auto shrink-0 rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-2.5 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:p-3.5"
                            aria-label="챕터 보상 안내"
                        >
                            <AdventureChapterRewardHints stageId={stage.id as AdventureStageId} />
                        </aside>

                        <aside
                            className="pointer-events-auto relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                            aria-label="챕터 몬스터 목록"
                        >
                            <button
                                type="button"
                                onClick={() => setMonsterHubOpen(true)}
                                className="absolute right-2 top-2 z-10 max-w-[min(48%,8rem)] rounded-lg border border-violet-400/45 bg-violet-950/75 px-2 py-1 text-center text-[10px] font-bold leading-tight text-violet-100 shadow-sm transition hover:border-amber-400/50 hover:bg-violet-900/60 active:scale-[0.99] sm:right-2.5 sm:top-2.5 sm:max-w-none sm:px-2.5 sm:py-1.5 sm:text-xs"
                                aria-label="몬스터 도감 열기"
                            >
                                몬스터 도감
                            </button>
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pt-10 sm:p-2.5 sm:pt-11">
                                <p className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-400/90 sm:mb-2 sm:text-xs">
                                    챕터 몬스터
                                </p>
                                <AdventureChapterMonsterSituationList
                                    stageId={stage.id}
                                    mapMonsters={monsters}
                                    suppressRecord={suppressRecord}
                                    nowMs={now}
                                    onPickRow={(id) => setRosterModalCodexId(id)}
                                    mapDwellMultiplier={mapDwellMult}
                                    mapRespawnOffMultiplier={mapRespawnOffMult}
                                />
                            </div>
                        </aside>
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
                                {stageRegionalBuffEntries.length > 0 ? (
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

                {rosterModalRow ? (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-5"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="adventure-roster-modal-title"
                        onClick={() => setRosterModalCodexId(null)}
                    >
                        <div
                            className="max-h-[min(90dvh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-400/45 bg-zinc-950/[0.98] shadow-[0_20px_60px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.05)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
                                <h2
                                    id="adventure-roster-modal-title"
                                    className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-black text-amber-100 sm:text-base"
                                >
                                    <span className="min-w-0 truncate">{rosterModalRow.name}</span>
                                    {isAdventureChapterBossCodexId(rosterModalRow.codexId) ? (
                                        <span className="shrink-0 rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-amber-100 sm:text-[10px]">
                                            보스
                                        </span>
                                    ) : null}
                                </h2>
                                <button
                                    type="button"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-lg leading-none text-zinc-300 transition hover:bg-white/10"
                                    aria-label="닫기"
                                    onClick={() => setRosterModalCodexId(null)}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="space-y-4 p-4 sm:p-5">
                                <p className="text-center text-sm sm:text-base">
                                    <span className={`${rosterModalRightClass}`}>{rosterModalRightSlot}</span>
                                </p>

                                {rosterModalInstance && rosterModalInstanceDetails ? (
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
                                ) : rosterModalStaticPreview ? (
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
                                                    {rosterModalRow.name}
                                                </p>
                                                {rosterModalStaticPreview.isBoss ? (
                                                    <span className="rounded border border-amber-400/40 bg-black/50 px-1 py-px text-[7px] font-black uppercase tracking-wider text-amber-100 sm:text-[8px]">
                                                        보스
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-white p-2">
                                                <AdventureMonsterSpriteFrame
                                                    sheetUrl={rosterModalRow.imageWebp}
                                                    frameIndex={0}
                                                    cols={1}
                                                    rows={1}
                                                    softBackdrop
                                                    className="h-full w-full max-h-full max-w-full bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-2.5">
                                            <p className="text-[13px] leading-relaxed text-zinc-300 sm:text-sm">{rosterModalRow.codexDescription}</p>
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
                        className="mt-1 flex min-h-0 max-h-[min(32vh,14rem)] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-500/35 bg-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        aria-label="챕터 몬스터 목록"
                    >
                        <div className="shrink-0 border-b border-white/10 px-2 py-1.5">
                            <p className="text-center text-[10px] font-bold uppercase tracking-wide text-emerald-400/90">
                                챕터 몬스터
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1">
                            <AdventureChapterMonsterSituationList
                                stageId={stage.id}
                                mapMonsters={monsters}
                                suppressRecord={suppressRecord}
                                nowMs={now}
                                onPickRow={(id) => setRosterModalCodexId(id)}
                                mapDwellMultiplier={mapDwellMult}
                                mapRespawnOffMultiplier={mapRespawnOffMult}
                            />
                        </div>
                    </aside>
                ) : null}
            </div>

            {selectedMonster && selectionDetails && isNativeMobile && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/60 backdrop-blur-[2px]"
                          role="presentation"
                          onClick={() => setSelectedId(null)}
                      >
                          <div
                              role="dialog"
                              aria-modal="true"
                              aria-label="몬스터 정보"
                              className="pointer-events-auto flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-0.5rem))] w-full min-h-0 flex-col overflow-hidden rounded-t-2xl border-x border-t border-amber-400/55 bg-zinc-950 shadow-[0_-20px_56px_rgba(0,0,0,0.82)]"
                              onClick={(e) => e.stopPropagation()}
                          >
                              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                  <div className="flex shrink-0 items-start gap-2 border-b border-white/10 px-3 py-2.5">
                                      <div className="min-w-0 flex-1">
                                          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                              <span className="min-w-0 truncate text-base font-black leading-tight text-amber-50">
                                                  {selectionDetails.codexRow?.name ?? selectedMonster.speciesName}
                                              </span>
                                              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-amber-200/95">
                                                  LV{selectedMonster.level}
                                              </span>
                                          </p>
                                      </div>
                                      <button
                                          type="button"
                                          className="shrink-0 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-100 transition hover:bg-white/10 active:scale-[0.98]"
                                          aria-label="닫기"
                                          onClick={() => setSelectedId(null)}
                                      >
                                          닫기
                                      </button>
                                  </div>
                                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
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
                                  </div>
                                  <div className="flex shrink-0 justify-center border-t border-amber-400/45 bg-zinc-950 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
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
                                  </div>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}

            {monsterHubOpen ? (
                <AdventureMonsterCodexModal
                    {...(isNativeMobile
                        ? {
                              mapSituation: {
                                  stageId: stage.id,
                                  mapMonsters: monsters,
                                  suppressRecord,
                                  mapDwellMultiplier: mapDwellMult,
                                  mapRespawnOffMultiplier: mapRespawnOffMult,
                                  onPickRow: (id: string) => {
                                      setRosterModalCodexId(id);
                                      setMonsterHubOpen(false);
                                  },
                              },
                              initialMainTab: monsterHubInitialTab,
                          }
                        : { defaultCodexStageId: stage.id })}
                    onClose={() => setMonsterHubOpen(false)}
                    isTopmost
                />
            ) : null}

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
                                {stageRegionalBuffEntries.length > 0 ? (
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
        </div>
    );
};

export default AdventureStageMap;
