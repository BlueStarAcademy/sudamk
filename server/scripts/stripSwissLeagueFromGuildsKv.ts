/**
 * 롤백된 대회 설정(스위스 리그) 잔여 데이터 제거
 *
 * KV `guilds`의 각 길드 객체에서 `swissLeagueTournamentSettings` 키를 삭제합니다.
 *
 * 실행:
 *   npx tsx --tsconfig server/tsconfig.json server/scripts/stripSwissLeagueFromGuildsKv.ts
 *
 * 또는:
 *   npm run script:strip-swiss-league-from-guilds-kv
 */

import * as db from '../db.js';

const FIELD = 'swissLeagueTournamentSettings';

async function main() {
    console.log('='.repeat(60));
    console.log(`KV guilds에서 "${FIELD}" 제거`);
    console.log('='.repeat(60));

    try {
        const guilds = (await db.getKV<Record<string, any>>('guilds')) || {};
        const ids = Object.keys(guilds);
        console.log(`\n로드된 길드 수: ${ids.length}`);

        let stripped = 0;
        for (const [guildId, guild] of Object.entries(guilds)) {
            if (!guild || typeof guild !== 'object') continue;
            if (Object.prototype.hasOwnProperty.call(guild, FIELD)) {
                delete guild[FIELD];
                stripped++;
                console.log(`  ✓ ${guildId} (${String(guild.name ?? '이름 없음')})`);
            }
        }

        if (stripped === 0) {
            console.log(`\n제거할 "${FIELD}" 필드가 없습니다. 변경 없음.`);
        } else {
            await db.setKV('guilds', guilds);
            console.log(`\nKV 저장 완료. 제거한 길드: ${stripped}개`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('완료');
        console.log('='.repeat(60));
    } catch (e) {
        console.error('오류:', e);
        process.exitCode = 1;
    }
}

main().finally(() => process.exit(process.exitCode ?? 0));
