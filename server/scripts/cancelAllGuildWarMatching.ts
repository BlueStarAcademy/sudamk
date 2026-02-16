/**
 * 모든 길드의 전쟁 참여(매칭) 상태 취소
 *
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/cancelAllGuildWarMatching.ts
 *
 * - guildWarMatchingQueue 비움
 * - 모든 길드에서 guildWarMatching 플래그 제거
 */

import * as db from '../db.js';

async function cancelAllGuildWarMatching() {
    console.log('='.repeat(60));
    console.log('모든 길드 전쟁 매칭 취소 시작...');
    console.log('='.repeat(60));

    try {
        // 1. 현재 매칭 큐 조회
        const matchingQueue = (await db.getKV<string[]>('guildWarMatchingQueue')) || [];
        console.log(`\n[1/3] 현재 매칭 큐: ${matchingQueue.length}개 길드`);
        if (matchingQueue.length > 0) {
            console.log('  길드 ID 목록:', matchingQueue.join(', '));
        }

        // 2. 길드 정보 로드 및 guildWarMatching 제거
        const guilds = (await db.getKV<Record<string, any>>('guilds')) || {};
        let clearedCount = 0;
        for (const [guildId, guild] of Object.entries(guilds)) {
            if (guild && (guild as any).guildWarMatching) {
                delete (guild as any).guildWarMatching;
                clearedCount++;
                console.log(`  ✓ 길드 ${guildId} (${guild.name || '이름없음'}) - 매칭 플래그 제거`);
            }
        }
        console.log(`\n[2/3] guildWarMatching 플래그 제거: ${clearedCount}개 길드`);

        // 3. KV 저장
        await db.setKV('guildWarMatchingQueue', []);
        await db.setKV('guilds', guilds);
        console.log('\n[3/3] KV 저장 완료');

        console.log('\n' + '='.repeat(60));
        console.log('완료: 모든 길드 전쟁 매칭이 취소되었습니다.');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('오류 발생:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

cancelAllGuildWarMatching();
