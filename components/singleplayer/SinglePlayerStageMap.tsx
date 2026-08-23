import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode, SinglePlayerLevel, SinglePlayerStageInfo, UserWithStatus } from '../../types.js';
import { SPECIAL_GAME_MODES } from '../../constants/gameModes.js';
import { getSinglePlayerStages } from '../../constants/singlePlayerConstants.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    isSinglePlayerStageCleared,
    isSinglePlayerStageUnlocked,
    reconcileSinglePlayerProgress,
} from '../../shared/utils/singlePlayerProgress.js';
import {
    resolveSinglePlayerMixedModes,
    resolveSinglePlayerStrategicGameMode,
    resolveSinglePlayerSurvivalMode,
} from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import {
    SINGLE_PLAYER_MAP_WORLD,
    buildSmoothStagePathD,
    getSinglePlayerRoadKeypoints,
    getSinglePlayerStageMapWaypoints,
    stageMapPointToWorld,
    worldToStageMapPoint,
    type SinglePlayerStageMapPoint,
} from '../../shared/constants/singlePlayerStageMapPaths.js';
import { getSinglePlayerLobbyMapBackgroundUrl } from '../../utils/singlePlayerPreGameDisplay.js';
import { formatSinglePlayerStageShortName } from '../../utils/singlePlayerStageDisplayName.js';
import { useMapViewport } from '../../hooks/useMapViewport.js';
import StageClearRewardPreview from '../rewards/StageClearRewardPreview.js';
import Button from '../Button.js';
import { ActionPointLabelWithCost } from '../ui/ActionPointIcon.js';
import { TutorialAnchor, useFirstRunGuideOptional } from '../tutorial/FirstRunGuideContext.js';
import { FIRST_RUN_FIRST_STAGE_ID, isFirstRunGuideEligible } from '../../shared/utils/firstRunGuide.js';

const PREMIUM_STAGE_ENTER_CLASS =
    'w-full !rounded-lg !border !border-amber-300/50 !bg-gradient-to-b !from-amber-400/90 !via-amber-800 !to-amber-950 !py-2 !text-sm !font-bold !tracking-wide !text-amber-50 !shadow-[0_3px_14px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:!brightness-110 active:!scale-[0.98] disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!grayscale';

const MODE_LABEL_KEY: Partial<Record<GameMode, string>> = {
    [GameMode.Standard]: 'gameModes:standard',
    [GameMode.Capture]: 'gameModes:capture',
    [GameMode.Speed]: 'gameModes:speed',
    [GameMode.Base]: 'gameModes:base',
    [GameMode.Hidden]: 'gameModes:hidden',
    [GameMode.Missile]: 'gameModes:missile',
    [GameMode.Mix]: 'gameModes:mix',
};

type StageModeChip = { icon: string; labelKey: string };

function modeChipFor(mode: GameMode): StageModeChip {
    const def = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    return {
        icon: def?.image ?? '/images/simbols/simbol1.webp',
        labelKey: MODE_LABEL_KEY[mode] ?? 'gameModes:standard',
    };
}

function resolveStageModePresentation(stage: SinglePlayerStageInfo): StageModeChip[] {
    if (resolveSinglePlayerSurvivalMode(stage)) {
        return [
            {
                icon: '/images/simbols/simbol1.webp',
                labelKey: 'game:singlePlayerDesc.modeGuide.survival.tab',
            },
        ];
    }
    const mode = resolveSinglePlayerStrategicGameMode(stage);
    if (mode === GameMode.Mix) {
        return resolveSinglePlayerMixedModes(stage).map(modeChipFor);
    }
    return [modeChipFor(mode)];
}

export type SinglePlayerStageMapProps = {
    selectedClass: SinglePlayerLevel;
    currentUser: UserWithStatus;
    /** 부모 영역 전체를 채울 때 테두리·라운드 제거 */
    bleed?: boolean;
};

