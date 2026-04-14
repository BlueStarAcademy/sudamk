import React, { useEffect, useMemo, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import {
    ADVENTURE_CODEX_CHAPTER_UI,
    ADVENTURE_STAGES,
    type AdventureStageId,
} from '../../constants/adventureConstants.js';
import { AdventureMonsterSpriteFrame } from './AdventureMonsterSprite.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { CORE_STATS_DATA } from '../../constants.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import type { AdventureMapMonsterInstance } from '../../shared/utils/adventureMapSchedule.js';
import AdventureChapterMonsterSituationList from './AdventureChapterMonsterSituationList.js';
import {
    ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL,
    ADVENTURE_CODEX_MAX_LEVEL,
    adventureCodexPercentBossBonusLabelKo,
    adventureCodexNormalPercentLabelKo,
    getAdventureCodexComprehensionLevel,
    getAdventureCodexComprehensionBarProgress,
    getAdventureMonsterComprehensionDesign,
    getCodexComprehensionItemGrade,
} from '../../utils/adventureCodexComprehension.js';
import { formatAdventureUnderstandingBonusPercent, getMonsterCodexComprehensionBuffTotals } from '../../utils/adventureUnderstanding.js';

type ChapterComprehensionBuffSummary = {
    goldBonusPercent: number;
    equipmentDropPercent: number;
    highGradeEquipmentPercent: number;
    materialDropPercent: number;
    highGradeMaterialPercent: number;
};

function buildChapterMonsterComprehensionSummary(
    stage: (typeof ADVENTURE_STAGES)[number],
    counts: Record<string, number>,
): ChapterComprehensionBuffSummary {
    const sum: ChapterComprehensionBuffSummary = {
        goldBonusPercent: 0,
        equipmentDropPercent: 0,
        highGradeEquipmentPercent: 0,
        materialDropPercent: 0,
        highGradeMaterialPercent: 0,
    };
    for (const m of stage.monsters) {
        const wins = Math.max(0, Math.floor(counts[m.codexId] ?? 0));
        const level = getAdventureCodexComprehensionLevel(wins);
        if (level <= 0) continue;
        const design = getAdventureMonsterComprehensionDesign(m.codexId);
        if (design && !design.isBoss && design.normalPercentBonus) {
            const v = design.normalPercentBonus.percentPerLevel * level;
            switch (design.normalPercentBonus.kind) {
                case 'adventureGold':
                    sum.goldBonusPercent += v;
                    break;
                case 'itemDrop':
                    sum.equipmentDropPercent += v;
                    break;
                case 'materialDrop':
                    sum.materialDropPercent += v;
                    break;
                case 'highGradeEquipment':
                    sum.highGradeEquipmentPercent += v;
                    break;
                case 'highGradeMaterial':
                    sum.highGradeMaterialPercent += v;
                    break;
            }
        }
        if ('codexPercentBossBonus' in m && m.codexPercentBossBonus) {
            const bossV = Math.min(level, ADVENTURE_CODEX_MAX_LEVEL) * ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL;
            switch (m.codexPercentBossBonus.target) {
                case 'adventureGold':
                    sum.goldBonusPercent += bossV;
                    break;
                case 'itemDrop':
                    sum.equipmentDropPercent += bossV;
                    break;
                case 'materialDrop':
                    sum.materialDropPercent += bossV;
                    break;
                case 'highGradeEquipment':
                    sum.highGradeEquipmentPercent += bossV;
                    break;
                case 'highGradeMaterial':
                    sum.highGradeMaterialPercent += bossV;
                    break;
                default:
                    break;
            }
        }
    }
    return sum;
}

/** 도감 카드 — 이해도 등급은 이미지 프레임 테두리 색으로만 표시 */
function codexComprehensionGradeBorderClass(grade: ItemGrade | null): string {
    switch (grade ?? ItemGrade.Normal) {
        case ItemGrade.Normal:
            return 'border-zinc-400';
        case ItemGrade.Uncommon:
            return 'border-emerald-500';
        case ItemGrade.Rare:
            return 'border-sky-500';
        case ItemGrade.Epic:
            return 'border-violet-500';
        case ItemGrade.Legendary:
            return 'border-rose-500';
        case ItemGrade.Mythic:
            return 'border-amber-400';
        case ItemGrade.Transcendent:
            return 'border-cyan-400';
        default:
            return 'border-zinc-400';
    }
}

export type AdventureMonsterCodexMapSituationProps = {
    stageId: string;
    mapMonsters: AdventureMapMonsterInstance[];
    suppressRecord: Record<string, number>;
    mapDwellMultiplier?: number;
    mapRespawnOffMultiplier?: number;
    onPickRow: (codexId: string) => void;
};

interface Props {
    onClose: () => void;
    isTopmost?: boolean;
    /** 맵 등: 출현 상황 탭 표시 */
    mapSituation?: AdventureMonsterCodexMapSituationProps | null;
    /** mapSituation 있을 때 첫 탭 (기본: situation) */
    initialMainTab?: 'situation' | 'codex';
    /** 상황 탭 없이 도감만 열 때 챕터 탭 초기값 (현재 맵 스테이지 id) */
    defaultCodexStageId?: string | null;
}

const AdventureMonsterCodexModal: React.FC<Props> = ({
    onClose,
    isTopmost,
    mapSituation,
    initialMainTab,
    defaultCodexStageId,
}) => {
    const { isNativeMobile } = useNativeMobileShell();
    const showSituationTab = Boolean(mapSituation);
    const [mainTab, setMainTab] = useState<'situation' | 'codex' | 'comprehension'>(() =>
        showSituationTab ? (initialMainTab ?? 'situation') : 'codex',
    );
    const [, setSituationTick] = useState(0);
    useEffect(() => {
        if (!showSituationTab || mainTab !== 'situation') return;
        const id = window.setInterval(() => setSituationTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [showSituationTab, mainTab]);

    const [tabId, setTabId] = useState<AdventureStageId>(() => {
        const sid = mapSituation?.stageId ?? defaultCodexStageId ?? undefined;
        if (sid && ADVENTURE_STAGES.some((s) => s.id === sid)) return sid as AdventureStageId;
        return ADVENTURE_STAGES[0].id;
    });
    const stage = ADVENTURE_STAGES.find((s) => s.id === tabId) ?? ADVENTURE_STAGES[0];
    const chapterUi = ADVENTURE_CODEX_CHAPTER_UI[stage.id];
    const { currentUserWithStatus } = useAppContext();
    const counts = currentUserWithStatus?.adventureProfile?.codexDefeatCounts ?? {};
    const monsterComprehensionBuff = getMonsterCodexComprehensionBuffTotals(currentUserWithStatus?.adventureProfile);
    const chapterMonsterComprehensionBuff = useMemo(
        () => buildChapterMonsterComprehensionSummary(stage, counts),
        [stage, counts],
    );
    const situationNowMs = Date.now();

    const mainTabBtn =
        'min-w-0 flex-1 rounded-lg border px-2 py-2 text-center text-xs font-bold transition sm:px-3 sm:py-2.5 sm:text-sm';
    const mainTabOn = 'border-amber-400/55 bg-amber-500/15 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
    const mainTabOff =
        'border-transparent bg-zinc-900/50 text-zinc-500 hover:border-white/12 hover:bg-zinc-900/70 hover:text-zinc-200';

    return (
        <DraggableWindow
            title={showSituationTab ? '모험 몬스터' : '모험 몬스터 도감'}
            onClose={onClose}
            windowId="adventure-monster-codex"
            initialWidth={1160}
            initialHeight={780}
            isTopmost={isTopmost}
        >
            <div className="flex max-h-[min(85vh,800px)] flex-col overflow-hidden">
                {showSituationTab ? (
                    <div
                        role="tablist"
                        aria-label="몬스터 창 구분"
                        className="mb-3 flex shrink-0 gap-1.5 sm:gap-2"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mainTab === 'situation'}
                            onClick={() => setMainTab('situation')}
                            className={`${mainTabBtn} ${mainTab === 'situation' ? mainTabOn : mainTabOff}`}
                        >
                            몬스터 상황
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mainTab === 'codex'}
                            onClick={() => setMainTab('codex')}
                            className={`${mainTabBtn} ${mainTab === 'codex' ? mainTabOn : mainTabOff}`}
                        >
                            몬스터 도감
                        </button>
                        {isNativeMobile ? (
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mainTab === 'comprehension'}
                                onClick={() => setMainTab('comprehension')}
                                className={`${mainTabBtn} ${mainTab === 'comprehension' ? mainTabOn : mainTabOff}`}
                            >
                                몬스터 이해도
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {showSituationTab && mainTab === 'situation' && mapSituation ? (
                    <div
                        role="tabpanel"
                        aria-label="몬스터 상황"
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
                    >
                        <p className="text-center text-[11px] font-bold uppercase tracking-wide text-emerald-400/90 sm:text-xs">
                            출현 · 대기 시간
                        </p>
                        <AdventureChapterMonsterSituationList
                            stageId={mapSituation.stageId}
                            mapMonsters={mapSituation.mapMonsters}
                            suppressRecord={mapSituation.suppressRecord}
                            nowMs={situationNowMs}
                            onPickRow={mapSituation.onPickRow}
                            mapDwellMultiplier={mapSituation.mapDwellMultiplier}
                            mapRespawnOffMultiplier={mapSituation.mapRespawnOffMultiplier}
                        />
                    </div>
                ) : isNativeMobile && mainTab === 'comprehension' ? (
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                        <div
                            role="tablist"
                            aria-label="이해도 챕터"
                            className="mb-3 flex shrink-0 gap-1 overflow-x-auto overscroll-contain border-b border-white/10 pb-1.5"
                        >
                            {ADVENTURE_STAGES.map((s) => {
                                const sel = s.id === tabId;
                                const tabUi = ADVENTURE_CODEX_CHAPTER_UI[s.id];
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={sel}
                                        onClick={() => setTabId(s.id)}
                                        className={[
                                            'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                                            sel
                                                ? tabUi.tabSelectedClass
                                                : [
                                                      'border-white/12 bg-zinc-900/65 text-zinc-400',
                                                      tabUi.tabIdleHoverClass,
                                                  ].join(' '),
                                        ].join(' ')}
                                    >
                                        CH.{s.stageIndex}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-200/95">몬스터 이해도 효과</p>
                            <div className="mt-2 grid grid-cols-1 gap-1.5">
                                <p className="rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] font-semibold text-zinc-100">
                                    모험 골드 +{formatAdventureUnderstandingBonusPercent(chapterMonsterComprehensionBuff.goldBonusPercent)}%
                                </p>
                                <p className="rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] font-semibold text-zinc-100">
                                    장비 획득 +{formatAdventureUnderstandingBonusPercent(chapterMonsterComprehensionBuff.equipmentDropPercent)}%
                                </p>
                                <p className="rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] font-semibold text-zinc-100">
                                    고급 장비 +{formatAdventureUnderstandingBonusPercent(chapterMonsterComprehensionBuff.highGradeEquipmentPercent)}%
                                </p>
                                <p className="rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] font-semibold text-zinc-100">
                                    재료 획득 +{formatAdventureUnderstandingBonusPercent(chapterMonsterComprehensionBuff.materialDropPercent)}%
                                </p>
                                <p className="rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] font-semibold text-zinc-100">
                                    고급 재료 +{formatAdventureUnderstandingBonusPercent(chapterMonsterComprehensionBuff.highGradeMaterialPercent)}%
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                <div
                    role="tablist"
                    aria-label="도감 챕터"
                    className={`mb-3 flex shrink-0 gap-2 overflow-x-auto overscroll-contain border-b border-white/10 ${
                        isNativeMobile ? 'pb-1.5' : 'pb-2.5'
                    }`}
                >
                    {ADVENTURE_STAGES.map((s) => {
                        const sel = s.id === tabId;
                        const tabUi = ADVENTURE_CODEX_CHAPTER_UI[s.id];
                        return (
                            <button
                                key={s.id}
                                type="button"
                                role="tab"
                                aria-selected={sel}
                                id={`codex-tab-${s.id}`}
                                aria-controls={`codex-panel-${s.id}`}
                                onClick={() => setTabId(s.id)}
                                className={[
                                    isNativeMobile
                                        ? 'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors'
                                        : 'shrink-0 rounded-xl border px-4 py-2.5 text-left text-sm font-bold transition-colors sm:px-5 sm:py-3 sm:text-base',
                                    sel
                                        ? tabUi.tabSelectedClass
                                        : [
                                              'border-white/12 bg-zinc-900/65 text-zinc-400',
                                              tabUi.tabIdleHoverClass,
                                          ].join(' '),
                                ].join(' ')}
                            >
                                <span
                                    className={[
                                        isNativeMobile ? 'font-mono tabular-nums text-[11px]' : 'font-mono tabular-nums text-xs sm:text-sm',
                                        sel ? 'opacity-85' : 'text-amber-400/90',
                                    ].join(' ')}
                                >
                                    CH.{s.stageIndex}
                                </span>
                                {!isNativeMobile ? (
                                    <span className="mt-0.5 block max-w-[10rem] truncate sm:mt-1 sm:max-w-[12rem]">{s.title}</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                <div
                    role="tabpanel"
                    id={`codex-panel-${stage.id}`}
                    aria-labelledby={`codex-tab-${stage.id}`}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
                >
                    <div className={`rounded-xl border p-3 sm:p-4 ${chapterUi.panelClass}`}>
                        <div className="flex flex-wrap items-center gap-2 border-b border-white/12 pb-3">
                            <span className="rounded-md border border-white/20 bg-black/35 px-2 py-0.5 font-mono text-[10px] font-bold text-white/90 sm:text-xs">
                                CHAPTER {String(stage.stageIndex).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-semibold text-zinc-100 sm:text-base">{stage.title}</span>
                            <span className="text-[10px] text-zinc-400 sm:text-xs">({stage.monsters.length}종)</span>
                        </div>
                        <ul className="mt-4 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-5">
                            {[...stage.monsters]
                                .sort((a, b) => {
                                    const aBoss =
                                        'codexPercentBossBonus' in a && Boolean(a.codexPercentBossBonus);
                                    const bBoss =
                                        'codexPercentBossBonus' in b && Boolean(b.codexPercentBossBonus);
                                    if (aBoss === bBoss) return 0;
                                    return aBoss ? 1 : -1;
                                })
                                .map((m) => {
                                const bossBonus = 'codexPercentBossBonus' in m ? m.codexPercentBossBonus : undefined;
                                const wins = Math.max(0, Math.floor(counts[m.codexId] ?? 0));
                                const level = getAdventureCodexComprehensionLevel(wins);
                                const design = getAdventureMonsterComprehensionDesign(m.codexId);
                                const { prog, nextAt, prevThreshold } = getAdventureCodexComprehensionBarProgress(wins, level);
                                const pct = Math.round(Math.min(1, Math.max(0, prog)) * 100);
                                const specPct =
                                    design?.normalPercentBonus && !design.isBoss
                                        ? design.normalPercentBonus.percentPerLevel * Math.max(0, level)
                                        : 0;
                                const bossPctActive =
                                    bossBonus && level > 0
                                        ? Math.min(level, ADVENTURE_CODEX_MAX_LEVEL) * ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL
                                        : 0;
                                const displayGrade = getCodexComprehensionItemGrade(level);
                                const gradeBorder = codexComprehensionGradeBorderClass(displayGrade);
                                const atMax = level >= ADVENTURE_CODEX_MAX_LEVEL;
                                const showLv = atMax ? ADVENTURE_CODEX_MAX_LEVEL : Math.max(0, level);

                                return (
                                    <li
                                        key={m.codexId}
                                        className={`flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:gap-3.5 sm:p-4 ${chapterUi.cardClass}`}
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                                            <div className="flex shrink-0 flex-col items-center sm:items-start">
                                                <div
                                                    className={[
                                                        'flex w-[7.25rem] flex-col overflow-hidden rounded-lg bg-white shadow-md sm:w-[8.25rem]',
                                                        'border-[3px]',
                                                        gradeBorder,
                                                    ].join(' ')}
                                                    title={
                                                        atMax
                                                            ? '이해도 최대'
                                                            : nextAt != null
                                                              ? `다음 레벨까지 ${wins}/${nextAt}승`
                                                              : undefined
                                                    }
                                                >
                                                    <div
                                                        className={`flex min-h-[2.35rem] shrink-0 flex-col items-center justify-center gap-0.5 bg-gradient-to-b px-1.5 py-1.5 sm:min-h-[2.65rem] sm:px-2 sm:py-1.5 ${chapterUi.nameBarClass}`}
                                                    >
                                                        <p className="line-clamp-2 text-center text-[11px] font-black leading-snug tracking-wide text-amber-50 [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_1px_0_rgba(0,0,0,0.95),0_0_1px_rgba(0,0,0,1)] sm:text-[13px] sm:leading-tight">
                                                            {m.name}
                                                        </p>
                                                        {bossBonus ? (
                                                            <span className="rounded border border-amber-400/40 bg-black/50 px-1 py-px text-[7px] font-black uppercase tracking-wider text-amber-100 sm:text-[8px]">
                                                                보스
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex min-h-[6.25rem] w-full flex-1 items-center justify-center bg-white py-2 sm:min-h-[7rem]">
                                                        <AdventureMonsterSpriteFrame
                                                            sheetUrl={m.imageWebp}
                                                            frameIndex={0}
                                                            cols={1}
                                                            rows={1}
                                                            className="h-[5.25rem] w-[5.25rem] shrink-0 bg-transparent sm:h-28 sm:w-28"
                                                            imgClassName="drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs leading-relaxed text-zinc-200/95 sm:text-sm">{m.codexDescription}</p>
                                                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-white/8 pb-2.5 sm:gap-x-5">
                                                    <span className="text-[10px] font-semibold text-zinc-400 sm:text-[11px]">이해도</span>
                                                    <span className="text-[10px] tabular-nums text-zinc-200 sm:text-xs">
                                                        {level <= 0 ? (
                                                            <span className="font-semibold text-zinc-500">미활성</span>
                                                        ) : (
                                                            <>
                                                                Lv.{showLv}
                                                                {atMax ? (
                                                                    <span className="ml-1 font-extrabold text-amber-200/95">MAX</span>
                                                                ) : null}
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 sm:text-xs">·</span>
                                                    <span className="text-[10px] tabular-nums text-zinc-300 sm:text-xs">
                                                        승리{' '}
                                                        <span className="font-mono font-bold text-amber-200/95">{wins}</span>회
                                                    </span>
                                                </div>
                                                {bossBonus ? (
                                                    <p className="mt-2 text-[10px] leading-snug text-amber-200/85 sm:text-[11px]">
                                                        챕터 보스: {adventureCodexPercentBossBonusLabelKo(bossBonus)} — 이해도 레벨당 +
                                                        {ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL}% (최대{' '}
                                                        {ADVENTURE_CODEX_MAX_LEVEL * ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL}%)
                                                    </p>
                                                ) : null}
                                                {bossBonus && level > 0 ? (
                                                    <p className="mt-1.5 text-[10px] font-semibold text-amber-100/90 sm:text-[11px]">
                                                        현재 보스 보너스 합: +
                                                        {bossPctActive}% ({adventureCodexPercentBossBonusLabelKo(bossBonus)})
                                                    </p>
                                                ) : null}
                                                {!bossBonus && design && level > 0 && (
                                                    <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/10 px-2.5 py-2 text-[10px] text-zinc-300 sm:px-3 sm:text-[11px]">
                                                        <p className="mb-1 font-semibold text-cyan-100/90">이해도 능력치 (현재 합)</p>
                                                        <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                                            {Object.values(CoreStat).map((stat) => {
                                                                const add = (design.coreStatBonusPerLevel[stat] ?? 0) * level;
                                                                if (add <= 0) return null;
                                                                const label = CORE_STATS_DATA[stat]?.name ?? stat;
                                                                return (
                                                                    <li key={stat} className="flex justify-between gap-1">
                                                                        <span className="truncate text-zinc-500">{label}</span>
                                                                        <span className="shrink-0 font-mono text-cyan-200/95">+{add}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                        {specPct > 0.0005 && design.normalPercentBonus ? (
                                                            <p className="mt-1.5 border-t border-white/5 pt-1.5 text-zinc-400">
                                                                모험 전용: {adventureCodexNormalPercentLabelKo(design.normalPercentBonus.kind)} +
                                                                {specPct}%
                                                                {design.normalPercentBonus.kind === 'adventureGold'
                                                                    ? ' (모험 승리 골드만)'
                                                                    : ''}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-full border-t border-white/8 pt-2.5">
                                            <div className="mb-1 flex flex-wrap items-end justify-between gap-1 text-[10px] text-zinc-500 sm:text-xs">
                                                <span className="font-semibold text-zinc-400">이해도 경험치</span>
                                                <span className="font-mono tabular-nums text-zinc-400">
                                                    {atMax ? (
                                                        <span className="text-amber-200/95">최대 · {wins}승</span>
                                                    ) : level <= 0 ? (
                                                        <span>첫 Lv {wins}/1승</span>
                                                    ) : nextAt != null ? (
                                                        <span>
                                                            다음 {wins}/{nextAt}승
                                                            {prevThreshold > 0 ? (
                                                                <span className="text-zinc-600"> ({prevThreshold}~)</span>
                                                            ) : null}
                                                        </span>
                                                    ) : (
                                                        <span>—</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800/95 ring-1 ring-inset ring-black/40 sm:h-3">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-500 to-amber-400 shadow-[0_0_10px_rgba(192,132,252,0.3)] transition-all duration-500"
                                                    style={{ width: `${atMax ? 100 : pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
                    </>
                )}
            </div>
        </DraggableWindow>
    );
};

export default AdventureMonsterCodexModal;
