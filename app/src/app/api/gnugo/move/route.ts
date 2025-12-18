/**
 * GNU Go AI move API route
 * 그누고 서비스를 통해 AI 수를 받아옴
 * 각 게임은 독립적으로 처리됨 (gameId로 격리)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIMove } from '@/server/clients/gnugo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    if (!body.gameId || !body.boardState || !body.boardSize) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, boardState, boardSize' },
        { status: 400 }
      );
    }

    // 각 게임은 독립적으로 처리됨
    const result = await getAIMove({
      gameId: body.gameId,
      boardState: body.boardState,
      boardSize: body.boardSize,
      currentPlayer: body.currentPlayer || 1,
      level: body.level || 5,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GNU Go API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

