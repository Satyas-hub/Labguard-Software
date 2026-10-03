"use strict";
// ============================================================================
// LABGUARD V2: Express Request Validation Middleware using Zod
// Standardizes HTTP 400 rejection on schema violations and payload tampering.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateBody = void 0;
const zod_1 = require("zod");
const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid request payload: Schema constraints violated',
                    details: err.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            }
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Malformed request payload structure'
            });
        }
    };
};
exports.validateBody = validateBody;
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters: Schema constraints violated',
                    details: err.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            }
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Malformed query parameter structure'
            });
        }
    };
};
exports.validateQuery = validateQuery;
