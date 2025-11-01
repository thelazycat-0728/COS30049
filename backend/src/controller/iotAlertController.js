const IoTAlert = require('../models/IoTAlert');
const pool = require('../config/database');

class IoTAlertController {
  async getAllAlerts(req, res) {
    try {
      // Parse pagination params: support limit/offset or page/size (following plantController pattern)
      const sizeQ = req.query.limit ?? req.query.size;
      const pageQ = req.query.page;
      const offsetQ = req.query.offset;

      // Parse filter parameters
      const severityFilter = req.query.severity;
      const typeFilter = req.query.type;
      const resolvedFilter = req.query.resolved;
      const sensorIdFilter = req.query.sensorId;
      const searchQuery = req.query.search;

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

      // Build base SQL query with filters
      let baseQuery = `FROM Alerts WHERE 1=1`;
      const queryParams = [];

      // Add severity filter
      if (severityFilter) {
        baseQuery += ` AND severity = ?`;
        queryParams.push(severityFilter);
      }

      // Add type filter
      if (typeFilter) {
        baseQuery += ` AND alert_type = ?`;
        queryParams.push(typeFilter);
      }

      // Add resolved filter
      if (resolvedFilter !== undefined) {
        const resolvedValue = (resolvedFilter === 'true' || resolvedFilter === '1' || resolvedFilter === 1) ? 1 : 0;
        baseQuery += ` AND resolved = ?`;
        queryParams.push(resolvedValue);
      }

      // Add sensor ID filter
      if (sensorIdFilter) {
        baseQuery += ` AND sensor_id = ?`;
        queryParams.push(sensorIdFilter);
      }

      // Add search filter
      if (searchQuery) {
        baseQuery += ` AND (
          alert_type LIKE ? OR 
          severity LIKE ? OR 
          description LIKE ? OR
          CAST(sensor_id AS CHAR) LIKE ?
        )`;
        const searchPattern = `%${searchQuery}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Handle sorting
      let sortField = 'created_at';
      let sortOrder = 'DESC';

      if (req.query.sort) {
        const validSortFields = {
          'timestamp': 'created_at',
          'severity': 'severity',
          'score': 'score',
          'type': 'alert_type'
        };
        
        sortField = validSortFields[req.query.sort] || 'created_at';
        
        if (req.query.order) {
          const validOrders = ['asc', 'desc', 'ASC', 'DESC'];
          sortOrder = validOrders.includes(req.query.order.toUpperCase()) ? req.query.order.toUpperCase() : 'DESC';
        }
      }

      // Query total count
      const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`;
      const [countRows] = await pool.execute(countQuery, queryParams);
      const total = countRows[0]?.total ?? 0;

      // Build main query with sorting and pagination
      let mainQuery = `
        SELECT 
          alert_id,
          sensor_id,
          observation_id,
          alert_type,
          severity,
          score,
          description,
          resolved,
          created_at
        ${baseQuery}
        ORDER BY ${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      // Execute main query
      const [alerts] = await pool.execute(mainQuery, [...queryParams, size, offset]);

      // Derive current page if not provided
      const currentPage = Number.isFinite(Number(pageQ)) && Number(pageQ) > 0 
        ? Number(pageQ) 
        : Math.floor(offset / size) + 1;

      return res.json({
        success: true,
        alerts,
        pagination: {
          total,
          page: currentPage,
          size,
          totalPages: Math.ceil(total / size)
        }
      });

    } catch (error) {
      console.error('❌ Get all alerts error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts'
      });
    }
  }

  /**
   * Get alert by ID
   * @route GET /api/iot/alerts/:id
   */
  async getAlertById(req, res) {
    try {
      const alertId = req.params.id;

      // Use direct SQL query to match the table schema
      const [alerts] = await pool.execute(
        `SELECT 
          alert_id,
          sensor_id,
          observation_id,
          alert_type,
          severity,
          score,
          description,
          resolved,
          created_at
         FROM Alerts 
         WHERE alert_id = ?`,
        [alertId]
      );

      if (!alerts || alerts.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      return res.json({
        success: true,
        alert: alerts[0]
      });

    } catch (error) {
      console.error('❌ Get alert by ID error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert'
      });
    }
  }

  /**
   * Resolve an alert
   * @route POST /api/iot/alerts/:id/resolve
   */
  async resolveAlert(req, res) {
    try {
      const alertId = req.params.id;

      // Check if alert exists
      const [alerts] = await pool.execute(
        'SELECT * FROM Alerts WHERE alert_id = ?',
        [alertId]
      );

      if (!alerts || alerts.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      const alert = alerts[0];

      // Check if already resolved
      if (alert.resolved) {
        return res.status(400).json({
          success: false,
          error: 'Alert already resolved'
        });
      }

      // Update alert to resolved
      const [result] = await pool.execute(
        'UPDATE Alerts SET resolved = 1 WHERE alert_id = ?',
        [alertId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      // Get updated alert
      const [updatedAlerts] = await pool.execute(
        'SELECT * FROM Alerts WHERE alert_id = ?',
        [alertId]
      );

      console.log(`✅ Alert resolved: ${alertId}`);

      return res.json({
        success: true,
        message: 'Alert resolved successfully',
        alert: updatedAlerts[0]
      });

    } catch (error) {
      console.error('❌ Resolve alert error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve alert'
      });
    }
  }

  /**
   * Unresolve an alert
   * @route POST /api/iot/alerts/:id/unresolve
   */
  async unresolveAlert(req, res) {
    try {
      const alertId = req.params.id;

      // Check if alert exists
      const [alerts] = await pool.execute(
        'SELECT * FROM Alerts WHERE alert_id = ?',
        [alertId]
      );

      if (!alerts || alerts.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      const alert = alerts[0];

      // Check if already unresolved
      if (!alert.resolved) {
        return res.status(400).json({
          success: false,
          error: 'Alert already unresolved'
        });
      }

      // Update alert to unresolved
      const [result] = await pool.execute(
        'UPDATE Alerts SET resolved = 0 WHERE alert_id = ?',
        [alertId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      // Get updated alert
      const [updatedAlerts] = await pool.execute(
        'SELECT * FROM Alerts WHERE alert_id = ?',
        [alertId]
      );

      console.log(`✅ Alert unresolved: ${alertId}`);

      return res.json({
        success: true,
        message: 'Alert marked as unresolved successfully',
        alert: updatedAlerts[0]
      });

    } catch (error) {
      console.error('❌ Unresolve alert error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unresolve alert'
      });
    }
  }
}

module.exports = new IoTAlertController();