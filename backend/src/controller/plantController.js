const pool = require('../config/database');

// Allowed conservation status values
const CONSERVATION_STATUSES = [
  'least_concern',
  'near_threatened',
  'vulnerable',
  'endangered',
  'critically_endangered'
];

class PlantController {
  static async getAll(req, res) {
    try {
      const [rows] = await pool.execute(
        `SELECT plant_id, scientific_name, species, common_name, family, description, conservation_status, created_at, updated_at
         FROM Plants
         ORDER BY created_at DESC`
      );
      res.json({ success: true, plants: rows });
    } catch (err) {
      console.error('Error fetching plants:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch plants' });
    }
  }

  static async getById(req, res) {
    try {
      const id = req.params.plant_id;
      const [rows] = await pool.execute('SELECT * FROM Plants WHERE plant_id = ?', [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Plant not found' });
      }
      res.json({ success: true, plant: rows[0] });
    } catch (err) {
      console.error('Error fetching plant by id:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch plant' });
    }
  }

  static async create(req, res) {
    try {
      const {
        scientific_name = null,
        species = null,
        common_name = null,
        family = null,
        description = null,
        conservation_status = null,
      } = req.body || {};

      if (!common_name || !scientific_name) {
        return res.status(400).json({ success: false, error: 'common_name and scientific_name are required' });
      }
      if (conservation_status && !CONSERVATION_STATUSES.includes(conservation_status)) {
        return res.status(400).json({ success: false, error: 'Invalid conservation_status' });
      }

      const [result] = await pool.execute(
        `INSERT INTO Plants (scientific_name, species, common_name, family, description, conservation_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [scientific_name, species, common_name, family, description, conservation_status]
      );
      const insertId = result.insertId;
      const [rows] = await pool.execute('SELECT * FROM Plants WHERE plant_id = ?', [insertId]);
      res.status(201).json({ success: true, plant: rows[0] });
    } catch (err) {
      console.error('Error creating plant:', err);
      res.status(500).json({ success: false, error: 'Failed to create plant' });
    }
  }

  static async update(req, res) {
    try {
      const id = req.params.plant_id;
      const {
        scientific_name,
        species,
        common_name,
        family,
        description,
        conservation_status,
      } = req.body || {};

      if (conservation_status && !CONSERVATION_STATUSES.includes(conservation_status)) {
        return res.status(400).json({ success: false, error: 'Invalid conservation_status' });
      }

      const fields = [];
      const params = [];
      if (scientific_name !== undefined) { fields.push('scientific_name = ?'); params.push(scientific_name); }
      if (species !== undefined) { fields.push('species = ?'); params.push(species); }
      if (common_name !== undefined) { fields.push('common_name = ?'); params.push(common_name); }
      if (family !== undefined) { fields.push('family = ?'); params.push(family); }
      if (description !== undefined) { fields.push('description = ?'); params.push(description); }
      if (conservation_status !== undefined) { fields.push('conservation_status = ?'); params.push(conservation_status); }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      fields.push('updated_at = NOW()');
      const sql = `UPDATE Plants SET ${fields.join(', ')} WHERE plant_id = ?`;
      params.push(id);
      const [result] = await pool.execute(sql, params);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Plant not found' });
      }
      const [rows] = await pool.execute('SELECT * FROM Plants WHERE plant_id = ?', [id]);
      res.json({ success: true, plant: rows[0] });
    } catch (err) {
      console.error('Error updating plant:', err);
      res.status(500).json({ success: false, error: 'Failed to update plant' });
    }
  }

  static async delete(req, res) {
    try {
      const id = req.params.plant_id;
      const [result] = await pool.execute('DELETE FROM Plants WHERE plant_id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Plant not found' });
      }
      res.json({ success: true, deleted_id: Number(id) });
    } catch (err) {
      console.error('Error deleting plant:', err);
      let message = 'Failed to delete plant';
      if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
        message = 'Cannot delete plant with existing observations';
      }
      res.status(500).json({ success: false, error: message });
    }
  }
}

module.exports = PlantController;