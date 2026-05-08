import React, { useMemo } from 'react';
import { STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP } from '../../shared/utils/strategicAiDifficulty.js';
import { GUILD_WAR_BOARD_ORDER, GUILD_WAR_BOARD_DISPLAY_NAMES, getGuildWarBoardMode } from '../../shared/constants/guildConstants.js';
import { DEFAULT_GAME_SETTINGS } from '../../shared/constants/gameSettings.js';
import type { KataServerRuntimeSnapshot } from '../../shared/types/kataServerRuntime.js';
import { adminCard, adminCardTitle } from './adminChrome.js';

const tableWrap = 'mt-2 max-h-56 overflow-auto rounded-lg border border-color/40';
const tableCls = 'w-full border-collapse text-left text-xs';
const thCls = 'sticky top-0 z-[1] border-b border-color/50 bg-secondary/80 px-2 py-1.5 font-semibold text-primary';
const tdCls = 'border-b border-color/30 px-2 py-1 text-gray-300';

function buildTowerFloorRangesFromSnapshot(snap: KataServerRuntimeSnapshot): { from: number; to: number; level: number }[] {
    const segments: { from: number; to: number; level: number }[] = [];
    let start = 1;
    let curLevel = snap.towerKataByFloor['1'] ?? -30;
    for (let f = 2; f <= 100; f++) {
        const L = snap.towerKataByFloor[String(f)] ?? curLevel;
        if (L !== curLevel) {
            segments.push({ from: start, to: f - 1, level: curLevel });
            start = f;
            curLevel = L;
        }
    }
    segments.push({ from: start, to: 100, level: curLevel });
    return segments;
}

export interface KataServerLevelReferenceCardProps {
    /** 병합된 런타임 스냅샷(INITIAL_STATE·관리자 화면 공통) */
    config: KataServerRuntimeSnapshot;
}

const KataServerLevelReferenceCard: React.FC<KataServerLevelReferenceCardProps> = ({ config }) => {
    const lobbyRows = useMemo(
        () =>
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => ({
                step,
                kata: config.strategicLobbyKataByStep[String(step)] ?? -31,
                display: config.strategicLobbyDisplayByStep[String(step)] ?? STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP[step] ?? step,
            })),
        [config],
    );

    const adventureRows = useMemo(
        () =>
            Array.from({ length: 50 }, (_, i) => {
                const lv = i + 1;
                return { lv, kata: config.adventureKataByMonsterLevel[String(lv)] ?? -31 };
            }),
        [config],
    );

    const towerRanges = useMemo(() => buildTowerFloorRangesFromSnapshot(config), [config]);

    const guildRows = useMemo(
        () =>
            GUILD_WAR_BOARD_ORDER.map((boardId) => ({
                boardId,
                label: GUILD_WAR_BOARD_DISPLAY_NAMES[boardId],
                mode: getGuildWarBoardMode(boardId),
                kata: config.guildWarKataByBoardId[boardId] ?? -10,
            })),
        [config],
    );

    const defaultKata = DEFAULT_GAME_SETTINGS.kataServerLevel;

    return (
        <div className={adminCard}>
            <h2 className={adminCardTitle}>KataServer 레벨 매핑 (현재 적용값)</h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-400">
                원격 KataServer <span className="font-mono">/move</span>의 <span className="font-mono">level</span>에 쓰이는 값입니다. 위 편집기에서 변경한 런타임
                설정이 반영됩니다. (로컬 KataGo 실행 파일 설정과는 별개입니다.)
            </p>

            <div className="space-y-5 text-sm">
                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">전략 대기실 AI (1~10단계)</h3>
                    <p className="mt-0.5 text-xs text-gray-500">현재 서버 런타임 `strategicLobbyKataByStep` · 표시 레벨</p>
                    <div className={tableWrap}>
                        <table className={tableCls}>
                            <thead>
                                <tr>
                                    <th className={thCls}>단계</th>
                                    <th className={thCls}>kataServerLevel</th>
                                    <th className={thCls}>패널 표시 레벨</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lobbyRows.map((r) => (
                                    <tr key={r.step}>
                                        <td className={tdCls}>{r.step}</td>
                                        <td className={`${tdCls} font-mono`}>{r.kata}</td>
                                        <td className={tdCls}>{r.display}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">싱글플레이</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                        실제 대국의 KataServer 레벨은 싱글플레이 스테이지 편집에 저장된 스테이지별{' '}
                        <span className="font-mono">kataServerLevel</span>을 우선 사용합니다. 반(입문~유단자)은 봇 표시 프로필에만 사용됩니다.
                    </p>
                </section>

                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">모험 몬스터 레벨 1~50</h3>
                    <p className="mt-0.5 text-xs text-gray-500">`adventureKataByMonsterLevel`</p>
                    <div className={tableWrap}>
                        <table className={tableCls}>
                            <thead>
                                <tr>
                                    <th className={thCls}>몬스터 Lv</th>
                                    <th className={thCls}>kataServerLevel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adventureRows.map((r) => (
                                    <tr key={r.lv}>
                                        <td className={tdCls}>{r.lv}</td>
                                        <td className={`${tdCls} font-mono`}>{r.kata}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">도전의 탑 (층 1~100)</h3>
                    <p className="mt-0.5 text-xs text-gray-500">`towerKataByFloor`</p>
                    <div className={tableWrap}>
                        <table className={tableCls}>
                            <thead>
                                <tr>
                                    <th className={thCls}>층 범위</th>
                                    <th className={thCls}>kataServerLevel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {towerRanges.map((seg) => (
                                    <tr key={`${seg.from}-${seg.to}`}>
                                        <td className={tdCls}>
                                            {seg.from === seg.to ? `${seg.from}층` : `${seg.from}~${seg.to}층`}
                                        </td>
                                        <td className={`${tdCls} font-mono`}>{seg.level}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">길드전 9칸</h3>
                    <p className="mt-0.5 text-xs text-gray-500">`guildWarKataByBoardId`</p>
                    <div className={tableWrap}>
                        <table className={tableCls}>
                            <thead>
                                <tr>
                                    <th className={thCls}>칸</th>
                                    <th className={thCls}>boardId</th>
                                    <th className={thCls}>모드</th>
                                    <th className={thCls}>kataServerLevel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {guildRows.map((r) => (
                                    <tr key={r.boardId}>
                                        <td className={tdCls}>{r.label}</td>
                                        <td className={`${tdCls} font-mono text-[11px]`}>{r.boardId}</td>
                                        <td className={tdCls}>{r.mode}</td>
                                        <td className={`${tdCls} font-mono`}>{r.kata}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">기타</h3>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-gray-400">
                        <li>
                            전략 대기실 AI 도전 모달: 단계 미설정 시 기본값{' '}
                            <span className="font-mono text-gray-300">{String(defaultKata)}</span> (
                            <span className="font-mono">DEFAULT_GAME_SETTINGS.kataServerLevel</span>)
                        </li>
                        <li>싱글 스테이지별 세부 `kataServerLevel`은 싱글플레이 스테이지 관리에서 별도 설정됩니다.</li>
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default KataServerLevelReferenceCard;
