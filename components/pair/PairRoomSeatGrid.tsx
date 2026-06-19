import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '../../shared/i18n/runtimeText.js';
import Avatar from '../Avatar.js';
import { GameMode, type GameSettings } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import {
    deterministicPairAiOpponentPetDisplayLevelFromSeed,
    resolveAiLobbyProfileStepFromSettings,
} from '../../shared/utils/strategicAiDifficulty.js';
import {
    type WaitingLobbyPanelTone,
    pairAggregateRoomSeatDelegateBtnToneClass,
} from '../waiting-room/waitingLobbyHomePanelStyles.js';

export type PairRoomKind = 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai';

function seatGridPetMutedHeadingClass(lobby: WaitingLobbyPanelTone): string {
    if (lobby === 'strategic') return 'text-cyan-200/95';
    if (lobby === 'playful') return 'text-amber-200/95';
    return 'text-violet-200/95';
}

type SeatTone = 'open' | 'filled' | 'locked';

export type PairSeatMember = {
    id: string;
    name: string;
    kind: string;
    ready?: boolean;
    subLabel?: string;
    portraitSrc?: string | null;
    /** 유저 슬롯: 로비 온라인 목록과 동일한 프로필 초상화·테두리 */
    avatarUrl?: string | null;
    borderUrl?: string | null;
    /** 펫 슬롯: 첫 줄 레벨(예: Lv.3), 둘째 줄 이름(줄임 없이 줄바꿈) */
    petLineLevel?: string | null;
    petLineName?: string | null;
};

function HostHomeBadge({ compact }: { compact?: boolean }) {
    return (
        <span
            className={`pointer-events-none absolute z-[2] flex items-center justify-center rounded-md border border-amber-400/50 bg-amber-950/90 shadow-[0_0_8px_rgba(251,191,36,0.25)] ${
                compact ? 'right-0.5 top-0.5 h-4 w-4' : 'right-1 top-1 h-5 w-5'
            }`}
            aria-label={tx('pair:room.hostAria')}
        >
            <svg width={compact ? 10 : 12} height={compact ? 10 : 12} viewBox="0 0 24 24" fill="none" className="text-amber-200" aria-hidden>
                <path
                    d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinejoin="round"
                />
            </svg>
        </span>
    );
}

function ReadyRibbonOnAvatar({ compact }: { compact?: boolean }) {
    return (
        <span
            className={`pointer-events-none absolute left-1/2 top-0 z-[6] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-emerald-400/65 bg-emerald-950/95 font-extrabold tracking-wide text-emerald-100 shadow-[0_2px_10px_rgba(0,0,0,0.5),0_0_12px_rgba(16,185,129,0.25)] ${
                compact ? 'px-1.5 py-0 text-[7px]' : 'px-2 py-0.5 text-[9px]'
            }`}
            aria-label={tx('pair:room.readyAria')}
        >
            {tx('pair:room.readyBadge')}
        </span>
    );
}

function PresenceOverlayBadge({ label, compact }: { label: string; compact?: boolean }) {
    return (
        <span
            className={`pointer-events-none absolute left-1/2 top-1/2 z-[7] -translate-x-1/2 -translate-y-1/2 rounded-md border border-amber-300/70 bg-black/85 px-1.5 py-0.5 font-extrabold tracking-wide text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.35)] ${
                compact ? 'text-[8px]' : 'text-[10px]'
            }`}
            aria-label={label}
        >
            {label}
        </span>
    );
}

