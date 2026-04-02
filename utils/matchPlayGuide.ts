import { LiveGameSession, GameMode, Player } from '../types.js';
import { DEFAULT_KOMI } from '../constants/index.js';

export type MatchPlayGuideSection = { subtitle: string; items: string[] };

export type MatchPlayGuide = { title: string; sections: MatchPlayGuideSection[] };

function pickStrings(items: (string | null | undefined | false)[]): string[] {
    return items.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function turnLimitHint(session: LiveGameSession): string | null {
    const n = session.settings?.scoringTurnLimit;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
    return `정해진 ${n}턴(패스 포함)에 도달하면 자동으로 계가로 넘어갑니다. 후반만 기대하기보다 중반까지 우세를 잡는 편이 안전합니다.`;
}

function komiLine(session: LiveGameSession): string {
    const k = session.finalKomi ?? session.settings.komi ?? DEFAULT_KOMI;
    return `백은 덤 약 ${k}집을 받는 설정입니다. 흑은 그만큼 압도적으로 집을 벌어야 합니다.`;
}

function captureTargetSummary(session: LiveGameSession): string {
    const { settings, effectiveCaptureTargets } = session;
    const isTower = session.gameCategory === 'tower';
    const isSurvival = (settings as { isSurvivalMode?: boolean }).isSurvivalMode === true;

    if (effectiveCaptureTargets) {
        const b = effectiveCaptureTargets[Player.Black];
        const w = effectiveCaptureTargets[Player.White];
        if (isTower) {
            return `이번 대국 따내기 목표: 흑 ${b}개 / 백 ${w}개`;
        }
        if (isSurvival) {
            return `살리기 스테이지: 백(상대)의 따내기 목표는 ${w}개입니다. 흑 입장에서 생존·형세를 확인하세요.`;
        }
        return `이번 대국 따내기 목표: 흑 ${b}개 / 백 ${w}개 (입찰 결과가 반영되었습니다).`;
    }
    const base = settings.captureTarget ?? 20;
    return `기본 따내기 목표는 ${base}개입니다. 입찰이 끝나면 흑·백 각각의 목표가 확정됩니다.`;
}

function environmentSection(session: LiveGameSession): MatchPlayGuideSection | null {
    const category = session.gameCategory as string | undefined;
    const items = pickStrings([
        category === 'tower'
            ? '도전의 탑: 미사일·히든·스캔 등 아이템은 대기실 가방 보유 개수를 사용합니다.'
            : null,
        category === 'guildwar'
            ? '길드 전쟁: 보드·모드 조건에 맞춰 집중하고, 길드 규칙에 따른 보상·기록을 확인하세요.'
            : null,
        session.isSinglePlayer && session.stageId
            ? '싱글 스테이지: 클리어 조건(목표 집·따내기·생존 턴 등)은 스테이지마다 다릅니다. 상단 대국 정보의 수치를 기준으로 하세요.'
            : null,
        session.isAiGame ? 'AI 대국: 상대는 즉시 두는 경우가 많으니, 자신의 시간 관리와 차례 집중이 중요합니다.' : null,
    ]);
    if (items.length === 0) return null;
    return { subtitle: '이번 방(환경) 참고', items };
}

function standardLike(session: LiveGameSession, modeLabel: string): MatchPlayGuide {
    const tl = turnLimitHint(session);
    return {
        title: modeLabel,
        sections: [
            {
                subtitle: '승리 조건',
                items: pickStrings([
                    '양측이 연달아 패스해 대국이 끝나면, 집(영토)과 따낸 돌·덤을 합산해 집이 더 많은 쪽이 승리합니다.',
                    '상대가 기권하거나 시간(·초읽기)을 모두 쓰면 그 시점에 승패가 납니다.',
                ]),
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: pickStrings([
                    komiLine(session),
                    '확실한 집과 잠재적 집을 구분하고, 약한 그룹을 먼저 살리거나 버릴지 판단합니다.',
                    tl ? '턴 제한이 있으므로, 중반까지 우세를 만드는 수를 우선합니다.' : null,
                ]),
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: pickStrings([
                    '덤을 잊고 흑이 집 차이를 과소평가하기 쉽습니다.',
                    '불리한 교환·과한 따내기 집착으로 오히려 집이 줄어들 수 있습니다.',
                    tl,
                    '시간이 촉박하면 착각수가 나오기 쉬우니, 남은 시간을 가끔 확인하세요.',
                ]),
            },
            {
                subtitle: '이번 시합 팁',
                items: pickStrings([
                    '우세할수록 단순한 정석 수로 상대 실수를 유도하고, 열세면 복잡한 전투보다 집을 확정 짓는 쪽을 검토하세요.',
                    '끝내기 직전에는 작은 손해가 승패를 가릅니다. 읽기 어려우면 패스·계가 타이밍을 함께 생각하세요.',
                ]),
            },
        ],
    };
}

function captureGuide(session: LiveGameSession): MatchPlayGuide {
    const tl = turnLimitHint(session);
    const targetLine = captureTargetSummary(session);
    return {
        title: '따내기 바둑',
        sections: [
            {
                subtitle: '승리 조건',
                items: pickStrings([
                    '자신의 따내기 목표 개수만큼 상대 돌을 먼저 따내면 즉시 승리합니다(집 계산 없음).',
                    targetLine,
                ]),
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: pickStrings([
                    '입찰으로 흑이 되면 목표가 늘어납니다. 감당 가능한 선에서 입찰·형세를 맞추세요.',
                    '한 번에 많이 따내려다 오히려 약점이 생기지 않도록, 안전한 따내기 순서를 짭니다.',
                    tl ? '턴 제한이 있으면 “언제까지 우세를 만들지”도 같이 설계하세요.' : null,
                ]),
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: pickStrings([
                    '따내기만 보다가 집이 크게 밀리면, 목표 달성 전에 불리한 형세가 될 수 있습니다.',
                    '상대의 약한 그룹과 자신의 약한 그룹을 동시에 엮으면 한 방에 역전당할 수 있습니다.',
                    tl,
                ]),
            },
            {
                subtitle: '이번 시합 팁',
                items: pickStrings([
                    '목표 점수가 높을수록 “따내기 효율이 좋은 전투”를 골라야 합니다.',
                    '코·접바둑에서 상대가 버티면 따내기가 늦어지니, 초반부터 압박 거점을 잡으세요.',
                ]),
            },
        ],
    };
}

function speedGuide(session: LiveGameSession): MatchPlayGuide {
    const g = standardLike(session, '스피드 바둑');
    g.sections[0].items.unshift('기본적으로는 집이 많은 쪽이 이기며, 종료 시 남은 시간으로 보너스 집이 더해질 수 있습니다.');
    g.sections[2].items.push('시간이 줄어들수록 보너스도 줄어듭니다. 무리한 장고보다 리듬 있는 착수가 유리합니다.');
    g.sections[3].items.push('익숙한 정석을 두어 시간을 아끼고, 난전은 짧게 끊는 것도 전략입니다.');
    return g;
}

function baseGuide(session: LiveGameSession): MatchPlayGuide {
    const g = standardLike(session, '베이스 바둑');
    g.sections[0].items.push('상대 베이스돌을 따내면 추가 보너스 집이 있어, 초반 형세가 크게 흔들릴 수 있습니다.');
    g.sections[1].items.unshift('베이스 배치와 이후 흑백·덤 입찰 결과를 보고, 자신의 역할에 맞는 집·전투 계획을 세웁니다.');
    g.sections[2].items.push('베이스가 겹치거나 애매한 형태면 실수가 나오기 쉬우니, 공개 직후 판을 차분히 다시 읽으세요.');
    return g;
}

function hiddenGuide(session: LiveGameSession): MatchPlayGuide {
    const g = standardLike(session, '히든 바둑');
    const hc = session.settings.hiddenStoneCount ?? 0;
    const sc = session.settings.scanCount ?? 0;
    g.sections[0].items.push('히든돌을 따내면 보너스 집이 있어, 심리전이 승패에 큰 비중을 둡니다.');
    const hiddenScanLines = pickStrings([
        hc ? `히든은 최대 ${hc}번까지 쓸 수 있습니다. 언제 쓸지(형세·심리)를 정합니다.` : null,
        sc ? `스캔은 ${sc}번까지입니다. 확실한 의심 지점에 쓰는지, 블러핑을 노릴지 선택하세요.` : null,
    ]);
    g.sections[1].items = [
        ...(hiddenScanLines.length > 0
            ? hiddenScanLines
            : ['히든·스캔 횟수는 대국 정보에 표시된 설정을 기준으로 하세요.']),
        ...g.sections[1].items,
    ];
    g.sections[2].items.push('히든 위치가 들통나면 역으로 당할 수 있으니, 너무 욕심내지 마세요.');
    return g;
}

function missileGuide(session: LiveGameSession): MatchPlayGuide {
    const g = standardLike(session, '미사일 바둑');
    const mc = session.settings.missileCount ?? 0;
    g.sections[0].items.push('미사일로 돌을 직선 이동시켜 형세를 바꾸거나 따낼 수 있습니다.');
    g.sections[1].items.unshift(
        mc
            ? `미사일은 ${mc}개입니다. 결정적인 한 방에 쓸지, 수비·연결에 쓸지 미리 그림을 그리세요.`
            : '미사일 개수는 대국 정보에 표시된 설정을 따릅니다.',
    );
    g.sections[2].items.push('미사일 실패 후 빈틈이 생기기 쉬우니, 사용 후 자신의 약점을 바로 점검하세요.');
    return g;
}

function mixGuide(session: LiveGameSession): MatchPlayGuide {
    const mixed = session.settings.mixedModes ?? [];
    const names = mixed.length ? mixed.join(', ') : '설정된 조합';
    const hasCapture = mixed.includes(GameMode.Capture);
    const hasSpeed = mixed.includes(GameMode.Speed);
    const hasBase = mixed.includes(GameMode.Base);
    const hasHidden = mixed.includes(GameMode.Hidden);
    const hasMissile = mixed.includes(GameMode.Missile);

    const win: string[] = [
        `이번 대국은 믹스룰입니다. 조합: ${names}.`,
        hasCapture
            ? '따내기 목표를 먼저 채우면 그 시점에 승리할 수 있습니다(다른 규칙보다 우선하는 경우가 많습니다).'
            : '조합에 따내기가 없으면, 최종적으로는 집으로 승패가 갈리는 흐름입니다.',
    ];
    const effort: string[] = [
        '여러 규칙이 동시에 적용되므로, “지금 턴에 가장 위험한 규칙이 무엇인지”부터 짚습니다.',
    ];
    if (hasSpeed) effort.push('스피드가 섞여 있으면 시간·보너스 집을 함께 봐야 합니다.');
    if (hasBase) effort.push('베이스가 섞여 있으면 초반 보너스 따내기와 입찰 결과를 놓치지 마세요.');
    if (hasHidden) effort.push('히든이 섞여 있으면 스캔 타이밍과 상대의 심리까지 고려하세요.');
    if (hasMissile) effort.push('미사일이 섞여 있으면 한 수에 판이 뒤집힐 수 있어, 사용 전후의 읽기가 중요합니다.');

    const caution: string[] = [
        '한 가지 규칙만 보면 다른 규칙에 당하기 쉽습니다. 매 수마다 “따내기·시간·아이템”을 동시에 점검하세요.',
    ];
    const tl = turnLimitHint(session);
    if (tl) caution.push(tl);

    return {
        title: '믹스룰 바둑',
        sections: [
            { subtitle: '승리 조건', items: win },
            { subtitle: '이번 시합에서 할 일', items: effort },
            { subtitle: '조심할 점 (실패하기 쉬한 것)', items: caution },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '조합이 복잡할수록 단순한 우세(집·안전)를 먼저 확보하고, 특수 규칙은 그 위에서 쓰는 편이 안정적입니다.',
                ],
            },
        ],
    };
}

