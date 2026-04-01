import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, QuestReward } from '../types.js';
import MailRewardItemTile from './MailRewardItemTile.js';

interface RewardSummaryModalProps {
    summary: {
        reward: QuestReward;
        items: InventoryItem[];
        title: string;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const RewardSummaryModal: React.FC<RewardSummaryModalProps> = ({ summary, onClose, isTopmost }) => {
    const { reward, items, title } = summary;

    const frame =
        'rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

    return (
        <DraggableWindow title={title} onClose={onClose} windowId="quest-reward-summary" initialWidth={440} isTopmost={isTopmost}>
            <div className="px-1 pb-1">
                <div className={`${frame} overflow-hidden`}>
                    <div className="border-b border-amber-500/15 bg-gradient-to-r from-amber-950/50 via-black/40 to-amber-950/50 px-5 py-6 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">Reward</p>
                        <h2 className="mt-2 bg-gradient-to-r from-amber-50 via-amber-200 to-amber-100 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-sm">
                            보상을 획득했습니다
                        </h2>
                        <p className="mt-2 text-xs text-zinc-500">아래 내용이 인벤토리·재화에 반영되었습니다.</p>
                    </div>

                    <div className="space-y-4 p-5">
                        <div className="rounded-xl border border-white/5 bg-black/40 p-4 shadow-inner">
                            <h3 className="mb-3 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-500">획득 재화</h3>
                            <div className="space-y-3 text-sm">
                                {(reward.gold ?? 0) > 0 && (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/15 bg-amber-950/20 px-3 py-2.5">
                                        <span className="flex items-center gap-2 font-medium text-zinc-300">
                                            <img src="/images/icon/Gold.png" alt="" className="h-5 w-5" />
                                            골드
                                        </span>
                                        <span className="text-lg font-bold tabular-nums text-amber-200">+{reward.gold!.toLocaleString()}</span>
                                    </div>
                                )}
                                {(reward.diamonds ?? 0) > 0 && (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/15 bg-cyan-950/20 px-3 py-2.5">
                                        <span className="flex items-center gap-2 font-medium text-zinc-300">
                                            <img src="/images/icon/Zem.png" alt="" className="h-5 w-5" />
                                            다이아
                                        </span>
                                        <span className="text-lg font-bold tabular-nums text-cyan-200">+{reward.diamonds!.toLocaleString()}</span>
                                    </div>
                                )}
                                {(reward.actionPoints ?? 0) > 0 && (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/15 bg-emerald-950/20 px-3 py-2.5">
                                        <span className="font-medium text-zinc-300">⚡ 행동력</span>
                                        <span className="text-lg font-bold tabular-nums text-emerald-300">+{reward.actionPoints!.toLocaleString()}</span>
                                    </div>
                                )}
                                {reward.xp?.type === 'blacksmith' && (reward.xp?.amount ?? 0) > 0 && (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-500/15 bg-orange-950/20 px-3 py-2.5">
                                        <span className="flex items-center gap-2 font-medium text-zinc-300">
                                            <img src="/images/equipments/moru.png" alt="" className="h-5 w-5" />
                                            대장간 경험치
                                        </span>
                                        <span className="text-lg font-bold tabular-nums text-orange-300">+{reward.xp!.amount.toLocaleString()}</span>
                                    </div>
                                )}
                                {(reward.gold ?? 0) <= 0 &&
                                    (reward.diamonds ?? 0) <= 0 &&
                                    (reward.actionPoints ?? 0) <= 0 &&
                                    !(reward.xp?.type === 'blacksmith' && (reward.xp?.amount ?? 0) > 0) && (
                                        <p className="py-2 text-center text-xs text-zinc-600">재화 보상 없음</p>
                                    )}
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/80 to-black/80 p-4">
                                <h3 className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-amber-100/90">
                                    <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/50" aria-hidden />
                                    획득 아이템
                                    <span className="h-px w-6 bg-gradient-to-l from-transparent to-amber-500/50" aria-hidden />
                                </h3>
                                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                                    {items.map((item, index) => (
                                        <MailRewardItemTile key={index} item={item} variant="md" className="mx-auto" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-5 flex justify-center">
                    <Button
                        onClick={onClose}
                        className="min-w-[8.5rem] !rounded-xl !px-10 !py-2.5 !text-base !font-bold shadow-lg shadow-amber-950/20"
                        colorScheme="blue"
                    >
                        확인
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default RewardSummaryModal;
