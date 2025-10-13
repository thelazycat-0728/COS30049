const express = require('express');

const adminRouter = express.Router();


adminRouter.get('/users', (req, res) => {
  res.send('Admin route for getting all users');
})

adminRouter.put('/users/:id/role', (req, res) => {
  res.send(`Admin route for updating role of user with ID: ${req.params.id}`);  
});

adminRouter.get('/statistics', (req, res) => {
  res.send('Admin route for statistics');
});


module.exports = adminRouter;
