/**
 * Custom Error Classes
 * 
 * Each error carries an HTTP status code so the global error handler
 * can map it to the correct response without switch-case logic.
 */

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            error: {
                type: this.name,
                message: this.message,
            },
        };
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400);
    }
}

class InsufficientStockError extends AppError {
    constructor(message = 'Insufficient stock to complete this operation') {
        super(message, 409);
    }
}

class InvalidStatusTransitionError extends AppError {
    constructor(currentStatus, requestedStatus) {
        super(
            `Invalid status transition: cannot move from '${currentStatus}' to '${requestedStatus}'. ` +
            `Valid workflow: draft → ready → done.`
        );
        this.statusCode = 400;
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Access denied. Insufficient permissions.') {
        super(message, 403);
    }
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    InsufficientStockError,
    InvalidStatusTransitionError,
    UnauthorizedError,
    ForbiddenError,
};
