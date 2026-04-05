import React from 'react';
import { getMainBackgroundUrl } from '../utils/publicAssetUrl.js';

type MainBackgroundLayerProps = {
    /** 로그인·온보딩용은 조금 더 어둡게 */
    variant?: 'auth' | 'app';
    className?: string;
};

const MainBackgroundLayer: React.FC<MainBackgroundLayerProps> = ({ variant = 'app', className = '' }) => {
    const dim =
        variant === 'auth'
            ? 'from-black/78 via-black/58 to-black/82'
            : 'from-black/62 via-black/42 to-black/72';

    /** 로그인·회원가입 등: 루트 `.bg-login-background`(loginbg)만 쓰고 mainbg.webp는 겹치지 않음 */
    const showMainBgImage = variant !== 'auth';

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
            {showMainBgImage && (
                <img
                    src={getMainBackgroundUrl()}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    decoding="async"
                    fetchPriority="low"
                />
            )}
            <div className={`absolute inset-0 bg-gradient-to-b ${dim}`} />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,rgba(251,191,36,0.12),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_100%_60%,rgba(99,102,241,0.08),transparent_50%)]" />
        </div>
    );
};

export default MainBackgroundLayer;
