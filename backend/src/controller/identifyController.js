const { ExifImage } = require('exif');
const pool = require('../config/database');
const StorageService = require('../services/storageService');

// Convert GPS EXIF values to decimal
function toDecimal(degree, minute, second, ref) {
  let val = degree + minute / 60 + second / 3600;
  if (ref === 'S' || ref === 'W') val = -val;
  return val;
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

      // Upload image using storage service to get a URL
      let imageUrl;
      try {
        imageUrl = await StorageService.uploadImage(req.file);
      } catch (e) {
        console.error('Image upload failed:', e);
        imageUrl = null;
      }

      try {
        new ExifImage({ image: req.file.buffer }, async (error, exifData) => {
          if (error) {
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.status(400).json({ error: error.message, image_url: imageUrl, observationId });
          }

          const gps = exifData.gps;
          if (!gps || !gps.GPSLatitude || !gps.GPSLongitude) {
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.status(404).json({ error: 'No GPS data found', image_url: imageUrl, observationId });
          }

          const lat = toDecimal(gps.GPSLatitude[0], gps.GPSLatitude[1], gps.GPSLatitude[2], gps.GPSLatitudeRef);
          const lon = toDecimal(gps.GPSLongitude[0], gps.GPSLongitude[1], gps.GPSLongitude[2], gps.GPSLongitudeRef);
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;

          const observationId = await insertObservation({ image_url: imageUrl, lat, lon, status: 'verified' });
          return res.json({ coordinates: { lat, lon }, googleMapsUrl, image_url: imageUrl, observationId });
        });
      } catch (err) {
        console.error('Server error during image processing:', err);
        res.status(500).json({ error: 'Server error while processing the image' });
      }
    } catch (error) {
      console.error('extractLocation unexpected error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  static async extractLocationBase64(req, res) {
    try {
      if (!req.body.image || !req.body.filename) {
        return res.status(400).json({ error: 'No image data uploaded' });
      }

      const imageBuffer = Buffer.from(req.body.image, 'base64');
      let imageUrl;
      try {
        imageUrl = await StorageService.uploadImage({ buffer: imageBuffer, originalname: req.body.filename, mimetype: 'image/jpeg' });
      } catch (e) {
        console.error('Image upload failed:', e);
        imageUrl = null;
      }

      try {
        new ExifImage({ image: imageBuffer }, async (error, exifData) => {
          if (error) {
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.status(400).json({
              coordinates: { lat: null, lon: null },
              image_url: imageUrl,
              error: error.message,
              observationId,
            });
          }

          const gps = exifData.gps;
          if (!gps || !gps.GPSLatitude || !gps.GPSLongitude) {
            const observationId = await insertObservation({ image_url: imageUrl, lat: null, lon: null });
            return res.status(404).json({ error: 'No GPS coordinates found', image_url: imageUrl, observationId });
          }

          const lat = toDecimal(gps.GPSLatitude[0], gps.GPSLatitude[1], gps.GPSLatitude[2], gps.GPSLatitudeRef);
          const lon = toDecimal(gps.GPSLongitude[0], gps.GPSLongitude[1], gps.GPSLongitude[2], gps.GPSLongitudeRef);
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;

          const observationId = await insertObservation({ image_url: imageUrl, lat, lon, status: 'verified' });
          return res.json({ coordinates: { lat, lon }, googleMapsUrl, image_url: imageUrl, observationId });
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    } catch (error) {
      console.error('extractLocationBase64 unexpected error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
}

module.exports = IdentifyController;