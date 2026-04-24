import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameMode, SinglePlayerStageInfo, SinglePlayerStrategicRulePreset } from '../../types/index.js';
import {
    inferSinglePlayerStrategicRulePreset,
} from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import Button from '../Button.js';

const RULE_PRESET_OPTIONS: { value: Exclude<SinglePlayerStrategicRulePreset, 'auto'>; label: string }[] = [
    { value: 'classic', label: '클래식' },
    { value: 'capture', label: '따내기' },
    { value: 'survival', label: '살리기' },
    { value: 'speed', label: '스피드' },
    { value: 'base', label: '베이스' },
    { value: 'hidden', label: '히든' },
    { value: 'missile', label: '미사일' },
    { value: 'mix', label: '믹스룰' },
];

type Scope = 'singleplayer' | 'tower' | 'guildWar';
type StoneCell = '' | 'black' | 'white' | 'blackPattern' | 'whitePattern';
type BrushStone = Exclude<StoneCell, ''>;
const STAGE_EDITOR_POSITION_KEY = 'stageDefinitionEditorShellPosition';
const STAGE_EDITOR_SETTINGS_KEY = 'stageDefinitionEditorShellSettings';

interface Props {
    open: boolean;
    scope: Scope;
    stage: SinglePlayerStageInfo;
    swapStageOptions?: SinglePlayerStageInfo[];
    onClose: () => void;
    onSave: (next: SinglePlayerStageInfo) => Promise<void>;
    onSwapStageInfo?: (targetStageId: string) => Promise<void>;
    onResetAllToDefault?: () => Promise<void>;
}

const cloneStageInfo = (value: SinglePlayerStageInfo): SinglePlayerStageInfo =>
    JSON.parse(JSON.stringify(value)) as SinglePlayerStageInfo;

const fixedOpeningToCells = (stage: SinglePlayerStageInfo): StoneCell[][] => {
    const size = stage.boardSize;
    const cells: StoneCell[][] = Array(size).fill(null).map(() => Array(size).fill(''));
    for (const s of stage.fixedOpening ?? []) {
        if (s.x < 0 || s.y < 0 || s.x >= size || s.y >= size) continue;
        if (s.kind === 'pattern') {
            cells[s.y][s.x] = s.color === 'black' ? 'blackPattern' : 'whitePattern';
        } else {
            cells[s.y][s.x] = s.color;
        }
    }
    return cells;
};

const cellsToFixedOpening = (cells: StoneCell[][]): NonNullable<SinglePlayerStageInfo['fixedOpening']> => {
    const out: NonNullable<SinglePlayerStageInfo['fixedOpening']> = [];
    for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < cells[y].length; x++) {
            const c = cells[y][x];
            if (!c) continue;
            if (c === 'black') out.push({ x, y, color: 'black', kind: 'plain' });
            else if (c === 'white') out.push({ x, y, color: 'white', kind: 'plain' });
            else if (c === 'blackPattern') out.push({ x, y, color: 'black', kind: 'pattern' });
            else out.push({ x, y, color: 'white', kind: 'pattern' });
        }
    }
    return out;
};

const cellClassName = (cell: StoneCell): string => {
    if (!cell) return 'bg-zinc-900/80 border-zinc-700/80';
    if (cell === 'black') return 'bg-black border-zinc-300';
    if (cell === 'white') return 'bg-white border-zinc-500';
    if (cell === 'blackPattern') return 'bg-black border-amber-300 ring-2 ring-amber-400/80';
    return 'bg-white border-cyan-400 ring-2 ring-cyan-400/80';
};

const BRUSH_OPTIONS: { id: BrushStone; label: string; previewClass: string }[] = [
    { id: 'black', label: '흑', previewClass: 'bg-black border-zinc-300' },
    { id: 'white', label: '백', previewClass: 'bg-white border-zinc-500' },
    { id: 'blackPattern', label: '흑 문양', previewClass: 'bg-black border-amber-300 ring-2 ring-amber-400/80' },
    { id: 'whitePattern', label: '백 문양', previewClass: 'bg-white border-cyan-400 ring-2 ring-cyan-400/80' },
];

