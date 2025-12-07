import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';

interface WarResult {
    isWinner: boolean;
    guild1Stars: number;
    guild2Stars: number;
    guild1Score: number;
    guild2Score: number;
}

interface Rewards {
    guildCoins: number;
    guildXp: number;
    researchPoints: number;
    gold: number;
    diamonds: number;
}

interface GuildWarRewardModalProps {
    onClose: () => void;
    onClaim: () => Promise<{ warResult?: WarResult; rewards?: Rewards } | undefined>;
    isClaimed: boolean;
    canClaim: boolean;
}

const GuildWarRewardModal: React.FC<GuildWarRewardModalProps> = ({ onClose, onClaim, isClaimed, canClaim }) => {
    const { currentUserWithStatus } = useAppContext();
    const [isClaiming, setIsClaiming] = useState(false);
    const [warResult, setWarResult] = useState<WarResult | null>(null);
    const [rewards, setRewards] = useState<Rewards | null>(null);
    const [showRewards, setShowRewards] = useState(false);

    const handleClaim = async () => {
        if (!canClaim || isClaiming) return;
        
        setIsClaiming(true);
        try {
            const result = await onClaim();
            if (result?.warResult && result?.rewards) {
                setWarResult(result.warResult);
                setRewards(result.rewards);
                setShowRewards(true);
            }
        } catch (error) {
            console.error('[GuildWarRewardModal] Claim failed:', error);
        } finally {
            setIsClaiming(false);
        }
    };

    const isWinner = warResult?.isWinner ?? false;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 rounded-xl border-2 border-stone-600/60 shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-tertiary hover:text-primary transition-colors text-2xl font-bold"
                >
                    ×
                </button>

                {!showRewards ? (
                    <>
                        <h2 className="text-2xl font-bold text-highlight mb-4 text-center">길드 전쟁 보상</h2>
                        <p className="text-center text-tertiary mb-6">보상을 받으면 전쟁 결과와 보상 내용을 확인할 수 있습니다.</p>
                        
                        {isClaimed ? (
                            <button
                                disabled
                                className="w-full bg-green-600/50 text-green-300 py-3 px-4 rounded-lg font-semibold cursor-not-allowed"
                            >
                                ✓ 보상 수령 완료
                            </button>
                        ) : (
                            <button
                                onClick={handleClaim}
                                disabled={!canClaim || isClaiming}
                                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                                    canClaim && !isClaiming
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]'
                                        : 'bg-stone-700/50 text-stone-400 cursor-not-allowed'
                                }`}
                            >
                                {isClaiming ? '수령 중...' : '보상 받기'}
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <h2 className={`text-2xl font-bold mb-4 text-center ${isWinner ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {isWinner ? '🎉 승리!' : '패배'}
                        </h2>

                        {/* 전쟁 결과 */}
                        {warResult && (
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
                                        <span className="text-tertiary">점수</span>
                                        <span className="text-primary font-bold">
                                            {warResult.guild1Score.toLocaleString()} vs {warResult.guild2Score.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 보상 목록 */}
                        {rewards && (
                            <div className="space-y-3 mb-6">
                                <h3 className="text-lg font-semibold text-primary">획득 보상</h3>
                                
                                {/* 골드 보상 */}
                                <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src="/images/icon/Gold.png" alt="Gold" className="w-8 h-8" />
                                            <span className="text-primary font-semibold">골드</span>
                                        </div>
                                        <span className="text-yellow-400 font-bold text-lg">+{rewards.gold.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* 다이아 보상 */}
                                <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src="/images/icon/Diamond.png" alt="Diamond" className="w-8 h-8" />
                                            <span className="text-primary font-semibold">다이아</span>
                                        </div>
                                        <span className="text-cyan-400 font-bold text-lg">+{rewards.diamonds.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* 길드 코인 보상 */}
                                <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-8 h-8" />
                                            <span className="text-primary font-semibold">길드 코인</span>
                                        </div>
                                        <span className="text-amber-300 font-bold text-lg">+{rewards.guildCoins.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* 길드 경험치 보상 */}
                                <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src="/images/guild/button/guildlab.png" alt="Guild XP" className="w-8 h-8" />
                                            <span className="text-primary font-semibold">길드 경험치</span>
                                        </div>
                                        <span className="text-blue-300 font-bold text-lg">+{rewards.guildXp.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* 연구 포인트 보상 */}
                                <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src="/images/guild/button/guildlab.png" alt="Research Points" className="w-8 h-8" />
                                            <span className="text-primary font-semibold">연구 포인트</span>
                                        </div>
                                        <span className="text-purple-300 font-bold text-lg">+{rewards.researchPoints.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 px-4 rounded-lg font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            확인
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default GuildWarRewardModal;

