const express = require('express');
const upload = require('../middleware/upload');
const IdentifyController = require('../controller/identifyController');
const classificationController = require('../controller/classificationController');
const { optionalAuth } = require('../middleware/auth');

const identifyRouter = express.Router();

// EXIF-based location extraction from uploaded image
identifyRouter.post(
  '/extract-location',
  upload.single('image'),
  IdentifyController.extractLocation
);

// Base64 image body-based location extraction
identifyRouter.post(
  '/extract-location-base64',
  IdentifyController.extractLocationBase64
);

// Submit observation using previously uploaded image_url and optional coords
identifyRouter.post(
  '/submit-observation',
  optionalAuth,
  IdentifyController.submitObservation
);

// AI Classification
identifyRouter.post(
  '/classify',
  classificationController.classifyImage
);

// Delete uploaded image
identifyRouter.post(
  '/delete-image',
  IdentifyController.deleteImage
);

// Placeholder routes kept for compatibility/demo
identifyRouter.post('/', (req, res) => {
  res.send('Identify route');
});

identifyRouter.get('/identify/:observationId/results', (req, res) => {
  res.send(`Results for observation ID: ${req.params.observationId}`);
});

module.exports = identifyRouter;
