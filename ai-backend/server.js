const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const cors = require('cors');
const { json } = require('stream/consumers');

const app = express();
app.use(express.json());
app.use(cors());

//Configuration
const PORT = process.env.PORT || 5000;
//Point to main backend's models folder
const MODELS_DIR = path.join(__dirname, '../backend/ml/models');
const PYTHON_SCRIPT = path.join(__dirname, 'train.py');
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || 'http://localhost:5000';

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

//Start training
app.post('/train', async (req, res) => {
  try {
    if (trainingStatus.isTraining) {
      return res.status(409).json({
        success: false,
        error: 'Training already in progress',
        currentStatus: trainingStatus
      });
    }

    const {
      datasetPath = './New_Dataset',
      epochs = 30,
      batchSize = 32,
      learningRate = 0.00001,
      modelName = `model_${Date.now()}`,
      callbackUrl
    } = req.body;
    let actualModelName = modelName;
    console.log('Starting training:', { modelName, epochs, batchSize, learningRate });

    //Validate Python script exists
    if (!fsSync.existsSync(PYTHON_SCRIPT)) {
      return res.status(500).json({
        success: false,
        error: 'Training script not found',
        path: PYTHON_SCRIPT
      });
    }

    //Reset training status
    trainingStatus = {
      isTraining: true,
      modelName,
      progress: 0,
      epoch: 0,
      totalEpochs: epochs,
      loss: null,
      accuracy: null,
      stage: 'stage1',
      startTime: new Date(),
      error: null
    };

    //Start training process
    trainingProcess = spawn('python', [
      PYTHON_SCRIPT,
      '--data-dir', datasetPath,
      '--epochs', epochs.toString(),
      '--batch-size', batchSize.toString(),
      '--learning-rate', learningRate.toString(),
      '--model-name', modelName,
      '--output-dir', MODELS_DIR
    ]);

    //Capture stdout
    trainingProcess.stdout.on('data', async (data) => {
      const output = data.toString();
      console.log(output);
      const lines = output.split('\n').filter(line => line.trim());


      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line);
          console.log('✅ Parsed JSON:', jsonData);
          
          if (jsonData.event === "model_folder_created") {
            actualModelName = jsonData.model_name;
            trainingProcess.actualModelName = actualModelName;
            trainingStatus.modelName = actualModelName;
            
            console.log('🎯 STORED actualModelName:', trainingProcess.actualModelName);
            
            if (callbackUrl) {
              await notifyMainBackend(callbackUrl, actualModelName, "folder_created");
            }
            return;
          }
        } catch (err) {
          parseTrainingOutput(line);
        }
      }
    });


    //Capture stderr
    trainingProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Training error:', error);
      trainingStatus.error = error;
    });

    //Handle process completion
    trainingProcess.on('close', async (code) => {
      console.log(`Training process exited with code ${code}`);
      trainingStatus.isTraining = false;

      if (code === 0) {
        trainingStatus.progress = 100;
        console.log('Training completed successfully');

      } else if (code == null) {
        trainingStatus.error = 'Training stopped by user';
        console.log('Training stopped by user');
      } else {
        trainingStatus.error = `Training failed with exit code ${code}`;
        console.error('Training failed');

        if (callbackUrl) {
          await notifyMainBackend(callbackUrl, actualModelName, 'failed', trainingStatus.error);
        }
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
      error: 'Failed to start training',
      message: error.message
    });
  }
});

//Get training status
app.get('/status', (req, res) => {
  res.json({
    success: true,
    status: trainingStatus
  });
});

//Stop training
app.post('/stop', async (req, res) => {
  try {
    if (!trainingStatus.isTraining) {
      return res.status(400).json({
        success: false,
        error: 'No training in progress'
      });
    }

    console.log('🔍 trainingProcess.actualModelName:', trainingProcess?.actualModelName);
    console.log('🔍 trainingStatus.modelName:', trainingStatus.modelName);

    const modelToDelete = trainingProcess?.actualModelName || trainingStatus.modelName;

    // 1️⃣ Stop the Python training process
    if (trainingProcess) {
      trainingProcess.kill('SIGTERM');
      trainingProcess = null;
      trainingStatus.isTraining = false;
      trainingStatus.error = 'Training stopped by user';
      console.log('Training stopped by user');
    }

    // 2️⃣ Attempt to notify the main backend to delete the incomplete model
    if (modelToDelete) {
      const callbackUrl = process.env.MAIN_BACKEND_URL || 'http://localhost:3000';

      
      const deleteUrl = `${callbackUrl}/admin/models/${modelToDelete}?force=true`;

      console.log(`🧹 Requesting main backend to delete incomplete model: ${deleteUrl}`);

      try {
        const response = await fetch(deleteUrl, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok) {
          console.log(`Backend deleted model folder: ${modelToDelete}`);
        } else {
          console.error(`Failed to delete model: ${result.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Failed to contact main backend for deletion:', err.message);
      }
    }

    // 3️⃣ Return response
    res.json({
      success: true,
      message: 'Training stopped successfully (deletion requested to backend)',
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

async function notifyMainBackend(callbackUrl, modelName, status, error = null) {
  try {
    const payload = {
      modelName,
      status,
      error,
      speciesCount: 0,
      totalImages: 0,
      trainAccuracy: trainingStatus.accuracy || 0,
      valAccuracy: trainingStatus.accuracy || 0
    };

    console.log('Notifying main backend:', payload);

    await fetch(`${callbackUrl}/admin/train/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Main backend notified');
  } catch (error) {
    console.error('Failed to notify main backend:', error.message);
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
  console.log(`Main backend: ${MAIN_BACKEND_URL}`);
  console.log('');
});