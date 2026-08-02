import { SinglePlayerLevel } from '../types.js';

/** 홈 모험 뷰어 스테이지 맵 배경 — 확장 캠페인 맵 (`adventure-map-*.webp`) */
export function getSinglePlayerLobbyMapBackgroundUrl(level: SinglePlayerLevel | undefined): string {
    switch (level) {
        case SinglePlayerLevel.입문:
            return '/images/bg/adventure-map-1.webp';
        case SinglePlayerLevel.초급:
            return '/images/bg/adventure-map-2.webp';
        case SinglePlayerLevel.중급:
            return '/images/bg/adventure-map-3.webp';
        case SinglePlayerLevel.고급:
            return '/images/bg/adventure-map-4.webp';
        case SinglePlayerLevel.유단자:
            return '/images/bg/adventure-map-5.webp';
        default:
            return '/images/bg/adventure-map-1.webp';
    }
}

/** 인게임 모험(싱글플레이) 전면 배경 — 반별 장소 단독 아트 (`adventure-realm-*.webp`) */
export function getSinglePlayerInGameBackgroundUrl(level: SinglePlayerLevel | undefined): string {
    switch (level) {
        case SinglePlayerLevel.입문:
            return '/images/bg/adventure-realm-1.webp';
        case SinglePlayerLevel.초급:
            return '/images/bg/adventure-realm-2.webp';
        case SinglePlayerLevel.중급:
            return '/images/bg/adventure-realm-3.webp';
        case SinglePlayerLevel.고급:
            return '/images/bg/adventure-realm-4.webp';
        case SinglePlayerLevel.유단자:
            return '/images/bg/adventure-realm-5.webp';
        default:
            return '/images/bg/adventure-realm-1.webp';
    }
}
