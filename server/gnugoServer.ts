// Load environment variables (dotenv will silently fail if .env doesn't exist - Railway uses env vars directly)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
// Railway sets PORT automatically, use it or default to 4002
const PORT = parseInt(process.env.PORT || '4002', 10);

// Railway 환경 감지
if (!process.env.RAILWAY_ENVIRONMENT && 
    (process.env.RAILWAY_ENVIRONMENT_NAME || 
     process.env.RAILWAY_SERVICE_NAME || 
     process.env.RAILWAY_PROJECT_NAME)) {
    process.env.RAILWAY_ENVIRONMENT = 'true';
    console.log('[GnuGo Server] Railway environment auto-detected');
}

// CORS 설정 - 백엔드 서비스에서 접근 허용
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200
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
            status: '/api/gnugo/status'
        }
    });
});

// Health check endpoint - MUST be defined before any imports that might fail
// Railway 헬스체크는 서버가 시작되었는지만 확인하면 됩니다
// GnuGo 초기화는 비동기로 진행되므로, 서버가 실행 중이면 정상으로 응답
app.get('/api/health', async (req, res) => {
    try {
        // Try to get GnuGo manager, but don't fail if it's not initialized yet
        let manager = null;
        let processRunning = false;
        let isStarting = false;
        
        try {
            const { getGnuGoManager } = await import('./gnugoService.js');
            manager = getGnuGoManager();
            processRunning = manager && (manager as any).process && !(manager as any).process.killed;
            isStarting = (manager as any).isStarting || false;
        } catch (importError: any) {
            // GnuGo service not initialized yet - that's OK
            // Don't log this as it's expected during startup
        }
        
        // 서버가 실행 중이면 정상 응답 (GnuGo 초기화 중이어도 OK)
        res.status(200).json({
            status: 'ok',
            service: 'gnugo',
            gnugoRunning: processRunning,
            isStarting: isStarting,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        // 에러가 발생해도 서버가 실행 중이면 정상 응답
        res.status(200).json({
            status: 'ok',
            service: 'gnugo',
            gnugoRunning: false,
            isStarting: false,
            error: error?.message || 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});

// GnuGo move generation endpoint
app.post('/api/gnugo/move', async (req, res) => {
    try {
        const { boardState, boardSize, player, moveHistory, level } = req.body;
        
        if (!boardState || !boardSize) {
            return res.status(400).json({ error: 'Invalid request: boardState and boardSize are required' });
        }

        const levelNum = level !== undefined ? parseInt(String(level), 10) : undefined;
        console.log(`[GnuGo Server] Received move request: boardSize=${boardSize}, player=${player}, level=${levelNum ?? 'default'}`);
        
        const { generateGnuGoMove } = await import('./gnugoService.js');
        const move = await generateGnuGoMove({
            boardState,
            boardSize,
            player: player || 'black',
            moveHistory: moveHistory || [],
            level: (levelNum >= 1 && levelNum <= 10) ? levelNum : undefined
        });
        
        console.log(`[GnuGo Server] Move generated: (${move.x}, ${move.y})`);
        res.json({ move });
    } catch (error: any) {
        console.error('[GnuGo Server] Error:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error'
        });
    }
});

// GnuGo status endpoint (for debugging)
app.get('/api/gnugo/status', async (req, res) => {
    try {
        const { getGnuGoManager } = await import('./gnugoService.js');
        const manager = getGnuGoManager();
        const processRunning = manager && (manager as any).process && !(manager as any).process.killed;
        const isStarting = (manager as any).isStarting || false;
        
        res.json({
            status: processRunning ? 'running' : (isStarting ? 'starting' : 'stopped'),
            processRunning,
            isStarting,
            config: {
                GNUGO_PATH: process.env.GNUGO_PATH || 'gnugo',
                GNUGO_LEVEL: process.env.GNUGO_LEVEL || '10',
                PORT: PORT
            }
        });
    } catch (error: any) {
        console.error('[GnuGo Server] Error getting status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const startServer = async () => {
    try {
        console.log(`[GnuGo Server] ========================================`);
        console.log(`[GnuGo Server] Starting server...`);
        console.log(`[GnuGo Server] PORT from environment: ${process.env.PORT || 'not set'}`);
        console.log(`[GnuGo Server] Using PORT: ${PORT}`);
        console.log(`[GnuGo Server] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        console.log(`[GnuGo Server] ========================================`);
        
        // 서버를 먼저 리스닝 시작 (헬스체크가 즉시 통과할 수 있도록)
        // GnuGo 초기화는 비동기로 처리하여 서버 시작을 블로킹하지 않음
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[GnuGo Server] ========================================`);
            console.log(`[GnuGo Server] ✅ Server successfully started!`);
            console.log(`[GnuGo Server] Server running on port ${PORT}`);
            console.log(`[GnuGo Server] Health check: http://0.0.0.0:${PORT}/api/health`);
            console.log(`[GnuGo Server] Move endpoint: http://0.0.0.0:${PORT}/api/gnugo/move`);
            console.log(`[GnuGo Server] ========================================`);
            
            // GnuGo 초기화는 서버 리스닝 후 비동기로 처리
            setImmediate(async () => {
                try {
                    console.log('[GnuGo Server] Starting GnuGo initialization (non-blocking)...');
                    const { initializeGnuGo } = await import('./gnugoService.js');
                    await initializeGnuGo();
                    console.log('[GnuGo Server] ✅ GnuGo initialization complete');
                } catch (error: any) {
                    console.error('[GnuGo Server] ⚠️ GnuGo initialization failed:', error?.message || error);
                    console.error('[GnuGo Server] Server will continue, but GnuGo may not be available');
                    // 초기화 실패해도 서버는 계속 실행
                }
            });
        });
        
        // 에러 핸들링 추가
        server.on('error', (error: any) => {
            console.error('[GnuGo Server] ❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`[GnuGo Server] Port ${PORT} is already in use`);
            }
            process.exit(1);
        });
        
    } catch (error: any) {
        console.error('[GnuGo Server] ❌ Failed to start server:', error);
        console.error('[GnuGo Server] Error details:', error?.stack || error);
        process.exit(1);
    }
};

// 프로세스 에러 핸들링
process.on('uncaughtException', (error: Error) => {
    console.error('[GnuGo Server] ❌ Uncaught Exception:', error);
    console.error('[GnuGo Server] Stack:', error.stack);
    // 서버를 종료하지 않고 계속 실행 (헬스체크가 통과할 수 있도록)
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('[GnuGo Server] ⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
    // 서버를 종료하지 않고 계속 실행
});

startServer();

