import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameRecord } from '../types.js';
import { userHasSavedGameRecordForGameId } from '../utils/strategicPvpGameRecord.js';

/**
 * 기보 목록에 gameId가 있으면 저장 비활성.
 * 저장 직후 목록 반영 전에는 optimistic으로 잠그고,
 * 목록에서 해당 기보가 제거되면(기보 관리에서 삭제 등) 다시 저장 가능하도록 optimistic만 해제.
 */
export function useGameRecordSaveLock(gameId: string, savedGameRecords: GameRecord[] | undefined | null) {
    const hasInList = useMemo(
        () => userHasSavedGameRecordForGameId(savedGameRecords, gameId),
        [savedGameRecords, gameId]
    );
    const [savedOptimistic, setSavedOptimistic] = useState(false);
    const prevInListRef = useRef(false);

    useEffect(() => {
        setSavedOptimistic(false);
    }, [gameId]);

    useEffect(() => {
        if (prevInListRef.current && !hasInList) {
            setSavedOptimistic(false);
        }
        prevInListRef.current = hasInList;
    }, [hasInList]);

    const recordAlreadySaved = hasInList || savedOptimistic;
    return { recordAlreadySaved, setSavedOptimistic, hasInList };
}
