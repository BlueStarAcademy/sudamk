import React, { useMemo } from 'react';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminPageNarrow, adminSectionGap } from './adminChrome.js';
import { ADVENTURE_STRATEGY_XP_BY_BOARD_SIZE } from '../../shared/constants/adventureStrategyXp.js';
import { PAIR_GO_REWARD_BANDS } from '../../shared/constants/pairGoRewardBands.js';
import { PAIR_TRAINING_SLOT_DEFS, getPairTrainingSlotDisplayName } from '../../shared/constants/pairTraining.js';
import { pairPetMinLevelForNextGrade } from '../../shared/constants/pairPetGrade.js';
import { ItemGrade } from '../../types/enums.js';
import { aiLobbyRewardMultiplierFromProfileStep, strategicLobbyAiWinXp } from '../../shared/utils/strategicAiDifficulty.js';
import { getScoringTurnLimitOptionsByBoardSize } from '../../constants/gameSettings.js';

interface XpFormulaReferencePanelProps {
    onBack: () => void;
}

const formulaBlock = 'mt-2 rounded-xl border border-color/50 bg-secondary/40 p-3 font-mono text-[13px] leading-relaxed text-gray-300 whitespace-pre-wrap';

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-300">
        {items.map((t) => (
            <li key={t}>{t}</li>
        ))}
    </ul>
);

