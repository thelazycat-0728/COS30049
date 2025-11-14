const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const cors = require('cors');
require('dotenv').config();
const mysql = require('mysql2/promise');
const schedule = require('node-schedule');

const multer = require('multer');
const os = require('os');

const app = express();
app.use(express.json());
app.use(cors());

//Configuration
const PORT = process.env.PORT || 5000;
//Point to main backend's models folder
const MODELS_DIR = path.join(__dirname, './ml/models');
const ACTIVE_MODEL_PATH = path.join(__dirname, './ml/active_model.txt');
const DATASET_DIR = path.join(__dirname, './New_Dataset'); 
const PYTHON_SCRIPT = path.join(__dirname, 'train.py');

const db = mysql.createPool({
  host: 'cos30049-smartplantapp.duckdns.org',
  user: 'root',
  password: 'YourStrongPassword!',
  database: 'COS30049_SMARTPLANT'
});

//Training state
let trainingProcess = null;
let trainingStatus = {
  isTraining: false,
  modelName: null,
  progress: 0,
  epoch: 0,
  totalEpochs: 0,
  loss: null,
  accuracy: null,
  stage: null,
  startTime: null,
  error: null
};

//Ensure directories exist
const ensureDirectories = async () => {
  try {
    await fs.mkdir(MODELS_DIR, { recursive: true });
    console.log('Models directory ready:', MODELS_DIR);
  } catch (error) {
    console.error('Error creating directories:', error);
  }
};

ensureDirectories();

// ============================================
// ROUTES
// ============================================

//Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'AI Training Server is running',
    isTraining: trainingStatus.isTraining,
    modelsDir: MODELS_DIR
  });
});


// ============================================
// TRAINING MODEL SECTION
// ============================================
async function trainmodel(modelName, epochs, batchSize, learningRate, userID, isAuto){

  //Reset training status
    trainingStatus = {
      isTraining: true,
      modelName: modelName,
      progress: 0,
      epoch: 0,
      totalEpochs: epochs,
      loss: null,
      accuracy: null,
      stage: 'stage1',
      startTime: new Date(),
      error: null
    };

    const args = [
      PYTHON_SCRIPT,
      '--data-dir', DATASET_DIR,
      '--epochs', epochs.toString(),
      '--batch-size', batchSize.toString(),
      '--learning-rate', learningRate.toString(),
      '--model-name', modelName,
      '--output-dir', MODELS_DIR,
    ];

    if (!isAuto){
      args.push('--triggered-by', userID.toString());
    }
    
    //Start training process
    trainingProcess = spawn('python', args);

    let actualModelName = modelName;

    //Capture stdout
    trainingProcess.stdout.on('data', async (data) => {
      const output = data.toString();
      console.log(output);
      const lines = output.split('\n').filter(line => line.trim());


      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line);
          console.log('Parsed JSON:', jsonData);
          
          if (jsonData.event === "model_folder_created") {
            actualModelName = jsonData.model_name;
            trainingProcess.actualModelName = actualModelName;
            trainingStatus.modelName = actualModelName;
            if (isAuto){
              console.log('[Auto-Retrain] Model folder created:', actualModelName);
            } else {
              console.log('Model folder created:', actualModelName);
            }
          }
        } catch (err) {
          parseTrainingOutput(line);
        }
      }
    });
    //Capture stderr
    trainingProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (isAuto){
        console.error('[Auto-Retrain] Error:', error);
      } else {
        console.error('Training error:', error);
      }
      trainingStatus.error = error;
    });

    //Handle process completion
    trainingProcess.on('close', async (code) => {
      if (isAuto) {
        console.log(`[Auto-Retrain] Process exited with code ${code}`);
      } else {
        console.log(`Training process exited with code ${code}`);
      }
      trainingStatus.isTraining = false;
      let newStatus = 'failed';
      

      if (code === 0) {
        trainingStatus.progress = 100;
        if (isAuto) {
          console.log('[Auto-Retrain] Training completed successfully');
          newStatus = 'completed';

          // Wait for database update
          await new Promise(resolve => setTimeout(resolve, 2000));
          await autoActivate(actualModelName);
          await resetRetrainStats();
        } else {
          console.log('Training completed successfully');
          newStatus = 'completed';
        }

      } else if (code == null) {
        trainingStatus.error = 'Training stopped by admin';
        if (isAuto) {
          console.log('[Auto-Retrain] Training stopped by admin');
        } else {
          console.log('Training stopped by admin');
        }
        newStatus = 'failed';
      } else {
        trainingStatus.error = `Training failed with exit code ${code}`;
        if (isAuto) {
          console.error('[Auto-Retrain] Training failed');
        } else {
          console.error('Training failed');
        }

        newStatus = 'failed';


        if (actualModelName){
          const modelDir = path.join(MODELS_DIR, actualModelName);
          try {
            if (fsSync.existsSync(modelDir)) {
              await fs.rm(modelDir, { recursive: true, force: true });
              console.log(`Cleaned up failed model folder: ${actualModelName}`);
            }
          } catch (err) {
            console.error('Failed to clean up model folder:', err.message);
          }
        }
      }

      try {
        if (actualModelName){
          await db.execute(
            `UPDATE training_history 
            SET status = ?, error_message = ?
            WHERE model_version = ? AND status = 'in_progress'`,
            [newStatus, trainingStatus.error ,actualModelName]
          );
          console.log(`Database updated: ${actualModelName} → ${newStatus}`);
        }
      }catch (dbErr) {
        console.error('Failed to update training status in database:', dbErr.message);

      }
    });
};



