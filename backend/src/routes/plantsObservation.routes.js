const express = require('express');
const ObservationController = require('../controller/observationController');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateObservation } = require('../middleware/validation');
const upload = require('../middleware/upload');

const plantsObservationRouter = express.Router();

// GET all observations (public with optional auth for better data)
plantsObservationRouter.get(
  '/',
  optionalAuth,
  ObservationController.getAll
);

// GET single observation
plantsObservationRouter.get(
  '/:id',
  optionalAuth,
  ObservationController.getById
);

// POST create new observation (authenticated users only)
plantsObservationRouter.post(
  '/',
  requireAuth,
  upload.single('image'),
  validateObservation,
  ObservationController.create
);

// PUT update observation (admin only)
plantsObservationRouter.put(
  '/:id',
  requireAdmin,
  ObservationController.update
);

// DELETE observation (admin or owner)
plantsObservationRouter.delete(
  '/:id',
  requireAuth,
  ObservationController.delete
);

// POST flag observation (authenticated users)
plantsObservationRouter.post(
  '/:id/flag',
  requireAuth,
  ObservationController.flag
);

module.exports = plantsObservationRouter;