function SeatTile({
    tone,
    label,
    subLabel,
    userId,
    userName,
    accent,
    onOpenClick,
    isRoomHost,
    showReady,
    draggable,
    dropTeam,
    dropIndex,
    onDropUser,
    isDropTarget,
    portraitSrc,
    onProfileClick,
    compact,
    profileInline = false,
    actionFooter,
    petLineLevel,
    petLineName,
    avatarUrl,
    borderUrl,
    statusOverlayLabel,
    lobbyChromeTone = 'pair',
}: {
    tone: SeatTone;
    label: string;
    subLabel?: string;
    userId?: string;
    userName?: string;
    accent: 'ally' | 'enemy' | 'neutral';
    onOpenClick?: () => void;
    isRoomHost?: boolean;
    showReady?: boolean;
    draggable?: boolean;
    dropTeam?: 'teamA' | 'teamB';
    dropIndex?: 0 | 1;
    onDropUser?: (team: 'teamA' | 'teamB', index: 0 | 1, draggedUserId: string) => void;
    isDropTarget?: boolean;
    /** 유저 아바타 대신 표시(예: 펫 페어 장착 펫 초상화) */
    portraitSrc?: string | null;
    /** 착석 타일에서 프로필·펫 정보 모달 등 */
    onProfileClick?: () => void;
    /** 모바일 대기실: 타일·아바타 축소 */
    compact?: boolean;
    /** 착석 펫 타일: 초상화 옆에 이름·부제를 가로로 배치(카드 높이 안에 수렴) */
    profileInline?: boolean;
    /** 슬롯 하단(방장 강퇴 등) */
    actionFooter?: React.ReactNode;
    petLineLevel?: string | null;
    petLineName?: string | null;
    avatarUrl?: string | null;
    borderUrl?: string | null;
    statusOverlayLabel?: string;
    lobbyChromeTone?: WaitingLobbyPanelTone;
}) {
    const { t } = useTranslation('pair');
    const locked = tone === 'locked';
    const open = tone === 'open';
    const ally = accent === 'ally';
    const enemy = accent === 'enemy';
    const ch = lobbyChromeTone ?? 'pair';

    const neutralBorder =
        ch === 'strategic' ? 'border-cyan-400/38' : ch === 'playful' ? 'border-amber-400/38' : 'border-violet-400/35';
    const neutralBg =
        ch === 'strategic'
            ? 'bg-gradient-to-b from-cyan-950/38 to-black'
            : ch === 'playful'
              ? 'bg-gradient-to-b from-amber-950/40 to-black'
              : 'bg-gradient-to-b from-violet-950/40 to-black';

    const baseBorder = locked
        ? 'border-zinc-600/40'
        : enemy
          ? 'border-rose-500/25'
          : ally
            ? open
              ? 'border-cyan-400/45'
              : 'border-emerald-400/45'
            : neutralBorder;

    const baseBg = locked
        ? 'bg-gradient-to-b from-zinc-950/95 to-black'
        : enemy
          ? 'bg-gradient-to-b from-rose-950/50 via-zinc-950/80 to-black'
          : ally
            ? open
              ? 'bg-gradient-to-b from-cyan-950/35 via-slate-950/60 to-black/90'
              : 'bg-gradient-to-b from-emerald-950/45 via-slate-950/70 to-black/90'
            : neutralBg;

    const innerGlow =
        !locked && ally
            ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : enemy
              ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
              : '';

    const interactive = open && typeof onOpenClick === 'function';
    const droppable = typeof onDropUser === 'function' && dropTeam !== undefined && dropIndex !== undefined;
    /** 펫 슬롯: 레벨(있으면)·이름 — `tileH`보다 먼저 선언(TDZ 방지) */
    const usePetNameLines = Boolean(petLineName);
    const compactPetFilled = Boolean(compact && usePetNameLines && tone === 'filled');
    /** 모바일은 세로 스택(이미지→레벨→이름); 가로 인라인은 패널 밖으로 넘치기 쉬워 compact에서는 끔 */
    const filledInline = Boolean(profileInline && tone === 'filled' && !compact);
    const tileH = actionFooter
        ? compact
            ? 'min-h-[6.75rem] px-1.5 py-1'
            : 'min-h-[9.25rem] px-2 py-2'
        : compact
          ? compactPetFilled
              ? 'min-h-[6.75rem] max-h-[9rem] px-1.5 py-1'
              : 'h-[5.25rem] min-h-[5.25rem] px-1.5 py-1'
          : 'h-[7.5rem] min-h-[7.5rem] px-2 py-2';
    const avSize = compact ? 32 : 40;

    return (
        <div
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? onOpenClick : undefined}
            onKeyDown={
                interactive
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenClick?.();
                          }
                      }
                    : undefined
            }
            draggable={Boolean(draggable && userId && tone === 'filled')}
            onDragStart={(e) => {
                if (!draggable || !userId || tone !== 'filled') return;
                e.dataTransfer.setData('text/pair-user-id', userId);
                e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
                if (!droppable || dropTeam === undefined || dropIndex === undefined) return;
                e.preventDefault();
                const dragged = e.dataTransfer.getData('text/pair-user-id');
                if (dragged) onDropUser(dropTeam, dropIndex, dragged);
            }}
            className={`relative flex min-w-0 ${tileH} flex-col overflow-hidden rounded-lg border transition sm:rounded-xl ${baseBorder} ${baseBg} ${innerGlow} ${
                interactive ? 'cursor-pointer hover:border-cyan-300/55 hover:brightness-[1.03] active:scale-[0.99]' : ''
            } ${tone === 'filled' && onProfileClick ? 'cursor-pointer' : ''} ${droppable && isDropTarget ? 'ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-black/40' : ''} ${
                draggable && tone === 'filled' ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
        >
            {isRoomHost ? <HostHomeBadge compact={compact} /> : null}
            <div
                className={
                    filledInline
                        ? 'flex min-h-0 w-full min-w-0 flex-1 flex-row items-center gap-1 overflow-hidden text-left'
                        : 'flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-0.5 text-center'
                }
            >
            {locked ? (
                <>
                    <span className={`${compact ? 'text-sm' : 'text-base'} opacity-50`} aria-hidden>
                        ◆
                    </span>
                    <span className={`mt-0.5 font-bold uppercase tracking-[0.2em] text-zinc-600 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{tx('pair:room.waiting')}</span>
                </>
            ) : open ? (
                <>
                    <span className={`font-extralight ${compact ? 'text-lg' : 'text-2xl'} ${ally ? 'text-cyan-200/55' : 'text-rose-200/40'}`}>+</span>
                    <span className={`mt-0.5 font-bold ${compact ? 'text-[10px]' : 'text-xs'} ${ally ? 'text-cyan-100' : 'text-rose-100/90'}`}>{label}</span>
                    {subLabel ? (
                        <span className={`mt-0.5 font-semibold text-slate-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{subLabel}</span>
                    ) : null}
                </>
            ) : filledInline ? (
                <>
                    <div className={`relative flex shrink-0 items-center justify-center overflow-visible ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}>
                        {userId && userName ? (
                            portraitSrc ? (
                                <img
                                    src={portraitSrc}
                                    alt=""
                                    className={`shrink-0 rounded-full border border-white/20 bg-black/50 object-contain shadow-inner ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}
                                    loading="lazy"
                                />
                            ) : (
                                <Avatar
                                    userId={userId}
                                    userName={userName}
                                    avatarUrl={avatarUrl ?? undefined}
                                    borderUrl={borderUrl ?? undefined}
                                    size={avSize}
                                    fixedFrameSize
                                />
                            )
                        ) : (
                            <div
                                className={`flex items-center justify-center rounded-full border border-white/15 bg-black/50 font-bold text-slate-300 ${compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs'}`}
                            >
                                ?
                            </div>
                        )}
                        {onProfileClick ? (
                            <button
                                type="button"
                                className="absolute inset-0 z-[4] cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none ring-cyan-400/0 transition hover:ring-2 hover:ring-cyan-400/45 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                                title={t('room.viewInfo')}
                                aria-label={t('room.viewInfoAria')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onProfileClick();
                                }}
                            />
                        ) : null}
                        {showReady ? <ReadyRibbonOnAvatar compact={compact} /> : null}
                        {statusOverlayLabel ? <PresenceOverlayBadge label={statusOverlayLabel} compact={compact} /> : null}
                    </div>
                    <div className="@container flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 pr-0.5">
                        {usePetNameLines ? (
                            <>
                                {petLineLevel ? (
                                    <span
                                        className={`w-full whitespace-nowrap font-extrabold leading-none ${seatGridPetMutedHeadingClass(ch)} ${compact ? 'text-[9px]' : 'text-[11px]'}`}
                                    >
                                        {petLineLevel}
                                    </span>
                                ) : null}
                                <span
                                    className={`block w-full min-w-0 max-w-full whitespace-nowrap font-extrabold leading-none text-white ${
                                        compact ? '[font-size:clamp(5.5px,9.5cqw,0.75rem)]' : '[font-size:clamp(6px,10.5cqw,0.875rem)]'
                                    }`}
                                >
                                    {petLineName}
                                </span>
                            </>
                        ) : (
                            <span className={`w-full truncate font-extrabold leading-tight text-white ${compact ? 'text-[10px]' : 'text-sm'}`}>
                                {userName || label}
                            </span>
                        )}
                        {subLabel && usePetNameLines ? (
                            <span
                                className={`w-full truncate font-bold uppercase tracking-wider text-emerald-200/65 ${compact ? 'text-[7px] leading-tight' : 'text-[10px]'}`}
                            >
                                {subLabel}
                            </span>
                        ) : (subLabel || label) && (subLabel || label) !== (userName || label) && !usePetNameLines ? (
                            <span
                                className={`w-full truncate font-bold uppercase tracking-wider text-emerald-200/65 ${compact ? 'text-[7px] leading-tight' : 'text-[10px]'}`}
                            >
                                {subLabel || label}
                            </span>
                        ) : null}
                    </div>
                </>
            ) : (
                <>
                    <div className={`relative flex shrink-0 items-center justify-center overflow-visible ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}>
                        {userId && userName ? (
                            portraitSrc ? (
                                <img
                                    src={portraitSrc}
                                    alt=""
                                    className={`shrink-0 rounded-full border border-white/20 bg-black/50 object-contain shadow-inner ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}
                                    loading="lazy"
                                />
                            ) : (
                                <Avatar
                                    userId={userId}
                                    userName={userName}
                                    avatarUrl={avatarUrl ?? undefined}
                                    borderUrl={borderUrl ?? undefined}
                                    size={avSize}
                                    fixedFrameSize
                                />
                            )
                        ) : (
                            <div
                                className={`flex items-center justify-center rounded-full border border-white/15 bg-black/50 font-bold text-slate-300 ${compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs'}`}
                            >
                                ?
                            </div>
                        )}
                        {onProfileClick ? (
                            <button
                                type="button"
                                className="absolute inset-0 z-[4] cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none ring-cyan-400/0 transition hover:ring-2 hover:ring-cyan-400/45 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                                title={t('room.viewInfo')}
                                aria-label={t('room.viewInfoAria')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onProfileClick();
                                }}
                            />
                        ) : null}
                        {showReady ? <ReadyRibbonOnAvatar compact={compact} /> : null}
                        {statusOverlayLabel ? <PresenceOverlayBadge label={statusOverlayLabel} compact={compact} /> : null}
                    </div>
                    {usePetNameLines ? (
                        <div
                            className={`@container mt-0.5 flex min-h-0 min-w-0 max-w-full flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5 ${
                                compact ? 'text-[10px]' : 'text-sm'
                            }`}
                        >
                            {petLineLevel ? (
                                <span
                                    className={`max-w-full text-center font-extrabold leading-none ${seatGridPetMutedHeadingClass(ch)} ${
                                        compact
                                            ? 'text-[clamp(7px,3.1vw,10px)] leading-tight [overflow-wrap:anywhere]'
                                            : 'whitespace-nowrap text-xs'
                                    }`}
                                >
                                    {petLineLevel}
                                </span>
                            ) : null}
                            <span
                                className={`block min-w-0 max-w-full text-center font-extrabold leading-tight text-white ${
                                    compact
                                        ? 'line-clamp-3 max-h-[3.4rem] text-[clamp(7px,3.4vw,11px)] [overflow-wrap:anywhere] hyphens-auto'
                                        : 'whitespace-nowrap [font-size:clamp(6px,10.5cqw,0.875rem)] leading-none'
                                }`}
                            >
                                {petLineName}
                            </span>
                        </div>
                    ) : (
                        <span className={`mt-0.5 max-w-full truncate font-extrabold text-white ${compact ? 'text-[11px] leading-tight' : 'text-sm'}`}>
                            {userName || label}
                        </span>
                    )}
                    {subLabel && usePetNameLines ? (
                        <span
                            className={`max-w-full text-center font-bold uppercase leading-tight tracking-wider text-emerald-200/65 ${
                                compact
                                    ? 'line-clamp-2 text-[clamp(6px,2.9vw,9px)] [overflow-wrap:anywhere]'
                                    : 'truncate text-[10px]'
                            }`}
                        >
                            {subLabel}
                        </span>
                    ) : (subLabel || label) && (subLabel || label) !== (userName || label) && !usePetNameLines ? (
                        <span
                            className={`max-w-full text-center font-bold uppercase leading-tight tracking-wider text-emerald-200/65 ${
                                compact
                                    ? 'line-clamp-2 text-[clamp(6px,2.9vw,9px)] [overflow-wrap:anywhere]'
                                    : 'truncate text-[10px]'
                            }`}
                        >
                            {subLabel || label}
                        </span>
                    ) : null}
                </>
            )}
            </div>
            {actionFooter ? (
                <div className="mt-auto w-full shrink-0 border-t border-white/[0.06] pt-1">{actionFooter}</div>
            ) : null}
        </div>
    );
}

