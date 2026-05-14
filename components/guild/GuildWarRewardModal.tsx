import React from 'react';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';
import GuildExpBadge from './GuildExpBadge.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';

export interface GuildWarRewardModalWarResult {
    isWinner: boolean;
    guild1Stars: number;
    guild2Stars: number;
    guild1Score: number;
    guild2Score: number;
}

export interface GuildWarRewardModalRewards {
    guildCoins: number;
    guildXp: number;
    researchPoints: number;
    gold: number;
    diamonds: number;
}

interface GuildWarRewardModalProps {
    onClose: () => void;
    warResult: GuildWarRewardModalWarResult;
    rewards: GuildWarRewardModalRewards;
}

const GuildWarRewardModal: React.FC<GuildWarRewardModalProps> = ({ onClose, warResult, rewards }) => {
    const isWinner = warResult.isWinner;

    return (
        <div className="sudamr-modal-overlay z-50" onClick={onClose}>
            <div
                className="sudamr-modal-panel relative max-h-[90vh] max-w-md overflow-y-auto p-6 ring-1 ring-white/[0.06]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className={`absolute right-4 top-4 ${SUDAMR_MODAL_CLOSE_BUTTON_CLASS}`}
                    aria-label="닫기"
                >
                    닫기
                </button>

                <h2 className={`text-2xl font-bold mb-4 text-center ${isWinner ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {isWinner ? '🎉 승리!' : '패배'}
                </h2>

                <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50 mb-4">
                    <h3 className="text-lg font-semibold text-primary mb-3">전쟁 결과</h3>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-tertiary">별 개수</span>
                            <span className="text-primary font-bold">
                                {warResult.guild1Stars} vs {warResult.guild2Stars}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-tertiary">집점수 (전쟁 합산)</span>
                            <span className="text-primary font-bold">
                                {warResult.guild1Score.toLocaleString()} vs {warResult.guild2Score.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    <h3 className="text-lg font-semibold text-primary">획득 보상</h3>

                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between gap-3">
                            <img src="/images/icon/Gold.webp" alt="" className="h-8 w-8 shrink-0 object-contain" title="골드" />
                            <span className="text-yellow-400 font-bold text-lg tabular-nums">+{formatGoldAmountKoG(rewards.gold)}</span>
                        </div>
                    </div>

                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between gap-3">
                            <img src="/images/icon/Zem.webp" alt="" className="h-8 w-8 shrink-0 object-contain" title="다이아" />
                            <span className="text-cyan-400 font-bold text-lg tabular-nums">+{formatWalletDiamonds(rewards.diamonds)}</span>
                        </div>
                    </div>

                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between gap-3">
                            <img src="/images/guild/tokken.webp" alt="" className="h-8 w-8 shrink-0 object-contain" title="길드 코인" />
                            <span className="text-amber-300 font-bold text-lg tabular-nums">+{rewards.guildCoins.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between gap-3">
                            <GuildExpBadge className="h-8 min-w-[3rem] rounded-lg" />
                            <span className="text-blue-300 font-bold text-lg tabular-nums">+{rewards.guildXp.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between gap-3">
                            <img src="/images/guild/button/guildlab.webp" alt="" className="h-8 w-8 shrink-0 object-contain" title="연구 포인트" />
                            <span className="text-purple-300 font-bold text-lg tabular-nums">+{rewards.researchPoints.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 px-4 rounded-lg font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    확인
                </button>
            </div>
        </div>
    );
};

export default GuildWarRewardModal;
