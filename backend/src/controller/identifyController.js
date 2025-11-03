const { ExifImage } = require('exif');
const pool = require('../config/database');
const StorageService = require('../services/storageService');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Convert GPS EXIF values to decimal
function toDecimal(degree, minute, second, ref) {
  let val = degree + minute / 60 + second / 3600;
  if (ref === 'S' || ref === 'W') val = -val;
  return val;
}

// Enhanced EXIF extraction with better error handling and fallback processing
function extractGPSFromExif(exifData) {
  if (!exifData) return null;
  
  const gps = exifData.gps;
  if (!gps || !gps.GPSLatitude || !gps.GPSLongitude) {
    return null;
  }

  try {
    const lat = toDecimal(gps.GPSLatitude[0], gps.GPSLatitude[1], gps.GPSLatitude[2], gps.GPSLatitudeRef);
    const lon = toDecimal(gps.GPSLongitude[0], gps.GPSLongitude[1], gps.GPSLongitude[2], gps.GPSLongitudeRef);
    
    // Validate coordinates are within valid ranges
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
  } catch (error) {
    console.error('GPS coordinate conversion error:', error);
  }
  
  return null;
}

// Insert Observation (dynamic plant_id, defaults when absent)
async function insertObservation({ user_id, plant_id, image_url, lat, lon, status, confidence_score, is_unsure }) {
  let obsStatus = 'pending';
  if (is_unsure === true) {
    obsStatus = 'unsure';
  } else if (status) {
    obsStatus = status;
  }  
  const uid = user_id;
  let pid = plant_id;

  if (uid == null) {
    throw new Error('user_id is required to create an observation');
  }

  if (!pid) {
    const [plants] = await pool.query('SELECT plant_id FROM Plants ORDER BY plant_id ASC LIMIT 1');
    if (plants.length === 0) {
      throw new Error('No plants found in the database. Please add at least one plant record.');
    }
    pid = plants[0].plant_id;
  }

  // Parse and normalize confidence_score to 0.00–1.00
  const parsedConfidenceScore = confidence_score != null ? 
    (typeof confidence_score === 'number' ? confidence_score : parseFloat(confidence_score)) : null;

  let validConfidenceScore = null;
  if (parsedConfidenceScore != null) {
    if (parsedConfidenceScore > 1 && parsedConfidenceScore <= 100) {
      // Convert percentage (e.g., 85) to fraction (0.85)
      validConfidenceScore = parsedConfidenceScore / 100;
    } else if (parsedConfidenceScore >= 0 && parsedConfidenceScore <= 1) {
      // Already a fraction
      validConfidenceScore = parsedConfidenceScore;
    } else if (parsedConfidenceScore > 100) {
      validConfidenceScore = 1;
    } else {
      validConfidenceScore = null;
    }
    // Round to two decimals to fit DECIMAL(3,2)
    validConfidenceScore = validConfidenceScore != null 
      ? Math.round(validConfidenceScore * 100) / 100 
      : null;
  }

  const sql = `
    INSERT INTO PlantObservations (user_id, plant_id, image_url, latitude, longitude, status, confidence_score, observation_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  const params = [uid, pid, image_url ?? null, lat ?? null, lon ?? null, obsStatus, validConfidenceScore];
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

// Resolve plant_id using top prediction from the classifier
async function resolvePlantIdFromImage(imageUrl) {
  if (!imageUrl) return null;
  const imageFullPath = path.join(__dirname, '../..', imageUrl);
  const PYTHON_SCRIPT = path.join(__dirname, '../../ml/classify_plant.py');

  const resultJson = await new Promise((resolve, reject) => {
    const py = spawn('python', [PYTHON_SCRIPT, imageFullPath]);
    let out = '';
    let err = '';
    py.stdout.on('data', (d) => { out += d.toString(); });
    py.stderr.on('data', (d) => { err += d.toString(); });
    py.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(err || 'Classification failed'));
      }
      resolve(out);
    });
    py.on('error', (e) => reject(e));
  });

  let parsed;
  try { parsed = JSON.parse(resultJson); } catch { return null; }
  const preds = Array.isArray(parsed?.predictions) ? parsed.predictions : [];
  if (preds.length === 0) return null;
  const top = preds[0];
  const name = top?.species || top?.className || null;
  if (!name) return null;

  const [rows] = await pool.execute(
    'SELECT plant_id FROM Plants WHERE species = ? OR common_name = ? OR scientific_name = ? LIMIT 1',
    [name, name, name]
  );
  return rows && rows[0] ? rows[0].plant_id : null;
}

class IdentifyController {
  static async extractLocation(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      console.log('Processing file upload:', req.file.originalname, 'Size:', req.file.size);

      // Upload image using storage service to get a URL
      let imageUrl;
      try {
        imageUrl = await StorageService.uploadImage(req.file);
        console.log('Image uploaded successfully:', imageUrl);
      } catch (e) {
        console.error('Image upload failed:', e);
        imageUrl = null;
      }

      // Enhanced EXIF processing with better error handling
      try {
        new ExifImage({ image: req.file.buffer }, async (error, exifData) => {
          if (error) {
            console.log('EXIF extraction error:', error.message);
            return res.json({ 
              coordinates: { lat: null, lon: null }, 
              googleMapsUrl: null,
              image_url: imageUrl, 
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const gpsCoords = extractGPSFromExif(exifData);
          if (!gpsCoords) {
            console.log('No valid GPS coordinates found in EXIF data');
            return res.json({ 
              coordinates: { lat: null, lon: null }, 
              googleMapsUrl: null,
              image_url: imageUrl, 
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const { lat, lon } = gpsCoords;
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
          console.log('GPS coordinates extracted:', lat, lon);

          return res.json({ 
            coordinates: { lat, lon }, 
            googleMapsUrl, 
            image_url: imageUrl, 
            message: 'Location extracted successfully. Click Submit to save.'
          });
        });
      } catch (err) {
        console.error('Server error during image processing:', err);
        res.json({ 
          coordinates: { lat: null, lon: null }, 
          googleMapsUrl: null,
          image_url: imageUrl, 
          message: 'Image uploaded successfully, but GPS extraction failed'
        });
      }
    } catch (error) {
      console.error('extractLocation unexpected error:', error);
      res.status(500).json({ error: 'Server error during image processing' });
    }
  }

  static async extractLocationBase64(req, res) {
    try {
      if (!req.body.image || !req.body.filename) {
        return res.status(400).json({ error: 'No image data uploaded' });
      }

      console.log('Processing base64 image:', req.body.filename);

      const imageBuffer = Buffer.from(req.body.image, 'base64');
      let imageUrl;
      try {
        imageUrl = await StorageService.uploadImage({ 
          buffer: imageBuffer, 
          originalname: req.body.filename, 
          mimetype: 'image/jpeg' 
        });
        console.log('Base64 image uploaded successfully:', imageUrl);
      } catch (e) {
        console.error('Image upload failed:', e);
        imageUrl = null;
      }

      // Enhanced EXIF processing with better error handling
      try {
        new ExifImage({ image: imageBuffer }, async (error, exifData) => {
          if (error) {
            console.log('EXIF extraction error for base64:', error.message);
            return res.json({
              coordinates: { lat: null, lon: null },
              googleMapsUrl: null,
              image_url: imageUrl,
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const gpsCoords = extractGPSFromExif(exifData);
          if (!gpsCoords) {
            console.log('No valid GPS coordinates found in base64 EXIF data');
            return res.json({ 
              coordinates: { lat: null, lon: null }, 
              googleMapsUrl: null,
              image_url: imageUrl, 
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const { lat, lon } = gpsCoords;
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
          console.log('GPS coordinates extracted from base64:', lat, lon);

          return res.json({ 
            coordinates: { lat, lon }, 
            googleMapsUrl, 
            image_url: imageUrl, 
            message: 'Location extracted successfully. Click Submit to save.'
          });
        });
      } catch (error) {
        console.error('Server error during base64 processing:', error);
        res.json({ 
          coordinates: { lat: null, lon: null }, 
          googleMapsUrl: null,
          image_url: imageUrl, 
          message: 'Image uploaded successfully, but GPS extraction failed'
        });
      }
    } catch (error) {
      console.error('extractLocationBase64 unexpected error:', error);
      res.status(500).json({ error: 'Server error during image processing' });
    }
  }

  static async submitObservation(req, res) {
    try {
      const { image_url, lat, lon, user_id, plant_id, status, confidence_score, is_unsure } = req.body || {};
      if (!image_url) {
        return res.status(400).json({ error: 'image_url is required' });
      }

      const parsedLat = lat != null ? (typeof lat === 'number' ? lat : parseFloat(lat)) : null;
      const parsedLon = lon != null ? (typeof lon === 'number' ? lon : parseFloat(lon)) : null;

      // Determine user_id from auth if available, else from body
      const actualUserId = (req.user && req.user.id) ? req.user.id : (user_id != null ? user_id : null);

      // Determine plant_id: prefer provided, else classify image to get top prediction and map to Plants table
      let actualPlantId = plant_id != null ? plant_id : null;
      let finalConfidence = confidence_score;
      if (actualPlantId == null) {
        try {
          const resolvedPid = await resolvePlantIdFromImage(image_url);
          if (resolvedPid != null) {
            actualPlantId = resolvedPid;
          }
        } catch (e) {
          console.warn('Failed to resolve plant_id via classifier:', e.message || e);
        }
      }

      const observationId = await insertObservation({
        user_id: actualUserId,
        plant_id: actualPlantId,
        image_url,
        lat: parsedLat,
        lon: parsedLon,
        status,
        confidence_score: finalConfidence,
        is_unsure: is_unsure
      });

      const googleMapsUrl = (parsedLat != null && parsedLon != null)
        ? `https://maps.google.com/?q=${parsedLat},${parsedLon}`
        : null;

      // Parse and normalize confidence score for response (0.00–1.00)
      const respParsed = confidence_score != null ? 
        (typeof confidence_score === 'number' ? confidence_score : parseFloat(confidence_score)) : null;
      let respConfidence = null;
      if (respParsed != null) {
        if (respParsed > 1 && respParsed <= 100) {
          respConfidence = respParsed / 100;
        } else if (respParsed >= 0 && respParsed <= 1) {
          respConfidence = respParsed;
        } else if (respParsed > 100) {
          respConfidence = 1;
        } else {
          respConfidence = null;
        }
        respConfidence = respConfidence != null 
          ? Math.round(respConfidence * 100) / 100 
          : null;
      }

      return res.json({
        success: true,
        observationId,
        image_url,
        coordinates: { lat: parsedLat ?? null, lon: parsedLon ?? null },
        confidence_score: respConfidence,
        googleMapsUrl,
        message: 'Observation saved successfully (status: pending)'
      });
    } catch (error) {
      console.error('submitObservation error:', error);
      res.status(500).json({ error: 'Failed to save observation' });
    }
  }

  //delete image
  static async deleteImage(req, res) {
    try {
      const { image_url } = req.body;
      
      if (!image_url) {
        return res.status(400).json({ 
          success: false,
          error: 'No image URL provided' 
        });
      }

      console.log('Delete request for image:', image_url);
      
      //Extract filename from URL
      const filename = image_url.split('/').pop();
      
      //Sanitize filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        console.error(' Invalid filename detected:', filename);
        return res.status(400).json({ 
          success: false,
          error: 'Invalid filename' 
        });
      }
      
      //Validate file extension
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileExt = path.extname(filename).toLowerCase();
      if (!allowedExtensions.includes(fileExt)) {
        console.error('Invalid file type:', fileExt);
        return res.status(400).json({ 
          success: false,
          error: 'Invalid file type' 
        });
      }
      
      //File is in backend/uploads
      const filepath = path.join(__dirname, '..', '..', 'uploads', filename);
      
      console.log('Looking for file at:', filepath);
      
      //Check if file exists and delete it
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log('Successfully deleted image:', filename);
        return res.json({
          success: true,
          message: 'Image deleted successfully'
        });
      } else {
        console.log('Image not found:', filename);
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }
      
    } catch (error) {
      console.error('Error deleting image:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete image'
      });
    }
  }
}

module.exports = IdentifyController;