function TeamPanel({
    title,
    subtitle,
    variant,
    children,
    compact,
    seatColumns = 2,
}: {
    title: string;
    subtitle: string;
    variant: 'ally' | 'enemy';
    children: React.ReactNode;
    compact?: boolean;
    /** 1:1 경기장 등 팀당 슬롯 1개만 표시 */
    seatColumns?: 1 | 2;
}) {
    const ally = variant === 'ally';
    return (
        <div
            className={`relative flex min-w-0 flex-1 flex-col rounded-2xl border ${
                compact ? 'gap-1 p-1.5 sm:gap-1.5 sm:p-2' : 'gap-2 p-2.5 sm:p-3'
            } ${
                ally
                    ? 'border-cyan-400/30 bg-gradient-to-br from-cyan-950/55 via-slate-950/80 to-black/95 shadow-[0_0_32px_-8px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'border-rose-500/22 bg-gradient-to-br from-rose-950/35 via-zinc-950/85 to-black/95 shadow-[0_0_28px_-10px_rgba(244,63,94,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]'
            }`}
        >
            <div
                className={`absolute inset-x-2 top-0 h-px rounded-full ${ally ? 'bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent' : 'bg-gradient-to-r from-transparent via-rose-400/30 to-transparent'}`}
                aria-hidden
            />
            {(title.trim() || subtitle.trim()) && (
                <div className="text-center">
                    {title.trim() ? (
                        <div
                            className={`font-extrabold uppercase tracking-[0.28em] ${ally ? 'text-cyan-200/90' : 'text-rose-200/80'} ${
                                compact ? 'text-[10px]' : 'text-[11px]'
                            }`}
                        >
                            {title}
                        </div>
                    ) : null}
                    {subtitle.trim() ? (
                        <div className={`${title.trim() ? 'mt-0.5' : ''} font-semibold text-slate-500 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{subtitle}</div>
                    ) : null}
                </div>
            )}
            <div
                className={`grid min-w-0 ${seatColumns === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${compact ? 'gap-1.5' : 'gap-2'} [&>*]:min-w-0`}
            >
                {children}
            </div>
        </div>
    );
}

type GridCell = {
    userId: string | null;
    name: string | null;
    kind: string;
    ready?: boolean;
    subLabel?: string;
    portraitSrc?: string | null;
    avatarUrl?: string | null;
    borderUrl?: string | null;
    petLineLevel?: string | null;
    petLineName?: string | null;
};

function pairSeatMemberToGridCell(m: PairSeatMember): GridCell {
    return {
        userId: m.id,
        name: m.name,
        kind: m.kind,
        ready: m.ready,
        subLabel: m.subLabel,
        portraitSrc: m.portraitSrc,
        avatarUrl: m.avatarUrl,
        borderUrl: m.borderUrl,
        petLineLevel: m.petLineLevel,
        petLineName: m.petLineName,
    };
}

function membersToTwoSlots(members: PairSeatMember[] | undefined): [GridCell, GridCell] {
    const users = (members || []).filter((m) => m.kind === 'user' || m.kind === 'pet');
    const c0: GridCell = users[0]
        ? {
              userId: users[0].id,
              name: users[0].name,
              kind: users[0].kind,
              ready: users[0].ready,
              subLabel: users[0].subLabel,
              portraitSrc: users[0].portraitSrc,
              avatarUrl: users[0].avatarUrl,
              borderUrl: users[0].borderUrl,
              petLineLevel: users[0].petLineLevel,
              petLineName: users[0].petLineName,
          }
        : { userId: null, name: null, kind: 'empty', ready: false };
    const c1: GridCell = users[1]
        ? {
              userId: users[1].id,
              name: users[1].name,
              kind: users[1].kind,
              ready: users[1].ready,
              subLabel: users[1].subLabel,
              portraitSrc: users[1].portraitSrc,
              avatarUrl: users[1].avatarUrl,
              borderUrl: users[1].borderUrl,
              petLineLevel: users[1].petLineLevel,
              petLineName: users[1].petLineName,
          }
        : { userId: null, name: null, kind: 'empty', ready: false };
    return [c0, c1];
}

function membersToSlotIds(members: PairSeatMember[] | undefined): [string | null, string | null] {
    const u = (members || []).filter((m) => m.kind === 'user' || m.kind === 'pet').map((m) => m.id);
    return [u[0] ?? null, u[1] ?? null];
}

/** 팀당 1칸 UI: 해당 유저 칸을 우선(같은 팀에 주최·게스트만 있어도 1·2번 슬롯 구분) */
function preferCellForUserInPair(g: [GridCell, GridCell], userId: string): GridCell {
    if (g[0].userId === userId) return g[0];
    if (g[1].userId === userId) return g[1];
    if (g[0].userId) return g[0];
    if (g[1].userId) return g[1];
    return g[0];
}

function preferCellForOtherHumanInPair(g: [GridCell, GridCell], excludeUserId: string): GridCell | null {
    if (g[0].userId && g[0].userId !== excludeUserId) return g[0];
    if (g[1].userId && g[1].userId !== excludeUserId) return g[1];
    return null;
}

/** 방장이 앉은 서버 팀(teamA 왼쪽 / teamB 오른쪽). 모든 참가자가 동일한 좌우·톤을 보도록 고정. */
function pickOwnerHomeTeam(
    ownerId: string,
    teamAMembers: PairSeatMember[] | undefined,
    teamBMembers: PairSeatMember[] | undefined,
): 'teamA' | 'teamB' {
    const isOwnerSeat = (m: PairSeatMember) => m.id === ownerId || m.id === `pet-ai-${ownerId}`;
    if ((teamAMembers ?? []).some(isOwnerSeat)) return 'teamA';
    if ((teamBMembers ?? []).some(isOwnerSeat)) return 'teamB';
    return 'teamA';
}

/** 전략·놀이 경기장 `arena_ai` 방 — 상대 슬롯에 모드별 봇 이름·게임 심볼 이미지 */
function resolveArenaAiBotSeat(mode: GameMode | undefined): {
    displayName: string;
    portraitSrc: string;
    subLabel: string;
} {
    const def =
        (mode && SPECIAL_GAME_MODES.find((d) => d.mode === mode)) ||
        (mode && PLAYFUL_GAME_MODES.find((d) => d.mode === mode)) ||
        SPECIAL_GAME_MODES.find((d) => d.mode === GameMode.Standard) ||
        SPECIAL_GAME_MODES[0];
    return {
        displayName: `${def.name}${tx('pair:room.botSuffix')}`,
        portraitSrc: def.image,
        subLabel: tx('pair:room.kataAi'),
    };
}

/** 2인 페어 AI대전 상대 팀 B — 슬롯 0: 본봇, 슬롯 1: 펫봇(`makeDuoPairAiDuelSettings`의 상대 AI / 상대 펫 AI에 대응) */
function resolveDuoTeamBAiSlotPresentation(
    mode: GameMode | undefined,
    slotIdx: 0 | 1,
    lobby?: { roomId: string; settings: GameSettings },
): { displayName: string; portraitSrc: string; subLabel: string } {
    const def =
        (mode && SPECIAL_GAME_MODES.find((d) => d.mode === mode)) ||
        (mode && PLAYFUL_GAME_MODES.find((d) => d.mode === mode)) ||
        SPECIAL_GAME_MODES.find((d) => d.mode === GameMode.Standard) ||
        SPECIAL_GAME_MODES[0];
    const participantId = slotIdx === 0 ? 'pair-opponent-ai' : 'pair-opponent-pet';
    let levelPrefix = '';
    if (lobby?.roomId && lobby.settings) {
        const step = resolveAiLobbyProfileStepFromSettings(lobby.settings);
        const lv = deterministicPairAiOpponentPetDisplayLevelFromSeed(`${lobby.roomId}:${participantId}`, step);
        levelPrefix = `Lv.${lv} `;
    }
    if (slotIdx === 0) {
        return {
            displayName: `${levelPrefix}${def.name}${tx('pair:room.botSuffix')}`,
            portraitSrc: def.image,
            subLabel: tx('pair:room.kataAi'),
        };
    }
    return {
        displayName: `${levelPrefix}${def.name}${tx('pair:room.petBotSuffix')}`,
        portraitSrc: def.image,
        subLabel: tx('pair:room.kataAi'),
    };
}

function applyDropOnSlots(
    slotsA: [string | null, string | null],
    slotsB: [string | null, string | null],
    draggedUserId: string,
    destTeam: 'teamA' | 'teamB',
    destIndex: 0 | 1,
): { teamA: string[]; teamB: string[] } {
    const a: [string | null, string | null] = [...slotsA];
    const b: [string | null, string | null] = [...slotsB];
    let fromTeam: 'teamA' | 'teamB' | null = null;
    let fromIdx: 0 | 1 | null = null;
    for (const [team, arr] of [['teamA', a], ['teamB', b]] as const) {
        const i = arr.findIndex((x) => x === draggedUserId);
        if (i >= 0) {
            fromTeam = team;
            fromIdx = i as 0 | 1;
        }
    }
    const destArr = destTeam === 'teamA' ? a : b;
    const occupant = destArr[destIndex];
    if (fromTeam === destTeam && fromIdx === destIndex) {
        return {
            teamA: [a[0], a[1]].filter(Boolean) as string[],
            teamB: [b[0], b[1]].filter(Boolean) as string[],
        };
    }
    destArr[destIndex] = draggedUserId;
    if (fromTeam !== null && fromIdx !== null) {
        const fromArr = fromTeam === 'teamA' ? a : b;
        if (occupant && occupant !== draggedUserId) {
            fromArr[fromIdx] = occupant;
        } else {
            fromArr[fromIdx] = null;
        }
    }
    return {
        teamA: [a[0], a[1]].filter(Boolean) as string[],
        teamB: [b[0], b[1]].filter(Boolean) as string[],
    };
}

export interface PairRoomSeatGridProps {
    roomKind: PairRoomKind;
    ownerId: string;
    ownerName: string;
    partnerId?: string;
    partnerName?: string;
    ownerReady: boolean;
    partnerReady: boolean;
    teamAMembers?: PairSeatMember[];
    teamBMembers?: PairSeatMember[];
    viewerId: string;
    /** 펫 페어 방에서 방장 본인에게 보여 줄 장착 펫 초상화 URL */
    viewerEquippedPairPetPortraitSrc?: string | null;
    viewerEquippedPairPetName?: string | null;
    viewerEquippedPairPetLevel?: number | null;
    /** 유저 프로필 모달 — 일반 유저 id 만 전달 */
    onViewSeatUserProfile?: (userId: string) => void;
    /** 펫 페어 장착 펫 상세 — `pet-ai-{내 id}` 슬롯 클릭 시 */
    onViewOwnerEquippedPetDetail?: () => void;
    /** `pet-ai-{상대 등}` 슬롯 클릭 시 — 로비 스냅샷으로 상세 표시 */
    onViewOtherSeatPetDetail?: (petAiParticipantId: string) => void;
    onInvitePartnerSlot?: () => void;
    onInviteEmptySlot?: (team: 'teamA' | 'teamB', index: 0 | 1) => void;
    onCommitSeatAssignments?: (teamA: string[], teamB: string[]) => void | Promise<void>;
    /** 방장: 해당 유저 강퇴 확인 모달을 띄움 */
    onKickRoomMemberRequest?: (userId: string) => void;
    /** 방장: 방장 위임 확인 모달을 띄움 */
    onDelegateRoomOwnershipRequest?: (userId: string) => void;
    /** 강퇴 버튼 비활성(매칭 중 등) */
    kickUiDisabled?: boolean;
    /** 모바일 페어 대기실: 슬롯·프로필 축소 */
    compact?: boolean;
    /** 집계 로비 방 안: 좌석·위임 버튼 톤(전략·페어·놀이) */
    seatChromeTone?: WaitingLobbyPanelTone;
    /** 전략/놀이 1:1 등 팀당 착석 슬롯 1개만 표시(화면에 슬롯 2개) */
    oneSlotPerTeam?: boolean;
    /** `arena_ai`·펫 페어 AI 상대 슬롯 — 선택 모드 기준 봇 표시 */
    arenaAiGameMode?: GameMode;
    /** duo/펫 AI 대전 로비: 방·설정으로 합성 상대 두 슬롯 표시 레벨(게임 시작 전 결정론적) */
    pairAiLobbyRoomId?: string;
    pairAiLobbySettings?: GameSettings;
    /** 페어 경기장 `duo_match`(2인 AI대전): 우측 합성 AI 열 없이 방장·파트너 2슬롯만 표시 */
    hideDuoAiOpponentColumn?: boolean;
    /** 페어 PVP 방 내부: 팀 패널을 가로 나란히가 아닌 세로로 배치 */
    stackTeamsVertically?: boolean;
    /** 특정 유저 좌석에 덧씌울 상태 배지(예: 참여중) */
    statusOverlayByUserId?: Record<string, string>;
}

const PairRoomSeatGrid: React.FC<PairRoomSeatGridProps> = ({
    roomKind,
    ownerId,
    ownerName,
    partnerId,
    partnerName,
    ownerReady,
    partnerReady,
    teamAMembers,
    teamBMembers,
    viewerId,
    viewerEquippedPairPetPortraitSrc,
    viewerEquippedPairPetName,
    viewerEquippedPairPetLevel,
    onViewSeatUserProfile,
    onViewOwnerEquippedPetDetail,
    onViewOtherSeatPetDetail,
    onInvitePartnerSlot,
    onInviteEmptySlot,
    onCommitSeatAssignments,
    onKickRoomMemberRequest,
    onDelegateRoomOwnershipRequest,
    kickUiDisabled = false,
    compact = false,
    seatChromeTone = 'pair',
    oneSlotPerTeam = false,
    arenaAiGameMode,
    pairAiLobbyRoomId,
    pairAiLobbySettings,
    hideDuoAiOpponentColumn = false,
    stackTeamsVertically = false,
    statusOverlayByUserId,
}) => {
    const { t } = useTranslation('pair');
    const teamsContainerClass = stackTeamsVertically
        ? compact
            ? 'flex w-full min-w-0 flex-col gap-2'
            : 'flex w-full min-w-0 flex-col gap-3 sm:gap-4'
        : compact
          ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3'
          : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4';
    const viewerPetAiId = `pet-ai-${viewerId}`;
    const isPetPairLobby = roomKind === 'ai_duel';
    const isFriendlyTwoPet = roomKind === 'friendly_2p';
    const isFriendly = roomKind === 'friendly_4p';

    const partnerSlotFilled = Boolean(partnerId && !String(partnerId).startsWith('pet-ai-'));
    const partnerDisplayId = partnerSlotFilled ? partnerId : undefined;
    const partnerDisplayName = partnerSlotFilled ? partnerName || t('partner') : undefined;
    const isOwnerViewer = viewerId === ownerId;
    const canOfferKick = Boolean(isOwnerViewer && onKickRoomMemberRequest);
    const canClickPartnerSlot = Boolean(isOwnerViewer && onInvitePartnerSlot && !partnerSlotFilled && roomKind === 'duo_match');
    const inviteOpen = (team: 'teamA' | 'teamB', index: 0 | 1) =>
        isOwnerViewer && onInviteEmptySlot ? () => onInviteEmptySlot(team, index) : undefined;
    const canDragAssign = Boolean(
        isOwnerViewer &&
            onCommitSeatAssignments &&
            roomKind !== 'ai_duel' &&
            roomKind !== 'friendly_2p' &&
            roomKind !== 'arena_ai' &&
            roomKind !== 'duo_match',
    );

    const gridA = useMemo(() => membersToTwoSlots(teamAMembers), [teamAMembers]);
    const gridB = useMemo(() => membersToTwoSlots(teamBMembers), [teamBMembers]);
    const slotsA = useMemo(() => membersToSlotIds(teamAMembers), [teamAMembers]);
    const slotsB = useMemo(() => membersToSlotIds(teamBMembers), [teamBMembers]);

    const handleDrop = useCallback(
        (destTeam: 'teamA' | 'teamB', destIndex: 0 | 1, draggedUserId: string) => {
            if (!onCommitSeatAssignments || !canDragAssign) return;
            const next = applyDropOnSlots(slotsA, slotsB, draggedUserId, destTeam, destIndex);
            void onCommitSeatAssignments(next.teamA, next.teamB);
        },
        [canDragAssign, onCommitSeatAssignments, slotsA, slotsB],
    );

    const arenaAiBotSeatPresentation = useMemo(() => resolveArenaAiBotSeat(arenaAiGameMode), [arenaAiGameMode]);
    const duoTeamBAiPresentations = useMemo(() => {
        const lobby =
            pairAiLobbyRoomId && pairAiLobbySettings
                ? { roomId: pairAiLobbyRoomId, settings: pairAiLobbySettings }
                : undefined;
        return [
            resolveDuoTeamBAiSlotPresentation(arenaAiGameMode, 0, lobby),
            resolveDuoTeamBAiSlotPresentation(arenaAiGameMode, 1, lobby),
        ] as const;
    }, [arenaAiGameMode, pairAiLobbyRoomId, pairAiLobbySettings]);

    const renderHumanSlot = (
        cell: GridCell,
        slotIdx: 0 | 1,
        team: 'teamA' | 'teamB',
        accent: 'ally' | 'enemy',
        opts: {
            emptyLabel: string;
            emptySub?: string;
            onOpen?: () => void;
            syntheticAiDisplay?: { displayName: string; portraitSrc: string; subLabel?: string };
        },
    ) => {
        const kickStripBtnClass = `min-w-0 flex-1 rounded-md font-extrabold transition ${
            compact ? 'py-0.5 text-[9px]' : 'py-1 text-[10px]'
        }`;
        /** 빈 슬롯도 착석 타일과 동일한 하단(강퇴·위임) 높이를 미리 확보 — 방장 뷰에서만 */
        const emptySeatKickReserveFooter =
            canOfferKick ? (
                <div className="flex w-full min-w-0 gap-0.5">
                    <div
                        className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                        aria-hidden
                    >
                        {t('room.kick')}
                    </div>
                    {onDelegateRoomOwnershipRequest ? (
                        <div
                            className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                            aria-hidden
                        >
                            {t('room.delegate')}
                        </div>
                    ) : null}
                </div>
            ) : undefined;
        if (!cell.userId && opts.syntheticAiDisplay) {
            const s = opts.syntheticAiDisplay;
            const syntheticUserId = `pair-lobby-ai-${team}-${slotIdx}`;
            return (
                <SeatTile
                    key={`${team}-arena-ai-${slotIdx}`}
                    tone="filled"
                    label={s.displayName}
                    userId={syntheticUserId}
                    userName={s.displayName}
                    subLabel={s.subLabel ?? t('room.kataAi')}
                    portraitSrc={s.portraitSrc}
                    accent={accent}
                    isRoomHost={false}
                    showReady
                    compact={compact}
                    lobbyChromeTone={seatChromeTone}
                    actionFooter={emptySeatKickReserveFooter}
                />
            );
        }
        if (cell.userId && cell.name) {
            const isHost = cell.userId === ownerId;
            const ready = Boolean(cell.ready);
            const uid = cell.userId;
            const displayName = cell.name;
            /** 착석 슬롯은 빈 슬롯용 emptySub(터치하여 초대 등)를 쓰지 않음 — 유저/펫만 표시 */
            const displaySubLabel = cell.subLabel?.trim() ? cell.subLabel : undefined;
            let profileClick: (() => void) | undefined;
            if (uid.startsWith('pet-ai-')) {
                if (uid === viewerPetAiId && onViewOwnerEquippedPetDetail) {
                    profileClick = () => onViewOwnerEquippedPetDetail();
                } else if (uid !== viewerPetAiId && onViewOtherSeatPetDetail) {
                    profileClick = () => onViewOtherSeatPetDetail(uid);
                }
            } else if (String(cell.kind).toLowerCase() === 'user' && onViewSeatUserProfile) {
                profileClick = () => onViewSeatUserProfile(uid);
            }
            const showKickButton =
                canOfferKick &&
                !isHost &&
                String(cell.kind).toLowerCase() === 'user' &&
                !uid.startsWith('pet-ai-');
            const showDelegateButton = Boolean(showKickButton && onDelegateRoomOwnershipRequest);
            const statusOverlayLabel = statusOverlayByUserId?.[uid];
            /** 방장일 때 강퇴·위임 줄 높이를 모든 착석 타일에 동일하게 잡아 패널 높이가 들쭉날쭉하지 않게 함 */
            const reserveKickStrip = canOfferKick;
            const kickFooter =
                reserveKickStrip && uid ? (
                    <div className="flex w-full min-w-0 gap-0.5">
                        {showKickButton ? (
                            <button
                                type="button"
                                disabled={kickUiDisabled}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onKickRoomMemberRequest?.(uid);
                                }}
                                className={`${kickStripBtnClass} border border-rose-400/55 bg-rose-950/70 text-rose-100 hover:border-rose-300/60 hover:bg-rose-900/55 disabled:pointer-events-none disabled:opacity-45`}
                            >
                                {t('room.kick')}
                            </button>
                        ) : (
                            <div
                                className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                                aria-hidden
                            >
                                {t('room.kick')}
                            </div>
                        )}
                        {onDelegateRoomOwnershipRequest ? (
                            showDelegateButton ? (
                                <button
                                    type="button"
                                    disabled={kickUiDisabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelegateRoomOwnershipRequest(uid);
                                    }}
                                    className={`${kickStripBtnClass} ${pairAggregateRoomSeatDelegateBtnToneClass(seatChromeTone)} disabled:pointer-events-none disabled:opacity-45`}
                                >
                                    {t('room.delegate')}
                                </button>
                            ) : (
                                <div
                                    className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                                    aria-hidden
                                >
                                    {t('room.delegate')}
                                </div>
                            )
                        ) : null}
                    </div>
                ) : undefined;
            return (
                <SeatTile
                    key={`${team}-${slotIdx}-${cell.userId}`}
                    tone="filled"
                    label={cell.userId === viewerId ? t('room.me') : displayName}
                    userId={cell.userId}
                    userName={displayName}
                    subLabel={displaySubLabel}
                    portraitSrc={cell.portraitSrc}
                    accent={accent}
                    isRoomHost={isHost}
                    showReady={ready}
                    draggable={canDragAssign && cell.kind === 'user'}
                    onDropUser={canDragAssign ? handleDrop : undefined}
                    dropTeam={team}
                    dropIndex={slotIdx}
                    isDropTarget={canDragAssign}
                    onProfileClick={profileClick}
                    compact={compact}
                    profileInline={Boolean(compact && cell.portraitSrc && uid.startsWith('pet-ai-'))}
                    actionFooter={kickFooter}
                    petLineLevel={cell.petLineLevel ?? undefined}
                    petLineName={cell.petLineName ?? undefined}
                    avatarUrl={cell.avatarUrl ?? undefined}
                    borderUrl={cell.borderUrl ?? undefined}
                    statusOverlayLabel={statusOverlayLabel}
                    lobbyChromeTone={seatChromeTone}
                />
            );
        }
        return (
            <SeatTile
                key={`${team}-empty-${slotIdx}`}
                tone="open"
                label={opts.emptyLabel}
                subLabel={opts.emptySub}
                accent={accent}
                onOpenClick={opts.onOpen}
                onDropUser={canDragAssign ? handleDrop : undefined}
                dropTeam={team}
                dropIndex={slotIdx}
                isDropTarget={canDragAssign}
                compact={compact}
                lobbyChromeTone={seatChromeTone}
                actionFooter={emptySeatKickReserveFooter}
            />
        );
    };

    const teamSeatCols: 1 | 2 = oneSlotPerTeam ? 1 : 2;

    /** 전략/놀이 AI방: 팀당 1칸이 아니라 방장 vs AI 두 칸(데이터상 AI 자리는 teamA 슬롯 1) */
    if (oneSlotPerTeam && roomKind === 'arena_ai') {
        const hostHomeTeam = pickOwnerHomeTeam(ownerId, teamAMembers, teamBMembers);
        const accentHuman = hostHomeTeam === 'teamA' ? 'ally' : 'enemy';
        const accentAi = hostHomeTeam === 'teamA' ? 'enemy' : 'ally';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentHuman, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamA', 0) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamA' ? 'enemy' : 'ally'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentAi, {
                            emptyLabel: 'AI',
                            emptySub: t('room.kataAi'),
                            onOpen: undefined,
                            syntheticAiDisplay: !gridA[1].userId ? arenaAiBotSeatPresentation : undefined,
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    if (isFriendly) {
        const hostHomeTeam = pickOwnerHomeTeam(ownerId, teamAMembers, teamBMembers);
        const accentA = hostHomeTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = hostHomeTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamA', 0) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamA', 1) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamA', 1),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamB', 0) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamB', 0),
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', accentB, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamB', 1) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamB', 1),
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    /** 놀이바둑 친선 등: 팀당 유저 1슬롯(화면 2칸), AI 플레이스홀더 없음 */
    if (oneSlotPerTeam && roomKind === 'duo_match' && !isFriendly) {
        const hostHomeTeam = pickOwnerHomeTeam(ownerId, teamAMembers, teamBMembers);
        const accentA = hostHomeTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = hostHomeTeam === 'teamB' ? 'ally' : 'enemy';
        /** `syncDuoMatchPairSeatAssignments` 등으로 상대 팀 유저가 `teamB` 페이로드에 없을 때 — 상대 열에 표시 */
        const humanMembers = [...(teamAMembers ?? []), ...(teamBMembers ?? [])].filter(
            (m) => String(m.kind).toLowerCase() === 'user' && !String(m.id).startsWith('pet-ai-'),
        );
        /** 같은 팀 열 멤버 전부를 아군으로 잡으면, 상대만 `teamA`에 있어도 아군으로 오인됨 → 주최·인간 파트너를 코어 아군으로 둠 */
        const coreAllyUserIds = new Set<string>([ownerId]);
        if (partnerId && !String(partnerId).startsWith('pet-ai-')) {
            coreAllyUserIds.add(partnerId);
        }
        const hostTeamMemberList = hostHomeTeam === 'teamA' ? teamAMembers : teamBMembers;
        const rosterHostTeamUserIds = new Set(
            (hostTeamMemberList ?? [])
                .filter((m) => String(m.kind).toLowerCase() === 'user' && !String(m.id).startsWith('pet-ai-'))
                .map((m) => m.id),
        );
        const allyUserIdsForOpponentPick = coreAllyUserIds.has(ownerId) ? coreAllyUserIds : rosterHostTeamUserIds;
        const firstOpponentMember = humanMembers.find((m) => !allyUserIdsForOpponentPick.has(m.id));
        const ownerGrid = hostHomeTeam === 'teamA' ? gridA : gridB;
        const otherGrid = hostHomeTeam === 'teamA' ? gridB : gridA;
        /** 인원이 한쪽 팀 배열에만 있어도(전략·놀이 `sync…`) 양 열에 주최·상대가 나뉘어 보이게 */
        let slotHostSide = preferCellForUserInPair(ownerGrid, ownerId);
        let slotOther =
            preferCellForOtherHumanInPair(otherGrid, ownerId) ?? preferCellForOtherHumanInPair(ownerGrid, ownerId);
        const emptyCell: GridCell = { userId: null, name: null, kind: 'empty', ready: false };
        if (!slotOther) {
            slotOther = emptyCell;
        }
        if (!slotOther.userId && firstOpponentMember) {
            slotOther = pairSeatMemberToGridCell(firstOpponentMember);
        }
        const slotA0 = hostHomeTeam === 'teamA' ? slotHostSide : slotOther;
        const slotB0 = hostHomeTeam === 'teamA' ? slotOther : slotHostSide;
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(slotA0, 0, 'teamA', accentA, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamA', 0) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(slotB0, 0, 'teamB', accentB, {
                            emptyLabel: t('room.opponent'),
                            emptySub: inviteOpen('teamB', 0) ? t('room.tapToInvite') : t('room.waitingShort'),
                            onOpen: inviteOpen('teamB', 0),
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    /**
     * 페어 경기장 2인 AI대전: 인간 팀 슬롯만(방장·파트너). 상대 AI 합성 열은 표시하지 않음.
     * (서버·로비 규칙상 인간은 `teamA` 두 칸 — 기존 좌측 열과 동일)
     */
    if (roomKind === 'duo_match' && !isFriendly && hideDuoAiOpponentColumn) {
        const hostHomeTeam = pickOwnerHomeTeam(ownerId, teamAMembers, teamBMembers);
        const accentA = hostHomeTeam === 'teamA' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel
                        title=""
                        subtitle=""
                        variant={hostHomeTeam === 'teamA' ? 'ally' : 'enemy'}
                        compact={compact}
                        seatColumns={2}
                    >
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamA', 0) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                            emptyLabel: t('partner'),
                            emptySub:
                                canClickPartnerSlot || inviteOpen('teamA', 1)
                                    ? t('room.tapToInvite')
                                    : partnerSlotFilled
                                      ? undefined
                                      : t('room.waitingShort'),
                            onOpen: canClickPartnerSlot ? onInvitePartnerSlot : inviteOpen('teamA', 1),
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    /**
     * 2인 페어(전략·놀이 등): 4칸(2×2) — 우리 팀 2슬롯 + 상대 팀 2슬롯.
     * AI 대전 시 상대는 `pair-opponent-ai` / `pair-opponent-pet`에 대응하는 봇 프로필을 미리 표시(대기 중 teamB 비어 있을 때).
     */
    if (roomKind === 'duo_match' && !isFriendly) {
        const hostHomeTeam = pickOwnerHomeTeam(ownerId, teamAMembers, teamBMembers);
        const accentA = hostHomeTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = hostHomeTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: inviteOpen('teamA', 0) ? t('room.tapToInvite') : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                            emptyLabel: t('partner'),
                            emptySub:
                                canClickPartnerSlot || inviteOpen('teamA', 1) ? t('room.tapToInvite') : partnerSlotFilled ? undefined : t('room.waitingShort'),
                            onOpen: canClickPartnerSlot ? onInvitePartnerSlot : inviteOpen('teamA', 1),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                            emptyLabel: 'AI',
                            emptySub: t('room.kataAi'),
                            onOpen: undefined,
                            syntheticAiDisplay: !gridB[0].userId ? duoTeamBAiPresentations[0] : undefined,
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', accentB, {
                            emptyLabel: 'AI',
                            emptySub: t('room.kataAi'),
                            onOpen: undefined,
                            syntheticAiDisplay: !gridB[1].userId ? duoTeamBAiPresentations[1] : undefined,
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    /** 펫 페어: 나·내 펫 + 상대 자리는 모드별 AI봇(대기 중) */
    if (isPetPairLobby) {
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel title="" subtitle="" variant="ally" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', 'ally', {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', 'ally', {
                            emptyLabel: t('room.petSlot'),
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant="enemy" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', 'enemy', {
                            emptyLabel: 'AI',
                            emptySub: t('room.kataAi'),
                            onOpen: undefined,
                            syntheticAiDisplay: !gridB[0].userId ? duoTeamBAiPresentations[0] : undefined,
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', 'enemy', {
                            emptyLabel: 'AI',
                            emptySub: t('room.kataAi'),
                            onOpen: undefined,
                            syntheticAiDisplay: !gridB[1].userId ? duoTeamBAiPresentations[1] : undefined,
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    if (isFriendlyTwoPet && gridB.every((cell) => !cell.userId)) {
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={teamsContainerClass}>
                    <TeamPanel title="" subtitle="" variant="ally" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', 'ally', {
                            emptyLabel: t('room.emptySlot'),
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', 'ally', {
                            emptyLabel: t('room.petSlot'),
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant="enemy" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', 'enemy', {
                            emptyLabel: t('room.opponent'),
                            emptySub: inviteOpen('teamB', 0) ? t('room.tapToInvite') : t('room.waitingShort'),
                            onOpen: inviteOpen('teamB', 0),
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', 'enemy', {
                            emptyLabel: t('room.opponentPet'),
                            emptySub: t('room.opponentEquippedPet'),
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    const hostHomeTeam = pickOwnerHomeTeam(ownerId, teamAMembers, teamBMembers);
    const accentA = hostHomeTeam === 'teamA' ? 'ally' : 'enemy';
    const accentB = hostHomeTeam === 'teamB' ? 'ally' : 'enemy';
    return (
        <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
            <div className={teamsContainerClass}>
                <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={teamSeatCols}>
                    {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                        emptyLabel: t('room.emptySlot'),
                        emptySub: inviteOpen('teamA', 0) ? t('room.tapToInvite') : undefined,
                        onOpen: inviteOpen('teamA', 0),
                    })}
                    {!oneSlotPerTeam
                        ? renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                              emptyLabel: roomKind === 'arena_ai' ? 'AI' : t('partner'),
                              emptySub:
                                  roomKind === 'arena_ai'
                                      ? t('room.kataAi')
                                      : canClickPartnerSlot || inviteOpen('teamA', 1)
                                        ? t('room.tapToInvite')
                                        : t('room.waitingShort'),
                              onOpen: roomKind === 'arena_ai' ? undefined : canClickPartnerSlot ? onInvitePartnerSlot : inviteOpen('teamA', 1),
                          })
                        : null}
                </TeamPanel>
                <TeamPanel title="" subtitle="" variant={hostHomeTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={teamSeatCols}>
                    {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                        emptyLabel: t('room.emptySlot'),
                        emptySub: inviteOpen('teamB', 0) ? t('room.tapToInvite') : undefined,
                        onOpen: inviteOpen('teamB', 0),
                    })}
                    {!oneSlotPerTeam
                        ? renderHumanSlot(gridB[1], 1, 'teamB', accentB, {
                              emptyLabel: t('room.emptySlot'),
                              emptySub: inviteOpen('teamB', 1) ? t('room.tapToInvite') : undefined,
                              onOpen: inviteOpen('teamB', 1),
                          })
                        : null}
                </TeamPanel>
            </div>
        </div>
    );
};

export default PairRoomSeatGrid;
