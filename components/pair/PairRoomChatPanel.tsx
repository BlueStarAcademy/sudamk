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
    /** 부모가 `flex-1 min-h-0`로 줄인 세로 공간을 메시지 영역이 모두 쓰게 함 */
    fillAvailableHeight?: boolean;
    /**
     * 전략바둑 방 등 팀이 없는 경우: 「페어 채팅」·팀 탭 없이 방 참가자만 보는 채팅만 (`scope`는 항상 `room`).
     */
    roomOnlyChat?: boolean;
    onSend: (payload: { text: string; scope: PairRoomChatScope }) => void | Promise<void>;
};

const SCOPE_OPTIONS: { value: PairRoomChatScope; label: string }[] = [
    { value: 'room', label: '전체' },
    { value: 'team', label: '팀 채팅' },
];

const PairRoomChatPanel: React.FC<Props> = ({
    roomId,
    messages,
    currentUserId,
    disabled,
    variant = 'default',
    compact = false,
    fillAvailableHeight = false,
    roomOnlyChat = false,
    onSend,
}) => {
    const interior = variant === 'interior';
    const [scope, setScope] = useState<PairRoomChatScope>('room');
    const [draft, setDraft] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (roomOnlyChat) setScope('room');
    }, [roomOnlyChat, roomId]);

    const sorted = useMemo(() => {
        const list = roomOnlyChat
            ? messages.filter((m) => m.scope === 'room')
            : messages.filter((m) => (m.scope === 'team' ? scope === 'team' : scope === 'room'));
        return [...list].sort((a, b) => a.timestamp - b.timestamp);
    }, [messages, roomOnlyChat, scope]);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [sorted.length, roomId]);

    const submit = () => {
        const t = draft.trim();
        if (!t || disabled) return;
        void onSend({ text: t, scope: roomOnlyChat ? 'room' : scope });
        setDraft('');
    };

    return (
        <div
            className={
                fillAvailableHeight
                    ? interior
                        ? 'flex h-full min-h-0 flex-1 flex-col rounded-xl border border-violet-400/30 bg-violet-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/10'
                        : 'flex h-full min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-black/30'
                    : interior
                      ? `flex flex-col rounded-xl border border-violet-400/30 bg-violet-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/10 ${compact ? 'min-h-[8.5rem]' : 'min-h-[11rem]'}`
                      : `flex flex-col rounded-xl border border-white/10 bg-black/30 ${compact ? 'min-h-[8.5rem]' : 'min-h-[11rem]'}`
            }
        >
            <div
                className={
                    interior
                        ? `flex shrink-0 items-center gap-1.5 border-b border-violet-400/25 ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} ${roomOnlyChat ? '' : 'justify-between'}`
                        : `flex shrink-0 items-center gap-1.5 border-b border-white/10 ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} ${roomOnlyChat ? '' : 'justify-between'}`
                }
            >
                <span
                    className={
                        interior
                            ? `font-extrabold tracking-wide text-violet-200/95 ${roomOnlyChat ? '' : 'uppercase'} ${compact ? 'text-[10px]' : 'text-[11px]'}`
                            : `font-extrabold tracking-wide text-cyan-100/90 ${roomOnlyChat ? '' : 'uppercase'} ${compact ? 'text-[10px]' : 'text-[11px]'}`
                    }
                >
                    {roomOnlyChat ? '채팅' : '페어 채팅'}
                </span>
                {!roomOnlyChat ? (
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
                ) : null}
            </div>
            <div
                ref={listRef}
                className={`flex-1 overflow-y-auto leading-snug ${
                    fillAvailableHeight
                        ? compact
                            ? 'min-h-0 space-y-0.5 px-1.5 py-1 text-[10px]'
                            : 'min-h-0 space-y-1 px-2 py-1.5 text-[11px]'
                        : compact
                          ? 'min-h-[4rem] max-h-[6.5rem] space-y-0.5 px-1.5 py-1 text-[10px]'
                          : 'min-h-[6.5rem] max-h-[10.5rem] space-y-1 px-2 py-1.5 text-[11px]'
                }`}
            >
                {sorted.length === 0 ? (
                    <div className={`py-1.5 text-center font-medium ${interior ? 'text-violet-300/45' : 'text-slate-500'} ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                        {roomOnlyChat ? '대화가 없습니다.' : scope === 'team' ? '팀 채팅이 없습니다.' : '대화가 없습니다.'}
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
                            {!roomOnlyChat ? (
                                <span className={interior ? 'text-[9px] font-bold uppercase text-amber-200/75' : 'text-[9px] font-bold uppercase text-amber-200/80'}>
                                    {m.scope === 'room' ? '[전체]' : '[팀]'}
                                </span>
                            ) : null}
                            <span className="ml-1 text-slate-100">{m.text}</span>
                        </div>
                    ))
                )}
            </div>
            <form
                className={
                    interior
                        ? `flex shrink-0 items-stretch gap-0.5 border-t border-violet-400/25 ${compact ? 'p-1' : 'p-2.5'}`
                        : `flex shrink-0 items-stretch gap-0.5 border-t border-white/10 ${compact ? 'p-1' : 'p-2.5'}`
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
                    placeholder={roomOnlyChat ? '메시지 입력…' : scope === 'team' ? '팀원에게만 보낼 메시지…' : '전체 메시지 입력…'}
                    className={
                        interior
                            ? `min-w-0 flex-1 border border-violet-400/25 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/50 disabled:opacity-45 ${compact ? 'rounded-md px-1.5 py-1 text-[10px] leading-tight' : 'rounded-lg px-3 py-3 text-sm'}`
                            : `min-w-0 flex-1 border border-white/12 bg-black/45 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/40 disabled:opacity-45 ${compact ? 'rounded-md px-1.5 py-1 text-[10px] leading-tight' : 'rounded-lg px-3 py-3 text-sm'}`
                    }
                />
                <button
                    type="submit"
                    disabled={disabled || !draft.trim()}
                    className={
                        compact
                            ? interior
                                ? 'shrink-0 self-center rounded-md border border-amber-400/70 bg-gradient-to-b from-amber-700/90 to-amber-950/95 px-2 py-1 text-[10px] font-extrabold leading-none text-amber-50 shadow-sm transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'
                                : 'shrink-0 self-center rounded-md border border-cyan-400/60 bg-gradient-to-b from-cyan-700/85 to-cyan-950/95 px-2 py-1 text-[10px] font-extrabold leading-none text-cyan-50 shadow-sm transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'
                            : interior
                              ? 'shrink-0 rounded-lg border-2 border-amber-400/70 bg-gradient-to-b from-amber-700/90 to-amber-950/95 px-4 py-3 text-sm font-extrabold text-amber-50 shadow-[0_4px_14px_-4px_rgba(251,191,36,0.45)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'
                              : 'shrink-0 rounded-lg border-2 border-cyan-400/60 bg-gradient-to-b from-cyan-700/85 to-cyan-950/95 px-4 py-3 text-sm font-extrabold text-cyan-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.35)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'
                    }
                >
                    전송
                </button>
            </form>
        </div>
    );
};

export default PairRoomChatPanel;
