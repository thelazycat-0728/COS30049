const auditLogger = require('../logger/auditLogger');
const axios = require('axios');
const AI_BACKEND_URL = process.env.AI_BACKEND_URL;
const pool = require('../config/database');

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
    const statusCode = error.response?.status || 500;
    const backendData = error.response?.data || {};

    console.error('Error starting training:', backendData || error.message);

    const backendMessage =
      backendData.error ||
      backendData.message ||
      backendData.detail ||
      error.message;

    const displayMessage =
      statusCode === 409
        ? backendMessage || 'Training already in progress'
        : backendMessage || 'Failed to start training';

    auditLogger.error('training.start.error', {
      requestId: req.requestId,
      status: statusCode,
      backendResponse: backendData,
      message: displayMessage,
    });

    res.status(statusCode).json({
      success: false,
      error: displayMessage,
      message: displayMessage,
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

//Auto Retrain part

// Get retrain stats
const getRetrainStats = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        retrain_accuracy, 
        rejected_count, 
        threshold_accuracy, 
        threshold_count, 
        auto_retrain
      FROM retrain_stats 
      WHERE id = 1
    `);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Retrain stats not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching retrain stats:', error);
    auditLogger.error('retrain.stats.fetch.error', { message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch retrain stats' });
  }
};

// Update retrain stats (auto_retrain toggle & thresholds)
const updateRetrainStats = async (req, res) => {
  try {
    const { auto_retrain, threshold_accuracy, threshold_count } = req.body;

    await pool.query(`
      UPDATE retrain_stats 
      SET auto_retrain = ?, threshold_accuracy = ?, threshold_count = ?
      WHERE id = 1
    `, [auto_retrain ? 1 : 0, threshold_accuracy, threshold_count]);

    auditLogger.info('retrain.stats.update', {
      requestId: req.requestId,
      user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null,
      data: req.body
    });

    res.json({ success: true, message: 'Retrain stats updated successfully' });
  } catch (error) {
    console.error('Error updating retrain stats:', error);
    auditLogger.error('retrain.stats.update.error', { message: error.message });
    res.status(500).json({ success: false, message: 'Failed to update retrain stats' });
  }
};


// Get training history for graph (last 5 completed trainings)
const getTrainingHistory = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        model_version,
        training_accuracy,
        validation_accuracy,
        completed_at
      FROM training_history 
      WHERE status = 'completed'
        AND training_accuracy IS NOT NULL 
        AND validation_accuracy IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 5
    `);

    const historyData = rows.reverse();

    // Prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({ 
      success: true, 
      data: historyData
    });
  } catch (error) {
    console.error('Error fetching training history:', error);
    auditLogger.error('training.history.fetch.error', { 
      requestId: req.requestId, 
      message: error.message 
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch training history' 
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
  activateModel,
  getRetrainStats,
  updateRetrainStats,
  getTrainingHistory
};
