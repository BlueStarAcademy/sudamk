import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader.js';
import Button from '../Button.js';
import { adminCard, adminCardTitle, adminInput, adminPageNarrow, adminSectionGap } from './adminChrome.js';
import { DEFAULT_REWARD_CONFIG, type RewardConfig } from '../../shared/constants/rewardConfig.js';

interface RewardSystemPanelProps {
    currentUserId: string;
    onBack: () => void;
}

type RewardFieldDef = {
    key: keyof RewardConfig;
    label: string;
    description: string;
    group: '퀘스트' | '활약도 마일스톤' | '챔피언십' | '상점 광고' | '싱글 미션' | '길드 보상' | 'PVP 경기';
    defaultValueNote: string;
};

const REWARD_FIELDS: RewardFieldDef[] = [
    { key: 'questGoldBonus', label: '골드 +수치', description: '퀘스트 보상에 추가 골드', group: '퀘스트', defaultValueNote: '기본값: 퀘스트별 원본 골드' },
    { key: 'questDiamondBonus', label: '다이아 +수치', description: '퀘스트 보상에 추가 다이아', group: '퀘스트', defaultValueNote: '기본값: 퀘스트별 원본 다이아' },
    { key: 'questActionPointBonus', label: '행동력 +수치', description: '퀘스트 보상에 추가 행동력', group: '퀘스트', defaultValueNote: '기본값: 퀘스트별 원본 행동력' },
    { key: 'activityGoldBonus', label: '골드 +수치', description: '활약도 보상에 추가 골드', group: '활약도 마일스톤', defaultValueNote: '기본값: 마일스톤별 원본 골드' },
    { key: 'activityDiamondBonus', label: '다이아 +수치', description: '활약도 보상에 추가 다이아', group: '활약도 마일스톤', defaultValueNote: '기본값: 마일스톤별 원본 다이아' },
    { key: 'activityActionPointBonus', label: '행동력 +수치', description: '활약도 보상에 추가 행동력', group: '활약도 마일스톤', defaultValueNote: '기본값: 마일스톤별 원본 행동력' },
    { key: 'tournamentScoreBonus', label: '점수 +수치', description: '챔피언십 점수 보상 추가', group: '챔피언십', defaultValueNote: '기본값: 순위별 원본 점수 보상' },
    { key: 'tournamentGoldBonus', label: '골드 +수치', description: '챔피언십 순위 골드 추가', group: '챔피언십', defaultValueNote: '기본값: 순위별 원본 골드 보상' },
    { key: 'tournamentDiamondBonus', label: '다이아 +수치', description: '챔피언십 순위 다이아 추가', group: '챔피언십', defaultValueNote: '기본값: 순위별 원본 다이아 보상' },
    { key: 'shopAdDiamondBonus', label: '다이아 +수치', description: '상점 광고(다이아 탭) 추가 다이아', group: '상점 광고', defaultValueNote: '기본값: 5 다이아' },
    { key: 'singleMissionGoldBonus', label: '골드 +수치', description: '싱글 미션 수령 골드 추가', group: '싱글 미션', defaultValueNote: '기본값: 미션/레벨별 원본 골드' },
    { key: 'singleMissionDiamondBonus', label: '다이아 +수치', description: '싱글 미션 수령 다이아 추가', group: '싱글 미션', defaultValueNote: '기본값: 미션/레벨별 원본 다이아' },
    { key: 'guildCheckInCoinBonus', label: '길드코인 +수치', description: '길드 출석 보상 추가', group: '길드 보상', defaultValueNote: '기본값: 출석 마일스톤 원본 길드코인' },
    { key: 'guildMissionCoinBonus', label: '길드코인 +수치', description: '길드 미션 개인보상 추가', group: '길드 보상', defaultValueNote: '기본값: 길드 미션 원본 길드코인' },
    { key: 'pvpStrategicWinGoldBonus', label: '전략 승리 골드 +수치', description: '전략바둑 승리 시 추가 골드', group: 'PVP 경기', defaultValueNote: '기본값: 판크기·플레이시간 기반 전략 보상' },
    { key: 'pvpStrategicLossGoldBonus', label: '전략 패배 골드 +수치', description: '전략바둑 패배 시 추가 골드', group: 'PVP 경기', defaultValueNote: '기본값: 승리 보상 대비 감액된 전략 보상' },
    { key: 'pvpStrategicWinDiamondBonus', label: '전략 승리 다이아 +수치', description: '전략바둑 승리 시 추가 다이아', group: 'PVP 경기', defaultValueNote: '기본값: 0 다이아' },
    { key: 'pvpStrategicLossDiamondBonus', label: '전략 패배 다이아 +수치', description: '전략바둑 패배 시 추가 다이아', group: 'PVP 경기', defaultValueNote: '기본값: 0 다이아' },
    { key: 'pvpPlayfulWinGoldBonus', label: '놀이 승리 골드 +수치', description: '놀이바둑 승리 시 추가 골드', group: 'PVP 경기', defaultValueNote: '기본값: 라운드·플레이시간 기반 놀이 보상' },
    { key: 'pvpPlayfulLossGoldBonus', label: '놀이 패배 골드 +수치', description: '놀이바둑 패배 시 추가 골드', group: 'PVP 경기', defaultValueNote: '기본값: 승리 보상 대비 감액된 놀이 보상' },
    { key: 'pvpPlayfulWinDiamondBonus', label: '놀이 승리 다이아 +수치', description: '놀이바둑 승리 시 추가 다이아', group: 'PVP 경기', defaultValueNote: '기본값: 0 다이아' },
    { key: 'pvpPlayfulLossDiamondBonus', label: '놀이 패배 다이아 +수치', description: '놀이바둑 패배 시 추가 다이아', group: 'PVP 경기', defaultValueNote: '기본값: 0 다이아' },
];

