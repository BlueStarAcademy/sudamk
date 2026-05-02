import React, { useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext.js';
import { CORE_STATS_DATA } from '../../constants/index.js';
import type { InventoryItem, PairPetMeta, User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { getXpRequirementForLevel } from '../../shared/utils/strategyLevelXp.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import { getPairPetDisplayName } from '../../shared/constants/petLobby.js';
import {
    effectivePairPetGradeFromRow,
    PAIR_PET_MAX_LEVEL,
    pairPetXpGainBlockedByGrade,
} from '../../shared/constants/pairPetGrade.js';
import { gradeBackgrounds, gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';
import { pairPetKataAbilityScore, type PairPetKataPhase } from '../../shared/constants/pairArena.js';
import { computePairPetKataCoreStatsSixFromMeta } from '../../shared/utils/pairPetKataStatsFromMeta.js';
import PairPetCoreStatsGrid, { computePairPetBadukTotalPower } from './PairPetCoreStatsGrid.js';

function dispositionLabel(meta: PairPetMeta['disposition']): string {
    if (meta.kind === 'all') {
        return `모든 능력치 +${meta.pct}%`;
    }
    const name = CORE_STATS_DATA[meta.stat]?.name ?? meta.stat;
    return `${name} +${meta.pct}%`;
}

function specializationLabel(spec: PairPetMeta['specialization']): string {
    switch (spec.kind) {
        case 'trainingXp':
            return `수련 경험치 +${spec.pct}%`;
        case 'trainingGold':
            return `수련 골드 +${spec.pct}%`;
        case 'trainingTime':
            return `수련 시간 -${spec.pct}%`;
        case 'soulDrop':
            return `영혼석 획득 확률 +${spec.pct}%`;
        default:
            return '';
    }
}

export interface PairPetDetailCardBodyProps {
    currentUser: User;
    item: InventoryItem;
    /** 모달은 `modal`, 로비 정보 패널은 `panel` */
    statsGridVariant: 'modal' | 'panel';
    /** 로비 정보 패널 등: 대표 펫이면 등급 라벨 옆에 배지 */
    showRepresentativeBadge?: boolean;
}

/** 펫 획득 모달·로비 정보 뷰어 공통 — 등급 배경·히어로·특수능력·6능력치 그리드 */
const PairPetDetailCardBody: React.FC<PairPetDetailCardBodyProps> = ({
    currentUser,
    item,
    statsGridVariant,
    showRepresentativeBadge = false,
}) => {
    const { kataServerRuntimeConfig } = useAppContext();
    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(item), [item]);

    const petGrade = effectivePairPetGradeFromRow(item);
    const heroBg = gradeBackgrounds[petGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const gradeStyle = gradeStyles[petGrade];
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[petGrade] ?? petGrade;

    const displayName = useMemo(() => getPairPetDisplayName(item), [item]);
    const levelSafe = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    const xpBlocked = pairPetXpGainBlockedByGrade(petGrade, levelSafe);
    const maxXp = xpBlocked ? 0 : getXpRequirementForLevel(levelSafe);
    const xpPct =
        xpBlocked || !Number.isFinite(maxXp) || maxXp <= 0
            ? 0
            : Math.min(100, ((meta.xp ?? 0) / maxXp) * 100);

    const isModal = statsGridVariant === 'modal';

    const kataCoreSix = useMemo(() => computePairPetKataCoreStatsSixFromMeta(meta, petGrade), [meta, petGrade]);
    const badukTotalPower = useMemo(
        () => computePairPetBadukTotalPower(currentUser, meta.disposition, petGrade, meta.levelUpCoreBonuses),
        [currentUser, meta.disposition, petGrade, meta.levelUpCoreBonuses],
    );
    const phaseScores = useMemo(() => {
        const phases: PairPetKataPhase[] = ['opening', 'midgame', 'endgame'];
        const w = kataServerRuntimeConfig?.pairPet?.phaseWeights;
        const out: Partial<Record<PairPetKataPhase, number>> = {};
        for (const p of phases) {
            out[p] = w ? pairPetKataAbilityScore(p, kataCoreSix, w) : pairPetKataAbilityScore(p, kataCoreSix);
        }
        return out as Record<PairPetKataPhase, number>;
    }, [kataCoreSix, kataServerRuntimeConfig?.pairPet?.phaseWeights]);

    return (
        <div className={`flex w-full min-w-0 flex-col ${isModal ? 'gap-2.5 sm:gap-4' : 'gap-4'}`}>
            <div className="relative overflow-hidden rounded-2xl p-[1px] shadow-[0_16px_44px_-12px_rgba(0,0,0,0.7)] ring-1 ring-fuchsia-400/35">
                <img
                    src={heroBg}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.38]"
                    aria-hidden
                />
                <div
                    className={`relative flex rounded-[15px] bg-zinc-950/90 ring-1 ring-inset ring-white/[0.08] ${
                        isModal
                            ? 'flex-row items-center gap-2.5 p-2.5 sm:gap-5 sm:p-4'
                            : 'flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5'
                    }`}
                >
                    <div
                        className={`relative shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-black/50 shadow-inner ${
                            isModal
                                ? `mx-0 h-[5.75rem] w-[5.75rem] sm:h-[8.25rem] sm:w-[8.25rem] ${petGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`
                                : `mx-auto h-[7.25rem] w-[7.25rem] sm:mx-0 sm:h-[8.25rem] sm:w-[8.25rem] ${petGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`
                        }`}
                    >
                        <img
                            src={heroBg}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-80"
                            aria-hidden
                        />
                        <img
                            src={item.image}
                            alt=""
                            className="relative z-[1] h-full w-full object-contain p-2 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
                            loading="lazy"
                        />
                    </div>
                    <div className={`min-w-0 flex-1 ${isModal ? 'text-left' : 'text-center sm:text-left'}`}>
                        <div
                            className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
                                isModal ? 'justify-start' : 'justify-center sm:justify-start'
                            }`}
                        >
                            <span
                                className={`shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[0.65rem] font-extrabold ${gradeStyle.color} bg-black/45`}
                            >
                                {gradeKo}
                            </span>
                            {showRepresentativeBadge ? (
                                <span className="shrink-0 rounded-md border border-cyan-400/55 bg-cyan-950/65 px-2 py-0.5 text-[0.65rem] font-extrabold text-cyan-50">
                                    대표펫
                                </span>
                            ) : null}
                        </div>
                        <div
                            className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
                                isModal ? 'justify-start' : 'justify-center sm:justify-start'
                            }`}
                        >
                            <span
                                className={`shrink-0 font-bold tabular-nums text-amber-200 ${
                                    isModal ? 'text-sm sm:text-lg' : 'text-base sm:text-lg'
                                }`}
                            >
                                Lv.{levelSafe}
                            </span>
                            <h3
                                className={`max-w-full min-w-0 truncate font-black leading-tight tracking-tight text-fuchsia-50 ${
                                    isModal ? 'text-base sm:text-xl' : 'text-lg sm:text-xl'
                                }`}
                            >
                                {displayName}
                            </h3>
                        </div>
                        <div className={isModal ? 'mt-1.5 space-y-1' : 'mt-3 space-y-2'}>
                            <div
                                className={`flex flex-wrap items-center gap-x-2 text-xs font-medium text-slate-400 ${
                                    isModal ? 'justify-start sm:text-sm' : 'justify-center sm:justify-start sm:text-sm'
                                }`}
                            >
                                {xpBlocked ? (
                                    <span
                                        className={`shrink-0 rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[0.62rem] font-extrabold leading-none text-amber-100 sm:text-xs ${
                                            isModal ? 'text-left' : 'text-center sm:text-left'
                                        }`}
                                    >
                                        등급 강화 필요
                                    </span>
                                ) : (
                                    <span className="font-mono font-semibold tabular-nums text-slate-400">
                                        EXP {(meta.xp ?? 0).toLocaleString()} /{' '}
                                        {Number.isFinite(maxXp) ? maxXp.toLocaleString() : '—'}
                                    </span>
                                )}
                            </div>
                            <div
                                className={`${isModal ? 'h-2' : 'h-2.5'} w-full max-w-md rounded-full border sm:max-w-none ${
                                    xpBlocked
                                        ? 'border-amber-900/50 bg-amber-950/40'
                                        : 'border-zinc-800/90 bg-zinc-900/90'
                                }`}
                            >
                                <div
                                    className={`h-full rounded-full ${
                                        xpBlocked
                                            ? 'bg-gradient-to-r from-amber-800/40 to-amber-950/20'
                                            : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-400'
                                    }`}
                                    style={{ width: `${xpPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={`grid min-w-0 ${
                    isModal ? 'grid-cols-2 gap-2 sm:gap-3' : 'grid-cols-1 gap-3 sm:grid-cols-2'
                }`}
            >
                <div
                    className={`rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/35 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                        isModal ? 'min-w-0 px-2.5 py-2 sm:px-4 sm:py-3' : 'px-4 py-3'
                    }`}
                >
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-fuchsia-200/85 sm:text-[0.65rem]">
                        성향
                    </p>
                    <p
                        className={`mt-1 font-semibold leading-snug text-fuchsia-50/95 ${
                            isModal ? 'text-[0.7rem] sm:text-[0.95rem]' : 'mt-1.5 text-sm sm:text-[0.95rem]'
                        }`}
                    >
                        {dispositionLabel(meta.disposition)}
                    </p>
                </div>
                <div
                    className={`rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/25 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                        isModal ? 'min-w-0 px-2.5 py-2 sm:px-4 sm:py-3' : 'px-4 py-3'
                    }`}
                >
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-amber-200/85 sm:text-[0.65rem]">
                        특화
                    </p>
                    <p
                        className={`mt-1 font-semibold leading-snug text-amber-50/95 ${
                            isModal ? 'text-[0.7rem] sm:text-[0.95rem]' : 'mt-1.5 text-sm sm:text-[0.95rem]'
                        }`}
                    >
                        {specializationLabel(meta.specialization)}
                    </p>
                </div>
            </div>

            <div
                className={`flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [scrollbar-width:thin] sm:gap-x-3 sm:px-3 sm:py-2 ${
                    isModal ? 'justify-start' : 'justify-center sm:justify-start'
                }`}
            >
                <span className="inline-flex shrink-0 items-baseline gap-1">
                    <span className="text-[0.62rem] font-bold text-amber-100 sm:text-xs">바둑능력</span>
                    <span
                        className={`font-mono font-black tabular-nums text-amber-50 ${
                            isModal ? 'text-sm sm:text-base' : 'text-base'
                        }`}
                    >
                        {badukTotalPower}
                    </span>
                </span>
                <span className="h-3.5 w-px shrink-0 self-center bg-white/15" aria-hidden />
                {(
                    [
                        { phase: 'opening' as const, label: '초반' },
                        { phase: 'midgame' as const, label: '중반' },
                        { phase: 'endgame' as const, label: '종반' },
                    ] as const
                ).map(({ phase, label }, idx) => (
                    <React.Fragment key={phase}>
                        {idx > 0 ? <span className="h-3.5 w-px shrink-0 self-center bg-white/12" aria-hidden /> : null}
                        <span className="inline-flex shrink-0 items-baseline gap-0.5">
                            <span className="text-[0.58rem] font-semibold text-slate-400 sm:text-xs">{label}</span>
                            <span
                                className={`font-mono font-bold tabular-nums text-sky-100 ${
                                    isModal ? 'text-xs sm:text-sm' : 'text-sm'
                                }`}
                            >
                                {phaseScores[phase]}
                            </span>
                        </span>
                    </React.Fragment>
                ))}
            </div>

            <PairPetCoreStatsGrid
                currentUser={currentUser}
                disposition={meta.disposition}
                petGrade={petGrade}
                levelUpCoreBonuses={meta.levelUpCoreBonuses}
                variant={statsGridVariant}
            />
        </div>
    );
};

export default PairPetDetailCardBody;
