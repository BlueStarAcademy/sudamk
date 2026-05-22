import { SinglePlayerLevel } from '../types.js';

/** 인게임 싱글플레이 전면 배경 WebP (`public/images/bg/single*.webp`) */
export function getSinglePlayerInGameBackgroundUrl(level: SinglePlayerLevel | undefined): string {
    switch (level) {
        case SinglePlayerLevel.입문:
            return '/images/bg/single1.webp';
        case SinglePlayerLevel.초급:
            return '/images/bg/single2.webp';
        case SinglePlayerLevel.중급:
            return '/images/bg/single3.webp';
        case SinglePlayerLevel.고급:
            return '/images/bg/single4.webp';
        case SinglePlayerLevel.유단자:
            return '/images/bg/single5.webp';
        default:
            return '/images/bg/single1.webp';
    }
}
