import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PairRoomChatLine } from '../../types/api.js';
import { type WaitingLobbyPanelTone, pairRoomChatInteriorChrome } from '../waiting-room/waitingLobbyHomePanelStyles.js';

export type PairRoomChatScope = 'room' | 'team';

type Props = {
    roomId: string;
    messages: PairRoomChatLine[];
    currentUserId: string;
    disabled?: boolean;
    /** `interior`: 방 안 — 전략(시안)·페어(바이올렛)·놀이(앰버) 톤은 `interiorLobbyTone` */
    variant?: 'default' | 'interior';
    /** 집계 로비 채널과 맞는 방 안 채팅 껍데기(기본 `pair`) */
    interiorLobbyTone?: WaitingLobbyPanelTone;
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

const SCOPE_OPTIONS: { value: PairRoomChatScope; labelKey: 'room.chatTabAll' | 'room.chatTabTeam' }[] = [
    { value: 'room', labelKey: 'room.chatTabAll' },
    { value: 'team', labelKey: 'room.chatTabTeam' },
];

const PairRoomChatPanel: React.FC<Props> = ({
    roomId,
    messages,
    currentUserId,
    disabled,
    variant = 'default',
    interiorLobbyTone = 'pair',
    compact = false,
    fillAvailableHeight = false,
    roomOnlyChat = false,
    onSend,
}) => {
    const { t } = useTranslation(['pair', 'game']);
    const interior = variant === 'interior';
    const interiorChrome = useMemo(
        () => (interior ? pairRoomChatInteriorChrome(interiorLobbyTone) : null),
        [interior, interiorLobbyTone],
    );
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
                    ? interior && interiorChrome
                        ? `flex h-full min-h-0 flex-1 flex-col ${interiorChrome.rootFill}`
                        : 'flex h-full min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-black/30'
                    : interior && interiorChrome
                      ? `flex flex-col ${interiorChrome.rootFixed} ${compact ? 'min-h-[8.5rem]' : 'min-h-[11rem]'}`
                      : `flex flex-col rounded-xl border border-white/10 bg-black/30 ${compact ? 'min-h-[8.5rem]' : 'min-h-[11rem]'}`
            }
        >
            <div
                className={
                    interior && interiorChrome
                        ? `flex shrink-0 items-center gap-1.5 ${interiorChrome.toolbar} ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} ${roomOnlyChat ? '' : 'justify-between'}`
                        : `flex shrink-0 items-center gap-1.5 border-b border-white/10 ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} ${roomOnlyChat ? '' : 'justify-between'}`
                }
            >
                <span
                    className={
                        interior && interiorChrome
                            ? `${interiorChrome.title} ${roomOnlyChat ? '' : 'uppercase'} ${compact ? 'text-[10px]' : 'text-[11px]'}`
                            : `font-extrabold tracking-wide text-cyan-100/90 ${roomOnlyChat ? '' : 'uppercase'} ${compact ? 'text-[10px]' : 'text-[11px]'}`
                    }
                >
                    {roomOnlyChat ? t('room.chatTitle') : t('room.pairChatTitle')}
                </span>
                {!roomOnlyChat ? (
                    <div
                        className={
                            interior && interiorChrome
                                ? `grid grid-cols-2 overflow-hidden rounded-lg ${interiorChrome.tabShell} p-0.5`
                                : 'grid grid-cols-2 overflow-hidden rounded-lg border border-white/15 bg-black/35 p-0.5'
                        }
                        role="tablist"
                        aria-label={t('room.chatTabsAria')}
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
                                            ? interior && interiorChrome
                                                ? `${interiorChrome.tabActive} ${compact ? 'text-[10px]' : 'text-[11px]'}`
                                                : `rounded-md bg-cyan-500/75 px-1.5 py-0.5 font-extrabold text-white shadow-sm ${compact ? 'text-[10px]' : 'text-[11px]'}`
                                            : `rounded-md px-1.5 py-0.5 font-bold text-slate-300 transition hover:bg-white/8 disabled:pointer-events-none disabled:opacity-45 ${compact ? 'text-[10px]' : 'text-[11px]'}`
                                    }
                                >
                                    {t(o.labelKey)}
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
                    <div
                        className={`py-1.5 text-center font-medium ${interior && interiorChrome ? interiorChrome.emptyHint : 'text-slate-500'} ${compact ? 'text-[9px]' : 'text-[10px]'}`}
                    >
                        {roomOnlyChat ? t('room.noMessages') : scope === 'team' ? t('room.noTeamMessages') : t('room.noMessages')}
                    </div>
                ) : (
                    sorted.map((m) => (
                        <div
                            key={m.id}
                            className={
                                interior && interiorChrome
                                    ? `${interiorChrome.messageBubble} ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`
                                    : `break-words rounded-md bg-black/25 ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`
                            }
                        >
                            <span
                                className={`mr-1 font-extrabold ${m.userId === currentUserId ? (interior && interiorChrome ? interiorChrome.selfName : 'text-cyan-200') : 'text-slate-200'}`}
                            >
                                {m.nickname}
                            </span>
                            {!roomOnlyChat ? (
                                <span className={interior ? 'text-[9px] font-bold uppercase text-amber-200/75' : 'text-[9px] font-bold uppercase text-amber-200/80'}>
                                    {m.scope === 'room' ? t('room.scopeAll') : t('room.scopeTeam')}
                                </span>
                            ) : null}
                            <span className="ml-1 text-slate-100">{m.text}</span>
                        </div>
                    ))
                )}
            </div>
            <form
                className={
                    interior && interiorChrome
                        ? `flex shrink-0 items-stretch gap-0.5 ${interiorChrome.form} ${compact ? 'p-1' : 'p-2.5'}`
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
                    placeholder={
                        roomOnlyChat
                            ? t('game:chatPlaceholder')
                            : scope === 'team'
                              ? t('room.teamMessagePlaceholder')
                              : t('room.roomMessagePlaceholder')
                    }
                    className={
                        interior && interiorChrome
                            ? `min-w-0 flex-1 ${interiorChrome.input} ${compact ? 'rounded-md px-1.5 py-1 text-[10px] leading-tight' : 'rounded-lg px-3 py-3 text-sm'}`
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
                    {t('room.send')}
                </button>
            </form>
        </div>
    );
};

export default PairRoomChatPanel;
