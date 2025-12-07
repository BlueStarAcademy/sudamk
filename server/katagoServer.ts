import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getKataGoManager, initializeKataGo } from './kataGoService.js';

const app = express();
const PORT = process.env.PORT || 4001;

// CORS 설정 - 백엔드 서비스에서 접근 허용
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    const manager = getKataGoManager();
    const processRunning = manager && (manager as any).process && !(manager as any).process.killed;
    const isStarting = (manager as any).isStarting || false;
    
    res.json({
        status: 'ok',
        service: 'katago',
        katagoRunning: processRunning,
        isStarting: isStarting,
        timestamp: new Date().toISOString()
    });
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
        // Initialize KataGo (non-blocking)
        console.log('[KataGo Server] Starting KataGo initialization...');
        setImmediate(() => {
            initializeKataGo().then(() => {
                console.log('[KataGo Server] KataGo initialization complete');
            }).catch((error: any) => {
                console.error('[KataGo Server] KataGo initialization failed:', error?.message || error);
                console.error('[KataGo Server] Server will continue, but KataGo may not be available');
            });
        });

        app.listen(PORT, () => {
            console.log(`[KataGo Server] Server running on port ${PORT}`);
            console.log(`[KataGo Server] Health check: http://localhost:${PORT}/api/health`);
            console.log(`[KataGo Server] Analysis endpoint: http://localhost:${PORT}/api/katago/analyze`);
        });
    } catch (error: any) {
        console.error('[KataGo Server] Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

