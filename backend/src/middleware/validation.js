const validateObservation = (req, res, next) => {
  const { latitude, longitude } = req.body;

  // Check if image exists
  if (!req.file && req.method === 'POST') {
    return res.status(400).json({
      success: false,
      error: 'Image is required'
    });
  }

  // Validate GPS coordinates
  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      error: 'GPS coordinates (latitude, longitude) are required'
    });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid GPS coordinates'
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      error: 'GPS coordinates out of valid range'
    });
  }

  // Store parsed values
  req.body.latitude = lat;
  req.body.longitude = lng;

  next();
};

module.exports = { validateObservation };
