import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ServerAction, SinglePlayerStageInfo } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import {
    DEFAULT_SINGLE_PLAYER_STAGES,
    SINGLE_PLAYER_STAGES,
    setSinglePlayerStagesFromServer,
} from '../../constants/singlePlayerConstants.js';
import { SinglePlayerLevel } from '../../types/enums.js';

const LEVEL_SHORT: Partial<Record<SinglePlayerLevel, string>> = {
    [SinglePlayerLevel.입문]: '입문',
    [SinglePlayerLevel.초급]: '초급',
    [SinglePlayerLevel.중급]: '중급',
    [SinglePlayerLevel.고급]: '고급',
    [SinglePlayerLevel.유단자]: '유단',
};

function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex) return list;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

const CLICK_DRAG_THRESHOLD_SQ = 8 * 8;

function ensureRewardsShape(stage: SinglePlayerStageInfo): SinglePlayerStageInfo['rewards'] {
    const r = stage.rewards;
    const firstClear = {
        gold: r?.firstClear?.gold ?? 0,
        exp: r?.firstClear?.exp ?? 0,
        ...(r?.firstClear?.items?.length ? { items: r.firstClear.items } : {}),
        ...(r?.firstClear?.bonus ? { bonus: r.firstClear.bonus } : {}),
    };
    const repeatClear = {
        gold: r?.repeatClear?.gold ?? 0,
        exp: r?.repeatClear?.exp ?? 0,
        ...(r?.repeatClear?.items?.length ? { items: r.repeatClear.items } : {}),
        ...(r?.repeatClear?.bonus ? { bonus: r.repeatClear.bonus } : {}),
    };
    return { firstClear, repeatClear };
}

export interface SinglePlayerStageOrderEditorProps {
    open: boolean;
    onClose: () => void;
    onAction: (action: ServerAction) => Promise<any> | void;
    /** 저장 직후 pending 싱글 경기 세션에 최신 스테이지 정의 반영 */
    pendingSinglePlayerGameId?: string;
}

