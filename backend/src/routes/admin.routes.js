const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controller/userController');
const authController = require('../controller/authController');
const trainingController = require('../controller/trainingController');
const {AIAuthenticate, authenticateAIServer} = require('../middleware/authenticateAIServer');


const adminRouter = express.Router();


adminRouter.get('/users', auth.requireAdmin, userController.getAllUsers);

adminRouter.put('/users/:id/role', auth.requireAdmin, userController.updateUserRole);

adminRouter.get('/statistics', (req, res) => {
  res.send('Admin route for statistics');
});

adminRouter.use((req, res, next) => {
  console.log(`Admin route: ${req.method} ${req.originalUrl}`);
  next();
});


adminRouter.post('/train', auth.requireAdmin, trainingController.startTraining);
adminRouter.get('/train/status', auth.requireAdmin, trainingController.getTrainingStatus);
adminRouter.post('/train/stop', auth.requireAdmin, trainingController.stopTraining);
adminRouter.put('/train/finished', authenticateAIServer, trainingController.finishTraining);
adminRouter.get('/models', auth.requireAdmin, trainingController.getModels);
adminRouter.delete('/models/:modelName', auth.requireAdmin, trainingController.deleteModel);
adminRouter.patch('/models/:modelName/activate', auth.requireAdmin, trainingController.activateModel);
adminRouter.get('/models/:modelName/plot', auth.requireAdmin, trainingController.getModelPlot);

adminRouter.post('/cleanup-tokens', auth.requireAdmin, authController.cleanupExpiredTokens);


module.exports = adminRouter;
