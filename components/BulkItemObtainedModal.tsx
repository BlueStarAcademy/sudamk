import React, { useEffect, useMemo } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { InventoryItem } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { audioService } from '../services/audioService.js';
import { GRADE_LEVEL_REQUIREMENTS, MATERIAL_ITEMS, isActionPointConsumable } from '../constants/items';

interface BulkItemObtainedModalProps {
    items: InventoryItem[];
    onClose: () => void;
    isTopmost?: boolean;
    tournamentScoreChange?: { oldScore: number; newScore: number; scoreReward: number } | null;
}

const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    normal: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', name: '일반', background: '/images/equipments/normalbgi.png' },
    uncommon: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', name: '고급', background: '/images/equipments/uncommonbgi.png' },
    rare: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', name: '희귀', background: '/images/equipments/rarebgi.png' },
    epic: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', name: '에픽', background: '/images/equipments/epicbgi.png' },
    legendary: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', name: '전설', background: '/images/equipments/legendarybgi.png' },
    mythic: { bg: 'bg-orange-700', text: 'text-orange-200', shadow: 'shadow-orange-500/50', name: '신화', background: '/images/equipments/mythicbgi.png' },
    transcendent: { bg: 'bg-cyan-900', text: 'text-cyan-200', shadow: 'shadow-cyan-500/50', name: '초월', background: '/images/equipments/transcendentbgi.png' },
};

const gradeBorderStyles: Partial<Record<ItemGrade, string>> = {
    rare: 'border-pulse-rare',
    epic: 'border-pulse-epic',
    legendary: 'border-pulse-legendary',
    mythic: 'border-pulse-mythic',
};

