// Load environment variables (dotenv will silently fail if .env doesn't exist - Railway uses env vars directly)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
// Railway sets PORT automatically, use it or default to 4001
const PORT = parseInt(process.env.PORT || '4001', 10);

// Railway 환경 감지
if (!process.env.RAILWAY_ENVIRONMENT && 
    (process.env.RAILWAY_ENVIRONMENT_NAME || 
     process.env.RAILWAY_SERVICE_NAME || 
     process.env.RAILWAY_PROJECT_NAME)) {
    process.env.RAILWAY_ENVIRONMENT = 'true';
    console.log('[KataGo Server] Railway environment auto-detected');
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
        service: 'katago',
        status: 'running',
        endpoints: {
            health: '/api/health',
            analyze: '/api/katago/analyze',
            status: '/api/katago/status'
        }
    });
});

// Health check endpoint - MUST be defined before any imports that might fail
// Railway 헬스체크는 서버가 시작되었는지만 확인하면 됩니다
// KataGo 초기화는 비동기로 진행되므로, 서버가 실행 중이면 정상으로 응답
app.get('/api/health', async (req, res) => {
    try {
        // Try to get KataGo manager, but don't fail if it's not initialized yet
        let manager = null;
        let processRunning = false;
        let isStarting = false;
        
        try {
            const { getKataGoManager } = await import('./kataGoService.js');
            manager = getKataGoManager();
            processRunning = manager && (manager as any).process && !(manager as any).process.killed;
            isStarting = (manager as any).isStarting || false;
        } catch (importError: any) {
            // KataGo service not initialized yet - that's OK
            // Don't log this as it's expected during startup
        }
        
        // 서버가 실행 중이면 정상 응답 (KataGo 초기화 중이어도 OK)
        res.status(200).json({
            status: 'ok',
            service: 'katago',
            katagoRunning: processRunning,
            isStarting: isStarting,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        // 에러가 발생해도 서버가 실행 중이면 정상 응답
        res.status(200).json({
            status: 'ok',
            service: 'katago',
            katagoRunning: false,
            isStarting: false,
            error: error?.message || 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});

// KataGo analysis endpoint
app.post('/api/katago/analyze', async (req, res) => {
    try {
        const query = req.body;
        if (!query || !query.id) {
            return res.status(400).json({ error: 'Invalid query: missing id' });
        }

        console.log(`[KataGo Server] Received analysis query: queryId=${query.id}`);
        
        // Get KataGo manager and query
        const { getKataGoManager } = await import('./kataGoService.js');
        const manager = getKataGoManager();
        const response = await manager.query(query);
        
        console.log(`[KataGo Server] Analysis complete: queryId=${query.id}`);
        res.json(response);
    } catch (error: any) {
        console.error('[KataGo Server] Error:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            queryId: req.body?.id 
        });
    }
});

// KataGo status endpoint (for debugging)
app.get('/api/katago/status', async (req, res) => {
    try {
        const { getKataGoManager } = await import('./kataGoService.js');
        const manager = getKataGoManager();
        const processRunning = manager && (manager as any).process && !(manager as any).process.killed;
        const isStarting = (manager as any).isStarting || false;
        const pendingQueries = (manager as any).pendingQueries ? (manager as any).pendingQueries.size : 0;
        
        res.json({
            status: processRunning ? 'running' : (isStarting ? 'starting' : 'stopped'),
            processRunning,
            isStarting,
            pendingQueries,
            config: {
                KATAGO_PATH: process.env.KATAGO_PATH || 'not set',
                KATAGO_MODEL_PATH: process.env.KATAGO_MODEL_PATH || 'not set',
                KATAGO_HOME_PATH: process.env.KATAGO_HOME_PATH || 'not set',
                KATAGO_NUM_ANALYSIS_THREADS: process.env.KATAGO_NUM_ANALYSIS_THREADS || 'not set',
                KATAGO_NUM_SEARCH_THREADS: process.env.KATAGO_NUM_SEARCH_THREADS || 'not set',
                KATAGO_MAX_VISITS: process.env.KATAGO_MAX_VISITS || 'not set',
                PORT: PORT
            }
        });
    } catch (error: any) {
        console.error('[KataGo Server] Error getting status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const startServer = async () => {
    try {
        console.log(`[KataGo Server] ========================================`);
        console.log(`[KataGo Server] Starting server...`);
        console.log(`[KataGo Server] PORT from environment: ${process.env.PORT || 'not set'}`);
        console.log(`[KataGo Server] Using PORT: ${PORT}`);
        console.log(`[KataGo Server] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        console.log(`[KataGo Server] ========================================`);
        
        // 서버를 먼저 리스닝 시작 (헬스체크가 즉시 통과할 수 있도록)
        // KataGo 초기화는 비동기로 처리하여 서버 시작을 블로킹하지 않음
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[KataGo Server] ========================================`);
            console.log(`[KataGo Server] ✅ Server successfully started!`);
            console.log(`[KataGo Server] Server running on port ${PORT}`);
            console.log(`[KataGo Server] Health check: http://0.0.0.0:${PORT}/api/health`);
            console.log(`[KataGo Server] Analysis endpoint: http://0.0.0.0:${PORT}/api/katago/analyze`);
            console.log(`[KataGo Server] ========================================`);
            
            // KataGo 초기화는 서버 리스닝 후 비동기로 처리
            setImmediate(async () => {
                try {
                    console.log('[KataGo Server] Starting KataGo initialization (non-blocking)...');
                    const { initializeKataGo } = await import('./kataGoService.js');
                    await initializeKataGo();
                    console.log('[KataGo Server] ✅ KataGo initialization complete');
                } catch (error: any) {
                    console.error('[KataGo Server] ⚠️ KataGo initialization failed:', error?.message || error);
                    console.error('[KataGo Server] Server will continue, but KataGo may not be available');
                    // 초기화 실패해도 서버는 계속 실행
                }
            });
        });
        
        // 에러 핸들링 추가
        server.on('error', (error: any) => {
            console.error('[KataGo Server] ❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`[KataGo Server] Port ${PORT} is already in use`);
            }
            process.exit(1);
        });
        
    } catch (error: any) {
        console.error('[KataGo Server] ❌ Failed to start server:', error);
        console.error('[KataGo Server] Error details:', error?.stack || error);
        process.exit(1);
    }
};

// 프로세스 에러 핸들링
process.on('uncaughtException', (error: Error) => {
    console.error('[KataGo Server] ❌ Uncaught Exception:', error);
    console.error('[KataGo Server] Stack:', error.stack);
    // 서버를 종료하지 않고 계속 실행 (헬스체크가 통과할 수 있도록)
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('[KataGo Server] ⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
    // 서버를 종료하지 않고 계속 실행
});

startServer();

