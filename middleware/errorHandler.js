/**
 * Global Error Handler Middleware
 * 
 * Catches all errors thrown/passed via next(err) and returns
 * structured JSON responses. Maps custom AppError subclasses
 * to appropriate HTTP status codes.
 */

const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, _next) {
    // Log the error in non-test environments
    if (process.env.NODE_ENV !== 'test') {
        console.error(`[Error] ${err.name}: ${err.message}`);
        if (!(err instanceof AppError)) {
            console.error(err.stack);
        }
    }

    // Custom application errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    // PostgreSQL specific errors
    if (err.code) {
        // Unique constraint violation
        if (err.code === '23505') {
            return res.status(409).json({
                success: false,
                error: {
                    type: 'ConflictError',
                    message: 'A record with this value already exists.',
                    detail: err.detail,
                },
            });
        }
        // Foreign key violation
        if (err.code === '23503') {
            return res.status(400).json({
                success: false,
                error: {
                    type: 'ReferenceError',
                    message: 'Referenced record does not exist.',
                    detail: err.detail,
                },
            });
        }
        // Check constraint violation
        if (err.code === '23514') {
            return res.status(400).json({
                success: false,
                error: {
                    type: 'ConstraintError',
                    message: 'Value violates a database constraint.',
                    detail: err.detail,
                },
            });
        }
    }

    // JSON parse errors
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: {
                type: 'ParseError',
                message: 'Invalid JSON in request body.',
            },
        });
    }

    // Catch-all for unknown errors
    return res.status(500).json({
        success: false,
        error: {
            type: 'InternalServerError',
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred.'
                : err.message,
        },
    });
}

module.exports = errorHandler;