//Start training
app.post('/api/train', async (req, res) => {
  try {
    if (trainingStatus.isTraining) {
      return res.status(409).json({
        success: false,
        error: 'Training already in progress',
        message: 'Training already in progress',
        currentStatus: trainingStatus
      });
    }

    const {
      epochs = 30,
      batchSize = 32,
      learningRate = 0.00001,
      modelName = `model_${Date.now()}`,
      userID = ''
    } = req.body;
    
    // Sanitize model name: trim spaces and remove invalid characters
    const sanitizedModelName = modelName.trim().replace(/[<>:"/\\|?*]/g, '_');
    
    if (!sanitizedModelName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid model name'
      });
    }
    
    let actualModelName = sanitizedModelName;
    console.log('Starting training:', { actualModelName, epochs, batchSize, learningRate });

    //Validate Python script exists
    if (!fsSync.existsSync(PYTHON_SCRIPT)) {
      return res.status(500).json({
        success: false,
        error: 'Training script not found',
        path: PYTHON_SCRIPT
      });
    }

    await trainmodel(actualModelName, epochs, batchSize, learningRate, userID, false);

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
      error: 'Failed to start training',
      message: error.message
    });
  }
});

//Get training status
app.get('/api/train/status', (req, res) => {
  res.json({
    success: true,
    status: trainingStatus
  });
});

