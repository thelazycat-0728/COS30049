const pool = require('../config/database');

class IoTAlert {
  /**
   * Create a new alert
   */
  static async create(sensorId, level, message, payload = null) {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const query = `
      INSERT INTO iot_alerts (
        alert_id,
        sensor_id,
        level,
        message,
        payload
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.query(query, [
        alertId,
        sensorId,
        level,
        message,
        payload ? JSON.stringify(payload) : null
      ]);

      return await this.findByAlertId(alertId);
    } catch (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * Find alert by alert_id
   */
  static async findByAlertId(alertId) {
    const query = `
      SELECT 
        a.alert_id as alertId,
        a.sensor_id as sensorId,
        s.sensor_name as sensorName,
        s.location_description as sensorLocation,
        a.alert_type as alertType,
        a.severity,
        a.score,
        a.description,
        a.resolved,
        a.created_at as createdAt
      FROM Alerts a
      LEFT JOIN IoTSensors s ON a.sensor_id = s.sensor_id
      WHERE a.alert_id = ?
    `;

    const [rows] = await pool.query(query, alertId);

    if (rows.length === 0) {
      return null;
    }

    const alert = rows[0];
    
    return alert;
  }

  /**
   * Get all alerts with filters
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT 
       a.alert_id as alertId,
        a.sensor_id as sensorId,
        s.sensor_name as sensorName,
        s.location_description as sensorLocation,
        a.alert_type as alertType,
        a.severity,
        a.score,
        a.description,
        a.resolved,
        a.created_at as createdAt
      FROM Alerts a
      LEFT JOIN IoTSensors s ON a.sensor_id = s.sensor_id
      WHERE 1=1
    `;

    const params = [];

    // Filter by sensor
    if (filters.sensorId) {
      query += ` AND a.sensor_id = ?`;
      params.push(filters.sensorId);
    }

    // Filter by level
    if (filters.severity) {
      query += ` AND a.severity = ?`;
      params.push(filters.severity);
    }

    // Filter by resolved status
    if (filters.resolved !== undefined) {
      query += ` AND a.resolved = ?`;
      params.push(filters.resolved ? 1 : 0);
    }

    if (filters.alertType !== undefined) {
      query += ` AND a.alert_type = ?`;
      params.push(filters.alertType);
    }

    query += ` ORDER BY a.created_at DESC`;

    // Pagination
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }

    const [rows] = await pool.query(query, params);

    return rows;
  }

 
  /**
   * Resolve an alert
   */
  static async resolve(alertId) {
    const query = `
      UPDATE Alerts
      SET 
        resolved = TRUE
      WHERE alert_id = ?
    `;

    await pool.query(query, alertId);
    return await this.findByAlertId(alertId);
  }

  /**
   * Delete old resolved alerts
   */
  static async deleteOldResolved(days = 30) {
    const query = `
      DELETE FROM iot_alerts
      WHERE resolved = TRUE
        AND resolved_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [result] = await pool.query(query, [days]);
    return result.affectedRows;
  }
}

module.exports = IoTAlert;