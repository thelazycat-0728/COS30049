const auditLogger = require('../logger/auditLogger');

// Centralized error logging middleware for Express
// Must be registered after all routes
module.exports = (err, req, res, next) => {
    try {
        const payload = {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: err.status || err.statusCode || 500,
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
            ip: req.ip,
            user: req.user
                ? { id: req.user.id || req.user.userId, username: req.user.username || req.user.email, role: req.user.role }
                : null,
        };

        auditLogger.error('request.error', payload);
    } catch (_) {
        // noop
    }

    // Respond
    const status = err.status || err.statusCode || 500;
    if (res.headersSent) return next(err);
    res.status(status).json({ error: true, message: err.message || 'Internal Server Error' });
};
