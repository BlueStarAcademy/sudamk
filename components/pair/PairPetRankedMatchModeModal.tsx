import React, { useEffect, useMemo, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { GameMode, type User } from '../../types.js';
import {
    RANKING_TIERS,
    RANKED_ELO_BASE_SCORE,
    SPECIAL_GAME_MODES,
    STRATEGIC_ACTION_POINT_COST,
} from '../../constants.js';
import { RANKED_STRATEGIC_MODES } from '../../constants/rankedGameSettings.js';
import { buildRankedStrategicMatchLobbySettingRows } from '../../shared/utils/pairLobbyGameSettingRows.js';
import {
    PAIR_LOBBY_DENSE_SETTING_ROW_CLASS,
    PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS,
    PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS,
} from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';
import { getCurrentSeason } from '../../utils/timeUtils.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { readPairRankedBlock } from '../../shared/utils/unifiedRankedStatsMigration.js';

/** `AiChallengeModal` 페어 방 만들기 임베드와 동일 */
const EMBEDDED_PAIR_SHELL_CLASS =
    'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-violet-400/40 bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/15';

/** 모바일 2열 대국 설정 행 — 라벨·값 박스를 한 줄에 두 칸이 들어가게 압축 */
const HANDHELD_RANKED_RULE_ROW_EXTRA_CLASS =
    '!py-1 !px-1.5 gap-x-1 [&>label]:text-[10px] [&>label]:leading-tight [&>div:nth-child(2)]:!h-8 [&>div:nth-child(2)]:!min-h-8 [&>div:nth-child(2)]:!px-1 [&>div:nth-child(2)]:!text-[11px]';

function resolveMyStrategicRankedTierForMode(user: User | null | undefined, mode: GameMode): {
    tier: (typeof RANKING_TIERS)[number];
    score: number;
    modePvpGames: number;
} {
    const fallbackTier = RANKING_TIERS[RANKING_TIERS.length - 1];
    if (!user) {
        return { tier: fallbackTier, score: RANKED_ELO_BASE_SCORE, modePvpGames: 0 };
    }
    const seasonName = getCurrentSeason().name;
    const slice = user.seasonHistory?.[seasonName];
    const rawStored = slice?.[mode];
    const storedName = typeof rawStored === 'string' ? rawStored : undefined;

    const st = user.stats?.[mode as string];
    const score = st?.rankingScore ?? RANKED_ELO_BASE_SCORE;
    const modePvpGames = (st?.wins ?? 0) + (st?.losses ?? 0);

    if (typeof storedName === 'string' && RANKING_TIERS.some((t) => t.name === storedName)) {
        return { tier: RANKING_TIERS.find((t) => t.name === storedName)!, score, modePvpGames };
    }

    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, 99_999, modePvpGames)) {
            return { tier, score, modePvpGames };
        }
    }
    return { tier: fallbackTier, score, modePvpGames };
}

/** 페어 경기장 랭킹전(펫·2인 공용) — `stats.pair` 단일 점수·전적 기준 티어 */
function resolveMyPairRankedTierForPairArena(user: User | null | undefined): {
    tier: (typeof RANKING_TIERS)[number];
    score: number;
    modePvpGames: number;
} {
    const fallbackTier = RANKING_TIERS[RANKING_TIERS.length - 1];
    if (!user) {
        return { tier: fallbackTier, score: RANKED_ELO_BASE_SCORE, modePvpGames: 0 };
    }
    const seasonName = getCurrentSeason().name;
    const slice = user.seasonHistory?.[seasonName] as Record<string, unknown> | undefined;
    const rawStored = slice?.pair;
    const storedName = typeof rawStored === 'string' ? rawStored : undefined;

    const blk = readPairRankedBlock((user.stats ?? {}) as NonNullable<User['stats']>);
    const score = blk.rankingScore;
    const modePvpGames = blk.wins + blk.losses;

    if (typeof storedName === 'string' && RANKING_TIERS.some((t) => t.name === storedName)) {
        return { tier: RANKING_TIERS.find((t) => t.name === storedName)!, score, modePvpGames };
    }

    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, 99_999, modePvpGames)) {
            return { tier, score, modePvpGames };
        }
    }
    return { tier: fallbackTier, score, modePvpGames };
}

type ModeDef = (typeof SPECIAL_GAME_MODES)[number];

