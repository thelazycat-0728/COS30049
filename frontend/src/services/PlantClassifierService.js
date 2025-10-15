import * as TFLite from "react-native-fast-tflite";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";

class PlantClassifierService {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.labels = [];
    this.isOnline = true;
    this.setupNetworkListener();
  }

  setupNetworkListener() {
    NetInfo.addEventListener((state) => {
      this.isOnline = state.isConnected;
      console.log(`📡 Network status: ${this.isOnline ? "Online" : "Offline"}`);
    });
  }

  async loadModel() {
    try {
      console.log("TFLite exports:", Object.keys(TFLite));

      // Load labels from JSON file
      const labelsData = require("../../assets/model/labels.json");
      this.labels = Array.isArray(labelsData)
        ? labelsData
        : Object.values(labelsData);

      console.log(`✅ Loaded ${this.labels.length} plant species`);

      // Load TFLite model using the correct API
      try {
        const { loadTensorflowModel } = TFLite;

        if (!loadTensorflowModel) {
          throw new Error("loadTensorflowModel function not available");
        }

        const modelPath = require("../../assets/model/plant_classifier.tflite");

        console.log("Loading model from:", modelPath);

        // Use loadTensorflowModel function
        this.model = await loadTensorflowModel(modelPath);
        this.isModelLoaded = true;

        console.log("✅ TFLite model loaded - Offline mode ready!");
        console.log(`   Model inputs:`, this.model.inputs);
        console.log(`   Model outputs:`, this.model.outputs);

        return true;
      } catch (tfliteError) {
        console.warn("⚠️ TFLite loading failed, using mock classifier");
        console.error("TFLite error:", tfliteError);
        console.error(
          "Make sure plant_classifier.tflite is in android/app/src/main/assets/"
        );
        this.isModelLoaded = false;
        return false;
      }
    } catch (error) {
      console.error("❌ Error loading model:", error);
      // Fallback labels
      this.labels = [
        "Rafflesia tuan-mudae",
        "Nepenthes rajah",
        "Hibiscus rosa-sinensis",
        "Bougainvillea spectabilis",
        "Heliconia rostrata",
      ];
      return false;
    }
  }

  async classifyImage(imageUri) {
    if (!this.labels.length) {
      await this.loadModel();
    }

    if (this.isModelLoaded && this.model) {
      return this.classifyWithTFLite(imageUri);
    } else {
      console.log("📱 Using mock classifier (Development mode)");
      return this.mockClassify(imageUri);
    }
  }

  async classifyWithTFLite(imageUri) {
  try {
    console.log("🔍 Running offline TFLite classification...");
    console.log("Input image URI:", imageUri);

    // Step 1: Resize and convert image to required format (224x224 RGB)
    const processedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: 224, height: 224 } }],
      { compress: 1, format: SaveFormat.JPEG, base64: true }
    );

    console.log("Processed image:", processedImage);

    if (!processedImage || !processedImage.uri) {
      throw new Error("Image processing failed - no URI returned");
    }

    // Step 2: Get base64 data
    const imageBase64 = processedImage.base64;

    if (!imageBase64) {
      throw new Error("No base64 data in processed image");
    }

    console.log("Image base64 length:", imageBase64.length);

    // Step 3: Get model input details
    const inputShape = this.model.inputs[0].shape; // e.g., [1, 224, 224, 3]
    const inputType = this.model.inputs[0].dataType; // e.g., 'float32' or 'uint8'

    console.log("Input shape:", inputShape);
    console.log("Input type:", inputType);

    // Step 4: Convert image to tensor
    const tensor = this.imageToTensor(imageBase64, inputShape, inputType);
    console.log("Tensor created, length:", tensor.length);
    console.log("Tensor type:", tensor.constructor.name);
    console.log("Tensor buffer:", tensor.buffer);

    // Step 5: Run inference - pass the TypedArray directly, not wrapped in object
    console.log("Running model inference...");
    
    // ✅ Pass tensor directly as TypedArray (Float32Array or Uint8Array)
    const outputTensors = this.model.runSync([tensor]);
    
    console.log("Inference complete");
    console.log("Output tensors:", outputTensors);
    console.log("Output length:", outputTensors ? outputTensors.length : 0);

    // Step 6: Process results
    if (!outputTensors || outputTensors.length === 0) {
      throw new Error("Model returned no output tensors");
    }

    const probabilities = outputTensors[0];

    if (!probabilities) {
      throw new Error("Model returned no probabilities");
    }

    // Check if probabilities is a TypedArray or regular array
    const probabilitiesArray = probabilities.length !== undefined 
      ? probabilities 
      : Array.from(probabilities);

    if (probabilitiesArray.length === 0) {
      throw new Error("Model returned empty predictions");
    }

    console.log("Probabilities count:", probabilitiesArray.length);
    console.log("First 5 probabilities:", probabilitiesArray.slice(0, 5));

    // Get top 5 predictions
    const indexedProbs = Array.from(probabilitiesArray).map((prob, index) => ({
      index,
      confidence: prob * 100,
    }));

    const topPredictions = indexedProbs
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .filter((p) => p.confidence >= 5)
      .map((result) => ({
        species:
          this.labels[result.index] || `Unknown Species ${result.index}`,
        confidence: Math.round(result.confidence * 100) / 100,
        source: "offline",
      }));

    console.log("✅ Offline classification complete");
    console.log("Top predictions:", topPredictions);

    return topPredictions;
  } catch (error) {
    console.error("❌ TFLite classification error:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    return this.mockClassify(imageUri);
  }
}

  imageToTensor(base64Image, shape, dataType) {
  try {
    const [batch, height, width, channels] = shape;
    const totalPixels = height * width * channels;

    console.log(
      `Creating tensor: ${height}x${width}x${channels}, type: ${dataType}`
    );

    // Decode base64 to binary
    const binaryString = atob(base64Image);
    console.log("Binary string length:", binaryString.length);

    if (dataType === "float32") {
      const tensor = new Float32Array(totalPixels);
      const step = Math.floor(binaryString.length / totalPixels);

      for (let i = 0; i < totalPixels; i++) {
        const byteIndex = Math.min(i * step, binaryString.length - 1);
        tensor[i] = binaryString.charCodeAt(byteIndex) / 255.0;
      }

      // ✅ Fixed: Calculate min/max without spreading the array
      let min = tensor[0];
      let max = tensor[0];
      for (let i = 1; i < tensor.length; i++) {
        if (tensor[i] < min) min = tensor[i];
        if (tensor[i] > max) max = tensor[i];
      }

      console.log("Float32 tensor created, min/max:", min, max);
      return tensor;
      
    } else if (dataType === "uint8") {
      const tensor = new Uint8Array(totalPixels);
      const step = Math.floor(binaryString.length / totalPixels);

      for (let i = 0; i < totalPixels; i++) {
        const byteIndex = Math.min(i * step, binaryString.length - 1);
        tensor[i] = binaryString.charCodeAt(byteIndex);
      }

      // ✅ Fixed: Calculate min/max without spreading the array
      let min = tensor[0];
      let max = tensor[0];
      for (let i = 1; i < tensor.length; i++) {
        if (tensor[i] < min) min = tensor[i];
        if (tensor[i] > max) max = tensor[i];
      }

      console.log("Uint8 tensor created, min/max:", min, max);
      return tensor;
    }

    throw new Error(`Unsupported data type: ${dataType}`);
  } catch (error) {
    console.error("Error in imageToTensor:", error);
    throw error;
  }
}

  mockClassify(imageUri) {
    console.log("🎭 Using mock predictions (for development)");

    const imageHash = imageUri
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const primaryIndex = imageHash % this.labels.length;

    const predictions = [];

    predictions.push({
      species: this.labels[primaryIndex],
      confidence: Math.round((75 + Math.random() * 20) * 100) / 100,
      source: "mock",
    });

    const remainingLabels = this.labels.filter(
      (_, idx) => idx !== primaryIndex
    );
    const shuffled = remainingLabels.sort(() => 0.5 - Math.random());

    for (let i = 0; i < Math.min(4, shuffled.length); i++) {
      predictions.push({
        species: shuffled[i],
        confidence: Math.round((60 - i * 10 + Math.random() * 8) * 100) / 100,
        source: "mock",
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  async close() {
    try {
      if (this.model) {
        this.model.dispose();
        this.model = null;
        this.isModelLoaded = false;
        console.log("✅ TFLite model closed");
      }
    } catch (error) {
      console.error("❌ Error closing model:", error);
    }
  }

  isOfflineCapable() {
    return this.isModelLoaded;
  }

  getNetworkStatus() {
    return this.isOnline;
  }

  getSupportedSpecies() {
    return [...this.labels];
  }

  getModelInfo() {
    return {
      isLoaded: this.isModelLoaded,
      speciesCount: this.labels.length,
      modelType: this.isModelLoaded ? "TFLite (Offline)" : "Mock (Development)",
      offlineCapable: this.isModelLoaded,
      networkStatus: this.isOnline ? "Online" : "Offline",
    };
  }
}

export default new PlantClassifierService();
