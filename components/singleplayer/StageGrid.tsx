import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode, SinglePlayerLevel, UserWithStatus } from '../../types.js';
import { getSinglePlayerStages } from '../../constants/singlePlayerConstants.js';
import { CONSUMABLE_ITEMS } from '../../constants/index.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    isSinglePlayerStageCleared,
    isSinglePlayerStageUnlocked,
    reconcileSinglePlayerProgress,
} from '../../shared/utils/singlePlayerProgress.js';
import {
    inferSinglePlayerStrategicRulePreset,
    resolveSinglePlayerMixedModes,
} from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import SinglePlayerRewardsModal from './SinglePlayerRewardsModal.js';
import { translateGameMode } from '../../shared/i18n/runtimeText.js';

const CLASS_STAGE_KEYS: Record<SinglePlayerLevel, 'intro' | 'beginner' | 'intermediate' | 'advanced' | 'master'> = {
    [SinglePlayerLevel.입문]: 'intro',
    [SinglePlayerLevel.초급]: 'beginner',
    [SinglePlayerLevel.중급]: 'intermediate',
    [SinglePlayerLevel.고급]: 'advanced',
    [SinglePlayerLevel.유단자]: 'master',
};

const PRESET_TO_GAME_MODE: Partial<Record<string, GameMode>> = {
    classic: GameMode.Standard,
    capture: GameMode.Capture,
    speed: GameMode.Speed,
    base: GameMode.Base,
    hidden: GameMode.Hidden,
    missile: GameMode.Missile,
    mix: GameMode.Mix,
};

/** 싱글플레이 스테이지 입장: 앰버 메탈 + 글로우 (PC·모바일 공통) */
const PREMIUM_STAGE_ENTER_CLASS =
    'w-full mt-auto !rounded-xl !border !border-amber-300/55 !bg-gradient-to-b !from-amber-400/95 !via-amber-800 !to-amber-950 !py-2 !text-xs !font-bold !tracking-wide !text-amber-50 !shadow-[0_4px_22px_rgba(245,158,11,0.42),inset_0_1px_0_rgba(255,255,255,0.24)] hover:!brightness-110 active:!scale-[0.98] disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!grayscale disabled:hover:!brightness-100 transition-all duration-200 sm:!py-2.5 sm:!text-sm';

/** 좁은 카드(네이티브 대기실): 짧은 한 줄 라벨 + 잘림 방지 */
const PREMIUM_STAGE_ENTER_CLASS_COMPACT =
    `${PREMIUM_STAGE_ENTER_CLASS} !px-1 !py-2 !text-center !tracking-tight !text-[10px] !overflow-visible`;

const premiumStageEnterClass = (compact: boolean): string =>
    compact ? PREMIUM_STAGE_ENTER_CLASS_COMPACT : PREMIUM_STAGE_ENTER_CLASS;

interface StageGridProps {
    selectedClass: SinglePlayerLevel;
    currentUser: UserWithStatus;
    /** 네이티브 모바일 등 좁은 레이아웃 */
    compact?: boolean;
    /** 싱글플레이 로비 하단 탭 안: 글자·카드 살짝 키움 */
    mobileTabShelf?: boolean;
}

