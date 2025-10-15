const express = require('express');
const ObservationController = require('../controller/observationController');
const { requireAuth, requireExpert, optionalAuth } = require('../middleware/auth');
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
  requireExpert,
  upload.single('image'),
  ObservationController.update
);

// DELETE observation (admin or owner)
plantsObservationRouter.delete(
  '/:id',
  requireAuth,
  ObservationController.delete
);

// todo: if confidence below certain threshold, ask user if needs to flag

// PATCH toggle public flag (admin only)
plantsObservationRouter.patch(
  '/:id/public',
  requireExpert,
  ObservationController.togglePublic
);

// PATCH update geotag (admin only)
plantsObservationRouter.patch(
  '/:id/geotag',
  requireExpert,
  ObservationController.updateGeotag
);

// DELETE remove geotag (admin only)
plantsObservationRouter.delete(
  '/:id/geotag',
  requireExpert,
  ObservationController.removeGeotag
);


module.exports = plantsObservationRouter;