const ModePickCard: React.FC<{
    def: ModeDef;
    queueCount: number;
    isSelected: boolean;
    disabled: boolean;
    compact: boolean;
    onSelect: () => void;
}> = ({ def, queueCount, isSelected, disabled, compact, onSelect }) => {
    const [imgError, setImgError] = useState(false);
    const imgH = compact ? 70 : 88;

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            className={`bg-panel text-on-panel flex w-full touch-manipulation flex-col items-center gap-1 rounded-lg p-2 text-center text-sm transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${
                isSelected
                    ? compact
                        ? 'ring-2 ring-violet-400/85 ring-offset-2 ring-offset-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(167,139,250,0.35),0_10px_28px_-8px_rgba(139,92,246,0.45)]'
                        : 'cursor-pointer ring-2 ring-purple-500 shadow-lg'
                    : 'cursor-pointer shadow-lg hover:ring-1 hover:ring-purple-400/40'
            }`}
        >
            <div
                className="bg-tertiary text-tertiary relative flex w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-md p-1 shadow-inner"
                style={{ height: `${imgH}px` }}
            >
                {!imgError ? (
                    <img
                        src={def.image}
                        alt=""
                        className="h-full w-full object-contain"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span className="text-sm">{def.name}</span>
                )}
            </div>
            <h3 className="text-primary w-full min-w-0 truncate px-0.5 text-sm font-bold leading-snug sm:text-base">{def.name}</h3>
            <p className="w-full text-xs font-semibold tabular-nums text-cyan-100 sm:text-sm">대기 {queueCount}팀</p>
        </button>
    );
};

export interface PairPetRankedMatchModeModalProps {
    initialMode: GameMode;
    queueCountByMode: Partial<Record<GameMode, number>>;
    currentUser: User | null;
    isBusy: boolean;
    onClose: () => void;
    onQueue: (mode: GameMode) => void | Promise<void>;
    /** `strategic_arena`: 전략 경기장 랭킹전/AI대결 방 — 우측 문구·창 제목만 전략바둑에 맞춤 */
    variant?: 'pair_pet' | 'strategic_arena' | 'duo_arena';
    /** 방장이 이미 고른 모드만 보여 주고 우측 정보만 표시(파트너 동의용) */
    hideModePicker?: boolean;
}

