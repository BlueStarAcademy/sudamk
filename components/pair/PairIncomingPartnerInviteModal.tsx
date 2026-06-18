import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.js';
import type { PairRoomState } from '../../types/api.js';
import {
    buildPairRoomLobbyGameSettingRows,
    pairLobbyGameModeIconAndName,
} from '../../shared/utils/pairLobbyGameSettingRows.js';
import { pairInviteDisplayRoomKind, pairInviteRoomKindLabel } from '../../shared/utils/pairLobbyInviteRoomDisplay.js';
import {
    pairAggregateRoomInteriorDetailColumnHeaderClass,
    pairAggregateRoomInteriorDetailColumnOuterClass,
    pairAggregateRoomInteriorGameModeColumnClass,
    pairAggregateRoomInteriorGameModeColumnHeaderClass,
    pairAggregateRoomInteriorGameModeIconDropShadowClass,
    pairAggregateRoomInteriorGameModeNameBoxClass,
    pairAggregateRoomInteriorGameSettingsHeadingRowClass,
    pairAggregateRoomInteriorGameSettingsOuterClass,
    pairAggregateRoomInteriorTitleTextClass,
    pairAggregateRoomInteriorVisibilityPrivateClass,
    waitingLobbyToneFromPairChannel,
} from '../waiting-room/waitingLobbyHomePanelStyles.js';

export type PairIncomingInvitePayload = {
    id: string;
    /** 수락 후 해당 경기장 해시로 이동할 때 사용 */
    roomId: string;
    roomTitle: string;
    roomCode: string;
    inviterName: string;
    createdAt: number;
};

const INVITE_TTL_MS = 30_000;
const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

type Props = {
    invite: PairIncomingInvitePayload;
    /** `pairRooms[roomId]` — 있으면 방 내부 상단과 동일한 대국 설정 요약 */
    room?: PairRoomState | null;
    isBusy: boolean;
    onAccept: () => void | Promise<void>;
    onDecline: () => void | Promise<void>;
};

const shellToneClass: Record<'strategic' | 'playful' | 'pair', string> = {
    strategic: 'border-cyan-400/45 ring-cyan-500/15',
    playful: 'border-amber-400/45 ring-amber-500/15',
    pair: 'border-violet-400/45 ring-violet-500/15',
};

/** `ArenaLobbyNavTitleBar`의 `arenaTitle`과 동일 */
const inviteModalArenaTitleKey: Record<'strategic' | 'playful' | 'pair', 'invite.arenaInviteStrategic' | 'invite.arenaInvitePlayful' | 'invite.arenaInvitePair'> = {
    strategic: 'invite.arenaInviteStrategic',
    playful: 'invite.arenaInvitePlayful',
    pair: 'invite.arenaInvitePair',
};

const inviteModalTitleHeadingClass: Record<'strategic' | 'playful' | 'pair', string> = {
    strategic: 'bg-gradient-to-r from-cyan-100 to-cyan-200 bg-clip-text text-transparent',
    playful: 'text-amber-50',
    pair: 'bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent',
};

