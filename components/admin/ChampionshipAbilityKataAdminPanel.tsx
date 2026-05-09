import React, { useCallback, useEffect, useState } from 'react';
import type { ServerAction } from '../../types.js';
import type { ChampionshipAbilityKataLadderRow } from '../../shared/constants/championshipRealMatch.js';
import { normalizeChampionshipAbilityKataLadder } from '../../shared/constants/championshipRealMatch.js';
import Button from '../Button.js';
import { adminCard, adminCardTitle, adminInput } from './adminChrome.js';

export interface ChampionshipAbilityKataAdminPanelProps {
    ladder: readonly ChampionshipAbilityKataLadderRow[];
    onAction: (action: ServerAction) => void | Promise<unknown>;
}

const ChampionshipAbilityKataAdminPanel: React.FC<ChampionshipAbilityKataAdminPanelProps> = ({ ladder, onAction }) => {
    const [rows, setRows] = useState<ChampionshipAbilityKataLadderRow[]>(() => [...ladder]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setRows([...ladder]);
        setError(null);
    }, [ladder]);

    const updateRow = useCallback((index: number, patch: Partial<ChampionshipAbilityKataLadderRow>) => {
        setRows((prev) => {
            const next = [...prev];
            const cur = next[index];
            if (!cur) return prev;
            next[index] = { ...cur, ...patch };
            return next;
        });
    }, []);

    const addRow = useCallback(() => {
        setRows((prev) => [...prev, { minAbilityScore: 0, kataLevel: -30 }]);
    }, []);

    const removeRow = useCallback((index: number) => {
        setRows((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const save = useCallback(() => {
        setError(null);
        try {
            const normalized = normalizeChampionshipAbilityKataLadder(rows);
            void onAction({ type: 'ADMIN_SET_CHAMPIONSHIP_ABILITY_KATA_LADDER', payload: { rows: normalized } });
        } catch (e: any) {
            setError(e?.message ? String(e.message) : '검증 오류');
        }
    }, [onAction, rows]);

    const reset = useCallback(() => {
        setError(null);
        void onAction({ type: 'ADMIN_RESET_CHAMPIONSHIP_ABILITY_KATA_LADDER' });
    }, [onAction]);

    return (
        <div className={adminCard}>
            <h2 className={adminCardTitle}>챔피언십 능력치 → KATA 단계</h2>
            <p className="mb-3 text-xs text-gray-500">
                단계별 가중 능력치 점수가 각 행의 <span className="font-mono">minAbilityScore</span> 이상이면 해당{' '}
                <span className="font-mono">kataLevel</span>을 사용합니다. 행은 자동으로 높은 임계값 순으로 정렬됩니다. 저장 시 전체 접속
                클라이언트에 반영됩니다.
            </p>
            {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}
            <div className="mb-3 max-h-[22rem] overflow-auto rounded border border-color/40">
                <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900/95 text-[11px] uppercase tracking-wide text-slate-400">
                        <tr>
                            <th className="border-b border-color/40 px-2 py-1.5">최소 능력치 점수</th>
                            <th className="border-b border-color/40 px-2 py-1.5">KATA level</th>
                            <th className="border-b border-color/40 px-2 py-1.5 w-14" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="border-b border-color/25 odd:bg-black/15">
                                <td className="px-2 py-1">
                                    <input
                                        type="number"
                                        className={adminInput}
                                        value={row.minAbilityScore}
                                        onChange={(e) => updateRow(i, { minAbilityScore: parseInt(e.target.value, 10) || 0 })}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        type="number"
                                        className={adminInput}
                                        value={row.kataLevel}
                                        onChange={(e) => updateRow(i, { kataLevel: parseInt(e.target.value, 10) || 0 })}
                                    />
                                </td>
                                <td className="px-2 py-1 text-right">
                                    <button
                                        type="button"
                                        className="rounded border border-rose-500/50 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-950/60"
                                        onClick={() => removeRow(i)}
                                    >
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="button" colorScheme="blue" className="!text-xs" onClick={addRow}>
                    행 추가
                </Button>
                <Button type="button" colorScheme="green" className="!text-xs" onClick={save}>
                    저장
                </Button>
                <Button type="button" colorScheme="red" className="!text-xs" onClick={reset}>
                    코드 기본값으로 초기화
                </Button>
            </div>
        </div>
    );
};

export default ChampionshipAbilityKataAdminPanel;
