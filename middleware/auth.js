/**
 * Auth Middleware (Person 2 Integration Stub)
 * 
 * In the real system, Person 2 handles authentication.
 * This stub verifies JWT tokens and attaches user info to req.user.
 * Replace with Person 2's actual implementation during integration.
 */

const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'ims_dev_secret_key_2024';

/**
 * Middleware: Authenticate the request by verifying the JWT token.
 * Attaches `req.user` with { id, email, role }.
 */
function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('Missing or invalid Authorization header. Expected: Bearer <token>');
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
        };

        next();
    } catch (err) {
        if (err instanceof UnauthorizedError) {
            return next(err);
        }
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Invalid or expired token.'));
        }
        next(err);
    }
}

/**
 * Middleware factory: Restrict access to specific roles.
 * Usage: authorizeRoles('inventory_manager', 'warehouse_staff')
 * @param  {...string} roles - Allowed roles.
 */
function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required.'));
        }
        if (!roles.includes(req.user.role)) {
            return next(
                new ForbiddenError(
                    `Access denied. Role '${req.user.role}' is not authorized. Required: ${roles.join(' or ')}.`
                )
            );
        }
        next();
    };
}

/**
 * Generate a JWT token for a user (utility for testing / Person 2 stub).
 * @param {{ id: number, email: string, role: string }} user
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

module.exports = {
    authenticate,
    authorizeRoles,
    generateToken,
};
