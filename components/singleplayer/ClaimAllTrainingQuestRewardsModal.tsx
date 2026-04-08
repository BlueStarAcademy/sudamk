import React, { useMemo } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { SINGLE_PLAYER_MISSIONS } from '../../constants/singlePlayerConstants.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

interface ClaimAllTrainingQuestRewardsModalProps {
    rewards: Array<{
        missionId: string;
        missionName: string;
        /** 수령 시점 미션 레벨 (1~10). 구버전 응답에는 없을 수 있음 */
        missionLevel?: number;
        rewardType: 'gold' | 'diamonds';
        rewardAmount: number;
    }>;
    totalGold: number;
    totalDiamonds: number;
    onClose: () => void;
    isTopmost?: boolean;
}

function formatMissionLabel(missionName: string, missionLevel?: number): React.ReactNode {
    if (typeof missionLevel === 'number' && missionLevel >= 1) {
        return (
            <>
                {missionName}{' '}
                <span className="whitespace-nowrap font-semibold text-amber-200/90 tabular-nums">Lv.{missionLevel}</span>
            </>
        );
    }
    return missionName;
}

/** 모바일: transform scale 없이 1:1 렌더링. 보상 목록만 스크롤해 글·이미지가 뭉개지지 않게 함. */
function MobileClaimBody({
    rewards,
    totalGold,
    totalDiamonds,
    onClose,
}: {
    rewards: ClaimAllTrainingQuestRewardsModalProps['rewards'];
    totalGold: number;
    totalDiamonds: number;
    onClose: () => void;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <h2 className="shrink-0 px-0.5 text-center text-xs font-bold leading-snug text-white/95 sm:text-sm">
                모든 수련 과제 보상을 수령했습니다!
            </h2>

            <div
                className="mt-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg bg-gray-900/50 px-1.5 py-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:auto]"
            >
                <div className="flex flex-col gap-1">
                    {rewards.map((reward) => {
                        const missionInfo = SINGLE_PLAYER_MISSIONS.find((m) => m.id === reward.missionId);
                        return (
                            <div
                                key={reward.missionId}
                                className="flex items-start justify-between gap-2 rounded-md bg-gray-800/50 px-2 py-1.5"
                            >
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                    {missionInfo && (
                                        <img
                                            src={missionInfo.image}
                                            alt={
                                                typeof reward.missionLevel === 'number' && reward.missionLevel >= 1
                                                    ? `${reward.missionName} Lv.${reward.missionLevel}`
                                                    : reward.missionName
                                            }
                                            className="mt-0.5 h-8 w-8 shrink-0 rounded object-contain"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="break-words text-left text-xs font-semibold leading-snug text-white sm:text-[13px]">
                                            {formatMissionLabel(reward.missionName, reward.missionLevel)}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                    {reward.rewardType === 'gold' ? (
                                        <>
                                            <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4" />
                                            <span className="text-xs font-bold tabular-nums text-yellow-300 sm:text-[13px]">
                                                +{reward.rewardAmount.toLocaleString()}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4" />
                                            <span className="text-xs font-bold tabular-nums text-cyan-300 sm:text-[13px]">
                                                +{reward.rewardAmount.toLocaleString()}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-2 flex shrink-0 flex-col items-center gap-2 border-t border-white/10 pt-2">
                {(totalGold > 0 || totalDiamonds > 0) && (
                    <div className="w-fit max-w-[min(100%,14.5rem)] space-y-1.5 rounded-lg border border-green-500/35 bg-gradient-to-r from-green-900/35 to-blue-900/35 px-3 py-2 text-center sm:max-w-[15rem] sm:px-3.5 sm:py-2">
                        <h3 className="text-xs font-bold leading-snug text-amber-100/90 sm:text-sm">총 합계</h3>
                        <div className="space-y-1.5">
                            {totalGold > 0 && (
                                <div className="flex items-center justify-center gap-2">
                                    <img
                                        src="/images/icon/Gold.png"
                                        alt="골드"
                                        className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
                                    />
                                    <span className="text-sm font-bold tabular-nums text-yellow-300 sm:text-base">
                                        +{totalGold.toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {totalDiamonds > 0 && (
                                <div className="flex items-center justify-center gap-2">
                                    <img
                                        src="/images/icon/Zem.png"
                                        alt="다이아"
                                        className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
                                    />
                                    <span className="text-sm font-bold tabular-nums text-cyan-300 sm:text-base">
                                        +{totalDiamonds.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <Button
                    onClick={onClose}
                    colorScheme="accent"
                    className="mt-1 min-h-[2.5rem] w-full shrink-0 !py-2 text-sm font-bold sm:min-h-[2.65rem]"
                >
                    확인
                </Button>
            </div>
        </div>
    );
}

const ClaimAllTrainingQuestRewardsModal: React.FC<ClaimAllTrainingQuestRewardsModalProps> = ({
    rewards,
    totalGold,
    totalDiamonds,
    onClose,
    isTopmost,
}) => {
    const isHandheld = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isCompactUi = isHandheld || isNativeMobile;

    /** 헤더·푸터·패딩·본문 블록을 반영해 내용이 잘리지 않게 높이 추정, 뷰포트 상한 내에서만 캡 */
    const panelInitialHeight = useMemo(() => {
        if (typeof window === 'undefined') return isCompactUi ? 560 : 640;
        const vh = window.innerHeight;
        const cap = Math.floor(vh * 0.92);
        const safe = Math.max(0, vh - Math.floor(vh * 0.08));
        const useCap = Math.min(cap, safe);

        const hasTotals = totalGold > 0 || totalDiamonds > 0;
        if (isCompactUi) {
            const chrome = 56 + 8;
            const bodyPad = 36;
            const title = 40;
            const row = 52;
            const list = Math.max(48, rewards.length * row + 8);
            const totals = hasTotals ? 128 : 0;
            const btn = 96;
            const inner = title + list + totals + btn;
            return Math.min(Math.max(280, chrome + bodyPad + inner), useCap);
        }
        const chrome = 52 + 48;
        const bodyPad = 40;
        const title = 56;
        const row = 60;
        const list = Math.max(56, rewards.length * row + 12);
        const totals = hasTotals ? 155 : 0;
        const btn = 72;
        const inner = title + list + totals + btn;
        return Math.min(Math.max(340, chrome + bodyPad + inner), useCap);
    }, [isCompactUi, rewards.length, totalGold, totalDiamonds]);

    return (
        <DraggableWindow
            title="수련 과제 일괄 수령"
            modal={true}
            closeOnOutsideClick={true}
            onClose={onClose}
            windowId="claim-all-training-quest-rewards"
            initialWidth={isCompactUi ? 340 : 420}
            initialHeight={panelInitialHeight}
            isTopmost={isTopmost}
            zIndex={10000}
            mobileViewportFit={isCompactUi}
            mobileViewportMaxHeightVh={92}
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px))))"
            pcViewportMaxHeightCss="min(92dvh, calc(100dvh - 1.5rem))"
            bodyNoScroll={isCompactUi}
            hideFooter={isCompactUi}
            skipSavedPosition={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-3 sm:pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] sm:pt-2.5'
                    : 'p-4'
            }
        >
            {isCompactUi ? (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden text-on-panel">
                    <MobileClaimBody
                        rewards={rewards}
                        totalGold={totalGold}
                        totalDiamonds={totalDiamonds}
                        onClose={onClose}
                    />
                </div>
            ) : (
                <div className="mx-auto flex w-full max-w-[min(100%,26rem)] min-h-0 flex-col text-center text-on-panel">
                    <h2 className="mb-3 shrink-0 text-lg font-bold leading-snug sm:text-xl">모든 수련 과제 보상을 수령했습니다!</h2>

                    <div className="mb-3 min-h-0 space-y-1.5 overflow-x-hidden overflow-y-visible rounded-lg bg-gray-900/50 p-3">
                        {rewards.map((reward) => {
                            const missionInfo = SINGLE_PLAYER_MISSIONS.find((m) => m.id === reward.missionId);
                            return (
                                <div
                                    key={reward.missionId}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/50 p-2.5"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {missionInfo && (
                                            <img
                                                src={missionInfo.image}
                                                alt={
                                                    typeof reward.missionLevel === 'number' && reward.missionLevel >= 1
                                                        ? `${reward.missionName} Lv.${reward.missionLevel}`
                                                        : reward.missionName
                                                }
                                                className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-left text-xs font-bold text-white sm:text-sm">
                                                {formatMissionLabel(reward.missionName, reward.missionLevel)}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        {reward.rewardType === 'gold' ? (
                                            <>
                                                <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 sm:h-5 sm:w-5" />
                                                <span className="text-xs font-bold tabular-nums text-yellow-300 sm:text-sm">
                                                    +{reward.rewardAmount.toLocaleString()}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 sm:h-5 sm:w-5" />
                                                <span className="text-xs font-bold tabular-nums text-cyan-300 sm:text-sm">
                                                    +{reward.rewardAmount.toLocaleString()}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {(totalGold > 0 || totalDiamonds > 0) && (
                        <div className="mb-3 flex justify-center">
                            <div className="w-fit max-w-[15rem] space-y-2 rounded-lg border border-green-500/35 bg-gradient-to-r from-green-900/35 to-blue-900/35 px-3 py-2.5 text-center sm:max-w-[16rem] sm:px-4 sm:py-3">
                                <h3 className="text-base font-bold">총 합계</h3>
                                <div className="space-y-2">
                                    {totalGold > 0 && (
                                        <div className="flex items-center justify-center gap-2.5">
                                            <img
                                                src="/images/icon/Gold.png"
                                                alt="골드"
                                                className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                                            />
                                            <span className="text-lg font-bold tabular-nums text-yellow-300 sm:text-xl">
                                                +{totalGold.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {totalDiamonds > 0 && (
                                        <div className="flex items-center justify-center gap-2.5">
                                            <img
                                                src="/images/icon/Zem.png"
                                                alt="다이아"
                                                className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                                            />
                                            <span className="text-lg font-bold tabular-nums text-cyan-300 sm:text-xl">
                                                +{totalDiamonds.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center pt-1">
                        <Button
                            onClick={onClose}
                            colorScheme="none"
                            bare
                            className={PREMIUM_QUEST_BTN.confirmModal}
                            cooldownMs={0}
                        >
                            확인
                        </Button>
                    </div>
                </div>
            )}
        </DraggableWindow>
    );
};

export default ClaimAllTrainingQuestRewardsModal;
