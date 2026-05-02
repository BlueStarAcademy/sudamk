import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PairRoomChatLine } from '../../types/api.js';

export type PairRoomChatScope = 'room' | 'team';

type Props = {
    roomId: string;
    messages: PairRoomChatLine[];
    currentUserId: string;
    disabled?: boolean;
    /** `interior`: 페어 방 안 — 로비 시안 톤과 구분되는 바이올렛 계열 */
    variant?: 'default' | 'interior';
    /** 모바일 대기실: 채팅 패널 높이·글자 축소 */
    compact?: boolean;
    onSend: (payload: { text: string; scope: PairRoomChatScope }) => void | Promise<void>;
};

const SCOPE_OPTIONS: { value: PairRoomChatScope; label: string }[] = [
    { value: 'room', label: '전체' },
    { value: 'team', label: '팀 채팅' },
];

const PairRoomChatPanel: React.FC<Props> = ({ roomId, messages, currentUserId, disabled, variant = 'default', compact = false, onSend }) => {
    const interior = variant === 'interior';
    const [scope, setScope] = useState<PairRoomChatScope>('room');
    const [draft, setDraft] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    const sorted = useMemo(
        () => [...messages].filter((m) => (m.scope === 'team' ? scope === 'team' : scope === 'room')).sort((a, b) => a.timestamp - b.timestamp),
        [messages, scope],
    );

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [sorted.length, roomId]);

    const submit = () => {
        const t = draft.trim();
        if (!t || disabled) return;
        void onSend({ text: t, scope });
        setDraft('');
    };

    return (
        <div
            className={
                interior
                    ? `flex flex-col rounded-xl border border-violet-400/30 bg-violet-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/10 ${compact ? 'min-h-[8.5rem]' : 'min-h-[11rem]'}`
                    : `flex flex-col rounded-xl border border-white/10 bg-black/30 ${compact ? 'min-h-[8.5rem]' : 'min-h-[11rem]'}`
            }
        >
            <div
                className={
                    interior
                        ? `flex shrink-0 items-center justify-between gap-1.5 border-b border-violet-400/25 ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'}`
                        : `flex shrink-0 items-center justify-between gap-1.5 border-b border-white/10 ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'}`
                }
            >
                <span
                    className={
                        interior
                            ? `font-extrabold uppercase tracking-wide text-violet-200/95 ${compact ? 'text-[10px]' : 'text-[11px]'}`
                            : `font-extrabold uppercase tracking-wide text-cyan-100/90 ${compact ? 'text-[10px]' : 'text-[11px]'}`
                    }
                >
                    페어 채팅
                </span>
                <div
                    className={
                        interior
                            ? 'grid grid-cols-2 overflow-hidden rounded-lg border border-violet-400/25 bg-black/35 p-0.5'
                            : 'grid grid-cols-2 overflow-hidden rounded-lg border border-white/15 bg-black/35 p-0.5'
                    }
                    role="tablist"
                    aria-label="채팅 탭"
                >
                    {SCOPE_OPTIONS.map((o) => {
                        const active = scope === o.value;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                disabled={disabled}
                                onClick={() => setScope(o.value)}
                                className={
                                    active
                                        ? interior
                                            ? `rounded-md bg-violet-500/80 px-1.5 py-0.5 font-extrabold text-white shadow-sm ${compact ? 'text-[10px]' : 'text-[11px]'}`
                                            : `rounded-md bg-cyan-500/75 px-1.5 py-0.5 font-extrabold text-white shadow-sm ${compact ? 'text-[10px]' : 'text-[11px]'}`
                                        : `rounded-md px-1.5 py-0.5 font-bold text-slate-300 transition hover:bg-white/8 disabled:pointer-events-none disabled:opacity-45 ${compact ? 'text-[10px]' : 'text-[11px]'}`
                                }
                            >
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div
                ref={listRef}
                className={`flex-1 overflow-y-auto leading-snug ${compact ? 'min-h-[4rem] max-h-[6.5rem] space-y-0.5 px-1.5 py-1 text-[10px]' : 'min-h-[6.5rem] max-h-[10.5rem] space-y-1 px-2 py-1.5 text-[11px]'}`}
            >
                {sorted.length === 0 ? (
                    <div className={`py-1.5 text-center font-medium ${interior ? 'text-violet-300/45' : 'text-slate-500'} ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                        {scope === 'team' ? '팀 채팅이 없습니다.' : '대화가 없습니다.'}
                    </div>
                ) : (
                    sorted.map((m) => (
                        <div
                            key={m.id}
                            className={
                                interior
                                    ? `break-words rounded-md border border-violet-500/10 bg-black/30 ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`
                                    : `break-words rounded-md bg-black/25 ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`
                            }
                        >
                            <span
                                className={`mr-1 font-extrabold ${m.userId === currentUserId ? (interior ? 'text-violet-200' : 'text-cyan-200') : 'text-slate-200'}`}
                            >
                                {m.nickname}
                            </span>
                            <span className={interior ? 'text-[9px] font-bold uppercase text-amber-200/75' : 'text-[9px] font-bold uppercase text-amber-200/80'}>
                                {m.scope === 'room' ? '[전체]' : '[팀]'}
                            </span>
                            <span className="ml-1 text-slate-100">{m.text}</span>
                        </div>
                    ))
                )}
            </div>
            <form
                className={
                    interior
                        ? `flex shrink-0 gap-1 border-t border-violet-400/25 ${compact ? 'p-1' : 'p-1.5'}`
                        : `flex shrink-0 gap-1 border-t border-white/10 ${compact ? 'p-1' : 'p-1.5'}`
                }
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={400}
                    disabled={disabled}
                    placeholder={scope === 'team' ? '팀원에게만 보낼 메시지…' : '전체 메시지 입력…'}
                    className={
                        interior
                            ? `min-w-0 flex-1 rounded-lg border border-violet-400/25 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/50 disabled:opacity-45 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs'}`
                            : `min-w-0 flex-1 rounded-lg border border-white/12 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/40 disabled:opacity-45 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs'}`
                    }
                />
                <button
                    type="submit"
                    disabled={disabled || !draft.trim()}
                    className={
                        interior
                            ? `shrink-0 rounded-lg border border-violet-400/55 bg-violet-950/60 font-extrabold text-violet-50 transition hover:bg-violet-900/55 disabled:pointer-events-none disabled:opacity-40 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`
                            : `shrink-0 rounded-lg border border-cyan-400/45 bg-cyan-950/55 font-extrabold text-cyan-50 transition hover:bg-cyan-900/55 disabled:pointer-events-none disabled:opacity-40 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`
                    }
                >
                    전송
                </button>
            </form>
        </div>
    );
};

export default PairRoomChatPanel;
