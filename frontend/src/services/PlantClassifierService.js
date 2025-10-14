// frontend/src/services/PlantClassifierService.js
import { Tflite } from 'react-native-tflite';
import NetInfo from '@react-native-community/netinfo';

class PlantClassifierService {
  constructor() {
    this.isModelLoaded = false;
    this.labels = [];
    this.isOnline = true;
    this.setupNetworkListener();
  }

  setupNetworkListener() {
    // Monitor network connectivity
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      console.log(`📡 Network status: ${this.isOnline ? 'Online' : 'Offline'}`);
    });
  }

  async loadModel() {
    try {
      // Load labels from JSON file
      const labelsData = require('../../assets/model/labels.json');
      this.labels = Array.isArray(labelsData) ? labelsData : Object.values(labelsData);
      
      console.log(`✅ Loaded ${this.labels.length} plant species`);

      // Try to load TFLite model
      try {
        await Tflite.loadModel({
          model: 'plant_classifier.tflite',
          numThreads: 4,
        });
        
        this.isModelLoaded = true;
        console.log('✅ TFLite model loaded - Offline mode ready!');
        return true;
      } catch (tfliteError) {
        console.warn('⚠️ TFLite not available, using mock classifier');
        console.warn('💡 Run "npx expo prebuild" to enable native TFLite support');
        this.isModelLoaded = false;
        return false;
      }
    } catch (error) {
      console.error('❌ Error loading model:', error);
      // Fallback labels
      this.labels = [
        'Rafflesia tuan-mudae', 'Nepenthes rajah', 'Hibiscus rosa-sinensis',
        'Bougainvillea spectabilis', 'Heliconia rostrata'
      ];
      return false;
    }
  }

  async classifyImage(imageUri) {
    if (!this.labels.length) {
      await this.loadModel();
    }

    // Always use TFLite (offline) if available, regardless of network status
    if (this.isModelLoaded) {
      return this.classifyWithTFLite(imageUri);
    } else {
      // Fallback to mock for development
      console.log('📱 Using mock classifier (Development mode)');
      return this.mockClassify(imageUri);
    }
  }

  async classifyWithTFLite(imageUri) {
    try {
      console.log('🔍 Running offline TFLite classification...');
      
      const results = await Tflite.runModelOnImage({
        path: imageUri,
        imageMean: 127.5,
        imageStd: 127.5,
        numResults: 5,
        threshold: 0.05,
      });

      const predictions = results.map((result) => ({
        species: this.labels[result.index] || `Unknown Species ${result.index}`,
        confidence: Math.round(result.confidence * 100 * 100) / 100,
        source: 'offline' // Mark as offline classification
      }));

      console.log('✅ Offline classification complete');
      return predictions;
    } catch (error) {
      console.error('❌ TFLite classification error:', error);
      // Fallback to mock
      return this.mockClassify(imageUri);
    }
  }

  mockClassify(imageUri) {
    // Mock classification for development/fallback
    console.log('🎭 Using mock predictions (for development)');
    
    // Simulate processing time
    const imageHash = imageUri.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const primaryIndex = imageHash % this.labels.length;

    const predictions = [];
    
    // Top prediction
    predictions.push({
      species: this.labels[primaryIndex],
      confidence: Math.round((75 + Math.random() * 20) * 100) / 100,
      source: 'mock'
    });

    // Additional predictions
    const remainingLabels = this.labels.filter((_, idx) => idx !== primaryIndex);
    const shuffled = remainingLabels.sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < Math.min(4, shuffled.length); i++) {
      predictions.push({
        species: shuffled[i],
        confidence: Math.round((60 - i * 10 + Math.random() * 8) * 100) / 100,
        source: 'mock'
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  async close() {
    try {
      if (Tflite && this.isModelLoaded) {
        await Tflite.close();
        this.isModelLoaded = false;
        console.log('✅ TFLite model closed');
      }
    } catch (error) {
      console.error('❌ Error closing model:', error);
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
      modelType: this.isModelLoaded ? 'TFLite (Offline)' : 'Mock (Development)',
      offlineCapable: this.isModelLoaded,
      networkStatus: this.isOnline ? 'Online' : 'Offline'
    };
  }
}

export default new PlantClassifierService();