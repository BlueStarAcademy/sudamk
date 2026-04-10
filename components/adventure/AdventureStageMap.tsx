import React, { useLayoutEffect, useEffect, useRef, useState, useCallback } from 'react';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    ADVENTURE_MAP_THEMES,
    ADVENTURE_MAP_MAX_MONSTERS,
    ADVENTURE_MONSTER_IMAGE_SRC,
    ADVENTURE_MONSTER_MODES,
    ADVENTURE_MONSTER_MODE_LABELS,
    ADVENTURE_MONSTER_RESPAWN_AFTER_DEFEAT_MS,
    ADVENTURE_MONSTER_SPAWN_INTERVAL_MS,
    getAdventureMonsterLifetimeMs,
    getAdventureStageById,
    getAdventureStageLevelRange,
    type AdventureMonsterBattleMode,
    type AdventureStageId,
} from '../../constants/adventureConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import Avatar from '../Avatar.js';
import Button from '../Button.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants.js';

type Props = { stageId: string };

type MapMonster = {
    id: string;
    level: number;
    mode: AdventureMonsterBattleMode;
    xPct: number;
    yPct: number;
    expiresAt: number;
    /** 비어 있으면 플레이스홀더(추후 `ADVENTURE_MONSTER_IMAGE_SRC` 등) */
    imageSrc?: string;
};

const MODE_BADGE_SHORT: Record<AdventureMonsterBattleMode, string> = {
    classic: '클',
    capture: '따',
    base: '베',
    hidden: '히',
    missile: '미',
};

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPosition(): { xPct: number; yPct: number } {
    return {
        xPct: 14 + Math.random() * 72,
        yPct: 16 + Math.random() * 68,
    };
}

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

