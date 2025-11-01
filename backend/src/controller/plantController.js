const pool = require('../config/database');
const StorageService = require('../services/storageService');

// Allowed conservation status values
const CONSERVATION_STATUSES = [
  'least_concern',
  'near_threatened',
  'vulnerable',
  'endangered',
  'critically_endangered'
];

// Field name mapping for user-friendly error messages
const FIELD_NAMES = {
  common_name: 'Plant Name',
  scientific_name: 'Scientific Name',
  species: 'Species',
  family: 'Family',
  description: 'Description',
  conservation_status: 'Conservation Status',
  image_url: 'Image'
};

class PlantController {
  static async getAll(req, res) {
    try {
      // Parse pagination params: support limit/offset or page/size
      const sizeQ = req.query.limit ?? req.query.size;
      const pageQ = req.query.page;
      const offsetQ = req.query.offset;

      let size = Number(sizeQ);
      if (!Number.isFinite(size) || size <= 0) size = 10;
      if (size > 100) size = 100;

      let offset = Number(offsetQ);
      if (!Number.isFinite(offset) || offset < 0) {
        const pageNum = Number(pageQ);
        if (Number.isFinite(pageNum) && pageNum > 0) offset = (pageNum - 1) * size; else offset = 0;
      }

      // Parse filter, sort, and search parameters
      const search = req.query.search || '';
      const conservation_status = req.query.conservation_status || '';
      const sortBy = req.query.sortBy || 'created_at';
      const sortOrder = req.query.sortOrder || 'DESC';

      // Validate sort parameters
      const allowedSortFields = ['common_name', 'scientific_name', 'family', 'conservation_status', 'created_at', 'updated_at'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const finalSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Build WHERE clause for filters
      let whereConditions = [];
      let queryParams = [];

      if (search) {
        whereConditions.push(`(common_name LIKE ? OR scientific_name LIKE ? OR family LIKE ? OR description LIKE ?)`);
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (conservation_status) {
        whereConditions.push('conservation_status = ?');
        queryParams.push(conservation_status);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query total count with filters
      const countQuery = `SELECT COUNT(*) AS total FROM Plants ${whereClause}`;
      const [[countRow]] = await pool.execute(countQuery, queryParams);
      const total = countRow?.total ?? 0;

      // Fetch current page with filters and sorting
      const dataQuery = `
        SELECT plant_id, scientific_name, species, common_name, family, description, conservation_status, image_url, created_at, updated_at
        FROM Plants
        ${whereClause}
        ORDER BY ${finalSortBy} ${finalSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const dataParams = [...queryParams, size, offset];
      const [rows] = await pool.execute(dataQuery, dataParams);

      // Derive page index if not provided
      const currentPage = Number.isFinite(Number(pageQ)) && Number(pageQ) > 0 ? Number(pageQ) : Math.floor(offset / size) + 1;

      res.json({ 
        success: true, 
        plants: rows, 
        total, 
        page: currentPage, 
        size,
        filters: {
          conservation_statuses: CONSERVATION_STATUSES
        }
      });
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

      // Check for required fields one at a time with user-friendly names
      if (!common_name || common_name.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.common_name} is required` 
        });
      }

      if (!scientific_name || scientific_name.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.scientific_name} is required` 
        });
      }

      if (!species || species.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.species} is required` 
        });
      }

      if (!description || description.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.description} is required` 
        });
      }

      if (!family || family.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.family} is required` 
        });
      }

      if (!conservation_status || conservation_status.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.conservation_status} is required` 
        });
      }

      if (conservation_status && conservation_status.trim() !== '' && !CONSERVATION_STATUSES.includes(conservation_status)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid ${FIELD_NAMES.conservation_status.toLowerCase()}. Must be one of: ${CONSERVATION_STATUSES.join(', ')}` 
        });
      }

      // Handle image upload if provided
      let imageUrl = null;
      if (req.file) {
        try {
          imageUrl = await StorageService.uploadImage(req.file);
        } catch (e) {
          console.error('Image upload failed:', e);
          return res.status(500).json({ success: false, error: 'Failed to upload image' });
        }
      }

      if (!imageUrl || imageUrl.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          error: `An image is required` 
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO Plants (scientific_name, species, common_name, family, description, conservation_status, image_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          scientific_name && scientific_name.trim() !== '' ? scientific_name.trim() : null,
          species && species.trim() !== '' ? species.trim() : null,
          common_name.trim(),
          family && family.trim() !== '' ? family.trim() : null,
          description && description.trim() !== '' ? description.trim() : null,
          conservation_status && conservation_status.trim() !== '' ? conservation_status : null,
          imageUrl
        ]
      );
      const insertId = result.insertId;
      const [rows] = await pool.execute('SELECT * FROM Plants WHERE plant_id = ?', [insertId]);
      res.status(201).json({ success: true, plant: rows[0] });
    } catch (err) {
      console.error('Error creating plant:', err);
      
      // Provide more specific error messages for common database errors
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ 
          success: false, 
          error: 'A plant with this name or scientific name already exists' 
        });
      }
      
      res.status(500).json({ success: false, error: 'Failed to create plant due to server error' });
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

      // Check if plant exists
      const [existingRows] = await pool.execute('SELECT * FROM Plants WHERE plant_id = ?', [id]);
      if (!existingRows || existingRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Plant not found' });
      }

      // Validate required fields one at a time with user-friendly names
      if (common_name !== undefined && (!common_name || common_name.trim() === '')) {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.common_name} cannot be empty` 
        });
      }

      if (scientific_name !== undefined && (!scientific_name || scientific_name.trim() === '')) {
        return res.status(400).json({ 
          success: false, 
          error: `${FIELD_NAMES.scientific_name} cannot be empty` 
        });
      }

      if (conservation_status && !CONSERVATION_STATUSES.includes(conservation_status)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid ${FIELD_NAMES.conservation_status.toLowerCase()}. Must be one of: ${CONSERVATION_STATUSES.join(', ')}` 
        });
      }

      const fields = [];
      const params = [];
      
      if (scientific_name !== undefined) { 
        fields.push('scientific_name = ?'); 
        params.push(scientific_name.trim()); 
      }
      if (species !== undefined) { 
        fields.push('species = ?'); 
        params.push(species && species.trim() !== '' ? species.trim() : null); 
      }
      if (common_name !== undefined) { 
        fields.push('common_name = ?'); 
        params.push(common_name.trim()); 
      }
      if (family !== undefined) { 
        fields.push('family = ?'); 
        params.push(family && family.trim() !== '' ? family.trim() : null); 
      }
      if (description !== undefined) { 
        fields.push('description = ?'); 
        params.push(description && description.trim() !== '' ? description.trim() : null); 
      }
      if (conservation_status !== undefined) { 
        fields.push('conservation_status = ?'); 
        params.push(conservation_status && conservation_status.trim() !== '' ? conservation_status : null); 
      }

      // Handle image upload if provided
      let newImageUrl;
      if (req.file) {
        try {
          // Get current image to delete later
          const oldImageUrl = existingRows[0].image_url;

          newImageUrl = await StorageService.uploadImage(req.file);
          fields.push('image_url = ?');
          params.push(newImageUrl);

          // Delete old image file if exists
          if (oldImageUrl) {
            try { 
              await StorageService.deleteImage(oldImageUrl); 
            } catch (e) { 
              console.warn('Failed to delete old image:', e.message); 
            }
          }
        } catch (e) {
          console.error('Image upload failed:', e);
          return res.status(500).json({ success: false, error: 'Failed to upload image' });
        }
      }

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
      
      // Provide more specific error messages for common database errors
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ 
          success: false, 
          error: 'A plant with this name or scientific name already exists' 
        });
      }
      
      res.status(500).json({ success: false, error: 'Failed to update plant due to server error' });
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
      let message = 'Failed to delete plant due to server error';
      if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
        message = 'Cannot delete plant with existing observations';
      }
      res.status(500).json({ success: false, error: message });
    }
  }
}

module.exports = PlantController;