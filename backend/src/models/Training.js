const pool = require('../config/database');

class Training {
  /**
   * Create new training session
   */
  static async create(triggeredBy, modelName = null) {
    const query = `
      INSERT INTO training_history (triggered_by, status, started_at, created_at, model_version)
      VALUES (?, 'pending', NOW(), NOW(), ?)
    `;
    const [result] = await pool.query(query, [triggeredBy, modelName]);
    return result.insertId;
  }

  /**
   * Update training status
   */
  static async updateStatus(id, status, data = {}) {
    const updates = ['status = ?'];
    const params = [status];

    if (data.numImages !== undefined) {
      updates.push('num_images = ?');
      params.push(data.numImages);
    }

    if (data.numSpecies !== undefined) {
      updates.push('num_species = ?');
      params.push(data.numSpecies);
    }

    if (data.trainingAccuracy !== undefined) {
      updates.push('training_accuracy = ?');
      params.push(data.trainingAccuracy);
    }

    if (data.validationAccuracy !== undefined) {
      updates.push('validation_accuracy = ?');
      params.push(data.validationAccuracy);
    }

    if (data.modelVersion !== undefined) {
      updates.push('model_version = ?');
      params.push(data.modelVersion);
    }

    if (data.errorMessage !== undefined) {
      updates.push('error_message = ?');
      params.push(data.errorMessage);
    }

    if (status === 'in_progress') {
      updates.push('started_at = NOW()');
    }

    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = NOW()');
    }

    params.push(id);

    const query = `UPDATE training_history SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(query, params);
  }

  /**
   * Get training by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        t.*,
        u.username as triggered_by_username
      FROM training_history t
      LEFT JOIN Users u ON t.triggered_by = u.id
      WHERE t.id = ?
    `;
    const [rows] = await pool.query(query, [id]);
    return rows[0];
  }

  /**
   * Get all training history
   */
  static async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        t.*,
        u.username as triggered_by_username
      FROM training_history t
      LEFT JOIN Users u ON t.triggered_by = u.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await pool.query(query, [limit, offset]);
    return rows;
  }

  /**
   * Get latest training
   */
  static async getLatest() {
    const query = `
      SELECT * FROM training_history 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const [rows] = await pool.query(query);
    return rows[0];
  }

  /**
   * Get verified observations for training
   */
  static async getVerifiedObservations() {
    const query = `
      SELECT 
        o.id,
        o.image_url,
        o.species,
        o.verified_by,
        u.username as verified_by_username
      FROM observations o
      LEFT JOIN Users u ON o.verified_by = u.id
      WHERE o.verified = TRUE 
        AND o.species IS NOT NULL
        AND o.species != 'Unknown'
      ORDER BY o.verified_at DESC
    `;
    
    const [rows] = await pool.query(query);
    return rows;
  }

  static async getActiveTraining() {
    const query = `
      SELECT 
        id,
        triggered_by as userId,
        model_version as modelName,
        status,
        started_at as startedAt,
        created_at as createdAt
      FROM training_history
      WHERE status IN ('pending', 'in-progress')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [rows] = await pool.query(query);
    return rows[0] || null;
  }

  /**
   * Count verified observations per species
   */
  static async getSpeciesCount() {
    const query = `
      SELECT 
        species,
        COUNT(*) as count
      FROM observations
      WHERE verified = TRUE 
        AND species IS NOT NULL
        AND species != 'Unknown'
      GROUP BY species
      ORDER BY count DESC
    `;
    
    const [rows] = await pool.query(query);
    return rows;
  }
}

module.exports = Training;