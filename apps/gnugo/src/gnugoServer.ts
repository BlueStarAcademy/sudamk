/**
 * GNU Go Server
 * 그누고 AI 봇 서비스
 * 각 게임은 독립적으로 처리됨 (gameId로 격리)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { gnugoService } from './gnugoService.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4002', 10);

// CORS 설정
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'gnugo',
    status: 'running',
    endpoints: {
      health: '/api/health',
      move: '/api/gnugo/move',
      status: '/api/gnugo/status',
    },
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const isReady = await gnugoService.isReady();
    res.json({
      status: 'ok',
      service: 'gnugo',
      ready: isReady,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'gnugo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GNU Go move endpoint
app.post('/api/gnugo/move', async (req, res) => {
  try {
    const { gameId, boardState, boardSize, currentPlayer, level } = req.body;

    if (!gameId || !boardState || !boardSize) {
      return res.status(400).json({
        error: 'Missing required fields: gameId, boardState, boardSize',
      });
    }

    // 레벨 검증 (1-10 범위)
    if (level !== undefined) {
      const levelNum = Number(level);
      if (isNaN(levelNum) || levelNum < 1 || levelNum > 10) {
        return res.status(400).json({
          error: `Level must be between 1 and 10, got: ${level}`,
        });
      }
    }

    // 각 게임은 독립적으로 처리됨 (gameId로 격리)
    const result = await gnugoService.getMove({
      gameId,
      boardState,
      boardSize,
      currentPlayer: currentPlayer || 1,
      level: level !== undefined ? Number(level) : undefined,
    });

    // 에러가 있으면 400 상태 코드 반환
    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[GNU Go Server] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Status endpoint
app.get('/api/gnugo/status', async (req, res) => {
  try {
    const status = await gnugoService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('[GNU Go Server] Error getting status:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
const start = async () => {
  try {
    // Initialize GNU Go service
    await gnugoService.initialize();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[GNU Go Server] ========================================`);
      console.log(`[GNU Go Server] ✅ Server successfully started!`);
      console.log(`[GNU Go Server] Server running on port ${PORT}`);
      console.log(`[GNU Go Server] Health check: http://0.0.0.0:${PORT}/api/health`);
      console.log(`[GNU Go Server] Move endpoint: http://0.0.0.0:${PORT}/api/gnugo/move`);
      console.log(`[GNU Go Server] ========================================`);
    });
  } catch (error) {
    console.error('[GNU Go Server] ❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('[GNU Go Server] ❌ Uncaught Exception:', error);
  console.error('[GNU Go Server] Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[GNU Go Server] ⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

start();

