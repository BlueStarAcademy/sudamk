import React, { useMemo, useState } from 'react';
import { GameMode, SinglePlayerLevel, UserWithStatus } from '../../types.js';
import { getSinglePlayerStages, SINGLE_PLAYER_CLASS_BAR_REWARDS } from '../../constants/singlePlayerConstants.js';
import { CONSUMABLE_ITEMS } from '../../constants/index.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { isOnboardingTutorialActive } from '../../shared/constants/onboardingTutorial.js';
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
import { getItemTemplateByName } from '../../utils/itemTemplateLookup.js';

const resolveClassBarItemImageSrc = (itemId: string): string => {
    const t = getItemTemplateByName(itemId);
    const raw = (t as { image?: string } | null)?.image;
    if (!raw) return '/images/Box/box.png';
    return raw.startsWith('/') ? raw : `/${raw}`;
};

const classBarApBadge = (itemId: string): string | null => {
    if (itemId === '행동력 회복제(+10)') return '+10';
    if (itemId === '행동력 회복제(+20)') return '+20';
    if (itemId === '행동력 회복제(+30)') return '+30';
    const m = itemId.match(/행동력\s*회복제\s*\(\+(\d+)\)/);
    return m ? `+${m[1]}` : null;
};

/** 싱글플레이 스테이지 입장: 앰버 메탈 + 글로우 (PC·모바일 공통) */
const PREMIUM_STAGE_ENTER_CLASS =
    'w-full mt-auto !rounded-xl !border !border-amber-300/55 !bg-gradient-to-b !from-amber-400/95 !via-amber-800 !to-amber-950 !py-2 !text-xs !font-bold !tracking-wide !text-amber-50 !shadow-[0_4px_22px_rgba(245,158,11,0.42),inset_0_1px_0_rgba(255,255,255,0.24)] hover:!brightness-110 active:!scale-[0.98] disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!grayscale disabled:hover:!brightness-100 transition-all duration-200 sm:!py-2.5 sm:!text-sm';

/** 좁은 카드(네이티브 대기실): 짧은 한 줄 라벨 + 잘림 방지 */
const PREMIUM_STAGE_ENTER_CLASS_COMPACT =
    `${PREMIUM_STAGE_ENTER_CLASS} !px-1 !py-2 !text-center !tracking-tight !text-[10px] !overflow-visible`;

/** 페이즈2 온보딩 등: disabled여도 앰버 입장 버튼 색 유지(클릭만 막음) */
const premiumStageEnterClass = (compact: boolean, stripDisabledVisual: boolean): string => {
    const raw = compact ? PREMIUM_STAGE_ENTER_CLASS_COMPACT : PREMIUM_STAGE_ENTER_CLASS;
    if (!stripDisabledVisual) return raw;
    return raw
        .replace(/\s*disabled:!cursor-not-allowed/g, '')
        .replace(/\s*disabled:!opacity-45/g, '')
        .replace(/\s*disabled:!grayscale/g, '')
        .replace(/\s*disabled:hover:!brightness-100/g, '');
};

interface StageGridProps {
    selectedClass: SinglePlayerLevel;
    currentUser: UserWithStatus;
    /** 네이티브 모바일 등 좁은 레이아웃 */
    compact?: boolean;
    /** 싱글플레이 로비 하단 탭 안: 글자·카드 살짝 키움 */
    mobileTabShelf?: boolean;
}