const GROUP_ORDER: Array<RewardFieldDef['group']> = ['퀘스트', '활약도 마일스톤', '챔피언십', '상점 광고', '싱글 미션', '길드 보상', 'PVP 경기'];

type PreviewRow = {
    label: string;
    baseText: string;
    add: number;
    finalText: string;
};

const RewardSystemPanel: React.FC<RewardSystemPanelProps> = ({ currentUserId, onBack }) => {
    const [config, setConfig] = useState<RewardConfig>(DEFAULT_REWARD_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<RewardFieldDef['group']>('퀘스트');
    const [fieldQuery, setFieldQuery] = useState('');

    const groupedFields = useMemo(() => {
        const grouped = new Map<RewardFieldDef['group'], RewardFieldDef[]>();
        for (const group of GROUP_ORDER) grouped.set(group, []);
        for (const field of REWARD_FIELDS) grouped.get(field.group)?.push(field);
        return grouped;
    }, []);

    const activeFields = useMemo(() => {
        const list = groupedFields.get(activeTab) || [];
        const q = fieldQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter((field) => `${field.label} ${field.description} ${field.key}`.toLowerCase().includes(q));
    }, [activeTab, fieldQuery, groupedFields]);

    const previewRows = useMemo<PreviewRow[]>(() => {
        if (activeTab === '퀘스트') {
            const baseGold = 100;
            const baseDiamonds = 20;
            const baseAp = 10;
            return [
                {
                    label: '퀘스트 골드',
                    baseText: `${baseGold}`,
                    add: config.questGoldBonus,
                    finalText: `${Math.max(0, baseGold + config.questGoldBonus)}`,
                },
                {
                    label: '퀘스트 다이아',
                    baseText: `${baseDiamonds}`,
                    add: config.questDiamondBonus,
                    finalText: `${Math.max(0, baseDiamonds + config.questDiamondBonus)}`,
                },
                {
                    label: '퀘스트 행동력',
                    baseText: `${baseAp}`,
                    add: config.questActionPointBonus,
                    finalText: `${Math.max(0, baseAp + config.questActionPointBonus)}`,
                },
            ];
        }
        if (activeTab === '활약도 마일스톤') {
            const baseGold = 500;
            const baseDiamonds = 30;
            const baseAp = 15;
            return [
                {
                    label: '활약도 골드',
                    baseText: `${baseGold}`,
                    add: config.activityGoldBonus,
                    finalText: `${Math.max(0, baseGold + config.activityGoldBonus)}`,
                },
                {
                    label: '활약도 다이아',
                    baseText: `${baseDiamonds}`,
                    add: config.activityDiamondBonus,
                    finalText: `${Math.max(0, baseDiamonds + config.activityDiamondBonus)}`,
                },
                {
                    label: '활약도 행동력',
                    baseText: `${baseAp}`,
                    add: config.activityActionPointBonus,
                    finalText: `${Math.max(0, baseAp + config.activityActionPointBonus)}`,
                },
            ];
        }
        if (activeTab === '챔피언십') {
            const baseScore = 100;
            const baseGold = 1000;
            const baseDiamonds = 100;
            return [
                {
                    label: '챔피언십 점수',
                    baseText: `${baseScore}`,
                    add: config.tournamentScoreBonus,
                    finalText: `${Math.max(0, baseScore + config.tournamentScoreBonus)}`,
                },
                {
                    label: '챔피언십 골드',
                    baseText: `${baseGold}`,
                    add: config.tournamentGoldBonus,
                    finalText: `${Math.max(0, baseGold + config.tournamentGoldBonus)}`,
                },
                {
                    label: '챔피언십 다이아',
                    baseText: `${baseDiamonds}`,
                    add: config.tournamentDiamondBonus,
                    finalText: `${Math.max(0, baseDiamonds + config.tournamentDiamondBonus)}`,
                },
            ];
        }
        if (activeTab === '상점 광고') {
            const base = 5;
            return [
                {
                    label: '광고 보상 다이아',
                    baseText: `${base}`,
                    add: config.shopAdDiamondBonus,
                    finalText: `${Math.max(0, base + config.shopAdDiamondBonus)}`,
                },
            ];
        }
        if (activeTab === '싱글 미션') {
            const baseGold = 120;
            const baseDiamonds = 12;
            return [
                {
                    label: '싱글 미션 골드',
                    baseText: `${baseGold}`,
                    add: config.singleMissionGoldBonus,
                    finalText: `${Math.max(0, baseGold + config.singleMissionGoldBonus)}`,
                },
                {
                    label: '싱글 미션 다이아',
                    baseText: `${baseDiamonds}`,
                    add: config.singleMissionDiamondBonus,
                    finalText: `${Math.max(0, baseDiamonds + config.singleMissionDiamondBonus)}`,
                },
            ];
        }
        if (activeTab === '길드 보상') {
            const baseCheckIn = 30;
            const baseMission = 50;
            return [
                {
                    label: '길드 출석 코인',
                    baseText: `${baseCheckIn}`,
                    add: config.guildCheckInCoinBonus,
                    finalText: `${Math.max(0, baseCheckIn + config.guildCheckInCoinBonus)}`,
                },
                {
                    label: '길드 미션 코인',
                    baseText: `${baseMission}`,
                    add: config.guildMissionCoinBonus,
                    finalText: `${Math.max(0, baseMission + config.guildMissionCoinBonus)}`,
                },
            ];
        }
        return [
            {
                label: '전략 승리 골드',
                baseText: '동적(판크기/수순)',
                add: config.pvpStrategicWinGoldBonus,
                finalText: `기본 + ${config.pvpStrategicWinGoldBonus}`,
            },
            {
                label: '전략 승리 다이아',
                baseText: '0',
                add: config.pvpStrategicWinDiamondBonus,
                finalText: `${Math.max(0, config.pvpStrategicWinDiamondBonus)}`,
            },
            {
                label: '놀이 승리 골드',
                baseText: '동적(라운드/시간)',
                add: config.pvpPlayfulWinGoldBonus,
                finalText: `기본 + ${config.pvpPlayfulWinGoldBonus}`,
            },
            {
                label: '놀이 승리 다이아',
                baseText: '0',
                add: config.pvpPlayfulWinDiamondBonus,
                finalText: `${Math.max(0, config.pvpPlayfulWinDiamondBonus)}`,
            },
        ];
    }, [activeTab, config]);

    const fetchConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const qs = new URLSearchParams({ userId: currentUserId });
            const response = await fetch(`/api/admin/reward-config?${qs.toString()}`);
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            setConfig({ ...DEFAULT_REWARD_CONFIG, ...(data?.rewardConfig || {}) });
        } catch (err: any) {
            setError(err?.message || '보상 설정을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [currentUserId]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/reward-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    rewardConfig: config,
                }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            setConfig({ ...DEFAULT_REWARD_CONFIG, ...(data?.rewardConfig || {}) });
            setMessage('보상 수치 설정이 저장되었습니다.');
        } catch (err: any) {
            setError(err?.message || '보상 설정 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key: keyof RewardConfig, nextValue: string) => {
        const num = Number(nextValue);
        const safe = Number.isFinite(num) ? Math.max(0, Math.min(1000000, Math.floor(num))) : 0;
        setConfig((prev) => ({ ...prev, [key]: safe }));
        setMessage(null);
    };

    return (
        <div className={`${adminPageNarrow} ${adminSectionGap}`}>
            <AdminPageHeader
                title="보상 체계"
                subtitle="현재 적용 중인 보상 추가 수치를 확인하고 운영 정책에 맞춰 실시간 조정합니다."
                onBack={onBack}
            />

            <section className={adminCard}>
                <h2 className={adminCardTitle}>보상 체계 요약</h2>
                <ul className="space-y-1 text-sm text-gray-300">
                    <li>- 퀘스트 보상: 골드/다이아/행동력 +수치 적용</li>
                    <li>- 활약도/챔피언십/상점/싱글/길드/PVP 모두 배율이 아닌 +수치로 적용</li>
                    <li>- 전략/놀이 경기 승패 골드·다이아 보상을 각각 직접 조절 가능</li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">0은 "추가 수치 없음"이며 기본 보상은 그대로 적용됩니다. 즉 0이어도 실제 보상이 0이라는 뜻은 아닙니다.</p>
            </section>

            {error && (
                <section className={`${adminCard} border border-red-500/60`}>
                    <p className="text-sm text-red-300">{error}</p>
                </section>
            )}
            {message && (
                <section className={`${adminCard} border border-emerald-500/50`}>
                    <p className="text-sm text-emerald-300">{message}</p>
                </section>
            )}

            {loading ? (
                <section className={adminCard}>
                    <p className="text-sm text-gray-300">보상 설정을 불러오는 중...</p>
                </section>
            ) : (
                <>
                    <section className={adminCard}>
                        <h2 className={adminCardTitle}>보상 탭</h2>
                        <div className="flex flex-wrap gap-2">
                            {GROUP_ORDER.map((group) => {
                                const active = activeTab === group;
                                return (
                                    <button
                                        key={group}
                                        type="button"
                                        onClick={() => setActiveTab(group)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                            active
                                                ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                                                : 'border-color/60 bg-secondary/60 text-gray-300 hover:border-color hover:bg-secondary'
                                        }`}
                                    >
                                        {group}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3">
                            <input
                                type="text"
                                value={fieldQuery}
                                onChange={(e) => setFieldQuery(e.target.value)}
                                placeholder="현재 탭 내 항목 검색 (예: 전략 승리 골드)"
                                className={`${adminInput} w-full`}
                            />
                        </div>
                    </section>
                    <section className={adminCard}>
                        <h2 className={adminCardTitle}>{activeTab}</h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {activeFields.map((field) => (
                                <label key={field.key} className="rounded-xl border border-color/40 bg-secondary/40 p-3 text-sm">
                                    <div className="text-primary">{field.label}</div>
                                    <div className="mt-1 text-xs text-gray-400">{field.description}</div>
                                    <div className="mt-1 text-[11px] text-gray-500">{field.defaultValueNote}</div>
                                    <div className="mt-1 text-[11px] text-amber-200/90">현재 적용: 기본값 + {config[field.key]}</div>
                                    <input
                                        type="number"
                                        min={0}
                                        max={1000000}
                                        step={1}
                                        value={config[field.key]}
                                        onChange={(e) => updateField(field.key, e.target.value)}
                                        className={`${adminInput} mt-2 w-full`}
                                    />
                                </label>
                            ))}
                            {activeFields.length === 0 && (
                                <div className="rounded-xl border border-color/40 bg-secondary/30 p-3 text-sm text-gray-400">
                                    검색 결과가 없습니다.
                                </div>
                            )}
                        </div>
                    </section>
                    <section className={adminCard}>
                        <h2 className={adminCardTitle}>미리보기 (기본/추가/최종)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] text-left text-xs">
                                <thead className="text-gray-400 uppercase">
                                    <tr>
                                        <th className="px-2 py-2">항목</th>
                                        <th className="px-2 py-2">기본값</th>
                                        <th className="px-2 py-2">추가값</th>
                                        <th className="px-2 py-2">최종값</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((row) => (
                                        <tr key={row.label} className="border-t border-color/40 text-gray-200">
                                            <td className="px-2 py-2">{row.label}</td>
                                            <td className="px-2 py-2">{row.baseText}</td>
                                            <td className="px-2 py-2">+ {row.add}</td>
                                            <td className="px-2 py-2 text-amber-200">{row.finalText}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500">
                            PVP 골드는 경기 길이/판크기 영향을 받는 동적 기본값이라, 최종값은 "기본 + 추가" 형태로 표시됩니다.
                        </p>
                    </section>
                </>
            )}

            <section className={adminCard}>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={fetchConfig} disabled={loading || saving}>
                        새로고침
                    </Button>
                    <Button colorScheme="green" onClick={handleSave} disabled={loading || saving}>
                        {saving ? '저장 중...' : '보상 수치 저장'}
                    </Button>
                </div>
            </section>
        </div>
    );
};

export default RewardSystemPanel;
