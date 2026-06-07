import React, { useState, useMemo, useEffect } from 'react';
import { User, GameRecord, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import DraggableWindow from './DraggableWindow.js';
import { formatGameRecordResultLabel } from '../utils/gameRecordResultLabel.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import GameRecordViewerPanel from './gameRecord/GameRecordViewerPanel.js';
import GameRecordInfoPanel from './gameRecord/GameRecordInfoPanel.js';

interface GameRecordListModalProps {
    currentUser: User;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
}

const GameRecordListModal: React.FC<GameRecordListModalProps> = ({
    currentUser,
    onClose,
    onAction,
    isTopmost,
    embedded = false,
}) => {
    const records = currentUser.savedGameRecords || [];
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

    const sortedRecords = useMemo(() => [...records].sort((a, b) => b.date - a.date), [records]);

    const selectedRecord = useMemo(
        () => sortedRecords.find((r) => r.id === selectedRecordId) ?? null,
        [sortedRecords, selectedRecordId],
    );

    useEffect(() => {
        if (sortedRecords.length === 0) {
            setSelectedRecordId(null);
            return;
        }
        if (!selectedRecordId || !sortedRecords.some((r) => r.id === selectedRecordId)) {
            setSelectedRecordId(sortedRecords[0].id);
        }
    }, [sortedRecords, selectedRecordId]);

    const getGameModeName = (mode: string) => {
        const strategic = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
        if (strategic) return strategic.name;
        const playful = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
        return playful ? playful.name : mode;
    };

    const formatDateShort = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const getResultText = (record: GameRecord) => formatGameRecordResultLabel(record);

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

    const subPanelClass =
        'rounded-xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm';

    const listPanelWidthClass = embedded
        ? 'w-[18rem] max-w-[42%] shrink-0 sm:w-[22rem]'
        : 'w-full sm:w-[18rem] sm:max-w-[42%] sm:shrink-0 lg:w-[22rem]';

    const listScrollClass = 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 [-webkit-overflow-scrolling:touch]';

    const renderListPanel = () => {
        if (sortedRecords.length === 0) {
            return (
                <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-3 px-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/20 bg-black/30">
                        <img src="/images/quickmenu/gibo.webp" alt="" className="h-9 w-9 opacity-50" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-200">저장된 기보가 없습니다</p>
                        <p className="mt-1 text-xs text-slate-500">게임 종료 후 기보 저장을 누르면 여기에 쌓입니다.</p>
                    </div>
                </div>
            );
        }

        return (
            <div className={listScrollClass}>
                <div className="flex flex-col gap-1.5">
                    {sortedRecords.map((record) => {
                        const result = getResultText(record);
                        const isSelected = record.id === selectedRecordId;

                        return (
                            <div
                                key={record.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedRecordId(record.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedRecordId(record.id);
                                    }
                                }}
                                className={`group relative w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition ${
                                    isSelected
                                        ? 'border-amber-400/50 bg-amber-950/35 ring-1 ring-amber-400/25'
                                        : 'border-white/[0.08] bg-black/25 hover:border-amber-400/30 hover:bg-black/40'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-1.5">
                                    <span
                                        className={`min-w-0 flex-1 truncate text-base font-bold ${
                                            isSelected ? 'text-amber-50' : 'text-slate-100'
                                        }`}
                                    >
                                        VS {record.opponent.nickname}
                                    </span>
                                    <span
                                        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${result.chip}`}
                                    >
                                        {result.text}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                                    <span className="truncate">{getGameModeName(record.mode)}</span>
                                    <span className="shrink-0 tabular-nums">{formatDateShort(record.date)}</span>
                                </div>
                                <div className="mt-0.5 text-xs tabular-nums text-slate-400">
                                    흑 {record.gameResult.blackScore}
                                    <span className="mx-1 text-slate-600">:</span>
                                    {record.gameResult.whiteScore} 백
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => handleDelete(record.id, e)}
                                    className={`absolute bottom-1.5 right-1.5 rounded-md p-1 text-rose-300/70 opacity-0 ring-1 ring-transparent transition group-hover:opacity-100 hover:bg-rose-950/50 hover:ring-rose-500/30 ${
                                        deletingId === record.id ? 'pointer-events-none opacity-40' : ''
                                    } ${isSelected ? 'opacity-70' : ''}`}
                                    title="삭제"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderViewerPanel = () => {
        if (!selectedRecord) {
            return (
                <div className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 px-4 text-center text-slate-500">
                    <img src="/images/quickmenu/gibo.webp" alt="" className="h-10 w-10 opacity-40" />
                    <p className="text-sm">목록에서 기보를 선택하면 우측에서 바로 복기할 수 있습니다.</p>
                </div>
            );
        }

        return <GameRecordViewerPanel key={selectedRecord.id} record={selectedRecord} variant="inline" />;
    };

    const shellClass = embedded
        ? 'flex h-full min-h-0 flex-col overflow-hidden'
        : 'flex h-full min-h-0 flex-col overflow-hidden px-1 pb-1 pt-0 sm:px-2 sm:pb-2';

    const panelShellClass = `${subPanelClass} flex min-h-0 flex-col overflow-hidden p-2 sm:p-2.5`;

    const splitBody = (
        <div className={shellClass}>
            <div
                className={`flex min-h-0 flex-1 gap-2 overflow-hidden sm:gap-3 ${embedded ? 'flex-row' : 'flex-col sm:flex-row'}`}
            >
                <div className={`flex min-h-0 flex-col gap-2 ${listPanelWidthClass}`}>
                    <div className={`${panelShellClass} min-h-0 flex-1`}>
                        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/20 pb-1.5">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-200/90 sm:text-sm">
                                기보 목록
                            </h3>
                            <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-0.5 text-xs tabular-nums text-amber-100">
                                <span className="font-bold">{records.length}</span>
                                <span className="font-medium text-amber-200/70"> / 10</span>
                            </span>
                        </div>
                        {renderListPanel()}
                    </div>
                    <div className={`${panelShellClass} min-h-0 max-h-[45%] shrink-0 sm:max-h-[40%]`}>
                        <div className="mb-2 shrink-0 border-b border-amber-500/20 pb-1.5 text-center">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200 sm:text-base">
                                대국 정보
                            </h3>
                        </div>
                        <GameRecordInfoPanel record={selectedRecord} myNickname={currentUser.nickname} />
                    </div>
                </div>
                <div className={`${panelShellClass} min-h-0 min-w-0 flex-1`}>{renderViewerPanel()}</div>
            </div>
        </div>
    );

    if (embedded) {
        return <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{splitBody}</div>;
    }

    return (
        <DraggableWindow
            title="기보"
            onClose={onClose}
            initialWidth={1280}
            initialHeight={720}
            windowId="gameRecordList"
            isTopmost={isTopmost}
            headerShowTitle
            bodyNoScroll
            pcViewportMaxHeightCss="min(90vh, 820px)"
            bodyPaddingClassName="p-2 sm:p-3"
        >
            {splitBody}
        </DraggableWindow>
    );
};

export default GameRecordListModal;
