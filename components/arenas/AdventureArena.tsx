import React from 'react';
import GoGameArena from './GoGameArena.js';
import { getAdventureMapWebpPath } from '../../constants/adventureConstants.js';

type Props = React.ComponentProps<typeof GoGameArena>;

/**
 * 모험 몬스터 대전 전용 래퍼 — 일반 대기실 AI 경기장 UI와 섞이지 않도록 분리.
 * (실제 바둑 패널은 GoGameArena 재사용, 배경만 스테이지 맵 이미지)
 */
const AdventureArena: React.FC<Props> = (props) => {
    const stageId = props.session.adventureStageId;
    const mapUrl = getAdventureMapWebpPath(stageId ?? undefined);

    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden" data-arena="adventure">
            {mapUrl ? (
                <>
                    <div
                        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.38]"
                        style={{ backgroundImage: `url(${mapUrl})` }}
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-zinc-950/72 to-black/88"
                        aria-hidden
                    />
                </>
            ) : null}
            <div className="relative z-[1] h-full min-h-0">
                <GoGameArena {...props} />
            </div>
        </div>
    );
};

export default AdventureArena;
