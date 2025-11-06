const auditLogger = require('../logger/auditLogger');
const axios = require('axios');
const AI_BACKEND_URL = process.env.AI_BACKEND_URL;

// Start model training
const startTraining = async (req, res) => {
  try {
    const trainingParams = {
      ...req.body,
    };

    const response = await axios.post(`${AI_BACKEND_URL}/api/train`, trainingParams);
    
    auditLogger.info('training.start', {
      requestId: req.requestId,
      user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null,
      params: req.body,
      result: response.data,
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error starting training:', error);
    auditLogger.error('training.start.error', { requestId: req.requestId, message: error?.message });
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to start training',
      message: error.response?.data?.message || error.message
    });
  }
};

// Get current training status
const getTrainingStatus = async (req, res) => {
  try {
    const response = await axios.get(`${AI_BACKEND_URL}/api/train/status`);
    auditLogger.info('training.status', { requestId: req.requestId, result: response.data });
    res.json(response.data);
  } catch (error) {
    auditLogger.error('training.status.error', { requestId: req.requestId, message: error?.message });
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
};

// Stop training process
const stopTraining = async (req, res) => {
  try {
    const response = await axios.post(`${AI_BACKEND_URL}/api/train/stop`);
    auditLogger.info('training.stop', { requestId: req.requestId, result: response.data });
    res.json(response.data);
  } catch (error) {
    auditLogger.error('training.stop.error', { requestId: req.requestId, message: error?.message });
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
};

// Get list of trained models with pagination, filtering, sorting, and search
const getModels = async (req, res) => {
  try {
    const response = await axios.get(`${AI_BACKEND_URL}/api/models`, {
      params: req.query  // Pass all query params (page, limit, search, filter, sortBy, sortOrder)
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to get models',
      error: error.response?.data?.message || error.message
    });
  }
};

const deleteModel = async (req, res) => {
  try {
    const { modelName } = req.params;
    const response = await axios.delete(`${AI_BACKEND_URL}/api/models/${modelName}`, {
      params: { force: req.query.force }  // Pass force query param
    });
    
    auditLogger.info('model.delete', { 
      requestId: req.requestId, 
      user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null, 
      modelName, 
      forceDelete: req.query.force === 'true' 
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error deleting model:', error);
    auditLogger.error('model.delete.error', { requestId: req.requestId, modelName: req.params.modelName, message: error?.message });
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to delete model',
      error: error.response?.data?.message || error.message
    });
  }
};

const getModelPlot = async (req, res) => {
  try {
    const { modelName } = req.params;
    const response = await axios.get(`${AI_BACKEND_URL}/api/models/${modelName}/plot`, {
      responseType: 'arraybuffer'  // Important for binary image data
    });
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); 
    res.send(response.data);
  } catch (error) {
    console.error('Error serving model plot:', error);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to load training plot',
      message: error.response?.data?.message || error.message 
    });
  }
};

const activateModel = async (req, res) => {
  try {
    const { modelName } = req.params;
    const response = await axios.patch(`${AI_BACKEND_URL}/api/models/${modelName}/activate`);
    
    auditLogger.info('model.activate', { 
      requestId: req.requestId, 
      user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null, 
      modelName 
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error activating model:', error);
    auditLogger.error('model.activate.error', { requestId: req.requestId, modelName: req.params.modelName, message: error?.message });
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to activate model',
      error: error.response?.data?.message || error.message
    });
  }
};

module.exports = {
  startTraining,
  getTrainingStatus,
  stopTraining,
  getModels,
  deleteModel,
  getModelPlot,
  activateModel
};
