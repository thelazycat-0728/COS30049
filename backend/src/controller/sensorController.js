const Sensor = require("../models/Sensor");
const SensorData = require("../models/SensorData");
const pool = require('../config/database');

class SensorController {
  /**
   * Register a new sensor
   * @route POST /api/iot/sensors
   */
  async registerSensor(req, res) {
    try {
      const { sensor_name, location_description, status, observation_id } = req.body;

      // Validation
      if (!sensor_name || !location_description) {
        return res.status(400).json({
          success: false,
          error: "Sensor name and location description are required",
        });
      }

      // Sanitize inputs
      const cleanName = String(sensor_name).trim();
      const cleanLocation = String(location_description).trim();

      if (cleanName.length === 0 || cleanLocation.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Sensor name and location description cannot be empty",
        });
      }

      // Validate status if provided
      const validStatuses = ['active', 'inactive', 'maintenance'];
      const sensorStatus = status && validStatuses.includes(status) ? status : 'active';

      // Create sensor - updated to match table schema
      const sensor = await Sensor.create({
        sensor_name: cleanName,
        location_description: cleanLocation,
        status: sensorStatus,
        observation_id: observation_id || null
      });

      console.log(
        `✅ Sensor registered: ${sensor.sensor_id} by user ${req.user.id}`
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
   * Get all sensors with filtering, sorting, and search
   * @route GET /api/iot/sensors
   */
  async getAllSensors(req, res) {
    try {
      // Parse pagination params
      const sizeQ = req.query.limit ?? req.query.size;
      const pageQ = req.query.page;
      const offsetQ = req.query.offset;

      // Validate and set size (limit)
      let size = Number(sizeQ);
      if (!Number.isFinite(size) || size <= 0) size = 10;
      if (size > 100) size = 100;

      // Validate and set offset
      let offset = Number(offsetQ);
      if (!Number.isFinite(offset) || offset < 0) {
        const pageNum = Number(pageQ);
        if (Number.isFinite(pageNum) && pageNum > 0) {
          offset = (pageNum - 1) * size;
        } else {
          offset = 0;
        }
      }

      // Parse filter, search, and sort parameters
      const search = req.query.search;
      const statusFilter = req.query.status;
      const sortBy = req.query.sortBy || 'created_at';
      const sortOrder = req.query.sortOrder || 'DESC';
      
      // Build WHERE conditions
      const conditions = [];
      const params = [];

      // Search condition
      if (search && search.trim()) {
        conditions.push(`(s.sensor_name LIKE ? OR s.location_description LIKE ?)`);
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm);
      }

      // Status filter - explicitly use s.status (sensor status)
      if (statusFilter && statusFilter !== 'all' && statusFilter !== '') {
        conditions.push(`s.status = ?`);
        params.push(statusFilter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build ORDER BY clause with validation
      let orderByClause = 'ORDER BY ';
      
      // Validate sortBy and sortOrder to prevent SQL injection
      const allowedSortFields = ['created_at', 'observation_id', 'observation_name'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const validatedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validatedSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
      
      // Handle different sort fields
      switch (validatedSortBy) {
        case 'created_at':
          orderByClause += `s.created_at ${validatedSortOrder}`;
          break;
        case 'observation_id':
          orderByClause += `s.observation_id ${validatedSortOrder}`;
          break;
        case 'observation_name':
          // For observation_name, we need to join with observations and plants tables
          // and sort by plant common_name
          orderByClause += `p.common_name ${validatedSortOrder}`;
          break;
        default:
          orderByClause += `s.created_at ${validatedSortOrder}`;
      }

      // Base query for sensors
      let baseQuery = `
        SELECT 
          s.sensor_id, 
          s.sensor_name, 
          s.location_description, 
          s.observation_id,
          s.status, 
          s.last_checked, 
          s.created_at, 
          s.updated_at
        FROM IoTSensors s
      `;

      // Add joins if sorting by observation_name
      if (validatedSortBy === 'observation_name') {
        baseQuery += `
          LEFT JOIN PlantObservations o ON s.observation_id = o.observation_id
          LEFT JOIN Plants p ON o.plant_id = p.plant_id
        `;
      }

      // Query total count - use same table aliases and conditions
      let countQuery = `SELECT COUNT(*) AS total FROM IoTSensors s`;
      if (validatedSortBy === 'observation_name') {
        countQuery += `
          LEFT JOIN PlantObservations o ON s.observation_id = o.observation_id
          LEFT JOIN Plants p ON o.plant_id = p.plant_id
        `;
      }
      countQuery += ` ${whereClause}`;

      const [[countRow]] = await pool.execute(countQuery, params);
      const total = countRow?.total ?? 0;

      // Fetch current page
      const query = `
        ${baseQuery}
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;

      const [rows] = await pool.execute(
        query,
        [...params, size, offset]
      );

      // Derive current page if not provided
      const currentPage = Number.isFinite(Number(pageQ)) && Number(pageQ) > 0 ? Number(pageQ) : Math.floor(offset / size) + 1;

      return res.json({
        success: true,
        sensors: rows,
        pagination: {
          total,
          page: currentPage,
          size,
          totalPages: Math.ceil(total / size)
        }
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
      const sensorId = parseInt(req.params.id);
      
      if (isNaN(sensorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid sensor ID",
        });
      }

      // Updated to use direct query matching table schema
      const [sensors] = await pool.execute(
        `SELECT 
          sensor_id, 
          sensor_name, 
          location_description, 
          observation_id,
          status, 
          last_checked, 
          created_at, 
          updated_at
         FROM IoTSensors 
         WHERE sensor_id = ?`,
        [sensorId]
      );

      const sensor = sensors[0];

      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      // Check authorization - updated to match your schema (no ownerId field)
      if (req.user.role !== "admin" && req.user.role !== "expert") {
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
      const sensorId = parseInt(req.params.id);
      const { sensor_name, location_description, status, observation_id } = req.body;

      if (isNaN(sensorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid sensor ID",
        });
      }

      // Check if sensor exists
      const [sensors] = await pool.execute(
        'SELECT sensor_id FROM IoTSensors WHERE sensor_id = ?',
        [sensorId]
      );

      if (sensors.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      // Build update query dynamically based on provided fields
      const updateFields = [];
      const updateValues = [];

      if (sensor_name !== undefined) {
        updateFields.push('sensor_name = ?');
        updateValues.push(String(sensor_name).trim());
      }

      if (location_description !== undefined) {
        updateFields.push('location_description = ?');
        updateValues.push(String(location_description).trim());
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'inactive', 'maintenance'];
        if (validStatuses.includes(status)) {
          updateFields.push('status = ?');
          updateValues.push(status);
        }
      }

      if (observation_id !== undefined) {
        updateFields.push('observation_id = ?');
        updateValues.push(observation_id);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid fields to update",
        });
      }

      updateValues.push(sensorId);

      await pool.execute(
        `UPDATE IoTSensors SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE sensor_id = ?`,
        updateValues
      );

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

  /**
   * Delete sensor
   * @route DELETE /api/iot/sensors/:id
   */
  async deleteSensor(req, res) {
    try {
      const sensorId = parseInt(req.params.id);

      if (isNaN(sensorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid sensor ID",
        });
      }

      // Check if sensor exists
      const [sensors] = await pool.execute(
        'SELECT sensor_id FROM IoTSensors WHERE sensor_id = ?',
        [sensorId]
      );

      if (sensors.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      await pool.execute('DELETE FROM IoTSensors WHERE sensor_id = ?', [sensorId]);

      return res.json({
        success: true,
        message: "Sensor deleted successfully",
      });
    } catch (error) {
      console.error("❌ Delete sensor error:", error);

      // Handle foreign key constraint errors
      if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(409).json({
          success: false,
          error: "Cannot delete sensor: Sensor is referenced by other records",
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to delete sensor",
      });
    }
  }

  /**
   * Get sensors by status
   * @route GET /api/iot/sensors/status/:status
   */
  async getSensorsByStatus(req, res) {
    try {
      const { status } = req.params;
      const validStatuses = ['active', 'inactive', 'maintenance'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Must be one of: active, inactive, maintenance",
        });
      }

      const [sensors] = await pool.execute(
        `SELECT 
          sensor_id, 
          sensor_name, 
          location_description, 
          observation_id,
          status, 
          last_checked, 
          created_at, 
          updated_at
         FROM IoTSensors 
         WHERE status = ?
         ORDER BY sensor_name`,
        [status]
      );

      return res.json({
        success: true,
        sensors,
        total: sensors.length,
      });
    } catch (error) {
      console.error("❌ Get sensors by status error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve sensors by status",
      });
    }
  }

  /**
   * Update sensor last_checked timestamp
   * @route PATCH /api/iot/sensors/:id/checkin
   */
  async updateLastChecked(req, res) {
    try {
      const sensorId = parseInt(req.params.id);

      if (isNaN(sensorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid sensor ID",
        });
      }

      await pool.execute(
        'UPDATE IoTSensors SET last_checked = CURRENT_TIMESTAMP WHERE sensor_id = ?',
        [sensorId]
      );

      return res.json({
        success: true,
        message: "Sensor check-in timestamp updated successfully",
      });
    } catch (error) {
      console.error("❌ Update sensor last_checked error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update sensor check-in timestamp",
      });
    }
  }
}

module.exports = new SensorController();