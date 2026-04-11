export type MbtiAxis = 'EI' | 'SN' | 'TF' | 'JP';

export type MbtiLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

export interface MbtiQuestionOption {
    text: string;
    value: MbtiLetter;
    goStyle: string;
}

export interface MbtiQuestion {
    id: string;
    axis: MbtiAxis;
    question: string;
    options: [MbtiQuestionOption, MbtiQuestionOption];
}

const AXIS_LETTERS: Record<MbtiAxis, [MbtiLetter, MbtiLetter]> = {
    EI: ['E', 'I'],
    SN: ['S', 'N'],
    TF: ['T', 'F'],
    JP: ['J', 'P'],
};

/** 축당 5문항(총 20). 각 축에서 선택이 더 많은 글자로 유형을 정합니다. */
export const MBTI_QUESTIONS: MbtiQuestion[] = [
    // E/I — 에너지·대국 톤
    {
        id: 'EI1',
        axis: 'EI',
        question: '바둑을 둘 때 전체적인 톤은 어느 쪽에 가깝나요?',
        options: [
            {
                text: '적극적으로 싸움을 걸고 수싸움·중앙 대결을 즐기는 편이다',
                value: 'E',
                goStyle: '전투를 이끌고 판을 복잡하게 만드는 공격적인 기풍입니다.',
            },
            {
                text: '조용히 실리를 쌓고 상대의 과열을 피해 안정적으로 가는 편이다',
                value: 'I',
                goStyle: '견실한 집·형세를 쌓으며 도발에 덜 끌리는 신중한 기풍입니다.',
            },
        ],
    },
    {
        id: 'EI2',
        axis: 'EI',
        question: '상대가 거칠게 두어 오면 보통 어떻게 반응하나요?',
        options: [
            {
                text: '받아치거나 맞불을 놓아 템포를 내가 주도하고 싶다',
                value: 'E',
                goStyle: '대응 전투와 템포 주도를 즐기는 외향적 바둑 스타일입니다.',
            },
            {
                text: '잠시 물러서 실리나 두께를 다지며 상대 실수를 기다린다',
                value: 'I',
                goStyle: '흔들리지 않고 실리를 지키는 내향적·인내형 스타일입니다.',
            },
        ],
    },
    {
        id: 'EI3',
        axis: 'EI',
        question: '초반 포석을 생각할 때 더 끌리는 쪽은?',
        options: [
            {
                text: '빠르게 변화를 만들고 이후 수많은 변화를 상정한다',
                value: 'E',
                goStyle: '초반부터 판을 크게 흔드는 역동적인 전개를 선호합니다.',
            },
            {
                text: '확실한 집·정석의 안전한 골격을 먼저 잡고 싶다',
                value: 'I',
                goStyle: '안정적인 골격과 실리 우선의 차분한 전개를 선호합니다.',
            },
        ],
    },
    {
        id: 'EI4',
        axis: 'EI',
        question: '끝내기에 가까워졌을 때 나의 모습에 가까운 것은?',
        options: [
            {
                text: '남은 싸움을 적극적으로 걸어 승부를 크게 본다',
                value: 'E',
                goStyle: '끝내기에서도 공격과 수읽기를 밀어붙이는 편입니다.',
            },
            {
                text: '집수를 정확히 세며 반집 차이를 지키는 데 집중한다',
                value: 'I',
                goStyle: '끝내기에서 침착하게 집수와 형세를 다지는 편입니다.',
            },
        ],
    },
    {
        id: 'EI5',
        axis: 'EI',
        question: '바둑을 둘 때 에너지가 더 잘 맞는 설명은?',
        options: [
            {
                text: '상대와의 긴장감·대결감에서 흥미를 느낀다',
                value: 'E',
                goStyle: '대국의 대결적 요소에서 동기를 얻는 스타일입니다.',
            },
            {
                text: '혼자 깊게 읽고 판을 정리해 나가는 과정이 좋다',
                value: 'I',
                goStyle: '깊은 수읽기와 자기 주도적 판 운용에서 만족을 느낍니다.',
            },
        ],
    },
    // S/N — 정보·수의 스타일
    {
        id: 'SN1',
        axis: 'SN',
        question: '한 수를 고를 때 더 신뢰하는 것은?',
        options: [
            {
                text: '눈에 보이는 집·단수·정석적 이득 같은 확실한 근거',
                value: 'S',
                goStyle: '구체적 실리와 검증 가능한 이득을 우선합니다.',
            },
            {
                text: '아직 형태가 없는 잠재력·세력·몇 수 뒤의 그림',
                value: 'N',
                goStyle: '잠재력과 장기 그림·직관적 형세를 중시합니다.',
            },
        ],
    },
    {
        id: 'SN2',
        axis: 'SN',
        question: '정석과 변칙이 갈릴 때 나는?',
        options: [
            {
                text: '검증된 정석과 실전형 행마를 따르는 편이다',
                value: 'S',
                goStyle: '정석·기본기에 충실한 현실적 행마를 선호합니다.',
            },
            {
                text: '상대나 판에 맞는 신선한 수·변칙을 시도해 보고 싶다',
                value: 'N',
                goStyle: '창의적·변칙적 수로 판을 새롭게 짓는 경향이 있습니다.',
            },
        ],
    },
    {
        id: 'SN3',
        axis: 'SN',
        question: '형세 판단을 할 때 더 편한 방식은?',
        options: [
            {
                text: '각 지역의 집·약점을 하나씩 세며 비교한다',
                value: 'S',
                goStyle: '부분별 집수와 명확한 비교에 강합니다.',
            },
            {
                text: '전체 균형·흐름이 어느 쪽으로 기우는지 한눈에 본다',
                value: 'N',
                goStyle: '전체 흐름과 균형·대세를 한 번에 읽는 데 강합니다.',
            },
        ],
    },
    {
        id: 'SN4',
        axis: 'SN',
        question: '읽기 어려운 복잡한 국면에서?',
        options: [
            {
                text: '확실히 읽히는 국소적 응집·단수부터 정리한다',
                value: 'S',
                goStyle: '복잡함 속에서도 눈에 보이는 확실한 수를 찾습니다.',
            },
            {
                text: '몇 수 앞의 패턴·상상으로 ‘이렇게 풀릴 것’을 본다',
                value: 'N',
                goStyle: '가능성과 패턴을 떠올려 국면을 단순화하려 합니다.',
            },
        ],
    },
    {
        id: 'SN5',
        axis: 'SN',
        question: '공부나 복기할 때 더 흥미로운 것은?',
        options: [
            {
                text: '정석 사전·정확한 형태·실전 정형',
                value: 'S',
                goStyle: '구체적 정석과 실전형 지식 축적을 선호합니다.',
            },
            {
                text: '새로운 아이디어·레퍼런스 없는 수·상상의 전개',
                value: 'N',
                goStyle: '아이디어와 새로운 가능성 탐구를 선호합니다.',
            },
        ],
    },
    // T/F — 판단 기준
    {
        id: 'TF1',
        axis: 'TF',
        question: '착수를 결정할 때 최종 기준에 가까운 것은?',
        options: [
            {
                text: '수읽기·집수·승률에 맞는 논리적으로 최선인가',
                value: 'T',
                goStyle: '논리·계산에 기반한 냉정한 판단을 중시합니다.',
            },
            {
                text: '그 수의 기세·느낌·상대에게 주는 압박이 맞는가',
                value: 'F',
                goStyle: '기세·감·심리적 압박을 함께 고려하는 판단을 합니다.',
            },
        ],
    },
    {
        id: 'TF2',
        axis: 'TF',
        question: '실수로 불리해졌을 때 다음 수는?',
        options: [
            {
                text: '손해를 최소화할 수 있는 차분한 수를 찾는다',
                value: 'T',
                goStyle: '불리해도 손해 최소화와 형세 복구를 논리적으로 택합니다.',
            },
            {
                text: '분위기를 바꿀 과감한 한 수를 떠올리기 쉽다',
                value: 'F',
                goStyle: '감정·기세 전환을 위한 과감한 선택을 할 수 있습니다.',
            },
        ],
    },
    {
        id: 'TF3',
        axis: 'TF',
        question: '상대가 시간을 많이 쓰며 두면?',
        options: [
            {
                text: '나는 내 수읽기와 시간 배분만 정리하면 된다고 생각한다',
                value: 'T',
                goStyle: '상대와 무관하게 자기 계획·시간 운용을 우선합니다.',
            },
            {
                text: '상대의 망설임이 판에 어떤 감정을 남기는지 의식된다',
                value: 'F',
                goStyle: '상대의 리듬·감정적 신호에 영향을 받기 쉽습니다.',
            },
        ],
    },
    {
        id: 'TF4',
        axis: 'TF',
        question: '무승부나 반집 승부를 택해야 할 때?',
        options: [
            {
                text: '숫자와 형세가 말해 주는 현실적인 선택을 고른다',
                value: 'T',
                goStyle: '객관적 형세 판단으로 승부처를 고릅니다.',
            },
            {
                text: '‘이 판은 이렇게 가야 내 바둑답다’는 느낌이 더 크다',
                value: 'F',
                goStyle: '자신의 바둑 철학·감에 따른 선택을 할 수 있습니다.',
            },
        ],
    },
    {
        id: 'TF5',
        axis: 'TF',
        question: '복기할 때 스스로에게 더 자주 하는 질문은?',
        options: [
            {
                text: '계산이 부족했나, 더 좋은 수가 있었나',
                value: 'T',
                goStyle: '논리·계산의 정확성을 기준으로 복기합니다.',
            },
            {
                text: '그 순간 감이나 욕심이 판단을 흔들었나',
                value: 'F',
                goStyle: '감정·욕심·기세가 판단에 미친 영향을 돌아봅니다.',
            },
        ],
    },
    // J/P — 계획·유연성
    {
        id: 'JP1',
        axis: 'JP',
        question: '한 판의 작전은?',
        options: [
            {
                text: '초반에 세운 방향을 중반까지 비교적 유지하려 한다',
                value: 'J',
                goStyle: '초기 계획을 세우고 밀고 나가는 편입니다.',
            },
            {
                text: '중반에 형세를 보고 작전을 바꾸는 일이 잦다',
                value: 'P',
                goStyle: '상황에 따라 전술을 바꾸는 유연함이 있습니다.',
            },
        ],
    },
    {
        id: 'JP2',
        axis: 'JP',
        question: '정해진 목표 집(예: 우상 귀)이 있을 때?',
        options: [
            {
                text: '그 목표를 향해 수순을 맞추어 간다',
                value: 'J',
                goStyle: '목표 지향적·계획적 진행을 선호합니다.',
            },
            {
                text: '더 좋은 기회가 생기면 목표를 바꿔도 괜찮다',
                value: 'P',
                goStyle: '더 나은 기회에 따라 목표를 재조정합니다.',
            },
        ],
    },
    {
        id: 'JP3',
        axis: 'JP',
        question: '시간 제한이 있는 대국에서?',
        options: [
            {
                text: '초반부터 시간 배분표를 대략 정해 둔다',
                value: 'J',
                goStyle: '시간·수순을 계획적으로 쓰려 합니다.',
            },
            {
                text: '읽히는 순간까지 두다가 후반에 몰아쓰기도 한다',
                value: 'P',
                goStyle: '순간 판단과 임기응변으로 시간을 씁니다.',
            },
        ],
    },
    {
        id: 'JP4',
        axis: 'JP',
        question: '상대가 예상 밖의 수를 두어 계획이 깨지면?',
        options: [
            {
                text: '새 계획을 빨리 세우고 그 방향으로 판을 정리한다',
                value: 'J',
                goStyle: '계획이 흔들려도 다시 구조를 잡으려 합니다.',
            },
            {
                text: '당장 떠오르는 수로 국면을 ‘한번 흔들어’ 본다',
                value: 'P',
                goStyle: '즉흥적 대응으로 새 국면을 만드는 편입니다.',
            },
        ],
    },
    {
        id: 'JP5',
        axis: 'JP',
        question: '바둑 스타일을 한 마디로 하면?',
        options: [
            {
                text: '정한 흐름을 밀고 나가는 스타일',
                value: 'J',
                goStyle: '일관된 작전을 끝까지 추구하는 끈기가 있습니다.',
            },
            {
                text: '흐름이 바뀔 때마다 즐기는 스타일',
                value: 'P',
                goStyle: '변화에 적응하며 즉흥적으로 판을 즐깁니다.',
            },
        ],
    },
];

