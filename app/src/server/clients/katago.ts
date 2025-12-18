/**
 * KataGo service client
 * KataGo 서비스와 통신하는 HTTP 클라이언트
 * 각 분석 요청은 독립적으로 처리됨
 */

const KATAGO_API_URL = process.env.KATAGO_API_URL || process.env.NEXT_PUBLIC_KATAGO_API_URL || 'http://localhost:4001';

export interface KataGoAnalysisRequest {
  id: string;
  gameId: string; // 게임 세션 식별자 - 각 게임은 독립적으로 분석됨
  moves: Array<{ x: number; y: number; player: 1 | 2 }>;
  boardSize: number;
  currentPlayer: 1 | 2;
  komi?: number;
}

export interface KataGoAnalysisResult {
  id: string;
  gameId: string;
  moveInfos?: Array<{
    move: string;
    visits: number;
    winrate: number;
    scoreLead: number;
  }>;
  ownership?: number[][];
  rootInfo?: {
    winrate: number;
    scoreLead: number;
  };
  error?: string;
}

/**
 * Analyze game position using KataGo
 * 각 게임은 독립적으로 분석됨 (gameId로 격리)
 */
export async function analyzePosition(
  request: KataGoAnalysisRequest
): Promise<KataGoAnalysisResult> {
  try {
    const response = await fetch(`${KATAGO_API_URL}/api/katago/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`KataGo service error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      id: request.id,
      gameId: request.gameId,
      ...result,
    };
  } catch (error) {
    console.error('[KataGo Client] Error:', error);
    return {
      id: request.id,
      gameId: request.gameId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check KataGo service health
 */
export async function checkKataGoHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${KATAGO_API_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