const XpFormulaReferencePanel: React.FC<XpFormulaReferencePanelProps> = ({ onBack }) => {
    const adventureRows = useMemo(
        () =>
            Object.entries(ADVENTURE_STRATEGY_XP_BY_BOARD_SIZE)
                .map(([k, v]) => ({ board: Number(k), exp: v }))
                .sort((a, b) => a.board - b.board),
        [],
    );

    const lobbyAiRows = useMemo(() => {
        const sizes = [9, 13, 19] as const;
        return sizes.map((boardSize) => {
            const opts = getScoringTurnLimitOptionsByBoardSize(boardSize).filter((n) => n > 0);
            const maxTurn = opts.length ? Math.max(...opts) : 0;
            return {
                boardSize,
                base: strategicLobbyAiWinXp(boardSize, undefined),
                maxTurn: strategicLobbyAiWinXp(boardSize, maxTurn),
            };
        });
    }, []);

    const pairGoRows = useMemo(
        () =>
            ([9, 13, 19] as const).map((k) => ({
                board: k,
                band: PAIR_GO_REWARD_BANDS[k],
            })),
        [],
    );

    const aiLobbySteps = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), []);

    return (
        <div className={adminPageNarrow}>
            <AdminPageHeader
                title="경험치 획득 공식"
                subtitle="유저 EXP(userXp)와 대표펫(장착 펫) 경험치는 서버 정산 로직과 동일한 기준으로 정리했습니다. 상수·구간은 공유 모듈 값을 반영합니다."
                onBack={onBack}
            />

            <div className={adminSectionGap}>
                <section className={adminCard}>
                    <h2 className={adminCardTitle}>1. 유저 EXP (프로필 EXP / userXp)</h2>
                    <p className="text-sm text-gray-400">
                        일반 1:1 대국 정산은 <code className="text-amber-200/90">server/summaryService.ts</code>의{' '}
                        <code className="text-amber-200/90">processPlayerSummary</code>를 따릅니다. 아래는 그 순서를 요약한
                        것입니다.
                    </p>
                    <BulletList
                        items={[
                            '무효국(no contest): 0.',
                            '모험 몬스터 대전: 승리 시 기본 EXP(판 크기) + 몬스터 레벨 보너스, 패배·휴먼 패는 0.',
                            '전략바둑 대기실 AI: 승리 시 `strategicLobbyAiWinXp`(9줄 기준 × 판 크기 배율 × 계가 최대 턴 여부), 패배 0.',
                            '그 외 전략 모드 기본값: 승리 100, 무승부 0, 패배 25 (무효국 제외).',
                            'AI 대국(모험·전략 대기실 AI 제외): 위 값에 ×0.2.',
                            '전략 PVP/PVE(모험·전략 대기실 AI 제외): 상대 레벨 − 내 레벨에 따라 (1 + 차이×0.1)배, 0.5~1.5로 클램프 후 반올림.',
                            '특수 능력치: 전략 모드는 EXP% 보너스, 놀이 모드는 놀이 EXP% 보너스가 (1 + 합계%)로 곱해짐.',
                            '완주 배율: 전략은 `min(1, 실제 수 / (100×(판/19)²))` (19×19·100수가 100%). 모험·전략 대기실 AI는 이 배율을 적용하지 않음.',
                            '위 배율을 EXP에 곱한 뒤, 랭킹이 아닌 휴먼 간 전략·놀이 PVP는 ×0.25.',
                            '길드 전쟁에서 획득 별이 0이면 EXP 0.',
                            '대기실 AI 놀이바둑: 프로필 단계별 배율(1=1.0, 2=1.2, 3~10은 +0.1씩, 7=1.7, 10=2.0) 적용.',
                            '보상 VIP(조건 충족 시): 전략·놀이 승리에 한해 EXP ×2.',
                            '놀이바둑(PLAYFUL): 위 계산 후 최종 EXP는 항상 0으로 고정.',
                            '휴먼 간 기권으로 끝난 패배 측 등: EXP 0.',
                        ]}
                    />
                    <h3 className="mt-5 text-sm font-semibold text-primary">모험 기본 EXP (판 크기)</h3>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-color/50">
                        <table className="w-full min-w-[280px] text-left text-sm text-gray-300">
                            <thead className="border-b border-color/50 bg-secondary/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">판 줄 수</th>
                                    <th className="px-3 py-2">기본 EXP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adventureRows.map((r) => (
                                    <tr key={r.board} className="border-b border-color/40 last:border-0">
                                        <td className="px-3 py-2">{r.board}</td>
                                        <td className="px-3 py-2">{r.exp}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                        몬스터 레벨 보너스: Lv1~5는 +0, 이후 5레벨마다 +1 (최대 Lv50까지, 상한 반영은{' '}
                        <code className="text-amber-200/90">getAdventureMonsterLevelXpBonus</code>).
                    </p>

                    <h3 className="mt-5 text-sm font-semibold text-primary">전략 대기실 AI 승리 EXP (참고 값)</h3>
                    <p className="mt-2 text-sm text-gray-400">
                        9줄 모험 기본 EXP × (13줄 2배, 19줄 5배) × (해당 판에서 계가 턴 한도가 최대면 ×1.5).
                    </p>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-color/50">
                        <table className="w-full min-w-[320px] text-left text-sm text-gray-300">
                            <thead className="border-b border-color/50 bg-secondary/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">판</th>
                                    <th className="px-3 py-2">일반 계가 한도</th>
                                    <th className="px-3 py-2">최대 계가 한도</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lobbyAiRows.map((r) => (
                                    <tr key={r.boardSize} className="border-b border-color/40 last:border-0">
                                        <td className="px-3 py-2">{r.boardSize}줄</td>
                                        <td className="px-3 py-2">{r.base}</td>
                                        <td className="px-3 py-2">{r.maxTurn}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="mt-5 text-sm font-semibold text-primary">놀이바둑 완주 배율 (EXP에는 미적용·골드 등에 사용)</h3>
                    <div className={formulaBlock}>
                        {`무승부 → 1
승리 → (1 + min(0.35, max(0, rounds−1)×0.12) + min(0.28, scoreGap×0.02)) × 1
패배 → 위 괄호 × 0.78
전체 하한 0.5`}
                    </div>

                    <h3 className="mt-5 text-sm font-semibold text-primary">기타 출처</h3>
                    <BulletList
                        items={[
                            '싱글플레이: 스테이지 `firstClear`의 exp·골드·아이템 — 최초 클리어 1회만 지급(재도전·재클리어 보상 없음).',
                            '도전의 탑: 해당 층 `TOWER_STAGES`의 `rewards.firstClear.exp` — 최초 클리어이며 이번 입장에 행동력이 실제 소모된 승리에만.',
                            '2인 페어바둑: 아래 「페어바둑 롤 구간」의 strategyXp를 굴린 뒤 난이도·승패 배율·보상 VIP를 적용 (별도 함수).',
                        ]}
                    />
                </section>

                <section className={adminCard}>
                    <h2 className={adminCardTitle}>2. 대표펫 경험치 (장착 펫 / pair 펫)</h2>
                    <h3 className="text-sm font-semibold text-primary">전략바둑 대국 보너스</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        전략 모드·페어바둑이 아님·무효국 아님·유저 EXP 증가가 0보다 큼·AI가 아닌 플레이어·싱글/타워/싱글플레이 카테고리 제외일 때, 위에서 확정된{' '}
                        <strong className="text-primary">유저 EXP 증분</strong>의 절반을 대표펫에 지급합니다.
                    </p>
                    <div className={formulaBlock}>{'petRaw = max(0, round(userXpGain × 0.5))'}</div>
                    <p className="mt-2 text-sm text-gray-400">
                        등급별로 다음 등급 강화 전 최대 레벨에 도달하면 경험치 획득이 막힙니다. 다음 단계 최소 레벨은{' '}
                        <code className="text-amber-200/90">pairPetMinLevelForNextGrade</code> (일반 Lv10, …, 전설 Lv50). 신화 등
                        더 이상 강화할 등급이 없으면 제한 없음.
                    </p>

                    <h3 className="mt-5 text-sm font-semibold text-primary">페어바둑 — 유저·펫 롤 구간 (판별)</h3>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-color/50">
                        <table className="w-full min-w-[360px] text-left text-sm text-gray-300">
                            <thead className="border-b border-color/50 bg-secondary/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">판</th>
                                    <th className="px-3 py-2">EXP (주사위)</th>
                                    <th className="px-3 py-2">펫 EXP (주사위)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pairGoRows.map((r) => (
                                    <tr key={r.board} className="border-b border-color/40 last:border-0">
                                        <td className="px-3 py-2">{r.board}줄</td>
                                        <td className="px-3 py-2">
                                            {r.band.strategyXp[0]} ~ {r.band.strategyXp[1]}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.band.petXp[0]} ~ {r.band.petXp[1]}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                        페어 AI전: 굴린 값에 <code className="text-amber-200/90">pairGoAiRewardRelativeToStep3Multiplier</code> (3단계
                        = 1, 단계마다 ±0.1) × 승패 배율(승 1 / 패 0.5 / 무·무효·기권 패 등 0). 승리 시 보상 VIP면 전략·펫 EXP 모두 ×2.
                    </p>

                    <h3 className="mt-5 text-sm font-semibold text-primary">페어 경기장 수련 완료 시 (대표펫이 아닌 수련 중인 펫)</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        슬롯별 <code className="text-amber-200/90">xpMin</code>~<code className="text-amber-200/90">xpMax</code> 균등
                        주사위 후, 특화가 &quot;수련 EXP&quot;이면 (1 + 특화%)를 곱하고 내림.
                    </p>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-color/50">
                        <table className="w-full min-w-[280px] text-left text-sm text-gray-300">
                            <thead className="border-b border-color/50 bg-secondary/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">슬롯</th>
                                    <th className="px-3 py-2">EXP 범위</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PAIR_TRAINING_SLOT_DEFS.map((def) => (
                                    <tr key={def.slotIndex} className="border-b border-color/40 last:border-0">
                                        <td className="px-3 py-2">{getPairTrainingSlotDisplayName(def.slotIndex)}</td>
                                        <td className="px-3 py-2">
                                            {def.xpMin} ~ {def.xpMax}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="mt-5 text-sm font-semibold text-primary">레벨업 필요 EXP</h3>
                    <div className={formulaBlock}>
                        {`유저/놀이 레벨 바 (getXpRequirementForLevel):
Lv 1–10: 200 + Lv×100
Lv 11–20: 300 + Lv×150
Lv 21–50: 이전 구간 값에서 매 레벨 ×1.2
Lv 51–100: ×1.3

대표펫 레벨 바 (getPairPetXpRequirementForLevel): 위 구간별 필요치의 절반(올림, 최소 1).`}
                    </div>
                </section>

                <section className={adminCard}>
                    <h2 className={adminCardTitle}>3. 참고: 대기실 AI 놀이 단계별 곱 (유저 EXP 경로)</h2>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-color/50">
                        <table className="w-full min-w-[200px] text-left text-sm text-gray-300">
                            <thead className="border-b border-color/50 bg-secondary/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">프로필 단계</th>
                                    <th className="px-3 py-2">배율</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aiLobbySteps.map((step) => (
                                    <tr key={step} className="border-b border-color/40 last:border-0">
                                        <td className="px-3 py-2">{step}</td>
                                        <td className="px-3 py-2">{aiLobbyRewardMultiplierFromProfileStep(step)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className={adminCard}>
                    <h2 className={adminCardTitle}>4. 등급별 펫 EXP 정지 레벨</h2>
                    <p className="text-sm text-gray-400">
                        다음 등급 강화가 가능한 동안은, 아래 레벨에 도달한 뒤에는 경험치를 더 받지 못합니다 (
                        <code className="text-amber-200/90">pairPetXpGainBlockedByGrade</code>).
                    </p>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-color/50">
                        <table className="w-full min-w-[260px] text-left text-sm text-gray-300">
                            <thead className="border-b border-color/50 bg-secondary/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">등급</th>
                                    <th className="px-3 py-2">EXP 획득 정지 (Lv 이상)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(
                                    [
                                        ItemGrade.Normal,
                                        ItemGrade.Uncommon,
                                        ItemGrade.Rare,
                                        ItemGrade.Epic,
                                        ItemGrade.Legendary,
                                    ] as const
                                ).map((g) => (
                                    <tr key={g} className="border-b border-color/40 last:border-0">
                                        <td className="px-3 py-2">{g}</td>
                                        <td className="px-3 py-2">Lv.{pairPetMinLevelForNextGrade(g)} 이상</td>
                                    </tr>
                                ))}
                                <tr className="border-b border-color/40 last:border-0">
                                    <td className="px-3 py-2">{ItemGrade.Mythic}</td>
                                    <td className="px-3 py-2">다음 등급 없음 — Lv.50 제한만 적용</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default XpFormulaReferencePanel;
