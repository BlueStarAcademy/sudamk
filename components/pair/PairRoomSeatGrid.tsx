import React, { useCallback, useMemo } from 'react';
import Avatar from '../Avatar.js';
import { GameMode, type GameSettings } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import {
    deterministicPairAiOpponentPetDisplayLevelFromSeed,
    resolveAiLobbyProfileStepFromSettings,
} from '../../shared/utils/strategicAiDifficulty.js';

export type PairRoomKind = 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai';

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
            title="방장"
            aria-label="방장"
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
            aria-label="준비 완료"
        >
            준비완료
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
}) {
    const locked = tone === 'locked';
    const open = tone === 'open';
    const ally = accent === 'ally';
    const enemy = accent === 'enemy';

    const baseBorder = locked
        ? 'border-zinc-600/40'
        : enemy
          ? 'border-rose-500/25'
          : ally
            ? open
              ? 'border-cyan-400/45'
              : 'border-emerald-400/45'
            : 'border-violet-400/35';

    const baseBg = locked
        ? 'bg-gradient-to-b from-zinc-950/95 to-black'
        : enemy
          ? 'bg-gradient-to-b from-rose-950/50 via-zinc-950/80 to-black'
          : ally
            ? open
              ? 'bg-gradient-to-b from-cyan-950/35 via-slate-950/60 to-black/90'
              : 'bg-gradient-to-b from-emerald-950/45 via-slate-950/70 to-black/90'
            : 'bg-gradient-to-b from-violet-950/40 to-black';

    const innerGlow =
        !locked && ally
            ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : enemy
              ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
              : '';

    const interactive = open && typeof onOpenClick === 'function';
    const droppable = typeof onDropUser === 'function' && dropTeam !== undefined && dropIndex !== undefined;
    const tileH = actionFooter
        ? compact
            ? 'min-h-[6.75rem] px-1.5 py-1'
            : 'min-h-[9.25rem] px-2 py-2'
        : compact
          ? 'h-[5.25rem] min-h-[5.25rem] px-1.5 py-1'
          : 'h-[7.5rem] min-h-[7.5rem] px-2 py-2';
    const avSize = compact ? 32 : 40;
    const filledInline = Boolean(profileInline && tone === 'filled');
    /** 펫 슬롯: 레벨(있으면)·이름(한 줄, 폭에 따라 폰트 축소, 줄임표 없음) */
    const usePetNameLines = Boolean(petLineName);

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
            className={`relative flex ${tileH} flex-col rounded-lg border transition sm:rounded-xl ${baseBorder} ${baseBg} ${innerGlow} ${
                interactive ? 'cursor-pointer hover:border-cyan-300/55 hover:brightness-[1.03] active:scale-[0.99]' : ''
            } ${tone === 'filled' && onProfileClick ? 'cursor-pointer' : ''} ${droppable && isDropTarget ? 'ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-black/40' : ''} ${
                draggable && tone === 'filled' ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
        >
            {isRoomHost ? <HostHomeBadge compact={compact} /> : null}
            <div
                className={
                    filledInline
                        ? 'flex min-h-0 w-full flex-1 flex-row items-center gap-1 text-left'
                        : 'flex min-h-0 w-full flex-1 flex-col items-center justify-center text-center'
                }
            >
            {locked ? (
                <>
                    <span className={`${compact ? 'text-sm' : 'text-base'} opacity-50`} aria-hidden>
                        ◆
                    </span>
                    <span className={`mt-0.5 font-bold uppercase tracking-[0.2em] text-zinc-600 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>대기</span>
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
                                title="정보 보기"
                                aria-label="정보 보기"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onProfileClick();
                                }}
                            />
                        ) : null}
                        {showReady ? <ReadyRibbonOnAvatar compact={compact} /> : null}
                    </div>
                    <div className="@container flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 pr-0.5">
                        {usePetNameLines ? (
                            <>
                                {petLineLevel ? (
                                    <span
                                        className={`w-full whitespace-nowrap font-extrabold leading-none text-violet-200/95 ${compact ? 'text-[9px]' : 'text-[11px]'}`}
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
                                title="정보 보기"
                                aria-label="정보 보기"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onProfileClick();
                                }}
                            />
                        ) : null}
                        {showReady ? <ReadyRibbonOnAvatar compact={compact} /> : null}
                    </div>
                    {usePetNameLines ? (
                        <div
                            className={`@container mt-0.5 flex min-w-0 max-w-full flex-col items-center gap-0.5 px-0.5 ${compact ? 'text-[11px]' : 'text-sm'}`}
                        >
                            {petLineLevel ? (
                                <span className={`whitespace-nowrap font-extrabold leading-none text-violet-200/95 ${compact ? 'text-[9px]' : 'text-xs'}`}>
                                    {petLineLevel}
                                </span>
                            ) : null}
                            <span
                                className={`block min-w-0 max-w-full whitespace-nowrap text-center font-extrabold leading-none text-white ${
                                    compact ? '[font-size:clamp(5.5px,9.5cqw,0.75rem)]' : '[font-size:clamp(6px,10.5cqw,0.875rem)]'
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
                            className={`max-w-full truncate font-bold uppercase tracking-wider text-emerald-200/65 ${compact ? 'text-[8px] leading-tight' : 'text-[10px]'}`}
                        >
                            {subLabel}
                        </span>
                    ) : (subLabel || label) && (subLabel || label) !== (userName || label) && !usePetNameLines ? (
                        <span
                            className={`max-w-full truncate font-bold uppercase tracking-wider text-emerald-200/65 ${compact ? 'text-[8px] leading-tight' : 'text-[10px]'}`}
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
            <div className={`grid ${seatColumns === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${compact ? 'gap-1.5' : 'gap-2'}`}>
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

/** 서버 teamA/teamB와 무관하게, 보는 사람 기준으로 아군 팀 열을 고릅니다(내 id 또는 pet-ai-나). */
function pickViewerAllyTeam(
    viewerId: string,
    teamAMembers: PairSeatMember[] | undefined,
    teamBMembers: PairSeatMember[] | undefined,
): 'teamA' | 'teamB' {
    const isMine = (m: PairSeatMember) => m.id === viewerId || m.id === `pet-ai-${viewerId}`;
    if ((teamAMembers ?? []).some(isMine)) return 'teamA';
    if ((teamBMembers ?? []).some(isMine)) return 'teamB';
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
        displayName: `${def.name}봇`,
        portraitSrc: def.image,
        subLabel: '카타 AI',
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
            displayName: `${levelPrefix}${def.name}봇`,
            portraitSrc: def.image,
            subLabel: '카타 AI',
        };
    }
    return {
        displayName: `${levelPrefix}${def.name} 펫봇`,
        portraitSrc: def.image,
        subLabel: '카타 AI',
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
    /** 전략/놀이 1:1 등 팀당 착석 슬롯 1개만 표시(화면에 슬롯 2개) */
    oneSlotPerTeam?: boolean;
    /** `arena_ai`·펫 페어 AI 상대 슬롯 — 선택 모드 기준 봇 표시 */
    arenaAiGameMode?: GameMode;
    /** duo/펫 AI 대전 로비: 방·설정으로 합성 상대 두 슬롯 표시 레벨(게임 시작 전 결정론적) */
    pairAiLobbyRoomId?: string;
    pairAiLobbySettings?: GameSettings;
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
    oneSlotPerTeam = false,
    arenaAiGameMode,
    pairAiLobbyRoomId,
    pairAiLobbySettings,
}) => {
    const viewerPetAiId = `pet-ai-${viewerId}`;
    const isPetPairLobby = roomKind === 'ai_duel';
    const isFriendlyTwoPet = roomKind === 'friendly_2p';
    const isFriendly = roomKind === 'friendly_4p';

    const ownerLabel = viewerId === ownerId ? '방장 (나)' : '방장';
    const partnerSlotFilled = Boolean(partnerId && !String(partnerId).startsWith('pet-ai-'));
    const partnerDisplayId = partnerSlotFilled ? partnerId : undefined;
    const partnerDisplayName = partnerSlotFilled ? partnerName || '파트너' : undefined;
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
                        강퇴
                    </div>
                    {onDelegateRoomOwnershipRequest ? (
                        <div
                            className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                            aria-hidden
                        >
                            위임
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
                    subLabel={s.subLabel ?? '카타 AI'}
                    portraitSrc={s.portraitSrc}
                    accent={accent}
                    isRoomHost={false}
                    showReady
                    compact={compact}
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
                                강퇴
                            </button>
                        ) : (
                            <div
                                className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                                aria-hidden
                            >
                                강퇴
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
                                    className={`${kickStripBtnClass} border border-violet-400/55 bg-violet-950/70 text-violet-100 hover:border-violet-300/60 hover:bg-violet-900/55 disabled:pointer-events-none disabled:opacity-45`}
                                >
                                    위임
                                </button>
                            ) : (
                                <div
                                    className={`${kickStripBtnClass} pointer-events-none invisible border border-transparent bg-transparent text-transparent`}
                                    aria-hidden
                                >
                                    위임
                                </div>
                            )
                        ) : null}
                    </div>
                ) : undefined;
            return (
                <SeatTile
                    key={`${team}-${slotIdx}-${cell.userId}`}
                    tone="filled"
                    label={cell.userId === viewerId ? '나' : displayName}
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
                actionFooter={emptySeatKickReserveFooter}
            />
        );
    };

    const teamSeatCols: 1 | 2 = oneSlotPerTeam ? 1 : 2;

    /** 전략/놀이 AI방: 팀당 1칸이 아니라 방장 vs AI 두 칸(데이터상 AI 자리는 teamA 슬롯 1) */
    if (oneSlotPerTeam && roomKind === 'arena_ai') {
        const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
        const accentHuman = allyTeam === 'teamA' ? 'ally' : 'enemy';
        const accentAi = allyTeam === 'teamA' ? 'enemy' : 'ally';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentHuman, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamA', 0) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'enemy' : 'ally'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentAi, {
                            emptyLabel: 'AI',
                            emptySub: '카타 AI',
                            onOpen: undefined,
                            syntheticAiDisplay: !gridA[1].userId ? arenaAiBotSeatPresentation : undefined,
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    if (isFriendly) {
        const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
        const accentA = allyTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = allyTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamA', 0) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamA', 1) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamA', 1),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamB', 0) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamB', 0),
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', accentB, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamB', 1) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamB', 1),
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    /** 놀이바둑 친선 등: 팀당 유저 1슬롯(화면 2칸), AI 플레이스홀더 없음 */
    if (oneSlotPerTeam && roomKind === 'duo_match' && !isFriendly) {
        const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
        const accentA = allyTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = allyTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamA', 0) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={1}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                            emptyLabel: '상대',
                            emptySub: inviteOpen('teamB', 0) ? '터치하여 초대' : '대기 중',
                            onOpen: inviteOpen('teamB', 0),
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    /**
     * 2인 페어: 4칸(2×2) — 우리 팀 2슬롯 + 상대 팀 2슬롯.
     * AI 대전 시 상대는 `pair-opponent-ai` / `pair-opponent-pet`에 대응하는 봇 프로필을 미리 표시(대기 중 teamB 비어 있을 때).
     */
    if (roomKind === 'duo_match' && !isFriendly) {
        const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
        const accentA = allyTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = allyTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                            emptyLabel: '빈 슬롯',
                            emptySub: inviteOpen('teamA', 0) ? '터치하여 초대' : undefined,
                            onOpen: inviteOpen('teamA', 0),
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                            emptyLabel: '파트너',
                            emptySub:
                                canClickPartnerSlot || inviteOpen('teamA', 1) ? '터치하여 초대' : partnerSlotFilled ? undefined : '대기 중',
                            onOpen: canClickPartnerSlot ? onInvitePartnerSlot : inviteOpen('teamA', 1),
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                            emptyLabel: 'AI',
                            emptySub: '카타 AI',
                            onOpen: undefined,
                            syntheticAiDisplay: !gridB[0].userId ? duoTeamBAiPresentations[0] : undefined,
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', accentB, {
                            emptyLabel: 'AI',
                            emptySub: '카타 AI',
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
                <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant="ally" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', 'ally', {
                            emptyLabel: '방장',
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', 'ally', {
                            emptyLabel: '펫 슬롯',
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant="enemy" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', 'enemy', {
                            emptyLabel: 'AI',
                            emptySub: '카타 AI',
                            onOpen: undefined,
                            syntheticAiDisplay: !gridB[0].userId ? duoTeamBAiPresentations[0] : undefined,
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', 'enemy', {
                            emptyLabel: 'AI',
                            emptySub: '카타 AI',
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
                <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant="ally" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridA[0], 0, 'teamA', 'ally', {
                            emptyLabel: '방장',
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                        {renderHumanSlot(gridA[1], 1, 'teamA', 'ally', {
                            emptyLabel: '펫 슬롯',
                            emptySub: undefined,
                            onOpen: undefined,
                        })}
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant="enemy" compact={compact} seatColumns={2}>
                        {renderHumanSlot(gridB[0], 0, 'teamB', 'enemy', {
                            emptyLabel: '상대',
                            emptySub: inviteOpen('teamB', 0) ? '터치하여 초대' : '대기 중',
                            onOpen: inviteOpen('teamB', 0),
                        })}
                        {renderHumanSlot(gridB[1], 1, 'teamB', 'enemy', {
                            emptyLabel: '상대 펫',
                            emptySub: '상대 장착 펫',
                        })}
                    </TeamPanel>
                </div>
            </div>
        );
    }

    const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
    const accentA = allyTeam === 'teamA' ? 'ally' : 'enemy';
    const accentB = allyTeam === 'teamB' ? 'ally' : 'enemy';
    return (
        <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
            <div className={compact ? 'flex w-full min-w-0 flex-row gap-2 sm:gap-3' : 'flex w-full min-w-0 flex-row gap-3 sm:gap-4'}>
                <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact} seatColumns={teamSeatCols}>
                    {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                        emptyLabel: '빈 슬롯',
                        emptySub: inviteOpen('teamA', 0) ? '터치하여 초대' : undefined,
                        onOpen: inviteOpen('teamA', 0),
                    })}
                    {!oneSlotPerTeam
                        ? renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                              emptyLabel: roomKind === 'arena_ai' ? 'AI' : '파트너',
                              emptySub:
                                  roomKind === 'arena_ai'
                                      ? '카타 AI'
                                      : canClickPartnerSlot || inviteOpen('teamA', 1)
                                        ? '터치하여 초대'
                                        : '대기 중',
                              onOpen: roomKind === 'arena_ai' ? undefined : canClickPartnerSlot ? onInvitePartnerSlot : inviteOpen('teamA', 1),
                          })
                        : null}
                </TeamPanel>
                <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact} seatColumns={teamSeatCols}>
                    {renderHumanSlot(gridB[0], 0, 'teamB', accentB, {
                        emptyLabel: '빈 슬롯',
                        emptySub: inviteOpen('teamB', 0) ? '터치하여 초대' : undefined,
                        onOpen: inviteOpen('teamB', 0),
                    })}
                    {!oneSlotPerTeam
                        ? renderHumanSlot(gridB[1], 1, 'teamB', accentB, {
                              emptyLabel: '빈 슬롯',
                              emptySub: inviteOpen('teamB', 1) ? '터치하여 초대' : undefined,
                              onOpen: inviteOpen('teamB', 1),
                          })
                        : null}
                </TeamPanel>
            </div>
        </div>
    );
};

export default PairRoomSeatGrid;
