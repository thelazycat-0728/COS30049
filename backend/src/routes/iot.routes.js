const express = require('express');


const iotRouter = express.Router();

iotRouter.post('/sensors', (req, res) => {
  res.send('IoT route');
});

iotRouter.post('/data', (req, res) => {
  res.send('IoT data received');
});

iotRouter.get('/sensors/:id/data', (req, res) => {
  res.send(`Data for sensor ID: ${req.params.id}`);
})

iotRouter.get('/alerts', (req, res) => {
  res.send('IoT alerts');
});

iotRouter.post('/alerts/:id/acknowledge', (req, res) => {
  res.send(`Acknowledge IoT alert with ID: ${req.params.id}`);
});


module.exports = iotRouter;