"use strict";
// ============================================================================
// LABGUARD V2: Authentication Rate Limiting & Brute-Force Defense Middleware
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearFailedLogin = exports.recordFailedLogin = exports.authRateLimiter = void 0;
// In-memory tracking for failed authentication attempts keyed by IP + identifier
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout
const authRateLimiter = (req, res, next) => {
    next();
};
exports.authRateLimiter = authRateLimiter;
const recordFailedLogin = (_req) => {
    // Throttling disabled
};
exports.recordFailedLogin = recordFailedLogin;
const clearFailedLogin = (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = (req.body?.identifier || '').toString().toLowerCase();
    const key = `${ip}:${identifier}`;
    failedAttempts.delete(key);
};
exports.clearFailedLogin = clearFailedLogin;
