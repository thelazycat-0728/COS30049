const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class AIServerService {
  constructor() {
    this.baseURL = process.env.AI_SERVER_URL || 'http://localhost:8000';
    this.apiKey = process.env.AI_SERVER_API_KEY || 'smartplant_ai_secret_key_2025';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 300000, // 5 minutes
      headers: {
        'X-API-Key': this.apiKey
      }
    });
  }

  /**
   * Check if AI server is healthy
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Start training
   */
  async startTraining(options) {
    try {
      console.log('🚀 Requesting training from AI server...');
      
      const response = await this.client.post('/api/train/start', {
        dataset_path: options.datasetPath || './uploads',
        epochs: options.epochs || 50,
        batch_size: options.batchSize || 32,
        learning_rate: options.learningRate || 0.001,
        model_name: options.modelName || `model_${Date.now()}`
      });

      
      
      console.log('✅ Training started');
      return response.data;
    } catch (error) {
      console.error('❌ Training start failed:', error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Get training status
   */
  async getTrainingStatus() {
    try {
      const response = await this.client.get('/api/train/status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Stop training
   */
  async stopTraining() {
    try {
      const response = await this.client.post('/api/train/stop');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List models
   */
  async listModels() {
    try {
      const response = await this.client.get('/api/models');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete model
   */
  async deleteModel(modelName) {
    try {
      const response = await this.client.delete(`/api/models/${modelName}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get model plot
   */
  async getModelPlot(modelName) {
    try {
      const response = await this.client.get(`/api/models/${modelName}/plot`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Predict image
   */
  async predict(imagePath) {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      const response = await this.client.post('/api/predict', formData, {
        headers: formData.getHeaders()
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return new Error(error.response.data.error || 'AI server error');
    } else if (error.request) {
      return new Error('AI server not responding');
    }
    return new Error(error.message);
  }
}

module.exports = new AIServerService();