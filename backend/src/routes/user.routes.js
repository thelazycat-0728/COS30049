const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controller/userController');

const userRouter = express.Router();

userRouter.get('/profile', auth.requireAuth, userController.getProfile);


module.exports = userRouter;



