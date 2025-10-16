const aiServerService = require("../services/AiServerTraining");
const Training = require("../models/Training");

/**
 * Start training
 */
exports.startTraining = async (req, res) => {
  try {
    const { epochs, batchSize, learningRate } = req.body;
    const modelName = req.body.modelName || `model_${Date.now()}`;

    const userId = req.user.id;

    console.log("📚 Training request from user:", userId);

    const activeTraining = await Training.getActiveTraining();
    if (activeTraining) {
      return res.status(409).json({
        success: false,
        error: "Another training is already in progress",
        currentTraining: {
          id: activeTraining.id,
          modelName: activeTraining.modelName,
          startedAt: activeTraining.startedAt,
          progress: activeTraining.progress,
        },
      });
    }

    const health = await aiServerService.healthCheck();
    if (health.status !== "healthy") {
      return res.status(503).json({
        success: false,
        error: "AI server is not available",
        details: health,
      });
    }

    const aiStatus = await aiServerService.getTrainingStatus();
    if (aiStatus.status.is_training) {
      return res.status(409).json({
        success: false,
        error: "AI server is already training",
        details: aiStatus.status,
      });
    }
    // Create training record
    const training = await Training.create(userId, modelName);

    // Start training
    await aiServerService.startTraining({
      datasetPath: process.env.TRAINING_DATASET_PATH || "./uploads",
      epochs: epochs || 50,
      batchSize: batchSize || 32,
      learningRate: learningRate || 0.001,
      modelName: modelName,
    });

    // Update status
    await Training.updateStatus(training, "in_progress", {
      startedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Training started",
      data: training,
    });
  } catch (error) {
    console.error("❌ Training failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start training",
      message: error.message,
    });
  }
};

/**
 * Get training status
 */
exports.getTrainingStatus = async (req, res) => {
  try {
    const result = await aiServerService.getTrainingStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Stop training
 */
exports.stopTraining = async (req, res) => {
  try {
    const result = await aiServerService.stopTraining();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.finishTraining = async (req, res) => {
  try {
    const {
      modelName,
      status,
      speciesCount,
      totalImages,
      trainAccuracy,
      valAccuracy,
      modelPath,
      labelPath,
      history,
      error,
    } = req.body;

    console.log("📥 Training completion notification received");
    console.log(`   Model: ${modelName}`);
    console.log(`   Status: ${status}`);

    if (status === "failed") {
      console.error(`   Error: ${error}`);

      // Find and update training record
      const latestTraining = await Training.getLatest();

      if (latestTraining && latestTraining.model_version === modelName) {
        await Training.updateStatus(latestTraining.id, "failed", {
          errorMessage: error,
          completedAt: new Date()
        });
      }

      return res.json({
        success: true,
        message: "Training failure recorded",
      });
    }

    console.log(`   Species: ${speciesCount}`);
    console.log(`   Images: ${totalImages}`);
    console.log(`   Train Accuracy: ${trainAccuracy}%`);
    console.log(`   Val Accuracy: ${valAccuracy}%`);

    // Find the training record by model name
    const latestTraining = await Training.getLatest();

    if (!latestTraining || latestTraining.model_version !== modelName) {
      console.warn("⚠️  Training record not found for model:", modelName);
      return res.status(404).json({
        success: false,
        error: "Training record not found",
      });
    }

    const trainingAccuracyDecimal = trainAccuracy / 100; // Convert to decimal
    const validationAccuracyDecimal = valAccuracy / 100; // Convert to decimal

    // Update training record with results
    await Training.updateStatus(latestTraining.id, "completed", {
      numImages: totalImages,
      numSpecies: speciesCount,
      trainingAccuracy: trainingAccuracyDecimal,
      validationAccuracy: validationAccuracyDecimal,
      modelVersion: modelName,
    });

    console.log("✅ Training record updated in database");

    // TODO: Optionally store additional metadata
    // - speciesCount
    // - totalImages
    // - history (training curves)

    res.json({
      success: true,
      message: "Training completion recorded",
      data: {
        trainingId: latestTraining.id,
        modelName,
        status: "completed",
        speciesCount,
        totalImages,
        trainAccuracy,
        valAccuracy,
      },
    });
  } catch (error) {
    console.error("❌ Failed to process training completion:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process training completion",
      message: error.message,
    });
  }
};

/**
 * Get all models
 */
exports.getModels = async (req, res) => {
  try {
    const result = await aiServerService.listModels();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Delete model
 */
exports.deleteModel = async (req, res) => {
  try {
    const { modelName } = req.params;
    const result = await aiServerService.deleteModel(modelName);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Activate model (set as current)
 */
exports.activateModel = async (req, res) => {
  try {
    const { modelName } = req.params;

    // TODO: Update .env or config to use this model
    // For now, just return success

    res.json({
      success: true,
      message: `Model ${modelName} activated`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get model training plot
 */
exports.getModelPlot = async (req, res) => {
  try {
    const { modelName } = req.params;
    const result = await aiServerService.getModelPlot(modelName);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
