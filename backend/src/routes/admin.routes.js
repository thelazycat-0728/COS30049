const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controller/userController');

const adminRouter = express.Router();


adminRouter.get('/users', auth.requireAdmin, userController.getAllUsers);

adminRouter.put('/users/:id/role', auth.requireAdmin, userController.updateUserRole);

adminRouter.get('/statistics', (req, res) => {
  res.send('Admin route for statistics');
});


module.exports = adminRouter;
