import React from 'react';
import { resolveGuildIconPath } from '../../shared/utils/guildIconPath.js';
import { useResilientImgSrc } from '../../hooks/useResilientImgSrc.js';

export type GuildMarkTone = 'accent' | 'blue' | 'red' | 'plain' | 'none';

interface GuildMarkProps {
  icon?: string | null;
  /** `icon`이 없을 때 사용하는 DB/서버 필드 */
  emblem?: string | null;
  /** 바깥 프레임 한 변(px) — 마크 에셋은 이 칸을 가득 채웁니다(이미 금테가 그려져 있음) */
  size?: number;
  alt?: string;
  className?: string;
  tone?: GuildMarkTone;
  /** accent/blue/red 톤일 때 뒤쪽 은은한 광원 */
  showGlow?: boolean;
}

const TONE_RING: Record<Exclude<GuildMarkTone, 'none'>, string> = {
  accent: 'ring-2 ring-accent/35',
  blue: 'ring-2 ring-blue-400/45',
  red: 'ring-2 ring-red-400/45',
  plain: 'ring-1 ring-white/10',
};

/**
 * 길드 마크 — `size` 고정 칸에 에셋을 cover로 채웁니다.
 * (마크 webp 자체에 금테/부조가 포함되어 있어 이중 메탈 림을 두지 않습니다.)
 */
const GuildMark: React.FC<GuildMarkProps> = ({
  icon,
  emblem,
  size = 40,
  alt = '',
  className = '',
  tone = 'accent',
  showGlow = false,
}) => {
  const remSize = size / 16;
  const resolved = resolveGuildIconPath(icon ?? emblem);
  const { src, onError } = useResilientImgSrc(resolved);

  return (
    <div
      className={`relative shrink-0 ${className}`.trim()}
      style={{ width: `${remSize}rem`, height: `${remSize}rem` }}
    >
      {showGlow && tone !== 'none' ? (
        <div
          className="pointer-events-none absolute -inset-0.5 rounded-xl opacity-80 blur-[5px]"
          style={{
            background:
              tone === 'blue'
                ? 'radial-gradient(circle, rgba(59,130,246,0.45) 0%, transparent 70%)'
                : tone === 'red'
                  ? 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(245,158,11,0.45) 0%, transparent 70%)',
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={`relative z-10 h-full w-full overflow-hidden rounded-xl bg-tertiary shadow-md ${
          tone === 'none' ? '' : TONE_RING[tone]
        }`}
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          decoding="async"
          draggable={false}
          onError={onError}
        />
      </div>
    </div>
  );
};

export default React.memo(GuildMark);
