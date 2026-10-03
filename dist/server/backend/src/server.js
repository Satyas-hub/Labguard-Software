"use strict";
// ============================================================================
// LABGUARD V2: Express + WebSocket Server Entry Point
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = exports.broadcastRealtimeEvent = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const env_1 = require("./config/env");
const api_1 = __importDefault(require("./routes/api"));
const app = (0, express_1.default)();
exports.app = app;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
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
app.use('/api', api_1.default);
const server = http_1.default.createServer(app);
exports.server = server;
// Realtime WebSocket server for client status and live events
const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
const realtimeService_1 = require("./services/realtimeService");
realtimeService_1.RealtimeService.init(wss);
const broadcastRealtimeEvent = (eventType, payload, labCode) => {
    realtimeService_1.RealtimeService.broadcast(eventType, payload, labCode);
};
exports.broadcastRealtimeEvent = broadcastRealtimeEvent;
if (require.main === module) {
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${env_1.ENV.PORT} already in use. A server instance is already running.`);
            process.exit(0);
        }
        else {
            console.error('Server error:', err);
        }
    });
    server.listen(env_1.ENV.PORT, () => {
        console.log(`========================================================`);
        console.log(` LABGUARD V2 Central API Server listening on port ${env_1.ENV.PORT}`);
        console.log(` REST: http://localhost:${env_1.ENV.PORT}/api`);
        console.log(` WebSocket: ws://localhost:${env_1.ENV.PORT}/ws`);
        console.log(` Mode: ${env_1.ENV.NODE_ENV}`);
        console.log(`========================================================`);
    });
}
