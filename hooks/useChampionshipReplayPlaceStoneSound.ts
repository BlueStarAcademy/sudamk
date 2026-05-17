import { useEffect, useRef } from 'react';
import { audioService } from '../services/audioService.js';

/**
 * 챔피언십 인게임 기보 재생: currentPly가 증가할 때마다 착수 소리.
 * scopeKey가 바뀌면(다른 매치) 첫 ply는 소리 없이 동기화만 한다.
 */
export function useChampionshipReplayPlaceStoneSound(
    currentPly: number | undefined | null,
    scopeKey: string,
    enabled: boolean,
): void {
    const prevPlyRef = useRef<number | undefined>(undefined);
    const scopeKeyRef = useRef(scopeKey);

    useEffect(() => {
        if (scopeKeyRef.current !== scopeKey) {
            scopeKeyRef.current = scopeKey;
            prevPlyRef.current = undefined;
        }
    }, [scopeKey]);

    useEffect(() => {
        if (!enabled) {
            prevPlyRef.current = undefined;
            return;
        }
        const ply = Math.max(0, Math.floor(Number(currentPly ?? 0)));
        const prev = prevPlyRef.current;
        prevPlyRef.current = ply;
        if (prev === undefined) return;
        if (ply > prev) {
            void audioService.initialize();
            audioService.placeStone();
        }
    }, [currentPly, enabled]);
}
