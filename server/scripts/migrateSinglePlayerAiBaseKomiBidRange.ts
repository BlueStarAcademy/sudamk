/**
 * 싱글 스테이지 오버라이드(`singlePlayerStagesOverride`)에서
 * 베이스 AI 랜덤 덤 기본 범위(legacy 1~10)를 5~20으로 일괄 보정한다.
 *
 * 대상:
 * - singlePlayerAiBaseKomiBid.komiMode === 'random'
 * - (komiMin, komiMax) 조합이 legacy 기본값으로 판단되는 경우
 *   - 1,10
 *   - (미지정, 미지정) -> 기존 기본 취급
 *
 * 실행:
 * - 점검만(dry-run): npx tsx --tsconfig server/tsconfig.json server/scripts/migrateSinglePlayerAiBaseKomiBidRange.ts
 * - 실제 반영:        npx tsx --tsconfig server/tsconfig.json server/scripts/migrateSinglePlayerAiBaseKomiBidRange.ts --apply
 */

import * as db from '../db.js';
import prisma from '../prismaClient.js';

const OVERRIDE_KV_KEY = 'singlePlayerStagesOverride';
const TARGET_MIN = 5;
const TARGET_MAX = 20;
const LEGACY_MIN = 1;
const LEGACY_MAX = 10;

const hasOwn = (row: Record<string, unknown>, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(row, key);

const toIntOr = (value: unknown, fallback: number): number => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
};

const isObjectRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

const parseApplyFlag = (): boolean => process.argv.slice(2).includes('--apply');

type MigrationStats = {
    scannedStages: number;
    changedStages: number;
};

function migrateOverrideRaw(raw: unknown): { nextRaw: unknown; stats: MigrationStats } {
    if (!Array.isArray(raw)) {
        return {
            nextRaw: raw,
            stats: { scannedStages: 0, changedStages: 0 },
        };
    }

    const next = raw.map((entry) => (isObjectRecord(entry) ? { ...entry } : entry));
    let scannedStages = 0;
    let changedStages = 0;

    for (const stage of next) {
        if (!isObjectRecord(stage)) continue;
        scannedStages++;

        const bid = stage.singlePlayerAiBaseKomiBid;
        if (!isObjectRecord(bid)) continue;
        if (bid.komiMode !== 'random') continue;

        const hasMin = hasOwn(bid, 'komiMin');
        const hasMax = hasOwn(bid, 'komiMax');
        const min = toIntOr(bid.komiMin, LEGACY_MIN);
        const max = toIntOr(bid.komiMax, LEGACY_MAX);

        const isLegacyDefaultPair = min === LEGACY_MIN && max === LEGACY_MAX;
        const isLegacyImplicitDefault = !hasMin && !hasMax;
        if (!isLegacyDefaultPair && !isLegacyImplicitDefault) continue;

        stage.singlePlayerAiBaseKomiBid = {
            ...bid,
            komiMin: TARGET_MIN,
            komiMax: TARGET_MAX,
        };
        changedStages++;
    }

    return {
        nextRaw: next,
        stats: { scannedStages, changedStages },
    };
}

async function main() {
    const apply = parseApplyFlag();
    const modeLabel = apply ? 'APPLY' : 'DRY-RUN';
    console.log(`[migrateSinglePlayerAiBaseKomiBidRange] mode=${modeLabel}`);

    const raw = await db.getKV<unknown>(OVERRIDE_KV_KEY);
    if (raw == null) {
        console.log(`[migrateSinglePlayerAiBaseKomiBidRange] KV '${OVERRIDE_KV_KEY}' is empty. Nothing to do.`);
        return;
    }

    const { nextRaw, stats } = migrateOverrideRaw(raw);
    console.log(
        `[migrateSinglePlayerAiBaseKomiBidRange] scannedStages=${stats.scannedStages}, changedStages=${stats.changedStages}`,
    );

    if (!apply) {
        console.log(
            '[migrateSinglePlayerAiBaseKomiBidRange] Dry-run complete. Re-run with --apply to persist changes.',
        );
        return;
    }

    if (stats.changedStages <= 0) {
        console.log('[migrateSinglePlayerAiBaseKomiBidRange] No changes detected. Skip write.');
        return;
    }

    await db.setKV(OVERRIDE_KV_KEY, nextRaw);
    console.log(
        `[migrateSinglePlayerAiBaseKomiBidRange] Updated '${OVERRIDE_KV_KEY}' with ${stats.changedStages} migrated stage(s).`,
    );
}

main()
    .catch((e) => {
        console.error('[migrateSinglePlayerAiBaseKomiBidRange] failed:', e);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await prisma.$disconnect();
        } catch {
            // no-op
        }
        process.exit(process.exitCode ?? 0);
    });
