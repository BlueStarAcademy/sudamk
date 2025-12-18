/**
 * KataGo analysis API route
 * KataGo 서비스를 통해 게임 위치 분석
 * 각 게임은 독립적으로 분석됨 (gameId로 격리)
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzePosition } from '@/server/clients/katago';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    if (!body.gameId || !body.moves || !body.boardSize) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, moves, boardSize' },
        { status: 400 }
      );
    }

    // 각 게임은 독립적으로 분석됨
    const result = await analyzePosition({
      id: body.id || crypto.randomUUID(),
      gameId: body.gameId,
      moves: body.moves,
      boardSize: body.boardSize,
      currentPlayer: body.currentPlayer || 1,
      komi: body.komi,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[KataGo API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

