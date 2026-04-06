import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { SINGLE_PLAYER_MISSIONS } from '../../constants/singlePlayerConstants.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

interface ClaimAllTrainingQuestRewardsModalProps {
    rewards: Array<{ missionId: string; missionName: string; rewardType: 'gold' | 'diamonds'; rewardAmount: number }>;
    totalGold: number;
    totalDiamonds: number;
    onClose: () => void;
    isTopmost?: boolean;
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
                className="mt-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg bg-gray-900/50 px-1.5 py-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
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
                                            alt={reward.missionName}
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
                                            {reward.missionName}
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

            <div className="mt-2 flex shrink-0 flex-col gap-2 border-t border-white/10 pt-2">
                {(totalGold > 0 || totalDiamonds > 0) && (
                    <div className="space-y-1 rounded-lg border border-green-500/35 bg-gradient-to-r from-green-900/35 to-blue-900/35 p-2 sm:p-2.5">
                        <h3 className="text-xs font-bold leading-snug text-amber-100/90 sm:text-sm">총 합계</h3>
                        <div className="space-y-1">
                            {totalGold > 0 && (
                                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
                                        <span className="font-medium">골드</span>
                                    </span>
                                    <span className="shrink-0 font-bold tabular-nums text-yellow-300">
                                        +{totalGold.toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {totalDiamonds > 0 && (
                                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
                                        <span className="font-medium">다이아</span>
                                    </span>
                                    <span className="shrink-0 font-bold tabular-nums text-cyan-300">
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

    return (
        <DraggableWindow
            title="수련 과제 일괄 수령"
            modal={true}
            closeOnOutsideClick={true}
            onClose={onClose}
            windowId="claim-all-training-quest-rewards"
            initialWidth={isCompactUi ? 340 : 680}
            initialHeight={isCompactUi ? 560 : 840}
            isTopmost={isTopmost}
            zIndex={10000}
            mobileViewportFit={isCompactUi}
            mobileViewportMaxHeightVh={72}
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
                <div className="text-center text-on-panel">
                    <h2 className="mb-4 text-xl font-bold">모든 수련 과제 보상을 수령했습니다!</h2>

                    <div className="mb-4 space-y-2 rounded-lg bg-gray-900/50 p-4">
                        {rewards.map((reward) => {
                            const missionInfo = SINGLE_PLAYER_MISSIONS.find((m) => m.id === reward.missionId);
                            return (
                                <div
                                    key={reward.missionId}
                                    className="flex items-center justify-between rounded-lg bg-gray-800/50 p-3"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        {missionInfo && (
                                            <img
                                                src={missionInfo.image}
                                                alt={reward.missionName}
                                                className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-sm font-bold text-white">{reward.missionName}</h3>
                                        </div>
                                    </div>
                                    <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                                        {reward.rewardType === 'gold' ? (
                                            <>
                                                <img src="/images/icon/Gold.png" alt="골드" className="h-5 w-5" />
                                                <span className="text-sm font-bold text-yellow-300">
                                                    +{reward.rewardAmount.toLocaleString()}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <img src="/images/icon/Zem.png" alt="다이아" className="h-5 w-5" />
                                                <span className="text-sm font-bold text-cyan-300">
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
                        <div className="mb-4 space-y-2 rounded-lg border-2 border-green-500/30 bg-gradient-to-r from-green-900/30 to-blue-900/30 p-4">
                            <h3 className="mb-2 text-lg font-bold">총 합계</h3>
                            <div className="space-y-2">
                                {totalGold > 0 && (
                                    <div className="flex items-center justify-between text-lg">
                                        <span className="flex items-center gap-2">
                                            <img src="/images/icon/Gold.png" alt="골드" className="h-6 w-6" />
                                            <span className="font-semibold">골드</span>
                                        </span>
                                        <span className="font-bold text-yellow-300">+{totalGold.toLocaleString()}</span>
                                    </div>
                                )}
                                {totalDiamonds > 0 && (
                                    <div className="flex items-center justify-between text-lg">
                                        <span className="flex items-center gap-2">
                                            <img src="/images/icon/Zem.png" alt="다이아" className="h-6 w-6" />
                                            <span className="font-semibold">다이아</span>
                                        </span>
                                        <span className="font-bold text-cyan-300">+{totalDiamonds.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Button onClick={onClose} colorScheme="accent" className="mt-4 w-full">
                        확인
                    </Button>
                </div>
            )}
        </DraggableWindow>
    );
};

export default ClaimAllTrainingQuestRewardsModal;
