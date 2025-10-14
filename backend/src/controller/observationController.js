const Observation = require("../models/Observation");
// const AIService = require('../services/aiService');
const StorageService = require("../services/storageService");
// const GeoUtils = require('../utils/geoUtils');

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

      // Apply GPS masking based on user role
      // const userRole = req.user?.role || 'public';
      // observations = observations.map(obs => {
      //   const canSeeExact = GeoUtils.canSeeExactLocation(userRole, obs.conservation_status);

      //   if (!canSeeExact) {
      //     const masked = GeoUtils.maskCoordinates(obs.gps_lat, obs.gps_lng);
      //     return {
      //       ...obs,
      //       gps_lat: masked.lat,
      //       gps_lng: masked.lng,
      //       location_masked: true
      //     };
      //   }

      //   return {
      //     ...obs,
      //     location_masked: false
      //   };
      // });

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

      // Apply GPS masking
      // const userRole = req.user?.role || 'public';
      // const canSeeExact = GeoUtils.canSeeExactLocation(userRole, observation.conservation_status);

      // if (!canSeeExact) {
      //   const masked = GeoUtils.maskCoordinates(observation.gps_lat, observation.gps_lng);
      //   observation.gps_lat = masked.lat;
      //   observation.gps_lng = masked.lng;
      //   observation.location_masked = true;
      // } else {
      //   observation.location_masked = false;
      // }

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
      const { public, latitude, longitude, plantId, observationDate, status } =
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

      // Get AI prediction
      let aiResult;
      try {
        // aiResult = await AIService.identifyPlant(req.file);
        console.log("AI identification skipped in this demo.");
        aiResult = { species: "Hibiscus", confidence: 0.12, alternatives: [] };
      } catch (error) {
        console.error("AI identification error:", error);
        // Continue even if AI fails
        aiResult = {
          species: "Unknown",
          confidence: 0,
          alternatives: [],
        };
      }

      // Create observation
      const observationId = await Observation.create({
        userId,
        plantId,
        imageUrl,
        public,
        latitude,
        longtitude: longitude,
        observationDate: observationDate || new Date(),
        confidenceScore: aiResult.confidence,
        status: status || "pending",
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

      const { plantId, confidenceScore, status, public } = req.body;
 
      // Check if observation exists
      const observation = await Observation.findById(id);
      if (!observation) {
        return res.status(404).json({
          success: false,
          error: "Observation not found",
        });
      }

      if (public !== 1 && public !== 0) {
        public = undefined;
      }

      // Update observation
      const updateData = {
        confidenceScore: confidenceScore
          ? parseFloat(confidenceScore)
          : undefined,
        plantId: plantId ? parseInt(plantId) : undefined,
        status,
        imageUrl: imageUrl || undefined,
        public: public ? parseInt(public) : undefined,
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

      // Check ownership or admin
      if (observation.user_id !== req.user.user_id && req.user.role !== "admin") {
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
  
}

module.exports = ObservationController;