function diceGuide(session: LiveGameSession): MatchPlayGuide {
    const rounds = session.settings.diceGoRounds ?? 3;
    const odd = session.settings.oddDiceCount ?? 0;
    const even = session.settings.evenDiceCount ?? 0;
    const low = session.settings.lowDiceCount ?? 0;
    const high = session.settings.highDiceCount ?? 0;
    return {
        title: '주사위 바둑',
        sections: [
            {
                subtitle: '승리 조건',
                items: pickStrings([
                    `총 ${rounds}라운드 후 누적 점수가 더 높은 쪽이 승리합니다(동점 시 데스매치 등 규칙이 이어질 수 있습니다).`,
                    '각 라운드에서 백돌을 따낼 때마다 점수를 얻고, 마지막 백돌을 잡은 플레이어는 보너스가 있습니다.',
                ]),
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: pickStrings([
                    '주사위 결과만큼 흑으로 두되, 백의 활로(유효한 빈 점)에만 둘 수 있습니다.',
                    odd || even || low || high
                        ? `특수 주사위: 홀 ${odd}·짝 ${even}·낮은수(1~3) ${low}·높은수(4~6) ${high}개. 상황에 맞게 쓰세요.`
                        : '아이템이 없으면 순수 확률과 판 읽기로 승부합니다.',
                ]),
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: pickStrings([
                    '유효 자리보다 큰 수가 나오면 오버샷으로 턴이 넘어갑니다.',
                    '남은 착수 수와 백의 형태를 동시에 보지 않으면 마지막에 역전당하기 쉽습니다.',
                ]),
            },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '라운드마다 점수가 초기화되지 않으니, 한 라운드를 버리더라도 다음 라운드 설계가 중요합니다.',
                    '마지막 한 점·한 수가 보너스와 순위를 바꿀 수 있으니, 끝머리를 특히 조심하세요.',
                ],
            },
        ],
    };
}

