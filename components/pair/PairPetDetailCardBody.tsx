import React, { useMemo } from 'react';
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
import PairPetCoreStatsGrid from './PairPetCoreStatsGrid.js';

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

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl p-[1px] shadow-[0_16px_44px_-12px_rgba(0,0,0,0.7)] ring-1 ring-fuchsia-400/35">
                <img
                    src={heroBg}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.38]"
                    aria-hidden
                />
                <div className="relative flex flex-col gap-4 rounded-[15px] bg-zinc-950/90 p-4 ring-1 ring-inset ring-white/[0.08] sm:flex-row sm:items-center sm:gap-5">
                    <div
                        className={`relative mx-auto h-[7.25rem] w-[7.25rem] shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-black/50 shadow-inner sm:mx-0 sm:h-[8.25rem] sm:w-[8.25rem] ${petGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}
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
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
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
                        <div className="mt-1.5 flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1 sm:justify-start">
                            <h3 className="max-w-full truncate text-lg font-black leading-tight tracking-tight text-fuchsia-50 sm:text-xl">
                                {displayName}
                            </h3>
                            <span className="shrink-0 text-base font-bold tabular-nums text-amber-200 sm:text-lg">
                                Lv.{levelSafe}
                            </span>
                        </div>
                        <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-center gap-x-2 text-xs font-medium text-slate-400 sm:justify-start sm:text-sm">
                                {xpBlocked ? (
                                    <span className="text-center font-semibold leading-snug text-amber-200/95 sm:text-left">
                                        등급 강화 전까지 경험치를 더 받을 수 없습니다.
                                    </span>
                                ) : (
                                    <span className="font-mono font-semibold tabular-nums text-slate-400">
                                        EXP {(meta.xp ?? 0).toLocaleString()} /{' '}
                                        {Number.isFinite(maxXp) ? maxXp.toLocaleString() : '—'}
                                    </span>
                                )}
                            </div>
                            <div
                                className={`h-2.5 w-full max-w-md rounded-full border sm:max-w-none ${
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/35 to-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-fuchsia-200/85">성향</p>
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-fuchsia-50/95 sm:text-[0.95rem]">
                        {dispositionLabel(meta.disposition)}
                    </p>
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/25 to-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-200/85">특화</p>
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-amber-50/95 sm:text-[0.95rem]">
                        {specializationLabel(meta.specialization)}
                    </p>
                </div>
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
