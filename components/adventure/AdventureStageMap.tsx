import React, { useLayoutEffect, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    ADVENTURE_CODEX_CHAPTER_UI,
    ADVENTURE_MAP_THEMES,
    ADVENTURE_MONSTER_MODE_LABELS,
    adventureBattleModeToGameMode,
    getAdventureStageById,
    getAdventureStageLevelRange,
    type AdventureMonsterBattleMode,
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
import Avatar from '../Avatar.js';
import Button from '../Button.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants.js';
import { GameMode } from '../../shared/types/enums.js';
import {
    adventureMapMsUntilNextAppearance,
    adventureMapSuppressKey,
    buildAdventureMapMonstersFromSchedule,
    type AdventureMapMonsterInstance,
} from '../../shared/utils/adventureMapSchedule.js';

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

const MODE_BADGE_SHORT: Record<AdventureMonsterBattleMode, string> = {
    classic: '클',
    capture: '따',
    base: '베',
    hidden: '히',
    missile: '미',
};

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
    /** 말풍선이 잘리지 않게 클램프할 맵 카드(overflow hidden) */
    const mapViewportRef = useRef<HTMLDivElement>(null);
    const monsterBubbleRef = useRef<HTMLDivElement>(null);
    const [monsterBubblePos, setMonsterBubblePos] = useState<{ left: number; top: number } | null>(null);

    const suppressJson = useMemo(
        () => JSON.stringify(currentUserWithStatus?.adventureProfile?.adventureMapSuppressUntilByKey ?? {}),
        [currentUserWithStatus?.adventureProfile?.adventureMapSuppressUntilByKey],
    );

    const suppressRecord = useMemo(() => JSON.parse(suppressJson) as Record<string, number>, [suppressJson]);

    const monsters = useMemo(() => {
        if (!stage) return [];
        return buildAdventureMapMonstersFromSchedule(stage, Date.now(), suppressRecord);
    }, [stage, suppressRecord, panelSecondTick]);

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
    }, [stage?.id]);

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

    const now = Date.now();

    const selectionDetails = useMemo(() => {
        if (!selectedMonster || !stage) return null;
        return buildAdventureMapMonsterDetails(stage, selectedMonster);
    }, [selectedMonster, stage]);

    const syncMonsterBubblePos = useCallback(() => {
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
    }, [selectedMonster, selectionDetails]);

    useLayoutEffect(() => {
        syncMonsterBubblePos();
    }, [syncMonsterBubblePos]);

    useEffect(() => {
        if (!selectedMonster || !selectionDetails || !mapViewportRef.current) return;
        const vp = mapViewportRef.current;
        const ro = new ResizeObserver(() => syncMonsterBubblePos());
        ro.observe(vp);
        window.addEventListener('resize', syncMonsterBubblePos);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', syncMonsterBubblePos);
        };
    }, [selectedMonster, selectionDetails, syncMonsterBubblePos]);

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

    const rosterModalStaticPreview = useMemo(() => {
        if (!rosterModalRow || !stage || rosterModalInstance) return null;
        const { min, max } = getAdventureStageLevelRange(stage.stageIndex);
        const mid = Math.floor((min + max) / 2);
        const boardSize = resolveAdventureBoardSize(stage.id, rosterModalRow.codexId, `static-${rosterModalRow.codexId}`, {
            monsterLevel: mid,
            chapterLevelMin: min,
            chapterLevelMax: max,
        });
        const quickLinesClassic = formatAdventureBattleQuickLines(boardSize, GameMode.Standard);
        const apCost = getAdventureMonsterAttackActionPointCost(stage.stageIndex, rosterModalRow.codexId);
        const chapterUi = ADVENTURE_CODEX_CHAPTER_UI[stage.id as AdventureStageId];
        const isBoss = isAdventureChapterBossCodexId(rosterModalRow.codexId);
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
            const m = adventureMapMsUntilNextAppearance(t, stage.id, row.codexId, boss, suppressRecord[key]);
            minM = Math.min(minM, m);
        }
        return Number.isFinite(minM) ? minM : 0;
    }, [stage, suppressRecord, panelSecondTick]);

    const onBack = () => replaceAppHash('#/adventure');

    const avatarUrl = currentUserWithStatus
        ? AVATAR_POOL.find((a) => a.id === currentUserWithStatus.avatarId)?.url
        : undefined;
    const borderUrl = currentUserWithStatus
        ? BORDER_POOL.find((b) => b.id === currentUserWithStatus.borderId)?.url
        : undefined;

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
        setSelectedId(null);
        setRosterModalCodexId(null);
    };

    /** 모달·목록 공통: 출현 중 / 다음 절대 출현까지 */
    let rosterModalRightSlot = formatRemainMs(minMsUntilAnyAppearance);
    let rosterModalRightClass = 'font-mono font-bold tabular-nums text-amber-200';
    if (rosterModalRow && stage) {
        const boss = isAdventureChapterBossCodexId(rosterModalRow.codexId);
        const supK = adventureMapSuppressKey(stage.id, rosterModalRow.codexId);
        const until = adventureMapMsUntilNextAppearance(now, stage.id, rosterModalRow.codexId, boss, suppressRecord[supK]);
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
            <header
                className={`relative z-50 flex flex-shrink-0 items-center ${isNativeMobile ? 'mb-1 justify-between px-1 py-1' : 'mb-2 justify-between px-1 sm:mb-2 sm:px-0'}`}
            >
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

            <div
                ref={mapViewportRef}
                className="relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-amber-500/30 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(255,255,255,0.06)] sm:rounded-2xl"
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
                                                <div className="relative flex h-[clamp(4.25rem,17.25vw,6.1rem)] w-[clamp(4.25rem,17.25vw,6.1rem)] items-end justify-center sm:h-[6.75rem] sm:w-[6.75rem]">
                                                    <AdventureMonsterSpriteFrame
                                                        sheetUrl={m.spriteSheetWebp}
                                                        frameIndex={m.spriteFrameIndex}
                                                        cols={m.spriteCols}
                                                        rows={m.spriteRows}
                                                        softBackdrop
                                                        className="absolute inset-0 h-full w-full bg-transparent"
                                                    />
                                                    <span
                                                        className="pointer-events-none absolute right-0 top-0 rounded bg-violet-950/90 px-1 py-px font-mono text-xs font-bold leading-none text-fuchsia-100 shadow-sm sm:px-1.5 sm:py-0.5 sm:text-sm"
                                                        title={ADVENTURE_MONSTER_MODE_LABELS[m.mode]}
                                                    >
                                                        {MODE_BADGE_SHORT[m.mode]}
                                                    </span>
                                                </div>
                                                <p className="mt-1 flex max-w-[11rem] items-center justify-center gap-1.5 whitespace-nowrap text-center text-[11px] font-bold leading-tight text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:max-w-[13rem] sm:gap-2 sm:text-xs">
                                                    <span className="shrink-0 font-mono font-black text-amber-200">LV{m.level}</span>
                                                    <span className="min-w-0 truncate">{m.speciesName}</span>
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}

                                {selectedMonster && selectionDetails && (
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
                                            <div className="relative flex flex-col gap-3.5 p-3.5 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
                                                <div
                                                    className={[
                                                        'mx-auto flex w-[7.5rem] shrink-0 flex-col overflow-hidden rounded-xl border-[3px] border-amber-400/60 bg-white shadow-md sm:mx-0 sm:w-[8.25rem]',
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
                                                    <div className="flex aspect-square w-full items-center justify-center bg-white p-2">
                                                        <AdventureMonsterSpriteFrame
                                                            sheetUrl={selectedMonster.spriteSheetWebp}
                                                            frameIndex={selectedMonster.spriteFrameIndex}
                                                            cols={selectedMonster.spriteCols}
                                                            rows={selectedMonster.spriteRows}
                                                            softBackdrop
                                                            className="h-full w-full bg-transparent"
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

                <div className="pointer-events-none absolute left-1.5 top-1.5 z-30 flex w-[min(88vw,15.5rem)] max-h-[min(100%-0.5rem,calc(100dvh-4.75rem))] flex-col gap-2 sm:left-2 sm:top-2 sm:w-[16.5rem] sm:max-h-[min(100%-0.75rem,calc(100dvh-5.5rem))]">
                    <aside
                        className="pointer-events-auto shrink-0 rounded-xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-800/92 via-amber-950/94 to-violet-950/92 p-2.5 shadow-[0_10px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:p-3.5"
                        aria-label="유저 프로필"
                    >
                        <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-amber-100/95 sm:text-xs">
                            유저
                        </p>
                        {currentUserWithStatus ? (
                            <div className="flex flex-col items-center gap-2">
                                <Avatar
                                    userId={currentUserWithStatus.id}
                                    userName={currentUserWithStatus.nickname || 'Player'}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={isNativeMobile ? 52 : 60}
                                />
                                <p className="max-w-full truncate text-center text-sm font-black text-amber-50 sm:text-base">
                                    {currentUserWithStatus.nickname}
                                </p>
                                <div className="flex w-full flex-col gap-1 border-t border-amber-400/25 pt-2 text-xs font-semibold text-amber-100/85 sm:text-sm">
                                    <div className="flex justify-between gap-2">
                                        <span className="text-amber-200/75">전략</span>
                                        <span className="font-mono text-cyan-100">Lv.{currentUserWithStatus.strategyLevel}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-amber-200/75">놀이</span>
                                        <span className="font-mono text-amber-200">Lv.{currentUserWithStatus.playfulLevel}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-sm text-amber-200/70">로딩…</p>
                        )}
                    </aside>

                    <aside
                        className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-950/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                        aria-label="챕터 몬스터 목록"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-2.5">
                            <p className="text-center text-[11px] font-bold uppercase tracking-wide text-emerald-400/90 sm:text-xs">
                                챕터 몬스터
                            </p>
                            <ul className="mt-2 space-y-1.5 sm:space-y-2">
                                {[...stage.monsters]
                                    .sort((a, b) => {
                                        const ab = isAdventureChapterBossCodexId(a.codexId) ? 1 : 0;
                                        const bb = isAdventureChapterBossCodexId(b.codexId) ? 1 : 0;
                                        if (ab !== bb) return ab - bb;
                                        return a.codexId.localeCompare(b.codexId);
                                    })
                                    .map((row) => {
                                        const mapMonster = monsters.find((m) => m.codexId === row.codexId && m.expiresAt > now);
                                        const boss = isAdventureChapterBossCodexId(row.codexId);
                                        const supK = adventureMapSuppressKey(stage.id, row.codexId);
                                        const untilAppear = adventureMapMsUntilNextAppearance(
                                            now,
                                            stage.id,
                                            row.codexId,
                                            boss,
                                            suppressRecord[supK],
                                        );
                                        const rightSlot = mapMonster ? '출현중' : formatRemainMs(untilAppear);
                                        return (
                                            <li key={row.codexId}>
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-left transition hover:border-amber-400/35 hover:bg-black/45 active:scale-[0.99] sm:gap-2.5 sm:px-2.5 sm:py-2.5"
                                                    onClick={() => setRosterModalCodexId(row.codexId)}
                                                >
                                                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-amber-50 sm:text-sm">
                                                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                                                            <span className="min-w-0 truncate">{row.name}</span>
                                                            {boss ? (
                                                                <span className="shrink-0 rounded border border-amber-400/45 bg-amber-500/15 px-1 py-px text-[8px] font-black uppercase tracking-wider text-amber-100 sm:text-[9px]">
                                                                    보스
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </span>
                                                    <span
                                                        className={[
                                                            'shrink-0 font-mono text-[11px] font-bold tabular-nums sm:text-xs',
                                                            mapMonster ? 'text-emerald-300' : 'text-amber-200',
                                                        ].join(' ')}
                                                    >
                                                        {rightSlot}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    </aside>
                </div>

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
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                                        <div
                                            className={[
                                                'mx-auto flex w-[7.5rem] shrink-0 flex-col overflow-hidden rounded-xl border-[3px] border-amber-400/55 bg-white shadow-lg sm:mx-0 sm:w-[8.25rem]',
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
                                            <div className="flex aspect-square w-full items-center justify-center bg-white p-2">
                                                <AdventureMonsterSpriteFrame
                                                    sheetUrl={rosterModalInstance.spriteSheetWebp}
                                                    frameIndex={rosterModalInstance.spriteFrameIndex}
                                                    cols={rosterModalInstance.spriteCols}
                                                    rows={rosterModalInstance.spriteRows}
                                                    softBackdrop
                                                    className="h-full w-full bg-transparent"
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
                                                'mx-auto flex w-[7.5rem] shrink-0 flex-col overflow-hidden rounded-xl border-[3px] border-amber-400/55 bg-white shadow-lg sm:mx-0 sm:w-[8.25rem]',
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
                                            <div className="flex aspect-square w-full items-center justify-center bg-white p-2">
                                                <AdventureMonsterSpriteFrame
                                                    sheetUrl={rosterModalRow.imageWebp}
                                                    frameIndex={0}
                                                    cols={1}
                                                    rows={1}
                                                    softBackdrop
                                                    className="h-full w-full bg-transparent"
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
        </div>
    );
};

export default AdventureStageMap;
