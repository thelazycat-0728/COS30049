const express = require('express');
const { requireAuth } = require('../middleware/auth');
const plantController = require('../controller/plantController');


const plantRouter = express.Router();

// GET all plants (public)
plantRouter.get('/', requireAuth, plantController.getAll);
plantRouter.get('/:plant_id', requireAuth, plantController.getById);

module.exports = plantRouter;