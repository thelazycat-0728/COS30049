const express = require('express');

const identifyRouter = express.Router();

identifyRouter.post('/', (req, res) => {
  res.send('Identify route');
})

identifyRouter.get('/identify/:observationId/results', (req, res) => {
  res.send(`Results for observation ID: ${req.params.observationId}`);
})

module.exports = identifyRouter;