const PairIncomingPartnerInviteModal: React.FC<Props> = ({ invite, room, isBusy, onAccept, onDecline }) => {
    const { t } = useTranslation('pair');
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 200);
        return () => window.clearInterval(id);
    }, []);

    const msLeft = invite.createdAt + INVITE_TTL_MS - now;
    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    const expired = msLeft <= 0;
    const progress = Math.max(0, Math.min(1, msLeft / INVITE_TTL_MS));
    const ringOffset = RING_C * (1 - progress);

    const lobbyChannel = (room?.lobbyChannel ?? 'pair') as 'pair' | 'strategic' | 'playful';
    const lobbyTone = waitingLobbyToneFromPairChannel(lobbyChannel);
    const handheld = true;

    const displayRoom = useMemo(() => {
        if (!room) {
            return {
                title: invite.roomTitle,
                code: invite.roomCode,
                lobbyChannel,
            } as Partial<PairRoomState> & { title: string; code: string; lobbyChannel: typeof lobbyChannel };
        }
        return {
            ...room,
            title: room.title || invite.roomTitle,
            code: room.code || invite.roomCode,
        };
    }, [room, invite.roomTitle, invite.roomCode, lobbyChannel]);

    const displayKind = pairInviteDisplayRoomKind(displayRoom, lobbyChannel);
    const kindLabel = pairInviteRoomKindLabel(displayKind, lobbyChannel);

    const settingRows = useMemo(() => {
        if (!room?.selectedGameMode) return [] as { label: string; value: string }[];
        return buildPairRoomLobbyGameSettingRows(room, { lobbyChannelFallback: lobbyChannel });
    }, [room, lobbyChannel]);

    const modeVisual = room?.selectedGameMode ? pairLobbyGameModeIconAndName(room.selectedGameMode) : null;

    const visibilityLabel =
        room?.visibility === 'private'
            ? t('invite.visibilityPrivate')
            : room?.visibility === 'public'
              ? t('invite.visibilityPublic')
              : null;
    const visibilityExtra = room?.passwordProtected ? t('invite.passwordSuffix') : '';

    const modalHeadingText = `${t(inviteModalArenaTitleKey[lobbyChannel])}${t('invite.arenaInviteSuffix')}`;

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={() => {
                if (!isBusy && !expired) void onDecline();
            }}
        >
            <div
                className={`flex h-[min(640px,92vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-2xl ring-1 ${shellToneClass[lobbyChannel]}`}
                role="dialog"
                aria-modal
                aria-labelledby="pair-incoming-invite-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 border-b border-white/10 px-5 py-4 text-center">
                    <h2
                        id="pair-incoming-invite-title"
                        className={`text-lg font-extrabold tracking-tight ${inviteModalTitleHeadingClass[lobbyChannel]}`}
                    >
                        {modalHeadingText}
                    </h2>
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('invite.inviterLabel')}</p>
                        <p className="mt-0.5 truncate text-base font-extrabold text-cyan-100" title={invite.inviterName}>
                            {invite.inviterName}
                        </p>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3">
                    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                            <span className="shrink-0 font-mono text-xs font-extrabold tabular-nums text-amber-200/95 drop-shadow-[0_0_8px_rgba(251,191,36,0.15)]">
                                #{displayRoom.code}
                            </span>
                            <span
                                className={`min-w-0 flex-1 truncate text-left text-xs font-bold ${pairAggregateRoomInteriorTitleTextClass(lobbyTone)}`}
                                title={displayRoom.title}
                            >
                                {displayRoom.title}
                            </span>
                            <span className="shrink-0 whitespace-nowrap rounded-md border border-sky-400/45 bg-sky-950/50 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-100">
                                {kindLabel || t('invite.roomKindChecking')}
                            </span>
                            {visibilityLabel ? (
                                <span
                                    className={
                                        room?.visibility === 'private'
                                            ? pairAggregateRoomInteriorVisibilityPrivateClass(lobbyTone, handheld)
                                            : `shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold border-emerald-400/40 bg-emerald-950/45 text-emerald-100`
                                    }
                                >
                                    {visibilityLabel}
                                    {visibilityExtra}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className={pairAggregateRoomInteriorGameSettingsOuterClass(lobbyTone, handheld)}>
                        <div className={pairAggregateRoomInteriorGameSettingsHeadingRowClass(lobbyTone, handheld)}>{t('rankedMatch.gameSettings')}</div>
                        {!room?.selectedGameMode ? (
                            <p className="mt-2 px-2 text-center text-xs text-slate-400">{t('invite.roomLoading')}</p>
                        ) : (
                            <div className="mt-1.5 flex w-full min-w-0 flex-row items-stretch gap-2">
                                <div className={pairAggregateRoomInteriorGameModeColumnClass(lobbyTone, handheld)}>
                                    <div className={pairAggregateRoomInteriorGameModeColumnHeaderClass(lobbyTone, handheld)}>{t('invite.gameMode')}</div>
                                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 py-2">
                                        {modeVisual ? (
                                            <>
                                                <img
                                                    src={modeVisual.image}
                                                    alt=""
                                                    className={`h-12 w-12 shrink-0 object-contain ${pairAggregateRoomInteriorGameModeIconDropShadowClass(lobbyTone)}`}
                                                />
                                                <div className={pairAggregateRoomInteriorGameModeNameBoxClass(lobbyTone, handheld)}>
                                                    {modeVisual.name}
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <div className={pairAggregateRoomInteriorDetailColumnOuterClass(lobbyTone)}>
                                    <div className={pairAggregateRoomInteriorDetailColumnHeaderClass(lobbyTone, handheld)}>{t('invite.detailConditions')}</div>
                                    <div className="max-h-[min(11rem,28vh)] min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
                                        {settingRows.length > 0 ? (
                                            <dl className="grid grid-cols-2 gap-1.5">
                                                {settingRows.map((row) => (
                                                    <React.Fragment key={`${row.label}:${row.value}`}>
                                                        <dt className="text-[10px] font-semibold text-slate-400">{row.label}</dt>
                                                        <dd className="text-right text-[10px] font-bold text-slate-100">{row.value}</dd>
                                                    </React.Fragment>
                                                ))}
                                            </dl>
                                        ) : (
                                            <p className="text-center text-[10px] text-slate-500">{t('invite.noDetailConditions')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                        <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <svg width="56" height="56" viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r={RING_R}
                                        fill="none"
                                        className="stroke-zinc-700"
                                        strokeWidth="10"
                                    />
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r={RING_R}
                                        fill="none"
                                        strokeWidth="10"
                                        strokeLinecap="round"
                                        className={
                                            lobbyTone === 'playful'
                                                ? 'stroke-amber-400'
                                                : lobbyTone === 'pair'
                                                  ? 'stroke-violet-400'
                                                  : 'stroke-cyan-400'
                                        }
                                        strokeDasharray={RING_C}
                                        strokeDashoffset={ringOffset}
                                        style={{ transition: 'stroke-dashoffset 0.2s linear' }}
                                    />
                                </svg>
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-extrabold tabular-nums text-white">{secLeft}</span>
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`text-xs font-bold ${expired ? 'text-rose-300' : 'text-slate-300'}`}>
                                    {expired ? t('invite.inviteExpired') : t('invite.responseWaiting', { seconds: secLeft })}
                                </p>
                                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                        className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                                            lobbyTone === 'playful'
                                                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                                : lobbyTone === 'pair'
                                                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-400'
                                                  : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                                        }`}
                                        style={{ width: `${progress * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 grid grid-cols-2 gap-3 border-t border-white/10 p-4">
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || expired}
                        onClick={() => void onDecline()}
                        className="rounded-xl border border-white/20 bg-zinc-800/70 py-3 text-sm font-bold text-zinc-200"
                    >
                        {t('rankedOffer.decline')}
                    </Button>
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || expired}
                        onClick={() => void onAccept()}
                        className="rounded-xl border border-emerald-400/50 bg-emerald-900/55 py-3 text-sm font-extrabold text-emerald-50"
                    >
                        {t('rankedOffer.accept')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PairIncomingPartnerInviteModal;