//Stop training
app.post('/api/train/stop', async (req, res) => {
  try {
    if (!trainingStatus.isTraining) {
      return res.status(400).json({
        success: false,
        error: 'No training in progress'
      });
    }

    console.log('trainingProcess.actualModelName:', trainingProcess?.actualModelName);
    console.log('trainingStatus.modelName:', trainingStatus.modelName);

    const modelToDelete = trainingProcess?.actualModelName || trainingStatus.modelName;

    // 1.Stop the Python training process
    if (trainingProcess) {
      trainingProcess.kill('SIGTERM');
      trainingProcess = null;
      trainingStatus.isTraining = false;
      trainingStatus.error = 'Training stopped by user';
      console.log('Training stopped by user');
    }

    // 2.Delete incomplete model locally
    if (modelToDelete) {
      const modelDir = path.join(MODELS_DIR, modelToDelete);
      
      console.log(`Deleting incomplete model locally: ${modelDir}`);

      try {
        if (fsSync.existsSync(modelDir)) {
          await fs.rm(modelDir, { recursive: true, force: true });
          console.log(`Deleted incomplete model folder: ${modelToDelete}`);
        }
      } catch (err) {
        console.error('Failed to delete incomplete model:', err.message);
      }
    }

    // 3.Return response
    res.json({
      success: true,
      message: 'Training stopped and incomplete model deleted',
      status: trainingStatus
    });

  } catch (error) {
    console.error('Error stopping training:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current active model name
async function getActiveModelName() {
  try {
    const activeModel = await fs.readFile(ACTIVE_MODEL_PATH, 'utf-8');
    return activeModel.trim();
  } catch (error) {
    console.log('No active model found');
    return null;
  }
}


// Get list of models (with pagination, filtering, sorting)
app.get('/api/models', async (req, res) => {
  try {
    // Parse pagination params: support limit/offset or page/size
    const sizeQ = req.query.limit ?? req.query.size;
    const pageQ = req.query.page;
    const offsetQ = req.query.offset;

    // Parse filter, search, and NEW sort parameters
    const searchQuery = req.query.search || '';
    const filterOption = req.query.filter || 'all';
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    console.log('Received query params:', {
      search: searchQuery,
      filter: filterOption,
      sortBy: sortBy,
      sortOrder: sortOrder,
      page: pageQ,
      limit: sizeQ
    });

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
    
    console.log(`Found ${modelDirs.length} model directories`);
    
    const [rows] = await db.query(`
      SELECT th.model_version, u.username AS username
      FROM training_history th
      LEFT JOIN Users u ON th.triggered_by = u.user_id
      WHERE status = 'completed'
      GROUP BY th.model_version
    `);
    const trainedByMap = {};
    for (const row of rows) {
      trainedByMap[row.model_version] = row.username || 'Automated Retrain'
    }


    // Get active model
    let activeModel = null;
   
    activeModel = await getActiveModelName();

    // Get model details for all models
    let allModels = await Promise.all(
      modelDirs.map(async (dir) => {
        const dirPath = path.join(MODELS_DIR, dir.name);
        const stats = await fs.stat(dirPath);
        
        // Check for model files in directory
        const dirFiles = await fs.readdir(dirPath);
        const hasBestModel = dirFiles.includes('best_model.pth');
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
          hasLabelMap,
          trainedBy: trainedByMap.hasOwnProperty(dir.name)
            ? trainedByMap[dir.name] || 'Automated Retrain'
            : 'default_model'
        };
      })
    );

    console.log(`Processing ${allModels.length} models before filtering`);

    allModels = allModels.filter(model => model.hasBestModel);
    console.log(`After filtering by best_model.pth presence: ${allModels.length} models`);
    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      allModels = allModels.filter(model => 
        model.name.toLowerCase().includes(searchLower)
      );
      console.log(`After search filter: ${allModels.length} models`);
    }

    // Apply status filter
    if (filterOption === 'active') {
      allModels = allModels.filter(model => model.active);
      console.log(`After active filter: ${allModels.length} models`);
    } else if (filterOption === 'inactive') {
      allModels = allModels.filter(model => !model.active);
      console.log(`After inactive filter: ${allModels.length} models`);
    }

    // Apply sorting with direction support
    console.log(`Sorting by: ${sortBy}, order: ${sortOrder}`);
    switch (sortBy) {
      case 'name':
        allModels.sort((a, b) => {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === 'ASC' ? comparison : -comparison;
        });
        console.log('Sorted by name');
        break;
      case 'size':
        allModels.sort((a, b) => {
          const comparison = a.size - b.size;
          return sortOrder === 'ASC' ? comparison : -comparison;
        });
        console.log('Sorted by size');
        break;
      case 'created_at':
      default:
        allModels.sort((a, b) => {
          const comparison = new Date(a.created) - new Date(b.created);
          return sortOrder === 'ASC' ? comparison : -comparison;
        });
        console.log('Sorted by creation date');
        break;
    }

    // Calculate total count after filtering
    const total = allModels.length;

    // Apply pagination - slice the array for current page
    const paginatedModels = allModels.slice(offset, offset + size);

    // Derive current page if not provided
    const currentPage = Number.isFinite(Number(pageQ)) && Number(pageQ) > 0 ? Number(pageQ) : Math.floor(offset / size) + 1;

    console.log(`Returning ${paginatedModels.length} models for page ${currentPage}`);
    console.log('First model sample:', paginatedModels[0] ? {
      name: paginatedModels[0].name,
      created: paginatedModels[0].created,
      size: paginatedModels[0].size,
      active: paginatedModels[0].active
    } : 'No models');

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
      },
      filters: {
        search: searchQuery,
        filter: filterOption,
        sortBy: sortBy,
        sortOrder: sortOrder
      }
    });

  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get models',
      error: error.message
    });
  }});


