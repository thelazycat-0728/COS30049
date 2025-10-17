const { ExifImage } = require('exif');
const pool = require('../config/database');
const StorageService = require('../services/storageService');

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
async function insertObservation({ user_id, plant_id, image_url, lat, lon, status }) {
  const obsStatus = status || ((lat != null && lon != null) ? 'verified' : 'pending');
  const uid = user_id ?? 1; // default to 1 if not provided
  let pid = plant_id;

  if (!pid) {
    const [plants] = await pool.query('SELECT plant_id FROM Plants ORDER BY plant_id ASC LIMIT 1');
    if (plants.length === 0) {
      throw new Error('No plants found in the database. Please add at least one plant record.');
    }
    pid = plants[0].plant_id;
  }

  const sql = `
    INSERT INTO PlantObservations (user_id, plant_id, image_url, latitude, longitude, status, observation_date)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;
  const params = [uid, pid, image_url ?? null, lat ?? null, lon ?? null, obsStatus];
  const [result] = await pool.execute(sql, params);
  return result.insertId;
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
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.json({ 
              coordinates: { lat: null, lon: null }, 
              googleMapsUrl: null,
              image_url: imageUrl, 
              observationId,
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const gpsCoords = extractGPSFromExif(exifData);
          if (!gpsCoords) {
            console.log('No valid GPS coordinates found in EXIF data');
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.json({ 
              coordinates: { lat: null, lon: null }, 
              googleMapsUrl: null,
              image_url: imageUrl, 
              observationId,
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const { lat, lon } = gpsCoords;
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
          console.log('GPS coordinates extracted:', lat, lon);

          const observationId = await insertObservation({ image_url: imageUrl, lat, lon, status: 'verified' });
          return res.json({ 
            coordinates: { lat, lon }, 
            googleMapsUrl, 
            image_url: imageUrl, 
            observationId,
            message: 'Image uploaded and location extracted successfully'
          });
        });
      } catch (err) {
        console.error('Server error during image processing:', err);
        const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
        res.json({ 
          coordinates: { lat: null, lon: null }, 
          googleMapsUrl: null,
          image_url: imageUrl, 
          observationId,
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
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.json({
              coordinates: { lat: null, lon: null },
              googleMapsUrl: null,
              image_url: imageUrl,
              observationId,
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const gpsCoords = extractGPSFromExif(exifData);
          if (!gpsCoords) {
            console.log('No valid GPS coordinates found in base64 EXIF data');
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.json({ 
              coordinates: { lat: null, lon: null }, 
              googleMapsUrl: null,
              image_url: imageUrl, 
              observationId,
              message: 'Image uploaded successfully, but no GPS data found'
            });
          }

          const { lat, lon } = gpsCoords;
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
          console.log('GPS coordinates extracted from base64:', lat, lon);

          const observationId = await insertObservation({ image_url: imageUrl, lat, lon, status: 'verified' });
          return res.json({ 
            coordinates: { lat, lon }, 
            googleMapsUrl, 
            image_url: imageUrl, 
            observationId,
            message: 'Image uploaded and location extracted successfully'
          });
        });
      } catch (error) {
        console.error('Server error during base64 processing:', error);
        const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
        res.json({ 
          coordinates: { lat: null, lon: null }, 
          googleMapsUrl: null,
          image_url: imageUrl, 
          observationId,
          message: 'Image uploaded successfully, but GPS extraction failed'
        });
      }
    } catch (error) {
      console.error('extractLocationBase64 unexpected error:', error);
      res.status(500).json({ error: 'Server error during image processing' });
    }
  }
}

module.exports = IdentifyController;
