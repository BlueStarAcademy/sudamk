import React, { useMemo, useState } from 'react';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { SinglePlayerLevel } from '../../types.js';
import type { SinglePlayerStageInfo } from '../../types.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, EQUIPMENT_POOL } from '../../constants/index.js';

const CLASS_TABS: { level: SinglePlayerLevel; label: string }[] = [
    { level: SinglePlayerLevel.입문, label: '입문반' },
    { level: SinglePlayerLevel.초급, label: '초급반' },
    { level: SinglePlayerLevel.중급, label: '중급반' },
    { level: SinglePlayerLevel.고급, label: '고급반' },
    { level: SinglePlayerLevel.유단자, label: '유단자' },
];

type RewardCell = SinglePlayerStageInfo['rewards']['firstClear'];

const resolveItemImage = (itemId: string): string | null => {
    const c = CONSUMABLE_ITEMS.find((it) => it.name === itemId);
    if (c?.image) return c.image;
    if (MATERIAL_ITEMS[itemId]?.image) return MATERIAL_ITEMS[itemId].image;
    const eq = EQUIPMENT_POOL.find((it) => it.name === itemId);
    return eq?.image ?? null;
};

const RewardBadge: React.FC<{
    icon?: React.ReactNode;
    label: string;
    value: string;
    tone: 'gold' | 'exp' | 'item' | 'bonus';
    title?: string;
}> = ({ icon, label, value, tone, title }) => {
    const toneClass =
        tone === 'gold'
            ? 'border-amber-500/35 bg-amber-950/30 text-amber-100'
            : tone === 'exp'
              ? 'border-emerald-500/35 bg-emerald-950/25 text-emerald-100'
              : tone === 'item'
                ? 'border-violet-500/35 bg-violet-950/25 text-violet-100'
                : 'border-sky-500/35 bg-sky-950/25 text-sky-100';
    return (
        <div
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-semibold leading-none shadow-sm ${toneClass}`}
            title={title}
        >
            {icon}
            <span className="font-bold tracking-tight">{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    );
};

const ExpIcon: React.FC = () => (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/25 text-[10px] font-black leading-none text-emerald-100 ring-1 ring-emerald-300/30">
        EXP
    </span>
);

const RewardBadges: React.FC<{ reward: RewardCell | undefined }> = ({ reward }) => {
    if (!reward) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    const hasGold = typeof reward.gold === 'number' && reward.gold > 0;
    const hasExp = typeof reward.exp === 'number' && reward.exp > 0;
    const hasItems = Array.isArray(reward.items) && reward.items.length > 0;
    const hasBonus = typeof reward.bonus === 'string' && reward.bonus.length > 0;

    if (!hasGold && !hasExp && !hasItems && !hasBonus) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {hasGold && (
                <RewardBadge
                    tone="gold"
                    label="골드"
                    value={`+${(reward.gold ?? 0).toLocaleString()}`}
                    icon={<img src="/images/icon/Gold.png" alt="" className="h-4 w-4 object-contain" />}
                />
            )}
            {hasExp && (
                <RewardBadge
                    tone="exp"
                    label="전략EXP"
                    value={`+${(reward.exp ?? 0).toLocaleString()}`}
                    icon={<ExpIcon />}
                />
            )}
            {hasItems &&
                reward.items!.map((item, idx) => {
                    const image = resolveItemImage(item.itemId);
                    return (
                        <RewardBadge
                            key={`${item.itemId}-${idx}`}
                            tone="item"
                            label={item.itemId}
                            value={`x${item.quantity.toLocaleString()}`}
                            icon={
                                image ? (
                                    <img src={image} alt="" className="h-4 w-4 object-contain" />
                                ) : (
                                    <span className="inline-flex h-4 w-4 items-center justify-center text-[12px]">🎁</span>
                                )
                            }
                            title={item.itemId}
                        />
                    );
                })}
            {hasBonus && <RewardBadge tone="bonus" label="보너스" value={String(reward.bonus)} />}
        </div>
    );
};

export interface SinglePlayerRewardsTableProps {
    /** 첫 마운트 시 선택할 반 (모달을 열 때마다 언마운트되면 이 값으로 탭이 시작됨) */
    initialClassWhenModalOpens?: SinglePlayerLevel;
}

/**
 * 싱글플레이 스테이지의 최초 클리어 / 재도전 클리어 보상 표 (반별 탭).
 * 데이터 원본: `constants/singlePlayerConstants.ts` · `shared/constants/singlePlayerConstants.ts` 의 `rewards`.
 */
const SinglePlayerRewardsTable: React.FC<SinglePlayerRewardsTableProps> = ({
    initialClassWhenModalOpens,
}) => {
    const [activeLevel, setActiveLevel] = useState<SinglePlayerLevel>(
        initialClassWhenModalOpens ?? SinglePlayerLevel.입문
    );

    const stagesForTab = useMemo(() => {
        return SINGLE_PLAYER_STAGES.filter((s) => s.level === activeLevel).sort((a, b) => {
            const aNum = parseInt(a.id.split('-')[1], 10);
            const bNum = parseInt(b.id.split('-')[1], 10);
            return aNum - bNum;
        });
    }, [activeLevel]);

    return (
        <div className="flex flex-col gap-2 min-h-0">
            <div
                className="flex flex-wrap gap-1 sm:gap-1.5 border-b border-gray-600 pb-2"
                role="tablist"
                aria-label="단계별 보상"
            >
                {CLASS_TABS.map(({ level, label }) => {
                    const selected = activeLevel === level;
                    return (
                        <button
                            key={level}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setActiveLevel(level)}
                            className={`
                                rounded-md px-2.5 py-1.5 text-[12px] sm:text-sm font-semibold transition-colors
                                border
                                ${
                                    selected
                                        ? 'border-amber-500/80 bg-amber-900/50 text-amber-100 shadow-sm'
                                        : 'border-gray-600/80 bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 hover:text-gray-100'
                                }
                            `}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="rounded-md border border-gray-600 overflow-hidden bg-gray-900/80 min-h-0 flex flex-col">
                <div className="overflow-auto max-h-[min(52vh,420px)]">
                    <table className="w-full text-left text-sm sm:text-[15px] border-collapse">
                        <thead className="sticky top-0 z-[1]">
                            <tr className="bg-gray-800 text-amber-200/95 border-b border-gray-600">
                                <th className="px-3 py-2.5 font-semibold whitespace-nowrap border-r border-gray-600">
                                    스테이지 ID
                                </th>
                                <th className="px-3 py-2.5 font-semibold min-w-[220px] border-r border-gray-600">
                                    최초 클리어
                                </th>
                                <th className="px-3 py-2.5 font-semibold min-w-[220px]">재도전 클리어</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-200">
                            {stagesForTab.map((stage) => {
                                return (
                                    <tr
                                        key={stage.id}
                                        className="border-b border-gray-700/80 odd:bg-gray-800/40 hover:bg-gray-700/30"
                                    >
                                        <td className="px-3 py-2.5 align-top font-mono text-[13px] sm:text-sm text-amber-100/90 border-r border-gray-700/80 whitespace-nowrap">
                                            {stage.id}
                                        </td>
                                        <td className="px-3 py-2.5 align-top text-emerald-200/90 border-r border-gray-700/80 leading-snug">
                                            <RewardBadges reward={stage.rewards?.firstClear} />
                                        </td>
                                        <td className="px-3 py-2.5 align-top text-sky-200/85 leading-snug">
                                            <RewardBadges reward={stage.rewards?.repeatClear} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SinglePlayerRewardsTable;