const StageGrid: React.FC<StageGridProps> = ({ selectedClass, currentUser, compact = false, mobileTabShelf = false }) => {
    const { t } = useTranslation(['lobby', 'common', 'profile']);
    const { handlers, singlePlayerStagesListRevision } = useAppContext();
    const [rewardsModalOpen, setRewardsModalOpen] = useState(false);

    // 선택된 단계의 스테이지들 필터링
    const stages = useMemo(() => {
        return getSinglePlayerStages()
            .filter(stage => stage.level === selectedClass)
            .sort((a, b) => {
                // 스테이지 번호로 정렬 (예: 입문-1, 입문-2, ...)
                const aNum = parseInt(a.id.split('-')[1]);
                const bNum = parseInt(b.id.split('-')[1]);
                return aNum - bNum;
            });
    }, [selectedClass, singlePlayerStagesListRevision]);

    const progress = useMemo(() => {
        return reconcileSinglePlayerProgress(
            getSinglePlayerStages(),
            (currentUser as any).clearedSinglePlayerStages,
            (currentUser as any).singlePlayerProgress
        );
    }, [currentUser, singlePlayerStagesListRevision]);

    const handleStageEnter = (stageId: string) => {
        console.log('[StageGrid] handleStageEnter called with stageId:', stageId);
        if (!handlers || !handlers.handleAction) {
            console.error('[StageGrid] handlers or handleAction is undefined');
            return;
        }
        try {
            handlers.handleAction({
                type: 'START_SINGLE_PLAYER_GAME',
                payload: { stageId }
            }).then(result => {
                console.log('[StageGrid] handleAction completed:', result);
            }).catch(err => {
                console.error('[StageGrid] handleAction failed:', err);
            });
        } catch (err) {
            console.error('[StageGrid] handleAction exception:', err);
        }
    };

    const isStageCleared = (stageId: string) => {
        return isSinglePlayerStageCleared(getSinglePlayerStages(), progress, stageId);
    };

    const isStageLocked = (stageIndex: number) => {
        // 관리자는 모든 스테이지에 접근 가능
        if (currentUser.isAdmin) return false;
        
        const stage = stages[stageIndex];
        return !isSinglePlayerStageUnlocked(getSinglePlayerStages(), progress, stage.id);
    };

    const getStageGameModeName = (stage: typeof stages[0]): string => {
        const preset = inferSinglePlayerStrategicRulePreset(stage);
        if (preset === 'survival') {
            return t('singleplayer.rulePresets.survival');
        }
        const mode = PRESET_TO_GAME_MODE[preset];
        return mode ? translateGameMode(mode) : translateGameMode(GameMode.Standard);
    };

    const isMobile = compact;
    const tabShelf = isMobile && mobileTabShelf;
    /** PC 바둑학원 대기실: 스테이지 맵을 더 읽기 쉽게 */
    const usePremiumDesktop = !isMobile && !tabShelf;

    const classLabel = t(`profile:stageLabels.${CLASS_STAGE_KEYS[selectedClass]}`);

    return (
        <div
            className={`relative flex h-full min-h-0 flex-col overflow-hidden shadow-lg ${
                usePremiumDesktop
                    ? 'rounded-xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ring-1 ring-white/[0.06]'
                    : 'rounded-lg bg-panel'
            } ${tabShelf ? 'p-1.5' : isMobile ? 'p-2.5' : usePremiumDesktop ? 'p-4 sm:p-5' : 'p-4'}`}
        >
            <div
                className={`flex flex-shrink-0 items-start justify-between gap-1.5 border-b border-color ${tabShelf ? 'mb-1 pb-0.5' : isMobile ? 'mb-2 pb-1' : 'mb-4 pb-2'}`}
            >
                <h2
                    className={`font-bold text-on-panel min-w-0 flex-1 leading-tight ${tabShelf ? 'text-base' : isMobile ? 'text-lg' : 'text-xl'}`}
                >
                    {t('singleplayer.stageListTitle', { classLabel })}
                </h2>
                <button
                    type="button"
                    onClick={() => setRewardsModalOpen(true)}
                    className={`flex-shrink-0 rounded-md border border-amber-400/45 bg-gradient-to-b from-amber-500/25 via-amber-900/35 to-amber-950/50 font-bold text-amber-100 shadow-[0_2px_12px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 active:scale-[0.98] transition-all sm:rounded-lg ${tabShelf ? 'px-1.5 py-0.5 text-[10px]' : isMobile ? 'px-2 py-1 text-xs' : 'px-2 py-1 text-xs sm:px-2.5 sm:py-1.5 sm:text-sm'}`}
                    aria-label={t('singleplayer.openRewardsTableAria')}
                >
                    {t('singleplayer.rewardsTable')}
                </button>
            </div>

            <SinglePlayerRewardsModal
                open={rewardsModalOpen}
                onClose={() => setRewardsModalOpen(false)}
                initialClass={selectedClass}
            />
            
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1.5 pr-0.5 pt-1.5 pl-1.5 -mr-0.5 ${tabShelf ? '' : isMobile ? 'sm:pt-2 sm:pl-2' : 'sm:pt-2.5 sm:pl-2.5'}`}
            >
                <div
                    className={`grid min-w-0 pb-0.5 ${tabShelf ? 'gap-1.5' : isMobile ? 'gap-2' : 'gap-2.5'}`}
                    style={{
                        gridTemplateColumns: tabShelf
                            ? 'repeat(auto-fill, minmax(100px, 1fr))'
                            : isMobile
                              ? 'repeat(auto-fill, minmax(108px, 1fr))'
                              : 'repeat(auto-fill, minmax(140px, 1fr))',
                        gridAutoRows: tabShelf
                            ? 'minmax(148px, auto)'
                            : isMobile
                              ? 'minmax(158px, auto)'
                              : 'minmax(180px, auto)'
                    }}
                >
                    {stages.map((stage, index) => {
                        const isCleared = isStageCleared(stage.id);
                        const isLocked = isStageLocked(index);
                        const stageNumber = parseInt(stage.id.split('-')[1]);
                        const gameModeName = getStageGameModeName(stage);
                        const stagePreset = inferSinglePlayerStrategicRulePreset(stage);
                        const mixedModeLabels =
                            stagePreset === 'mix'
                                ? resolveSinglePlayerMixedModes(stage).map((mode) => translateGameMode(mode))
                                : [];
                        const effectiveActionPointCost = isCleared ? 0 : stage.actionPointCost;
                        const hasEnoughAP = currentUser.actionPoints.current >= effectiveActionPointCost;

                        const cardSurface = usePremiumDesktop
                            ? 'relative flex min-h-0 min-w-0 flex-col items-center justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-zinc-800/95 via-zinc-900 to-black/95 px-2.5 py-3 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.06]'
                            : tabShelf
                              ? 'relative flex min-h-0 min-w-0 flex-col items-center justify-between overflow-hidden rounded-md border border-color/40 bg-tertiary/90 px-1.5 py-2'
                              : 'relative flex min-h-0 min-w-0 flex-col items-center justify-between overflow-hidden rounded-lg border border-color/40 bg-tertiary/90 px-2.5 py-3';

                        return (
                            <div
                                key={stage.id}
                                className={`
                                    ${cardSurface}
                                    transition-transform duration-150
                                    ${isLocked 
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isCleared
                                            ? `${usePremiumDesktop ? '' : 'cursor-pointer '}ring-1 ${usePremiumDesktop ? 'ring-emerald-400/55' : 'ring-green-500/70'} ${usePremiumDesktop ? '' : 'hover:scale-[1.02] hover:shadow-[0_0_22px_rgba(52,211,153,0.22)]'}`
                                            : `${usePremiumDesktop ? '' : 'cursor-pointer hover:scale-[1.03] hover:shadow-md'} ${usePremiumDesktop ? '' : 'hover:shadow-[0_12px_28px_-12px_rgba(245,158,11,0.25)]'}`
                                    }
                                `}
                                onClick={() =>
                                    !usePremiumDesktop &&
                                    !isLocked &&
                                    handleStageEnter(stage.id)
                                }
                            >
                                {isLocked && (
                                    <div
                                        className={`absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-black/55 to-black/80 ${usePremiumDesktop ? 'rounded-2xl' : 'rounded-lg'}`}
                                    >
                                        <span
                                            className={`font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${tabShelf ? 'text-lg' : 'text-2xl'}`}
                                        >
                                            🔒
                                        </span>
                                    </div>
                                )}

                                {isCleared && (
                                    <div
                                        className={`absolute right-1 top-1 z-20 flex items-center justify-center rounded-full bg-green-500/90 font-bold text-white shadow ${tabShelf ? 'h-4 w-4 text-[9px]' : 'top-1.5 h-5 w-5 text-[11px]'}`}
                                    >
                                        ✓
                                    </div>
                                )}

                                <div className={`mb-1 w-full text-center ${usePremiumDesktop ? 'mt-0.5' : ''}`}>
                                    {usePremiumDesktop ? (
                                        <div className="flex w-full justify-center">
                                            <div
                                                className={`relative flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border-2 bg-gradient-to-b shadow-[0_6px_18px_-8px_rgba(0,0,0,0.75)] ${
                                                    isCleared
                                                        ? 'border-emerald-400/70 from-emerald-800/50 to-black/80'
                                                        : 'border-amber-400/50 from-amber-900/45 to-black/85'
                                                }`}
                                            >
                                                <span className="font-black tabular-nums text-[1.35rem] leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                                                    {stageNumber}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`font-black text-primary drop-shadow [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] ${tabShelf ? 'text-lg' : isMobile ? 'text-2xl' : 'text-2xl sm:text-3xl'}`}
                                        >
                                            {stageNumber}
                                        </div>
                                    )}
                                </div>

                                <div className="mb-1.5 w-full">
                                    <div
                                        className={`shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                                            usePremiumDesktop
                                                ? 'rounded-full border border-amber-400/40 bg-black/35 px-2.5 py-1'
                                                : 'rounded-md border border-amber-500/35 bg-gradient-to-b from-gray-700/85 to-gray-800/90 px-2 py-1'
                                        }`}
                                    >
                                        {stagePreset === 'mix' ? (
                                            <div className="flex flex-wrap items-center justify-center gap-1">
                                                {mixedModeLabels.map((label, i) => (
                                                    <span
                                                        key={`${stage.id}-mix-mode-${i}-${label}`}
                                                        className={`inline-flex items-center justify-center rounded-sm border border-amber-300/45 bg-black/35 px-1 py-0.5 font-semibold text-amber-100/95 ${
                                                            tabShelf
                                                                ? 'text-[9px]'
                                                                : isMobile
                                                                  ? 'text-[10px]'
                                                                  : usePremiumDesktop
                                                                    ? 'text-[10px]'
                                                                    : 'text-[11px]'
                                                        }`}
                                                    >
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div
                                                className={`truncate text-center font-semibold tracking-tight text-amber-100/95 ${tabShelf ? 'text-[11px]' : isMobile ? 'text-xs' : usePremiumDesktop ? 'text-[11px]' : 'text-xs sm:text-sm'}`}
                                            >
                                                {gameModeName}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isCleared && (
                                    <div
                                        className={`mb-0.5 font-semibold text-green-400 ${tabShelf ? 'text-[9px]' : isMobile ? 'text-xs' : 'text-[10px]'}`}
                                    >
                                        {t('singleplayer.cleared')}
                                    </div>
                                )}

                                {/* 최초 클리어 보상만 표시(이미 클리어한 스테이지는 재클리어 보상 없음) */}
                                {!isCleared && (
                                    <div className={`mb-1 w-full min-w-0 ${tabShelf ? 'mb-0.5' : ''}`}>
                                        <div
                                            className={`flex w-full items-center justify-center gap-1 overflow-hidden whitespace-nowrap font-semibold text-amber-200/95 ${tabShelf ? 'text-[9px]' : 'text-[clamp(8px,0.65vw,13px)]'}`}
                                        >
                                            {stage.rewards.firstClear.gold > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    <img
                                                        src="/images/icon/Gold.webp"
                                                        alt={t('common:resources.gold')}
                                                        className={tabShelf ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                                                    />
                                                    <span className="truncate">+{stage.rewards.firstClear.gold}</span>
                                                </span>
                                            )}
                                            {stage.rewards.firstClear.exp > 0 && (
                                                <span className="truncate">+{stage.rewards.firstClear.exp} XP</span>
                                            )}
                                            {stage.rewards.firstClear.items && stage.rewards.firstClear.items.length > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    {stage.rewards.firstClear.items.slice(0, 3).map((item, idx) => {
                                                        const itemTemplate = CONSUMABLE_ITEMS.find((i) => i.name === item.itemId);
                                                        return itemTemplate ? (
                                                            <img
                                                                key={idx}
                                                                src={itemTemplate.image}
                                                                alt={item.itemId}
                                                                className={tabShelf ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                                                                title={item.itemId}
                                                            />
                                                        ) : null;
                                                    })}
                                                    {stage.rewards.firstClear.items.length > 3 && <span>…</span>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {!isLocked ? (
                                    <Button
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            handleStageEnter(stage.id);
                                        }}
                                        colorScheme="none"
                                        className={premiumStageEnterClass(isMobile)}
                                        disabled={!hasEnoughAP}
                                        title={t('singleplayer.enterStageTitle', { cost: effectiveActionPointCost })}
                                        style={
                                            tabShelf
                                                ? { fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em' }
                                                : isMobile
                                                  ? { fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em' }
                                                  : undefined
                                        }
                                    >
                                        {t('singleplayer.enterStage', { cost: effectiveActionPointCost })}
                                    </Button>
                                ) : (
                                    <div className="mt-auto min-h-[1.25rem]" aria-hidden />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default StageGrid;

