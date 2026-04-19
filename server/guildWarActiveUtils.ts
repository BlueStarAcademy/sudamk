/**
 * KV `activeGuildWars` 항목의 종료 시각을 밀리초로 통일한다.
 * Prisma/JSON 직렬화로 endTime·startTime이 ISO 문자열일 수 있어 Number()만 쓰면 NaN이 된다.
 */
export function guildWarEffectiveEndMs(w: any): number {
    const et = w?.endTime;
    if (et != null && et !== '') {
        if (typeof et === 'number' && Number.isFinite(et)) return et;
        if (typeof et === 'string') {
            const parsed = Date.parse(et);
            if (Number.isFinite(parsed)) return parsed;
            const n = Number(et);
            if (Number.isFinite(n) && n > 0) return n;
        }
    }
    const st = w?.startTime;
    let startMs = 0;
    if (typeof st === 'number' && Number.isFinite(st)) {
        startMs = st;
    } else if (typeof st === 'string' && st.length > 0) {
        const p = Date.parse(st);
        startMs = Number.isFinite(p) ? p : 0;
    }
    return startMs + 48 * 60 * 60 * 1000;
}

/** status가 active이고 아직 종료 시각 전이면 true (클라·서버 «진행 중» 판정 공통) */
export function guildWarIsChronologicallyActive(w: any, now: number): boolean {
    return w?.status === 'active' && now < guildWarEffectiveEndMs(w);
}
