import React, { useLayoutEffect, useMemo, useRef } from 'react';
import Avatar from '../Avatar.js';
import type { User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../../shared/constants/petLobby.js';
import { effectivePairPetGradeFromRow, PAIR_PET_MAX_LEVEL } from '../../shared/constants/pairPetGrade.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import { computePairPetBadukTotalPower } from './PairPetCoreStatsGrid.js';
import { gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';

/** 한 줄 안에 들어가도록 줄이는 최소·최대 글자 크기(px) */
const PET_PROFILE_LINE_FONT_MIN = 6.75;
const PET_PROFILE_LINE_FONT_MAX = 15;

export interface PairPetProfilePanelProps {
    currentUser: User;
    currentUserId: string;
    isBusy: boolean;
    /** 대표 펫이 있을 때 상세 모달 열기 */
    onOpenEquippedPetDetail: () => void;
}

const PairPetProfilePanel: React.FC<PairPetProfilePanelProps> = ({
    currentUser,
    currentUserId,
    isBusy,
    onOpenEquippedPetDetail,
}) => {
    const equippedTid = currentUser.equippedPairPetTemplateId ?? null;
    const equippedDef = equippedTid ? getPairPetDefinition(equippedTid) : null;
    const equippedItem = useMemo(
        () => (equippedTid ? getEquippedPairPetInventoryRow(currentUser) : null),
        [currentUser, equippedTid],
    );

    const petMeta = useMemo(() => {
        if (!equippedItem) return null;
        return resolvePairPetMetaFromInventoryRow(equippedItem);
    }, [equippedItem]);

    const petGrade = equippedItem ? effectivePairPetGradeFromRow(equippedItem) : ItemGrade.Normal;
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[petGrade] ?? petGrade;
    const gradeStyle = gradeStyles[petGrade] ?? gradeStyles[ItemGrade.Normal];
    const badukTotal = useMemo(() => {
        if (!petMeta || !equippedItem) return null;
        return computePairPetBadukTotalPower(
            currentUser,
            petMeta.disposition,
            petGrade,
            petMeta.levelUpCoreBonuses
        );
    }, [currentUser, petMeta, petGrade, equippedItem]);

    const petAvatarUrl = equippedDef?.image ?? '/images/pets/pet1.webp';
    const emptyTitle = '장착된 펫 없음';
    const displayName = equippedItem ? getPairPetDisplayName(equippedItem) : (equippedDef?.displayName ?? emptyTitle);
    const levelSafe =
        petMeta != null ? Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(petMeta.level) || 1)) : null;

    const lineOuterRef = useRef<HTMLDivElement>(null);
    const lineInnerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const outer = lineOuterRef.current;
        const inner = lineInnerRef.current;
        if (!outer || !inner) return;

        const fitLineFont = () => {
            let px = PET_PROFILE_LINE_FONT_MAX;
            inner.style.fontSize = `${px}px`;
            let guard = 0;
            while (inner.offsetWidth > outer.clientWidth && px > PET_PROFILE_LINE_FONT_MIN && guard < 48) {
                px -= 0.4;
                inner.style.fontSize = `${px}px`;
                guard += 1;
            }
        };

        fitLineFont();
        const ro = new ResizeObserver(fitLineFont);
        ro.observe(outer);
        return () => ro.disconnect();
    }, [displayName, levelSafe, badukTotal, equippedItem, gradeKo]);

    return (
        <div className="shrink-0 rounded-lg border border-violet-400/25 bg-gradient-to-br from-violet-950/40 via-black/35 to-fuchsia-950/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex min-h-0 min-w-0 flex-nowrap items-center gap-2 sm:gap-2.5">
                <Avatar
                    userId={`pet-ai-${currentUserId}`}
                    userName={displayName}
                    size={44}
                    avatarUrl={petAvatarUrl}
                    className="shrink-0 ring-2 ring-violet-400/40"
                />
                <div
                    ref={lineOuterRef}
                    className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <div
                        ref={lineInnerRef}
                        className="inline-flex max-w-none flex-nowrap items-center gap-x-[0.45em] gap-y-0 whitespace-nowrap leading-tight"
                        style={{ fontSize: `${PET_PROFILE_LINE_FONT_MAX}px` }}
                    >
                        <span className="inline-flex shrink-0 items-baseline gap-x-[0.35em]">
                            {equippedItem ? (
                                <span
                                    className={`inline-flex shrink-0 rounded-md border border-white/18 px-[0.35em] py-px text-[0.82em] font-extrabold leading-none ${gradeStyle.color} bg-black/50`}
                                >
                                    {gradeKo}
                                </span>
                            ) : null}
                            {levelSafe != null ? (
                                <span className="font-black tabular-nums text-amber-200">Lv.{levelSafe}</span>
                            ) : null}
                            <span className="font-semibold text-violet-100/95">{displayName}</span>
                        </span>
                        {badukTotal != null ? (
                            <span
                                className="relative inline-flex shrink-0 items-baseline gap-x-[0.25em] rounded-md border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-[0.45em] py-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                title="6코어 표시값과 성향 보너스 합계"
                            >
                                <span
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                                    aria-hidden
                                />
                                <span className="relative shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text font-bold tracking-tight text-transparent opacity-95">
                                    바둑능력
                                </span>
                                <span
                                    className="relative bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text font-mono font-black tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                                    style={{ fontSize: '1.08em' }}
                                    title="6개 핵심 능력치 합계"
                                >
                                    {badukTotal}
                                </span>
                            </span>
                        ) : null}
                    </div>
                </div>
                {equippedItem ? (
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenEquippedPetDetail()}
                        className="ml-auto shrink-0 rounded-md border border-cyan-400/40 bg-cyan-950/45 px-2 py-1 text-xs font-bold text-cyan-50 hover:bg-cyan-900/55 disabled:opacity-40 sm:px-2.5 sm:text-sm"
                    >
                        상세정보
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default PairPetProfilePanel;
