const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const aiServerService = require('../services/AiServerTraining');

// Path
const MODELS_DIR = path.join(__dirname, '../../ml/models');
const ACTIVE_MODEL_PATH = path.join(__dirname, '../../ml/active_model.txt');

// Start model training
const startTraining = async (req, res) => {
  try {
    const result = await aiServerService.startTraining(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error starting training:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start training',
      message: error.message
    });
  }
};

// Get current training status
const getTrainingStatus = async (req, res) => {
  try {
    const result = await aiServerService.getTrainingStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Stop training process
const stopTraining = async (req, res) => {
  try {
    const result = await aiServerService.stopTraining();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get list of trained models with pagination
const getModels = async (req, res) => {
  try {
    // Parse pagination params: support limit/offset or page/size
    const sizeQ = req.query.limit ?? req.query.size;
    const pageQ = req.query.page;
    const offsetQ = req.query.offset;

    // Validate and set size (limit)
    let size = Number(sizeQ);
    if (!Number.isFinite(size) || size <= 0) size = 10;
    if (size > 100) size = 100;

    // Validate and set offset
    let offset = Number(offsetQ);
    if (!Number.isFinite(offset) || offset < 0) {
      const pageNum = Number(pageQ);
      if (Number.isFinite(pageNum) && pageNum > 0) {
        offset = (pageNum - 1) * size;
      } else {
        offset = 0;
      }
    }

    // Read all directories in models folder (each training creates a folder)
    const items = await fs.readdir(MODELS_DIR, { withFileTypes: true });
    const modelDirs = items.filter(item => item.isDirectory());
    
    // Get active model
    let activeModel = null;
    try {
      activeModel = await fs.readFile(ACTIVE_MODEL_PATH, 'utf-8');
      activeModel = activeModel.trim();
    } catch (error) {
      // No active model set
    }

    // Get model details for all models
    const allModels = await Promise.all(
      modelDirs.map(async (dir) => {
        const dirPath = path.join(MODELS_DIR, dir.name);
        const stats = await fs.stat(dirPath);
        
        // Check for model files in directory
        const dirFiles = await fs.readdir(dirPath);
        const hasBestModel = dirFiles.includes('best_model.pth');
        const hasFinalModel = dirFiles.includes('mobilenetv2_final.pth');
        const hasLabelMap = dirFiles.includes('label_map.json');
        
        // Get total size
        let totalSize = 0;
        for (const file of dirFiles) {
          const fileStats = await fs.stat(path.join(dirPath, file));
          totalSize += fileStats.size;
        }
        
        return {
          id: dir.name,
          name: dir.name,
          created: stats.birthtime,
          size: totalSize,
          active: activeModel === dir.name,
          path: dirPath,
          hasBestModel,
          hasFinalModel,
          hasLabelMap
        };
      })
    );

    // Sort by creation date (newest first)
    allModels.sort((a, b) => new Date(b.created) - new Date(a.created));

    // Calculate total count
    const total = allModels.length;

    // Apply pagination - slice the array for current page
    const paginatedModels = allModels.slice(offset, offset + size);

    // Derive current page if not provided
    const currentPage = Number.isFinite(Number(pageQ)) && Number(pageQ) > 0 ? Number(pageQ) : Math.floor(offset / size) + 1;

    res.json({
      success: true,
      models: paginatedModels,
      total,
      page: currentPage,
      size,
      pagination: {
        total,
        page: currentPage,
        size,
        totalPages: Math.ceil(total / size)
      }
    });

  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get models',
      error: error.message
    });
  }
};

const deleteModel = async (req, res) => {
  try {
    const { modelName } = req.params;
    const forceDelete = req.query.force === 'true';
    
    console.log(`Delete request for model: ${modelName}, force: ${forceDelete}`);
    
    const modelDir = path.join(MODELS_DIR, modelName);
    
    // Check if model directory exists
    try {
      await fs.access(modelDir);
      console.log(`Model directory found: ${modelDir}`);
    } catch (error) {
      console.log(`Model directory not found: ${modelDir}`);
      return res.status(404).json({
        success: false,
        message: `Model "${modelName}" not found`
      });
    }

    // Check if it's the active model (unless force delete)
    let activeModel = null;
    try {
      activeModel = await fs.readFile(ACTIVE_MODEL_PATH, 'utf-8');
      activeModel = activeModel.trim();
      console.log(`Active model: ${activeModel}`);
    } catch (error) {
      console.log('No active model set');
    }

    if (activeModel === modelName && !forceDelete) { 
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active model. Please activate another model first or use force delete.'
      });
    }

    // Delete the entire model directory
    console.log(`Deleting model directory: ${modelDir}`);
    await fs.rm(modelDir, { recursive: true, force: true });
    
    console.log(`Model directory deleted successfully: ${modelDir}`);
    
    res.json({
      success: true,
      message: `Model ${modelName} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete model',
      error: error.message
    });
  }
};

const getModelPlot = (req, res) => {
  try{
    const { modelName } = req.params;
    const modelDir = path.join(MODELS_DIR, modelName);
    const plotPath = path.join(modelDir, 'training_plot.png');

    console.log(`Looking for plot at: ${plotPath}`);

    if(fsSync.existsSync(plotPath)){
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600'); 
      res.sendFile(plotPath);
    } else {
      console.log('Plot file not found:', plotPath);
      res.status(404).json({ 
        error: 'Training plot not found for this model',
        message: 'The training plot diagram does not exist for this model.'
      });
    }
  } catch (error) {
    console.error('Error serving model plot:', error);
    res.status(500).json({ 
      error: 'Failed to load training plot',
      message: error.message 
    });
  }
};

const finishTraining = async (req, res) => {
  try {
    const {
      modelName,
      status,
      speciesCount,
      totalImages,
      trainAccuracy,
      valAccuracy,
      error,
    } = req.body;

    console.log('Training completion notification received');
    console.log(`   Model: ${modelName}`);
    console.log(`   Status: ${status}`);

    if (status === 'failed') {
      console.error(`   Error: ${error}`);
      return res.json({
        success: true,
        message: 'Training failure recorded',
      });
    }

    console.log(`   Train Accuracy: ${trainAccuracy}%`);
    console.log(`   Val Accuracy: ${valAccuracy}%`);

  } catch (error) {
    console.error('Failed to process training completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process training completion',
      message: error.message,
    });
  }
};

const activateModel = async (req, res) => {
  try {
    const { modelName } = req.params;
    
    console.log(`Activate request for model: ${modelName}`);
    
    const modelDir = path.join(MODELS_DIR, modelName);
    
    // Check if model directory exists
    try {
      await fs.access(modelDir);
      console.log(`Model directory found: ${modelDir}`);
    } catch (error) {
      console.log(`Model directory not found: ${modelDir}`);
      return res.status(404).json({
        success: false,
        message: `Model "${modelName}" not found`
      });
    }

    // Check if model has required files
    const dirFiles = await fs.readdir(modelDir);
    const hasBestModel = dirFiles.includes('best_model.pth');
    const hasLabelMap = dirFiles.includes('label_map.json');
    
    if (!hasBestModel || !hasLabelMap) {
      return res.status(400).json({
        success: false,
        message: 'Model is incomplete. Missing required files (best_model.pth or label_map.json)'
      });
    }

    // Write the model name to active_model.txt
    await fs.writeFile(ACTIVE_MODEL_PATH, modelName, 'utf-8');
    
    console.log(`Model ${modelName} activated successfully`);
    
    res.json({
      success: true,
      message: `Model ${modelName} is now active`,
      activeModel: modelName
    });

  } catch (error) {
    console.error('Error activating model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate model',
      error: error.message
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
  finishTraining,
  activateModel
};