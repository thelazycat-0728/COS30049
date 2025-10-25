// import * as TFLite from "react-native-fast-tflite";
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
      // Load labels from JSON file
      const labelsData = require("../../assets/model/labels.json");
      this.labels = Array.isArray(labelsData) ? labelsData : Object.values(labelsData);

      console.log(`✅ Loaded ${this.labels.length} plant species`);

      // TFLite disabled: skip model loading
      this.isModelLoaded = false;
      this.model = null;
      return false;
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
    // Always use mock classifier while TFLite is disabled
    console.log("📱 Using mock classifier (TFLite disabled)");
    return this.mockClassify(imageUri);
  }

  /* async classifyWithTFLite(imageUri) {
    // 🔕 TFLite functionality disabled
    throw new Error("TFLite disabled");
  } */

  imageToTensor(base64Image, shape, dataType) {
    // 🔕 TFLite functionality disabled
    throw new Error("TFLite disabled");
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
      // Ensure model/state cleared even when TFLite is disabled
      this.model = null;
      this.isModelLoaded = false;
      console.log("ℹ️ TFLite disabled: no model to close");
    } catch (error) {
      console.error("❌ Error closing model:", error);
    }
  }

  isOfflineCapable() {
    // Offline classification is disabled when TFLite is disabled
    return false;
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
