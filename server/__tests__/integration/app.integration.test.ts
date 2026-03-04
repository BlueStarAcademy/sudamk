import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { createApp, type ServerRef, type DbInitializedRef } from '../../server.js';

describe('createApp (integration)', () => {
    it('returns app that responds to /api/health when testMode', async () => {
        const serverRef: ServerRef = { serverInstance: null, isServerReady: false };
        const dbInitializedRef: DbInitializedRef = { value: false };
        const app: Application = createApp(serverRef, dbInitializedRef, { testMode: true });
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body.listening).toBe(false);
        expect(res.body.ready).toBe(false);
    });

    it('returns app that responds to POST /api/action with 401 when no userId', async () => {
        const serverRef: ServerRef = { serverInstance: null, isServerReady: false };
        const dbInitializedRef: DbInitializedRef = { value: false };
        const app: Application = createApp(serverRef, dbInitializedRef, { testMode: true });
        const res = await request(app)
            .post('/api/action')
            .send({ type: 'LOGIN', payload: {} });
        expect(res.status).toBe(401);
    });
});
