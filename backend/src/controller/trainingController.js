// src/controller/trainingController.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Store training process and status
let trainingProcess = null;
let trainingStatus = {
  isTraining: false,
  progress: 0,
  epoch: 0,
  totalEpochs: 0,
  loss: null,
  accuracy: null,
  startTime: null,
  logs: [],
  error: null
};

// Path to your Python training script
const PYTHON_SCRIPT_PATH = path.join(__dirname, '../../ml/train.py');
const MODELS_DIR = path.join(__dirname, '../../ml/models');
const ACTIVE_MODEL_PATH = path.join(__dirname, '../../ml/active_model.txt');

// Ensure directories exist
const ensureDirectories = async () => {
  try {
    await fs.mkdir(MODELS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
};

ensureDirectories();

/**
 * Start model training
 */
const startTraining = async (req, res) => {
  try {
    // Check if training is already in progress
    if (trainingStatus.isTraining) {
      return res.status(400).json({
        success: false,
        message: 'Training is already in progress'
      });
    }

    // Get training parameters from request
    const {
      epochs = 50,
      batchSize = 32,
      learningRate = 0.001,
      modelName = `model_${Date.now()}`
    } = req.body;

    // Validate Python script exists
    if (!fsSync.existsSync(PYTHON_SCRIPT_PATH)) {
      return res.status(500).json({
        success: false,
        message: 'Training script not found'
      });
    }

    // Reset training status
    trainingStatus = {
      isTraining: true,
      progress: 0,
      epoch: 0,
      totalEpochs: epochs,
      loss: null,
      accuracy: null,
      startTime: new Date(),
      logs: [],
      error: null,
      modelName
    };

    // Start Python training process
    trainingProcess = spawn('python', [
      PYTHON_SCRIPT_PATH,
      '--epochs', epochs.toString(),
      '--batch-size', batchSize.toString(),
      '--learning-rate', learningRate.toString(),
      '--model-name', modelName,
      '--output-dir', MODELS_DIR
    ]);

    // Capture stdout (training logs)
    trainingProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Training output:', output);
      
      // Parse training progress
      parseTrainingOutput(output);
      
      // Store log
      trainingStatus.logs.push({
        timestamp: new Date(),
        message: output
      });
      
      // Keep only last 100 logs
      if (trainingStatus.logs.length > 100) {
        trainingStatus.logs.shift();
      }
    });

    // Capture stderr (errors)
    trainingProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Training error:', error);
      trainingStatus.error = error;
      trainingStatus.logs.push({
        timestamp: new Date(),
        message: `ERROR: ${error}`,
        isError: true
      });
    });

    // Handle process completion
    trainingProcess.on('close', (code) => {
      console.log(`Training process exited with code ${code}`);
      trainingStatus.isTraining = false;
      
      if (code === 0) {
        trainingStatus.progress = 100;
        trainingStatus.logs.push({
          timestamp: new Date(),
          message: 'Training completed successfully!'
        });
      } else {
        trainingStatus.error = `Training failed with exit code ${code}`;
      }
    });

    res.json({
      success: true,
      message: 'Training started successfully',
      status: trainingStatus
    });

  } catch (error) {
    console.error('Error starting training:', error);
    trainingStatus.isTraining = false;
    trainingStatus.error = error.message;
    
    res.status(500).json({
      success: false,
      message: 'Failed to start training',
      error: error.message
    });
  }
};

/**
 * Get current training status
 */
const getTrainingStatus = (req, res) => {
  res.json({
    success: true,
    status: trainingStatus
  });
};

/**
 * Stop training process
 */
const stopTraining = (req, res) => {
  try {
    if (!trainingStatus.isTraining) {
      return res.status(400).json({
        success: false,
        message: 'No training in progress'
      });
    }

    if (trainingProcess) {
      trainingProcess.kill('SIGTERM');
      trainingStatus.isTraining = false;
      trainingStatus.logs.push({
        timestamp: new Date(),
        message: 'Training stopped by user'
      });
    }

    res.json({
      success: true,
      message: 'Training stopped successfully',
      status: trainingStatus
    });

  } catch (error) {
    console.error('Error stopping training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop training',
      error: error.message
    });
  }
};

/**
 * Get list of trained models
 */
const getModels = async (req, res) => {
  try {
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

    // Get model details
    const models = await Promise.all(
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
    models.sort((a, b) => b.created - a.created);

    res.json({
      success: true,
      models
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
    const forceDelete = req.query.force === 'true'; // Add this line
    
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

    if (activeModel === modelName && !forceDelete) { // Modified this line
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

/**
 * Activate a model
 */
const activateModel = async (req, res) => {
  try {
    const { modelName } = req.params;
    
    // Check if model exists
    const files = await fs.readdir(MODELS_DIR);
    const modelFile = files.find(file => 
      path.parse(file).name === modelName && (file.endsWith('.pth') || file.endsWith('.pt'))
    );

    if (!modelFile) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Set as active model
    await fs.writeFile(ACTIVE_MODEL_PATH, modelName);

    res.json({
      success: true,
      message: 'Model activated successfully'
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

/**
 * Parse training output to extract metrics
 */
const parseTrainingOutput = (output) => {
  //Parse epoch: "Epoch 5/50"
  const epochMatch = output.match(/Epoch[:\s]+(\d+)[\/\s]+(\d+)/i);
  if (epochMatch) {
    trainingStatus.epoch = parseInt(epochMatch[1]);
    trainingStatus.totalEpochs = parseInt(epochMatch[2]);
    trainingStatus.progress = (trainingStatus.epoch / trainingStatus.totalEpochs) * 100;
  }

  //Detect training stage
  if (output.includes('Stage 1: Training classifier head') || 
      output.includes('Training classifier head')) {
    trainingStatus.stage = 'stage1';
  }
  
  if (output.includes('Stage 2: Fine-tuning entire network') || 
      output.includes('Fine-tuning entire network')) {
    trainingStatus.stage = 'stage2';
  }

  //Parse loss: "Loss: 0.1234"
  const lossMatch = output.match(/Loss[:\s]+([\d.]+)/i);
  if (lossMatch) {
    trainingStatus.loss = parseFloat(lossMatch[1]);
  }

  //Parse accuracy: "Acc: 0.9567"
  const accMatch = output.match(/Acc(?:uracy)?[:\s]+([\d.]+)/i);
  if (accMatch) {
    trainingStatus.accuracy = parseFloat(accMatch[1]);
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


module.exports = {
  startTraining,
  getTrainingStatus,
  stopTraining,
  getModels,
  deleteModel,
  activateModel,
  getModelPlot
};