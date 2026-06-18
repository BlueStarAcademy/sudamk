import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import Button from '../Button.js';
import { GameMode, type User } from '../../types.js';
import {
    RANKING_TIERS,
    RANKED_ELO_BASE_SCORE,
    SPECIAL_GAME_MODES,
    PLAYFUL_GAME_MODES,
    STRATEGIC_ACTION_POINT_COST,
    PLAYFUL_ACTION_POINT_COST,
} from '../../constants.js';
import {
    effectivePairRankedApCostForUser,
    effectiveStrategicRankedQueueApCostForUser,
    formatActionPointCostWithPetDiscount,
} from '../../shared/utils/pairPetArenaApDiscount.js';
import { RANKED_STRATEGIC_MODES } from '../../constants/rankedGameSettings.js';
import { buildRankedStrategicMatchLobbySettingRows } from '../../shared/utils/pairLobbyGameSettingRows.js';
import {
    LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS,
    LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS,
    PAIR_LOBBY_DENSE_SETTING_ROW_CLASS,
    PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS,
} from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';
import { LobbyHorizontalModePickerScroll } from '../waiting-room/LobbyHorizontalModePickerScroll.js';
import { getCurrentSeason } from '../../utils/timeUtils.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { readPairRankedBlock } from '../../shared/utils/unifiedRankedStatsMigration.js';
import {
    LOBBY_MOBILE_BTN_SECONDARY_CLASS,
    LOBBY_MOBILE_HEADER_BACK_BTN_CLASS,
    LOBBY_MOBILE_MODAL_FOOTER_CLASS,
} from '../game/PreGameDescriptionLayout.js';

/** `AiChallengeModal` 페어 방 만들기 임베드와 동일 */
const EMBEDDED_PAIR_SHELL_CLASS =
    'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-violet-400/40 bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/15';

/** 모바일 랭킹전 — 전체 화면 오버레이 */
const LOBBY_ROOM_CREATE_BACKDROP_HANDHELD_CLASS =
    'fixed inset-0 z-[84] flex h-dvh max-h-dvh w-full flex-col bg-black/70 p-0 backdrop-blur-sm';

const LOBBY_ROOM_CREATE_BACKDROP_DESKTOP_CLASS =
    'fixed inset-0 z-[84] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3';

const LOBBY_ROOM_CREATE_CLOSE_BTN_CLASS =
    'absolute right-2 top-2 z-[2] shrink-0 rounded-lg border border-white/20 bg-zinc-900/90 px-3 py-1.5 text-xs font-bold text-zinc-200 shadow-md ring-1 ring-white/10 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:right-3 sm:top-3 sm:px-3.5 sm:py-2 sm:text-sm';

/** 모바일 2열 대국 설정 행 — 라벨·값 박스를 한 줄에 두 칸이 들어가게 압축 */
const HANDHELD_RANKED_RULE_ROW_EXTRA_CLASS =
    '!py-1 !px-1.5 gap-x-1 [&>label]:text-[11px] [&>label]:!leading-none [&>div:nth-child(2)]:!h-9 [&>div:nth-child(2)]:!min-h-9 [&>div:nth-child(2)]:!px-1.5 [&>div:nth-child(2)]:!text-[13px] [&>div:nth-child(2)]:!leading-none';

/** 모달 상단 간략 설명 — `AiChallengeModal`과 동일 로직 */
function lobbyGameModeBriefDescription(description: string | undefined, fallback: string): string {
    const t = (description || '').trim().replace(/\s+/g, ' ');
    if (!t) return fallback;
    const max = 132;
    if (t.length <= max) return t;
    const slice = t.slice(0, max);
    const sp = slice.lastIndexOf(' ');
    if (sp > 72) return `${slice.slice(0, sp)}…`;
    return `${slice}…`;
}

