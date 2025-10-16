const pool = require("../config/database");

class Observation {
  /**
   * Create new observation
   */
  static async create(data) {
    const {
      userId,
      plantId,
      imageUrl,
      public: isPublic,
      latitude,
      longitude,
      observationDate,
      confidenceScore,
      status,
      verifiedBy = null,
    } = data;

    const query = `
      INSERT INTO PlantObservations 
      (user_id, plant_id, image_url, latitude, longitude, public, observation_date, confidence_score, status, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      userId,
      plantId || 31, // Assuming it is unidentified if not provided
      imageUrl,
      latitude,
      longitude,
      isPublic,
      observationDate,
      confidenceScore,
      status,
      verifiedBy,
    ]);

    return result.insertId;
  }

  /**
   * Find observation by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        o.*,
        u.username,
        u.email,
        u.role as user_role,
        v.username as verified_by_username
      FROM PlantObservations o
      LEFT JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN Users v ON o.verified_by = v.user_id
      WHERE o.observation_id = ?
    `;

    const [rows] = await pool.query(query, [id]);
    return rows[0];
  }

  /**
   * Find all observations with filters and pagination
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 10,
      plantId,
      status,
      userId,
      startDate,
      endDate,
      public: isPublic,
      conservationStatus,
    } = filters;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        o.observation_id,
        o.user_id,
        o.image_url,
        o.plant_id,
        o.confidence_score,
        o.latitude,
        o.longitude,
        o.status,
        o.observation_date,
        o.created_at,
        u.username,
        o.public,
        p.conservation_status
      FROM PlantObservations o
      LEFT JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN Plants p ON p.plant_id = o.plant_id
      WHERE 1=1
    `;

    const params = [];

    // Apply filters
    if (plantId) {
      query += ` AND o.plant_id = ?`;
      params.push(plantId);
    }

    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }

    if (userId) {
      query += ` AND o.user_id = ?`;
      params.push(userId);
    }

    if (startDate) {
      query += ` AND o.observation_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND o.observation_date <= ?`;
      params.push(endDate);
    }

    if (typeof isPublic !== 'undefined') {
      query += ` AND o.public = ?`;
      params.push(isPublic);
    }

    if (conservationStatus) {
      const consList = typeof conservationStatus === 'string'
        ? conservationStatus.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(conservationStatus) ? conservationStatus : [];
      if (consList.length > 0) {
        query += ` AND p.conservation_status IN (${consList.map(() => '?').join(',')})`;
        params.push(...consList);
      }
    }

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Count total observations (for pagination)
   */
  static async countAll(filters = {}) {
    const { plantId, status, userId, startDate, endDate, public: isPublic, conservationStatus } = filters;

    let query = `SELECT COUNT(*) as total FROM PlantObservations o LEFT JOIN Plants p ON p.plant_id = o.plant_id WHERE 1=1`;
    const params = [];

    if (plantId) {
      query += ` AND o.plant_id = ?`;
      params.push(plantId);
    }

    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }

    if (userId) {
      query += ` AND o.user_id = ?`;
      params.push(userId);
    }

    if (startDate) {
      query += ` AND o.observation_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND o.observation_date <= ?`;
      params.push(endDate);
    }

    if (typeof isPublic !== 'undefined') {
      query += ` AND o.public = ?`;
      params.push(isPublic);
    }

    if (conservationStatus) {
      const consList = typeof conservationStatus === 'string'
        ? conservationStatus.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(conservationStatus) ? conservationStatus : [];
      if (consList.length > 0) {
        query += ` AND p.conservation_status IN (${consList.map(() => '?').join(',')})`;
        params.push(...consList);
      }
    }

    const [rows] = await pool.query(query, params);
    return rows[0].total;
  }

  /**
   * Update observation
   */
  static async update(id, data) {
    const updates = [];
    const params = [];

    // Build dynamic update query
    if (data.plantId !== undefined) {
      updates.push("plant_id = ?");
      params.push(data.plantId);
    }

    if (data.confidenceScore !== undefined) {
      updates.push("confidence_score = ?");
      params.push(data.confidenceScore);
    }

    if (data.public !== undefined) {
      updates.push("public = ?");
      params.push(data.public);
    }

  
    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);
    }

    if (data.imageUrl !== undefined) {
      updates.push("image_url = ?");
      params.push(data.imageUrl);
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    const query = `UPDATE PlantObservations SET ${updates.join(", ")} WHERE observation_id = ?`;
    const [result] = await pool.query(query, params);

    return result.affectedRows > 0;
  }

  /**
   * Delete observation
   */
  static async delete(id) {
    const query = "DELETE FROM PlantObservations WHERE observation_id = ?";
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0;
  }


}

module.exports = Observation;
