import React from 'react';
import { useResilientImgSrc } from '../../hooks/useResilientImgSrc.js';

export type GuildBossPortraitVariant = 'thumbnail' | 'hero';

interface GuildBossPortraitProps {
  image?: string | null;
  alt?: string;
  /** 바깥 래퍼(프레임) 클래스 — 부모에서 영역 크기를 지정할 때 */
  className?: string;
  /**
   * 실제 `<img>` 크기 계약.
   * hero는 원본처럼 in-flow로 두어 이미지가 높이를 만들거나 `h-full`을 채웁니다.
   */
  imgClassName?: string;
  /**
   * thumbnail — `size` 고정 프레임 + 본문 0.82
   * hero — in-flow 이미지 + 그림자/받침대 (보스 교체에도 비율·중앙 정렬 유지)
   */
  variant?: GuildBossPortraitVariant;
  /** thumbnail일 때 바깥 한 변(px). 기본 80 */
  size?: number;
  showPedestal?: boolean;
  roundedClassName?: string;
}

const FACE_RATIO = 0.82;

/**
 * 길드 보스 초상.
 * hero는 absolute 배치를 쓰지 않습니다 — 예전에 이미지가 사라진 원인이었습니다.
 */
const GuildBossPortrait: React.FC<GuildBossPortraitProps> = ({
  image,
  alt = '',
  className = '',
  imgClassName = '',
  variant = 'hero',
  size = 80,
  showPedestal = true,
  roundedClassName = 'rounded-xl',
}) => {
  const { src, onError } = useResilientImgSrc(image);

  if (variant === 'thumbnail') {
    const remSize = size / 16;
    const faceRem = remSize * FACE_RATIO;
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden ${roundedClassName} ${className}`.trim()}
        style={{ width: `${remSize}rem`, height: `${remSize}rem` }}
      >
        {showPedestal ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[10%] bottom-[8%] z-0 h-[26%] rounded-[100%] opacity-90"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 45%, transparent 72%)',
            }}
          />
        ) : null}
        <img
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          loading="eager"
          className={`relative z-[1] select-none object-contain ${imgClassName}`.trim()}
          style={{
            width: `${faceRem}rem`,
            height: `${faceRem}rem`,
            filter:
              'drop-shadow(0 0 0.5px rgba(0,0,0,0.55)) drop-shadow(0 2px 3px rgba(0,0,0,0.4)) drop-shadow(0 6px 12px rgba(0,0,0,0.35))',
          }}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex max-h-full max-w-full items-center justify-center overflow-hidden ${roundedClassName} ${className}`.trim()}
    >
      {showPedestal ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[8%] bottom-[6%] z-0 h-[28%] rounded-[100%] opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.12) 42%, transparent 72%)',
          }}
        />
      ) : null}
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        loading="eager"
        className={`relative z-[1] max-h-full max-w-full select-none object-contain object-center ${imgClassName}`.trim()}
        style={{
          filter:
            'drop-shadow(0 0 0.5px rgba(0,0,0,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.45)) drop-shadow(0 10px 18px rgba(0,0,0,0.4))',
        }}
        onError={onError}
      />
    </div>
  );
};

export default React.memo(GuildBossPortrait);
