const IoTAlert = require('../models/IoTAlert');

class IoTAlertController {
 
  async getAllAlerts(req, res) {
    try {
      const filters = {
        sensorId: req.query.sensorId,
        severity: req.query.severity,
        resolved: req.query.resolved === 'true' ? true :
                   req.query.resolved === 'false' ? false : undefined,
        alertType: req.query.alertType,
        limit: Math.min(parseInt(req.query.limit || '100', 10), 1000),
        offset: Math.max(parseInt(req.query.offset || '0', 10), 0)
      };

      const alerts = await IoTAlert.findAll(filters);

      return res.json({
        success: true,
        count: alerts.length,
        alerts
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
      const alertId = String(req.params.id);

      const alert = await IoTAlert.findByAlertId(alertId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      return res.json({
        success: true,
        alert
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
      const alertId = String(req.params.id);

      const alert = await IoTAlert.findByAlertId(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      // Check if already resolved
      if (alert.resolved) {
        return res.status(400).json({
          success: false,
          error: 'Alert already resolved'
        });
      }

      const updatedAlert = await IoTAlert.resolve(alertId);

      console.log(`✅ Alert resolved: ${alertId}`);

      return res.json({
        success: true,
        message: 'Alert resolved successfully',
        alert: updatedAlert
      });

    } catch (error) {
      console.error('❌ Resolve alert error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve alert'
      });
    }
  }

  
}

module.exports = new IoTAlertController();