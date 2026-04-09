import React, { useState, useMemo } from 'react';
import { User, GameRecord, ServerAction, Player } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import DraggableWindow from './DraggableWindow.js';

interface GameRecordListModalProps {
    currentUser: User;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    onViewRecord: (record: GameRecord) => void;
    isTopmost?: boolean;
}

const GameRecordListModal: React.FC<GameRecordListModalProps> = ({
    currentUser,
    onClose,
    onAction,
    onViewRecord,
    isTopmost,
}) => {
    const records = currentUser.savedGameRecords || [];
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => b.date - a.date);
    }, [records]);

    const recentRecords = useMemo(() => sortedRecords.slice(0, 3), [sortedRecords]);

    const getGameModeName = (mode: string) => {
        const strategic = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
        if (strategic) return strategic.name;
        const playful = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
        return playful ? playful.name : mode;
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const formatDateShort = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const getResultText = (record: GameRecord) => {
        const isDraw = record.gameResult.winner === Player.None;
        if (isDraw) return { text: '무승부', chip: 'bg-slate-500/25 text-slate-200 ring-slate-400/30' };
        const my = record.myColor;
        if (my === Player.Black || my === Player.White) {
            const iWon = record.gameResult.winner === my;
            if (iWon) return { text: '승', chip: 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/35' };
            return { text: '패', chip: 'bg-rose-500/20 text-rose-200 ring-rose-400/35' };
        }
        if (record.gameResult.winner === Player.Black) {
            return { text: '흑 승', chip: 'bg-sky-500/20 text-sky-200 ring-sky-400/35' };
        }
        return { text: '백 승', chip: 'bg-amber-500/20 text-amber-200 ring-amber-400/35' };
    };

    const handleDelete = async (recordId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (deletingId) return;
        if (!confirm('기보를 삭제하시겠습니까?')) return;

        setDeletingId(recordId);
        try {
            onAction({ type: 'DELETE_GAME_RECORD', payload: { recordId } });
        } catch (error) {
            console.error('Failed to delete record:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const btnPrimary =
        'rounded-lg border border-amber-400/40 bg-gradient-to-b from-amber-600/90 to-amber-800/90 px-3 py-1.5 text-xs font-semibold text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:from-amber-500/95 hover:to-amber-700/95 active:scale-[0.98] disabled:opacity-45';
    const btnDanger =
        'rounded-lg border border-rose-400/35 bg-rose-950/50 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/55 active:scale-[0.98] disabled:opacity-45';

    const RecordSlot: React.FC<{ record: GameRecord | null }> = ({ record }) => {
        if (!record) {
            return (
                <div className="flex min-h-[128px] items-center justify-center rounded-xl border border-dashed border-white/12 bg-black/20 p-4 ring-1 ring-inset ring-white/[0.04]">
                    <span className="text-sm font-medium text-slate-500">빈 슬롯</span>
                </div>
            );
        }

        const result = getResultText(record);

        return (
            <div
                role="button"
                tabIndex={0}
                className="group relative w-full cursor-pointer overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950/90 to-black p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.06] transition hover:border-amber-400/40 hover:shadow-[0_20px_48px_rgba(0,0,0,0.55)]"
                onClick={() => onViewRecord(record)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onViewRecord(record);
                    }
                }}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                        background:
                            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(251,191,36,0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(147,197,253,0.08), transparent 50%)',
                    }}
                />
                <div className="relative z-10">
                    <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="truncate text-base font-bold tracking-tight text-amber-50/95 group-hover:text-amber-100">
                                    {record.opponent.nickname}
                                </span>
                                <span
                                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${result.chip}`}
                                >
                                    {result.text}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-400">{getGameModeName(record.mode)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => handleDelete(record.id, e)}
                            className={`shrink-0 rounded-lg p-1.5 text-rose-300/80 opacity-0 ring-1 ring-transparent transition group-hover:opacity-100 hover:bg-rose-950/50 hover:ring-rose-500/30 ${deletingId === record.id ? 'pointer-events-none opacity-40' : ''}`}
                            title="삭제"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-white/8 bg-black/35 px-2.5 py-2">
                            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">점수</div>
                            <div className="text-xs font-semibold text-slate-100">
                                흑 {record.gameResult.blackScore}{' '}
                                <span className="text-slate-500">:</span> {record.gameResult.whiteScore} 백
                            </div>
                        </div>
                        <div className="rounded-lg border border-white/8 bg-black/35 px-2.5 py-2">
                            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">날짜</div>
                            <div className="text-xs font-semibold text-slate-200">{formatDateShort(record.date)}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <DraggableWindow
            title="기보 목록"
            onClose={onClose}
            initialWidth={1200}
            initialHeight={720}
            windowId="gameRecordList"
            isTopmost={isTopmost}
            headerShowTitle
            pcViewportMaxHeightCss="min(90vh, 820px)"
        >
            <div className="w-full max-w-[1160px] space-y-6 px-4 pb-5 pt-1 sm:px-5">
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-zinc-900/98 via-zinc-950 to-black p-5 shadow-[0_24px_64px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/[0.06] sm:p-6">
                    <div
                        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
                        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)' }}
                    />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-black/40 shadow-inner ring-1 ring-amber-500/15">
                                <img src="/images/quickmenu/gibo.png" alt="" className="h-9 w-9 object-contain opacity-95" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-200 to-yellow-200 sm:text-2xl">
                                    저장된 기보
                                </h2>
                                <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">
                                    최근 대국을 슬롯에 고정하고, 전체 목록에서 복기·삭제할 수 있습니다.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                            <div className="rounded-full border border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                <span className="text-2xl font-bold tabular-nums text-amber-100">{records.length}</span>
                                <span className="ml-1.5 text-sm font-medium text-amber-200/70">/ 10</span>
                            </div>
                            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">저장 상한</span>
                        </div>
                    </div>
                </div>

                {sortedRecords.length > 0 && (
                    <section>
                        <div className="mb-3 flex items-end justify-between gap-2 border-b border-white/10 pb-2">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200/90">최근 기보</h3>
                            <span className="text-xs text-slate-500">빠른 복기</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {[0, 1, 2].map((index) => (
                                <RecordSlot key={index} record={recentRecords[index] || null} />
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <div className="mb-3 flex items-end justify-between gap-2 border-b border-white/10 pb-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200/90">전체 목록</h3>
                    </div>

                    {sortedRecords.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-black/40 px-6 py-16 text-center ring-1 ring-inset ring-white/[0.04]">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-black/30">
                                <img src="/images/quickmenu/gibo.png" alt="" className="h-10 w-10 opacity-50" />
                            </div>
                            <p className="text-lg font-semibold text-slate-200">저장된 기보가 없습니다</p>
                            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                                게임 종료 후 기보 저장을 누르면 여기에 쌓입니다. 최대 10개까지 보관됩니다.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-amber-500/15 bg-zinc-950/80 shadow-[0_16px_48px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.05]">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-amber-500/20 bg-gradient-to-r from-black/60 via-zinc-900/80 to-black/60">
                                            <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                                                상대
                                            </th>
                                            <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                                                모드
                                            </th>
                                            <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                                                결과
                                            </th>
                                            <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                                                점수
                                            </th>
                                            <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                                                날짜
                                            </th>
                                            <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                                                작업
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.06]">
                                        {sortedRecords.map((record) => {
                                            const result = getResultText(record);
                                            return (
                                                <tr
                                                    key={record.id}
                                                    className="cursor-pointer bg-transparent transition hover:bg-amber-500/[0.06]"
                                                    onClick={() => onViewRecord(record)}
                                                >
                                                    <td className="px-4 py-3.5">
                                                        <span className="font-semibold text-slate-100">{record.opponent.nickname}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm text-slate-400">{getGameModeName(record.mode)}</td>
                                                    <td className="px-4 py-3.5">
                                                        <span
                                                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${result.chip}`}
                                                        >
                                                            {result.text}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm">
                                                        <span className="font-medium text-sky-300/95">흑 {record.gameResult.blackScore}</span>
                                                        <span className="mx-2 text-slate-600">:</span>
                                                        <span className="font-medium text-amber-200/90">백 {record.gameResult.whiteScore}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm tabular-nums text-slate-500">{formatDate(record.date)}</td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                className={btnPrimary}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onViewRecord(record);
                                                                }}
                                                            >
                                                                보기
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={btnDanger}
                                                                disabled={deletingId === record.id}
                                                                onClick={(e) => handleDelete(record.id, e)}
                                                            >
                                                                {deletingId === record.id ? '삭제 중…' : '삭제'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </DraggableWindow>
    );
};

export default GameRecordListModal;
