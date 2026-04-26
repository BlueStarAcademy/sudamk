import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameMode, SinglePlayerLevel, SinglePlayerStageInfo, SinglePlayerStrategicRulePreset } from '../../types/index.js';
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
    onClose: () => void;
    onSave: (next: SinglePlayerStageInfo) => Promise<void>;
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

const resizeCells = (cells: StoneCell[][], nextSize: number): StoneCell[][] => {
    const next: StoneCell[][] = Array(nextSize).fill(null).map(() => Array(nextSize).fill(''));
    for (let y = 0; y < Math.min(cells.length, nextSize); y++) {
        for (let x = 0; x < Math.min(cells[y]?.length ?? 0, nextSize); x++) {
            next[y][x] = cells[y][x];
        }
    }
    return next;
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    return '작업 중 오류가 발생했습니다.';
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

const defaultSinglePlayerKataServerLevel = (level: SinglePlayerStageInfo['level']): number => {
    switch (level) {
        case SinglePlayerLevel.입문:
            return -31;
        case SinglePlayerLevel.초급:
            return -30;
        case SinglePlayerLevel.중급:
            return -29;
        case SinglePlayerLevel.고급:
            return -28;
        case SinglePlayerLevel.유단자:
            return -27;
        default:
            return -31;
    }
};

const clampKataServerLevel = (value: number): number => Math.max(-31, Math.min(9, Math.floor(value)));

type ForcedAiResponseRow = NonNullable<SinglePlayerStageInfo['forcedAiResponses']>[number];
const pointKey = (x: number, y: number): string => `${x},${y}`;

const StageDefinitionEditorShell: React.FC<Props> = ({ open, scope, stage, onClose, onSave, onResetAllToDefault }) => {
    const [draft, setDraft] = useState<SinglePlayerStageInfo>(() => cloneStageInfo(stage));
    const [cells, setCells] = useState<StoneCell[][]>(() => fixedOpeningToCells(stage));
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [brush, setBrush] = useState<BrushStone>('black');
    const [kataServerLevelInput, setKataServerLevelInput] = useState<string>(() =>
        String(
            clampKataServerLevel(
                Number.isFinite(stage.kataServerLevel)
                    ? Number(stage.kataServerLevel)
                    : defaultSinglePlayerKataServerLevel(stage.level)
            )
        )
    );
    const [rulePreset, setRulePreset] = useState<SinglePlayerStrategicRulePreset>(() => stage.strategicRulePreset ?? 'auto');
    const [isForcedResponseBoardEditMode, setIsForcedResponseBoardEditMode] = useState(false);
    const [resetBaseline, setResetBaseline] = useState<SinglePlayerStageInfo>(() => cloneStageInfo(stage));
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [rememberPosition, setRememberPosition] = useState(false);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    const dragOriginRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

    // 편집기가 열릴 때·다른 스테이지로 바뀔 때만 서버/상수 스냅샷으로 초기화한다.
    // `stage` 객체 참조만 바뀌는 경우(소켓으로 SINGLE_PLAYER_STAGES 전체 갱신 등)에는 초기화하지 않는다.
    // 그렇지 않으면 보드 크기 변경·돌 배치 직후 로컬 편집이 덮어써져 저장이 깨진 것처럼 보인다.
    useEffect(() => {
        if (!open) return;
        const snapshot = cloneStageInfo(stage);
        const resolvedKataServerLevel = clampKataServerLevel(
            Number.isFinite(snapshot.kataServerLevel)
                ? Number(snapshot.kataServerLevel)
                : defaultSinglePlayerKataServerLevel(snapshot.level)
        );
        setResetBaseline(snapshot);
        setDraft({ ...snapshot, kataServerLevel: resolvedKataServerLevel });
        setKataServerLevelInput(String(resolvedKataServerLevel));
        setCells(fixedOpeningToCells(snapshot));
        setRulePreset(snapshot.strategicRulePreset ?? 'auto');
        setIsForcedResponseBoardEditMode(false);
        setErrorMessage('');
        // eslint-disable-next-line react-hooks/exhaustive-deps -- stage.id·open만으로 동기화 시점을 제한함
    }, [open, stage.id]);
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
    const forcedAiResponses = Array.isArray(draft.forcedAiResponses) ? draft.forcedAiResponses : [];
    const forcedMoveIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        forcedAiResponses.forEach((rule, idx) => {
            if (!rule?.move) return;
            map.set(pointKey(rule.move.x, rule.move.y), idx);
        });
        return map;
    }, [forcedAiResponses]);
    const validationErrors = useMemo(() => {
        const errors: string[] = [];
        if (isMixSelectionInvalid) {
            errors.push('믹스룰은 모드를 2개 이상 선택해야 저장할 수 있습니다.');
        }
        const fixedStoneCount = cellsToFixedOpening(cells).length;
        const randomStoneCount =
            Math.max(0, Number(draft.placements.black) || 0)
            + Math.max(0, Number(draft.placements.white) || 0)
            + Math.max(0, Number(draft.placements.blackPattern) || 0)
            + Math.max(0, Number(draft.placements.whitePattern) || 0);
        const boardCapacity = draft.boardSize * draft.boardSize;
        const randomCapacity = boardCapacity - (draft.mergeRandomPlacementsWithFixed ? fixedStoneCount : 0);
        if (fixedStoneCount > boardCapacity) {
            errors.push('수동 배치 돌 수가 보드 칸 수를 초과했습니다.');
        }
        if (randomStoneCount > randomCapacity) {
            errors.push(`랜덤 배치 돌 수가 가능한 칸 수(${randomCapacity})를 초과했습니다.`);
        }
        if ((draft.description ?? '').length > 1200) {
            errors.push('스테이지 설명은 1200자 이하로 입력해주세요.');
        }
        return errors;
    }, [cells, draft.boardSize, draft.description, draft.mergeRandomPlacementsWithFixed, draft.placements, isMixSelectionInvalid]);
    const hasValidationErrors = validationErrors.length > 0;

    const updateForcedAiResponse = useCallback((index: number, updater: (prev: ForcedAiResponseRow) => ForcedAiResponseRow) => {
        setDraft((prev) => {
            const list = Array.isArray(prev.forcedAiResponses) ? [...prev.forcedAiResponses] : [];
            const current = list[index];
            if (!current) return prev;
            list[index] = updater(current);
            return { ...prev, forcedAiResponses: list };
        });
    }, []);

    const addForcedAiResponse = useCallback(() => {
        setDraft((prev) => {
            const list = Array.isArray(prev.forcedAiResponses) ? [...prev.forcedAiResponses] : [];
            list.push({ move: { x: 0, y: 0 } });
            return { ...prev, forcedAiResponses: list };
        });
    }, []);

    const removeForcedAiResponse = useCallback((index: number) => {
        setDraft((prev) => {
            const list = Array.isArray(prev.forcedAiResponses) ? [...prev.forcedAiResponses] : [];
            list.splice(index, 1);
            return {
                ...prev,
                forcedAiResponses: list.length > 0 ? list : undefined,
                strictForcedAiResponses: list.length > 0 ? prev.strictForcedAiResponses : false,
            };
        });
    }, []);
    const handleBoardCellClick = useCallback((x: number, y: number) => {
        if (scope === 'singleplayer' && isForcedResponseBoardEditMode) {
            setDraft((prev) => {
                const list = Array.isArray(prev.forcedAiResponses) ? [...prev.forcedAiResponses] : [];
                const existingIndex = list.findIndex((rule) => rule.move.x === x && rule.move.y === y);
                if (existingIndex >= 0) {
                    list.splice(existingIndex, 1);
                    return {
                        ...prev,
                        forcedAiResponses: list.length > 0 ? list : undefined,
                        strictForcedAiResponses: list.length > 0 ? prev.strictForcedAiResponses : false,
                    };
                }
                if (cells[y]?.[x]) {
                    return prev;
                }
                list.push({ move: { x, y } });
                return { ...prev, forcedAiResponses: list };
            });
            return;
        }
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
    }, [brush, cells, isForcedResponseBoardEditMode, scope]);

    const boardSize = draft.boardSize;
    const rowIndices = useMemo(() => Array.from({ length: boardSize }, (_, i) => i), [boardSize]);
    const boardCellSizeClass =
        boardSize >= 13 ? 'h-5 w-5 sm:h-5 sm:w-5' : boardSize >= 11 ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-7 w-7 sm:h-8 sm:w-8';
    const boardRowGapClass = boardSize >= 13 ? 'gap-0.5' : boardSize >= 11 ? 'gap-0.5' : 'gap-1';
    const forcedIndexTextClass = boardSize >= 13 ? 'text-[9px]' : 'text-[11px]';
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
        <div className="fixed inset-0 z-[280] bg-black/70 p-3 sm:p-5">
            <div
                ref={modalRef}
                className="mx-auto flex h-full w-full max-w-[min(98vw,45rem)] flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-zinc-950 text-zinc-100 shadow-2xl"
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
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row lg:items-stretch">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-w-0 lg:w-[70%] lg:flex-none lg:shrink-0">
                        <div className="shrink-0">
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
                            <div
                                className={`inline-grid w-fit max-w-full shrink-0 rounded border border-zinc-700 bg-zinc-900/40 p-1.5 sm:p-2 ${boardRowGapClass}`}
                            >
                                {rowIndices.map((y) => (
                                    <div key={y} className={`flex shrink-0 ${boardRowGapClass}`}>
                                        {rowIndices.map((x) => (
                                            <button
                                                key={`${x}-${y}`}
                                                type="button"
                                                className={`relative shrink-0 rounded-full border ${boardCellSizeClass} ${cellClassName(cells[y][x] || '')}`}
                                                onClick={() => handleBoardCellClick(x, y)}
                                            >
                                                {scope === 'singleplayer' && forcedMoveIndexByKey.has(pointKey(x, y)) && (
                                                    <span
                                                        className={`absolute inset-0 flex items-center justify-center rounded-full border border-zinc-500 bg-white font-black leading-none text-zinc-900 ${forcedIndexTextClass}`}
                                                    >
                                                        {(forcedMoveIndexByKey.get(pointKey(x, y)) ?? 0) + 1}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <label className="mt-3 block shrink-0 rounded border border-zinc-700/80 bg-zinc-900/35 p-2 text-xs">
                            스테이지 설명
                            <textarea
                                className="mt-1 h-24 w-full resize-y rounded border border-zinc-700 bg-zinc-900 px-2 py-2 leading-5 sm:h-28"
                                value={draft.description ?? ''}
                                maxLength={1200}
                                placeholder="대국 중 바둑판 왼쪽 두루마리에 표시될 설명을 입력합니다. 모바일에서는 설명 버튼으로 볼 수 있습니다."
                                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                            />
                            <span className="mt-1 block text-[11px] text-zinc-500">{(draft.description ?? '').length} / 1200</span>
                        </label>
                        {scope === 'singleplayer' && (
                            <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-indigo-700/40 bg-indigo-950/20 lg:mt-3 lg:min-h-[8rem]">
                                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-indigo-600/25 p-2">
                                    <p className="text-xs font-semibold text-indigo-100">AI 강제 응수 규칙</p>
                                    <Button
                                        colorScheme="gray"
                                        onClick={() => setIsForcedResponseBoardEditMode((prev) => !prev)}
                                        disabled={saving}
                                    >
                                        {isForcedResponseBoardEditMode ? '보드 입력 종료' : '강제응수 규칙 추가'}
                                    </Button>
                                </div>
                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain p-2">
                                    {forcedAiResponses.length > 0 &&
                                        forcedAiResponses.map((rule, idx) => (
                                            <div key={idx} className="rounded border border-zinc-700 bg-zinc-900/70 p-2">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <p className="text-xs font-semibold text-zinc-200">규칙 #{idx + 1}</p>
                                                    <Button colorScheme="gray" onClick={() => removeForcedAiResponse(idx)} disabled={saving}>
                                                        삭제
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label className="text-[11px]">조건 X (상대돌)
                                                        <input
                                                            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                            type="number"
                                                            value={rule.whenOpponentStoneAt?.x ?? ''}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                updateForcedAiResponse(idx, (prev) => ({
                                                                    ...prev,
                                                                    whenOpponentStoneAt:
                                                                        v === ''
                                                                            ? undefined
                                                                            : { x: Number(v) || 0, y: prev.whenOpponentStoneAt?.y ?? 0 },
                                                                }));
                                                            }}
                                                        />
                                                    </label>
                                                    <label className="text-[11px]">조건 Y (상대돌)
                                                        <input
                                                            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                            type="number"
                                                            value={rule.whenOpponentStoneAt?.y ?? ''}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                updateForcedAiResponse(idx, (prev) => ({
                                                                    ...prev,
                                                                    whenOpponentStoneAt:
                                                                        v === ''
                                                                            ? undefined
                                                                            : { x: prev.whenOpponentStoneAt?.x ?? 0, y: Number(v) || 0 },
                                                                }));
                                                            }}
                                                        />
                                                    </label>
                                                    <label className="text-[11px]">응수 X
                                                        <input
                                                            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                            type="number"
                                                            value={rule.move.x}
                                                            onChange={(e) =>
                                                                updateForcedAiResponse(idx, (prev) => ({
                                                                    ...prev,
                                                                    move: { ...prev.move, x: Number(e.target.value) || 0 },
                                                                }))
                                                            }
                                                        />
                                                    </label>
                                                    <label className="text-[11px]">응수 Y
                                                        <input
                                                            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                                            type="number"
                                                            value={rule.move.y}
                                                            onChange={(e) =>
                                                                updateForcedAiResponse(idx, (prev) => ({
                                                                    ...prev,
                                                                    move: { ...prev.move, y: Number(e.target.value) || 0 },
                                                                }))
                                                            }
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                <label className="mt-2 flex shrink-0 items-start gap-2 border-t border-indigo-600/20 p-2 pt-2 text-xs text-zinc-200">
                                    <input
                                        className="mt-0.5"
                                        type="checkbox"
                                        checked={draft.strictForcedAiResponses === true}
                                        onChange={(e) => setDraft((prev) => ({ ...prev, strictForcedAiResponses: e.target.checked }))}
                                    />
                                    <span>
                                        강제 규칙 불가능 시 랜덤/일반 폴백 금지(즉시 기권)
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-0.5 lg:w-[30%] lg:flex-none lg:shrink-0">
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
                                        setCells((prev) => resizeCells(prev, nextSize));
                                    }}>
                                    {[7, 9, 11, 13].map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>
                        </div>
                        <label className="text-xs">KATA 레벨 (-31 ~ 9)
                            <input
                                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                                type="text"
                                inputMode="numeric"
                                value={kataServerLevelInput}
                                onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    if (!/^-?\d*$/.test(raw)) return;
                                    setKataServerLevelInput(raw);
                                    if (raw === '' || raw === '-') return;
                                    const parsed = Number(raw);
                                    if (!Number.isFinite(parsed)) return;
                                    setDraft((p) => ({ ...p, kataServerLevel: clampKataServerLevel(parsed) }));
                                }}
                                onBlur={() => {
                                    const fallback = defaultSinglePlayerKataServerLevel(draft.level);
                                    const parsed = Number(kataServerLevelInput);
                                    const normalized = Number.isFinite(parsed)
                                        ? clampKataServerLevel(parsed)
                                        : fallback;
                                    setKataServerLevelInput(String(normalized));
                                    setDraft((p) => ({ ...p, kataServerLevel: normalized }));
                                }}
                            />
                        </label>
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
                                onChange={(e) => {
                                    const nextPreset = e.target.value as SinglePlayerStrategicRulePreset;
                                    setRulePreset(nextPreset);
                                    if (nextPreset === 'survival') {
                                        setDraft((prev) => {
                                            const currentTurns = Number(prev.survivalTurns ?? 0);
                                            if (currentTurns > 0) return prev;
                                            const fromBlack = Math.max(0, Number(prev.blackTurnLimit ?? 0));
                                            const fallbackTurns = fromBlack > 0 ? fromBlack : 15;
                                            return { ...prev, survivalTurns: fallbackTurns };
                                        });
                                    } else if (nextPreset !== 'auto') {
                                        setDraft((prev) => ({ ...prev, survivalTurns: 0 }));
                                    }
                                }}
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
                        <label className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/40 p-2 text-sm">
                            <input
                                type="checkbox"
                                checked={draft.allowPlacementRefresh !== false}
                                onChange={(e) => setDraft((p) => ({ ...p, allowPlacementRefresh: e.target.checked }))}
                            />
                            <span className="font-semibold text-zinc-100">배치변경 허용</span>
                        </label>
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
                    {(errorMessage || validationErrors.length > 0) && (
                        <div className="max-w-lg rounded border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                            {errorMessage && <p>{errorMessage}</p>}
                            {validationErrors.map((message) => (
                                <p key={message}>{message}</p>
                            ))}
                        </div>
                    )}
                    <Button
                        onClick={() => {
                            const snapshot = cloneStageInfo(resetBaseline);
                            setDraft(snapshot);
                            setCells(fixedOpeningToCells(snapshot));
                            setRulePreset(snapshot.strategicRulePreset ?? 'auto');
                            setErrorMessage('');
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
                                    setErrorMessage('');
                                    await onResetAllToDefault();
                                    onClose();
                                } catch (error) {
                                    setErrorMessage(getErrorMessage(error));
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            colorScheme="gray"
                            disabled={saving}
                        >
                            기본값 복구(전체)
                        </Button>
                    )}
                    <Button
                        colorScheme="accent"
                        disabled={saving || hasValidationErrors}
                        onClick={async () => {
                            if (hasValidationErrors) return;
                            setSaving(true);
                            try {
                                setErrorMessage('');
                                await onSave({
                                    ...draft,
                                    strategicRulePreset: rulePreset === 'auto' ? undefined : rulePreset,
                                    fixedOpening: cellsToFixedOpening(resizeCells(cells, draft.boardSize)),
                                });
                            } catch (error) {
                                setErrorMessage(getErrorMessage(error));
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
