import React, { useMemo } from 'react';
import { User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import DraggableWindow from './DraggableWindow';

interface MbtiComparisonModalProps {
    opponentUser: User;
    onClose: () => void;
    isTopmost?: boolean;
}

// MBTI별 바둑성향 정의
const MBTI_GO_STYLES: Record<string, {
    style: string;
    strengths: string[];
    weaknesses: string[];
    playStyle: string;
}> = {
    'ISTJ': {
        style: '견실한 실리파',
        strengths: ['정석 준수', '끝내기 정확도', '안정적인 집 짓기'],
        weaknesses: ['변칙 대응', '창의적 수', '대세관'],
        playStyle: '정석과 기본기에 충실하며, 확실한 실리를 추구합니다. 끝내기에서 강한 면모를 보입니다.'
    },
    'ISFJ': {
        style: '방어적 실리파',
        strengths: ['안정적인 집 짓기', '상대 공격 방어', '신중한 판단'],
        weaknesses: ['적극적 공격', '변칙 수', '대세관'],
        playStyle: '안정적인 집 짓기에 집중하며, 상대의 공격을 잘 막아냅니다. 신중하고 조심스러운 기풍입니다.'
    },
    'INFJ': {
        style: '전략적 직관파',
        strengths: ['대세관', '상대 심리 읽기', '장기 전략'],
        weaknesses: ['단기 계산', '실리 추구', '끝내기'],
        playStyle: '큰 그림을 그리며 장기적인 전략을 세웁니다. 상대의 의도를 읽고 대응하는 능력이 뛰어납니다.'
    },
    'INTJ': {
        style: '논리적 전략가',
        strengths: ['전략 수립', '논리적 계산', '장기 계획'],
        weaknesses: ['감각적 수', '임기응변', '상대 심리'],
        playStyle: '체계적인 전략을 세우고 논리적으로 수를 읽습니다. 한번 정한 작전을 끝까지 밀고 나갑니다.'
    },
    'ISTP': {
        style: '실용적 문제해결자',
        strengths: ['문제 해결', '실용적 수', '유연한 대응'],
        weaknesses: ['장기 전략', '끝내기', '안정성'],
        playStyle: '현재 상황에 맞는 최선의 수를 찾아냅니다. 실용적이고 유연한 기풍입니다.'
    },
    'ISFP': {
        style: '감각적 자유인',
        strengths: ['감각적 수', '창의적 발상', '유연한 대응'],
        weaknesses: ['전략 수립', '끝내기', '안정성'],
        playStyle: '감각에 의존하며 자유롭게 두는 기풍입니다. 때로는 예상치 못한 수를 둡니다.'
    },
    'INFP': {
        style: '이상주의적 창의파',
        strengths: ['창의적 수', '변칙 대응', '직관적 판단'],
        weaknesses: ['실리 추구', '끝내기', '안정성'],
        playStyle: '이상적인 바둑을 추구하며 창의적인 수를 선호합니다. 감성적인 판단을 합니다.'
    },
    'INTP': {
        style: '분석적 탐구자',
        strengths: ['논리적 분석', '변칙 수', '이론적 이해'],
        weaknesses: ['실리 추구', '끝내기', '안정성'],
        playStyle: '이론과 논리에 기반하여 수를 분석합니다. 복잡한 수순을 즐기며 탐구합니다.'
    },
    'ESTP': {
        style: '적극적 행동파',
        strengths: ['적극적 공격', '수싸움', '즉흥적 대응'],
        weaknesses: ['장기 전략', '끝내기', '신중함'],
        playStyle: '적극적으로 공격하고 수싸움을 즐깁니다. 즉흥적이고 대담한 수를 둡니다.'
    },
    'ESFP': {
        style: '활발한 감각파',
        strengths: ['감각적 수', '즉흥적 대응', '활발한 기풍'],
        weaknesses: ['장기 전략', '끝내기', '신중함'],
        playStyle: '활발하고 감각적인 수를 선호합니다. 즉흥적으로 판을 이끌어갑니다.'
    },
    'ENFP': {
        style: '열정적 창의파',
        strengths: ['창의적 수', '열정적 공격', '변칙 대응'],
        weaknesses: ['안정성', '끝내기', '신중함'],
        playStyle: '열정적으로 창의적인 수를 둡니다. 변칙적이고 예측하기 어려운 기풍입니다.'
    },
    'ENTP': {
        style: '도전적 논쟁가',
        strengths: ['변칙 수', '논리적 공격', '창의적 발상'],
        weaknesses: ['안정성', '끝내기', '신중함'],
        playStyle: '도전적이고 논리적인 공격을 선호합니다. 변칙적이고 창의적인 수를 즐깁니다.'
    },
    'ESTJ': {
        style: '체계적 실리파',
        strengths: ['체계적 수', '실리 추구', '안정성'],
        weaknesses: ['변칙 대응', '창의적 수', '대세관'],
        playStyle: '체계적이고 계획적으로 실리를 추구합니다. 정석과 기본기에 충실합니다.'
    },
    'ESFJ': {
        style: '협조적 안정파',
        strengths: ['안정적 집 짓기', '협조적 수', '신중함'],
        weaknesses: ['적극적 공격', '변칙 수', '대세관'],
        playStyle: '안정적이고 협조적인 수를 선호합니다. 신중하게 집을 짓는 기풍입니다.'
    },
    'ENFJ': {
        style: '영감적 전략가',
        strengths: ['대세관', '상대 심리 읽기', '전략 수립'],
        weaknesses: ['단기 계산', '실리 추구', '끝내기'],
        playStyle: '상대를 이해하고 전략을 세웁니다. 큰 그림을 그리며 영감을 주는 수를 둡니다.'
    },
    'ENTJ': {
        style: '결단력 있는 리더',
        strengths: ['전략 수립', '결단력', '리더십'],
        weaknesses: ['감각적 수', '임기응변', '상대 심리'],
        playStyle: '명확한 전략을 세우고 결단력 있게 밀고 나갑니다. 리더십 있는 기풍입니다.'
    }
};

// MBTI 상성 분석 함수
const analyzeCompatibility = (myMbti: string | null | undefined, opponentMbti: string | null | undefined) => {
    if (!myMbti || !opponentMbti || myMbti.length !== 4 || opponentMbti.length !== 4) {
        return null;
    }

    const myStyle = MBTI_GO_STYLES[myMbti];
    const opponentStyle = MBTI_GO_STYLES[opponentMbti];

    if (!myStyle || !opponentStyle) {
        return null;
    }

    // 차이점 분석
    const differences: string[] = [];
    const similarities: string[] = [];

    // 각 차원별 비교
    if (myMbti[0] !== opponentMbti[0]) {
        differences.push(myMbti[0] === 'E' ? '당신은 적극적, 상대는 신중함' : '당신은 신중, 상대는 적극적');
    } else {
        similarities.push(myMbti[0] === 'E' ? '둘 다 적극적인 기풍' : '둘 다 신중한 기풍');
    }

    if (myMbti[1] !== opponentMbti[1]) {
        differences.push(myMbti[1] === 'S' ? '당신은 실리파, 상대는 직관파' : '당신은 직관파, 상대는 실리파');
    } else {
        similarities.push(myMbti[1] === 'S' ? '둘 다 실리 중심' : '둘 다 직관 중심');
    }

    if (myMbti[2] !== opponentMbti[2]) {
        differences.push(myMbti[2] === 'T' ? '당신은 논리파, 상대는 감성파' : '당신은 감성파, 상대는 논리파');
    } else {
        similarities.push(myMbti[2] === 'T' ? '둘 다 논리적' : '둘 다 감성적');
    }

    if (myMbti[3] !== opponentMbti[3]) {
        differences.push(myMbti[3] === 'J' ? '당신은 계획파, 상대는 유연파' : '당신은 유연파, 상대는 계획파');
    } else {
        similarities.push(myMbti[3] === 'J' ? '둘 다 계획적' : '둘 다 유연함');
    }

    // 조심해야 할 부분
    const warnings: string[] = [];
    if (opponentMbti[0] === 'E') {
        warnings.push('상대는 적극적인 공격을 선호합니다. 수싸움에 휘말리지 않도록 주의하세요.');
    }
    if (opponentMbti[1] === 'N') {
        warnings.push('상대는 창의적이고 변칙적인 수를 둡니다. 예상치 못한 수에 대비하세요.');
    }
    if (opponentMbti[2] === 'T') {
        warnings.push('상대는 논리적이고 계산이 정확합니다. 함정에 빠지지 않도록 신중하게 두세요.');
    }
    if (opponentMbti[3] === 'J') {
        warnings.push('상대는 계획적이고 끝내기에 강합니다. 장기전으로 끌고 가는 것을 피하세요.');
    }

    // 공략 방법
    const strategies: string[] = [];
    if (opponentMbti[0] === 'I') {
        strategies.push('상대는 신중한 기풍입니다. 적극적으로 공격하여 판을 복잡하게 만드세요.');
    }
    if (opponentMbti[1] === 'S') {
        strategies.push('상대는 실리 중심입니다. 변칙적인 수로 대세를 잡으세요.');
    }
    if (opponentMbti[2] === 'F') {
        strategies.push('상대는 감성적입니다. 논리적인 수로 압박하세요.');
    }
    if (opponentMbti[3] === 'P') {
        strategies.push('상대는 유연한 기풍입니다. 계획적으로 끝내기까지 끌고 가세요.');
    }

    // 상성 점수 계산 (간단한 알고리즘)
    let compatibilityScore = 50; // 기본 50점
    const sameCount = [0, 1, 2, 3].filter(i => myMbti[i] === opponentMbti[i]).length;
    compatibilityScore += sameCount * 10; // 같은 차원당 +10점
    compatibilityScore -= (4 - sameCount) * 5; // 다른 차원당 -5점

    // 특정 조합 보너스/페널티
    if (myMbti[0] === 'E' && opponentMbti[0] === 'I') {
        compatibilityScore += 5; // E vs I는 상호 보완적
    }
    if (myMbti[1] === 'S' && opponentMbti[1] === 'N') {
        compatibilityScore -= 10; // S vs N은 상극
    }
    if (myMbti[2] === 'T' && opponentMbti[2] === 'F') {
        compatibilityScore += 5; // T vs F는 상호 보완적
    }
    if (myMbti[3] === 'J' && opponentMbti[3] === 'P') {
        compatibilityScore += 5; // J vs P는 상호 보완적
    }

    compatibilityScore = Math.max(0, Math.min(100, compatibilityScore));

    let compatibilityLevel: 'very-good' | 'good' | 'neutral' | 'bad' | 'very-bad';
    let compatibilityText: string;
    if (compatibilityScore >= 80) {
        compatibilityLevel = 'very-good';
        compatibilityText = '매우 좋은 상성';
    } else if (compatibilityScore >= 60) {
        compatibilityLevel = 'good';
        compatibilityText = '좋은 상성';
    } else if (compatibilityScore >= 40) {
        compatibilityLevel = 'neutral';
        compatibilityText = '보통 상성';
    } else if (compatibilityScore >= 20) {
        compatibilityLevel = 'bad';
        compatibilityText = '나쁜 상성';
    } else {
        compatibilityLevel = 'very-bad';
        compatibilityText = '매우 나쁜 상성';
    }

    return {
        myStyle,
        opponentStyle,
        differences,
        similarities,
        warnings,
        strategies,
        compatibilityScore,
        compatibilityLevel,
        compatibilityText
    };
};

const compatibilityAccent = {
    'very-good': {
        score: 'text-emerald-300',
        label: 'text-emerald-200/90',
        ring: 'ring-emerald-500/35',
        glow: 'from-emerald-500/12 via-transparent to-transparent'
    },
    good: {
        score: 'text-teal-300',
        label: 'text-teal-200/90',
        ring: 'ring-teal-500/30',
        glow: 'from-teal-500/10 via-transparent to-transparent'
    },
    neutral: {
        score: 'text-amber-200',
        label: 'text-amber-100/85',
        ring: 'ring-amber-400/25',
        glow: 'from-amber-500/10 via-transparent to-transparent'
    },
    bad: {
        score: 'text-orange-300',
        label: 'text-orange-200/90',
        ring: 'ring-orange-500/30',
        glow: 'from-orange-500/10 via-transparent to-transparent'
    },
    'very-bad': {
        score: 'text-rose-300',
        label: 'text-rose-200/90',
        ring: 'ring-rose-500/35',
        glow: 'from-rose-500/12 via-transparent to-transparent'
    }
} as const;

type CompatibilityLevelKey = keyof typeof compatibilityAccent;

const GoStyleStrengthWeaknessGrid: React.FC<{
    strengths: string[];
    weaknesses: string[];
    title?: string;
}> = ({ strengths, weaknesses, title = '상대 바둑 성향' }) => (
    <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-slate-900/55 to-slate-950/70 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[420px]:gap-4">
            <div className="min-w-0 rounded-xl border border-emerald-500/15 bg-emerald-950/25 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">강점</p>
                <ul className="space-y-1.5">
                    {strengths.map((s, i) => (
                        <li key={i} className="flex gap-2 text-[13px] leading-snug text-slate-200/95">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
                            <span>{s}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="min-w-0 rounded-xl border border-rose-500/15 bg-rose-950/20 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300/90">약점</p>
                <ul className="space-y-1.5">
                    {weaknesses.map((w, i) => (
                        <li key={i} className="flex gap-2 text-[13px] leading-snug text-slate-200/95">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/75" aria-hidden />
                            <span>{w}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </div>
);

const MbtiComparisonModal: React.FC<MbtiComparisonModalProps> = ({ opponentUser, onClose, isTopmost }) => {
    const { currentUserWithStatus } = useAppContext();

    const analysis = useMemo(() => {
        return analyzeCompatibility(currentUserWithStatus?.mbti, opponentUser.mbti);
    }, [currentUserWithStatus?.mbti, opponentUser.mbti]);

    // 상대만 MBTI가 있는 경우: 상대 분석 힌트만 표시 (상대할 때 참고용)
    if (opponentUser.mbti && opponentUser.mbti.length === 4 && !currentUserWithStatus?.mbti) {
        const opponentStyle = MBTI_GO_STYLES[opponentUser.mbti];
        if (opponentStyle) {
            return (
                <DraggableWindow title="상대 분석" onClose={onClose} windowId="mbti-comparison" initialWidth={620} initialHeight={480} isTopmost={isTopmost}>
                    <div className="space-y-4 p-4">
                        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-zinc-950/95 p-4 shadow-lg ring-1 ring-white/[0.04]">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(244,63,94,0.12),transparent)]" />
                            <div className="relative flex flex-wrap items-center gap-3 min-[480px]:flex-nowrap min-[480px]:justify-between">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/25 to-rose-950/40 text-lg font-bold tracking-tight text-rose-100 ring-1 ring-rose-400/25">
                                        {opponentUser.mbti}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">상대 MBTI</p>
                                        <p className="truncate text-base font-semibold tracking-tight text-slate-100">{opponentStyle.style}</p>
                                    </div>
                                </div>
                                <div className="hidden h-10 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent min-[480px]:block" aria-hidden />
                                <div className="w-full min-[480px]:w-auto min-[480px]:max-w-[52%] min-[480px]:flex-1">
                                    <p className="text-[11px] leading-relaxed text-slate-400/95">{opponentStyle.playStyle}</p>
                                </div>
                            </div>
                        </div>

                        <GoStyleStrengthWeaknessGrid strengths={opponentStyle.strengths} weaknesses={opponentStyle.weaknesses} title="상대할 때 참고 · 바둑 성향" />

                        <p className="text-center text-[11px] leading-relaxed text-slate-500">나의 MBTI를 설정하면 상대와의 상성 점수·비교 분석을 함께 볼 수 있습니다.</p>
                        <div className="flex justify-center pt-0.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border border-white/10 bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-white/[0.1] hover:border-white/15 active:scale-[0.99]"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </DraggableWindow>
            );
        }
    }

    if (!currentUserWithStatus?.mbti || !opponentUser.mbti) {
        return (
            <DraggableWindow title="MBTI 비교" onClose={onClose} windowId="mbti-comparison" initialWidth={500} initialHeight={300} isTopmost={isTopmost}>
                <div className="p-4 text-center">
                    <p className="text-gray-300 mb-4">
                        {!currentUserWithStatus?.mbti && !opponentUser.mbti
                            ? '양쪽 모두 MBTI가 설정되지 않았습니다.'
                            : !opponentUser.mbti
                            ? '상대방의 MBTI가 설정되지 않았습니다.'
                            : 'MBTI 정보를 불러올 수 없습니다.'}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
                    >
                        확인
                    </button>
                </div>
            </DraggableWindow>
        );
    }

    if (!analysis) {
        return (
            <DraggableWindow title="MBTI 비교" onClose={onClose} windowId="mbti-comparison" initialWidth={500} initialHeight={300} isTopmost={isTopmost}>
                <div className="p-4 text-center">
                    <p className="text-gray-300 mb-4">MBTI 정보를 분석할 수 없습니다.</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
                    >
                        확인
                    </button>
                </div>
            </DraggableWindow>
        );
    }

    const accent = compatibilityAccent[analysis.compatibilityLevel as CompatibilityLevelKey];

    return (
        <DraggableWindow title="MBTI 바둑성향 비교" onClose={onClose} windowId="mbti-comparison" initialWidth={720} initialHeight={720} isTopmost={isTopmost}>
            <div className="max-h-[min(720px,78vh)] space-y-4 overflow-y-auto p-4 [scrollbar-gutter:stable]">
                {/* 상성 점수 + 나/상대 MBTI — 한 줄 레이아웃 */}
                <div
                    className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-slate-900/85 via-slate-900/55 to-zinc-950/95 p-1 shadow-lg ring-1 ring-inset ${accent.ring}`}
                >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glow}`} />
                    <div className="relative flex flex-col divide-y divide-white/[0.06] min-[560px]:flex-row min-[560px]:divide-x min-[560px]:divide-y-0">
                        <div className="flex shrink-0 flex-col items-center justify-center px-3 py-3.5 min-[560px]:w-[132px] min-[560px]:py-4">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">상성</span>
                            <span className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${accent.score}`}>{analysis.compatibilityScore}</span>
                            <span className="text-[10px] text-slate-500">점</span>
                            <span className={`mt-1.5 text-center text-[11px] font-medium leading-tight ${accent.label}`}>{analysis.compatibilityText}</span>
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-3 py-3 min-[560px]:flex-row min-[560px]:items-stretch min-[560px]:gap-0 min-[560px]:px-0 min-[560px]:py-0">
                            <div className="flex min-w-0 flex-1 flex-col justify-center border-white/[0.06] px-2 py-2 min-[560px]:border-r min-[560px]:px-4 min-[560px]:py-3.5">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">나</span>
                                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                                    <span className="rounded-lg bg-gradient-to-br from-sky-500/20 to-indigo-950/40 px-2.5 py-0.5 text-xl font-bold tabular-nums tracking-tight text-sky-100 ring-1 ring-sky-400/20">
                                        {currentUserWithStatus.mbti}
                                    </span>
                                    <span className="text-sm font-medium text-slate-200/95">{analysis.myStyle.style}</span>
                                </div>
                                <p className="mt-2 text-[11px] leading-relaxed text-slate-400/95">{analysis.myStyle.playStyle}</p>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-2 min-[560px]:px-4 min-[560px]:py-3.5">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">상대</span>
                                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                                    <span className="rounded-lg bg-gradient-to-br from-rose-500/22 to-rose-950/35 px-2.5 py-0.5 text-xl font-bold tabular-nums tracking-tight text-rose-50 ring-1 ring-rose-400/22">
                                        {opponentUser.mbti}
                                    </span>
                                    <span className="text-sm font-medium text-slate-200/95">{analysis.opponentStyle.style}</span>
                                </div>
                                <p className="mt-2 text-[11px] leading-relaxed text-slate-400/95">{analysis.opponentStyle.playStyle}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <GoStyleStrengthWeaknessGrid strengths={analysis.opponentStyle.strengths} weaknesses={analysis.opponentStyle.weaknesses} />

                {analysis.warnings.length > 0 && (
                    <div className="rounded-2xl border border-rose-500/18 bg-rose-950/18 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-sm sm:p-4">
                        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200/90">조심할 포인트</h3>
                        <ul className="space-y-2">
                            {analysis.warnings.map((warning, idx) => (
                                <li key={idx} className="flex gap-2.5 text-[13px] leading-snug text-slate-200/95">
                                    <span className="mt-0.5 shrink-0 font-mono text-[11px] text-rose-400/80">—</span>
                                    <span>{warning}</span>
                                </li>
                            ))}
                        </ul>
                        {analysis.opponentStyle.strengths.length > 0 && (
                            <div className="mt-3 border-t border-white/[0.06] pt-3">
                                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">상대 강점</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {analysis.opponentStyle.strengths.map((strength, idx) => (
                                        <span
                                            key={idx}
                                            className="rounded-lg border border-rose-500/15 bg-rose-950/30 px-2 py-0.5 text-[11px] font-medium text-rose-100/90"
                                        >
                                            {strength}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {analysis.strategies.length > 0 && (
                    <div className="rounded-2xl border border-sky-500/18 bg-sky-950/15 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-sm sm:p-4">
                        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/90">공략 작전</h3>
                        <ul className="space-y-2">
                            {analysis.strategies.map((strategy, idx) => (
                                <li key={idx} className="flex gap-2.5 text-[13px] leading-snug text-slate-200/95">
                                    <span className="mt-0.5 shrink-0 font-mono text-[11px] text-sky-400/85">—</span>
                                    <span>{strategy}</span>
                                </li>
                            ))}
                        </ul>
                        {analysis.opponentStyle.weaknesses.length > 0 && (
                            <div className="mt-3 border-t border-white/[0.06] pt-3">
                                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">활용할 약점</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {analysis.opponentStyle.weaknesses.map((weakness, idx) => (
                                        <span
                                            key={idx}
                                            className="rounded-lg border border-sky-500/15 bg-sky-950/30 px-2 py-0.5 text-[11px] font-medium text-sky-100/90"
                                        >
                                            {weakness}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                    {analysis.differences.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/15 bg-amber-950/12 p-3.5 backdrop-blur-sm">
                            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/85">차이</h3>
                            <ul className="space-y-1.5">
                                {analysis.differences.map((diff, idx) => (
                                    <li key={idx} className="text-[12px] leading-snug text-slate-300/95">
                                        {diff}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {analysis.similarities.length > 0 && (
                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-950/12 p-3.5 backdrop-blur-sm">
                            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/85">공통</h3>
                            <ul className="space-y-1.5">
                                {analysis.similarities.map((sim, idx) => (
                                    <li key={idx} className="text-[12px] leading-snug text-slate-300/95">
                                        {sim}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default MbtiComparisonModal;