const SinglePlayerStageMap: React.FC<SinglePlayerStageMapProps> = ({
    selectedClass,
    currentUser,
    bleed = false,
}) => {
    const { t } = useTranslation(['lobby', 'common', 'profile', 'game', 'gameModes']);
    const { handlers, singlePlayerStagesListRevision } = useAppContext();
    const firstRunGuide = useFirstRunGuideOptional();
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [pathEditMode, setPathEditMode] = useState(false);
    const [editRoad, setEditRoad] = useState<SinglePlayerStageMapPoint[] | null>(null);
    const [copyFlash, setCopyFlash] = useState(false);

    const stages = useMemo(() => {
        return getSinglePlayerStages()
            .filter((stage) => stage.level === selectedClass)
            .sort((a, b) => {
                const aNum = parseInt(a.id.split('-')[1] ?? '0', 10);
                const bNum = parseInt(b.id.split('-')[1] ?? '0', 10);
                return aNum - bNum;
            });
    }, [selectedClass, singlePlayerStagesListRevision]);

    const progress = useMemo(() => {
        return reconcileSinglePlayerProgress(
            getSinglePlayerStages(),
            (currentUser as { clearedSinglePlayerStages?: unknown }).clearedSinglePlayerStages,
            (currentUser as { singlePlayerProgress?: number }).singlePlayerProgress,
        );
    }, [currentUser, singlePlayerStagesListRevision]);

    const waypoints = useMemo(() => {
        if (pathEditMode) {
            return getSinglePlayerStageMapWaypoints(
                selectedClass,
                stages.length,
                editRoad ?? [],
            );
        }
        return getSinglePlayerStageMapWaypoints(selectedClass, stages.length);
    }, [selectedClass, stages.length, pathEditMode, editRoad]);

    const worldPoints = useMemo(
        () => waypoints.map((p) => stageMapPointToWorld(p)),
        [waypoints],
    );

    const pathD = useMemo(() => buildSmoothStagePathD(worldPoints), [worldPoints]);

    const editKeyWorldPoints = useMemo(() => {
        if (!pathEditMode || !editRoad) return [];
        return editRoad.map((p) => stageMapPointToWorld(p));
    }, [pathEditMode, editRoad]);

    const focusIndex = useMemo(() => {
        const next = stages.findIndex(
            (stage) =>
                !isSinglePlayerStageCleared(getSinglePlayerStages(), progress, stage.id) &&
                isSinglePlayerStageUnlocked(getSinglePlayerStages(), progress, stage.id),
        );
        if (next >= 0) return next;
        const lastCleared = [...stages]
            .reverse()
            .findIndex((stage) =>
                isSinglePlayerStageCleared(getSinglePlayerStages(), progress, stage.id),
            );
        if (lastCleared >= 0) return stages.length - 1 - lastCleared;
        return 0;
    }, [stages, progress]);

    const { viewportRef, transform, focusWorldPoint, fitToWorld, bumpZoom, consumeClickSuppression } =
        useMapViewport({
            worldWidth: SINGLE_PLAYER_MAP_WORLD.width,
            worldHeight: SINGLE_PLAYER_MAP_WORLD.height,
            fitMode: 'cover',
            maxZoomMultiplier: 3.2,
        });

    const reportSelectedStageId = firstRunGuide?.setSelectedStageId;
    useEffect(() => {
        reportSelectedStageId?.(selectedStageId);
        return () => reportSelectedStageId?.(null);
    }, [selectedStageId, reportSelectedStageId]);

    useEffect(() => {
        setSelectedStageId(null);
        setEditRoad(null);
        setPathEditMode(false);
    }, [selectedClass]);

    useEffect(() => {
        if (pathEditMode) return;
        fitToWorld({ overscan: 1 });
        if (!isFirstRunGuideEligible(currentUser)) return;
        const idx = stages.findIndex((s) => s.id === FIRST_RUN_FIRST_STAGE_ID);
        const point = worldPoints[idx];
        if (!point) return;
        const t = window.setTimeout(() => focusWorldPoint(point.x, point.y, { animate: true }), 120);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [selectedClass, pathEditMode, stages, worldPoints, currentUser]);

    const selectedStage = useMemo(
        () => stages.find((s) => s.id === selectedStageId) ?? null,
        [stages, selectedStageId],
    );

    const handleStageEnter = (stageId: string) => {
        if (!handlers?.handleAction) return;
        void handlers.handleAction({
            type: 'START_SINGLE_PLAYER_GAME',
            payload: { stageId },
        });
    };

    const beginPathEdit = () => {
        setPathEditMode(true);
        setSelectedStageId(null);
        setEditRoad([...getSinglePlayerRoadKeypoints(selectedClass)]);
    };

    const appendRoadPointFromClient = (clientX: number, clientY: number) => {
        const el = viewportRef.current;
        if (!el || !pathEditMode) return;
        const rect = el.getBoundingClientRect();
        const vx = clientX - rect.left;
        const vy = clientY - rect.top;
        const worldX = (vx - transform.tx) / transform.scale;
        const worldY = (vy - transform.ty) / transform.scale;
        const point = worldToStageMapPoint(worldX, worldY);
        setEditRoad((prev) => [...(prev ?? []), point]);
    };

    const copyRoadJson = async () => {
        if (!editRoad?.length) return;
        const body = editRoad
            .map((p) => `        { xPct: ${p.xPct.toFixed(1)}, yPct: ${p.yPct.toFixed(1)} },`)
            .join('\n');
        const text = `[${selectedClass}]\n${body}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopyFlash(true);
            window.setTimeout(() => setCopyFlash(false), 1200);
        } catch {
            console.log(text);
        }
    };

    const mapBg = getSinglePlayerLobbyMapBackgroundUrl(selectedClass);

    return (
        <div
            className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black ${
                bleed
                    ? 'rounded-none border-0 shadow-none'
                    : 'rounded-xl border border-emerald-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            }`}
        >
            <div
                ref={viewportRef}
                className={`relative min-h-0 flex-1 touch-none overflow-hidden ${
                    pathEditMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                }`}
                onClick={(e) => {
                    if (consumeClickSuppression()) return;
                    if (pathEditMode) {
                        appendRoadPointFromClient(e.clientX, e.clientY);
                        return;
                    }
                    setSelectedStageId(null);
                }}
            >
                <div
                    className="absolute left-0 top-0 origin-top-left will-change-transform"
                    style={{
                        width: SINGLE_PLAYER_MAP_WORLD.width,
                        height: SINGLE_PLAYER_MAP_WORLD.height,
                        transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
                    }}
                >
                    <img
                        src={mapBg}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                    />
                    <div
                        className={`pointer-events-none absolute inset-0 ${
                            bleed
                                ? 'bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(0,0,0,0.22)_100%)]'
                                : 'bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.55)_100%)]'
                        }`}
                        aria-hidden
                    />
                    <svg
                        className="pointer-events-none absolute inset-0"
                        width={SINGLE_PLAYER_MAP_WORLD.width}
                        height={SINGLE_PLAYER_MAP_WORLD.height}
                        viewBox={`0 0 ${SINGLE_PLAYER_MAP_WORLD.width} ${SINGLE_PLAYER_MAP_WORLD.height}`}
                        aria-hidden
                    >
                        <path
                            d={pathD}
                            fill="none"
                            stroke="rgba(0,0,0,0.45)"
                            strokeWidth={36}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d={pathD}
                            fill="none"
                            stroke="rgba(251,191,36,0.42)"
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d={pathD}
                            fill="none"
                            stroke="rgba(254,243,199,0.72)"
                            strokeWidth={5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="10 22"
                        />
                    </svg>

                    {editKeyWorldPoints.map((point, index) => (
                        <div
                            key={`road-key-${index}`}
                            className="pointer-events-none absolute z-[5] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[11px] font-bold text-white shadow-md"
                            style={{ left: point.x, top: point.y }}
                        >
                            {index}
                        </div>
                    ))}

                    {!pathEditMode &&
                        stages.map((stage, index) => {
                            const point = worldPoints[index];
                            if (!point) return null;
                            const stageNumber = parseInt(stage.id.split('-')[1] ?? `${index + 1}`, 10);
                            const cleared = isSinglePlayerStageCleared(
                                getSinglePlayerStages(),
                                progress,
                                stage.id,
                            );
                            const locked =
                                !currentUser.isAdmin &&
                                !isSinglePlayerStageUnlocked(
                                    getSinglePlayerStages(),
                                    progress,
                                    stage.id,
                                );
                            const isFocus = index === focusIndex;
                            const isSelected = selectedStageId === stage.id;

                            const node = (
                                <button
                                    type="button"
                                    disabled={locked}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (consumeClickSuppression()) return;
                                        if (locked) return;
                                        setSelectedStageId(stage.id);
                                        focusWorldPoint(point.x, point.y, { animate: true });
                                    }}
                                    className={`relative flex h-14 w-14 items-center justify-center rounded-full border-[3px] text-lg font-black tabular-nums shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-transform duration-150 ${
                                        locked
                                            ? 'cursor-not-allowed border-zinc-500/60 bg-zinc-900/85 text-zinc-400 opacity-70'
                                            : cleared
                                              ? 'border-emerald-300/80 bg-gradient-to-b from-emerald-600 to-emerald-950 text-white hover:scale-110'
                                              : 'border-amber-300/80 bg-gradient-to-b from-amber-500 to-amber-950 text-white hover:scale-110'
                                    } ${isFocus && !locked ? 'ring-4 ring-amber-300/50 scale-110' : ''} ${
                                        isSelected ? 'scale-125 ring-4 ring-white/40' : ''
                                    }`}
                                    aria-label={`${stageNumber}`}
                                >
                                    {locked ? (
                                        <span className="text-base" aria-hidden>
                                            🔒
                                        </span>
                                    ) : (
                                        <>
                                            {stageNumber}
                                            {cleared ? (
                                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] text-emerald-950">
                                                    ✓
                                                </span>
                                            ) : null}
                                        </>
                                    )}
                                </button>
                            );
                            const wrapClass =
                                'absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center';
                            if (stage.id === FIRST_RUN_FIRST_STAGE_ID) {
                                return (
                                    <TutorialAnchor
                                        key={stage.id}
                                        id="sp-stage-입문-1"
                                        className={wrapClass}
                                        style={{ left: point.x, top: point.y }}
                                    >
                                        {node}
                                    </TutorialAnchor>
                                );
                            }
                            return (
                                <div key={stage.id} className={wrapClass} style={{ left: point.x, top: point.y }}>
                                    {node}
                                </div>
                            );
                        })}

                    {pathEditMode &&
                        worldPoints.map((point, index) => (
                            <div
                                key={`preview-node-${index}`}
                                className="pointer-events-none absolute z-[4] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-200/80 bg-amber-500/80 text-sm font-black text-amber-950"
                                style={{ left: point.x, top: point.y }}
                            >
                                {index + 1}
                            </div>
                        ))}
                </div>

                <div
                    className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/35 to-transparent ${
                        bleed ? 'h-10 sm:h-12' : 'h-16'
                    }`}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />

                <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            bumpZoom(1.2);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/65 text-lg font-bold text-white shadow-lg backdrop-blur-sm hover:bg-black/80"
                        aria-label={t('singleplayer.mapZoomIn')}
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            bumpZoom(1 / 1.2);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/65 text-lg font-bold text-white shadow-lg backdrop-blur-sm hover:bg-black/80"
                        aria-label={t('singleplayer.mapZoomOut')}
                    >
                        −
                    </button>
                </div>

                {pathEditMode ? (
                    <div
                        className={`pointer-events-none absolute z-10 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[10px] font-medium text-emerald-100/85 backdrop-blur-sm sm:text-[11px] ${
                            bleed ? 'bottom-14 right-2 max-w-[9.5rem] text-right' : 'left-2 top-2'
                        }`}
                    >
                        비우기 → 길 위를 입구부터 순서대로 클릭 (드래그는 이동)
                    </div>
                ) : null}

                {currentUser.isAdmin ? (
                    <div className="absolute left-2 bottom-2 z-10 flex max-w-[min(100%,22rem)] flex-wrap items-center gap-1.5">
                        {!pathEditMode ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    beginPathEdit();
                                }}
                                className="rounded-md border border-rose-300/40 bg-black/70 px-2 py-1 text-[10px] font-semibold text-rose-100 backdrop-blur-sm hover:bg-black/85"
                            >
                                길 보정
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditRoad((prev) => (prev && prev.length ? prev.slice(0, -1) : prev));
                                    }}
                                    className="rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/85"
                                >
                                    되돌리기
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditRoad([]);
                                    }}
                                    className="rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/85"
                                >
                                    비우기
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditRoad([...getSinglePlayerRoadKeypoints(selectedClass)]);
                                    }}
                                    className="rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/85"
                                >
                                    기본값
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void copyRoadJson();
                                    }}
                                    className="rounded-md border border-amber-300/45 bg-amber-900/70 px-2 py-1 text-[10px] font-semibold text-amber-50 backdrop-blur-sm hover:bg-amber-800/80"
                                >
                                    {copyFlash ? '복사됨' : 'JSON 복사'}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPathEditMode(false);
                                        setEditRoad(null);
                                    }}
                                    className="rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/85"
                                >
                                    종료
                                </button>
                                <span className="rounded-md bg-black/55 px-1.5 py-1 text-[10px] text-zinc-200">
                                    {editRoad?.length ?? 0}점
                                </span>
                            </>
                        )}
                    </div>
                ) : null}
            </div>

            {selectedStage ? (() => {
                const cleared = isSinglePlayerStageCleared(
                    getSinglePlayerStages(),
                    progress,
                    selectedStage.id,
                );
                const cost = cleared ? 0 : selectedStage.actionPointCost;
                const hasEnoughAP = (currentUser.actionPoints?.current ?? 0) >= cost;
                const displayName = formatSinglePlayerStageShortName(selectedStage, t);
                const modeChips = resolveStageModePresentation(selectedStage);

                return (
                    <div className="pointer-events-none absolute inset-y-0 right-2 z-20 flex items-center sm:right-3">
                        <div className="pointer-events-auto w-[16.5rem] rounded-2xl border border-white/15 bg-zinc-950/92 p-3 shadow-[0_12px_36px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
                            <div className="mb-2.5 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-[15px] font-black tracking-tight text-white">
                                        {displayName}
                                    </div>
                                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                                        {modeChips.map((chip) => (
                                            <span
                                                key={chip.labelKey}
                                                className="inline-flex min-w-0 items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5"
                                                title={t(chip.labelKey)}
                                            >
                                                <img
                                                    src={chip.icon}
                                                    alt=""
                                                    className="h-4 w-4 shrink-0 rounded object-contain"
                                                />
                                                <span className="truncate text-[10px] font-semibold text-zinc-200/90">
                                                    {t(chip.labelKey)}
                                                </span>
                                            </span>
                                        ))}
                                        {cleared ? (
                                            <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                                {t('singleplayer.cleared')}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedStageId(null)}
                                    className="shrink-0 rounded-md px-1.5 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
                                    aria-label={t('common:actions.close')}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="mb-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                                <StageClearRewardPreview
                                    reward={selectedStage.rewards.firstClear}
                                    claimed={cleared}
                                    tabShelf={false}
                                    isMobile={false}
                                    usePremiumDesktop
                                />
                            </div>
                            <TutorialAnchor id="sp-stage-enter">
                            <Button
                                onClick={() => handleStageEnter(selectedStage.id)}
                                colorScheme="none"
                                className={PREMIUM_STAGE_ENTER_CLASS}
                                disabled={!hasEnoughAP}
                                title={t('singleplayer.enterStageTitle', { cost })}
                            >
                                <ActionPointLabelWithCost label={t('singleplayer.enterStage')} cost={cost} />
                            </Button>
                            </TutorialAnchor>
                        </div>
                    </div>
                );
            })() : null}
        </div>
    );
};

export default SinglePlayerStageMap;
