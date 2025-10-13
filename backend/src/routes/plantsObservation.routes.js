const express = require('express');

const plantsObservationRouter = express.Router();


plantsObservationRouter.get('/', (req, res) => {
  res.send('Plants Observation route');
})

plantsObservationRouter.post('/', (req, res) => {
  res.send('Create a new plant observation');
});

plantsObservationRouter.get('/:id', (req, res) => {
  res.send(`Get plant observation with ID: ${req.params.id}`);
});

plantsObservationRouter.put('/:id', (req, res) => {
  res.send(`Update plant observation with ID: ${req.params.id}`);
});

plantsObservationRouter.delete('/:id', (req, res) => {
  res.send(`Delete plant observation with ID: ${req.params.id}`);
});

plantsObservationRouter.post('/:id/flag', (req, res) => {
  res.send(`Flag plant observation with ID: ${req.params.id}`);
});

module.exports = plantsObservationRouter;
