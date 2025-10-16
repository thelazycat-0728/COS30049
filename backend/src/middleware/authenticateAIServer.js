require('dotenv').config();

const authenticateAIServer = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key'
      });
    }

    if (apiKey !== process.env.AI_SERVER_API_KEY) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    next();
  } catch (error) {
    console.error('AI Server authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = { authenticateAIServer };