const BulkItemObtainedModal: React.FC<BulkItemObtainedModalProps> = ({ items, onClose, isTopmost, tournamentScoreChange }) => {
    const getGlowClass = (grade: ItemGrade | undefined) => {
        if (!grade) return '';
        switch (grade) {
            case 'rare': return 'item-glow-rare';
            case 'epic': return 'item-glow-epic';
            case 'legendary': return 'item-glow-legendary';
            case 'mythic': return 'item-glow-mythic';
            case 'transcendent': return 'item-glow-transcendent';
            default: return '';
        }
    };
    
    useEffect(() => {
        if (items && items.length > 0) {
            void audioService.initialize();
            const gradeOrder: ItemGrade[] = [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic, ItemGrade.Transcendent];
            const bestItem = items.reduce((best, current) => {
                const bestGrade = best.grade || ItemGrade.Normal;
                const currentGrade = current.grade || ItemGrade.Normal;
                return gradeOrder.indexOf(currentGrade) > gradeOrder.indexOf(bestGrade) ? current : best;
            });
            if ([ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic, ItemGrade.Transcendent].includes(bestItem.grade)) {
                audioService.gachaEpicOrHigher();
            } else {
                audioService.claimReward();
            }
        }
    }, [items]);

    const hasItems = items && items.length > 0;

    return (
        <DraggableWindow
            title="보상 수령"
            onClose={onClose}
            windowId="bulk-item-obtained"
            initialWidth={620}
            initialHeight={680}
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={70}
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <>
            <div className="flex flex-col gap-1.5 p-1 max-[360px]:gap-1 max-[360px]:p-0.5 min-[390px]:gap-2">
                {hasItems && (
                    <h2 className="rounded-xl border border-amber-500/35 bg-gradient-to-b from-zinc-800/95 to-zinc-950 px-2.5 py-1.5 text-center text-base font-bold text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] min-[390px]:px-3 min-[390px]:py-2 min-[390px]:text-lg sm:text-xl">
                        아이템을 획득했습니다
                    </h2>
                )}
                {tournamentScoreChange && (
                    <div className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-900/50 via-green-900/40 to-emerald-800/50 p-3 shadow-lg sm:p-4">
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🏆</span>
                                <span className="text-base font-bold text-emerald-200">랭킹 점수 변화</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 text-base sm:gap-3 sm:text-lg">
                                <span className="font-mono text-gray-300">{tournamentScoreChange.oldScore.toLocaleString()}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-mono font-bold text-emerald-300">{tournamentScoreChange.newScore.toLocaleString()}</span>
                                <span className="font-semibold text-emerald-400">(+{tournamentScoreChange.scoreReward.toLocaleString()}점)</span>
                            </div>
                            {tournamentScoreChange.scoreReward > 0 && tournamentScoreChange.oldScore > 0 && (
                                <div className="mt-1 text-xs text-emerald-400/80">
                                    {((tournamentScoreChange.scoreReward / tournamentScoreChange.oldScore) * 100).toFixed(1)}% 증가
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {hasItems ? (
                    <div className="grid max-h-[58vh] grid-cols-2 justify-items-center gap-1.5 overflow-y-auto rounded-xl border border-amber-500/25 bg-gradient-to-b from-zinc-800/80 via-zinc-900/75 to-zinc-950/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] min-[390px]:max-h-[60vh] min-[390px]:grid-cols-3 min-[390px]:gap-2 min-[390px]:p-2 sm:grid-cols-4 sm:gap-2.5 sm:p-3 md:grid-cols-5 md:gap-3 md:p-4">
                        {items.map((item, index) => {
                            const itemGrade = item.grade || 'normal';
                            const styles = gradeStyles[itemGrade] || gradeStyles.normal;
                            const borderClass = itemGrade === ItemGrade.Transcendent ? undefined : (itemGrade ? gradeBorderStyles[itemGrade] : undefined);
                            const isCurrency = item.image === '/images/icon/Gold.png' || item.image === '/images/icon/Zem.png';
                            const isHighGrade = ['rare', 'epic', 'legendary', 'mythic', 'transcendent'].includes(itemGrade);
                            const glowClass = getGlowClass(itemGrade);
                            
                            // 이미지 경로가 없으면 MATERIAL_ITEMS에서 찾기
                            let imagePath = item.image;
                            if (!imagePath && item.name && MATERIAL_ITEMS[item.name]) {
                                imagePath = MATERIAL_ITEMS[item.name].image;
                            }
                            
                            return (
                                <div key={index} className="relative aspect-square w-full overflow-visible rounded-xl ring-1 ring-slate-500/30">
                                    <div className={`relative w-full h-full rounded-xl flex items-center justify-center overflow-hidden ${borderClass || 'border-2 border-slate-500/50'} ${itemGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''} ${isHighGrade ? 'item-reveal-animation' : ''} ${glowClass}`}>
                                        <img src={styles.background} alt={itemGrade} className="absolute inset-0 w-full h-full object-cover" />
                                        {isActionPointConsumable(item.name) ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-1">
                                                <span className="text-2xl leading-none sm:text-3xl" aria-hidden>⚡</span>
                                                <span className="mt-0.5 max-w-full truncate text-[10px] font-bold leading-none text-amber-200 sm:text-xs" style={{ textShadow: '1px 1px 2px black' }}>
                                                    +{item.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                                </span>
                                            </div>
                                        ) : imagePath ? (
                                            <img 
                                                src={imagePath} 
                                                alt={item.name} 
                                                className="absolute object-contain p-2" 
                                                style={{ 
                                                    width: '90%', 
                                                    height: '90%', 
                                                    left: '50%', 
                                                    top: '50%', 
                                                    transform: 'translate(-50%, -50%)' 
                                                }} 
                                            />
                                        ) : null}
                                        {isCurrency && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-sm p-1">
                                                <span className="text-white text-lg font-bold text-center break-words" style={{ textShadow: '1px 1px 2px black' }}>
                                                    +{item.quantity?.toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        {!isCurrency && item.quantity && item.quantity > 1 && (
                                            <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md z-10">
                                                {item.quantity}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-6 text-center">
                        <p className="text-slate-400">획득한 아이템이 없습니다.</p>
                    </div>
                )}
            </div>
                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} p-1 pt-2`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 hover:from-emerald-400 hover:to-emerald-500 border border-emerald-400/50 text-white font-semibold shadow-md transition-all active:scale-[0.98]"
                    >
                        확인
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default BulkItemObtainedModal;
