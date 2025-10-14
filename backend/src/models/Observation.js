const pool = require('../config/database');

class Observation {
  /**
   * Create new observation
   */
  static async create(data) {
    const {
      userId,
      plantId,
      imageUrl,
      latitude,
      longtitude,
      observationDate,
      confidenceScore,
      status,
      verifiedBy = null
    } = data;

    const query = `
      INSERT INTO PlantObservations 
      (user_id, plant_id, image_url, latitude, longitude, observation_date, confidence_score, status, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      userId,
      plantId || 31, // Assuming it is unidentified if not provided
      imageUrl,
      latitude,
      longtitude,
      observationDate,
      confidenceScore,
      status,
      verifiedBy
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
      species,
      conservationStatus,
      verified,
      flagged,
      userId,
      startDate,
      endDate
    } = filters;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        o.id,
        o.user_id,
        o.image_url,
        o.species,
        o.confidence,
        o.gps_lat,
        o.gps_lng,
        o.conservation_status,
        o.verified,
        o.flagged,
        o.observation_date,
        o.created_at,
        u.username
      FROM observations o
      LEFT JOIN Users u ON o.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Apply filters
    if (species) {
      query += ` AND o.species LIKE ?`;
      params.push(`%${species}%`);
    }

    if (conservationStatus) {
      query += ` AND o.conservation_status = ?`;
      params.push(conservationStatus);
    }

    if (verified !== undefined) {
      query += ` AND o.verified = ?`;
      params.push(verified ? 1 : 0);
    }

    if (flagged !== undefined) {
      query += ` AND o.flagged = ?`;
      params.push(flagged ? 1 : 0);
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

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Count total observations (for pagination)
   */
  static async countAll(filters = {}) {
    const { species, conservationStatus, verified, flagged, userId } = filters;

    let query = `SELECT COUNT(*) as total FROM observations WHERE 1=1`;
    const params = [];

    if (species) {
      query += ` AND species LIKE ?`;
      params.push(`%${species}%`);
    }

    if (conservationStatus) {
      query += ` AND conservation_status = ?`;
      params.push(conservationStatus);
    }

    if (verified !== undefined) {
      query += ` AND verified = ?`;
      params.push(verified ? 1 : 0);
    }

    if (flagged !== undefined) {
      query += ` AND flagged = ?`;
      params.push(flagged ? 1 : 0);
    }

    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
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
    if (data.species !== undefined) {
      updates.push('species = ?');
      params.push(data.species);
    }

    if (data.confidence !== undefined) {
      updates.push('confidence = ?');
      params.push(data.confidence);
    }

    if (data.conservationStatus !== undefined) {
      updates.push('conservation_status = ?');
      params.push(data.conservationStatus);
    }

    if (data.verified !== undefined) {
      updates.push('verified = ?');
      params.push(data.verified ? 1 : 0);
    }

    if (data.verifiedBy !== undefined) {
      updates.push('verified_by = ?');
      params.push(data.verifiedBy);
    }

    if (data.verified === true) {
      updates.push('verified_at = NOW()');
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `UPDATE observations SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await pool.query(query, params);

    return result.affectedRows > 0;
  }

  /**
   * Delete observation
   */
  static async delete(id) {
    const query = 'DELETE FROM observations WHERE id = ?';
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0;
  }

  /**
   * Flag observation for review
   */
  static async flag(id, userId, reason) {
    const query = `
      UPDATE observations 
      SET flagged = TRUE, updated_at = NOW()
      WHERE id = ?
    `;

    await pool.query(query, [id]);

    // Optionally: Create a flag record for tracking
    const flagQuery = `
      INSERT INTO observation_flags (observation_id, flagged_by, reason, created_at)
      VALUES (?, ?, ?, NOW())
    `;

    try {
      await pool.query(flagQuery, [id, userId, reason]);
    } catch (error) {
      // Table might not exist yet, that's okay
      console.log('Flag record not created (table may not exist)');
    }

    return true;
  }

  /**
   * Unflag observation
   */
  static async unflag(id) {
    const query = `
      UPDATE observations 
      SET flagged = FALSE, updated_at = NOW()
      WHERE id = ?
    `;

    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Observation;