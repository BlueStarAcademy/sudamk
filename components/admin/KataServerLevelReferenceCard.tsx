import React, { useMemo } from 'react';
import { adminCard, adminCardTitle } from './adminChrome.js';
import {
    KATA_SERVER_LEVEL_BY_PROFILE_STEP,
    STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP,
    adventureMonsterLevelToKataServerLevel,
} from '../../shared/utils/strategicAiDifficulty.js';
import { getTowerKataServerLevelByFloor } from '../../shared/utils/towerKataServerLevel.js';
import {
    GUILD_WAR_BOARD_ORDER,
    GUILD_WAR_BOARD_DISPLAY_NAMES,
    getGuildWarBoardMode,
    getGuildWarKataServerLevelByBoardId,
} from '../../shared/constants/guildConstants.js';
import { DEFAULT_GAME_SETTINGS } from '../../shared/constants/gameSettings.js';

const tableWrap = 'mt-2 max-h-56 overflow-auto rounded-lg border border-color/40';
const tableCls = 'w-full border-collapse text-left text-xs';
const thCls = 'sticky top-0 z-[1] border-b border-color/50 bg-secondary/80 px-2 py-1.5 font-semibold text-primary';
const tdCls = 'border-b border-color/30 px-2 py-1 text-gray-300';

function buildTowerFloorRanges(): { from: number; to: number; level: number }[] {
    const segments: { from: number; to: number; level: number }[] = [];
    let start = 1;
    let curLevel = getTowerKataServerLevelByFloor(1);
    for (let f = 2; f <= 100; f++) {
        const L = getTowerKataServerLevelByFloor(f);
        if (L !== curLevel) {
            segments.push({ from: start, to: f - 1, level: curLevel });
            start = f;
            curLevel = L;
        }
    }
    segments.push({ from: start, to: 100, level: curLevel });
    return segments;
}

const KataServerLevelReferenceCard: React.FC = () => {
    const lobbyRows = useMemo(
        () =>
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => ({
                step,
                kata: KATA_SERVER_LEVEL_BY_PROFILE_STEP[step],
                display: STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP[step],
            })),
        [],
    );

    const singlePlayerRows = useMemo(
        () => [
            { name: '입문', step: 1, kata: KATA_SERVER_LEVEL_BY_PROFILE_STEP[1] },
            { name: '초급', step: 2, kata: KATA_SERVER_LEVEL_BY_PROFILE_STEP[2] },
            { name: '중급', step: 3, kata: KATA_SERVER_LEVEL_BY_PROFILE_STEP[3] },
            { name: '고급', step: 4, kata: KATA_SERVER_LEVEL_BY_PROFILE_STEP[4] },
            { name: '유단자', step: 5, kata: KATA_SERVER_LEVEL_BY_PROFILE_STEP[5] },
        ],
        [],
    );

    const adventureRows = useMemo(
        () =>
            Array.from({ length: 50 }, (_, i) => {
                const lv = i + 1;
                return { lv, kata: adventureMonsterLevelToKataServerLevel(lv) };
            }),
        [],
    );

    const towerRanges = useMemo(() => buildTowerFloorRanges(), []);

    const guildRows = useMemo(
        () =>
            GUILD_WAR_BOARD_ORDER.map((boardId) => ({
                boardId,
                label: GUILD_WAR_BOARD_DISPLAY_NAMES[boardId],
                mode: getGuildWarBoardMode(boardId),
                kata: getGuildWarKataServerLevelByBoardId(boardId),
            })),
        [],
    );

    const defaultKata = DEFAULT_GAME_SETTINGS.kataServerLevel;

    return (
        <div className={adminCard}>
            <h2 className={adminCardTitle}>KataServer 레벨 매핑 (참고)</h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-400">
                원격 KataServer <span className="font-mono">/move</span>의 <span className="font-mono">level</span>에 쓰이는{' '}
                <span className="font-mono">kataServerLevel</span> 값이 콘텐츠별로 어떻게 정해지는지입니다. (로컬 KataGo
                실행 파일 설정과는 별개입니다.)
            </p>

            <div className="space-y-5 text-sm">
                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">전략 대기실 AI (1~10단계)</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                        <span className="font-mono">KATA_SERVER_LEVEL_BY_PROFILE_STEP</span> · 표시 레벨은{' '}
                        <span className="font-mono">STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP</span>
                    </p>
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
                    <h3 className="text-sm font-semibold text-amber-200/90">싱글플레이 (반별 고정)</h3>
                    <p className="mt-0.5 text-xs text-gray-500">스테이지 반(입문~유단자) → 프로필 1~5 → 위 표의 Kata 값</p>
                    <div className={tableWrap}>
                        <table className={tableCls}>
                            <thead>
                                <tr>
                                    <th className={thCls}>반</th>
                                    <th className={thCls}>프로필 단계</th>
                                    <th className={thCls}>kataServerLevel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {singlePlayerRows.map((r) => (
                                    <tr key={r.name}>
                                        <td className={tdCls}>{r.name}</td>
                                        <td className={tdCls}>{r.step}</td>
                                        <td className={`${tdCls} font-mono`}>{r.kata}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-semibold text-amber-200/90">모험 몬스터 레벨 1~50</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                        <span className="font-mono">adventureMonsterLevelToKataServerLevel</span> (<span className="font-mono">userActions</span>{' '}
                        모험 대국 생성 시)
                    </p>
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
                    <p className="mt-0.5 text-xs text-gray-500">
                        <span className="font-mono">getTowerKataServerLevelByFloor</span> (<span className="font-mono">towerActions</span>)
                    </p>
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
                    <h3 className="text-sm font-semibold text-amber-200/90">길드전 9칸 (열 고정)</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                        <span className="font-mono">getGuildWarKataServerLevelByBoardId</span> — 좌열 -30 / 중앙열 -28 / 우열 -25
                    </p>
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
                            <span className="font-mono">DEFAULT_GAME_SETTINGS.kataServerLevel</span> ·{' '}
                            <span className="font-mono">AiChallengeModal</span>)
                        </li>
                        <li>비전략 로비 등 다른 경로는 설정에 따라 다를 수 있으며, 위 표는 KataServer를 쓰는 주요 고정 매핑 위주입니다.</li>
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default KataServerLevelReferenceCard;
