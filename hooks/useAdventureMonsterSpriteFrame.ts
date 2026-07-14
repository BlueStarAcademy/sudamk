import { useEffect, useState } from 'react';

/**
 * 맵 몬스터 4프레임 시트 사이클.
 * walking=true → walk1/walk2(1↔2), false → idle0/idle1(0↔3)
 */
export function useAdventureMonsterSpriteFrame(
    cols: number,
    rows: number,
    walking: boolean,
    reducedMotion: boolean,
): number {
    const total = Math.max(1, Math.floor(cols) * Math.floor(rows));
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (reducedMotion || total <= 1) {
            setFrame(0);
            return;
        }
        if (total < 4) {
            const id = window.setInterval(() => {
                setFrame((f) => (f + 1) % total);
            }, 220);
            return () => window.clearInterval(id);
        }
        let tick = 0;
        const id = window.setInterval(() => {
            tick += 1;
            if (walking) {
                setFrame(tick % 2 === 0 ? 1 : 2);
            } else {
                setFrame(tick % 6 < 5 ? 0 : 3);
            }
        }, walking ? 180 : 320);
        return () => window.clearInterval(id);
    }, [cols, rows, walking, reducedMotion, total]);

    return reducedMotion || total <= 1 ? 0 : frame;
}

export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReduced(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
    return reduced;
}
