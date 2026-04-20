import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    getAdventureTreasureChapterRewardDef,
    getAdventureTreasureRollPreview,
    type AdventureTreasureRollResult,
} from '../../shared/utils/adventureMapTreasureRewards.js';

type Phase = 'pick' | 'spin' | 'result';

/** 동일 세션(nonce)에서 CONFIRM이 한 번만 나가도록 (Strict Mode 이펙트 재실행 대비) */
const pendingTreasureConfirmByNonce = new Map<string, Promise<{ ok: boolean; error?: string }>>();

function shareTreasureConfirmPromise(
    nonce: string,
    run: () => Promise<{ ok: boolean; error?: string }>,
): Promise<{ ok: boolean; error?: string }> {
    const existing = pendingTreasureConfirmByNonce.get(nonce);
    if (existing) return existing;
    const p = run().finally(() => {
        pendingTreasureConfirmByNonce.delete(nonce);
    });
    pendingTreasureConfirmByNonce.set(nonce, p);
    return p;
}

const ITEM_H = 84;
const VIEW_H = 96;

function randomRollForStrip(stageIndex: number, rng: () => number): AdventureTreasureRollResult {
    const def = getAdventureTreasureChapterRewardDef(stageIndex);
    const b = rng();
    if (b < 0.25) {
        const span = def.goldMax - def.goldMin + 1;
        return { category: 'gold', gold: def.goldMin + Math.floor(rng() * span) };
    }
    if (b < 0.5) {
        const t = def.equipmentTiers[Math.floor(rng() * def.equipmentTiers.length)]!;
        return { category: 'equipment', boxRoman: t.roman };
    }
    if (b < 0.75) {
        const t = def.materialTiers[Math.floor(rng() * def.materialTiers.length)]!;
        return { category: 'material', boxRoman: t.roman };
    }
    return { category: 'actionPoints', actionPoints: def.actionPoints };
}

/** 마지막 고정 인덱스에 `roll`이 오도록 스트립 구성 */
function buildRouletteStrip(roll: AdventureTreasureRollResult, stageIndex: number, seed: number): AdventureTreasureRollResult[] {
    const rng = mulberry32(seed);
    const len = 48;
    const landAt = len - 6;
    const strip: AdventureTreasureRollResult[] = [];
    for (let i = 0; i < len; i++) {
        strip.push(i === landAt ? roll : randomRollForStrip(stageIndex, rng));
    }
    return strip;
}

