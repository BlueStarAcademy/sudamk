import React from 'react';
import GoGameArena from './GoGameArena.js';

type Props = React.ComponentProps<typeof GoGameArena>;

/**
 * 모험 몬스터 대전 전용 래퍼 — 일반 대기실 AI 경기장 UI와 섞이지 않도록 분리.
 * (실제 바둑 패널은 GoGameArena 재사용, 배경만 스테이지 맵 이미지)
 */
const AdventureArena: React.FC<Props> = (props) => {
    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden" data-arena="adventure">
            {/* 모험 맵 배경은 Game.tsx 루트 컨테이너에서만 단일 렌더링 */}
            <div className="relative z-[1] h-full min-h-0">
                <GoGameArena {...props} />
            </div>
        </div>
    );
};

export default AdventureArena;
