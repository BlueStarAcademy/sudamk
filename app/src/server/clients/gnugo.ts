/**
 * GNU Go service client
 * 그누고 서비스와 통신하는 HTTP 클라이언트
 * 각 게임은 독립적으로 처리됨 (gameId로 격리)
 */

const GNUGO_API_URL = process.env.GNUGO_API_URL || process.env.NEXT_PUBLIC_GNUGO_API_URL || 'http://localhost:4002';

export interface GnugoMoveRequest {
  gameId: string; // 게임 세션 식별자 - 각 게임은 독립적으로 처리됨
  boardState: number[][];
  boardSize: number;
  currentPlayer: 1 | 2;
  level?: number; // AI 레벨 (1-10)
}

export interface GnugoMoveResponse {
  gameId: string;
  move: { x: number; y: number } | null; // null이면 패스
  error?: string;
}

/**
 * Get AI move from GNU Go
 * 각 게임은 독립적으로 처리됨 (gameId로 격리)
 */
export async function getAIMove(
  request: GnugoMoveRequest
): Promise<GnugoMoveResponse> {
  try {
    const response = await fetch(`${GNUGO_API_URL}/api/gnugo/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`GNU Go service error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      gameId: request.gameId,
      ...result,
    };
  } catch (error) {
    console.error('[GNU Go Client] Error:', error);
    return {
      gameId: request.gameId,
      move: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check GNU Go service health
 */
export async function checkGnugoHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${GNUGO_API_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

