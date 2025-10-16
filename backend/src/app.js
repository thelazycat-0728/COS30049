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
const expertRouter = require('./routes/expert.routes');
const userRouter = require('./routes/user.routes'); 




//const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use('/observations', plantsObservationRouter);
app.use('/identify', identifyRouter);
app.use('/iot', iotRouter);
app.use('/map', mapRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/expert', expertRouter);
app.use('/user', userRouter);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));



// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SmartPlant API is running' });
});



// Error handling (must be last)
//app.use(errorHandler);

module.exports = app;