/**
 * 각 축별 답변 개수를 세어 더 많이 고른 글자로 4글자 MBTI를 만듭니다.
 * 동점이면 첫 번째 글자(E, S, T, J)를 사용합니다(축당 홀수 문항이면 동점 없음).
 */
export function calculateMbtiFromAnswers(answers: Record<string, string>, questions: MbtiQuestion[]): string | null {
    const tally: Record<MbtiAxis, Record<string, number>> = {
        EI: { E: 0, I: 0 },
        SN: { S: 0, N: 0 },
        TF: { T: 0, F: 0 },
        JP: { J: 0, P: 0 },
    };
    const expected: Record<MbtiAxis, number> = { EI: 0, SN: 0, TF: 0, JP: 0 };
    for (const q of questions) {
        expected[q.axis]++;
    }
    for (const q of questions) {
        const a = answers[q.id];
        if (!a) return null;
        const [x, y] = AXIS_LETTERS[q.axis];
        if (a !== x && a !== y) return null;
        tally[q.axis][a]++;
    }
    for (const axis of Object.keys(expected) as MbtiAxis[]) {
        const [x, y] = AXIS_LETTERS[axis];
        if (tally[axis][x] + tally[axis][y] !== expected[axis]) return null;
    }
    const pick = (axis: MbtiAxis): MbtiLetter => {
        const [x, y] = AXIS_LETTERS[axis];
        if (tally[axis][x] > tally[axis][y]) return x;
        if (tally[axis][y] > tally[axis][x]) return y;
        return x;
    };
    return `${pick('EI')}${pick('SN')}${pick('TF')}${pick('JP')}`;
}
