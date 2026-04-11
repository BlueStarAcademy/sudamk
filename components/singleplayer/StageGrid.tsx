import React, { useMemo, useState } from 'react';
import { SinglePlayerLevel, UserWithStatus } from '../../types.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { CONSUMABLE_ITEMS } from '../../constants/index.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import SinglePlayerRewardsModal from './SinglePlayerRewardsModal.js';

/** 싱글플레이 스테이지 입장: 앰버 메탈 + 글로우 (PC·모바일 공통) */
const PREMIUM_STAGE_ENTER_CLASS =
    'w-full mt-auto !rounded-xl !border !border-amber-300/55 !bg-gradient-to-b !from-amber-400/95 !via-amber-800 !to-amber-950 !py-2 !text-xs !font-bold !tracking-wide !text-amber-50 !shadow-[0_4px_22px_rgba(245,158,11,0.42),inset_0_1px_0_rgba(255,255,255,0.24)] hover:!brightness-110 active:!scale-[0.98] disabled:!cursor-not-allowed disabled:!opacity-45 disabled:!grayscale disabled:hover:!brightness-100 transition-all duration-200 sm:!py-2.5 sm:!text-sm';

/** 좁은 카드(네이티브 대기실): 짧은 한 줄 라벨 + 잘림 방지 */
const PREMIUM_STAGE_ENTER_CLASS_COMPACT =
    `${PREMIUM_STAGE_ENTER_CLASS} !px-1 !py-2 !text-center !tracking-tight !text-[10px] !overflow-visible`;

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

    // 클리어한 스테이지 확인 (서버 clearedSinglePlayerStages + singlePlayerProgress로 대기실에서도 동기화)
    const clearedStages = useMemo(() => {
        return (currentUser as any).clearedSinglePlayerStages || [];
    }, [currentUser]);

    // 다음에 플레이 가능한 스테이지 인덱스(0-based). 클리어 직후 서버 반영 전에도 대기실에서 열린 층 공유
    const singlePlayerProgress = (currentUser as any).singlePlayerProgress ?? 0;

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

    // 전역 스테이지 인덱스 (SINGLE_PLAYER_STAGES 기준)
    const getGlobalStageIndex = (stageId: string) => SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);

    const isStageCleared = (stageId: string) => {
        const g = getGlobalStageIndex(stageId);
        // 서버 clearedStages에 있거나, singlePlayerProgress로 이미 다음 단계까지 열린 경우 클리어로 간주
        return clearedStages.includes(stageId) || (g >= 0 && singlePlayerProgress > g);
    };

    const isStageLocked = (stageIndex: number) => {
        // 관리자는 모든 스테이지에 접근 가능
        if (currentUser.isAdmin) return false;
        
        const stage = stages[stageIndex];
        const globalIndex = getGlobalStageIndex(stage.id);
        // 첫 번째 스테이지(전역 0 = 입문-1)는 항상 열림
        if (globalIndex <= 0) return false;
        // singlePlayerProgress: 다음에 플레이 가능한 스테이지 인덱스. progress > globalIndex 이면 이 스테이지 이미 언락
        if (singlePlayerProgress > globalIndex) return false;
        
        // 전역 순서상 이전 스테이지 클리어 여부로 잠금 판단 (입문-20 클리어 시 초급-1 열림)
        const previousStageGlobal = SINGLE_PLAYER_STAGES[globalIndex - 1];
        if (!previousStageGlobal) return false;
        return !isStageCleared(previousStageGlobal.id);
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
            className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-panel shadow-lg ${tabShelf ? 'p-2.5' : isMobile ? 'p-2.5' : 'p-4'}`}
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

                        return (
                            <div
                                key={stage.id}
                                className={`
                                    relative bg-tertiary/90 rounded-lg border border-color/40 px-2.5 py-3 flex flex-col items-center justify-between min-h-0 min-w-0
                                    transition-transform duration-150
                                    ${isLocked 
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isCleared
                                            ? 'cursor-pointer ring-1 ring-green-500/70 hover:scale-[1.02]'
                                            : 'cursor-pointer hover:scale-[1.03] hover:shadow-md'
                                    }
                                `}
                                onClick={() => !isLocked && handleStageEnter(stage.id)}
                            >
                                {isLocked && (
                                    <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center z-10">
                                        <span className="text-white font-bold text-lg">🔒</span>
                                    </div>
                                )}

                                {isCleared && (
                                    <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-5 h-5 flex items-center justify-center z-20 shadow text-[11px] font-bold text-white">
                                        ✓
                                    </div>
                                )}

                                <div className="text-center w-full mb-1">
                                    <div className={`font-black text-primary drop-shadow [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] ${isMobile ? 'text-2xl' : 'text-2xl sm:text-3xl'}`}>
                                        {stageNumber}
                                    </div>
                                </div>

                                <div className="w-full mb-1.5">
                                    <div className="rounded-md border border-amber-500/35 bg-gradient-to-b from-gray-700/85 to-gray-800/90 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                        <div className={`font-semibold text-center text-amber-200/95 truncate ${tabShelf ? 'text-sm' : isMobile ? 'text-xs' : 'text-xs sm:text-sm'}`}>
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
                                            handleStageEnter(stage.id);
                                        }}
                                        colorScheme="none"
                                        className={isMobile ? PREMIUM_STAGE_ENTER_CLASS_COMPACT : PREMIUM_STAGE_ENTER_CLASS}
                                        disabled={!hasEnoughAP}
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

