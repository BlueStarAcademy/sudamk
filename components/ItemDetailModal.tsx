import React from 'react';
import { InventoryItem, ItemGrade } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';

import { useAppContext } from '../hooks/useAppContext.js';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { isActionPointConsumable } from '../constants/items';
import { MythicOptionAbbrev } from './MythicStatAbbrev.js';

interface ItemDetailModalProps {
    item: InventoryItem;
    isOwnedByCurrentUser: boolean;
    onClose: () => void;
    onStartEnhance: (item: InventoryItem) => void;
    onStartRefine: (item: InventoryItem) => void;
    isTopmost?: boolean;
}

/** 원본과 동일한 색 의미, 디테일만 정돈 */
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
        background: '/images/equipments/transcendentbgi.png',
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
            className="absolute left-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-br-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
            <img src={starImage} alt="" className="h-3 w-3" />
            <span className={`text-xs font-bold leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, isOwnedByCurrentUser, onClose, onStartEnhance, onStartRefine, isTopmost }) => {
    const { currentUserWithStatus } = useAppContext();
    const styles = gradeStyles[item.grade];

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = (currentUserWithStatus?.strategyLevel || 0) + (currentUserWithStatus?.playfulLevel || 0);
    const canEquip = userLevelSum >= requiredLevel;

    const refinementCount = (item as { refinementCount?: number }).refinementCount ?? 0;
    const canRefine = item.type === 'equipment' && item.grade !== ItemGrade.Normal && refinementCount > 0;
    const isTranscendent = item.grade === ItemGrade.Transcendent;

    return (
        <DraggableWindow
            title="장비 상세 정보"
            onClose={onClose}
            windowId={`item-detail-${item.id}`}
            initialWidth={350}
            isTopmost={isTopmost}
        >
            <div className="flex h-full flex-col">
                {/* 상단: 원본과 동일 — 좌 이미지, 우 이름·등급·레벨·제련·주옵션 */}
                <div
                    className={`relative mb-4 overflow-hidden rounded-xl bg-gradient-to-br p-[1px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] ${styles.frame}`}
                >
                    <div className="flex items-start justify-between rounded-[11px] bg-zinc-950/90 px-3 py-3 ring-1 ring-inset ring-white/[0.06]">
                        <div
                            className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-lg shadow-inner ring-1 ring-black/40 ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
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
                        <div className="ml-4 min-w-0 flex-grow text-right">
                            <div className="flex items-baseline justify-end gap-1">
                                <h3 className={`text-xl font-bold tracking-tight ${styles.color}`}>{item.name}</h3>
                            </div>
                            <p className={`text-sm font-medium ${styles.color}`}>[{styles.name}]</p>
                            <p className={`text-xs ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>(착용레벨: {requiredLevel})</p>
                            {item.type === 'equipment' && item.grade !== 'normal' && (
                                <p
                                    className={`text-xs font-semibold ${refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`}
                                >
                                    제련 가능: {refinementCount > 0 ? `${refinementCount}회` : '제련불가'}
                                </p>
                            )}
                            {item.options?.main && (
                                <p className="mt-1 text-sm font-semibold leading-snug text-amber-300/95 drop-shadow-sm">
                                    {item.options.main.display}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 하단: 원본과 동일 — 전투/특수/신화 부옵션만, 섹션 제목 없이 색으로 구분 */}
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30">
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
                                        {opt.display}
                                    </p>
                                ))}
                            </div>
                        )}
                        {item.options?.mythicSubs && item.options.mythicSubs.length > 0 && (
                            <div className="space-y-0.5">
                                {item.options.mythicSubs.map((opt, i) => (
                                    <p key={i} className="text-red-400">
                                        <MythicOptionAbbrev option={opt} textClassName="text-red-400" />
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {isOwnedByCurrentUser && item.type === 'equipment' && (
                    <div className="mt-5 w-full space-y-2 border-t border-white/10 pt-4">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => onStartEnhance(item)}
                                disabled={item.stars >= 10}
                                colorScheme="yellow"
                                className="min-w-0 flex-1 font-semibold shadow-md shadow-amber-950/25"
                            >
                                {item.stars >= 10 ? '최대 강화' : '강화하기'}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => onStartRefine(item)}
                                disabled={!canRefine}
                                colorScheme="blue"
                                className="min-w-0 flex-1 font-semibold shadow-md shadow-slate-900/30"
                                title={!canRefine ? '제련할 수 없습니다' : '대장간 제련 탭으로 이동'}
                            >
                                제련
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default ItemDetailModal;