function omokGuide(session: LiveGameSession): MatchPlayGuide {
    const f33 = session.settings.has33Forbidden ? '흑에게 3-3(쌍삼) 금지가 적용됩니다.' : '쌍삼 금지는 꺼져 있습니다.';
    const fOver = session.settings.hasOverlineForbidden ? '장목(6목 이상) 금지가 적용됩니다.' : '장목 금지는 꺼져 있습니다.';
    return {
        title: '오목',
        sections: [
            {
                subtitle: '승리 조건',
                items: ['가로·세로·대각 중 한 줄로 돌 다섯 개를 먼저 연속으로 놓으면 승리합니다.'],
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: pickStrings([
                    f33,
                    fOver,
                    '흑은 공격·금지 규칙의 밸런스를, 백은 막기와 반격 타이밍을 잡습니다.',
                ]),
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: [
                    '금지 수(특히 쌍삼)에 걸리면 즉시 불리해질 수 있습니다.',
                    '한 줄만 보다가 다른 방향의 승리수를 놓치기 쉽습니다.',
                ],
            },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '3목·4목의 “열린/닫힌” 형태를 구분하면 방어 우선순위가 잡힙니다.',
                    '흑은 한 수 한 수 금지를 의식하고, 백은 “막으면 이기는 자리”를 먼저 찾으세요.',
                ],
            },
        ],
    };
}

