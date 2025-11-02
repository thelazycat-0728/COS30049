const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controller/userController');
const authController = require('../controller/authController');
const trainingController = require('../controller/trainingController');
const plantController = require('../controller/plantController');
const upload = require('../middleware/upload');


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

// Model management (admin)
adminRouter.post('/train', auth.requireAdmin, trainingController.startTraining);
adminRouter.get('/train/status', auth.requireAdmin, trainingController.getTrainingStatus);
adminRouter.post('/train/stop', auth.requireAdmin, trainingController.stopTraining);
adminRouter.get('/models', auth.requireAdmin, trainingController.getModels);
adminRouter.delete('/models/:modelName', auth.requireAdmin, trainingController.deleteModel);
adminRouter.get('/models/:modelName/plot', trainingController.getModelPlot);
adminRouter.patch('/models/:modelName/activate', auth.requireAdmin, trainingController.activateModel);
adminRouter.post('/train/finish', trainingController.finishTraining);

adminRouter.post('/cleanup-tokens', auth.requireAdmin, authController.cleanupExpiredTokens);

// Plants management (admin/expert)
adminRouter.get('/plants', auth.requireExpert, plantController.getAll);
adminRouter.get('/plants/:plant_id', auth.requireExpert, plantController.getById);
adminRouter.post('/plants', auth.requireExpert, upload.single('image'), plantController.create);
adminRouter.put('/plants/:plant_id', auth.requireExpert, upload.single('image'), plantController.update);
adminRouter.delete('/plants/:plant_id', auth.requireExpert, plantController.delete);


module.exports = adminRouter;
