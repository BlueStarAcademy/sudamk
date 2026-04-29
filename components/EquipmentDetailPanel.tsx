import React from 'react';
import { InventoryItem, ItemGrade } from '../types.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { isActionPointConsumable } from '../constants/items';
import { MythicSubsPartitioned } from './MythicSubsPartitioned.js';
import { formatSpecialSubLineForPanel } from '../shared/utils/specialStatMilestones.js';

/** ItemDetailModal과 동일 — 등급별 프레임·배경 */
const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string; frame: string }> = {
    normal: { name: '일반', color: 'text-zinc-300', background: '/images/equipments/normalbgi.png', frame: 'from-zinc-500/15 to-zinc-700/5 ring-zinc-500/25' },
    uncommon: { name: '고급', color: 'text-emerald-400', background: '/images/equipments/uncommonbgi.png', frame: 'from-emerald-500/20 to-emerald-900/10 ring-emerald-500/30' },
    rare: { name: '희귀', color: 'text-sky-400', background: '/images/equipments/rarebgi.png', frame: 'from-sky-500/20 to-blue-950/15 ring-sky-500/35' },
    epic: { name: '에픽', color: 'text-violet-400', background: '/images/equipments/epicbgi.png', frame: 'from-violet-500/25 to-purple-950/15 ring-violet-500/40' },
    legendary: { name: '전설', color: 'text-rose-500', background: '/images/equipments/legendarybgi.png', frame: 'from-rose-500/25 to-red-950/15 ring-rose-500/40' },
    mythic: { name: '신화', color: 'text-amber-400', background: '/images/equipments/mythicbgi.png', frame: 'from-amber-500/25 to-orange-950/20 ring-amber-400/45' },
    transcendent: {
        name: '초월',
        color: 'text-cyan-300',
        background: '/images/equipments/transcendentbgi.webp',
        frame: 'from-cyan-500/30 via-teal-600/20 to-cyan-950/25 ring-cyan-400/50',
    },
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = 'prism-text-effect';
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = 'text-purple-400';
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = 'text-amber-400';
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.png';
        numberColor = 'text-white';
    }

    return (
        <div
            className="absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
            <img src={starImage} alt="" className="h-3 w-3" />
            <span className={`text-xs font-bold leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

export interface EquipmentDetailPanelProps {
    item: InventoryItem;
    /** 가방 상세: 옵션 영역만 스크롤. 획득 팝업: 본문 높이에 맞춰 내부 스크롤 없음 */
    optionsScrollable?: boolean;
    /** 거래상태(귀속/거래가능)를 이미지 하단에 표시 */
    showTradeStatusUnderImage?: boolean;
}

/**
 * 장비 상세 정보 모달(ItemDetailModal)과 동일한 본문 레이아웃(상단 카드 + 부옵션 영역).
 */
export const EquipmentDetailPanel: React.FC<EquipmentDetailPanelProps> = ({ item, optionsScrollable = true, showTradeStatusUnderImage = false }) => {
    const { currentUserWithStatus } = useAppContext();
    const styles = gradeStyles[item.grade];

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = (currentUserWithStatus?.strategyLevel || 0) + (currentUserWithStatus?.playfulLevel || 0);
    const canEquip = userLevelSum >= requiredLevel;

    const refinementCount = (item as { refinementCount?: number }).refinementCount ?? 0;
    const isTranscendent = item.grade === ItemGrade.Transcendent;
    const nameLength = (item.name ?? '').length;
    // 주옵션 텍스트보다 아주 약간 큰 크기만 유지
    const computedNameFontPx = Math.max(11, Math.min(15, Math.floor(15 - Math.max(0, nameLength - 14) * 0.22)));

    const optionsSectionClass = optionsScrollable
        ? 'min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30'
        : 'shrink-0 overflow-visible rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30';

    return (
        <div className={optionsScrollable ? 'flex h-full min-h-0 flex-col' : 'flex flex-col'}>
            <div
                className={`relative mb-4 overflow-hidden rounded-xl bg-gradient-to-br p-[1px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] ${styles.frame}`}
            >
                <div className="flex items-start justify-between rounded-[11px] bg-zinc-950/90 px-3 py-3 ring-1 ring-inset ring-white/[0.06]">
                    <div className="flex shrink-0 flex-col items-center">
                        <div
                            className={`relative h-16 w-16 overflow-hidden rounded-lg shadow-inner ring-1 ring-black/40 sm:h-20 sm:w-20 md:h-24 md:w-24 ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                        >
                            <img src={styles.background} alt={item.grade} className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                            {isActionPointConsumable(item.name) ? (
                                <span
                                    className="absolute inset-0 flex items-center justify-center text-2xl"
                                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                    aria-hidden
                                >
                                    ⚡
                                </span>
                            ) : item.image ? (
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="relative z-[2] object-contain p-2"
                                    style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                />
                            ) : null}
                            {renderStarDisplay(item.stars)}
                        </div>
                        {showTradeStatusUnderImage && item.type === 'equipment' && (
                            <div
                                className={`mt-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                    item.isBound
                                        ? 'border-rose-500/40 bg-rose-900/30 text-rose-200'
                                        : 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200'
                                }`}
                            >
                                {item.isBound ? '귀속' : '거래가능'}
                            </div>
                        )}
                    </div>
                    <div className="ml-2 min-w-0 flex-grow text-right sm:ml-3 md:ml-4">
                        <div className="flex items-baseline justify-end gap-1">
                            <h3
                                className={`max-w-full whitespace-nowrap text-right font-bold leading-tight tracking-tight ${styles.color}`}
                                style={{ fontSize: `${computedNameFontPx}px`, letterSpacing: '-0.02em' }}
                            >
                                {item.name}
                            </h3>
                        </div>
                        <p className={`text-[11px] font-medium sm:text-xs md:text-sm ${styles.color}`}>[{styles.name}]</p>
                        {!showTradeStatusUnderImage && (
                            <p className={`text-[10px] font-semibold sm:text-[11px] md:text-xs ${item.isBound ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {item.isBound ? '귀속' : '거래가능'}
                            </p>
                        )}
                        <p className={`text-[10px] sm:text-[11px] md:text-xs ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>(착용레벨: {requiredLevel})</p>
                        {item.type === 'equipment' && item.grade !== 'normal' && (
                            <p className={`text-[10px] font-semibold sm:text-[11px] md:text-xs ${refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                제련 가능: {refinementCount > 0 ? `${refinementCount}회` : '제련불가'}
                            </p>
                        )}
                        {item.options?.main && (
                            <p className="mt-1 text-[11px] font-semibold leading-snug text-amber-300/95 drop-shadow-sm sm:text-xs md:text-sm">{item.options.main.display}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className={optionsSectionClass}>
                <div className="w-full space-y-2 text-left text-sm">
                    {item.options?.combatSubs && item.options.combatSubs.length > 0 && (
                        <div className="space-y-0.5">
                            {item.options.combatSubs.map((opt, i) => (
                                <p key={i} className="text-blue-300">
                                    {opt.display}
                                </p>
                            ))}
                        </div>
                    )}
                    {item.options?.specialSubs && item.options.specialSubs.length > 0 && (
                        <div className="space-y-0.5">
                            {item.options.specialSubs.map((opt, i) => (
                                <p key={i} className="text-green-300">
                                    {formatSpecialSubLineForPanel(opt, item.stars ?? 0)}
                                </p>
                            ))}
                        </div>
                    )}
                    {item.options?.mythicSubs && item.options.mythicSubs.length > 0 ? (
                        <MythicSubsPartitioned subs={item.options.mythicSubs} />
                    ) : null}
                </div>
            </div>
        </div>
    );
};
