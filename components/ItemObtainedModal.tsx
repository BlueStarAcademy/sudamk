
import React, { useEffect } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { InventoryItem, ItemGrade, ItemOption, CoreStat, SpecialStat, MythicStat } from '../types.js';
import { audioService } from '../services/audioService.js';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { isActionPointConsumable } from '../constants/items';
import { MythicOptionAbbrev } from './MythicStatAbbrev.js';

interface ItemObtainedModalProps {
    item: InventoryItem;
    onClose: () => void;
    isTopmost?: boolean;
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

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-blue-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const OptionSection: React.FC<{ title: string; options: ItemOption[]; color: string; mythic?: boolean }> = ({ title, options, color, mythic }) => {
    if (options.length === 0) return null;
    return (
        <div>
            <h5 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1 text-sm`}>{title}</h5>
            <ul className={`${mythic ? 'list-none space-y-0.5 text-xs' : 'list-disc list-inside space-y-0.5 text-gray-300 text-xs'}`}>
                {options.map((opt, i) => (
                    <li key={i} className={mythic ? 'text-gray-300' : undefined}>
                        {mythic ? <MythicOptionAbbrev option={opt} textClassName="text-red-300" /> : opt.display}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const renderOptions = (item: InventoryItem) => {
    if (!item.options) return null;
    const { main, combatSubs, specialSubs, mythicSubs } = item.options;
    return (
        <div className="w-full text-xs text-left space-y-2">
            <OptionSection title="주옵션" options={[main]} color="text-yellow-300" />
            <OptionSection title="전투 부옵션" options={combatSubs} color="text-blue-300" />
            <OptionSection title="특수 부옵션" options={specialSubs} color="text-green-300" />
            <OptionSection title="신화 부옵션" options={mythicSubs} color="text-red-400" mythic />
        </div>
    )
};

const ItemObtainedModal: React.FC<ItemObtainedModalProps> = ({ item, onClose, isTopmost }) => {
    const styles = gradeStyles[item.grade];
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
    const starInfo = getStarDisplayInfo(item.stars);
    const borderClass = item.grade === ItemGrade.Transcendent ? undefined : gradeBorderStyles[item.grade];
    const isCurrency = item.image === '/images/icon/Gold.png' || item.image === '/images/icon/Zem.png';
    
    // 등급별 글로우 효과 클래스
    const getGlowClass = (grade: ItemGrade) => {
        switch (grade) {
            case 'rare': return 'item-glow-rare';
            case 'epic': return 'item-glow-epic';
            case 'legendary': return 'item-glow-legendary';
            case 'mythic': return 'item-glow-mythic';
            case 'transcendent': return 'item-glow-transcendent';
            default: return '';
        }
    };
    
    // 등급별 텍스트 글로우 효과 클래스
    const getTextGlowClass = (grade: ItemGrade) => {
        switch (grade) {
            case 'rare': return 'text-glow-rare';
            case 'epic': return 'text-glow-epic';
            case 'legendary': return 'text-glow-legendary';
            case 'mythic': return 'text-glow-mythic';
            case 'transcendent': return 'text-glow-transcendent';
            default: return '';
        }
    };
    
    const isHighGrade = ['rare', 'epic', 'legendary', 'mythic', 'transcendent'].includes(item.grade);
    const glowClass = getGlowClass(item.grade);
    const textGlowClass = getTextGlowClass(item.grade);

    useEffect(() => {
        void audioService.initialize();
        if (['epic', 'legendary', 'mythic', 'transcendent'].includes(item.grade)) {
            audioService.gachaEpicOrHigher();
        } else {
            audioService.claimReward();
        }
    }, [item.grade]);

    return (
        <DraggableWindow
            title="아이템 획득"
            onClose={onClose}
            windowId="item-obtained"
            initialWidth={440}
            initialHeight={560}
            isTopmost={isTopmost}
            zIndex={70}
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <>
                <div className="flex min-h-0 flex-col gap-2 p-1">
                    <div
                        className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-[#141a28] via-[#0d111c] to-[#080b12] shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_24px_48px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]"
                        role="region"
                        aria-label="획득 아이템"
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.12]"
                            style={{
                                background:
                                    'radial-gradient(ellipse 85% 55% at 50% -5%, rgba(251, 191, 36, 0.45), transparent 58%), radial-gradient(ellipse 70% 45% at 50% 100%, rgba(34, 211, 238, 0.12), transparent 55%)',
                            }}
                            aria-hidden
                        />
                        <div className="relative flex min-h-0 flex-col gap-2 p-2 max-[360px]:gap-1.5 max-[360px]:p-1.5 min-[390px]:gap-2.5 min-[390px]:p-2.5 sm:gap-3 sm:px-5 sm:pb-5 sm:pt-6">
                            <div className="flex min-w-0 items-center gap-2 max-[360px]:gap-1.5 min-[390px]:gap-2.5 sm:flex-col sm:items-center sm:gap-3">
                                <div className="relative h-20 w-20 shrink-0 min-[390px]:h-24 min-[390px]:w-24 sm:h-40 sm:w-40">
                                    <div
                                        className="absolute inset-[-10%] rounded-2xl opacity-40 blur-2xl"
                                        style={{
                                            background:
                                                item.grade === ItemGrade.Transcendent
                                                    ? 'conic-gradient(from 180deg, rgba(34,211,238,0.35), rgba(168,85,247,0.25), rgba(251,191,36,0.3), rgba(34,211,238,0.35))'
                                                    : 'radial-gradient(circle at 50% 40%, rgba(251,191,36,0.25), transparent 65%)',
                                        }}
                                        aria-hidden
                                    />
                                    <div className="relative mx-auto flex h-full w-full items-center justify-center rounded-2xl p-1 ring-1 ring-amber-500/25 ring-offset-2 ring-offset-[#0d111c]">
                                        <div
                                            className={`relative h-full w-full overflow-hidden rounded-xl ${borderClass || 'border-2 border-slate-600/55'} ${item.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''} ${isHighGrade ? 'item-reveal-animation' : ''} ${glowClass}`}
                                        >
                                            <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                            {isActionPointConsumable(item.name) ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-1">
                                                    <span className="text-2xl leading-none min-[390px]:text-3xl sm:text-5xl" aria-hidden>
                                                        ⚡
                                                    </span>
                                                    <span
                                                        className="mt-1 max-w-full truncate text-xs font-bold text-amber-200 min-[390px]:text-sm sm:text-lg"
                                                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(251,191,36,0.35)' }}
                                                    >
                                                        +{item.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                                    </span>
                                                </div>
                                            ) : item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt=""
                                                    className="absolute object-contain p-2 sm:p-3.5"
                                                    style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                                />
                                            ) : null}
                                            {isCurrency && (
                                                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 p-2 backdrop-blur-[1px]">
                                                    <span
                                                        className="text-center text-base font-bold tabular-nums text-white min-[390px]:text-lg sm:text-2xl"
                                                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.85), 0 0 20px rgba(251,191,36,0.25)' }}
                                                    >
                                                        +{item.quantity?.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col items-start text-left sm:items-center sm:text-center">
                                    <span
                                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] sm:px-3 sm:text-[11px] ${styles.bg} ${styles.text} border-white/10 shadow-inner ${textGlowClass}`}
                                    >
                                        [{styles.name}]
                                    </span>
                                    <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 sm:justify-center">
                                        <h2
                                        className={`max-w-full break-words text-[13px] font-black tracking-tight min-[390px]:text-base sm:text-xl ${starInfo.colorClass} ${textGlowClass}`}
                                            style={{ wordBreak: 'keep-all' }}
                                        >
                                            {item.name}
                                        </h2>
                                        {item.stars > 0 && (
                                            <span className={`text-xs font-bold min-[390px]:text-sm sm:text-lg ${starInfo.colorClass} ${textGlowClass}`}>{starInfo.text}</span>
                                        )}
                                    </div>
                                    {requiredLevel && (
                                        <p className="mt-1 text-[9px] text-amber-200/85 min-[390px]:text-[10px] sm:text-[11px]">착용 레벨 합 {requiredLevel}</p>
                                    )}
                                </div>
                            </div>

                            {item.type === 'equipment' && (
                                <div className="max-h-[26dvh] w-full space-y-1 overflow-y-auto rounded-xl border border-slate-600/45 bg-black/35 p-2 text-left text-[10px] shadow-inner backdrop-blur-sm [scrollbar-gutter:stable] min-[390px]:max-h-[28dvh] min-[390px]:space-y-1.5 min-[390px]:p-2.5 min-[390px]:text-[11px] sm:max-h-40 sm:p-3 sm:text-xs">
                                    {renderOptions(item)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} p-1 pt-2`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl border border-amber-400/35 bg-gradient-to-b from-emerald-500/95 via-emerald-600/95 to-emerald-800/90 py-3 font-bold text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-amber-300/50 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-700 active:scale-[0.98]"
                    >
                        확인
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default ItemObtainedModal;
