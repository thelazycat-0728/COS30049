const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const plantsObservationRouter = require('./routes/plantsObservation.routes');
const identifyRouter = require('./routes/identify.routes');
const iotRouter = require('./routes/iot.routes');
const mapRouter = require('./routes/map.routes');
const authRouter = require('./routes/auth.routes');
const adminRouter = require('./routes/admin.routes');
const userRouter = require('./routes/user.routes'); 
const profileRouter = require('./routes/profile.routes');
const plantRouter = require('./routes/plant.routes');
const rateLimiter = require('./middleware/rateLimiter');
const auditMiddleware = require('./middleware/auditMiddleware');
const cookieParser = require('cookie-parser');
const { optionalAuth } = require('./middleware/auth');
const errorLogger = require('./middleware/errorLogger');


//const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Logging
app.use(cookieParser());
app.use(optionalAuth);
app.use(auditMiddleware); // Audit every request (runs after optionalAuth so req.user is available)
app.use(express.json({ limit: '10mb' }));  // Parse JSON bodies
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/observations', plantsObservationRouter);
app.use('/identify', identifyRouter);
app.use('/iot', iotRouter);
app.use('/map', mapRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/user', userRouter);
app.use('/profile', profileRouter);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/plants', plantRouter);
app.use(rateLimiter.rateLimiter); // Apply rate limiting to all routes  



// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SmartPlant API is running' });
});



// Error handling (must be last)
app.use(errorLogger);

module.exports = app;
