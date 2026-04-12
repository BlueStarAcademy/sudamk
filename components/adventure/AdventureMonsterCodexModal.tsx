import React, { useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import {
    ADVENTURE_CODEX_CHAPTER_UI,
    ADVENTURE_STAGES,
    type AdventureStageId,
} from '../../constants/adventureConstants.js';
import { AdventureMonsterSpriteFrame } from './AdventureMonsterSprite.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { CORE_STATS_DATA } from '../../constants.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import {
    ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL,
    ADVENTURE_CODEX_MAX_LEVEL,
    ADVENTURE_CODEX_WINS_FOR_LEVEL,
    adventureCodexPercentBossBonusLabelKo,
    adventureCodexNormalPercentLabelKo,
    getAdventureCodexComprehensionLevel,
    getAdventureMonsterComprehensionDesign,
    getCodexComprehensionItemGrade,
    getNextAdventureCodexWinsThreshold,
} from '../../utils/adventureCodexComprehension.js';

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

interface Props {
    onClose: () => void;
    isTopmost?: boolean;
}

function codexLevelProgress(wins: number, level: number): {
    prog: number;
    nextAt: number | null;
    prevThreshold: number;
} {
    const w = Math.max(0, Math.floor(wins));
    const nextAt = getNextAdventureCodexWinsThreshold(level);
    const prevThreshold = level >= 1 ? ADVENTURE_CODEX_WINS_FOR_LEVEL[level - 1] ?? 0 : 0;
    if (level >= ADVENTURE_CODEX_MAX_LEVEL) {
        return { prog: 1, nextAt: null, prevThreshold };
    }
    if (nextAt != null && nextAt > prevThreshold) {
        return {
            prog: Math.min(1, (w - prevThreshold) / (nextAt - prevThreshold)),
            nextAt,
            prevThreshold,
        };
    }
    return { prog: 0, nextAt, prevThreshold };
}

const AdventureMonsterCodexModal: React.FC<Props> = ({ onClose, isTopmost }) => {
    const [tabId, setTabId] = useState<AdventureStageId>(ADVENTURE_STAGES[0].id);
    const stage = ADVENTURE_STAGES.find((s) => s.id === tabId) ?? ADVENTURE_STAGES[0];
    const chapterUi = ADVENTURE_CODEX_CHAPTER_UI[stage.id];
    const { currentUserWithStatus } = useAppContext();
    const counts = currentUserWithStatus?.adventureProfile?.codexDefeatCounts ?? {};

    return (
        <DraggableWindow
            title="모험 몬스터 도감"
            onClose={onClose}
            windowId="adventure-monster-codex"
            initialWidth={1160}
            initialHeight={780}
            isTopmost={isTopmost}
        >
            <div className="flex max-h-[min(85vh,800px)] flex-col overflow-hidden">
                <div
                    role="tablist"
                    aria-label="도감 챕터"
                    className="mb-3 flex shrink-0 gap-2 overflow-x-auto overscroll-contain border-b border-white/10 pb-2.5"
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
                                    'shrink-0 rounded-xl border px-4 py-2.5 text-left text-sm font-bold transition-colors sm:px-5 sm:py-3 sm:text-base',
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
                                        'font-mono tabular-nums text-xs sm:text-sm',
                                        sel ? 'opacity-85' : 'text-amber-400/90',
                                    ].join(' ')}
                                >
                                    CH.{String(s.stageIndex).padStart(2, '0')}
                                </span>
                                <span className="mt-0.5 block max-w-[10rem] truncate sm:mt-1 sm:max-w-[12rem]">{s.title}</span>
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
                                const { prog, nextAt, prevThreshold } = codexLevelProgress(wins, level);
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
            </div>
        </DraggableWindow>
    );
};

export default AdventureMonsterCodexModal;
