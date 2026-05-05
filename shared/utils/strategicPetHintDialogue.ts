import type { PairPetKataPhase } from '../constants/pairArena.js';

const COMMON_LINES: readonly string[] = [
    '내 생각에는 여기가 좋은 자리 같아.',
    '차분히 보면 이쪽이 괜찮아 보여.',
    '여기를 두면 흐름이 자연스러울 것 같아.',
    '나라면 이 점을 먼저 생각해 볼래.',
    '이 자리, 마음에 드는 느낌이야.',
];

/** `pair-pet-12` 등에서 숫자만 추출 */
function petKindIndexFromTemplateId(templateId: string | null | undefined): number {
    const m = /^pair-pet-(\d+)$/i.exec(String(templateId ?? '').trim());
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : 0;
}

const KIND_LINES: readonly string[][] = [
    // 0: 폴백
    ['음… 이쪽이 차분하게 두기 좋아 보여.', '여기, 한번 짚어 보는 건 어때?'],
    // 1–3: 조금 활발
    [
        '이 점! 기운이 좋아 보여, 한번 봐줄래?',
        '여기 두면 재미있을 것 같아. 부담 없이 가 보자.',
        '내 느낌은 이 자리야. 같이 확인해 보자.',
    ],
    // 4–6: 차분·정중
    [
        '이 자리가 무난하게 좋아 보여. 천천히 검토해 봐도 좋겠어.',
        '차분히 두려면 이 점을 먼저 살보면 어떨까.',
        '여기가 균형이 잘 맞는 것 같아.',
    ],
    // 7+: 부드럽게 격려
    [
        '서두르지 말고, 이 점도 괜찮은 선택인 것 같아.',
        '내가 보기엔 이쪽이 마음이 놓여.',
        '이 자리에서 차근차근 가져가 보자.',
    ],
];

function linesForTemplate(templateId: string | null | undefined): readonly string[] {
    const idx = petKindIndexFromTemplateId(templateId);
    if (idx >= 1 && idx <= 3) return KIND_LINES[1]!;
    if (idx >= 4 && idx <= 6) return KIND_LINES[2]!;
    if (idx >= 7) return KIND_LINES[3]!;
    return KIND_LINES[0]!;
}

function hashPick(seed: string, mod: number): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % Math.max(1, mod);
}

/**
 * 전략바둑 펫 힌트 말풍선 문구 — 공통 풀과 종류별 톤을 섞어 자연스럽게.
 */
export function pickStrategicPetHintLine(params: {
    phase: PairPetKataPhase;
    petTemplateId: string | null | undefined;
    gameId: string;
    moveCount: number;
}): string {
    const { phase, petTemplateId, gameId, moveCount } = params;
    const seed = `${gameId}|${phase}|${moveCount}|${petTemplateId ?? ''}`;
    const useCommon = hashPick(seed + 'c', 10) < 5;
    if (useCommon) {
        return COMMON_LINES[hashPick(seed, COMMON_LINES.length)] ?? COMMON_LINES[0]!;
    }
    const kind = linesForTemplate(petTemplateId);
    return kind[hashPick(seed + 'k', kind.length)] ?? COMMON_LINES[0]!;
}