function ttamokGuide(session: LiveGameSession): MatchPlayGuide {
    const cap = session.settings.captureTarget ?? 10;
    const f33 = session.settings.has33Forbidden ? '쌍삼 금지가 켜져 있습니다.' : '쌍삼 금지가 꺼져 있습니다.';
    return {
        title: '따목',
        sections: [
            {
                subtitle: '승리 조건',
                items: [
                    '다음 중 하나를 먼저 달성하면 승리합니다: (1) 오목 5목 완성 (2) 상대 돌을 따내기 규칙으로 목표 개수 달성.',
                    `이번 설정의 따내기 목표는 약 ${cap}개입니다(대국 정보 수치를 기준으로 하세요).`,
                ],
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: pickStrings([
                    f33,
                    '오목과 따내기 중 어떤 루트가 더 빠른지 매 순간 비교합니다.',
                ]),
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: [
                    '한쪽만 집착하면 다른 쪽에서 먼저 지는 수가 나올 수 있습니다.',
                    '따내기는 양쪽을 막는 순간이 생기는데, 그 타이밍을 놓치면 점수가 크게 갈립니다.',
                ],
            },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '상대가 오목 쪽으로 몰면 따내기로 속도를 내고, 따내기 쪽으로 몰면 오목으로 상쇄를 노려보세요.',
                ],
            },
        ],
    };
}