const PairPetRankedMatchModeModal: React.FC<PairPetRankedMatchModeModalProps> = ({
    initialMode,
    queueCountByMode,
    currentUser,
    isBusy,
    onClose,
    onQueue,
    variant = 'pair_pet',
    hideModePicker = false,
}) => {
    const { isNativeMobile } = useNativeMobileShell();
    const isCompactViewport = useIsHandheldDevice(1024);
    const isHandheld = isNativeMobile || isCompactViewport;

    const modes = useMemo(
        () => RANKED_STRATEGIC_MODES.map((m) => SPECIAL_GAME_MODES.find((def) => def.mode === m)).filter(Boolean) as ModeDef[],
        [],
    );
    const [selected, setSelected] = useState<GameMode>(() =>
        RANKED_STRATEGIC_MODES.includes(initialMode) ? initialMode : GameMode.Standard,
    );

    useEffect(() => {
        setSelected(RANKED_STRATEGIC_MODES.includes(initialMode) ? initialMode : GameMode.Standard);
    }, [initialMode]);

    const selectedDef = useMemo(() => modes.find((d) => d.mode === selected), [modes, selected]);
    const ruleRows = useMemo(() => buildRankedStrategicMatchLobbySettingRows(selected), [selected]);
    const selectedQueue = queueCountByMode[selected] ?? 0;
    const myRankedForMode = useMemo(
        () =>
            variant === 'strategic_arena'
                ? resolveMyStrategicRankedTierForMode(currentUser, selected)
                : resolveMyPairRankedTierForPairArena(currentUser),
        [variant, currentUser, selected],
    );
    const lobbyContextBracketLabel =
        variant === 'strategic_arena' ? '전략바둑 랭킹전' : variant === 'duo_arena' ? '2인 페어 랭킹전' : '페어 펫 랭킹전';

    const modePickerColumn = (
        <div
            className={`flex shrink-0 flex-col border-b border-gray-700 bg-tertiary/30 text-on-panel sm:p-4 ${
                isHandheld ? 'p-2.5' : 'p-4'
            } ${isHandheld ? '' : 'lg:w-[min(34%,300px)] lg:max-w-[320px] lg:border-b-0 lg:border-r'}`}
        >
            <h3 className="mb-2 shrink-0 text-sm font-bold text-zinc-100 sm:mb-3 sm:text-base">게임 종류 선택</h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {modes.map((def) => (
                    <ModePickCard
                        key={def.mode}
                        def={def}
                        queueCount={queueCountByMode[def.mode] ?? 0}
                        isSelected={selected === def.mode}
                        disabled={isBusy}
                        compact={isHandheld}
                        onSelect={() => setSelected(def.mode)}
                    />
                ))}
            </div>
        </div>
    );

    const infoAndActionsColumn = (
        <div className="bg-primary text-on-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain sm:p-4 ${
                    isHandheld ? 'p-2.5 text-sm leading-snug' : 'p-4 text-base'
                }`}
            >
                <div className={`border-b border-zinc-600/50 ${isHandheld ? 'pb-2' : 'pb-3'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:gap-x-3">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                            <div className="flex shrink-0 flex-col items-center gap-1 self-center sm:gap-2">
                                {selectedDef ? (
                                    <div
                                        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/12 bg-zinc-800/90 shadow-inner ring-1 ring-white/5 sm:p-2 ${
                                            isHandheld
                                                ? 'h-12 w-12 p-1'
                                                : 'h-[3.25rem] w-[3.25rem] p-1.5 sm:h-[4.25rem] sm:w-[4.25rem]'
                                        }`}
                                        aria-hidden
                                    >
                                        <img
                                            src={selectedDef.image}
                                            alt=""
                                            className="max-h-full max-w-full object-contain drop-shadow-[0_0_10px_rgba(167,139,250,0.25)]"
                                        />
                                    </div>
                                ) : null}
                                <h4 className="max-w-[6.5rem] text-center text-xs font-extrabold leading-tight text-zinc-100 sm:max-w-[8rem] sm:text-sm">
                                    {selectedDef?.name ?? '모드'}
                                </h4>
                            </div>
                            <div className="mx-0.5 hidden h-8 w-px shrink-0 bg-zinc-600/60 sm:block" aria-hidden />
                            <div className="flex shrink-0 flex-col items-center gap-0.5 sm:gap-1">
                                <img
                                    src={myRankedForMode.tier.icon}
                                    alt=""
                                    className={`object-contain sm:h-12 sm:w-12 ${isHandheld ? 'h-9 w-9' : 'h-11 w-11'}`}
                                />
                                <p
                                    className={`max-w-[5rem] text-center text-[10px] font-extrabold leading-tight sm:max-w-none sm:text-xs ${myRankedForMode.tier.color}`}
                                >
                                    {myRankedForMode.tier.name}
                                </p>
                            </div>
                            <div className="mx-0.5 hidden h-8 w-px shrink-0 bg-zinc-600/60 sm:block" aria-hidden />
                            <div className="flex shrink-0 flex-col items-start gap-0 border-l border-zinc-600/50 pl-2 sm:gap-0.5 sm:pl-3 sm:ml-0.5">
                                <span className="text-[11px] font-semibold text-zinc-400 sm:text-sm">랭킹 점수</span>
                                <span
                                    className={`font-mono font-extrabold tabular-nums leading-none text-zinc-50 sm:text-2xl ${
                                        isHandheld ? 'text-lg' : 'text-xl'
                                    }`}
                                >
                                    {myRankedForMode.score}
                                </span>
                            </div>
                        </div>
                        <span
                            className={`shrink-0 rounded-lg border border-cyan-600/50 bg-cyan-950/90 text-center font-semibold leading-tight text-cyan-50 sm:px-3 sm:py-2 sm:text-sm ${
                                isHandheld ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
                            }`}
                        >
                            매칭 대기{' '}
                            <span className={`block font-bold tabular-nums sm:text-base ${isHandheld ? 'text-sm' : 'text-base'}`}>
                                {selectedQueue}팀
                            </span>
                        </span>
                    </div>
                    {myRankedForMode.modePvpGames < 10 ? (
                        <p className="mt-1.5 text-xs leading-snug text-amber-200/90 sm:text-sm">
                            {variant === 'strategic_arena' ? (
                                <>이 모드 랭킹전 {10 - myRankedForMode.modePvpGames}판 더 두면 시즌 랭킹에 반영됩니다.</>
                            ) : (
                                <>페어 랭킹전 {10 - myRankedForMode.modePvpGames}판 더 두면 시즌 랭킹에 반영됩니다.</>
                            )}
                        </p>
                    ) : null}
                </div>

                {selectedDef ? (
                    <div className={`border-b border-zinc-600/50 sm:mt-4 sm:pb-4 ${isHandheld ? 'mt-3 pb-3' : 'mt-4 pb-4'}`}>
                        <p className="text-xs font-semibold text-zinc-200 sm:text-sm">게임 설명</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-300 sm:mt-2 sm:text-sm">
                            <span className="whitespace-nowrap font-semibold text-zinc-400">[{lobbyContextBracketLabel}]</span>
                            {selectedDef.description ? (
                                <span> {selectedDef.description}</span>
                            ) : (
                                <span className="text-zinc-500"> 등록된 설명이 없습니다.</span>
                            )}
                        </p>
                    </div>
                ) : null}

                <div className={isHandheld ? 'mt-3' : 'mt-4'}>
                    <p className="text-xs font-semibold text-zinc-200 sm:text-sm">랭킹전 적용 규칙</p>
                    <h4 className="mb-0 mt-1.5 flex-shrink-0 text-xs font-semibold text-gray-300 sm:mt-2 sm:text-sm">대국 설정</h4>
                    {ruleRows.length > 0 ? (
                        <div
                            className={
                                isHandheld
                                    ? 'mt-1.5 grid w-full min-w-0 grid-cols-2 content-start gap-x-1.5 gap-y-1.5 sm:mt-2 [&>div]:min-w-0'
                                    : `mt-1.5 sm:mt-2 ${PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS}`
                            }
                        >
                            {ruleRows.map((row, idx) => (
                                <div
                                    key={`${row.label}:${idx}`}
                                    className={`${PAIR_LOBBY_DENSE_SETTING_ROW_CLASS}${
                                        isHandheld ? ` ${HANDHELD_RANKED_RULE_ROW_EXTRA_CLASS}` : ''
                                    }`}
                                >
                                    <label
                                        className={`flex-shrink-0 font-semibold text-gray-300 ${isHandheld ? '' : 'text-sm'}`}
                                    >
                                        {row.label}
                                    </label>
                                    <div className={PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS} title={row.value}>
                                        {row.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-zinc-400">표시할 규칙이 없습니다.</p>
                    )}
                </div>
            </div>

            <div
                className={`grid shrink-0 grid-cols-2 gap-2 border-t border-zinc-600/50 bg-zinc-950/50 sm:px-4 sm:py-3 ${
                    isHandheld ? 'px-2.5 py-2' : 'px-4 py-3'
                }`}
            >
                <Button
                    type="button"
                    bare
                    disabled={isBusy}
                    onClick={() => onClose()}
                    className={`rounded-xl border border-zinc-500/60 bg-zinc-800/80 font-semibold text-zinc-100 sm:py-3 sm:text-base ${
                        isHandheld ? 'py-2.5 text-sm' : 'py-3 text-base'
                    }`}
                >
                    취소
                </Button>
                <Button
                    type="button"
                    bare
                    disabled={isBusy}
                    onClick={() => void onQueue(selected)}
                    className={`rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-600/90 to-amber-950/95 font-semibold text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:py-3 sm:text-base ${
                        isHandheld ? 'py-2.5 text-sm' : 'py-3 text-base'
                    }`}
                >
                    매칭 대기 (⚡{STRATEGIC_ACTION_POINT_COST})
                </Button>
            </div>
        </div>
    );

    const body = (
        <div className={EMBEDDED_PAIR_SHELL_CLASS}>
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
                {!hideModePicker ? modePickerColumn : null}
                {infoAndActionsColumn}
            </div>
        </div>
    );

    const windowTitle =
        variant === 'strategic_arena'
            ? '전략바둑 랭킹전 매칭'
            : variant === 'duo_arena'
              ? '2인 페어 랭킹전 매칭'
              : '페어 펫 랭킹전 매칭';
    const windowId =
        variant === 'strategic_arena'
            ? 'strategic-arena-ranked-match-mode'
            : variant === 'duo_arena'
              ? 'duo-arena-ranked-match-mode'
              : 'pair-pet-ranked-match-mode';

    return (
        <DraggableWindow
            title={windowTitle}
            onClose={() => {
                if (!isBusy) onClose();
            }}
            windowId={windowId}
            initialWidth={isHandheld ? 680 : 900}
            shrinkHeightToContent
            bodyScrollable={false}
            bodyPaddingClassName="!p-2 sm:!p-3"
            bodyScrollClassName="sudamr-mobile-modal-body--dense-copy"
            closeOnOutsideClick={false}
            isTopmost
            zIndex={84}
            skipSavedPosition
            variant="store"
            mobileViewportFit={isHandheld}
            mobileViewportMaxHeightCss={isHandheld ? 'min(92dvh, calc(100dvh - 16px))' : undefined}
        >
            {body}
        </DraggableWindow>
    );
};

export default PairPetRankedMatchModeModal;
