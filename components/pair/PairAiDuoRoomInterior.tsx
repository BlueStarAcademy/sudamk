import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    type WaitingLobbyPanelTone,
    pairAggregateRoomInteriorActionBarClass,
    pairAggregateRoomInteriorActionBarHandheldClass,
    pairAggregateRoomInteriorDetailColumnHeaderClass,
    pairAggregateRoomInteriorDetailColumnOuterClass,
    pairAggregateRoomInteriorGameModeColumnClass,
    pairAggregateRoomInteriorGameModeColumnHeaderClass,
    pairAggregateRoomInteriorGameModeIconDropShadowClass,
    pairAggregateRoomInteriorGameModeNameBoxClass,
    pairAggregateRoomInteriorGameSettingsHeadingRowClass,
    pairAggregateRoomInteriorGameSettingsOuterClass,
    pairAggregateRoomInteriorShellHandheldClass,
    pairAggregateRoomInteriorShellClass,
    pairAggregateRoomInteriorTeamBoxClass,
    pairAggregateRoomInteriorTeamBoxHandheldClass,
} from '../waiting-room/waitingLobbyHomePanelStyles.js';

const HANDHELD_ACTION_BTN =
    'px-2 py-1.5 text-[11px] leading-tight rounded-lg border-2 font-extrabold transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45';

const DESKTOP_ACTION_BTN =
    'rounded-lg border-2 px-4 py-3.5 text-sm font-extrabold leading-tight transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]';

export type PairAiDuoGameVisual = { image: string; name: string };

export type PairAiDuoSettingRow = { label: string; value: string };

export type PairAiDuoRoomInteriorProps = {
    lobbyTone: WaitingLobbyPanelTone;
    compact?: boolean;
    seatGrid: React.ReactNode;
    scheduledGameVisual: PairAiDuoGameVisual | null;
    scheduledGameDetailRows: PairAiDuoSettingRow[];
    isOwner: boolean;
    isBusy: boolean;
    showReadyButton: boolean;
    currentUserPairReady: boolean;
    readyUnreadyBlocked?: boolean;
    readyUnreadyBlockedTitle?: string;
    onReadyToggle: () => void;
    onProposeChange: () => void;
    proposeChangeDisabled: boolean;
    proposeChangeTitle?: string;
    onLeave: () => void;
    onEditRoom?: () => void;
    editRoomDisabled?: boolean;
    onStartAi?: () => void;
    startAiDisabled?: boolean;
    startAiLabel?: string;
};

