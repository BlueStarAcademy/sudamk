import * as db from './db.js';
import { aiUserId } from './aiPlayer.js';
import type { GameSettings, Negotiation, User } from '../types/index.js';
import { PAIR_GO_GAME_MODES } from '../shared/utils/pairGameTurn.js';

function collectPairPetOwnerUserIds(
    pairGame: NonNullable<GameSettings['pairGame']>,
    challengerId: string,
    opponentId: string,
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (rawId: string) => {
        let id = rawId;
        if (id.startsWith('pet-ai-')) {
            id = id.slice('pet-ai-'.length);
        }
        if (!id || id === 'pair-missing-partner' || id === aiUserId) return;
        if (String(id).startsWith('pair-opponent')) return;
        if (seen.has(id)) return;
        seen.add(id);
        out.push(id);
    };
    for (const m of [...pairGame.teamA.members, ...pairGame.teamB.members]) {
        if (m.kind === 'user') push(m.id);
        if (m.kind === 'pet' && m.id.startsWith('pet-ai-')) push(m.id);
    }
    if (!out.length) {
        push(challengerId);
        push(opponentId);
    }
    return out;
}

/** 리매치 등 `pairPetStatUsers` 없이 들어온 페어 협상에 장착 펫·RPS용 유저 스냅샷을 붙인다. */
export async function ensureNegotiationPairPetUsers(negotiation: Negotiation): Promise<Negotiation> {
    const existing = (negotiation as Negotiation & { pairPetStatUsers?: User[] }).pairPetStatUsers;
    if (existing?.length) return negotiation;
    const pairGame = negotiation.settings?.pairGame;
    if (!pairGame || !PAIR_GO_GAME_MODES.includes(negotiation.mode)) return negotiation;
    const ids = collectPairPetOwnerUserIds(pairGame, negotiation.challenger.id, negotiation.opponent.id);
    const users = (await Promise.all(ids.map((id) => db.getUser(id)))).filter((u): u is User => Boolean(u));
    if (!users.length) return negotiation;
    return {
        ...negotiation,
        pairPetStatUsers: users,
        pairPetConfigureOwnerId: pairGame.pairLobbyOwnerId ?? negotiation.challenger.id,
    };
}
