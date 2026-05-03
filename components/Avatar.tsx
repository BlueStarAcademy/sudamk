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
}

const Avatar: React.FC<AvatarProps> = ({ userId, userName, avatarUrl, borderUrl, size = 40, className = '' }) => {
  const remSize = size / 16;
  const isColorBorder = borderUrl && (borderUrl.startsWith('#') || borderUrl.startsWith('conic-gradient'));
  const isImageBorder = borderUrl && !isColorBorder;
  const finalAvatarUrl = avatarUrl || '/images/profiles/profile1.png';

  // Case 1: Image Border — 외곽은 항상 `size`×`size` 고정, 얼굴 원은 PNG 링 안쪽에 들어가도록 축소
  if (isImageBorder) {
    /** 프리미엄1·2, 챌린저잡기, VIP 링 — 링 장식이 작게 느껴져 PNG를 더 키우고 얼굴 비율을 줄임 */
    const isLargeOrnateRing =
        borderUrl.includes('Ring5.png') ||
        borderUrl.includes('Ring6.png') ||
        borderUrl.includes('Ring7.png') ||
        borderUrl.includes('Ring8.png');

    let borderRemSize = remSize * 1.4;
    if (borderUrl.includes('Ring')) {
        borderRemSize = remSize * (isLargeOrnateRing ? 1.74 : 1.52);
    }
    /** 링 PNG 스케일·안쪽 홀에 맞춘 얼굴 원 비율(바깥 프레임 `remSize` 대비) */
    const innerFaceRem = remSize * (isLargeOrnateRing ? 0.66 : borderUrl.includes('Ring') ? 0.76 : 0.84);

    const faceStyle: React.CSSProperties = {
        width: `${innerFaceRem}rem`,
        height: `${innerFaceRem}rem`,
    };
    if (borderUrl.includes('Ring5.png')) {
        faceStyle.transform = `translateX(-${innerFaceRem * 0.2}rem)`;
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
          <div className="rounded-full overflow-hidden bg-gray-700" style={faceStyle}>
            <img src={finalAvatarUrl} alt={userName} className="h-full w-full object-cover" loading="lazy" />
          </div>
        </div>
        <img
          src={borderUrl}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 object-contain"
          style={{ width: `${borderRemSize}rem`, height: `${borderRemSize}rem` }}
          aria-hidden="true"
          loading="lazy"
        />
      </div>
    );
  }
  
  // Case 2: Color Border
  if (isColorBorder) {
    const innerRemSize = remSize * 0.85;
    const isGradient = borderUrl.startsWith('conic-gradient');
    return (
      <div
        className={`relative flex items-center justify-center rounded-full flex-shrink-0 ${className}`}
        style={{ 
            width: `${remSize}rem`, 
            height: `${remSize}rem`, 
            ...(isGradient ? { background: borderUrl } : { backgroundColor: borderUrl }) 
        }}
      >
        <div
          className="flex items-center justify-center rounded-full overflow-hidden bg-gray-700"
          style={{ width: `${innerRemSize}rem`, height: `${innerRemSize}rem` }}
        >
          <img src={finalAvatarUrl} alt={userName} className="w-full h-full object-cover" loading="lazy" />
        </div>
      </div>
    );
  }

  // Case 3: No Border (default)
  return (
    <div
      className={`rounded-full overflow-hidden bg-gray-700 flex-shrink-0 ${className}`}
      style={{ width: `${remSize}rem`, height: `${remSize}rem` }}
    >
      <img src={finalAvatarUrl} alt={userName} className="w-full h-full object-cover" />
    </div>
  );
};

export default React.memo(Avatar);