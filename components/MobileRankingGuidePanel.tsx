import React from 'react';
import { replaceAppHash } from '../utils/appUtils.js';

export type MobileRankingGuideVariant = 'game-combat' | 'game-manner' | 'baduk-strategic' | 'baduk-playful';

type ListSection = {
    title: string;
    ordered: boolean;
    items: string[];
};

type TextSection = {
    title: string;
    body: string;
};

type GuideSections = {
    how: ListSection | TextSection;
    /** 없으면 두 번째 블록(점수가 오르는 곳) 숨김 */
    where?: ListSection | TextSection | null;
    cta: string;
    hash: string;
};

const GUIDE: Record<MobileRankingGuideVariant, GuideSections> = {
    'game-combat': {
        how: {
            title: '점수 올리는 방법',
            ordered: true,
            items: ['높은 등급의 장비 착용', '장비 강화 및 제련', '레벨업 후 능력치 분배'],
        },
        where: null,
        cta: '경기장으로',
        hash: '#/profile/arena',
    },
    'game-manner': {
        how: {
            title: '점수 올리는 방법',
            ordered: false,
            items: ['전략바둑, 놀이바둑 PVP 경기장 → 매너 액션 버튼 사용'],
        },
        where: {
            title: '점수가 오르는 곳',
            ordered: false,
            items: ['경기장 → 전략바둑 또는 놀이바둑 PVP 경기장'],
        },
        cta: '경기장으로',
        hash: '#/profile/arena',
    },
    'baduk-strategic': {
        how: {
            title: '점수 올리는 방법',
            body: '전략바둑 랭킹전(PVP) 승패로 1200 기준 누적 점수가 변합니다. 같은 모드 10판 이상이면 순위에 반영되며, 강한 상대를 이기면 더 많이 오릅니다.',
        },
        where: {
            title: '점수가 오르는 곳',
            body: '경기장 → 전략바둑 → 대기실에서 랭킹전 매칭을 이용하세요.',
        },
        cta: '전략 대기실',
        hash: '#/waiting/strategic',
    },
    'baduk-playful': {
        how: {
            title: '점수 올리는 방법',
            body: '놀이바둑 랭킹전(PVP) 승패로 1200 기준 누적 점수가 변합니다. 같은 모드 10판 이상이면 순위에 반영되며, 강한 상대를 이기면 더 많이 오릅니다.',
        },
        where: {
            title: '점수가 오르는 곳',
            body: '경기장 → 놀이바둑 → 대기실에서 랭킹전 매칭을 이용하세요.',
        },
        cta: '놀이 대기실',
        hash: '#/waiting/playful',
    },
};

function isListSection(s: ListSection | TextSection): s is ListSection {
    return 'items' in s && 'ordered' in s;
}

function renderSection(
    section: ListSection | TextSection,
    accent: 'amber' | 'sky',
    icon: string
) {
    const accentWrap =
        accent === 'amber'
            ? 'border-amber-500/25 bg-amber-950/50 text-amber-200/90'
            : 'border-sky-500/25 bg-sky-950/40 text-sky-200/90';

    return (
        <div className="flex gap-2.5">
            <span
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${accentWrap}`}
            >
                {icon}
            </span>
            <div className="min-w-0">
                <p className="mb-1 text-sm font-semibold text-zinc-200">{section.title}</p>
                {isListSection(section) ? (
                    section.ordered ? (
                        <ol className="list-inside list-decimal space-y-1 text-sm leading-snug text-zinc-300">
                            {section.items.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ol>
                    ) : (
                        <ul className="list-inside list-disc space-y-1 text-sm leading-snug text-zinc-300">
                            {section.items.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ul>
                    )
                ) : (
                    <p className="text-sm leading-snug text-zinc-300">{section.body}</p>
                )}
            </div>
        </div>
    );
}

const MobileRankingGuidePanel: React.FC<{ variant: MobileRankingGuideVariant }> = ({ variant }) => {
    const g = GUIDE[variant];

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950/90 to-neutral-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div
                className="pointer-events-none absolute inset-0 rounded-lg opacity-90"
                style={{
                    background:
                        'radial-gradient(120% 80% at 0% 0%, rgba(245, 158, 11, 0.14), transparent 50%), radial-gradient(100% 60% at 100% 100%, rgba(59, 130, 246, 0.08), transparent 45%)',
                }}
            />
            <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-2.5">
                <div className="flex items-center gap-2">
                    <div className="h-0.5 w-10 shrink-0 rounded-full bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600/80" />
                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/90">Score guide</span>
                    <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-amber-500/35 to-transparent" />
                </div>

                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                    {renderSection(g.how, 'amber', '↑')}
                    {g.where != null && renderSection(g.where, 'sky', '◎')}
                </div>

                <button
                    type="button"
                    onClick={() => replaceAppHash(g.hash)}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-gradient-to-r from-amber-900/50 via-amber-950/60 to-zinc-950/80 px-3 py-2 text-center text-sm font-semibold text-amber-100 shadow-sm transition hover:border-amber-400/50 hover:from-amber-800/55 hover:text-white active:scale-[0.98]"
                >
                    {g.cta}
                </button>
            </div>
        </div>
    );
};

export default MobileRankingGuidePanel;
