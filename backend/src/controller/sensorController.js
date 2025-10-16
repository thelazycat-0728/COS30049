const Sensor = require("../models/Sensor");
const SensorData = require("../models/SensorData");

class SensorController {
  /**
   * Register a new sensor
   * @route POST /api/iot/sensors
   */
  async registerSensor(req, res) {
    try {
      const { name, location, status } = req.body;

      // Validation
      if (!name || !location) {
        return res.status(400).json({
          success: false,
          error: "Sensor name and sensor location are required",
        });
      }

      // Sanitize inputs
      const cleanName = String(name).trim();
      const cleanLocation = String(location).trim();

      if (cleanName.length === 0 || cleanLocation.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Sensor name and sensor location cannot be empty",
        });
      }

      // Create sensor
      const sensor = await Sensor.create(cleanName, cleanLocation, status);

      console.log(
        `✅ Sensor registered: ${sensor.sensorId} by user ${req.user.id}`
      );

      return res.status(201).json({
        success: true,
        message: "Sensor registered successfully",
        sensor,
      });
    } catch (error) {
      console.error("❌ Register sensor error:", error);

      if (error.message === "Sensor with this ID already exists") {
        return res.status(409).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to register sensor",
      });
    }
  }

  /**
   * Get all sensors
   * @route GET /api/iot/sensors
   */
  async getAllSensors(req, res) {
    try {
      let sensors;

      const limit = Math.min(parseInt(req.query.limit || "100", 10), 1000);
      const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
      sensors = await Sensor.findAll(limit, offset);

      return res.json({
        success: true,
        count: sensors.length,
        sensors,
      });
    } catch (error) {
      console.error("❌ Get all sensors error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve sensors",
      });
    }
  }

  /**
   * Get sensor by ID
   * @route GET /api/iot/sensors/:id
   */
  async getSensorById(req, res) {
    try {
      const sensorId = String(req.params.id);
      const sensor = await Sensor.findBySensorId(sensorId);

      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      // Check authorization
      if (
        req.user.role !== "admin" &&
        req.user.role !== "expert" &&
        sensor.ownerId !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      return res.json({
        success: true,
        sensor,
      });
    } catch (error) {
      console.error("❌ Get sensor by ID error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve sensor",
      });
    }
  }

  /**
   * Update sensor
   * @route PUT /api/iot/sensors/:id
   */
  async updateSensor(req, res) {
    try {
      const sensorId = String(req.params.id);
      const { name, location, status } = req.body;

      // Check if sensor exists
      const sensor = await Sensor.findBySensorId(sensorId);
      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      await Sensor.update({ name, location, status }, sensorId);

      return res.json({
        success: true,
        message: "Sensor updated successfully",
      });

    } catch (error) {
      console.error("❌ Update sensor error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update sensor",
      });
    }
  }


  async deleteSensor(req, res) {
    try {
      const sensorId = String(req.params.id);

      // Check if sensor exists
      const sensor = await Sensor.findBySensorId(sensorId);
      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      await Sensor.delete(sensorId);

      return res.json({
        success: true,
        message: "Sensor deleted successfully",
      });
    } catch (error) {
      console.error("❌ Delete sensor error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete sensor",
      });
    }
  }
}

module.exports = new SensorController();
