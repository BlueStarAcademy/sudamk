import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { InventoryItem } from '../../types/index.js';

interface GuildWarRewardModalProps {
    onClose: () => void;
    onClaim: () => Promise<void>;
    isClaimed: boolean;
    canClaim: boolean;
}

const GuildWarRewardModal: React.FC<GuildWarRewardModalProps> = ({ onClose, onClaim, isClaimed, canClaim }) => {
    const { currentUserWithStatus } = useAppContext();
    const [isClaiming, setIsClaiming] = useState(false);

    const handleClaim = async () => {
        if (!canClaim || isClaiming) return;
        
        setIsClaiming(true);
        try {
            await onClaim();
        } catch (error) {
            console.error('[GuildWarRewardModal] Claim failed:', error);
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 rounded-xl border-2 border-stone-600/60 shadow-2xl max-w-md w-full p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-tertiary hover:text-primary transition-colors text-2xl font-bold"
                >
                    ×
                </button>

                <h2 className="text-2xl font-bold text-highlight mb-4 text-center">길드전 승리 보상</h2>

                <div className="space-y-4 mb-6">
                    {/* 골드 보상 */}
                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src="/images/gold.png" alt="Gold" className="w-8 h-8" />
                                <span className="text-primary font-semibold">골드</span>
                            </div>
                            <span className="text-yellow-400 font-bold text-lg">+2,000</span>
                        </div>
                    </div>

                    {/* 길드 코인 보상 */}
                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-8 h-8" />
                                <span className="text-primary font-semibold">길드 코인</span>
                            </div>
                            <span className="text-amber-300 font-bold text-lg">+300</span>
                        </div>
                    </div>

                    {/* 변경권 보상 */}
                    <div className="bg-stone-800/50 rounded-lg p-4 border border-stone-700/50">
                        <div className="mb-2">
                            <span className="text-primary font-semibold">랜덤 변경권 10장</span>
                        </div>
                        <div className="space-y-2 text-sm text-tertiary">
                            <div className="flex items-center justify-between">
                                <span>옵션 종류 변경권</span>
                                <span className="text-blue-300">10% 확률</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>옵션 수치 변경권</span>
                                <span className="text-green-300">80% 확률</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>신화 옵션 변경권</span>
                                <span className="text-purple-300">10% 확률</span>
                            </div>
                        </div>
                    </div>
                </div>

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
            </div>
        </div>
    );
};

export default GuildWarRewardModal;

