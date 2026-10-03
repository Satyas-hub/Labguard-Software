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
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = (req.body?.identifier || '').toString().toLowerCase();
    const key = `${ip}:${identifier}`;
    const now = Date.now();
    const record = failedAttempts.get(key);
    if (record) {
        // Check if currently locked out
        if (record.lockedUntil && now < record.lockedUntil) {
            const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
            return res.status(429).json({
                success: false,
                error: 'TOO_MANY_ATTEMPTS',
                message: `Account sign-in temporarily throttled due to multiple failed attempts. Please try again in ${remainingSeconds} seconds.`,
                retryAfterSeconds: remainingSeconds
            });
        }
        // Window expired, reset
        if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || now >= record.lockedUntil)) {
            failedAttempts.delete(key);
        }
    }
    next();
};
exports.authRateLimiter = authRateLimiter;
const recordFailedLogin = (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = (req.body?.identifier || '').toString().toLowerCase();
    if (!identifier)
        return;
    const key = `${ip}:${identifier}`;
    const now = Date.now();
    const record = failedAttempts.get(key);
    if (!record) {
        failedAttempts.set(key, { count: 1, firstAttempt: now });
    }
    else {
        record.count += 1;
        if (record.count >= MAX_FAILED_ATTEMPTS) {
            record.lockedUntil = now + LOCKOUT_MS;
        }
    }
};
exports.recordFailedLogin = recordFailedLogin;
const clearFailedLogin = (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = (req.body?.identifier || '').toString().toLowerCase();
    const key = `${ip}:${identifier}`;
    failedAttempts.delete(key);
};
exports.clearFailedLogin = clearFailedLogin;
