import React from 'react';
import {
    getAdventureMonsterPortraitUrl,
    type AdventureMonsterCodexEntry,
} from '../../constants/adventureMonstersCodex.js';
import { useResilientImgSrc } from '../../hooks/useResilientImgSrc.js';

/**
 * 도감/결과용 초상화 — 스프라이트 시트 대신 `*_portrait.webp`(있으면)로 단일 셀 표시.
 * 시트 슬라이스보다 덜 깨지고, 알파 실루엣이 안정적.
 */
export const AdventureMonsterPortrait: React.FC<{
    entry: Pick<AdventureMonsterCodexEntry, 'imageWebp' | 'spriteCols' | 'spriteRows'>;
    className?: string;
    imgClassName?: string;
    /** 발 밑 은은한 무대 하이라이트 (중간 톤 배경에서도 실루엣 분리) */
    showPedestal?: boolean;
}> = ({ entry, className = '', imgClassName = '', showPedestal = true }) => {
    const url = getAdventureMonsterPortraitUrl(entry);
    const { src, onError } = useResilientImgSrc(url);

    return (
        <div className={`relative overflow-hidden ${className}`.trim()}>
            {showPedestal ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[8%] bottom-[6%] z-0 h-[28%] rounded-[100%] opacity-90"
                    style={{
                        background:
                            'radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 42%, transparent 72%)',
                    }}
                />
            ) : null}
            <img
                src={src}
                alt=""
                draggable={false}
                loading="eager"
                decoding="async"
                className={`pointer-events-none absolute left-1/2 top-[46%] z-[1] max-h-[88%] max-w-[88%] -translate-x-1/2 -translate-y-1/2 select-none object-contain ${imgClassName}`.trim()}
                style={{
                    filter:
                        'drop-shadow(0 0 0.5px rgba(0,0,0,0.55)) drop-shadow(0 2px 3px rgba(0,0,0,0.4)) drop-shadow(0 8px 14px rgba(0,0,0,0.35))',
                }}
                onError={onError}
            />
        </div>
    );
};

export default AdventureMonsterPortrait;
