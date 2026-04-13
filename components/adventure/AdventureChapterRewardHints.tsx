import React from 'react';
import { getAdventureChapterRewardPreview } from '../../shared/utils/adventureChapterRewardPreview.js';
import type { AdventureStageId } from '../../constants/adventureConstants.js';

type Props = {
    stageId: AdventureStageId;
    /** 로비 카드 등 좁은 영역 */
    compact?: boolean;
    className?: string;
};

const AdventureChapterRewardHints: React.FC<Props> = ({ stageId, compact, className }) => {
    const p = getAdventureChapterRewardPreview(stageId);
    const bodyCls = compact
        ? 'mt-1 space-y-0.5 text-[9px] leading-snug text-zinc-400'
        : 'mt-1.5 space-y-1 text-[10px] leading-snug text-zinc-300 sm:text-xs';
    const headCls = compact
        ? 'text-[9px] font-bold uppercase tracking-wide text-amber-200/90'
        : 'text-[10px] font-bold uppercase tracking-wide text-amber-200/95 sm:text-xs';

    return (
        <div className={className} role="region" aria-label="이 챕터 승리 보상 안내">
            <p className={headCls}>승리 보상(참고)</p>
            <ul className={bodyCls}>
                <li>
                    <span className="text-zinc-500">골드(일반)</span>{' '}
                    <span className="font-mono font-semibold tabular-nums text-zinc-200">
                        {p.goldNormalRange.min.toLocaleString()}~{p.goldNormalRange.max.toLocaleString()}
                    </span>
                    <span className="text-zinc-600"> · 이해도·효과·대국 길이에 따라 증가</span>
                </li>
                {p.goldBoss19Range ? (
                    <li>
                        <span className="text-zinc-500">골드(19줄 보스)</span>{' '}
                        <span className="font-mono font-semibold tabular-nums text-amber-200/90">
                            {p.goldBoss19Range.min.toLocaleString()}~{p.goldBoss19Range.max.toLocaleString()}
                        </span>
                    </li>
                ) : null}
                <li>
                    <span className="text-zinc-500">장비 등급</span>{' '}
                    <span className="font-semibold text-violet-200/95">{p.equipmentGradeRange}</span>
                </li>
                <li>
                    <span className="text-zinc-500">재료 등급</span>{' '}
                    <span className="font-semibold text-emerald-200/90">{p.materialGradeRange}</span>
                </li>
                <li>
                    <span className="text-zinc-500">강화석(일반 몬스터 1회)</span>{' '}
                    <span className="text-zinc-300">{p.materialQtyLines.join(' · ')}</span>
                </li>
                {!compact ? (
                    <li className="text-zinc-600">19줄 보스는 강화석 개수·골드가 더 높을 수 있습니다.</li>
                ) : null}
            </ul>
        </div>
    );
};

export default AdventureChapterRewardHints;
