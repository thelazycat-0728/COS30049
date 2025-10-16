const pool = require('../config/database');

class Sensor {
  /**
   * Register a new sensor
   */
  static async create(name, location, status = 'active') {
    const query = `
      INSERT INTO IoTSensors (sensor_name, location_description, status, last_checked, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW(), NOW())
    `;

    try {
      const [result] = await pool.query(query, [
        name,
        location,
        status
      ]);

      return await this.findBySensorId(result.insertId);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Sensor with this ID already exists');
      }
      throw error;
    }
  }

  /**
   * Find sensor by sensor_id
   */
  static async findBySensorId(sensorId) {
    const query = `
      SELECT 
        *
      FROM IoTSensors
      WHERE sensor_id = ?
    `;

    const [rows] = await pool.query(query, [sensorId]);

    if (rows.length === 0) {
      return null;
    }

    const sensor = rows[0];
    
    return sensor;
  }


  /**
   * Get all sensors (admin/expert)
   */
  static async findAll(limit = 100, offset = 0) {
    const query = `
      SELECT 
        s.sensor_id as sensorId,
        s.sensor_name as name,
        s.location_description as location,
        s.status as status,
        s.last_checked as lastChecked,
        s.created_at as createdAt,
        s.updated_at as updatedAt
      FROM IoTSensors s
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [limit, offset]);

    return rows;
  }

  /**
   * Update sensor's last data timestamp
   */
  static async update(data, sensorId) {
    const updates = [];
    const params = [];

    // Build dynamic update query
    if (data.name !== undefined) {
      updates.push("sensor_name = ?");
      params.push(data.name);
    }

    if (data.location !== undefined) {
      updates.push("location_description = ?");
      params.push(data.location);
    }

    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);
    }


    updates.push("updated_at = NOW()");
    params.push(sensorId);

    const query = `UPDATE IoTSensors SET ${updates.join(", ")} WHERE sensor_id = ?`;
    const [result] = await pool.query(query, params);

    return result.affectedRows > 0;
  }

  /**
   * Delete sensor
   */
  static async delete(sensorId) {
    const query = `DELETE FROM IoTSensors WHERE sensor_id = ?`;
    await pool.query(query, [sensorId]);
  }
}

module.exports = Sensor;