const Observation = require("../models/Observation");
const pool = require("../config/database");
const StorageService = require("../services/storageService");

class ObservationController {
  /**
   * GET /api/observations
   * Get all observations with filters
   */
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        plantId,
        status,
        userId,
        start_date,
        end_date,
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status,
        plantId: plantId,
        userId: userId,
        startDate: start_date,
        endDate: end_date,
      };

      // Get observations
      let observations = await Observation.findAll(filters);

      // Get total count
      const total = await Observation.countAll(filters);

      

      res.json({
        success: true,
        observations,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      });
    } catch (error) {
      console.error("Get observations error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch observations",
      });
    }
  }

  /**
   * GET /api/observations/:id
   * Get single observation
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const observation = await Observation.findById(id);

      if (!observation) {
        return res.status(404).json({
          success: false,
          error: "Observation not found",
        });
      }

      

      res.json({
        success: true,
        observation,
      });
    } catch (error) {
      console.error("Get observation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch observation",
      });
    }
  }

  /**
   * POST /api/observations
   * Create new observation
   */
  static async create(req, res) {
    try {
      const { public: isPublic, latitude, longitude, plantId, observationDate, status } =
        req.body;
      const userId = req.user.id;

      // Upload image
      let imageUrl;
      try {
        imageUrl = await StorageService.uploadImage(req.file);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Failed to upload image",
        });
      }

      // Get AI prediction (demo: no external AI call)
      const aiResult = { species: "Hibiscus", confidence: 0.12, alternatives: [] };

      // Create observation
      const observationId = await Observation.create({
        userId,
        plantId,
        imageUrl,
        public: isPublic,
        latitude,
        longitude,
        observationDate: observationDate || new Date(),
        confidenceScore: aiResult.confidence,
        status: "pending",
      });

      // Get created observation
      const observation = await Observation.findById(observationId);

      res.status(201).json({
        success: true,
        message: "Observation created successfully",
        observation,
        ai_prediction: {
          species: aiResult.species,
          confidence: aiResult.confidence,
          alternatives: aiResult.alternatives,
        },
      });
    } catch (error) {
      console.error("Create observation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create observation",
      });
    }
  }

  /**
   * PUT /api/observations/:id
   * Update observation (admin only)
   */
  static async update(req, res) {
    try {
      // Enforce admin/expert role for update operations
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'expert')) {
        return res.status(403).json({ success: false, error: 'Admin or expert role required' });
      }
      const { id } = req.params;

      let imageUrl;

      if (req.file) {
        // Upload new image

        try {
          imageUrl = await StorageService.uploadImage(req.file);
          req.body.imageUrl = imageUrl;
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: "Failed to upload new image",
          });
        }
      }

      if (!req.body) {
        return res.status(400).json({
          success: false,
          error: "No fields to update",
        });
      }

      const { plantId, confidenceScore, status, public: isPublic } = req.body;
 
      // Check if observation exists
      const observation = await Observation.findById(id);
      if (!observation) {
        return res.status(404).json({
          success: false,
          error: "Observation not found",
        });
      }

      const publicValue = (isPublic === 1 || isPublic === '1' || isPublic === true)
        ? 1
        : (isPublic === 0 || isPublic === '0' || isPublic === false)
          ? 0
          : undefined;

      // Update observation
      const updateData = {
        confidenceScore: confidenceScore
          ? parseFloat(confidenceScore)
          : undefined,
        plantId: plantId ? parseInt(plantId) : undefined,
        status,
        imageUrl: imageUrl || undefined,
        public: publicValue,
      };

      const success = await Observation.update(id, updateData);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: "No fields to update",
        });
      }

      // Get updated observation
      const updatedObservation = await Observation.findById(id);

      res.json({
        success: true,
        message: "Observation updated successfully",
        observation: updatedObservation,
      });
    } catch (error) {
      console.error("Update observation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update observation",
      });
    }
  }

  /**
   * DELETE /api/observations/:id
   * Delete observation (admin only)
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if observation exists
      const observation = await Observation.findById(id);
      if (!observation) {
        return res.status(404).json({
          success: false,
          error: "Observation not found",
        });
      }

      // Check ownership or admin/expert
      if (observation.user_id !== req.user.user_id && req.user.role !== "admin" && req.user.role !== "expert") {
        return res.status(403).json({
          success: false,
          error: "You can only delete your own observations",
        });
      }

      // Delete image from storage
      if (observation.image_url) {
        await StorageService.deleteImage(observation.image_url);
      }

      // Delete observation
      await Observation.delete(id);

      res.json({
        success: true,
        message: "Observation deleted successfully",
      });
    } catch (error) {
      console.error("Delete observation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete observation",
      });
    }
  }

  /**
   * PATCH /observations/:id/public
   * Toggle public mask for an observation (admin only)
   */
  static async togglePublic(req, res) {
    try {
      // Enforce admin/expert role
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'expert')) {
        return res.status(403).json({ success: false, error: 'Admin or expert role required' });
      }
      const id = parseInt(req.params.id, 10);
      const { public: pub } = req.body || {};
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, error: 'Invalid observation id' });
      }
      // Accept boolean or 0/1 strings/numbers
      const newVal = (pub === true || pub === '1' || pub === 1) ? 1 : (pub === false || pub === '0' || pub === 0) ? 0 : null;
      if (newVal == null) {
        return res.status(400).json({ success: false, error: 'public must be true/false or 1/0' });
      }
      const [result] = await pool.execute(
        'UPDATE PlantObservations SET public = ?, updated_at = NOW() WHERE observation_id = ?',
        [newVal, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Observation not found' });
      }
      return res.json({ success: true, observation_id: id, public: !!newVal });
    } catch (err) {
      console.error('Error updating public flag:', err);
      res.status(500).json({ success: false, error: 'Failed to update public flag' });
    }
  }

  /**
   * PATCH /observations/:id/geotag
   * Update latitude/longitude for a specific observation (admin only)
   */
  static async updateGeotag(req, res) {
    try {
      // Enforce admin/expert role
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'expert')) {
        return res.status(403).json({ success: false, error: 'Admin or expert role required' });
      }
      const id = parseInt(req.params.id, 10);
      const { latitude, longitude } = req.body || {};
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, error: 'Invalid observation id' });
      }

      if (latitude == null || longitude == null) {
        return res.status(400).json({ success: false, error: 'latitude and longitude are required' });
      }
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ success: false, error: 'latitude/longitude must be numeric' });
      }
      if (lat < -90 || lat > 90) {
        return res.status(400).json({ success: false, error: 'latitude must be between -90 and 90' });
      }
      if (lon < -180 || lon > 180) {
        return res.status(400).json({ success: false, error: 'longitude must be between -180 and 180' });
      }

      const [result] = await pool.execute(
        'UPDATE PlantObservations SET latitude = ?, longitude = ?, updated_at = NOW() WHERE observation_id = ?',
        [lat, lon, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Observation not found' });
      }

      const [rows] = await pool.execute(
        `SELECT po.observation_id, po.latitude, po.longitude, po.status, po.observation_date, po.image_url,
                p.plant_id, p.common_name, p.scientific_name, p.family, p.description, p.conservation_status
         FROM PlantObservations po JOIN Plants p ON p.plant_id = po.plant_id
         WHERE po.observation_id = ?`,
        [id]
      );
      const r = rows[0];
      return res.json({
        success: true,
        observation: r ? {
          observation_id: r.observation_id,
          latitude: r.latitude,
          longitude: r.longitude,
          status: r.status,
          observation_date: r.observation_date,
          image_url: r.image_url,
          plant: {
            plant_id: r.plant_id,
            common_name: r.common_name,
            scientific_name: r.scientific_name,
            family: r.family,
            description: r.description,
            conservation_status: r.conservation_status,
          }
        } : null
      });
    } catch (err) {
      console.error('Error updating geotag:', err);
      res.status(500).json({ success: false, error: 'Failed to update geotag' });
    }
  }

  /**
   * DELETE /observations/:id/geotag
   * Remove latitude/longitude for a specific observation (admin only)
   */
  static async removeGeotag(req, res) {
    try {
      // Enforce admin/expert role
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'expert')) {
        return res.status(403).json({ success: false, error: 'Admin or expert role required' });
      }
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, error: 'Invalid observation id' });
      }
      const [result] = await pool.execute(
        'UPDATE PlantObservations SET latitude = NULL, longitude = NULL, updated_at = NOW() WHERE observation_id = ?',
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Observation not found' });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('Error removing geotag:', err);
      res.status(500).json({ success: false, error: 'Failed to remove geotag' });
    }
  }
  
}

module.exports = ObservationController;
