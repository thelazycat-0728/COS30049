const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Common JSON format for structured logs
const jsonFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.printf((info) => {
        // Keep message as string but include metadata as JSON
        const { timestamp, level, message, ...meta } = info;
        const payload = { timestamp, level, message, ...meta };
        return JSON.stringify(payload);
    })
);

const auditLogger = createLogger({
    level: 'info',
    format: jsonFormat,
    transports: [
        // Daily rotation, keep 7 days; create a symlink "audit.log" to current file for easy access
        new DailyRotateFile({
            dirname: logDir,
            filename: 'audit-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxFiles: '7d',
            maxSize: '20m',
            level: 'info',
            createSymlink: true,
            symlinkName: 'audit.log',
        }),
    ],
    exitOnError: false,
});

// Also log to console in non-production for local visibility
if (process.env.NODE_ENV !== 'production') {
    auditLogger.add(
        new transports.Console({
            level: 'debug',
            format: format.combine(
                format.colorize(),
                format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                format.printf((info) => {
                    const { timestamp, level, message, ...meta } = info;
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} ${level}: ${message}${metaStr}`;
                })
            ),
        })
    );
}

module.exports = auditLogger;
