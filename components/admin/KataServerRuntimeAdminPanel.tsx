import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { KataServerRuntimeOverrides, KataServerRuntimeSnapshot } from '../../shared/types/kataServerRuntime.js';
import type { ServerAction } from '../../types.js';
import type { PairPetCoreStatsSix, PairPetKataPhase } from '../../shared/constants/pairArena.js';
import {
    DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
    PAIR_PET_KATA_PHASE_PLY_9,
    PAIR_PET_KATA_PHASE_PLY_11,
    PAIR_PET_KATA_PHASE_PLY_13,
    PAIR_PET_KATA_PHASE_PLY_19,
    PAIR_PET_KATA_PHASE_WEIGHTS,
} from '../../shared/constants/pairArena.js';
import { GUILD_WAR_BOARD_ORDER, GUILD_WAR_BOARD_DISPLAY_NAMES } from '../../shared/constants/guildConstants.js';
import Button from '../Button.js';
import KataServerLevelReferenceCard from './KataServerLevelReferenceCard.js';
import { adminCard, adminCardTitle, adminInput } from './adminChrome.js';

type KataSubTab = 'lobby' | 'adventure' | 'tower' | 'guild' | 'pairPet' | 'katago';

function cloneSnapshot(s: KataServerRuntimeSnapshot): KataServerRuntimeSnapshot {
    return JSON.parse(JSON.stringify(s)) as KataServerRuntimeSnapshot;
}

const CORE_KEYS: (keyof PairPetCoreStatsSix)[] = [
    'concentration',
    'thinkingSpeed',
    'judgment',
    'calculation',
    'combatPower',
    'stability',
];
const CORE_LABELS: Record<keyof PairPetCoreStatsSix, string> = {
    concentration: '집중',
    thinkingSpeed: '사고',
    judgment: '판단',
    calculation: '계산',
    combatPower: '전투',
    stability: '안정',
};

const PHASE_LABELS: Record<PairPetKataPhase, string> = {
    opening: '초반',
    midgame: '중반',
    endgame: '종반',
};

const subTabBtn = (active: boolean) =>
    `shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
        active
            ? 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-inner'
            : 'border-color/50 bg-secondary/40 text-gray-400 hover:border-color hover:bg-secondary/60 hover:text-primary'
    }`;

interface KataServerRuntimeAdminPanelProps {
    config: KataServerRuntimeSnapshot;
    onAction: (action: ServerAction) => void;
    kataGoSection: React.ReactNode;
}

