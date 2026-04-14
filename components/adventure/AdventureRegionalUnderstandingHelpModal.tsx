import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import {
    ADVENTURE_UNDERSTANDING_TIER_LABELS,
    ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS,
} from '../../constants/adventureConstants.js';
import {
    ADVENTURE_REGIONAL_BUFF_ACTION_GOLD,
    ADVENTURE_REGIONAL_SPECIALTY_KINDS,
    enhancementPointsGrantedTotalForTier,
    labelRegionalSpecialtyBuffEntry,
    migrateRegionalBuffEntry,
    slotCountForUnderstandingTier,
} from '../../utils/adventureRegionalSpecialtyBuff.js';

type Props = {
    onClose: () => void;
    isTopmost?: boolean;
};

const AdventureRegionalUnderstandingHelpModal: React.FC<Props> = ({ onClose, isTopmost }) => {
    return (
        <DraggableWindow
            title="지역 탐험도 도움말"
            onClose={onClose}
            windowId="adventure-regional-understanding-help"
            initialWidth={760}
            initialHeight={720}
            isTopmost={isTopmost}
        >
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm text-zinc-200">
                <section className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-950/20 p-3">
                    <h3 className="text-base font-bold text-fuchsia-100">지역 탐험도란?</h3>
                    <p className="mt-1 leading-relaxed text-zinc-300">
                        해당 챕터에서 몬스터와 대국할 때만 적용되는 추가 효과입니다. 지역 탐험도 XP와 등급은 챕터마다 따로
                        쌓이며, 슬롯·강화 포인트·효과 내용은 이 지역 전용으로 관리됩니다.
                    </p>
                </section>

                <section className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3">
                    <h3 className="text-base font-bold text-emerald-100">지역 탐험도 올리는 방법</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                        <li>해당 챕터에서 몬스터와 대국해 승리하면 그 챕터의 탐험도 XP가 누적됩니다.</li>
                        <li>XP가 등급 경계에 도달할 때마다 등급이 오르고, 강화 포인트가 지급되며 효과 슬롯이 하나씩 열립니다.</li>
                    </ul>
                </section>

                <section className="rounded-lg border border-white/10 bg-black/25 p-3">
                    <h3 className="text-base font-bold text-amber-100">등급 · 슬롯 · 강화 포인트</h3>
                    <ul className="mt-2 space-y-1.5">
                        {ADVENTURE_UNDERSTANDING_TIER_LABELS.map((label, idx) => {
                            const minXp = ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[idx] ?? 0;
                            const nextMin = ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[idx + 1];
                            const slots = slotCountForUnderstandingTier(idx);
                            const pts = enhancementPointsGrantedTotalForTier(idx);
                            return (
                                <li
                                    key={`${label}-${minXp}`}
                                    className="flex flex-col gap-1 rounded-md border border-white/8 bg-zinc-900/55 px-2.5 py-2"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-semibold text-zinc-100">
                                            {idx + 1}단계 · {label}
                                        </span>
                                        <span className="font-mono text-xs tabular-nums text-amber-200/90">
                                            {nextMin == null
                                                ? `${minXp.toLocaleString()} XP 이상`
                                                : `${minXp.toLocaleString()} ~ ${(nextMin - 1).toLocaleString()} XP`}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400">
                                        효과 슬롯 {slots}개 · 누적 강화 포인트 상한 {pts} (등급이 오를 때마다 +1, +2, +3, +4로
                                        총 10까지 지급)
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section className="rounded-lg border border-cyan-500/25 bg-cyan-950/15 p-3">
                    <h3 className="text-base font-bold text-cyan-100">변경 · 강화</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                        <li>
                            「변경」과 「강화」는 각각{' '}
                            <span className="font-semibold text-amber-200">{ADVENTURE_REGIONAL_BUFF_ACTION_GOLD.toLocaleString()} 골드</span>
                            가 듭니다.
                        </li>
                        <li>강화는 강화 포인트 1을 소모해 효과 수치가 한 단계씩 합연산으로 늘어나며, 종류별 최대 강화가 있습니다.</li>
                        <li>
                            강화된 효과를 「변경」으로 다시 뽑으면 확인 후 1단계 효과로 돌아가고, 그 효과에 쓰였던 강화 포인트는
                            돌려받습니다.
                        </li>
                    </ul>
                </section>

                <section className="rounded-lg border border-violet-500/25 bg-violet-950/15 p-3">
                    <h3 className="text-base font-bold text-violet-100">나올 수 있는 효과 (랜덤)</h3>
                    <ul className="mt-2 space-y-1.5">
                        {ADVENTURE_REGIONAL_SPECIALTY_KINDS.map((kind) => (
                            <li
                                key={kind}
                                className="rounded-md border border-white/8 bg-black/30 px-2 py-1.5 text-xs font-medium leading-snug text-zinc-200"
                            >
                                {labelRegionalSpecialtyBuffEntry(migrateRegionalBuffEntry({ kind, stacks: 1 }))}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </DraggableWindow>
    );
};

export default AdventureRegionalUnderstandingHelpModal;
