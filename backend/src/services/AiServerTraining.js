const AI_SERVER_URL = process.env.AI_SERVER_URL;
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;

const aiServerService = {
  healthCheck: async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/health`);
      return await response.json();
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  },

  startTraining: async (params) => {
    const response = await fetch(`${AI_SERVER_URL}/train`, {
      method: 'POST',
      headers:{ 'Content-Type': 'application/json'},
      body: JSON.stringify({
        ...params,
        callbackUrl: MAIN_BACKEND_URL
      })
    });
    return await response.json();
  },

  getTrainingStatus: async () => {
    const response = await fetch(`${AI_SERVER_URL}/status`);
    return await response.json();
  },

  stopTraining: async () => {
    const response = await fetch(`${AI_SERVER_URL}/stop`,{
      method: 'POST'
    });
    return await response.json();
  },
};

module.exports = aiServerService;
