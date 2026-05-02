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

function HostHomeBadge() {
    return (
        <span
            className="pointer-events-none absolute right-1 top-1 z-[2] flex h-5 w-5 items-center justify-center rounded-md border border-amber-400/50 bg-amber-950/90 shadow-[0_0_8px_rgba(251,191,36,0.25)]"
            title="방장"
            aria-label="방장"
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-200" aria-hidden>
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

function ReadyRibbonOnAvatar() {
    return (
        <span
            className="pointer-events-none absolute left-1/2 top-0 z-[6] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-emerald-400/65 bg-emerald-950/95 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-emerald-100 shadow-[0_2px_10px_rgba(0,0,0,0.5),0_0_12px_rgba(16,185,129,0.25)]"
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
            className={`relative flex h-[7.5rem] min-h-[7.5rem] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition ${baseBorder} ${baseBg} ${innerGlow} ${
                interactive ? 'cursor-pointer hover:border-cyan-300/55 hover:brightness-[1.03] active:scale-[0.99]' : ''
            } ${tone === 'filled' && onProfileClick ? 'cursor-pointer' : ''} ${droppable && isDropTarget ? 'ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-black/40' : ''} ${
                draggable && tone === 'filled' ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
        >
            {isRoomHost ? <HostHomeBadge /> : null}
            {locked ? (
                <>
                    <span className="text-base opacity-50" aria-hidden>
                        ◆
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">대기</span>
                </>
            ) : open ? (
                <>
                    <span className={`text-2xl font-extralight ${ally ? 'text-cyan-200/55' : 'text-rose-200/40'}`}>+</span>
                    <span className={`mt-1 text-xs font-bold ${ally ? 'text-cyan-100' : 'text-rose-100/90'}`}>{label}</span>
                    {subLabel ? <span className="mt-0.5 text-[10px] font-semibold text-slate-400">{subLabel}</span> : null}
                </>
            ) : (
                <>
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible">
                        {userId && userName ? (
                            portraitSrc ? (
                                <img
                                    src={portraitSrc}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-full border border-white/20 bg-black/50 object-contain shadow-inner"
                                    loading="lazy"
                                />
                            ) : (
                                <Avatar userId={userId} userName={userName} size={40} fixedFrameSize />
                            )
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-xs font-bold text-slate-300">
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
                        {showReady ? <ReadyRibbonOnAvatar /> : null}
                    </div>
                    <span className="mt-1 max-w-full truncate text-sm font-extrabold text-white">{userName || label}</span>
                    {(subLabel || label) && (subLabel || label) !== (userName || label) ? (
                        <span className="max-w-full truncate text-[10px] font-bold uppercase tracking-wider text-emerald-200/65">
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
}: {
    title: string;
    subtitle: string;
    variant: 'ally' | 'enemy';
    children: React.ReactNode;
}) {
    const ally = variant === 'ally';
    return (
        <div
            className={`relative flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border p-2.5 sm:p-3 ${
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
                        <div className={`text-[11px] font-extrabold uppercase tracking-[0.28em] ${ally ? 'text-cyan-200/90' : 'text-rose-200/80'}`}>{title}</div>
                    ) : null}
                    {subtitle.trim() ? (
                        <div className={`${title.trim() ? 'mt-0.5' : ''} text-[10px] font-semibold text-slate-500`}>{subtitle}</div>
                    ) : null}
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">{children}</div>
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
    /** 펫 페어 장착 펫 상세 — 방장 본인이 내 펫 슬롯 클릭 시 */
    onViewOwnerEquippedPetDetail?: () => void;
    onInvitePartnerSlot?: () => void;
    onInviteEmptySlot?: (team: 'teamA' | 'teamB', index: 0 | 1) => void;
    onCommitSeatAssignments?: (teamA: string[], teamB: string[]) => void | Promise<void>;
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
    onInvitePartnerSlot,
    onInviteEmptySlot,
    onCommitSeatAssignments,
}) => {
    const petAiId = `pet-ai-${ownerId}`;
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
            const displaySubLabel = cell.subLabel || opts.emptySub || opts.emptyLabel;
            let profileClick: (() => void) | undefined;
            if (uid.startsWith('pet-ai-')) {
                if (isOwnerViewer && uid === petAiId && onViewOwnerEquippedPetDetail) {
                    profileClick = () => onViewOwnerEquippedPetDetail();
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
                    onDropUser={canDragAssign ? handleDrop : undefined}
                    dropTeam={team}
                    dropIndex={slotIdx}
                    isDropTarget={canDragAssign}
                    onProfileClick={profileClick}
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
            />
        );
    };

    if (isFriendly) {
        const allyTeam = pickViewerAllyTeam(viewerId, teamAMembers, teamBMembers);
        const accentA = allyTeam === 'teamA' ? 'ally' : 'enemy';
        const accentB = allyTeam === 'teamB' ? 'ally' : 'enemy';
        return (
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'}>
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
                    <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'}>
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
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <TeamPanel title="" subtitle="" variant="ally">
                        <SeatTile
                            tone="filled"
                            label="나"
                            userId={ownerId}
                            userName={ownerName}
                            accent="ally"
                            isRoomHost
                            showReady={ownerReady}
                            onProfileClick={onViewSeatUserProfile ? () => onViewSeatUserProfile(ownerId) : undefined}
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
                            portraitSrc={isOwnerViewer ? viewerEquippedPairPetPortraitSrc : undefined}
                            accent="ally"
                            showReady={partnerReady}
                            onProfileClick={
                                isOwnerViewer && onViewOwnerEquippedPetDetail
                                    ? () => onViewOwnerEquippedPetDetail()
                                    : undefined
                            }
                        />
                    </TeamPanel>
                    <TeamPanel title="" subtitle="" variant="enemy">
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
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <TeamPanel title="" subtitle="" variant={allyTeam === 'teamA' ? 'ally' : 'enemy'}>
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
                <TeamPanel title="" subtitle="" variant={allyTeam === 'teamB' ? 'ally' : 'enemy'}>
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
