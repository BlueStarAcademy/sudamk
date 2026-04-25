import React, { useMemo, useState } from 'react';
import { SinglePlayerLevel, UserWithStatus } from '../../types.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { CONSUMABLE_ITEMS } from '../../constants/index.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { isOnboardingTutorialActive } from '../../shared/constants/onboardingTutorial.js';
import {
    isSinglePlayerStageCleared,
    isSinglePlayerStageUnlocked,
    reconcileSinglePlayerProgress,
} from '../../shared/utils/singlePlayerProgress.js';
import SinglePlayerRewardsModal from './SinglePlayerRewardsModal.js';

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
    const { handlers } = useAppContext();
    const [rewardsModalOpen, setRewardsModalOpen] = useState(false);

    // 선택된 단계의 스테이지들 필터링
    const stages = useMemo(() => {
        return SINGLE_PLAYER_STAGES
            .filter(stage => stage.level === selectedClass)
            .sort((a, b) => {
                // 스테이지 번호로 정렬 (예: 입문-1, 입문-2, ...)
                const aNum = parseInt(a.id.split('-')[1]);
                const bNum = parseInt(b.id.split('-')[1]);
                return aNum - bNum;
            });
    }, [selectedClass]);

    const progress = useMemo(() => {
        return reconcileSinglePlayerProgress(
            SINGLE_PLAYER_STAGES,
            (currentUser as any).clearedSinglePlayerStages,
            (currentUser as any).singlePlayerProgress
        );
    }, [currentUser]);

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
        return isSinglePlayerStageCleared(SINGLE_PLAYER_STAGES, progress, stageId);
    };

    const isStageLocked = (stageIndex: number) => {
        // 관리자는 모든 스테이지에 접근 가능
        if (currentUser.isAdmin) return false;
        
        const stage = stages[stageIndex];
        return !isSinglePlayerStageUnlocked(SINGLE_PLAYER_STAGES, progress, stage.id);
    };

    // 스테이지의 게임 모드 이름 결정 (살리기 바둑과 따내기 바둑 구분)
    const getStageGameModeName = (stage: typeof stages[0]): string => {
        if (stage.hiddenCount !== undefined) {
            return '히든 바둑';
        } else if (stage.missileCount !== undefined) {
            return '미사일 바둑';
        } else if (stage.autoScoringTurns !== undefined) {
            // 자동 계가 턴 수가 있으면 스피드 바둑 (초급반 등)
            return '스피드 바둑';
        } else if (stage.blackTurnLimit !== undefined) {
            return '따내기 바둑';
        } else if (stage.survivalTurns !== undefined) {
            return '살리기 바둑';
        } else if (stage.timeControl.type === 'fischer') {
            return '스피드 바둑';
        } else {
            return '정통 바둑';
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
            const g = getGlobalStageIndex(s.id);
            const done = clearedStages.includes(s.id) || (g >= 0 && singlePlayerProgress > g);
            if (done) cleared += 1;
        }
        return { cleared, total, pct: Math.round((cleared / total) * 100) };
    }, [stages, clearedStages, singlePlayerProgress]);
    
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
                <div className="mb-3 flex flex-shrink-0 flex-col gap-1.5 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/35 via-zinc-900/45 to-amber-950/25 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-tight text-slate-200/95">
                        <span className="text-emerald-100/90">{classLabel} 클리어</span>
                        <span className="tabular-nums text-amber-100/95">
                            {classStageProgress.cleared} / {classStageProgress.total}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/45">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.35)] transition-all duration-500"
                            style={{ width: `${classStageProgress.pct}%` }}
                        />
                    </div>
                    <p className="text-[10px] leading-snug text-slate-400/90">
                        카드를 눌러 입장 · 잠긴 스테이지는 이전 단계를 먼저 클리어하세요.
                    </p>
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
                                                : `cursor-pointer ring-1 ${usePremiumDesktop ? 'ring-emerald-400/55 hover:shadow-[0_0_22px_rgba(52,211,153,0.22)]' : 'ring-green-500/70'} hover:scale-[1.02]`
                                            : tutorialBlockStage1Enter
                                              ? ''
                                              : `cursor-pointer hover:scale-[1.03] ${usePremiumDesktop ? 'hover:shadow-[0_12px_28px_-12px_rgba(245,158,11,0.25)]' : 'hover:shadow-md'}`
                                    }
                                `}
                                onClick={() =>
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
                                        <div
                                            className={`truncate text-center font-semibold tracking-tight text-amber-100/95 ${tabShelf ? 'text-sm' : isMobile ? 'text-xs' : usePremiumDesktop ? 'text-[11px]' : 'text-xs sm:text-sm'}`}
                                        >
                                            {gameModeName}
                                        </div>
                                    </div>
                                </div>

                                {isCleared && (
                                    <div className={`text-green-400 font-semibold mb-1 ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                        클리어 완료
                                    </div>
                                )}

                                {/* 보상 표시: 가로 한 줄 우선, 공간 부족 시 자동으로 작은 폰트 */}
                                <div className="w-full mb-1.5 min-w-0">
                                    {isCleared ? (
                                        <div className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden text-[clamp(8px,0.62vw,12px)] text-gray-300">
                                            {stage.rewards.repeatClear.gold > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    <img src="/images/icon/Gold.png" alt="골드" className="w-3.5 h-3.5" />
                                                    <span className="truncate">+{stage.rewards.repeatClear.gold}</span>
                                                </span>
                                            )}
                                            {stage.rewards.repeatClear.exp > 0 && (
                                                <span className="truncate">+{stage.rewards.repeatClear.exp} XP</span>
                                            )}
                                            {stage.rewards.repeatClear.items && stage.rewards.repeatClear.items.length > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    {stage.rewards.repeatClear.items.slice(0, 3).map((item, idx) => {
                                                        const itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === item.itemId);
                                                        return itemTemplate ? (
                                                            <img key={idx} src={itemTemplate.image} alt={item.itemId} className="w-3.5 h-3.5" title={item.itemId} />
                                                        ) : null;
                                                    })}
                                                    {stage.rewards.repeatClear.items.length > 3 && <span>…</span>}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden font-semibold text-[clamp(8px,0.65vw,13px)] text-amber-200/95">
                                            {stage.rewards.firstClear.gold > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    <img src="/images/icon/Gold.png" alt="골드" className="w-3.5 h-3.5" />
                                                    <span className="truncate">+{stage.rewards.firstClear.gold}</span>
                                                </span>
                                            )}
                                            {stage.rewards.firstClear.exp > 0 && (
                                                <span className="truncate">+{stage.rewards.firstClear.exp} XP</span>
                                            )}
                                            {stage.rewards.firstClear.items && stage.rewards.firstClear.items.length > 0 && (
                                                <span className="flex min-w-0 items-center gap-0.5">
                                                    {stage.rewards.firstClear.items.slice(0, 3).map((item, idx) => {
                                                        const itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === item.itemId);
                                                        return itemTemplate ? (
                                                            <img key={idx} src={itemTemplate.image} alt={item.itemId} className="w-3.5 h-3.5" title={item.itemId} />
                                                        ) : null;
                                                    })}
                                                    {stage.rewards.firstClear.items.length > 3 && <span>…</span>}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

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
                                    <div className={`mt-auto text-gray-400 text-center ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                        이전 스테이지 클리어 필요
                                    </div>
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

