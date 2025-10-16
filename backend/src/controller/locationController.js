const pool = require('../config/database');

// Allowed conservation status values
const CONSERVATION_STATUSES = [
  'least_concern',
  'near_threatened',
  'vulnerable',
  'endangered',
  'critically_endangered'
];

// Helper to build filter clauses safely
function buildFilterWhereAndParams(query) {
  const { family, conservation_status, start_date, end_date } = query || {};
  const where = [
    "po.latitude IS NOT NULL AND po.longitude IS NOT NULL",
    "po.status = 'verified'",
  ];
  const params = [];

  if (family && typeof family === 'string' && family.trim().length > 0) {
    where.push('p.family = ?');
    params.push(family.trim());
  }

  if (conservation_status && typeof conservation_status === 'string') {
    const statuses = conservation_status
      .split(',')
      .map(s => s.trim())
      .filter(s => CONSERVATION_STATUSES.includes(s));
    if (statuses.length > 0) {
      where.push(`p.conservation_status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }

  // Expect YYYY-MM-DD; only basic format validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (start_date && dateRegex.test(start_date)) {
    where.push('po.observation_date >= ?');
    params.push(start_date);
  }
  if (end_date && dateRegex.test(end_date)) {
    where.push('po.observation_date <= ?');
    params.push(end_date);
  }

  return { where, params };
}

class LocationController {
  static async adminLocations(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
      const { where, params } = buildFilterWhereAndParams(req.query);
      const sql = `
        SELECT 
          po.observation_id,
          po.user_id,
          po.latitude,
          po.longitude,
          po.status,
          po.observation_date AS observation_date,
          po.image_url,
          po.public,
          p.plant_id,
          p.common_name,
          p.scientific_name,
          p.family,
          p.description,
          p.conservation_status
        FROM PlantObservations po
        JOIN Plants p ON p.plant_id = po.plant_id
        WHERE ${where.join(' AND ')}
        ORDER BY po.observation_date DESC
        LIMIT ?
      `;
      const [rows] = await pool.execute(sql, [...params, limit]);

      const locations = rows.map(r => ({
        observation_id: r.observation_id,
        user_id: r.user_id,
        status: r.status,
        observation_date: r.observation_date,
        image_url: r.image_url,
        plant_id: r.plant_id,
        plant: {
          common_name: r.common_name,
          scientific_name: r.scientific_name,
          family: r.family,
          description: r.description,
          conservation_status: r.conservation_status
        },
        public: r.public,
        coordinates: { lat: Number(r.latitude), lon: Number(r.longitude) }
      }));

      res.json({ count: locations.length, locations });
    } catch (err) {
      console.error('Error fetching admin locations:', err);
      res.status(500).json({ error: 'Failed to fetch admin locations' });
    }
  }

  static async userLocations(req, res) {
    try {
      const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
      const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
      const { where, params } = buildFilterWhereAndParams(req.query);
      if (userId) {
        where.push('po.user_id = ?');
        params.push(userId);
      }
      // Users can only see observations explicitly marked public
      where.push('po.public = 1');

      const sql = `
        SELECT 
          po.observation_id,
          po.user_id,
          po.latitude,
          po.longitude,
          po.status,
          po.observation_date AS observation_date,
          po.image_url,
          po.public,
          p.plant_id,
          p.common_name,
          p.scientific_name,
          p.family,
          p.description,
          p.conservation_status
        FROM PlantObservations po
        JOIN Plants p ON p.plant_id = po.plant_id
        WHERE ${where.join(' AND ')}
        ORDER BY po.observation_date DESC
        LIMIT ?
      `;
      const [rows] = await pool.execute(sql, [...params, limit]);

      const locations = rows.map(r => {
        let lat = r.latitude != null ? Number(r.latitude) : null;
        let lon = r.longitude != null ? Number(r.longitude) : null;
        const isSensitive = r.conservation_status === 'endangered' || r.conservation_status === 'critically_endangered';
        const isPublic = r.public === 1 || r.public === true;
        if (isSensitive && !isPublic && lat != null && lon != null) {
          lat = Math.round(lat * 1000) / 1000; // ~100m precision
          lon = Math.round(lon * 1000) / 1000;
        }
        return {
          observation_id: r.observation_id,
          user_id: r.user_id,
          status: r.status,
          observation_date: r.observation_date,
          image_url: r.image_url,
          plant_id: r.plant_id,
          plant: {
            common_name: r.common_name,
            scientific_name: r.scientific_name,
            family: r.family,
            description: r.description,
            conservation_status: r.conservation_status
          },
          coordinates: lat != null && lon != null ? { lat, lon } : { lat: null, lon: null }
        };
      });

      res.json({ count: locations.length, locations });
    } catch (err) {
      console.error('Error fetching user locations:', err);
      res.status(500).json({ error: 'Failed to fetch user locations' });
    }
  }

  static async publicLocations(req, res) {
    try {
      const { where, params } = buildFilterWhereAndParams(req.query);
      // Public map only shows observations explicitly marked public
      where.push('po.public = 1');
      const sql = `
        SELECT 
          po.observation_id,
          po.user_id,
          po.latitude,
          po.longitude,
          po.status,
          po.observation_date,
          po.image_url,
          po.public,
          p.plant_id,
          p.common_name,
          p.scientific_name,
          p.family,
          p.description,
          p.conservation_status
        FROM PlantObservations po
        JOIN Plants p ON p.plant_id = po.plant_id
        WHERE ${where.join(' AND ')}
        ORDER BY po.observation_date DESC
      `;
      const [rows] = await pool.execute(sql, params);

      const locations = rows.map(r => {
        let lat = r.latitude != null ? Number(r.latitude) : null;
        let lon = r.longitude != null ? Number(r.longitude) : null;
        const isSensitive = r.conservation_status === 'endangered' || r.conservation_status === 'critically_endangered';
        const isPublic = r.public === 1 || r.public === true;
        if (isSensitive && !isPublic && lat != null && lon != null) {
          lat = Math.round(lat * 1000) / 1000;
          lon = Math.round(lon * 1000) / 1000;
        }
        return {
          observation_id: r.observation_id,
          user_id: r.user_id,
          status: r.status,
          observation_date: r.observation_date,
          image_url: r.image_url,
          plant_id: r.plant_id,
          plant: {
            common_name: r.common_name,
            scientific_name: r.scientific_name,
            family: r.family,
            description: r.description,
            conservation_status: r.conservation_status
          },
          coordinates: lat != null && lon != null ? { lat, lon } : { lat: null, lon: null }
        };
      });

      res.json({ count: locations.length, locations });
    } catch (err) {
      console.error('Error fetching public locations:', err);
      res.status(500).json({ error: 'Failed to fetch plant locations' });
    }
  }

  static async densityHeatmap(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit || '1000', 10) || 1000, 5000);
      const { where, params } = buildFilterWhereAndParams(req.query);

      // Optional viewport bounding box filtering
      const minLat = req.query.min_lat ? Number(req.query.min_lat) : null;
      const maxLat = req.query.max_lat ? Number(req.query.max_lat) : null;
      const minLon = req.query.min_lon ? Number(req.query.min_lon) : null;
      const maxLon = req.query.max_lon ? Number(req.query.max_lon) : null;
      if (minLat != null && maxLat != null) {
        where.push('po.latitude BETWEEN ? AND ?');
        params.push(minLat, maxLat);
      }
      if (minLon != null && maxLon != null) {
        where.push('po.longitude BETWEEN ? AND ?');
        params.push(minLon, maxLon);
      }

      const sql = `
        SELECT 
          po.latitude AS latitude,
          po.longitude AS longitude,
          COUNT(*) AS observation_count,
          AVG(po.confidence_score) AS avg_confidence
        FROM PlantObservations po
        JOIN Plants p ON p.plant_id = po.plant_id
        WHERE ${where.join(' AND ')}
        GROUP BY po.latitude, po.longitude
        ORDER BY observation_count DESC
        LIMIT ?
      `;
      const [rows] = await pool.execute(sql, [...params, limit]);

      const points = rows.map(r => ({
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        observation_count: Number(r.observation_count),
        avg_confidence: r.avg_confidence != null ? Number(r.avg_confidence) : null,
      }));
      const maxCount = points.reduce((m, p) => Math.max(m, p.observation_count), 0);
      res.json({ count: points.length, max_count: maxCount, points });
    } catch (err) {
      console.error('Error fetching density heatmap:', err);
      res.status(500).json({ error: 'Failed to fetch density heatmap' });
    }
  }

  static async plantDetails(req, res) {
    try {
      const [rows] = await pool.execute('SELECT * FROM Plants WHERE plant_id = ?', [req.params.plant_id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Plant not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Error fetching plant details:', err);
      res.status(500).json({ error: 'Failed to fetch plant details' });
    }
  }
}

module.exports = LocationController;