const StageGrid: React.FC<StageGridProps> = ({ selectedClass, currentUser, compact = false, mobileTabShelf = false }) => {
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

    const GAME_MODE_LABELS: Record<GameMode, string> = {
        [GameMode.Standard]: '클래식',
        [GameMode.Speed]: '스피드',
        [GameMode.Capture]: '따내기',
        [GameMode.Hidden]: '히든',
        [GameMode.Missile]: '미사일',
        [GameMode.Base]: '베이스',
        [GameMode.Mix]: '믹스',
        [GameMode.Dice]: '주사위',
        [GameMode.Omok]: '오목',
        [GameMode.Ttamok]: '따목',
        [GameMode.Thief]: '도둑·경찰',
        [GameMode.Alkkagi]: '알까기',
        [GameMode.Curling]: '컬링',
    };

    // 스테이지 프리셋(명시/auto 추론) 기준으로 대기실 모드명을 표시
    const getStageGameModeName = (stage: typeof stages[0]): string => {
        const preset = inferSinglePlayerStrategicRulePreset(stage);
        switch (preset) {
            case 'classic':
                return '클래식';
            case 'capture':
                return '따내기';
            case 'survival':
                return '살리기';
            case 'speed':
                return '스피드';
            case 'base':
                return '베이스';
            case 'hidden':
                return '히든';
            case 'missile':
                return '미사일';
            case 'mix':
                return '믹스';
            default:
                return '클래식';
        }
    };

    const isMobile = compact;
    const tabShelf = isMobile && mobileTabShelf;
    /** PC 바둑학원 대기실: 스테이지 맵을 더 읽기 쉽게 */
    const usePremiumDesktop = !isMobile && !tabShelf;

    const classStageProgress = useMemo(() => {
        const total = stages.length;
        if (total === 0) return { cleared: 0, total: 0, pct: 0 };
        let cleared = 0;
        for (const s of stages) {
            if (isStageCleared(s.id)) cleared += 1;
        }
        return { cleared, total, pct: Math.round((cleared / total) * 100) };
    }, [stages, progress]);

    const classBarConfig = SINGLE_PLAYER_CLASS_BAR_REWARDS[selectedClass];
    const barClaimsRaw = (currentUser as { singlePlayerClassBarClaims?: Partial<Record<SinglePlayerLevel, { m10?: boolean; m20?: boolean }>> })
        .singlePlayerClassBarClaims;
    const barClaims = barClaimsRaw?.[selectedClass] ?? {};
    const barThresholds = [10, 20] as const;
    const barMax = 20;
    const barDisplayCleared = Math.min(classStageProgress.cleared, barMax);
    const barFillPct = barMax > 0 ? (barDisplayCleared / barMax) * 100 : 0;
    /** 막대의 10·20 클리어 지점(50%·100%)에 보상을 정렬 */
    const classBarRewardMarkStyle = (milestone: 10 | 20): React.CSSProperties => {
        const pct = barMax > 0 ? (milestone / barMax) * 100 : 0;
        if (pct >= 100) return { left: '100%', transform: 'translateX(-100%)' };
        return { left: `${pct}%`, transform: 'translateX(-50%)' };
    };
    const handleClaimClassBar = (milestone: 10 | 20) => {
        if (!handlers?.handleAction) return;
        void handlers.handleAction({ type: 'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD', payload: { level: selectedClass, milestone } });
    };
    
    const classLabel =
        selectedClass === SinglePlayerLevel.입문
            ? '입문반'
            : selectedClass === SinglePlayerLevel.초급
              ? '초급반'
              : selectedClass === SinglePlayerLevel.중급
                ? '중급반'
                : selectedClass === SinglePlayerLevel.고급
                  ? '고급반'
                  : '유단자';

    return (
        <div
            className={`relative flex h-full min-h-0 flex-col overflow-hidden shadow-lg ${
                usePremiumDesktop
                    ? 'rounded-xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ring-1 ring-white/[0.06]'
                    : 'rounded-lg bg-panel'
            } ${tabShelf ? 'p-2.5' : isMobile ? 'p-2.5' : usePremiumDesktop ? 'p-4 sm:p-5' : 'p-4'}`}
        >
            <div
                className={`flex flex-shrink-0 items-start justify-between gap-2 border-b border-color ${tabShelf ? 'mb-1.5 pb-1' : isMobile ? 'mb-2 pb-1' : 'mb-4 pb-2'}`}
            >
                <h2
                    className={`font-bold text-on-panel min-w-0 flex-1 leading-tight ${tabShelf ? 'text-xl' : isMobile ? 'text-lg' : 'text-xl'}`}
                >
                    {classLabel} 스테이지
                </h2>
                <button
                    type="button"
                    onClick={() => setRewardsModalOpen(true)}
                    className={`flex-shrink-0 rounded-lg border border-amber-400/45 bg-gradient-to-b from-amber-500/25 via-amber-900/35 to-amber-950/50 px-2 py-1 font-bold text-amber-100 shadow-[0_2px_12px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 active:scale-[0.98] transition-all sm:px-2.5 sm:py-1.5 ${tabShelf ? 'text-sm' : isMobile ? 'text-xs' : 'text-xs sm:text-sm'}`}
                    aria-label="스테이지 클리어 보상표 열기"
                >
                    보상표
                </button>
            </div>

            {usePremiumDesktop && (
                <div className="mb-2 flex flex-shrink-0 flex-col gap-1 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/35 via-zinc-900/45 to-amber-950/25 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-tight text-slate-200/95">
                        <span className="text-emerald-100/90">{classLabel} 스테이지 클리어</span>
                        <span className="tabular-nums text-amber-100/95">
                            {classStageProgress.cleared} / {classStageProgress.total}
                        </span>
                    </div>
                    <div className="flex flex-col gap-0">
                        <div className="relative w-full rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-500/20 to-teal-500/25 p-[3px] shadow-[0_0_20px_-8px_rgba(52,211,153,0.35)]">
                            <div className="relative h-5 w-full overflow-hidden rounded-full border border-slate-700/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)]">
                                {/* 0~10 / 10~20 구간 배경 */}
                                <div className="pointer-events-none absolute inset-0 z-0 flex">
                                    <div className="h-full w-1/2 border-r border-white/25 bg-slate-950/80" />
                                    <div className="h-full w-1/2 bg-slate-900/75" />
                                </div>
                                <div
                                    className="absolute inset-y-0 left-0 z-[1] overflow-hidden rounded-full shadow-[0_0_14px_rgba(52,211,153,0.22)] transition-all duration-500"
                                    style={{ width: `${Math.min(100, barFillPct)}%` }}
                                >
                                    <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />
                                    <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.18] to-transparent" />
                                </div>
                                {/* 10·20점 경계(50% / 100%) 세로 눈금 */}
                                {(
                                    [
                                        { milestone: 10 as const, pct: 50 },
                                        { milestone: 20 as const, pct: 100 },
                                    ] as const
                                ).map(({ milestone, pct }) => {
                                    const progressMet = classStageProgress.cleared >= milestone;
                                    const isClaimed = milestone === 10 ? !!barClaims.m10 : !!barClaims.m20;
                                    const posStyle =
                                        pct >= 100
                                            ? ({ left: '100%', transform: 'translateX(-100%)' } as const)
                                            : ({ left: `${pct}%`, transform: 'translateX(-50%)' } as const);
                                    return (
                                        <div
                                            key={`seg-tick-${milestone}`}
                                            className="pointer-events-none absolute bottom-0 top-0 z-[2]"
                                            style={posStyle}
                                        >
                                            <div
                                                className={`h-full w-[2px] ${
                                                    isClaimed ? 'bg-emerald-300/95' : progressMet ? 'bg-amber-300/90' : 'bg-slate-200/55'
                                                }`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-between px-0.5 pt-0 text-[9px] font-bold tabular-nums leading-none text-slate-500">
                            <span className="w-4 text-left text-slate-400">0</span>
                            <span className="flex-1 text-center text-slate-400">10</span>
                            <span className="w-4 text-right text-slate-400">20</span>
                        </div>
                        <div className="relative h-9 w-full">
                            {barThresholds.map((milestone) => {
                                const itemDef = milestone === 10 ? classBarConfig.milestone10 : classBarConfig.milestone20;
                                const progressMet = classStageProgress.cleared >= milestone;
                                const isClaimed = milestone === 10 ? !!barClaims.m10 : !!barClaims.m20;
                                const canClaim = progressMet && !isClaimed;
                                const apBadge = classBarApBadge(itemDef.itemId);
                                const itemSrc = apBadge ? null : resolveClassBarItemImageSrc(itemDef.itemId);
                                return (
                                    <div
                                        key={`bar-mile-${milestone}`}
                                        className="absolute top-0 flex flex-col items-center"
                                        style={classBarRewardMarkStyle(milestone)}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => canClaim && handleClaimClassBar(milestone)}
                                            disabled={!canClaim}
                                            className={`relative h-7 w-7 rounded-md border border-slate-500/35 bg-gradient-to-b from-slate-800/90 to-slate-950/90 p-0.5 shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed ${
                                                canClaim ? 'ring-1 ring-amber-400/40 shadow-[0_0_16px_-6px_rgba(251,191,36,0.55)]' : ''
                                            }`}
                                            title={isClaimed ? '수령 완료' : progressMet ? '보상 수령' : `${milestone} 스테이지 클리어 필요`}
                                        >
                                            <div
                                                className={`relative h-full w-full rounded-sm ${!progressMet && !isClaimed ? 'opacity-45 grayscale' : ''}`}
                                                aria-label={`${milestone}점 보상`}
                                            >
                                                {apBadge ? (
                                                    <span
                                                        className="flex h-full w-full items-center justify-center text-[1.35rem] leading-none drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)]"
                                                        aria-hidden
                                                    >
                                                        ⚡
                                                    </span>
                                                ) : (
                                                    <img src={itemSrc ?? '/images/Box/box.png'} alt="" className="h-full w-full object-contain p-0.5" />
                                                )}
                                                {apBadge ? (
                                                    <span className="absolute right-0 top-0 rounded-bl bg-gray-900/90 px-0.5 text-[9px] font-bold leading-tight text-cyan-300 shadow-md">
                                                        {apBadge}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {isClaimed && (
                                                <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/65 text-xs text-emerald-400">
                                                    ✓
                                                </div>
                                            )}
                                        </button>
                                        <span
                                            className={`mt-0 font-bold tabular-nums leading-none ${
                                                progressMet ? 'text-amber-200' : 'text-slate-500'
                                            } text-[10px]`}
                                        >
                                            {milestone}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <SinglePlayerRewardsModal
                open={rewardsModalOpen}
                onClose={() => setRewardsModalOpen(false)}
                initialClass={selectedClass}
            />
            
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 pr-1 pt-2 pl-2 -mr-1 ${tabShelf ? 'sm:pt-2 sm:pl-2' : isMobile ? 'sm:pt-2 sm:pl-2' : 'sm:pt-2.5 sm:pl-2.5'}`}
            >
                <div
                    className={`grid min-w-0 pb-1 ${tabShelf ? 'gap-2.5' : isMobile ? 'gap-2' : 'gap-2.5'}`}
                    style={{
                        gridTemplateColumns: tabShelf
                            ? 'repeat(auto-fill, minmax(118px, 1fr))'
                            : isMobile
                              ? 'repeat(auto-fill, minmax(108px, 1fr))'
                              : 'repeat(auto-fill, minmax(140px, 1fr))',
                        gridAutoRows: tabShelf
                            ? 'minmax(180px, auto)'
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
                                ? resolveSinglePlayerMixedModes(stage).map((mode) => GAME_MODE_LABELS[mode] ?? mode)
                                : [];
                        const effectiveActionPointCost = isCleared ? 0 : stage.actionPointCost;
                        const hasEnoughAP = currentUser.actionPoints.current >= effectiveActionPointCost;
                        const spOnboardingPhase = currentUser.onboardingTutorialPhase ?? 0;
                        const tutorialStage1Spotlight =
                            isOnboardingTutorialActive(currentUser) &&
                            stage.id === '입문-1' &&
                            (spOnboardingPhase === 2 || spOnboardingPhase === 4);
                        const tutorialBlockStage1Enter =
                            tutorialStage1Spotlight && spOnboardingPhase === 2;
                        const tutorialInviteStage1Enter =
                            tutorialStage1Spotlight && spOnboardingPhase === 4;

                        const stage1OnboardingTargetAttrs = tutorialStage1Spotlight
                            ? ({ 'data-onboarding-target': 'onboarding-sp-stage-1' } as const)
                            : {};

                        const cardSurface = usePremiumDesktop
                            ? 'relative flex min-h-0 min-w-0 flex-col items-center justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-zinc-800/95 via-zinc-900 to-black/95 px-2.5 py-3 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.06]'
                            : 'relative bg-tertiary/90 rounded-lg border border-color/40 px-2.5 py-3 flex flex-col items-center justify-between min-h-0 min-w-0';

                        return (
                            <div
                                key={stage.id}
                                {...stage1OnboardingTargetAttrs}
                                className={`
                                    ${cardSurface}
                                    transition-transform duration-150
                                    ${tutorialBlockStage1Enter ? 'cursor-not-allowed z-[1]' : ''}
                                    ${tutorialBlockStage1Enter ? 'brightness-[1.18] saturate-110 shadow-[inset_0_0_0_2px_rgba(253,224,71,0.85),0_0_28px_6px_rgba(251,191,36,0.4)]' : ''}
                                    ${isLocked 
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isCleared
                                            ? tutorialBlockStage1Enter
                                                ? 'ring-1 ring-green-500/70'
                                                : `${usePremiumDesktop ? '' : 'cursor-pointer '}ring-1 ${usePremiumDesktop ? 'ring-emerald-400/55' : 'ring-green-500/70'} ${usePremiumDesktop ? '' : 'hover:scale-[1.02] hover:shadow-[0_0_22px_rgba(52,211,153,0.22)]'}`
                                            : tutorialBlockStage1Enter
                                              ? ''
                                              : `${usePremiumDesktop ? '' : 'cursor-pointer hover:scale-[1.03] hover:shadow-md'} ${usePremiumDesktop ? '' : 'hover:shadow-[0_12px_28px_-12px_rgba(245,158,11,0.25)]'}`
                                    }
                                `}
                                onClick={() =>
                                    !usePremiumDesktop &&
                                    !isLocked &&
                                    !tutorialBlockStage1Enter &&
                                    !tutorialInviteStage1Enter &&
                                    handleStageEnter(stage.id)
                                }
                            >
                                {tutorialBlockStage1Enter && (
                                    <div
                                        className={`pointer-events-auto absolute inset-0 z-[35] bg-transparent ${usePremiumDesktop ? 'rounded-2xl' : 'rounded-lg'}`}
                                        aria-hidden
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    />
                                )}
                                {isLocked && (
                                    <div
                                        className={`absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-black/55 to-black/80 ${usePremiumDesktop ? 'rounded-2xl' : 'rounded-lg'}`}
                                    >
                                        <span className="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">🔒</span>
                                    </div>
                                )}

                                {isCleared && (
                                    <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-5 h-5 flex items-center justify-center z-20 shadow text-[11px] font-bold text-white">
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
                                            className={`font-black text-primary drop-shadow [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] ${isMobile ? 'text-2xl' : 'text-2xl sm:text-3xl'}`}
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
                                                        className={`inline-flex items-center justify-center rounded-sm border border-amber-300/45 bg-black/35 px-1.5 py-0.5 font-semibold text-amber-100/95 ${
                                                            tabShelf
                                                                ? 'text-[11px]'
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
                                                className={`truncate text-center font-semibold tracking-tight text-amber-100/95 ${tabShelf ? 'text-sm' : isMobile ? 'text-xs' : usePremiumDesktop ? 'text-[11px]' : 'text-xs sm:text-sm'}`}
                                            >
                                                {gameModeName}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isCleared && (
                                    <div className={`text-green-400 font-semibold mb-1 ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                        클리어 완료
                                    </div>
                                )}

                                {/* 최초 클리어 보상만 표시(이미 클리어한 스테이지는 재클리어 보상 없음) */}
                                {!isCleared && (
                                    <div className="mb-1.5 w-full min-w-0">
                                        <div className="flex w-full items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap font-semibold text-[clamp(8px,0.65vw,13px)] text-amber-200/95">
                                            {stage.rewards.firstClear.gold > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    <img src="/images/icon/Gold.png" alt="골드" className="h-3.5 w-3.5" />
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
                                                            <img key={idx} src={itemTemplate.image} alt={item.itemId} className="h-3.5 w-3.5" title={item.itemId} />
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
                                            if (tutorialBlockStage1Enter) return;
                                            handleStageEnter(stage.id);
                                        }}
                                        colorScheme="none"
                                        disabledWithoutDim={tutorialBlockStage1Enter}
                                        className={`${premiumStageEnterClass(isMobile, tutorialBlockStage1Enter)}${
                                            tutorialStage1Spotlight && !tutorialBlockStage1Enter
                                                ? ' !brightness-125 !contrast-105 !ring-2 !ring-amber-200/95 !shadow-[0_0_32px_rgba(251,191,36,0.65),0_4px_22px_rgba(245,158,11,0.45)]'
                                                : ''
                                        }`}
                                        disabled={!hasEnoughAP || tutorialBlockStage1Enter}
                                        title={`입장 · 행동력 ${effectiveActionPointCost}`}
                                        style={
                                            tabShelf
                                                ? { fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em' }
                                                : isMobile
                                                  ? { fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em' }
                                                  : undefined
                                        }
                                    >
                                        {`입장 ⚡${effectiveActionPointCost}`}
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

