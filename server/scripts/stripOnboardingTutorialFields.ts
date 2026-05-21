/**
 * User.status(JSON)에서 온보딩 튜토리얼 필드를 제거합니다.
 *
 *   npx tsx server/scripts/stripOnboardingTutorialFields.ts
 *   DRY_RUN=1 npx tsx server/scripts/stripOnboardingTutorialFields.ts
 */
import prisma from '../prismaClient.js';
import type { InputJsonValue } from '@prisma/client/runtime/library';

const ONBOARDING_KEYS = [
    'onboardingTutorialPhase',
    'onboardingTutorialPendingFirstHome',
    'onboardingCompletionRewardClaimed',
    'onboardingIntro1FanPendingClaim',
    'onboardingSpResultTutorialStep',
] as const;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as JsonRecord;
}

function stripOnboarding(status: unknown): { next: JsonRecord | null; changed: boolean } {
    const src = asRecord(status);
    if (!src) return { next: null, changed: false };

    const next: JsonRecord = JSON.parse(JSON.stringify(src));
    let changed = false;

    for (const key of ONBOARDING_KEYS) {
        if (key in next) {
            delete next[key];
            changed = true;
        }
    }

    return { next, changed };
}

async function run() {
    const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

    const users = await prisma.user.findMany({ select: { id: true, status: true } });
    let scanned = 0;
    let updated = 0;

    for (const row of users) {
        scanned += 1;
        const { next, changed } = stripOnboarding(row.status);
        if (!changed || !next) continue;

        if (!dryRun) {
            await prisma.user.update({
                where: { id: row.id },
                data: { status: next as InputJsonValue },
            });
        }
        updated += 1;
    }

    console.log(
        `[stripOnboardingTutorialFields] scanned=${scanned} ${dryRun ? 'would_update' : 'updated'}=${updated} dryRun=${dryRun}`,
    );
}

run()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