function thiefGuide(session: LiveGameSession): MatchPlayGuide {
    return {
        title: '도둑과 경찰',
        sections: [
            {
                subtitle: '승리 조건',
                items: [
                    '2라운드에 걸쳐 도둑·경찰을 번갈아 맡은 뒤, 역할별 점수 합이 더 높은 쪽이 승리합니다(동점 시 데스매치 등이 있을 수 있습니다).',
                ],
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: [
                    '도둑: 살아남은 내 돌을 최대한 많이 남기고, 이어 붙이는 확장을 노립니다.',
                    '경찰: 도둑 돌의 활로를 좁혀 잡아먹는 순서를 설계합니다. 경찰은 턴당 주사위 2개를 사용합니다.',
                    '놀이 기능: 높은 수(3~6) 주사위·1방지(2~5) 주사위 아이템은 대국 설정 개수만큼 굴림 단계에서 사용할 수 있습니다.',
                ],
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: [
                    '도둑은 끊기면 순식간에 잡히기 쉽습니다.',
                    '경찰은 활로만 보면 도둑의 연결·우회를 놓칠 수 있습니다.',
                ],
            },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '한 라운드 점수가 크게 갈리면 다음 역할에서 역전 계획을 세우는 것이 중요합니다.',
                    '주사위 분배(여러 번에 나눠 두기 vs 한곳에 몰기)를 판 크기와 남은 턴에 맞추세요.',
                ],
            },
        ],
    };
}

function alkkagiGuide(session: LiveGameSession): MatchPlayGuide {
    const r = session.settings.alkkagiRounds ?? 1;
    const stones = session.settings.alkkagiStoneCount ?? 0;
    return {
        title: '알까기',
        sections: [
            {
                subtitle: '승리 조건',
                items: pickStrings([
                    r > 1
                        ? `여러 라운드를 거쳐 최종적으로 우위를 가리며, 한 라운드에서는 상대 돌을 모두 판 밖으로 내면 라운드 승리입니다.`
                        : '상대방의 모든 돌을 바둑판 밖으로 쳐내면 승리합니다.',
                    stones ? `라운드당 배치 돌 수는 대략 ${stones}개 수준입니다(대국 정보 기준).` : null,
                ]),
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: [
                    '배치에서 공격 각도와 방어 거리를 동시에 설계합니다.',
                    '게이지 파워를 익혀 의도한 충돌 각·속도를 맞춥니다.',
                ],
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: [
                    '너무 세게 치면 내 돌도 위험해질 수 있습니다.',
                    '슬로우·조준선 아이템을 아끼다 쓸 타이밍을 놓치기 쉽습니다.',
                ],
            },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '한 방에 여러 개를 노리기보다, 확실한 한 개를 먼저 제거하는 쪽이 안정적일 때가 많습니다.',
                    '다음 라운드까지 이어질 배치가 있다면 체력(남은 돌)을 의식하세요.',
                ],
            },
        ],
    };
}

