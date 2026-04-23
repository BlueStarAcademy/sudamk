import React, { useEffect, useMemo, useState } from 'react';
import { SinglePlayerStageInfo, SinglePlayerStrategicRulePreset } from '../../types/index.js';
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

interface Props {
    open: boolean;
    scope: Scope;
    stage: SinglePlayerStageInfo;
    onClose: () => void;
    onSave: (next: SinglePlayerStageInfo) => Promise<void>;
}

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

const StageDefinitionEditorShell: React.FC<Props> = ({ open, scope, stage, onClose, onSave }) => {
    const [draft, setDraft] = useState<SinglePlayerStageInfo>(stage);
    const [cells, setCells] = useState<StoneCell[][]>(fixedOpeningToCells(stage));
    const [saving, setSaving] = useState(false);
    const [brush, setBrush] = useState<BrushStone>('black');
    const [rulePreset, setRulePreset] = useState<SinglePlayerStrategicRulePreset>(() => stage.strategicRulePreset ?? 'auto');

    useEffect(() => {
        setDraft(stage);
        setCells(fixedOpeningToCells(stage));
        setRulePreset(stage.strategicRulePreset ?? 'auto');
    }, [stage]);

    const inferredRuleLabel = useMemo(() => {
        const id = inferSinglePlayerStrategicRulePreset({ ...draft, strategicRulePreset: undefined });
        return RULE_PRESET_OPTIONS.find((o) => o.value === id)?.label ?? id;
    }, [draft]);

    const boardSize = draft.boardSize;
    const rowIndices = useMemo(() => Array.from({ length: boardSize }, (_, i) => i), [boardSize]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[260] bg-black/70 p-3 sm:p-6">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-zinc-950 text-zinc-100 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
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
                <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button
                        colorScheme="accent"
                        disabled={saving}
                        onClick={async () => {
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
    );
};

export default StageDefinitionEditorShell;
