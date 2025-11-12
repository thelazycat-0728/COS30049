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
        const { timestamp, level, message, ...meta } = info;
        const payload = { timestamp, level, message, ...meta };
        return JSON.stringify(payload);
    })
);

const auditLogger = createLogger({
    level: 'info',
    format: jsonFormat,
    transports: [
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

// --- Attach DB persistence hook (non-blocking) ---
try {
    const auditService = require('../services/auditService');
    const originalInfo = auditLogger.info.bind(auditLogger);

    auditLogger.info = function (message, meta = {}) {
        // Build enriched metadata for logs and DB persistence
        try {
            const m = meta && typeof meta === 'object' ? { ...meta } : {};

            // find id helper (checks only top-level keys to avoid picking up actor.user.id)
            const findId = (keys) => {
                for (const k of keys) {
                    if (Object.prototype.hasOwnProperty.call(m, k)) return m[k];
                }
                return undefined;
            };

            const possibleTargetIdKeys = ['target_id', 'targetId', 'plant_id', 'plantId', 'observation_id', 'observationId', 'sensor_id', 'sensorId', 'user_id', 'userId', 'id', 'record_id', 'recordId', 'targetUserId'];
            const rawTargetId = findId(possibleTargetIdKeys);
            // avoid accidentally using user.id as target id; require explicit target keys like plant_id, target_id, etc.
            const target_id = rawTargetId !== undefined && rawTargetId !== null ? Number(rawTargetId) || 0 : 0;

            // Derive table name heuristically
            let target_table = '';
            if (m.target_table) target_table = m.target_table;
            else if (m.targetTable) target_table = m.targetTable;
            else if (findId(['plant_id', 'plantId'])) target_table = 'Plants';
            else if (findId(['observation_id', 'observationId'])) target_table = 'PlantObservations';
            else if (findId(['sensor_id', 'sensorId'])) target_table = 'IoTSensors';
            else if (findId(['user_id', 'userId', 'targetUserId'])) target_table = 'Users';

            // Ensure user is present in meta for file logs (use actor if available)
            if (!m.user && m.actor) m.user = m.actor;

            // action_time: use provided or server time (formatted) so DB gets accurate timestamp
            const formattedNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const action_time = m.action_time || formattedNow;

            // enrich meta so file logs include these fields
            const enrichedMeta = { ...m, target_table, target_id, action_time };

            // Call original logger with enriched meta (so file logs contain fields)
            try {
                originalInfo(message, enrichedMeta);
            } catch (e) {
                console.error('auditLogger console write failed:', e && e.message ? e.message : e);
            }

            // Prepare record for DB persistence
            const record = {
                action: message,
                action_time,
                target_table,
                target_id,
                user_id: (m.user && (m.user.id || m.user.user_id)) || (m.actor && (m.actor.id || m.actor.user_id)) || 0,
            };

            // Persist asynchronously, do not await
            auditService.insertAudit(record).catch(() => { });
        } catch (e) {
            console.error('auditLogger DB hook failed:', e && e.message ? e.message : e);
            // fallback to original write if enrichment failed
            try { originalInfo(message, meta); } catch (_) { /* ignore */ }
        }
    };
} catch (e) {
    console.warn('Audit DB persistence disabled:', e && e.message ? e.message : e);
}
