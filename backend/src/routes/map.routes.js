const express = require('express');
const LocationController = require('../controller/locationController');
const auth = require('../middleware/auth');

const mapRouter = express.Router();

// Admin locations listing
mapRouter.get('/locations/admin', auth.requireAdmin, LocationController.adminLocations);

// User locations listing (public-only)
mapRouter.get('/locations/user', auth.requireAuth, LocationController.userLocations);

// Public map locations
mapRouter.get('/locations/public', auth.requireAuth, LocationController.publicLocations);

// Density heatmap
mapRouter.get('/locations/density', auth.requireAuth, LocationController.densityHeatmap);

// Plant details
mapRouter.get('/plants/:plant_id', auth.requireAuth, LocationController.plantDetails);

module.exports = mapRouter;
