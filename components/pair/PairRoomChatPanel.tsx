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
    onSend: (payload: { text: string; scope: PairRoomChatScope }) => void | Promise<void>;
};

const SCOPE_OPTIONS: { value: PairRoomChatScope; label: string }[] = [
    { value: 'room', label: '전체' },
    { value: 'team', label: '팀 채팅' },
];

const PairRoomChatPanel: React.FC<Props> = ({ roomId, messages, currentUserId, disabled, variant = 'default', onSend }) => {
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
                    ? 'flex min-h-[11rem] flex-col rounded-xl border border-violet-400/30 bg-violet-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/10'
                    : 'flex min-h-[11rem] flex-col rounded-xl border border-white/10 bg-black/30'
            }
        >
            <div
                className={
                    interior
                        ? 'flex shrink-0 items-center justify-between gap-2 border-b border-violet-400/25 px-2 py-1.5'
                        : 'flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5'
                }
            >
                <span
                    className={
                        interior
                            ? 'text-[11px] font-extrabold uppercase tracking-wide text-violet-200/95'
                            : 'text-[11px] font-extrabold uppercase tracking-wide text-cyan-100/90'
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
                                            ? 'rounded-md bg-violet-500/80 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm'
                                            : 'rounded-md bg-cyan-500/75 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm'
                                        : 'rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/8 disabled:pointer-events-none disabled:opacity-45'
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
                className="min-h-[6.5rem] max-h-[10.5rem] flex-1 space-y-1 overflow-y-auto px-2 py-1.5 text-[11px] leading-snug"
            >
                {sorted.length === 0 ? (
                    <div className={`py-2 text-center text-[10px] font-medium ${interior ? 'text-violet-300/45' : 'text-slate-500'}`}>
                        {scope === 'team' ? '팀 채팅이 없습니다.' : '대화가 없습니다.'}
                    </div>
                ) : (
                    sorted.map((m) => (
                        <div
                            key={m.id}
                            className={
                                interior
                                    ? 'break-words rounded-md border border-violet-500/10 bg-black/30 px-1.5 py-1'
                                    : 'break-words rounded-md bg-black/25 px-1.5 py-1'
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
                        ? 'flex shrink-0 gap-1 border-t border-violet-400/25 p-1.5'
                        : 'flex shrink-0 gap-1 border-t border-white/10 p-1.5'
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
                            ? 'min-w-0 flex-1 rounded-lg border border-violet-400/25 bg-black/45 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/50 disabled:opacity-45'
                            : 'min-w-0 flex-1 rounded-lg border border-white/12 bg-black/45 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/40 disabled:opacity-45'
                    }
                />
                <button
                    type="submit"
                    disabled={disabled || !draft.trim()}
                    className={
                        interior
                            ? 'shrink-0 rounded-lg border border-violet-400/55 bg-violet-950/60 px-3 py-1.5 text-xs font-extrabold text-violet-50 transition hover:bg-violet-900/55 disabled:pointer-events-none disabled:opacity-40'
                            : 'shrink-0 rounded-lg border border-cyan-400/45 bg-cyan-950/55 px-3 py-1.5 text-xs font-extrabold text-cyan-50 transition hover:bg-cyan-900/55 disabled:pointer-events-none disabled:opacity-40'
                    }
                >
                    전송
                </button>
            </form>
        </div>
    );
};

export default PairRoomChatPanel;
