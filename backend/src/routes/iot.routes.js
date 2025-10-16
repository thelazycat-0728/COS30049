const express = require('express');
const { requireExpert, requireAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

const sensorController = require('../controller/sensorController');
const sensorDataController = require('../controller/sensorDataController');
const IotAlertController = require('../controller/iotAlertController');

const iotRouter = express.Router();



// ============================================
// Sensor Management Routes
// ============================================

// Register a new sensor
iotRouter.post('/sensors', 
  requireAdmin,
  sensorController.registerSensor
);

// Get all sensors
iotRouter.get('/sensors',  
  requireExpert,
  sensorController.getAllSensors
);

// Get sensor by ID
iotRouter.get('/sensors/:id',  
  requireExpert,
  sensorController.getSensorById
);

// Update sensor
iotRouter.put('/sensors/:id',  
  requireAdmin,
  sensorController.updateSensor
);

// Delete sensor
iotRouter.delete('/sensors/:id',  
  requireAdmin,
  sensorController.deleteSensor
);

// ============================================
// Sensor Data Routes
// ============================================

// Get sensor data with pagination
iotRouter.get('/sensors/:id/data', 
  requireExpert,
  sensorDataController.getSensorData
);

// Get latest sensor data
iotRouter.get('/sensors/:id/latest',
  requireExpert,
  sensorDataController.getLatestData
);

// Get sensor data by time range
iotRouter.get('/sensors/:id/data/range', 
  sensorDataController.getDataByTimeRange
);

// Sprint 2: Consider creating a route for data aggregation (for graphs)

// ============================================
// Alert Management Routes
// ============================================

// Get all alerts (with filters)
iotRouter.get('/alerts', 
  requireExpert,
  IotAlertController.getAllAlerts
);

// Get alert by ID
iotRouter.get('/alerts/:id', 
  requireExpert,
  IotAlertController.getAlertById
);

// Resolve an alert
iotRouter.post('/alerts/:id/resolve', 
  requireAdmin,
  IotAlertController.resolveAlert
);



module.exports = iotRouter;