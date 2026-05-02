import React, { useCallback, useMemo } from 'react';
import Avatar from '../Avatar.js';

export type PairRoomKind = 'ai_duel' | 'duo_match' | 'friendly_4p';

type SeatTone = 'open' | 'filled' | 'locked';

export type PairSeatMember = {
    id: string;
    name: string;
    kind: string;
    ready?: boolean;
    subLabel?: string;
    portraitSrc?: string | null;
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
    dragForKick,
    dropTeam,
    dropIndex,
    onDropUser,
    isDropTarget,
    portraitSrc,
    onProfileClick,
    compact,
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
    /** 방장 강퇴 슬롯으로 끌기용(착석 배치와 무관, 예: 펫 페어) */
    dragForKick?: boolean;
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
    const tileH = compact ? 'h-[5.25rem] min-h-[5.25rem] px-1.5 py-1' : 'h-[7.5rem] min-h-[7.5rem] px-2 py-2';
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
            draggable={Boolean((draggable || dragForKick) && userId && tone === 'filled')}
            onDragStart={(e) => {
                if ((!draggable && !dragForKick) || !userId || tone !== 'filled') return;
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
            className={`relative flex ${tileH} flex-col items-center justify-center rounded-lg border text-center transition sm:rounded-xl ${baseBorder} ${baseBg} ${innerGlow} ${
                interactive ? 'cursor-pointer hover:border-cyan-300/55 hover:brightness-[1.03] active:scale-[0.99]' : ''
            } ${tone === 'filled' && onProfileClick ? 'cursor-pointer' : ''} ${droppable && isDropTarget ? 'ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-black/40' : ''} ${
                (draggable || dragForKick) && tone === 'filled' ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
        >
            {isRoomHost ? <HostHomeBadge compact={compact} /> : null}
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
                                <Avatar userId={userId} userName={userName} size={avSize} fixedFrameSize />
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
                    <span className={`mt-0.5 max-w-full truncate font-extrabold text-white ${compact ? 'text-[11px] leading-tight' : 'text-sm'}`}>
                        {userName || label}
                    </span>
                    {(subLabel || label) && (subLabel || label) !== (userName || label) ? (
                        <span
                            className={`max-w-full truncate font-bold uppercase tracking-wider text-emerald-200/65 ${compact ? 'text-[8px] leading-tight' : 'text-[10px]'}`}
                        >
                            {subLabel || label}
                        </span>
                    ) : null}
                </>
            )}
        </div>
    );
}

function TeamPanel({
    title,
    subtitle,
    variant,
    children,
    compact,
}: {
    title: string;
    subtitle: string;
    variant: 'ally' | 'enemy';
    children: React.ReactNode;
    compact?: boolean;
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
            <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>{children}</div>
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
};

function membersToTwoSlots(members: PairSeatMember[] | undefined): [GridCell, GridCell] {
    const users = (members || []).filter((m) => m.kind === 'user' || m.kind === 'pet');
    const c0: GridCell = users[0]
        ? { userId: users[0].id, name: users[0].name, kind: users[0].kind, ready: users[0].ready, subLabel: users[0].subLabel, portraitSrc: users[0].portraitSrc }
        : { userId: null, name: null, kind: 'empty', ready: false };
    const c1: GridCell = users[1]
        ? { userId: users[1].id, name: users[1].name, kind: users[1].kind, ready: users[1].ready, subLabel: users[1].subLabel, portraitSrc: users[1].portraitSrc }
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
    /** 방장이 다른 유저 착석 타일을 강퇴 슬롯으로 드래그할 수 있게 함 */
    enableOwnerKickSeatDrag?: boolean;
    /** 모바일 페어 대기실: 슬롯·프로필 축소 */
    compact?: boolean;
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
    enableOwnerKickSeatDrag = false,
    compact = false,
}) => {
    const petAiId = `pet-ai-${ownerId}`;
    const viewerPetAiId = `pet-ai-${viewerId}`;
    const isAiRoom = roomKind === 'ai_duel';
    const isFriendly = roomKind === 'friendly_4p';

    const ownerLabel = viewerId === ownerId ? '방장 (나)' : '방장';
    const partnerSlotFilled = Boolean(partnerId && !String(partnerId).startsWith('pet-ai-'));
    const partnerDisplayId = partnerSlotFilled ? partnerId : undefined;
    const partnerDisplayName = partnerSlotFilled ? partnerName || '파트너' : undefined;
    const isOwnerViewer = viewerId === ownerId;
    const canClickPartnerSlot = Boolean(isOwnerViewer && onInvitePartnerSlot && !partnerSlotFilled && roomKind === 'duo_match');
    const inviteOpen = (team: 'teamA' | 'teamB', index: 0 | 1) =>
        isOwnerViewer && onInviteEmptySlot ? () => onInviteEmptySlot(team, index) : undefined;
    const canDragAssign = Boolean(isOwnerViewer && onCommitSeatAssignments && roomKind !== 'ai_duel');

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

    const renderHumanSlot = (
        cell: GridCell,
        slotIdx: 0 | 1,
        team: 'teamA' | 'teamB',
        accent: 'ally' | 'enemy',
        opts: { emptyLabel: string; emptySub?: string; onOpen?: () => void },
    ) => {
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
                    dragForKick={
                        Boolean(
                            enableOwnerKickSeatDrag &&
                                !isHost &&
                                String(cell.kind).toLowerCase() === 'user' &&
                                !uid.startsWith('pet-ai-'),
                        )
                    }
                    onDropUser={canDragAssign ? handleDrop : undefined}
                    dropTeam={team}
                    dropIndex={slotIdx}
                    isDropTarget={canDragAssign}
                    onProfileClick={profileClick}
                    compact={compact}
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
            />
        );
    };

    if (isFriendly) {
        const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
        const accentA = allyTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = allyTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={compact ? 'flex flex-col gap-2 sm:flex-row sm:gap-3' : 'flex flex-col gap-3 sm:flex-row sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact}>
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
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact}>
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

    if (isAiRoom && gridB.every((cell) => !cell.userId)) {
        return (
            <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
                <div className={compact ? 'flex flex-col gap-2 sm:flex-row sm:gap-3' : 'flex flex-col gap-3 sm:flex-row sm:gap-4'}>
                    <TeamPanel title="" subtitle="" variant="ally" compact={compact}>
                        <SeatTile
                            tone="filled"
                            label="나"
                            userId={ownerId}
                            userName={ownerName}
                            accent="ally"
                            isRoomHost
                            showReady={ownerReady}
                            onProfileClick={onViewSeatUserProfile ? () => onViewSeatUserProfile(ownerId) : undefined}
                            compact={compact}
                        />
                        <SeatTile
                            tone="filled"
                            label="내 펫"
                            userId={petAiId}
                            userName={
                                viewerEquippedPairPetLevel
                                    ? `Lv.${viewerEquippedPairPetLevel} ${viewerEquippedPairPetName || partnerName || '내 펫'}`
                                    : viewerEquippedPairPetName || partnerName || '내 펫'
                            }
                            subLabel="장착 펫"
                            portraitSrc={viewerEquippedPairPetPortraitSrc ?? undefined}
                            accent="ally"
                            showReady={partnerReady}
                            onProfileClick={
                                isOwnerViewer && onViewOwnerEquippedPetDetail
                                    ? () => onViewOwnerEquippedPetDetail()
                                    : undefined
                            }
                            compact={compact}
                        />
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant="enemy" compact={compact}>
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
            <div className={compact ? 'flex flex-col gap-2 sm:flex-row sm:gap-3' : 'flex flex-col gap-3 sm:flex-row sm:gap-4'}>
                <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'} compact={compact}>
                    {renderHumanSlot(gridA[0], 0, 'teamA', accentA, {
                        emptyLabel: '빈 슬롯',
                        emptySub: inviteOpen('teamA', 0) ? '터치하여 초대' : undefined,
                        onOpen: inviteOpen('teamA', 0),
                    })}
                    {renderHumanSlot(gridA[1], 1, 'teamA', accentA, {
                        emptyLabel: '파트너',
                        emptySub: canClickPartnerSlot || inviteOpen('teamA', 1) ? '터치하여 초대' : '대기 중',
                        onOpen: canClickPartnerSlot ? onInvitePartnerSlot : inviteOpen('teamA', 1),
                    })}
                </TeamPanel>
                <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'} compact={compact}>
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
};

export default PairRoomSeatGrid;