// Delete model
app.delete('/api/models/:modelName', async (req, res) => {
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
    
    activeModel = await getActiveModelName();

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
});

// Get model plot image
app.get('/api/models/:modelName/plot', (req, res) => {
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
});

// Activate model
app.patch('/api/models/:modelName/activate', async (req, res) => {
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
});


// ============================================
// CLASSIFYING IMAGE SECTION
// ============================================

// Temporary file upload
const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Classify image
app.post('/api/classify', upload.single('image'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    tempFilePath = req.file.path;
    console.log('Received image for classification:', tempFilePath);

    // Check if there's an active model
    let activeModel = null;
  
    activeModel = await getActiveModelName(); 
    console.log('Using active model:', activeModel);
    if (activeModel == null){
      return res.status(400).json({
        success: false,
        error: 'No active model available. Please activate a model first.'
      });
    }

    // Path to classification script
    const CLASSIFY_SCRIPT = path.join(__dirname, 'ml', 'classify_plant.py');
    
    if (!fsSync.existsSync(CLASSIFY_SCRIPT)) {
      return res.status(500).json({
        success: false,
        error: 'Classification script not found'
      });
    }

    // Run Python classification with active model
    const pythonProcess = spawn('python', [
      CLASSIFY_SCRIPT,
      tempFilePath,
      '--model-dir', path.join(MODELS_DIR, activeModel)
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', data => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
        console.log('Temp file cleaned up:', tempFilePath);
      } catch (err) {
        console.error('Failed to clean up temp file:', err);
      }

      if (code !== 0) {
        console.error('Classification failed:', errorOutput);
        return res.status(500).json({
          success: false,
          error: 'Classification failed',
          details: errorOutput
        });
      }

      try {
        const result = JSON.parse(output);
        console.log('Classification result:', result);
        res.json(result);
      } catch (err) {
        console.error('Failed to parse classification output:', output);
        res.status(500).json({
          success: false,
          error: 'Invalid classification output',
          details: output
        });
      }
    });

  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (err) {
        console.error('Failed to clean up temp file:', err);
      }
    }

    console.error('Classification error:', error);
    res.status(500).json({
      success: false,
      error: 'Classification failed',
      message: error.message
    });
  }
});


// ============================================
// ADMIN MODIFY PLANT CLASS NAME SECTION
// ============================================

//Create dataset folder for new plant
app.post('/api/dataset/folder', async (req, res) => {
  try {
    const { folderName } = req.body;
    
    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      });
    }

    // Sanitize folder name
    let sanitizedName = folderName
      .trim()
      .toLowerCase() // convert to lowercase
      .replace(/\s+/g, '_') // replace spaces with underscores
      .replace(/[<>:"/\\|?*]/g, '_'); // sanitize invalid chars
    const folderPath = path.join(DATASET_DIR, sanitizedName);

    // Check if folder already exists
    if (fsSync.existsSync(folderPath)) {
      return res.status(400).json({
        success: false,
        error: 'Folder already exists'
      });
    }

    // Create the folder
    await fs.mkdir(folderPath, { recursive: true });
    console.log('Created dataset folder:', folderPath);

    res.json({
      success: true,
      message: 'Dataset folder created successfully',
      folderName: sanitizedName,
      folderPath
    });

  } catch (error) {
    console.error('Error creating dataset folder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dataset folder',
      message: error.message
    });
  }
});

