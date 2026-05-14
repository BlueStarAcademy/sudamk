import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CORE_STATS_DATA } from '../../constants/index.js';
import type { InventoryItem, PairPetMeta, User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { getPairPetXpRequirementForLevel } from '../../shared/utils/strategyLevelXp.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import { getPairPetDisplayName } from '../../shared/constants/petLobby.js';
import {
    effectivePairPetGradeFromRow,
    PAIR_PET_MAX_LEVEL,
    pairPetXpGainBlockedByGrade,
} from '../../shared/constants/pairPetGrade.js';
import { gradeBackgrounds, gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';
import PairPetBadukPhaseStripAndCoreGrid from './PairPetBadukPhaseStripAndCoreGrid.js';
import PairPetRpsBadge from './PairPetRpsBadge.js';
import { resolvePairPetRpsAttributeFromMeta } from '../../shared/utils/pairPetRps.js';

function dispositionLabel(meta: PairPetMeta['disposition']): string {
    if (meta.kind === 'all') {
        return `모든 능력치 +${meta.pct}%`;
    }
    if (meta.kind === 'convert') {
        const fromName = CORE_STATS_DATA[meta.fromStat]?.name ?? meta.fromStat;
        const toName = CORE_STATS_DATA[meta.toStat]?.name ?? meta.toStat;
        return `${fromName} ${meta.pct}% → ${toName} (2배)`;
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
            return `수련 영혼석 획득 +${spec.pct}%`;
        case 'trainingSoulQuantityPlusOne':
            return '수련 영혼석 획득 수량 +1';
        case 'strategicArenaApMinusOne':
            return '전략 경기장 필요 행동력 -1';
        case 'pairArenaApMinusOne':
            return '페어 경기장 필요 행동력 -1';
        case 'playfulArenaApMinusOne':
            return '놀이 경기장 필요 행동력 -1';
        default:
            return '';
    }
}

/** 패널 한 칸 안에서 스크롤 없이 보이도록 균등 축소 — 빈 홈 스켈레톤 등에서 재사용 */
export const PairPetDetailFitScale: React.FC<{
    itemId: string;
    children: React.ReactNode;
    /** 스케일 대상 바깥 여백 — 테두리·링 안쪽으로 콘텐츠가 붙지 않게 */
    outerClassName?: string;
    /** 스케일 대상 안쪽(자식 flex 높이 체인 등) — 챔피언십 로비 좌측 패널 등 */
    innerClassName?: string;
    /**
     * true이고 scale이 1이면 inner 높이를 outer에 맞춤(인라인 height:auto가 h-full을 덮는 문제 방지).
     * 챔피언십 PC 좌측 유저/펫 칸이 상점 위까지 세로로 꽉 차게 할 때 사용.
     */
    stretchInnerHeightWhenUnscaled?: boolean;
}> = ({ itemId, children, outerClassName = '', innerClassName = '', stretchInnerHeightWhenUnscaled = false }) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;
        if (!outer || !inner) return;

        const update = () => {
            const iw = Math.max(inner.scrollWidth, 1);
            const ih = Math.max(inner.scrollHeight, 1);
            const sx = outer.clientWidth / iw;
            const sy = outer.clientHeight / ih;
            const next = Math.min(sx, sy, 1);
            setScale(Number.isFinite(next) && next > 0 ? next : 1);
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(outer);
        ro.observe(inner);
        return () => ro.disconnect();
    }, [itemId, stretchInnerHeightWhenUnscaled]);

    return (
        <div
            ref={outerRef}
            className={`box-border flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${outerClassName}`.trim()}
        >
            <div
                ref={innerRef}
                className={`min-h-0 min-w-0 origin-top-left will-change-transform ${innerClassName}`.trim()}
                style={{
                    transform: `scale(${scale})`,
                    width: scale < 1 ? `${100 / scale}%` : '100%',
                    height:
                        scale < 1
                            ? `${100 / scale}%`
                            : stretchInnerHeightWhenUnscaled
                              ? '100%'
                              : 'auto',
                }}
            >
                {children}
            </div>
        </div>
    );
};

export interface PairPetDetailCardBodyProps {
    currentUser: User;
    item: InventoryItem;
    /** 모달 / 로비 정보 패널 / 패널 한 화면 맞춤(홈·로비 대표펫 등) */
    statsGridVariant: 'modal' | 'panel' | 'panelFit';
    /** 로비 정보 패널 등: 대표 펫이면 등급 라벨 옆에 배지 */
    showRepresentativeBadge?: boolean;
    /** 네이티브 홈 대표펫: 줄임·스크롤 없이 `PairPetDetailFitScale`에 맡기기 위한 촘촘 레이아웃 */
    mobileHomeRepPet?: boolean;
    /** 챔피언십 로비: `mobileHomeRepPet`일 때 초·중·종반 스트립만 여유 있게 */
    enlargeHomeRepPhaseStrip?: boolean;
    /**
     * `true`면 `panelFit`일 때 내부 `PairPetDetailFitScale`을 쓰지 않음 — 부모(예: 챔피언십 로비)가 한 번만 스케일할 때 이중 축소 방지.
     */
    suppressFitScale?: boolean;
}

