import React from 'react';

interface AvatarProps {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  borderUrl?: string | null;
  size?: number;
  className?: string;
  /** @deprecated 이미지 테두리는 항상 `size` 고정 프레임을 사용합니다. */
  fixedFrameSize?: boolean;
  /** 프로필 테두리(z-[1]) 위에 표시할 하단 오버레이(경기 결과 승·패 리본 등) */
  bottomOverlay?: React.ReactNode;
}

const Avatar: React.FC<AvatarProps> = ({
  userId,
  userName,
  avatarUrl,
  borderUrl,
  size = 40,
  className = '',
  bottomOverlay,
}) => {
  const remSize = size / 16;
  const isColorBorder = borderUrl && (borderUrl.startsWith('#') || borderUrl.startsWith('conic-gradient'));
  const isImageBorder = borderUrl && !isColorBorder;
  const finalAvatarUrl = avatarUrl || '/images/profiles/profile1.webp';
  /** 테두리 종류와 무관하게 얼굴 원 크기·위치를 고정 (색/이미지 테두리 공통) */
  const faceRemSize = remSize * 0.82;

  // Case 1: Image Border — 외곽·얼굴은 고정, 장식 링만 테두리 에셋에 맞게 스케일
  if (isImageBorder) {
    /** 프리미엄1·2, 챌린저잡기, VIP 링 — 장식이 바깥으로 나가 보이도록 프레임을 키움 */
    const isLargeOrnateRing = /Ring[5-8]\.(webp|png)/i.test(borderUrl);

    let borderRemSize = remSize * 1.4;
    if (/Ring/i.test(borderUrl)) {
        borderRemSize = remSize * (isLargeOrnateRing ? 1.74 : 1.52);
    }

    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
        style={{
          width: `${remSize}rem`,
          height: `${remSize}rem`,
        }}
      >
        <div className="relative z-0 flex h-full w-full items-center justify-center">
          <div
            className="overflow-hidden rounded-full bg-gray-700"
            style={{ width: `${faceRemSize}rem`, height: `${faceRemSize}rem` }}
          >
            <img src={finalAvatarUrl} alt={userName} className="h-full w-full object-cover" decoding="async" />
          </div>
        </div>
        <img
          src={borderUrl}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 object-contain"
          style={{ width: `${borderRemSize}rem`, height: `${borderRemSize}rem` }}
          aria-hidden="true"
          decoding="async"
        />
        {bottomOverlay ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center">
            {bottomOverlay}
          </div>
        ) : null}
      </div>
    );
  }
  
  // Case 2: Color Border — metal rim + inset highlight for a more desirable frame
  if (isColorBorder) {
    const isGradient = borderUrl.startsWith('conic-gradient');
    const rimBackground = isGradient
      ? borderUrl
      : `linear-gradient(145deg, rgba(255,255,255,0.55) 0%, ${borderUrl} 38%, ${borderUrl} 62%, rgba(0,0,0,0.35) 100%)`;
    return (
      <div
        className={`relative flex items-center justify-center rounded-full flex-shrink-0 ${className}`}
        style={{
            width: `${remSize}rem`,
            height: `${remSize}rem`,
            background: rimBackground,
            boxShadow: isGradient
              ? '0 0 0 1px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.45)'
              : `0 0 0 1px rgba(255,255,255,0.28), 0 2px 6px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.4)`,
        }}
      >
        <div
          className="flex items-center justify-center rounded-full overflow-hidden bg-gray-700"
          style={{
            width: `${faceRemSize}rem`,
            height: `${faceRemSize}rem`,
            boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.35)',
          }}
        >
          <img src={finalAvatarUrl} alt={userName} className="w-full h-full object-cover" decoding="async" />
        </div>
        {bottomOverlay ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center">
            {bottomOverlay}
          </div>
        ) : null}
      </div>
    );
  }

  // Case 3: No Border (default)
  return (
    <div
      className={`relative rounded-full overflow-hidden bg-gray-700 flex-shrink-0 ${className}`}
      style={{ width: `${remSize}rem`, height: `${remSize}rem` }}
    >
      <img src={finalAvatarUrl} alt={userName} className="w-full h-full object-cover" />
      {bottomOverlay ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center">
          {bottomOverlay}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(Avatar);