// Rename dataset folder
app.patch('/api/dataset/folder', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({
        success: false,
        error: 'Both old and new folder names are required'
      });
    }

    // Sanitize names
    const sanitize = name => 
      name.trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[<>:"/\\|?*]/g, '_');
    const sanitizedOldName = sanitize(oldName);
    const sanitizedNewName = sanitize(newName);

    const oldPath = path.join(DATASET_DIR, sanitizedOldName);
    const newPath = path.join(DATASET_DIR, sanitizedNewName);

    // Check if old folder exists
    if (!fsSync.existsSync(oldPath)) {
      return res.status(404).json({
        success: false,
        error: 'Original folder not found'
      });
    }

    // Check if new folder name already exists
    if (fsSync.existsSync(newPath)) {
      return res.status(400).json({
        success: false,
        error: 'A folder with the new name already exists'
      });
    }

    // Rename the folder
    await fs.rename(oldPath, newPath);
    console.log(`Renamed dataset folder from ${sanitizedOldName} to ${sanitizedNewName}`);

    res.json({
      success: true,
      message: 'Dataset folder renamed successfully',
      oldName: sanitizedOldName,
      newName: sanitizedNewName
    });

  } catch (error) {
    console.error('Error renaming dataset folder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rename dataset folder',
      message: error.message
    });
  }
});

// ============================================
// EXPERT VERIFIED IMAGE
// ============================================

// Receive verified observation image for training dataset
app.post('/api/training/add-image', upload.single('image'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const { class_name, observation_id } = req.body;
    
    if (!class_name) {
      return res.status(400).json({
        success: false,
        error: 'class_name is required'
      });
    }

    tempFilePath = req.file.path;
    console.log('Received training image:', {
      observation_id,
      class_name,
      tempFile: tempFilePath
    });

    // Sanitize class name
    const sanitizedClassName = class_name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[<>:"/\\|?*]/g, '_');

    // Target folder path
    const classFolder = path.join(DATASET_DIR, sanitizedClassName);

    // Create folder if it doesn't exist
    if (!fsSync.existsSync(classFolder)) {
      await fs.mkdir(classFolder, { recursive: true });
      console.log('Created new class folder:', classFolder);
    }

    // Generate unique filename
    const fileExt = path.extname(req.file.originalname) || '.jpg';
    const newFileName = `obs_${observation_id}_${Date.now()}${fileExt}`;
    const destinationPath = path.join(classFolder, newFileName);

    // Move file from temp to dataset folder
    await fs.copyFile(tempFilePath, destinationPath);
    console.log('Image saved to dataset:', destinationPath);

    // Clean up temp file
    await fs.unlink(tempFilePath);

    res.json({
      success: true,
      message: 'Image added to training dataset',
      class_name: sanitizedClassName,
      file_path: destinationPath,
      observation_id
    });

  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (err) {
        console.error('Failed to clean up temp file:', err);
      }
    }

    console.error('Error adding training image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add image to training dataset',
      message: error.message
    });
  }
});

// ============================================
// AUTO-RETRAIN FUNCTIONS
// ============================================

