const auditLogger = require('../logger/auditLogger');
const crypto = require('crypto');

// Express middleware to audit every request with response status and latency
module.exports = (req, res, next) => {
    const start = process.hrtime.bigint();
    const requestId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Attach id so downstream can use it
    req.requestId = requestId;

    // Capture user info if present from auth middleware
    const getUser = () => {
        const user = req.user || {};
        return {
            id: user.id || user.userId || null,
            username: user.username || user.email || null,
            role: user.role || null,
        };
    };

    // Log request start (minimal)
    auditLogger.info('request.received', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        user: getUser(),
    });

    // On response finish, log outcome
    res.on('finish', () => {
        const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
        auditLogger.info('request.completed', {
            requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs,
            ip: req.ip,
            user: getUser(),
        });
    });

    // Additional semantic events for auth endpoints
    if (req.method === 'POST' && /\/auth\/login/i.test(req.originalUrl)) {
        auditLogger.info('auth.login.attempt', {
            requestId,
            username: req.body?.username || req.body?.email || 'unknown',
            ip: req.ip,
        });
    }

    if (req.method === 'POST' && /\/auth\/logout/i.test(req.originalUrl)) {
        const user = getUser();
        auditLogger.info('auth.logout', { requestId, user, ip: req.ip });
    }

    next();
};