const SinglePlayerStageOrderEditor: React.FC<SinglePlayerStageOrderEditorProps> = ({
    open,
    onClose,
    onAction,
    pendingSinglePlayerGameId,
}) => {
    const [ordered, setOrdered] = useState<SinglePlayerStageInfo[]>(() => SINGLE_PLAYER_STAGES.map((s) => ({ ...s })));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const pointerPickRef = useRef<{ x: number; y: number; index: number } | null>(null);

    useEffect(() => {
        if (!open) return;
        setOrdered(SINGLE_PLAYER_STAGES.map((s) => ({ ...s })));
        setError('');
        setDragIndex(null);
        setSelectedSlotIndex(null);
        pointerPickRef.current = null;
    }, [open]);

    useEffect(() => {
        if (selectedSlotIndex !== null && (selectedSlotIndex < 0 || selectedSlotIndex >= ordered.length)) {
            setSelectedSlotIndex(null);
        }
    }, [ordered.length, selectedSlotIndex]);

    const resetToDefaultOrder = useCallback(() => {
        setOrdered(DEFAULT_SINGLE_PLAYER_STAGES.map((s) => ({ ...s })));
        setError('');
    }, []);

    const onDragStart = useCallback((e: React.DragEvent, index: number) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        try {
            e.dataTransfer.setDragImage(e.currentTarget, 20, 16);
        } catch {
            /* ignore */
        }
    }, []);

    const onDragEnd = useCallback(() => {
        setDragIndex(null);
    }, []);

    const onDragOverSlot = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const onDropOnSlot = useCallback((e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('text/plain');
        const from = parseInt(raw, 10);
        if (!Number.isFinite(from) || from < 0 || from >= ordered.length) return;
        setOrdered((prev) => reorderList(prev, from, dropIndex));
        setDragIndex(null);
        setSelectedSlotIndex((cur) => {
            if (cur === null) return null;
            if (cur === from) return dropIndex;
            if (from < dropIndex && cur > from && cur <= dropIndex) return cur - 1;
            if (from > dropIndex && cur >= dropIndex && cur < from) return cur + 1;
            return cur;
        });
    }, [ordered.length]);

    const onSlotPointerDown = useCallback((e: React.PointerEvent, index: number) => {
        pointerPickRef.current = { x: e.clientX, y: e.clientY, index };
    }, []);

    const onSlotPointerUp = useCallback((e: React.PointerEvent, index: number) => {
        const start = pointerPickRef.current;
        pointerPickRef.current = null;
        if (!start || start.index !== index) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dx * dx + dy * dy > CLICK_DRAG_THRESHOLD_SQ) return;
        setSelectedSlotIndex(index);
    }, []);

    const patchSlotEconomy = useCallback((index: number, updater: (stage: SinglePlayerStageInfo) => SinglePlayerStageInfo) => {
        setOrdered((prev) => {
            const next = [...prev];
            const cur = next[index];
            if (!cur) return prev;
            next[index] = updater({ ...cur, rewards: ensureRewardsShape(cur) });
            return next;
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = ordered.map((s) => ({ ...s }));
            const result = (await onAction({
                type: 'ADMIN_SET_SINGLE_PLAYER_STAGES',
                payload: { stages: payload },
            } as ServerAction)) as
                | { clientResponse?: { singlePlayerStages?: SinglePlayerStageInfo[] }; singlePlayerStages?: SinglePlayerStageInfo[]; error?: string }
                | void;
            if (result && typeof result === 'object' && 'error' in result && result.error) {
                throw new Error(String(result.error));
            }
            const r = result && typeof result === 'object' ? result : null;
            const fromServer = r?.clientResponse?.singlePlayerStages ?? r?.singlePlayerStages;
            if (Array.isArray(fromServer) && fromServer.length > 0) {
                setSinglePlayerStagesFromServer(fromServer);
                setOrdered(fromServer.map((s) => ({ ...s })));
            } else {
                setSinglePlayerStagesFromServer(payload);
            }
            if (pendingSinglePlayerGameId) {
                try {
                    await onAction({
                        type: 'SINGLE_PLAYER_SYNC_PENDING_STAGE',
                        payload: { gameId: pendingSinglePlayerGameId },
                    } as ServerAction);
                } catch (e) {
                    console.warn('[SinglePlayerStageOrderEditor] pending sync after order save:', e);
                }
            }
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return createPortal(
        <DraggableWindow
            title="바둑학원 스테이지 순서"
            onClose={onClose}
            initialWidth={1020}
            initialHeight={720}
            windowId="admin-single-player-stage-order"
            modal
            transparentModalBackdrop
        >
            <div className="flex min-h-0 flex-col gap-2 p-3 text-stone-100">
                <p className="text-sm leading-snug text-amber-100/85">
                    그리드에서 카드를 드래그해 플레이 순서를 바꿉니다. 저장 시 각 칸은 입문-1, 입문-2 …처럼{' '}
                    <span className="font-semibold text-amber-50">고정 ID·이름</span>을 쓰고, 그 칸에 넣은 미션 내용만 바뀝니다. 기존 유저의 클리어 기록·진행도는
                    서버에서 자동으로 새 ID에 맞게 옮겨집니다. 카드를 짧게 누르면 액션포인트·첫/반복 클리어 골드·경험치를 이 창에서 바꿀 수 있습니다.
                </p>
                {error ? <p className="text-sm font-semibold text-rose-300">{error}</p> : null}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-stretch">
                    <div
                        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-amber-500/25 bg-black/35 p-2 [scrollbar-gutter:stable] md:min-w-0"
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-[repeat(12,minmax(0,1fr))] xl:grid-cols-[repeat(14,minmax(0,1fr))] 2xl:grid-cols-[repeat(16,minmax(0,1fr))]">
                            {ordered.map((stage, index) => {
                                const short = LEVEL_SHORT[stage.level as SinglePlayerLevel] ?? '?';
                                const tail = stage.id.split('-').pop() ?? stage.id;
                                const isDragging = dragIndex === index;
                                const isSelected = selectedSlotIndex === index;
                                return (
                                    <div
                                        key={stage.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, index)}
                                        onDragEnd={onDragEnd}
                                        onDragOver={onDragOverSlot}
                                        onDrop={(e) => onDropOnSlot(e, index)}
                                        onPointerDown={(e) => onSlotPointerDown(e, index)}
                                        onPointerUp={(e) => onSlotPointerUp(e, index)}
                                        onPointerCancel={() => {
                                            pointerPickRef.current = null;
                                        }}
                                        title={`${index + 1}. ${stage.id} — 드래그: 순서 변경 · 짧게 누르기: 보상·AP`}
                                        className={`flex cursor-grab select-none flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 text-center text-[10px] leading-tight transition-colors active:cursor-grabbing sm:text-[11px] ${
                                            isDragging
                                                ? 'border-amber-300/80 bg-amber-900/40 ring-1 ring-amber-400/50'
                                                : isSelected
                                                  ? 'border-amber-200/70 bg-amber-950/50 ring-1 ring-amber-300/60'
                                                  : 'border-amber-500/20 bg-zinc-900/80 hover:border-amber-400/45 hover:bg-zinc-800/90'
                                        }`}
                                    >
                                        <span className="font-mono text-[9px] text-amber-200/70 tabular-nums sm:text-[10px]">{index + 1}</span>
                                        <span className="max-w-full truncate font-bold text-amber-50/95">{tail}</span>
                                        <span className="text-[9px] text-zinc-400">{short}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {selectedSlotIndex !== null && ordered[selectedSlotIndex] ? (
                        <div className="flex w-full shrink-0 flex-col gap-2 rounded-lg border border-amber-500/30 bg-zinc-950/90 p-3 md:w-[min(20rem,100%)] md:border-l md:border-t-0 md:border-amber-500/25">
                            <div className="flex items-start justify-between gap-2 border-b border-amber-500/20 pb-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-amber-200/90">슬롯 {selectedSlotIndex + 1}</p>
                                    <p className="truncate font-mono text-xs text-amber-50/95">{ordered[selectedSlotIndex]!.id}</p>
                                </div>
                                <button
                                    type="button"
                                    className="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-700"
                                    onClick={() => setSelectedSlotIndex(null)}
                                >
                                    닫기
                                </button>
                            </div>
                            {(() => {
                                const st = ordered[selectedSlotIndex]!;
                                const rw = ensureRewardsShape(st);
                                return (
                                    <div className="flex flex-col gap-2 text-stone-100">
                                        <label className="text-xs text-zinc-300">
                                            소모 액션포인트
                                            <input
                                                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                                                type="number"
                                                value={st.actionPointCost}
                                                onChange={(e) =>
                                                    patchSlotEconomy(selectedSlotIndex, (prev) => ({
                                                        ...prev,
                                                        actionPointCost: Number(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="text-xs text-zinc-300">
                                                첫 클리어 골드
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                                                    type="number"
                                                    value={rw.firstClear.gold}
                                                    onChange={(e) =>
                                                        patchSlotEconomy(selectedSlotIndex, (prev) => {
                                                            const r0 = ensureRewardsShape(prev);
                                                            return {
                                                                ...prev,
                                                                rewards: {
                                                                    ...r0,
                                                                    firstClear: { ...r0.firstClear, gold: Number(e.target.value) || 0 },
                                                                },
                                                            };
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="text-xs text-zinc-300">
                                                첫 클리어 경험치
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                                                    type="number"
                                                    value={rw.firstClear.exp}
                                                    onChange={(e) =>
                                                        patchSlotEconomy(selectedSlotIndex, (prev) => {
                                                            const r0 = ensureRewardsShape(prev);
                                                            return {
                                                                ...prev,
                                                                rewards: {
                                                                    ...r0,
                                                                    firstClear: { ...r0.firstClear, exp: Number(e.target.value) || 0 },
                                                                },
                                                            };
                                                        })
                                                    }
                                                />
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="text-xs text-zinc-300">
                                                반복 클리어 골드
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                                                    type="number"
                                                    value={rw.repeatClear.gold}
                                                    onChange={(e) =>
                                                        patchSlotEconomy(selectedSlotIndex, (prev) => {
                                                            const r0 = ensureRewardsShape(prev);
                                                            return {
                                                                ...prev,
                                                                rewards: {
                                                                    ...r0,
                                                                    repeatClear: { ...r0.repeatClear, gold: Number(e.target.value) || 0 },
                                                                },
                                                            };
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="text-xs text-zinc-300">
                                                반복 클리어 경험치
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                                                    type="number"
                                                    value={rw.repeatClear.exp}
                                                    onChange={(e) =>
                                                        patchSlotEconomy(selectedSlotIndex, (prev) => {
                                                            const r0 = ensureRewardsShape(prev);
                                                            return {
                                                                ...prev,
                                                                rewards: {
                                                                    ...r0,
                                                                    repeatClear: { ...r0.repeatClear, exp: Number(e.target.value) || 0 },
                                                                },
                                                            };
                                                        })
                                                    }
                                                />
                                            </label>
                                        </div>
                                        <p className="text-[10px] leading-snug text-zinc-500">
                                            첫 클리어 아이템 등은 스테이지 편집에서 설정합니다. 여기서는 골드·경험치·AP만 바뀝니다.
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t border-amber-500/20 pt-2">
                    <Button type="button" colorScheme="gray" onClick={resetToDefaultOrder} disabled={saving} className="!px-3 !py-2 text-sm">
                        공장 기본 순서
                    </Button>
                    <Button type="button" colorScheme="gray" onClick={onClose} disabled={saving} className="!px-3 !py-2 text-sm">
                        취소
                    </Button>
                    <Button type="button" colorScheme="accent" onClick={() => void handleSave()} disabled={saving} className="!px-4 !py-2 text-sm font-semibold">
                        {saving ? '저장 중…' : '순서 저장'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>,
        document.body
    );
};

export default SinglePlayerStageOrderEditor;
