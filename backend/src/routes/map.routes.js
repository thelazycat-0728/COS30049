const express = require('express');
const LocationController = require('../controller/locationController');

const mapRouter = express.Router();

// Admin locations listing
mapRouter.get('/locations/admin', LocationController.adminLocations);

// User locations listing (public-only)
mapRouter.get('/locations/user', LocationController.userLocations);

// Public map locations
mapRouter.get('/locations/public', LocationController.publicLocations);

// Density heatmap
mapRouter.get('/locations/density', LocationController.densityHeatmap);

// Plant details
mapRouter.get('/plants/:plant_id', LocationController.plantDetails);

module.exports = mapRouter;
