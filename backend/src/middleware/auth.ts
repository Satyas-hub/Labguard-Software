// ============================================================================
// LABGUARD V2: Authentication & Strict Server-Side Scoped RBAC Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { UserRole } from '../../../shared/types';
import { db } from '../db/pool';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  identifier?: string;
  department?: string;
  assignedLabs?: string[]; // Lab IDs
  assignedClasses?: string[]; // Class IDs
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateJwt = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid format'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET, { algorithms: ['HS256'] }) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      error: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: isExpired ? 'Session token has expired' : 'Session token is invalid or tampered'
    });
  }
};

export const requireRoles = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Role ${req.user.role} is not authorized for this institutional endpoint`
      });
    }

    next();
  };
};

/**
 * Server-side scoping: Validates that Faculty only accesses assigned classes / students / labs
 */
export const enforceFacultyScope = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  if (req.user.role === 'ADMIN') return next(); // Admin has unrestricted access

  if (req.user.role !== 'FACULTY') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Requires FACULTY authorization' });
  }

  // Scoping check for requested lab or class
  const requestedLabId = req.params.labId || req.query.labId;
  if (requestedLabId && req.user.assignedLabs && !req.user.assignedLabs.includes(requestedLabId as string)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SCOPE',
      message: 'Faculty member is not assigned to the requested laboratory'
    });
  }

  next();
};

/**
 * Server-side scoping: Validates that Lab Assistant only accesses assigned labs
 */
export const enforceLabAssistantScope = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  if (req.user.role === 'ADMIN') return next();

  if (req.user.role !== 'LAB_ASSISTANT') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Requires LAB_ASSISTANT authorization' });
  }

  const requestedLabId = req.params.labId || req.query.labId;
  if (requestedLabId && req.user.assignedLabs && !req.user.assignedLabs.includes(requestedLabId as string)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SCOPE',
      message: 'Lab Assistant is not authorized for this laboratory facility'
    });
  }

  next();
};

/**
 * Generic Laboratory Scope Guard for Faculty and Lab Assistants
 * Verifies that labId or labCode provided in query/params/body belongs to user.assignedLabs
 */
export const enforceLabScope = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  if (req.user.role === 'ADMIN') return next();

  const requestedLab = (
    req.params.labId ||
    req.params.labCode ||
    req.query.labId ||
    req.query.labCode ||
    req.body.labId ||
    req.body.labCode
  ) as string | undefined;

  if (requestedLab && req.user.assignedLabs && req.user.assignedLabs.length > 0) {
    const isAssigned = req.user.assignedLabs.some(
      (l) => l.toLowerCase() === requestedLab.toLowerCase()
    );
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_LAB_SCOPE',
        message: `User is not authorized for laboratory: ${requestedLab}`
      });
    }
  }

  next();
};

/**
 * Server-side scoping: Validates that Student can only view their own data and sessions
 */
export const enforceStudentSelfScope = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  if (req.user.role === 'ADMIN' || req.user.role === 'FACULTY' || req.user.role === 'LAB_ASSISTANT') {
    return next();
  }

  const targetStudentId = req.params.studentId || req.query.studentId || req.body.studentId;
  if (targetStudentId && targetStudentId !== req.user.id && targetStudentId !== req.user.identifier) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SELF_ONLY',
      message: 'Students may only query or modify their own authenticated record'
    });
  }

  next();
};