const MIX_MODE_OPTIONS: { mode: GameMode; label: string }[] = [
    { mode: GameMode.Speed, label: '스피드' },
    { mode: GameMode.Capture, label: '따내기' },
    { mode: GameMode.Base, label: '베이스' },
    { mode: GameMode.Hidden, label: '히든' },
    { mode: GameMode.Missile, label: '미사일' },
];

const StageDefinitionEditorShell: React.FC<Props> = ({ open, scope, stage, swapStageOptions, onClose, onSave, onSwapStageInfo, onResetAllToDefault }) => {
    const [draft, setDraft] = useState<SinglePlayerStageInfo>(() => cloneStageInfo(stage));
    const [cells, setCells] = useState<StoneCell[][]>(() => fixedOpeningToCells(stage));
    const [saving, setSaving] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [brush, setBrush] = useState<BrushStone>('black');
    const [rulePreset, setRulePreset] = useState<SinglePlayerStrategicRulePreset>(() => stage.strategicRulePreset ?? 'auto');
    const [resetBaseline, setResetBaseline] = useState<SinglePlayerStageInfo>(() => cloneStageInfo(stage));
    const [swapTargetStageId, setSwapTargetStageId] = useState('');
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [rememberPosition, setRememberPosition] = useState(false);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    const dragOriginRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

    useEffect(() => {
        if (!open) return;
        const snapshot = cloneStageInfo(stage);
        setResetBaseline(snapshot);
        setDraft(snapshot);
        setCells(fixedOpeningToCells(snapshot));
        setRulePreset(snapshot.strategicRulePreset ?? 'auto');
    }, [open, stage]);
    useEffect(() => {
        if (!open) return;
        const options = (swapStageOptions ?? []).filter((row) => row.id !== stage.id);
        setSwapTargetStageId((prev) => (prev && options.some((row) => row.id === prev) ? prev : (options[0]?.id ?? '')));
    }, [open, stage.id, swapStageOptions]);
    useEffect(() => {
        if (!open) return;
        let shouldRemember = false;
        try {
            const settings = JSON.parse(localStorage.getItem(STAGE_EDITOR_SETTINGS_KEY) || '{}');
            shouldRemember = Boolean(settings.rememberPosition);
        } catch {
            shouldRemember = false;
        }
        setRememberPosition(shouldRemember);
        if (shouldRemember) {
            try {
                const saved = JSON.parse(localStorage.getItem(STAGE_EDITOR_POSITION_KEY) || '{}');
                const scopeOffset = saved?.[scope];
                if (scopeOffset && Number.isFinite(scopeOffset.x) && Number.isFinite(scopeOffset.y)) {
                    setDragOffset({ x: scopeOffset.x, y: scopeOffset.y });
                } else {
                    setDragOffset({ x: 0, y: 0 });
                }
            } catch {
                setDragOffset({ x: 0, y: 0 });
            }
        } else {
            setDragOffset({ x: 0, y: 0 });
        }
        setIsDragging(false);
        dragPointerIdRef.current = null;
        dragOriginRef.current = null;
    }, [open, scope, stage.id]);

    const inferredRuleLabel = useMemo(() => {
        const id = inferSinglePlayerStrategicRulePreset({ ...draft, strategicRulePreset: undefined });
        return RULE_PRESET_OPTIONS.find((o) => o.value === id)?.label ?? id;
    }, [draft]);
    const effectiveRulePreset = rulePreset === 'auto' ? inferSinglePlayerStrategicRulePreset(draft) : rulePreset;
    const mixedModes = Array.isArray(draft.mixedStrategicModes) ? draft.mixedStrategicModes : [];
    const isMixPreset = effectiveRulePreset === 'mix';
    const mixHasCapture = mixedModes.includes(GameMode.Capture);
    const mixHasBase = mixedModes.includes(GameMode.Base);
    const mixHasHidden = mixedModes.includes(GameMode.Hidden);
    const mixHasMissile = mixedModes.includes(GameMode.Missile);
    const showCaptureFields = effectiveRulePreset === 'capture' || (isMixPreset && mixHasCapture);
    const showSurvivalFields = effectiveRulePreset === 'survival';
    const showAutoScoringTurns =
        effectiveRulePreset === 'classic'
        || effectiveRulePreset === 'speed'
        || effectiveRulePreset === 'base'
        || effectiveRulePreset === 'hidden'
        || effectiveRulePreset === 'missile'
        || (isMixPreset && !mixHasCapture);
    const showBaseStones = effectiveRulePreset === 'base' || (isMixPreset && mixHasBase);
    const showHiddenCounts = effectiveRulePreset === 'hidden' || (isMixPreset && mixHasHidden);
    const showMissileCount = effectiveRulePreset === 'missile' || (isMixPreset && mixHasMissile);
    const isMixSelectionInvalid = isMixPreset && mixedModes.length < 2;

    const boardSize = draft.boardSize;
    const rowIndices = useMemo(() => Array.from({ length: boardSize }, (_, i) => i), [boardSize]);
    const clampDragOffset = useCallback((nextX: number, nextY: number) => {
        const modal = modalRef.current;
        if (!modal) return { x: nextX, y: nextY };
        const rect = modal.getBoundingClientRect();
        const maxX = Math.max(0, window.innerWidth / 2 - rect.width / 2 - 12);
        const maxY = Math.max(0, window.innerHeight / 2 - rect.height / 2 - 12);
        return {
            x: Math.max(-maxX, Math.min(maxX, nextX)),
            y: Math.max(-maxY, Math.min(maxY, nextY)),
        };
    }, []);

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (ev: PointerEvent) => {
            if (dragPointerIdRef.current !== ev.pointerId) return;
            const origin = dragOriginRef.current;
            if (!origin) return;
            const next = clampDragOffset(
                origin.offsetX + (ev.clientX - origin.x),
                origin.offsetY + (ev.clientY - origin.y),
            );
            setDragOffset(next);
        };
        const onUp = (ev: PointerEvent) => {
            if (dragPointerIdRef.current !== ev.pointerId) return;
            dragPointerIdRef.current = null;
            dragOriginRef.current = null;
            setIsDragging(false);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [clampDragOffset, isDragging]);
    useEffect(() => {
        if (!open || !rememberPosition) return;
        try {
            const saved = JSON.parse(localStorage.getItem(STAGE_EDITOR_POSITION_KEY) || '{}');
            saved[scope] = dragOffset;
            localStorage.setItem(STAGE_EDITOR_POSITION_KEY, JSON.stringify(saved));
        } catch {
            // ignore localStorage failures
        }
    }, [dragOffset, open, rememberPosition, scope]);

    const handleRememberPositionChange = useCallback((checked: boolean) => {
        setRememberPosition(checked);
        try {
            const settings = JSON.parse(localStorage.getItem(STAGE_EDITOR_SETTINGS_KEY) || '{}');
            settings.rememberPosition = checked;
            localStorage.setItem(STAGE_EDITOR_SETTINGS_KEY, JSON.stringify(settings));
        } catch {
            // ignore localStorage failures
        }
        if (!checked) {
            try {
                const saved = JSON.parse(localStorage.getItem(STAGE_EDITOR_POSITION_KEY) || '{}');
                delete saved[scope];
                localStorage.setItem(STAGE_EDITOR_POSITION_KEY, JSON.stringify(saved));
            } catch {
                // ignore localStorage failures
            }
            setDragOffset({ x: 0, y: 0 });
        }
    }, [scope]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[260] bg-black/70 p-3 sm:p-6">
            <div
                ref={modalRef}
                className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-zinc-950 text-zinc-100 shadow-2xl"
                style={{ transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` }}
            >
                <div
                    className={`flex items-center justify-between border-b border-zinc-800 px-4 py-3 select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onPointerDown={(ev) => {
                        if (ev.button !== 0) return;
                        dragPointerIdRef.current = ev.pointerId;
                        dragOriginRef.current = {
                            x: ev.clientX,
                            y: ev.clientY,
                            offsetX: dragOffset.x,
                            offsetY: dragOffset.y,
                        };
                        setIsDragging(true);
                        ev.currentTarget.setPointerCapture?.(ev.pointerId);
                    }}
                    title="드래그로 모달 이동"
                >
                    <h2 className="text-lg font-bold">스테이지 편집 ({scope}) - {draft.id}</h2>
                    <Button onClick={onClose} colorScheme="gray">닫기</Button>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[1.15fr_1fr]">
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs">액션포인트
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                    type="number" value={draft.actionPointCost}
                                    onChange={(e) => setDraft((p) => ({ ...p, actionPointCost: Number(e.target.value) || 0 }))} />
                            </label>
                            <label className="text-xs">보드 크기
                                <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                    value={draft.boardSize}
                                    onChange={(e) => {
                                        const nextSize = Number(e.target.value) as SinglePlayerStageInfo['boardSize'];
                                        setDraft((p) => ({ ...p, boardSize: nextSize }));
                                        setCells(Array(nextSize).fill(null).map(() => Array(nextSize).fill('')));
                                    }}>
                                    {[7, 9, 11, 13].map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs">첫클리어 골드
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                    type="number" value={draft.rewards.firstClear.gold}
                                    onChange={(e) => setDraft((p) => ({ ...p, rewards: { ...p.rewards, firstClear: { ...p.rewards.firstClear, gold: Number(e.target.value) || 0 } } }))} />
                            </label>
                            <label className="text-xs">첫클리어 경험치
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                    type="number" value={draft.rewards.firstClear.exp}
                                    onChange={(e) => setDraft((p) => ({ ...p, rewards: { ...p.rewards, firstClear: { ...p.rewards.firstClear, exp: Number(e.target.value) || 0 } } }))} />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs">반복클리어 골드
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                    type="number" value={draft.rewards.repeatClear.gold}
                                    onChange={(e) => setDraft((p) => ({ ...p, rewards: { ...p.rewards, repeatClear: { ...p.rewards.repeatClear, gold: Number(e.target.value) || 0 } } }))} />
                            </label>
                            <label className="text-xs">반복클리어 경험치
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                    type="number" value={draft.rewards.repeatClear.exp}
                                    onChange={(e) => setDraft((p) => ({ ...p, rewards: { ...p.rewards, repeatClear: { ...p.rewards.repeatClear, exp: Number(e.target.value) || 0 } } }))} />
                            </label>
                        </div>
                        <label className="block text-xs">
                            게임 룰
                            <select
                                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                value={rulePreset}
                                onChange={(e) => setRulePreset(e.target.value as SinglePlayerStrategicRulePreset)}
                            >
                                <option value="auto">자동 (필드 조합 — 현재 추론: {inferredRuleLabel})</option>
                                {RULE_PRESET_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {isMixPreset && (
                            <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                                <p className="text-xs font-semibold text-zinc-200">섞을 모드 (2개 이상 권장)</p>
                                <p className="mt-1 text-[11px] text-zinc-400">따내기가 섞이면 계가까지 수순은 사용하지 않습니다.</p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {MIX_MODE_OPTIONS.map(({ mode, label }) => {
                                        const checked = mixedModes.includes(mode);
                                        return (
                                            <label key={mode} className="flex items-center gap-2 rounded border border-zinc-700 px-2 py-1 text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        setDraft((p) => {
                                                            const prev = Array.isArray(p.mixedStrategicModes) ? p.mixedStrategicModes : [];
                                                            const next = e.target.checked
                                                                ? [...prev, mode]
                                                                : prev.filter((m) => m !== mode);
                                                            return { ...p, mixedStrategicModes: next };
                                                        });
                                                    }}
                                                />
                                                {label}
                                            </label>
                                        );
                                    })}
                                </div>
                                {isMixSelectionInvalid && (
                                    <p className="mt-2 text-[11px] text-rose-300">믹스룰은 모드를 2개 이상 선택해야 저장할 수 있습니다.</p>
                                )}
                            </div>
                        )}
                        {(showCaptureFields || showSurvivalFields || showAutoScoringTurns || showBaseStones || showHiddenCounts || showMissileCount) && (
                            <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                                <p className="mb-2 text-xs font-semibold text-zinc-200">추가 규칙</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {showCaptureFields && (
                                        <>
                                            <label className="text-xs">흑 턴제한
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.blackTurnLimit ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, blackTurnLimit: Number(e.target.value) || 0 }))}
                                                />
                                            </label>
                                            <label className="text-xs">흑 목표점수
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.targetScore.black ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, targetScore: { ...p.targetScore, black: Number(e.target.value) || 0 } }))}
                                                />
                                            </label>
                                            <label className="text-xs">백 목표점수
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.targetScore.white ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, targetScore: { ...p.targetScore, white: Number(e.target.value) || 0 } }))}
                                                />
                                            </label>
                                        </>
                                    )}
                                    {showSurvivalFields && (
                                        <>
                                            <label className="text-xs">백 턴제한
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.survivalTurns ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, survivalTurns: Number(e.target.value) || 0 }))}
                                                />
                                            </label>
                                            <label className="text-xs">백 목표점수
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.targetScore.black ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, targetScore: { ...p.targetScore, black: Number(e.target.value) || 0 } }))}
                                                />
                                            </label>
                                        </>
                                    )}
                                    {showAutoScoringTurns && (
                                        <label className="text-xs">계가까지 수순
                                            <input
                                                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                type="number"
                                                value={draft.autoScoringTurns ?? 0}
                                                onChange={(e) => setDraft((p) => ({ ...p, autoScoringTurns: Number(e.target.value) || 0 }))}
                                            />
                                        </label>
                                    )}
                                    {showBaseStones && (
                                        <label className="text-xs">베이스 돌 개수
                                            <input
                                                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                type="number"
                                                value={Number((draft as any).baseStones ?? 0)}
                                                onChange={(e) => setDraft((p) => ({ ...(p as any), baseStones: Number(e.target.value) || 0 }))}
                                            />
                                        </label>
                                    )}
                                    {showHiddenCounts && (
                                        <>
                                            <label className="text-xs">히든 개수
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.hiddenCount ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, hiddenCount: Number(e.target.value) || 0 }))}
                                                />
                                            </label>
                                            <label className="text-xs">스캔 개수
                                                <input
                                                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                    type="number"
                                                    value={draft.scanCount ?? 0}
                                                    onChange={(e) => setDraft((p) => ({ ...p, scanCount: Number(e.target.value) || 0 }))}
                                                />
                                            </label>
                                        </>
                                    )}
                                    {showMissileCount && (
                                        <label className="text-xs">미사일 개수
                                            <input
                                                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                type="number"
                                                value={draft.missileCount ?? 0}
                                                onChange={(e) => setDraft((p) => ({ ...p, missileCount: Number(e.target.value) || 0 }))}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs">랜덤 흑돌
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" type="number" value={draft.placements.black}
                                    onChange={(e) => setDraft((p) => ({ ...p, placements: { ...p.placements, black: Number(e.target.value) || 0 } }))} />
                            </label>
                            <label className="text-xs">랜덤 백돌
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" type="number" value={draft.placements.white}
                                    onChange={(e) => setDraft((p) => ({ ...p, placements: { ...p.placements, white: Number(e.target.value) || 0 } }))} />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs">랜덤 흑 문양돌
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" type="number" value={draft.placements.blackPattern}
                                    onChange={(e) => setDraft((p) => ({ ...p, placements: { ...p.placements, blackPattern: Number(e.target.value) || 0 } }))} />
                            </label>
                            <label className="text-xs">랜덤 백 문양돌
                                <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" type="number" value={draft.placements.whitePattern}
                                    onChange={(e) => setDraft((p) => ({ ...p, placements: { ...p.placements, whitePattern: Number(e.target.value) || 0 } }))} />
                            </label>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={!!draft.mergeRandomPlacementsWithFixed}
                                onChange={(e) => setDraft((p) => ({ ...p, mergeRandomPlacementsWithFixed: e.target.checked }))}
                            />
                            수동배치 위에 랜덤돌 추가
                        </label>
                        {onSwapStageInfo && (swapStageOptions?.length ?? 0) > 1 && (
                            <div className="rounded border border-amber-700/40 bg-amber-950/20 p-2">
                                <p className="text-xs font-semibold text-amber-100">스테이지 맵 정보 맞바꾸기</p>
                                <p className="mt-1 text-[11px] text-amber-200/80">
                                    현재 스테이지와 선택한 스테이지의 정보가 서로 교체됩니다. (ID 슬롯은 유지)
                                </p>
                                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                    <select
                                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                                        value={swapTargetStageId}
                                        onChange={(e) => setSwapTargetStageId(e.target.value)}
                                        disabled={saving || swapping}
                                    >
                                        {(swapStageOptions ?? [])
                                            .filter((row) => row.id !== stage.id)
                                            .map((row) => (
                                                <option key={row.id} value={row.id}>
                                                    {row.id} ({row.name})
                                                </option>
                                            ))}
                                    </select>
                                    <Button
                                        colorScheme="gray"
                                        disabled={saving || swapping || !swapTargetStageId}
                                        onClick={async () => {
                                            if (!swapTargetStageId) return;
                                            setSwapping(true);
                                            try {
                                                await onSwapStageInfo(swapTargetStageId);
                                            } finally {
                                                setSwapping(false);
                                            }
                                        }}
                                    >
                                        바꾸기
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="mb-2 text-xs text-zinc-400">
                            위에서 돌 종류를 고른 뒤 빈 칸에 클릭해 놓습니다. 돌이 있는 칸을 다시 클릭하면 빈칸이 됩니다.
                        </p>
                        <div className="mb-3 flex flex-wrap gap-2">
                            {BRUSH_OPTIONS.map((opt) => {
                                const active = brush === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setBrush(opt.id)}
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                            active
                                                ? 'border-amber-400/80 bg-amber-950/50 text-amber-100 ring-2 ring-amber-400/50'
                                                : 'border-zinc-600 bg-zinc-900/80 text-zinc-200 hover:border-zinc-500'
                                        }`}
                                    >
                                        <span className={`h-5 w-5 shrink-0 rounded-full border ${opt.previewClass}`} aria-hidden />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="inline-grid gap-1 rounded border border-zinc-700 bg-zinc-900/40 p-2">
                            {rowIndices.map((y) => (
                                <div key={y} className="flex gap-1">
                                    {rowIndices.map((x) => (
                                        <button
                                            key={`${x}-${y}`}
                                            type="button"
                                            className={`h-7 w-7 rounded-full border sm:h-8 sm:w-8 ${cellClassName(cells[y][x] || '')}`}
                                            onClick={() => {
                                                setCells((prev) => {
                                                    const next = prev.map((row) => [...row]);
                                                    const cur = next[y][x];
                                                    if (cur) {
                                                        next[y][x] = '';
                                                    } else {
                                                        next[y][x] = brush;
                                                    }
                                                    return next;
                                                });
                                            }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-3">
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input
                            type="checkbox"
                            checked={rememberPosition}
                            onChange={(e) => handleRememberPositionChange(e.target.checked)}
                        />
                        창 위치 기억하기
                    </label>
                    <div className="flex items-center gap-2">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button
                        onClick={() => {
                            const snapshot = cloneStageInfo(resetBaseline);
                            setDraft(snapshot);
                            setCells(fixedOpeningToCells(snapshot));
                            setRulePreset(snapshot.strategicRulePreset ?? 'auto');
                        }}
                        colorScheme="gray"
                        disabled={saving}
                    >
                        편집값 되돌리기
                    </Button>
                    {scope === 'singleplayer' && onResetAllToDefault && (
                        <Button
                            onClick={async () => {
                                if (!window.confirm('싱글 스테이지 전체를 기본값으로 복구할까요? 저장된 오버라이드가 모두 초기화됩니다.')) return;
                                setSaving(true);
                                try {
                                    await onResetAllToDefault();
                                    onClose();
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            colorScheme="gray"
                            disabled={saving || swapping}
                        >
                            기본값 복구(전체)
                        </Button>
                    )}
                    <Button
                        colorScheme="accent"
                        disabled={saving || swapping || isMixSelectionInvalid}
                        onClick={async () => {
                            if (isMixSelectionInvalid) return;
                            setSaving(true);
                            try {
                                await onSave({
                                    ...draft,
                                    strategicRulePreset: rulePreset === 'auto' ? undefined : rulePreset,
                                    fixedOpening: cellsToFixedOpening(cells),
                                });
                            } finally {
                                setSaving(false);
                            }
                        }}
                    >
                        저장
                    </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StageDefinitionEditorShell;