function mulberry32(a: number): () => number {
    let s = a >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fnv1a32(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function easeOutCubic(t: number): number {
    const x = 1 - t;
    return 1 - x * x * x;
}

function RouletteStripCell({ roll }: { roll: AdventureTreasureRollResult }) {
    const p = getAdventureTreasureRollPreview(roll);

    if (roll.category === 'gold') {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-0.5 py-1">
                <img src={p.imageSrc} alt="" className="h-11 w-11 shrink-0 object-contain drop-shadow-md" draggable={false} />
                <span className="font-mono text-[13px] font-black tabular-nums tracking-tight text-amber-200 drop-shadow-sm sm:text-sm">
                    {roll.gold.toLocaleString()}
                </span>
            </div>
        );
    }

    if (roll.category === 'actionPoints') {
        return (
            <div className="flex h-full w-full items-stretch justify-center px-0.5 py-1">
                <div className="flex min-h-0 w-[min(100%,4.85rem)] flex-1 flex-col rounded-lg border border-cyan-200/22 bg-gradient-to-b from-cyan-400/[0.07] via-white/[0.02] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_rgba(0,0,0,0.28)] backdrop-blur-[3px]">
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center pt-1">
                        <span className="text-[1.45rem] leading-none drop-shadow-[0_2px_10px_rgba(34,211,238,0.4)]" aria-hidden>
                            ⚡
                        </span>
                    </div>
                    <span className="pb-1.5 pt-0.5 text-center font-mono text-[10px] font-black tabular-nums text-amber-200/95 sm:text-[11px]">
                        {p.subLabel}
                    </span>
                </div>
            </div>
        );
    }

    const boxTitle = roll.category === 'equipment' ? `장비 상자 ${roll.boxRoman}` : `재료 상자 ${roll.boxRoman}`;

    return (
        <div className="flex h-full flex-col items-center justify-center gap-0.5 px-0.5 py-0.5">
            <img src={p.imageSrc} alt="" className="h-[1.85rem] w-[1.85rem] shrink-0 object-contain drop-shadow-md sm:h-8 sm:w-8" draggable={false} />
            <div className="flex w-full min-w-0 justify-center origin-center scale-[0.82] sm:scale-90">
                <p
                    className="max-w-full whitespace-nowrap text-center text-[8px] font-black leading-none tracking-tight text-zinc-100 sm:text-[9px]"
                    title={boxTitle}
                >
                    {boxTitle}
                </p>
            </div>
        </div>
    );
}

const RouletteColumn: React.FC<{
    roll: AdventureTreasureRollResult;
    stageIndex: number;
    columnSeed: number;
    delayMs: number;
    active: boolean;
    onDone: () => void;
    highlight: boolean;
    dimOthers: boolean;
}> = ({ roll, stageIndex, columnSeed, delayMs, active, onDone, highlight, dimOthers }) => {
    const strip = useMemo(() => buildRouletteStrip(roll, stageIndex, columnSeed), [roll, stageIndex, columnSeed]);
    const landIndex = strip.length - 6;
    const targetY = -(landIndex * ITEM_H) + (VIEW_H - ITEM_H) / 2;
    const [y, setY] = useState(0);
    const doneRef = useRef(false);
    const startRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!active) {
            if (doneRef.current) setY(targetY);
            return;
        }
        doneRef.current = false;
        setY(0);
        const duration = 2400;
        const tick = (now: number) => {
            if (startRef.current == null) startRef.current = now + delayMs;
            if (now < startRef.current) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }
            const t0 = startRef.current;
            const u = Math.min(1, (now - t0) / duration);
            const eased = easeOutCubic(u);
            setY(eased * targetY);
            if (u >= 1 && !doneRef.current) {
                doneRef.current = true;
                setY(targetY);
                onDone();
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
            startRef.current = null;
        };
    }, [active, delayMs, onDone, targetY]);

    return (
        <div
            className={`relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border transition-[opacity,filter] duration-500 ${
                highlight
                    ? 'border-amber-300/90 shadow-[0_0_28px_rgba(251,191,36,0.45)] ring-2 ring-amber-400/70'
                    : 'border-zinc-600/70 shadow-inner'
            } ${dimOthers && !highlight ? 'opacity-45 blur-[0.5px]' : 'opacity-100'}`}
            style={{ height: VIEW_H }}
        >
            <div
                className="will-change-transform"
                style={{
                    transform: `translateY(${y}px)`,
                }}
            >
                {strip.map((r, i) => (
                    <div
                        key={i}
                        className="flex min-w-0 flex-col items-stretch justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 px-0.5"
                        style={{ height: ITEM_H }}
                    >
                        <RouletteStripCell roll={r} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export type AdventureTreasureChestPickModalProps = {
    open: boolean;
    onClose: () => void;
    stageId: string;
    stageTitle: string;
    stageIndex: number;
    equipmentBoxImage: string;
    rolls: [AdventureTreasureRollResult, AdventureTreasureRollResult, AdventureTreasureRollResult];
    pickSlots: 1 | 2;
    nonce: string;
    /** 룰렛이 모두 멈춘 뒤 자동 호출 — 열쇠 사용·인벤토리 반영 */
    onConfirm: (selectedSlots: number[]) => Promise<{ ok: boolean; error?: string }>;
    /** 수령 취소 시 — 이번 출현 보물만 숨김, 열쇠는 유지 */
    onAbandonPick: () => Promise<{ ok: boolean; error?: string }>;
    isNativeMobile?: boolean;
};

const AdventureTreasureChestPickModal: React.FC<AdventureTreasureChestPickModalProps> = ({
    open,
    onClose,
    stageId,
    stageTitle,
    stageIndex,
    equipmentBoxImage,
    rolls,
    pickSlots,
    nonce,
    onConfirm,
    onAbandonPick,
    isNativeMobile,
}) => {
    const [phase, setPhase] = useState<Phase>('pick');
    const [selected, setSelected] = useState<number[]>([]);
    const [spinTick, setSpinTick] = useState(0);
    const [spinDone, setSpinDone] = useState(0);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [errMsg, setErrMsg] = useState<string | null>(null);
    const [cancelGateOpen, setCancelGateOpen] = useState(false);
    const [abandonBusy, setAbandonBusy] = useState(false);
    const [gateErr, setGateErr] = useState<string | null>(null);
    const spinSelectedRef = useRef<number[] | null>(null);

    useEffect(() => {
        if (!open) {
            setPhase('pick');
            setSelected([]);
            setSpinTick(0);
            setSpinDone(0);
            setConfirmBusy(false);
            setErrMsg(null);
            setCancelGateOpen(false);
            setAbandonBusy(false);
            setGateErr(null);
            spinSelectedRef.current = null;
        }
    }, [open]);

    const toggleSlot = useCallback(
        (idx: number) => {
            setErrMsg(null);
            setSelected((prev) => {
                const has = prev.includes(idx);
                if (has) return prev.filter((x) => x !== idx);
                if (prev.length >= pickSlots) {
                    if (pickSlots === 1) return [idx];
                    return prev;
                }
                return [...prev, idx].sort((a, b) => a - b);
            });
        },
        [pickSlots],
    );

    const startSpin = useCallback(() => {
        let final: number[];
        if (pickSlots === 1) {
            if (selected.length !== 1) return;
            final = [selected[0]!];
        } else {
            if (selected.length < 1) return;
            if (selected.length === 1) {
                const picked = selected[0]!;
                const rest = [0, 1, 2].filter((i) => i !== picked);
                const extra = rest[Math.floor(Math.random() * rest.length)]!;
                final = [picked, extra].sort((a, b) => a - b);
            } else {
                final = [...selected].sort((a, b) => a - b);
            }
        }
        spinSelectedRef.current = final;
        setSelected(final);
        setSpinDone(0);
        setSpinTick((t) => t + 1);
        setPhase('spin');
    }, [pickSlots, selected]);

    const onColumnDone = useCallback(() => {
        setSpinDone((n) => n + 1);
    }, []);

    useEffect(() => {
        if (phase !== 'spin' || spinDone < 3) return;
        const raw = spinSelectedRef.current ?? selected;
        const slots = [...raw].sort((a, b) => a - b);
        let cancelled = false;
        setErrMsg(null);
        setConfirmBusy(true);
        void shareTreasureConfirmPromise(nonce, () => onConfirm(slots))
            .then((r) => {
                if (cancelled) return;
                if (!r.ok) {
                    setErrMsg(r.error ?? '보상을 받지 못했습니다.');
                    return;
                }
                setPhase('result');
            })
            .finally(() => {
                if (!cancelled) setConfirmBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [phase, spinDone, selected, onConfirm, nonce]);

    const handleAbandonConfirm = async () => {
        setGateErr(null);
        setAbandonBusy(true);
        try {
            const r = await onAbandonPick();
            if (!r.ok) {
                setGateErr(r.error ?? '처리하지 못했습니다.');
                return;
            }
            setCancelGateOpen(false);
            onClose();
        } finally {
            setAbandonBusy(false);
        }
    };

    if (!open) return null;

    const pickHint =
        pickSlots === 2
            ? '보상 VIP: 두 칸을 직접 고르거나, 한 칸만 고르면 나머지 한 칸은 무작위로 정해집니다.'
            : '받을 상자 하나를 고른 뒤 선택 완료를 누르세요.';

    return (
        <div
            className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-2 py-6 backdrop-blur-sm ${
                isNativeMobile ? 'pb-[max(1rem,env(safe-area-inset-bottom,0px))]' : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adv-treasure-modal-title"
        >
            <div
                className={`relative flex max-h-[min(92vh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-[0_24px_80px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] ${
                    isNativeMobile ? 'max-h-[90vh]' : ''
                }`}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.14),transparent_55%)]" />
                <header className="relative z-[1] shrink-0 border-b border-amber-500/20 px-4 pb-3 pt-4">
                    <h2 id="adv-treasure-modal-title" className="text-lg font-black tracking-tight text-amber-50 drop-shadow-sm sm:text-xl">
                        보물상자-{stageTitle}
                    </h2>
                    <p className="mt-1.5 text-xs leading-snug text-zinc-400">{pickHint}</p>
                    <p className="mt-1.5 font-mono text-xs font-bold tabular-nums tracking-wide text-amber-200/95">
                        상자를 선택하세요 ({selected.length}/{pickSlots})
                    </p>
                </header>

                <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 sm:px-4">
                    {phase === 'pick' && (
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2 sm:gap-3">
                                {[0, 1, 2].map((idx) => {
                                    const on = selected.includes(idx);
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleSlot(idx)}
                                            className={`group relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-left transition-all sm:gap-2 sm:p-3 ${
                                                on
                                                    ? 'border-amber-400 bg-amber-950/55 shadow-[0_0_24px_rgba(251,191,36,0.35)]'
                                                    : 'border-zinc-600/80 bg-zinc-900/80 hover:border-amber-500/50 hover:bg-zinc-800/80'
                                            }`}
                                        >
                                            <div className="relative aspect-square w-full max-w-[100px] shrink-0">
                                                <img
                                                    src={equipmentBoxImage}
                                                    alt=""
                                                    className={`h-full w-full object-contain drop-shadow-lg transition-transform duration-300 ${
                                                        on ? 'scale-105' : 'group-hover:scale-[1.03]'
                                                    }`}
                                                />
                                                {on ? (
                                                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-zinc-950 shadow">
                                                        ✓
                                                    </span>
                                                ) : null}
                                            </div>
                                            <span className="w-full text-center text-[11px] font-bold text-amber-100/95">상자 {idx + 1}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {(phase === 'spin' || phase === 'result') && (
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2 sm:gap-3">
                                {rolls.map((roll, col) => (
                                    <RouletteColumn
                                        key={`${spinTick}-${col}`}
                                        roll={roll}
                                        stageIndex={stageIndex}
                                        columnSeed={fnv1a32(`${nonce}|${stageId}|${col}`)}
                                        delayMs={col * 220}
                                        active={phase === 'spin'}
                                        onDone={onColumnDone}
                                        highlight={phase === 'result' && selected.includes(col)}
                                        dimOthers={phase === 'result'}
                                    />
                                ))}
                            </div>
                            {phase === 'spin' && (spinDone < 3 || confirmBusy) ? (
                                <p className="text-center text-[11px] font-semibold text-amber-200/90">
                                    {spinDone < 3 ? '룰렛 진행 중…' : '보상 반영 중…'}
                                </p>
                            ) : null}
                        </div>
                    )}

                    {errMsg ? (
                        <p className="mt-3 rounded-md border border-red-500/40 bg-red-950/40 px-2 py-1.5 text-center text-xs text-red-100">
                            {errMsg}
                        </p>
                    ) : null}
                </div>

                <footer className="relative z-[1] flex shrink-0 justify-center border-t border-zinc-800/90 bg-gradient-to-t from-black/80 via-zinc-950/95 to-zinc-950/90 px-3 py-3.5 sm:px-4">
                    {phase === 'pick' ? (
                        <div className="flex w-full max-w-xs justify-center gap-2.5 sm:max-w-sm sm:gap-3">
                            <button
                                type="button"
                                className="group relative inline-flex min-w-[6.75rem] max-w-[8.25rem] flex-none shrink-0 justify-center overflow-hidden rounded-xl border border-zinc-500/45 bg-gradient-to-b from-zinc-600/50 via-zinc-800/90 to-zinc-950/95 px-3 py-2.5 text-sm font-black tracking-wide text-zinc-100 shadow-[0_6px_20px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:border-zinc-400/55 hover:from-zinc-500/55 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:translate-y-px sm:min-w-[7.25rem] sm:max-w-[8.5rem] sm:px-4"
                                onClick={() => {
                                    setGateErr(null);
                                    setCancelGateOpen(true);
                                }}
                            >
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                />
                                <span className="relative z-[1]">취소</span>
                            </button>
                            <button
                                type="button"
                                disabled={selected.length < 1 || (pickSlots === 1 && selected.length !== 1)}
                                className="group relative inline-flex min-w-[7.5rem] max-w-[9.5rem] flex-none shrink-0 justify-center overflow-hidden rounded-xl border border-amber-400/55 bg-gradient-to-b from-amber-500/40 via-amber-600/25 to-zinc-950/90 px-3.5 py-2.5 text-sm font-black tracking-wide text-amber-50 shadow-[0_8px_28px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all duration-200 enabled:hover:border-amber-300/70 enabled:hover:from-amber-400/50 enabled:hover:shadow-[0_12px_32px_rgba(251,191,36,0.22)] enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:min-w-[8.25rem] sm:max-w-[10rem] sm:px-4"
                                onClick={startSpin}
                            >
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                />
                                <span className="relative z-[1] drop-shadow-sm">선택 완료</span>
                            </button>
                        </div>
                    ) : phase === 'result' ? (
                        <button
                            type="button"
                            className="group relative mx-auto inline-flex min-w-[8.5rem] max-w-[10.5rem] justify-center overflow-hidden rounded-xl border border-emerald-400/45 bg-gradient-to-b from-emerald-500/45 via-teal-700/35 to-zinc-950/90 px-6 py-2.5 text-sm font-black tracking-wide text-white shadow-[0_8px_28px_rgba(16,185,129,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:border-emerald-300/60 hover:from-emerald-400/55 hover:shadow-[0_12px_36px_rgba(16,185,129,0.28)] active:translate-y-px sm:min-w-[9rem] sm:max-w-[11rem]"
                            onClick={onClose}
                        >
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            />
                            <span className="relative z-[1] drop-shadow-sm">보상 받기</span>
                        </button>
                    ) : spinDone >= 3 && errMsg && !confirmBusy ? (
                        <button
                            type="button"
                            className="group relative mx-auto inline-flex min-w-[8.5rem] max-w-[10.5rem] justify-center overflow-hidden rounded-xl border border-zinc-500/45 bg-gradient-to-b from-zinc-600/45 via-zinc-800/90 to-zinc-950/95 px-6 py-2.5 text-sm font-black tracking-wide text-zinc-100 shadow-[0_6px_20px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:border-zinc-400/55 active:translate-y-px"
                            onClick={onClose}
                        >
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            />
                            <span className="relative z-[1]">확인</span>
                        </button>
                    ) : (
                        <div className="w-full py-1 text-center text-xs text-zinc-500">
                            {spinDone >= 3 && confirmBusy ? '보상 반영 중…' : '잠시만 기다려 주세요'}
                        </div>
                    )}
                </footer>
            </div>

            {cancelGateOpen ? (
                <div
                    className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
                    role="presentation"
                    onClick={() => {
                        if (!abandonBusy) {
                            setGateErr(null);
                            setCancelGateOpen(false);
                        }
                    }}
                >
                    <div
                        role="alertdialog"
                        aria-labelledby="adv-treasure-cancel-gate-title"
                        aria-describedby="adv-treasure-cancel-gate-desc"
                        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-5 shadow-[0_24px_80px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 id="adv-treasure-cancel-gate-title" className="text-base font-black tracking-tight text-amber-50 sm:text-lg">
                            취소하시겠습니까?
                        </h3>
                        <p id="adv-treasure-cancel-gate-desc" className="mt-2 text-sm leading-relaxed text-zinc-300">
                            취소하면 이 보물상자는 이번 출현에서 더 이상 나타나지 않습니다. 열쇠는 그대로 유지됩니다.
                        </p>
                        {gateErr ? (
                            <p className="mt-3 rounded-md border border-red-500/40 bg-red-950/50 px-2 py-1.5 text-center text-xs text-red-100">
                                {gateErr}
                            </p>
                        ) : null}
                        <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center sm:gap-3">
                            <button
                                type="button"
                                disabled={abandonBusy}
                                className="group relative inline-flex w-full max-w-[10rem] shrink-0 justify-center overflow-hidden rounded-xl border border-amber-400/55 bg-gradient-to-b from-amber-500/40 via-amber-600/25 to-zinc-950/90 px-4 py-2.5 text-sm font-black tracking-wide text-amber-50 shadow-[0_6px_20px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 enabled:hover:border-amber-300/70 enabled:active:translate-y-px disabled:opacity-50 sm:w-auto sm:min-w-[7.75rem] sm:max-w-[9rem] sm:px-4"
                                onClick={() => {
                                    if (!abandonBusy) {
                                        setGateErr(null);
                                        setCancelGateOpen(false);
                                    }
                                }}
                            >
                                <span className="relative z-[1]">보상수령</span>
                            </button>
                            <button
                                type="button"
                                disabled={abandonBusy}
                                className="group relative inline-flex w-full max-w-[10rem] shrink-0 justify-center overflow-hidden rounded-xl border border-zinc-500/50 bg-gradient-to-b from-zinc-700/60 via-zinc-900/95 to-black px-4 py-2.5 text-sm font-black tracking-wide text-zinc-100 shadow-[0_6px_20px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 enabled:hover:border-zinc-400/60 enabled:active:translate-y-px disabled:opacity-50 sm:w-auto sm:min-w-[7.75rem] sm:max-w-[9rem] sm:px-4"
                                onClick={() => void handleAbandonConfirm()}
                            >
                                <span className="relative z-[1]">{abandonBusy ? '처리 중…' : '수령취소'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default AdventureTreasureChestPickModal;