function pairRankedBaseApForSelectedMode(mode: GameMode): number {
    if (SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return STRATEGIC_ACTION_POINT_COST;
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === mode)) return PLAYFUL_ACTION_POINT_COST;
    return STRATEGIC_ACTION_POINT_COST;
}

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
export function resolveMyPairRankedTierForPairArena(user: User | null | undefined): {
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
    scrollStripItem?: boolean;
    onSelect: () => void;
}> = ({ def, queueCount, isSelected, disabled, compact, scrollStripItem, onSelect }) => {
    const { t } = useTranslation('pair');
    const [imgError, setImgError] = useState(false);
    const imgH = compact ? 70 : 88;

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            className={`bg-panel text-on-panel flex touch-manipulation flex-col items-center gap-1 rounded-lg p-2 text-center text-sm transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${
                scrollStripItem ? 'w-max max-w-none' : 'w-full'
            } ${
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
                        draggable={false}
                        className="pointer-events-none h-full w-full select-none object-contain [-webkit-user-drag:none]"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span className="text-sm">{def.name}</span>
                )}
            </div>
            <h3
                className={`text-primary w-full shrink-0 px-0.5 text-center text-sm font-bold sm:text-base ${
                    scrollStripItem ? 'whitespace-nowrap leading-snug' : 'min-w-0 leading-snug'
                }`}
            >
                {def.name}
            </h3>
            <p className="w-full text-xs font-semibold tabular-nums text-cyan-100 sm:text-sm">
                {t('rankedMatch.queueWaiting', {
                    count: queueCount,
                    unit: t('rankedMatch.queueUnitTeam'),
                })}
            </p>
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
    /** `strategic_arena`: 전략 경기장 `arena_ai` 방 — 우측 문구·창 제목만 전략바둑에 맞춤 */
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
    const { t } = useTranslation(['pair', 'common', 'game']);
    const { t: tCommon } = useTranslation('common');
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
    const [mobileStep, setMobileStep] = useState<'pickMode' | 'details'>('pickMode');

    useEffect(() => {
        setSelected(RANKED_STRATEGIC_MODES.includes(initialMode) ? initialMode : GameMode.Standard);
        setMobileStep('pickMode');
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

    const displayedQueueApCost = useMemo(() => {
        if (variant === 'strategic_arena') {
            const base = STRATEGIC_ACTION_POINT_COST;
            if (!currentUser) return String(base);
            const eff = effectiveStrategicRankedQueueApCostForUser(currentUser);
            return formatActionPointCostWithPetDiscount(base, eff);
        }
        const base = pairRankedBaseApForSelectedMode(selected);
        if (!currentUser) return String(base);
        const eff = effectivePairRankedApCostForUser(currentUser, base, { lobbyChannel: 'pair' });
        return formatActionPointCostWithPetDiscount(base, eff);
    }, [variant, currentUser, selected]);

    const queueCountUnitLabel =
        variant === 'pair_pet' || variant === 'duo_arena' ? t('rankedMatch.queueUnitTeam') : t('rankedMatch.queueUnitPerson');

    /** 모바일: 모드 피커와 정보 열을 세로 2단계로 분리(AI 대전 모달과 동일 흐름). 파트너 동의 등 `hideModePicker`일 때는 단일 열 유지 */
    const handheldModePickerStacked = isHandheld && !hideModePicker;

    const modeBriefFallback =
        variant === 'strategic_arena' ? t('rankedMatch.briefFallbackStrategic') : t('rankedMatch.briefFallbackDefault');

    const selectedModeBriefSummaryPanel = (
        <div className="relative z-[1] shrink-0 rounded-xl border border-white/10 bg-black/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-stretch gap-2.5">
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 self-center">
                    {selectedDef ? (
                        <>
                            <div className="flex h-14 w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-zinc-800/85 p-1 shadow-inner">
                                <img src={selectedDef.image} alt="" className="max-h-full max-w-full object-contain" />
                            </div>
                            <span className="w-full text-center text-[11px] font-extrabold leading-tight text-cyan-100 line-clamp-2">
                                {selectedDef.name}
                            </span>
                        </>
                    ) : (
                        <span className="text-center text-[10px] leading-snug text-zinc-500">{t('rankedMatch.selectMode')}</span>
                    )}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                    <p className="text-[11px] leading-snug text-zinc-300 line-clamp-5">
                        {lobbyGameModeBriefDescription(selectedDef?.description, modeBriefFallback)}
                    </p>
                </div>
            </div>
        </div>
    );

    const mobileHeaderBack =
        handheldModePickerStacked && mobileStep === 'details' ? (
            <button
                type="button"
                className={LOBBY_MOBILE_HEADER_BACK_BTN_CLASS}
                onClick={(e) => {
                    e.stopPropagation();
                    setMobileStep('pickMode');
                }}
            >
                {tCommon('actions.back')}
            </button>
        ) : undefined;

    const tierScoreQueueGrid = (
        <div
            className={`grid min-w-0 grid-cols-3 items-stretch divide-x divide-zinc-600/40 rounded-lg border border-zinc-600/40 bg-black/25 ${
                isHandheld ? 'gap-0 py-2' : 'py-2.5'
            }`}
        >
            <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 sm:px-2">
                <img
                    src={myRankedForMode.tier.icon}
                    alt=""
                    className={`object-contain ${isHandheld ? 'h-7 w-7' : 'h-9 w-9 sm:h-10 sm:w-10'}`}
                />
                <p
                    className={`max-w-full truncate text-center text-[9px] font-extrabold leading-tight sm:text-[10px] ${myRankedForMode.tier.color}`}
                >
                    {myRankedForMode.tier.name}
                </p>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-center sm:px-2">
                <span className="text-[9px] font-semibold tracking-wide text-zinc-500 sm:text-[10px]">{t('game:summary.rankingScore')}</span>
                <span
                    className={`font-mono font-extrabold tabular-nums leading-none text-zinc-50 ${
                        isHandheld ? 'text-base' : 'text-lg sm:text-xl'
                    }`}
                >
                    {myRankedForMode.score}
                </span>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-center sm:px-2">
                <span className="text-[9px] font-semibold tracking-wide text-cyan-200/80 sm:text-[10px]">{t('rankedMatch.matchQueue')}</span>
                <span className={`font-bold tabular-nums text-cyan-50 ${isHandheld ? 'text-base' : 'text-lg sm:text-xl'}`}>
                    {selectedQueue}
                    {queueCountUnitLabel}
                </span>
            </div>
        </div>
    );

    const rankedRulesSection = (
        <div className={isHandheld ? 'mt-3' : 'mt-4'}>
            <p className="text-xs font-semibold text-zinc-200 sm:text-sm">{t('rankedMatch.rankedRules')}</p>
            <h4 className="mb-0 mt-1.5 flex-shrink-0 text-xs font-semibold text-gray-300 sm:mt-2 sm:text-sm">{t('rankedMatch.gameSettings')}</h4>
            {ruleRows.length > 0 ? (
                <div
                    className={
                        isHandheld
                            ? `${LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS} mt-1.5 ${LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS} sm:mt-2`
                            : `${LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS} mt-1.5 ${LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS} sm:mt-2`
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
                                className={`min-w-0 w-full shrink-0 text-left font-semibold leading-none text-gray-300 whitespace-nowrap ${
                                    isHandheld ? '' : 'text-sm'
                                }`}
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
                <p className="mt-2 text-sm text-zinc-400">{t('rankedMatch.noRules')}</p>
            )}
        </div>
    );

    const modePickerColumn = (
        <div
            className={`flex shrink-0 flex-col border-b border-gray-700 bg-tertiary/30 text-on-panel sm:p-4 ${
                isHandheld ? 'p-2.5' : 'p-4'
            } ${
                isHandheld
                    ? ''
                    : 'lg:w-[min(36%,20rem)] lg:min-w-[15.5rem] lg:max-w-[20rem] lg:border-b-0 lg:border-r'
            }`}
        >
            <h3 className="mb-2 shrink-0 text-sm font-bold tracking-tight text-amber-100/95 sm:mb-3 sm:text-base">{t('rankedMatch.selectGameMode')}</h3>
            {isHandheld ? (
                <LobbyHorizontalModePickerScroll inlineRow>
                    {modes.map((def) => (
                        <div key={def.mode} className={LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS}>
                            <ModePickCard
                                def={def}
                                queueCount={queueCountByMode[def.mode] ?? 0}
                                isSelected={selected === def.mode}
                                disabled={isBusy}
                                compact={isHandheld}
                                scrollStripItem={isHandheld}
                                onSelect={() => setSelected(def.mode)}
                            />
                        </div>
                    ))}
                </LobbyHorizontalModePickerScroll>
            ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {modes.map((def) => (
                        <div key={def.mode} className="min-w-0">
                            <ModePickCard
                                def={def}
                                queueCount={queueCountByMode[def.mode] ?? 0}
                                isSelected={selected === def.mode}
                                disabled={isBusy}
                                compact={isHandheld}
                                scrollStripItem={isHandheld}
                                onSelect={() => setSelected(def.mode)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const infoAndActionsColumn = (
        <div className="bg-primary text-on-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain sm:p-4 ${
                    isHandheld ? 'p-2.5 text-sm leading-snug' : 'p-4 text-base'
                }`}
            >
                <div className="flex min-h-full flex-col justify-center">
                    <div className={`border-b border-zinc-600/50 ${isHandheld ? 'pb-2' : 'pb-3'}`}>
                        {selectedDef ? (
                            <div className={`mb-2 flex min-w-0 items-center gap-2 sm:mb-2.5 sm:gap-2.5`}>
                                <div
                                    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-zinc-800/90 shadow-inner ring-1 ring-white/5 ${
                                        isHandheld ? 'h-9 w-9 p-0.5' : 'h-10 w-10 p-1 sm:h-11 sm:w-11'
                                    }`}
                                    aria-hidden
                                >
                                    <img src={selectedDef.image} alt="" className="max-h-full max-w-full object-contain" />
                                </div>
                                <h4 className="min-w-0 truncate text-sm font-extrabold tracking-tight text-zinc-100 sm:text-base">
                                    {selectedDef.name}
                                </h4>
                            </div>
                        ) : (
                            <p className={`mb-2 text-xs text-zinc-500 ${isHandheld ? '' : 'sm:text-sm'}`}>{t('rankedMatch.selectModePeriod')}</p>
                        )}
                        {tierScoreQueueGrid}
                    </div>
                    {rankedRulesSection}
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
                    {tCommon('actions.cancel')}
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
                    {t('rankedMatch.queueWithAp', { cost: displayedQueueApCost })}
                </Button>
            </div>
        </div>
    );

    const body = handheldModePickerStacked ? (
        <div className={EMBEDDED_PAIR_SHELL_CLASS}>
            <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3">
                {selectedModeBriefSummaryPanel}
                {mobileStep === 'pickMode' ? (
                    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        <h3 className="shrink-0 text-sm font-bold tracking-tight text-amber-100/95">{t('rankedMatch.selectGameMode')}</h3>
                        <p className="shrink-0 text-[11px] leading-snug text-zinc-500">{t('rankedMatch.mobilePickHint')}</p>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
                            <div className="grid grid-cols-3 gap-2 pb-1">
                                {modes.map((def) => (
                                    <div key={def.mode} className="min-w-0">
                                        <ModePickCard
                                            def={def}
                                            queueCount={queueCountByMode[def.mode] ?? 0}
                                            isSelected={selected === def.mode}
                                            disabled={isBusy}
                                            compact
                                            onSelect={() => setSelected(def.mode)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div
                            className={`shrink-0 -mx-2 -mb-2 mt-1 flex justify-center px-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 sm:-mx-3 sm:-mb-3 sm:px-5 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS}`}
                        >
                            <Button
                                bare
                                colorScheme="none"
                                type="button"
                                disabled={isBusy || !selectedDef}
                                onClick={() => setMobileStep('details')}
                                className="inline-flex min-h-[2.55rem] max-w-[min(12.25rem,76vw)] shrink-0 items-center justify-center rounded-xl border border-violet-300/45 bg-gradient-to-br from-violet-500/96 via-fuchsia-600/94 to-indigo-800 px-4 text-[12.5px] font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_0_rgba(55,48,163,0.52),0_12px_32px_-12px_rgba(139,92,246,0.42)] ring-1 ring-violet-300/22 transition-all duration-200 hover:brightness-[1.06] active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] touch-manipulation disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!hover:brightness-100"
                            >
                                {tCommon('actions.next')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-lg border border-white/10 bg-black/25 p-1 sm:p-2">
                            <div className="flex min-h-full flex-col justify-center">
                                <div className="border-b border-zinc-600/50 pb-2">{tierScoreQueueGrid}</div>
                                {rankedRulesSection}
                            </div>
                        </div>
                        <div
                            className={`shrink-0 -mx-2 -mb-2 mt-1 flex flex-row items-stretch justify-center gap-2 rounded-b-2xl px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 sm:-mx-3 sm:-mb-3 sm:gap-2.5 sm:px-4 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS}`}
                        >
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => onClose()}
                                className={`${LOBBY_MOBILE_BTN_SECONDARY_CLASS} !min-h-[2.58rem] min-w-0 !w-auto flex-[0.92] !rounded-xl !px-3 !text-[12.5px] !font-bold`}
                            >
                                {tCommon('actions.cancel')}
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => void onQueue(selected)}
                                className="inline-flex !min-h-[2.58rem] min-w-0 !w-auto flex-[1.22] items-center justify-center !rounded-xl border border-amber-400/48 bg-gradient-to-b from-amber-600/88 to-amber-950/95 px-3 text-[12.5px] font-extrabold tracking-wide text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.11)] ring-1 ring-amber-400/18 transition-all hover:brightness-[1.06] active:scale-[0.99] disabled:!cursor-not-allowed disabled:!opacity-45"
                            >
                                {t('rankedMatch.queueWithAp', { cost: displayedQueueApCost })}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    ) : (
        <div className={EMBEDDED_PAIR_SHELL_CLASS}>
            <div className="flex min-h-0 min-w-0 w-full max-h-[min(78vh,740px)] flex-1 flex-col overflow-hidden lg:max-h-[min(82vh,760px)] lg:flex-row lg:items-stretch">
                {!hideModePicker ? modePickerColumn : null}
                {infoAndActionsColumn}
            </div>
        </div>
    );

    const windowTitle =
        variant === 'strategic_arena'
            ? t('rankedMatch.titleStrategic')
            : variant === 'duo_arena'
              ? t('rankedMatch.titleDuo')
              : t('rankedMatch.titlePet');
    const windowId =
        variant === 'strategic_arena'
            ? 'strategic-arena-ranked-match-mode'
            : variant === 'duo_arena'
              ? 'duo-arena-ranked-match-mode'
              : 'pair-pet-ranked-match-mode';

    const rankedModalTitleId = `${windowId}-title`;

    const roomCreateStyleSheetClass = `relative flex w-full min-h-0 min-w-0 flex-col overflow-hidden border border-amber-400/40 bg-gradient-to-b from-zinc-900 to-black shadow-2xl shadow-black/60 ring-1 ring-white/10 ${
        isHandheld
            ? 'h-dvh max-h-dvh min-h-dvh w-full max-w-none flex-1 rounded-none border-0 ring-0'
            : 'max-h-[min(96vh,960px)] max-w-[min(98vw,58rem)] rounded-2xl'
    }`;

    return createPortal(
        <div
            className={isHandheld ? LOBBY_ROOM_CREATE_BACKDROP_HANDHELD_CLASS : LOBBY_ROOM_CREATE_BACKDROP_DESKTOP_CLASS}
            role="presentation"
            onClick={() => !isBusy && onClose()}
        >
            <div
                className={roomCreateStyleSheetClass}
                role="dialog"
                aria-modal
                aria-labelledby={rankedModalTitleId}
                data-ranked-match-mode-sheet={windowId}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isBusy) onClose();
                    }}
                    className={LOBBY_ROOM_CREATE_CLOSE_BTN_CLASS}
                >
                    {tCommon('actions.close')}
                </button>
                <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
                        isHandheld
                            ? 'px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]'
                            : 'px-4 pb-4 pt-4'
                    }`}
                >
                    <div
                        className={`grid shrink-0 grid-cols-[minmax(2.75rem,auto)_1fr_minmax(2.75rem,auto)] items-center gap-x-1 ${
                            isHandheld ? 'px-0 pt-0.5' : 'px-1 pt-1'
                        }`}
                    >
                        <div className="flex min-w-0 justify-start">{mobileHeaderBack ?? null}</div>
                        <h2
                            id={rankedModalTitleId}
                            className={`min-w-0 text-center font-extrabold leading-snug text-amber-100 ${
                                isHandheld ? 'text-sm' : 'text-base sm:text-[17px]'
                            }`}
                        >
                            {windowTitle}
                        </h2>
                        <span className="min-w-[2.75rem] shrink-0" aria-hidden />
                    </div>
                    <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{body}</div>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default PairPetRankedMatchModeModal;
