import React, { useMemo, useState } from 'react';
import { getSinglePlayerStages, SINGLE_PLAYER_CLASS_BAR_REWARDS } from '../../constants/singlePlayerConstants.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { SinglePlayerLevel } from '../../types.js';
import type { SinglePlayerStageInfo } from '../../types.js';
import { getItemTemplateByName } from '../../utils/itemTemplateLookup.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';

const CLASS_TABS: { level: SinglePlayerLevel; label: string }[] = [
    { level: SinglePlayerLevel.입문, label: '입문반' },
    { level: SinglePlayerLevel.초급, label: '초급반' },
    { level: SinglePlayerLevel.중급, label: '중급반' },
    { level: SinglePlayerLevel.고급, label: '고급반' },
    { level: SinglePlayerLevel.유단자, label: '유단자' },
];

type RewardCell = SinglePlayerStageInfo['rewards']['firstClear'];

const resolveItemImageSrc = (itemId: string): string | null => {
    const t = getItemTemplateByName(itemId);
    const raw = (t as { image?: string } | null)?.image;
    if (!raw) return null;
    return raw.startsWith('/') ? raw : `/${raw}`;
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

/** 최초 클리어 `bonus` 필드: `스탯10` / `능력치10` 등 → 표시만 「보너스 능력치 +10」 */
const formatStatBonusBadge = (
    bonus: string
): { label: string; value: string } | null => {
    const m = bonus.match(/^(?:스탯|능력치)\s*(\d+)$/);
    if (!m) return null;
    return { label: '보너스 능력치', value: `+${m[1]}` };
};

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
                    value={`+${formatGoldAmountKoG(reward.gold ?? 0)}`}
                    icon={<img src="/images/icon/Gold.webp" alt="" className="h-4 w-4 object-contain" />}
                />
            )}
            {hasExp && (
                <RewardBadge
                    tone="exp"
                    label="EXP"
                    value={`+${(reward.exp ?? 0).toLocaleString()}`}
                    icon={<ExpIcon />}
                />
            )}
            {hasItems &&
                reward.items!.map((item, idx) => {
                    const image = resolveItemImageSrc(item.itemId);
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
            {hasBonus &&
                (() => {
                    const statFmt = formatStatBonusBadge(String(reward.bonus));
                    if (statFmt) {
                        return <RewardBadge tone="bonus" label={statFmt.label} value={statFmt.value} />;
                    }
                    return <RewardBadge tone="bonus" label="보너스" value={String(reward.bonus)} />;
                })()}
        </div>
    );
};

export interface SinglePlayerRewardsTableProps {
    /** 첫 마운트 시 선택할 반 (모달을 열 때마다 언마운트되면 이 값으로 탭이 시작됨) */
    initialClassWhenModalOpens?: SinglePlayerLevel;
}

/**
 * 싱글플레이 스테이지의 최초 클리어 보상 표 (반별 탭).
 * 데이터 원본: `constants/singlePlayerConstants.ts` · `shared/constants/singlePlayerConstants.ts` 의 `rewards`.
 */
const SinglePlayerRewardsTable: React.FC<SinglePlayerRewardsTableProps> = ({
    initialClassWhenModalOpens,
}) => {
    const { singlePlayerStagesListRevision } = useAppContext();
    const [activeLevel, setActiveLevel] = useState<SinglePlayerLevel>(
        initialClassWhenModalOpens ?? SinglePlayerLevel.입문
    );

    const stagesForTab = useMemo(() => {
        return getSinglePlayerStages().filter((s) => s.level === activeLevel).sort((a, b) => {
            const aNum = parseInt(a.id.split('-')[1], 10);
            const bNum = parseInt(b.id.split('-')[1], 10);
            return aNum - bNum;
        });
    }, [activeLevel, singlePlayerStagesListRevision]);

    const classBarDef = SINGLE_PLAYER_CLASS_BAR_REWARDS[activeLevel];
    const classBarLabel = CLASS_TABS.find((t) => t.level === activeLevel)?.label ?? activeLevel;

    const apBadgeForTable = (itemId: string): string | null => {
        if (itemId.startsWith('행동력 회복제')) {
            const m = itemId.match(/\(\+(\d+)\)/);
            return m ? `+${m[1]}` : null;
        }
        return null;
    };

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

            <div className="mb-2 rounded-md border border-amber-600/35 bg-gradient-to-r from-amber-950/40 via-gray-900/80 to-emerald-950/30 px-3 py-2 text-[12px] sm:text-[13px] leading-snug">
                <p className="mb-1.5 font-semibold text-amber-100/95">{classBarLabel} · 클리어 수 추가 보상 (대기실 막대에서 수령)</p>
                <div className="flex flex-col gap-1.5 text-gray-200 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="shrink-0 font-semibold tabular-nums text-slate-300">10개</span>
                        {(() => {
                            const { itemId, quantity } = classBarDef.milestone10;
                            const ap = apBadgeForTable(itemId);
                            const src = ap ? null : resolveItemImageSrc(itemId);
                            return (
                                <RewardBadge
                                    tone="item"
                                    label={itemId}
                                    value={`×${quantity}`}
                                    icon={
                                        ap ? (
                                            <span className="relative inline-flex h-4 w-4 items-center justify-center text-[11px]">
                                                ⚡
                                                <span className="absolute -right-1 -top-0.5 rounded bg-gray-900/95 px-0.5 text-[8px] font-bold text-cyan-300">
                                                    {ap}
                                                </span>
                                            </span>
                                        ) : src ? (
                                            <img src={src} alt="" className="h-4 w-4 object-contain" />
                                        ) : (
                                            <span className="inline-flex h-4 w-4 items-center justify-center text-[12px]">🎁</span>
                                        )
                                    }
                                    title={itemId}
                                />
                            );
                        })()}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="shrink-0 font-semibold tabular-nums text-slate-300">20개</span>
                        {(() => {
                            const { itemId, quantity } = classBarDef.milestone20;
                            const ap = apBadgeForTable(itemId);
                            const src = ap ? null : resolveItemImageSrc(itemId);
                            return (
                                <RewardBadge
                                    tone="item"
                                    label={itemId}
                                    value={`×${quantity}`}
                                    icon={
                                        ap ? (
                                            <span className="relative inline-flex h-4 w-4 items-center justify-center text-[11px]">
                                                ⚡
                                                <span className="absolute -right-1 -top-0.5 rounded bg-gray-900/95 px-0.5 text-[8px] font-bold text-cyan-300">
                                                    {ap}
                                                </span>
                                            </span>
                                        ) : src ? (
                                            <img src={src} alt="" className="h-4 w-4 object-contain" />
                                        ) : (
                                            <span className="inline-flex h-4 w-4 items-center justify-center text-[12px]">🎁</span>
                                        )
                                    }
                                    title={itemId}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="rounded-md border border-gray-600 overflow-hidden bg-gray-900/80 min-h-0 flex flex-col">
                <div className="overflow-auto max-h-[min(52vh,420px)]">
                    <table className="w-full text-left text-sm sm:text-[15px] border-collapse">
                        <thead className="sticky top-0 z-[1]">
                            <tr className="bg-gray-800 text-amber-200/95 border-b border-gray-600">
                                <th className="px-3 py-2.5 font-semibold whitespace-nowrap border-r border-gray-600">
                                    스테이지 ID
                                </th>
                                <th className="px-3 py-2.5 font-semibold min-w-[220px]">
                                    최초 클리어 (골드·EXP·장비 등)
                                </th>
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
                                        <td className="px-3 py-2.5 align-top text-emerald-200/90 leading-snug">
                                            <RewardBadges reward={stage.rewards?.firstClear} />
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
