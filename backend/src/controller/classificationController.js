const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const auditLogger = require('../logger/auditLogger');
const AI_BACKEND_URL = process.env.AI_BACKEND_URL;

exports.classifyImage = async (req, res) => {
  try {
    const { image_path } = req.body;
    
    if (!image_path) {
      return res.status(400).json({ 
        success: false, 
        error: "No image path provided" 
      });
    }

    // Convert relative to absolute path
    const imageFullPath = path.join(__dirname, '../..', image_path);
    console.log('Classifying image:', imageFullPath);

    if (!fs.existsSync(imageFullPath)) {
      return res.status(404).json({ 
        success: false, 
        error: "Image not found on server" 
      });
    }

    auditLogger.info('classification.request', { 
      requestId: req.requestId, 
      image_path 
    });

    // Create form data and send the actual image file
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imageFullPath));

    const response = await axios.post(`${AI_BACKEND_URL}/api/classify`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 30000 // 30 second timeout for classification
    });

    auditLogger.info('classification.result', { 
      requestId: req.requestId, 
      result: response.data 
    });

    res.json(response.data);

  } catch (error) {
    console.error('Classification error:', error);
    auditLogger.error('classification.error', { 
      requestId: req.requestId, 
      message: error?.message,
      image_path: req.body?.image_path
    });

    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Classification failed',
      message: error.response?.data?.message || error.message
    });
  }
};