const PairAiDuoRoomInterior: React.FC<PairAiDuoRoomInteriorProps> = ({
    lobbyTone,
    compact = false,
    seatGrid,
    scheduledGameVisual,
    scheduledGameDetailRows,
    isOwner,
    isBusy,
    showReadyButton,
    currentUserPairReady,
    readyUnreadyBlocked = false,
    readyUnreadyBlockedTitle,
    onReadyToggle,
    onProposeChange,
    proposeChangeDisabled,
    proposeChangeTitle,
    onLeave,
    onEditRoom,
    editRoomDisabled = false,
    onStartAi,
    startAiDisabled = false,
    startAiLabel,
}) => {
    const { t } = useTranslation('pair');
    const shellClass = compact ? pairAggregateRoomInteriorShellHandheldClass(lobbyTone) : pairAggregateRoomInteriorShellClass(lobbyTone);
    const teamBoxClass = compact
        ? pairAggregateRoomInteriorTeamBoxHandheldClass(lobbyTone)
        : pairAggregateRoomInteriorTeamBoxClass(lobbyTone);
    const actionBarClass = compact
        ? pairAggregateRoomInteriorActionBarHandheldClass(lobbyTone)
        : pairAggregateRoomInteriorActionBarClass(lobbyTone);
    const actionBtn = (handheldClass: string, desktopClass: string) =>
        compact ? handheldClass : desktopClass;

    const readyBtnClass = actionBtn(
        `${HANDHELD_ACTION_BTN} border-emerald-300/70 bg-gradient-to-b from-emerald-600/90 to-emerald-950/95 text-emerald-50 shadow-[0_3px_12px_-4px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`,
        `${DESKTOP_ACTION_BTN} border-emerald-300/70 bg-gradient-to-b from-emerald-600/90 to-emerald-950/95 text-emerald-50 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]`,
    );
    const proposeBtnClass = actionBtn(
        `${HANDHELD_ACTION_BTN} border-sky-400/75 bg-gradient-to-b from-sky-600/90 to-sky-950/95 text-sky-50 shadow-[0_3px_12px_-4px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`,
        `${DESKTOP_ACTION_BTN} border-sky-400/75 bg-gradient-to-b from-sky-600/90 to-sky-950/95 text-sky-50 shadow-[0_6px_20px_-6px_rgba(56,189,248,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]`,
    );
    const startBtnClass = actionBtn(
        `${HANDHELD_ACTION_BTN} border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 text-amber-50 shadow-[0_3px_12px_-4px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`,
        `${DESKTOP_ACTION_BTN} border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 text-amber-50 shadow-[0_6px_22px_-6px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]`,
    );
    const editBtnClass = actionBtn(
        `${HANDHELD_ACTION_BTN} border-violet-400/75 bg-gradient-to-b from-violet-700/90 to-violet-950/95 text-violet-50 shadow-[0_3px_12px_-4px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`,
        `${DESKTOP_ACTION_BTN} border-violet-400/75 bg-gradient-to-b from-violet-700/90 to-violet-950/95 text-violet-50 shadow-[0_6px_20px_-6px_rgba(139,92,246,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]`,
    );
    const leaveBtnClass = actionBtn(
        `${HANDHELD_ACTION_BTN} border-zinc-500/70 bg-gradient-to-b from-zinc-700/90 to-zinc-950/95 text-zinc-100 shadow-[0_3px_10px_-4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]`,
        `${DESKTOP_ACTION_BTN} border-zinc-500/70 bg-gradient-to-b from-zinc-700/90 to-zinc-950/95 text-zinc-100 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]`,
    );

    const gameSettingsBlock = useMemo(() => {
        if (!scheduledGameVisual) return null;
        return (
            <div className={pairAggregateRoomInteriorGameSettingsOuterClass(lobbyTone, compact)}>
                <div className={pairAggregateRoomInteriorGameSettingsHeadingRowClass(lobbyTone, compact)}>
                    {t('waitingLobby.matchSettings')}
                </div>
                <div
                    className={`flex w-full min-w-0 flex-row items-stretch ${
                        compact ? 'mt-1.5 gap-2' : 'mt-2.5 gap-2.5 sm:mt-3 sm:gap-3'
                    }`}
                >
                    <div className={pairAggregateRoomInteriorGameModeColumnClass(lobbyTone, compact)}>
                        <div className={pairAggregateRoomInteriorGameModeColumnHeaderClass(lobbyTone, compact)}>
                            {t('waitingLobby.gameMode')}
                        </div>
                        <div
                            className={`flex min-h-0 flex-1 flex-col items-center justify-center ${
                                compact ? 'gap-1' : 'gap-2 sm:gap-2.5'
                            }`}
                        >
                            <img
                                src={scheduledGameVisual.image}
                                alt=""
                                className={`shrink-0 object-contain ${pairAggregateRoomInteriorGameModeIconDropShadowClass(lobbyTone)} ${
                                    compact ? 'h-[3rem] w-[3rem]' : 'h-[4.5rem] w-[4.5rem] sm:h-[5.25rem] sm:w-[5.25rem]'
                                }`}
                            />
                            <div className={pairAggregateRoomInteriorGameModeNameBoxClass(lobbyTone, compact)}>
                                {scheduledGameVisual.name}
                            </div>
                        </div>
                    </div>
                    <div className={pairAggregateRoomInteriorDetailColumnOuterClass(lobbyTone)}>
                        <div className={pairAggregateRoomInteriorDetailColumnHeaderClass(lobbyTone, compact)}>
                            {t('waitingLobby.detailConditions')}
                        </div>
                        <div
                            className={`min-h-0 flex-1 overflow-y-auto ${
                                compact
                                    ? 'max-h-[min(8.5rem,26vh)] px-1.5 py-1'
                                    : 'max-h-[min(14rem,34vh)] px-2 py-2 sm:px-2.5 sm:py-2.5'
                            }`}
                        >
                            {scheduledGameDetailRows.length > 0 ? (
                                <dl className={compact ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-2 gap-1.5 sm:gap-2'}>
                                    {scheduledGameDetailRows.map((row) => (
                                        <div
                                            key={`${row.label}:${row.value}`}
                                            className="flex min-h-0 flex-col gap-0.5 rounded-lg border border-white/12 bg-black/55 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:gap-1 sm:px-2 sm:py-1.5"
                                        >
                                            <dt
                                                className={`min-w-0 w-full text-slate-400 [overflow-wrap:anywhere] ${compact ? 'text-[9px] leading-tight' : 'text-[11px] leading-snug sm:text-xs'}`}
                                            >
                                                {row.label}
                                            </dt>
                                            <dd
                                                className={`min-w-0 w-full font-bold leading-tight text-slate-100 [overflow-wrap:anywhere] sm:leading-snug ${
                                                    compact ? 'text-[9px]' : 'text-[11px] sm:text-xs'
                                                }`}
                                            >
                                                {row.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : (
                                <p
                                    className={`rounded-lg border border-dashed border-white/15 bg-black/40 px-2 py-3 text-center leading-snug text-slate-500 ${compact ? 'text-[13px]' : 'text-sm'}`}
                                >
                                    {t('waitingLobby.noDetailSettings')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [scheduledGameVisual, scheduledGameDetailRows, lobbyTone, compact, t]);

    return (
        <div className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${shellClass}`}>
            <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden ${compact ? 'gap-2 p-1.5' : 'gap-2.5 p-2 sm:p-2.5'}`}>
                <div className={`min-h-0 min-w-0 shrink-0 overflow-x-auto ${teamBoxClass}`}>{seatGrid}</div>
                {gameSettingsBlock}
            </div>
            <div
                className={`${actionBarClass} shrink-0 grid grid-cols-3 gap-1.5 sm:gap-2 ${compact ? 'mt-1.5 px-1.5 pb-1.5' : 'mt-2 px-2 pb-2 sm:px-2.5 sm:pb-2.5'} pb-[max(0px,env(safe-area-inset-bottom))]`}
            >
                {isOwner ? (
                    <>
                        <button
                            type="button"
                            disabled={isBusy || startAiDisabled}
                            onClick={() => onStartAi?.()}
                            className={startBtnClass}
                        >
                            {startAiLabel ?? t('waitingLobby.startAi')}
                        </button>
                        <button
                            type="button"
                            disabled={isBusy || editRoomDisabled}
                            onClick={() => onEditRoom?.()}
                            className={editBtnClass}
                        >
                            {t('waitingLobby.changeRoom')}
                        </button>
                    </>
                ) : (
                    <>
                        {showReadyButton ? (
                            <button
                                type="button"
                                disabled={isBusy || (currentUserPairReady && readyUnreadyBlocked)}
                                title={currentUserPairReady && readyUnreadyBlocked ? readyUnreadyBlockedTitle : undefined}
                                onClick={() => {
                                    if (currentUserPairReady && readyUnreadyBlocked) return;
                                    onReadyToggle();
                                }}
                                aria-label={currentUserPairReady ? t('waitingLobby.unready') : t('waitingLobby.ready')}
                                className={readyBtnClass}
                            >
                                {currentUserPairReady ? t('waitingLobby.unready') : t('waitingLobby.ready')}
                            </button>
                        ) : (
                            <span aria-hidden className="min-w-0" />
                        )}
                        <button
                            type="button"
                            disabled={isBusy || proposeChangeDisabled}
                            title={proposeChangeTitle}
                            onClick={onProposeChange}
                            className={proposeBtnClass}
                        >
                            {t('waitingLobby.proposeChange')}
                        </button>
                    </>
                )}
                <button type="button" disabled={isBusy} onClick={onLeave} className={leaveBtnClass}>
                    {t('waitingLobby.leaveRoom')}
                </button>
            </div>
        </div>
    );
};

export default PairAiDuoRoomInterior;
