import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminPageNarrow, adminSectionGap } from './adminChrome.js';
import { ItemGrade } from '../../types/enums.js';
import { EQUIPMENT_GRADE_LABEL_KO } from '../../constants.js';
import {
    EQUIPMENT_BOX_LOOT_TABLES,
    MATERIAL_BOX_PROBABILITIES,
    DUNGEON_STAGE_MATERIAL_ROLLS,
    DUNGEON_STAGE_EQUIPMENT_DROP,
    type EquipmentGradeKey,
    ENHANCEMENT_SUCCESS_RATES,
    BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES,
    BLACKSMITH_DISASSEMBLY_JACKPOT_RATES,
    STRATEGIC_LOOT_TABLE,
    PLAYFUL_LOOT_TABLES_BY_ROUNDS,
} from '../../shared/constants/index.js';
import {
    ADVENTURE_MAP_KEY_CHAPTER_CONFIG,
    formatAdventureTreasureChestAdminLines,
} from '../../shared/utils/adventureMapTreasureRewards.js';

interface DropRateReferencePanelProps {
    onBack: () => void;
}

type RateSectionKey = 'shop' | 'pvp' | 'championship' | 'blacksmith' | 'adventure';
const DROP_RATE_SECTION_STORAGE_KEY = 'admin.dropRateReference.activeSection';
const RATE_SECTION_KEYS: readonly RateSectionKey[] = ['shop', 'pvp', 'championship', 'blacksmith', 'adventure'] as const;

const gradeLabel = (grade: string): string =>
    EQUIPMENT_GRADE_LABEL_KO[grade as ItemGrade] ?? grade;

const formatPercent = (value: number): string => `${Number((value * 100).toFixed(2)).toLocaleString()}%`;

const formatRateLine = (entries: { label: string; rateText: string }[]): string =>
    entries.map((row) => `${row.label} ${row.rateText}`).join(' / ');

