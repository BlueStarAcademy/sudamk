import React from 'react';
import { SinglePlayerMissionInfo, SinglePlayerMissionLevelInfo } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';

interface TrainingQuestStartInfoModalProps {
    mission: SinglePlayerMissionInfo;
    levelInfo: SinglePlayerMissionLevelInfo;
    onClose: () => void;
    onConfirmStart: () => void;
}

const START_MISSION_MESSAGE_BY_ID: Record<string, string> = {
    mission_attendance: '즐거운 바둑학원에 가서 바둑을 배우기 시작했어요.',
    mission_complete_game:
        '드디어 바둑을 한판 완성할 수 있는 실력이 되었어요. 하루 한판의 바둑은 영리함을 쌓는 좋은 방법이랍니다.',
    mission_rival_match:
        '라이벌이 있다면, 더욱더 열심히 노력할 수 있는 계기가 된답니다. 선의의 경쟁을 하세요.',
    mission_study_joseki:
        '큰 깨달음이 있었네요. 이제 나도 바둑의 깊이있는 내용을 알기 시작했어요.',
    mission_league:
        '바둑 리그전에 참여하며 시합방식을 익혀 즐거운 바둑대회의 추억을 쌓아보세요.',
    mission_ai_match:
        '유단자의 경지에 올라 이제 AI의 수읽기와 대응하는 법을 보며 느끼고 배우는 단계가 되었어요.',
};

const TrainingQuestStartInfoModal: React.FC<TrainingQuestStartInfoModalProps> = ({
    mission,
    levelInfo,
    onClose,
    onConfirmStart,
}) => {
    const missionMessage = START_MISSION_MESSAGE_BY_ID[mission.id] ?? '새로운 수련을 시작할 준비가 되었어요.';
    const rewardIcon = mission.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png';
    const rewardAlt = mission.rewardType === 'gold' ? '골드' : '다이아';

    return (
        <DraggableWindow
            title={`${mission.name} 시작`}
            onClose={onClose}
            windowId={`training-quest-start-info-${mission.id}`}
            initialWidth={460}
            shrinkHeightToContent
            isTopmost
            modal
            closeOnOutsideClick
            mobileViewportFit
        >
            <div className="flex flex-col gap-3 rounded-xl bg-[#0a0e14] p-4 text-slate-100 ring-1 ring-inset ring-white/[0.08]">
                <div className="rounded-xl border border-slate-700/70 bg-[#070a10] p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55)]">
                    <p className="text-sm leading-relaxed text-slate-100">{missionMessage}</p>
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-slate-900/55 p-3">
                    <div className="mb-2 flex items-center gap-2 border-b border-white/[0.08] pb-2">
                        <img src={mission.image} alt={mission.name} className="h-10 w-10 rounded-lg bg-black/40 object-cover" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-100">{mission.name}</p>
                            <p className="text-xs text-slate-400">초기 생산 정보</p>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/25 px-2 py-1.5">
                            <span className="text-slate-400">생산</span>
                            <span className="font-semibold tabular-nums text-slate-100">{levelInfo.productionRateMinutes}분</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/25 px-2 py-1.5">
                            <span className="text-slate-400">생산량</span>
                            <span className="flex items-center gap-1 font-semibold tabular-nums text-slate-100">
                                <span>{levelInfo.rewardAmount.toLocaleString()}</span>
                                <img src={rewardIcon} alt={rewardAlt} className="h-4 w-4 object-contain" />
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/25 px-2 py-1.5">
                            <span className="text-slate-400">저장</span>
                            <span className="font-semibold tabular-nums text-slate-100">{levelInfo.maxCapacity.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-1 flex items-center gap-2">
                    <Button
                        onClick={onClose}
                        colorScheme="none"
                        className="flex-1 rounded-lg border border-slate-500/50 bg-slate-800/85 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/85"
                    >
                        닫기
                    </Button>
                    <Button
                        onClick={onConfirmStart}
                        colorScheme="none"
                        className={`${PREMIUM_QUEST_BTN.start} !flex-1 !text-sm`}
                    >
                        시작하기
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default TrainingQuestStartInfoModal;
