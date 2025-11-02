// routes/profile.routes.js
const express = require('express');
const ProfileController = require('../controller/profileController');
const { requireAuth } = require('../middleware/auth');

const profileRouter = express.Router();

// GET user profile
profileRouter.get(
  '/',
  requireAuth,
  ProfileController.getProfile
);

// PUT update profile (username, email)
profileRouter.put(
  '/',
  requireAuth,
  ProfileController.updateProfile
);

// PUT change password
profileRouter.put(
  '/password',
  requireAuth,
  ProfileController.changePassword
);

// GET user statistics
profileRouter.get(
  '/stats',
  requireAuth,
  ProfileController.getUserStats
);

module.exports = profileRouter;