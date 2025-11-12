const pool = require('../config/database');

/**
 * Simple audit service that persists audit records to the AuditLogs table.
 * Exposes insertAudit(record) which returns a Promise that resolves to the insertId.
 */
async function insertAudit(record = {}) {
    try {
        const action = record.action || '';
        const action_time = record.action_time || new Date().toISOString().slice(0, 19).replace('T', ' ');
        const target_table = record.target_table || '';
        const target_id = Number(record.target_id) || 0;
        const user_id = Number(record.user_id) || 0;

        const sql = `INSERT INTO AuditLogs (user_id, action, target_table, target_id, action_time) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await pool.execute(sql, [user_id, action, target_table, target_id, action_time]);

        // return insertId for callers that may want it
        return result.insertId;
    } catch (error) {
        // Surface the error to the caller so the audit hook can decide what to do (it swallows failures)
        console.error('AuditService.insertAudit error:', error && error.message ? error.message : error);
        throw error;
    }
}

module.exports = {
    insertAudit,
};