const KataServerRuntimeAdminPanel: React.FC<KataServerRuntimeAdminPanelProps> = ({ config, onAction, kataGoSection }) => {
    const [draft, setDraft] = useState(() => cloneSnapshot(config));
    const [subTab, setSubTab] = useState<KataSubTab>('lobby');

    useEffect(() => {
        setDraft(cloneSnapshot(config));
    }, [config]);

    const savePatch = useCallback(
        (patch: KataServerRuntimeOverrides) => {
            onAction({ type: 'ADMIN_PATCH_KATA_SERVER_RUNTIME', payload: { patch } });
        },
        [onAction],
    );

    const subTabs: { id: KataSubTab; label: string }[] = useMemo(
        () => [
            { id: 'lobby', label: '전략 로비 AI' },
            { id: 'adventure', label: '모험' },
            { id: 'tower', label: '도전의 탑' },
            { id: 'guild', label: '길드전' },
            { id: 'pairPet', label: '페어 펫 KATA' },
            { id: 'katago', label: 'KataGo 연동' },
        ],
        [],
    );

    const lobbyEditor = (
        <div className="space-y-3 text-sm">
            <p className="text-xs text-gray-500">대기실 AI 1~10단계 → KataServer <span className="font-mono">level</span> 및 패널 표시 레벨</p>
            <div className="max-h-72 overflow-auto rounded-lg border border-color/40">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="border-b border-color/50 bg-secondary/80 text-primary">
                            <th className="px-2 py-1.5">단계</th>
                            <th className="px-2 py-1.5">kataServerLevel</th>
                            <th className="px-2 py-1.5">표시 레벨</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => (
                            <tr key={step} className="border-b border-color/30 text-gray-300">
                                <td className="px-2 py-1">{step}</td>
                                <td className="px-2 py-1">
                                    <input
                                        type="number"
                                        min={-31}
                                        max={9}
                                        value={draft.strategicLobbyKataByStep[String(step)] ?? ''}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value, 10);
                                            setDraft((d) => ({
                                                ...d,
                                                strategicLobbyKataByStep: {
                                                    ...d.strategicLobbyKataByStep,
                                                    [String(step)]: Number.isFinite(v) ? v : 0,
                                                },
                                            }));
                                        }}
                                        className={`${adminInput} w-full font-mono text-xs`}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        value={draft.strategicLobbyDisplayByStep[String(step)] ?? ''}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value, 10);
                                            setDraft((d) => ({
                                                ...d,
                                                strategicLobbyDisplayByStep: {
                                                    ...d.strategicLobbyDisplayByStep,
                                                    [String(step)]: Number.isFinite(v) ? v : 1,
                                                },
                                            }));
                                        }}
                                        className={`${adminInput} w-full text-xs`}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Button
                type="button"
                colorScheme="green"
                className="!text-xs"
                onClick={() =>
                    savePatch({
                        strategicLobbyKataByStep: { ...draft.strategicLobbyKataByStep },
                        strategicLobbyDisplayByStep: { ...draft.strategicLobbyDisplayByStep },
                    })
                }
            >
                전략 로비 설정 저장
            </Button>
        </div>
    );

    const adventureEditor = (
        <div className="space-y-3 text-sm">
            <p className="text-xs text-gray-500">몬스터 레벨 1~50 → kataServerLevel</p>
            <div className="max-h-80 overflow-auto rounded-lg border border-color/40 p-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {Array.from({ length: 50 }, (_, i) => {
                        const lv = i + 1;
                        return (
                            <label key={lv} className="flex items-center gap-1 text-xs text-gray-400">
                                <span className="w-6 shrink-0 text-right">{lv}</span>
                                <input
                                    type="number"
                                    min={-31}
                                    max={9}
                                    value={draft.adventureKataByMonsterLevel[String(lv)] ?? ''}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        setDraft((d) => ({
                                            ...d,
                                            adventureKataByMonsterLevel: {
                                                ...d.adventureKataByMonsterLevel,
                                                [String(lv)]: Number.isFinite(v) ? v : -31,
                                            },
                                        }));
                                    }}
                                    className={`${adminInput} min-w-0 flex-1 font-mono text-[11px]`}
                                />
                            </label>
                        );
                    })}
                </div>
            </div>
            <Button
                type="button"
                colorScheme="green"
                className="!text-xs"
                onClick={() => savePatch({ adventureKataByMonsterLevel: { ...draft.adventureKataByMonsterLevel } })}
            >
                모험 설정 저장
            </Button>
        </div>
    );

    const towerEditor = (
        <div className="space-y-3 text-sm">
            <p className="text-xs text-gray-500">층 1~100 → kataServerLevel</p>
            <div className="max-h-80 overflow-auto rounded-lg border border-color/40 p-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {Array.from({ length: 100 }, (_, i) => {
                        const f = i + 1;
                        return (
                            <label key={f} className="flex items-center gap-1 text-xs text-gray-400">
                                <span className="w-7 shrink-0 text-right">{f}층</span>
                                <input
                                    type="number"
                                    min={-31}
                                    max={9}
                                    value={draft.towerKataByFloor[String(f)] ?? ''}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        setDraft((d) => ({
                                            ...d,
                                            towerKataByFloor: {
                                                ...d.towerKataByFloor,
                                                [String(f)]: Number.isFinite(v) ? v : -30,
                                            },
                                        }));
                                    }}
                                    className={`${adminInput} min-w-0 flex-1 font-mono text-[11px]`}
                                />
                            </label>
                        );
                    })}
                </div>
            </div>
            <Button
                type="button"
                colorScheme="green"
                className="!text-xs"
                onClick={() => savePatch({ towerKataByFloor: { ...draft.towerKataByFloor } })}
            >
                탑 설정 저장
            </Button>
        </div>
    );

    const guildEditor = (
        <div className="space-y-3 text-sm">
            <p className="text-xs text-gray-500">길드전 9칸 boardId별 kataServerLevel</p>
            <div className="space-y-2">
                {GUILD_WAR_BOARD_ORDER.map((boardId) => (
                    <label key={boardId} className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                        <span className="w-28 shrink-0 text-gray-400">{GUILD_WAR_BOARD_DISPLAY_NAMES[boardId]}</span>
                        <span className="font-mono text-[10px] text-gray-500">{boardId}</span>
                        <input
                            type="number"
                            min={-31}
                            max={9}
                            value={draft.guildWarKataByBoardId[boardId] ?? ''}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                setDraft((d) => ({
                                    ...d,
                                    guildWarKataByBoardId: {
                                        ...d.guildWarKataByBoardId,
                                        [boardId]: Number.isFinite(v) ? v : -10,
                                    },
                                }));
                            }}
                            className={`${adminInput} w-24 font-mono text-xs`}
                        />
                    </label>
                ))}
            </div>
            <Button
                type="button"
                colorScheme="green"
                className="!text-xs"
                onClick={() => savePatch({ guildWarKataByBoardId: { ...draft.guildWarKataByBoardId } })}
            >
                길드전 설정 저장
            </Button>
        </div>
    );

    const pairPetReadOnlyPanel = (
        <div className="space-y-5 text-sm">
            <div className="rounded-lg border border-color/40 bg-secondary/20 p-3 text-xs leading-relaxed text-gray-400">
                <p className="mb-2 font-semibold text-amber-200/90">페어 펫 KATA (읽기 전용)</p>
                <p className="mb-2">
                    초·중·종 <strong className="text-gray-300">6스탯 가중치</strong>와 <strong className="text-gray-300">착수 구간</strong>은 챔피언십 KATA와 동일한{' '}
                    <span className="font-mono text-gray-300">shared/constants</span> 코드만 사용합니다. KV·관리자에서 바꿀 수 없습니다.
                </p>
                <ul className="list-inside list-disc space-y-1">
                    <li>
                        <strong className="text-gray-300">능력치 점수</strong>: 6스탯 × 페이즈 가중치 합산 후 반올림
                    </li>
                    <li>
                        <strong className="text-gray-300">KATA 오프셋</strong>: 아래 구간표(및 서버 런타임에 반영된 동일 구간표)로 점수 → 레벨 오프셋 결정
                    </li>
                </ul>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">코드 기준 — 페이즈별 가중치 (6스탯)</h3>
                <p className="mb-2 text-[11px] text-gray-500">챔피언십 `CHAMPIONSHIP_KATA_PHASE_WEIGHTS`와 동일 계수</p>
                {(['opening', 'midgame', 'endgame'] as PairPetKataPhase[]).map((phase) => (
                    <div key={phase} className="mb-3 rounded-lg border border-color/30 p-2">
                        <div className="mb-2 text-xs font-semibold text-amber-200/80">{PHASE_LABELS[phase]}</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {CORE_KEYS.map((key) => (
                                <div key={key} className="flex flex-col gap-0.5 text-[11px] text-gray-400">
                                    <span>{CORE_LABELS[key]}</span>
                                    <span className="font-mono text-gray-200">{PAIR_PET_KATA_PHASE_WEIGHTS[phase][key]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">코드 기준 — 합산 착수 수(흑·백) 페이즈 구간</h3>
                {(
                    [
                        { table: PAIR_PET_KATA_PHASE_PLY_9, label: '9줄' },
                        { table: PAIR_PET_KATA_PHASE_PLY_11, label: '11줄' },
                        { table: PAIR_PET_KATA_PHASE_PLY_13, label: '13줄' },
                        { table: PAIR_PET_KATA_PHASE_PLY_19, label: '19줄' },
                    ] as const
                ).map(({ table, label }) => (
                    <div key={label} className="mb-3 rounded-lg border border-color/30 p-2">
                        <div className="mb-2 text-xs font-semibold text-gray-400">{label}</div>
                        {(['opening', 'midgame', 'endgame'] as PairPetKataPhase[]).map((phase) => (
                            <div key={phase} className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                                <span className="w-10 text-gray-500">{PHASE_LABELS[phase]}</span>
                                <span className="font-mono">
                                    from {table[phase].from} — to {table[phase].to == null ? '∞' : table[phase].to}
                                </span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">능력치 점수 → KATA 오프셋 구간 (코드 기본)</h3>
                <p className="mb-2 text-[11px] text-gray-500">
                    서버 런타임에 저장된 구간표가 있으면 그것이 게임에 적용됩니다. 아래는 저장소 비었을 때 쓰는 기본 표입니다.
                </p>
                <div className="max-h-72 overflow-auto rounded-lg border border-color/40">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="border-b border-color/50 bg-secondary/80 text-primary">
                                <th className="px-2 py-1">min 점수 ≥</th>
                                <th className="px-2 py-1">KATA offset</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DEFAULT_PAIR_PET_ABILITY_KATA_LADDER.map((row, idx) => (
                                <tr key={idx} className="border-b border-color/30">
                                    <td className="px-2 py-1 font-mono text-gray-200">{row.minAbilityScore}</td>
                                    <td className="px-2 py-1 font-mono text-gray-200">{row.kataLevelOffset}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">현재 서버 런타임 — 적용 중인 KATA 오프셋 구간</h3>
                <div className="max-h-56 overflow-auto rounded-lg border border-color/40">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="border-b border-color/50 bg-secondary/80 text-primary">
                                <th className="px-2 py-1">min 점수 ≥</th>
                                <th className="px-2 py-1">KATA offset</th>
                            </tr>
                        </thead>
                        <tbody>
                            {config.pairPet.abilityKataLadder.map((row, idx) => (
                                <tr key={idx} className="border-b border-color/30">
                                    <td className="px-2 py-1 font-mono text-gray-200">{row.minAbilityScore}</td>
                                    <td className="px-2 py-1 font-mono text-gray-200">{row.kataLevelOffset}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className={adminCard}>
                <h2 className={adminCardTitle}>카타 서버 런타임</h2>
                <p className="mb-3 text-xs text-gray-500">
                    KataServer <span className="font-mono">/move</span>의 <span className="font-mono">level</span> 매핑을 콘텐츠별로 조정합니다. 저장 시 즉시
                    서버·접속 클라이언트에 반영됩니다.
                </p>
                <div className="mb-4 flex flex-wrap gap-1.5 border-b border-color/40 pb-3" role="tablist" aria-label="카타 서버 하위 탭">
                    {subTabs.map((t) => (
                        <button key={t.id} type="button" role="tab" aria-selected={subTab === t.id} className={subTabBtn(subTab === t.id)} onClick={() => setSubTab(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div role="tabpanel" className="min-h-[10rem]">
                    {subTab === 'lobby' && lobbyEditor}
                    {subTab === 'adventure' && adventureEditor}
                    {subTab === 'tower' && towerEditor}
                    {subTab === 'guild' && guildEditor}
                    {subTab === 'pairPet' && pairPetReadOnlyPanel}
                    {subTab === 'katago' && <div className="space-y-3">{kataGoSection}</div>}
                </div>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-color/40 pt-4">
                    <Button type="button" colorScheme="red" className="!text-xs" onClick={() => onAction({ type: 'ADMIN_RESET_KATA_SERVER_RUNTIME' })}>
                        전체 KATA 런타임 리셋 (KV 비우기)
                    </Button>
                    <span className="w-full text-[11px] leading-snug text-gray-500">
                        리셋은 저장된 모든 오버라이드를 지우고 코드 기본 스냅샷으로 돌아갑니다. 페어 펫의 6스탯 가중치·착수 구간은 코드에 고정되어 있으며, KV에는 KATA 오프셋 구간표만 저장됩니다.
                    </span>
                </div>
            </div>

            <KataServerLevelReferenceCard config={config} />
        </div>
    );
};

export default KataServerRuntimeAdminPanel;
