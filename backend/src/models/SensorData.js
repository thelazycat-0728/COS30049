const pool = require("../config/database");

class SensorData {
  /**
   * Get sensor data with pagination
   */
  static async findBySensorId(sensorId, limit = 100, offset = 0) {
    const query = `
      SELECT 
        s.reading_id as id,
        s.reading_type as readingType,
        s.reading_value as readingValue,
        s.reading_time as readingTime
      FROM SensorReadings s
      WHERE s.sensor_id = ?
      ORDER BY s.reading_time DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [sensorId, limit, offset]);

    return rows;
  }

  /**
   * Get latest sensor data
   */
  static async findLatest(sensorId, limit = 1) {
    const query = `
      SELECT 
        s.reading_id as id,
        s.reading_type as readingType,
        s.reading_value as readingValue,
        s.reading_time as readingTime
      FROM SensorReadings s
      WHERE s.sensor_id = ?
      ORDER BY s.reading_time DESC
      LIMIT ? 
    `;

    const [row] = await pool.query(query, [sensorId, limit]);

    return row;
  
  }

  /**
   * Get sensor data within time range
   */
  static async findByTimeRange(sensorId, startTime, endTime, limit = 1000) {
    const query = `
      SELECT 
         s.reading_id as id,
        s.reading_type as readingType,
        s.reading_value as readingValue,
        s.reading_time as readingTime
      FROM SensorReadings s
      WHERE s.sensor_id = ? AND s.reading_time BETWEEN ? AND ?
      ORDER BY s.reading_time DESC
      LIMIT ? 
    `;

    const [rows] = await pool.query(query, [
      sensorId,
      startTime,
      endTime,
      limit,
    ]);

    return rows;

  }
  /**
   * Delete old data (cleanup)
   */
  static async deleteOlderThan(days = 90) {
    const query = `
      DELETE FROM sensor_data
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [result] = await pool.query(query, [days]);
    return result.affectedRows;
  }
}

module.exports = SensorData;
