import prisma, { ensurePrismaConnected } from '../prismaClient.js';
import type { Prisma } from '@prisma/client';

export const getKV = async <T>(key: string): Promise<T | null> => {
    if (!(await ensurePrismaConnected())) return null;
    const row = await prisma.keyValue.findUnique({ where: { key } });
    return (row?.value as T) ?? null;
};

export const setKV = async <T>(key: string, value: T): Promise<void> => {
    if (!(await ensurePrismaConnected())) {
        throw new Error('Database temporarily unavailable');
    }
    // Convert value to Prisma-compatible JSON type
    const jsonValue = JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
    await prisma.keyValue.upsert({
        where: { key },
        update: { value: jsonValue },
        create: { key, value: jsonValue },
    });
};