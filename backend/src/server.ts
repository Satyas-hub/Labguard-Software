// ============================================================================
// LABGUARD V2: Express + WebSocket Server Entry Point
// ============================================================================

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ENV } from './config/env';
import apiRouter from './routes/api';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'LABGUARD Central API',
    version: '3.5.1',
    timestamp: new Date().toISOString()
  });
});

// Mount Central REST API
app.use('/api', apiRouter);

const server = http.createServer(app);

// Realtime WebSocket server for client status and live events
const wss = new WebSocketServer({ server, path: '/ws' });
import { RealtimeService } from './services/realtimeService';
RealtimeService.init(wss);

export const broadcastRealtimeEvent = (eventType: string, payload: any, labCode?: string) => {
  RealtimeService.broadcast(eventType, payload, labCode);
};

if (require.main === module) {
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${ENV.PORT} already in use. A server instance is already running.`);
      process.exit(0);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(ENV.PORT, () => {
    console.log(`========================================================`);
    console.log(` LABGUARD V2 Central API Server listening on port ${ENV.PORT}`);
    console.log(` REST: http://localhost:${ENV.PORT}/api`);
    console.log(` WebSocket: ws://localhost:${ENV.PORT}/ws`);
    console.log(` Mode: ${ENV.NODE_ENV}`);
    console.log(`========================================================`);
  });
}

export { app, server };
