const express = require('express');

const mapRouter = express.Router();

mapRouter.get('/observations', (req, res) => {
  res.send('Map route');
});

mapRouter.get('/heatmap', (req, res) => {
  res.send('Heatmap data');
});

module.exports = mapRouter;