// Check if retrain thresholds are met
async function checkRetrainThreshold() {
  try {
    console.log('\n[Auto-Retrain] Checking thresholds...');
    
    const [rows] = await db.query(`
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
      console.log('[Auto-Retrain] No retrain stats found');
      return false;
    }
    
    const stats = rows[0];
    
    // Check if auto_retrain is enabled
    if (stats.auto_retrain == 0) {
      console.log('[Auto-Retrain] Auto-retrain is disabled');
      return false;
    }
    if (trainingStatus.isTraining) {
      console.log('[Auto-Retrain] Training already in progress, skipping');
      return false;
    }
    const countThresholdMet = stats.rejected_count >= stats.threshold_count;
    const accuracyThresholdMet = stats.retrain_accuracy <= stats.threshold_accuracy;
    
    console.log(`[Auto-Retrain] Rejected count: ${stats.rejected_count}/${stats.threshold_count} ${countThresholdMet ? 'Yes' : 'No'}`);
    console.log(`[Auto-Retrain] Retrain accuracy: ${stats.retrain_accuracy}/${stats.threshold_accuracy} ${accuracyThresholdMet ? 'Yes' : 'No'}`);
    
    if (countThresholdMet && accuracyThresholdMet) {
      console.log('[Auto-Retrain] Both thresholds met. Triggering retrain...');
      return true;
    }
    
    console.log('[Auto-Retrain] Both thresholds not met yet');
    return false;
    
  } catch (error) {
    console.error('[Auto-Retrain] Error checking threshold:', error);
    return false;
  }
}

// Get validation accuracy from database for modelName
async function getModelValidationAccuracy(modelName) {
  try {
    const [rows] = await db.query(`
      SELECT validation_accuracy 
      FROM training_history 
      WHERE model_version = ? AND status = 'completed'
      LIMIT 1
    `, [modelName]);
    
    if (rows && rows.length > 0) {
      const accuracy = parseFloat(rows[0].validation_accuracy);
      console.log(`[Auto-Retrain] Model "${modelName}" validation accuracy: ${accuracy}%`);
      return accuracy;
    }
    
    console.log(`[Auto-Retrain] No validation accuracy found for model "${modelName}"`);
    return null;
    
  } catch (error) {
    console.error('[Auto-Retrain] Error getting model accuracy:', error);
    return null;
  }
}

// Auto-activate model if it's better than current active model
async function autoActivate(newModelName) {
  try {
    console.log('\n[Auto-Retrain] Checking if new model should be activated...');
    
    // Get new model's validation accuracy
    const newModelAccuracy = await getModelValidationAccuracy(newModelName);
    
    if (newModelAccuracy === null) {
      console.log('[Auto-Retrain] Cannot activate: New model accuracy not found in database');
      return false;
    }
    
    // Get current active model
    const activeModelName = await getActiveModelName();
    
    if (!activeModelName) {
      console.log('[Auto-Retrain] No active model. Activating new model by default...');
      await activateModel(newModelName);
      console.log(`[Auto-Retrain] Activated new model: ${newModelName}`);
      return true;
    }
    
    // Get active model's validation accuracy
    const activeModelAccuracy = await getModelValidationAccuracy(activeModelName);
    
    if (activeModelAccuracy === null) {
      console.log('[Auto-Retrain] Active model accuracy not found. Activating new model...');
      await activateModel(newModelName);
      console.log(`[Auto-Retrain] Activated new model: ${newModelName}`);
      return true;
    }
    
    // Compare accuracies
    console.log('\n[Auto-Retrain] Accuracy Comparison:');
    console.log(`  Current Active: ${activeModelName} = ${activeModelAccuracy}%`);
    console.log(`  New Model:      ${newModelName} = ${newModelAccuracy}%`);
    console.log(`  Difference:     ${(newModelAccuracy - activeModelAccuracy).toFixed(4)}%`);
    
    if (newModelAccuracy > activeModelAccuracy) {
      console.log('\n[Auto-Retrain] New model is better, Activating');
      await activateModel(newModelName);
      console.log(`[Auto-Retrain] Successfully activated: ${newModelName}`);
      return true;
    } else {
      console.log('\n[Auto-Retrain] New model is not better than current active model');
      console.log(`[Auto-Retrain] Keeping active model: ${activeModelName}`);
      return false;
    }
    
  } catch (error) {
    console.error('[Auto-Retrain] Error in auto-activation:', error);
    return false;
  }
}

// Helper function to activate a model
async function activateModel(modelName) {
  const modelDir = path.join(MODELS_DIR, modelName);
  
  // Verify model exists and has required files
  const dirFiles = await fs.readdir(modelDir);
  const hasBestModel = dirFiles.includes('best_model.pth');
  const hasLabelMap = dirFiles.includes('label_map.json');
  
  if (!hasBestModel || !hasLabelMap) {
    throw new Error('Model is incomplete. Missing required files');
  }
  
  // Write to active_model.txt
  await fs.writeFile(ACTIVE_MODEL_PATH, modelName, 'utf-8');
  console.log(`[Auto-Retrain] Model activated: ${modelName}`);
}

// Trigger automatic retraining
async function triggerAutoRetrain() {
  try {
    console.log('[Auto-Retrain] Starting automatic retraining...');
    
    // Generate model name with timestamp
    const modelName = `auto_retrain_${Date.now()}`;
    const epochs = 1;
    const batchSize = 32;
    const learningRate = 0.00001;
    await trainmodel(modelName, epochs, batchSize, learningRate, null, true);
    return true;
    
  } catch (error) {
    console.error('[Auto-Retrain] Error triggering retrain:', error);
    trainingStatus.isTraining = false;
    trainingStatus.error = error.message;
    return false;
  }
}

// Reset retrain stats after successful training
async function resetRetrainStats() {
  try {
    await db.query(`
      UPDATE retrain_stats 
      SET retrain_accuracy = 1.00,
          rejected_count = 0
      WHERE id = 1
    `);
    console.log('[Auto-Retrain] Stats reset successfully');
  } catch (error) {
    console.error('[Auto-Retrain] Failed to reset stats:', error);
  }
}


// Main auto-retrain check job
async function autoRetrainJob() {
  console.log('\n' + '='.repeat(60));
  console.log(`[Auto-Retrain] Running check at ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  const shouldRetrain = await checkRetrainThreshold();
  
  if (shouldRetrain) {
    await triggerAutoRetrain();
  } else {
    console.log('[Auto-Retrain] No action needed\n');
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseTrainingOutput(output) {
  const epochMatch = output.match(/Epoch[:\s]+(\d+)[\/\s]+(\d+)/i);
  if (epochMatch) {
    trainingStatus.epoch = parseInt(epochMatch[1]);
    trainingStatus.totalEpochs = parseInt(epochMatch[2]);
    trainingStatus.progress = (trainingStatus.epoch / trainingStatus.totalEpochs) * 100;
  }

  if (output.includes('Stage 1') || output.includes('classifier head')) {
    trainingStatus.stage = 'stage1';
  }
  if (output.includes('Stage 2') || output.includes('Fine-tuning')) {
    trainingStatus.stage = 'stage2';
  }

  const lossMatch = output.match(/Loss[:\s]+([\d.]+)/i);
  if (lossMatch) {
    trainingStatus.loss = parseFloat(lossMatch[1]);
  }

  const accMatch = output.match(/Acc(?:uracy)?[:\s]+([\d.]+)/i);
  if (accMatch) {
    trainingStatus.accuracy = parseFloat(accMatch[1]);
  }
}


// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('=== AI Training Server ===');
  console.log(`Server running on port ${PORT}`);
  console.log(`Models directory: ${MODELS_DIR}`);
  console.log(`Python script: ${PYTHON_SCRIPT}`);
  console.log('');
  console.log('Running initial auto-retrain check on startup...\n');
  setTimeout(async () => {
    await autoRetrainJob();
  }, 5000); // Wait 5 seconds for server to fully start

  const job = schedule.scheduleJob('*/10 * * * *', autoRetrainJob); // Every 10 minutes
  //const job = schedule.scheduleJob('*/1 * * * *', autoRetrainJob); // Every 1 minutes for testing
  console.log('Auto-retrain scheduler initialized (checks every 10 minutes)');
  console.log('');
});

