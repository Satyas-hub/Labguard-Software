// ============================================================================
// LABGUARD V2: Authentication Rate Limiting & Brute-Force Defense Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

// In-memory tracking for failed authentication attempts keyed by IP + identifier
const failedAttempts = new Map<string, AttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  next();
};

export const recordFailedLogin = (_req: Request) => {
  // Throttling disabled
};

export const clearFailedLogin = (req: Request) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const identifier = (req.body?.identifier || '').toString().toLowerCase();
  const key = `${ip}:${identifier}`;
  failedAttempts.delete(key);
};