const AdventureStageMap: React.FC<Props> = ({ stageId }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus } = useAppContext();
    const stage = getAdventureStageById(stageId);
    const theme = stage ? ADVENTURE_MAP_THEMES[stage.id as AdventureStageId] : null;

    const [monsters, setMonsters] = useState<MapMonster[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [, setUiTick] = useState(0);
    const idSeq = useRef(0);
    const respawnQueueRef = useRef<number[]>([]);
    const spawnOneRef = useRef<() => MapMonster | null>(() => null);

    const nextMonsterId = useCallback(() => {
        idSeq.current += 1;
        return `adv-m-${idSeq.current}`;
    }, []);

    const spawnOne = useCallback((): MapMonster | null => {
        if (!stage) return null;
        const { min, max } = getAdventureStageLevelRange(stage.stageIndex);
        const mode = ADVENTURE_MONSTER_MODES[randomInt(0, ADVENTURE_MONSTER_MODES.length - 1)]!;
        const { xPct, yPct } = randomPosition();
        const level = randomInt(min, max);
        const life = getAdventureMonsterLifetimeMs(level);
        const imageSrc = ADVENTURE_MONSTER_IMAGE_SRC[mode];
        return {
            id: nextMonsterId(),
            level,
            mode,
            xPct,
            yPct,
            expiresAt: Date.now() + life,
            ...(imageSrc ? { imageSrc } : {}),
        };
    }, [stage, nextMonsterId]);

    spawnOneRef.current = spawnOne;

    useLayoutEffect(() => {
        if (!stage || !theme) replaceAppHash('#/adventure');
    }, [stage, theme]);

    useEffect(() => {
        if (!stage) return;
        const prune = window.setInterval(() => {
            const now = Date.now();
            setMonsters((prev) => prev.filter((m) => m.expiresAt > now));
        }, 5000);
        return () => clearInterval(prune);
    }, [stage?.id]);

    useEffect(() => {
        if (!stage) return;
        const spawn = window.setInterval(() => {
            setMonsters((prev) => {
                const now = Date.now();
                const alive = prev.filter((m) => m.expiresAt > now);
                if (alive.length >= ADVENTURE_MAP_MAX_MONSTERS) return alive;
                const created = spawnOneRef.current();
                return created ? [...alive, created] : alive;
            });
        }, ADVENTURE_MONSTER_SPAWN_INTERVAL_MS);
        return () => clearInterval(spawn);
    }, [stage?.id]);

    useEffect(() => {
        if (!stage) return;
        const t1 = window.setTimeout(() => {
            const m = spawnOneRef.current();
            if (m) setMonsters((p) => [...p, m]);
        }, 500);
        const t2 = window.setTimeout(() => {
            const m = spawnOneRef.current();
            if (m) setMonsters((p) => (p.length < ADVENTURE_MAP_MAX_MONSTERS ? [...p, m] : p));
        }, 2000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [stage?.id]);

    useEffect(() => {
        if (!stage) return;
        const id = window.setInterval(() => {
            const now = Date.now();
            setMonsters((prev) => {
                const alive = prev.filter((m) => m.expiresAt > now);
                let next = alive;
                while (respawnQueueRef.current.length > 0 && respawnQueueRef.current[0] <= now) {
                    respawnQueueRef.current.shift();
                    if (next.length >= ADVENTURE_MAP_MAX_MONSTERS) continue;
                    const s = spawnOneRef.current();
                    if (s) next = [...next, s];
                }
                return next;
            });
        }, 2500);
        return () => clearInterval(id);
    }, [stage?.id]);

    useEffect(() => {
        if (!selectedId) return;
        const id = window.setInterval(() => setUiTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [selectedId]);

    const selectedMonster = selectedId ? monsters.find((m) => m.id === selectedId) : undefined;

    useEffect(() => {
        if (selectedId && !monsters.some((m) => m.id === selectedId)) {
            setSelectedId(null);
        }
    }, [monsters, selectedId]);

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

    const handleAttackSuccess = () => {
        if (!selectedMonster) return;
        const victimId = selectedMonster.id;
        setMonsters((prev) => prev.filter((m) => m.id !== victimId));
        setSelectedId(null);
        respawnQueueRef.current.push(Date.now() + ADVENTURE_MONSTER_RESPAWN_AFTER_DEFEAT_MS);
        respawnQueueRef.current.sort((a, b) => a - b);
        // 추후: 모험 대국 세션 생성
        console.log('[Adventure] 공격 성공(임시) → 20분 후 재스폰 슬롯', victimId);
    };

    const bubbleBelow = selectedMonster ? selectedMonster.yPct < 24 : false;
    const now = Date.now();

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5' : 'h-full min-h-0 p-2 sm:p-4 lg:p-8'
            }`}
        >
            <header
                className={`flex flex-shrink-0 items-center ${isNativeMobile ? 'mb-1 justify-between px-1 py-1' : 'mb-2 justify-between px-1 sm:mb-3 sm:px-0'}`}
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

            <div className="flex min-h-0 flex-1 flex-row gap-1.5 overflow-hidden sm:gap-2">
                <aside className="flex w-[7.25rem] shrink-0 flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-zinc-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:w-44">
                    <div className="shrink-0 border-b border-white/10 p-1.5 sm:p-2">
                        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-amber-400/90 sm:text-[10px]">유저</p>
                        {currentUserWithStatus ? (
                            <div className="flex flex-col items-center gap-1">
                                <Avatar
                                    userId={currentUserWithStatus.id}
                                    userName={currentUserWithStatus.nickname || 'Player'}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={isNativeMobile ? 36 : 44}
                                />
                                <p className="max-w-full truncate text-center text-[11px] font-bold text-amber-50 sm:text-xs">
                                    {currentUserWithStatus.nickname}
                                </p>
                                <div className="flex w-full flex-col gap-0.5 text-[9px] text-zinc-400 sm:text-[10px]">
                                    <div className="flex justify-between gap-1 border-t border-white/5 pt-1">
                                        <span>전략</span>
                                        <span className="font-mono text-cyan-200">Lv.{currentUserWithStatus.strategyLevel}</span>
                                    </div>
                                    <div className="flex justify-between gap-1">
                                        <span>놀이</span>
                                        <span className="font-mono text-amber-200">Lv.{currentUserWithStatus.playfulLevel}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-[10px] text-zinc-500">로딩…</p>
                        )}
                    </div>
                    <div className="flex flex-1 flex-col justify-center p-2 text-center">
                        <p className="text-[9px] leading-snug text-zinc-500 sm:text-[10px]">
                            맵에서 몬스터를 누르면 말풍선으로 정보가 열립니다.
                        </p>
                    </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center py-0.5">
                    <div
                        className="relative w-full overflow-visible rounded-xl border-2 border-amber-500/30 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(255,255,255,0.06)] sm:rounded-2xl"
                        style={{
                            maxWidth: 'min(100%, calc((100dvh - 10rem) * 16 / 9))',
                        }}
                    >
                        <div className="relative w-full overflow-visible" style={{ paddingBottom: '56.25%' }}>
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
                                <div className="pointer-events-none absolute inset-2 z-[1] rounded-lg border border-white/10 sm:inset-3" />
                                <div className="pointer-events-none absolute left-3 top-3 z-[1] rounded border border-amber-400/25 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100/90 backdrop-blur-sm sm:left-4 sm:top-4 sm:text-[10px]">
                                    STAGE {stage.stageIndex}
                                </div>
                                <div className="pointer-events-none absolute bottom-3 right-3 z-[1] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-[10px] font-black text-amber-100/90 shadow-lg backdrop-blur-sm sm:bottom-4 sm:right-4">
                                    N
                                </div>

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
                                                'absolute z-20 w-[min(28%,13rem)] touch-manipulation select-none',
                                                '-translate-x-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                                                sel ? 'scale-[1.03]' : 'hover:scale-[1.02] active:scale-[0.99]',
                                            ].join(' ')}
                                            style={{ left: `${m.xPct}%`, top: `${m.yPct}%`, aspectRatio: '3 / 4' }}
                                            aria-label={`몬스터 레벨 ${m.level} ${ADVENTURE_MONSTER_MODE_LABELS[m.mode]}`}
                                        >
                                            <div
                                                className={[
                                                    'flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 shadow-2xl transition-colors',
                                                    sel
                                                        ? 'border-amber-300 ring-2 ring-amber-400/50'
                                                        : 'border-violet-500/55 hover:border-amber-400/60',
                                                ].join(' ')}
                                            >
                                                <div className="relative min-h-0 flex-1 bg-zinc-950/90">
                                                    {m.imageSrc ? (
                                                        <img
                                                            src={m.imageSrc}
                                                            alt=""
                                                            className="absolute inset-0 h-full w-full object-cover object-center"
                                                            draggable={false}
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-zinc-800/95 to-zinc-950 px-1 text-center">
                                                            <span className="text-[10px] font-bold text-zinc-500 sm:text-xs">몬스터</span>
                                                            <span className="text-[8px] leading-tight text-zinc-600 sm:text-[9px]">
                                                                이미지
                                                                <br />
                                                                예정
                                                            </span>
                                                            <span className="mt-1 rounded border border-white/10 bg-black/40 px-1.5 py-px font-mono text-[9px] text-amber-200/90">
                                                                LV {m.level}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 items-center justify-between gap-1 border-t border-white/10 bg-black/80 px-1.5 py-1">
                                                    <span className="font-mono text-[10px] font-black text-amber-200 sm:text-[11px]">LV{m.level}</span>
                                                    <span className="rounded bg-violet-950/80 px-1 font-mono text-[9px] font-bold text-fuchsia-200 sm:text-[10px]">
                                                        {MODE_BADGE_SHORT[m.mode]}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}

                                {selectedMonster && (
                                    <div
                                        role="dialog"
                                        aria-label="몬스터 정보"
                                        className="pointer-events-auto absolute z-40 w-[min(92%,15.5rem)]"
                                        style={{
                                            left: `${selectedMonster.xPct}%`,
                                            top: `${selectedMonster.yPct}%`,
                                            transform: bubbleBelow
                                                ? 'translate(-50%, calc(50% + min(22vw, 7.5rem)))'
                                                : 'translate(-50%, calc(-100% - 18px))',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="relative rounded-xl border border-amber-400/45 bg-zinc-950/95 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-md">
                                            {!bubbleBelow && (
                                                <div
                                                    className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-amber-400/45 bg-zinc-950/95"
                                                    aria-hidden
                                                />
                                            )}
                                            {bubbleBelow && (
                                                <div
                                                    className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-400/45 bg-zinc-950/95"
                                                    aria-hidden
                                                />
                                            )}
                                            <div className="relative z-[1] space-y-1.5">
                                                <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-1.5">
                                                    <span className="text-[11px] text-zinc-400">레벨</span>
                                                    <span className="font-mono text-base font-black text-amber-200">LV {selectedMonster.level}</span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-zinc-500">경기 종류</p>
                                                    <p className="text-sm font-bold text-fuchsia-100">
                                                        {ADVENTURE_MONSTER_MODE_LABELS[selectedMonster.mode]}
                                                    </p>
                                                </div>
                                                <p className="text-[10px] text-zinc-500">
                                                    남은 시간{' '}
                                                    <span className="font-mono text-amber-100/90">
                                                        {formatRemainMs(selectedMonster.expiresAt - now)}
                                                    </span>
                                                </p>
                                                <p className="text-[9px] leading-snug text-zinc-600">
                                                    처치 시 20분 뒤 같은 슬롯에서 다시 나타날 수 있습니다.
                                                </p>
                                                <Button
                                                    type="button"
                                                    onClick={handleAttackSuccess}
                                                    colorScheme="accent"
                                                    className="!mt-1 w-full !justify-center !py-2 !text-xs !font-bold"
                                                >
                                                    공격하기
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdventureStageMap;