const DropRateReferencePanel: React.FC<DropRateReferencePanelProps> = ({ onBack }) => {
    const [query, setQuery] = useState('');
    const [activeSection, setActiveSection] = useState<RateSectionKey>('shop');
    const normalizedQuery = query.trim().toLowerCase();

    const matches = (text: string): boolean =>
        !normalizedQuery || text.toLowerCase().includes(normalizedQuery);

    const equipmentBoxRows = Object.entries(EQUIPMENT_BOX_LOOT_TABLES).map(([boxId, table]) => ({
        boxId,
        line: formatRateLine(
            table.map((entry) => ({
                label: gradeLabel(entry.grade),
                rateText: `${entry.weight}%`,
            }))
        ),
    }));
    const filteredEquipmentBoxRows = equipmentBoxRows.filter((row) => matches(`${row.boxId} ${row.line}`));

    const materialBoxRows = Object.entries(MATERIAL_BOX_PROBABILITIES).map(([boxId, table]) => ({
        boxId,
        line: formatRateLine(
            Object.entries(table).map(([name, chance]) => ({
                label: name,
                rateText: formatPercent(chance),
            }))
        ),
    }));
    const filteredMaterialBoxRows = materialBoxRows.filter((row) => matches(`${row.boxId} ${row.line}`));

    const stageRows = Array.from({ length: 10 }, (_, idx) => idx + 1);
    const filteredStageRows = stageRows.filter((stage) => {
        const mat = DUNGEON_STAGE_MATERIAL_ROLLS[stage];
        const equip = DUNGEON_STAGE_EQUIPMENT_DROP[stage];
        const rowText = [
            `stage ${stage}`,
            ...((mat?.win ?? []).map((r) => `${r.materialName} ${r.min} ${r.max} ${r.chance}`)),
            ...((mat?.loss ?? []).map((r) => `${r.materialName} ${r.min} ${r.max} ${r.chance}`)),
            ...((equip?.win ?? []).map((r) => `${r.grade} ${r.chance}`)),
            ...((equip?.loss ?? []).map((r) => `${r.grade} ${r.chance}`)),
        ].join(' ');
        return matches(rowText);
    });

    const strategicLootLine = formatRateLine(
        STRATEGIC_LOOT_TABLE.map((entry) => ({
            label: `${entry.name}${entry.type === 'equipment' ? '(장비)' : '(재료)'}`,
            rateText: `${entry.chance}%`,
        }))
    );
    const playfulLootRows = useMemo(
        () =>
            ([3, 2, 1] as const).map((rounds) => ({
                rounds,
                line: formatRateLine(
                    PLAYFUL_LOOT_TABLES_BY_ROUNDS[rounds].map((entry) => ({
                        label: `${entry.name}${entry.type === 'equipment' ? '(장비)' : '(재료)'}`,
                        rateText: `${entry.chance}%`,
                    }))
                ),
            })),
        []
    );
    const showStrategicSection = matches(`전략바둑 ${strategicLootLine}`);
    const filteredPlayfulLootRows = playfulLootRows.filter((row) => matches(`놀이바둑 ${row.rounds} ${row.line}`));
    const showBlacksmithSection = matches(
        [
            '대장간',
            ENHANCEMENT_SUCCESS_RATES.join(' '),
            ...BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES.map((r) => JSON.stringify(r)),
            BLACKSMITH_DISASSEMBLY_JACKPOT_RATES.join(' '),
        ].join(' ')
    );
    const showShopSection = activeSection === 'shop';
    const showPvpSection = activeSection === 'pvp';
    const showChampionshipSection = activeSection === 'championship';
    const showBlacksmithToggleSection = activeSection === 'blacksmith';
    const showAdventureSection = activeSection === 'adventure';

    const sectionTabs: { key: RateSectionKey; label: string }[] = [
        { key: 'shop', label: '상점' },
        { key: 'pvp', label: '전략·놀이' },
        { key: 'championship', label: '챔피언십' },
        { key: 'blacksmith', label: '대장간' },
        { key: 'adventure', label: '모험' },
    ];

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const stored = window.localStorage.getItem(DROP_RATE_SECTION_STORAGE_KEY);
            if (!stored) return;
            if ((RATE_SECTION_KEYS as readonly string[]).includes(stored)) {
                setActiveSection(stored as RateSectionKey);
            }
        } catch {
            // Ignore localStorage access errors in restricted environments.
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(DROP_RATE_SECTION_STORAGE_KEY, activeSection);
        } catch {
            // Ignore localStorage write failures.
        }
    }, [activeSection]);

    return (
        <div className={`${adminPageNarrow} ${adminSectionGap}`}>
            <AdminPageHeader
                title="확률 정보"
                subtitle="상점 상자, 챔피언십 보상, 대장간, 모험 맵 보물상자·열쇠 관련 확률 테이블을 내부 운영용으로 확인합니다."
                onBack={onBack}
            />
            <section className={adminCard}>
                <h2 className={adminCardTitle}>섹션 토글</h2>
                <div className="flex flex-wrap gap-2">
                    {sectionTabs.map((tab) => {
                        const active = activeSection === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveSection(tab.key)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    active
                                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                                        : 'border-color/60 bg-secondary/60 text-gray-300 hover:border-color hover:bg-secondary'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className={adminCard}>
                <h2 className={adminCardTitle}>검색</h2>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="예: 장비 상자 IV, mythic, 3라운드, 대장간 10레벨"
                    className="w-full rounded-lg border border-color/60 bg-secondary px-3 py-2 text-sm text-primary outline-none ring-0 focus:border-amber-400/60"
                />
            </section>

            {showShopSection && <section className={adminCard}>
                <h2 className={adminCardTitle}>상점 장비 상자 등급 확률</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-3 py-2">상자 ID</th>
                                <th className="px-3 py-2">등급 분포</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEquipmentBoxRows.map((row) => (
                                <tr key={row.boxId} className="border-t border-color/40 text-gray-200">
                                    <td className="px-3 py-2 font-mono text-xs text-amber-300">{row.boxId}</td>
                                    <td className="px-3 py-2">{row.line}</td>
                                </tr>
                            ))}
                            {filteredEquipmentBoxRows.length === 0 && (
                                <tr className="border-t border-color/40 text-gray-500">
                                    <td className="px-3 py-3" colSpan={2}>검색 결과가 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>}

            {showShopSection && <section className={adminCard}>
                <h2 className={adminCardTitle}>상점 재료 상자 확률</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-3 py-2">상자 ID</th>
                                <th className="px-3 py-2">재료 분포</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMaterialBoxRows.map((row) => (
                                <tr key={row.boxId} className="border-t border-color/40 text-gray-200">
                                    <td className="px-3 py-2 font-mono text-xs text-emerald-300">{row.boxId}</td>
                                    <td className="px-3 py-2">{row.line}</td>
                                </tr>
                            ))}
                            {filteredMaterialBoxRows.length === 0 && (
                                <tr className="border-t border-color/40 text-gray-500">
                                    <td className="px-3 py-3" colSpan={2}>검색 결과가 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>}

            {showPvpSection && (showStrategicSection || filteredPlayfulLootRows.length > 0) && (
                <section className={adminCard}>
                    <h2 className={adminCardTitle}>전략/놀이 바둑 상자 드롭 확률</h2>
                    <div className="space-y-4 text-sm text-gray-200">
                        {showStrategicSection && (
                            <div>
                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">전략바둑 (승리 시 롤 테이블)</h3>
                                <p>{strategicLootLine}</p>
                            </div>
                        )}
                        {filteredPlayfulLootRows.length > 0 && (
                            <div className="overflow-x-auto">
                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">놀이바둑 (라운드별 승리 롤 테이블)</h3>
                                <table className="w-full min-w-[760px] text-left text-xs">
                                    <thead className="uppercase text-gray-400">
                                        <tr>
                                            <th className="px-2 py-2">라운드</th>
                                            <th className="px-2 py-2">드롭 테이블</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPlayfulLootRows.map((row) => (
                                            <tr key={`playful-${row.rounds}`} className="border-t border-color/40 text-gray-200">
                                                <td className="px-2 py-2 font-semibold text-sky-300">{row.rounds}라운드</td>
                                                <td className="px-2 py-2">{row.line}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {showChampionshipSection && <section className={adminCard}>
                <h2 className={adminCardTitle}>챔피언십 기본 보상 확률 (단계별)</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                        <thead className="uppercase text-gray-400">
                            <tr>
                                <th className="px-2 py-2">단계</th>
                                <th className="px-2 py-2">전국 승리 재료</th>
                                <th className="px-2 py-2">전국 패배 재료</th>
                                <th className="px-2 py-2">월드 승리 장비</th>
                                <th className="px-2 py-2">월드 패배 장비</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStageRows.map((stage) => {
                                const mat = DUNGEON_STAGE_MATERIAL_ROLLS[stage];
                                const equip = DUNGEON_STAGE_EQUIPMENT_DROP[stage];
                                const winMatLine = formatRateLine(
                                    (mat?.win ?? []).map((r) => ({
                                        label: `${r.materialName}(${r.min}~${r.max})`,
                                        rateText: `${r.chance}%`,
                                    }))
                                );
                                const lossMatLine = formatRateLine(
                                    (mat?.loss ?? mat?.win ?? []).map((r) => ({
                                        label: `${r.materialName}(${r.min}~${r.max})`,
                                        rateText: `${r.chance}%`,
                                    }))
                                );
                                const winEqLine = formatRateLine(
                                    (equip?.win ?? []).map((r: { grade: EquipmentGradeKey; chance: number }) => ({
                                        label: gradeLabel(r.grade),
                                        rateText: `${r.chance}%`,
                                    }))
                                );
                                const lossEqLine = formatRateLine(
                                    (equip?.loss ?? []).map((r: { grade: EquipmentGradeKey; chance: number }) => ({
                                        label: gradeLabel(r.grade),
                                        rateText: `${r.chance}%`,
                                    }))
                                );
                                return (
                                    <tr key={stage} className="border-t border-color/40 text-gray-200 align-top">
                                        <td className="px-2 py-2 font-semibold text-cyan-300">{stage}</td>
                                        <td className="px-2 py-2">{winMatLine}</td>
                                        <td className="px-2 py-2">{lossMatLine}</td>
                                        <td className="px-2 py-2">{winEqLine}</td>
                                        <td className="px-2 py-2">{lossEqLine}</td>
                                    </tr>
                                );
                            })}
                            {filteredStageRows.length === 0 && (
                                <tr className="border-t border-color/40 text-gray-500">
                                    <td className="px-2 py-3" colSpan={5}>검색 결과가 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>}

            {showAdventureSection && (
                <section className={adminCard}>
                    <h2 className={adminCardTitle}>모험 맵 — 지역 열쇠·보물상자</h2>
                    <div className="space-y-4 text-sm text-gray-200">
                        <div>
                            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">열쇠 (열쇠 경험치로 획득)</h3>
                            <p className="mb-2 text-xs text-gray-400">
                                챕터별로 열쇠 1개까지 필요한 경험치(N)가 다릅니다. 일반 몬스터 처치 +1, 챕터 보스 몬스터 +2입니다. KST 기준 일일
                                획득 한도 및 동시 보유 최대 개수는 아래 표와 같으며, 일일 한도는 자정(KST)에 리셋됩니다.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[480px] text-left text-xs">
                                    <thead className="uppercase text-gray-400">
                                        <tr>
                                            <th className="px-2 py-2">챕터</th>
                                            <th className="px-2 py-2">열쇠 1개까지 경험치(N)</th>
                                            <th className="px-2 py-2">일일 획득 / 최대 보유</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {([1, 2, 3, 4, 5] as const).map((ch) => {
                                            const c = ADVENTURE_MAP_KEY_CHAPTER_CONFIG[ch]!;
                                            return (
                                                <tr key={`adv-key-${ch}`} className="border-t border-color/40">
                                                    <td className="px-2 py-2 font-semibold text-amber-300">챕터 {ch}</td>
                                                    <td className="px-2 py-2">{c.keyXpRequired}</td>
                                                    <td className="px-2 py-2">
                                                        {c.dailyEarnCap}개 / {c.maxHeld}개
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">보물상자 출현·보상</h3>
                            <p className="mb-2 text-xs text-gray-400">
                                매 KST 정시를 기준으로 한 시간 구간 안에서 무작위 시각에 10분간 출현합니다. 보상 4종(골드·장비상자·재료상자·행동력)은
                                각 25%로 먼저 결정된 뒤, 장비·재료는 아래 챕터별 가중치로 등급(로마 숫자)이 정해집니다.
                            </p>
                            {([1, 2, 3, 4, 5] as const).map((ch) => (
                                <div key={`adv-tr-${ch}`} className="mb-4 rounded-lg border border-color/40 bg-secondary/40 p-3">
                                    <h4 className="mb-2 text-xs font-bold text-amber-200">챕터 {ch}</h4>
                                    <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-gray-300">
                                        {formatAdventureTreasureChestAdminLines(ch).map((line) => (
                                            <li key={`${ch}-${line.slice(0, 24)}`}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {showBlacksmithToggleSection && showBlacksmithSection && <section className={adminCard}>
                <h2 className={adminCardTitle}>대장간 확률</h2>
                <div className="space-y-3 text-sm text-gray-200">
                    <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">강화 성공률 (+1~+10)</h3>
                        <p>{ENHANCEMENT_SUCCESS_RATES.map((rate, idx) => `+${idx + 1}: ${rate}%`).join(' / ')}</p>
                    </div>
                    <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">장비 합성 대성공률 (대장간 레벨별)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-xs">
                                <thead className="uppercase text-gray-400">
                                    <tr>
                                        <th className="px-2 py-2">레벨</th>
                                        <th className="px-2 py-2">등급별 대성공률</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES.map((rateMap, idx) => {
                                        const line = Object.entries(rateMap)
                                            .map(([grade, rate]) => `${gradeLabel(grade)} ${rate}%`)
                                            .join(' / ');
                                        return (
                                            <tr key={`combine-${idx + 1}`} className="border-t border-color/40 text-gray-200">
                                                <td className="px-2 py-2 font-semibold text-violet-300">{idx + 1}</td>
                                                <td className="px-2 py-2">{line}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">분해/재료 대박 확률 (대장간 레벨별)</h3>
                        <p>{BLACKSMITH_DISASSEMBLY_JACKPOT_RATES.map((rate, idx) => `Lv.${idx + 1} ${rate}%`).join(' / ')}</p>
                    </div>
                </div>
            </section>}
        </div>
    );
};

export default DropRateReferencePanel;