/**
 * 펫 상세 — 상단: 이미지·등급·이름·EXP / 하단: 성향·특화 가로 배치.
 * 그 아래: 바둑 스트립 + 6코어.
 */
const PairPetDetailCardBody: React.FC<PairPetDetailCardBodyProps> = ({
    currentUser,
    item,
    statsGridVariant,
    showRepresentativeBadge = false,
    mobileHomeRepPet = false,
    enlargeHomeRepPhaseStrip = false,
    suppressFitScale = false,
}) => {
    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(item), [item]);
    const rpsAttr = useMemo(
        () => resolvePairPetRpsAttributeFromMeta(meta, item.id, item.createdAt ?? Date.now()),
        [meta, item.id, item.createdAt],
    );

    const petGrade = effectivePairPetGradeFromRow(item);
    const petGradeBgSrc = gradeBackgrounds[petGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const gradeStyle = gradeStyles[petGrade];
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[petGrade] ?? petGrade;

    const displayName = useMemo(() => getPairPetDisplayName(item), [item]);
    const levelSafe = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    const xpBlocked = pairPetXpGainBlockedByGrade(petGrade, levelSafe);
    const maxXp = xpBlocked ? 0 : getPairPetXpRequirementForLevel(levelSafe);
    const xpPct =
        xpBlocked || !Number.isFinite(maxXp) || maxXp <= 0
            ? 0
            : Math.min(100, ((meta.xp ?? 0) / maxXp) * 100);

    const isModal = statsGridVariant === 'modal';
    const isPanelFit = statsGridVariant === 'panelFit';
    const homePack = Boolean(isPanelFit && mobileHomeRepPet);

    const rootGap = homePack ? 'gap-1' : isPanelFit ? 'gap-1' : isModal ? 'gap-2.5 sm:gap-4' : 'gap-3 sm:gap-4';

    const heroOuterRound = isPanelFit ? 'rounded-xl' : 'rounded-2xl';

    const rowPad = homePack ? 'p-1.5 sm:p-2' : isPanelFit ? 'p-1.5' : isModal ? 'p-1.5 sm:p-2' : 'p-2 sm:p-2.5';

    /** 상단 행: 이미지 3 · 우측 정보 7 */
    const heroTopGridGap = homePack ? 'gap-x-1 gap-y-1' : isModal ? 'gap-x-2.5 gap-y-1 sm:gap-x-3 sm:gap-y-1.5' : isPanelFit ? 'gap-x-2 gap-y-1 sm:gap-x-2.5' : 'gap-x-2 gap-y-1.5 sm:gap-x-3';

    const transcendentSlot = petGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : '';

    /** 이미지 열(3fr) 안에서 정사각형 — 상세(모달·로비 패널)는 max 제한 완화로 실제 픽셀 확대 */
    const imgShellClass = isPanelFit
        ? `relative aspect-square w-full overflow-hidden rounded-lg border border-white/20 bg-gradient-to-b from-zinc-800/95 to-black/90 shadow-inner ${
              homePack ? 'max-w-[3.65rem] sm:max-w-[3.95rem]' : 'max-w-full'
          } ${transcendentSlot}`
        : isModal
          ? `relative aspect-square w-full max-w-full overflow-hidden rounded-xl border border-white/20 bg-zinc-950 shadow-inner sm:rounded-2xl ${transcendentSlot}`
          : `relative aspect-square w-full max-w-full overflow-hidden rounded-xl border border-white/20 bg-gradient-to-b from-zinc-800/95 to-black/90 shadow-inner ${transcendentSlot}`;

    const petImgPad = homePack ? 'p-0.5' : isPanelFit ? 'p-px' : isModal ? 'p-0.5 sm:p-1' : 'p-1 sm:p-1.5';

    const badgeClass = isPanelFit
        ? homePack
            ? 'shrink-0 rounded border border-white/15 px-1 py-px text-[0.58rem] font-extrabold leading-none'
            : 'shrink-0 rounded border border-white/15 px-2 py-0.5 text-[0.72rem] font-extrabold sm:text-[0.78rem]'
        : isModal
          ? 'shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-xs font-extrabold sm:px-2.5 sm:py-1 sm:text-sm'
          : 'shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[0.68rem] font-extrabold sm:text-[0.72rem]';

    const repBadgeClass = isPanelFit
        ? homePack
            ? 'shrink-0 rounded border border-cyan-400/55 bg-cyan-950/65 px-0.5 py-px text-[0.54rem] font-extrabold leading-none text-cyan-50'
            : 'shrink-0 rounded border border-cyan-400/55 bg-cyan-950/65 px-1.5 py-0.5 text-[0.65rem] font-extrabold text-cyan-50 sm:text-[0.72rem]'
        : isModal
          ? 'shrink-0 rounded-md border border-cyan-400/55 bg-cyan-950/65 px-2 py-0.5 text-xs font-extrabold text-cyan-50 sm:text-sm'
          : 'shrink-0 rounded-md border border-cyan-400/55 bg-cyan-950/65 px-1.5 py-0.5 text-[0.62rem] font-extrabold text-cyan-50 sm:text-[0.68rem]';

    const lvClass = isPanelFit
        ? homePack
            ? 'shrink-0 text-[0.68rem] font-bold tabular-nums leading-none text-amber-200'
            : 'shrink-0 text-sm font-bold tabular-nums text-amber-200 sm:text-base'
        : isModal
          ? 'shrink-0 text-base font-bold tabular-nums text-amber-200 sm:text-lg'
          : 'text-sm font-bold tabular-nums text-amber-200 sm:text-base';

    const nameClass = isPanelFit
        ? homePack
            ? 'min-w-0 whitespace-nowrap text-[0.68rem] font-black leading-none tracking-tight text-fuchsia-50 sm:text-[0.72rem]'
            : 'line-clamp-2 min-w-0 text-base font-black leading-snug tracking-tight text-fuchsia-50 sm:text-lg'
        : isModal
          ? 'line-clamp-2 min-w-0 text-base font-black leading-snug tracking-tight text-fuchsia-50 sm:text-lg'
          : 'line-clamp-2 min-w-0 text-sm font-black leading-tight tracking-tight text-fuchsia-50 sm:text-base';

    const expTextClass = isPanelFit
        ? homePack
            ? 'whitespace-nowrap text-[0.56rem] font-medium leading-none text-slate-400 sm:text-[0.6rem]'
            : 'text-sm font-medium text-slate-400 sm:text-[0.95rem]'
        : isModal
          ? 'text-sm font-medium text-slate-400 sm:text-base'
          : 'text-[0.65rem] font-medium text-slate-400 sm:text-xs';

    const barH = homePack ? 'h-1.5' : isPanelFit ? 'h-2 sm:h-2' : isModal ? 'h-2.5 sm:h-3' : 'h-2 sm:h-2.5';

    const traitRowGap = homePack ? 'gap-1' : isPanelFit ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2';

    const traitBoxFuchsia = isPanelFit
        ? homePack
            ? 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
            : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-md border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-2 sm:py-1.5'
        : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-lg border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/35 to-zinc-950/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-2.5 sm:py-2';

    const traitBoxAmber = isPanelFit
        ? homePack
            ? 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-md border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-2 sm:py-1.5'
        : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-950/25 to-zinc-950/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-2.5 sm:py-2';

    const traitTitleFuchsia = isPanelFit
        ? homePack
            ? 'text-[0.52rem] font-bold uppercase leading-none tracking-wide text-fuchsia-200/90'
            : 'text-[0.58rem] font-bold uppercase tracking-wide text-fuchsia-200/90 sm:text-[0.62rem]'
        : 'text-[0.62rem] font-bold uppercase tracking-wide text-fuchsia-200/85 sm:text-[0.68rem]';

    const traitTitleAmber = isPanelFit
        ? homePack
            ? 'text-[0.52rem] font-bold uppercase leading-none tracking-wide text-amber-200/90'
            : 'text-[0.58rem] font-bold uppercase tracking-wide text-amber-200/90 sm:text-[0.62rem]'
        : 'text-[0.62rem] font-bold uppercase tracking-wide text-amber-200/85 sm:text-[0.68rem]';

    const traitBodyFuchsia = isPanelFit
        ? homePack
            ? 'mt-0.5 min-w-0 line-clamp-2 text-[0.56rem] font-semibold leading-snug text-fuchsia-50/95 sm:text-[0.58rem]'
            : 'mt-0.5 min-w-0 line-clamp-2 text-[0.65rem] font-semibold leading-snug text-fuchsia-50/95 sm:text-[0.72rem]'
        : 'mt-0.5 min-w-0 line-clamp-2 text-[0.7rem] font-semibold leading-snug text-fuchsia-50/95 sm:text-[0.8rem]';

    const traitBodyAmber = isPanelFit
        ? homePack
            ? 'mt-0.5 min-w-0 line-clamp-2 text-[0.56rem] font-semibold leading-snug text-amber-50/95 sm:text-[0.58rem]'
            : 'mt-0.5 min-w-0 line-clamp-2 text-[0.65rem] font-semibold leading-snug text-amber-50/95 sm:text-[0.72rem]'
        : 'mt-0.5 min-w-0 line-clamp-2 text-[0.7rem] font-semibold leading-snug text-amber-50/95 sm:text-[0.8rem]';

    const heroFramePad = homePack ? 'p-0.5 sm:p-1' : 'p-px';

    const body = (
        <div className={`flex w-full min-w-0 flex-col ${rootGap}`}>
            <div
                className={`relative flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gradient-to-br from-zinc-900 via-violet-950/35 to-zinc-950 ${heroFramePad} shadow-[0_12px_28px_-10px_rgba(0,0,0,0.65)] ring-1 ring-fuchsia-400/35 ${heroOuterRound}`}
            >
                {/* 상단: 이미지 + 기본 정보 */}
                <div
                    className={`relative z-[1] grid min-w-0 grid-cols-[3fr_7fr] items-stretch border-b border-white/10 bg-zinc-950/92 ${rowPad} ${heroTopGridGap}`}
                >
                    <div className="flex min-w-0 flex-col items-center justify-center py-0.5">
                        <div className={imgShellClass}>
                            {isModal || isPanelFit ? (
                                <img
                                    src={petGradeBgSrc}
                                    alt=""
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-[0.92]"
                                />
                            ) : null}
                            <img
                                src={item.image}
                                alt=""
                                className={`relative z-[1] h-full w-full object-contain ${petImgPad} drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]`}
                                loading="lazy"
                            />
                            <span className="absolute left-0.5 top-0.5 z-[4] sm:left-1 sm:top-1">
                                <PairPetRpsBadge attribute={rpsAttr} scaleWithParent />
                            </span>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-col justify-center gap-1 text-left sm:gap-1.5">
                        <div className={`flex items-center ${homePack ? 'min-w-0 flex-nowrap gap-0.5' : 'flex-wrap gap-x-1 gap-y-0.5'}`}>
                            <span className={`${badgeClass} ${gradeStyle.color} bg-black/45`}>{gradeKo}</span>
                            {showRepresentativeBadge ? <span className={repBadgeClass}>대표펫</span> : null}
                        </div>
                        <div className={`flex items-baseline ${homePack ? 'min-w-0 flex-nowrap gap-0.5 overflow-hidden' : 'flex-wrap gap-x-1 gap-y-0'}`}>
                            <span className={lvClass}>Lv.{levelSafe}</span>
                            <h3 className={nameClass}>{displayName}</h3>
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                            <div className={expTextClass}>
                                {xpBlocked ? (
                                    <span
                                        className={`rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-px font-extrabold leading-none text-amber-100 ${
                                            homePack
                                                ? 'whitespace-nowrap text-[0.54rem] sm:text-[0.56rem]'
                                                : isModal
                                                  ? 'text-xs sm:text-sm'
                                                  : 'text-sm sm:text-[0.95rem]'
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
                                className={`${barH} w-full rounded-full border ${
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

                {/* 하단: 성향 · 특화 (가로) */}
                <div
                    className={`relative z-[1] flex min-h-0 min-w-0 flex-row items-stretch bg-zinc-950/92 ${rowPad} ${traitRowGap}`}
                >
                    <div className={traitBoxFuchsia}>
                        <p className={traitTitleFuchsia}>성향</p>
                        <p className={traitBodyFuchsia}>{dispositionLabel(meta.disposition)}</p>
                    </div>
                    <div className={traitBoxAmber}>
                        <p className={traitTitleAmber}>특화</p>
                        <p className={traitBodyAmber}>{specializationLabel(meta.specialization)}</p>
                    </div>
                </div>
            </div>

            {/** `dense`/`fit` 그리드는 모바일 홈에서 PC 모달과 다른 얇은 스타일이 됨 — 홈 대표펫도 PC와 동일 스트립·3×2 코어 표시 */}
            <PairPetBadukPhaseStripAndCoreGrid
                currentUser={currentUser}
                item={item}
                statsGridVariant={isPanelFit ? 'modal' : isModal ? 'modal' : 'panel'}
                dense={false}
                coreGridDensity={undefined}
                mobileHomeRepPet={homePack}
                enlargeHomeRepPhaseStrip={enlargeHomeRepPhaseStrip}
            />
        </div>
    );

    if (isPanelFit && !suppressFitScale) {
        return (
            <PairPetDetailFitScale
                itemId={item.id}
                outerClassName={mobileHomeRepPet ? 'px-1 py-1 sm:px-1.5 sm:py-1.5' : ''}
            >
                {body}
            </PairPetDetailFitScale>
        );
    }

    return body;
};

export default PairPetDetailCardBody;