function curlingGuide(session: LiveGameSession): MatchPlayGuide {
    const r = session.settings.curlingRounds ?? 3;
    const stones = session.settings.curlingStoneCount ?? 0;
    return {
        title: '바둑 컬링',
        sections: [
            {
                subtitle: '승리 조건',
                items: pickStrings([
                    `총 ${r}라운드 누적 점수가 더 높은 쪽이 승리합니다.`,
                    stones ? `라운드당 스톤 수는 대국 정보(${stones}개 등)를 기준으로 하세요.` : null,
                ]),
            },
            {
                subtitle: '이번 시합에서 할 일',
                items: [
                    '하우스 안 점수(중앙이 고득점)와 넉아웃 보너스를 동시에 봅니다.',
                    '각 스톤을 공격·방어·밀어내기 중 무엇에 쓸지 라운드 초반에 정합니다.',
                ],
            },
            {
                subtitle: '조심할 점 (실패하기 쉬한 것)',
                items: [
                    '힘 조절 실패로 하우스를 빗나가면 라운드가 크게 기울 수 있습니다.',
                    '동점 시 승부치기가 길어질 수 있으니, 마지막 라운드까지 여력을 남겨 두세요.',
                ],
            },
            {
                subtitle: '이번 시합 팁',
                items: [
                    '조준선·슬로우는 결정적 한 샷에 쓰는 것이 효율적인 경우가 많습니다.',
                    '상대 고득점 스톤을 밀어내는 것만으로도 라운드 판도가 바뀝니다.',
                ],
            },
        ],
    };
}

export function buildMatchPlayGuide(session: LiveGameSession): MatchPlayGuide {
    const { mode } = session;

    let guide: MatchPlayGuide;
    switch (mode) {
        case GameMode.Standard:
            guide = standardLike(session, '클래식 바둑');
            break;
        case GameMode.Capture:
            guide = captureGuide(session);
            break;
        case GameMode.Speed:
            guide = speedGuide(session);
            break;
        case GameMode.Base:
            guide = baseGuide(session);
            break;
        case GameMode.Hidden:
            guide = hiddenGuide(session);
            break;
        case GameMode.Missile:
            guide = missileGuide(session);
            break;
        case GameMode.Mix:
            guide = mixGuide(session);
            break;
        case GameMode.Dice:
            guide = diceGuide(session);
            break;
        case GameMode.Omok:
            guide = omokGuide(session);
            break;
        case GameMode.Ttamok:
            guide = ttamokGuide(session);
            break;
        case GameMode.Thief:
            guide = thiefGuide(session);
            break;
        case GameMode.Alkkagi:
            guide = alkkagiGuide(session);
            break;
        case GameMode.Curling:
            guide = curlingGuide(session);
            break;
        default:
            guide = {
                title: String(mode),
                sections: [
                    {
                        subtitle: '승리 조건',
                        items: ['이 모드의 승패는 대국 진행 중 안내와 결과 화면을 기준으로 합니다.'],
                    },
                    {
                        subtitle: '이번 시합에서 할 일',
                        items: ['대국 정보에 표시된 규칙을 확인하고, 차례와 제한 시간을 놓치지 마세요.'],
                    },
                    {
                        subtitle: '조심할 점 (실패하기 쉬한 것)',
                        items: ['모드별 특수 규칙을 모르면 중반 이후 손해가 커질 수 있습니다.'],
                    },
                    { subtitle: '이번 시합 팁', items: ['불확실하면 일단 집과 안전한 연결을 우선하세요.'] },
                ],
            };
    }

    const env = environmentSection(session);
    if (env) {
        guide = { ...guide, sections: [...guide.sections, env] };
    }
    return guide;
}
