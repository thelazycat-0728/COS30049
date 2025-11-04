const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const auditLogger = require('../logger/auditLogger');

exports.classifyImage = async (req, res) => {
  try {
    const { image_path } = req.body; // <-- just a path from frontend
    if (!image_path) {
      return res.status(400).json({ success: false, error: "No image path provided" });
    }

    // Convert relative to absolute path
    const imageFullPath = path.join(__dirname, '../..', image_path);
    console.log('Classifying existing image:', imageFullPath);

    if (!fs.existsSync(imageFullPath)) {
      return res.status(404).json({ success: false, error: "Image not found on server" });
    }

    // Run Python classification
    const PYTHON_SCRIPT = path.join(__dirname, '../../ml/classify_plant.py');
    auditLogger.info('classification.request', { requestId: req.requestId, image_path });
    const pythonProcess = spawn('python', [PYTHON_SCRIPT, imageFullPath]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', data => output += data.toString());
    pythonProcess.stderr.on('data', data => errorOutput += data.toString());

    pythonProcess.on('close', code => {
      if (code !== 0) {
        auditLogger.error('classification.error', { requestId: req.requestId, code, stderr: errorOutput });
        return res.status(500).json({
          success: false,
          error: 'Classification failed',
          details: errorOutput
        });
      }
      try {
        const result = JSON.parse(output);
        auditLogger.info('classification.result', { requestId: req.requestId, result });
        res.json(result);
      } catch {
        auditLogger.error('classification.parse_error', { requestId: req.requestId, raw: output });
        res.status(500).json({
          success: false,
          error: 'Invalid classification output',
          details: output
        });
      }
    });

  } catch (err) {
    console.error('Classification error:', err);
    auditLogger.error('classification.exception', { requestId: req.requestId, message: err?.message });
    res.status(500).json({ success: false, error: err.message });
  }

};
