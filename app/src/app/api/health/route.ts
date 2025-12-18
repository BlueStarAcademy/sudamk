/**
 * Health check endpoint
 * Railway 헬스체크용
 */

import { NextResponse } from 'next/server';
import { getPrismaClient } from '@sudam/database';
import { checkKataGoHealth } from '@/server/clients/katago';
import { checkGnugoHealth } from '@/server/clients/gnugo';

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Database health check
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    
    // External services health check (non-blocking)
    const [katagoHealthy, gnugoHealthy] = await Promise.allSettled([
      checkKataGoHealth(),
      checkGnugoHealth(),
    ]);

    const uptime = Math.floor((Date.now() - startTime) / 1000);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      services: {
        database: 'ok',
        katago: katagoHealthy.status === 'fulfilled' && katagoHealthy.value ? 'ok' : 'unavailable',
        gnugo: gnugoHealthy.status === 'fulfilled' && gnugoHealthy.value ? 'ok' : 'unavailable',
      },
      version: process.env.npm_package_version || '2.0.0',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

