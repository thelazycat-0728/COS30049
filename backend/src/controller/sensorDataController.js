const Sensor = require("../models/Sensor");
const SensorData = require("../models/SensorData");
const IoTAlert = require("../models/IoTAlert");

class SensorDataController {
  async getSensorData(req, res) {
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

      // Check authorization

      // Parse query parameters
      const limit = Math.min(parseInt(req.query.limit || "100", 10), 1000);
      const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

      // Get sensor data
      const data = await SensorData.findBySensorId(sensorId, limit, offset);

      return res.json({
        success: true,
        sensor: {
          sensorId: sensor.sensor_id,
          name: sensor.sensor_name,
          location: sensor.location_description,
        },
        count: data.length,
        data,
      });
    } catch (error) {
      console.error("❌ Get sensor data error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve sensor data",
      });
    }
  }


  async getLatestData(req, res) {
    try {
      const sensorId = String(req.params.id);
    
      // Check sensor exists and authorization
      const sensor = await Sensor.findBySensorId(sensorId);
      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      

      const data = await SensorData.findLatest(sensorId, 1);

      return res.json({
        success: true,
        sensor: {
          sensorId: sensor.sensor_id,
          name: sensor.sensor_name,
          location: sensor.location_description,
        },
        data,
      });
    } catch (error) {
      console.error("❌ Get latest data error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve latest data",
      });
    }
  }
  
  async getDataByTimeRange(req, res) {
    try {
      const sensorId = String(req.params.id);
      const { startTime, endTime } = req.query;

      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: "startTime and endTime are required",
        });
      }

      // Check sensor
      const sensor = await Sensor.findBySensorId(sensorId);
      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

     
      

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid date format",
        });
      }

      const limit = Math.min(parseInt(req.query.limit || "1000", 10), 10000);
      const data = await SensorData.findByTimeRange(
        sensorId,
        start,
        end,
        limit
      );

      return res.json({
        success: true,
        sensor: {
          sensorId: sensor.sensor_id,
          name: sensor.sensor_name,
        },
        timeRange: { start, end },
        count: data.length,
        data,
      });
    } catch (error) {
      console.error("❌ Get data by time range error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve data",
      });
    }
  }
}

module.exports = new SensorDataController();
