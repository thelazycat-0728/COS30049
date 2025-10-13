const express = require('express');

const expertRouter = express.Router();

expertRouter.get('/flagged-observations', (req, res) => {
  res.send('Flagged observations');
});

expertRouter.post('/observations/:id/verify', (req, res) => {
  res.send(`Verify observation with ID: ${req.params.id}`);
});

// This is for adding reference images for new species
expertRouter.post('/observations/species/reference-images', (req, res) => {
  res.send('Add reference images for species');
});

expertRouter.put('/species/:id', (req, res) => {
  res.send(`Update species with ID: ${req.params.id}`);
});

expertRouter.post('/species', (req, res) => {
  res.send('Add new species');
});



module.exports = expertRouter;