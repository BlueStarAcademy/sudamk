import { aiUserId } from '../constants/auth.js';

/** 온라인 유저 목록·대기실 목록에 노출하면 안 되는 봇·합성 계정 id */
export function isSyntheticOnlineUserId(id: string | undefined | null): boolean {
    return (
        id === aiUserId ||
        Boolean(
            id &&
                (id.startsWith('dungeon-bot-') || id.startsWith('pair-') || id.startsWith('pet-ai-')),
        )
    );
}
