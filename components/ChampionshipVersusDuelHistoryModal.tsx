import React from 'react';
import { createPortal } from 'react-dom';
import type { ChampionshipVersusDuelWeekLogEntry, ChampionshipVersusVenueKind } from '../shared/types/entities.js';
import {
    championshipVersusDuelVenueModeLabelKo,
    formatVersusDuelLogAgeLabelKo,
} from '../shared/utils/championshipVersusDuelWeekLog.js';
import Button from './Button.js';

export type ChampionshipVersusDuelHistoryModalProps = {
    open: boolean;
    onClose: () => void;
    entries: ChampionshipVersusDuelWeekLogEntry[] | undefined;
    /** 설정 시 해당 경기장만 표시 */
    filterVenue?: ChampionshipVersusVenueKind | null;
    title?: string;
};

const ChampionshipVersusDuelHistoryModal: React.FC<ChampionshipVersusDuelHistoryModalProps> = ({
    open,
    onClose,
    entries,
    filterVenue = null,
    title = '대전정보',
}) => {
    const rows = React.useMemo(() => {
        const list = Array.isArray(entries) ? [...entries] : [];
        const filtered = filterVenue ? list.filter((e) => e.venue === filterVenue) : list;
        filtered.sort((a, b) => b.occurredAt - a.occurredAt);
        return filtered;
    }, [entries, filterVenue]);

    const now = Date.now();

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[480] flex items-center justify-center bg-black/75 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="championship-duel-history-title"
            onClick={onClose}
        >
            <div
                className="flex max-h-[min(90dvh,640px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl ring-1 ring-amber-300/15"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/25 px-4 py-3 sm:px-5">
                    <h2 id="championship-duel-history-title" className="text-base font-black text-amber-100 sm:text-lg">
                        {title}
                    </h2>
                    <Button type="button" colorScheme="none" className="!px-3 !py-1.5 !text-xs" onClick={onClose}>
                        닫기
                    </Button>
                </div>
                <p className="shrink-0 border-b border-white/[0.06] px-4 py-2 text-[11px] font-semibold text-slate-400 sm:px-5">
                    KST 기준 최근 7일간의 기록입니다. 하루가 지날수록 오래된 기록은 자동으로 사라집니다.
                </p>
                <div className="min-h-0 flex-1 overflow-auto">
                    {rows.length === 0 ? (
                        <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500 sm:px-5">저장된 대전 기록이 없습니다.</div>
                    ) : (
                        <table className="w-full min-w-[520px] border-collapse text-left text-[11px] sm:text-xs">
                            <thead className="sticky top-0 z-[1] bg-slate-950">
                                <tr className="border-b border-amber-500/20 text-[10px] font-black uppercase tracking-wide text-amber-200/90 sm:text-[11px]">
                                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">경기 모드</th>
                                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">상대 닉네임</th>
                                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">경기 결과</th>
                                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">랭킹점수 변화</th>
                                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">기록일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const delta = Math.round(r.ratingAfter - r.ratingBefore);
                                    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
                                    const deltaClass =
                                        delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-300';
                                    return (
                                        <tr
                                            key={r.id}
                                            className="border-b border-white/[0.05] odd:bg-slate-900 even:bg-slate-950 hover:bg-amber-900/30"
                                        >
                                            <td className="max-w-[8.5rem] whitespace-normal break-words px-2 py-2 font-semibold text-slate-100 sm:px-3 sm:py-2.5">
                                                {championshipVersusDuelVenueModeLabelKo(r.venue)}
                                            </td>
                                            <td className="max-w-[10rem] whitespace-normal break-words px-2 py-2 font-bold text-white sm:px-3 sm:py-2.5">
                                                {r.opponentNickname}
                                            </td>
                                            <td className="whitespace-nowrap px-2 py-2 font-black sm:px-3 sm:py-2.5">
                                                <span className={r.won ? 'text-emerald-300' : 'text-rose-300'}>{r.won ? '승' : '패'}</span>
                                            </td>
                                            <td className="whitespace-nowrap px-2 py-2 font-mono font-black tabular-nums sm:px-3 sm:py-2.5">
                                                <span className={deltaClass}>{deltaStr}</span>
                                                <span className="ml-1 text-[10px] font-semibold text-slate-500">
                                                    ({Math.round(r.ratingBefore)}→{Math.round(r.ratingAfter)})
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-300 sm:px-3 sm:py-2.5">
                                                {formatVersusDuelLogAgeLabelKo(now, r.occurredAt)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default ChampionshipVersusDuelHistoryModal;
